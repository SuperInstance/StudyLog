/**
 * StudyLoG.AI - AI Client
 *
 * Unified interface for multiple AI providers:
 * - Cloudflare Workers AI (free tier)
 * - Ollama (local)
 * - Anthropic API (premium)
 */

import type { ToolCall, ToolDefinition, AIProviderConfig } from './types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
}

export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class AIClient {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    switch (this.config.provider) {
      case 'anthropic':
        return this.chatAnthropic(options);
      case 'ollama':
        return this.chatOllama(options);
      case 'cloudflare':
      default:
        return this.chatCloudflare(options);
    }
  }

  // Anthropic Claude API
  private async chatAnthropic(options: ChatOptions): Promise<ChatResponse> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key required');
    }

    const systemMessage = options.messages.find((m) => m.role === 'system');
    const otherMessages = options.messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: options.maxTokens || 1024,
      system: systemMessage?.content,
      messages: otherMessages.map((m) => ({
        role: m.role === 'tool' ? 'user' : m.role,
        content: m.content,
      })),
    };

    // Add tools if provided
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    // Extract text and tool calls
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id!,
          name: block.name!,
          arguments: block.input!,
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  }

  // Ollama local API
  private async chatOllama(options: ChatOptions): Promise<ChatResponse> {
    const baseUrl = this.config.baseUrl || 'http://127.0.0.1:11434';

    // Convert messages to Ollama format
    const messages = options.messages.map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    }));

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 1024,
      },
    };

    // Ollama tool support (if available in model)
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      message: { content: string; tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }> };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    // Extract tool calls if present
    const toolCalls: ToolCall[] = [];
    if (data.message.tool_calls) {
      for (const tc of data.message.tool_calls) {
        toolCalls.push({
          id: crypto.randomUUID(),
          name: tc.function.name,
          arguments: tc.function.arguments,
        });
      }
    }

    return {
      content: data.message.content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
      },
    };
  }

  // Cloudflare Workers AI
  private async chatCloudflare(options: ChatOptions): Promise<ChatResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.cloudflare.com/client/v4';

    // Convert to Cloudflare format
    const prompt = options.messages
      .map((m) => {
        const prefix = m.role === 'system' ? 'System: ' :
          m.role === 'user' ? 'Human: ' :
          m.role === 'assistant' ? 'Assistant: ' : '';
        return prefix + m.content;
      })
      .join('\n\n');

    const body = {
      prompt,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    };

    // For Cloudflare, we'd typically call through our backend worker
    // This is a simplified version for direct API calls
    const response = await fetch(`${baseUrl}/accounts/${this.config.apiKey}/ai/run/${this.config.model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare AI error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { result: { response: string } };

    return {
      content: data.result.response,
    };
  }

  // Quick inference without tools
  async complete(prompt: string, maxTokens = 256): Promise<string> {
    const response = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
    });
    return response.content;
  }

  // Check if the provider is available
  async isAvailable(): Promise<boolean> {
    try {
      await this.complete('Hello', 10);
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function to create appropriate AI client
export function createAIClient(
  preferLocal = false,
  anthropicKey?: string
): AIClient {
  // Priority: Local Ollama > Anthropic > Cloudflare
  if (preferLocal) {
    return new AIClient({
      provider: 'ollama',
      model: 'llama3.2:3b',
      baseUrl: 'http://127.0.0.1:11434',
    });
  }

  if (anthropicKey) {
    return new AIClient({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      apiKey: anthropicKey,
    });
  }

  return new AIClient({
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  });
}
