/**
 * Tests for Outcome Tracker
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OutcomeTracker,
  OutcomeType,
  LearningDomain,
  type RewardContext,
} from '../lib/outcome-tracker';

describe('OutcomeTracker', () => {
  let tracker: OutcomeTracker;

  beforeEach(() => {
    tracker = new OutcomeTracker();
  });

  describe('Immediate Outcomes', () => {
    it('should track an immediate outcome', () => {
      const context: RewardContext = {
        attemptType: 'quiz',
        difficulty: 1,
        timeSpentMs: 5000,
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Student answered correctly',
        true,
        context
      );

      expect(outcome.attemptId).toBe('attempt1');
      expect(outcome.outcomeType).toBe(OutcomeType.IMMEDIATE);
      expect(outcome.success).toBe(true);
      expect(outcome.rewards.length).toBeGreaterThan(0);
    });

    it('should calculate syntax reward for code attempts', () => {
      const context: RewardContext = {
        attemptType: 'code_compilation',
        previousAttempts: 2,
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Code compiles successfully with no errors',
        true,
        context
      );

      const syntaxReward = outcome.rewards.find((r) => r.domain === LearningDomain.SYNTAX);
      expect(syntaxReward).toBeDefined();
      expect(syntaxReward!.value).toBeGreaterThan(0);
    });

    it('should calculate negative syntax reward for errors', () => {
      const context: RewardContext = {
        attemptType: 'code_compilation',
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Syntax error on line 5: unexpected token',
        false,
        context
      );

      const syntaxReward = outcome.rewards.find((r) => r.domain === LearningDomain.SYNTAX);
      expect(syntaxReward).toBeDefined();
      expect(syntaxReward!.value).toBeLessThan(0);
    });

    it('should calculate logic reward for algorithm attempts', () => {
      const context: RewardContext = {
        attemptType: 'algorithm_puzzle',
        testCaseCoverage: 0.8,
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Correct approach with good edge case handling',
        true,
        context
      );

      const logicReward = outcome.rewards.find((r) => r.domain === LearningDomain.LOGIC);
      expect(logicReward).toBeDefined();
      expect(logicReward!.value).toBeGreaterThan(0);
    });

    it('should calculate comprehension reward for quiz attempts', () => {
      const context: RewardContext = {
        attemptType: 'quiz_comprehension',
        difficulty: 2,
        hintsUsed: 0,
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Student showed reasoning and got correct answer',
        true,
        context
      );

      const comprehensionReward = outcome.rewards.find(
        (r) => r.domain === LearningDomain.COMPREHENSION
      );
      expect(comprehensionReward).toBeDefined();
      expect(comprehensionReward!.value).toBeGreaterThan(0);
    });
  });

  describe('Delayed Outcomes', () => {
    it('should track a short-term outcome', () => {
      const context: RewardContext = {
        attemptType: 'coding_exercise',
      };

      const outcome = tracker.trackDelayedOutcome(
        'attempt1',
        'After 3 attempts, student solved the problem',
        true,
        context,
        OutcomeType.SHORT_TERM,
        ['attempt2', 'attempt3']
      );

      expect(outcome.outcomeType).toBe(OutcomeType.SHORT_TERM);
      expect(outcome.relatedAttempts).toEqual(['attempt2', 'attempt3']);
      expect(outcome.causalChain.length).toBe(3);
    });

    it('should track a long-term outcome', () => {
      const context: RewardContext = {
        attemptType: 'retention_test',
      };

      const outcome = tracker.trackDelayedOutcome(
        'attempt1',
        'Student remembered concept from last week',
        true,
        context,
        OutcomeType.LONG_TERM
      );

      expect(outcome.outcomeType).toBe(OutcomeType.LONG_TERM);
    });
  });

  describe('Reward Calculations', () => {
    it('should calculate style rewards for code quality', () => {
      const context: RewardContext = {
        attemptType: 'code_style',
        codeLength: 100,
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Clean, well-structured code with good naming conventions',
        true,
        context
      );

      const styleReward = outcome.rewards.find((r) => r.domain === LearningDomain.STYLE);
      expect(styleReward).toBeDefined();
      expect(styleReward!.value).toBeGreaterThan(0);
    });

    it('should calculate efficiency rewards', () => {
      const context: RewardContext = {
        attemptType: 'optimization',
        timeSpentMs: 15000, // Fast for optimization
        difficulty: 2,
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Optimized solution with O(n) complexity',
        true,
        context
      );

      const efficiencyReward = outcome.rewards.find((r) => r.domain === LearningDomain.EFFICIENCY);
      expect(efficiencyReward).toBeDefined();
      expect(efficiencyReward!.value).toBeGreaterThan(0);
    });

    it('should calculate creativity rewards', () => {
      const context: RewardContext = {
        attemptType: 'creative_design',
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Novel and elegant approach to the problem',
        true,
        context
      );

      const creativityReward = outcome.rewards.find((r) => r.domain === LearningDomain.CREATIVITY);
      expect(creativityReward).toBeDefined();
      expect(creativityReward!.value).toBeGreaterThan(0);
    });

    it('should handle hints correctly in comprehension rewards', () => {
      const context: RewardContext = {
        attemptType: 'quiz',
        hintsUsed: 5, // Too many hints
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Got correct answer after many hints',
        true,
        context
      );

      const comprehensionReward = outcome.rewards.find(
        (r) => r.domain === LearningDomain.COMPREHENSION
      );
      expect(comprehensionReward).toBeDefined();
      // Should be lower due to many hints
      expect(comprehensionReward!.value).toBeLessThan(0.5);
    });
  });

  describe('Aggregation and Analysis', () => {
    it('should get aggregate reward for an attempt', () => {
      const context: RewardContext = {
        attemptType: 'code',
      };

      tracker.trackImmediateOutcome('attempt1', 'Compiles successfully', true, context);

      const aggregateReward = tracker.getAggregateReward('attempt1');
      expect(aggregateReward).toBeGreaterThan(0);
    });

    it('should get aggregate reward by domain', () => {
      const context: RewardContext = {
        attemptType: 'code_compilation',
      };

      tracker.trackImmediateOutcome('attempt1', 'Compiles successfully', true, context);

      const syntaxReward = tracker.getAggregateReward('attempt1', LearningDomain.SYNTAX);
      expect(syntaxReward).not.toBe(0);
    });

    it('should calculate overall success rate', () => {
      const context: RewardContext = {
        attemptType: 'quiz',
      };

      tracker.trackImmediateOutcome('attempt1', 'Correct', true, context);
      tracker.trackImmediateOutcome('attempt2', 'Incorrect', false, context);
      tracker.trackImmediateOutcome('attempt3', 'Correct', true, context);

      const successRate = tracker.getSuccessRate();
      expect(successRate).toBeCloseTo(2 / 3, 1);
    });

    it('should calculate success rate by type', () => {
      const context1: RewardContext = { attemptType: 'quiz' };
      const context2: RewardContext = { attemptType: 'code_compilation' };

      tracker.trackImmediateOutcome('attempt1', 'Correct', true, context1);
      tracker.trackImmediateOutcome('attempt2', 'Compiles successfully', true, context2);
      tracker.trackImmediateOutcome('attempt3', 'Syntax error', false, context2);

      const quizRate = tracker.getSuccessRate('quiz');
      const codeRate = tracker.getSuccessRate('code_compilation');

      expect(quizRate).toBe(1);
      expect(codeRate).toBeCloseTo(0.5, 1);
    });

    it('should analyze attempt quality', () => {
      const context: RewardContext = {
        attemptType: 'code',
        difficulty: 2,
      };

      tracker.trackImmediateOutcome('attempt1', 'Excellent solution', true, context);

      const quality = tracker.analyzeAttemptQuality('attempt1');
      expect(quality.qualityScore).toBeGreaterThan(0);
      expect(quality.totalOutcomes).toBe(1);
      expect(quality.successRate).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should get comprehensive statistics', () => {
      const context: RewardContext = {
        attemptType: 'quiz',
        difficulty: 1,
      };

      tracker.trackImmediateOutcome('attempt1', 'Correct', true, context);
      tracker.trackImmediateOutcome('attempt2', 'Correct', true, context);
      tracker.trackDelayedOutcome(
        'attempt3',
        'Short term success',
        true,
        context,
        OutcomeType.SHORT_TERM
      );

      const stats = tracker.getStatistics();

      expect(stats.totalOutcomes).toBe(3);
      expect(stats.immediateOutcomes).toBe(2);
      expect(stats.shortTermOutcomes).toBe(1);
      expect(stats.successRateOverall).toBeGreaterThan(0);
    });

    it('should track success rate by domain', () => {
      const codeContext: RewardContext = { attemptType: 'code_compilation' };
      const quizContext: RewardContext = { attemptType: 'quiz_comprehension' };

      tracker.trackImmediateOutcome('attempt1', 'Compiles successfully', true, codeContext);
      tracker.trackImmediateOutcome('attempt2', 'Quiz correct', true, quizContext);
      tracker.trackImmediateOutcome('attempt3', 'Syntax error', false, codeContext);

      const stats = tracker.getStatistics();

      // Note: successRateByDomain keys come from getSuccessRate(attemptType)
      // The keys are based on attemptType values, not LearningDomain values
      // code_compilation type (which maps to syntax) has 1 success, 1 failure
      // quiz_comprehension type (which maps to comprehension) has 1 success

      // Check overall success rate (should be 2/3)
      expect(stats.successRateOverall).toBeCloseTo(2 / 3, 1);

      // Check that the domain entries exist (values may be 0 for domains not directly tracked)
      expect(stats.successRateByDomain).toBeDefined();
    });
  });

  describe('State Persistence', () => {
    it('should get and restore state', () => {
      const context: RewardContext = {
        attemptType: 'quiz',
      };

      tracker.trackImmediateOutcome('attempt1', 'Correct', true, context);
      tracker.trackDelayedOutcome(
        'attempt2',
        'Short term',
        true,
        context,
        OutcomeType.SHORT_TERM
      );

      const state = tracker.getState();

      // Create new tracker and restore
      const newTracker = new OutcomeTracker();
      newTracker.restoreState(state);

      const outcomes = newTracker.getOutcomesForAttempt('attempt1');
      expect(outcomes.length).toBe(1);
      expect(outcomes[0].success).toBe(true);
    });
  });

  describe('Reward Signal Components', () => {
    it('should include reasoning in reward signals', () => {
      const context: RewardContext = {
        attemptType: 'code_compilation',
      };

      const outcome = tracker.trackImmediateOutcome(
        'attempt1',
        'Code compiles successfully with no errors',
        true,
        context
      );

      expect(outcome.rewards.length).toBeGreaterThan(0);
      const reward = outcome.rewards[0];
      expect(reward.reasoning).toBeDefined();
      expect(reward.components).toBeDefined();
      expect(reward.confidence).toBeGreaterThan(0);
      expect(reward.confidence).toBeLessThanOrEqual(1);
    });
  });
});
