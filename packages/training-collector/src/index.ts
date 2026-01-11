/**
 * StudyLoG.AI Training Data Collector
 *
 * A TypeScript/Node.js implementation of training data collection
 * for AI learning systems, based on research from SuperInstance/training-data-collector.
 *
 * @example
 * ```typescript
 * import { TrainingDataCollector, LearningContext, LearningDecisionType } from '@studylog/training-collector';
 *
 * const collector = new TrainingDataCollector();
 * await collector.init();
 *
 * await collector.logDecision({
 *   studentId: 'student-123',
 *   context: {
 *     learningState: { module: 'cognitive_mill', progress: 0.5, ... },
 *     studentState: { knowledgeLevel: 0.6, engagement: 0.8, ... },
 *   },
 *   decision: {
 *     decisionType: LearningDecisionType.PROBLEM_SOLVING,
 *     action: 'Implement gradient descent',
 *     reasoning: 'Applying lesson concepts to solve optimization problem',
 *     confidence: 0.75,
 *     source: DecisionSource.STUDENT,
 *     stakes: 0.6,
 *   },
 * });
 * ```
 */

// Main exports
export { TrainingDataCollector, getCollector, resetCollector } from './collectors/index.js';
export {
  logDecision,
  updateOutcome,
  getStatistics as getCollectorStatistics,
} from './collectors/index.js';

// Models
export * from './models/index.js';

// Storage
export * from './storage/index.js';

// Exporters
export * from './exporters/index.js';
