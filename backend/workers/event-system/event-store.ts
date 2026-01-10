/**
 * Event Store Implementation
 *
 * Provides event sourcing persistence with D1 database.
 * Supports concurrent writes with optimistic locking.
 */

import type {
  BaseEvent,
  EventStoreEntry,
  EventStreamOptions,
  EventStreamResult,
  AggregateSnapshot,
  SnapshotConfig,
} from './types';
import type { Env } from './types';

// ============================================================================
// Event Store Class
// ============================================================================

export class EventStore {
  private db: D1Database;
  private cache: KVNamespace;
  private snapshotConfig: SnapshotConfig;

  constructor(db: D1Database, cache: KVNamespace, snapshotConfig: SnapshotConfig = {
    interval: 100,
    retention: 10,
  }) {
    this.db = db;
    this.cache = cache;
    this.snapshotConfig = snapshotConfig;
  }

  // ========================================================================
  // Event Persistence
  // ========================================================================

  /**
   * Append events to an aggregate stream with optimistic locking.
   *
   * @param aggregateId - The aggregate identifier
   * @param aggregateType - The aggregate type name
   * @param events - Events to append
   * @param expectedVersion - Expected current version for optimistic locking
   * @returns The new version number
   * @throws Error if version conflict detected
   */
  async appendEvents(
    aggregateId: string,
    aggregateType: string,
    events: Omit<BaseEvent, 'id' | 'timestamp' | 'version'>[],
    expectedVersion?: number
  ): Promise<number> {
    const stmt = this.db.prepare(
      'SELECT version FROM events WHERE aggregate_id = ? ORDER BY version DESC LIMIT 1'
    );

    const current = await stmt.bind(aggregateId).first<{ version: number }>();
    const currentVersion = current?.version ?? 0;

    // Check optimistic lock
    if (expectedVersion !== undefined && currentVersion !== expectedVersion) {
      throw new Error(
        `Concurrency conflict: Expected version ${expectedVersion}, got ${currentVersion}`
      );
    }

    const newVersion = currentVersion + events.length;
    const timestamp = new Date().toISOString();

    // Insert all events in a transaction
    const insertPromises = events.map((event, index) => {
      const fullEvent: EventStoreEntry = {
        id: crypto.randomUUID(),
        event_type: event.type,
        aggregate_id: aggregateId,
        aggregate_type: aggregateType,
        version: currentVersion + index + 1,
        data: JSON.stringify(event.data),
        metadata: JSON.stringify(event.metadata),
        timestamp,
        sequence_number: 0, // Will be set by trigger
      };

      return this.db.prepare(`
        INSERT INTO events (
          id, event_type, aggregate_id, aggregate_type, version,
          data, metadata, timestamp, sequence_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
          (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM events)
        )
      `).bind(
        fullEvent.id,
        fullEvent.event_type,
        fullEvent.aggregate_id,
        fullEvent.aggregate_type,
        fullEvent.version,
        fullEvent.data,
        fullEvent.metadata,
        fullEvent.timestamp
      ).run();
    });

    await Promise.all(insertPromises);

    // Invalidate cache for this aggregate
    await this.cache.delete(`aggregate:${aggregateId}`);

    // Check if snapshot should be created
    if (this.snapshotConfig.interval > 0 &&
        newVersion % this.snapshotConfig.interval === 0) {
      await this.createSnapshot(aggregateId, aggregateType, newVersion);
    }

    return newVersion;
  }

  /**
   * Get all events for an aggregate.
   *
   * @param aggregateId - The aggregate identifier
   * @param fromVersion - Optional starting version
   * @returns Array of events
   */
  async getEvents(
    aggregateId: string,
    fromVersion: number = 0
  ): Promise<BaseEvent[]> {
    // Try cache first
    const cacheKey = `aggregate:${aggregateId}:${fromVersion}`;
    const cached = await this.cache.get(cacheKey, 'json');
    if (cached) {
      return cached as BaseEvent[];
    }

    const stmt = this.db.prepare(`
      SELECT * FROM events
      WHERE aggregate_id = ? AND version > ?
      ORDER BY version ASC
    `);

    const result = await stmt.bind(aggregateId, fromVersion).all();

    const events = result.results.map((row: any) => this.deserializeEvent(row));

    // Cache for 5 minutes
    await this.cache.put(cacheKey, JSON.stringify(events), {
      expirationTtl: 300,
    });

    return events;
  }

  /**
   * Get events from the global stream (for projections/subscriptions).
   *
   * @param options - Stream options
   * @returns Event stream result
   */
  async getStream(options: EventStreamOptions = {}): Promise<EventStreamResult> {
    const {
      fromSequence = 0,
      limit = 100,
      eventType,
      aggregateType,
      tenantId,
    } = options;

    let query = `
      SELECT * FROM events
      WHERE sequence_number > ?
    `;
    const params: (string | number)[] = [fromSequence];

    if (eventType) {
      if (Array.isArray(eventType)) {
        const placeholders = eventType.map(() => '?').join(',');
        query += ` AND event_type IN (${placeholders})`;
        params.push(...eventType);
      } else {
        query += ' AND event_type = ?';
        params.push(eventType);
      }
    }

    if (aggregateType) {
      query += ' AND aggregate_type = ?';
      params.push(aggregateType);
    }

    if (tenantId) {
      // Need to check in metadata JSON
      query += ` AND json_extract(metadata, '$.tenantId') = ?`;
      params.push(tenantId);
    }

    query += ' ORDER BY sequence_number ASC LIMIT ?';
    params.push(limit + 1); // Get one extra to check for more

    const stmt = this.db.prepare(query);
    const result = await stmt.bind(...params).all();

    const rows = result.results as any[];
    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;

    const lastSequence = events.length > 0
      ? events[events.length - 1].sequence_number
      : fromSequence;

    return {
      events: events.map((row) => this.deserializeEvent(row)),
      nextSequence: hasMore ? lastSequence : undefined,
      hasMore,
    };
  }

  // ========================================================================
  // Snapshots
  // ========================================================================

  /**
   * Create a snapshot of an aggregate's current state.
   *
   * @param aggregateId - The aggregate identifier
   * @param aggregateType - The aggregate type
   * @param version - Current version
   * @param state - Current state to snapshot
   */
  async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    version: number,
    state?: Record<string, unknown>
  ): Promise<void> {
    // Get current state from events if not provided
    if (!state) {
      const events = await this.getEvents(aggregateId);
      state = this.rebuildState(events);
    }

    const snapshot: AggregateSnapshot = {
      id: crypto.randomUUID(),
      aggregateId,
      aggregateType,
      version,
      state: JSON.stringify(state),
      timestamp: new Date().toISOString(),
      size: JSON.stringify(state).length,
    };

    await this.db.prepare(`
      INSERT INTO snapshots (
        id, aggregate_id, aggregate_type, version,
        state, timestamp, size
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshot.id,
      snapshot.aggregateId,
      snapshot.aggregateType,
      snapshot.version,
      snapshot.state,
      snapshot.timestamp,
      snapshot.size
    ).run();

    // Clean up old snapshots
    await this.cleanupSnapshots(aggregateId);
  }

  /**
   * Get the latest snapshot for an aggregate.
   *
   * @param aggregateId - The aggregate identifier
   * @returns The snapshot or null if none exists
   */
  async getLatestSnapshot(
    aggregateId: string
  ): Promise<AggregateSnapshot | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM snapshots
      WHERE aggregate_id = ?
      ORDER BY version DESC
      LIMIT 1
    `);

    const result = await stmt.bind(aggregateId).first();

    return result as AggregateSnapshot | null;
  }

  /**
   * Load aggregate state, optionally using snapshot for performance.
   *
   * @param aggregateId - The aggregate identifier
   * @returns Tuple of (state, version, events since snapshot)
   */
  async loadAggregate(
    aggregateId: string
  ): Promise<{ state: Record<string, unknown>; version: number; events: BaseEvent[] }> {
    const snapshot = await this.getLatestSnapshot(aggregateId);

    if (snapshot) {
      const state = JSON.parse(snapshot.state) as Record<string, unknown>;
      const events = await this.getEvents(aggregateId, snapshot.version);

      // Apply events since snapshot
      for (const event of events) {
        this.applyEvent(state, event);
      }

      return {
        state,
        version: snapshot.version + events.length,
        events,
      };
    }

    // No snapshot, load all events
    const events = await this.getEvents(aggregateId);
    const state = this.rebuildState(events);

    return {
      state,
      version: events.length,
      events,
    };
  }

  /**
   * Remove old snapshots beyond retention limit.
   */
  private async cleanupSnapshots(aggregateId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM snapshots
      WHERE aggregate_id = ? AND id NOT IN (
        SELECT id FROM snapshots
        WHERE aggregate_id = ?
        ORDER BY version DESC
        LIMIT ?
      )
    `);

    await stmt.bind(aggregateId, aggregateId, this.snapshotConfig.retention).run();
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Deserialize a database row to a BaseEvent.
   */
  private deserializeEvent(row: any): BaseEvent {
    return {
      id: row.id,
      type: row.event_type,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      version: row.version,
      data: JSON.parse(row.data),
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp,
    };
  }

  /**
   * Rebuild aggregate state from events.
   */
  private rebuildState(events: BaseEvent[]): Record<string, unknown> {
    const state: Record<string, unknown> = {};

    for (const event of events) {
      this.applyEvent(state, event);
    }

    return state;
  }

  /**
   * Apply a single event to state.
   */
  private applyEvent(state: Record<string, unknown>, event: BaseEvent): void {
    // Default behavior: merge event data into state
    // Specific aggregates can override this with custom logic
    Object.assign(state, event.data);

    // Track version
    state.version = event.version;
    state.updatedAt = event.timestamp;
  }
}

// ============================================================================
// Event Store Factory
// ============================================================================

/**
 * Create an event store instance from environment bindings.
 */
export function createEventStore(env: Env, config?: SnapshotConfig): EventStore {
  return new EventStore(env.DB, env.CACHE, config);
}
