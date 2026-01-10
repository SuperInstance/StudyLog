/**
 * MCP Router - Type Definitions
 *
 * The MCP Router is responsible for intelligently routing agent requests
 * to the appropriate MCP tools based on intent, availability, and cost.
 *
 * ### How MCP Extends Agent Capabilities
 *
 * The router acts as a bridge between agents and the external tool ecosystem:
 *
 * ```
 * Agent Request
 *    ↓
 * [Intent Classification]
 *    ↓
 * [Tool Discovery] → Query all MCP servers for available tools
 *    ↓
 * [Tool Selection] → Score tools by relevance, cost, availability
 *    ↓
 * [Execution] → Call selected tool, handle errors, retry
 *    ↓
 * [Result Processing] → Format result for agent consumption
 *    ↓
 * Agent receives structured result with cost metadata
 * ```
 *
 * ### Tool Selection Strategy
 *
 * The router uses a multi-factor scoring algorithm:
 *
 * 1. **Intent Match** (0-0.8): How well the tool matches the user's intent
 *    - Exact name match: 0.8
 *    - Partial name match: 0.5
 *    - Description keyword match: 0.1 per keyword
 *
 * 2. **Cost Score** (0-0.2): Lower cost tools score higher
 *    - Free tools: 0.2
 *    - Low cost: 0.15
 *    - Medium cost: 0.1
 *    - High cost: 0.05
 *
 * 3. **Performance Score** (0-0.2): Faster tools score higher
 *    - <50ms: 0.2
 *    - <200ms: 0.15
 *    - <500ms: 0.1
 *    - >=500ms: 0.05
 *
 * 4. **Reliability Score** (0-0.1): Tools with lower error rates score higher
 *    - <1% error rate: 0.1
 *    - <5% error rate: 0.05
 *    - >=5% error rate: 0
 *
 * ### Cost Implications of MCP Calls
 *
 * The router tracks costs at multiple levels:
 *
 * 1. **Network Latency**: Each MCP call adds round-trip time
 *    - HTTP/WebSocket transport: 50-500ms typical
 *    - stdio transport (local): 10-50ms
 *
 * 2. **Token Usage**: Tool results count as input tokens
 *    - Search results: ~1000 tokens for 10 results
 *    - File reads: ~250 tokens per 1KB
 *    - Database queries: ~50 tokens per row
 *
 * 3. **Direct API Costs**: Some MCP servers charge for access
 *    - Example: Serper charges ~$0.002 per search query
 *
 * 4. **Error Costs**: Retries waste tokens and time
 *    - Implement exponential backoff
 *    - Circuit breakers for failing servers
 *
 * The router uses cost estimates to:
 * - Select the most cost-effective tool for a given intent
 * - Budget tool calls based on user tier
 * - Provide transparency about tool usage costs
 */

// ============================================================================
// Router Configuration
// ============================================================================

/**
 * MCP Router configuration
 */
export interface MCPRouterConfig {
  /** Maximum time to wait for tool execution (ms) */
  defaultTimeout?: number;
  /** Maximum number of retry attempts for failed calls */
  maxRetries?: number;
  /** Enable request/response logging */
  logging?: boolean;
  /** Enable cost tracking */
  costTracking?: boolean;
  /** Maximum budget per session (USD) */
  maxSessionBudget?: number;
  /** Default cost category limit */
  maxCostCategory?: 'free' | 'low' | 'medium' | 'high';
}

/**
 * Server connection configuration
 */
export interface MCPServerConnectionConfig {
  /** Server ID */
  id: string;
  /** Server name */
  name: string;
  /** Transport type */
  transport: 'stdio' | 'http' | 'websocket';
  /** Server endpoint */
  endpoint: string;
  /** Optional API key */
  apiKey?: string;
  /** Connection timeout (ms) */
  timeout?: number;
}

// ============================================================================
// Intent Types
// ============================================================================

/**
 * User intent classification for tool selection
 *
 * The router classifies user requests into these intents to match
 * with appropriate tools.
 */
export type MCPIntent =
  | 'search'           // Web search, documentation lookup
  | 'database-query'   // Database operations
  | 'file-read'        // Reading file contents
  | 'file-write'       // Writing files
  | 'file-list'        // Listing directory contents
  | 'github-issue'     // Creating GitHub issues
  | 'github-pr'        // Creating pull requests
  | 'github-fork'      // Forking repositories
  | 'github-list'      // Listing GitHub resources
  | 'memory-set'       // Storing values in memory
  | 'memory-get'       // Retrieving values from memory
  | 'api-call'         // Generic HTTP API calls
  | 'computation'      // Math, data processing
  | 'unknown';         // Unable to classify

/**
 * Intent classification result
 */
export interface IntentClassification {
  /** Classified intent */
  intent: MCPIntent;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for classification */
  reasoning: string;
  /** Extracted parameters from query */
  parameters?: Record<string, unknown>;
}

// ============================================================================
// Tool Selection Types
// ============================================================================

/**
 * Tool selection result
 */
export interface ToolSelection {
  /** Selected tool name */
  toolName: string;
  /** Server providing the tool */
  serverId: string;
  /** Match score (0-1) */
  score: number;
  /** Selection reasoning */
  reason: string;
  /** Estimated cost */
  estimatedCost: CostEstimate;
}

/**
 * Cost estimate for a tool call
 */
export interface CostEstimate {
  /** Estimated latency in milliseconds */
  latencyMs: number;
  /** Estimated token count for result */
  estimatedTokens: number;
  /** Direct API cost in USD */
  directCost: number;
  /** Cost category */
  costCategory: 'free' | 'low' | 'medium' | 'high';
}

/**
 * Tool request from agent
 */
export interface ToolRequest {
  /** User query/message */
  query: string;
  /** Agent making the request */
  agentId: string;
  /** User ID for budget tracking */
  userId?: string;
  /** User tier (affects budget limits) */
  userTier?: 'free' | 'forge' | 'studio' | 'lab';
  /** Preferred server (if any) */
  preferredServerId?: string;
  /** Preferred tool (if any) */
  preferredToolName?: string;
  /** Maximum cost category */
  maxCostCategory?: 'free' | 'low' | 'medium' | 'high';
  /** Request context */
  context?: {
    module?: string;
    currentFile?: string;
    openFiles?: string[];
    selection?: {
      file: string;
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
}

/**
 * Tool response to agent
 */
export interface ToolResponse {
  /** Tool result data */
  data: unknown;
  /** Tool that was called */
  toolName: string;
  /** Server that handled the call */
  serverId: string;
  /** Actual cost information */
  actualCost: CostEstimate;
  /** Whether result was cached */
  cached: boolean;
  /** Response timestamp */
  timestamp: number;
}

// ============================================================================
// Router State Types
// ============================================================================

/**
 * Server health status
 */
export interface ServerHealth {
  /** Server ID */
  serverId: string;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'error';
  /** Last successful call timestamp */
  lastSuccess?: number;
  /** Last failure timestamp */
  lastFailure?: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** Total calls made */
  totalCalls: number;
  /** Failed calls */
  failedCalls: number;
}

/**
 * Session cost tracking
 */
export interface SessionCosts {
  /** Total cost in USD */
  totalCost: number;
  /** Total tokens used */
  totalTokens: number;
  /** Total latency (ms) */
  totalLatency: number;
  /** Tool call counts */
  toolCalls: Record<string, number>;
  /** Server call counts */
  serverCalls: Record<string, number>;
  /** Cost by category */
  costByCategory: Record<string, number>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Router error types
 */
export type MCPRouterErrorType =
  | 'no_tools_available'
  | 'tool_not_found'
  | 'tool_execution_failed'
  | 'cost_limit_exceeded'
  | 'timeout'
  | 'server_unavailable'
  | 'invalid_request';

/**
 * Router error
 */
export interface MCPRouterError extends Error {
  /** Error type */
  type: MCPRouterErrorType;
  /** Tool name (if applicable) */
  toolName?: string;
  /** Server ID (if applicable) */
  serverId?: string;
  /** Original error */
  cause?: Error;
}

/**
 * Create a router error
 */
export function createRouterError(
  type: MCPRouterErrorType,
  message: string,
  cause?: Error,
  toolName?: string,
  serverId?: string
): MCPRouterError {
  const error = new Error(message) as MCPRouterError;
  error.name = 'MCPRouterError';
  error.type = type;
  error.cause = cause;
  error.toolName = toolName;
  error.serverId = serverId;
  return error;
}

// ============================================================================
// Tool Metadata
// ============================================================================

/**
 * Tool metadata for routing decisions
 */
export interface ToolMetadata {
  /** Tool name */
  name: string;
  /** Server ID */
  serverId: string;
  /** Tool description */
  description: string;
  /** Supported intents */
  intents: MCPIntent[];
  /** Cost estimate */
  cost: CostEstimate;
  /** Average latency (ms) */
  avgLatency: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Whether tool is currently available */
  available: boolean;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry for tool results
 */
export interface CacheEntry {
  /** Tool result data */
  data: unknown;
  /** Timestamp when cached */
  timestamp: number;
  /** Time to live (ms) */
  ttl: number;
  /** Cost when cached */
  cost: CostEstimate;
}

/**
 * Cache key for tool calls
 */
export interface CacheKey {
  /** Server ID */
  serverId: string;
  /** Tool name */
  toolName: string;
  /** Parameters hash */
  paramsHash: string;
}
