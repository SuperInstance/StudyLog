/**
 * StudyLoG.AI Backend - Middleware
 */

import type { Env } from './types';

// CORS headers for cross-origin requests
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '*';

  // In production, restrict to known origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8787',
    'https://studylog.ai',
    'https://*.studylog.ai',
  ];

  const isAllowed =
    origin === '*' ||
    allowedOrigins.some((allowed) => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Rate limiting using KV
export async function rateLimiter(
  request: Request,
  env: Env
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `rate:${ip}`;

  const limit = parseInt(env.RATE_LIMIT_REQUESTS) || 100;
  const window = parseInt(env.RATE_LIMIT_WINDOW) || 60;

  try {
    const current = await env.RATE_LIMITS.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: `Too many requests. Limit: ${limit} per ${window}s`,
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(window),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + window),
          },
        }
      );
    }

    // Increment counter
    await env.RATE_LIMITS.put(key, String(count + 1), {
      expirationTtl: window,
    });

    return null; // Continue processing
  } catch {
    // If KV fails, allow the request
    console.error('Rate limiter KV error');
    return null;
  }
}

// Error handler
export function errorHandler(error: unknown, request: Request): Response {
  console.error('Unhandled error:', error);

  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();

  if (error instanceof Response) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  const stack = error instanceof Error ? error.stack : undefined;

  return Response.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack }),
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 500 }
  );
}

// Request logging
export function logRequest(
  request: Request,
  response: Response,
  startTime: number
): void {
  const duration = Date.now() - startTime;
  const url = new URL(request.url);

  console.log(
    JSON.stringify({
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration,
      ip: request.headers.get('CF-Connecting-IP'),
      userAgent: request.headers.get('User-Agent'),
    })
  );
}

// JWT verification (placeholder - implement with proper library)
export async function verifyAuth(
  request: Request,
  env: Env
): Promise<{ studentId: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    // TODO: Implement proper JWT verification
    // For now, check session cache
    const session = await env.SESSION_CACHE.get(`session:${token}`);
    if (!session) {
      return null;
    }

    return JSON.parse(session);
  } catch {
    return null;
  }
}

// Require authentication middleware
export async function requireAuth(
  request: Request,
  env: Env
): Promise<Response | { studentId: string }> {
  const auth = await verifyAuth(request, env);

  if (!auth) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      },
      { status: 401 }
    );
  }

  return auth;
}
