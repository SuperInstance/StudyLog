/**
 * DMLoG.AI - Multi-Agent Orchestration System
 *
 * Main entry point for the agent orchestration worker.
 * Provides unified backend for both DMLoG.AI and StudyLoG.AI.
 *
 * Routes:
 * - POST /api/v1/agents/decision - Get agent decision
 * - POST /api/v1/agents/coordinate - Multi-agent coordination
 * - GET /api/v1/agents/state - Get agent state
 * - GET /api/v1/agents/list - List agents for session
 * - POST /api/v1/agents/create - Create new agent
 * - DELETE /api/v1/agents/{id} - Remove agent
 * - GET /api/v1/agents/stats - System statistics
 * - WS /api/v1/agents/ws - Real-time updates (WebSocket)
 *
 * @module index
 */

import { handleAgentRequest } from './api/handlers.js';

// Re-export types
export * from './types/index.js';

// Re-export core modules
export { AgentRegistry, getAgentRegistry } from './core/agent-registry.js';
export {
  CommunicationBus,
  getCommunicationBus,
  startCommunicationBus,
} from './core/communication-bus.js';
export {
  AgentOrchestrator,
  createOrchestrator,
  getSessionOrchestrator,
} from './core/orchestrator.js';

// Re-export agents
export {
  CombatAgent,
  createCombatAgent,
  createHordeAgent,
  CombatStyle,
  TargetPriority,
} from './agents/combat-agent.js';
export {
  SocialAgent,
  createSocialAgent,
  createPersonalityNPC,
  SocialStyle,
} from './agents/social-agent.js';
export {
  ExplorationAgent,
  createExplorationAgent,
  ExplorationStyle,
} from './agents/exploration-agent.js';

/**
 * Cloudflare Workers entry point
 */
export default {
  /**
   * Fetch handler for all HTTP requests
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Handle agent API routes
      if (url.pathname.startsWith('/api/v1/agents')) {
        return handleAgentRequest(request, env);
      }

      // Health check
      if (url.pathname === '/health') {
        return Response.json({
          status: 'healthy',
          service: 'dmlog-agents',
          timestamp: new Date().toISOString(),
          version: '0.1.0',
        });
      }

      // 404 for unknown routes
      return Response.json(
        {
          error: 'Not Found',
          message: `Route not found: ${url.pathname}`,
          availableRoutes: [
            'GET /health',
            'POST /api/v1/agents/decision',
            'POST /api/v1/agents/coordinate',
            'GET /api/v1/agents/state',
            'GET /api/v1/agents/list',
            'POST /api/v1/agents/create',
            'DELETE /api/v1/agents/{id}',
            'GET /api/v1/agents/stats',
            'WS /api/v1/agents/ws',
          ],
        },
        { status: 404 }
      );
    } catch (error) {
      // Error handler
      // eslint-disable-next-line no-console
      console.error('Agent worker error:', error);

      return Response.json(
        {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
};

/**
 * Scheduled handler for periodic tasks (Cloudflare Workers Cron)
 */
export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  // Cleanup stale agents
  const { getAgentRegistry } = await import('./core/agent-registry.js');
  const registry = getAgentRegistry();

  const cleaned = registry.cleanupStaleAgents(30 * 60 * 1000); // 30 minutes

  if (cleaned.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[Scheduled] Cleaned up ${cleaned.length} stale agents:`, cleaned);
  }
}

/**
 * Get version info
 */
export function getVersion(): string {
  return '0.1.0';
}

/**
 * Get available routes
 */
export function getAvailableRoutes(): string[] {
  return [
    'GET /health',
    'POST /api/v1/agents/decision',
    'POST /api/v1/agents/coordinate',
    'GET /api/v1/agents/state',
    'GET /api/v1/agents/list',
    'POST /api/v1/agents/create',
    'DELETE /api/v1/agents/{id}',
    'GET /api/v1/agents/stats',
    'WS /api/v1/agents/ws',
  ];
}
