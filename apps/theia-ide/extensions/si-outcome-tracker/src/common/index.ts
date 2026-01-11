/**
 * Outcome Tracker - Public API
 *
 * Multi-domain reward tracking system for StudyLoG.AI
 * Adapted from https://github.com/SuperInstance/outcome-tracker
 */

// Core classes
export { OutcomeTracker } from './outcome-tracker';

// Aggregators
export {
  TimeWindowAggregator,
  DomainAggregator,
  StudentAggregator,
  CustomAggregator
} from './outcome-aggregators';

// Types
export {
  OutcomeType,
  StudyLogRewardDomain,
  RewardDomain,
  OutcomeRecord,
  RewardSignal,
  LearningContext,
  AggregationResult,
  OutcomeStatistics,
  DecisionQuality,
  TimeWindow,
  StudentOutcomeProgress
} from './outcome-types';
