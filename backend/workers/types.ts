/**
 * StudyLoG.AI Backend - Type Definitions
 *
 * Expanded to support multiple LLM and generative AI providers
 * including Z.ai, DeepSeek, Kimi, X.ai, DeepInfra, Replicate, and ElevenLabs.
 */

// ============================================================================
// Cloudflare Bindings
// ============================================================================

export interface Env {
  // D1 Database
  STUDENT_STATE: D1Database;

  // Vectorize
  PUZZLE_INDEX: VectorizeIndex;

  // R2 Storage
  PROJECT_STORAGE: R2Bucket;
  ASSET_STORAGE: R2Bucket;

  // KV Namespaces
  SESSION_CACHE: KVNamespace;
  RATE_LIMITS: KVNamespace;
  IMAGE_CACHE?: KVNamespace; // Cache for generated images

  // Workers AI
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  MAX_TOKENS_PER_REQUEST: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW: string;

  // First-mile router integration (cascading)
  FIRST_MILE_ROUTER_URL?: string;
  CASCADING_ENABLED?: string;

  // Existing Provider API Keys
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OLLAMA_ENDPOINT?: string;
  JWT_SECRET?: string;

  // New Provider API Keys (2024-2025 expansion)

  // Z.ai (Zhipu AI) - LLM, Image, Video
  ZHIPU_API_KEY?: string;

  // DeepSeek - LLM (ultra-low cost)
  DEEPSEEK_API_KEY?: string;

  // Kimi (Moonshot AI) - LLM, Chinese market
  KIMI_API_KEY?: string;

  // X.ai (Grok) - LLM with real-time data
  XAI_API_KEY?: string;

  // DeepInfra - Discount LLM aggregator
  DEEPINFRA_API_KEY?: string;

  // Replicate - Image/Video models
  REPLICATE_API_KEY?: string;

  // ElevenLabs - Audio generation
  ELEVENLABS_API_KEY?: string;
}

// Student types
export interface Student {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  tier: 'free' | 'forge' | 'studio' | 'lab';
}

export interface StudentProgress {
  studentId: string;
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  stage: number;
  xp: number;
  achievements: string[];
  lastActivity: string;
}

export interface LearnerPhase {
  phase: 'player' | 'reader' | 'tweaker' | 'creator' | 'mentor';
  unlockedAt: string;
  completedChallenges: number;
}

// Game state types
export interface GameState {
  sessionId: string;
  studentId: string;
  module: string;
  scene: string;
  state: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// AI Provider Types
// ============================================================================

/**
 * All supported AI providers
 */
export type AIProvider =
  | 'cloudflare'
  | 'ollama'
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'nvidia'
  // New providers (2024-2025 expansion)
  | 'zhipu'        // Z.ai (Zhipu AI)
  | 'deepseek'     // DeepSeek
  | 'kimi'         // Moonshot AI
  | 'xai'          // X.ai (Grok)
  | 'deepinfra'    // DeepInfra
  | 'replicate'    // Replicate
  | 'elevenlabs';  // ElevenLabs

/**
 * Provider type categories
 */
export type ProviderCategory = 'llm' | 'image' | 'audio' | 'video' | 'multimodal';

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  maxContext: number;
  imageGeneration: boolean;
  audioGeneration: boolean;
  videoGeneration: boolean;
  jsonMode: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: AIProvider;
  type: ProviderCategory;
  baseUrl: string;
  models: string[];
  costPerMillion: number;
  capabilities: ProviderCapabilities;
}

/**
 * Cost comparison for routing decisions
 */
export interface ProviderCostComparison {
  provider: AIProvider;
  inputCost: number;  // USD per 1M input tokens
  outputCost: number; // USD per 1M output tokens
  avgLatency: number; // milliseconds
  qualityScore: number; // 1-10
}

/**
 * Image generation quality tiers for cascade routing
 */
export type ImageQualityTier = 'prototype' | 'production' | 'final';

/**
 * Image generation request with cascade routing
 */
export interface ImageGenerationRequest {
  prompt: string;
  tier: ImageQualityTier;
  userTier: 'free' | 'forge' | 'studio' | 'lab';
  preferredProvider?: AIProvider;
  size?: '256x256' | '512x512' | '768x768' | '1024x1024' | '1920x1080' | '4096x4096';
  n?: number;
}

/**
 * Image generation response
 */
export interface ImageGenerationResponse {
  images: Array<{
    url: string;
    provider: AIProvider;
    tier: ImageQualityTier;
    cost: number;
  }>;
  providerUsed: AIProvider;
  tierUsed: ImageQualityTier;
  totalCost: number;
  cached: boolean;
}

/**
 * Audio generation request
 */
export interface AudioGenerationRequest {
  text: string;
  voice?: string;
  model?: string;
  speed?: number;
}

/**
 * Audio generation response
 */
export interface AudioGenerationResponse {
  audioUrl: string;
  provider: AIProvider;
  model: string;
  duration: number;
  cost: number;
}

// ============================================================================
// Legacy AI Types (for backward compatibility)
// ============================================================================

export interface AIRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  preferLocal?: boolean;
  provider?: AIProvider;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: AIProvider;
  tokens: {
    input: number;
    output: number;
  };
  latencyMs: number;
  cost: number;
}

// ============================================================================
// Cost Tracking Types
// ============================================================================

/**
 * Cost entry for database tracking
 */
export interface CostEntry {
  userId: string;
  model: string;
  provider: AIProvider;
  category: ProviderCategory;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
}

/**
 * Cascade savings tracking
 */
export interface CascadeSavingsEntry {
  userId: string;
  intent: string;
  recommendedProvider: AIProvider;
  actualProvider: AIProvider;
  savedCost: number;
  timestamp: number;
}

// API response types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    latencyMs: number;
  };
}

// Route handler types
export type RouteHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params: Record<string, string>
) => Promise<Response>;

// Vectorize types
export interface PuzzleVector {
  id: string;
  module: string;
  difficulty: number;
  tags: string[];
  embedding: number[];
}
