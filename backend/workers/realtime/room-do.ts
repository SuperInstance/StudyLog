/**
 * Room Durable Object
 *
 * Manages state for a single virtual classroom / room.
 * Handles participant connections, messaging, and WebRTC signaling.
 */

import type {
  Room,
  RoomSettings,
  ConnectedClient,
  WSMessage,
  ChatMessage,
  HandRaise,
  Reaction,
  Poll,
  Presence,
  WebRTCOffer,
  WebRTCAnswer,
  IceCandidate,
  RoomType,
  RoomState,
} from './types';

// ============================================================================
// Room Durable Object
// ============================================================================

export class RoomDO {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Map<string, WebSocket> = new Map();
  private clients: Map<string, ConnectedClient> = new Map();

  // Room state
  private room: Room;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // Initialize room from storage or create new
    this.room = {
      id: this.state.id.toString(),
      name: '',
      type: 'classroom',
      tenantId: '',
      state: 'forming',
      ownerId: '',
      maxParticipants: 50,
      currentParticipants: 0,
      settings: this.getDefaultSettings(),
      sessions: [],
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Handle incoming WebSocket connections and HTTP requests.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // HTTP API
    if (pathname === '/' && request.method === 'GET') {
      return Response.json(this.getRoomInfo());
    }

    if (pathname === '/settings' && request.method === 'PUT') {
      return this.updateSettings(request);
    }

    if (pathname === '/participants' && request.method === 'GET') {
      return Response.json(this.getParticipants());
    }

    if (pathname === '/end' && request.method === 'POST') {
      return this.endRoom();
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket connection.
   */
  private async handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const userName = url.searchParams.get('userName');
    const role = url.searchParams.get('role') as ConnectedClient['role'] || 'student';

    if (!userId || !userName) {
      return new Response('Missing userId or userName', { status: 400 });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the connection
    server.accept();

    // Register the session
    const connectionId = crypto.randomUUID();
    this.sessions.set(connectionId, server);

    // Create client info
    const clientInfo: ConnectedClient = {
      connectionId,
      userId,
      tenantId: this.room.tenantId,
      displayName: userName,
      role,
      roomId: this.room.id,
      state: 'connected',
      connectedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      capabilities: {
        webrtc: true,
        screenShare: true,
        audio: true,
        video: true,
      },
      userAgent: request.headers.get('User-Agent') || undefined,
      ipAddress: request.headers.get('CF-Connecting-IP') || undefined,
    };

    this.clients.set(userId, clientInfo);
    this.room.currentParticipants = this.clients.size;

    // Set up message handler
    server.addEventListener('message', async (event) => {
      try {
        await this.handleMessage(userId, event.data);
      } catch (error) {
        console.error('Error handling message:', error);
        this.sendError(userId, error instanceof Error ? error.message : 'Unknown error');
      }
    });

    // Handle disconnect
    server.addEventListener('close', () => {
      this.handleDisconnect(userId);
    });

    // Handle errors
    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    this.sendToClient(connectionId, {
      type: 'welcome',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: {
        roomId: this.room.id,
        roomName: this.room.name,
        role: clientInfo.role,
        settings: this.room.settings,
        participants: Array.from(this.clients.values()),
      },
    });

    // Notify others
    this.broadcastToOthers(userId, {
      type: 'presence.update',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: {
        userId,
        userName,
        joined: true,
      },
    });

    // Persist state
    await this.persistState();

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket message.
   */
  private async handleMessage(userId: string, rawData: string): Promise<void> {
    const message: WSMessage = JSON.parse(rawData);

    // Update last activity
    const client = this.clients.get(userId);
    if (client) {
      client.lastActivityAt = new Date().toISOString();
    }

    switch (message.type) {
      case 'room.update':
        await this.handleRoomUpdate(userId, message.data);
        break;

      case 'chat.message':
        await this.handleChatMessage(userId, message.data);
        break;

      case 'chat.typing':
        this.handleTypingIndicator(userId, message.data);
        break;

      case 'webrtc.offer':
        await this.handleWebRTCOffer(userId, message.data);
        break;

      case 'webrtc.answer':
        await this.handleWebRTCAnswer(userId, message.data);
        break;

      case 'webrtc.ice':
        await this.handleIceCandidate(userId, message.data);
        break;

      case 'webrtc.end':
        await this.handleWebRTCEnd(userId, message.data);
        break;

      case 'hand.raise':
        await this.handleHandRaise(userId, message.data);
        break;

      case 'reaction.send':
        await this.handleReaction(userId, message.data);
        break;

      case 'poll.create':
        await this.handlePollCreate(userId, message.data);
        break;

      case 'poll.vote':
        await this.handlePollVote(userId, message.data);
        break;

      case 'control.grant':
        await this.handleControlGrant(userId, message.data);
        break;

      case 'control.revoke':
        await this.handleControlRevoke(userId, message.data);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle chat message.
   */
  private async handleChatMessage(userId: string, data: any): Promise<void> {
    const client = this.clients.get(userId);
    if (!client) return;

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: this.room.id,
      senderId: userId,
      senderName: client.displayName,
      content: data.content || '',
      messageType: data.messageType || 'text',
      isPrivate: data.isPrivate || false,
      targetUserId: data.targetUserId,
      replyTo: data.replyTo,
      reactions: [],
      timestamp: new Date().toISOString(),
      deleted: false,
    };

    // Broadcast to all or specific target
    if (chatMessage.isPrivate && chatMessage.targetUserId) {
      this.sendToUser(userId, {
        type: 'chat.message',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        from: userId,
        data: chatMessage,
      });
      this.sendToUser(chatMessage.targetUserId, {
        type: 'chat.message',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        from: userId,
        data: chatMessage,
      });
    } else {
      this.broadcast({
        type: 'chat.message',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        from: userId,
        data: chatMessage,
      });
    }

    // Persist to database
    await this.env.DB.prepare(`
      INSERT INTO chat_messages (id, room_id, sender_id, content, message_type, is_private, target_user_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      chatMessage.id,
      chatMessage.roomId,
      chatMessage.senderId,
      chatMessage.content,
      chatMessage.messageType,
      chatMessage.isPrivate ? 1 : 0,
      chatMessage.targetUserId || null,
      chatMessage.timestamp
    ).run();
  }

  /**
   * Handle typing indicator.
   */
  private handleTypingIndicator(userId: string, data: any): void {
    const client = this.clients.get(userId);
    if (!client) return;

    this.broadcastToOthers(userId, {
      type: 'chat.typing',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: {
        roomId: this.room.id,
        userId,
        userName: client.displayName,
        typing: data.typing || false,
      },
    });
  }

  /**
   * Handle WebRTC offer.
   */
  private async handleWebRTCOffer(userId: string, data: WebRTCOffer): Promise<void> {
    // Forward offer to target user
    this.sendToUser(data.targetUserId, {
      type: 'webrtc.offer',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: {
        ...data,
        callerId: userId,
      },
    });
  }

  /**
   * Handle WebRTC answer.
   */
  private async handleWebRTCAnswer(userId: string, data: WebRTCAnswer): Promise<void> {
    // Forward answer to target user (caller)
    this.sendToUser(data.targetUserId, {
      type: 'webrtc.answer',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: {
        ...data,
        answererId: userId,
      },
    });
  }

  /**
   * Handle ICE candidate.
   */
  private async handleIceCandidate(userId: string, data: IceCandidate): Promise<void> {
    // Forward ICE candidate to target user
    this.sendToUser(data.targetUserId, {
      type: 'webrtc.ice',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data,
    });
  }

  /**
   * Handle WebRTC end call.
   */
  private async handleWebRTCEnd(userId: string, data: { targetUserId: string; sessionId: string }): Promise<void> {
    this.sendToUser(data.targetUserId, {
      type: 'webrtc.end',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data,
    });
  }

  /**
   * Handle hand raise.
   */
  private async handleHandRaise(userId: string, data: { raised: boolean }): Promise<void> {
    const client = this.clients.get(userId);
    if (!client) return;

    const handRaise: HandRaise = {
      userId,
      userName: client.displayName,
      raisedAt: new Date().toISOString(),
      active: data.raised,
      loweredAt: data.raised ? undefined : new Date().toISOString(),
    };

    this.broadcast({
      type: 'hand.raise',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: handRaise,
    });
  }

  /**
   * Handle reaction.
   */
  private async handleReaction(userId: string, data: { type: string }): Promise<void> {
    const client = this.clients.get(userId);
    if (!client) return;

    const reaction: Reaction = {
      userId,
      userName: client.displayName,
      type: data.type as any,
      timestamp: new Date().toISOString(),
    };

    this.broadcast({
      type: 'reaction.send',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: reaction,
    });
  }

  /**
   * Handle poll creation.
   */
  private async handlePollCreate(userId: string, data: any): Promise<void> {
    const client = this.clients.get(userId);
    if (!client) return;

    // Only teachers can create polls
    if (client.role !== 'teacher' && client.role !== 'assistant') {
      this.sendError(userId, 'Only teachers can create polls');
      return;
    }

    const poll: Poll = {
      id: crypto.randomUUID(),
      roomId: this.room.id,
      question: data.question,
      options: data.options.map((text: string, i: number) => ({
        id: `opt_${i}`,
        text,
        votes: 0,
        voterIds: [],
      })),
      type: data.type || 'single',
      anonymous: data.anonymous || false,
      createdBy: userId,
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.broadcast({
      type: 'poll.create',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: poll,
    });

    // Persist poll
    await this.env.DB.prepare(`
      INSERT INTO polls (id, room_id, question, options, type, anonymous, created_by, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      poll.id,
      poll.roomId,
      poll.question,
      JSON.stringify(poll.options),
      poll.type,
      poll.anonymous ? 1 : 0,
      poll.createdBy,
      poll.active ? 1 : 0,
      poll.createdAt
    ).run();
  }

  /**
   * Handle poll vote.
   */
  private async handlePollVote(userId: string, data: { pollId: string; optionIds: string[] }): Promise<void> {
    // Broadcast vote (in production, would validate and update database)
    this.broadcast({
      type: 'poll.vote',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: {
        pollId: data.pollId,
        userId,
        optionIds: data.optionIds,
      },
    });
  }

  /**
   * Handle granting control to student.
   */
  private async handleControlGrant(userId: string, data: { targetUserId: string }): Promise<void> {
    const client = this.clients.get(userId);
    if (!client || (client.role !== 'teacher' && client.role !== 'assistant')) {
      this.sendError(userId, 'Unauthorized');
      return;
    }

    this.sendToUser(data.targetUserId, {
      type: 'control.grant',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: { grantedBy: userId },
    });
  }

  /**
   * Handle revoking control from student.
   */
  private async handleControlRevoke(userId: string, data: { targetUserId: string }): Promise<void> {
    const client = this.clients.get(userId);
    if (!client || (client.role !== 'teacher' && client.role !== 'assistant')) {
      this.sendError(userId, 'Unauthorized');
      return;
    }

    this.sendToUser(data.targetUserId, {
      type: 'control.revoke',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: { revokedBy: userId },
    });
  }

  /**
   * Handle room update.
   */
  private async handleRoomUpdate(userId: string, data: Partial<Room>): Promise<void> {
    const client = this.clients.get(userId);
    if (!client || (client.role !== 'teacher' && client.role !== 'assistant')) {
      this.sendError(userId, 'Unauthorized');
      return;
    }

    if (data.name) this.room.name = data.name;
    if (data.state) this.room.state = data.state;
    if (data.settings) {
      this.room.settings = { ...this.room.settings, ...data.settings };
    }

    this.broadcast({
      type: 'room.update',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: this.room,
    });

    await this.persistState();
  }

  /**
   * Handle client disconnect.
   */
  private handleDisconnect(userId: string): void {
    const client = this.clients.get(userId);
    if (!client) return;

    this.sessions.delete(client.connectionId);
    this.clients.delete(userId);
    this.room.currentParticipants = this.clients.size;

    // Notify others
    this.broadcast({
      type: 'presence.update',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      from: userId,
      data: {
        userId,
        userName: client.displayName,
        joined: false,
      },
    });

    this.persistState();
  }

  /**
   * Send message to specific client.
   */
  private sendToClient(connectionId: string, message: WSMessage): void {
    const ws = this.sessions.get(connectionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to specific user.
   */
  private sendToUser(userId: string, message: WSMessage): void {
    const client = this.clients.get(userId);
    if (client) {
      this.sendToClient(client.connectionId, message);
    }
  }

  /**
   * Broadcast to all connected clients.
   */
  private broadcast(message: WSMessage): void {
    const data = JSON.stringify(message);
    for (const ws of this.sessions.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Broadcast to all except one user.
   */
  private broadcastToOthers(excludeUserId: string, message: WSMessage): void {
    const excludeClient = this.clients.get(excludeUserId);
    const excludeConnectionId = excludeClient?.connectionId;

    const data = JSON.stringify(message);
    for (const [connectionId, ws] of this.sessions.entries()) {
      if (connectionId !== excludeConnectionId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Send error message to user.
   */
  private sendError(userId: string, errorMessage: string): void {
    this.sendToUser(userId, {
      type: 'error',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: { message: errorMessage },
    });
  }

  /**
   * Get room info.
   */
  private getRoomInfo(): Omit<Room, 'sessions'> {
    return {
      id: this.room.id,
      name: this.room.name,
      type: this.room.type,
      tenantId: this.room.tenantId,
      state: this.room.state,
      ownerId: this.room.ownerId,
      maxParticipants: this.room.maxParticipants,
      currentParticipants: this.room.currentParticipants,
      settings: this.room.settings,
      sessions: [],
      createdAt: this.room.createdAt,
      startedAt: this.room.startedAt,
      endedAt: this.room.endedAt,
      scheduledFor: this.room.scheduledFor,
      durationMinutes: this.room.durationMinutes,
    };
  }

  /**
   * Get participants list.
   */
  private getParticipants(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Update room settings.
   */
  private async updateSettings(request: Request): Promise<Response> {
    const data = await request.json();
    this.room.settings = { ...this.room.settings, ...data };
    await this.persistState();

    // Notify participants
    this.broadcast({
      type: 'room.update',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: { settings: this.room.settings },
    });

    return Response.json({ success: true, settings: this.room.settings });
  }

  /**
   * End the room.
   */
  private async endRoom(): Promise<Response> {
    this.room.state = 'ended';
    this.room.endedAt = new Date().toISOString();

    // Notify all participants
    this.broadcast({
      type: 'room.update',
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      data: { state: 'ended' },
    });

    // Close all connections
    for (const ws of this.sessions.values()) {
      ws.close(1000, 'Room ended');
    }

    await this.persistState();

    return Response.json({ success: true });
  }

  /**
   * Persist room state to storage.
   */
  private async persistState(): Promise<void> {
    await this.state.storage.put('room', this.room);
    await this.state.storage.put('clients', Array.from(this.clients.entries()));
  }

  /**
   * Get default room settings.
   */
  private getDefaultSettings(): RoomSettings {
    return {
      openJoin: false,
      chatEnabled: true,
      voiceEnabled: true,
      videoEnabled: true,
      screenShareEnabled: true,
      recordingEnabled: false,
      whoCanSpeak: 'raised_hand',
      whoCanShare: 'teacher',
      waitingRoom: false,
      breakoutRooms: false,
      maxBreakoutRooms: 5,
      handRaiseEnabled: true,
      reactionsEnabled: true,
      muteOnJoin: true,
      aiAssistant: true,
    };
  }

  /**
   * Initialize room from storage.
   */
  async initialize(): Promise<void> {
    const room = await this.state.storage.get<Room>('room');
    if (room) {
      this.room = room;
    }

    const clients = await this.state.storage.get<[string, ConnectedClient][]>('clients');
    if (clients) {
      this.clients = new Map(clients);
    }
  }
}
