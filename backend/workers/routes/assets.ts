/**
 * StudyLoG.AI Backend - Asset Management Routes
 * R2 storage for project files and game assets
 */

import { Router } from '../router';
import { requireAuth } from '../middleware';
import type { Env } from '../types';

export const assetRoutes = new Router();

// Max file sizes
const MAX_PROJECT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ASSET_SIZE = 50 * 1024 * 1024; // 50MB

// POST /project/upload - Upload project file
assetRoutes.post('/project/upload', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > MAX_PROJECT_SIZE) {
    return Response.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Max file size is 10MB' } },
      { status: 413 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const path = formData.get('path') as string;

  if (!file || !path) {
    return Response.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'file and path required' } },
      { status: 400 }
    );
  }

  // Sanitize path
  const safePath = sanitizePath(path);
  const key = `${auth.studentId}/${safePath}`;

  await env.PROJECT_STORAGE.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
    },
  });

  return Response.json({
    success: true,
    data: { key, size: file.size },
  });
});

// GET /project/download/:path - Download project file
assetRoutes.get('/project/download/:path+', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const path = params['path+'];
  const key = `${auth.studentId}/${path}`;

  const object = await env.PROJECT_STORAGE.get(key);
  if (!object) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'File not found' } },
      { status: 404 }
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
});

// GET /project/list - List project files
assetRoutes.get('/project/list', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const prefix = url.searchParams.get('prefix') || '';
  const cursor = url.searchParams.get('cursor') || undefined;

  const listed = await env.PROJECT_STORAGE.list({
    prefix: `${auth.studentId}/${prefix}`,
    cursor,
    limit: 100,
  });

  const files = listed.objects.map((obj) => ({
    path: obj.key.replace(`${auth.studentId}/`, ''),
    size: obj.size,
    uploaded: obj.uploaded.toISOString(),
    etag: obj.etag,
  }));

  return Response.json({
    success: true,
    data: {
      files,
      cursor: listed.truncated ? listed.cursor : null,
    },
  });
});

// DELETE /project/delete/:path - Delete project file
assetRoutes.delete('/project/delete/:path+', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const path = params['path+'];
  const key = `${auth.studentId}/${path}`;

  await env.PROJECT_STORAGE.delete(key);

  return Response.json({ success: true, data: { deleted: true } });
});

// GET /asset/:path - Get public game asset
assetRoutes.get('/asset/:path+', async (request, env, _ctx, params) => {
  const path = params['path+'];

  // Assets are public, no auth required
  const object = await env.ASSET_STORAGE.get(path);
  if (!object) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Asset not found' } },
      { status: 404 }
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Length', String(object.size));
  headers.set('ETag', object.etag);
  headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache

  return new Response(object.body, { headers });
});

// POST /asset/upload - Upload game asset (admin only in production)
assetRoutes.post('/asset/upload', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // In production, check for admin role
  // For now, allow any authenticated user

  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > MAX_ASSET_SIZE) {
    return Response.json(
      { success: false, error: { code: 'FILE_TOO_LARGE', message: 'Max asset size is 50MB' } },
      { status: 413 }
    );
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const path = formData.get('path') as string;

  if (!file || !path) {
    return Response.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'file and path required' } },
      { status: 400 }
    );
  }

  const safePath = sanitizePath(path);

  await env.ASSET_STORAGE.put(safePath, file.stream(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
    customMetadata: {
      uploadedBy: auth.studentId,
      uploadedAt: new Date().toISOString(),
    },
  });

  return Response.json({
    success: true,
    data: { path: safePath, size: file.size },
  });
});

// Helper: Sanitize file path
function sanitizePath(path: string): string {
  return path
    .replace(/\.\./g, '') // Prevent directory traversal
    .replace(/^\/+/, '') // Remove leading slashes
    .replace(/\/+/g, '/'); // Normalize multiple slashes
}
