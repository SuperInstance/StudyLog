/**
 * StudyLoG.AI - NPC Module
 *
 * NVIDIA ACE-powered NPCs for immersive educational experiences.
 */

// Types
export * from './types';

// ACE Client
export { ACEClient, createACEClient } from './ace-client';

// NPC Agent
export { NPCAgent, createModuleNPCs } from './ace-agent';
export type { NPCAgentConfig } from './ace-agent';
