/**
 * NVIDIA Audio2Face NIM Microservice Bridge
 *
 * Provides WebSocket-based real-time facial animation streaming
 * using NVIDIA's Audio2Face technology.
 *
 * References:
 * - https://docs.nvidia.com/nim/digital-human/a2f-3d/latest/index.html
 * - https://www.nvidia.com/en-us/omniverse/audio2face/
 *
 * Audio2Face converts audio into facial animation blend shapes,
 * enabling realistic lip-sync and expression for digital avatars.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * WebSocket connection states
 */
export type Audio2FaceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'streaming'
  | 'error'
  | 'closing';

/**
 * Audio2Face NIM message types
 */
export type Audio2FaceMessageType =
  | 'connect'           // Initial connection handshake
  | 'connected'         // Server acknowledgment
  | 'start_stream'      // Begin streaming audio
  | 'audio_chunk'       // Audio data chunk
  | 'animation_data'    // Generated animation frames
  | 'emotion_control'   // Emotion override command
  | 'stop_stream'       // End streaming
  | 'heartbeat'         // Keep-alive ping
  | 'error';            // Error message

/**
 * Blend shape value for a specific facial feature
 */
export interface BlendShapeValue {
  /** Blend shape name (e.g., 'jawOpen', 'mouthSmileLeft') */
  name: string;

  /** Blend shape value (0-1) */
  value: number;
}

/**
 * Single animation frame with blend shapes
 */
export interface AnimationFrame {
  /** Frame timestamp (seconds from stream start) */
  timestamp: number;

  /** Blend shape values for this frame */
  blendShapes: BlendShapeValue[];

  /** Optional head rotation */
  headRotation?: {
    x: number;  // Pitch (degrees)
    y: number;  // Yaw (degrees)
    z: number;  // Roll (degrees)
  };

  /** Optional eye gaze */
  eyeGaze?: {
    x: number;  // Horizontal (-1 to 1)
    y: number;  // Vertical (-1 to 1)
  };
}

/**
 * Audio2Face WebSocket message
 */
export interface Audio2FaceMessage {
  /** Message type */
  type: Audio2FaceMessageType;

  /** Request ID for tracking */
  requestId?: string;

  /** Message data (varies by type) */
  data?: unknown;

  /** Timestamp */
  timestamp: number;
}

/**
 * Audio chunk message data
 */
export interface AudioChunkData {
  /** Audio data (base64 encoded or binary) */
  audio: string | ArrayBuffer;

  /** Chunk sequence number */
  sequence: number;

  /** Is this the final chunk? */
  isFinal: boolean;

  /** Sample rate */
  sampleRate: number;

  /** Number of channels */
  channels?: number;
}

/**
 * Animation data message
 */
export interface AnimationDataMessage {
  /** Request ID this animation responds to */
  requestId: string;

  /** Animation frames */
  frames: AnimationFrame[];

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Lip sync confidence score (0-1) */
  confidence?: number;
}

/**
 * Emotion control data
 */
export interface EmotionControlData {
  /** Target emotion */
  emotion: string;

  /** Emotion intensity (0-1) */
  intensity: number;

  /** Transition duration (seconds) */
  duration?: number;
}

/**
 * Error message data
 */
export interface ErrorData {
  /** Error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Additional details */
  details?: unknown;
}

/**
 * Audio2Face connection configuration
 */
export interface Audio2FaceConfig {
  /** WebSocket server URL */
  url: string;

  /** API key for authentication */
  apiKey?: string;

  /** Model identifier to use */
  model?: string;

  /** Target FPS for animation output */
  targetFps?: number;

  /** Enable emotion detection */
  enableEmotion?: boolean;

  /** Enable head motion */
  enableHeadMotion?: boolean;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Reconnect delay in milliseconds */
  reconnectDelay?: number;

  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;

  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
}

/**
 * Animation frame callback
 */
export type AnimationFrameCallback = (frames: AnimationFrame[]) => void;

/**
 * Connection state change callback
 */
export type ConnectionStateCallback = (state: Audio2FaceConnectionState) => void;

/**
 * Error callback
 */
export type ErrorCallback = (error: Error) => void;

// ============================================================================
// Constants
// ============================================================================

/** Default configuration values */
export const AUDIO2FACE_DEFAULTS = {
  /** Default target FPS */
  TARGET_FPS: 30,

  /** Default sample rate */
  SAMPLE_RATE: 24000,

  /** Default channels */
  CHANNELS: 1,

  /** Audio chunk duration (seconds) */
  CHUNK_DURATION: 0.1,

  /** Connection timeout (ms) */
  CONNECTION_TIMEOUT: 10000,

  /** Reconnect delay (ms) */
  RECONNECT_DELAY: 1000,

  /** Maximum reconnect attempts */
  MAX_RECONNECT_ATTEMPTS: 5,

  /** Heartbeat interval (ms) */
  HEARTBEAT_INTERVAL: 30000,

  /** Maximum pending chunks */
  MAX_PENDING_CHUNKS: 10,
} as const;

/** ARKit blend shape names for facial animation */
export const ARKIT_BLENDSHAPES = [
  // Eyes
  'eyeBlinkLeft', 'eyeBlinkRight',
  'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight',

  // Eyebrows
  'browDownLeft', 'browDownRight',
  'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',

  // Mouth
  'mouthClose', 'mouthFunnel', 'mouthPucker',
  'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight',
  'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight',
  'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper',
  'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight',
  'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',

  // Jaw
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',

  // Nose
  'noseSneerLeft', 'noseSneerRight',

  // Cheeks
  'cheekSquintLeft', 'cheekSquintRight',

  // Tongue
  'tongueOut',
] as const;

/** Audio2Face message type validation */
export const VALID_MESSAGE_TYPES: Audio2FaceMessageType[] = [
  'connect', 'connected', 'start_stream', 'audio_chunk',
  'animation_data', 'emotion_control', 'stop_stream',
  'heartbeat', 'error'
];

// ============================================================================
// Errors
// ============================================================================

/**
 * Base error class for Audio2Face errors
 */
export class Audio2FaceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'Audio2FaceError';
  }
}

/**
 * Connection error
 */
export class Audio2FaceConnectionError extends Audio2FaceError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'Audio2FaceConnectionError';
  }
}

/**
 * Streaming error
 */
export class Audio2FaceStreamError extends Audio2FaceError {
  constructor(message: string, details?: unknown) {
    super(message, 'STREAM_ERROR', details);
    this.name = 'Audio2FaceStreamError';
  }
}

/**
 * Authentication error
 */
export class Audio2FaceAuthError extends Audio2FaceError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'Audio2FaceAuthError';
  }
}

// ============================================================================
// Audio2Face Bridge Class
// ============================================================================

/**
 * Audio2Face NIM WebSocket Bridge
 *
 * Manages WebSocket connection to NVIDIA Audio2Face NIM microservice
 * for real-time audio-driven facial animation.
 */
export class Audio2FaceBridge {
  private ws: WebSocket | null = null;
  private connectionState: Audio2FaceConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingChunks: Map<number, AudioChunkData> = new Map();
  private nextSequence = 0;
  private streamStartTime = 0;
  private callbacks = {
    onAnimationFrames: [] as AnimationFrameCallback[],
    onConnectionState: [] as ConnectionStateCallback[],
    onError: [] as ErrorCallback[],
  };

  /**
   * Create a new Audio2Face bridge
   *
   * @param config - Bridge configuration
   */
  constructor(private config: Audio2FaceConfig) {
    this.config = {
      ...config,
      targetFps: config.targetFps || AUDIO2FACE_DEFAULTS.TARGET_FPS,
      autoReconnect: config.autoReconnect ?? true,
      reconnectDelay: config.reconnectDelay || AUDIO2FACE_DEFAULTS.RECONNECT_DELAY,
      maxReconnectAttempts: config.maxReconnectAttempts || AUDIO2FACE_DEFAULTS.MAX_RECONNECT_ATTEMPTS,
      connectionTimeout: config.connectionTimeout || AUDIO2FACE_DEFAULTS.CONNECTION_TIMEOUT,
    };
  }

  /**
   * Connect to Audio2Face NIM microservice
   *
   * @returns Promise that resolves when connected
   * @throws {Audio2FaceConnectionError} If connection fails
   */
  async connect(): Promise<void> {
    if (this.connectionState === 'connected' || this.connectionState === 'streaming') {
      return;
    }

    if (this.connectionState === 'connecting') {
      // Already connecting, wait for it
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.connectionState === 'connected') {
            clearInterval(checkInterval);
            resolve();
          } else if (this.connectionState === 'error') {
            clearInterval(checkInterval);
            reject(new Audio2FaceConnectionError('Connection failed'));
          }
        }, 100);
      });
    }

    this.setState('connecting');

    try {
      const wsUrl = this.buildWebSocketUrl();
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();

      // Wait for connection with timeout
      await this.waitForConnection(this.config.connectionTimeout || AUDIO2FACE_DEFAULTS.CONNECTION_TIMEOUT);

      // Send connect message
      this.sendMessage({
        type: 'connect',
        data: {
          apiKey: this.config.apiKey,
          model: this.config.model,
          targetFps: this.config.targetFps,
          enableEmotion: this.config.enableEmotion,
          enableHeadMotion: this.config.enableHeadMotion,
        },
        timestamp: Date.now(),
      });

      this.startHeartbeat();
      this.reconnectAttempts = 0;

    } catch (error) {
      this.setState('error');
      throw new Audio2FaceConnectionError(
        `Failed to connect: ${(error as Error).message}`,
        error
      );
    }
  }

  /**
   * Disconnect from Audio2Face NIM microservice
   */
  disconnect(): void {
    this.setState('closing');

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    this.pendingChunks.clear();
  }

  /**
   * Start streaming audio for animation
   *
   * @returns Request ID for this stream
   */
  startStream(): string {
    if (this.connectionState !== 'connected') {
      throw new Audio2FaceStreamError('Not connected. Call connect() first.');
    }

    const requestId = crypto.randomUUID();
    this.streamStartTime = Date.now();
    this.nextSequence = 0;

    this.sendMessage({
      type: 'start_stream',
      requestId,
      data: {
        sampleRate: AUDIO2FACE_DEFAULTS.SAMPLE_RATE,
        channels: AUDIO2FACE_DEFAULTS.CHANNELS,
        targetFps: this.config.targetFps,
      },
      timestamp: Date.now(),
    });

    this.setState('streaming');
    return requestId;
  }

  /**
   * Stream an audio chunk for animation
   *
   * @param audioData - Audio data (ArrayBuffer or base64 string)
   * @param isFinal - Whether this is the final chunk
   */
  streamAudio(audioData: ArrayBuffer | string, isFinal = false): void {
    if (this.connectionState !== 'streaming') {
      throw new Audio2FaceStreamError('Not streaming. Call startStream() first.');
    }

    const sequence = this.nextSequence++;

    // Track pending chunk
    const chunkData: AudioChunkData = {
      audio: audioData,
      sequence,
      isFinal,
      sampleRate: AUDIO2FACE_DEFAULTS.SAMPLE_RATE,
      channels: AUDIO2FACE_DEFAULTS.CHANNELS,
    };

    this.pendingChunks.set(sequence, chunkData);

    // Limit pending chunks
    if (this.pendingChunks.size > AUDIO2FACE_DEFAULTS.MAX_PENDING_CHUNKS) {
      const oldestSeq = Math.min(...this.pendingChunks.keys());
      this.pendingChunks.delete(oldestSeq);
    }

    this.sendMessage({
      type: 'audio_chunk',
      data: chunkData,
      timestamp: Date.now() - this.streamStartTime,
    });
  }

  /**
   * Stop the current stream
   */
  stopStream(): void {
    if (this.connectionState !== 'streaming') {
      return;
    }

    this.sendMessage({
      type: 'stop_stream',
      timestamp: Date.now() - this.streamStartTime,
    });

    this.setState('connected');
    this.pendingChunks.clear();
  }

  /**
   * Set emotion for the avatar
   *
   * @param emotion - Target emotion
   * @param intensity - Emotion intensity (0-1)
   * @param duration - Transition duration in seconds
   */
  setEmotion(emotion: string, intensity = 1.0, duration = 0.5): void {
    if (this.connectionState !== 'streaming' && this.connectionState !== 'connected') {
      throw new Audio2FaceStreamError('Not connected or streaming');
    }

    this.sendMessage({
      type: 'emotion_control',
      data: {
        emotion,
        intensity,
        duration,
      } as EmotionControlData,
      timestamp: Date.now() - this.streamStartTime,
    });
  }

  /**
   * Register callback for animation frames
   *
   * @param callback - Function to call when animation frames arrive
   * @returns Unsubscribe function
   */
  onAnimationFrames(callback: AnimationFrameCallback): () => void {
    this.callbacks.onAnimationFrames.push(callback);
    return () => {
      const index = this.callbacks.onAnimationFrames.indexOf(callback);
      if (index > -1) {
        this.callbacks.onAnimationFrames.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for connection state changes
   *
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function
   */
  onConnectionState(callback: ConnectionStateCallback): () => void {
    this.callbacks.onConnectionState.push(callback);
    // Immediately call with current state
    callback(this.connectionState);
    return () => {
      const index = this.callbacks.onConnectionState.indexOf(callback);
      if (index > -1) {
        this.callbacks.onConnectionState.splice(index, 1);
      }
    };
  }

  /**
   * Register callback for errors
   *
   * @param callback - Function to call on errors
   * @returns Unsubscribe function
   */
  onError(callback: ErrorCallback): () => void {
    this.callbacks.onError.push(callback);
    return () => {
      const index = this.callbacks.onError.indexOf(callback);
      if (index > -1) {
        this.callbacks.onError.splice(index, 1);
      }
    };
  }

  /**
   * Get current connection state
   */
  getState(): Audio2FaceConnectionState {
    return this.connectionState;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Build WebSocket URL from config
   */
  private buildWebSocketUrl(): string {
    const url = new URL(this.config.url);
    // Convert to WebSocket protocol
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${url.host}${url.pathname}`;

    // Add query parameters
    const params = new URLSearchParams();
    if (this.config.model) {
      params.set('model', this.config.model);
    }
    if (this.config.apiKey) {
      params.set('api_key', this.config.apiKey);
    }

    const queryString = params.toString();
    return queryString ? `${wsUrl}?${queryString}` : wsUrl;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.setState('connected');
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (error) => {
      this.handleError(new Audio2FaceConnectionError('WebSocket error', error));
    };

    this.ws.onclose = (event) => {
      this.setState('disconnected');

      // Auto-reconnect if enabled
      if (
        this.config.autoReconnect &&
        this.reconnectAttempts < (this.config.maxReconnectAttempts || AUDIO2FACE_DEFAULTS.MAX_RECONNECT_ATTEMPTS)
      ) {
        this.scheduleReconnect();
      }
    };
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string | ArrayBuffer): void {
    try {
      const message: Audio2FaceMessage = typeof data === 'string'
        ? JSON.parse(data)
        : JSON.parse(new TextDecoder().decode(data));

      this.validateMessage(message);

      switch (message.type) {
        case 'connected':
          // Connection acknowledged
          break;

        case 'animation_data':
          this.handleAnimationData(message.data as AnimationDataMessage);
          break;

        case 'error':
          this.handleServerError(message.data as ErrorData);
          break;

        case 'heartbeat':
          // Respond to heartbeat
          this.sendMessage({
            type: 'heartbeat',
            timestamp: Date.now(),
          });
          break;
      }
    } catch (error) {
      this.handleError(new Audio2FaceError(
        `Failed to handle message: ${(error as Error).message}`,
        'MESSAGE_ERROR',
        error
      ));
    }
  }

  /**
   * Handle animation data message
   */
  private handleAnimationData(data: AnimationDataMessage): void {
    // Notify all callbacks
    for (const callback of this.callbacks.onAnimationFrames) {
      try {
        callback(data.frames);
      } catch (error) {
        console.error('[Audio2Face] Animation frame callback error:', error);
      }
    }

    // Remove acknowledged chunks
    // In a real implementation, we'd track which chunks generated which frames
  }

  /**
   * Handle server error message
   */
  private handleServerError(data: ErrorData): void {
    const error = new Audio2FaceError(data.message, data.code, data.details);
    this.handleError(error);
  }

  /**
   * Send a message through WebSocket
   */
  private sendMessage(message: Audio2FaceMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Audio2FaceConnectionError('WebSocket not connected');
    }

    const json = JSON.stringify(message);
    this.ws.send(json);
  }

  /**
   * Wait for WebSocket connection with timeout
   */
  private waitForConnection(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Audio2FaceConnectionError('Connection timeout'));
      }, timeout);

      const checkState = () => {
        if (this.connectionState === 'connected') {
          clearTimeout(timer);
          resolve();
        } else if (this.connectionState === 'error') {
          clearTimeout(timer);
          reject(new Audio2FaceConnectionError('Connection failed'));
        } else {
          setTimeout(checkState, 50);
        }
      };

      checkState();
    });
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = (this.config.reconnectDelay || AUDIO2FACE_DEFAULTS.RECONNECT_DELAY)
      * Math.pow(1.5, this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        this.handleError(error);
      });
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: 'heartbeat',
          timestamp: Date.now(),
        });
      }
    }, AUDIO2FACE_DEFAULTS.HEARTBEAT_INTERVAL);
  }

  /**
   * Validate message structure
   */
  private validateMessage(message: Audio2FaceMessage): void {
    if (!message.type) {
      throw new Audio2FaceError('Message missing type', 'INVALID_MESSAGE');
    }

    if (!VALID_MESSAGE_TYPES.includes(message.type)) {
      throw new Audio2FaceError(
        `Invalid message type: ${message.type}`,
        'INVALID_MESSAGE_TYPE'
      );
    }

    if (typeof message.timestamp !== 'number') {
      throw new Audio2FaceError('Message missing timestamp', 'INVALID_MESSAGE');
    }
  }

  /**
   * Update connection state and notify callbacks
   */
  private setState(state: Audio2FaceConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      for (const callback of this.callbacks.onConnectionState) {
        try {
          callback(state);
        } catch (error) {
          console.error('[Audio2Face] State callback error:', error);
        }
      }
    }
  }

  /**
   * Handle and report errors
   */
  private handleError(error: Error): void {
    for (const callback of this.callbacks.onError) {
      try {
        callback(error);
      } catch (e) {
        console.error('[Audio2Face] Error callback error:', e);
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a default Audio2Face configuration
 *
 * @param url - WebSocket server URL
 * @param apiKey - Optional API key
 * @returns Default configuration
 */
export function createDefaultConfig(
  url: string,
  apiKey?: string
): Audio2FaceConfig {
  return {
    url,
    apiKey,
    targetFps: AUDIO2FACE_DEFAULTS.TARGET_FPS,
    enableEmotion: true,
    enableHeadMotion: true,
    autoReconnect: true,
  };
}

/**
 * Convert ARKit blend shapes to a simple object
 *
 * @param blendShapes - Array of blend shape values
 * @returns Object mapping names to values
 */
export function blendShapesToObject(
  blendShapes: BlendShapeValue[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const bs of blendShapes) {
    result[bs.name] = bs.value;
  }
  return result;
}

/**
 * Interpolate between two animation frames
 *
 * @param frame1 - First frame
 * @param frame2 - Second frame
 * @param t - Interpolation factor (0-1)
 * @returns Interpolated frame
 */
export function interpolateFrames(
  frame1: AnimationFrame,
  frame2: AnimationFrame,
  t: number
): AnimationFrame {
  const blendShapeMap = new Map<string, number>();

  // Add all blend shapes from frame1
  for (const bs of frame1.blendShapes) {
    blendShapeMap.set(bs.name, bs.value);
  }

  // Interpolate with frame2
  for (const bs of frame2.blendShapes) {
    const value1 = blendShapeMap.get(bs.name) || 0;
    blendShapeMap.set(bs.name, value1 + (bs.value - value1) * t);
  }

  // Convert back to array
  const blendShapes: BlendShapeValue[] = [];
  for (const [name, value] of blendShapeMap.entries()) {
    blendShapes.push({ name, value });
  }

  return {
    timestamp: frame1.timestamp + (frame2.timestamp - frame1.timestamp) * t,
    blendShapes,
    headRotation: frame1.headRotation && frame2.headRotation
      ? {
          x: frame1.headRotation.x + (frame2.headRotation.x - frame1.headRotation.x) * t,
          y: frame1.headRotation.y + (frame2.headRotation.y - frame1.headRotation.y) * t,
          z: frame1.headRotation.z + (frame2.headRotation.z - frame1.headRotation.z) * t,
        }
      : frame1.headRotation,
    eyeGaze: frame1.eyeGaze && frame2.eyeGaze
      ? {
          x: frame1.eyeGaze.x + (frame2.eyeGaze.x - frame1.eyeGaze.x) * t,
          y: frame1.eyeGaze.y + (frame2.eyeGaze.y - frame1.eyeGaze.y) * t,
        }
      : frame1.eyeGaze,
  };
}
