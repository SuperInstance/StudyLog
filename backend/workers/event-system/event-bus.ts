/**
 * Event Bus Implementation
 *
 * In-memory event bus for Cloudflare Workers with Queue integration.
 * Handles event publication, subscriptions, and delivery.
 */

import type {
  BaseEvent,
  EventSubscription,
  SubscriptionFilter,
  EventEnvelope,
} from './types';
import type { Env } from './types';

// ============================================================================
// Event Bus Class
// ============================================================================

export class EventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private queue?: Queue;
  private deadLetterQueue?: Queue;

  constructor(queue?: Queue, deadLetterQueue?: Queue) {
    this.queue = queue;
    this.deadLetterQueue = deadLetterQueue;
  }

  // ========================================================================
  // Subscription Management
  // ========================================================================

  /**
   * Subscribe to events matching a filter.
   *
   * @param name - Subscription name
   * @param filter - Event filter criteria
   * @param handler - Event handler function
   * @returns Subscription ID
   */
  subscribe(
    name: string,
    filter: SubscriptionFilter,
    handler: (event: BaseEvent) => Promise<void>
  ): string {
    const id = crypto.randomUUID();

    const subscription: EventSubscription = {
      id,
      name,
      filter,
      handler,
      status: 'active',
      delivery: 'inline',
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.subscriptions.set(id, subscription);

    return id;
  }

  /**
   * Unsubscribe by ID.
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Get a subscription by ID.
   */
  getSubscription(subscriptionId: string): EventSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * List all active subscriptions.
   */
  listSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Pause a subscription.
   */
  pauseSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.status = 'paused';
      sub.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Resume a paused subscription.
   */
  resumeSubscription(subscriptionId: string): boolean {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.status = 'active';
      sub.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  // ========================================================================
  // Event Publishing
  // ========================================================================

  /**
   * Publish an event to all matching subscribers.
   *
   * @param event - Event to publish
   * @param env - Environment for async handlers
   * @returns Number of subscribers notified
   */
  async publish(event: BaseEvent, env?: Env): Promise<number> {
    let notifiedCount = 0;

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'active' && this.matchesFilter(event, sub.filter));

    // Execute handlers
    const results = matchingSubscriptions.map(async (sub) => {
      try {
        // For inline delivery, execute immediately
        if (sub.delivery === 'inline') {
          await sub.handler(event);
          notifiedCount++;
        }
        // For queue delivery, send to Cloudflare Queue
        else if (sub.delivery === 'queue' && this.queue) {
          await this.sendToQueue(event, sub);
          notifiedCount++;
        }
        // For webhook delivery, send HTTP request
        else if (sub.delivery === 'webhook' && sub.webhookUrl) {
          await this.sendWebhook(event, sub);
          notifiedCount++;
        }

        return { subscription: sub.id, success: true };
      } catch (error) {
        console.error(`Handler error for subscription ${sub.id}:`, error);

        // Send to dead letter queue if available
        if (this.deadLetterQueue) {
          await this.sendToDeadLetter(event, sub, error);
        }

        return { subscription: sub.id, success: false, error };
      }
    });

    await Promise.allSettled(results);

    return notifiedCount;
  }

  /**
   * Publish multiple events in batch.
   */
  async publishBatch(events: BaseEvent[], env?: Env): Promise<number> {
    let totalNotified = 0;

    for (const event of events) {
      totalNotified += await this.publish(event, env);
    }

    return totalNotified;
  }

  // ========================================================================
  // Queue Integration
  // ========================================================================

  /**
   * Send event to Cloudflare Queue for async processing.
   */
  private async sendToQueue(
    event: BaseEvent,
    subscription: EventSubscription
  ): Promise<void> {
    if (!this.queue) {
      throw new Error('Queue not configured');
    }

    const envelope: EventEnvelope = {
      eventId: crypto.randomUUID(),
      eventType: event.type,
      payload: event,
      retryCount: 0,
      maxRetries: subscription.maxRetries ?? 3,
    };

    await this.queue.send(envelope);
  }

  /**
   * Send failed event to dead letter queue.
   */
  private async sendToDeadLetter(
    event: BaseEvent,
    subscription: EventSubscription,
    error: unknown
  ): Promise<void> {
    if (!this.deadLetterQueue) {
      return;
    }

    const envelope: EventEnvelope = {
      eventId: crypto.randomUUID(),
      eventType: event.type,
      payload: event,
      retryCount: subscription.maxRetries ?? 3,
      maxRetries: subscription.maxRetries ?? 3,
      deadLetter: true,
    };

    const metadata = {
      subscriptionId: subscription.id,
      subscriptionName: subscription.name,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };

    await this.deadLetterQueue.send({ envelope, metadata });
  }

  /**
   * Send event to webhook URL.
   */
  private async sendWebhook(
    event: BaseEvent,
    subscription: EventSubscription
  ): Promise<void> {
    if (!subscription.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const response = await fetch(subscription.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-ID': event.id,
        'X-Event-Type': event.type,
        'X-Subscription-ID': subscription.id,
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  // ========================================================================
  // Filter Matching
  // ========================================================================

  /**
   * Check if an event matches a subscription filter.
   */
  private async matchesFilter(
    event: BaseEvent,
    filter: SubscriptionFilter
  ): Promise<boolean> {
    // Check event types
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }

    // Check aggregate types
    if (filter.aggregateTypes && !filter.aggregateTypes.includes(event.aggregateType)) {
      return false;
    }

    // Check tenant ID
    if (filter.tenantId && filter.tenantId !== event.metadata.tenantId) {
      return false;
    }

    // Custom filter
    if (filter.custom) {
      return await filter.custom(event);
    }

    return true;
  }
}

// ============================================================================
// Global Event Bus Instance
// ============================================================================

let globalEventBus: EventBus | undefined;

/**
 * Get or create the global event bus instance.
 */
export function getEventBus(env?: Env): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus(
      env?.EVENT_QUEUE,
      env?.DEAD_LETTER_QUEUE
    );
  }
  return globalEventBus;
}

/**
 * Reset the global event bus (useful for testing).
 */
export function resetEventBus(): void {
  globalEventBus = undefined;
}
