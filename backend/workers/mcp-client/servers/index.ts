/**
 * MCP Server Integrations - Index
 *
 * Common MCP server implementations for StudyLoG.AI.
 *
 * This directory contains pre-configured integrations for popular MCP servers:
 *
 * - **Search**: Brave Search, Serper (Google Search)
 * - **Database**: PostgreSQL, MySQL, SQLite
 * - **Filesystem**: Local file access
 * - **GitHub**: Repository access
 *
 * Each integration exports:
 * - Server configuration
 * - Tool wrappers (for type-safe tool calls)
 * - Cost estimation helpers
 *
 * ### Cost Implications
 *
 * Different servers have different cost profiles:
 *
 * | Server | Latency | Token Cost | Direct Cost |
 * |--------|---------|------------|-------------|
 * | Brave Search | 100-300ms | Medium | Free tier available |
 * | Serper | 100-300ms | Medium | Paid API |
 * | PostgreSQL | 50-200ms | Low (depends on rows) | Free (self-hosted) |
 * | Filesystem | 10-50ms | High (large files) | Free |
 * | GitHub | 200-500ms | Medium | Free tier available |
 *
 * ### Usage Example
 *
 * ```typescript
 * import { braveSearch, serper } from './servers';
 *
 * const client = createMCPClient(['brave-search', 'serper'], [], {
 *   logging: true,
 * });
 *
 * // Search the web
 * const result = await client.callTool('brave-search', 'search', {
 *   query: 'latest AI news',
 *   count: 5,
 * });
 * ```
 *
 * @module mcp-client/servers
 */

// ============================================================================
// Search Server Integrations
// ============================================================================

/**
 * Brave Search MCP Server Configuration
 *
 * Brave Search provides web search results with privacy focus.
 *
 * ### Configuration
 *
 * Requires BRAVE_API_KEY environment variable.
 * Free tier: 2,000 requests/month
 *
 * ### Tools
 * - brave_search: Web search with query, count, offset
 * - brave_search_news: News-specific search
 *
 * ### Cost Profile
 * - Latency: 100-300ms
 * - Token usage: ~1000 tokens for 10 results
 * - Direct cost: Free (with rate limits)
 *
 * @see https://brave.com/search/api/
 */
export const braveSearch = {
  id: 'brave-search',
  name: 'Brave Search',
  transport: 'http' as const,
  endpoint: 'https://api.search.brave.com/res/v1/web/search',
  capabilities: { tools: true },
  timeout: 10000,
  costProfile: {
    latencyMs: 200,
    estimatedTokensPerResult: 100,
    directCostPerCall: 0,
    costCategory: 'low' as const,
  },
};

/**
 * Serper (Google Search) MCP Server Configuration
 *
 * Serper provides Google Search results via API.
 *
 * ### Configuration
 *
 * Requires SERPER_API_KEY environment variable.
 * Pricing: $5 per 2,500 queries (as of 2024)
 *
 * ### Tools
 * - google_search: Web search with query, num, page
 * - google_search_images: Image search
 *
 * ### Cost Profile
 * - Latency: 100-300ms
 * - Token usage: ~1000 tokens for 10 results
 * - Direct cost: ~$0.002 per query
 *
 * @see https://serper.dev/
 */
export const serper = {
  id: 'serper',
  name: 'Serper (Google Search)',
  transport: 'http' as const,
  endpoint: 'https://google.serper.dev/search',
  capabilities: { tools: true },
  timeout: 10000,
  costProfile: {
    latencyMs: 200,
    estimatedTokensPerResult: 100,
    directCostPerCall: 0.002, // ~$0.002 per query
    costCategory: 'low' as const,
  },
};

// ============================================================================
// Database Server Integrations
// ============================================================================

/**
 * PostgreSQL MCP Server Configuration
 *
 * PostgreSQL database access via MCP.
 *
 * ### Configuration
 *
 * Requires DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable.
 * Connection format: postgresql://user:password@host:port/database
 *
 * ### Tools
 * - query: Execute SQL query
 * - list_tables: List all tables
 * - describe_table: Get table schema
 *
 * ### Resources
 * - Database schema as resources
 * - Table data as resources
 *
 * ### Cost Profile
 * - Latency: 50-200ms (depends on query)
 * - Token usage: Proportional to result set size
 * - Direct cost: Free (self-hosted database)
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/postgres
 */
export const postgres = {
  id: 'postgres',
  name: 'PostgreSQL',
  transport: 'http' as const,
  endpoint: 'http://localhost:8080', // MCP postgres server
  capabilities: { tools: true, resources: true },
  timeout: 30000,
  costProfile: {
    latencyMs: 100,
    estimatedTokensPerRow: 50,
    directCostPerCall: 0,
    costCategory: 'low' as const,
  },
};

/**
 * MySQL MCP Server Configuration
 *
 * MySQL database access via MCP.
 *
 * ### Configuration
 *
 * Requires MYSQL_CONNECTION_STRING environment variable.
 * Connection format: mysql://user:password@host:port/database
 *
 * ### Tools
 * - query: Execute SQL query
 * - list_tables: List all tables
 * - describe_table: Get table schema
 *
 * ### Resources
 * - Database schema as resources
 * - Table data as resources
 *
 * ### Cost Profile
 * - Latency: 50-200ms (depends on query)
 * - Token usage: Proportional to result set size
 * - Direct cost: Free (self-hosted database)
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/mysql
 */
export const mysql = {
  id: 'mysql',
  name: 'MySQL',
  transport: 'http' as const,
  endpoint: 'http://localhost:8081', // MCP mysql server
  capabilities: { tools: true, resources: true },
  timeout: 30000,
  costProfile: {
    latencyMs: 100,
    estimatedTokensPerRow: 50,
    directCostPerCall: 0,
    costCategory: 'low' as const,
  },
};

/**
 * SQLite MCP Server Configuration
 *
 * SQLite database access via MCP (local file-based).
 *
 * ### Configuration
 *
 * Requires SQLITE_FILE_PATH environment variable.
 * Default: ./database.sqlite
 *
 * ### Tools
 * - query: Execute SQL query
 * - list_tables: List all tables
 * - describe_table: Get table schema
 *
 * ### Resources
 * - Database schema as resources
 * - Table data as resources
 *
 * ### Cost Profile
 * - Latency: 10-50ms (local file access)
 * - Token usage: Proportional to result set size
 * - Direct cost: Free
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite
 */
export const sqlite = {
  id: 'sqlite',
  name: 'SQLite',
  transport: 'stdio' as const,
  endpoint: 'mcp-server-sqlite', // Assumes npm package installed
  capabilities: { tools: true, resources: true },
  timeout: 5000,
  costProfile: {
    latencyMs: 30,
    estimatedTokensPerRow: 50,
    directCostPerCall: 0,
    costCategory: 'free' as const,
  },
};

// ============================================================================
// Filesystem Server Integration
// ============================================================================

/**
 * Filesystem MCP Server Configuration
 *
 * Local filesystem access via MCP.
 *
 * ### Configuration
 *
 * Requires FILESYSTEM_ROOT environment variable.
 * Default: Current working directory
 *
 * ### Tools
 * - read_file: Read file contents
 * - write_file: Write file contents
 * - list_directory: List directory contents
 * - get_file_info: Get file metadata
 *
 * ### Resources
 * - Files as resources (read-only)
 * - Directory listings as resources
 *
 * ### Security Considerations
 *
 * - Files outside the root path cannot be accessed
 * - Symbolic links are not followed by default
 * - Write operations should require explicit consent
 *
 * ### Cost Profile
 * - Latency: 10-50ms (local file access)
 * - Token usage: Proportional to file size
 * - Direct cost: Free
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem
 */
export const filesystem = {
  id: 'filesystem',
  name: 'Filesystem',
  transport: 'stdio' as const,
  endpoint: 'mcp-server-filesystem', // Assumes npm package installed
  capabilities: { tools: true, resources: true },
  timeout: 5000,
  costProfile: {
    latencyMs: 20,
    estimatedTokensPerKb: 250, // ~250 tokens per 1KB
    directCostPerCall: 0,
    costCategory: 'free' as const,
  },
};

// ============================================================================
// GitHub Server Integration
// ============================================================================

/**
 * GitHub MCP Server Configuration
 *
 * GitHub repository access via MCP.
 *
 * ### Configuration
 *
 * Requires GITHUB_TOKEN environment variable (personal access token).
 * Token scopes: repo, read:org
 *
 * ### Tools
 * - create_issue: Create a GitHub issue
 * - create_pull_request: Create a pull request
 * - fork_repository: Fork a repository
 * - push_files: Push files to a repository
 * - create_or_update_file: Create or update a file
 * - list_issues: List issues in a repository
 * - list_pull_requests: List pull requests
 *
 * ### Resources
 * - Repository contents
 * - Issue details
 * - PR details
 * - Repository metadata
 *
 * ### Cost Profile
 * - Latency: 200-500ms (GitHub API rate limiting)
 * - Token usage: Medium for file contents
 * - Direct cost: Free (GitHub has rate limits)
 *
 * ### Rate Limits
 *
 * - Authenticated requests: 5,000 requests/hour
 * - Unauthenticated requests: 60 requests/hour
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/github
 */
export const github = {
  id: 'github',
  name: 'GitHub',
  transport: 'stdio' as const,
  endpoint: 'mcp-server-github', // Assumes npm package installed
  capabilities: { tools: true, resources: true },
  timeout: 30000,
  costProfile: {
    latencyMs: 300,
    estimatedTokensPerFile: 500,
    directCostPerCall: 0,
    costCategory: 'medium' as const,
  },
};

// ============================================================================
// Memory Server Integration
// ============================================================================

/**
 * Memory MCP Server Configuration
 *
 * In-memory key-value store for conversation context.
 *
 * ### Configuration
 *
 * No environment variables required. Uses in-process storage.
 *
 * ### Tools
 * - set: Store a value
 * - get: Retrieve a value
 * - delete: Delete a value
 * - list: List all keys
 * - clear: Clear all values
 *
 * ### Resources
 * - Memory contents as resources
 *
 * ### Use Cases
 *
 * - Cross-message context persistence
 * - Temporary data storage
 * - Conversation state management
 *
 * ### Cost Profile
 * - Latency: <10ms (in-memory)
 * - Token usage: Low
 * - Direct cost: Free
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/memory
 */
export const memory = {
  id: 'memory',
  name: 'Memory',
  transport: 'stdio' as const,
  endpoint: 'mcp-server-memory', // Assumes npm package installed
  capabilities: { tools: true, resources: true },
  timeout: 1000,
  costProfile: {
    latencyMs: 5,
    estimatedTokensPerValue: 100,
    directCostPerCall: 0,
    costCategory: 'free' as const,
  },
};

// ============================================================================
// Sequential Thinking Server Integration
// ============================================================================

/**
 * Sequential Thinking MCP Server Configuration
 *
 * Multi-step reasoning with explicit thought tracking.
 *
 * ### Configuration
 *
 * No environment variables required.
 *
 * ### Prompts
 * - think: Generate step-by-step reasoning
 * - decompose: Break down complex problems
 * - verify: Check reasoning for errors
 *
 * ### Use Cases
 *
 * - Complex problem decomposition
 * - Multi-step reasoning
 * - Error checking in reasoning chains
 *
 * ### Cost Profile
 * - Latency: Depends on LLM used
 * - Token usage: High (each step is a separate prompt)
 * - Direct cost: Free (uses underlying LLM)
 *
 * @see https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking
 */
export const sequentialThinking = {
  id: 'sequential-thinking',
  name: 'Sequential Thinking',
  transport: 'stdio' as const,
  endpoint: 'mcp-server-sequential-thinking', // Assumes npm package installed
  capabilities: { prompts: true },
  timeout: 60000,
  costProfile: {
    latencyMs: 5000,
    estimatedTokensPerStep: 500,
    directCostPerCall: 0,
    costCategory: 'medium' as const,
  },
};

// ============================================================================
// Cost Estimation Utilities
// ============================================================================

/**
 * Cost profile for a server integration
 */
export interface ServerCostProfile {
  /** Average latency in milliseconds */
  latencyMs: number;
  /** Estimated tokens per result unit (row, file, etc.) */
  estimatedTokensPerResult?: number;
  /** Estimated tokens per row (for databases) */
  estimatedTokensPerRow?: number;
  /** Estimated tokens per KB (for filesystem) */
  estimatedTokensPerKb?: number;
  /** Estimated tokens per file (for GitHub) */
  estimatedTokensPerFile?: number;
  /** Estimated tokens per value (for memory) */
  estimatedTokensPerValue?: number;
  /** Estimated tokens per step (for sequential thinking) */
  estimatedTokensPerStep?: number;
  /** Direct cost per call in USD */
  directCostPerCall: number;
  /** Cost category */
  costCategory: 'free' | 'low' | 'medium' | 'high';
}

/**
 * Map of server IDs to cost profiles
 */
export const SERVER_COST_PROFILES: Record<string, ServerCostProfile> = {
  'brave-search': braveSearch.costProfile,
  'serper': serper.costProfile,
  'postgres': postgres.costProfile,
  'mysql': mysql.costProfile,
  'sqlite': sqlite.costProfile,
  'filesystem': filesystem.costProfile,
  'github': github.costProfile,
  'memory': memory.costProfile,
  'sequential-thinking': sequentialThinking.costProfile,
};

/**
 * Estimate the cost of a tool call
 *
 * @param serverId - Server ID
 * @param resultSize - Result size (rows, bytes, etc.)
 * @returns Estimated cost information
 */
export function estimateToolCallCost(
  serverId: string,
  resultSize: number
): {
  latencyMs: number;
  estimatedTokens: number;
  directCost: number;
  costCategory: string;
} {
  const profile = SERVER_COST_PROFILES[serverId];

  if (!profile) {
    return {
      latencyMs: 100,
      estimatedTokens: 1000,
      directCost: 0,
      costCategory: 'low',
    };
  }

  let estimatedTokens = 0;

  if (profile.estimatedTokensPerResult) {
    estimatedTokens = profile.estimatedTokensPerResult * resultSize;
  } else if (profile.estimatedTokensPerRow) {
    estimatedTokens = profile.estimatedTokensPerRow * resultSize;
  } else if (profile.estimatedTokensPerKb) {
    estimatedTokens = Math.ceil((resultSize / 1024) * profile.estimatedTokensPerKb);
  } else if (profile.estimatedTokensPerFile) {
    estimatedTokens = profile.estimatedTokensPerFile * resultSize;
  } else if (profile.estimatedTokensPerValue) {
    estimatedTokens = profile.estimatedTokensPerValue * resultSize;
  } else if (profile.estimatedTokensPerStep) {
    estimatedTokens = profile.estimatedTokensPerStep * resultSize;
  }

  return {
    latencyMs: profile.latencyMs,
    estimatedTokens,
    directCost: profile.directCostPerCall,
    costCategory: profile.costCategory,
  };
}

/**
 * Get the cost profile for a server
 *
 * @param serverId - Server ID
 * @returns Cost profile or undefined if not found
 */
export function getServerCostProfile(serverId: string): ServerCostProfile | undefined {
  return SERVER_COST_PROFILES[serverId];
}

/**
 * Get all available server integrations
 *
 * @returns Map of server ID to configuration
 */
export function getAllServerIntegrations(): Record<string, typeof braveSearch> {
  return {
    'brave-search': braveSearch,
    'serper': serper,
    'postgres': postgres,
    'mysql': mysql,
    'sqlite': sqlite,
    'filesystem': filesystem,
    'github': github,
    'memory': memory,
    'sequential-thinking': sequentialThinking,
  };
}

// ============================================================================
// Default exports
// ============================================================================

export default {
  // Search
  braveSearch,
  serper,

  // Database
  postgres,
  mysql,
  sqlite,

  // Filesystem
  filesystem,

  // GitHub
  github,

  // Memory
  memory,

  // Sequential thinking
  sequentialThinking,

  // Utilities
  estimateToolCallCost,
  getServerCostProfile,
  getAllServerIntegrations,
};
