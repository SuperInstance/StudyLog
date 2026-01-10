/**
 * Projection System Implementation
 *
 * Read model projections from the event stream.
 * Supports incremental updates and rebuilding.
 */

import type {
  BaseEvent,
  ProjectionHandler,
  ProjectionState,
  ReplayOptions,
  ReplayProgress,
} from './types';
import type { Env } from './types';
import { EventStore } from './event-store';

// ============================================================================
// Projection Manager Class
// ============================================================================

export class ProjectionManager {
  private eventStore: EventStore;
  private db: D1Database;
  private handlers: Map<string, ProjectionHandler> = new Map();

  constructor(eventStore: EventStore, db: D1Database) {
    this.eventStore = eventStore;
    this.db = db;
  }

  // ========================================================================
  // Handler Registration
  // ========================================================================

  /**
   * Register a projection handler.
   */
  registerHandler(handler: ProjectionHandler): void {
    this.handlers.set(handler.name, handler);
  }

  /**
   * Unregister a projection handler.
   */
  unregisterHandler(name: string): boolean {
    return this.handlers.delete(name);
  }

  /**
   * Get a registered handler.
   */
  getHandler(name: string): ProjectionHandler | undefined {
    return this.handlers.get(name);
  }

  /**
   * List all registered handlers.
   */
  listHandlers(): ProjectionHandler[] {
    return Array.from(this.handlers.values());
  }

  // ========================================================================
  // Projection Processing
  // ========================================================================

  /**
   * Process all projections with new events.
   *
   * @returns Number of projections updated
   */
  async processAll(): Promise<number> {
    let updated = 0;

    for (const handler of this.handlers.values()) {
      const state = await this.getProjectionState(handler.name);

      if (state.status === 'processing') {
        continue; // Skip if already processing
      }

      try {
        await this.processProjection(handler);
        updated++;
      } catch (error) {
        console.error(`Projection ${handler.name} error:`, error);
        await this.markProjectionError(handler.name, error);
      }
    }

    return updated;
  }

  /**
   * Process a single projection.
   */
  async processProjection(handler: ProjectionHandler): Promise<void> {
    const state = await this.getProjectionState(handler.name);

    // Mark as processing
    await this.updateProjectionState(handler.name, {
      status: 'processing',
    });

    try {
      // Get current read model
      let readModel = await handler.getState(this.db);
      let processed = 0;
      const startTime = Date.now();

      // Process events in batches
      let hasMore = true;
      let fromSequence = state.lastSequence;

      while (hasMore && processed < 1000) { // Limit per invocation
        const stream = await this.eventStore.getStream({
          fromSequence,
          limit: 100,
        });

        // Filter events by handler's event types
        const relevantEvents = stream.events.filter(e =>
          handler.eventTypes.includes(e.type)
        );

        // Apply each event
        for (const event of relevantEvents) {
          readModel = await handler.handle(event, readModel, this.db);
          fromSequence = stream.events[stream.events.length - 1]?.metadata
            .sequenceNumber ?? fromSequence;
          processed++;
        }

        hasMore = stream.hasMore;
      }

      // Save updated read model
      await handler.saveState(readModel, this.db);

      // Update projection state
      const processingTime = Date.now() - startTime;
      await this.updateProjectionState(handler.name, {
        lastSequence: fromSequence,
        status: 'idle',
        stats: {
          totalProcessed: state.stats.totalProcessed + processed,
          totalErrors: state.stats.totalErrors,
          avgProcessingTimeMs: (
            (state.stats.avgProcessingTimeMs * state.stats.totalProcessed + processingTime) /
            (state.stats.totalProcessed + processed)
          ),
        },
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.markProjectionError(handler.name, error);
      throw error;
    }
  }

  // ========================================================================
  // Rebuilding
  // ========================================================================

  /**
   * Rebuild a projection from scratch.
   */
  async rebuild(handlerName: string, options: ReplayOptions = {}): Promise<string> {
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      throw new Error(`Handler not found: ${handlerName}`);
    }

    // Initialize projection
    await handler.initialize(this.db);

    // Reset state
    await this.updateProjectionState(handlerName, {
      lastSequence: 0,
      status: 'idle',
      stats: {
        totalProcessed: 0,
        totalErrors: 0,
        avgProcessingTimeMs: 0,
      },
      updatedAt: new Date().toISOString(),
    });

    // Create replay progress tracker
    const replayId = crypto.randomUUID();
    const progress: ReplayProgress = {
      id: replayId,
      currentSequence: 0,
      totalEvents: 0,
      processedEvents: 0,
      errorCount: 0,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    await this.saveReplayProgress(replayId, progress);

    return replayId;
  }

  /**
   * Get replay progress.
   */
  async getReplayProgress(replayId: string): Promise<ReplayProgress | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM replay_progress WHERE id = ?'
    );
    const result = await stmt.bind(replayId).first();

    return result as ReplayProgress | null;
  }

  // ========================================================================
  // State Management
  // ========================================================================

  /**
   * Get projection state from database.
   */
  private async getProjectionState(name: string): Promise<ProjectionState> {
    const stmt = this.db.prepare(
      'SELECT * FROM projection_states WHERE name = ?'
    );
    const result = await stmt.bind(name).first();

    if (result) {
      return {
        id: result.id as string,
        name: result.name as string,
        lastSequence: result.last_sequence as number,
        status: result.status as ProjectionState['status'],
        error: result.error as string | undefined,
        updatedAt: result.updated_at as string,
        stats: JSON.parse(result.stats as string) as ProjectionState['stats'],
      };
    }

    // Create initial state
    const initialState: ProjectionState = {
      id: crypto.randomUUID(),
      name,
      lastSequence: 0,
      status: 'idle',
      updatedAt: new Date().toISOString(),
      stats: {
        totalProcessed: 0,
        totalErrors: 0,
        avgProcessingTimeMs: 0,
      },
    };

    await this.db.prepare(`
      INSERT INTO projection_states (id, name, last_sequence, status, updated_at, stats)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      initialState.id,
      initialState.name,
      initialState.lastSequence,
      initialState.status,
      initialState.updatedAt,
      JSON.stringify(initialState.stats)
    ).run();

    return initialState;
  }

  /**
   * Update projection state.
   */
  private async updateProjectionState(
    name: string,
    updates: Partial<ProjectionState>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.lastSequence !== undefined) {
      fields.push('last_sequence = ?');
      values.push(updates.lastSequence);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    if (updates.stats !== undefined) {
      fields.push('stats = ?');
      values.push(JSON.stringify(updates.stats));
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(name);

    await this.db.prepare(`
      UPDATE projection_states SET ${fields.join(', ')} WHERE name = ?
    `).bind(...values).run();
  }

  /**
   * Mark projection as errored.
   */
  private async markProjectionError(
    name: string,
    error: unknown
  ): Promise<void> {
    await this.updateProjectionState(name, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /**
   * Save replay progress.
   */
  private async saveReplayProgress(
    replayId: string,
    progress: ReplayProgress
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO replay_progress (
        id, current_sequence, total_events, processed_events, error_count,
        status, started_at, completed_at, estimated_completion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        current_sequence = excluded.current_sequence,
        processed_events = excluded.processed_events,
        error_count = excluded.error_count,
        status = excluded.status,
        completed_at = excluded.completed_at,
        estimated_completion = excluded.estimated_completion
    `).bind(
      progress.id,
      progress.currentSequence,
      progress.totalEvents,
      progress.processedEvents,
      progress.errorCount,
      progress.status,
      progress.startedAt,
      progress.completedAt || null,
      progress.estimatedCompletion || null
    ).run();
  }
}

// ============================================================================
// Built-in Projections
// ============================================================================

/**
 * Student progress projection.
 */
export class StudentProgressProjection {
  static handler: ProjectionHandler<StudentProgressReadModel> = {
    name: 'student-progress',
    eventTypes: [
      'student.registered',
      'student.progress.updated',
      'student.achievement.unlocked',
      'puzzle.completed',
    ],

    async initialize(env: Env): Promise<void> {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS student_progress_read_model (
          student_id TEXT PRIMARY KEY,
          total_xp INTEGER DEFAULT 0,
          completed_puzzles INTEGER DEFAULT 0,
          achievements TEXT DEFAULT '[]',
          last_activity TEXT,
          current_phase TEXT DEFAULT 'player',
          updated_at TEXT
        )
      `).run();
    },

    async handle(
      event: BaseEvent,
      model: StudentProgressReadModel,
      env: Env
    ): Promise<StudentProgressReadModel> {
      const studentId = event.aggregateId;

      if (!model[studentId]) {
        model[studentId] = {
          studentId,
          totalXp: 0,
          completedPuzzles: 0,
          achievements: [],
          lastActivity: event.timestamp,
          currentPhase: 'player',
          updatedAt: event.timestamp,
        };
      }

      const student = model[studentId];

      switch (event.type) {
        case 'student.progress.updated':
          student.totalXp = (event.data.xp as number) ?? student.totalXp;
          student.currentPhase = (event.data.phase as string) ?? student.currentPhase;
          break;

        case 'student.achievement.unlocked':
          student.achievements.push(event.data.achievementId as string);
          break;

        case 'puzzle.completed':
          student.completedPuzzles++;
          student.totalXp += event.data.xpEarned as number;
          break;
      }

      student.lastActivity = event.timestamp;
      student.updatedAt = event.timestamp;

      return model;
    },

    async getState(env: Env): Promise<StudentProgressReadModel> {
      const result = await env.DB.prepare(
        'SELECT * FROM student_progress_read_model'
      ).all();

      const model: StudentProgressReadModel = {};

      for (const row of result.results as any[]) {
        model[row.student_id] = {
          studentId: row.student_id,
          totalXp: row.total_xp,
          completedPuzzles: row.completed_puzzles,
          achievements: JSON.parse(row.achievements || '[]'),
          lastActivity: row.last_activity,
          currentPhase: row.current_phase,
          updatedAt: row.updated_at,
        };
      }

      return model;
    },

    async saveState(model: StudentProgressReadModel, env: Env): Promise<void> {
      for (const studentId in model) {
        const student = model[studentId];
        await env.DB.prepare(`
          INSERT INTO student_progress_read_model (
            student_id, total_xp, completed_puzzles, achievements,
            last_activity, current_phase, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (student_id) DO UPDATE SET
            total_xp = excluded.total_xp,
            completed_puzzles = excluded.completed_puzzles,
            achievements = excluded.achievements,
            last_activity = excluded.last_activity,
            current_phase = excluded.current_phase,
            updated_at = excluded.updated_at
        `).bind(
          student.studentId,
          student.totalXp,
          student.completedPuzzles,
          JSON.stringify(student.achievements),
          student.lastActivity,
          student.currentPhase,
          student.updatedAt
        ).run();
      }
    },
  };
}

/**
 * Student progress read model type.
 */
export interface StudentProgressReadModel {
  [studentId: string]: {
    studentId: string;
    totalXp: number;
    completedPuzzles: number;
    achievements: string[];
    lastActivity: string;
    currentPhase: 'player' | 'reader' | 'tweaker' | 'creator' | 'mentor';
    updatedAt: string;
  };
}

/**
 * Cost tracking projection.
 */
export class CostTrackingProjection {
  static handler: ProjectionHandler<CostReadModel> = {
    name: 'cost-tracking',
    eventTypes: [
      'ai.request.completed',
      'ai.cost.tracked',
    ],

    async initialize(env: Env): Promise<void> {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS cost_read_model (
          date TEXT PRIMARY KEY,
          total_cost REAL DEFAULT 0,
          total_requests INTEGER DEFAULT 0,
          total_tokens INTEGER DEFAULT 0,
          by_provider TEXT DEFAULT '{}',
          by_model TEXT DEFAULT '{}',
          updated_at TEXT
        )
      `).run();
    },

    async handle(
      event: BaseEvent,
      model: CostReadModel,
      env: Env
    ): Promise<CostReadModel> {
      const date = event.timestamp.split('T')[0];

      if (!model[date]) {
        model[date] = {
          date,
          totalCost: 0,
          totalRequests: 0,
          totalTokens: 0,
          byProvider: {},
          byModel: {},
          updatedAt: event.timestamp,
        };
      }

      const daily = model[date];

      if (event.type === 'ai.cost.tracked' || event.type === 'ai.request.completed') {
        const cost = event.data.cost as number;
        const provider = event.data.provider as string;
        const modelUsed = event.data.model as string;
        const tokens = (event.data.inputTokens as number || 0) +
                      (event.data.outputTokens as number || 0);

        daily.totalCost += cost;
        daily.totalRequests++;
        daily.totalTokens += tokens;

        daily.byProvider[provider] = (daily.byProvider[provider] || 0) + cost;
        daily.byModel[modelUsed] = (daily.byModel[modelUsed] || { cost: 0, tokens: 0 }) as any;
        (daily.byModel[modelUsed] as any).cost += cost;
        (daily.byModel[modelUsed] as any).tokens += tokens;
      }

      daily.updatedAt = event.timestamp;

      return model;
    },

    async getState(env: Env): Promise<CostReadModel> {
      const result = await env.DB.prepare(
        'SELECT * FROM cost_read_model'
      ).all();

      const model: CostReadModel = {};

      for (const row of result.results as any[]) {
        model[row.date] = {
          date: row.date,
          totalCost: row.total_cost,
          totalRequests: row.total_requests,
          totalTokens: row.total_tokens,
          byProvider: JSON.parse(row.by_provider || '{}'),
          byModel: JSON.parse(row.by_model || '{}'),
          updatedAt: row.updated_at,
        };
      }

      return model;
    },

    async saveState(model: CostReadModel, env: Env): Promise<void> {
      for (const date in model) {
        const daily = model[date];
        await env.DB.prepare(`
          INSERT INTO cost_read_model (
            date, total_cost, total_requests, total_tokens,
            by_provider, by_model, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (date) DO UPDATE SET
            total_cost = excluded.total_cost,
            total_requests = excluded.total_requests,
            total_tokens = excluded.total_tokens,
            by_provider = excluded.by_provider,
            by_model = excluded.by_model,
            updated_at = excluded.updated_at
        `).bind(
          daily.date,
          daily.totalCost,
          daily.totalRequests,
          daily.totalTokens,
          JSON.stringify(daily.byProvider),
          JSON.stringify(daily.byModel),
          daily.updatedAt
        ).run();
      }
    },
  };
}

/**
 * Cost tracking read model type.
 */
export interface CostReadModel {
  [date: string]: {
    date: string;
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    byProvider: Record<string, number>;
    byModel: Record<string, { cost: number; tokens: number }>;
    updatedAt: string;
  };
}
