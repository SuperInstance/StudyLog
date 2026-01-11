/**
 * StudyLoG.AI Training Data Collector - Main Collector Class
 *
 * Provides the main API for collecting learning events, tracking outcomes,
 * and exporting training data.
 */

import type {
  LearningContext,
  LearningDecision,
  LearningOutcome,
  LearningRecord,
  SessionInfo,
  StudentDataSettings,
  QualityLabel,
  CollectionStatistics,
  LearningDecisionType,
  DecisionSource,
  CollectorEvent,
  EventListener,
  ExportFormat,
  ExportResult,
} from '../models/index.js';
import {
  generateRecordId,
  generateSessionId,
  createDefaultSettings,
  shouldLogDecision,
  computeQualityScore,
  getQualityLabelFromScore,
  isValidLearningDecisionType,
  isValidDecisionSource,
  isValidQualityLabel,
} from '../models/index.js';
import type { StorageAdapter, StorageConfig, QueryOptions, TrainingQueryOptions } from '../storage/index.js';
import { createStorage } from '../storage/index.js';

// ============================================================================
// Main Collector Class
// ============================================================================

/**
 * Main training data collector for StudyLoG.AI
 *
 * Collects learning events with full context, tracks outcomes,
 * and exports training data for AI model fine-tuning.
 *
 * @example
 * ```typescript
 * const collector = new TrainingDataCollector();
 *
 * // Start a learning session
 * const sessionId = await collector.startSession({
 *   studentIds: ['student-123'],
 *   module: 'cognitive_mill',
 *   notes: 'Introduction to Neural Networks'
 * });
 *
 * // Log a learning event
 * const recordId = await collector.logDecision({
 *   studentId: 'student-123',
 *   context: {
 *     learningState: { module: 'cognitive_mill', progress: 0.3, ... },
 *     studentState: { knowledgeLevel: 0.4, engagement: 0.8, ... },
 *   },
 *   decision: {
 *     decisionType: 'problem_solving',
 *     action: 'implement gradient descent',
 *     reasoning: 'Student applied lesson concepts',
 *     confidence: 0.7,
 *     source: 'student'
 *   }
 * });
 *
 * // Update with outcome
 * await collector.updateOutcome({
 *   recordId,
 *   outcome: {
 *     success: true,
 *     immediate: 'Code ran successfully',
 *     qualityScore: 0.8,
 *     metrics: { timeTaken: 45000, attempts: 2 }
 *   }
 * });
 *
 * // Export for training
 * const result = await collector.export({
 *   studentId: 'student-123',
 *   format: 'qlora',
 *   outputPath: './training_data.jsonl'
 * });
 * ```
 */
export class TrainingDataCollector {
  private storage: StorageAdapter;
  private currentSessionId: string | null = null;
  private eventListeners = new Set<EventListener>();
  private initialized = false;

  constructor(config?: StorageConfig) {
    this.storage = new MemoryStorage(); // Placeholder
    // Real storage will be initialized in init()
  }

  /**
   * Initialize the collector
   */
  async init(config?: StorageConfig): Promise<void> {
    if (this.initialized) return;

    this.storage = await createStorage(config);
    this.initialized = true;

    this.emit({ type: 'session_started', sessionId: '<initialized>' });
  }

  // ========================================================================
  // Event System
  // ========================================================================

  /**
   * Add an event listener
   */
  on(listener: EventListener): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove an event listener
   */
  off(listener: EventListener): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: CollectorEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in event listener:', error);
      }
    }
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * Start a new learning session
   */
  async startSession(options: {
    sessionId?: string;
    studentIds: string[];
    notes?: string;
    module?: string;
  }): Promise<string> {
    await this.ensureInitialized();

    const sessionId = options.sessionId || generateSessionId();
    this.currentSessionId = sessionId;

    await this.storage.createSession(
      sessionId,
      options.studentIds,
      options.notes,
      options.module
    );

    this.emit({ type: 'session_started', sessionId });

    return sessionId;
  }

  /**
   * End the current session
   */
  async endSession(): Promise<SessionInfo | null> {
    await this.ensureInitialized();

    if (!this.currentSessionId) {
      return null;
    }

    const session = await this.storage.getSession(this.currentSessionId);

    // Update session with end time
    await this.storage.updateSession(this.currentSessionId, Date.now(), session?.totalDecisions);

    if (session) {
      session.endTimestamp = Date.now();
    }

    this.emit({
      type: 'session_ended',
      sessionId: this.currentSessionId,
      info: session || {
        sessionId: this.currentSessionId,
        startTimestamp: Date.now(),
        endTimestamp: Date.now(),
        studentIds: [],
        totalDecisions: 0,
      },
    });

    this.currentSessionId = null;

    return session;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Set the current session ID
   */
  setCurrentSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  // ========================================================================
  // Student Settings
  // ========================================================================

  /**
   * Get settings for a student
   */
  async getStudentSettings(studentId: string): Promise<StudentDataSettings> {
    await this.ensureInitialized();
    return this.storage.getStudentSettings(studentId);
  }

  /**
   * Update settings for a student
   */
  async updateStudentSettings(settings: StudentDataSettings): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateStudentSettings(settings);
  }

  // ========================================================================
  // Decision Logging
  // ========================================================================

  /**
   * Log a learning decision/event
   */
  async logDecision(options: {
    studentId: string;
    context: LearningContext;
    decision: LearningDecision;
    sessionId?: string;
    trainingEligible?: boolean;
  }): Promise<string | null> {
    await this.ensureInitialized();

    // Check privacy settings
    const settings = await this.storage.getStudentSettings(options.studentId);

    if (!shouldLogDecision(settings, options.decision.source)) {
      return null;
    }

    const recordId = options.decision.metadata?.recordId as string || generateRecordId();
    const sessionId = options.sessionId || this.currentSessionId;

    const record: LearningRecord = {
      recordId,
      studentId: options.studentId,
      sessionId: sessionId || undefined,
      timestamp: options.decision.timestamp || Date.now(),
      context: options.context,
      decision: {
        ...options.decision,
        timestamp: options.decision.timestamp || Date.now(),
      },
      trainingEligible: options.trainingEligible ?? settings.trainingEligible,
    };

    await this.storage.createRecord(record);

    this.emit({
      type: 'record_created',
      recordId,
      studentId: options.studentId,
    });

    return recordId;
  }

  /**
   * Log multiple decisions at once
   */
  async logDecisions(decisions: Array<{
    studentId: string;
    context: LearningContext;
    decision: LearningDecision;
    sessionId?: string;
    trainingEligible?: boolean;
  }>): Promise<string[]> {
    const recordIds: string[] = [];

    for (const decision of decisions) {
      const id = await this.logDecision(decision);
      if (id) recordIds.push(id);
    }

    return recordIds;
  }

  // ========================================================================
  // Outcome Tracking
  // ========================================================================

  /**
   * Update a record with its outcome
   */
  async updateOutcome(options: {
    recordId: string;
    outcome: LearningOutcome;
  }): Promise<void> {
    await this.ensureInitialized();

    const outcome: LearningOutcome = {
      ...options.outcome,
      timestamp: options.outcome.timestamp || Date.now(),
    };

    // Compute quality score if not provided
    if (outcome.qualityScore === undefined && outcome.metrics) {
      outcome.qualityScore = computeQualityScore(outcome.metrics, outcome.success);
    }

    // Set quality label if not provided
    if (outcome.qualityLabel === undefined && outcome.qualityScore !== undefined) {
      outcome.qualityLabel = getQualityLabelFromScore(outcome.qualityScore, outcome.success);
    }

    await this.storage.updateOutcome(options.recordId, outcome);

    this.emit({
      type: 'outcome_updated',
      recordId: options.recordId,
      success: outcome.success,
    });
  }

  /**
   * Update quality label for a record
   */
  async updateQualityLabel(options: {
    recordId: string;
    label: QualityLabel;
    notes?: string;
  }): Promise<void> {
    await this.ensureInitialized();

    await this.storage.updateQualityLabel(
      options.recordId,
      options.label,
      options.notes
    );

    this.emit({
      type: 'quality_labeled',
      recordId: options.recordId,
      label: options.label,
    });
  }

  // ========================================================================
  // Data Retrieval
  // ========================================================================

  /**
   * Get a single record by ID
   */
  async getRecord(recordId: string): Promise<LearningRecord | null> {
    await this.ensureInitialized();
    return this.storage.getRecord(recordId);
  }

  /**
   * Get records for a student
   */
  async getRecords(studentId: string, options?: QueryOptions): Promise<LearningRecord[]> {
    await this.ensureInitialized();
    return this.storage.getRecordsByStudent(studentId, options);
  }

  /**
   * Get records for a session
   */
  async getSessionRecords(sessionId: string): Promise<LearningRecord[]> {
    await this.ensureInitialized();
    return this.storage.getRecordsBySession(sessionId);
  }

  /**
   * Get training-eligible records
   */
  async getTrainingRecords(studentId: string, options?: TrainingQueryOptions): Promise<LearningRecord[]> {
    await this.ensureInitialized();
    return this.storage.getTrainingRecords(studentId, options);
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get statistics about collected data
   */
  async getStatistics(studentId?: string, sessionId?: string): Promise<CollectionStatistics> {
    await this.ensureInitialized();
    return this.storage.getStatistics(studentId, sessionId);
  }

  // ========================================================================
  // Data Management
  // ========================================================================

  /**
   * Delete a specific record
   */
  async deleteRecord(recordId: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.storage.deleteRecord(recordId);
  }

  /**
   * Clean up old records based on retention policy
   */
  async cleanupOldRecords(studentId: string): Promise<number> {
    await this.ensureInitialized();

    const settings = await this.storage.getStudentSettings(studentId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - settings.retentionDays);

    return this.storage.cleanupOldRecords(studentId, cutoffDate);
  }

  // ========================================================================
  // Export
  // ========================================================================

  /**
   * Export training data
   */
  async export(options: {
    studentId: string;
    format: ExportFormat;
    outputPath: string;
    minConfidence?: number;
    minQuality?: QualityLabel;
    includeTeachingMoments?: boolean;
    anonymize?: boolean;
  }): Promise<ExportResult> {
    await this.ensureInitialized();

    const { getExporter } = await import('../exportors/index.js');

    const records = await this.storage.getTrainingRecords(options.studentId, {
      minConfidence: options.minConfidence,
      minQuality: options.minQuality,
      includeTeachingMoments: options.includeTeachingMoments ?? true,
    });

    const exporter = getExporter(options.format);
    const result = await exporter.export(records, options.outputPath, {
      anonymize: options.anonymize,
    });

    this.emit({ type: 'export_completed', result });

    return result;
  }

  /**
   * Export to JSON format
   */
  async exportJSON(studentId: string, outputPath: string): Promise<ExportResult> {
    return this.export({ studentId, format: ExportFormat.JSON, outputPath });
  }

  /**
   * Export to JSONL format
   */
  async exportJSONL(studentId: string, outputPath: string): Promise<ExportResult> {
    return this.export({ studentId, format: ExportFormat.JSONL, outputPath });
  }

  /**
   * Export to QLoRA format
   */
  async exportQLoRA(
    studentId: string,
    outputPath: string,
    options?: {
      minConfidence?: number;
      minQuality?: QualityLabel;
      includeTeachingMoments?: boolean;
    }
  ): Promise<ExportResult> {
    return this.export({
      studentId,
      format: ExportFormat.QLORA,
      outputPath,
      ...options,
    });
  }

  /**
   * Export to CSV format
   */
  async exportCSV(studentId: string, outputPath: string): Promise<ExportResult> {
    return this.export({ studentId, format: ExportFormat.CSV, outputPath });
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Close the collector and release resources
   */
  async close(): Promise<void> {
    if (this.currentSessionId) {
      await this.endSession();
    }

    if (this.initialized) {
      await this.storage.close();
      this.initialized = false;
    }
  }

  /**
   * Ensure the collector is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalCollector: TrainingDataCollector | null = null;

/**
 * Get the global collector instance
 */
export function getCollector(): TrainingDataCollector {
  if (!globalCollector) {
    globalCollector = new TrainingDataCollector();
  }
  return globalCollector;
}

/**
 * Reset the global collector (mainly for testing)
 */
export function resetCollector(): void {
  if (globalCollector) {
    globalCollector.close().catch(console.error);
    globalCollector = null;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Log a learning decision (uses global collector)
 */
export async function logDecision(options: {
  studentId: string;
  context: LearningContext;
  decision: LearningDecision;
  sessionId?: string;
}): Promise<string | null> {
  return getCollector().logDecision(options);
}

/**
 * Update an outcome (uses global collector)
 */
export async function updateOutcome(options: {
  recordId: string;
  outcome: LearningOutcome;
}): Promise<void> {
  return getCollector().updateOutcome(options);
}

/**
 * Get statistics (uses global collector)
 */
export async function getStatistics(studentId?: string): Promise<CollectionStatistics> {
  return getCollector().getStatistics(studentId);
}

// Re-export types and models
export * from '../models/index.js';
export * from '../storage/index.js';
