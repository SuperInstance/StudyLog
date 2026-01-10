/**
 * Event-Driven Architecture Types
 *
 * Complete type definitions for the event sourcing system with
 * Cloudflare Queue integration for StudyLoG.AI.
 */

// ============================================================================
// Core Event Types
// ============================================================================

/**
 * Base event interface that all domain events must extend
 */
export interface BaseEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: Record<string, unknown>;
  metadata: EventMetadata;
  timestamp: string;
}

/**
 * Event metadata for tracking and correlation
 */
export interface EventMetadata {
  /**
   * Correlation ID for tracing related events across aggregates
   */
  correlationId?: string;

  /**
   * Causation ID links this event to the command that caused it
   */
  causationId?: string;

  /**
   * User ID who triggered the event
   */
  userId?: string;

  /**
   * Tenant ID for multi-tenant scenarios
   */
  tenantId?: string;

  /**
   * IP address of the client
   */
  ipAddress?: string;

  /**
   * User agent string
   */
  userAgent?: string;

  /**
   * Additional custom metadata
   */
  custom?: Record<string, unknown>;
}

/**
 * Event envelope for queue transport
 */
export interface EventEnvelope {
  eventId: string;
  eventType: string;
  payload: BaseEvent;
  retryCount: number;
  maxRetries: number;
  deadLetter?: boolean;
}

// ============================================================================
// Domain Event Types (StudyLoG.AI specific)
// ============================================================================

/**
 * Student lifecycle events
 */
export type StudentEventType =
  | 'student.registered'
  | 'student.activated'
  | 'student.deactivated'
  | 'student.tier.changed'
  | 'student.progress.updated'
  | 'student.achievement.unlocked'
  | 'student.phase.completed';

/**
 * Puzzle/Game events
 */
export type PuzzleEventType =
  | 'puzzle.created'
  | 'puzzle.started'
  | 'puzzle.completed'
  | 'puzzle.abandoned'
  | 'puzzle.hint.requested'
  | 'puzzle.solution.revealed';

/**
 * AI interaction events
 */
export type AIEventType =
  | 'ai.request.started'
  | 'ai.request.completed'
  | 'ai.request.failed'
  | 'ai.provider.rotated'
  | 'ai.cost.tracked'
  | 'ai.cache.hit'
  | 'ai.cache.miss';

/**
 * Marketplace events
 */
export type MarketplaceEventType =
  | 'creation.published'
  | 'creation.forked'
  | 'creation.merged'
  | 'creation.rated'
  | 'creation.commented'
  | 'creation.purchased';

/**
 * Session events
 */
export type SessionEventType =
  | 'session.started'
  | 'session.ended'
  | 'session.timeout'
  | 'session.renewed';

/**
 * All event types union
 */
export type EventType =
  | StudentEventType
  | PuzzleEventType
  | AIEventType
  | MarketplaceEventType
  | SessionEventType;

// ============================================================================
// Event Store Types
// ============================================================================

/**
 * Event store entry for persistence
 */
export interface EventStoreEntry {
  id: string;
  event_type: string;
  aggregate_id: string;
  aggregate_type: string;
  version: number;
  data: string; // JSON stringified
  metadata: string; // JSON stringified
  timestamp: string;
  sequence_number: number;
}

/**
 * Event stream read options
 */
export interface EventStreamOptions {
  /**
   * Start from this sequence number (inclusive)
   */
  fromSequence?: number;

  /**
   * Limit number of events returned
   */
  limit?: number;

  /**
   * Filter by event type
   */
  eventType?: string | string[];

  /**
   * Filter by aggregate type
   */
  aggregateType?: string;

  /**
   * Filter by tenant ID
   */
  tenantId?: string;
}

/**
 * Event stream result
 */
export interface EventStreamResult {
  events: BaseEvent[];
  nextSequence?: number;
  hasMore: boolean;
}

// ============================================================================
// Projection Types
// ============================================================================

/**
 * Projection state for a read model
 */
export interface ProjectionState {
  /**
   * Unique projection identifier
   */
  id: string;

  /**
   * Projection name
   */
  name: string;

  /**
   * Last processed sequence number
   */
  lastSequence: number;

  /**
   * Projection status
   */
  status: 'idle' | 'processing' | 'error' | 'rebuilding';

  /**
   * Last error message (if status is error)
   */
  error?: string;

  /**
   * Last updated timestamp
   */
  updatedAt: string;

  /**
   * Statistics
   */
  stats: {
    totalProcessed: number;
    totalErrors: number;
    avgProcessingTimeMs: number;
  };
}

/**
 * Projection handler definition
 */
export interface ProjectionHandler<TReadModel = unknown> {
  /**
   * Projection name
   */
  name: string;

  /**
   * Event types this projection handles
   */
  eventTypes: string[];

  /**
   * Initialize or reset the read model
   */
  initialize: (env: Env) => Promise<void>;

  /**
   * Handle an event and update the read model
   */
  handle: (event: BaseEvent, readModel: TReadModel, env: Env) => Promise<TReadModel>;

  /**
   * Get current read model state
   */
  getState: (env: Env) => Promise<TReadModel>;

  /**
   * Save read model state
   */
  saveState: (state: TReadModel, env: Env) => Promise<void>;
}

// ============================================================================
// Queue Types
// ============================================================================

/**
 * Cloudflare Queue binding configuration
 */
export interface QueueBinding {
  /**
   * Queue name in Cloudflare
   */
  queueName: string;

  /**
   * Maximum number of retries
   */
  maxRetries?: number;

  /**
   * Delay between retries in seconds
   */
  retryDelay?: number;
}

/**
 * Batch processing options
 */
export interface BatchOptions {
  /**
   * Maximum batch size
   */
  maxSize?: number;

  /**
   * Maximum wait time for batch (seconds)
   */
  maxWaitSeconds?: number;

  /**
   * Parallel processing count
   */
  concurrency?: number;
}

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * Event subscription filter
 */
export interface SubscriptionFilter {
  /**
   * Event types to subscribe to
   */
  eventTypes?: string[];

  /**
   * Aggregate types to filter
   */
  aggregateTypes?: string[];

  /**
   * Tenant ID filter
   */
  tenantId?: string;

  /**
   * Custom filter function
   */
  custom?: (event: BaseEvent) => boolean | Promise<boolean>;
}

/**
 * Event subscription
 */
export interface EventSubscription {
  /**
   * Unique subscription ID
   */
  id: string;

  /**
   * Subscription name
   */
  name: string;

  /**
   * Filter criteria
   */
  filter: SubscriptionFilter;

  /**
   * Handler function
   */
  handler: (event: BaseEvent) => Promise<void>;

  /**
   * Subscription status
   */
  status: 'active' | 'paused' | 'error';

  /**
   * Delivery method (inline, queue, webhook)
   */
  delivery: 'inline' | 'queue' | 'webhook';

  /**
   * Webhook URL if delivery is webhook
   */
  webhookUrl?: string;

  /**
   * Max retries for failed delivery
   */
  maxRetries?: number;

  /**
   * Created at timestamp
   */
  createdAt: string;

  /**
   * Updated at timestamp
   */
  updatedAt: string;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Aggregate snapshot for optimization
 */
export interface AggregateSnapshot {
  /**
   * Snapshot ID
   */
  id: string;

  /**
   * Aggregate ID
   */
  aggregateId: string;

  /**
   * Aggregate type
   */
  aggregateType: string;

  /**
   * Aggregate version at snapshot time
   */
  version: number;

  /**
   * Serialized aggregate state
   */
  state: string;

  /**
   * Timestamp when snapshot was created
   */
  timestamp: string;

  /**
   * Snapshot size in bytes
   */
  size: number;
}

/**
 * Snapshot configuration
 */
export interface SnapshotConfig {
  /**
   * Create snapshot every N events
   */
  interval: number;

  /**
   * Maximum number of snapshots to retain
   */
  retention: number;

  /**
   * Compress snapshot data
   */
  compress?: boolean;
}

// ============================================================================
// Replay Types
// ============================================================================

/**
 * Event replay options
 */
export interface ReplayOptions {
  /**
   * Start from sequence number
   */
  fromSequence?: number;

  /**
   * Stop at sequence number
   */
  toSequence?: number;

  /**
   * Filter by event types
   */
  eventTypes?: string[];

  /**
   * Filter by aggregate type
   */
  aggregateType?: string;

  /**
   * Speed multiplier (1 = real-time, 10 = 10x faster)
   */
  speedMultiplier?: number;

  /**
   * Stop on error
   */
  stopOnError?: boolean;
}

/**
 * Replay progress tracking
 */
export interface ReplayProgress {
  /**
   * Replay ID
   */
  id: string;

  /**
   * Current sequence number
   */
  currentSequence: number;

  /**
   * Total events to process
   */
  totalEvents: number;

  /**
   * Events processed so far
   */
  processedEvents: number;

  /**
   * Number of errors encountered
   */
  errorCount: number;

  /**
   * Replay status
   */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /**
   * Started at timestamp
   */
  startedAt: string;

  /**
   * Completed at timestamp (if finished)
   */
  completedAt?: string;

  /**
   * Estimated completion time
   */
  estimatedCompletion?: string;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for event system
 */
export interface Env {
  // D1 Database for event store
  DB: D1Database;

  // Cloudflare Queues
  EVENT_QUEUE?: Queue;
  DEAD_LETTER_QUEUE?: Queue;

  // KV for caching
  CACHE: KVNamespace;

  // R2 for large event data (optional)
  STORAGE?: R2Bucket;

  // Optional: Analytics for monitoring
  ANALYTICS?: AnalyticsEngineDataset;
}
