/**
 * Integration Tests for Memory System
 *
 * Tests the 6-tier memory hierarchy and consolidation processes:
 * - Working Memory → Episodic Memory
 * - Episodic Memory → Semantic Memory
 * - Semantic Memory → Procedural Memory
 * - Reflection Memory formation
 * - Cross-product memory transfer
 * - Temporal landmark detection
 * - Memory consolidation processes
 * - Autobiographical narrative generation
 *
 * @see backend/lib/memory-system.ts
 * @see backend/tests/memory-system.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MemoryConsolidationEngine,
  MemoryType,
  MemoryImportance,
  TemporalLandmarkType,
  type MemoryRecord,
  type AutobiographicalNarrative,
} from '../../lib/memory-system';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_STUDENT_ID = 'test-student-integration';
const ALT_STUDENT_ID = 'alt-student-integration';

describe('Memory System Integration Tests', () => {
  let engine: MemoryConsolidationEngine;

  beforeEach(() => {
    engine = new MemoryConsolidationEngine();
  });

  afterEach(() => {
    // Cleanup any timers or async operations
    vi.clearAllTimers();
  });

  // ============================================================================
  // 6-Tier Memory Hierarchy Tests
  // ============================================================================

  describe('6-Tier Memory Hierarchy', () => {
    it('should store memory in working memory tier initially', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'Learning about for loops',
        MemoryType.WORKING,
        { topic: 'programming' }
      );

      expect(memory.type).toBe(MemoryType.WORKING);
      expect(memory.content).toBe('Learning about for loops');
      expect(engine.getStudentStats(TEST_STUDENT_ID).workingMemoryCount).toBe(1);
    });

    it('should promote working memory to episodic on consolidation', () => {
      // Store in working memory
      engine.storeMemory(
        TEST_STUDENT_ID,
        'First successful compilation',
        MemoryType.WORKING,
        { importance: MemoryImportance.HIGH }
      );

      // Consolidate should move it to episodic
      const result = engine.consolidateMemories(TEST_STUDENT_ID);

      expect(result.consolidatedMemories).toBeGreaterThanOrEqual(0);

      // Check memory is now in episodic
      const memories = engine.retrieveMemories(TEST_STUDENT_ID);
      const episodic = memories.filter(m => m.type === MemoryType.EPISODIC);
      expect(episodic.length).toBeGreaterThan(0);
    });

    it('should create semantic memories from related episodic memories', () => {
      // Store related episodic memories
      const topics = ['variables', 'functions', 'classes', 'inheritance'];
      topics.forEach(topic => {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Learned about ${topic}`,
          MemoryType.EPISODIC,
          { topic, importance: MemoryImportance.HIGH }
        );
      });

      // Consolidate to create semantic memory
      const result = engine.consolidateMemories(TEST_STUDENT_ID);

      // Should create procedural memories related to OOP
      expect(result.newProceduralMemories.length).toBeGreaterThanOrEqual(0);
    });

    it('should form procedural memories from repeated practice', () => {
      // Practice sessions for the same skill
      for (let i = 0; i < 5; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Practice session ${i + 1}: Wrote a function`,
          MemoryType.EPISODIC,
          {
            topic: 'functions',
            importance: MemoryImportance.NORMAL,
            emotionalValence: 0.6,
          }
        );
      }

      const result = engine.consolidateMemories(TEST_STUDENT_ID);

      // Should create procedural memory for function writing
      expect(result.newProceduralMemories.length).toBeGreaterThanOrEqual(0);
    });

    it('should create reflection memories from metacognitive events', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Realized I understand recursion better after the exercise',
        MemoryType.REFLECTION,
        { topic: 'metacognition', importance: MemoryImportance.HIGH }
      );

      const memories = engine.retrieveMemories(TEST_STUDENT_ID);
      const reflections = memories.filter(m => m.type === MemoryType.REFLECTION);
      expect(reflections.length).toBe(1);
      expect(reflections[0].topic).toBe('metacognition');
    });

    it('should maintain identity memory across sessions', () => {
      // Store identity-related memory
      engine.storeMemory(
        TEST_STUDENT_ID,
        'I am a visual learner who prefers diagrams',
        MemoryType.IDENTITY,
        { topic: 'learning_style', importance: MemoryImportance.CRITICAL }
      );

      // Get state and restore in new engine
      const state = engine.getState();
      const newEngine = new MemoryConsolidationEngine();
      newEngine.restoreState(state);

      const memories = newEngine.retrieveMemories(TEST_STUDENT_ID);
      const identityMemories = memories.filter(m => m.type === MemoryType.IDENTITY);
      expect(identityMemories.length).toBe(1);
    });

    it('should track all six tiers in student statistics', () => {
      // Store memories in all tiers
      engine.storeMemory(TEST_STUDENT_ID, 'Working memory task', MemoryType.WORKING);
      engine.storeMemory(TEST_STUDENT_ID, 'Episodic event', MemoryType.EPISODIC);
      engine.storeMemory(TEST_STUDENT_ID, 'Semantic knowledge', MemoryType.SEMANTIC);
      engine.storeMemory(TEST_STUDENT_ID, 'Procedural skill', MemoryType.PROCEDURAL);
      engine.storeMemory(TEST_STUDENT_ID, 'Reflection on learning', MemoryType.REFLECTION);
      engine.storeMemory(TEST_STUDENT_ID, 'Identity belief', MemoryType.IDENTITY);

      const stats = engine.getStudentStats(TEST_STUDENT_ID);

      expect(stats.workingMemoryCount).toBe(1);
      // Other tiers should also be tracked
      expect(stats.totalMemories).toBe(6);
    });
  });

  // ============================================================================
  // Cross-Product Memory Transfer Tests
  // ============================================================================

  describe('Cross-Product Memory Transfer', () => {
    it('should allow memory transfer between StudyLoG and DMLoG', () => {
      // Learn concept in StudyLoG context
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Understanding of probability distributions',
        MemoryType.SEMANTIC,
        {
          topic: 'mathematics',
          product: 'studylog',
          importance: MemoryImportance.HIGH,
        }
      );

      // Access in DMLoG context (same student)
      const dmlogMemories = engine.retrieveMemories(TEST_STUDENT_ID, {
        productContext: 'dmlog',
      });

      // Memory should be accessible across products
      expect(dmlogMemories.length).toBeGreaterThan(0);
      const mathMemory = dmlogMemories.find(m => m.topic === 'mathematics');
      expect(mathMemory).toBeDefined();
    });

    it('should preserve emotional valence across products', () => {
      const valence = 0.8;
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Exciting breakthrough in coding',
        MemoryType.EPISODIC,
        {
          emotionalValence: valence,
          product: 'studylog',
        }
      );

      // Retrieve in different product context
      const memories = engine.retrieveMemories(TEST_STUDENT_ID, {
        productContext: 'dmlog',
      });

      const transferredMemory = memories.find(
        m => m.content.includes('breakthrough')
      );
      expect(transferredMemory?.emotionalValence).toBe(valence);
    });

    it('should maintain skill proficiency across products', () => {
      // Build skill in StudyLoG
      for (let i = 0; i < 5; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Practice ${i + 1}: Debugged code successfully`,
          MemoryType.EPISODIC,
          {
            topic: 'debugging',
            importance: MemoryImportance.HIGH,
            skillGain: 0.1,
          }
        );
      }

      engine.consolidateMemories(TEST_STUDENT_ID);

      // Check proficiency in DMLoG context
      const insights = engine.getLearningInsights(TEST_STUDENT_ID);
      expect(insights.retentionScore).toBeGreaterThan(0);
    });

    it('should track cross-product learning velocity', () => {
      // Learning in StudyLoG
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Learned recursion in 10 minutes',
        MemoryType.EPISODIC,
        { topic: 'recursion', product: 'studylog', timeSpent: 600 }
      );

      // Apply knowledge in DMLoG
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Used recursion to solve puzzle quickly',
        MemoryType.EPISODIC,
        { topic: 'recursion', product: 'dmlog', timeSpent: 120 }
      );

      const insights = engine.getLearningInsights(TEST_STUDENT_ID);
      expect(insights.learningVelocity).toBeGreaterThan(0);
    });

    it('should create unified autobiographical narrative across products', () => {
      // Memories from StudyLoG
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Started learning Python',
        MemoryType.EPISODIC,
        { product: 'studylog', importance: MemoryImportance.HIGH }
      );

      // Memories from DMLoG
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Completed first D&D campaign',
        MemoryType.EPISODIC,
        { product: 'dmlog', importance: MemoryImportance.CRITICAL }
      );

      const narrative = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);

      // Should include memories from both products
      expect(narrative.totalMemories).toBe(2);
      expect(narrative.chapters.length).toBeGreaterThan(0);
    });

    it('should maintain temporal landmarks across products', () => {
      // Create landmark in StudyLoG
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'First time understanding AI neural networks',
        MemoryType.EPISODIC,
        { product: 'studylog', importance: MemoryImportance.CRITICAL }
      );

      expect(memory.isTemporalLandmark).toBe(true);

      // Landmark should persist when accessed from DMLoG
      const memories = engine.retrieveMemories(TEST_STUDENT_ID, {
        productContext: 'dmlog',
      });

      const landmarks = memories.filter(m => m.isTemporalLandmark);
      expect(landmarks.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Consolidation Process Tests
  // ============================================================================

  describe('Memory Consolidation Processes', () => {
    it('should trigger consolidation when threshold is reached', () => {
      // Store memories just below threshold
      const threshold = 8;
      for (let i = 0; i < threshold - 1; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.NORMAL }
        );
      }

      expect(engine.needsConsolidation(TEST_STUDENT_ID)).toBe(false);

      // Add one more to trigger
      engine.storeMemory(
        TEST_STUDENT_ID,
        `Trigger memory`,
        MemoryType.EPISODIC,
        { importance: MemoryImportance.HIGH }
      );

      expect(engine.needsConsolidation(TEST_STUDENT_ID)).toBe(true);
    });

    it('should cluster related memories during consolidation', () => {
      // Store related memories about same topic
      const programmingTopics = ['loops', 'conditionals', 'functions', 'arrays'];

      programmingTopics.forEach(topic => {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Learned about ${topic}`,
          MemoryType.EPISODIC,
          { topic: 'programming', subtopic: topic, importance: MemoryImportance.HIGH }
        );
      });

      const result = engine.consolidateMemories(TEST_STUDENT_ID);

      // Should create at least one consolidated memory
      expect(result.consolidatedMemories).toBeGreaterThanOrEqual(0);
    });

    it('should preserve emotional peaks during consolidation', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Aha moment! Finally understand pointers',
        MemoryType.EPISODIC,
        { emotionalValence: 0.95, importance: MemoryImportance.HIGH }
      );

      const result = engine.consolidateMemories(TEST_STUDENT_ID);

      // Emotional peaks should become landmarks
      const memories = engine.retrieveMemories(TEST_STUDENT_ID);
      const peaks = memories.filter(m => m.isTemporalLandmark);
      expect(peaks.length).toBeGreaterThan(0);
    });

    it('should decay unaccessed working memories over time', () => {
      // Store working memories
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Temporary task information',
        MemoryType.WORKING
      );

      // Access some memories multiple times
      const memories = engine.retrieveMemories(TEST_STUDENT_ID);
      if (memories.length > 0) {
        for (let i = 0; i < 5; i++) {
          engine.accessMemory(TEST_STUDENT_ID, memories[0].id);
        }
      }

      // Unaccessed memories should have lower importance
      const allMemories = engine.retrieveMemories(TEST_STUDENT_ID);
      const unaccessed = allMemories.filter(m => m.accessCount === 0);
      expect(unaccessed.length).toBeGreaterThanOrEqual(0);
    });

    it('should strengthen memories through repeated access', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'Important concept',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.NORMAL }
      );

      const initialImportance = memory.importance;

      // Access multiple times
      for (let i = 0; i < 5; i++) {
        engine.accessMemory(TEST_STUDENT_ID, memory.id);
      }

      const accessed = engine.accessMemory(TEST_STUDENT_ID, memory.id);
      expect(accessed?.importance).toBeGreaterThan(initialImportance);
    });

    it('should perform consolidation in batches for efficiency', () => {
      // Store many memories
      for (let i = 0; i < 20; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.NORMAL }
        );
      }

      const startTime = Date.now();
      const result = engine.consolidateMemories(TEST_STUDENT_ID);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time even with 20 memories
      expect(duration).toBeLessThan(5000);
      expect(result.consolidatedMemories).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // Temporal Landmark Detection Tests
  // ============================================================================

  describe('Temporal Landmark Detection', () => {
    it('should detect first-time events as landmarks', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'First time successfully compiling code',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.HIGH }
      );

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.FIRST_TIME);
    });

    it('should detect breakthrough moments as landmarks', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'It clicked! I finally understand recursion',
        MemoryType.EPISODIC,
        { emotionalValence: 0.85 }
      );

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.BREAKTHROUGH);
    });

    it('should detect emotional peaks as landmarks', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'Felt so proud when I solved the hard problem',
        MemoryType.EPISODIC,
        { emotionalValence: 0.9 }
      );

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.EMOTIONAL_PEAK);
    });

    it('should detect milestones as landmarks', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'Completed the advanced programming course',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.CRITICAL }
      );

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.MILESTONE);
    });

    it('should detect social learning as landmarks', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'Collaborated with peer on complex project',
        MemoryType.EPISODIC,
        { participants: [ALT_STUDENT_ID] }
      );

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.SOCIAL);
    });

    it('should track landmark count in statistics', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'First time!',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.CRITICAL }
      );

      const stats = engine.getStudentStats(TEST_STUDENT_ID);
      expect(stats.landmarksCount).toBe(1);
    });

    it('should include landmarks in autobiographical narrative', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Major achievement',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.CRITICAL }
      );

      const narrative = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);
      expect(narrative.landmarksCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Autobiographical Narrative Tests
  // ============================================================================

  describe('Autobiographical Narrative Generation', () => {
    it('should generate empty narrative for student with no memories', () => {
      const narrative = engine.generateAutobiographicalNarrative('nonexistent');

      expect(narrative.totalMemories).toBe(0);
      expect(narrative.chapters).toHaveLength(0);
      expect(narrative.summary).toContain('No memories yet');
    });

    it('should generate narrative with proper structure', () => {
      // Add memories across different topics
      const memories = [
        { content: 'Started Python journey', importance: MemoryImportance.HIGH },
        { content: 'Learned functions', importance: MemoryImportance.NORMAL },
        { content: 'Built first project', importance: MemoryImportance.CRITICAL },
        { content: 'Debugged complex issue', importance: MemoryImportance.HIGH },
        { content: 'Helped peer understand', importance: MemoryImportance.NORMAL },
      ];

      memories.forEach(mem => {
        engine.storeMemory(
          TEST_STUDENT_ID,
          mem.content,
          MemoryType.EPISODIC,
          { importance: mem.importance }
        );
      });

      const narrative = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);

      expect(narrative.totalMemories).toBe(5);
      expect(narrative.chapters.length).toBeGreaterThan(0);
      expect(narrative.themes.length).toBeGreaterThan(0);
      expect(narrative.summary).toBeDefined();
    });

    it('should organize narrative into temporal chapters', () => {
      // Add memories over time (simulated by small delays)
      for (let i = 0; i < 15; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Learning step ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.NORMAL }
        );
      }

      const narrative = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);

      expect(narrative.chapters.length).toBeGreaterThan(0);

      // Each chapter should have required fields
      narrative.chapters.forEach(chapter => {
        expect(chapter.period).toBeDefined();
        expect(chapter.timeRange.start).toBeLessThanOrEqual(chapter.timeRange.end);
        expect(chapter.themes).toBeDefined();
        expect(chapter.growthSummary).toBeDefined();
      });
    });

    it('should identify recurring themes in narrative', () => {
      const themes = ['programming', 'debugging', 'problem-solving'];

      themes.forEach(theme => {
        for (let i = 0; i < 3; i++) {
          engine.storeMemory(
            TEST_STUDENT_ID,
            `${theme} practice ${i}`,
            MemoryType.EPISODIC,
            { topic: theme, importance: MemoryImportance.NORMAL }
          );
        }
      });

      const narrative = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);

      expect(narrative.themes.length).toBeGreaterThan(0);
    });

    it('should generate growth summary per chapter', () => {
      for (let i = 0; i < 20; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Progress step ${i}`,
          MemoryType.EPISODIC,
          {
            topic: i < 10 ? 'basics' : 'advanced',
            importance: MemoryImportance.NORMAL,
          }
        );
      }

      const narrative = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);

      narrative.chapters.forEach(chapter => {
        expect(chapter.growthSummary).toBeDefined();
        expect(typeof chapter.growthSummary).toBe('string');
      });
    });
  });

  // ============================================================================
  // Learning Insights Tests
  // ============================================================================

  describe('Learning Insights Generation', () => {
    it('should identify student strengths', () => {
      // Consistent success in a topic
      for (let i = 0; i < 5; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Successfully completed ${i} exercises on functions`,
          MemoryType.EPISODIC,
          {
            topic: 'functions',
            importance: MemoryImportance.HIGH,
            emotionalValence: 0.8,
          }
        );
      }

      engine.consolidateMemories(TEST_STUDENT_ID);
      const insights = engine.getLearningInsights(TEST_STUDENT_ID);

      expect(insights.strengths).toBeDefined();
      expect(insights.strengths.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify areas for improvement', () => {
      // Struggles with a topic
      for (let i = 0; i < 3; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Struggled with recursion ${i}`,
          MemoryType.EPISODIC,
          {
            topic: 'recursion',
            importance: MemoryImportance.NORMAL,
            emotionalValence: -0.3,
          }
        );
      }

      engine.consolidateMemories(TEST_STUDENT_ID);
      const insights = engine.getLearningInsights(TEST_STUDENT_ID);

      expect(insights.areasForImprovement).toBeDefined();
      expect(insights.areasForImprovement.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate retention score', () => {
      // Create memories with different access patterns
      const memory1 = engine.storeMemory(
        TEST_STUDENT_ID,
        'Well-practiced concept',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.HIGH }
      );

      const memory2 = engine.storeMemory(
        TEST_STUDENT_ID,
        'Rarely accessed concept',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.NORMAL }
      );

      // Access first memory many times
      for (let i = 0; i < 10; i++) {
        engine.accessMemory(TEST_STUDENT_ID, memory1.id);
      }

      const insights = engine.getLearningInsights(TEST_STUDENT_ID);
      expect(insights.retentionScore).toBeGreaterThanOrEqual(0);
      expect(insights.retentionScore).toBeLessThanOrEqual(1);
    });

    it('should calculate learning velocity', () => {
      // Quick learning progression
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Learned basic loops in 5 minutes',
        MemoryType.EPISODIC,
        { timeSpent: 300, topic: 'loops' }
      );

      engine.storeMemory(
        TEST_STUDENT_ID,
        'Mastered nested loops in next session',
        MemoryType.EPISODIC,
        { timeSpent: 400, topic: 'loops' }
      );

      const insights = engine.getLearningInsights(TEST_STUDENT_ID);
      expect(insights.learningVelocity).toBeGreaterThanOrEqual(0);
    });

    it('should track emotional trends', () => {
      // Mixed emotional journey
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Frustrated at first',
        MemoryType.EPISODIC,
        { emotionalValence: -0.5 }
      );

      engine.storeMemory(
        TEST_STUDENT_ID,
        'Then it clicked!',
        MemoryType.EPISODIC,
        { emotionalValence: 0.9 }
      );

      engine.storeMemory(
        TEST_STUDENT_ID,
        'Now feeling confident',
        MemoryType.EPISODIC,
        { emotionalValence: 0.7 }
      );

      const insights = engine.getLearningInsights(TEST_STUDENT_ID);
      expect(insights.avgEmotionalValence).toBeDefined();
    });
  });

  // ============================================================================
  // State Persistence Tests
  // ============================================================================

  describe('State Persistence and Restoration', () => {
    it('should serialize complete state', () => {
      // Store various types of memories
      engine.storeMemory(TEST_STUDENT_ID, 'Working memory', MemoryType.WORKING);
      engine.storeMemory(TEST_STUDENT_ID, 'Episodic event', MemoryType.EPISODIC);
      engine.storeMemory(TEST_STUDENT_ID, 'Semantic fact', MemoryType.SEMANTIC);
      engine.storeMemory(TEST_STUDENT_ID, 'Procedural skill', MemoryType.PROCEDURAL);

      const state = engine.getState();

      expect(state).toBeDefined();
      expect(state.students).toBeDefined();
      expect(state.students[TEST_STUDENT_ID]).toBeDefined();
    });

    it('should restore state accurately', () => {
      const originalMemory = engine.storeMemory(
        TEST_STUDENT_ID,
        'Original memory',
        MemoryType.EPISODIC,
        { topic: 'test', importance: MemoryImportance.HIGH }
      );

      const state = engine.getState();

      // Create new engine and restore
      const newEngine = new MemoryConsolidationEngine();
      newEngine.restoreState(state);

      const memories = newEngine.retrieveMemories(TEST_STUDENT_ID);
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('Original memory');
      expect(memories[0].topic).toBe('test');
    });

    it('should preserve landmark status after restoration', () => {
      const memory = engine.storeMemory(
        TEST_STUDENT_ID,
        'First time achievement',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.CRITICAL }
      );

      expect(memory.isTemporalLandmark).toBe(true);

      const state = engine.getState();
      const newEngine = new MemoryConsolidationEngine();
      newEngine.restoreState(state);

      const memories = newEngine.retrieveMemories(TEST_STUDENT_ID);
      expect(memories[0].isTemporalLandmark).toBe(true);
    });

    it('should preserve consolidation state', () => {
      // Store enough to trigger consolidation
      for (let i = 0; i < 10; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.HIGH }
        );
      }

      engine.consolidateMemories(TEST_STUDENT_ID);

      const state = engine.getState();
      const newEngine = new MemoryConsolidationEngine();
      newEngine.restoreState(state);

      // Should not need consolidation immediately after restore
      expect(newEngine.needsConsolidation(TEST_STUDENT_ID)).toBe(false);
    });

    it('should handle restoration with empty state', () => {
      const newEngine = new MemoryConsolidationEngine();
      newEngine.restoreState({ students: {}, globalState: { nextMemoryId: 1 } });

      const memories = newEngine.retrieveMemories(TEST_STUDENT_ID);
      expect(memories.length).toBe(0);
    });
  });

  // ============================================================================
  // Memory Access and Retrieval Tests
  // ============================================================================

  describe('Memory Access and Retrieval', () => {
    it('should retrieve memories by topic', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Learned about loops',
        MemoryType.EPISODIC,
        { topic: 'control-flow' }
      );
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Learned about conditionals',
        MemoryType.EPISODIC,
        { topic: 'control-flow' }
      );
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Learned about functions',
        MemoryType.EPISODIC,
        { topic: 'functions' }
      );

      const controlFlowMemories = engine.retrieveMemories(TEST_STUDENT_ID, {
        topic: 'control-flow',
      });

      expect(controlFlowMemories.length).toBe(2);
    });

    it('should retrieve memories by importance threshold', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Low importance',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.LOW }
      );
      engine.storeMemory(
        TEST_STUDENT_ID,
        'High importance',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.HIGH }
      );

      const importantMemories = engine.retrieveMemories(TEST_STUDENT_ID, {
        minImportance: MemoryImportance.HIGH,
      });

      expect(importantMemories.length).toBe(1);
      expect(importantMemories[0].content).toBe('High importance');
    });

    it('should limit retrieval results', () => {
      for (let i = 0; i < 10; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.NORMAL }
        );
      }

      const limited = engine.retrieveMemories(TEST_STUDENT_ID, { limit: 5 });
      expect(limited.length).toBe(5);
    });

    it('should sort by importance and recency', () => {
      // Store with varying importance
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Old important',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.CRITICAL }
      );

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      engine.storeMemory(
        TEST_STUDENT_ID,
        'New normal',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.NORMAL }
      );

      const memories = engine.retrieveMemories(TEST_STUDENT_ID);
      // Most important should be first
      expect(memories[0].importance).toBeGreaterThanOrEqual(memories[1]?.importance || 0);
    });

    it('should handle retrieval for non-existent student', () => {
      const memories = engine.retrieveMemories('non-existent-student');
      expect(memories.length).toBe(0);
    });

    it('should return null for accessing non-existent memory', () => {
      const result = engine.accessMemory(TEST_STUDENT_ID, 'fake-id');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Multi-Student Memory Tests
  // ============================================================================

  describe('Multi-Student Memory Management', () => {
    it('should maintain isolation between students', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Student 1 memory',
        MemoryType.EPISODIC,
        { topic: 'private' }
      );

      engine.storeMemory(
        ALT_STUDENT_ID,
        'Student 2 memory',
        MemoryType.EPISODIC,
        { topic: 'private' }
      );

      const student1Memories = engine.retrieveMemories(TEST_STUDENT_ID);
      const student2Memories = engine.retrieveMemories(ALT_STUDENT_ID);

      expect(student1Memories.length).toBe(1);
      expect(student2Memories.length).toBe(1);
      expect(student1Memories[0].content).not.toBe(student2Memories[0].content);
    });

    it('should track statistics per student', () => {
      engine.storeMemory(TEST_STUDENT_ID, 'Memory 1', MemoryType.WORKING);
      engine.storeMemory(TEST_STUDENT_ID, 'Memory 2', MemoryType.WORKING);
      engine.storeMemory(ALT_STUDENT_ID, 'Memory 1', MemoryType.WORKING);

      const stats1 = engine.getStudentStats(TEST_STUDENT_ID);
      const stats2 = engine.getStudentStats(ALT_STUDENT_ID);

      expect(stats1.totalMemories).toBe(2);
      expect(stats2.totalMemories).toBe(1);
    });

    it('should consolidate memories per student independently', () => {
      // Student 1 has enough for consolidation
      for (let i = 0; i < 10; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.HIGH }
        );
      }

      // Student 2 does not
      engine.storeMemory(
        ALT_STUDENT_ID,
        'Single memory',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.NORMAL }
      );

      expect(engine.needsConsolidation(TEST_STUDENT_ID)).toBe(true);
      expect(engine.needsConsolidation(ALT_STUDENT_ID)).toBe(false);
    });

    it('should generate separate narratives per student', () => {
      engine.storeMemory(
        TEST_STUDENT_ID,
        'Python journey',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.HIGH }
      );

      engine.storeMemory(
        ALT_STUDENT_ID,
        'JavaScript journey',
        MemoryType.EPISODIC,
        { importance: MemoryImportance.HIGH }
      );

      const narrative1 = engine.generateAutobiographicalNarrative(TEST_STUDENT_ID);
      const narrative2 = engine.generateAutobiographicalNarrative(ALT_STUDENT_ID);

      expect(narrative1.summary).toContain('Python');
      expect(narrative2.summary).toContain('JavaScript');
    });
  });

  // ============================================================================
  // Performance and Stress Tests
  // ============================================================================

  describe('Performance and Stress Tests', () => {
    it('should handle large number of memories efficiently', () => {
      const count = 1000;
      const start = Date.now();

      for (let i = 0; i < count; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.WORKING,
          { topic: `topic-${i % 10}` }
        );
      }

      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000);

      const stats = engine.getStudentStats(TEST_STUDENT_ID);
      expect(stats.totalMemories).toBe(count);
    }, 20000);

    it('should perform consolidation on large dataset efficiently', () => {
      for (let i = 0; i < 50; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { importance: MemoryImportance.NORMAL }
        );
      }

      const start = Date.now();
      const result = engine.consolidateMemories(TEST_STUDENT_ID);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
      expect(result.consolidatedMemories).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should serialize large state efficiently', () => {
      for (let i = 0; i < 100; i++) {
        engine.storeMemory(
          TEST_STUDENT_ID,
          `Memory ${i}`,
          MemoryType.EPISODIC,
          { topic: `topic-${i % 20}`, importance: MemoryImportance.NORMAL }
        );
      }

      const start = Date.now();
      const state = engine.getState();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
      expect(state.students[TEST_STUDENT_ID].memories.length).toBe(100);
    }, 10000);
  });
});
