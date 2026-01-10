/**
 * StudyLoG.AI Backend - AI Routes
 * Tiered inference: Cloudflare (free) → Ollama (local) → Anthropic (premium)
 */

import { Router } from '../router';
import { requireAuth } from '../middleware';
import type { Env, AIRequest, AIResponse } from '../types';

export const aiRoutes = new Router();

// Model mappings for each tier
const MODELS = {
  cloudflare: {
    chat: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    code: '@cf/qwen/qwen2.5-coder-32b-instruct',
    embed: '@cf/baai/bge-base-en-v1.5',
  },
  ollama: {
    chat: 'llama3.3',
    code: 'codestral',
  },
  anthropic: {
    chat: 'claude-sonnet-4-20250514',
    reasoning: 'claude-opus-4-20250514',
  },
};

// POST /chat - General chat completion
aiRoutes.post('/chat', async (request, env, ctx) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const startTime = Date.now();
  const body = await request.json() as AIRequest;

  // Determine best provider
  const provider = await selectProvider(env, auth.studentId, body.preferLocal);

  let result: AIResponse;

  switch (provider) {
    case 'ollama':
      result = await callOllama(env, body, 'chat');
      break;
    case 'anthropic':
      result = await callAnthropic(env, body);
      break;
    default:
      result = await callCloudflare(env, body, 'chat');
  }

  result.latencyMs = Date.now() - startTime;

  // Log interaction (fire and forget)
  ctx.waitUntil(logAIInteraction(env, auth.studentId, result, 'chat'));

  return Response.json({ success: true, data: result });
});

// POST /code - Code-specific completion
aiRoutes.post('/code', async (request, env, ctx) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const startTime = Date.now();
  const body = await request.json() as AIRequest & {
    language?: string;
    prefix?: string;
    suffix?: string;
  };

  // Code completion prefers local for speed
  const provider = await selectProvider(env, auth.studentId, true);

  let result: AIResponse;

  if (provider === 'ollama') {
    result = await callOllama(env, body, 'code');
  } else {
    result = await callCloudflare(env, body, 'code');
  }

  result.latencyMs = Date.now() - startTime;
  ctx.waitUntil(logAIInteraction(env, auth.studentId, result, 'code'));

  return Response.json({ success: true, data: result });
});

// POST /embed - Generate embeddings for semantic search
aiRoutes.post('/embed', async (request, env) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as { texts: string[] };

  if (!body.texts || !Array.isArray(body.texts)) {
    return Response.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'texts array required' } },
      { status: 400 }
    );
  }

  const embeddings = await env.AI.run(MODELS.cloudflare.embed as any, {
    text: body.texts,
  }) as { data?: number[][] };

  return Response.json({
    success: true,
    data: { embeddings: embeddings.data ?? [] },
  });
});

// POST /hint - Get contextual hint for a puzzle
aiRoutes.post('/hint', async (request, env, ctx) => {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as {
    puzzleId: string;
    currentAttempt?: string;
    hintLevel: 1 | 2 | 3;
  };

  // Fetch puzzle
  const puzzle = await env.STUDENT_STATE.prepare(`
    SELECT title, description, hints FROM puzzles WHERE id = ?
  `).bind(body.puzzleId).first<{
    title: string;
    description: string;
    hints: string;
  }>();

  if (!puzzle) {
    return Response.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Puzzle not found' } },
      { status: 404 }
    );
  }

  // Build hint prompt
  const hints = JSON.parse(puzzle.hints || '[]') as string[];
  const staticHint = hints[body.hintLevel - 1];

  if (staticHint) {
    return Response.json({
      success: true,
      data: { hint: staticHint, type: 'static' },
    });
  }

  // Generate dynamic hint with AI
  const prompt = `You are a helpful tutor. A student is working on this puzzle:

Title: ${puzzle.title}
Description: ${puzzle.description}

${body.currentAttempt ? `Their current attempt: ${body.currentAttempt}` : ''}

Give a hint at level ${body.hintLevel} (1=vague, 2=moderate, 3=nearly explicit).
Do NOT give the answer. Be encouraging.`;

  const result = await callCloudflare(env, { prompt, maxTokens: 200 }, 'chat');

  ctx.waitUntil(logAIInteraction(env, auth.studentId, result, 'hint'));

  return Response.json({
    success: true,
    data: { hint: result.text, type: 'generated' },
  });
});

// GET /status - Check AI availability
aiRoutes.get('/status', async (_request, env) => {
  const status: Record<string, boolean> = {
    cloudflare: true, // Always available
    ollama: false,
    anthropic: false,
  };

  // Check Ollama
  if (env.OLLAMA_ENDPOINT) {
    try {
      const res = await fetch(`${env.OLLAMA_ENDPOINT}/api/tags`, { method: 'GET' });
      status.ollama = res.ok;
    } catch {
      status.ollama = false;
    }
  }

  // Check Anthropic
  status.anthropic = !!env.ANTHROPIC_API_KEY;

  return Response.json({ success: true, data: status });
});

// ═══════════════════════════════════════════════════════════
// Provider Functions
// ═══════════════════════════════════════════════════════════

async function selectProvider(
  env: Env,
  studentId: string,
  preferLocal = false
): Promise<'cloudflare' | 'ollama' | 'anthropic'> {
  // Check hardware profile for local capability
  if (preferLocal && env.OLLAMA_ENDPOINT) {
    const hardware = await env.STUDENT_STATE.prepare(`
      SELECT can_run_ollama FROM hardware_profiles WHERE student_id = ?
    `).bind(studentId).first<{ can_run_ollama: number }>();

    if (hardware?.can_run_ollama) {
      return 'ollama';
    }
  }

  // Check tier for premium access
  const student = await env.STUDENT_STATE.prepare(`
    SELECT tier FROM students WHERE id = ?
  `).bind(studentId).first<{ tier: string }>();

  if (student?.tier === 'studio' || student?.tier === 'lab') {
    if (env.ANTHROPIC_API_KEY) {
      return 'anthropic';
    }
  }

  return 'cloudflare';
}

async function callCloudflare(
  env: Env,
  body: AIRequest,
  type: 'chat' | 'code'
): Promise<AIResponse> {
  const model = type === 'code' ? MODELS.cloudflare.code : MODELS.cloudflare.chat;

  const result = await env.AI.run(model as any, {
    prompt: body.prompt,
    max_tokens: body.maxTokens || 1024,
    temperature: body.temperature || 0.7,
  }) as { response?: string };

  return {
    text: result.response || '',
    model,
    provider: 'cloudflare',
    tokens: { input: 0, output: 0 }, // Cloudflare doesn't report tokens
    latencyMs: 0,
  };
}

async function callOllama(
  env: Env,
  body: AIRequest,
  type: 'chat' | 'code'
): Promise<AIResponse> {
  if (!env.OLLAMA_ENDPOINT) {
    throw new Error('Ollama endpoint not configured');
  }

  const model = type === 'code' ? MODELS.ollama.code : MODELS.ollama.chat;

  const response = await fetch(`${env.OLLAMA_ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: body.prompt,
      options: {
        num_predict: body.maxTokens || 1024,
        temperature: body.temperature || 0.7,
      },
      stream: false,
    }),
  });

  const result = await response.json() as {
    response: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };

  return {
    text: result.response,
    model,
    provider: 'ollama',
    tokens: {
      input: result.prompt_eval_count || 0,
      output: result.eval_count || 0,
    },
    latencyMs: 0,
  };
}

async function callAnthropic(env: Env, body: AIRequest): Promise<AIResponse> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELS.anthropic.chat,
      max_tokens: body.maxTokens || 1024,
      messages: [{ role: 'user', content: body.prompt }],
    }),
  });

  const result = await response.json() as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
    model: string;
  };

  return {
    text: result.content[0]?.text || '',
    model: result.model,
    provider: 'anthropic',
    tokens: {
      input: result.usage.input_tokens,
      output: result.usage.output_tokens,
    },
    latencyMs: 0,
  };
}

async function logAIInteraction(
  env: Env,
  studentId: string,
  result: AIResponse,
  context: string
): Promise<void> {
  try {
    await env.STUDENT_STATE.prepare(`
      INSERT INTO ai_interactions (id, student_id, provider, model, prompt_tokens, completion_tokens, latency_ms, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      studentId,
      result.provider,
      result.model,
      result.tokens.input,
      result.tokens.output,
      result.latencyMs,
      context
    ).run();
  } catch (error) {
    console.error('Failed to log AI interaction:', error);
  }
}
