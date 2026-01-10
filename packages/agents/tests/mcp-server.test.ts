/**
 * StudyLoG.AI - MCP Server Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MCPAgentServer } from '../src/tools/mcp-server';
import type { AgentContext, Message } from '../src/core/types';

describe('MCPAgentServer', () => {
  let server: MCPAgentServer;
  let context: AgentContext;

  beforeEach(() => {
    context = {
      module: 'cognitive-mill',
      stage: 1,
      phase: 'player',
      conversationHistory: [],
      agentState: {},
    };
    server = new MCPAgentServer(context);
  });

  describe('server info', () => {
    it('should return valid server info', () => {
      const info = server.getServerInfo();
      expect(info.name).toBe('studylog-agents');
      expect(info.version).toBe('0.1.0');
      expect(info.capabilities.tools).toBe(true);
    });
  });

  describe('tool listing', () => {
    it('should list default tools', () => {
      const tools = server.listTools();
      expect(tools.length).toBeGreaterThan(0);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('studylog_load_module');
      expect(toolNames).toContain('studylog_get_progress');
      expect(toolNames).toContain('studylog_advance_stage');
    });
  });

  describe('MCP protocol', () => {
    it('should handle initialize request', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });

      expect(response.result).toBeDefined();
      expect((response.result as any).name).toBe('studylog-agents');
    });

    it('should handle tools/list request', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(response.result).toBeDefined();
      expect((response.result as any).tools).toBeInstanceOf(Array);
    });

    it('should handle unknown method', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'unknown/method',
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
    });
  });

  describe('tool execution', () => {
    it('should execute studylog_get_progress', async () => {
      const result = await server.callTool('studylog_get_progress', {});

      expect(result).toEqual({
        module: 'cognitive-mill',
        stage: 1,
        phase: 'player',
        student: undefined,
      });
    });

    it('should execute studylog_load_module', async () => {
      const result = await server.callTool('studylog_load_module', {
        module: 'sitka-sound',
      }) as { success: boolean; module: string };

      expect(result.success).toBe(true);
      expect(result.module).toBe('sitka-sound');
    });

    it('should execute studylog_advance_stage', async () => {
      const result = await server.callTool('studylog_advance_stage', {}) as { success: boolean; newStage: number };

      expect(result.success).toBe(true);
      expect(result.newStage).toBe(2);
    });

    it('should execute studylog_provide_hint', async () => {
      const result = await server.callTool('studylog_provide_hint', {
        level: 1,
        topic: 'gear ratios',
      }) as { hint: string; level: number };

      expect(result.hint).toBeTruthy();
      expect(result.level).toBe(1);
    });

    it('should throw on unknown tool', async () => {
      await expect(server.callTool('unknown_tool', {})).rejects.toThrow('Unknown tool');
    });
  });

  describe('tools/call request', () => {
    it('should handle valid tool call', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'studylog_get_progress',
          arguments: {},
        },
      });

      expect(response.result).toBeDefined();
      expect((response.result as any).content).toBeInstanceOf(Array);
    });

    it('should handle unknown tool call', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });
  });
});
