/**
 * Vibe-Coding Chat Interface - Main Entry Point
 *
 * Cloudflare Worker for Cursor/Windsurf style streaming chat.
 * Provides real-time AI assistance with code context awareness.
 */

import { Router } from 'itty-router';

// Type imports
import type {
  VibeCodingEnv,
  ChatRequest,
  HealthResponse,
  ErrorResponse,
} from './types.js';

// Service imports
import { ChatService } from './chat-service.js';
import { WebSocketHandler } from './websocket-handler.js';
import { createSSEResponse } from './streaming.js';
import { createConversationMemory } from './conversation-memory.js';

// ============================================================================
// Constants
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const API_VERSION = '1.0.0';

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

/**
 * Extract user info from request
 */
function extractAuth(request: Request): { userId?: string; workspaceId?: string } {
  const url = new URL(request.url);
  const authHeader = request.headers.get('Authorization');

  let userId: string | undefined;
  let workspaceId: string | undefined;

  // Try header first
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      // In production, decode and verify JWT
      const decoded = JSON.parse(atob(token));
      userId = decoded.sub;
      workspaceId = decoded.workspace;
    } catch {
      // Invalid token, ignore
    }
  }

  // Fall back to query params
  userId = userId || url.searchParams.get('userId') || undefined;
  workspaceId = workspaceId || url.searchParams.get('workspaceId') || undefined;

  return { userId, workspaceId };
}

/**
 * Validate required auth
 */
function requireAuth(request: Request): { userId: string; workspaceId: string } {
  const auth = extractAuth(request);

  if (!auth.userId) {
    throw new Error('Unauthorized: userId required');
  }

  return {
    userId: auth.userId,
    workspaceId: auth.workspaceId || 'default',
  };
}

// ============================================================================
// Routes
// ============================================================================

// CORS preflight
router.options('*', () => new Response(null, { headers: CORS_HEADERS }));

// Health check
router.get('/', (): Response => {
  const health: HealthResponse = {
    status: 'healthy',
    service: 'vibe-coding',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
  };

  return Response.json(health, { headers: CORS_HEADERS });
});

// Chat completions (streaming)
router.post('/v1/chat/completions', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const body = await request.json() as ChatRequest;

    // Validate request
    if (!body.message) {
      const error: ErrorResponse = { error: 'Message is required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    // Set auth from request if not in body
    body.userId = body.userId || auth.userId;
    body.workspaceId = body.workspaceId || auth.workspaceId;

    const chatService = new ChatService(env);

    // Handle streaming
    if (body.stream !== false) {
      const { StreamProcessor } = await import('./streaming.js');
      const processor = new StreamProcessor();
      const stream = await chatService.chatStream(body, processor);
      return createSSEResponse(stream);
    }

    // Non-streaming response
    const response = await chatService.chat(body);
    return Response.json(response, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'CHAT_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// Session management
router.get('/v1/sessions/:sessionId', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const sessionId = request.param?.sessionId;

    if (!sessionId) {
      const error: ErrorResponse = { error: 'Session ID required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    const memory = createConversationMemory(env);
    const session = await memory.getSession(sessionId);

    if (!session || session.userId !== auth.userId) {
      const error: ErrorResponse = { error: 'Session not found', code: 'NOT_FOUND' };
      return Response.json(error, { status: 404, headers: CORS_HEADERS });
    }

    return Response.json(session, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SESSION_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// List sessions
router.get('/v1/sessions', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const workspaceId = url.searchParams.get('workspaceId') || undefined;

    const memory = createConversationMemory(env);
    const sessions = await memory.listSessions(auth.userId, workspaceId, limit);

    return Response.json({ sessions, count: sessions.length }, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SESSIONS_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// Create session
router.post('/v1/sessions', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const body = await request.json();
    const mode = body.mode || 'vibe';
    const contextFiles = body.contextFiles || [];

    const memory = createConversationMemory(env);
    const session = await memory.createSession(auth.userId, auth.workspaceId, mode, contextFiles);

    return Response.json(session, { status: 201, headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SESSION_CREATE_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// Delete session
router.delete('/v1/sessions/:sessionId', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const sessionId = request.param?.sessionId;

    if (!sessionId) {
      const error: ErrorResponse = { error: 'Session ID required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    const memory = createConversationMemory(env);
    const session = await memory.getSession(sessionId);

    if (!session || session.userId !== auth.userId) {
      const error: ErrorResponse = { error: 'Session not found', code: 'NOT_FOUND' };
      return Response.json(error, { status: 404, headers: CORS_HEADERS });
    }

    await memory.deleteSession(sessionId);

    return Response.json({ success: true }, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'SESSION_DELETE_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// Update session context
router.put('/v1/sessions/:sessionId/context', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const sessionId = request.param?.sessionId;

    if (!sessionId) {
      const error: ErrorResponse = { error: 'Session ID required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    const body = await request.json();
    const files = body.files || [];

    const memory = createConversationMemory(env);
    const session = await memory.getSession(sessionId);

    if (!session || session.userId !== auth.userId) {
      const error: ErrorResponse = { error: 'Session not found', code: 'NOT_FOUND' };
      return Response.json(error, { status: 404, headers: CORS_HEADERS });
    }

    await memory.attachContext(sessionId, files);

    return Response.json({ success: true }, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'CONTEXT_UPDATE_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// Branch management
router.post('/v1/sessions/:sessionId/branches', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const sessionId = request.param?.sessionId;

    if (!sessionId) {
      const error: ErrorResponse = { error: 'Session ID required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    const body = await request.json();
    const { fromMessageId, branchName } = body;

    if (!fromMessageId || !branchName) {
      const error: ErrorResponse = { error: 'fromMessageId and branchName required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    const memory = createConversationMemory(env);
    const session = await memory.getSession(sessionId);

    if (!session || session.userId !== auth.userId) {
      const error: ErrorResponse = { error: 'Session not found', code: 'NOT_FOUND' };
      return Response.json(error, { status: 404, headers: CORS_HEADERS });
    }

    const branch = await memory.createBranch(sessionId, fromMessageId, branchName);

    return Response.json(branch, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'BRANCH_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// Switch branch
router.put('/v1/sessions/:sessionId/branches/:branchId', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  try {
    const auth = requireAuth(request);
    const sessionId = request.param?.sessionId;
    const branchId = request.param?.branchId;

    if (!sessionId || !branchId) {
      const error: ErrorResponse = { error: 'Session ID and Branch ID required', code: 'INVALID_REQUEST' };
      return Response.json(error, { status: 400, headers: CORS_HEADERS });
    }

    const memory = createConversationMemory(env);
    const session = await memory.getSession(sessionId);

    if (!session || session.userId !== auth.userId) {
      const error: ErrorResponse = { error: 'Session not found', code: 'NOT_FOUND' };
      return Response.json(error, { status: 404, headers: CORS_HEADERS });
    }

    const updated = await memory.switchBranch(sessionId, branchId);

    return Response.json(updated, { headers: CORS_HEADERS });

  } catch (error) {
    const err: ErrorResponse = {
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'BRANCH_SWITCH_ERROR',
    };
    return Response.json(err, { status: 500, headers: CORS_HEADERS });
  }
});

// WebSocket upgrade
router.get('/ws', async (request: Request, env: VibeCodingEnv): Promise<Response> => {
  const wsHandler = new WebSocketHandler(env);
  const response = wsHandler.handleWebSocketUpgrade(request);

  if (response) {
    return response;
  }

  const error: ErrorResponse = { error: 'WebSocket upgrade failed', code: 'WS_ERROR' };
  return Response.json(error, { status: 426, headers: CORS_HEADERS });
});

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: VibeCodingEnv, ctx: ExecutionContext): Promise<Response> => {
    return router
      .handle(request, env, ctx)
      .catch((error): Response => {
        const err: ErrorResponse = {
          error: error instanceof Error ? error.message : 'Internal server error',
          code: 'INTERNAL_ERROR',
          requestId: crypto.randomUUID(),
        };
        return Response.json(err, {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      });
  },
};
