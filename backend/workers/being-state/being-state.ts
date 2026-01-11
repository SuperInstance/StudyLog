/**
 * Being State Manager
 *
 * Core state management system for multi-layered being states.
 * Handles state transitions, persistence, and coordinates across
 * visual, audio, gameplay, and agent layers.
 */

import type {
  BeingState,
  BeingStateEnv,
  StateTransitionRequest,
  StateTransitionResponse,
  StateChanges,
  StateEffects,
  VisualState,
  AudioState,
  GameplayState,
  AgentState,
  BeingStateCostEntry,
  APIResponse,
  APIError,
} from './types';
import {
  isValidVisualState,
  isValidAudioState,
  isValidGameplayState,
  isValidAgentState,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_STATE_INTENSITY = 0.5;
const MAX_STATE_INTENSITY = 1.0;
const MIN_STATE_INTENSITY = 0.1;

// State transition validity matrix
// Rows are "from" states, columns are "to" states
// true = valid direct transition, false = requires intermediate state
const VALID_TRANSITIONS: Record<string, string[]> = {
  // Visual state transitions
  ethereal: ['mechanical', 'organic', 'radiant', 'void', 'crystalline'],
  mechanical: ['organic', 'cyber', 'elemental', 'ancient'],
  organic: ['ethereal', 'crystalline', 'void', 'elemental'],
  crystalline: ['ethereal', 'radiant', 'shadow'],
  shadow: ['void', 'ethereal', 'ancient'],
  radiant: ['ethereal', 'crystalline', 'elemental'],
  void: ['shadow', 'ethereal', 'ancient'],
  elemental: ['organic', 'radiant', 'mechanical'],
  cyber: ['mechanical', 'void', 'digital'],
  ancient: ['void', 'shadow', 'crystalline'],
};

// ============================================================================
// Being State Manager Class
// ============================================================================

export class BeingStateManager {
  private env: BeingStateEnv;
  private cache: Map<string, BeingState> = new Map();
  private transitionHistory: Map<string, BeingState[]> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // State Retrieval
  // ========================================================================

  /**
   * Get current being state for a session
   */
  async getState(sessionId: string): Promise<BeingState | null> {
    // Check cache first
    const cached = this.cache.get(sessionId);
    if (cached && !this.isStateExpired(cached)) {
      return cached;
    }

    // Check KV cache
    if (this.env.BEING_STATE_CACHE) {
      const kvCached = await this.env.BEING_STATE_CACHE.get(
        `state:${sessionId}`,
        'json'
      ) as BeingState | null;
      if (kvCached && !this.isStateExpired(kvCached)) {
        this.cache.set(sessionId, kvCached);
        return kvCached;
      }
    }

    // Query database
    if (this.env.BEING_STATE_DB) {
      const result = await this.env.BEING_STATE_DB.prepare(`
        SELECT * FROM being_states
        WHERE session_id = ?
        AND (expires_at IS NULL OR expires_at > ?)
        ORDER BY updated_at DESC
        LIMIT 1
      `).bind(sessionId, Date.now()).first();

      if (result) {
        const state = this.dbRowToState(result);
        this.cache.set(sessionId, state);
        return state;
      }
    }

    return null;
  }

  /**
   * Get multiple states by session IDs
   */
  async getStates(sessionIds: string[]): Promise<Map<string, BeingState>> {
    const results = new Map<string, BeingState>();

    await Promise.all(
      sessionIds.map(async (sessionId) => {
        const state = await this.getState(sessionId);
        if (state) {
          results.set(sessionId, state);
        }
      })
    );

    return results;
  }

  // ========================================================================
  // State Creation
  // ========================================================================

  /**
   * Create initial being state for a session
   */
  async createInitialState(
    sessionId: string,
    overrides?: Partial<BeingState>
  ): Promise<BeingState> {
    const now = Date.now();

    const state: BeingState = {
      id: crypto.randomUUID(),
      sessionId,
      visual: overrides?.visual || 'ethereal',
      audio: overrides?.audio || 'serene',
      gameplay: overrides?.gameplay || 'exploration',
      agent: overrides?.agent || 'directed',
      intensity: overrides?.intensity ?? DEFAULT_STATE_INTENSITY,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };

    await this.persistState(state);
    this.cache.set(sessionId, state);

    return state;
  }

  // ========================================================================
  // State Transitions
  // ========================================================================

  /**
   * Transition being state based on request
   */
  async transition(request: StateTransitionRequest): Promise<StateTransitionResponse> {
    const startTime = Date.now();

    // Get current state
    const currentState = await this.getState(request.sessionId);
    const now = Date.now();

    // Determine new state values
    const newVisual = request.visual ?? currentState?.visual ?? 'ethereal';
    const newAudio = request.audio ?? currentState?.audio ?? 'serene';
    const newGameplay = request.gameplay ?? currentState?.gameplay ?? 'exploration';
    const newAgent = request.agent ?? currentState?.agent ?? 'directed';
    const newIntensity = request.intensity ?? currentState?.intensity ?? DEFAULT_STATE_INTENSITY;

    // Validate states
    this.validateTransition(currentState, {
      visual: newVisual,
      audio: newAudio,
      gameplay: newGameplay,
      agent: newAgent,
    });

    // Calculate expiration for temporary states
    let expiresAt: number | undefined;
    if (request.duration && request.duration > 0) {
      expiresAt = now + request.duration;
    }

    // Create new state
    const newState: BeingState = {
      id: crypto.randomUUID(),
      sessionId: request.sessionId,
      visual: newVisual,
      audio: newAudio,
      gameplay: newGameplay,
      agent: newAgent,
      intensity: Math.max(MIN_STATE_INTENSITY, Math.min(MAX_STATE_INTENSITY, newIntensity)),
      previousState: currentState ? {
        visual: currentState.visual,
        audio: currentState.audio,
        gameplay: currentState.gameplay,
        agent: currentState.agent,
        intensity: currentState.intensity,
      } : undefined,
      transitionReason: request.reason,
      createdAt: currentState?.createdAt ?? now,
      updatedAt: now,
      expiresAt,
    };

    // Calculate changes
    const changes: StateChanges = {
      visual: {
        from: currentState?.visual,
        to: newVisual,
      },
      audio: {
        from: currentState?.audio,
        to: newAudio,
      },
      gameplay: {
        from: currentState?.gameplay,
        to: newGameplay,
      },
      agent: {
        from: currentState?.agent,
        to: newAgent,
      },
      intensity: {
        from: currentState?.intensity ?? DEFAULT_STATE_INTENSITY,
        to: newIntensity,
      },
    };

    // Generate effects (will be populated by specialized modules)
    const effects: StateEffects = {
      visualEffects: [],
      audioModifications: [],
      gameplayMutations: [],
      agentUpdates: [],
      godotCommands: [],
    };

    // Persist new state
    await this.persistState(newState);
    this.cache.set(request.sessionId, newState);

    // Record transition in history
    await this.recordTransition(request.sessionId, newState);

    // Calculate cost
    const cost = this.calculateTransitionCost(changes);

    return {
      success: true,
      state: newState,
      changes,
      effects,
      cost,
    };
  }

  /**
   * Batch transition multiple sessions
   */
  async batchTransition(
    requests: StateTransitionRequest[]
  ): Promise<StateTransitionResponse[]> {
    const results = await Promise.all(
      requests.map((req) => this.transition(req))
    );
    return results;
  }

  // ========================================================================
  // State Transition Validation
  // ========================================================================

  /**
   * Validate state transition is allowed
   */
  private validateTransition(
    current: BeingState | null,
    next: Partial<Record<'visual' | 'audio' | 'gameplay' | 'agent', string>>
  ): void {
    // Validate types
    if (next.visual && !isValidVisualState(next.visual)) {
      throw new Error(`Invalid visual state: ${next.visual}`);
    }
    if (next.audio && !isValidAudioState(next.audio)) {
      throw new Error(`Invalid audio state: ${next.audio}`);
    }
    if (next.gameplay && !isValidGameplayState(next.gameplay)) {
      throw new Error(`Invalid gameplay state: ${next.gameplay}`);
    }
    if (next.agent && !isValidAgentState(next.agent)) {
      throw new Error(`Invalid agent state: ${next.agent}`);
    }

    // For visual state, check if transition is valid
    if (current && next.visual && next.visual !== current.visual) {
      const validFrom = VALID_TRANSITIONS[current.visual];
      if (validFrom && !validFrom.includes(next.visual)) {
        // Direct transition not allowed, but we'll allow it with a warning
        // In production, might require intermediate state
        console.warn(
          `[BeingState] Direct transition from ${current.visual} to ${next.visual} ` +
          `may be jarring. Consider intermediate state.`
        );
      }
    }

    // Check if agent state transition makes sense
    if (current && next.agent) {
      // Dormant agents can't become autonomous immediately
      if (current.agent === 'dormant' && next.agent === 'autonomous') {
        throw new Error(
          'Cannot transition from dormant to autonomous directly. ' +
          'Use directed or symbiotic as intermediate state.'
        );
      }

      // Transcendent state requires specific conditions
      if (next.agent === 'transcendent' && current.agent !== 'learning') {
        throw new Error(
          'Transcendent agent state requires learning state as prerequisite.'
        );
      }
    }
  }

  // ========================================================================
  // State Persistence
  // ========================================================================

  /**
   * Persist state to database and cache
   */
  private async persistState(state: BeingState): Promise<void> {
    // Persist to KV cache
    if (this.env.BEING_STATE_CACHE) {
      const ttl = state.expiresAt
        ? Math.floor((state.expiresAt - Date.now()) / 1000)
        : 3600; // 1 hour default

      await this.env.BEING_STATE_CACHE.put(
        `state:${state.sessionId}`,
        JSON.stringify(state),
        { expirationTtl: ttl }
      );
    }

    // Persist to database
    if (this.env.BEING_STATE_DB) {
      await this.env.BEING_STATE_DB.prepare(`
        INSERT INTO being_states (
          id, session_id, visual, audio, gameplay, agent,
          intensity, previous_state, transition_reason,
          created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        state.id,
        state.sessionId,
        state.visual,
        state.audio,
        state.gameplay,
        state.agent,
        state.intensity,
        JSON.stringify(state.previousState),
        state.transitionReason,
        state.createdAt,
        state.updatedAt,
        state.expiresAt ?? null
      ).run();
    }
  }

  /**
   * Check if state has expired
   */
  private isStateExpired(state: BeingState): boolean {
    return state.expiresAt !== undefined && state.expiresAt < Date.now();
  }

  // ========================================================================
  // Transition History
  // ========================================================================

  /**
   * Record state transition in history
   */
  private async recordTransition(sessionId: string, state: BeingState): Promise<void> {
    let history = this.transitionHistory.get(sessionId) ?? [];
    history.push(state);

    // Keep only last 50 transitions
    if (history.length > 50) {
      history = history.slice(-50);
    }

    this.transitionHistory.set(sessionId, history);
  }

  /**
   * Get transition history for session
   */
  async getHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<BeingState[]> {
    // Check in-memory history
    const memoryHistory = this.transitionHistory.get(sessionId);
    if (memoryHistory && memoryHistory.length > 0) {
      return memoryHistory.slice(-limit);
    }

    // Query database
    if (this.env.BEING_STATE_DB) {
      const result = await this.env.BEING_STATE_DB.prepare(`
        SELECT * FROM being_states
        WHERE session_id = ?
        ORDER BY updated_at DESC
        LIMIT ?
      `).bind(sessionId, limit).all();

      return result.results.map((row) => this.dbRowToState(row));
    }

    return [];
  }

  // ========================================================================
  // State Queries
  // ========================================================================

  /**
   * Find sessions with specific state combination
   */
  async findSessionsByState(filters: {
    visual?: VisualState;
    audio?: AudioState;
    gameplay?: GameplayState;
    agent?: AgentState;
    minIntensity?: number;
  }): Promise<string[]> {
    const conditions: string[] = [];
    const bindings: unknown[] = [];

    if (filters.visual) {
      conditions.push('visual = ?');
      bindings.push(filters.visual);
    }
    if (filters.audio) {
      conditions.push('audio = ?');
      bindings.push(filters.audio);
    }
    if (filters.gameplay) {
      conditions.push('gameplay = ?');
      bindings.push(filters.gameplay);
    }
    if (filters.agent) {
      conditions.push('agent = ?');
      bindings.push(filters.agent);
    }
    if (filters.minIntensity !== undefined) {
      conditions.push('intensity >= ?');
      bindings.push(filters.minIntensity);
    }

    // Only active states
    conditions.push('(expires_at IS NULL OR expires_at > ?)');
    bindings.push(Date.now());

    const whereClause = conditions.join(' AND ');

    if (this.env.BEING_STATE_DB) {
      const result = await this.env.BEING_STATE_DB.prepare(`
        SELECT DISTINCT session_id FROM being_states
        WHERE ${whereClause}
      `).bind(...bindings).all();

      return result.results.map((row: any) => row.session_id);
    }

    return [];
  }

  /**
   * Get state statistics
   */
  async getStatistics(): Promise<{
    totalSessions: number;
    stateDistribution: Record<string, number>;
    averageIntensity: number;
    mostCommonStates: string[];
  }> {
    if (!this.env.BEING_STATE_DB) {
      return {
        totalSessions: 0,
        stateDistribution: {},
        averageIntensity: 0,
        mostCommonStates: [],
      };
    }

    // Get total active sessions
    const totalResult = await this.env.BEING_STATE_DB.prepare(`
      SELECT COUNT(DISTINCT session_id) as count FROM being_states
      WHERE expires_at IS NULL OR expires_at > ?
    `).bind(Date.now()).first();

    const totalSessions = (totalResult?.count as number) ?? 0;

    // Get state distribution
    const distResult = await this.env.BEING_STATE_DB.prepare(`
      SELECT visual || '-' || audio || '-' || gameplay || '-' || agent as state_combo,
             COUNT(*) as count
      FROM being_states
      WHERE expires_at IS NULL OR expires_at > ?
      GROUP BY state_combo
      ORDER BY count DESC
    `).bind(Date.now()).all();

    const stateDistribution: Record<string, number> = {};
    for (const row of distResult.results) {
      stateDistribution[(row as any).state_combo] = (row as any).count;
    }

    // Get average intensity
    const intensityResult = await this.env.BEING_STATE_DB.prepare(`
      SELECT AVG(intensity) as avg_intensity FROM being_states
      WHERE expires_at IS NULL OR expires_at > ?
    `).bind(Date.now()).first();

    const averageIntensity = (intensityResult?.avg_intensity as number) ?? 0;

    // Get most common individual states
    const commonResult = await this.env.BEING_STATE_DB.prepare(`
      SELECT visual, COUNT(*) as count FROM being_states
      WHERE expires_at IS NULL OR expires_at > ?
      GROUP BY visual
      ORDER BY count DESC
      LIMIT 5
    `).bind(Date.now()).all();

    const mostCommonStates = commonResult.results.map(
      (row: any) => row.visual
    );

    return {
      totalSessions,
      stateDistribution,
      averageIntensity,
      mostCommonStates,
    };
  }

  // ========================================================================
  // Cost Calculation
  // ========================================================================

  /**
   * Calculate cost of state transition
   */
  private calculateTransitionCost(changes: StateChanges): number {
    let cost = 0;

    // Visual state changes are more expensive (generative AI)
    if (changes.visual.from !== changes.visual.to) {
      cost += 0.005; // $0.005 per visual transition
    }

    // Audio state changes (procedural generation)
    if (changes.audio.from !== changes.audio.to) {
      cost += 0.002; // $0.002 per audio transition
    }

    // Gameplay mutations (vibe coding)
    if (changes.gameplay.from !== changes.gameplay.to) {
      cost += 0.001; // $0.001 per gameplay transition
    }

    // Agent state changes (LLM calls)
    if (changes.agent.from !== changes.agent.to) {
      cost += 0.003; // $0.003 per agent transition
    }

    return cost;
  }

  // ========================================================================
  // Database Helpers
  // ========================================================================

  /**
   * Convert database row to BeingState
   */
  private dbRowToState(row: any): BeingState {
    return {
      id: row.id,
      sessionId: row.session_id,
      visual: row.visual,
      audio: row.audio,
      gameplay: row.gameplay,
      agent: row.agent,
      intensity: row.intensity,
      previousState: row.previous_state ? JSON.parse(row.previous_state) : undefined,
      transitionReason: row.transition_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    };
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Clear cache for specific session
   */
  async clearCache(sessionId: string): Promise<void> {
    this.cache.delete(sessionId);
    if (this.env.BEING_STATE_CACHE) {
      await this.env.BEING_STATE_CACHE.delete(`state:${sessionId}`);
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    this.cache.clear();
    // Note: Can't clear entire KV namespace, only individual keys
  }

  // ========================================================================
  // State Expiration
  // ========================================================================

  /**
   * Clean up expired states
   */
  async cleanupExpiredStates(): Promise<number> {
    if (!this.env.BEING_STATE_DB) {
      return 0;
    }

    const result = await this.env.BEING_STATE_DB.prepare(`
      DELETE FROM being_states WHERE expires_at IS NOT NULL AND expires_at < ?
    `).bind(Date.now()).run();

    return result.meta.changes ?? 0;
  }

  /**
   * Revert expired states to previous
   */
  async revertExpiredState(sessionId: string): Promise<BeingState | null> {
    const currentState = await this.getState(sessionId);

    if (!currentState || !this.isStateExpired(currentState)) {
      return currentState;
    }

    // Get previous state before the expired one
    const history = await this.getHistory(sessionId, 2);
    if (history.length < 2) {
      // No previous state, create default
      return await this.createInitialState(sessionId);
    }

    const previousState = history[history.length - 2];

    // Create new state based on previous
    const revertedState: BeingState = {
      ...previousState,
      id: crypto.randomUUID(),
      sessionId,
      updatedAt: Date.now(),
      previousState: undefined,
      transitionReason: 'Reverted from expired temporary state',
    };

    await this.persistState(revertedState);
    this.cache.set(sessionId, revertedState);

    return revertedState;
  }

  // ========================================================================
  // State Suggestion
  // ========================================================================

  /**
   * Suggest next state based on current state and context
   */
  suggestNextState(
    currentState: BeingState,
    context: {
      playerProgress?: number;
      threatLevel?: number;
      resourceAbundance?: number;
      socialActivity?: number;
    }
  ): Partial<BeingState> {
    const suggestions: Partial<BeingState> = {};
    const { playerProgress, threatLevel, resourceAbundance, socialActivity } = context;

    // Suggest visual state based on threat level
    if (threatLevel !== undefined) {
      if (threatLevel > 0.7) {
        suggestions.visual = 'radiant';
        suggestions.intensity = Math.min(1, currentState.intensity + 0.2);
      } else if (threatLevel > 0.4) {
        suggestions.visual = 'crystalline';
      } else if (threatLevel < 0.2) {
        suggestions.visual = 'ethereal';
        suggestions.intensity = Math.max(0.1, currentState.intensity - 0.1);
      }
    }

    // Suggest audio state based on context
    if (threatLevel !== undefined && threatLevel > 0.6) {
      suggestions.audio = 'intense';
    } else if (socialActivity !== undefined && socialActivity > 0.5) {
      suggestions.audio = 'triumphant';
    } else if (playerProgress !== undefined && playerProgress < 0.3) {
      suggestions.audio = 'serene';
    }

    // Suggest gameplay state based on progress
    if (playerProgress !== undefined) {
      if (playerProgress < 0.2) {
        suggestions.gameplay = 'exploration';
      } else if (playerProgress < 0.6) {
        suggestions.gameplay = 'puzzle';
      } else if (playerProgress < 0.9) {
        suggestions.gameplay = 'competitive';
      } else {
        suggestions.gameplay = 'creative';
      }
    }

    // Suggest agent state based on resource abundance
    if (resourceAbundance !== undefined) {
      if (resourceAbundance > 0.7) {
        suggestions.agent = 'autonomous';
      } else if (resourceAbundance < 0.3) {
        suggestions.agent = 'directed';
      } else {
        suggestions.agent = 'symbiotic';
      }
    }

    return suggestions;
  }

  // ========================================================================
  // State Export/Import
  // ========================================================================

  /**
   * Export state for sharing
   */
  exportState(sessionId: string): string {
    const state = this.cache.get(sessionId);
    if (!state) {
      throw new Error(`No state found for session: ${sessionId}`);
    }

    // Create exportable state without sensitive data
    const exportable = {
      visual: state.visual,
      audio: state.audio,
      gameplay: state.gameplay,
      agent: state.agent,
      intensity: state.intensity,
      // Include timestamp for versioning
      version: Date.now(),
    };

    return btoa(JSON.stringify(exportable));
  }

  /**
   * Import state from export string
   */
  importState(sessionId: string, exportedState: string): BeingState {
    try {
      const decoded = atob(exportedState);
      const imported = JSON.parse(decoded);

      const state: BeingState = {
        id: crypto.randomUUID(),
        sessionId,
        visual: imported.visual,
        audio: imported.audio,
        gameplay: imported.gameplay,
        agent: imported.agent,
        intensity: imported.intensity,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        transitionReason: 'Imported from shared state',
      };

      this.persistState(state);
      this.cache.set(sessionId, state);

      return state;
    } catch (error) {
      throw new Error(`Failed to import state: ${(error as Error).message}`);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a being state manager with environment bindings
 */
export function createStateManager(env: BeingStateEnv): BeingStateManager {
  return new BeingStateManager(env);
}
