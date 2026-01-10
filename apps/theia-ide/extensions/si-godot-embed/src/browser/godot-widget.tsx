/**
 * StudyLoG.AI - Godot Widget
 *
 * Embeds Godot as WebGL context in a Theia panel.
 * Communicates via WebSocket to Godot process.
 */

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import {
  GODOT_WIDGET_ID,
  GODOT_WIDGET_LABEL,
  GodotState,
  GodotToTheiaMessage,
  TheiaToGodotMessage,
  GameState,
  DEFAULT_GODOT_CONFIG,
} from '../common';

@injectable()
export class GodotWidget extends ReactWidget {
  static readonly ID = GODOT_WIDGET_ID;
  static readonly LABEL = GODOT_WIDGET_LABEL;

  @inject(MessageService)
  protected readonly messageService: MessageService;

  private canvasRef = React.createRef<HTMLCanvasElement>();
  private iframeRef = React.createRef<HTMLIFrameElement>();
  private websocket: WebSocket | null = null;
  private state: GodotState = 'stopped';
  private gameState: GameState | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  @postConstruct()
  protected init(): void {
    this.id = GodotWidget.ID;
    this.title.label = GodotWidget.LABEL;
    this.title.caption = 'Godot Game View';
    this.title.closable = true;
    this.title.iconClass = 'fa fa-gamepad';
    this.addClass('si-godot-widget');
    this.update();
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-godot-container">
        {this.renderToolbar()}
        {this.renderGameView()}
        {this.renderStatusBar()}
      </div>
    );
  }

  private renderToolbar(): React.ReactNode {
    return (
      <div className="si-godot-toolbar">
        <button
          className="theia-button"
          onClick={() => this.handleStart()}
          disabled={this.state === 'running'}
          title="Start Game"
        >
          <i className="fa fa-play" />
        </button>
        <button
          className="theia-button"
          onClick={() => this.handlePause()}
          disabled={this.state !== 'running'}
          title="Pause"
        >
          <i className="fa fa-pause" />
        </button>
        <button
          className="theia-button"
          onClick={() => this.handleReload()}
          disabled={this.state !== 'running'}
          title="Reload Scene"
        >
          <i className="fa fa-refresh" />
        </button>
        <button
          className="theia-button"
          onClick={() => this.handleStop()}
          disabled={this.state === 'stopped'}
          title="Stop"
        >
          <i className="fa fa-stop" />
        </button>
        <span className="si-godot-spacer" />
        <select
          className="theia-select"
          onChange={(e) => this.handleModuleChange(e.target.value)}
          title="Select Module"
        >
          <option value="cognitive-mill">Cognitive Mill</option>
          <option value="sitka-sound">Sitka Sound</option>
          <option value="intelligence-ranch">Intelligence Ranch</option>
        </select>
      </div>
    );
  }

  private renderGameView(): React.ReactNode {
    // Use iframe for WebGL embedding (Godot HTML5 export)
    // Alternative: Direct WebGL canvas for more control
    if (this.state === 'stopped') {
      return (
        <div className="si-godot-placeholder">
          <div className="si-godot-placeholder-content">
            <i className="fa fa-gamepad fa-3x" />
            <p>Click Play to start the game</p>
            <p className="si-godot-hint">
              Or select a module from the dropdown
            </p>
          </div>
        </div>
      );
    }

    if (this.state === 'starting') {
      return (
        <div className="si-godot-loading">
          <div className="si-godot-spinner" />
          <p>Loading Godot...</p>
        </div>
      );
    }

    if (this.state === 'error') {
      return (
        <div className="si-godot-error">
          <i className="fa fa-exclamation-triangle fa-3x" />
          <p>Failed to connect to Godot</p>
          <button className="theia-button" onClick={() => this.handleStart()}>
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="si-godot-game-container">
        <iframe
          ref={this.iframeRef}
          className="si-godot-iframe"
          src={this.getGodotUrl()}
          title="Godot Game"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        />
        {/* Alternative: Direct canvas for WebGL */}
        {/* <canvas ref={this.canvasRef} className="si-godot-canvas" /> */}
      </div>
    );
  }

  private renderStatusBar(): React.ReactNode {
    return (
      <div className="si-godot-statusbar">
        <span className={`si-godot-status si-godot-status-${this.state}`}>
          {this.getStatusIcon()} {this.getStatusText()}
        </span>
        {this.gameState && (
          <>
            <span className="si-godot-scene">
              Scene: {this.gameState.scene}
            </span>
            <span className="si-godot-stage">
              Stage: {this.gameState.stage}
            </span>
          </>
        )}
      </div>
    );
  }

  private getStatusIcon(): string {
    switch (this.state) {
      case 'stopped': return '⬤';
      case 'starting': return '◐';
      case 'running': return '●';
      case 'error': return '⚠';
      default: return '○';
    }
  }

  private getStatusText(): string {
    switch (this.state) {
      case 'stopped': return 'Stopped';
      case 'starting': return 'Starting...';
      case 'running': return 'Running';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  }

  private getGodotUrl(): string {
    // URL to Godot HTML5 export or WebSocket bridge
    const config = DEFAULT_GODOT_CONFIG;
    return `http://localhost:${config.port}/game.html`;
  }

  // WebSocket connection to Godot
  private connectToGodot(): void {
    const config = DEFAULT_GODOT_CONFIG;
    const wsUrl = `ws://localhost:${config.port}/ws`;

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.state = 'running';
        this.reconnectAttempts = 0;
        this.update();
        this.messageService.info('Connected to Godot');
      };

      this.websocket.onmessage = (event) => {
        this.handleGodotMessage(JSON.parse(event.data));
      };

      this.websocket.onerror = (error) => {
        console.error('Godot WebSocket error:', error);
        this.handleConnectionError();
      };

      this.websocket.onclose = () => {
        if (this.state === 'running') {
          this.handleConnectionError();
        }
      };
    } catch (error) {
      console.error('Failed to connect to Godot:', error);
      this.handleConnectionError();
    }
  }

  private handleConnectionError(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => this.connectToGodot(), delay);
    } else {
      this.state = 'error';
      this.update();
      this.messageService.error('Failed to connect to Godot');
    }
  }

  private handleGodotMessage(message: GodotToTheiaMessage): void {
    switch (message.type) {
      case 'ready':
        this.messageService.info('Godot is ready');
        break;

      case 'scene_loaded':
        this.gameState = message.payload as GameState;
        this.update();
        break;

      case 'game_state':
        this.gameState = message.payload as GameState;
        this.update();
        break;

      case 'log':
        console.log('[Godot]', message.payload);
        break;

      case 'error':
        this.messageService.error(`Godot error: ${message.payload}`);
        break;
    }
  }

  private sendToGodot(message: TheiaToGodotMessage): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  // Public API
  public async loadScene(scenePath: string): Promise<void> {
    this.sendToGodot({
      type: 'load_scene',
      payload: { path: scenePath },
      requestId: crypto.randomUUID(),
    });
  }

  public setGameState(variables: Record<string, unknown>): void {
    this.sendToGodot({
      type: 'set_state',
      payload: variables,
    });
  }

  public pause(): void {
    this.sendToGodot({ type: 'pause' });
  }

  public resume(): void {
    this.sendToGodot({ type: 'resume' });
  }

  public reload(): void {
    this.sendToGodot({ type: 'reload' });
  }

  // UI handlers
  private handleStart(): void {
    this.state = 'starting';
    this.update();
    // In a real implementation, this would start the Godot process
    // For now, just try to connect
    setTimeout(() => this.connectToGodot(), 500);
  }

  private handlePause(): void {
    if (this.gameState?.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  private handleReload(): void {
    this.reload();
  }

  private handleStop(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.state = 'stopped';
    this.gameState = null;
    this.update();
  }

  private handleModuleChange(module: string): void {
    const scenePaths: Record<string, string> = {
      'cognitive-mill': 'res://modules/cognitive_mill/main.tscn',
      'sitka-sound': 'res://modules/sitka_sound/main.tscn',
      'intelligence-ranch': 'res://modules/intelligence_ranch/main.tscn',
    };

    if (this.state === 'running') {
      this.loadScene(scenePaths[module] || scenePaths['cognitive-mill']);
    }
  }

  dispose(): void {
    this.handleStop();
    super.dispose();
  }
}
