/**
 * Real-Time Communication System - Main Entry Point
 *
 * Cloudflare Worker for WebSocket connections, presence, and signaling.
 */

import type {
  Room,
  RoomType,
  CreateRoomRequest,
  Env,
  WSMessage,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
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
          service: 'realtime',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      }

      // Room management
      if (pathname === '/rooms' && request.method === 'POST') {
        return await handleCreateRoom(request, env);
      }

      if (pathname.match(/^\/rooms\/[^/]+$/) && request.method === 'GET') {
        const roomId = pathname.split('/')[2];
        return await handleGetRoom(roomId, env);
      }

      if (pathname.match(/^\/rooms\/[^/]+$/) && request.method === 'DELETE') {
        const roomId = pathname.split('/')[2];
        return await handleDeleteRoom(roomId, env);
      }

      if (pathname === '/rooms' && request.method === 'GET') {
        return await handleListRooms(url, env);
      }

      // WebSocket connection to room
      if (pathname.match(/^\/rooms\/[^/]+\/connect/)) {
        const roomId = pathname.split('/')[2];
        return await handleRoomConnect(roomId, request, env);
      }

      // Presence
      if (pathname === '/presence' && request.method === 'GET') {
        return await handleGetPresence(url, env);
      }

      if (pathname === '/presence' && request.method === 'PUT') {
        return await handleUpdatePresence(request, env);
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
      console.error('Realtime error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ============================================================================
// Route Handlers
// ============================================================================

async function handleCreateRoom(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as CreateRoomRequest;

  if (!body.name || !body.tenantId || !body.ownerId) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: name, tenantId, ownerId',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate room ID
  const roomId = crypto.randomUUID();

  // Get or create Room DO stub
  const roomDO = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));

  // Initialize room via DO
  await roomDO.fetch(new Request('https://do.internal/init', {
    method: 'POST',
    body: JSON.stringify({
      id: roomId,
      name: body.name,
      type: body.type || 'classroom',
      tenantId: body.tenantId,
      ownerId: body.ownerId,
      settings: body.settings,
    }),
  }));

  // Persist to database
  await env.DB.prepare(`
    INSERT INTO rooms (
      id, name, type, tenant_id, owner_id, max_participants,
      settings, scheduled_for, duration_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    roomId,
    body.name,
    body.type || 'classroom',
    body.tenantId,
    body.ownerId,
    body.maxParticipants || 50,
    JSON.stringify(body.settings || {}),
    body.scheduledFor || null,
    body.durationMinutes || null,
    new Date().toISOString()
  ).run();

  return new Response(JSON.stringify({
    success: true,
    room: {
      id: roomId,
      name: body.name,
      type: body.type || 'classroom',
      connectUrl: `/rooms/${roomId}/connect`,
    },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetRoom(roomId: string, env: Env): Promise<Response> {
  const roomDO = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
  const response = await roomDO.fetch(new Request(`https://do.internal/`, {
    method: 'GET',
  }));

  const room = await response.json();

  return new Response(JSON.stringify(room), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDeleteRoom(roomId: string, env: Env): Promise<Response> {
  const roomDO = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));
  await roomDO.fetch(new Request('https://do.internal/end', {
    method: 'POST',
  }));

  await env.DB.prepare(
    'UPDATE rooms SET state = ?, ended_at = ? WHERE id = ?'
  ).bind('ended', new Date().toISOString(), roomId).run();

  return new Response(JSON.stringify({
    success: true,
    message: 'Room ended',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListRooms(url: URL, env: Env): Promise<Response> {
  const tenantId = url.searchParams.get('tenantId');
  const state = url.searchParams.get('state');
  const type = url.searchParams.get('type');

  let query = 'SELECT * FROM rooms WHERE state != ?';
  const params: (string | number)[] = ['ended'];

  if (tenantId) {
    query += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  if (state) {
    query += ' AND state = ?';
    params.push(state);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  const result = await env.DB.prepare(query).bind(...params).all();

  return new Response(JSON.stringify({
    rooms: result.results,
    count: result.results.length,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRoomConnect(roomId: string, request: Request, env: Env): Promise<Response> {
  const roomDO = env.ROOM_DO.get(env.ROOM_DO.idFromName(roomId));

  // Forward the upgrade request to the DO
  const doUrl = new URL(request.url);
  doUrl.hostname = `${roomId}.rooms.internal`;

  return roomDO.fetch(new Request(doUrl.toString(), request));
}

async function handleGetPresence(url: URL, env: Env): Promise<Response> {
  const tenantId = url.searchParams.get('tenantId');
  const roomId = url.searchParams.get('roomId');

  if (!tenantId) {
    return new Response(JSON.stringify({
      error: 'Missing tenantId parameter',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let query = 'SELECT * FROM presence WHERE tenant_id = ?';
  const params: string[] = [tenantId];

  if (roomId) {
    query += ' AND current_room = ?';
    params.push(roomId);
  }

  const result = await env.DB.prepare(query).bind(...params).all();

  // Transform to presence objects
  const presence = result.results.map((row: any) => ({
    userId: row.user_id,
    status: row.status,
    currentRoom: row.current_room,
    lastSeen: row.last_seen,
    device: row.device ? JSON.parse(row.device) : undefined,
    activity: row.activity,
  }));

  return new Response(JSON.stringify({ presence }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdatePresence(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const { userId, status, activity, currentRoom } = body;

  if (!userId || !status) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: userId, status',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await env.DB.prepare(`
    INSERT INTO presence (user_id, status, activity, current_room, last_seen)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      status = excluded.status,
      activity = excluded.activity,
      current_room = excluded.current_room,
      last_seen = excluded.last_seen
  `).bind(
    userId,
    status,
    activity || null,
    currentRoom || null,
    new Date().toISOString()
  ).run();

  // Cache presence
  await env.PRESENCE_CACHE.put(`presence:${userId}`, JSON.stringify({
    status,
    activity,
    currentRoom,
    lastSeen: new Date().toISOString(),
  }), {
    expirationTtl: 300,
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Type Exports
// ============================================================================

export type { Room, RoomType, CreateRoomRequest, Env, WSMessage };
