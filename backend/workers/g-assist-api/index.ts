/**
 * G-Assist API Worker
 *
 * Voice-enabled AI assistant for StudyLoG.AI.
 * Routes intents to appropriate agents and handles chat interactions.
 *
 * Deploy to: wrangler publish
 */

import { Router } from 'itty-router';

// ============================================================================
// Environment Types
// ============================================================================

export interface Env {
  // Workers AI binding
  AI: Ai;

  // KV Namespaces
  ASSISTANT_CACHE?: KVNamespace;
  RATE_LIMITS?: KVNamespace;

  // D1 Database for conversation history
  CONVERSATIONS?: D1Database;

  // Multi-model router endpoint
  MULTI_MODEL_ROUTER_URL?: string;

  // First-mile router endpoint
  FIRST_MILE_ROUTER_URL?: string;

  // MCP Router endpoint (for tool calls)
  MCP_ROUTER_URL?: string;

  // API Keys
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;

  // MCP Server API Keys
  BRAVE_API_KEY?: string;
  SERPER_API_KEY?: string;
  GITHUB_TOKEN?: string;
}

// ============================================================================
// Types
// ============================================================================

type StudyLogAgent =
  | 'captain'    // Director agent - orchestration
  | 'teacher'    // Learning agent - explanations
  | 'builder'    // Code agent - implementation
  | 'tester'     // QA agent - testing
  | 'director';  // AI Director - high-level guidance

interface RouteRequest {
  message: string;
  context?: {
    module?: string;
    studentId?: string;
  };
}

interface RouteResponse {
  agent: StudyLogAgent;
  confidence: number;
  reasoning: string;
  suggestedModel: string;
}

interface ChatRequest {
  agent: StudyLogAgent;
  messages: Array<{ role: string; content: string }>;
  context?: {
    module?: string;
    studentId?: string;
    scene?: string;
  };
  model?: string;
  temperature?: number;
}

interface ChatResponse {
  content: string;
  agent: StudyLogAgent;
  model: string;
  provider: string;
  tokens?: { input: number; output: number };
}

interface STTRequest {
  audio?: string; // base64 encoded audio
  format?: 'wav' | 'mp3' | 'webm';
}

interface STTResponse {
  text: string;
  confidence: number;
  language: string;
  note: string;
}

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

interface TTSResponse {
  audio?: string;
  url?: string;
  format: string;
  note: string;
}

// ============================================================================
// Conversation Persistence Types
// ============================================================================

/**
 * Request to create or update a conversation.
 *
 * The upsert pattern (INSERT OR REPLACE) allows a single endpoint to handle
 * both creating new conversations and updating existing ones. If a conversation
 * with the given ID exists, it will be replaced entirely; otherwise, a new one
 * is created.
 */
interface ConversationUpsertRequest {
  id?: string;                    // Omit for auto-generated UUID
  userId: string;                 // Student ID or OAuth user ID
  agent: StudyLogAgent;           // Agent handling this conversation
  title?: string;                 // Optional title (auto-generated if omitted)
  messages: Array<{               // Full message history
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
    agent?: StudyLogAgent;
  }>;
  context?: {                     // IDE context when conversation started
    module?: string;
    scene?: string;
    openFiles?: string[];
    currentSelection?: {
      file: string;
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
}

/**
 * Response from conversation upsert operation.
 */
interface ConversationUpsertResponse {
  conversationId: string;
  updatedAt: number;
  title?: string;  // Returns generated title if not provided
}

/**
 * Summary representation of a conversation for list views.
 * Excludes the full messages array for lighter payloads.
 */
interface ConversationSummary {
  id: string;
  title: string;
  agent: StudyLogAgent;
  messageCount: number;
  updatedAt: number;
  createdAt: number;
}

/**
 * Full conversation details with all messages.
 */
interface ConversationDetail extends ConversationSummary {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    agent?: StudyLogAgent;
  }>;
  context?: {
    module?: string;
    scene?: string;
    openFiles?: string[];
    currentSelection?: {
      file: string;
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
}

/**
 * Response for listing user's conversations.
 */
interface ConversationsListResponse {
  conversations: ConversationSummary[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default temperature for LLM requests */
const DEFAULT_TEMPERATURE = 0.7;

/** Maximum tokens for LLM responses */
const MAX_TOKENS = 2048;

/** Cache TTL in seconds (5 minutes) */
const CACHE_TTL_SECONDS = 300;

/** Maximum conversation title length in characters */
const MAX_TITLE_LENGTH = 50;

/** Maximum conversations to return in list */
const MAX_CONVERSATIONS_LIST_SIZE = 100;

/** Cache key prefix for G-Assist responses */
const CACHE_KEY_PREFIX = 'gassist:';

/** Cache key maximum length after base64 encoding */
const CACHE_KEY_MAX_LENGTH = 64;

/** Fallback timestamp interval in milliseconds (1 minute) */
const FALLBACK_TIMESTAMP_INTERVAL_MS = 60000;

// ============================================================================
// Confidence Thresholds
// ============================================================================

/** High confidence threshold for intent classification */
const CONFIDENCE_HIGH = 0.9;

/** Medium-high confidence threshold for intent classification */
const CONFIDENCE_MEDIUM_HIGH = 0.85;

/** Medium confidence threshold for intent classification */
const CONFIDENCE_MEDIUM = 0.8;

/** Low confidence threshold (default fallback) */
const CONFIDENCE_LOW = 0.5;

// ============================================================================
// Agent Configuration
// ============================================================================

const AGENT_CONFIG: Record<StudyLogAgent, {
  model: string;
  systemPrompt: string;
  description: string;
}> = {
  captain: {
    model: 'claude-3-5-sonnet',
    systemPrompt: 'You are the Captain agent, orchestrating the learner\'s journey through StudyLoG.AI. You guide decisions, assign tasks, and coordinate other agents.',
    description: 'Orchestration and decision-making',
  },
  teacher: {
    model: 'gpt-4o',
    systemPrompt: 'You are the Teacher agent, specializing in clear explanations and tutorials. You break down complex concepts into understandable parts.',
    description: 'Learning and explanations',
  },
  builder: {
    model: 'claude-3-5-sonnet',
    systemPrompt: 'You are the Builder agent, specializing in code implementation and technical solutions. You write clean, documented code.',
    description: 'Code and implementation',
  },
  tester: {
    model: 'gpt-4o-mini',
    systemPrompt: 'You are the Tester agent, specializing in quality assurance and finding edge cases. You think critically about potential failures.',
    description: 'Testing and QA',
  },
  director: {
    model: 'claude-opus-4-5',
    systemPrompt: 'You are the Director agent, providing high-level guidance on architecture and design patterns. You see the big picture.',
    description: 'High-level architecture guidance',
  },
};

// ============================================================================
// Intent to Agent Mapping
// ============================================================================

/**
 * Map first-mile-router intent to StudyLoG agent
 *
 * This function translates intent classifications from the first-mile-router
 * into specific agent assignments with confidence scores. Each mapping includes
 * a reasoning string that explains why the intent was routed to that agent.
 */
function intentToAgent(intent: string): { agent: StudyLogAgent; confidence: number; reasoning: string } {
  switch (intent) {
    case 'code-help':
      return {
        agent: 'builder',
        confidence: CONFIDENCE_HIGH,
        reasoning: 'Code-related query routed to Builder agent for implementation',
      };
    case 'explanation':
      return {
        agent: 'teacher',
        confidence: CONFIDENCE_HIGH,
        reasoning: 'Educational query routed to Teacher agent for learning',
      };
    case 'simulation':
      return {
        agent: 'builder',
        confidence: CONFIDENCE_MEDIUM_HIGH,
        reasoning: 'Simulation/Godot work routed to Builder for technical implementation',
      };
    case 'bazaar':
      return {
        agent: 'captain',
        confidence: CONFIDENCE_MEDIUM,
        reasoning: 'Community features routed to Captain for orchestration',
      };
    case 'analysis':
      return {
        agent: 'tester',
        confidence: CONFIDENCE_MEDIUM_HIGH,
        reasoning: 'Analysis task routed to Tester for critical evaluation',
      };
    case 'creative':
      return {
        agent: 'director',
        confidence: CONFIDENCE_MEDIUM,
        reasoning: 'Creative task routed to Director for big-picture thinking',
      };
    default:
      return {
        agent: 'teacher',
        confidence: CONFIDENCE_LOW,
        reasoning: 'General query routed to Teacher as default',
      };
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
      service: 'g-assist-api',
      version: '1.0.0',
      agents: Object.keys(AGENT_CONFIG),
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// POST /route - Intent classification and agent routing
router.post('/route', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as RouteRequest;
  const { message, context } = body;

  if (!message || typeof message !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Invalid message' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let agent: StudyLogAgent;
    let confidence: number;
    let reasoning: string;
    let usedFirstMile = false;

    // Try first-mile-router if configured
    if (env.FIRST_MILE_ROUTER_URL) {
      try {
        const classifyResponse = await fetch(`${env.FIRST_MILE_ROUTER_URL}/classify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, context }),
        });

        if (classifyResponse.ok) {
          const classification = await classifyResponse.json() as { intent?: string; confidence?: number; reasoning?: string };
          const mapping = intentToAgent(classification.intent || 'general');
          agent = mapping.agent;
          confidence = classification.confidence ?? mapping.confidence;
          reasoning = classification.reasoning || mapping.reasoning;
          usedFirstMile = true;
        } else {
          throw new Error('First-mile router failed');
        }
      } catch {
        // Fallback to local keyword-based classification
        const mapping = classifyByKeywords(message);
        agent = mapping.agent;
        confidence = mapping.confidence;
        reasoning = mapping.reasoning;
      }
    } else {
      // Local classification only
      const mapping = classifyByKeywords(message);
      agent = mapping.agent;
      confidence = mapping.confidence;
      reasoning = mapping.reasoning;
    }

    const response: RouteResponse = {
      agent,
      confidence,
      reasoning,
      suggestedModel: AGENT_CONFIG[agent].model,
    };

    return new Response(
      JSON.stringify({ ...response, usedFirstMile }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] Route error:', error);
    return new Response(
      JSON.stringify({ error: 'Routing failed' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Local keyword-based classification as fallback
 *
 * This function serves as a fallback when the first-mile-router is unavailable.
 * It uses regex patterns to detect keywords in the user's message and routes
 * to the appropriate agent based on those patterns.
 *
 * Classification order matters: more specific patterns are checked first,
 * with the Teacher agent as the default fallback.
 */
function classifyByKeywords(message: string): { agent: StudyLogAgent; confidence: number; reasoning: string } {
  const normalizedMessage = message.toLowerCase();

  // Code patterns -> Builder
  // Matches programming keywords and language names
  const codePattern = /\b(function|class|const|let|var|import|export|debug|error|bug|refactor|syntax|compile|build)\b/i;
  const languagePattern = /\b(code|typescript|javascript|python|gdscript|godot)\b/i;
  if (codePattern.test(normalizedMessage) || languagePattern.test(normalizedMessage)) {
    return {
      agent: 'builder',
      confidence: CONFIDENCE_MEDIUM_HIGH,
      reasoning: 'Code keywords detected, routing to Builder agent',
    };
  }

  // Learning patterns -> Teacher
  // Matches words indicating a desire for explanation or understanding
  const learningPattern = /\b(explain|what is|how does|mean|definition|concept|tutorial|learn|understand)\b/i;
  if (learningPattern.test(normalizedMessage)) {
    return {
      agent: 'teacher',
      confidence: CONFIDENCE_HIGH,
      reasoning: 'Learning keywords detected, routing to Teacher agent',
    };
  }

  // Testing patterns -> Tester
  // Matches words related to verification and quality assurance
  const testingPattern = /\b(test|verify|check|validate|assert|debug|error|fail|broken)\b/i;
  if (testingPattern.test(normalizedMessage)) {
    return {
      agent: 'tester',
      confidence: CONFIDENCE_MEDIUM_HIGH,
      reasoning: 'Testing keywords detected, routing to Tester agent',
    };
  }

  // Architecture patterns -> Director
  // Matches words related to high-level design and structure
  const architecturePattern = /\b(architecture|design pattern|structure|organize|plan|strategy)\b/i;
  if (architecturePattern.test(normalizedMessage)) {
    return {
      agent: 'director',
      confidence: CONFIDENCE_MEDIUM,
      reasoning: 'Architecture keywords detected, routing to Director agent',
    };
  }

  // Orchestration patterns -> Captain
  // Matches words related to task management and coordination
  const orchestrationPattern = /\b(assign|task|coordinate|orchestrat|manage|workflow)\b/i;
  if (orchestrationPattern.test(normalizedMessage)) {
    return {
      agent: 'captain',
      confidence: CONFIDENCE_MEDIUM_HIGH,
      reasoning: 'Orchestration keywords detected, routing to Captain agent',
    };
  }

  // Default to Teacher when no specific pattern is detected
  return {
    agent: 'teacher',
    confidence: CONFIDENCE_LOW,
    reasoning: 'No specific pattern detected, routing to default Teacher agent',
  };
}

// POST /chat - Send message to agent
router.post('/chat', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as ChatRequest;
  const { agent, messages, context, model, temperature = DEFAULT_TEMPERATURE } = body;

  if (!agent || !messages) {
    return new Response(
      JSON.stringify({ error: 'Missing agent or messages' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const agentConfig = AGENT_CONFIG[agent];
  if (!agentConfig) {
    return new Response(
      JSON.stringify({ error: `Unknown agent: ${agent}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const targetModel = model || agentConfig.model;

    // Check cache first
    const cacheKey = getCacheKey(agent, messages);
    if (env.ASSISTANT_CACHE) {
      const cached = await env.ASSISTANT_CACHE.get(cacheKey, 'json');
      if (cached) {
        return new Response(
          JSON.stringify({ ...cached, cached: true }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Call multi-model-router if configured, otherwise call directly
    let content: string;
    let usedModel = targetModel;
    let provider = 'cloudflare';

    if (env.MULTI_MODEL_ROUTER_URL) {
      const chatResponse = await fetch(`${env.MULTI_MODEL_ROUTER_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system', content: agentConfig.systemPrompt },
            ...messages,
          ],
          temperature,
          max_tokens: MAX_TOKENS,
        }),
      });

      if (!chatResponse.ok) {
        throw new Error('Multi-model router failed');
      }

      const data = await chatResponse.json() as ChatResponse;
      content = data.content;
      usedModel = data.model;
      provider = data.provider;
    } else {
      // Direct call to Workers AI
      const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: agentConfig.systemPrompt },
          ...messages,
        ],
        max_tokens: MAX_TOKENS,
        temperature,
      });

      content = ((response as any).response || '');
      usedModel = 'llama-3.3-70b';
    }

    const responseData: ChatResponse = {
      content,
      agent,
      model: usedModel,
      provider,
    };

    // Cache response
    if (env.ASSISTANT_CACHE && content) {
      await env.ASSISTANT_CACHE.put(cacheKey, JSON.stringify(responseData), {
        expirationTtl: CACHE_TTL_SECONDS,
      });
    }

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] Chat error:', error);
    return new Response(
      JSON.stringify({ error: 'Chat processing failed', details: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function getCacheKey(agent: string, messages: Array<{ role: string; content: string }>): string {
  const key = JSON.stringify({ agent, messages });
  return `${CACHE_KEY_PREFIX}${btoa(key).slice(0, CACHE_KEY_MAX_LENGTH)}`;
}

// POST /stt - Speech-to-text (stub)
router.post('/stt', async (req) => {
  const _body = (await req.json()) as STTRequest;

  // Stub response for now - audio capture not implemented
  const response: STTResponse = {
    text: '[Audio transcription not yet implemented]',
    confidence: 0,
    language: 'en',
    note: 'STT endpoint is a stub. Audio capture will be implemented with browser MediaRecorder API.',
  };

  return new Response(
    JSON.stringify(response),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// POST /tts - Text-to-speech (stub)
router.post('/tts', async (req) => {
  const body = (await req.json()) as TTSRequest;
  const { text } = body;

  if (!text) {
    return new Response(
      JSON.stringify({ error: 'Missing text' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Stub response for now - TTS not implemented
  const response: TTSResponse = {
    format: 'mp3',
    note: 'TTS endpoint is a stub. Audio synthesis will use Workers AI TTS or browser SpeechSynthesis API.',
  };

  return new Response(
    JSON.stringify(response),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// GET /agents - List available agents
router.get('/agents', () => {
  const agents = Object.entries(AGENT_CONFIG).map(([name, config]) => ({
    name,
    model: config.model,
    description: config.description,
  }));

  return new Response(
    JSON.stringify({ agents }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});

// ============================================================================
// MCP (Model Context Protocol) Integration Routes
// ============================================================================

/**
 * MCP Tool Types
 *
 * These types define the interface between G-Assist agents and MCP tools.
 * Agents can request tools to be called on their behalf, with the router
 * handling selection, execution, and cost tracking.
 */

interface MCPToolRequest {
  /** User query or tool description */
  query: string;
  /** Agent making the request */
  agentId: StudyLogAgent;
  /** User ID for cost tracking */
  userId?: string;
  /** User tier (affects budget limits) */
  userTier?: 'free' | 'forge' | 'studio' | 'lab';
  /** Preferred server (optional) */
  preferredServerId?: string;
  /** Preferred tool (optional) */
  preferredToolName?: string;
  /** Maximum cost category */
  maxCostCategory?: 'free' | 'low' | 'medium' | 'high';
}

interface MCPToolResponse {
  /** Tool result data */
  data: unknown;
  /** Tool that was called */
  toolName: string;
  /** Server that handled the call */
  serverId: string;
  /** Cost information */
  cost: {
    latencyMs: number;
    estimatedTokens: number;
    directCost: number;
    costCategory: 'free' | 'low' | 'medium' | 'high';
  };
  /** Whether result was cached */
  cached: boolean;
  /** Response timestamp */
  timestamp: number;
}

interface MCPListToolsResponse {
  /** Available tools across all MCP servers */
  tools: Array<{
    name: string;
    serverId: string;
    description: string;
    costCategory: 'free' | 'low' | 'medium' | 'high';
    latencyMs: number;
  }>;
}

interface MCPServerStatusResponse {
  /** Server status by ID */
  servers: Record<string, {
    name: string;
    status: 'connected' | 'disconnected' | 'error';
    avgLatency: number;
    errorRate: number;
  }>;
}

interface MCPSessionCostsResponse {
  /** Session cost tracking for user */
  totalCost: number;
  totalTokens: number;
  totalLatency: number;
  toolCalls: Record<string, number>;
  serverCalls: Record<string, number>;
  costByCategory: Record<string, number>;
}

/**
 * POST /mcp/tools/call - Route and execute an MCP tool call
 *
 * This endpoint allows G-Assist agents to request tool execution through
 * the MCP router. The router handles:
 *
 * 1. **Intent Classification**: Understanding what the agent wants
 * 2. **Tool Discovery**: Finding available tools across MCP servers
 * 3. **Tool Selection**: Choosing the best tool based on cost and capability
 * 4. **Execution**: Calling the tool with error handling and retries
 * 5. **Cost Tracking**: Monitoring usage against user budgets
 *
 * ### How MCP Extends Agent Capabilities
 *
 * Without MCP, agents are limited to:
 * - LLM text generation
 * - Built-in tools only
 *
 * With MCP, agents can:
 * - Search the web (Brave Search, Serper)
 * - Query databases (PostgreSQL, MySQL, SQLite)
 * - Access files (filesystem)
 * - Interact with GitHub (issues, PRs, forks)
 * - Use any MCP-compatible tool
 *
 * ### Cost Implications of MCP Calls
 *
 * Each MCP call adds:
 * - **Network latency**: 50-500ms for round-trip
 * - **Token usage**: Tool results become input tokens
 * - **Direct costs**: Some APIs charge per call
 * - **Budget tracking**: Enforced per user/session
 *
 * ### Agent Usage Example
 *
 * ```typescript
 * // Agent requests web search
 * const response = await fetch('/g-assist-api/mcp/tools/call', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     query: 'search for latest AI news',
 *     agentId: 'teacher',
 *     userId: 'user123',
 *     userTier: 'forge',
 *   }),
 * });
 *
 * // Router selects Brave Search or Serper
 * // Returns results with cost metadata
 * ```
 *
 * ### Integration with G-Assist Agent Flow
 *
 * ```
 * User Query → Agent → Needs external data?
 *                    ↓ Yes
 *              POST /mcp/tools/call
 *                    ↓
 *              MCP Router → Tool Selection → Execution
 *                    ↓
 *              Agent receives results with context
 *                    ↓
 *              Agent uses results in response to user
 * ```
 *
 * @see /mnt/c/cognitivemill/studylog-github/backend/workers/mcp-router
 */
router.post('/mcp/tools/call', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as MCPToolRequest;
  const { query, agentId, userId, userTier, preferredServerId, preferredToolName, maxCostCategory } = body;

  // Validate required fields
  if (!query || !agentId) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: query, agentId' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Check if MCP router is configured
  if (!env.MCP_ROUTER_URL) {
    return new Response(
      JSON.stringify({
        error: 'MCP router not configured',
        note: 'Set MCP_ROUTER_URL in worker environment to enable MCP tools'
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Forward request to MCP router
    const mcpResponse = await fetch(`${env.MCP_ROUTER_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        agentId,
        userId,
        userTier,
        preferredServerId,
        preferredToolName,
        maxCostCategory,
      }),
    });

    if (!mcpResponse.ok) {
      const errorText = await mcpResponse.text();
      throw new Error(`MCP router error: ${mcpResponse.status} - ${errorText}`);
    }

    const result = await mcpResponse.json() as MCPToolResponse;

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] MCP tool call error:', error);
    return new Response(
      JSON.stringify({
        error: 'MCP tool call failed',
        details: (error as Error).message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * GET /mcp/tools - List available MCP tools
 *
 * Returns all available tools from connected MCP servers.
 * Agents can use this to discover what tools are available.
 *
 * ### Agent Usage
 *
 * Agents can query available tools to:
 * - Discover capabilities before making requests
 * - Present tool options to users
 * - Debug tool availability issues
 */
router.get('/mcp/tools', async (req) => {
  const env = req.env as Env;

  if (!env.MCP_ROUTER_URL) {
    return new Response(
      JSON.stringify({ tools: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const mcpResponse = await fetch(`${env.MCP_ROUTER_URL}/tools`, {
      method: 'GET',
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP router error: ${mcpResponse.status}`);
    }

    const result = await mcpResponse.json() as MCPListToolsResponse;

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] MCP tools list error:', error);
    return new Response(
      JSON.stringify({ tools: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * GET /mcp/servers - Get MCP server status
 *
 * Returns the connection status and health metrics for all MCP servers.
 * Useful for monitoring and debugging.
 */
router.get('/mcp/servers', async (req) => {
  const env = req.env as Env;

  if (!env.MCP_ROUTER_URL) {
    return new Response(
      JSON.stringify({ servers: {} }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const mcpResponse = await fetch(`${env.MCP_ROUTER_URL}/servers`, {
      method: 'GET',
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP router error: ${mcpResponse.status}`);
    }

    const result = await mcpResponse.json() as MCPServerStatusResponse;

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] MCP servers status error:', error);
    return new Response(
      JSON.stringify({ servers: {} }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * GET /mcp/costs/:userId - Get session costs for a user
 *
 * Returns cost tracking information for a user's MCP tool usage.
 * Useful for budget tracking and cost transparency.
 */
router.get('/mcp/costs/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.param?.userId;

  if (!env.MCP_ROUTER_URL) {
    return new Response(
      JSON.stringify({
        totalCost: 0,
        totalTokens: 0,
        totalLatency: 0,
        toolCalls: {},
        serverCalls: {},
        costByCategory: {},
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const mcpResponse = await fetch(`${env.MCP_ROUTER_URL}/costs/${userId}`, {
      method: 'GET',
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP router error: ${mcpResponse.status}`);
    }

    const result = await mcpResponse.json() as MCPSessionCostsResponse;

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] MCP costs error:', error);
    return new Response(
      JSON.stringify({
        totalCost: 0,
        totalTokens: 0,
        totalLatency: 0,
        toolCalls: {},
        serverCalls: {},
        costByCategory: {},
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ============================================================================
// Conversation Persistence Routes
// ============================================================================

/**
 * POST /conversations - Create or update a conversation
 *
 * Uses the upsert pattern (INSERT OR REPLACE) to handle both:
 * 1. Creating new conversations (when id is omitted)
 * 2. Updating existing conversations (when id is provided)
 *
 * The upsert pattern is ideal here because:
 * - Single endpoint handles both cases
 * - Atomic operation (no race conditions)
 * - Simple error handling
 * - Perfect for "save after each message" pattern
 */
router.post('/conversations', async (req) => {
  const env = req.env as Env;
  const body = (await req.json()) as ConversationUpsertRequest;
  const { id, userId, agent, title, messages, context } = body;

  // Validate required fields
  if (!userId || !agent || !messages) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: userId, agent, messages' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (!env.CONVERSATIONS) {
    return new Response(
      JSON.stringify({ error: 'Conversations database not available' }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const now = Date.now();
    const conversationId = id || crypto.randomUUID();

    // Generate title from first user message if not provided
    // Title generation strategy: first 50 chars of first user message
    // Truncated at word boundary to avoid cutting mid-word
    const generatedTitle = title || generateConversationTitle(messages);

    // Ensure all messages have timestamps
    // Fallback strategy: assign timestamps assuming 1-minute intervals between messages
    const messagesWithTimestamps = messages.map((msg, idx) => ({
      ...msg,
      timestamp: msg.timestamp || (now - (messages.length - idx) * FALLBACK_TIMESTAMP_INTERVAL_MS),
    }));

    // Upsert using INSERT OR REPLACE
    // This will replace the entire row if id exists, or insert new if not
    const stmt = env.CONVERSATIONS.prepare(`
      INSERT OR REPLACE INTO conversations (
        id, user_id, agent, title, messages, context, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // For updates, preserve original created_at
    let createdAt = now;
    if (id) {
      const existing = await env.CONVERSATIONS.prepare(
        'SELECT created_at FROM conversations WHERE id = ?'
      ).bind(id).first<{ created_at: number }>();
      if (existing) {
        createdAt = existing.created_at;
      }
    }

    await stmt.bind(
      conversationId,
      userId,
      agent,
      generatedTitle,
      JSON.stringify(messagesWithTimestamps),
      context ? JSON.stringify(context) : null,
      createdAt,
      now
    ).run();

    const response: ConversationUpsertResponse = {
      conversationId,
      updatedAt: now,
      title: generatedTitle,
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] Conversation upsert error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save conversation', details: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * GET /conversations/:userId - List user's conversations
 *
 * Returns a summary list of conversations sorted by most recently updated.
 * The index on (user_id) and (updated_at DESC) makes this query efficient.
 *
 * Response excludes full messages to keep payload light for list views.
 */
router.get('/conversations/:userId', async (req) => {
  const env = req.env as Env;
  const userId = req.params?.userId as string;

  if (!env.CONVERSATIONS) {
    return new Response(
      JSON.stringify({ error: 'Conversations database not available' }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Query conversations sorted by most recently updated
    // The idx_conversations_updated_at index enables efficient DESC sorting
    const result = await env.CONVERSATIONS.prepare(`
      SELECT
        id,
        title,
        agent,
        messages,
        created_at,
        updated_at
      FROM conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT ${MAX_CONVERSATIONS_LIST_SIZE}
    `).bind(userId).all<{ id: string; title: string; agent: string; messages: string; created_at: number; updated_at: number }>();

    const conversations: ConversationSummary[] = result.results.map((row) => {
      // Parse messages to count them without returning full array
      const parsedMessages = JSON.parse(row.messages) as Array<{ role: string; content: string }>;

      return {
        id: row.id,
        title: row.title,
        agent: row.agent as StudyLogAgent,
        messageCount: parsedMessages.length,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const response: ConversationsListResponse = { conversations };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] Conversation list error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to list conversations', details: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * GET /conversations/:userId/:id - Get full conversation details
 *
 * Returns complete conversation with all messages and context.
 * Used when user opens a specific conversation from the list.
 */
router.get('/conversations/:userId/:id', async (req) => {
  const env = req.env as Env;
  const userId = req.params?.userId as string;
  const id = req.params?.id as string;

  if (!env.CONVERSATIONS) {
    return new Response(
      JSON.stringify({ error: 'Conversations database not available' }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const row = await env.CONVERSATIONS.prepare(`
      SELECT
        id,
        user_id,
        agent,
        title,
        messages,
        context,
        created_at,
        updated_at
      FROM conversations
      WHERE id = ? AND user_id = ?
    `).bind(id, userId).first<{
      id: string;
      user_id: string;
      agent: string;
      title: string;
      messages: string;
      context: string | null;
      created_at: number;
      updated_at: number;
    }>();

    if (!row) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const parsedMessages = JSON.parse(row.messages) as Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: number;
      agent?: StudyLogAgent;
    }>;

    const conversation: ConversationDetail = {
      id: row.id,
      title: row.title,
      agent: row.agent as StudyLogAgent,
      messages: parsedMessages,
      messageCount: parsedMessages.length,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      context: row.context ? JSON.parse(row.context) : undefined,
    };

    return new Response(
      JSON.stringify(conversation),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] Conversation load error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to load conversation', details: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * DELETE /conversations/:userId/:id - Delete a conversation
 *
 * Permanently removes a conversation from history.
 */
router.delete('/conversations/:userId/:id', async (req) => {
  const env = req.env as Env;
  const userId = req.params?.userId as string;
  const id = req.params?.id as string;

  if (!env.CONVERSATIONS) {
    return new Response(
      JSON.stringify({ error: 'Conversations database not available' }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const result = await env.CONVERSATIONS.prepare(`
      DELETE FROM conversations WHERE id = ? AND user_id = ?
    `).bind(id, userId).run();

    if (!result.success || result.meta.changes === 0) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, deletedId: id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[G-Assist] Conversation delete error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete conversation', details: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a conversation title from the first user message.
 *
 * Strategy:
 * 1. Find the first user message (not system or assistant)
 * 2. Take first MAX_TITLE_LENGTH characters
 * 3. Truncate at last complete word within limit
 * 4. Append ellipsis if truncated
 *
 * Example:
 *   "Help me understand how neural networks learn from training data"
 *   -> "Help me understand how neural networks learn..."
 *
 * This creates meaningful, human-readable titles without requiring user input.
 */
function generateConversationTitle(
  messages: Array<{ role: string; content: string }>
): string {
  // Find first user message
  const firstUserMessage = messages.find((msg) => msg.role === 'user');

  if (!firstUserMessage || !firstUserMessage.content) {
    return 'New Conversation';
  }

  const content = firstUserMessage.content.trim();

  if (content.length <= MAX_TITLE_LENGTH) {
    return content;
  }

  // Truncate at word boundary
  // Find the last space within the limit
  const truncated = content.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + '...';
  }

  // No space found, force truncate
  return truncated + '...';
}

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router
      .handle(request, env, ctx)
      .catch((err) => {
        console.error('[G-Assist] Error:', err);
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
