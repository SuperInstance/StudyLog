/**
 * StudyLoG.AI Agent Coordinator
 *
 * A multi-agent coordination system for managing AI learning agents across
 * the three stages: Cognitive Mill, Intelligence Ranch, and Sitka Sound.
 *
 * Inspired by the SuperInstance agent-coordinator framework.
 * @module studylog-coordinator
 */

/**
 * Agent states representing the lifecycle of a learning agent
 */
export enum AgentState {
  INITIALIZING = "initializing",
  IDLE = "idle",
  BUSY = "busy",
  SUSPENDED = "suspended",
  FAILED = "failed",
  TERMINATED = "terminated",
}

/**
 * Task states representing the lifecycle of a learning task
 */
export enum TaskStatus {
  PENDING = "pending",
  QUEUED = "queued",
  ASSIGNED = "assigned",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMEOUT = "timeout",
}

/**
 * Task priority levels for scheduling
 */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 25,
  MEDIUM = 50,
  LOW = 75,
  BACKGROUND = 100,
}

/**
 * Message types for inter-agent communication
 */
export enum MessageType {
  // Communication
  REQUEST = "request",
  RESPONSE = "response",
  NOTIFICATION = "notification",

  // Coordination
  BROADCAST = "broadcast",
  MULTICAST = "multicast",
  DIRECT = "direct",

  // Control
  HEARTBEAT = "heartbeat",
  STATUS = "status",
  SHUTDOWN = "shutdown",

  // Task-related
  TASK_REQUEST = "task_request",
  TASK_UPDATE = "task_update",
  TASK_RESULT = "task_result",

  // Collaboration
  COLLABORATE = "collaborate",
  SYNC = "sync",
  HANDOFF = "handoff",
}

/**
 * Event types for the coordinator event bus
 */
export enum EventType {
  // Agent lifecycle
  AGENT_REGISTERED = "agent_registered",
  AGENT_UNREGISTERED = "agent_unregistered",
  AGENT_STARTED = "agent_started",
  AGENT_STOPPED = "agent_stopped",
  AGENT_STATE_CHANGED = "agent_state_changed",

  // Task lifecycle
  TASK_QUEUED = "task_queued",
  TASK_ASSIGNED = "task_assigned",
  TASK_STARTED = "task_started",
  TASK_COMPLETED = "task_completed",
  TASK_FAILED = "task_failed",
  TASK_CANCELLED = "task_cancelled",

  // Communication
  MESSAGE_SENT = "message_sent",
  MESSAGE_DELIVERED = "message_delivered",
  MESSAGE_FAILED = "message_failed",

  // Health/Monitoring
  AGENT_HEALTH_CHANGED = "agent_health_changed",
  AGENT_OFFLINE = "agent_offline",
  AGENT_RECOVERED = "agent_recovered",
  FAILURE_DETECTED = "failure_detected",

  // System
  SYSTEM_STARTING = "system_starting",
  SYSTEM_STARTED = "system_started",
  SYSTEM_STOPPING = "system_stopping",
  SYSTEM_STOPPED = "system_stopped",
  SYSTEM_ERROR = "system_error",

  // StudyLoG.AI specific
  STAGE_COMPLETED = "stage_completed",
  CONCEPT_LEARNED = "concept_learned",
  PUZZLE_SOLVED = "puzzle_solved",
  ACHIEVEMENT_UNLOCKED = "achievement_unlocked",
  PROGRESS_UPDATED = "progress_updated",
}

/**
 * StudyLoG.AI learning stages
 */
export enum LearningStage {
  COGNITIVE_MILL = "cognitive_mill",
  INTELLIGENCE_RANCH = "intelligence_ranch",
  SITKA_SOUND = "sitka_sound",
}

/**
 * Biological agent types mapped to StudyLoG.AI ecosystem
 */
export enum BiologicalAgentType {
  // Cognitive Mill - Understanding AI internals
  ZOOPLANKTON = "zooplankton",  // Token processing
  HERRING = "herring",          // Vector swarm

  // Intelligence Ranch - Training agents
  DECKHAND = "deckhand",        // SLM + LoRA
  CAPTAIN = "captain",          // Director agent

  // Sitka Sound - Multi-agent systems
  WHALE = "whale",              // Orchestrator
  FLEET = "fleet",              // A2A network

  // Universal
  DOG = "dog",                  // LoRA adapter
}

/**
 * Agent role definition with capabilities
 */
export interface AgentRole {
  /** Unique role name */
  name: string;
  /** List of capabilities this role provides */
  capabilities: string[];
  /** Maximum concurrent tasks this role can handle */
  maxConcurrentTasks: number;
  /** Priority for agent selection (higher = preferred) */
  priority: number;
  /** Biological type for StudyLoG.AI */
  biologicalType?: BiologicalAgentType;
  /** Learning stage this role belongs to */
  stage?: LearningStage;
  /** Display emoji for UI */
  emoji: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique agent identifier */
  agentId: string;
  /** Role name */
  role: string;
  /** Heartbeat interval in seconds */
  heartbeatInterval?: number;
  /** Task timeout in seconds */
  taskTimeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Auto-restart on failure */
  autoRestart?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Agent metrics for performance tracking
 */
export interface AgentMetrics {
  /** Agent identifier */
  agentId: string;
  /** Total tasks completed */
  tasksCompleted: number;
  /** Total tasks failed */
  tasksFailed: number;
  /** Total tasks attempted */
  tasksTotal: number;
  /** Success rate percentage */
  successRate: number;
  /** Average execution time in seconds */
  avgExecutionTime: number;
  /** Minimum execution time */
  minExecutionTime: number;
  /** Maximum execution time */
  maxExecutionTime: number;
  /** P50 (median) execution time */
  p50ExecutionTime?: number;
  /** P95 execution time */
  p95ExecutionTime?: number;
  /** P99 execution time */
  p99ExecutionTime?: number;
  /** Tasks per minute rate */
  tasksPerMinute: number;
  /** Last heartbeat timestamp */
  lastHeartbeat?: Date;
  /** Agent creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivity?: Date;
}

/**
 * Learning-specific metrics for StudyLoG.AI
 */
export interface LearningMetrics extends AgentMetrics {
  /** Concepts mastered by this agent */
  conceptsMastered: string[];
  /** Puzzles solved */
  puzzlesSolved: number;
  /** Achievements/badges earned */
  badgesEarned: string[];

  /** Stage progress (0-1) */
  millProgress: number;
  ranchProgress: number;
  sitkaProgress: number;

  /** Current streak days */
  streakDays: number;
  /** Total learning time in seconds */
  totalLearningTime: number;

  /** Experience points */
  xp: number;
  /** Agent level */
  level: number;
}

/**
 * Task definition
 */
export interface Task {
  /** Unique task identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** Required capabilities for agent assignment */
  requiredCapabilities: string[];
  /** Task payload data */
  payload: Record<string, unknown>;
  /** Task priority (lower = higher priority) */
  priority: number;
  /** Maximum execution time in seconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Task IDs that must complete first */
  dependencies: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: Date;

  /** Runtime fields (not in equality check) */
  status: TaskStatus;
  /** Assigned agent ID */
  assignedAgent?: string;
  /** Task start timestamp */
  startedAt?: Date;
  /** Task completion timestamp */
  completedAt?: Date;
  /** Current retry count */
  retryCount: number;
  /** Associated learning stage */
  learningStage?: LearningStage;
}

/**
 * Task execution result
 */
export interface TaskResult {
  /** Task identifier */
  taskId: string;
  /** Agent that executed the task */
  agentId: string;
  /** Whether the task succeeded */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Completion timestamp */
  completedAt: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Execution time in seconds */
  executionTime?: number;
}

/**
 * Agent message for inter-agent communication
 */
export interface AgentMessage {
  /** Sender agent ID */
  fromAgent: string;
  /** Recipient agent ID (* for broadcast) */
  toAgent: string;
  /** Message type */
  messageType: MessageType;
  /** Message content */
  content: Record<string, unknown>;
  /** Correlation ID for threading */
  correlationId: string;
  /** Reply-to message ID */
  replyTo?: string;
  /** Message priority (lower = higher) */
  priority: number;
  /** Message timestamp */
  timestamp: Date;
  /** Time-to-live in seconds */
  ttl?: number;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * System event
 */
export interface Event {
  /** Event type */
  type: EventType;
  /** Event data */
  data: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
  /** Event source */
  source: string;
  /** Optional correlation ID */
  correlationId?: string;
}

/**
 * Event subscription handler
 */
export type EventHandler = (event: Event) => void | Promise<void>;

/**
 * Event subscription filter
 */
export type EventFilter = (event: Event) => boolean;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Event types to subscribe to */
  eventTypes: EventType[];
  /** Handler function */
  handler: EventHandler;
  /** Optional filter function */
  filter?: EventFilter;
  /** Fire once then unsubscribe */
  once: boolean;
}

/**
 * System health status
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
  OFFLINE = "offline",
}

/**
 * Agent health information
 */
export interface AgentHealth {
  /** Agent identifier */
  agentId: string;
  /** Current health status */
  status: HealthStatus;
  /** Last heartbeat timestamp */
  lastHeartbeat?: Date;
  /** Last state change timestamp */
  lastStateChange?: Date;
  /** Consecutive failure count */
  consecutiveFailures: number;
  /** Last error message */
  lastError?: string;
  /** Additional health metrics */
  metrics: Record<string, number>;
}

/**
 * System health aggregate
 */
export interface SystemHealth {
  /** Overall health status */
  status: HealthStatus;
  /** Total agent count */
  totalAgents: number;
  /** Healthy agent count */
  healthyAgents: number;
  /** Degraded agent count */
  degradedAgents: number;
  /** Unhealthy agent count */
  unhealthyAgents: number;
  /** Offline agent count */
  offlineAgents: number;
  /** Health percentage */
  healthPercentage: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Coordinator configuration
 */
export interface CoordinatorConfig {
  /** Coordinator name */
  name: string;
  /** Heartbeat timeout in seconds */
  heartbeatTimeout: number;
  /** Health check interval in seconds */
  healthCheckInterval: number;
  /** Task processing interval in seconds */
  taskProcessingInterval: number;
  /** Maximum retry attempts for failed tasks */
  maxRetries: number;
  /** Delay between retries in seconds */
  retryDelay: number;
  /** Enable automatic agent recovery */
  autoRecovery: boolean;
  /** Load balancing strategy */
  loadBalancing: LoadBalancingStrategy;
}

/**
 * Load balancing strategies
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = "round_robin",
  LEAST_LOADED = "least_loaded",
  CAPABILITY_MATCH = "capability_match",
  RANDOM = "random",
}

/**
 * Agent state information
 */
export interface AgentInfo {
  /** Agent identifier */
  agentId: string;
  /** Role name */
  role: string;
  /** Capabilities list */
  capabilities: string[];
  /** Current state */
  state: AgentState;
  /** Registration timestamp */
  registeredAt: Date;
  /** Last heartbeat timestamp */
  lastHeartbeat?: Date;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Coordinator status summary
 */
export interface CoordinatorStatus {
  /** Coordinator name */
  name: string;
  /** Running state */
  running: boolean;
  /** Agent status summary */
  agents: {
    totalAgents: number;
    totalRoles: number;
    byState: Record<AgentState, number>;
    byRole: Record<string, number>;
    available: number;
  };
  /** Task queue statistics */
  tasks: {
    queueSize: number;
    pending: number;
    assigned: number;
    completed: number;
    loadBalancing: string;
  };
  /** System health */
  health: SystemHealth;
  /** System metrics */
  metrics: {
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgExecutionTime: number;
    tasksPerMinute: number;
  };
  /** Message bus statistics */
  messageBus: {
    registeredAgents: number;
    activeConversations: number;
    trackedMessages: number;
    subscriptions: Record<string, number>;
  };
}

/**
 * Achievement definition
 */
export interface Achievement {
  /** Achievement ID */
  id: string;
  /** Achievement name */
  name: string;
  /** Description */
  description: string;
  /** Icon/emoji */
  icon: string;
  /** Required stage */
  requiredStage?: LearningStage;
  /** Required concepts */
  requiredConcepts: string[];
  /** Required puzzle count */
  requiredPuzzles?: number;
  /** Required XP */
  requiredXp?: number;
  /** XP reward */
  xpReward: number;
  /** Unlocked timestamp */
  unlockedAt?: Date;
}

/**
 * Learning progress tracking
 */
export interface LearningProgress {
  /** User/session ID */
  sessionId: string;
  /** Current stage */
  currentStage: LearningStage;
  /** Stage completion status */
  stagesCompleted: {
    cognitiveMill: boolean;
    intelligenceRanch: boolean;
    sitkaSound: boolean;
  };
  /** Concepts learned */
  conceptsLearned: string[];
  /** Puzzles solved */
  puzzlesSolved: number;
  /** Achievements unlocked */
  achievementsUnlocked: string[];
  /** Total XP */
  totalXp: number;
  /** Current level */
  level: number;
  /** Session start time */
  sessionStart: Date;
  /** Total learning time */
  totalLearningTime: number;
}

/**
 * Task handler function type
 */
export type TaskHandler = (task: Task) => Promise<unknown>;

/**
 * Message handler function type
 */
export type MessageHandler = (message: AgentMessage) => void | Promise<void>;
