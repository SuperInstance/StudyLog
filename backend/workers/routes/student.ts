/**
 * StudyLoG.AI Backend - Student Routes
 */

import { Router } from '../router';
import { requireAuth } from '../middleware';
import type { Env } from '../types';

export const studentRoutes = new Router();

// GET /progress - Get all module progress
studentRoutes.get('/progress', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const progress = await env.STUDENT_STATE.prepare(`
    SELECT module, current_stage, xp, time_spent_minutes, started_at, last_activity_at, completed_at
    FROM module_progress
    WHERE student_id = ?
  `).bind(auth.studentId).all();

  const phases = await env.STUDENT_STATE.prepare(`
    SELECT phase, unlocked_at, challenges_completed
    FROM learner_phases
    WHERE student_id = ?
    ORDER BY unlocked_at ASC
  `).bind(auth.studentId).all();

  return Response.json({
    success: true,
    data: {
      modules: progress.results,
      phases: phases.results,
      currentPhase: phases.results[phases.results.length - 1]?.phase || 'player',
    },
  });
});

// POST /progress/:module/start - Start a module
studentRoutes.post('/progress/:module/start', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { module } = params;
  const validModules = ['cognitive-mill', 'sitka-sound', 'intelligence-ranch'];

  if (!validModules.includes(module)) {
    return Response.json(
      { success: false, error: { code: 'INVALID_MODULE', message: 'Invalid module' } },
      { status: 400 }
    );
  }

  // Check if already started
  const existing = await env.STUDENT_STATE.prepare(`
    SELECT id FROM module_progress WHERE student_id = ? AND module = ?
  `).bind(auth.studentId, module).first();

  if (existing) {
    return Response.json(
      { success: false, error: { code: 'ALREADY_STARTED', message: 'Module already started' } },
      { status: 409 }
    );
  }

  // Start module
  const id = crypto.randomUUID();
  await env.STUDENT_STATE.prepare(`
    INSERT INTO module_progress (id, student_id, module)
    VALUES (?, ?, ?)
  `).bind(id, auth.studentId, module).run();

  // Award start achievement
  const achievementCode = module === 'cognitive-mill' ? 'cm_start' :
    module === 'sitka-sound' ? 'ss_start' : 'ir_start';

  await awardAchievement(env, auth.studentId, achievementCode);

  return Response.json({
    success: true,
    data: { module, stage: 1, xp: 0 },
  });
});

// POST /progress/:module/advance - Advance to next stage
studentRoutes.post('/progress/:module/advance', async (request, env, _ctx, params) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { module } = params;
  const body = await request.json() as { xpEarned?: number };

  const progress = await env.STUDENT_STATE.prepare(`
    SELECT id, current_stage, xp FROM module_progress
    WHERE student_id = ? AND module = ?
  `).bind(auth.studentId, module).first<{
    id: string;
    current_stage: number;
    xp: number;
  }>();

  if (!progress) {
    return Response.json(
      { success: false, error: { code: 'NOT_STARTED', message: 'Module not started' } },
      { status: 404 }
    );
  }

  const newStage = progress.current_stage + 1;
  const newXp = progress.xp + (body.xpEarned || 10);

  await env.STUDENT_STATE.prepare(`
    UPDATE module_progress
    SET current_stage = ?, xp = ?, last_activity_at = datetime('now')
    WHERE id = ?
  `).bind(newStage, newXp, progress.id).run();

  // Check for phase unlock based on total XP
  await checkPhaseUnlock(env, auth.studentId);

  return Response.json({
    success: true,
    data: { module, stage: newStage, xp: newXp },
  });
});

// GET /achievements - Get earned achievements
studentRoutes.get('/achievements', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const earned = await env.STUDENT_STATE.prepare(`
    SELECT a.code, a.name, a.description, a.icon_url, a.xp_reward, a.rarity, sa.earned_at
    FROM student_achievements sa
    JOIN achievements a ON sa.achievement_id = a.id
    WHERE sa.student_id = ?
    ORDER BY sa.earned_at DESC
  `).bind(auth.studentId).all();

  const available = await env.STUDENT_STATE.prepare(`
    SELECT code, name, description, rarity
    FROM achievements
    WHERE id NOT IN (
      SELECT achievement_id FROM student_achievements WHERE student_id = ?
    )
  `).bind(auth.studentId).all();

  return Response.json({
    success: true,
    data: {
      earned: earned.results,
      available: available.results,
    },
  });
});

// POST /hardware - Report hardware profile
studentRoutes.post('/hardware', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as {
    hasArduino?: boolean;
    hasJetson?: boolean;
    hasNvidiaGpu?: boolean;
    gpuModel?: string;
    gpuVramGb?: number;
    systemRamGb?: number;
  };

  // Determine tier
  let tier = 'starter';
  if (body.gpuModel?.includes('DGX')) tier = 'pro';
  else if (body.hasNvidiaGpu && (body.gpuVramGb || 0) >= 16) tier = 'power';
  else if (body.hasJetson) tier = 'edge';
  else if (body.hasArduino) tier = 'maker';

  const canRunOllama = (body.systemRamGb || 0) >= 16 ? 1 : 0;
  const canRunAce = body.hasNvidiaGpu && (body.gpuVramGb || 0) >= 8 ? 1 : 0;

  // Upsert hardware profile
  await env.STUDENT_STATE.prepare(`
    INSERT INTO hardware_profiles (
      id, student_id, tier, has_arduino, has_jetson, has_nvidia_gpu,
      gpu_model, gpu_vram_gb, system_ram_gb, can_run_ollama, can_run_ace, raw_detection
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET
      tier = excluded.tier,
      has_arduino = excluded.has_arduino,
      has_jetson = excluded.has_jetson,
      has_nvidia_gpu = excluded.has_nvidia_gpu,
      gpu_model = excluded.gpu_model,
      gpu_vram_gb = excluded.gpu_vram_gb,
      system_ram_gb = excluded.system_ram_gb,
      can_run_ollama = excluded.can_run_ollama,
      can_run_ace = excluded.can_run_ace,
      detected_at = datetime('now')
  `).bind(
    crypto.randomUUID(),
    auth.studentId,
    tier,
    body.hasArduino ? 1 : 0,
    body.hasJetson ? 1 : 0,
    body.hasNvidiaGpu ? 1 : 0,
    body.gpuModel || null,
    body.gpuVramGb || null,
    body.systemRamGb || null,
    canRunOllama,
    canRunAce,
    JSON.stringify(body)
  ).run();

  return Response.json({
    success: true,
    data: { tier, canRunOllama: !!canRunOllama, canRunAce: !!canRunAce },
  });
});

// Helper: Award achievement
async function awardAchievement(env: Env, studentId: string, code: string): Promise<boolean> {
  const achievement = await env.STUDENT_STATE.prepare(
    'SELECT id FROM achievements WHERE code = ?'
  ).bind(code).first<{ id: string }>();

  if (!achievement) return false;

  try {
    await env.STUDENT_STATE.prepare(`
      INSERT INTO student_achievements (id, student_id, achievement_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), studentId, achievement.id).run();
    return true;
  } catch {
    return false; // Already earned
  }
}

// Helper: Check and unlock phases based on XP
async function checkPhaseUnlock(env: Env, studentId: string): Promise<void> {
  const totalXp = await env.STUDENT_STATE.prepare(`
    SELECT COALESCE(SUM(xp), 0) as total FROM module_progress WHERE student_id = ?
  `).bind(studentId).first<{ total: number }>();

  const xp = totalXp?.total || 0;
  const phases = await env.STUDENT_STATE.prepare(`
    SELECT phase FROM learner_phases WHERE student_id = ?
  `).bind(studentId).all<{ phase: string }>();

  const unlockedPhases = new Set(phases.results.map((p) => p.phase));

  // Phase thresholds
  const thresholds = [
    { phase: 'reader', xp: 100, achievement: 'reader_phase' },
    { phase: 'tweaker', xp: 500, achievement: 'tweaker_phase' },
    { phase: 'creator', xp: 2000, achievement: 'creator_phase' },
    { phase: 'mentor', xp: 10000, achievement: 'mentor_phase' },
  ];

  for (const { phase, xp: required, achievement } of thresholds) {
    if (xp >= required && !unlockedPhases.has(phase)) {
      await env.STUDENT_STATE.prepare(`
        INSERT INTO learner_phases (id, student_id, phase) VALUES (?, ?, ?)
      `).bind(crypto.randomUUID(), studentId, phase).run();
      await awardAchievement(env, studentId, achievement);
    }
  }
}
