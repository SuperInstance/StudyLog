/**
 * Personal Log - Session Manager
 *
 * Manages user sessions with automatic timeout detection and activity tracking.
 */

import type {
  Session,
  SessionId,
  ProductId,
  SessionSource,
  SessionStatus,
  SessionConfig,
  SessionStartData,
  SessionEndData,
  SessionHeartbeatData,
  createSessionId,
} from './types'

// Default configuration
const DEFAULT_CONFIG: SessionConfig = {
  productId: 'studylog',
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  heartbeatInterval: 60 * 1000, // 1 minute
  enableCrossProduct: true,
  persistSessions: true,
  maxSessions: 1000,
  retentionDays: 90,
  activityHandlers: [],
}

// ============================================================================
// SESSION MANAGER CLASS
// ============================================================================

/**
 * Session Manager for tracking user sessions across products
 */
export class SessionManager {
  private config: SessionConfig
  private currentSession: Session | null = null
  private heartbeatTimer: number | null = null
  private onSessionStartCallbacks: Array<(session: Session) => void> = []
  private onSessionEndCallbacks: Array<(session: Session) => void> = []
  private onActivityCallbacks: Array<(activity: string) => void> = []

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // ========================================================================
  // SESSION LIFECYCLE
  // ========================================================================

  /**
   * Start a new session
   */
  async startSession(source: SessionSource = 'direct'): Promise<Session> {
    // End existing session if active
    if (this.currentSession && this.currentSession.status === 'active') {
      await this.endSession('switch_product')
    }

    const now = new Date().toISOString()
    const sessionId = this.createSessionId()

    // Create new session
    const session: Session = {
      id: sessionId,
      productId: this.config.productId,
      startedAt: now,
      lastActivity: now,
      endedAt: null,
      status: 'active',
      source,
      stats: {
        actionsPerformed: 0,
        messagesSent: 0,
        featuresUsed: new Set(),
        errorsEncountered: 0,
        customMetrics: {},
      },
      metadata: {
        appVersion: this.config.activityHandlers?.length ? '1.0.0' : undefined,
      },
    }

    this.currentSession = session

    // Start heartbeat
    this.startHeartbeat()

    // Persist session if enabled
    if (this.config.persistSessions) {
      await this.persistSession(session)
    }

    // Trigger callbacks
    for (const callback of this.onSessionStartCallbacks) {
      callback(session)
    }

    return session
  }

  /**
   * End the current session
   */
  async endSession(reason: SessionEndData['reason'] = 'user_exit'): Promise<void> {
    if (!this.currentSession) {
      return
    }

    const session = this.currentSession
    const now = new Date().toISOString()

    // Update session
    session.endedAt = now
    session.status = 'ended'

    // Stop heartbeat
    this.stopHeartbeat()

    // Persist final state
    if (this.config.persistSessions) {
      await this.persistSession(session)
    }

    // Trigger callbacks
    for (const callback of this.onSessionEndCallbacks) {
      callback(session)
    }

    this.currentSession = null
  }

  /**
   * Update session activity (called on user actions)
   */
  updateActivity(activity: string = 'general'): void {
    if (!this.currentSession) {
      return
    }

    this.currentSession.lastActivity = new Date().toISOString()
    this.currentSession.stats.actionsPerformed++

    // Trigger activity callbacks
    for (const callback of this.onActivityCallbacks) {
      callback(activity)
    }
  }

  /**
   * Record a feature usage in the current session
   */
  recordFeatureUsage(featureId: string): void {
    if (!this.currentSession) {
      return
    }

    this.currentSession.stats.featuresUsed.add(featureId)
    this.updateActivity(`feature:${featureId}`)
  }

  /**
   * Record a message sent in the current session
   */
  recordMessage(): void {
    if (!this.currentSession) {
      return
    }

    this.currentSession.stats.messagesSent++
    this.updateActivity('message_sent')
  }

  /**
   * Record an error in the current session
   */
  recordError(): void {
    if (!this.currentSession) {
      return
    }

    this.currentSession.stats.errorsEncountered++
  }

  // ========================================================================
  // SESSION QUERIES
  // ========================================================================

  /**
   * Get the current active session
   */
  getCurrentSession(): Session | null {
    return this.currentSession
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.currentSession?.id || 'none'
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(): boolean {
    if (!this.currentSession) {
      return true
    }

    const lastActivity = new Date(this.currentSession.lastActivity).getTime()
    const now = Date.now()
    return (now - lastActivity) > this.config.sessionTimeout
  }

  /**
   * Get current session duration in seconds
   */
  getSessionDuration(): number {
    if (!this.currentSession) {
      return 0
    }

    const start = new Date(this.currentSession.startedAt).getTime()
    const now = Date.now()
    return Math.floor((now - start) / 1000)
  }

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Register a callback for session start
   */
  onSessionStart(callback: (session: Session) => void): void {
    this.onSessionStartCallbacks.push(callback)
  }

  /**
   * Register a callback for session end
   */
  onSessionEnd(callback: (session: Session) => void): void {
    this.onSessionEndCallbacks.push(callback)
  }

  /**
   * Register a callback for activity updates
   */
  onActivity(callback: (activity: string) => void): void {
    this.onActivityCallbacks.push(callback)
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private createSessionId(): SessionId {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}` as SessionId
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      return
    }

    this.heartbeatTimer = window.setTimeout(() => {
      this.handleHeartbeat()
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private async handleHeartbeat(): Promise<void> {
    // Check for session timeout
    if (this.isSessionExpired()) {
      await this.endSession('timeout')
      return
    }

    // Update last activity
    if (this.currentSession) {
      this.currentSession.lastActivity = new Date().toISOString()

      // Persist updated session
      if (this.config.persistSessions) {
        await this.persistSession(this.currentSession)
      }
    }

    // Schedule next heartbeat
    this.heartbeatTimer = null
    this.startHeartbeat()
  }

  private async persistSession(session: Session): Promise<void> {
    // Store in IndexedDB via the analytics storage layer
    // This will be implemented by the analytics module
    try {
      const events = await this.getStoredEvents()
      // Implementation depends on analytics storage
    } catch (error) {
      console.warn('Failed to persist session:', error)
    }
  }

  private async getStoredEvents(): Promise<unknown[]> {
    // Placeholder - will connect to analytics storage
    return []
  }

  // ========================================================================
  // CROSS-PRODUCT SESSIONS
  // ========================================================================

  /**
   * Link this session to another product's session
   */
  linkCrossProductSession(crossProductId: string): void {
    if (!this.currentSession) {
      return
    }

    this.currentSession.metadata.crossProductId = crossProductId
  }

  /**
   * Get session statistics as a plain object
   */
  getSessionStats(): {
    actionsPerformed: number
    messagesSent: number
    featuresUsed: string[]
    errorsEncountered: number
    duration: number
  } {
    if (!this.currentSession) {
      return {
        actionsPerformed: 0,
        messagesSent: 0,
        featuresUsed: [],
        errorsEncountered: 0,
        duration: 0,
      }
    }

    return {
      actionsPerformed: this.currentSession.stats.actionsPerformed,
      messagesSent: this.currentSession.stats.messagesSent,
      featuresUsed: Array.from(this.currentSession.stats.featuresUsed),
      errorsEncountered: this.currentSession.stats.errorsEncountered,
      duration: this.getSessionDuration(),
    }
  }
}

// ============================================================================
// GLOBAL SESSION MANAGER INSTANCE
// ============================================================================

let globalSessionManager: SessionManager | null = null

/**
 * Get or create the global session manager
 */
export function getSessionManager(config?: Partial<SessionConfig>): SessionManager {
  if (!globalSessionManager) {
    globalSessionManager = new SessionManager(config)
  }
  return globalSessionManager
}

/**
 * Initialize the session manager
 */
export async function initializeSessionManager(config?: Partial<SessionConfig>): Promise<SessionManager> {
  const manager = getSessionManager(config)
  // Auto-start session on initialization
  await manager.startSession()
  return manager
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get current session ID
 */
export function getCurrentSessionId(): string {
  const manager = getSessionManager()
  return manager.getSessionId()
}

/**
 * Record activity in current session
 */
export function recordActivity(activity: string = 'general'): void {
  const manager = getSessionManager()
  manager.updateActivity(activity)
}

/**
 * Record feature usage
 */
export function recordFeature(featureId: string): void {
  const manager = getSessionManager()
  manager.recordFeatureUsage(featureId)
}

/**
 * End current session
 */
export async function endCurrentSession(reason?: SessionEndData['reason']): Promise<void> {
  const manager = getSessionManager()
  await manager.endSession(reason)
}
