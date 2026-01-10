/**
 * StudyLoG.AI - Agent Core Types
 */

// Agent identifiers
export type AgentId = 'director' | 'captain' | 'teacher' | 'builder' | 'tester';

// Agent status
export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'waiting' | 'error';

// Message roles
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

// Conversation message
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  agentId?: AgentId;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Tool call from agent
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// Tool result
export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameter;
}

// Agent context
export interface AgentContext {
  // Current learning state
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  stage: number;
  phase: 'player' | 'reader' | 'tweaker' | 'creator' | 'mentor';

  // Student info
  student?: StudentInfo;

  // Game state
  gameState?: GameState;

  // Conversation
  conversationHistory: Message[];

  // Agent-specific state
  agentState: Record<string, unknown>;
}

export interface StudentInfo {
  id: string;
  displayName: string;
  skillLevels: Record<string, number>;
  preferences: {
    hintLevel: 'minimal' | 'moderate' | 'verbose';
    pace: 'slow' | 'normal' | 'fast';
  };
}

export interface GameState {
  scene: string;
  variables: Record<string, unknown>;
  paused: boolean;
  lastUpdate: number;
}

// Agent response
export interface AgentResponse {
  content: string;
  agentId: AgentId;
  toolCalls?: ToolCall[];
  uiUpdates?: UIUpdate[];
  gameCommands?: GameCommand[];
  delegateTo?: AgentId;
  metadata?: Record<string, unknown>;
}

// UI update for A2UI
export interface UIUpdate {
  type: 'add' | 'update' | 'remove';
  componentId: string;
  component?: unknown; // A2UI component
}

// Game command for Godot
export interface GameCommand {
  type: 'load_scene' | 'set_variable' | 'pause' | 'resume' | 'trigger_event';
  payload: Record<string, unknown>;
}

// Agent configuration
export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

// AI provider configuration
export interface AIProviderConfig {
  provider: 'cloudflare' | 'ollama' | 'anthropic';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// Agent event
export type AgentEvent =
  | { type: 'message'; message: Message }
  | { type: 'tool_call'; toolCall: ToolCall }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'response'; response: AgentResponse }
  | { type: 'error'; error: Error }
  | { type: 'delegation'; from: AgentId; to: AgentId; task: string };
