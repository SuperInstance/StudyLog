/**
 * Decision Engine - Intelligent Routing System
 *
 * Routes decisions through three tiers based on:
 * - Confidence levels
 * - Stakes assessment
 * - Novelty detection
 * - Time constraints
 *
 * This enables cost-effective AI responses by routing routine
 * decisions to rules/logic, novel situations to local models,
 * and critical decisions to premium APIs.
 */

import type {
  DecisionTier,
  DecisionContext,
  DecisionRouting,
  EscalationReason,
  EscalationThresholds,
} from '../core/types.js';

/**
 * Decision Engine Configuration
 */
export interface DecisionEngineConfig {
  confidenceThreshold: number;
  enableEscalation: boolean;
  enableLearning: boolean;
}

/**
 * Pattern tracking for novelty detection
 */
interface PatternTracker {
  [key: string]: string[];
}

/**
 * Decision history for learning
 */
interface DecisionHistory {
  totalDecisions: number;
  botDecisions: number;
  brainDecisions: number;
  humanDecisions: number;
  escalations: number;
  avgConfidence: number;
  totalCost: number;
}

/**
 * Decision Engine
 *
 * Routes decisions to appropriate tier based on context.
 *
 * @example
 * ```ts
 * const engine = new DecisionEngine();
 *
 * const routing = engine.route({
 *   characterId: 'hero',
 *   situationType: 'combat',
 *   situationDescription: 'A dragon attacks!',
 *   stakes: 0.9,
 *   urgencyMs: null,
 * });
 *
 * console.log(routing.tier); // DecisionTier.HUMAN
 * ```
 */
export class DecisionEngine {
  private readonly config: DecisionEngineConfig;
  private readonly thresholds: Map<string, EscalationThresholds>;
  private readonly patterns: PatternTracker;
  private readonly stats: DecisionHistory;
  private readonly decisionHistory: string[];

  constructor(config: Partial<DecisionEngineConfig> = {}) {
    this.config = {
      confidenceThreshold: 0.7,
      enableEscalation: true,
      enableLearning: true,
      ...config,
    };
    this.thresholds = new Map();
    this.patterns = {};
    this.stats = {
      totalDecisions: 0,
      botDecisions: 0,
      brainDecisions: 0,
      humanDecisions: 0,
      escalations: 0,
      avgConfidence: 0,
      totalCost: 0,
    };
    this.decisionHistory = [];
  }

  /**
   * Route a decision to the appropriate tier
   */
  route(context: DecisionContext): DecisionRouting {
    const startTime = Date.now();
    const thresholds = this.getThresholds(context.characterId);

    // Check for critical overrides first
    const criticalOverride = this.checkCriticalOverride(context, thresholds);
    if (criticalOverride) {
      this.recordRouting(criticalOverride);
      return {
        ...criticalOverride,
        metadata: {
          ...criticalOverride.metadata,
          routingTimeMs: Date.now() - startTime,
        },
      };
    }

    // Check if situation is novel
    const isNovel = this.isNovelSituation(context, thresholds);

    // Check stakes level
    const isHighStakes = context.stakes >= thresholds.highStakesThreshold;
    const isCriticalStakes = context.stakes >= thresholds.criticalStakesThreshold;

    // Check urgency
    const isUrgent = context.urgencyMs !== null && context.urgencyMs <= thresholds.urgentTimeMs;
    const isTimeCritical = context.urgencyMs !== null && context.urgencyMs <= thresholds.criticalTimeMs;

    // Determine routing
    let routing: DecisionRouting;

    // Critical situations -> Human
    if (isCriticalStakes || isTimeCritical) {
      routing = {
        tier: 'human' as DecisionTier,
        reason: (isCriticalStakes ? 'high_stakes' : 'time_critical') as EscalationReason,
        confidenceRequired: 0.9,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: {
          isNovel,
          isHighStakes,
          isCriticalStakes,
          isUrgent,
          isTimeCritical,
        },
      };
    }
    // Novel situations with high stakes -> Brain (or Human if very high)
    else if (isNovel && isHighStakes) {
      routing = {
        tier: (isCriticalStakes ? 'human' : 'brain') as DecisionTier,
        reason: 'novel_situation' as EscalationReason,
        confidenceRequired: thresholds.brainMinConfidence,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: {
          isNovel,
          isHighStakes,
        },
      };
    }
    // Novel situations with low stakes -> Brain
    else if (isNovel) {
      routing = {
        tier: 'brain' as DecisionTier,
        reason: 'novel_situation' as EscalationReason,
        confidenceRequired: thresholds.brainMinConfidence,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: { isNovel },
      };
    }
    // High stakes but familiar -> Brain
    else if (isHighStakes) {
      routing = {
        tier: 'brain' as DecisionTier,
        reason: 'high_stakes' as EscalationReason,
        confidenceRequired: thresholds.brainMinConfidence + 0.1,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: { isHighStakes },
      };
    }
    // Urgent but familiar -> Bot (fast response)
    else if (isUrgent) {
      routing = {
        tier: 'bot' as DecisionTier,
        reason: null,
        confidenceRequired: thresholds.botMinConfidence - 0.1,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: { isUrgent },
      };
    }
    // Routine situation -> Bot
    else {
      routing = {
        tier: 'bot' as DecisionTier,
        reason: null,
        confidenceRequired: thresholds.botMinConfidence,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: {},
      };
    }

    routing.metadata = {
      ...routing.metadata,
      routingTimeMs: Date.now() - startTime,
    };

    this.recordRouting(routing);
    return routing;
  }

  /**
   * Get thresholds for a character
   */
  getThresholds(characterId: string): EscalationThresholds {
    if (!this.thresholds.has(characterId)) {
      this.thresholds.set(characterId, this.getDefaultThresholds());
    }
    return this.thresholds.get(characterId)!;
  }

  /**
   * Set thresholds for a character
   */
  setThresholds(characterId: string, thresholds: Partial<EscalationThresholds>): void {
    this.thresholds.set(characterId, {
      ...this.getDefaultThresholds(),
      ...thresholds,
    });
  }

  /**
   * Get global statistics
   */
  getStats(): DecisionHistory {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.totalDecisions = 0;
    this.stats.botDecisions = 0;
    this.stats.brainDecisions = 0;
    this.stats.humanDecisions = 0;
    this.stats.escalations = 0;
    this.stats.avgConfidence = 0;
    this.stats.totalCost = 0;
    this.decisionHistory.length = 0;
  }

  /**
   * Get cost savings estimate
   */
  getCostSavings(): { savings: number; reductionRatio: number } {
    if (this.stats.totalDecisions === 0) {
      return { savings: 0, reductionRatio: 1 };
    }

    // Baseline: all decisions at human tier ($0.02 each)
    const baselineCost = this.stats.totalDecisions * 0.02;
    const actualCost = this.stats.totalCost;
    const savings = baselineCost - actualCost;
    const reductionRatio = baselineCost / (actualCost || 1);

    return { savings, reductionRatio };
  }

  /**
   * Check for critical situation overrides
   */
  private checkCriticalOverride(
    context: DecisionContext,
    thresholds: EscalationThresholds
  ): DecisionRouting | null {
    // Critical HP/resources -> Human
    if (context.characterHpRatio <= thresholds.hpCriticalThreshold) {
      return {
        tier: 'human' as DecisionTier,
        reason: 'safety_concern' as EscalationReason,
        confidenceRequired: 0.95,
        timeBudgetMs: context.urgencyMs,
        allowFallback: false,
        metadata: { criticalHp: true },
      };
    }

    // Critical resources -> Human
    for (const [resource, amount] of Object.entries(context.availableResources)) {
      if (['spell_slots', 'hp_potions', 'resurrection', 'credits', 'tokens'].includes(resource)) {
        if ((amount as number) <= 1) {
          return {
            tier: 'human' as DecisionTier,
            reason: 'safety_concern' as EscalationReason,
            confidenceRequired: 0.95,
            timeBudgetMs: context.urgencyMs,
            allowFallback: false,
            metadata: { criticalResource: resource },
          };
        }
      }
    }

    // Recent failures -> Brain or Human
    if (context.recentFailures >= 3) {
      return {
        tier: 'brain' as DecisionTier,
        reason: 'low_confidence' as EscalationReason,
        confidenceRequired: 0.8,
        timeBudgetMs: context.urgencyMs,
        allowFallback: true,
        metadata: { recentFailures: context.recentFailures },
      };
    }

    return null;
  }

  /**
   * Determine if situation is novel (unseen or rare)
   */
  private isNovelSituation(
    context: DecisionContext,
    thresholds: EscalationThresholds
  ): boolean {
    const situationKey = `${context.characterId}:${context.situationType}`;

    if (!this.patterns[situationKey]) {
      this.patterns[situationKey] = [];
    }

    const patterns = this.patterns[situationKey];

    // If we haven't seen many similar situations, it's novel
    if (patterns.length < 5) {
      return true;
    }

    // Check similarity to known patterns
    const descriptionWords = new Set(
      context.situationDescription.toLowerCase().split(/\s+/)
    );

    let maxSimilarity = 0;
    for (const pattern of patterns) {
      const patternWords = new Set(pattern.toLowerCase().split(/\s+/));
      if (patternWords.size === 0) continue;

      const commonWords = [...descriptionWords].filter(w => patternWords.has(w));
      const similarity = commonWords.length / patternWords.size;
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // If max similarity is low, situation is novel
    const isNovel = maxSimilarity < (1 - thresholds.noveltyThreshold);

    // Store pattern if novel or if we have room
    if (isNovel || patterns.length < 20) {
      patterns.push(context.situationDescription.slice(0, 100));
    }

    return isNovel;
  }

  /**
   * Record routing for statistics
   */
  private recordRouting(routing: DecisionRouting): void {
    this.stats.totalDecisions++;

    switch (routing.tier) {
      case 'bot':
        this.stats.botDecisions++;
        this.stats.totalCost += 0.0001; // ~$0.0001 per bot decision
        break;
      case 'brain':
        this.stats.brainDecisions++;
        this.stats.totalCost += 0.001; // ~$0.001 per brain decision (local)
        break;
      case 'human':
        this.stats.humanDecisions++;
        this.stats.totalCost += 0.02; // ~$0.02 per human decision (API)
        break;
    }

    // Track escalations (when reason is set)
    if (routing.reason !== null) {
      this.stats.escalations++;
    }

    // Update average confidence
    this.stats.avgConfidence =
      (this.stats.avgConfidence * (this.stats.totalDecisions - 1) + routing.confidenceRequired) /
      this.stats.totalDecisions;

    // Store in history
    this.decisionHistory.push(JSON.stringify(routing));
  }

  /**
   * Get default thresholds
   */
  private getDefaultThresholds(): EscalationThresholds {
    return {
      botMinConfidence: 0.7,
      brainMinConfidence: 0.5,
      highStakesThreshold: 0.7,
      criticalStakesThreshold: 0.9,
      urgentTimeMs: 5000,
      criticalTimeMs: 1000,
      noveltyThreshold: 0.6,
      hpCriticalThreshold: 0.2,
    };
  }
}

/**
 * Factory function to create a decision engine
 */
export function createDecisionEngine(
  config?: Partial<DecisionEngineConfig>
): DecisionEngine {
  return new DecisionEngine(config);
}

// Re-export types
export type {
  DecisionTier,
  DecisionContext,
  DecisionRouting,
  EscalationReason,
  EscalationThresholds,
  DecisionEngineConfig,
};
