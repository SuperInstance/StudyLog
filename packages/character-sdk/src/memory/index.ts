/**
 * Hierarchical Memory System
 *
 * Adapted from SuperInstance ai-character-sdk with StudyLoG.AI enhancements
 * for educational use cases and student progress tracking.
 */

import type {
  Memory,
  MemoryTier,
  ImportanceLevel,
  StudyMemory,
  MemoryStats,
} from '../core/types.js';

/**
 * Memory storage configuration
 */
export interface MemoryConfig {
  maxWorkingMemories: number;
  maxMidTermMemories: number;
  recencyDecayRate: number; // Per hour
  consolidationThreshold: number;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  maxWorkingMemories: 10,
  maxMidTermMemories: 100,
  recencyDecayRate: 0.995,
  consolidationThreshold: 150.0,
};

/**
 * Retrieval options
 */
export interface RetrievalOptions {
  topK?: number;
  memoryType?: MemoryTier;
  alphaRecency?: number;
  alphaImportance?: number;
  alphaRelevance?: number;
}

/**
 * Hierarchical Memory System
 *
 * Implements a 6-tier memory architecture inspired by cognitive neuroscience:
 * - WORKING: Current attention (seconds to minutes)
 * - MID_TERM: Session buffer (1-6 hours)
 * - LONG_TERM: Consolidated storage (1+ weeks)
 * - EPISODIC: Specific events "what-where-when"
 * - SEMANTIC: Consolidated patterns & facts
 * - PROCEDURAL: Skills & learned behaviors
 *
 * @example
 * ```ts
 * const memory = new HierarchicalMemory('student_001');
 *
 * // Store a learning event
 * memory.store('Learned about photosynthesis', {
 *   memoryType: MemoryTier.EPISODIC,
 *   importance: 7.0,
 *   emotionalValence: 0.8,
 * });
 *
 * // Retrieve relevant memories
 * const relevant = memory.retrieve('photosynthesis plant energy', { topK: 5 });
 * ```
 */
export class HierarchicalMemory {
  private readonly characterId: string;
  private readonly memories: Map<string, Memory>;
  private importanceAccumulator: number;
  private lastConsolidationTime: Date;
  private readonly config: MemoryConfig;

  constructor(
    characterId: string,
    config: Partial<MemoryConfig> = {}
  ) {
    this.characterId = characterId;
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.memories = new Map();
    this.importanceAccumulator = 0.0;
    this.lastConsolidationTime = new Date();
  }

  /**
   * Get all memories
   */
  get memoriesList(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Get memory by ID
   */
  getById(memoryId: string): Memory | undefined {
    return this.memories.get(memoryId);
  }

  /**
   * Store a new memory
   */
  store(
    content: string,
    options: {
      memoryType?: MemoryTier | string;
      importance?: number;
      emotionalValence?: number;
      participants?: string[];
      location?: string;
      tags?: string[];
    } = {}
  ): Memory {
    const {
      memoryType = MemoryTier.EPISODIC,
      importance = 5.0,
      emotionalValence = 0.0,
      participants = [],
      location = '',
      tags = [],
    } = options;

    const memoryId = this.generateMemoryId(content);

    const memory: Memory = {
      id: memoryId,
      content,
      memoryType: typeof memoryType === 'string'
        ? this.parseMemoryType(memoryType)
        : memoryType,
      timestamp: new Date(),
      importance: Math.max(1, Math.min(10, importance)),
      emotionalValence: Math.max(-1, Math.min(1, emotionalValence)),
      participants,
      location,
      accessCount: 0,
      lastAccessed: null,
      consolidated: false,
      relatedMemoryIds: [],
      tags,
    };

    this.memories.set(memoryId, memory);
    this.importanceAccumulator += importance;

    // Manage tier capacity
    this.manageTierCapacity(memory.memoryType);

    return memory;
  }

  /**
   * Store in working memory (current attention)
   */
  storeWorking(content: string, importance = 3.0): Memory {
    return this.store(content, { memoryType: MemoryTier.WORKING, importance });
  }

  /**
   * Store in mid-term memory (session buffer)
   */
  storeMidTerm(content: string, importance = 5.0): Memory {
    return this.store(content, { memoryType: MemoryTier.MID_TERM, importance });
  }

  /**
   * Store as episodic memory (specific event)
   */
  storeEpisodic(content: string, importance = 6.0): Memory {
    return this.store(content, { memoryType: MemoryTier.EPISODIC, importance });
  }

  /**
   * Store as semantic memory (fact/pattern)
   */
  storeSemantic(content: string, importance = 7.0): Memory {
    return this.store(content, { memoryType: MemoryTier.SEMANTIC, importance });
  }

  /**
   * Store as procedural memory (skill)
   */
  storeProcedural(content: string, importance = 8.0): Memory {
    return this.store(content, { memoryType: MemoryTier.PROCEDURAL, importance });
  }

  /**
   * Store study-specific memory (StudyLoG.AI extension)
   */
  storeStudy(
    content: string,
    options: {
      subject?: string;
      topic?: string;
      difficulty?: number;
      masteryLevel?: string;
      standards?: string[];
      importance?: number;
    } = {}
  ): StudyMemory {
    const memory = this.store(content, {
      memoryType: MemoryTier.SEMANTIC,
      importance: options.importance ?? 6.0,
      tags: [options.subject ?? 'general', options.topic ?? 'general', ...(options.standards ?? [])],
    }) as StudyMemory;

    memory.subject = options.subject;
    memory.topic = options.topic;
    memory.difficulty = options.difficulty;
    if (options.masteryLevel) {
      memory.masteryLevel = options.masteryLevel as any;
    }
    memory.standards = options.standards;

    return memory;
  }

  /**
   * Retrieve memories with weighted scoring
   *
   * Scoring combines:
   * - Recency: Exponential decay per hour
   * - Importance: Normalized 1-10 scale
   * - Relevance: Word overlap Jaccard index
   */
  retrieve(query: string, options: RetrievalOptions = {}): Memory[] {
    const {
      topK = 10,
      memoryType,
      alphaRecency = 1.0,
      alphaImportance = 1.0,
      alphaRelevance = 1.0,
    } = options;

    // Filter by type if specified
    let memories = this.memoriesList;
    if (memoryType) {
      const tier = typeof memoryType === 'string'
        ? this.parseMemoryType(memoryType)
        : memoryType;
      memories = memories.filter(m => m.memoryType === tier);
    }

    // Score each memory
    const results = memories.map(memory => {
      const score = this.calculateScore(query, memory, {
        alphaRecency,
        alphaImportance,
        alphaRelevance,
      });
      return { score, memory };
    });

    // Sort by score and return topK
    results.sort((a, b) => b.score - a.score);
    const retrieved = results.slice(0, topK).map(r => r.memory);

    // Update access counts (boosts importance)
    for (const memory of retrieved) {
      memory.accessCount++;
      memory.lastAccessed = new Date();
      // Slight importance boost on retrieval
      memory.importance = Math.min(memory.importance * 1.05, 10);
    }

    return retrieved;
  }

  /**
   * Get recent memories within specified hours
   */
  getRecent(hours = 24, topK = 10): Memory[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recent = this.memoriesList
      .filter(m => m.timestamp > cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return recent.slice(0, topK);
  }

  /**
   * Get important memories above threshold
   */
  getImportant(threshold = 6.0, topK = 10): Memory[] {
    const important = this.memoriesList
      .filter(m => m.importance >= threshold)
      .sort((a, b) => b.importance - a.importance);
    return important.slice(0, topK);
  }

  /**
   * Get memories by type
   */
  getMemoriesByType(memoryType: MemoryTier | string): Memory[] {
    const tier = typeof memoryType === 'string'
      ? this.parseMemoryType(memoryType)
      : memoryType;
    return this.memoriesList.filter(m => m.memoryType === tier);
  }

  /**
   * Get memories by tag
   */
  getMemoriesByTag(tag: string): Memory[] {
    return this.memoriesList.filter(m =>
      m.tags?.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  /**
   * Get memories by subject (StudyLoG.AI extension)
   */
  getMemoriesBySubject(subject: string): Memory[] {
    return this.memoriesList.filter((m): m is StudyMemory =>
      'subject' in m && m.subject?.toLowerCase() === subject.toLowerCase()
    );
  }

  /**
   * Relate two memories
   */
  relateMemories(memoryId1: string, memoryId2: string): void {
    const mem1 = this.memories.get(memoryId1);
    const mem2 = this.memories.get(memoryId2);

    if (mem1 && mem2) {
      if (!mem1.relatedMemoryIds.includes(memoryId2)) {
        mem1.relatedMemoryIds.push(memoryId2);
      }
      if (!mem2.relatedMemoryIds.includes(memoryId1)) {
        mem2.relatedMemoryIds.push(memoryId1);
      }
    }
  }

  /**
   * Get related memories
   */
  getRelatedMemories(memoryId: string): Memory[] {
    const memory = this.memories.get(memoryId);
    if (!memory) return [];

    return memory.relatedMemoryIds
      .map(id => this.memories.get(id))
      .filter((m): m is Memory => m !== undefined);
  }

  /**
   * Remove a memory by ID
   */
  forget(memoryId: string): boolean {
    return this.memories.delete(memoryId);
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
    this.importanceAccumulator = 0;
    this.lastConsolidationTime = new Date();
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const byType: Record<string, number> = {};
    let consolidated = 0;

    for (const memory of this.memoriesList) {
      byType[memory.memoryType] = (byType[memory.memoryType] || 0) + 1;
      if (memory.consolidated) consolidated++;
    }

    const avgImportance = this.memoriesList.length > 0
      ? this.memoriesList.reduce((sum, m) => sum + m.importance, 0) / this.memoriesList.length
      : 0;

    return {
      characterId: this.characterId,
      totalMemories: this.memoriesList.length,
      byType,
      consolidated,
      unconsolidated: this.memoriesList.length - consolidated,
      averageImportance: avgImportance,
      importanceAccumulator: this.importanceAccumulator,
    };
  }

  /**
   * Export all memories as JSON
   */
  toJSON(): object {
    return {
      characterId: this.characterId,
      memories: this.memoriesList.map(m => this.serializeMemory(m)),
      importanceAccumulator: this.importanceAccumulator,
      lastConsolidationTime: this.lastConsolidationTime.toISOString(),
      config: this.config,
    };
  }

  /**
   * Import memories from JSON
   */
  fromJSON(data: { memories: unknown[]; importanceAccumulator?: number }): void {
    for (const memData of data.memories) {
      const memory = this.deserializeMemory(memData);
      this.memories.set(memory.id, memory);
    }
    if (data.importanceAccumulator !== undefined) {
      this.importanceAccumulator = data.importanceAccumulator;
    }
  }

  /**
   * Calculate retrieval score for a memory
   */
  private calculateScore(
    query: string,
    memory: Memory,
    weights: { alphaRecency: number; alphaImportance: number; alphaRelevance: number }
  ): number {
    const hoursAgo = (Date.now() - memory.timestamp.getTime()) / (60 * 60 * 1000);
    const recencyScore = Math.pow(this.config.recencyDecayRate, hoursAgo);
    const importanceScore = memory.importance / 10;
    const relevanceScore = this.calculateRelevance(query, memory.content);

    const totalWeight = weights.alphaRecency + weights.alphaImportance + weights.alphaRelevance;
    return (
      weights.alphaRecency * recencyScore +
      weights.alphaImportance * importanceScore +
      weights.alphaRelevance * relevanceScore
    ) / totalWeight;
  }

  /**
   * Calculate relevance (Jaccard similarity)
   */
  private calculateRelevance(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    if (words1.size === 0 || words2.size === 0) return 0;

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * Manage tier capacity by evicting old memories
   */
  private manageTierCapacity(memoryType: MemoryTier): void {
    if (memoryType === MemoryTier.WORKING) {
      this.evictFromTier(memoryType, this.config.maxWorkingMemories);
    } else if (memoryType === MemoryTier.MID_TERM) {
      this.evictFromTier(memoryType, this.config.maxMidTermMemories);
    }
  }

  /**
   * Evict least important memories from a tier
   */
  private evictFromTier(memoryType: MemoryTier, maxCount: number): void {
    const tierMemories = this.memoriesList.filter(m => m.memoryType === memoryType);
    if (tierMemories.length <= maxCount) return;

    // Sort by importance * recency (unaccessed memories deprioritized)
    tierMemories.sort((a, b) => {
      const scoreA = a.importance * (a.accessCount === 0 ? 0.5 : 1);
      const scoreB = b.importance * (b.accessCount === 0 ? 0.5 : 1);
      return scoreA - scoreB;
    });

    // Evict the least important
    const toEvict = tierMemories.slice(0, -maxCount);
    for (const m of toEvict) {
      this.memories.delete(m.id);
    }
  }

  /**
   * Generate unique memory ID
   */
  private generateMemoryId(content: string): string {
    const seed = `${this.characterId}${content}${Date.now()}${Math.random()}`;
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Parse memory type from string
   */
  private parseMemoryType(type: string): MemoryTier {
    const normalized = type.replace(/[-\s]/g, '_').toUpperCase();
    if (Object.values(MemoryTier).includes(normalized as MemoryTier)) {
      return normalized as MemoryTier;
    }
    return MemoryTier.EPISODIC;
  }

  /**
   * Serialize memory for storage
   */
  private serializeMemory(memory: Memory): object {
    return {
      id: memory.id,
      content: memory.content,
      memoryType: memory.memoryType,
      timestamp: memory.timestamp.toISOString(),
      importance: memory.importance,
      emotionalValence: memory.emotionalValence,
      participants: memory.participants,
      location: memory.location,
      accessCount: memory.accessCount,
      lastAccessed: memory.lastAccessed?.toISOString() ?? null,
      consolidated: memory.consolidated,
      relatedMemoryIds: memory.relatedMemoryIds,
      tags: memory.tags,
      embedding: memory.embedding,
      ...(memory.subject && { subject: memory.subject }),
      ...(memory.topic && { topic: memory.topic }),
      ...(memory.difficulty && { difficulty: memory.difficulty }),
    };
  }

  /**
   * Deserialize memory from storage
   */
  private deserializeMemory(data: unknown): Memory {
    const d = data as Record<string, unknown>;
    return {
      id: d.id as string,
      content: d.content as string,
      memoryType: d.memoryType as MemoryTier,
      timestamp: new Date(d.timestamp as string),
      importance: d.importance as number,
      emotionalValence: d.emotionalValence as number,
      participants: d.participants as string[],
      location: d.location as string,
      accessCount: d.accessCount as number,
      lastAccessed: d.lastAccessed ? new Date(d.lastAccessed as string) : null,
      consolidated: d.consolidated as boolean,
      relatedMemoryIds: d.relatedMemoryIds as string[],
      tags: d.tags as string[] | undefined,
      embedding: d.embedding as number[] | undefined,
      ...(d.subject && { subject: d.subject as string }),
      ...(d.topic && { topic: d.topic as string }),
      ...(d.difficulty && { difficulty: d.difficulty as number }),
    } as Memory;
  }
}

/**
 * Factory function to create a memory system
 */
export function createMemory(
  characterId: string,
  config?: Partial<MemoryConfig>
): HierarchicalMemory {
  return new HierarchicalMemory(characterId, config);
}

// Re-export types
export type {
  Memory,
  MemoryTier,
  ImportanceLevel,
  StudyMemory,
  MemoryStats,
  MemoryConfig,
  RetrievalOptions,
};
