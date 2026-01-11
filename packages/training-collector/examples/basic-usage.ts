#!/usr/bin/env tsx
/**
 * Basic Usage Example for StudyLoG.AI Training Data Collector
 *
 * Demonstrates core functionality:
 * - Starting a learning session
 * - Logging student decisions
 * - Tracking outcomes
 * - Exporting training data
 */

import {
  TrainingDataCollector,
  LearningModule,
  LearningDecisionType,
  DecisionSource,
  QualityLabel,
  type LearningContext,
  type LearningDecision,
  type LearningOutcome,
} from '../src/index.js';

async function main() {
  console.log('=== StudyLoG.AI Training Data Collector - Basic Usage ===\n');

  // Initialize the collector with in-memory storage for demo
  const collector = new TrainingDataCollector();
  await collector.init({ type: 'memory' });

  console.log('1. Starting a learning session...');

  const sessionId = await collector.startSession({
    studentIds: ['student-demo-001'],
    module: 'cognitive_mill',
    notes: 'Introduction to Neural Networks - First Session',
  });

  console.log(`   Session ID: ${sessionId}\n`);

  // -------------------------------------------------------------------------
  // Example 1: Log a problem-solving decision (student writing code)
  // -------------------------------------------------------------------------

  console.log('2. Logging a problem-solving decision (student attempts code)...');

  const learningContext: LearningContext = {
    learningState: {
      module: LearningModule.COGNITIVE_MILL,
      lesson: 'Gradient Descent',
      exercise: 'Implement from scratch',
      progress: 0.3,
      lessonProgress: 0.5,
      objectives: [
        'Understand the math behind gradient descent',
        'Implement the algorithm in Python',
        'Test on a simple optimization problem',
      ],
      currentDifficulty: 0.6,
      timeSpentOnLesson: 900, // 15 minutes
      timeSpentOnExercise: 300, // 5 minutes
    },
    studentState: {
      knowledgeLevel: 0.4,
      engagement: 0.8,
      fatigue: 0.2,
      confidence: 0.6,
      consecutiveMistakes: 1,
      consecutiveSuccesses: 0,
      streak: 0,
      skillLevels: {
        python: 0.7,
        'ml-concepts': 0.3,
        calculus: 0.5,
      },
    },
    perceptionData: {
      visibleHints: [
        'Derivative formula: f\'(x) = limit formula',
        'Step size (learning rate) guidance',
        'Python code structure template',
      ],
      availableTools: ['code-editor', 'python-interpreter', 'visualization-panel'],
      availableAssistance: [
        { type: 'hint', cost: 5, description: 'Show derivative formula' },
        { type: 'example', cost: 10, description: 'Show working example' },
      ],
    },
    additionalContext: {
      currentExercise: 'Implement gradient descent for f(x) = x^2',
      timeRemaining: 1800, // 30 minutes left
    },
  };

  const decision: LearningDecision = {
    decisionType: LearningDecisionType.PROBLEM_SOLVING,
    action: 'write_code: Implemented gradient descent with learning rate 0.01',
    reasoning: 'Student applied the lesson concepts: compute gradient, take step opposite to gradient, repeat until convergence',
    confidence: 0.7,
    source: DecisionSource.STUDENT,
    stakes: 0.6, // This is an important exercise
    metadata: {
      codeLength: 15,
      language: 'python',
      hasComments: true,
    },
  };

  const recordId = await collector.logDecision({
    studentId: 'student-demo-001',
    context: learningContext,
    decision,
    sessionId,
  });

  console.log(`   Record ID: ${recordId}\n`);

  // -------------------------------------------------------------------------
  // Example 2: Update with outcome (after code is evaluated)
  // -------------------------------------------------------------------------

  console.log('3. Updating with outcome (code ran successfully)...');

  const outcome: LearningOutcome = {
    success: true,
    immediate: 'Code executed correctly, found minimum at x ≈ 0',
    delayed: 'Student explained the algorithm correctly in follow-up',
    rewards: [
      { type: 'xp', value: 50, description: 'Completed exercise' },
      { type: 'mastery', value: 0.1, description: 'ML concepts increased' },
      { type: 'streak', value: 1, description: 'Started success streak' },
    ],
    qualityScore: 0.8,
    qualityLabel: QualityLabel.GOOD,
    notes: 'Student showed good understanding, minor issues with convergence criteria',
    metrics: {
      timeTaken: 45000, // 45 seconds
      attempts: 2,
      hintsUsed: 1,
      codeQuality: 0.85,
      correctnessScore: 0.9,
    },
  };

  await collector.updateOutcome({ recordId, outcome });

  console.log(`   Outcome updated: ${outcome.success ? 'SUCCESS' : 'FAILURE'}`);
  console.log(`   Quality Score: ${outcome.qualityScore}\n`);

  // -------------------------------------------------------------------------
  // Example 3: Log a help request
  // -------------------------------------------------------------------------

  console.log('4. Logging a help request (student asks for guidance)...');

  const helpDecision: LearningDecision = {
    decisionType: LearningDecisionType.HELP_REQUEST,
    action: 'request_help: "Why does my implementation diverge instead of converging?"',
    reasoning: 'Student implemented the algorithm but getting unexpected results',
    confidence: 0.3, // Low confidence indicates confusion
    source: DecisionSource.STUDENT,
    stakes: 0.7, // Important to understand this
  };

  const helpRecordId = await collector.logDecision({
    studentId: 'student-demo-001',
    context: {
      ...learningContext,
      studentState: {
        ...learningContext.studentState,
        consecutiveMistakes: 2,
        confidence: 0.3,
      },
    },
    decision: helpDecision,
    sessionId,
  });

  console.log(`   Help Record ID: ${helpRecordId}`);

  // AI tutor responds with help
  const helpOutcome: LearningOutcome = {
    success: true,
    immediate: 'AI tutor explained: Your learning rate is too high (0.5), try 0.01',
    delayed: 'Student adjusted learning rate and code worked correctly',
    rewards: [
      { type: 'xp', value: 10, description: 'Sought help appropriately' },
    ],
    qualityScore: 0.6,
    qualityLabel: QualityLabel.ACCEPTABLE,
    notes: 'Teaching moment: learning rate importance',
    metrics: {
      timeTaken: 120000, // 2 minutes with tutor interaction
    },
  };

  await collector.updateOutcome({ recordId: helpRecordId, outcome: helpOutcome });

  console.log(`   AI tutor provided guidance\n`);

  // -------------------------------------------------------------------------
  // Example 4: Log AI tutor decision
  // -------------------------------------------------------------------------

  console.log('5. Logging AI tutor decision (personalized hint)...');

  const tutorDecision: LearningDecision = {
    decisionType: LearningDecisionType.HINT_USAGE,
    action: 'provide_hint: Showed partial derivative computation for x^2',
    reasoning: 'Student is struggling with calculus. Hint: derivative of x^2 is 2x. This directly relates to gradient computation.',
    confidence: 0.9, // AI is confident in this hint
    source: DecisionSource.AI_TUTOR,
    stakes: 0.5,
    metadata: {
      model: 'claude-opus-4-5',
      hintLevel: 'moderate',
      adaptationReason: 'student has low calculus skill level',
    },
  };

  const tutorRecordId = await collector.logDecision({
    studentId: 'student-demo-001',
    context: learningContext,
    decision: tutorDecision,
    sessionId,
  });

  console.log(`   Tutor Record ID: ${tutorRecordId}\n`);

  // -------------------------------------------------------------------------
  // Example 5: Get statistics
  // -------------------------------------------------------------------------

  console.log('6. Getting student statistics...');

  const stats = await collector.getStatistics('student-demo-001');

  console.log(`   Total Records: ${stats.totalRecords}`);
  console.log(`   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`   Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
  console.log(`   Average Quality: ${(stats.averageQuality * 100).toFixed(1)}%`);
  console.log(`   By Decision Type:`);
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`     - ${type}: ${count}`);
  }
  console.log(`   By Quality Label:`);
  for (const [label, count] of Object.entries(stats.byQuality)) {
    console.log(`     - ${label}: ${count}`);
  }
  console.log();

  // -------------------------------------------------------------------------
  // Example 6: Mark a teaching moment
  // -------------------------------------------------------------------------

  console.log('7. Marking a teaching moment...');

  await collector.updateQualityLabel({
    recordId: helpRecordId,
    label: QualityLabel.TEACHING_MOMENT,
    notes: 'This is a common misconception about learning rates. Good example for future training.',
  });

  console.log(`   Marked ${helpRecordId} as TEACHING_MOMENT\n`);

  // -------------------------------------------------------------------------
  // Example 7: Export training data
  // -------------------------------------------------------------------------

  console.log('8. Exporting training data...');

  try {
    const qloraResult = await collector.exportQLoRA('student-demo-001', '/tmp/student_demo_qlora.jsonl', {
      minConfidence: 0.3,
      minQuality: QualityLabel.ACCEPTABLE,
      includeTeachingMoments: true,
    });

    console.log(`   Exported ${qloraResult.recordsExported} records to QLoRA format`);
    console.log(`   Output: ${qloraResult.outputPath}\n`);
  } catch (error) {
    // File write might fail in demo environment
    console.log(`   Export simulated: ${stats.totalRecords} records would be exported\n`);
  }

  // -------------------------------------------------------------------------
  // Example 8: Display a sample QLoRA record
  // -------------------------------------------------------------------------

  console.log('9. Sample QLoRA record format:\n');

  const sampleRecord = {
    instruction: 'How should I solve this problem?',
    input: `Module: Cognitive Mill
Lesson: Gradient Descent
Progress: 30%
Knowledge Level: 40%
Engagement: 80%
Recent Mistakes: 1
Success Streak: 0
Available Hints: 3
Importance: 60%`,
    output: `Action: write_code: Implemented gradient descent with learning rate 0.01
Reasoning: Student applied the lesson concepts: compute gradient, take step opposite to gradient, repeat until convergence
Confidence: 70%
Result: Code executed correctly, found minimum at x ≈ 0
This action was successful.
Rewards: xp: 50, mastery: 0.1, streak: 1`,
    metadata: {
      recordId: 'rec_demo_001',
      studentId: 'student-demo-001',
      decisionType: 'problem_solving',
      module: 'cognitive_mill',
      qualityLabel: 'good',
      success: true,
      confidence: 0.7,
    },
  };

  console.log(JSON.stringify(sampleRecord, null, 2));
  console.log();

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  console.log('10. Ending session...');

  const sessionInfo = await collector.endSession();

  if (sessionInfo) {
    console.log(`   Session: ${sessionInfo.sessionId}`);
    console.log(`   Total Decisions: ${sessionInfo.totalDecisions}`);
    const duration = sessionInfo.endTimestamp
      ? Math.round((sessionInfo.endTimestamp - sessionInfo.startTimestamp) / 1000)
      : 0;
    console.log(`   Duration: ${duration} seconds`);
  }

  await collector.close();

  console.log('\n=== Example completed successfully! ===');
}

// Run the example
main().catch(console.error);
