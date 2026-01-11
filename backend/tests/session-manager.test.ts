/**
 * Tests for Session Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SessionManager,
  SessionPhase,
  LearningDomain,
  type SessionStartContext,
  type AttemptContext,
  type AttemptResult,
} from '../lib/session-manager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe('Session Lifecycle', () => {
    it('should start a new session', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Introduction to AI',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_\d+_[a-z0-9]+$/);

      const summary = manager.getSessionSummary(sessionId);
      expect(summary).not.toBeNull();
      expect(summary?.session.phase).toBe(SessionPhase.SETUP);
      expect(summary?.session.studentIds).toEqual(['student1']);
    });

    it('should use custom session ID if provided', () => {
      const context: SessionStartContext = {
        sessionId: 'custom-session-123',
        studentIds: ['student1'],
        topic: 'Test Topic',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      expect(sessionId).toBe('custom-session-123');
    });

    it('should set session phase', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);
      manager.setSessionPhase(sessionId, SessionPhase.LEARNING);

      const summary = manager.getSessionSummary(sessionId);
      expect(summary?.session.phase).toBe(SessionPhase.LEARNING);
    });

    it('should add student to active session', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);
      manager.addStudentToSession(sessionId, 'student2');

      const summary = manager.getSessionSummary(sessionId);
      expect(summary?.session.studentIds).toContain('student2');
      expect(summary?.session.activeStudents).toBe(2);
    });
  });

  describe('Attempt Recording', () => {
    it('should record a successful attempt', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      const attemptContext: AttemptContext = {
        studentId: 'student1',
        attemptType: 'quiz',
        source: 'ai_assisted',
        timeTakenMs: 5000,
        confidence: 0.8,
      };

      const attemptResult: AttemptResult = {
        success: true,
        domainRewards: {
          comprehension: 0.8,
        },
        qualityScore: 0.7,
      };

      manager.recordAttempt(sessionId, 'student1', attemptContext, attemptResult);

      const summary = manager.getSessionSummary(sessionId);
      expect(summary?.session.totalAttempts).toBe(1);
      expect(summary?.session.totalSuccesses).toBe(1);
      expect(summary?.students['student1'].attemptsMade).toBe(1);
    });

    it('should aggregate domain rewards', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      const attemptContext: AttemptContext = {
        studentId: 'student1',
        attemptType: 'code',
        source: 'ai_assisted',
        timeTakenMs: 5000,
        confidence: 0.8,
      };

      const attemptResult: AttemptResult = {
        success: true,
        domainRewards: {
          syntax: 0.9,
          logic: 0.7,
          style: 0.5,
        },
        qualityScore: 0.7,
      };

      manager.recordAttempt(sessionId, 'student1', attemptContext, attemptResult);

      const summary = manager.getSessionSummary(sessionId);
      expect(summary?.students['student1'].syntaxReward).toBe(0.9);
      expect(summary?.students['student1'].logicReward).toBe(0.7);
      expect(summary?.students['student1'].styleReward).toBe(0.5);
    });

    it('should track teaching moments', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      const attemptContext: AttemptContext = {
        studentId: 'student1',
        attemptType: 'code',
        source: 'ai_assisted',
        timeTakenMs: 5000,
        confidence: 0.3,
      };

      const attemptResult: AttemptResult = {
        success: false,
        domainRewards: {
          syntax: -0.5,
        },
        qualityScore: -0.3,
      };

      manager.recordAttempt(sessionId, 'student1', attemptContext, attemptResult);

      const summary = manager.getSessionSummary(sessionId);
      expect(summary?.session.teachingMoments).toBe(1);
      expect(summary?.students['student1'].learningOpportunities).toBe(1);
    });
  });

  describe('Session Completion', () => {
    it('should end session and calculate final metrics', async () => {
      const context: SessionStartContext = {
        studentIds: ['student1', 'student2'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      // Small delay to ensure session has duration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Record some attempts
      for (let i = 0; i < 5; i++) {
        const attemptContext: AttemptContext = {
          studentId: i % 2 === 0 ? 'student1' : 'student2',
          attemptType: 'quiz',
          source: 'automated',
          timeTakenMs: 3000,
          confidence: 0.7,
        };

        const attemptResult: AttemptResult = {
          success: i < 3,
          domainRewards: { comprehension: 0.6 },
          qualityScore: 0.5,
        };

        manager.recordAttempt(sessionId, attemptContext.studentId, attemptContext, attemptResult);
      }

      const finalMetrics = manager.endSession(sessionId);

      expect(finalMetrics).not.toBeNull();
      expect(finalMetrics?.phase).toBe(SessionPhase.COMPLETE);
      expect(finalMetrics?.endTime).not.toBeNull();
      expect(finalMetrics?.totalAttempts).toBe(5);
      expect(finalMetrics?.sessionDurationSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should calculate growth scores', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      // Successful attempts
      for (let i = 0; i < 5; i++) {
        manager.recordAttempt(
          sessionId,
          'student1',
          {
            studentId: 'student1',
            attemptType: 'quiz',
            source: 'automated',
            timeTakenMs: 3000,
            confidence: 0.8,
          },
          {
            success: true,
            domainRewards: { comprehension: 0.8 },
            qualityScore: 0.7,
          }
        );
      }

      manager.endSession(sessionId);

      const summary = manager.getSessionSummary(sessionId);
      expect(summary?.students['student1'].growthScore).toBeGreaterThan(0.5);
    });
  });

  describe('Statistics and Analysis', () => {
    it('should get global statistics', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId1 = manager.startSession(context);
      const sessionId2 = manager.startSession({ studentIds: ['student2'], topic: 'Test 2', difficulty: 2 });
      const sessionId3 = manager.startSession({ studentIds: ['student3'], topic: 'Test 3', difficulty: 1 });

      manager.recordAttempt(
        sessionId2,
        'student2',
        { studentId: 'student2', attemptType: 'quiz', source: 'automated', timeTakenMs: 3000, confidence: 0.7 },
        { success: true, domainRewards: {}, qualityScore: 0.5 }
      );
      manager.endSession(sessionId3);

      const stats = manager.getStatistics();
      expect(stats.totalSessions).toBeGreaterThan(0);
      expect(stats.activeSessions).toBeGreaterThanOrEqual(0);
    });

    it('should identify learning opportunities', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = 'test-learning-ops-session';
      manager.startSession({ ...context, sessionId });

      // Create attempts with learning opportunities
      for (let i = 0; i < 15; i++) {
        const attemptContext: AttemptContext = {
          studentId: 'student1',
          attemptType: 'code',
          source: 'ai_assisted',
          timeTakenMs: 5000,
          confidence: 0.5,
        };

        const attemptResult: AttemptResult = {
          success: i < 10,
          domainRewards: { syntax: i < 10 ? 0.5 : -0.3 },
          // Some low quality attempts to trigger teaching moments
          qualityScore: i < 10 ? 0.4 : 0.2,
        };

        manager.recordAttempt(sessionId, 'student1', attemptContext, attemptResult);
      }

      manager.endSession(sessionId);

      const opportunities = manager.identifyLearningOpportunities(0.3, 10);
      expect(opportunities.length).toBeGreaterThan(0);
    });
  });

  describe('State Persistence', () => {
    it('should get and restore state', () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId = manager.startSession(context);

      manager.recordAttempt(
        sessionId,
        'student1',
        { studentId: 'student1', attemptType: 'quiz', source: 'automated', timeTakenMs: 3000, confidence: 0.8 },
        { success: true, domainRewards: { comprehension: 0.7 }, qualityScore: 0.6 }
      );

      const state = manager.getState();

      // Create new manager and restore
      const newManager = new SessionManager();
      newManager.restoreState(state);

      const summary = newManager.getSessionSummary(sessionId);
      expect(summary).not.toBeNull();
      expect(summary?.session.totalAttempts).toBe(1);
    });
  });

  describe('Student History', () => {
    it('should get student session history', async () => {
      const context: SessionStartContext = {
        studentIds: ['student1'],
        topic: 'Test',
        difficulty: 1,
      };

      const sessionId1 = manager.startSession({ ...context, topic: 'Topic 1' });
      manager.endSession(sessionId1);

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const sessionId2 = manager.startSession({ ...context, topic: 'Topic 2' });
      manager.endSession(sessionId2);

      const history = manager.getStudentSessionHistory('student1');
      expect(history.length).toBe(2);
      // Check that both topics are present
      const topics = history.map(h => h.topic);
      expect(topics).toContain('Topic 1');
      expect(topics).toContain('Topic 2');
      // Most recent should be Topic 2 (higher start time)
      expect(history[0].startTime).toBeGreaterThanOrEqual(history[1].startTime);
    });
  });
});
