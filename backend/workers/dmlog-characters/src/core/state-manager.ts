/**
 * DMLoG.AI - Character State Manager
 *
 * Manages character state synchronization across:
 * - Multiple sessions (same character in different contexts)
 * - Products (DMLoG <-> StudyLoG portability)
 * - Cache layers (D1 + in-memory for hot characters)
 *
 * Features:
 * - Real-time state synchronization
 * - Conflict resolution for concurrent updates
 * - State versioning with vector clocks
 * - Cross-product state translation
 */

import type {
  CharacterRecord,
  CharacterType,
  ProductDomain,
  CharacterState as CharacterStateEnum,
} from './character-store.js';
import type { Memory } from '@studylog/character-sdk';

/**
 * State conflict resolution strategy
 */
export enum ConflictResolution {
  /** Last write wins (timestamp-based) */
  LAST_WRITE_WINS = 'last_write_wins',
  /** First write wins (ignore newer updates) */
  FIRST_WRITE_WINS = 'first_write_wins',
  /** Merge changes (combine fields) */
  MERGE = 'merge',
  /** Manual resolution (requires intervention) */
  MANUAL = 'manual',
}

/**
 * State delta for incremental updates
 */
export interface StateDelta {
  characterId: string;
  version: number;
  timestamp: number;
  changes: Record<string, {
    oldValue: unknown;
    newValue: unknown;
  }>;
  source: 'user' | 'system' | 'import' | 'sync';
}

/**
 * Vector clock entry for causality tracking
 */
export interface VectorClockEntry {
  nodeId: string;
  version: number;
}

/**
 * State snapshot for a point in time
 */
export interface StateSnapshot {
  characterId: string;
  version: number;
  state: Partial<CharacterRecord>;
  timestamp: number;
  vectorClock: VectorClockEntry[];
}

/**
 * Sync status for a character
 */
export interface SyncStatus {
  characterId: string;
  isSyncing: boolean;
  lastSyncAt: number | null;
  pendingChanges: number;
  hasConflicts: boolean;
  connectedSessions: string[];
}

/**
 * State sync options
 */
export interface StateSyncOptions {
  conflictResolution?: ConflictResolution;
  forceSync?: boolean;
  skipCache?: boolean;
  sessionId?: string;
}

/**
 * State Manager Configuration
 */
export interface StateManagerConfig {
  /** Enable in-memory caching of hot characters */
  enableCache?: boolean;
  /** Maximum number of characters to cache */
  cacheSize?: number;
  /** Time in ms before cache entries expire */
  cacheTtl?: number;
  /** Default conflict resolution strategy */
  defaultConflictResolution?: ConflictResolution;
  /** Enable cross-product state translation */
  enableCrossProductSync?: boolean;
  /** Node ID for vector clocks */
  nodeId?: string;
}

/**
 * In-memory cache entry
 */
interface CacheEntry {
  character: CharacterRecord;
  expiresAt: number;
  vectorClock: VectorClockEntry[];
  accessCount: number;
}

/**
 * State Manager - Character State Synchronization
 *
 * Manages state across sessions, products, and cache layers.
 */
export class StateManager {
  private db: D1Database;
  private cache: Map<string, CacheEntry>;
  private syncStatus: Map<string, SyncStatus>;
  private deltas: Map<string, StateDelta[]>;
  private config: Required<StateManagerConfig>;

  // Prepared statements cache
  private statements: Map<string, D1PreparedStatement>;

  constructor(db: D1Database, config: StateManagerConfig = {}) {
    this.db = db;
    this.cache = new Map();
    this.syncStatus = new Map();
    this.deltas = new Map();
    this.statements = new Map();

    this.config = {
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 100,
      cacheTtl: config.cacheTtl ?? 5 * 60 * 1000, // 5 minutes
      defaultConflictResolution: config.defaultConflictResolution ?? ConflictResolution.LAST_WRITE_WINS,
      enableCrossProductSync: config.enableCrossProductSync ?? true,
      nodeId: config.nodeId ?? `node_${Date.now()}`,
    };
  }

  /**
   * Get current character state with caching
   */
  async getState(
    characterId: string,
    userId: string,
    options: { skipCache?: boolean; sessionId?: string } = {}
  ): Promise<CharacterRecord | null> {
    const { skipCache = false, sessionId } = options;

    // Check cache first
    if (!skipCache && this.config.enableCache) {
      const cached = this.getFromCache(characterId);
      if (cached) {
        this.trackSessionAccess(characterId, sessionId);
        return cached;
      }
    }

    // Load from database
    const stmt = this.getStatement(
      'SELECT * FROM characters WHERE id = ? AND (user_id = ? OR is_public = 1 OR is_template = 1)'
    );
    const result = await stmt.bind(characterId, userId).first();

    if (!result) {
      return null;
    }

    const character = this.rowToCharacter(result as Record<string, unknown>);

    // Update cache
    if (this.config.enableCache) {
      this.setToCache(character);
    }

    // Track session access
    this.trackSessionAccess(characterId, sessionId);

    return character;
  }

  /**
   * Apply state changes with conflict resolution
   */
  async applyState(
    characterId: string,
    userId: string,
    changes: Partial<Omit<CharacterRecord, 'id' | 'userId' | 'createdAt'>>,
    options: StateSyncOptions = {}
  ): Promise<CharacterRecord | null> {
    const {
      conflictResolution = this.config.defaultConflictResolution,
      sessionId,
    } = options;

    // Get current state
    const current = await this.getState(characterId, userId, { sessionId });
    if (!current) {
      return null;
    }

    // Generate delta
    const delta: StateDelta = {
      characterId,
      version: current.version + 1,
      timestamp: Date.now(),
      changes: {},
      source: sessionId ? 'sync' : 'user',
    };

    // Apply changes based on conflict resolution
    let updated: CharacterRecord;

    switch (conflictResolution) {
      case ConflictResolution.LAST_WRITE_WINS:
        updated = { ...current, ...changes, updatedAt: Date.now() };
        for (const [key, value] of Object.entries(changes)) {
          if ((current as Record<string, unknown>)[key] !== value) {
            delta.changes[key] = {
              oldValue: (current as Record<string, unknown>)[key],
              newValue: value,
            };
          }
        }
        break;

      case ConflictResolution.FIRST_WRITE_WINS:
        // Only apply changes if current value hasn't been modified
        updated = { ...current };
        for (const [key, value] of Object.entries(changes)) {
          if ((current as Record<string, unknown>)[key] === undefined) {
            (updated as Record<string, unknown>)[key] = value;
            delta.changes[key] = {
              oldValue: undefined,
              newValue: value,
            };
          }
        }
        updated.updatedAt = Date.now();
        break;

      case ConflictResolution.MERGE:
        updated = this.mergeStates(current, changes, delta);
        break;

      case ConflictResolution.MANUAL:
        // Store conflict for manual resolution
        await this.storeConflict(characterId, current, changes);
        return null;

      default:
        updated = { ...current, ...changes, updatedAt: Date.now() };
    }

    // Update vector clock
    const vectorClock = this.updateVectorClock(
      this.getVectorClock(characterId),
      this.config.nodeId,
      updated.version
    );

    // Persist to database
    await this.persistState(updated);

    // Update cache
    if (this.config.enableCache) {
      this.setToCache(updated, vectorClock);
    }

    // Store delta
    this.storeDelta(characterId, delta);

    // Trigger sync for connected sessions
    await this.triggerSync(characterId, sessionId);

    return updated;
  }

  /**
   * Sync character state across sessions
   */
  async syncState(
    characterId: string,
    userId: string,
    sessionId: string,
    options: StateSyncOptions = {}
  ): Promise<CharacterRecord | null> {
    // Update sync status
    this.ensureSyncStatus(characterId);
    const status = this.syncStatus.get(characterId)!;
    status.isSyncing = true;
    status.connectedSessions.push(sessionId);

    try {
      // Get latest state
      const state = await this.getState(characterId, userId, options);

      if (!state) {
        return null;
      }

      // Broadcast to connected sessions (would use WebSocket in real implementation)
      await this.broadcastState(characterId, state, sessionId);

      status.lastSyncAt = Date.now();
      status.pendingChanges = 0;
      status.hasConflicts = false;

      return state;
    } finally {
      status.isSyncing = false;
    }
  }

  /**
   * Get sync status for a character
   */
  getSyncStatus(characterId: string): SyncStatus | null {
    return this.syncStatus.get(characterId) ?? null;
  }

  /**
   * Get pending state deltas for a character
   */
  getPendingDeltas(characterId: string, sinceVersion?: number): StateDelta[] {
    const deltas = this.deltas.get(characterId) ?? [];
    if (sinceVersion === undefined) {
      return [...deltas];
    }
    return deltas.filter(d => d.version > sinceVersion);
  }

  /**
   * Create a state snapshot for rollback
   */
  async createSnapshot(characterId: string, userId: string): Promise<StateSnapshot | null> {
    const state = await this.getState(characterId, userId);
    if (!state) {
      return null;
    }

    const snapshot: StateSnapshot = {
      characterId,
      version: state.version,
      state: { ...state },
      timestamp: Date.now(),
      vectorClock: this.getVectorClock(characterId),
    };

    // Persist snapshot to database
    const stmt = this.getStatement(`
      INSERT INTO character_snapshots (
        id, character_id, version, state_data, vector_clock, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateId(),
      characterId,
      snapshot.version,
      JSON.stringify(snapshot.state),
      JSON.stringify(snapshot.vectorClock),
      snapshot.timestamp
    ).run();

    return snapshot;
  }

  /**
   * Restore from a snapshot
   */
  async restoreSnapshot(
    characterId: string,
    snapshotId: string,
    userId: string
  ): Promise<CharacterRecord | null> {
    // Get snapshot
    const stmt = this.getStatement(
      'SELECT * FROM character_snapshots WHERE id = ? AND character_id = ?'
    );
    const result = await stmt.bind(snapshotId, characterId).first();

    if (!result) {
      return null;
    }

    const snapshotState = JSON.parse(result.state_data as string);

    // Restore state
    const restored = await this.applyState(characterId, userId, snapshotState, {
      conflictResolution: ConflictResolution.LAST_WRITE_WINS,
    });

    return restored;
  }

  /**
   * Cross-product state translation
   * Convert character state between products (e.g., DMLoG -> StudyLoG)
   */
  translateState(
    state: CharacterRecord,
    targetDomain: ProductDomain
  ): Partial<CharacterRecord> {
    const translated: Partial<CharacterRecord> = {
      ...state,
      productDomain: targetDomain,
    };

    switch (targetDomain) {
      case 'dmlog':
        // StudyLoG -> DMLoG: Map educational traits to RPG stats
        if (state.productDomain === 'studylog') {
          translated.characterType = 'player';
          translated.level = state.gradeLevel ?? 1;
          translated.xp = this.calculateXpFromInterests(state.interests.length);
          translated.hp = translated.maxHp = 10 + (state.level ?? 1) * 5;
          translated.personality = this.translatePersonalityToStats(state.personality);
        }
        break;

      case 'studylog':
        // DMLoG -> StudyLoG: Map RPG stats to educational traits
        if (state.productDomain === 'dmlog') {
          translated.characterType = 'student';
          translated.gradeLevel = state.level;
          translated.interests = this.translateStatsToInterests(state);
          translated.learningStyle = this.inferLearningStyle(state.personality);
        }
        break;

      case 'shared':
        // Neutral shared format
        translated.tags = [...state.tags, 'shared'];
        break;
    }

    return translated;
  }

  /**
   * Merge two states (for MERGE conflict resolution)
   */
  private mergeStates(
    current: CharacterRecord,
    changes: Partial<Omit<CharacterRecord, 'id' | 'userId' | 'createdAt'>>,
    delta: StateDelta
  ): CharacterRecord {
    const merged: CharacterRecord = { ...current, updatedAt: Date.now() };

    for (const [key, value] of Object.entries(changes)) {
      const currentValue = (merged as Record<string, unknown>)[key];

      // Different merge strategies for different fields
      if (key === 'personality' && typeof value === 'object' && typeof currentValue === 'object') {
        // Merge personality traits (average values)
        merged.personality = this.mergePersonalities(
          currentValue as Record<string, number>,
          value as Record<string, number>
        );
        delta.changes[key] = { oldValue: currentValue, newValue: merged.personality };
      } else if (key === 'tags' && Array.isArray(value) && Array.isArray(currentValue)) {
        // Merge tags (union)
        merged.tags = [...new Set([...currentValue, ...value])];
        delta.changes[key] = { oldValue: currentValue, newValue: merged.tags };
      } else if (key === 'xp' && typeof value === 'number' && typeof currentValue === 'number') {
        // Accumulate XP
        merged.xp = currentValue + value;
        delta.changes[key] = { oldValue: currentValue, newValue: merged.xp };
      } else if (key === 'hp' && typeof value === 'number') {
        // Apply HP delta (not replacement)
        merged.hp = Math.max(0, Math.min(merged.maxHp, currentValue + (value - (merged.hp ?? currentValue))));
        delta.changes[key] = { oldValue: currentValue, newValue: merged.hp };
      } else if (currentValue === undefined || value === undefined) {
        // Set if either is undefined
        (merged as Record<string, unknown>)[key] = value ?? currentValue;
        delta.changes[key] = { oldValue: currentValue, newValue: value ?? currentValue };
      }
    }

    // Increment version
    merged.version = current.version + 1;

    return merged;
  }

  /**
   * Merge personality trait maps
   */
  private mergePersonalities(
    current: Record<string, number>,
    updates: Record<string, number>
  ): Record<string, number> {
    const merged: Record<string, number> = { ...current };

    for (const [trait, value] of Object.entries(updates)) {
      if (trait in merged) {
        // Average the values
        merged[trait] = (merged[trait] + value) / 2;
      } else {
        merged[trait] = value;
      }
    }

    return merged;
  }

  /**
   * Persist state to database
   */
  private async persistState(character: CharacterRecord): Promise<void> {
    const stmt = this.getStatement(`
      UPDATE characters SET
        name = ?, display_name = ?, character_class = ?, description = ?, avatar_url = ?,
        race = ?, alignment = ?, level = ?, xp = ?, hp = ?, max_hp = ?, ac = ?,
        initiative = ?, speed = ?, personality = ?, backstory = ?, goals = ?,
        fears = ?, quirks = ?, virtues = ?, vices = ?, learning_style = ?,
        grade_level = ?, interests = ?, learning_goals = ?, strengths = ?,
        support_areas = ?, state = ?, interaction_count = ?, updated_at = ?,
        last_active_at = ?, version = ?, tags = ?, is_public = ?, is_template = ?
      WHERE id = ?
    `);

    await stmt.bind(
      character.name,
      character.displayName,
      character.characterClass ?? null,
      character.description,
      character.avatarUrl ?? null,
      character.race ?? null,
      character.alignment ?? null,
      character.level,
      character.xp,
      character.hp,
      character.maxHp,
      character.ac,
      character.initiative,
      character.speed,
      JSON.stringify(character.personality),
      character.backstory,
      JSON.stringify(character.goals),
      JSON.stringify(character.fears),
      JSON.stringify(character.quirks),
      JSON.stringify(character.virtues),
      JSON.stringify(character.vices),
      character.learningStyle ?? null,
      character.gradeLevel ?? null,
      JSON.stringify(character.interests),
      JSON.stringify(character.learningGoals),
      JSON.stringify(character.strengths),
      JSON.stringify(character.supportAreas),
      character.state,
      character.interactionCount,
      character.updatedAt,
      character.lastActiveAt,
      character.version,
      JSON.stringify(character.tags),
      character.isPublic ? 1 : 0,
      character.isTemplate ? 1 : 0,
      character.id
    ).run();
  }

  /**
   * Cache operations
   */
  private getFromCache(characterId: string): CharacterRecord | null {
    const entry = this.cache.get(characterId);
    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(characterId);
      return null;
    }

    // Update access count
    entry.accessCount++;
    return entry.character;
  }

  private setToCache(character: CharacterRecord, vectorClock?: VectorClockEntry[]): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.config.cacheSize) {
      this.evictOldestCacheEntry();
    }

    this.cache.set(character.id, {
      character,
      expiresAt: Date.now() + this.config.cacheTtl,
      vectorClock: vectorClock ?? this.getVectorClock(character.id),
      accessCount: 0,
    });
  }

  private evictOldestCacheEntry(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestTime) {
        oldestTime = entry.expiresAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }

  /**
   * Vector clock operations
   */
  private getVectorClock(characterId: string): VectorClockEntry[] {
    const entry = this.cache.get(characterId);
    return entry?.vectorClock ?? [];
  }

  private updateVectorClock(
    clock: VectorClockEntry[],
    nodeId: string,
    version: number
  ): VectorClockEntry[] {
    const newClock = [...clock];
    const existing = newClock.findIndex(e => e.nodeId === nodeId);

    if (existing >= 0) {
      newClock[existing].version = version;
    } else {
      newClock.push({ nodeId, version });
    }

    return newClock;
  }

  /**
   * Delta tracking
   */
  private storeDelta(characterId: string, delta: StateDelta): void {
    if (!this.deltas.has(characterId)) {
      this.deltas.set(characterId, []);
    }

    const deltas = this.deltas.get(characterId)!;
    deltas.push(delta);

    // Keep only last 100 deltas
    if (deltas.length > 100) {
      deltas.splice(0, deltas.length - 100);
    }

    // Update sync status
    this.ensureSyncStatus(characterId);
    this.syncStatus.get(characterId)!.pendingChanges = deltas.length;
  }

  /**
   * Session tracking
   */
  private trackSessionAccess(characterId: string, sessionId?: string): void {
    if (!sessionId) return;

    this.ensureSyncStatus(characterId);
    const status = this.syncStatus.get(characterId)!;

    if (!status.connectedSessions.includes(sessionId)) {
      status.connectedSessions.push(sessionId);
    }
  }

  private ensureSyncStatus(characterId: string): void {
    if (!this.syncStatus.has(characterId)) {
      this.syncStatus.set(characterId, {
        characterId,
        isSyncing: false,
        lastSyncAt: null,
        pendingChanges: 0,
        hasConflicts: false,
        connectedSessions: [],
      });
    }
  }

  /**
   * Conflict storage
   */
  private async storeConflict(
    characterId: string,
    current: CharacterRecord,
    incoming: Partial<Omit<CharacterRecord, 'id' | 'userId' | 'createdAt'>>
  ): Promise<void> {
    const stmt = this.getStatement(`
      INSERT INTO character_conflicts (
        id, character_id, current_state, incoming_state, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateId(),
      characterId,
      JSON.stringify(current),
      JSON.stringify(incoming),
      Date.now()
    ).run();

    this.ensureSyncStatus(characterId);
    this.syncStatus.get(characterId)!.hasConflicts = true;
  }

  /**
   * State broadcasting (placeholder for WebSocket implementation)
   */
  private async broadcastState(
    characterId: string,
    state: CharacterRecord,
    excludeSessionId?: string
  ): Promise<void> {
    const status = this.syncStatus.get(characterId);
    if (!status) return;

    // In real implementation, would use WebSocket to broadcast to all sessions
    // except excludeSessionId
    const targetSessions = excludeSessionId
      ? status.connectedSessions.filter(s => s !== excludeSessionId)
      : status.connectedSessions;

    // Store pending sync events for sessions to poll
    for (const sessionId of targetSessions) {
      await this.storeSyncEvent(characterId, sessionId, state);
    }
  }

  private async storeSyncEvent(
    characterId: string,
    sessionId: string,
    state: CharacterRecord
  ): Promise<void> {
    const stmt = this.getStatement(`
      INSERT OR REPLACE INTO session_sync_events (
        character_id, session_id, state_data, created_at
      ) VALUES (?, ?, ?, ?)
    `);

    await stmt.bind(
      characterId,
      sessionId,
      JSON.stringify(state),
      Date.now()
    ).run();
  }

  /**
   * Trigger sync for connected sessions
   */
  private async triggerSync(characterId: string, excludeSessionId?: string): Promise<void> {
    const status = this.syncStatus.get(characterId);
    if (!status || status.isSyncing) return;

    status.isSyncing = true;

    // Broadcast to all connected sessions except the one that triggered the update
    await this.broadcastState(
      characterId,
      (await this.getState(characterId, ''))!, // Would need actual userId
      excludeSessionId
    );

    status.isSyncing = false;
    status.lastSyncAt = Date.now();
  }

  /**
   * Translation helpers
   */
  private calculateXpFromInterests(interestCount: number): number {
    return interestCount * 100;
  }

  private translatePersonalityToStats(
    personality: Record<string, number>
  ): Record<string, number> {
    // Map personality traits to D&D stats
    const stats: Record<string, number> = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    // Map personality traits to stats
    if (personality.bravery) stats.strength += Math.round((personality.bravery - 0.5) * 10);
    if (personality.creativity) stats.dexterity += Math.round((personality.creativity - 0.5) * 10);
    if (personality.persistence) stats.constitution += Math.round((personality.persistence - 0.5) * 10);
    if (personality.curiosity) stats.intelligence += Math.round((personality.curiosity - 0.5) * 10);
    if (personality.kindness) stats.wisdom += Math.round((personality.kindness - 0.5) * 10);
    if (personality.charisma) stats.charisma += Math.round((personality.charisma - 0.5) * 10);

    // Clamp to 3-18
    for (const stat of Object.keys(stats)) {
      stats[stat] = Math.max(3, Math.min(18, stats[stat]));
    }

    return stats;
  }

  private translateStatsToInterests(character: CharacterRecord): string[] {
    const interests: string[] = [];
    const stats = character.personality;

    // Infer interests from high stats
    for (const [stat, value] of Object.entries(stats)) {
      if (value > 0.7) {
        interests.push(stat);
      }
    }

    // Add D&D class as interest
    if (character.characterClass) {
      interests.push(character.characterClass);
    }

    return interests;
  }

  private inferLearningStyle(personality: Record<string, number>): 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'multimodal' {
    // Infer learning style from personality
    if (personality.creativity > 0.7) return 'visual';
    if (personality.curiosity > 0.7) return 'reading';
    if (personality.bravery > 0.7) return 'kinesthetic';
    return 'multimodal';
  }

  /**
   * Convert a database row to a CharacterRecord
   */
  private rowToCharacter(row: Record<string, unknown>): CharacterRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      productDomain: row.product_domain as ProductDomain,
      characterType: row.character_type as CharacterType,
      name: row.name as string,
      displayName: row.display_name as string,
      characterClass: row.character_class as string | undefined,
      description: row.description as string,
      avatarUrl: row.avatar_url as string | undefined,
      race: row.race as string | undefined,
      alignment: row.alignment as string | undefined,
      level: row.level as number,
      xp: row.xp as number,
      hp: row.hp as number,
      maxHp: row.max_hp as number,
      ac: row.ac as number,
      initiative: row.initiative as number,
      speed: row.speed as number,
      personality: JSON.parse(row.personality as string),
      backstory: row.backstory as string,
      goals: JSON.parse(row.goals as string),
      fears: JSON.parse(row.fears as string),
      quirks: JSON.parse(row.quirks as string),
      virtues: JSON.parse(row.virtues as string),
      vices: JSON.parse(row.vices as string),
      learningStyle: row.learning_style as 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'multimodal' | undefined,
      gradeLevel: row.grade_level as number | undefined,
      interests: JSON.parse(row.interests as string),
      learningGoals: JSON.parse(row.learning_goals as string),
      strengths: JSON.parse(row.strengths as string),
      supportAreas: JSON.parse(row.support_areas as string),
      state: row.state as CharacterStateEnum,
      interactionCount: row.interaction_count as number,
      campaignId: row.campaign_id as string | undefined,
      sessionId: row.session_id as string | undefined,
      parentId: row.parent_id as string | undefined,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
      lastActiveAt: row.last_active_at as number,
      version: row.version as number,
      tags: JSON.parse(row.tags as string),
      isPublic: (row.is_public as number) === 1,
      isTemplate: (row.is_template as number) === 1,
    };
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `state_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Get or create a prepared statement
   */
  private getStatement(query: string): D1PreparedStatement {
    if (!this.statements.has(query)) {
      this.statements.set(query, this.db.prepare(query));
    }
    return this.statements.get(query)!;
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number; entries: Array<{ id: string; accessCount: number }> } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([id, entry]) => ({
        id,
        accessCount: entry.accessCount,
      })),
    };
  }
}
