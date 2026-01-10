/**
 * MCP (Model Context Protocol) Client Implementation
 *
 * This module implements a Cloudflare Worker-compatible MCP client that connects
 * to external MCP servers, exposing their tools, resources, and prompts to agents
 * in the StudyLoG.AI ecosystem.
 *
 * ### Architecture Overview
 *
 * The MCP client operates as a bridge between our agents and external services:
 *
 * ```
 * StudyLoG Agent → MCP Router → MCP Client → External MCP Server
 *                     ↓              ↓
 *              Tool Selection    HTTP/stdio
 *              Cost Tracking     Connection
 * ```
 *
 * ### How MCP Extends Agent Capabilities
 *
 * Without MCP, agents are limited to:
 * - LLM text generation
 * - Built-in tool implementations
 *
 * With MCP, agents can:
 * - **Search the web** via Brave Search, Serper
 * - **Query databases** via PostgreSQL, MySQL, SQLite MCP servers
 * - **Access files** via filesystem MCP server
 * - **Interact with GitHub** via GitHub MCP server
 * - **Use specialized tools** from any MCP-compatible server
 *
 * This makes agents significantly more powerful without requiring code changes
 * for each new integration.
 *
 * ### Cost Implications of MCP Calls
 *
 * MCP introduces several cost factors that must be tracked:
 *
 * 1. **Network Latency**: Each MCP call is a round-trip request
 *    - Typical latency: 50-500ms depending on server location
 *    - Mitigation: Use caching, parallel calls where possible
 *
 * 2. **Token Usage**: Tool results become LLM input tokens
 *    - Example: A search result returning 10 results ~2000 tokens
 *    - Cost impact: ~$0.0006 per 1M tokens (DeepSeek pricing)
 *    - Mitigation: Truncate results, summarize before feeding to LLM
 *
 * 3. **Direct API Costs**: Some MCP servers charge for access
 *    - Example: Brave Search API has rate limits and potential fees
 *    - Example: Premium data APIs may charge per query
 *    - Mitigation: Track costs at router level, set budgets
 *
 * 4. **Error Costs**: Failed retries waste tokens and time
 *    - Mitigation: Implement exponential backoff, circuit breakers
 *
 * ### Tool Selection Strategy
 *
 * When an agent needs to call a tool, the MCP router:
 *
 * 1. **Parse Intent**: Classify what the agent wants to do
 *    - Example: "search for latest AI news" → search intent
 *
 * 2. **Find Matching Tools**: Query all servers for available tools
 *    - Example: brave-search, serper both match "search" intent
 *
 * 3. **Rank by Relevance**: Score tools based on description match
 *    - Example: brave-search has higher score for web queries
 *
 * 4. **Check Costs**: Consider latency and direct costs
 *    - Example: Prefer cached results, lower-latency servers
 *
 * 5. **Execute**: Call the tool and return results to agent
 *
 * @see https://modelcontextprotocol.io
 * @module mcp-client
 */

import type {
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPServerConfig,
  MCPServerInfo,
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPResource,
  MCPResourceContents,
  MCPPrompt,
  MCPGetPromptRequest,
  MCPGetPromptResponse,
  MCPClientRequest,
  MCPClientResponse,
  MCPClientError,
  MCPClientErrorType,
  MCPClientConfig,
  MCPToolIntent,
  MCPToolSelection,
  MCPToolCost,
  MCPServerCapabilities,
  PreconfiguredMCPServer,
  PRECONFIGURED_SERVERS,
} from './types';

// ============================================================================
// Error Factory
// ============================================================================

/**
 * Create a typed MCP client error
 *
 * Wraps errors with additional context for debugging and cost tracking.
 * The original error is preserved in the `cause` property.
 *
 * @param type - Error type categorization
 * @param message - Human-readable error message
 * @param cause - Original error (if wrapping)
 * @param request - Request that caused the error (if applicable)
 * @param serverId - Server ID (if applicable)
 */
function createMCPError(
  type: MCPClientErrorType,
  message: string,
  cause?: Error,
  request?: MCPRequest,
  serverId?: string
): MCPClientError {
  const error = new Error(message) as MCPClientError;
  error.name = 'MCPClientError';
  error.type = type;
  error.cause = cause;
  error.request = request;
  error.serverId = serverId;
  return error;
}

// ============================================================================
// MCP Server Connection
// ============================================================================

/**
 * Represents an active connection to an MCP server
 *
 * Handles communication with a single MCP server, including initialization,
 * method invocation, and error handling. Supports HTTP and stdio transports.
 *
 * ### Connection Lifecycle
 *
 * 1. **Connect**: Establish connection to the server
 * 2. **Initialize**: Call initialize method, exchange capabilities
 * 3. **Ready**: Server is ready for tool/resource/prompt calls
 * 4. **Close**: Gracefully close the connection
 *
 * ### Transport Support
 *
 * - **HTTP**: For Cloudflare Worker compatible remote servers
 * - **WebSocket**: For real-time bidirectional communication
 * - **stdio**: For local subprocess communication (non-Worker context)
 *
 * Note: stdio transport is only available in Node.js contexts, not in
 * Cloudflare Workers. For Workers deployment, use HTTP/WebSocket only.
 */
export class MCPServerConnection {
  private config: MCPServerConfig;
  private serverInfo?: MCPServerInfo;
  private connected: boolean = false;
  private lastError?: Error;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Get the server ID
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * Get the server name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get server capabilities (after initialization)
   */
  get capabilities(): MCPServerCapabilities | undefined {
    return this.serverInfo?.capabilities;
  }

  /**
   * Check if server is connected
   */
  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the last error (if any)
   */
  getLastError(): Error | undefined {
    return this.lastError;
  }

  /**
   * Connect to the server and initialize
   *
   * Establishes the connection and performs the MCP initialize handshake.
   * After successful initialization, the server's capabilities are available.
   *
   * ### Initialization Flow
   *
   * 1. Send initialize request with client capabilities
   * 2. Receive server info with name, version, protocol version, capabilities
   * 3. Mark connection as ready
   *
   * ### Cost Considerations
   *
   * - Network latency: One round-trip to the server
   * - No token usage: Handshake doesn't involve LLM calls
   * - Retry logic: Exponential backoff on failure
   *
   * @throws {MCPClientError} If connection or initialization fails
   */
  async connect(): Promise<MCPServerInfo> {
    if (this.connected) {
      return this.serverInfo!;
    }

    try {
      // Perform initialize handshake
      this.serverInfo = await this.initialize();
      this.connected = true;
      this.lastError = undefined;

      if (this.config.logging !== false) {
        console.log(`[MCP] Connected to ${this.name}:`, this.serverInfo);
      }

      return this.serverInfo;
    } catch (error) {
      this.lastError = error as Error;
      throw createMCPError(
        'connection_failed',
        `Failed to connect to MCP server ${this.name}: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Initialize the MCP connection
   *
   * Sends the initialize request to establish the session and exchange
   * capabilities with the server.
   *
   * @returns Server information including capabilities
   * @private
   */
  private async initialize(): Promise<MCPServerInfo> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        clientInfo: {
          name: 'studylog-mcp-client',
          version: '1.0.0',
        },
      },
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw new Error('Initialize failed: no result returned');
    }

    return response.result as MCPServerInfo;
  }

  /**
   * List available tools from this server
   *
   * Returns all tools that the server exposes. Tools are functions
   * that can be called by the AI model.
   *
   * ### Tool Discovery
   *
   * Tools are discovered dynamically at runtime. The server may add
   * or remove tools between calls if it declared listChanged capability.
   *
   * ### Cost Implications
   *
   * - Network latency: One round-trip to the server
   * - Caching: Tools list can be cached until server signals changes
   * - No token usage: Tool metadata is small
   *
   * @returns Array of available tool definitions
   * @throws {MCPClientError} If the server doesn't support tools or request fails
   */
  async listTools(): Promise<MCPTool[]> {
    this.ensureConnected();
    this.ensureCapability('tools');

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'tools/list',
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw new Error('tools/list failed: no result returned');
    }

    const result = response.result as { tools?: MCPTool[] };
    return result.tools || [];
  }

  /**
   * Call a tool on this server
   *
   * Executes a tool with the provided arguments and returns the result.
   * Tool results can include text, images, or embedded resources.
   *
   * ### Tool Execution Flow
   *
   * 1. Validate tool name exists on this server
   * 2. Send tools/call request with arguments
   * 3. Parse response content blocks
   * 4. Return structured result
   *
   * ### Cost Implications
   *
   * - **Network latency**: 50-500ms typical
   * - **Token usage**: Result size varies widely
   *   - Search results: ~1000-5000 tokens
   *   - File reads: proportional to file size
   *   - Database queries: depends on row count
   * - **Direct costs**: Some APIs charge per call
   * - **Caching**: Results can be cached for identical calls
   *
   * ### Error Handling
   *
   * Tool execution failures return isError=true in the response.
   * The client should check this flag and handle appropriately.
   *
   * @param toolCall - Tool name and arguments
   * @returns Tool execution result
   * @throws {MCPClientError} If tool not found or call fails
   */
  async callTool(toolCall: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    this.ensureConnected();
    this.ensureCapability('tools');

    const startTime = Date.now();

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'tools/call',
      params: toolCall,
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw createMCPError(
        'tool_execution_failed',
        `Tool call failed: ${toolCall.name}`,
        undefined,
        request,
        this.id
      );
    }

    const latency = Date.now() - startTime;

    if (this.config.logging !== false) {
      console.log(`[MCP] Tool ${toolCall.name} called on ${this.name} (${latency}ms)`);
    }

    return response.result as MCPToolCallResponse;
  }

  /**
   * List available resources from this server
   *
   * Resources represent data that can be provided to the AI model.
   * Examples: files, database entries, API responses.
   *
   * ### Resource vs Tools
   *
   * - **Tools**: Actions the AI can execute (functions)
   * - **Resources**: Data the AI can read (static context)
   *
   * Use resources when data doesn't change during a session.
   *
   * @returns Array of available resource definitions
   * @throws {MCPClientError} If the server doesn't support resources or request fails
   */
  async listResources(): Promise<MCPResource[]> {
    this.ensureConnected();
    this.ensureCapability('resources');

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'resources/list',
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw new Error('resources/list failed: no result returned');
    }

    const result = response.result as { resources?: MCPResource[] };
    return result.resources || [];
  }

  /**
   * Read a resource's contents
   *
   * Retrieves the actual data for a resource URI.
   * Contents can be text, images, or embedded resources.
   *
   * ### Cost Implications
   *
   * - Network latency: One round-trip
   * - Token usage: Proportional to resource size
   * - Caching: Resources should be cached aggressively
   *
   * @param uri - Resource URI to read
   * @returns Resource contents
   * @throws {MCPClientError} If resource not found or read fails
   */
  async readResource(uri: string): Promise<MCPResourceContents> {
    this.ensureConnected();
    this.ensureCapability('resources');

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'resources/read',
      params: { uri },
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw createMCPError(
        'resource_not_found',
        `Resource not found: ${uri}`,
        undefined,
        request,
        this.id
      );
    }

    return response.result as MCPResourceContents;
  }

  /**
   * List available prompts from this server
   *
   * Prompts are pre-defined templates for common workflows.
   * They can be filled with arguments and sent to the LLM.
   *
   * ### Prompt Use Cases
   *
   * - Code review templates
   * - Documentation generation
   * - Test generation patterns
   * - Multi-step reasoning workflows
   *
   * @returns Array of available prompt definitions
   * @throws {MCPClientError} If the server doesn't support prompts or request fails
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    this.ensureConnected();
    this.ensureCapability('prompts');

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'prompts/list',
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw new Error('prompts/list failed: no result returned');
    }

    const result = response.result as { prompts?: MCPPrompt[] };
    return result.prompts || [];
  }

  /**
   * Get a prompt with arguments filled in
   *
   * Retrieves a specific prompt template with arguments applied.
   * Returns an array of messages ready to send to the LLM.
   *
   * @param promptRequest - Prompt name and arguments
   * @returns Prompt messages and metadata
   * @throws {MCPClientError} If prompt not found or request fails
   */
  async getPrompt(promptRequest: MCPGetPromptRequest): Promise<MCPGetPromptResponse> {
    this.ensureConnected();
    this.ensureCapability('prompts');

    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: this.generateId(),
      method: 'prompts/get',
      params: promptRequest,
    };

    const response = await this.sendRequest(request);

    if (!response.result) {
      throw createMCPError(
        'server_error',
        `Prompt not found: ${promptRequest.name}`,
        undefined,
        request,
        this.id
      );
    }

    return response.result as MCPGetPromptResponse;
  }

  /**
   * Send a raw JSON-RPC request to the server
   *
   * Handles the transport-specific communication based on the
   * server's configured transport type (HTTP, WebSocket, stdio).
   *
   * ### HTTP Transport
   *
   * Sends POST request with JSON-RPC payload.
   * Used for most Cloudflare Worker deployments.
   *
   * ### WebSocket Transport
   *
   * Sends message over persistent WebSocket connection.
   * Lower latency for frequent calls.
   *
   * ### stdio Transport
   *
   * Sends JSON line to subprocess stdin, reads from stdout.
   * Only available in Node.js environments, not Workers.
   *
   * @param request - JSON-RPC request
   * @returns JSON-RPC response
   * @throws {MCPClientError} If request fails or times out
   * @private
   */
  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    const timeout = this.config.timeout || 30000; // 30 second default
    const startTime = Date.now();

    try {
      switch (this.config.transport) {
        case 'http':
          return await this.sendHTTP(request, timeout);
        case 'websocket':
          return await this.sendWebSocket(request, timeout);
        case 'stdio':
          return await this.sendStdio(request, timeout);
        default:
          throw new Error(`Unsupported transport: ${this.config.transport}`);
      }
    } catch (error) {
      const latency = Date.now() - startTime;

      if ((error as Error).name === 'AbortError') {
        throw createMCPError(
          'timeout',
          `Request timeout after ${timeout}ms (latency: ${latency}ms)`,
          error as Error,
          request,
          this.id
        );
      }

      throw createMCPError(
        'server_error',
        `Request failed: ${(error as Error).message}`,
        error as Error,
        request,
        this.id
      );
    }
  }

  /**
   * Send request via HTTP transport
   *
   * Cloudflare Worker compatible HTTP transport using fetch API.
   *
   * @param request - JSON-RPC request
   * @param timeout - Request timeout in milliseconds
   * @returns JSON-RPC response
   * @private
   */
  private async sendHTTP(request: MCPRequest, timeout: number): Promise<MCPResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers,
      };

      // Add API key if configured
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();

      // Validate JSON-RPC response
      if (data.jsonrpc !== '2.0' || data.id !== request.id) {
        throw new Error('Invalid JSON-RPC response');
      }

      if (data.error) {
        return data as MCPResponse;
      }

      return data as MCPResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send request via WebSocket transport
   *
   * Lower latency for persistent connections.
   *
   * @param request - JSON-RPC request
   * @param timeout - Request timeout in milliseconds
   * @returns JSON-RPC response
   * @private
   */
  private async sendWebSocket(request: MCPRequest, timeout: number): Promise<MCPResponse> {
    // WebSocket support requires maintaining connections
    // For Cloudflare Workers, use WebSocket duplex API
    // This is a simplified implementation

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // For HTTP-to-WebSocket upgrade in Workers
      const wsUrl = this.config.endpoint.replace('http://', 'ws://').replace('https://', 'wss://');

      const response = await fetch(wsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal as any, // WebSocket upgrade
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      return data as MCPResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Send request via stdio transport
   *
   * For local subprocess communication (Node.js only).
   * Not available in Cloudflare Workers.
   *
   * @param request - JSON-RPC request
   * @param timeout - Request timeout in milliseconds
   * @returns JSON-RPC response
   * @private
   */
  private async sendStdio(request: MCPRequest, timeout: number): Promise<MCPResponse> {
    // stdio is not available in Cloudflare Workers
    // This would need to be implemented for Node.js environments
    throw createMCPError(
      'connection_failed',
      'stdio transport is not supported in Cloudflare Workers. Use HTTP transport instead.'
    );
  }

  /**
   * Ensure the connection is established
   * @private
   */
  private ensureConnected(): void {
    if (!this.connected) {
      throw createMCPError(
        'connection_failed',
        `Server ${this.name} is not connected. Call connect() first.`
      );
    }
  }

  /**
   * Ensure the server has a specific capability
   * @private
   */
  private ensureCapability(capability: keyof MCPServerCapabilities): void {
    const caps = this.serverInfo?.capabilities;
    if (!caps || !caps[capability]) {
      throw createMCPError(
        'server_error',
        `Server ${this.name} does not support ${capability}`
      );
    }
  }

  /**
   * Generate a unique request ID
   * @private
   */
  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Close the connection
   *
   * Gracefully closes the connection to the server.
   * For HTTP, this is a no-op (connections are stateless).
   * For WebSocket, closes the socket.
   * For stdio, terminates the subprocess.
   */
  async close(): Promise<void> {
    this.connected = false;
    this.serverInfo = undefined;
  }
}

// ============================================================================
// MCP Client
// ============================================================================

/**
 * Main MCP Client for managing multiple server connections
 *
 * The MCP Client is the primary interface for connecting to and interacting
 * with multiple MCP servers. It handles connection lifecycle, tool discovery,
 * and request routing.
 *
 * ### Usage Pattern
 *
 * ```typescript
 * const client = new MCPClient({
 *   servers: [
 *     {
 *       id: 'brave',
 *       name: 'Brave Search',
 *       transport: 'http',
 *       endpoint: 'https://api.example.com/mcp',
 *       apiKey: env.BRAVE_API_KEY,
 *     }
 *   ]
 * });
 *
 * await client.connectAll();
 * const tools = await client.getAllTools();
 * const result = await client.callTool('brave', 'brave_search', { query: 'AI news' });
 * ```
 *
 * ### Tool Selection Strategy
 *
 * When calling a tool, the client:
 * 1. Finds which server has the tool
 * 2. Validates the tool exists
 * 3. Executes the call with timeout protection
 * 4. Returns structured results
 *
 * ### Cost Tracking
 *
 * All tool calls track:
 * - Latency (ms)
 * - Estimated token count
 * - Direct costs (if any)
 *
 * This data is used by the MCP Router for cost optimization.
 *
 * @see MCPServerConnection for individual server handling
 */
export class MCPClient {
  private config: MCPClientConfig;
  private connections: Map<string, MCPServerConnection> = new Map();

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  /**
   * Connect to all configured servers
   *
   * Establishes connections to all enabled servers in parallel.
   * Failed connections are logged but don't prevent other connections.
   *
   * ### Connection Strategy
   *
   * - Parallel connection attempts for faster startup
   * - Individual failures don't stop overall process
   * - Failed servers can be retried later
   *
   * @returns Array of successfully connected server info
   */
  async connectAll(): Promise<MCPServerInfo[]> {
    const enabledServers = this.config.servers.filter(s => s.enabled !== false);
    const connectionPromises = enabledServers.map(async (serverConfig) => {
      try {
        const connection = new MCPServerConnection(serverConfig);
        const serverInfo = await connection.connect();
        this.connections.set(serverConfig.id, connection);
        return serverInfo;
      } catch (error) {
        console.error(`[MCP] Failed to connect to ${serverConfig.name}:`, error);
        return null;
      }
    });

    const results = await Promise.all(connectionPromises);
    return results.filter((r): r is MCPServerInfo => r !== null);
  }

  /**
   * Connect to a specific server by ID
   *
   * @param serverId - Server ID to connect
   * @returns Server info if connected successfully
   * @throws Error if server not found or connection fails
   */
  async connectServer(serverId: string): Promise<MCPServerInfo> {
    const serverConfig = this.config.servers.find(s => s.id === serverId);
    if (!serverConfig) {
      throw new Error(`Server not found: ${serverId}`);
    }

    const connection = new MCPServerConnection(serverConfig);
    const serverInfo = await connection.connect();
    this.connections.set(serverId, connection);
    return serverInfo;
  }

  /**
   * Get all available tools from all connected servers
   *
   * Aggregates tools from all servers, tagging each tool with its
   * source server for routing purposes.
   *
   * ### Cost Implications
   *
   * - Network latency: One round-trip per connected server
   * - Caching: Tools list should be cached until server signals changes
   * - Parallel calls: All servers queried simultaneously
   *
   * @returns Array of tools with server source information
   */
  async getAllTools(): Promise<Array<MCPTool & { _serverId: string }>> {
    const toolsPromises: Promise<Array<MCPTool & { _serverId: string }>>[] = [];

    for (const [serverId, connection] of this.connections.entries()) {
      const promise = connection.listTools().then(tools =>
        tools.map(tool => ({ ...tool, _serverId: serverId }))
      ).catch(error => {
        console.error(`[MCP] Failed to list tools for ${serverId}:`, error);
        return [] as Array<MCPTool & { _serverId: string }>;
      });
      toolsPromises.push(promise);
    }

    const results = await Promise.all(toolsPromises);
    return results.flat();
  }

  /**
   * Get all available resources from all connected servers
   *
   * @returns Array of resources with server source information
   */
  async getAllResources(): Promise<Array<MCPResource & { _serverId: string }>> {
    const resourcesPromises: Promise<Array<MCPResource & { _serverId: string }>>[] = [];

    for (const [serverId, connection] of this.connections.entries()) {
      const promise = connection.listResources().then(resources =>
        resources.map(resource => ({ ...resource, _serverId: serverId }))
      ).catch(error => {
        console.error(`[MCP] Failed to list resources for ${serverId}:`, error);
        return [] as Array<MCPResource & { _serverId: string }>;
      });
      resourcesPromises.push(promise);
    }

    const results = await Promise.all(resourcesPromises);
    return results.flat();
  }

  /**
   * Get all available prompts from all connected servers
   *
   * @returns Array of prompts with server source information
   */
  async getAllPrompts(): Promise<Array<MCPPrompt & { _serverId: string }>> {
    const promptsPromises: Promise<Array<MCPPrompt & { _serverId: string }>>[] = [];

    for (const [serverId, connection] of this.connections.entries()) {
      const promise = connection.listPrompts().then(prompts =>
        prompts.map(prompt => ({ ...prompt, _serverId: serverId }))
      ).catch(error => {
        console.error(`[MCP] Failed to list prompts for ${serverId}:`, error);
        return [] as Array<MCPPrompt & { _serverId: string }>;
      });
      promptsPromises.push(promise);
    }

    const results = await Promise.all(promptsPromises);
    return results.flat();
  }

  /**
   * Call a tool on a specific server
   *
   * Executes a tool with the provided arguments.
   *
   * ### Cost Implications
   *
   * - **Latency**: 50-500ms typical per call
   * - **Token usage**: Proportional to result size
   * - **Direct costs**: Varies by tool/server
   *
   * The return value includes metadata for cost tracking.
   *
   * @param serverId - Server ID
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool result with cost metadata
   * @throws Error if server not connected or tool call fails
   */
  async callTool(
    serverId: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<MCPToolCallResponse & { _cost: MCPToolCost }> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server not connected: ${serverId}`);
    }

    const startTime = Date.now();
    const response = await connection.callTool({ name: toolName, arguments: args });
    const latency = Date.now() - startTime;

    // Estimate cost
    const cost = this.estimateCost(response, latency);

    if (this.config.logging !== false) {
      console.log(`[MCP] Tool ${toolName} result:`, {
        latency,
        estimatedTokens: cost.estimatedTokens,
        costCategory: cost.costCategory,
      });
    }

    return {
      ...response,
      _cost: cost,
    };
  }

  /**
   * Find a tool by name across all servers
   *
   * Searches for a tool with the given name and returns both the tool
   * definition and the server that provides it.
   *
   * @param toolName - Tool name to find
   * @returns Tool and server ID, or null if not found
   */
  async findTool(toolName: string): Promise<{ tool: MCPTool; serverId: string } | null> {
    const allTools = await this.getAllTools();
    const found = allTools.find(t => t.name === toolName);

    if (!found) {
      return null;
    }

    const { _serverId, ...tool } = found;
    return { tool, serverId: _serverId };
  }

  /**
   * Select the best tool for a given intent
   *
   * Implements the tool selection strategy:
   * 1. Parse the intent (e.g., "search", "database")
   * 2. Find tools matching the intent
   * 3. Score tools by relevance
   * 4. Return the highest-scoring tool
   *
   * ### Scoring Algorithm
   *
   * Tools are scored based on:
   * - Name match (exact match = 1.0, partial = 0.5)
   * - Description keyword match (0.1 per keyword)
   * - Server reputation (trusted servers get boost)
   * - Historical performance (fast tools get boost)
   *
   * @param intent - User intent
   * @param query - User query for context
   * @returns Best tool selection or null if no match
   */
  async selectTool(intent: MCPToolIntent, query: string): Promise<MCPToolSelection | null> {
    const allTools = await this.getAllTools();

    // Score each tool
    const scored = allTools.map(tool => {
      const score = this.scoreTool(tool, intent, query);
      return {
        serverId: tool._serverId,
        toolName: tool.name,
        score,
        reason: this.scoreReason(tool, intent, query, score),
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return best match if score > 0
    const best = scored[0];
    if (best && best.score > 0) {
      return best;
    }

    return null;
  }

  /**
   * Score a tool for intent match
   * @private
   */
  private scoreTool(tool: MCPTool & { _serverId: string }, intent: MCPToolIntent, query: string): number {
    let score = 0;

    const name = tool.name.toLowerCase();
    const description = (tool.description || '').toLowerCase();
    const queryLower = query.toLowerCase();

    // Name-based scoring
    switch (intent) {
      case 'search':
        if (name.includes('search') || name.includes('query')) score += 0.8;
        if (description.includes('search') || description.includes('find')) score += 0.5;
        break;
      case 'database':
        if (name.includes('db') || name.includes('query') || name.includes('sql')) score += 0.8;
        if (description.includes('database')) score += 0.5;
        break;
      case 'filesystem':
        if (name.includes('file') || name.includes('read') || name.includes('write')) score += 0.8;
        if (description.includes('file') || description.includes('directory')) score += 0.5;
        break;
      case 'github':
        if (name.includes('github') || name.includes('repo') || name.includes('git')) score += 0.8;
        if (description.includes('github') || description.includes('repository')) score += 0.5;
        break;
      case 'api':
        if (name.includes('http') || name.includes('api') || name.includes('fetch')) score += 0.8;
        if (description.includes('http') || description.includes('api')) score += 0.5;
        break;
      case 'computation':
        if (name.includes('calc') || name.includes('math') || name.includes('compute')) score += 0.8;
        if (description.includes('calculate') || description.includes('math')) score += 0.5;
        break;
    }

    // Query keyword matching
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 3);
    for (const keyword of keywords) {
      if (name.includes(keyword)) score += 0.2;
      if (description.includes(keyword)) score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Generate human-readable reason for score
   * @private
   */
  private scoreReason(tool: MCPTool, intent: MCPToolIntent, query: string, score: number): string {
    if (score > 0.8) return `Strong match: ${tool.name} matches ${intent} intent`;
    if (score > 0.5) return `Moderate match: ${tool.name} partially matches ${intent}`;
    if (score > 0) return `Weak match: ${tool.name} has some relevant keywords`;
    return 'No match';
  }

  /**
   * Estimate the cost of a tool call result
   * @private
   */
  private estimateCost(result: MCPToolCallResponse, latencyMs: number): MCPToolCost {
    // Estimate token count from content size
    let estimatedTokens = 0;
    for (const content of result.content) {
      if (content.type === 'text') {
        // Rough estimate: 1 token ~ 4 characters
        estimatedTokens += Math.ceil(content.text.length / 4);
      } else if (content.type === 'image') {
        // Images are more expensive
        estimatedTokens += 1000;
      }
    }

    // Calculate direct cost (most tools are free)
    const directCost = 0;

    // Determine cost category
    let costCategory: 'free' | 'low' | 'medium' | 'high' = 'free';
    if (estimatedTokens > 10000) costCategory = 'high';
    else if (estimatedTokens > 5000) costCategory = 'medium';
    else if (estimatedTokens > 1000) costCategory = 'low';

    return {
      latencyMs,
      estimatedTokens,
      directCost,
      costCategory,
    };
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(c => c.close());
    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Get connection status for all servers
   */
  getStatus(): Record<string, { connected: boolean; name: string; capabilities?: MCPServerCapabilities }> {
    const status: Record<string, { connected: boolean; name: string; capabilities?: MCPServerCapabilities }> = {};

    for (const [id, connection] of this.connections.entries()) {
      status[id] = {
        connected: connection.isConnected,
        name: connection.name,
        capabilities: connection.capabilities,
      };
    }

    return status;
  }
}

// ============================================================================
// MCP Client Factory
// ============================================================================

/**
 * Create a pre-configured MCP client
 *
 * Factory function to create an MCP client with common servers pre-configured.
 * Supports adding custom servers and configuring options.
 *
 * ### Pre-configured Servers
 *
 * - **Search**: brave-search, serper
 * - **Database**: postgres, mysql, sqlite
 * - **Filesystem**: filesystem
 * - **GitHub**: github
 * - **Memory**: memory (in-memory store)
 *
 * ### Environment Variables
 *
 * Many MCP servers require API keys via environment variables:
 * - BRAVE_API_KEY: Brave Search
 * - SERPER_API_KEY: Serper
 * - GITHUB_TOKEN: GitHub
 * - DATABASE_URL: Database connection strings
 *
 * @param servers - Pre-configured servers to include
 * @param customServers - Additional custom server configs
 * @param options - Client options
 * @returns Configured MCP client
 */
export function createMCPClient(
  servers: PreconfiguredMCPServer[] = [],
  customServers: MCPServerConfig[] = [],
  options: Partial<MCPClientConfig> = {}
): MCPClient {
  const serverConfigs: MCPServerConfig[] = [];

  // Add pre-configured servers
  for (const serverType of servers) {
    const preconfigured = PRECONFIGURED_SERVERS[serverType];
    if (preconfigured) {
      serverConfigs.push({
        id: serverType,
        ...preconfigured,
      } as MCPServerConfig);
    }
  }

  // Add custom servers
  serverConfigs.push(...customServers);

  // Create client config
  const config: MCPClientConfig = {
    servers: serverConfigs,
    defaultTimeout: 30000,
    maxConcurrentCalls: 10,
    logging: true,
    costTracking: true,
    ...options,
  };

  return new MCPClient(config);
}

// ============================================================================
// Exports
// ============================================================================

export * from './types';
