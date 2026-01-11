/**
 * StudyLoG.AI Training Data Collector - Storage Layer
 *
 * Provides abstraction for different storage backends:
 * - SQLite (Node.js backend)
 * - IndexedDB (Browser/Theia extension)
 * - Cloudflare D1 (Cloudflare Workers)
 */

import type {
  LearningRecord,
  SessionInfo,
  StudentDataSettings,
  CollectionStatistics,
  LearningContext,
  LearningDecision,
  LearningOutcome,
  QualityLabel,
  LearningDecisionType,
  DecisionSource,
} from '../models/index.js';

// ============================================================================
// Abstract Storage Interface
// ============================================================================

/**
 * Abstract storage interface for training data
 */
export interface StorageAdapter {
  // Initialization
  initialize(): Promise<void>;

  // Session management
  createSession(sessionId: string, studentIds: string[], notes?: string, module?: string): Promise<void>;
  updateSession(sessionId: string, endTime?: number, totalDecisions?: number): Promise<void>;
  getSession(sessionId: string): Promise<SessionInfo | null>;

  // Student settings
  getStudentSettings(studentId: string): Promise<StudentDataSettings>;
  updateStudentSettings(settings: StudentDataSettings): Promise<void>;

  // Records
  createRecord(record: LearningRecord): Promise<void>;
  updateRecord(recordId: string, updates: Partial<LearningRecord>): Promise<void>;
  updateOutcome(recordId: string, outcome: LearningOutcome): Promise<void>;
  updateQualityLabel(recordId: string, label: QualityLabel, notes?: string): Promise<void>;
  getRecord(recordId: string): Promise<LearningRecord | null>;

  // Queries
  getRecordsByStudent(
    studentId: string,
    options?: QueryOptions
  ): Promise<LearningRecord[]>;
  getRecordsBySession(sessionId: string): Promise<LearningRecord[]>;
  getTrainingRecords(
    studentId: string,
    options?: TrainingQueryOptions
  ): Promise<LearningRecord[]>;

  // Statistics
  getStatistics(studentId?: string, sessionId?: string): Promise<CollectionStatistics>;

  // Cleanup
  deleteRecord(recordId: string): Promise<boolean>;
  cleanupOldRecords(studentId: string, cutoffDate: Date): Promise<number>;

  // Close
  close(): Promise<void>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  includeOutcomes?: boolean;
  trainingEligibleOnly?: boolean;
  startDate?: Date;
  endDate?: Date;
  decisionTypes?: LearningDecisionType[];
  sources?: DecisionSource[];
}

export interface TrainingQueryOptions extends QueryOptions {
  minQuality?: QualityLabel;
  minConfidence?: number;
  includeTeachingMoments?: boolean;
}

// ============================================================================
// SQLite Implementation (Node.js)
// ============================================================================

/**
 * SQLite storage adapter for Node.js backend
 */
export class SQLiteStorage implements StorageAdapter {
  private db: any = null; // sqlite3 Database
  private dbPath: string;
  private initialized = false;

  constructor(dbPath: string = 'data/training_data.db') {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Dynamic import for sqlite3 (Node.js only)
    const sqlite3 = await import('sqlite3');
    const { open } = await import('sqlite');

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });

    await this.createTables();
    this.initialized = true;
  }

  private async createTables(): Promise<void> {
    // Records table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS records (
        record_id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        session_id TEXT,
        timestamp INTEGER NOT NULL,

        -- Context (JSON)
        learning_context TEXT NOT NULL,

        -- Decision (JSON)
        decision_data TEXT NOT NULL,

        -- Outcome (JSON, filled in later)
        outcome_data TEXT,
        outcome_timestamp INTEGER,

        -- Meta
        training_eligible INTEGER DEFAULT 1,
        quality_label TEXT,
        reflection_notes TEXT,

        -- Index columns for queries
        decision_type TEXT,
        decision_source TEXT,
        module TEXT,
        success INTEGER,

        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )
    `);

    // Sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        start_timestamp INTEGER NOT NULL,
        end_timestamp INTEGER,
        student_ids TEXT,
        total_decisions INTEGER DEFAULT 0,
        notes TEXT,
        module TEXT
      )
    `);

    // Student settings table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_settings (
        student_id TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 1,
        collect_student_decisions INTEGER DEFAULT 1,
        collect_ai_tutor_decisions INTEGER DEFAULT 1,
        collect_rule_engine_decisions INTEGER DEFAULT 1,
        collect_human_tutor_decisions INTEGER DEFAULT 1,
        retention_days INTEGER DEFAULT 90,
        training_eligible INTEGER DEFAULT 1,
        anonymize_for_training INTEGER DEFAULT 1,
        updated_timestamp INTEGER NOT NULL
      )
    `);

    // Create indexes
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_student_id ON records(student_id);
      CREATE INDEX IF NOT EXISTS idx_session_id ON records(session_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON records(timestamp);
      CREATE INDEX IF NOT EXISTS idx_decision_source ON records(decision_source);
      CREATE INDEX IF NOT EXISTS idx_training_eligible ON records(training_eligible);
      CREATE INDEX IF NOT EXISTS idx_quality_label ON records(quality_label);
      CREATE INDEX IF NOT EXISTS idx_module ON records(module);
      CREATE INDEX IF NOT EXISTS idx_success ON records(success);
    `);
  }

  async createSession(
    sessionId: string,
    studentIds: string[],
    notes?: string,
    module?: string
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO sessions (session_id, start_timestamp, student_ids, notes, module)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, Date.now(), JSON.stringify(studentIds), notes || '', module || '']
    );
  }

  async updateSession(
    sessionId: string,
    endTime?: number,
    totalDecisions?: number
  ): Promise<void> {
    const updates: string[] = [];
    const values: (number | string)[] = [];

    if (endTime !== undefined) {
      updates.push('end_timestamp = ?');
      values.push(endTime);
    }
    if (totalDecisions !== undefined) {
      updates.push('total_decisions = ?');
      values.push(totalDecisions);
    }

    if (updates.length === 0) return;

    values.push(sessionId);
    await this.db.run(
      `UPDATE sessions SET ${updates.join(', ')} WHERE session_id = ?`,
      values
    );
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    const row = await this.db.get('SELECT * FROM sessions WHERE session_id = ?', [sessionId]);
    if (!row) return null;

    return {
      sessionId: row.session_id,
      startTimestamp: row.start_timestamp,
      endTimestamp: row.end_timestamp,
      studentIds: JSON.parse(row.student_ids || '[]'),
      totalDecisions: row.total_decisions,
      notes: row.notes || undefined,
      module: row.module || undefined,
    };
  }

  async getStudentSettings(studentId: string): Promise<StudentDataSettings> {
    const row = await this.db.get(
      'SELECT * FROM student_settings WHERE student_id = ?',
      [studentId]
    );

    if (row) {
      return {
        studentId: row.student_id,
        enabled: !!row.enabled,
        collectStudentDecisions: !!row.collect_student_decisions,
        collectAITutorDecisions: !!row.collect_ai_tutor_decisions,
        collectRuleEngineDecisions: !!row.collect_rule_engine_decisions,
        collectHumanTutorDecisions: !!row.collect_human_tutor_decisions,
        retentionDays: row.retention_days,
        trainingEligible: !!row.training_eligible,
        anonymizeForTraining: !!row.anonymize_for_training,
      };
    }

    // Return default settings
    return {
      studentId,
      enabled: true,
      collectStudentDecisions: true,
      collectAITutorDecisions: true,
      collectRuleEngineDecisions: true,
      collectHumanTutorDecisions: true,
      retentionDays: 90,
      trainingEligible: true,
      anonymizeForTraining: true,
    };
  }

  async updateStudentSettings(settings: StudentDataSettings): Promise<void> {
    await this.db.run(`
      INSERT OR REPLACE INTO student_settings
      (student_id, enabled, collect_student_decisions, collect_ai_tutor_decisions,
       collect_rule_engine_decisions, collect_human_tutor_decisions, retention_days,
       training_eligible, anonymize_for_training, updated_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      settings.studentId,
      settings.enabled ? 1 : 0,
      settings.collectStudentDecisions ? 1 : 0,
      settings.collectAITutorDecisions ? 1 : 0,
      settings.collectRuleEngineDecisions ? 1 : 0,
      settings.collectHumanTutorDecisions ? 1 : 0,
      settings.retentionDays,
      settings.trainingEligible ? 1 : 0,
      settings.anonymizeForTraining ? 1 : 0,
      Date.now(),
    ]);
  }

  async createRecord(record: LearningRecord): Promise<void> {
    await this.db.run(`
      INSERT INTO records
      (record_id, student_id, session_id, timestamp, learning_context, decision_data,
       decision_type, decision_source, module, training_eligible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      record.recordId,
      record.studentId,
      record.sessionId,
      record.timestamp,
      JSON.stringify(record.context),
      JSON.stringify(record.decision),
      record.decision.decisionType,
      record.decision.source,
      record.context.learningState.module,
      record.trainingEligible ? 1 : 0,
    ]);
  }

  async updateRecord(recordId: string, updates: Partial<LearningRecord>): Promise<void> {
    const parts: string[] = [];
    const values: unknown[] = [];

    if (updates.outcome) {
      parts.push('outcome_data = ?, outcome_timestamp = ?, success = ?');
      values.push(
        JSON.stringify(updates.outcome),
        updates.outcome.timestamp || Date.now(),
        updates.outcome.success ? 1 : 0
      );
    }
    if (updates.qualityLabel) {
      parts.push('quality_label = ?');
      values.push(updates.qualityLabel);
    }
    if (updates.reflectionNotes !== undefined) {
      parts.push('reflection_notes = ?');
      values.push(updates.reflectionNotes);
    }
    if (updates.trainingEligible !== undefined) {
      parts.push('training_eligible = ?');
      values.push(updates.trainingEligible ? 1 : 0);
    }

    if (parts.length === 0) return;

    values.push(recordId);
    await this.db.run(
      `UPDATE records SET ${parts.join(', ')} WHERE record_id = ?`,
      values
    );
  }

  async updateOutcome(recordId: string, outcome: LearningOutcome): Promise<void> {
    await this.updateRecord(recordId, { outcome });
  }

  async updateQualityLabel(recordId: string, label: QualityLabel, notes?: string): Promise<void> {
    await this.db.run(
      'UPDATE records SET quality_label = ?, reflection_notes = COALESCE(?, reflection_notes) WHERE record_id = ?',
      [label, notes || null, recordId]
    );
  }

  async getRecord(recordId: string): Promise<LearningRecord | null> {
    const row = await this.db.get('SELECT * FROM records WHERE record_id = ?', [recordId]);
    return row ? this.rowToRecord(row) : null;
  }

  async getRecordsByStudent(
    studentId: string,
    options: QueryOptions = {}
  ): Promise<LearningRecord[]> {
    const conditions: string[] = ['student_id = ?'];
    const params: (string | number)[] = [studentId];

    if (options.startDate) {
      conditions.push('timestamp >= ?');
      params.push(options.startDate.getTime());
    }
    if (options.endDate) {
      conditions.push('timestamp <= ?');
      params.push(options.endDate.getTime());
    }
    if (options.trainingEligibleOnly) {
      conditions.push('training_eligible = 1');
    }
    if (options.includeOutcomes === false) {
      conditions.push('outcome_data IS NULL');
    } else if (options.includeOutcomes === true) {
      conditions.push('outcome_data IS NOT NULL');
    }
    if (options.decisionTypes?.length) {
      conditions.push(`decision_type IN (${options.decisionTypes.map(() => '?').join(',')})`);
      params.push(...options.decisionTypes);
    }
    if (options.sources?.length) {
      conditions.push(`decision_source IN (${options.sources.map(() => '?').join(',')})`);
      params.push(...options.sources);
    }

    let query = `SELECT * FROM records WHERE ${conditions.join(' AND ')} ORDER BY timestamp DESC`;
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const rows = await this.db.all(query, params);
    return rows.map((r: unknown) => this.rowToRecord(r as any));
  }

  async getRecordsBySession(sessionId: string): Promise<LearningRecord[]> {
    const rows = await this.db.all(
      'SELECT * FROM records WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );
    return rows.map((r: unknown) => this.rowToRecord(r as any));
  }

  async getTrainingRecords(
    studentId: string,
    options: TrainingQueryOptions = {}
  ): Promise<LearningRecord[]> {
    const conditions: string[] = [
      'student_id = ?',
      'training_eligible = 1',
      'outcome_data IS NOT NULL'
    ];
    const params: (string | number)[] = [studentId];

    if (options.minQuality) {
      if (options.minQuality === QualityLabel.EXCELLENT) {
        conditions.push("quality_label = 'excellent'");
      } else if (options.minQuality === QualityLabel.GOOD) {
        conditions.push("quality_label IN ('excellent', 'good')");
      } else if (options.minQuality === QualityLabel.ACCEPTABLE) {
        conditions.push("quality_label IN ('excellent', 'good', 'acceptable')");
      }
    }

    if (options.decisionTypes?.length) {
      conditions.push(`decision_type IN (${options.decisionTypes.map(() => '?').join(',')})`);
      params.push(...options.decisionTypes);
    }

    let query = `SELECT * FROM records WHERE ${conditions.join(' AND ')} ORDER BY timestamp DESC`;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const rows = await this.db.all(query, params);

    // Post-filter for teaching moments and confidence
    let records = rows.map((r: unknown) => this.rowToRecord(r as any));

    if (options.minConfidence !== undefined) {
      records = records.filter(r =>
        r.outcome?.qualityLabel === QualityLabel.TEACHING_MOMENT ||
        r.decision.confidence >= options.minConfidence!
      );
    }

    if (!options.includeTeachingMoments) {
      records = records.filter(r =>
        r.outcome?.qualityLabel !== QualityLabel.TEACHING_MOMENT
      );
    }

    return records;
  }

  async getStatistics(studentId?: string, sessionId?: string): Promise<CollectionStatistics> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (studentId) {
      conditions.push('student_id = ?');
      params.push(studentId);
    }
    if (sessionId) {
      conditions.push('session_id = ?');
      params.push(sessionId);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await this.db.get(
      `SELECT COUNT(*) as count FROM records ${whereClause}`,
      params
    );
    const totalRecords = totalResult.count;

    const bySourceResult = await this.db.all(
      `SELECT decision_source, COUNT(*) as count FROM records ${whereClause} GROUP BY decision_source`,
      params
    );
    const bySource = Object.fromEntries(
      bySourceResult.map((r: any) => [r.decision_source, r.count])
    );

    const byTypeResult = await this.db.all(
      `SELECT decision_type, COUNT(*) as count FROM records ${whereClause} GROUP BY decision_type`,
      params
    );
    const byType = Object.fromEntries(
      byTypeResult.map((r: any) => [r.decision_type, r.count])
    );

    const byModuleResult = await this.db.all(
      `SELECT module, COUNT(*) as count FROM records ${whereClause} GROUP BY module`,
      params
    );
    const byModule = Object.fromEntries(
      byModuleResult.map((r: any) => [r.module, r.count])
    );

    const successResult = await this.db.get(`
      SELECT
        COUNT(CASE WHEN success = 1 THEN 1 END) as successes,
        COUNT(CASE WHEN success = 0 THEN 1 END) as failures,
        COUNT(CASE WHEN success IS NULL THEN 1 END) as pending
      FROM records ${whereClause}
    `, params);

    const byQualityResult = await this.db.all(`
      SELECT quality_label, COUNT(*) as count
      FROM records ${whereClause}
      AND quality_label IS NOT NULL
      GROUP BY quality_label
    `, params);
    const byQuality = Object.fromEntries(
      byQualityResult.map((r: any) => [r.quality_label, r.count])
    );

    const trainingEligibleResult = await this.db.get(`
      SELECT COUNT(*) as count
      FROM records ${whereClause}
      AND training_eligible = 1
      AND outcome_data IS NOT NULL
    `, params);

    // Calculate averages
    const records = await this.db.all(
      `SELECT decision_data, outcome_data FROM records ${whereClause}`,
      params
    );

    let totalConfidence = 0;
    let totalQuality = 0;
    let confidenceCount = 0;
    let qualityCount = 0;

    const mistakeCounts = new Map<string, number>();
    const successCounts = new Map<string, number>();

    for (const row of records) {
      const decision = JSON.parse(row.decision_data);
      if (decision.confidence !== undefined) {
        totalConfidence += decision.confidence;
        confidenceCount++;
      }

      if (row.outcome_data) {
        const outcome = JSON.parse(row.outcome_data);
        if (outcome.qualityScore !== undefined) {
          totalQuality += outcome.qualityScore;
          qualityCount++;
        }

        // Track top mistakes and successes
        const action = decision.action || 'unknown';
        if (outcome.success === false) {
          mistakeCounts.set(action, (mistakeCounts.get(action) || 0) + 1);
        } else if (outcome.success === true) {
          successCounts.set(action, (successCounts.get(action) || 0) + 1);
        }
      }
    }

    const topMistakes = [...mistakeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);

    const topSuccesses = [...successCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);

    return {
      totalRecords,
      bySource,
      byType,
      byModule,
      successes: successResult.successes || 0,
      failures: successResult.failures || 0,
      pendingOutcomes: successResult.pending || 0,
      successRate: (successResult.successes || 0) / Math.max(1, (successResult.successes || 0) + (successResult.failures || 0)),
      byQuality,
      trainingEligible: trainingEligibleResult.count || 0,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      averageQuality: qualityCount > 0 ? totalQuality / qualityCount : 0,
      topMistakes,
      topSuccesses,
    };
  }

  async deleteRecord(recordId: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM records WHERE record_id = ?', [recordId]);
    return (result.changes || 0) > 0;
  }

  async cleanupOldRecords(studentId: string, cutoffDate: Date): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM records WHERE student_id = ? AND timestamp < ?',
      [studentId, cutoffDate.getTime()]
    );
    return result.changes || 0;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.initialized = false;
    }
  }

  private rowToRecord(row: any): LearningRecord {
    const context = JSON.parse(row.learning_context) as LearningContext;
    const decision = JSON.parse(row.decision_data) as LearningDecision;
    let outcome: LearningOutcome | undefined;
    if (row.outcome_data) {
      outcome = JSON.parse(row.outcome_data) as LearningOutcome;
    }

    return {
      recordId: row.record_id,
      studentId: row.student_id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      context,
      decision,
      outcome,
      trainingEligible: !!row.training_eligible,
      qualityLabel: row.quality_label || undefined,
      reflectionNotes: row.reflection_notes || undefined,
    };
  }
}

// ============================================================================
// Memory Storage (for testing/browser fallback)
// ============================================================================

/**
 * In-memory storage for testing and browser fallback
 */
export class MemoryStorage implements StorageAdapter {
  private records = new Map<string, LearningRecord>();
  private sessions = new Map<string, SessionInfo>();
  private settings = new Map<string, StudentDataSettings>();

  async initialize(): Promise<void> {
    // Nothing to initialize
  }

  async createSession(
    sessionId: string,
    studentIds: string[],
    notes?: string,
    module?: string
  ): Promise<void> {
    this.sessions.set(sessionId, {
      sessionId,
      startTimestamp: Date.now(),
      studentIds,
      notes,
      module: module as any,
      totalDecisions: 0,
    });
  }

  async updateSession(
    sessionId: string,
    endTime?: number,
    totalDecisions?: number
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (endTime !== undefined) session.endTimestamp = endTime;
      if (totalDecisions !== undefined) session.totalDecisions = totalDecisions;
    }
  }

  async getSession(sessionId: string): Promise<SessionInfo | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getStudentSettings(studentId: string): Promise<StudentDataSettings> {
    if (!this.settings.has(studentId)) {
      this.settings.set(studentId, {
        studentId,
        enabled: true,
        collectStudentDecisions: true,
        collectAITutorDecisions: true,
        collectRuleEngineDecisions: true,
        collectHumanTutorDecisions: true,
        retentionDays: 90,
        trainingEligible: true,
        anonymizeForTraining: true,
      });
    }
    return this.settings.get(studentId)!;
  }

  async updateStudentSettings(settings: StudentDataSettings): Promise<void> {
    this.settings.set(settings.studentId, settings);
  }

  async createRecord(record: LearningRecord): Promise<void> {
    this.records.set(record.recordId, { ...record });
  }

  async updateRecord(recordId: string, updates: Partial<LearningRecord>): Promise<void> {
    const record = this.records.get(recordId);
    if (record) {
      this.records.set(recordId, { ...record, ...updates });
    }
  }

  async updateOutcome(recordId: string, outcome: LearningOutcome): Promise<void> {
    const record = this.records.get(recordId);
    if (record) {
      record.outcome = outcome;
      record.outcome.timestamp = outcome.timestamp || Date.now();
    }
  }

  async updateQualityLabel(recordId: string, label: QualityLabel, notes?: string): Promise<void> {
    const record = this.records.get(recordId);
    if (record) {
      record.qualityLabel = label;
      if (notes) record.reflectionNotes = notes;
    }
  }

  async getRecord(recordId: string): Promise<LearningRecord | null> {
    return this.records.get(recordId) || null;
  }

  async getRecordsByStudent(
    studentId: string,
    options: QueryOptions = {}
  ): Promise<LearningRecord[]> {
    let records = [...this.records.values()]
      .filter(r => r.studentId === studentId)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (options.startDate) {
      records = records.filter(r => r.timestamp >= options.startDate!.getTime());
    }
    if (options.endDate) {
      records = records.filter(r => r.timestamp <= options.endDate!.getTime());
    }
    if (options.trainingEligibleOnly) {
      records = records.filter(r => r.trainingEligible);
    }
    if (options.includeOutcomes === true) {
      records = records.filter(r => r.outcome);
    } else if (options.includeOutcomes === false) {
      records = records.filter(r => !r.outcome);
    }
    if (options.decisionTypes?.length) {
      records = records.filter(r => options.decisionTypes!.includes(r.decision.decisionType));
    }
    if (options.sources?.length) {
      records = records.filter(r => options.sources!.includes(r.decision.source));
    }

    const offset = options.offset || 0;
    const limit = options.limit;
    const paginated = limit ? records.slice(offset, offset + limit) : records.slice(offset);

    return paginated;
  }

  async getRecordsBySession(sessionId: string): Promise<LearningRecord[]> {
    return [...this.records.values()]
      .filter(r => r.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getTrainingRecords(
    studentId: string,
    options: TrainingQueryOptions = {}
  ): Promise<LearningRecord[]> {
    let records = [...this.records.values()]
      .filter(r => r.studentId === studentId && r.trainingEligible && r.outcome)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (options.minQuality) {
      const qualityOrder = [QualityLabel.EXCELLENT, QualityLabel.GOOD, QualityLabel.ACCEPTABLE, QualityLabel.NEEDS_IMPROVEMENT];
      const minIndex = qualityOrder.indexOf(options.minQuality);
      records = records.filter(r => {
        if (!r.outcome?.qualityLabel) return false;
        return qualityOrder.indexOf(r.outcome.qualityLabel) <= minIndex;
      });
    }

    if (options.decisionTypes?.length) {
      records = records.filter(r => options.decisionTypes!.includes(r.decision.decisionType));
    }

    if (options.minConfidence !== undefined) {
      records = records.filter(r =>
        r.outcome?.qualityLabel === QualityLabel.TEACHING_MOMENT ||
        r.decision.confidence >= options.minConfidence!
      );
    }

    if (!options.includeTeachingMoments) {
      records = records.filter(r => r.outcome?.qualityLabel !== QualityLabel.TEACHING_MOMENT);
    }

    if (options.limit) {
      records = records.slice(0, options.limit);
    }

    return records;
  }

  async getStatistics(studentId?: string, sessionId?: string): Promise<CollectionStatistics> {
    let records = [...this.records.values()];

    if (studentId) {
      records = records.filter(r => r.studentId === studentId);
    }
    if (sessionId) {
      records = records.filter(r => r.sessionId === sessionId);
    }

    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byModule: Record<string, number> = {};
    const byQuality: Record<string, number> = {};

    let successes = 0;
    let failures = 0;
    let pendingOutcomes = 0;
    let totalConfidence = 0;
    let totalQuality = 0;
    let confidenceCount = 0;
    let qualityCount = 0;

    const mistakeCounts = new Map<string, number>();
    const successCounts = new Map<string, number>();

    for (const record of records) {
      // Count by source
      bySource[record.decision.source] = (bySource[record.decision.source] || 0) + 1;

      // Count by type
      byType[record.decision.decisionType] = (byType[record.decision.decisionType] || 0) + 1;

      // Count by module
      byModule[record.context.learningState.module] = (byModule[record.context.learningState.module] || 0) + 1;

      // Count outcomes
      if (record.outcome) {
        if (record.outcome.success) successes++; else failures++;

        if (record.outcome.qualityLabel) {
          byQuality[record.outcome.qualityLabel] = (byQuality[record.outcome.qualityLabel] || 0) + 1;
        }
        if (record.outcome.qualityScore !== undefined) {
          totalQuality += record.outcome.qualityScore;
          qualityCount++;
        }

        // Track mistakes and successes
        const action = record.decision.action || 'unknown';
        if (record.outcome.success === false) {
          mistakeCounts.set(action, (mistakeCounts.get(action) || 0) + 1);
        } else if (record.outcome.success === true) {
          successCounts.set(action, (successCounts.get(action) || 0) + 1);
        }
      } else {
        pendingOutcomes++;
      }

      // Confidence
      if (record.decision.confidence !== undefined) {
        totalConfidence += record.decision.confidence;
        confidenceCount++;
      }
    }

    const topMistakes = [...mistakeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);

    const topSuccesses = [...successCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action]) => action);

    return {
      totalRecords: records.length,
      bySource,
      byType,
      byModule,
      successes,
      failures,
      pendingOutcomes,
      successRate: successes / Math.max(1, successes + failures),
      byQuality,
      trainingEligible: records.filter(r => r.trainingEligible && r.outcome).length,
      averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
      averageQuality: qualityCount > 0 ? totalQuality / qualityCount : 0,
      topMistakes,
      topSuccesses,
    };
  }

  async deleteRecord(recordId: string): Promise<boolean> {
    return this.records.delete(recordId);
  }

  async cleanupOldRecords(studentId: string, cutoffDate: Date): Promise<number> {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.studentId === studentId && record.timestamp < cutoffDate.getTime()) {
        this.records.delete(id);
        count++;
      }
    }
    return count;
  }

  async close(): Promise<void> {
    this.records.clear();
    this.sessions.clear();
    this.settings.clear();
  }
}

// ============================================================================
// Factory
// ============================================================================

export type StorageType = 'sqlite' | 'memory' | 'indexeddb';

export interface StorageConfig {
  type?: StorageType;
  dbPath?: string;
  dbName?: string;
}

/**
 * Create a storage adapter based on configuration
 */
export async function createStorage(config: StorageConfig = {}): Promise<StorageAdapter> {
  const type = config.type || (typeof window === 'undefined' ? 'sqlite' : 'indexeddb');

  switch (type) {
    case 'sqlite':
      const sqlite = new SQLiteStorage(config.dbPath);
      await sqlite.initialize();
      return sqlite;

    case 'memory':
      const memory = new MemoryStorage();
      await memory.initialize();
      return memory;

    case 'indexeddb':
      // Dynamic import for browser
      if (typeof window !== 'undefined') {
        const { IndexedDBStorage } = await import('./indexeddb.js');
        const indexeddb = new IndexedDBStorage(config.dbName || 'StudyLoGTraining');
        await indexeddb.initialize();
        return indexeddb;
      }
      throw new Error('IndexedDB is only available in browser environment');

    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}
