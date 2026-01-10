/**
 * Multi-Model Router Worker
 *
 * Cloudflare Worker that routes LLM requests to the cheapest available provider
 * with fallback support, response caching in KV, and cost tracking.
 *
 * Now integrated with:
 * - NIM Llama Nemotron reasoning models
 * - Riva speech services (ASR/TTS/Translation)
 * - Manus AI research and study guides
 * - Cloudflare Agents for stateful conversations
 *
 * Deploy to: wrangler publish
 */

import { Router } from 'itty-router';

// Import specialized service clients
import { createNIMClient } from '../nim-client';
import { createRivaClient } from '../riva';
import { createManusClient } from '../manus';
import { createCloudflareAgentManager } from '../cloudflare-agents';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // API Keys (set in wrangler.toml)
  DEEPSEEK_API_KEY?: string;
  ZHIPU_API_KEY?: string; // Z.ai (Zhipu AI) - format: {id}.{secret}
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OLLAMA_URL?: string;

  // Specialized Service API Keys
  NIM_BASE_URL?: string;           // NIM endpoint (defaults to NVIDIA API)
  RIVA_API_KEY?: string;           // Riva speech services
  RIVA_BASE_URL?: string;          // Riva endpoint
  MANUS_API_KEY?: string;          // Manus AI research
  MANUS_BASE_URL?: string;         // Manus endpoint
  CLOUDFLARE_API_TOKEN?: string;   // Cloudflare Agents
  CLOUDFLARE_ACCOUNT_ID?: string;  // Cloudflare Account ID

  // KV Namespace for caching
  CACHE: KVNamespace;

  // D1 Database for cost tracking
  DB?: D1Database;

  // First-mile router integration (cascading)
  FIRST_MILE_ROUTER_URL?: string; // URL to first-mile-router /classify endpoint
  CASCADING_ENABLED?: string; // Set to 'true' to enable intent-based routing
}

// ============================================================================
// Types
// ============================================================================

interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  provider?: string;
  stream?: boolean;
}

interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    cacheRead?: number; // Cached thinking tokens (DeepSeek reasoner)
  };
  finish_reason: string;
  cached: boolean;
}

interface Provider {
  name: string;
  models: string[];
  baseUrl: string;
  costPerMillion: number;
}

interface CostEntry {
  userId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
}

/**
 * Intent classification from first-mile-router
 *
 * Extended to include specialized service routing:
 * - 'math-reasoning' -> Routes to NIM Llama Nemotron for math problems
 * - 'research' -> Routes to Manus AI for autonomous research
 * - 'study-guide' -> Routes to Manus AI for guide generation
 * - 'speech-input' -> Routes to Riva ASR for transcription
 * - 'speech-output' -> Routes to Riva TTS for synthesis
 */
type Intent =
  | 'code-help'        // Code generation, debugging, refactoring
  | 'explanation'      // Concept explanation, tutorials
  | 'simulation'       // Godot scene work, physics, game logic
  | 'bazaar'           // Community features, sharing, forking
  | 'creative'         // Creative writing, storytelling
  | 'analysis'         // Data analysis, pattern recognition
  | 'math-reasoning'   // Mathematical problem solving -> NIM Nemotron
  | 'research'         // Autonomous research tasks -> Manus AI
  | 'study-guide'      // Study guide generation -> Manus AI
  | 'speech-input'     // Speech-to-text -> Riva ASR
  | 'speech-output'    // Text-to-speech -> Riva TTS
  | 'translation'      // Language translation -> Riva NMT
  | 'general';         // Fallback to default provider

/**
 * Classification response from first-mile-router
 */
interface ClassificationResponse {
  intent: Intent;
  recommendedProvider: string;
  recommendedModel: string;
  confidence: number;
  reasoning: string;
  bypassRouter: boolean;
  suggestedCacheTtl?: number;
  cached?: boolean;
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Supported AI providers with their configuration.
 *
 * Each provider defines:
 * - `name`: Unique identifier for the provider
 * - `models`: Array of model names supported by this provider
 * - `baseUrl`: Base URL for the provider's API endpoint
 * - `costPerMillion`: Cost in USD per 1M tokens (0 for local models)
 *
 * The fallback chain (`FALLBACK_CHAIN`) determines the order in which
 * providers are tried when the preferred provider is unavailable.
 *
 * ### Cost-Optimized Routing
 *
 * The router prioritizes providers by cost when no specific provider is
 * requested. DeepSeek is the primary cost-optimized option at $0.14/$0.28
 * per 1M tokens - significantly cheaper than alternatives.
 *
 * ### Provider Cost Comparison (per 1M input tokens)
 *
 * | Provider | Input Cost | Output Cost | Notes |
 * |----------|-----------|-------------|-------|
 * | **DeepSeek** | $0.14 | $0.28 | Primary cost option |
 * | NVIDIA | $0.40 | ~$0.40 | Good fallback |
 * | Google | $1.00 | ~$1.00 | Fast, reliable |
 * | Anthropic | $3.00 | $15.00 | Best for code |
 * | OpenAI | $2.50 | $10.00 | Premium tier |
 * | Ollama | $0 | $0 | Local only |
 *
 * @security
 * API keys are injected via environment variables and are never hardcoded.
 * All API calls use HTTPS (except local Ollama which uses http://localhost).
 *
 * @example
 * ```ts
 * const deepseek = PROVIDERS['deepseek'];
 * // Returns: { name: 'deepseek', models: [...], baseUrl: '...', costPerMillion: 0.14 }
 * ```
 */
const PROVIDERS: Record<string, Provider> = {
  /**
   * Zhipu AI (Z.ai) - Chinese AI provider with competitive pricing
   *
   * Why Zhipu:
   * - Ultra-low pricing on GLM-4-Flash ($0.01 input / $0.01 output per 1M tokens)
   * - GLM-4.7 optimized for coding and agentic workflows
   * - GLM-4-Long with 200K context window for large files
   * - OpenAI-compatible API format with JWT authentication
   * - Strong for Chinese and English language tasks
   *
   * ### JWT Authentication
   * Zhipu uses JWT authentication instead of simple Bearer tokens.
   * API key format: {id}.{secret} (e.g., "1234.abcdef1234567890")
   * The router automatically generates JWT tokens for each request.
   *
   * ### Models
   * | Model | Context | Best For | Cost |
   * |-------|---------|----------|------|
   * | glm-4-flash | 128K | Fast, simple queries | $0.01/$0.01 |
   * | glm-4.5 | 128K | General purpose | $0.05/$0.05 |
   * | glm-4.7 | 128K | Coding, agents | $0.08/$0.30 |
   * | glm-4-plus | 128K | High-quality reasoning | $0.50/$0.50 |
   * | glm-4-long | 200K | Large documents | $0.08/$0.30 |
   */
  zhipu: {
    name: 'zhipu',
    models: ['glm-4-flash', 'glm-4.5', 'glm-4.7', 'glm-4-plus', 'glm-4-long'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    costPerMillion: 0.15, // Average cost
  },
  /**
   * DeepSeek - Primary cost-optimized provider
   *
   * Why DeepSeek first:
   * - Ultra-low pricing ($0.14 input / $0.28 output per 1M tokens)
   * - OpenAI-compatible API (seamless integration)
   * - Three models: chat (general), coder (code), reasoner (complex)
   * - 64K context on chat and reasoner models
   * - Strong performance especially for code and reasoning tasks
   *
   * Use DeepSeek for:
   * - High-volume chat applications
   * - Code generation and debugging
   * - Cost-sensitive production workloads
   * - Educational environments with budget constraints
   */
  deepseek: {
    name: 'deepseek',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    baseUrl: 'https://api.deepseek.com',
    costPerMillion: 0.14, // Average cost (chat/coder)
  },
  /**
   * OpenAI - Premium option with excellent general performance
   * Use when: Budget allows and you need GPT-4 quality
   */
  openai: {
    name: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1',
    costPerMillion: 5,
  },
  /**
   * Anthropic - Best for code-related tasks
   * Use when: Working on complex code, refactoring, debugging
   */
  anthropic: {
    name: 'anthropic',
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
    baseUrl: 'https://api.anthropic.com/v1',
    costPerMillion: 3,
  },
  /**
   * Google - Fast, reliable, mid-range pricing
   * Use when: Need speed and reliability at reasonable cost
   */
  google: {
    name: 'google',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    costPerMillion: 1,
  },
  /**
   * NVIDIA - Good cost-performance ratio for open-source models
   * Use when: DeepSeek unavailable, need hosted Llama/Nemotron
   */
  nvidia: {
    name: 'nvidia',
    models: ['llama-3.1-405b', 'nemotron-4-340b'],
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    costPerMillion: 0.4,
  },
  /**
   * Ollama - Local model hosting (ultimate fallback)
   * Use when: Privacy required, no network, or all cloud providers unavailable
   * Note: Requires Ollama running on localhost:11434
   */
  ollama: {
    name: 'ollama',
    models: ['llama3.1:8b', 'nemotron-mini:4b'],
    baseUrl: 'http://localhost:11434',
    costPerMillion: 0,
  },
};

/**
 * Fallback chain for provider selection.
 *
 * Order is prioritized by:
 * 1. **Cost** - Cheapest first (DeepSeek at $0.14/M)
 * 2. **Reliability** - Proven cloud providers next
 * 3. **Local fallback** - Ollama as last resort
 *
 * The cascade router may override this order based on intent classification.
 * For example, code-help intent may prioritize Anthropic despite higher cost.
 *
 * To add a new provider:
 * 1. Add to PROVIDERS object above
 * 2. Add to this chain in appropriate position
 * 3. Add hasApiKey() case below
 * 4. Add callProvider() case below
 */
const FALLBACK_CHAIN = [
  'zhipu',         // Primary: lowest cost (GLM-4-Flash at $0.01/M)
  'deepseek',      // Secondary: very low cost, good quality
  'nvidia',        // Fallback 1: still low cost, open source
  'google',        // Fallback 2: fast, reliable
  'anthropic',     // Fallback 3: best for code
  'openai',        // Fallback 4: premium option
  'ollama',        // Last resort: local, always available
];

// ============================================================================
// Router Setup
// ============================================================================

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Routes
// ============================================================================

router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/', () => {
  return new Response(JSON.stringify({ status: 'healthy', service: 'multi-model-router' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get available providers
router.get('/providers', (req) => {
  const env = req.env as Env;
  const available = Object.entries(PROVIDERS)
    .filter(([key]) => hasApiKey(key, env))
    .map(([, provider]) => ({
      name: provider.name,
      models: provider.models,
      costPerMillion: provider.costPerMillion,
    }));

  return new Response(JSON.stringify({ providers: available }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Chat completions endpoint
router.post('/v1/chat/completions', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as ChatRequest & { userId?: string };

  // Check cache first
  const cacheKey = getCacheKey(body);
  const cached = await env.CACHE.get(cacheKey, 'json');
  if (cached) {
    return new Response(JSON.stringify({ ...(cached as ChatResponse), cached: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Initialize cascade metrics for cost tracking
  const cascadeMetrics: CascadeMetrics = {
    enabled: false,
    intent: null,
    usedRecommendedProvider: false,
    savedCost: 0,
    recommendedProvider: null,
  };

  // Route to provider (with cascade classification)
  const response = await routeRequest(env, body, cascadeMetrics);

  // Log cascade savings
  if (cascadeMetrics.enabled && cascadeMetrics.savedCost > 0) {
    console.log(`[Cascade] Request completed - Intent: ${cascadeMetrics.intent}, saved: $${cascadeMetrics.savedCost.toFixed(6)}`);
  }

  // Cache successful responses
  if (response.content) {
    await env.CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
  }

  // Track cost
  if (env.DB && body.userId) {
    await trackCost(env.DB, {
      userId: body.userId,
      model: response.model,
      provider: response.provider,
      inputTokens: response.tokens.input,
      outputTokens: response.tokens.output,
      cost: response.cost,
      timestamp: Date.now(),
    });

    // Track cascade savings if enabled
    if (cascadeMetrics.enabled && cascadeMetrics.intent && cascadeMetrics.recommendedProvider) {
      await trackCascadeSavings(
        env.DB,
        body.userId,
        cascadeMetrics.intent,
        cascadeMetrics.recommendedProvider,
        response.provider,
        cascadeMetrics.savedCost
      );
    }
  }

  return new Response(JSON.stringify({ ...response, cached: false }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get user costs
router.get('/costs/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!env.DB || !userId) {
    return new Response(JSON.stringify({ totalCost: 0, breakdown: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const result = await env.DB
    .prepare('SELECT provider, model, SUM(input_tokens) as input, SUM(output_tokens) as output, SUM(cost) as total FROM costs WHERE user_id = ? GROUP BY provider, model')
    .bind(userId)
    .all();

  const totalCost = result.results.reduce((sum: number, row: any) => sum + (row.total || 0), 0);

  return new Response(JSON.stringify({ totalCost, breakdown: result.results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get cascade cost summary for dashboard
router.get('/costs/cascade', async (req) => {
  const env = req.env as Env;
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId') || 'default';

  if (!env.DB) {
    // Return empty data when DB is not configured
    return new Response(JSON.stringify({
      totalRequests: 0,
      totalCost: 0,
      cascadeSavings: 0,
      providerBreakdown: [],
      intentBreakdown: [],
      period: { start: Date.now() - 86400000, end: Date.now() },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get period (last 24 hours by default)
  const periodEnd = Date.now();
  const periodStart = periodEnd - 86400000; // 24 hours

  // Get total requests and cost
  const totalResult = await env.DB
    .prepare('SELECT COUNT(*) as count, SUM(cost) as total FROM costs WHERE user_id = ? AND timestamp >= ?')
    .bind(userId, periodStart)
    .first();

  const totalRequests = (totalResult?.count as number) || 0;
  const totalCost = (totalResult?.total as number) || 0;

  // Get provider breakdown
  const providerResult = await env.DB
    .prepare('SELECT provider, COUNT(*) as count, SUM(cost) as cost_total FROM costs WHERE user_id = ? AND timestamp >= ? GROUP BY provider')
    .bind(userId, periodStart)
    .all();

  const providerBreakdown = providerResult.results.map((row: any) => ({
    name: row.provider,
    requestCount: row.count,
    costTotal: row.cost_total,
    percentage: totalRequests > 0 ? (row.count / totalRequests) * 100 : 0,
  }));

  // Get intent breakdown from cascade_savings table if it exists
  let intentBreakdown: Array<{ intent: string; count: number; percentage: number }> = [];

  try {
    const intentResult = await env.DB
      .prepare('SELECT intent, COUNT(*) as count FROM cascade_savings WHERE user_id = ? AND timestamp >= ? GROUP BY intent')
      .bind(userId, periodStart)
      .all();

    if (intentResult.results.length > 0) {
      const totalIntentRequests = intentResult.results.reduce((sum: number, row: any) => sum + row.count, 0);
      intentBreakdown = intentResult.results.map((row: any) => ({
        intent: row.intent,
        count: row.count,
        percentage: totalIntentRequests > 0 ? (row.count / totalIntentRequests) * 100 : 0,
      }));
    }
  } catch (e) {
    // Table might not exist yet, that's fine
    console.log('[Cascade] cascade_savings table not yet created or no data');
  }

  // Calculate cascade savings (sum of saved_cost from cascade_savings table)
  let cascadeSavings = 0;
  try {
    const savingsResult = await env.DB
      .prepare('SELECT SUM(saved_cost) as total FROM cascade_savings WHERE user_id = ? AND timestamp >= ?')
      .bind(userId, periodStart)
      .first();
    cascadeSavings = (savingsResult?.total as number) || 0;
  } catch (e) {
    // Table might not exist
    console.log('[Cascade] cascade_savings table not yet created');
  }

  return new Response(JSON.stringify({
    totalRequests,
    totalCost,
    cascadeSavings,
    providerBreakdown,
    intentBreakdown,
    period: { start: periodStart, end: periodEnd },
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Cascade tracking for cost savings
 */
interface CascadeMetrics {
  enabled: boolean;
  intent: Intent | null;
  usedRecommendedProvider: boolean;
  savedCost: number; // Estimated cost saved by using optimal provider
  recommendedProvider: string | null; // The provider recommended by cascade
}

/**
 * Get intent classification from first-mile-router
 * Falls back to default behavior if cascading is disabled or endpoint fails
 */
async function getIntentClassification(
  env: Env,
  message: string
): Promise<ClassificationResponse | null> {
  const cascadeEnabled = env.CASCADING_ENABLED === 'true';
  const routerUrl = env.FIRST_MILE_ROUTER_URL || 'http://localhost:8787';

  if (!cascadeEnabled) {
    console.log('[Cascade] Cascading disabled, using default routing');
    return null;
  }

  try {
    const response = await fetch(`${routerUrl}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      console.warn(`[Cascade] Classification endpoint returned ${response.status}`);
      return null;
    }

    const result = (await response.json()) as ClassificationResponse;
    console.log(`[Cascade] Intent: ${result.intent}, provider: ${result.recommendedProvider}, confidence: ${result.confidence}`);
    return result;
  } catch (error) {
    console.error('[Cascade] Classification failed:', error);
    return null;
  }
}

/**
 * Estimate cost per million tokens for a provider
 */
function getProviderCost(providerName: string): number {
  const provider = PROVIDERS[providerName];
  return provider?.costPerMillion || 5; // Default to $5/M
}

/**
 * Calculate cost savings from using recommended provider vs default
 */
function calculateSavings(recommendedProvider: string, defaultProvider: string): number {
  const recommendedCost = getProviderCost(recommendedProvider);
  const defaultCost = getProviderCost(defaultProvider);

  // Estimate for a typical 1000 token request (500 in + 500 out)
  const typicalTokens = 1000;
  const defaultTotal = (typicalTokens / 1_000_000) * defaultCost;
  const recommendedTotal = (typicalTokens / 1_000_000) * recommendedCost;

  return Math.max(0, defaultTotal - recommendedTotal);
}

/**
 * Route an LLM request to the appropriate provider with cascade optimization.
 *
 * This is the core routing function that implements the cascade routing flow:
 *
 * 1. **Intent Classification**: If cascading is enabled, calls the first-mile-router
 *    to classify the user's intent and get provider recommendations
 * 2. **Provider Chain Building**: Builds a prioritized list of providers to try,
 *    starting with the recommended provider (if classification succeeded)
 * 3. **User Override**: If the user specified a provider, it takes precedence
 * 4. **Fallback Loop**: Tries each provider in order until one succeeds
 * 5. **Cost Tracking**: Updates cascade metrics for cost savings analysis
 *
 * ### Cascade Flow Diagram
 * ```
 * User Request
 *    ↓
 * [First-Mile Router] → Intent + Recommended Provider
 *    ↓
 * [Build Provider Chain] → Prioritize recommended provider
 *    ↓
 * [User Override?] → If user specified provider, use it first
 *    ↓
 * [Try Providers] → Loop through chain until success
 *    ↓
 * [Response] → Include cascade metadata
 * ```
 *
 * ### Error Handling
 * - If all providers fail, throws `Error('All providers failed or no available providers')`
 * - Individual provider failures are logged and the next provider is tried
 * - API key availability is checked before attempting a provider
 *
 * ### Cost Optimization
 * When intent classification succeeds, the recommended provider (typically cheaper
 * for the specific intent) is prioritized. The estimated savings are tracked in
 * the `cascadeMetrics` parameter.
 *
 * @param env - Cloudflare Worker environment containing API keys and service bindings
 * @param body - The chat request including model, messages, and optional provider preference
 * @param cascadeMetrics - Optional metrics object to track cascade routing performance
 * @returns Promise resolving to a chat response with content, tokens, cost, and provider info
 * @throws {Error} When all providers in the chain fail or no providers are available
 *
 * @example
 * ```ts
 * const response = await routeRequest(env, {
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Explain recursion' }],
 *   temperature: 0.7
 * }, cascadeMetrics);
 * // Returns: { content: '...', model: 'gpt-4o', provider: 'openai', cost: 0.001, ... }
 * ```
 */
async function routeRequest(env: Env, body: ChatRequest, cascadeMetrics?: CascadeMetrics): Promise<ChatResponse> {
  const { model, provider: preferredProvider, messages, temperature = 0.7, max_tokens = 1024 } = body;

  // Extract user message for classification (last message is typically the user's new message)
  const lastMessage = messages[messages.length - 1]?.content || '';

  // Get intent classification before calling expensive LLM
  const classification = await getIntentClassification(env, lastMessage);

  // Determine provider chain
  let providerChain = FALLBACK_CHAIN;
  let recommendedProvider: string | null = null;

  // Use classification to optimize provider selection
  if (classification && !preferredProvider) {
    recommendedProvider = mapIntentToProvider(classification.intent);
    if (recommendedProvider) {
      // Prioritize the recommended provider
      const index = FALLBACK_CHAIN.indexOf(recommendedProvider);
      if (index >= 0) {
        providerChain = [
          recommendedProvider,
          ...FALLBACK_CHAIN.filter((p) => p !== recommendedProvider),
        ];
      }

      // Track cascade metrics
      if (cascadeMetrics) {
        cascadeMetrics.enabled = true;
        cascadeMetrics.intent = classification.intent;
        cascadeMetrics.recommendedProvider = recommendedProvider;
        cascadeMetrics.usedRecommendedProvider = true;
        const defaultProvider = FALLBACK_CHAIN[0]; // Typically the first/default provider
        // recommendedProvider is non-null here because we're inside the if (recommendedProvider) block
        // Cast to string since we've verified it's not null above
        cascadeMetrics.savedCost = calculateSavings(recommendedProvider as string, defaultProvider);
      }

      console.log(`[Cascade] Intent: ${classification.intent}, using ${recommendedProvider}, saved: $${cascadeMetrics?.savedCost.toFixed(6)}`);
    }
  } else if (cascadeMetrics) {
    cascadeMetrics.enabled = false;
    cascadeMetrics.intent = null;
    cascadeMetrics.recommendedProvider = null;
  }

  // User-specified provider overrides classification
  if (preferredProvider) {
    const index = FALLBACK_CHAIN.indexOf(preferredProvider);
    if (index >= 0) {
      providerChain = [...FALLBACK_CHAIN.slice(index), ...FALLBACK_CHAIN.slice(0, index)];
    }
  }

  // Try each provider in the chain
  for (const providerName of providerChain) {
    if (!hasApiKey(providerName, env)) {
      continue;
    }

    const provider = PROVIDERS[providerName];
    if (!provider || !provider.models.includes(model)) {
      continue;
    }

    try {
      const response = await callProvider(env, providerName, model, messages, { temperature, max_tokens });

      // Add cascade info to response for tracking
      if (cascadeMetrics?.enabled) {
        (response as any).cascade = {
          intent: cascadeMetrics.intent,
          recommendedProvider,
          usedRecommendedProvider: providerName === recommendedProvider,
          estimatedSaved: cascadeMetrics.savedCost,
        };
      }

      return response;
    } catch (error) {
      console.error(`[Router] ${providerName} failed:`, error);
      // Try next provider
    }
  }

  throw new Error('All providers failed or no available providers');
}

/**
 * Map intent to the optimal provider or specialized service.
 *
 * Extended to route specialized intents to their dedicated services:
 * - NIM Llama Nemotron for math and reasoning
 * - Riva for speech I/O and translation
 * - Manus AI for research and study guides
 * - Standard providers for general LLM tasks
 *
 * ### Provider Selection by Intent
 *
 * | Intent | Provider/Service | Rationale |
 * |--------|-----------------|-----------|
 * | math-reasoning | nim | Llama Nemotron optimized for math |
 * | research | manus | Autonomous research agent |
 * | study-guide | manus | Educational content generation |
 * | speech-input | riva | Neural ASR transcription |
 * | speech-output | riva | Neural TTS synthesis |
 * | translation | riva | 26+ language neural MT |
 * | code-help | deepseek | Specialized coder model, lowest cost |
 * | explanation | deepseek | Good quality explanations, excellent value |
 * | simulation | deepseek | Strong reasoning at lowest cost |
 * | bazaar | google | Fast, cheap for metadata operations |
 * | creative | deepseek | Good creative output, cost-effective |
 * | analysis | deepseek | Efficient analysis with low cost |
 * | general | deepseek | Best default choice for most queries |
 *
 * Note: The cascade router can still override these defaults based on
 * user preferences, specific model requirements, or fallback needs.
 */
function mapIntentToProvider(intent: Intent): string | null {
  switch (intent) {
    // Specialized service routing
    case 'math-reasoning':
      return 'nim'; // Llama Nemotron for advanced math reasoning
    case 'research':
      return 'manus'; // Manus AI for autonomous research
    case 'study-guide':
      return 'manus'; // Manus AI for educational content
    case 'speech-input':
      return 'riva'; // Riva ASR for speech-to-text
    case 'speech-output':
      return 'riva'; // Riva TTS for text-to-speech
    case 'translation':
      return 'riva'; // Riva NMT for translation

    // Standard provider routing
    case 'code-help':
      return 'deepseek'; // Use deepseek-coder for code - specialized and cheapest
    case 'explanation':
      return 'deepseek'; // Good quality at lowest cost
    case 'simulation':
      return 'deepseek'; // Use deepseek-reasoner for complex simulation tasks
    case 'bazaar':
      return 'google'; // Fast, cheap for metadata operations
    case 'creative':
      return 'deepseek'; // Cost-effective creative output
    case 'analysis':
      return 'deepseek'; // Efficient analysis with low cost
    case 'general':
      return 'deepseek'; // Best default - lowest cost with good quality
    default:
      return null;
  }
}

async function callProvider(
  env: Env,
  providerName: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  // Handle specialized services first
  if (providerName === 'nim') {
    return await callNIM(env, model, messages, options);
  }
  if (providerName === 'riva') {
    return await callRiva(env, model, messages, options);
  }
  if (providerName === 'manus') {
    return await callManus(env, model, messages, options);
  }

  // Standard provider routing
  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Provider not found: ${providerName}`);
  }

  switch (providerName) {
    case 'zhipu':
      return await callZhipu(env, provider, model, messages, options);
    case 'deepseek':
      return await callDeepSeek(env, provider, model, messages, options);
    case 'anthropic':
      return await callAnthropic(env, provider, model, messages, options);
    case 'openai':
      return await callOpenAI(env, provider, model, messages, options);
    case 'google':
      return await callGoogle(env, provider, model, messages, options);
    case 'nvidia':
      return await callNVIDIA(env, provider, model, messages, options);
    case 'ollama':
      return await callOllama(env, provider, model, messages, options);
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

/**
 * ============================================================================
 * Zhipu AI (Z.ai) Provider Implementation
 * ============================================================================
 *
 * Zhipu AI is a Chinese AI provider with competitive pricing and strong coding capabilities.
 *
 * ### JWT Authentication
 *
 * Unlike other providers that use simple Bearer tokens, Zhipu requires JWT authentication.
 *
 * API Key Format: {id}.{secret}
 * - Example: "1234.abcdef1234567890"
 *
 * JWT Generation Process:
 * 1. Parse API key to extract id and secret
 * 2. Create JWT payload: { api_key: id, exp: timestamp, timestamp: now }
 * 3. Sign using HMAC-SHA256 with the secret
 * 4. Use signed JWT as Bearer token
 *
 * ### Models and Pricing
 *
 * | Model | Input | Output | Context | Best For |
 * |-------|-------|--------|---------|----------|
 * | glm-4-flash | $0.01/M | $0.01/M | 128K | Fast queries |
 * | glm-4.5 | $0.05/M | $0.05/M | 128K | General purpose |
 * | glm-4.7 | $0.08/M | $0.30/M | 128K | Coding, agents |
 * | glm-4-plus | $0.50/M | $0.50/M | 128K | High-quality |
 * | glm-4-long | $0.08/M | $0.30/M | 200K | Large documents |
 */

/**
 * Generate JWT token for Zhipu API authentication
 *
 * Zhipu uses JWT instead of simple Bearer tokens. This function generates
 * a properly signed JWT token using the Web Crypto API.
 *
 * @param apiKey - Zhipu API key in format {id}.{secret}
 * @returns Signed JWT token
 */
async function generateZhipuJWT(apiKey: string): Promise<string> {
  // Parse API key: {id}.{secret}
  const parts = apiKey.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid Zhipu API key format. Expected {id}.{secret}');
  }
  const [id, secret] = parts;

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // Token expires in 1 hour

  // JWT Header
  const header = { alg: 'HS256', sign_type: 'SIGN' };

  // JWT Payload (Zhipu format)
  const payload = {
    api_key: id,
    exp: exp,
    timestamp: now,
  };

  // Helper: Base64URL encode
  function base64UrlEncode(str: string): string {
    const bytes = new TextEncoder().encode(str);
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const data = `${encodedHeader}.${encodedPayload}`;
  const keyData = new TextEncoder().encode(secret);
  const dataBytes = new TextEncoder().encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const encodedSignature = base64UrlEncode(signatureBase64);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Get model-specific pricing for Zhipu models
 */
function getZhipuPricing(model: string): { input: number; output: number } {
  const pricing: Record<string, { input: number; output: number }> = {
    'glm-4-flash': { input: 0.01, output: 0.01 },
    'glm-4.5': { input: 0.05, output: 0.05 },
    'glm-4.7': { input: 0.08, output: 0.30 },
    'glm-4-plus': { input: 0.50, output: 0.50 },
    'glm-4-long': { input: 0.08, output: 0.30 },
  };
  return pricing[model] || { input: 0.08, output: 0.30 };
}

/**
 * Call the Zhipu AI API with the given chat request.
 *
 * Zhipu uses OpenAI-compatible format with JWT authentication.
 *
 * @param env - Worker environment containing ZHIPU_API_KEY
 * @param provider - Provider configuration
 * @param model - Model name (e.g., 'glm-4.7', 'glm-4-flash')
 * @param messages - Array of chat messages
 * @param options - Generation options
 * @returns Promise resolving to ChatResponse
 */
async function callZhipu(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  // Generate JWT token for authentication
  const jwt = await generateZhipuJWT(env.ZHIPU_API_KEY || '');

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zhipu error: ${error}`);
  }

  const data = await response.json() as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
  };

  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;

  // Use model-specific pricing
  const pricing = getZhipuPricing(model);
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

  return {
    content: data.choices?.[0]?.message?.content || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
    cached: false,
  };
}

/**
 * Call the DeepSeek API with the given chat request.
 *
 * DeepSeek is the primary cost-optimized provider in the fallback chain:
 * - **Input**: $0.14 per 1M tokens (cheapest commercial option)
 * - **Output**: $0.28 per 1M tokens
 * - **Reasoner**: $0.55 input / $2.19 output (includes thinking tokens)
 *
 * ### Why DeepSeek First
 *
 * DeepSeek offers ~17x lower cost than OpenAI GPT-4 while maintaining
 * competitive quality, especially for code and reasoning tasks. This makes
 * it ideal for:
 * - High-volume applications
 * - Cost-sensitive environments
 * - Educational use cases
 * - Batch processing
 *
 * ### Models
 *
 * | Model | Context | Best For | Cost |
 * |-------|---------|----------|------|
 * | deepseek-chat | 64K | General purpose, explanations | $0.14/$0.28 |
 * | deepseek-coder | 16K | Code generation, debugging | $0.14/$0.28 |
 * | deepseek-reasoner | 64K | Complex reasoning, planning | $0.55/$2.19 |
 *
 * ### Thinking Tokens (deepseek-reasoner)
 *
 * The reasoner model generates extended thinking before the final answer.
 * These tokens are included in the input cost and provide better answers
 * for complex multi-step problems.
 *
 * ### API Format
 *
 * DeepSeek uses OpenAI-compatible format:
 * - Endpoint: `/v1/chat/completions`
 * - Headers: `Authorization: Bearer <token>`
 * - Response: Same structure as OpenAI
 *
 * @param env - Worker environment containing DEEPSEEK_API_KEY
 * @param provider - Provider configuration with baseUrl and costPerMillion
 * @param model - Model name (e.g., 'deepseek-chat', 'deepseek-coder', 'deepseek-reasoner')
 * @param messages - Array of chat messages with role and content
 * @param options - Generation options including temperature and max_tokens
 * @returns Promise resolving to standardized ChatResponse with content, tokens, and cost
 * @throws {Error} When API call fails or returns non-OK status
 *
 * @example
 * ```ts
 * const response = await callDeepSeek(env, provider, 'deepseek-coder', [
 *   { role: 'user', content: 'Write a function to sort an array' }
 * ], { temperature: 0.3, max_tokens: 2048 });
 * ```
 */
async function callDeepSeek(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const isReasoner = model === 'deepseek-reasoner';

  const response = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek error: ${error}`);
  }

  const data = await response.json() as {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_cache_hit_tokens?: number; // Thinking tokens for reasoner
    };
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
  };

  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const thinkingTokens = data.usage?.prompt_cache_hit_tokens || 0;

  // Cost calculation varies by model
  const cost = calculateDeepSeekCost(inputTokens, outputTokens, isReasoner, thinkingTokens);

  return {
    content: data.choices?.[0]?.message?.content || '',
    model,
    provider: provider.name,
    cost,
    tokens: {
      input: inputTokens,
      output: outputTokens,
      cacheRead: thinkingTokens,
    },
    finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
    cached: thinkingTokens > 0,
  };
}

/**
 * Calculate DeepSeek cost based on model and token usage.
 *
 * Different pricing for reasoner vs standard models accounts for
 * the extended thinking process in the reasoner.
 */
function calculateDeepSeekCost(
  inputTokens: number,
  outputTokens: number,
  isReasoner: boolean,
  thinkingTokens: number
): number {
  if (isReasoner) {
    // Reasoner: $0.55/M input (includes thinking), $2.19/M output
    return (
      ((inputTokens + thinkingTokens) / 1_000_000) * 0.55 +
      (outputTokens / 1_000_000) * 2.19
    );
  }
  // Standard: $0.14/M input, $0.28/M output
  return (
    (inputTokens / 1_000_000) * 0.14 +
    (outputTokens / 1_000_000) * 0.28
  );
}

/**
 * Call the Anthropic Claude API with the given chat request.
 *
 * Anthropic uses a distinct API format:
 * - Endpoint: `/v1/messages`
 * - Headers: `x-api-key` and `anthropic-version`
 * - Response structure differs from OpenAI-compatible APIs
 *
 * ### Cost Calculation
 * Anthropic pricing varies by model. The `provider.costPerMillion` is used
 * to estimate costs. Actual costs may differ based on:
 * - Model tier (Opus > Sonnet > Haiku)
 * - Input vs output token pricing differences
 * - Cached prompt tokens (not tracked here)
 *
 * @param env - Worker environment containing ANTHROPIC_API_KEY
 * @param provider - Provider configuration with baseUrl and costPerMillion
 * @param model - Model name (e.g., 'claude-3-5-sonnet')
 * @param messages - Array of chat messages with role and content
 * @param options - Generation options including temperature and max_tokens
 * @returns Promise resolving to standardized ChatResponse with content, tokens, and cost
 * @throws {Error} When API call fails or returns non-OK status
 *
 * @example
 * ```ts
 * const response = await callAnthropic(env, provider, 'claude-3-5-sonnet', [
 *   { role: 'user', content: 'Hello!' }
 * ], { temperature: 0.7, max_tokens: 1024 });
 * // Returns: { content: 'Hi!', model: 'claude-3-5-sonnet', provider: 'anthropic', ... }
 * ```
 */
async function callAnthropic(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const response = await fetch(`${provider.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic error: ${error}`);
  }

  const data = await response.json() as { usage?: { input_tokens?: number; output_tokens?: number }; content?: Array<{ text?: string }>; stop_reason?: string };
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const cost = ((inputTokens + outputTokens) / 1_000_000) * provider.costPerMillion;

  return {
    content: data.content?.[0]?.text || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.stop_reason || 'unknown',
    cached: false,
  };
}

/**
 * Call the OpenAI GPT API with the given chat request.
 *
 * OpenAI uses the standard chat completions format that many other
 * providers emulate (NVIDIA, some Groq endpoints, etc.).
 *
 * ### API Format
 * - Endpoint: `/v1/chat/completions`
 * - Headers: `Authorization: Bearer <token>`
 * - Response: Standard format with `choices[0].message.content`
 *
 * ### Cost Calculation
 * Uses the provider's `costPerMillion` setting. This is an approximation
 * as OpenAI's actual pricing varies by model and input/output ratio.
 *
 * @param env - Worker environment containing OPENAI_API_KEY
 * @param provider - Provider configuration with baseUrl and costPerMillion
 * @param model - Model name (e.g., 'gpt-4o', 'gpt-4o-mini')
 * @param messages - Array of chat messages with role and content
 * @param options - Generation options including temperature and max_tokens
 * @returns Promise resolving to standardized ChatResponse with content, tokens, and cost
 * @throws {Error} When API call fails or returns non-OK status
 *
 * @example
 * ```ts
 * const response = await callOpenAI(env, provider, 'gpt-4o', [
 *   { role: 'user', content: 'Explain quantum computing' }
 * ], { temperature: 0.7, max_tokens: 1024 });
 * ```
 */
async function callOpenAI(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }

  const data = await response.json() as { usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = ((inputTokens + outputTokens) / 1_000_000) * provider.costPerMillion;

  return {
    content: data.choices?.[0]?.message?.content || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
    cached: false,
  };
}

/**
 * Call the Google Gemini API with the given chat request.
 *
 * Google uses a unique API format that differs significantly from
 * OpenAI/Anthropic:
 * - Messages are wrapped in `contents` with `parts` arrays
 * - API key is passed via query parameter, not header
 * - Token counts come from `usageMetadata`
 * - Fixed approximate cost (Google's pricing is complex)
 *
 * ### API Format
 * - Endpoint: `/v1/models/{model}:generateContent?key={apiKey}`
 * - Request body: `{ contents: [{ parts: [{ text: "..." }] }] }`
 * - Response: `candidates[0].content.parts[0].text`
 *
 * @param env - Worker environment containing GOOGLE_API_KEY
 * @param provider - Provider configuration with baseUrl and costPerMillion
 * @param model - Model name (e.g., 'gemini-1.5-pro', 'gemini-1.5-flash')
 * @param messages - Array of chat messages with role and content
 * @param options - Generation options including temperature and max_tokens
 * @returns Promise resolving to standardized ChatResponse with content, tokens, and cost
 * @throws {Error} When API call fails or returns non-OK status
 *
 * @example
 * ```ts
 * const response = await callGoogle(env, provider, 'gemini-1.5-pro', [
 *   { role: 'user', content: 'Analyze this data' }
 * ], { temperature: 0.7, max_tokens: 1024 });
 * ```
 */
async function callGoogle(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const response = await fetch(
    `${provider.baseUrl}/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: messages.map((m) => ({ parts: [{ text: m.content }] })),
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google error: ${error}`);
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }>; }; finishReason?: string }>; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const usage = data.usageMetadata || {};

  return {
    content,
    model,
    provider: provider.name,
    cost: 0.0001, // Approximate
    tokens: { input: usage.promptTokenCount || 0, output: usage.candidatesTokenCount || 0 },
    finish_reason: data.candidates?.[0]?.finishReason || 'unknown',
    cached: false,
  };
}

/**
 * Call the NVIDIA NIM API with the given chat request.
 *
 * NVIDIA hosts open-source models (Llama, Nemotron) through their
 * inference API. The API format is OpenAI-compatible.
 *
 * ### Models Available
 * - `llama-3.1-405b`: Meta's largest open model
 * - `nemotron-4-340b`: NVIDIA's proprietary model
 *
 * ### API Format
 * - Endpoint: `/v1/chat/completions` (OpenAI-compatible)
 * - Headers: `Authorization: Bearer <token>`
 * - Response: Same structure as OpenAI
 *
 * ### Cost Advantage
 * NVIDIA is typically the cheapest commercial provider (aside from local),
 * making it ideal for cost-sensitive applications and fallback scenarios.
 *
 * @param env - Worker environment containing NVIDIA_API_KEY
 * @param provider - Provider configuration with baseUrl and costPerMillion
 * @param model - Model name (e.g., 'llama-3.1-405b', 'nemotron-4-340b')
 * @param messages - Array of chat messages with role and content
 * @param options - Generation options including temperature and max_tokens
 * @returns Promise resolving to standardized ChatResponse with content, tokens, and cost
 * @throws {Error} When API call fails or returns non-OK status
 *
 * @example
 * ```ts
 * const response = await callNVIDIA(env, provider, 'llama-3.1-405b', [
 *   { role: 'user', content: 'Generate code' }
 * ], { temperature: 0.7, max_tokens: 1024 });
 * ```
 */
async function callNVIDIA(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NVIDIA error: ${error}`);
  }

  const data = await response.json() as { usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string }; finish_reason?: string }> };
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = ((inputTokens + outputTokens) / 1_000_000) * provider.costPerMillion;

  return {
    content: data.choices?.[0]?.message?.content || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.choices?.[0]?.finish_reason || 'unknown',
    cached: false,
  };
}

/**
 * Call a local Ollama-hosted model with the given chat request.
 *
 * Ollama is the only local/self-hosted provider in the chain. It runs
 * on the user's machine (localhost:11434) and is always available,
 * making it the ultimate fallback.
 *
 * ### Advantages
 * - **Zero API cost**: Local inference is free
 * - **Privacy**: Data never leaves the machine
 * - **Availability**: No network dependency
 * - **Custom models**: Can run any Ollama-compatible model
 *
 * ### API Format
 * - Endpoint: `/api/chat`
 * - Body: `{ model, messages, stream: false, options: { ... } }`
 * - Response: `{ message: { content: "..." }, ... }`
 *
 * ### Cost
 * Always returns 0 since local inference has no per-token cost.
 * Electricity and hardware costs are not tracked.
 *
 * @param env - Worker environment with optional OLLAMA_URL override
 * @param provider - Provider configuration (localhost baseUrl is default)
 * @param model - Model name (e.g., 'llama3.1:8b', 'nemotron-mini:4b')
 * @param messages - Array of chat messages with role and content
 * @param options - Generation options including temperature and max_tokens
 * @returns Promise resolving to standardized ChatResponse with content and cost=0
 * @throws {Error} When Ollama server is unreachable or request fails
 *
 * @example
 * ```ts
 * const response = await callOllama(env, provider, 'llama3.1:8b', [
 *   { role: 'user', content: 'Hello local!' }
 * ], { temperature: 0.7, max_tokens: 1024 });
 * // Returns: { content: '...', cost: 0, provider: 'ollama', ... }
 * ```
 */
async function callOllama(
  env: Env,
  provider: Provider,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const ollamaUrl = env.OLLAMA_URL || provider.baseUrl;

  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.max_tokens,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${error}`);
  }

  const data = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };

  return {
    content: data.message?.content || '',
    model,
    provider: provider.name,
    cost: 0, // Local models are free
    tokens: { input: data.prompt_eval_count || 0, output: data.eval_count || 0 },
    finish_reason: 'done',
    cached: false,
  };
}

// ============================================================================
// Specialized Service Implementations
// ============================================================================

/**
 * Call NIM Llama Nemotron for specialized reasoning tasks
 *
 * Routes math and complex reasoning requests to NVIDIA's NIM service
 * which hosts optimized Llama Nemotron models.
 */
async function callNIM(
  env: Env,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  // Use NVIDIA_API_KEY for NIM requests
  if (!env.NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY is required for NIM service');
  }

  const nimClient = createNIMClient(
    { NVIDIA_API_KEY: env.NVIDIA_API_KEY, NIM_BASE_URL: env.NIM_BASE_URL },
    { timeout: 30000 }
  );

  // Extract the last user message for reasoning
  const lastMessage = messages[messages.length - 1]?.content || '';

  try {
    // Detect if this is a math reasoning request
    const isMathRequest = /\b(calculate|solve|math|equation|derivative|integral|probability|statistics)\b/i.test(lastMessage);

    let response: string;
    if (isMathRequest) {
      response = await nimClient.mathReasoning({
        problem: lastMessage,
        showSteps: true,
      });
    } else {
      response = await nimClient.reasoning(
        lastMessage,
        'llama-nemotron-super'
      );
      response = response.content;
    }

    return {
      content: response,
      model: model || 'llama-nemotron-super',
      provider: 'nim',
      cost: 0.001, // Approximate cost
      tokens: { input: 100, output: 100 }, // NIM doesn't always return token counts
      finish_reason: 'stop',
      cached: false,
    };
  } catch (error) {
    console.error('[NIM] Error:', error);
    throw new Error(`NIM service error: ${error}`);
  }
}

/**
 * Call Riva Speech Services for speech-related tasks
 *
 * Routes ASR, TTS, and translation requests to NVIDIA Riva.
 * Note: This is a simplified implementation for the chat interface.
 * Full speech capabilities require binary audio handling.
 */
async function callRiva(
  env: Env,
  model: string,
  messages: Array<{ role: string; content: string }>,
  _options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  if (!env.RIVA_API_KEY) {
    throw new Error('RIVA_API_KEY is required for Riva service');
  }

  // For text chat, Riva is primarily used for translation
  // Full speech capabilities require specialized endpoints
  const lastMessage = messages[messages.length - 1]?.content || '';

  // Check if translation is requested
  const translationMatch = lastMessage.match(/translate[:\s]+(.+?)\s+(?:to|from)\s+(\w+)/i);

  if (translationMatch) {
    const [, text, targetLang] = translationMatch;
    const rivaClient = createRivaClient(
      { RIVA_API_KEY: env.RIVA_API_KEY, RIVA_BASE_URL: env.RIVA_BASE_URL },
      { timeout: 30000 }
    );

    try {
      // Map common language names to codes
      const langMap: Record<string, string> = {
        'spanish': 'es-ES',
        'french': 'fr-FR',
        'german': 'de-DE',
        'italian': 'it-IT',
        'chinese': 'zh-CN',
        'japanese': 'ja-JP',
        'korean': 'ko-KR',
        'russian': 'ru-RU',
      };

      const targetCode = (langMap[targetLang.toLowerCase()] || targetLang) as 'en-US';

      const translated = await rivaClient.translate(text, 'en-US', targetCode);

      return {
        content: `Translation: ${translated}`,
        model: 'riva-nmt',
        provider: 'riva',
        cost: 0.0005,
        tokens: { input: text.length / 4, output: translated.length / 4 },
        finish_reason: 'stop',
        cached: false,
      };
    } catch (error) {
      console.error('[Riva] Translation error:', error);
      throw new Error(`Riva translation error: ${error}`);
    }
  }

  // For non-translation requests, return helpful info
  return {
    content: 'Riva speech services are available for:\n- Speech-to-text transcription\n- Text-to-speech synthesis\n- Translation between 26+ languages\n\nFor speech features, use the dedicated /speech endpoints.',
    model: 'riva-info',
    provider: 'riva',
    cost: 0,
    tokens: { input: 0, output: 50 },
    finish_reason: 'stop',
    cached: false,
  };
}

/**
 * Call Manus AI for research and educational content
 *
 * Routes research and study guide requests to Manus AI.
 */
async function callManus(
  env: Env,
  model: string,
  messages: Array<{ role: string; content: string }>,
  _options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  if (!env.MANUS_API_KEY) {
    throw new Error('MANUS_API_KEY is required for Manus service');
  }

  const lastMessage = messages[messages.length - 1]?.content || '';

  const manusClient = createManusClient(
    { MANUS_API_KEY: env.MANUS_API_KEY, MANUS_BASE_URL: env.MANUS_BASE_URL },
    { timeout: 60000 }
  );

  try {
    // Check if this is a study guide request
    const studyGuideMatch = lastMessage.match(/(?:create|generate)(?:\s+a)?\s+study\s+guide\s+(?:for|on|about)?\s+(.+)/i);

    if (studyGuideMatch) {
      const [, topic] = studyGuideMatch;
      const guide = await manusClient.generateStudyGuide(topic, 'intermediate');

      // Format the guide as text response
      const formatted = `# Study Guide: ${guide.title || topic}\n\n` +
        `**Difficulty:** ${guide.difficulty}\n` +
        `**Estimated Time:** ${guide.estimatedTime} minutes\n\n` +
        `## Learning Objectives\n${guide.objectives.map(o => `- ${o}`).join('\n')}\n\n` +
        `## Modules\n${guide.modules.map(m => `### ${m.number}. ${m.title}\n${m.content}`).join('\n\n')}`;

      return {
        content: formatted,
        model: 'manus-study-guide',
        provider: 'manus',
        cost: 0.005,
        tokens: { input: lastMessage.length / 4, output: formatted.length / 4 },
        finish_reason: 'stop',
        cached: false,
      };
    }

    // Check if this is a research request
    const researchMatch = lastMessage.match(/(?:research|investigate|find\s+information\s+(?:about|on))\s+(.+)/i);

    if (researchMatch) {
      const [, query] = researchMatch;
      const result = await manusClient.researchTask(query, 3);

      const formatted = `# Research Results: ${result.query}\n\n` +
        `## Summary\n${result.summary}\n\n` +
        `## Key Insights\n${result.insights.map(i => `- ${i}`).join('\n')}\n\n` +
        `## Sources Consulted: ${result.sourcesConsulted}\n\n` +
        `**Confidence:** ${(result.confidence * 100).toFixed(0)}%`;

      return {
        content: formatted,
        model: 'manus-research',
        provider: 'manus',
        cost: 0.01,
        tokens: { input: lastMessage.length / 4, output: formatted.length / 4 },
        finish_reason: 'stop',
        cached: false,
      };
    }

    // Generic Manus response
    return {
      content: 'Manus AI can help with:\n- Autonomous research on any topic\n- Study guide generation\n- Dataset synthesis\n\nTry: "Create a study guide for quantum mechanics" or "Research the latest in renewable energy"',
      model: 'manus-info',
      provider: 'manus',
      cost: 0,
      tokens: { input: 0, output: 60 },
      finish_reason: 'stop',
      cached: false,
    };
  } catch (error) {
    console.error('[Manus] Error:', error);
    throw new Error(`Manus service error: ${error}`);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function hasApiKey(provider: string, env: Env): boolean {
  switch (provider) {
    case 'zhipu':
      return !!env.ZHIPU_API_KEY;
    case 'deepseek':
      return !!env.DEEPSEEK_API_KEY;
    case 'openai':
      return !!env.OPENAI_API_KEY;
    case 'anthropic':
      return !!env.ANTHROPIC_API_KEY;
    case 'google':
      return !!env.GOOGLE_API_KEY;
    case 'nvidia':
      return !!env.NVIDIA_API_KEY;
    case 'ollama':
      return true; // Ollama is always available (may be localhost)
    case 'nim':
      return !!env.NVIDIA_API_KEY; // NIM uses NVIDIA API key
    case 'riva':
      return !!env.RIVA_API_KEY;
    case 'manus':
      return !!env.MANUS_API_KEY;
    default:
      return false;
  }
}

function getCacheKey(body: ChatRequest): string {
  // Create a cache key from the request
  const key = JSON.stringify({
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  });
  return `chat:${btoa(key).slice(0, 64)}`;
}

async function trackCost(db: D1Database, entry: CostEntry): Promise<void> {
  await db
    .prepare(
      'INSERT INTO costs (user_id, model, provider, input_tokens, output_tokens, cost, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(entry.userId, entry.model, entry.provider, entry.inputTokens, entry.outputTokens, entry.cost, entry.timestamp)
    .run();
}

/**
 * Track cascade savings when intent-based routing is used
 */
async function trackCascadeSavings(
  db: D1Database,
  userId: string,
  intent: Intent,
  recommendedProvider: string,
  actualProvider: string,
  savedCost: number
): Promise<void> {
  try {
    await db
      .prepare(
        'INSERT INTO cascade_savings (user_id, intent, recommended_provider, actual_provider, saved_cost, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(userId, intent, recommendedProvider, actualProvider, savedCost, Date.now())
      .run();
  } catch (error) {
    // Log but don't fail the request if tracking fails
    console.error('[Cascade] Failed to track savings:', error);
  }
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
