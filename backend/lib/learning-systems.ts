/**
 * StudyLoG.AI - Learning Systems
 *
 * Integrated learning management system adapted from DMLog patterns.
 *
 * This module provides:
 * - SessionManager: Track learning sessions with growth metrics
 * - OutcomeTracker: Calculate reward signals across learning domains
 * - MemoryConsolidationEngine: Hierarchical memory with consolidation
 *
 * @module learning-systems
 */

// ========================================================================
// SESSION MANAGER
// ========================================================================

export {
  SessionManager,
  getSessionManager,
  resetSessionManager,
} from './session-manager';

export type {
  StudentSessionStats,
  SessionMetrics,
  SessionStartContext,
  AttemptContext,
  AttemptResult,
  SessionSummary,
} from './session-manager';

export { SessionPhase, LearningDomain } from './session-manager';

// ========================================================================
// OUTCOME TRACKER
// ========================================================================

export {
  OutcomeTracker,
  getOutcomeTracker,
  resetOutcomeTracker,
} from './outcome-tracker';

export type {
  RewardSignal,
  OutcomeRecord,
  RewardContext,
  QualityAnalysis,
  Trial,
} from './outcome-tracker';

export { OutcomeType, LearningDomain as OutcomeLearningDomain } from './outcome-tracker';

// ========================================================================
// MEMORY CONSOLIDATION ENGINE
// ========================================================================

export {
  MemoryConsolidationEngine,
  getMemoryEngine,
  resetMemoryEngine,
} from './memory-system';

export type {
  Memory,
  SemanticMemory,
  ProceduralMemory,
  ConsolidationResult,
  LearningProfile,
  NarrativeChapter,
} from './memory-system';

export { MemoryType, MemoryImportance, TemporalLandmarkType } from './memory-system';

// ========================================================================
// INTEGRATED SYSTEM
// ========================================================================

/**
 * Integrated Learning System
 *
 * Combines session management, outcome tracking, and memory consolidation
 * into a unified learning analytics system.
 */
export class IntegratedLearningSystem {
  public readonly sessionManager: SessionManager;
  public readonly outcomeTracker: OutcomeTracker;
  public readonly memoryEngine: MemoryConsolidationEngine;

  constructor() {
    this.sessionManager = new SessionManager();
    this.outcomeTracker = new OutcomeTracker();
    this.memoryEngine = new MemoryConsolidationEngine();
  }

  /**
   * Start a new learning session
   */
  startSession(context: {
    studentId: string;
    topic: string;
    difficulty: number;
    notes?: string;
    tags?: string[];
  }): string {
    return this.sessionManager.startSession({
      studentIds: [context.studentId],
      topic: context.topic,
      difficulty: context.difficulty,
      notes: context.notes,
      tags: context.tags,
    });
  }

  /**
   * Record a learning attempt with full tracking
   */
  recordAttempt(
    sessionId: string,
    studentId: string,
    attempt: {
      type: string;
      description: string;
      success: boolean;
      timeTakenMs: number;
      confidence: number;
      source: 'automated' | 'ai_assisted' | 'human_tutored';
      hintsUsed?: number;
      domainRewards?: Record<string, number>;
      conceptsLearned?: string[];
      strugglingConcepts?: string[];
    }
  ): {
    outcomeId: string;
    qualityScore: number;
    aggregateReward: number;
  } {
    // Track outcome
    const outcome = this.outcomeTracker.trackImmediateOutcome(
      `${sessionId}_${studentId}_${Date.now()}`,
      attempt.description,
      attempt.success,
      {
        attemptType: attempt.type,
        timeSpentMs: attempt.timeTakenMs,
        hintsUsed: attempt.hintsUsed,
      }
    );

    // Record in session
    this.sessionManager.recordAttempt(
      sessionId,
      studentId,
      {
        studentId,
        attemptType: attempt.type,
        source: attempt.source,
        timeTakenMs: attempt.timeTakenMs,
        confidence: attempt.confidence,
      },
      {
        success: attempt.success,
        domainRewards: attempt.domainRewards || {},
        qualityScore: 0, // Will be calculated
        conceptsLearned: attempt.conceptsLearned,
        strugglingConcepts: attempt.strugglingConcepts,
      }
    );

    // Store memory
    this.memoryEngine.storeMemory(
      studentId,
      attempt.description,
      outcome.success ? MemoryType.EPISODIC : MemoryType.SHORT_TERM,
      {
        topic: this.sessionManager.getSessionSummary(sessionId)?.session.topic,
        importance: attempt.success ? MemoryImportance.NORMAL : MemoryImportance.LOW,
        emotionalValence: attempt.success ? 0.5 : -0.3,
        source: attempt.type,
      }
    );

    // Get quality analysis
    const quality = this.outcomeTracker.analyzeAttemptQuality(outcome.attemptId);

    return {
      outcomeId: outcome.attemptId,
      qualityScore: quality.qualityScore,
      aggregateReward: this.outcomeTracker.getAggregateReward(outcome.attemptId),
    };
  }

  /**
   * End a learning session and consolidate
   */
  endSession(sessionId: string): {
    sessionMetrics: ReturnType<SessionManager['endSession']>;
    consolidationResult: ReturnType<MemoryConsolidationEngine['consolidateMemories']>;
    narrative: ReturnType<MemoryConsolidationEngine['generateAutobiographicalNarrative']>;
  } {
    // End session
    const sessionMetrics = this.sessionManager.endSession(sessionId);
    if (!sessionMetrics) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Consolidate memories for all students
    const consolidationResults: Record<string, ReturnType<MemoryConsolidationEngine['consolidateMemories']>> = {};

    for (const studentId of sessionMetrics.studentIds) {
      if (this.memoryEngine.needsConsolidation(studentId)) {
        consolidationResults[studentId] = this.memoryEngine.consolidateMemories(studentId);
      }
    }

    // Generate narratives
    const narratives: Record<string, ReturnType<MemoryConsolidationEngine['generateAutobiographicalNarrative']>> = {};

    for (const studentId of sessionMetrics.studentIds) {
      narratives[studentId] = this.memoryEngine.generateAutobiographicalNarrative(studentId);
    }

    return {
      sessionMetrics,
      consolidationResult: consolidationResults[sessionMetrics.studentIds[0]] || {} as any,
      narrative: narratives[sessionMetrics.studentIds[0]] || {} as any,
    };
  }

  /**
   * Get comprehensive learning insights for a student
   */
  getStudentInsights(studentId: string): {
    sessionHistory: ReturnType<SessionManager['getStudentSessionHistory']>;
    memoryStats: ReturnType<MemoryConsolidationEngine['getStudentStats']>;
    learningInsights: ReturnType<MemoryConsolidationEngine['getLearningInsights']>;
    narrative: ReturnType<MemoryConsolidationEngine['generateAutobiographicalNarrative']>;
    outcomeStats: ReturnType<OutcomeTracker['getStatistics']>;
  } {
    return {
      sessionHistory: this.sessionManager.getStudentSessionHistory(studentId, 10),
      memoryStats: this.memoryEngine.getStudentStats(studentId),
      learningInsights: this.memoryEngine.getLearningInsights(studentId),
      narrative: this.memoryEngine.generateAutobiographicalNarrative(studentId),
      outcomeStats: this.outcomeTracker.getStatistics(),
    };
  }

  /**
   * Get state for persistence
   */
  getState(): {
    sessionManager: ReturnType<SessionManager['getState']>;
    outcomeTracker: ReturnType<OutcomeTracker['getState']>;
    memoryEngine: ReturnType<MemoryConsolidationEngine['getState']>;
  } {
    return {
      sessionManager: this.sessionManager.getState(),
      outcomeTracker: this.outcomeTracker.getState(),
      memoryEngine: this.memoryEngine.getState(),
    };
  }

  /**
   * Restore state from persistence
   */
  restoreState(state: {
    sessionManager: ReturnType<SessionManager['getState']>;
    outcomeTracker: ReturnType<OutcomeTracker['getState']>;
    memoryEngine: ReturnType<MemoryConsolidationEngine['getState']>;
  }): void {
    this.sessionManager.restoreState(state.sessionManager);
    this.outcomeTracker.restoreState(state.outcomeTracker);
    this.memoryEngine.restoreState(state.memoryEngine);
  }
}

/**
 * Singleton instance for global use
 */
let globalLearningSystem: IntegratedLearningSystem | null = null;

export function getLearningSystem(): IntegratedLearningSystem {
  if (!globalLearningSystem) {
    globalLearningSystem = new IntegratedLearningSystem();
  }
  return globalLearningSystem;
}

export function resetLearningSystem(): void {
  globalLearningSystem = null;
}

// Re-export MemoryType for use in integrated system
import { MemoryType, MemoryImportance } from './memory-system';
export { MemoryType, MemoryImportance };
