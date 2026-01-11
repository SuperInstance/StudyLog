/**
 * DMLoG.AI - Temporal Consciousness System
 *
 * Simulates time perception for NPCs, creating believable memory retrieval
 * patterns, anticipation of future events, and narrative self-awareness.
 */

import {
  EmotionalValence,
  MemoryTier,
  MemoryType,
  EpisodicMemory,
  ReflectionMemory,
  TemporalConsciousness,
  TemporalFocus,
  TemporalBias,
  TemporalLandmark,
  TemporalLandmarkEntry,
  AnticipatedEvent,
  LifePeriod,
  CharacterMemoryState,
  MemoryQuery,
} from './types.js';
import { characterMemoryStore } from './character-memory.js';

// ============================================================================
// TEMPORAL CONSCIOUSNESS MANAGER
// ============================================================================

export class TemporalConsciousnessManager {
  /**
   * Process a new event through temporal consciousness
   */
  processEvent(
    characterId: string,
    memory: EpisodicMemory,
    state: CharacterMemoryState
  ): void {
    const tc = state.temporalConsciousness;

    // Check if this should be a temporal landmark
    const landmark = this.evaluateAsLandmark(memory, state);
    if (landmark) {
      tc.temporalLandmarks.push(landmark);
      memory.temporalLandmark = {
        type: landmark.type,
        significance: landmark.narrativeWeight,
        narrativeImpact: landmark.description,
      };

      // Update temporal narrative
      this.updateTemporalNarrative(characterId, state);
    }

    // Update time perception based on event intensity
    this.updateTimePerception(characterId, memory, tc);
  }

  /**
   * Evaluate if an event qualifies as a temporal landmark
   */
  private evaluateAsLandmark(
    memory: EpisodicMemory,
    state: CharacterMemoryState
  ): TemporalLandmarkEntry | null {
    const importance = memory.importance;
    const absEmotion = Math.abs(memory.emotionalValence);

    // High importance + strong emotion = potential landmark
    if (importance < 0.6 && absEmotion < 2) return null;

    // Determine landmark type based on context
    let type: TemporalLandmark['type'] = 'peak_experience';

    if (memory.type === MemoryType.FIRST_ENCOUNTER || memory.tags.includes('first_time')) {
      type = 'first_time';
    } else if (memory.emotionalValence === EmotionalValence.VERY_NEGATIVE) {
      type = memory.importance > 0.8 ? 'trauma' : 'turning_point';
    } else if (memory.emotionalValence === EmotionalValence.VERY_POSITIVE) {
      type = memory.importance > 0.8 ? 'triumph' : 'peak_experience';
    } else if (memory.tags.includes('choice') || memory.tags.includes('decision')) {
      type = 'turning_point';
    } else if (memory.tags.includes('death') || memory.tags.includes('farewell')) {
      type = 'closure';
    }

    return {
      id: `landmark_${memory.id}`,
      timestamp: memory.timestamp,
      type,
      title: this.generateLandmarkTitle(memory, type),
      description: memory.description,
      emotionalValence: memory.emotionalValence,
      memoryIds: [memory.id],
      narrativeWeight: importance,
    };
  }

  private generateLandmarkTitle(memory: EpisodicMemory, type: TemporalLandmark['type']): string {
    const titles: Record<TemporalLandmark['type'], string[]> = {
      first_time: ['The First Time', 'A New Beginning', 'First Steps', 'The Discovery'],
      peak_experience: ['The High Point', 'Unforgettable', 'The Pinnacle', 'Peak Moment'],
      turning_point: ['The Crossroads', 'Everything Changed', 'The Decision', 'Turning Point'],
      closure: ['The End', 'Farewell', 'Closure', 'The Last Time'],
      trauma: ['The Darkest Day', 'The Wound', 'Never Forget', 'Scarred'],
      triumph: ['Victory', 'The Greatest Moment', 'Triumph', 'Conquered'],
    };

    const options = titles[type];
    return options[Math.floor(Math.random() * options.length)] + ': ' +
           memory.description.substring(0, 30);
  }

  /**
   * Update time perception based on recent events
   */
  private updateTimePerception(
    characterId: string,
    memory: EpisodicMemory,
    tc: TemporalConsciousness
  ): void {
    // High stress/intensity events make time feel slower
    const intensity = Math.abs(memory.emotionalValence);
    if (intensity >= 2) {
      tc.timePerception.subjectiveSpeed = Math.max(0.5, tc.timePerception.subjectiveSpeed - 0.1);
    }
    // Boring/routine events make time feel faster
    else if (intensity === 0) {
      tc.timePerception.subjectiveSpeed = Math.min(2, tc.timePerception.subjectiveSpeed + 0.05);
    }
    // Return to normal over time
    else {
      tc.timePerception.subjectiveSpeed = tc.timePerception.subjectiveSpeed * 0.95 + 1.0 * 0.05;
    }

    // Update focus horizon based on event type
    if (memory.tags.includes('combat') || memory.tags.includes('threat')) {
      tc.timePerception.focusHorizon = TemporalFocus.IMMEDIATE;
    } else if (memory.tags.includes('long_term') || memory.tags.includes('plan')) {
      tc.timePerception.focusHorizon = TemporalFocus.LONG_TERM;
    }
  }

  /**
   * Generate character's temporal narrative (their life story)
   */
  private updateTemporalNarrative(characterId: string, state: CharacterMemoryState): void {
    const tc = state.temporalConsciousness;
    const landmarks = tc.temporalLandmarks
      .sort((a, b) => a.timestamp - b.timestamp);

    if (landmarks.length === 0) {
      tc.temporalNarrative = 'A story yet to be written.';
      return;
    }

    // Build narrative from temporal landmarks
    const narrativeParts: string[] = [];

    for (const landmark of landmarks) {
      const timeDesc = this.getTimeDescription(landmark.timestamp, Date.now());
      const emotionDesc = this.getEmotionDescription(landmark.emotionalValence);

      narrativeParts.push(
        `${timeDesc}, ${emotionDesc} ${landmark.description}.`
      );
    }

    tc.temporalNarrative = narrativeParts.join(' ');
  }

  private getTimeDescription(eventTime: number, currentTime: number): string {
    const diff = currentTime - eventTime;
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }

  private getEmotionDescription(valence: EmotionalValence): string {
    const descriptions: Record<EmotionalValence, string> = {
      [EmotionalValence.VERY_NEGATIVE]: 'in despair',
      [EmotionalValence.NEGATIVE]: 'with sorrow',
      [EmotionalValence.NEUTRAL]: 'with clarity',
      [EmotionalValence.POSITIVE]: 'with joy',
      [EmotionalValence.VERY_POSITIVE]: 'in triumph',
    };
    return descriptions[valence];
  }

  // ========================================================================
  // ANTICIPATION & FUTURE THINKING
  // ========================================================================

  /**
   * Add an anticipated future event
   */
  addAnticipation(
    characterId: string,
    event: Omit<AnticipatedEvent, 'id'>
  ): AnticipatedEvent {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;

    const anticipation: AnticipatedEvent = {
      ...event,
      id: `anticipation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    tc.anticipatedEvents.push(anticipation);

    // Update anticipation bias
    if (event.emotionalValence >= EmotionalValence.POSITIVE) {
      if (tc.timePerception.anticipationBias === 'present') {
        tc.timePerception.anticipationBias = 'future';
      }
    } else if (event.emotionalValence <= EmotionalValence.NEGATIVE) {
      // Negative anticipation might create past-focused thinking
      if (tc.timePerception.anticipationBias === 'balanced') {
        tc.timePerception.anticipationBias = 'past';
      }
    }

    return anticipation;
  }

  /**
   * Get current anticipations for a character
   */
  getAnticipations(characterId: string): AnticipatedEvent[] {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;

    // Sort by importance and timing
    return tc.anticipatedEvents
      .filter(a => !this.isAnticipationResolved(a, state))
      .sort((a, b) => {
        // Expected timing considerations
        const aTime = a.expectedTiming || Infinity;
        const bTime = b.expectedTiming || Infinity;
        if (aTime !== bTime) return aTime - bTime;

        // Then by importance
        return b.importance - a.importance;
      });
  }

  private isAnticipationResolved(anticipation: AnticipatedEvent, state: CharacterMemoryState): boolean {
    // Check if anticipated event has occurred in episodic memories
    for (const memory of state.episodicMemories.values()) {
      if (memory.tags.includes(`anticipation_${anticipation.id}`)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate anticipation for an upcoming event
   */
  generateAnticipationPrompt(
    characterId: string,
    upcomingEvent: {
      description: string;
      timing: number; // timestamp
      certainty: number;
    }
  ): string {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;

    const timeUntil = upcomingEvent.timing - Date.now();
    const daysUntil = Math.floor(timeUntil / 86400000);

    let prompt = `Thinking about the upcoming event: ${upcomingEvent.description}. `;

    // Based on time perception
    if (tc.timePerception.subjectiveSpeed < 0.8) {
      prompt += 'Time feels slow - this is weighing heavily. ';
    } else if (tc.timePerception.subjectiveSpeed > 1.2) {
      prompt += 'Time is flying - this will be here before I know it. ';
    }

    // Based on anticipation bias
    switch (tc.timePerception.anticipationBias) {
      case 'future':
        prompt += 'Looking forward to what comes next. ';
        break;
      case 'past':
        prompt += 'The past echoes in my thoughts about this. ';
        break;
      case 'present':
        prompt += 'Focusing on the here and now. ';
        break;
      case 'balanced':
        prompt += 'Balancing past lessons with future hopes. ';
        break;
    }

    // Add similar past events
    const similarMemories = this.findSimilarPastEvents(
      characterId,
      upcomingEvent.description,
      state
    );

    if (similarMemories.length > 0) {
      prompt += '\n\nSimilar past experiences:\n';
      for (const memory of similarMemories.slice(0, 3)) {
        prompt += `- ${this.getTimeDescription(memory.timestamp, Date.now())}: ${memory.description}\n`;
      }
    }

    return prompt;
  }

  private findSimilarPastEvents(
    characterId: string,
    description: string,
    state: CharacterMemoryState
  ): EpisodicMemory[] {
    const keywords = description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const similar: Array<{ memory: EpisodicMemory; score: number }> = [];

    for (const memory of state.episodicMemories.values()) {
      const memoryDesc = memory.description.toLowerCase();
      const overlap = keywords.filter(k => memoryDesc.includes(k)).length;

      if (overlap > 0) {
        similar.push({ memory, score: overlap });
      }
    }

    return similar
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.memory);
  }

  // ========================================================================
  // LIFE PERIODIZATION
  // ========================================================================

  /**
   * Create or update life periods based on memories
   */
  updateLifePeriods(characterId: string): void {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;

    // Group memories into natural periods
    const memories = Array.from(state.episodicMemories.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    if (memories.length < 5) {
      // Not enough memories for periodization
      return;
    }

    // Identify natural breaks in the timeline
    const periods: LifePeriod[] = [];
    let currentPeriod: Partial<LifePeriod> = {
      startTimestamp: memories[0].timestamp,
      keyMemories: [],
      definingTraits: [],
    };

    for (let i = 0; i < memories.length; i++) {
      const memory = memories[i];
      const nextMemory = memories[i + 1];

      currentPeriod.keyMemories!.push(memory.id);

      // Check for natural break (significant time gap or landmark)
      const timeGap = nextMemory ? (nextMemory.timestamp - memory.timestamp) / 86400000 : 0;
      const isLandmark = memory.temporalLandmark &&
                        ['turning_point', 'trauma', 'triumph', 'closure'].includes(memory.temporalLandmark.type);

      if (isLandmark || timeGap > 30 || !nextMemory) {
        // End current period
        periods.push({
          id: `period_${periods.length}`,
          name: this.generatePeriodName(memories, currentPeriod.keyMemories!),
          startTimestamp: currentPeriod.startTimestamp!,
          endTimestamp: memory.timestamp,
          description: this.generatePeriodDescription(memories, currentPeriod.keyMemories!),
          definingTraits: this.extractPeriodTraits(memories, currentPeriod.keyMemories!),
          keyMemories: currentPeriod.keyMemories!,
        });

        // Start new period
        if (nextMemory) {
          currentPeriod = {
            startTimestamp: nextMemory.timestamp,
            keyMemories: [],
            definingTraits: [],
          };
        }
      }
    }

    tc.periodization = periods;
  }

  private generatePeriodName(
    allMemories: EpisodicMemory[],
    periodMemoryIds: string[]
  ): string {
    const periodMemories = allMemories.filter(m => periodMemoryIds.includes(m.id));
    const tags = periodMemories.flatMap(m => m.tags);

    if (tags.includes('adventure')) return 'The Adventuring Days';
    if (tags.includes('war')) return 'The War Years';
    if (tags.includes('peace')) return 'Peaceful Times';
    if (tags.includes('training')) return 'Days of Learning';
    if (tags.includes('loss')) return 'The Winter of Sorrow';
    if (tags.includes('victory')) return 'The Triumphant Era';

    const landmarks = periodMemories.filter(m => m.temporalLandmark);
    if (landmarks.length > 0) {
      return `The ${landmarks[0].temporalLandmark!.type.replace('_', ' ')} Period`;
    }

    return `Period ${periodMemoryIds.length}`;
  }

  private generatePeriodDescription(
    allMemories: EpisodicMemory[],
    periodMemoryIds: string[]
  ): string {
    const periodMemories = allMemories.filter(m => periodMemoryIds.includes(m.id));
    const locations = [...new Set(periodMemories.map(m => m.location).filter(Boolean))];
    const participants = [...new Set(periodMemories.flatMap(m => m.participants))];

    let desc = `This period included ${periodMemories.length} significant events.`;

    if (locations.length > 0) {
      desc += ` Time was spent in ${locations.slice(0, 3).join(', ')}.`;
    }

    if (participants.length > 0) {
      desc += ` Companions included ${participants.slice(0, 3).join(', ')}.`;
    }

    return desc;
  }

  private extractPeriodTraits(
    allMemories: EpisodicMemory[],
    periodMemoryIds: string[]
  ): string[] {
    const periodMemories = allMemories.filter(m => periodMemoryIds.includes(m.id));
    const traits: string[] = [];

    // Analyze emotional patterns
    const avgEmotion = periodMemories.reduce((sum, m) => sum + m.emotionalValence, 0) / periodMemories.length;
    if (avgEmotion >= 1) traits.push('joyful');
    if (avgEmotion <= -1) traits.push('troubled');
    if (avgEmotion === 0) traits.push('balanced');

    // Analyze activity patterns
    const combatCount = periodMemories.filter(m => m.type === MemoryType.COMBAT).length;
    const socialCount = periodMemories.filter(m => m.type === MemoryType.SOCIAL).length;

    if (combatCount > periodMemories.length / 2) traits.push('warlike');
    if (socialCount > periodMemories.length / 2) traits.push('social');

    return traits;
  }

  // ========================================================================
  // TEMPORAL MEMORY RETRIEVAL
  // ========================================================================

  /**
   * Get memories based on temporal focus
   */
  getTemporallyRelevantMemories(
    characterId: string,
    focus: TemporalFocus
  ): MemoryQuery {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;
    const now = Date.now();

    switch (focus) {
      case TemporalFocus.IMMEDIATE:
        // Very recent events, high importance
        return {
          tiers: [MemoryTier.EPISODIC, MemoryTier.WORKING],
          importance: { min: 0.5 },
          timeRange: { start: now - 86400000 }, // Last 24 hours
        };

      case TemporalFocus.SHORT_TERM:
        // Recent session
        return {
          tiers: [MemoryTier.EPISODIC],
          timeRange: { start: now - 7 * 86400000 }, // Last week
        };

      case TemporalFocus.MEDIUM_TERM:
        // Current arc/period
        const currentPeriod = tc.periodization[tc.periodization.length - 1];
        return {
          tiers: [MemoryTier.EPISODIC, MemoryTier.SEMANTIC],
          timeRange: {
            start: currentPeriod?.startTimestamp || now - 30 * 86400000,
          },
        };

      case TemporalFocus.LONG_TERM:
        // Campaign history, identity
        return {
          tiers: [MemoryTier.IDENTITY, MemoryTier.REFLECTION, MemoryTier.PROCEDURAL],
          limit: 20,
        };

      case TemporalFocus.LEGACY:
        // Most important life memories
        return {
          tiers: [MemoryTier.REFLECTION, MemoryTier.IDENTITY],
          importance: { min: 0.8 },
        };
    }
  }

  /**
   * Get memory recall based on how time feels to the character
   */
  getSubjectiveMemoryRecall(characterId: string): {
    memories: EpisodicMemory[];
    perspective: string;
  } {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;
    const now = Date.now();

    let timeHorizon = 30 * 86400000; // Default 30 days

    // Time feels slower when stressed - memories feel more recent
    if (tc.timePerception.subjectiveSpeed < 0.8) {
      timeHorizon *= 2;
    }
    // Time feels faster - only very recent memories feel vivid
    else if (tc.timePerception.subjectiveSpeed > 1.2) {
      timeHorizon *= 0.5;
    }

    // Apply memory depth
    const memoryDepthDays = tc.timePerception.memoryDepth;
    const maxAge = memoryDepthDays * 86400000;

    const query: MemoryQuery = {
      tiers: [MemoryTier.EPISODIC],
      timeRange: { start: now - Math.min(timeHorizon, maxAge) },
      limit: 15,
    };

    const result = characterMemoryStore.queryMemories(characterId, query);

    let perspective = '';

    // Generate perspective based on time perception
    if (tc.timePerception.subjectiveSpeed < 0.7) {
      perspective = 'Every moment feels stretched. Recent events loom large.';
    } else if (tc.timePerception.subjectiveSpeed > 1.3) {
      perspective = 'Time is slipping away. Days blur together.';
    } else {
      perspective = 'Time flows naturally.';
    }

    return {
      memories: result.memories.filter((m): m is EpisodicMemory => m.tier === MemoryTier.EPISODIC),
      perspective,
    };
  }

  // ========================================================================
  // REFLECTION ON TIME
  /// ========================================================================

  /**
   * Generate temporal reflection (meta-cognition about time)
   */
  generateTemporalReflection(characterId: string): ReflectionMemory {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;
    const now = Date.now();

    // Analyze time patterns
    const totalMemories = state.episodicMemories.size;
    const recentMemories = Array.from(state.episodicMemories.values())
      .filter(m => now - m.timestamp < 30 * 86400000).length;

    let reflection = '';
    let emotionalImpact = EmotionalValence.NEUTRAL;

    // Activity level
    if (recentMemories > totalMemories * 0.3) {
      reflection += 'So much has happened recently. ';
      emotionalImpact = EmotionalValence.POSITIVE;
    } else if (recentMemories < totalMemories * 0.05) {
      reflection += 'Things have been quiet lately. ';
      emotionalImpact = EmotionalValence.NEGATIVE;
    }

    // Landmark reflection
    if (tc.temporalLandmarks.length > 0) {
      const mostSignificant = tc.temporalLandmarks
        .sort((a, b) => b.narrativeWeight - a.narrativeWeight)[0];

      reflection += `I often think back to ${mostSignificant.title.toLowerCase()}. `;

      if (mostSignificant.emotionalValence >= EmotionalValence.POSITIVE) {
        emotionalImpact = EmotionalValence.VERY_POSITIVE;
      } else if (mostSignificant.emotionalValence <= EmotionalValence.NEGATIVE) {
        emotionalImpact = EmotionalValence.NEGATIVE;
      }
    }

    // Future outlook
    const anticipations = this.getAnticipations(characterId);
    if (anticipations.length > 0) {
      const nextImportant = anticipations[0];
      reflection += `Looking ahead, I anticipate ${nextImportant.description.toLowerCase()}. `;
    } else {
      reflection += 'The future is uncertain. ';
    }

    return {
      id: `reflection_temporal_${Date.now()}`,
      tier: MemoryTier.REFLECTION,
      type: MemoryType.INSIGHT,
      timestamp: now,
      sessionId: 'temporal',
      campaignId: state.campaignId,
      importance: 0.6,
      retrievalCount: 0,
      lastAccessed: now,
      tags: ['temporal', 'reflection', 'time'],
      subjectMemoryIds: tc.temporalLandmarks.map(l => l.memoryIds).flat(),
      insight: reflection,
      emotionalImpact,
      selfAssessment: {
        growth: recentMemories > totalMemories * 0.2 ? 0.7 : 0.3,
        pride: tc.temporalLandmarks.filter(l => l.emotionalValence >= EmotionalValence.POSITIVE).length /
               Math.max(1, tc.temporalLandmarks.length),
      },
    };
  }

  // ========================================================================
  // TIME AWARENESS CHECK
  // ========================================================================

  /**
   * Check if character is aware of current in-game time/context
   */
  getTimeAwarenessPrompt(characterId: string, currentContext: {
    inGameTime?: string;
    location?: string;
    season?: string;
    year?: number;
  }): string {
    const state = characterMemoryStore.getCharacterState(characterId);
    const tc = state.temporalConsciousness;

    let prompt = 'Time awareness: ';

    // Based on focus horizon
    switch (tc.timePerception.focusHorizon) {
      case TemporalFocus.IMMEDIATE:
        prompt += 'My mind is on the present moment - what is happening right now.';
        break;
      case TemporalFocus.SHORT_TERM:
        prompt += 'I am thinking about today and the near future.';
        break;
      case TemporalFocus.MEDIUM_TERM:
        prompt += 'My thoughts span the current chapter of my life.';
        break;
      case TemporalFocus.LONG_TERM:
        prompt += 'I consider the long journey and where it is leading.';
        break;
      case TemporalFocus.LEGACY:
        prompt += 'I think about what will remain after I am gone.';
        break;
    }

    // Add context-specific awareness
    if (currentContext.inGameTime) {
      prompt += `\nCurrent time: ${currentContext.inGameTime}`;
    }

    if (currentContext.season) {
      // Check for seasonal memories
      const seasonalMemories = Array.from(state.episodicMemories.values())
        .filter(m => m.tags.includes(currentContext.season!.toLowerCase()));

      if (seasonalMemories.length > 0) {
        prompt += `\n${currentContext.season} reminds me of past events...`;
      }
    }

    return prompt;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const temporalConsciousnessManager = new TemporalConsciousnessManager();
