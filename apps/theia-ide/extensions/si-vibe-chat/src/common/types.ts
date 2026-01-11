/**
 * StudyLoG.AI - Vibe Chat Common Types
 *
 * Shared types for the Vibe Coding Chat System.
 * Inspired by Cursor, Windsurf, and Zed IDEs.
 */

// ============================================================================
// Widget Constants
// ============================================================================

export const VibeChatWidget = {
  ID: 'si-vibe-chat:widget',
  LABEL: 'Vibe Chat',
  ICON_CLASS: 'fa fa-comments',
  TOGGLE_COMMAND: 'studylog.vibe-chat.toggle',
} as const;

// ============================================================================
// Command IDs
// ============================================================================

export const VIBE_CHAT_COMMANDS = {
  TOGGLE: 'studylog.vibe-chat.toggle',
  EXPLAIN: 'studylog.vibe-chat.explain',
  REFACTOR: 'studylog.vibe-chat.refactor',
  FIX: 'studylog.vibe-chat.fix',
  OPTIMIZE: 'studylog.vibe-chat.optimize',
  ADD_TESTS: 'studylog.vibe-chat.add-tests',
  DOCUMENT: 'studylog.vibe-chat.document',
  INLINE_CHAT: 'studylog.vibe-chat.inline',
  NEW_CONVERSATION: 'studylog.vibe-chat.new-conversation',
  CLEAR_HISTORY: 'studylog.vibe-chat.clear-history',
  APPLY_DIFF: 'studylog.vibe-chat.apply-diff',
  REJECT_DIFF: 'studylog.vibe-chat.reject-diff',
} as const;

// ============================================================================
// Message Types
// ============================================================================

/**
 * Roles that can send messages in the chat
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Agent types for specialized AI responses
 */
export type AgentType = 'builder' | 'teacher' | 'tester' | 'director' | 'captain' | 'auto';

/**
 * A single chat message with metadata
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Who sent the message */
  role: MessageRole;
  /** Message content (markdown supported) */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Which agent generated this (for assistant messages) */
  agent?: AgentType;
  /** Model used for generation (e.g., 'claude-opus-4-5') */
  model?: string;
  /** Estimated cost in USD */
  cost?: number;
  /** Token usage */
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
  /** File attachments/references */
  files?: FileReference[];
  /** Code blocks in the message */
  codeBlocks?: CodeBlock[];
  /** Streaming state (for in-progress messages) */
  streaming?: boolean;
  /** Error message if generation failed */
  error?: string;
}

// ============================================================================
// File & Context Types
// ============================================================================

/**
 * Reference to a file in the workspace
 */
export interface FileReference {
  /** Absolute file path URI */
  uri: string;
  /** Display name (filename or relative path) */
  name: string;
  /** Language ID for syntax highlighting */
  language: string;
  /** Relevant line range (optional) */
  range?: LineRange;
  /** Why this file was included */
  reason?: ContextReason;
}

/**
 * Why a file was included in context
 */
export type ContextReason =
  | 'active'           // Currently open in editor
  | 'selection'        // User has selected text
  | 'related'          // Semantically related to query
  | 'import'           // Imported by active file
  | 'manual';          // User explicitly attached

/**
 * Line range in a file
 */
export interface LineRange {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/**
 * A code block within a message
 */
export interface CodeBlock {
  /** Language identifier */
  language: string;
  /** Code content */
  code: string;
  /** Suggested file path for application */
  filePath?: string;
  /** Diff changes if this is a modification */
  diff?: DiffChange[];
}

// ============================================================================
// Diff Types
// ============================================================================

/**
 * Type of change in a diff
 */
export type ChangeType = 'addition' | 'deletion' | 'modification';

/**
 * A single diff change
 */
export interface DiffChange {
  /** Line number (1-based) */
  line: number;
  /** Type of change */
  type: ChangeType;
  /** Original content (for deletions/modifications) */
  original?: string;
  /** Modified content (for additions/modifications) */
  modified?: string;
  /** AI's explanation for this change */
  reason?: string;
  /** Agent that made this change */
  agent?: AgentType;
}

/**
 * Complete diff for a file
 */
export interface FileDiff {
  /** File URI */
  uri: string;
  /** File name for display */
  name: string;
  /** Language ID */
  language: string;
  /** Original content */
  original: string;
  /** Modified content */
  modified: string;
  /** Individual changes with metadata */
  changes: DiffChange[];
  /** AI's overall explanation */
  explanation?: string;
  /** Whether this diff can be applied */
  applicable: boolean;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Streaming chunk types for SSE
 */
export type StreamChunkType =
  | 'metadata'     // Initial metadata about the response
  | 'content'      // Content delta
  | 'code_block'   // Code block start/update
  | 'diff'         // Diff change
  | 'file_ref'     // File reference
  | 'status'       // Status update
  | 'error'        // Error occurred
  | 'done';        // Stream complete

/**
 * A single streaming chunk from the backend
 */
export interface StreamChunk {
  /** Chunk type */
  type: StreamChunkType;
  /** Content for this chunk (varies by type) */
  content: string;
  /** Metadata attached to this chunk */
  metadata?: {
    /** Message ID */
    messageId?: string;
    /** Agent type */
    agent?: AgentType;
    /** Model name */
    model?: string;
    /** Language for code blocks */
    language?: string;
    /** File path for diffs */
    filePath?: string;
    /** Line number */
    line?: number;
    /** Change type */
    changeType?: ChangeType;
    /** Token count so far */
    tokens?: number;
    /** Estimated cost so far */
    cost?: number;
  };
}

// ============================================================================
// Conversation Types
// ============================================================================

/**
 * A conversation thread
 */
export interface Conversation {
  /** Unique conversation ID */
  id: string;
  /** Conversation title (auto-generated or user-set) */
  title: string;
  /** Messages in this conversation */
  messages: ChatMessage[];
  /** When this conversation was created */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Agent currently active */
  agent?: AgentType;
  /** Files referenced in this conversation */
  files?: FileReference[];
  /** User-defined tags */
  tags?: string[];
}

/**
 * Summary for conversation list view
 */
export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: number;
  agent?: AgentType;
  tags?: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Vibe Chat configuration
 */
export interface VibeChatConfig {
  /** Default model to use */
  model: string;
  /** Default agent */
  agent: AgentType;
  /** Temperature (0.0 - 1.0) */
  temperature: number;
  /** Maximum tokens for responses */
  maxTokens: number;
  /** Whether to show diffs before applying */
  diffFirst: boolean;
  /** Whether to stream responses */
  stream: boolean;
  /** Whether to include file context automatically */
  autoContext: boolean;
  /** Context window size in tokens */
  contextWindow: number;
  /** Theme (light/dark) */
  theme: 'light' | 'dark' | 'auto';
  /** Font size for messages */
  fontSize: number;
  /** Whether to show timestamps */
  showTimestamps: boolean;
  /** Whether to show token usage */
  showTokens: boolean;
  /** Whether to show costs */
  showCosts: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_VIBE_CHAT_CONFIG: VibeChatConfig = {
  model: 'claude-sonnet-4-5',
  agent: 'auto',
  temperature: 0.7,
  maxTokens: 4096,
  diffFirst: true,
  stream: true,
  autoContext: true,
  contextWindow: 100000,
  theme: 'auto',
  fontSize: 14,
  showTimestamps: true,
  showTokens: false,
  showCosts: true,
} as const;

// ============================================================================
// Quick Actions (Cursor-style)
// ============================================================================

/**
 * Predefined quick actions for code selection
 */
export interface QuickAction {
  /** Command ID */
  id: string;
  /** Display label */
  label: string;
  /** Icon class */
  iconClass: string;
  /** Description tooltip */
  description: string;
  /** Default prompt template */
  promptTemplate: string;
  /** Default agent for this action */
  defaultAgent: AgentType;
}

/**
 * Built-in quick actions
 */
export const QUICK_ACTIONS: Record<string, QuickAction> = {
  explain: {
    id: VIBE_CHAT_COMMANDS.EXPLAIN,
    label: 'Explain',
    iconClass: 'fa fa-question-circle',
    description: 'Explain the selected code',
    promptTemplate: 'Explain this code:\n\n```\n{language}\n{selection}\n```\n\nFocus on:\n1. What it does\n2. How it works\n3. Any potential issues',
    defaultAgent: 'teacher',
  },
  refactor: {
    id: VIBE_CHAT_COMMANDS.REFACTOR,
    label: 'Refactor',
    iconClass: 'fa fa-magic',
    description: 'Refactor the selected code',
    promptTemplate: 'Refactor this code to improve readability, maintainability, and performance:\n\n```\n{language}\n{selection}\n```\n\nShow the refactored version as a diff.',
    defaultAgent: 'builder',
  },
  fix: {
    id: VIBE_CHAT_COMMANDS.FIX,
    label: 'Fix',
    iconClass: 'fa fa-wrench',
    description: 'Fix issues in the selected code',
    promptTemplate: 'Identify and fix any bugs, issues, or potential problems in this code:\n\n```\n{language}\n{selection}\n```\n\nExplain each fix and show the corrected code.',
    defaultAgent: 'tester',
  },
  optimize: {
    id: VIBE_CHAT_COMMANDS.OPTIMIZE,
    label: 'Optimize',
    iconClass: 'fa fa-bolt',
    description: 'Optimize the selected code',
    promptTemplate: 'Optimize this code for better performance:\n\n```\n{language}\n{selection}\n```\n\nShow the optimized version as a diff with explanations.',
    defaultAgent: 'builder',
  },
  addTests: {
    id: VIBE_CHAT_COMMANDS.ADD_TESTS,
    label: 'Add Tests',
    iconClass: 'fa fa-flask',
    description: 'Generate tests for the selected code',
    promptTemplate: 'Generate comprehensive tests for this code:\n\n```\n{language}\n{selection}\n```\n\nInclude unit tests, edge cases, and integration scenarios.',
    defaultAgent: 'tester',
  },
  document: {
    id: VIBE_CHAT_COMMANDS.DOCUMENT,
    label: 'Document',
    iconClass: 'fa fa-file-text-o',
    description: 'Add documentation to the selected code',
    promptTemplate: 'Add comprehensive documentation to this code:\n\n```\n{language}\n{selection}\n```\n\nInclude JSDoc comments, inline explanations, and usage examples.',
    defaultAgent: 'teacher',
  },
};

// ============================================================================
// Agent Info
// ============================================================================

/**
 * Information about each agent type for display
 */
export const AGENT_INFO: Record<AgentType, {
  name: string;
  description: string;
  icon: string;
  color: string;
  capabilities: string[];
}> = {
  auto: {
    name: 'Auto',
    description: 'Automatically select the best agent for your query',
    icon: 'fa fa-robot',
    color: '#6c757d',
    capabilities: ['routing', 'intent-detection'],
  },
  builder: {
    name: 'Builder',
    description: 'Code generation, refactoring, and implementation',
    icon: 'fa fa-hammer',
    color: '#007bff',
    capabilities: ['code-generation', 'refactoring', 'implementation', 'debugging'],
  },
  teacher: {
    name: 'Teacher',
    description: 'Explanations, tutorials, and learning guidance',
    icon: 'fa fa-graduation-cap',
    color: '#28a745',
    capabilities: ['explanation', 'teaching', 'tutorials', 'documentation'],
  },
  tester: {
    name: 'Tester',
    description: 'Testing, verification, and quality assurance',
    icon: 'fa fa-check-circle',
    color: '#dc3545',
    capabilities: ['testing', 'verification', 'debugging', 'code-review'],
  },
  director: {
    name: 'Director',
    description: 'Orchestration, planning, and complex task coordination',
    icon: 'fa fa-sitemap',
    color: '#6f42c1',
    capabilities: ['planning', 'coordination', 'architecture', 'multi-file'],
  },
  captain: {
    name: 'Captain',
    description: 'Game logic, simulation, and Godot integration',
    icon: 'fa fa-anchor',
    color: '#17a2b8',
    capabilities: ['game-logic', 'simulation', 'godot', 'physics'],
  },
};

// ============================================================================
// API Endpoints
// ============================================================================

export const VIBE_CHAT_API = {
  /** Chat completion endpoint */
  CHAT: '/api/v1/vibe-chat/chat',
  /** Streaming chat endpoint */
  STREAM: '/api/v1/vibe-chat/stream',
  /** Agent routing endpoint */
  ROUTE: '/api/v1/vibe-chat/route',
  /** Diff application endpoint */
  APPLY_DIFF: '/api/v1/vibe-chat/apply-diff',
  /** Context gathering endpoint */
  CONTEXT: '/api/v1/vibe-chat/context',
  /** Conversation persistence */
  CONVERSATIONS: '/api/v1/vibe-chat/conversations',
} as const;

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Main widget state
 */
export interface VibeChatState {
  /** All conversations */
  conversations: Conversation[];
  /** Currently active conversation */
  activeConversationId: string | null;
  /** Currently attached files */
  attachedFiles: FileReference[];
  /** Whether currently streaming a response */
  isStreaming: boolean;
  /** Current input text */
  inputText: string;
  /** Current configuration */
  config: VibeChatConfig;
  /** Active diff being previewed */
  activeDiff: FileDiff | null;
  /** Panel visibility state */
  panels: {
    context: boolean;
    diff: boolean;
    history: boolean;
  };
  /** Loading state */
  isLoading: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Vibe Chat specific error
 */
export class VibeChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'VibeChatError';
  }
}

/**
 * Error codes
 */
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  CONTEXT_TOO_LARGE: 'CONTEXT_TOO_LARGE',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  INVALID_DIFF: 'INVALID_DIFF',
  STREAM_INTERRUPTED: 'STREAM_INTERRUPTED',
} as const;
