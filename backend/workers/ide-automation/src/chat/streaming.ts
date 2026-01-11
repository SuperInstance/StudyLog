/**
 * Streaming Response Handler
 *
 * Handles SSE (Server-Sent Events) streaming for AI responses.
 * Compatible with Cloudflare Workers and standard fetch APIs.
 */

import type { StreamChunk, ChatMessage, ToolCall } from '../types/index.js';

// ============================================================================
// Stream Configuration
// ============================================================================

interface StreamConfig {
  /** Chunk size in characters */
  chunkSize: number;
  /** Delay between chunks (ms) for rate limiting */
  chunkDelay?: number;
  /** Whether to include metadata */
  includeMetadata: boolean;
}

const DEFAULT_CONFIG: StreamConfig = {
  chunkSize: 100,
  includeMetadata: true,
};

// ============================================================================
// Stream Processor
// ============================================================================

/**
 * Stream processor for handling AI response streaming
 */
export class StreamProcessor {
  private controller: ReadableStreamDefaultController<StreamChunk> | null = null;
  private bufferedContent = '';
  private currentToolCall: Partial<ToolCall> | null = null;
  private inputTokens = 0;
  private outputTokens = 0;
  private cachedTokens = 0;
  private startTime = 0;

  constructor(
    private readonly config: StreamConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Create a readable stream for SSE
   */
  createStream(): ReadableStream<StreamChunk> {
    this.startTime = Date.now();
    this.bufferedContent = '';
    this.inputTokens = 0;
    this.outputTokens = 0;

    return new ReadableStream<StreamChunk>({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.controller = null;
      },
    });
  }

  /**
   * Process a chunk from the AI provider
   */
  async processChunk(chunk: string): Promise<void> {
    if (!this.controller) {
      throw new Error('Stream not initialized');
    }

    this.bufferedContent += chunk;

    // Emit chunks based on configured size
    while (this.bufferedContent.length >= this.config.chunkSize) {
      const emit = this.bufferedContent.slice(0, this.config.chunkSize);
      this.bufferedContent = this.bufferedContent.slice(this.config.chunkSize);

      this.outputTokens += this.estimateTokens(emit);

      this.controller.enqueue({
        type: 'content',
        content: emit,
      });

      if (this.config.chunkDelay) {
        await new Promise(resolve => setTimeout(resolve, this.config.chunkDelay));
      }
    }
  }

  /**
   * Process a tool call delta
   */
  processToolCallDelta(delta: Partial<ToolCall>): void {
    if (!this.controller) {
      throw new Error('Stream not initialized');
    }

    if (!this.currentToolCall) {
      this.currentToolCall = delta;
    } else {
      this.currentToolCall = { ...this.currentToolCall, ...delta };
    }

    this.controller.enqueue({
      type: 'tool_call',
      toolCall: this.currentToolCall,
    });
  }

  /**
   * Complete a tool call
   */
  completeToolCall(): void {
    if (!this.controller || !this.currentToolCall) {
      return;
    }

    this.controller.enqueue({
      type: 'tool_call',
      toolCall: this.currentToolCall,
    });

    this.currentToolCall = null;
  }

  /**
   * Flush remaining buffered content
   */
  async flush(): Promise<void> {
    if (!this.controller) {
      return;
    }

    if (this.bufferedContent.length > 0) {
      this.outputTokens += this.estimateTokens(this.bufferedContent);

      this.controller.enqueue({
        type: 'content',
        content: this.bufferedContent,
      });
      this.bufferedContent = '';
    }
  }

  /**
   * Complete the stream with metadata
   */
  async complete(
    inputTokens: number,
    cachedTokens = 0,
    cost = 0
  ): Promise<void> {
    await this.flush();

    if (!this.controller) {
      return;
    }

    this.inputTokens = inputTokens;
    this.cachedTokens = cachedTokens;

    if (this.config.includeMetadata) {
      this.controller.enqueue({
        type: 'metadata',
        metadata: {
          inputTokens,
          outputTokens: this.outputTokens,
          cachedTokens,
          cost,
        },
      });
    }

    this.controller.enqueue({
      type: 'done',
      done: true,
    });

    this.controller.close();
    this.controller = null;
  }

  /**
   * Send an error and close the stream
   */
  error(message: string): void {
    if (!this.controller) {
      return;
    }

    this.controller.enqueue({
      type: 'error',
      error: message,
    });

    this.controller.close();
    this.controller = null;
  }

  /**
   * Get current statistics
   */
  getStats(): { inputTokens: number; outputTokens: number; cachedTokens: number } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cachedTokens: this.cachedTokens,
    };
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

// ============================================================================
// SSE Helpers
// ============================================================================

/**
 * Convert stream chunks to SSE format
 */
export function toSSE(chunk: StreamChunk): string {
  let data = '';

  switch (chunk.type) {
    case 'content':
      data = JSON.stringify({ type: 'content', content: chunk.content });
      break;
    case 'tool_call':
      data = JSON.stringify({ type: 'tool_call', toolCall: chunk.toolCall });
      break;
    case 'metadata':
      data = JSON.stringify({ type: 'metadata', metadata: chunk.metadata });
      break;
    case 'error':
      data = JSON.stringify({ type: 'error', error: chunk.error });
      break;
    case 'done':
      data = JSON.stringify({ type: 'done' });
      break;
  }

  return `data: ${data}\n\n`;
}

/**
 * Create SSE response from stream
 */
export function createSSEResponse(stream: ReadableStream<StreamChunk>): Response {
  const transformedStream = stream.pipeThrough(
    new TransformStream<StreamChunk, string>({
      transform(chunk, controller) {
        controller.enqueue(toSSE(chunk));
      },
    })
  );

  return new Response(transformedStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ============================================================================
// Provider-Specific Parsers
// ============================================================================

/**
 * Parse OpenAI-compatible streaming response
 */
export async function parseOpenAIStream(
  response: Response,
  processor: StreamProcessor
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process SSE lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue;

      const data = line.slice(6).trim();
      if (data === '[DONE]') {
        await processor.flush();
        continue;
      }

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          await processor.processChunk(content);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  await processor.flush();
}

/**
 * Parse Anthropic streaming response
 */
export async function parseAnthropicStream(
  response: Response,
  processor: StreamProcessor
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Anthropic uses SSE with event types
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ') && currentEvent === 'content_block_delta') {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.delta?.text;
          if (content) {
            await processor.processChunk(content);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }

  await processor.flush();
}

/**
 * Parse non-streaming response and simulate streaming
 */
export async function simulateStreaming(
  content: string,
  processor: StreamProcessor,
  chunkDelay = 20
): Promise<void> {
  const chunks = splitIntoChunks(content, 100);

  for (const chunk of chunks) {
    await processor.processChunk(chunk);
    await new Promise(resolve => setTimeout(resolve, chunkDelay));
  }

  await processor.flush();
}

/**
 * Split text into chunks at word boundaries
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > chunkSize) {
    // Find word boundary near chunk size
    let splitAt = chunkSize;
    const lastSpace = remaining.lastIndexOf(' ', chunkSize);
    const lastNewline = remaining.lastIndexOf('\n', chunkSize);

    if (lastNewline > chunkSize * 0.5) {
      splitAt = lastNewline + 1;
    } else if (lastSpace > chunkSize * 0.5) {
      splitAt = lastSpace + 1;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

// ============================================================================
// Context Window Manager
// ============================================================================

interface ContextWindowConfig {
  maxTokens: number;
  reservedSystem: number;
  reservedOutput: number;
}

/**
 * Context window manager for token budgeting
 */
export class ContextWindowManager {
  private readonly maxTokens: number;
  private readonly reservedSystem: number;
  private readonly reservedOutput: number;
  private readonly availableForInput: number;

  constructor(config: ContextWindowConfig) {
    this.maxTokens = config.maxTokens;
    this.reservedSystem = config.reservedSystem;
    this.reservedOutput = config.reservedOutput;
    this.availableForInput = this.maxTokens - this.reservedSystem - this.reservedOutput;
  }

  /**
   * Calculate available tokens for messages
   */
  getAvailableTokens(systemPrompt: string, messageCount: number): number {
    const systemTokens = this.estimateTokens(systemPrompt);
    const messageOverhead = messageCount * 10; // Rough overhead per message
    return Math.max(0, this.availableForInput - systemTokens - messageOverhead);
  }

  /**
   * Truncate messages to fit token budget
   */
  truncateMessages(
    messages: ChatMessage[],
    maxTokens: number
  ): ChatMessage[] {
    const result: ChatMessage[] = [];
    let currentTokens = 0;

    // Always include system message
    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
      result.push(systemMsg);
      currentTokens += this.estimateTokens(systemMsg.content || '');
    }

    // Add recent messages until we hit the limit
    const recentMessages = messages
      .filter(m => m.role !== 'system')
      .reverse();

    for (const msg of recentMessages) {
      const msgTokens = this.estimateTokens(msg.content || '');
      if (currentTokens + msgTokens > maxTokens) {
        break;
      }
      result.unshift(msg);
      currentTokens += msgTokens;
    }

    return result;
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate file content tokens
   */
  estimateFileTokens(content: string, language: string): number {
    // Different languages have different token ratios
    const ratios: Record<string, number> = {
      typescript: 3.5,
      javascript: 3.5,
      python: 4,
      rust: 3.5,
      go: 3.5,
      json: 4,
      markdown: 4.5,
      text: 4,
    };

    const ratio = ratios[language] || 4;
    return Math.ceil(content.length / ratio);
  }
}

/**
 * Create a context window manager with default config
 */
export function createContextWindowManager(maxTokens = 128000): ContextWindowManager {
  return new ContextWindowManager({
    maxTokens,
    reservedSystem: 2000,
    reservedOutput: 4096,
  });
}
