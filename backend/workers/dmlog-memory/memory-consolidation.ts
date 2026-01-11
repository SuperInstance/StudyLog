/**
 * DMLoG.AI - Memory Consolidation System
 *
 * Processes session memories to:
 * - Extract semantic facts from episodic events
 * - Learn procedural patterns from repeated actions
 * - Generate reflection memories from significant events
 * - Update identity based on experiences
 * - Transfer memories between tiers
 */

import {
  MemoryTier,
  MemoryType,
  EmotionalValence,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemory,
  IdentityMemory,
  CharacterMemoryState,
  ConsolidationConfig,
  ConsolidationResult,
  TemporalLandmark,
} from './types.js';
import { characterMemoryStore } from './character-memory.js';
import { temporalConsciousnessManager } from './temporal-consciousness.js';

// ============================================================================
// CONSOLIDATION CONFIGURATION
// ============================================================================

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
  episodicToSemantic: true,
  episodicToProcedural: true,
  reflectionThreshold: 0.7,
  identityStability: 0.8,
  relationshipDecay: 0.01,
  memoryDecay: {
    working: 3600, // 1 hour in seconds
    episodic: 90, // 90 days
    semantic: 180, // 180 days
  },
};

// ============================================================================
// MEMORY CONSOLIDATION ENGINE
// ============================================================================

export class MemoryConsolidationEngine {
  private config: ConsolidationConfig;

  constructor(config: Partial<ConsolidationConfig> = {}) {
    this.config = { ...DEFAULT_CONSOLIDATION_CONFIG, ...config };
  }

  /**
   * Consolidate all memories for a character after a session
   */
  async consolidateSession(
    characterId: string,
    sessionId: string,
    campaignId: string
  ): Promise<ConsolidationResult> {
    const state = characterMemoryStore.getCharacterState(characterId);
    const startTime = Date.now();

    const result: ConsolidationResult = {
      memoriesCreated: 0,
      memoriesUpdated: 0,
      memoriesDecayed: 0,
      relationshipsUpdated: 0,
      reflectionsGenerated: 0,
      plotThreadsUpdated: 0,
      summary: '',
    };

    // Get session memories
    const sessionMemories = this.getSessionMemories(state, sessionId);

    // Process each memory
    for (const memory of sessionMemories) {
      if (memory.tier === MemoryTier.EPISODIC) {
        await this.consolidateEpisodic(characterId, memory as EpisodicMemory, state, result);
      }
    }

    // Generate reflection if threshold met
    const shouldReflect = this.shouldGenerateReflection(state, sessionMemories);
    if (shouldReflect) {
      const reflection = this.generateSessionReflection(characterId, state, sessionMemories);
      if (reflection) {
        characterMemoryStore.addReflectionMemory(characterId, reflection);
        result.reflectionsGenerated++;
      }
    }

    // Apply time-based decay
    this.applySessionDecay(state, 1); // 1 day for now

    // Update temporal consciousness
    temporalConsciousnessManager.updateLifePeriods(characterId);

    // Mark as consolidated
    state.lastConsolidated = Date.now();

    // Generate summary
    result.summary = this.generateConsolidationSummary(
      characterId,
      sessionMemories.length,
      result
    );

    return result;
  }

  /**
   * Consolidate a single episodic memory
   */
  private async consolidateEpisodic(
    characterId: string,
    memory: EpisodicMemory,
    state: CharacterMemoryState,
    result: ConsolidationResult
  ): Promise<void> {
    // Extract semantic facts
    if (this.config.episodicToSemantic) {
      const facts = this.extractFacts(memory);
      for (const fact of facts) {
        characterMemoryStore.addSemanticMemory(characterId, {
          type: MemoryType.FACT,
          timestamp: Date.now(),
          sessionId: memory.sessionId,
          campaignId: memory.campaignId,
          importance: memory.importance * 0.7,
          retrievalCount: 0,
          lastAccessed: Date.now(),
          tags: [...memory.tags, 'extracted'],
          fact: fact.statement,
          confidence: fact.confidence,
          source: 'experience',
          sourceId: memory.id,
        });
        result.memoriesCreated++;
      }
    }

    // Learn procedural patterns
    if (this.config.episodicToProcedural) {
      const patterns = this.extractPatterns(memory, state);
      for (const pattern of patterns) {
        characterMemoryStore.addProceduralMemory(characterId, {
          type: MemoryType.BEHAVIOR,
          timestamp: Date.now(),
          sessionId: memory.sessionId,
          campaignId: memory.campaignId,
          importance: memory.importance * 0.6,
          retrievalCount: 0,
          lastAccessed: Date.now(),
          tags: ['learned', 'pattern'],
          skill: pattern.description,
          proficiency: pattern.confidence,
          practiceCount: 1,
          contexts: [memory.type],
        });
        result.memoriesCreated++;
      }
    }

    // Check for identity updates
    this.considerIdentityUpdate(characterId, memory, state, result);

    // Process through temporal consciousness
    temporalConsciousnessManager.processEvent(characterId, memory, state);
  }

  /**
   * Extract semantic facts from an episodic memory
   */
  private extractFacts(memory: EpisodicMemory): Array<{
    statement: string;
    confidence: number;
  }> {
    const facts: Array<{ statement: string; confidence: number }> = [];

    // Extract location facts
    if (memory.location) {
      facts.push({
        statement: `${memory.location} exists`,
        confidence: 1.0,
      });
    }

    // Extract participant facts
    for (const participant of memory.participants) {
      facts.push({
        statement: `${participant} was present at ${memory.location || 'an event'}`,
        confidence: 0.9,
      });
    }

    // Extract outcome facts
    if (memory.outcome) {
      facts.push({
        statement: memory.outcome,
        confidence: memory.importance,
      });
    }

    // Extract facts from description using simple patterns
    const description = memory.description;

    // "X is Y" patterns
    const isPatterns = description.match(/(\w+) is (\w+)/gi);
    if (isPatterns) {
      for (const pattern of isPatterns) {
        facts.push({
          statement: pattern,
          confidence: 0.7,
        });
      }
    }

    // "X has Y" patterns
    const hasPatterns = description.match(/(\w+) (?:has|have|possess) (\w+)/gi);
    if (hasPatterns) {
      for (const pattern of hasPatterns) {
        facts.push({
          statement: pattern,
          confidence: 0.8,
        });
      }
    }

    return facts;
  }

  /**
   * Extract procedural patterns from an episodic memory
   */
  private extractPatterns(
    memory: EpisodicMemory,
    state: CharacterMemoryState
  ): Array<{ description: string; confidence: number }> {
    const patterns: Array<{ description: string; confidence: number }> = [];

    // Combat patterns
    if (memory.type === MemoryType.COMBAT) {
      patterns.push({
        description: 'combat experience',
        confidence: 0.5,
      });

      // Check for specific tactics based on tags
      if (memory.tags.includes('defensive')) {
        patterns.push({ description: 'defensive combat', confidence: 0.6 });
      }
      if (memory.tags.includes('aggressive')) {
        patterns.push({ description: 'aggressive combat', confidence: 0.6 });
      }
    }

    // Social patterns
    if (memory.type === MemoryType.SOCIAL) {
      if (memory.emotionalValence >= EmotionalValence.POSITIVE) {
        patterns.push({ description: 'friendly interaction', confidence: 0.5 });
      }
      if (memory.emotionalValence <= EmotionalValence.NEGATIVE) {
        patterns.push({ description: 'conflict resolution', confidence: 0.5 });
      }
    }

    // Repeated patterns check
    const similarMemories = Array.from(state.episodicMemories.values()).filter(
      m => m.type === memory.type && m.id !== memory.id
    );

    if (similarMemories.length >= 3) {
      patterns.push({
        description: `experienced in ${memory.type}`,
        confidence: Math.min(1, similarMemories.length * 0.15),
      });
    }

    return patterns;
  }

  /**
   * Consider updating identity based on experience
   */
  private considerIdentityUpdate(
    characterId: string,
    memory: EpisodicMemory,
    state: CharacterMemoryState,
    result: ConsolidationResult
  ): void {
    // Only very significant events affect identity
    if (memory.importance < 0.8) return;

    // Check for first-time experiences
    if (memory.tags.includes('first_time')) {
      const trait = this.mapFirstTimeToTrait(memory);
      if (trait) {
        characterMemoryStore.addIdentityMemory(characterId, {
          type: MemoryType.FACT,
          timestamp: Date.now(),
          sessionId: memory.sessionId,
          campaignId: memory.campaignId,
          importance: 1.0,
          retrievalCount: 0,
          lastAccessed: Date.now(),
          tags: ['identity', 'experience'],
          trait: trait.name,
          value: trait.value,
          stability: 0.5, // New traits are less stable
          origin: `experienced: ${memory.description}`,
        });
        result.memoriesCreated++;
      }
    }

    // Check for transformative experiences
    if (memory.temporalLandmark) {
      const landmark = memory.temporalLandmark;
      if (landmark.type === 'turning_point' || landmark.type === 'trauma' || landmark.type === 'triumph') {
        // Generate reflection
        const reflection: Omit<ReflectionMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'> = {
          type: MemoryType.INSIGHT,
          timestamp: Date.now(),
          sessionId: memory.sessionId,
          campaignId: memory.campaignId,
          importance: landmark.significance,
          retrievalCount: 0,
          lastAccessed: Date.now(),
          tags: ['identity', 'transformative'],
          subjectMemoryIds: [memory.id],
          insight: landmark.narrativeImpact,
          emotionalImpact: memory.emotionalValence,
          behavioralChange: this.generateBehavioralChange(memory),
          selfAssessment: {
            growth: landmark.significance,
          },
        };

        characterMemoryStore.addReflectionMemory(characterId, reflection);
        result.reflectionsGenerated++;
      }
    }
  }

  /**
   * Generate a reflection memory for the entire session
   */
  private generateSessionReflection(
    characterId: string,
    state: CharacterMemoryState,
    sessionMemories: any[]
  ): Omit<ReflectionMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'> | null {
    if (sessionMemories.length === 0) return null;

    // Calculate overall emotional tone
    const avgEmotion = sessionMemories.reduce((sum: number, m: any) => {
      return sum + (m.emotionalValence || 0);
    }, 0) / sessionMemories.length;

    // Identify most important event
    const mostImportant = sessionMemories
      .sort((a: any, b: any) => b.importance - a.importance)[0];

    let insight = '';

    // Generate insight based on session content
    if (avgEmotion >= EmotionalValence.POSITIVE) {
      insight = 'This was a good session. Things are going well.';
    } else if (avgEmotion <= EmotionalValence.NEGATIVE) {
      insight = 'This was difficult. I need to be more careful.';
    } else {
      insight = 'An ordinary day, neither good nor bad.';
    }

    if (mostImportant) {
      insight += ` The most significant moment was: ${mostImportant.description}`;
    }

    return {
      type: MemoryType.INSIGHT,
      timestamp: Date.now(),
      sessionId: sessionMemories[0].sessionId,
      campaignId: state.campaignId,
      importance: 0.6,
      retrievalCount: 0,
      lastAccessed: Date.now(),
      tags: ['session', 'reflection'],
      subjectMemoryIds: sessionMemories.map((m: any) => m.id),
      insight,
      emotionalImpact: avgEmotion as EmotionalValence,
    };
  }

  /**
   * Check if reflection should be generated
   */
  private shouldGenerateReflection(state: CharacterMemoryState, sessionMemories: any[]): boolean {
    if (sessionMemories.length === 0) return false;

    // Check if any memory exceeds threshold
    const hasImportantMemory = sessionMemories.some(
      m => m.importance >= this.config.reflectionThreshold
    );

    // Check if session had strong emotions
    const hasStrongEmotion = sessionMemories.some(
      m => Math.abs(m.emotionalValence) >= 2
    );

    return hasImportantMemory || hasStrongEmotion;
  }

  /**
   * Apply session-based decay to memories
   */
  private applySessionDecay(state: CharacterMemoryState, daysPassed: number): void {
    characterMemoryStore.applyDecay(state.characterId, daysPassed);
  }

  /**
   * Get memories from a specific session
   */
  private getSessionMemories(state: CharacterMemoryState, sessionId: string): any[] {
    const allMemories: any[] = [
      ...Array.from(state.episodicMemories.values()),
      ...Array.from(state.semanticMemories.values()),
      ...Array.from(state.proceduralMemories.values()),
    ];

    return allMemories.filter(m => m.sessionId === sessionId);
  }

  /**
   * Generate consolidation summary
   */
  private generateConsolidationSummary(
    characterId: string,
    memoryCount: number,
    result: ConsolidationResult
  ): string {
    const parts: string[] = [];

    parts.push(`Processed ${memoryCount} memories.`);

    if (result.memoriesCreated > 0) {
      parts.push(`Created ${result.memoriesCreated} new memories.`);
    }

    if (result.reflectionsGenerated > 0) {
      parts.push(`Generated ${result.reflectionsGenerated} reflections.`);
    }

    if (result.memoriesDecayed > 0) {
      parts.push(`${result.memoriesDecayed} memories decayed.`);
    }

    return parts.join(' ');
  }

  // ========================================================================
  // TRANSFER BETWEEN TIERS
  // ========================================================================

  /**
   * Promote a memory to a higher tier
   */
  promoteMemory(
    characterId: string,
    memoryId: string,
    targetTier: MemoryTier
  ): void {
    const state = characterMemoryStore.getCharacterState(characterId);
    const sourceMemory = characterMemoryStore['findMemoryById'](state, memoryId);

    if (!sourceMemory) return;

    // Don't promote if already at target tier
    if (sourceMemory.tier === targetTier) return;

    // Create new memory at target tier
    switch (targetTier) {
      case MemoryTier.SEMANTIC:
        if (sourceMemory.tier === MemoryTier.EPISODIC) {
          const episodic = sourceMemory as EpisodicMemory;
          characterMemoryStore.addSemanticMemory(characterId, {
            type: MemoryType.FACT,
            timestamp: Date.now(),
            sessionId: sourceMemory.sessionId,
            campaignId: sourceMemory.campaignId,
            importance: sourceMemory.importance * 0.8,
            retrievalCount: 0,
            lastAccessed: Date.now(),
            tags: sourceMemory.tags,
            fact: episodic.description,
            confidence: episodic.importance,
            source: 'consolidated',
            sourceId: episodic.id,
          });
        }
        break;

      case MemoryTier.PROCEDURAL:
        if (sourceMemory.tier === MemoryTier.EPISODIC) {
          const episodic = sourceMemory as EpisodicMemory;
          characterMemoryStore.addProceduralMemory(characterId, {
            type: MemoryType.BEHAVIOR,
            timestamp: Date.now(),
            sessionId: sourceMemory.sessionId,
            campaignId: sourceMemory.campaignId,
            importance: sourceMemory.importance * 0.7,
            retrievalCount: 0,
            lastAccessed: Date.now(),
            tags: [...sourceMemory.tags, 'learned'],
            skill: `handling: ${episodic.type}`,
            proficiency: episodic.importance * 0.5,
            practiceCount: 1,
            contexts: [episodic.type],
          });
        }
        break;

      case MemoryTier.IDENTITY:
        // Only very important things become identity
        if (sourceMemory.importance > 0.9) {
          characterMemoryStore.addIdentityMemory(characterId, {
            type: MemoryType.FACT,
            timestamp: Date.now(),
            sessionId: sourceMemory.sessionId,
            campaignId: sourceMemory.campaignId,
            importance: 1.0,
            retrievalCount: 0,
            lastAccessed: Date.now(),
            tags: ['identity', 'core'],
            trait: this.mapMemoryToTrait(sourceMemory),
            value: true,
            stability: 0.7,
            origin: 'consolidated from experience',
          });
        }
        break;
    }
  }

  /**
   * Batch transfer memories between tiers
   */
  batchTransfer(
    characterId: string,
    sourceTier: MemoryTier,
    targetTier: MemoryTier,
    importanceThreshold: number = 0.7
  ): number {
    const state = characterMemoryStore.getCharacterState(characterId);
    const sourceMemories = characterMemoryStore.queryMemories(characterId, {
      tiers: [sourceTier],
      importance: { min: importanceThreshold },
    }).memories;

    let transferred = 0;

    for (const memory of sourceMemories) {
      this.promoteMemory(characterId, memory.id, targetTier);
      transferred++;
    }

    return transferred;
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private mapFirstTimeToTrait(memory: EpisodicMemory): { name: string; value: string | boolean } | null {
    const traitMap: Record<string, { name: string; value: string }> = {
      first_kill: { name: 'has_killed', value: 'true' },
      first_city: { name: 'worldly', value: 'true' },
      first_magic: { name: 'magical_affinity', value: 'true' },
      first_betrayal: { name: 'trust_issues', value: 'true' },
      first_leadership: { name: 'leadership_potential', value: 'true' },
    };

    for (const [tag, trait] of Object.entries(traitMap)) {
      if (memory.tags.includes(tag)) {
        return trait;
      }
    }

    return null;
  }

  private generateBehavioralChange(memory: EpisodicMemory): string {
    if (memory.emotionalValence <= EmotionalValence.NEGATIVE) {
      return 'I will be more cautious in similar situations.';
    }
    if (memory.emotionalValence >= EmotionalValence.POSITIVE) {
      return 'I should seek more experiences like this.';
    }
    return undefined;
  }

  private mapMemoryToTrait(memory: any): string {
    // Map memory type to trait name
    const typeTraitMap: Record<string, string> = {
      combat: 'warrior',
      social: 'diplomat',
      discovery: 'explorer',
      quest: 'adventurer',
    };

    return typeTraitMap[memory.type] || 'experienced';
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ConsolidationConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): ConsolidationConfig {
    return { ...this.config };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const memoryConsolidationEngine = new MemoryConsolidationEngine();
