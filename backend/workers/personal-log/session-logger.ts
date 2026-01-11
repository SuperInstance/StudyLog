/**
 * PersonalLog Worker - Session Logger
 *
 * Tracks user sessions across products with activity monitoring,
 * timeout detection, and session statistics.
 *
 * @module personal-log/session-logger
 */

import {
  Session,
  SessionStatus,
  SessionSource,
  ProductContext,
  StudyLogSessionContext,
  DMLogSessionContext,
  AnalyticsEvent,
  EventCategory,
} from './types'

// ============================================================================
// SESSION STORAGE
// ============================================================================

const SESSION_DB_NAME = 'PersonalLogSessions'
const SESSION_DB_VERSION = 1
const SESSION_STORE = 'sessions'

let sessionDB: IDBDatabase | null = null

/**
 * Initialize the session database
 */
async function initSessionDB(): Promise<IDBDatabase> {
  if (sessionDB) return sessionDB

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SESSION_DB_NAME, SESSION_DB_VERSION)

    request.onerror = () => reject(new Error('Failed to open session database'))
    request.onsuccess = () => {
      sessionDB = request.result
      resolve(sessionDB)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create sessions store
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        const store = database.createObjectStore(SESSION_STORE, { keyPath: 'id' })
        store.createIndex('userId', 'userId', { unique: false })
        store.createIndex('productId', 'productId', { unique: false })
        store.createIndex('startTime', 'startTime', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }
  })
}

/**
 * Session storage interface
 */
export interface SessionStorage {
  addSession(session: Session): Promise<void>
  getSession(id: string): Promise<Session | null>
  updateSession(id: string, updates: Partial<Session>): Promise<void>
  getActiveSessions(userId?: string): Promise<Session[]>
  getSessionsByUser(userId: string, limit?: number): Promise<Session[]>
  endSession(id: string): Promise<void>
  deleteSession(id: string): Promise<void>
}

/**
 * IndexedDB implementation of session storage
 */
class IndexedDBSessionStorage implements SessionStorage {
  async addSession(session: Session): Promise<void> {
    const database = await initSessionDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSION_STORE], 'readwrite')
      const store = transaction.objectStore(SESSION_STORE)
      const request = store.add(session)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getSession(id: string): Promise<Session | null> {
    const database = await initSessionDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSION_STORE], 'readonly')
      const store = transaction.objectStore(SESSION_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const existing = await this.getSession(id)
    if (!existing) {
      throw new Error(`Session not found: ${id}`)
    }

    const updated: Session = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
    }

    const database = await initSessionDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSION_STORE], 'readwrite')
      const store = transaction.objectStore(SESSION_STORE)
      const request = store.put(updated)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getActiveSessions(userId?: string): Promise<Session[]> {
    const database = await initSessionDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSION_STORE], 'readonly')
      const store = transaction.objectStore(SESSION_STORE)
      const index = store.index('status')
      const request = index.openCursor(IDBKeyRange.only('active'))

      const results: Session[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result

        if (cursor) {
          const session = cursor.value as Session

          // Filter by user ID if provided
          if (!userId || session.userId === userId) {
            results.push(session)
          }

          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async getSessionsByUser(userId: string, limit: number = 50): Promise<Session[]> {
    const database = await initSessionDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSION_STORE], 'readonly')
      const store = transaction.objectStore(SESSION_STORE)
      const index = store.index('userId')
      const request = index.openCursor(IDBKeyRange.only(userId), 'prev')

      const results: Session[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result

        if (cursor && results.length < limit) {
          results.push(cursor.value as Session)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async endSession(id: string): Promise<void> {
    await this.updateSession(id, {
      status: 'ended',
      endTime: new Date().toISOString(),
    })
  }

  async deleteSession(id: string): Promise<void> {
    const database = await initSessionDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([SESSION_STORE], 'readwrite')
      const store = transaction.objectStore(SESSION_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

/**
 * Configuration for session manager
 */
export interface SessionManagerConfig {
  /** Session timeout in milliseconds */
  sessionTimeout: number

  /** Whether to automatically track events */
  autoTrack: boolean

  /** Activity check interval in milliseconds */
  activityCheckInterval: number
}

/**
 * Default session manager configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionManagerConfig = {
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  autoTrack: true,
  activityCheckInterval: 60 * 1000, // 1 minute
}

/**
 * Session manager for tracking user sessions
 */
export class SessionManager {
  private storage: SessionStorage
  private config: SessionManagerConfig
  private productId: ProductContext
  private currentSession: Session | null = null
  private activityTimer: number | null = null
  private eventBuffer: AnalyticsEvent[] = []
  private lastActivity: number = Date.now()

  constructor(
    productId: ProductContext,
    config: Partial<SessionManagerConfig> = {},
    storage?: SessionStorage
  ) {
    this.productId = productId
    this.storage = storage || new IndexedDBSessionStorage()
    this.config = { ...DEFAULT_SESSION_CONFIG, ...config }
  }

  /**
   * Start a new session
   */
  async startSession(
    userId: string,
    source: SessionSource = 'direct',
    context?: Record<string, unknown>
  ): Promise<Session> {
    // End any existing active session
    if (this.currentSession) {
      await this.endSession()
    }

    const sessionId = this.generateSessionId()
    const now = new Date()

    const session: Session = {
      id: sessionId,
      userId: this.hashUserId(userId),
      productId: this.productId,
      startTime: now.toISOString(),
      source,
      status: 'active',
      eventsCount: 0,
      featuresUsed: [],
      context,
    }

    await this.storage.addSession(session)
    this.currentSession = session
    this.lastActivity = Date.now()

    // Start activity monitoring
    this.startActivityMonitoring()

    // Track session start event
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'session_start',
      category: 'engagement',
      timestamp: now.toISOString(),
      sessionId,
      data: {
        source,
        previousSessionTime: await this.getPreviousSessionTime(userId),
      },
    })

    return session
  }

  /**
   * End the current session
   */
  async endSession(): Promise<Session | null> {
    if (!this.currentSession) {
      return null
    }

    const sessionId = this.currentSession.id
    const now = new Date()
    const duration = Math.floor((now.getTime() - new Date(this.currentSession.startTime).getTime()) / 1000)

    // Update session
    await this.storage.updateSession(sessionId, {
      status: 'ended',
      endTime: now.toISOString(),
      duration,
      eventsCount: this.currentSession.eventsCount + this.eventBuffer.length,
    })

    // Track session end event
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'session_end',
      category: 'engagement',
      timestamp: now.toISOString(),
      sessionId,
      data: {
        duration,
        actionsPerformed: this.eventBuffer.length,
        featuresUsed: this.currentSession.featuresUsed,
      },
    })

    // Flush any buffered events
    await this.flushEvents()

    // Stop activity monitoring
    this.stopActivityMonitoring()

    const endedSession = this.currentSession
    this.currentSession = null
    this.eventBuffer = []

    return endedSession
  }

  /**
   * Get the current session
   */
  getCurrentSession(): Session | null {
    return this.currentSession
  }

  /**
   * Update session activity
   */
  updateActivity(feature?: string): void {
    this.lastActivity = Date.now()

    if (this.currentSession && feature) {
      if (!this.currentSession.featuresUsed.includes(feature)) {
        this.currentSession.featuresUsed.push(feature)
      }
    }
  }

  /**
   * Check if session has expired
   */
  isExpired(): boolean {
    if (!this.currentSession) return false
    return Date.now() - this.lastActivity > this.config.sessionTimeout
  }

  /**
   * Track an event in the current session
   */
  async trackEvent(event: Omit<AnalyticsEvent, 'sessionId'>): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.')
    }

    this.updateActivity()
    this.currentSession.eventsCount++

    const fullEvent: AnalyticsEvent = {
      ...event,
      sessionId: this.currentSession.id,
    }

    this.eventBuffer.push(fullEvent)

    // Flush if buffer is too large
    if (this.eventBuffer.length >= 50) {
      await this.flushEvents()
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    sessionId: string
    duration: number
    eventsCount: number
    featuresUsed: string[]
  } | null {
    if (!this.currentSession) {
      return null
    }

    const duration = Math.floor((Date.now() - new Date(this.currentSession.startTime).getTime()) / 1000)

    return {
      sessionId: this.currentSession.id,
      duration,
      eventsCount: this.currentSession.eventsCount + this.eventBuffer.length,
      featuresUsed: this.currentSession.featuresUsed,
    }
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<Session | null> {
    return this.storage.getSession(id)
  }

  /**
   * Get user's session history
   */
  async getUserSessions(userId: string, limit: number = 20): Promise<Session[]> {
    const hashedUserId = this.hashUserId(userId)
    return this.storage.getSessionsByUser(hashedUserId, limit)
  }

  /**
   * Flush buffered events to storage
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    // In a real implementation, this would persist events
    // For now, we'll just clear the buffer
    this.eventBuffer = []
  }

  /**
   * Start activity monitoring
   */
  private startActivityMonitoring(): void {
    this.stopActivityMonitoring()

    this.activityTimer = window.setInterval(async () => {
      if (this.isExpired()) {
        await this.endSession()
      }
    }, this.config.activityCheckInterval)
  }

  /**
   * Stop activity monitoring
   */
  private stopActivityMonitoring(): void {
    if (this.activityTimer !== null) {
      clearInterval(this.activityTimer)
      this.activityTimer = null
    }
  }

  /**
   * Get time since previous session
   */
  private async getPreviousSessionTime(userId: string): Promise<number | undefined> {
    const sessions = await this.getUserSessions(userId, 1)
    if (sessions.length > 0 && sessions[0].endTime) {
      const lastEndTime = new Date(sessions[0].endTime).getTime()
      return Date.now() - lastEndTime
    }
    return undefined
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return `user_${Math.abs(hash)}`
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopActivityMonitoring()
  }
}

// ============================================================================
// STUDYLOG.AI SESSION MANAGER
// ============================================================================

/**
 * StudyLoG.AI specific session manager
 */
export class StudyLogSessionManager extends SessionManager {
  /**
   * Track a lesson start
   */
  async trackLessonStart(data: {
    lessonId: string
    lessonTitle: string
    module: string
    difficulty: number
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'lesson_started',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('lesson')
  }

  /**
   * Track a lesson completion
   */
  async trackLessonComplete(data: {
    lessonId: string
    duration: number
    score: number
    attempts: number
    masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'mastered'
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'lesson_completed',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('lesson')
  }

  /**
   * Track concept mastery
   */
  async trackConceptMastered(data: {
    concept: string
    practiceTime: number
    quizScore: number
    relatedConcepts: string[]
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'concept_mastered',
      category: 'engagement',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('concept')
  }

  /**
   * Track simulation start
   */
  async trackSimulationStart(data: {
    simulationType: string
    parameters: Record<string, unknown>
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'simulation_started',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('simulation')
  }

  /**
   * Track skill unlock
   */
  async trackSkillUnlock(data: {
    skillId: string
    skillName: string
    tree: string
    requiredPoints: number
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'skill_unlocked',
      category: 'engagement',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('skill_tree')
  }
}

// ============================================================================
// DMLOG.AI SESSION MANAGER
// ============================================================================

/**
 * DMLoG.AI specific session manager
 */
export class DMLogSessionManager extends SessionManager {
  /**
   * Track campaign session start
   */
  async trackCampaignSessionStart(data: {
    campaignId: string
    campaignName: string
    playerCount: number
    characters: string[]
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'campaign_session_started',
      category: 'engagement',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('campaign')
  }

  /**
   * Track encounter start
   */
  async trackEncounterStart(data: {
    encounterType: 'combat' | 'social' | 'exploration' | 'puzzle'
    difficulty: number
    partySize: number
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'encounter_started',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('encounter')
  }

  /**
   * Track encounter completion
   */
  async trackEncounterComplete(data: {
    encounterType: string
    duration: number
    outcome: 'victory' | 'defeat' | 'negotiation' | 'fled'
    resourcesUsed: string[]
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'encounter_completed',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('encounter')
  }

  /**
   * Track character creation
   */
  async trackCharacterCreation(data: {
    characterId: string
    characterName: string
    class: string
    background: string
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'character_created',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('character')
  }

  /**
   * Track world building session
   */
  async trackWorldBuilding(data: {
    activity: 'location' | 'npc' | 'lore' | 'faction'
    elementsCreated: number
    connectedToCampaign: boolean
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'world_building_session',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('world_building')
  }

  /**
   * Track DM prep start
   */
  async trackDMPrepStart(data: {
    sessionNumber: number
    prepActivities: string[]
  }): Promise<void> {
    await this.trackEvent({
      id: this.generateEventId(),
      type: 'dm_prep_started',
      category: 'user_action',
      timestamp: new Date().toISOString(),
      sessionId: this.getCurrentSession()?.id || '',
      data,
    })

    this.updateActivity('dm_prep')
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a session manager for the specified product
 */
export function createSessionManager(
  productId: ProductContext,
  config?: Partial<SessionManagerConfig>
): SessionManager {
  switch (productId) {
    case 'studylog':
      return new StudyLogSessionManager(productId, config)
    case 'dmlog':
      return new DMLogSessionManager(productId, config)
    default:
      return new SessionManager(productId, config)
  }
}
