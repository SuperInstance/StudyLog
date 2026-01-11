/**
 * Cross-Product Memory Sharing System - Type Definitions
 *
 * A comprehensive system for transferring memories between StudyLoG.AI and DMLoG.AI
 * so learnings transfer between products seamlessly.
 *
 * Core Concept: A student learns problem-solving in StudyLoG.AI -> Their DMLoG.AI
 * character applies those patterns as investigation skills.
 *
 * Transfer Examples:
 * - StudyLoG "debugging" -> DMLoG "investigation"
 * - StudyLoG "collaboration" -> DMLoG "party coordination"
 * - StudyLoG "persistence" -> DMLoG "constitution"
 * - StudyLoG "creativity" -> DMLoG "improvisation"
 *
 * Inverse Transfer:
 * - DMLoG "tactics" -> StudyLoG "algorithmic thinking"
 * - DMLoG "roleplay" -> StudyLoG "empathy"
 * - DMLoG "world-building" -> StudyLoG "system design"
 */

// ============================================================================
// Product Identifiers
// ============================================================================

/**
 * SuperInstance.AI products that can share memories
 */
export enum Product {
  STUDYLOG = 'studylog',           // AI/STEM education
  DMLOG = 'dmlog',                 // TTRPG with AI agents
  MAKERLOG = 'makerlog',           // IoT/Robotics, 3D printing
  FISHINGLOG = 'fishinglog',       // Ecological simulation
  ACTIVELOG = 'activelog',         // Fitness gamification
  REALLOG = 'reallog',             // Content creation tools
  PLAYERLOG = 'playerlog',         // Pure gaming experiences
}

/**
 * Product display names
 */
export const PRODUCT_NAMES: Record<Product, string> = {
  [Product.STUDYLOG]: 'StudyLoG.AI',
  [Product.DMLOG]: 'DMLoG.AI',
  [Product.MAKERLOG]: 'MakerLoG.AI',
  [Product.FISHINGLOG]: 'FishingLoG.AI',
  [Product.ACTIVELOG]: 'ActiveLoG.AI',
  [Product.REALLOG]: 'RealLoG.AI',
  [Product.PLAYERLOG]: 'PlayerLoG.AI',
};

// ============================================================================
// Memory Transfer Types
// ============================================================================

/**
 * Direction of memory transfer
 */
export enum TransferDirection {
  STUDYLOG_TO_DMLOG = 'studylog_to_dmlog',
  DMLOG_TO_STUDYLOG = 'dmlog_to_studylog',
  BIDIRECTIONAL = 'bidirectional',
  STUDYLOG_TO_MAKERLOG = 'studylog_to_makerlog',
  MAKERLOG_TO_STUDYLOG = 'makerlog_to_studylog',
  DMLOG_TO_MAKERLOG = 'dmlog_to_makerlog',
  MAKERLOG_TO_DMLOG = 'makerlog_to_dmlog',
}

/**
 * Categories of skills/abilities that can transfer
 */
export enum TransferCategory {
  // Cognitive skills
  PROBLEM_SOLVING = 'problem_solving',
  CRITICAL_THINKING = 'critical_thinking',
  CREATIVITY = 'creativity',
  PATTERN_RECOGNITION = 'pattern_recognition',
  SYSTEMS_THINKING = 'systems_thinking',
  ALGORITHMIC_THINKING = 'algorithmic_thinking',

  // Social skills
  COLLABORATION = 'collaboration',
  COMMUNICATION = 'communication',
  EMPATHY = 'empathy',
  LEADERSHIP = 'leadership',
  NEGOTIATION = 'negotiation',

  // Personal attributes
  PERSISTENCE = 'persistence',
  CURIOSITY = 'curiosity',
  ADAPTABILITY = 'adaptability',
  RESILIENCE = 'resilience',
  FOCUS = 'focus',

  // Domain-specific
  TECHNICAL_KNOWLEDGE = 'technical_knowledge',
  RESEARCH_SKILLS = 'research_skills',
  DESIGN_THINKING = 'design_thinking',
  STRATEGIC_PLANNING = 'strategic_planning',
}

/**
 * Memory tier from source system
 */
export enum MemoryTier {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  REFLECTION = 'reflection',
  IDENTITY = 'identity',
}

/**
 * Transfer confidence level
 */
export enum TransferConfidence {
  DIRECT = 'direct',           // 1:1 mapping, high confidence
  DERIVED = 'derived',         // Inferred from patterns
  SPECULATIVE = 'speculative', // Low confidence, user confirmation needed
  MANUAL = 'manual',           // User explicitly mapped
}

/**
 * Transfer status
 */
export enum TransferStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  APPLIED = 'applied',
  FAILED = 'failed',
}

// ============================================================================
// Core Transfer Types
// ============================================================================

/**
 * A memory transfer between products
 */
export interface MemoryTransfer {
  /** Unique transfer ID */
  id: string;
  /** Source product */
  sourceProduct: Product;
  /** Target product */
  targetProduct: Product;
  /** Source memory ID */
  sourceMemoryId: string;
  /** Target memory ID (created after application) */
  targetMemoryId?: string;
  /** Transfer category */
  category: TransferCategory;
  /** Original memory content */
  originalContent: string;
  /** Transformed content for target product */
  transformedContent: string;
  /** Transfer direction */
  direction: TransferDirection;
  /** Confidence in this transfer */
  confidence: TransferConfidence;
  /** Confidence score (0-1) */
  confidenceScore: number;
  /** Transfer status */
  status: TransferStatus;
  /** Source memory tier */
  sourceTier: MemoryTier;
  /** Target memory tier */
  targetTier: MemoryTier;
  /** When this transfer was proposed */
  proposedAt: number;
  /** When this transfer was approved */
  approvedAt?: number;
  /** When this transfer was applied */
  appliedAt?: number;
  /** User who approved (if manual approval) */
  approvedBy?: string;
  /** Why this transfer was proposed */
  reason: string;
  /** Evidence supporting this transfer */
  evidence: TransferEvidence[];
  /** Tags for categorization */
  tags: string[];
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Evidence supporting a memory transfer
 */
export interface TransferEvidence {
  /** Type of evidence */
  type: 'pattern_match' | 'semantic_similarity' | 'user_behavior' | 'cross_product_correlation';
  /** Evidence description */
  description: string;
  /** Strength of evidence (0-1) */
  strength: number;
  /** Source of evidence */
  source: string;
  /** Timestamp when evidence was collected */
  timestamp: number;
}

/**
 * A skill mapping between products
 */
export interface SkillMapping {
  /** Mapping ID */
  id: string;
  /** Source product */
  sourceProduct: Product;
  /** Target product */
  targetProduct: Product;
  /** Source skill name */
  sourceSkill: string;
  /** Target skill name */
  targetSkill: string;
  /** Transfer category */
  category: TransferCategory;
  /** How well this maps (0-1) */
  mappingQuality: number;
  /** Whether this is a default mapping or learned */
  isDefault: boolean;
  /** How many times this mapping has been used successfully */
  successCount: number;
  /** How many times this mapping has been rejected */
  rejectionCount: number;
  /** User feedback on this mapping */
  feedback?: string;
  /** When this mapping was created */
  createdAt: number;
  /** When this mapping was last used */
  lastUsedAt?: number;
  /** When this mapping was last updated */
  lastUpdatedAt: number;
}

/**
 * A pattern that can be recognized across products
 */
export interface CrossProductPattern {
  /** Pattern ID */
  id: string;
  /** Pattern name */
  name: string;
  /** Description */
  description: string;
  /** Products where this pattern appears */
  products: Product[];
  /** Transfer category */
  category: TransferCategory;
  /** Pattern manifestations per product */
  manifestations: Record<Product, PatternManifestation>;
  /** How many times this pattern has been recognized */
  recognitionCount: number;
  /** Pattern strength (0-1, increases with recognitions) */
  strength: number;
  /** Related patterns */
  relatedPatterns: string[];
  /** Tags */
  tags: string[];
  /** Created at */
  createdAt: number;
  /** Last updated */
  lastUpdatedAt: number;
}

/**
 * How a pattern manifests in a specific product
 */
export interface PatternManifestation {
  /** Product-specific name */
  name: string;
  /** Product-specific description */
  description: string;
  /** Product-specific indicators */
  indicators: string[];
  /** Example scenarios */
  examples: string[];
  /** Related skills/abilities */
  relatedSkills: string[];
}

/**
 * Transfer rule governing when transfers occur
 */
export interface TransferRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Source product */
  sourceProduct: Product;
  /** Target product */
  targetProduct: Product;
  /** Transfer direction */
  direction: TransferDirection;
  /** Categories this rule applies to */
  categories: TransferCategory[];
  /** Minimum confidence for auto-approval */
  minConfidenceForAuto: number;
  /** Whether this rule is active */
  active: boolean;
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Conditions for this rule to apply */
  conditions: TransferCondition[];
  /** Actions to take when rule applies */
  actions: TransferAction[];
  /** Created at */
  createdAt: number;
  /** Last updated */
  lastUpdatedAt: number;
}

/**
 * Condition for a transfer rule
 */
export interface TransferCondition {
  /** Condition type */
  type: 'importance_threshold' | 'category_match' | 'tier_match' | 'time_window' | 'user_permission';
  /** Condition value */
  value: unknown;
  /** Whether this is a negation (NOT condition) */
  negate?: boolean;
}

/**
 * Action for a transfer rule
 */
export interface TransferAction {
  /** Action type */
  type: 'auto_approve' | 'require_approval' | 'transform' | 'reject' | 'defer';
  /** Action parameters */
  params?: Record<string, unknown>;
}

// ============================================================================
// Unified Identity Types
// ============================================================================

/**
 * Unified user identity across products
 */
export interface UnifiedIdentity {
  /** Unified ID (shared across products) */
  unifiedId: string;
  /** Product-specific identities */
  productIdentities: ProductIdentity[];
  /** Unified traits (cross-product) */
  traits: UnifiedTrait[];
  /** Cross-product skills */
  skills: UnifiedSkill[];
  /** Transfer history */
  transferHistory: string[]; // Transfer IDs
  /** Preferences */
  preferences: IdentityPreferences;
  /** Created at */
  createdAt: number;
  /** Last updated */
  lastUpdatedAt: number;
  /** Version for conflict resolution */
  version: number;
}

/**
 * Product-specific identity
 */
export interface ProductIdentity {
  /** Product */
  product: Product;
  /** Product-specific user ID */
  userId: string;
  /** Display name in this product */
  displayName: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Product-specific attributes */
  attributes: Record<string, unknown>;
  /** When this identity was linked */
  linkedAt: number;
  /** Last active timestamp */
  lastActiveAt: number;
}

/**
 * A trait that persists across products
 */
export interface UnifiedTrait {
  /** Trait ID */
  id: string;
  /** Trait name */
  name: string;
  /** Transfer category */
  category: TransferCategory;
  /** Trait value (normalized 0-1) */
  value: number;
  /** Confidence in this trait value (0-1) */
  confidence: number;
  /** How stable this trait is (0-1, higher = less likely to change) */
  stability: number;
  /** Which products contribute to this trait */
  sources: Product[];
  /** Evidence supporting this trait */
  evidence: string[];
  /** Last updated */
  lastUpdatedAt: number;
}

/**
 * A skill that exists across products
 */
export interface UnifiedSkill {
  /** Skill ID */
  id: string;
  /** Skill name */
  name: string;
  /** Transfer category */
  category: TransferCategory;
  /** Overall skill level (0-1) */
  level: number;
  /** Product-specific skill levels */
  productLevels: Record<Product, ProductSkillLevel>;
  /** Related skills */
  relatedSkills: string[];
  /** Prerequisite skills */
  prerequisites: string[];
  /** Skills that depend on this one */
  dependents: string[];
  /** Practice history across products */
  practiceHistory: SkillPracticeEvent[];
  /** Last updated */
  lastUpdatedAt: number;
}

/**
 * Skill level in a specific product
 */
export interface ProductSkillLevel {
  /** Level in this product (0-1) */
  level: number;
  /** How many times practiced in this product */
  practiceCount: number;
  /** Last practiced in this product */
  lastPracticed: number;
  /** Product-specific display name */
  displayName: string;
}

/**
 * A practice event for a skill
 */
export interface SkillPracticeEvent {
  /** Product where practiced */
  product: Product;
  /** When practiced */
  timestamp: number;
  /** Success level (0-1) */
  success: number;
  /** Context of practice */
  context: string;
  /** Time spent practicing (ms) */
  timeSpent: number;
  /** Improvement amount (-1 to 1) */
  improvement: number;
}

/**
 * Identity preferences for cross-product behavior
 */
export interface IdentityPreferences {
  /** Whether auto-approve transfers is enabled */
  autoApprove: boolean;
  /** Minimum confidence for auto-approval */
  autoApproveThreshold: number;
  /** Which products sync with which */
  syncMatrix: SyncMatrix;
  /** Notification preferences */
  notifications: NotificationPreferences;
  /** Privacy settings */
  privacy: PrivacyPreferences;
}

/**
 * Sync matrix for product synchronization
 */
export interface SyncMatrix {
  /** Source product -> Target products that sync */
  [key: string]: {
    /** Target product -> Whether sync is enabled */
    [key: string]: boolean;
  };
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
  /** Notify on new transfer proposals */
  notifyOnProposal: boolean;
  /** Notify on auto-approved transfers */
  notifyOnAutoApprove: boolean;
  /** Notify on rejected transfers */
  notifyOnReject: boolean;
  /** Notify on applied transfers */
  notifyOnApplied: boolean;
  /** Daily summary of transfers */
  dailySummary: boolean;
}

/**
 * Privacy preferences
 */
export interface PrivacyPreferences {
  /** What data can be shared */
  shareableData: ShareableDataType[];
  /** Minimum anonymity level */
  minAnonymity: 'none' | 'basic' | 'enhanced' | 'full';
  /** Allow cross-product analytics */
  allowAnalytics: boolean;
  /** Data retention period (ms, 0 = forever) */
  retentionPeriod: number;
}

/**
 * Types of data that can be shared
 */
export enum ShareableDataType {
  SKILLS = 'skills',
  TRAITS = 'traits',
  EPISODIC_MEMORIES = 'episodic_memories',
  SEMANTIC_CONCEPTS = 'semantic_concepts',
  REFLECTIONS = 'reflections',
  PATTERNS = 'patterns',
  ACHIEVEMENTS = 'achievements',
}

// ============================================================================
// Learning Analytics Types
// ============================================================================

/**
 * Cross-product learning analytics
 */
export interface CrossProductAnalytics {
  /** Unified user ID */
  unifiedId: string;
  /** Analytics period start */
  periodStart: number;
  /** Analytics period end */
  periodEnd: number;
  /** Overall growth metrics */
  growth: GrowthMetrics;
  /** Per-product breakdown */
  productBreakdown: ProductBreakdown[];
  /** Transfer statistics */
  transferStats: TransferStatistics;
  /** Skill synthesis data */
  skillSynthesis: SkillSynthesisReport;
  /** Recommendations */
  recommendations: AnalyticsRecommendation[];
  /** Generated at */
  generatedAt: number;
}

/**
 * Growth metrics across products
 */
export interface GrowthMetrics {
  /** Overall skill growth (0-1) */
  overallGrowth: number;
  /** Strongest transfer categories */
  strongestCategories: TransferCategory[];
  /** Areas needing attention */
  attentionAreas: TransferCategory[];
  /** Cross-product synergy score (0-1) */
  synergyScore: number;
  /** Learning velocity (skills per week) */
  learningVelocity: number;
  /** Retention rate (0-1) */
  retentionRate: number;
}

/**
 * Breakdown by product
 */
export interface ProductBreakdown {
  /** Product */
  product: Product;
  /** Time spent in product (ms) */
  timeSpent: number;
  /** Skills learned in product */
  skillsLearned: number;
  /** Skills transferred from product */
  skillsTransferredOut: number;
  /** Skills transferred to product */
  skillsTransferredIn: number;
  /** Active sessions */
  activeSessions: number;
  /** Engagement score (0-1) */
  engagementScore: number;
}

/**
 * Transfer statistics
 */
export interface TransferStatistics {
  /** Total transfers proposed */
  totalProposed: number;
  /** Total transfers approved */
  totalApproved: number;
  /** Total transfers rejected */
  totalRejected: number;
  /** Total transfers applied */
  totalApplied: number;
  /** Approval rate (0-1) */
  approvalRate: number;
  /** By category */
  byCategory: Record<TransferCategory, number>;
  /** By direction */
  byDirection: Record<TransferDirection, number>;
  /** Average confidence score (0-1) */
  avgConfidence: number;
  /** Success rate of applied transfers (0-1) */
  successRate: number;
}

/**
 * Skill synthesis report
 */
export interface SkillSynthesisReport {
  /** Skills that have been synthesized from multiple sources */
  synthesizedSkills: SynthesizedSkill[];
  /** Skills that are candidates for synthesis */
  candidates: SynthesisCandidate[];
  /** Skills that were rejected for synthesis */
  rejected: SynthesisRejection[];
}

/**
 * A skill synthesized from multiple products
 */
export interface SynthesizedSkill {
  /** Skill ID */
  id: string;
  /** Skill name */
  name: string;
  /** Source products */
  sources: Product[];
  /** Component skills that were synthesized */
  components: string[];
  /** Synthesis quality (0-1) */
  quality: number;
  /** Synthesized skill level */
  level: number;
  /** When synthesized */
  synthesizedAt: number;
}

/**
 * A candidate for skill synthesis
 */
export interface SynthesisCandidate {
  /** Candidate ID */
  id: string;
  /** Proposed skill name */
  name: string;
  /** Source products */
  sources: Product[];
  /** Component skills */
  components: string[];
  /** Predicted quality (0-1) */
  predictedQuality: number;
  /** Why not yet synthesized */
  reason: string;
}

/**
 * A rejected synthesis
 */
export interface SynthesisRejection {
  /** Skill name that was rejected */
  name: string;
  /** Source products */
  sources: Product[];
  /** Reason for rejection */
  reason: string;
  /** When rejected */
  rejectedAt: number;
}

/**
 * Analytics recommendation
 */
export interface AnalyticsRecommendation {
  /** Recommendation type */
  type: 'skill_focus' | 'product_explore' | 'transfer_enable' | 'practice_suggest';
  /** Recommendation title */
  title: string;
  /** Recommendation description */
  description: string;
  /** Priority (0-1) */
  priority: number;
  /** Expected impact (0-1) */
  expectedImpact: number;
  /** Actionable steps */
  steps: string[];
  /** Related skills/products */
  related: string[];
}

// ============================================================================
// Transfer Result Types
// ============================================================================

/**
 * Result of a memory transfer operation
 */
export interface TransferResult {
  /** Whether the transfer succeeded */
  success: boolean;
  /** Transfer ID */
  transferId: string;
  /** Number of memories transferred */
  memoriesTransferred: number;
  /** Number of memories transformed */
  memoriesTransformed: number;
  /** Number of memories skipped */
  memoriesSkipped: number;
  /** Conflicts encountered */
  conflicts: TransferConflict[];
  /** Warnings */
  warnings: string[];
  /** Errors */
  errors: string[];
  /** Duration of transfer operation (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * A conflict during transfer
 */
export interface TransferConflict {
  /** Conflict ID */
  id: string;
  /** Conflict type */
  type: 'duplicate' | 'version_mismatch' | 'content_mismatch' | 'permission_denied' | 'rule_violation';
  /** Memory ID in source */
  sourceId: string;
  /** Conflicting memory ID in target */
  targetId?: string;
  /** Description of conflict */
  description: string;
  /** How it was resolved */
  resolution: ConflictResolution;
  /** Resolution details */
  resolutionDetails?: string;
}

/**
 * How conflicts are resolved
 */
export enum ConflictResolution {
  KEEP_SOURCE = 'keep_source',
  KEEP_TARGET = 'keep_target',
  MERGE = 'merge',
  KEEP_NEWEST = 'keep_newest',
  KEEP_HIGHEST_IMPORTANCE = 'keep_highest_importance',
  MANUAL = 'manual',
  SKIP = 'skip',
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch transfer request
 */
export interface BatchTransferRequest {
  /** Request ID */
  id: string;
  /** Unified user ID */
  unifiedId: string;
  /** Source product */
  sourceProduct: Product;
  /** Target product */
  targetProduct: Product;
  /** Transfer direction */
  direction: TransferDirection;
  /** Memory IDs to transfer */
  memoryIds: string[];
  /** Whether to auto-approve eligible transfers */
  autoApprove: boolean;
  /** Custom transformations to apply */
  transformations?: CustomTransformation[];
  /** Created at */
  createdAt: number;
  /** Status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Custom transformation for transfer
 */
export interface CustomTransformation {
  /** Transformation type */
  type: 'content' | 'category' | 'tags' | 'metadata';
  /** Transformation rule */
  rule: string;
  /** Parameters */
  params: Record<string, unknown>;
}

/**
 * Batch transfer result
 */
export interface BatchTransferResult {
  /** Request ID */
  requestId: string;
  /** Individual transfer results */
  results: TransferResult[];
  /** Summary statistics */
  summary: {
    totalRequested: number;
    totalSucceeded: number;
    totalFailed: number;
    totalSkipped: number;
  };
  /** Duration (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Pattern Mapper Types
// ============================================================================

/**
 * Pattern mapping result
 */
export interface PatternMappingResult {
  /** Source pattern */
  sourcePattern: string;
  /** Target pattern */
  targetPattern: string;
  /** Mapping confidence (0-1) */
  confidence: number;
  /** Mapping method used */
  method: MappingMethod;
  /** Alternative mappings with lower confidence */
  alternatives: AlternativeMapping[];
}

/**
 * Methods for pattern mapping
 */
export enum MappingMethod {
  EXACT = 'exact',
  SEMANTIC = 'semantic',
  STRUCTURAL = 'structural',
  LEARNED = 'learned',
  MANUAL = 'manual',
  DERIVED = 'derived',
}

/**
 * Alternative mapping with lower confidence
 */
export interface AlternativeMapping {
  /** Alternative target pattern */
  targetPattern: string;
  /** Confidence score */
  confidence: number;
  /** Why this alternative exists */
  reason: string;
}

// ============================================================================
// Export Groupings
// ============================================================================

/**
 * All memory tier enums
 */
export type MemoryTierEnum = MemoryTier;

/**
 * All transfer enums
 */
export type TransferDirectionEnum = TransferDirection;
export type TransferCategoryEnum = TransferCategory;
export type TransferConfidenceEnum = TransferConfidence;
export type TransferStatusEnum = TransferStatus;

/**
 * All product enums
 */
export type ProductEnum = Product;
