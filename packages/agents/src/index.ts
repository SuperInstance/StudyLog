/**
 * StudyLoG.AI - Agents Package
 *
 * AI Agent system for the educational platform.
 * Features multi-agent orchestration, NVIDIA ACE integration,
 * and A2A (Agent-to-Agent) protocol.
 */

// Core exports
export * from './core/types';
export { BaseAgent } from './core/base-agent';
export { AIClient, createAIClient } from './core/ai-client';
export { AgentOrchestrator, getOrchestrator } from './core/orchestrator';
export type { OrchestratorConfig, ExtendedAgentId } from './core/orchestrator';

// A2A Protocol
export {
  A2AProtocol,
  A2AClient,
  getA2AProtocol,
  createA2AProtocol,
} from './core/a2a-protocol';

// Agent exports
export { DirectorAgent } from './agents/director';
export { CaptainAgent } from './agents/captain';
export { DeckhandAgent } from './agents/deckhand';
export { RanchhandAgent } from './agents/ranchhand';
export { MechanicAgent } from './agents/mechanic';

// NPC exports
export * from './npc';
export type {
  NPCIdentity,
  NPCState,
  NPCMemory,
  NPCRole,
  NPCMood,
  NPCAction,
  ACEConfig,
  ACERequest,
  ACEResponse,
  A2AMessage,
  A2ARequest,
  A2AResponse,
  A2ACapability,
} from './npc/types';

// Tool/MCP exports
export { MCPAgentServer, startMCPServer } from './tools/mcp-server';

// Prompt exports
export { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_ROUTING_PROMPT } from './prompts/director';
export { CAPTAIN_SYSTEM_PROMPT, CAPTAIN_NARRATIVE_TEMPLATES } from './prompts/captain';
export {
  NPC_BASE_PROMPT,
  NPC_PROMPTS,
  NPC_HINT_TEMPLATES,
  NPC_TEACHING_STRATEGIES,
  MILLER_MAE_PROMPT,
  COG_APPRENTICE_PROMPT,
  PROFESSOR_SPROCKET_PROMPT,
  CAPTAIN_TIDE_PROMPT,
  MARINA_MERCHANT_PROMPT,
  OLD_SALT_PROMPT,
  RANCHER_RAY_PROMPT,
  DATA_DANA_PROMPT,
  SHEPHERD_SAM_PROMPT,
} from './prompts/npc';
