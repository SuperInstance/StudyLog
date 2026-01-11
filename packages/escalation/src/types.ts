/**
 * StudyLoG.AI - Escalation Engine Types
 *
 * Based on https://github.com/SuperInstance/escalation-engine
 * Adapted for StudyLoG.AI educational platform
 */

/**
 * Decision source - where the decision/response comes from
 * - BOT: Rule-based, deterministic, free (fast <10ms)
 * - BRAIN: Local LLM (Ollama), low cost (~100-500ms)
 * - HUMAN: Cloud API (Anthropic/OpenAI), higher cost (~500-2000ms)
 */
export enum DecisionSource {
  BOT = 'bot',
  BRAIN = 'brain',
  HUMAN = 'human',
  OVERRIDE = 'override',
}

/**
 * Reason for escalation to a higher tier
 */
export enum EscalationReason {
  LOW_CONFIDENCE = 'low_confidence',
  HIGH_STAKES = 'high_stakes',
  NOVEL_SITUATION = 'novel_situation',
  TIME_CRITICAL = 'time_critical',
  CONFLICTING_BOTS = 'conflicting_bots',
  SAFETY_CONCERN = 'safety_concern',
  CHARACTER_GROWTH = 'character_growth',
  PLAYER_REQUEST = 'player_request',
  COST_LIMIT = 'cost_limit',
  STUDENT_STUCK = 'student_stuck',
  NEW_CONCEPT = 'new_concept',
}

/**
 * Escalation thresholds for decision routing
 * These can be customized per student, learning phase, or situation type
 */
export interface EscalationThresholds {
  /** Below this confidence, escalate from bot to brain */
  botMinConfidence: number;
  /** Below this confidence, escalate from brain to human */
  brainMinConfidence: number;
  /** Above this stakes level = high stakes */
  highStakesThreshold: number;
  /** Above this stakes level = critical (always human) */
  criticalStakesThreshold: number;
  /** Below this time = urgent (use faster source) */
  urgentTimeMs: number;
  /** Below this time = critical (may override to bot if critical) */
  criticalTimeMs: number;
  /** Above this novelty score = novel situation */
  noveltyThreshold: number;
  /** Below this resource ratio = critical (safety concern) */
  resourceCriticalThreshold: number;
  /** Confidence boost per success (learning rate) */
  confidenceBoostPerSuccess: number;
  /** Confidence penalty per failure (learning rate) */
  confidencePenaltyPerFailure: number;
}

/**
 * Default escalation thresholds
 */
export const DEFAULT_THRESHOLDS: EscalationThresholds = {
  botMinConfidence: 0.7,
  brainMinConfidence: 0.5,
  highStakesThreshold: 0.7,
  criticalStakesThreshold: 0.9,
  urgentTimeMs: 500,
  criticalTimeMs: 100,
  noveltyThreshold: 0.6,
  resourceCriticalThreshold: 0.2,
  confidenceBoostPerSuccess: 0.05,
  confidencePenaltyPerFailure: 0.1,
};

/**
 * Decision context - all information needed to route a decision
 */
export interface DecisionContext {
  /** Student/user ID */
  studentId: string;
  /** Type of situation (e.g., 'coding', 'quiz', 'tutorial', 'debugging') */
  situationType: string;
  /** Free-form description of the situation */
  situationDescription: string;
  /** Importance level (0=trivial, 1=critical) */
  stakes: number;
  /** Time available for decision (ms) */
  urgencyMs?: number;
  /** Student's current progress/skill ratio (0-1) */
  progressRatio: number;
  /** Available resources (hints, tokens, etc.) */
  availableResources: Record<string, number>;
  /** Number of similar situations seen */
  similarDecisionsCount: number;
  /** Number of recent failures */
  recentFailures: number;
  /** Current learning phase */
  currentPhase: LearningPhase;
  /** Optional metadata */
  customData?: Record<string, unknown>;
  /** Timestamp */
  timestamp?: number;
}

/**
 * Learning phases in StudyLoG.AI
 */
export type LearningPhase = 'cognitive-mill' | 'intelligence-ranch' | 'sitka-sound';

/**
 * Escalation decision result
 */
export interface EscalationDecision {
  /** Which source should handle this */
  source: DecisionSource;
  /** Why this routing was chosen */
  reason?: EscalationReason;
  /** Minimum confidence required */
  confidenceRequired: number;
  /** Time budget for decision */
  timeBudgetMs?: number;
  /** Whether fallback is allowed */
  allowFallback: boolean;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Result of a routed/processed decision
 */
export interface DecisionResult {
  /** Unique decision ID */
  decisionId: string;
  /** Which source handled this */
  source: DecisionSource;
  /** Action/response taken */
  action: string;
  /** Confidence in the decision (0-1) */
  confidence: number;
  /** Time taken (ms) */
  timeTakenMs: number;
  /** Escalated from lower tier */
  escalatedFrom?: DecisionSource;
  /** Reason for escalation */
  escalationReason?: EscalationReason;
  /** Whether outcome was successful */
  success?: boolean;
  /** Estimated cost (USD) */
  costEstimate: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Cost tracking configuration
 */
export interface CostTrackingConfig {
  /** Enable cost tracking */
  enabled: boolean;
  /** Daily budget per student (USD) */
  dailyBudget: number;
  /** Alert threshold (USD) */
  alertThreshold: number;
  /** Cost per bot decision */
  costBot: number;
  /** Cost per brain decision (local LLM) */
  costBrain: number;
  /** Cost per human decision (cloud API) */
  costHuman: number;
}

/**
 * Default cost tracking configuration
 */
export const DEFAULT_COST_CONFIG: CostTrackingConfig = {
  enabled: true,
  dailyBudget: 1.0,
  alertThreshold: 0.8,
  costBot: 0.0,
  costBrain: 0.001,
  costHuman: 0.02,
};

/**
 * Statistics for decisions
 */
export interface DecisionStats {
  totalDecisions: number;
  botDecisions: number;
  brainDecisions: number;
  humanDecisions: number;
  escalations: number;
  escalationRate: number;
  avgConfidence: number;
  totalCost: number;
  costSavings: number;
  costReductionRatio: number;
}

/**
 * Per-student decision statistics
 */
export interface StudentStats {
  studentId: string;
  totalDecisions: number;
  botDecisions: number;
  brainDecisions: number;
  humanDecisions: number;
  escalations: number;
  escalationRate: number;
  successes: number;
  failures: number;
  successRate: number;
  avgConfidence: number;
  avgTimeMs: number;
  totalCost: number;
}

/**
 * Situation pattern for novelty detection
 */
export interface SituationPattern {
  situationType: string;
  patterns: string[];
  lastSeen: number;
}
