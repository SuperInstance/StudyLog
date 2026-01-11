/**
 * Personal Log - Analytics Insights
 *
 * Automated insight generation from analytics data.
 */

import type {
  AnalyticsEvent,
  Insight,
  LearningInsight,
  EngagementInsight,
  PerformanceInsight,
  TimeRange,
  DailySummary,
  WeeklySummary,
  ProductId,
} from './types'
import { analyticsEventStore } from './storage'

// ============================================================================
// INSIGHTS ENGINE
// ============================================================================

/**
 * Analytics insights engine
 */
export class InsightsEngine {
  constructor(private productId: ProductId = 'studylog') {}

  /**
   * Generate comprehensive insights for a time range
   */
  async generateInsights(
    timeRange: TimeRange,
    categories?: Array<'usage' | 'learning' | 'performance' | 'error' | 'engagement'>
  ): Promise<Insight[]> {
    const allInsights: Insight[] = []

    // Generate insights by category
    if (!categories || categories.includes('usage')) {
      allInsights.push(...(await this.generateUsageInsights(timeRange)))
    }

    if (!categories || categories.includes('learning')) {
      allInsights.push(...(await this.generateLearningInsights(timeRange)))
    }

    if (!categories || categories.includes('performance')) {
      allInsights.push(...(await this.generatePerformanceInsights(timeRange)))
    }

    if (!categories || categories.includes('error')) {
      allInsights.push(...(await this.generateErrorInsights(timeRange)))
    }

    if (!categories || categories.includes('engagement')) {
      allInsights.push(...(await this.generateEngagementInsights(timeRange)))
    }

    // Sort by severity and timestamp
    return allInsights.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 }
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (severityDiff !== 0) return severityDiff

      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }

  /**
   * Generate daily summary
   */
  async generateDailySummary(date: Date = new Date()): Promise<DailySummary> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const events = await analyticsEventStore.queryEvents({
      startTime: startOfDay.toISOString(),
      endTime: endOfDay.toISOString(),
      productIds: [this.productId],
    })

    const messages = events.filter(e => e.type === 'message_sent')
    const sessions = events.filter(e => e.type === 'session_end')
    const errors = events.filter(e => e.type === 'error_occurred')
    const features = events.filter(e => e.type === 'feature_used')

    // Find peak hour
    const hourCounts = new Array(24).fill(0)
    for (const event of events) {
      const hour = new Date(event.timestamp).getHours()
      hourCounts[hour]++
    }
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

    // Find most used feature
    const featureCounts = new Map<string, number>()
    for (const event of features) {
      const featureId = (event.data as any).featureId || 'unknown'
      featureCounts.set(featureId, (featureCounts.get(featureId) || 0) + 1)
    }
    const mostUsedFeature = Array.from(featureCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

    // Calculate active time from session durations
    let activeTime = 0
    for (const session of sessions) {
      activeTime += (session.data as any).duration || 0
    }

    // Product-specific stats
    const productSpecific = this.productId === 'studylog'
      ? { studylog: this.generateStudyLogStats(events) }
      : this.productId === 'dmlog'
      ? { dmlog: this.generateDMLogStats(events) }
      : undefined

    return {
      date: startOfDay.toISOString().split('T')[0],
      productId: this.productId,
      summary: `You generated ${events.length} events across ${sessions.length} sessions with ${errors.length} errors.`,
      stats: {
        totalEvents: events.length,
        totalSessions: sessions.length,
        totalErrors: errors.length,
        mostUsedFeature,
        peakUsageHour: peakHour,
        activeTime,
      },
      patterns: [],
      issues: errors.length > 0 ? [`Encountered ${errors.length} errors`] : [],
      suggestions: [],
      trends: {
        events: 'stable',
        errors: 'stable',
        performance: 'good',
      },
      productSpecific,
    }
  }

  /**
   * Generate weekly summary
   */
  async generateWeeklySummary(weekStart: Date = new Date()): Promise<WeeklySummary> {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const currentWeek = await analyticsEventStore.queryEvents({
      startTime: weekStart.toISOString(),
      endTime: weekEnd.toISOString(),
      productIds: [this.productId],
    })

    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)

    const prevWeek = await analyticsEventStore.queryEvents({
      startTime: prevWeekStart.toISOString(),
      endTime: weekStart.toISOString(),
      productIds: [this.productId],
    })

    const eventsChange = prevWeek.length
      ? ((currentWeek.length - prevWeek.length) / prevWeek.length) * 100
      : 0

    const summary = await this.generateDailySummary(weekStart)
    const insights = await this.generateInsights(
      { type: 'days', value: 7 },
      ['usage', 'learning', 'performance', 'error', 'engagement']
    )

    // Get top features
    const featureEvents = currentWeek.filter(e => e.type === 'feature_used')
    const featureCounts = new Map<string, number>()
    for (const event of featureEvents) {
      const featureId = (event.data as any).featureId || 'unknown'
      featureCounts.set(featureId, (featureCounts.get(featureId) || 0) + 1)
    }
    const topFeatures = Array.from(featureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([feature, usageCount]) => ({ feature, usageCount }))

    // Get top errors
    const errorEvents = currentWeek.filter(e => e.type === 'error_occurred')
    const errorCounts = new Map<string, number>()
    for (const event of errorEvents) {
      const errorType = (event.data as any).errorType || 'unknown'
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1)
    }
    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }))

    return {
      ...summary,
      weekRange: `${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`,
      comparison: {
        eventsChange,
        sessionsChange: 0,
        errorsChange: 0,
        performanceChange: 'stable',
      },
      topFeatures,
      topErrors,
      goals: {
        achieved: [],
        inProgress: [],
        notAchieved: [],
      },
      patterns: insights.filter(i => i.category === 'usage').map(i => i.description),
      issues: insights.filter(i => i.severity === 'warning' || i.severity === 'critical').map(i => i.description),
      suggestions: insights.filter(i => i.category === 'optimization').map(i => i.description),
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private async generateUsageInsights(timeRange: TimeRange): Promise<Insight[]> {
    const insights: Insight[] = []
    const events = await this.getEventsInRange(timeRange)

    if (events.length === 0) {
      return [{
        id: `usage_none_${Date.now()}`,
        category: 'usage',
        severity: 'info',
        title: 'No Activity Recorded',
        description: 'No events recorded in this time period',
        timestamp: new Date().toISOString(),
        productId: this.productId,
      }]
    }

    // Detect peak usage hours
    const hourCounts = new Array(24).fill(0)
    for (const event of events) {
      const hour = new Date(event.timestamp).getHours()
      hourCounts[hour]++
    }

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))
    const peakCount = hourCounts[peakHour]
    const avgCount = hourCounts.reduce((a, b) => a + b, 0) / 24

    if (peakCount > avgCount * 2) {
      insights.push({
        id: `usage_peak_${Date.now()}`,
        category: 'usage',
        severity: 'info',
        title: 'Peak Usage Detected',
        description: `Your activity peaks at ${peakHour}:00 with ${peakCount} events`,
        timestamp: new Date().toISOString(),
        productId: this.productId,
      })
    }

    return insights
  }

  private async generateLearningInsights(timeRange: TimeRange): Promise<Insight[]> {
    const insights: Insight[] = []
    const events = await this.getEventsInRange(timeRange)

    if (this.productId !== 'studylog') {
      return insights
    }

    // StudyLoG.AI specific learning insights
    const lessonsCompleted = events.filter(e => e.type === 'lesson_completed')
    const conceptsMastered = events.filter(e => e.type === 'concept_mastered')
    const skillsUnlocked = events.filter(e => e.type === 'skill_unlocked')

    if (lessonsCompleted.length > 5) {
      insights.push({
        id: `learning_lessons_${Date.now()}`,
        category: 'learning',
        severity: 'success',
        title: 'Strong Learning Progress',
        description: `You completed ${lessonsCompleted.length} lessons this period`,
        timestamp: new Date().toISOString(),
        productId: this.productId,
      })
    }

    if (conceptsMastered.length > 0) {
      insights.push({
        id: `learning_concepts_${Date.now()}`,
        category: 'learning',
        severity: 'success',
        title: 'Concepts Mastered',
        description: `You mastered ${conceptsMastered.length} new concepts`,
        timestamp: new Date().toISOString(),
        productId: this.productId,
      })
    }

    return insights
  }

  private async generatePerformanceInsights(timeRange: TimeRange): Promise<Insight[]> {
    const insights: Insight[] = []
    const events = await this.getEventsInRange(timeRange, ['api_response', 'render_complete'])

    // Analyze API response times
    const apiEvents = events.filter(e => e.type === 'api_response')
    const apiDurations = apiEvents.map(e => (e.data as any).duration).filter(d => d !== undefined)

    if (apiDurations.length > 10) {
      const avg = apiDurations.reduce((a, b) => a + b, 0) / apiDurations.length
      const sorted = [...apiDurations].sort((a, b) => a - b)
      const p95 = sorted[Math.floor(apiDurations.length * 0.95)]

      if (p95 > 5000) {
        insights.push({
          id: `perf_slow_api_${Date.now()}`,
          category: 'performance',
          severity: p95 > 10000 ? 'critical' : 'warning',
          title: 'Slow API Response Times',
          description: `95th percentile response time is ${p95.toFixed(0)}ms`,
          timestamp: new Date().toISOString(),
          productId: this.productId,
        })
      }
    }

    return insights
  }

  private async generateErrorInsights(timeRange: TimeRange): Promise<Insight[]> {
    const insights: Insight[] = []
    const events = await this.getEventsInRange(timeRange, ['error_occurred', 'error_recovered'])

    if (events.length === 0) {
      insights.push({
        id: `error_clean_${Date.now()}`,
        category: 'error',
        severity: 'success',
        title: 'No Errors Detected',
        description: 'No errors occurred in this time period',
        timestamp: new Date().toISOString(),
        productId: this.productId,
      })
      return insights
    }

    // Group errors by type
    const errorCounts = new Map<string, number>()

    for (const event of events) {
      if (event.type === 'error_occurred') {
        const errorType = (event.data as any).errorType || 'unknown'
        errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1)
      }
    }

    // Detect critical errors
    for (const [errorType, count] of errorCounts.entries()) {
      if (count > 10) {
        insights.push({
          id: `error_frequent_${Date.now()}_${errorType}`,
          category: 'error',
          severity: count > 50 ? 'critical' : 'warning',
          title: `Frequent Error: ${errorType}`,
          description: `${errorType} occurred ${count} times`,
          timestamp: new Date().toISOString(),
          productId: this.productId,
        })
      }
    }

    return insights
  }

  private async generateEngagementInsights(timeRange: TimeRange): Promise<Insight[]> {
    const insights: Insight[] = []
    const events = await this.getEventsInRange(timeRange, ['session_start', 'session_end', 'feature_used'])

    // Calculate session stats
    const sessionEnds = events.filter(e => e.type === 'session_end')
    if (sessionEnds.length > 0) {
      const durations = sessionEnds.map(e => (e.data as any).duration || 0)
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length

      insights.push({
        id: `engagement_session_${Date.now()}`,
        category: 'engagement',
        severity: 'info',
        title: 'Average Session Duration',
        description: `Average session lasts ${Math.floor(avgDuration / 60)} minutes`,
        timestamp: new Date().toISOString(),
        productId: this.productId,
      })
    }

    return insights
  }

  private async getEventsInRange(
    timeRange: TimeRange,
    types?: string[]
  ): Promise<AnalyticsEvent[]> {
    const { start, end } = this.getTimeRangeBoundaries(timeRange)
    return analyticsEventStore.queryEvents({
      startTime: start,
      endTime: end,
      types,
      productIds: [this.productId],
    })
  }

  private getTimeRangeBoundaries(timeRange: TimeRange): { start: string; end: string } {
    const end = new Date()
    const start = new Date()

    switch (timeRange.type) {
      case 'hours':
        start.setHours(start.getHours() - timeRange.value)
        break
      case 'days':
        start.setDate(start.getDate() - timeRange.value)
        break
      case 'weeks':
        start.setDate(start.getDate() - timeRange.value * 7)
        break
      case 'months':
        start.setMonth(start.getMonth() - timeRange.value)
        break
      case 'all':
        start.setFullYear(start.getFullYear() - 100)
        break
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    }
  }

  private generateStudyLogStats(events: AnalyticsEvent[]) {
    return {
      lessonsCompleted: events.filter(e => e.type === 'lesson_completed').length,
      conceptsMastered: events.filter(e => e.type === 'concept_mastered').length,
      skillsUnlocked: events.filter(e => e.type === 'skill_unlocked').length,
      timeInCognitiveMill: events.filter(e => e.type === 'mill_simulation_started').length * 600, // Estimate
      timeInIntelligenceRanch: events.filter(e => e.type === 'agent_bred').length * 300,
      timeInSitkaSound: events.filter(e => e.type === 'flock_simulation_started').length * 300,
      agentsBred: events.filter(e => e.type === 'agent_bred').length,
    }
  }

  private generateDMLogStats(events: AnalyticsEvent[]) {
    const encounters = events.filter(e => e.type === 'encounter_completed')
    return {
      encountersCompleted: encounters.length,
      npcsCreated: events.filter(e => e.type === 'npc_created').length,
      campaignSessions: events.filter(e => e.type === 'campaign_session_started').length,
      totalPlayTime: encounters.reduce((sum, e) => sum + ((e.data as any)?.duration || 0), 0),
      encountersCompletedVictory: encounters.filter(e => (e.data as any)?.victorious).length,
      averageSessionPlayers: 4, // Placeholder
    }
  }
}

// ============================================================================
// GLOBAL INSIGHTS ENGINE INSTANCE
// ============================================================================

const insightsEngines = new Map<ProductId, InsightsEngine>()

/**
 * Get or create the insights engine for a product
 */
export function getInsightsEngine(productId: ProductId = 'studylog'): InsightsEngine {
  if (!insightsEngines.has(productId)) {
    insightsEngines.set(productId, new InsightsEngine(productId))
  }
  return insightsEngines.get(productId)!
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Generate insights for the last N days
 */
export async function generateRecentInsights(
  days: number = 7,
  productId: ProductId = 'studylog'
): Promise<Insight[]> {
  const engine = getInsightsEngine(productId)
  return engine.generateInsights({ type: 'days', value: days })
}

/**
 * Get today's daily summary
 */
export async function getTodaysSummary(productId: ProductId = 'studylog'): Promise<DailySummary> {
  const engine = getInsightsEngine(productId)
  return engine.generateDailySummary()
}

/**
 * Get this week's summary
 */
export async function getThisWeeksSummary(productId: ProductId = 'studylog'): Promise<WeeklySummary> {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const engine = getInsightsEngine(productId)
  return engine.generateWeeklySummary(weekStart)
}
