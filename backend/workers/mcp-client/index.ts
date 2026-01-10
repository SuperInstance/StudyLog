/**
 * MCP Client - Package Index
 *
 * Model Context Protocol client for connecting agents to external tools,
 * databases, and services.
 *
 * ### Quick Start
 *
 * ```typescript
 * import { createMCPClient } from './mcp-client';
 *
 * const client = createMCPClient(['brave-search', 'filesystem'], [], {
 *   logging: true,
 *   costTracking: true,
 * });
 *
 * await client.connectAll();
 *
 * // Call a tool
 * const result = await client.callTool('brave-search', 'search', {
 *   query: 'latest AI news',
 *   count: 5,
 * });
 * ```
 *
 * @module mcp-client
 */

// Export core types and client
export * from './types';
export * from './client';

// Export server integrations
export * from './servers/index';
export * from './servers/tools';

// Re-export commonly used items for convenience
export { createMCPClient, MCPClient, MCPServerConnection } from './client';
export { createMCPRouter, MCPRouter } from '../mcp-router';
