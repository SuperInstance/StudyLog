/**
 * MCP (Model Context Protocol) Client - Type Definitions
 *
 * MCP is an open protocol that enables seamless integration between LLM applications
 * and external data sources and tools. This file defines the TypeScript types for
 * the MCP protocol as specified in the 2025-11-25 specification.
 *
 * ### Overview of MCP
 *
 * MCP provides a standardized way for applications to:
 * - Share contextual information with language models
 * - Expose tools and capabilities to AI systems
 * - Build composable integrations and workflows
 *
 * The protocol uses JSON-RPC 2.0 messages for communication between:
 * - **Hosts**: LLM applications that initiate connections
 * - **Clients**: Connectors within the host application
 * - **Servers**: Services that provide context and capabilities
 *
 * ### How MCP Extends Agent Capabilities
 *
 * In the StudyLoG.AI ecosystem, MCP allows our agents to:
 * 1. **Access External Tools**: Search, databases, filesystems, APIs
 * 2. **Query Resources**: Retrieve data from external sources
 * 3. **Use Prompts**: Access templated workflows from other services
 *
 * This transforms agents from isolated LLM calls into powerful orchestrators
 * that can interact with the entire software ecosystem.
 *
 * ### Cost Implications
 *
 * MCP calls introduce additional costs beyond the base LLM:
 * - **Network Latency**: Each MCP tool call adds round-trip time
 * - **Token Usage**: Tool results are fed back to the LLM as context
 * - **API Costs**: Some MCP servers may charge for access (e.g., premium search)
 *
 * Cost tracking is handled at the router level to attribute MCP-specific costs.
 *
 * @see https://modelcontextprotocol.io
 * @see https://modelcontextprotocol.io/specification/2025-11-25
 */

// ============================================================================
// JSON-RPC 2.0 Base Types
// ============================================================================

/**
 * JSON-RPC 2.0 Request message
 *
 * All MCP communication uses JSON-RPC 2.0 as the transport layer.
 * Requests include a method name and optional parameters.
 */
export interface MCPRequest {
  /** JSON-RPC version, must be "2.0" */
  jsonrpc: '2.0';
  /** Request identifier (string or number) for correlating responses */
  id: string | number;
  /** Method name to invoke (e.g., "tools/list", "tools/call") */
  method: string;
  /** Method parameters, schema depends on the method */
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 Response message
 *
 * Responses include the original request ID and either a result or an error.
 * Successful responses have a `result` field; errors have an `error` field.
 */
export interface MCPResponse {
  /** JSON-RPC version, must be "2.0" */
  jsonrpc: '2.0';
  /** Request identifier matching the original request */
  id: string | number;
  /** Result for successful requests (absent on error) */
  result?: unknown;
  /** Error details for failed requests (absent on success) */
  error?: MCPError;
}

/**
 * JSON-RPC 2.0 Error object
 *
 * Error responses include a code, message, and optional data.
 * Standard error codes are defined in the JSON-RPC spec:
 * - -32700: Parse error
 * - -32600: Invalid request
 * - -32601: Method not found
 * - -32602: Invalid params
 * - -32603: Internal error
 */
export interface MCPError {
  /** Numeric error code */
  code: number;
  /** Short error message */
  message: string;
  /** Additional error data (optional) */
  data?: unknown;
}

/**
 * JSON-RPC 2.0 Notification message
 *
 * Notifications are one-way messages that don't expect a response.
 * Used for events and progress updates.
 */
export interface MCPNotification {
  /** JSON-RPC version, must be "2.0" */
  jsonrpc: '2.0';
  /** Method name for the notification */
  method: string;
  /** Notification parameters */
  params?: Record<string, unknown>;
}

// ============================================================================
// MCP Server Information
// ============================================================================

/**
 * Server capabilities announced during initialization
 *
 * Servers declare which features they support: tools, resources, prompts.
 * This allows clients to discover available functionality without
 * attempting unsupported operations.
 */
export interface MCPServerCapabilities {
  /** Server supports tools (functions the AI can call) */
  tools?: boolean | MCPToolsCapability;
  /** Server supports resources (context and data for AI) */
  resources?: boolean | MCPResourcesCapability;
  /** Server supports prompts (templated messages/workflows) */
  prompts?: boolean | MCPPromptsCapability;
  /** Client supports sampling (server-initiated LLM calls) */
  sampling?: {};
  /** Client exposes roots (filesystem/workspace boundaries) */
  roots?: {};
  /** Client supports elicitation (additional user info requests) */
  elicitation?: {};
}

/**
 * Tools capability configuration
 *
 * Describes the optional configuration for tools support.
 * When true, uses default configuration.
 */
export interface MCPToolsCapability {
  /** Optional tool capability configuration */
  listChanged?: boolean; // Indicates tools list can change dynamically
}

/**
 * Resources capability configuration
 *
 * Describes the optional configuration for resources support.
 * When true, uses default configuration.
 */
export interface MCPResourcesCapability {
  /** Optional resource capability configuration */
  subscribe?: boolean; // Server supports resource subscription
  listChanged?: boolean; // Indicates resources list can change dynamically
}

/**
 * Prompts capability configuration
 *
 * Describes the optional configuration for prompts support.
 * When true, uses default configuration.
 */
export interface MCPPromptsCapability {
  /** Optional prompt capability configuration */
  listChanged?: boolean; // Indicates prompts list can change dynamically
}

/**
 * Server information returned by initialize method
 *
 * The server provides its name, version, and protocol version
 * during initialization so clients can verify compatibility.
 */
export interface MCPServerInfo {
  /** Server name (e.g., "filesystem", "brave-search") */
  name: string;
  /** Server version (semver recommended) */
  version: string;
  /** MCP protocol version supported (e.g., "2025-11-25") */
  protocolVersion: string;
  /** Server capabilities */
  capabilities: MCPServerCapabilities;
}

// ============================================================================
// MCP Tool Types
// ============================================================================

/**
 * MCP Tool definition
 *
 * Tools are functions that the AI model can execute. Each tool has
 * a name, description, and input schema defining its parameters.
 *
 * ### Tool Selection Strategy
 *
 * When an agent needs to call a tool, the MCP router:
 * 1. Analyzes the agent's intent (e.g., "search the web")
 * 2. Matches available tools by name and description
 * 3. Selects the best tool based on capability matching
 * 4. Invokes the tool and returns results to the agent
 *
 * ### Cost Implications
 *
 * - Tool calls add latency (network round-trip)
 * - Tool results count as input tokens for subsequent LLM calls
 * - Some tools may have their own costs (e.g., premium APIs)
 */
export interface MCPTool {
  /** Unique tool identifier (e.g., "brave_search") */
  name: string;
  /** Human-readable tool description (shown to LLM) */
  description: string;
  /** JSON Schema for tool input parameters */
  inputSchema: MCPToolInputSchema;
}

/**
 * Tool input schema (JSON Schema format)
 *
 * Defines the structure of parameters expected by the tool.
 * Follows JSON Schema Draft 2020-12 or compatible format.
 */
export interface MCPToolInputSchema {
  /** Must be "object" for tool inputs */
  type: 'object';
  /** Parameter definitions */
  properties: Record<string, MCPToolParameter>;
  /** Required parameter names */
  required?: string[];
  /** Additional schema constraints */
  additionalProperties?: boolean;
  /** Schema title (optional) */
  title?: string;
  /** Schema description (optional) */
  description?: string;
  /** Dollar schema reference (optional) */
  $schema?: string;
}

/**
 * Tool parameter definition
 *
 * Each parameter has a type, description, and optional constraints.
 * Primitives include string, number, boolean, array, object.
 */
export interface MCPToolParameter {
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  /** Human-readable parameter description */
  description?: string;
  /** Enum of allowed values (optional) */
  enum?: string[] | number[] | boolean[];
  /** Array item schema (if type is "array") */
  items?: MCPToolParameter;
  /** Object property schemas (if type is "object") */
  properties?: Record<string, MCPToolParameter>;
  /** Whether parameter is required */
  required?: string[];
  /** Default value (optional) */
  default?: unknown;
}

/**
 * Tool call request
 *
 * Sent from client to server to execute a specific tool with arguments.
 */
export interface MCPToolCallRequest {
  /** Name of the tool to call */
  name: string;
  /** Tool input arguments (must match inputSchema) */
  arguments?: Record<string, unknown>;
}

/**
 * Tool call response content
 *
 * Tool results are returned as content blocks. Each block has a type
 * (text, image, resource) and associated data.
 */
export interface MCPToolCallResponse {
  /** Array of content blocks from tool execution */
  content: MCPContentBlock[];
  /** Whether tool execution is complete (for multi-step tools) */
  isError?: boolean;
}

/**
 * Content block types
 *
 * Tools can return various content types: text, images, embedded resources.
 * This allows tools to return rich, structured data.
 */
export type MCPContentBlock =
  | MCPTextContent
  | MCPImageContent
  | MCPResourceContent;

/**
 * Text content block
 *
 * Plain text output from a tool. Most common return type.
 */
export interface MCPTextContent {
  /** Content type */
  type: 'text';
  /** Text content */
  text: string;
}

/**
 * Image content block
 *
 * Binary image data returned by a tool (e.g., screenshot, diagram).
 */
export interface MCPImageContent {
  /** Content type */
  type: 'image';
  /** Image data (base64 or URL) */
  data: string;
  /** MIME type */
  mimeType: string;
}

/**
 * Embedded resource content block
 *
 * References a resource URI with optional annotation text.
 */
export interface MCPResourceContent {
  /** Content type */
  type: 'resource';
  /** Resource URI */
  uri: string;
  /** Optional annotation text */
  text?: string;
}

// ============================================================================
// MCP Resource Types
// ============================================================================

/**
 * MCP Resource definition
 *
 * Resources are contextual data that can be provided to the AI model.
 * They represent files, database entries, API responses, etc.
 */
export interface MCPResource {
  /** Unique resource URI (e.g., "file:///path/to/file.txt") */
  uri: string;
  /** Resource name (display name) */
  name: string;
  /** Human-readable resource description */
  description?: string;
  /** Resource MIME type (optional) */
  mimeType?: string;
}

/**
 * Resource content
 *
 * The actual content of a resource when read.
 */
export interface MCPResourceContents {
  /** Resource URI */
  uri: string;
  /** Content blocks (text, image, etc.) */
  contents: MCPContentBlock[];
}

/**
 * Resource template
 *
 * Defines a pattern for resources with dynamic URIs (e.g., "file://{path}").
 */
export interface MCPResourceTemplate {
  /** URI template pattern (e.g., "file://{path}") */
  uriTemplate: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** MIME type for resources matching this template */
  mimeType?: string;
}

/**
 * Resource subscription request
 *
 * Subscribe to updates for a specific resource.
 */
export interface MCPResourceSubscribeRequest {
  /** Resource URI to subscribe to */
  uri: string;
}

/**
 * Resource unsubscribe request
 *
 * Unsubscribe from resource updates.
 */
export interface MCPResourceUnsubscribeRequest {
  /** Resource URI to unsubscribe from */
  uri: string;
}

// ============================================================================
// MCP Prompt Types
// ============================================================================

/**
 * MCP Prompt definition
 *
 * Prompts are pre-defined templates that can be filled with arguments
 * and sent to the AI model. Useful for common workflows.
 */
export interface MCPPrompt {
  /** Unique prompt identifier */
  name: string;
  /** Human-readable prompt description */
  description?: string;
  /** Prompt argument definitions */
  arguments?: MCPPromptArgument[];
}

/**
 * Prompt argument definition
 *
 * Defines a named argument for a prompt template.
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Whether argument is required */
  required?: boolean;
}

/**
 * Prompt message
 *
 * A single message within a prompt template.
 */
export interface MCPPromptMessage {
  /** Message role (user, assistant, system) */
  role: 'user' | 'assistant' | 'system';
  /** Message content (text or content blocks) */
  content: string | MCPContentBlock[];
}

/**
 * Get prompt request
 *
 * Retrieve a specific prompt with arguments filled in.
 */
export interface MCPGetPromptRequest {
  /** Prompt name or URI */
  name: string;
  /** Prompt argument values */
  arguments?: Record<string, unknown>;
}

/**
 * Get prompt response
 *
 * Returns the prompt messages and optional metadata.
 */
export interface MCPGetPromptResponse {
  /** Prompt messages ready to send to LLM */
  messages: MCPPromptMessage[];
  /** Optional prompt metadata */
  description?: string;
  /** Optional resource URIs referenced by prompt */
  _meta?: {
    /** Array of resource URIs */
    resources?: Array<{
      /** Resource URI */
      uri: string;
      /** Optional annotation text */
      text?: string;
    }>;
  };
}

// ============================================================================
// MCP Client Configuration
// ============================================================================

/**
 * MCP server connection configuration
 *
 * Defines how to connect to an MCP server. Servers can be local
 * (stdio) or remote (HTTP/WebSocket).
 */
export interface MCPServerConfig {
  /** Unique server identifier (for routing and logging) */
  id: string;
  /** Human-readable server name */
  name: string;
  /** Server connection type */
  transport: 'stdio' | 'http' | 'websocket';
  /** Connection endpoint (command for stdio, URL for http/websocket) */
  endpoint: string;
  /** Optional environment variables for stdio servers */
  env?: Record<string, string>;
  /** Server capabilities (discovered during initialization) */
  capabilities?: MCPServerCapabilities;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable/disable this server */
  enabled?: boolean;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Optional headers for HTTP transport */
  headers?: Record<string, string>;
}

/**
 * MCP client configuration
 *
 * Overall configuration for the MCP client, including all servers
 * and global settings.
 */
export interface MCPClientConfig {
  /** List of MCP servers to connect to */
  servers: MCPServerConfig[];
  /** Global timeout for tool calls (ms) */
  defaultTimeout?: number;
  /** Maximum concurrent tool calls */
  maxConcurrentCalls?: number;
  /** Enable request/response logging */
  logging?: boolean;
  /** Cost tracking enabled */
  costTracking?: boolean;
}

// ============================================================================
// MCP Tool Selection Strategy
// ============================================================================

/**
 * Tool selection criteria
 *
 * Used by the MCP router to select the best tool for a given intent.
 * Higher scores indicate better matches.
 */
export interface MCPToolSelection {
  /** Server containing the tool */
  serverId: string;
  /** Tool name */
  toolName: string;
  /** Match score (0-1, higher is better) */
  score: number;
  /** Match reason (for logging) */
  reason: string;
}

/**
 * Intent classification for tool selection
 *
 * Maps user intents to tool categories for efficient routing.
 */
export type MCPToolIntent =
  | 'search'          // Web search, documentation lookup
  | 'database'        // Database queries
  | 'filesystem'      // File operations
  | 'github'          // Repository operations
  | 'api'             // Generic API calls
  | 'computation'     // Math, data processing
  | 'unknown';        // Unable to classify

/**
 * Tool cost estimate
 *
 * Estimated cost for calling a specific tool. Used for cost optimization.
 */
export interface MCPToolCost {
  /** Estimated latency in milliseconds */
  latencyMs: number;
  /** Estimated token count for result */
  estimatedTokens: number;
  /** Direct cost in USD (if any) */
  directCost: number;
  /** Cost category (free, low, medium, high) */
  costCategory: 'free' | 'low' | 'medium' | 'high';
}

// ============================================================================
// MCP Request/Response Wrappers
// ============================================================================

/**
 * MCP request wrapper
 *
 * Wraps a raw MCP request with metadata for routing and tracking.
 */
export interface MCPClientRequest extends MCPRequest {
  /** Target server ID (optional, auto-routed if omitted) */
  _serverId?: string;
  /** Request timestamp for latency tracking */
  _timestamp?: number;
  /** Request ID for correlation */
  _requestId?: string;
}

/**
 * MCP response wrapper
 *
 * Wraps a raw MCP response with metadata for analysis.
 */
export interface MCPClientResponse extends MCPResponse {
  /** Source server ID */
  _serverId?: string;
  /** Response timestamp */
  _timestamp?: number;
  /** Request ID for correlation */
  _requestId?: string;
  /** Latency in milliseconds */
  _latencyMs?: number;
}

// ============================================================================
// MCP Error Types
// ============================================================================

/**
 * MCP client error types
 *
 * Categorizes errors that can occur during MCP operations.
 */
export type MCPClientErrorType =
  | 'connection_failed'    // Cannot connect to server
  | 'timeout'             // Request timed out
  | 'invalid_response'    // Invalid JSON-RPC response
  | 'tool_not_found'      // Requested tool does not exist
  | 'tool_execution_failed' // Tool execution failed
  | 'resource_not_found'  // Requested resource does not exist
  | 'invalid_params'      // Invalid tool parameters
  | 'server_error'        // Server returned an error
  | 'unknown';            // Unknown error type

/**
 * MCP client error
 *
 * Detailed error information for failed MCP operations.
 */
export interface MCPClientError extends Error {
  /** Error type */
  type: MCPClientErrorType;
  /** Server ID (if applicable) */
  serverId?: string;
  /** Original error (if wrapping another error) */
  cause?: Error;
  /** Request that caused the error */
  request?: MCPRequest;
}

// ============================================================================
// Common MCP Server Types (for pre-configured integrations)
// ============================================================================

/**
 * Pre-configured MCP server types
 *
 * Common MCP servers that can be easily configured.
 */
export type PreconfiguredMCPServer =
  | 'brave-search'      // Brave Search API
  | 'serper'            // Serper Google Search API
  | 'postgres'          // PostgreSQL database
  | 'mysql'             // MySQL database
  | 'sqlite'            // SQLite database
  | 'filesystem'        // Local filesystem access
  | 'github'            // GitHub repository access
  | 'memory'            // In-memory key-value store
  | 'sequential-thinking'; // Multi-step reasoning

/**
 * Pre-configured server configurations
 *
 * Default settings for common MCP servers.
 */
export const PRECONFIGURED_SERVERS: Record<
  PreconfiguredMCPServer,
  Partial<MCPServerConfig>
> = {
  'brave-search': {
    name: 'Brave Search',
    transport: 'http',
    endpoint: 'https://api.search.brave.com/res/v1/web/search', // Placeholder
    capabilities: { tools: true },
  },
  'serper': {
    name: 'Serper Search',
    transport: 'http',
    endpoint: 'https://google.serper.dev/search', // Placeholder
    capabilities: { tools: true },
  },
  'postgres': {
    name: 'PostgreSQL',
    transport: 'http',
    endpoint: 'http://localhost:8080', // Example MCP postgres server
    capabilities: { resources: true, tools: true },
  },
  'mysql': {
    name: 'MySQL',
    transport: 'http',
    endpoint: 'http://localhost:8081', // Example MCP mysql server
    capabilities: { resources: true, tools: true },
  },
  'sqlite': {
    name: 'SQLite',
    transport: 'stdio',
    endpoint: 'mcp-server-sqlite', // Assumes installed npm package
    capabilities: { resources: true, tools: true },
  },
  'filesystem': {
    name: 'Filesystem',
    transport: 'stdio',
    endpoint: 'mcp-server-filesystem', // Assumes installed npm package
    capabilities: { resources: true, tools: true },
  },
  'github': {
    name: 'GitHub',
    transport: 'stdio',
    endpoint: 'mcp-server-github', // Assumes installed npm package
    capabilities: { tools: true, resources: true },
  },
  'memory': {
    name: 'Memory',
    transport: 'stdio',
    endpoint: 'mcp-server-memory', // Assumes installed npm package
    capabilities: { resources: true, tools: true },
  },
  'sequential-thinking': {
    name: 'Sequential Thinking',
    transport: 'stdio',
    endpoint: 'mcp-server-sequential-thinking', // Assumes installed npm package
    capabilities: { prompts: true },
  },
};
