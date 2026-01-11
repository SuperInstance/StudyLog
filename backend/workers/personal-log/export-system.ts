/**
 * PersonalLog Worker - Export System
 *
 * Exports journal entries, sessions, and timeline data to various formats.
 * Supports JSON, Markdown, CSV, PDF, HTML, and YAML export formats.
 *
 * @module personal-log/export-system
 */

import {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportRecord,
  ExportScope,
  ProductContext,
  JournalEntry,
  Session,
  TimelineEvent,
} from './types'

// ============================================================================
// EXPORT CONVERTERS
// ============================================================================

/**
 * Base converter interface
 */
export interface ExportConverter {
  format: ExportFormat
  convert(data: ExportData): Promise<Blob>
}

/**
 * Data to export
 */
export interface ExportData {
  journalEntries: JournalEntry[]
  sessions: Session[]
  timeline?: TimelineEvent[]
  metadata: {
    exportDate: string
    product: ProductContext
    version: string
  }
}

// ============================================================================
// JSON CONVERTER
// ============================================================================

/**
 * JSON export converter
 */
export class JSONConverter implements ExportConverter {
  format: ExportFormat = 'json'

  async convert(data: ExportData): Promise<Blob> {
    const json = JSON.stringify({
      metadata: data.metadata,
      journal: data.journalEntries,
      sessions: data.sessions,
      timeline: data.timeline,
    }, null, 2)

    return new Blob([json], { type: 'application/json' })
  }
}

// ============================================================================
// MARKDOWN CONVERTER
// ============================================================================

/**
 * Markdown export converter
 */
export class MarkdownConverter implements ExportConverter {
  format: ExportFormat = 'markdown'

  async convert(data: ExportData): Promise<Blob> {
    let markdown = `# PersonalLog Export\n\n`
    markdown += `**Product:** ${data.metadata.product}\n`
    markdown += `**Export Date:** ${data.metadata.exportDate}\n`
    markdown += `**Version:** ${data.metadata.version}\n\n`
    markdown += `---\n\n`

    // Journal Entries
    if (data.journalEntries.length > 0) {
      markdown += `## Journal Entries (${data.journalEntries.length})\n\n`

      // Group by date
      const grouped = this.groupByDate(data.journalEntries)

      for (const [date, entries] of grouped.entries()) {
        markdown += `### ${date}\n\n`

        for (const entry of entries) {
          const time = new Date(entry.timestamp).toLocaleTimeString()
          markdown += `#### ${time} - ${entry.title}\n\n`

          if (entry.mood) {
            markdown += `**Mood:** ${entry.mood}\n\n`
          }

          markdown += `${entry.content}\n\n`

          if (entry.tags.length > 0) {
            markdown += `**Tags:** ${entry.tags.join(', ')}\n\n`
          }

          markdown += `---\n\n`
        }
      }
    }

    // Sessions
    if (data.sessions.length > 0) {
      markdown += `## Sessions (${data.sessions.length})\n\n`

      for (const session of data.sessions) {
        const date = new Date(session.startTime).toLocaleDateString()
        const duration = session.duration ? this.formatDuration(session.duration) : 'In progress'

        markdown += `### ${date} - ${duration}\n\n`
        markdown += `- **Session ID:** ${session.id}\n`
        markdown += `- **Status:** ${session.status}\n`
        markdown += `- **Events:** ${session.eventsCount}\n`

        if (session.featuresUsed.length > 0) {
          markdown += `- **Features:** ${session.featuresUsed.join(', ')}\n`
        }

        markdown += `\n`
      }
    }

    return new Blob([markdown], { type: 'text/markdown' })
  }

  private groupByDate(entries: JournalEntry[]): Map<string, JournalEntry[]> {
    const grouped = new Map<string, JournalEntry[]>()

    for (const entry of entries) {
      const date = entry.timestamp.split('T')[0]
      if (!grouped.has(date)) {
        grouped.set(date, [])
      }
      grouped.get(date)!.push(entry)
    }

    return grouped
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}

// ============================================================================
// CSV CONVERTER
// ============================================================================

/**
 * CSV export converter
 */
export class CSVConverter implements ExportConverter {
  format: ExportFormat = 'csv'

  async convert(data: ExportData): Promise<Blob> {
    let csv = ''

    // Journal entries CSV
    csv += 'JOURNAL ENTRIES\n'
    csv += 'timestamp,type,title,mood,tags,content\n'

    for (const entry of data.journalEntries) {
      const row = [
        entry.timestamp,
        entry.type,
        `"${entry.title.replace(/"/g, '""')}"`,
        entry.mood || '',
        `"${entry.tags.join(', ')}"`,
        `"${entry.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      ]
      csv += row.join(',') + '\n'
    }

    csv += '\nSESSIONS\n'
    csv += 'startTime,endTime,status,duration,eventsCount,featuresUsed\n'

    for (const session of data.sessions) {
      const row = [
        session.startTime,
        session.endTime || '',
        session.status,
        session.duration || '',
        session.eventsCount,
        `"${session.featuresUsed.join(', ')}"`,
      ]
      csv += row.join(',') + '\n'
    }

    return new Blob([csv], { type: 'text/csv' })
  }
}

// ============================================================================
// HTML CONVERTER
// ============================================================================

/**
 * HTML export converter
 */
export class HTMLConverter implements ExportConverter {
  format: ExportFormat = 'html'

  async convert(data: ExportData): Promise<Blob> {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PersonalLog Export - ${data.metadata.product}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 900px; margin: 0 auto; padding: 40px 20px; background: #f9fafb; }
    h1 { color: #111827; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    h2 { color: #1f2937; margin-top: 40px; }
    .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .entry { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .entry-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
    .entry-date { font-size: 14px; color: #6b7280; }
    .entry-title { font-size: 20px; font-weight: 600; color: #111827; }
    .entry-mood { display: inline-block; background: #e5e7eb; padding: 4px 12px; border-radius: 999px; font-size: 12px; }
    .entry-content { color: #374151; white-space: pre-wrap; }
    .entry-tags { margin-top: 15px; }
    .tag { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 4px; font-size: 13px; margin-right: 6px; }
    .session { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; border-radius: 4px; margin-bottom: 15px; }
    .session-meta { font-size: 14px; color: #166534; }
    .stats { display: flex; gap: 30px; margin-top: 20px; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: 700; color: #3b82f6; }
    .stat-label { font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>PersonalLog Export</h1>
    <p><strong>Product:</strong> ${data.metadata.product}</p>
    <p><strong>Export Date:</strong> ${data.metadata.exportDate}</p>
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${data.journalEntries.length}</div>
        <div class="stat-label">Journal Entries</div>
      </div>
      <div class="stat">
        <div class="stat-value">${data.sessions.length}</div>
        <div class="stat-label">Sessions</div>
      </div>
    </div>
  </div>
`

    // Journal entries
    if (data.journalEntries.length > 0) {
      html += '<h2>Journal Entries</h2>\n'

      for (const entry of data.journalEntries) {
        const date = new Date(entry.timestamp).toLocaleString()
        const moodBadge = entry.mood ? `<span class="entry-mood">${entry.mood}</span>` : ''

        html += `
  <div class="entry">
    <div class="entry-header">
      <div class="entry-title">${this.escapeHTML(entry.title)}</div>
      <div class="entry-date">${date}</div>
    </div>
    ${moodBadge}
    <div class="entry-content">${this.escapeHTML(entry.content)}</div>
    ${entry.tags.length > 0 ? `
      <div class="entry-tags">
        ${entry.tags.map(tag => `<span class="tag">${this.escapeHTML(tag)}</span>`).join('')}
      </div>
    ` : ''}
  </div>
`
      }
    }

    // Sessions
    if (data.sessions.length > 0) {
      html += '<h2>Sessions</h2>\n'

      for (const session of data.sessions) {
        const startDate = new Date(session.startTime).toLocaleString()
        const duration = session.duration ? this.formatDuration(session.duration) : 'In progress'

        html += `
  <div class="session">
    <div class="session-meta">
      <strong>${startDate}</strong> • ${duration} • ${session.eventsCount} events
    </div>
  </div>
`
      }
    }

    html += `
</body>
</html>`

    return new Blob([html], { type: 'text/html' })
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  private escapeHTML(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// ============================================================================
// YAML CONVERTER
// ============================================================================

/**
 * YAML export converter
 */
export class YAMLConverter implements ExportConverter {
  format: ExportFormat = 'yaml'

  async convert(data: ExportData): Promise<Blob> {
    let yaml = `# PersonalLog Export\n`
    yaml += `product: ${data.metadata.product}\n`
    yaml += `exportDate: ${data.metadata.exportDate}\n`
    yaml += `version: ${data.metadata.version}\n\n`

    yaml += `journal:\n`
    for (const entry of data.journalEntries) {
      yaml += `  - id: ${entry.id}\n`
      yaml += `    timestamp: ${entry.timestamp}\n`
      yaml += `    type: ${entry.type}\n`
      yaml += `    title: ${this.yamlString(entry.title)}\n`
      yaml += `    mood: ${entry.mood || 'null'}\n`
      yaml += `    tags: [${entry.tags.map(t => `'${t}'`).join(', ')}]\n`
      yaml += `    content: ${this.yamlString(entry.content.substring(0, 100))}...\n`
    }

    yaml += `\nsessions:\n`
    for (const session of data.sessions) {
      yaml += `  - id: ${session.id}\n`
      yaml += `    startTime: ${session.startTime}\n`
      yaml += `    status: ${session.status}\n`
      yaml += `    duration: ${session.duration || 'null'}\n`
      yaml += `    eventsCount: ${session.eventsCount}\n`
    }

    return new Blob([yaml], { type: 'text/yaml' })
  }

  private yamlString(str: string): string {
    if (str.includes('\n') || str.includes(':') || str.includes('#')) {
      return `"${str.replace(/"/g, '\\"')}"`
    }
    return str
  }
}

// ============================================================================
// PDF CONVERTER (Placeholder)
// ============================================================================

/**
 * PDF export converter (requires external library)
 */
export class PDFConverter implements ExportConverter {
  format: ExportFormat = 'pdf'

  async convert(data: ExportData): Promise<Blob> {
    // For PDF, we would typically use a library like jsPDF
    // For now, we'll export as a printable HTML
    const htmlConverter = new HTMLConverter()
    const html = await htmlConverter.convert(data)

    // In production, convert HTML to PDF using a library
    console.warn('PDF export requires jsPDF library. Install with: npm install jspdf')

    return html
  }
}

// ============================================================================
// EXPORT MANAGER
// ============================================================================

/**
 * Export history manager
 */
class ExportHistoryManager {
  private storageKey = 'personallog_export_history'

  async addToHistory(record: ExportRecord): Promise<void> {
    const history = await getHistory()
    history.unshift(record)

    // Limit history to 100 records
    if (history.length > 100) {
      history.splice(100)
    }

    localStorage.setItem(this.storageKey, JSON.stringify(history))
  }

  async getHistory(limit: number = 50): Promise<ExportRecord[]> {
    const history = await getHistory()
    return history.slice(0, limit)
  }

  async clearHistory(): Promise<void> {
    localStorage.removeItem(this.storageKey)
  }

  async deleteExport(id: string): Promise<void> {
    const history = await getHistory()
    const filtered = history.filter(r => r.id !== id)
    localStorage.setItem(this.storageKey, JSON.stringify(filtered))
  }
}

async function getHistory(): Promise<ExportRecord[]> {
  const data = localStorage.getItem('personallog_export_history')
  return data ? JSON.parse(data) : []
}

/**
 * Export system configuration
 */
export interface ExportSystemConfig {
  /** Whether to include AI-generated content */
  includeAI: boolean

  /** Whether to include private entries */
  includePrivate: boolean

  /** Whether to anonymize data */
  anonymize: boolean

  /** Default export format */
  defaultFormat: ExportFormat
}

/**
 * Default export system configuration
 */
export const DEFAULT_EXPORT_CONFIG: ExportSystemConfig = {
  includeAI: true,
  includePrivate: false,
  anonymize: false,
  defaultFormat: 'json',
}

/**
 * Main export system manager
 */
export class ExportSystem {
  private productId: ProductContext
  private config: ExportSystemConfig
  private converters: Map<ExportFormat, ExportConverter>
  private history: ExportHistoryManager

  constructor(productId: ProductContext, config: Partial<ExportSystemConfig> = {}) {
    this.productId = productId
    this.config = { ...DEFAULT_EXPORT_CONFIG, ...config }
    this.history = new ExportHistoryManager()

    // Initialize converters
    this.converters = new Map([
      ['json', new JSONConverter()],
      ['markdown', new MarkdownConverter()],
      ['csv', new CSVConverter()],
      ['html', new HTMLConverter()],
      ['yaml', new YAMLConverter()],
      ['pdf', new PDFConverter()],
    ])
  }

  /**
   * Export data with specified options
   */
  async export(
    journalEntries: JournalEntry[],
    sessions: Session[],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const fullOptions: ExportOptions = {
      format: options.format || this.config.defaultFormat,
      scope: options.scope || 'all',
      product: options.product || this.productId,
      includeAI: options.includeAI ?? this.config.includeAI,
      includePrivate: options.includePrivate ?? this.config.includePrivate,
      anonymize: options.anonymize ?? this.config.anonymize,
      filename: options.filename,
    }

    const startTime = Date.now()

    // Filter data based on options
    let filteredEntries = this.filterEntries(journalEntries, fullOptions)
    let filteredSessions = this.filterSessions(sessions, fullOptions)

    // Anonymize if requested
    if (fullOptions.anonymize) {
      filteredEntries = this.anonymizeEntries(filteredEntries)
      filteredSessions = this.anonymizeSessions(filteredSessions)
    }

    // Prepare export data
    const exportData: ExportData = {
      journalEntries: filteredEntries,
      sessions: filteredSessions,
      metadata: {
        exportDate: new Date().toISOString(),
        product: fullOptions.product,
        version: '1.0.0',
      },
    }

    // Convert to requested format
    const converter = this.converters.get(fullOptions.format)
    if (!converter) {
      throw new Error(`Unsupported export format: ${fullOptions.format}`)
    }

    const blob = await converter.convert(exportData)

    // Generate filename
    const filename = this.generateFilename(fullOptions.format, fullOptions.scope)

    // Get file info
    const stats = {
      entriesCount: filteredEntries.length,
      sessionsCount: filteredSessions.length,
      fileSize: blob.size,
      duration: Date.now() - startTime,
    }

    // Record export
    await this.history.addToHistory({
      id: this.generateId(),
      format: fullOptions.format,
      scope: fullOptions.scope,
      success: true,
      stats,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    })

    return {
      data: blob,
      filename,
      mimeType: this.getMimeType(fullOptions.format),
      stats,
      exportedAt: new Date().toISOString(),
    }
  }

  /**
   * Quick export to JSON
   */
  async exportJSON(
    journalEntries: JournalEntry[],
    sessions: Session[]
  ): Promise<Blob> {
    const result = await this.export(journalEntries, sessions, { format: 'json' })
    return result.data
  }

  /**
   * Quick export to Markdown
   */
  async exportMarkdown(
    journalEntries: JournalEntry[],
    sessions: Session[]
  ): Promise<Blob> {
    const result = await this.export(journalEntries, sessions, { format: 'markdown' })
    return result.data
  }

  /**
   * Quick export to CSV
   */
  async exportCSV(
    journalEntries: JournalEntry[],
    sessions: Session[]
  ): Promise<Blob> {
    const result = await this.export(journalEntries, sessions, { format: 'csv' })
    return result.data
  }

  /**
   * Get export history
   */
  async getHistory(limit: number = 50): Promise<ExportRecord[]> {
    return this.history.getHistory(limit)
  }

  /**
   * Clear export history
   */
  async clearHistory(): Promise<void> {
    await this.history.clearHistory()
  }

  /**
   * Download export to user's computer
   */
  async download(result: ExportResult): Promise<void> {
    const url = URL.createObjectURL(result.data)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Filter entries based on export options
   */
  private filterEntries(entries: JournalEntry[], options: ExportOptions): JournalEntry[] {
    let filtered = [...entries]

    // Filter by AI-generated
    if (!options.includeAI) {
      filtered = filtered.filter(e => !e.aiGenerated)
    }

    // Filter by private
    if (!options.includePrivate) {
      filtered = filtered.filter(e => e.isPublic)
    }

    // Filter by product
    if (options.product) {
      filtered = filtered.filter(e => e.productId === options.product)
    }

    return filtered
  }

  /**
   * Filter sessions based on export options
   */
  private filterSessions(sessions: Session[], options: ExportOptions): Session[] {
    let filtered = [...sessions]

    // Filter by product
    if (options.product) {
      filtered = filtered.filter(s => s.productId === options.product)
    }

    return filtered
  }

  /**
   * Anonymize entries
   */
  private anonymizeEntries(entries: JournalEntry[]): JournalEntry[] {
    return entries.map(entry => ({
      ...entry,
      userId: 'anonymized',
      content: entry.content.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]'),
    }))
  }

  /**
   * Anonymize sessions
   */
  private anonymizeSessions(sessions: Session[]): Session[] {
    return sessions.map(session => ({
      ...session,
      userId: 'anonymized',
    }))
  }

  /**
   * Generate filename for export
   */
  private generateFilename(format: ExportFormat, scope: ExportScope): string {
    const date = new Date().toISOString().split('T')[0]
    const time = new Date().toTimeString().slice(0, 5).replace(':', '-')
    const ext = this.getFileExtension(format)
    return `personallog-${this.productId}-${scope}-${date}-${time}.${ext}`
  }

  /**
   * Get MIME type for format
   */
  private getMimeType(format: ExportFormat): string {
    const types: Record<ExportFormat, string> = {
      json: 'application/json',
      markdown: 'text/markdown',
      csv: 'text/csv',
      pdf: 'application/pdf',
      html: 'text/html',
      yaml: 'text/yaml',
    }
    return types[format]
  }

  /**
   * Get file extension for format
   */
  private getFileExtension(format: ExportFormat): string {
    const exts: Record<ExportFormat, string> = {
      json: 'json',
      markdown: 'md',
      csv: 'csv',
      pdf: 'pdf',
      html: 'html',
      yaml: 'yaml',
    }
    return exts[format]
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create an export system for the specified product
 */
export function createExportSystem(
  productId: ProductContext,
  config?: Partial<ExportSystemConfig>
): ExportSystem {
  return new ExportSystem(productId, config)
}

/**
 * Create a specific converter
 */
export function createConverter(format: ExportFormat): ExportConverter {
  switch (format) {
    case 'json':
      return new JSONConverter()
    case 'markdown':
      return new MarkdownConverter()
    case 'csv':
      return new CSVConverter()
    case 'html':
      return new HTMLConverter()
    case 'yaml':
      return new YAMLConverter()
    case 'pdf':
      return new PDFConverter()
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}
