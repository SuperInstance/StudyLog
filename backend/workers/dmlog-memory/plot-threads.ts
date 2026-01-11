/**
 * DMLoG.AI - Plot Thread Management System
 *
 * Advanced plot tracking with:
 * - Thread discovery and suggestion
 * - Foreshadowing management
 * - Dramatic irony tracking
 * - Narrative arc analysis
 * - Plot thread weaving (connecting unrelated threads)
 */

import {
  PlotThread,
  PlotStatus,
  MemoryTier,
  MemoryType,
  EpisodicMemory,
  SemanticMemory,
  CampaignMemoryState,
  CharacterMemoryState,
} from './types.js';
import { campaignMemoryStore } from './campaign-memory.js';
import { characterMemoryStore } from './character-memory.js';

// ============================================================================
// PLOT THREAD ANALYSIS
// ============================================================================

export interface PlotPotential {
  description: string;
  characters: string[];
  locations: string[];
  importance: number;
  type: PlotType;
  foreshadowing?: string[];
}

export enum PlotType {
  PERSONAL = 'personal', // Character-driven
  POLITICAL = 'political', // Faction/intrigue
  MYSTERY = 'mystery', // Investigation/discovery
  CONFLICT = 'conflict', // Combat/antagonist
  ROMANCE = 'romance', // Relationship
  TRAGEDY = 'tragedy', // Loss/betrayal
  TRIUMPH = 'triumph', // Victory/achievement
  REDEMPTION = 'redemption', // Forgiveness/change
  REVENGE = 'revenge', // Vengeance
  DISCOVERY = 'discovery', // Exploration/revelation
}

export interface PlotWeave {
  threadIds: string[];
  connectionType: 'causal' | 'thematic' | 'coincidental' | 'inevitable';
  description: string;
  potential: number; // 0-1
}

export interface DramaticIrony {
  information: string;
  charactersAware: string[];
  charactersUnaware: string[];
  tension: number; // 0-1
  revealPotential: string[];
}

// ============================================================================
// PLOT THREAD MANAGER
// ============================================================================

export class PlotThreadManager {
  /**
   * Analyze campaign state and suggest potential plot threads
   */
  discoverPlotPotentials(campaignId: string): PlotPotential[] {
    const campaignState = campaignMemoryStore['getCampaignState'](campaignId);
    const potentials: PlotPotential[] = [];

    // Analyze faction tensions
    for (const [factionId, faction] of campaignState.factions) {
      for (const [targetId, rel] of faction.relationships) {
        if (rel.relation === 'hostile' || rel.relation === 'at_war') {
          potentials.push({
            description: `Escalating conflict between ${faction.name} and ${campaignState.factions.get(targetId)?.name || targetId}`,
            characters: [],
            locations: [],
            importance: rel.tension * 0.8,
            type: PlotType.POLITICAL,
          });
        }

        // Check for brewing conflicts
        if (rel.tension > 0.5 && rel.relation === 'neutral') {
          potentials.push({
            description: `Growing tension between ${faction.name} and ${campaignState.factions.get(targetId)?.name || targetId}`,
            characters: [],
            locations: [],
            importance: rel.tension * 0.6,
            type: PlotType.POLITICAL,
            foreshadowing: [
              'Rumors of disagreement',
              'Minor border incidents',
              'Trade disruptions',
            ],
          });
        }
      }
    }

    // Analyze location secrets
    for (const [locId, location] of campaignState.locations) {
      if (location.secrets && location.secrets.length > 0) {
        for (const secret of location.secrets) {
          potentials.push({
            description: `The secret of ${location.name}: ${secret}`,
            characters: location.characters,
            locations: [locId],
            importance: 0.7,
            type: PlotType.MYSTERY,
            foreshadowing: [
              'Strange occurrences nearby',
              'Local legends',
              'Inhabitants acting suspiciously',
            ],
          });
        }
      }

      // Check for high-traffic locations (potential conflict sites)
      if (location.visitCount > 5 && location.characters.length > 3) {
        potentials.push({
          description: `Convergence at ${location.name} - multiple interests collide`,
          characters: location.characters,
          locations: [locId],
          importance: 0.5,
          type: PlotType.CONFLICT,
        });
      }
    }

    // Analyze existing plot threads for unresolved threads
    for (const [threadId, thread] of campaignState.plotThreads) {
      if (thread.status === PlotStatus.ACTIVE && thread.cliffhangers) {
        for (const cliffhanger of thread.cliffhangers) {
          potentials.push({
            description: `Resolution to: ${cliffhanger}`,
            characters: thread.involvedCharacters,
            locations: thread.relatedLocations,
            importance: thread.importance * 0.9,
            type: this.inferPlotType(thread),
          });
        }
      }
    }

    return potentials.sort((a, b) => b.importance - a.importance);
  }

  /**
   * Create a new plot thread from a potential
   */
  createFromPotential(
    campaignId: string,
    potential: PlotPotential,
    title?: string
  ): PlotThread {
    return campaignMemoryStore.createPlotThread(campaignId, {
      title: title || potential.description.substring(0, 50),
      description: potential.description,
      status: PlotStatus.DORMANT,
      importance: potential.importance,
      involvedCharacters: potential.characters,
      relatedLocations: potential.locations,
      keyEvents: [],
      tags: [potential.type, 'suggested'],
    });
  }

  /**
   * Find connections between plot threads (weaving)
   */
  findPlotWeaves(campaignId: string): PlotWeave[] {
    const campaignState = campaignMemoryStore['getCampaignState'](campaignId);
    const threads = Array.from(campaignState.plotThreads.values());
    const weaves: PlotWeave[] = [];

    for (let i = 0; i < threads.length; i++) {
      for (let j = i + 1; j < threads.length; j++) {
        const threadA = threads[i];
        const threadB = threads[j];

        // Check for character overlap
        const charOverlap = this.findOverlap(
          threadA.involvedCharacters,
          threadB.involvedCharacters
        );

        if (charOverlap.length > 0) {
          weaves.push({
            threadIds: [threadA.id, threadB.id],
            connectionType: 'causal',
            description: `Shared character(s): ${charOverlap.join(', ')}`,
            potential: charOverlap.length / Math.max(threadA.involvedCharacters.length, threadB.involvedCharacters.length),
          });
        }

        // Check for location overlap
        const locOverlap = this.findOverlap(
          threadA.relatedLocations,
          threadB.relatedLocations
        );

        if (locOverlap.length > 0) {
          weaves.push({
            threadIds: [threadA.id, threadB.id],
            connectionType: 'coincidental',
            description: `Shared location(s): ${locOverlap.join(', ')}`,
            potential: 0.5,
          });
        }

        // Check for thematic overlap via tags
        const tagOverlap = this.findOverlap(threadA.tags, threadB.tags);
        if (tagOverlap.length >= 2) {
          weaves.push({
            threadIds: [threadA.id, threadB.id],
            connectionType: 'thematic',
            description: `Thematic connection: ${tagOverlap.join(', ')}`,
            potential: tagOverlap.length * 0.2,
          });
        }
      }
    }

    return weaves.sort((a, b) => b.potential - a.potential);
  }

  /**
   * Track dramatic irony (information asymmetry)
   */
  trackDramaticIrony(
    campaignId: string,
    information: string,
    awareCharacters: string[],
    unawareCharacters: string[]
  ): DramaticIrony {
    const campaignState = campaignMemoryStore['getCampaignState'](campaignId);

    // Calculate tension based on importance of information
    const tension = Math.min(1, unawareCharacters.length * 0.2 + 0.3);

    const irony: DramaticIrony = {
      information,
      charactersAware: awareCharacters,
      charactersUnaware: unawareCharacters,
      tension,
      revealPotential: this.generateRevealScenarios(information, awareCharacters, unawareCharacters),
    };

    // Store as world state
    const existingIrony = campaignState.worldState.get('dramatic_irony') as DramaticIrony[] || [];
    existingIrony.push(irony);
    campaignState.worldState.set('dramatic_irony', existingIrony);

    return irony;
  }

  /**
   * Get active dramatic irony for a character
   */
  getDramaticIronyForCharacter(campaignId: string, characterId: string): DramaticIrony[] {
    const campaignState = campaignMemoryStore['getCampaignState'](campaignId);
    const allIrony = campaignState.worldState.get('dramatic_irony') as DramaticIrony[] || [];

    return allIrony.filter(irony =>
      irony.charactersUnaware.includes(characterId) ||
      irony.charactersAware.includes(characterId)
    );
  }

  /**
   * Suggest foreshadowing for a plot thread
   */
  generateForeshadowing(
    campaignId: string,
    threadId: string,
    intensity: 'subtle' | 'moderate' | 'overt' = 'moderate'
  ): string[] {
    const thread = campaignMemoryStore.getPlotThreadsByTag(campaignId, threadId)[0];
    if (!thread) return [];

    const foreshadowing: string[] = [];

    // Generate foreshadowing based on plot type
    const type = this.inferPlotType(thread);

    switch (type) {
      case PlotType.TRAGEDY:
        foreshadowing.push(
          'Ominous dreams or portents',
          'Minor setbacks that foreshadow major loss',
          "Characters' plans going slightly wrong",
          'Sense of time running out'
        );
        break;

      case PlotType.TRIUMPH:
        foreshadowing.push(
          'Unexpected allies appearing',
          'Seemingly lucky breaks',
          'Tools or resources being "coincidentally" available',
          'Training or preparation paying off'
        );
        break;

      case PlotType.BETRAYAL:
        foreshadowing.push(
          'Minor deceptions or half-truths',
          'Questions about loyalty',
          'Conflicting interests hinted at',
          'Past betrayals mentioned'
        );
        break;

      case PlotType.REVELATION:
        foreshadowing.push(
          'Inconsistent details',
          'Characters with hidden knowledge',
          'Documents or prophecies with unclear meanings',
          'Truths that are "almost" discovered'
        );
        break;

      case PlotType.REVENGE:
        foreshadowing.push(
          'Past wrongs being referenced',
          'Vengeful characters appearing',
          'Plans being set in motion',
          'The target being unaware of danger'
        );
        break;
    }

    // Adjust based on intensity
    if (intensity === 'subtle') {
      return foreshadowing.map(f => `Subtle hint of ${f.toLowerCase()}`);
    } else if (intensity === 'overt') {
      return foreshadowing.map(f => `Clear signs of ${f.toLowerCase()}`);
    }

    return foreshadowing;
  }

  /**
   * Analyze narrative arc of a plot thread
   */
  analyzeNarrativeArc(campaignId: string, threadId: string): {
    arc: 'exposition' | 'rising' | 'climax' | 'falling' | 'resolution';
    progress: number; // 0-1
    recommendations: string[];
  } {
    const thread = campaignMemoryStore.getPlotThreadsByTag(campaignId, threadId)[0];
    if (!thread) {
      return { arc: 'exposition', progress: 0, recommendations: [] };
    }

    const eventCount = thread.keyEvents.length;
    const hasCliffhanger = thread.cliffhangers && thread.cliffhangers.length > 0;
    const isResolved = thread.status === PlotStatus.RESOLVED;

    let arc: 'exposition' | 'rising' | 'climax' | 'falling' | 'resolution';
    let progress: number;
    const recommendations: string[] = [];

    if (eventCount === 0) {
      arc = 'exposition';
      progress = 0;
      recommendations.push('Introduce key characters and stakes');
    } else if (eventCount < 3) {
      arc = 'rising';
      progress = 0.25;
      recommendations.push('Build tension with complications');
      recommendations.push('Develop character motivations');
    } else if (eventCount < 5 && !isResolved) {
      arc = 'rising';
      progress = 0.5;
      recommendations.push('Raise the stakes');
      recommendations.push('Create a turning point');
    } else if (hasCliffhanger && !isResolved) {
      arc = 'climax';
      progress = 0.75;
      recommendations.push('Push toward confrontation');
      recommendations.push('Force difficult choices');
    } else if (isResolved) {
      arc = 'resolution';
      progress = 1;
      recommendations.push('Explore consequences');
      recommendations.push('Tie up loose ends');
    } else {
      arc = 'falling';
      progress = 0.9;
      recommendations.push('Move toward resolution');
    }

    // Adjust based on satisfaction
    if (thread.resolution && thread.resolution.satisfaction < 0.5) {
      recommendations.push('Consider follow-up or complications');
    }

    return { arc, progress, recommendations };
  }

  /**
   * Check for plot holes or inconsistencies
   */
  auditPlotContinuity(campaignId: string): {
    holes: Array<{ threadId: string; issue: string }>;
    inconsistencies: Array<{ threadId: string; issue: string }>;
    dropped: Array<{ threadId: string; title: string }>;
  } {
    const campaignState = campaignMemoryStore['getCampaignState'](campaignId);
    const holes: Array<{ threadId: string; issue: string }> = [];
    const inconsistencies: Array<{ threadId: string; issue: string }> = [];
    const dropped: Array<{ threadId: string; title: string }> = [];

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;

    for (const [threadId, thread] of campaignState.plotThreads) {
      // Check for abandoned threads
      if (thread.status === PlotStatus.ACTIVE) {
        const lastEvent = thread.keyEvents[thread.keyEvents.length - 1];
        // This would need actual timestamp checking from events
        // For now, just flag long-active threads with few events
        if (thread.keyEvents.length < 2 && thread.status === PlotStatus.ACTIVE) {
          dropped.push({ threadId, title: thread.title });
        }
      }

      // Check for unresolved cliffhangers
      if (thread.cliffhangers && thread.cliffhangers.length > 0) {
        if (thread.status === PlotStatus.RESOLVED) {
          // Check if cliffhangers were addressed
          holes.push({
            threadId,
            issue: `Resolved thread has ${thread.cliffhangers.length} unresolved cliffhanger(s)`,
          });
        }
      }

      // Check for contradictions in semantic memory
      // This would cross-reference with worldLore
    }

    return { holes, inconsistencies, dropped };
  }

  /**
   * Generate scene suggestions based on active plot threads
   */
  generateSceneSuggestions(
    campaignId: string,
    locationId?: string,
    presentCharacters?: string[]
  ): Array<{
    threadId: string;
    title: string;
    suggestion: string;
    relevance: number;
  }> {
    const activeThreads = campaignMemoryStore.getActivePlotThreads(campaignId);
    const suggestions: Array<{
      threadId: string;
      title: string;
      suggestion: string;
      relevance: number;
    }> = [];

    for (const thread of activeThreads) {
      let relevance = thread.importance;

      // Boost relevance if location is involved
      if (locationId && thread.relatedLocations.includes(locationId)) {
        relevance += 0.3;
      }

      // Boost relevance if present characters are involved
      if (presentCharacters) {
        const involvedPresent = presentCharacters.filter(c =>
          thread.involvedCharacters.includes(c)
        ).length;
        relevance += involvedPresent * 0.1;
      }

      suggestions.push({
        threadId: thread.id,
        title: thread.title,
        suggestion: this.generateSceneForThread(thread, locationId, presentCharacters),
        relevance: Math.min(1, relevance),
      });
    }

    return suggestions.sort((a, b) => b.relevance - a.relevance);
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private inferPlotType(thread: PlotThread): PlotType {
    const tags = thread.tags.map(t => t.toLowerCase());

    if (tags.includes('personal') || tags.includes('character')) return PlotType.PERSONAL;
    if (tags.includes('political') || tags.includes('faction')) return PlotType.POLITICAL;
    if (tags.includes('mystery') || tags.includes('investigation')) return PlotType.MYSTERY;
    if (tags.includes('combat') || tags.includes('war')) return PlotType.CONFLICT;
    if (tags.includes('romance') || tags.includes('relationship')) return PlotType.ROMANCE;
    if (tags.includes('tragedy') || tags.includes('loss')) return PlotType.TRAGEDY;
    if (tags.includes('triumph') || tags.includes('victory')) return PlotType.TRIUMPH;
    if (tags.includes('redemption') || tags.includes('forgiveness')) return PlotType.REDEMPTION;
    if (tags.includes('revenge') || tags.includes('vengeance')) return PlotType.REVENGE;
    if (tags.includes('discovery') || tags.includes('exploration')) return PlotType.DISCOVERY;

    return PlotType.PERSONAL; // Default
  }

  private findOverlap<T>(array1: T[], array2: T[]): T[] {
    return array1.filter(item => array2.includes(item));
  }

  private generateRevealScenarios(
    information: string,
    awareCharacters: string[],
    unawareCharacters: string[]
  ): string[] {
    return [
      `The truth is discovered by accident`,
      `A character breaks under pressure`,
      `Evidence comes to light`,
      `A confession is made`,
      `The secret is used as a weapon`,
      `Timing creates dramatic revelation`,
    ];
  }

  private generateSceneForThread(
    thread: PlotThread,
    locationId?: string,
    presentCharacters?: string[]
  ): string {
    const type = this.inferPlotType(thread);

    const sceneTemplates: Record<PlotType, string[]> = {
      [PlotType.PERSONAL]: [
        'A quiet moment for character reflection',
        'A confrontation with inner demons',
        'A test of character values',
      ],
      [PlotType.POLITICAL]: [
        'A tense negotiation',
        'Behind-the-scenes maneuvering',
        'A public display of power',
      ],
      [PlotType.MYSTERY]: [
        'A clue is discovered',
        'A witness comes forward',
        'A false lead creates confusion',
      ],
      [PlotType.CONFLICT]: [
        'Skirmish breaks out',
        'Tactical planning session',
        'The calm before the storm',
      ],
      [PlotType.ROMANCE]: [
        'A vulnerable conversation',
        'A grand gesture',
        'A moment of jealousy',
      ],
      [PlotType.TRAGEDY]: [
        'Warnings go unheeded',
        'Hope flickers then dies',
        'The point of no return',
      ],
      [PlotType.TRIUMPH]: [
        'Against all odds, success',
        'Recognition of achievement',
        'The team comes together',
      ],
      [PlotType.REDEMPTION]: [
        'An apology is offered',
        'Past wrongs are righted',
        'A chance to be better',
      ],
      [PlotType.REVENGE]: [
        'The plan is set in motion',
        'A step closer to vengeance',
        'The cost of revenge is revealed',
      ],
      [PlotType.DISCOVERY]: [
        'Something new is found',
        'The unknown becomes known',
        'A revelation changes understanding',
      ],
    };

    const templates = sceneTemplates[type] || sceneTemplates[PlotType.PERSONAL];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const plotThreadManager = new PlotThreadManager();
