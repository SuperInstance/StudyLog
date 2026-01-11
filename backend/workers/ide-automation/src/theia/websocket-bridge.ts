/**
 * Theia WebSocket Bridge
 *
 * WebSocket server for real-time IDE communication.
 * Handles bidirectional messaging between Theia and backend.
 */

import type {
  WSMessage,
  WSMessageType,
  Command,
  CommandResult,
  PanelWidget,
  InlineDiffOptions,
} from '../types/index.js';

// ============================================================================
// WebSocket Bridge
// ============================================================================

export interface WebSocketBridgeConfig {
  /** Ping interval (ms) */
  pingInterval?: number;
  /** Message timeout (ms) */
  messageTimeout?: number;
  /** Maximum message size (bytes) */
  maxMessageSize?: number;
}

export class WebSocketBridge {
  private readonly sockets = new Map<string, WebSocket>();
  private readonly subscriptions = new Map<string, Set<string>>();
  private readonly pendingResponses = new Map<string, {
    resolve: (value: WSMessage) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private readonly commands = new Map<string, Command>();
  private pingInterval?: ReturnType<typeof setInterval>;

  constructor(private readonly config: WebSocketBridgeConfig = {}) {}

  /**
   * Handle a WebSocket connection
   */
  handleConnection(socket: WebSocket, requestId: string): void {
    const socketId = `socket_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    socket.onopen = () => {
      this.sockets.set(socketId, socket);
      this.send(socketId, { type: 'event', data: { connected: true }, timestamp: Date.now() });
    };

    socket.onmessage = async (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as WSMessage;
        await this.handleMessage(socketId, message);
      } catch (error) {
        this.send(socketId, {
          type: 'event',
          error: error instanceof Error ? error.message : 'Parse error',
          timestamp: Date.now(),
        });
      }
    };

    socket.onclose = () => {
      this.sockets.delete(socketId);
      // Remove all subscriptions for this socket
      for (const [event, subscribers] of this.subscriptions.entries()) {
        subscribers.delete(socketId);
        if (subscribers.size === 0) {
          this.subscriptions.delete(event);
        }
      }
    };

    socket.onerror = (error) => {
      console.error(`WebSocket error for ${socketId}:`, error);
    };

    // Start ping interval if not already running
    if (!this.pingInterval) {
      this.pingInterval = setInterval(() => {
        this.pingAll();
      }, this.config.pingInterval || 30000);
    }
  }

  /**
   * Register a command
   */
  registerCommand(command: Command): void {
    this.commands.set(command.id, command);
  }

  /**
   * Execute a command
   */
  async executeCommand(
    commandId: string,
    params: Record<string, unknown>,
    socketId?: string
  ): Promise<CommandResult> {
    const command = this.commands.get(commandId);

    if (!command) {
      return {
        success: false,
        error: `Command not found: ${commandId}`,
      };
    }

    try {
      return await command.handler(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Command failed',
      };
    }
  }

  /**
   * Subscribe to an event
   */
  subscribe(socketId: string, event: string): void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    this.subscriptions.get(event)!.add(socketId);
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(socketId: string, event: string): void {
    const subscribers = this.subscriptions.get(event);
    if (subscribers) {
      subscribers.delete(socketId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(event);
      }
    }
  }

  /**
   * Broadcast a message to all subscribers
   */
  async broadcast(event: string, data: unknown): Promise<void> {
    const subscribers = this.subscriptions.get(event);
    if (!subscribers) return;

    const message: WSMessage = {
      type: 'event',
      data: { event, data },
      timestamp: Date.now(),
    };

    for (const socketId of subscribers) {
      this.send(socketId, message);
    }
  }

  /**
   * Send a message to a specific socket
   */
  send(socketId: string, message: WSMessage): boolean {
    const socket = this.sockets.get(socketId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send a message and wait for response
   */
  async request(
    socketId: string,
    message: WSMessage,
    timeout = this.config.messageTimeout || 30000
  ): Promise<WSMessage> {
    const correlationId = message.id || this.generateId();
    message.id = correlationId;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Request timeout: ${correlationId}`));
      }, timeout);

      this.pendingResponses.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      if (!this.send(socketId, message)) {
        clearTimeout(timeoutHandle);
        this.pendingResponses.delete(correlationId);
        reject(new Error('Failed to send message'));
      }
    });
  }

  /**
   * Open a panel widget
   */
  async openPanel(socketId: string, widget: PanelWidget): Promise<void> {
    this.send(socketId, {
      type: 'command',
      data: {
        action: 'open_panel',
        widget,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Close a panel widget
   */
  async closePanel(socketId: string, widgetId: string): Promise<void> {
    this.send(socketId, {
      type: 'command',
      data: {
        action: 'close_panel',
        widgetId,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Render inline diff
   */
  async renderInlineDiff(socketId: string, options: InlineDiffOptions): Promise<void> {
    this.send(socketId, {
      type: 'command',
      data: {
        action: 'render_diff',
        options,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Get connected sockets count
   */
  getConnectionCount(): number {
    return this.sockets.size;
  }

  /**
   * Disconnect a socket
   */
  disconnect(socketId: string): void {
    const socket = this.sockets.get(socketId);
    if (socket) {
      socket.close();
      this.sockets.delete(socketId);
    }
  }

  /**
   * Disconnect all sockets
   */
  disconnectAll(): void {
    for (const [id, socket] of this.sockets.entries()) {
      socket.close();
    }
    this.sockets.clear();

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Handle incoming message
   */
  private async handleMessage(socketId: string, message: WSMessage): Promise<void> {
    // Handle response to a request
    if (message.correlationId) {
      const pending = this.pendingResponses.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingResponses.delete(message.correlationId);
        pending.resolve(message);
        return;
      }
    }

    // Handle by message type
    switch (message.type) {
      case 'command':
        await this.handleCommand(socketId, message);
        break;

      case 'event':
        await this.handleEvent(socketId, message);
        break;

      case 'response':
        // Handled above via correlationId
        break;

      default:
        this.send(socketId, {
          type: 'event',
          error: `Unknown message type: ${message.type}`,
          correlationId: message.id,
          timestamp: Date.now(),
        });
    }
  }

  /**
   * Handle command message
   */
  private async handleCommand(socketId: string, message: WSMessage): Promise<void> {
    const data = message.data as { action?: string; params?: Record<string, unknown> };
    const action = data.action || '';

    // Handle special actions
    switch (action) {
      case 'subscribe':
        this.subscribe(socketId, (data.params?.event as string) || '');
        this.send(socketId, {
          type: 'response',
          correlationId: message.id,
          data: { subscribed: true },
          timestamp: Date.now(),
        });
        return;

      case 'unsubscribe':
        this.unsubscribe(socketId, (data.params?.event as string) || '');
        this.send(socketId, {
          type: 'response',
          correlationId: message.id,
          data: { unsubscribed: true },
          timestamp: Date.now(),
        });
        return;

      case 'ping':
        this.send(socketId, {
          type: 'response',
          correlationId: message.id,
          data: { pong: true },
          timestamp: Date.now(),
        });
        return;
    }

    // Execute registered command
    const result = await this.executeCommand(action, data.params || {}, socketId);

    this.send(socketId, {
      type: 'response',
      correlationId: message.id,
      data: result,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle event message
   */
  private async handleEvent(socketId: string, message: WSMessage): Promise<void> {
    const data = message.data as { event?: string; payload?: unknown };
    const event = data.event || '';

    // Broadcast to other subscribers
    const subscribers = this.subscriptions.get(event);
    if (subscribers) {
      const broadcastMessage: WSMessage = {
        type: 'event',
        data: { event, data: data.payload },
        timestamp: Date.now(),
      };

      for (const subscriberId of subscribers) {
        if (subscriberId !== socketId) {
          this.send(subscriberId, broadcastMessage);
        }
      }
    }
  }

  /**
   * Ping all connected sockets
   */
  private pingAll(): void {
    const deadSockets: string[] = [];

    for (const [id, socket] of this.sockets.entries()) {
      if (socket.readyState !== WebSocket.OPEN) {
        deadSockets.push(id);
        continue;
      }

      try {
        socket.send(JSON.stringify({
          type: 'event',
          data: { ping: true },
          timestamp: Date.now(),
        }));
      } catch {
        deadSockets.push(id);
      }
    }

    // Clean up dead sockets
    for (const id of deadSockets) {
      this.sockets.delete(id);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ============================================================================
// Cloudflare Workers WebSocket Handler
// ============================================================================

/**
 * Handle WebSocket upgrade for Cloudflare Workers
 */
export function handleWebSocketUpgrade(
  request: Request,
  env: IDEAutomationEnv
): Response | null {
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return null;
  }

  // Create WebSocket pair
  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  // Accept the connection
  server.accept();

  // Create bridge and handle connection
  const bridge = new WebSocketBridge();

  // Set up server handlers
  server.addEventListener('message', (event: MessageEvent) => {
    const message = JSON.parse(event.data) as WSMessage;

    // Echo back for now
    server.send(JSON.stringify({
      type: 'response',
      correlationId: message.id,
      data: { received: true },
      timestamp: Date.now(),
    }));
  });

  server.addEventListener('close', () => {
    server.close();
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
