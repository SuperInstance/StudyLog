/**
 * StudyLoG.AI Memory System - Memory Consolidation
 *
 * Handles the transfer of memories between tiers:
 * - Working -> Episodic (based on importance and decay)
 * - Episodic -> Semantic (pattern clustering)
 * - Semantic -> Procedural (skill extraction)
 * - All -> Reflection (metacognitive insights)
 *
 * Features:
 * - Pattern detection across episodic memories
 * - Surprise detection using KL divergence
 * - Sleep consolidation simulation
 * - Configurable consolidation triggers
 * - Batch processing for efficiency
 */

import {
  MemoryTier,
  MemoryImportance,
  BaseMemory,
  WorkingMemoryItem,
  EpisodicMemory,
  SemanticMemory,
  ConsolidationTrigger,
  DetectedPattern,
  TemporalPattern,
  ConsolidationQueueItem,
  ConsolidationResult,
  MemorySystemEvent
} from './types.js';
import { HierarchicalMemory } from './memory-hierarchy.js';

// ============================================================================
// Consolidation Configuration
// ============================================================================

export interface ConsolidationConfig {
  // Working to Episodic
  workingToEpisodicMinImportance: number;
  workingToEpisodicDecayOnly: boolean;

  // Episodic to Semantic
  episodicToSemanticMinClusterSize: number;
  episodicToSemanticSimilarityThreshold: number;
  episodicToSemanticTimeWindow: number; // milliseconds

  // Pattern Detection
  patternMinFrequency: number;
  patternConfidenceThreshold: number;

  // Surprise Detection
  surpriseThreshold: number;
  surpriseBaselineWindow: number;

  // Sleep Consolidation
  sleepConsolidationBatchesPerHour: number;
  sleepConsolidationBatchSize: number;
}

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  workingToEpisodicMinImportance: 0.5,
  workingToEpisodicDecayOnly: true,

  episodicToSemanticMinClusterSize: 3,
  episodicToSemanticSimilarityThreshold: 0.6,
  episodicToSemanticTimeWindow: 7 * 24 * 60 * 60 * 1000, // 7 days

  patternMinFrequency: 3,
  patternConfidenceThreshold: 0.7,

  surpriseThreshold: 0.5,
  surpriseBaselineWindow: 24 * 60 * 60 * 1000, // 24 hours

  sleepConsolidationBatchesPerHour: 2,
  sleepConsolidationBatchSize: 3
};

// ============================================================================
// Consolidation Pipeline
// ============================================================================

/**
 * Main consolidation engine
 *
 * Orchestrates the transfer of memories between tiers
 */
export class ConsolidationPipeline {
  private _memory: HierarchicalMemory;
  private _config: ConsolidationConfig;
  private _topicBaseline: Map<string, number[]>; // topic -> historical distribution
  private _lastConsolidation: number;
  private _eventHandlers: Set<(event: ConsolidationEvent) => void>;

  constructor(
    memory: HierarchicalMemory,
    config: Partial<ConsolidationConfig> = {}
  ) {
    this._memory = memory;
    this._config = { ...DEFAULT_CONSOLIDATION_CONFIG, ...config };
    this._topicBaseline = new Map();
    this._lastConsolidation = 0;
    this._eventHandlers = new Set();
  }

  /**
   * Run consolidation on a specific tier
   */
  async consolidate(
    tier: MemoryTier,
    trigger: ConsolidationTrigger = ConsolidationTrigger.TIME_BASED
  ): Promise<ConsolidationResult> {
    const startTime = Date.now();
    const result: ConsolidationResult = {
      success: true,
      itemsConsolidated: 0,
      newMemoriesCreated: [],
      errors: [],
      duration: 0
    };

    try {
      switch (tier) {
        case MemoryTier.WORKING:
          await this._consolidateWorking(result);
          break;

        case MemoryTier.EPISODIC:
          await this._consolidateEpisodic(result);
          break;

        case MemoryTier.SEMANTIC:
          await this._consolidateSemantic(result);
          break;

        default:
          result.errors.push(`Consolidation not implemented for tier: ${tier}`);
      }

      this._lastConsolidation = Date.now();
      this._emit({
        type: 'consolidation_complete',
        tier,
        trigger,
        result,
        timestamp: this._lastConsolidation
      });

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Run full system consolidation
   */
  async consolidateAll(
    trigger: ConsolidationTrigger = ConsolidationTrigger.TIME_BASED
  ): Promise<Record<MemoryTier, ConsolidationResult>> {
    const results: Record<string, ConsolidationResult> = {};

    for (const tier of [
      MemoryTier.WORKING,
      MemoryTier.EPISODIC,
      MemoryTier.SEMANTIC
    ]) {
      results[tier] = await this.consolidate(tier, trigger);
    }

    return results as Record<MemoryTier, ConsolidationResult>;
  }

  /**
   * Consolidate working memory to episodic
   */
  private async _consolidateWorking(result: ConsolidationResult): Promise<void> {
    const candidates = this._config.workingToEpisodicDecayOnly
      ? this._memory.working.getDecayedItems()
      : this._memory.working.getItemsAboveThreshold(
          this._config.workingToEpisodicMinImportance
        );

    for (const item of candidates) {
      try {
        // Create episodic memory from working item
        const episodicId = `epi_${item.id}_${Date.now()}`;
        this._memory.episodic.add(
          episodicId,
          item.content,
          {
            module: item.metadata.module as any,
            lesson: item.metadata.lesson as string,
            topic: item.metadata.topic as string
          },
          {
            importance: item.importance,
            tags: item.tags,
            metadata: item.metadata
          }
        );

        // Mark working item as consolidated
        this._memory.working.remove(item.id);

        result.itemsConsolidated++;
        result.newMemoriesCreated.push(episodicId);

        this._emit({
          type: 'memory_consolidated',
          fromTier: MemoryTier.WORKING,
          toTier: MemoryTier.EPISODIC,
          sourceMemoryId: item.id,
          newMemoryIds: [episodicId],
          timestamp: Date.now()
        });

      } catch (error) {
        result.errors.push(`Failed to consolidate ${item.id}: ${error}`);
      }
    }
  }

  /**
   * Consolidate episodic to semantic (pattern extraction)
   */
  private async _consolidateEpisodic(result: ConsolidationResult): Promise<void> {
    // Get recent episodic memories
    const now = Date.now();
    const timeWindowStart = now - this._config.episodicToSemanticTimeWindow;
    const recentMemories = this._memory.episodic.searchByTime(timeWindowStart, now);

    // Detect patterns
    const patterns = this._detectPatterns(recentMemories);

    // Create semantic concepts from patterns
    for (const pattern of patterns) {
      if (pattern.frequency >= this._config.episodicToSemanticMinClusterSize &&
          pattern.confidence >= this._config.patternConfidenceThreshold) {

        try {
          const conceptId = `sem_${pattern.name.replace(/\s+/g, '_')}_${Date.now()}`;
          this._memory.semantic.addConcept(
            conceptId,
            pattern.name,
            {
              frequency: pattern.frequency,
              temporalPattern: pattern.temporalPattern,
              extractedFrom: 'episodic_consolidation'
            },
            {
              confidence: pattern.confidence,
              sourceEventIds: pattern.sourceMemoryIds,
              tags: ['auto-extracted']
            }
          );

          // Mark source memories as consolidated
          for (const sourceId of pattern.sourceMemoryIds) {
            this._memory.episodic.markConsolidated(sourceId, MemoryTier.SEMANTIC);
          }

          result.itemsConsolidated += pattern.sourceMemoryIds.length;
          result.newMemoriesCreated.push(conceptId);

        } catch (error) {
          result.errors.push(`Failed to create concept from pattern: ${error}`);
        }
      }
    }
  }

  /**
   * Consolidate semantic to procedural (skill extraction)
   */
  private async _consolidateSemantic(result: ConsolidationResult): Promise<void> {
    // Look for action-oriented concepts that might represent skills
    const concepts = this._memory.semantic.getAll();
    const skillCandidates = concepts.filter(c =>
      c.tags.includes('skill') ||
      c.attributes['type'] === 'skill' ||
      c.conceptName.toLowerCase().startsWith('can ')
    );

    for (const concept of skillCandidates) {
      try {
        // Check if skill already exists
        const existing = this._memory.procedural.getByName(concept.conceptName);
        if (existing) {
          // Update existing skill with new evidence
          const mastery = this._memory.procedural.getMastery(existing.id);
          this._memory.procedural.addSkill(
            existing.id,
            existing.skillName,
            existing.category,
            { metadata: { ...existing.metadata, lastConsolidated: Date.now() } }
          );
        } else {
          // Create new skill
          const skillId = `proc_${concept.id}`;
          this._memory.procedural.addSkill(
            skillId,
            concept.conceptName,
            concept.attributes['category'] as string || 'general',
            {
              tags: concept.tags,
              metadata: { sourceConceptId: concept.id }
            }
          );

          result.newMemoriesCreated.push(skillId);
          result.itemsConsolidated++;
        }

      } catch (error) {
        result.errors.push(`Failed to create skill from concept ${concept.conceptName}: ${error}`);
      }
    }
  }

  /**
   * Detect patterns across episodic memories
   */
  private _detectPatterns(memories: EpisodicMemory[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const wordFrequency = new Map<string, Set<string>>();

    // Build word frequency map
    for (const memory of memories) {
      const words = this._extractWords(memory.content);
      for (const word of words) {
        if (!wordFrequency.has(word)) {
          wordFrequency.set(word, new Set());
        }
        wordFrequency.get(word)!.add(memory.id);
      }
    }

    // Find frequent patterns
    for (const [word, memoryIds] of wordFrequency.entries()) {
      if (memoryIds.size >= this._config.patternMinFrequency) {
        const relatedMemories = Array.from(memoryIds)
          .map(id => memories.find(m => m.id === id))
          .filter(Boolean) as EpisodicMemory[];

        const temporalPattern = this._detectTemporalPattern(relatedMemories);

        patterns.push({
          id: `pattern_${word}_${Date.now()}`,
          name: this._extractPatternName(word, relatedMemories),
          frequency: memoryIds.size,
          confidence: this._calculatePatternConfidence(relatedMemories),
          sourceMemoryIds: Array.from(memoryIds),
          temporalPattern
        });
      }
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Extract meaningful words from text
   */
  private _extractWords(text: string): string[] {
    // Simple word extraction (in production, use NLP)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Extract pattern name from word and memories
   */
  private _extractPatternName(word: string, memories: EpisodicMemory[]): string {
    // Find common context
    const contexts = memories.map(m => m.context.topic || m.context.module || 'general');
    const mostCommon = this._mostFrequent(contexts);
    return `${word}_${mostCommon}`;
  }

  /**
   * Calculate pattern confidence based on memory characteristics
   */
  private _calculatePatternConfidence(memories: EpisodicMemory[]): number {
    if (memories.length === 0) return 0;

    // Factors that increase confidence:
    // 1. More memories
    // 2. Consistent emotional response
    // 3. Similar context
    // 4. Recent occurrences

    const countScore = Math.min(1, memories.length / 10);

    const emotions = memories.map(m => m.emotionalValence);
    const avgEmotion = emotions.reduce((sum, e) => sum + e, 0) / emotions.length;
    const emotionVariance = emotions.reduce((sum, e) => sum + Math.pow(e - avgEmotion, 2), 0) / emotions.length;
    const emotionScore = 1 - Math.min(1, emotionVariance);

    const contexts = memories.map(m => m.context.topic || 'unknown');
    const uniqueContexts = new Set(contexts).size;
    const contextScore = 1 - Math.min(1, uniqueContexts / memories.length);

    const now = Date.now();
    const avgAge = memories.reduce((sum, m) => sum + (now - m.timestamp), 0) / memories.length;
    const recencyScore = Math.max(0, 1 - (avgAge / (30 * 24 * 60 * 60 * 1000)));

    return (countScore * 0.3 + emotionScore * 0.2 + contextScore * 0.3 + recencyScore * 0.2);
  }

  /**
   * Detect temporal pattern in memories
   */
  private _detectTemporalPattern(memories: EpisodicMemory[]): TemporalPattern | undefined {
    if (memories.length < 2) return undefined;

    const sortedMemories = [...memories].sort((a, b) => a.timestamp - b.timestamp);
    const intervals: number[] = [];

    for (let i = 1; i < sortedMemories.length; i++) {
      intervals.push(sortedMemories[i].timestamp - sortedMemories[i - 1].timestamp);
    }

    if (intervals.length === 0) return undefined;

    const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

    // Detect trend
    const firstHalf = intervals.slice(0, Math.floor(intervals.length / 2));
    const secondHalf = intervals.slice(Math.floor(intervals.length / 2));
    const firstAvg = firstHalf.reduce((sum, i) => sum + i, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, i) => sum + i, 0) / secondHalf.length;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (secondAvg > firstAvg * 1.2) trend = 'increasing';
    else if (secondAvg < firstAvg * 0.8) trend = 'decreasing';
    else trend = 'stable';

    return {
      interval: avgInterval,
      trend,
      seasonality: undefined // Advanced: could detect cyclical patterns
    };
  }

  /**
   * Get most frequent item in array
   */
  private _mostFrequent<T>(items: T[]): T {
    const counts = new Map<T, number>();
    for (const item of items) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * Calculate surprise (KL divergence) for a new memory
   */
  calculateSurprise(memory: EpisodicMemory): number {
    const topics = this._extractTopics(memory);
    let totalSurprise = 0;

    for (const [topic, probability] of Object.entries(topics)) {
      const baseline = this._getBaselineForTopic(topic);
      const kl = this._klDivergence(probability, baseline);
      totalSurprise += kl;
    }

    // Update baseline with this memory
    for (const [topic, probability] of Object.entries(topics)) {
      this._updateBaseline(topic, probability);
    }

    return totalSurprise / Object.keys(topics).length;
  }

  /**
   * Extract topic distribution from memory
   */
  private _extractTopics(memory: EpisodicMemory): Record<string, number> {
    const topics: Record<string, number> = {};

    // Use context topic if available
    if (memory.context.topic) {
      topics[memory.context.topic] = 0.7;
    }

    // Extract from content words
    const words = this._extractWords(memory.content);
    const wordCount = words.length;
    if (wordCount > 0) {
      const perWord = 0.3 / wordCount;
      for (const word of words) {
        topics[word] = (topics[word] || 0) + perWord;
      }
    }

    // Normalize
    const total = Object.values(topics).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      for (const key in topics) {
        topics[key] /= total;
      }
    }

    return topics;
  }

  /**
   * Get baseline distribution for a topic
   */
  private _getBaselineForTopic(topic: string): number {
    const history = this._topicBaseline.get(topic);
    if (!history || history.length === 0) return 0.5; // Default uniform

    // Average recent history
    const recentWindow = Math.min(100, history.length);
    const recent = history.slice(-recentWindow);
    return recent.reduce((sum, val) => sum + val, 0) / recent.length;
  }

  /**
   * Update baseline with new observation
   */
  private _updateBaseline(topic: string, value: number): void {
    if (!this._topicBaseline.has(topic)) {
      this._topicBaseline.set(topic, []);
    }
    const history = this._topicBaseline.get(topic)!;
    history.push(value);

    // Keep only recent history
    const maxHistory = 1000;
    if (history.length > maxHistory) {
      history.splice(0, history.length - maxHistory);
    }
  }

  /**
   * Calculate KL divergence: D(P || Q)
   */
  private _klDivergence(p: number, q: number): number {
    // Avoid division by zero
    const safeQ = Math.max(q, 0.0001);
    const safeP = Math.max(p, 0.0001);
    return safeP * Math.log(safeP / safeQ);
  }

  /**
   * Simulate sleep-based consolidation
   */
  async simulateSleepConsolidation(durationHours: number = 8.0): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      success: true,
      itemsConsolidated: 0,
      newMemoriesCreated: [],
      errors: [],
      duration: 0
    };

    const startTime = Date.now();
    const batches = Math.floor(durationHours * this._config.sleepConsolidationBatchesPerHour);

    for (let i = 0; i < batches; i++) {
      // Process working memory items
      const workingItems = this._memory.working.items().slice(0, this._config.sleepConsolidationBatchSize);

      for (const item of workingItems) {
        try {
          const episodicId = `sleep_epi_${item.id}_${Date.now()}`;
          this._memory.episodic.add(
            episodicId,
            item.content,
            {
              module: item.metadata.module as any,
              topic: item.metadata.topic as string
            },
            {
              importance: item.importance * 1.2, // Boost importance during sleep
              tags: [...item.tags, 'sleep_consolidated']
            }
          );

          this._memory.working.remove(item.id);
          result.itemsConsolidated++;
          result.newMemoriesCreated.push(episodicId);

        } catch (error) {
          result.errors.push(`Sleep consolidation error for ${item.id}: ${error}`);
        }
      }

      // Process episodic to semantic transfer
      const epiResult = await this._consolidateEpisodic(result);
      result.errors.push(...epiResult.errors);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Check if consolidation should run
   */
  shouldConsolidate(minInterval: number = 24 * 60 * 60 * 1000): boolean {
    return (Date.now() - this._lastConsolidation) >= minInterval;
  }

  /**
   * Get consolidation statistics
   */
  getStats(): {
    lastConsolidation: number;
    timeSinceConsolidation: number;
    topicBaselines: number;
    queueSize: number;
  } {
    return {
      lastConsolidation: this._lastConsolidation,
      timeSinceConsolidation: this._lastConsolidation > 0
        ? Date.now() - this._lastConsolidation
        : 0,
      topicBaselines: this._topicBaseline.size,
      queueSize: 0 // Queue is managed by HierarchicalMemory
    };
  }

  /**
   * Add event listener
   */
  onEvent(handler: (event: ConsolidationEvent) => void): void {
    this._eventHandlers.add(handler);
  }

  /**
   * Remove event listener
   */
  offEvent(handler: (event: ConsolidationEvent) => void): void {
    this._eventHandlers.delete(handler);
  }

  /**
   * Emit event
   */
  private _emit(event: ConsolidationEvent): void {
    for (const handler of this._eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error('Error in consolidation event handler:', e);
      }
    }
  }
}

// ============================================================================
// Consolidation Event Types
// ============================================================================

export type ConsolidationEvent =
  | ConsolidationCompleteEvent
  | MemoryConsolidatedEvent;

export interface ConsolidationCompleteEvent {
  type: 'consolidation_complete';
  tier: MemoryTier;
  trigger: ConsolidationTrigger;
  result: ConsolidationResult;
  timestamp: number;
}

export interface MemoryConsolidatedEvent extends MemorySystemEvent {
  type: 'memory_consolidated';
  fromTier: MemoryTier;
  toTier: MemoryTier;
  sourceMemoryId: string;
  newMemoryIds: string[];
  timestamp: number;
}

// ============================================================================
// Pattern Extraction Utilities
// ============================================================================

/**
 * Word overlap similarity for clustering
 */
export function wordOverlap(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }

  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Cluster memories by word overlap
 */
export function clusterByOverlap(memories: BaseMemory[], threshold: number = 0.3): BaseMemory[][] {
  const clusters: BaseMemory[][] = [];
  const assigned = new Set<string>();

  for (const memory of memories) {
    if (assigned.has(memory.id)) continue;

    const cluster = [memory];
    assigned.add(memory.id);

    // Find similar memories
    for (const other of memories) {
      if (assigned.has(other.id)) continue;

      const similarity = wordOverlap(memory.content, other.content);
      if (similarity >= threshold) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Extract common words from a cluster
 */
export function extractCommonWords(memories: BaseMemory[], topN: number = 5): Array<{ word: string; frequency: number }> {
  const wordCounts = new Map<string, number>();

  for (const memory of memories) {
    const words = new Set(memory.content.toLowerCase().split(/\s+/));
    for (const word of words) {
      if (word.length > 3) { // Skip short words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }

  return Array.from(wordCounts.entries())
    .map(([word, frequency]) => ({ word, frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, topN);
}

/**
 * Extract pattern name from cluster
 */
export function extractPatternName(memories: BaseMemory[]): string {
  const commonWords = extractCommonWords(memories, 3);
  if (commonWords.length === 0) return 'unnamed_pattern';

  const words = commonWords.map(w => w.word).join('_');
  return `pattern_${words}`;
}
