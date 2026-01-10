/**
 * Godot Panel Widget
 *
 * Main widget that embeds Godot game engine in Theia.
 * Uses iframe for Web export or X11 embedding for native.
 */

import * as React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { GodotWebSocketService } from './godot-websocket';
import { Message } from '@theia/core/lib/browser/widgets/widget';

export interface GodotState {
  connected: boolean;
  fps: number;
  agents: number;
  lastMessage: string;
}

@injectable()
export class GodotPanelWidget extends ReactWidget {
  static readonly ID = 'si-godot-panel:widget';
  static readonly LABEL = 'Godot Panel';

  @inject(GodotWebSocketService)
  protected readonly websocket: GodotWebSocketService;

  protected state: GodotState = {
    connected: false,
    fps: 0,
    agents: 0,
    lastMessage: '',
  };

  constructor() {
    super();
    this.id = GodotPanelWidget.ID;
    this.title.label = GodotPanelWidget.LABEL;
    this.title.caption = 'Live Godot Engine Panel';
    this.title.iconClass = 'fa fa-gamepad';
    this.addClass('si-godot-panel');
  }

  protected async onAfterAttach(msg: Message): Promise<void> {
    super.onAfterAttach(msg);

    // Connect to Godot WebSocket
    this.websocket.onMessage((data) => this.handleGodotMessage(data));
    await this.websocket.connect();

    this.setState({ connected: true });
  }

  protected async onBeforeDetach(msg: Message): Promise<void> {
    await this.websocket.disconnect();
    super.onBeforeDetach(msg);
  }

  private handleGodotMessage(data: unknown): void {
    const message = data as GodotMessage;
    switch (message.type) {
      case 'stats':
        this.setState({
          fps: message.fps || 0,
          agents: message.agents || 0,
        });
        break;
      case 'log':
        console.log('[Godot]', message.content);
        this.setState({ lastMessage: message.content || '' });
        break;
      case 'agent_event':
        // Handle agent position updates, actions, etc.
        break;
    }
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-godot-panel-container">
        <div className="godot-header">
          <div className="godot-status">
            <span className={`status-indicator ${this.state.connected ? 'connected' : 'disconnected'}`} />
            <span>{this.state.connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="godot-stats">
            <span>FPS: {this.state.fps}</span>
            <span>Agents: {this.state.agents}</span>
          </div>
        </div>

        {/* Godot iframe or canvas */}
        <div className="godot-viewport">
          {this.state.connected ? (
            <iframe
              id="godot-frame"
              src="http://localhost:7352/godot/index.html"
              sandbox="allow-scripts allow-same-origin allow-popups"
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className="godot-placeholder">
              <p>Godot Engine - Starting...</p>
              <button onClick={() => this.websocket.connect()}>Reconnect</button>
            </div>
          )}
        </div>

        {/* Agent list sidebar */}
        <div className="godot-sidebar">
          <h3>Active Agents</h3>
          <ul id="agent-list">
            <li className="agent-item">
              <span className="agent-name">Captain</span>
              <span className="agent-status">Idle</span>
            </li>
            <li className="agent-item">
              <span className="agent-name">Deckhand</span>
              <span className="agent-status">Working</span>
            </li>
          </ul>
        </div>
      </div>
    );
  }

  private setState(partial: Partial<GodotState>): void {
    this.state = { ...this.state, ...partial };
    this.update();
  }
}

interface GodotMessage {
  type: 'stats' | 'log' | 'agent_event' | 'hot_reload';
  fps?: number;
  agents?: number;
  content?: string;
  data?: unknown;
}
