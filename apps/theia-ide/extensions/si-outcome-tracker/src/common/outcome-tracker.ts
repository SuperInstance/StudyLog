/**
 * Outcome Tracker Core
 *
 * Multi-domain reward tracking system for StudyLoG.AI
 * Adapted from https://github.com/SuperInstance/outcome-tracker
 */

import {
  OutcomeType,
  StudyLogRewardDomain,
  RewardDomain,
  OutcomeRecord,
  RewardSignal,
  LearningContext,
  OutcomeStatistics,
  DecisionQuality
} from './outcome-types';

/**
 * Core class for tracking learning outcomes with multi-domain reward signals
 */
export class OutcomeTracker {
  private outcomes: Map<string, OutcomeRecord[]> = new Map();
  private pendingOutcomes: Map<string, Record<string, any>> = new Map();
  private causalChains: string[][] = [];

  private metrics: Record<string, number | boolean> = {
    totalOutcomes: 0,
    immediateOutcomes: 0,
    shortTermOutcomes: 0,
    longTermOutcomes: 0,
    reflectiveOutcomes: 0,
    avgRewardSignal: 0,
    correlationTimeMs: 0
  };

  constructor() {
    console.log('[OutcomeTracker] Initialized');
  }

  /**
   * Track an immediate outcome that happens right after a learning activity
   */
  trackImmediateOutcome(
    decisionId: string,
    description: string,
    success: boolean,
    context: LearningContext
  ): OutcomeRecord {
    const startTime = Date.now();

    const rewards = this.calculateRewards(context, description, success);

    const outcome: OutcomeRecord = {
      decisionId,
      outcomeType: OutcomeType.IMMEDIATE,
      timestamp: Date.now() / 1000,
      description,
      success,
      rewards,
      relatedDecisions: [],
      causalChain: [],
      metadata: { context }
    };

    this.storeOutcome(outcome);
    this.updateImmediateMetrics(rewards, startTime);

    console.log(`[OutcomeTracker] Tracked immediate outcome for ${decisionId}: ${success ? 'success' : 'failure'}`);

    return outcome;
  }

  /**
   * Track a delayed outcome that happens after some time
   */
  trackDelayedOutcome(
    decisionId: string,
    description: string,
    success: boolean,
    context: LearningContext,
    outcomeType: OutcomeType = OutcomeType.SHORT_TERM,
    relatedDecisions: string[] = []
  ): OutcomeRecord {
    const startTime = Date.now();

    const rewards = this.calculateRewards(context, description, success);

    const outcome: OutcomeRecord = {
      decisionId,
      outcomeType,
      timestamp: Date.now() / 1000,
      description,
      success,
      rewards,
      relatedDecisions,
      causalChain: relatedDecisions.length > 0 ? this.buildCausalChain(decisionId, relatedDecisions) : [],
      metadata: { context }
    };

    this.storeOutcome(outcome);
    this.updateDelayedMetrics(outcomeType, rewards, startTime);

    console.log(`[OutcomeTracker] Tracked ${outcomeType} outcome for ${decisionId}`);

    return outcome;
  }

  /**
   * Calculate reward signals across multiple learning domains
   */
  private calculateRewards(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal[] {
    const rewards: RewardSignal[] = [];
    const decisionType = context.decisionType || 'unknown';
    const descLower = description.toLowerCase();

    // Cognitive rewards (problem-solving, reasoning)
    if (this.isCognitiveActivity(decisionType, descLower)) {
      const cognitiveReward = this.calculateCognitiveReward(context, description, success);
      if (cognitiveReward) {
        rewards.push(cognitiveReward);
      }
    }

    // Collaborative rewards (peer interaction, helping)
    if (this.isCollaborativeActivity(decisionType, descLower)) {
      const collaborativeReward = this.calculateCollaborativeReward(context, description, success);
      if (collaborativeReward) {
        rewards.push(collaborativeReward);
      }
    }

    // Discovery rewards (exploration, experimentation)
    if (this.isDiscoveryActivity(decisionType, descLower)) {
      const discoveryReward = this.calculateDiscoveryReward(context, description, success);
      if (discoveryReward) {
        rewards.push(discoveryReward);
      }
    }

    // Efficiency rewards (time, resources, hints)
    if (context.timeSeconds !== undefined || context.hintsUsed !== undefined) {
      const efficiencyReward = this.calculateEfficiencyReward(context, description, success);
      if (efficiencyReward) {
        rewards.push(efficiencyReward);
      }
    }

    // Mastery rewards (retention, transfer, prerequisites)
    if (context.stage !== undefined || this.isMasteryActivity(descLower)) {
      const masteryReward = this.calculateMasteryReward(context, description, success);
      if (masteryReward) {
        rewards.push(masteryReward);
      }
    }

    // Creative rewards (novel solutions, remixes)
    if (this.isCreativeActivity(descLower)) {
      const creativeReward = this.calculateCreativeReward(context, description, success);
      if (creativeReward) {
        rewards.push(creativeReward);
      }
    }

    return rewards;
  }

  private isCognitiveActivity(decisionType: string, descLower: string): boolean {
    return decisionType === 'cognitive' ||
      decisionType === 'puzzle' ||
      decisionType === 'quiz' ||
      descLower.includes('solved') ||
      descLower.includes('completed') ||
      descLower.includes('correct');
  }

  private isCollaborativeActivity(decisionType: string, descLower: string): boolean {
    return decisionType === 'collaborative' ||
      decisionType === 'forum' ||
      descLower.includes('helped') ||
      descLower.includes('shared') ||
      descLower.includes('comment') ||
      descLower.includes('peer');
  }

  private isDiscoveryActivity(decisionType: string, descLower: string): boolean {
    return decisionType === 'exploration' ||
      decisionType === 'discovery' ||
      descLower.includes('discovered') ||
      descLower.includes('found') ||
      descLower.includes('explored') ||
      descLower.includes('experiment');
  }

  private isMasteryActivity(descLower: string): boolean {
    return descLower.includes('mastered') ||
      descLower.includes('retained') ||
      descLower.includes('applied') ||
      descLower.includes('prerequisite');
  }

  private isCreativeActivity(descLower: string): boolean {
    return descLower.includes('created') ||
      descLower.includes('remixed') ||
      descLower.includes('innovative') ||
      descLower.includes('novel') ||
      descLower.includes('unique');
  }

  /**
   * Calculate cognitive domain reward
   */
  private calculateCognitiveReward(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const descLower = description.toLowerCase();

    // Problem solved
    if (descLower.includes('solved') || descLower.includes('completed')) {
      components['problem_solved'] = 0.5;
    }

    // Few attempts = better efficiency
    if (context.attempts !== undefined) {
      const attemptBonus = Math.max(0, 1 - (context.attempts - 1) * 0.2);
      components['few_attempts'] = attemptBonus * 0.3;
    }

    // Correct answer
    if (descLower.includes('correct') || success) {
      components['correct_answer'] = 0.4;
    }

    // No hints used
    if (context.hintsUsed === 0) {
      components['no_hints'] = 0.2;
    } else if (context.hintsUsed !== undefined) {
      components['hints_penalty'] = -context.hintsUsed * 0.1;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: StudyLogRewardDomain.COGNITIVE,
      value,
      confidence: 0.8,
      components,
      reasoning: `Cognitive outcome: ${description.substring(0, 50)}...`
    };
  }

  /**
   * Calculate collaborative domain reward
   */
  private calculateCollaborativeReward(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const descLower = description.toLowerCase();

    if (descLower.includes('helped')) {
      components['helping_peer'] = 0.5;
    }

    if (descLower.includes('shared')) {
      components['sharing_knowledge'] = 0.4;
    }

    if (descLower.includes('comment') || descLower.includes('replied')) {
      components['forum_participation'] = 0.3;
    }

    if (descLower.includes('thanked') || descLower.includes('appreciated')) {
      components['peer_appreciation'] = 0.3;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: StudyLogRewardDomain.COLLABORATIVE,
      value,
      confidence: 0.7,
      components,
      reasoning: `Collaborative outcome: ${description.substring(0, 50)}...`
    };
  }

  /**
   * Calculate discovery domain reward
   */
  private calculateDiscoveryReward(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const descLower = description.toLowerCase();

    if (descLower.includes('discovered') || descLower.includes('found')) {
      components['discovery'] = 0.5;
    }

    if (descLower.includes('explored')) {
      components['exploration'] = 0.3;
    }

    if (descLower.includes('experiment')) {
      components['experimentation'] = 0.4;
    }

    if (descLower.includes('new technique') || descLower.includes('novel')) {
      components['new_technique'] = 0.3;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: StudyLogRewardDomain.DISCOVERY,
      value,
      confidence: 0.75,
      components,
      reasoning: `Discovery outcome: ${description.substring(0, 50)}...`
    };
  }

  /**
   * Calculate efficiency domain reward
   */
  private calculateEfficiencyReward(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};

    // Time efficiency (faster is better, but not too fast)
    if (context.timeSeconds !== undefined) {
      const minutes = context.timeSeconds / 60;
      if (minutes < 1) {
        components['speed'] = 0.2;
      } else if (minutes < 5) {
        components['speed'] = 0.4;
      } else if (minutes < 15) {
        components['speed'] = 0.3;
      } else {
        components['slower_pace'] = 0.1;
      }
    }

    // Hint efficiency (fewer is better)
    if (context.hintsUsed !== undefined) {
      if (context.hintsUsed === 0) {
        components['no_hints_needed'] = 0.3;
      } else if (context.hintsUsed <= 2) {
        components['minimal_hints'] = 0.1;
      } else {
        components['many_hints'] = -0.2;
      }
    }

    // Attempt efficiency
    if (context.attempts !== undefined) {
      if (context.attempts === 1) {
        components['first_try'] = 0.3;
      } else if (context.attempts <= 3) {
        components['few_attempts'] = 0.2;
      }
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: StudyLogRewardDomain.EFFICIENCY,
      value,
      confidence: 0.85,
      components,
      reasoning: `Efficiency outcome: ${description.substring(0, 50)}...`
    };
  }

  /**
   * Calculate mastery domain reward
   */
  private calculateMasteryReward(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const descLower = description.toLowerCase();

    // Stage completion
    if (descLower.includes('stage') || descLower.includes('level')) {
      components['stage_progress'] = success ? 0.4 : -0.2;
    }

    // Skill retention
    if (descLower.includes('retained') || descLower.includes('remembered')) {
      components['retention'] = 0.5;
    }

    // Knowledge transfer
    if (descLower.includes('applied') || descLower.includes('transfer')) {
      components['knowledge_transfer'] = 0.5;
    }

    // Prerequisites met
    if (descLower.includes('prerequisite') || descLower.includes('unlocked')) {
      components['prerequisite_met'] = 0.4;
    }

    if (Object.keys(components).length === 0 && success) {
      components['basic_mastery'] = 0.2;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: StudyLogRewardDomain.MASTERY,
      value,
      confidence: 0.7,
      components,
      reasoning: `Mastery outcome: ${description.substring(0, 50)}...`
    };
  }

  /**
   * Calculate creative domain reward
   */
  private calculateCreativeReward(
    context: LearningContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const descLower = description.toLowerCase();

    if (descLower.includes('created')) {
      components['creation'] = 0.4;
    }

    if (descLower.includes('remixed') || descLower.includes('modified')) {
      components['remix'] = 0.3;
    }

    if (descLower.includes('innovative') || descLower.includes('novel')) {
      components['innovation'] = 0.5;
    }

    if (descLower.includes('unique') || descLower.includes('original')) {
      components['originality'] = 0.4;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: StudyLogRewardDomain.CREATIVE,
      value,
      confidence: 0.6,
      components,
      reasoning: `Creative outcome: ${description.substring(0, 50)}...`
    };
  }

  /**
   * Build causal chain showing how decisions led to this outcome
   */
  private buildCausalChain(decisionId: string, relatedDecisions: string[]): string[] {
    const chain = [...relatedDecisions];

    if (!chain.includes(decisionId)) {
      chain.push(decisionId);
    }

    const chainString = chain.join('->');
    if (!this.causalChains.some(c => c.join('->') === chainString)) {
      this.causalChains.push(chain);
    }

    return chain;
  }

  /**
   * Store an outcome record
   */
  private storeOutcome(outcome: OutcomeRecord): void {
    const decisionId = outcome.decisionId;
    if (!this.outcomes.has(decisionId)) {
      this.outcomes.set(decisionId, []);
    }
    this.outcomes.get(decisionId)!.push(outcome);
    this.metrics.totalOutcomes = (this.metrics.totalOutcomes as number) + 1;
  }

  /**
   * Update metrics for immediate outcomes
   */
  private updateImmediateMetrics(rewards: RewardSignal[], startTime: number): void {
    this.metrics.immediateOutcomes = (this.metrics.immediateOutcomes as number) + 1;
    this.updateRewardMetrics(rewards);

    const correlationTime = Date.now() - startTime;
    this.metrics.correlationTimeMs = (
      (this.metrics.correlationTimeMs as number) * 0.9 + correlationTime * 0.1
    );
  }

  /**
   * Update metrics for delayed outcomes
   */
  private updateDelayedMetrics(outcomeType: OutcomeType, rewards: RewardSignal[], startTime: number): void {
    if (outcomeType === OutcomeType.SHORT_TERM) {
      this.metrics.shortTermOutcomes = (this.metrics.shortTermOutcomes as number) + 1;
    } else if (outcomeType === OutcomeType.LONG_TERM) {
      this.metrics.longTermOutcomes = (this.metrics.longTermOutcomes as number) + 1;
    } else if (outcomeType === OutcomeType.REFLECTIVE) {
      this.metrics.reflectiveOutcomes = (this.metrics.reflectiveOutcomes as number) + 1;
    }

    this.updateRewardMetrics(rewards);

    const correlationTime = Date.now() - startTime;
    this.metrics.correlationTimeMs = (
      (this.metrics.correlationTimeMs as number) * 0.9 + correlationTime * 0.1
    );
  }

  /**
   * Update average reward metrics
   */
  private updateRewardMetrics(rewards: RewardSignal[]): void {
    if (rewards.length === 0) {
      return;
    }

    const avgReward = rewards.reduce((sum, r) => sum + r.value * r.confidence, 0) / rewards.length;

    const total = this.metrics.totalOutcomes as number;
    const currentAvg = this.metrics.avgRewardSignal as number;

    this.metrics.avgRewardSignal = ((currentAvg * (total - 1)) + avgReward) / total;
  }

  /**
   * Get all outcomes for a specific decision
   */
  getOutcomesForDecision(decisionId: string): OutcomeRecord[] {
    return this.outcomes.get(decisionId) || [];
  }

  /**
   * Get aggregate reward for a decision
   */
  getAggregateReward(decisionId: string, domain?: StudyLogRewardDomain | RewardDomain): number {
    const outcomes = this.getOutcomesForDecision(decisionId);

    if (outcomes.length === 0) {
      return 0;
    }

    const rewards: number[] = [];
    for (const outcome of outcomes) {
      for (const reward of outcome.rewards) {
        if (!domain || reward.domain === domain) {
          rewards.push(reward.value * reward.confidence);
        }
      }
    }

    if (rewards.length === 0) {
      return 0;
    }

    return rewards.reduce((a, b) => a + b, 0) / rewards.length;
  }

  /**
   * Get success rate for a decision type
   */
  getSuccessRate(decisionType?: string): number {
    let total = 0;
    let successes = 0;

    for (const outcomes of this.outcomes.values()) {
      for (const outcome of outcomes) {
        if (decisionType) {
          const outcomeType = outcome.metadata.context?.decisionType;
          if (outcomeType !== decisionType) {
            continue;
          }
        }

        total++;
        if (outcome.success) {
          successes++;
        }
      }
    }

    return total === 0 ? 0 : successes / total;
  }

  /**
   * Get outcome tracking statistics
   */
  getStatistics(): OutcomeStatistics {
    const stats: any = { ...this.metrics };

    // Add success rates by type
    stats.successRateOverall = this.getSuccessRate();
    stats.successRateCognitive = this.getSuccessRate('cognitive');
    stats.successRateCollaborative = this.getSuccessRate('collaborative');
    stats.successRateDiscovery = this.getSuccessRate('discovery');

    // Outcome type distribution
    const total = stats.totalOutcomes as number;
    if (total > 0) {
      stats.immediatePct = (stats.immediateOutcomes as number) / total;
      stats.shortTermPct = (stats.shortTermOutcomes as number) / total;
      stats.longTermPct = (stats.longTermOutcomes as number) / total;
      stats.reflectivePct = (stats.reflectiveOutcomes as number) / total;
    }

    // Causal chain stats
    stats.totalCausalChains = this.causalChains.length;
    if (this.causalChains.length > 0) {
      const chainLengths = this.causalChains.map(c => c.length);
      stats.avgChainLength = chainLengths.reduce((a, b) => a + b, 0) / chainLengths.length;
      stats.maxChainLength = Math.max(...chainLengths);
    } else {
      stats.avgChainLength = 0;
      stats.maxChainLength = 0;
    }

    return stats as OutcomeStatistics;
  }

  /**
   * Analyze the quality of a decision based on its outcomes
   */
  analyzeDecisionQuality(decisionId: string): DecisionQuality {
    const outcomes = this.getOutcomesForDecision(decisionId);

    if (outcomes.length === 0) {
      return {
        qualityScore: 0,
        confidence: 0,
        successRate: 0,
        domainScores: {},
        totalOutcomes: 0,
        reasoning: 'No outcomes available'
      };
    }

    // Aggregate rewards by domain
    const domainRewards: Record<string, number[]> = {};
    for (const outcome of outcomes) {
      for (const reward of outcome.rewards) {
        const domain = reward.domain;
        if (!domainRewards[domain]) {
          domainRewards[domain] = [];
        }
        domainRewards[domain].push(reward.value * reward.confidence);
      }
    }

    // Calculate average per domain
    const domainScores: Record<string, number> = {};
    for (const [domain, rewards] of Object.entries(domainRewards)) {
      domainScores[domain] = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    }

    // Overall quality score
    const domainValues = Object.values(domainScores);
    const qualityScore = domainValues.length > 0
      ? domainValues.reduce((a, b) => a + b, 0) / domainValues.length
      : 0;

    // Success factor
    const successCount = outcomes.filter(o => o.success).length;
    const successRate = successCount / outcomes.length;

    // Weighted quality
    const weightedQuality = qualityScore * 0.7 + (successRate * 2 - 1) * 0.3;

    // Confidence based on number of outcomes
    const confidence = Math.min(outcomes.length / 3, 1);

    return {
      qualityScore: weightedQuality,
      confidence,
      successRate,
      domainScores,
      totalOutcomes: outcomes.length,
      reasoning: `Based on ${outcomes.length} outcomes across ${Object.keys(domainScores).length} domains`
    };
  }

  /**
   * Get all outcome records
   */
  getAllOutcomes(): OutcomeRecord[] {
    const allOutcomes: OutcomeRecord[] = [];
    for (const outcomes of this.outcomes.values()) {
      allOutcomes.push(...outcomes);
    }
    return allOutcomes;
  }

  /**
   * Clear all tracked outcomes and reset metrics
   */
  clear(): void {
    this.outcomes.clear();
    this.pendingOutcomes.clear();
    this.causalChains = [];
    this.metrics = {
      totalOutcomes: 0,
      immediateOutcomes: 0,
      shortTermOutcomes: 0,
      longTermOutcomes: 0,
      reflectiveOutcomes: 0,
      avgRewardSignal: 0,
      correlationTimeMs: 0
    };
    console.log('[OutcomeTracker] Cleared');
  }

  /**
   * Export outcomes to JSON-serializable format
   */
  exportToJson(): {
    outcomes: OutcomeRecord[];
    statistics: OutcomeStatistics;
    metrics: Record<string, number | boolean>;
  } {
    return {
      outcomes: this.getAllOutcomes(),
      statistics: this.getStatistics(),
      metrics: { ...this.metrics }
    };
  }

  /**
   * Import outcomes from JSON format
   */
  importFromJson(data: {
    outcomes: OutcomeRecord[];
    statistics?: OutcomeStatistics;
    metrics?: Record<string, number | boolean>;
  }): void {
    this.clear();

    for (const outcome of data.outcomes) {
      if (!this.outcomes.has(outcome.decisionId)) {
        this.outcomes.set(outcome.decisionId, []);
      }
      this.outcomes.get(outcome.decisionId)!.push(outcome);
    }

    if (data.metrics) {
      this.metrics = { ...this.metrics, ...data.metrics };
    }
  }
}
