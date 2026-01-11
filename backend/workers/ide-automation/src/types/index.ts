/**
 * IDE Automation - Core Type Definitions
 *
 * Complete type system for Cursor-class IDE automation features
 * including chat, code actions, agents, testing, and background tasks.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Message role in chat conversations
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Chat mode for different interaction styles
 */
export type ChatMode = 'vibe' | 'spec';

/**
 * Tool call from assistant (for function calling)
 */
export interface ToolCall {
  /** Tool identifier */
  id: string;
  /** Tool name */
  name: string;
  /** Stringified arguments */
  arguments: string;
}

/**
 * Tool result message
 */
export interface ToolResult {
  /** Tool call this responds to */
  toolCallId: string;
  /** Output from tool execution */
  content: string;
  /** Whether tool execution succeeded */
  error?: boolean;
}

/**
 * Single chat message
 */
export interface ChatMessage {
  /** Message role */
  role: MessageRole;
  /** Message content (text or tool calls) */
  content?: string;
  /** Tool calls made by assistant */
  toolCalls?: ToolCall[];
  /** Tool result ID */
  toolCallId?: string;
  /** Message timestamp */
  timestamp?: number;
  /** Unique message ID */
  id?: string;
  /** Branch ID for message history variants */
  branchId?: string;
  /** Parent message ID for branching */
  parentId?: string;
}

/**
 * Chat conversation session
 */
export interface ChatSession {
  /** Unique session ID */
  id: string;
  /** User ID */
  userId: string;
  /** Project/workspace ID */
  workspaceId: string;
  /** Session title (derived from first message) */
  title: string;
  /** Current chat mode */
  mode: ChatMode;
  /** Messages in this session */
  messages: ChatMessage[];
  /** Active branch ID */
  activeBranchId: string;
  /** Available branches */
  branches: ChatBranch[];
  /** Context files attached */
  contextFiles: ContextFile[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** XP earned from this session */
  xpEarned?: number;
  /** Achievements unlocked */
  achievements?: string[];
}

/**
 * Branch in message history (for exploring alternatives)
 */
export interface ChatBranch {
  /** Unique branch ID */
  id: string;
  /** Branch name */
  name: string;
  /** Message ID where branch starts */
  fromMessageId: string;
  /** Branch creation timestamp */
  createdAt: number;
  /** Whether this is the active branch */
  isActive: boolean;
}

/**
 * File attached to chat context
 */
export interface ContextFile {
  /** File path */
  path: string;
  /** File content (can be partial) */
  content: string;
  /** Language/file type */
  language: string;
  /** Start line if partial */
  startLine?: number;
  /** End line if partial */
  endLine?: number;
  /** Symbol-level context (class/function name) */
  symbol?: string;
  /** Relevance score (0-1) */
  relevance?: number;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  /** Chunk type */
  type: 'content' | 'tool_call' | 'metadata' | 'error' | 'done';
  /** Content delta */
  content?: string;
  /** Tool call delta */
  toolCall?: Partial<ToolCall>;
  /** Token usage metadata */
  metadata?: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    cost: number;
  };
  /** Error message */
  error?: string;
  /** Whether stream is complete */
  done?: boolean;
}

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  /** Maximum context tokens */
  maxTokens: number;
  /** Reserved for system prompt */
  reservedSystemTokens: number;
  /** Reserved for output */
  reservedOutputTokens: number;
  /** Maximum file content tokens */
  maxFileTokens: number;
  /** Compression strategy */
  compressionStrategy: 'truncate' | 'summarize' | 'semantic';
}

// ============================================================================
// Code Action Types
// ============================================================================

/**
 * Code action types
 */
export type CodeActionType =
  | 'edit'
  | 'create'
  | 'delete'
  | 'rename'
  | 'move'
  | 'refactor'
  | 'explain'
  | 'find_references'
  | 'find_definitions'
  | 'fix_errors'
  | 'optimize_imports'
  | 'extract_function'
  | 'inline_variable'
  | 'rename_symbol';

/**
 * File edit operation
 */
export interface FileEdit {
  /** File path */
  path: string;
  /** Old content to replace */
  oldContent: string;
  /** New replacement content */
  newContent: string;
  /** Start line number (1-indexed) */
  startLine?: number;
  /** End line number (1-indexed) */
  endLine?: number;
  /** Character offset in start line */
  startColumn?: number;
  /** Character offset in end line */
  endColumn?: number;
}

/**
 * Unified diff representation
 */
export interface FileDiff {
  /** File path */
  path: string;
  /** Original content */
  original: string;
  /** Modified content */
  modified: string;
  /** Unified diff string */
  diff: string;
  /** Line-by-line changes */
  changes: DiffChange[];
  /** Whether this is a new file */
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
  /** Original line content */
  original?: string;
  /** Modified line content */
  modified?: string;
}

/**
 * Multi-file operation
 */
export interface MultiFileOperation {
  /** Unique operation ID */
  id: string;
  /** Operation type */
  type: 'batch_edit' | 'refactor' | 'move' | 'delete';
  /** Operations to apply */
  operations: FileEdit[];
  /** Operations grouped by file */
  byFile: Record<string, FileEdit[]>;
  /** Total estimated impact */
  impact: {
    filesAffected: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

/**
 * Code symbol for navigation
 */
export interface CodeSymbol {
  /** Symbol name */
  name: string;
  /** Symbol type */
  kind: SymbolKind;
  /** File path */
  path: string;
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
  /** Containing symbol (for nested) */
  container?: string;
  /** Documentation */
  documentation?: string;
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
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'key'
  | 'null'
  | 'enumMember'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter';

/**
 * Position in file
 */
export interface Position {
  /** Line number (0-indexed) */
  line: number;
  /** Character offset (0-indexed) */
  character: number;
}

/**
 * Range in file
 */
export interface Range {
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
}

/**
 * Reference location
 */
export interface ReferenceLocation {
  /** File path */
  path: string;
  /** Range of reference */
  range: Range;
  /** Reference context lines */
  context?: string[];
}

/**
 * Code explanation
 */
export interface CodeExplanation {
  /** Code being explained */
  code: string;
  /** Language */
  language: string;
  /** Explanation text */
  explanation: string;
  /** Key concepts */
  concepts: string[];
  /** Related patterns */
  patterns: string[];
  /** Difficulty level */
  level: 'beginner' | 'intermediate' | 'advanced';
  /** Estimated reading time (seconds) */
  readTime: number;
}

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent task status
 */
export type TaskStatus = 'pending' | 'planning' | 'in_progress' | 'blocked' | 'completed' | 'failed' | 'cancelled';

/**
 * Agent task priority
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Tool for agent use
 */
export interface AgentTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
  /** Handler function */
  handler: (params: unknown) => Promise<ToolResult>;
}

/**
 * Agent planning step
 */
export interface PlanningStep {
  /** Step number */
  step: number;
  /** Step description */
  description: string;
  /** Tools needed */
  tools: string[];
  /** Estimated tokens */
  estimatedTokens: number;
  /** Dependencies on other steps */
  dependencies: number[];
  /** Status */
  status: TaskStatus;
  /** Result from execution */
  result?: unknown;
  /** Error if failed */
  error?: string;
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  /** Plan ID */
  id: string;
  /** Original user request */
  request: string;
  /** High-level summary */
  summary: string;
  /** Planning steps */
  steps: PlanningStep[];
  /** Total estimated tokens */
  estimatedTokens: number;
  /** Estimated cost (USD) */
  estimatedCost: number;
  /** Plan creation timestamp */
  createdAt: number;
}

/**
 * Agent task
 */
export interface AgentTask {
  /** Unique task ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** User request */
  request: string;
  /** Execution plan */
  plan?: ExecutionPlan;
  /** Current status */
  status: TaskStatus;
  /** Priority */
  priority: TaskPriority;
  /** Current step index */
  currentStep?: number;
  /** Accumulated results */
  results: Record<string, unknown>;
  /** Error if failed */
  error?: string;
  /** Retry count */
  retries: number;
  /** Maximum retries */
  maxRetries: number;
  /** Creation timestamp */
  createdAt: number;
  /** Start timestamp */
  startedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
  /** XP awarded */
  xpAwarded?: number;
}

/**
 * Progress update
 */
export interface ProgressUpdate {
  /** Task ID */
  taskId: string;
  /** Step number */
  step: number;
  /** Total steps */
  total: number;
  /** Current action description */
  action: string;
  /** Partial results */
  results?: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Error recovery strategy
 */
export type ErrorRecoveryStrategy =
  | 'retry'
  | 'fallback'
  | 'skip'
  | 'abort'
  | 'ask_user';

/**
 * Error recovery action
 */
export interface ErrorRecovery {
  /** Error message */
  error: string;
  /** Recovery strategy */
  strategy: ErrorRecoveryStrategy;
  /** Alternative approach description */
  alternative?: string;
  /** Whether recovery was successful */
  recovered: boolean;
}

// ============================================================================
// Testing Types
// ============================================================================

/**
 * Test type
 */
export type TestType = 'unit' | 'integration' | 'e2e' | 'snapshot';

/**
 * Test framework
 */
export type TestFramework = 'vitest' | 'jest' | 'pytest' | 'gtest' | 'custom';

/**
 * Generated test
 */
export interface GeneratedTest {
  /** Test file path */
  path: string;
  /** Test content */
  content: string;
  /** Framework used */
  framework: TestFramework;
  /** Test type */
  type: TestType;
  /** Functions/methods being tested */
  targets: string[];
  /** Estimated coverage increase */
  estimatedCoverage: number;
}

/**
 * Coverage report
 */
export interface CoverageReport {
  /** Overall coverage percentage */
  total: number;
  /** Coverage by file */
  byFile: Record<string, FileCoverage>;
  /** Uncovered lines */
  uncoveredLines: Record<string, number[]>;
  /** Branch coverage */
  branches: BranchCoverage[];
}

/**
 * File coverage
 */
export interface FileCoverage {
  /** File path */
  path: string;
  /** Coverage percentage */
  percentage: number;
  /** Covered lines */
  coveredLines: number;
  /** Total lines */
  totalLines: number;
  /** Functions covered */
  functions: FunctionCoverage[];
}

/**
 * Function coverage
 */
export interface FunctionCoverage {
  /** Function name */
  name: string;
  /** Coverage percentage */
  percentage: number;
  /** Execution count */
  count: number;
}

/**
 * Branch coverage
 */
export interface BranchCoverage {
  /** File path */
  path: string;
  /** Line number */
  line: number;
  /** Branches taken */
  taken: number;
  /** Total branches */
  total: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Overall validity */
  valid: boolean;
  /** Errors found */
  errors: ValidationIssue[];
  /** Warnings */
  warnings: ValidationIssue[];
  /** Info messages */
  info: ValidationIssue[];
  /** Quality score (0-100) */
  qualityScore: number;
}

/**
 * Validation issue
 */
export interface ValidationIssue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  /** Issue code */
  code: string;
  /** Issue message */
  message: string;
  /** File path */
  path?: string;
  /** Line number */
  line?: number;
  /** Suggested fix */
  fix?: string;
}

/**
 * Quality check result
 */
export interface QualityCheck {
  /** Check category */
  category: QualityCategory;
  /** Check name */
  name: string;
  /** Passed */
  passed: boolean;
  /** Score (0-100) */
  score: number;
  /** Details */
  details: string;
  /** Suggestions */
  suggestions: string[];
}

/**
 * Quality category
 */
export type QualityCategory =
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'readability'
  | 'test_coverage'
  | 'documentation'
  | 'accessibility'
  | 'best_practices';

/**
 * Regression detection
 */
export interface RegressionDetection {
  /** New issues found */
  newIssues: ValidationIssue[];
  /** Fixed issues */
  fixedIssues: ValidationIssue[];
  /** Performance regressions */
  performanceRegressions: PerformanceChange[];
  /** Overall status */
  status: 'improved' | 'regressed' | 'stable';
}

/**
 * Performance change
 */
export interface PerformanceChange {
  /** Metric name */
  metric: string;
  /** Previous value */
  previous: number;
  /** Current value */
  current: number;
  /** Change percentage */
  changePercent: number;
  /** Direction */
  direction: 'improved' | 'regressed';
}

// ============================================================================
// Background Execution Types
// ============================================================================

/**
 * Background job status
 */
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Background job
 */
export interface BackgroundJob {
  /** Unique job ID */
  id: string;
  /** User ID */
  userId: string;
  /** Job type */
  type: string;
  /** Job parameters */
  params: Record<string, unknown>;
  /** Current status */
  status: JobStatus;
  /** Progress (0-100) */
  progress: number;
  /** Current status message */
  statusMessage?: string;
  /** Result when complete */
  result?: unknown;
  /** Error if failed */
  error?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Start timestamp */
  startedAt?: number;
  /** Completion timestamp */
  completedAt?: number;
  /** Estimated duration (ms) */
  estimatedDuration?: number;
  /** Cancellation token */
  cancellationToken?: string;
}

/**
 * Job queue entry
 */
export interface QueueEntry {
  /** Job ID */
  id: string;
  /** Priority (higher = more important) */
  priority: number;
  /** Scheduled time */
  scheduledAt: number;
  /** Dependencies (job IDs that must complete first) */
  dependencies: string[];
  /** Maximum retries */
  maxRetries: number;
  /** Current retry count */
  retryCount: number;
}

/**
 * Progress notification
 */
export interface ProgressNotification {
  /** Job ID */
  jobId: string;
  /** Notification type */
  type: 'progress' | 'complete' | 'error' | 'cancelled';
  /** Progress percentage */
  progress: number;
  /** Message */
  message: string;
  /** Intermediate result */
  result?: unknown;
  /** Timestamp */
  timestamp: number;
}

/**
 * Cancellation request
 */
export interface CancellationRequest {
  /** Job ID to cancel */
  jobId: string;
  /** User ID requesting cancellation */
  userId: string;
  /** Reason for cancellation */
  reason?: string;
  /** Whether to force cancellation */
  force: boolean;
}

/**
 * Pause request
 */
export interface PauseRequest {
  /** Job ID to pause */
  jobId: string;
  /** User ID requesting pause */
  userId: string;
  /** Reason for pause */
  reason?: string;
}

// ============================================================================
// Context Builder Types
// ============================================================================

/**
 * File reading strategy
 */
export type ReadStrategy = 'full' | 'partial' | 'semantic' | 'diff';

/**
 * Symbol type for extraction
 */
export interface SymbolInfo {
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: SymbolKind;
  /** Containing symbol */
  container?: string;
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
  /** Full symbol text */
  text: string;
  /** Signature/excerpt */
  signature: string;
  /** Documentation comment */
  documentation?: string;
  /** Related symbols */
  related?: string[];
}

/**
 * Dependency mapping
 */
export interface DependencyMap {
  /** File path */
  path: string;
  /** Imports */
  imports: ImportInfo[];
  /** Exports */
  exports: ExportInfo[];
  /** Local dependencies */
  localDeps: string[];
  /** External dependencies */
  externalDeps: string[];
  /** Circular dependencies */
  circularDeps: string[];
}

/**
 * Import information
 */
export interface ImportInfo {
  /** Import path */
  from: string;
  /** Imported names */
  imported: string[];
  /** Is default import */
  isDefault?: boolean;
  /** Is namespace import */
  isNamespace?: boolean;
  /** Line number */
  line: number;
}

/**
 * Export information
 */
export interface ExportInfo {
  /** Export name */
  name: string;
  /** Is default export */
  isDefault: boolean;
  /** Is type export */
  isType: boolean;
  /** Line number */
  line: number;
}

/**
 * Semantic search result
 */
export interface SemanticResult {
  /** File path */
  path: string;
  /** Relevance score (0-1) */
  score: number;
  /** Matching snippet */
  snippet: string;
  /** Line range */
  range: Range;
  /** Related symbols */
  symbols: string[];
}

/**
 * RAG integration config
 */
export interface RAGConfig {
  /** Vector index name */
  indexName: string;
  /** Embedding model */
  embeddingModel: string;
  /** Chunk size */
  chunkSize: number;
  /** Chunk overlap */
  chunkOverlap: number;
  /** Results limit */
  limit: number;
  /** Minimum relevance threshold */
  minRelevance: number;
}

/**
 * Context build result
 */
export interface ContextBuildResult {
  /** Built context message */
  context: string;
  /** Files included */
  files: ContextFile[];
  /** Total tokens estimated */
  tokens: number;
  /** Compression applied */
  compressed: boolean;
  /** Semantic search results */
  semanticResults?: SemanticResult[];
}

// ============================================================================
// Theia Integration Types
// ============================================================================

/**
 * WebSocket message type
 */
export type WSMessageType =
  | 'chat'
  | 'stream'
  | 'action'
  | 'progress'
  | 'event'
  | 'command'
  | 'response';

/**
 * WebSocket message
 */
export interface WSMessage<T = unknown> {
  /** Message type */
  type: WSMessageType;
  /** Message ID for correlation */
  id?: string;
  /** Correlation ID (response to) */
  correlationId?: string;
  /** Payload data */
  data?: T;
  /** Error if failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Command palette command
 */
export interface Command {
  /** Command ID */
  id: string;
  /** Command title */
  title: string;
  /** Category */
  category: string;
  /** Icon name */
  icon?: string;
  /** Keybinding */
  keybinding?: string;
  /** Handler function */
  handler: (params: Record<string, unknown>) => Promise<CommandResult>;
  /** Description */
  description?: string;
}

/**
 * Command result
 */
export interface CommandResult {
  /** Success status */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error message */
  error?: string;
  /** Actions to show user */
  actions?: CommandAction[];
}

/**
 * Action for user to take
 */
export interface CommandAction {
  /** Action label */
  label: string;
  /** Action type */
  type: 'primary' | 'secondary' | 'danger';
  /** Action to execute */
  action: string;
  /** Action parameters */
  params?: Record<string, unknown>;
}

/**
 * Panel widget info
 */
export interface PanelWidget {
  /** Widget ID */
  id: string;
  /** Widget type */
  type: 'chat' | 'diff' | 'preview' | 'terminal' | 'custom';
  /** Widget title */
  title: string;
  /** Initial position */
  position: 'left' | 'right' | 'bottom';
  /** Widget size (relative) */
  size: number;
  /** Whether widget is resizable */
  resizable: boolean;
  /** Initial data */
  data?: Record<string, unknown>;
}

/**
 * Inline diff render options
 */
export interface InlineDiffOptions {
  /** File path */
  path: string;
  /** Original content */
  original: string;
  /** Modified content */
  modified: string;
  /** Whether to show side-by-side */
  sideBySide?: boolean;
  /** Line highlighting mode */
  highlightMode?: 'none' | 'word' | 'line';
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to wrap lines */
  wrapLines?: boolean;
  /** Theme */
  theme?: string;
}

// ============================================================================
// Gamification Types
// ============================================================================

/**
 * XP award event
 */
export interface XPAward {
  /** User ID */
  userId: string;
  /** XP amount */
  amount: number;
  /** Source of XP */
  source: XPSource;
  /** Related session/task ID */
  relatedId?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * XP source types
 */
export type XPSource =
  | 'chat_message'
  | 'code_generated'
  | 'test_created'
  | 'bug_fixed'
  | 'refactor_complete'
  | 'task_completed'
  | 'achievement_unlocked'
  | 'streak_bonus'
  | 'quality_bonus';

/**
 * Achievement
 */
export interface Achievement {
  /** Achievement ID */
  id: string;
  /** Achievement name */
  name: string;
  /** Description */
  description: string;
  /** Icon */
  icon: string;
  /** Rarity */
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** XP reward */
  xpReward: number;
  /** Unlock criteria */
  criteria: AchievementCriteria;
  /** Whether achievement is hidden until unlocked */
  hidden: boolean;
}

/**
 * Achievement criteria
 */
export interface AchievementCriteria {
  /** Type of criteria */
  type: 'count' | 'streak' | 'threshold' | 'special';
  /** What to measure */
  measure: string;
  /** Target value */
  target: number;
  /** Time window (ms) for streak/threshold */
  timeWindow?: number;
}

/**
 * User achievement progress
 */
export interface AchievementProgress {
  /** Achievement ID */
  achievementId: string;
  /** User ID */
  userId: string;
  /** Current progress */
  progress: number;
  /** Target */
  target: number;
  /** Whether unlocked */
  unlocked: boolean;
  /** Unlock timestamp */
  unlockedAt?: number;
}

/**
 * Level info
 */
export interface LevelInfo {
  /** Current level */
  level: number;
  /** Current XP */
  currentXP: number;
  /** XP needed for next level */
  nextLevelXP: number;
  /** Total XP earned all time */
  totalXP: number;
  /** Level title */
  title: string;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Cloudflare Worker environment
 */
export interface IDEAutomationEnv {
  // KV Namespaces
  CHAT_HISTORY: KVNamespace;
  CONTEXT_CACHE: KVNamespace;

  // D1 Database
  IDE_STATE: D1Database;

  // R2 Storage
  WORKSPACE_STORAGE: R2Bucket;

  // AI Bindings
  AI?: Ai;

  // API Keys (from secrets)
  DEEPSEEK_API_KEY?: string;
  ZHIPU_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  NVIDIA_API_KEY?: string;

  // Environment variables
  ENVIRONMENT: string;
  MAX_CONTEXT_TOKENS: string;
  MAX_HISTORY_MESSAGES: string;
  STREAM_CHUNK_SIZE: string;
}

/**
 * Request context passed through handlers
 */
export interface RequestContext {
  /** User ID from auth */
  userId: string;
  /** Workspace/Project ID */
  workspaceId: string;
  /** Session ID */
  sessionId?: string;
  /** Request timestamp */
  timestamp: number;
  /** Correlation ID for tracing */
  correlationId: string;
}
