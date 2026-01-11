/**
 * Vibe-Coding Chat Interface - Type Definitions
 *
 * Cursor/Windsurf style streaming chat for StudyLoG.AI with
 * real-time code generation, diff visualization, and context awareness.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Message role in conversations
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Streaming chunk types
 */
export type ChunkType =
  | 'content'      // Text content delta
  | 'diff'         // Code diff for live preview
  | 'file'         // New file creation
  | 'metadata'     // Token usage, cost, etc.
  | 'error'        // Error message
  | 'done'         // Stream complete
  | 'status';      // Status update (thinking, searching, etc.)

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  /** Chunk type */
  type: ChunkType;
  /** Content delta for text chunks */
  content?: string;
  /** File path for code-related chunks */
  filePath?: string;
  /** Language for syntax highlighting */
  language?: string;
  /** Diff for code changes */
  diff?: {
    original: string;
    modified: string;
    unified: string;
  };
  /** Token usage metadata */
  metadata?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    cost: number;
    model: string;
    provider: string;
  };
  /** Error message */
  error?: string;
  /** Status message */
  status?: string;
  /** Whether stream is complete */
  done?: boolean;
}

/**
 * Single chat message
 */
export interface ChatMessage {
  /** Message ID */
  id: string;
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: number;
  /** Code references in this message */
  codeReferences?: CodeReference[];
  /** Tool calls made */
  toolCalls?: ToolCall[];
}

/**
 * Code reference within a message
 */
export interface CodeReference {
  /** File path */
  path: string;
  /** Line range */
  range: { start: number; end: number };
  /** Symbol name */
  symbol?: string;
  /** Snippet preview */
  snippet: string;
}

/**
 * Tool call invocation
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Arguments (JSON string) */
  arguments: string;
  /** Result from tool execution */
  result?: string;
  /** Whether execution succeeded */
  success?: boolean;
}

/**
 * Chat session
 */
export interface ChatSession {
  /** Session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Workspace/project ID */
  workspaceId: string;
  /** Session title */
  title: string;
  /** Current mode */
  mode: ChatMode;
  /** Messages in session */
  messages: ChatMessage[];
  /** Context files attached */
  contextFiles: ContextFile[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Active branch ID */
  activeBranchId: string;
  /** Available branches */
  branches: ChatBranch[];
}

/**
 * Chat mode variants
 */
export type ChatMode = 'vibe' | 'spec' | 'refactor' | 'debug';

/**
 * Message branch for exploring alternatives
 */
export interface ChatBranch {
  /** Branch ID */
  id: string;
  /** Branch name */
  name: string;
  /** Message ID where branch starts */
  fromMessageId: string;
  /** Creation timestamp */
  createdAt: number;
  /** Whether branch is active */
  isActive: boolean;
}

/**
 * File attached as context
 */
export interface ContextFile {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Language/file type */
  language: string;
  /** Start line if partial */
  startLine?: number;
  /** End line if partial */
  endLine?: number;
  /** Symbol context */
  symbol?: string;
  /** Relevance score (0-1) */
  relevance?: number;
  /** Whether file is writable */
  writable?: boolean;
}

/**
 * Context build result
 */
export interface ContextBuildResult {
  /** Built context string */
  context: string;
  /** Files included */
  files: ContextFile[];
  /** Estimated token count */
  tokens: number;
  /** Whether context was compressed */
  compressed: boolean;
}

/**
 * File edit operation
 */
export interface FileEdit {
  /** File path */
  path: string;
  /** Edit operation */
  operation: 'insert' | 'replace' | 'delete';
  /** Start line (1-indexed) */
  startLine: number;
  /** End line (1-indexed) */
  endLine: number;
  /** Content to insert/replace */
  content: string;
  /** Original content (for replace) */
  originalContent?: string;
}

/**
 * Multi-file diff result
 */
export interface DiffResult {
  /** File path */
  path: string;
  /** Original content */
  original: string;
  /** Modified content */
  modified: string;
  /** Unified diff */
  unified: string;
  /** Line-by-line changes */
  changes: DiffChange[];
  /** Whether file is new */
  isNew: boolean;
  /** Whether file was deleted */
  isDeleted: boolean;
}

/**
 * Single diff change
 */
export interface DiffChange {
  /** Line number */
  line: number;
  /** Change type */
  type: 'add' | 'remove' | 'modify' | 'context';
  /** Original content */
  original?: string;
  /** Modified content */
  modified?: string;
}

/**
 * WebSocket message types
 */
export type WSMessageType =
  | 'chat'
  | 'stream'
  | 'diff'
  | 'status'
  | 'command'
  | 'response'
  | 'event';

/**
 * WebSocket message
 */
export interface WSMessage<T = unknown> {
  /** Message type */
  type: WSMessageType;
  /** Message ID */
  id?: string;
  /** Correlation ID for request/response */
  correlationId?: string;
  /** Payload data */
  data?: T;
  /** Error if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Chat request
 */
export interface ChatRequest {
  /** Session ID (optional for new sessions) */
  sessionId?: string;
  /** User message */
  message: string;
  /** User ID */
  userId: string;
  /** Workspace ID */
  workspaceId: string;
  /** Chat mode */
  mode?: ChatMode;
  /** Model to use */
  model?: string;
  /** Provider to use */
  provider?: string;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
  /** Stream response */
  stream?: boolean;
  /** Context files to include */
  contextFiles?: ContextFile[];
}

/**
 * Chat response (non-streaming)
 */
export interface ChatResponse {
  /** Response content */
  content: string;
  /** Session ID */
  sessionId: string;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
  /** Token usage */
  usage: {
    input: number;
    output: number;
    cached: number;
  };
  /** Cost in USD */
  cost: number;
  /** Code edits generated */
  edits?: FileEdit[];
  /** Diffs generated */
  diffs?: DiffResult[];
}

/**
 * Context file read strategy
 */
export type ReadStrategy = 'full' | 'partial' | 'semantic' | 'symbol';

/**
 * Code symbol info
 */
export interface CodeSymbol {
  /** Symbol name */
  name: string;
  /** Symbol type */
  kind: SymbolKind;
  /** File path */
  path: string;
  /** Start position */
  start: { line: number; character: number };
  /** End position */
  end: { line: number; character: number };
  /** Documentation */
  documentation?: string;
  /** Child symbols */
  children?: CodeSymbol[];
}

/**
 * Symbol kind (LSP-compatible)
 */
export type SymbolKind =
  | 'file'
  | 'module'
  | 'namespace'
  | 'package'
  | 'class'
  | 'method'
  | 'property'
  | 'field'
  | 'constructor'
  | 'enum'
  | 'interface'
  | 'function'
  | 'variable'
  | 'constant'
  | 'type'
  | 'typeAlias';

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Cloudflare Worker environment bindings
 */
export interface VibeCodingEnv {
  // KV Namespaces
  CHAT_HISTORY: KVNamespace;
  CONTEXT_CACHE: KVNamespace;
  PRESENCE: KVNamespace;

  // D1 Database
  DB?: D1Database;

  // R2 Storage (for workspace files)
  WORKSPACE_STORAGE?: R2Bucket;

  // AI Binding
  AI?: Ai;

  // API Keys (from secrets)
  DEEPSEEK_API_KEY?: string;
  ZHIPU_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  NVIDIA_API_KEY?: string;

  // Multi-model router URL
  MULTI_MODEL_ROUTER_URL?: string;

  // Environment config
  ENVIRONMENT?: string;
  MAX_CONTEXT_TOKENS?: string;
  MAX_HISTORY_MESSAGES?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * API error response
 */
export interface ErrorResponse {
  /** Error message */
  error: string;
  /** Error code */
  code?: string;
  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  /** Service status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Service name */
  service: string;
  /** Version */
  version: string;
  /** Timestamp */
  timestamp: string;
  /** Connected providers */
  providers?: string[];
}
