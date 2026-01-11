/**
 * StudyLoG.AI Memory System - Type Definitions
 *
 * A 6-tier hierarchical memory system inspired by cognitive science:
 * 1. Working Memory (0-1 hr) - Current context, LLM context window
 * 2. Episodic Memory (1-6 hr) - "What/When/Where" learning events
 * 3. Semantic Memory (1+ wk) - Patterns, facts, concepts learned
 * 4. Procedural Memory - Skills: coding, problem-solving
 * 5. Reflection Memory - Metacognition, learning strategies
 * 6. Identity Memory - Core traits, persistent self-model
 *
 * Based on research from: https://github.com/SuperInstance/hierarchical-memory
 */

// ============================================================================
// Memory Tier Enumerations
// ============================================================================

/**
 * The six memory tiers in the hierarchical system
 */
export enum MemoryTier {
  WORKING = 'working',           // 0-1 hr: Current cognitive workspace
  EPISODIC = 'episodic',         // 1-6 hr: Autobiographical events
  SEMANTIC = 'semantic',         // 1+ wk: Concepts and facts
  PROCEDURAL = 'procedural',     // Skills and abilities
  REFLECTION = 'reflection',     // Metacognitive insights
  IDENTITY = 'identity'          // Core traits and self-model
}

/**
 * Consolidation pathway from source to target tier
 */
export interface ConsolidationPath {
  from: MemoryTier;
  to: MemoryTier;
  trigger: ConsolidationTrigger;
}

/**
 * What triggers memory consolidation
 */
export enum ConsolidationTrigger {
  TIME_BASED = 'time_based',           // Periodic consolidation
  IMPORTANCE_THRESHOLD = 'importance', // Importance-based
  SURPRISE_DETECTED = 'surprise',      // Novel information
  SLEEP_SIMULATION = 'sleep',          // Sleep consolidation
  USER_REQUESTED = 'user',             // Manual consolidation
  PATTERN_COMPLETION = 'pattern'       // Clustered patterns ready
}

/**
 * Memory importance levels (affects retention and consolidation)
 */
export enum MemoryImportance {
  FORGOTTEN = 1.0,        // Below threshold, will be forgotten
  ROUTINE = 3.0,          // Common occurrences, low priority
  NOTABLE = 6.0,          // Worth remembering
  SIGNIFICANT = 8.0,      // Important events
  CORE_IDENTITY = 10.0    // Defines who the student is
}

/**
 * Mastery levels for procedural memory skills
 */
export enum MasteryLevel {
  NOVICE = 1,        // First exposure, needs guidance
  APPRENTICE = 2,    // Can do with help
  COMPETENT = 3,     // Independent execution
  PROFICIENT = 4,    // Skilled, efficient
  EXPERT = 5,        // Deep understanding
  MASTER = 6         // Can teach others
}

/**
 * Retrieval modes for searching memories
 */
export enum RetrievalMode {
  SEMANTIC = 'semantic',       // Similarity-based search
  TEMPORAL = 'temporal',       // Time range queries
  SPATIAL = 'spatial',         // Location/context-based
  CONTEXTUAL = 'contextual',   // Key-value context match
  ASSOCIATIVE = 'associative', // Graph traversal
  HYBRID = 'hybrid',           // Combine multiple modes
  EPISODIC_QUERY = 'episodic', // Event-specific queries
  PROCEDURAL_CHECK = 'procedural' // Skill verification
}

/**
 * Temporal landmark types for memory organization
 */
export enum TemporalLandmarkType {
  FIRST_TIME = 'first_time',           // Novel experience
  PEAK_EXPERIENCE = 'peak',            // High emotional valence
  MILESTONE = 'milestone',             // Major achievement
  TRANSITION = 'transition',           // State change
  BREAKTHROUGH = 'breakthrough',       // Sudden understanding
  SETBACK = 'setback',                 // Learning failure
  SOCIAL_CONNECTION = 'social',        // Interactive learning
  CROSS_PRODUCT = 'cross_product'      // Transfer between StudyLoG/DMLoG
}

/**
 * Emotional valence range for memory tagging
 */
export type EmotionalValence = number; // -1.0 (negative) to +1.0 (positive)

/**
 * Memory access tracking for decay calculations
 */
export interface AccessRecord {
  timestamp: number;
  context?: string;
  successful: boolean;
}

// ============================================================================
// Core Memory Types
// ============================================================================

/**
 * Base memory interface - all memories extend this
 */
export interface BaseMemory {
  id: string;
  tier: MemoryTier;
  content: string;
  importance: MemoryImportance;
  createdAt: number;
  updatedAt: number;
  lastAccessed: number;
  accessCount: number;
  tags: string[];
  embedding?: number[];
  metadata: Record<string, unknown>;
}

/**
 * Working memory item - short-term cognitive workspace
 */
export interface WorkingMemoryItem extends BaseMemory {
  tier: MemoryTier.WORKING;
  decayed: boolean;
  decayDuration: number;  // milliseconds until decay
  originalImportance: MemoryImportance;
}

/**
 * Episodic memory - autobiographical learning events
 */
export interface EpisodicMemory extends BaseMemory {
  tier: MemoryTier.EPISODIC;
  timestamp: number;
  location?: string;
  emotionalValence: EmotionalValence;
  participants?: string[];
  context: EpisodicContext;
  consolidated: boolean;
  relatedEventIds: string[];
}

/**
 * Context information for episodic memories
 */
export interface EpisodicContext {
  module?: 'cognitive-mill' | 'intelligence-ranch' | 'sitka-sound' | 'dmlog';
  lesson?: string;
  topic?: string;
  difficulty?: number;
  timeSpent?: number;
  success?: boolean;
  hintsUsed?: number;
  attemptNumber?: number;
}

/**
 * Semantic memory - concepts and general knowledge
 */
export interface SemanticMemory extends BaseMemory {
  tier: MemoryTier.SEMANTIC;
  conceptName: string;
  attributes: Record<string, unknown>;
  associations: Set<string>;
  parentConcepts: string[];
  childConcepts: string[];
  confidence: number;      // 0-1, how well-established
  abstractionLevel: number; // 0 (concrete) to 1 (abstract)
  sourceEventIds: string[]; // Which episodic memories created this
}

/**
 * Procedural memory - skills and abilities
 */
export interface ProceduralMemory extends BaseMemory {
  tier: MemoryTier.PROCEDURAL;
  skillName: string;
  category: string;
  masteryLevel: MasteryLevel;
  practiceCount: number;
  successCount: number;
  lastPracticed: number;
  prerequisiteSkills: string[];
  dependentSkills: string[];
  practiceHistory: PracticeRecord[];
  improvementCurve: number[];  // Mastery over time
}

/**
 * Record of a skill practice session
 */
export interface PracticeRecord {
  timestamp: number;
  success: boolean;
  quality: number;      // 0-1, performance quality
  timeSpent: number;
  context: string;
  improvement: number;
}

/**
 * Reflection memory - metacognitive insights
 */
export interface ReflectionMemory extends BaseMemory {
  tier: MemoryTier.REFLECTION;
  reflectionType: ReflectionType;
  subject: string;      // What is being reflected upon
  insight: string;      // The key insight
  strategy?: string;    // Learning strategy identified
  effectiveness: number; // 0-1, how well this worked
  applicableContexts: string[];
}

/**
 * Types of reflections
 */
export enum ReflectionType {
  LEARNING_STRATEGY = 'learning_strategy',     // How I learn best
  MISCONCEPTION_CORRECTED = 'misconception',   // What I got wrong
  PATTERN_RECOGNIZED = 'pattern',              // Connection made
  EFFICIENCY_GAIN = 'efficiency',              // Faster way found
  BLOCKER_IDENTIFIED = 'blocker',              // What stopped progress
  MOTIVATION_SHIFT = 'motivation',             // Why I care/don't care
  COLLABORATION_STYLE = 'collaboration'        // How I work with others
}

/**
 * Identity memory - core traits and self-model
 */
export interface IdentityMemory extends BaseMemory {
  tier: MemoryTier.IDENTITY;
  traitType: IdentityTraitType;
  value: string | number | boolean;
  confidence: number;    // 0-1, how certain
  stability: number;     // 0-1, how likely to change
  sourceEvidence: string[]; // What memories support this
}

/**
 * Types of identity traits
 */
export enum IdentityTraitType {
  LEARNING_PREFERENCE = 'learning_preference',  // Visual, auditory, etc.
  PACING_PREFERENCE = 'pacing',                 // Fast, moderate, slow
  CHALLENGE_TOLERANCE = 'challenge_tolerance',  // Risk-seeking vs -averse
  SOCIAL_ORIENTATION = 'social',               // Solo vs collaborative
  PERSISTENCE = 'persistence',                 // Grit factor
  CURIOSITY_DRIVER = 'curiosity',              // What sparks interest
  STRESS_RESPONSE = 'stress',                  // Under pressure behavior
  GOAL_ORIENTATION = 'goal'                    // Mastery vs performance
}

// ============================================================================
// Temporal Landmarks
// ============================================================================

/**
 * A temporal landmark - a memorable moment that organizes memory
 */
export interface TemporalLandmark {
  id: string;
  type: TemporalLandmarkType;
  memoryId: string;
  timestamp: number;
  description: string;
  significance: number;    // 0-1, how memorable
  relatedLandmarks: string[];
  narrativeImpact: number; // How it affects the student's story
}

/**
 * A cluster of related temporal landmarks forming a chapter
 */
export interface NarrativeChapter {
  id: string;
  title: string;
  startDate: number;
  endDate: number;
  landmarks: string[];
  theme: string;
  growth: number;         // 0-1, progress made
  summary: string;
}

// ============================================================================
// Consolidation Types
// ============================================================================

/**
 * An item in the consolidation queue
 */
export interface ConsolidationQueueItem {
  id: string;
  sourceTier: MemoryTier;
  targetTier: MemoryTier;
  memoryId: string;
  priority: number;
  trigger: ConsolidationTrigger;
  timestamp: number;
}

/**
 * Result of a consolidation operation
 */
export interface ConsolidationResult {
  success: boolean;
  itemsConsolidated: number;
  newMemoriesCreated: number[];
  errors: string[];
  duration: number;
}

/**
 * Pattern detected across multiple memories
 */
export interface DetectedPattern {
  id: string;
  name: string;
  frequency: number;
  confidence: number;
  sourceMemoryIds: string[];
  extractedConcept?: string;
  temporalPattern?: TemporalPattern;
}

/**
 * Temporal pattern in memory occurrences
 */
export interface TemporalPattern {
  interval: number;      // Average time between occurrences
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality?: number;  // Cyclical pattern duration
}

// ============================================================================
// Retrieval Types
// ============================================================================

/**
 * Query for memory retrieval
 */
export interface MemoryQuery {
  query: string;
  mode: RetrievalMode;
  tier?: MemoryTier;
  topK?: number;
  threshold?: number;
  startTime?: number;
  endTime?: number;
  contextKey?: string;
  contextValue?: unknown;
  minImportance?: MemoryImportance;
  emotionalRange?: [EmotionalValence, EmotionalValence];
  weights?: RetrievalWeights;
}

/**
 * Weights for hybrid retrieval scoring
 */
export interface RetrievalWeights {
  semantic?: number;
  temporal?: number;
  contextual?: number;
  associative?: number;
  importance?: number;
}

/**
 * Result from memory retrieval
 */
export interface MemoryResult {
  memory: BaseMemory;
  score: number;
  relevance: string;
  tier: MemoryTier;
  distance?: number;  // For vector similarity
}

/**
 * Associative search result with traversal info
 */
export interface AssociativeResult extends MemoryResult {
  depth: number;
  path: string[];  // IDs traversed to reach this memory
}

// ============================================================================
// Forgetting Curve Types
// ============================================================================

/**
 * A point on the forgetting curve
 */
export interface ForgettingCurvePoint {
  time: number;      // Time since learning
  retention: number; // Probability of recall (0-1)
  strength: number;  // Memory strength
}

/**
 * Forgetting curve for a specific concept/skill
 */
export interface ForgettingCurve {
  memoryId: string;
  curve: ForgettingCurvePoint[];
  halflife: number;  // Time to 50% retention
  decayRate: number;
  lastCalculated: number;
}

/**
 * Scheduled review for spaced repetition
 */
export interface ScheduledReview {
  id: string;
  memoryId: string;
  scheduledFor: number;
  interval: number;    // Current spacing interval
  easeFactor: number;  // How quickly this is forgotten
  reviewCount: number;
  lastReview?: number;
  lastReviewQuality?: number;
}

/**
 * Recommendation for review scheduling
 */
export interface ReviewRecommendation {
  memoryId: string;
  urgency: number;     // 0-1, how soon to review
  recommendedInterval: number;
  reason: string;
  currentRetention: number;
}

// ============================================================================
// Learning Analytics Types
// ============================================================================

/**
 * A learning milestone or achievement
 */
export interface LearningMilestone {
  id: string;
  studentId: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  achievedAt: number;
  relatedMemories: string[];
  xpReward: number;
  badgeId?: string;
  shareable: boolean;
}

/**
 * Categories of learning milestones
 */
export enum MilestoneCategory {
  FIRST_EXPOSURE = 'first_exposure',
  SKILL_ACQUIRED = 'skill_acquired',
  CONCEPT_MASTERY = 'concept_mastery',
  BREAKTHROUGH = 'breakthrough',
  PERSISTENCE = 'persistence',
  EXPLORATION = 'exploration',
  COLLABORATION = 'collaboration',
  CREATION = 'creation',
  TEACHING = 'teaching',
  CROSS_DOMAIN = 'cross_domain'
}

/**
 * Learning session analytics
 */
export interface SessionAnalytics {
  sessionId: string;
  studentId: string;
  startTime: number;
  endTime: number;
  module: string;
  memoriesCreated: number;
  memoriesConsolidated: number;
  skillsPracticed: string[];
  conceptsLearned: string[];
  emotionalCurve: EmotionalDataPoint[];
  focusScore: number;
  progressMade: number;
}

/**
 * Emotional state at a point in time
 */
export interface EmotionalDataPoint {
  timestamp: number;
  valence: EmotionalValence;
  arousal: number;  // 0-1, activation level
  context: string;
}

/**
 * Long-term learning analytics
 */
export interface LearningAnalytics {
  studentId: string;
  totalStudyTime: number;
  totalMemories: number;
  skillsLearned: number;
  conceptsMastered: number;
  averageSessionLength: number;
  streakDays: number;
  strongestSkills: string[];
  growthAreas: string[];
  retentionRate: number;
  forgettingCurve: ForgettingCurvePoint[];
}

// ============================================================================
// Autobiographical Narrative Types
// ============================================================================

/**
 * The student's autobiographical narrative
 */
export interface AutobiographicalNarrative {
  studentId: string;
  version: number;
  lastUpdated: number;
  chapters: NarrativeChapter[];
  currentChapter: string;
  overallArc: NarrativeArc;
  selfDescription: string;
  growthHighlights: string[];
  challenges: string[];
  aspirations: string[];
}

/**
 * Types of narrative arcs
 */
export enum NarrativeArc {
  HERO_JOURNEY = 'hero_journey',           // Classic growth story
  EXPLORATION = 'exploration',             // Discovering new territories
  MASTERY = 'mastery',                     // Deep skill development
  TRANSFORMATION = 'transformation',       // Fundamental change
  COMMUNITY_BUILDING = 'community',        // Growing with others
  CREATIVE_EXPRESSION = 'creative'         // Making new things
}

/**
 * A memory cluster for narrative construction
 */
export interface MemoryCluster {
  id: string;
  theme: string;
  memories: string[];
  timeRange: [number, number];
  emotionalArc: EmotionalDataPoint[];
  narrativeRole: string;
}

// ============================================================================
// Memory System Configuration
// ============================================================================

/**
 * Configuration for the entire memory system
 */
export interface MemorySystemConfig {
  // Working memory
  workingCapacity: number;
  workingDecayDuration: number;
  workingHalfLife: number;

  // Episodic memory
  episodicCapacity: number;
  episodicDecayEnabled: boolean;

  // Semantic memory
  semanticEmbeddingDim: number;
  semanticSimilarityThreshold: number;

  // Procedural memory
  proceduralDecayRate: number;
  proceduralMasteryDecay: boolean;

  // Consolidation
  consolidationInterval: number;
  consolidationBatchSize: number;
  surpriseThreshold: number;
  importanceConsolidationThreshold: number;

  // Retrieval
  defaultTopK: number;
  hybridWeights: RetrievalWeights;

  // Forgetting curve
  defaultHalflife: number;
  reviewScheduleAlgorithm: 'sm2' | 'leitner' | 'custom';

  // Storage
  persistToD1: boolean;
  persistToKV: boolean;
  persistToVectorize: boolean;
}

/**
 * Default memory system configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemorySystemConfig = {
  workingCapacity: 20,
  workingDecayDuration: 30 * 60 * 1000, // 30 minutes
  workingHalfLife: 15 * 60 * 1000,     // 15 minutes

  episodicCapacity: 1000,
  episodicDecayEnabled: true,

  semanticEmbeddingDim: 384,
  semanticSimilarityThreshold: 0.7,

  proceduralDecayRate: 0.05, // 5% per day
  proceduralMasteryDecay: true,

  consolidationInterval: 24 * 60 * 60 * 1000, // 24 hours
  consolidationBatchSize: 10,
  surpriseThreshold: 0.5,
  importanceConsolidationThreshold: 0.7,

  defaultTopK: 10,
  hybridWeights: {
    semantic: 0.4,
    temporal: 0.2,
    contextual: 0.2,
    associative: 0.2,
    importance: 0.1
  },

  defaultHalflife: 7 * 24 * 60 * 60 * 1000, // 7 days
  reviewScheduleAlgorithm: 'sm2',

  persistToD1: true,
  persistToKV: true,
  persistToVectorize: true
};

// ============================================================================
// Cross-Product Memory Sharing (StudyLoG <-> DMLoG)
// ============================================================================

/**
 * Memory that can be shared across products
 */
export interface SharedMemory {
  id: string;
  sourceProduct: 'studylog' | 'dmlog' | 'makerlog' | 'other';
  targetProducts: string[];
  memory: BaseMemory;
  shareReason: string;
  timestamp: number;
}

/**
 * Sharing trust matrix for multi-agent systems
 */
export interface TrustMatrix {
  agentId: string;
  trusts: Record<string, number>; // agent -> trust score (0-1)
  lastUpdated: number;
}

/**
 * Conflict resolution for shared memories
 */
export interface MemoryConflict {
  memoryId: string;
  source1: SharedMemory;
  source2: SharedMemory;
  conflictType: 'importance' | 'content' | 'timestamp' | 'metadata';
  resolution: ConflictResolution;
}

/**
 * How to resolve memory conflicts
 */
export enum ConflictResolution {
  KEEP_HIGHEST_IMPORTANCE = 'highest_importance',
  KEEP_MOST_RECENT = 'most_recent',
  MERGE = 'merge',
  KEEP_SOURCE = 'source_preference',
  MANUAL = 'manual'
}

// ============================================================================
// Memory System Events
// ============================================================================

/**
 * Events emitted by the memory system
 */
export type MemorySystemEvent =
  | MemoryCreatedEvent
  | MemoryAccessedEvent
  | MemoryConsolidatedEvent
  | MemoryForgottenEvent
  | LandmarkDetectedEvent
  | MilestoneAchievedEvent
  | ReviewScheduledEvent
  | ReflectionAddedEvent;

export interface MemoryCreatedEvent {
  type: 'memory_created';
  memoryId: string;
  tier: MemoryTier;
  timestamp: number;
}

export interface MemoryAccessedEvent {
  type: 'memory_accessed';
  memoryId: string;
  tier: MemoryTier;
  accessCount: number;
  timestamp: number;
}

export interface MemoryConsolidatedEvent {
  type: 'memory_consolidated';
  fromTier: MemoryTier;
  toTier: MemoryTier;
  sourceMemoryId: string;
  newMemoryIds: string[];
  timestamp: number;
}

export interface MemoryForgottenEvent {
  type: 'memory_forgotten';
  memoryId: string;
  tier: MemoryTier;
  reason: string;
  timestamp: number;
}

export interface LandmarkDetectedEvent {
  type: 'landmark_detected';
  landmarkId: string;
  landmarkType: TemporalLandmarkType;
  memoryId: string;
  significance: number;
  timestamp: number;
}

export interface MilestoneAchievedEvent {
  type: 'milestone_achieved';
  milestoneId: string;
  studentId: string;
  title: string;
  timestamp: number;
}

export interface ReviewScheduledEvent {
  type: 'review_scheduled';
  reviewId: string;
  memoryId: string;
  scheduledFor: number;
  interval: number;
  timestamp: number;
}

export interface ReflectionAddedEvent {
  type: 'reflection_added';
  reflectionId: string;
  reflectionType: ReflectionType;
  subject: string;
  timestamp: number;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handler for memory system events
 */
export type MemoryEventHandler = (event: MemorySystemEvent) => void | Promise<void>;

/**
 * Event listener configuration
 */
export interface EventListener {
  eventType: MemorySystemEvent['type'];
  handler: MemoryEventHandler;
  filter?: (event: MemorySystemEvent) => boolean;
}

// ============================================================================
// Storage Interfaces
// ============================================================================

/**
 * Storage backend interface for memory persistence
 */
export interface MemoryStorage {
  get(id: string): Promise<BaseMemory | null>;
  put(memory: BaseMemory): Promise<void>;
  delete(id: string): Promise<void>;
  query(query: MemoryQuery): Promise<BaseMemory[]>;
  getByTier(tier: MemoryTier): Promise<BaseMemory[]>;
  getTagged(tags: string[]): Promise<BaseMemory[]>;
}

/**
 * Vector storage interface for semantic search
 */
export interface VectorStorage {
  insert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>;
  search(vector: number[], topK: number, threshold?: number): Promise<Array<{ id: string; score: number }>>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<number[] | null>;
}

/**
 * KV storage interface for cache and quick access
 */
export interface KVStorage {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Memory with tier-specific data
 */
export type Memory = WorkingMemoryItem | EpisodicMemory | SemanticMemory | ProceduralMemory | ReflectionMemory | IdentityMemory;

/**
 * Type guard for checking memory tier
 */
export function isWorkingMemory(memory: BaseMemory): memory is WorkingMemoryItem {
  return memory.tier === MemoryTier.WORKING;
}

export function isEpisodicMemory(memory: BaseMemory): memory is EpisodicMemory {
  return memory.tier === MemoryTier.EPISODIC;
}

export function isSemanticMemory(memory: BaseMemory): memory is SemanticMemory {
  return memory.tier === MemoryTier.SEMANTIC;
}

export function isProceduralMemory(memory: BaseMemory): memory is ProceduralMemory {
  return memory.tier === MemoryTier.PROCEDURAL;
}

export function isReflectionMemory(memory: BaseMemory): memory is ReflectionMemory {
  return memory.tier === MemoryTier.REFLECTION;
}

export function isIdentityMemory(memory: BaseMemory): memory is IdentityMemory {
  return memory.tier === MemoryTier.IDENTITY;
}

/**
 * Get tier-specific data from memory
 */
export function getTierData(memory: BaseMemory): Record<string, unknown> {
  switch (memory.tier) {
    case MemoryTier.WORKING:
      return {
        decayed: (memory as WorkingMemoryItem).decayed,
        decayDuration: (memory as WorkingMemoryItem).decayDuration
      };
    case MemoryTier.EPISODIC:
      return {
        location: (memory as EpisodicMemory).location,
        emotionalValence: (memory as EpisodicMemory).emotionalValence,
        context: (memory as EpisodicMemory).context
      };
    case MemoryTier.SEMANTIC:
      return {
        conceptName: (memory as SemanticMemory).conceptName,
        associations: Array.from((memory as SemanticMemory).associations),
        confidence: (memory as SemanticMemory).confidence
      };
    case MemoryTier.PROCEDURAL:
      return {
        skillName: (memory as ProceduralMemory).skillName,
        masteryLevel: (memory as ProceduralMemory).masteryLevel,
        practiceCount: (memory as ProceduralMemory).practiceCount
      };
    case MemoryTier.REFLECTION:
      return {
        reflectionType: (memory as ReflectionMemory).reflectionType,
        insight: (memory as ReflectionMemory).insight,
        effectiveness: (memory as ReflectionMemory).effectiveness
      };
    case MemoryTier.IDENTITY:
      return {
        traitType: (memory as IdentityMemory).traitType,
        value: (memory as IdentityMemory).value,
        confidence: (memory as IdentityMemory).confidence
      };
    default:
      return {};
  }
}
