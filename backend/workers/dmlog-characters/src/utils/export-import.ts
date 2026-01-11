/**
 * DMLoG.AI - Character Export/Import
 *
 * Portable character format for cross-product compatibility.
 * Supports:
 * - JSON export/import for backup and sharing
 * - Cross-product character conversion (DMLoG <-> StudyLoG)
 * - Template-based character creation
 * - Partial export (config only, with/without memories)
 */

import type {
  CharacterRecord,
  CharacterType,
  ProductDomain,
  CharacterInput,
} from '../core/character-store.js';
import type { Memory } from '@studylog/character-sdk';

/**
 * Export format version
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

/**
 * Export options
 */
export interface ExportOptions {
  /** Include full memory history */
  includeMemories?: boolean;
  /** Include change history */
  includeHistory?: boolean;
  /** Minify JSON output */
  minify?: boolean;
  /** Encrypt exported data */
  encrypt?: boolean;
  /** Export for specific product (convert if needed) */
  targetProduct?: ProductDomain;
  /** Template mode (strip user-specific data) */
  asTemplate?: boolean;
  /** Template name */
  templateName?: string;
  /** Template description */
  templateDescription?: string;
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Character ID to import into (update existing) */
  targetCharacterId?: string;
  /** User ID for imported character */
  userId: string;
  /** Override product domain */
  productDomain?: ProductDomain;
  /** Generate new character ID */
  generateNewId?: boolean;
  /** Preserve original timestamps */
  preserveTimestamps?: boolean;
  /** Merge with existing character */
  merge?: boolean;
  /** Import memories */
  importMemories?: boolean;
  /** Import history */
  importHistory?: boolean;
}

/**
 * Export data structure
 */
export interface CharacterExport {
  format: string;
  version: string;
  exportedAt: number;
  exportedBy: string;
  isTemplate: boolean;
  templateInfo?: {
    name: string;
    description: string;
    author: string;
  };
  character: CharacterRecord;
  memories?: Memory[];
  history?: Array<Record<string, unknown>>;
  metadata: {
    exportId: string;
    checksum: string;
    originalProduct: ProductDomain;
    targetProduct?: ProductDomain;
  };
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  characterId?: string;
  character?: CharacterRecord;
  memoriesImported?: number;
  historyImported?: number;
  errors?: string[];
  warnings?: string[];
}

/**
 * Export/Import Manager
 */
export class CharacterExportImport {
  private db: D1Database;
  private statements: Map<string, D1PreparedStatement>;

  constructor(db: D1Database) {
    this.db = db;
    this.statements = new Map();
  }

  /**
   * Export a character to JSON
   */
  async export(
    characterId: string,
    userId: string,
    options: ExportOptions = {}
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      // Get character
      const character = await this.getCharacter(characterId, userId);
      if (!character) {
        return {
          success: false,
          error: `Character not found: ${characterId}`,
        };
      }

      // Apply product conversion if requested
      let exportCharacter = character;
      if (options.targetProduct && options.targetProduct !== character.productDomain) {
        exportCharacter = this.convertForProduct(character, options.targetProduct);
      }

      // Template mode: strip user-specific data
      if (options.asTemplate) {
        exportCharacter = this.templateFromCharacter(exportCharacter, options);
      }

      // Build export object
      const exportData: CharacterExport = {
        format: 'dmlog-character',
        version: EXPORT_FORMAT_VERSION,
        exportedAt: Date.now(),
        exportedBy: userId,
        isTemplate: options.asTemplate ?? false,
        templateInfo: options.asTemplate ? {
          name: options.templateName ?? `${exportCharacter.name} Template`,
          description: options.templateDescription ?? `A template based on ${exportCharacter.name}`,
          author: userId,
        } : undefined,
        character: exportCharacter,
        memories: options.includeMemories ? await this.getCharacterMemories(characterId) : undefined,
        history: options.includeHistory ? await this.getCharacterHistory(characterId) : undefined,
        metadata: {
          exportId: this.generateExportId(),
          checksum: '', // Will be calculated
          originalProduct: character.productDomain,
          targetProduct: options.targetProduct,
        },
      };

      // Calculate checksum
      exportData.metadata.checksum = this.calculateChecksum(exportData);

      // Convert to JSON
      const json = options.minify
        ? JSON.stringify(exportData)
        : JSON.stringify(exportData, null, 2);

      // Encrypt if requested
      if (options.encrypt) {
        // Would use actual encryption in production
        // For now, just base64 encode
        return {
          success: true,
          data: Buffer.from(json).toString('base64'),
        };
      }

      return {
        success: true,
        data: json,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Import a character from JSON
   */
  async import(
    jsonData: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse JSON
      let exportData: CharacterExport;
      try {
        exportData = JSON.parse(jsonData);
      } catch {
        // Try to decode if base64 encoded (encrypted export)
        try {
          const decoded = Buffer.from(jsonData, 'base64').toString('utf-8');
          exportData = JSON.parse(decoded);
        } catch {
          return {
            success: false,
            errors: ['Invalid JSON format'],
          };
        }
      }

      // Validate format
      if (exportData.format !== 'dmlog-character') {
        errors.push(`Unsupported format: ${exportData.format}`);
        return { success: false, errors };
      }

      if (!this.validateVersion(exportData.version)) {
        warnings.push(`Version mismatch: expected ${EXPORT_FORMAT_VERSION}, got ${exportData.version}`);
      }

      // Verify checksum
      if (exportData.metadata.checksum) {
        const calculatedChecksum = this.calculateChecksum(exportData);
        if (calculatedChecksum !== exportData.metadata.checksum) {
          warnings.push('Checksum mismatch - data may be corrupted');
        }
      }

      // Prepare character data
      let characterData = exportData.character;

      // Apply product conversion
      if (options.productDomain && options.productDomain !== characterData.productDomain) {
        characterData = this.convertForProduct(characterData, options.productDomain);
      }

      // Generate new ID if requested
      if (options.generateNewId) {
        characterData = {
          ...characterData,
          id: this.generateCharacterId(),
          createdAt: options.preserveTimestamps ? characterData.createdAt : Date.now(),
        };
      }

      // Update timestamps if not preserving
      if (!options.preserveTimestamps) {
        characterData = {
          ...characterData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lastActiveAt: Date.now(),
        };
      }

      // Set user ID
      characterData = {
        ...characterData,
        userId: options.userId,
      };

      // Determine if updating or creating
      let finalCharacter: CharacterRecord;
      if (options.targetCharacterId && options.merge) {
        // Merge with existing character
        const existing = await this.getCharacter(options.targetCharacterId, options.userId);
        if (!existing) {
          errors.push(`Target character not found: ${options.targetCharacterId}`);
          return { success: false, errors };
        }

        finalCharacter = this.mergeCharacters(existing, characterData);
        await this.updateCharacter(finalCharacter);
      } else if (options.targetCharacterId) {
        // Update existing character
        characterData.id = options.targetCharacterId;
        await this.updateCharacter(characterData);
        finalCharacter = characterData;
      } else {
        // Create new character
        const input = this.characterToInput(characterData);
        finalCharacter = await this.createCharacter(input);
      }

      // Import memories if requested and available
      let memoriesImported = 0;
      if (options.importMemories && exportData.memories) {
        for (const memory of exportData.memories) {
          await this.importMemory(finalCharacter.id, memory);
          memoriesImported++;
        }
      }

      // Import history if requested and available
      let historyImported = 0;
      if (options.importHistory && exportData.history) {
        for (const entry of exportData.history) {
          await this.importHistoryEntry(finalCharacter.id, entry);
          historyImported++;
        }
      }

      return {
        success: true,
        characterId: finalCharacter.id,
        character: finalCharacter,
        memoriesImported,
        historyImported,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Export multiple characters
   */
  async exportBatch(
    characterIds: string[],
    userId: string,
    options: ExportOptions = {}
  ): Promise<{ success: boolean; data?: string; error?: string }> {
    const exports: CharacterExport[] = [];

    for (const id of characterIds) {
      const result = await this.export(id, userId, options);
      if (result.success && result.data) {
        const exportData = JSON.parse(result.data);
        exports.push(exportData);
      }
    }

    const batchExport = {
      format: 'dmlog-character-batch',
      version: EXPORT_FORMAT_VERSION,
      exportedAt: Date.now(),
      exportedBy: userId,
      characters: exports,
      metadata: {
        exportId: this.generateExportId(),
        count: exports.length,
      },
    };

    const json = options.minify
      ? JSON.stringify(batchExport)
      : JSON.stringify(batchExport, null, 2);

    return {
      success: true,
      data: json,
    };
  }

  /**
   * Import multiple characters from batch export
   */
  async importBatch(
    jsonData: string,
    options: ImportOptions
  ): Promise<{ success: boolean; results: ImportResult[] }> {
    const batchData = JSON.parse(jsonData);

    if (batchData.format !== 'dmlog-character-batch') {
      return {
        success: false,
        results: [{
          success: false,
          errors: ['Invalid batch format'],
        }],
      };
    }

    const results: ImportResult[] = [];

    for (const characterExport of batchData.characters) {
      const result = await this.import(JSON.stringify(characterExport), {
        ...options,
        generateNewId: true, // Always generate new IDs for batch import
      });
      results.push(result);
    }

    return {
      success: results.every(r => r.success),
      results,
    };
  }

  /**
   * Create a template from an existing character
   */
  async createTemplate(
    characterId: string,
    userId: string,
    templateInfo: {
      name: string;
      description: string;
      isPublic?: boolean;
    }
  ): Promise<ImportResult> {
    const exportResult = await this.export(characterId, userId, {
      asTemplate: true,
      templateName: templateInfo.name,
      templateDescription: templateInfo.description,
    });

    if (!exportResult.success || !exportResult.data) {
      return {
        success: false,
        errors: [exportResult.error ?? 'Export failed'],
      };
    }

    // Import as a new template character
    const importResult = await this.import(exportResult.data, {
      userId,
      productDomain: 'shared',
      generateNewId: true,
    });

    if (importResult.success && importResult.character) {
      // Mark as template
      await this.updateCharacter({
        ...importResult.character,
        isTemplate: true,
        isPublic: templateInfo.isPublic ?? false,
      });
    }

    return importResult;
  }

  /**
   * Get available templates
   */
  async getTemplates(
    userId?: string,
    productDomain?: ProductDomain
  ): Promise<CharacterRecord[]> {
    let query = 'SELECT * FROM characters WHERE is_template = 1';
    const params: unknown[] = [];

    if (userId) {
      query += ' AND (user_id = ? OR is_public = 1)';
      params.push(userId);
    }

    if (productDomain) {
      query += ' AND (product_domain = ? OR product_domain = ?)';
      params.push(productDomain, 'shared');
    }

    query += ' ORDER BY name ASC';

    const stmt = this.getStatement(query);
    const result = await stmt.bind(...params).all();

    return result.results.map(row => this.rowToCharacter(row as Record<string, unknown>));
  }

  /**
   * Create a character from a template
   */
  async createFromTemplate(
    templateId: string,
    userId: string,
    characterInfo: {
      name: string;
      displayName?: string;
      productDomain: ProductDomain;
      characterType: CharacterType;
    }
  ): Promise<ImportResult> {
    // Export template
    const exportResult = await this.export(templateId, userId, {
      includeMemories: false,
      includeHistory: false,
    });

    if (!exportResult.success || !exportResult.data) {
      return {
        success: false,
        errors: [exportResult.error ?? 'Template export failed'],
      };
    }

    const templateData = JSON.parse(exportResult.data);
    templateData.character.name = characterInfo.name;
    templateData.character.displayName = characterInfo.displayName ?? characterInfo.name;
    templateData.character.productDomain = characterInfo.productDomain;
    templateData.character.characterType = characterInfo.characterType;

    // Import as new character
    return this.import(JSON.stringify(templateData), {
      userId,
      productDomain: characterInfo.productDomain,
      generateNewId: true,
    });
  }

  /**
   * Convert character for different product
   */
  private convertForProduct(
    character: CharacterRecord,
    targetProduct: ProductDomain
  ): CharacterRecord {
    const converted = { ...character, productDomain: targetProduct };

    switch (targetProduct) {
      case 'dmlog':
        // StudyLoG -> DMLoG conversion
        if (character.productDomain === 'studylog') {
          converted.characterType = 'player';
          converted.level = character.gradeLevel ?? 1;
          converted.xp = this.calculateXp(character);
          converted.hp = converted.maxHp = 10 + (converted.level * 5);
          converted.personality = this.mapPersonalityToStats(character.personality);
        }
        break;

      case 'studylog':
        // DMLoG -> StudyLoG conversion
        if (character.productDomain === 'dmlog') {
          converted.characterType = 'student';
          converted.gradeLevel = character.level;
          converted.interests = this.mapStatsToInterests(character);
          converted.learningStyle = this.inferLearningStyle(character.personality);
        }
        break;
    }

    return converted;
  }

  /**
   * Convert character to template format (strip user data)
   */
  private templateFromCharacter(
    character: CharacterRecord,
    options: ExportOptions
  ): CharacterRecord {
    return {
      ...character,
      id: '', // Will be generated on import
      userId: '', // Will be set on import
      createdAt: 0, // Will be set on import
      updatedAt: 0,
      lastActiveAt: 0,
      version: 1,
      interactionCount: 0,
      campaignId: undefined,
      sessionId: undefined,
      xp: 0, // Reset XP
      hp: character.maxHp, // Reset to max
      isTemplate: true,
      isPublic: true, // Templates are public by default
      tags: [...character.tags, 'template'],
      // Remove user-specific data
      backstory: options.asTemplate ? 'Customize your character backstory.' : character.backstory,
      goals: options.asTemplate ? ['Add your goals here'] : character.goals,
    };
  }

  /**
   * Merge two characters
   */
  private mergeCharacters(
    existing: CharacterRecord,
    incoming: CharacterRecord
  ): CharacterRecord {
    const merged: CharacterRecord = { ...existing };

    // Merge arrays
    merged.goals = [...new Set([...existing.goals, ...incoming.goals])];
    merged.fears = [...new Set([...existing.fears, ...incoming.fears])];
    merged.quirks = [...new Set([...existing.quirks, ...incoming.quirks])];
    merged.virtues = [...new Set([...existing.virtues, ...incoming.virtues])];
    merged.vices = [...new Set([...existing.vices, ...incoming.vices])];
    merged.interests = [...new Set([...existing.interests, ...incoming.interests])];
    merged.learningGoals = [...new Set([...existing.learningGoals, ...incoming.learningGoals])];
    merged.strengths = [...new Set([...existing.strengths, ...incoming.strengths])];
    merged.supportAreas = [...new Set([...existing.supportAreas, ...incoming.supportAreas])];
    merged.tags = [...new Set([...existing.tags, ...incoming.tags])];

    // Merge personality (average values)
    for (const [trait, value] of Object.entries(incoming.personality)) {
      if (trait in merged.personality) {
        merged.personality[trait] = (merged.personality[trait] + value) / 2;
      } else {
        merged.personality[trait] = value;
      }
    }

    // Take incoming values for these fields
    if (incoming.description) merged.description = incoming.description;
    if (incoming.backstory) merged.backstory = incoming.backstory;
    if (incoming.avatarUrl) merged.avatarUrl = incoming.avatarUrl;

    // Update timestamps
    merged.updatedAt = Date.now();
    merged.lastActiveAt = Date.now();
    merged.version = existing.version + 1;

    return merged;
  }

  /**
   * Calculate checksum for export data
   */
  private calculateChecksum(data: CharacterExport): string {
    // Simple checksum - in production would use proper hash
    const str = JSON.stringify({
      character: data.character,
      exportedAt: data.exportedAt,
      version: data.version,
    });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Validate export format version
   */
  private validateVersion(version: string): boolean {
    const major = parseInt(version.split('.')[0]);
    const expectedMajor = parseInt(EXPORT_FORMAT_VERSION.split('.')[0]);
    return major === expectedMajor;
  }

  /**
   * Generate unique export ID
   */
  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Generate unique character ID
   */
  private generateCharacterId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Database operations
   */
  private async getCharacter(id: string, userId: string): Promise<CharacterRecord | null> {
    const stmt = this.getStatement(
      'SELECT * FROM characters WHERE id = ? AND (user_id = ? OR is_public = 1 OR is_template = 1)'
    );
    const result = await stmt.bind(id, userId).first();
    return result ? this.rowToCharacter(result as Record<string, unknown>) : null;
  }

  private async getCharacterMemories(characterId: string): Promise<Memory[]> {
    const stmt = this.getStatement(
      'SELECT * FROM character_memories WHERE character_id = ? ORDER BY created_at DESC'
    );
    const result = await stmt.bind(characterId).all();

    return result.results.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id as string,
        content: r.content as string,
        memoryType: r.memory_type as 'working' | 'short_term' | 'long_term' | 'episodic' | 'semantic' | 'procedural',
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
  }

  private async getCharacterHistory(characterId: string): Promise<Array<Record<string, unknown>>> {
    const stmt = this.getStatement(
      'SELECT * FROM character_history WHERE character_id = ? ORDER BY created_at DESC LIMIT 100'
    );
    const result = await stmt.bind(characterId).all();

    return result.results.map(row => ({
      ...(row as Record<string, unknown>),
      previous_state: (row as Record<string, unknown>).previous_state
        ? JSON.parse((row as Record<string, unknown>).previous_state as string)
        : null,
      new_state: (row as Record<string, unknown>).new_state
        ? JSON.parse((row as Record<string, unknown>).new_state as string)
        : null,
    }));
  }

  private characterToInput(character: CharacterRecord): Omit<CharacterInput, 'userId'> & { userId: string } {
    return {
      userId: character.userId,
      productDomain: character.productDomain,
      characterType: character.characterType,
      name: character.name,
      displayName: character.displayName,
      characterClass: character.characterClass,
      description: character.description,
      avatarUrl: character.avatarUrl,
      race: character.race,
      alignment: character.alignment,
      level: character.level,
      xp: character.xp,
      hp: character.hp,
      maxHp: character.maxHp,
      ac: character.ac,
      initiative: character.initiative,
      speed: character.speed,
      personality: character.personality,
      backstory: character.backstory,
      goals: character.goals,
      fears: character.fears,
      quirks: character.quirks,
      virtues: character.virtues,
      vices: character.vices,
      learningStyle: character.learningStyle,
      gradeLevel: character.gradeLevel,
      interests: character.interests,
      learningGoals: character.learningGoals,
      strengths: character.strengths,
      supportAreas: character.supportAreas,
      campaignId: character.campaignId,
      sessionId: character.sessionId,
      parentId: character.parentId,
      tags: character.tags,
      isPublic: character.isPublic,
      isTemplate: character.isTemplate,
    };
  }

  private async createCharacter(input: CharacterInput): Promise<CharacterRecord> {
    // Implementation would insert into database
    // For now, return a mock
    const id = this.generateCharacterId();
    const now = Date.now();

    return {
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
  }

  private async updateCharacter(character: CharacterRecord): Promise<void> {
    const stmt = this.getStatement(`
      UPDATE characters SET
        name = ?, display_name = ?, character_class = ?, description = ?, avatar_url = ?,
        race = ?, alignment = ?, level = ?, xp = ?, hp = ?, max_hp = ?, ac = ?,
        initiative = ?, speed = ?, personality = ?, backstory = ?, goals = ?,
        fears = ?, quirks = ?, virtues = ?, vices = ?, learning_style = ?,
        grade_level = ?, interests = ?, learning_goals = ?, strengths = ?,
        support_areas = ?, state = ?, interaction_count = ?, updated_at = ?,
        last_active_at = ?, version = ?, tags = ?, is_public = ?, is_template = ?,
        product_domain = ?, character_type = ?
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
      character.productDomain,
      character.characterType,
      character.id
    ).run();
  }

  private async importMemory(characterId: string, memory: Memory): Promise<void> {
    const stmt = this.getStatement(`
      INSERT INTO character_memories (
        id, character_id, content, memory_type, importance, emotional_valence,
        participants, location, access_count, last_accessed, consolidated,
        related_memory_ids, tags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateCharacterId(), // New memory ID
      characterId,
      memory.content,
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
      memory.timestamp.getTime()
    ).run();
  }

  private async importHistoryEntry(characterId: string, entry: Record<string, unknown>): Promise<void> {
    const stmt = this.getStatement(`
      INSERT INTO character_history (
        id, character_id, user_id, action_type, previous_state, new_state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.bind(
      this.generateCharacterId(),
      characterId,
      entry.user_id as string,
      entry.action_type as string,
      entry.previous_state ? JSON.stringify(entry.previous_state) : null,
      entry.new_state ? JSON.stringify(entry.new_state) : null,
      entry.created_at as number
    ).run();
  }

  /**
   * Conversion helpers
   */
  private calculateXp(character: CharacterRecord): number {
    return character.interests.length * 100 + (character.gradeLevel ?? 1) * 1000;
  }

  private mapPersonalityToStats(personality: Record<string, number>): Record<string, number> {
    const stats: Record<string, number> = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    for (const [trait, value] of Object.entries(personality)) {
      const bonus = Math.round((value - 0.5) * 10);
      switch (trait) {
        case 'bravery':
        case 'aggression':
          stats.strength += bonus;
          break;
        case 'creativity':
        case 'curiosity':
          stats.dexterity += bonus;
          break;
        case 'persistence':
          stats.constitution += bonus;
          break;
        case 'intelligence':
        case 'focus':
          stats.intelligence += bonus;
          break;
        case 'kindness':
        case 'diplomacy':
          stats.wisdom += bonus;
          break;
        case 'charisma':
        case 'humor':
          stats.charisma += bonus;
          break;
      }
    }

    // Clamp to valid range
    for (const stat of Object.keys(stats)) {
      stats[stat] = Math.max(3, Math.min(18, stats[stat]));
    }

    return stats;
  }

  private mapStatsToInterests(character: CharacterRecord): string[] {
    const interests: string[] = [];
    const stats = character.personality;

    for (const [stat, value] of Object.entries(stats)) {
      if (value > 0.7) {
        interests.push(stat);
      }
    }

    if (character.characterClass) {
      interests.push(character.characterClass);
    }

    return interests;
  }

  private inferLearningStyle(personality: Record<string, number>): 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'multimodal' {
    if (personality.creativity && personality.creativity > 0.7) return 'visual';
    if (personality.curiosity && personality.curiosity > 0.7) return 'reading';
    if (personality.bravery && person.bravery > 0.7) return 'kinesthetic';
    return 'multimodal';
  }

  /**
   * Convert database row to CharacterRecord
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

  /**
   * Get or create a prepared statement
   */
  private getStatement(query: string): D1PreparedStatement {
    if (!this.statements.has(query)) {
      this.statements.set(query, this.db.prepare(query));
    }
    return this.statements.get(query)!;
  }
}
