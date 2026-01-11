/**
 * PersonalLog Worker - Journal System
 *
 * Manages personal journal entries with support for different product contexts.
 * Provides CRUD operations, search, and filtering capabilities.
 *
 * @module personal-log/journal
 */

import {
  JournalEntry,
  JournalEntryType,
  MoodIndicator,
  ProductContext,
  StudyLogJournalContext,
  DMLogJournalContext,
  StorageConfig,
  DEFAULT_STORAGE_CONFIG,
} from './types'

// ============================================================================
// DATABASE CONSTANTS
// ============================================================================

const JOURNAL_DB_NAME = 'PersonalLogJournal'
const JOURNAL_DB_VERSION = 1
const JOURNAL_STORE = 'entries'
const JOURNAL_INDEX_TIMESTAMP = 'timestamp'
const JOURNAL_INDEX_PRODUCT = 'productId'
const JOURNAL_INDEX_TYPE = 'type'
const JOURNAL_INDEX_SESSION = 'sessionId'
const JOURNAL_INDEX_TAGS = 'tags'

// ============================================================================
// STORAGE LAYER
// ============================================================================

let journalDB: IDBDatabase | null = null

/**
 * Initialize the journal database
 */
async function initJournalDB(): Promise<IDBDatabase> {
  if (journalDB) return journalDB

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(JOURNAL_DB_NAME, JOURNAL_DB_VERSION)

    request.onerror = () => reject(new Error('Failed to open journal database'))
    request.onsuccess = () => {
      journalDB = request.result
      resolve(journalDB)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create entries store
      if (!database.objectStoreNames.contains(JOURNAL_STORE)) {
        const store = database.createObjectStore(JOURNAL_STORE, { keyPath: 'id' })
        store.createIndex(JOURNAL_INDEX_TIMESTAMP, 'timestamp', { unique: false })
        store.createIndex(JOURNAL_INDEX_PRODUCT, 'productId', { unique: false })
        store.createIndex(JOURNAL_INDEX_TYPE, 'type', { unique: false })
        store.createIndex(JOURNAL_INDEX_SESSION, 'sessionId', { unique: false })
        store.createIndex(JOURNAL_INDEX_TAGS, 'tags', { unique: false, multiEntry: true })
      }
    }
  })
}

/**
 * Journal storage interface
 */
export interface JournalStorage {
  addEntry(entry: JournalEntry): Promise<void>
  getEntry(id: string): Promise<JournalEntry | null>
  updateEntry(id: string, updates: Partial<JournalEntry>): Promise<void>
  deleteEntry(id: string): Promise<void>
  queryEntries(options: JournalQueryOptions): Promise<JournalEntry[]>
  countEntries(): Promise<number>
  clearEntries(): Promise<void>
}

/**
 * Query options for journal entries
 */
export interface JournalQueryOptions {
  /** Product filter */
  productId?: ProductContext

  /** Type filter */
  types?: JournalEntryType[]

  /** Session filter */
  sessionId?: string

  /** Tag filter */
  tags?: string[]

  /** Mood filter */
  moods?: MoodIndicator[]

  /** Start date (ISO 8601) */
  startDate?: string

  /** End date (ISO 8601) */
  endDate?: string

  /** Search query (searches title and content) */
  search?: string

  /** Include public entries only */
  publicOnly?: boolean

  /** Include player-visible entries only */
  playerVisibleOnly?: boolean

  /** Limit results */
  limit?: number

  /** Offset for pagination */
  offset?: number

  /** Sort order */
  sortOrder?: 'asc' | 'desc'
}

/**
 * IndexedDB implementation of journal storage
 */
class IndexedDBJournalStorage implements JournalStorage {
  private config: StorageConfig

  constructor(config: StorageConfig = DEFAULT_STORAGE_CONFIG) {
    this.config = config
  }

  async addEntry(entry: JournalEntry): Promise<void> {
    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readwrite')
      const store = transaction.objectStore(JOURNAL_STORE)
      const request = store.add(entry)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getEntry(id: string): Promise<JournalEntry | null> {
    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readonly')
      const store = transaction.objectStore(JOURNAL_STORE)
      const request = store.get(id)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async updateEntry(id: string, updates: Partial<JournalEntry>): Promise<void> {
    const existing = await this.getEntry(id)
    if (!existing) {
      throw new Error(`Entry not found: ${id}`)
    }

    const updated: JournalEntry = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    }

    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readwrite')
      const store = transaction.objectStore(JOURNAL_STORE)
      const request = store.put(updated)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deleteEntry(id: string): Promise<void> {
    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readwrite')
      const store = transaction.objectStore(JOURNAL_STORE)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async queryEntries(options: JournalQueryOptions = {}): Promise<JournalEntry[]> {
    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readonly')
      const store = transaction.objectStore(JOURNAL_STORE)
      const index = store.index(JOURNAL_INDEX_TIMESTAMP)

      // Build range
      let range: IDBKeyRange | null = null
      if (options.startDate && options.endDate) {
        range = IDBKeyRange.bound(options.startDate, options.endDate)
      } else if (options.startDate) {
        range = IDBKeyRange.lowerBound(options.startDate)
      } else if (options.endDate) {
        range = IDBKeyRange.upperBound(options.endDate)
      }

      const direction = options.sortOrder === 'asc' ? 'next' : 'prev'
      const request = range ? index.openCursor(range, direction) : index.openCursor(null, direction)

      const results: JournalEntry[] = []
      let skipped = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result

        if (cursor) {
          const entry = cursor.value as JournalEntry

          // Apply filters
          if (options.productId && entry.productId !== options.productId) {
            cursor.continue()
            return
          }

          if (options.types && !options.types.includes(entry.type)) {
            cursor.continue()
            return
          }

          if (options.sessionId && entry.sessionId !== options.sessionId) {
            cursor.continue()
            return
          }

          if (options.tags && options.tags.length > 0) {
            const hasTag = options.tags.some(tag => entry.tags.includes(tag))
            if (!hasTag) {
              cursor.continue()
              return
            }
          }

          if (options.moods && entry.mood && !options.moods.includes(entry.mood)) {
            cursor.continue()
            return
          }

          if (options.publicOnly && !entry.isPublic) {
            cursor.continue()
            return
          }

          if (options.playerVisibleOnly && !entry.isPlayerVisible) {
            cursor.continue()
            return
          }

          if (options.search) {
            const searchLower = options.search.toLowerCase()
            const titleMatch = entry.title.toLowerCase().includes(searchLower)
            const contentMatch = entry.content.toLowerCase().includes(searchLower)
            if (!titleMatch && !contentMatch) {
              cursor.continue()
              return
            }
          }

          // Handle offset
          if (options.offset && skipped < options.offset) {
            skipped++
            cursor.continue()
            return
          }

          // Handle limit
          if (options.limit && results.length >= options.limit) {
            resolve(results)
            return
          }

          results.push(entry)
          cursor.continue()
        } else {
          resolve(results)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async countEntries(): Promise<number> {
    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readonly')
      const store = transaction.objectStore(JOURNAL_STORE)
      const request = store.count()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async clearEntries(): Promise<void> {
    const database = await initJournalDB()

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([JOURNAL_STORE], 'readwrite')
      const store = transaction.objectStore(JOURNAL_STORE)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// ============================================================================
// JOURNAL MANAGER
// ============================================================================

/**
 * Journal manager for handling journal entries
 */
export class JournalManager {
  private storage: JournalStorage
  private productId: ProductContext

  constructor(productId: ProductContext, storage?: JournalStorage) {
    this.productId = productId
    this.storage = storage || new IndexedDBJournalStorage()
  }

  /**
   * Create a new journal entry
   */
  async createEntry(
    data: Omit<JournalEntry, 'id' | 'userId' | 'productId' | 'timestamp' | 'sessionId'>
  ): Promise<JournalEntry> {
    const entry: JournalEntry = {
      id: this.generateId(),
      userId: this.hashUserId(data.userId || 'anonymous'),
      productId: this.productId,
      timestamp: new Date().toISOString(),
      sessionId: data.sessionId || this.generateSessionId(),
      ...data,
    }

    await this.storage.addEntry(entry)
    return entry
  }

  /**
   * Get a journal entry by ID
   */
  async getEntry(id: string): Promise<JournalEntry | null> {
    return this.storage.getEntry(id)
  }

  /**
   * Update a journal entry
   */
  async updateEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry> {
    await this.storage.updateEntry(id, updates)
    return this.storage.getEntry(id) as Promise<JournalEntry>
  }

  /**
   * Delete a journal entry
   */
  async deleteEntry(id: string): Promise<void> {
    await this.storage.deleteEntry(id)
  }

  /**
   * List journal entries with filters
   */
  async listEntries(options?: JournalQueryOptions): Promise<JournalEntry[]> {
    return this.storage.queryEntries({
      ...options,
      productId: this.productId,
    })
  }

  /**
   * Search journal entries
   */
  async searchEntries(query: string, options?: Omit<JournalQueryOptions, 'search'>): Promise<JournalEntry[]> {
    return this.storage.queryEntries({
      ...options,
      productId: this.productId,
      search: query,
    })
  }

  /**
   * Get entries by date range
   */
  async getEntriesByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    return this.storage.queryEntries({
      productId: this.productId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      sortOrder: 'asc',
    })
  }

  /**
   * Get entries by session
   */
  async getEntriesBySession(sessionId: string): Promise<JournalEntry[]> {
    return this.storage.queryEntries({
      productId: this.productId,
      sessionId,
      sortOrder: 'asc',
    })
  }

  /**
   * Get entries by tags
   */
  async getEntriesByTags(tags: string[]): Promise<JournalEntry[]> {
    return this.storage.queryEntries({
      productId: this.productId,
      tags,
      sortOrder: 'desc',
    })
  }

  /**
   * Get recent entries
   */
  async getRecentEntries(limit: number = 10): Promise<JournalEntry[]> {
    return this.storage.queryEntries({
      productId: this.productId,
      limit,
      sortOrder: 'desc',
    })
  }

  /**
   * Get entry count
   */
  async countEntries(): Promise<number> {
    return this.storage.countEntries()
  }

  /**
   * Generate a unique entry ID
   */
  private generateId(): string {
    return `journal_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Generate a session ID if not provided
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    // Simple hash for demo - use proper hashing in production
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `user_${Math.abs(hash)}`
  }
}

// ============================================================================
// STUDYLOG.AI JOURNAL MANAGER
// ============================================================================

/**
 * StudyLoG.AI specific journal manager
 */
export class StudyLogJournalManager extends JournalManager {
  /**
   * Create a learning reflection entry
   */
  async createReflection(data: {
    userId: string
    sessionId: string
    title: string
    content: string
    concept?: string
    skill?: string
    mood?: MoodIndicator
    understanding?: number
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'reflection',
      title: data.title,
      content: data.content,
      mood: data.mood,
      tags: data.tags || [],
      isPublic: false,
      isPlayerVisible: false,
      context: {
        concept: data.concept,
        skill: data.skill,
        understandingLevel: data.understanding,
      } as StudyLogJournalContext,
    })
  }

  /**
   * Create a breakthrough entry
   */
  async createBreakthrough(data: {
    userId: string
    sessionId: string
    title: string
    content: string
    concept: string
    previousUnderstanding?: number
    newUnderstanding?: number
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'breakthrough',
      title: data.title,
      content: data.content,
      mood: 'excited',
      tags: ['breakthrough', data.concept, ...(data.tags || [])],
      isPublic: false,
      isPlayerVisible: false,
      context: {
        concept: data.concept,
        previousUnderstanding: data.previousUnderstanding,
        newUnderstanding: data.newUnderstanding,
      } as StudyLogJournalContext,
    })
  }

  /**
   * Create a question entry
   */
  async createQuestion(data: {
    userId: string
    sessionId: string
    title: string
    content: string
    concept?: string
    relatedConcepts?: string[]
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'question',
      title: data.title,
      content: data.content,
      mood: 'curious',
      tags: ['question', ...(data.tags || [])],
      isPublic: false,
      isPlayerVisible: false,
      context: {
        concept: data.concept,
        relatedConcepts: data.relatedConcepts || [],
      } as StudyLogJournalContext,
    })
  }
}

// ============================================================================
// DMLOG.AI JOURNAL MANAGER
// ============================================================================

/**
 * DMLoG.AI specific journal manager
 */
export class DMLogJournalManager extends JournalManager {
  /**
   * Create a session log entry
   */
  async createSessionLog(data: {
    userId: string
    sessionId: string
    campaignId: string
    campaignName: string
    sessionNumber: number
    content: string
    characters?: string[]
    storyBeats?: string[]
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'session_log',
      title: `Session ${data.sessionNumber}: ${data.campaignName}`,
      content: data.content,
      tags: ['session', data.campaignId, ...(data.tags || [])],
      isPublic: false,
      isPlayerVisible: true,
      context: {
        campaignId: data.campaignId,
        campaignName: data.campaignName,
        sessionNumber: data.sessionNumber,
        characters: data.characters || [],
        storyBeats: data.storyBeats || [],
      } as DMLogJournalContext,
    })
  }

  /**
   * Create a character note entry
   */
  async createCharacterNote(data: {
    userId: string
    sessionId: string
    characterId: string
    characterName: string
    content: string
    developmentType?: string
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'character_note',
      title: `Character: ${data.characterName}`,
      content: data.content,
      tags: ['character', data.characterId, ...(data.tags || [])],
      isPublic: false,
      isPlayerVisible: true,
      context: {
        characters: [data.characterId],
      } as DMLogJournalContext,
    })
  }

  /**
   * Create a world building entry
   */
  async createWorldBuilding(data: {
    userId: string
    sessionId: string
    content: string
    activity: 'location' | 'npc' | 'lore' | 'faction'
    elementsCreated?: number
    connectedToCampaign?: boolean
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'world_building',
      title: `World Building: ${data.activity}`,
      content: data.content,
      tags: ['world-building', data.activity, ...(data.tags || [])],
      isPublic: false,
      isPlayerVisible: false,
      context: {
        activity: data.activity,
        elementsCreated: data.elementsCreated,
        connectedToCampaign: data.connectedToCampaign,
      } as any,
    })
  }

  /**
   * Create a DM reflection entry
   */
  async createDMReflection(data: {
    userId: string
    sessionId: string
    content: string
    sessionNumber?: number
    whatWentWell?: string[]
    whatCouldImprove?: string[]
    tags?: string[]
  }): Promise<JournalEntry> {
    return this.createEntry({
      type: 'dm_reflection',
      title: `DM Reflection${data.sessionNumber ? ` - Session ${data.sessionNumber}` : ''}`,
      content: data.content,
      tags: ['dm-reflection', ...(data.tags || [])],
      isPublic: false,
      isPlayerVisible: false,
      context: {
        sessionNumber: data.sessionNumber,
        whatWentWell: data.whatWentWell,
        whatCouldImprove: data.whatCouldImprove,
      } as any,
    })
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a journal manager for the specified product
 */
export function createJournalManager(productId: ProductContext): JournalManager {
  switch (productId) {
    case 'studylog':
      return new StudyLogJournalManager(productId)
    case 'dmlog':
      return new DMLogJournalManager(productId)
    default:
      return new JournalManager(productId)
  }
}
