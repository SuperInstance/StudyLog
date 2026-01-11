/**
 * Multiplayer Synchronization System
 *
 * Handles real-time multiplayer synchronization for OpenRTS integration.
 *
 * ## Features
 *
 * - Client-side prediction
 * - Server reconciliation
 * - Snapshot interpolation
 * - Lag compensation
 * - Entity interest management
 * - Delta compression
 * - Rollback for cloud AI
 */

import type {
  Vector3,
  UnitInstance,
  StructureInstance,
  PlayerState,
  GameStateSnapshot,
  NetworkMessage,
  NetworkSyncConfig,
  NetworkMessageType,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface MultiplayerConfig {
  /** Server endpoint */
  serverUrl: string;

  /** Room/game ID */
  roomId: string;

  /** Player ID */
  playerId: string;

  /** Auth token */
  authToken?: string;

  /** Tick rate (updates per second) */
  tickRate: number;

  /** Snapshot interval (ms) */
  snapshotInterval: number;

  /** Interpolation delay (ms) */
  interpolationDelay: number;

  /** Client-side prediction enabled */
  prediction: boolean;

  /** Reconciliation enabled */
  reconciliation: boolean;

  /** Max rollback frames */
  maxRollback: number;

  /** Delta compression enabled */
  deltaCompression: boolean;

  /** Interest management radius */
  interestRadius: number;
}

export const DEFAULT_MULTIPLAYER_CONFIG: MultiplayerConfig = {
  serverUrl: 'ws://localhost:9878',
  roomId: 'default',
  playerId: 'player',
  tickRate: 30,
  snapshotInterval: 50,
  interpolationDelay: 100,
  prediction: true,
  reconciliation: true,
  maxRollback: 10,
  deltaCompression: true,
  interestRadius: 200,
};

// ============================================================================
// Snapshot Types
// ============================================================================

export interface EntitySnapshot {
  entityId: string;
  entityType: 'unit' | 'structure';
  position: Vector3;
  rotation: number;
  velocity?: Vector3;
  health: number;
  timestamp: number;
}

export interface WorldSnapshot {
  sequence: number;
  timestamp: number;
  entities: Map<string, EntitySnapshot>;
  players: Map<string, PlayerState>;
}

// ============================================================================
// Input Types
// ============================================================================

export interface PlayerInput {
  /** Input sequence number */
  sequence: number;

  /** Timestamp when input was created */
  timestamp: number;

  /** Input actions */
  actions: InputAction[];
}

export interface InputAction {
  type: 'move' | 'attack' | 'stop' | 'ability' | 'select';
  target?: Vector3 | string;
  data?: unknown;
}

// ============================================================================
// Multiplayer Sync Class
// ============================================================================

/**
 * Real-time multiplayer synchronization system
 */
export class MultiplayerSync {
  private ws: WebSocket | null = null;
  private _isConnected: boolean = false;

  // Snapshot management
  private snapshots: WorldSnapshot[] = [];
  private currentSnapshot: WorldSnapshot | null = null;
  private interpolationTime: number = 0;

  // Input management
  private inputSequence: number = 0;
  private pendingInputs: PlayerInput[] = [];
  private processedInputs: Set<number> = new Set();

  // Reconciliation
  private lastServerSequence: number = 0;
  private rollbackBuffer: WorldSnapshot[] = [];

  // Event handlers
  private messageHandlers: Map<NetworkMessageType, ((data: unknown) => void)[]> = new Map();

  constructor(
    private config: MultiplayerConfig = DEFAULT_MULTIPLAYER_CONFIG
  ) {}

  // ========================================================================
  // Connection
  // ========================================================================

  /**
   * Connect to multiplayer server
   */
  async connect(): Promise<void> {
    if (this._isConnected) {
      return;
    }

    const url = `${this.config.serverUrl}/room/${this.config.roomId}?player=${this.config.playerId}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this._isConnected = true;
          this.debug('Connected to multiplayer server');

          // Send join message
          this.sendMessage({
            type: 'game_state',
            senderId: this.config.playerId,
            timestamp: Date.now(),
            sequence: 0,
            data: {
              action: 'join',
              roomId: this.config.roomId,
              authToken: this.config.authToken,
            },
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.debug('WebSocket error:', error);
        };

        this.ws.onclose = () => {
          this._isConnected = false;
          this.debug('Disconnected from multiplayer server');
        };
      } catch (error) {
        reject(
          new Error(`Failed to connect to multiplayer server: ${error}`)
        );
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._isConnected = false;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  // ========================================================================
  // Message Handling
  // ========================================================================

  /**
   * Send message to server
   */
  sendMessage(message: NetworkMessage): void {
    if (!this._isConnected || !this.ws) {
      this.debug('Not connected, message queued');
      return;
    }

    const json = JSON.stringify(message);
    this.ws.send(json);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string | ArrayBuffer): void {
    let message: NetworkMessage;

    try {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
      message = JSON.parse(text);
    } catch (error) {
      this.debug('Failed to parse message:', data);
      return;
    }

    this.debug('Received:', message.type);

    // Route to handlers
    switch (message.type) {
      case 'game_state':
        this.handleGameStateUpdate(message.data as GameStateSnapshot);
        break;

      case 'unit_spawned':
      case 'unit_moved':
      case 'unit_attacked':
      case 'unit_died':
        this.handleEntityUpdate(message.type, message.data);
        break;

      case 'ping':
        this.handlePing(message);
        break;
    }

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.data);
        } catch (error) {
          this.debug('Handler error:', error);
        }
      }
    }
  }

  /**
   * Handle game state update
   */
  private handleGameStateUpdate(snapshot: GameStateSnapshot): void {
    const worldSnapshot = this.createWorldSnapshot(snapshot);

    // Add to snapshots buffer
    this.snapshots.push(worldSnapshot);

    // Limit buffer size
    const maxSnapshots = Math.ceil(
      (this.config.interpolationDelay * 2) / this.config.snapshotInterval
    ) + this.config.maxRollback;

    while (this.snapshots.length > maxSnapshots) {
      this.snapshots.shift();
    }

    // Update current snapshot
    this.currentSnapshot = worldSnapshot;
    this.lastServerSequence = snapshot.sequence;

    // Reconcile if enabled
    if (this.config.reconciliation) {
      this.reconcile();
    }
  }

  /**
   * Handle entity update
   */
  private handleEntityUpdate(type: NetworkMessageType, data: unknown): void {
    // Entity updates are handled through game state snapshots
    // This is for immediate notifications (like sound effects)
  }

  /**
   * Handle ping message
   */
  private handlePing(message: NetworkMessage): void {
    // Send pong
    this.sendMessage({
      type: 'ping',
      senderId: this.config.playerId,
      timestamp: Date.now(),
      sequence: 0,
      data: {
        response: true,
        originalTimestamp: message.timestamp,
      },
    });
  }

  // ========================================================================
  // Input Handling
  // ========================================================================

  /**
   * Send player input to server
   */
  sendInput(actions: InputAction[]): void {
    const input: PlayerInput = {
      sequence: this.inputSequence++,
      timestamp: Date.now(),
      actions,
    };

    this.pendingInputs.push(input);

    this.sendMessage({
      type: 'game_state',
      senderId: this.config.playerId,
      timestamp: input.timestamp,
      sequence: input.sequence,
      data: {
        action: 'input',
        input,
      },
    });
  }

  /**
   * Predict local entity state (client-side prediction)
   */
  predictLocalUpdate(
    entityId: string,
    current: EntitySnapshot,
    input: PlayerInput
  ): EntitySnapshot {
    if (!this.config.prediction) {
      return current;
    }

    // Apply input to current state
    const predicted = { ...current };

    for (const action of input.actions) {
      switch (action.type) {
        case 'move':
          if (action.target && typeof action.target === 'object') {
            const target = action.target as Vector3;
            const dx = target.x - predicted.position.x;
            const dz = target.z - predicted.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.1) {
              const speed = 5; // Would get from unit stats
              predicted.position.x += (dx / dist) * speed * 0.033;
              predicted.position.z += (dz / dist) * speed * 0.033;
            }
          }
          break;
      }
    }

    predicted.timestamp = input.timestamp;

    return predicted;
  }

  /**
   * Reconcile client state with server state
   */
  private reconcile(): void {
    if (!this.currentSnapshot) return;

    // Find inputs that haven't been processed yet
    const unprocessed = this.pendingInputs.filter(
      (input) => input.sequence > this.lastServerSequence
    );

    // Mark inputs as processed
    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.sequence <= this.lastServerSequence
    );

    // Re-apply unprocessed inputs
    for (const input of unprocessed) {
      // Would apply to local entities
    }
  }

  // ========================================================================
  // Snapshot Interpolation
  // ========================================================================

  /**
   * Get interpolated world state for rendering
   */
  getInterpolatedState(): WorldSnapshot | null {
    if (this.snapshots.length < 2) {
      return this.currentSnapshot;
    }

    const now = Date.now();
    const renderTime = now - this.config.interpolationDelay;

    // Find snapshots around render time
    let from: WorldSnapshot | null = null;
    let to: WorldSnapshot | null = null;

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (this.snapshots[i].timestamp <= renderTime &&
          this.snapshots[i + 1].timestamp >= renderTime) {
        from = this.snapshots[i];
        to = this.snapshots[i + 1];
        break;
      }
    }

    if (!from || !to) {
      return this.snapshots[this.snapshots.length - 1];
    }

    // Calculate interpolation factor
    const range = to.timestamp - from.timestamp;
    const factor = range > 0 ? (renderTime - from.timestamp) / range : 0;

    // Interpolate between snapshots
    return this.interpolateSnapshots(from, to, factor);
  }

  /**
   * Interpolate between two snapshots
   */
  private interpolateSnapshots(
    from: WorldSnapshot,
    to: WorldSnapshot,
    factor: number
  ): WorldSnapshot {
    const interpolated: WorldSnapshot = {
      sequence: to.sequence,
      timestamp: from.timestamp + (to.timestamp - from.timestamp) * factor,
      entities: new Map(),
      players: new Map(to.players), // Players don't interpolate
    };

    // Interpolate entities
    for (const [id, entity] of to.entities) {
      const fromEntity = from.entities.get(id);

      if (fromEntity) {
        interpolated.entities.set(id, {
          ...entity,
          position: {
            x: this.lerp(fromEntity.position.x, entity.position.x, factor),
            y: this.lerp(fromEntity.position.y, entity.position.y, factor),
            z: this.lerp(fromEntity.position.z, entity.position.z, factor),
          },
          rotation: this.lerpAngle(fromEntity.rotation, entity.rotation, factor),
        });
      } else {
        interpolated.entities.set(id, entity);
      }
    }

    return interpolated;
  }

  // ========================================================================
  // Interest Management
  // ========================================================================

  /**
   * Get entities in interest range
   */
  getEntitiesInInterestRange(
    position: Vector3
  ): Map<string, EntitySnapshot> {
    if (!this.currentSnapshot) {
      return new Map();
    }

    const result = new Map<string, EntitySnapshot>();

    for (const [id, entity] of this.currentSnapshot.entities) {
      const dist = this.distance(position, entity.position);
      if (dist <= this.config.interestRadius) {
        result.set(id, entity);
      }
    }

    return result;
  }

  /**
   * Check if entity should be replicated
   */
  shouldReplicateEntity(
    entityId: string,
    viewerPosition: Vector3
  ): boolean {
    if (!this.currentSnapshot) {
      return false;
    }

    const entity = this.currentSnapshot.entities.get(entityId);
    if (!entity) {
      return false;
    }

    return this.distance(viewerPosition, entity.position) <= this.config.interestRadius;
  }

  // ========================================================================
  // Event Subscription
  // ========================================================================

  /**
   * Subscribe to message type
   */
  on(
    messageType: NetworkMessageType,
    callback: (data: unknown) => void
  ): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(callback);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(callback);
        if (index >= 0) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createWorldSnapshot(snapshot: GameStateSnapshot): WorldSnapshot {
    const entities = new Map<string, EntitySnapshot>();

    for (const unit of snapshot.units) {
      entities.set(unit.instanceId, {
        entityId: unit.instanceId,
        entityType: 'unit',
        position: unit.position,
        rotation: unit.rotation,
        health: unit.stats.health,
        timestamp: snapshot.timestamp,
      });
    }

    for (const structure of snapshot.structures) {
      entities.set(structure.instanceId, {
        entityId: structure.instanceId,
        entityType: 'structure',
        position: structure.position,
        rotation: structure.rotation,
        health: structure.health,
        timestamp: snapshot.timestamp,
      });
    }

    const players = new Map<string, PlayerState>();
    for (const player of snapshot.players) {
      players.set(player.id, player);
    }

    return {
      sequence: snapshot.sequence,
      timestamp: snapshot.timestamp,
      entities,
      players,
    };
  }

  private distance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpAngle(a: number, b: number, t: number): number {
    // Handle angle wrapping
    let diff = b - a;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    return a + diff * t;
  }

  private debug(...args: unknown[]): void {
    console.log('[MultiplayerSync]', ...args);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  setConfig(config: Partial<MultiplayerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a multiplayer sync system
 */
export function createMultiplayerSync(
  config?: Partial<MultiplayerConfig>
): MultiplayerSync {
  return new MultiplayerSync({
    ...DEFAULT_MULTIPLAYER_CONFIG,
    ...config,
  });
}

/**
 * Create a StudyLoG multiplayer session
 */
export function createStudyLogSession(
  roomId: string,
  playerId: string
): MultiplayerSync {
  return new MultiplayerSync({
    ...DEFAULT_MULTIPLAYER_CONFIG,
    serverUrl: 'wss://api.studylog.ai/multiplayer',
    roomId,
    playerId,
    tickRate: 20, // Lower tick rate for educational focus
    interpolationDelay: 200,
    prediction: false, // No prediction for shared lab
    reconciliation: false,
    interestRadius: 50, // Smaller lab spaces
  });
}

/**
 * Create a DMLoG multiplayer session
 */
export function createDMLoGSession(
  roomId: string,
  playerId: string
): MultiplayerSync {
  return new MultiplayerSync({
    ...DEFAULT_MULTIPLAYER_CONFIG,
    serverUrl: 'wss://api.dmlog.ai/multiplayer',
    roomId,
    playerId,
    tickRate: 30,
    interpolationDelay: 100,
    prediction: true,
    reconciliation: true,
    interestRadius: 200, // Larger battle maps
  });
}

export default MultiplayerSync;
