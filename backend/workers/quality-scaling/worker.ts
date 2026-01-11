/**
 * Quality Scaling Worker
 *
 * Cloudflare Worker for the quality scaling system.
 * Handles HTTP requests for hardware detection, quality management,
 * and performance reporting.
 *
 * @fileoverview Cloudflare Worker entry point
 */

import { Router } from 'itty-router';

// Import types
import type {
  DetectHardwareRequest,
  DetectHardwareResponse,
  SetQualityRequest,
  SetQualityResponse,
  UpdateBudgetRequest,
  ReportPerformanceRequest,
  ReportPerformanceResponse,
  GetAssetRequest,
  GetAssetResponse,
  QualityTier,
  BudgetTier,
} from './types.js';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // KV Namespace for caching hardware profiles and quality states
  QUALITY_CACHE: KVNamespace;

  // D1 Database for persistent user budget storage
  DB?: D1Database;

  // Optional: R2 for asset storage
  ASSETS?: R2Bucket;
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
// CORS Handling
// ============================================================================

router.options('*', () => new Response(null, { headers: corsHeaders }));

// ============================================================================
// Health Check
// ============================================================================

router.get('/', () => {
  return jsonResponse({
    status: 'healthy',
    service: 'quality-scaling',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Hardware Detection
// ============================================================================

/**
 * POST /detect
 * Detect hardware capabilities and return quality recommendations.
 */
router.post('/detect', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as DetectHardwareRequest & { userId?: string };

  try {
    // Import modules dynamically for Cloudflare Workers
    const { detectHardware } = await import('./hardware-detector.js');
    const { createDefaultUserBudget } = await import('./budget-manager.js');
    const { calculateQualityConstraints } = await import('./budget-manager.js');
    const { getQualitySettings } = await import('./quality-presets.js');
    const { getMaxQualityTier } = await import('./hardware-detector.js');
    const { getMaxAvailableTier } = await import('./budget-manager.js');

    // Detect hardware
    const hardware = await detectHardware(body);

    // Store hardware profile in cache if userId provided
    if (body.userId && env.QUALITY_CACHE) {
      await env.QUALITY_CACHE.put(
        `hardware:${body.userId}`,
        JSON.stringify(hardware),
        { expirationTtl: 86400 * 7 } // 7 days
      );
    }

    // Get or create user budget
    let budget;
    if (body.userId && env.DB) {
      const result = await env.DB
        .prepare('SELECT * FROM user_budgets WHERE user_id = ?')
        .bind(body.userId)
        .first();

      if (result) {
        budget = {
          userId: result.user_id as string,
          tier: result.tier as BudgetTier,
          dailyRemaining: result.daily_remaining as number,
          dailyLimit: result.daily_limit as number,
          monthlyRemaining: result.monthly_remaining as number,
          monthlyLimit: result.monthly_limit as number,
          grainBalance: result.grain_balance as number,
          preference: (result.preference as string) ?? 'balanced',
          overrideTier: result.override_tier as QualityTier | undefined,
          highQualityOptIn: result.high_quality_opt_in as number === 1,
          updatedAt: result.updated_at as string,
        };
      } else {
        budget = createDefaultUserBudget(body.userId);
      }
    } else {
      budget = createDefaultUserBudget('anonymous');
    }

    // Calculate quality constraints
    const hardwareMaxTier = getMaxQualityTier(hardware);
    const constraints = calculateQualityConstraints(budget, hardwareMaxTier);

    const response: DetectHardwareResponse = {
      hardware,
      recommendedTier: constraints.recommendedTier,
      maxTier: constraints.maxTier,
      constraints,
      settings: getQualitySettings(constraints.recommendedTier),
    };

    return jsonResponse(response);
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /hardware/:userId
 * Get stored hardware profile for a user.
 */
router.get('/hardware/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!userId) {
    return errorResponse('userId required', 400);
  }

  // Try cache first
  if (env.QUALITY_CACHE) {
    const cached = await env.QUALITY_CACHE.get(`hardware:${userId}`, 'json');
    if (cached) {
      return jsonResponse({ hardware: cached });
    }
  }

  // Try database
  if (env.DB) {
    const result = await env.DB
      .prepare('SELECT hardware_profile FROM user_hardware WHERE user_id = ?')
      .bind(userId)
      .first();

    if (result) {
      return jsonResponse({ hardware: JSON.parse(result.hardware_profile as string) });
    }
  }

  return errorResponse('Hardware profile not found', 404);
});

// ============================================================================
// Quality Management
// ============================================================================

/**
 * POST /quality/set
 * Set quality tier for a session.
 */
router.post('/quality/set', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as SetQualityRequest;

  if (!body.sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    // Get quality manager
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();

    const response = await manager.setQuality(body);

    return jsonResponse(response);
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /quality/:sessionId
 * Get quality state for a session.
 */
router.get('/quality/:sessionId', async (req) => {
  const sessionId = req.param?.sessionId;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();
    const state = manager.getQualityState(sessionId);

    return jsonResponse({ state });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * POST /quality/lock
 * Lock quality at current level.
 */
router.post('/quality/lock', async (req) => {
  const body = await req.json();
  const { sessionId, reason } = body;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { lockQuality } = await import('./adaptive-scaler.js');
    const state = lockQuality(sessionId, reason);

    return jsonResponse({ state });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * POST /quality/unlock
 * Unlock quality for auto-adjustment.
 */
router.post('/quality/unlock', async (req) => {
  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { unlockQuality } = await import('./adaptive-scaler.js');
    const state = unlockQuality(sessionId);

    return jsonResponse({ state });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

// ============================================================================
// Budget Management
// ============================================================================

/**
 * POST /budget/update
 * Update user budget.
 */
router.post('/budget/update', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as UpdateBudgetRequest & { userId: string };

  if (!body.userId) {
    return errorResponse('userId required', 400);
  }

  try {
    // Get quality manager
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();

    const budget = manager.updateUserBudget(body.userId, body);

    // Update database if available
    if (env.DB) {
      await env.DB
        .prepare(`INSERT OR REPLACE INTO user_budgets (
          user_id, tier, daily_remaining, daily_limit,
          monthly_remaining, monthly_limit, grain_balance,
          preference, override_tier, high_quality_opt_in, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          budget.userId,
          budget.tier,
          budget.dailyRemaining,
          budget.dailyLimit,
          budget.monthlyRemaining === Infinity ? -1 : budget.monthlyRemaining,
          budget.monthlyLimit === Infinity ? -1 : budget.monthlyLimit,
          budget.grainBalance,
          budget.preference,
          budget.overrideTier ?? null,
          budget.highQualityOptIn ? 1 : 0,
          new Date().toISOString()
        )
        .run();
    }

    return jsonResponse({ budget });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /budget/:userId
 * Get user budget.
 */
router.get('/budget/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!userId) {
    return errorResponse('userId required', 400);
  }

  try {
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();
    const budget = manager.getUserBudget(userId);

    return jsonResponse({ budget });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /constraints/:userId
 * Get quality constraints for a user.
 */
router.get('/constraints/:userId', async (req) => {
  const userId = req.param?.userId;

  if (!userId) {
    return errorResponse('userId required', 400);
  }

  try {
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();
    const constraints = manager.getQualityConstraints(userId);

    return jsonResponse({ constraints });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

// ============================================================================
// Performance Reporting
// ============================================================================

/**
 * POST /performance/report
 * Report performance metrics.
 */
router.post('/performance/report', async (req) => {
  const body = (await req.json()) as ReportPerformanceRequest;

  if (!body.sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();

    const response = manager.reportPerformance(body);

    return jsonResponse(response);
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /performance/:sessionId/stats
 * Get performance statistics for a session.
 */
router.get('/performance/:sessionId/stats', async (req) => {
  const sessionId = req.param?.sessionId;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { getQualityManager } = await import('./quality-manager.js');
    const manager = getQualityManager();
    const stats = manager.getPerformanceStats(sessionId);

    return jsonResponse({ stats });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * POST /performance/start
 * Start performance tracking for a session.
 */
router.post('/performance/start', async (req) => {
  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { startTracking } = await import('./performance-monitor.js');
    startTracking(sessionId);

    return jsonResponse({ success: true, sessionId });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * POST /performance/stop
 * Stop performance tracking for a session.
 */
router.post('/performance/stop', async (req) => {
  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { stopTracking } = await import('./performance-monitor.js');
    const samples = stopTracking(sessionId);

    return jsonResponse({ success: true, sessionId, samples });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

// ============================================================================
// Asset LOD
// ============================================================================

/**
 * GET /asset/:assetId
 * Get asset URL at appropriate quality level.
 */
router.get('/asset/:assetId', async (req) => {
  const assetId = req.param?.assetId;
  const url = new URL(req.url);

  if (!assetId) {
    return errorResponse('assetId required', 400);
  }

  const qualityTier = parseInt(url.searchParams.get('qualityTier') ?? '2') as QualityTier;
  const distance = parseFloat(url.searchParams.get('distance') ?? '0');
  const screenSize = parseFloat(url.searchParams.get('screenSize') ?? '1.0');

  try {
    const { getAssetUrl } = await import('./asset-lod.js');

    const response = getAssetUrl({
      assetId,
      qualityTier,
      distance,
      screenSize,
      allowUpgrade: true,
    });

    return jsonResponse(response);
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * POST /asset/register
 * Register an asset with LOD configuration.
 */
router.post('/asset/register', async (req) => {
  const body = await req.json();

  if (!body.assetId || !body.baseUrl) {
    return errorResponse('assetId and baseUrl required', 400);
  }

  try {
    const { createAssetLOD, registerAssetLOD } = await import('./asset-lod.js');

    const assetLOD = createAssetLOD(
      body.assetId,
      body.assetType ?? 'model',
      body.baseUrl,
      {
        hasVoxelFallback: body.hasVoxelFallback ?? false,
        voxelUrl: body.voxelUrl,
        hasSpriteFallback: body.hasSpriteFallback ?? false,
        spriteUrl: body.spriteUrl,
      }
    );

    registerAssetLOD(assetLOD);

    return jsonResponse({ success: true, assetLOD });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

// ============================================================================
// Presets
// ============================================================================

/**
 * GET /presets
 * Get all quality presets.
 */
router.get('/presets', async () => {
  try {
    const { QUALITY_PRESETS } = await import('./quality-presets.js');

    return jsonResponse({ presets: QUALITY_PRESETS });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /presets/:product
 * Get quality presets for a specific product.
 */
router.get('/presets/:product', async (req) => {
  const product = req.param?.product as 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog';

  if (!product) {
    return errorResponse('product required', 400);
  }

  try {
    const { getProductPresets } = await import('./quality-presets.js');
    const presets = getProductPresets(product);

    return jsonResponse({ presets });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

// ============================================================================
// Adaptive Scaling Configuration
// ============================================================================

/**
 * POST /adaptive/configure
 * Configure adaptive scaling for a session.
 */
router.post('/adaptive/configure', async (req) => {
  const body = await req.json();
  const { sessionId, ...config } = body;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { setAdaptiveConfig } = await import('./adaptive-scaler.js');
    const newConfig = setAdaptiveConfig(sessionId, config);

    return jsonResponse({ config: newConfig });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

/**
 * GET /adaptive/:sessionId/config
 * Get adaptive scaling configuration for a session.
 */
router.get('/adaptive/:sessionId/config', async (req) => {
  const sessionId = req.param?.sessionId;

  if (!sessionId) {
    return errorResponse('sessionId required', 400);
  }

  try {
    const { getAdaptiveConfig } = await import('./adaptive-scaler.js');
    const config = getAdaptiveConfig(sessionId);

    return jsonResponse({ config });
  } catch (error) {
    return errorResponse((error as Error).message);
  }
});

// ============================================================================
// Utility Functions
// ============================================================================

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function errorResponse(message: string, status: number = 500): Response {
  return jsonResponse({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  }, status);
}

// ============================================================================
// Export Worker Handler
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router.handle(request, env, ctx).catch((err) => {
      return jsonResponse({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
      }, 500);
    });
  },
};

// ============================================================================
// Scheduled Handler (for cleanup tasks)
// ============================================================================

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Quality scaling scheduled task running at:', new Date().toISOString());

  // Clean up old performance data
  // Reset daily budgets
  // Aggregate statistics

  if (env.DB) {
    // Reset daily budgets for users where the day has rolled over
    await env.DB
      .prepare(`UPDATE user_budgets
        SET daily_remaining = daily_limit, updated_at = ?
        WHERE DATE(updated_at) < DATE(?)`)
      .bind(new Date().toISOString(), new Date().toISOString())
      .run();
  }
}
