/**
 * Personal Log - Analytics Module
 *
 * Analytics and insights for SuperInstance products
 */

// Types
export type {
  // Event types
  EventType,
  EventCategory,
  CoreEventType,
  StudyLogEventType,
  DMLogEventType,

  // Event structures
  AnalyticsEvent,
  EventData,
  EventMetadata,

  // Event data types
  MessageSentData,
  FeatureUsedData,
  SessionStartData,
  SessionEndData,
  ErrorOccurredData,
  APIResponseData,
  LessonStartedData,
  LessonCompletedData,
  ConceptMasteredData,
  SkillUnlockedData,
  AgentBredData,
  MillSimulationStartedData,
  EncounterStartedData,
  EncounterCompletedData,
  NPCCreatedData,
  CampaignSessionStartedData,
  GenericEventData,

  // Aggregation types
  TimeRange,
  AggregationBucket,
  AggregatedStats,
  TimeSeriesPoint,

  // Insight types
  Insight,
  InsightSeverity,
  InsightCategory,
  LearningInsight,
  EngagementInsight,
  PerformanceInsight,

  // Summary types
  DailySummary,
  WeeklySummary,
  StudyLogDailyStats,
  DMLogDailyStats,

  // Configuration
  AnalyticsConfig,
  QueryOptions,
} from './types'

export { DEFAULT_ANALYTICS_CONFIG } from './types'

// Storage
export {
  analyticsEventStore,
  analyticsMetadataStore,
  applyRetentionPolicy,
  getStorageSize,
  clearAllAnalyticsData,
} from './storage'

// Collector
export {
  EventCollector,
  getEventCollector,
  initializeAnalytics,
  track,
  setAnalyticsSessionId,
  getAnalyticsConfig,
} from './collector'

// Insights
export {
  InsightsEngine,
  getInsightsEngine,
  generateRecentInsights,
  getTodaysSummary,
  getThisWeeksSummary,
} from './insights'
