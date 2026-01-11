/**
 * StudyLoG.AI - Session Management System
 *
 * Adapted from DMLog's session_manager.py pattern.
 * Manages learning sessions with progress tracking, growth metrics,
 * and teaching moment identification.
 *
 * Key Features:
 * - Multi-phase session lifecycle (preparation, learning, practice, assessment, review)
 * - Per-student progress tracking
 * - Domain-specific reward aggregation
 * - Learning opportunity identification
 * - Growth score calculation
 */

import type { Trial } from './outcome-tracker';

/**
 * Phases of a learning session
 */
export enum SessionPhase {
  SETUP = 'setup',
  PREPARATION = 'preparation',
  LEARNING = 'learning',
  PRACTICE = 'practice',
  ASSESSMENT = 'assessment',
  REVIEW = 'review',
  COMPLETE = 'complete',
  ARCHIVED = 'archived',
}

/**
 * Learning domains for reward tracking
 */
export enum LearningDomain {
  SYNTAX = 'syntax',           // Code correctness
  LOGIC = 'logic',            // Algorithm correctness
  STYLE = 'style',            // Code quality/conventions
  COMPREHENSION = 'comprehension',  // Quiz accuracy
  RETENTION = 'retention',    // Long-term memory
  COLLABORATION = 'collaboration',  // Peer interaction
  CREATIVITY = 'creativity',  // Novel solutions
  EFFICIENCY = 'efficiency',  // Performance optimization
}

/**
 * Session metrics for a single student
 */
export interface StudentSessionStats {
  studentId: string;
  attemptsMade: number;
  successCount: number;
  failureCount: number;

  // Reward aggregates by domain
  totalReward: number;
  syntaxReward: number;
  logicReward: number;
  styleReward: number;
  comprehensionReward: number;
  retentionReward: number;
  collaborationReward: number;
  creativityReward: number;
  efficiencyReward: number;

  // Attempt sources
  automatedAttempts: number;
  aiAssistedAttempts: number;
  humanTutoredAttempts: number;

  // Performance metrics
  avgAttemptTimeMs: number;
  avgConfidence: number;

  // Evolution indicators
  growthScore: number;
  learningOpportunities: number;
  conceptsLearned: string[];
  strugglingConcepts: string[];

  // Engagement metrics
  hintsRequested: number;
  hintsUsed: number;
  timeSpentMs: number;
}

/**
 * Overall session metrics
 */
export interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime: number | null;
  phase: SessionPhase;

  // Participation
  studentIds: string[];
  activeStudents: number;

  // Attempt metrics
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;

  // Reward metrics
  totalSessionReward: number;
  avgRewardPerAttempt: number;

  // Quality metrics
  avgAttemptQuality: number;
  teachingMoments: number;

  // Performance
  sessionDurationSeconds: number;
  avgAttemptLatencyMs: number;

  // Student evolution
  studentsImproved: string[];
  avgGrowthScore: number;

  // Session metadata
  topic: string;
  difficulty: number;
  notes: string;
  tags: string[];
}

/**
 * Context for starting a new session
 */
export interface SessionStartContext {
  sessionId?: string;
  studentIds: string[];
  topic: string;
  difficulty: number;
  notes?: string;
  tags?: string[];
}

/**
 * Context for recording an attempt
 */
export interface AttemptContext {
  studentId: string;
  attemptType: string;
  source: 'automated' | 'ai_assisted' | 'human_tutored';
  timeTakenMs: number;
  confidence: number;
}

/**
 * Result of an attempt
 */
export interface AttemptResult {
  success: boolean;
  domainRewards: Record<string, number>;
  qualityScore: number;
  conceptsLearned?: string[];
  strugglingConcepts?: string[];
}

/**
 * Session summary for export
 */
export interface SessionSummary {
  session: SessionMetrics;
  students: Record<string, StudentSessionStats>;
  isActive: boolean;
}

/**
 * Session Manager Class
 *
 * Manages learning sessions with enhanced tracking.
 */
export class SessionManager {
  private activeSessions: Map<string, SessionMetrics>;
  private studentStats: Map<string, Map<string, StudentSessionStats>>;
  private completedSessions: SessionMetrics[];
  private metrics: {
    totalSessions: number;
    totalSessionTime: number;
    avgSessionDuration: number;
    avgAttemptsPerSession: number;
    avgSessionReward: number;
    sessionsWithLearning: number;
  };

  constructor() {
    this.activeSessions = new Map();
    this.studentStats = new Map();
    this.completedSessions = [];
    this.metrics = {
      totalSessions: 0,
      totalSessionTime: 0,
      avgSessionDuration: 0,
      avgAttemptsPerSession: 0,
      avgSessionReward: 0,
      sessionsWithLearning: 0,
    };
  }

  /**
   * Start a new learning session
   */
  startSession(context: SessionStartContext): string {
    const sessionId =
      context.sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const session: SessionMetrics = {
      sessionId,
      startTime: Date.now(),
      endTime: null,
      phase: SessionPhase.SETUP,
      studentIds: context.studentIds,
      activeStudents: context.studentIds.length,
      totalAttempts: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalSessionReward: 0,
      avgRewardPerAttempt: 0,
      avgAttemptQuality: 0,
      teachingMoments: 0,
      sessionDurationSeconds: 0,
      avgAttemptLatencyMs: 0,
      studentsImproved: [],
      avgGrowthScore: 0,
      topic: context.topic,
      difficulty: context.difficulty,
      notes: context.notes || '',
      tags: context.tags || [],
    };

    this.activeSessions.set(sessionId, session);
    this.studentStats.set(sessionId, new Map());

    // Initialize student stats
    for (const studentId of context.studentIds) {
      this.studentStats.get(sessionId)!.set(studentId, this.createEmptyStats(studentId));
    }

    return sessionId;
  }

  /**
   * Add a student to an active session
   */
  addStudentToSession(sessionId: string, studentId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    if (!session.studentIds.includes(studentId)) {
      session.studentIds.push(studentId);
      session.activeStudents += 1;

      const sessionStats = this.studentStats.get(sessionId);
      if (sessionStats && !sessionStats.has(studentId)) {
        sessionStats.set(studentId, this.createEmptyStats(studentId));
      }
    }
  }

  /**
   * Set the current phase of a session
   */
  setSessionPhase(sessionId: string, phase: SessionPhase): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    session.phase = phase;
  }

  /**
   * Record an attempt in the session
   */
  recordAttempt(
    sessionId: string,
    studentId: string,
    attemptContext: AttemptContext,
    attemptResult: AttemptResult
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return;
    }

    // Get or create student stats
    let sessionStats = this.studentStats.get(sessionId);
    if (!sessionStats) {
      this.studentStats.set(sessionId, new Map());
      sessionStats = this.studentStats.get(sessionId)!;
    }

    let studentStats = sessionStats.get(studentId);
    if (!studentStats) {
      studentStats = this.createEmptyStats(studentId);
      sessionStats.set(studentId, studentStats);

      if (!session.studentIds.includes(studentId)) {
        session.studentIds.push(studentId);
        session.activeStudents += 1;
      }
    }

    // Update attempt counts
    studentStats.attemptsMade += 1;
    session.totalAttempts += 1;

    // Track attempt source
    if (attemptContext.source === 'automated') {
      studentStats.automatedAttempts += 1;
    } else if (attemptContext.source === 'ai_assisted') {
      studentStats.aiAssistedAttempts += 1;
    } else {
      studentStats.humanTutoredAttempts += 1;
    }

    // Track attempt time
    if (studentStats.attemptsMade === 1) {
      studentStats.avgAttemptTimeMs = attemptContext.timeTakenMs;
    } else {
      studentStats.avgAttemptTimeMs =
        (studentStats.avgAttemptTimeMs * (studentStats.attemptsMade - 1) +
          attemptContext.timeTakenMs) /
        studentStats.attemptsMade;
    }

    // Track confidence
    if (studentStats.attemptsMade === 1) {
      studentStats.avgConfidence = attemptContext.confidence;
    } else {
      studentStats.avgConfidence =
        (studentStats.avgConfidence * (studentStats.attemptsMade - 1) +
          attemptContext.confidence) /
        studentStats.attemptsMade;
    }

    // Update session latency
    if (session.totalAttempts === 1) {
      session.avgAttemptLatencyMs = attemptContext.timeTakenMs;
    } else {
      session.avgAttemptLatencyMs =
        (session.avgAttemptLatencyMs * (session.totalAttempts - 1) +
          attemptContext.timeTakenMs) /
        session.totalAttempts;
    }

    // Process outcome
    this.processOutcome(sessionId, studentId, attemptResult);
  }

  /**
   * Process the outcome of an attempt
   */
  private processOutcome(
    sessionId: string,
    studentId: string,
    result: AttemptResult
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const studentStats = this.studentStats
      .get(sessionId)
      ?.get(studentId);
    if (!studentStats) return;

    // Track success/failure
    if (result.success) {
      studentStats.successCount += 1;
      session.totalSuccesses += 1;
    } else {
      studentStats.failureCount += 1;
      session.totalFailures += 1;
    }

    // Aggregate domain rewards
    for (const [domain, value] of Object.entries(result.domainRewards)) {
      switch (domain) {
        case 'syntax':
          studentStats.syntaxReward += value;
          break;
        case 'logic':
          studentStats.logicReward += value;
          break;
        case 'style':
          studentStats.styleReward += value;
          break;
        case 'comprehension':
          studentStats.comprehensionReward += value;
          break;
        case 'retention':
          studentStats.retentionReward += value;
          break;
        case 'collaboration':
          studentStats.collaborationReward += value;
          break;
        case 'creativity':
          studentStats.creativityReward += value;
          break;
        case 'efficiency':
          studentStats.efficiencyReward += value;
          break;
      }
      studentStats.totalReward += value;
    }

    // Update session totals
    session.totalSessionReward += studentStats.totalReward;
    session.avgRewardPerAttempt =
      session.totalSessionReward / session.totalAttempts;

    // Track quality
    const qualityScore = result.qualityScore;
    if (session.totalAttempts === 1) {
      session.avgAttemptQuality = qualityScore;
    } else {
      session.avgAttemptQuality =
        (session.avgAttemptQuality * (session.totalAttempts - 1) +
          qualityScore) /
        session.totalAttempts;
    }

    // Track teaching moments (low quality or failure with learning potential)
    if (qualityScore < 0 || (!result.success && qualityScore < 0.3)) {
      studentStats.learningOpportunities += 1;
      session.teachingMoments += 1;
    }

    // Track concepts
    if (result.conceptsLearned) {
      studentStats.conceptsLearned.push(...result.conceptsLearned);
    }
    if (result.strugglingConcepts) {
      studentStats.strugglingConcepts.push(...result.strugglingConcepts);
    }
  }

  /**
   * End a session and calculate final metrics
   */
  endSession(sessionId: string): SessionMetrics | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      console.warn(`Session not found: ${sessionId}`);
      return null;
    }

    const now = Date.now();
    session.endTime = now;
    session.phase = SessionPhase.COMPLETE;
    session.sessionDurationSeconds = (now - session.startTime) / 1000;

    // Calculate character growth scores
    this.calculateGrowthScores(sessionId);

    // Identify students that improved
    const sessionStats = this.studentStats.get(sessionId);
    if (sessionStats) {
      session.studentsImproved = [];
      let totalGrowth = 0;

      for (const [studentId, stats] of sessionStats.entries()) {
        if (stats.growthScore > 0.5) {
          session.studentsImproved.push(studentId);
        }
        totalGrowth += stats.growthScore;
      }

      session.avgGrowthScore =
        sessionStats.size > 0 ? totalGrowth / sessionStats.size : 0;
    }

    // Move to completed
    this.completedSessions.push(session);
    this.activeSessions.delete(sessionId);

    // Update metrics
    this.metrics.totalSessions += 1;
    this.metrics.totalSessionTime += session.sessionDurationSeconds;
    this.metrics.avgSessionDuration =
      this.metrics.totalSessionTime / this.metrics.totalSessions;
    this.metrics.avgAttemptsPerSession =
      (this.metrics.avgAttemptsPerSession * (this.metrics.totalSessions - 1) +
        session.totalAttempts) /
      this.metrics.totalSessions;
    this.metrics.avgSessionReward =
      (this.metrics.avgSessionReward * (this.metrics.totalSessions - 1) +
        session.totalSessionReward) /
      this.metrics.totalSessions;
    if (session.teachingMoments > 0) {
      this.metrics.sessionsWithLearning += 1;
    }

    return session;
  }

  /**
   * Calculate growth score for each student in session
   */
  private calculateGrowthScores(sessionId: string): void {
    const sessionStats = this.studentStats.get(sessionId);
    if (!sessionStats) return;

    for (const stats of sessionStats.values()) {
      // Growth based on:
      // 1. Success rate improvement
      // 2. Positive reward accumulation
      // 3. Learning opportunities addressed

      const successRate =
        stats.attemptsMade > 0 ? stats.successCount / stats.attemptsMade : 0;

      // Baseline is 0.5 (50% success)
      const successFactor = (successRate - 0.5) * 2; // -1 to 1

      // Reward factor (normalized)
      const rewardFactor =
        stats.attemptsMade > 0
          ? Math.min(1.0, stats.totalReward / stats.attemptsMade)
          : 0;

      // Learning factor (having opportunities is good for growth)
      const learningFactor =
        stats.attemptsMade > 0
          ? Math.min(
              1.0,
              stats.learningOpportunities / (stats.attemptsMade * 0.3)
            )
          : 0;

      // Weighted combination
      let growthScore =
        successFactor * 0.4 + rewardFactor * 0.4 + learningFactor * 0.2;

      // Clamp to [0, 1] and shift to positive
      stats.growthScore = Math.max(0, Math.min(1, (growthScore + 1) / 2));
    }
  }

  /**
   * Get comprehensive summary of a session
   */
  getSessionSummary(sessionId: string): SessionSummary | null {
    // Check active sessions first
    let session = this.activeSessions.get(sessionId);

    // Check completed sessions
    if (!session) {
      session = this.completedSessions.find((s) => s.sessionId === sessionId);
    }

    if (!session) {
      return null;
    }

    // Get student stats
    const studentSummaries: Record<string, StudentSessionStats> = {};
    const sessionStats = this.studentStats.get(sessionId);
    if (sessionStats) {
      for (const [studentId, stats] of sessionStats.entries()) {
        studentSummaries[studentId] = { ...stats };
      }
    }

    return {
      session: { ...session },
      students: studentSummaries,
      isActive: this.activeSessions.has(sessionId),
    };
  }

  /**
   * Get session history for a student
   */
  getStudentSessionHistory(studentId: string, limit?: number): SessionMetrics[] {
    const history: SessionMetrics[] = [];

    for (const session of this.completedSessions) {
      if (session.studentIds.includes(studentId)) {
        history.push(session);
      }
    }

    // Sort by start time (newest first)
    history.sort((a, b) => b.startTime - a.startTime);

    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get global statistics
   */
  getStatistics() {
    return {
      ...this.metrics,
      activeSessions: this.activeSessions.size,
      completedSessions: this.completedSessions.length,
      sessionsWithLearningPct:
        this.metrics.totalSessions > 0
          ? this.metrics.sessionsWithLearning / this.metrics.totalSessions
          : 0,
    };
  }

  /**
   * Identify sessions with good learning opportunities
   */
  identifyLearningOpportunities(
    minQuality = 0.5,
    minAttempts = 10
  ): Array<{
    sessionId: string;
    avgQuality: number;
    totalAttempts: number;
    teachingMoments: number;
    studentsImproved: string[];
    avgGrowth: number;
    totalReward: number;
  }> {
    const opportunities: Array<{
      sessionId: string;
      avgQuality: number;
      totalAttempts: number;
      teachingMoments: number;
      studentsImproved: string[];
      avgGrowth: number;
      totalReward: number;
    }> = [];

    for (const session of this.completedSessions) {
      if (
        session.avgAttemptQuality >= minQuality &&
        session.totalAttempts >= minAttempts &&
        session.teachingMoments > 0
      ) {
        opportunities.push({
          sessionId: session.sessionId,
          avgQuality: session.avgAttemptQuality,
          totalAttempts: session.totalAttempts,
          teachingMoments: session.teachingMoments,
          studentsImproved: session.studentsImproved,
          avgGrowth: session.avgGrowthScore,
          totalReward: session.totalSessionReward,
        });
      }
    }

    // Sort by quality and teaching moments
    opportunities.sort(
      (a, b) =>
        b.avgQuality - a.avgQuality || b.teachingMoments - a.teachingMoments
    );

    return opportunities;
  }

  /**
   * Create empty student stats
   */
  private createEmptyStats(studentId: string): StudentSessionStats {
    return {
      studentId,
      attemptsMade: 0,
      successCount: 0,
      failureCount: 0,
      totalReward: 0,
      syntaxReward: 0,
      logicReward: 0,
      styleReward: 0,
      comprehensionReward: 0,
      retentionReward: 0,
      collaborationReward: 0,
      creativityReward: 0,
      efficiencyReward: 0,
      automatedAttempts: 0,
      aiAssistedAttempts: 0,
      humanTutoredAttempts: 0,
      avgAttemptTimeMs: 0,
      avgConfidence: 0,
      growthScore: 0,
      learningOpportunities: 0,
      conceptsLearned: [],
      strugglingConcepts: [],
      hintsRequested: 0,
      hintsUsed: 0,
      timeSpentMs: 0,
    };
  }

  /**
   * Get current session state (for persistence)
   */
  getState(): {
    activeSessions: Record<string, SessionMetrics>;
    studentStats: Record<string, Record<string, StudentSessionStats>>;
    completedSessions: SessionMetrics[];
    metrics: typeof this.metrics;
  } {
    const activeSessionsObj: Record<string, SessionMetrics> = {};
    for (const [id, session] of this.activeSessions.entries()) {
      activeSessionsObj[id] = session;
    }

    const studentStatsObj: Record<string, Record<string, StudentSessionStats>> = {};
    for (const [sessionId, statsMap] of this.studentStats.entries()) {
      studentStatsObj[sessionId] = {};
      for (const [studentId, stats] of statsMap.entries()) {
        studentStatsObj[sessionId][studentId] = stats;
      }
    }

    return {
      activeSessions: activeSessionsObj,
      studentStats: studentStatsObj,
      completedSessions: this.completedSessions,
      metrics: this.metrics,
    };
  }

  /**
   * Restore session state (from persistence)
   */
  restoreState(state: {
    activeSessions: Record<string, SessionMetrics>;
    studentStats: Record<string, Record<string, StudentSessionStats>>;
    completedSessions: SessionMetrics[];
    metrics: typeof this.metrics;
  }): void {
    this.activeSessions = new Map(
      Object.entries(state.activeSessions)
    );
    this.studentStats = new Map();
    for (const [sessionId, statsObj] of Object.entries(state.studentStats)) {
      this.studentStats.set(sessionId, new Map(Object.entries(statsObj)));
    }
    this.completedSessions = state.completedSessions;
    this.metrics = state.metrics;
  }
}

/**
 * Singleton instance for global use
 */
let globalSessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager();
  }
  return globalSessionManager;
}

export function resetSessionManager(): void {
  globalSessionManager = null;
}
