/**
 * Feedback Loop Module
 *
 * Handles environment results to agent conversation feedback.
 * Closes the loop between actions taken and outcomes observed.
 */

import type {
  BeingStateEnv,
  EnvironmentFeedback,
  FeedbackData,
  ConversationUpdate,
  ConversationMessage,
  Surprise,
  AgentState,
  RAGContext,
  GameEvent,
} from './types';

// ============================================================================
// Feedback Processing
// ============================================================================

/**
 * Learning signal from feedback
 */
interface LearningSignal {
  positive: number; // 0-1
  negative: number; // 0-1
  surprise: number; // 0-1
  patterns: string[];
}

// ============================================================================
// Feedback Loop Manager Class
// ============================================================================

export class FeedbackLoopManager {
  private env: BeingStateEnv;
  private feedbackBuffer: Map<string, EnvironmentFeedback[]> = new Map();
  private learningSignals: Map<string, LearningSignal[]> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Feedback Collection
  // ========================================================================

  /**
   * Create feedback from environment result
   */
  async createFeedback(
    sessionId: string,
    actionId: string,
    outcome: 'success' | 'failure' | 'partial',
    metrics: Record<string, number>,
    observations: string[],
    surprises?: Surprise[]
  ): Promise<EnvironmentFeedback> {
    // Calculate learning signal
    const learningSignal = this.calculateLearningSignal(
      outcome,
      metrics,
      surprises
    );

    const feedback: EnvironmentFeedback = {
      sessionId,
      agentId: undefined, // Will be set when linked to agent
      actionId,
      feedback: {
        outcome,
        metrics,
        observations,
        surprises,
        learningSignal: learningSignal.positive - learningSignal.negative,
      },
      timestamp: Date.now(),
    };

    // Buffer the feedback
    this.bufferFeedback(feedback);

    // Store learning signals
    if (feedback.agentId) {
      const signals = this.learningSignals.get(feedback.agentId) ?? [];
      signals.push(learningSignal);
      this.learningSignals.set(feedback.agentId, signals);
    }

    return feedback;
  }

  /**
   * Calculate learning signal from outcome
   */
  private calculateLearningSignal(
    outcome: 'success' | 'failure' | 'partial',
    metrics: Record<string, number>,
    surprises?: Surprise[]
  ): LearningSignal {
    let positive = 0;
    let negative = 0;
    let surprise = 0;
    const patterns: string[] = [];

    // Base signal from outcome
    switch (outcome) {
      case 'success':
        positive = 0.8;
        break;
      case 'failure':
        negative = 0.7;
        break;
      case 'partial':
        positive = 0.3;
        negative = 0.3;
        break;
    }

    // Adjust based on metrics
    if (metrics.damage_dealt) {
      positive += Math.min(0.2, metrics.damage_dealt / 100);
    }
    if (metrics.damage_taken) {
      negative += Math.min(0.2, metrics.damage_taken / 100);
    }
    if (metrics.resources_gained) {
      positive += Math.min(0.15, metrics.resources_gained / 50);
    }
    if (metrics.time_used) {
      // Faster is generally better
      positive += Math.min(0.1, (60 - metrics.time_used) / 120);
    }

    // Process surprises
    if (surprises) {
      for (const s of surprises) {
        surprise += s.severity * 0.3;
        patterns.push(`surprise_${s.type}`);

        if (s.impact.includes('positive')) {
          positive += s.severity * 0.2;
        } else if (s.impact.includes('negative')) {
          negative += s.severity * 0.3;
        }
      }
    }

    // Clamp values
    positive = Math.min(1, positive);
    negative = Math.min(1, negative);
    surprise = Math.min(1, surprise);

    return { positive, negative, surprise, patterns };
  }

  /**
   * Buffer feedback for batch processing
   */
  private bufferFeedback(feedback: EnvironmentFeedback): void {
    const buffer = this.feedbackBuffer.get(feedback.sessionId) ?? [];
    buffer.push(feedback);

    // Keep last 100 feedbacks
    if (buffer.length > 100) {
      buffer.splice(0, buffer.length - 100);
    }

    this.feedbackBuffer.set(feedback.sessionId, buffer);
  }

  // ========================================================================
  // Conversation Updates
  // ========================================================================

  /**
   * Generate conversation update from feedback
   */
  async generateConversationUpdate(
    agentId: string,
    feedback: EnvironmentFeedback,
    currentState: AgentState
  ): Promise<ConversationUpdate> {
    // Generate message based on feedback
    const message = await this.generateFeedbackMessage(
      agentId,
      feedback,
      currentState
    );

    // Build context update
    const contextUpdate = this.buildContextUpdate(feedback);

    const update: ConversationUpdate = {
      agentId,
      conversationId: this.getConversationId(agentId, feedback.sessionId),
      message,
      contextUpdate,
    };

    return update;
  }

  /**
   * Generate feedback message for agent conversation
   */
  private async generateFeedbackMessage(
    agentId: string,
    feedback: EnvironmentFeedback,
    currentState: AgentState
  ): Promise<ConversationMessage> {
    const { outcome, metrics, observations, surprises } = feedback.feedback;

    // Build message content
    let content = '';

    // Outcome statement
    if (outcome === 'success') {
      content += 'Action completed successfully. ';
    } else if (outcome === 'failure') {
      content += 'Action failed. ';
    } else {
      content += 'Action partially completed. ';
    }

    // Add metrics summary
    if (Object.keys(metrics).length > 0) {
      content += 'Results: ';
      const metricStrings = Object.entries(metrics).map(([k, v]) => `${k}=${v}`);
      content += metricStrings.join(', ') + '. ';
    }

    // Add observations
    if (observations.length > 0) {
      content += 'Observations: ' + observations.join('; ') + '. ';
    }

    // Add surprises
    if (surprises && surprises.length > 0) {
      content += 'Unexpected: ' + surprises.map((s) => s.description).join('; ') + '. ';
    }

    // Add reflection based on state
    if (currentState === 'learning') {
      content += ' I should learn from this outcome.';
    } else if (currentState === 'teaching') {
      content += ' Note this for future reference.';
    } else if (currentState === 'transcendent') {
      content += ' This aligns with the optimal pattern I observed.';
    }

    return {
      role: 'system',
      content,
      timestamp: Date.now(),
    };
  }

  /**
   * Build context update from feedback
   */
  private buildContextUpdate(feedback: EnvironmentFeedback): Record<string, unknown> {
    const { outcome, metrics, learningSignal } = feedback.feedback;

    return {
      last_outcome: outcome,
      last_metrics: metrics,
      learning_value: learningSignal,
      timestamp: feedback.timestamp,
    };
  }

  /**
   * Get conversation ID for agent and session
   */
  private getConversationId(agentId: string, sessionId: string): string {
    return `${sessionId}:${agentId}`;
  }

  // ========================================================================
  // Learning Signal Processing
  // ========================================================================

  /**
   * Get learning signals for agent
   */
  getLearningSignals(agentId: string, limit: number = 50): LearningSignal[] {
    const signals = this.learningSignals.get(agentId) ?? [];
    return signals.slice(-limit);
  }

  /**
   * Calculate agent learning progress
   */
  calculateLearningProgress(agentId: string): {
    totalSignals: number;
    positiveRatio: number;
    averageSurprise: number;
    topPatterns: string[];
  } {
    const signals = this.getLearningSignals(agentId);

    if (signals.length === 0) {
      return {
        totalSignals: 0,
        positiveRatio: 0,
        averageSurprise: 0,
        topPatterns: [],
      };
    }

    let totalPositive = 0;
    let totalNegative = 0;
    let totalSurprise = 0;
    const patternCounts: Record<string, number> = {};

    for (const signal of signals) {
      totalPositive += signal.positive;
      totalNegative += signal.negative;
      totalSurprise += signal.surprise;

      for (const pattern of signal.patterns) {
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
      }
    }

    // Sort patterns by frequency
    const topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);

    return {
      totalSignals: signals.length,
      positiveRatio: totalPositive / (totalPositive + totalNegative),
      averageSurprise: totalSurprise / signals.length,
      topPatterns,
    };
  }

  /**
   * Detect learning plateau
   */
  detectLearningPlateau(agentId: string, window: number = 20): boolean {
    const signals = this.getLearningSignals(agentId, window * 2);

    if (signals.length < window) {
      return false;
    }

    // Compare recent signals to older signals
    const recent = signals.slice(-window);
    const older = signals.slice(-window * 2, -window);

    const recentPositive = recent.reduce((sum, s) => sum + s.positive - s.negative, 0);
    const olderPositive = older.reduce((sum, s) => sum + s.positive - s.negative, 0);

    // Plateau detected if no improvement
    return recentPositive <= olderPositive * 1.1;
  }

  // ========================================================================
  // Adaptive State Transitions
  // ========================================================================

  /**
   * Suggest agent state change based on learning
   */
  suggestStateTransition(
    agentId: string,
    currentState: AgentState
  ): AgentState | null {
    const progress = this.calculateLearningProgress(agentId);
    const plateau = this.detectLearningPlateau(agentId);

    // Learning agent becomes transcendent after enough positive signals
    if (currentState === 'learning' && progress.totalSignals > 100) {
      if (progress.positiveRatio > 0.7) {
        return 'transcendent';
      }
    }

    // Dormant agent awakens with positive signals
    if (currentState === 'dormant' && progress.totalSignals > 10) {
      if (progress.positiveRatio > 0.6) {
        return 'directed';
      }
    }

    // Suggest change if plateau detected
    if (plateau) {
      const transitions: Record<AgentState, AgentState> = {
        autonomous: 'learning',
        directed: 'autonomous',
        emergent: 'learning',
        dormant: 'directed',
        rogue: 'symbiotic',
        symbiotic: 'autonomous',
        learning: 'teaching',
        teaching: 'transcendent',
        mimicking: 'learning',
        transcendent: 'teaching',
      };

      return transitions[currentState] ?? null;
    }

    return null;
  }

  // ========================================================================
  // Surprise Detection
  // ========================================================================

  /**
   * Detect surprising events from game state changes
   */
  detectSurprises(
    previousState: RAGContext,
    currentState: RAGContext
  ): Surprise[] {
    const surprises: Surprise[] = [];

    // Check for sudden unit appearance
    const prevUnits = previousState.gameState.units.length;
    const currUnits = currentState.gameState.units.length;
    if (Math.abs(currUnits - prevUnits) > 5) {
      surprises.push({
        type: 'unit_surge',
        description: `Sudden ${currUnits > prevUnits ? 'increase' : 'decrease'} in unit count`,
        severity: Math.min(1, Math.abs(currUnits - prevUnits) / 10),
        impact: currUnits > prevUnits ? 'threat_increase' : 'ally_loss',
      });
    }

    // Check for resource anomalies
    const prevResources = Object.values(previousState.playerState.resources).reduce((a, b) => a + b, 0);
    const currResources = Object.values(currentState.playerState.resources).reduce((a, b) => a + b, 0);
    const resourceChange = Math.abs(currResources - prevResources);
    if (resourceChange > 100) {
      surprises.push({
        type: 'resource_anomaly',
        description: `Unusual resource change: ${resourceChange > 0 ? '+' : ''}${resourceChange}`,
        severity: Math.min(1, resourceChange / 200),
        impact: resourceChange > 0 ? 'positive' : 'negative',
      });
    }

    // Check for new threats
    const prevThreats = previousState.strategy?.threats.length ?? 0;
    const currThreats = currentState.strategy?.threats.length ?? 0;
    if (currThreats > prevThreats + 2) {
      surprises.push({
        type: 'threat_emergence',
        description: `New threats detected: ${currThreats - prevThreats} new hostiles`,
        severity: Math.min(1, (currThreats - prevThreats) / 5),
        impact: 'negative',
      });
    }

    // Check for objective completion
    const prevCompleted = previousState.playerState.completedObjectives.length;
    const currCompleted = currentState.playerState.completedObjectives.length;
    if (currCompleted > prevCompleted) {
      surprises.push({
        type: 'objective_complete',
        description: `Objective completed: ${currCompleted - prevCompleted} objectives`,
        severity: 0.3,
        impact: 'positive',
      });
    }

    return surprises;
  }

  // ========================================================================
  // Event Creation from Feedback
  // ========================================================================

  /**
   * Create game event from feedback
   */
  createGameEvent(feedback: EnvironmentFeedback): GameEvent {
    return {
      id: crypto.randomUUID(),
      type: feedback.feedback.outcome === 'success' ? 'action_success' : 'action_failure',
      timestamp: feedback.timestamp,
      source: feedback.agentId,
      data: {
        actionId: feedback.actionId,
        outcome: feedback.feedback.outcome,
        metrics: feedback.feedback.metrics,
        observations: feedback.feedback.observations,
      },
    };
  }

  // ========================================================================
  // Persistence
  // ========================================================================

  /**
   * Persist feedback to database
   */
  async persistFeedback(feedback: EnvironmentFeedback): Promise<void> {
    if (!this.env.BEING_STATE_DB) {
      return;
    }

    await this.env.BEING_STATE_DB.prepare(`
      INSERT INTO feedback_events (
        id, session_id, agent_id, action_id, outcome,
        metrics, observations, surprises, learning_signal, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      feedback.sessionId,
      feedback.agentId ?? null,
      feedback.actionId,
      feedback.feedback.outcome,
      JSON.stringify(feedback.feedback.metrics),
      JSON.stringify(feedback.feedback.observations),
      JSON.stringify(feedback.feedback.surprises ?? []),
      feedback.feedback.learningSignal,
      feedback.timestamp
    ).run();
  }

  /**
   * Load recent feedback for session
   */
  async loadFeedback(sessionId: string, limit: number = 50): Promise<EnvironmentFeedback[]> {
    if (!this.env.BEING_STATE_DB) {
      return this.feedbackBuffer.get(sessionId) ?? [];
    }

    const result = await this.env.BEING_STATE_DB.prepare(`
      SELECT * FROM feedback_events
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `).bind(sessionId, limit).all();

    return result.results.map((row: any) => ({
      sessionId: row.session_id,
      agentId: row.agent_id,
      actionId: row.action_id,
      feedback: {
        outcome: row.outcome,
        metrics: JSON.parse(row.metrics),
        observations: JSON.parse(row.observations),
        surprises: JSON.parse(row.surprises),
        learningSignal: row.learning_signal,
      },
      timestamp: row.timestamp,
    }));
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear feedback buffer for session
   */
  clearSessionBuffer(sessionId: string): void {
    this.feedbackBuffer.delete(sessionId);
  }

  /**
   * Clear all buffers
   */
  clearAllBuffers(): void {
    this.feedbackBuffer.clear();
    this.learningSignals.clear();
  }

  /**
   * Get buffer statistics
   */
  getBufferStats(): {
    sessions: number;
    totalFeedback: number;
    totalSignals: number;
  } {
    let totalFeedback = 0;
    for (const buffer of this.feedbackBuffer.values()) {
      totalFeedback += buffer.length;
    }

    let totalSignals = 0;
    for (const signals of this.learningSignals.values()) {
      totalSignals += signals.length;
    }

    return {
      sessions: this.feedbackBuffer.size,
      totalFeedback,
      totalSignals,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createFeedbackLoopManager(env: BeingStateEnv): FeedbackLoopManager {
  return new FeedbackLoopManager(env);
}
