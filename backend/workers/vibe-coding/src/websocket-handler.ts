/**
 * WebSocket Handler
 *
 * Real-time bidirectional communication for streaming chat responses.
 * Compatible with Cloudflare Workers WebSocket API.
 */

import type {
  WSMessage,
  StreamChunk,
  ChatRequest,
} from './types.js';
import type { VibeCodingEnv } from './types.js';

// ============================================================================
// WebSocket Configuration
// ============================================================================

interface WebSocketConfig {
  /** Ping interval (ms) */
  pingInterval?: number;
  /** Message timeout (ms) */
  messageTimeout?: number;
  /** Maximum message size (bytes) */
  maxMessageSize?: number;
}

const DEFAULT_CONFIG: WebSocketConfig = {
  pingInterval: 30000,
  messageTimeout: 30000,
  maxMessageSize: 1024 * 1024, // 1MB
};

// ============================================================================
// WebSocket Connection State
// ============================================================================

interface ConnectionState {
  /** Socket ID */
  id: string;
  /** User ID */
  userId?: string;
  /** Workspace ID */
  workspaceId?: string;
  /** Session ID */
  sessionId?: string;
  /** Connection timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Subscriptions */
  subscriptions: Set<string>;
}

// ============================================================================
// WebSocket Handler
// ============================================================================

/**
 * WebSocket message handler for vibe-coding
 */
export class WebSocketHandler {
  private readonly connections = new Map<WebSocket, ConnectionState>();
  private readonly pendingResponses = new Map<string, {
    resolve: (value: WSMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private pingInterval?: ReturnType<typeof setInterval>;

  constructor(
    private readonly env: VibeCodingEnv,
    private readonly config: WebSocketConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Handle a WebSocket connection upgrade
   */
  handleWebSocketUpgrade(request: Request): Response | null {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return null;
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the connection
    server.accept();

    // Set up handlers
    this.setupConnection(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Set up connection handlers
   */
  private setupConnection(socket: WebSocket, request: Request): void {
    const state: ConnectionState = {
      id: this.generateConnectionId(),
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      subscriptions: new Set(),
    };

    // Extract auth/user info from URL
    const url = new URL(request.url);
    state.userId = url.searchParams.get('userId') || undefined;
    state.workspaceId = url.searchParams.get('workspaceId') || undefined;
    state.sessionId = url.searchParams.get('sessionId') || undefined;

    this.connections.set(socket, state);

    // Send welcome message
    this.send(socket, {
      type: 'event',
      data: { connected: true, connectionId: state.id },
      timestamp: Date.now(),
    });

    // Set up message handler
    socket.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(socket, event.data);
    });

    // Set up close handler
    socket.addEventListener('close', () => {
      this.handleClose(socket);
    });

    // Set up error handler
    socket.addEventListener('error', (error) => {
      console.error(`WebSocket error for ${state.id}:`, error);
    });

    // Start ping interval if not already running
    this.startPingInterval();
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(socket: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const state = this.connections.get(socket);
    if (!state) {
      return;
    }

    state.lastActivity = Date.now();

    try {
      const message = JSON.parse(data as string) as WSMessage;

      // Handle response to a pending request
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
        case 'chat':
          await this.handleChatMessage(socket, message, state);
          break;

        case 'command':
          await this.handleCommandMessage(socket, message, state);
          break;

        case 'event':
          await this.handleEventMessage(socket, message, state);
          break;

        default:
          this.sendError(socket, `Unknown message type: ${message.type}`, message.id);
      }
    } catch (error) {
      this.sendError(socket, error instanceof Error ? error.message : 'Parse error');
    }
  }

  /**
   * Handle chat message
   */
  private async handleChatMessage(
    socket: WebSocket,
    message: WSMessage<ChatRequest>,
    state: ConnectionState
  ): Promise<void> {
    const { ChatService } = await import('./chat-service.js');
    const chatService = new ChatService(this.env);

    const request = message.data as ChatRequest;

    // Update session state
    if (request.userId && !state.userId) {
      state.userId = request.userId;
    }
    if (request.workspaceId && !state.workspaceId) {
      state.workspaceId = request.workspaceId;
    }
    if (request.sessionId) {
      state.sessionId = request.sessionId;
    }

    // Create stream processor
    const { StreamProcessor } = await import('./streaming.js');
    const processor = new StreamProcessor();

    // Send status update
    this.send(socket, {
      type: 'stream',
      data: { status: 'starting', sessionId: request.sessionId },
      timestamp: Date.now(),
    });

    // Start streaming
    try {
      const stream = await chatService.chatStream(
        request,
        processor
      );

      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Send chunk via WebSocket
        this.send(socket, {
          type: 'stream',
          data: value,
          timestamp: Date.now(),
        });
      }

      // Send completion
      this.send(socket, {
        type: 'response',
        correlationId: message.id,
        data: { done: true },
        timestamp: Date.now(),
      });
    } catch (error) {
      this.sendError(socket, error instanceof Error ? error.message : 'Chat failed', message.id);
    }
  }

  /**
   * Handle command message
   */
  private async handleCommandMessage(
    socket: WebSocket,
    message: WSMessage,
    state: ConnectionState
  ): Promise<void> {
    const data = message.data as { action?: string; params?: Record<string, unknown> };
    const action = data.action || '';

    switch (action) {
      case 'subscribe':
        if (data.params?.event) {
          state.subscriptions.add(String(data.params.event));
        }
        this.sendResponse(socket, message.id, { subscribed: true });
        break;

      case 'unsubscribe':
        if (data.params?.event) {
          state.subscriptions.delete(String(data.params.event));
        }
        this.sendResponse(socket, message.id, { unsubscribed: true });
        break;

      case 'ping':
        this.sendResponse(socket, message.id, { pong: true });
        break;

      case 'set_session':
        state.sessionId = data.params?.sessionId as string | undefined;
        this.sendResponse(socket, message.id, { sessionSet: true });
        break;

      case 'get_session':
        if (state.sessionId) {
          const { ConversationMemory } = await import('./conversation-memory.js');
          const memory = new ConversationMemory(this.env.CHAT_HISTORY, this.env.DB);
          const session = await memory.getSession(state.sessionId);
          this.sendResponse(socket, message.id, { session });
        } else {
          this.sendResponse(socket, message.id, { session: null });
        }
        break;

      default:
        this.sendError(socket, `Unknown command: ${action}`, message.id);
    }
  }

  /**
   * Handle event message
   */
  private async handleEventMessage(
    socket: WebSocket,
    message: WSMessage,
    state: ConnectionState
  ): Promise<void> {
    const data = message.data as { event?: string; payload?: unknown };
    const event = data.event || '';

    // Broadcast to other subscribers
    for (const [otherSocket, otherState] of this.connections.entries()) {
      if (otherSocket === socket) continue;

      if (otherState.subscriptions.has(event)) {
        this.send(otherSocket, {
          type: 'event',
          data: { event, data: data.payload },
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(socket: WebSocket): void {
    const state = this.connections.get(socket);
    if (state) {
      // Clean up pending responses
      for (const [id, pending] of this.pendingResponses) {
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
        }
      }
    }

    this.connections.delete(socket);

    // Stop ping interval if no connections
    if (this.connections.size === 0 && this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  /**
   * Send message to socket
   */
  send(socket: WebSocket, message: WSMessage): boolean {
    if (socket.readyState !== WebSocket.OPEN) {
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
   * Send response message
   */
  sendResponse(socket: WebSocket, correlationId: string | undefined, data: unknown): boolean {
    return this.send(socket, {
      type: 'response',
      correlationId,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Send error message
   */
  sendError(socket: WebSocket, error: string, correlationId?: string): boolean {
    return this.send(socket, {
      type: 'response',
      correlationId,
      error,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast to all connections
   */
  broadcast(message: WSMessage): void {
    for (const [socket] of this.connections.entries()) {
      this.send(socket, message);
    }
  }

  /**
   * Broadcast to user's connections
   */
  broadcastToUser(userId: string, message: WSMessage): void {
    for (const [socket, state] of this.connections.entries()) {
      if (state.userId === userId) {
        this.send(socket, message);
      }
    }
  }

  /**
   * Broadcast to workspace
   */
  broadcastToWorkspace(workspaceId: string, message: WSMessage): void {
    for (const [socket, state] of this.connections.entries()) {
      if (state.workspaceId === workspaceId) {
        this.send(socket, message);
      }
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): Array<{
    id: string;
    userId?: string;
    workspaceId?: string;
    connectedAt: number;
    lastActivity: number;
  }> {
    return Array.from(this.connections.values()).map(s => ({
      id: s.id,
      userId: s.userId,
      workspaceId: s.workspaceId,
      connectedAt: s.connectedAt,
      lastActivity: s.lastActivity,
    }));
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      return;
    }

    this.pingInterval = setInterval(() => {
      this.pingAll();
    }, this.config.pingInterval || 30000);
  }

  /**
   * Ping all connections and remove dead ones
   */
  private pingAll(): void {
    const deadSockets: WebSocket[] = [];

    for (const [socket, state] of this.connections.entries()) {
      if (socket.readyState !== WebSocket.OPEN) {
        deadSockets.push(socket);
        continue;
      }

      try {
        this.send(socket, {
          type: 'event',
          data: { ping: true },
          timestamp: Date.now(),
        });
      } catch {
        deadSockets.push(socket);
      }

      // Check for timeout
      const now = Date.now();
      const timeout = this.config.messageTimeout || 30000;
      if (now - state.lastActivity > timeout) {
        deadSockets.push(socket);
      }
    }

    // Clean up dead sockets
    for (const socket of deadSockets) {
      this.handleClose(socket);
    }
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ============================================================================
// Cloudflare Workers Integration
// ============================================================================

/**
 * Create WebSocket handler from fetch handler
 */
export function createWebSocketHandler(env: VibeCodingEnv): WebSocketHandler {
  return new WebSocketHandler(env);
}

/**
 * Handle WebSocket upgrade in fetch handler
 */
export function handleWebSocketUpgrade(
  request: Request,
  env: VibeCodingEnv
): Response | null {
  const handler = createWebSocketHandler(env);
  return handler.handleWebSocketUpgrade(request);
}
