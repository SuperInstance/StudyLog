/**
 * DMLoG.AI - Character Memory System
 *
 * Implements per-NPC/PC memory with 6-tier hierarchical architecture.
 * Handles memory storage, retrieval, decay, and consolidation.
 */

import {
  MemoryTier,
  MemoryType,
  EmotionalValence,
  BaseMemory,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemory,
  IdentityMemory,
  WorkingMemory,
  CharacterMemoryState,
  ContextWindowEntry,
  MemoryQuery,
  MemoryRetrievalResult,
  SerializedCharacterMemory,
  TemporalLandmark,
  SensoryDetails,
} from './types.js';

// ============================================================================
// MEMORY STORAGE
// ============================================================================

export class CharacterMemoryStore {
  private characters: Map<string, CharacterMemoryState> = new Map();
  private persistenceCallbacks: Array<(state: CharacterMemoryState) => Promise<void>> = [];

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize memory for a character
   */
  initializeCharacter(
    characterId: string,
    campaignId: string,
    identityTraits?: Partial<IdentityMemory>[]
  ): CharacterMemoryState {
    const state: CharacterMemoryState = {
      characterId,
      campaignId,
      workingMemory: this.createEmptyWorkingMemory(),
      episodicMemories: new Map(),
      semanticMemories: new Map(),
      proceduralMemories: new Map(),
      reflectionMemories: new Map(),
      identityMemories: new Map(),
      relationships: new Map(),
      temporalConsciousness: {
        timePerception: {
          subjectiveSpeed: 1.0,
          focusHorizon: 'medium_term',
          anticipationBias: 'balanced',
          memoryDepth: 30, // days
        },
        temporalLandmarks: [],
        anticipatedEvents: [],
        temporalNarrative: '',
        periodization: [],
      },
      lastConsolidated: Date.now(),
    };

    // Initialize identity memories from traits
    if (identityTraits) {
      identityTraits.forEach((trait, index) => {
        const identityMemory: IdentityMemory = {
          id: this.generateMemoryId('identity', characterId, index),
          tier: MemoryTier.IDENTITY,
          type: trait.type || MemoryType.FACT,
          timestamp: Date.now(),
          sessionId: 'creation',
          campaignId,
          importance: 1.0,
          retrievalCount: 0,
          lastAccessed: Date.now(),
          tags: ['identity', 'core'],
          trait: trait.trait || 'unknown',
          value: trait.value ?? true,
          stability: trait.stability ?? 0.9,
          origin: trait.origin || 'backstory',
        };
        state.identityMemories.set(identityMemory.id, identityMemory);
      });
    }

    this.characters.set(characterId, state);
    return state;
  }

  private createEmptyWorkingMemory(): WorkingMemory {
    return {
      presentCharacters: [],
      activeQuests: [],
      recentEvents: [],
      currentEmotionalState: EmotionalValence.NEUTRAL,
      contextWindow: [],
      immediateThreats: [],
    };
  }

  // ========================================================================
  // MEMORY CREATION
  // ========================================================================

  /**
   * Add an episodic memory (specific event)
   */
  addEpisodicMemory(
    characterId: string,
    memory: Omit<EpisodicMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): EpisodicMemory {
    const state = this.getCharacterState(characterId);
    const episodicMemory: EpisodicMemory = {
      ...memory,
      id: this.generateMemoryId('episodic', characterId, state.episodicMemories.size),
      tier: MemoryTier.EPISODIC,
      timestamp: Date.now(),
      retrievalCount: 0,
      lastAccessed: Date.now(),
    };

    state.episodicMemories.set(episodicMemory.id, episodicMemory);

    // Add to working memory recent events
    state.workingMemory.recentEvents.push(episodicMemory.id);
    if (state.workingMemory.recentEvents.length > 10) {
      state.workingMemory.recentEvents.shift();
    }

    // Update emotional state based on this memory
    this.updateEmotionalState(characterId, memory.emotionalValence);

    return episodicMemory;
  }

  /**
   * Add a semantic memory (fact/knowledge)
   */
  addSemanticMemory(
    characterId: string,
    memory: Omit<SemanticMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): SemanticMemory {
    const state = this.getCharacterState(characterId);
    const semanticMemory: SemanticMemory = {
      ...memory,
      id: this.generateMemoryId('semantic', characterId, state.semanticMemories.size),
      tier: MemoryTier.SEMANTIC,
      timestamp: Date.now(),
      retrievalCount: 0,
      lastAccessed: Date.now(),
    };

    // Check for contradictions
    const contradictions = this.findContradictions(state, semanticMemory);
    if (contradictions.length > 0) {
      semanticMemory.contradictions = contradictions;
    }

    state.semanticMemories.set(semanticMemory.id, semanticMemory);
    return semanticMemory;
  }

  /**
   * Add a procedural memory (skill/behavior)
   */
  addProceduralMemory(
    characterId: string,
    memory: Omit<ProceduralMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): ProceduralMemory {
    const state = this.getCharacterState(characterId);

    // Check if skill already exists
    for (const [id, existing] of state.proceduralMemories) {
      if (existing.skill === memory.skill) {
        // Update existing skill
        existing.proficiency = Math.min(1, existing.proficiency + memory.proficiency * 0.1);
        existing.practiceCount += memory.practiceCount;
        existing.lastUsed = Date.now();
        existing.contexts.push(...memory.contexts.filter(c => !existing.contexts.includes(c)));
        return existing;
      }
    }

    const proceduralMemory: ProceduralMemory = {
      ...memory,
      id: this.generateMemoryId('procedural', characterId, state.proceduralMemories.size),
      tier: MemoryTier.PROCEDURAL,
      timestamp: Date.now(),
      retrievalCount: 0,
      lastAccessed: Date.now(),
    };

    state.proceduralMemories.set(proceduralMemory.id, proceduralMemory);
    return proceduralMemory;
  }

  /**
   * Add a reflection memory (meta-cognition)
   */
  addReflectionMemory(
    characterId: string,
    memory: Omit<ReflectionMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): ReflectionMemory {
    const state = this.getCharacterState(characterId);
    const reflectionMemory: ReflectionMemory = {
      ...memory,
      id: this.generateMemoryId('reflection', characterId, state.reflectionMemories.size),
      tier: MemoryTier.REFLECTION,
      timestamp: Date.now(),
      retrievalCount: 0,
      lastAccessed: Date.now(),
    };

    state.reflectionMemories.set(reflectionMemory.id, reflectionMemory);

    // Check for behavioral changes to update identity
    if (reflectionMemory.behavioralChange) {
      this.applyBehavioralChange(characterId, reflectionMemory);
    }

    return reflectionMemory;
  }

  /**
   * Add an identity memory (core trait)
   */
  addIdentityMemory(
    characterId: string,
    memory: Omit<IdentityMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): IdentityMemory {
    const state = this.getCharacterState(characterId);

    // Check if trait already exists
    for (const [id, existing] of state.identityMemories) {
      if (existing.trait === memory.trait) {
        // Trait stability determines if it can change
        if (existing.stability < 0.7) {
          existing.value = memory.value;
          existing.stability = Math.max(0.1, existing.stability - 0.1);
        }
        return existing;
      }
    }

    const identityMemory: IdentityMemory = {
      ...memory,
      id: this.generateMemoryId('identity', characterId, state.identityMemories.size),
      tier: MemoryTier.IDENTITY,
      timestamp: Date.now(),
      retrievalCount: 0,
      lastAccessed: Date.now(),
    };

    state.identityMemories.set(identityMemory.id, identityMemory);
    return identityMemory;
  }

  // ========================================================================
  // WORKING MEMORY
  // ========================================================================

  /**
   * Update working memory with current context
   */
  updateWorkingMemory(
    characterId: string,
    updates: Partial<WorkingMemory>
  ): WorkingMemory {
    const state = this.getCharacterState(characterId);

    if (updates.contextWindow) {
      // Merge context window, keeping most recent entries
      const existingEntries = state.workingMemory.contextWindow;
      const newEntries = updates.contextWindow;
      const merged = [...existingEntries, ...newEntries]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Keep last 50 entries
      state.workingMemory.contextWindow = merged;
    }

    Object.assign(state.workingMemory, updates);

    // Update context window with current action
    if (updates.currentGoal || updates.currentLocation) {
      const entry: ContextWindowEntry = {
        type: 'thought',
        content: `Currently ${updates.currentGoal ? 'focused on: ' + updates.currentGoal : ''}` +
                 `${updates.currentLocation ? ' at ' + updates.currentLocation : ''}`,
        timestamp: Date.now(),
        source: characterId,
        importance: 0.5,
      };
      state.workingMemory.contextWindow.push(entry);
    }

    return state.workingMemory;
  }

  /**
   * Add to context window (for conversational context)
   */
  addToContextWindow(
    characterId: string,
    entry: Omit<ContextWindowEntry, 'timestamp'>
  ): void {
    const state = this.getCharacterState(characterId);
    const fullEntry: ContextWindowEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    state.workingMemory.contextWindow.push(fullEntry);

    // Keep context window manageable
    if (state.workingMemory.contextWindow.length > 100) {
      // Remove oldest entries with low importance
      state.workingMemory.contextWindow = state.workingMemory.contextWindow
        .sort((a, b) => (b.importance * 1000 + b.timestamp) - (a.importance * 1000 + a.timestamp))
        .slice(0, 100);
    }
  }

  /**
   * Get current context for prompt generation
   */
  getContextPrompt(characterId: string): string {
    const state = this.getCharacterState(characterId);
    const wm = state.workingMemory;

    let prompt = '';

    // Current situation
    if (wm.currentLocation) {
      prompt += `Location: ${wm.currentLocation}\n`;
    }

    if (wm.presentCharacters.length > 0) {
      prompt += `Present: ${wm.presentCharacters.join(', ')}\n`;
    }

    if (wm.currentGoal) {
      prompt += `Current Goal: ${wm.currentGoal}\n`;
    }

    if (wm.immediateThreats.length > 0) {
      prompt += `Threats: ${wm.immediateThreats.join(', ')}\n`;
    }

    // Recent context
    const recentContext = wm.contextWindow
      .slice(-10)
      .map(e => `[${e.type}] ${e.content}`)
      .join('\n');

    if (recentContext) {
      prompt += `\nRecent Context:\n${recentContext}\n`;
    }

    return prompt;
  }

  // ========================================================================
  // MEMORY RETRIEVAL
  // ========================================================================

  /**
   * Query memories with filters
   */
  queryMemories(characterId: string, query: MemoryQuery): MemoryRetrievalResult {
    const state = this.getCharacterState(characterId);
    const startTime = Date.now();

    const memories: Memory[] = [];
    const tiers = query.tiers || [
      MemoryTier.IDENTITY,
      MemoryTier.REFLECTION,
      MemoryTier.PROCEDURAL,
      MemoryTier.SEMANTIC,
      MemoryTier.EPISODIC,
    ];

    if (tiers.includes(MemoryTier.EPISODIC)) {
      memories.push(...this.filterMemories(Array.from(state.episodicMemories.values()), query));
    }
    if (tiers.includes(MemoryTier.SEMANTIC)) {
      memories.push(...this.filterMemories(Array.from(state.semanticMemories.values()), query));
    }
    if (tiers.includes(MemoryTier.PROCEDURAL)) {
      memories.push(...this.filterMemories(Array.from(state.proceduralMemories.values()), query));
    }
    if (tiers.includes(MemoryTier.REFLECTION)) {
      memories.push(...this.filterMemories(Array.from(state.reflectionMemories.values()), query));
    }
    if (tiers.includes(MemoryTier.IDENTITY)) {
      memories.push(...this.filterMemories(Array.from(state.identityMemories.values()), query));
    }

    // Sort by relevance (importance + recency + retrieval count)
    memories.sort((a, b) => {
      const aScore = this.calculateRelevance(a, query);
      const bScore = this.calculateRelevance(b, query);
      return bScore - aScore;
    });

    // Apply limit
    const limited = query.limit ? memories.slice(0, query.limit) : memories;

    // Update access stats
    limited.forEach(m => {
      m.retrievalCount++;
      m.lastAccessed = Date.now();
    });

    return {
      memories: limited,
      workingMemory: query.includeWorking ? state.workingMemory : undefined,
      totalCount: memories.length,
      query,
      retrievalTime: Date.now() - startTime,
    };
  }

  /**
   * Get memories related to a specific memory
   */
  getRelatedMemories(characterId: string, memoryId: string, maxResults: number = 10): Memory[] {
    const state = this.getCharacterState(characterId);
    const sourceMemory = this.findMemoryById(state, memoryId);

    if (!sourceMemory) return [];

    const related: Array<{ memory: Memory; score: number }> = [];

    // Check related memories pointer
    if ('relatedMemories' in sourceMemory && sourceMemory.relatedMemories) {
      for (const relatedId of sourceMemory.relatedMemories) {
        const mem = this.findMemoryById(state, relatedId);
        if (mem) {
          related.push({ memory: mem, score: 0.8 });
        }
      }
    }

    // Semantic similarity by tags
    const allMemories: Memory[] = [
      ...Array.from(state.episodicMemories.values()),
      ...Array.from(state.semanticMemories.values()),
      ...Array.from(state.proceduralMemories.values()),
      ...Array.from(state.reflectionMemories.values()),
      ...Array.from(state.identityMemories.values()),
    ];

    for (const mem of allMemories) {
      if (mem.id === memoryId) continue;

      // Tag overlap
      const commonTags = mem.tags.filter(t => sourceMemory.tags.includes(t));
      if (commonTags.length > 0) {
        const score = commonTags.length / Math.max(mem.tags.length, sourceMemory.tags.length);
        related.push({ memory: mem, score });
      }

      // Same participants for episodic memories
      if (mem.tier === MemoryTier.EPISODIC && sourceMemory.tier === MemoryTier.EPISODIC) {
        const episodicMem = mem as EpisodicMemory;
        const sourceEpisodic = sourceMemory as EpisodicMemory;
        const commonParticipants = episodicMem.participants.filter(p =>
          sourceEpisodic.participants.includes(p)
        );
        if (commonParticipants.length > 1) {
          const score = commonParticipants.length / Math.max(
            episodicMem.participants.length,
            sourceEpisodic.participants.length
          );
          const existing = related.find(r => r.memory.id === mem.id);
          if (existing) {
            existing.score = Math.max(existing.score, score);
          } else {
            related.push({ memory: mem, score });
          }
        }
      }
    }

    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(r => r.memory);
  }

  /**
   * Get memories by emotional valence
   */
  getMemoriesByEmotion(
    characterId: string,
    valence: EmotionalValence,
    tier?: MemoryTier
  ): Memory[] {
    const query: MemoryQuery = {
      tiers: tier ? [tier] : undefined,
      emotionalValence: [valence],
    };
    const result = this.queryMemories(characterId, query);
    return result.memories;
  }

  /**
   * Get temporal landmarks (significant memories)
   */
  getTemporalLandmarks(characterId: string): Array<{ memory: EpisodicMemory; landmark: TemporalLandmark }> {
    const state = this.getCharacterState(characterId);
    const landmarks: Array<{ memory: EpisodicMemory; landmark: TemporalLandmark }> = [];

    for (const memory of state.episodicMemories.values()) {
      if (memory.temporalLandmark) {
        landmarks.push({ memory, landmark: memory.temporalLandmark });
      }
    }

    // Sort by significance
    landmarks.sort((a, b) => b.landmark.significance - a.landmark.significance);

    return landmarks;
  }

  // ========================================================================
  // MEMORY DECAY & MAINTENANCE
  // ========================================================================

  /**
   * Apply time-based decay to memories
   */
  applyDecay(characterId: string, daysPassed: number): void {
    const state = this.getCharacterState(characterId);
    const now = Date.now();
    const dayMs = 86400000;

    // Decay episodic memories based on time and importance
    for (const [id, memory] of state.episodicMemories) {
      const ageInDays = (now - memory.timestamp) / dayMs;

      // Less important memories fade faster
      const decayRate = 1 - memory.importance * 0.5;
      const decayFactor = Math.pow(decayRate, daysPassed);

      // Reduce retrieval count (affects accessibility)
      memory.retrievalCount = Math.max(0, Math.floor(memory.retrievalCount * decayFactor));

      // Very old, unimportant memories might be forgotten
      if (ageInDays > 90 && memory.importance < 0.3 && memory.retrievalCount === 0) {
        // Consider archiving or removing
        memory.importance *= 0.9;
      }
    }

    // Decay semantic memories (require verification)
    for (const [id, memory] of state.semanticMemories) {
      const ageInDays = (now - memory.timestamp) / dayMs;

      if (ageInDays > 30) {
        // Reduce confidence over time unless reinforced
        memory.confidence = Math.max(0.5, memory.confidence - 0.01 * daysPassed);
      }
    }

    // Procedural memories persist but need practice
    for (const [id, memory] of state.proceduralMemories) {
      const daysSinceUsed = memory.lastUsed ? (now - memory.lastUsed) / dayMs : 365;

      if (daysSinceUsed > 30) {
        // Slow proficiency decay
        memory.proficiency = Math.max(0.1, memory.proficiency - 0.001 * daysPassed);
      }
    }
  }

  /**
   * Reinforce a memory (increase importance and accessibility)
   */
  reinforceMemory(characterId: string, memoryId: string, amount: number = 0.1): void {
    const state = this.getCharacterState(characterId);
    const memory = this.findMemoryById(state, memoryId);

    if (memory) {
      memory.importance = Math.min(1, memory.importance + amount);
      memory.lastAccessed = Date.now();
      memory.retrievalCount++;

      // Reinforce related memories too
      if ('relatedMemories' in memory && memory.relatedMemories) {
        for (const relatedId of memory.relatedMemories) {
          const related = this.findMemoryById(state, relatedId);
          if (related) {
            related.importance = Math.min(1, related.importance + amount * 0.5);
            related.lastAccessed = Date.now();
          }
        }
      }
    }
  }

  // ========================================================================
  // SERIALIZATION
  // ========================================================================

  /**
   * Serialize character state for storage
   */
  serialize(characterId: string): SerializedCharacterMemory | null {
    const state = this.characters.get(characterId);
    if (!state) return null;

    return {
      characterId: state.characterId,
      campaignId: state.campaignId,
      workingMemory: state.workingMemory,
      episodicMemories: Array.from(state.episodicMemories.values()),
      semanticMemories: Array.from(state.semanticMemories.values()),
      proceduralMemories: Array.from(state.proceduralMemories.values()),
      reflectionMemories: Array.from(state.reflectionMemories.values()),
      identityMemories: Array.from(state.identityMemories.values()),
      relationships: Object.fromEntries(state.relationships),
      temporalConsciousness: state.temporalConsciousness,
      lastConsolidated: state.lastConsolidated,
    };
  }

  /**
   * Deserialize character state from storage
   */
  deserialize(data: SerializedCharacterMemory): CharacterMemoryState {
    const state: CharacterMemoryState = {
      characterId: data.characterId,
      campaignId: data.campaignId,
      workingMemory: data.workingMemory,
      episodicMemories: new Map(data.episodicMemories.map(m => [m.id, m])),
      semanticMemories: new Map(data.semanticMemories.map(m => [m.id, m])),
      proceduralMemories: new Map(data.proceduralMemories.map(m => [m.id, m])),
      reflectionMemories: new Map(data.reflectionMemories.map(m => [m.id, m])),
      identityMemories: new Map(data.identityMemories.map(m => [m.id, m])),
      relationships: new Map(Object.entries(data.relationships)),
      temporalConsciousness: data.temporalConsciousness,
      lastConsolidated: data.lastConsolidated,
    };

    this.characters.set(data.characterId, state);
    return state;
  }

  /**
   * Register callback for persistence
   */
  onPersist(callback: (state: CharacterMemoryState) => Promise<void>): void {
    this.persistenceCallbacks.push(callback);
  }

  /**
   * Persist character state
   */
  async persist(characterId: string): Promise<void> {
    const state = this.characters.get(characterId);
    if (!state) return;

    for (const callback of this.persistenceCallbacks) {
      await callback(state);
    }
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getCharacterState(characterId: string): CharacterMemoryState {
    const state = this.characters.get(characterId);
    if (!state) {
      throw new Error(`Character ${characterId} not found in memory store`);
    }
    return state;
  }

  private findMemoryById(state: CharacterMemoryState, memoryId: string): Memory | null {
    if (state.episodicMemories.has(memoryId)) return state.episodicMemories.get(memoryId)!;
    if (state.semanticMemories.has(memoryId)) return state.semanticMemories.get(memoryId)!;
    if (state.proceduralMemories.has(memoryId)) return state.proceduralMemories.get(memoryId)!;
    if (state.reflectionMemories.has(memoryId)) return state.reflectionMemories.get(memoryId)!;
    if (state.identityMemories.has(memoryId)) return state.identityMemories.get(memoryId)!;
    return null;
  }

  private filterMemories<T extends Memory>(memories: T[], query: MemoryQuery): T[] {
    return memories.filter(m => {
      if (query.types && !query.types.includes(m.type)) return false;

      if (query.importance) {
        if (query.importance.min !== undefined && m.importance < query.importance.min) return false;
        if (query.importance.max !== undefined && m.importance > query.importance.max) return false;
      }

      if (query.timeRange) {
        if (query.timeRange.start && m.timestamp < query.timeRange.start) return false;
        if (query.timeRange.end && m.timestamp > query.timeRange.end) return false;
      }

      if (query.tags && query.tags.length > 0) {
        const hasTag = query.tags.some(t => m.tags.includes(t));
        if (!hasTag) return false;
      }

      if (query.emotionalValence && 'emotionalValence' in m) {
        if (!query.emotionalValence.includes((m as any).emotionalValence)) return false;
      }

      if (query.participants && 'participants' in m) {
        const hasParticipant = query.participants.some(p =>
          (m as any).participants?.includes(p)
        );
        if (!hasParticipant) return false;
      }

      if (query.locations && 'location' in m) {
        if (!query.locations.includes((m as any).location)) return false;
      }

      return true;
    });
  }

  private calculateRelevance(memory: Memory, query: MemoryQuery): number {
    let score = memory.importance;

    // Recent memories are more relevant
    const age = Date.now() - memory.timestamp;
    const recencyFactor = Math.max(0, 1 - age / (30 * 86400000)); // 30 day window
    score += recencyFactor * 0.3;

    // Frequently retrieved memories are more relevant
    score += Math.min(memory.retrievalCount / 100, 0.2);

    return score;
  }

  private updateEmotionalState(characterId: string, newValence: EmotionalValence): void {
    const state = this.getCharacterState(characterId);
    // Blend current state with new valence
    const current = state.workingMemory.currentEmotionalState;
    state.workingMemory.currentEmotionalState = Math.round(
      (current * 0.7) + (newValence * 0.3)
    ) as EmotionalValence;
  }

  private findContradictions(state: CharacterMemoryState, memory: SemanticMemory): string[] {
    const contradictions: string[] = [];

    for (const [id, existing] of state.semanticMemories) {
      // Simple contradiction detection based on fact similarity
      if (existing.type === memory.type && existing.fact.toLowerCase().includes('not') &&
          memory.fact.toLowerCase().includes('not')) {
        if (existing.fact.toLowerCase().replace(/not /g, '') ===
            memory.fact.toLowerCase().replace(/not /g, '')) {
          contradictions.push(id);
        }
      }
    }

    return contradictions;
  }

  private applyBehavioralChange(characterId: string, reflection: ReflectionMemory): void {
    const state = this.getCharacterState(characterId);

    // Create procedural memory from behavioral change
    const proceduralMemory: ProceduralMemory = {
      id: this.generateMemoryId('procedural', characterId, state.proceduralMemories.size),
      tier: MemoryTier.PROCEDURAL,
      type: MemoryType.BEHAVIOR,
      timestamp: Date.now(),
      sessionId: reflection.sessionId,
      campaignId: reflection.campaignId,
      importance: reflection.importance * 0.8,
      retrievalCount: 0,
      lastAccessed: Date.now(),
      tags: [...reflection.tags, 'learned', 'behavior_change'],
      skill: reflection.behavioralChange,
      proficiency: reflection.importance,
      practiceCount: 1,
      contexts: ['learned_from_reflection'],
    };

    state.proceduralMemories.set(proceduralMemory.id, proceduralMemory);
  }

  private generateMemoryId(tier: string, characterId: string, index: number): string {
    return `${tier}_${characterId}_${Date.now()}_${index}`;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const characterMemoryStore = new CharacterMemoryStore();
