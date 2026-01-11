/**
 * DMLoG.AI - API Handlers
 *
 * HTTP API endpoints for the agent orchestration system.
 * Integrates with the main StudyLoG.AI backend.
 *
 * @module api/handlers
 */

import type {
  Env,
} from '../../../types.js';
import type {
  ApiResponse,
  AgentDecisionRequest,
  AgentDecision,
  CoordinateAgentsRequest,
  CoordinateAgentsResponse,
  GetAgentStateRequest,
  GetAgentStateResponse,
  AgentUpdateMessage,
} from '../types/index.js';
import {
  AgentErrorCode,
  AgentError,
} from '../types/index.js';
import { AgentOrchestrator, getSessionOrchestrator } from '../core/orchestrator.js';
import { getAgentRegistry } from '../core/agent-registry.js';
import { getCommunicationBus } from '../core/communication-bus.js';
import { createCombatAgent } from '../agents/combat-agent.js';
import { createSocialAgent } from '../agents/social-agent.js';
import { createExplorationAgent } from '../agents/exploration-agent.js';

/**
 * Parse JSON body from request
 */
async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch (error) {
    throw new AgentError(
      AgentErrorCode.INVALID_CONTEXT,
      'Invalid JSON body'
    );
  }
}

/**
 * Create API response
 */
function createApiResponse<T>(
  data?: T,
  error?: { code: string; message: string; details?: unknown },
  latencyMs?: number
): Response {
  const body: ApiResponse<T> = {
    success: !error,
    data,
    error,
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      latencyMs: latencyMs ?? 0,
    },
  };

  return Response.json(body, {
    status: error ? 400 : 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle CORS preflight
 */
function handleCors(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// ============================================================================
// Orchestrator cache per session
// ============================================================================

const orchestratorCache = new Map<string, AgentOrchestrator>();

/**
 * Get or create orchestrator for session
 */
function getOrchestratorForSession(sessionId: string): AgentOrchestrator {
  if (!orchestratorCache.has(sessionId)) {
    orchestratorCache.set(sessionId, getSessionOrchestrator(sessionId));
  }
  return orchestratorCache.get(sessionId)!;
}

// ============================================================================
// API Handlers
// ============================================================================

/**
 * POST /agents/decision
 *
 * Get a decision from an agent
 */
export async function handleAgentDecision(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<AgentDecisionRequest>(request);

    // Validate required fields
    if (!body.agentId) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        'agentId is required'
      );
    }

    // Get registry and check if agent exists
    const registry = getAgentRegistry();
    if (!registry.has(body.agentId)) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent ${body.agentId} not found`
      );
    }

    // Get orchestrator
    const orchestrator = getOrchestratorForSession(body.sessionId ?? 'default');

    // Build decision context
    const context = {
      agentId: body.agentId,
      role: registry.getConfig(body.agentId)?.role ?? 'dungeon_master' as any,
      situation: body.situation,
      situationType: body.situationType,
      stakes: body.stakes ?? 0.5,
      urgencyMs: body.urgencyMs,
      location: body.location ?? '',
      participants: body.participants ?? [],
      availableResources: body.availableResources ?? {},
      sessionId: body.sessionId ?? 'default',
      metadata: body.metadata ?? {},
    };

    // Get decision
    const decision = await orchestrator.decide(context);

    return createApiResponse(
      { decision },
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof AgentError ? error.details : undefined,
      },
      Date.now() - startTime
    );
  }
}

/**
 * POST /agents/coordinate
 *
 * Coordinate multiple agents for a complex scenario
 */
export async function handleCoordinateAgents(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<CoordinateAgentsRequest>(request);

    // Validate required fields
    if (!body.sessionId) {
      throw new AgentError(
        AgentErrorCode.SESSION_NOT_FOUND,
        'sessionId is required'
      );
    }
    if (!body.objective) {
      throw new AgentError(
        AgentErrorCode.INVALID_CONTEXT,
        'objective is required'
      );
    }

    // Get orchestrator
    const orchestrator = getOrchestratorForSession(body.sessionId);

    // Coordinate agents
    const result = await orchestrator.coordinate(body);

    return createApiResponse(
      result,
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      Date.now() - startTime
    );
  }
}

/**
 * GET /agents/state?agentId={id}
 *
 * Get current state of an agent
 */
export async function handleGetAgentState(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');

    if (!agentId) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        'agentId parameter is required'
      );
    }

    const registry = getAgentRegistry();
    const agent = registry.get(agentId);

    if (!agent) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent ${agentId} not found`
      );
    }

    const config = registry.getConfig(agentId);
    const state = registry.getState(agentId);
    const stats = registry.getStats();

    const response: GetAgentStateResponse = {
      agent: {
        id: agentId,
        name: config?.name ?? 'Unknown',
        role: config?.role ?? 'dungeon_master' as any,
        biologicalType: config?.biologicalType ?? 'whale' as any,
        state: state ?? 'idle' as any,
      },
      stats: {
        agentId,
        role: config?.role ?? 'dungeon_master' as any,
        totalDecisions: 0,
        decisionsBySource: {
          bot: 0,
          brain: 0,
          human: 0,
          override: 0,
        },
        avgConfidence: 0.7,
        avgTimeMs: 50,
        totalCost: 0,
        successRate: 0.8,
        escalationRate: 0.2,
        memoryStats: {
          totalMemories: 0,
          byType: {},
          avgImportance: 5,
        },
      },
      personality: config?.personality,
    };

    return createApiResponse(
      response,
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      Date.now() - startTime
    );
  }
}

/**
 * GET /agents/list?sessionId={id}
 *
 * List all agents for a session
 */
export async function handleListAgents(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId') ?? 'default';

    const registry = getAgentRegistry();
    const agentIds = registry.getSessionAgents(sessionId);

    const agents = agentIds.map(agentId => {
      const config = registry.getConfig(agentId);
      const state = registry.getState(agentId);
      return {
        id: agentId,
        name: config?.name ?? 'Unknown',
        role: config?.role,
        biologicalType: config?.biologicalType,
        state,
      };
    });

    return createApiResponse(
      { agents, count: agents.length },
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      Date.now() - startTime
    );
  }
}

/**
 * POST /agents/create
 *
 * Create a new agent
 */
export async function handleCreateAgent(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const body = await parseJsonBody<{
      name: string;
      role: string;
      biologicalType?: string;
      sessionId?: string;
      personality?: Record<string, number>;
      combatStyle?: string;
      socialStyle?: string;
      explorationStyle?: string;
    }>(request);

    // Validate required fields
    if (!body.name || !body.role) {
      throw new AgentError(
        AgentErrorCode.INVALID_CONTEXT,
        'name and role are required'
      );
    }

    const sessionId = body.sessionId ?? 'default';
    const agentId = `agent_${sessionId}_${Date.now()}`;

    const config = {
      id: agentId,
      name: body.name,
      role: body.role as any,
      biologicalType: body.biologicalType as any ?? 'captain',
      sessionId,
      personality: body.personality,
    };

    // Create agent based on role
    let agent;
    switch (body.role) {
      case 'combat':
        agent = createCombatAgent({
          ...config,
          combatStyle: body.combatStyle as any,
        });
        break;
      case 'social':
        agent = createSocialAgent({
          ...config,
          socialStyle: body.socialStyle as any,
        });
        break;
      case 'exploration':
        agent = createExplorationAgent({
          ...config,
          explorationStyle: body.explorationStyle as any,
        });
        break;
      default:
        throw new AgentError(
          AgentErrorCode.INVALID_ROLE,
          `Unknown role: ${body.role}`
        );
    }

    return createApiResponse(
      {
        agentId,
        name: body.name,
        role: body.role,
        sessionId,
      },
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      Date.now() - startTime
    );
  }
}

/**
 * DELETE /agents/{agentId}
 *
 * Remove an agent
 */
export async function handleDeleteAgent(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const agentId = pathParts[pathParts.length - 1];

    if (!agentId) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        'agentId is required'
      );
    }

    const registry = getAgentRegistry();
    const unregistered = registry.unregister(agentId);

    if (!unregistered) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent ${agentId} not found`
      );
    }

    return createApiResponse(
      { agentId, deleted: true },
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      Date.now() - startTime
    );
  }
}

/**
 * GET /agents/stats
 *
 * Get system statistics
 */
export async function handleGetStats(
  request: Request,
  env: Env
): Promise<Response> {
  const startTime = Date.now();

  try {
    const registry = getAgentRegistry();
    const bus = getCommunicationBus();

    const registryStats = registry.getStats();
    const busStats = bus.getStats();

    return createApiResponse(
      {
        registry: registryStats,
        communication: busStats,
        orchestrators: orchestratorCache.size,
      },
      undefined,
      Date.now() - startTime
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: error instanceof AgentError ? error.code : 'UNKNOWN_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      Date.now() - startTime
    );
  }
}

/**
 * WebSocket upgrade handler for real-time agent updates
 */
export async function handleWebSocketUpgrade(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('sessionId') ?? 'default';

  // Note: Cloudflare Workers has specific WebSocket handling
  // This is a placeholder for the WebSocket upgrade
  return new Response('WebSocket upgrade not implemented in this version', {
    status: 501,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Main request router for agent API
 */
export async function handleAgentRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCors();
  }

  // Route the request
  try {
    switch (request.method) {
      case 'POST':
        if (url.pathname.endsWith('/decision')) {
          return handleAgentDecision(request, env);
        } else if (url.pathname.endsWith('/coordinate')) {
          return handleCoordinateAgents(request, env);
        } else if (url.pathname.endsWith('/create')) {
          return handleCreateAgent(request, env);
        }
        break;

      case 'GET':
        if (url.pathname.endsWith('/state')) {
          return handleGetAgentState(request, env);
        } else if (url.pathname.endsWith('/list')) {
          return handleListAgents(request, env);
        } else if (url.pathname.endsWith('/stats')) {
          return handleGetStats(request, env);
        } else if (url.pathname.endsWith('/ws')) {
          return handleWebSocketUpgrade(request, env);
        }
        break;

      case 'DELETE':
        if (url.pathname.match(/\/agents\/[^/]+$/)) {
          return handleDeleteAgent(request, env);
        }
        break;
    }

    // Route not found
    return createApiResponse(
      undefined,
      {
        code: 'NOT_FOUND',
        message: `Route not found: ${request.method} ${url.pathname}`,
      },
      0
    );
  } catch (error) {
    return createApiResponse(
      undefined,
      {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      0
    );
  }
}
