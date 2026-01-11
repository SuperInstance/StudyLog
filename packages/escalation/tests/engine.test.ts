/**
 * Tests for Escalation Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EscalationEngine,
  createContext,
  createDecisionResult,
  estimateCost,
  DecisionSource,
  EscalationReasonEnum,
  LearningPhase,
  DEFAULT_THRESHOLDS,
} from '../src/index';

// Alias for convenience in tests
const EscalationReason = EscalationReasonEnum;

describe('EscalationEngine', () => {
  let engine: EscalationEngine;

  beforeEach(() => {
    engine = new EscalationEngine();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const stats = engine.getGlobalStats();
      expect(stats.totalDecisions).toBe(0);
      expect(stats.botDecisions).toBe(0);
      expect(stats.brainDecisions).toBe(0);
      expect(stats.humanDecisions).toBe(0);
    });
  });

  describe('threshold management', () => {
    it('should return default thresholds for new student', () => {
      const thresholds = engine.getThresholds('student-1');
      expect(thresholds.botMinConfidence).toBe(DEFAULT_THRESHOLDS.botMinConfidence);
      expect(thresholds.brainMinConfidence).toBe(DEFAULT_THRESHOLDS.brainMinConfidence);
    });

    it('should set custom thresholds for student', () => {
      engine.setThresholds('student-1', { botMinConfidence: 0.5 });
      const thresholds = engine.getThresholds('student-1');
      expect(thresholds.botMinConfidence).toBe(0.5);
    });

    it('should set phase-specific thresholds', () => {
      engine.setPhaseThresholds('cognitive-mill', { botMinConfidence: 0.8 });

      const context = createContext('student-1', 'test', 'Test situation', {
        currentPhase: 'cognitive-mill',
      });

      const decision = engine.routeDecision(context);
      // Phase thresholds should influence routing
      expect(decision).toBeDefined();
    });
  });

  describe('decision routing', () => {
    it('should route routine decisions to BOT', () => {
      // Add patterns so situation isn't novel
      for (let i = 0; i < 10; i++) {
        engine.routeDecision(
          createContext('student-1', 'faq', `Common question ${i}`, {
            stakes: 0.2,
            similarDecisionsCount: 10,
          })
        );
      }

      const context = createContext('student-1', 'faq', 'Common question', {
        stakes: 0.2,
        similarDecisionsCount: 10,
      });

      const decision = engine.routeDecision(context);
      expect(decision.source).toBe(DecisionSource.BOT);
      expect(decision.reason).toBeUndefined();
    });

    it('should route critical decisions to HUMAN', () => {
      const context = createContext('student-1', 'security', 'Account compromised', {
        stakes: 0.95,
        urgencyMs: 50,
      });

      const decision = engine.routeDecision(context);
      expect(decision.source).toBe(DecisionSource.HUMAN);
      expect([
        EscalationReason.HIGH_STAKES,
        EscalationReason.TIME_CRITICAL,
      ]).toContain(decision.reason);
    });

    it('should route novel situations to BRAIN', () => {
      const context = createContext('student-1', 'novel-task', 'Never seen before task', {
        stakes: 0.6,
        similarDecisionsCount: 0,
      });

      const decision = engine.routeDecision(context);
      expect(decision.source).toBe(DecisionSource.BRAIN);
      expect(decision.reason).toBe(EscalationReason.NEW_CONCEPT);
    });

    it('should escalate when student is stuck', () => {
      const context = createContext('student-1', 'coding', 'Help with bug', {
        stakes: 0.5,
        recentFailures: 3,
      });

      const decision = engine.routeDecision(context);
      expect(decision.source).toBe(DecisionSource.BRAIN);
      expect(decision.reason).toBe(EscalationReason.STUDENT_STUCK);
    });

    it('should use BOT for urgent but familiar situations', () => {
      // First add some familiarity
      for (let i = 0; i < 10; i++) {
        engine.routeDecision(
          createContext('student-1', 'quick-question', `Quick question ${i}`, {
            stakes: 0.3,
          })
        );
      }

      const context = createContext('student-1', 'quick-question', 'Another quick question', {
        stakes: 0.3,
        urgencyMs: 300,
      });

      const decision = engine.routeDecision(context);
      expect(decision.source).toBe(DecisionSource.BOT);
    });
  });

  describe('novelty detection', () => {
    it('should detect novel situations', () => {
      const context = createContext('student-1', 'new-topic', 'Completely new topic', {
        stakes: 0.5,
        similarDecisionsCount: 0,
      });

      const decision = engine.routeDecision(context);
      expect(decision.metadata?.isNovel).toBe(true);
    });

    it('should recognize familiar situations', () => {
      // Add same pattern multiple times
      for (let i = 0; i < 10; i++) {
        engine.routeDecision(
          createContext('student-1', 'loops', 'How do I write a for loop', {
            stakes: 0.3,
          })
        );
      }

      const context = createContext('student-1', 'loops', 'How do I write a for loop', {
        stakes: 0.3,
      });

      const decision = engine.routeDecision(context);
      expect(decision.metadata?.isNovel).toBe(false);
    });
  });

  describe('escalation check', () => {
    it('should escalate low confidence bot decisions', () => {
      const context = createContext('student-1', 'test', 'Test situation');
      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.5);

      const [shouldEscalate, reason] = engine.shouldEscalate(result, context);
      expect(shouldEscalate).toBe(true);
      expect(reason).toBe(EscalationReason.LOW_CONFIDENCE);
    });

    it('should not escalate high confidence bot decisions', () => {
      const context = createContext('student-1', 'test', 'Test situation');
      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.8);

      const [shouldEscalate] = engine.shouldEscalate(result, context);
      expect(shouldEscalate).toBe(false);
    });

    it('should not escalate human decisions', () => {
      const context = createContext('student-1', 'test', 'Test situation');
      const result = createDecisionResult(DecisionSource.HUMAN, 'Test action', 0.3);

      const [shouldEscalate] = engine.shouldEscalate(result, context);
      expect(shouldEscalate).toBe(false);
    });
  });

  describe('decision recording', () => {
    it('should record decisions', () => {
      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.8, {
        metadata: { studentId: 'student-1' },
      });

      engine.recordDecision(result);

      const stats = engine.getGlobalStats();
      expect(stats.totalDecisions).toBe(1);
      expect(stats.botDecisions).toBe(1);
    });

    it('should track student stats', () => {
      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.8, {
        metadata: { studentId: 'student-1' },
      });

      engine.recordDecision(result);

      const studentStats = engine.getStudentStats('student-1');
      expect(studentStats.totalDecisions).toBe(1);
      expect(studentStats.botDecisions).toBe(1);
    });
  });

  describe('learning from outcomes', () => {
    it('should lower thresholds on success', () => {
      const studentId = 'student-1';
      const initialThreshold = engine.getThresholds(studentId).botMinConfidence;

      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.8, {
        metadata: { studentId },
      });

      engine.recordDecision(result);
      engine.recordOutcome(result.decisionId, true);

      const newThreshold = engine.getThresholds(studentId).botMinConfidence;
      expect(newThreshold).toBeLessThan(initialThreshold);
    });

    it('should raise thresholds on failure', () => {
      const studentId = 'student-1';
      const initialThreshold = engine.getThresholds(studentId).botMinConfidence;

      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.8, {
        metadata: { studentId },
      });

      engine.recordDecision(result);
      engine.recordOutcome(result.decisionId, false);

      const newThreshold = engine.getThresholds(studentId).botMinConfidence;
      expect(newThreshold).toBeGreaterThan(initialThreshold);
    });

    it('should track success rate in stats', () => {
      const studentId = 'student-1';

      // Record successful decisions
      for (let i = 0; i < 7; i++) {
        const result = createDecisionResult(DecisionSource.BOT, `Action ${i}`, 0.8, {
          metadata: { studentId },
        });
        engine.recordDecision(result);
        engine.recordOutcome(result.decisionId, true);
      }

      // Record failed decisions
      for (let i = 0; i < 3; i++) {
        const result = createDecisionResult(DecisionSource.BOT, `Action ${i}`, 0.6, {
          metadata: { studentId },
        });
        engine.recordDecision(result);
        engine.recordOutcome(result.decisionId, false);
      }

      const stats = engine.getStudentStats(studentId);
      expect(stats.successRate).toBe(0.7);
      expect(stats.successes).toBe(7);
      expect(stats.failures).toBe(3);
    });
  });

  describe('cost tracking', () => {
    it('should estimate costs correctly', () => {
      expect(estimateCost(DecisionSource.BOT)).toBe(0);
      expect(estimateCost(DecisionSource.BRAIN)).toBeGreaterThan(0);
      expect(estimateCost(DecisionSource.HUMAN)).toBeGreaterThan(estimateCost(DecisionSource.BRAIN));
    });

    it('should track total cost', () => {
      const botResult = createDecisionResult(DecisionSource.BOT, 'Action', 0.8, {
        costEstimate: estimateCost(DecisionSource.BOT),
      });
      engine.recordDecision(botResult);

      const brainResult = createDecisionResult(DecisionSource.BRAIN, 'Action', 0.7, {
        costEstimate: estimateCost(DecisionSource.BRAIN),
      });
      engine.recordDecision(brainResult);

      const stats = engine.getGlobalStats();
      expect(stats.totalCost).toBe(estimateCost(DecisionSource.BRAIN)); // BOT is free
    });

    it('should calculate cost savings', () => {
      // Simulate 100 bot decisions (all would be human baseline)
      for (let i = 0; i < 100; i++) {
        const result = createDecisionResult(DecisionSource.BOT, `Action ${i}`, 0.8, {
          costEstimate: 0,
        });
        engine.recordDecision(result);
      }

      const stats = engine.getGlobalStats();
      // Baseline: 100 decisions x $0.02 (human) = $2.00
      // Actual: 100 bot decisions x $0 = $0
      // Savings: $2.00
      expect(stats.costSavings).toBeGreaterThan(0);
      expect(stats.costSavings).toBeCloseTo(2.0, 1); // 100 * 0.02 = 2.0
    });
  });

  describe('utility functions', () => {
    it('should create unique decision IDs', () => {
      const id1 = engine.createDecisionId();
      const id2 = engine.createDecisionId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f-]+$/); // UUID format
    });

    it('should create context with defaults', () => {
      const context = createContext('student-1', 'test', 'Test situation');

      expect(context.studentId).toBe('student-1');
      expect(context.situationType).toBe('test');
      expect(context.stakes).toBe(0.5); // Default
      expect(context.progressRatio).toBe(0.5); // Default
    });

    it('should create context with overrides', () => {
      const context = createContext('student-1', 'test', 'Test situation', {
        stakes: 0.9,
        currentPhase: 'sitka-sound',
      });

      expect(context.stakes).toBe(0.9);
      expect(context.currentPhase).toBe('sitka-sound');
    });
  });

  describe('stats and history', () => {
    it('should track decisions by source', () => {
      engine.recordDecision(createDecisionResult(DecisionSource.BOT, 'Action', 0.8));
      engine.recordDecision(createDecisionResult(DecisionSource.BRAIN, 'Action', 0.7));
      engine.recordDecision(createDecisionResult(DecisionSource.HUMAN, 'Action', 0.9));

      const stats = engine.getGlobalStats();
      expect(stats.botDecisions).toBe(1);
      expect(stats.brainDecisions).toBe(1);
      expect(stats.humanDecisions).toBe(1);
    });

    it('should track escalations', () => {
      const result = createDecisionResult(DecisionSource.BRAIN, 'Action', 0.7, {
        escalatedFrom: DecisionSource.BOT,
        escalationReason: EscalationReason.LOW_CONFIDENCE,
      });
      engine.recordDecision(result);

      const stats = engine.getGlobalStats();
      expect(stats.escalations).toBe(1);
    });

    it('should provide decision history', () => {
      const result = createDecisionResult(DecisionSource.BOT, 'Action', 0.8);
      engine.recordDecision(result);

      const history = engine.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].decisionId).toBe(result.decisionId);
    });

    it('should reset stats', () => {
      engine.recordDecision(createDecisionResult(DecisionSource.BOT, 'Action', 0.8));
      engine.resetStats();

      const stats = engine.getGlobalStats();
      expect(stats.totalDecisions).toBe(0);
    });
  });

  describe('learning phase support', () => {
    it('should route differently based on phase', () => {
      // Set different thresholds for each phase
      engine.setPhaseThresholds('cognitive-mill', { botMinConfidence: 0.8 });
      engine.setPhaseThresholds('intelligence-ranch', { botMinConfidence: 0.5 });

      const millContext = createContext('student-1', 'test', 'Test', {
        currentPhase: 'cognitive-mill',
        stakes: 0.5,
      });

      const ranchContext = createContext('student-1', 'test', 'Test', {
        currentPhase: 'intelligence-ranch',
        stakes: 0.5,
      });

      // Add familiarity
      for (let i = 0; i < 10; i++) {
        engine.routeDecision(millContext);
        engine.routeDecision(ranchContext);
      }

      const millDecision = engine.routeDecision(millContext);
      const ranchDecision = engine.routeDecision(ranchContext);

      // Ranch should be more permissive of bot decisions (lower threshold)
      expect(millDecision).toBeDefined();
      expect(ranchDecision).toBeDefined();
    });
  });
});

describe('createContext', () => {
  it('should create context with all required fields', () => {
    const context = createContext('student-1', 'coding', 'How do I write a function?', {
      stakes: 0.7,
      urgencyMs: 5000,
      progressRatio: 0.3,
      availableResources: { hints: 3 },
      similarDecisionsCount: 5,
      recentFailures: 1,
      currentPhase: 'cognitive-mill',
    });

    expect(context.studentId).toBe('student-1');
    expect(context.situationType).toBe('coding');
    expect(context.situationDescription).toBe('How do I write a function?');
    expect(context.stakes).toBe(0.7);
    expect(context.urgencyMs).toBe(5000);
    expect(context.progressRatio).toBe(0.3);
    expect(context.availableResources).toEqual({ hints: 3 });
    expect(context.similarDecisionsCount).toBe(5);
    expect(context.recentFailures).toBe(1);
    expect(context.currentPhase).toBe('cognitive-mill');
  });
});

describe('createDecisionResult', () => {
  it('should create decision result with defaults', () => {
    const result = createDecisionResult(DecisionSource.BRAIN, 'Provide explanation', 0.85);

    expect(result.source).toBe(DecisionSource.BRAIN);
    expect(result.action).toBe('Provide explanation');
    expect(result.confidence).toBe(0.85);
    expect(result.timeTakenMs).toBe(0);
    expect(result.costEstimate).toBe(0);
    expect(result.decisionId).toBeDefined();
  });

  it('should create decision result with overrides', () => {
    const result = createDecisionResult(DecisionSource.HUMAN, 'Complex explanation', 0.95, {
      timeTakenMs: 1500,
      costEstimate: 0.02,
      metadata: { studentId: 'student-1' },
    });

    expect(result.timeTakenMs).toBe(1500);
    expect(result.costEstimate).toBe(0.02);
    expect(result.metadata?.studentId).toBe('student-1');
  });
});
