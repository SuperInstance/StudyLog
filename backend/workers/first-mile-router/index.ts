/**
 * First-Mile Router Worker
 *
 * Fast local AI routing before expensive LLM calls.
 * Uses Cloudflare Workers AI for quick intent classification
 * and recommends the appropriate provider/model before
 * calling the expensive multi-model-router.
 *
 * This is the "first mile" — a quick, cheap decision layer
 * that saves costs by routing intelligently.
 *
 * Deploy to: wrangler publish
 */

import { Router } from 'itty-router';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // Workers AI binding (for fast local inference)
  AI: Ai;

  // D1 Database for student state (optional context)
  STUDENT_STATE?: D1Database;

  // KV for caching classifications
  CLASSIFICATION_CACHE?: KVNamespace;

  // API Keys for fallback to multi-model-router
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OLLAMA_URL?: string;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Intent classification result
 * Determines which type of model/service is appropriate
 */
export type Intent =
  | 'code-help'      // Code generation, debugging, refactoring
  | 'explanation'    // Concept explanation, tutorials
  | 'simulation'     // Godot scene work, physics, game logic
  | 'bazaar'         // Community features, sharing, forking
  | 'creative'       // Creative writing, storytelling
  | 'analysis'       // Data analysis, pattern recognition
  | 'general';       // Fallback to default provider

/**
 * Request body for intent classification
 */
interface ClassificationRequest {
  message: string;
  context?: {
    module?: string;        // 'cognitive-mill', 'sitka-sound', etc.
    studentId?: string;     // For personalized routing
    previousIntents?: Intent[]; // For pattern detection
  };
}

/**
 * Response from first-mile router
 */
interface ClassificationResponse {
  intent: Intent;
  recommendedProvider: string;
  recommendedModel: string;
  confidence: number;
  reasoning: string;
  bypassRouter: boolean;    // If true, handle directly (e.g., cache hits)
  suggestedCacheTtl?: number;
}

/**
 * Classify user intent using keyword heuristics.
 *
 * This is a fast, zero-cost classification method that runs before any
 * AI inference. It uses regex pattern matching to identify common intent
 * categories from the user's message.
 *
 * ### Keyword Strategy
 *
 * The classifier checks patterns in order of specificity:
 *
 * 1. **Code-help** (`code-help`): Programming keywords, language names,
 *    debug/error/bug mentions, refactoring requests
 *
 * 2. **Simulation** (`simulation`): Godot/scene terminology, physics terms,
 *    game development concepts, mesh/texture/shader references
 *
 * 3. **Bazaar** (`bazaar`): Community terms like share/publish/fork,
 *    marketplace features, remix/merge terminology
 *
 * 4. **Explanation** (`explanation`): Learning verbs like explain/what is/how,
 *    concept definition requests, tutorial keywords
 *
 * 5. **Creative** (`creative`): Writing/generation keywords, story/character
 *    creation, imaginative content requests
 *
 * 6. **Analysis** (`analysis`): Data processing terms, compare/contrast,
 *    evaluation/assessment keywords
 *
 * ### Cascade Behavior
 * - Returns `null` when no keywords match
 * - Caller should fall back to AI classification when `null` is returned
 * - High confidence (0.9) is assumed for keyword matches
 *
 * ### Performance
 * - Executes in sub-millisecond time
 * - No network calls or external dependencies
 * - Case-insensitive matching via toLowerCase()
 *
 * @param message - The user's input message to classify
 * @returns The detected intent, or `null` if keywords are inconclusive
 *
 * @example
 * ```ts
 * classifyByKeywords("Help me debug my Python code")
 * // Returns: 'code-help'
 *
 * classifyByKeywords("Create a new Godot scene")
 * // Returns: 'simulation'
 *
 * classifyByKeywords("What is the weather today?")
 * // Returns: null (falls back to AI classification)
 * ```
 */
function classifyByKeywords(message: string): Intent | null {
  const msg = message.toLowerCase();

  // Code patterns
  if (/\b(function|class|const|let|var|import|export|debug|error|bug|refactor|syntax)\b/i.test(msg) ||
      /\b(code|typescript|javascript|python|gdscript|godot|compile|build)\b/i.test(msg)) {
    return 'code-help';
  }

  // Simulation/Godot patterns
  if (/\b(scene|node|sprite|rigidbody|collision|physics|game|simulation|godot)\b/i.test(msg) ||
      /\b(velocity|acceleration|force|torque|mesh|texture|shader)\b/i.test(msg)) {
    return 'simulation';
  }

  // Bazaar/Community patterns
  if (/\b(share|publish|fork|merge|bazaar|community|marketplace|rating|comment)\b/i.test(msg) ||
      /\b(millfile|download|upload|remix)\b/i.test(msg)) {
    return 'bazaar';
  }

  // Explanation patterns
  if (/\b(explain|what is|how does|mean|definition|concept|tutorial|learn)\b/i.test(msg) ||
      /\b(understand|clarify|describe|overview)\b/i.test(msg)) {
    return 'explanation';
  }

  // Creative patterns
  if (/\b(write|create|story|character|dialogue|narrative|creative|imagine)\b/i.test(msg) ||
      /\b(generate|design|invent)\b/i.test(msg)) {
    return 'creative';
  }

  // Analysis patterns
  if (/\b(analyze|compare|difference|pattern|trend|statistics|data)\b/i.test(msg) ||
      /\b(evaluate|assess|measure)\b/i.test(msg)) {
    return 'analysis';
  }

  return null; // Inconclusive, need AI classification
}

// ============================================================================
// Provider/Model Recommendations
// ============================================================================

/**
 * Get the recommended AI provider for a given intent.
 *
 * Maps intent categories to their optimal providers based on model
 * strengths and cost-effectiveness for that specific task type.
 *
 * ### Provider Selection Rationale
 *
 * | Intent | Provider | Reasoning |
 * |--------|----------|-----------|
 * | `code-help` | `anthropic` | Claude excels at code understanding and generation |
 * | `explanation` | `openai` | GPT-4 provides clear, educational explanations |
 * | `simulation` | `anthropic` | Claude's technical reasoning fits Godot/engine work |
 * | `bazaar` | `fast` | Metadata operations don't need premium models |
 * | `creative` | `openai` | GPT-4 has strong creative writing capabilities |
 * | `analysis` | `google` | Gemini offers efficient large-scale analysis |
 * | `general` | `openai` | Default to GPT-4o-mini for balanced cost/quality |
 *
 * ### Integration
 * The returned provider name should match a key in the multi-model-router's
 * `PROVIDERS` configuration.
 *
 * @param intent - The classified intent category
 * @returns Provider name string (key for PROVIDERS object)
 *
 * @example
 * ```ts
 * getRecommendedProvider('code-help')
 * // Returns: 'anthropic'
 *
 * getRecommendedProvider('creative')
 * // Returns: 'openai'
 * ```
 */
function getRecommendedProvider(intent: Intent): string {
  switch (intent) {
    case 'code-help':
      return 'anthropic';  // Claude excels at code
    case 'explanation':
      return 'openai';     // GPT-4 good at teaching
    case 'simulation':
      return 'anthropic';  // Claude for technical reasoning
    case 'bazaar':
      return 'fast';       // Use fast model for metadata
    case 'creative':
      return 'openai';     // GPT-4 for creativity
    case 'analysis':
      return 'google';     // Gemini for analysis
    default:
      return 'openai';
  }
}

/**
 * Get the recommended model for a given intent.
 *
 * Maps intent categories to specific model choices that balance
 * capability, speed, and cost for each task type.
 *
 * ### Model Selection Rationale
 *
 * | Intent | Model | Why This Model |
 * |--------|-------|----------------|
 * | `code-help` | `claude-3-5-sonnet` | Best code understanding, excellent context |
 * | `explanation` | `gpt-4o` | Clear teaching style, good for tutorials |
 * | `simulation` | `claude-3-5-sonnet` | Technical reasoning for Godot/physics |
 * | `bazaar` | `gpt-4o-mini` | Fast, cheap for metadata/community tasks |
 * | `creative` | `gpt-4o` | Strong creative writing capabilities |
 * | `analysis` | `gemini-1.5-pro` | Efficient for large-scale data analysis |
 * | `general` | `gpt-4o-mini` | Fast default for general queries |
 *
 * ### Model Availability
 * The returned model must be available in the provider's model list.
 * If a model is unavailable, the multi-model-router will fall back
 * to an alternative model from the same provider.
 *
 * @param intent - The classified intent category
 * @returns Model name string (must exist in provider's models array)
 *
 * @example
 * ```ts
 * getRecommendedModel('code-help')
 * // Returns: 'claude-3-5-sonnet'
 *
 * getRecommendedModel('bazaar')
 * // Returns: 'gpt-4o-mini' (fast/cheap for metadata)
 * ```
 */
function getRecommendedModel(intent: Intent): string {
  switch (intent) {
    case 'code-help':
      return 'claude-3-5-sonnet';
    case 'explanation':
      return 'gpt-4o';
    case 'simulation':
      return 'claude-3-5-sonnet';
    case 'bazaar':
      return 'gpt-4o-mini';  // Fast, cheap
    case 'creative':
      return 'gpt-4o';
    case 'analysis':
      return 'gemini-1.5-pro';
    default:
      return 'gpt-4o-mini';
  }
}

/**
 * Get reasoning for the recommendation
 */
function getReasoning(intent: Intent): string {
  switch (intent) {
    case 'code-help':
      return 'Code-related query optimized for Claude\'s code understanding';
    case 'explanation':
      return 'Educational content routed to GPT-4 for clear explanations';
    case 'simulation':
      return 'Godot/scene work routed to Claude for technical accuracy';
    case 'bazaar':
      return 'Community features can use fast models for metadata operations';
    case 'creative':
      return 'Creative task routed to GPT-4 for creative generation';
    case 'analysis':
      return 'Analysis task routed to Gemini for efficient processing';
    default:
      return 'General query routed to default provider';
  }
}

// ============================================================================
// AI Classification
// ============================================================================

/**
 * Use Workers AI to classify intent when keyword heuristics are inconclusive
 * Uses a fast, free model for quick classification
 */
async function classifyWithAI(ai: Ai, message: string): Promise<{ intent: Intent; confidence: number }> {
  const prompt = `Classify this user message into exactly one of these categories:
- code-help: code generation, debugging, refactoring, syntax errors
- explanation: asking what something means, tutorials, learning concepts
- simulation: Godot scenes, physics, game logic, nodes, meshes
- bazaar: sharing, forking, community features, marketplace
- creative: writing stories, creating characters, imaginative content
- analysis: data analysis, comparisons, patterns, statistics
- general: anything else

Message: "${message.substring(0, 500)}"

Respond with ONLY the category name, nothing else.`;

  try {
    const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      prompt,
      max_tokens: 20,
      temperature: 0.1, // Low temperature for consistent classification
    });

    const text = ((response as any).response || '').toLowerCase().trim();

    // Parse the response
    if (text.includes('code-help') || text.includes('code help')) {
      return { intent: 'code-help', confidence: 0.85 };
    }
    if (text.includes('explanation')) {
      return { intent: 'explanation', confidence: 0.85 };
    }
    if (text.includes('simulation')) {
      return { intent: 'simulation', confidence: 0.85 };
    }
    if (text.includes('bazaar')) {
      return { intent: 'bazaar', confidence: 0.85 };
    }
    if (text.includes('creative')) {
      return { intent: 'creative', confidence: 0.85 };
    }
    if (text.includes('analysis')) {
      return { intent: 'analysis', confidence: 0.85 };
    }

    return { intent: 'general', confidence: 0.7 };
  } catch (error) {
    console.error('[FirstMile] AI classification failed:', error);
    return { intent: 'general', confidence: 0.5 };
  }
}

// ============================================================================
// Cache Handling
// ============================================================================

/**
 * Get cache key for classification
 */
function getCacheKey(message: string): string {
  // Simple hash of message content
  const normalized = message.toLowerCase().trim().slice(0, 200);
  return `intent:${btoa(normalized).slice(0, 32)}`;
}

/**
 * Get cached classification if available
 */
async function getCachedClassification(
  cache: KVNamespace | undefined,
  message: string
): Promise<ClassificationResponse | null> {
  if (!cache) return null;

  try {
    const cached = await cache.get(getCacheKey(message), 'json');
    return cached as ClassificationResponse | null;
  } catch {
    return null;
  }
}

/**
 * Cache classification result
 */
async function setCachedClassification(
  cache: KVNamespace | undefined,
  message: string,
  result: ClassificationResponse
): Promise<void> {
  if (!cache) return;

  try {
    const ttl = result.suggestedCacheTtl || 3600; // Default 1 hour
    await cache.put(getCacheKey(message), JSON.stringify(result), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error('[FirstMile] Cache write failed:', error);
  }
}

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
  return new Response(
    JSON.stringify({
      status: 'healthy',
      service: 'first-mile-router',
      version: '1.0.0',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// Intent classification endpoint
router.post('/classify', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as ClassificationRequest;
  const { message, context: _context } = body;

  if (!message || typeof message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Invalid message' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Check cache first
  const cached = await getCachedClassification(env.CLASSIFICATION_CACHE, message);
  if (cached) {
    return new Response(JSON.stringify({ ...cached, cached: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Try keyword classification first (fast, free)
  let intent = classifyByKeywords(message);
  let confidence = 0.9; // High confidence for keyword matches
  let usedAI = false;

  // Fall back to AI classification if keywords inconclusive
  if (!intent) {
    const result = await classifyWithAI(env.AI, message);
    intent = result.intent;
    confidence = result.confidence;
    usedAI = true;
  }

  // Build response
  const response: ClassificationResponse = {
    intent,
    recommendedProvider: getRecommendedProvider(intent),
    recommendedModel: getRecommendedModel(intent),
    confidence,
    reasoning: getReasoning(intent),
    bypassRouter: intent === 'bazaar', // Bazaar can bypass full LLM call
    suggestedCacheTtl: intent === 'bazaar' ? 86400 : 3600, // 24h for bazaar, 1h for others
  };

  // Cache the result
  await setCachedClassification(env.CLASSIFICATION_CACHE, message, response);

  return new Response(JSON.stringify({ ...response, cached: false, usedAI }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Batch classification endpoint (for multiple messages)
router.post('/classify-batch', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as { messages: string[] };
  const { messages } = body;

  if (!Array.isArray(messages)) {
    return new Response(
      JSON.stringify({ error: 'Expected messages array' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const results = await Promise.all(
    messages.map(async (message) => {
      // Check cache first
      const cached = await getCachedClassification(env.CLASSIFICATION_CACHE, message);
      if (cached) {
        return { message, ...cached, cached: true };
      }

      // Keyword classification
      let intent = classifyByKeywords(message);
      let confidence = 0.9;
      let usedAI = false;

      if (!intent) {
        const result = await classifyWithAI(env.AI, message);
        intent = result.intent;
        confidence = result.confidence;
        usedAI = true;
      }

      const response: ClassificationResponse = {
        intent,
        recommendedProvider: getRecommendedProvider(intent),
        recommendedModel: getRecommendedModel(intent),
        confidence,
        reasoning: getReasoning(intent),
        bypassRouter: intent === 'bazaar',
        suggestedCacheTtl: intent === 'bazaar' ? 86400 : 3600,
      };

      // Cache result
      await setCachedClassification(env.CLASSIFICATION_CACHE, message, response);

      return { message, ...response, cached: false, usedAI };
    })
  );

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get available intents
router.get('/intents', () => {
  return new Response(
    JSON.stringify({
      intents: [
        { value: 'code-help', description: 'Code generation, debugging, refactoring' },
        { value: 'explanation', description: 'Concept explanation, tutorials' },
        { value: 'simulation', description: 'Godot scene work, physics, game logic' },
        { value: 'bazaar', description: 'Community features, sharing, forking' },
        { value: 'creative', description: 'Creative writing, storytelling' },
        { value: 'analysis', description: 'Data analysis, pattern recognition' },
        { value: 'general', description: 'Fallback to default provider' },
      ],
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// Get provider recommendations
router.get('/recommendations', () => {
  return new Response(
    JSON.stringify({
      providers: [
        { intent: 'code-help', provider: 'anthropic', model: 'claude-3-5-sonnet', reason: 'Best for code' },
        { intent: 'explanation', provider: 'openai', model: 'gpt-4o', reason: 'Good at teaching' },
        { intent: 'simulation', provider: 'anthropic', model: 'claude-3-5-sonnet', reason: 'Technical reasoning' },
        { intent: 'bazaar', provider: 'fast', model: 'gpt-4o-mini', reason: 'Fast metadata ops' },
        { intent: 'creative', provider: 'openai', model: 'gpt-4o', reason: 'Creative generation' },
        { intent: 'analysis', provider: 'google', model: 'gemini-1.5-pro', reason: 'Efficient analysis' },
        { intent: 'general', provider: 'openai', model: 'gpt-4o-mini', reason: 'Default choice' },
      ],
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router
      .handle(request, env, ctx)
      .catch((err) => {
        console.error('[FirstMile] Error:', err);
        return new Response(
          JSON.stringify({ error: err.message || 'Internal error' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      });
  },
};
