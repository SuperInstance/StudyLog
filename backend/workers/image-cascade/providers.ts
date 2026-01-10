/**
 * Image Cascade - Provider Implementations
 *
 * This module implements image generation providers for cascade routing.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * PROVIDER ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Each provider implements a common interface for:
 * 1. Generating images from prompts
 * 2. Handling quality/speed tradeoffs
 * 3. Cost tracking
 * 4. Error handling and retries
 * 5. Response normalization
 *
 * The router selects the appropriate provider based on:
 * - User's requested quality tier
 * - User's subscription tier
 * - Current provider availability
 * - Rate limits and quotas
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import type {
  ImageQuality,
  ImageResolution,
  QualityTierConfig,
} from './quality-tiers.js';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

/**
 * Image generation request
 */
export interface ImageGenerationRequest {
  /** The text prompt for image generation */
  prompt: string;

  /** Negative prompt (what to avoid) - provider support varies */
  negativePrompt?: string;

  /** Quality tier for generation */
  tier: ImageQuality;

  /** Output resolution */
  resolution?: ImageResolution;

  /** Number of images to generate */
  count?: number;

  /** Seed for reproducible results */
  seed?: number;

  /** User's subscription tier (for limits) */
  userTier?: 'free' | 'forge' | 'studio' | 'lab';

  /** Override provider selection */
  providerOverride?: string;

  /** Agent ID that generated this prompt (for tracking) */
  agentId?: string;

  /** Parent generation ID (for refinement workflows) */
  parentId?: string;
}

/**
 * Generated image result
 */
export interface GeneratedImage {
  /** URL to the generated image */
  url: string;

  /** Base64 encoded image (if returned directly) */
  base64?: string;

  /** Width in pixels */
  width: number;

  /** Height in pixels */
  height: number;

  /** Seed used for generation (if available) */
  seed?: number;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  /** Unique ID for this generation */
  id: string;

  /** Generated images */
  images: GeneratedImage[];

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

  /** Whether the result was cached */
  cached: boolean;

  /** Revised prompt (if provider modified it) */
  revisedPrompt?: string;

  /** Safety filter flags */
  safetyFlags?: string[];
}

/**
 * Prompt refinement result from agent
 */
export interface AgentPromptRefinement {
  /** Original user prompt */
  original: string;

  /** Refined/optimized prompt */
  refined: string;

  /** Agent that performed refinement */
  agent: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Suggested quality tier */
  suggestedTier: ImageQuality;

  /** Estimated quality improvement */
  expectedImprovement?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Provider Base Interface
// ═══════════════════════════════════════════════════════════════════════

/**
 * Base interface for image generation providers
 *
 * All providers implement this interface for consistent routing
 * and cost tracking across the cascade system.
 */
export interface ImageProvider {
  /** Provider identifier */
  readonly name: string;

  /** Whether this provider is currently available */
  isAvailable(): Promise<boolean>;

  /**
   * Generate images from a prompt
   *
   * @param request - Image generation request
   * @returns Promise resolving to generation response
   */
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  /**
   * Estimate cost for a generation request
   *
   * @param request - Request to estimate
   * @returns Estimated cost in USD
   */
  estimateCost(request: ImageGenerationRequest): number;

  /**
   * Check if provider supports a specific resolution
   */
  supportsResolution(resolution: ImageResolution): boolean;

  /**
   * Get maximum concurrent generations for this provider
   */
  maxConcurrent(): number;
}

// ═══════════════════════════════════════════════════════════════════════
// Cloudflare Workers AI Provider
// ═══════════════════════════════════════════════════════════════════════

/**
 * Cloudflare Workers AI Provider Configuration
 *
 * Uses Cloudflare's built-in AI binding for fast, low-cost image generation.
 * Ideal for draft quality rapid prototyping.
 *
 * Models available:
 * - @cf/stabilityai/stable-diffusion-xl-base-1.0: SDXL base model
 *
 * Advantages:
 * - Included in Workers free tier (up to 10k images/day)
 * - Fast inference (2-5 seconds)
 * - No API key needed
 * - Low latency (runs on edge)
 *
 * Limitations:
 * - Fixed resolution support
 * - No negative prompts
 * - Lower quality than premium models
 */
export class CloudflareImageProvider implements ImageProvider {
  readonly name = 'cloudflare';

  constructor(
    private ai: Ai,  // Cloudflare AI binding
    private r2: R2Bucket,  // For storing generated images
    private cache?: KVNamespace  // Optional cache for repeated prompts
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      // Cloudflare AI is always available if binding exists
      return this.ai !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Generate images using Cloudflare Workers AI
   *
   * Uses the Stable Diffusion XL model running on Cloudflare's edge network.
   * Images are stored in R2 and served via CDN.
   */
  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const id = this.generateId();

    // Cloudflare SDXL only supports specific resolutions
    // Map requested resolution to supported size
    const cfSize = this.mapToCFResolution(request.resolution || '512x512');

    try {
      // Call Workers AI text-to-image
      const result = await this.ai.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
        prompt: request.prompt,
        // CF doesn't support negative prompts in the basic model
        num_steps: 20,  // Fixed steps for speed
        guidance_scale: 7.5,
      });

      // Convert result to blob and store in R2
      const imageBlob = new Blob([result], { type: 'image/png' });
      const imagePath = `images/draft/${id}.png`;
      await this.r2.put(imagePath, imageBlob, {
        httpMetadata: {
          contentType: 'image/png',
        },
      });

      // Create signed URL or use public URL
      const imageUrl = `/api/v1/assets/image/${imagePath}`;

      const latency = Date.now() - startTime;

      return {
        id,
        images: [{
          url: imageUrl,
          base64: result.toString(),  // Return base64 for immediate use
          width: parseInt(cfSize.split('x')[0]),
          height: parseInt(cfSize.split('x')[1]),
        }],
        tier: request.tier,
        provider: this.name,
        model: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        cost: this.estimateCost(request),
        latencyMs: latency,
        cached: false,
      };
    } catch (error) {
      throw new Error(`Cloudflare image generation failed: ${error}`);
    }
  }

  estimateCost(_request: ImageGenerationRequest): number {
    // Cloudflare Workers AI is included in the Workers plan
    // First 10,000 images/day are free for paid plans
    return 0.0;
  }

  supportsResolution(resolution: ImageResolution): boolean {
    // CF SDXL supports square resolutions best
    const supported: ImageResolution[] = ['256x256', '512x512', '768x768', '1024x1024'];
    return supported.includes(resolution);
  }

  maxConcurrent(): number {
    // Edge allows high concurrency
    return 10;
  }

  private mapToCFResolution(resolution: ImageResolution): string {
    // CF SDXL works best with square resolutions
    if (resolution.includes('x')) {
      const [width] = resolution.split('x').map(Number);
      if (width <= 256) return '256x256';
      if (width <= 512) return '512x512';
      if (width <= 768) return '768x768';
      return '1024x1024';
    }
    return '512x512';
  }

  private generateId(): string {
    return nanoid();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Z.ai (Zhipu) Provider
// ═══════════════════════════════════════════════════════════════════════

/**
 * Z.ai (Zhipu AI) Image Generation Provider
 *
 * Uses Zhipu's CogView model for high-quality image generation.
 * Offers excellent quality at competitive pricing.
 *
 * Models:
 * - cogview-3: Current production model
 * - cogview-4: Beta (when available)
 *
 * Advantages:
 * - Good quality output
 * - Cost-effective ($0.004 per image)
 * - Supports Chinese prompts well
 * - API stability
 *
 * API: https://open.bigmodel.cn/dev/api#cogview
 */
export class ZhipuImageProvider implements ImageProvider {
  readonly name = 'zhipu';

  constructor(
    private apiKey: string,
    private r2: R2Bucket,
    private baseUrl: string = 'https://open.bigmodel.cn/api/paas/v4/images/generations'
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const id = this.generateId();

    // Zhipu API request body
    const body = {
      model: 'cogview-3',
      prompt: request.prompt,
      size: request.resolution || '1024x1024',
      n: Math.min(request.count || 1, 4),  // Max 4 images
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Zhipu API error: ${error}`);
      }

      const data = await response.json();

      // Store images in R2
      const images: GeneratedImage[] = [];
      for (const item of data.data || []) {
        // Download image from URL and store in R2
        const imageResponse = await fetch(item.url);
        const imageBlob = await imageResponse.blob();
        const imagePath = `images/preview/${id}_${images.length}.png`;
        await this.r2.put(imagePath, imageBlob);

        images.push({
          url: `/api/v1/assets/image/${imagePath}`,
          width: parseInt((request.resolution || '1024x1024').split('x')[0]),
          height: parseInt((request.resolution || '1024x1024').split('x')[1]),
        });
      }

      const latency = Date.now() - startTime;

      return {
        id,
        images,
        tier: request.tier,
        provider: this.name,
        model: 'cogview-3',
        cost: this.estimateCost(request),
        latencyMs: latency,
        cached: false,
        revisedPrompt: data.revised_prompt,
      };
    } catch (error) {
      throw new Error(`Zhipu image generation failed: ${error}`);
    }
  }

  estimateCost(request: ImageGenerationRequest): number {
    // CogView-3 pricing: ~$0.004 per image
    const count = Math.min(request.count || 1, 4);
    return 0.004 * count;
  }

  supportsResolution(resolution: ImageResolution): boolean {
    const supported: ImageResolution[] = ['256x256', '512x512', '768x768', '1024x1024'];
    return supported.includes(resolution);
  }

  maxConcurrent(): number {
    return 5;
  }

  private generateId(): string {
    return nanoid();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Replicate Provider
// ═══════════════════════════════════════════════════════════════════════

/**
 * Replicate Image Generation Provider
 *
 * Uses Replicate's API for flexible model access including:
 * - Stability AI SDXL
 * - Stable Diffusion 3
 * - Other open-source image models
 *
 * Advantages:
 * - Access to latest open-source models
 * - Pay-per-use pricing
 * - Flexible model selection
 *
 * API: https://replicate.com/docs/reference/http
 */
export class ReplicateImageProvider implements ImageProvider {
  readonly name = 'replicate';

  constructor(
    private apiKey: string,
    private r2: R2Bucket,
    private baseUrl: string = 'https://api.replicate.com/v1/predictions'
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.replicate.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const id = this.generateId();

    // Create prediction
    const createResponse = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
        input: {
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          width: parseInt((request.resolution || '1024x1024').split('x')[0]),
          height: parseInt((request.resolution || '1024x1024').split('x')[1]),
          num_outputs: Math.min(request.count || 1, 4),
        },
      }),
    });

    if (!createResponse.ok) {
      throw new Error('Failed to create Replicate prediction');
    }

    const prediction = await createResponse.json();

    // Poll for result
    let result = prediction;
    let attempts = 0;
    const maxAttempts = 60;  // 5 minutes timeout

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));  // Wait 5 seconds

      const pollResponse = await fetch(`${this.baseUrl}/${prediction.id}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      result = await pollResponse.json();
      attempts++;
    }

    if (result.status !== 'succeeded') {
      throw new Error(`Replicate prediction failed: ${result.error}`);
    }

    // Store images in R2
    const images: GeneratedImage[] = [];
    const output = result.output;
    const urls = Array.isArray(output) ? output : [output];

    for (let i = 0; i < urls.length; i++) {
      const imageResponse = await fetch(urls[i]);
      const imageBlob = await imageResponse.blob();
      const imagePath = `images/replicate/${id}_${i}.png`;
      await this.r2.put(imagePath, imageBlob);

      images.push({
        url: `/api/v1/assets/image/${imagePath}`,
        width: parseInt((request.resolution || '1024x1024').split('x')[0]),
        height: parseInt((request.resolution || '1024x1024').split('x')[1]),
      });
    }

    const latency = Date.now() - startTime;

    return {
      id,
      images,
      tier: request.tier,
      provider: this.name,
      model: 'sdxl',
      cost: this.estimateCost(request),
      latencyMs: latency,
      cached: false,
    };
  }

  estimateCost(request: ImageGenerationRequest): number {
    // SDXL on Replicate: ~$0.003 per image
    const count = Math.min(request.count || 1, 4);
    return 0.003 * count;
  }

  supportsResolution(_resolution: ImageResolution): boolean {
    // Replicate models generally support custom resolutions
    return true;
  }

  maxConcurrent(): number {
    return 3;
  }

  private generateId(): string {
    return nanoid();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// OpenAI DALL-E Provider
// ═══════════════════════════════════════════════════════════════════════

/**
 * OpenAI DALL-E 3 Provider
 *
 * Uses OpenAI's DALL-E 3 model for highest quality image generation.
 * Best for final production assets.
 *
 * Advantages:
 * - Best prompt adherence
 * - Excellent quality and coherence
 * - Native prompt refinement
 *
 * Limitations:
 * - Higher cost ($0.04 per image)
 * - Only supports n=1
 * - Fixed 1024x1024 resolution
 *
 * API: https://platform.openai.com/docs/api-reference/images
 */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = 'openai';

  constructor(
    private apiKey: string,
    private r2: R2Bucket,
    private baseUrl: string = 'https://api.openai.com/v1/images/generations'
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const startTime = Date.now();
    const id = this.generateId();

    // DALL-E 3 only supports n=1
    const body = {
      model: 'dall-e-3',
      prompt: request.prompt,
      n: 1,  // DALL-E 3 only supports n=1
      size: '1024x1024',  // Only supported size
      quality: request.tier === 'final' ? 'hd' : 'standard',
      style: 'vivid',  // or 'natural'
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();

      // Store image in R2
      const imageUrl = data.data[0].url;
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();
      const imagePath = `images/final/${id}.png`;
      await this.r2.put(imagePath, imageBlob);

      const latency = Date.now() - startTime;

      return {
        id,
        images: [{
          url: `/api/v1/assets/image/${imagePath}`,
          width: 1024,
          height: 1024,
        }],
        tier: request.tier,
        provider: this.name,
        model: 'dall-e-3',
        cost: this.estimateCost(request),
        latencyMs: latency,
        cached: false,
        revisedPrompt: data.data[0].revised_prompt,
      };
    } catch (error) {
      throw new Error(`OpenAI image generation failed: ${error}`);
    }
  }

  estimateCost(_request: ImageGenerationRequest): number {
    // DALL-E 3: $0.04 per standard image, $0.08 for HD
    return 0.04;
  }

  supportsResolution(resolution: ImageResolution): boolean {
    // DALL-E 3 only supports 1024x1024
    return resolution === '1024x1024';
  }

  maxConcurrent(): number {
    return 1;  // OpenAI has strict rate limits
  }

  private generateId(): string {
    return nanoid();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simple ID generator (nano-id replacement for Cloudflare Workers)
 */
function nanoid(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Provider factory - create provider instance from configuration
 */
export interface ProviderConfig {
  name: string;
  apiKey?: string;
  r2: R2Bucket;
  ai?: Ai;
  cache?: KVNamespace;
}

export function createImageProvider(config: ProviderConfig): ImageProvider {
  switch (config.name) {
    case 'cloudflare':
      if (!config.ai) {
        throw new Error('Cloudflare provider requires AI binding');
      }
      return new CloudflareImageProvider(config.ai, config.r2, config.cache);

    case 'zhipu':
      if (!config.apiKey) {
        throw new Error('Zhipu provider requires API key');
      }
      return new ZhipuImageProvider(config.apiKey, config.r2);

    case 'replicate':
      if (!config.apiKey) {
        throw new Error('Replicate provider requires API key');
      }
      return new ReplicateImageProvider(config.apiKey, config.r2);

    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI provider requires API key');
      }
      return new OpenAIImageProvider(config.apiKey, config.r2);

    default:
      throw new Error(`Unknown provider: ${config.name}`);
  }
}

/**
 * Get available providers based on environment configuration
 */
export function getAvailableProviders(env: {
  AI?: Ai;
  ASSET_STORAGE: R2Bucket;
  ZHIPU_API_KEY?: string;
  REPLICATE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  IMAGE_CACHE?: KVNamespace;
}): ImageProvider[] {
  const providers: ImageProvider[] = [];

  // Cloudflare is always available if AI binding exists
  if (env.AI) {
    providers.push(createImageProvider({
      name: 'cloudflare',
      ai: env.AI,
      r2: env.ASSET_STORAGE,
      cache: env.IMAGE_CACHE,
    }));
  }

  // Zhipu
  if (env.ZHIPU_API_KEY) {
    providers.push(createImageProvider({
      name: 'zhipu',
      apiKey: env.ZHIPU_API_KEY,
      r2: env.ASSET_STORAGE,
    }));
  }

  // Replicate
  if (env.REPLICATE_API_KEY) {
    providers.push(createImageProvider({
      name: 'replicate',
      apiKey: env.REPLICATE_API_KEY,
      r2: env.ASSET_STORAGE,
    }));
  }

  // OpenAI
  if (env.OPENAI_API_KEY) {
    providers.push(createImageProvider({
      name: 'openai',
      apiKey: env.OPENAI_API_KEY,
      r2: env.ASSET_STORAGE,
    }));
  }

  return providers;
}
