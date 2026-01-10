/**
 * StudyLoG.AI - Agent-to-Agent (A2A) Protocol
 *
 * Implements communication between agents using a message-passing
 * architecture. Supports request/response, delegation, events,
 * and broadcast patterns.
 */

import { EventEmitter } from 'events';
import type { BaseAgent } from './base-agent';
import type { A2AMessage, A2ARequest, A2AResponse, A2ACapability, A2AMessageType } from '../npc/types';

// Message queue entry
interface QueueEntry {
  message: A2AMessage;
  resolve: (response: A2AResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

// Agent registration
interface RegisteredAgent {
  id: string;
  agent: BaseAgent;
  capabilities: A2ACapability[];
  subscriptions: Set<string>;
}

export class A2AProtocol extends EventEmitter {
  private agents: Map<string, RegisteredAgent> = new Map();
  private messageQueue: Map<string, QueueEntry> = new Map();
  private messageHistory: A2AMessage[] = [];
  private maxHistorySize: number = 1000;
  private defaultTimeout: number = 30000;

  constructor() {
    super();
  }

  /**
   * Register an agent with the protocol
   */
  registerAgent(
    agent: BaseAgent,
    capabilities: A2ACapability[] = []
  ): void {
    const registered: RegisteredAgent = {
      id: agent.getId(),
      agent,
      capabilities,
      subscriptions: new Set(),
    };

    this.agents.set(agent.getId(), registered);
    this.emit('agent:registered', { agentId: agent.getId(), capabilities });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.emit('agent:unregistered', { agentId });
  }

  /**
   * Send a request to an agent and wait for response
   */
  async request(
    from: string,
    to: string,
    request: A2ARequest
  ): Promise<A2AResponse> {
    const message = this.createMessage(from, to, 'request', request, 'normal');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageQueue.delete(message.id);
        reject(new Error(`Request timeout: ${message.id}`));
      }, request.timeout || this.defaultTimeout);

      this.messageQueue.set(message.id, { message, resolve, reject, timeout });
      this.deliverMessage(message);
    });
  }

  /**
   * Send a response to a request
   */
  respond(to: string, correlationId: string, response: A2AResponse): void {
    const entry = this.messageQueue.get(correlationId);
    if (entry) {
      clearTimeout(entry.timeout);
      this.messageQueue.delete(correlationId);
      entry.resolve(response);
    }
  }

  /**
   * Delegate a task to another agent
   */
  async delegate(
    from: string,
    to: string,
    task: A2ARequest
  ): Promise<A2AResponse> {
    const message = this.createMessage(from, to, 'delegate', task, 'high');

    this.emit('delegation', { from, to, task: task.action });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageQueue.delete(message.id);
        reject(new Error(`Delegation timeout: ${message.id}`));
      }, task.timeout || this.defaultTimeout * 2);

      this.messageQueue.set(message.id, { message, resolve, reject, timeout });
      this.deliverMessage(message);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  notify(from: string, to: string, payload: unknown): void {
    const message = this.createMessage(from, to, 'notify', payload, 'low');
    this.deliverMessage(message);
  }

  /**
   * Broadcast a message to all agents
   */
  broadcast(from: string, payload: unknown, priority: A2AMessage['priority'] = 'normal'): void {
    const message = this.createMessage(from, '*', 'broadcast', payload, priority);

    for (const [agentId] of this.agents) {
      if (agentId !== from) {
        const targetMessage = { ...message, to: agentId };
        this.deliverMessage(targetMessage);
      }
    }
  }

  /**
   * Send an event to subscribed agents
   */
  emitEvent(from: string, eventType: string, payload: unknown): void {
    const message = this.createMessage(from, '*', 'event', { eventType, ...payload as object }, 'normal');

    for (const [agentId, registered] of this.agents) {
      if (agentId !== from && registered.subscriptions.has(eventType)) {
        const targetMessage = { ...message, to: agentId };
        this.deliverMessage(targetMessage);
      }
    }

    this.emit(`event:${eventType}`, { from, payload });
  }

  /**
   * Query agents for capabilities
   */
  query(from: string, capabilityName: string): string[] {
    const matchingAgents: string[] = [];

    for (const [agentId, registered] of this.agents) {
      if (agentId !== from) {
        const hasCapability = registered.capabilities.some(
          (cap) => cap.name === capabilityName
        );
        if (hasCapability) {
          matchingAgents.push(agentId);
        }
      }
    }

    return matchingAgents;
  }

  /**
   * Send a command to an agent
   */
  async command(
    from: string,
    to: string,
    commandName: string,
    parameters: Record<string, unknown>
  ): Promise<A2AResponse> {
    const message = this.createMessage(
      from,
      to,
      'command',
      { command: commandName, parameters },
      'high'
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageQueue.delete(message.id);
        reject(new Error(`Command timeout: ${message.id}`));
      }, this.defaultTimeout);

      this.messageQueue.set(message.id, { message, resolve, reject, timeout });
      this.deliverMessage(message);
    });
  }

  /**
   * Subscribe an agent to event types
   */
  subscribe(agentId: string, eventTypes: string[]): void {
    const registered = this.agents.get(agentId);
    if (registered) {
      eventTypes.forEach((type) => registered.subscriptions.add(type));
    }
  }

  /**
   * Unsubscribe an agent from event types
   */
  unsubscribe(agentId: string, eventTypes: string[]): void {
    const registered = this.agents.get(agentId);
    if (registered) {
      eventTypes.forEach((type) => registered.subscriptions.delete(type));
    }
  }

  /**
   * Create a new message
   */
  private createMessage(
    from: string,
    to: string,
    type: A2AMessageType,
    payload: unknown,
    priority: A2AMessage['priority']
  ): A2AMessage {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      from,
      to,
      type,
      payload,
      timestamp: new Date(),
      priority,
      ttl: this.defaultTimeout,
    };
  }

  /**
   * Deliver a message to its target
   */
  private async deliverMessage(message: A2AMessage): Promise<void> {
    // Store in history
    this.addToHistory(message);

    // Get target agent
    const registered = this.agents.get(message.to);
    if (!registered) {
      // If it's a request, reject it
      const entry = this.messageQueue.get(message.id);
      if (entry) {
        clearTimeout(entry.timeout);
        this.messageQueue.delete(message.id);
        entry.reject(new Error(`Agent not found: ${message.to}`));
      }
      return;
    }

    // Emit for monitoring
    this.emit('message', message);

    // Process message based on type
    try {
      const response = await this.processMessage(registered, message);

      // If this was a request/delegate/command, send response
      if (response && ['request', 'delegate', 'command'].includes(message.type)) {
        this.respond(message.from, message.id, response);
      }
    } catch (error) {
      const entry = this.messageQueue.get(message.id);
      if (entry) {
        clearTimeout(entry.timeout);
        this.messageQueue.delete(message.id);
        entry.reject(error as Error);
      }
    }
  }

  /**
   * Process a message at the target agent
   */
  private async processMessage(
    registered: RegisteredAgent,
    message: A2AMessage
  ): Promise<A2AResponse | undefined> {
    const agent = registered.agent;

    switch (message.type) {
      case 'request':
      case 'delegate':
      case 'command': {
        const request = message.payload as A2ARequest;

        // Call agent's handleA2AMessage if implemented
        if ('handleA2AMessage' in agent && typeof (agent as any).handleA2AMessage === 'function') {
          return await (agent as any).handleA2AMessage(message);
        }

        // Fallback: process as regular message
        const agentMessage = {
          role: 'user' as const,
          content: `[A2A:${message.type}:${message.from}] ${JSON.stringify(request)}`,
        };

        const response = await agent.process(agentMessage);

        return {
          success: true,
          result: response.content,
          metadata: {
            agentId: agent.getId(),
            processedAt: new Date().toISOString(),
          },
        };
      }

      case 'notify':
      case 'broadcast':
      case 'event': {
        // Fire and forget - emit event for agent to handle
        if ('onA2ANotification' in agent && typeof (agent as any).onA2ANotification === 'function') {
          (agent as any).onA2ANotification(message);
        }
        return undefined;
      }

      default:
        return {
          success: false,
          error: `Unknown message type: ${message.type}`,
        };
    }
  }

  /**
   * Add message to history
   */
  private addToHistory(message: A2AMessage): void {
    this.messageHistory.push(message);

    // Trim history if needed
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize / 2);
    }
  }

  /**
   * Get message history
   */
  getHistory(limit?: number): A2AMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }

  /**
   * Get registered agents
   */
  getAgents(): Map<string, RegisteredAgent> {
    return new Map(this.agents);
  }

  /**
   * Get agent capabilities
   */
  getCapabilities(agentId: string): A2ACapability[] {
    const registered = this.agents.get(agentId);
    return registered ? [...registered.capabilities] : [];
  }

  /**
   * Find best agent for a capability
   */
  findBestAgent(capabilityName: string, context?: Record<string, unknown>): string | undefined {
    const candidates = this.query('system', capabilityName);

    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];

    // Simple scoring - could be enhanced with more sophisticated logic
    // For now, just return the first one
    return candidates[0];
  }

  /**
   * Clear all pending messages
   */
  clearPending(): void {
    for (const [id, entry] of this.messageQueue) {
      clearTimeout(entry.timeout);
      entry.reject(new Error('Queue cleared'));
    }
    this.messageQueue.clear();
  }

  /**
   * Get protocol stats
   */
  getStats(): {
    registeredAgents: number;
    pendingMessages: number;
    historySize: number;
  } {
    return {
      registeredAgents: this.agents.size,
      pendingMessages: this.messageQueue.size,
      historySize: this.messageHistory.length,
    };
  }
}

// Singleton instance
let protocolInstance: A2AProtocol | undefined;

export function getA2AProtocol(): A2AProtocol {
  if (!protocolInstance) {
    protocolInstance = new A2AProtocol();
  }
  return protocolInstance;
}

export function createA2AProtocol(): A2AProtocol {
  return new A2AProtocol();
}

// Helper class for agents to use A2A easily
export class A2AClient {
  private protocol: A2AProtocol;
  private agentId: string;

  constructor(agentId: string, protocol?: A2AProtocol) {
    this.agentId = agentId;
    this.protocol = protocol || getA2AProtocol();
  }

  async request(to: string, action: string, parameters: Record<string, unknown>): Promise<A2AResponse> {
    return this.protocol.request(this.agentId, to, { action, parameters });
  }

  async delegate(to: string, action: string, parameters: Record<string, unknown>): Promise<A2AResponse> {
    return this.protocol.delegate(this.agentId, to, { action, parameters });
  }

  notify(to: string, payload: unknown): void {
    this.protocol.notify(this.agentId, to, payload);
  }

  broadcast(payload: unknown): void {
    this.protocol.broadcast(this.agentId, payload);
  }

  emitEvent(eventType: string, payload: unknown): void {
    this.protocol.emitEvent(this.agentId, eventType, payload);
  }

  findAgent(capability: string): string | undefined {
    return this.protocol.findBestAgent(capability);
  }

  subscribe(eventTypes: string[]): void {
    this.protocol.subscribe(this.agentId, eventTypes);
  }
}
