/**
 * StudyLoG.AI - Character Memory System
 *
 * Based on research from SuperInstance ai-character-integrations.
 * Implements hierarchical memory for AI characters with consolidation.
 */

/**
 * Memory types corresponding to different memory systems
 */
export enum MemoryType {
  WORKING = 'working',           // Current context, short-lived (seconds)
  EPISODIC = 'episodic',         // Specific events and experiences
  SEMANTIC = 'semantic',         // General knowledge and facts
  PROCEDURAL = 'procedural',     // Skills and how-to knowledge
  REFLECTION = 'reflection',     // Meta-cognitive insights
}

/**
 * A single memory stored by a character
 */
export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;            // 0-10, affects retention
  emotionalValence: number;      // -1 (negative) to 1 (positive)
  timestamp: number;
  accessCount: number;           // How often retrieved
  lastAccessed: number;
  tags: string[];                // For categorization
  participants?: string[];       // Other characters/entities involved
  location?: string;             // Where the memory was formed
  metadata?: Record<string, unknown>;
}

/**
 * Memory statistics for a character
 */
export interface MemoryStats {
  totalMemories: number;
  byType: Record<MemoryType, number>;
  averageImportance: number;
  emotionalBalance: number;      // -1 (mostly negative) to 1 (mostly positive)
  mostAccessed: Memory[];
}

/**
 * Narrative generated from episodic memories
 */
export interface CharacterNarrative {
  narrative: string;
  coherenceScore: number;         // 0-1, internal consistency
  keyThemes: string[];
  emotionalArc: number[];         // Emotional journey over time
}

/**
 * Options for memory retrieval
 */
export interface RetrievalOptions {
  types?: MemoryType[];          // Filter by memory types
  minImportance?: number;         // Minimum importance threshold
  tags?: string[];                // Required tags
  participants?: string[];        // Memories involving these characters
  location?: string;              // Memories from this location
  limit?: number;                 // Max results
}

/**
 * Hierarchical Memory System for AI Characters
 *
 * This implements a 6-tier memory system inspired by cognitive science:
 * 1. Working Memory - Current context, very short-lived
 * 2. Episodic Memory - Specific events ("I taught Sarah about neural nets")
 * 3. Semantic Memory - General facts ("Neural networks learn through backpropagation")
 * 4. Procedural Memory - Skills and habits ("How to explain attention mechanisms")
 * 5. Reflection Memory - Meta-cognition ("I'm better at explaining with analogies")
 * 6. Identity Persistence - Core character definition
 */
export class CharacterMemory {
  private memories: Map<string, Memory> = new Map();
  private workingMemories: Memory[] = [];
  private readonly maxWorkingMemories: number = 10;
  private readonly maxEpisodicMemories: number = 1000;
  private readonly consolidationThreshold: number = 20; // Consolidate after N episodic memories
  private nextId: number = 1;

  constructor(
    private readonly characterId: string,
    options?: {
      maxWorkingMemories?: number;
      maxEpisodicMemories?: number;
      consolidationThreshold?: number;
    }
  ) {
    if (options?.maxWorkingMemories) {
      this.maxWorkingMemories = options.maxWorkingMemories;
    }
    if (options?.maxEpisodicMemories) {
      this.maxEpisodicMemories = options.maxEpisodicMemories;
    }
    if (options?.consolidationThreshold) {
      this.consolidationThreshold = options.consolidationThreshold;
    }
  }

  /**
   * Store a working memory (temporary, current context)
   */
  storeWorking(
    content: string,
    importance: number = 5.0,
    emotionalValence: number = 0,
    tags: string[] = []
  ): Memory {
    const memory = this.createMemory(MemoryType.WORKING, content, importance, emotionalValence, tags);

    // Add to working memories, removing oldest if necessary
    this.workingMemories.push(memory);
    if (this.workingMemories.length > this.maxWorkingMemories) {
      const removed = this.workingMemories.shift();
      if (removed) {
        this.memories.delete(removed.id);
      }
    }

    return memory;
  }

  /**
   * Store an episodic memory (specific event/experience)
   */
  storeEpisodic(
    content: string,
    importance: number = 5.0,
    emotionalValence: number = 0,
    options?: {
      tags?: string[];
      participants?: string[];
      location?: string;
      metadata?: Record<string, unknown>;
    }
  ): Memory {
    const memory = this.createMemory(
      MemoryType.EPISODIC,
      content,
      importance,
      emotionalValence,
      options?.tags || []
    );

    if (options?.participants) memory.participants = options.participants;
    if (options?.location) memory.location = options.location;
    if (options?.metadata) memory.metadata = options.metadata;

    this.addMemory(memory);

    // Check if consolidation is needed
    if (this.shouldConsolidateEpisodic()) {
      this.consolidateEpisodicToSemantic();
    }

    return memory;
  }

  /**
   * Store a semantic memory (general knowledge/fact)
   */
  storeSemantic(
    content: string,
    importance: number = 7.0,
    emotionalValence: number = 0,
    tags: string[] = []
  ): Memory {
    return this.addMemory(
      this.createMemory(MemoryType.SEMANTIC, content, importance, emotionalValence, tags)
    );
  }

  /**
   * Store a procedural memory (skill/ability)
   */
  storeProcedural(
    content: string,
    importance: number = 6.0,
    skillLevel: number = 0.5,
    tags: string[] = []
  ): Memory {
    const memory = this.createMemory(
      MemoryType.PROCEDURAL,
      content,
      importance,
      0,
      tags
    );
    memory.metadata = { skillLevel };
    return this.addMemory(memory);
  }

  /**
   * Store a reflection memory (meta-cognitive insight)
   */
  storeReflection(
    content: string,
    importance: number = 8.0,
    tags: string[] = []
  ): Memory {
    return this.addMemory(
      this.createMemory(MemoryType.REFLECTION, content, importance, 0, tags)
    );
  }

  /**
   * Retrieve memories based on semantic similarity and filters
   */
  retrieve(query: string, options?: RetrievalOptions): Memory[] {
    let results = Array.from(this.memories.values());

    // Apply filters
    if (options?.types) {
      results = results.filter(m => options.types!.includes(m.type));
    }
    if (options?.minImportance) {
      results = results.filter(m => m.importance >= options.minImportance!);
    }
    if (options?.tags && options.tags.length > 0) {
      results = results.filter(m =>
        options.tags!.some(tag => m.tags.includes(tag))
      );
    }
    if (options?.participants && options.participants.length > 0) {
      results = results.filter(m =>
        m.participants?.some(p => options.participants!.includes(p))
      );
    }
    if (options?.location) {
      results = results.filter(m => m.location === options.location);
    }

    // Sort by semantic similarity (simple implementation using keyword matching)
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3);

    results.sort((a, b) => {
      const aScore = this.similarityScore(a.content, queryWords);
      const bScore = this.similarityScore(b.content, queryWords);
      return bScore - aScore;
    });

    // Update access counts
    const limit = options?.limit || 10;
    const topResults = results.slice(0, limit);
    for (const memory of topResults) {
      memory.accessCount++;
      memory.lastAccessed = Date.now();
    }

    return topResults;
  }

  /**
   * Get important memories
   */
  getImportant(threshold: number = 7.0, topK: number = 10): Memory[] {
    return Array.from(this.memories.values())
      .filter(m => m.importance >= threshold)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, topK);
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const memories = Array.from(this.memories.values());
    const byType: Record<MemoryType, number> = {
      [MemoryType.WORKING]: 0,
      [MemoryType.EPISODIC]: 0,
      [MemoryType.SEMANTIC]: 0,
      [MemoryType.PROCEDURAL]: 0,
      [MemoryType.REFLECTION]: 0,
    };

    let totalImportance = 0;
    let totalValence = 0;

    for (const memory of memories) {
      byType[memory.type]++;
      totalImportance += memory.importance;
      totalValence += memory.emotionalValence;
    }

    const mostAccessed = [...memories]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);

    return {
      totalMemories: memories.length,
      byType,
      averageImportance: memories.length > 0 ? totalImportance / memories.length : 0,
      emotionalBalance: memories.length > 0 ? totalValence / memories.length : 0,
      mostAccessed,
    };
  }

  /**
   * Check if episodic consolidation is needed
   */
  shouldConsolidateEpisodic(): boolean {
    const episodicCount = Array.from(this.memories.values())
      .filter(m => m.type === MemoryType.EPISODIC).length;
    return episodicCount >= this.consolidationThreshold;
  }

  /**
   * Check if reflection consolidation is needed
   */
  shouldConsolidateReflection(): boolean {
    // Consolidate reflection if we have diverse experiences
    const episodicMemories = Array.from(this.memories.values())
      .filter(m => m.type === MemoryType.EPISODIC);

    if (episodicMemories.length < 10) return false;

    // Check emotional diversity
    const valences = episodicMemories.map(m => m.emotionalValence);
    const hasPositive = valences.some(v => v > 0.3);
    const hasNegative = valences.some(v => v < -0.3);

    return hasPositive && hasNegative;
  }

  /**
   * Consolidate episodic memories into semantic knowledge
   */
  consolidateEpisodicToSemantic(): { inputCount: number; outputCount: number } {
    const episodicMemories = Array.from(this.memories.values())
      .filter(m => m.type === MemoryType.EPISODIC)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 10);

    if (episodicMemories.length < 3) {
      return { inputCount: 0, outputCount: 0 };
    }

    // Extract common themes and create semantic memories
    const themes = this.extractThemes(episodicMemories);
    let outputCount = 0;

    for (const theme of themes) {
      this.storeSemantic(
        theme.pattern,
        6.0,
        0,
        ['consolidated', ...theme.tags]
      );
      outputCount++;
    }

    // Mark consolidated episodic memories as processed
    for (const memory of episodicMemories) {
      memory.metadata = { ...memory.metadata, consolidated: true };
    }

    return { inputCount: episodicMemories.length, outputCount };
  }

  /**
   * Generate a narrative from episodic memories
   */
  generateNarrative(): CharacterNarrative {
    const episodicMemories = Array.from(this.memories.values())
      .filter(m => m.type === MemoryType.EPISODIC)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (episodicMemories.length === 0) {
      return {
        narrative: `${this.characterId} has no experiences to narrate yet.`,
        coherenceScore: 1,
        keyThemes: [],
        emotionalArc: [],
      };
    }

    // Build narrative from memories
    const narrativeParts: string[] = [];
    const keyThemes = new Set<string>();
    const emotionalArc: number[] = [];

    for (const memory of episodicMemories) {
      narrativeParts.push(memory.content);
      memory.tags.forEach(tag => keyThemes.add(tag));
      emotionalArc.push(memory.emotionalValence);
    }

    // Calculate coherence (simplified - based on theme consistency)
    const coherenceScore = this.calculateCoherence(episodicMemories);

    return {
      narrative: narrativeParts.join('. ') + '.',
      coherenceScore,
      keyThemes: Array.from(keyThemes).slice(0, 5),
      emotionalArc,
    };
  }

  /**
   * Clear all memories (for testing or character reset)
   */
  clear(): void {
    this.memories.clear();
    this.workingMemories = [];
  }

  /**
   * Export memories to JSON (for persistence)
   */
  export(): Record<string, Memory> {
    const result: Record<string, Memory> = {};
    for (const [id, memory] of this.memories.entries()) {
      result[id] = { ...memory };
    }
    return result;
  }

  /**
   * Import memories from JSON
   */
  import(data: Record<string, Memory>): void {
    for (const [id, memory] of Object.entries(data)) {
      this.memories.set(id, { ...memory });
    }
  }

  // Private helper methods

  private createMemory(
    type: MemoryType,
    content: string,
    importance: number,
    emotionalValence: number,
    tags: string[]
  ): Memory {
    return {
      id: `${this.characterId}_mem_${this.nextId++}`,
      type,
      content,
      importance: Math.max(0, Math.min(10, importance)),
      emotionalValence: Math.max(-1, Math.min(1, emotionalValence)),
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      tags,
    };
  }

  private addMemory(memory: Memory): Memory {
    this.memories.set(memory.id, memory);

    // Enforce episodic memory limit
    if (memory.type === MemoryType.EPISODIC) {
      const episodicMemories = Array.from(this.memories.values())
        .filter(m => m.type === MemoryType.EPISODIC);

      if (episodicMemories.length > this.maxEpisodicMemories) {
        // Remove least important episodic memories
        episodicMemories
          .sort((a, b) => a.importance - b.importance)
          .slice(0, episodicMemories.length - this.maxEpisodicMemories)
          .forEach(m => this.memories.delete(m.id));
      }
    }

    return memory;
  }

  private similarityScore(content: string, queryWords: string[]): number {
    const contentLower = content.toLowerCase();
    let matches = 0;
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matches++;
      }
    }
    return matches / queryWords.length;
  }

  private extractThemes(memories: Memory[]): Array<{ pattern: string; tags: string[] }> {
    // Simplified theme extraction - in production use more sophisticated NLP
    const themes: Array<{ pattern: string; tags: string[] }> = [];

    // Group by tags
    const tagGroups = new Map<string, Memory[]>();
    for (const memory of memories) {
      for (const tag of memory.tags) {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag)!.push(memory);
      }
    }

    // Create patterns from tag groups
    for (const [tag, groupMemories] of tagGroups.entries()) {
      if (groupMemories.length >= 2) {
        const avgImportance = groupMemories.reduce((sum, m) => sum + m.importance, 0) / groupMemories.length;
        themes.push({
          pattern: `Learned about ${tag} through multiple interactions`,
          tags: [tag],
        });
      }
    }

    return themes;
  }

  private calculateCoherence(memories: Memory[]): number {
    if (memories.length < 2) return 1;

    // Check for theme consistency
    const allTags = new Set<string>();
    for (const memory of memories) {
      memory.tags.forEach(tag => allTags.add(tag));
    }

    // Higher coherence if memories share themes
    let sharedCount = 0;
    for (const memory of memories) {
      for (const tag of memory.tags) {
        let othersWithTag = 0;
        for (const other of memories) {
          if (other !== memory && other.tags.includes(tag)) {
            othersWithTag++;
          }
        }
        if (othersWithTag > 0) sharedCount++;
      }
    }

    return Math.min(1, sharedCount / (memories.length * 2));
  }
}
