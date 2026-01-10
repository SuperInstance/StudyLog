/**
 * StudyLoG.AI Backend - Game State Routes
 */

import { Router } from '../router';
import { requireAuth } from '../middleware';
import type { Env } from '../types';

export const gameRoutes = new Router();

// POST /session/start - Start a new game session
gameRoutes.post('/session/start', async (request, env: Env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as {
    module: string;
    scene: string;
  };

  if (!body.module || !body.scene) {
    return Response.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'module and scene required' } },
      { status: 400 }
    );
  }

  // End any active session
  await env.STUDENT_STATE.prepare(`
    UPDATE game_sessions
    SET ended_at = datetime('now')
    WHERE student_id = ? AND ended_at IS NULL
  `).bind(auth.studentId).run();

  // Create new session
  const sessionId = crypto.randomUUID();
  await env.STUDENT_STATE.prepare(`
    INSERT INTO game_sessions (id, student_id, module, scene)
    VALUES (?, ?, ?, ?)
  `).bind(sessionId, auth.studentId, body.module, body.scene).run();

  return Response.json({
    success: true,
    data: { sessionId, module: body.module, scene: body.scene },
  });
});

// POST /session/:id/save - Save game state
gameRoutes.post('/session/:id/save', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { id } = params;
  const body = await request.json() as { state: Record<string, unknown> };

  // Verify session ownership
  const session = await env.STUDENT_STATE.prepare(`
    SELECT id FROM game_sessions WHERE id = ? AND student_id = ? AND ended_at IS NULL
  `).bind(id, auth.studentId).first();

  if (!session) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Session not found or ended' } },
      { status: 404 }
    );
  }

  await env.STUDENT_STATE.prepare(`
    UPDATE game_sessions
    SET state = ?, last_save_at = datetime('now')
    WHERE id = ?
  `).bind(JSON.stringify(body.state), id).run();

  return Response.json({ success: true, data: { saved: true } });
});

// GET /session/:id - Get game session
gameRoutes.get('/session/:id', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { id } = params;

  const session = await env.STUDENT_STATE.prepare(`
    SELECT id, module, scene, state, started_at, last_save_at
    FROM game_sessions
    WHERE id = ? AND student_id = ?
  `).bind(id, auth.studentId).first<{
    id: string;
    module: string;
    scene: string;
    state: string;
    started_at: string;
    last_save_at: string;
  }>();

  if (!session) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } },
      { status: 404 }
    );
  }

  return Response.json({
    success: true,
    data: {
      ...session,
      state: JSON.parse(session.state || '{}'),
    },
  });
});

// POST /session/:id/end - End game session
gameRoutes.post('/session/:id/end', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { id } = params;

  const result = await env.STUDENT_STATE.prepare(`
    UPDATE game_sessions
    SET ended_at = datetime('now')
    WHERE id = ? AND student_id = ? AND ended_at IS NULL
  `).bind(id, auth.studentId).run();

  if (result.meta.changes === 0) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Session not found or already ended' } },
      { status: 404 }
    );
  }

  return Response.json({ success: true, data: { ended: true } });
});

// GET /session/active - Get current active session
gameRoutes.get('/session/active', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const session = await env.STUDENT_STATE.prepare(`
    SELECT id, module, scene, state, started_at, last_save_at
    FROM game_sessions
    WHERE student_id = ? AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `).bind(auth.studentId).first();

  if (!session) {
    return Response.json({
      success: true,
      data: null,
    });
  }

  return Response.json({
    success: true,
    data: session,
  });
});

// POST /puzzle/:id/attempt - Submit puzzle attempt
gameRoutes.post('/puzzle/:id/attempt', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as {
    puzzleId: string;
    solution: string;
    hintsUsed: number;
    timeSpentSeconds: number;
  };

  // Verify puzzle exists
  const puzzle = await env.STUDENT_STATE.prepare(`
    SELECT id, solution_hash, xp_reward FROM puzzles WHERE id = ?
  `).bind(body.puzzleId).first<{
    id: string;
    solution_hash: string;
    xp_reward: number;
  }>();

  if (!puzzle) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Puzzle not found' } },
      { status: 404 }
    );
  }

  // Check solution (simple hash comparison)
  const solutionHash = await hashSolution(body.solution);
  const isCorrect = solutionHash === puzzle.solution_hash;

  // Record attempt
  const attemptId = crypto.randomUUID();
  await env.STUDENT_STATE.prepare(`
    INSERT INTO puzzle_attempts (id, student_id, puzzle_id, solution, is_correct, hints_used, time_spent_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    attemptId,
    auth.studentId,
    body.puzzleId,
    body.solution,
    isCorrect ? 1 : 0,
    body.hintsUsed,
    body.timeSpentSeconds
  ).run();

  let xpEarned = 0;
  if (isCorrect) {
    // Calculate XP with hint penalty
    xpEarned = Math.max(1, puzzle.xp_reward - body.hintsUsed * 5);

    // Check if first time solving
    const previousCorrect = await env.STUDENT_STATE.prepare(`
      SELECT id FROM puzzle_attempts
      WHERE student_id = ? AND puzzle_id = ? AND is_correct = 1 AND id != ?
    `).bind(auth.studentId, body.puzzleId, attemptId).first();

    if (!previousCorrect) {
      // First solve - award XP
      // (XP tracking happens in module_progress, managed by client)
    }
  }

  return Response.json({
    success: true,
    data: {
      attemptId,
      isCorrect,
      xpEarned: isCorrect ? xpEarned : 0,
    },
  });
});

// Helper: Hash solution for comparison
async function hashSolution(solution: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(solution.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}
