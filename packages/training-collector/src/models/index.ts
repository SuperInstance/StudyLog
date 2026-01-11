/**
 * StudyLoG.AI Training Data Collector - Data Models
 *
 * Based on research from SuperInstance/training-data-collector
 * Adapted for learning context and Theia IDE integration
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Source of a learning decision
 */
export enum DecisionSource {
  RULE_ENGINE = 'rule_engine',     // Automated rules/patterns
  AI_TUTOR = 'ai_tutor',           // LLM-based AI tutor
  STUDENT = 'student',             // Student input/decisions
  HUMAN_TUTOR = 'human_tutor',     // Human expert/teacher
  SYSTEM = 'system',               // System-generated decisions
}

/**
 * Type of learning decision being made
 */
export enum LearningDecisionType {
  // Cognitive Mill (Learning how AI works)
  PROBLEM_SOLVING = 'problem_solving',           // Solving coding/analysis problems
  VISUALIZATION_INTERACTION = 'viz_interaction', // Interacting with visualizations
  CONCEPT_EXPLORATION = 'concept_exploration',   // Explaining AI concepts
  DEBUGGING = 'debugging',                       // Debugging model behavior

  // Intelligence Ranch (Training agents)
  AGENT_CONFIG = 'agent_config',                 // Configuring agent parameters
  TRAINING_DECISION = 'training_decision',       // Training strategy choices
  BREEDING_DECISION = 'breeding_decision',       // Agent breeding selections

  // Sitka Sound (Multi-agent systems)
  INTERACTION = 'interaction',                   // Agent-to-agent interaction
  COALITION = 'coalition',                       // Forming cooperation groups
  COMPETITION = 'competition',                   // Competitive strategies
  NEGOTIATION = 'negotiation',                   // Negotiation behaviors

  // General Learning
  HELP_REQUEST = 'help_request',                 // Student asks for help
  HINT_USAGE = 'hint_usage',                     // Student uses a hint
  ASSESSMENT = 'assessment',                     // Quiz/exam responses
  COLLABORATION = 'collaboration',               // Working with peers
  SIMULATION = 'simulation',                     // Running simulations
  REFLECTION = 'reflection',                     // Student reflection on learning

  // Other
  OTHER = 'other',
}

/**
 * Learning module/stage in StudyLoG.AI
 */
export enum LearningModule {
  COGNITIVE_MILL = 'cognitive_mill',
  INTELLIGENCE_RANCH = 'intelligence_ranch',
  SITKA_SOUND = 'sitka_sound',
  GENERAL = 'general',
}

/**
 * Quality labels for learning moments
 */
export enum QualityLabel {
  EXCELLENT = 'excellent',                     // Exceeds expectations
  GOOD = 'good',                               // Meets expectations
  ACCEPTABLE = 'acceptable',                   // Adequate, room for improvement
  NEEDS_IMPROVEMENT = 'needs_improvement',     // Learning opportunity
  TEACHING_MOMENT = 'teaching_moment',         // Explicitly marked for teaching
  MISCONCEPTION = 'misconception',             // Common misconception to address
}

/**
 * Export format options
 */
export enum ExportFormat {
  JSON = 'json',
  JSONL = 'jsonl',
  PARQUET = 'parquet',
  QLORA = 'qlora',
  CSV = 'csv',
}

/**
 * Learning phase (progressive disclosure)
 */
export enum LearningPhase {
  PLAYER = 'player',       // Toy/Play phase
  READER = 'reader',       // Guide/Read phase
  TWEAKER = 'tweaker',     // Modify/Tweak phase
  CREATOR = 'creator',     // Build/Create phase
  MENTOR = 'mentor',       // Teach/Mentor phase
}

// ============================================================================
// Interfaces - Context Models
// ============================================================================

/**
 * Current learning state for a student
 */
export interface LearningState {
  module: LearningModule;
  stage?: number;
  phase?: LearningPhase;
  lesson?: string;
  exercise?: string;
  progress: number;              // 0-1 overall progress
  lessonProgress: number;        // 0-1 lesson progress
  objectives: string[];
  currentDifficulty: number;     // 0-1
  timeSpentOnLesson: number;     // seconds
  timeSpentOnExercise: number;   // seconds
}

/**
 * Student's current state
 */
export interface StudentState {
  knowledgeLevel: number;        // 0-1 overall knowledge
  engagement: number;            // 0-1 current engagement
  fatigue: number;               // 0-1 fatigue level
  confidence: number;            // 0-1 self-reported confidence
  consecutiveMistakes: number;
  consecutiveSuccesses: number;
  streak: number;                // current answer streak
  skillLevels: Record<string, number>; // per-skill levels
}

/**
 * What the student perceives/has available
 */
export interface PerceptionData {
  visibleHints: string[];
  availableTools: string[];
  peerPresence?: string[];
  nearbyResources?: Resource[];
  availableAssistance?: AssistanceOption[];
}

export interface Resource {
  id: string;
  type: 'document' | 'video' | 'tool' | 'example';
  title: string;
  url?: string;
}

export interface AssistanceOption {
  type: 'hint' | 'example' | 'explanation' | 'solution';
  cost?: number;                 // grain tokens or other cost
  description: string;
}

/**
 * Full context surrounding a learning decision
 */
export interface LearningContext {
  learningState: LearningState;
  studentState: StudentState;
  perceptionData?: PerceptionData;
  additionalContext?: Record<string, unknown>;
}

// ============================================================================
// Interfaces - Decision Models
// ============================================================================

/**
 * A learning decision made by AI or student
 */
export interface LearningDecision {
  decisionType: LearningDecisionType;
  action: string;
  reasoning: string;
  confidence: number;             // 0-1
  source: DecisionSource;
  stakes: number;                 // 0-1 importance
  metadata?: Record<string, unknown>;
  timestamp?: number;             // Unix timestamp
}

/**
 * Rewards from a successful learning outcome
 */
export interface Reward {
  type: 'xp' | 'mastery' | 'badge' | 'unlock' | 'grain' | 'streak';
  value: number | string;
  description?: string;
}

/**
 * Penalties from unsuccessful outcome
 */
export interface Penalty {
  type: 'streak_reset' | 'confidence_loss' | 'grain' | 'hint_unlock';
  value: number | string;
  description?: string;
}

/**
 * The outcome/result of a learning decision
 */
export interface LearningOutcome {
  success: boolean;
  immediate: string;              // Immediate result description
  delayed?: string;               // Delayed/secondary result
  rewards?: Reward[];
  penalties?: Penalty[];
  qualityScore: number;           // 0-1 computed quality
  qualityLabel?: QualityLabel;
  notes?: string;
  timestamp?: number;
  metrics?: OutcomeMetrics;
}

export interface OutcomeMetrics {
  timeTaken?: number;             // milliseconds
  attempts?: number;
  hintsUsed?: number;
  codeQuality?: number;           // 0-1 for code submissions
  correctnessScore?: number;      // 0-1 for assessments
}

// ============================================================================
// Interfaces - Record Models
// ============================================================================

/**
 * Data collection settings per student
 */
export interface StudentDataSettings {
  studentId: string;
  enabled: boolean;
  collectStudentDecisions: boolean;
  collectAITutorDecisions: boolean;
  collectRuleEngineDecisions: boolean;
  collectHumanTutorDecisions: boolean;
  retentionDays: number;
  trainingEligible: boolean;
  anonymizeForTraining: boolean;
}

/**
 * Information about a learning session
 */
export interface SessionInfo {
  sessionId: string;
  startTimestamp: number;
  endTimestamp?: number;
  studentIds: string[];
  totalDecisions: number;
  notes?: string;
  module?: LearningModule;
}

/**
 * Complete record of a learning event with context and outcome
 */
export interface LearningRecord {
  recordId: string;
  studentId: string;
  sessionId: string;
  timestamp: number;
  context: LearningContext;
  decision: LearningDecision;
  outcome?: LearningOutcome;
  trainingEligible: boolean;
  qualityLabel?: QualityLabel;
  reflectionNotes?: string;
}

// ============================================================================
// Interfaces - Export Models
// ============================================================================

/**
 * QLoRA training format record
 */
export interface QLoRARecord {
  instruction: string;
  input: string;
  output: string;
  metadata: Record<string, unknown>;
}

/**
 * Statistics about collected data
 */
export interface CollectionStatistics {
  totalRecords: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  byModule: Record<string, number>;
  successes: number;
  failures: number;
  pendingOutcomes: number;
  successRate: number;
  byQuality: Record<string, number>;
  trainingEligible: number;
  averageConfidence: number;
  averageQuality: number;
  topMistakes: string[];
  topSuccesses: string[];
}

/**
 * Export result information
 */
export interface ExportResult {
  format: ExportFormat;
  outputPath: string;
  recordsExported: number;
  recordsFiltered: number;
  timestamp: number;
}

// ============================================================================
// Interfaces - Events
// ============================================================================

/**
 * Events emitted by the training collector
 */
export type CollectorEvent =
  | { type: 'record_created'; recordId: string; studentId: string }
  | { type: 'outcome_updated'; recordId: string; success: boolean }
  | { type: 'quality_labeled'; recordId: string; label: QualityLabel }
  | { type: 'session_started'; sessionId: string }
  | { type: 'session_ended'; sessionId: string; info: SessionInfo }
  | { type: 'export_completed'; result: ExportResult }
  | { type: 'error'; error: Error; context?: Record<string, unknown> };

/**
 * Event listener type
 */
export type EventListener = (event: CollectorEvent) => void;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid DecisionSource
 */
export function isValidDecisionSource(value: string): value is DecisionSource {
  return Object.values(DecisionSource).includes(value as DecisionSource);
}

/**
 * Check if a value is a valid LearningDecisionType
 */
export function isValidLearningDecisionType(value: string): value is LearningDecisionType {
  return Object.values(LearningDecisionType).includes(value as LearningDecisionType);
}

/**
 * Check if a value is a valid QualityLabel
 */
export function isValidQualityLabel(value: string): value is QualityLabel {
  return Object.values(QualityLabel).includes(value as QualityLabel);
}

/**
 * Check if a value is a valid ExportFormat
 */
export function isValidExportFormat(value: string): value is ExportFormat {
  return Object.values(ExportFormat).includes(value as ExportFormat);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if settings allow logging a decision
 */
export function shouldLogDecision(
  settings: StudentDataSettings,
  source: DecisionSource
): boolean {
  if (!settings.enabled) return false;

  switch (source) {
    case DecisionSource.STUDENT:
      return settings.collectStudentDecisions;
    case DecisionSource.AI_TUTOR:
      return settings.collectAITutorDecisions;
    case DecisionSource.RULE_ENGINE:
      return settings.collectRuleEngineDecisions;
    case DecisionSource.HUMAN_TUTOR:
      return settings.collectHumanTutorDecisions;
    case DecisionSource.SYSTEM:
      return true; // Always log system decisions
  }
}

/**
 * Create a default student data settings object
 */
export function createDefaultSettings(studentId: string): StudentDataSettings {
  return {
    studentId,
    enabled: true,
    collectStudentDecisions: true,
    collectAITutorDecisions: true,
    collectRuleEngineDecisions: true,
    collectHumanTutorDecisions: true,
    retentionDays: 90,
    trainingEligible: true,
    anonymizeForTraining: true,
  };
}

/**
 * Compute quality score from outcome metrics
 */
export function computeQualityScore(metrics: OutcomeMetrics, success: boolean): number {
  if (!success) return 0.3; // Learning opportunity

  let score = 0.5; // Base score for success

  // Time bonus (faster = higher quality, up to a point)
  if (metrics.timeTaken) {
    const optimalTime = 30000; // 30 seconds considered optimal
    if (metrics.timeTaken < optimalTime) {
      score += 0.1;
    } else if (metrics.timeTaken < optimalTime * 2) {
      score += 0.05;
    }
  }

  // Attempt penalty (more attempts = lower quality)
  if (metrics.attempts) {
    score -= Math.min(0.2, (metrics.attempts - 1) * 0.05);
  }

  // Hint penalty (more hints = lower quality)
  if (metrics.hintsUsed) {
    score -= Math.min(0.15, metrics.hintsUsed * 0.05);
  }

  // Code quality bonus
  if (metrics.codeQuality) {
    score += (metrics.codeQuality - 0.5) * 0.2;
  }

  // Correctness bonus
  if (metrics.correctnessScore) {
    score += (metrics.correctnessScore - 0.5) * 0.2;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Determine quality label from quality score
 */
export function getQualityLabelFromScore(score: number, success: boolean): QualityLabel {
  if (!success) return QualityLabel.NEEDS_IMPROVEMENT;
  if (score >= 0.9) return QualityLabel.EXCELLENT;
  if (score >= 0.7) return QualityLabel.GOOD;
  if (score >= 0.5) return QualityLabel.ACCEPTABLE;
  return QualityLabel.NEEDS_IMPROVEMENT;
}

/**
 * Generate a unique record ID
 */
export function generateRecordId(): string {
  return `rec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}
