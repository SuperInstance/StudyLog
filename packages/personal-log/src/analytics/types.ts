/**
 * Personal Log - Analytics Types
 *
 * Core analytics types for session tracking and learning analytics
 */

import type { ProductId } from '../session/types'

// ============================================================================
// EVENT CATEGORIES
// ============================================================================

/**
 * Analytics event categories
 */
export type EventCategory =
  | 'user_action'        // User-initiated actions
  | 'learning'           // Learning progress events (StudyLoG.AI)
  | 'gaming'             // TTRPG session events (DMLoG.AI)
  | 'performance'        // Performance measurements
  | 'engagement'         // User engagement metrics
  | 'error'             // Error events
  | 'system'            // System-level events

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Core event types (product-agnostic)
 */
export type CoreEventType =
  // User Actions
  | 'message_sent'
  | 'conversation_created'
  | 'search_performed'
  | 'settings_changed'

  // Engagement
  | 'session_start'
  | 'session_end'
  | 'feature_used'

  // Performance
  | 'api_response'
  | 'render_complete'
  | 'storage_operation'

  // Errors
  | 'error_occurred'
  | 'error_recovered'

  // System
  | 'app_initialized'
  | 'hardware_detected'

/**
 * StudyLoG.AI specific events
 */
export type StudyLogEventType =
  // Learning Progress
  | 'lesson_started'
  | 'lesson_completed'
  | 'lesson_skipped'
  | 'concept_mastered'
  | 'skill_unlocked'
  | 'skill_practiced'

  // Cognitive Mill
  | 'mill_simulation_started'
  | 'mill_simulation_completed'
  | 'token_visualization_viewed'
  | 'attention_heatmap_viewed'

  // Intelligence Ranch
  | 'agent_bred'
  | 'agent_trained'
  | 'agent_released'
  | 'skill_tree_viewed'
  | 'steering_behavior_tested'

  // Sitka Sound
  | 'flock_simulation_started'
  | 'ecosystem_created'
  | 'game_theory_experiment'

  // Digital Twins
  | 'hardware_connected'
  | 'physics_simulation_run'

/**
 * DMLoG.AI specific events
 */
export type DMLogEventType =
  // Campaign Management
  | 'campaign_created'
  | 'campaign_session_started'
  | 'campaign_session_ended'
  | 'world_building_session'

  // Encounter Management
  | 'encounter_created'
  | 'encounter_started'
  | 'encounter_completed'

  // NPC Management
  | 'npc_created'
  | 'npc_interaction'
  | 'personality_adjusted'

  // Party Management
  | 'character_created'
  | 'party_formed'
  | 'tactical_combat_started'

  // Visualization
  | 'battle_map_opened'
  | 'token_moved'
  | 'effect_activated'

/**
 * All event types
 */
export type EventType =
  | CoreEventType
  | StudyLogEventType
  | DMLogEventType

// ============================================================================
// BASE EVENT
// ============================================================================

/**
 * Base analytics event structure
 */
export interface AnalyticsEvent {
  /** Unique event identifier */
  id: string

  /** Event type */
  type: EventType

  /** Event category */
  category: EventCategory

  /** Event timestamp (ISO 8601) */
  timestamp: string

  /** Session identifier */
  sessionId: string

  /** Product identifier */
  productId: ProductId

  /** Event-specific data */
  data: EventData

  /** Optional metadata */
  metadata?: EventMetadata
}

/**
 * Event metadata
 */
export interface EventMetadata {
  /** Hardware profile hash */
  hardwareHash?: string

  /** Feature flags active at time of event */
  activeFeatures?: string[]

  /** App version */
  appVersion?: string

  /** Platform info */
  platform?: string

  /** User cohort for analysis */
  cohort?: string
}

// ============================================================================
// EVENT DATA (DISCRIMINATED UNION)
// ============================================================================

/**
 * Event data for specific event types
 */
export type EventData =
  | MessageSentData
  | LessonStartedData
  | LessonCompletedData
  | ConceptMasteredData
  | SkillUnlockedData
  | AgentBredData
  | EncounterStartedData
  | EncounterCompletedData
  | FeatureUsedData
  | SessionStartData
  | SessionEndData
  | ErrorOccurredData
  | APIResponseData
  | GenericEventData

// ============================================================================
// CORE EVENT DATA TYPES
// ============================================================================

export interface MessageSentData {
  type: 'message_sent'
  conversationId: string
  messageLength: number
  hasAttachment: boolean
}

export interface FeatureUsedData {
  type: 'feature_used'
  featureId: string
  duration?: number
  success: boolean
  context?: Record<string, unknown>
}

export interface SessionStartData {
  type: 'session_start'
  source: 'direct' | 'notification' | 'link'
  previousSessionTime?: number
}

export interface SessionEndData {
  type: 'session_end'
  duration: number
  actionsPerformed: number
  messagesSent: number
  featuresUsed: string[]
}

export interface ErrorOccurredData {
  type: 'error_occurred'
  errorType: string
  errorMessage: string
  context: string
  recoverable: boolean
}

export interface APIResponseData {
  type: 'api_response'
  endpoint: string
  method: string
  duration: number
  success: boolean
  statusCode?: number
}

// ============================================================================
// STUDYLOG.AI EVENT DATA TYPES
// ============================================================================

export interface LessonStartedData {
  type: 'lesson_started'
  lessonId: string
  lessonTitle: string
  category: 'cognitive-mill' | 'intelligence-ranch' | 'sitka-sound' | 'digital-twins'
}

export interface LessonCompletedData {
  type: 'lesson_completed'
  lessonId: string
  lessonTitle: string
  duration: number
  score?: number
  completionPercentage: number
  conceptsLearned: string[]
}

export interface ConceptMasteredData {
  type: 'concept_mastered'
  conceptId: string
  conceptName: string
  category: string
  practiceTime: number
  accuracy: number
}

export interface SkillUnlockedData {
  type: 'skill_unlocked'
  skillId: string
  skillName: string
  skillTree: string
  requiredPoints: number
  pointsSpent: number
}

export interface AgentBredData {
  type: 'agent_bred'
  agentId: string
  parent1Id: string
  parent2Id: string
  inheritedTraits: string[]
  personalitySeed: string
}

export interface MillSimulationStartedData {
  type: 'mill_simulation_started'
  simulationType: 'token-flow' | 'attention' | 'neural-network'
  parameters: Record<string, unknown>
}

// ============================================================================
// DMLOG.AI EVENT DATA TYPES
// ============================================================================

export interface EncounterStartedData {
  type: 'encounter_started'
  encounterId: string
  encounterType: string
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  partySize: number
  isAIGenerated: boolean
}

export interface EncounterCompletedData {
  type: 'encounter_completed'
  encounterId: string
  duration: number
  victorious: boolean
  totalRounds: number
  casualties: number
  xpGained: number
}

export interface NPCCreatedData {
  type: 'npc_created'
  npcId: string
  npcName: string
  role: string
  personalityType: string
  isAIGenerated: boolean
}

export interface CampaignSessionStartedData {
  type: 'campaign_session_started'
  campaignId: string
  sessionNumber: number
  playersPresent: number
}

// ============================================================================
// GENERIC EVENT DATA
// ============================================================================

export interface GenericEventData {
  type: string
  [key: string]: unknown
}

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

/**
 * Time range for queries
 */
export type TimeRange =
  | { type: 'hours'; value: number }
  | { type: 'days'; value: number }
  | { type: 'weeks'; value: number }
  | { type: 'months'; value: number }
  | { type: 'all' }

/**
 * Aggregation bucket size
 */
export type AggregationBucket = 'hour' | 'day' | 'week' | 'month'

/**
 * Aggregated statistics
 */
export interface AggregatedStats {
  count: number
  sum?: number
  average?: number
  min?: number
  max?: number
  percentiles?: {
    p50: number
    p90: number
    p95: number
    p99: number
  }
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: string
  value: number
  count: number
}

// ============================================================================
// INSIGHT TYPES
// ============================================================================

/**
 * Insight severity level
 */
export type InsightSeverity = 'info' | 'warning' | 'critical' | 'success'

/**
 * Insight category
 */
export type InsightCategory =
  | 'usage'
  | 'learning'
  | 'performance'
  | 'error'
  | 'engagement'
  | 'optimization'

/**
 * Base insight
 */
export interface Insight {
  id: string
  category: InsightCategory
  severity: InsightSeverity
  title: string
  description: string
  timestamp: string
  productId: ProductId
  data?: Record<string, unknown>
}

/**
 * Learning insight (StudyLoG.AI specific)
 */
export interface LearningInsight extends Insight {
  category: 'learning'
  learningMetric: 'completion_rate' | 'practice_time' | 'skill_progress' | 'concept_mastery'
  value: number
  comparison: 'above_average' | 'average' | 'below_average'
  recommendations?: string[]
}

/**
 * Engagement insight
 */
export interface EngagementInsight extends Insight {
  category: 'engagement'
  metric: 'session_duration' | 'feature_adoption' | 'retention' | 'activity_level'
  value: number
  comparison: 'above_average' | 'average' | 'below_average'
}

/**
 * Performance insight
 */
export interface PerformanceInsight extends Insight {
  category: 'performance'
  issue: 'slow_api' | 'slow_render' | 'memory_pressure' | 'storage_bottleneck'
  metrics: {
    avgDuration: number
    p95Duration: number
    affectedOperations: number
    impact: 'low' | 'medium' | 'high'
  }
}

// ============================================================================
// SUMMARY TYPES
// ============================================================================

/**
 * Daily summary report
 */
export interface DailySummary {
  date: string
  productId: ProductId
  summary: string
  stats: {
    totalEvents: number
    totalSessions: number
    totalErrors: number
    mostUsedFeature: string
    peakUsageHour: number
    activeTime: number // seconds
  }
  patterns: string[]
  issues: string[]
  suggestions: string[]
  trends: {
    events: string
    errors: string
    performance: string
  }
  productSpecific?: {
    studylog?: StudyLogDailyStats
    dmlog?: DMLogDailyStats
  }
}

/**
 * StudyLoG.AI specific daily stats
 */
export interface StudyLogDailyStats {
  lessonsCompleted: number
  conceptsMastered: number
  skillsUnlocked: number
  timeInCognitiveMill: number
  timeInIntelligenceRanch: number
  timeInSitkaSound: number
  agentsBred: number
}

/**
 * DMLoG.AI specific daily stats
 */
export interface DMLogDailyStats {
  encountersCompleted: number
  npcsCreated: number
  campaignSessions: number
  totalPlayTime: number
  encountersCompletedVictory: number
  averageSessionPlayers: number
}

/**
 * Weekly summary report
 */
export interface WeeklySummary extends DailySummary {
  weekRange: string
  comparison: {
    eventsChange: number
    sessionsChange: number
    errorsChange: number
    performanceChange: string
  }
  topFeatures: Array<{ feature: string; usageCount: number }>
  topErrors: Array<{ error: string; count: number }>
  goals: {
    achieved: string[]
    inProgress: string[]
    notAchieved: string[]
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Whether analytics is enabled */
  enabled: boolean

  /** Whether to persist events to IndexedDB */
  persist: boolean

  /** Maximum number of events to keep (0 = unlimited) */
  maxEvents: number

  /** Batch size for writing to storage */
  batchSize: number

  /** Batch write interval in ms */
  batchInterval: number

  /** Whether to include detailed performance metrics */
  detailedPerformance: boolean

  /** Whether to track errors */
  trackErrors: boolean

  /** Session timeout in ms */
  sessionTimeout: number

  /** Data retention period in days (0 = forever) */
  retentionDays: number

  /** Sampling rate (0-1, 1 = track all events) */
  samplingRate: number

  /** Product identifier */
  productId: ProductId
}

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  enabled: true,
  persist: true,
  maxEvents: 100000,
  batchSize: 50,
  batchInterval: 5000,
  detailedPerformance: true,
  trackErrors: true,
  sessionTimeout: 30 * 60 * 1000,
  retentionDays: 90,
  samplingRate: 1.0,
  productId: 'studylog',
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

/**
 * Options for querying events
 */
export interface QueryOptions {
  timeRange: TimeRange
  eventTypes?: EventType[]
  categories?: EventCategory[]
  productId?: ProductId
  filters?: Record<string, unknown>
  bucket?: AggregationBucket
  limit?: number
  offset?: number
  sortOrder?: 'asc' | 'desc'
}
