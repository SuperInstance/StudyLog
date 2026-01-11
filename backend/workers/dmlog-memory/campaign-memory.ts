/**
 * DMLoG.AI - Campaign Memory System
 *
 * Manages shared world state across all characters, including:
 * - Location memories and discovery
 * - Plot threads and their resolution
 * - Faction relationships and politics
 * - Timeline tracking
 * - Session summaries
 */

import {
  CampaignMemoryState,
  LocationMemory,
  PlotThread,
  PlotStatus,
  FactionState,
  FactionRelationship,
  TimelineEvent,
  SessionSummary,
  SemanticMemory,
  SerializedCampaignMemory,
} from './types.js';

// ============================================================================
// CAMPAIGN MEMORY STORE
// ============================================================================

export class CampaignMemoryStore {
  private campaigns: Map<string, CampaignMemoryState> = new Map();

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize a new campaign memory
   */
  initializeCampaign(campaignId: string, name: string = ''): CampaignMemoryState {
    const state: CampaignMemoryState = {
      campaignId,
      worldState: new Map([
        ['name', name],
        ['created_at', Date.now()],
        ['session_count', 0],
      ]),
      locations: new Map(),
      plotThreads: new Map(),
      factions: new Map(),
      timeline: [],
      sessionHistory: [],
      worldLore: new Map(),
    };

    this.campaigns.set(campaignId, state);
    return state;
  }

  // ========================================================================
  // LOCATION MANAGEMENT
  // ========================================================================

  /**
   * Add or update a location
   */
  addLocation(campaignId: string, location: Omit<LocationMemory, 'discoveredAt' | 'visitCount' | 'events'>): LocationMemory {
    const state = this.getCampaignState(campaignId);

    const existing = state.locations.get(location.id);

    if (existing) {
      // Update existing location
      existing.lastVisited = Date.now();
      existing.visitCount++;
      if (location.currentState) {
        existing.currentState = new Map([...existing.currentState, ...location.currentState]);
      }
      return existing;
    }

    // Create new location
    const newLocation: LocationMemory = {
      ...location,
      discoveredAt: Date.now(),
      lastVisited: Date.now(),
      visitCount: 1,
      events: [],
      characters: [],
      secrets: location.secrets || [],
      currentState: location.currentState || new Map(),
    };

    state.locations.set(location.id, newLocation);
    return newLocation;
  }

  /**
   * Visit a location
   */
  visitLocation(campaignId: string, locationId: string, characterIds: string[]): void {
    const state = this.getCampaignState(campaignId);
    const location = state.locations.get(locationId);

    if (!location) {
      throw new Error(`Location ${locationId} not found in campaign ${campaignId}`);
    }

    location.lastVisited = Date.now();
    location.visitCount++;

    // Track characters who have been here
    for (const charId of characterIds) {
      if (!location.characters.includes(charId)) {
        location.characters.push(charId);
      }
    }
  }

  /**
   * Add an event to a location
   */
  addLocationEvent(campaignId: string, locationId: string, memoryId: string): void {
    const state = this.getCampaignState(campaignId);
    const location = state.locations.get(locationId);

    if (location) {
      location.events.push(memoryId);
    }
  }

  /**
   * Discover a secret at a location
   */
  discoverSecret(campaignId: string, locationId: string, secret: string): void {
    const state = this.getCampaignState(campaignId);
    const location = state.locations.get(locationId);

    if (location && location.secrets) {
      if (!location.secrets.includes(secret)) {
        location.secrets.push(secret);
      }
    }
  }

  /**
   * Get location info
   */
  getLocation(campaignId: string, locationId: string): LocationMemory | null {
    const state = this.campaigns.get(campaignId);
    return state?.locations.get(locationId) || null;
  }

  /**
   * Get all locations
   */
  getAllLocations(campaignId: string): LocationMemory[] {
    const state = this.getCampaignState(campaignId);
    return Array.from(state.locations.values());
  }

  /**
   * Get undiscovered locations (by a character)
   */
  getUndiscoveredLocations(campaignId: string, characterId: string): LocationMemory[] {
    const state = this.getCampaignState(campaignId);
    return Array.from(state.locations.values()).filter(
      loc => !loc.characters.includes(characterId)
    );
  }

  // ========================================================================
  // PLOT THREAD MANAGEMENT
  // ========================================================================

  /**
   * Create a new plot thread
   */
  createPlotThread(
    campaignId: string,
    thread: Omit<PlotThread, 'id' | 'status'>
  ): PlotThread {
    const state = this.getCampaignState(campaignId);

    const plotThread: PlotThread = {
      ...thread,
      id: `plot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: PlotStatus.DORMANT,
    };

    state.plotThreads.set(plotThread.id, plotThread);
    return plotThread;
  }

  /**
   * Update plot thread status
   */
  updatePlotThreadStatus(
    campaignId: string,
    threadId: string,
    status: PlotStatus
  ): void {
    const state = this.getCampaignState(campaignId);
    const thread = state.plotThreads.get(threadId);

    if (thread) {
      thread.status = status;
    }
  }

  /**
   * Add progress to a plot thread
   */
  advancePlotThread(
    campaignId: string,
    threadId: string,
    eventMemoryId: string,
    progressNote?: string
  ): void {
    const state = this.getCampaignState(campaignId);
    const thread = state.plotThreads.get(threadId);

    if (thread) {
      thread.keyEvents.push(eventMemoryId);

      // Activate dormant threads when events occur
      if (thread.status === PlotStatus.DORMANT) {
        thread.status = PlotStatus.ACTIVE;
      }

      // Add to timeline
      this.addTimelineEvent(campaignId, {
        description: progressNote || `Progress in plot: ${thread.title}`,
        impact: thread.importance * 0.5,
        plotThreadIds: [threadId],
      } as Omit<TimelineEvent, 'id' | 'timestamp' | 'sessionId'>);
    }
  }

  /**
   * Resolve a plot thread
   */
  resolvePlotThread(
    campaignId: string,
    threadId: string,
    resolutionMemoryId: string,
    satisfaction: number
  ): void {
    const state = this.getCampaignState(campaignId);
    const thread = state.plotThreads.get(threadId);

    if (thread) {
      thread.status = PlotStatus.RESOLVED;
      thread.resolution = {
        memoryId: resolutionMemoryId,
        satisfaction,
      };
      thread.keyEvents.push(resolutionMemoryId);

      this.addTimelineEvent(campaignId, {
        description: `Plot resolved: ${thread.title}`,
        impact: thread.importance,
        plotThreadIds: [threadId],
      } as Omit<TimelineEvent, 'id' | 'timestamp' | 'sessionId'>);
    }
  }

  /**
   * Add cliffhanger to plot thread
   */
  addCliffhanger(campaignId: string, threadId: string, cliffhanger: string): void {
    const state = this.getCampaignState(campaignId);
    const thread = state.plotThreads.get(threadId);

    if (thread) {
      if (!thread.cliffhangers) {
        thread.cliffhangers = [];
      }
      thread.cliffhangers.push(cliffhanger);
    }
  }

  /**
   * Get active plot threads
   */
  getActivePlotThreads(campaignId: string): PlotThread[] {
    const state = this.getCampaignState(campaignId);
    return Array.from(state.plotThreads.values())
      .filter(t => t.status === PlotStatus.ACTIVE)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Get plot threads for a character
   */
  getCharacterPlotThreads(campaignId: string, characterId: string): PlotThread[] {
    const state = this.getCampaignState(campaignId);
    return Array.from(state.plotThreads.values())
      .filter(t => t.involvedCharacters.includes(characterId));
  }

  /**
   * Get plot threads by tag
   */
  getPlotThreadsByTag(campaignId: string, tag: string): PlotThread[] {
    const state = this.getCampaignState(campaignId);
    return Array.from(state.plotThreads.values())
      .filter(t => t.tags.includes(tag));
  }

  // ========================================================================
  // FACTION MANAGEMENT
  // ========================================================================

  /**
   * Add or update a faction
   */
  addFaction(campaignId: string, faction: Omit<FactionState, 'lastUpdate'>): FactionState {
    const state = this.getCampaignState(campaignId);

    const newFaction: FactionState = {
      ...faction,
      lastUpdate: Date.now(),
    };

    state.factions.set(newFaction.id, newFaction);
    return newFaction;
  }

  /**
   * Update faction power
   */
  updateFactionPower(campaignId: string, factionId: string, delta: number): void {
    const state = this.getCampaignState(campaignId);
    const faction = state.factions.get(factionId);

    if (faction) {
      faction.power = Math.max(0, Math.min(1, faction.power + delta));
      faction.lastUpdate = Date.now();
    }
  }

  /**
   * Set faction influence in a location
   */
  setFactionInfluence(
    campaignId: string,
    factionId: string,
    locationId: string,
    influence: number
  ): void {
    const state = this.getCampaignState(campaignId);
    const faction = state.factions.get(factionId);

    if (faction) {
      faction.influence.set(locationId, influence);
      faction.lastUpdate = Date.now();
    }
  }

  /**
   * Update faction relationship
   */
  updateFactionRelationship(
    campaignId: string,
    factionId: string,
    targetFactionId: string,
    relation: FactionRelationship['relation'],
    tension?: number
  ): void {
    const state = this.getCampaignState(campaignId);
    const faction = state.factions.get(factionId);

    if (faction) {
      const existing = faction.relationships.get(targetFactionId);

      if (existing) {
        existing.relation = relation;
        if (tension !== undefined) {
          existing.tension = tension;
        }
      } else {
        faction.relationships.set(targetFactionId, {
          factionId: targetFactionId,
          relation,
          tension: tension || 0,
          treaties: [],
          grievances: [],
        });
      }

      faction.lastUpdate = Date.now();

      // Update reciprocal relationship
      const targetFaction = state.factions.get(targetFactionId);
      if (targetFaction) {
        const reciprocalRelation = this.getReciprocalRelation(relation);
        const reciprocal = targetFaction.relationships.get(factionId);

        if (reciprocal) {
          reciprocal.relation = reciprocalRelation;
          if (tension !== undefined) {
            reciprocal.tension = tension;
          }
        } else {
          targetFaction.relationships.set(factionId, {
            factionId,
            relation: reciprocalRelation,
            tension: tension || 0,
            treaties: [],
            grievances: [],
          });
        }

        targetFaction.lastUpdate = Date.now();
      }
    }
  }

  /**
   * Add faction resource
   */
  addFactionResource(
    campaignId: string,
    factionId: string,
    resourceType: string,
    amount: number
  ): void {
    const state = this.getCampaignState(campaignId);
    const faction = state.factions.get(factionId);

    if (faction) {
      const current = faction.resources.get(resourceType) || 0;
      faction.resources.set(resourceType, current + amount);
      faction.lastUpdate = Date.now();
    }
  }

  /**
   * Get faction
   */
  getFaction(campaignId: string, factionId: string): FactionState | null {
    const state = this.campaigns.get(campaignId);
    return state?.factions.get(factionId) || null;
  }

  /**
   * Get all factions
   */
  getAllFactions(campaignId: string): FactionState[] {
    const state = this.getCampaignState(campaignId);
    return Array.from(state.factions.values());
  }

  /**
   * Get factions by influence at location
   */
  getFactionsAtLocation(campaignId: string, locationId: string): Array<{
    faction: FactionState;
    influence: number;
  }> {
    const state = this.getCampaignState(campaignId);
    const result: Array<{ faction: FactionState; influence: number }> = [];

    for (const faction of state.factions.values()) {
      const influence = faction.influence.get(locationId);
      if (influence && influence > 0) {
        result.push({ faction, influence });
      }
    }

    return result.sort((a, b) => b.influence - a.influence);
  }

  // ========================================================================
  // TIMELINE MANAGEMENT
  // ========================================================================

  /**
   * Add a timeline event
   */
  addTimelineEvent(
    campaignId: string,
    event: Omit<TimelineEvent, 'id' | 'timestamp'>
  ): TimelineEvent {
    const state = this.getCampaignState(campaignId);

    const timelineEvent: TimelineEvent = {
      ...event,
      id: `timeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    state.timeline.push(timelineEvent);
    return timelineEvent;
  }

  /**
   * Get timeline events
   */
  getTimelineEvents(
    campaignId: string,
    options?: {
      sessionId?: string;
      plotThreadIds?: string[];
      characterIds?: string[];
      limit?: number;
    }
  ): TimelineEvent[] {
    const state = this.getCampaignState(campaignId);
    let events = state.timeline;

    if (options) {
      if (options.sessionId) {
        events = events.filter(e => e.sessionId === options.sessionId);
      }
      if (options.plotThreadIds && options.plotThreadIds.length > 0) {
        events = events.filter(e =>
          e.plotThreadIds.some(ptId => options.plotThreadIds!.includes(ptId))
        );
      }
      if (options.characterIds && options.characterIds.length > 0) {
        events = events.filter(e =>
          e.involvedCharacters.some(cId => options.characterIds!.includes(cId))
        );
      }
    }

    events = events.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  // ========================================================================
  // SESSION MANAGEMENT
  // ========================================================================

  /**
   * Start a new session
   */
  startSession(campaignId: string, sessionId: string, participants: string[]): void {
    const state = this.getCampaignState(campaignId);

    const summary: SessionSummary = {
      sessionId,
      startTime: Date.now(),
      endTime: 0,
      participants,
      locations: [],
      majorEvents: [],
      plotProgress: new Map(),
    };

    state.sessionHistory.push(summary);

    // Update session count
    const count = state.worldState.get('session_count') as number || 0;
    state.worldState.set('session_count', count + 1);
  }

  /**
   * End a session
   */
  endSession(
    campaignId: string,
    sessionId: string,
    cliffhangers?: string[],
    nextSessionHooks?: string[]
  ): void {
    const state = this.getCampaignState(campaignId);
    const summary = state.sessionHistory.find(s => s.sessionId === sessionId);

    if (summary) {
      summary.endTime = Date.now();
      summary.cliffhangers = cliffhangers;
      summary.nextSessionHooks = nextSessionHooks;
    }
  }

  /**
   * Add major event to session
   */
  addSessionEvent(campaignId: string, sessionId: string, memoryId: string): void {
    const state = this.getCampaignState(campaignId);
    const summary = state.sessionHistory.find(s => s.sessionId === sessionId);

    if (summary) {
      summary.majorEvents.push(memoryId);
    }
  }

  /**
   * Track location visited in session
   */
  trackSessionLocation(campaignId: string, sessionId: string, locationId: string): void {
    const state = this.getCampaignState(campaignId);
    const summary = state.sessionHistory.find(s => s.sessionId === sessionId);

    if (summary && !summary.locations.includes(locationId)) {
      summary.locations.push(locationId);
    }
  }

  /**
   * Track plot progress in session
   */
  trackPlotProgress(
    campaignId: string,
    sessionId: string,
    plotThreadId: string,
    note: string
  ): void {
    const state = this.getCampaignState(campaignId);
    const summary = state.sessionHistory.find(s => s.sessionId === sessionId);

    if (summary) {
      summary.plotProgress.set(plotThreadId, note);
    }
  }

  /**
   * Get session summary
   */
  getSessionSummary(campaignId: string, sessionId: string): SessionSummary | null {
    const state = this.campaigns.get(campaignId);
    return state?.sessionHistory.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(campaignId: string, limit: number = 5): SessionSummary[] {
    const state = this.getCampaignState(campaignId);
    return state.sessionHistory
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  // ========================================================================
  // WORLD LORE
  // ========================================================================

  /**
   * Add world lore (semantic fact about the world)
   */
  addWorldLore(campaignId: string, lore: Omit<SemanticMemory, 'id' | 'tier' | 'timestamp'>): SemanticMemory {
    const state = this.getCampaignState(campaignId);

    const loreMemory: SemanticMemory = {
      ...lore,
      id: `lore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tier: 'semantic' as any,
      timestamp: Date.now(),
      retrievalCount: 0,
      lastAccessed: Date.now(),
    };

    state.worldLore.set(loreMemory.id, loreMemory);
    return loreMemory;
  }

  /**
   * Query world lore
   */
  queryWorldLore(
    campaignId: string,
    query: {
      tags?: string[];
      type?: string;
      limit?: number;
    }
  ): SemanticMemory[] {
    const state = this.getCampaignState(campaignId);
    let results = Array.from(state.worldLore.values());

    if (query.tags && query.tags.length > 0) {
      results = results.filter(lore =>
        query.tags!.some(tag => lore.tags.includes(tag))
      );
    }

    if (query.type) {
      results = results.filter(lore => lore.type === query.type);
    }

    results = results.sort((a, b) => b.importance - a.importance);

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  // ========================================================================
  // WORLD STATE
  // ========================================================================

  /**
   * Get world state value
   */
  getWorldState(campaignId: string, key: string): any {
    const state = this.campaigns.get(campaignId);
    return state?.worldState.get(key);
  }

  /**
   * Set world state value
   */
  setWorldState(campaignId: string, key: string, value: any): void {
    const state = this.getCampaignState(campaignId);
    state.worldState.set(key, value);
  }

  /**
   * Get all world state
   */
  getAllWorldState(campaignId: string): Map<string, any> {
    const state = this.getCampaignState(campaignId);
    return state.worldState;
  }

  // ========================================================================
  // SERIALIZATION
  // ========================================================================

  /**
   * Serialize campaign state
   */
  serialize(campaignId: string): SerializedCampaignMemory | null {
    const state = this.campaigns.get(campaignId);
    if (!state) return null;

    return {
      campaignId: state.campaignId,
      worldState: Object.fromEntries(state.worldState),
      locations: Object.fromEntries(state.locations),
      plotThreads: Object.fromEntries(state.plotThreads),
      factions: Object.fromEntries(state.factions),
      timeline: state.timeline,
      sessionHistory: state.sessionHistory,
      worldLore: Array.from(state.worldLore.values()),
    };
  }

  /**
   * Deserialize campaign state
   */
  deserialize(data: SerializedCampaignMemory): CampaignMemoryState {
    const state: CampaignMemoryState = {
      campaignId: data.campaignId,
      worldState: new Map(Object.entries(data.worldState)),
      locations: new Map(Object.entries(data.locations)),
      plotThreads: new Map(Object.entries(data.plotThreads)),
      factions: new Map(Object.entries(data.factions)),
      timeline: data.timeline,
      sessionHistory: data.sessionHistory,
      worldLore: new Map(data.worldLore.map(l => [l.id, l])),
    };

    this.campaigns.set(data.campaignId, state);
    return state;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getCampaignState(campaignId: string): CampaignMemoryState {
    const state = this.campaigns.get(campaignId);
    if (!state) {
      throw new Error(`Campaign ${campaignId} not found in memory store`);
    }
    return state;
  }

  private getReciprocalRelation(relation: FactionRelationship['relation']): FactionRelationship['relation'] {
    switch (relation) {
      case 'allied':
        return 'allied';
      case 'friendly':
        return 'friendly';
      case 'neutral':
        return 'neutral';
      case 'hostile':
        return 'hostile';
      case 'at_war':
        return 'at_war';
      default:
        return 'neutral';
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const campaignMemoryStore = new CampaignMemoryStore();
