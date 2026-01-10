/**
 * MCP Tool Wrappers
 *
 * Type-safe wrapper functions for common MCP tools.
 * These wrappers provide:
 * - Type-safe parameter passing
 * - Return type definitions
 * - Cost estimation
 * - Error handling
 *
 * ### Usage Example
 *
 * ```typescript
 * import { braveSearch, github } from './tools';
 * import { MCPClient } from '../client';
 *
 * const client = new MCPClient({ ... });
 * await client.connectAll();
 *
 * // Type-safe search
 * const results = await braveSearch(client, {
 *   query: 'latest AI news',
 *   count: 5,
 * });
 *
 * // Type-safe GitHub issue creation
 * const issue = await github.createIssue(client, {
 *   owner: 'studylog',
 *   repo: 'studylog-github',
 *   title: 'Bug: something is broken',
 *   body: 'Detailed description...',
 * });
 * ```
 *
 * @module mcp-client/servers/tools
 */

import type { MCPClient, MCPToolCallResponse, MCPToolCost } from '../client';
import type { MCPServerConfig, PreconfiguredMCPServer } from '../types';

// ============================================================================
// Common Tool Types
// ============================================================================

/**
 * Base options for tool calls
 */
export interface ToolCallOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry attempts */
  retries?: number;
  /** Cost tracking callback */
  onCost?: (cost: MCPToolCost) => void;
}

/**
 * Tool result with metadata
 */
export interface ToolResult<T = unknown> {
  /** Tool result data */
  data: T;
  /** Cost information */
  cost: MCPToolCost;
  /** Server that handled the call */
  serverId: string;
}

// ============================================================================
// Brave Search Tool Types
// ============================================================================

/**
 * Brave Search tool parameters
 */
export interface BraveSearchParams {
  /** Search query */
  query: string;
  /** Number of results (1-20, default 10) */
  count?: number;
  /** Offset for pagination */
  offset?: number;
  /** Search result freshness */
  freshness?: 'all' | 'wp' | 'pd' | 'pw' | 'py';
}

/**
 * Brave Search result item
 */
export interface BraveSearchResult {
  /** Result title */
  title: string;
  /** Result URL */
  url: string;
  /** Result description/snippet */
  description: string;
  /** Result publish date (if available) */
  publishedAt?: string;
  /** Result score/ranking */
  score?: number;
}

/**
 * Brave Search response
 */
export interface BraveSearchResponse {
  /** Web search results */
  web?: {
    /** Results array */
    results?: BraveSearchResult[];
  };
  /** Query performed */
  query?: {
    /** Original query text */
    original?: string;
    /** Parsed query */
    text?: string;
  };
}

// ============================================================================
// Serper Tool Types
// ============================================================================

/**
 * Serper (Google Search) tool parameters
 */
export interface SerperSearchParams {
  /** Search query */
  query: string;
  /** Number of results (1-100, default 10) */
  num?: number;
  /** Page number for pagination */
  page?: number;
  /** Search type */
  type?: 'search' | 'images' | 'news' | 'places';
}

/**
 * Serper search result item
 */
export interface SerperResult {
  /** Result title */
  title: string;
  /** Result link */
  link: string;
  /** Result snippet */
  snippet: string;
  /** Result image (if image search) */
  imageUrl?: string;
  /** Result position */
  position?: number;
}

/**
 * Serper search response
 */
export interface SerperResponse {
  /** Search results */
  organic?: SerperResult[];
  /** Related searches */
  peopleAlsoAsk?: Array<{ question: string; snippet: string; title: string; link: string }>;
  /** Query performed */
  searchParameters?: {
    q: string;
    type: string;
  };
}

// ============================================================================
// Database Tool Types
// ============================================================================

/**
 * Database query parameters
 */
export interface DBQueryParams {
  /** SQL query to execute */
  query: string;
  /** Query parameters for prepared statements */
  params?: unknown[];
  /** Row limit */
  limit?: number;
}

/**
 * Database query result
 */
export interface DBQueryResult {
  /** Query results (array of rows) */
  rows: Array<Record<string, unknown>>;
  /** Columns returned */
  columns?: string[];
  /** Rows affected (for INSERT/UPDATE/DELETE) */
  rowsAffected?: number;
}

/**
 * Table schema information
 */
export interface TableSchema {
  /** Table name */
  tableName: string;
  /** Column definitions */
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
    defaultValue?: unknown;
  }>;
}

// ============================================================================
// Filesystem Tool Types
// ============================================================================

/**
 * Read file parameters
 */
export interface ReadFileParams {
  /** File path (relative to root) */
  path: string;
}

/**
 * Read file result
 */
export interface ReadFileResult {
  /** File contents */
  content: string;
  /** File size in bytes */
  size: number;
  /** File MIME type (if detected) */
  mimeType?: string;
}

/**
 * Write file parameters
 */
export interface WriteFileParams {
  /** File path (relative to root) */
  path: string;
  /** File contents */
  content: string;
  /** Create directories if they don't exist */
  createParents?: boolean;
}

/**
 * List directory parameters
 */
export interface ListDirectoryParams {
  /** Directory path (relative to root) */
  path: string;
  /** Include hidden files */
  includeHidden?: boolean;
  /** Recursively list subdirectories */
  recursive?: boolean;
}

/**
 * Directory entry
 */
export interface DirectoryEntry {
  /** Entry name */
  name: string;
  /** Entry path */
  path: string;
  /** Entry type */
  type: 'file' | 'directory' | 'symlink';
  /** Size in bytes (files only) */
  size?: number;
  /** Last modified timestamp */
  modified?: number;
}

/**
 * List directory result
 */
export interface ListDirectoryResult {
  /** Directory entries */
  entries: DirectoryEntry[];
  /** Total entries count */
  count: number;
}

// ============================================================================
// GitHub Tool Types
// ============================================================================

/**
 * Create issue parameters
 */
export interface GitHubCreateIssueParams {
  /** Repository owner (user or org) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Issue title */
  title: string;
  /** Issue body/description */
  body?: string;
  /** Issue labels */
  labels?: string[];
  /** Assignees */
  assignees?: string[];
}

/**
 * GitHub issue
 */
export interface GitHubIssue {
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Issue state */
  state: 'open' | 'closed';
  /** Issue HTML URL */
  htmlUrl: string;
  /** Issue API URL */
  url: string;
  /** Issue body */
  body?: string;
  /** Issue labels */
  labels?: Array<{ name: string; color: string }>;
  /** Creation date */
  createdAt: string;
}

/**
 * Create pull request parameters
 */
export interface GitHubCreatePRParams {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** PR title */
  title: string;
  /** PR description */
  body?: string;
  /** Head branch (your branch) */
  head: string;
  /** Base branch (target branch) */
  base?: string;
}

/**
 * GitHub pull request
 */
export interface GitHubPullRequest {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR state */
  state: 'open' | 'closed' | 'merged';
  /** PR HTML URL */
  htmlUrl: string;
  /** Head branch */
  head: { ref: string; sha: string };
  /** Base branch */
  base: { ref: string; sha: string };
  /** Creation date */
  createdAt: string;
}

/**
 * Fork repository parameters
 */
export interface GitHubForkParams {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Fork organization (optional) */
  organization?: string;
}

/**
 * Fork result
 */
export interface GitHubForkResult {
  /** Fork HTML URL */
  htmlUrl: string;
  /** Fork name */
  name: string;
  /** Fork owner */
  owner: { login: string };
  /** Fork creation date */
  createdAt: string;
}

/**
 * List issues parameters
 */
export interface GitHubListIssuesParams {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Issue state filter */
  state?: 'open' | 'closed' | 'all';
  /** Limit results */
  limit?: number;
}

// ============================================================================
// Memory Tool Types
// ============================================================================

/**
 * Memory set parameters
 */
export interface MemorySetParams {
  /** Key to set */
  key: string;
  /** Value to store */
  value: string;
  /** Optional TTL in seconds */
  ttl?: number;
}

/**
 * Memory get parameters
 */
export interface MemoryGetParams {
  /** Key to retrieve */
  key: string;
}

/**
 * Memory list result
 */
export interface MemoryListResult {
  /** All stored key-value pairs */
  items: Array<{ key: string; value: string; expires?: number }>;
  /** Total count */
  count: number;
}

// ============================================================================
// Tool Wrapper Functions
// ============================================================================

/**
 * Call a tool on an MCP server with type safety
 *
 * Generic wrapper for calling any tool with proper error handling
 * and cost tracking.
 *
 * @param client - MCP client instance
 * @param serverId - Server ID
 * @param toolName - Tool name
 * @param params - Tool parameters
 * @param options - Call options
 * @returns Tool result with metadata
 */
async function callTool<T = unknown>(
  client: MCPClient,
  serverId: string,
  toolName: string,
  params?: Record<string, unknown>,
  options?: ToolCallOptions
): Promise<ToolResult<T>> {
  const timeout = options?.timeout || 30000;

  try {
    const response = await client.callTool(serverId, toolName, params);

    // Extract content
    let data: T;
    const textContent = response.content.find(c => c.type === 'text');
    if (textContent) {
      try {
        data = JSON.parse(textContent.text) as T;
      } catch {
        data = textContent.text as T;
      }
    } else {
      data = undefined as T;
    }

    // Call cost callback if provided
    if (options?.onCost && response._cost) {
      options.onCost(response._cost);
    }

    return {
      data,
      cost: response._cost || {
        latencyMs: 0,
        estimatedTokens: 0,
        directCost: 0,
        costCategory: 'free',
      },
      serverId,
    };
  } catch (error) {
    throw new Error(`Tool call failed: ${toolName} - ${(error as Error).message}`);
  }
}

// ============================================================================
// Brave Search Wrapper
// ============================================================================

/**
 * Perform a web search using Brave Search
 *
 * ### Cost Implications
 * - Latency: ~200ms
 * - Token usage: ~1000 tokens for 10 results
 * - Direct cost: Free (with rate limits)
 *
 * @param client - MCP client instance
 * @param params - Search parameters
 * @param options - Call options
 * @returns Search results with metadata
 */
export async function braveSearch(
  client: MCPClient,
  params: BraveSearchParams,
  options?: ToolCallOptions
): Promise<ToolResult<BraveSearchResponse>> {
  return callTool<BraveSearchResponse>(
    client,
    'brave-search',
    'search',
    params,
    options
  );
}

// ============================================================================
// Serper Wrapper
// ============================================================================

/**
 * Perform a web search using Serper (Google Search)
 *
 * ### Cost Implications
 * - Latency: ~200ms
 * - Token usage: ~1000 tokens for 10 results
 * - Direct cost: ~$0.002 per query
 *
 * @param client - MCP client instance
 * @param params - Search parameters
 * @param options - Call options
 * @returns Search results with metadata
 */
export async function serper(
  client: MCPClient,
  params: SerperSearchParams,
  options?: ToolCallOptions
): Promise<ToolResult<SerperResponse>> {
  return callTool<SerperResponse>(
    client,
    'serper',
    'google_search',
    params,
    options
  );
}

// ============================================================================
// Database Wrappers
// ============================================================================

/**
 * Execute a SQL query on PostgreSQL
 *
 * ### Cost Implications
 * - Latency: ~100ms (depends on query)
 * - Token usage: ~50 tokens per row returned
 * - Direct cost: Free
 *
 * @param client - MCP client instance
 * @param params - Query parameters
 * @param options - Call options
 * @returns Query results with metadata
 */
export async function postgresQuery(
  client: MCPClient,
  params: DBQueryParams,
  options?: ToolCallOptions
): Promise<ToolResult<DBQueryResult>> {
  return callTool<DBQueryResult>(
    client,
    'postgres',
    'query',
    params,
    options
  );
}

/**
 * Execute a SQL query on MySQL
 *
 * @param client - MCP client instance
 * @param params - Query parameters
 * @param options - Call options
 * @returns Query results with metadata
 */
export async function mysqlQuery(
  client: MCPClient,
  params: DBQueryParams,
  options?: ToolCallOptions
): Promise<ToolResult<DBQueryResult>> {
  return callTool<DBQueryResult>(
    client,
    'mysql',
    'query',
    params,
    options
  );
}

/**
 * Execute a SQL query on SQLite
 *
 * @param client - MCP client instance
 * @param params - Query parameters
 * @param options - Call options
 * @returns Query results with metadata
 */
export async function sqliteQuery(
  client: MCPClient,
  params: DBQueryParams,
  options?: ToolCallOptions
): Promise<ToolResult<DBQueryResult>> {
  return callTool<DBQueryResult>(
    client,
    'sqlite',
    'query',
    params,
    options
  );
}

/**
 * Get table schema from database
 *
 * @param client - MCP client instance
 * @param serverId - Server ID (postgres, mysql, sqlite)
 * @param tableName - Table name
 * @param options - Call options
 * @returns Table schema with metadata
 */
export async function getTableSchema(
  client: MCPClient,
  serverId: 'postgres' | 'mysql' | 'sqlite',
  tableName: string,
  options?: ToolCallOptions
): Promise<ToolResult<TableSchema>> {
  return callTool<TableSchema>(
    client,
    serverId,
    'describe_table',
    { table: tableName },
    options
  );
}

// ============================================================================
// Filesystem Wrappers
// ============================================================================

/**
 * Read a file from the filesystem
 *
 * ### Cost Implications
 * - Latency: ~20ms
 * - Token usage: ~250 tokens per 1KB
 * - Direct cost: Free
 *
 * ### Security Considerations
 * - Files outside the configured root cannot be accessed
 * - Large files should be read in chunks when possible
 *
 * @param client - MCP client instance
 * @param params - File path
 * @param options - Call options
 * @returns File contents with metadata
 */
export async function readFile(
  client: MCPClient,
  params: ReadFileParams,
  options?: ToolCallOptions
): Promise<ToolResult<ReadFileResult>> {
  return callTool<ReadFileResult>(
    client,
    'filesystem',
    'read_file',
    params,
    options
  );
}

/**
 * Write a file to the filesystem
 *
 * ### Security Considerations
 * - Overwrites existing files without warning
 * - Creates parent directories if createParents is true
 *
 * @param client - MCP client instance
 * @param params - File path and contents
 * @param options - Call options
 * @returns Write result with metadata
 */
export async function writeFile(
  client: MCPClient,
  params: WriteFileParams,
  options?: ToolCallOptions
): Promise<ToolResult<{ success: boolean; path: string }>> {
  return callTool<{ success: boolean; path: string }>(
    client,
    'filesystem',
    'write_file',
    params,
    options
  );
}

/**
 * List directory contents
 *
 * @param client - MCP client instance
 * @param params - Directory path and options
 * @param options - Call options
 * @returns Directory listing with metadata
 */
export async function listDirectory(
  client: MCPClient,
  params: ListDirectoryParams,
  options?: ToolCallOptions
): Promise<ToolResult<ListDirectoryResult>> {
  return callTool<ListDirectoryResult>(
    client,
    'filesystem',
    'list_directory',
    params,
    options
  );
}

// ============================================================================
// GitHub Wrappers
// ============================================================================

/**
 * Create a GitHub issue
 *
 * ### Cost Implications
 * - Latency: ~300ms (GitHub API rate limiting)
 * - Token usage: ~500 tokens
 * - Direct cost: Free (5,000 requests/hour authenticated)
 *
 * @param client - MCP client instance
 * @param params - Issue details
 * @param options - Call options
 * @returns Created issue with metadata
 */
export async function createGitHubIssue(
  client: MCPClient,
  params: GitHubCreateIssueParams,
  options?: ToolCallOptions
): Promise<ToolResult<GitHubIssue>> {
  return callTool<GitHubIssue>(
    client,
    'github',
    'create_issue',
    params,
    options
  );
}

/**
 * Create a GitHub pull request
 *
 * @param client - MCP client instance
 * @param params - PR details
 * @param options - Call options
 * @returns Created PR with metadata
 */
export async function createGitHubPR(
  client: MCPClient,
  params: GitHubCreatePRParams,
  options?: ToolCallOptions
): Promise<ToolResult<GitHubPullRequest>> {
  return callTool<GitHubPullRequest>(
    client,
    'github',
    'create_pull_request',
    params,
    options
  );
}

/**
 * Fork a GitHub repository
 *
 * @param client - MCP client instance
 * @param params - Repository to fork
 * @param options - Call options
 * @returns Fork result with metadata
 */
export async function forkGitHubRepo(
  client: MCPClient,
  params: GitHubForkParams,
  options?: ToolCallOptions
): Promise<ToolResult<GitHubForkResult>> {
  return callTool<GitHubForkResult>(
    client,
    'github',
    'fork_repository',
    params,
    options
  );
}

/**
 * List GitHub issues
 *
 * @param client - MCP client instance
 * @param params - Repository and filter
 * @param options - Call options
 * @returns Issues list with metadata
 */
export async function listGitHubIssues(
  client: MCPClient,
  params: GitHubListIssuesParams,
  options?: ToolCallOptions
): Promise<ToolResult<GitHubIssue[]>> {
  return callTool<GitHubIssue[]>(
    client,
    'github',
    'list_issues',
    params,
    options
  );
}

// ============================================================================
// Memory Wrappers
// ============================================================================

/**
 * Store a value in memory
 *
 * ### Cost Implications
 * - Latency: ~5ms (in-memory)
 * - Token usage: ~100 tokens per value
 * - Direct cost: Free
 *
 * @param client - MCP client instance
 * @param params - Key and value
 * @param options - Call options
 * @returns Storage result with metadata
 */
export async function memorySet(
  client: MCPClient,
  params: MemorySetParams,
  options?: ToolCallOptions
): Promise<ToolResult<{ success: boolean; key: string }>> {
  return callTool<{ success: boolean; key: string }>(
    client,
    'memory',
    'set',
    params,
    options
  );
}

/**
 * Retrieve a value from memory
 *
 * @param client - MCP client instance
 * @param params - Key to retrieve
 * @param options - Call options
 * @returns Value with metadata
 */
export async function memoryGet(
  client: MCPClient,
  params: MemoryGetParams,
  options?: ToolCallOptions
): Promise<ToolResult<{ value: string | null }>> {
  return callTool<{ value: string | null }>(
    client,
    'memory',
    'get',
    params,
    options
  );
}

/**
 * List all values in memory
 *
 * @param client - MCP client instance
 * @param options - Call options
 * @returns All values with metadata
 */
export async function memoryList(
  client: MCPClient,
  options?: ToolCallOptions
): Promise<ToolResult<MemoryListResult>> {
  return callTool<MemoryListResult>(
    client,
    'memory',
    'list',
    {},
    options
  );
}

/**
 * Clear all values in memory
 *
 * @param client - MCP client instance
 * @param options - Call options
 * @returns Clear result with metadata
 */
export async function memoryClear(
  client: MCPClient,
  options?: ToolCallOptions
): Promise<ToolResult<{ success: boolean }>> {
  return callTool<{ success: boolean }>(
    client,
    'memory',
    'clear',
    {},
    options
  );
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Search
  braveSearch,
  serper,

  // Database
  postgresQuery,
  mysqlQuery,
  sqliteQuery,
  getTableSchema,

  // Filesystem
  readFile,
  writeFile,
  listDirectory,

  // GitHub
  createGitHubIssue,
  createGitHubPR,
  forkGitHubRepo,
  listGitHubIssues,

  // Memory
  memorySet,
  memoryGet,
  memoryList,
  memoryClear,
};

// Re-export types
export type {
  // Common
  ToolCallOptions,
  ToolResult,

  // Search
  BraveSearchParams,
  BraveSearchResponse,
  BraveSearchResult,
  SerperSearchParams,
  SerperResponse,
  SerperResult,

  // Database
  DBQueryParams,
  DBQueryResult,
  TableSchema,

  // Filesystem
  ReadFileParams,
  ReadFileResult,
  WriteFileParams,
  ListDirectoryParams,
  ListDirectoryResult,
  DirectoryEntry,

  // GitHub
  GitHubCreateIssueParams,
  GitHubIssue,
  GitHubCreatePRParams,
  GitHubPullRequest,
  GitHubForkParams,
  GitHubForkResult,
  GitHubListIssuesParams,

  // Memory
  MemorySetParams,
  MemoryGetParams,
  MemoryListResult,
};

// Re-export MCPClient for convenience
export type { MCPClient } from '../client';
