/**
 * OpenRTS Bridge
 *
 * WebSocket-based bridge for communicating with godot-open-rts engine.
 *
 * ## Architecture
 *
 * ```
 * Backend Worker (TypeScript)
 *     |
 *     v (WebSocket)
 * OpenRTS Bridge (this module)
 *     |
 *     v (WebSocket)
 * Godot Engine with OpenRTS
 *     |
 *     v (renders to)
 * User Device (PS2-level 3D)
 * ```
 *
 * ## Features
 *
 * - Real-time bidirectional communication
 * - Request/response pattern with RPC
 * - Event streaming for game state updates
 * - Automatic reconnection with backoff
 * - Message queuing during disconnect
 * - Cloud AI offloading support
 */

import type {
  OpenRTSConfig,
  ToOpenRTSMessage,
  FromOpenRTSMessage,
  OpenRTSMessageType,
  OpenRTSEventType,
  Vector3,
  UnitInstance,
  StructureInstance,
  PlayerState,
  GameState,
  TerrainData,
  RTSCameraConfig,
  SelectionState,
  DeviceCapabilities,
  QualityTier,
} from './types.js';
import {
  OpenRTSError,
  OpenRTSErrorCode,
} from './types.js';

// ============================================================================
// Type Aliases for Internal Use
// ============================================================================

type MessageHandler = (message: FromOpenRTSMessage) => void;
type RequestResolver = (value: FromOpenRTSMessage) => void;
type RequestRejector = (error: Error) => void;

interface PendingRequest {
  resolve: RequestResolver;
  reject: RequestRejector;
  timeout: ReturnType<typeof setTimeout>;
  messageType: OpenRTSMessageType;
}

// ============================================================================
// Bridge Configuration
// ============================================================================

export const DEFAULT_BRIDGE_CONFIG: OpenRTSConfig['bridge'] = {
  host: '127.0.0.1',
  port: 9877,
  autoReconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 30,
  requestTimeout: 5000,
};

// ============================================================================
// OpenRTS Bridge Class
// ============================================================================

/**
 * Bridge client for OpenRTS engine communication
 *
 * Handles WebSocket connection, message routing, and RPC-style
 * request/response communication with the godot-open-rts engine.
 */
export class OpenRTSBridge {
  private ws: WebSocket | null = null;
  private _isConnected: boolean = false;
  private _isConnecting: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;

  // Message handling
  private messageHandlers: Map<OpenRTSEventType, MessageHandler[]> = new Map();
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private nextRequestId: number = 0;
  private queuedMessages: ToOpenRTSMessage[] = [];

  // Event streams
  private eventStreams: Map<OpenRTSEventType, Set<(data: unknown) => void>> = new Map();

  // State
  private currentState: GameState | null = null;
  private deviceCapabilities: DeviceCapabilities | null = null;

  constructor(
    private config: OpenRTSConfig['bridge'] = DEFAULT_BRIDGE_CONFIG,
    private debugLog: boolean = false
  ) {}

  // ========================================================================
  // Connection Management
  // ========================================================================

  /**
   * Connect to the OpenRTS engine
   */
  async connect(): Promise<void> {
    if (this._isConnected || this._isConnecting) {
      return;
    }

    this._isConnecting = true;

    const url = `ws://${this.config.host}:${this.config.port}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this._isConnected = true;
          this._isConnecting = false;
          this.reconnectAttempts = 0;
          this.debug('Connected to OpenRTS engine');

          // Flush queued messages
          this.flushQueue();

          // Initialize handshake
          this.initialize()
            .then(() => resolve())
            .catch((error) => {
              this.disconnect();
              reject(error);
            });
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.debug('WebSocket error:', error);
        };

        this.ws.onclose = (event) => {
          this._isConnected = false;
          this._isConnecting = false;
          this.debug('Disconnected from OpenRTS engine', event.code, event.reason);

          if (this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this._isConnecting = false;
        reject(
          new OpenRTSError(
            OpenRTSErrorCode.BRIDGE_DISCONNECTED,
            `Failed to connect to OpenRTS: ${error}`
          )
        );
      }
    });
  }

  /**
   * Disconnect from the OpenRTS engine
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Cancel all pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(
        new OpenRTSError(
          OpenRTSErrorCode.BRIDGE_DISCONNECTED,
          'Connection closed'
        )
      );
    }
    this.pendingRequests.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._isConnected = false;
    this._isConnecting = false;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  // ========================================================================
  // Message Sending
  // ========================================================================

  /**
   * Send a message to OpenRTS
   */
  send(message: ToOpenRTSMessage): void {
    if (!this._isConnected) {
      if (this.config.autoReconnect) {
        this.queuedMessages.push(message);
        this.debug('Queued message:', message.type);
        return;
      }
      throw new OpenRTSError(
        OpenRTSErrorCode.BRIDGE_DISCONNECTED,
        'Not connected to OpenRTS engine'
      );
    }

    const json = JSON.stringify(message);
    this.ws!.send(json);
    this.debug('Sent:', message.type);
  }

  /**
   * Send a message and await response
   */
  async sendAndWait<T = unknown>(
    message: ToOpenRTSMessage,
    timeout: number = this.config.requestTimeout
  ): Promise<T> {
    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new OpenRTSError(
            OpenRTSErrorCode.BRIDGE_TIMEOUT,
            `Request timed out: ${requestId}`
          )
        );
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value.payload as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        timeout: timer,
        messageType: message.type,
      });

      this.send({ ...message, id: requestId });
    });
  }

  // ========================================================================
  // RPC Methods
  // ========================================================================

  /**
   * Initialize the OpenRTS engine with configuration
   */
  async initialize(config?: {
    qualityTier?: QualityTier;
    productType?: 'studylog' | 'dmlog' | 'generic';
  }): Promise<{ success: boolean; engineVersion: string }> {
    const response = await this.sendAndWait<{ success: boolean; engineVersion: string }>({
      type: 'initialize',
      timestamp: Date.now(),
      payload: config || {},
    });

    if (!response.success) {
      throw new OpenRTSError(
        OpenRTSErrorCode.BRIDGE_DISCONNECTED,
        'Failed to initialize OpenRTS engine'
      );
    }

    // Detect device capabilities
    this.deviceCapabilities = await this.detectDeviceCapabilities();

    return response;
  }

  /**
   * Load a map
   */
  async loadMap(mapId: string, terrain?: TerrainData): Promise<{
    success: boolean;
    mapName: string;
    dimensions: { width: number; depth: number };
  }> {
    return this.sendAndWait({
      type: 'load_map',
      timestamp: Date.now(),
      payload: { mapId, terrain },
    });
  }

  /**
   * Spawn a unit
   */
  async spawnUnit(
    unitId: string,
    definitionId: string,
    position: Vector3,
    ownerId: string
  ): Promise<{ success: boolean; instanceId: string }> {
    return this.sendAndWait({
      type: 'spawn_unit',
      timestamp: Date.now(),
      payload: {
        unitId,
        definitionId,
        position,
        ownerId,
      },
    });
  }

  /**
   * Despawn a unit
   */
  despawnUnit(unitId: string): void {
    this.send({
      type: 'despawn_unit',
      timestamp: Date.now(),
      payload: { unitId },
    });
  }

  /**
   * Move units to position
   */
  moveUnits(unitIds: string[], target: Vector3, queued: boolean = false): void {
    this.send({
      type: 'move_units',
      timestamp: Date.now(),
      payload: {
        unitIds,
        target,
        queued,
      },
    });
  }

  /**
   * Order units to attack
   */
  attackOrder(unitIds: string[], targetId: string, queued: boolean = false): void {
    this.send({
      type: 'attack_order',
      timestamp: Date.now(),
      payload: {
        unitIds,
        targetId,
        queued,
      },
    });
  }

  /**
   * Set camera position/rotation
   */
  setCamera(camera: Partial<RTSCameraConfig>): void {
    this.send({
      type: 'set_camera',
      timestamp: Date.now(),
      payload: camera,
    });
  }

  /**
   * Update selection
   */
  updateSelection(selection: SelectionState): void {
    this.send({
      type: 'update_selection',
      timestamp: Date.now(),
      payload: selection,
    });
  }

  /**
   * Send AI command
   */
  async aiCommand(
    playerId: string,
    command: string,
    params: Record<string, unknown> = {}
  ): Promise<{ success: boolean; result: unknown }> {
    return this.sendAndWait({
      type: 'ai_command',
      timestamp: Date.now(),
      payload: {
        playerId,
        command,
        params,
      },
    });
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  /**
   * Subscribe to OpenRTS events
   */
  on(eventType: OpenRTSEventType, callback: MessageHandler): void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, []);
    }
    this.messageHandlers.get(eventType)!.push(callback);
  }

  /**
   * Unsubscribe from OpenRTS events
   */
  off(eventType: OpenRTSEventType, callback: MessageHandler): void {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Subscribe to event stream
   */
  stream(
    eventType: OpenRTSEventType,
    callback: (data: unknown) => void
  ): () => void {
    if (!this.eventStreams.has(eventType)) {
      this.eventStreams.set(eventType, new Set());
    }
    this.eventStreams.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const stream = this.eventStreams.get(eventType);
      if (stream) {
        stream.delete(callback);
      }
    };
  }

  // ========================================================================
  // State Management
  // ========================================================================

  /**
   * Get current game state
   */
  getGameState(): GameState | null {
    return this.currentState;
  }

  /**
   * Update game state (from engine events)
   */
  private updateGameState(partial: Partial<GameState>): void {
    if (!this.currentState) {
      this.currentState = partial as GameState;
    } else {
      this.currentState = { ...this.currentState, ...partial };
    }

    // Emit game state update event
    const handlers = this.messageHandlers.get('game_state_update');
    if (handlers) {
      const message: FromOpenRTSMessage = {
        type: 'game_state_update',
        timestamp: Date.now(),
        payload: this.currentState,
      };
      handlers.forEach((h) => h(message));
    }
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities;
  }

  // ========================================================================
  // Cloud AI Offloading
  // ========================================================================

  /**
   * Check if cloud AI should be used
   */
  shouldUseCloudAI(): boolean {
    if (!this.deviceCapabilities) {
      return true; // Default to cloud
    }

    // Use cloud AI if device can't run high quality
    return !this.deviceCapabilities.canRunHighQuality;
  }

  /**
   * Get AI execution location
   */
  getAILocation(): 'cloud' | 'local' | 'hybrid' {
    if (!this.deviceCapabilities) {
      return 'cloud';
    }

    if (this.deviceCapabilities.canRunHighQuality) {
      return 'local';
    }

    if (this.deviceCapabilities.recommendedTier === 'medium') {
      return 'hybrid';
    }

    return 'cloud';
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Handle incoming message from OpenRTS
   */
  private handleMessage(data: string | ArrayBuffer): void {
    let message: FromOpenRTSMessage;

    try {
      const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
      message = JSON.parse(text);
    } catch (error) {
      this.debug('Failed to parse message:', data);
      return;
    }

    this.debug('Received:', message.type);

    // Handle request responses
    if (message.id && this.pendingRequests.has(message.id)) {
      const request = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      request.resolve(message);
      return;
    }

    // Update game state based on event type
    this.handleGameStateUpdate(message);

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (error) {
          this.debug('Handler error:', error);
        }
      }
    }

    // Call event stream callbacks
    const streams = this.eventStreams.get(message.type);
    if (streams) {
      for (const callback of streams) {
        try {
          callback(message.payload);
        } catch (error) {
          this.debug('Stream callback error:', error);
        }
      }
    }
  }

  /**
   * Update game state based on event type
   */
  private handleGameStateUpdate(message: FromOpenRTSMessage): void {
    if (!this.currentState) {
      return;
    }

    switch (message.type) {
      case 'unit_spawned': {
        const payload = message.payload as { unit: UnitInstance };
        this.currentState.units.set(payload.unit.instanceId, payload.unit);
        break;
      }

      case 'unit_died': {
        const payload = message.payload as { unitId: string };
        this.currentState.units.delete(payload.unitId);
        break;
      }

      case 'structure_built': {
        const payload = message.payload as { structure: StructureInstance };
        this.currentState.structures.set(payload.structure.instanceId, payload.structure);
        break;
      }

      case 'map_loaded': {
        const payload = message.payload as { mapId: string; terrain: TerrainData };
        this.currentState.terrain = payload.terrain;
        break;
      }

      case 'selection_changed': {
        const payload = message.payload as { selection: SelectionState };
        this.currentState.selection = payload.selection;
        break;
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.debug('Max reconnect attempts reached');
      return;
    }

    // Exponential backoff
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.debug(
        `Reconnecting... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
      );
      this.connect().catch(() => {
        // Error already handled in connect()
      });
    }, delay);
  }

  /**
   * Flush queued messages
   */
  private flushQueue(): void {
    for (const message of this.queuedMessages) {
      this.send(message);
    }
    this.queuedMessages = [];
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${this.nextRequestId++}`;
  }

  /**
   * Detect device capabilities
   */
  private async detectDeviceCapabilities(): Promise<DeviceCapabilities> {
    // This would normally query the device, but for backend
    // we'll make a determination based on client info
    const response = await this.sendAndWait<DeviceCapabilities>({
      type: 'ping',
      timestamp: Date.now(),
      payload: { action: 'detect_capabilities' },
    });

    this.deviceCapabilities = response;
    return response;
  }

  /**
   * Debug logging
   */
  private debug(...args: unknown[]): void {
    if (this.debugLog) {
      console.log('[OpenRTSBridge]', ...args);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a connected OpenRTS bridge
 */
export async function createOpenRTSBridge(
  config?: Partial<OpenRTSConfig['bridge']>,
  debugLog?: boolean
): Promise<OpenRTSBridge> {
  const bridge = new OpenRTSBridge(
    { ...DEFAULT_BRIDGE_CONFIG, ...config },
    debugLog
  );
  await bridge.connect();
  return bridge;
}

/**
 * Create a bridge without auto-connecting
 */
export function createBridgeClient(
  config?: Partial<OpenRTSConfig['bridge']>,
  debugLog?: boolean
): OpenRTSBridge {
  return new OpenRTSBridge(
    { ...DEFAULT_BRIDGE_CONFIG, ...config },
    debugLog
  );
}

// ============================================================================
// Cloud AI Offloading Helpers
// ============================================================================

/**
 * Determine if an AI operation should run on cloud
 */
export function shouldOffloadToCloud(
  bridge: OpenRTSBridge,
  operation: 'pathfinding' | 'decision' | 'simulation' | 'rendering'
): boolean {
  const location = bridge.getAILocation();

  // Always offload rendering decisions (device handles actual rendering)
  if (operation === 'rendering') {
    return false;
  }

  // Cloud or hybrid: offload heavy computation
  if (location === 'cloud') {
    return true;
  }

  if (location === 'hybrid') {
    // Offload pathfinding and simulation in hybrid mode
    return operation === 'pathfinding' || operation === 'simulation';
  }

  // Local: nothing offloaded
  return false;
}

/**
 * Get optimal worker configuration for AI tasks
 */
export function getWorkerConfig(bridge: OpenRTSBridge): {
  pathfindingThreads: number;
  aiUpdateInterval: number;
  maxConcurrentRequests: number;
} {
  const location = bridge.getAILocation();

  if (location === 'cloud') {
    // Cloud can handle more parallel work
    return {
      pathfindingThreads: 8,
      aiUpdateInterval: 100, // 10Hz AI updates
      maxConcurrentRequests: 100,
    };
  }

  if (location === 'hybrid') {
    return {
      pathfindingThreads: 4,
      aiUpdateInterval: 200, // 5Hz AI updates
      maxConcurrentRequests: 50,
    };
  }

  // Local: conservative settings
  return {
    pathfindingThreads: 2,
    aiUpdateInterval: 500, // 2Hz AI updates
    maxConcurrentRequests: 20,
  };
}

export default OpenRTSBridge;
