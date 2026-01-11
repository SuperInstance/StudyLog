/**
 * Command Palette Integration
 *
 * Registers IDE commands for the Theia command palette.
 */

import type { Command, CommandResult, CommandAction } from '../types/index.js';

// ============================================================================
// Command Registry
// ============================================================================

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  /**
   * Register multiple commands
   */
  registerAll(commands: Command[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Unregister a command
   */
  unregister(commandId: string): void {
    this.commands.delete(commandId);
  }

  /**
   * Get a command
   */
  get(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  /**
   * List all commands
   */
  list(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * List commands by category
   */
  listByCategory(category: string): Command[] {
    return this.list().filter(c => c.category === category);
  }

  /**
   * Execute a command
   */
  async execute(commandId: string, params: Record<string, unknown> = {}): Promise<CommandResult> {
    const command = this.commands.get(commandId);

    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandId}`,
      };
    }

    try {
      return await command.handler(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
      };
    }
  }

  /**
   * Search commands by query
   */
  search(query: string): Command[] {
    const lower = query.toLowerCase();
    return this.list().filter(c =>
      c.title.toLowerCase().includes(lower) ||
      c.id.toLowerCase().includes(lower) ||
      c.description?.toLowerCase().includes(lower)
    );
  }
}

// ============================================================================
// Built-in Commands
// ============================================================================

/**
 * Create built-in IDE automation commands
 */
export function createBuiltinCommands(): Command[] {
  return [
    {
      id: 'ide.chat.open',
      title: 'Open AI Chat',
      category: 'AI',
      icon: 'fa-comments',
      keybinding: 'ctrl+shift+a',
      description: 'Open the AI chat panel for coding assistance',
      handler: async (params) => ({
        success: true,
        data: { panel: 'chat', position: 'right' },
        actions: [
          {
            label: 'Start New Conversation',
            type: 'primary',
            action: 'chat.new',
          },
        ],
      }),
    },
    {
      id: 'ide.code.explain',
      title: 'Explain Code',
      category: 'AI',
      icon: 'fa-question-circle',
      keybinding: 'ctrl+shift+e',
      description: 'Get an explanation of the selected code',
      handler: async (params) => {
        const selection = params.selection as string | undefined;
        if (!selection) {
          return {
            success: false,
            error: 'No code selected',
            actions: [
              {
                label: 'Select Code First',
                type: 'secondary',
                action: 'editor.selectAll',
              },
            ],
          };
        }
        return {
          success: true,
          data: { explanation: 'Code explanation would appear here' },
        };
      },
    },
    {
      id: 'ide.code.refactor',
      title: 'Refactor Code',
      category: 'AI',
      icon: 'fa-magic',
      keybinding: 'ctrl+shift+r',
      description: 'AI-powered refactoring of selected code',
      handler: async (params) => ({
        success: true,
        data: { refactored: true },
      }),
    },
    {
      id: 'ide.code.fix',
      title: 'Fix Errors',
      category: 'AI',
      icon: 'fa-wrench',
      keybinding: 'ctrl+shift+f',
      description: 'Automatically fix errors in the current file',
      handler: async (params) => ({
        success: true,
        data: { fixes: [] },
      }),
    },
    {
      id: 'ide.test.generate',
      title: 'Generate Tests',
      category: 'Testing',
      icon: 'fa-flask',
      description: 'Generate unit tests for the current file',
      handler: async (params) => ({
        success: true,
        data: { testFile: 'example.test.ts' },
      }),
    },
    {
      id: 'ide.test.run',
      title: 'Run Tests',
      category: 'Testing',
      icon: 'fa-play',
      keybinding: 'ctrl+shift+t',
      description: 'Run all tests in the workspace',
      handler: async (params) => ({
        success: true,
        data: { results: { passed: 47, failed: 3, duration: 1234 } },
      }),
    },
    {
      id: 'ide.test.coverage',
      title: 'Show Coverage',
      category: 'Testing',
      icon: 'fa-chart-bar',
      description: 'Show test coverage report',
      handler: async (params) => ({
        success: true,
        data: { coverage: 78 },
      }),
    },
    {
      id: 'ide.agent.start',
      title: 'Start Agent Task',
      category: 'AI',
      icon: 'fa-robot',
      description: 'Start an autonomous agent task',
      handler: async (params) => {
        const prompt = params.prompt as string | undefined;
        if (!prompt) {
          return {
            success: false,
            error: 'Prompt required',
            actions: [
              {
                label: 'Enter Prompt',
                type: 'primary',
                action: 'agent.prompt',
              },
            ],
          };
        }
        return {
          success: true,
          data: { taskId: 'task_123', status: 'running' },
        };
      },
    },
    {
      id: 'ide.job.list',
      title: 'List Background Jobs',
      category: 'Background',
      icon: 'fa-tasks',
      description: 'Show all running and queued background jobs',
      handler: async (params) => ({
        success: true,
        data: { jobs: [] },
      }),
    },
    {
      id: 'ide.diff.compare',
      title: 'Compare Files',
      category: 'Tools',
      icon: 'fa-columns',
      description: 'Compare two files side by side',
      handler: async (params) => ({
        success: true,
        data: { diff: {} },
      }),
    },
    {
      id: 'ide.context.build',
      title: 'Build Context',
      category: 'Tools',
      icon: 'fa-database',
      description: 'Build AI context from current workspace',
      handler: async (params) => ({
        success: true,
        data: { tokens: 12345, files: 12 },
      }),
    },
  ];
}

/**
 * Create command registry with built-in commands
 */
export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();
  registry.registerAll(createBuiltinCommands());
  return registry;
}
