/**
 * StudyLoG.AI Memory System - Main API
 *
 * A comprehensive 6-tier hierarchical memory system for educational AI.
 *
 * @module memory-system
 *
 * Architecture:
 * 1. Working Memory (0-1 hr) - Current context, LLM context window
 * 2. Episodic Memory (1-6 hr) - "What/When/Where" learning events
 * 3. Semantic Memory (1+ wk) - Patterns, facts, concepts learned
 * 4. Procedural Memory - Skills: coding, problem-solving
 * 5. Reflection Memory - Metacognition, learning strategies
 * 6. Identity Memory - Core traits, persistent self-model
 *
 * Features:
 * - Temporal landmark detection
 * - Memory consolidation triggers
 * - Cross-session persistence
 * - Learning analytics
 * - Forgetting curve optimization
 * - Spaced repetition scheduling
 * - Autobiographical narrative generation
 *
 * @example
 * ```typescript
 * import { createMemorySystem } from '@studylog/memory-system';
 *
 * const memory = createMemorySystem({
 *   workingCapacity: 20,
 *   episodicCapacity: 1000
 * });
 *
 * // Add episodic memory
 * memory.episodic.add('epi_1', 'Learned about neural networks', {
 *   module: 'cognitive-mill',
 *   topic: 'deep-learning'
 * });
 *
 * // Search memories
 * const results = memory.retrieval.semantic('neural networks');
 * ```
 */

// ============================================================================
// Core Exports
// ============================================================================

export * from './types.js';

// Memory hierarchy
export {
  HierarchicalMemory,
  WorkingMemory,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemoryStore,
  IdentityMemoryStore
} from './memory-hierarchy.js';

// Consolidation
export {
  ConsolidationPipeline,
  clusterByOverlap,
  extractCommonWords,
  extractPatternName,
  wordOverlap
} from './consolidation.js';

// Temporal landmarks
export {
  TemporalLandmarkManager,
  generateTimelineData,
  generateEmotionalArc
} from './temporal-landmarks.js';

// Autobiographical narrative
export {
  NarrativeGenerator,
  generateNarrativeOpening,
  generateChapterNarrative,
  generateFullNarrativeDocument
} from './autobiographical.js';

// Learning events and milestones
export {
  MilestoneManager,
  SessionTracker,
  LearningAnalyticsEngine,
  BUILT_IN_MILESTONES,
  calculateStreak
} from './learning-events.js';

// Memory retrieval
export {
  MemoryRetrieval,
  fuzzySearch,
  fusionSearch,
  diversifiedSearch,
  RetrievalStatsTracker
} from './memory-retrieval.js';

// Forgetting curve and spaced repetition
export {
  ForgettingCurveCalculator,
  SpacedRepetitionScheduler,
  ReviewRecommender,
  RetentionAnalytics
} from './forgetting-curve.js';

// ============================================================================
// Factory Functions
// ============================================================================

import { HierarchicalMemory } from './memory-hierarchy.js';
import { TemporalLandmarkManager } from './temporal-landmarks.js';
import { ConsolidationPipeline } from './consolidation.js';
import { MemoryRetrieval } from './memory-retrieval.js';
import { ForgettingCurveCalculator, SpacedRepetitionScheduler, ReviewRecommender, RetentionAnalytics } from './forgetting-curve.js';
import { NarrativeGenerator } from './autobiographical.js';
import { MilestoneManager, SessionTracker, LearningAnalyticsEngine } from './learning-events.js';
import { MemorySystemConfig, DEFAULT_MEMORY_CONFIG } from './types.js';

/**
 * Factory function to create a complete memory system
 *
 * @param config - Optional configuration overrides
 * @returns A configured memory system instance
 *
 * @example
 * ```typescript
 * const memory = createMemorySystem({
 *   workingCapacity: 20,
 *   episodicCapacity: 1000,
 *   persistToD1: true
 * });
 * ```
 */
export function createMemorySystem(
  config: Partial<MemorySystemConfig> = {}
): MemorySystem {
  const hierarchy = new HierarchicalMemory(config);
  const landmarks = new TemporalLandmarkManager();
  const consolidation = new ConsolidationPipeline(hierarchy);
  const retrieval = new MemoryRetrieval(hierarchy);
  const curveCalculator = new ForgettingCurveCalculator();
  const scheduler = new SpacedRepetitionScheduler(hierarchy);
  const recommender = new ReviewRecommender(hierarchy, curveCalculator, scheduler);
  const analytics = new RetentionAnalytics(hierarchy, curveCalculator);
  const narrative = new NarrativeGenerator('student', hierarchy, landmarks);
  const milestones = new MilestoneManager('student', hierarchy, landmarks);
  const sessions = new SessionTracker(hierarchy);
  const learningAnalytics = new LearningAnalyticsEngine(hierarchy, landmarks, sessions);

  return {
    hierarchy,
    landmarks,
    consolidation,
    retrieval,
    curveCalculator,
    scheduler,
    recommender,
    analytics,
    narrative,
    milestones,
    sessions,
    learningAnalytics,

    // Convenience accessors
    working: hierarchy.working,
    episodic: hierarchy.episodic,
    semantic: hierarchy.semantic,
    procedural: hierarchy.procedural,
    reflection: hierarchy.reflection,
    identity: hierarchy.identity,

    // Config
    config: hierarchy.getConfig(),

    // Stats
    getStats: () => hierarchy.getStats(),

    // Search
    search: (query: string) => retrieval.semantic(query),

    // Consolidate
    consolidate: (tier?: string) => {
      if (tier) {
        return consolidation.consolidate(tier as any);
      }
      return consolidation.consolidateAll();
    },

    // Clear
    clear: () => {
      hierarchy.working.clear();
      // Note: We don't clear other tiers as they contain long-term memories
    }
  };
}

/**
 * Create a minimal memory system for testing/light usage
 */
export function createMinimalMemorySystem(): MemorySystem {
  return createMemorySystem({
    workingCapacity: 10,
    episodicCapacity: 100,
    persistToD1: false,
    persistToKV: false,
    persistToVectorize: false
  });
}

// ============================================================================
// Main Memory System Interface
// ============================================================================

/**
 * The complete memory system interface
 *
 * Combines all memory components into a single API
 */
export interface MemorySystem {
  // Core hierarchy
  hierarchy: HierarchicalMemory;

  // Components
  landmarks: TemporalLandmarkManager;
  consolidation: ConsolidationPipeline;
  retrieval: MemoryRetrieval;
  curveCalculator: ForgettingCurveCalculator;
  scheduler: SpacedRepetitionScheduler;
  recommender: ReviewRecommender;
  analytics: RetentionAnalytics;
  narrative: NarrativeGenerator;
  milestones: MilestoneManager;
  sessions: SessionTracker;
  learningAnalytics: LearningAnalyticsEngine;

  // Convenience accessors
  working: HierarchicalMemory['working'];
  episodic: HierarchicalMemory['episodic'];
  semantic: HierarchicalMemory['semantic'];
  procedural: HierarchicalMemory['procedural'];
  reflection: HierarchicalMemory['reflection'];
  identity: HierarchicalMemory['identity'];

  // Configuration
  config: MemorySystemConfig;

  // Utility methods
  getStats: () => ReturnType<HierarchicalMemory['getStats']>;
  search: (query: string) => ReturnType<MemoryRetrieval['semantic']>;
  consolidate: (tier?: string) => Promise<any>;
  clear: () => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a memory system for a specific student
 */
export function createStudentMemorySystem(
  studentId: string,
  config?: Partial<MemorySystemConfig>
): StudentMemorySystem {
  const base = createMemorySystem(config);

  return {
    ...base,
    studentId,

    // Student-specific operations
    getNarrative: () => base.narrative.generateNarrative(),
    getAnalytics: () => base.learningAnalytics.generateAnalytics(studentId),
    getMilestones: () => base.milestones.getAchievedMilestones(),
    checkNewMilestones: () => base.milestones.checkMilestones(),

    // Session tracking
    startSession: (module: string) => {
      const sessionId = `session_${studentId}_${Date.now()}`;
      return base.sessions.startSession(sessionId, studentId, module);
    },

    // Persistence
    export: () => exportStudentData(studentId, base),
    import: (data: any) => importStudentData(studentId, base, data)
  };
}

/**
 * Export student memory data for persistence
 */
export function exportStudentData(
  studentId: string,
  system: MemorySystem
): StudentMemoryData {
  return {
    studentId,
    version: 1,
    exportedAt: Date.now(),

    // Memories
    episodic: system.hierarchy.episodic.getAll(),
    semantic: system.hierarchy.semantic.getAll(),
    procedural: system.hierarchy.procedural.getAll(),
    reflection: system.hierarchy.reflection.getAll(),
    identity: system.hierarchy.identity.getAll(),

    // Landmarks
    landmarks: system.landmarks.export(),

    // Reviews
    reviews: Array.from((system as any).scheduler._reviews || []),

    // Config
    config: system.config
  };
}

/**
 * Import student memory data from persistence
 */
export function importStudentData(
  studentId: string,
  system: MemorySystem,
  data: StudentMemoryData
): void {
  // Import landmarks
  if (data.landmarks) {
    system.landmarks.import(data.landmarks);
  }

  // Import episodic memories
  for (const memory of data.episodic || []) {
    system.episodic.add(
      memory.id,
      memory.content,
      memory.context,
      {
        importance: memory.importance,
        emotionalValence: memory.emotionalValence,
        location: memory.location,
        participants: memory.participants,
        tags: memory.tags,
        metadata: memory.metadata
      }
    );
  }

  // Import semantic concepts
  for (const concept of data.semantic || []) {
    system.semantic.addConcept(
      concept.id,
      concept.conceptName,
      concept.attributes,
      {
        embedding: concept.embedding,
        confidence: concept.confidence,
        abstractionLevel: concept.abstractionLevel,
        sourceEventIds: concept.sourceEventIds,
        tags: concept.tags
      }
    );
  }

  // Import skills
  for (const skill of data.procedural || []) {
    system.procedural.addSkill(
      skill.id,
      skill.skillName,
      skill.category,
      {
        prerequisites: skill.prerequisiteSkills,
        tags: skill.tags,
        metadata: skill.metadata
      }
    );
  }

  // More imports can be added here...
}

// ============================================================================
// Type Exports for External Use
// ============================================================================

export interface StudentMemorySystem extends MemorySystem {
  studentId: string;
  getNarrative: () => Promise<ReturnType<NarrativeGenerator['generateNarrative']>>;
  getAnalytics: () => ReturnType<LearningAnalyticsEngine['generateAnalytics']>;
  getMilestones: () => ReturnType<MilestoneManager['getAchievedMilestones']>;
  checkNewMilestones: () => ReturnType<MilestoneManager['checkMilestones']>;
  startSession: (module: string) => ReturnType<SessionTracker['startSession']>;
  export: () => StudentMemoryData;
  import: (data: StudentMemoryData) => void;
}

export interface StudentMemoryData {
  studentId: string;
  version: number;
  exportedAt: number;
  episodic: any[];
  semantic: any[];
  procedural: any[];
  reflection: any[];
  identity: any[];
  landmarks: any;
  reviews: any[];
  config: MemorySystemConfig;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = DEFAULT_MEMORY_CONFIG;

/**
 * Memory tier names
 */
export const MEMORY_TIERS = {
  WORKING: 'working',
  EPISODIC: 'episodic',
  SEMANTIC: 'semantic',
  PROCEDURAL: 'procedural',
  REFLECTION: 'reflection',
  IDENTITY: 'identity'
} as const;

/**
 * Mastery levels
 */
export const MASTERY_LEVELS = {
  NOVICE: 1,
  APPRENTICE: 2,
  COMPETENT: 3,
  PROFICIENT: 4,
  EXPERT: 5,
  MASTER: 6
} as const;

/**
 * Memory importance levels
 */
export const IMPORTANCE_LEVELS = {
  FORGOTTEN: 1.0,
  ROUTINE: 3.0,
  NOTABLE: 6.0,
  SIGNIFICANT: 8.0,
  CORE_IDENTITY: 10.0
} as const;
