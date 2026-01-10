/**
 * Zhipu AI (Z.ai) Provider Implementation
 *
 * Supports:
 * - GLM-4.7: Latest flagship model optimized for coding
 * - GLM-4.5: General purpose
 * - GLM-4-Plus: High-quality reasoning
 * - GLM-4-Flash: Fast, cheap fallback
 * - GLM-4-Long: 200K context for large files
 * - CogView-4: Image generation
 * - CogVideoX: Video generation
 *
 * API Documentation: https://open.bigmodel.cn/
 * Pricing: ~$0.08-$0.30 per 1M tokens
 *
 * ============================================================================
 * JWT Authentication for Zhipu AI
 * ============================================================================
 *
 * Zhipu AI uses JWT (JSON Web Tokens) for API authentication instead of
 * traditional Bearer tokens. This is a key difference from other providers.
 *
 * API Key Format: {id}.{secret}
 * - Example: "1234.abcdef1234567890"
 * - The ID identifies your account
 * - The secret is used to sign the JWT
 *
 * JWT Generation Process:
 * 1. Parse the API key to extract ID and secret
 * 2. Create a JWT payload with:
 *    - api_key: The ID from your API key
 *    - exp: Expiration timestamp (default: 1 hour)
 *    - timestamp: Current Unix timestamp
 * 3. Sign the JWT using HS256 algorithm with the secret
 * 4. Include the signed JWT in the Authorization header
 *
 * Why JWT?
 * - Security: The secret never leaves your server (only the signed token)
 * - Time-limited: Tokens expire, reducing exposure if leaked
 * - Stateless: Server validates signature without database lookup
 *
 * ============================================================================
 * Model Selection Strategy
 * ============================================================================
 *
 * GLM-4.7 (Default): Best for coding tasks, optimized for agentic workflows
 * GLM-4-Flash: Fastest response, lowest cost (good for simple queries)
 * GLM-4-Plus: Higher quality reasoning (more expensive)
 * GLM-4-Long: Extended context window (128K -> 200K tokens)
 *
 * Cost Optimization:
 * - Use GLM-4-Flash for classification, simple Q&A
 * - Use GLM-4.7 for code generation, complex reasoning
 * - Use GLM-4-Long only when you need the extra context
 *
 * ============================================================================
 * Cost Tracking
 * ============================================================================
 *
 * Zhipu AI Pricing (per 1M tokens):
 * - GLM-4.7: $0.08 input, $0.30 output
 * - GLM-4-Flash: $0.01 input, $0.01 output
 * - GLM-4-Plus: $0.50 input, $0.50 output
 * - GLM-4-Long: $0.08 input, $0.30 output
 * - CogView-4: ~$0.015 per image
 *
 * The provider tracks exact costs from API responses and reports them
 * in the standardized ChatResponse format.
 */

import type {
  AIProvider,
  ProviderConfig,
  ProviderCapabilities,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  ImageRequest,
  ImageResponse,
  VideoRequest,
  VideoResponse,
  CostRequest,
  CostEstimate,
  ProviderHealth,
  ProviderStatus,
} from './base';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Zhipu AI provider configuration
 *
 * Extends the base ProviderConfig with Zhipu-specific settings.
 */
export interface ZhipuConfig extends Omit<ProviderConfig, 'name' | 'apiFormat'> {
  name: 'zhipu';
  apiFormat: 'openai';
  /** JWT token expiration time in seconds (default: 3600 = 1 hour) */
  tokenExpiresIn?: number;
}

/**
 * JWT payload for Zhipu AI authentication
 *
 * The payload structure required by Zhipu AI's JWT validation.
 * Note: The field name is 'api_key' not 'key' - this is Zhipu's convention.
 */
interface ZhipuJWTPayload {
  /** API key ID (the part before the dot in your API key) */
  api_key: string;
  /** Expiration timestamp in seconds since Unix epoch */
  exp: number;
  /** Issue timestamp in seconds since Unix epoch */
  timestamp: number;
}

/**
 * Zhipu API key structure
 *
 * Zhipu API keys are formatted as "{id}.{secret}"
 * We parse this to extract both components for JWT generation.
 */
interface ParsedApiKey {
  /** The ID portion (before the dot) */
  id: string;
  /** The secret portion (after the dot) */
  secret: string;
}

// ============================================================================
// Constants and Configuration
// ============================================================================

/**
 * Available Zhipu models with metadata
 *
 * Each model entry includes:
 * - id: The model identifier used in API calls
 * - name: Human-readable display name
 * - type: Provider type (llm, image, video)
 * - context: Maximum context window in tokens
 * - isDefault: Whether this is the default model for its type
 * - features: Array of notable capabilities
 */
const ZHIPU_MODELS: ModelInfo[] = [
  // LLM Models - Chat and Reasoning
  {
    id: 'glm-4.7',
    name: 'GLM-4.7',
    type: 'llm',
    context: 128000,
    isDefault: true,
    features: ['coding-specialist', 'agentic', 'function-calling', 'vision'],
  },
  {
    id: 'glm-4.5',
    name: 'GLM-4.5',
    type: 'llm',
    context: 128000,
    features: ['general-purpose', 'open-weights', 'cost-effective'],
  },
  {
    id: 'glm-4-plus',
    name: 'GLM-4-Plus',
    type: 'llm',
    context: 128000,
    features: ['high-quality', 'reasoning', 'complex-tasks'],
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    type: 'llm',
    context: 128000,
    features: ['fast', 'low-cost', 'simple-tasks'],
  },
  {
    id: 'glm-4-long',
    name: 'GLM-4-Long',
    type: 'llm',
    context: 200000,
    features: ['long-context', 'analysis', 'document-processing'],
  },
  // Image Models - Text to Image
  {
    id: 'cogview-4',
    name: 'CogView-4',
    type: 'image',
    context: 0,
    isDefault: true,
    features: ['text-to-image', 'high-quality', '1024x1024'],
  },
  {
    id: 'cogview-3-plus',
    name: 'CogView-3-Plus',
    type: 'image',
    context: 0,
    features: ['text-to-image', 'balanced-quality'],
  },
  // Video Models - Text to Video
  {
    id: 'cogvideox',
    name: 'CogVideoX',
    type: 'video',
    context: 0,
    isDefault: true,
    features: ['text-to-video', '6-seconds', 'hd-quality'],
  },
];

/**
 * Default provider capabilities for Zhipu AI
 *
 * Defines what the provider can do. Used by the router to determine
 * if a provider can handle specific request types.
 */
const ZHIPU_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  functionCalling: true,
  vision: true,
  maxContext: 200000, // GLM-4-Long supports 200K tokens
  imageGeneration: true,
  audioGeneration: false,
  videoGeneration: true,
  jsonMode: true,
  systemPrompt: true,
};

/**
 * Cost per million tokens (average pricing in USD)
 *
 * These are approximate costs used for estimation before making API calls.
 * Actual costs are calculated from API response usage data.
 *
 * Model-specific pricing:
 * - GLM-4-Flash: $0.01 input, $0.01 output (cheapest)
 * - GLM-4.7 / GLM-4-Long: $0.08 input, $0.30 output (balanced)
 * - GLM-4-Plus: $0.50 input, $0.50 output (premium)
 * - CogView-4: ~$0.015 per image
 * - CogVideoX: ~$0.10 per second of video
 */
const ZHIPU_COST_PER_MILLION = {
  input: 0.08,   // Average input cost per 1M tokens
  output: 0.30,  // Average output cost per 1M tokens
  image: 0.015,  // Cost per image generation
  video: 0.10,   // Cost per second of video
};

/**
 * Default JWT expiration time
 *
 * 1 hour = 3600 seconds. This is the recommended balance between:
 * - Security (shorter is better)
 * - Performance (longer reduces JWT generation overhead)
 */
const DEFAULT_TOKEN_EXPIRATION = 3600;

// ============================================================================
// Zhipu AI Provider Implementation
// ============================================================================

/**
 * Zhipu AI Provider
 *
 * Implements the AIProvider interface for Zhipu AI's API.
 *
 * Key features:
 * - JWT-based authentication (unique to Zhipu)
 * - Support for LLM, image, and video generation
 * - Model-specific cost tracking
 * - Automatic token refresh
 *
 * @example
 * ```ts
 * const provider = new ZhipuProvider({
 *   apiKey: '1234.abcdef1234567890',
 *   tokenExpiresIn: 3600
 * });
 * await provider.initialize();
 * const response = await provider.chat({
 *   model: 'glm-4.7',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 */
export class ZhipuProvider implements AIProvider {
  readonly config: ZhipuConfig;

  /**
   * Cached JWT token to avoid regenerating for every request
   * @internal
   */
  private cachedToken: string | null = null;

  /**
   * Token expiration timestamp
   * @internal
   */
  private tokenExpiresAt: number = 0;

  /**
   * Parsed API key components
   * @internal
   */
  private parsedApiKey: ParsedApiKey | null = null;

  constructor(config: Partial<ZhipuConfig> & { apiKey: string }) {
    // Parse and validate API key format
    this.parsedApiKey = this.parseApiKey(config.apiKey);

    this.config = {
      name: 'zhipu',
      type: 'llm',
      baseUrl: config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: config.apiKey,
      models: ZHIPU_MODELS,
      costPerMillion: config.costPerMillion || 0.15, // Weighted average
      capabilities: ZHIPU_CAPABILITIES,
      apiFormat: 'openai',
      region: 'cn',
      tokenExpiresIn: config.tokenExpiresIn || DEFAULT_TOKEN_EXPIRATION,
    };
  }

  // ========================================================================
  // Initialization and Health Checks
  // ========================================================================

  /**
   * Initialize the provider
   *
   * Validates API key format and tests connectivity with a minimal request.
   * Throws an error if the provider cannot be used.
   */
  async initialize(): Promise<void> {
    if (!this.parsedApiKey) {
      throw new Error('Invalid Zhipu API key: Could not parse ID and secret');
    }

    // Test connection with a health check
    const health = await this.getHealth();
    if (health.status !== 'available') {
      throw new Error(`Zhipu provider not available: ${health.error || 'Unknown error'}`);
    }
  }

  /**
   * Check if the provider is available
   *
   * Performs a lightweight health check without making actual API calls.
   * Returns true if the provider can be used.
   */
  async isAvailable(): Promise<boolean> {
    const health = await this.getHealth();
    return health.status === 'available';
  }

  /**
   * Get the provider's health status
   *
   * Attempts to contact the provider's API and returns detailed status.
   * Used by the router to determine if a provider should be tried.
   *
   * @returns ProviderHealth with status, latency, and error details
   */
  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      // Zhipu doesn't have a dedicated health check endpoint,
      // so we try to list models as a connectivity test
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          name: this.config.name,
          status: 'available',
          latencyMs: latency,
          lastCheck: Date.now(),
        };
      }

      if (response.status === 401) {
        return {
          name: this.config.name,
          status: 'unconfigured',
          latencyMs: latency,
          lastCheck: Date.now(),
          error: 'Invalid API key or authentication failed',
        };
      }

      if (response.status === 429) {
        return {
          name: this.config.name,
          status: 'rate_limited',
          latencyMs: latency,
          lastCheck: Date.now(),
          error: 'Rate limit exceeded',
        };
      }

      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        name: this.config.name,
        status: 'error',
        latencyMs: latency,
        lastCheck: Date.now(),
        error: `HTTP ${response.status}: ${errorText}`,
      };
    } catch (error) {
      return {
        name: this.config.name,
        status: 'error',
        latencyMs: Date.now() - startTime,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // ========================================================================
  // Chat Completions
  // ========================================================================

  /**
   * Generate a chat completion
   *
   * Sends a chat completion request to Zhipu's API using the specified model.
   * Supports GLM-4.7, GLM-4.5, GLM-4-Plus, GLM-4-Flash, and GLM-4-Long.
   *
   * ### Model Selection
   * - glm-4.7: Best for coding and agent workflows (default)
   * - glm-4-flash: Fastest, cheapest (good for simple queries)
   * - glm-4-plus: Highest quality reasoning
   * - glm-4-long: Extended context for large documents
   *
   * ### Cost Optimization
   * The function tracks exact token usage from the API response and calculates
   * actual cost. Input and output tokens are priced differently.
   *
   * @param request - Chat completion request with model, messages, and options
   * @returns Promise resolving to standardized ChatResponse
   *
   * @example
   * ```ts
   * const response = await provider.chat({
   *   model: 'glm-4.7',
   *   messages: [
   *     { role: 'system', content: 'You are a helpful coding assistant.' },
   *     { role: 'user', content: 'Write a function to sort an array.' }
   *   ],
   *   temperature: 0.7,
   *   maxTokens: 1024
   * });
   * console.log(response.content); // Generated response
   * console.log(response.cost);    // Actual cost in USD
   * ```
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: this.transformMessages(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        top_p: request.topP,
        stream: false, // Streaming not yet implemented
        tools: request.tools ? this.transformTools(request.tools) : undefined,
        tool_choice: request.toolChoice,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zhipu chat error (${response.status}): ${error}`);
    }

    const data = await response.json() as ZhipuChatResponse;
    const choice = data.choices[0];

    if (!choice) {
      throw new Error('Zhipu returned empty choices array');
    }

    // Extract token usage from response
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;

    // Calculate actual cost based on model-specific pricing
    const cost = this.calculateChatCost(inputTokens, outputTokens, request.model);

    // Extract tool calls if present
    const toolCalls = choice.message?.tool_calls?.map(tc => ({
      id: tc.id,
      type: tc.type as 'function',
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content: choice.message?.content || '',
      model: data.model,
      provider: this.config.name,
      cost,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
      finishReason: choice.finish_reason,
      cached: false,
      toolCalls,
    };
  }

  // ========================================================================
  // Image Generation
  // ========================================================================

  /**
   * Generate images from text prompts
   *
   * Uses CogView-4 or CogView-3-Plus to generate images from text descriptions.
   * Supports various sizes up to 1024x1024.
   *
   * ### Cost Optimization
   * CogView-4 costs approximately $0.015 per image. This is significantly
   * cheaper than DALL-E 3 (~$0.04-$0.12 per image) while maintaining quality.
   *
   * ### Supported Sizes
   * - 1024x1024: Default, best quality
   * - 768x768: Balanced quality and speed
   * - 512x512: Fastest generation
   *
   * @param request - Image generation request with prompt and options
   * @returns Promise resolving to ImageResponse with generated image URLs
   *
   * @example
   * ```ts
   * const response = await provider.generateImage({
   *   prompt: 'A futuristic city at sunset',
   *   model: 'cogview-4',
   *   size: '1024x1024',
   *   n: 1
   * });
   * console.log(response.images[0].url); // Image URL
   * ```
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    const response = await fetch(`${this.config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'cogview-4',
        prompt: request.prompt,
        size: request.size || '1024x1024',
        n: request.n || 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zhipu image generation error (${response.status}): ${error}`);
    }

    const data = await response.json() as ZhipuImageResponse;

    return {
      images: data.data.map((img) => ({
        url: img.url,
        revisedPrompt: img.revised_prompt,
      })),
      model: request.model || 'cogview-4',
      provider: this.config.name,
      cost: ZHIPU_COST_PER_MILLION.image * (request.n || 1),
    };
  }

  // ========================================================================
  // Video Generation
  // ========================================================================

  /**
   * Generate videos from text prompts
   *
   * Uses CogVideoX to generate short video clips from text descriptions.
   * Videos are typically 6 seconds long at HD quality.
   *
   * ### Cost Considerations
   * Video generation is significantly more expensive than images (~$0.10/second).
   * A 6-second video costs approximately $0.60.
   *
   * ### Supported Formats
   * - Aspect Ratio: 16:9 (landscape), 9:16 (portrait), 1:1 (square)
   * - Duration: Typically 6 seconds (model-dependent)
   * - Quality: HD (720p or higher)
   *
   * @param request - Video generation request with prompt and options
   * @returns Promise resolving to VideoResponse with video URL
   *
   * @example
   * ```ts
   * const response = await provider.generateVideo({
   *   prompt: 'A peaceful forest with sunlight filtering through trees',
   *   model: 'cogvideox',
   *   aspectRatio: '16:9',
   *   duration: 6
   * });
   * console.log(response.videoUrl); // Video URL
   * console.log(response.duration);  // 6
   * console.log(response.cost);      // ~0.60
   * ```
   */
  async generateVideo(request: VideoRequest): Promise<VideoResponse> {
    const response = await fetch(`${this.config.baseUrl}/videos/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${await this.getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'cogvideox',
        prompt: request.prompt,
        duration: request.duration || 6,
        aspect_ratio: request.aspectRatio || '16:9',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zhipu video generation error (${response.status}): ${error}`);
    }

    const data = await response.json() as ZhipuVideoResponse;

    return {
      videoUrl: data.url,
      model: request.model || 'cogvideox',
      provider: this.config.name,
      cost: ZHIPU_COST_PER_MILLION.video * (data.duration || request.duration || 6),
      duration: data.duration || request.duration || 6,
    };
  }

  // ========================================================================
  // Cost Estimation
  // ========================================================================

  /**
   * Estimate the cost of a request before making it
   *
   * Uses model-specific pricing to estimate costs based on expected token usage.
   * Useful for showing cost estimates to users before generation.
   *
   * ### Pricing Model
   * Different models have different pricing:
   * - GLM-4-Flash: $0.01/$0.01 per 1M tokens (cheapest)
   * - GLM-4.7/GLM-4-Long: $0.08/$0.30 per 1M tokens (balanced)
   * - GLM-4-Plus: $0.50/$0.50 per 1M tokens (premium)
   *
   * @param request - Cost estimation request with model and token counts
   * @returns Promise resolving to CostEstimate with breakdown
   *
   * @example
   * ```ts
   * const estimate = await provider.estimateCost({
   *   provider: 'zhipu',
   *   model: 'glm-4.7',
   *   inputTokens: 1000,
   *   outputTokens: 500,
   *   requestType: 'chat'
   * });
   * console.log(estimate.estimatedCost); // ~0.00022
   * ```
   */
  async estimateCost(request: CostRequest): Promise<CostEstimate> {
    let inputCost = 0;
    let outputCost = 0;
    let additional = 0;

    if (request.requestType === 'chat') {
      // Use model-specific pricing if available
      const modelPricing = this.getModelPricing(request.model);
      inputCost = (request.inputTokens / 1_000_000) * modelPricing.input;
      outputCost = (request.outputTokens / 1_000_000) * modelPricing.output;
    } else if (request.requestType === 'image') {
      additional = ZHIPU_COST_PER_MILLION.image;
    } else if (request.requestType === 'video') {
      // Video cost is per second
      const duration = (request as any).duration || 6;
      additional = ZHIPU_COST_PER_MILLION.video * duration;
    }

    return {
      estimatedCost: inputCost + outputCost + additional,
      currency: 'USD',
      breakdown: {
        input: inputCost,
        output: outputCost,
        additional: additional > 0 ? additional : undefined,
      },
      provider: this.config.name,
      model: request.model,
    };
  }

  // ========================================================================
  // Provider Information
  // ========================================================================

  /**
   * List all available models for this provider
   *
   * Returns the configured model list with metadata including
   * context window size, capabilities, and whether it's the default.
   */
  listModels(): ModelInfo[] {
    return this.config.models;
  }

  /**
   * Get the provider's capabilities
   *
   * Returns what the provider can do: streaming, function calling,
   * vision support, max context, etc.
   */
  getCapabilities(): ProviderCapabilities {
    return this.config.capabilities;
  }

  /**
   * Clean up resources
   *
   * Clears cached tokens. Called when the provider is no longer needed.
   */
  dispose(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Parse Zhipu API key into ID and secret components
   *
   * Zhipu API keys are formatted as "{id}.{secret}"
   * This function validates the format and extracts both parts.
   *
   * @param apiKey - The API key string
   * @returns Parsed API key with id and secret
   * @throws Error if the key format is invalid
   *
   * @example
   * ```ts
   * const parsed = parseApiKey('1234.abcdef1234567890');
   * // Returns: { id: '1234', secret: 'abcdef1234567890' }
   * ```
   */
  private parseApiKey(apiKey: string): ParsedApiKey {
    const parts = apiKey.split('.');
    if (parts.length !== 2) {
      throw new Error(
        'Invalid Zhipu API key format. Expected format: {id}.{secret} ' +
        '(e.g., "1234.abcdef1234567890")'
      );
    }
    const [id, secret] = parts;
    if (!id || !secret || id.length < 1 || secret.length < 10) {
      throw new Error(
        'Invalid Zhipu API key: ID and secret must both be non-empty, ' +
        'and secret must be at least 10 characters'
      );
    }
    return { id, secret };
  }

  /**
   * Generate a JWT authentication token for Zhipu API
   *
   * This is the core authentication method for Zhipu AI. Unlike other providers
   * that use simple Bearer tokens, Zhipu requires a JWT signed with your API secret.
   *
   * ### JWT Generation Algorithm (HS256)
   * 1. Create header: { alg: "HS256", sign_type: "SIGN" }
   * 2. Create payload: { api_key: id, exp: timestamp, timestamp: now }
   * 3. Encode header and payload to Base64URL
   * 4. Create signature: HMAC-SHA256(secret, header.payload)
   * 5. Combine: header.payload.signature
   *
   * ### Token Caching
   * Generated tokens are cached until they expire (default: 1 hour).
   * This avoids the overhead of JWT generation for every request.
   *
   * @returns Signed JWT token for API authentication
   *
   * @example
   * ```ts
   * const token = await getAuthToken();
   * // Returns: "eyJhbGciOiJIUzI1NiIsInNpZ25fdHlwZSI6IlNJR04ifQ..."
   * ```
   */
  private async getAuthToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    // Return cached token if still valid (with 5 minute buffer)
    if (this.cachedToken && this.tokenExpiresAt > now + 300) {
      return this.cachedToken;
    }

    if (!this.parsedApiKey) {
      throw new Error('API key not parsed. Call initialize() first.');
    }

    const { id, secret } = this.parsedApiKey;
    const expiresAt = now + (this.config.tokenExpiresIn || DEFAULT_TOKEN_EXPIRATION);

    // JWT Header
    const header = {
      alg: 'HS256',
      sign_type: 'SIGN',
    };

    // JWT Payload
    const payload: ZhipuJWTPayload = {
      api_key: id,
      exp: expiresAt,
      timestamp: now,
    };

    // Encode to Base64URL
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));

    // Create signature: HMAC-SHA256(secret, header.payload)
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = await this.signHMACSHA256(secret, data);
    const encodedSignature = this.base64UrlEncode(signature);

    // Combine: header.payload.signature
    this.cachedToken = `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
    this.tokenExpiresAt = expiresAt;

    return this.cachedToken;
  }

  /**
   * Encode a string to Base64URL format
   *
   * Base64URL is a variant of Base64 that uses URL-safe characters
   * (replaces + with -, / with _, removes padding =).
   *
   * @param str - String to encode
   * @returns Base64URL encoded string
   */
  private base64UrlEncode(str: string): string {
    // Convert string to bytes
    const bytes = new TextEncoder().encode(str);
    // Convert to base64
    const base64 = btoa(String.fromCharCode(...bytes));
    // Convert to base64url
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Sign data using HMAC-SHA256
   *
   * Creates an HMAC signature using the Web Crypto API.
   * The secret key is used to sign the data, producing a signature
   * that can be verified by the server.
   *
   * @param secret - Secret key for signing
   * @param data - Data to sign
   * @returns Signature as a base64 string
   */
  private async signHMACSHA256(secret: string, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const dataBytes = encoder.encode(data);

    // Import the secret key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the data
    const signature = await crypto.subtle.sign('HMAC', key, dataBytes);

    // Convert to base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  /**
   * Transform messages to Zhipu format
   *
   * Zhipu uses the same format as OpenAI for messages, but we should
   * handle any edge cases like multimodal content with images.
   *
   * @param messages - Original messages array
   * @returns Transformed messages for Zhipu API
   */
  private transformMessages(messages: ChatRequest['messages']): Array<Record<string, unknown>> {
    return messages.map((msg) => {
      // Handle string content
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content,
        };
      }

      // Handle array content (multimodal)
      if (Array.isArray(msg.content)) {
        return {
          role: msg.role,
          content: msg.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            }
            if (part.type === 'image' && part.imageUrl) {
              return { type: 'image_url', image_url: part.imageUrl };
            }
            return part;
          }),
        };
      }

      return { role: msg.role, content: msg.content };
    });
  }

  /**
   * Transform tools to Zhipu format
   *
   * Zhipu uses OpenAI-compatible tool format, but we ensure
   * proper serialization of function definitions.
   *
   * @param tools - Original tools array
   * @returns Transformed tools for Zhipu API
   */
  private transformTools(tools: ChatRequest['tools']): Array<Record<string, unknown>> | undefined {
    if (!tools) return undefined;

    return tools.map((tool) => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }

  /**
   * Get model-specific pricing
   *
   * Returns input/output pricing for a specific model.
   * Uses average pricing if model is not in the lookup table.
   *
   * @param model - Model identifier
   * @returns Object with input and output cost per 1M tokens
   */
  private getModelPricing(model: string): { input: number; output: number } {
    // Model-specific pricing (in USD per 1M tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'glm-4-flash': { input: 0.01, output: 0.01 },
      'glm-4.5': { input: 0.05, output: 0.05 },
      'glm-4.7': { input: 0.08, output: 0.30 },
      'glm-4-plus': { input: 0.50, output: 0.50 },
      'glm-4-long': { input: 0.08, output: 0.30 },
    };

    return pricing[model] || { input: ZHIPU_COST_PER_MILLION.input, output: ZHIPU_COST_PER_MILLION.output };
  }

  /**
   * Calculate actual chat cost based on token usage
   *
   * Uses model-specific pricing to calculate the actual cost of a request
   * based on the token usage returned by the API.
   *
   * @param inputTokens - Number of input tokens used
   * @param outputTokens - Number of output tokens generated
   * @param model - Model identifier for pricing lookup
   * @returns Cost in USD
   */
  private calculateChatCost(inputTokens: number, outputTokens: number, model: string): number {
    const pricing = this.getModelPricing(model);
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    );
  }
}

// ============================================================================
// Zhipu API Response Types
// ============================================================================

/**
 * Zhipu chat completion response format
 *
 * Follows OpenAI-compatible structure with usage data.
 */
interface ZhipuChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Zhipu image generation response format
 */
interface ZhipuImageResponse {
  created: number;
  data: Array<{
    url: string;
    revised_prompt?: string;
  }>;
}

/**
 * Zhipu video generation response format
 */
interface ZhipuVideoResponse {
  id: string;
  url: string;
  duration: number;
  status: string;
}

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Factory for creating Zhipu provider instances
 *
 * Implements the ProviderFactory interface for dynamic provider loading.
 */
export class ZhipuProviderFactory {
  /**
   * Create a new Zhipu provider instance
   *
   * @param config - Provider configuration
   * @returns Configured ZhipuProvider instance
   */
  create(config: ProviderConfig): AIProvider {
    return new ZhipuProvider({
      apiKey: config.apiKey || '',
      baseUrl: config.baseUrl,
      costPerMillion: config.costPerMillion,
      tokenExpiresIn: 3600,
    });
  }

  /**
   * Check if this factory supports the given API format
   *
   * Zhipu uses OpenAI-compatible format with JWT authentication.
   *
   * @param apiFormat - The API format to check
   * @returns true if the format is 'openai'
   */
  supports(apiFormat: string): boolean {
    return apiFormat === 'openai' || apiFormat === 'zhipu';
  }
}

// ============================================================================
// Export
// ============================================================================

export default ZhipuProvider;
