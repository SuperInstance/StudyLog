/**
 * Provider Abstraction Layer
 *
 * Base interfaces and types for AI provider integrations.
 * All providers implement these interfaces for consistent routing
 * and cost tracking across the multi-model router.
 */

/**
 * Supported provider types
 */
export type ProviderType = 'llm' | 'image' | 'audio' | 'video' | 'multimodal';

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports function/tool calling */
  functionCalling: boolean;
  /** Supports vision/image inputs */
  vision: boolean;
  /** Maximum context window in tokens */
  maxContext: number;
  /** Supports image generation */
  imageGeneration: boolean;
  /** Supports audio generation */
  audioGeneration: boolean;
  /** Supports video generation */
  videoGeneration: boolean;
  /** Supports JSON mode output */
  jsonMode: boolean;
  /** Supports system prompts */
  systemPrompt: boolean;
}

/**
 * Model information
 */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Model type */
  type: ProviderType;
  /** Context window size */
  context: number;
  /** Whether this is the default model for this provider */
  isDefault?: boolean;
  /** Special features or notes */
  features?: string[];
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  /** Maximum requests per window */
  requests: number;
  /** Window duration in seconds */
  window: number;
  /** Tokens per minute limit (if applicable) */
  tokensPerMinute?: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /** Unique provider identifier */
  name: string;
  /** Provider type */
  type: ProviderType;
  /** Base URL for API requests */
  baseUrl: string;
  /** API key (from environment) */
  apiKey?: string;
  /** Available models */
  models: ModelInfo[];
  /** Cost per million tokens (average) */
  costPerMillion: number;
  /** Optional rate limit */
  rateLimit?: RateLimit;
  /** Provider capabilities */
  capabilities: ProviderCapabilities;
  /** API format compatibility */
  apiFormat: 'openai' | 'anthropic' | 'google' | 'custom';
  /** Region for latency optimization */
  region?: string;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<ChatContentPart>;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

/**
 * Content part for multimodal messages
 */
export interface ChatContentPart {
  type: 'text' | 'image' | 'audio';
  text?: string;
  imageUrl?: { url: string };
  audioUrl?: { url: string };
}

/**
 * Tool/function call
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Chat generation request
 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  tools?: Tool[];
  toolChoice?: 'auto' | 'required' | { type: 'function'; name: string };
}

/**
 * Tool/function definition
 */
export interface Tool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Chat response format
 */
export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  finishReason: string;
  cached: boolean;
  toolCalls?: ToolCall[];
}

/**
 * Image generation request
 */
export interface ImageRequest {
  prompt: string;
  model?: string;
  size?: ImageSize;
  quality?: 'standard' | 'hd';
  n?: number;
  style?: 'vivid' | 'natural';
}

/**
 * Supported image sizes
 */
export type ImageSize = '256x256' | '512x512' | '768x768' | '1024x1024' | '1920x1080' | '4096x4096';

/**
 * Image generation response
 */
export interface ImageResponse {
  images: GeneratedImage[];
  model: string;
  provider: string;
  cost: number;
  revisedPrompt?: string;
}

/**
 * Generated image info
 */
export interface GeneratedImage {
  url: string;
  base64?: string;
  revisedPrompt?: string;
}

/**
 * Audio generation request
 */
export interface AudioRequest {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  outputFormat?: 'mp3' | 'opus' | 'aac' | 'flac';
}

/**
 * Audio generation response
 */
export interface AudioResponse {
  audioUrl: string;
  model: string;
  provider: string;
  cost: number;
  duration: number;
  characters: number;
}

/**
 * Video generation request
 */
export interface VideoRequest {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

/**
 * Video generation response
 */
export interface VideoResponse {
  videoUrl: string;
  model: string;
  provider: string;
  cost: number;
  duration: number;
}

/**
 * Cost estimation request
 */
export interface CostRequest {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  requestType: 'chat' | 'image' | 'audio' | 'video';
}

/**
 * Cost estimation response
 */
export interface CostEstimate {
  estimatedCost: number;
  currency: string;
  breakdown: {
    input: number;
    output: number;
    additional?: number;
  };
  provider: string;
  model: string;
}

/**
 * Provider availability status
 */
export type ProviderStatus = 'available' | 'unconfigured' | 'error' | 'rate_limited' | 'degraded';

/**
 * Provider health check response
 */
export interface ProviderHealth {
  name: string;
  status: ProviderStatus;
  latencyMs?: number;
  lastCheck: number;
  error?: string;
}

/**
 * Base AI Provider interface
 * All provider implementations must extend this interface
 */
export interface AIProvider {
  /** Provider configuration */
  readonly config: ProviderConfig;

  /** Initialize provider (authenticate, validate) */
  initialize(): Promise<void>;

  /** Check if provider is available */
  isAvailable(): Promise<boolean>;

  /** Get health status */
  getHealth(): Promise<ProviderHealth>;

  /** Generate chat completion */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Generate images (if supported) */
  generateImage?(request: ImageRequest): Promise<ImageResponse>;

  /** Generate audio (if supported) */
  generateAudio?(request: AudioRequest): Promise<AudioResponse>;

  /** Generate video (if supported) */
  generateVideo?(request: VideoRequest): Promise<VideoResponse>;

  /** Estimate cost for a request */
  estimateCost(request: CostRequest): Promise<CostEstimate>;

  /** List available models */
  listModels(): ModelInfo[];

  /** Get provider capabilities */
  getCapabilities(): ProviderCapabilities;

  /** Cleanup resources */
  dispose(): void;
}

/**
 * Provider factory interface for dynamic provider loading
 */
export interface ProviderFactory {
  create(config: ProviderConfig): AIProvider;
  supports(apiFormat: string): boolean;
}

/**
 * Provider registry for managing all providers
 */
export interface ProviderRegistry {
  register(factory: ProviderFactory): void;
  get(name: string): AIProvider | undefined;
  list(): AIProvider[];
  getAvailable(): AIProvider[];
  getByCapability(capability: keyof ProviderCapabilities): AIProvider[];
}
