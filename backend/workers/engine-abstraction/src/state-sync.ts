/**
 * State Sync
 *
 * Synchronizes game state across engines for seamless transitions.
 * Handles real-time, periodic, and manual sync modes.
 *
 * @module engine-abstraction/state-sync
 */

import type {
  UniversalGameState,
  GameEngine,
  EntityState,
  WorldState,
  PlayerState,
  StateSyncRequest,
  StateSyncResponse,
  SyncMode,
  StateChange,
  ChangeType,
  Vector3,
  LightState,
  EnvironmentState,
} from "./types.js";
import type { IGameEngine } from "./engine-interface.js";

// ============================================================================
// STATE SYNC MANAGER
// ============================================================================

/**
 * Manages state synchronization across engines.
 * Enables real-time sync between MicroVerse, Luanti, and OpenRTS.
 */
export class StateSyncManager {
  private static _instance: StateSyncManager | null = null;
  private _engines: Map<GameEngine, IGameEngine> = new Map();
  private _syncChannels: Map<string, SyncChannel> = new Map();
  private _activeSession: string | null = null;
  private _syncInterval: number | null = null;
  private _changeBuffer: StateChange[] = [];
  private _maxBufferSize: number = 1000;

  private constructor() {}

  /**
   * Get the singleton StateSyncManager instance.
   */
  static getInstance(): StateSyncManager {
    if (!StateSyncManager._instance) {
      StateSyncManager._instance = new StateSyncManager();
    }
    return StateSyncManager._instance;
  }

  /**
   * Register an engine for state synchronization.
   * @param engine - Engine to register
   */
  registerEngine(engine: IGameEngine): void {
    this._engines.set(engine.engineId, engine);
  }

  /**
   * Unregister an engine from state synchronization.
   * @param engineId - Engine identifier
   */
  unregisterEngine(engineId: GameEngine): void {
    this._engines.delete(engineId);

    // Clean up channels involving this engine
    for (const [key, channel] of this._syncChannels) {
      if (channel.source === engineId || channel.target === engineId) {
        this._syncChannels.delete(key);
      }
    }
  }

  /**
   * Create a sync channel between two engines.
   * @param source - Source engine
   * @param target - Target engine
   * @param config - Channel configuration
   * @returns Channel identifier
   */
  createChannel(
    source: GameEngine,
    target: GameEngine,
    config?: Partial<SyncChannelConfig>,
  ): string {
    const channelId = this.getChannelId(source, target);

    this._syncChannels.set(channelId, {
      id: channelId,
      source,
      target,
      mode: config?.mode ?? SyncMode.PERIODIC,
      interval: config?.interval ?? 1000,
      enabled: config?.enabled ?? true,
      filters: config?.filters ?? [],
      transform: config?.transform,
      lastSync: 0,
      syncCount: 0,
    });

    return channelId;
  }

  /**
   * Remove a sync channel.
   * @param channelId - Channel identifier
   */
  removeChannel(channelId: string): void {
    this._syncChannels.delete(channelId);
  }

  /**
   * Get a sync channel.
   * @param channelId - Channel identifier
   * @returns Sync channel or undefined
   */
  getChannel(channelId: string): SyncChannel | undefined {
    return this._syncChannels.get(channelId);
  }

  /**
   * Enable or disable a sync channel.
   * @param channelId - Channel identifier
   * @param enabled - Enable state
   */
  setChannelEnabled(channelId: string, enabled: boolean): void {
    const channel = this._syncChannels.get(channelId);
    if (channel) {
      channel.enabled = enabled;
    }
  }

  /**
   * Start a sync session.
   * @param sessionId - Session identifier
   * @param mode - Sync mode
   * @param interval - Sync interval in milliseconds (for periodic mode)
   */
  startSession(sessionId: string, mode: SyncMode, interval?: number): void {
    this._activeSession = sessionId;
    this._changeBuffer = [];

    // Clear any existing interval
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }

    // Set up periodic sync if requested
    if (mode === SyncMode.PERIODIC && interval) {
      this._syncInterval = window.setInterval(() => {
        this.syncAllChannels();
      }, interval);
    }
  }

  /**
   * Stop the current sync session.
   */
  stopSession(): void {
    this._activeSession = null;

    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }

    this._changeBuffer = [];
  }

  /**
   * Get the active session ID.
   * @returns Active session ID or null
   */
  getActiveSession(): string | null {
    return this._activeSession;
  }

  /**
   * Synchronize state between engines.
   * @param request - Sync request
   * @returns Sync response
   */
  async sync(request: StateSyncRequest): Promise<StateSyncResponse> {
    const startTime = Date.now();

    // Get source and target engines
    const sourceEngine = this._engines.get(request.state.engine);
    const targetEngine = this._engines.get(request.targetEngine);

    if (!sourceEngine) {
      return {
        success: false,
        state: request.state,
        changes: [],
        duration: Date.now() - startTime,
      };
    }

    // Transform state for target engine
    const transformedState = await this.transformState(
      request.state,
      request.targetEngine,
    );

    // Load state into target engine
    const changes: StateChange[] = [];

    if (targetEngine) {
      try {
        const loadResult = await targetEngine.loadState(transformedState);
        changes.push(...this.collectChanges(request.state, transformedState));
      } catch (error) {
        console.error("Error loading state into target engine:", error);
      }
    }

    return {
      success: true,
      state: transformedState,
      changes,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Synchronize all active channels.
   */
  async syncAllChannels(): Promise<void> {
    const now = Date.now();

    for (const channel of this._syncChannels.values()) {
      if (!channel.enabled) continue;

      // Check if channel should sync based on mode
      if (channel.mode === SyncMode.PERIODIC) {
        if (now - channel.lastSync < channel.interval) continue;
      }

      // Perform sync
      await this.syncChannel(channel);
      channel.lastSync = now;
      channel.syncCount++;
    }
  }

  /**
   * Synchronize a single channel.
   * @param channel - Sync channel
   */
  private async syncChannel(channel: SyncChannel): Promise<void> {
    const sourceEngine = this._engines.get(channel.source);
    const targetEngine = this._engines.get(channel.target);

    if (!sourceEngine || !targetEngine) return;

    try {
      const state = sourceEngine.getState();
      const transformedState = await this.transformState(state, channel.target);

      // Apply filters if configured
      const filteredState = this.applyFilters(transformedState, channel.filters);

      // Apply custom transform if configured
      const finalState = channel.transform
        ? await channel.transform(filteredState)
        : filteredState;

      await targetEngine.loadState(finalState);
    } catch (error) {
      console.error(`Error syncing channel ${channel.id}:`, error);
    }
  }

  /**
   * Transform state for target engine.
   * @param state - Source state
   * @param targetEngine - Target engine
   * @returns Transformed state
   */
  private async transformState(
    state: UniversalGameState,
    targetEngine: GameEngine,
  ): Promise<UniversalGameState> {
    const transformed: UniversalGameState = {
      ...state,
      engine: targetEngine,
      world: this.transformWorldState(state.world, targetEngine),
    };

    return transformed;
  }

  /**
   * Transform world state for target engine.
   * @param world - Source world state
   * @param targetEngine - Target engine
   * @returns Transformed world state
   */
  private transformWorldState(
    world: WorldState,
    targetEngine: GameEngine,
  ): WorldState {
    return {
      ...world,
      entities: world.entities.map((entity) =>
        this.transformEntity(entity, targetEngine),
      ),
    };
  }

  /**
   * Transform entity for target engine.
   * @param entity - Source entity
   * @param targetEngine - Target engine
   * @returns Transformed entity
   */
  private transformEntity(
    entity: EntityState,
    targetEngine: GameEngine,
  ): EntityState {
    const transformed: EntityState = {
      ...entity,
      // Adjust position based on engine coordinate system
      position: this.adjustPosition(entity.position, targetEngine),
      // Adjust rotation based on engine coordinate system
      rotation: this.adjustRotation(entity.rotation, targetEngine),
      // Adjust scale based on engine units
      scale: this.adjustScale(entity.scale, targetEngine),
    };

    return transformed;
  }

  /**
   * Adjust position for target engine.
   * @param position - Source position
   * @param targetEngine - Target engine
   * @returns Adjusted position
   */
  private adjustPosition(position: Vector3, targetEngine: GameEngine): Vector3 {
    switch (targetEngine) {
      case "microverse":
        // 2D engine - flatten Z
        return { x: position.x, y: position.y, z: 0 };

      case "luanti":
        // Voxel engine - quantize to grid
        return {
          x: Math.round(position.x),
          y: Math.round(position.y),
          z: Math.round(position.z),
        };

      case "openrts":
        // Full 3D - no adjustment needed
        return position;

      default:
        return position;
    }
  }

  /**
   * Adjust rotation for target engine.
   * @param rotation - Source rotation
   * @param targetEngine - Target engine
   * @returns Adjusted rotation
   */
  private adjustRotation(rotation: Vector3, targetEngine: GameEngine): Vector3 {
    switch (targetEngine) {
      case "microverse":
        // 2D engine - only Z rotation matters
        return { x: 0, y: 0, z: rotation.z };

      case "luanti":
        // Voxel engine - 90 degree increments
        return {
          x: Math.round(rotation.x / 90) * 90,
          y: Math.round(rotation.y / 90) * 90,
          z: Math.round(rotation.z / 90) * 90,
        };

      case "openrts":
        // Full 3D - no adjustment needed
        return rotation;

      default:
        return rotation;
    }
  }

  /**
   * Adjust scale for target engine.
   * @param scale - Source scale
   * @param targetEngine - Target engine
   * @returns Adjusted scale
   */
  private adjustScale(scale: Vector3, targetEngine: GameEngine): Vector3 {
    switch (targetEngine) {
      case "microverse":
        // 2D engine - uniform scale
        const avg = (scale.x + scale.y + scale.z) / 3;
        return { x: avg, y: avg, z: 1 };

      case "luanti":
        // Voxel engine - snap to whole units
        return {
          x: Math.max(1, Math.round(scale.x)),
          y: Math.max(1, Math.round(scale.y)),
          z: Math.max(1, Math.round(scale.z)),
        };

      case "openrts":
        // Full 3D - preserve scale
        return scale;

      default:
        return scale;
    }
  }

  /**
   * Apply state filters.
   * @param state - State to filter
   * @param filters - Filters to apply
   * @returns Filtered state
   */
  private applyFilters(
    state: UniversalGameState,
    filters: StateFilter[],
  ): UniversalGameState {
    let filtered = state;

    for (const filter of filters) {
      filtered = this.applyFilter(filtered, filter);
    }

    return filtered;
  }

  /**
   * Apply a single state filter.
   * @param state - State to filter
   * @param filter - Filter to apply
   * @returns Filtered state
   */
  private applyFilter(state: UniversalGameState, filter: StateFilter): UniversalGameState {
    switch (filter.type) {
      case StateFilterType.ENTITY_TYPE:
        // Filter entities by type
        return {
          ...state,
          world: {
            ...state.world,
            entities: state.world.entities.filter(
              (e) => e.type === filter.value,
            ),
          },
        };

      case StateFilterType.ENTITY_ID:
        // Filter to specific entities
        const ids = new Set(filter.value as string[]);
        return {
          ...state,
          world: {
            ...state.world,
            entities: state.world.entities.filter((e) => ids.has(e.id)),
          },
        };

      case StateFilterType.PROPERTY:
        // Filter entities by property
        return {
          ...state,
          world: {
            ...state.world,
            entities: state.world.entities.filter((e) =>
              e.properties[filter.key] === filter.value,
            ),
          },
        };

      case StateFilterType.SCENE:
        // Filter to specific scene
        return {
          ...state,
          world: {
            ...state.world,
            currentScene: filter.value as string,
          },
        };

      default:
        return state;
    }
  }

  /**
   * Collect changes between two states.
   * @param source - Source state
   * @param target - Target state
   * @returns Array of state changes
   */
  private collectChanges(
    source: UniversalGameState,
    target: UniversalGameState,
  ): StateChange[] {
    const changes: StateChange[] = [];

    // Check for engine change
    if (source.engine !== target.engine) {
      changes.push({
        type: ChangeType.ASSET_CONVERTED,
        target: "engine",
        oldValue: source.engine,
        newValue: target.engine,
        reason: "Engine migration",
      });
    }

    // Check for entity changes
    const sourceEntities = new Map(source.world.entities.map((e) => [e.id, e]));
    const targetEntities = new Map(target.world.entities.map((e) => [e.id, e]));

    // Added entities
    for (const [id, entity] of targetEntities) {
      if (!sourceEntities.has(id)) {
        changes.push({
          type: ChangeType.ENTITY_ADDED,
          target: id,
          oldValue: undefined,
          newValue: entity,
          reason: "Entity added in target engine",
        });
      }
    }

    // Removed entities
    for (const [id, entity] of sourceEntities) {
      if (!targetEntities.has(id)) {
        changes.push({
          type: ChangeType.ENTITY_REMOVED,
          target: id,
          oldValue: entity,
          newValue: undefined,
          reason: "Entity not supported in target engine",
        });
      }
    }

    // Modified entities
    for (const [id, sourceEntity] of sourceEntities) {
      const targetEntity = targetEntities.get(id);
      if (!targetEntity) continue;

      // Check position change
      if (
        sourceEntity.position.x !== targetEntity.position.x ||
        sourceEntity.position.y !== targetEntity.position.y ||
        sourceEntity.position.z !== targetEntity.position.z
      ) {
        changes.push({
          type: ChangeType.ENTITY_MODIFIED,
          target: id,
          oldValue: sourceEntity.position,
          newValue: targetEntity.position,
          reason: "Position adjusted for target engine",
        });
      }
    }

    return changes;
  }

  /**
   * Get channel ID for two engines.
   * @param source - Source engine
   * @param target - Target engine
   * @returns Channel ID
   */
  private getChannelId(source: GameEngine, target: GameEngine): string {
    return `${source}->${target}`;
  }

  /**
   * Get all sync channels.
   * @returns Array of sync channels
   */
  getChannels(): SyncChannel[] {
    return Array.from(this._syncChannels.values());
  }

  /**
   * Get sync statistics.
   * @returns Sync statistics
   */
  getStats(): SyncStats {
    const channels = Array.from(this._syncChannels.values());

    return {
      activeSession: this._activeSession ?? undefined,
      totalChannels: channels.length,
      enabledChannels: channels.filter((c) => c.enabled).length,
      totalSyncs: channels.reduce((sum, c) => sum + c.syncCount, 0),
      bufferSize: this._changeBuffer.length,
      registeredEngines: Array.from(this._engines.keys()),
    };
  }

  /**
   * Record a state change.
   * @param change - State change to record
   */
  recordChange(change: StateChange): void {
    this._changeBuffer.push(change);

    // Trim buffer if too large
    if (this._changeBuffer.length > this._maxBufferSize) {
      this._changeBuffer = this._changeBuffer.slice(-this._maxBufferSize);
    }
  }

  /**
   * Get recorded state changes.
   * @param limit - Maximum number of changes to return
   * @returns Array of state changes
   */
  getChanges(limit?: number): StateChange[] {
    if (limit) {
      return this._changeBuffer.slice(-limit);
    }
    return [...this._changeBuffer];
  }

  /**
   * Clear recorded state changes.
   */
  clearChanges(): void {
    this._changeBuffer = [];
  }

  /**
   * Create a state delta for efficient syncing.
   * @param previous - Previous state
   * @param current - Current state
   * @returns State delta
   */
  createDelta(previous: UniversalGameState, current: UniversalGameState): StateDelta {
    return {
      version: current.version,
      timestamp: current.timestamp,
      engine: current.engine,
      entityDeltas: this.createEntityDeltas(previous.world.entities, current.world.entities),
      playerDelta: this.createPlayerDelta(previous.player, current.player),
      environmentDelta: this.createEnvironmentDelta(
        previous.world.environment,
        current.world.environment,
      ),
    };
  }

  /**
   * Create entity deltas.
   * @param previous - Previous entities
   * @param current - Current entities
   * @returns Entity deltas
   */
  private createEntityDeltas(
    previous: EntityState[],
    current: EntityState[],
  ): EntityDelta[] {
    const deltas: EntityDelta[] = [];
    const previousMap = new Map(previous.map((e) => [e.id, e]));
    const currentMap = new Map(current.map((e) => [e.id, e]));

    // Find changes and additions
    for (const [id, entity] of currentMap) {
      const prev = previousMap.get(id);

      if (!prev) {
        // Added
        deltas.push({ id, type: DeltaType.ADDED, entity });
      } else {
        // Check for changes
        const changes = this.getEntityChanges(prev, entity);
        if (changes.length > 0) {
          deltas.push({ id, type: DeltaType.MODIFIED, changes, entity });
        }
      }
    }

    // Find deletions
    for (const [id, entity] of previousMap) {
      if (!currentMap.has(id)) {
        deltas.push({ id, type: DeltaType.REMOVED, entity });
      }
    }

    return deltas;
  }

  /**
   * Get changes between two entities.
   * @param previous - Previous entity
   * @param current - Current entity
   * @returns Array of changes
   */
  private getEntityChanges(
    previous: EntityState,
    current: EntityState,
  ): EntityPropertyChange[] {
    const changes: EntityPropertyChange[] = [];

    // Check position
    if (
      previous.position.x !== current.position.x ||
      previous.position.y !== current.position.y ||
      previous.position.z !== current.position.z
    ) {
      changes.push({
        property: "position",
        oldValue: previous.position,
        newValue: current.position,
      });
    }

    // Check rotation
    if (
      previous.rotation.x !== current.rotation.x ||
      previous.rotation.y !== current.rotation.y ||
      previous.rotation.z !== current.rotation.z
    ) {
      changes.push({
        property: "rotation",
        oldValue: previous.rotation,
        newValue: current.rotation,
      });
    }

    // Check scale
    if (
      previous.scale.x !== current.scale.x ||
      previous.scale.y !== current.scale.y ||
      previous.scale.z !== current.scale.z
    ) {
      changes.push({
        property: "scale",
        oldValue: previous.scale,
        newValue: current.scale,
      });
    }

    // Check animation
    if (previous.animation?.sequence !== current.animation?.sequence) {
      changes.push({
        property: "animation",
        oldValue: previous.animation?.sequence,
        newValue: current.animation?.sequence,
      });
    }

    return changes;
  }

  /**
   * Create player delta.
   * @param previous - Previous player state
   * @param current - Current player state
   * @returns Player delta
   */
  private createPlayerDelta(
    previous: PlayerState,
    current: PlayerState,
  ): PlayerDelta | null {
    const changes: EntityPropertyChange[] = [];

    // Check position
    if (
      previous.position.x !== current.position.x ||
      previous.position.y !== current.position.y ||
      previous.position.z !== current.position.z
    ) {
      changes.push({
        property: "position",
        oldValue: previous.position,
        newValue: current.position,
      });
    }

    // Check stats
    if (previous.stats.health !== current.stats.health) {
      changes.push({
        property: "health",
        oldValue: previous.stats.health,
        newValue: current.stats.health,
      });
    }

    if (previous.stats.mana !== current.stats.mana) {
      changes.push({
        property: "mana",
        oldValue: previous.stats.mana,
        newValue: current.stats.mana,
      });
    }

    if (previous.stats.experience !== current.stats.experience) {
      changes.push({
        property: "experience",
        oldValue: previous.stats.experience,
        newValue: current.stats.experience,
      });
    }

    if (changes.length === 0) return null;

    return {
      id: current.id,
      changes,
    };
  }

  /**
   * Create environment delta.
   * @param previous - Previous environment
   * @param current - Current environment
   * @returns Environment delta
   */
  private createEnvironmentDelta(
    previous: EnvironmentState,
    current: EnvironmentState,
  ): EnvironmentDelta | null {
    const changes: EntityPropertyChange[] = [];

    // Check time of day
    if (previous.timeOfDay !== current.timeOfDay) {
      changes.push({
        property: "timeOfDay",
        oldValue: previous.timeOfDay,
        newValue: current.timeOfDay,
      });
    }

    // Check weather
    if (previous.weather !== current.weather) {
      changes.push({
        property: "weather",
        oldValue: previous.weather,
        newValue: current.weather,
      });
    }

    if (changes.length === 0) return null;

    return {
      changes,
    };
  }

  /**
   * Apply a state delta to a base state.
   * @param base - Base state
   * @param delta - State delta to apply
   * @returns Updated state
   */
  applyDelta(base: UniversalGameState, delta: StateDelta): UniversalGameState {
    let state = { ...base };

    // Apply entity deltas
    const entityMap = new Map(state.world.entities.map((e) => [e.id, e]));

    for (const entityDelta of delta.entityDeltas) {
      switch (entityDelta.type) {
        case DeltaType.ADDED:
          if (entityDelta.entity) {
            entityMap.set(entityDelta.id, entityDelta.entity);
          }
          break;

        case DeltaType.MODIFIED:
          const existing = entityMap.get(entityDelta.id);
          if (existing && entityDelta.changes) {
            entityMap.set(
              entityDelta.id,
              this.applyEntityChanges(existing, entityDelta.changes),
            );
          }
          break;

        case DeltaType.REMOVED:
          entityMap.delete(entityDelta.id);
          break;
      }
    }

    state = {
      ...state,
      world: {
        ...state.world,
        entities: Array.from(entityMap.values()),
      },
    };

    // Apply player delta
    if (delta.playerDelta) {
      state = {
        ...state,
        player: this.applyPlayerDelta(state.player, delta.playerDelta),
      };
    }

    // Apply environment delta
    if (delta.environmentDelta) {
      state = {
        ...state,
        world: {
          ...state.world,
          environment: this.applyEnvironmentDelta(
            state.world.environment,
            delta.environmentDelta,
          ),
        },
      };
    }

    return state;
  }

  /**
   * Apply entity changes.
   * @param entity - Base entity
   * @param changes - Changes to apply
   * @returns Updated entity
   */
  private applyEntityChanges(
    entity: EntityState,
    changes: EntityPropertyChange[],
  ): EntityState {
    let updated = { ...entity };

    for (const change of changes) {
      switch (change.property) {
        case "position":
          updated = {
            ...updated,
            position: change.newValue as Vector3,
          };
          break;
        case "rotation":
          updated = {
            ...updated,
            rotation: change.newValue as Vector3,
          };
          break;
        case "scale":
          updated = {
            ...updated,
            scale: change.newValue as Vector3,
          };
          break;
        case "animation":
          updated = {
            ...updated,
            animation: updated.animation
              ? { ...updated.animation, sequence: change.newValue as string }
              : undefined,
          };
          break;
      }
    }

    return updated;
  }

  /**
   * Apply player delta.
   * @param player - Base player state
   * @param delta - Player delta
   * @returns Updated player state
   */
  private applyPlayerDelta(
    player: PlayerState,
    delta: PlayerDelta,
  ): PlayerState {
    let updated = { ...player, stats: { ...player.stats } };

    for (const change of delta.changes) {
      switch (change.property) {
        case "position":
          updated = {
            ...updated,
            position: change.newValue as Vector3,
          };
          break;
        case "health":
          updated.stats.health = change.newValue as number;
          break;
        case "mana":
          updated.stats.mana = change.newValue as number;
          break;
        case "experience":
          updated.stats.experience = change.newValue as number;
          break;
      }
    }

    return updated;
  }

  /**
   * Apply environment delta.
   * @param environment - Base environment state
   * @param delta - Environment delta
   * @returns Updated environment state
   */
  private applyEnvironmentDelta(
    environment: EnvironmentState,
    delta: EnvironmentDelta,
  ): EnvironmentState {
    let updated = { ...environment };

    for (const change of delta.changes) {
      switch (change.property) {
        case "timeOfDay":
          updated = {
            ...updated,
            timeOfDay: change.newValue as number,
          };
          break;
        case "weather":
          updated = {
            ...updated,
            weather: change.newValue as string,
          };
          break;
      }
    }

    return updated;
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sync channel configuration.
 */
export interface SyncChannelConfig {
  /** Sync mode */
  mode: SyncMode;
  /** Sync interval in milliseconds */
  interval: number;
  /** Is channel enabled */
  enabled: boolean;
  /** State filters to apply */
  filters: StateFilter[];
  /** Custom state transformer */
  transform?: (state: UniversalGameState) => Promise<UniversalGameState>;
}

/**
 * Active sync channel.
 */
export interface SyncChannel {
  /** Channel identifier */
  id: string;
  /** Source engine */
  source: GameEngine;
  /** Target engine */
  target: GameEngine;
  /** Sync mode */
  mode: SyncMode;
  /** Sync interval in milliseconds */
  interval: number;
  /** Is channel enabled */
  enabled: boolean;
  /** State filters to apply */
  filters: StateFilter[];
  /** Custom state transformer */
  transform?: (state: UniversalGameState) => Promise<UniversalGameState>;
  /** Last sync timestamp */
  lastSync: number;
  /** Number of syncs performed */
  syncCount: number;
}

/**
 * State filter types.
 */
export enum StateFilterType {
  /** Filter by entity type */
  ENTITY_TYPE = "entity_type",
  /** Filter by entity ID(s) */
  ENTITY_ID = "entity_id",
  /** Filter by property value */
  PROPERTY = "property",
  /** Filter by scene */
  SCENE = "scene",
}

/**
 * State filter configuration.
 */
export interface StateFilter {
  /** Filter type */
  type: StateFilterType;
  /** Filter value */
  value: unknown;
  /** Property key (for PROPERTY type) */
  key?: string;
}

/**
 * Sync statistics.
 */
export interface SyncStats {
  /** Active session ID */
  activeSession?: string;
  /** Total number of channels */
  totalChannels: number;
  /** Number of enabled channels */
  enabledChannels: number;
  /** Total number of syncs performed */
  totalSyncs: number;
  /** Current buffer size */
  bufferSize: number;
  /** Registered engine IDs */
  registeredEngines: GameEngine[];
}

/**
 * State delta for efficient syncing.
 */
export interface StateDelta {
  /** State version */
  version: string;
  /** Delta timestamp */
  timestamp: number;
  /** Target engine */
  engine: GameEngine;
  /** Entity deltas */
  entityDeltas: EntityDelta[];
  /** Player delta */
  playerDelta: PlayerDelta | null;
  /** Environment delta */
  environmentDelta: EnvironmentDelta | null;
}

/**
 * Delta types.
 */
export enum DeltaType {
  /** Entity was added */
  ADDED = "added",
  /** Entity was modified */
  MODIFIED = "modified",
  /** Entity was removed */
  REMOVED = "removed",
}

/**
 * Entity delta.
 */
export interface EntityDelta {
  /** Entity ID */
  id: string;
  /** Delta type */
  type: DeltaType;
  /** Entity data (for ADDED type) */
  entity?: EntityState;
  /** Property changes (for MODIFIED type) */
  changes?: EntityPropertyChange[];
}

/**
 * Entity property change.
 */
export interface EntityPropertyChange {
  /** Property name */
  property: string;
  /** Old value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
}

/**
 * Player delta.
 */
export interface PlayerDelta {
  /** Player ID */
  id: string;
  /** Property changes */
  changes: EntityPropertyChange[];
}

/**
 * Environment delta.
 */
export interface EnvironmentDelta {
  /** Property changes */
  changes: EntityPropertyChange[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a state sync manager instance.
 * @returns State sync manager
 */
export function createStateSyncManager(): StateSyncManager {
  return StateSyncManager.getInstance();
}

/**
 * Synchronize state between engines.
 * @param state - Source state
 * @param targetEngine - Target engine
 * @returns Sync response
 */
export async function syncState(
  state: UniversalGameState,
  targetEngine: GameEngine,
): Promise<StateSyncResponse> {
  const manager = StateSyncManager.getInstance();
  return manager.sync({
    state,
    targetEngine,
    mode: SyncMode.MANUAL,
  });
}

/**
 * Create a state delta.
 * @param previous - Previous state
 * @param current - Current state
 * @returns State delta
 */
export function createStateDelta(
  previous: UniversalGameState,
  current: UniversalGameState,
): StateDelta {
  const manager = StateSyncManager.getInstance();
  return manager.createDelta(previous, current);
}

/**
 * Apply a state delta.
 * @param base - Base state
 * @param delta - State delta
 * @returns Updated state
 */
export function applyStateDelta(
  base: UniversalGameState,
  delta: StateDelta,
): UniversalGameState {
  const manager = StateSyncManager.getInstance();
  return manager.applyDelta(base, delta);
}

/**
 * Create a sync channel.
 * @param source - Source engine
 * @param target - Target engine
 * @param config - Channel configuration
 * @returns Channel ID
 */
export function createSyncChannel(
  source: GameEngine,
  target: GameEngine,
  config?: Partial<SyncChannelConfig>,
): string {
  const manager = StateSyncManager.getInstance();
  return manager.createChannel(source, target, config);
}

/**
 * Start a sync session.
 * @param sessionId - Session identifier
 * @param mode - Sync mode
 * @param interval - Sync interval (for periodic mode)
 */
export function startSyncSession(
  sessionId: string,
  mode: SyncMode,
  interval?: number,
): void {
  const manager = StateSyncManager.getInstance();
  manager.startSession(sessionId, mode, interval);
}

/**
 * Stop the current sync session.
 */
export function stopSyncSession(): void {
  const manager = StateSyncManager.getInstance();
  manager.stopSession();
}
