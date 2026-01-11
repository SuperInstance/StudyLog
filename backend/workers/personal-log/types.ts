/**
 * PersonalLog Worker - Shared Types
 *
 * Privacy-first, local-first personal logging system for SuperInstance.AI products.
 * Provides journal entries, session tracking, reflection prompts, and insights.
 *
 * @module personal-log/types
 */

// ============================================================================
// PRODUCT CONTEXT
// ============================================================================

/**
 * Supported products in the SuperInstance.AI ecosystem
 */
export type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'activelog' | 'reallog' | 'playerlog'

/**
 * Event categories for analytics
 */
export type EventCategory =
  | 'user_action'
  | 'performance'
  | 'engagement'
  | 'error'
  | 'feature_flag'
  | 'system'

// ============================================================================
// JOURNAL ENTRIES
// ============================================================================

/**
 * Journal entry types for different products
 */
export type JournalEntryType =
  // StudyLoG.AI
  | 'reflection'
  | 'observation'
  | 'question'
  | 'breakthrough'
  // DMLoG.AI
  | 'session_log'
  | 'character_note'
  | 'world_building'
  | 'dm_reflection'
  // Common
  | 'daily_entry'
  | 'milestone'
  | 'goal'

/**
 * Mood indicators for journal entries
 */
export type MoodIndicator =
  | 'frustrated'
  | 'confused'
  | 'curious'
  | 'excited'
  | 'proud'
  | 'neutral'
  | 'accomplished'
  | 'stuck'
  | 'inspired'

/**
 * Base journal entry interface
 */
export interface JournalEntry {
  /** Unique entry identifier */
  id: string

  /** User identifier (hashed for privacy) */
  userId: string

  /** Product context */
  productId: ProductContext

  /** Entry timestamp (ISO 8601) */
  timestamp: string

  /** Entry type */
  type: JournalEntryType

  /** Entry title */
  title: string

  /** Entry content (markdown supported) */
  content: string

  /** Product-specific context */
  context?: Record<string, unknown>

  /** Mood indicator */
  mood?: MoodIndicator

  /** Tags for categorization */
  tags: string[]

  /** Whether entry is publicly shared */
  isPublic: boolean

  /** Whether entry is visible to other users (multiplayer) */
  isPlayerVisible: boolean

  /** Session identifier */
  sessionId: string

  /** Related event IDs */
  relatedEvents?: string[]

  /** AI-generated flag */
  aiGenerated?: boolean

  /** Updated timestamp */
  updatedAt?: string
}

/**
 * StudyLoG.AI specific journal entry context
 */
export interface StudyLogJournalContext {
  /** Related lesson */
  lesson?: string

  /** Related concept */
  concept?: string

  /** Related skill */
  skill?: string

  /** Difficulty rating (1-5) */
  difficulty?: number

  /** Understanding level (1-100) */
  understandingLevel?: number

  /** Related simulation */
  simulation?: string
}

/**
 * DMLoG.AI specific journal entry context
 */
export interface DMLogJournalContext {
  /** Campaign identifier */
  campaignId?: string

  /** Campaign name */
  campaignName?: string

  /** Session number */
  sessionNumber?: number

  /** Related characters */
  characters?: string[]

  /** Related locations */
  locations?: string[]

  /** Related NPCs */
  npcs?: string[]

  /** Encounter type */
  encounterType?: 'combat' | 'social' | 'exploration' | 'puzzle'
}

// ============================================================================
// SESSION TRACKING
// ============================================================================

/**
 * Session source type
 */
export type SessionSource = 'direct' | 'notification' | 'link' | 'invitation'

/**
 * Session status
 */
export type SessionStatus = 'active' | 'ended' | 'expired'

/**
 * Session tracking interface
 */
export interface Session {
  /** Unique session identifier */
  id: string

  /** User identifier (hashed for privacy) */
  userId: string

  /** Product context */
  productId: ProductContext

  /** Session start timestamp (ISO 8601) */
  startTime: string

  /** Session end timestamp (ISO 8601) */
  endTime?: string

  /** Session duration in seconds */
  duration?: number

  /** Session source */
  source: SessionSource

  /** Session status */
  status: SessionStatus

  /** Total events in session */
  eventsCount: number

  /** Features/actions used in session */
  featuresUsed: string[]

  /** Product-specific context */
  context?: Record<string, unknown>

  /** Previous session time gap in milliseconds */
  previousSessionTime?: number
}

/**
 * StudyLoG.AI session context
 */
export interface StudyLogSessionContext {
  /** Current lesson/module */
  currentLesson?: string

  /** Skills practiced */
  skillsPracticed?: string[]

  /** Concepts explored */
  conceptsExplored?: string[]

  /** Simulations run */
  simulationsRun?: string[]

  /** Time spent in cognitive mill */
  cognitiveMillTime?: number
}

/**
 * DMLoG.AI session context
 */
export interface DMLogSessionContext {
  /** Campaign identifier */
  campaignId?: string

  /** Session number */
  sessionNumber?: number

  /** Characters present */
  characters?: string[]

  /** Encounters completed */
  encountersCompleted?: number

  /** Story beats reached */
  storyBeats?: string[]
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Base analytics event
 */
export interface AnalyticsEvent {
  /** Unique event identifier */
  id: string

  /** Event type */
  type: string

  /** Event category */
  category: EventCategory

  /** Event timestamp (ISO 8601) */
  timestamp: string

  /** Session identifier */
  sessionId: string

  /** Event-specific data */
  data: Record<string, unknown>

  /** Optional metadata */
  metadata?: {
    /** Hardware profile hash */
    hardwareHash?: string

    /** Active features */
    activeFeatures?: string[]

    /** App version */
    appVersion?: string

    /** Platform info */
    platform?: string
  }
}

// ============================================================================
// REFLECTION PROMPTS
// ============================================================================

/**
 * Reflection prompt categories
 */
export type ReflectionPromptCategory = 'daily' | 'weekly' | 'milestone' | 'struggle' | 'session'

/**
 * Reflection prompt types
 */
export type ReflectionPromptType = 'open_ended' | 'guided' | 'rating' | 'comparison' | 'multiple_choice'

/**
 * Reflection prompt interface
 */
export interface ReflectionPrompt {
  /** Unique prompt identifier */
  id: string

  /** Product context */
  productId: ProductContext

  /** Prompt category */
  category: ReflectionPromptCategory

  /** The prompt question */
  prompt: string

  /** Prompt type */
  type: ReflectionPromptType

  /** Optional context for the prompt */
  context?: {
    /** Recent activities to reference */
    recentActivity?: string[]

    /** Struggling concepts to address */
    strugglingConcepts?: string[]

    /** Mastered skills to reference */
    masteredSkills?: string[]

    /** Related characters (DMLoG) */
    characters?: string[]

    /** Related campaign events (DMLoG) */
    campaignEvents?: string[]
  }

  /** Suggested responses for guided prompts */
  suggestedResponses?: string[]

  /** Whether this prompt is AI-generated */
  aiGenerated?: boolean
}

/**
 * Reflection response interface
 */
export interface ReflectionResponse {
  /** Unique response identifier */
  id: string

  /** User identifier */
  userId: string

  /** Prompt being responded to */
  promptId: string

  /** Response content */
  response: string

  /** Optional rating */
  rating?: number

  /** Response timestamp */
  timestamp: string

  /** Session identifier */
  sessionId: string
}

// ============================================================================
// INSIGHTS
// ============================================================================

/**
 * Insight severity levels
 */
export type InsightSeverity = 'info' | 'warning' | 'critical' | 'success'

/**
 * Insight categories
 */
export type InsightCategory = 'usage' | 'performance' | 'error' | 'engagement' | 'learning' | 'progress'

/**
 * Base insight interface
 */
export interface Insight {
  /** Unique insight identifier */
  id: string

  /** Insight category */
  category: InsightCategory

  /** Severity level */
  severity: InsightSeverity

  /** Insight title */
  title: string

  /** Insight description */
  description: string

  /** Insight timestamp */
  timestamp: string

  /** Associated product */
  productId: ProductContext

  /** Optional data */
  data?: Record<string, unknown>

  /** Actionable suggestions */
  suggestions?: string[]
}

/**
 * Daily summary interface
 */
export interface DailySummary {
  /** Summary date */
  date: string

  /** Product context */
  productId: ProductContext

  /** Summary text (AI-generated) */
  summary: string

  /** Statistics */
  stats: {
    /** Total journal entries */
    journalEntries: number

    /** Total sessions */
    totalSessions: number

    /** Total session time in seconds */
    totalTime: number

    /** Top activity */
    topActivity?: string

    /** Peak usage hour (0-23) */
    peakHour: number
  }

  /** Detected patterns */
  patterns: string[]

  /** Issues/concerns */
  issues: string[]

  /** Suggestions */
  suggestions: string[]

  /** Trends */
  trends: {
    activity: 'increasing' | 'decreasing' | 'stable'
    engagement: 'high' | 'medium' | 'low'
    mood: MoodIndicator | null
  }
}

/**
 * Weekly summary interface
 */
export interface WeeklySummary extends DailySummary {
  /** Week range */
  weekRange: string

  /** Comparison to previous week */
  comparison: {
    /** Activity change percentage */
    activityChange: number

    /** Session count change */
    sessionsChange: number

    /** Time change percentage */
    timeChange: number
  }

  /** Top activities */
  topActivities: Array<{ activity: string; count: number }>

  /** Achievements/unlocks */
  achievements: string[]

  /** Goals status */
  goals: {
    achieved: string[]
    inProgress: string[]
    notAchieved: string[]
  }
}

// ============================================================================
// TIMELINE
// ============================================================================

/**
 * Timeline event types
 */
export type TimelineEventType = 'journal' | 'session' | 'achievement' | 'milestone' | 'insight'

/**
 * Timeline event interface
 */
export interface TimelineEvent {
  /** Unique event identifier */
  id: string

  /** Event timestamp (ISO 8601) */
  timestamp: string

  /** Event type */
  type: TimelineEventType

  /** Event title */
  title: string

  /** Event description */
  description?: string

  /** Icon identifier */
  icon?: string

  /** Color for visual display */
  color?: string

  /** Associated product */
  productId: ProductContext

  /** Optional metadata */
  metadata?: Record<string, unknown>

  /** Related event IDs */
  relatedEvents?: string[]
}

/**
 * Timeline filter options
 */
export interface TimelineFilterOptions {
  /** Start date (ISO 8601) */
  startDate?: string

  /** End date (ISO 8601) */
  endDate?: string

  /** Event types to include */
  types?: TimelineEventType[]

  /** Products to include */
  products?: ProductContext[]

  /** Tags to filter by */
  tags?: string[]

  /** Search query */
  search?: string

  /** Limit results */
  limit?: number

  /** Offset for pagination */
  offset?: number
}

// ============================================================================
// EXPORT
// ============================================================================

/**
 * Supported export formats
 */
export type ExportFormat = 'json' | 'markdown' | 'csv' | 'pdf' | 'html' | 'yaml'

/**
 * Export scope
 */
export type ExportScope = 'journal' | 'sessions' | 'timeline' | 'insights' | 'all'

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat

  /** Export scope */
  scope: ExportScope

  /** Product filter */
  product?: ProductContext

  /** Start date (ISO 8601) */
  startDate?: string

  /** End date (ISO 8601) */
  endDate?: string

  /** Whether to include AI-generated content */
  includeAI?: boolean

  /** Whether to include private entries */
  includePrivate?: boolean

  /** Whether to anonymize data */
  anonymize?: boolean

  /** Custom filename (without extension) */
  filename?: string
}

/**
 * Export result
 */
export interface ExportResult {
  /** Exported data blob */
  data: Blob

  /** Generated filename */
  filename: string

  /** MIME type */
  mimeType: string

  /** Export statistics */
  stats: {
    entriesCount: number
    sessionsCount: number
    fileSize: number
  }

  /** Export timestamp */
  exportedAt: string
}

/**
 * Export record for history
 */
export interface ExportRecord {
  /** Unique record identifier */
  id: string

  /** Export format */
  format: ExportFormat

  /** Export scope */
  scope: ExportScope

  /** Whether export was successful */
  success: boolean

  /** Error message if failed */
  error?: string

  /** Export statistics */
  stats: {
    entriesCount: number
    sessionsCount: number
    fileSize: number
    duration: number
  }

  /** Export creation timestamp */
  createdAt: string

  /** Export completion timestamp */
  completedAt: string
}

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Maximum number of journal entries to keep (0 = unlimited) */
  maxEntries: number

  /** Maximum number of sessions to keep (0 = unlimited) */
  maxSessions: number

  /** Data retention period in days (0 = forever) */
  retentionDays: number

  /** Whether to persist data locally */
  persist: boolean

  /** Storage quota in bytes (0 = unlimited) */
  quotaBytes: number
}

/**
 * Default storage configuration
 */
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  maxEntries: 10000,
  maxSessions: 1000,
  retentionDays: 365,
  persist: true,
  quotaBytes: 50 * 1024 * 1024, // 50MB
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * PersonalLog worker configuration
 */
export interface PersonalLogConfig {
  /** Product context */
  product: ProductContext

  /** Storage configuration */
  storage: StorageConfig

  /** Session timeout in milliseconds */
  sessionTimeout: number

  /** Whether analytics is enabled */
  analyticsEnabled: boolean

  /** Whether insights are enabled */
  insightsEnabled: boolean

  /** Whether reflection prompts are enabled */
  promptsEnabled: boolean

  /** Data anonymization */
  anonymize: boolean
}

/**
 * Default configuration
 */
export const DEFAULT_PERSONAL_LOG_CONFIG: PersonalLogConfig = {
  product: 'studylog',
  storage: DEFAULT_STORAGE_CONFIG,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  analyticsEnabled: true,
  insightsEnabled: true,
  promptsEnabled: true,
  anonymize: false,
}

// ============================================================================
// STUDYLOG.AI SPECIFIC EVENTS
// ============================================================================

/**
 * StudyLoG.AI event types
 */
export type StudyLogEventType =
  | 'lesson_started'
  | 'lesson_completed'
  | 'concept_mastered'
  | 'simulation_started'
  | 'simulation_completed'
  | 'agent_bred'
  | 'skill_unlocked'
  | 'skill_practiced'
  | 'mill_stage_completed'
  | 'quiz_completed'
  | 'challenge_started'
  | 'challenge_completed'

/**
 * StudyLoG.AI event data
 */
export interface StudyLogEventData {
  /** Lesson/module identifier */
  lessonId?: string

  /** Lesson title */
  lessonTitle?: string

  /** Module name */
  module?: string

  /** Difficulty rating */
  difficulty?: number

  /** Duration in seconds */
  duration?: number

  /** Score/percentage */
  score?: number

  /** Number of attempts */
  attempts?: number

  /** Mastery level */
  masteryLevel?: 'beginner' | 'intermediate' | 'advanced' | 'mastered'

  /** Concept being learned */
  concept?: string

  /** Practice time in seconds */
  practiceTime?: number

  /** Quiz score */
  quizScore?: number

  /** Related concepts */
  relatedConcepts?: string[]

  /** Simulation type */
  simulationType?: string

  /** Simulation parameters */
  parameters?: Record<string, unknown>

  /** Simulation outcome */
  outcome?: string

  /** Simulation insights */
  insights?: string[]

  /** Parent agent IDs (for breeding) */
  parentAgents?: string[]

  /** Agent traits */
  traits?: string[]

  /** Expected behavior */
  expectedBehavior?: string

  /** Skill identifier */
  skillId?: string

  /** Skill name */
  skillName?: string

  /** Skill tree */
  tree?: string

  /** Required points */
  requiredPoints?: number

  /** Practice duration */
  practiceDuration?: number

  /** Improvement amount */
  improvement?: number

  /** Mill stage */
  stage?: 'token_flow' | 'attention_heatmap' | 'neural_viz'

  /** Understanding level */
  understandingLevel?: number

  /** Time spent in milliseconds */
  timeSpent?: number
}

// ============================================================================
// DMLOG.AI SPECIFIC EVENTS
// ============================================================================

/**
 * DMLoG.AI event types
 */
export type DMLogEventType =
  | 'campaign_session_started'
  | 'campaign_session_ended'
  | 'encounter_started'
  | 'encounter_completed'
  | 'character_created'
  | 'character_developed'
  | 'world_building_session'
  | 'npc_interaction'
  | 'dm_prep_started'
  | 'dm_prep_completed'

/**
 * DMLoG.AI event data
 */
export interface DMLogEventData {
  /** Campaign identifier */
  campaignId?: string

  /** Campaign name */
  campaignName?: string

  /** Player count */
  playerCount?: number

  /** Characters in session */
  characters?: string[]

  /** Session duration in seconds */
  duration?: number

  /** Encounters completed */
  encountersCompleted?: number

  /** Story beats reached */
  storyBeats?: string[]

  /** Encounter type */
  encounterType?: 'combat' | 'social' | 'exploration' | 'puzzle'

  /** Encounter difficulty */
  difficulty?: number

  /** Party size */
  partySize?: number

  /** Encounter outcome */
  outcome?: 'victory' | 'defeat' | 'negotiation' | 'fled'

  /** Resources used */
  resourcesUsed?: string[]

  /** Character identifier */
  characterId?: string

  /** Character name */
  characterName?: string

  /** Character class */
  class?: string

  /** Character background */
  background?: string

  /** Development type */
  developmentType?: 'level_up' | 'backstory' | 'relationship' | 'moral_choice'

  /** Development impact */
  impact?: string

  /** World building activity */
  activity?: 'location' | 'npc' | 'lore' | 'faction'

  /** Elements created */
  elementsCreated?: number

  /** Connected to campaign */
  connectedToCampaign?: boolean

  /** NPC identifier */
  npcId?: string

  /** Interaction type */
  interactionType?: 'dialogue' | 'combat' | 'trade' | 'quest'

  /** Relationship change */
  relationshipChange?: number

  /** Session number */
  sessionNumber?: number

  /** Prep activities */
  prepActivities?: string[]

  /** Prep duration */
  prepDuration?: number

  /** Encounters prepared */
  encountersPrepared?: number

  /** Resources created */
  resourcesCreated?: string[]
}
