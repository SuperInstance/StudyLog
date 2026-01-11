/**
 * StudyLoG.AI - Memory Consolidation System
 *
 * Adapted from DMLog's memory_system.py pattern.
 * Implements hierarchical memory inspired by neuroscience for learning management.
 *
 * Memory Tiers:
 * - WORKING (0-1 hr): Current problem context, active learning
 * - SHORT-TERM (1-6 hr): Session buffer, recent exercises
 * - LONG-TERM (1+ wk): Consolidated knowledge, learned skills
 *
 * Memory Types:
 * - EPISODIC: Specific learning events ("What/When/Where")
 * - SEMANTIC: Abstracted patterns and rules
 * - PROCEDURAL: Skills and know-how
 *
 * Key Features:
 * - Temporal landmarks (first time, breakthrough moments)
 * - Memory consolidation (episodic -> semantic)
 * - Autobiographical narrative generation
 * - Learning milestone detection
 * - Forgetting curve tracking
 */

/**
 * Memory types in the hierarchy
 */
export enum MemoryType {
  WORKING = 'working',
  SHORT_TERM = 'short_term',
  LONG_TERM = 'long_term',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
}

/**
 * Memory importance levels
 */
export enum MemoryImportance {
  TRIVIAL = 0,
  LOW = 1,
  NORMAL = 3,
  HIGH = 5,
  CRITICAL = 8,
  DEFINING = 10,
}

/**
 * Temporal landmark types (memorable events)
 */
export enum TemporalLandmarkType {
  FIRST_TIME = 'first_time', // First time doing X
  BREAKTHROUGH = 'breakthrough', // Understanding "clicked"
  MILESTONE = 'milestone', // Significant achievement
  TRANSITION = 'transition', // Context/location change
  EMOTIONAL_PEAK = 'emotional_peak', // High emotional impact
  SOCIAL = 'social', // Collaborative learning event
  FAILURE_POINT = 'failure_point', // Important learning from failure
}

/**
 * A memory record
 */
export interface Memory {
  id: string;
  studentId: string;
  content: string;
  memoryType: MemoryType;
  tier: MemoryType; // WORKING, SHORT_TERM, or LONG_TERM
  importance: MemoryImportance;
  emotionalValence: number; // -1 (negative) to 1 (positive)
  timestamp: number;
  expiresAt?: number;
  accessCount: number;
  lastAccessed: number;
  consolidationCount: number;

  // Context
  topic?: string;
  location?: string; // Module or learning context
  participants: string[]; // Other students involved
  relatedConcepts: string[];

  // Temporal properties
  isTemporalLandmark: boolean;
  landmarkType?: TemporalLandmarkType;
  landmarkReason?: string;

  // Metadata
  source?: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * A semantic memory (abstracted knowledge)
 */
export interface SemanticMemory {
  id: string;
  studentId: string;
  content: string;
  patterns: string[];
  rules: string[];
  confidence: number; // 0-1
  sourceMemoryIds: string[]; // Episodic memories that created this
  timestamp: number;
  lastUpdated: number;
  topic: string;
  examples: string[];
}

/**
 * A procedural memory (skill/know-how)
 */
export interface ProceduralMemory {
  id: string;
  studentId: string;
  skill: string;
  proficiencyLevel: number; // 0-1
  practiceCount: number;
  successCount: number;
  lastPracticed: number;
  strength: number; // Forgetting curve position
  sourceMemoryIds: string[];
  metadata: Record<string, unknown>;
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  consolidatedMemories: number;
  newSemanticMemories: SemanticMemory[];
  newProceduralMemories: ProceduralMemory[];
  forgottenMemories: string[];
  updatedStrengths: Record<string, number>;
}

/**
 * Student learning profile
 */
export interface LearningProfile {
  studentId: string;
  episodicMemories: Map<string, Memory>;
  semanticMemories: Map<string, SemanticMemory>;
  proceduralMemories: Map<string, ProceduralMemory>;

  // Tier tracking
  workingMemory: Set<string>;
  shortTermMemory: Set<string>;
  longTermMemory: Set<string>;

  // Learning state
  totalImportanceAccumulated: number;
  lastConsolidation: number;
  consolidationCount: number;

  // Temporal landmarks
  landmarks: Map<string, Memory>;

  // Metrics
  memoriesByTopic: Map<string, number>;
  avgRetention: number;
}

/**
 * Autobiographical narrative chapter
 */
export interface NarrativeChapter {
  period: string; // "Getting Started", "First Breakthrough", etc.
  timeRange: { start: number; end: number };
  memories: Memory[];
  themes: string[];
  growthSummary: string;
  landmarkEvents: string[];
}

/**
 * Memory Consolidation Engine
 *
 * Manages hierarchical memory with consolidation.
 */
export class MemoryConsolidationEngine {
  // Threshold for triggering consolidation
  private readonly REFLECTION_THRESHOLD = 15;
  // Default memory duration (ms)
  private readonly WORKING_MEMORY_DURATION = 60 * 60 * 1000; // 1 hour
  private readonly SHORT_TERM_DURATION = 6 * 60 * 60 * 1000; // 6 hours
  // Importance decay rate
  private readonly IMPORTANCE_DECAY = 0.98;
  // Forgetting curve constant
  private readonly FORGETTING_CONSTANT = 0.9;

  private profiles: Map<string, LearningProfile>;
  private globalConsolidations: number;

  constructor() {
    this.profiles = new Map();
    this.globalConsolidations = 0;
  }

  /**
   * Get or create a student's learning profile
   */
  private getProfile(studentId: string): LearningProfile {
    if (!this.profiles.has(studentId)) {
      this.profiles.set(studentId, {
        studentId,
        episodicMemories: new Map(),
        semanticMemories: new Map(),
        proceduralMemories: new Map(),
        workingMemory: new Set(),
        shortTermMemory: new Set(),
        longTermMemory: new Set(),
        totalImportanceAccumulated: 0,
        lastConsolidation: Date.now(),
        consolidationCount: 0,
        landmarks: new Map(),
        memoriesByTopic: new Map(),
        avgRetention: 1.0,
      });
    }
    return this.profiles.get(studentId)!;
  }

  /**
   * Store a new memory
   */
  storeMemory(
    studentId: string,
    content: string,
    memoryType: MemoryType,
    options: {
      importance?: MemoryImportance;
      emotionalValence?: number;
      topic?: string;
      location?: string;
      participants?: string[];
      relatedConcepts?: string[];
      source?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): Memory {
    const profile = this.getProfile(studentId);

    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Detect temporal landmarks
    const landmarkResult = this.detectTemporalLandmark(
      studentId,
      content,
      options.topic,
      memoryType,
      options.importance
    );

    const memory: Memory = {
      id: memoryId,
      studentId,
      content,
      memoryType,
      tier: MemoryType.WORKING,
      importance: options.importance ?? MemoryImportance.NORMAL,
      emotionalValence: options.emotionalValence ?? 0,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccessed: Date.now(),
      consolidationCount: 0,
      topic: options.topic,
      location: options.location,
      participants: options.participants ?? [],
      relatedConcepts: options.relatedConcepts ?? [],
      isTemporalLandmark: landmarkResult.isLandmark,
      landmarkType: landmarkResult.type,
      landmarkReason: landmarkResult.reason,
      source: options.source,
      tags: options.tags ?? [],
      metadata: options.metadata ?? {},
    };

    // Store in episodic memories
    profile.episodicMemories.set(memoryId, memory);

    // Add to working memory
    profile.workingMemory.add(memoryId);

    // Track if landmark
    if (memory.isTemporalLandmark) {
      profile.landmarks.set(memoryId, memory);
    }

    // Update topic tracking
    if (memory.topic) {
      profile.memoriesByTopic.set(
        memory.topic,
        (profile.memoriesByTopic.get(memory.topic) ?? 0) + 1
      );
    }

    // Accumulate importance
    profile.totalImportanceAccumulated += memory.importance;

    return memory;
  }

  /**
   * Detect if this memory is a temporal landmark
   */
  private detectTemporalLandmark(
    studentId: string,
    content: string,
    topic: string | undefined,
    memoryType: MemoryType,
    importance: MemoryImportance = MemoryImportance.NORMAL
  ): { isLandmark: boolean; type?: TemporalLandmarkType; reason?: string } {
    const profile = this.getProfile(studentId);
    const contentLower = content.toLowerCase();

    // Check for high importance FIRST (before first-time check)
    // This ensures milestone events are properly categorized
    if (importance >= MemoryImportance.CRITICAL) {
      return {
        isLandmark: true,
        type: TemporalLandmarkType.MILESTONE,
        reason: 'Critical importance event',
      };
    }

    // Check for collaborative learning (before first-time)
    if (contentLower.includes('together') || contentLower.includes('helped') || contentLower.includes('pair')) {
      return {
        isLandmark: true,
        type: TemporalLandmarkType.SOCIAL,
        reason: 'Collaborative learning event',
      };
    }

    // Check for first-time events
    if (contentLower.includes('first time') || contentLower.includes('first successful')) {
      return {
        isLandmark: true,
        type: TemporalLandmarkType.FIRST_TIME,
        reason: 'First time accomplishment',
      };
    }

    // Check for breakthrough moments
    if (
      contentLower.includes('clicked') ||
      contentLower.includes('understood') ||
      contentLower.includes('breakthrough') ||
      contentLower.includes('finally got it')
    ) {
      return {
        isLandmark: true,
        type: TemporalLandmarkType.BREAKTHROUGH,
        reason: 'Understanding breakthrough',
      };
    }

    // Check for high emotional content
    const emotionalWords = ['excited', 'proud', 'frustrated', 'stuck', 'amazing', 'finally'];
    if (emotionalWords.some((word) => contentLower.includes(word))) {
      return {
        isLandmark: true,
        type: TemporalLandmarkType.EMOTIONAL_PEAK,
        reason: 'High emotional impact',
      };
    }

    // Check for topic first time
    if (topic) {
      const topicMemories = Array.from(profile.episodicMemories.values()).filter(
        (m) => m.topic === topic
      );
      if (topicMemories.length === 0) {
        return {
          isLandmark: true,
          type: TemporalLandmarkType.FIRST_TIME,
          reason: `First memory in topic: ${topic}`,
        };
      }
    }

    return { isLandmark: false };
  }

  /**
   * Retrieve relevant memories
   */
  retrieveMemories(
    studentId: string,
    query?: {
      topic?: string;
      memoryType?: MemoryType;
      tier?: MemoryType;
      minImportance?: MemoryImportance;
      limit?: number;
      includeExpired?: boolean;
    }
  ): Memory[] {
    const profile = this.getProfile(studentId);
    const now = Date.now();
    const results: Memory[] = [];

    for (const memory of profile.episodicMemories.values()) {
      // Skip expired memories unless requested
      if (!query?.includeExpired && memory.expiresAt && memory.expiresAt < now) {
        continue;
      }

      // Apply filters
      if (query?.topic && memory.topic !== query.topic) continue;
      if (query?.memoryType && memory.memoryType !== query.memoryType) continue;
      if (query?.tier && memory.tier !== query.tier) continue;
      if (query?.minImportance && memory.importance < query.minImportance) continue;

      results.push(memory);
    }

    // Sort by recency and importance
    results.sort((a, b) => {
      // Landmarks first
      if (a.isTemporalLandmark && !b.isTemporalLandmark) return -1;
      if (!a.isTemporalLandmark && b.isTemporalLandmark) return 1;

      // Then by importance
      if (b.importance !== a.importance) return b.importance - a.importance;

      // Then by recency
      return b.timestamp - a.timestamp;
    });

    // Apply limit
    if (query?.limit) {
      return results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Access a memory (updates access stats)
   */
  accessMemory(studentId: string, memoryId: string): Memory | null {
    const profile = this.getProfile(studentId);
    const memory = profile.episodicMemories.get(memoryId);

    if (!memory) return null;

    memory.accessCount += 1;
    memory.lastAccessed = Date.now();

    // Reinforce memory through access
    memory.importance = Math.min(
      MemoryImportance.DEFINING,
      memory.importance + 0.5
    );

    return memory;
  }

  /**
   * Check if consolidation is needed
   */
  needsConsolidation(studentId: string): boolean {
    const profile = this.getProfile(studentId);
    return profile.totalImportanceAccumulated >= this.REFLECTION_THRESHOLD;
  }

  /**
   * Consolidate memories (episodic -> semantic/procedural)
   */
  consolidateMemories(studentId: string): ConsolidationResult {
    const profile = this.getProfile(studentId);
    const now = Date.now();

    // Move memories between tiers
    this.moveMemoriesBetweenTiers(profile, now);

    // Consolidate episodic to semantic
    const semanticMemories = this.consolidateToSemantic(profile);

    // Consolidate episodic to procedural
    const proceduralMemories = this.consolidateToProcedural(profile);

    // Apply forgetting curve
    const forgotten = this.applyForgettingCurve(profile);

    // Reset accumulation
    profile.totalImportanceAccumulated = 0;
    profile.lastConsolidation = now;
    profile.consolidationCount += 1;
    this.globalConsolidations += 1;

    return {
      consolidatedMemories: semanticMemories.length + proceduralMemories.length,
      newSemanticMemories: semanticMemories,
      newProceduralMemories: proceduralMemories,
      forgottenMemories: forgotten,
      updatedStrengths: this.calculateStrengths(profile),
    };
  }

  /**
   * Move memories between tiers based on time and access
   */
  private moveMemoriesBetweenTiers(profile: LearningProfile, now: number): void {
    const workingToPromote: string[] = [];
    const shortTermToPromote: string[] = [];
    const toExpire: string[] = [];

    for (const [memoryId, memory] of profile.episodicMemories.entries()) {
      const age = now - memory.timestamp;

      // Check for tier transitions
      if (memory.tier === MemoryType.WORKING) {
        if (age > this.WORKING_MEMORY_DURATION || memory.isTemporalLandmark) {
          workingToPromote.push(memoryId);
        }
      } else if (memory.tier === MemoryType.SHORT_TERM) {
        if (age > this.SHORT_TERM_DURATION || memory.isTemporalLandmark) {
          shortTermToPromote.push(memoryId);
        }
      }

      // Check for expiration
      if (memory.expiresAt && memory.expiresAt < now && !memory.isTemporalLandmark) {
        toExpire.push(memoryId);
      }
    }

    // Promote memories
    for (const memoryId of workingToPromote) {
      const memory = profile.episodicMemories.get(memoryId);
      if (memory) {
        memory.tier = MemoryType.SHORT_TERM;
        profile.workingMemory.delete(memoryId);
        profile.shortTermMemory.add(memoryId);
      }
    }

    for (const memoryId of shortTermToPromote) {
      const memory = profile.episodicMemories.get(memoryId);
      if (memory) {
        memory.tier = MemoryType.LONG_TERM;
        profile.shortTermMemory.delete(memoryId);
        profile.longTermMemory.add(memoryId);
      }
    }

    // Remove expired memories
    for (const memoryId of toExpire) {
      profile.episodicMemories.delete(memoryId);
      profile.workingMemory.delete(memoryId);
      profile.shortTermMemory.delete(memoryId);
    }
  }

  /**
   * Consolidate episodic memories into semantic knowledge
   */
  private consolidateToSemantic(profile: LearningProfile): SemanticMemory[] {
    const newSemantics: SemanticMemory[] = [];

    // Group episodic memories by topic
    const byTopic = new Map<string, Memory[]>();
    for (const memory of profile.episodicMemories.values()) {
      if (memory.memoryType === MemoryType.EPISODIC && memory.topic) {
        if (!byTopic.has(memory.topic)) {
          byTopic.set(memory.topic, []);
        }
        byTopic.get(memory.topic)!.push(memory);
      }
    }

    // Look for patterns in each topic
    for (const [topic, memories] of byTopic.entries()) {
      // Need at least 3 memories to consolidate
      if (memories.length < 3) continue;

      // Check if we already have a semantic memory for this
      const existingId = `sem_${topic}`;
      if (profile.semanticMemories.has(existingId)) {
        // Update existing
        const existing = profile.semanticMemories.get(existingId)!;
        existing.sourceMemoryIds.push(...memories.map((m) => m.id).slice(-3));
        existing.lastUpdated = Date.now();
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        continue;
      }

      // Extract patterns from recent memories
      const recentMemories = memories
        .filter((m) => Date.now() - m.timestamp < this.SHORT_TERM_DURATION)
        .slice(-5);

      const patterns = this.extractPatterns(recentMemories);
      const rules = this.extractRules(recentMemories);

      if (patterns.length > 0 || rules.length > 0) {
        const semantic: SemanticMemory = {
          id: existingId,
          studentId: profile.studentId,
          content: `Learned about ${topic}: ${patterns.join(', ')}`,
          patterns,
          rules,
          confidence: 0.5,
          sourceMemoryIds: recentMemories.map((m) => m.id),
          timestamp: Date.now(),
          lastUpdated: Date.now(),
          topic,
          examples: recentMemories.map((m) => m.content).slice(0, 3),
        };

        profile.semanticMemories.set(existingId, semantic);
        newSemantics.push(semantic);
      }
    }

    return newSemantics;
  }

  /**
   * Consolidate episodic memories into procedural skills
   */
  private consolidateToProcedural(profile: LearningProfile): ProceduralMemory[] {
    const newProcedural: ProceduralMemory[] = [];

    // Look for repeated successful actions
    const actionPatterns = new Map<string, { memories: Memory[]; successes: number }>();

    for (const memory of profile.episodicMemories.values()) {
      // Extract action/skill from content
      const skillMatch = memory.content.match(/(?:learned|practiced|used|applied)\s+(\w+)/i);
      if (skillMatch) {
        const skill = skillMatch[1].toLowerCase();

        if (!actionPatterns.has(skill)) {
          actionPatterns.set(skill, { memories: [], successes: 0 });
        }

        const pattern = actionPatterns.get(skill)!;
        pattern.memories.push(memory);

        // Check if this was a successful application
        if (memory.emotionalValence > 0 || memory.importance >= MemoryImportance.HIGH) {
          pattern.successes += 1;
        }
      }
    }

    // Create procedural memories for well-practiced skills
    for (const [skill, data] of actionPatterns.entries()) {
      if (data.memories.length < 3) continue;

      const existingId = `proc_${skill}`;
      const proficiency = Math.min(1, data.successes / data.memories.length);

      if (profile.proceduralMemories.has(existingId)) {
        // Update existing
        const existing = profile.proceduralMemories.get(existingId)!;
        existing.practiceCount += data.memories.length;
        existing.proficiencyLevel = Math.min(1, (existing.proficiencyLevel + proficiency) / 2);
        existing.lastPracticed = Date.now();
        existing.strength = 1; // Reset strength on practice
        continue;
      }

      if (proficiency >= 0.5) {
        const procedural: ProceduralMemory = {
          id: existingId,
          studentId: profile.studentId,
          skill,
          proficiencyLevel: proficiency,
          practiceCount: data.memories.length,
          successCount: data.successes,
          lastPracticed: Date.now(),
          strength: 1,
          sourceMemoryIds: data.memories.map((m) => m.id),
          metadata: {},
        };

        profile.proceduralMemories.set(existingId, procedural);
        newProcedural.push(procedural);
      }
    }

    return newProcedural;
  }

  /**
   * Extract patterns from memories
   */
  private extractPatterns(memories: Memory[]): string[] {
    const patterns: string[] = [];

    // Look for common themes
    const topics = memories.map((m) => m.topic).filter(Boolean) as string[];
    const uniqueTopics = [...new Set(topics)];
    if (uniqueTopics.length > 0) {
      patterns.push(`Focus areas: ${uniqueTopics.join(', ')}`);
    }

    // Look for success patterns
    const successes = memories.filter((m) => m.emotionalValence > 0);
    if (successes.length > memories.length / 2) {
      patterns.push('Generally positive outcomes');
    }

    // Look for emotional patterns
    const avgEmotion =
      memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;
    if (avgEmotion > 0.3) {
      patterns.push('Positive emotional association');
    } else if (avgEmotion < -0.3) {
      patterns.push('Challenging area - needs support');
    }

    return patterns;
  }

  /**
   * Extract rules from memories
   */
  private extractRules(memories: Memory[]): string[] {
    const rules: string[] = [];

    // Look for common successful approaches
    const successes = memories.filter((m) => m.emotionalValence > 0);
    if (successes.length >= 2) {
      rules.push('Practice leads to improvement');
    }

    // Look for timing patterns
    const timestamps = memories.map((m) => m.timestamp).sort((a, b) => a - b);
    if (timestamps.length > 1) {
      const avgInterval = (timestamps[timestamps.length - 1] - timestamps[0]) / timestamps.length;
      if (avgInterval < 24 * 60 * 60 * 1000) {
        rules.push('Daily practice recommended');
      }
    }

    return rules;
  }

  /**
   * Apply forgetting curve to procedural memories
   */
  private applyForgettingCurve(profile: LearningProfile): string[] {
    const forgotten: string[] = [];
    const now = Date.now();

    for (const [id, procedural] of profile.proceduralMemories.entries()) {
      const timeSincePractice = now - procedural.lastPracticed;
      const daysSincePractice = timeSincePractice / (24 * 60 * 60 * 1000);

      // Apply exponential decay
      procedural.strength *= Math.pow(this.FORGETTING_CONSTANT, daysSincePractice);

      // Mark for forgetting if strength is too low
      if (procedural.strength < 0.3) {
        forgotten.push(id);
      }
    }

    // Remove forgotten procedural memories (but keep episodic record)
    for (const id of forgotten) {
      profile.proceduralMemories.delete(id);
    }

    return forgotten;
  }

  /**
   * Calculate memory strengths for all procedural skills
   */
  private calculateStrengths(profile: LearningProfile): Record<string, number> {
    const strengths: Record<string, number> = {};

    for (const [id, procedural] of profile.proceduralMemories.entries()) {
      strengths[procedural.skill] = procedural.strength;
    }

    return strengths;
  }

  /**
   * Generate autobiographical narrative from memories
   */
  generateAutobiographicalNarrative(studentId: string): {
    chapters: NarrativeChapter[];
    summary: string;
    totalMemories: number;
    landmarksCount: number;
    themes: string[];
  } {
    const profile = this.getProfile(studentId);
    const memories = Array.from(profile.episodicMemories.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    if (memories.length === 0) {
      return {
        chapters: [],
        summary: 'No memories yet. The learning journey is about to begin.',
        totalMemories: 0,
        landmarksCount: 0,
        themes: [],
      };
    }

    const chapters: NarrativeChapter[] = [];
    const landmarks = Array.from(profile.landmarks.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Group memories into chapters
    const chapterSize = Math.max(5, Math.floor(memories.length / 5));
    for (let i = 0; i < memories.length; i += chapterSize) {
      const chapterMemories = memories.slice(i, i + chapterSize);
      const chapterLandmarks = chapterMemories.filter((m) => m.isTemporalLandmark);

      chapters.push({
        period: this.getPeriodName(i, memories.length),
        timeRange: {
          start: chapterMemories[0].timestamp,
          end: chapterMemories[chapterMemories.length - 1].timestamp,
        },
        memories: chapterMemories,
        themes: this.extractThemes(chapterMemories),
        growthSummary: this.summarizeGrowth(chapterMemories),
        landmarkEvents: chapterLandmarks.map((m) => m.content),
      });
    }

    // Extract overall themes
    const allTopics = Array.from(profile.memoriesByTopic.keys());
    const themes = allTopics.slice(0, 5);

    // Generate summary
    const summary = this.generateNarrativeSummary(profile, memories, landmarks);

    return {
      chapters,
      summary,
      totalMemories: memories.length,
      landmarksCount: landmarks.length,
      themes,
    };
  }

  /**
   * Get period name for narrative chapter
   */
  private getPeriodName(index: number, total: number): string {
    const progress = index / total;
    if (progress < 0.2) return 'Getting Started';
    if (progress < 0.4) return 'Building Foundations';
    if (progress < 0.6) return 'Gaining Momentum';
    if (progress < 0.8) return 'Deepening Understanding';
    return 'Mastery and Refinement';
  }

  /**
   * Extract themes from memories
   */
  private extractThemes(memories: Memory[]): string[] {
    const themes: string[] = [];

    // Topic themes
    const topics = memories.map((m) => m.topic).filter(Boolean) as string[];
    const uniqueTopics = [...new Set(topics)];
    themes.push(...uniqueTopics.slice(0, 3));

    // Emotional themes
    const avgEmotion =
      memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;
    if (avgEmotion > 0.3) themes.push('Positive Experience');
    if (avgEmotion < -0.3) themes.push('Overcoming Challenges');

    return [...new Set(themes)];
  }

  /**
   * Summarize growth in a chapter
   */
  private summarizeGrowth(memories: Memory[]): string {
    const successes = memories.filter((m) => m.emotionalValence > 0).length;
    const total = memories.length;
    const successRate = total > 0 ? successes / total : 0;

    if (successRate > 0.7) return 'Strong progress with many successes';
    if (successRate > 0.4) return 'Mixed experiences with learning moments';
    return 'Challenging period requiring persistence';
  }

  /**
   * Generate overall narrative summary
   */
  private generateNarrativeSummary(
    profile: LearningProfile,
    memories: Memory[],
    landmarks: Memory[]
  ): string {
    const total = memories.length;
    const landmarkCount = landmarks.length;

    let summary = `Learning journey with ${total} memories`;

    if (landmarkCount > 0) {
      summary += ` and ${landmarkCount} significant milestones`;
    }

    const consolidationRate =
      profile.consolidationCount > 0
        ? `Consolidated ${profile.consolidationCount} times`
        : 'Awaiting first consolidation';

    summary += `. ${consolidationRate}. `;

    if (landmarks.length > 0) {
      const firstLandmark = landmarks[0];
      summary += `Started with "${firstLandmark.content.substring(0, 50)}..."`;
    }

    return summary;
  }

  /**
   * Get learning insights for a student
   */
  getLearningInsights(studentId: string): {
    strengths: string[];
    areasForImprovement: string[];
    recommendedTopics: string[];
    retentionScore: number;
    learningVelocity: number;
  } {
    const profile = this.getProfile(studentId);
    const procedural = Array.from(profile.proceduralMemories.values());

    // Identify strengths (high proficiency skills)
    const strengths = procedural
      .filter((p) => p.proficiencyLevel > 0.7)
      .map((p) => p.skill);

    // Identify areas for improvement (low proficiency or declining)
    const areasForImprovement = procedural
      .filter((p) => p.proficiencyLevel < 0.5 || p.strength < 0.5)
      .map((p) => p.skill);

    // Recommended topics based on semantic memory
    const recommendedTopics = Array.from(profile.semanticMemories.values())
      .filter((s) => s.confidence < 0.7)
      .map((s) => s.topic);

    // Calculate retention score
    const avgStrength =
      procedural.length > 0
        ? procedural.reduce((sum, p) => sum + p.strength, 0) / procedural.length
        : 1;
    const retentionScore = avgStrength;

    // Learning velocity (memories per day)
    const memories = Array.from(profile.episodicMemories.values());
    const velocity =
      memories.length > 1
        ? memories.length /
          ((Date.now() - memories[0].timestamp) / (24 * 60 * 60 * 1000))
        : 0;

    return {
      strengths,
      areasForImprovement,
      recommendedTopics,
      retentionScore,
      learningVelocity: Math.round(velocity * 10) / 10,
    };
  }

  /**
   * Get student statistics
   */
  getStudentStats(studentId: string): {
    totalMemories: number;
    workingMemoryCount: number;
    shortTermMemoryCount: number;
    longTermMemoryCount: number;
    semanticMemories: number;
    proceduralMemories: number;
    landmarksCount: number;
    totalImportance: number;
    avgEmotionalValence: number;
    consolidationCount: number;
  } {
    const profile = this.getProfile(studentId);
    const memories = Array.from(profile.episodicMemories.values());

    const avgEmotion =
      memories.length > 0
        ? memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length
        : 0;

    return {
      totalMemories: memories.length,
      workingMemoryCount: profile.workingMemory.size,
      shortTermMemoryCount: profile.shortTermMemory.size,
      longTermMemoryCount: profile.longTermMemory.size,
      semanticMemories: profile.semanticMemories.size,
      proceduralMemories: profile.proceduralMemories.size,
      landmarksCount: profile.landmarks.size,
      totalImportance: profile.totalImportanceAccumulated,
      avgEmotionalValence: Math.round(avgEmotion * 100) / 100,
      consolidationCount: profile.consolidationCount,
    };
  }

  /**
   * Get state for persistence
   */
  getState(): {
    profiles: Record<string, {
      episodicMemories: Memory[];
      semanticMemories: SemanticMemory[];
      proceduralMemories: ProceduralMemory[];
      workingMemory: string[];
      shortTermMemory: string[];
      longTermMemory: string[];
      totalImportanceAccumulated: number;
      lastConsolidation: number;
      consolidationCount: number;
      landmarks: Memory[];
      memoriesByTopic: Record<string, number>;
      avgRetention: number;
    }>;
    globalConsolidations: number;
  } {
    const profilesObj: Record<string, any> = {};

    for (const [id, profile] of this.profiles.entries()) {
      profilesObj[id] = {
        episodicMemories: Array.from(profile.episodicMemories.values()),
        semanticMemories: Array.from(profile.semanticMemories.values()),
        proceduralMemories: Array.from(profile.proceduralMemories.values()),
        workingMemory: Array.from(profile.workingMemory),
        shortTermMemory: Array.from(profile.shortTermMemory),
        longTermMemory: Array.from(profile.longTermMemory),
        totalImportanceAccumulated: profile.totalImportanceAccumulated,
        lastConsolidation: profile.lastConsolidation,
        consolidationCount: profile.consolidationCount,
        landmarks: Array.from(profile.landmarks.values()),
        memoriesByTopic: Object.fromEntries(profile.memoriesByTopic),
        avgRetention: profile.avgRetention,
      };
    }

    return {
      profiles: profilesObj,
      globalConsolidations: this.globalConsolidations,
    };
  }

  /**
   * Restore state from persistence
   */
  restoreState(state: {
    profiles: Record<string, any>;
    globalConsolidations: number;
  }): void {
    this.profiles.clear();

    for (const [id, profileData] of Object.entries(state.profiles)) {
      const profile: LearningProfile = {
        studentId: id,
        episodicMemories: new Map(profileData.episodicMemories.map((m: Memory) => [m.id, m])),
        semanticMemories: new Map(profileData.semanticMemories.map((m: SemanticMemory) => [m.id, m])),
        proceduralMemories: new Map(profileData.proceduralMemories.map((m: ProceduralMemory) => [m.id, m])),
        workingMemory: new Set(profileData.workingMemory),
        shortTermMemory: new Set(profileData.shortTermMemory),
        longTermMemory: new Set(profileData.longTermMemory),
        totalImportanceAccumulated: profileData.totalImportanceAccumulated,
        lastConsolidation: profileData.lastConsolidation,
        consolidationCount: profileData.consolidationCount,
        landmarks: new Map(profileData.landmarks.map((m: Memory) => [m.id, m])),
        memoriesByTopic: new Map(Object.entries(profileData.memoriesByTopic)),
        avgRetention: profileData.avgRetention,
      };
      this.profiles.set(id, profile);
    }

    this.globalConsolidations = state.globalConsolidations;
  }
}

/**
 * Singleton instance for global use
 */
let globalMemoryEngine: MemoryConsolidationEngine | null = null;

export function getMemoryEngine(): MemoryConsolidationEngine {
  if (!globalMemoryEngine) {
    globalMemoryEngine = new MemoryConsolidationEngine();
  }
  return globalMemoryEngine;
}

export function resetMemoryEngine(): void {
  globalMemoryEngine = null;
}
