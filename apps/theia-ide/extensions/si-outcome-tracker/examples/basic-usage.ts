/**
 * Outcome Tracker Usage Examples
 *
 * This file demonstrates how to use the OutcomeTracker in StudyLoG.AI
 */

import {
  OutcomeTracker,
  DomainAggregator,
  TimeWindowAggregator,
  StudentAggregator,
  StudyLogRewardDomain,
  OutcomeType,
  LearningContext
} from '../src/common/index';

// ============================================================================
// Example 1: Basic Outcome Tracking
// ============================================================================

function example1_BasicTracking() {
  console.log('=== Example 1: Basic Outcome Tracking ===\n');

  const tracker = new OutcomeTracker();

  // Track a puzzle completion
  const outcome = tracker.trackImmediateOutcome(
    'circuit_puzzle_001',
    'Completed NAND gate puzzle in 2 attempts',
    true,
    {
      decisionType: 'cognitive',
      puzzleId: 'circuit_001',
      attempts: 2,
      timeSeconds: 180,
      hintsUsed: 0,
      userId: 'student_123'
    }
  );

  console.log(`Tracked ${outcome.rewards.length} reward signals:`);
  for (const reward of outcome.rewards) {
    console.log(`  - ${reward.domain}: ${reward.value.toFixed(3)}`);
    console.log(`    Components: ${JSON.stringify(reward.components)}`);
  }

  // Get aggregate reward
  const totalReward = tracker.getAggregateReward('circuit_puzzle_001');
  const cognitiveReward = tracker.getAggregateReward(
    'circuit_puzzle_001',
    StudyLogRewardDomain.COGNITIVE
  );

  console.log(`\nTotal reward: ${totalReward.toFixed(3)}`);
  console.log(`Cognitive reward: ${cognitiveReward.toFixed(3)}`);
}

// ============================================================================
// Example 2: Tracking Multiple Learning Activities
// ============================================================================

function example2_MultipleActivities() {
  console.log('\n=== Example 2: Multiple Learning Activities ===\n');

  const tracker = new OutcomeTracker();

  // Track quiz answers
  tracker.trackImmediateOutcome(
    'quiz_transformers_q1',
    'Answered transformer question correctly',
    true,
    {
      decisionType: 'cognitive',
      quizId: 'transformers_basics',
      questionId: 'q1',
      timeSeconds: 30,
      userId: 'student_123'
    }
  );

  tracker.trackImmediateOutcome(
    'quiz_transformers_q2',
    'Answered transformer question incorrectly',
    false,
    {
      decisionType: 'cognitive',
      quizId: 'transformers_basics',
      questionId: 'q2',
      timeSeconds: 45,
      userId: 'student_123'
    }
  );

  // Track peer help
  tracker.trackImmediateOutcome(
    'help_peer_456',
    'Helped peer with circuit design basics',
    true,
    {
      decisionType: 'collaborative',
      helpedUserId: 'student_456',
      topic: 'circuit design',
      userId: 'student_123'
    }
  );

  // Track discovery
  tracker.trackImmediateOutcome(
    'discovery_new_technique',
    'Discovered faster method for transistor optimization',
    true,
    {
      decisionType: 'discovery',
      discoveryType: 'optimization_technique',
      userId: 'student_123'
    }
  );

  // Get statistics
  const stats = tracker.getStatistics();
  console.log(`Total outcomes: ${stats.totalOutcomes}`);
  console.log(`Overall success rate: ${(stats.successRateOverall * 100).toFixed(1)}%`);
  console.log(`Average reward: ${stats.avgRewardSignal.toFixed(3)}`);
}

// ============================================================================
// Example 3: Temporal Tracking with Causal Chains
// ============================================================================

function example3_TemporalTracking() {
  console.log('\n=== Example 3: Temporal Tracking with Causal Chains ===\n');

  const tracker = new OutcomeTracker();

  // Initial learning activity
  tracker.trackImmediateOutcome(
    'learn_transformer_basics',
    'Completed transformer basics tutorial',
    true,
    {
      decisionType: 'cognitive',
      stage: 1,
      userId: 'student_123'
    }
  );

  // Related short-term outcome
  tracker.trackDelayedOutcome(
    'apply_transformer_knowledge',
    'Successfully built transformer from memory',
    true,
    {
      decisionType: 'mastery',
      stage: 1,
      userId: 'student_123'
    },
    OutcomeType.SHORT_TERM,
    ['learn_transformer_basics']
  );

  // Long-term mastery outcome
  tracker.trackDelayedOutcome(
    'transformer_mastery',
    'Created custom transformer variant for amplifier project',
    true,
    {
      decisionType: 'mastery',
      skill: 'transformer_design',
      userId: 'student_123'
    },
    OutcomeType.LONG_TERM,
    ['learn_transformer_basics', 'apply_transformer_knowledge']
  );

  // Analyze causal chains
  const stats = tracker.getStatistics();
  console.log(`Causal chains detected: ${stats.totalCausalChains}`);
  console.log(`Average chain length: ${stats.avgChainLength.toFixed(1)}`);

  // Get outcomes with causal chains
  const outcomes = tracker.getOutcomesForDecision('transformer_mastery');
  if (outcomes.length > 0) {
    console.log(`Causal chain: ${outcomes[0].causalChain.join(' -> ')}`);
  }
}

// ============================================================================
// Example 4: Domain Aggregation
// ============================================================================

function example4_DomainAggregation() {
  console.log('\n=== Example 4: Domain Aggregation ===\n');

  const tracker = new OutcomeTracker();

  // Track various activities
  const activities = [
    { type: 'cognitive', desc: 'Solved logic puzzle', success: true },
    { type: 'collaborative', desc: 'Helped peer with code', success: true },
    { type: 'discovery', desc: 'Found optimization technique', success: true },
    { type: 'cognitive', desc: 'Failed quiz question', success: false },
    { type: 'creative', desc: 'Created new simulation', success: true },
  ];

  activities.forEach((activity, i) => {
    tracker.trackImmediateOutcome(
      `activity_${i}`,
      activity.desc,
      activity.success,
      { decisionType: activity.type, userId: 'student_123' }
    );
  });

  // Aggregate by domain
  const domainAgg = new DomainAggregator(tracker);
  const summary = domainAgg.getDomainSummary();

  console.log('Performance by domain:');
  for (const [domain, data] of Object.entries(summary)) {
    console.log(`  ${domain}:`);
    console.log(`    Count: ${data.count}`);
    console.log(`    Success rate: ${(data.successRate * 100).toFixed(1)}%`);
    console.log(`    Avg reward: ${data.avgReward.toFixed(3)}`);
  }

  // Find best/worst domains
  const best = domainAgg.getBestDomain();
  const worst = domainAgg.getWorstDomain();
  console.log(`\nBest domain: ${best}`);
  console.log(`Worst domain: ${worst}`);
}

// ============================================================================
// Example 5: Time-Based Analysis
// ============================================================================

function example5_TimeBasedAnalysis() {
  console.log('\n=== Example 5: Time-Based Analysis ===\n');

  const tracker = new OutcomeTracker();

  // Simulate activities over time
  const now = Date.now() / 1000;
  const outcomes: any[] = [];

  for (let i = 0; i < 10; i++) {
    const outcome = tracker.trackImmediateOutcome(
      `session_activity_${i}`,
      `Completed learning activity ${i + 1}`,
      i % 3 !== 0, // 2/3 success rate
      {
        decisionType: 'cognitive',
        userId: 'student_123',
        session: 'session_1'
      }
    );
    outcomes.push(outcome);
  }

  // Analyze recent activity
  const timeAgg = new TimeWindowAggregator(tracker);
  const recent = timeAgg.aggregateLastNMinutes(60);

  console.log('Last 60 minutes:');
  console.log(`  Activities: ${recent.count}`);
  console.log(`  Success rate: ${(recent.successCount / recent.count * 100).toFixed(1)}%`);
  console.log(`  Average reward: ${recent.avgReward.toFixed(3)}`);
}

// ============================================================================
// Example 6: Decision Quality Analysis
// ============================================================================

function example6_DecisionQuality() {
  console.log('\n=== Example 6: Decision Quality Analysis ===\n');

  const tracker = new OutcomeTracker();

  // Track multiple outcomes for the same decision
  const decisionId = 'project_amplifier';

  // Planning phase
  tracker.trackImmediateOutcome(
    `${decisionId}_plan`,
    'Created detailed project plan',
    true,
    { decisionType: 'strategic', userId: 'student_123' }
  );

  // Implementation phase
  tracker.trackImmediateOutcome(
    `${decisionId}_implement`,
    'Built amplifier circuit with correct components',
    true,
    { decisionType: 'cognitive', userId: 'student_123', attempts: 2 }
  );

  // Testing phase
  tracker.trackDelayedOutcome(
    decisionId,
    'Amplifier works within specifications',
    true,
    { decisionType: 'mastery', userId: 'student_123' },
    OutcomeType.SHORT_TERM,
    [`${decisionId}_plan`, `${decisionId}_implement`]
  );

  // Analyze quality
  const quality = tracker.analyzeDecisionQuality(decisionId);

  console.log('Decision Quality Analysis:');
  console.log(`  Quality Score: ${quality.qualityScore.toFixed(3)}`);
  console.log(`  Confidence: ${quality.confidence.toFixed(2)}`);
  console.log(`  Success Rate: ${(quality.successRate * 100).toFixed(1)}%`);
  console.log(`  Total Outcomes: ${quality.totalOutcomes}`);
  console.log(`  Reasoning: ${quality.reasoning}`);

  if (Object.keys(quality.domainScores).length > 0) {
    console.log('  Domain Scores:');
    for (const [domain, score] of Object.entries(quality.domainScores)) {
      console.log(`    ${domain}: ${score.toFixed(3)}`);
    }
  }
}

// ============================================================================
// Example 7: Student Comparison
// ============================================================================

function example7_StudentComparison() {
  console.log('\n=== Example 7: Student Comparison ===\n');

  const tracker = new OutcomeTracker();

  // Track activities for multiple students
  const students = ['alice', 'bob', 'charlie'];

  students.forEach(student => {
    for (let i = 0; i < 5; i++) {
      const success = Math.random() > 0.3; // 70% success rate average
      tracker.trackImmediateOutcome(
        `${student}_activity_${i}`,
        `${success ? 'Completed' : 'Failed'} learning activity`,
        success,
        {
          decisionType: 'cognitive',
          userId: student,
          attempts: success ? Math.floor(Math.random() * 2) + 1 : 3
        }
      );
    }
  });

  // Aggregate by student
  const studentAgg = new StudentAggregator(tracker);
  const ranking = studentAgg.getStudentRanking();

  console.log('Student Ranking (by average reward):');
  ranking.forEach(([student, reward], index) => {
    console.log(`  ${index + 1}. ${student}: ${reward.toFixed(3)}`);
  });
}

// ============================================================================
// Example 8: Export and Import
// ============================================================================

function example8_ExportImport() {
  console.log('\n=== Example 8: Export and Import ===\n');

  const tracker = new OutcomeTracker();

  // Add some sample data
  tracker.trackImmediateOutcome(
    'sample_outcome',
    'Sample learning outcome',
    true,
    { decisionType: 'cognitive', userId: 'student_123' }
  );

  // Export to JSON
  const exported = tracker.exportToJson();
  console.log(`Exported ${exported.outcomes.length} outcomes`);
  console.log(`Statistics: ${JSON.stringify(exported.statistics, null, 2)}`);

  // Create new tracker and import
  const newTracker = new OutcomeTracker();
  newTracker.importFromJson(exported);

  const newStats = newTracker.getStatistics();
  console.log(`Imported tracker has ${newStats.totalOutcomes} outcomes`);
}

// ============================================================================
// Run All Examples
// ============================================================================

export function runAllExamples() {
  example1_BasicTracking();
  example2_MultipleActivities();
  example3_TemporalTracking();
  example4_DomainAggregation();
  example5_TimeBasedAnalysis();
  example6_DecisionQuality();
  example7_StudentComparison();
  example8_ExportImport();

  console.log('\n=== All Examples Complete ===');
}
