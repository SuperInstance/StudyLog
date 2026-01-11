/**
 * DMLoG.AI - Memory System Main API
 *
 * Unified interface for all memory operations in the DMLoG.AI system.
 * Integrates character, campaign, player, relationship, temporal, and plot memory.
 *
 * @module dmlog-memory
 */

// Re-export all types
export * from './types.js';

// Re-export managers
export {
  characterMemoryStore,
  CharacterMemoryStore,
} from './character-memory.js';

export {
  campaignMemoryStore,
  CampaignMemoryStore,
} from './campaign-memory.js';

export {
  playerMemoryStore,
  PlayerMemoryStore,
} from './player-memory.js';

export {
  relationshipTracker,
  RelationshipTracker,
  RelationshipEvent,
  RelationshipDebtEvent,
  RelationshipPromiseEvent,
} from './relationship-tracker.js';

export {
  temporalConsciousnessManager,
  TemporalConsciousnessManager,
} from './temporal-consciousness.js';

export {
  plotThreadManager,
  PlotThreadManager,
  PlotPotential,
  PlotType,
  PlotWeave,
  DramaticIrony,
} from './plot-threads.js';

export {
  memoryConsolidationEngine,
  MemoryConsolidationEngine,
  DEFAULT_CONSOLIDATION_CONFIG,
} from './memory-consolidation.js';

// Import internal dependencies
import {
  MemoryTier,
  MemoryType,
  EmotionalValence,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemory,
  IdentityMemory,
  MemoryQuery,
  CharacterMemoryState,
  SerializedCharacterMemory,
} from './types.js';

import {
  characterMemoryStore,
  CharacterMemoryStore,
} from './character-memory.js';

import {
  campaignMemoryStore,
  CampaignMemoryStore,
} from './campaign-memory.js';

import {
  playerMemoryStore,
  PlayerMemoryStore,
} from './player-memory.js';

import {
  relationshipTracker,
  RelationshipTracker,
} from './relationship-tracker.js';

import {
  temporalConsciousnessManager,
  TemporalConsciousnessManager,
} from './temporal-consciousness.js';

import {
  plotThreadManager,
  PlotThreadManager,
} from './plot-threads.js';

import {
  memoryConsolidationEngine,
  MemoryConsolidationEngine,
} from './memory-consolidation.js';

// ============================================================================
// MAIN MEMORY SYSTEM API
// ============================================================================

export class DMLoGMemorySystem {
  private characterStore: CharacterMemoryStore;
  private campaignStore: CampaignMemoryStore;
  private playerStore: PlayerMemoryStore;
  private relationshipTracker: RelationshipTracker;
  private temporalConsciousness: TemporalConsciousnessManager;
  private plotManager: PlotThreadManager;
  private consolidationEngine: MemoryConsolidationEngine;

  constructor() {
    this.characterStore = characterMemoryStore;
    this.campaignStore = campaignMemoryStore;
    this.playerStore = playerMemoryStore;
    this.relationshipTracker = relationshipTracker;
    this.temporalConsciousness = temporalConsciousnessManager;
    this.plotManager = plotThreadManager;
    this.consolidationEngine = memoryConsolidationEngine;
  }

  // ========================================================================
  // CHARACTER MEMORY API
  // ========================================================================

  /**
   * Initialize a character's memory
   */
  initializeCharacter(
    characterId: string,
    campaignId: string,
    identityTraits?: Array<{ trait: string; value: string | boolean; stability?: number }>
  ): CharacterMemoryState {
    return this.characterStore.initializeCharacter(
      characterId,
      campaignId,
      identityTraits
    );
  }

  /**
   * Add an episodic memory (specific event) for a character
   */
  addEpisodicMemory(
    characterId: string,
    memory: Omit<EpisodicMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): EpisodicMemory {
    const result = this.characterStore.addEpisodicMemory(characterId, memory);

    // Update temporal consciousness
    const state = this.characterStore.getCharacterState(characterId);
    this.temporalConsciousness.processEvent(characterId, result, state);

    return result;
  }

  /**
   * Add a semantic memory (fact) for a character
   */
  addSemanticMemory(
    characterId: string,
    memory: Omit<SemanticMemory, 'id' | 'tier' | 'timestamp' | 'retrievalCount' | 'lastAccessed'>
  ): SemanticMemory {
    return this.characterStore.addSemanticMemory(characterId, memory);
  }

  /**
   * Query memories for a character
   */
  queryMemories(characterId: string, query: MemoryQuery) {
    return this.characterStore.queryMemories(characterId, query);
  }

  /**
   * Get character's context for AI prompting
   */
  getCharacterPrompt(characterId: string, options?: {
    includeTemporal?: boolean;
    includeRelationships?: boolean;
    limit?: number;
  }): string {
    let prompt = `Character: ${characterId}\n`;

    // Working memory context
    const wm = this.characterStore['getCharacterState'](characterId)?.workingMemory;
    if (wm) {
      prompt += this.characterStore.getContextPrompt(characterId) + '\n';
    }

    // Temporal consciousness
    if (options?.includeTemporal) {
      const temporalState = this.temporalConsciousness.getSubjectiveMemoryRecall(characterId);
      prompt += `\n${temporalState.perspective}\n`;
    }

    // Recent memories
    const recentMemories = this.characterStore.queryMemories(characterId, {
      tiers: [MemoryTier.EPISODIC],
      limit: options?.limit || 10,
    });

    if (recentMemories.memories.length > 0) {
      prompt += '\nRecent Memories:\n';
      for (const memory of recentMemories.memories as EpisodicMemory[]) {
        const emotion = this.getEmotionLabel(memory.emotionalValence);
        prompt += `- [${emotion}] ${memory.description}\n`;
      }
    }

    // Relationships
    if (options?.includeRelationships) {
      const relationships = this.relationshipTracker.getStrongestRelationships(characterId, 3);
      if (relationships.length > 0) {
        prompt += '\nKey Relationships:\n';
        for (const { targetId, relationship } of relationships) {
          prompt += `- ${targetId}: ${relationship.relationshipType} (affinity: ${relationship.affinity})\n`;
        }
      }
    }

    return prompt;
  }

  // ========================================================================
  // CAMPAIGN MEMORY API
  // ========================================================================

  /**
   * Initialize a campaign
   */
  initializeCampaign(campaignId: string, name: string = '') {
    return this.campaignStore.initializeCampaign(campaignId, name);
  }

  /**
   * Start a new session
   */
  startSession(campaignId: string, sessionId: string, participants: string[]): void {
    this.campaignStore.startSession(campaignId, sessionId, participants);

    // Track for each player
    for (const participant of participants) {
      const playerMem = this.playerStore.getCampaignMemory(participant, campaignId);
      if (!playerMem) {
        this.playerStore.joinCampaign(participant, campaignId, participant);
      }
    }
  }

  /**
   * End a session and consolidate memories
   */
  async endSession(
    campaignId: string,
    sessionId: string,
    participants: string[],
    cliffhangers?: string[],
    nextSessionHooks?: string[]
  ): Promise<Map<string, any>> {
    this.campaignStore.endSession(campaignId, sessionId, cliffhangers, nextSessionHooks);

    const results = new Map();

    // Consolidate memories for each participant
    for (const participant of participants) {
      try {
        const result = await this.consolidationEngine.consolidateSession(
          participant,
          sessionId,
          campaignId
        );
        results.set(participant, result);
      } catch (e) {
        // Character might not exist in memory
        console.log(`Skipping consolidation for ${participant}:`, e);
      }
    }

    // Apply relationship decay
    for (const participant of participants) {
      try {
        this.relationshipTracker.applyDecay(participant, 1);
      } catch (e) {
        // Ignore
      }
    }

    return results;
  }

  /**
   * Get campaign summary
   */
  getCampaignSummary(campaignId: string): string {
    const state = this.campaignStore['getCampaignState'](campaignId);
    const sessionCount = state.worldState.get('session_count') || 0;
    const locationCount = state.locations.size;
    const plotThreadCount = state.plotThreads.size;
    const factionCount = state.factions.size;

    let summary = `Campaign: ${campaignId}\n`;
    summary += `Sessions: ${sessionCount}\n`;
    summary += `Locations: ${locationCount}\n`;
    summary += `Active Plot Threads: ${this.campaignStore.getActivePlotThreads(campaignId).length}/${plotThreadCount}\n`;
    summary += `Factions: ${factionCount}\n`;

    const activePlots = this.campaignStore.getActivePlotThreads(campaignId);
    if (activePlots.length > 0) {
      summary += '\nActive Plots:\n';
      for (const plot of activePlots.slice(0, 5)) {
        summary += `- ${plot.title} (${plot.status})\n`;
      }
    }

    return summary;
  }

  // ========================================================================
  // PLAYER MEMORY API
  // ========================================================================

  /**
   * Get or initialize player
   */
  getOrCreatePlayer(playerId: string) {
    return this.playerStore.getOrCreatePlayer(playerId);
  }

  /**
   * Record player session
   */
  recordPlayerSession(
    playerId: string,
    campaignId: string,
    durationMinutes: number,
    characterId?: string
  ): void {
    this.playerStore.recordSession(playerId, campaignId, durationMinutes, characterId);
  }

  /**
   * Update player playstyle
   */
  updatePlayerPlaystyle(
    playerId: string,
    observations: Partial<{
      combatPreference: string;
      roleplayPreference: string;
      problemSolving: string;
      riskTolerance: number;
      leadershipTendency: number;
      humorLevel: number;
      agencyPreference: number;
    }>
  ): void {
    this.playerStore.updatePlaystyle(playerId, observations);
  }

  /**
   * Get player recommendations
   */
  getPlayerRecommendations(playerId: string): string[] {
    return this.playerStore.getRecommendations(playerId);
  }

  // ========================================================================
  // RELATIONSHIP API
  // ========================================================================

  /**
   * Process a relationship event
   */
  processRelationshipEvent(event: {
    type: 'interaction' | 'gift' | 'betrayal' | 'help' | 'conflict' | 'alliance' | 'dialogue' | 'combat_together';
    sourceId: string;
    targetId: string;
    magnitude: number;
    description: string;
    emotionalValence?: EmotionalValence;
  }): void {
    this.relationshipTracker.processEvent(event);
  }

  /**
   * Get relationship between two characters
   */
  getRelationship(sourceId: string, targetId: string) {
    return this.relationshipTracker.getRelationship(sourceId, targetId);
  }

  /**
   * Get relationship prompt for AI
   */
  getRelationshipPrompt(sourceId: string, targetId: string): string {
    return this.relationshipTracker.generateRelationshipPrompt(sourceId, targetId);
  }

  // ========================================================================
  // PLOT THREAD API
  // ========================================================================

  /**
   * Get plot suggestions
   */
  getPlotSuggestions(campaignId: string) {
    return this.plotManager.discoverPlotPotentials(campaignId);
  }

  /**
   * Get scene suggestions for current situation
   */
  getSceneSuggestions(
    campaignId: string,
    locationId?: string,
    presentCharacters?: string[]
  ) {
    return this.plotManager.generateSceneSuggestions(campaignId, locationId, presentCharacters);
  }

  /**
   * Audit plot continuity
   */
  auditPlotContinuity(campaignId: string) {
    return this.plotManager.auditPlotContinuity(campaignId);
  }

  // ========================================================================
  // TEMPORAL CONSCIOUSNESS API
  // ========================================================================

  /**
   * Get character's temporal perspective
   */
  getTemporalPerspective(characterId: string): {
    memories: EpisodicMemory[];
    perspective: string;
    narrative: string;
  } {
    const recall = this.temporalConsciousness.getSubjectiveMemoryRecall(characterId);
    const state = this.characterStore.getCharacterState(characterId);

    return {
      memories: recall.memories,
      perspective: recall.perspective,
      narrative: state.temporalConsciousness.temporalNarrative,
    };
  }

  /**
   * Generate anticipation for upcoming event
   */
  generateAnticipation(
    characterId: string,
    upcomingEvent: {
      description: string;
      timing: number;
      certainty: number;
    }
  ): string {
    return this.temporalConsciousness.generateAnticipationPrompt(characterId, upcomingEvent);
  }

  // ========================================================================
  // SERIALIZATION API
  // ========================================================================

  /**
   * Serialize character memory
   */
  serializeCharacter(characterId: string): SerializedCharacterMemory | null {
    return this.characterStore.serialize(characterId);
  }

  /**
   * Deserialize character memory
   */
  deserializeCharacter(data: SerializedCharacterMemory): CharacterMemoryState {
    return this.characterStore.deserialize(data);
  }

  /**
   * Serialize campaign memory
   */
  serializeCampaign(campaignId: string) {
    return this.campaignStore.serialize(campaignId);
  }

  /**
   * Deserialize campaign memory
   */
  deserializeCampaign(data: any) {
    return this.campaignStore.deserialize(data);
  }

  /**
   * Serialize player memory
   */
  serializePlayer(playerId: string) {
    return this.playerStore.serialize(playerId);
  }

  /**
   * Deserialize player memory
   */
  deserializePlayer(data: any) {
    return this.playerStore.deserialize(data);
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private getEmotionLabel(valence: EmotionalValence): string {
    const labels: Record<EmotionalValence, string> = {
      [EmotionalValence.VERY_NEGATIVE]: 'Very Negative',
      [EmotionalValence.NEGATIVE]: 'Negative',
      [EmotionalValence.NEUTRAL]: 'Neutral',
      [EmotionalValence.POSITIVE]: 'Positive',
      [EmotionalValence.VERY_POSITIVE]: 'Very Positive',
    };
    return labels[valence];
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    characters: number;
    campaigns: number;
    players: number;
  } {
    return {
      characters: this.characterStore['characters'].size,
      campaigns: this.campaignStore['campaigns'].size,
      players: this.playerStore['players'].size,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const dmlogMemorySystem = new DMLoGMemorySystem();

// Default export
export default DMLoGMemorySystem;
