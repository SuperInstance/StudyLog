/**
 * PersonalLog Worker - Main Entry Point
 *
 * Privacy-first, local-first personal logging system for SuperInstance.AI products.
 * Provides journal entries, session tracking, reflection prompts, timeline views, and export capabilities.
 *
 * @module personal-log
 *
 * @example
 * ```typescript
 * import { PersonalLog } from '@workers/personal-log'
 *
 * const personalLog = new PersonalLog('studylog')
 *
 * // Start a session
 * await personalLog.startSession('user-123')
 *
 * // Create a journal entry
 * await personalLog.journal.createReflection({
 *   userId: 'user-123',
 *   sessionId: personalLog.session.getSessionId()!,
 *   title: 'Learning about Neural Networks',
 *   content: 'Today I learned about backpropagation...',
 *   concept: 'backpropagation',
 *   mood: 'excited',
 * })
 *
 * // Get reflection prompts
 * const prompts = await personalLog.prompts.getPrompts()
 *
 * // Export data
 * const exportResult = await personalLog.export.exportMarkdown(entries, sessions)
 * ```
 */

// ============================================================================
// EXPORTS - TYPES
// ============================================================================

export * from './types'

// ============================================================================
// EXPORTS - JOURNAL
// ============================================================================

export {
  JournalManager,
  JournalStorage,
  JournalQueryOptions,
  StudyLogJournalManager,
  DMLogJournalManager,
  createJournalManager,
} from './journal'

// ============================================================================
// EXPORTS - SESSION LOGGER
// ============================================================================

export {
  SessionManager,
  SessionStorage,
  SessionManagerConfig,
  DEFAULT_SESSION_CONFIG,
  StudyLogSessionManager,
  DMLogSessionManager,
  createSessionManager,
} from './session-logger'

// ============================================================================
// EXPORTS - REFLECTION PROMPTS
// ============================================================================

export {
  ReflectionPromptManager,
  AIPromptGenerator,
  PromptGenerationConfig,
  DEFAULT_PROMPT_CONFIG,
  STUDYLOG_PROMPTS,
  DMLOG_PROMPTS,
  createPromptManager,
  createAIPromptGenerator,
} from './reflection-prompts'

// ============================================================================
// EXPORTS - TIMELINE VIEWER
// ============================================================================

export {
  TimelineBuilder,
  TimelineViewer,
  TimelineExporter,
  TimelineBuilderConfig,
  DEFAULT_TIMELINE_CONFIG,
  createTimelineViewer,
  createTimelineExporter,
  createTimelineBuilder,
} from './timeline-viewer'

// ============================================================================
// EXPORTS - EXPORT SYSTEM
// ============================================================================

export {
  ExportSystem,
  ExportConverter,
  ExportData,
  ExportSystemConfig,
  DEFAULT_EXPORT_CONFIG,
  JSONConverter,
  MarkdownConverter,
  CSVConverter,
  HTMLConverter,
  YAMLConverter,
  PDFConverter,
  createExportSystem,
  createConverter,
} from './export-system'

// ============================================================================
// IMPORT DEPENDENCIES
// ============================================================================

import {
  JournalManager,
  createJournalManager,
} from './journal'

import {
  SessionManager,
  createSessionManager,
} from './session-logger'

import {
  ReflectionPromptManager,
  createPromptManager,
} from './reflection-prompts'

import {
  TimelineViewer,
  createTimelineViewer,
} from './timeline-viewer'

import {
  ExportSystem,
  createExportSystem,
} from './export-system'

import type {
  ProductContext,
  PersonalLogConfig,
  DEFAULT_PERSONAL_LOG_CONFIG,
} from './types'

// ============================================================================
// MAIN PERSONAL LOG CLASS
// ============================================================================

/**
 * PersonalLog - Main entry point for the personal logging system
 *
 * Provides a unified interface for journal entries, session tracking,
 * reflection prompts, timeline viewing, and data export.
 */
export class PersonalLog {
  private readonly productId: ProductContext
  private readonly config: PersonalLogConfig

  /** Journal manager for creating and managing journal entries */
  readonly journal: JournalManager

  /** Session manager for tracking user sessions */
  readonly session: SessionManager

  /** Reflection prompt manager for generating reflection questions */
  readonly prompts: ReflectionPromptManager

  /** Timeline viewer for visualizing personal history */
  readonly timeline: TimelineViewer

  /** Export system for exporting data to various formats */
  readonly export: ExportSystem

  /**
   * Create a new PersonalLog instance
   *
   * @param productId - The product context (studylog, dmlog, etc.)
   * @param config - Optional configuration
   */
  constructor(productId: ProductContext, config?: Partial<PersonalLogConfig>) {
    this.productId = productId
    this.config = { ...DEFAULT_PERSONAL_LOG_CONFIG, ...config }

    // Initialize subsystems
    this.journal = createJournalManager(productId)
    this.session = createSessionManager(productId, {
      sessionTimeout: this.config.sessionTimeout,
    })
    this.prompts = createPromptManager(productId)
    this.timeline = createTimelineViewer(productId)
    this.export = createExportSystem(productId, {
      includeAI: true,
      includePrivate: false,
      anonymize: this.config.anonymize,
    })
  }

  /**
   * Start a new user session
   *
   * @param userId - User identifier
   * @param source - Session source
   * @param context - Optional session context
   * @returns The created session
   */
  async startSession(
    userId: string,
    source: 'direct' | 'notification' | 'link' | 'invitation' = 'direct',
    context?: Record<string, unknown>
  ) {
    return this.session.startSession(userId, source, context)
  }

  /**
   * End the current session
   *
   * @returns The ended session or null if no active session
   */
  async endSession() {
    return this.session.endSession()
  }

  /**
   * Get the current session
   *
   * @returns The current session or null
   */
  getCurrentSession() {
    return this.session.getCurrentSession()
  }

  /**
   * Get session ID for the current session
   *
   * @returns Session ID or null
   */
  getSessionId(): string | null {
    return this.session.getCurrentSession()?.id || null
  }

  /**
   * Get a daily summary of activity
   *
   * @param date - The date to summarize (default: today)
   * @returns Daily summary with stats and patterns
   */
  async getDailySummary(date: Date = new Date()): Promise<{
    date: string
    summary: string
    stats: {
      journalEntries: number
      sessions: number
      totalTime: number
      topActivity?: string
      peakHour: number
    }
    patterns: string[]
    suggestions: string[]
  }> {
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const entries = await this.journal.getEntriesByDateRange(startOfDay, endOfDay)
    const sessions = await this.session.getUserSessions('', 100) // TODO: Fix user ID

    const journalEntries = entries.filter(e =>
      e.timestamp >= startOfDay.toISOString() &&
      e.timestamp <= endOfDay.toISOString()
    )

    const daySessions = sessions.filter(s =>
      s.startTime >= startOfDay.toISOString() &&
      s.startTime <= endOfDay.toISOString()
    )

    // Calculate peak hour
    const hourCounts = new Array(24).fill(0)
    for (const entry of journalEntries) {
      const hour = new Date(entry.timestamp).getHours()
      hourCounts[hour]++
    }
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

    // Calculate total time
    const totalTime = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0)

    return {
      date: startOfDay.toISOString().split('T')[0],
      summary: `You created ${journalEntries.length} journal entries across ${daySessions.length} sessions.`,
      stats: {
        journalEntries: journalEntries.length,
        sessions: daySessions.length,
        totalTime,
        peakHour,
      },
      patterns: [],
      suggestions: [],
    }
  }

  /**
   * Get reflection prompts for journaling
   *
   * @param count - Number of prompts to generate
   * @param context - Optional context for personalized prompts
   * @returns Array of reflection prompts
   */
  async getReflectionPrompts(
    count: number = 3,
    context?: {
      recentActivity?: string[]
      strugglingConcepts?: string[]
      masteredSkills?: string[]
      mood?: string
    }
  ) {
    return this.prompts.getPrompts({ count }, context)
  }

  /**
   * Get the timeline view
   *
   * @param options - Timeline filter options
   * @returns Timeline events
   */
  async getTimeline(options?: {
    startDate?: string
    endDate?: string
    limit?: number
    types?: string[]
  }) {
    const entries = await this.journal.listEntries({ limit: 100 })
    const sessions = await this.session.getUserSessions('', 100) // TODO: Fix user ID

    return this.timeline.getTimeline(entries, sessions, options)
  }

  /**
   * Export all data
   *
   * @param format - Export format
   * @returns Export result with blob data
   */
  async exportAll(format: 'json' | 'markdown' | 'csv' | 'html' = 'json') {
    const entries = await this.journal.listEntries({ limit: 1000 })
    const sessions = await this.session.getUserSessions('', 100) // TODO: Fix user ID

    return this.export.export(entries, sessions, { format, scope: 'all' })
  }

  /**
   * Cleanup and release resources
   */
  destroy(): void {
    if ('destroy' in this.session) {
      (this.session as any).destroy()
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a PersonalLog instance for the specified product
 *
 * @param productId - The product context
 * @param config - Optional configuration
 * @returns A new PersonalLog instance
 *
 * @example
 * ```typescript
 * const studylog = createPersonalLog('studylog')
 * const dmlog = createPersonalLog('dmlog')
 * ```
 */
export function createPersonalLog(
  productId: ProductContext,
  config?: Partial<PersonalLogConfig>
): PersonalLog {
  return new PersonalLog(productId, config)
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default PersonalLog
