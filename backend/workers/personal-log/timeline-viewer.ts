/**
 * PersonalLog Worker - Timeline Viewer
 *
 * Visualizes personal history as a chronological timeline.
 * Aggregates journal entries, sessions, achievements, and milestones.
 *
 * @module personal-log/timeline-viewer
 */

import {
  TimelineEvent,
  TimelineEventType,
  TimelineFilterOptions,
  ProductContext,
  JournalEntry,
  Session,
} from './types'

// ============================================================================
// TIMELINE STORAGE
// ============================================================================

const TIMELINE_DB_NAME = 'PersonalLogTimeline'
const TIMELINE_DB_VERSION = 1
const TIMELINE_STORE = 'events'

let timelineDB: IDBDatabase | null = null

/**
 * Initialize the timeline database
 */
async function initTimelineDB(): Promise<IDBDatabase> {
  if (timelineDB) return timelineDB

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(TIMELINE_DB_NAME, TIMELINE_DB_VERSION)

    request.onerror = () => reject(new Error('Failed to open timeline database'))
    request.onsuccess = () => {
      timelineDB = request.result
      resolve(timelineDB)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create events store
      if (!database.objectStoreNames.contains(TIMELINE_STORE)) {
        const store = database.createObjectStore(TIMELINE_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('productId', 'productId', { unique: false })
      }
    }
  })
}

// ============================================================================
// TIMELINE BUILDER
// ============================================================================

/**
 * Timeline event builder configuration
 */
export interface TimelineBuilderConfig {
  /** Whether to include journal entries */
  includeJournal: boolean

  /** Whether to include sessions */
  includeSessions: boolean

  /** Whether to aggregate similar events */
  aggregate: boolean

  /** Whether to enhance events with additional context */
  enhance: boolean
}

/**
 * Default timeline builder configuration
 */
export const DEFAULT_TIMELINE_CONFIG: TimelineBuilderConfig = {
  includeJournal: true,
  includeSessions: true,
  aggregate: true,
  enhance: true,
}

/**
 * Timeline builder for creating chronological views
 */
export class TimelineBuilder {
  private productId: ProductContext
  private config: TimelineBuilderConfig

  constructor(productId: ProductContext, config: Partial<TimelineBuilderConfig> = {}) {
    this.productId = productId
    this.config = { ...DEFAULT_TIMELINE_CONFIG, ...config }
  }

  /**
   * Build timeline from journal entries and sessions
   */
  async buildTimeline(
    journalEntries: JournalEntry[],
    sessions: Session[],
    customEvents?: Partial<TimelineEvent>[]
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = []

    // Add journal entry events
    if (this.config.includeJournal) {
      for (const entry of journalEntries) {
        events.push(this.journalEntryToTimelineEvent(entry))
      }
    }

    // Add session events
    if (this.config.includeSessions) {
      for (const session of sessions) {
        events.push(this.sessionToTimelineEvent(session))
      }
    }

    // Add custom events
    if (customEvents) {
      for (const custom of customEvents) {
        if (custom.id && custom.timestamp && custom.type && custom.title && custom.productId) {
          events.push(custom as TimelineEvent)
        }
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Enhance events if enabled
    if (this.config.enhance) {
      for (const event of events) {
        this.enhanceEvent(event)
      }
    }

    return events
  }

  /**
   * Convert journal entry to timeline event
   */
  private journalEntryToTimelineEvent(entry: JournalEntry): TimelineEvent {
    const icon = this.getJournalIcon(entry.type)
    const color = this.getJournalColor(entry.type)
    const description = entry.content.substring(0, 200) + (entry.content.length > 200 ? '...' : '')

    return {
      id: `journal_${entry.id}`,
      timestamp: entry.timestamp,
      type: 'journal',
      title: entry.title,
      description,
      icon,
      color,
      productId: entry.productId,
      metadata: {
        entryId: entry.id,
        entryType: entry.type,
        mood: entry.mood,
        tags: entry.tags,
      },
    }
  }

  /**
   * Convert session to timeline event
   */
  private sessionToTimelineEvent(session: Session): TimelineEvent {
    const isActive = session.status === 'active'
    const duration = session.duration
      ? this.formatDuration(session.duration)
      : (isActive ? 'In progress' : 'No duration')

    return {
      id: `session_${session.id}`,
      timestamp: session.startTime,
      type: 'session',
      title: `${isActive ? 'Active' : 'Completed'} Session`,
      description: `${duration} • ${session.eventsCount} events`,
      icon: 'clock',
      color: isActive ? '#10b981' : '#6b7280',
      productId: session.productId,
      metadata: {
        sessionId: session.id,
        status: session.status,
        duration: session.duration,
        eventsCount: session.eventsCount,
        featuresUsed: session.featuresUsed,
      },
    }
  }

  /**
   * Get icon for journal entry type
   */
  private getJournalIcon(type: string): string {
    const icons: Record<string, string> = {
      reflection: 'lightbulb',
      observation: 'eye',
      question: 'question-mark',
      breakthrough: 'star',
      session_log: 'book',
      character_note: 'user',
      world_building: 'globe',
      dm_reflection: 'scroll',
      daily_entry: 'calendar',
      milestone: 'flag',
      goal: 'target',
    }

    return icons[type] || 'document'
  }

  /**
   * Get color for journal entry type
   */
  private getJournalColor(type: string): string {
    const colors: Record<string, string> = {
      reflection: '#8b5cf6',
      observation: '#3b82f6',
      question: '#f59e0b',
      breakthrough: '#ec4899',
      session_log: '#10b981',
      character_note: '#6366f1',
      world_building: '#14b8a6',
      dm_reflection: '#8b5cf6',
      daily_entry: '#6b7280',
      milestone: '#f59e0b',
      goal: '#ef4444',
    }

    return colors[type] || '#6b7280'
  }

  /**
   * Enhance event with additional context
   */
  private enhanceEvent(event: TimelineEvent): void {
    // Add relative time
    const relativeTime = this.getRelativeTime(new Date(event.timestamp))
    if (!event.metadata) event.metadata = {}
    event.metadata.relativeTime = relativeTime

    // Add icon if not present
    if (!event.icon) {
      event.icon = this.getDefaultIcon(event.type)
    }

    // Add color if not present
    if (!event.color) {
      event.color = this.getDefaultColor(event.type)
    }
  }

  /**
   * Get default icon for event type
   */
  private getDefaultIcon(type: TimelineEventType): string {
    const icons: Record<TimelineEventType, string> = {
      journal: 'document',
      session: 'clock',
      achievement: 'trophy',
      milestone: 'flag',
      insight: 'lightbulb',
    }

    return icons[type] || 'circle'
  }

  /**
   * Get default color for event type
   */
  private getDefaultColor(type: TimelineEventType): string {
    const colors: Record<TimelineEventType, string> = {
      journal: '#6b7280',
      session: '#3b82f6',
      achievement: '#f59e0b',
      milestone: '#ec4899',
      insight: '#8b5cf6',
    }

    return colors[type] || '#6b7280'
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  /**
   * Get relative time string
   */
  private getRelativeTime(date: Date): string {
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 7) {
      return date.toLocaleDateString()
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    } else {
      return 'Just now'
    }
  }
}

// ============================================================================
// TIMELINE VIEWER
// ============================================================================

/**
 * Timeline viewer for querying and filtering timeline events
 */
export class TimelineViewer {
  private productId: ProductContext
  private builder: TimelineBuilder
  private cache: Map<string, TimelineEvent[]> = new Map()
  private cacheExpiry: number = 5 * 60 * 1000 // 5 minutes

  constructor(productId: ProductContext, config?: Partial<TimelineBuilderConfig>) {
    this.productId = productId
    this.builder = new TimelineBuilder(productId, config)
  }

  /**
   * Get timeline with filters
   */
  async getTimeline(
    journalEntries: JournalEntry[],
    sessions: Session[],
    options: TimelineFilterOptions = {}
  ): Promise<TimelineEvent[]> {
    // Build timeline
    let events = await this.builder.buildTimeline(journalEntries, sessions)

    // Apply filters
    events = this.applyFilters(events, options)

    // Apply pagination
    const offset = options.offset || 0
    const limit = options.limit || events.length
    events = events.slice(offset, offset + limit)

    return events
  }

  /**
   * Get timeline for a specific date range
   */
  async getDateRange(
    journalEntries: JournalEntry[],
    sessions: Session[],
    startDate: Date,
    endDate: Date
  ): Promise<TimelineEvent[]> {
    return this.getTimeline(journalEntries, sessions, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      sortOrder: 'asc',
    })
  }

  /**
   * Get today's timeline
   */
  async getToday(
    journalEntries: JournalEntry[],
    sessions: Session[]
  ): Promise<TimelineEvent[]> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    return this.getDateRange(journalEntries, sessions, startOfDay, endOfDay)
  }

  /**
   * Get timeline grouped by day
   */
  async getGroupedByDay(
    journalEntries: JournalEntry[],
    sessions: Session[],
    options: TimelineFilterOptions = {}
  ): Promise<Map<string, TimelineEvent[]>> {
    const events = await this.getTimeline(journalEntries, sessions, options)

    const grouped = new Map<string, TimelineEvent[]>()

    for (const event of events) {
      const date = event.timestamp.split('T')[0]
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(event)
    }

    return grouped
  }

  /**
   * Get timeline statistics
   */
  async getStatistics(
    journalEntries: JournalEntry[],
    sessions: Session[]
  ): Promise<{
    totalEvents: number
    journalEntries: number
    sessions: number
    activeDays: number
    longestSession: number
    averageSessionDuration: number
    topTags: Array<{ tag: string; count: number }>
  }> {
    const timeline = await this.builder.buildTimeline(journalEntries, sessions)

    // Count events by type
    const journalCount = timeline.filter(e => e.type === 'journal').length
    const sessionCount = timeline.filter(e => e.type === 'session').length

    // Find active days
    const activeDays = new Set(timeline.map(e => e.timestamp.split('T')[0])).size

    // Session stats
    const completedSessions = sessions.filter(s => s.duration)
    const longestSession = Math.max(0, ...completedSessions.map(s => s.duration || 0))
    const avgSessionDuration = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / completedSessions.length
      : 0

    // Top tags
    const tagCounts = new Map<string, number>()
    for (const entry of journalEntries) {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    return {
      totalEvents: timeline.length,
      journalEntries: journalCount,
      sessions: sessionCount,
      activeDays,
      longestSession,
      averageSessionDuration: Math.round(avgSessionDuration),
      topTags,
    }
  }

  /**
   * Apply filters to timeline events
   */
  private applyFilters(events: TimelineEvent[], options: TimelineFilterOptions): TimelineEvent[] {
    let filtered = [...events]

    // Date range filter
    if (options.startDate) {
      filtered = filtered.filter(e => e.timestamp >= options.startDate!)
    }
    if (options.endDate) {
      filtered = filtered.filter(e => e.timestamp <= options.endDate!)
    }

    // Type filter
    if (options.types && options.types.length > 0) {
      filtered = filtered.filter(e => options.types!.includes(e.type))
    }

    // Product filter
    if (options.products && options.products.length > 0) {
      filtered = filtered.filter(e => options.products!.includes(e.productId))
    }

    // Tag filter (search in metadata)
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(e => {
        if (!e.metadata) return false
        const entryTags = e.metadata.tags as string[] || []
        return options.tags!.some(tag => entryTags.includes(tag))
      })
    }

    // Search filter
    if (options.search) {
      const searchLower = options.search.toLowerCase()
      filtered = filtered.filter(e => {
        const titleMatch = e.title.toLowerCase().includes(searchLower)
        const descMatch = e.description?.toLowerCase().includes(searchLower)
        return titleMatch || descMatch
      })
    }

    // Sort order
    const sortOrder = options.sortOrder || 'desc'
    filtered.sort((a, b) => {
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      return sortOrder === 'asc' ? diff : -diff
    })

    return filtered
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}

// ============================================================================
// TIMELINE EXPORTER
// ============================================================================

/**
 * Timeline export formats
 */
export type TimelineExportFormat = 'json' | 'markdown' | 'csv' | 'html'

/**
 * Timeline exporter for various output formats
 */
export class TimelineExporter {
  /**
   * Export timeline to JSON
   */
  exportToJSON(events: TimelineEvent[]): string {
    return JSON.stringify(events, null, 2)
  }

  /**
   * Export timeline to Markdown
   */
  exportToMarkdown(events: TimelineEvent[]): string {
    let markdown = '# Timeline\n\n'

    // Group by date
    const grouped = new Map<string, TimelineEvent[]>()
    for (const event of events) {
      const date = event.timestamp.split('T')[0]
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(event)
    }

    // Generate markdown
    for (const [date, dateEvents] of grouped.entries()) {
      markdown += `## ${date}\n\n`

      for (const event of dateEvents) {
        const time = new Date(event.timestamp).toLocaleTimeString()
        const icon = event.icon ? this.iconToEmoji(event.icon) : '•'
        markdown += `### ${icon} ${time} - ${event.title}\n\n`

        if (event.description) {
          markdown += `${event.description}\n\n`
        }

        if (event.metadata?.tags && Array.isArray(event.metadata.tags)) {
          markdown += `**Tags:** ${event.metadata.tags.join(', ')}\n\n`
        }

        markdown += '---\n\n'
      }
    }

    return markdown
  }

  /**
   * Export timeline to CSV
   */
  exportToCSV(events: TimelineEvent[]): string {
    const headers = ['timestamp', 'type', 'title', 'description', 'productId']
    let csv = headers.join(',') + '\n'

    for (const event of events) {
      const row = [
        event.timestamp,
        event.type,
        `"${event.title.replace(/"/g, '""')}"`,
        `"${(event.description || '').replace(/"/g, '""')}"`,
        event.productId,
      ]
      csv += row.join(',') + '\n'
    }

    return csv
  }

  /**
   * Export timeline to HTML
   */
  exportToHTML(events: TimelineEvent[]): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timeline Export</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .timeline { position: relative; padding-left: 40px; }
    .timeline::before { content: ''; position: absolute; left: 15px; top: 0; bottom: 0; width: 2px; background: #e5e7eb; }
    .event { position: relative; margin-bottom: 30px; }
    .event-icon { position: absolute; left: -32px; width: 24px; height: 24px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .event-time { font-size: 14px; color: #6b7280; margin-bottom: 4px; }
    .event-title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .event-description { color: #374151; line-height: 1.6; }
    .event-tags { margin-top: 8px; }
    .tag { display: inline-block; background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
  </style>
</head>
<body>
  <h1>Timeline</h1>
  <div class="timeline">
`

    for (const event of events) {
      const time = new Date(event.timestamp).toLocaleString()
      const iconLetter = (event.icon || '•')[0].toUpperCase()

      html += `
    <div class="event">
      <div class="event-icon">${iconLetter}</div>
      <div class="event-time">${time}</div>
      <div class="event-title">${this.escapeHTML(event.title)}</div>
      ${event.description ? `<div class="event-description">${this.escapeHTML(event.description)}</div>` : ''}
      ${event.metadata?.tags && Array.isArray(event.metadata.tags) ? `
        <div class="event-tags">
          ${event.metadata.tags.map((tag: string) => `<span class="tag">${this.escapeHTML(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
`
    }

    html += `
  </div>
</body>
</html>`

    return html
  }

  /**
   * Convert icon name to emoji
   */
  private iconToEmoji(icon: string): string {
    const emojiMap: Record<string, string> = {
      lightbulb: '💡',
      eye: '👁️',
      'question-mark': '❓',
      star: '⭐',
      book: '📖',
      user: '👤',
      globe: '🌍',
      scroll: '📜',
      calendar: '📅',
      flag: '🚩',
      target: '🎯',
      clock: '🕐',
      trophy: '🏆',
      document: '📄',
      circle: '⚫',
    }

    return emojiMap[icon] || '•'
  }

  /**
   * Escape HTML entities
   */
  private escapeHTML(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a timeline viewer for the specified product
 */
export function createTimelineViewer(productId: ProductContext): TimelineViewer {
  return new TimelineViewer(productId)
}

/**
 * Create a timeline exporter
 */
export function createTimelineExporter(): TimelineExporter {
  return new TimelineExporter()
}

/**
 * Create a timeline builder for the specified product
 */
export function createTimelineBuilder(
  productId: ProductContext,
  config?: Partial<TimelineBuilderConfig>
): TimelineBuilder {
  return new TimelineBuilder(productId, config)
}
