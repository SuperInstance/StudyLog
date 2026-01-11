/**
 * Memory Consolidation - Episodic to Semantic Clustering
 *
 * Implements memory consolidation inspired by cognitive neuroscience:
 * - Episodic memories (specific events) -> Semantic memories (abstract knowledge)
 * - Sleep-like consolidation cycles
 * - Pattern extraction across related memories
 * - Forgetting curve application
 *
 * StudyLoG.AI Optimizations:
 * - Learning progression tracking
 * - Concept mastery detection
 * - Prerequisite relationship mapping
 * - Spaced repetition scheduling
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

/**
 * Memory consolidation state
 */
export enum ConsolidationState {
  /** New memory, not yet consolidated */
  UNCONSOLIDATED = 'unconsolidated',
  /** In progress of consolidation */
  CONSOLIDATING = 'consolidating',
  /** Successfully consolidated to semantic */
  CONSOLIDATED = 'consolidated',
  /** Marked for forgetting */
  DECAYING = 'decaying',
  /** Fully forgotten (archived) */
  FORGOTTEN = 'forgotten',
}

/**
 * Episodic memory - specific "what-where-when" event
 */
export interface EpisodicMemory {
  id: string;
  studentId: string;
  content: string;
  timestamp: number;
  importance: number; // 1-10
  emotionalValence: number; // -1 to 1

  // Context
  subject?: string;
  topic?: string;
  difficulty?: number; // 1-10
  successLevel?: number; // 0-1

  // Consolidation state
  consolidationState: ConsolidationState;
  consolidationCount: number;
  lastConsolidated: number;

  // Relationships
  relatedMemoryIds: string[];
  sourceSemanticMemoryId?: string;

  // Access patterns
  accessCount: number;
  lastAccessed: number;

  // Tags and metadata
  tags: string[];
  standards?: string[]; // Educational standards (NGSS, CCSS, etc.)
  metadata?: Record<string, unknown>;
}

/**
 * Semantic memory - abstracted knowledge/pattern
 */
export interface SemanticMemory {
  id: string;
  studentId: string;
  concept: string;
  content: string;

  // Consolidation metadata
  sourceEpisodicIds: string[];
  confidence: number; // 0-1
  createdAt: number;
  lastUpdated: number;
  updateCount: number;

  // Learning tracking
  masteryLevel: number; // 0-1
  practiceCount: number;
  successCount: number;
  lastPracticed: number;

  // Prerequisites and related concepts
  prerequisiteIds: string[];
  relatedConceptIds: string[];

  // Forgetting curve
  strength: number; // 0-1, decays over time
  nextReview: number; // Timestamp for spaced repetition

  // Educational alignment
  standards?: string[];
  difficulty?: number;

  // Extracted patterns
  patterns: string[];
  misconceptions?: string[]; // Common misconceptions identified
}

/**
 * Consolidation cluster - related memories being consolidated
 */
export interface ConsolidationCluster {
  id: string;
  studentId: string;
  topic: string;
  episodicMemories: EpisodicMemory[];
  semanticMemory?: SemanticMemory;

  // Cluster quality metrics
  cohesion: number; // How related the memories are
  stability: number; // How stable the cluster is over time
  confidence: number; // Overall confidence in the semantic memory

  // Consolidation status
  createdAt: number;
  lastUpdated: number;
  consolidationCount: number;
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  clustersCreated: number;
  semanticMemoriesCreated: number;
  semanticMemoriesUpdated: number;
  episodicMemoriesConsolidated: number;
  memoriesDecayed: number;

  // Learning insights
  newConceptsLearned: string[];
  masteryLevelsUpdated: Array<{ concept: string; level: number }>;
  prerequisitesDiscovered: Array<{ concept: string; prerequisite: string }>;

  // Scheduled reviews
  reviewsScheduled: Array<{ memoryId: string; dueAt: number }>;
}

/**
 * Consolidation configuration
 */
export interface ConsolidationConfig {
  // Minimum memories to form a cluster
  minClusterSize: number;
  // Time window for clustering (ms)
  clusterTimeWindow: number;
  // Minimum similarity for clustering
  minCohesion: number;
  // Importance threshold for consolidation
  importanceThreshold: number;
  // Forgetting curve parameters
  forgettingDecay: number; // Per day
  // Spaced repetition intervals (days)
  reviewIntervals: number[];
  // Mastery threshold for "learned"
  masteryThreshold: number;
}

/**
 * Default configuration optimized for student learning
 */
export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  minClusterSize: 3,
  clusterTimeWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
  minCohesion: 0.4,
  importanceThreshold: 5.0,
  forgettingDecay: 0.05, // 5% decay per day
  reviewIntervals: [1, 3, 7, 14, 30, 90], // Spaced repetition schedule
  masteryThreshold: 0.8,
};

// ═══════════════════════════════════════════════════════════
// Memory Consolidation Engine
// ═══════════════════════════════════════════════════════════

export class MemoryConsolidationEngine {
  private readonly config: ConsolidationConfig;
  private episodicMemories: Map<string, EpisodicMemory>;
  private semanticMemories: Map<string, SemanticMemory>;
  private clusters: Map<string, ConsolidationCluster>;

  constructor(config: Partial<ConsolidationConfig> = {}) {
    this.config = { ...DEFAULT_CONSOLIDATION_CONFIG, ...config };
    this.episodicMemories = new Map();
    this.semanticMemories = new Map();
    this.clusters = new Map();
  }

  /**
   * Add an episodic memory
   */
  addEpisodicMemory(memory: EpisodicMemory): void {
    memory.consolidationState = ConsolidationState.UNCONSOLIDATED;
    memory.consolidationCount = 0;
    this.episodicMemories.set(memory.id, memory);
  }

  /**
   * Get an episodic memory by ID
   */
  getEpisodicMemory(id: string): EpisodicMemory | undefined {
    return this.episodicMemories.get(id);
  }

  /**
   * Get a semantic memory by ID
   */
  getSemanticMemory(id: string): SemanticMemory | undefined {
    return this.semanticMemories.get(id);
  }

  /**
   * Get all semantic memories for a student
   */
  getSemanticMemoriesForStudent(studentId: string): SemanticMemory[] {
    return Array.from(this.semanticMemories.values()).filter(
      m => m.studentId === studentId
    );
  }

  /**
   * Get episodic memories ready for consolidation
   */
  getMemoriesReadyForConsolidation(studentId: string): EpisodicMemory[] {
    const now = Date.now();
    return Array.from(this.episodicMemories.values()).filter(m => {
      if (m.studentId !== studentId) return false;
      if (m.consolidationState !== ConsolidationState.UNCONSOLIDATED) return false;
      if (m.importance < this.config.importanceThreshold) return false;

      // Check if memory is old enough (simulates sleep consolidation)
      const age = now - m.timestamp;
      return age > 6 * 60 * 60 * 1000; // 6 hours minimum
    });
  }

  /**
   * Run consolidation cycle for a student
   *
   * This simulates the sleep consolidation process:
   * 1. Cluster related episodic memories
   * 2. Extract patterns to create/update semantic memories
   * 3. Apply forgetting curve to old memories
   * 4. Schedule spaced repetition reviews
   */
  async consolidate(studentId: string): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      clustersCreated: 0,
      semanticMemoriesCreated: 0,
      semanticMemoriesUpdated: 0,
      episodicMemoriesConsolidated: 0,
      memoriesDecayed: 0,
      newConceptsLearned: [],
      masteryLevelsUpdated: [],
      prerequisitesDiscovered: [],
      reviewsScheduled: [],
    };

    // 1. Create clusters from related episodic memories
    const clusters = this.createClusters(studentId);
    result.clustersCreated = clusters.length;

    // 2. Consolidate each cluster into semantic memory
    for (const cluster of clusters) {
      const consolidationResult = this.consolidateCluster(cluster);

      if (consolidationResult.created) {
        result.semanticMemoriesCreated++;
        result.newConceptsLearned.push(cluster.topic);
      } else {
        result.semanticMemoriesUpdated++;
      }

      result.episodicMemoriesConsolidated += consolidationResult.consolidatedCount;
      result.masteryLevelsUpdated.push(...consolidationResult.masteryUpdates);
      result.prerequisitesDiscovered.push(...consolidationResult.prerequisites);
    }

    // 3. Apply forgetting curve
    const decayed = this.applyForgettingCurve(studentId);
    result.memoriesDecayed = decayed.length;

    // 4. Schedule reviews
    const reviews = this.scheduleReviews(studentId);
    result.reviewsScheduled = reviews;

    return result;
  }

  /**
   * Create clusters from related episodic memories
   */
  private createClusters(studentId: string): ConsolidationCluster[] {
    const clusters: ConsolidationCluster[] = [];
    const processed = new Set<string>();
    const now = Date.now();

    // Group episodic memories by topic
    const byTopic = new Map<string, EpisodicMemory[]>();
    for (const memory of this.episodicMemories.values()) {
      if (memory.studentId !== studentId) continue;
      if (memory.consolidationState !== ConsolidationState.UNCONSOLIDATED) continue;
      if (processed.has(memory.id)) continue;

      const topic = memory.topic || 'general';
      if (!byTopic.has(topic)) {
        byTopic.set(topic, []);
      }
      byTopic.get(topic)!.push(memory);
    }

    // Create clusters for each topic
    for (const [topic, memories] of byTopic.entries()) {
      if (memories.length < this.config.minClusterSize) continue;

      // Filter by time window
      const recentMemories = memories.filter(m => {
        const age = now - m.timestamp;
        return age <= this.config.clusterTimeWindow;
      });

      if (recentMemories.length < this.config.minClusterSize) continue;

      // Calculate cohesion
      const cohesion = this.calculateCohesion(recentMemories);
      if (cohesion < this.config.minCohesion) continue;

      const clusterId = `cluster_${studentId}_${topic}_${now}`;
      const cluster: ConsolidationCluster = {
        id: clusterId,
        studentId,
        topic,
        episodicMemories: recentMemories,
        cohesion,
        stability: this.calculateStability(recentMemories),
        confidence: 0,
        createdAt: now,
        lastUpdated: now,
        consolidationCount: 0,
      };

      clusters.push(cluster);
      this.clusters.set(clusterId, cluster);

      // Mark memories as being consolidated
      for (const m of recentMemories) {
        m.consolidationState = ConsolidationState.CONSOLIDATING;
        processed.add(m.id);
      }
    }

    return clusters;
  }

  /**
   * Consolidate a cluster into semantic memory
   */
  private consolidateCluster(cluster: ConsolidationCluster): {
    created: boolean;
    consolidatedCount: number;
    masteryUpdates: Array<{ concept: string; level: number }>;
    prerequisites: Array<{ concept: string; prerequisite: string }>;
  } {
    const result = {
      created: false,
      consolidatedCount: 0,
      masteryUpdates: [] as Array<{ concept: string; level: number }>,
      prerequisites: [] as Array<{ concept: string; prerequisite: string }>,
    };

    // Check if semantic memory already exists for this topic
    const existingSemantic = Array.from(this.semanticMemories.values()).find(
      s => s.studentId === cluster.studentId && s.concept === cluster.topic
    );

    if (existingSemantic) {
      // Update existing semantic memory
      this.updateSemanticMemory(existingSemantic, cluster);
      result.consolidatedCount = cluster.episodicMemories.length;
      result.masteryUpdates.push({
        concept: cluster.topic,
        level: existingSemantic.masteryLevel,
      });
    } else {
      // Create new semantic memory
      const semantic = this.createSemanticMemory(cluster);
      this.semanticMemories.set(semantic.id, semantic);
      cluster.semanticMemory = semantic;
      result.created = true;
      result.consolidatedCount = cluster.episodicMemories.length;
      result.masteryUpdates.push({
        concept: cluster.topic,
        level: semantic.masteryLevel,
      });
    }

    // Mark episodic memories as consolidated
    for (const memory of cluster.episodicMemories) {
      memory.consolidationState = ConsolidationState.CONSOLIDATED;
      memory.consolidationCount++;
      memory.lastConsolidated = Date.now();
      memory.sourceSemanticMemoryId = cluster.semanticMemory?.id;
    }

    // Discover prerequisite relationships
    const prereqs = this.discoverPrerequisites(cluster);
    result.prerequisites.push(...prereqs);

    cluster.consolidationCount++;
    cluster.lastUpdated = Date.now();

    return result;
  }

  /**
   * Create a new semantic memory from a cluster
   */
  private createSemanticMemory(cluster: ConsolidationCluster): SemanticMemory {
    const memories = cluster.episodicMemories;
    const now = Date.now();

    // Calculate mastery from success levels
    const successLevels = memories.map(m => m.successLevel ?? 0.5).filter(s => s > 0);
    const avgSuccess = successLevels.length > 0
      ? successLevels.reduce((a, b) => a + b, 0) / successLevels.length
      : 0.5;

    // Calculate confidence from cohesion and cluster size
    const confidence = Math.min(
      1,
      (cluster.cohesion * 0.6) + (Math.min(memories.length / 10, 1) * 0.4)
    );

    // Extract patterns
    const patterns = this.extractPatterns(memories);

    // Generate content
    const successfulMemories = memories.filter(m => (m.successLevel ?? 0) > 0.6);
    const content = this.generateSemanticContent(cluster.topic, successfulMemories, patterns);

    const semantic: SemanticMemory = {
      id: `semantic_${cluster.studentId}_${cluster.topic}_${now}`,
      studentId: cluster.studentId,
      concept: cluster.topic,
      content,
      sourceEpisodicIds: memories.map(m => m.id),
      confidence,
      createdAt: now,
      lastUpdated: now,
      updateCount: 0,
      masteryLevel: avgSuccess,
      practiceCount: memories.length,
      successCount: successfulMemories.length,
      lastPracticed: now,
      strength: 1.0,
      nextReview: now + (this.config.reviewIntervals[0] * 24 * 60 * 60 * 1000),
      prerequisiteIds: [],
      relatedConceptIds: [],
      standards: memories[0]?.standards,
      difficulty: memories[0]?.difficulty,
      patterns,
    };

    return semantic;
  }

  /**
   * Update an existing semantic memory with new cluster data
   */
  private updateSemanticMemory(semantic: SemanticMemory, cluster: ConsolidationCluster): void {
    const now = Date.now();

    // Add new episodic sources
    for (const memory of cluster.episodicMemories) {
      if (!semantic.sourceEpisodicIds.includes(memory.id)) {
        semantic.sourceEpisodicIds.push(memory.id);
      }
    }

    // Update practice counts
    const newSuccesses = cluster.episodicMemories.filter(m => (m.successLevel ?? 0) > 0.6).length;
    semantic.practiceCount += cluster.episodicMemories.length;
    semantic.successCount += newSuccesses;

    // Recalculate mastery (exponential moving average)
    const newMastery = newSuccesses / cluster.episodicMemories.length;
    semantic.masteryLevel = (semantic.masteryLevel * 0.7) + (newMastery * 0.3);

    // Update confidence (increases with more evidence)
    semantic.confidence = Math.min(1, semantic.confidence + 0.05);

    // Reset strength on practice
    semantic.strength = Math.min(1, semantic.strength + 0.2);

    // Update content with new patterns
    const newPatterns = this.extractPatterns(cluster.episodicMemories);
    for (const pattern of newPatterns) {
      if (!semantic.patterns.includes(pattern)) {
        semantic.patterns.push(pattern);
      }
    }

    semantic.lastUpdated = now;
    semantic.updateCount++;
    semantic.lastPracticed = now;

    // Schedule next review
    this.scheduleNextReview(semantic);
  }

  /**
   * Apply forgetting curve to semantic memories
   */
  private applyForgettingCurve(studentId: string): EpisodicMemory[] {
    const now = Date.now();
    const decayed: EpisodicMemory[] = [];
    const oneDay = 24 * 60 * 60 * 1000;

    for (const semantic of this.semanticMemories.values()) {
      if (semantic.studentId !== studentId) continue;

      const daysSincePractice = (now - semantic.lastPracticed) / oneDay;
      if (daysSincePractice < 1) continue;

      // Apply exponential decay
      semantic.strength *= Math.pow(1 - this.config.forgettingDecay, daysSincePractice);

      // If strength is low, mark related episodic memories as decaying
      if (semantic.strength < 0.3) {
        for (const episodicId of semantic.sourceEpisodicIds) {
          const episodic = this.episodicMemories.get(episodicId);
          if (episodic && episodic.consolidationState === ConsolidationState.CONSOLIDATED) {
            episodic.consolidationState = ConsolidationState.DECAYING;
            decayed.push(episodic);
          }
        }
      }
    }

    return decayed;
  }

  /**
   * Schedule spaced repetition reviews
   */
  private scheduleReviews(studentId: string): Array<{ memoryId: string; dueAt: number }> {
    const reviews: Array<{ memoryId: string; dueAt: number }> = [];
    const now = Date.now();

    for (const semantic of this.semanticMemories.values()) {
      if (semantic.studentId !== studentId) continue;

      if (semantic.nextReview <= now) {
        // Move to next review interval
        this.scheduleNextReview(semantic);
        reviews.push({
          memoryId: semantic.id,
          dueAt: semantic.nextReview,
        });
      }
    }

    return reviews;
  }

  /**
   * Schedule next review for a semantic memory using spaced repetition
   */
  private scheduleNextReview(semantic: SemanticMemory): void {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Find appropriate interval based on mastery
    let intervalIndex = 0;
    if (semantic.masteryLevel >= 0.9) intervalIndex = 5;
    else if (semantic.masteryLevel >= 0.8) intervalIndex = 4;
    else if (semantic.masteryLevel >= 0.7) intervalIndex = 3;
    else if (semantic.masteryLevel >= 0.6) intervalIndex = 2;
    else if (semantic.masteryLevel >= 0.5) intervalIndex = 1;

    const intervalDays = this.config.reviewIntervals[intervalIndex] ?? this.config.reviewIntervals[0];
    semantic.nextReview = now + (intervalDays * oneDay);
  }

  /**
   * Calculate cohesion (similarity) between memories in a cluster
   */
  private calculateCohesion(memories: EpisodicMemory[]): number {
    if (memories.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const similarity = this.calculateSimilarity(memories[i], memories[j]);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Calculate similarity between two memories
   */
  private calculateSimilarity(m1: EpisodicMemory, m2: EpisodicMemory): number {
    let similarity = 0;

    // Topic match
    if (m1.topic === m2.topic) similarity += 0.4;

    // Subject match
    if (m1.subject === m2.subject) similarity += 0.2;

    // Content similarity (word overlap)
    const words1 = new Set(m1.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(m2.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    if (union > 0) {
      similarity += (intersection / union) * 0.3;
    }

    // Tag overlap
    if (m1.tags && m2.tags) {
      const tagOverlap = m1.tags.filter(t => m2.tags?.includes(t)).length;
      const totalTags = new Set([...m1.tags, ...m2.tags]).size;
      if (totalTags > 0) {
        similarity += (tagOverlap / totalTags) * 0.1;
      }
    }

    return Math.min(1, similarity);
  }

  /**
   * Calculate cluster stability over time
   */
  private calculateStability(memories: EpisodicMemory[]): number {
    if (memories.length < 2) return 1;

    // Check temporal consistency
    const timestamps = memories.map(m => m.timestamp).sort((a, b) => a - b);
    const span = timestamps[timestamps.length - 1] - timestamps[0];
    const avgGap = span / (memories.length - 1);

    // More consistent practice = higher stability
    const consistencyScore = Math.min(1, 7 * 24 * 60 * 60 * 1000 / (avgGap + 1));

    // Check success rate consistency
    const successRates = memories.map(m => m.successLevel ?? 0.5);
    const avgSuccess = successRates.reduce((a, b) => a + b, 0) / successRates.length;
    const variance = successRates.reduce((sum, s) => sum + Math.pow(s - avgSuccess, 2), 0) / successRates.length;
    const successStability = Math.max(0, 1 - variance);

    return (consistencyScore * 0.6) + (successStability * 0.4);
  }

  /**
   * Extract patterns from a group of memories
   */
  private extractPatterns(memories: EpisodicMemory[]): string[] {
    const patterns: string[] = [];

    // Common topics
    const topics = memories.map(m => m.topic).filter(Boolean) as string[];
    const uniqueTopics = [...new Set(topics)];
    if (uniqueTopics.length > 0) {
      patterns.push(`Focus on ${uniqueTopics.join(', ')}`);
    }

    // Success patterns
    const successes = memories.filter(m => (m.successLevel ?? 0) > 0.6);
    if (successes.length > memories.length * 0.7) {
      patterns.push('Consistent success pattern');
    } else if (successes.length < memories.length * 0.3) {
      patterns.push('Needs additional practice');
    }

    // Emotional pattern
    const avgEmotion = memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;
    if (avgEmotion > 0.3) {
      patterns.push('Positive emotional association');
    } else if (avgEmotion < -0.3) {
      patterns.push('Frustration point - needs support');
    }

    // Difficulty progression
    const difficulties = memories.map(m => m.difficulty).filter(Boolean) as number[];
    if (difficulties.length >= 2) {
      const firstHalf = difficulties.slice(0, Math.floor(difficulties.length / 2));
      const secondHalf = difficulties.slice(Math.floor(difficulties.length / 2));
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      if (avgSecond > avgFirst + 1) {
        patterns.push('Progressing to harder problems');
      }
    }

    return patterns;
  }

  /**
   * Discover prerequisite relationships
   */
  private discoverPrerequisites(cluster: ConsolidationCluster): Array<{ concept: string; prerequisite: string }> {
    const prerequisites: Array<{ concept: string; prerequisite: string }> = [];

    // Look for temporal ordering in memories
    const sortedMemories = [...cluster.episodicMemories].sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < sortedMemories.length; i++) {
      const earlier = sortedMemories[i - 1];
      const later = sortedMemories[i];

      // If earlier memory has lower difficulty, it might be a prerequisite
      if (earlier.difficulty && later.difficulty && earlier.difficulty < later.difficulty - 1) {
        // Check for topic relationship
        if (earlier.topic && later.topic && earlier.topic !== later.topic) {
          prerequisites.push({
            concept: later.topic,
            prerequisite: earlier.topic,
          });
        }
      }
    }

    return prerequisites;
  }

  /**
   * Generate semantic memory content
   */
  private generateSemanticContent(
    topic: string,
    memories: EpisodicMemory[],
    patterns: string[]
  ): string {
    const parts: string[] = [];

    parts.push(`Learned about ${topic}.`);

    if (patterns.length > 0) {
      parts.push(`Key insights: ${patterns.join('; ')}.`);
    }

    // Add summary from most recent successful memory
    const recentSuccess = memories
      .filter(m => (m.successLevel ?? 0) > 0.6)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (recentSuccess) {
      parts.push(`Recent understanding: ${recentSuccess.content.slice(0, 100)}...`);
    }

    return parts.join(' ');
  }

  /**
   * Record a memory access (reinforces the memory)
   */
  recordAccess(memoryId: string): void {
    const episodic = this.episodicMemories.get(memoryId);
    if (episodic) {
      episodic.accessCount++;
      episodic.lastAccessed = Date.now();

      // Reinforce related semantic memory
      if (episodic.sourceSemanticMemoryId) {
        const semantic = this.semanticMemories.get(episodic.sourceSemanticMemoryId);
        if (semantic) {
          semantic.strength = Math.min(1, semantic.strength + 0.1);
        }
      }
    }
  }

  /**
   * Get consolidation statistics for a student
   */
  getStats(studentId: string): {
    episodicCount: number;
    semanticCount: number;
    consolidatedCount: number;
    avgMastery: number;
      dueForReview: number;
    } {
    const episodic = Array.from(this.episodicMemories.values())
      .filter(m => m.studentId === studentId);
    const semantic = Array.from(this.semanticMemories.values())
      .filter(m => m.studentId === studentId);
    const consolidated = episodic.filter(m => m.consolidationState === ConsolidationState.CONSOLIDATED);
    const avgMastery = semantic.length > 0
      ? semantic.reduce((sum, m) => sum + m.masteryLevel, 0) / semantic.length
      : 0;
    const now = Date.now();
    const dueForReview = semantic.filter(m => m.nextReview <= now).length;

    return {
      episodicCount: episodic.length,
      semanticCount: semantic.length,
      consolidatedCount: consolidated.length,
      avgMastery,
      dueForReview,
    };
  }

  /**
   * Export state for persistence
   */
  exportState(): {
    episodicMemories: EpisodicMemory[];
    semanticMemories: SemanticMemory[];
    clusters: ConsolidationCluster[];
  } {
    return {
      episodicMemories: Array.from(this.episodicMemories.values()),
      semanticMemories: Array.from(this.semanticMemories.values()),
      clusters: Array.from(this.clusters.values()),
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: {
    episodicMemories?: EpisodicMemory[];
    semanticMemories?: SemanticMemory[];
    clusters?: ConsolidationCluster[];
  }): void {
    if (state.episodicMemories) {
      for (const m of state.episodicMemories) {
        this.episodicMemories.set(m.id, m);
      }
    }
    if (state.semanticMemories) {
      for (const m of state.semanticMemories) {
        this.semanticMemories.set(m.id, m);
      }
    }
    if (state.clusters) {
      for (const c of state.clusters) {
        this.clusters.set(c.id, c);
      }
    }
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.episodicMemories.clear();
    this.semanticMemories.clear();
    this.clusters.clear();
  }
}

/**
 * Factory function to create a consolidation engine
 */
export function createConsolidationEngine(
  config?: Partial<ConsolidationConfig>
): MemoryConsolidationEngine {
  return new MemoryConsolidationEngine(config);
}
