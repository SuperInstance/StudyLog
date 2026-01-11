/**
 * Being State System - Main Entry Point
 *
 * Cloudflare Worker that provides HTTP API for the Being State System.
 * Manages multi-layered being states for Godot simulations with:
 * - Visual state (generative AI transformations)
 * - Audio state (procedural audio)
 * - Gameplay state (vibe-coded rules)
 * - Agent state (ACE-powered intelligence)
 *
 * Deploy: wrangler publish
 */

import { Router } from 'itty-router';

// Import all modules
import {
  createStateManager,
  BeingStateManager,
} from './being-state';
import {
  createVisualStateManager,
  VisualStateManager,
} from './visual-state';
import {
  createAudioStateManager,
  AudioStateManager,
} from './audio-state';
import {
  createGameplayStateManager,
  GameplayStateManager,
} from './gameplay-state';
import {
  createAgentStateManager,
  AgentStateManager,
} from './agent-state';
import {
  createCrewOrchestrator,
  CrewOrchestrator,
} from './crew-orchestrator';
import {
  createRAGInjector,
  RAGInjector,
} from './rag-injector';
import {
  createActionExecutor,
  ActionExecutor,
} from './action-executor';
import {
  createFeedbackLoopManager,
  FeedbackLoopManager,
} from './feedback-loop';

// Import types
import type {
  BeingStateEnv,
  StateTransitionRequest,
  StateTransitionResponse,
  VisualState,
  AudioState,
  GameplayState,
  AgentState,
  APIResponse,
  CrewConfig,
  CrewCoordination,
  RAGContext,
  GodotCommand,
} from './types';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env extends BeingStateEnv {}

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Helper Functions
// ============================================================================

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
// Middleware
// ============================================================================

router.options('*', () => new Response(null, { headers: CORS_HEADERS }));

// ============================================================================
// Health Check
// ============================================================================

router.get('/', () => {
  return json({
    status: 'healthy',
    service: 'being-state-system',
    version: '1.0.0',
    capabilities: {
      visual: true,
      audio: true,
      gameplay: true,
      agent: true,
      crew: true,
      rag: true,
      feedback: true,
    },
    timestamp: Date.now(),
  });
});

// ============================================================================
// State Transition Endpoints
// ============================================================================

/**
 * POST /state/transition - Transition being state
 */
router.post('/state/transition', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as StateTransitionRequest;

  if (!body.sessionId) {
    return errorResponse('INVALID_INPUT', 'Missing required field: sessionId');
  }

  try {
    const stateManager = createStateManager(env);
    const visualManager = createVisualStateManager(env);
    const audioManager = createAudioStateManager(env);
    const gameplayManager = createGameplayStateManager(env);
    const agentManager = createAgentStateManager(env);

    // Perform state transition
    const transition = await stateManager.transition(body);

    // Generate effects for each layer
    if (body.visual || transition.changes.visual.from !== transition.changes.visual.to) {
      const visualTransform = await visualManager.generateTransformation(
        transition.state.visual,
        transition.state.intensity,
        'entity'
      );
      transition.effects.visualEffects = await visualManager.generateTransitionEffects(
        transition.changes.visual.from || 'ethereal',
        transition.changes.visual.to,
        transition.state.intensity,
        'entity'
      );
    }

    if (body.audio || transition.changes.audio.from !== transition.changes.audio.to) {
      const audioConfig = await audioManager.generateConfig(
        transition.state.audio,
        transition.state.intensity
      );
      transition.effects.audioModifications = await audioManager.generateTransitionModifications(
        transition.changes.audio.from || 'serene',
        transition.changes.audio.to,
        transition.state.intensity
      );
    }

    if (body.gameplay || transition.changes.gameplay.from !== transition.changes.gameplay.to) {
      const gameplayConfig = await gameplayManager.generateConfig(
        transition.state.gameplay,
        transition.state.intensity
      );
      transition.effects.gameplayMutations = gameplayConfig.mutations;
    }

    if (body.agent || transition.changes.agent.from !== transition.changes.agent.to) {
      const agentUpdate = await agentManager.generateUpdate(
        'session_agent',
        transition.state.agent
      );
      transition.effects.agentUpdates.push(agentUpdate);
    }

    // Generate Godot commands
    transition.effects.godotCommands = [
      ...transition.effects.visualEffects.map((e) => ({
        type: 'visual_effect',
        params: e,
      } as GodotCommand)),
      ...transition.effects.audioModifications.map((e) => ({
        type: 'audio_modification',
        params: e,
      } as GodotCommand)),
      ...transition.effects.gameplayMutations.map((e) => ({
        type: 'gameplay_mutation',
        params: e,
      } as GodotCommand)),
      ...transition.effects.agentUpdates.map((e) => ({
        type: 'agent_update',
        params: e,
      } as GodotCommand)),
    ];

    return successResponse(transition, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'TRANSITION_ERROR',
      `State transition failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * GET /state/current - Get current state for session
 */
router.get('/state/current', async (req) => {
  const env = req.env as Env;
  const sessionId = req.query?.session as string;

  if (!sessionId) {
    return errorResponse('INVALID_INPUT', 'Missing query parameter: session');
  }

  try {
    const stateManager = createStateManager(env);
    const state = await stateManager.getState(sessionId);

    if (!state) {
      return errorResponse('NOT_FOUND', `No state found for session: ${sessionId}`, undefined, 404);
    }

    return successResponse(state);

  } catch (error) {
    return errorResponse(
      'STATE_ERROR',
      `Failed to get state: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * GET /state/history - Get state transition history
 */
router.get('/state/history', async (req) => {
  const env = req.env as Env;
  const sessionId = req.query?.session as string;
  const limit = parseInt(req.query?.limit as string) || 50;

  if (!sessionId) {
    return errorResponse('INVALID_INPUT', 'Missing query parameter: session');
  }

  try {
    const stateManager = createStateManager(env);
    const history = await stateManager.getHistory(sessionId, limit);

    return successResponse({ sessionId, history });

  } catch (error) {
    return errorResponse(
      'HISTORY_ERROR',
      `Failed to get history: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Visual State Endpoints
// ============================================================================

/**
 * POST /state/visual - Trigger visual transformation
 */
router.post('/state/visual', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    sessionId: string;
    state: VisualState;
    intensity?: number;
    target?: string;
  };

  if (!body.sessionId || !body.state) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: sessionId, state');
  }

  try {
    const visualManager = createVisualStateManager(env);
    const transformation = await visualManager.generateTransformation(
      body.state,
      body.intensity ?? 0.5,
      body.target
    );

    return successResponse(transformation, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'VISUAL_ERROR',
      `Visual transformation failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Audio State Endpoints
// ============================================================================

/**
 * POST /state/audio - Trigger audio transformation
 */
router.post('/state/audio', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    sessionId: string;
    state: AudioState;
    intensity?: number;
  };

  if (!body.sessionId || !body.state) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: sessionId, state');
  }

  try {
    const audioManager = createAudioStateManager(env);
    const config = await audioManager.generateConfig(
      body.state,
      body.intensity ?? 0.5
    );

    return successResponse(config, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'AUDIO_ERROR',
      `Audio transformation failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Gameplay State Endpoints
// ============================================================================

/**
 * POST /state/gameplay - Trigger gameplay mutation
 */
router.post('/state/gameplay', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    sessionId: string;
    state: GameplayState;
    intensity?: number;
    vibePrompt?: string;
  };

  if (!body.sessionId || !body.state) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: sessionId, state');
  }

  try {
    const gameplayManager = createGameplayStateManager(env);
    const config = await gameplayManager.generateConfig(
      body.state,
      body.intensity ?? 0.5
    );

    return successResponse(config, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'GAMEPLAY_ERROR',
      `Gameplay mutation failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Agent State Endpoints
// ============================================================================

/**
 * POST /agent/empower - Grant autonomy to unit
 */
router.post('/agent/empower', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    agentId: string;
    state: AgentState;
    context?: RAGContext;
  };

  if (!body.agentId || !body.state) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: agentId, state');
  }

  try {
    const agentManager = createAgentStateManager(env);
    const update = await agentManager.generateUpdate(
      body.agentId,
      body.state,
      body.context
    );

    // Store agent state
    agentManager.setAgentState(body.agentId, body.state);

    return successResponse(update, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'AGENT_ERROR',
      `Agent empowerment failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * POST /agent/chatter - Generate agent chatter
 */
router.post('/agent/chatter', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    agentId: string;
    state: AgentState;
    situation: 'combat' | 'resource' | 'idle';
    context?: RAGContext;
  };

  if (!body.agentId || !body.state) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: agentId, state');
  }

  try {
    const agentManager = createAgentStateManager(env);
    const chatter = await agentManager.generateChatter(
      body.agentId,
      body.state,
      body.situation,
      body.context
    );

    return successResponse({ agentId: body.agentId, chatter }, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'CHATTER_ERROR',
      `Chatter generation failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Crew Endpoints
// ============================================================================

/**
 * POST /crew/create - Create agent crew
 */
router.post('/crew/create', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    name: string;
    coordination: CrewCoordination;
    agents: Array<{
      id: string;
      role: 'scout' | 'tank' | 'damage' | 'support' | 'commander' | 'builder' | 'researcher' | 'diplomat';
    }>;
  };

  if (!body.name || !body.agents) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: name, agents');
  }

  try {
    const orchestrator = createCrewOrchestrator(env);
    const crew = await orchestrator.createCrew(body.name, body.coordination, body.agents);

    return successResponse(crew, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'CREW_ERROR',
      `Crew creation failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * GET /crew/:id - Get crew configuration
 */
router.get('/crew/:id', async (req) => {
  const env = req.env as Env;
  const crewId = req.params?.id as string;

  if (!crewId) {
    return errorResponse('INVALID_INPUT', 'Missing crew ID');
  }

  try {
    const orchestrator = createCrewOrchestrator(env);
    const crew = orchestrator.getCrew(crewId);

    if (!crew) {
      return errorResponse('NOT_FOUND', `Crew not found: ${crewId}`, undefined, 404);
    }

    return successResponse(crew);

  } catch (error) {
    return errorResponse(
      'CREW_ERROR',
      `Failed to get crew: ${(error as Error).message}`,
      error,
      500
    );
  }
});

/**
 * POST /crew/:id/coordinate - Execute crew coordination
 */
router.post('/crew/:id/coordinate', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const crewId = req.params?.id as string;
  const body = (await req.json()) as {
    context: RAGContext;
  };

  if (!crewId) {
    return errorResponse('INVALID_INPUT', 'Missing crew ID');
  }

  try {
    const orchestrator = createCrewOrchestrator(env);
    const decisions = await orchestrator.coordinateCrew(crewId, body.context);

    return successResponse({ crewId, decisions }, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'COORDINATION_ERROR',
      `Crew coordination failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// RAG Endpoints
// ============================================================================

/**
 * POST /rag/inject - Create RAG injection for agent
 */
router.post('/rag/inject', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    sessionId: string;
    agentId?: string;
    gameState: Partial<{
      units: Array<{
        id: string;
        type: string;
        owner: string;
        position: [number, number, number];
        health: number;
        maxHealth: number;
      }>;
      resources: Array<{
        type: string;
        amount: number;
        position: [number, number, number];
      }>;
      objectives: Array<{
        id: string;
        type: string;
        status: string;
        progress?: number;
      }>;
      gameTime: number;
    }>;
    maxEvents?: number;
  };

  if (!body.sessionId) {
    return errorResponse('INVALID_INPUT', 'Missing required field: sessionId');
  }

  try {
    const ragInjector = createRAGInjector(env);
    const injection = await ragInjector.createInjection(
      body.sessionId,
      body.agentId,
      body.gameState,
      body.maxEvents
    );

    return successResponse(injection, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'RAG_ERROR',
      `RAG injection failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Feedback Endpoints
// ============================================================================

/**
 * POST /feedback/submit - Submit environment feedback
 */
router.post('/feedback/submit', async (req) => {
  const env = req.env as Env;
  const startTime = Date.now();
  const body = (await req.json()) as {
    sessionId: string;
    agentId?: string;
    actionId: string;
    outcome: 'success' | 'failure' | 'partial';
    metrics: Record<string, number>;
    observations: string[];
    surprises?: Array<{
      type: string;
      description: string;
      severity: number;
      impact: string;
    }>;
  };

  if (!body.sessionId || !body.actionId) {
    return errorResponse('INVALID_INPUT', 'Missing required fields: sessionId, actionId');
  }

  try {
    const feedbackManager = createFeedbackLoopManager(env);
    const feedback = await feedbackManager.createFeedback(
      body.sessionId,
      body.actionId,
      body.outcome,
      body.metrics,
      body.observations,
      body.surprises
    );

    return successResponse(feedback, Date.now() - startTime);

  } catch (error) {
    return errorResponse(
      'FEEDBACK_ERROR',
      `Feedback submission failed: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Statistics Endpoint
// ============================================================================

/**
 * GET /stats - Get system statistics
 */
router.get('/stats', async (req) => {
  const env = req.env as Env;

  try {
    const stateManager = createStateManager(env);
    const stats = await stateManager.getStatistics();

    return successResponse(stats);

  } catch (error) {
    return errorResponse(
      'STATS_ERROR',
      `Failed to get statistics: ${(error as Error).message}`,
      error,
      500
    );
  }
});

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router.handle(request, env, ctx).catch((err) => {
      console.error('[Being State System] Error:', err);
      return errorResponse(
        'INTERNAL_ERROR',
        err.message || 'An unexpected error occurred',
        err,
        500
      );
    });
  },
};

// Re-export managers for programmatic use
export {
  createStateManager,
  createVisualStateManager,
  createAudioStateManager,
  createGameplayStateManager,
  createAgentStateManager,
  createCrewOrchestrator,
  createRAGInjector,
  createActionExecutor,
  createFeedbackLoopManager,
};

// Re-export types
export type {
  BeingState,
  StateTransitionRequest,
  StateTransitionResponse,
  VisualState,
  AudioState,
  GameplayState,
  AgentState,
  VisualTransformation,
  AudioStateConfig,
  GameplayStateConfig,
  AgentUpdate,
  CrewConfig,
  RAGContext,
  RAGInjection,
  EnvironmentFeedback,
  ExecutedAction,
  GodotCommand,
} from './types';
