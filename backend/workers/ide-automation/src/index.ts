/**
 * IDE Automation Worker
 *
 * Main entry point for the IDE automation Cloudflare Worker.
 * Provides Cursor-class IDE features for StudyLoG.AI.
 *
 * Features:
 * - Chat interface with streaming responses
 * - Code actions (edit, refactor, explain)
 * - Agent orchestration with planning
 * - Test generation and coverage
 * - Background job processing
 * - Context building and semantic search
 * - Theia WebSocket integration
 */

import { Router } from 'itty-router';

// Import all modules
import * as chat from './chat/index.js';
import * as actions from './actions/index.js';
import * as agents from './agents/index.js';
import * as testing from './testing/index.js';
import * as background from './background/index.js';
import * as context from './context/index.js';
import * as theia from './theia/index.js';

import type { IDEAutomationEnv, RequestContext } from './types/index.js';

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Workspace-Id, X-Session-Id',
};

// ============================================================================
// Middleware
// ============================================================================

/**
 * Extract request context from headers
 */
function extractContext(request: Request): RequestContext {
  return {
    userId: request.headers.get('X-User-Id') || 'anonymous',
    workspaceId: request.headers.get('X-Workspace-Id') || 'default',
    sessionId: request.headers.get('X-Session-Id') || undefined,
    timestamp: Date.now(),
    correlationId: request.headers.get('X-Correlation-Id') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  };
}

// ============================================================================
// Routes
// ============================================================================

// CORS preflight
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/', () => {
  return Response.json({
    status: 'healthy',
    service: 'ide-automation',
    version: '1.0.0',
    features: [
      'chat',
      'code-actions',
      'agents',
      'testing',
      'background-jobs',
      'context-builder',
      'theia-integration',
    ],
  }, { headers: corsHeaders });
});

// ============================================================================
// Chat Routes
// ============================================================================

// Start a new chat session
router.post('/api/v1/chat/sessions', async (request, env) => {
  const ctx = extractContext(request);
  const body = await request.json() as {
    mode?: 'vibe' | 'spec';
    contextFiles?: Array<{ path: string; content: string; language: string }>;
  };

  const chatService = new chat.ChatService(env);
  const session = await chatService.startSession(
    ctx.userId,
    ctx.workspaceId,
    body.mode,
    body.contextFiles
  );

  return Response.json(session, { headers: corsHeaders });
});

// Send a message
router.post('/api/v1/chat/sessions/:sessionId/message', async (request, env) => {
  const ctx = extractContext(request);
  const { sessionId } = request.param as { sessionId: string };
  const body = await request.json() as { content: string; stream?: boolean };

  const chatService = new chat.ChatService(env);

  if (body.stream) {
    return await chatService.chatSSE(sessionId, body.content);
  }

  const response = await chatService.chat(sessionId, body.content);
  return Response.json(response, { headers: corsHeaders });
});

// Get session history
router.get('/api/v1/chat/sessions/:sessionId', async (request, env) => {
  const ctx = extractContext(request);
  const { sessionId } = request.param as { sessionId: string };

  const chatService = new chat.ChatService(env);
  const session = await chatService.getHistory(sessionId);

  if (!session || session.userId !== ctx.userId) {
    return Response.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders });
  }

  return Response.json(session, { headers: corsHeaders });
});

// List sessions
router.get('/api/v1/chat/sessions', async (request, env) => {
  const ctx = extractContext(request);
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const chatService = new chat.ChatService(env);
  const sessions = await chatService.listSessions(ctx.userId, ctx.workspaceId, limit);

  return Response.json({ sessions }, { headers: corsHeaders });
});

// ============================================================================
// Code Action Routes
// ============================================================================

// Edit file
router.post('/api/v1/files/edit', async (request, env) => {
  const ctx = extractContext(request);
  const body = await request.json() as {
    path: string;
    oldContent: string;
    newContent: string;
    startLine?: number;
    endLine?: number;
  };

  const codeActions = new actions.CodeActionsService(env);
  const diff = await codeActions.editFile(ctx.workspaceId, body.path, body);

  return Response.json(diff, { headers: corsHeaders });
});

// Create file
router.post('/api/v1/files/create', async (request, env) => {
  const ctx = extractContext(request);
  const body = await request.json() as {
    path: string;
    content: string;
  };

  const codeActions = new actions.CodeActionsService(env);
  const diff = await codeActions.createFile(ctx.workspaceId, body.path, body.content);

  return Response.json(diff, { headers: corsHeaders });
});

// Extract symbols
router.get('/api/v1/files/symbols', async (request, env) => {
  const ctx = extractContext(request);
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return Response.json({ error: 'File path required' }, { status: 400, headers: corsHeaders });
  }

  // Get file content
  const key = `${ctx.workspaceId}/${filePath}`;
  const object = await env.WORKSPACE_STORAGE.get(key);
  if (!object) {
    return Response.json({ error: 'File not found' }, { status: 404, headers: corsHeaders });
  }

  const content = await object.text();
  const codeActions = new actions.CodeActionsService(env);
  const symbols = codeActions.extractSymbols(filePath, content);

  return Response.json({ symbols }, { headers: corsHeaders });
});

// Explain code
router.post('/api/v1/code/explain', async (request, env) => {
  const body = await request.json() as {
    code: string;
    language: string;
    detailLevel?: 'brief' | 'detailed';
  };

  const codeActions = new actions.CodeActionsService(env);
  const explanation = await codeActions.explainCode(
    body.code,
    body.language,
    body.detailLevel
  );

  return Response.json(explanation, { headers: corsHeaders });
});

// ============================================================================
// Agent Routes
// ============================================================================

// Execute agent task
router.post('/api/v1/agents/execute', async (request, env) => {
  const ctx = extractContext(request);
  const body = await request.json() as {
    request: string;
    files?: string[];
  };

  const executor = agents.createAgentExecutor(env);
  const task = await executor.executeRequest(
    body.request,
    ctx.sessionId || 'default',
    ctx.userId,
    { workspaceId: ctx.workspaceId, files: body.files }
  );

  return Response.json(task, { headers: corsHeaders });
});

// Get task status
router.get('/api/v1/agents/tasks/:taskId', async (request, env) => {
  const { taskId } = request.param as { taskId: string };

  const executor = agents.createAgentExecutor(env);
  const status = executor.getStatus(taskId);

  if (!status) {
    return Response.json({ error: 'Task not found' }, { status: 404, headers: corsHeaders });
  }

  return Response.json(status, { headers: corsHeaders });
});

// Cancel task
router.post('/api/v1/agents/tasks/:taskId/cancel', async (request, env) => {
  const { taskId } = request.param as { taskId: string };

  const executor = agents.createAgentExecutor(env);
  const cancelled = await executor.cancelTask(taskId);

  return Response.json({ cancelled }, { headers: corsHeaders });
});

// ============================================================================
// Testing Routes
// ============================================================================

// Generate tests
router.post('/api/v1/tests/generate', async (request, env) => {
  const body = await request.json() as {
    code: string;
    language: string;
    framework?: 'vitest' | 'jest' | 'pytest';
    type?: 'unit' | 'integration' | 'e2e';
  };

  const generator = testing.createTestGenerator(env);
  const tests = await generator.generateTests(
    body.code,
    body.language,
    body.framework,
    body.type
  );

  return Response.json({ tests }, { headers: corsHeaders });
});

// Validate code
router.post('/api/v1/tests/validate', async (request, env) => {
  const body = await request.json() as {
    content: string;
    language: string;
    categories?: Array<'security' | 'performance' | 'maintainability' | 'readability' | 'best_practices'>;
  };

  const validator = testing.createValidationService();
  const result = await validator.validate(
    body.content,
    body.language,
    body.categories
  );

  return Response.json(result, { headers: corsHeaders });
});

// Quality check
router.post('/api/v1/tests/quality', async (request, env) => {
  const body = await request.json() as {
    content: string;
    language: string;
  };

  const validator = testing.createValidationService();
  const result = await validator.runQualityChecks(body.content, body.language);

  return Response.json(result, { headers: corsHeaders });
});

// ============================================================================
// Background Job Routes
// ============================================================================

// Enqueue job
router.post('/api/v1/jobs', async (request, env) => {
  const ctx = extractContext(request);
  const body = await request.json() as {
    type: string;
    params: Record<string, unknown>;
    priority?: number;
  };

  const queue = background.createJobQueue(env);
  const job = await queue.enqueue(ctx.userId, body.type, body.params, {
    priority: body.priority,
  });

  return Response.json(job, { headers: corsHeaders });
});

// Get job status
router.get('/api/v1/jobs/:jobId', async (request, env) => {
  const { jobId } = request.param as { jobId: string };

  const queue = background.createJobQueue(env);
  const job = await queue.getStatus(jobId);

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404, headers: corsHeaders });
  }

  return Response.json(job, { headers: corsHeaders });
});

// List jobs
router.get('/api/v1/jobs', async (request, env) => {
  const ctx = extractContext(request);
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as 'queued' | 'running' | 'completed' | 'failed' | null;
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const queue = background.createJobQueue(env);
  const jobs = await queue.listJobs(ctx.userId, status || undefined, limit);

  return Response.json({ jobs }, { headers: corsHeaders });
});

// Cancel job
router.post('/api/v1/jobs/:jobId/cancel', async (request, env) => {
  const ctx = extractContext(request);
  const { jobId } = request.param as { jobId: string };

  const queue = background.createJobQueue(env);
  const cancelled = await queue.cancel({
    jobId,
    userId: ctx.userId,
    force: false,
  });

  return Response.json({ cancelled }, { headers: corsHeaders });
});

// ============================================================================
// Context Routes
// ============================================================================

// Build context
router.post('/api/v1/context/build', async (request, env) => {
  const ctx = extractContext(request);
  const body = await request.json() as {
    query: string;
    strategy?: 'full' | 'partial' | 'semantic' | 'diff';
    maxTokens?: number;
  };

  const builder = context.createContextBuilder(env);
  const result = await builder.buildContext(
    body.query,
    ctx.workspaceId,
    { strategy: body.strategy, maxTokens: body.maxTokens }
  );

  return Response.json(result, { headers: corsHeaders });
});

// Extract symbols
router.get('/api/v1/context/symbols', async (request, env) => {
  const ctx = extractContext(request);
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return Response.json({ error: 'File path required' }, { status: 400, headers: corsHeaders });
  }

  const builder = context.createContextBuilder(env);
  const symbols = await builder.extractSymbols(ctx.workspaceId, filePath);

  return Response.json({ symbols }, { headers: corsHeaders });
});

// Dependency map
router.get('/api/v1/context/dependencies', async (request, env) => {
  const ctx = extractContext(request);
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');

  if (!filePath) {
    return Response.json({ error: 'File path required' }, { status: 400, headers: corsHeaders });
  }

  const builder = context.createContextBuilder(env);
  const deps = await builder.buildDependencyMap(ctx.workspaceId, filePath);

  return Response.json(deps, { headers: corsHeaders });
});

// ============================================================================
// Theia Integration Routes
// ============================================================================

// WebSocket upgrade endpoint
router.get('/ws', async (request, env) => {
  const wsResponse = theia.handleWebSocketUpgrade(request, env);
  if (wsResponse) {
    return wsResponse;
  }
  return new Response('Expected WebSocket upgrade', { status: 426 });
});

// Execute command
router.post('/api/v1/theia/commands/:commandId/execute', async (request, env) => {
  const { commandId } = request.param as { commandId: string };
  const body = await request.json() as Record<string, unknown>;

  const registry = theia.createCommandRegistry();
  const result = await registry.execute(commandId, body);

  return Response.json(result, { headers: corsHeaders });
});

// List commands
router.get('/api/v1/theia/commands', async () => {
  const registry = theia.createCommandRegistry();
  const commands = registry.list();

  return Response.json({ commands }, { headers: corsHeaders });
});

// Search commands
router.get('/api/v1/theia/commands/search', async (request) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';

  const registry = theia.createCommandRegistry();
  const commands = registry.search(query);

  return Response.json({ commands }, { headers: corsHeaders });
});

// ============================================================================
// Gamification Routes (XP, Achievements)
// ============================================================================

// Get user XP and level
router.get('/api/v1/gamification/xp/:userId', async (request, env) => {
  const { userId } = request.param as { userId: string };

  // Get XP from database
  const result = await env.IDE_STATE
    .prepare(`SELECT total_xp, level FROM user_xp WHERE user_id = ?`)
    .bind(userId)
    .first();

  if (!result) {
    return Response.json({ xp: 0, level: 1, nextLevelXp: 100 }, { headers: corsHeaders });
  }

  return Response.json(result, { headers: corsHeaders });
});

// Award XP (internal)
router.post('/api/v1/gamification/xp/award', async (request, env) => {
  const body = await request.json() as {
    userId: string;
    amount: number;
    source: string;
  };

  await env.IDE_STATE
    .prepare(`
      INSERT INTO user_xp (user_id, total_xp, level, last_updated)
      VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        total_xp = total_xp + ?,
        level = (total_xp + ?) / 100 + 1,
        last_updated = datetime('now')
    `)
    .bind(body.userId, body.amount, body.amount, body.amount)
    .run();

  return Response.json({ awarded: body.amount }, { headers: corsHeaders });
});

// Get achievements
router.get('/api/v1/gamification/achievements/:userId', async (request, env) => {
  const { userId } = request.param as { userId: string };

  const result = await env.IDE_STATE
    .prepare(`SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?`)
    .bind(userId)
    .all();

  return Response.json({
    achievements: result.results || [],
  }, { headers: corsHeaders });
});

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: IDEAutomationEnv, ctx: ExecutionContext) => {
    return router
      .handle(request, env, ctx)
      .catch((error) => {
        console.error('Request error:', error);
        return Response.json(
          { error: error.message || 'Internal server error' },
          { status: 500, headers: corsHeaders }
        );
      });
  },
};

// Re-export modules for direct use
export * from './chat/index.js';
export * from './actions/index.js';
export * from './agents/index.js';
export * from './testing/index.js';
export * from './background/index.js';
export * from './context/index.js';
export * from './theia/index.js';
export * from './types/index.js';
