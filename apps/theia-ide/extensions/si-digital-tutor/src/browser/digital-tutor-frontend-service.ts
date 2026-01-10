/**
 * StudyLoG.AI - Digital Tutor Frontend Service
 *
 * Handles API communication for Digital Tutor features:
 * - Agent management
 * - Session management
 * - Interaction with digital humans
 * - Audio2Face WebSocket connection
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  TutorPersonality,
  AgentConfig,
  InteractionRequest,
  InteractionResponse,
  SessionInfo,
  DigitalTutorConfig,
  TutorMessage,
  API_ENDPOINTS,
  DEFAULT_CONFIG,
  VoiceModel,
  AvatarModel,
  TutorEmotion,
  AnimationFrame,
} from '../common';

@injectable()
export class DigitalTutorFrontendService {
  private apiBase: string;
  private activeSessionId: string | null = null;
  private currentAgentId: string | null = null;
  private audio2FaceWebSocket: WebSocket | null = null;
  private onAnimationFrameCallbacks: ((frames: AnimationFrame[]) => void)[] = [];

  constructor() {
    // API base URL - can be configured via environment variable
    this.apiBase = typeof process !== 'undefined' && process.env?.DIGITAL_TUTOR_API_BASE
      ? process.env.DIGITAL_TUTOR_API_BASE
      : API_ENDPOINTS.BASE;
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  /**
   * Get all available agents
   */
  async getAgents(): Promise<AgentConfig[]> {
    const response = await fetch(`${this.apiBase}/agents`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Failed to get agents: ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; data: AgentConfig[] };
    return data.data || [];
  }

  /**
   * Register a new agent
   */
  async registerAgent(config: {
    agentId: string;
    personality: TutorPersonality;
    voiceModel?: VoiceModel;
    avatarModel?: AvatarModel;
    systemPrompt?: string;
  }): Promise<AgentConfig> {
    const response = await fetch(`${this.apiBase}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to register agent: ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; data: AgentConfig };
    return data.data;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/agents/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete agent: ${response.statusText}`);
    }
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Create a new session with an agent
   */
  async createSession(agentId: string, userId: string): Promise<SessionInfo> {
    const response = await fetch(`${this.apiBase}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId, userId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; data: SessionInfo };
    this.activeSessionId = data.data.sessionId;
    this.currentAgentId = agentId;
    return data.data;
  }

  /**
   * Get user's sessions
   */
  async getSessions(userId: string): Promise<SessionInfo[]> {
    const response = await fetch(`${this.apiBase}/sessions/${encodeURIComponent(userId)}`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get sessions: ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; data: { sessions: SessionInfo[] } };
    return data.data.sessions || [];
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    if (!this.activeSessionId) return;

    const response = await fetch(`${this.apiBase}/sessions/${encodeURIComponent(this.activeSessionId)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to end session: ${response.statusText}`);
    }

    this.activeSessionId = null;
    this.currentAgentId = null;
  }

  /**
   * Get active session ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  // ============================================================================
  // Interaction
  // ============================================================================

  /**
   * Send message to agent and get response
   */
  async interact(request: InteractionRequest): Promise<InteractionResponse> {
    const response = await fetch(`${this.apiBase}/interact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Interaction failed: ${response.statusText}`);
    }

    const data = await response.json() as { success: boolean; data: InteractionResponse };
    return data.data;
  }

  /**
   * Quick interact with default agent
   */
  async chat(input: string, userId: string): Promise<InteractionResponse> {
    // Create session if needed
    if (!this.activeSessionId) {
      await this.createSession('tutor-1', userId);
    }

    return this.interact({
      agentId: this.currentAgentId || 'tutor-1',
      input,
      sessionId: this.activeSessionId || undefined,
      userId,
      enableAnimation: true,
      enableAudio: true,
    });
  }

  // ============================================================================
  // Audio2Face WebSocket
  // ============================================================================

  /**
   * Connect to Audio2Face WebSocket for real-time animation
   */
  async connectAudio2Face(onAnimationFrame: (frames: AnimationFrame[]) => void): Promise<void> {
    // Get WebSocket config
    const configResponse = await fetch(`${this.apiBase}/audio2face/config`);
    if (!configResponse.ok) {
      throw new Error(`Failed to get Audio2Face config: ${configResponse.statusText}`);
    }

    const config = await configResponse.json() as { success: boolean; data: { wsUrl: string } };
    const wsUrl = config.data.wsUrl;

    return new Promise((resolve, reject) => {
      this.audio2FaceWebSocket = new WebSocket(wsUrl);

      this.audio2FaceWebSocket.onopen = () => {
        console.log('[DigitalTutor] Audio2Face WebSocket connected');
        // Register the callback
        this.onAnimationFrameCallbacks.push(onAnimationFrame);
        resolve();
      };

      this.audio2FaceWebSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'animation_data') {
            for (const callback of this.onAnimationFrameCallbacks) {
              callback(message.data.frames);
            }
          }
        } catch (error) {
          console.error('[DigitalTutor] Failed to parse WebSocket message:', error);
        }
      };

      this.audio2FaceWebSocket.onerror = (error) => {
        console.error('[DigitalTutor] Audio2Face WebSocket error:', error);
        reject(error);
      };

      this.audio2FaceWebSocket.onclose = () => {
        console.log('[DigitalTutor] Audio2Face WebSocket disconnected');
      };
    });
  }

  /**
   * Disconnect from Audio2Face WebSocket
   */
  disconnectAudio2Face(): void {
    if (this.audio2FaceWebSocket) {
      this.audio2FaceWebSocket.close();
      this.audio2FaceWebSocket = null;
      this.onAnimationFrameCallbacks = [];
    }
  }

  /**
   * Stream audio for real-time animation
   */
  streamAudio(audioData: ArrayBuffer): void {
    if (!this.audio2FaceWebSocket || this.audio2FaceWebSocket.readyState !== WebSocket.OPEN) {
      console.warn('[DigitalTutor] Audio2Face WebSocket not connected');
      return;
    }

    // Convert ArrayBuffer to base64 for WebSocket transmission
    const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));

    this.audio2FaceWebSocket.send(JSON.stringify({
      type: 'audio_chunk',
      data: {
        audio: base64,
        isFinal: false,
      },
    }));
  }

  /**
   * Set emotion for the avatar
   */
  setAvatarEmotion(emotion: TutorEmotion, intensity = 1.0): void {
    if (!this.audio2FaceWebSocket || this.audio2FaceWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.audio2FaceWebSocket.send(JSON.stringify({
      type: 'emotion_control',
      data: {
        emotion,
        intensity,
        duration: 0.5,
      },
    }));
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get default configuration
   */
  getDefaultConfig(): DigitalTutorConfig {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Load configuration from preferences
   */
  async loadConfig(): Promise<DigitalTutorConfig> {
    // In a real implementation, this would load from Theia preferences
    // For now, return defaults
    return this.getDefaultConfig();
  }

  /**
   * Save configuration to preferences
   */
  async saveConfig(config: Partial<DigitalTutorConfig>): Promise<void> {
    // In a real implementation, this would save to Theia preferences
    console.log('[DigitalTutor] Saving config:', config);
  }

  // ============================================================================
  // Voice Utilities
  // ============================================================================

  /**
   * Convert audio blob to ArrayBuffer
   */
  async audioBlobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return blob.arrayBuffer();
  }

  /**
   * Get supported MIME type for MediaRecorder
   */
  getSupportedMimeType(): string {
    const mimeTypes = ['audio/webm', 'audio/ogg', 'audio/wav'];
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }
}
