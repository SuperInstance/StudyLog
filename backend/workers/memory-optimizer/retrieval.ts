/**
 * Memory Retrieval - Fast Memory Retrieval with Embeddings
 *
 * Implements efficient memory retrieval using:
 * - Vector similarity search (with embedding support)
 * - Hybrid scoring (relevance + recency + importance)
 * - Tier-aware retrieval
 * - Fuzzy matching for semantic search
 *
 * StudyLoG.AI Optimizations:
 * - Learning context awareness
 * - Progression-aware ranking
 * - Concept prerequisite bridging
 * - Zone of proximal development (ZPD) matching
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

import type { EpisodicMemory, SemanticMemory, ConsolidationState } from './consolidation.js';

/**
 * Memory tier for retrieval
 */
export enum MemoryTier {
  WORKING = 'working',
  MID_TERM = 'mid_term',
  LONG_TERM = 'long_term',
}

/**
 * Retrieval mode
 */
export enum RetrievalMode {
  /** Find exact matches */
  EXACT = 'exact',
  /** Find semantically similar memories */
  SEMANTIC = 'semantic',
  /** Find related concepts for learning */
  PEDAGOGICAL = 'pedagogical',
  /** Find prerequisites for current learning */
  PREREQUISITE = 'prerequisite',
  /** Find memories to review (spaced repetition) */
  REVIEW = 'review',
}

/**
 * Retrieval options
 */
export interface RetrievalOptions {
  /** Maximum number of results */
  topK?: number;
  /** Memory tier to search */
  tier?: MemoryTier;
  /** Retrieval mode */
  mode?: RetrievalMode;
  /** Minimum relevance threshold (0-1) */
  minRelevance?: number;
  /** Filter by subject */
  subject?: string;
  /** Filter by topic */
  topic?: string;
  /** Filter by tags */
  tags?: string[];
  /** Include related memories */
  includeRelated?: boolean;
  /** Boost recency (0-1) */
  recencyBoost?: number;
  /** Boost importance (0-1) */
  importanceBoost?: number;
  /** Current learning context */
  learningContext?: LearningContext;
}

/**
 * Learning context for pedagogical retrieval
 */
export interface LearningContext {
  /** Current subject being studied */
  currentSubject?: string;
  /** Current topic being studied */
  currentTopic?: string;
  /** Student's current skill level (0-1) */
  skillLevel?: number;
  /** Recently mastered concepts */
  recentMastery?: string[];
  /** Known struggling areas */
  struggleAreas?: string[];
  /** Target difficulty (1-10) */
  targetDifficulty?: number;
}

/**
 * Memory with retrieval score
 */
export interface ScoredMemory<T = EpisodicMemory | SemanticMemory> {
  memory: T;
  score: number;
  relevance: number;
  recency: number;
  importance: number;
  matchReasons: string[];
}

/**
 * Retrieval result
 */
export interface RetrievalResult<T = EpisodicMemory | SemanticMemory> {
  results: ScoredMemory<T>[];
  query: string;
  totalSearched: number;
  filtered: number;
  queryTimeMs: number;
}

/**
 * Simple embedding interface (vector of numbers)
 */
export type Embedding = number[];

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  /**
   * Generate embedding for text
   */
  embed(text: string): Promise<Embedding>;

  /**
   * Generate embeddings for multiple texts
   */
  embedBatch(texts: string[]): Promise<Embedding[]>;
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Jaccard similarity between two sets of words
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return union > 0 ? intersection / union : 0;
}

// ═══════════════════════════════════════════════════════════
// In-Memory Vector Store
// ═══════════════════════════════════════════════════════════

/**
 * Simple vector store for in-memory similarity search
 * For production, use a proper vector database (Pinecone, Weaviate, etc.)
 */
export class VectorStore {
  private vectors: Map<string, { embedding: Embedding; metadata: Record<string, unknown> }>;

  constructor() {
    this.vectors = new Map();
  }

  /**
   * Add a vector to the store
   */
  add(id: string, embedding: Embedding, metadata?: Record<string, unknown>): void {
    this.vectors.set(id, { embedding, metadata: metadata ?? {} });
  }

  /**
   * Get a vector by ID
   */
  get(id: string): { embedding: Embedding; metadata: Record<string, unknown> } | undefined {
    return this.vectors.get(id);
  }

  /**
   * Remove a vector
   */
  remove(id: string): void {
    this.vectors.delete(id);
  }

  /**
   * Find nearest neighbors to a query vector
   */
  findNearest(
    query: Embedding,
    topK: number = 10,
    threshold: number = 0
  ): Array<{ id: string; similarity: number; metadata: Record<string, unknown> }> {
    const results: Array<{ id: string; similarity: number; metadata: Record<string, unknown> }> = [];

    for (const [id, data] of this.vectors.entries()) {
      const similarity = cosineSimilarity(query, data.embedding);
      if (similarity >= threshold) {
        results.push({ id, similarity, metadata: data.metadata });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, topK);
  }

  /**
   * Clear all vectors
   */
  clear(): void {
    this.vectors.clear();
  }

  /**
   * Get size of store
   */
  get size(): number {
    return this.vectors.size;
  }
}

// ═══════════════════════════════════════════════════════════
// Simple Embedding Provider (TF-IDF based)
// ═══════════════════════════════════════════════════════════

/**
 * Simple TF-IDF based embedding provider for fallback
 * In production, use a proper embedding model (OpenAI, Cohere, etc.)
 */
export class SimpleEmbeddingProvider implements EmbeddingProvider {
  private vocabulary: Set<string> = new Set();
  private idf: Map<string, number> = new Map();
  private documents: string[][] = [];

  /**
   * Train the model on documents
   */
  train(documents: string[]): void {
    this.documents = documents.map(doc => this.tokenize(doc));

    // Build vocabulary
    for (const doc of this.documents) {
      for (const word of new Set(doc)) {
        this.vocabulary.add(word);
      }
    }

    // Calculate IDF
    const docCount = this.documents.length;
    for (const word of this.vocabulary) {
      let docFreq = 0;
      for (const doc of this.documents) {
        if (doc.includes(word)) {
          docFreq++;
        }
      }
      this.idf.set(word, Math.log(docCount / (1 + docFreq)));
    }
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<Embedding> {
    const tokens = this.tokenize(text);
    const embedding: number[] = [];

    for (const word of this.vocabulary) {
      const tf = tokens.filter(t => t === word).length;
      const idf = this.idf.get(word) ?? 0;
      embedding.push(tf * idf);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm === 0 ? embedding : embedding.map(val => val / norm);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<Embedding[]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && /^[a-z0-9]+$/.test(w));
  }

  /**
   * Get vocabulary size
   */
  get vocabSize(): number {
    return this.vocabulary.size;
  }
}

// ═══════════════════════════════════════════════════════════
// Memory Retrieval Engine
// ═══════════════════════════════════════════════════════════

export class MemoryRetrievalEngine {
  private episodicMemories: Map<string, EpisodicMemory>;
  private semanticMemories: Map<string, SemanticMemory>;
  private vectorStore: VectorStore;
  private embeddingProvider: EmbeddingProvider;
  private trained: boolean;

  constructor(embeddingProvider?: EmbeddingProvider) {
    this.episodicMemories = new Map();
    this.semanticMemories = new Map();
    this.vectorStore = new VectorStore();
    this.embeddingProvider = embeddingProvider ?? new SimpleEmbeddingProvider();
    this.trained = false;
  }

  /**
   * Add an episodic memory
   */
  addEpisodicMemory(memory: EpisodicMemory): void {
    this.episodicMemories.set(memory.id, memory);
    this.trained = false; // Need to retrain
  }

  /**
   * Add a semantic memory
   */
  addSemanticMemory(memory: SemanticMemory): void {
    this.semanticMemories.set(memory.id, memory);
    this.trained = false;
  }

  /**
   * Initialize the retrieval engine (train embeddings)
   */
  async initialize(): Promise<void> {
    const allTexts: string[] = [];

    // Collect all episodic memory texts
    for (const memory of this.episodicMemories.values()) {
      allTexts.push(memory.content);
      if (memory.topic) allTexts.push(memory.topic);
      if (memory.subject) allTexts.push(memory.subject);
    }

    // Collect all semantic memory texts
    for (const memory of this.semanticMemories.values()) {
      allTexts.push(memory.content);
      allTexts.push(memory.concept);
      allTexts.push(...memory.patterns);
    }

    // Train the embedding provider
    if (this.embeddingProvider instanceof SimpleEmbeddingProvider && allTexts.length > 0) {
      this.embeddingProvider.train(allTexts);
    }

    // Build vector store
    await this.buildVectorStore();

    this.trained = true;
  }

  /**
   * Build vector store from memories
   */
  private async buildVectorStore(): Promise<void> {
    this.vectorStore.clear();

    // Add episodic memories
    for (const memory of this.episodicMemories.values()) {
      const text = [memory.content, memory.topic, memory.subject].filter(Boolean).join(' ');
      const embedding = await this.embeddingProvider.embed(text);
      this.vectorStore.add(memory.id, embedding, {
        type: 'episodic',
        subject: memory.subject,
        topic: memory.topic,
        importance: memory.importance,
        timestamp: memory.timestamp,
      });
    }

    // Add semantic memories
    for (const memory of this.semanticMemories.values()) {
      const text = [memory.concept, memory.content, ...memory.patterns].join(' ');
      const embedding = await this.embeddingProvider.embed(text);
      this.vectorStore.add(memory.id, embedding, {
        type: 'semantic',
        concept: memory.concept,
        masteryLevel: memory.masteryLevel,
        strength: memory.strength,
      });
    }
  }

  /**
   * Retrieve episodic memories
   */
  async retrieve(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult<EpisodicMemory>> {
    const startTime = performance.now();

    // Ensure initialized
    if (!this.trained) {
      await this.initialize();
    }

    const {
      topK = 10,
      tier,
      mode = RetrievalMode.SEMANTIC,
      minRelevance = 0,
      subject,
      topic,
      tags,
      includeRelated = false,
      recencyBoost = 0.3,
      importanceBoost = 0.3,
      learningContext,
    } = options;

    let candidates = Array.from(this.episodicMemories.values());

    // Apply filters
    candidates = candidates.filter(m => {
      if (subject && m.subject !== subject) return false;
      if (topic && m.topic !== topic) return false;
      if (tags && tags.length > 0 && (!m.tags || !tags.some(t => m.tags.includes(t)))) return false;
      if (tier) {
        const age = Date.now() - m.timestamp;
        if (tier === MemoryTier.WORKING && age > 60 * 60 * 1000) return false;
        if (tier === MemoryTier.MID_TERM && (age <= 60 * 60 * 1000 || age > 6 * 60 * 60 * 1000)) return false;
        if (tier === MemoryTier.LONG_TERM && age <= 6 * 60 * 60 * 1000) return false;
      }
      return true;
    });

    const filtered = candidates.length;
    const totalSearched = this.episodicMemories.size;

    // Score based on mode
    const scored = await this.scoreMemories(query, candidates, mode, {
      recencyBoost,
      importanceBoost,
      learningContext,
    });

    // Filter by minimum relevance
    const relevant = scored.filter(s => s.relevance >= minRelevance);

    // Add related memories if requested
    if (includeRelated) {
      for (const scoredMem of relevant) {
        const relatedIds = scoredMem.memory.relatedMemoryIds ?? [];
        for (const relatedId of relatedIds) {
          const related = this.episodicMemories.get(relatedId);
          if (related && !relevant.some(r => r.memory.id === related.id)) {
            relevant.push({
              memory: related,
              score: scoredMem.score * 0.5,
              relevance: scoredMem.relevance * 0.5,
              recency: this.calculateRecency(related),
              importance: related.importance / 10,
              matchReasons: ['Related to matched memory'],
            });
          }
        }
      }
    }

    // Sort and limit
    relevant.sort((a, b) => b.score - a.score);

    const queryTimeMs = performance.now() - startTime;

    return {
      results: relevant.slice(0, topK),
      query,
      totalSearched,
      filtered,
      queryTimeMs,
    };
  }

  /**
   * Retrieve semantic memories
   */
  async retrieveSemantic(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult<SemanticMemory>> {
    const startTime = performance.now();

    if (!this.trained) {
      await this.initialize();
    }

    const { topK = 10, minRelevance = 0 } = options;

    let candidates = Array.from(this.semanticMemories.values());

    // Apply filters
    if (options.subject) {
      candidates = candidates.filter(m => m.concept.includes(options.subject));
    }

    const scored = await this.scoreSemanticMemories(query, candidates, options.mode ?? RetrievalMode.SEMANTIC, {
      learningContext: options.learningContext,
    });

    const relevant = scored.filter(s => s.relevance >= minRelevance);
    relevant.sort((a, b) => b.score - a.score);

    const queryTimeMs = performance.now() - startTime;

    return {
      results: relevant.slice(0, topK),
      query,
      totalSearched: this.semanticMemories.size,
      filtered: candidates.length - relevant.length,
      queryTimeMs,
    };
  }

  /**
   * Find memories due for review (spaced repetition)
   */
  findDueForReview(studentId: string): SemanticMemory[] {
    const now = Date.now();
    return Array.from(this.semanticMemories.values())
      .filter(m => m.studentId === studentId && m.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview);
  }

  /**
   * Find prerequisites for a concept
   */
  async findPrerequisites(concept: string): Promise<SemanticMemory[]> {
    const conceptMemory = Array.from(this.semanticMemories.values()).find(
      m => m.concept.toLowerCase() === concept.toLowerCase()
    );

    if (!conceptMemory || conceptMemory.prerequisiteIds.length === 0) {
      return [];
    }

    const prerequisites: SemanticMemory[] = [];
    for (const prereqId of conceptMemory.prerequisiteIds) {
      const prereq = this.semanticMemories.get(prereqId);
      if (prereq) {
        prerequisites.push(prereq);
      }
    }

    return prerequisites;
  }

  /**
   * Find memories in the zone of proximal development (ZPD)
   * These are concepts that are slightly above current skill level
   */
  async findZPD(
    studentId: string,
    currentSkillLevel: number,
    subject?: string
  ): Promise<Array<{ memory: SemanticMemory; zpdScore: number }>> {
    const memories = Array.from(this.semanticMemories.values())
      .filter(m => {
        if (m.studentId !== studentId) return false;
        if (subject && !m.concept.includes(subject)) return false;
        return true;
      });

    const zpdResults: Array<{ memory: SemanticMemory; zpdScore: number }> = [];

    for (const memory of memories) {
      // ZPD is the sweet spot: not too easy (mastery > 0.9), not too hard (mastery < 0.3)
      const difficultyGap = Math.abs(memory.masteryLevel - currentSkillLevel);

      let zpdScore = 0;

      // Ideal: mastery is 0.2-0.4 above current skill level
      if (memory.masteryLevel >= currentSkillLevel + 0.2 && memory.masteryLevel <= currentSkillLevel + 0.4) {
        zpdScore = 1 - difficultyGap;
      }
      // Still OK: mastery is 0.1-0.5 above current skill level
      else if (memory.masteryLevel >= currentSkillLevel + 0.1 && memory.masteryLevel <= currentSkillLevel + 0.5) {
        zpdScore = 0.7 - difficultyGap;
      }
      // Too easy or too hard
      else {
        zpdScore = Math.max(0, 0.3 - difficultyGap);
      }

      // Boost weak concepts that are important
      if (memory.masteryLevel < 0.5 && memory.strength < 0.5) {
        zpdScore += 0.2;
      }

      if (zpdScore > 0) {
        zpdResults.push({ memory, zpdScore });
      }
    }

    zpdResults.sort((a, b) => b.zpdScore - a.zpdScore);
    return zpdResults;
  }

  /**
   * Score memories based on query and mode
   */
  private async scoreMemories(
    query: string,
    memories: EpisodicMemory[],
    mode: RetrievalMode,
    options: {
      recencyBoost: number;
      importanceBoost: number;
      learningContext?: LearningContext;
    }
  ): Promise<ScoredMemory<EpisodicMemory>[]> {
    const queryEmbedding = await this.embeddingProvider.embed(query);

    const scored: ScoredMemory<EpisodicMemory>[] = [];

    for (const memory of memories) {
      const scoreResult = await this.scoreMemory(query, queryEmbedding, memory, mode, options);
      scored.push(scoreResult);
    }

    return scored;
  }

  /**
   * Score a single memory
   */
  private async scoreMemory(
    query: string,
    queryEmbedding: Embedding,
    memory: EpisodicMemory,
    mode: RetrievalMode,
    options: {
      recencyBoost: number;
      importanceBoost: number;
      learningContext?: LearningContext;
    }
  ): Promise<ScoredMemory<EpisodicMemory>> {
    const reasons: string[] = [];
    let relevance = 0;
    let recency = this.calculateRecency(memory);
    const importance = memory.importance / 10;

    // Get vector similarity if available
    const vectorData = this.vectorStore.get(memory.id);
    const vectorSim = vectorData ? cosineSimilarity(queryEmbedding, vectorData.embedding) : 0;

    // Word overlap similarity
    const wordSim = jaccardSimilarity(query, memory.content);

    switch (mode) {
      case RetrievalMode.EXACT:
        // Exact word matching
        relevance = wordSim;
        if (wordSim > 0.5) reasons.push('Exact word match');
        break;

      case RetrievalMode.SEMANTIC:
        // Combined semantic and lexical similarity
        relevance = (vectorSim * 0.6) + (wordSim * 0.4);
        if (vectorSim > 0.5) reasons.push('Semantically similar');
        if (wordSim > 0.3) reasons.push('Word overlap');
        break;

      case RetrievalMode.PEDAGOGICAL:
        // Learning context aware scoring
        relevance = (vectorSim * 0.4) + (wordSim * 0.3);

        // Boost if related to current learning
        if (options.learningContext) {
          if (options.learningContext.currentTopic && memory.topic === options.learningContext.currentTopic) {
            relevance += 0.2;
            reasons.push('Current topic');
          }
          if (options.learningContext.struggleAreas?.includes(memory.topic ?? '')) {
            relevance += 0.15;
            reasons.push('Struggle area - needs practice');
          }
          if (options.learningContext.recentMastery?.includes(memory.topic ?? '')) {
            relevance -= 0.1; // Demote recently mastered
          }
        }

        // Boost successful memories for learning
        if (memory.successLevel && memory.successLevel > 0.6) {
          relevance += 0.1;
          reasons.push('Success pattern');
        }
        break;

      case RetrievalMode.PREREQUISITE:
        // Look for foundational concepts
        relevance = wordSim;
        if (memory.difficulty && memory.difficulty < (options.learningContext?.targetDifficulty ?? 5)) {
          relevance += 0.2;
          reasons.push('Prerequisite concept');
        }
        break;

      case RetrievalMode.REVIEW:
        // Prioritize memories that need review
        const age = Date.now() - memory.lastAccessed;
        const daysSinceAccess = age / (24 * 60 * 60 * 1000);
        relevance = Math.min(1, daysSinceAccess / 30); // Boost older memories
        if (daysSinceAccess > 7) reasons.push('Due for review');
        break;
    }

    // Combine scores
    const totalWeight = 1 + options.recencyBoost + options.importanceBoost;
    const score = (
      relevance +
      (recency * options.recencyBoost) +
      (importance * options.importanceBoost)
    ) / totalWeight;

    return {
      memory,
      score,
      relevance,
      recency,
      importance,
      matchReasons: reasons,
    };
  }

  /**
   * Score semantic memories
   */
  private async scoreSemanticMemories(
    query: string,
    memories: SemanticMemory[],
    mode: RetrievalMode,
    options: { learningContext?: LearningContext }
  ): Promise<ScoredMemory<SemanticMemory>[]> {
    const queryEmbedding = await this.embeddingProvider.embed(query);
    const scored: ScoredMemory<SemanticMemory>[] = [];

    for (const memory of memories) {
      const reasons: string[] = [];
      let relevance = 0;

      // Concept matching
      if (memory.concept.toLowerCase().includes(query.toLowerCase())) {
        relevance += 0.5;
        reasons.push('Concept match');
      }

      // Vector similarity
      const vectorData = this.vectorStore.get(memory.id);
      if (vectorData) {
        const vectorSim = cosineSimilarity(queryEmbedding, vectorData.embedding);
        relevance += vectorSim * 0.4;
        if (vectorSim > 0.5) reasons.push('Semantically similar');
      }

      // Learning context
      if (options.learningContext) {
        if (options.learningContext.currentTopic === memory.concept) {
          relevance += 0.3;
          reasons.push('Currently studying');
        }

        // ZPD matching
        const skillLevel = options.learningContext.skillLevel ?? 0.5;
        if (memory.masteryLevel >= skillLevel - 0.2 && memory.masteryLevel <= skillLevel + 0.3) {
          relevance += 0.2;
          reasons.push('Within ZPD');
        }

        // Boost weak concepts
        if (options.learningContext.struggleAreas?.includes(memory.concept)) {
          relevance += 0.15;
          reasons.push('Needs reinforcement');
        }
      }

      // Boost strong memories
      if (memory.strength > 0.7) {
        relevance += 0.1;
      }

      scored.push({
        memory,
        score: Math.min(1, relevance),
        relevance: Math.min(1, relevance),
        recency: memory.strength, // Use strength as recency proxy
        importance: memory.masteryLevel,
        matchReasons: reasons,
      });
    }

    return scored;
  }

  /**
   * Calculate recency score (1 = recent, 0 = old)
   */
  private calculateRecency(memory: EpisodicMemory): number {
    const age = Date.now() - memory.timestamp;
    const hoursAgo = age / (60 * 60 * 1000);

    // Exponential decay with 24-hour half-life
    return Math.pow(0.5, hoursAgo / 24);
  }

  /**
   * Record memory access (updates recency)
   */
  recordAccess(memoryId: string): void {
    const memory = this.episodicMemories.get(memoryId);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = Date.now();
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    episodicCount: number;
    semanticCount: number;
    vectorStoreSize: number;
    trained: boolean;
  } {
    return {
      episodicCount: this.episodicMemories.size,
      semanticCount: this.semanticMemories.size,
      vectorStoreSize: this.vectorStore.size,
      trained: this.trained,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.episodicMemories.clear();
    this.semanticMemories.clear();
    this.vectorStore.clear();
    this.trained = false;
  }
}

/**
 * Factory function to create a retrieval engine
 */
export function createRetrievalEngine(embeddingProvider?: EmbeddingProvider): MemoryRetrievalEngine {
  return new MemoryRetrievalEngine(embeddingProvider);
}
