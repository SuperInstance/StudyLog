/**
 * Image Cascade - Quality Tier Definitions
 *
 * This module defines the quality tiers for image generation cascade routing.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * CASCADE STRATEGY FOR IMAGES
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The cascade approach allows users to iterate rapidly on image concepts
 * using cheap/fast models, then upscale to premium quality for final renders.
 *
 * Flow:
 * 1. DRAFT tier - Generate 10+ variations in seconds for concept exploration
 * 2. PREVIEW tier - Refine promising concepts with better quality
 * 3. FINAL tier - Production-ready render with highest fidelity
 *
 * Cost Savings Example:
 * - Traditional: 10 final renders @ $0.04 each = $0.40
 * - Cascade: 10 drafts @ $0.001 + 1 final @ $0.04 = $0.05 (87% savings)
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

/**
 * Image quality tiers for cascade routing
 *
 * Each tier balances speed, cost, and quality differently:
 * - DRAFT: Fastest iteration for concept exploration
 * - PREVIEW: Balanced for refinement
 * - FINAL: Premium quality for production
 */
export enum ImageQuality {
  /** Fast, cheap, low quality - for rapid prototyping and concept exploration */
  DRAFT = 'draft',

  /** Medium quality - for refining promising concepts before final render */
  PREVIEW = 'preview',

  /** Highest quality - slow, expensive, production-ready final renders */
  FINAL = 'final',
}

/**
 * Quality tier configuration
 *
 * Defines the parameters for each quality tier including:
 * - Provider selection: Which AI service handles this tier
 * - Model: Specific model to use
 * - Resolution: Output image dimensions
 * - Steps: Number of inference steps (more = better quality but slower)
 * - Guidance: CFG scale (how closely to follow prompt)
 * - Cost: Estimated cost per image in USD
 * - Latency: Expected generation time in seconds
 */
export interface QualityTierConfig {
  /** Quality tier identifier */
  tier: ImageQuality;

  /** Provider to use for this tier */
  provider: ImageProvider;

  /** Model identifier */
  model: string;

  /** Output resolution */
  resolution: ImageResolution;

  /** Number of inference steps (affects quality/speed) */
  steps: number;

  /** Guidance scale (how strictly to follow prompt, 1-20) */
  guidance: number;

  /** Estimated cost per image in USD */
  costPerImage: number;

  /** Expected generation time in seconds */
  estimatedLatency: number;

  /** Maximum number of images per request */
  maxImages: number;
}

/**
 * Supported image resolutions
 *
 * Different tiers and providers support different resolutions.
 * Higher resolutions take longer and cost more.
 */
export type ImageResolution =
  | '256x256'
  | '512x512'
  | '768x768'
  | '1024x1024'
  | '1024x1792'  // Portrait
  | '1792x1024'  // Landscape
  | '1920x1080'  // Full HD
  | '2048x2048'
  | '4096x4096'; // Ultra HD

/**
 * Image generation providers
 *
 * Each provider has different strengths:
 * - cloudflare: Fastest, included in Workers plan, quality varies
 * - zhipu: Good quality, cost-effective Chinese provider
 * - replicate: Flexible model access, pay-per-use
 * - openai: DALL-E 3, best prompt adherence
 */
export type ImageProvider =
  | 'cloudflare'  // Workers AI - fast, included
  | 'zhipu'       // Z.ai CogView - good quality, cost-effective
  | 'replicate'   // SDXL, Stable Diffusion - flexible
  | 'openai';     // DALL-E 3 - premium quality

/**
 * Quality tier configurations
 *
 * These configurations define the provider, model, and parameters for each
 * quality tier. They are designed to provide a clear upgrade path from
 * rapid prototyping to final production assets.
 */
export const QUALITY_TIERS: Record<ImageQuality, QualityTierConfig> = {
  /**
   * DRAFT Tier - Rapid Prototyping
   *
   * Use this tier for:
   * - Exploring multiple concepts quickly
   * - Iterating on compositions and layouts
   * - Testing prompt variations
   * - Mockups and wireframes
   *
   * Provider: Cloudflare Workers AI
   * - Uses @cf/stabilityai/stable-diffusion-xl-base-1.0
   - Fast inference (2-5 seconds)
   * - Included in Workers free tier (up to 10k images/day)
   * - Good enough for concept validation
   */
  [ImageQuality.DRAFT]: {
    tier: ImageQuality.DRAFT,
    provider: 'cloudflare',
    model: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
    resolution: '512x512',
    steps: 10,        // Fewer steps = faster
    guidance: 7.5,    // Standard CFG
    costPerImage: 0.000,  // Free within Workers limits
    estimatedLatency: 3,  // 3 seconds
    maxImages: 10,    // Can generate many at once
  },

  /**
   * PREVIEW Tier - Refinement
   *
   * Use this tier for:
   * - Refining promising draft concepts
   * - Testing style variations
   * - Client/approval workflows
   * - Social media assets
   *
   * Provider: Z.ai (Zhipu) CogView
   * - Good quality output
   * - Cost-effective ($0.004 per image)
   * - Better detail and coherence than draft
   * - Supports higher resolutions
   */
  [ImageQuality.PREVIEW]: {
    tier: ImageQuality.PREVIEW,
    provider: 'zhipu',
    model: 'cogview-3',  // Zhipu's image model
    resolution: '1024x1024',
    steps: 25,
    guidance: 7.5,
    costPerImage: 0.004,  // ~1/10th of DALL-E 3
    estimatedLatency: 8,  // 8 seconds
    maxImages: 4,
  },

  /**
   * FINAL Tier - Production
   *
   * Use this tier for:
   * - Final production assets
   * - Print-ready images
   * - Marketing materials
   * - High-resolution textures
   *
   * Provider: OpenAI DALL-E 3
   * - Best prompt adherence and quality
   * - Native 1024x1024 resolution
   * - Excellent detail and coherence
   * - Higher cost ($0.04 per image)
   *
   * Alternative: Z.ai CogView-4 (when available)
   * - Similar quality to DALL-E 3
   * - Better pricing for volume
   * - Supports higher resolutions
   */
  [ImageQuality.FINAL]: {
    tier: ImageQuality.FINAL,
    provider: 'openai',
    model: 'dall-e-3',
    resolution: '1024x1024',
    steps: 30,        // Not applicable for DALL-E 3 but kept for consistency
    guidance: 10,     // DALL-E 3 has high built-in prompt adherence
    costPerImage: 0.040,  // $0.04 per standard image
    estimatedLatency: 15, // 10-20 seconds
    maxImages: 1,     // DALL-E 3 only supports n=1
  },
};

/**
 * Get configuration for a quality tier
 */
export function getTierConfig(tier: ImageQuality): QualityTierConfig {
  return QUALITY_TIERS[tier];
}

/**
 * Get the next tier up (for upgrade flows)
 */
export function getNextTier(currentTier: ImageQuality): ImageQuality | null {
  switch (currentTier) {
    case ImageQuality.DRAFT:
      return ImageQuality.PREVIEW;
    case ImageQuality.PREVIEW:
      return ImageQuality.FINAL;
    case ImageQuality.FINAL:
      return null;  // Already at highest tier
  }
}

/**
 * Calculate cost for generating images at a given tier
 */
export function calculateTierCost(tier: ImageQuality, count: number): number {
  const config = getTierConfig(tier);
  const cappedCount = Math.min(count, config.maxImages);
  return config.costPerImage * cappedCount;
}

/**
 * Estimate total generation time for a tier
 */
export function estimateGenerationTime(tier: ImageQuality, count: number): number {
  const config = getTierConfig(tier);
  const cappedCount = Math.min(count, config.maxImages);
  return config.estimatedLatency * cappedCount;
}

/**
 * Get recommended tier based on use case
 */
export function getRecommendedTier(useCase: UseCase): ImageQuality {
  switch (useCase) {
    case 'concept-exploration':
    case 'rapid-iteration':
    case 'mockup':
      return ImageQuality.DRAFT;

    case 'style-refinement':
    case 'approval-workflow':
    case 'social-media':
      return ImageQuality.PREVIEW;

    case 'production-asset':
    case 'print-material':
    case 'marketing':
    case 'texture-generation':
      return ImageQuality.FINAL;
  }
}

/**
 * Common use cases for image generation
 *
 * These use cases help auto-select the appropriate quality tier
 * based on what the user is trying to accomplish.
 */
export type UseCase =
  | 'concept-exploration'   // Early brainstorming
  | 'rapid-iteration'       // Testing prompt variations
  | 'mockup'                // UI/UX mockups
  | 'style-refinement'      // Refining look and feel
  | 'approval-workflow'     // Getting stakeholder buy-in
  | 'social-media'          // Social content
  | 'production-asset'      // Final game/app assets
  | 'print-material'        // Physical media
  | 'marketing'             // Marketing visuals
  | 'texture-generation';   // 3D textures

/**
 * User tier limits for image generation
 *
 * Different subscription tiers have different access levels
 * to image generation quality and quantity.
 */
export interface UserTierLimits {
  /** Maximum quality tier this user can access */
  maxQualityTier: ImageQuality;

  /** Images per day limit */
  dailyLimit: number;

  /** Priority in queue (higher = faster processing) */
  queuePriority: number;

  /** Discount on costs (0-1, where 0.5 = 50% off) */
  costDiscount: number;
}

/**
 * User tier configurations
 *
 * Maps subscription tiers to image generation limits.
 * Higher tiers get access to better quality and more images.
 */
export const USER_TIER_LIMITS: Record<'free' | 'forge' | 'studio' | 'lab', UserTierLimits> = {
  free: {
    maxQualityTier: ImageQuality.DRAFT,
    dailyLimit: 50,
    queuePriority: 1,
    costDiscount: 0,
  },
  forge: {
    maxQualityTier: ImageQuality.PREVIEW,
    dailyLimit: 200,
    queuePriority: 5,
    costDiscount: 0.1,  // 10% discount
  },
  studio: {
    maxQualityTier: ImageQuality.FINAL,
    dailyLimit: 1000,
    queuePriority: 10,
    costDiscount: 0.2,  // 20% discount
  },
  lab: {
    maxQualityTier: ImageQuality.FINAL,
    dailyLimit: -1,     // Unlimited
    queuePriority: 20,
    costDiscount: 0.35, // 35% discount
  },
};

/**
 * Check if a user can access a specific quality tier
 */
export function canUserAccessTier(userTier: 'free' | 'forge' | 'studio' | 'lab', qualityTier: ImageQuality): boolean {
  const limits = USER_TIER_LIMITS[userTier];
  const tierOrder = [ImageQuality.DRAFT, ImageQuality.PREVIEW, ImageQuality.FINAL];
  const userTierIndex = tierOrder.indexOf(limits.maxQualityTier);
  const requestedTierIndex = tierOrder.indexOf(qualityTier);
  return requestedTierIndex <= userTierIndex;
}
