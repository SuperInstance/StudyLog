/**
 * Outcome Tracker Type Definitions
 *
 * Multi-domain reward tracking system adapted for StudyLoG.AI
 * Based on https://github.com/SuperInstance/outcome-tracker
 */

/**
 * Outcome types based on temporal relationship to the learning activity
 */
export enum OutcomeType {
  /** Happens immediately after an action (quiz answer, puzzle completion) */
  IMMEDIATE = 'immediate',
  /** Occurs within the same session (5-10 activities later) */
  SHORT_TERM = 'short_term',
  /** Manifests across multiple sessions (long-term retention) */
  LONG_TERM = 'long_term',
  /** Self-assessment and reflection */
  REFLECTIVE = 'reflective'
}

/**
 * Learning domains for reward calculation in StudyLoG.AI
 * Adapted from original game-oriented domains to educational contexts
 */
export enum StudyLogRewardDomain {
  /** Problem-solving, reasoning, cognitive tasks */
  COGNITIVE = 'cognitive',
  /** Peer interaction, helping others, forum participation */
  COLLABORATIVE = 'collaborative',
  /** Exploration, experimentation, discovering new techniques */
  DISCOVERY = 'discovery',
  /** Time efficiency, resource optimization, minimal hints */
  EFFICIENCY = 'efficiency',
  /** Long-term retention, skill transfer, prerequisites met */
  MASTERY = 'mastery',
  /** Novel solutions, remixes, innovative approaches */
  CREATIVE = 'creative'
}

/**
 * Legacy domains from original outcome-tracker for compatibility
 */
export enum RewardDomain {
  COMBAT = 'combat',
  SOCIAL = 'social',
  EXPLORATION = 'exploration',
  RESOURCE = 'resource',
  STRATEGIC = 'strategic'
}

/**
 * A calculated reward signal for an outcome
 */
export interface RewardSignal {
  /** The domain this reward belongs to */
  domain: StudyLogRewardDomain | RewardDomain;
  /** Reward value, normalized to [-1.0, 1.0] */
  value: number;
  /** Confidence in this reward calculation [0.0, 1.0] */
  confidence: number;
  /** Component values that sum to the total */
  components: Record<string, number>;
  /** Human-readable explanation of the reward */
  reasoning: string;
}

/**
 * A record of a learning outcome
 */
export interface OutcomeRecord {
  /** ID of the decision/activity that led to this outcome */
  decisionId: string;
  /** Temporal type of the outcome */
  outcomeType: OutcomeType;
  /** Unix timestamp when the outcome occurred */
  timestamp: number;
  /** Human-readable description of what happened */
  description: string;
  /** Whether the outcome was successful */
  success: boolean;
  /** Reward signals for this outcome */
  rewards: RewardSignal[];
  /** IDs of other decisions related to this outcome */
  relatedDecisions: string[];
  /** Ordered chain of decisions leading to this outcome */
  causalChain: string[];
  /** Additional context and metadata */
  metadata: Record<string, any>;
}

/**
 * Learning activity context for outcome tracking
 */
export interface LearningContext {
  /** Type of learning activity */
  decisionType: string;
  /** Student/user ID */
  userId?: string;
  /** Puzzle or activity ID */
  puzzleId?: string;
  /** Current learning stage */
  stage?: number;
  /** Number of attempts */
  attempts?: number;
  /** Time taken in seconds */
  timeSeconds?: number;
  /** Hints used */
  hintsUsed?: number;
  /** Any additional context */
  [key: string]: any;
}

/**
 * Aggregation result for outcomes
 */
export interface AggregationResult {
  /** The aggregation key (domain name, time window, etc.) */
  key: string;
  /** Number of outcomes in this aggregation */
  count: number;
  /** Number of successful outcomes */
  successCount: number;
  /** Sum of all reward values */
  totalReward: number;
  /** Average reward value */
  avgReward: number;
  /** Reward breakdown by domain */
  domainBreakdown: Record<string, number>;
  /** Additional metadata */
  metadata: Record<string, any>;
}

/**
 * Statistics summary for outcome tracking
 */
export interface OutcomeStatistics {
  totalOutcomes: number;
  immediateOutcomes: number;
  shortTermOutcomes: number;
  longTermOutcomes: number;
  reflectiveOutcomes: number;
  avgRewardSignal: number;
  correlationTimeMs: number;
  successRateOverall: number;
  successRateCognitive: number;
  successRateCollaborative: number;
  successRateDiscovery: number;
  immediatePct: number;
  shortTermPct: number;
  longTermPct: number;
  reflectivePct: number;
  totalCausalChains: number;
  avgChainLength: number;
  maxChainLength: number;
}

/**
 * Decision quality analysis result
 */
export interface DecisionQuality {
  qualityScore: number;
  confidence: number;
  successRate: number;
  domainScores: Record<string, number>;
  totalOutcomes: number;
  reasoning: string;
}

/**
 * Time window for temporal aggregation
 */
export interface TimeWindow {
  start: number;
  end: number;
  label?: string;
}

/**
 * Student progress with outcome tracking
 */
export interface StudentOutcomeProgress {
  userId: string;
  currentStage: number;
  completedPuzzles: string[];
  unlockedFeatures: string[];
  outcomeHistory: OutcomeRecord[];
  domainMastery: Record<StudyLogRewardDomain, number>;
  learningVelocity: number;
  streakData: {
    current: number;
    longest: number;
    lastActivity: number;
  };
}
