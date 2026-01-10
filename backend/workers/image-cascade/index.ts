/**
 * Image Cascade Router - Main Entry Point
 *
 * This module implements cascade routing for image generation with:
 * - Quality tier selection (draft -> preview -> final)
 * - Provider routing logic based on cost and availability
 * - Agent-driven prompt crafting and refinement
 * - Cost tracking and optimization
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CASCADE STRATEGY FOR IMAGES
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The cascade approach allows users to iterate rapidly on image concepts
 * using cheap/fast models, then upscale to premium quality for final renders.
 *
 * TIER SELECTION LOGIC:
 * 1. User requests a quality tier (draft/preview/final)
 * 2. System checks if user's subscription allows that tier
 * 3. Provider is selected based on:
 *    - Tier requirements (speed vs quality)
 *    - Provider availability
 *    - Rate limits and quotas
 * 4. Agent optionally refines the prompt for better results
 * 5. Image is generated and stored in R2
 * 6. Results and costs are tracked for analytics
 *
 * COST SAVINGS EXAMPLE:
 * - Traditional: 10 final renders @ $0.04 each = $0.40
 * - Cascade: 10 drafts @ $0.000 + 1 final @ $0.04 = $0.04 (90% savings)
 *
 * ═══════════════════════════════════════════════════════════════════════
 * API ENDPOINTS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * POST /api/v1/images/generate
 *   Main image generation endpoint with cascade routing
 *
 * POST /api/v1/images/craft-prompt
 *   Agent-driven prompt crafting before generation
 *
 * POST /api/v1/images/refine-prompt
 *   Refine an existing prompt based on feedback
 *
 * POST /api/v1/images/upscale
 *   Upscale a draft image to higher quality tier
 *
 * GET /api/v1/images/history
 *   Get user's image generation history
 *
 * GET /api/v1/images/:id
 *   Get details of a specific generation
 *
 * GET /api/v1/images/costs/estimate
 *   Estimate cost for a generation request
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

// Simple ID generator
function nanoid(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════
// Imports
// ═══════════════════════════════════════════════════════════════════════

import type {
  ImageQuality,
  ImageResolution,
} from './quality-tiers.js';
import {
  QUALITY_TIERS,
  USER_TIER_LIMITS,
  canUserAccessTier,
  getRecommendedTier,
  calculateTierCost,
  type UseCase,
} from './quality-tiers.js';
import {
  createImageProvider,
  getAvailableProviders,
  type ImageProvider,
  type ImageGenerationRequest,
  type ImageGenerationResponse,
} from './providers.js';
import {
  AgentPromptService,
  enhancePromptQuick,
  generateNegativePrompt,
  type PromptContext,
  type AgentPrompt,
  type PromptRefinementRequest,
  type AgentType,
} from './agent-prompts.js';

// ═══════════════════════════════════════════════════════════════════════
// Extended Types for API
// ═══════════════════════════════════════════════════════════════════════

/**
 * API request body for image generation
 */
export interface ImageGenerateAPIRequest {
  /** The prompt for image generation */
  prompt: string;

  /** Negative prompt (optional) */
  negativePrompt?: string;

  /** Quality tier (draft/preview/final) */
  tier?: ImageQuality;

  /** Output resolution */
  resolution?: ImageResolution;

  /** Number of images to generate */
  count?: number;

  /** Use case (for auto-tier selection) */
  useCase?: UseCase;

  /** Whether to use agent prompt crafting */
  useAgent?: boolean;

  /** Agent type for prompt crafting */
  agentType?: AgentType;

  /** Seed for reproducible results */
  seed?: number;

  /** Provider override */
  provider?: string;
}

/**
 * API response for image generation
 */
export interface ImageGenerateAPIResponse {
  /** Unique ID for this generation */
  id: string;

  /** Generated images */
  images: Array<{
    url: string;
    width: number;
    height: number;
  }>;

  /** Quality tier used */
  tier: ImageQuality;

  /** Provider that generated the images */
  provider: string;

  /** Model used */
  model: string;

  /** Actual cost in USD */
  cost: number;

  /** Generation time in milliseconds */
  latencyMs: number;

  /** Prompt that was used (may be refined by agent) */
  promptUsed: string;

  /** Whether agent was used for prompt crafting */
  agentUsed: boolean;

  /** Revised prompt (if provider modified it) */
  revisedPrompt?: string;
}

/**
 * Cost estimate response
 */
export interface CostEstimateResponse {
  /** Estimated cost per image */
  costPerImage: number;

  /** Total estimated cost */
  totalCost: number;

  /** Currency */
  currency: string;

  /** Recommended tier */
  recommendedTier: ImageQuality;

  /** Cost breakdown by tier */
  breakdown: Array<{
    tier: ImageQuality;
    provider: string;
    cost: number;
    estimatedTime: number;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════
// Environment Types
// ═══════════════════════════════════════════════════════════════════════

export interface ImageCascadeEnv {
  // D1 Database
  STUDENT_STATE: D1Database;

  // R2 Storage
  ASSET_STORAGE: R2Bucket;
  PROJECT_STORAGE: R2Bucket;

  // KV Cache
  IMAGE_CACHE?: KVNamespace;
  RATE_LIMITS: KVNamespace;

  // Workers AI
  AI?: Ai;

  // Provider API Keys
  ZHIPU_API_KEY?: string;
  REPLICATE_API_KEY?: string;
  OPENAI_API_KEY?: string;

  // Environment
  ENVIRONMENT?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Image Cascade Service
// ═══════════════════════════════════════════════════════════════════════

/**
 * Image Cascade Service
 *
 * Main service for handling image generation with cascade routing.
 */
export class ImageCascadeService {
  private providers: Map<string, ImageProvider> = new Map();
  private promptService: AgentPromptService;

  constructor(private env: ImageCascadeEnv) {
    // Initialize available providers
    const availableProviders = getAvailableProviders(env);
    for (const provider of availableProviders) {
      this.providers.set(provider.name, provider);
    }

    // Initialize prompt service (if AI is available)
    this.promptService = new AgentPromptService(env.AI!, env.STUDENT_STATE);
  }

  /**
   * Generate images with cascade routing
   *
   * This is the main entry point for image generation. It handles:
   * 1. User tier validation
   * 2. Quality tier selection
   * 3. Provider selection
   * 4. Optional agent prompt refinement
   * 5. Image generation
   * 6. Cost tracking
   */
  async generate(
    request: ImageGenerateAPIRequest,
    userId?: string,
    userTier: 'free' | 'forge' | 'studio' | 'lab' = 'free'
  ): Promise<ImageGenerateAPIResponse> {
    const id = nanoid();
    const startTime = Date.now();

    // 1. Determine quality tier
    let tier = request.tier;
    if (!tier) {
      // Auto-select tier based on use case
      tier = getRecommendedTier(request.useCase || 'concept-exploration');
    }

    // 2. Check if user can access this tier
    if (!canUserAccessTier(userTier, tier)) {
      throw new Error(`User tier '${userTier}' cannot access quality tier '${tier}'. ` +
        `Maximum accessible tier: ${USER_TIER_LIMITS[userTier].maxQualityTier}`);
    }

    // 3. Get tier configuration
    const tierConfig = QUALITY_TIERS[tier];

    // 4. Select provider
    const providerName = request.provider || tierConfig.provider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider '${providerName}' is not available. ` +
        `Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    // 5. Prepare prompt (with optional agent refinement)
    let finalPrompt = request.prompt;
    let finalNegativePrompt = request.negativePrompt;
    let agentUsed = false;
    let agentType: AgentType | undefined;

    if (request.useAgent && this.env.AI) {
      // Use agent to craft/refine prompt
      const promptContext: PromptContext = {
        useCase: request.useCase || 'concept-exploration',
        targetTier: tier,
        style: request.resolution ? `${request.resolution} resolution` : undefined,
      };

      const agentPrompt = await this.promptService.craftPrompt(
        request.prompt,
        promptContext,
        request.agentType || 'artist'
      );

      finalPrompt = agentPrompt.prompt;
      finalNegativePrompt = agentPrompt.negativePrompt || request.negativePrompt;
      agentUsed = true;
      agentType = request.agentType || 'artist';
    } else if (!request.negativePrompt) {
      // Generate negative prompt automatically
      finalNegativePrompt = generateNegativePrompt(request.useCase || 'concept-exploration');
    }

    // 6. Build provider request
    const providerRequest: ImageGenerationRequest = {
      prompt: finalPrompt,
      negativePrompt: finalNegativePrompt,
      tier,
      resolution: request.resolution,
      count: Math.min(request.count || 1, tierConfig.maxImages),
      seed: request.seed,
      userTier,
      agentId: agentType,
    };

    // 7. Generate image
    const result = await provider.generate(providerRequest);

    // 8. Store generation record in database
    await this.storeGenerationRecord({
      id,
      userId: userId || null,
      prompt: request.prompt,
      refinedPrompt: agentUsed ? finalPrompt : null,
      negativePrompt: finalNegativePrompt,
      tier,
      provider: result.provider,
      model: result.model,
      cost: result.cost,
      latencyMs: result.latencyMs,
      success: true,
      agentUsed,
      agentType,
    });

    // 9. Return response
    return {
      id,
      images: result.images.map(img => ({
        url: img.url,
        width: img.width,
        height: img.height,
      })),
      tier,
      provider: result.provider,
      model: result.model,
      cost: result.cost,
      latencyMs: result.latencyMs,
      promptUsed: finalPrompt,
      agentUsed,
      revisedPrompt: result.revisedPrompt,
    };
  }

  /**
   * Craft a prompt using an agent (without generating)
   */
  async craftPrompt(
    prompt: string,
    context: PromptContext,
    agent: AgentType
  ): Promise<AgentPrompt> {
    if (!this.env.AI) {
      throw new Error('AI binding is required for agent prompt crafting');
    }

    return this.promptService.craftPrompt(prompt, context, agent);
  }

  /**
   * Refine an existing prompt
   */
  async refinePrompt(request: PromptRefinementRequest): Promise<{
    refinedPrompt: string;
    refinedNegativePrompt?: string;
    explanation: string;
  }> {
    if (!this.env.AI) {
      throw new Error('AI binding is required for prompt refinement');
    }

    const result = await this.promptService.refinePrompt(request);

    return {
      refinedPrompt: result.refinedPrompt,
      refinedNegativePrompt: result.refinedNegativePrompt,
      explanation: result.explanation,
    };
  }

  /**
   * Upscale a draft image to higher quality
   */
  async upscale(
    generationId: string,
    targetTier: ImageQuality,
    userId?: string
  ): Promise<ImageGenerateAPIResponse> {
    // Get original generation
    const original = await this.getGeneration(generationId);
    if (!original) {
      throw new Error(`Generation '${generationId}' not found`);
    }

    // Can only upscale from lower to higher tier
    const tierOrder: ImageQuality[] = ['draft', 'preview', 'final'];
    const currentIndex = tierOrder.indexOf(original.tier as ImageQuality);
    const targetIndex = tierOrder.indexOf(targetTier);

    if (targetIndex <= currentIndex) {
      throw new Error(`Can only upscale to higher quality. Current: ${original.tier}, Target: ${targetTier}`);
    }

    // Generate new image at higher tier
    return this.generate({
      prompt: original.prompt || original.refinedPrompt || '',
      tier: targetTier,
      useAgent: true,
    }, userId, 'free');
  }

  /**
   * Estimate cost for a generation request
   */
  async estimateCost(
    request: ImageGenerateAPIRequest,
    userTier: 'free' | 'forge' | 'studio' | 'lab' = 'free'
  ): Promise<CostEstimateResponse> {
    // Determine tier
    let tier = request.tier;
    if (!tier) {
      tier = getRecommendedTier(request.useCase || 'concept-exploration');
    }

    // Check user access
    if (!canUserAccessTier(userTier, tier)) {
      tier = USER_TIER_LIMITS[userTier].maxQualityTier;
    }

    // Get tier config
    const tierConfig = QUALITY_TIERS[tier];

    // Calculate cost
    const count = request.count || 1;
    const costPerImage = tierConfig.costPerImage * (1 - USER_TIER_LIMITS[userTier].costDiscount);
    const totalCost = costPerImage * Math.min(count, tierConfig.maxImages);

    // Build breakdown
    const breakdown = [
      {
        tier: ImageQuality.DRAFT,
        provider: QUALITY_TIERS[ImageQuality.DRAFT].provider,
        cost: calculateTierCost(ImageQuality.DRAFT, count),
        estimatedTime: QUALITY_TIERS[ImageQuality.DRAFT].estimatedLatency * count,
      },
      {
        tier: ImageQuality.PREVIEW,
        provider: QUALITY_TIERS[ImageQuality.PREVIEW].provider,
        cost: calculateTierCost(ImageQuality.PREVIEW, count),
        estimatedTime: QUALITY_TIERS[ImageQuality.PREVIEW].estimatedLatency * count,
      },
      {
        tier: ImageQuality.FINAL,
        provider: QUALITY_TIERS[ImageQuality.FINAL].provider,
        cost: calculateTierCost(ImageQuality.FINAL, count),
        estimatedTime: QUALITY_TIERS[ImageQuality.FINAL].estimatedLatency * count,
      },
    ];

    return {
      costPerImage,
      totalCost,
      currency: 'USD',
      recommendedTier: tier,
      breakdown,
    };
  }

  /**
   * Get user's generation history
   */
  async getHistory(userId: string, limit = 20): Promise<any[]> {
    const results = await this.env.STUDENT_STATE.prepare(`
      SELECT * FROM image_generations
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, limit).all();

    return (results.results || []).map((r: any) => ({
      id: r.id,
      prompt: r.prompt,
      refinedPrompt: r.refined_prompt,
      tier: r.tier,
      provider: r.provider,
      model: r.model,
      cost: r.cost,
      latencyMs: r.latency_ms,
      createdAt: r.created_at,
    }));
  }

  /**
   * Get a specific generation
   */
  async getGeneration(id: string): Promise<any> {
    const result = await this.env.STUDENT_STATE.prepare(`
      SELECT * FROM image_generations WHERE id = ?
    `).bind(id).first();

    return result || null;
  }

  /**
   * Store generation record in database
   */
  private async storeGenerationRecord(data: {
    id: string;
    userId: string | null;
    prompt: string;
    refinedPrompt: string | null;
    negativePrompt: string | undefined;
    tier: ImageQuality;
    provider: string;
    model: string;
    cost: number;
    latencyMs: number;
    success: boolean;
    agentUsed: boolean;
    agentType?: string;
  }): Promise<void> {
    await this.env.STUDENT_STATE.prepare(`
      INSERT INTO image_generations (
        id, user_id, prompt, refined_prompt, negative_prompt,
        tier, provider, model, cost, latency_ms, success,
        agent_used, agent_type, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      data.id,
      data.userId,
      data.prompt,
      data.refinedPrompt,
      data.negativePrompt || null,
      data.tier,
      data.provider,
      data.model,
      data.cost,
      data.latencyMs,
      data.success ? 1 : 0,
      data.agentUsed ? 1 : 0,
      data.agentType || null
    ).run();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Request Handlers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Main request handler for image cascade API
 */
export async function handleImageCascadeRequest(
  request: Request,
  env: ImageCascadeEnv,
  _ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/v1/images', '');
  const method = request.method;

  const service = new ImageCascadeService(env);

  // Get user info from headers (in production, verify JWT)
  const userId = request.headers.get('X-User-Id') || undefined;
  const userTierHeader = request.headers.get('X-User-Tier');
  const userTier: 'free' | 'forge' | 'studio' | 'lab' =
    (userTierHeader as any) || 'free';

  // CORS
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-User-Tier',
      },
    });
  }

  try {
    // POST /generate - Generate images
    if (path === '/generate' && method === 'POST') {
      const data = await request.json() as ImageGenerateAPIRequest;

      if (!data.prompt) {
        return Response.json({ error: 'Missing required field: prompt' }, { status: 400 });
      }

      const result = await service.generate(data, userId, userTier);

      return Response.json(result, { status: 201 });
    }

    // POST /craft-prompt - Craft prompt using agent
    if (path === '/craft-prompt' && method === 'POST') {
      const data = await request.json() as {
        prompt: string;
        useCase?: string;
        tier?: ImageQuality;
        agent?: AgentType;
      };

      if (!data.prompt) {
        return Response.json({ error: 'Missing required field: prompt' }, { status: 400 });
      }

      const result = await service.craftPrompt(
        data.prompt,
        {
          useCase: (data.useCase as any) || 'concept-exploration',
          targetTier: data.tier || 'draft',
        },
        data.agent || 'artist'
      );

      return Response.json(result);
    }

    // POST /refine-prompt - Refine existing prompt
    if (path === '/refine-prompt' && method === 'POST') {
      const data = await request.json() as PromptRefinementRequest;

      if (!data.originalPrompt) {
        return Response.json({ error: 'Missing required field: originalPrompt' }, { status: 400 });
      }

      const result = await service.refinePrompt(data);

      return Response.json(result);
    }

    // POST /upscale - Upscale to higher quality
    if (path.startsWith('/upscale') && method === 'POST') {
      const data = await request.json() as {
        generationId: string;
        targetTier: ImageQuality;
      };

      if (!data.generationId || !data.targetTier) {
        return Response.json({
          error: 'Missing required fields: generationId, targetTier'
        }, { status: 400 });
      }

      const result = await service.upscale(data.generationId, data.targetTier, userId);

      return Response.json(result);
    }

    // GET /history - Get user's generation history
    if (path === '/history' && method === 'GET') {
      if (!userId) {
        return Response.json({ error: 'Authentication required' }, { status: 401 });
      }

      const limit = url.searchParams.get('limit')
        ? parseInt(url.searchParams.get('limit')!)
        : 20;

      const history = await service.getHistory(userId, limit);

      return Response.json({ generations: history });
    }

    // GET /costs/estimate - Estimate generation cost
    if (path === '/costs/estimate' && method === 'POST') {
      const data = await request.json() as ImageGenerateAPIRequest;

      const estimate = await service.estimateCost(data, userTier);

      return Response.json(estimate);
    }

    // GET /:id - Get generation details
    if (path.match(/^\/[^/]+$/) && method === 'GET') {
      const id = path.slice(1);
      const generation = await service.getGeneration(id);

      if (!generation) {
        return Response.json({ error: 'Generation not found' }, { status: 404 });
      }

      return Response.json(generation);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });

  } catch (error: any) {
    console.error('Image cascade error:', error);
    return Response.json({
      error: error.message || 'Internal server error',
    }, { status: 500 });
  }
}
