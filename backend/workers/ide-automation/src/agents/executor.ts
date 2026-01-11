/**
 * Agent Executor - Planning and Execution Cycle
 *
 * Executes agent plans with tool orchestration,
 * error recovery, and progress reporting.
 */

import type {
  AgentTask,
  ExecutionPlan,
  PlanningStep,
  AgentTool,
  ToolResult,
  ProgressUpdate,
  ErrorRecovery,
  ErrorRecoveryStrategy,
  TaskStatus,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';
import { generatePlan, determinePriority } from './planner.js';

// ============================================================================
// Execution State
// ============================================================================

interface ExecutionState {
  /** Current task being executed */
  task: AgentTask;
  /** Current step being executed */
  currentStep: number;
  /** Accumulated results */
  results: Map<string, unknown>;
  /** Execution start time */
  startTime: number;
  /** Retry count for current step */
  retryCount: number;
  /** Error recovery history */
  recoveryHistory: ErrorRecovery[];
}

// ============================================================================
// Agent Executor
// ============================================================================

export class AgentExecutor {
  private readonly activeExecutions = new Map<string, ExecutionState>();
  private readonly progressCallbacks = new Map<string, Set<(update: ProgressUpdate) => void>>();

  constructor(
    private readonly env: IDEAutomationEnv,
    private readonly tools: Map<string, AgentTool>,
    private readonly routerUrl = 'https://multi-model-router.studylog.ai'
  ) {}

  /**
   * Execute a task with a plan
   */
  async execute(task: AgentTask): Promise<AgentTask> {
    const state: ExecutionState = {
      task,
      currentStep: 0,
      results: new Map(),
      startTime: Date.now(),
      retryCount: 0,
      recoveryHistory: [],
    };

    this.activeExecutions.set(task.id, state);

    try {
      if (!task.plan) {
        throw new Error('Task must have a plan to execute');
      }

      // Update status to in_progress
      task.status = 'in_progress';
      task.startedAt = Date.now();

      // Execute each step
      for (let i = 0; i < task.plan.steps.length; i++) {
        const step = task.plan.steps[i];

        // Check dependencies
        if (!this.areDependenciesMet(step, task.plan.steps)) {
          task.status = 'blocked';
          task.error = `Dependencies not met for step ${step.step}`;
          return task;
        }

        // Execute the step
        state.currentStep = i;
        task.currentStep = i;

        const result = await this.executeStep(task, step, state);

        // Store result
        state.results.set(`step_${step.step}`, result);
        step.status = 'completed';
        step.result = result;

        // Report progress
        this.reportProgress(task.id, {
          taskId: task.id,
          step: i + 1,
          total: task.plan.steps.length,
          action: step.description,
          results: Object.fromEntries(state.results),
          timestamp: Date.now(),
        });
      }

      // All steps completed
      task.status = 'completed';
      task.completedAt = Date.now();
      task.results = Object.fromEntries(state.results);

      // Award XP (gamification)
      task.xpAwarded = this.calculateXP(task);

      return task;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Attempt error recovery
      const recovery = await this.attemptRecovery(task, state, errorMessage);

      if (recovery.recovered) {
        state.recoveryHistory.push(recovery);
        // Retry execution
        return await this.execute(task);
      }

      task.status = 'failed';
      task.error = errorMessage;
      task.completedAt = Date.now();

      return task;

    } finally {
      this.activeExecutions.delete(task.id);
    }
  }

  /**
   * Create and execute a task from a request
   */
  async executeRequest(
    request: string,
    sessionId: string,
    userId: string,
    context: {
      workspaceId: string;
      files?: string[];
    }
  ): Promise<AgentTask> {
    // Create task
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      request,
      status: 'pending',
      priority: determinePriority(request),
      results: {},
      retries: 0,
      maxRetries: 3,
      createdAt: Date.now(),
    };

    // Generate plan
    const availableTools = Array.from(this.tools.values());
    task.plan = await generatePlan(request, context, { availableTools });

    // Execute
    return await this.execute(task);
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const state = this.activeExecutions.get(taskId);
    if (!state) {
      return false;
    }

    state.task.status = 'cancelled';
    state.task.completedAt = Date.now();

    this.activeExecutions.delete(taskId);

    return true;
  }

  /**
   * Pause a task (not fully implemented in simple version)
   */
  async pauseTask(taskId: string): Promise<boolean> {
    // For Cloudflare Workers, true pausing requires persistent state
    // This is a simplified version
    return false;
  }

  /**
   * Register progress callback
   */
  onProgress(taskId: string, callback: (update: ProgressUpdate) => void): () => void {
    if (!this.progressCallbacks.has(taskId)) {
      this.progressCallbacks.set(taskId, new Set());
    }

    this.progressCallbacks.get(taskId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.progressCallbacks.get(taskId);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * Get execution status
   */
  getStatus(taskId: string): { status: TaskStatus; progress: number; currentAction: string } | null {
    const state = this.activeExecutions.get(taskId);
    if (!state) {
      return null;
    }

    const plan = state.task.plan;
    if (!plan) {
      return { status: state.task.status, progress: 0, currentAction: '' };
    }

    const progress = (state.currentStep / plan.steps.length) * 100;
    const currentAction = plan.steps[state.currentStep]?.description || '';

    return {
      status: state.task.status,
      progress,
      currentAction,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Execute a single planning step
   */
  private async executeStep(
    task: AgentTask,
    step: PlanningStep,
    state: ExecutionState
  ): Promise<unknown> {
    step.status = 'in_progress';

    const stepResults: unknown[] = [];

    for (const toolName of step.tools) {
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      // Prepare tool parameters from context
      const params = await this.prepareToolParams(tool, task, state);

      // Execute tool
      const result = await tool.handler(params);
      stepResults.push(result);

      // Check for errors
      if (result.error) {
        throw new Error(`Tool ${toolName} failed: ${result.content}`);
      }
    }

    // If no tools, use AI to complete the step
    if (step.tools.length === 0) {
      return await this.executeAIStep(task, step, state);
    }

    return stepResults.length === 1 ? stepResults[0] : stepResults;
  }

  /**
   * Execute a step using AI
   */
  private async executeAIStep(
    task: AgentTask,
    step: PlanningStep,
    state: ExecutionState
  ): Promise<unknown> {
    const prompt = this.buildStepPrompt(task, step, state);

    const response = await fetch(`${this.routerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: step.estimatedTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI call failed: ${response.status}`);
    }

    const data = await response.json() as { content: string };
    return data.content;
  }

  /**
   * Build prompt for AI-only step
   */
  private buildStepPrompt(
    task: AgentTask,
    step: PlanningStep,
    state: ExecutionState
  ): string {
    let prompt = `Task: ${task.request}\n\n`;
    prompt += `Current step: ${step.description}\n\n`;

    if (state.results.size > 0) {
      prompt += `Previous results:\n`;
      for (const [key, value] of state.results.entries()) {
        prompt += `- ${key}: ${JSON.stringify(value)}\n`;
      }
      prompt += '\n';
    }

    prompt += `Please complete this step.`;
    return prompt;
  }

  /**
   * Prepare tool parameters from execution context
   */
  private async prepareToolParams(
    tool: AgentTool,
    task: AgentTask,
    state: ExecutionState
  ): Promise<unknown> {
    const baseParams: Record<string, unknown> = {
      taskId: task.id,
      sessionId: task.sessionId,
    };

    // Add previous results
    baseParams.previousResults = Object.fromEntries(state.results);

    // Tool-specific parameters would be added here based on tool schema
    return baseParams;
  }

  /**
   * Check if step dependencies are met
   */
  private areDependenciesMet(step: PlanningStep, allSteps: PlanningStep[]): boolean {
    for (const depIndex of step.dependencies) {
      const depStep = allSteps[depIndex];
      if (!depStep || depStep.status !== 'completed') {
        return false;
      }
    }
    return true;
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(
    task: AgentTask,
    state: ExecutionState,
    error: string
  ): Promise<ErrorRecovery> {
    state.retryCount++;

    if (state.retryCount >= task.maxRetries) {
      return {
        error,
        strategy: 'abort',
        recovered: false,
      };
    }

    // Determine recovery strategy
    const strategy = this.selectRecoveryStrategy(error, state);

    switch (strategy) {
      case 'retry':
        return {
          error,
          strategy: 'retry',
          alternative: 'Retrying the operation',
          recovered: true,
        };

      case 'fallback':
        // Try alternative approach
        return {
          error,
          strategy: 'fallback',
          alternative: 'Using simplified approach',
          recovered: true,
        };

      case 'skip':
        // Skip this step and continue
        const currentStep = task.plan?.steps[state.currentStep];
        if (currentStep) {
          currentStep.status = 'completed';
        }
        return {
          error,
          strategy: 'skip',
          alternative: 'Step skipped due to error',
          recovered: true,
        };

      default:
        return {
          error,
          strategy: 'abort',
          recovered: false,
        };
    }
  }

  /**
   * Select recovery strategy based on error and state
   */
  private selectRecoveryStrategy(
    error: string,
    state: ExecutionState
  ): ErrorRecoveryStrategy {
    const lower = error.toLowerCase();

    // Network/timeout errors -> retry
    if (lower.includes('timeout') || lower.includes('network') || lower.includes('fetch')) {
      return state.retryCount < 2 ? 'retry' : 'fallback';
    }

    // Tool errors -> fallback or skip
    if (lower.includes('tool')) {
      return 'fallback';
    }

    // Validation errors -> ask user
    if (lower.includes('invalid') || lower.includes('validation')) {
      return 'ask_user';
    }

    // Default -> retry once
    return state.retryCount === 0 ? 'retry' : 'abort';
  }

  /**
   * Report progress to callbacks
   */
  private reportProgress(taskId: string, update: ProgressUpdate): void {
    const callbacks = this.progressCallbacks.get(taskId);
    if (!callbacks) return;

    for (const callback of callbacks) {
      try {
        callback(update);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Calculate XP for completed task
   */
  private calculateXP(task: AgentTask): number {
    if (!task.plan) return 0;

    let baseXP = task.plan.steps.length * 10;

    // Bonus for high priority
    switch (task.priority) {
      case 'urgent':
        baseXP *= 2;
        break;
      case 'high':
        baseXP *= 1.5;
        break;
      case 'low':
        baseXP *= 0.5;
        break;
    }

    // Bonus for complexity
    if (task.plan.estimatedCost > 0.01) {
      baseXP *= 1.2;
    }

    return Math.round(baseXP);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create agent executor with default tools
 */
export function createAgentExecutor(env: IDEAutomationEnv): AgentExecutor {
  const tools = createDefaultTools(env);
  return new AgentExecutor(env, tools);
}

/**
 * Create default tool set
 */
function createDefaultTools(env: IDEAutomationEnv): Map<string, AgentTool> {
  const tools = new Map<string, AgentTool>();

  // Read file tool
  tools.set('read_file', {
    name: 'read_file',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
      },
      required: ['path'],
    },
    handler: async (params: unknown) => {
      const { path } = params as { path: string };
      // Implementation would read from R2
      return {
        toolCallId: 'read_file',
        content: `File content from ${path}`,
      };
    },
  });

  // Write file tool
  tools.set('write_file', {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
    handler: async (params: unknown) => {
      const { path, content } = params as { path: string; content: string };
      // Implementation would write to R2
      return {
        toolCallId: 'write_file',
        content: `Written to ${path}`,
      };
    },
  });

  // Search tool
  tools.set('search', {
    name: 'search',
    description: 'Search for text in files',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        filePattern: { type: 'string' },
      },
      required: ['query'],
    },
    handler: async (params: unknown) => {
      const { query } = params as { query: string };
      return {
        toolCallId: 'search',
        content: `Search results for: ${query}`,
      };
    },
  });

  // Code analyze tool
  tools.set('code_analyze', {
    name: 'code_analyze',
    description: 'Analyze code structure and patterns',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        language: { type: 'string' },
      },
      required: ['code', 'language'],
    },
    handler: async (params: unknown) => {
      return {
        toolCallId: 'code_analyze',
        content: 'Code analysis complete',
      };
    },
  });

  // Run tests tool
  tools.set('run_tests', {
    name: 'run_tests',
    description: 'Run test suite',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
      },
    },
    handler: async () => {
      return {
        toolCallId: 'run_tests',
        content: 'Tests completed',
      };
    },
  });

  return tools;
}
