/**
 * Task Queue for StudyLoG.AI Agent Coordinator
 *
 * Priority-based task queue with load balancing strategies
 */

import {
  Task,
  TaskStatus,
  TaskResult,
  LoadBalancingStrategy,
  AgentState,
} from "./types.js";

/**
 * Prioritized task wrapper
 */
interface PrioritizedTask {
  task: Task;
  priority: number;
  createdAt: Date;
}

/**
 * Task assignment tracking
 */
interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  completed: boolean;
  result?: TaskResult;
}

/**
 * Agent interface for task queue
 */
interface AssignableAgent {
  id: string;
  state: AgentState;
  capabilities: string[];
  currentTaskCount: number;
}

/**
 * Task queue statistics
 */
export interface TaskQueueStatistics {
  queueSize: number;
  pending: number;
  assigned: number;
  completed: number;
  loadBalancing: LoadBalancingStrategy;
}

/**
 * Task queue options
 */
export interface TaskQueueOptions {
  /** Load balancing strategy */
  loadBalancing?: LoadBalancingStrategy;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Callback types
 */
type TaskCallback = (task: Task) => void | Promise<void>;
type TaskCompletionCallback = (result: TaskResult) => void | Promise<void>;

/**
 * Priority-based Task Queue
 *
 * Features:
 * - Heap-based priority queue
 * - Multiple load balancing strategies
 * - Task tracking and history
 * - Assignment and retry logic
 */
export class TaskQueue {
  private _queue: PrioritizedTask[] = [];
  private _pendingTasks: Map<string, Task> = new Map();
  private _assignedTasks: Map<string, TaskAssignment> = new Map();
  private _completedTasks: Map<string, TaskResult> = new Map();
  private _loadBalancing: LoadBalancingStrategy;
  private _roundRobinIndex = 0;
  private _maxQueueSize: number;
  private _debug: boolean;

  // Callbacks
  private _onTaskQueued: TaskCallback[] = [];
  private _onTaskAssigned: TaskCallback[] = [];
  private _onTaskCompleted: TaskCompletionCallback[] = [];
  private _onTaskFailed: TaskCallback[] = [];

  constructor(options: TaskQueueOptions = {}) {
    this._loadBalancing = options.loadBalancing ?? LoadBalancingStrategy.LEAST_LOADED;
    this._maxQueueSize = options.maxQueueSize ?? 1000;
    this._debug = options.debug ?? false;
  }

  /** Current queue size */
  get queueSize(): number {
    return this._queue.length;
  }

  /** Number of pending tasks */
  get pendingCount(): number {
    return this._pendingTasks.size;
  }

  /** Number of assigned tasks */
  get assignedCount(): number {
    return this._assignedTasks.size;
  }

  /** Number of completed tasks */
  get completedCount(): number {
    return this._completedTasks.size;
  }

  /** Current load balancing strategy */
  get loadBalancing(): LoadBalancingStrategy {
    return this._loadBalancing;
  }

  /**
   * Set the load balancing strategy
   */
  setLoadBalancing(strategy: LoadBalancingStrategy): void {
    this._loadBalancing = strategy;
    if (this._debug) {
      console.log(`[TaskQueue] Load balancing set to: ${strategy}`);
    }
  }

  /**
   * Register callback for task queued events
   */
  onQueued(callback: TaskCallback): void {
    this._onTaskQueued.push(callback);
  }

  /**
   * Register callback for task assigned events
   */
  onAssigned(callback: TaskCallback): void {
    this._onTaskAssigned.push(callback);
  }

  /**
   * Register callback for task completed events
   */
  onCompleted(callback: TaskCompletionCallback): void {
    this._onTaskCompleted.push(callback);
  }

  /**
   * Register callback for task failed events
   */
  onFailed(callback: TaskCallback): void {
    this._onTaskFailed.push(callback);
  }

  /**
   * Add a task to the queue
   */
  async enqueue(task: Task): Promise<void> {
    if (this._queue.length >= this._maxQueueSize) {
      throw new Error("Task queue is full");
    }

    task.status = TaskStatus.QUEUED;
    this._pendingTasks.set(task.id, task);

    const prioritized: PrioritizedTask = {
      task,
      priority: task.priority,
      createdAt: new Date(),
    };

    // Insert into sorted queue
    this._insertSorted(prioritized);

    if (this._debug) {
      console.log(`[TaskQueue] Task ${task.id} enqueued (priority: ${task.priority})`);
    }

    // Notify callbacks
    await this._notifyCallbacks(this._onTaskQueued, task);
  }

  /**
   * Get the next task from the queue without removing it
   */
  peek(): Task | null {
    if (this._queue.length === 0) {
      return null;
    }
    return this._queue[0].task;
  }

  /**
   * Remove and return the next task from the queue
   */
  dequeue(): Task | null {
    if (this._queue.length === 0) {
      return null;
    }

    const prioritized = this._queue.shift()!;
    const task = prioritized.task;

    this._pendingTasks.delete(task.id);
    return task;
  }

  /**
   * Assign a task to an agent
   */
  async assign(
    task: Task,
    agentId: string,
    submitFn: (agentId: string, task: Task) => Promise<void>
  ): Promise<boolean> {
    task.status = TaskStatus.ASSIGNED;
    task.assignedAgent = agentId;

    const assignment: TaskAssignment = {
      taskId: task.id,
      agentId,
      assignedAt: new Date(),
      completed: false,
    };

    this._assignedTasks.set(task.id, assignment);

    // Submit to agent
    await submitFn(agentId, task);

    if (this._debug) {
      console.log(`[TaskQueue] Task ${task.id} assigned to agent ${agentId}`);
    }

    // Notify callbacks
    await this._notifyCallbacks(this._onTaskAssigned, task);

    return true;
  }

  /**
   * Mark a task as completed with its result
   */
  markComplete(result: TaskResult): void {
    const assignment = this._assignedTasks.get(result.taskId);
    if (assignment) {
      assignment.completed = true;
      assignment.result = result;
    }

    this._completedTasks.set(result.taskId, result);

    if (this._debug) {
      console.log(
        `[TaskQueue] Task ${result.taskId} marked complete (success: ${result.success})`
      );
    }

    // Notify callbacks
    const notify = async () => {
      if (result.success) {
        for (const callback of this._onTaskCompleted) {
          await callback(result);
        }
      } else {
        const task: Task = {
          id: result.taskId,
          description: "",
          requiredCapabilities: [],
          payload: {},
          priority: 0,
          timeout: 0,
          maxRetries: 0,
          dependencies: [],
          metadata: {},
          createdAt: new Date(),
          status: TaskStatus.FAILED,
          retryCount: 0,
        };
        for (const callback of this._onTaskFailed) {
          await callback(task);
        }
      }
    };
    notify();
  }

  /**
   * Get the status of a task
   */
  getTaskStatus(taskId: string): TaskStatus | null {
    if (this._pendingTasks.has(taskId)) {
      return this._pendingTasks.get(taskId)!.status;
    }
    if (this._assignedTasks.has(taskId)) {
      return TaskStatus.RUNNING;
    }
    if (this._completedTasks.has(taskId)) {
      const result = this._completedTasks.get(taskId)!;
      return result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED;
    }
    return null;
  }

  /**
   * Get the result of a completed task
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    return this._completedTasks.get(taskId);
  }

  /**
   * Get assignment details for a task
   */
  getAssignment(taskId: string): TaskAssignment | undefined {
    return this._assignedTasks.get(taskId);
  }

  /**
   * Select the best agent for a task using the configured strategy
   */
  selectAgent(
    task: Task,
    availableAgents: AssignableAgent[]
  ): AssignableAgent | null {
    if (availableAgents.length === 0) {
      return null;
    }

    // Filter by capabilities
    const capable = availableAgents.filter((agent) =>
      this._canHandle(agent, task)
    );

    if (capable.length === 0) {
      return null;
    }

    switch (this._loadBalancing) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this._selectRoundRobin(capable);
      case LoadBalancingStrategy.LEAST_LOADED:
        return this._selectLeastLoaded(capable);
      case LoadBalancingStrategy.CAPABILITY_MATCH:
        return this._selectCapabilityMatch(task, capable);
      case LoadBalancingStrategy.RANDOM:
        return this._selectRandom(capable);
      default:
        return this._selectLeastLoaded(capable);
    }
  }

  /**
   * Process the queue, assigning tasks to available agents
   */
  async processQueue(
    availableAgents: () => AssignableAgent[],
    assignFn: (task: Task, agentId: string, submitFn: (agentId: string, task: Task) => Promise<void>) => Promise<boolean>
  ): Promise<void> {
    while (this._queue.length > 0) {
      const task = this.peek();
      if (!task) break;

      const agents = availableAgents();
      const agent = this.selectAgent(task, agents);

      if (!agent) {
        // No suitable agent available, stop processing
        break;
      }

      // Remove from queue and assign
      this.dequeue();
      await assignFn(task, agent.id, async (aid, t) => {
        // This would be replaced with actual agent submission
        await this._mockSubmit(aid, t);
      });

      if (this._debug) {
        console.log(`[TaskQueue] Assigned task ${task.id} to agent ${agent.id}`);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStatistics(): TaskQueueStatistics {
    return {
      queueSize: this._queue.length,
      pending: this._pendingTasks.size,
      assigned: this._assignedTasks.size,
      completed: this._completedTasks.size,
      loadBalancing: this._loadBalancing,
    };
  }

  /**
   * Get task history
   */
  getHistory(limit = 100): TaskResult[] {
    const results = Array.from(this._completedTasks.values());
    results.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    return results.slice(0, limit);
  }

  /**
   * Clear all pending tasks
   */
  async clear(): Promise<void> {
    this._queue = [];
    this._pendingTasks.clear();
    if (this._debug) {
      console.log("[TaskQueue] Queue cleared");
    }
  }

  /**
   * Cancel a pending task
   */
  cancelTask(taskId: string): boolean {
    const index = this._queue.findIndex((pt) => pt.task.id === taskId);
    if (index >= 0) {
      this._queue.splice(index, 1);
      const task = this._pendingTasks.get(taskId);
      if (task) {
        task.status = TaskStatus.CANCELLED;
        this._pendingTasks.delete(taskId);
        if (this._debug) {
          console.log(`[TaskQueue] Task ${taskId} cancelled`);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Insert task into sorted queue
   */
  private _insertSorted(prioritized: PrioritizedTask): void {
    let low = 0;
    let high = this._queue.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const midPriority = this._queue[mid].priority;
      const midTime = this._queue[mid].createdAt;

      if (
        prioritized.priority < midPriority ||
        (prioritized.priority === midPriority &&
          prioritized.createdAt < midTime)
      ) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    this._queue.splice(low, 0, prioritized);
  }

  /**
   * Check if agent can handle task
   */
  private _canHandle(agent: AssignableAgent, task: Task): boolean {
    if (task.requiredCapabilities.length === 0) {
      return true;
    }
    return task.requiredCapabilities.every((cap) =>
      agent.capabilities.includes(cap)
    );
  }

  /**
   * Round-robin agent selection
   */
  private _selectRoundRobin(agents: AssignableAgent[]): AssignableAgent {
    const agent = agents[this._roundRobinIndex % agents.length];
    this._roundRobinIndex++;
    return agent;
  }

  /**
   * Least-loaded agent selection
   */
  private _selectLeastLoaded(agents: AssignableAgent[]): AssignableAgent {
    return agents.reduce((min, agent) =>
      agent.currentTaskCount < min.currentTaskCount ? agent : min
    );
  }

  /**
   * Capability match agent selection
   */
  private _selectCapabilityMatch(
    task: Task,
    agents: AssignableAgent[]
  ): AssignableAgent {
    if (task.requiredCapabilities.length === 0) {
      return this._selectLeastLoaded(agents);
    }

    // Score by capability match
    const scored = agents.map((agent) => ({
      agent,
      score: this._capabilityScore(agent, task.requiredCapabilities),
    }));

    scored.sort((a, b) => b.score - a.score);

    return scored[0].agent;
  }

  /**
   * Calculate capability match score
   */
  private _capabilityScore(
    agent: AssignableAgent,
    required: string[]
  ): number {
    let score = 0;
    for (const cap of required) {
      if (agent.capabilities.includes(cap)) {
        score += 1;
      }
    }
    // Prefer fewer extra capabilities (more specialized)
    score -= agent.capabilities.length * 0.1;
    return score;
  }

  /**
   * Random agent selection
   */
  private _selectRandom(agents: AssignableAgent[]): AssignableAgent {
    return agents[Math.floor(Math.random() * agents.length)];
  }

  /**
   * Notify all callbacks for a given list
   */
  private async _notifyCallbacks(
    callbacks: TaskCallback[],
    task: Task
  ): Promise<void> {
    for (const callback of callbacks) {
      try {
        await callback(task);
      } catch (error) {
        console.error("[TaskQueue] Callback error:", error);
      }
    }
  }

  /**
   * Mock submission for testing
   */
  private async _mockSubmit(agentId: string, task: Task): Promise<void> {
    // This would be replaced with actual agent communication
    if (this._debug) {
      console.log(`[TaskQueue] Mock submit task ${task.id} to agent ${agentId}`);
    }
  }
}

/**
 * Create a task queue with default options
 */
export function createTaskQueue(options?: TaskQueueOptions): TaskQueue {
  return new TaskQueue(options);
}
