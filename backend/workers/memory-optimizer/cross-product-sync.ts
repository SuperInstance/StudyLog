/**
 * Cross-Product Memory Sync
 *
 * Enables memory transfer between StudyLoG.AI and DMLoG.AI products.
 * Implements a unified memory format that can be adapted for each product's
 * specific needs while maintaining core memory relationships.
 *
 * StudyLoG.AI -> DMLoG.AI:
 * - Learning skills -> Character abilities
 * - Subject knowledge -> Domain expertise
 * - Problem-solving patterns -> Tactics
 * - Struggle/recovery -> Character backstory
 *
 * DMLoG.AI -> StudyLoG.AI:
 * - Collaborative sessions -> Study group memories
 * - Creative problem-solving -> Innovation skills
 * - Narrative engagement -> Story-based learning
 * - Role experiences -> Career exploration
 *
 * Architecture:
 * - Unified Memory Schema (UMS) for cross-product compatibility
 * - Bidirectional sync with conflict resolution
 * - Product-specific adapters for data transformation
 * - Temporal awareness for cross-product timeline consistency
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

import type { EpisodicMemory, SemanticMemory } from './consolidation.js';
import type { TemporalLandmark } from './landmarks.js';

/**
 * Product identifiers
 */
export enum Product {
  STUDYLOG = 'studylog',
  DMLOG = 'dmlog',
  MAKERLOG = 'makerlog',
  FISHINGLOG = 'fishinglog',
}

/**
 * Unified memory format for cross-product compatibility
 */
export interface UnifiedMemory {
  /** Unique ID across products */
  id: string;
  /** Source product */
  sourceProduct: Product;
  /** User ID (may be different per product) */
  userId: string;
  /** Unified user ID across products */
  unifiedUserId?: string;

  // Core content
  content: string;
  category: string;
  tags: string[];

  // Timestamps
  timestamp: number;
  lastModified: number;

  // Importance and emotion
  importance: number; // 1-10
  emotionalValence: number; // -1 to 1

  // Product-specific data
  productData: ProductData;

  // Sync metadata
  syncedTo: Product[];
  syncVersion: number;
}

/**
 * Product-specific memory data
 */
export type ProductData =
  | StudyLoGData
  | DMLoGData
  | MakerLoGData
  | FishingLoGData;

/**
 * StudyLoG.AI specific data
 */
export interface StudyLoGData {
  product: Product.STUDYLOG;
  subject?: string;
  topic?: string;
  difficulty?: number;
  masteryLevel?: number;
  standards?: string[];
  successLevel?: number;
  module?: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
}

/**
 * DMLoG.AI specific data
 */
export interface DMLoGData {
  product: Product.DMLOG;
  characterName?: string;
  characterClass?: string;
  campaignId?: string;
  sessionId?: string;
  encounterType?: 'combat' | 'social' | 'exploration' | 'puzzle';
  rollOutcome?: number;
  partyMembers?: string[];
}

/**
 * MakerLoG.AI specific data
 */
export interface MakerLoGData {
  product: Product.MAKERLOG;
  projectType?: '3d-print' | 'circuit' | 'code' | 'mechanical';
  components?: string[];
  tools?: string[];
  completionStatus?: 'design' | 'prototype' | 'testing' | 'complete';
}

/**
 * FishingLoG.AI specific data
 */
export interface FishingLoGData {
  product: Product.FISHINGLOG;
  location?: string;
  species?: string[];
  technique?: string;
  weather?: string;
  successLevel?: number;
}

/**
 * Sync direction
 */
export enum SyncDirection {
  STUDYLOG_TO_DMLOG = 'studylog_to_dmlog',
  DMLOG_TO_STUDYLOG = 'dmlog_to_studylog',
  BIDIRECTIONAL = 'bidirectional',
}

/**
 * Sync result
 */
export interface SyncResult {
  memoriesSynced: number;
  memoriesTransformed: number;
  memoriesSkipped: number;
  conflicts: Array<{
    memoryId: string;
    reason: string;
    resolution: 'kept' | 'merged' | 'skipped';
  }>;
  timestamp: number;
}

/**
 * Transformation config
 */
export interface TransformationConfig {
  /** Map StudyLoG subjects to DMLoG character classes */
  subjectToClass: Map<string, string>;
  /** Map StudyLoG topics to DMLoG skills */
  topicToSkill: Map<string, string>;
  /** Map DMLoG classes to StudyLoG subjects */
  classToSubject: Map<string, string>;
  /** Map DMLoG skills to StudyLoG topics */
  skillToTopic: Map<string, string>;
  /** Minimum importance for sync */
  minImportance: number;
  /** Enable temporal landmark sync */
  syncLandmarks: boolean;
}

/**
 * Default transformation mappings
 */
export const DEFAULT_TRANSFORMATIONS: TransformationConfig = {
  subjectToClass: new Map([
    ['mathematics', 'Wizard'],
    ['physics', 'Artificer'],
    ['chemistry', 'Alchemist'],
    ['biology', 'Druid'],
    ['computer-science', 'Artificer'],
    ['history', 'Bard'],
    ['literature', 'Bard'],
    ['art', 'Bard'],
    ['physical-education', 'Fighter'],
    ['logic', 'Wizard'],
    ['problem-solving', 'Rogue'],
  ]),
  topicToSkill: new Map([
    ['algebra', 'Arcana'],
    ['geometry', 'Investigation'],
    ['programming', 'Thieves\' Tools'],
    ['writing', 'Persuasion'],
    ['public-speaking', 'Performance'],
    ['teamwork', 'Insight'],
    ['research', 'Investigation'],
    ['experimentation', 'Alchemy'],
  ]),
  classToSubject: new Map([
    ['Wizard', 'mathematics'],
    ['Artificer', 'physics'],
    ['Alchemist', 'chemistry'],
    ['Druid', 'biology'],
    ['Bard', 'literature'],
    ['Fighter', 'physical-education'],
    ['Rogue', 'problem-solving'],
  ]),
  skillToTopic: new Map([
    ['Arcana', 'algebra'],
    ['Investigation', 'research'],
    ['Persuasion', 'writing'],
    ['Performance', 'public-speaking'],
    ['Insight', 'teamwork'],
    ['Athletics', 'physical-education'],
  ]),
  minImportance: 5,
  syncLandmarks: true,
};

// ═══════════════════════════════════════════════════════════
// Cross-Product Memory Sync Engine
// ═══════════════════════════════════════════════════════════

export class CrossProductMemorySync {
  private readonly config: TransformationConfig;
  private unifiedMemories: Map<string, UnifiedMemory>;
  private conflictResolutions: Map<string, 'left' | 'right' | 'merge'>;

  constructor(config?: Partial<TransformationConfig>) {
    this.config = {
      ...DEFAULT_TRANSFORMATIONS,
      ...config,
      subjectToClass: config?.subjectToClass ?? DEFAULT_TRANSFORMATIONS.subjectToClass,
      topicToSkill: config?.topicToSkill ?? DEFAULT_TRANSFORMATIONS.topicToSkill,
      classToSubject: config?.classToSubject ?? DEFAULT_TRANSFORMATIONS.classToSubject,
      skillToTopic: config?.skillToTopic ?? DEFAULT_TRANSFORMATIONS.skillToTopic,
    };
    this.unifiedMemories = new Map();
    this.conflictResolutions = new Map();
  }

  // ═══════════════════════════════════════════════════════════
  // StudyLoG -> DMLoG Transformation
  // ═══════════════════════════════════════════════════════════

  /**
   * Transform StudyLoG episodic memory to DMLoG format
   */
  studyLogToDmLog(memory: EpisodicMemory, characterName?: string): UnifiedMemory | null {
    if (memory.importance < this.config.minImportance) {
      return null;
    }

    const subject = memory.subject ?? 'general';
    const topic = memory.topic ?? 'general';

    const unifiedMemory: UnifiedMemory = {
      id: `ums_${memory.id}`,
      sourceProduct: Product.STUDYLOG,
      userId: memory.studentId,
      content: this.transformContentStudyToDm(memory),
      category: this.mapSubjectToClass(subject),
      tags: [...(memory.tags ?? []), topic],
      timestamp: memory.timestamp,
      lastModified: memory.lastAccessed ?? memory.timestamp,
      importance: memory.importance,
      emotionalValence: memory.emotionalValence,
      productData: {
        product: Product.DMLOG,
        characterName: characterName ?? this.generateCharacterName(subject),
        characterClass: this.mapSubjectToClass(subject),
        encounterType: this.mapSuccessToEncounter(memory.successLevel, memory.emotionalValence),
        rollOutcome: this.mapSuccessToRoll(memory.successLevel),
        partyMembers: memory.participants ?? [],
      },
      syncedTo: [Product.STUDYLOG, Product.DMLOG],
      syncVersion: 1,
    };

    return unifiedMemory;
  }

  /**
   * Transform StudyLoG semantic memory to DMLoG character ability
   */
  semanticStudyToDmLog(semantic: SemanticMemory, characterName?: string): UnifiedMemory | null {
    if (semantic.masteryLevel < 0.5) {
      return null; // Only transfer learned skills
    }

    const unifiedMemory: UnifiedMemory = {
      id: `ums_semantic_${semantic.id}`,
      sourceProduct: Product.STUDYLOG,
      userId: semantic.studentId,
      content: `Skill: ${semantic.concept}. ${semantic.content}`,
      category: 'ability',
      tags: [...semantic.patterns],
      timestamp: semantic.createdAt,
      lastModified: semantic.lastUpdated,
      importance: Math.round(semantic.masteryLevel * 10),
      emotionalValence: semantic.strength > 0.7 ? 0.5 : 0,
      productData: {
        product: Product.DMLOG,
        characterName: characterName ?? 'Hero',
        characterClass: this.mapConceptToClass(semantic.concept),
      },
      syncedTo: [Product.STUDYLOG, Product.DMLOG],
      syncVersion: 1,
    };

    return unifiedMemory;
  }

  /**
   * Transform content from StudyLoG to DMLoG narrative
   */
  private transformContentStudyToDm(memory: EpisodicMemory): string {
    const topic = memory.topic ?? 'the task';
    const successLevel = memory.successLevel ?? 0.5;
    const emotion = memory.emotionalValence;

    let action = 'attempted';
    if (successLevel > 0.8) action = 'mastered';
    else if (successLevel > 0.6) action = 'succeeded at';
    else if (successLevel > 0.4) action = 'worked on';
    else if (successLevel < 0.3) action = 'struggled with';

    let result = '';
    if (emotion > 0.5) result = 'with great enthusiasm';
    else if (emotion > 0) result = 'with determination';
    else if (emotion < -0.3) result = 'facing significant challenges';

    return `${action} ${topic}, ${result}`;
  }

  /**
   * Map StudyLoG subject to DMLoG character class
   */
  private mapSubjectToClass(subject: string): string {
    return this.config.subjectToClass.get(subject.toLowerCase()) ?? 'Adventurer';
  }

  /**
   * Map StudyLoG concept to DMLoG class
   */
  private mapConceptToClass(concept: string): string {
    for (const [subject, className] of this.config.subjectToClass.entries()) {
      if (concept.toLowerCase().includes(subject)) {
        return className;
      }
    }
    return 'Adventurer';
  }

  /**
   * Map success level to encounter type
   */
  private mapSuccessToEncounter(
    successLevel: number | undefined,
    emotionalValence: number
  ): DMLoGData['encounterType'] {
    if (emotionalValence < -0.4) return 'combat'; // Struggle = battle
    if ((successLevel ?? 0.5) > 0.7) return 'exploration'; // Success = discovery
    if (memoryHasSocialKeyword(emotionalValence)) return 'social';
    return 'puzzle';
  }

  /**
   * Map success level to D20 roll result
   */
  private mapSuccessToRoll(successLevel: number | undefined): number {
    if (!successLevel) return 10;
    return Math.round(5 + (successLevel * 15)); // 5-20 range
  }

  /**
   * Generate character name from subject
   */
  private generateCharacterName(subject: string): string {
    const titles: Record<string, string> = {
      mathematics: 'Archmage',
      physics: 'Artificer',
      chemistry: 'Alchemist',
      biology: 'Naturalist',
      history: 'Sage',
      literature: 'Bard',
      art: 'Creator',
    };
    return titles[subject.toLowerCase()] ?? 'Adventurer';
  }

  // ═══════════════════════════════════════════════════════════
  // DMLoG -> StudyLoG Transformation
  // ═══════════════════════════════════════════════════════════

  /**
   * Transform DMLoG memory to StudyLoG format
   */
  dmLogToStudyLog(
    dmMemory: {
      id: string;
      userId: string;
      content: string;
      timestamp: number;
      characterClass?: string;
      encounterType?: string;
      success?: boolean;
      rollResult?: number;
    }
  ): UnifiedMemory | null {
    const subject = dmMemory.characterClass
      ? this.mapClassToSubject(dmMemory.characterClass)
      : 'general';

    const successLevel = dmMemory.rollResult
      ? (dmMemory.rollResult - 5) / 15
      : dmMemory.success ? 0.8 : 0.3;

    const unifiedMemory: UnifiedMemory = {
      id: `ums_dmlog_${dmMemory.id}`,
      sourceProduct: Product.DMLOG,
      userId: dmMemory.userId,
      content: this.transformContentDmToStudy(dmMemory, subject),
      category: subject,
      tags: [dmMemory.encounterType ?? 'activity'],
      timestamp: dmMemory.timestamp,
      lastModified: dmMemory.timestamp,
      importance: dmMemory.rollResult ? Math.ceil(dmMemory.rollResult / 2) : 5,
      emotionalValence: dmMemory.success ? 0.5 : -0.2,
      productData: {
        product: Product.STUDYLOG,
        subject,
        topic: this.mapEncounterToTopic(dmMemory.encounterType),
        difficulty: this.mapRollToDifficulty(dmMemory.rollResult),
        successLevel,
        module: 'sitka-sound', // DMLoG activities map to Sitka
      },
      syncedTo: [Product.DMLOG, Product.STUDYLOG],
      syncVersion: 1,
    };

    return unifiedMemory;
  }

  /**
   * Transform DMLoG content to StudyLoG narrative
   */
  private transformContentDmToStudy(
    dmMemory: {
      content: string;
      encounterType?: string;
      rollResult?: number;
      success?: boolean;
    },
    subject: string
  ): string {
    const encounter = dmMemory.encounterType ?? 'activity';
    const success = dmMemory.success ?? (dmMemory.rollResult ?? 10) >= 10;

    let action = 'engaged in';
    if (encounter === 'combat') action = 'faced challenges in';
    else if (encounter === 'social') action = 'collaborated during';
    else if (encounter === 'exploration') action = 'explored';

    const outcome = success ? 'with positive results' : 'and learned from the experience';

    return `Collaborative ${subject} activity: ${action} ${encounter} ${outcome}`;
  }

  /**
   * Map DMLoG class to StudyLoG subject
   */
  private mapClassToClass(className: string): string {
    return this.config.classToSubject.get(className) ?? 'general';
  }

  /**
   * Map encounter type to topic
   */
  private mapEncounterToTopic(encounterType?: string): string {
    const mapping: Record<string, string> = {
      combat: 'problem-solving',
      social: 'collaboration',
      exploration: 'discovery',
      puzzle: 'critical-thinking',
    };
    return mapping[encounterType ?? ''] ?? 'general-activity';
  }

  /**
   * Map roll result to difficulty
   */
  private mapRollToDifficulty(roll?: number): number {
    if (!roll) return 5;
    return Math.max(1, Math.min(10, Math.ceil(roll / 2)));
  }

  // ═══════════════════════════════════════════════════════════
  // Batch Sync Operations
  // ═══════════════════════════════════════════════════════════

  /**
   * Sync StudyLoG memories to DMLoG
   */
  async syncStudyLogToDmLog(
    episodicMemories: EpisodicMemory[],
    semanticMemories: SemanticMemory[],
    characterName?: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      memoriesSynced: 0,
      memoriesTransformed: 0,
      memoriesSkipped: 0,
      conflicts: [],
      timestamp: Date.now(),
    };

    // Sync episodic memories
    for (const memory of episodicMemories) {
      const transformed = this.studyLogToDmLog(memory, characterName);

      if (!transformed) {
        result.memoriesSkipped++;
        continue;
      }

      const conflict = this.detectConflict(transformed);
      if (conflict) {
        const resolution = this.resolveConflict(transformed, conflict);
        result.conflicts.push({
          memoryId: memory.id,
          reason: conflict.reason,
          resolution: resolution,
        });
        if (resolution === 'skipped') continue;
      }

      this.unifiedMemories.set(transformed.id, transformed);
      result.memoriesSynced++;
      result.memoriesTransformed++;
    }

    // Sync semantic memories as abilities
    for (const semantic of semanticMemories) {
      const transformed = this.semanticStudyToDmLog(semantic, characterName);

      if (!transformed) {
        result.memoriesSkipped++;
        continue;
      }

      this.unifiedMemories.set(transformed.id, transformed);
      result.memoriesSynced++;
      result.memoriesTransformed++;
    }

    return result;
  }

  /**
   * Sync DMLoG memories to StudyLoG
   */
  async syncDmLogToStudyLog(
    dmMemories: Array<{
      id: string;
      userId: string;
      content: string;
      timestamp: number;
      characterClass?: string;
      encounterType?: string;
      success?: boolean;
      rollResult?: number;
    }>
  ): Promise<SyncResult> {
    const result: SyncResult = {
      memoriesSynced: 0,
      memoriesTransformed: 0,
      memoriesSkipped: 0,
      conflicts: [],
      timestamp: Date.now(),
    };

    for (const dmMemory of dmMemories) {
      const transformed = this.dmLogToStudyLog(dmMemory);

      if (!transformed) {
        result.memoriesSkipped++;
        continue;
      }

      const conflict = this.detectConflict(transformed);
      if (conflict) {
        const resolution = this.resolveConflict(transformed, conflict);
        result.conflicts.push({
          memoryId: dmMemory.id,
          reason: conflict.reason,
          resolution: resolution,
        });
        if (resolution === 'skipped') continue;
      }

      this.unifiedMemories.set(transformed.id, transformed);
      result.memoriesSynced++;
      result.memoriesTransformed++;
    }

    return result;
  }

  /**
   * Detect conflicts between unified memories
   */
  private detectConflict(memory: UnifiedMemory): { reason: string; existing: UnifiedMemory } | null {
    const existing = this.unifiedMemories.get(memory.id);

    if (!existing) return null;

    // Check timestamp - newer wins
    if (memory.timestamp > existing.lastModified) {
      return { reason: 'newer-version', existing };
    }

    if (memory.timestamp < existing.lastModified) {
      return { reason: 'older-version', existing };
    }

    // Same timestamp - content conflict
    if (memory.content !== existing.content) {
      return { reason: 'content-conflict', existing };
    }

    return null;
  }

  /**
   * Resolve conflict based on policy
   */
  private resolveConflict(
    memory: UnifiedMemory,
    conflict: { reason: string; existing: UnifiedMemory }
  ): 'kept' | 'merged' | 'skipped' {
    const savedResolution = this.conflictResolutions.get(memory.id);

    if (savedResolution === 'left') return 'kept';
    if (savedResolution === 'right') return 'skipped';

    // Auto-resolution based on reason
    switch (conflict.reason) {
      case 'newer-version':
        return 'kept'; // Keep newer version
      case 'older-version':
        return 'skipped'; // Keep existing
      case 'content-conflict':
        return 'merged'; // Merge content
      default:
        return 'kept';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Landmark Sync
  // ═══════════════════════════════════════════════════════════

  /**
   * Transform temporal landmark across products
   */
  syncLandmark(
    landmark: TemporalLandmark,
    targetProduct: Product
  ): TemporalLandmark | null {
    if (!this.config.syncLandmarks) return null;

    const transformed: TemporalLandmark = {
      ...landmark,
      id: `landmark_${targetProduct}_${landmark.id}`,
      title: this.transformLandmarkTitle(landmark.title, targetProduct),
      description: this.transformLandmarkDescription(landmark.description, targetProduct),
      relatedTopics: this.transformTopics(landmark.relatedTopics, targetProduct),
    };

    return transformed;
  }

  /**
   * Transform landmark title for target product
   */
  private transformLandmarkTitle(title: string, targetProduct: Product): string {
    if (targetProduct === Product.DMLOG) {
      if (title.includes('First Time:')) {
        return title.replace('First Time:', 'Origin Story:');
      }
      if (title.includes('Breakthrough:')) {
        return title.replace('Breakthrough:', 'Critical Success:');
      }
      if (title.includes('Milestone:')) {
        return title.replace('Milestone:', 'Quest Complete:');
      }
    }
    return title;
  }

  /**
   * Transform landmark description
   */
  private transformLandmarkDescription(description: string, targetProduct: Product): string {
    if (targetProduct === Product.DMLOG) {
      // Add fantasy flavor
      return `In the realm of learning, ${description.toLowerCase()}`;
    }
    return description;
  }

  /**
   * Transform topics for target product
   */
  private transformTopics(topics: string[], targetProduct: Product): string[] {
    if (targetProduct === Product.DMLOG) {
      return topics.map(t => {
        const mapped = this.config.topicToSkill.get(t.toLowerCase());
        return mapped ?? t;
      });
    }
    return topics;
  }

  // ═══════════════════════════════════════════════════════════
  // Utilities
  // ═══════════════════════════════════════════════════════════

  /**
   * Get unified memories for a user
   */
  getUnifiedMemories(userId: string, product?: Product): UnifiedMemory[] {
    const memories = Array.from(this.unifiedMemories.values()).filter(m => {
      if (m.userId !== userId) return false;
      if (product && !m.syncedTo.includes(product)) return false;
      return true;
    });

    return memories.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): {
    totalUnified: number;
    bySource: Record<Product, number>;
    syncedTo: Record<Product, number>;
  } {
    const bySource: Record<string, number> = {
      [Product.STUDYLOG]: 0,
      [Product.DMLOG]: 0,
      [Product.MAKERLOG]: 0,
      [Product.FISHINGLOG]: 0,
    };

    const syncedTo: Record<string, number> = {
      [Product.STUDYLOG]: 0,
      [Product.DMLOG]: 0,
      [Product.MAKERLOG]: 0,
      [Product.FISHINGLOG]: 0,
    };

    for (const memory of this.unifiedMemories.values()) {
      bySource[memory.sourceProduct]++;
      for (const product of memory.syncedTo) {
        syncedTo[product]++;
      }
    }

    return {
      totalUnified: this.unifiedMemories.size,
      bySource: bySource as Record<Product, number>,
      syncedTo: syncedTo as Record<Product, number>,
    };
  }

  /**
   * Export unified memories
   */
  exportUnifiedMemories(): UnifiedMemory[] {
    return Array.from(this.unifiedMemories.values());
  }

  /**
   * Import unified memories
   */
  importUnifiedMemories(memories: UnifiedMemory[]): void {
    for (const memory of memories) {
      this.unifiedMemories.set(memory.id, memory);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.unifiedMemories.clear();
    this.conflictResolutions.clear();
  }
}

/**
 * Helper function to check if memory has social keywords
 */
function memoryHasSocialKeyword(emotionalValence: number): boolean {
  // In a real implementation, would check content for social keywords
  return emotionalValence > 0.3;
}

/**
 * Factory function
 */
export function createCrossProductSync(
  config?: Partial<TransformationConfig>
): CrossProductMemorySync {
  return new CrossProductMemorySync(config);
}

/**
 * Export types
 */
export type {
  UnifiedMemory,
  ProductData,
  StudyLoGData,
  DMLoGData,
  MakerLoGData,
  FishingLoGData,
  SyncResult,
  TransformationConfig,
};
