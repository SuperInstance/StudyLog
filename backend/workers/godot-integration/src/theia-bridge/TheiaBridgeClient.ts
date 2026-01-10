/**
 * TheiaBridgeClient.ts
 *
 * Enhanced Theia-Godot bridge client with RPC, event streaming, and state sync
 */

import type {
  GodotToTheiaMessage,
  TheiaToGodotMessage,
  TheiaBridgeInterface,
  EventCallback,
  RPCMethod,
} from "../types/index.js";
import {
  GodotIntegrationError,
  ErrorCode,
} from "../types/index.js";

export interface TheiaBridgeConfig {
  host: string;
  port: number;
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  rpcTimeout: number;
  debugLog: boolean;
}

export const DEFAULT_CONFIG: TheiaBridgeConfig = {
  host: "127.0.0.1",
  port: 9876,
  autoReconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 30,
  rpcTimeout: 5000,
  debugLog: false,
};

/**
 * WebSocket-based client for Theia-Godot communication
 */
export class TheiaBridgeClient implements TheiaBridgeInterface {
  private ws: WebSocket | null = null;
  private _isConnected: boolean = false;
  private _isConnecting: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private messageHandlers: Map<string, EventCallback[]> = new Map();
  private rpcRequests: Map<string, RPCRequest> = new Map();
  private nextRpcId: number = 0;
  private sharedState: Map<string, unknown> = new Map();
  private eventSubscriptions: Set<string> = new Set();
  private queuedMessages: TheiaToGodotMessage[] = [];

  // Event streams
  private eventStreams: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(private config: TheiaBridgeConfig = DEFAULT_CONFIG) {}

  // ========================================================================
  // Connection Management
  // ========================================================================

  /**
   * Connect to the Godot bridge server
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

        this.ws.onopen = () => {
          this._isConnected = true;
          this._isConnecting = false;
          this.reconnectAttempts = 0;
          this.debug("Connected to Godot bridge");

          // Send queued messages
          this.flushQueue();

          // Re-subscribe to events
          this.resubscribeEvents();

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          this.debug("WebSocket error:", error);
        };

        this.ws.onclose = () => {
          this._isConnected = false;
          this._isConnecting = false;
          this.debug("Disconnected from Godot bridge");

          if (this.config.autoReconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        this._isConnecting = false;
        reject(
          new GodotIntegrationError(
            ErrorCode.BRIDGE_DISCONNECTED,
            `Failed to connect to Godot bridge: ${error}`
          )
        );
      }
    });
  }

  /**
   * Disconnect from the Godot bridge server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

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
   * Send a message to Godot
   */
  send(message: TheiaToGodotMessage): void {
    if (!this._isConnected) {
      if (this.config.autoReconnect) {
        this.queuedMessages.push(message);
        return;
      }
      throw new GodotIntegrationError(
        ErrorCode.BRIDGE_DISCONNECTED,
        "Not connected to Godot bridge"
      );
    }

    const json = JSON.stringify(message);
    this.ws!.send(json);
    this.debug("Sent:", message);
  }

  /**
   * Send a message and await a response
   */
  async sendAndWait<T = unknown>(
    message: TheiaToGodotMessage,
    timeout: number = this.config.rpcTimeout
  ): Promise<T> {
    const requestId = this.generateRpcId();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rpcRequests.delete(requestId);
        reject(
          new GodotIntegrationError(
            ErrorCode.RPC_TIMEOUT,
            `RPC request timed out: ${requestId}`
          )
        );
      }, timeout);

      this.rpcRequests.set(requestId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.send({ ...message, id: requestId });
    });
  }

  // ========================================================================
  // RPC Implementation
  // ========================================================================

  /**
   * Call a remote procedure on Godot
   */
  async rpc<T = unknown>(
    method: string,
    ...params: unknown[]
  ): Promise<T> {
    const message: TheiaToGodotMessage = {
      type: "rpc",
      method,
      params,
    };

    const response = (await this.sendAndWait(message)) as RPCResponse;

    if (response.error) {
      throw new GodotIntegrationError(
        "RPC_ERROR",
        response.error,
        { method, params }
      );
    }

    return response.result as T;
  }

  /**
   * Call a method on a specific node
   */
  async callNode<T = unknown>(
    nodePath: string,
    method: string,
    ...params: unknown[]
  ): Promise<T> {
    return this.rpc<T>(method, ...params);
  }

  // ========================================================================
  // Event Handling
  // ========================================================================

  /**
   * Subscribe to a Godot event
   */
  on(event: string, callback: EventCallback): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(callback);

    // Subscribe on Godot side
    if (!this.eventSubscriptions.has(event)) {
      this.eventSubscriptions.add(event);
      this.send({
        type: "subscribe_events",
        events: [event],
      });
    }
  }

  /**
   * Unsubscribe from a Godot event
   */
  off(event: string, callback: EventCallback): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(callback);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Subscribe to an event stream (bi-directional streaming)
   */
  stream(event: string, callback: (data: unknown) => void): () => void {
    if (!this.eventStreams.has(event)) {
      this.eventStreams.set(event, new Set());
    }
    this.eventStreams.get(event)!.add(callback);

    // Subscribe on Godot side
    this.send({
      type: "subscribe_events",
      events: [event],
    });

    // Return unsubscribe function
    return () => {
      const stream = this.eventStreams.get(event);
      if (stream) {
        stream.delete(callback);
      }
    };
  }

  /**
   * Emit an event to Godot
   */
  emit(event: string, data: Record<string, unknown>): void {
    this.send({
      type: "event",
      event_name: event,
      data,
    });
  }

  // ========================================================================
  // Shared State Management
  // ========================================================================

  /**
   * Get a shared state value
   */
  getState(key: string): unknown {
    return this.sharedState.get(key);
  }

  /**
   * Get all shared state
   */
  getAllState(): Map<string, unknown> {
    return new Map(this.sharedState);
  }

  /**
   * Set a shared state value locally
   */
  setState(key: string, value: unknown): void {
    this.sharedState.set(key, value);
  }

  /**
   * Update shared state and sync with Godot
   */
  async updateState(key: string, value: unknown): Promise<void> {
    this.sharedState.set(key, value);
    this.send({
      type: "update_shared_state",
      key,
      value,
    });
  }

  /**
   * Watch for state changes
   */
  watchState(
    key: string,
    callback: (value: unknown, oldValue: unknown) => void
  ): () => void {
    const handler = (data: Record<string, unknown>) => {
      if (data.key === key) {
        const oldValue = this.sharedState.get(key);
        this.sharedState.set(key, data.value);
        callback(data.value, oldValue);
      }
    };

    this.on("shared_state_update", handler);

    return () => this.off("shared_state_update", handler);
  }

  // ========================================================================
  // Scene Management
  // ========================================================================

  /**
   * Load a scene in Godot
   */
  async loadScene(path: string): Promise<boolean> {
    const response = await this.sendAndWait<{ success: boolean }>({
      type: "load_scene",
      path,
    });
    return response.success;
  }

  /**
   * Get the scene tree structure
   */
  async getSceneTree(): Promise<unknown> {
    const response = await this.sendAndWait<{ data: unknown }>({
      type: "get_scene_tree",
    });
    return response.data;
  }

  // ========================================================================
  // Agent Management
  // ========================================================================

  /**
   * Spawn an agent
   */
  async spawnAgent(
    agentType: string,
    position: { x: number; y: number; z: number },
    config: Record<string, unknown> = {}
  ): Promise<string> {
    const response = await this.sendAndWait<{ agent_id: string }>({
      type: "spawn_agent",
      agent_type: agentType,
      position,
      config,
    });
    return response.agent_id;
  }

  /**
   * Despawn an agent
   */
  despawnAgent(agentId: string): void {
    this.send({
      type: "despawn_agent",
      agent_id: agentId,
    });
  }

  /**
   * Get agent state
   */
  async getAgentState(agentId: string): Promise<unknown> {
    return this.sendAndWait({
      type: "get_agent_state",
      agent_id: agentId,
    });
  }

  /**
   * Set agent behavior
   */
  setAgentBehavior(
    agentId: string,
    behavior: string,
    params: Record<string, unknown> = {}
  ): void {
    this.send({
      type: "set_agent_behavior",
      agent_id: agentId,
      behavior,
      params,
    });
  }

  // ========================================================================
  // Educational Content
  // ========================================================================

  /**
   * Start a lesson
   */
  startLesson(lessonId: string): void {
    this.send({
      type: "start_lesson",
      lesson_id: lessonId,
    });
  }

  /**
   * Submit an exercise answer
   */
  submitExercise(exerciseId: string, answer: unknown): void {
    this.send({
      type: "submit_exercise",
      exercise_id: exerciseId,
      answer,
    });
  }

  /**
   * Request a hint
   */
  async requestHint(
    exerciseId: string,
    hintLevel: number = 1
  ): Promise<{ hint: string; remaining_hints?: number }> {
    return this.sendAndWait({
      type: "get_hint",
      exercise_id: exerciseId,
      hint_level: hintLevel,
    });
  }

  // ========================================================================
  // Asset Bundle Management
  // ========================================================================

  /**
   * Load an asset bundle
   */
  async loadAssetBundle(bundleId: string): Promise<{
    success: boolean;
    assets?: string[];
    error?: string;
  }> {
    return this.sendAndWait({
      type: "load_asset_bundle",
      bundle_id: bundleId,
    });
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private handleMessage(data: string): void {
    let message: GodotToTheiaMessage;

    try {
      message = JSON.parse(data);
    } catch (error) {
      this.debug("Failed to parse message:", data);
      return;
    }

    this.debug("Received:", message);

    // Handle RPC responses
    if (message.type === "rpc_response" && message.id) {
      const request = this.rpcRequests.get(message.id);
      if (request) {
        this.rpcRequests.delete(message.id);
        if (message.error) {
          request.reject(new Error(message.error));
        } else {
          request.resolve(message.result);
        }
        return;
      }
    }

    // Handle shared state updates
    if (message.type === "shared_state_update") {
      this.sharedState.set(message.key, message.value);
    }

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message as unknown as Record<string, unknown>);
        } catch (error) {
          this.debug("Handler error:", error);
        }
      }
    }

    // Call event stream callbacks
    if (message.type === "event") {
      const streams = this.eventStreams.get(message.event_name);
      if (streams) {
        for (const callback of streams) {
          try {
            callback(message.data);
          } catch (error) {
            this.debug("Stream callback error:", error);
          }
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.debug("Max reconnect attempts reached");
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.debug(
        `Reconnecting... (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
      );
      this.connect().catch(() => {
        // Error already handled in connect()
      });
    }, this.config.reconnectInterval);
  }

  private flushQueue(): void {
    for (const message of this.queuedMessages) {
      this.send(message);
    }
    this.queuedMessages = [];
  }

  private resubscribeEvents(): void {
    if (this.eventSubscriptions.size > 0) {
      this.send({
        type: "subscribe_events",
        events: Array.from(this.eventSubscriptions),
      });
    }
  }

  private generateRpcId(): string {
    return `rpc_${Date.now()}_${this.nextRpcId++}`;
  }

  private debug(...args: unknown[]): void {
    if (this.config.debugLog) {
      console.log("[TheiaBridgeClient]", ...args);
    }
  }
}

// ==============================================================================
// Type Definitions
// ==============================================================================

interface RPCRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface RPCResponse {
  type: "rpc_response";
  request_id: string;
  result?: unknown;
  error?: string;
}

// ==============================================================================
// Factory Functions
// ==============================================================================

/**
 * Create a connected bridge client
 */
export async function createBridge(
  config: Partial<TheiaBridgeConfig> = {}
): Promise<TheiaBridgeClient> {
  const client = new TheiaBridgeClient({ ...DEFAULT_CONFIG, ...config });
  await client.connect();
  return client;
}

/**
 * Create a bridge client without auto-connecting
 */
export function createBridgeClient(
  config: Partial<TheiaBridgeConfig> = {}
): TheiaBridgeClient {
  return new TheiaBridgeClient({ ...DEFAULT_CONFIG, ...config });
}
