/**
 * Personal Log - Main Entry Point
 *
 * Session tracking, learning analytics, and progress insights for SuperInstance products
 *
 * @example
 * ```typescript
 * import { PersonalLog } from '@superinstance/personal-log'
 *
 * // Initialize for StudyLoG.AI
 * await PersonalLog.initialize({ productId: 'studylog' })
 *
 * // Track events
 * await PersonalLog.track('lesson_completed', {
 *   lessonId: 'cognitive-mill-1',
 *   lessonTitle: 'Understanding Token Flow',
 *   duration: 300,
 *   completionPercentage: 100,
 *   conceptsLearned: ['tokens', 'attention']
 * })
 *
 * // Get insights
 * const insights = await PersonalLog.getInsights(7)
 * const summary = await PersonalLog.getDailySummary()
 * ```
 */

// Re-export analytics module
export * from './analytics'

// Re-export session module
export * from './session'

// ============================================================================
// UNIFIED API
// ============================================================================

import { getEventCollector, initializeAnalytics as initAnalytics, track as trackEvent } from './analytics/collector'
import { initializeSessionManager, getSessionManager, recordActivity as recordSessionActivity, getCurrentSessionId } from './session/manager'
import { getInsightsEngine, generateRecentInsights, getTodaysSummary, getThisWeeksSummary } from './analytics/insights'
import type { ProductId, AnalyticsConfig, EventType, EventData } from './analytics/types'
import type { PartialSessionConfig } from './session/types'

/**
 * Partial session config type for the unified API
 */
type PartialSessionConfig = Parameters<typeof initializeSessionManager>[0]

/**
 * PersonalLog unified API class
 */
export class PersonalLogAPI {
  private productId: ProductId = 'studylog'
  private isInitialized: boolean = false

  /**
   * Initialize PersonalLog for a product
   */
  async initialize(config: {
    productId?: ProductId
    analytics?: Partial<AnalyticsConfig>
    session?: PartialSessionConfig
  } = {}): Promise<void> {
    this.productId = config.productId || 'studylog'

    // Initialize analytics with product ID
    await initAnalytics({
      ...config.analytics,
      productId: this.productId,
    })

    // Initialize session manager
    await initializeSessionManager({
      ...config.session,
      productId: this.productId,
    })

    // Link session ID to analytics
    const sessionId = getCurrentSessionId()
    this.setSessionId(sessionId)

    this.isInitialized = true
  }

  /**
   * Track an analytics event
   */
  async track(type: EventType, data: EventData): Promise<void> {
    await trackEvent(type, data)
  }

  /**
   * Record an activity in the current session
   */
  recordActivity(activity: string = 'general'): void {
    recordSessionActivity(activity)
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return getCurrentSessionId()
  }

  /**
   * Set the session ID for analytics correlation
   */
  setSessionId(sessionId: string): void {
    const collector = getEventCollector()
    collector.setSessionId(sessionId)
  }

  /**
   * Get insights for a time period
   */
  async getInsights(days: number = 7) {
    return generateRecentInsights(days, this.productId)
  }

  /**
   * Get today's daily summary
   */
  async getDailySummary() {
    return getTodaysSummary(this.productId)
  }

  /**
   * Get this week's summary
   */
  async getWeeklySummary() {
    return getThisWeeksSummary(this.productId)
  }

  /**
   * Get the session manager
   */
  getSessionManager() {
    return getSessionManager()
  }

  /**
   * Get the insights engine
   */
  getInsightsEngine() {
    return getInsightsEngine(this.productId)
  }
}

/**
 * Global PersonalLog instance
 */
export const PersonalLog = new PersonalLogAPI()

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Initialize PersonalLog (alias for PersonalLog.initialize)
 */
export async function initialize(config?: {
  productId?: ProductId
  analytics?: Partial<AnalyticsConfig>
  session?: PartialSessionConfig
}): Promise<void> {
  await PersonalLog.initialize(config)
}
