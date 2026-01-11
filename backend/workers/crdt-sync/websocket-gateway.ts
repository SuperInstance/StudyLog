/**
 * @file websocket-gateway.ts - Real-time WebSocket gateway for CRDT sync
 * @description WebSocket server handling document sync, presence, and cursors
 * @module backend/workers/crdt-sync/websocket-gateway
 */

import { WebSocketServer, WebSocket } from 'ws';
import { DocumentSyncManager } from './document-sync.js';
import { PresenceManager } from './presence-awareness.js';
import { ConflictResolver, createConflictResolver } from './conflict-resolution.js';
import type {
  SyncMessage,
  SyncMessageType,
  DocumentOperation,
  UserPresence,
  UserCursor,
  GatewayConfig,
  DEFAULT_SYNC_CONFIG,
  DEFAULT_PRESENCE_CONFIG,
  GatewayStats,
  ProductType,
  DocumentMeta
} from './types.js';

// ============================================================================
// CLIENT CONNECTION
// ============================================================================

/**
 * Connected client information
 */
interface ClientConnection {
  /** WebSocket connection */
  socket: WebSocket;
  /** Client ID (unique connection ID) */
  clientId: string;
  /** User ID */
  userId: string;
  /** User display name */
  userName: string;
  /** User-assigned color */
  color: string;
  /** Current document ID */
  documentId?: string;
  /** Product type */
  product?: ProductType;
  /** Connection timestamp */
  connectedAt: number;
  /** Last activity timestamp */
  lastActivity: number;
  /** Current cursor position */
  cursor?: { line: number; column: number };
}

/**
 * Message handler signature
 */
type MessageHandler = (client: ClientConnection, message: SyncMessage) => void | Promise<void>;

// ============================================================================
// WEBSOCKET GATEWAY
// ============================================================================

/**
 * WebSocket Gateway Configuration
 */
export interface WebSocketGatewayConfig {
  /** WebSocket port */
  port: number;
  /** Host to bind to */
  host?: string;
  /** Path for WebSocket route */
  path?: string;
  /** Enable per-message compression */
  enablePerMessageDeflate?: boolean;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Client timeout in milliseconds */
  clientTimeout?: number;
  /** Maximum concurrent connections */
  maxConnections?: number;
}

/**
 * Default gateway configuration
 */
export const DEFAULT_GATEWAY_CONFIG: WebSocketGatewayConfig = {
  port: 8080,
  host: '0.0.0.0',
  path: '/crdt-sync',
  enablePerMessageDeflate: true,
  heartbeatInterval: 30000,
  clientTimeout: 60000,
  maxConnections: 100
};

/**
 * User color palette
 */
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52C7B8', '#FF7675', '#74B9FF'
];

/**
 * CRDT WebSocket Gateway
 *
 * Real-time gateway for CRDT collaboration:
 * - Handles WebSocket connections
 * - Routes messages to appropriate handlers
 * - Broadcasts operations to document subscribers
 * - Manages presence awareness
 * - Resolves conflicts
 */
export class CRDTWebSocketGateway {
  /** WebSocket server */
  private wss: WebSocketServer;

  /** Connected clients by client ID */
  private clients: Map<string, ClientConnection> = new Map();

  /** Document sync manager */
  private documentSync: DocumentSyncManager;

  /** Presence manager */
  private presence: PresenceManager;

  /** Conflict resolver */
  private conflictResolver: ConflictResolver;

  /** Message handlers by type */
  private messageHandlers: Map<SyncMessageType, MessageHandler> = new Map();

  /** Heartbeat interval */
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  /** Configuration */
  private config: WebSocketGatewayConfig;

  /** Stats */
  private stats: GatewayStats = {
    connectedClients: 0,
    documentCount: 0,
    totalOperations: 0,
    messagesSent: 0,
    messagesReceived: 0,
    activeSyncSessions: 0,
    uptime: 0
  };

  /** Start time */
  private startTime: number = Date.now();

  /**
   * Create a new CRDT WebSocket Gateway
   *
   * @param config - Gateway configuration
   */
  constructor(config?: Partial<WebSocketGatewayConfig>) {
    this.config = {
      ...DEFAULT_GATEWAY_CONFIG,
      ...config
    };

    // Create managers
    this.documentSync = new DocumentSyncManager();
    this.presence = new PresenceManager();
    this.conflictResolver = createConflictResolver();

    // Create WebSocket server
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
      perMessageDeflate: this.config.enablePerMessageDeflate
    });

    // Setup message handlers
    this.setupMessageHandlers();

    // Setup WebSocket server handlers
    this.setupWebSocketServer();

    // Start heartbeat
    this.startHeartbeat();

    console.log(`CRDT WebSocket Gateway listening on ws://${this.config.host}:${this.config.port}${this.config.path || ''}`);
  }

  // ========================================================================
  // WEBSOCKET SERVER SETUP
  // ========================================================================

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (socket: WebSocket, req) => {
      this.handleConnection(socket, req);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.wss.on('close', () => {
      console.log('WebSocket server closed');
    });
  }

  /**
   * Handle new WebSocket connection
   *
   * @param socket - WebSocket connection
   * @param req - HTTP request
   */
  private handleConnection(socket: WebSocket, req: any): void {
    // Check connection limit
    if (this.config.maxConnections && this.clients.size >= this.config.maxConnections) {
      socket.close(1013, 'Server at maximum capacity');
      return;
    }

    const clientId = this.generateClientId();

    console.log(`New connection: ${clientId}`);

    // Wait for client to send handshake
    socket.on('message', (data: Buffer) => {
      this.handleMessage(clientId, data);
    });

    socket.on('close', () => {
      this.handleDisconnect(clientId);
    });

    socket.on('error', (error) => {
      console.error(`Client error (${clientId}):`, error);
    });

    // Send welcome message
    this.send(socket, {
      type: SyncMessageType.HANDSHAKE,
      replicaId: 'server',
      protocolVersion: '1.0.0',
      timestamp: Date.now()
    } as any);
  }

  /**
   * Handle incoming message from client
   *
   * @param clientId - Client ID
   * @param data - Message data
   */
  private async handleMessage(clientId: string, data: Buffer): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      // Not yet authenticated, expect handshake first
      try {
        const message = JSON.parse(data.toString()) as SyncMessage;
        if (message.type === SyncMessageType.HANDSHAKE) {
          await this.handleHandshake(clientId, message as any);
        }
      } catch (e) {
        console.error(`Invalid handshake from ${clientId}:`, e);
      }
      return;
    }

    // Update activity
    client.lastActivity = Date.now();
    this.stats.messagesReceived++;

    try {
      const message = JSON.parse(data.toString()) as SyncMessage;

      // Route to appropriate handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        await handler(client, message);
      } else {
        console.warn(`Unknown message type: ${message.type} from ${clientId}`);
      }
    } catch (e) {
      console.error(`Error handling message from ${clientId}:`, e);
      this.sendError(client.socket, 'Invalid message format');
    }
  }

  /**
   * Handle client handshake
   *
   * @param clientId - Client ID
   * @param message - Handshake message
   */
  private async handleHandshake(
    clientId: string,
    message: any & { type: SyncMessageType.HANDSHAKE }
  ): Promise<void> {
    // Find the socket (hacky but works)
    let socket: WebSocket | null = null;
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        socket = client;
        break;
      }
    }

    if (!socket) {
      return;
    }

    const { userId, userName, documentId, product = 'studylog' } = message;

    // Validate required fields
    if (!userId || !userName || !documentId) {
      this.sendError(socket, 'Missing required fields');
      socket.close(1008, 'Missing required fields');
      return;
    }

    // Assign color
    const color = this.assignColor(userId);

    // Create client connection
    const client: ClientConnection = {
      socket,
      clientId,
      userId,
      userName,
      color,
      documentId,
      product,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    };

    this.clients.set(clientId, client);
    this.stats.connectedClients = this.clients.size;

    // Load or create document
    let documentExists = await this.documentSync.getDocument(documentId);
    if (!documentExists) {
      await this.documentSync.createDocument(documentId, '', product, {} as DocumentMeta);
    }

    // Add to presence
    this.presence.addUser(userId, userName, documentId, clientId);

    // Add to document
    await this.documentSync.addClient(documentId, clientId, userId);

    // Send handshake response
    this.send(socket, {
      type: SyncMessageType.HANDSHAKE,
      replicaId: 'server',
      protocolVersion: '1.0.0',
      userId,
      userName,
      documentId,
      currentVersion: 0,
      supportedCompression: ['none'],
      capabilities: {
        maxMessageSize: 1024 * 1024,
        supportsIncremental: true,
        supportsCompression: false,
        supportsDeltaEncoding: true,
        maxBatchSize: 100
      },
      timestamp: Date.now()
    } as any);

    // Send current document state
    const snapshot = await this.documentSync.getSnapshot(documentId);
    if (snapshot) {
      this.send(socket, {
        type: SyncMessageType.SNAPSHOT,
        replicaId: 'server',
        documentId,
        snapshot,
        timestamp: Date.now()
      } as any);
    }

    // Send user list
    const users = this.presence.getDocumentUsers(documentId);
    this.send(socket, {
      type: SyncMessageType.PRESENCE,
      presence: Array.from(users.values()).map(u => ({
        ...u,
        cursor: u.cursor || {
          userId: u.userId,
          userName: u.userName,
          position: { line: 0, column: 0 },
          color: this.assignColor(u.userId),
          timestamp: Date.now()
        }
      })),
      timestamp: Date.now()
    } as any);

    console.log(`User joined: ${userName} (${userId}) in ${documentId}`);
  }

  /**
   * Handle client disconnect
   *
   * @param clientId - Client ID
   */
  private async handleDisconnect(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    console.log(`Client disconnected: ${client.userName} (${client.userId})`);

    // Remove from presence
    if (client.documentId) {
      this.presence.removeUser(client.userId, clientId);
      await this.documentSync.removeClient(client.documentId, clientId, client.userId);

      // Broadcast user left
      this.broadcastToDocument(client.documentId, {
        type: SyncMessageType.PRESENCE,
        presence: {
          userId: client.userId,
          status: 'offline' as any,
          lastActivity: Date.now()
        },
        timestamp: Date.now()
      } as any, clientId);
    }

    this.clients.delete(clientId);
    this.stats.connectedClients = this.clients.size;
  }

  // ========================================================================
  // MESSAGE HANDLERS
  // ========================================================================

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    // Document operations
    this.messageHandlers.set(SyncMessageType.OPERATIONS, this.handleOperations.bind(this));

    // Cursor updates
    this.messageHandlers.set(SyncMessageType.CURSOR, this.handleCursor.bind(this));

    // Typing indicator
    this.messageHandlers.set(SyncMessageType.TYPING, this.handleTyping.bind(this));

    // Heartbeat
    this.messageHandlers.set(SyncMessageType.HEARTBEAT, this.handleHeartbeatMessage.bind(this));

    // Sync request
    this.messageHandlers.set(SyncMessageType.SYNC_REQUEST, this.handleSyncRequest.bind(this));
  }

  /**
   * Handle document operations
   *
   * @param client - Client connection
   * @param message - Operations message
   */
  private async handleOperations(
    client: ClientConnection,
    message: SyncMessage
  ): Promise<void> {
    if (!client.documentId) {
      return;
    }

    const opsMessage = message as any & { operations: DocumentOperation[] };

    for (const operation of opsMessage.operations) {
      // Apply operation
      const applied = await this.documentSync.applyRemoteOperation(
        client.documentId,
        operation
      );

      if (applied) {
        this.stats.totalOperations++;

        // Broadcast to other clients in document
        this.broadcastToDocument(client.documentId, {
          type: SyncMessageType.OPERATIONS,
          replicaId: client.userId,
          documentId: client.documentId,
          operations: [applied],
          sequenceNumber: 0,
          totalBatches: 1,
          timestamp: Date.now()
        } as any, client.clientId);

        // Send acknowledgment
        this.send(client.socket, {
          type: SyncMessageType.ACKNOWLEDGMENT,
          replicaId: 'server',
          acknowledgedVersions: [applied.clock],
          acknowledgedOperations: [applied.id],
          timestamp: Date.now()
        } as any);
      }
    }
  }

  /**
   * Handle cursor update
   *
   * @param client - Client connection
   * @param message - Cursor message
   */
  private handleCursor(
    client: ClientConnection,
    message: SyncMessage
  ): void {
    if (!client.documentId) {
      return;
    }

    const cursorMessage = message as any & {
      cursor: UserCursor;
    };

    // Update presence
    this.presence.updateCursor(
      client.userId,
      cursorMessage.cursor.position,
      cursorMessage.cursor.selection
    );

    // Broadcast to other clients
    this.broadcastToDocument(client.documentId, {
      type: SyncMessageType.CURSOR,
      userId: client.userId,
      userName: client.userName,
      documentId: client.documentId,
      cursor: {
        ...cursorMessage.cursor,
        color: client.color
      },
      timestamp: Date.now()
    } as any, client.clientId);
  }

  /**
   * Handle typing indicator
   *
   * @param client - Client connection
   * @param message - Typing message
   */
  private handleTyping(
    client: ClientConnection,
    message: SyncMessage
  ): void {
    if (!client.documentId) {
      return;
    }

    const typingMessage = message as any & {
      isTyping: boolean;
      partialLength?: number;
    };

    // Update presence
    this.presence.setTyping(
      client.userId,
      typingMessage.isTyping,
      typingMessage.partialLength
    );

    // Broadcast to other clients
    this.broadcastToDocument(client.documentId, {
      type: SyncMessageType.TYPING,
      userId: client.userId,
      documentId: client.documentId,
      isTyping: typingMessage.isTyping,
      partialLength: typingMessage.partialLength,
      timestamp: Date.now()
    } as any, client.clientId);
  }

  /**
   * Handle heartbeat message
   *
   * @param client - Client connection
   * @param message - Heartbeat message
   */
  private handleHeartbeatMessage(
    client: ClientConnection,
    message: SyncMessage
  ): void {
    // Just update activity timestamp
    client.lastActivity = Date.now();

    // Respond with heartbeat
    this.send(client.socket, {
      type: SyncMessageType.HEARTBEAT,
      replicaId: 'server',
      timestamp: Date.now(),
      currentVersion: 0
    } as any);
  }

  /**
   * Handle sync request
   *
   * @param client - Client connection
   * @param message - Sync request message
   */
  private async handleSyncRequest(
    client: ClientConnection,
    message: SyncMessage
  ): Promise<void> {
    if (!client.documentId) {
      return;
    }

    const syncMessage = message as any & {
      fromVersion: number;
    };

    // Get document operations since version
    const snapshot = await this.documentSync.getSnapshot(client.documentId);
    if (!snapshot) {
      return;
    }

    const operationsSince = snapshot.operations.filter(op => op.clock > syncMessage.fromVersion);

    // Batch operations
    const batchSize = 100;
    const batches: DocumentOperation[][] = [];
    for (let i = 0; i < operationsSince.length; i += batchSize) {
      batches.push(operationsSince.slice(i, i + batchSize));
    }

    // Send batches
    for (let i = 0; i < batches.length; i++) {
      this.send(client.socket, {
        type: SyncMessageType.SYNC_RESPONSE,
        replicaId: 'server',
        fromVersion: syncMessage.fromVersion,
        toVersion: snapshot.version,
        operations: batches[i],
        timestamp: Date.now()
      } as any);
    }
  }

  // ========================================================================
  // BROADCASTING
  // ========================================================================

  /**
   * Broadcast message to all clients in a document
   *
   * @param documentId - Document ID
   * @param message - Message to broadcast
   * @param excludeClientId - Client ID to exclude
   */
  private broadcastToDocument(
    documentId: string,
    message: SyncMessage,
    excludeClientId?: string
  ): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.documentId === documentId && clientId !== excludeClientId) {
        this.send(client.socket, message);
      }
    }
    this.stats.messagesSent += this.clients.size - (excludeClientId ? 1 : 0);
  }

  /**
   * Send message to a specific client
   *
   * @param socket - WebSocket socket
   * @param message - Message to send
   */
  private send(socket: WebSocket, message: SyncMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
      this.stats.messagesSent++;
    }
  }

  /**
   * Send error message to client
   *
   * @param socket - WebSocket socket
   * @param errorMessage - Error message
   */
  private sendError(socket: WebSocket, errorMessage: string): void {
    this.send(socket, {
      type: SyncMessageType.ERROR,
      replicaId: 'server',
      errorCode: 'invalid_message' as any,
      errorMessage,
      timestamp: Date.now()
    } as any);
  }

  // ========================================================================
  // HEARTBEAT
  // ========================================================================

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeout = this.config.clientTimeout!;

      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastActivity > timeout) {
          console.log(`Client timeout: ${clientId}`);
          client.socket.terminate();
          this.handleDisconnect(clientId);
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Generate client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Assign color to user
   */
  private assignColor(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Get gateway statistics
   */
  getStats(): GatewayStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
      documentCount: this.documentSync.getDocumentIds().length
    };
  }

  /**
   * Shutdown the gateway
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    // Close all connections
    for (const client of this.clients.values()) {
      client.socket.close();
    }

    // Shutdown managers
    await this.documentSync.shutdown();
    this.presence.shutdown();

    // Close server
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('CRDT WebSocket Gateway shut down');
        resolve();
      });
    });
  }
}

// ============================================================================
// STARTER FUNCTION
// ============================================================================

/**
 * Start a CRDT WebSocket Gateway
 *
 * @param config - Gateway configuration
 * @returns The gateway instance
 */
export function startGateway(config?: Partial<WebSocketGatewayConfig>): CRDTWebSocketGateway {
  return new CRDTWebSocketGateway(config);
}

/**
 * Start gateway with environment variable configuration
 */
export function startGatewayFromEnv(): CRDTWebSocketGateway {
  const config: Partial<WebSocketGatewayConfig> = {
    port: parseInt(process.env.CRDT_GATEWAY_PORT || '8080', 10),
    host: process.env.CRDT_GATEWAY_HOST || '0.0.0.0',
    maxConnections: parseInt(process.env.CRDT_MAX_CONNECTIONS || '100', 10)
  };

  return startGateway(config);
}
