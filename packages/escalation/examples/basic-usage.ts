/**
 * Basic Usage Example for @studylog/escalation
 *
 * Demonstrates the core functionality of the Escalation Engine
 */

import {
  EscalationEngine,
  createContext,
  createDecisionResult,
  estimateCost,
  DecisionSource,
  EscalationReason,
  LearningPhase,
} from '../src/index';

function printHeader(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(title);
  console.log('='.repeat(60));
}

function printSection(title: string): void {
  console.log('\n' + '-'.repeat(40));
  console.log(title);
  console.log('-'.repeat(40));
}

async function main(): Promise<void> {
  printHeader('Escalation Engine - Basic Usage Example');

  // Initialize the engine
  const engine = new EscalationEngine({ enableLearning: true });

  // Example 1: Routine decision -> BOT
  printSection('Example 1: Routine FAQ (Expected: BOT)');

  // First, add some patterns to establish familiarity
  for (let i = 0; i < 10; i++) {
    const ctx = createContext('student-123', 'faq', `How do I reset password?`, {
      stakes: 0.2,
      similarDecisionsCount: 10,
    });
    engine.routeDecision(ctx);
  }

  const context1 = createContext('student-123', 'faq', 'How do I reset my password?', {
    stakes: 0.2,
    similarDecisionsCount: 10,
  });

  const decision1 = engine.routeDecision(context1);
  console.log(`  Situation: ${context1.situationDescription}`);
  console.log(`  Route to: ${decision1.source}`);
  console.log(`  Reason: ${decision1.reason ?? 'N/A'}`);
  console.log(`  Confidence required: ${decision1.confidenceRequired}`);
  console.log(`  Is novel: ${decision1.metadata.isNovel}`);

  // Example 2: Novel situation -> BRAIN
  printSection('Example 2: Novel Coding Question (Expected: BRAIN)');

  const context2 = createContext('student-456', 'coding', 'How do I implement a binary search tree in TypeScript?', {
    stakes: 0.6,
    similarDecisionsCount: 0,
    currentPhase: 'cognitive-mill',
  });

  const decision2 = engine.routeDecision(context2);
  console.log(`  Situation: ${context2.situationDescription}`);
  console.log(`  Route to: ${decision2.source}`);
  console.log(`  Reason: ${decision2.reason}`);
  console.log(`  Confidence required: ${decision2.confidenceRequired}`);
  console.log(`  Is novel: ${decision2.metadata.isNovel}`);

  // Example 3: Critical situation -> HUMAN
  printSection('Example 3: Critical Issue (Expected: HUMAN)');

  const context3 = createContext('student-789', 'security', 'Someone accessed my account without permission', {
    stakes: 0.95,
    urgencyMs: 100,
  });

  const decision3 = engine.routeDecision(context3);
  console.log(`  Situation: ${context3.situationDescription}`);
  console.log(`  Route to: ${decision3.source}`);
  console.log(`  Reason: ${decision3.reason}`);
  console.log(`  Confidence required: ${decision3.confidenceRequired}`);
  console.log(`  Is critical: ${decision3.metadata.isCriticalStakes}`);

  // Example 4: Stuck student -> BRAIN
  printSection('Example 4: Stuck Student (Expected: BRAIN)');

  const context4 = createContext('student-999', 'coding', 'Still getting errors with my code', {
    stakes: 0.5,
    recentFailures: 3,
    progressRatio: 0.3,
  });

  const decision4 = engine.routeDecision(context4);
  console.log(`  Situation: ${context4.situationDescription}`);
  console.log(`  Route to: ${decision4.source}`);
  console.log(`  Reason: ${decision4.reason}`);
  console.log(`  Recent failures: ${context4.recentFailures}`);

  // Example 5: Recording decisions and learning
  printSection('Example 5: Recording Decisions and Learning');

  const result1 = createDecisionResult(decision1.source, 'Provided password reset instructions', 0.9, {
    timeTakenMs: 5,
    costEstimate: estimateCost(decision1.source),
    metadata: { studentId: context1.studentId },
  });

  engine.recordDecision(result1);
  engine.recordOutcome(result1.decisionId, true);

  const result2 = createDecisionResult(decision2.source, 'Provided BST explanation with code', 0.8, {
    timeTakenMs: 350,
    costEstimate: estimateCost(decision2.source),
    metadata: { studentId: context2.studentId },
  });

  engine.recordDecision(result2);
  engine.recordOutcome(result2.decisionId, true);

  const result3 = createDecisionResult(decision3.source, 'Escalated to security team', 0.95, {
    timeTakenMs: 1200,
    costEstimate: estimateCost(decision3.source),
    metadata: { studentId: context3.studentId },
  });

  engine.recordDecision(result3);
  engine.recordOutcome(result3.decisionId, true);

  console.log(`  Recorded 3 decisions`);
  console.log(`  All outcomes marked as successful`);

  // Example 6: Statistics
  printSection('Example 6: Global Statistics');

  const globalStats = engine.getGlobalStats();
  console.log(`  Total decisions: ${globalStats.totalDecisions}`);
  console.log(`  Bot (free):   ${globalStats.botDecisions}`);
  console.log(`  Brain (local): ${globalStats.brainDecisions}`);
  console.log(`  Human (cloud): ${globalStats.humanDecisions}`);
  console.log(`  Total cost: $${globalStats.totalCost.toFixed(4)}`);
  console.log(`  Cost savings: $${globalStats.costSavings.toFixed(2)}`);
  console.log(`  Reduction ratio: ${globalStats.costReductionRatio.toFixed(1)}x`);

  // Example 7: Student-specific statistics
  printSection('Example 7: Student Statistics');

  const studentStats = engine.getStudentStats('student-123');
  console.log(`  Student: ${studentStats.studentId}`);
  console.log(`  Total decisions: ${studentStats.totalDecisions}`);
  console.log(`  Success rate: ${(studentStats.successRate * 100).toFixed(1)}%`);
  console.log(`  Avg confidence: ${studentStats.avgConfidence.toFixed(2)}`);
  console.log(`  Total cost: $${studentStats.totalCost.toFixed(4)}`);

  // Example 8: Custom thresholds
  printSection('Example 8: Custom Thresholds per Student');

  // Advanced student gets more bot usage
  engine.setThresholds('advanced-student', {
    botMinConfidence: 0.5, // Lower threshold = more bot usage
    brainMinConfidence: 0.3,
  });

  // Beginner gets more oversight
  engine.setThresholds('beginner-student', {
    botMinConfidence: 0.85, // Higher threshold = more brain/human
    brainMinConfidence: 0.7,
  });

  const advancedCtx = createContext('advanced-student', 'coding', 'Help with array methods', {
    stakes: 0.5,
    similarDecisionsCount: 5,
  });
  const advancedDecision = engine.routeDecision(advancedCtx);

  const beginnerCtx = createContext('beginner-student', 'coding', 'Help with array methods', {
    stakes: 0.5,
    similarDecisionsCount: 5,
  });
  const beginnerDecision = engine.routeDecision(beginnerCtx);

  console.log(`  Advanced student routes to: ${advancedDecision.source}`);
  console.log(`  Beginner student routes to: ${beginnerDecision.source}`);

  // Example 9: Phase-specific routing
  printSection('Example 9: Phase-Specific Routing');

  const millCtx = createContext('student-phase', 'coding', 'Create a function', {
    stakes: 0.5,
    currentPhase: 'cognitive-mill',
    similarDecisionsCount: 3,
  });
  const millDecision = engine.routeDecision(millCtx);

  const ranchCtx = createContext('student-phase', 'coding', 'Create a function', {
    stakes: 0.5,
    currentPhase: 'intelligence-ranch',
    similarDecisionsCount: 3,
  });
  const ranchDecision = engine.routeDecision(ranchCtx);

  console.log(`  Cognitive Mill phase routes to: ${millDecision.source}`);
  console.log(`  Intelligence Ranch phase routes to: ${ranchDecision.source}`);

  // Example 10: Should escalate check
  printSection('Example 10: Escalation Check');

  const lowConfidenceResult = createDecisionResult(DecisionSource.BOT, 'Maybe correct answer', 0.5);
  const [shouldEscalate, reason] = engine.shouldEscalate(lowConfidenceResult, millCtx);

  console.log(`  Bot decision with 0.5 confidence`);
  console.log(`  Should escalate: ${shouldEscalate}`);
  console.log(`  Reason: ${reason}`);

  printHeader('Demo Complete');
  console.log(`\nKey Takeaways:`);
  console.log(`  - Routine decisions go to free BOT tier`);
  console.log(`  - Novel/high-stakes decisions go to BRAIN tier`);
  console.log(`  - Critical/stuck situations go to HUMAN tier`);
  console.log(`  - Thresholds adapt based on outcomes`);
  console.log(`  - Significant cost savings vs. always using cloud APIs`);
  console.log('');
}

// Run the examples
main().catch(console.error);
