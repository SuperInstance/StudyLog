/**
 * DMLoG.AI - Character History Tracker
 *
 * Provides undo/redo functionality and change tracking for characters.
 * Integrates with the memory system for comprehensive state history.
 *
 * Features:
 * - Full undo/redo stack
 * - Branching history (fork at any point)
 * - Time travel (inspect state at any point)
 * - Diff generation between versions
 * - Selective undo (undo specific changes)
 */

import type {
  CharacterRecord,
  ProductDomain,
  CharacterType,
} from './character-store.js';
import type { Memory } from '@studylog/character-sdk';

/**
 * History entry types
 */
export enum HistoryEntryType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  MEMORY_ADD = 'memory_add',
  MEMORY_REMOVE = 'memory_remove',
  MEMORY_UPDATE = 'memory_update',
  STATE_CHANGE = 'state_change',
  LEVEL_UP = 'level_up',
  HP_CHANGE = 'hp_change',
  XP_GAIN = 'xp_gain',
  SESSION_JOIN = 'session_join',
  SESSION_LEAVE = 'session_leave',
}

/**
 * Change record for a single field
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  changeType: 'set' | 'add' | 'remove' | 'increment' | 'decrement';
}

/**
 * History entry
 */
export interface HistoryEntry {
  id: string;
  characterId: string;
  userId: string;
  entryType: HistoryEntryType;
  timestamp: number;
  version: number;
  previousVersion: number | null;
  changes: FieldChange[];
  snapshot: CharacterRecord | null;
  sessionId: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  reverted: boolean;
  revertedAt: number | null;
  revertedBy: string | null;
}

/**
 * Diff between two character states
 */
export interface CharacterDiff {
  versionFrom: number;
  versionTo: number;
  changes: FieldChange[];
  summary: string;
  significant: boolean;
}

/**
 * Undo/redo stack entry
 */
interface StackEntry {
  entryId: string;
  version: number;
  timestamp: number;
  description: string;
}

/**
 * History branch (for forking history)
 */
export interface HistoryBranch {
  id: string;
  name: string;
  characterId: string;
  branchPointVersion: number;
  createdAt: number;
  createdBy: string;
  currentVersion: number;
  parentId: string | null;
}

/**
 * Time travel snapshot
 */
export interface TimeTravelSnapshot {
  version: number;
  timestamp: number;
  state: CharacterRecord;
  memories: Memory[];
  description: string;
}

/**
 * History tracker options
 */
export interface HistoryTrackerOptions {
  /** Maximum history entries to keep */
  maxEntries?: number;
  /** Maximum undo stack depth */
  maxUndoDepth?: number;
  /** Enable branching */
  enableBranching?: boolean;
  /** Enable time travel queries */
  enableTimeTravel?: boolean;
  /** Auto-compact history */
  autoCompact?: boolean;
}

/**
 * Undo result
 */
export interface UndoResult {
  success: boolean;
  character?: CharacterRecord;
  undoneVersion?: number;
  error?: string;
}

/**
 * Redo result
 */
export interface RedoResult {
  success: boolean;
  character?: CharacterRecord;
  redoneVersion?: number;
  error?: string;
}

/**
 * History Tracker - Undo/Redo and Change History
 */
export class HistoryTracker {
  private db: D1Database;
  private config: Required<HistoryTrackerOptions>;
  private statements: Map<string, D1PreparedStatement>;
  private undoStacks: Map<string, StackEntry[]>;
  private redoStacks: Map<string, StackEntry[]>;
  private currentBranches: Map<string, string>;

  constructor(db: D1Database, options: HistoryTrackerOptions = {}) {
    this.db = db;
    this.statements = new Map();
    this.undoStacks = new Map();
    this.redoStacks = new Map();
    this.currentBranches = new Map();

    this.config = {
      maxEntries: options.maxEntries ?? 1000,
      maxUndoDepth: options.maxUndoDepth ?? 50,
      enableBranching: options.enableBranching ?? true,
      enableTimeTravel: options.enableTimeTravel ?? true,
      autoCompact: options.autoCompact ?? true,
    };
  }

  /**
   * Track a change and create a history entry
   */
  async trackChange(
    characterId: string,
    userId: string,
    entryType: HistoryEntryType,
    previousState: CharacterRecord | null,
    newState: CharacterRecord,
    options: {
      sessionId?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<HistoryEntry> {
    const entry: HistoryEntry = {
      id: this.generateId(),
      characterId,
      userId,
      entryType,
      timestamp: Date.now(),
      version: newState.version,
      previousVersion: previousState?.version ?? null,
      changes: this.computeChanges(previousState, newState),
      snapshot: this.config.autoCompact ? null : newState,
      sessionId: options.sessionId ?? null,
      description: options.description ?? this.generateDescription(entryType, newState),
      metadata: options.metadata ?? {},
      reverted: false,
      revertedAt: null,
      revertedBy: null,
    };

    // Store in database
    await this.storeEntry(entry);

    // Add to undo stack
    this.addToUndoStack(characterId, {
      entryId: entry.id,
      version: entry.version,
      timestamp: entry.timestamp,
      description: entry.description ?? '',
    });

    // Clear redo stack (new action invalidates redo)
    this.redoStacks.delete(characterId);

    // Prune if needed
    await this.pruneHistory(characterId);

    return entry;
  }

  /**
   * Undo the last change
   */
  async undo(
    characterId: string,
    userId: string,
    options: { specificVersion?: number; sessionId?: string } = {}
  ): Promise<UndoResult> {
    const stack = this.undoStacks.get(characterId);
    if (!stack || stack.length === 0) {
      return {
        success: false,
        error: 'Nothing to undo',
      };
    }

    let entryToUndo: StackEntry | undefined;

    if (options.specificVersion !== undefined) {
      // Find specific version
      entryToUndo = stack.find(e => e.version === options.specificVersion);
      if (!entryToUndo) {
        return {
          success: false,
          error: `Version ${options.specificVersion} not found in undo stack`,
        };
      }
    } else {
      // Undo most recent
      entryToUndo = stack.pop();
    }

    if (!entryToUndo) {
      return {
        success: false,
        error: 'No entry to undo',
      };
    }

    // Get history entry
    const entry = await this.getEntry(entryToUndo.entryId);
    if (!entry) {
      return {
        success: false,
        error: 'History entry not found',
      };
    }

    if (entry.reverted) {
      return {
        success: false,
        error: 'Entry already reverted',
      };
    }

    // Find previous state
    const previousState = await this.getStateAtVersion(
      characterId,
      entry.previousVersion ?? entry.version - 1
    );

    if (!previousState) {
      return {
        success: false,
        error: 'Previous state not found',
      };
    }

    // Apply previous state
    const restoredState = await this.restoreState(characterId, previousState, userId);

    if (!restoredState) {
      return {
        success: false,
        error: 'Failed to restore state',
      };
    }

    // Mark entry as reverted
    await this.markReverted(entry.id, userId);

    // Add to redo stack
    this.addToRedoStack(characterId, entryToUndo);

    return {
      success: true,
      character: restoredState,
      undoneVersion: entryToUndo.version,
    };
  }

  /**
   * Redo a previously undone change
   */
  async redo(
    characterId: string,
    userId: string,
    options: { sessionId?: string } = {}
  ): Promise<RedoResult> {
    const stack = this.redoStacks.get(characterId);
    if (!stack || stack.length === 0) {
      return {
        success: false,
        error: 'Nothing to redo',
      };
    }

    const entryToRedo = stack.pop();
    if (!entryToRedo) {
      return {
        success: false,
        error: 'No entry to redo',
      };
    }

    // Get history entry
    const entry = await this.getEntry(entryToRedo.entryId);
    if (!entry) {
      return {
        success: false,
        error: 'History entry not found',
      };
    }

    // Find the state after this change
    const nextState = await this.getStateAtVersion(characterId, entryToRedo.version);

    if (!nextState) {
      return {
        success: false,
        error: 'State to restore not found',
      };
    }

    // Apply the state
    const restoredState = await this.restoreState(characterId, nextState, userId);

    if (!restoredState) {
      return {
        success: false,
        error: 'Failed to restore state',
      };
    }

    // Unmark reverted
    await this.unmarkReverted(entry.id);

    // Add back to undo stack
    this.addToUndoStack(characterId, entryToRedo);

    return {
      success: true,
      character: restoredState,
      redoneVersion: entryToRedo.version,
    };
  }

  /**
   * Get history for a character
   */
  async getHistory(
    characterId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      entryType?: HistoryEntryType;
      includeReverted?: boolean;
    } = {}
  ): Promise<{ success: boolean; entries?: HistoryEntry[]; error?: string }> {
    try {
      const conditions: string[] = ['character_id = ?'];
      const params: unknown[] = [characterId];

      if (options.entryType) {
        conditions.push('entry_type = ?');
        params.push(options.entryType);
      }

      if (!options.includeReverted) {
        conditions.push('reverted = 0');
      }

      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const stmt = this.getStatement(`
        SELECT * FROM character_history
        WHERE ${conditions.join(' AND ')}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);

      const result = await stmt.bind(...params, limit, offset).all();

      const entries: HistoryEntry[] = result.results.map(row => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          characterId: r.character_id as string,
          userId: r.user_id as string,
          entryType: r.entry_type as HistoryEntryType,
          timestamp: r.timestamp as number,
          version: r.version as number,
          previousVersion: r.previous_version as number | null,
          changes: r.changes ? JSON.parse(r.changes as string) : [],
          snapshot: r.snapshot ? JSON.parse(r.snapshot as string) : null,
          sessionId: r.session_id as string | null,
          description: r.description as string | null,
          metadata: r.metadata ? JSON.parse(r.metadata as string) : {},
          reverted: (r.reverted as number) === 1,
          revertedAt: r.reverted_at as number | null,
          revertedBy: r.reverted_by as string | null,
        };
      });

      return {
        success: true,
        entries,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get a diff between two versions
   */
  async diff(
    characterId: string,
    fromVersion: number,
    toVersion: number
  ): Promise<CharacterDiff | null> {
    const fromState = await this.getStateAtVersion(characterId, fromVersion);
    const toState = await this.getStateAtVersion(characterId, toVersion);

    if (!fromState || !toState) {
      return null;
    }

    const changes = this.computeChanges(fromState, toState);
    const significant = this.isSignificantChanges(changes);

    return {
      versionFrom: fromVersion,
      versionTo: toVersion,
      changes,
      summary: this.generateDiffSummary(changes, fromVersion, toVersion),
      significant,
    };
  }

  /**
   * Time travel - get state at a specific version
   */
  async getStateAtVersion(
    characterId: string,
    version: number
  ): Promise<CharacterRecord | null> {
    // First check for snapshot
    const snapshotStmt = this.getStatement(`
      SELECT state_data FROM character_snapshots
      WHERE character_id = ? AND version = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const snapshotResult = await snapshotStmt.bind(characterId, version).first();

    if (snapshotResult) {
      return JSON.parse(snapshotResult.state_data as string);
    }

    // If no snapshot, reconstruct from history
    // Start with current state
    const currentStmt = this.getStatement(
      'SELECT * FROM characters WHERE id = ?'
    );
    const currentResult = await currentStmt.bind(characterId).first();

    if (!currentResult) {
      return null;
    }

    // Get all history entries up to the target version
    const historyStmt = this.getStatement(`
      SELECT * FROM character_history
      WHERE character_id = ? AND version <= ?
      ORDER BY version DESC
    `);

    const historyResult = await historyStmt.bind(characterId, version).all();

    // Apply changes backward
    let state = this.rowToCharacter(currentResult as Record<string, unknown>);

    for (const row of historyResult.results) {
      const entry = row as Record<string, unknown>;
      if (entry.version === version) {
        // Found the target
        return entry.snapshot
          ? JSON.parse(entry.snapshot as string)
          : state;
      }

      // Apply reverse changes
      const changes = entry.changes ? JSON.parse(entry.changes as string) : FieldChange[];
      state = this.applyChangesReverse(state, changes);
    }

    return state;
  }

  /**
   * Create a history branch
   */
  async createBranch(
    characterId: string,
    userId: string,
    branchName: string,
    branchPointVersion: number
  ): Promise<HistoryBranch | null> {
    if (!this.config.enableBranching) {
      return null;
    }

    const branch: HistoryBranch = {
      id: this.generateId(),
      name: branchName,
      characterId,
      branchPointVersion,
      createdAt: Date.now(),
      createdBy: userId,
      currentVersion: branchPointVersion,
      parentId: this.currentBranches.get(characterId) ?? null,
    };

    const stmt = this.getStatement(`
      INSERT INTO character_history_branches (
        id, name, character_id, branch_point_version,
        created_at, created_by, current_version, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      branch.id,
      branch.name,
      branch.characterId,
      branch.branchPointVersion,
      branch.createdAt,
      branch.createdBy,
      branch.currentVersion,
      branch.parentId
    ).run();

    return branch;
  }

  /**
   * Get history branches for a character
   */
  async getBranches(characterId: string): Promise<HistoryBranch[]> {
    const stmt = this.getStatement(`
      SELECT * FROM character_history_branches
      WHERE character_id = ?
      ORDER BY created_at ASC
    `);

    const result = await stmt.bind(characterId).all();

    return result.results.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        name: r.name as string,
        characterId: r.character_id as string,
        branchPointVersion: r.branch_point_version as number,
        createdAt: r.created_at as number,
        createdBy: r.created_by as string,
        currentVersion: r.current_version as number,
        parentId: r.parent_id as string | null,
      };
    });
  }

  /**
   * Get undo/redo stack status
   */
  getStackStatus(characterId: string): {
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
    nextUndo?: StackEntry;
    nextRedo?: StackEntry;
  } {
    const undoStack = this.undoStacks.get(characterId) ?? [];
    const redoStack = this.redoStacks.get(characterId) ?? [];

    return {
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      nextUndo: undoStack[undoStack.length - 1],
      nextRedo: redoStack[redoStack.length - 1],
    };
  }

  /**
   * Selective undo - undo specific changes while keeping others
   */
  async selectiveUndo(
    characterId: string,
    userId: string,
    fieldsToUndo: string[]
  ): Promise<UndoResult> {
    // Get current state
    const currentStmt = this.getStatement('SELECT * FROM characters WHERE id = ?');
    const currentResult = await currentStmt.bind(characterId).first();

    if (!currentResult) {
      return {
        success: false,
        error: 'Character not found',
      };
    }

    const currentState = this.rowToCharacter(currentResult as Record<string, unknown>);

    // Find the most recent change for each field
    const historyStmt = this.getStatement(`
      SELECT * FROM character_history
      WHERE character_id = ? AND reverted = 0
      ORDER BY version DESC
      LIMIT 100
    `);

    const historyResult = await historyStmt.bind(characterId).all();
    const entries = historyResult.results as Array<Record<string, unknown>>;

    const changesToApply: Record<string, { value: unknown; version: number }> = {};

    for (const entry of entries) {
      const changes = entry.changes ? JSON.parse(entry.changes as string) : FieldChange[];

      for (const change of changes) {
        if (fieldsToUndo.includes(change.field) && !(change.field in changesToApply)) {
          changesToApply[change.field] = {
            value: change.oldValue,
            version: entry.version as number,
          };
        }
      }
    }

    if (Object.keys(changesToApply).length === 0) {
      return {
        success: false,
        error: 'No changes found for specified fields',
      };
    }

    // Apply the changes
    const updatedState = { ...currentState };
    for (const [field, { value }] of Object.entries(changesToApply)) {
      (updatedState as Record<string, unknown>)[field] = value;
    }
    updatedState.version = currentState.version + 1;
    updatedState.updatedAt = Date.now();

    // Save updated state
    await this.restoreState(characterId, updatedState, userId);

    // Track this as an undo operation
    await this.trackChange(
      characterId,
      userId,
      HistoryEntryType.UPDATE,
      currentState,
      updatedState,
      {
        description: `Selective undo: ${fieldsToUndo.join(', ')}`,
        metadata: { selectiveUndo: true, fieldsUndone: fieldsToUndo },
      }
    );

    return {
      success: true,
      character: updatedState,
      undoneVersion: currentState.version,
    };
  }

  /**
   * Prune old history entries
   */
  private async pruneHistory(characterId: string): Promise<void> {
    const countStmt = this.getStatement(
      'SELECT COUNT(*) as count FROM character_history WHERE character_id = ?'
    );
    const countResult = await countStmt.bind(characterId).first() as { count: number };

    if (countResult.count > this.config.maxEntries) {
      const deleteStmt = this.getStatement(`
        DELETE FROM character_history
        WHERE id IN (
          SELECT id FROM character_history
          WHERE character_id = ?
          ORDER BY timestamp ASC
          LIMIT ?
        )
      `);

      await deleteStmt.bind(characterId, countResult.count - this.config.maxEntries).run();
    }
  }

  /**
   * Store a history entry in the database
   */
  private async storeEntry(entry: HistoryEntry): Promise<void> {
    const stmt = this.getStatement(`
      INSERT INTO character_history (
        id, character_id, user_id, entry_type, timestamp, version,
        previous_version, changes, snapshot, session_id, description,
        metadata, reverted, reverted_at, reverted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      entry.id,
      entry.characterId,
      entry.userId,
      entry.entryType,
      entry.timestamp,
      entry.version,
      entry.previousVersion,
      JSON.stringify(entry.changes),
      entry.snapshot ? JSON.stringify(entry.snapshot) : null,
      entry.sessionId,
      entry.description,
      JSON.stringify(entry.metadata),
      entry.reverted ? 1 : 0,
      entry.revertedAt,
      entry.revertedBy
    ).run();
  }

  /**
   * Get a history entry by ID
   */
  private async getEntry(entryId: string): Promise<HistoryEntry | null> {
    const stmt = this.getStatement('SELECT * FROM character_history WHERE id = ?');
    const result = await stmt.bind(entryId).first();

    if (!result) {
      return null;
    }

    const r = result as Record<string, unknown>;
    return {
      id: r.id as string,
      characterId: r.character_id as string,
      userId: r.user_id as string,
      entryType: r.entry_type as HistoryEntryType,
      timestamp: r.timestamp as number,
      version: r.version as number,
      previousVersion: r.previous_version as number | null,
      changes: r.changes ? JSON.parse(r.changes as string) : [],
      snapshot: r.snapshot ? JSON.parse(r.snapshot as string) : null,
      sessionId: r.session_id as string | null,
      description: r.description as string | null,
      metadata: r.metadata ? JSON.parse(r.metadata as string) : {},
      reverted: (r.reverted as number) === 1,
      revertedAt: r.reverted_at as number | null,
      revertedBy: r.reverted_by as string | null,
    };
  }

  /**
   * Restore a character state
   */
  private async restoreState(
    characterId: string,
    state: CharacterRecord,
    userId: string
  ): Promise<CharacterRecord | null> {
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
      state.name,
      state.displayName,
      state.characterClass ?? null,
      state.description,
      state.avatarUrl ?? null,
      state.race ?? null,
      state.alignment ?? null,
      state.level,
      state.xp,
      state.hp,
      state.maxHp,
      state.ac,
      state.initiative,
      state.speed,
      JSON.stringify(state.personality),
      state.backstory,
      JSON.stringify(state.goals),
      JSON.stringify(state.fears),
      JSON.stringify(state.quirks),
      JSON.stringify(state.virtues),
      JSON.stringify(state.vices),
      state.learningStyle ?? null,
      state.gradeLevel ?? null,
      JSON.stringify(state.interests),
      JSON.stringify(state.learningGoals),
      JSON.stringify(state.strengths),
      JSON.stringify(state.supportAreas),
      state.state,
      state.interactionCount,
      state.updatedAt,
      state.lastActiveAt,
      state.version,
      JSON.stringify(state.tags),
      state.isPublic ? 1 : 0,
      state.isTemplate ? 1 : 0,
      characterId
    ).run();

    return state;
  }

  /**
   * Mark an entry as reverted
   */
  private async markReverted(entryId: string, userId: string): Promise<void> {
    const stmt = this.getStatement(`
      UPDATE character_history
      SET reverted = 1, reverted_at = ?, reverted_by = ?
      WHERE id = ?
    `);

    await stmt.bind(Date.now(), userId, entryId).run();
  }

  /**
   * Unmark an entry as reverted
   */
  private async unmarkReverted(entryId: string): Promise<void> {
    const stmt = this.getStatement(`
      UPDATE character_history
      SET reverted = 0, reverted_at = NULL, reverted_by = NULL
      WHERE id = ?
    `);

    await stmt.bind(entryId).run();
  }

  /**
   * Stack management
   */
  private addToUndoStack(characterId: string, entry: StackEntry): void {
    if (!this.undoStacks.has(characterId)) {
      this.undoStacks.set(characterId, []);
    }

    const stack = this.undoStacks.get(characterId)!;
    stack.push(entry);

    // Prune if too deep
    if (stack.length > this.config.maxUndoDepth) {
      stack.shift();
    }
  }

  private addToRedoStack(characterId: string, entry: StackEntry): void {
    if (!this.redoStacks.has(characterId)) {
      this.redoStacks.set(characterId, []);
    }

    this.redoStacks.get(characterId)!.push(entry);
  }

  /**
   * Compute changes between two states
   */
  private computeChanges(
    previous: CharacterRecord | null,
    current: CharacterRecord
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    if (!previous) {
      // All fields are new
      return [
        { field: '*', oldValue: null, newValue: current, changeType: 'set' },
      ];
    }

    // Compare all fields
    const fields: (keyof CharacterRecord)[] = [
      'name', 'displayName', 'characterClass', 'description', 'avatarUrl',
      'race', 'alignment', 'level', 'xp', 'hp', 'maxHp', 'ac',
      'initiative', 'speed', 'backstory', 'state',
      'learningStyle', 'gradeLevel', 'campaignId', 'sessionId', 'parentId',
    ];

    for (const field of fields) {
      const prev = previous[field];
      const curr = current[field];

      if (prev !== curr) {
        changes.push({
          field,
          oldValue: prev,
          newValue: curr,
          changeType: 'set',
        });
      }
    }

    // Compare arrays
    const arrayFields: Array<keyof CharacterRecord> = [
      'goals', 'fears', 'quirks', 'virtues', 'vices',
      'interests', 'learningGoals', 'strengths', 'supportAreas', 'tags',
    ];

    for (const field of arrayFields) {
      const prev = previous[field] as unknown[];
      const curr = current[field] as unknown[];

      if (JSON.stringify(prev) !== JSON.stringify(curr)) {
        changes.push({
          field,
          oldValue: prev,
          newValue: curr,
          changeType: 'set',
        });
      }
    }

    // Compare personality object
    if (JSON.stringify(previous.personality) !== JSON.stringify(current.personality)) {
      changes.push({
        field: 'personality',
        oldValue: previous.personality,
        newValue: current.personality,
        changeType: 'set',
      });
    }

    return changes;
  }

  /**
   * Apply changes in reverse
   */
  private applyChangesReverse(
    state: CharacterRecord,
    changes: FieldChange[]
  ): CharacterRecord {
    const reversed = { ...state };

    for (const change of changes) {
      (reversed as Record<string, unknown>)[change.field] = change.oldValue;
    }

    return reversed;
  }

  /**
   * Generate description for a history entry
   */
  private generateDescription(entryType: HistoryEntryType, state: CharacterRecord): string {
    switch (entryType) {
      case HistoryEntryType.CREATE:
        return `Created character: ${state.name}`;
      case HistoryEntryType.DELETE:
        return `Deleted character: ${state.name}`;
      case HistoryEntryType.UPDATE:
        return `Updated ${state.name}`;
      case HistoryEntryType.LEVEL_UP:
        return `Leveled up to ${state.level}`;
      case HistoryEntryType.HP_CHANGE:
        return `HP changed to ${state.hp}/${state.maxHp}`;
      case HistoryEntryType.XP_GAIN:
        return `Gained XP (total: ${state.xp})`;
      case HistoryEntryType.SESSION_JOIN:
        return `Joined session: ${state.sessionId}`;
      case HistoryEntryType.SESSION_LEAVE:
        return `Left session`;
      default:
        return `${entryType}: ${state.name}`;
    }
  }

  /**
   * Generate diff summary
   */
  private generateDiffSummary(
    changes: FieldChange[],
    fromVersion: number,
    toVersion: number
  ): string {
    if (changes.length === 0) {
      return `No changes from v${fromVersion} to v${toVersion}`;
    }

    const significant = changes.filter(c => c.field !== 'updatedAt' && c.field !== 'lastActiveAt');

    if (significant.length === 0) {
      return `Timestamp update from v${fromVersion} to v${toVersion}`;
    }

    const fields = significant.map(c => c.field).slice(0, 5).join(', ');
    const more = significant.length > 5 ? ` and ${significant.length - 5} more` : '';

    return `${significant.length} change${significant.length > 1 ? 's' : ''}: ${fields}${more}`;
  }

  /**
   * Check if changes are significant
   */
  private isSignificantChanges(changes: FieldChange[]): boolean {
    return changes.some(c =>
      c.field !== 'updatedAt' &&
      c.field !== 'lastActiveAt' &&
      c.field !== 'interactionCount'
    );
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
      state: row.state as 'idle' | 'thinking' | 'acting' | 'resting' | 'incapacitated' | 'learning' | 'teaching',
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
}
