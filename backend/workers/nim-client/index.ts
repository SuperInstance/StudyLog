/**
 * NIM Microservices Client
 *
 * Client for NVIDIA NIM (NVIDIA Inference Microservices) endpoints,
 * specifically for Llama Nemotron reasoning models.
 *
 * Reference: https://developer.nvidia.com/blog/build-enterprise-ai-agents-with-advanced-open-nvidia-llama-nemotron-reasoning-models/
 *
 * NIM provides optimized inference for:
 * - Llama Nemotron Ultra (70B) - Enterprise-grade reasoning
 * - Llama Nemotron Super (25B) - Balanced performance and cost
 *
 * Key features:
 * - OpenAI-compatible API
 * - Specialized for math, coding, and reasoning tasks
 * - Low latency inference via NVIDIA TensorRT-LLM
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Supported Llama Nemotron models
 */
export type NemotronModel = 'llama-nemotron-ultra' | 'llama-nemotron-super';

/**
 * Model configuration
 */
export interface ModelConfig {
  /** Model identifier */
  model: NemotronModel;
  /** Maximum tokens in response */
  maxTokens: number;
  /** Temperature (0-2) */
  temperature: number;
  /** Top-p sampling */
  topP: number;
}

/**
 * Chat message format
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * NIM API response format
 */
export interface NIMResponse {
  /** Generated text content */
  content: string;
  /** Model used */
  model: string;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Finish reason */
  finishReason: string;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Estimated cost in USD */
  cost: number;
}

/**
 * Math reasoning request
 */
export interface MathReasoningRequest {
  /** Math problem to solve */
  problem: string;
  /** Show step-by-step work */
  showSteps?: boolean;
  /** Additional context */
  context?: string;
}

/**
 * Math reasoning response
 */
export interface MathReasoningResponse {
  /** Final answer */
  answer: string;
  /** Step-by-step derivation */
  steps?: string[];
  /** Explanation */
  explanation: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Coding assistance request
 */
export interface CodingAssistanceRequest {
  /** Code to analyze or complete */
  code: string;
  /** Programming language */
  language: string;
  /** Type of assistance */
  task: 'explain' | 'debug' | 'optimize' | 'complete' | 'refactor';
  /** Specific instructions */
  instructions?: string;
}

/**
 * Coding assistance response
 */
export interface CodingAssistanceResponse {
  /** Explanation or solution */
  response: string;
  /** Modified code (if applicable) */
  code?: string;
  /** Suggestions */
  suggestions?: string[];
  /** Identified issues */
  issues?: Array<{
    line?: number;
    severity: 'error' | 'warning' | 'info';
    message: string;
    fix?: string;
  }>;
}

/**
 * Client configuration
 */
export interface NIMClientConfig {
  /** Base URL for NIM endpoint */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Default model to use */
  defaultModel?: NemotronModel;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Default generation parameters */
  defaults?: Partial<ModelConfig>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default model configurations
 */
const MODEL_CONFIGS: Record<NemotronModel, ModelConfig> = {
  'llama-nemotron-ultra': {
    model: 'llama-nemotron-ultra',
    maxTokens: 4096,
    temperature: 0.1,
    topP: 0.9,
  },
  'llama-nemotron-super': {
    model: 'llama-nemotron-super',
    maxTokens: 2048,
    temperature: 0.2,
    topP: 0.9,
  },
};

/**
 * Cost per million tokens for each model
 */
const MODEL_COSTS: Record<NemotronModel, { input: number; output: number }> = {
  'llama-nemotron-ultra': { input: 0.80, output: 0.80 },
  'llama-nemotron-super': { input: 0.40, output: 0.40 },
};

/**
 * System prompts for specialized tasks
 */
const SYSTEM_PROMPTS = {
  math: `You are an expert mathematician and problem solver. You approach mathematical problems systematically:
1. Understand the problem statement clearly
2. Identify relevant concepts and formulas
3. Work through the solution step-by-step
4. Verify your answer makes sense
5. Provide clear, concise explanations

Always show your work when appropriate. Be precise and rigorous in your reasoning.`,

  coding: `You are an expert software engineer and code reviewer. You provide:
- Clear explanations of code behavior
- Constructive feedback on code quality
- Optimized solutions with performance considerations
- Best practices following modern standards
- Security and correctness considerations

When debugging, identify root causes and provide specific fixes. When explaining, focus on clarity and practical understanding.`,
};

// ============================================================================
// NIM Client Implementation
// ============================================================================

/**
 * NIM Client for Llama Nemotron reasoning models
 *
 * @example
 * ```typescript
 * const client = new NIMClient({
 *   baseUrl: 'https://integrate.api.nvidia.com/v1',
 *   apiKey: process.env.NVIDIA_API_KEY
 * });
 *
 * const result = await client.reasoning(
 *   'Explain the relationship between quantum entanglement and superposition',
 *   'llama-nemotron-ultra'
 * );
 * ```
 */
export class NIMClient {
  private readonly config: Required<Pick<NIMClientConfig, 'baseUrl' | 'apiKey'>> &
    Omit<NIMClientConfig, 'baseUrl' | 'apiKey'>;

  constructor(config: NIMClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultModel: config.defaultModel || 'llama-nemotron-super',
      timeout: config.timeout || 30000,
      defaults: config.defaults || MODEL_CONFIGS['llama-nemotron-super'],
    };
  }

  /**
   * Generate reasoning response using Llama Nemotron
   *
   * @param prompt - The input prompt for reasoning
   * @param model - Which Nemotron model to use
   * @returns Promise resolving to NIMResponse with generated content
   */
  async reasoning(prompt: string, model: NemotronModel = this.config.defaultModel): Promise<NIMResponse> {
    const startTime = Date.now();

    try {
      const modelConfig = { ...MODEL_CONFIGS[model], ...this.config.defaults };
      const modelName = this.getModelId(model);

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
            top_p: modelConfig.topP,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NIM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const costs = MODEL_COSTS[model];

      return {
        content: data.choices?.[0]?.message?.content || '',
        model: modelName,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        finishReason: data.choices?.[0]?.finish_reason || 'unknown',
        latencyMs: Date.now() - startTime,
        cost: this.calculateCost(promptTokens, completionTokens, costs),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`NIM request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Specialized math reasoning with step-by-step output
   *
   * @param request - Math problem and configuration
   * @returns Promise resolving to MathReasoningResponse
   */
  async mathReasoning(request: MathReasoningRequest): Promise<string> {
    const { problem, showSteps = true, context } = request;

    const prompt = this.buildMathPrompt(problem, showSteps, context);

    const response = await this.reasoning(prompt, 'llama-nemotron-ultra');

    return response.content;
  }

  /**
   * Specialized coding assistance
   *
   * @param request - Code and task configuration
   * @returns Promise resolving to CodingAssistanceResponse
   */
  async codingAssistance(request: CodingAssistanceRequest): Promise<string> {
    const { code, language, task, instructions } = request;

    const prompt = this.buildCodingPrompt(code, language, task, instructions);

    const response = await this.reasoning(prompt, 'llama-nemotron-super');

    return response.content;
  }

  /**
   * Chat completion with custom messages
   *
   * @param messages - Array of chat messages
   * @param model - Which Nemotron model to use
   * @returns Promise resolving to NIMResponse
   */
  async chat(messages: ChatMessage[], model: NemotronModel = this.config.defaultModel): Promise<NIMResponse> {
    const startTime = Date.now();

    try {
      const modelConfig = { ...MODEL_CONFIGS[model], ...this.config.defaults };
      const modelName = this.getModelId(model);

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages,
            max_tokens: modelConfig.maxTokens,
            temperature: modelConfig.temperature,
            top_p: modelConfig.topP,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`NIM API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const costs = MODEL_COSTS[model];

      return {
        content: data.choices?.[0]?.message?.content || '',
        model: modelName,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        finishReason: data.choices?.[0]?.finish_reason || 'unknown',
        latencyMs: Date.now() - startTime,
        cost: this.calculateCost(promptTokens, completionTokens, costs),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`NIM request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Get the actual model ID for the NIM API
   */
  private getModelId(model: NemotronModel): string {
    const modelIds: Record<NemotronModel, string> = {
      'llama-nemotron-ultra': 'meta/llama-3.1-nemotron-70b-instruct',
      'llama-nemotron-super': 'meta/llama-3.1-nemotron-70b-instruct',
    };
    return modelIds[model];
  }

  /**
   * Build a specialized math reasoning prompt
   */
  private buildMathPrompt(problem: string, showSteps: boolean, context?: string): string {
    let prompt = '';

    if (context) {
      prompt += `Context: ${context}\n\n`;
    }

    prompt += `Problem: ${problem}\n\n`;

    if (showSteps) {
      prompt += `Please solve this step-by-step, showing your work clearly.\n\n`;
    } else {
      prompt += `Please provide the final answer with a brief explanation.\n\n`;
    }

    return prompt;
  }

  /**
   * Build a specialized coding assistance prompt
   */
  private buildCodingPrompt(
    code: string,
    language: string,
    task: CodingAssistanceRequest['task'],
    instructions?: string
  ): string {
    const taskInstructions: Record<CodingAssistanceRequest['task'], string> = {
      explain: 'Explain what this code does, its purpose, and how it works.',
      debug: 'Identify any bugs or issues in this code and explain how to fix them.',
      optimize: 'Suggest optimizations to improve performance, readability, or maintainability.',
      complete: 'Complete this code following the established patterns and best practices.',
      refactor: 'Refactor this code to improve its structure while maintaining functionality.',
    };

    let prompt = `Language: ${language}\n`;
    prompt += `Task: ${taskInstructions[task]}\n\n`;

    if (instructions) {
      prompt += `Additional Instructions: ${instructions}\n\n`;
    }

    prompt += `Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;

    return prompt;
  }

  /**
   * Calculate cost based on token usage
   */
  private calculateCost(inputTokens: number, outputTokens: number, costs: { input: number; output: number }): number {
    return (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if the client is configured and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a NIM client from environment configuration
 *
 * @param env - Environment object containing NVIDIA_API_KEY
 * @param config - Optional additional configuration
 * @returns Configured NIMClient instance
 */
export function createNIMClient(
  env: { NVIDIA_API_KEY?: string; NIM_BASE_URL?: string },
  config?: Partial<NIMClientConfig>
): NIMClient {
  const apiKey = env.NVIDIA_API_KEY || config?.apiKey;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is required for NIM client');
  }

  return new NIMClient({
    baseUrl: env.NIM_BASE_URL || config?.baseUrl || 'https://integrate.api.nvidia.com/v1',
    apiKey,
    ...config,
  });
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './types';
