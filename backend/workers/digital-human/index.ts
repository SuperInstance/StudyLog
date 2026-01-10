/**
 * Digital Human Worker for StudyLoG.AI
 *
 * Cloudflare Worker that provides HTTP/WebSocket API for NVIDIA Digital Human
 * services including ACE, Maxine, and Audio2Face.
 *
 * Deploy: wrangler publish
 */

import { Router } from 'itty-router';
import { ACEClient, ACEAgentConfig, ACEInteraction, ACEEmotion } from './ace';
import { MaxineClient } from './maxine';
import { Audio2FaceBridge, createDefaultConfig } from './audio2face';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // NVIDIA API Key
  NVIDIA_API_KEY?: string;

  // D1 Database for session persistence
  DIGITAL_TUTOR_SESSIONS?: D1Database;

  // KV Namespaces for caching
  DIGITAL_HUMAN_CACHE?: KVNamespace;

  // R2 Storage for generated assets
  ASSET_STORAGE?: R2Bucket;

  // Optional custom API endpoints
  ACE_API_URL?: string;
  MAXINE_API_URL?: string;
  AUDIO2FACE_WS_URL?: string;

  // Environment
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

interface AgentRegisterRequest {
  agentId: string;
  personality: 'tutor' | 'captain' | 'teacher' | 'builder';
  voiceModel?: string;
  avatarModel?: string;
  capabilities?: string[];
  systemPrompt?: string;
}

interface InteractionRequest {
  agentId: string;
  input?: string;
  emotion?: string;
  sessionId?: string;
  userId?: string;
  enableAnimation?: boolean;
  enableAudio?: boolean;
}

interface PortraitAnimationRequest {
  portraitImage: string;
  drivingAudio: string;
  style?: string;
  emotion?: string;
}

interface AudioEnhancementRequest {
  audioData: string; // base64
  preset?: string;
  noiseReduction?: number;
}

// ============================================================================
// Response Types
// ============================================================================

interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: number;
    processingTimeMs: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const CACHE_TTL_SECONDS = 300; // 5 minutes

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// ============================================================================
// CORS & Middleware
// ============================================================================

router.options('*', () => new Response(null, { headers: CORS_HEADERS }));

function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, details?: unknown, status = 400): Response {
  return json({
    success: false,
    error: { code, message, details },
  }, status);
}

function successResponse<T>(data: T, processingTimeMs = 0): Response {
  return json({
    success: true,
    data,
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: Date.now(),
      processingTimeMs,
    },
  });
}

// ============================================================================
// Health Check
// ============================================================================

router.get('/', () => {
  return json({
    status: 'healthy',
    service: 'digital-human-worker',
    version: '1.0.0',
    capabilities: {
      ace: true,
      maxine: true,
      audio2face: true,
    },
    timestamp: Date.now(),
  });
});

// ============================================================================
// ACE Agent Routes
// ============================================================================

/**
 * POST /agents - Register a new agent
 */
router.post('/agents', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as AgentRegisterRequest;

  if (!body.agentId || !body.personality) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: agentId, personality');
  }

  try {
    const ace = new ACEClient({
      apiKey: env.NVIDIA_API_KEY || '',
      baseUrl: env.ACE_API_URL,
    });

    const config: ACEAgentConfig = {
      agentId: body.agentId,
      personality: body.personality,
      voiceModel: (body.voiceModel as any) || 'us-female-1',
      avatarModel: (body.avatarModel as any) || 'studylog-tutor-1',
      capabilities: (body.capabilities as any) || ['facial-animation', 'lip-sync', 'natural-language'],
      systemPrompt: body.systemPrompt,
    };

    ace.registerAgent(config);

    // Store in database if available
    if (env.DIGITAL_TUTOR_SESSIONS) {
      await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        INSERT OR REPLACE INTO agent_configs (agent_id, config, updated_at)
        VALUES (?, ?, ?)
      `).bind(body.agentId, JSON.stringify(config), Date.now()).run();
    }

    return successResponse({
      agentId: body.agentId,
      personality: body.personality,
      registered: true,
    }, Date.now() - startTime);

  } catch (error) {
    return errorResponse('AGENT_REGISTER_ERROR',
      `Failed to register agent: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * GET /agents - List all registered agents
 */
router.get('/agents', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();

  try {
    const agents: ACEAgentConfig[] = [];

    // Check cache first
    const cacheKey = 'digital_human:agents';
    if (env.DIGITAL_HUMAN_CACHE) {
      const cached = await env.DIGITAL_HUMAN_CACHE.get(cacheKey, 'json');
      if (cached) {
        return successResponse(cached, Date.now() - startTime);
      }
    }

    // Query from database if available
    if (env.DIGITAL_TUTOR_SESSIONS) {
      const results = await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        SELECT agent_id, config FROM agent_configs
      `).all<{ agent_id: string; config: string }>();

      for (const row of results.results) {
        agents.push(JSON.parse(row.config) as ACEAgentConfig);
      }
    }

    // Cache the result
    if (env.DIGITAL_HUMAN_CACHE && agents.length > 0) {
      await env.DIGITAL_HUMAN_CACHE.put(cacheKey, JSON.stringify(agents), {
        expirationTtl: CACHE_TTL_SECONDS,
      });
    }

    return successResponse(agents, Date.now() - startTime);

  } catch (error) {
    return errorResponse('AGENTS_LIST_ERROR',
      `Failed to list agents: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * DELETE /agents/:id - Unregister an agent
 */
router.delete('/agents/:id', async (req) => {
  const env = req.env as Env;
  const agentId = req.params?.id as string;

  if (!agentId) {
    return errorResponse('INVALID_INPUT', 'Agent ID is required');
  }

  try {
    if (env.DIGITAL_TUTOR_SESSIONS) {
      await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        DELETE FROM agent_configs WHERE agent_id = ?
      `).bind(agentId).run();
    }

    // Clear cache
    if (env.DIGITAL_HUMAN_CACHE) {
      await env.DIGITAL_HUMAN_CACHE.delete('digital_human:agents');
    }

    return successResponse({ agentId, deleted: true });

  } catch (error) {
    return errorResponse('AGENT_DELETE_ERROR',
      `Failed to delete agent: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Interaction Routes
// ============================================================================

/**
 * POST /interact - Send message to agent and get response
 */
router.post('/interact', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as InteractionRequest;

  if (!body.agentId) {
    return errorResponse('INVALID_INPUT', 'Missing required field: agentId');
  }

  if (!body.input && !body.sessionId) {
    return errorResponse('INVALID_INPUT', 'Either input or sessionId is required');
  }

  try {
    const ace = new ACEClient({
      apiKey: env.NVIDIA_API_KEY || '',
      baseUrl: env.ACE_API_URL,
    });

    const response: ACEInteraction = await ace.interact({
      agentId: body.agentId,
      input: body.input,
      emotion: body.emotion as ACEEmotion,
      sessionId: body.sessionId,
      userId: body.userId,
      enableAnimation: body.enableAnimation ?? true,
      enableAudio: body.enableAudio ?? true,
    });

    // Store interaction in database if session exists
    if (body.sessionId && env.DIGITAL_TUTOR_SESSIONS) {
      await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        UPDATE digital_tutor_sessions
        SET messages = json_array(messages, json_object(
          'role', 'assistant',
          'content', ?,
          'timestamp', ?,
          'emotion', ?
        )),
        last_activity = ?
        WHERE id = ?
      `).bind(
        response.text,
        Date.now(),
        response.emotion || 'neutral',
        Date.now(),
        body.sessionId
      ).run();
    }

    return successResponse(response, Date.now() - startTime);

  } catch (error) {
    return errorResponse('INTERACTION_ERROR',
      `Interaction failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * POST /sessions - Create a new session
 */
router.post('/sessions', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as { agentId: string; userId: string };

  if (!body.agentId || !body.userId) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: agentId, userId');
  }

  try {
    const ace = new ACEClient({
      apiKey: env.NVIDIA_API_KEY || '',
      baseUrl: env.ACE_API_URL,
    });

    const sessionId = ace.createSession(body.agentId, body.userId);

    // Store session in database
    if (env.DIGITAL_TUTOR_SESSIONS) {
      const agentInfo = await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        SELECT config FROM agent_configs WHERE agent_id = ?
      `).bind(body.agentId).first<{ config: string }>();

      const personality = agentInfo
        ? (JSON.parse(agentInfo.config) as ACEAgentConfig).personality
        : 'tutor';

      await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        INSERT INTO digital_tutor_sessions (id, user_id, agent_id, personality, started_at, last_activity, messages)
        VALUES (?, ?, ?, ?, ?, ?, '[]')
      `).bind(
        sessionId,
        body.userId,
        body.agentId,
        personality,
        Date.now(),
        Date.now()
      ).run();
    }

    return successResponse({
      sessionId,
      agentId: body.agentId,
      userId: body.userId,
      createdAt: Date.now(),
    }, Date.now() - startTime);

  } catch (error) {
    return errorResponse('SESSION_CREATE_ERROR',
      `Failed to create session: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * GET /sessions/:userId - List user's sessions
 */
router.get('/sessions/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.params?.userId as string;

  if (!userId) {
    return errorResponse('INVALID_INPUT', 'User ID is required');
  }

  try {
    const sessions = [];

    if (env.DIGITAL_TUTOR_SESSIONS) {
      const results = await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        SELECT id, agent_id, personality, started_at, last_activity
        FROM digital_tutor_sessions
        WHERE user_id = ?
        ORDER BY last_activity DESC
        LIMIT 50
      `).bind(userId).all<{
        id: string;
        agent_id: string;
        personality: string;
        started_at: number;
        last_activity: number;
      }>();

      for (const row of results.results) {
        sessions.push({
          sessionId: row.id,
          agentId: row.agent_id,
          personality: row.personality,
          startedAt: row.started_at,
          lastActivity: row.last_activity,
        });
      }
    }

    return successResponse({ sessions });

  } catch (error) {
    return errorResponse('SESSIONS_LIST_ERROR',
      `Failed to list sessions: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * DELETE /sessions/:id - End a session
 */
router.delete('/sessions/:id', async (req) => {
  const env = req.env as Env;
  const sessionId = req.params?.id as string;

  if (!sessionId) {
    return errorResponse('INVALID_INPUT', 'Session ID is required');
  }

  try {
    if (env.DIGITAL_TUTOR_SESSIONS) {
      await env.DIGITAL_TUTOR_SESSIONS.prepare(`
        UPDATE digital_tutor_sessions
        SET ended_at = ?
        WHERE id = ?
      `).bind(Date.now(), sessionId).run();
    }

    return successResponse({ sessionId, ended: true });

  } catch (error) {
    return errorResponse('SESSION_END_ERROR',
      `Failed to end session: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Maxine Routes
// ============================================================================

/**
 * POST /maxine/portrait - Generate live portrait animation
 */
router.post('/maxine/portrait', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as PortraitAnimationRequest;

  if (!body.portraitImage || !body.drivingAudio) {
    return errorResponse('INVALID_INPUT',
      'Missing required fields: portraitImage, drivingAudio');
  }

  try {
    const maxine = new MaxineClient({
      apiKey: env.NVIDIA_API_KEY || '',
      baseUrl: env.MAXINE_API_URL,
    });

    const result = await maxine.animatePortrait({
      portraitImage: body.portraitImage,
      drivingAudio: body.drivingAudio,
      config: {
        style: (body.style as any) || 'realistic',
      },
      emotion: body.emotion,
    });

    return successResponse(result, Date.now() - startTime);

  } catch (error) {
    return errorResponse('PORTRAIT_ERROR',
      `Portrait animation failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * POST /maxine/audio - Enhance audio quality
 */
router.post('/maxine/audio', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as AudioEnhancementRequest;

  if (!body.audioData) {
    return errorResponse('INVALID_INPUT', 'Missing required field: audioData');
  }

  try {
    // Convert base64 to ArrayBuffer
    const audioBuffer = Uint8Array.from(atob(body.audioData), c => c.charCodeAt(0));

    const maxine = new MaxineClient({
      apiKey: env.NVIDIA_API_KEY || '',
      baseUrl: env.MAXINE_API_URL,
    });

    const result = await maxine.enhanceAudio({
      audioBuffer,
      config: {
        preset: (body.preset as any) || 'voice-only',
        noiseReduction: body.noiseReduction,
      },
    });

    // Convert back to base64 for JSON response
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(result.audioBuffer)));

    return successResponse({
      ...result,
      audioData: base64Audio,
    }, Date.now() - startTime);

  } catch (error) {
    return errorResponse('AUDIO_ENHANCEMENT_ERROR',
      `Audio enhancement failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Audio2Face Routes
// ============================================================================

/**
 * GET /audio2face/config - Get WebSocket configuration
 */
router.get('/audio2face/config', (req) => {
  const env = req.env as Env;

  return successResponse({
    wsUrl: env.AUDIO2FACE_WS_URL || 'wss://audio2face.nvidia.com/ws',
    targetFps: 30,
    sampleRate: 24000,
    channels: 1,
  });
});

// ============================================================================
// WebSocket Upgrade Handler (for Audio2Face)
// ============================================================================

/**
 * Note: Cloudflare Workers support for WebSockets is available.
 * This would be handled in a separate worker or via the
 * Cloudflare Workers WebSocket API.
 */

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router
      .handle(request, env, ctx)
      .catch((err) => {
        console.error('[Digital Human Worker] Error:', err);
        return errorResponse('INTERNAL_ERROR',
          err.message || 'An unexpected error occurred',
          err,
          500
        );
      });
  },
};
