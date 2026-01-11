/**
 * Learning System - Outcome Tracking and Reinforcement
 *
 * Tracks outcomes and generates learning signals for character adaptation.
 */

import type {
  OutcomeType,
  LearningSignal,
  LearningSummary,
} from '../core/types.js';

/**
 * Outcome record
 */
interface Outcome {
  id: string;
  outcome: string;
  outcomeType: OutcomeType;
  success: boolean;
  reward: number;
  timestamp: Date;
  notes: string;
  situation: string;
  actionTaken: string;
  metadata: Record<string, unknown>;
}

/**
 * Outcome Tracker Configuration
 */
export interface OutcomeTrackerConfig {
  characterId: string;
  learningRate: number;
  enabled: boolean;
}

/**
 * Outcome Tracker
 *
 * Tracks outcomes and generates learning signals for reinforcement learning.
 *
 * @example
 * ```ts
 * const tracker = new OutcomeTracker('student_001');
 *
 * // Record a successful learning outcome
 * tracker.record('Mastered fractions', {
 *   success: true,
 *   reward: 10,
 *   situation: 'Math practice',
 *   actionTaken: 'completed_exercises',
 * });
 *
 * const summary = tracker.getSummary();
 * console.log(summary.successRate); // 1.0
 * ```
 */
export class OutcomeTracker {
  readonly characterId: string;
  readonly learningRate: number;
  readonly enabled: boolean;

  private outcomes: Outcome[] = [];
  private adjustments: LearningSignal[] = [];
  private successPatterns: Record<string, number> = {};
  private failurePatterns: Record<string, number> = {};

  constructor(config: OutcomeTrackerConfig | string) {
    if (typeof config === 'string') {
      this.characterId = config;
      this.learningRate = 0.1;
      this.enabled = true;
    } else {
      this.characterId = config.characterId;
      this.learningRate = config.learningRate;
      this.enabled = config.enabled;
    }
  }

  /**
   * Record an outcome and generate learning signals
   */
  record(
    outcome: string,
    options: {
      success?: boolean;
      reward?: number;
      outcomeType?: OutcomeType;
      notes?: string;
      situation?: string;
      actionTaken?: string;
    } = {}
  ): LearningSignal {
    if (!this.enabled) {
      return {
        signalType: '',
        delta: 0,
        confidence: 0,
        reason: 'Learning disabled',
      };
    }

    const {
      success,
      reward = 0,
      outcomeType,
      notes = '',
      situation = '',
      actionTaken = '',
    } = options;

    // Determine success/type
    const finalSuccess = success ?? reward > 0;
    let finalType = outcomeType;
    if (!finalType) {
      if (finalSuccess) {
        finalType = 'success' as OutcomeType;
      } else if (reward < 0) {
        finalType = 'failure' as OutcomeType;
      } else {
        finalType = 'neutral' as OutcomeType;
      }
    }

    // Create outcome record
    const outcomeRecord: Outcome = {
      id: this.generateId(),
      outcome,
      outcomeType: finalType,
      success: finalSuccess,
      reward,
      timestamp: new Date(),
      notes,
      situation,
      actionTaken,
      metadata: {},
    };

    this.outcomes.push(outcomeRecord);

    // Generate learning signals
    const signals = this.generateLearningSignals(outcomeRecord);
    this.adjustments.push(...signals);

    // Track patterns
    this.trackPatterns(outcomeRecord);

    // Return primary signal
    return signals[0] ?? {
      signalType: '',
      delta: 0,
      confidence: 0,
      reason: 'No learning needed',
    };
  }

  /**
   * Get summary of learning outcomes
   */
  getSummary(): LearningSummary {
    if (this.outcomes.length === 0) {
      return {
        totalOutcomes: 0,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
        totalReward: 0,
        averageReward: 0,
        learningTrend: 0,
        adjustmentsMade: 0,
        successPatterns: {},
        failurePatterns: {},
      };
    }

    const successCount = this.outcomes.filter(o => o.success).length;
    const failureCount = this.outcomes.length - successCount;
    const totalReward = this.outcomes.reduce((sum, o) => sum + o.reward, 0);

    // Calculate trend (comparing recent to overall)
    const recentCount = Math.min(10, this.outcomes.length);
    const recentOutcomes = this.outcomes.slice(-recentCount);
    const recentReward = recentOutcomes.reduce((sum, o) => sum + o.reward, 0) / recentOutcomes.length;
    const overallReward = totalReward / this.outcomes.length;
    const trend = recentReward - overallReward;

    return {
      totalOutcomes: this.outcomes.length,
      successCount,
      failureCount,
      successRate: successCount / this.outcomes.length,
      totalReward,
      averageReward: totalReward / this.outcomes.length,
      learningTrend: trend,
      adjustmentsMade: this.adjustments.length,
      successPatterns: { ...this.successPatterns },
      failurePatterns: { ...this.failurePatterns },
    };
  }

  /**
   * Get recent outcomes
   */
  getRecentOutcomes(count = 10): Outcome[] {
    return this.outcomes.slice(-count);
  }

  /**
   * Get pending learning adjustments
   */
  getPendingAdjustments(): LearningSignal[] {
    return [...this.adjustments];
  }

  /**
   * Clear applied adjustments
   */
  clearAdjustments(): void {
    this.adjustments = [];
  }

  /**
   * Check if a trait should be adjusted
   */
  shouldAdjustTrait(trait: string): number | null {
    const signalType = `trait:${trait}`;
    const totalDelta = this.adjustments
      .filter(s => s.signalType === signalType)
      .reduce((sum, s) => sum + s.delta, 0);
    return totalDelta !== 0 ? totalDelta : null;
  }

  /**
   * Get mastery trend for a skill
   */
  getMasteryTrend(skill: string): { improving: boolean; recentRate: number; overallRate: number } {
    const skillOutcomes = this.outcomes.filter(o =>
      o.situation.toLowerCase().includes(skill.toLowerCase()) ||
      o.actionTaken.toLowerCase().includes(skill.toLowerCase())
    );

    if (skillOutcomes.length < 2) {
      return { improving: false, recentRate: 0, overallRate: 0 };
    }

    const recentCount = Math.min(5, skillOutcomes.length);
    const recent = skillOutcomes.slice(-recentCount);
    const overallRate = skillOutcomes.filter(o => o.success).length / skillOutcomes.length;
    const recentRate = recent.filter(o => o.success).length / recent.length;

    return {
      improving: recentRate > overallRate,
      recentRate,
      overallRate,
    };
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.outcomes = [];
    this.adjustments = [];
    this.successPatterns = {};
    this.failurePatterns = {};
  }

  /**
   * Export to JSON
   */
  toJSON(): object {
    return {
      characterId: this.characterId,
      learningRate: this.learningRate,
      enabled: this.enabled,
      outcomes: this.outcomes.map(o => this.serializeOutcome(o)),
      successPatterns: this.successPatterns,
      failurePatterns: this.failurePatterns,
    };
  }

  /**
   * Import from JSON
   */
  fromJSON(data: {
    outcomes?: unknown[];
    successPatterns?: Record<string, number>;
    failurePatterns?: Record<string, number>;
  }): void {
    if (data.outcomes) {
      this.outcomes = data.outcomes.map(o => this.deserializeOutcome(o));
    }
    if (data.successPatterns) {
      this.successPatterns = data.successPatterns;
    }
    if (data.failurePatterns) {
      this.failurePatterns = data.failurePatterns;
    }
  }

  /**
   * Generate learning signals from an outcome
   */
  private generateLearningSignals(outcome: Outcome): LearningSignal[] {
    const signals: LearningSignal[] = [];

    // Success - reinforce the action
    if (outcome.success && outcome.reward > 0) {
      if (outcome.actionTaken) {
        signals.push({
          signalType: `action:${outcome.actionTaken}`,
          delta: outcome.reward * this.learningRate * 0.1,
          confidence: 0.7,
          reason: `Successful outcome: ${outcome.outcome}`,
        });
      }
    }

    // Failure - discourage the action
    if (!outcome.success && outcome.reward < 0) {
      if (outcome.actionTaken) {
        signals.push({
          signalType: `action:${outcome.actionTaken}`,
          delta: outcome.reward * this.learningRate * 0.1,
          confidence: 0.7,
          reason: `Failed outcome: ${outcome.outcome}`,
        });
      }
    }

    // Extract situation-based learning
    if (outcome.situation) {
      const situationWords = outcome.situation.toLowerCase().split(/\s+/);
      for (const word of ['combat', 'social', 'exploration', 'learning', 'practice', 'study']) {
        if (situationWords.includes(word)) {
          signals.push({
            signalType: `situation:${word}`,
            delta: outcome.reward * this.learningRate * 0.05,
            confidence: 0.5,
            reason: `Experience in ${word}`,
          });
        }
      }
    }

    return signals;
  }

  /**
   * Track patterns in successes and failures
   */
  private trackPatterns(outcome: Outcome): void {
    const words = new Set([
      ...outcome.outcome.toLowerCase().split(/\s+/),
      ...outcome.situation.toLowerCase().split(/\s+/),
    ]);

    for (const word of words) {
      if (word.length < 4) continue;

      if (outcome.success) {
        this.successPatterns[word] = (this.successPatterns[word] ?? 0) + 1;
      } else {
        this.failurePatterns[word] = (this.failurePatterns[word] ?? 0) + 1;
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${this.characterId}_${this.outcomes.length}_${Date.now()}`;
  }

  /**
   * Serialize outcome for storage
   */
  private serializeOutcome(outcome: Outcome): object {
    return {
      id: outcome.id,
      outcome: outcome.outcome,
      outcomeType: outcome.outcomeType,
      success: outcome.success,
      reward: outcome.reward,
      timestamp: outcome.timestamp.toISOString(),
      notes: outcome.notes,
      situation: outcome.situation,
      actionTaken: outcome.actionTaken,
      metadata: outcome.metadata,
    };
  }

  /**
   * Deserialize outcome from storage
   */
  private deserializeOutcome(data: unknown): Outcome {
    const d = data as Record<string, unknown>;
    return {
      id: d.id as string,
      outcome: d.outcome as string,
      outcomeType: d.outcomeType as OutcomeType,
      success: d.success as boolean,
      reward: d.reward as number,
      timestamp: new Date(d.timestamp as string),
      notes: (d.notes ?? '') as string,
      situation: (d.situation ?? '') as string,
      actionTaken: (d.actionTaken ?? '') as string,
      metadata: (d.metadata ?? {}) as Record<string, unknown>,
    };
  }
}

/**
 * Factory function to create an outcome tracker
 */
export function createOutcomeTracker(
  characterId: string,
  learningRate = 0.1
): OutcomeTracker {
  return new OutcomeTracker({ characterId, learningRate, enabled: true });
}

// Re-export types
export type {
  OutcomeType,
  LearningSignal,
  LearningSummary,
};
