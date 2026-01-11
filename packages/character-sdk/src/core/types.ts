/**
 * Core Types for StudyLoG.AI Character SDK
 *
 * Adapted from SuperInstance ai-character-sdk patterns
 * with educational-focused extensions for StudyLoG.AI
 */

/**
 * Memory Tiers - 6-tier hierarchical architecture
 * Inspired by cognitive neuroscience and adapted for learning
 */
export enum MemoryTier {
  /** Current attention/context (seconds to minutes) */
  WORKING = "working",
  /** Session buffer (1-6 hours) */
  MID_TERM = "mid_term",
  /** Consolidated storage (1+ weeks) */
  LONG_TERM = "long_term",
  /** Specific events "what-where-when" */
  EPISODIC = "episodic",
  /** Consolidated patterns & facts */
  SEMANTIC = "semantic",
  /** Skills & learned behaviors */
  PROCEDURAL = "procedural"
}

/**
 * Decision Tiers - Cost-effective intelligent routing
 */
export enum DecisionTier {
  /** Fast, deterministic, free (rules-based) */
  BOT = "bot",
  /** Personality-driven, medium cost (local LLM or character logic) */
  BRAIN = "brain",
  /** Critical decisions, higher cost (API LLM) */
  HUMAN = "human"
}

/**
 * Memory Importance Levels
 */
export enum ImportanceLevel {
  /** Low priority - may be forgotten */
  FORGOTTEN = 1.0,
  /** Normal daily memory */
  ROUTINE = 3.0,
  /** Worth remembering */
  NOTABLE = 6.0,
  /** Life-changing */
  SIGNIFICANT = 8.0,
  /** Defines who they are */
  CORE_IDENTITY = 10.0
}

/**
 * Mastery Levels for skills/concepts
 */
export enum MasteryLevel {
  UNKNOWN = "unknown",
  EXPOSED = "exposed",       // Seen but not understood
  LEARNING = "learning",     // Currently working on it
  PRACTICING = "practicing", // Can do with help
  PROFICIENT = "proficient", // Can do independently
  MASTERED = "mastered"      // Can teach others
}

/**
 * Character States
 */
export enum CharacterState {
  IDLE = "idle",
  THINKING = "thinking",
  ACTING = "acting",
  RESTING = "resting",
  INCAPACITATED = "incapacitated",
  LEARNING = "learning",
  TEACHING = "teaching"
}

/**
 * Learning Styles for educational characters
 */
export enum LearningStyle {
  VISUAL = "visual",
  AUDITORY = "auditory",
  KINESTHETIC = "kinesthetic",
  READING = "reading",
  MULTIMODAL = "multimodal"
}

/**
 * Trait Categories for personality system
 */
export enum TraitCategory {
  /** How they interact with others */
  SOCIAL = "social",
  /** How they think and learn */
  INTELLECTUAL = "intellectual",
  /** How they feel and express */
  EMOTIONAL = "emotional",
  /** Their ethical framework */
  MORAL = "moral",
  /** How they act */
  BEHAVIORAL = "behavioral",
  /** StudyLoG.AI: Learning-specific traits */
  LEARNING = "learning"
}

/**
 * Escalation Reasons for decision routing
 */
export enum EscalationReason {
  LOW_CONFIDENCE = "low_confidence",
  HIGH_STAKES = "high_stakes",
  NOVEL_SITUATION = "novel_situation",
  TIME_CRITICAL = "time_critical",
  SAFETY_CONCERN = "safety_concern",
  CHARACTER_GROWTH = "character_growth",
  COST_LIMIT = "cost_limit",
  LEARNING_OPPORTUNITY = "learning_opportunity"
}

/**
 * Outcome Types for learning system
 */
export enum OutcomeType {
  SUCCESS = "success",
  FAILURE = "failure",
  NEUTRAL = "neutral",
  PARTIAL = "partial"
}

/**
 * A single memory unit
 */
export interface Memory {
  /** Unique identifier */
  id: string;
  /** What happened/was learned */
  content: string;
  /** Type tier */
  memoryType: MemoryTier;
  /** When created */
  timestamp: Date;
  /** 1-10 scale */
  importance: number;
  /** -1 (bad) to +1 (good) */
  emotionalValence: number;
  /** Who was involved */
  participants: string[];
  /** Where it happened */
  location: string;
  /** Times retrieved (boosts importance) */
  accessCount: number;
  /** Last accessed */
  lastAccessed: Date | null;
  /** Has it moved to semantic? */
  consolidated: boolean;
  /** Related memory IDs */
  relatedMemoryIds: string[];
  /** Optional embedding for semantic search */
  embedding?: number[];
  /** Optional tags */
  tags?: string[];
}

/**
 * A personality trait
 */
export interface Trait {
  /** Trait name */
  name: string;
  /** 0.0 to 1.0 */
  value: number;
  /** Category */
  category: TraitCategory;
  /** Description */
  description: string;
}

/**
 * Personality profile
 */
export interface PersonalityProfile {
  /** Character class/type */
  characterClass: string;
  /** Visual/behavioral description */
  description: string;
  /** Unique behaviors */
  quirks: string[];
  /** Positive qualities */
  virtues: string[];
  /** Negative qualities */
  vices: string[];
  /** Learning style (StudyLoG.AI) */
  learningStyle?: LearningStyle;
}

/**
 * Context for character thinking/decision
 */
export interface ThoughtContext {
  /** Current situation description */
  situation: string;
  /** 0-1 importance scale */
  stakes: number;
  /** Optional time constraint in ms */
  urgencyMs?: number;
  /** Where this is happening */
  location: string;
  /** Who else is involved */
  participants: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Response from character action
 */
export interface CharacterResponse {
  /** What the character says */
  content: string;
  /** What action they take */
  action: string;
  /** Which tier handled this */
  tier: DecisionTier;
  /** Confidence level */
  confidence: number;
  /** Time taken in ms */
  timeTakenMs: number;
  /** Internal thoughts (optional) */
  thoughts: string;
  /** Emotional state */
  emotions: Record<string, number>;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Configuration for creating a Character
 */
export interface CharacterConfig {
  name: string;
  characterClass: string;
  description: string;
  personality: Record<string, number>;
  backstory: string;
  goals: string[];
  fears: string[];
  quirks: string[];
  /** Path for persistent storage */
  memoryStoragePath?: string | null;
  /** Max working memory items */
  maxWorkingMemories: number;
  /** Threshold for memory consolidation */
  memoryImportanceThreshold: number;
  /** Decision confidence threshold */
  decisionConfidenceThreshold: number;
  /** Enable escalation between tiers */
  enableEscalation: boolean;
  /** Enable learning from outcomes */
  enableLearning: boolean;
  /** Learning rate */
  learningRate: number;
  /** Custom think handler (for LLM integration) */
  onThink?: ThinkHandler | null;
  /** Custom act handler */
  onAct?: ActHandler | null;
}

/**
 * Think handler for LLM integration
 */
export interface ThinkHandler {
  (character: BaseCharacter, situation: string, context: string, highStakes: boolean):
    string | ThinkHandlerResult;
}

export interface ThinkHandlerResult {
  content: string;
  action?: string;
  confidence?: number;
  thoughts?: string;
}

/**
 * Act handler for action execution
 */
export interface ActHandler {
  (character: BaseCharacter, action: string, context: ThoughtContext):
    Promise<ActionResult>;
}

export interface ActionResult {
  success: boolean;
  result: unknown;
  error?: string;
}

/**
 * Base Character interface
 */
export interface BaseCharacter {
  readonly name: string;
  readonly characterClass: string;
  readonly description: string;
  readonly backstory: string;
  readonly goals: string[];
  readonly fears: string[];
  readonly quirks: string[];
  readonly state: CharacterState;
  readonly createdAt: Date;
  interactionCount: number;

  // Core API
  think(situation: string, stakes?: number, urgencyMs?: number, context?: ThoughtContext):
    Promise<CharacterResponse> | CharacterResponse;
  remember(content: string, importance?: number, emotionalValence?: number, memoryType?: MemoryTier):
    Memory;
  recall(query: string, topK?: number): Memory[];
  forget(memoryId: string): boolean;

  // Learning
  learn(outcome: string, success?: boolean, reward?: number, notes?: string): LearningSignal;
  getLearningSummary(): LearningSummary;

  // Personality
  setTrait(trait: string, value: number): void;
  getTrait(trait: string, defaultValue?: number): number;
  modifyTrait(trait: string, delta: number): void;
  getPersonalitySummary(): PersonalitySummary;

  // Persistence
  save(path?: string): Promise<void> | void;
  load(path?: string): Promise<void> | void;
  getStats(): CharacterStats;
}

/**
 * Learning signal from outcome
 */
export interface LearningSignal {
  /** What to adjust (e.g., "trait:bravery", "action:attack") */
  signalType: string;
  /** Amount to adjust */
  delta: number;
  /** How confident we are in this */
  confidence: number;
  /** Why this adjustment */
  reason: string;
}

/**
 * Learning summary statistics
 */
export interface LearningSummary {
  totalOutcomes: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  totalReward: number;
  averageReward: number;
  learningTrend: number;
  adjustmentsMade: number;
  successPatterns: Record<string, number>;
  failurePatterns: Record<string, number>;
}

/**
 * Personality summary
 */
export interface PersonalitySummary {
  traits: Record<string, number>;
  dominantTrait: string | null;
  dominantValue: number | null;
  profile: {
    characterClass: string;
    description: string;
    quirks: string[];
  };
  traitCount: number;
}

/**
 * Character statistics
 */
export interface CharacterStats {
  name: string;
  characterClass: string;
  state: CharacterState;
  createdAt: string;
  interactionCount: number;
  personality: Record<string, number>;
  memory: MemoryStats;
  learning: LearningSummary;
}

/**
 * Memory system statistics
 */
export interface MemoryStats {
  characterId: string;
  totalMemories: number;
  byType: Record<string, number>;
  consolidated: number;
  unconsolidated: number;
  averageImportance: number;
  importanceAccumulator: number;
}

/**
 * Decision context for routing
 */
export interface DecisionContext {
  characterId: string;
  situationType: string;
  situationDescription: string;
  stakes: number;
  urgencyMs: number | null;
  characterHpRatio: number;
  availableResources: Record<string, number>;
  similarDecisionsCount: number;
  recentFailures: number;
  timestamp: number;
  customData: Record<string, unknown>;
}

/**
 * Decision routing result
 */
export interface DecisionRouting {
  tier: DecisionTier;
  reason: EscalationReason | null;
  confidenceRequired: number;
  timeBudgetMs: number | null;
  allowFallback: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Escalation thresholds
 */
export interface EscalationThresholds {
  botMinConfidence: number;
  brainMinConfidence: number;
  highStakesThreshold: number;
  criticalStakesThreshold: number;
  urgentTimeMs: number;
  criticalTimeMs: number;
  noveltyThreshold: number;
  hpCriticalThreshold: number;
}

/**
 * Study-specific memory for StudyLoG.AI
 */
export interface StudyMemory extends Memory {
  /** Subject/domain */
  subject?: string;
  /** Related topic */
  topic?: string;
  /** Difficulty level */
  difficulty?: number;
  /** Mastery level when stored */
  masteryLevel?: MasteryLevel;
  /** Related learning standards */
  standards?: string[];
  /** Prerequisites */
  prerequisites?: string[];
}

/**
 * Learning event for educational tracking
 */
export interface LearningEvent {
  id: string;
  timestamp: Date;
  type: 'lesson' | 'practice' | 'assessment' | 'exploration';
  subject: string;
  topic: string;
  duration: number; // ms
  outcome: OutcomeType;
  masteryBefore: MasteryLevel;
  masteryAfter: MasteryLevel;
  reward: number;
  notes: string;
}

/**
 * Student profile for StudyLoG.AI
 */
export interface StudentProfile extends PersonalityProfile {
  /** Student ID */
  studentId: string;
  /** Grade level */
  gradeLevel?: number;
  /** Primary learning style */
  learningStyle: LearningStyle;
  /** Subjects of interest */
  interests: string[];
  /** Learning goals */
  learningGoals: string[];
  /** Areas of strength */
  strengths: string[];
  /** Areas needing support */
  supportAreas: string[];
  /** Preferred study time */
  studyPreferences?: {
    preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
    sessionLength?: number; // minutes
    breakFrequency?: number; // minutes between breaks
  };
}

/**
 * Lesson response for educational use
 */
export interface LessonResponse extends CharacterResponse {
  /** Learning objectives addressed */
  objectives: string[];
  /** Suggested exercises */
  exercises: Exercise[];
  /** Visualizations available */
  visualizations?: Visualization[];
  /** Next steps */
  nextSteps: string[];
  /** Prerequisites checked */
  prerequisitesMet: boolean;
  /** Missing prerequisites */
  missingPrerequisites: string[];
}

/**
 * Exercise for practice
 */
export interface Exercise {
  id: string;
  type: 'multiple-choice' | 'fill-blank' | 'coding' | 'simulation' | 'discussion';
  question: string;
  options?: string[];
  correctAnswer?: string;
  hint?: string;
  difficulty: number;
  estimatedTime: number; // minutes
  masteryRequired: MasteryLevel;
}

/**
 * Visualization for learning
 */
export interface Visualization {
  type: 'godot-scene' | 'diagram' | 'animation' | 'interactive';
  title: string;
  description: string;
  path?: string;
  parameters?: Record<string, unknown>;
}

/**
 * Practice result
 */
export interface PracticeResult {
  skill: string;
  masteryLevel: MasteryLevel;
  recommendedExercises: Exercise[];
  hints: string[];
  progressToNext: number; // 0-1
}
