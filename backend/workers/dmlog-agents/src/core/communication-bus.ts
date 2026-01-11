/**
 * DMLoG.AI - Communication Bus
 *
 * Agent-to-agent messaging system with pub/sub, direct messaging,
 * and broadcast capabilities. Supports asynchronous communication
 * between all agent types.
 *
 * @module core/communication-bus
 */

import type {
  AgentMessage,
  MessageType,
  MessagePriority,
  MessageHandler,
  AgentErrorCode,
} from '../types/index.js';
import { AgentError, MessagePriority as MP } from '../types/index.js';

/**
 * Message queue entry
 */
interface QueueEntry {
  message: AgentMessage;
  timestamp: number;
  retryCount: number;
}

/**
 * Handler subscription
 */
interface HandlerSubscription {
  agentId: string;
  messageType: MessageType | '*';
  handler: MessageHandler;
  once: boolean;
}

/**
 * Pending response tracker
 */
interface PendingResponse {
  resolve: (value: AgentMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Communication Bus Options
 */
export interface CommunicationBusOptions {
  /** Maximum message queue size */
  maxQueueSize?: number;
  /** Message timeout in ms */
  messageTimeout?: number;
  /** Enable message persistence */
  enablePersistence?: boolean;
  /** Enable debug logging */
  debugLog?: boolean;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<CommunicationBusOptions> = {
  maxQueueSize: 10000,
  messageTimeout: 30000, // 30 seconds
  enablePersistence: false,
  debugLog: false,
};

/**
 * Communication Bus
 *
 * Central messaging system for agent-to-agent communication.
 * Implements publish/subscribe pattern with priority queues.
 */
export class CommunicationBus {
  private static instance: CommunicationBus | null = null;

  /** Message queue per priority */
  private readonly messageQueues: Map<MessagePriority, QueueEntry[]>;

  /** Handler subscriptions */
  private readonly subscriptions: Map<string, HandlerSubscription[]>;

  /** Pending responses awaiting reply */
  private readonly pendingResponses: Map<string, PendingResponse>;

  /** Sent messages for correlation */
  private readonly sentMessages: Map<string, AgentMessage>;

  /** Message statistics */
  private stats: {
    messagesSent: number;
    messagesReceived: number;
    messagesDelivered: number;
    messagesFailed: number;
    broadcastCount: number;
  };

  /** Options */
  private options: Required<CommunicationBusOptions>;

  /** Is bus running */
  private running: boolean;

  /** Processing interval handle */
  private processInterval: ReturnType<typeof setInterval> | null;

  private constructor(options: CommunicationBusOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.messageQueues = new Map();
    this.subscriptions = new Map();
    this.pendingResponses = new Map();
    this.sentMessages = new Map();
    this.running = false;
    this.processInterval = null;
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      broadcastCount: 0,
    };

    // Initialize queues
    for (const priority of [MP.LOW, MP.NORMAL, MP.HIGH, MP.CRITICAL]) {
      this.messageQueues.set(priority, []);
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: CommunicationBusOptions): CommunicationBus {
    if (!CommunicationBus.instance) {
      CommunicationBus.instance = new CommunicationBus(options);
    }
    return CommunicationBus.instance;
  }

  /**
   * Start the communication bus
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, 10); // Process every 10ms
  }

  /**
   * Stop the communication bus
   */
  stop(): void {
    this.running = false;
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
  }

  /**
   * Check if bus is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Send a message to a specific agent
   *
   * @param fromAgentId - Sender agent ID
   * @param toAgentId - Recipient agent ID
   * @param type - Message type
   * @param payload - Message payload
   * @param priority - Message priority
   * @returns Promise resolving when message is delivered
   */
  async send(
    fromAgentId: string,
    toAgentId: string,
    type: MessageType,
    payload: Record<string, unknown>,
    priority: MessagePriority = MP.NORMAL
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      fromAgentId,
      toAgentId,
      type,
      payload,
      timestamp: Date.now(),
      priority,
      requiresResponse: false,
    };

    return this.sendMessage(message);
  }

  /**
   * Send a message and wait for response
   *
   * @param fromAgentId - Sender agent ID
   * @param toAgentId - Recipient agent ID
   * @param type - Message type
   * @param payload - Message payload
   * @param priority - Message priority
   * @param timeout - Timeout in ms
   * @returns Promise resolving with response message
   */
  async sendAndWaitForResponse(
    fromAgentId: string,
    toAgentId: string,
    type: MessageType,
    payload: Record<string, unknown>,
    priority: MessagePriority = MP.NORMAL,
    timeout?: number
  ): Promise<AgentMessage> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      fromAgentId,
      toAgentId,
      type,
      payload,
      timestamp: Date.now(),
      priority,
      requiresResponse: true,
    };

    // Create promise for response
    const responsePromise = new Promise<AgentMessage>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingResponses.delete(message.id);
        reject(new Error(`Message ${message.id} timed out waiting for response`));
      }, timeout ?? this.options.messageTimeout);

      this.pendingResponses.set(message.id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });
    });

    // Send the message
    await this.sendMessage(message);

    return responsePromise;
  }

  /**
   * Broadcast a message to all agents in a session
   *
   * @param fromAgentId - Sender agent ID
   * @param sessionId - Session ID
   * @param type - Message type
   * @param payload - Message payload
   * @param priority - Message priority
   * @returns Number of agents notified
   */
  async broadcast(
    fromAgentId: string,
    sessionId: string,
    type: MessageType,
    payload: Record<string, unknown>,
    priority: MessagePriority = MP.NORMAL
  ): Promise<number> {
    const message: AgentMessage = {
      id: this.generateMessageId(),
      fromAgentId,
      toAgentId: '*',
      type,
      payload: {
        ...payload,
        __sessionId: sessionId,
      },
      timestamp: Date.now(),
      priority,
      requiresResponse: false,
    };

    this.enqueue(message);
    this.stats.broadcastCount++;

    // Return count based on session subscription (approximate)
    return this.subscriptions.get(sessionId)?.length ?? 0;
  }

  /**
   * Subscribe to messages
   *
   * @param agentId - Agent ID to receive messages
   * @param messageType - Message type to receive (or '*' for all)
   * @param handler - Handler function
   * @param once - Unsubscribe after first message
   */
  subscribe(
    agentId: string,
    messageType: MessageType | '*',
    handler: MessageHandler,
    once = false
  ): () => void {
    const subscription: HandlerSubscription = {
      agentId,
      messageType,
      handler,
      once,
    };

    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, []);
    }

    this.subscriptions.get(agentId)!.push(subscription);

    // Return unsubscribe function
    return () => this.unsubscribe(agentId, messageType, handler);
  }

  /**
   * Unsubscribe from messages
   *
   * @param agentId - Agent ID
   * @param messageType - Message type
   * @param handler - Handler function (optional, removes all if not specified)
   */
  unsubscribe(
    agentId: string,
    messageType?: MessageType | '*',
    handler?: MessageHandler
  ): void {
    const subs = this.subscriptions.get(agentId);
    if (!subs) return;

    if (handler) {
      // Remove specific subscription
      const index = subs.findIndex(
        s => s.messageType === messageType && s.handler === handler
      );
      if (index >= 0) {
        subs.splice(index, 1);
      }
    } else if (messageType) {
      // Remove all subscriptions for message type
      const filtered = subs.filter(s => s.messageType !== messageType);
      this.subscriptions.set(agentId, filtered);
    } else {
      // Remove all subscriptions for agent
      this.subscriptions.delete(agentId);
    }
  }

  /**
   * Unsubscribe all handlers for an agent
   *
   * @param agentId - Agent ID
   */
  unsubscribeAll(agentId: string): void {
    this.subscriptions.delete(agentId);
  }

  /**
   * Send a response to a message
   *
   * @param originalMessage - Original message being responded to
   * @param payload - Response payload
   */
  async respond(
    originalMessage: AgentMessage,
    payload: Record<string, unknown>
  ): Promise<void> {
    const response: AgentMessage = {
      id: this.generateMessageId(),
      fromAgentId: originalMessage.toAgentId, // Respond from recipient to sender
      toAgentId: originalMessage.fromAgentId,
      type: 'response' as MessageType,
      payload,
      timestamp: Date.now(),
      priority: originalMessage.priority,
      requiresResponse: false,
      correlationId: originalMessage.id,
    };

    await this.sendMessage(response);
  }

  /**
   * Get statistics
   */
  getStats(): {
    messagesSent: number;
    messagesReceived: number;
    messagesDelivered: number;
    messagesFailed: number;
    broadcastCount: number;
    queueSize: number;
    pendingResponses: number;
    subscriptions: number;
  } {
    let queueSize = 0;
    for (const queue of this.messageQueues.values()) {
      queueSize += queue.length;
    }

    let subscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      subscriptions += subs.length;
    }

    return {
      ...this.stats,
      queueSize,
      pendingResponses: this.pendingResponses.size,
      subscriptions,
    };
  }

  /**
   * Clear all state
   */
  clear(): void {
    for (const queue of this.messageQueues.values()) {
      queue.length = 0;
    }
    this.subscriptions.clear();
    this.pendingResponses.forEach(p => clearTimeout(p.timeout));
    this.pendingResponses.clear();
    this.sentMessages.clear();
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      broadcastCount: 0,
    };
  }

  /**
   * Export state for persistence
   */
  export(): {
    sentMessages: AgentMessage[];
    stats: typeof this.stats;
  } {
    return {
      sentMessages: Array.from(this.sentMessages.values()),
      stats: { ...this.stats },
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Send a message (internal)
   */
  private async sendMessage(message: AgentMessage): Promise<AgentMessage> {
    this.sentMessages.set(message.id, message);
    this.enqueue(message);
    this.stats.messagesSent++;

    return message;
  }

  /**
   * Add message to appropriate priority queue
   */
  private enqueue(message: AgentMessage): void {
    const queue = this.messageQueues.get(message.priority);
    if (!queue) {
      this.debugLog(`Invalid message priority: ${message.priority}`);
      this.stats.messagesFailed++;
      return;
    }

    // Check queue size
    if (queue.length >= this.options.maxQueueSize) {
      // Remove oldest low priority message first
      const lowQueue = this.messageQueues.get(MP.LOW);
      if (lowQueue && lowQueue.length > 0) {
        lowQueue.shift();
      } else {
        this.debugLog(`Queue full for priority ${message.priority}`);
        this.stats.messagesFailed++;
        return;
      }
    }

    queue.push({
      message,
      timestamp: Date.now(),
      retryCount: 0,
    });

    this.stats.messagesReceived++;
  }

  /**
   * Process message queues
   */
  private processQueue(): void {
    if (!this.running) return;

    // Process in priority order: CRITICAL > HIGH > NORMAL > LOW
    const priorities: MessagePriority[] = [
      MP.CRITICAL,
      MP.HIGH,
      MP.NORMAL,
      MP.LOW,
    ];

    for (const priority of priorities) {
      const queue = this.messageQueues.get(priority);
      if (!queue) continue;

      // Process up to 10 messages per interval per priority
      let processed = 0;
      while (queue.length > 0 && processed < 10) {
        const entry = queue.shift();
        if (!entry) break;

        this.deliverMessage(entry.message);
        processed++;
      }
    }
  }

  /**
   * Deliver message to subscribers
   */
  private async deliverMessage(message: AgentMessage): Promise<void> {
    const { toAgentId, type } = message;

    try {
      // Handle responses to pending requests
      if (message.correlationId) {
        const pending = this.pendingResponses.get(message.correlationId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingResponses.delete(message.correlationId);
          pending.resolve(message);
          return;
        }
      }

      // Direct message
      if (toAgentId !== '*') {
        await this.deliverToAgent(toAgentId, message);
      } else {
        // Broadcast - deliver to all subscribers of this type
        await this.deliverBroadcast(message);
      }

      this.stats.messagesDelivered++;
    } catch (error) {
      this.debugLog(`Failed to deliver message ${message.id}:`, error);
      this.stats.messagesFailed++;
    }
  }

  /**
   * Deliver message to specific agent
   */
  private async deliverToAgent(agentId: string, message: AgentMessage): Promise<void> {
    const subscriptions = this.subscriptions.get(agentId);
    if (!subscriptions || subscriptions.length === 0) {
      // No subscribers - message will be dropped
      this.debugLog(`No subscriptions for agent ${agentId}`);
      return;
    }

    // Find matching subscriptions
    const matching = subscriptions.filter(
      s => s.messageType === '*' || s.messageType === message.type
    );

    // Deliver to all matching handlers
    const toRemove: string[] = [];
    for (const sub of matching) {
      try {
        await sub.handler(message);

        if (sub.once) {
          toRemove.push(sub.agentId + ':' + sub.messageType);
        }
      } catch (error) {
        this.debugLog(`Handler error for ${sub.agentId}:`, error);
      }
    }

    // Remove one-time subscriptions
    if (toRemove.length > 0) {
      const newSubs = subscriptions.filter(
        s => !toRemove.includes(s.agentId + ':' + s.messageType)
      );
      this.subscriptions.set(agentId, newSubs);
    }
  }

  /**
   * Deliver broadcast message
   */
  private async deliverBroadcast(message: AgentMessage): Promise<void> {
    const sessionId = message.payload.__sessionId as string | undefined;

    for (const [agentId, subscriptions] of this.subscriptions) {
      // Skip sender
      if (agentId === message.fromAgentId) continue;

      // If session specified, only deliver to agents in that session
      if (sessionId) {
        // Check if agent is in session (simplified check)
        // In real implementation, would check registry
      }

      // Find matching subscriptions
      const matching = subscriptions.filter(
        s => s.messageType === '*' || s.messageType === message.type
      );

      for (const sub of matching) {
        try {
          await sub.handler(message);

          if (sub.once) {
            const index = subscriptions.indexOf(sub);
            if (index >= 0) subscriptions.splice(index, 1);
          }
        } catch (error) {
          this.debugLog(`Broadcast handler error for ${agentId}:`, error);
        }
      }
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Debug logging
   */
  private debugLog(...args: unknown[]): void {
    if (this.options.debugLog) {
      // eslint-disable-next-line no-console
      console.log('[CommunicationBus]', ...args);
    }
  }
}

/**
 * Get communication bus instance
 */
export function getCommunicationBus(
  options?: CommunicationBusOptions
): CommunicationBus {
  return CommunicationBus.getInstance(options);
}

/**
 * Start the communication bus
 */
export function startCommunicationBus(
  options?: CommunicationBusOptions
): CommunicationBus {
  const bus = getCommunicationBus(options);
  bus.start();
  return bus;
}

/**
 * Convenience function to send a message
 */
export async function sendMessage(
  fromAgentId: string,
  toAgentId: string,
  type: MessageType,
  payload: Record<string, unknown>,
  priority?: MessagePriority
): Promise<AgentMessage> {
  const bus = getCommunicationBus();
  return bus.send(fromAgentId, toAgentId, type, payload, priority);
}

/**
 * Convenience function to broadcast a message
 */
export async function broadcastMessage(
  fromAgentId: string,
  sessionId: string,
  type: MessageType,
  payload: Record<string, unknown>,
  priority?: MessagePriority
): Promise<number> {
  const bus = getCommunicationBus();
  return bus.broadcast(fromAgentId, sessionId, type, payload, priority);
}

/**
 * Convenience function to subscribe to messages
 */
export function subscribeToMessages(
  agentId: string,
  messageType: MessageType | '*',
  handler: MessageHandler,
  once?: boolean
): () => void {
  const bus = getCommunicationBus();
  return bus.subscribe(agentId, messageType, handler, once);
}
