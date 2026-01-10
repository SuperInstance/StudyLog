/**
 * Budget Tracker Worker
 *
 * Cloudflare Worker for tracking daily API usage budgets across multiple
 * free-tier providers. Maximizes free-tier usage while preventing overage
 * charges through intelligent provider rotation and end-of-day knowledge
 * filling tasks.
 *
 * ## Features
 *
 * 1. **Pre-call Budget Checks**: Validates sufficient budget before API calls
 * 2. **Usage Recording**: Tracks actual token/cost usage after each call
 * 3. **Provider Rotation**: Rotates providers based on remaining free tier
 * 4. **Alert System**: Notifies when approaching budget limits
 * 5. **Fill Knowledge Tasks**: Queues end-of-day tasks to use remaining budget
 *
 * ## Budget Optimization Strategy
 *
 * The system maximizes free-tier value through:
 *
 * ### 1. Provider Selection Heuristics
 * - Prefer providers with most remaining free tier
 * - Within similar budgets, prefer cheapest per-token cost
 * - Respect user pinning of preferred providers
 * - Account for reset times (use providers resetting sooner first)
 *
 * ### 2. Fill Knowledge Scheduling
 * When a provider's free tier is >90% exhausted:
 * - Switch to next available free-tier provider
 * - Queue "fill knowledge" tasks to use remaining budget
 * - Tasks run at end-of-day to maximize free-tier value
 * - Next day: start fresh with renewed free tier
 *
 * ### 3. Alert Thresholds
 * - 90% used: Warning, provider deprioritized
 * - 95% used: Critical warning, schedule fill tasks
 * - 100% used: Provider disabled for today
 *
 * ## API Endpoints
 *
 * - `POST /budget/configure` - Set user's API keys and limits
 * - `GET /budget/status/:userId` - Get current usage status
 * - `POST /budget/check` - Pre-call check (allow/deny)
 * - `POST /budget/record` - Record usage after API call
 * - `GET /budget/providers/:userId` - List configured providers
 * - `DELETE /budget/providers/:providerId` - Remove a provider
 * - `POST /budget/fill-knowledge` - Queue fill knowledge task
 * - `GET /budget/fill-knowledge/:userId` - List pending tasks
 *
 * @see types.ts for detailed type definitions
 */

import { Router } from 'itty-router';
import type {
  ProviderBudget,
  UsageRecord,
  BudgetCheckRequest,
  BudgetCheckResult,
  DailyUsageSummary,
  ProviderUsageSummary,
  ProviderAlert,
  FillKnowledgeTask,
  FillKnowledgeTaskType,
  ConfigureBudgetRequest,
  ConfigureBudgetResponse,
  AllProvidersStatus,
  ProviderRecommendation,
  BudgetProvider,
  ResetSchedule,
  FreeTierInfo,
} from './types';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // D1 Database for persistent storage
  DB: D1Database;

  // KV Namespace for caching budget status
  BUDGET_CACHE: KVNamespace;

  // Optional: Secret for encrypting API keys
  ENCRYPTION_KEY?: string;
}

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Free Tier Information Cache
// ============================================================================

/**
 * Free tier information for supported providers.
 *
 * This cache is used to provide default values when users configure
 * providers. It can be updated via admin endpoints as providers
 * change their pricing.
 *
 * ## How Budget Checks Maximize Free-Tier Usage
 *
 * The pre-call budget check uses this information to:
 * 1. Estimate the cost of a pending request
 * 2. Compare against remaining free tier
 * 3. Decide whether to allow or redirect to another provider
 * 4. Schedule fill-knowledge tasks if free tier is nearly exhausted
 *
 * ## Provider Rotation for Maximizing Free Tiers
 *
 * The rotation algorithm considers:
 * 1. **Remaining Budget %**: Providers with more free tier are prioritized
 * 2. **Reset Time**: Providers resetting soon are used first (to avoid waste)
 * 3. **Cost Efficiency**: Cheaper providers preferred within same budget tier
 * 4. **User Pinning**: User-pinned providers get priority boost
 * 5. **Context Suitability**: Some providers are better for specific tasks
 *
 * This ensures every free tier is maximized while maintaining quality.
 */
const FREE_TIER_INFO: Record<BudgetProvider, FreeTierInfo> = {
  openai: {
    providerId: 'openai',
    hasFreeTier: true,
    dailyLimit: 5.00, // Approx $5 free tier for new accounts
    resetSchedule: 'monthly',
    resetTime: '00:00',
    notes: 'New accounts get ~$5 in free API credits. Expires after 3 months.',
    pricingUrl: 'https://openai.com/pricing',
    lastUpdated: new Date().toISOString(),
  },
  xai: {
    providerId: 'xai',
    hasFreeTier: true,
    dailyLimit: 0.50, // Limited free requests
    resetSchedule: 'daily',
    resetTime: '00:00',
    notes: 'Grok offers limited free access daily. Premium required for heavy usage.',
    pricingUrl: 'https://x.ai/pricing',
    lastUpdated: new Date().toISOString(),
  },
  qwen: {
    providerId: 'qwen',
    hasFreeTier: true,
    dailyLimit: 1.00, // Daily free tier estimate
    resetSchedule: 'daily',
    resetTime: '00:00',
    notes: 'Alibaba Qwen offers daily free tier for API access.',
    pricingUrl: 'https://tongyi.aliyun.com/pricing',
    lastUpdated: new Date().toISOString(),
  },
  google: {
    providerId: 'google',
    hasFreeTier: true,
    dailyLimit: 10.00, // Amortized $300 credit over 30 days
    resetSchedule: 'monthly',
    resetTime: '00:00',
    notes: '$300 free credit for new accounts, then free tier limits apply.',
    pricingUrl: 'https://cloud.google.com/vertex-ai/pricing',
    lastUpdated: new Date().toISOString(),
  },
  anthropic: {
    providerId: 'anthropic',
    hasFreeTier: true,
    dailyLimit: 5.00, // Claude free tier estimate
    resetSchedule: 'monthly',
    resetTime: '00:00',
    notes: 'Claude offers usage-based free credits for new accounts.',
    pricingUrl: 'https://www.anthropic.com/pricing',
    lastUpdated: new Date().toISOString(),
  },
  deepseek: {
    providerId: 'deepseek',
    hasFreeTier: true,
    dailyLimit: 0.50, // Minimal free tier, very low cost anyway
    resetSchedule: 'daily',
    resetTime: '00:00',
    notes: 'Ultra-low cost ($0.14/M input) with minimal free tier.',
    pricingUrl: 'https://www.deepseek.com/pricing',
    lastUpdated: new Date().toISOString(),
  },
  zhipu: {
    providerId: 'zhipu',
    hasFreeTier: true,
    dailyLimit: 1.00, // GLM-4-Flash free tier
    resetSchedule: 'daily',
    resetTime: '00:00',
    notes: 'GLM-4-Flash offers very low pricing ($0.01/M) with free tier.',
    pricingUrl: 'https://open.bigmodel.cn/pricing',
    lastUpdated: new Date().toISOString(),
  },
  nvidia: {
    providerId: 'nvidia',
    hasFreeTier: true,
    dailyLimit: 2.00, // NVIDIA free tier estimate
    resetSchedule: 'monthly',
    resetTime: '00:00',
    notes: 'NVIDIA NIM offers free tier for hosted Llama/Nemotron models.',
    pricingUrl: 'https://www.nvidia.com/en-us/ai-enterprise/products/',
    lastUpdated: new Date().toISOString(),
  },
  ollama: {
    providerId: 'ollama',
    hasFreeTier: true,
    dailyLimit: Infinity, // Local models are always free
    resetSchedule: 'never',
    resetTime: '00:00',
    notes: 'Local models - no API cost. Only electricity/hardware costs.',
    pricingUrl: 'https://ollama.com',
    lastUpdated: new Date().toISOString(),
  },
  deepinfra: {
    providerId: 'deepinfra',
    hasFreeTier: true,
    dailyLimit: 1.00, // DeepInfra free tier
    resetSchedule: 'daily',
    resetTime: '00:00',
    notes: 'DeepInfra offers discount pricing with some free tier.',
    pricingUrl: 'https://deepinfra.com/pricing',
    lastUpdated: new Date().toISOString(),
  },
  replicate: {
    providerId: 'replicate',
    hasFreeTier: true,
    dailyLimit: 5.00, // Replicate free credits
    resetSchedule: 'monthly',
    resetTime: '00:00',
    notes: 'Replicate offers free credits for testing image/video models.',
    pricingUrl: 'https://replicate.com/pricing',
    lastUpdated: new Date().toISOString(),
  },
  elevenlabs: {
    providerId: 'elevenlabs',
    hasFreeTier: true,
    dailyLimit: 0.50, // ElevenLabs free tier
    resetSchedule: 'monthly',
    resetTime: '00:00',
    notes: 'ElevenLabs offers limited free audio generation monthly.',
    pricingUrl: 'https://elevenlabs.io/pricing',
    lastUpdated: new Date().toISOString(),
  },
  custom: {
    providerId: 'custom',
    hasFreeTier: false,
    dailyLimit: 0,
    resetSchedule: 'never',
    resetTime: '00:00',
    notes: 'User-defined provider with custom endpoint.',
    pricingUrl: '',
    lastUpdated: new Date().toISOString(),
  },
};

// ============================================================================
// Pricing Information for Cost Estimation
// ============================================================================

/**
 * Cost per million tokens for each provider's models.
 *
 * Used by the budget check to estimate if a request will exceed
 * the remaining free tier. These are conservative estimates to
 * prevent overage.
 */
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o': { input: 2.50, output: 10.00 },
  'openai:gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai:gpt-3.5-turbo': { input: 0.50, output: 1.50 },

  'xai:grok-beta': { input: 5.00, output: 15.00 },

  'qwen:qwen-max': { input: 1.00, output: 2.00 },
  'qwen:qwen-plus': { input: 0.40, output: 0.80 },

  'google:gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'google:gemini-1.5-flash': { input: 0.075, output: 0.30 },

  'anthropic:claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic:claude-3-5-haiku': { input: 0.80, output: 4.00 },
  'anthropic:claude-3-opus': { input: 15.00, output: 75.00 },

  'deepseek:deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek:deepseek-coder': { input: 0.14, output: 0.28 },
  'deepseek:deepseek-reasoner': { input: 0.55, output: 2.19 },

  'zhipu:glm-4-flash': { input: 0.01, output: 0.01 },
  'zhipu:glm-4.5': { input: 0.05, output: 0.05 },
  'zhipu:glm-4.7': { input: 0.08, output: 0.30 },

  'nvidia:llama-3.1-405b': { input: 0.40, output: 0.40 },
  'nvidia:nemotron-4-340b': { input: 0.40, output: 0.40 },

  'deepinfra:meta-llama-3.1-405b': { input: 0.10, output: 0.10 },

  'ollama:*': { input: 0, output: 0 }, // Local is always free
};

// ============================================================================
// Routes
// ============================================================================

router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/', () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'budget-tracker',
    version: '1.0.0',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get free tier information for all providers
router.get('/budget/free-tier-info', () => {
  return new Response(JSON.stringify(FREE_TIER_INFO), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Configure a provider's budget for a user
router.post('/budget/configure', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as ConfigureBudgetRequest & { userId: string };

  if (!body.userId || !body.providerId || !body.apiKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Missing required fields: userId, providerId, apiKey',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Check if provider config already exists
    const existing = await env.DB
      .prepare('SELECT * FROM provider_budgets WHERE user_id = ? AND provider_id = ?')
      .bind(body.userId, body.providerId)
      .first();

    const now = new Date().toISOString();
    const freeTierInfo = FREE_TIER_INFO[body.providerId];

    // Calculate reset time based on schedule
    let resetTime: string;
    const resetSchedule = body.resetSchedule || freeTierInfo.resetSchedule;
    const userResetTime = body.resetTime || freeTierInfo.resetTime;

    if (resetSchedule === 'daily') {
      // Calculate next reset time (tomorrow at reset time)
      const [hours, minutes] = userResetTime.split(':').map(Number);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hours, minutes, 0, 0);
      resetTime = tomorrow.toISOString();
    } else if (resetSchedule === 'monthly') {
      // Next month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      resetTime = nextMonth.toISOString();
    } else {
      // One-time or never
      resetTime = '9999-12-31T23:59:59Z';
    }

    const budget: ProviderBudget = {
      id: existing?.id || crypto.randomUUID(),
      userId: body.userId,
      providerId: body.providerId,
      apiKey: body.apiKey, // In production, encrypt this!
      dailyLimit: body.dailyLimit ?? freeTierInfo.dailyLimit,
      dailyUsed: existing?.daily_used || 0,
      resetTime,
      resetSchedule,
      alertThreshold: body.alertThreshold ?? 90,
      mode: body.mode ?? 'balanced',
      priority: body.priority ?? 5,
      enabled: true,
      pinned: false,
      customEndpoint: body.customEndpoint,
      createdAt: existing?.created_at || now,
      updatedAt: now,
    };

    if (existing) {
      // Update existing
      await env.DB
        .prepare(`UPDATE provider_budgets
          SET api_key = ?, daily_limit = ?, alert_threshold = ?,
              mode = ?, priority = ?, reset_time = ?, reset_schedule = ?,
              custom_endpoint = ?, updated_at = ?
          WHERE id = ?`)
        .bind(
          budget.apiKey,
          budget.dailyLimit,
          budget.alertThreshold,
          budget.mode,
          budget.priority,
          budget.resetTime,
          budget.resetSchedule,
          budget.customEndpoint || null,
          budget.updatedAt,
          budget.id
        )
        .run();
    } else {
      // Insert new
      await env.DB
        .prepare(`INSERT INTO provider_budgets (
          id, user_id, provider_id, api_key, daily_limit, daily_used,
          reset_time, reset_schedule, alert_threshold, mode, priority,
          enabled, pinned, custom_endpoint, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          budget.id,
          budget.userId,
          budget.providerId,
          budget.apiKey,
          budget.dailyLimit,
          budget.dailyUsed,
          budget.resetTime,
          budget.resetSchedule,
          budget.alertThreshold,
          budget.mode,
          budget.priority,
          budget.enabled ? 1 : 0,
          budget.pinned ? 1 : 0,
          budget.customEndpoint || null,
          budget.createdAt,
          budget.updatedAt
        )
        .run();
    }

    // Clear cache for this user
    await env.BUDGET_CACHE.delete(`budget:${body.userId}`);

    const response: ConfigureBudgetResponse = {
      success: true,
      budget,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Get budget status for a user
router.get('/budget/status/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Try cache first
    const cached = await env.BUDGET_CACHE.get(`budget:${userId}`, 'json');
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await getAllProviderStatus(env, userId);

    // Cache for 60 seconds
    await env.BUDGET_CACHE.put(`budget:${userId}`, JSON.stringify(result), {
      expirationTtl: 60,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Pre-call budget check
router.post('/budget/check', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as BudgetCheckRequest;

  if (!body.userId || !body.providerId) {
    return new Response(JSON.stringify({
      allowed: false,
      message: 'Missing required fields: userId, providerId',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get provider budget
    const budget = await getProviderBudget(env, body.userId, body.providerId);

    if (!budget) {
      return new Response(JSON.stringify({
        allowed: false,
        message: `Provider ${body.providerId} not configured for user`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if budget needs reset
    await checkAndResetBudget(env, budget);

    // Estimate cost
    const pricingKey = `${body.providerId}:${body.model}`;
    const pricing = PROVIDER_PRICING[pricingKey] ||
                    PROVIDER_PRICING[`${body.providerId}:*`] ||
                    { input: 1.0, output: 1.0 };

    const estimatedCost = (
      (body.estimatedInputTokens / 1_000_000) * pricing.input +
      (body.estimatedOutputTokens / 1_000_000) * pricing.output
    );

    const remaining = budget.dailyLimit - budget.dailyUsed;
    const remainingPercent = budget.dailyLimit > 0
      ? (remaining / budget.dailyLimit) * 100
      : 100;

    const wouldExceed = estimatedCost > remaining;
    const alert = remainingPercent <= budget.alertThreshold;

    let result: BudgetCheckResult = {
      allowed: !wouldExceed || budget.mode === 'unlimited',
      providerId: body.providerId,
      remaining,
      remainingPercent,
      estimatedCost,
      wouldExceed,
      alert,
      message: wouldExceed
        ? `Request would exceed budget. Remaining: $${remaining.toFixed(4)}, Needed: $${estimatedCost.toFixed(4)}`
        : `Request allowed. Remaining: $${remaining.toFixed(4)}`,
    };

    // If near limit, suggest alternative
    if (alert && !wouldExceed) {
      result.message = `Warning: Budget at ${100 - remainingPercent.toFixed(1)}%. ${result.message}`;

      // If approaching 95%, queue for fill knowledge
      if (remainingPercent <= 5) {
        result.queueForFillKnowledge = true;
        result.message += ' Will queue for end-of-day fill knowledge.';
      }
    }

    // Find alternative if needed
    if (wouldExceed || alert) {
      const alternative = await findAlternativeProvider(env, body.userId, body.providerId);
      if (alternative) {
        result.alternativeProvider = alternative;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      allowed: false,
      message: error instanceof Error ? error.message : 'Check failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Record usage after API call
router.post('/budget/record', async (req) => {
  const env = req.env as Env;
  const body = await req.json();

  const requiredFields = ['userId', 'providerId', 'model', 'inputTokens', 'outputTokens', 'cost'];
  for (const field of requiredFields) {
    if (!(field in body)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Missing required field: ${field}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    // Record usage
    const record: UsageRecord = {
      id: crypto.randomUUID(),
      userId: body.userId,
      providerId: body.providerId,
      model: body.model,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      cost: body.cost,
      latencyMs: body.latencyMs || 0,
      success: body.success !== false,
      errorMessage: body.errorMessage,
      context: body.context,
      timestamp: new Date().toISOString(),
    };

    await env.DB
      .prepare(`INSERT INTO usage_records (
        id, user_id, provider_id, model, input_tokens, output_tokens,
        cost, latency_ms, success, error_message, context, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        record.id,
        record.userId,
        record.providerId,
        record.model,
        record.inputTokens,
        record.outputTokens,
        record.cost,
        record.latencyMs,
        record.success ? 1 : 0,
        record.errorMessage || null,
        record.context || null,
        record.timestamp
      )
      .run();

    // Update provider budget
    const budget = await getProviderBudget(env, body.userId, body.providerId);
    if (budget) {
      await checkAndResetBudget(env, budget);

      const newUsed = budget.dailyUsed + body.cost;
      await env.DB
        .prepare('UPDATE provider_budgets SET daily_used = ?, updated_at = ? WHERE id = ?')
        .bind(newUsed, new Date().toISOString(), budget.id)
        .run();

      // Check if we should schedule fill-knowledge tasks
      const remainingPercent = ((budget.dailyLimit - newUsed) / budget.dailyLimit) * 100;
      if (remainingPercent <= 5 && remainingPercent > 0) {
        // Schedule fill-knowledge task
        await scheduleFillKnowledgeTask(env, {
          userId: body.userId,
          providerId: body.providerId,
          taskType: 'cache-warm',
          priority: 1,
          estimatedCost: budget.dailyLimit - newUsed,
          parameters: { reason: 'end-of-day-cache-warm' },
        });
      }
    }

    // Clear cache
    await env.BUDGET_CACHE.delete(`budget:${body.userId}`);

    return new Response(JSON.stringify({ success: true, record }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Record failed',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// List user's configured providers
router.get('/budget/providers/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await env.DB
      .prepare('SELECT * FROM provider_budgets WHERE user_id = ? AND enabled = 1')
      .bind(userId)
      .all();

    const providers = result.results.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      providerId: row.provider_id,
      dailyLimit: row.daily_limit,
      dailyUsed: row.daily_used,
      resetTime: row.reset_time,
      resetSchedule: row.reset_schedule,
      alertThreshold: row.alert_threshold,
      mode: row.mode,
      priority: row.priority,
      enabled: row.enabled === 1,
      pinned: row.pinned === 1,
      customEndpoint: row.custom_endpoint,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return new Response(JSON.stringify({ providers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Remove a provider configuration
router.delete('/budget/providers/:providerId', async (req) => {
  const env = req.env as Env;
  const providerId = req.param?.providerId;
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  if (!userId || !providerId) {
    return new Response(JSON.stringify({ error: 'userId and providerId required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await env.DB
      .prepare('DELETE FROM provider_budgets WHERE user_id = ? AND id = ?')
      .bind(userId, providerId)
      .run();

    await env.BUDGET_CACHE.delete(`budget:${userId}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Queue a fill-knowledge task
router.post('/budget/fill-knowledge', async (req) => {
  const env = req.env as Env;
  const body = await req.json();

  if (!body.userId || !body.providerId || !body.taskType) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: userId, providerId, taskType',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const task = await scheduleFillKnowledgeTask(env, {
      userId: body.userId,
      providerId: body.providerId,
      taskType: body.taskType as FillKnowledgeTaskType,
      priority: body.priority || 5,
      estimatedCost: body.estimatedCost || 0,
      parameters: body.parameters || {},
      scheduledFor: body.scheduledFor,
    });

    return new Response(JSON.stringify({ success: true, task }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// List pending fill-knowledge tasks
router.get('/budget/fill-knowledge/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await env.DB
      .prepare('SELECT * FROM fill_knowledge_tasks WHERE user_id = ? AND status = ? ORDER BY priority ASC, scheduled_for ASC')
      .bind(userId, 'pending')
      .all();

    return new Response(JSON.stringify({ tasks: result.results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a provider's budget configuration from the database.
 *
 * Checks if the budget needs to be reset based on the reset time.
 */
async function getProviderBudget(
  env: Env,
  userId: string,
  providerId: string
): Promise<ProviderBudget | null> {
  const result = await env.DB
    .prepare('SELECT * FROM provider_budgets WHERE user_id = ? AND provider_id = ?')
    .bind(userId, providerId)
    .first();

  if (!result) return null;

  return {
    id: result.id as string,
    userId: result.user_id as string,
    providerId: result.provider_id as BudgetProvider,
    apiKey: result.api_key as string,
    dailyLimit: result.daily_limit as number,
    dailyUsed: result.daily_used as number,
    resetTime: result.reset_time as string,
    resetSchedule: result.reset_schedule as ResetSchedule,
    alertThreshold: result.alert_threshold as number,
    mode: result.mode as 'conservative' | 'balanced' | 'aggressive' | 'unlimited',
    priority: result.priority as number,
    enabled: (result.enabled as number) === 1,
    pinned: (result.pinned as number) === 1,
    customEndpoint: result.custom_endpoint as string | undefined,
    createdAt: result.created_at as string,
    updatedAt: result.updated_at as string,
  };
}

/**
 * Check if a budget needs to be reset and reset if necessary.
 *
 * Resets occur when:
 * 1. Current time is past the reset_time
 * 2. For daily schedules: Reset time is reached
 * 3. For monthly schedules: New billing cycle starts
 */
async function checkAndResetBudget(env: Env, budget: ProviderBudget): Promise<void> {
  const now = new Date();
  const resetTime = new Date(budget.resetTime);

  if (now >= resetTime) {
    // Calculate next reset time
    let nextReset: Date;

    switch (budget.resetSchedule) {
      case 'daily':
        nextReset = new Date(resetTime);
        nextReset.setDate(nextReset.getDate() + 1);
        break;
      case 'weekly':
        nextReset = new Date(resetTime);
        nextReset.setDate(nextReset.getDate() + 7);
        break;
      case 'monthly':
        nextReset = new Date(resetTime);
        nextReset.setMonth(nextReset.getMonth() + 1);
        break;
      case 'rolling':
        // Rolling 24-hour window - update reset to now + 24h
        nextReset = new Date(now);
        nextReset.setHours(nextReset.getHours() + 24);
        break;
      default:
        nextReset = resetTime;
    }

    // Reset budget
    await env.DB
      .prepare('UPDATE provider_budgets SET daily_used = 0, reset_time = ?, updated_at = ? WHERE id = ?')
      .bind(nextReset.toISOString(), new Date().toISOString(), budget.id)
      .run();

    budget.dailyUsed = 0;
    budget.resetTime = nextReset.toISOString();
  }
}

/**
 * Find an alternative provider with available budget.
 *
 * The provider selection algorithm considers:
 * 1. **Remaining Budget %**: Providers with more free tier are prioritized
 * 2. **Priority**: User-configured priority (1 = highest)
 * 3. **Pinned Status**: Pinned providers get priority boost
 * 4. **Enabled**: Only consider enabled providers
 *
 * @returns The best alternative provider or null if none available
 */
async function findAlternativeProvider(
  env: Env,
  userId: string,
  currentProvider: string
): Promise<BudgetProvider | null> {
  const result = await env.DB
    .prepare('SELECT * FROM provider_budgets WHERE user_id = ? AND enabled = 1 AND provider_id != ? ORDER BY priority ASC, pinned DESC, daily_used ASC')
    .bind(userId, currentProvider)
    .all();

  if (!result.results.length) return null;

  // Find first provider with remaining budget
  for (const row of result.results) {
    const budget = row as any;
    const remaining = budget.daily_limit - budget.daily_used;
    if (remaining > 0.01) { // At least 1 cent remaining
      return budget.provider_id as BudgetProvider;
    }
  }

  return null;
}

/**
 * Get comprehensive status for all providers.
 *
 * This includes:
 * - Per-provider usage summary
 * - Daily totals
 * - Alerts for providers near/exceeding limits
 * - Recommendation for next provider to use
 */
async function getAllProviderStatus(
  env: Env,
  userId: string
): Promise<AllProvidersStatus> {
  const providersResult = await env.DB
    .prepare('SELECT * FROM provider_budgets WHERE user_id = ? AND enabled = 1 ORDER BY priority ASC')
    .bind(userId)
    .all();

  const providers: ProviderBudget[] = [];
  const byProvider: ProviderUsageSummary[] = [];
  const alerts: ProviderAlert[] = [];

  let totalSpent = 0;
  let totalBudget = 0;
  let totalCalls = 0;
  let totalTokens = 0;

  for (const row of providersResult.results) {
    const budget = row as any;
    await checkAndResetBudget(env, budget);

    const provider: ProviderBudget = {
      id: budget.id,
      userId: budget.user_id,
      providerId: budget.provider_id,
      apiKey: budget.api_key, // In production, don't return this!
      dailyLimit: budget.daily_limit,
      dailyUsed: budget.daily_used,
      resetTime: budget.reset_time,
      resetSchedule: budget.reset_schedule,
      alertThreshold: budget.alert_threshold,
      mode: budget.mode,
      priority: budget.priority,
      enabled: budget.enabled === 1,
      pinned: budget.pinned === 1,
      customEndpoint: budget.custom_endpoint,
      createdAt: budget.created_at,
      updatedAt: budget.updated_at,
    };

    providers.push(provider);

    const utilizationPercent = budget.daily_limit > 0
      ? (budget.daily_used / budget.daily_limit) * 100
      : 0;

    const summary: ProviderUsageSummary = {
      providerId: budget.provider_id,
      spent: budget.daily_used,
      limit: budget.daily_limit,
      utilizationPercent,
      calls: 0, // Would need to query usage_records
      overBudget: utilizationPercent >= 100,
      nearLimit: utilizationPercent >= budget.alert_threshold,
    };

    byProvider.push(summary);

    totalSpent += budget.daily_used;
    totalBudget += budget.daily_limit;

    // Generate alerts
    if (utilizationPercent >= budget.alert_threshold) {
      const type = utilizationPercent >= 100 ? 'critical' :
                   utilizationPercent >= 95 ? 'critical' : 'warning';

      alerts.push({
        providerId: budget.provider_id,
        type,
        message: `${budget.provider_id}: ${utilizationPercent.toFixed(1)}% of daily budget used`,
        usagePercent: utilizationPercent,
        threshold: budget.alert_threshold,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Get call counts from usage_records
  const today = new Date().toISOString().split('T')[0];
  const callsResult = await env.DB
    .prepare(`SELECT provider_id, COUNT(*) as count, SUM(input_tokens + output_tokens) as tokens
              FROM usage_records
              WHERE user_id = ? AND date(timestamp) = ?
              GROUP BY provider_id`)
    .bind(userId, today)
    .all();

  const callMap = new Map<string, { count: number; tokens: number }>();
  for (const row of callsResult.results) {
    callMap.set(row.provider_id, { count: row.count, tokens: row.tokens });
  }

  // Update provider summaries with call counts
  for (const summary of byProvider) {
    const calls = callMap.get(summary.providerId);
    if (calls) {
      summary.calls = calls.count;
      totalCalls += calls.count;
      totalTokens += calls.tokens;
    }
  }

  const utilizationPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const summary: DailyUsageSummary = {
    userId,
    date: today,
    totalSpent,
    totalBudget,
    utilizationPercent,
    totalCalls,
    totalTokens,
    byProvider,
    alerts,
  };

  // Generate recommendation
  const recommendation = generateRecommendation(providers, byProvider);

  // Get pending tasks
  const tasksResult = await env.DB
    .prepare('SELECT * FROM fill_knowledge_tasks WHERE user_id = ? AND status = ? ORDER BY priority ASC')
    .bind(userId, 'pending')
    .all();

  return {
    userId,
    providers,
    summary,
    recommendation,
    pendingTasks: tasksResult.results,
  };
}

/**
 * Generate a provider recommendation based on current status.
 *
 * The recommendation algorithm:
 * 1. If any provider is pinned and has budget, recommend it
 * 2. Otherwise, recommend provider with most remaining budget percentage
 * 3. If all providers exhausted, recommend Ollama (local, free)
 */
function generateRecommendation(
  providers: ProviderBudget[],
  summaries: ProviderUsageSummary[]
): ProviderRecommendation {
  // Check for pinned providers first
  const pinned = providers.find(p => p.pinned && p.enabled && p.dailyUsed < p.dailyLimit);
  if (pinned) {
    const summary = summaries.find(s => s.providerId === pinned.providerId);
    return {
      providerId: pinned.providerId,
      reason: 'User-pinned provider with available budget',
      remaining: pinned.dailyLimit - pinned.dailyUsed,
    };
  }

  // Find provider with most remaining budget percentage
  let bestProvider: ProviderUsageSummary | null = null;
  let bestPercent = -1;

  for (const summary of summaries) {
    if (!summary.overBudget && summary.utilizationPercent < bestPercent) {
      bestProvider = summary;
      bestPercent = summary.utilizationPercent;
    }
  }

  if (bestProvider) {
    return {
      providerId: bestProvider.providerId,
      reason: 'Provider with most remaining free tier',
      remaining: bestProvider.limit - bestProvider.spent,
    };
  }

  // All providers exhausted, recommend local
  return {
    providerId: 'ollama',
    reason: 'All free tiers exhausted, using local model',
    remaining: Infinity,
  };
}

/**
 * Schedule a fill-knowledge task for end-of-day processing.
 *
 * Fill-knowledge tasks use remaining free-tier budget productively:
 * - Generate embeddings for knowledge base
 * - Warm up response cache
 * - Generate training data
 * - Summarize documents
 *
 * The task is scheduled for end-of-day (typically 11:50 PM) to use
 * any remaining free-tier budget before it resets.
 *
 * ## The Fill Knowledge Strategy
 *
 * When free tier is nearly exhausted but not empty:
 * 1. Switch to next available provider for immediate requests
 * 2. Queue fill-knowledge tasks to use the last 5-10% of budget
 * 3. These tasks run at end-of-day when they won't block user requests
 * 4. Result: Knowledge base is expanded using "free" budget that
 *    would otherwise be wasted, enabling cheaper/faster responses
 *    the next day via better caching/embeddings
 */
async function scheduleFillKnowledgeTask(
  env: Env,
  options: {
    userId: string;
    providerId: string;
    taskType: FillKnowledgeTaskType;
    priority: number;
    estimatedCost: number;
    parameters: Record<string, unknown>;
    scheduledFor?: string;
  }
): Promise<FillKnowledgeTask> {
  // Schedule for 11:50 PM today if not specified
  let scheduledFor = options.scheduledFor;
  if (!scheduledFor) {
    const tonight = new Date();
    tonight.setHours(23, 50, 0, 0);
    scheduledFor = tonight.toISOString();
  }

  const task: FillKnowledgeTask = {
    id: crypto.randomUUID(),
    userId: options.userId,
    providerId: options.providerId,
    taskType: options.taskType,
    priority: options.priority,
    estimatedCost: options.estimatedCost,
    parameters: options.parameters,
    status: 'pending',
    retryCount: 0,
    maxRetries: 3,
    scheduledFor,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await env.DB
    .prepare(`INSERT INTO fill_knowledge_tasks (
      id, user_id, provider_id, task_type, priority, estimated_cost,
      parameters, status, retry_count, max_retries, scheduled_for,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      task.id,
      task.userId,
      task.providerId,
      task.taskType,
      task.priority,
      task.estimatedCost,
      JSON.stringify(task.parameters),
      task.status,
      task.retryCount,
      task.maxRetries,
      task.scheduledFor,
      task.createdAt,
      task.updatedAt
    )
    .run();

  return task;
}

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router.handle(request, env, ctx).catch((err) => {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    });
  },
};
