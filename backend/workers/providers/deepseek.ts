/**
 * DeepSeek Provider Implementation
 *
 * DeepSeek is a Chinese AI research company focused on cost-effective, high-performance models.
 * Their API is OpenAI-compatible, making integration seamless.
 *
 * ### Why DeepSeek is Cost-Optimized
 *
 * DeepSeek offers the lowest commercial pricing among major LLM providers:
 * - **Input**: $0.14 per 1M tokens (vs OpenAI's $2.50-15 for GPT-4)
 * - **Output**: $0.28 per 1M tokens (vs OpenAI's $10-60 for GPT-4)
 * - **Reasoner**: $0.55 input / $2.19 output (includes thinking tokens)
 *
 * For comparison, DeepSeek is ~17x cheaper than OpenAI and ~2-5x cheaper than other
 * low-cost options like Groq or Together AI. This makes it ideal for:
 * - High-volume applications (chatbots, code assistants)
 * - Cost-sensitive MVPs and prototypes
 * - Batch processing and background tasks
 * - Educational environments with limited budgets
 *
 * ### Model Selection Guide
 *
 * | Model | Context | Best For | Cost | Speed |
 * |-------|---------|----------|------|-------|
 * | **deepseek-chat** | 64K | General purpose, explanations, tutorials | $0.14/$0.28 | Fast |
 * | **deepseek-coder** | 16K | Code generation, debugging, refactoring | $0.14/$0.28 | Fastest |
 * | **deepseek-reasoner** | 64K | Complex reasoning, planning, multi-step tasks | $0.55/$2.19 | Slower |
 *
 * ### Thinking Tokens (deepseek-reasoner)
 *
 * The DeepSeek-Reasoner model uses "thinking tokens" - internal reasoning tokens that
 * the model generates before producing the final output. These tokens:
 * - Are included in the input token count for pricing
 * - Provide visibility into the model's reasoning process
 * - Result in better answers for complex, multi-step problems
 *
 * The API returns these via `prompt_cache_hit_tokens` in the usage field when
 * reasoning was cached, and `completion_tokens` includes the final answer.
 *
 * ### API Documentation
 * - Base URL: https://api.deepseek.com
 * - Endpoint: /v1/chat/completions (OpenAI-compatible)
 * - Docs: https://api-docs.deepseek.com/
 *
 * ### Supported Features
 * - Function/tool calling
 * - Streaming responses
 * - JSON mode (not available on reasoner)
 * - System prompts
 *
 * @example
 * ```ts
 * const provider = new DeepSeekProvider({ apiKey: 'sk-...' });
 * const response = await provider.chat({
 *   model: 'deepseek-coder',
 *   messages: [{ role: 'user', content: 'Write a function to sort an array' }],
 *   temperature: 0.3
 * });
 * ```
 */

import type {
  AIProvider,
  ProviderConfig,
  ProviderCapabilities,
  ModelInfo,
  ChatRequest,
  ChatResponse,
  CostRequest,
  CostEstimate,
  ProviderHealth,
  Tool,
} from './base';

/**
 * DeepSeek provider configuration
 */
export interface DeepSeekConfig extends Omit<ProviderConfig, 'name' | 'apiFormat'> {
  name: 'deepseek';
  apiFormat: 'openai';
}

/**
 * Available DeepSeek models
 *
 * Each model is optimized for specific use cases:
 *
 * - **deepseek-chat (V3)**: The flagship general-purpose model. Excellent for
 *   conversations, explanations, and general tasks. 64K context allows for
 *   substantial conversations and document analysis.
 *
 * - **deepseek-coder**: Specialized for code generation, debugging, and
 *   understanding. Fine-tuned on large codebases. Smaller 16K context is
 *   sufficient for most coding tasks while being faster and cheaper.
 *
 * - **deepseek-reasoner (R1)**: Designed for complex reasoning tasks. Uses
 *   extended thinking to break down problems step-by-step before answering.
 *   Higher cost but significantly better for complex logic, math, and planning.
 */
const DEEPSEEK_MODELS: ModelInfo[] = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek-Chat',
    type: 'llm',
    context: 64000,
    isDefault: true,
    features: ['general-purpose', 'low-cost', '64k-context'],
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek-Coder',
    type: 'llm',
    context: 16000,
    features: ['coding-specialist', 'code-completion', 'fast'],
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek-Reasoner',
    type: 'llm',
    context: 64000,
    features: ['complex-reasoning', 'thinking-tokens', 'r1'],
  },
];

/**
 * DeepSeek provider capabilities
 */
const DEEPSEEK_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  functionCalling: true,
  vision: false,
  maxContext: 64000,
  imageGeneration: false,
  audioGeneration: false,
  videoGeneration: false,
  jsonMode: true,
  systemPrompt: true,
};

/**
 * Cost per million tokens (USD)
 *
 * DeepSeek's pricing is the lowest among major commercial LLM providers:
 *
 * | Model | Input | Output | Notes |
 * |-------|-------|--------|-------|
 * | deepseek-chat | $0.14 | $0.28 | General purpose, cheapest option |
 * | deepseek-coder | $0.14 | $0.28 | Code-specialized, same pricing |
 * | deepseek-reasoner | $0.55 | $2.19 | Includes thinking tokens in output |
 *
 * Cost Comparison (per 1M input tokens):
 * - DeepSeek: $0.14
 * - NVIDIA: $0.40
 * - Google: $1.00
 * - Anthropic: $3.00
 * - OpenAI GPT-4: $15.00
 *
 * The reasoner's higher cost accounts for the extended thinking process.
 * Thinking tokens are billed as input tokens since they're part of the
 * model's internal reasoning before generating the final response.
 */
const DEEPSEEK_COST_PER_MILLION = {
  input: 0.14,
  output: 0.28,
  // Reasoner has different pricing - higher cost accounts for thinking tokens
  reasonerInput: 0.55, // includes thinking tokens
  reasonerOutput: 2.19,
};

/**
 * DeepSeek Provider Implementation
 */
export class DeepSeekProvider implements AIProvider {
  readonly config: DeepSeekConfig;

  constructor(config: Partial<DeepSeekConfig> & { apiKey: string }) {
    this.config = {
      name: 'deepseek',
      type: 'llm',
      baseUrl: config.baseUrl || 'https://api.deepseek.com',
      apiKey: config.apiKey,
      models: DEEPSEEK_MODELS,
      costPerMillion: config.costPerMillion || 0.20,
      capabilities: DEEPSEEK_CAPABILITIES,
      apiFormat: 'openai',
      region: 'global',
    };
  }

  async initialize(): Promise<void> {
    if (!this.config.apiKey || this.config.apiKey.length < 20) {
      throw new Error('Invalid DeepSeek API key');
    }

    const health = await this.getHealth();
    if (health.status !== 'available') {
      throw new Error(`DeepSeek provider not available: ${health.error}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    const health = await this.getHealth();
    return health.status === 'available';
  }

  async getHealth(): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
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
          error: 'Invalid API key',
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

      return {
        name: this.config.name,
        status: 'error',
        latencyMs: latency,
        lastCheck: Date.now(),
        error: `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        name: this.config.name,
        status: 'error',
        latencyMs: Date.now() - startTime,
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate a chat completion using the DeepSeek API.
   *
   * This is the main entry point for LLM requests. It handles:
   * - Model selection (defaults to deepseek-chat)
   * - Request formatting (OpenAI-compatible)
   * - Special handling for reasoner model (no JSON mode)
   * - Tool/function calling support
   * - Cost calculation with thinking token accounting
   *
   * ### When to use each model
   *
   * For **code-help** intent:
   * - Use `deepseek-coder` for code generation, debugging, refactoring
   * - Faster and more accurate for code-specific tasks
   *
   * For **explanation** intent:
   * - Use `deepseek-chat` for tutorials, concept explanations
   * - Good balance of speed and quality
   *
   * For **analysis** or **simulation** intent:
   * - Use `deepseek-reasoner` for complex multi-step reasoning
   * - Worth the extra cost for difficult problems
   *
   * ### Thinking Token Handling
   *
   * When using deepseek-reasoner, the model may generate extended thinking
   * before the final answer. These tokens are tracked separately:
   * - `prompt_cache_hit_tokens`: Cached thinking tokens (if any)
   * - `completion_tokens`: Final output tokens
   *
   * The cost is calculated accounting for both input and thinking tokens.
   *
   * @param request - Chat request with model, messages, and optional parameters
   * @returns Promise resolving to ChatResponse with content, tokens, and cost
   * @throws {Error} When API call fails or returns non-OK status
   *
   * @example
   * ```ts
   * const response = await provider.chat({
   *   model: 'deepseek-coder',
   *   messages: [
   *     { role: 'system', content: 'You are a coding assistant' },
   *     { role: 'user', content: 'Write a binary search function' }
   *   ],
   *   temperature: 0.3,
   *   maxTokens: 2048
   * });
   * ```
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    return this.callChat(request);
  }

  /**
   * Alias for chat() method - provides semantic clarity for direct calls.
   *
   * This method is identical to chat() but may be preferred in code that
   * explicitly wants to "call" the provider rather than using the generic
   * "chat" terminology.
   *
   * @param request - Chat request with model, messages, and optional parameters
   * @returns Promise resolving to ChatResponse with content, tokens, and cost
   */
  async callChat(request: ChatRequest): Promise<ChatResponse> {
    const isReasoner = request.model === 'deepseek-reasoner';
    const selectedModel = request.model || 'deepseek-chat';

    // DeepSeek uses OpenAI-compatible API format
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        top_p: request.topP,
        stream: request.stream ?? false,
        tools: request.tools,
        tool_choice: request.toolChoice,
        // Note: JSON mode is not available on reasoner model
        // Only enable JSON mode for non-reasoner models when explicitly requested
        ...(isReasoner ? {} : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `DeepSeek API error (${response.status})`;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorText;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      throw new Error(`DeepSeek chat error: ${errorMessage}`);
    }

    const data = await response.json() as DeepSeekChatResponse;
    const choice = data.choices[0];

    // Extract token usage from response
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;

    // Thinking tokens are returned as cache hit tokens for reasoner
    // These represent the internal reasoning tokens generated
    const thinkingTokens = data.usage?.prompt_cache_hit_tokens || 0;
    const cacheMissTokens = data.usage?.prompt_cache_miss_tokens || 0;

    // Calculate cost based on model and token usage
    const cost = this.calculateChatCost(
      inputTokens,
      outputTokens,
      isReasoner,
      thinkingTokens
    );

    // Extract reasoning content if present (deepseek-reasoner specific)
    let content = choice.message?.content || '';
    let reasoningContent: string | undefined;

    // DeepSeek-Reasoner may return reasoning in a specific format
    // Check if content contains structured reasoning output
    if (isReasoner && content.includes('<reasoning>')) {
      const reasoningMatch = content.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
      if (reasoningMatch) {
        reasoningContent = reasoningMatch[1].trim();
        // Remove reasoning tags from final content
        content = content.replace(/<reasoning>[\s\S]*?<\/reasoning>/, '').trim();
      }
    }

    return {
      content,
      model: data.model,
      provider: this.config.name,
      cost,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cacheRead: thinkingTokens,
        cacheWrite: cacheMissTokens,
      },
      finishReason: choice.finish_reason,
      cached: thinkingTokens > 0, // Consider cached if we had cache hits
      toolCalls: choice.message?.tool_calls,
      // Attach reasoning as metadata if present
      ...(reasoningContent ? { reasoning: reasoningContent } as any : {}),
    };
  }

  async estimateCost(request: CostRequest): Promise<CostEstimate> {
    const isReasoner = request.model === 'deepseek-reasoner';

    const inputCostPerMillion = isReasoner
      ? DEEPSEEK_COST_PER_MILLION.reasonerInput
      : DEEPSEEK_COST_PER_MILLION.input;

    const outputCostPerMillion = isReasoner
      ? DEEPSEEK_COST_PER_MILLION.reasonerOutput
      : DEEPSEEK_COST_PER_MILLION.output;

    const inputCost = (request.inputTokens / 1_000_000) * inputCostPerMillion;
    const outputCost = (request.outputTokens / 1_000_000) * outputCostPerMillion;

    return {
      estimatedCost: inputCost + outputCost,
      currency: 'USD',
      breakdown: { input: inputCost, output: outputCost },
      provider: this.config.name,
      model: request.model,
    };
  }

  listModels(): ModelInfo[] {
    return this.config.models;
  }

  getCapabilities(): ProviderCapabilities {
    return this.config.capabilities;
  }

  dispose(): void {
    // No cleanup needed
  }

  /**
   * Calculate the cost of a chat request based on token usage.
   *
   * DeepSeek's pricing model differs by model type:
   *
   * - **deepseek-chat / deepseek-coder**: Simple input/output pricing
   *   - Input: $0.14 per 1M tokens
   *   - Output: $0.28 per 1M tokens
   *
   * - **deepseek-reasoner**: Higher cost accounts for thinking tokens
   *   - Input: $0.55 per 1M tokens (includes thinking in input)
   *   - Output: $2.19 per 1M tokens
   *
   * The reasoner's higher input cost accounts for the extended thinking process.
   * Thinking tokens are billed as part of the input since they represent the
   * model's internal reasoning before generating the final response.
   *
   * ### Cost Examples
   *
   * | Scenario | Input | Output | Thinking | Total Cost |
   *----------|-------|--------|----------|------------|
   * Simple chat (chat) | 500 | 300 | 0 | $0.000154 |
   * Code generation (coder) | 2000 | 800 | 0 | $0.000504 |
   * Complex reasoning (reasoner) | 500 | 300 | 2000 | $0.00407 |
   *
   * @param inputTokens - Number of input/prompt tokens
   * @param outputTokens - Number of output/completion tokens
   * @param isReasoner - Whether deepseek-reasoner model was used
   * @param thinkingTokens - Number of thinking tokens (reasoner only)
   * @returns The total cost in USD
   */
  private calculateChatCost(
    inputTokens: number,
    outputTokens: number,
    isReasoner: boolean = false,
    thinkingTokens: number = 0
  ): number {
    if (isReasoner) {
      // Reasoner pricing: thinking tokens are billed as input
      // The higher input cost ($0.55/M vs $0.14/M) accounts for the thinking process
      return (
        ((inputTokens + thinkingTokens) / 1_000_000) * DEEPSEEK_COST_PER_MILLION.reasonerInput +
        (outputTokens / 1_000_000) * DEEPSEEK_COST_PER_MILLION.reasonerOutput
      );
    }

    // Standard pricing for chat and coder models
    return (
      (inputTokens / 1_000_000) * DEEPSEEK_COST_PER_MILLION.input +
      (outputTokens / 1_000_000) * DEEPSEEK_COST_PER_MILLION.output
    );
  }
}

/**
 * DeepSeek API Response Types
 */
interface DeepSeekChatResponse {
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
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
}

/**
 * DeepSeek-specific extensions to Tool interface
 */
export interface DeepSeekTool extends Tool {
  /** DeepSeek supports additional tool parameters */
  tool_type?: 'function' | 'code_interpreter' | 'web_search';
}
