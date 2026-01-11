/**
 * Personal Log - Session Types
 *
 * Session tracking types for StudyLoG.AI and DMLoG.AI
 */

// ============================================================================
// SESSION TYPES
// ============================================================================

/**
 * Product identifier for cross-product session tracking
 */
export type ProductId = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog'

/**
 * Session source for tracking how sessions were initiated
 */
export type SessionSource =
  | 'direct'           // User opened app directly
  | 'notification'     // User clicked a notification
  | 'link'            // User followed a deep link
  | 'bazaar'          // User came from community marketplace
  | 'collaboration'   // User joined a collaborative session

/**
 * Session status tracking
 */
export type SessionStatus = 'active' | 'idle' | 'expired' | 'ended'

/**
 * Session data structure
 */
export interface Session {
  /** Unique session identifier */
  id: string

  /** Product that created this session */
  productId: ProductId

  /** Session start timestamp (ISO 8601) */
  startedAt: string

  /** Last activity timestamp (ISO 8601) */
  lastActivity: string

  /** Session end timestamp (ISO 8601) or null if active */
  endedAt: string | null

  /** Current session status */
  status: SessionStatus

  /** How the session was initiated */
  source: SessionSource

  /** Time since previous session in seconds */
  previousSessionTime?: number

  /** Session statistics */
  stats: SessionStats

  /** Context metadata */
  metadata: SessionMetadata
}

/**
 * Session statistics tracked throughout the session
 */
export interface SessionStats {
  /** Total number of actions performed */
  actionsPerformed: number

  /** Total messages/conversations created */
  messagesSent: number

  /** Features used during this session */
  featuresUsed: Set<string>

  /** Error count */
  errorsEncountered: number

  /** Custom product-specific metrics */
  customMetrics: Record<string, number | string | boolean>
}

/**
 * Session metadata for filtering and analysis
 */
export interface SessionMetadata {
  /** App version */
  appVersion?: string

  /** Platform information */
  platform?: string

  /** Hardware profile hash (for correlation, not identification) */
  hardwareHash?: string

  /** Feature flags active during session */
  activeFeatures?: string[]

  /** Tags for grouping/categorization */
  tags?: string[]

  /** Parent session ID (for linked sessions) */
  parentSessionId?: string

  /** Cross-product session ID */
  crossProductId?: string
}

// ============================================================================
// SESSION EVENTS
// ============================================================================

/**
 * Session start event data
 */
export interface SessionStartData {
  type: 'session_start'
  productId: ProductId
  source: SessionSource
  previousSessionTime?: number
}

/**
 * Session end event data
 */
export interface SessionEndData {
  type: 'session_end'
  productId: ProductId
  duration: number // seconds
  actionsPerformed: number
  messagesSent: number
  featuresUsed: string[]
  reason?: 'user_exit' | 'timeout' | 'error' | 'switch_product'
}

/**
 * Session heartbeat for keeping session alive
 */
export interface SessionHeartbeatData {
  type: 'session_heartbeat'
  productId: ProductId
  currentActivity: string
}

// ============================================================================
// SESSION INSIGHTS
// ============================================================================

/**
 * Session duration insight
 */
export interface SessionDurationInsight {
  type: 'session_duration'
  avgDuration: number // seconds
  medianDuration: number
  longestSession: number
  shortestSession: number
  trend: 'increasing' | 'decreasing' | 'stable'
}

/**
 * Session activity insight
 */
export interface SessionActivityInsight {
  type: 'session_activity'
  peakHours: number[] // Hours 0-23 with most activity
  avgActionsPerSession: number
  mostActiveDay: string
  retentionRate: number // Percentage of returning users
}

/**
 * Cross-product session insight
 */
export interface CrossProductInsight {
  type: 'cross_product'
  sessionFlow: string[] // e.g., ['studylog', 'dmlog']
  switchCount: number
  avgTimeBeforeSwitch: number
  commonPatterns: Array<{
    from: ProductId
    to: ProductId
    count: number
  }>
}

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================

/**
 * Session manager configuration
 */
export interface SessionConfig {
  /** Product identifier */
  productId: ProductId

  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeout: number

  /** Heartbeat interval in milliseconds (default: 1 minute) */
  heartbeatInterval: number

  /** Whether to enable cross-product session tracking */
  enableCrossProduct: boolean

  /** Whether to persist session data to IndexedDB */
  persistSessions: boolean

  /** Maximum sessions to keep in storage (0 = unlimited) */
  maxSessions: number

  /** Session data retention period in days (0 = forever) */
  retentionDays: number

  /** Custom activity handlers */
  activityHandlers?: ActivityHandler[]
}

/**
 * Activity handler for custom session events
 */
export interface ActivityHandler {
  /** Event type to handle */
  eventType: string

  /** Handler function called when event occurs */
  handler: (data: unknown) => void | Promise<void>
}

// ============================================================================
// BRANDED TYPES
// ============================================================================

export type SessionId = string & { readonly __brand: 'SessionId' }

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique session ID
 */
export function createSessionId(): SessionId {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}` as SessionId
}

/**
 * Generate a cross-product session ID
 */
export function createCrossProductId(): string {
  return `xprod_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Check if a session is expired based on timeout
 */
export function isSessionExpired(session: Session, timeoutMs: number): boolean {
  const lastActivity = new Date(session.lastActivity).getTime()
  const now = Date.now()
  return (now - lastActivity) > timeoutMs
}

/**
 * Calculate session duration in seconds
 */
export function calculateSessionDuration(session: Session): number {
  const start = new Date(session.startedAt).getTime()
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now()
  return Math.floor((end - start) / 1000)
}
