/**
 * StudyLoG.AI - Agents Package
 *
 * AI Agent system for the educational platform.
 */

// Core exports
export * from './core/types';
export { BaseAgent } from './core/base-agent';
export { AIClient, createAIClient } from './core/ai-client';
export { AgentOrchestrator, getOrchestrator } from './core/orchestrator';

// Agent exports
export { DirectorAgent } from './agents/director';
export { CaptainAgent } from './agents/captain';

// Tool/MCP exports
export { MCPAgentServer, startMCPServer } from './tools/mcp-server';

// Prompt exports
export { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_ROUTING_PROMPT } from './prompts/director';
export { CAPTAIN_SYSTEM_PROMPT, CAPTAIN_NARRATIVE_TEMPLATES } from './prompts/captain';
