/**
 * Godot WebSocket Service
 *
 * Manages WebSocket connection between Theia and embedded Godot engine.
 * Supports bidirectional messaging and hot-reload notifications.
 */

import { injectable } from '@theia/core/shared/inversify';

export type GodotMessageHandler = (data: unknown) => void;

@injectable()
export class GodotWebSocketService {
  private ws: WebSocket | null = null;
  private handlers: GodotMessageHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  private readonly GODOT_WS_URL = 'ws://localhost:7352/godot';

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.GODOT_WS_URL);

        this.ws.onopen = () => {
          console.log('[GodotWS] Connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handlers.forEach((handler) => handler(data));
          } catch (e) {
            console.error('[GodotWS] Failed to parse message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[GodotWS] Error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[GodotWS] Disconnected');
          this.scheduleReconnect();
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.ws?.close();
    this.ws = null;
  }

  send(type: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    } else {
      console.warn('[GodotWS] Not connected, message dropped:', type);
    }
  }

  onMessage(handler: GodotMessageHandler): void {
    this.handlers.push(handler);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[GodotWS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      console.log(`[GodotWS] Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect().catch(console.error);
    }, delay);
  }

  /**
   * Send hot-reload command to Godot when asset changes
   */
  async hotReloadAsset(assetPath: string): Promise<void> {
    this.send('hot_reload', { path: assetPath });
  }

  /**
   * Update agent position in Godot scene
   */
  async updateAgent(agentId: string, position: { x: number; y: number }): Promise<void> {
    this.send('agent_update', { id: agentId, position });
  }

  /**
   * Send command to Godot from chat/CLI
   */
  async sendCommand(command: string, args: unknown): Promise<void> {
    this.send('command', { command, args });
  }
}
