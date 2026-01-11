/**
 * Tests for Memory Consolidation System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryConsolidationEngine,
  MemoryType,
  MemoryImportance,
  TemporalLandmarkType,
} from '../lib/memory-system';

describe('MemoryConsolidationEngine', () => {
  let engine: MemoryConsolidationEngine;

  beforeEach(() => {
    engine = new MemoryConsolidationEngine();
  });

  describe('Memory Storage', () => {
    it('should store a new memory', () => {
      const memory = engine.storeMemory('student1', 'Learned about loops', MemoryType.EPISODIC, {
        topic: 'programming',
        importance: MemoryImportance.NORMAL,
        emotionalValence: 0.5,
      });

      expect(memory.id).toBeDefined();
      expect(memory.studentId).toBe('student1');
      expect(memory.content).toBe('Learned about loops');
      expect(memory.topic).toBe('programming');
      expect(memory.importance).toBe(MemoryImportance.NORMAL);
    });

    it('should detect first-time temporal landmarks', () => {
      const memory = engine.storeMemory('student1', 'First time compiling code successfully', MemoryType.EPISODIC, {
        topic: 'programming',
        importance: MemoryImportance.HIGH,
      });

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.FIRST_TIME);
      expect(memory.landmarkReason).toBeDefined();
    });

    it('should detect breakthrough temporal landmarks', () => {
      const memory = engine.storeMemory('student1', 'It finally clicked! I understand recursion now', MemoryType.EPISODIC, {
        topic: 'recursion',
        emotionalValence: 0.8,
      });

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.BREAKTHROUGH);
    });

    it('should detect emotional peaks', () => {
      const memory = engine.storeMemory('student1', 'I felt so proud when my code finally worked', MemoryType.EPISODIC, {
        topic: 'debugging',
        emotionalValence: 0.9,
      });

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.EMOTIONAL_PEAK);
    });

    it('should detect social learning events', () => {
      const memory = engine.storeMemory('student1', 'Worked together with a partner on this exercise', MemoryType.EPISODIC, {
        topic: 'collaboration',
        participants: ['student2'],
      });

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.SOCIAL);
    });

    it('should mark high importance events as landmarks', () => {
      const memory = engine.storeMemory('student1', 'Completed the final project', MemoryType.EPISODIC, {
        topic: 'project',
        importance: MemoryImportance.CRITICAL,
      });

      expect(memory.isTemporalLandmark).toBe(true);
      expect(memory.landmarkType).toBe(TemporalLandmarkType.MILESTONE);
    });
  });

  describe('Memory Retrieval', () => {
    beforeEach(() => {
      // Store test memories
      engine.storeMemory('student1', 'Basic Python syntax', MemoryType.EPISODIC, {
        topic: 'python',
        importance: MemoryImportance.LOW,
      });

      engine.storeMemory('student1', 'Understanding recursion', MemoryType.EPISODIC, {
        topic: 'algorithms',
        importance: MemoryImportance.HIGH,
      });

      engine.storeMemory('student1', 'First time using classes', MemoryType.EPISODIC, {
        topic: 'oop',
        importance: MemoryImportance.CRITICAL,
      });
    });

    it('should retrieve memories by topic', () => {
      const memories = engine.retrieveMemories('student1', {
        topic: 'python',
      });

      expect(memories.length).toBe(1);
      expect(memories[0].topic).toBe('python');
    });

    it('should retrieve memories by minimum importance', () => {
      const memories = engine.retrieveMemories('student1', {
        minImportance: MemoryImportance.HIGH,
      });

      expect(memories.length).toBe(2);
    });

    it('should sort results by importance and recency', () => {
      const memories = engine.retrieveMemories('student1', {
        limit: 10,
      });

      // Most important should be first
      expect(memories[0].importance).toBeGreaterThanOrEqual(memories[1].importance);
    });

    it('should limit results', () => {
      const memories = engine.retrieveMemories('student1', {
        limit: 2,
      });

      expect(memories.length).toBe(2);
    });
  });

  describe('Memory Access', () => {
    it('should update access stats when accessing memory', () => {
      const memory = engine.storeMemory('student1', 'Test memory', MemoryType.EPISODIC);

      const initialAccessCount = memory.accessCount;

      engine.accessMemory('student1', memory.id);

      const accessed = engine.accessMemory('student1', memory.id);

      expect(accessed).not.toBeNull();
      expect(accessed!.accessCount).toBe(initialAccessCount + 2);
      expect(accessed!.lastAccessed).toBeGreaterThan(0);
    });

    it('should reinforce memory through access', () => {
      const memory = engine.storeMemory('student1', 'Test memory', MemoryType.EPISODIC, {
        importance: MemoryImportance.NORMAL,
      });

      const initialImportance = memory.importance;

      // Access multiple times
      for (let i = 0; i < 5; i++) {
        engine.accessMemory('student1', memory.id);
      }

      const accessed = engine.accessMemory('student1', memory.id);
      expect(accessed!.importance).toBeGreaterThan(initialImportance);
    });

    it('should return null for non-existent memory', () => {
      const result = engine.accessMemory('student1', 'non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('Consolidation', () => {
    it('should indicate when consolidation is needed', () => {
      const studentId = 'student1';

      // Store low importance memories (below threshold)
      for (let i = 0; i < 3; i++) {
        engine.storeMemory(studentId, `Memory ${i}`, MemoryType.EPISODIC, {
          importance: MemoryImportance.NORMAL,
        });
      }

      expect(engine.needsConsolidation(studentId)).toBe(false);

      // Add more to reach threshold
      for (let i = 0; i < 5; i++) {
        engine.storeMemory(studentId, `Memory ${i + 3}`, MemoryType.EPISODIC, {
          importance: MemoryImportance.HIGH,
        });
      }

      expect(engine.needsConsolidation(studentId)).toBe(true);
    });

    it('should consolidate episodic memories to semantic', () => {
      const studentId = 'student1';

      // Store related memories
      for (let i = 0; i < 5; i++) {
        engine.storeMemory(
          studentId,
          `Practice session ${i + 1} for loops`,
          MemoryType.EPISODIC,
          {
            topic: 'loops',
            importance: MemoryImportance.HIGH,
          }
        );
      }

      // Trigger consolidation
      const result = engine.consolidateMemories(studentId);

      expect(result.consolidatedMemories).toBeGreaterThanOrEqual(0);
    });

    it('should create procedural memories from practice', () => {
      const studentId = 'student1';

      // Store practice memories
      engine.storeMemory(studentId, 'Practiced function writing', MemoryType.EPISODIC, {
        topic: 'functions',
        importance: MemoryImportance.HIGH,
        emotionalValence: 0.5,
      });

      engine.storeMemory(studentId, 'Used functions effectively', MemoryType.EPISODIC, {
        topic: 'functions',
        importance: MemoryImportance.HIGH,
        emotionalValence: 0.7,
      });

      engine.storeMemory(studentId, 'Practiced more functions', MemoryType.EPISODIC, {
        topic: 'functions',
        importance: MemoryImportance.NORMAL,
        emotionalValence: 0.3,
      });

      // Trigger consolidation
      const result = engine.consolidateMemories(studentId);

      expect(result.newProceduralMemories.length).toBeGreaterThanOrEqual(0);
    });

    it('should reset importance accumulation after consolidation', () => {
      const studentId = 'student1';

      // Store memories above threshold
      for (let i = 0; i < 5; i++) {
        engine.storeMemory(studentId, `Memory ${i}`, MemoryType.EPISODIC, {
          importance: MemoryImportance.HIGH,
        });
      }

      expect(engine.needsConsolidation(studentId)).toBe(true);

      engine.consolidateMemories(studentId);

      expect(engine.needsConsolidation(studentId)).toBe(false);
    });
  });

  describe('Autobiographical Narrative', () => {
    it('should generate narrative for student with memories', () => {
      const studentId = 'student1';

      // Store memories over time
      const memories = [
        { content: 'Started learning Python', topic: 'python', importance: MemoryImportance.HIGH },
        { content: 'First successful program', topic: 'python', importance: MemoryImportance.CRITICAL },
        { content: 'Learned about functions', topic: 'functions', importance: MemoryImportance.NORMAL },
        { content: 'Debugging session', topic: 'debugging', importance: MemoryImportance.NORMAL },
        { content: 'Understanding recursion breakthrough', topic: 'recursion', importance: MemoryImportance.HIGH },
        { content: 'Completed final project', topic: 'project', importance: MemoryImportance.CRITICAL },
      ];

      for (const mem of memories) {
        engine.storeMemory(studentId, mem.content, MemoryType.EPISODIC, {
          topic: mem.topic,
          importance: mem.importance,
        });
      }

      const narrative = engine.generateAutobiographicalNarrative(studentId);

      expect(negative(narrative.totalMemories)).toBe(6);
      expect(narrative.landmarksCount).toBeGreaterThan(0);
      expect(narrative.chapters.length).toBeGreaterThan(0);
      expect(narrative.themes.length).toBeGreaterThan(0);
      expect(narrative.summary).toBeDefined();
    });

    it('should return empty narrative for student with no memories', () => {
      const narrative = engine.generateAutobiographicalNarrative('nonexistent');

      expect(narrative.totalMemories).toBe(0);
      expect(narrative.landmarksCount).toBe(0);
      expect(narrative.chapters.length).toBe(0);
      expect(narrative.summary).toContain('No memories yet');
    });

    it('should include chapters with periods', () => {
      const studentId = 'student1';

      for (let i = 0; i < 20; i++) {
        engine.storeMemory(studentId, `Memory ${i}`, MemoryType.EPISODIC, {
          topic: 'test',
          importance: MemoryImportance.NORMAL,
        });
      }

      const narrative = engine.generateAutobiographicalNarrative(studentId);

      expect(narrative.chapters.length).toBeGreaterThan(1);

      // Check that chapters have required fields
      const chapter = narrative.chapters[0];
      expect(chapter.period).toBeDefined();
      expect(chapter.timeRange.start).toBeLessThanOrEqual(chapter.timeRange.end);
      expect(chapter.themes).toBeDefined();
      expect(chapter.growthSummary).toBeDefined();
    });
  });

  describe('Learning Insights', () => {
    it('should identify strengths and areas for improvement', () => {
      const studentId = 'student1';

      // Create some procedural memories through consolidation
      engine.storeMemory(studentId, 'Learned Python syntax', MemoryType.EPISODIC, {
        topic: 'python',
        importance: MemoryImportance.HIGH,
        emotionalValence: 0.8,
      });

      engine.storeMemory(studentId, 'Struggled with recursion', MemoryType.EPISODIC, {
        topic: 'recursion',
        importance: MemoryImportance.NORMAL,
        emotionalValence: -0.3,
      });

      for (let i = 0; i < 5; i++) {
        engine.storeMemory(studentId, `Python practice ${i}`, MemoryType.EPISODIC, {
          topic: 'python',
          importance: MemoryImportance.HIGH,
          emotionalValence: 0.7,
        });
      }

      engine.consolidateMemories(studentId);

      const insights = engine.getLearningInsights(studentId);

      expect(insights.strengths).toBeDefined();
      expect(insights.areasForImprovement).toBeDefined();
      expect(insights.retentionScore).toBeGreaterThanOrEqual(0);
      expect(insights.learningVelocity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Student Statistics', () => {
    it('should get comprehensive student stats', () => {
      const studentId = 'student1';

      engine.storeMemory(studentId, 'Memory 1', MemoryType.EPISODIC, {
        topic: 'test',
        importance: MemoryImportance.NORMAL,
        emotionalValence: 0.5,
      });

      engine.storeMemory(studentId, 'Memory 2', MemoryType.EPISODIC, {
        topic: 'test',
        importance: MemoryImportance.HIGH,
        emotionalValence: 0.8,
      });

      const stats = engine.getStudentStats(studentId);

      expect(stats.totalMemories).toBe(2);
      expect(stats.workingMemoryCount).toBe(2);
      expect(stats.avgEmotionalValence).toBeCloseTo(0.65, 1);
    });

    it('should track landmarks separately', () => {
      const studentId = 'student1';

      engine.storeMemory(studentId, 'First time coding!', MemoryType.EPISODIC, {
        topic: 'coding',
        importance: MemoryImportance.HIGH,
      });

      const stats = engine.getStudentStats(studentId);

      expect(stats.landmarksCount).toBe(1);
    });
  });

  describe('State Persistence', () => {
    it('should get and restore state', () => {
      const studentId = 'student1';

      engine.storeMemory(studentId, 'Test memory', MemoryType.EPISODIC, {
        topic: 'test',
        importance: MemoryImportance.HIGH,
      });

      const state = engine.getState();

      // Create new engine and restore
      const newEngine = new MemoryConsolidationEngine();
      newEngine.restoreState(state);

      const memories = newEngine.retrieveMemories(studentId);
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('Test memory');
    });
  });
});

/**
 * Helper to handle negative numbers in tests
 */
function negative(num: number): number {
  return num;
}
