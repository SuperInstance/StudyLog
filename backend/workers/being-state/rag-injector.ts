/**
 * RAG Injector Module
 *
 * Handles real-time data injection for AI agent context.
 * Converts game state into RAG-compatible context for agents.
 */

import type {
  BeingStateEnv,
  RAGInjection,
  RAGContext,
  GameStateSnapshot,
  GameEvent,
  PlayerState,
  EnvironmentContext,
  StrategicAnalysis,
  UnitInfo,
  ResourceInfo,
  ObjectiveInfo,
  ThreatAssessment,
  Opportunity,
  Recommendation,
  VisibilityMap,
  TerrainFeature,
} from './types';

// ============================================================================
// RAG Injection Manager Class
// ============================================================================

export class RAGInjector {
  private env: BeingStateEnv;
  private contextCache: Map<string, RAGContext> = new Map();
  private eventBuffer: Map<string, GameEvent[]> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Context Injection
  // ========================================================================

  /**
   * Create RAG injection for agent
   */
  async createInjection(
    sessionId: string,
    agentId: string | undefined,
    gameState: Partial<GameStateSnapshot>,
    maxEvents: number = 50
  ): Promise<RAGInjection> {
    // Build context from game state
    const context = await this.buildContext(sessionId, agentId, gameState, maxEvents);

    // Calculate relevance based on agent state
    const relevance = this.calculateRelevance(context, agentId);

    const injection: RAGInjection = {
      sessionId,
      agentId,
      context,
      relevance,
      timestamp: Date.now(),
    };

    // Cache the injection
    const cacheKey = this.getCacheKey(sessionId, agentId);
    this.contextCache.set(cacheKey, context);

    return injection;
  }

  /**
   * Build RAG context from game state
   */
  private async buildContext(
    sessionId: string,
    agentId: string | undefined,
    gameState: Partial<GameStateSnapshot>,
    maxEvents: number
  ): Promise<RAGContext> {
    // Get recent events
    const recentEvents = await this.getRecentEvents(sessionId, maxEvents);

    // Build player state
    const playerState = this.buildPlayerState(gameState);

    // Build environment context
    const environment = this.buildEnvironmentContext(gameState);

    // Generate strategic analysis
    const strategy = await this.generateStrategicAnalysis(
      sessionId,
      agentId,
      gameState,
      recentEvents
    );

    return {
      gameState: this.normalizeGameState(gameState),
      recentEvents,
      playerState,
      environment,
      strategy,
    };
  }

  /**
   * Normalize game state snapshot
   */
  private normalizeGameState(
    state: Partial<GameStateSnapshot>
  ): GameStateSnapshot {
    return {
      units: state.units ?? [],
      resources: state.resources ?? [],
      objectives: state.objectives ?? [],
      gameTime: state.gameTime ?? 0,
      flags: state.flags ?? {},
    };
  }

  /**
   * Build player state from game state
   */
  private buildPlayerState(gameState: Partial<GameStateSnapshot>): PlayerState {
    // Extract player-owned units and resources
    const playerUnits = (gameState.units ?? []).filter((u) => u.owner === 'player');

    return {
      id: 'player',
      resources: this.aggregateResources(gameState.resources ?? []),
      upgrades: [],
      currentObjectives: (gameState.objectives ?? [])
        .filter((o) => o.status === 'active')
        .map((o) => o.id),
      completedObjectives: (gameState.objectives ?? [])
        .filter((o) => o.status === 'completed')
        .map((o) => o.id),
    };
  }

  /**
   * Aggregate resources by type
   */
  private aggregateResources(resources: ResourceInfo[]): Record<string, number> {
    const aggregated: Record<string, number> = {};

    for (const resource of resources) {
      if (resource.owner === 'player') {
        aggregated[resource.type] = (aggregated[resource.type] ?? 0) + resource.amount;
      }
    }

    return aggregated;
  }

  /**
   * Build environment context
   */
  private buildEnvironmentContext(gameState: Partial<GameStateSnapshot>): EnvironmentContext {
    // Generate terrain features from unit positions
    const terrain: TerrainFeature[] = [];

    for (const unit of gameState.units ?? []) {
      terrain.push({
        type: 'unit_presence',
        position: unit.position,
        size: [1, 1, 1],
        properties: {
          unit_type: unit.type,
          unit_owner: unit.owner,
          unit_health: unit.health,
        },
      });
    }

    // Generate visibility map
    const visibility: VisibilityMap = {
      fog: this.generateFogOfWar(gameState),
      resolution: [50, 50],
      bounds: [[-100, -100], [100, 100]],
    };

    return {
      terrain,
      visibility,
      timeOfDay: (gameState.gameTime ?? 0) % 86400 / 86400,
      weather: 'clear',
    };
  }

  /**
   * Generate fog of war data
   */
  private generateFogOfWar(gameState: Partial<GameStateSnapshot>): number[][] {
    const resolution = 50;
    const fog: number[][] = [];

    // Initialize with hidden
    for (let y = 0; y < resolution; y++) {
      fog[y] = [];
      for (let x = 0; x < resolution; x++) {
        fog[y][x] = 0;
      }
    }

    // Reveal areas around player units
    const playerUnits = (gameState.units ?? []).filter((u) => u.owner === 'player');
    for (const unit of playerUnits) {
      const [ux, uy, _uz] = unit.position;
      const gridX = Math.floor((ux + 100) / 200 * resolution);
      const gridY = Math.floor((uy + 100) / 200 * resolution);
      const radius = 5;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const y = gridY + dy;
          const x = gridX + dx;
          if (y >= 0 && y < resolution && x >= 0 && x < resolution) {
            if (dx * dx + dy * dy <= radius * radius) {
              fog[y][x] = 1;
            }
          }
        }
      }
    }

    return fog;
  }

  // ========================================================================
  // Strategic Analysis Generation
  // ========================================================================

  /**
   * Generate strategic analysis for context
   */
  async generateStrategicAnalysis(
    sessionId: string,
    agentId: string | undefined,
    gameState: Partial<GameStateSnapshot>,
    recentEvents: GameEvent[]
  ): Promise<StrategicAnalysis> {
    // Analyze threats
    const threats = this.analyzeThreats(gameState, recentEvents);

    // Identify opportunities
    const opportunities = this.identifyOpportunities(gameState, recentEvents);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      threats,
      opportunities,
      gameState
    );

    // Calculate overall confidence
    const confidence = this.calculateAnalysisConfidence(
      threats,
      opportunities,
      recentEvents
    );

    return {
      threats,
      opportunities,
      recommendations,
      confidence,
    };
  }

  /**
   * Analyze threats in the game state
   */
  private analyzeThreats(
    gameState: Partial<GameStateSnapshot>,
    recentEvents: GameEvent[]
  ): ThreatAssessment[] {
    const threats: ThreatAssessment[] = [];

    // Find enemy units
    const enemies = (gameState.units ?? []).filter((u) => u.owner !== 'player');
    const playerUnits = (gameState.units ?? []).filter((u) => u.owner === 'player');

    for (const enemy of enemies) {
      // Calculate distance to nearest player unit
      let minDistance = Infinity;
      for (const player of playerUnits) {
        const dist = this.calculateDistance(enemy.position, player.position);
        minDistance = Math.min(minDistance, dist);
      }

      // Calculate threat level
      const healthRatio = enemy.health / enemy.maxHealth;
      const damage = enemy.damage ?? 10;
      const severity = Math.min(1, (damage / 100) * (1 - minDistance / 100) * healthRatio);

      if (severity > 0.3) {
        threats.push({
          source: enemy.id,
          type: enemy.type,
          severity,
          imminence: Math.min(1, 1 - minDistance / 50),
          countermeasures: this.suggestCountermeasures(enemy),
        });
      }
    }

    // Check recent combat events
    for (const event of recentEvents) {
      if (event.type === 'combat' && event.data) {
        const existing = threats.find((t) => t.source === event.source);
        if (!existing) {
          threats.push({
            source: event.source ?? 'unknown',
            type: 'combat',
            severity: 0.5,
            imminence: 1.0,
            countermeasures: ['defend', 'retreat', 'call_support'],
          });
        }
      }
    }

    return threats.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Suggest countermeasures for a threat
   */
  private suggestCountermeasures(enemy: UnitInfo): string[] {
    const measures: string[] = [];

    if (enemy.damage && enemy.damage > 50) {
      measures.push('focus_fire', 'use_cover');
    }

    if (enemy.health > 100) {
      measures.push('flank', 'coordinate');
    }

    const healthRatio = enemy.health / enemy.maxHealth;
    if (healthRatio > 0.7) {
      measures.push('sustained_damage');
    }

    if (measures.length === 0) {
      measures.push('engage', 'defend');
    }

    return measures;
  }

  /**
   * Identify opportunities in game state
   */
  private identifyOpportunities(
    gameState: Partial<GameStateSnapshot>,
    recentEvents: GameEvent[]
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // Resource opportunities
    const unclaimedResources = (gameState.resources ?? []).filter(
      (r) => !r.owner || r.owner === 'neutral'
    );

    for (const resource of unclaimedResources) {
      const playerUnits = (gameState.units ?? []).filter((u) => u.owner === 'player');
      let minDistance = Infinity;

      for (const unit of playerUnits) {
        const dist = this.calculateDistance(resource.position, unit.position);
        minDistance = Math.min(minDistance, dist);
      }

      const value = resource.amount / 100; // Normalize value
      const risk = this.calculateRiskAtPosition(resource.position, gameState);

      if (value > risk * 2) {
        opportunities.push({
          type: 'resource',
          position: resource.position,
          value,
          risk,
          actions: ['collect', 'secure', 'claim'],
        });
      }
    }

    // Objective opportunities
    const activeObjectives = (gameState.objectives ?? []).filter(
      (o) => o.status === 'active'
    );

    for (const objective of activeObjectives) {
      if (objective.position) {
        const progress = objective.progress ?? 0;
        opportunities.push({
          type: 'objective',
          position: objective.position,
          value: 1 - progress,
          risk: this.calculateRiskAtPosition(objective.position, gameState),
          actions: ['complete', 'prioritize'],
        });
      }
    }

    return opportunities.sort((a, b) => b.value - b.risk - (a.value - a.risk));
  }

  /**
   * Calculate risk at a position
   */
  private calculateRiskAtPosition(
    position: [number, number, number],
    gameState: Partial<GameStateSnapshot>
  ): number {
    let maxRisk = 0;

    const enemies = (gameState.units ?? []).filter((u) => u.owner !== 'player');
    for (const enemy of enemies) {
      const dist = this.calculateDistance(position, enemy.position);
      const risk = (enemy.damage ?? 10) / Math.max(1, dist);
      maxRisk = Math.max(maxRisk, risk);
    }

    return Math.min(1, maxRisk / 50);
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    threats: ThreatAssessment[],
    opportunities: Opportunity[],
    gameState: Partial<GameStateSnapshot>
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Threat-based recommendations
    for (const threat of threats.slice(0, 3)) {
      if (threat.imminence > 0.7) {
        recommendations.push({
          action: 'respond_to_threat',
          target: threat.source,
          priority: Math.floor(threat.severity * 10),
          reasoning: `Immediate threat: ${threat.type} with severity ${threat.severity.toFixed(2)}`,
          expectedOutcome: 'Threat neutralized or mitigated',
        });
      }
    }

    // Opportunity-based recommendations
    for (const opp of opportunities.slice(0, 3)) {
      if (opp.value > 0.5 && opp.risk < 0.3) {
        recommendations.push({
          action: opp.actions[0] || 'exploit',
          target: `${opp.type}_at_${opp.position.join(',')}`,
          priority: Math.floor(opp.value * 8),
          reasoning: `Low-risk opportunity: ${opp.type} with value ${opp.value.toFixed(2)}`,
          expectedOutcome: 'Resource or objective secured',
        });
      }
    }

    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate analysis confidence
   */
  private calculateAnalysisConfidence(
    threats: ThreatAssessment[],
    opportunities: Opportunity[],
    recentEvents: GameEvent[]
  ): number {
    let confidence = 0.5; // Base confidence

    // More events = higher confidence
    confidence += Math.min(0.3, recentEvents.length / 100);

    // Clear threats = higher confidence
    if (threats.length > 0) {
      confidence += 0.1;
    }

    // Clear opportunities = higher confidence
    if (opportunities.length > 0) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  // ========================================================================
  // Event Management
  // ========================================================================

  /**
   * Add game event to buffer
   */
  addEvent(sessionId: string, event: GameEvent): void {
    let buffer = this.eventBuffer.get(sessionId) ?? [];
    buffer.push(event);

    // Keep last 100 events
    if (buffer.length > 100) {
      buffer = buffer.slice(-100);
    }

    this.eventBuffer.set(sessionId, buffer);
  }

  /**
   * Get recent events for session
   */
  async getRecentEvents(
    sessionId: string,
    limit: number = 50
  ): Promise<GameEvent[]> {
    // Check buffer first
    const buffered = this.eventBuffer.get(sessionId) ?? [];

    // If database is available, get persisted events
    if (this.env.BEING_STATE_DB) {
      const result = await this.env.BEING_STATE_DB.prepare(`
        SELECT * FROM game_events
        WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).bind(sessionId, limit).all();

      const dbEvents = result.results.map((row: any) => ({
        id: row.id,
        type: row.event_type,
        timestamp: row.timestamp,
        source: row.source,
        target: row.target,
        data: JSON.parse(row.data),
      }));

      // Merge with buffered events
      const allEvents = [...dbEvents, ...buffered];
      return allEvents
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
    }

    return buffered.slice(-limit);
  }

  /**
   * Persist events to database
   */
  async persistEvents(sessionId: string): Promise<void> {
    if (!this.env.BEING_STATE_DB) {
      return;
    }

    const buffer = this.eventBuffer.get(sessionId) ?? [];
    if (buffer.length === 0) {
      return;
    }

    for (const event of buffer) {
      await this.env.BEING_STATE_DB.prepare(`
        INSERT INTO game_events (
          id, session_id, event_type, timestamp, source, target, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.id,
        sessionId,
        event.type,
        event.timestamp,
        event.source ?? null,
        event.target ?? null,
        JSON.stringify(event.data)
      ).run();
    }

    // Clear buffer after persisting
    this.eventBuffer.set(sessionId, []);
  }

  // ========================================================================
  // Relevance Calculation
  // ========================================================================

  /**
   * Calculate relevance of context for agent
   */
  private calculateRelevance(context: RAGContext, agentId: string | undefined): number {
    let relevance = 0.5; // Base relevance

    // More units in context = higher relevance
    relevance += Math.min(0.2, context.gameState.units.length / 50);

    // More threats = higher relevance
    if (context.strategy?.threats) {
      relevance += Math.min(0.2, context.strategy.threats.length / 10);
    }

    // More opportunities = higher relevance
    if (context.strategy?.opportunities) {
      relevance += Math.min(0.1, context.strategy.opportunities.length / 5);
    }

    return Math.min(1, relevance);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(
    pos1: [number, number, number],
    pos2: [number, number, number]
  ): number {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get cache key for session and agent
   */
  private getCacheKey(sessionId: string, agentId: string | undefined): string {
    return agentId ? `${sessionId}:${agentId}` : sessionId;
  }

  /**
   * Convert RAG context to formatted string for LLM
   */
  contextToString(context: RAGContext): string {
    const parts: string[] = [];

    parts.push('=== GAME STATE ===');
    parts.push(`Units: ${context.gameState.units.length}`);
    parts.push(`Resources: ${context.gameState.resources.length}`);
    parts.push(`Objectives: ${context.gameState.objectives.length}`);
    parts.push(`Game Time: ${context.gameState.gameTime}`);

    parts.push('\n=== RECENT EVENTS ===');
    for (const event of context.recentEvents.slice(0, 10)) {
      parts.push(`- ${event.type}: ${JSON.stringify(event.data)}`);
    }

    parts.push('\n=== PLAYER STATE ===');
    parts.push(`Resources: ${JSON.stringify(context.playerState.resources)}`);
    parts.push(`Active Objectives: ${context.playerState.currentObjectives.length}`);

    if (context.strategy) {
      parts.push('\n=== STRATEGIC ANALYSIS ===');
      parts.push(`Threats: ${context.strategy.threats.length}`);
      for (const threat of context.strategy.threats.slice(0, 3)) {
        parts.push(`- ${threat.type}: severity ${threat.severity.toFixed(2)}`);
      }
      parts.push(`Opportunities: ${context.strategy.opportunities.length}`);
      for (const opp of context.strategy.opportunities.slice(0, 3)) {
        parts.push(`- ${opp.type}: value ${opp.value.toFixed(2)}`);
      }
      parts.push(`Confidence: ${context.strategy.confidence.toFixed(2)}`);
    }

    return parts.join('\n');
  }

  /**
   * Clear cached context
   */
  clearCache(sessionId: string, agentId?: string): void {
    const cacheKey = this.getCacheKey(sessionId, agentId);
    this.contextCache.delete(cacheKey);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.contextCache.clear();
    this.eventBuffer.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createRAGInjector(env: BeingStateEnv): RAGInjector {
  return new RAGInjector(env);
}
