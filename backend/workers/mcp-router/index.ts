/**
 * MCP Router - Implementation
 *
 * Routes agent requests to appropriate MCP tools based on intent,
 * availability, and cost optimization.
 *
 * ### Architecture Overview
 *
 * The MCP Router is the central coordinator for all MCP tool usage in
 * StudyLoG.AI. It sits between agents and the MCP client, providing:
 *
 * 1. **Intent Classification**: Understanding what the agent wants to do
 * 2. **Tool Discovery**: Finding available tools across all MCP servers
 * 3. **Tool Selection**: Choosing the best tool based on cost and capability
 * 4. **Execution**: Calling the tool with error handling and retries
 * 5. **Cost Tracking**: Monitoring and budgeting tool usage
 *
 * ### Request Flow
 *
 * ```
 * Agent Request → Router → Intent Classifier
 *                      ↓
 *                 Tool Discovery (query all servers)
 *                      ↓
 *                 Tool Selection (score by cost/relevance)
 *                      ↓
 *                 Execution (call with retry)
 *                      ↓
 *                 Response (with cost metadata)
 * ```
 *
 * ### Tool Selection Strategy
 *
 * Tools are scored based on four factors:
 *
 * 1. **Intent Match** (0-0.8): Semantic similarity to user intent
 * 2. **Cost Score** (0-0.2): Inverse of direct and token costs
 * 3. **Performance Score** (0-0.2): Inverse of latency
 * 4. **Reliability Score** (0-0.1): Inverse of error rate
 *
 * The highest-scoring tool within budget constraints is selected.
 *
 * ### Cost Implications
 *
 * The router helps manage costs by:
 * - Selecting the cheapest tool for a given intent
 * - Enforcing per-session and per-user budgets
 * - Caching results when appropriate
 * - Providing cost estimates before execution
 *
 * @see https://modelcontextprotocol.io
 */

import type {
  MCPClient,
  MCPTool,
  MCPToolCallResponse,
  MCPToolCost,
} from '../mcp-client/client';
import type {
  MCPRouterConfig,
  ToolRequest,
  ToolResponse,
  MCPIntent,
  IntentClassification,
  ToolSelection,
  CostEstimate,
  ServerHealth,
  SessionCosts,
  MCPRouterError,
  MCPRouterErrorType,
  ToolMetadata,
  CacheEntry,
} from './types';
import { createRouterError } from './types';

// ============================================================================
// Cost Categories and Budgets
// ============================================================================

/**
 * Budget limits by user tier (USD per session)
 */
const BUDGET_LIMITS: Record<string, number> = {
  free: 0.10,      // $0.10 per session for free users
  forge: 0.50,     // $0.50 per session for Forge tier
  studio: 2.00,    // $2.00 per session for Studio tier
  lab: 10.00,      // $10.00 per session for Lab tier
};

/**
 * Maximum cost category by user tier
 */
const COST_CATEGORY_LIMITS: Record<string, Array<'free' | 'low' | 'medium' | 'high'>> = {
  free: ['free', 'low'],
  forge: ['free', 'low', 'medium'],
  studio: ['free', 'low', 'medium', 'high'],
  lab: ['free', 'low', 'medium', 'high'],
};

// ============================================================================
// Intent Classification
// ============================================================================

/**
 * Classify user intent from query
 *
 * Uses keyword matching and heuristics to determine what the user
 * wants to accomplish. This maps to tool selection.
 *
 * ### Intent Detection Strategy
 *
 * - Search: Keywords like "search", "find", "look up"
 * - Database: Keywords like "query", "select", "database"
 * - File operations: Keywords like "read", "write", "file"
 * - GitHub: Keywords like "issue", "PR", "fork", "repo"
 * - Memory: Keywords like "remember", "store", "save"
 *
 * @param query - User query text
 * @returns Intent classification with confidence
 */
export function classifyIntent(query: string): IntentClassification {
  const normalized = query.toLowerCase();

  // Check for search intent
  if (/search|find|look up|google|brave|serper/i.test(query)) {
    return {
      intent: 'search',
      confidence: 0.9,
      reasoning: 'Search keywords detected in query',
    };
  }

  // Check for database intent
  if (/query|select|insert|update|delete|database|table|sql/i.test(query)) {
    return {
      intent: 'database-query',
      confidence: 0.85,
      reasoning: 'Database operation keywords detected',
    };
  }

  // Check for file read intent
  if (/read file|open file|file contents|what's in|cat /i.test(query)) {
    return {
      intent: 'file-read',
      confidence: 0.9,
      reasoning: 'File read keywords detected',
    };
  }

  // Check for file write intent
  if (/write file|save file|create file|modify file/i.test(query)) {
    return {
      intent: 'file-write',
      confidence: 0.9,
      reasoning: 'File write keywords detected',
    };
  }

  // Check for file list intent
  if (/list file|directory|ls |what files/i.test(query)) {
    return {
      intent: 'file-list',
      confidence: 0.85,
      reasoning: 'File list keywords detected',
    };
  }

  // Check for GitHub issue intent
  if (/create issue|github issue|report bug|open issue/i.test(query)) {
    return {
      intent: 'github-issue',
      confidence: 0.9,
      reasoning: 'GitHub issue keywords detected',
    };
  }

  // Check for GitHub PR intent
  if (/create pr|pull request|merge code/i.test(query)) {
    return {
      intent: 'github-pr',
      confidence: 0.9,
      reasoning: 'Pull request keywords detected',
    };
  }

  // Check for GitHub fork intent
  if (/fork repo|fork repository/i.test(query)) {
    return {
      intent: 'github-fork',
      confidence: 0.9,
      reasoning: 'Fork repository keywords detected',
    };
  }

  // Check for GitHub list intent
  if (/list issues|list pr|show issues/i.test(query)) {
    return {
      intent: 'github-list',
      confidence: 0.85,
      reasoning: 'GitHub list keywords detected',
    };
  }

  // Check for memory store intent
  if (/remember|store|save this|keep in mind/i.test(query)) {
    return {
      intent: 'memory-set',
      confidence: 0.8,
      reasoning: 'Memory storage keywords detected',
    };
  }

  // Check for memory retrieve intent
  if (/recall|what did i|retrieve|get from memory/i.test(query)) {
    return {
      intent: 'memory-get',
      confidence: 0.8,
      reasoning: 'Memory retrieval keywords detected',
    };
  }

  // Check for API call intent
  if (/api|fetch|http request|curl|endpoint/i.test(query)) {
    return {
      intent: 'api-call',
      confidence: 0.8,
      reasoning: 'API call keywords detected',
    };
  }

  // Check for computation intent
  if (/calculate|compute|math|add|subtract|multiply|divide/i.test(query)) {
    return {
      intent: 'computation',
      confidence: 0.8,
      reasoning: 'Computation keywords detected',
    };
  }

  // Default: unknown intent
  return {
    intent: 'unknown',
    confidence: 0.2,
    reasoning: 'No specific intent detected',
  };
}

/**
 * Map intent to compatible tools
 *
 * Returns the tool names that can handle a given intent.
 */
function getIntentToolMap(): Record<MCPIntent, string[]> {
  return {
    'search': ['search', 'brave_search', 'google_search', 'web_search'],
    'database-query': ['query', 'execute_query', 'db_query'],
    'file-read': ['read_file', 'read', 'file_read'],
    'file-write': ['write_file', 'write', 'file_write'],
    'file-list': ['list_directory', 'list_files', 'dir', 'ls'],
    'github-issue': ['create_issue', 'github_create_issue'],
    'github-pr': ['create_pull_request', 'create_pr', 'github_create_pr'],
    'github-fork': ['fork_repository', 'fork_repo'],
    'github-list': ['list_issues', 'list_prs', 'github_list'],
    'memory-set': ['memory_set', 'set', 'store'],
    'memory-get': ['memory_get', 'get', 'recall'],
    'api-call': ['http_request', 'fetch', 'api_call'],
    'computation': ['calculate', 'compute', 'eval'],
    'unknown': [],
  };
}

// ============================================================================
// MCP Router Implementation
// ============================================================================

/**
 * MCP Router for intelligent tool routing
 *
 * Orchestrates tool discovery, selection, and execution across
 * multiple MCP servers with cost optimization.
 */
export class MCPRouter {
  private config: Required<MCPRouterConfig>;
  private client: MCPClient;
  private serverHealth: Map<string, ServerHealth> = new Map();
  private sessionCosts: Map<string, SessionCosts> = new Map();
  private toolCache: Map<string, CacheEntry> = new Map();
  private toolMetadata: Map<string, ToolMetadata> = new Map();

  constructor(client: MCPClient, config: MCPRouterConfig = {}) {
    this.client = client;
    this.config = {
      defaultTimeout: config.defaultTimeout || 30000,
      maxRetries: config.maxRetries || 3,
      logging: config.logging !== false,
      costTracking: config.costTracking !== false,
      maxSessionBudget: config.maxSessionBudget || 1.0,
      maxCostCategory: config.maxCostCategory || 'medium',
    };
  }

  /**
   * Route a tool request to the appropriate tool
   *
   * Main entry point for agents to request tool execution.
   *
   * ### Routing Flow
   *
   * 1. Classify intent from user query
   * 2. Discover available tools
   * 3. Score tools by relevance, cost, performance
   * 4. Filter by budget and user tier constraints
   * 5. Execute selected tool
   * 6. Track costs and update metadata
   *
   * ### Cost Implications
   *
   * - **Intent classification**: No cost (local processing)
   * - **Tool discovery**: Network round-trip to each server
   * - **Tool execution**: Variable (see server cost profiles)
   * - **Total latency**: discovery + selection + execution
   *
   * @param request - Tool request from agent
   * @returns Tool response with cost metadata
   * @throws MCPRouterError if no tool available or execution fails
   */
  async route(request: ToolRequest): Promise<ToolResponse> {
    const startTime = Date.now();

    if (this.config.logging) {
      console.log('[MCP Router] Routing request:', {
        query: request.query,
        agentId: request.agentId,
        userId: request.userId,
      });
    }

    // 1. Classify intent
    const classification = classifyIntent(request.query);

    if (this.config.logging) {
      console.log('[MCP Router] Intent classification:', classification);
    }

    // 2. Get available tools
    const allTools = await this.discoverTools();

    if (allTools.length === 0) {
      throw createRouterError(
        'no_tools_available',
        'No MCP tools available. Check server connections.'
      );
    }

    // 3. Select best tool
    const selection = await this.selectTool(
      allTools,
      classification,
      request
    );

    if (!selection) {
      throw createRouterError(
        'tool_not_found',
        `No suitable tool found for intent: ${classification.intent}`
      );
    }

    if (this.config.logging) {
      console.log('[MCP Router] Tool selection:', selection);
    }

    // 4. Check budget constraints
    const userId = request.userId || 'anonymous';
    await this.checkBudget(userId, selection.estimatedCost);

    // 5. Execute tool
    const response = await this.executeTool(
      selection.serverId,
      selection.toolName,
      this.extractParameters(request.query, classification),
      request
    );

    // 6. Update cost tracking
    if (this.config.costTracking) {
      this.trackCost(userId, selection.serverId, selection.toolName, response.actualCost);
    }

    // 7. Update tool metadata
    this.updateToolMetadata(selection.toolName, selection.serverId, response.actualCost);

    const totalLatency = Date.now() - startTime;

    if (this.config.logging) {
      console.log('[MCP Router] Request complete:', {
        toolName: selection.toolName,
        serverId: selection.serverId,
        latency: totalLatency,
        cost: response.actualCost,
      });
    }

    return response;
  }

  /**
   * Discover all available tools from connected MCP servers
   *
   * ### Cost Implications
   *
   * - Network latency: One round-trip per connected server
   * - Token usage: Minimal (tool metadata is small)
   * - Caching: Tools list cached until server signals changes
   *
   * @returns Array of available tools with server info
   */
  async discoverTools(): Promise<Array<MCPTool & { _serverId: string }>> {
    try {
      return await this.client.getAllTools();
    } catch (error) {
      if (this.config.logging) {
        console.error('[MCP Router] Tool discovery failed:', error);
      }
      return [];
    }
  }

  /**
   * Select the best tool for a given intent and request
   *
   * Implements the multi-factor scoring algorithm considering:
   * - Intent relevance (name match, description keywords)
   * - Cost (free tools preferred)
   * - Performance (faster tools preferred)
   * - Reliability (lower error rate preferred)
   *
   * @param tools - Available tools
   * @param classification - Intent classification
   * @param request - Tool request with constraints
   * @returns Best tool selection or null
   */
  async selectTool(
    tools: Array<MCPTool & { _serverId: string }>,
    classification: IntentClassification,
    request: ToolRequest
  ): Promise<ToolSelection | null> {
    if (tools.length === 0) {
      return null;
    }

    // Check for preferred tool
    if (request.preferredToolName && request.preferredServerId) {
      const preferred = tools.find(
        t => t.name === request.preferredToolName && t._serverId === request.preferredServerId
      );
      if (preferred) {
        return {
          toolName: preferred.name,
          serverId: preferred._serverId,
          score: 1.0,
          reason: 'User preferred tool',
          estimatedCost: this.estimateToolCost(preferred),
        };
      }
    }

    // Score all tools
    const scored = tools.map(tool => {
      const score = this.scoreTool(tool, classification, request);
      const estimatedCost = this.estimateToolCost(tool);

      return {
        toolName: tool.name,
        serverId: tool._serverId,
        score,
        reason: this.scoreReason(tool, classification, score),
        estimatedCost,
      };
    });

    // Filter by cost category constraints
    const maxCategory = request.maxCostCategory || this.config.maxCostCategory;
    const categoryOrder = ['free', 'low', 'medium', 'high'];
    const maxIndex = categoryOrder.indexOf(maxCategory);

    const filtered = scored.filter(s => {
      const categoryIndex = categoryOrder.indexOf(s.estimatedCost.costCategory);
      return categoryIndex <= maxIndex;
    });

    // Sort by score descending
    filtered.sort((a, b) => b.score - a.score);

    // Return best match
    return filtered[0] || null;
  }

  /**
   * Score a tool for intent match and cost optimization
   *
   * Scoring factors:
   * - Intent match: 0-0.8
   * - Cost score: 0-0.2
   * - Performance score: 0-0.2
   * - Reliability score: 0-0.1
   *
   * @param tool - Tool to score
   * @param classification - Intent classification
   * @param request - Request constraints
   * @returns Score (0-1.3, can exceed 1.0 with all factors)
   */
  private scoreTool(
    tool: MCPTool & { _serverId: string },
    classification: IntentClassification,
    request: ToolRequest
  ): number {
    let score = 0;

    // 1. Intent match (0-0.8)
    const intentScore = this.scoreIntentMatch(tool, classification);
    score += intentScore;

    // 2. Cost score (0-0.2)
    const costScore = this.scoreCost(tool);
    score += costScore;

    // 3. Performance score (0-0.2)
    const perfScore = this.scorePerformance(tool);
    score += perfScore;

    // 4. Reliability score (0-0.1)
    const reliabilityScore = this.scoreReliability(tool);
    score += reliabilityScore;

    return Math.min(score, 1.3); // Cap at 1.3
  }

  /**
   * Score intent match (0-0.8)
   */
  private scoreIntentMatch(
    tool: MCPTool & { _serverId: string },
    classification: IntentClassification
  ): number {
    const name = tool.name.toLowerCase();
    const description = (tool.description || '').toLowerCase();
    const query = classification.intent.toLowerCase().replace(/-/g, ' ');

    let score = 0;

    // Exact name match
    if (name === query || name === classification.intent) {
      score += 0.8;
    }

    // Partial name match
    if (name.includes(query) || query.includes(name.replace(/_/g, ' '))) {
      score += 0.5;
    }

    // Description keyword match
    const keywords = query.split(/\s+/);
    for (const keyword of keywords) {
      if (keyword.length > 3 && description.includes(keyword)) {
        score += 0.1;
      }
    }

    return Math.min(score, 0.8);
  }

  /**
   * Score cost factor (0-0.2, lower cost = higher score)
   */
  private scoreCost(tool: MCPTool & { _serverId: string }): number {
    const cost = this.estimateToolCost(tool);

    switch (cost.costCategory) {
      case 'free': return 0.2;
      case 'low': return 0.15;
      case 'medium': return 0.1;
      case 'high': return 0.05;
      default: return 0.1;
    }
  }

  /**
   * Score performance factor (0-0.2, faster = higher score)
   */
  private scorePerformance(tool: MCPTool & { _serverId: string }): number {
    const metadata = this.toolMetadata.get(`${tool._serverId}:${tool.name}`);
    const latency = metadata?.avgLatency || this.estimateToolCost(tool).latencyMs;

    if (latency < 50) return 0.2;
    if (latency < 200) return 0.15;
    if (latency < 500) return 0.1;
    return 0.05;
  }

  /**
   * Score reliability factor (0-0.1, lower error rate = higher score)
   */
  private scoreReliability(tool: MCPTool & { _serverId: string }): number {
    const metadata = this.toolMetadata.get(`${tool._serverId}:${tool.name}`);
    const errorRate = metadata?.errorRate || 0;

    if (errorRate < 0.01) return 0.1;
    if (errorRate < 0.05) return 0.05;
    return 0;
  }

  /**
   * Generate human-readable score reason
   */
  private scoreReason(
    tool: MCPTool,
    classification: IntentClassification,
    score: number
  ): string {
    const parts: string[] = [];

    if (score > 1.0) parts.push('excellent match');
    else if (score > 0.7) parts.push('good match');
    else if (score > 0.4) parts.push('moderate match');
    else parts.push('weak match');

    parts.push(`tool: ${tool.name}`);
    parts.push(`intent: ${classification.intent}`);

    return parts.join(', ');
  }

  /**
   * Estimate tool cost
   */
  private estimateToolCost(tool: MCPTool & { _serverId: string }): CostEstimate {
    // Get server-specific cost profile
    const metadata = this.toolMetadata.get(`${tool._serverId}:${tool.name}`);

    if (metadata) {
      return {
        latencyMs: metadata.avgLatency,
        estimatedTokens: 1000, // Default estimate
        directCost: metadata.cost.directCost,
        costCategory: metadata.cost.costCategory,
      };
    }

    // Default estimates by server type
    const serverId = tool._serverId;
    if (serverId.includes('search')) {
      return { latencyMs: 200, estimatedTokens: 1000, directCost: 0, costCategory: 'low' };
    }
    if (serverId.includes('postgres') || serverId.includes('mysql') || serverId.includes('sqlite')) {
      return { latencyMs: 100, estimatedTokens: 500, directCost: 0, costCategory: 'low' };
    }
    if (serverId.includes('filesystem')) {
      return { latencyMs: 20, estimatedTokens: 250, directCost: 0, costCategory: 'free' };
    }
    if (serverId.includes('github')) {
      return { latencyMs: 300, estimatedTokens: 500, directCost: 0, costCategory: 'medium' };
    }
    if (serverId.includes('memory')) {
      return { latencyMs: 5, estimatedTokens: 100, directCost: 0, costCategory: 'free' };
    }

    return { latencyMs: 100, estimatedTokens: 500, directCost: 0, costCategory: 'low' };
  }

  /**
   * Execute a tool with retry logic
   */
  private async executeTool(
    serverId: string,
    toolName: string,
    params: Record<string, unknown>,
    request: ToolRequest
  ): Promise<ToolResponse> {
    const maxRetries = this.config.maxRetries;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.client.callTool(serverId, toolName, params);

        // Update server health
        this.updateServerHealth(serverId, true, Date.now() - (result._cost?.latencyMs || 0));

        return {
          data: result.content,
          toolName,
          serverId,
          actualCost: result._cost || this.estimateToolCost({ name: toolName, _serverId: serverId } as any),
          cached: false,
          timestamp: Date.now(),
        };
      } catch (error) {
        lastError = error as Error;
        this.updateServerHealth(serverId, false);

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw createRouterError(
      'tool_execution_failed',
      `Tool execution failed after ${maxRetries} retries: ${lastError?.message}`,
      lastError,
      toolName,
      serverId
    );
  }

  /**
   * Extract parameters from query based on intent
   */
  private extractParameters(query: string, classification: IntentClassification): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    switch (classification.intent) {
      case 'search':
        // Extract search query
        const searchMatch = query.match(/(?:search|find|look up)\s+(?:for\s+)?(.+)/i);
        if (searchMatch) {
          params.query = searchMatch[1].trim();
        } else {
          params.query = query;
        }
        break;

      case 'file-read':
        // Extract file path
        const fileMatch = query.match(/(?:read|open)\s+(?:file\s+)?[\'"]?([^\'"\s]+)/i);
        if (fileMatch) {
          params.path = fileMatch[1];
        }
        break;

      default:
        // For other intents, pass the query as-is
        params.query = query;
    }

    return params;
  }

  /**
   * Update server health metrics
   */
  private updateServerHealth(serverId: string, success: boolean, latency?: number): void {
    let health = this.serverHealth.get(serverId);

    if (!health) {
      health = {
        serverId,
        status: 'connected',
        errorRate: 0,
        avgLatency: 0,
        totalCalls: 0,
        failedCalls: 0,
      };
      this.serverHealth.set(serverId, health);
    }

    health.totalCalls++;
    if (!success) {
      health.failedCalls++;
    }

    health.errorRate = health.failedCalls / health.totalCalls;

    if (latency !== undefined) {
      // Exponential moving average
      health.avgLatency = health.avgLatency === 0
        ? latency
        : 0.9 * health.avgLatency + 0.1 * latency;
    }

    if (success) {
      health.lastSuccess = Date.now();
    } else {
      health.lastFailure = Date.now();
    }
  }

  /**
   * Update tool metadata after execution
   */
  private updateToolMetadata(
    toolName: string,
    serverId: string,
    cost: CostEstimate
  ): void {
    const key = `${serverId}:${toolName}`;
    let metadata = this.toolMetadata.get(key);

    if (!metadata) {
      metadata = {
        name: toolName,
        serverId,
        description: '',
        intents: [],
        cost,
        avgLatency: cost.latencyMs,
        errorRate: 0,
        available: true,
      };
      this.toolMetadata.set(key, metadata);
    }

    // Update average latency
    metadata.avgLatency = 0.9 * metadata.avgLatency + 0.1 * cost.latencyMs;
  }

  /**
   * Check if request is within budget
   */
  private async checkBudget(userId: string, cost: CostEstimate): Promise<void> {
    const sessionCosts = this.sessionCosts.get(userId) || {
      totalCost: 0,
      totalTokens: 0,
      totalLatency: 0,
      toolCalls: {},
      serverCalls: {},
      costByCategory: {},
    };

    const userTier = 'free'; // TODO: Get from user service
    const budget = BUDGET_LIMITS[userTier] || this.config.maxSessionBudget;

    if (sessionCosts.totalCost + cost.directCost > budget) {
      throw createRouterError(
        'cost_limit_exceeded',
        `Session budget exceeded: $${sessionCosts.totalCost.toFixed(4)} + $${cost.directCost.toFixed(4)} > $${budget.toFixed(2)}`
      );
    }
  }

  /**
   * Track costs for a tool call
   */
  private trackCost(
    userId: string,
    serverId: string,
    toolName: string,
    cost: CostEstimate
  ): void {
    let sessionCosts = this.sessionCosts.get(userId);

    if (!sessionCosts) {
      sessionCosts = {
        totalCost: 0,
        totalTokens: 0,
        totalLatency: 0,
        toolCalls: {},
        serverCalls: {},
        costByCategory: {},
      };
      this.sessionCosts.set(userId, sessionCosts);
    }

    sessionCosts.totalCost += cost.directCost;
    sessionCosts.totalTokens += cost.estimatedTokens;
    sessionCosts.totalLatency += cost.latencyMs;

    sessionCosts.toolCalls[toolName] = (sessionCosts.toolCalls[toolName] || 0) + 1;
    sessionCosts.serverCalls[serverId] = (sessionCosts.serverCalls[serverId] || 0) + 1;
    sessionCosts.costByCategory[cost.costCategory] =
      (sessionCosts.costByCategory[cost.costCategory] || 0) + cost.directCost;
  }

  /**
   * Get session costs for a user
   */
  getSessionCosts(userId: string): SessionCosts {
    return this.sessionCosts.get(userId) || {
      totalCost: 0,
      totalTokens: 0,
      totalLatency: 0,
      toolCalls: {},
      serverCalls: {},
      costByCategory: {},
    };
  }

  /**
   * Get server health status
   */
  getServerHealth(serverId?: string): ServerHealth | Map<string, ServerHealth> {
    if (serverId) {
      return this.serverHealth.get(serverId) || {
        serverId,
        status: 'disconnected',
        errorRate: 0,
        avgLatency: 0,
        totalCalls: 0,
        failedCalls: 0,
      };
    }
    return this.serverHealth;
  }

  /**
   * Reset session costs for a user
   */
  resetSessionCosts(userId: string): void {
    this.sessionCosts.delete(userId);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an MCP router with default configuration
 *
 * @param client - MCP client instance
 * @param config - Optional router configuration
 * @returns Configured MCP router
 */
export function createMCPRouter(
  client: MCPClient,
  config?: MCPRouterConfig
): MCPRouter {
  return new MCPRouter(client, config);
}

// ============================================================================
// Exports
// ============================================================================

export * from './types';
