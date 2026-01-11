/**
 * StudyLoG.AI Memory System - Memory Retrieval
 *
 * Provides flexible search and retrieval across all memory tiers:
 * - Semantic similarity search (with embeddings)
 * - Temporal range queries
 * - Context-based filtering
 * - Associative graph traversal
 * - Hybrid multi-modal search
 *
 * Features:
 * - Configurable retrieval modes
 * - Weight-based scoring for hybrid search
 * - Cross-tier retrieval
 * - Result ranking and relevance scoring
 * - Efficient batch retrieval
 */

import {
  MemoryTier,
  MemoryQuery,
  MemoryResult,
  RetrievalMode,
  RetrievalWeights,
  BaseMemory,
  WorkingMemoryItem,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemory,
  IdentityMemory,
  AssociativeResult,
  EmotionalValence,
  DEFAULT_MEMORY_CONFIG
} from './types.js';
import { HierarchicalMemory } from './memory-hierarchy.js';

// ============================================================================
// Retrieval Configuration
// ============================================================================

export interface RetrievalConfig {
  // Result limits
  defaultTopK: number;
  maxResults: number;

  // Scoring weights
  hybridWeights: RetrievalWeights;

  // Thresholds
  minScore: number;
  semanticThreshold: number;

  // Performance
  enableCache: boolean;
  cacheSize: number;
  cacheTTL: number; // milliseconds
}

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  defaultTopK: 10,
  maxResults: 100,
  hybridWeights: {
    semantic: 0.4,
    temporal: 0.2,
    contextual: 0.2,
    associative: 0.2,
    importance: 0.1
  },
  minScore: 0.1,
  semanticThreshold: 0.5,
  enableCache: true,
  cacheSize: 1000,
  cacheTTL: 5 * 60 * 1000 // 5 minutes
};

// ============================================================================
// Memory Retrieval Engine
// ============================================================================

/**
 * Main retrieval engine for searching across all memory tiers
 */
export class MemoryRetrieval {
  private _memory: HierarchicalMemory;
  private _config: RetrievalConfig;
  private _cache: Map<string, { results: MemoryResult[]; timestamp: number }>;

  constructor(
    memory: HierarchicalMemory,
    config: Partial<RetrievalConfig> = {}
  ) {
    this._memory = memory;
    this._config = { ...DEFAULT_RETRIEVAL_CONFIG, ...config };
    this._cache = new Map();
  }

  /**
   * Main search interface - routes to appropriate search mode
   */
  search(query: MemoryQuery): MemoryResult[] {
    const cacheKey = this._getCacheKey(query);

    // Check cache
    if (this._config.enableCache) {
      const cached = this._cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this._config.cacheTTL) {
        return cached.results;
      }
    }

    let results: MemoryResult[] = [];

    switch (query.mode) {
      case RetrievalMode.SEMANTIC:
        results = this._semanticSearch(query);
        break;

      case RetrievalMode.TEMPORAL:
        results = this._temporalSearch(query);
        break;

      case RetrievalMode.SPATIAL:
        results = this._spatialSearch(query);
        break;

      case RetrievalMode.CONTEXTUAL:
        results = this._contextualSearch(query);
        break;

      case RetrievalMode.ASSOCIATIVE:
        results = this._associativeSearch(query);
        break;

      case RetrievalMode.HYBRID:
        results = this._hybridSearch(query);
        break;

      default:
        results = this._semanticSearch(query);
    }

    // Apply filters
    results = this._applyFilters(results, query);

    // Sort and limit
    results = results.sort((a, b) => b.score - a.score);
    results = results.slice(0, query.topK || this._config.defaultTopK);

    // Cache results
    if (this._config.enableCache) {
      this._cache.set(cacheKey, { results, timestamp: Date.now() });
      this._trimCache();
    }

    return results;
  }

  /**
   * Semantic similarity search
   */
  private _semanticSearch(query: MemoryQuery): MemoryResult[] {
    const results: MemoryResult[] = [];

    // Search semantic memory first (has embeddings)
    const semanticResults = this._memory.semantic.keywordSearch(query.query, query.topK);

    for (const { id, name, score } of semanticResults) {
      const memory = this._memory.semantic.get(id);
      if (memory) {
        results.push({
          memory,
          score: score * 1.5, // Boost semantic memory matches
          relevance: 'semantic_concept_match',
          tier: MemoryTier.SEMANTIC,
          distance: 1 - score
        });
      }
    }

    // Search other tiers with text matching
    const queryLower = query.query.toLowerCase();

    // Working memory
    for (const item of this._memory.working.items()) {
      const textScore = this._textMatchScore(item.content, queryLower);
      if (textScore > 0) {
        results.push({
          memory: item,
          score: textScore,
          relevance: 'working_memory_match',
          tier: MemoryTier.WORKING
        });
      }
    }

    // Episodic memory
    for (const mem of this._memory.episodic.getAll()) {
      const textScore = this._textMatchScore(mem.content, queryLower);
      if (textScore > 0) {
        results.push({
          memory: mem,
          score: textScore * 1.2, // Boost episodic matches
          relevance: 'episodic_match',
          tier: MemoryTier.EPISODIC
        });
      }
    }

    // Procedural memory (skill names)
    for (const skill of this._memory.procedural.getAll()) {
      const textScore = this._textMatchScore(skill.skillName, queryLower);
      if (textScore > 0) {
        results.push({
          memory: skill,
          score: textScore,
          relevance: 'skill_match',
          tier: MemoryTier.PROCEDURAL
        });
      }
    }

    // Reflection memory
    for (const ref of this._memory.reflection.getAll()) {
      const textScore = this._textMatchScore(ref.insight, queryLower);
      if (textScore > 0) {
        results.push({
          memory: ref,
          score: textScore,
          relevance: 'reflection_match',
          tier: MemoryTier.REFLECTION
        });
      }
    }

    return results;
  }

  /**
   * Temporal range search
   */
  private _temporalSearch(query: MemoryQuery): MemoryResult[] {
    const results: MemoryResult[] = [];
    const startTime = query.startTime || 0;
    const endTime = query.endTime || Date.now();

    // Episodic memory has timestamps
    const episodicMemories = this._memory.episodic.searchByTime(startTime, endTime);
    for (const mem of episodicMemories) {
      results.push({
        memory: mem,
        score: 1.0,
        relevance: 'temporal_match',
        tier: MemoryTier.EPISODIC
      });
    }

    // Working memory (createdAt)
    for (const item of this._memory.working.items()) {
      if (item.createdAt >= startTime && item.createdAt <= endTime) {
        results.push({
          memory: item,
          score: 0.8,
          relevance: 'temporal_match',
          tier: MemoryTier.WORKING
        });
      }
    }

    return results;
  }

  /**
   * Spatial/context-based search (location)
   */
  private _spatialSearch(query: MemoryQuery): MemoryResult[] {
    const results: MemoryResult[] = [];

    // Only episodic memory has location
    if (!query.contextValue) return results;

    const location = String(query.contextValue);
    const memories = this._memory.episodic.searchByLocation(location);

    for (const mem of memories) {
      results.push({
        memory: mem,
        score: 1.0,
        relevance: 'location_match',
        tier: MemoryTier.EPISODIC
      });
    }

    return results;
  }

  /**
   * Contextual key-value search
   */
  private _contextualSearch(query: MemoryQuery): MemoryResult[] {
    const results: MemoryResult[] = [];

    if (!query.contextKey) return results;

    const key = query.contextKey;
    const value = query.contextValue;

    // Search episodic memory by context
    const episodicResults = this._memory.episodic.searchByContext(
      key as any,
      value
    );

    for (const mem of episodicResults) {
      results.push({
        memory: mem,
        score: 1.0,
        relevance: 'context_match',
        tier: MemoryTier.EPISODIC
      });
    }

    // Search procedural memory by category
    if (key === 'category' || key === 'skillCategory') {
      const skills = this._memory.procedural.getByCategory(String(value));
      for (const skill of skills) {
        results.push({
          memory: skill,
          score: 1.0,
          relevance: 'category_match',
          tier: MemoryTier.PROCEDURAL
        });
      }
    }

    return results;
  }

  /**
   * Associative graph traversal search
   */
  private _associativeSearch(query: MemoryQuery): AssociativeResult[] {
    const results: AssociativeResult[] = [];

    // Find seed concept by keyword
    const seedResults = this._memory.semantic.keywordSearch(query.query, 1);
    if (seedResults.length === 0) return results;

    const seedId = seedResults[0].id;

    // Traverse associations
    const traversed = this._memory.semantic.associativeSearch(
      seedId,
      2, // maxDepth
      query.topK || this._config.defaultTopK
    );

    for (const { id, name, depth, score: assocScore } of traversed) {
      const memory = this._memory.semantic.get(id);
      if (memory) {
        results.push({
          memory,
          score: assocScore,
          relevance: 'associative_connection',
          tier: MemoryTier.SEMANTIC,
          depth,
          path: [seedId, id]
        });
      }
    }

    return results;
  }

  /**
   * Hybrid multi-modal search
   */
  private _hybridSearch(query: MemoryQuery): MemoryResult[] {
    const weights = query.weights || this._config.hybridWeights;
    const allResults = new Map<string, MemoryResult>();

    // Semantic search
    if (weights.semantic && weights.semantic > 0) {
      const semanticResults = this._semanticSearch(query);
      for (const result of semanticResults) {
        result.score *= weights.semantic;
        this._mergeResult(allResults, result);
      }
    }

    // Temporal search
    if (weights.temporal && weights.temporal > 0 && (query.startTime || query.endTime)) {
      const temporalResults = this._temporalSearch(query);
      for (const result of temporalResults) {
        result.score *= weights.temporal;
        this._mergeResult(allResults, result);
      }
    }

    // Contextual search
    if (weights.contextual && weights.contextual > 0 && query.contextKey) {
      const contextualResults = this._contextualSearch(query);
      for (const result of contextualResults) {
        result.score *= weights.contextual;
        this._mergeResult(allResults, result);
      }
    }

    // Associative search
    if (weights.associative && weights.associative > 0) {
      const assocResults = this._associativeSearch(query);
      for (const result of assocResults) {
        result.score *= weights.associative;
        this._mergeResult(allResults, allResults, result);
      }
    }

    // Importance boost
    if (weights.importance && weights.importance > 0) {
      for (const result of allResults.values()) {
        const importanceBoost = (result.memory.importance / 10) * weights.importance;
        result.score += importanceBoost;
      }
    }

    return Array.from(allResults.values());
  }

  /**
   * Merge result into map (keep highest score)
   */
  private _mergeResult(
    map: Map<string, MemoryResult>,
    result: MemoryResult
  ): void {
    const existing = map.get(result.memory.id);
    if (!existing || result.score > existing.score) {
      map.set(result.memory.id, result);
    }
  }

  /**
   * Apply filters to results
   */
  private _applyFilters(results: MemoryResult[], query: MemoryQuery): MemoryResult[] {
    let filtered = results;

    // Tier filter
    if (query.tier) {
      filtered = filtered.filter(r => r.tier === query.tier);
    }

    // Minimum score filter
    const minScore = query.threshold ?? this._config.minScore;
    filtered = filtered.filter(r => r.score >= minScore);

    // Minimum importance filter
    if (query.minImportance) {
      filtered = filtered.filter(r => r.memory.importance >= query.minImportance!);
    }

    // Emotional range filter (episodic only)
    if (query.emotionalRange && filtered.length > 0) {
      const [min, max] = query.emotionalRange;
      filtered = filtered.filter(r => {
        if (r.tier === MemoryTier.EPISODIC) {
          const episodic = r.memory as EpisodicMemory;
          return episodic.emotionalValence >= min && episodic.emotionalValence <= max;
        }
        return true;
      });
    }

    return filtered;
  }

  /**
   * Calculate text match score
   */
  private _textMatchScore(text: string, query: string): number {
    const textLower = text.toLowerCase();
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);

    if (queryWords.length === 0) return 0;

    let matchScore = 0;
    let matchedWords = 0;

    for (const word of queryWords) {
      if (textLower.includes(word)) {
        matchedWords++;
        matchScore += word.length; // Longer words get more weight
      }
    }

    if (matchedWords === 0) return 0;

    // Normalize by query length
    return (matchScore / query.length) * (matchedWords / queryWords.length);
  }

  /**
   * Get cache key for query
   */
  private _getCacheKey(query: MemoryQuery): string {
    return JSON.stringify({
      q: query.query,
      mode: query.mode,
      tier: query.tier,
      k: query.topK,
      s: query.startTime,
      e: query.endTime,
      ck: query.contextKey,
      cv: query.contextValue,
      mi: query.minImportance
    });
  }

  /**
   * Trim cache to max size
   */
  private _trimCache(): void {
    if (this._cache.size <= this._config.cacheSize) return;

    const entries = Array.from(this._cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest entries
    const toRemove = entries.slice(0, entries.length - this._config.cacheSize);
    for (const [key] of toRemove) {
      this._cache.delete(key);
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this._cache.clear();
  }

  // ========================================================================
  // Convenience Methods
  // ========================================================================

  /**
   * Quick semantic search
   */
  semantic(query: string, topK: number = 10): MemoryResult[] {
    return this.search({
      query,
      mode: RetrievalMode.SEMANTIC,
      topK
    });
  }

  /**
   * Quick temporal search
   */
  temporal(startTime: number, endTime: number, topK: number = 10): MemoryResult[] {
    return this.search({
      query: '',
      mode: RetrievalMode.TEMPORAL,
      startTime,
      endTime,
      topK
    });
  }

  /**
   * Quick contextual search
   */
  contextual(key: string, value: unknown, topK: number = 10): MemoryResult[] {
    return this.search({
      query: '',
      mode: RetrievalMode.CONTEXTUAL,
      contextKey: key,
      contextValue: value,
      topK
    });
  }

  /**
   * Search within a specific tier
   */
  searchTier(tier: MemoryTier, query: string, topK: number = 10): MemoryResult[] {
    return this.search({
      query,
      mode: RetrievalMode.SEMANTIC,
      tier,
      topK
    });
  }

  /**
   * Get related memories (associative)
   */
  getRelated(memoryId: string, maxDepth: number = 2, topK: number = 10): MemoryResult[] {
    const memory = this._memory.getMemory(memoryId);
    if (!memory) return [];

    // Start from this memory
    const query = memory.content.slice(0, 50);

    return this.search({
      query,
      mode: RetrievalMode.ASSOCIATIVE,
      topK
    });
  }

  /**
   * Get recent memories
   */
  getRecent(count: number = 10, tier?: MemoryTier): MemoryResult[] {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    return this.search({
      query: '',
      mode: RetrievalMode.TEMPORAL,
      startTime: oneDayAgo,
      endTime: now,
      tier,
      topK: count
    });
  }

  /**
   * Get important memories
   */
  getImportant(minImportance: number = 8, topK: number = 10): MemoryResult[] {
    return this.search({
      query: '',
      mode: RetrievalMode.SEMANTIC,
      minImportance: minImportance as any,
      topK
    });
  }
}

// ============================================================================
// Advanced Retrieval Features
// ============================================================================

/**
 * Fuzzy search for approximate matches
 */
export function fuzzySearch(
  memories: BaseMemory[],
  query: string,
  threshold: number = 0.6
): MemoryResult[] {
  const results: MemoryResult[] = [];
  const queryLower = query.toLowerCase();

  for (const memory of memories) {
    const distance = levenshteinDistance(
      queryLower,
      memory.content.toLowerCase().slice(0, query.length * 2)
    );
    const similarity = 1 - (distance / Math.max(query.length, memory.content.length));

    if (similarity >= threshold) {
      results.push({
        memory,
        score: similarity,
        relevance: 'fuzzy_match',
        tier: memory.tier
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Multi-query fusion search
 */
export function fusionSearch(
  retrieval: MemoryRetrieval,
  queries: string[],
  fusionMethod: 'rrf' | 'weighted' = 'rrf'
): MemoryResult[] {
  const allResults = new Map<string, MemoryResult>();

  if (fusionMethod === 'rrf') {
    // Reciprocal Rank Fusion
    const k = 60; // RRF constant

    for (const query of queries) {
      const results = retrieval.semantic(query);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const existing = allResults.get(result.memory.id);

        if (existing) {
          existing.score += 1 / (k + i + 1);
        } else {
          allResults.set(result.memory.id, {
            ...result,
            score: 1 / (k + i + 1)
          });
        }
      }
    }
  } else {
    // Weighted fusion
    const weight = 1 / queries.length;
    for (const query of queries) {
      const results = retrieval.semantic(query);
      for (const result of results) {
        const existing = allResults.get(result.memory.id);
        if (existing) {
          existing.score += result.score * weight;
        } else {
          allResults.set(result.memory.id, {
            ...result,
            score: result.score * weight
          });
        }
      }
    }
  }

  return Array.from(allResults.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Diversified search (MMR - Maximal Marginal Relevance)
 */
export function diversifiedSearch(
  retrieval: MemoryRetrieval,
  query: string,
  lambda: number = 0.5,
  topK: number = 10
): MemoryResult[] {
  // Get initial results
  const initialResults = retrieval.semantic(query, topK * 2);
  if (initialResults.length === 0) return [];

  const selected: MemoryResult[] = [];
  const remaining = [...initialResults];

  // Select first (highest relevance)
  selected.push(remaining.shift()!);

  // Greedy selection for diversity
  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance score
      const relevance = candidate.score;

      // Diversity score (1 - similarity to selected)
      let minSimilarity = 1;
      for (const sel of selected) {
        const similarity = cosineSimilarity(
          candidate.memory.content,
          sel.memory.content
        );
        minSimilarity = Math.min(minSimilarity, similarity);
      }

      // MMR score
      const mmrScore = (lambda * relevance) - ((1 - lambda) * minSimilarity);

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected;
}

/**
 * Simple cosine similarity for text (word overlap)
 */
function cosineSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }

  const magnitude1 = Math.sqrt(words1.size);
  const magnitude2 = Math.sqrt(words2.size);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  return intersection / (magnitude1 * magnitude2);
}

// ============================================================================
// Retrieval Statistics
// ============================================================================

export interface RetrievalStats {
  totalSearches: number;
  cacheHits: number;
  cacheMisses: number;
  averageResultCount: number;
  mostCommonQueries: Array<{ query: string; count: number }>;
}

/**
 * Track retrieval statistics (optional feature)
 */
export class RetrievalStatsTracker {
  private _stats: RetrievalStats;
  private _queryCounts: Map<string, number>;

  constructor() {
    this._stats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResultCount: 0,
      mostCommonQueries: []
    };
    this._queryCounts = new Map();
  }

  recordSearch(query: string, resultCount: number, cacheHit: boolean): void {
    this._stats.totalSearches++;
    if (cacheHit) {
      this._stats.cacheHits++;
    } else {
      this._stats.cacheMisses++;
    }

    // Update average result count
    this._stats.averageResultCount =
      (this._stats.averageResultCount * (this._stats.totalSearches - 1) + resultCount) /
      this._stats.totalSearches;

    // Track query frequency
    const queryKey = query.toLowerCase().slice(0, 50);
    this._queryCounts.set(queryKey, (this._queryCounts.get(queryKey) || 0) + 1);

    // Update most common queries
    this._updateMostCommon();
  }

  getStats(): RetrievalStats {
    return { ...this._stats };
  }

  reset(): void {
    this._stats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResultCount: 0,
      mostCommonQueries: []
    };
    this._queryCounts.clear();
  }

  private _updateMostCommon(): void {
    this._stats.mostCommonQueries = Array.from(this._queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
