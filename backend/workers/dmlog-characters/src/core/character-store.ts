/**
 * DMLoG.AI - Character Store
 *
 * D1 database operations for character persistence with cross-product compatibility.
 * Supports both DMLoG.AI (TTRPG) and StudyLoG.AI (education) character types.
 *
 * Features:
 * - Full CRUD operations for characters
 * - Memory integration via foreign key relationships
 * - Cross-product character support (DMLoG, StudyLoG)
 * - Campaign/session linking
 * - Version tracking for history/undo
 */

import type {
  Memory,
  MemoryTier,
  PersonalityProfile,
  CharacterState,
  MasteryLevel,
  LearningStyle,
} from '@studylog/character-sdk';

/**
 * Character types across products
 */
export enum CharacterType {
  /** DMLoG.AI: Player character */
  PLAYER = 'player',
  /** DMLoG.AI: Non-player character */
  NPC = 'npc',
  /** DMLoG.AI: Dungeon Master agent */
  DM_AGENT = 'dm_agent',
  /** StudyLoG.AI: AI Tutor */
  TUTOR = 'tutor',
  /** StudyLoG.AI: Student avatar */
  STUDENT = 'student',
  /** Generic: Shared across products */
  GENERIC = 'generic',
}

/**
 * Product domains
 */
export enum ProductDomain {
  DMLOG = 'dmlog',
  STUDYLOG = 'studylog',
  MAKERLOG = 'makerlog',
  SHARED = 'shared',
}

/**
 * Alignment options for DMLoG characters
 */
export enum Alignment {
  LAWFUL_GOOD = 'lawful_good',
  NEUTRAL_GOOD = 'neutral_good',
  CHAOTIC_GOOD = 'chaotic_good',
  LAWFUL_NEUTRAL = 'lawful_neutral',
  TRUE_NEUTRAL = 'true_neutral',
  CHAOTIC_NEUTRAL = 'chaotic_neutal',
  LAWFUL_EVIL = 'lawful_evil',
  NEUTRAL_EVIL = 'neutral_evil',
  CHAOTIC_EVIL = 'chaotic_evil',
}

/**
 * Character database record
 */
export interface CharacterRecord {
  id: string;
  userId: string;
  productDomain: ProductDomain;
  characterType: CharacterType;

  // Core identity
  name: string;
  displayName: string;
  characterClass?: string;
  description: string;
  avatarUrl?: string;

  // DMLoG-specific
  race?: string;
  alignment?: Alignment;
  level?: number;
  xp?: number;
  hp?: number;
  maxHp?: number;
  ac?: number;
  initiative?: number;
  speed?: number;

  // Personality
  personality: Record<string, number>;
  backstory: string;
  goals: string[];
  fears: string[];
  quirks: string[];
  virtues: string[];
  vices: string[];

  // StudyLoG-specific
  learningStyle?: LearningStyle;
  gradeLevel?: number;
  interests: string[];
  learningGoals: string[];
  strengths: string[];
  supportAreas: string[];

  // State tracking
  state: CharacterState;
  interactionCount: number;

  // Relationships
  campaignId?: string;
  sessionId?: string;
  parentId?: string; // For forked characters

  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number;
  version: number;

  // Metadata
  tags: string[];
  isPublic: boolean;
  isTemplate: boolean;
}

/**
 * Create/update character input
 */
export interface CharacterInput {
  userId: string;
  productDomain: ProductDomain;
  characterType: CharacterType;
  name: string;
  displayName?: string;
  characterClass?: string;
  description: string;
  avatarUrl?: string;
  race?: string;
  alignment?: Alignment;
  level?: number;
  xp?: number;
  hp?: number;
  maxHp?: number;
  ac?: number;
  initiative?: number;
  speed?: number;
  personality?: Record<string, number>;
  backstory?: string;
  goals?: string[];
  fears?: string[];
  quirks?: string[];
  virtues?: string[];
  vices?: string[];
  learningStyle?: LearningStyle;
  gradeLevel?: number;
  interests?: string[];
  learningGoals?: string[];
  strengths?: string[];
  supportAreas?: string[];
  campaignId?: string;
  sessionId?: string;
  parentId?: string;
  tags?: string[];
  isPublic?: boolean;
  isTemplate?: boolean;
}

/**
 * Query options for listing characters
 */
export interface CharacterQuery {
  userId?: string;
  productDomain?: ProductDomain;
  characterType?: CharacterType;
  campaignId?: string;
  sessionId?: string;
  parentId?: string;
  isPublic?: boolean;
  isTemplate?: boolean;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'name' | 'level' | 'xp';
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Character store result
 */
export interface CharacterStoreResult<T = CharacterRecord> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * List result with pagination
 */
export interface CharacterListResult {
  success: boolean;
  data?: CharacterRecord[];
  total?: number;
  error?: string;
}

/**
 * Character Store - D1 Database Operations
 *
 * Provides full CRUD with memory integration and cross-product support.
 */
export class CharacterStore {
  private db: D1Database;
  private preparedStatements: Map<string, D1PreparedStatement>;

  constructor(db: D1Database) {
    this.db = db;
    this.preparedStatements = new Map();
  }

  /**
   * CREATE - Insert a new character
   */
  async create(input: CharacterInput): Promise<CharacterStoreResult<CharacterRecord>> {
    try {
      const id = this.generateId();
      const now = Date.now();

      const character: CharacterRecord = {
        id,
        userId: input.userId,
        productDomain: input.productDomain,
        characterType: input.characterType,
        name: input.name,
        displayName: input.displayName ?? input.name,
        characterClass: input.characterClass,
        description: input.description,
        avatarUrl: input.avatarUrl,
        race: input.race,
        alignment: input.alignment,
        level: input.level ?? 1,
        xp: input.xp ?? 0,
        hp: input.hp ?? input.maxHp ?? 10,
        maxHp: input.maxHp ?? 10,
        ac: input.ac ?? 10,
        initiative: input.initiative ?? 0,
        speed: input.speed ?? 30,
        personality: input.personality ?? {},
        backstory: input.backstory ?? '',
        goals: input.goals ?? [],
        fears: input.fears ?? [],
        quirks: input.quirks ?? [],
        virtues: input.virtues ?? [],
        vices: input.vices ?? [],
        learningStyle: input.learningStyle,
        gradeLevel: input.gradeLevel,
        interests: input.interests ?? [],
        learningGoals: input.learningGoals ?? [],
        strengths: input.strengths ?? [],
        supportAreas: input.supportAreas ?? [],
        state: 'idle',
        interactionCount: 0,
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        parentId: input.parentId,
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now,
        version: 1,
        tags: input.tags ?? [],
        isPublic: input.isPublic ?? false,
        isTemplate: input.isTemplate ?? false,
      };

      const stmt = this.getStatement(`
        INSERT INTO characters (
          id, user_id, product_domain, character_type,
          name, display_name, character_class, description, avatar_url,
          race, alignment, level, xp, hp, max_hp, ac, initiative, speed,
          personality, backstory, goals, fears, quirks, virtues, vices,
          learning_style, grade_level, interests, learning_goals, strengths, support_areas,
          state, interaction_count, campaign_id, session_id, parent_id,
          created_at, updated_at, last_active_at, version,
          tags, is_public, is_template
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        character.id,
        character.userId,
        character.productDomain,
        character.characterType,
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
        character.campaignId ?? null,
        character.sessionId ?? null,
        character.parentId ?? null,
        character.createdAt,
        character.updatedAt,
        character.lastActiveAt,
        character.version,
        JSON.stringify(character.tags),
        character.isPublic ? 1 : 0,
        character.isTemplate ? 1 : 0
      ).run();

      // Store initial history entry
      await this.storeHistoryEntry(character.id, character.userId, 'create', null, character);

      return {
        success: true,
        data: character,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * READ - Get a character by ID
   */
  async get(id: string, userId?: string): Promise<CharacterStoreResult<CharacterRecord>> {
    try {
      let query = 'SELECT * FROM characters WHERE id = ?';
      const params: unknown[] = [id];

      if (userId) {
        query += ' AND (user_id = ? OR is_public = 1 OR is_template = 1)';
        params.push(userId);
      }

      const stmt = this.getStatement(query);
      const result = await stmt.bind(...params).first();

      if (!result) {
        return {
          success: false,
          error: `Character not found: ${id}`,
        };
      }

      return {
        success: true,
        data: this.rowToCharacter(result as Record<string, unknown>),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * READ - Get multiple characters by IDs
   */
  async getMany(ids: string[], userId?: string): Promise<CharacterListResult> {
    if (ids.length === 0) {
      return { success: true, data: [], total: 0 };
    }

    try {
      const placeholders = ids.map(() => '?').join(',');
      let query = `SELECT * FROM characters WHERE id IN (${placeholders})`;
      const params: unknown[] = [...ids];

      if (userId) {
        query += ' AND (user_id = ? OR is_public = 1 OR is_template = 1)';
        params.push(userId);
      }

      const stmt = this.getStatement(query);
      const result = await stmt.bind(...params).all();

      return {
        success: true,
        data: result.results.map(row => this.rowToCharacter(row as Record<string, unknown>)),
        total: result.results.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * LIST - Query characters with filters
   */
  async list(query: CharacterQuery = {}): Promise<CharacterListResult> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      // Build conditions
      if (query.userId) {
        conditions.push('user_id = ?');
        params.push(query.userId);
      }

      if (query.productDomain) {
        conditions.push('product_domain = ?');
        params.push(query.productDomain);
      }

      if (query.characterType) {
        conditions.push('character_type = ?');
        params.push(query.characterType);
      }

      if (query.campaignId) {
        conditions.push('campaign_id = ?');
        params.push(query.campaignId);
      }

      if (query.sessionId) {
        conditions.push('session_id = ?');
        params.push(query.sessionId);
      }

      if (query.parentId) {
        conditions.push('parent_id = ?');
        params.push(query.parentId);
      }

      if (query.isPublic !== undefined) {
        conditions.push('is_public = ?');
        params.push(query.isPublic ? 1 : 0);
      }

      if (query.isTemplate !== undefined) {
        conditions.push('is_template = ?');
        params.push(query.isTemplate ? 1 : 0);
      }

      if (query.search) {
        conditions.push('(name LIKE ? OR description LIKE ?)');
        const searchTerm = `%${query.search}%`;
        params.push(searchTerm, searchTerm);
      }

      // Tag filtering requires JSON extraction
      if (query.tags && query.tags.length > 0) {
        const tagConditions = query.tags.map(() => "json_extract(tags, '$') LIKE ?");
        conditions.push(`(${tagConditions.join(' OR ')})`);
        query.tags.forEach(tag => params.push(`%"${tag}"%`));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countStmt = this.getStatement(`SELECT COUNT(*) as count FROM characters ${whereClause}`);
      const countResult = await countStmt.bind(...params).first() as { count: number };
      const total = countResult.count;

      // Ordering
      const orderBy = query.orderBy ?? 'updatedAt';
      const orderDirection = query.orderDirection ?? 'DESC';
      const orderClause = `ORDER BY ${orderBy} ${orderDirection}`;

      // Pagination
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;

      const selectStmt = this.getStatement(
        `SELECT * FROM characters ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
      );
      const result = await selectStmt.bind(...params, limit, offset).all();

      return {
        success: true,
        data: result.results.map(row => this.rowToCharacter(row as Record<string, unknown>)),
        total,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * UPDATE - Modify an existing character
   */
  async update(
    id: string,
    userId: string,
    updates: Partial<Omit<CharacterInput, 'userId' | 'id'>> & {
      hp?: number;
      state?: CharacterState;
      interactionCount?: number;
      version?: number;
    }
  ): Promise<CharacterStoreResult<CharacterRecord>> {
    try {
      // Get current character
      const currentResult = await this.get(id, userId);
      if (!currentResult.success || !currentResult.data) {
        return currentResult;
      }

      const current = currentResult.data;

      // Check version for optimistic locking
      if (updates.version !== undefined && updates.version !== current.version) {
        return {
          success: false,
          error: `Version mismatch: expected ${current.version}, got ${updates.version}`,
        };
      }

      const now = Date.now();

      // Build update fields
      const fields: string[] = [];
      const params: unknown[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        params.push(updates.name);
      }
      if (updates.displayName !== undefined) {
        fields.push('display_name = ?');
        params.push(updates.displayName);
      }
      if (updates.characterClass !== undefined) {
        fields.push('character_class = ?');
        params.push(updates.characterClass);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        params.push(updates.description);
      }
      if (updates.avatarUrl !== undefined) {
        fields.push('avatar_url = ?');
        params.push(updates.avatarUrl);
      }
      if (updates.race !== undefined) {
        fields.push('race = ?');
        params.push(updates.race);
      }
      if (updates.alignment !== undefined) {
        fields.push('alignment = ?');
        params.push(updates.alignment);
      }
      if (updates.level !== undefined) {
        fields.push('level = ?');
        params.push(updates.level);
      }
      if (updates.xp !== undefined) {
        fields.push('xp = ?');
        params.push(updates.xp);
      }
      if (updates.hp !== undefined) {
        fields.push('hp = ?');
        params.push(updates.hp);
      }
      if (updates.maxHp !== undefined) {
        fields.push('max_hp = ?');
        params.push(updates.maxHp);
      }
      if (updates.ac !== undefined) {
        fields.push('ac = ?');
        params.push(updates.ac);
      }
      if (updates.initiative !== undefined) {
        fields.push('initiative = ?');
        params.push(updates.initiative);
      }
      if (updates.speed !== undefined) {
        fields.push('speed = ?');
        params.push(updates.speed);
      }
      if (updates.personality !== undefined) {
        fields.push('personality = ?');
        params.push(JSON.stringify(updates.personality));
      }
      if (updates.backstory !== undefined) {
        fields.push('backstory = ?');
        params.push(updates.backstory);
      }
      if (updates.goals !== undefined) {
        fields.push('goals = ?');
        params.push(JSON.stringify(updates.goals));
      }
      if (updates.fears !== undefined) {
        fields.push('fears = ?');
        params.push(JSON.stringify(updates.fears));
      }
      if (updates.quirks !== undefined) {
        fields.push('quirks = ?');
        params.push(JSON.stringify(updates.quirks));
      }
      if (updates.virtues !== undefined) {
        fields.push('virtues = ?');
        params.push(JSON.stringify(updates.virtues));
      }
      if (updates.vices !== undefined) {
        fields.push('vices = ?');
        params.push(JSON.stringify(updates.vices));
      }
      if (updates.learningStyle !== undefined) {
        fields.push('learning_style = ?');
        params.push(updates.learningStyle);
      }
      if (updates.gradeLevel !== undefined) {
        fields.push('grade_level = ?');
        params.push(updates.gradeLevel);
      }
      if (updates.interests !== undefined) {
        fields.push('interests = ?');
        params.push(JSON.stringify(updates.interests));
      }
      if (updates.learningGoals !== undefined) {
        fields.push('learning_goals = ?');
        params.push(JSON.stringify(updates.learningGoals));
      }
      if (updates.strengths !== undefined) {
        fields.push('strengths = ?');
        params.push(JSON.stringify(updates.strengths));
      }
      if (updates.supportAreas !== undefined) {
        fields.push('support_areas = ?');
        params.push(JSON.stringify(updates.supportAreas));
      }
      if (updates.state !== undefined) {
        fields.push('state = ?');
        params.push(updates.state);
      }
      if (updates.interactionCount !== undefined) {
        fields.push('interaction_count = ?');
        params.push(updates.interactionCount);
      }
      if (updates.campaignId !== undefined) {
        fields.push('campaign_id = ?');
        params.push(updates.campaignId);
      }
      if (updates.sessionId !== undefined) {
        fields.push('session_id = ?');
        params.push(updates.sessionId);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        params.push(JSON.stringify(updates.tags));
      }
      if (updates.isPublic !== undefined) {
        fields.push('is_public = ?');
        params.push(updates.isPublic ? 1 : 0);
      }
      if (updates.isTemplate !== undefined) {
        fields.push('is_template = ?');
        params.push(updates.isTemplate ? 1 : 0);
      }

      // Always update these
      fields.push('updated_at = ?');
      params.push(now);
      fields.push('last_active_at = ?');
      params.push(now);
      fields.push('version = version + 1');

      params.push(id, userId);

      const updateStmt = this.getStatement(`
        UPDATE characters
        SET ${fields.join(', ')}
        WHERE id = ? AND user_id = ?
      `);

      await updateStmt.bind(...params).run();

      // Get updated character
      const updatedResult = await this.get(id, userId);

      // Store history entry
      if (updatedResult.success && updatedResult.data) {
        await this.storeHistoryEntry(id, userId, 'update', current, updatedResult.data);
      }

      return updatedResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * UPDATE - Increment character XP
   */
  async addXp(id: string, userId: string, amount: number): Promise<CharacterStoreResult<CharacterRecord>> {
    const currentResult = await this.get(id, userId);
    if (!currentResult.success || !currentResult.data) {
      return currentResult;
    }

    const current = currentResult.data;
    const newTotal = current.xp + amount;

    // Check for level up (assuming D&D 5e style: level * 1000 XP per level)
    let newLevel = current.level;
    let xpNeeded = newLevel * 1000;

    while (newTotal >= xpNeeded && newLevel < 20) {
      newLevel++;
      xpNeeded = newLevel * 1000;
    }

    return this.update(id, userId, {
      xp: newTotal,
      level: newLevel,
    });
  }

  /**
   * UPDATE - Set character HP
   */
  async setHp(id: string, userId: string, hp: number): Promise<CharacterStoreResult<CharacterRecord>> {
    return this.update(id, userId, { hp });
  }

  /**
   * UPDATE - Modify character HP by delta
   */
  async modifyHp(id: string, userId: string, delta: number): Promise<CharacterStoreResult<CharacterRecord>> {
    const currentResult = await this.get(id, userId);
    if (!currentResult.success || !currentResult.data) {
      return currentResult;
    }

    const current = currentResult.data;
    const newHp = Math.max(0, Math.min(current.maxHp, current.hp + delta));

    return this.update(id, userId, { hp: newHp });
  }

  /**
   * UPDATE - Set character state
   */
  async setState(id: string, userId: string, state: CharacterState): Promise<CharacterStoreResult<CharacterRecord>> {
    return this.update(id, userId, { state });
  }

  /**
   * UPDATE - Increment interaction count
   */
  async incrementInteraction(id: string, userId: string): Promise<CharacterStoreResult<CharacterRecord>> {
    const currentResult = await this.get(id, userId);
    if (!currentResult.success || !currentResult.data) {
      return currentResult;
    }

    return this.update(id, userId, {
      interactionCount: currentResult.data.interactionCount + 1,
    });
  }

  /**
   * DELETE - Remove a character
   */
  async delete(id: string, userId: string): Promise<CharacterStoreResult<{ deleted: boolean }>> {
    try {
      const currentResult = await this.get(id, userId);
      if (!currentResult.success || !currentResult.data) {
        return {
          success: false,
          error: `Character not found: ${id}`,
        };
      }

      // Store history entry before deletion
      await this.storeHistoryEntry(id, userId, 'delete', currentResult.data, null);

      const stmt = this.getStatement('DELETE FROM characters WHERE id = ? AND user_id = ?');
      await stmt.bind(id, userId).run();

      // Also delete associated memories
      const deleteMemoriesStmt = this.getStatement(
        'DELETE FROM character_memories WHERE character_id = ?'
      );
      await deleteMemoriesStmt.bind(id).run();

      return {
        success: true,
        data: { deleted: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * COPY - Fork a character (create a copy)
   */
  async fork(id: string, newUserId: string, newName?: string): Promise<CharacterStoreResult<CharacterRecord>> {
    const sourceResult = await this.get(id, newUserId);
    if (!sourceResult.success || !sourceResult.data) {
      return {
        success: false,
        error: `Source character not found: ${id}`,
      };
    }

    const source = sourceResult.data;

    const forkInput: CharacterInput = {
      userId: newUserId,
      productDomain: source.productDomain,
      characterType: source.characterType,
      name: newName ?? `${source.name} (Copy)`,
      displayName: newName ?? `${source.displayName} (Copy)`,
      characterClass: source.characterClass,
      description: source.description,
      avatarUrl: source.avatarUrl,
      race: source.race,
      alignment: source.alignment,
      level: source.level,
      xp: 0, // Reset XP for forked character
      hp: source.maxHp,
      maxHp: source.maxHp,
      ac: source.ac,
      initiative: source.initiative,
      speed: source.speed,
      personality: { ...source.personality },
      backstory: source.backstory,
      goals: [...source.goals],
      fears: [...source.fears],
      quirks: [...source.quirks],
      virtues: [...source.virtues],
      vices: [...source.vices],
      learningStyle: source.learningStyle,
      gradeLevel: source.gradeLevel,
      interests: [...source.interests],
      learningGoals: [...source.learningGoals],
      strengths: [...source.strengths],
      supportAreas: [...source.supportAreas],
      tags: [...source.tags],
      parentId: id, // Link to source
    };

    return this.create(forkInput);
  }

  /**
   * MEMORY - Store a memory for a character
   */
  async storeMemory(
    characterId: string,
    userId: string,
    content: string,
    options: {
      importance?: number;
      emotionalValence?: number;
      memoryType?: MemoryTier;
      topic?: string;
      location?: string;
      participants?: string[];
      tags?: string[];
    } = {}
  ): Promise<CharacterStoreResult<Memory>> {
    try {
      // Verify character exists and user has access
      const characterResult = await this.get(characterId, userId);
      if (!characterResult.success) {
        return {
          success: false,
          error: `Character not found: ${characterId}`,
        };
      }

      const memoryId = this.generateId();
      const now = Date.now();

      const memory: Memory = {
        id: memoryId,
        content,
        memoryType: options.memoryType ?? 'episodic',
        timestamp: new Date(now),
        importance: options.importance ?? 5.0,
        emotionalValence: options.emotionalValence ?? 0,
        participants: options.participants ?? [],
        location: options.location ?? '',
        accessCount: 0,
        lastAccessed: null,
        consolidated: false,
        relatedMemoryIds: [],
        tags: options.tags,
      };

      const stmt = this.getStatement(`
        INSERT INTO character_memories (
          id, character_id, content, memory_type,
          importance, emotional_valence, participants, location,
          access_count, last_accessed, consolidated, related_memory_ids,
          tags, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.bind(
        memoryId,
        characterId,
        content,
        memory.memoryType,
        memory.importance,
        memory.emotionalValence,
        JSON.stringify(memory.participants),
        memory.location,
        memory.accessCount,
        memory.lastAccessed?.toISOString() ?? null,
        memory.consolidated ? 1 : 0,
        JSON.stringify(memory.relatedMemoryIds),
        JSON.stringify(memory.tags ?? []),
        now
      ).run();

      return {
        success: true,
        data: memory,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * MEMORY - Retrieve memories for a character
   */
  async getMemories(
    characterId: string,
    userId: string,
    options: {
      limit?: number;
      memoryType?: MemoryTier;
      minImportance?: number;
      tags?: string[];
    } = {}
  ): Promise<CharacterStoreResult<Memory[]>> {
    try {
      // Verify access
      const characterResult = await this.get(characterId, userId);
      if (!characterResult.success) {
        return {
          success: false,
          error: `Character not found: ${characterId}`,
        };
      }

      const conditions: string[] = ['character_id = ?'];
      const params: unknown[] = [characterId];

      if (options.memoryType) {
        conditions.push('memory_type = ?');
        params.push(options.memoryType);
      }

      if (options.minImportance) {
        conditions.push('importance >= ?');
        params.push(options.minImportance);
      }

      if (options.tags && options.tags.length > 0) {
        const tagConditions = options.tags.map(() => "json_extract(tags, '$') LIKE ?");
        conditions.push(`(${tagConditions.join(' OR ')})`);
        options.tags.forEach(tag => params.push(`%"${tag}"%`));
      }

      const limit = options.limit ?? 50;

      const stmt = this.getStatement(`
        SELECT * FROM character_memories
        WHERE ${conditions.join(' AND ')}
        ORDER BY importance DESC, created_at DESC
        LIMIT ?
      `);

      const result = await stmt.bind(...params, limit).all();

      const memories: Memory[] = result.results.map(row => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          content: r.content as string,
          memoryType: r.memory_type as MemoryTier,
          timestamp: new Date(r.created_at as number),
          importance: r.importance as number,
          emotionalValence: r.emotional_valence as number,
          participants: JSON.parse(r.participants as string),
          location: r.location as string,
          accessCount: r.access_count as number,
          lastAccessed: r.last_accessed ? new Date(r.last_accessed as string) : null,
          consolidated: (r.consolidated as number) === 1,
          relatedMemoryIds: JSON.parse(r.related_memory_ids as string),
          tags: r.tags ? JSON.parse(r.tags as string) : undefined,
        };
      });

      return {
        success: true,
        data: memories,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * HISTORY - Get change history for a character
   */
  async getHistory(
    characterId: string,
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      actionType?: string;
    } = {}
  ): Promise<CharacterStoreResult<Array<Record<string, unknown>>>> {
    try {
      // Verify access
      const characterResult = await this.get(characterId, userId);
      if (!characterResult.success) {
        return {
          success: false,
          error: `Character not found: ${characterId}`,
        };
      }

      const conditions: string[] = ['character_id = ?'];
      const params: unknown[] = [characterId];

      if (options.actionType) {
        conditions.push('action_type = ?');
        params.push(options.actionType);
      }

      const limit = options.limit ?? 50;
      const offset = options.offset ?? 0;

      const stmt = this.getStatement(`
        SELECT * FROM character_history
        WHERE ${conditions.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);

      const result = await stmt.bind(...params, limit, offset).all();

      return {
        success: true,
        data: result.results.map(row => ({
          ...row,
          previous_state: row.previous_state ? JSON.parse(row.previous_state as string) : null,
          new_state: row.new_state ? JSON.parse(row.new_state as string) : null,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Store a history entry
   */
  private async storeHistoryEntry(
    characterId: string,
    userId: string,
    actionType: string,
    previousState: CharacterRecord | null,
    newState: CharacterRecord | null
  ): Promise<void> {
    const stmt = this.getStatement(`
      INSERT INTO character_history (
        id, character_id, user_id, action_type,
        previous_state, new_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateId(),
      characterId,
      userId,
      actionType,
      previousState ? JSON.stringify(previousState) : null,
      newState ? JSON.stringify(newState) : null,
      Date.now()
    ).run();
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
      alignment: row.alignment as Alignment | undefined,
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
      learningStyle: row.learning_style as LearningStyle | undefined,
      gradeLevel: row.grade_level as number | undefined,
      interests: JSON.parse(row.interests as string),
      learningGoals: JSON.parse(row.learning_goals as string),
      strengths: JSON.parse(row.strengths as string),
      supportAreas: JSON.parse(row.support_areas as string),
      state: row.state as CharacterState,
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
    return `char_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Get or create a prepared statement
   */
  private getStatement(query: string): D1PreparedStatement {
    if (!this.preparedStatements.has(query)) {
      this.preparedStatements.set(query, this.db.prepare(query));
    }
    return this.preparedStatements.get(query)!;
  }
}
