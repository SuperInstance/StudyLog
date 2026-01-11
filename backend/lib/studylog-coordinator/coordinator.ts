/**
 * StudyLoG.AI Agent Coordinator
 *
 * Main coordinator for managing teams of AI learning agents
 * across the Cognitive Mill, Intelligence Ranch, and Sitka Sound stages.
 */

import {
  AgentRole,
  AgentConfig,
  Task,
  TaskResult,
  CoordinatorStatus,
  CoordinatorConfig as CoordinatorConfigType,
  LearningStage,
  LearningProgress,
  Achievement,
  BiologicalAgentType,
} from "./types.js";
import { EventBus, emitEvent, EventType } from "./event-bus.js";
import { TaskQueue } from "./task-queue.js";
import { STUDYLOG_ROLES, STAGE_REQUIREMENTS, getStageCapabilities } from "./roles.js";

/**
 * Agent instance tracking
 */
interface AgentInstance {
  id: string;
  role: AgentRole;
  state: import("./types.js").AgentState;
  capabilities: string[];
  currentTasks: Set<string>;
  createdAt: Date;
  lastHeartbeat?: Date;
  metrics: import("./types.js").LearningMetrics;
}

/**
 * Message for inter-agent communication
 */
interface MessageRoute {
  fromAgent: string;
  toAgent: string;
  timestamp: Date;
}

/**
 * Conversation tracking
 */
interface Conversation {
  id: string;
  participants: Set<string>;
  messages: MessageRoute[];
  createdAt: Date;
}

/**
 * Coordinator Options
 */
export interface StudyLogCoordinatorOptions extends CoordinatorConfigType {
  /** Enable persistence of learning progress */
  enablePersistence?: boolean;
  /** Storage key for persistence */
  storageKey?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default coordinator configuration
 */
const DEFAULT_CONFIG: CoordinatorConfigType = {
  name: "studylog-coordinator",
  heartbeatTimeout: 60,
  healthCheckInterval: 30,
  taskProcessingInterval: 0.1,
  maxRetries: 3,
  retryDelay: 1.0,
  autoRecovery: true,
  loadBalancing: "least_loaded" as any,
};

/**
 * StudyLoG.AI Agent Coordinator
 *
 * Manages AI learning agents across the three learning stages:
 * - Cognitive Mill: Understanding AI internals
 * - Intelligence Ranch: Training AI agents
 * - Sitka Sound: Multi-agent coordination
 *
 * Features:
 * - Agent lifecycle management
 * - Task distribution and scheduling
 * - Inter-agent communication
 * - Health monitoring
 * - Achievement tracking
 * - Learning progress persistence
 */
export class StudyLogCoordinator {
  private _config: StudyLogCoordinatorOptions;
  private _eventBus: EventBus;
  private _taskQueue: TaskQueue;
  private _running = false;
  private _agents: Map<string, AgentInstance> = new Map();
  private _roles: Map<string, AgentRole> = new Map();
  private _conversations: Map<string, Conversation> = new Map();
  private _taskCompletions: Map<string, Promise<TaskResult>> = new Map();
  private _processingTimer: ReturnType<typeof setInterval> | null = null;
  private _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _debug: boolean;

  // Learning progress tracking
  private _learningProgress: LearningProgress;
  private _achievements: Map<string, Achievement> = new Map();
  private _unlockedAchievements: Set<string> = new Set();

  // Task handlers
  private _taskHandlers: Map<string, (task: Task) => Promise<unknown>> =
    new Map();

  constructor(options: StudyLogCoordinatorOptions = {}) {
    this._config = { ...DEFAULT_CONFIG, ...options };
    this._debug = options.debug ?? false;
    this._eventBus = new EventBus({ debug: this._debug });
    this._taskQueue = new TaskQueue({
      loadBalancing: this._config.loadBalancing,
      debug: this._debug,
    });

    // Initialize learning progress
    this._learningProgress = this._loadProgress() ?? this._createInitialProgress();

    // Register default roles
    for (const role of Object.values(STUDYLOG_ROLES)) {
      this._roles.set(role.name, role);
    }

    // Register achievements
    this._registerAchievements();

    // Setup queue callbacks
    this._setupQueueCallbacks();

    if (this._debug) {
      console.log("[Coordinator] Created:", this._config.name);
    }
  }

  /** Get coordinator name */
  get name(): string {
    return this._config.name;
  }

  /** Get running state */
  get isRunning(): boolean {
    return this._running;
  }

  /** Get event bus for external subscriptions */
  get eventBus(): EventBus {
    return this._eventBus;
  }

  /** Get current learning progress */
  get learningProgress(): LearningProgress {
    return { ...this._learningProgress };
  }

  /** Get all registered roles */
  get roles(): AgentRole[] {
    return Array.from(this._roles.values());
  }

  /** Get all active agents */
  get agents(): AgentInstance[] {
    return Array.from(this._agents.values());
  }

  /**
   * Start the coordinator
   */
  async start(): Promise<void> {
    if (this._running) {
      if (this._debug) {
        console.warn("[Coordinator] Already running");
      }
      return;
    }

    this._running = true;

    // Emit start event
    await emitEvent(EventType.SYSTEM_STARTING, {}, this._config.name);

    // Start processing loop
    this._processingTimer = setInterval(() => {
      this._processQueue().catch((err) => {
        console.error("[Coordinator] Processing error:", err);
      });
    }, this._config.taskProcessingInterval * 1000);

    // Start health check loop
    this._healthCheckTimer = setInterval(() => {
      this._healthCheck().catch((err) => {
        console.error("[Coordinator] Health check error:", err);
      });
    }, this._config.healthCheckInterval * 1000);

    await emitEvent(EventType.SYSTEM_STARTED, {}, this._config.name);

    if (this._debug) {
      console.log("[Coordinator] Started");
    }
  }

  /**
   * Stop the coordinator
   */
  async stop(): Promise<void> {
    if (!this._running) {
      return;
    }

    this._running = false;

    await emitEvent(EventType.SYSTEM_STOPPING, {}, this._config.name);

    // Stop timers
    if (this._processingTimer) {
      clearInterval(this._processingTimer);
      this._processingTimer = null;
    }
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = null;
    }

    // Stop all agents
    for (const agent of this._agents.values()) {
      agent.state = "terminated" as any;
    }

    // Save progress
    this._saveProgress();

    await emitEvent(EventType.SYSTEM_STOPPED, {}, this._config.name);

    if (this._debug) {
      console.log("[Coordinator] Stopped");
    }
  }

  /**
   * Register a new agent role
   */
  async registerRole(role: AgentRole): Promise<void> {
    this._roles.set(role.name, role);
    await emitEvent(
      EventType.AGENT_REGISTERED,
      { role: role.name, capabilities: role.capabilities },
      this._config.name
    );

    if (this._debug) {
      console.log(`[Coordinator] Registered role: ${role.name}`);
    }
  }

  /**
   * Spawn a new agent
   */
  async spawnAgent(
    agentId: string,
    roleName: string,
    taskHandler?: (task: Task) => Promise<unknown>
  ): Promise<AgentInstance> {
    const role = this._roles.get(roleName);
    if (!role) {
      throw new Error(`Role '${roleName}' not registered`);
    }

    // Check if agent already exists
    if (this._agents.has(agentId)) {
      throw new Error(`Agent '${agentId}' already exists`);
    }

    // Create agent instance
    const agent: AgentInstance = {
      id: agentId,
      role,
      state: "idle" as any,
      capabilities: role.capabilities,
      currentTasks: new Set(),
      createdAt: new Date(),
      metrics: this._createInitialMetrics(agentId),
    };

    this._agents.set(agentId, agent);

    // Register task handler if provided
    if (taskHandler) {
      this._taskHandlers.set(agentId, taskHandler);
    }

    await emitEvent(
      EventType.AGENT_STARTED,
      { agentId, role: roleName },
      this._config.name
    );

    if (this._debug) {
      console.log(`[Coordinator] Spawned agent '${agentId}' with role '${roleName}'`);
    }

    return agent;
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<boolean> {
    const agent = this._agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.state = "terminated" as any;
    this._agents.delete(agentId);
    this._taskHandlers.delete(agentId);

    await emitEvent(
      EventType.AGENT_STOPPED,
      { agentId },
      this._config.name
    );

    if (this._debug) {
      console.log(`[Coordinator] Terminated agent '${agentId}'`);
    }

    return true;
  }

  /**
   * Submit a task for execution
   */
  async submitTask(
    task: Task,
    waitForCompletion = false
  ): Promise<TaskResult | null> {
    if (!this._running) {
      throw new Error("Coordinator is not running");
    }

    // Create completion promise if waiting
    let completionPromise: Promise<TaskResult> | null = null;
    if (waitForCompletion) {
      completionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this._taskCompletions.delete(task.id);
          reject(new Error("Task timeout"));
        }, task.timeout * 1000);

        this._taskCompletions.set(
          task.id,
          new Promise((innerResolve) => {
            const originalResolve = innerResolve;
            // Store resolver for later
            (this as any)[`_resolve_${task.id}`] = (result: TaskResult) => {
              clearTimeout(timeout);
              originalResolve(result);
            };
          })
        );
      });
    }

    // Enqueue the task
    await this._taskQueue.enqueue(task);
    await emitEvent(
      EventType.TASK_QUEUED,
      { taskId: task.id, description: task.description },
      this._config.name
    );

    if (waitForCompletion && completionPromise) {
      return await completionPromise;
    }

    return null;
  }

  /**
   * Submit multiple tasks
   */
  async submitTasks(
    tasks: Task[],
    waitForAll = false
  ): Promise<(TaskResult | null)[]> {
    if (waitForAll) {
      return await Promise.all(
        tasks.map((task) => this.submitTask(task, true))
      );
    }

    for (const task of tasks) {
      await this._taskQueue.enqueue(task);
    }

    return tasks.map(() => null);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this._agents.get(agentId);
  }

  /**
   * Get agents by role
   */
  getAgentsByRole(roleName: string): AgentInstance[] {
    return this.agents.filter((agent) => agent.role.name === roleName);
  }

  /**
   * Get available (idle) agents
   */
  getAvailableAgents(): AgentInstance[] {
    return this.agents.filter((agent) => agent.state === "idle");
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: string): AgentInstance[] {
    return this.agents.filter((agent) =>
      agent.capabilities.includes(capability)
    );
  }

  /**
   * Get coordinator status
   */
  async getStatus(): Promise<CoordinatorStatus> {
    const agentsByState: Record<string, number> = {
      initializing: 0,
      idle: 0,
      busy: 0,
      suspended: 0,
      failed: 0,
      terminated: 0,
    };

    const agentsByRole: Record<string, number> = {};

    for (const agent of this._agents.values()) {
      agentsByState[agent.state]++;
      agentsByRole[agent.role.name] =
        (agentsByRole[agent.role.name] ?? 0) + 1;
    }

    const queueStats = this._taskQueue.getStatistics();

    return {
      name: this._config.name,
      running: this._running,
      agents: {
        totalAgents: this._agents.size,
        totalRoles: this._roles.size,
        byState: agentsByState as any,
        byRole: agentsByRole,
        available: this.getAvailableAgents().length,
      },
      tasks: {
        queueSize: queueStats.queueSize,
        pending: queueStats.pending,
        assigned: queueStats.assigned,
        completed: queueStats.completed,
        loadBalancing: queueStats.loadBalancing,
      },
      health: {
        status: "healthy" as any,
        totalAgents: this._agents.size,
        healthyAgents: this._agents.size,
        degradedAgents: 0,
        unhealthyAgents: 0,
        offlineAgents: 0,
        healthPercentage: 100,
        timestamp: new Date(),
      },
      metrics: {
        totalAgents: this._agents.size,
        activeAgents: this.getAvailableAgents().length,
        totalTasks: queueStats.completed,
        completedTasks: queueStats.completed,
        failedTasks: 0,
        avgExecutionTime: 0,
        tasksPerMinute: 0,
      },
      messageBus: {
        registeredAgents: this._agents.size,
        activeConversations: this._conversations.size,
        trackedMessages: 0,
        subscriptions: {},
      },
    };
  }

  /**
   * Record learning progress
   */
  async recordConceptLearned(conceptId: string, xpReward = 50): Promise<void> {
    if (!this._learningProgress.conceptsLearned.includes(conceptId)) {
      this._learningProgress.conceptsLearned.push(conceptId);
      this._learningProgress.totalXp += xpReward;
      this._updateLevel();
      this._saveProgress();

      await emitEvent(
        EventType.CONCEPT_LEARNED,
        { conceptId, xpReward, totalXp: this._learningProgress.totalXp },
        this._config.name
      );

      // Check for achievements
      await this._checkAchievements();

      if (this._debug) {
        console.log(`[Coordinator] Concept learned: ${conceptId} (+${xpReward} XP)`);
      }
    }
  }

  /**
   * Record puzzle solved
   */
  async recordPuzzleSolved(xpReward = 100): Promise<void> {
    this._learningProgress.puzzlesSolved++;
    this._learningProgress.totalXp += xpReward;
    this._updateLevel();
    this._saveProgress();

    await emitEvent(
      EventType.PUZZLE_SOLVED,
      {
        puzzlesSolved: this._learningProgress.puzzlesSolved,
        xpReward,
        totalXp: this._learningProgress.totalXp,
      },
      this._config.name
    );

    // Check for achievements
    await this._checkAchievements();

    // Check for stage completion
    await this._checkStageCompletion();

    if (this._debug) {
      console.log(
        `[Coordinator] Puzzle solved! Total: ${this._learningProgress.puzzlesSolved}`
      );
    }
  }

  /**
   * Unlock an achievement
   */
  async unlockAchievement(achievementId: string): Promise<boolean> {
    if (this._unlockedAchievements.has(achievementId)) {
      return false;
    }

    const achievement = this._achievements.get(achievementId);
    if (!achievement) {
      return false;
    }

    this._unlockedAchievements.add(achievementId);
    this._learningProgress.achievementsUnlocked.push(achievementId);
    this._learningProgress.totalXp += achievement.xpReward;
    this._updateLevel();
    this._saveProgress();

    await emitEvent(
      EventType.ACHIEVEMENT_UNLOCKED,
      { achievementId, name: achievement.name, xpReward: achievement.xpReward },
      this._config.name
    );

    if (this._debug) {
      console.log(`[Coordinator] Achievement unlocked: ${achievement.name}`);
    }

    return true;
  }

  /**
   * Get current stage
   */
  getCurrentStage(): LearningStage {
    return this._learningProgress.currentStage;
  }

  /**
   * Check if stage requirements are met
   */
  checkStageRequirements(stage: LearningStage): {
    met: boolean;
    missing: string[];
  } {
    const requirements = STAGE_REQUIREMENTS[stage];
    const missing: string[] = [];

    for (const concept of requirements.requiredConcepts) {
      if (!this._learningProgress.conceptsLearned.includes(concept)) {
        missing.push(`Concept: ${concept}`);
      }
    }

    if (this._learningProgress.puzzlesSolved < requirements.requiredPuzzles) {
      missing.push(
        `Puzzles: ${this._learningProgress.puzzlesSolved}/${requirements.requiredPuzzles}`
      );
    }

    if ("requiredXp" in requirements) {
      const req = requirements as { requiredXp: number };
      if (this._learningProgress.totalXp < req.requiredXp) {
        missing.push(`XP: ${this._learningProgress.totalXp}/${req.requiredXp}`);
      }
    }

    return {
      met: missing.length === 0,
      missing,
    };
  }

  /**
   * Advance to next stage
   */
  async advanceToStage(stage: LearningStage): Promise<boolean> {
    const check = this.checkStageRequirements(stage);
    if (!check.met) {
      if (this._debug) {
        console.log(
          `[Coordinator] Cannot advance to ${stage}: missing ${check.missing.join(", ")}`
        );
      }
      return false;
    }

    this._learningProgress.currentStage = stage;

    await emitEvent(
      EventType.STAGE_COMPLETED,
      { stage, progress: this._learningProgress },
      this._config.name
    );

    this._saveProgress();

    if (this._debug) {
      console.log(`[Coordinator] Advanced to stage: ${stage}`);
    }

    return true;
  }

  /**
   * Get available achievements
   */
  getAchievements(): Achievement[] {
    return Array.from(this._achievements.values());
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements(): Achievement[] {
    return Array.from(this._unlockedAchievements)
      .map((id) => this._achievements.get(id))
      .filter((a) => a !== undefined) as Achievement[];
  }

  // Private methods

  /**
   * Create initial learning progress
   */
  private _createInitialProgress(): LearningProgress {
    return {
      sessionId: crypto.randomUUID(),
      currentStage: LearningStage.COGNITIVE_MILL,
      stagesCompleted: {
        cognitiveMill: false,
        intelligenceRanch: false,
        sitkaSound: false,
      },
      conceptsLearned: [],
      puzzlesSolved: 0,
      achievementsUnlocked: [],
      totalXp: 0,
      level: 1,
      sessionStart: new Date(),
      totalLearningTime: 0,
    };
  }

  /**
   * Create initial metrics for an agent
   */
  private _createInitialMetrics(
    agentId: string
  ): import("./types.js").LearningMetrics {
    return {
      agentId,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksTotal: 0,
      successRate: 100,
      avgExecutionTime: 0,
      minExecutionTime: Infinity,
      maxExecutionTime: 0,
      tasksPerMinute: 0,
      createdAt: new Date(),
      conceptsMastered: [],
      puzzlesSolved: 0,
      badgesEarned: [],
      millProgress: 0,
      ranchProgress: 0,
      sitkaProgress: 0,
      streakDays: 0,
      totalLearningTime: 0,
      xp: 0,
      level: 1,
    };
  }

  /**
   * Update level based on XP
   */
  private _updateLevel(): void {
    // Level formula: level = floor(sqrt(xp / 100)) + 1
    this._learningProgress.level =
      Math.floor(Math.sqrt(this._learningProgress.totalXp / 100)) + 1;
  }

  /**
   * Load progress from storage
   */
  private _loadProgress(): LearningProgress | null {
    try {
      const key = this._config.storageKey ?? "studylog-progress";
      const data = localStorage.getItem(key);
      if (data) {
        return JSON.parse(data) as LearningProgress;
      }
    } catch (error) {
      console.error("[Coordinator] Failed to load progress:", error);
    }
    return null;
  }

  /**
   * Save progress to storage
   */
  private _saveProgress(): void {
    try {
      const key = this._config.storageKey ?? "studylog-progress";
      localStorage.setItem(key, JSON.stringify(this._learningProgress));
    } catch (error) {
      console.error("[Coordinator] Failed to save progress:", error);
    }
  }

  /**
   * Register default achievements
   */
  private _registerAchievements(): void {
    const achievements: Achievement[] = [
      {
        id: "first_concept",
        name: "First Steps",
        description: "Learn your first concept",
        icon: "🌟",
        requiredStage: LearningStage.COGNITIVE_MILL,
        requiredConcepts: [],
        xpReward: 50,
      },
      {
        id: "puzzle_master",
        name: "Puzzle Master",
        description: "Solve 10 puzzles",
        icon: "🧩",
        requiredPuzzles: 10,
        requiredConcepts: [],
        xpReward: 200,
      },
      {
        id: "mill_complete",
        name: "Mill Graduate",
        description: "Complete Cognitive Mill stage",
        icon: "🏭",
        requiredStage: LearningStage.COGNITIVE_MILL,
        requiredConcepts: ["tokens", "embeddings", "attention"],
        requiredPuzzles: 5,
        xpReward: 500,
      },
      {
        id: "ranch_complete",
        name: "Ranch Hand",
        description: "Complete Intelligence Ranch stage",
        icon: "🤠",
        requiredStage: LearningStage.INTELLIGENCE_RANCH,
        requiredConcepts: [
          "tokens",
          "embeddings",
          "attention",
          "fine_tuning",
          "lora",
        ],
        requiredPuzzles: 15,
        xpReward: 1000,
      },
    ];

    for (const achievement of achievements) {
      this._achievements.set(achievement.id, achievement);
    }
  }

  /**
   * Check and unlock achievements
   */
  private async _checkAchievements(): Promise<void> {
    for (const [id, achievement] of this._achievements) {
      if (this._unlockedAchievements.has(id)) {
        continue;
      }

      // Check requirements
      let met = true;

      if (achievement.requiredConcepts.length > 0) {
        const hasAll = achievement.requiredConcepts.every((c) =>
          this._learningProgress.conceptsLearned.includes(c)
        );
        if (!hasAll) met = false;
      }

      if (achievement.requiredPuzzles) {
        if (this._learningProgress.puzzlesSolved < achievement.requiredPuzzles) {
          met = false;
        }
      }

      if (achievement.requiredXp) {
        if (this._learningProgress.totalXp < achievement.requiredXp) {
          met = false;
        }
      }

      if (met) {
        await this.unlockAchievement(id);
      }
    }
  }

  /**
   * Check for stage completion
   */
  private async _checkStageCompletion(): Promise<void> {
    const stages = [
      LearningStage.COGNITIVE_MILL,
      LearningStage.INTELLIGENCE_RANCH,
      LearningStage.SITKA_SOUND,
    ];

    for (const stage of stages) {
      if (!this._learningProgress.stagesCompleted[stage as keyof typeof this._learningProgress.stagesCompleted]) {
        const check = this.checkStageRequirements(stage);
        if (check.met) {
          this._learningProgress.stagesCompleted[stage as keyof typeof this._learningProgress.stagesCompleted] = true;
          await emitEvent(
            EventType.STAGE_COMPLETED,
            { stage, progress: this._learningProgress },
            this._config.name
          );
        }
      }
    }
  }

  /**
   * Setup queue callbacks
   */
  private _setupQueueCallbacks(): void {
    this._taskQueue.onAssigned(async (task) => {
      const agent = this._agents.get(task.assignedAgent!);
      if (agent) {
        agent.state = "busy" as any;
        agent.currentTasks.add(task.id);

        await emitEvent(
          EventType.TASK_STARTED,
          { taskId: task.id, agentId: agent.id },
          this._config.name
        );

        // Execute the task
        this._executeTask(agent, task).catch((err) => {
          console.error(`[Coordinator] Task execution error:`, err);
        });
      }
    });
  }

  /**
   * Execute a task on an agent
   */
  private async _executeTask(agent: AgentInstance, task: Task): Promise<void> {
    const startTime = Date.now();

    try {
      // Get task handler
      const handler = this._taskHandlers.get(agent.id);
      let result: unknown;

      if (handler) {
        result = await handler(task);
      } else {
        // Default handler: echo payload
        result = task.payload;
      }

      const executionTime = (Date.now() - startTime) / 1000;

      // Update metrics
      agent.metrics.tasksCompleted++;
      agent.metrics.tasksTotal++;
      agent.metrics.avgExecutionTime =
        (agent.metrics.avgExecutionTime *
          (agent.metrics.tasksCompleted - 1) +
          executionTime) /
        agent.metrics.tasksCompleted;
      agent.metrics.minExecutionTime = Math.min(
        agent.metrics.minExecutionTime,
        executionTime
      );
      agent.metrics.maxExecutionTime = Math.max(
        agent.metrics.maxExecutionTime,
        executionTime
      );
      agent.metrics.lastActivity = new Date();
      agent.lastHeartbeat = new Date();

      // Create result
      const taskResult: TaskResult = {
        taskId: task.id,
        agentId: agent.id,
        success: true,
        result,
        completedAt: new Date(),
        metadata: {},
        executionTime,
      };

      // Mark task complete
      this._taskQueue.markComplete(taskResult);

      await emitEvent(
        EventType.TASK_COMPLETED,
        {
          taskId: task.id,
          agentId: agent.id,
          executionTime,
        },
        this._config.name
      );

      // Resolve completion promise
      const resolver = (this as any)[`_resolve_${task.id}`];
      if (resolver) {
        resolver(taskResult);
        delete (this as any)[`_resolve_${task.id}`];
      }
    } catch (error) {
      const executionTime = (Date.now() - startTime) / 1000;

      agent.metrics.tasksFailed++;
      agent.metrics.tasksTotal++;

      const taskResult: TaskResult = {
        taskId: task.id,
        agentId: agent.id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
        metadata: {},
        executionTime,
      };

      this._taskQueue.markComplete(taskResult);

      await emitEvent(
        EventType.TASK_FAILED,
        {
          taskId: task.id,
          agentId: agent.id,
          error: taskResult.error,
        },
        this._config.name
      );

      // Resolve completion promise
      const resolver = (this as any)[`_resolve_${task.id}`];
      if (resolver) {
        resolver(taskResult);
        delete (this as any)[`_resolve_${task.id}`];
      }
    } finally {
      // Update agent state
      agent.currentTasks.delete(task.id);
      if (agent.currentTasks.size === 0) {
        agent.state = "idle" as any;
      }
    }
  }

  /**
   * Process the task queue
   */
  private async _processQueue(): Promise<void> {
    if (!this._running) {
      return;
    }

    await this._taskQueue.processQueue(
      () =>
        this.getAvailableAgents().map((agent) => ({
          id: agent.id,
          state: agent.state,
          capabilities: agent.capabilities,
          currentTaskCount: agent.currentTasks.size,
        })),
      async (task, agentId) => {
        return await this._taskQueue.assign(task, agentId, async () => {
          // Assignment is handled in the callback
        });
      }
    );
  }

  /**
   * Perform health check
   */
  private async _healthCheck(): Promise<void> {
    const now = new Date();
    const timeout = this._config.heartbeatTimeout * 1000;

    for (const agent of this._agents.values()) {
      if (
        agent.lastHeartbeat &&
        now.getTime() - agent.lastHeartbeat.getTime() > timeout
      ) {
        agent.state = "failed" as any;

        await emitEvent(
          EventType.AGENT_OFFLINE,
          { agentId: agent.id },
          this._config.name
        );

        if (this._config.autoRecovery) {
          // Attempt recovery
          if (this._debug) {
            console.log(`[Coordinator] Attempting recovery for agent ${agent.id}`);
          }
          agent.state = "idle" as any;
          agent.lastHeartbeat = now;

          await emitEvent(
            EventType.AGENT_RECOVERED,
            { agentId: agent.id },
            this._config.name
          );
        }
      }
    }
  }
}

/**
 * Create a new StudyLoG coordinator with default options
 */
export function createCoordinator(
  options?: StudyLogCoordinatorOptions
): StudyLogCoordinator {
  return new StudyLogCoordinator(options);
}

/**
 * Create and start a coordinator
 */
export async function startCoordinator(
  options?: StudyLogCoordinatorOptions
): Promise<StudyLogCoordinator> {
  const coordinator = new StudyLogCoordinator(options);
  await coordinator.start();
  return coordinator;
}
