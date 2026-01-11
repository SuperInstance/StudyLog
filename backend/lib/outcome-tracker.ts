/**
 * StudyLoG.AI - Outcome Tracker
 *
 * Adapted from DMLog's outcome_tracker.py pattern.
 * Tracks learning attempt outcomes with reward signals and temporal correlation.
 * Calculates success metrics across syntax, logic, comprehension, and other domains.
 *
 * Key Features:
 * - Temporal correlation (immediate, short-term, long-term outcomes)
 * - Reward signal calculation (syntax, logic, style, comprehension)
 * - Quality analysis for learning attempts
 * - Teaching moment identification
 * - Performance metrics
 */

/**
 * Types of learning outcomes
 */
export enum OutcomeType {
  IMMEDIATE = 'immediate', // Happens right away (pass/fail, correct/incorrect)
  SHORT_TERM = 'short_term', // Within same exercise (5-10 attempts)
  LONG_TERM = 'long_term', // Retention over time (session-wide)
}

/**
 * Learning domains for reward calculation
 */
export enum LearningDomain {
  SYNTAX = 'syntax',
  LOGIC = 'logic',
  STYLE = 'style',
  COMPREHENSION = 'comprehension',
  RETENTION = 'retention',
  COLLABORATION = 'collaboration',
  CREATIVITY = 'creativity',
  EFFICIENCY = 'efficiency',
}

/**
 * A calculated reward signal for an outcome
 */
export interface RewardSignal {
  domain: LearningDomain;
  value: number; // -1.0 to 1.0
  confidence: number; // 0.0 to 1.0
  components: Record<string, number>;
  reasoning: string;
}

/**
 * Record of a learning outcome
 */
export interface OutcomeRecord {
  attemptId: string;
  outcomeType: OutcomeType;
  timestamp: number;
  description: string;
  success: boolean;
  rewards: RewardSignal[];
  relatedAttempts: string[];
  causalChain: string[];
  metadata: Record<string, unknown>;
}

/**
 * Context for calculating rewards
 */
export interface RewardContext {
  attemptType: string;
  difficulty?: number;
  timeSpentMs?: number;
  hintsUsed?: number;
  previousAttempts?: number;
  codeLength?: number;
  testCaseCoverage?: number;
}

/**
 * Quality analysis result
 */
export interface QualityAnalysis {
  qualityScore: number;
  confidence: number;
  successRate: number;
  domainScores: Record<string, number>;
  totalOutcomes: number;
  reasoning: string;
}

/**
 * Trial data structure for tracking
 */
export interface Trial {
  attemptId: string;
  studentId: string;
  sessionId: string;
  timestamp: number;
  attemptType: string;
  description: string;
  success: boolean;
  timeTakenMs: number;
  hintsUsed: number;
  domainRewards: Record<string, number>;
  qualityScore: number;
  teachingMoment: boolean;
}

/**
 * Outcome Tracker Class
 *
 * Tracks and analyzes learning outcomes with reward signals.
 */
export class OutcomeTracker {
  private outcomes: Map<string, OutcomeRecord[]>;
  private pendingOutcomes: Map<string, PendingOutcomeData>;
  private causalChains: string[][];
  private metrics: OutcomeMetrics;

  constructor() {
    this.outcomes = new Map();
    this.pendingOutcomes = new Map();
    this.causalChains = [];
    this.metrics = {
      totalOutcomes: 0,
      immediateOutcomes: 0,
      shortTermOutcomes: 0,
      longTermOutcomes: 0,
      avgRewardSignal: 0,
      correlationTimeMs: 0,
    };
  }

  /**
   * Track an immediate learning outcome
   */
  trackImmediateOutcome(
    attemptId: string,
    description: string,
    success: boolean,
    context: RewardContext
  ): OutcomeRecord {
    const startTime = Date.now();

    // Calculate reward signals
    const rewards = this.calculateRewards(context, description, success);

    // Create outcome record
    const outcome: OutcomeRecord = {
      attemptId,
      outcomeType: OutcomeType.IMMEDIATE,
      timestamp: Date.now(),
      description,
      success,
      rewards,
      relatedAttempts: [],
      causalChain: [],
      metadata: { context },
    };

    // Store outcome
    this.storeOutcome(attemptId, outcome);

    // Update metrics
    this.metrics.totalOutcomes += 1;
    this.metrics.immediateOutcomes += 1;
    this.updateRewardMetrics(rewards);

    const correlationTime = Date.now() - startTime;
    this.metrics.correlationTimeMs =
      this.metrics.correlationTimeMs * 0.9 + correlationTime * 0.1;

    return outcome;
  }

  /**
   * Track a delayed learning outcome
   */
  trackDelayedOutcome(
    attemptId: string,
    description: string,
    success: boolean,
    context: RewardContext,
    outcomeType: OutcomeType.SHORT_TERM | OutcomeType.LONG_TERM = OutcomeType.SHORT_TERM,
    relatedAttempts: string[] = []
  ): OutcomeRecord {
    const startTime = Date.now();

    // Calculate rewards
    const rewards = this.calculateRewards(context, description, success);

    // Create outcome
    const outcome: OutcomeRecord = {
      attemptId,
      outcomeType,
      timestamp: Date.now(),
      description,
      success,
      rewards,
      relatedAttempts,
      causalChain: this.buildCausalChain(attemptId, relatedAttempts),
      metadata: { context },
    };

    // Store
    this.storeOutcome(attemptId, outcome);

    // Update metrics
    this.metrics.totalOutcomes += 1;
    if (outcomeType === OutcomeType.SHORT_TERM) {
      this.metrics.shortTermOutcomes += 1;
    } else {
      this.metrics.longTermOutcomes += 1;
    }
    this.updateRewardMetrics(rewards);

    const correlationTime = Date.now() - startTime;
    this.metrics.correlationTimeMs =
      this.metrics.correlationTimeMs * 0.9 + correlationTime * 0.1;

    return outcome;
  }

  /**
   * Calculate reward signals across multiple domains
   */
  calculateRewards(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal[] {
    const rewards: RewardSignal[] = [];
    const attemptType = context.attemptType.toLowerCase();

    // Syntax rewards
    if (
      attemptType.includes('code') ||
      attemptType.includes('syntax') ||
      attemptType.includes('compile')
    ) {
      const syntaxReward = this.calculateSyntaxReward(context, description, success);
      if (syntaxReward) {
        rewards.push(syntaxReward);
      }
    }

    // Logic rewards
    if (
      attemptType.includes('algorithm') ||
      attemptType.includes('logic') ||
      attemptType.includes('puzzle')
    ) {
      const logicReward = this.calculateLogicReward(context, description, success);
      if (logicReward) {
        rewards.push(logicReward);
      }
    }

    // Style rewards
    if (
      attemptType.includes('code') ||
      attemptType.includes('refactor') ||
      attemptType.includes('style')
    ) {
      const styleReward = this.calculateStyleReward(context, description, success);
      if (styleReward) {
        rewards.push(styleReward);
      }
    }

    // Comprehension rewards
    if (
      attemptType.includes('quiz') ||
      attemptType.includes('comprehension') ||
      attemptType.includes('concept')
    ) {
      const comprehensionReward = this.calculateComprehensionReward(
        context,
        description,
        success
      );
      if (comprehensionReward) {
        rewards.push(comprehensionReward);
      }
    }

    // Efficiency rewards
    if (
      attemptType.includes('optimization') ||
      attemptType.includes('performance') ||
      context.timeSpentMs !== undefined
    ) {
      const efficiencyReward = this.calculateEfficiencyReward(
        context,
        description,
        success
      );
      if (efficiencyReward) {
        rewards.push(efficiencyReward);
      }
    }

    // Creativity rewards
    if (
      attemptType.includes('design') ||
      attemptType.includes('creative') ||
      description.toLowerCase().includes('innovative')
    ) {
      const creativityReward = this.calculateCreativityReward(
        context,
        description,
        success
      );
      if (creativityReward) {
        rewards.push(creativityReward);
      }
    }

    return rewards;
  }

  /**
   * Calculate syntax reward signal
   */
  private calculateSyntaxReward(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const desc = description.toLowerCase();

    // No syntax errors
    if (desc.includes('no error') || desc.includes('compiles successfully')) {
      components['no_errors'] = 0.5;
    }

    // Syntax errors present
    if (desc.includes('syntax error') || desc.includes('parse error')) {
      components['syntax_errors'] = -0.7;
    }

    // Type errors
    if (desc.includes('type error')) {
      components['type_errors'] = -0.5;
    }

    // Successful compilation
    if (desc.includes('compiled')) {
      components['compiled'] = 0.4;
    }

    // Fixed errors on retry
    if (context.previousAttempts && context.previousAttempts > 0) {
      if (success) {
        components['persistence'] = 0.3;
      } else {
        components['retry_needed'] = -0.1;
      }
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    // Base success bonus
    const finalValue = success ? Math.max(value, 0.3) : value;

    return {
      domain: LearningDomain.SYNTAX,
      value: finalValue,
      confidence: 0.9,
      components,
      reasoning: `Syntax outcome: ${description.substring(0, 50)}...`,
    };
  }

  /**
   * Calculate logic reward signal
   */
  private calculateLogicReward(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const desc = description.toLowerCase();

    // Correct algorithm/approach
    if (desc.includes('correct approach') || desc.includes('optimal solution')) {
      components['correct_approach'] = 0.5;
    }

    // Wrong logic
    if (desc.includes('incorrect') || desc.includes('wrong approach')) {
      components['incorrect_logic'] = -0.6;
    }

    // Edge cases handled
    if (desc.includes('edge case') || desc.includes('boundary condition')) {
      components['edge_cases'] = 0.3;
    }

    // Test case coverage
    if (context.testCaseCoverage !== undefined) {
      components['test_coverage'] = (context.testCaseCoverage - 0.5) * 0.5;
    }

    // Partial credit for effort
    if (!success && desc.includes('partial')) {
      components['partial_credit'] = 0.2;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));
    const finalValue = success ? Math.max(value, 0.2) : value;

    return {
      domain: LearningDomain.LOGIC,
      value: finalValue,
      confidence: 0.75,
      components,
      reasoning: `Logic outcome: ${description.substring(0, 50)}...`,
    };
  }

  /**
   * Calculate style reward signal
   */
  private calculateStyleReward(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const desc = description.toLowerCase();

    // Good practices
    if (desc.includes('clean code') || desc.includes('well-structured')) {
      components['clean_code'] = 0.3;
    }

    if (desc.includes('naming convention') || desc.includes('descriptive names')) {
      components['good_naming'] = 0.2;
    }

    if (desc.includes('commented') || desc.includes('documented')) {
      components['documented'] = 0.2;
    }

    // Code organization
    if (desc.includes('modular') || desc.includes('refactored')) {
      components['modular'] = 0.3;
    }

    // Code length considerations
    if (context.codeLength !== undefined) {
      // Reasonable length is positive
      if (context.codeLength < 500) {
        components['concise'] = 0.1;
      } else if (context.codeLength > 2000) {
        components['verbose'] = -0.2;
      }
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: LearningDomain.STYLE,
      value: success ? Math.max(value, 0.2) : value,
      confidence: 0.6,
      components,
      reasoning: `Style outcome: ${description.substring(0, 50)}...`,
    };
  }

  /**
   * Calculate comprehension reward signal
   */
  private calculateComprehensionReward(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const desc = description.toLowerCase();

    // Correct understanding demonstrated
    if (success) {
      components['correct_answer'] = 0.5;
    }

    // Partial understanding
    if (desc.includes('partially correct') || desc.includes('close')) {
      components['partial_understanding'] = 0.3;
    }

    // Demonstrated reasoning
    if (desc.includes('explained') || desc.includes('reasoning')) {
      components['showed_work'] = 0.2;
    }

    // Difficulty adjustment
    if (context.difficulty !== undefined) {
      const difficultyBonus = Math.min(0.3, (context.difficulty - 1) * 0.1);
      if (success) {
        components['difficulty_bonus'] = difficultyBonus;
      }
    }

    // Used hints appropriately
    if (context.hintsUsed !== undefined) {
      if (context.hintsUsed === 0 && success) {
        components['independent_success'] = 0.3;
      } else if (context.hintsUsed > 3) {
        components['many_hints'] = -0.2;
      }
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: LearningDomain.COMPREHENSION,
      value: success ? Math.max(value, 0.3) : value,
      confidence: 0.85,
      components,
      reasoning: `Comprehension outcome: ${description.substring(0, 50)}...`,
    };
  }

  /**
   * Calculate efficiency reward signal
   */
  private calculateEfficiencyReward(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const desc = description.toLowerCase();

    // Time-based efficiency
    if (context.timeSpentMs !== undefined) {
      // Expected time varies by difficulty
      const expectedTime = 30000 * (context.difficulty || 1); // 30s per difficulty level
      const timeRatio = context.timeSpentMs / expectedTime;

      if (timeRatio < 0.5) {
        components['very_fast'] = 0.3;
      } else if (timeRatio < 1) {
        components['efficient'] = 0.2;
      } else if (timeRatio > 2) {
        components['slow'] = -0.2;
      }
    }

    // Resource usage
    if (desc.includes('optimized') || desc.includes('efficient')) {
      components['optimized'] = 0.4;
    }

    // Performance improvements
    if (desc.includes('faster') || desc.includes('improved')) {
      components['improved'] = 0.3;
    }

    // Algorithmic complexity
    if (desc.includes('o(n)') || desc.includes('linear')) {
      components['good_complexity'] = 0.2;
    }
    if (desc.includes('o(n²)') || desc.includes('quadratic')) {
      if (context.codeLength && context.codeLength < 1000) {
        components['acceptable_complexity'] = 0;
      } else {
        components['poor_complexity'] = -0.2;
      }
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: LearningDomain.EFFICIENCY,
      value: success ? Math.max(value, 0.1) : value,
      confidence: 0.7,
      components,
      reasoning: `Efficiency outcome: ${description.substring(0, 50)}...`,
    };
  }

  /**
   * Calculate creativity reward signal
   */
  private calculateCreativityReward(
    context: RewardContext,
    description: string,
    success: boolean
  ): RewardSignal | null {
    const components: Record<string, number> = {};
    const desc = description.toLowerCase();

    // Novel approaches
    if (desc.includes('creative') || desc.includes('novel') || desc.includes('innovative')) {
      components['novel_approach'] = 0.4;
    }

    // Unique solution
    if (desc.includes('unique') || desc.includes('original')) {
      components['original'] = 0.3;
    }

    // Elegant solution
    if (desc.includes('elegant') || desc.includes('clever')) {
      components['elegant'] = 0.3;
    }

    // Risk-taking that paid off
    if (success && desc.includes('ambitious')) {
      components['successful_risk'] = 0.3;
    }

    if (Object.keys(components).length === 0) {
      return null;
    }

    const value = Math.max(-1, Math.min(1, Object.values(components).reduce((a, b) => a + b, 0)));

    return {
      domain: LearningDomain.CREATIVITY,
      value: success ? Math.max(value, 0.2) : value * 0.5,
      confidence: 0.5,
      components,
      reasoning: `Creativity outcome: ${description.substring(0, 50)}...`,
    };
  }

  /**
   * Build causal chain showing how attempts led to outcome
   */
  private buildCausalChain(attemptId: string, relatedAttempts: string[]): string[] {
    const chain = [...relatedAttempts, attemptId];

    // Store for analysis
    if (!this.causalChains.some((c) => c.length === chain.length && c[c.length - 1] === attemptId)) {
      this.causalChains.push(chain);
    }

    return chain;
  }

  /**
   * Update reward metrics
   */
  private updateRewardMetrics(rewards: RewardSignal[]): void {
    if (rewards.length === 0) return;

    const avgReward = rewards.reduce((sum, r) => sum + r.value * r.confidence, 0) / rewards.length;

    const total = this.metrics.totalOutcomes;
    const currentAvg = this.metrics.avgRewardSignal;

    this.metrics.avgRewardSignal = (currentAvg * (total - 1) + avgReward) / total;
  }

  /**
   * Store an outcome record
   */
  private storeOutcome(attemptId: string, outcome: OutcomeRecord): void {
    if (!this.outcomes.has(attemptId)) {
      this.outcomes.set(attemptId, []);
    }
    this.outcomes.get(attemptId)!.push(outcome);
  }

  /**
   * Get all outcomes for an attempt
   */
  getOutcomesForAttempt(attemptId: string): OutcomeRecord[] {
    return this.outcomes.get(attemptId) || [];
  }

  /**
   * Get aggregate reward for an attempt
   */
  getAggregateReward(attemptId: string, domain?: LearningDomain): number {
    const outcomes = this.getOutcomesForAttempt(attemptId);

    if (outcomes.length === 0) return 0;

    const rewards: number[] = [];
    for (const outcome of outcomes) {
      for (const reward of outcome.rewards) {
        if (!domain || reward.domain === domain) {
          rewards.push(reward.value * reward.confidence);
        }
      }
    }

    if (rewards.length === 0) return 0;

    return rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
  }

  /**
   * Get overall success rate
   */
  getSuccessRate(attemptType?: string): number {
    let total = 0;
    let successes = 0;

    for (const outcomes of this.outcomes.values()) {
      for (const outcome of outcomes) {
        // Filter by type if specified
        if (attemptType) {
          const outcomeType = outcome.metadata.context as RewardContext;
          if (outcomeType?.attemptType !== attemptType) continue;
        }

        total += 1;
        if (outcome.success) successes += 1;
      }
    }

    return total > 0 ? successes / total : 0;
  }

  /**
   * Analyze the quality of an attempt based on its outcomes
   */
  analyzeAttemptQuality(attemptId: string): QualityAnalysis {
    const outcomes = this.getOutcomesForAttempt(attemptId);

    if (outcomes.length === 0) {
      return {
        qualityScore: 0,
        confidence: 0,
        successRate: 0,
        domainScores: {},
        totalOutcomes: 0,
        reasoning: 'No outcomes available',
      };
    }

    // Aggregate rewards by domain
    const domainScores: Record<string, number> = {};
    for (const outcome of outcomes) {
      for (const reward of outcome.rewards) {
        const domain = reward.domain;
        if (!domainScores[domain]) {
          domainScores[domain] = [];
        }
        domainScores[domain].push(reward.value * reward.confidence);
      }
    }

    // Calculate average per domain
    for (const domain in domainScores) {
      const scores = domainScores[domain];
      domainScores[domain] = scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    // Overall quality score
    const avgDomainScore = Object.values(domainScores);
    const qualityScore =
      avgDomainScore.length > 0
        ? avgDomainScore.reduce((a, b) => a + b, 0) / avgDomainScore.length
        : 0;

    // Success factor
    const successCount = outcomes.filter((o) => o.success).length;
    const successRate = successCount / outcomes.length;

    // Weighted quality (success matters more)
    const weightedQuality = qualityScore * 0.7 + (successRate * 2 - 1) * 0.3;

    // Confidence based on number of outcomes
    const confidence = Math.min(outcomes.length / 3, 1);

    return {
      qualityScore: weightedQuality,
      confidence,
      successRate,
      domainScores,
      totalOutcomes: outcomes.length,
      reasoning: `Based on ${outcomes.length} outcomes across ${Object.keys(domainScores).length} domains`,
    };
  }

  /**
   * Get outcome tracking statistics
   */
  getStatistics(): OutcomeMetrics & {
    successRateOverall: number;
    successRateByDomain: Record<string, number>;
    outcomeDistribution: {
      immediate: number;
      shortTerm: number;
      longTerm: number;
    };
    causalChainStats: {
      totalChains: number;
      avgChainLength: number;
      maxChainLength: number;
    };
  } {
    const successRateOverall = this.getSuccessRate();

    // Success rate by domain
    const successRateByDomain: Record<string, number> = {};
    for (const domain of Object.values(LearningDomain)) {
      successRateByDomain[domain] = this.getSuccessRate(domain);
    }

    // Outcome distribution
    const total = this.metrics.totalOutcomes;
    const outcomeDistribution = {
      immediate: total > 0 ? this.metrics.immediateOutcomes / total : 0,
      shortTerm: total > 0 ? this.metrics.shortTermOutcomes / total : 0,
      longTerm: total > 0 ? this.metrics.longTermOutcomes / total : 0,
    };

    // Causal chain stats
    const causalChainStats = {
      totalChains: this.causalChains.length,
      avgChainLength:
        this.causalChains.length > 0
          ? this.causalChains.reduce((sum, chain) => sum + chain.length, 0) /
            this.causalChains.length
          : 0,
      maxChainLength:
        this.causalChains.length > 0
          ? Math.max(...this.causalChains.map((c) => c.length))
          : 0,
    };

    return {
      ...this.metrics,
      successRateOverall,
      successRateByDomain,
      outcomeDistribution,
      causalChainStats,
    };
  }

  /**
   * Get state for persistence
   */
  getState(): {
    outcomes: Record<string, OutcomeRecord[]>;
    causalChains: string[][];
    metrics: OutcomeMetrics;
  } {
    const outcomesObj: Record<string, OutcomeRecord[]> = {};
    for (const [id, records] of this.outcomes.entries()) {
      outcomesObj[id] = records;
    }

    return {
      outcomes: outcomesObj,
      causalChains: this.causalChains,
      metrics: this.metrics,
    };
  }

  /**
   * Restore state from persistence
   */
  restoreState(state: {
    outcomes: Record<string, OutcomeRecord[]>;
    causalChains: string[][];
    metrics: OutcomeMetrics;
  }): void {
    this.outcomes = new Map(Object.entries(state.outcomes));
    this.causalChains = state.causalChains;
    this.metrics = state.metrics;
  }
}

/**
 * Type for pending outcome data
 */
interface PendingOutcomeData {
  attemptId: string;
  context: RewardContext;
  timestamp: number;
}

/**
 * Outcome metrics structure
 */
interface OutcomeMetrics {
  totalOutcomes: number;
  immediateOutcomes: number;
  shortTermOutcomes: number;
  longTermOutcomes: number;
  avgRewardSignal: number;
  correlationTimeMs: number;
}

/**
 * Singleton instance for global use
 */
let globalOutcomeTracker: OutcomeTracker | null = null;

export function getOutcomeTracker(): OutcomeTracker {
  if (!globalOutcomeTracker) {
    globalOutcomeTracker = new OutcomeTracker();
  }
  return globalOutcomeTracker;
}

export function resetOutcomeTracker(): void {
  globalOutcomeTracker = null;
}
