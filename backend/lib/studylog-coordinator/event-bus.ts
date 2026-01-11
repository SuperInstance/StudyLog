/**
 * Event Bus for StudyLoG.AI Agent Coordinator
 *
 * Provides pub/sub event system for reactive coordination
 */

import { Event, EventType, EventHandler, EventFilter, EventSubscription } from "./types.js";

/**
 * Event Bus Options
 */
export interface EventBusOptions {
  /** Maximum number of events to keep in history */
  historyMaxSize?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event Bus for coordinator-wide event notifications
 *
 * Features:
 * - Type-based subscriptions
 * - Event filtering
 * - Async event delivery
 * - Wildcard subscriptions
 * - One-time subscriptions
 * - Event history tracking
 */
export class EventBus {
  private _subscriptions: EventSubscription[] = [];
  private _eventHistory: Event[] = [];
  private _historyMaxSize: number;
  private _subscriptionCounter = 0;
  private _debug: boolean;

  constructor(options: EventBusOptions = {}) {
    this._historyMaxSize = options.historyMaxSize ?? 1000;
    this._debug = options.debug ?? false;
  }

  /**
   * Emit an event to all matching subscribers
   */
  async emit(event: Event): Promise<void> {
    // Add to history
    this._eventHistory.push(event);
    if (this._eventHistory.length > this._historyMaxSize) {
      this._eventHistory.shift();
    }

    if (this._debug) {
      console.log(`[EventBus] Emitting: ${event.type}`, event.data);
    }

    // Find matching subscriptions
    const toRemove: EventSubscription[] = [];
    const promises: Promise<void>[] = [];

    for (const sub of this._subscriptions) {
      if (this._matches(sub, event)) {
        const promise = (async () => {
          try {
            await sub.handler(event);
          } catch (error) {
            console.error(`[EventBus] Handler error for ${event.type}:`, error);
          }
        })();
        promises.push(promise);

        if (sub.once) {
          toRemove.push(sub);
        }
      }
    }

    // Remove one-time subscriptions
    for (const sub of toRemove) {
      this._subscriptions = this._subscriptions.filter((s) => s.id !== sub.id);
    }

    // Wait for all handlers to complete
    await Promise.all(promises);
  }

  /**
   * Subscribe to events
   *
   * @param eventTypes - List of event types to subscribe to
   * @param handler - Handler function for events
   * @param filter - Optional filter function
   * @param once - If true, unsubscribe after first event
   * @returns Subscription ID
   */
  subscribe(
    eventTypes: EventType[],
    handler: EventHandler,
    filter?: EventFilter,
    once = false
  ): string {
    this._subscriptionCounter++;
    const subId = `sub_${this._subscriptionCounter}`;

    const subscription: EventSubscription = {
      id: subId,
      eventTypes,
      handler,
      filter,
      once,
    };

    this._subscriptions.push(subscription);

    if (this._debug) {
      console.log(
        `[EventBus] Created subscription ${subId} for [${eventTypes.join(", ")}]`
      );
    }

    return subId;
  }

  /**
   * Subscribe to events that will fire only once
   */
  subscribeOnce(
    eventTypes: EventType[],
    handler: EventHandler,
    filter?: EventFilter
  ): string {
    return this.subscribe(eventTypes, handler, filter, true);
  }

  /**
   * Unsubscribe by subscription ID
   */
  unsubscribe(subId: string): boolean {
    const initialLength = this._subscriptions.length;
    this._subscriptions = this._subscriptions.filter((s) => s.id !== subId);

    if (this._subscriptions.length < initialLength) {
      if (this._debug) {
        console.log(`[EventBus] Removed subscription ${subId}`);
      }
      return true;
    }
    return false;
  }

  /**
   * Unsubscribe all subscriptions for a handler
   */
  unsubscribeAll(handler: EventHandler): number {
    const toRemove = this._subscriptions.filter((s) => s.handler === handler);
    this._subscriptions = this._subscriptions.filter(
      (s) => s.handler !== handler
    );

    if (this._debug) {
      console.log(`[EventBus] Removed ${toRemove.length} subscriptions`);
    }

    return toRemove.length;
  }

  /**
   * Get event history
   *
   * @param eventType - Optional filter by event type
   * @param limit - Maximum number of events to return
   */
  getHistory(eventType?: EventType, limit = 100): Event[] {
    let events = this._eventHistory;

    if (eventType) {
      events = events.filter((e) => e.type === eventType);
    }

    return events.slice(-limit);
  }

  /**
   * Get count of events by type
   */
  getEventCount(eventType?: EventType): number {
    if (eventType) {
      return this._eventHistory.filter((e) => e.type === eventType).length;
    }
    return this._eventHistory.length;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this._eventHistory = [];
  }

  /**
   * Get all current subscriptions
   */
  getSubscriptions(): EventSubscription[] {
    return [...this._subscriptions];
  }

  /**
   * Check if subscription matches event
   */
  private _matches(subscription: EventSubscription, event: Event): boolean {
    // Check event type (including wildcard)
    const hasWildcard = subscription.eventTypes.includes("*" as EventType);
    const typeMatches =
      hasWildcard || subscription.eventTypes.includes(event.type);

    if (!typeMatches) {
      return false;
    }

    // Check filter
    if (subscription.filter) {
      return subscription.filter(event);
    }

    return true;
  }

  /**
   * Create an event object
   */
  static createEvent(
    type: EventType,
    data: Record<string, unknown>,
    source = ""
  ): Event {
    return {
      type,
      data,
      timestamp: new Date(),
      source,
    };
  }

  /**
   * Wait for a specific event
   *
   * @param eventTypes - Event types to wait for
   * @param filter - Optional filter
   * @param timeout - Maximum wait time in ms (default: 30000)
   */
  async waitFor(
    eventTypes: EventType[],
    filter?: EventFilter,
    timeout = 30000
  ): Promise<Event | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.unsubscribe(subId);
        resolve(null);
      }, timeout);

      const subId = this.subscribeOnce(eventTypes, (event) => {
        clearTimeout(timer);
        resolve(event);
      }, filter);
    });
  }
}

/**
 * Global event bus instance
 */
let globalEventBus: EventBus | null = null;

/**
 * Get the global event bus instance
 */
export function getGlobalEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

/**
 * Reset the global event bus (useful for testing)
 */
export function resetGlobalEventBus(): void {
  globalEventBus = null;
}

/**
 * Emit an event to the global event bus
 */
export async function emitEvent(
  type: EventType,
  data: Record<string, unknown>,
  source = ""
): Promise<void> {
  const bus = getGlobalEventBus();
  const event = EventBus.createEvent(type, data, source);
  await bus.emit(event);
}

/**
 * Subscribe to events on the global event bus
 */
export function subscribe(
  eventTypes: EventType[],
  handler: EventHandler,
  filter?: EventFilter
): string {
  const bus = getGlobalEventBus();
  return bus.subscribe(eventTypes, handler, filter);
}

/**
 * Unsubscribe from events on the global event bus
 */
export function unsubscribe(subId: string): boolean {
  const bus = getGlobalEventBus();
  return bus.unsubscribe(subId);
}
