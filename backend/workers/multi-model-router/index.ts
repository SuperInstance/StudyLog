/**
 * Multi-Model Router Worker
 *
 * Cloudflare Worker that routes LLM requests to the cheapest available provider
 * with fallback support, response caching in KV, and cost tracking.
 *
 * Deploy to: wrangler publish
 */

import { Router } from 'itty-router';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // API Keys (set in wrangler.toml)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OLLAMA_URL?: string;

  // KV Namespace for caching
  CACHE: KVNamespace;

  // D1 Database for cost tracking
  DB?: D1Database;
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
  tokens: { input: number; output: number };
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

// ============================================================================
// Provider Configuration
// ============================================================================

const PROVIDERS: Record<string, Provider> = {
  openai: {
    name: 'openai',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    baseUrl: 'https://api.openai.com/v1',
    costPerMillion: 5,
  },
  anthropic: {
    name: 'anthropic',
    models: ['claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
    baseUrl: 'https://api.anthropic.com/v1',
    costPerMillion: 3,
  },
  google: {
    name: 'google',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    costPerMillion: 1,
  },
  nvidia: {
    name: 'nvidia',
    models: ['llama-3.1-405b', 'nemotron-4-340b'],
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    costPerMillion: 0.4,
  },
  ollama: {
    name: 'ollama',
    models: ['llama3.1:8b', 'nemotron-mini:4b'],
    baseUrl: 'http://localhost:11434',
    costPerMillion: 0,
  },
};

const FALLBACK_CHAIN = ['ollama', 'google', 'nvidia', 'anthropic', 'openai'];

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
    .map(([key, provider]) => ({
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

  // Route to provider
  const response = await routeRequest(env, body);

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

// ============================================================================
// Routing Logic
// ============================================================================

async function routeRequest(env: Env, body: ChatRequest): Promise<ChatResponse> {
  const { model, provider: preferredProvider, messages, temperature = 0.7, max_tokens = 1024 } = body;

  // Determine provider chain
  let providerChain = FALLBACK_CHAIN;

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
    if (!provider.models.includes(model)) {
      continue;
    }

    try {
      return await callProvider(env, providerName, model, messages, { temperature, max_tokens });
    } catch (error) {
      console.error(`[Router] ${providerName} failed:`, error);
      // Try next provider
    }
  }

  throw new Error('All providers failed or no available providers');
}

async function callProvider(
  env: Env,
  providerName: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  options: { temperature: number; max_tokens: number }
): Promise<ChatResponse> {
  const provider = PROVIDERS[providerName];

  switch (providerName) {
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

  const data = await response.json();
  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;
  const cost = ((inputTokens + outputTokens) / 1_000_000) * provider.costPerMillion;

  return {
    content: data.content[0]?.text || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.stop_reason || 'unknown',
    cached: false,
  };
}

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

  const data = await response.json();
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = ((inputTokens + outputTokens) / 1_000_000) * provider.costPerMillion;

  return {
    content: data.choices[0]?.message?.content || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.choices[0]?.finish_reason || 'unknown',
    cached: false,
  };
}

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

  const data = await response.json();
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

  const data = await response.json();
  const inputTokens = data.usage?.prompt_tokens || 0;
  const outputTokens = data.usage?.completion_tokens || 0;
  const cost = ((inputTokens + outputTokens) / 1_000_000) * provider.costPerMillion;

  return {
    content: data.choices[0]?.message?.content || '',
    model,
    provider: provider.name,
    cost,
    tokens: { input: inputTokens, output: outputTokens },
    finish_reason: data.choices[0]?.finish_reason || 'unknown',
    cached: false,
  };
}

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

  const data = await response.json();

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
// Helpers
// ============================================================================

function hasApiKey(provider: string, env: Env): boolean {
  switch (provider) {
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
