/**
 * StudyLoG.AI Memory System - 6-Tier Hierarchical Memory
 *
 * Implements the core memory hierarchy with all six tiers:
 * 1. Working Memory (0-1 hr) - Current context, LLM context window
 * 2. Episodic Memory (1-6 hr) - "What/When/Where" learning events
 * 3. Semantic Memory (1+ wk) - Patterns, facts, concepts learned
 * 4. Procedural Memory - Skills: coding, problem-solving
 * 5. Reflection Memory - Metacognition, learning strategies
 * 6. Identity Memory - Core traits, persistent self-model
 *
 * Features:
 * - Priority-based eviction from working memory
 * - Half-life decay for time-based importance reduction
 * - Multi-indexed episodic memory for fast retrieval
 * - Vector embeddings for semantic similarity
 * - Mastery progression with practice-based improvement
 * - Consolidation triggers between tiers
 */

import {
  BaseMemory,
  MemoryTier,
  MemoryImportance,
  MasteryLevel,
  WorkingMemoryItem,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemory,
  IdentityMemory,
  Memory as MemoryType,
  EpisodicContext,
  EmotionalValence,
  MemorySystemConfig,
  DEFAULT_MEMORY_CONFIG,
  MemorySystemEvent,
  MemoryEventHandler,
  EventListener,
  isWorkingMemory,
  isEpisodicMemory,
  isSemanticMemory,
  isProceduralMemory,
  isReflectionMemory,
  isIdentityMemory,
  ReflectionType,
  IdentityTraitType
} from './types.js';

// ============================================================================
// Working Memory Implementation
// ============================================================================

/**
 * Working Memory - Short-term cognitive workspace
 *
 * Characteristics:
 * - Capacity-limited (default: 20 items)
 * - Time-based decay (default: 30 min half-life)
 * - Priority-based eviction (importance + access count)
 * - O(1) access using Map
 */
export class WorkingMemory {
  private _items: Map<string, WorkingMemoryItem>;
  private _capacity: number;
  private _decayDuration: number;
  private _decayHalfLife: number;
  private _eventHandlers: Set<MemoryEventHandler>;

  constructor(
    capacity: number = DEFAULT_MEMORY_CONFIG.workingCapacity,
    decayDuration: number = DEFAULT_MEMORY_CONFIG.workingDecayDuration,
    decayHalfLife: number = DEFAULT_MEMORY_CONFIG.workingHalfLife
  ) {
    this._items = new Map();
    this._capacity = capacity;
    this._decayDuration = decayDuration;
    this._decayHalfLife = decayHalfLife;
    this._eventHandlers = new Set();
  }

  /**
   * Add an item to working memory
   * Evicts lowest-priority item if at capacity
   */
  add(
    id: string,
    content: string,
    importance: MemoryImportance = MemoryImportance.ROUTINE,
    metadata: Record<string, unknown> = {}
  ): WorkingMemoryItem {
    const now = Date.now();
    const item: WorkingMemoryItem = {
      id,
      tier: MemoryTier.WORKING,
      content,
      importance,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0,
      tags: [],
      metadata,
      decayed: false,
      decayDuration: this._decayDuration,
      originalImportance: importance
    };

    // Check if we need to evict
    if (this._items.size >= this._capacity && !this._items.has(id)) {
      this._evictOne();
    }

    this._items.set(id, item);
    this._emit({ type: 'memory_created', memoryId: id, tier: MemoryTier.WORKING, timestamp: now });

    return item;
  }

  /**
   * Get an item from working memory
   * Updates access count and last accessed time
   */
  get(id: string): WorkingMemoryItem | null {
    const item = this._items.get(id);
    if (item) {
      item.accessCount++;
      item.lastAccessed = Date.now();
      item.decyed = this._isDecayed(item);
      this._emit({ type: 'memory_accessed', memoryId: id, tier: MemoryTier.WORKING, accessCount: item.accessCount, timestamp: item.lastAccessed });
      return item;
    }
    return null;
  }

  /**
   * Check if an item exists
   */
  has(id: string): boolean {
    return this._items.has(id);
  }

  /**
   * Remove an item from working memory
   */
  remove(id: string): boolean {
    return this._items.delete(id);
  }

  /**
   * Get all items in working memory
   */
  items(): WorkingMemoryItem[] {
    return Array.from(this._items.values());
  }

  /**
   * Get current usage statistics
   */
  stats(): { count: number; capacity: number; decayedCount: number } {
    const items = this.items();
    const decayedCount = items.filter(item => this._isDecayed(item)).length;
    return { count: items.length, capacity: this._capacity, decayedCount };
  }

  /**
   * Clear all items from working memory
   */
  clear(): void {
    this._items.clear();
  }

  /**
   * Get decayed items for consolidation
   */
  getDecayedItems(): WorkingMemoryItem[] {
    return this.items().filter(item => this._isDecayed(item));
  }

  /**
   * Get items above importance threshold for consolidation
   */
  getItemsAboveThreshold(threshold: number): WorkingMemoryItem[] {
    return this.items().filter(item => {
      const effectiveImportance = this._getEffectiveImportance(item);
      return effectiveImportance >= threshold;
    });
  }

  /**
   * Check if an item is decayed
   */
  private _isDecayed(item: WorkingMemoryItem): boolean {
    const age = Date.now() - item.createdAt;
    return age > this._decayDuration;
  }

  /**
   * Calculate effective importance with decay
   */
  private _getEffectiveImportance(item: WorkingMemoryItem): number {
    if (!this._isDecayed(item)) {
      return item.importance;
    }
    const age = Date.now() - item.createdAt;
    const decayFactor = Math.pow(0.5, age / this._decayHalfLife);
    return item.importance * decayFactor;
  }

  /**
   * Evict the lowest-priority item
   * Priority: (decayed first) -> (lowest importance) -> (lowest access count)
   */
  private _evictOne(): void {
    let lowestId: string | null = null;
    let lowestPriority: [number, number, number] | null = null; // [isDecayed, -importance, -accessCount]

    for (const [id, item] of this._items.entries()) {
      const isDecayed = this._isDecayed(item) ? 0 : 1; // Evict decayed first
      const effectiveImportance = this._getEffectiveImportance(item);
      const priority: [number, number, number] = [
        isDecayed,
        -effectiveImportance,
        -item.accessCount
      ];

      if (!lowestPriority || this._comparePriority(priority, lowestPriority) < 0) {
        lowestPriority = priority;
        lowestId = id;
      }
    }

    if (lowestId) {
      this._items.delete(lowestId);
      this._emit({ type: 'memory_forgotten', memoryId: lowestId, tier: MemoryTier.WORKING, reason: 'eviction', timestamp: Date.now() });
    }
  }

  /**
   * Compare two priority tuples (lower = evicted first)
   */
  private _comparePriority(a: [number, number, number], b: [number, number, number]): number {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    return a[2] - b[2];
  }

  /**
   * Register event handler
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private _emit(event: MemorySystemEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    }
  }
}

// ============================================================================
// Episodic Memory Implementation
// ============================================================================

/**
 * Episodic Memory - Autobiographical learning events
 *
 * Characteristics:
 * - Stores "what/when/where" of learning events
 * - Multi-indexed (time, location, participants, emotion)
 * - Emotional valence tagging (-1 to +1)
 * - Contextual information (module, lesson, difficulty)
 * - Importance-based eviction with age penalty
 */
export class EpisodicMemory {
  private _memories: Map<string, EpisodicMemory>;
  private _byTime: Array<[number, string]>; // [timestamp, id]
  private _byLocation: Map<string, string[]>; // location -> [ids]
  private _byParticipant: Map<string, string[]>; // participant -> [ids]
  private _byEmotion: Array<[EmotionalValence, string]>; // [valence, id]
  private _capacity: number;
  private _decayEnabled: boolean;
  private _eventHandlers: Set<MemoryEventHandler>;

  constructor(
    capacity: number = DEFAULT_MEMORY_CONFIG.episodicCapacity,
    decayEnabled: boolean = DEFAULT_MEMORY_CONFIG.episodicDecayEnabled
  ) {
    this._memories = new Map();
    this._byTime = [];
    this._byLocation = new Map();
    this._byParticipant = new Map();
    this._byEmotion = [];
    this._capacity = capacity;
    this._decayEnabled = decayEnabled;
    this._eventHandlers = new Set();
  }

  /**
   * Add an episodic memory
   */
  add(
    id: string,
    content: string,
    context: EpisodicContext,
    options: {
      importance?: MemoryImportance;
      emotionalValence?: EmotionalValence;
      location?: string;
      participants?: string[];
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): EpisodicMemory {
    const now = Date.now();
    const memory: EpisodicMemory = {
      id,
      tier: MemoryTier.EPISODIC,
      content,
      importance: options.importance ?? MemoryImportance.NOTABLE,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
      timestamp: now,
      location: options.location,
      emotionalValence: options.emotionalValence ?? 0,
      participants: options.participants,
      context,
      consolidated: false,
      relatedEventIds: []
    };

    // Check capacity
    if (this._memories.size >= this._capacity) {
      this._evictByImportance();
    }

    this._memories.set(id, memory);

    // Update indexes
    this._byTime.push([now, id]);
    this._byTime.sort((a, b) => a[0] - b[0]);

    if (memory.location) {
      if (!this._byLocation.has(memory.location)) {
        this._byLocation.set(memory.location, []);
      }
      this._byLocation.get(memory.location)!.push(id);
    }

    for (const participant of memory.participants ?? []) {
      if (!this._byParticipant.has(participant)) {
        this._byParticipant.set(participant, []);
      }
      this._byParticipant.get(participant)!.push(id);
    }

    this._byEmotion.push([memory.emotionalValence, id]);

    this._emit({ type: 'memory_created', memoryId: id, tier: MemoryTier.EPISODIC, timestamp: now });

    return memory;
  }

  /**
   * Get an episodic memory by ID
   */
  get(id: string): EpisodicMemory | null {
    const memory = this._memories.get(id);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = Date.now();
      this._emit({ type: 'memory_accessed', memoryId: id, tier: MemoryTier.EPISODIC, accessCount: memory.accessCount, timestamp: memory.lastAccessed });
      return memory;
    }
    return null;
  }

  /**
   * Search memories by time range
   */
  searchByTime(startTime: number, endTime: number): EpisodicMemory[] {
    const results: EpisodicMemory[] = [];
    for (const [timestamp, id] of this._byTime) {
      if (timestamp >= startTime && timestamp <= endTime) {
        const memory = this._memories.get(id);
        if (memory) results.push(memory);
      }
    }
    return results;
  }

  /**
   * Search memories by location
   */
  searchByLocation(location: string): EpisodicMemory[] {
    const ids = this._byLocation.get(location) ?? [];
    return ids.map(id => this._memories.get(id)!).filter(Boolean);
  }

  /**
   * Search memories by participant
   */
  searchByParticipant(participant: string): EpisodicMemory[] {
    const ids = this._byParticipant.get(participant) ?? [];
    return ids.map(id => this._memories.get(id)!).filter(Boolean);
  }

  /**
   * Search memories by emotional range
   */
  searchByEmotion(minValence: EmotionalValence, maxValence: EmotionalValence): EpisodicMemory[] {
    const results: EpisodicMemory[] = [];
    for (const [valence, id] of this._byEmotion) {
      if (valence >= minValence && valence <= maxValence) {
        const memory = this._memories.get(id);
        if (memory) results.push(memory);
      }
    }
    return results;
  }

  /**
   * Search memories by importance threshold
   */
  searchByImportance(minImportance: MemoryImportance): EpisodicMemory[] {
    return Array.from(this._memories.values()).filter(
      m => m.importance >= minImportance
    );
  }

  /**
   * Search memories by context
   */
  searchByContext(contextKey: keyof EpisodicContext, value: unknown): EpisodicMemory[] {
    return Array.from(this._memories.values()).filter(
      m => m.context[contextKey] === value
    );
  }

  /**
   * Get all memories
   */
  getAll(): EpisodicMemory[] {
    return Array.from(this._memories.values());
  }

  /**
   * Mark a memory as consolidated
   */
  markConsolidated(id: string, targetTier: MemoryTier): void {
    const memory = this._memories.get(id);
    if (memory) {
      memory.consolidated = true;
      this._emit({
        type: 'memory_consolidated',
        fromTier: MemoryTier.EPISODIC,
        toTier: targetTier,
        sourceMemoryId: id,
        newMemoryIds: [],
        timestamp: Date.now()
      });
    }
  }

  /**
   * Link related events
   */
  linkEvents(eventId1: string, eventId2: string): void {
    const mem1 = this._memories.get(eventId1);
    const mem2 = this._memories.get(eventId2);
    if (mem1 && mem2) {
      if (!mem1.relatedEventIds.includes(eventId2)) {
        mem1.relatedEventIds.push(eventId2);
      }
      if (!mem2.relatedEventIds.includes(eventId1)) {
        mem2.relatedEventIds.push(eventId1);
      }
    }
  }

  /**
   * Get statistics
   */
  stats(): {
    total: number;
    byModule: Record<string, number>;
    avgEmotionalValence: number;
    highImportanceCount: number;
  } {
    const memories = this.getAll();
    const byModule: Record<string, number> = {};
    let totalEmotion = 0;
    let highImportance = 0;

    for (const m of memories) {
      const module = m.context.module ?? 'unknown';
      byModule[module] = (byModule[module] ?? 0) + 1;
      totalEmotion += m.emotionalValence;
      if (m.importance >= MemoryImportance.SIGNIFICANT) {
        highImportance++;
      }
    }

    return {
      total: memories.length,
      byModule,
      avgEmotionalValence: memories.length > 0 ? totalEmotion / memories.length : 0,
      highImportanceCount: highImportance
    };
  }

  /**
   * Evict lowest importance memory (with age penalty)
   */
  private _evictByImportance(): void {
    const now = Date.now();
    let lowestId: string | null = null;
    let lowestScore = Infinity;

    for (const [id, memory] of this._memories.entries()) {
      if (memory.importance >= MemoryImportance.CORE_IDENTITY) {
        continue; // Never evict core identity memories
      }

      const ageDays = (now - memory.timestamp) / (24 * 60 * 60 * 1000);
      const agePenalty = ageDays / 10;
      const score = memory.importance + (memory.accessCount * 0.05) - agePenalty;

      if (score < lowestScore) {
        lowestScore = score;
        lowestId = id;
      }
    }

    if (lowestId) {
      this._memories.delete(lowestId);
      this._emit({ type: 'memory_forgotten', memoryId: lowestId, tier: MemoryTier.EPISODIC, reason: 'capacity_limit', timestamp: now });
    }
  }

  /**
   * Register event handler
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private _emit(event: MemorySystemEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    }
  }
}

// ============================================================================
// Semantic Memory Implementation
// ============================================================================

/**
 * Semantic Memory - Concepts and general knowledge
 *
 * Characteristics:
 * - Vector embeddings for similarity search
 * - Concept hierarchies (parent-child relationships)
 * - Associations between concepts
 * - Confidence scores for knowledge certainty
 * - Abstraction levels (concrete to abstract)
 * - No decay (knowledge persists)
 */
export class SemanticMemory {
  private _concepts: Map<string, SemanticMemory>;
  private _embeddingDim: number;
  private _similarityThreshold: number;
  private _eventHandlers: Set<MemoryEventHandler>;

  constructor(
    embeddingDim: number = DEFAULT_MEMORY_CONFIG.semanticEmbeddingDim,
    similarityThreshold: number = DEFAULT_MEMORY_CONFIG.semanticSimilarityThreshold
  ) {
    this._concepts = new Map();
    this._embeddingDim = embeddingDim;
    this._similarityThreshold = similarityThreshold;
    this._eventHandlers = new Set();
  }

  /**
   * Add or update a concept
   */
  addConcept(
    id: string,
    conceptName: string,
    attributes: Record<string, unknown> = {},
    options: {
      embedding?: number[];
      confidence?: number;
      abstractionLevel?: number;
      sourceEventIds?: string[];
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): SemanticMemory {
    const now = Date.now();
    const existing = this._concepts.get(id);

    const concept: SemanticMemory = existing ?? {
      id,
      tier: MemoryTier.SEMANTIC,
      content: `Concept: ${conceptName}`,
      importance: MemoryImportance.NOTABLE,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastAccessed: existing?.lastAccessed ?? now,
      accessCount: existing?.accessCount ?? 0,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
      conceptName,
      attributes,
      associations: new Set(existing?.associations ?? []),
      parentConcepts: [],
      childConcepts: [],
      confidence: options.confidence ?? (existing?.confidence ?? 0.5),
      abstractionLevel: options.abstractionLevel ?? 0.5,
      sourceEventIds: options.sourceEventIds ?? []
    };

    this._concepts.set(id, concept);

    if (!existing) {
      this._emit({ type: 'memory_created', memoryId: id, tier: MemoryTier.SEMANTIC, timestamp: now });
    }

    return concept;
  }

  /**
   * Get a concept by ID
   */
  get(id: string): SemanticMemory | null {
    const concept = this._concepts.get(id);
    if (concept) {
      concept.accessCount++;
      concept.lastAccessed = Date.now();
      return concept;
    }
    return null;
  }

  /**
   * Get a concept by name
   */
  getByName(conceptName: string): SemanticMemory | null {
    for (const concept of this._concepts.values()) {
      if (concept.conceptName === conceptName) {
        return this.get(concept.id);
      }
    }
    return null;
  }

  /**
   * Similarity search using embeddings
   */
  similaritySearch(queryEmbedding: number[], topK: number = 10): Array<{ id: string; name: string; similarity: number }> {
    const results: Array<{ id: string; name: string; similarity: number }> = [];

    // Normalize query
    const queryNorm = this._normalize(queryEmbedding);

    for (const [id, concept] of this._concepts.entries()) {
      if (concept.embedding) {
        const conceptNorm = this._normalize(concept.embedding);
        const similarity = this._cosineSimilarity(queryNorm, conceptNorm);

        if (similarity >= this._similarityThreshold) {
          results.push({ id, name: concept.conceptName, similarity });
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
  }

  /**
   * Keyword search in concept names and attributes
   */
  keywordSearch(query: string, topK: number = 10): Array<{ id: string; name: string; score: number }> {
    const queryLower = query.toLowerCase();
    const results: Array<{ id: string; name: string; score: number }> = [];

    for (const [id, concept] of this._concepts.entries()) {
      let score = 0;

      // Name match
      if (concept.conceptName.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Content match
      if (concept.content.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Attribute match
      for (const [key, value] of Object.entries(concept.attributes)) {
        if (key.toLowerCase().includes(queryLower) ||
            String(value).toLowerCase().includes(queryLower)) {
          score += 2;
        }
      }

      if (score > 0) {
        results.push({ id, name: concept.conceptName, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Add association between concepts
   */
  addAssociation(conceptId1: string, conceptId2: string): void {
    const concept1 = this._concepts.get(conceptId1);
    const concept2 = this._concepts.get(conceptId2);

    if (concept1 && concept2) {
      concept1.associations.add(conceptId2);
      concept2.associations.add(conceptId1);
    }
  }

  /**
   * Set parent-child relationship
   */
  setHierarchy(parentId: string, childId: string): void {
    const parent = this._concepts.get(parentId);
    const child = this._concepts.get(childId);

    if (parent && child) {
      if (!parent.childConcepts.includes(childId)) {
        parent.childConcepts.push(childId);
      }
      if (!child.parentConcepts.includes(parentId)) {
        child.parentConcepts.push(parentId);
      }
    }
  }

  /**
   * Get associative search results (graph traversal)
   */
  associativeSearch(
    seedConceptId: string,
    maxDepth: number = 2,
    maxResults: number = 20
  ): Array<{ id: string; name: string; depth: number; score: number }> {
    const results: Array<{ id: string; name: string; depth: number; score: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: seedConceptId, depth: 0 }];

    while (queue.length > 0 && results.length < maxResults) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth > maxDepth) {
        continue;
      }

      visited.add(id);
      const concept = this._concepts.get(id);
      if (concept) {
        const score = 1 - (depth * 0.2);
        results.push({ id, name: concept.conceptName, depth, score });

        // Add associations to queue
        for (const assocId of concept.associations) {
          if (!visited.has(assocId)) {
            queue.push({ id: assocId, depth: depth + 1 });
          }
        }
      }
    }

    return results;
  }

  /**
   * Update concept embedding
   */
  updateEmbedding(conceptId: string, embedding: number[]): void {
    const concept = this._concepts.get(conceptId);
    if (concept) {
      concept.embedding = embedding;
      concept.updatedAt = Date.now();
    }
  }

  /**
   * Get concept hierarchy tree
   */
  getHierarchy(rootId: string): Record<string, unknown> | null {
    const concept = this._concepts.get(rootId);
    if (!concept) return null;

    return {
      id: concept.id,
      name: concept.conceptName,
      confidence: concept.confidence,
      children: concept.childConcepts.map(childId => this.getHierarchy(childId)).filter(Boolean)
    };
  }

  /**
   * Get all concepts
   */
  getAll(): SemanticMemory[] {
    return Array.from(this._concepts.values());
  }

  /**
   * Get statistics
   */
  stats(): {
    totalConcepts: number;
    avgConfidence: number;
    totalAssociations: number;
    byAbstraction: Record<string, number>;
  } {
    const concepts = this.getAll();
    let totalConfidence = 0;
    let totalAssociations = 0;
    const byAbstraction: Record<string, number> = {
      low: 0,      // 0-0.33
      medium: 0,   // 0.34-0.66
      high: 0      // 0.67-1.0
    };

    for (const c of concepts) {
      totalConfidence += c.confidence;
      totalAssociations += c.associations.size;

      if (c.abstractionLevel < 0.34) byAbstraction.low++;
      else if (c.abstractionLevel < 0.67) byAbstraction.medium++;
      else byAbstraction.high++;
    }

    return {
      totalConcepts: concepts.length,
      avgConfidence: concepts.length > 0 ? totalConfidence / concepts.length : 0,
      totalAssociations,
      byAbstraction
    };
  }

  /**
   * Normalize vector
   */
  private _normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vec;
    return vec.map(v => v / norm);
  }

  /**
   * Calculate cosine similarity
   */
  private _cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
    }
    return dotProduct;
  }

  /**
   * Register event handler
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private _emit(event: MemorySystemEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    }
  }
}

// ============================================================================
// Procedural Memory Implementation
// ============================================================================

/**
 * Procedural Memory - Skills and abilities
 *
 * Characteristics:
 * - 6 mastery levels (Novice to Master)
 * - Practice-based improvement with diminishing returns
 * - Skill prerequisites and dependencies
 * - Optional exponential decay (5% per day)
 * - Performance history tracking
 */
export class ProceduralMemory {
  private _skills: Map<string, ProceduralMemory>;
  private _decayRate: number;
  private _masteryDecayEnabled: boolean;
  private _eventHandlers: Set<MemoryEventHandler>;

  // Mastery requirements
  private readonly _practiceThreshold = 10;
  private readonly _successRateRequirements: Record<MasteryLevel, number> = {
    [MasteryLevel.NOVICE]: 0,
    [MasteryLevel.APPRENTICE]: 0.55,
    [MasteryLevel.COMPETENT]: 0.60,
    [MasteryLevel.PROFICIENT]: 0.65,
    [MasteryLevel.EXPERT]: 0.70,
    [MasteryLevel.MASTER]: 0.75
  };

  constructor(
    decayRate: number = DEFAULT_MEMORY_CONFIG.proceduralDecayRate,
    masteryDecay: boolean = DEFAULT_MEMORY_CONFIG.proceduralMasteryDecay
  ) {
    this._skills = new Map();
    this._decayRate = decayRate;
    this._masteryDecayEnabled = masteryDecay;
    this._eventHandlers = new Set();
  }

  /**
   * Add or update a skill
   */
  addSkill(
    id: string,
    skillName: string,
    category: string,
    options: {
      prerequisites?: string[];
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): ProceduralMemory {
    const now = Date.now();
    const existing = this._skills.get(id);

    const skill: ProceduralMemory = existing ?? {
      id,
      tier: MemoryTier.PROCEDURAL,
      content: `Skill: ${skillName}`,
      importance: MemoryImportance.NOTABLE,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastAccessed: existing?.lastAccessed ?? now,
      accessCount: existing?.accessCount ?? 0,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
      skillName,
      category,
      masteryLevel: MasteryLevel.NOVICE,
      practiceCount: 0,
      successCount: 0,
      lastPracticed: now,
      prerequisiteSkills: options.prerequisites ?? [],
      dependentSkills: [],
      practiceHistory: [],
      improvementCurve: []
    };

    this._skills.set(id, skill);

    if (!existing) {
      this._emit({ type: 'memory_created', memoryId: id, tier: MemoryTier.PROCEDURAL, timestamp: now });
    }

    return skill;
  }

  /**
   * Practice a skill
   */
  practice(
    skillId: string,
    success: boolean,
    quality: number = 0.5,
    timeSpent: number = 1,
    context: string = ''
  ): {
    newLevel: MasteryLevel;
    improvement: number;
    canAdvance: boolean;
  } {
    const skill = this._skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    const now = Date.now();
    skill.practiceCount++;

    if (success) {
      skill.successCount++;
    }

    // Calculate improvement with diminishing returns
    const improvement = (0.1 * quality) / (1 + 0.1 * skill.practiceCount);

    // Record practice
    const practiceRecord = {
      timestamp: now,
      success,
      quality,
      timeSpent,
      context,
      improvement
    };
    skill.practiceHistory.push(practiceRecord);
    skill.lastPracticed = now;
    skill.lastAccessed = now;
    skill.accessCount++;

    // Update mastery level if eligible
    const currentLevel = skill.masteryLevel;
    const newLevel = this._calculateNewLevel(skill);
    const levelChanged = newLevel !== currentLevel;

    if (levelChanged) {
      skill.masteryLevel = newLevel;
    }

    // Update improvement curve
    const currentMastery = this.getMastery(skillId);
    skill.improvementCurve.push(currentMastery);

    return {
      newLevel,
      improvement,
      canAdvance: this.canAdvanceTo(skillId, this._getNextLevel(newLevel))
    };
  }

  /**
   * Get current mastery level for a skill
   */
  getMasteryLevel(skillId: string): MasteryLevel {
    const skill = this._skills.get(skillId);
    return skill?.masteryLevel ?? MasteryLevel.NOVICE;
  }

  /**
   * Get numeric mastery value (0-1) with decay applied
   */
  getMastery(skillId: string): number {
    const skill = this._skills.get(skillId);
    if (!skill) return 0;

    const baseMastery = skill.masteryLevel / 6; // Normalize to 0-1

    if (!this._masteryDecayEnabled) {
      return baseMastery;
    }

    const daysSincePractice = (Date.now() - skill.lastPracticed) / (24 * 60 * 60 * 1000);
    const decayFactor = Math.exp(-this._decayRate * daysSincePractice);

    return baseMastery * decayFactor;
  }

  /**
   * Check if prerequisites are met for a skill
   */
  prerequisitesMet(skillId: string): boolean {
    const skill = this._skills.get(skillId);
    if (!skill || skill.prerequisiteSkills.length === 0) {
      return true;
    }

    return skill.prerequisiteSkills.every(prereqId => {
      const prereq = this._skills.get(prereqId);
      return prereq && prereq.masteryLevel >= MasteryLevel.COMPETENT;
    });
  }

  /**
   * Check if can perform a skill at minimum level
   */
  canPerform(skillId: string, minLevel: MasteryLevel = MasteryLevel.COMPETENT): boolean {
    const mastery = this.getMasteryLevel(skillId);
    return mastery >= minLevel && this.prerequisitesMet(skillId);
  }

  /**
   * Check if can advance to next level
   */
  canAdvanceTo(skillId: string, targetLevel: MasteryLevel): boolean {
    const skill = this._skills.get(skillId);
    if (!skill) return false;

    const currentLevel = skill.masteryLevel;
    if (targetLevel <= currentLevel) return false;

    // Check practice count
    const requiredPractices = this._practiceThreshold * targetLevel;
    if (skill.practiceCount < requiredPractices) return false;

    // Check success rate
    const requiredSuccessRate = this._successRateRequirements[targetLevel];
    const currentSuccessRate = skill.practiceCount > 0
      ? skill.successCount / skill.practiceCount
      : 0;
    if (currentSuccessRate < requiredSuccessRate) return false;

    // Check prerequisites
    return this.prerequisitesMet(skillId);
  }

  /**
   * Get practice schedule to reach target mastery
   */
  getPracticeSchedule(skillId: string, targetMastery: MasteryLevel): Record<string, number> {
    const skill = this._skills.get(skillId);
    if (!skill) return {};

    const schedule: Record<string, number> = {};
    let target = skill.masteryLevel + 1;

    while (target <= targetMastery) {
      const requiredPractices = this._practiceThreshold * target;
      const remaining = Math.max(0, requiredPractices - skill.practiceCount);
      schedule[`level_${target}`] = remaining;
      target++;
    }

    return schedule;
  }

  /**
   * Get neglected skills (not practiced in specified days)
   */
  getNeglectedSkills(days: number = 7): Array<{ id: string; name: string; daysSincePractice: number }> {
    const now = Date.now();
    const threshold = days * 24 * 60 * 60 * 1000;
    const neglected: Array<{ id: string; name: string; daysSincePractice: number }> = [];

    for (const skill of this._skills.values()) {
      const daysSince = now - skill.lastPracticed;
      if (daysSince > threshold) {
        neglected.push({
          id: skill.id,
          name: skill.skillName,
          daysSincePractice: Math.floor(daysSince / (24 * 60 * 60 * 1000))
        });
      }
    }

    return neglected.sort((a, b) => b.daysSincePractice - a.daysSincePractice);
  }

  /**
   * Get top skills by mastery
   */
  getTopSkills(limit: number = 10): Array<{ id: string; name: string; mastery: number; level: MasteryLevel }> {
    const skills = Array.from(this._skills.values()).map(skill => ({
      id: skill.id,
      name: skill.skillName,
      mastery: this.getMastery(skill.id),
      level: skill.masteryLevel
    }));

    return skills.sort((a, b) => b.mastery - a.mastery).slice(0, limit);
  }

  /**
   * Get skill by ID
   */
  get(skillId: string): ProceduralMemory | null {
    const skill = this._skills.get(skillId);
    if (skill) {
      skill.accessCount++;
      skill.lastAccessed = Date.now();
      return skill;
    }
    return null;
  }

  /**
   * Get skill by name
   */
  getByName(skillName: string): ProceduralMemory | null {
    for (const skill of this._skills.values()) {
      if (skill.skillName === skillName) {
        return this.get(skill.id);
      }
    }
    return null;
  }

  /**
   * Get all skills in a category
   */
  getByCategory(category: string): ProceduralMemory[] {
    return Array.from(this._skills.values()).filter(
      skill => skill.category === category
    );
  }

  /**
   * Get forgetting curve for a skill
   */
  getForgettingCurve(skillId: string, days: number = 30): Array<{ day: number; mastery: number }> {
    const skill = this._skills.get(skillId);
    if (!skill) return [];

    const baseMastery = skill.masteryLevel / 6;
    const curve: Array<{ day: number; mastery: number }> = [];

    for (let day = 0; day <= days; day++) {
      const decay = Math.exp(-this._decayRate * day);
      curve.push({ day, mastery: baseMastery * decay });
    }

    return curve;
  }

  /**
   * Get all skills
   */
  getAll(): ProceduralMemory[] {
    return Array.from(this._skills.values());
  }

  /**
   * Get statistics
   */
  stats(): {
    totalSkills: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    avgPractices: number;
    totalPractices: number;
  } {
    const skills = this.getAll();
    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalPractices = 0;

    for (const s of skills) {
      const levelName = MasteryLevel[s.masteryLevel];
      byLevel[levelName] = (byLevel[levelName] ?? 0) + 1;
      byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
      totalPractices += s.practiceCount;
    }

    return {
      totalSkills: skills.length,
      byLevel,
      byCategory,
      avgPractices: skills.length > 0 ? totalPractices / skills.length : 0,
      totalPractices
    };
  }

  /**
   * Calculate new mastery level based on practice
   */
  private _calculateNewLevel(skill: ProceduralMemory): MasteryLevel {
    const currentLevel = skill.masteryLevel;
    let nextLevel = currentLevel + 1;

    while (nextLevel <= MasteryLevel.MASTER) {
      if (this.canAdvanceTo(skill.id, nextLevel)) {
        currentLevel = nextLevel;
        nextLevel++;
      } else {
        break;
      }
    }

    return currentLevel;
  }

  /**
   * Get next mastery level
   */
  private _getNextLevel(current: MasteryLevel): MasteryLevel {
    return Math.min(current + 1, MasteryLevel.MASTER);
  }

  /**
   * Register event handler
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private _emit(event: MemorySystemEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    }
  }
}

// ============================================================================
// Reflection Memory Implementation
// ============================================================================

/**
 * Reflection Memory - Metacognitive insights
 *
 * Characteristics:
 * - Stores learning strategies and insights
 * - Tracks effectiveness of approaches
 * - Identifies misconceptions corrected
 * - Recognizes patterns in learning
 * - Records blocker identification
 */
export class ReflectionMemoryStore {
  private _reflections: Map<string, ReflectionMemory>;
  private _eventHandlers: Set<MemoryEventHandler>;

  constructor() {
    this._reflections = new Map();
    this._eventHandlers = new Set();
  }

  /**
   * Add a reflection
   */
  addReflection(
    id: string,
    reflectionType: ReflectionType,
    subject: string,
    insight: string,
    options: {
      strategy?: string;
      effectiveness?: number;
      applicableContexts?: string[];
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): ReflectionMemory {
    const now = Date.now();

    const reflection: ReflectionMemory = {
      id,
      tier: MemoryTier.REFLECTION,
      content: `Reflection: ${subject} - ${insight}`,
      importance: MemoryImportance.SIGNIFICANT,
      createdAt: now,
      updatedAt: now,
      lastAccessed: now,
      accessCount: 0,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
      reflectionType,
      subject,
      insight,
      strategy: options.strategy,
      effectiveness: options.effectiveness ?? 0.5,
      applicableContexts: options.applicableContexts ?? []
    };

    this._reflections.set(id, reflection);

    this._emit({
      type: 'reflection_added',
      reflectionId: id,
      reflectionType,
      subject,
      timestamp: now
    });

    return reflection;
  }

  /**
   * Get a reflection by ID
   */
  get(id: string): ReflectionMemory | null {
    const reflection = this._reflections.get(id);
    if (reflection) {
      reflection.accessCount++;
      reflection.lastAccessed = Date.now();
      return reflection;
    }
    return null;
  }

  /**
   * Get reflections by type
   */
  getByType(reflectionType: ReflectionType): ReflectionMemory[] {
    return Array.from(this._reflections.values()).filter(
      r => r.reflectionType === reflectionType
    );
  }

  /**
   * Get reflections by subject
   */
  getBySubject(subject: string): ReflectionMemory[] {
    const subjectLower = subject.toLowerCase();
    return Array.from(this._reflections.values()).filter(
      r => r.subject.toLowerCase().includes(subjectLower)
    );
  }

  /**
   * Get reflections for a context
   */
  getByContext(context: string): ReflectionMemory[] {
    return Array.from(this._reflections.values()).filter(
      r => r.applicableContexts.some(c => c.toLowerCase().includes(context.toLowerCase()))
    );
  }

  /**
   * Get most effective reflections
   */
  getMostEffective(minEffectiveness: number = 0.7): ReflectionMemory[] {
    return Array.from(this._reflections.values())
      .filter(r => r.effectiveness >= minEffectiveness)
      .sort((a, b) => b.effectiveness - a.effectiveness);
  }

  /**
   * Get learning strategies
   */
  getLearningStrategies(): Array<{ strategy: string; effectiveness: number; subject: string }> {
    return Array.from(this._reflections.values())
      .filter(r => r.reflectionType === ReflectionType.LEARNING_STRATEGY && r.strategy)
      .map(r => ({
        strategy: r.strategy!,
        effectiveness: r.effectiveness,
        subject: r.subject
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);
  }

  /**
   * Get corrected misconceptions
   */
  getMisconceptions(): ReflectionMemory[] {
    return this.getByType(ReflectionType.MISCONCEPTION_CORRECTED)
      .sort((a, b) => b.effectiveness - a.effectiveness);
  }

  /**
   * Update reflection effectiveness
   */
  updateEffectiveness(id: string, newEffectiveness: number): void {
    const reflection = this._reflections.get(id);
    if (reflection) {
      reflection.effectiveness = Math.max(0, Math.min(1, newEffectiveness));
      reflection.updatedAt = Date.now();
    }
  }

  /**
   * Get all reflections
   */
  getAll(): ReflectionMemory[] {
    return Array.from(this._reflections.values());
  }

  /**
   * Get statistics
   */
  stats(): {
    total: number;
    byType: Record<string, number>;
    avgEffectiveness: number;
  } {
    const reflections = this.getAll();
    const byType: Record<string, number> = {};
    let totalEffectiveness = 0;

    for (const r of reflections) {
      const typeName = ReflectionType[r.reflectionType];
      byType[typeName] = (byType[typeName] ?? 0) + 1;
      totalEffectiveness += r.effectiveness;
    }

    return {
      total: reflections.length,
      byType,
      avgEffectiveness: reflections.length > 0 ? totalEffectiveness / reflections.length : 0
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private _emit(event: MemorySystemEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    }
  }
}

// ============================================================================
// Identity Memory Implementation
// ============================================================================

/**
 * Identity Memory - Core traits and persistent self-model
 *
 * Characteristics:
 * - Stores core traits (learning preferences, pacing, persistence)
 * - High stability (traits change slowly)
 * - Confidence scores for each trait
 * - Evidence tracking (which memories support this trait)
 * - Self-model for personalization
 */
export class IdentityMemoryStore {
  private _traits: Map<string, IdentityMemory>;
  private _eventHandlers: Set<MemoryEventHandler>;

  constructor() {
    this._traits = new Map();
    this._eventHandlers = new Set();
  }

  /**
   * Add or update an identity trait
   */
  setTrait(
    id: string,
    traitType: IdentityTraitType,
    value: string | number | boolean,
    options: {
      confidence?: number;
      stability?: number;
      evidence?: string[];
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): IdentityMemory {
    const now = Date.now();
    const existing = this._traits.get(id);

    const trait: IdentityMemory = existing ?? {
      id,
      tier: MemoryTier.IDENTITY,
      content: `Trait: ${IdentityTraitType[traitType]} = ${value}`,
      importance: MemoryImportance.CORE_IDENTITY,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastAccessed: existing?.lastAccessed ?? now,
      accessCount: existing?.accessCount ?? 0,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
      traitType,
      value,
      confidence: options.confidence ?? (existing?.confidence ?? 0.5),
      stability: options.stability ?? (existing?.stability ?? 0.5),
      sourceEvidence: options.evidence ?? (existing?.sourceEvidence ?? [])
    };

    this._traits.set(id, trait);

    if (!existing) {
      this._emit({ type: 'memory_created', memoryId: id, tier: MemoryTier.IDENTITY, timestamp: now });
    }

    return trait;
  }

  /**
   * Get a trait by ID
   */
  get(id: string): IdentityMemory | null {
    const trait = this._traits.get(id);
    if (trait) {
      trait.accessCount++;
      trait.lastAccessed = Date.now();
      return trait;
    }
    return null;
  }

  /**
   * Get traits by type
   */
  getByType(traitType: IdentityTraitType): IdentityMemory[] {
    return Array.from(this._traits.values()).filter(
      t => t.traitType === traitType
    );
  }

  /**
   * Get the most stable traits
   */
  getStableTraits(minStability: number = 0.7): IdentityMemory[] {
    return Array.from(this._traits.values())
      .filter(t => t.stability >= minStability)
      .sort((a, b) => b.stability - a.stability);
  }

  /**
   * Get high-confidence traits
   */
  getConfidentTraits(minConfidence: number = 0.7): IdentityMemory[] {
    return Array.from(this._traits.values())
      .filter(t => t.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Add evidence to a trait
   */
  addEvidence(traitId: string, evidenceMemoryId: string): void {
    const trait = this._traits.get(traitId);
    if (trait && !trait.sourceEvidence.includes(evidenceMemoryId)) {
      trait.sourceEvidence.push(evidenceMemoryId);
      // Increase confidence with more evidence
      trait.confidence = Math.min(1, trait.confidence + 0.05);
      trait.updatedAt = Date.now();
    }
  }

  /**
   * Update trait value with confidence adjustment
   */
  updateValue(traitId: string, newValue: string | number | boolean, confidenceDelta: number = 0): void {
    const trait = this._traits.get(traitId);
    if (trait) {
      trait.value = newValue;
      trait.confidence = Math.max(0, Math.min(1, trait.confidence + confidenceDelta));
      trait.updatedAt = Date.now();
    }
  }

  /**
   * Get learning preferences
   */
  getLearningPreferences(): Record<string, unknown> {
    const prefs = this.getByType(IdentityTraitType.LEARNING_PREFERENCE);
    const result: Record<string, unknown> = {};

    for (const pref of prefs) {
      result[pref.id] = pref.value;
    }

    return result;
  }

  /**
   * Get self-model summary
   */
  getSelfModel(): {
    learningStyle: Record<string, unknown>;
    persistence: number;
    curiosity: Record<string, unknown>;
    socialOrientation: string;
    stressResponse: string;
    overallConfidence: number;
  } {
    const learningPrefs = this.getLearningPreferences();
    const persistence = this.getByType(IdentityTraitType.PERSISTENCE)[0];
    const curiosity = this.getByType(IdentityTraitType.CURIOSITY_DRIVER);
    const social = this.getByType(IdentityTraitType.SOCIAL_ORIENTATION)[0];
    const stress = this.getByType(IdentityTraitType.STRESS_RESPONSE)[0];

    const allTraits = this.getAll();
    const avgConfidence = allTraits.length > 0
      ? allTraits.reduce((sum, t) => sum + t.confidence, 0) / allTraits.length
      : 0;

    return {
      learningStyle: learningPrefs,
      persistence: persistence?.confidence ?? 0.5,
      curiosity: curiosity.reduce((acc, t) => {
        acc[t.id] = t.value;
        return acc;
      }, {} as Record<string, unknown>),
      socialOrientation: String(social?.value ?? 'neutral'),
      stressResponse: String(stress?.value ?? 'adaptive'),
      overallConfidence: avgConfidence
    };
  }

  /**
   * Get all traits
   */
  getAll(): IdentityMemory[] {
    return Array.from(this._traits.values());
  }

  /**
   * Get statistics
   */
  stats(): {
    total: number;
    byType: Record<string, number>;
    avgConfidence: number;
    avgStability: number;
  } {
    const traits = this.getAll();
    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let totalStability = 0;

    for (const t of traits) {
      const typeName = IdentityTraitType[t.traitType];
      byType[typeName] = (byType[typeName] ?? 0) + 1;
      totalConfidence += t.confidence;
      totalStability += t.stability;
    }

    return {
      total: traits.length,
      byType,
      avgConfidence: traits.length > 0 ? totalConfidence / traits.length : 0,
      avgStability: traits.length > 0 ? totalStability / traits.length : 0
    };
  }

  /**
   * Register event handler
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private _emit(event: MemorySystemEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in event handler:', e);
      }
    }
  }
}

// ============================================================================
// Main Memory Hierarchy Class
// ============================================================================

/**
 * Main 6-tier hierarchical memory system
 *
 * Coordinates all memory tiers and provides unified access
 */
export class HierarchicalMemory {
  public working: WorkingMemory;
  public episodic: EpisodicMemory;
  public semantic: SemanticMemory;
  public procedural: ProceduralMemory;
  public reflection: ReflectionMemoryStore;
  public identity: IdentityMemoryStore;

  private _config: MemorySystemConfig;
  private _eventHandlers: Set<MemoryEventHandler>;
  private _consolidationQueue: Array<{
    sourceTier: MemoryTier;
    targetTier: MemoryTier;
    memoryId: string;
    priority: number;
    timestamp: number;
  }>;

  constructor(config: Partial<MemorySystemConfig> = {}) {
    this._config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this._eventHandlers = new Set();
    this._consolidationQueue = [];

    // Initialize all tiers
    this.working = new WorkingMemory(
      this._config.workingCapacity,
      this._config.workingDecayDuration,
      this._config.workingHalfLife
    );

    this.episodic = new EpisodicMemory(
      this._config.episodicCapacity,
      this._config.episodicDecayEnabled
    );

    this.semantic = new SemanticMemory(
      this._config.semanticEmbeddingDim,
      this._config.semanticSimilarityThreshold
    );

    this.procedural = new ProceduralMemory(
      this._config.proceduralDecayRate,
      this._config.proceduralMasteryDecay
    );

    this.reflection = new ReflectionMemoryStore();

    this.identity = new IdentityMemoryStore();

    // Wire up event forwarding
    this._wireEvents();
  }

  /**
   * Add event listener for all memory tiers
   */
  onEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Remove event listener
   */
  offEvent(handler: MemoryEventHandler): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Get memory by ID from any tier
   */
  getMemory(id: string): MemoryType | null {
    // Try each tier
    let memory = this.working.get(id);
    if (memory) return memory;

    memory = this.episodic.get(id);
    if (memory) return memory;

    memory = this.semantic.get(id);
    if (memory) return memory;

    memory = this.procedural.get(id);
    if (memory) return memory;

    memory = this.reflection.get(id);
    if (memory) return memory;

    memory = this.identity.get(id);
    if (memory) return memory;

    return null;
  }

  /**
   * Get system-wide statistics
   */
  getStats(): {
    working: ReturnType<WorkingMemory['stats']>;
    episodic: ReturnType<EpisodicMemory['stats']>;
    semantic: ReturnType<SemanticMemory['stats']>;
    procedural: ReturnType<ProceduralMemory['stats']>;
    reflection: ReturnType<ReflectionMemoryStore['stats']>;
    identity: ReturnType<IdentityMemoryStore['stats']>;
    consolidationQueueSize: number;
  } {
    return {
      working: this.working.stats(),
      episodic: this.episodic.stats(),
      semantic: this.semantic.stats(),
      procedural: this.procedural.stats(),
      reflection: this.reflection.stats(),
      identity: this.identity.stats(),
      consolidationQueueSize: this._consolidationQueue.length
    };
  }

  /**
   * Add item to consolidation queue
   */
  addToConsolidationQueue(
    sourceTier: MemoryTier,
    targetTier: MemoryTier,
    memoryId: string,
    priority: number = 0.5
  ): void {
    this._consolidationQueue.push({
      sourceTier,
      targetTier,
      memoryId,
      priority,
      timestamp: Date.now()
    });

    // Sort by priority (highest first)
    this._consolidationQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get next item from consolidation queue
   */
  getNextConsolidationItem(): typeof this._consolidationQueue[0] | undefined {
    return this._consolidationQueue.shift();
  }

  /**
   * Clear consolidation queue
   */
  clearConsolidationQueue(): void {
    this._consolidationQueue = [];
  }

  /**
   * Get configuration
   */
  getConfig(): MemorySystemConfig {
    return { ...this._config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MemorySystemConfig>): void {
    this._config = { ...this._config, ...updates };
  }

  /**
   * Wire up event forwarding from all tiers
   */
  private _wireEvents(): void {
    const forward = (event: MemorySystemEvent) => {
      for (const handler of this._eventHandlers) {
        try {
          handler(event);
        } catch (e) {
          console.error('Error in event handler:', e);
        }
      }
    };

    this.working.onEvent(forward);
    this.episodic.onEvent(forward);
    this.semantic.onEvent(forward);
    this.procedural.onEvent(forward);
    this.reflection.onEvent(forward);
    this.identity.onEvent(forward);
  }
}
