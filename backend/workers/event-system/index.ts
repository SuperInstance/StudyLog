/**
 * Event System - Main Entry Point
 *
 * Cloudflare Worker for event sourcing and projections.
 */

import { EventStore, createEventStore } from './event-store';
import { EventBus, getEventBus } from './event-bus';
import { ProjectionManager, StudentProgressProjection, CostTrackingProjection } from './projections';
import type { BaseEvent, Env } from './types';

// ============================================================================
// Event System API Routes
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export interface EventSystemEnv extends Env {
  EVENT_QUEUE?: Queue;
  DEAD_LETTER_QUEUE?: Queue;
}

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: EventSystemEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (pathname === '/health') {
        return Response.json({
          status: 'healthy',
          service: 'event-system',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      }

      // Event store operations
      if (pathname === '/events/append' && request.method === 'POST') {
        return await handleAppendEvents(request, env);
      }

      if (pathname.startsWith('/events/') && request.method === 'GET') {
        const aggregateId = pathname.split('/')[2];
        return await handleGetEvents(aggregateId, url, env);
      }

      // Stream operations
      if (pathname === '/stream' && request.method === 'GET') {
        return await handleGetStream(url, env);
      }

      // Projection operations
      if (pathname === '/projections' && request.method === 'GET') {
        return await handleListProjections(env);
      }

      if (pathname === '/projections/process' && request.method === 'POST') {
        return await handleProcessProjections(env);
      }

      if (pathname.startsWith('/projections/') && pathname.endsWith('/rebuild') && request.method === 'POST') {
        const name = pathname.split('/')[2];
        return await handleRebuildProjection(name, env);
      }

      // Subscription operations
      if (pathname === '/subscriptions' && request.method === 'GET') {
        return await handleListSubscriptions();
      }

      // Snapshot operations
      if (pathname.startsWith('/snapshots/') && request.method === 'GET') {
        const aggregateId = pathname.split('/')[2];
        return await handleGetSnapshot(aggregateId, env);
      }

      // 404
      return new Response(JSON.stringify({
        error: 'Not found',
        path: pathname,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Event system error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  // Queue consumer for async event processing
  async queue(
    batch: MessageBatch<any>,
    env: EventSystemEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const eventStore = createEventStore(env);
    const eventBus = getEventBus(env);

    for (const message of batch.messages) {
      try {
        const { eventId, eventType, payload } = message.body;

        // Process the event through subscriptions
        await eventBus.publish(payload as BaseEvent, env);

        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  },
};

// ============================================================================
// Route Handlers
// ============================================================================

async function handleAppendEvents(
  request: Request,
  env: EventSystemEnv
): Promise<Response> {
  const body = await request.json();
  const { aggregateId, aggregateType, events, expectedVersion } = body;

  if (!aggregateId || !aggregateType || !events) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: aggregateId, aggregateType, events',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventStore = createEventStore(env);
  const eventBus = getEventBus(env);

  // Append to store
  const newVersion = await eventStore.appendEvents(
    aggregateId,
    aggregateType,
    events,
    expectedVersion
  );

  // Publish to event bus
  const fullEvents: BaseEvent[] = events.map((e: any, idx: number) => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: (expectedVersion || 0) + idx + 1,
    ...e,
  }));

  await eventBus.publishBatch(fullEvents, env);

  return new Response(JSON.stringify({
    success: true,
    version: newVersion,
    eventsProcessed: events.length,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetEvents(
  aggregateId: string,
  url: URL,
  env: EventSystemEnv
): Promise<Response> {
  const fromVersion = parseInt(url.searchParams.get('fromVersion') || '0', 10);

  const eventStore = createEventStore(env);
  const events = await eventStore.getEvents(aggregateId, fromVersion);

  return new Response(JSON.stringify({
    aggregateId,
    fromVersion,
    events,
    count: events.length,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetStream(
  url: URL,
  env: EventSystemEnv
): Promise<Response> {
  const options = {
    fromSequence: parseInt(url.searchParams.get('fromSequence') || '0', 10),
    limit: parseInt(url.searchParams.get('limit') || '100', 10),
    eventType: url.searchParams.get('eventType') || undefined,
    aggregateType: url.searchParams.get('aggregateType') || undefined,
    tenantId: url.searchParams.get('tenantId') || undefined,
  };

  const eventStore = createEventStore(env);
  const stream = await eventStore.getStream(options);

  return new Response(JSON.stringify(stream), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListProjections(env: EventSystemEnv): Promise<Response> {
  const projectionManager = new ProjectionManager(
    createEventStore(env),
    env.DB
  );

  // Register built-in projections
  projectionManager.registerHandler(StudentProgressProjection.handler);
  projectionManager.registerHandler(CostTrackingProjection.handler);

  const handlers = projectionManager.listHandlers();

  return new Response(JSON.stringify({
    projections: handlers.map(h => ({
      name: h.name,
      eventTypes: h.eventTypes,
    })),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleProcessProjections(env: EventSystemEnv): Promise<Response> {
  const projectionManager = new ProjectionManager(
    createEventStore(env),
    env.DB
  );

  // Register built-in projections
  projectionManager.registerHandler(StudentProgressProjection.handler);
  projectionManager.registerHandler(CostTrackingProjection.handler);

  const updated = await projectionManager.processAll();

  return new Response(JSON.stringify({
    success: true,
    updated,
    timestamp: new Date().toISOString(),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRebuildProjection(
  name: string,
  env: EventSystemEnv
): Promise<Response> {
  const projectionManager = new ProjectionManager(
    createEventStore(env),
    env.DB
  );

  // Register built-in projections
  projectionManager.registerHandler(StudentProgressProjection.handler);
  projectionManager.registerHandler(CostTrackingProjection.handler);

  const replayId = await projectionManager.rebuild(name);

  return new Response(JSON.stringify({
    success: true,
    replayId,
    projection: name,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListSubscriptions(): Promise<Response> {
  const eventBus = getEventBus();
  const subscriptions = eventBus.listSubscriptions();

  return new Response(JSON.stringify({
    subscriptions: subscriptions.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      delivery: s.delivery,
      eventTypes: s.filter.eventTypes,
    })),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetSnapshot(
  aggregateId: string,
  env: EventSystemEnv
): Promise<Response> {
  const eventStore = createEventStore(env);
  const snapshot = await eventStore.getLatestSnapshot(aggregateId);

  if (!snapshot) {
    return new Response(JSON.stringify({
      error: 'Snapshot not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    ...snapshot,
    state: JSON.parse(snapshot.state),
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Exports
// ============================================================================

export { EventStore, EventBus, ProjectionManager };
export type { BaseEvent, Env, EventSystemEnv };
