/**
 * StudyLoG.AI - MCP Server
 *
 * Model Context Protocol server that exposes agent tools
 * for use with Claude and other MCP-compatible clients.
 */

import type { ToolDefinition, AgentContext } from '../core/types';

// MCP Protocol types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
}

// Tool handlers
type ToolHandler = (
  args: Record<string, unknown>,
  context: AgentContext
) => Promise<unknown>;

export class MCPAgentServer {
  private tools: Map<string, { definition: MCPToolDefinition; handler: ToolHandler }> = new Map();
  private context: AgentContext;

  constructor(context: AgentContext) {
    this.context = context;
    this.registerDefaultTools();
  }

  // Get server info
  getServerInfo(): MCPServerInfo {
    return {
      name: 'studylog-agents',
      version: '0.1.0',
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
    };
  }

  // Register a tool
  registerTool(
    definition: ToolDefinition,
    handler: ToolHandler
  ): void {
    const mcpDef: MCPToolDefinition = {
      name: definition.name,
      description: definition.description,
      inputSchema: definition.parameters,
    };
    this.tools.set(definition.name, { definition: mcpDef, handler });
  }

  // Register default StudyLoG tools
  private registerDefaultTools(): void {
    // Game control tools
    this.registerTool(
      {
        name: 'studylog_load_module',
        description: 'Load a learning module',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'Module to load',
              enum: ['cognitive-mill', 'sitka-sound', 'intelligence-ranch'],
            },
          },
          required: ['module'],
        },
      },
      async (args) => {
        this.context.module = args.module as AgentContext['module'];
        this.context.stage = 1;
        return { success: true, module: args.module, stage: 1 };
      }
    );

    this.registerTool(
      {
        name: 'studylog_get_progress',
        description: 'Get student progress in current module',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      async () => ({
        module: this.context.module,
        stage: this.context.stage,
        phase: this.context.phase,
        student: this.context.student,
      })
    );

    this.registerTool(
      {
        name: 'studylog_advance_stage',
        description: 'Advance to the next stage',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      async () => {
        this.context.stage++;
        return { success: true, newStage: this.context.stage };
      }
    );

    this.registerTool(
      {
        name: 'studylog_provide_hint',
        description: 'Provide a hint to the student',
        parameters: {
          type: 'object',
          properties: {
            level: {
              type: 'number',
              description: 'Hint level (1=vague, 2=moderate, 3=explicit)',
            },
            topic: {
              type: 'string',
              description: 'Topic the hint is about',
            },
          },
          required: ['level', 'topic'],
        },
      },
      async (args) => {
        const hints = [
          `Think about ${args.topic} from a different angle.`,
          `Consider how ${args.topic} relates to what you learned earlier.`,
          `The key to ${args.topic} is understanding the underlying pattern.`,
        ];
        return {
          hint: hints[Math.min((args.level as number) - 1, 2)],
          level: args.level,
        };
      }
    );

    this.registerTool(
      {
        name: 'studylog_game_command',
        description: 'Send a command to the game engine',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command type',
              enum: ['load_scene', 'pause', 'resume', 'set_variable', 'trigger_event'],
            },
            payload: {
              type: 'object',
              description: 'Command payload',
            },
          },
          required: ['command'],
        },
      },
      async (args) => ({
        queued: true,
        command: args.command,
        payload: args.payload,
      })
    );

    this.registerTool(
      {
        name: 'studylog_assess_understanding',
        description: 'Assess student understanding of a concept',
        parameters: {
          type: 'object',
          properties: {
            concept: {
              type: 'string',
              description: 'Concept to assess',
            },
            evidence: {
              type: 'string',
              description: 'Evidence of understanding (student action/answer)',
            },
          },
          required: ['concept', 'evidence'],
        },
      },
      async (args) => ({
        concept: args.concept,
        assessed: true,
        // In real implementation, this would use AI to evaluate
        understanding: 'partial',
        recommendation: 'Continue with guided practice',
      })
    );
  }

  // Handle MCP request
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case 'initialize':
          return this.success(request.id, this.getServerInfo());

        case 'tools/list':
          return this.success(request.id, {
            tools: Array.from(this.tools.values()).map((t) => t.definition),
          });

        case 'tools/call':
          return this.handleToolCall(request);

        case 'resources/list':
          return this.success(request.id, { resources: [] });

        case 'prompts/list':
          return this.success(request.id, { prompts: [] });

        default:
          return this.error(request.id, -32601, `Method not found: ${request.method}`);
      }
    } catch (err) {
      const error = err as Error;
      return this.error(request.id, -32603, error.message);
    }
  }

  // Handle tool call
  private async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params as { name: string; arguments?: Record<string, unknown> };
    const toolName = params.name;
    const toolArgs = params.arguments || {};

    const tool = this.tools.get(toolName);
    if (!tool) {
      return this.error(request.id, -32602, `Unknown tool: ${toolName}`);
    }

    try {
      const result = await tool.handler(toolArgs, this.context);
      return this.success(request.id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
    } catch (err) {
      const error = err as Error;
      return this.error(request.id, -32603, `Tool error: ${error.message}`);
    }
  }

  // Success response
  private success(id: string | number, result: unknown): MCPResponse {
    return { jsonrpc: '2.0', id, result };
  }

  // Error response
  private error(id: string | number, code: number, message: string): MCPResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  // List all tools
  listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  // Call a tool directly
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.handler(args, this.context);
  }

  // Update context
  setContext(context: AgentContext): void {
    this.context = context;
  }
}

// Create MCP server for stdio communication
export async function startMCPServer(): Promise<void> {
  const context: AgentContext = {
    module: 'cognitive-mill',
    stage: 1,
    phase: 'player',
    conversationHistory: [],
    agentState: {},
  };

  const server = new MCPAgentServer(context);

  // Read from stdin, write to stdout
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on('line', async (line) => {
    try {
      const request = JSON.parse(line) as MCPRequest;
      const response = await server.handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (error) {
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: 0,
        error: { code: -32700, message: 'Parse error' },
      };
      console.log(JSON.stringify(errorResponse));
    }
  });

  // Send initialize notification
  console.error('StudyLoG MCP Server started');
}
