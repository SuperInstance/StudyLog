/**
 * Action Executor Module
 *
 * Parses agent plans into LimboAI behavior tree tasks
 * and executes them via the Godot bridge.
 */

import type {
  BeingStateEnv,
  ExecutedAction,
  LimboTaskExecution,
  GodotCommand,
  AgentUpdate,
  GameplayMutation,
} from './types';

// ============================================================================
// Action Parsing
// ============================================================================

/**
 * Parsed action from agent plan
 */
interface ParsedAction {
  taskType: string;
  nodeName: string;
  parameters: Record<string, unknown>;
  priority: number;
  timeout: number;
}

// ============================================================================
// LimboAI Task Mappings
// ============================================================================

/**
 * Mapping from natural language actions to LimboAI tasks
 */
const ACTION_MAPPINGS: Record<string, ParsedAction> = {
  move: {
    taskType: 'MoveToPosition',
    nodeName: 'move_to',
    parameters: { target: 'position', speed: 'default' },
    priority: 5,
    timeout: 10000,
  },

  attack: {
    taskType: 'AttackTarget',
    nodeName: 'attack',
    parameters: { target: 'enemy_target', weapon: 'primary' },
    priority: 8,
    timeout: 5000,
  },

  defend: {
    taskType: 'DefendPosition',
    nodeName: 'defend',
    parameters: { position: 'current', radius: 5 },
    priority: 7,
    timeout: 30000,
  },

  patrol: {
    taskType: 'PatrolRoute',
    nodeName: 'patrol',
    parameters: { route: 'default', loop: true },
    priority: 4,
    timeout: 60000,
  },

  hide: {
    taskType: 'FindCover',
    nodeName: 'find_cover',
    parameters: { from: 'nearest_threat' },
    priority: 9,
    timeout: 5000,
  },

  observe: {
    taskType: 'ObserveArea',
    nodeName: 'observe',
    parameters: { area: 'front', duration: 3000 },
    priority: 3,
    timeout: 5000,
  },

  wait: {
    taskType: 'Wait',
    nodeName: 'wait',
    parameters: { duration: 1000 },
    priority: 1,
    timeout: 60000,
  },

  follow: {
    taskType: 'FollowTarget',
    nodeName: 'follow',
    parameters: { target: 'player', distance: 3 },
    priority: 6,
    timeout: 30000,
  },

  heal: {
    taskType: 'HealAlly',
    nodeName: 'heal',
    parameters: { target: 'lowest_health_ally' },
    priority: 8,
    timeout: 8000,
  },

  build: {
    taskType: 'BuildStructure',
    nodeName: 'build',
    parameters: { structure: 'default', position: 'current' },
    priority: 5,
    timeout: 20000,
  },

  gather: {
    taskType: 'GatherResource',
    nodeName: 'gather',
    parameters: { resource: 'nearest', amount: 10 },
    priority: 4,
    timeout: 15000,
  },

  retreat: {
    taskType: 'Retreat',
    nodeName: 'retreat',
    parameters: { to: 'safety', speed: 'fast' },
    priority: 10,
    timeout: 8000,
  },
};

// ============================================================================
// Action Executor Class
// ============================================================================

export class ActionExecutor {
  private env: BeingStateEnv;
  private activeExecutions: Map<string, ExecutedAction> = new Map();
  private godotBridgeUrl: string;

  constructor(env: BeingStateEnv) {
    this.env = env;
    this.godotBridgeUrl = env.GODOT_BRIDGE_URL || 'ws://localhost:9876';
  }

  // ========================================================================
  // Plan Parsing
  // ========================================================================

  /**
   * Parse agent plan into executable actions
   */
  parsePlan(agentId: string, plan: string): ParsedAction[] {
    const actions: ParsedAction[] = [];

    // Split plan into sentences/lines
    const lines = plan.split(/[.\n]/).filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      // Match against known action mappings
      for (const [keyword, mapping] of Object.entries(ACTION_MAPPINGS)) {
        if (trimmed.includes(keyword)) {
          // Extract parameters from line
          const params = this.extractParameters(trimmed, mapping);

          actions.push({
            ...mapping,
            parameters: { ...mapping.parameters, ...params },
          });

          break;
        }
      }
    }

    // If no actions found, add default wait action
    if (actions.length === 0) {
      actions.push(ACTION_MAPPINGS.wait);
    }

    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Extract parameters from natural language action
   */
  private extractParameters(
    text: string,
    mapping: ParsedAction
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract positions (e.g., "move to 10, 20, 30")
    const positionMatch = text.match(/(?:at|to|position)\s*\[?\s*(-?\d+)[,\s]+(-?\d+)[,\s]+(-?\d+)/);
    if (positionMatch) {
      params.position = [
        parseFloat(positionMatch[1]),
        parseFloat(positionMatch[2]),
        parseFloat(positionMatch[3]),
      ];
    }

    // Extract targets (e.g., "attack enemy_1")
    const targetMatch = text.match(/(?:attack|heal|follow)\s+(\w+)/);
    if (targetMatch) {
      params.target = targetMatch[1];
    }

    // Extract resources (e.g., "gather wood")
    const resourceMatch = text.match(/gather\s+(\w+)/);
    if (resourceMatch) {
      params.resource = resourceMatch[1];
    }

    // Extract durations (e.g., "wait 5 seconds")
    const durationMatch = text.match(/(\d+)\s*(?:second|sec)s?/);
    if (durationMatch) {
      params.duration = parseInt(durationMatch[1]) * 1000;
    }

    // Extract speed modifiers (e.g., "move fast", "run")
    if (text.includes('fast') || text.includes('run') || text.includes('quickly')) {
      params.speed = 'fast';
    } else if (text.includes('slow') || text.includes('careful')) {
      params.speed = 'slow';
    }

    return params;
  }

  // ========================================================================
  // Action Execution
  // ========================================================================

  /**
   * Execute parsed action via LimboAI
   */
  async executeAction(
    agentId: string,
    action: ParsedAction
  ): Promise<ExecutedAction> {
    const executionId = crypto.randomUUID();

    const execution: ExecutedAction = {
      id: executionId,
      agentId,
      action: action.taskType,
      params: action.parameters,
      status: 'executing',
      timestamp: Date.now(),
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Convert to LimboAI task execution
      const limboTask: LimboTaskExecution = {
        agentId,
        taskId: action.nodeName,
        nodePath: `BehaviorTree/${action.nodeName}`,
        params: action.parameters,
        result: null,
      };

      // Execute via Godot bridge
      const result = await this.executeViaGodot(limboTask);

      execution.status = 'completed';
      execution.result = result;

    } catch (error) {
      execution.status = 'failed';
      execution.error = (error as Error).message;
    }

    return execution;
  }

  /**
   * Execute action via Godot bridge
   */
  private async executeViaGodot(task: LimboTaskExecution): Promise<unknown> {
    // Send command via WebSocket or HTTP
    const command: GodotCommand = {
      type: 'rpc_call',
      target: task.agentId,
      params: {
        method: 'execute_behavior_task',
        task_id: task.taskId,
        node_path: task.nodePath,
        params: task.params,
      },
    };

    // Try WebSocket first
    try {
      return await this.sendViaWebSocket(command);
    } catch (wsError) {
      // Fall back to HTTP
      return await this.sendViaHTTP(command);
    }
  }

  /**
   * Send command via WebSocket (Godot bridge)
   */
  private async sendViaWebSocket(command: GodotCommand): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.godotBridgeUrl);

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Godot bridge WebSocket timeout'));
      }, 5000);

      ws.onopen = () => {
        ws.send(JSON.stringify(command));
      };

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(event.data);
          ws.close();
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${error}`));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
      };
    });
  }

  /**
   * Send command via HTTP (Godot bridge fallback)
   */
  private async sendViaHTTP(command: GodotCommand): Promise<unknown> {
    const httpUrl = this.godotBridgeUrl.replace('ws://', 'http://').replace('wss://', 'https://');

    const response = await fetch(`${httpUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  }

  // ========================================================================
  // Batch Execution
  // ========================================================================

  /**
   * Execute multiple actions in batch
   */
  async executeBatch(
    actions: Array<{ agentId: string; action: ParsedAction }>
  ): Promise<ExecutedAction[]> {
    const executions = await Promise.all(
      actions.map(({ agentId, action }) => this.executeAction(agentId, action))
    );
    return executions;
  }

  /**
   * Execute plan for multiple agents
   */
  async executePlanForAgents(
    agentPlans: Array<{ agentId: string; plan: string }>
  ): Promise<Map<string, ExecutedAction[]>> {
    const results = new Map<string, ExecutedAction[]>();

    for (const { agentId, plan } of agentPlans) {
      const actions = this.parsePlan(agentId, plan);
      const executions: ExecutedAction[] = [];

      for (const action of actions) {
        const execution = await this.executeAction(agentId, action);
        executions.push(execution);

        // Stop if action failed
        if (execution.status === 'failed') {
          break;
        }
      }

      results.set(agentId, executions);
    }

    return results;
  }

  // ========================================================================
  // Agent State Application
  // ========================================================================

  /**
   * Apply agent state update to game
   */
  async applyAgentUpdate(update: AgentUpdate): Promise<boolean> {
    const commands = this.agentUpdateToCommands(update);

    for (const command of commands) {
      try {
        await this.sendViaHTTP(command);
      } catch (error) {
        console.error('[ActionExecutor] Failed to apply command:', command, error);
        return false;
      }
    }

    return true;
  }

  /**
   * Convert agent update to Godot commands
   */
  private agentUpdateToCommands(update: AgentUpdate): GodotCommand[] {
    const commands: GodotCommand[] = [];

    // Set agent state
    commands.push({
      type: 'set_state',
      target: update.target,
      params: {
        state: update.state,
        config: update.config,
      },
    });

    // Update behavior tree
    if (update.config.behaviorTree?.tree) {
      commands.push({
        type: 'rpc_call',
        target: update.target,
        params: {
          method: 'update_behavior_tree',
          tree: update.config.behaviorTree.tree,
        },
      });
    }

    // Update communication settings
    if (update.config.communication) {
      commands.push({
        type: 'rpc_call',
        target: update.target,
        params: {
          method: 'set_communication',
          config: update.config.communication,
        },
      });
    }

    return commands;
  }

  // ========================================================================
  // Gameplay Mutation Application
  // ========================================================================

  /**
   * Apply gameplay mutation to game
   */
  async applyGameplayMutation(mutation: GameplayMutation): Promise<boolean> {
    const command = this.mutationToCommand(mutation);

    try {
      await this.sendViaHTTP(command);
      return true;
    } catch (error) {
      console.error('[ActionExecutor] Failed to apply mutation:', mutation, error);
      return false;
    }
  }

  /**
   * Convert gameplay mutation to Godot command
   */
  private mutationToCommand(mutation: GameplayMutation): GodotCommand {
    let target = '/root/GameRules';
    let method = 'set_rule';

    switch (mutation.type) {
      case 'movement':
        method = 'set_movement_modifier';
        break;
      case 'combat':
        method = 'set_combat_modifier';
        break;
      case 'resource':
        method = 'set_resource_modifier';
        break;
      case 'physics':
        target = '/root/PhysicsManager';
        method = 'set_parameter';
        break;
      case 'time':
        target = '/root/Engine';
        method = 'set_time_scale';
        break;
      case 'camera':
        target = '/root/Camera';
        method = 'set_parameter';
        break;
      case 'gameplay':
        method = 'set_rule';
        break;
      case 'cooldown':
        method = 'set_cooldown_modifier';
        break;
      case 'ai':
        target = '/root/AIManager';
        method = 'set_ai_parameter';
        break;
      case 'ui':
        target = '/root/UI';
        method = 'set_ui_parameter';
        break;
      case 'objective':
        method = 'set_objective';
        break;
    }

    return {
      type: 'rpc_call',
      target,
      params: {
        method,
        rule: mutation.rule,
        value: mutation.value,
        duration: mutation.duration,
      },
    };
  }

  // ========================================================================
  // Execution Monitoring
  // ========================================================================

  /**
   * Get execution status
   */
  getExecutionStatus(executionId: string): ExecutedAction | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Get all active executions for agent
   */
  getAgentExecutions(agentId: string): ExecutedAction[] {
    const executions: ExecutedAction[] = [];

    for (const execution of this.activeExecutions.values()) {
      if (execution.agentId === agentId && execution.status === 'executing') {
        executions.push(execution);
      }
    }

    return executions;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status !== 'executing') {
      return false;
    }

    const command: GodotCommand = {
      type: 'rpc_call',
      target: execution.agentId,
      params: {
        method: 'cancel_task',
        task_id: execution.id,
      },
    };

    try {
      await this.sendViaHTTP(command);
      execution.status = 'failed';
      execution.error = 'Cancelled';
      return true;
    } catch (error) {
      console.error('[ActionExecutor] Failed to cancel execution:', error);
      return false;
    }
  }

  /**
   * Clean up completed executions
   */
  cleanupExecutions(olderThan: number = 60000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, execution] of this.activeExecutions.entries()) {
      if (
        execution.status !== 'executing' &&
        now - execution.timestamp > olderThan
      ) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.activeExecutions.delete(id);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createActionExecutor(env: BeingStateEnv): ActionExecutor {
  return new ActionExecutor(env);
}
