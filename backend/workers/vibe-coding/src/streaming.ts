/**
 * Streaming Response Handler
 *
 * Server-Sent Events (SSE) streaming for AI responses with support for
 * code diffs, file operations, and real-time progress updates.
 */

import type {
  StreamChunk,
  ChatMessage,
} from './types.js';

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
  private currentFilePath?: string;
  private currentOriginal = '';
  private currentModified = '';
  private inCodeBlock = false;
  private codeBlockLanguage = '';
  private inputTokens = 0;
  private outputTokens = 0;
  private cachedTokens = 0;
  private startTime = 0;
  private chunksSent = 0;

  constructor(
    private readonly config: StreamConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Create a readable stream
   */
  createStream(): ReadableStream<StreamChunk> {
    this.startTime = Date.now();
    this.bufferedContent = '';
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.chunksSent = 0;
    this.inCodeBlock = false;
    this.currentFilePath = undefined;

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
   * Send a status update
   */
  sendStatus(status: string): void {
    if (!this.controller) {
      throw new Error('Stream not initialized');
    }

    this.controller.enqueue({
      type: 'status',
      status,
    });
  }

  /**
   * Process a content chunk from the AI provider
   */
  async processChunk(chunk: string): Promise<void> {
    if (!this.controller) {
      throw new Error('Stream not initialized');
    }

    // Check for code blocks
    this.bufferedContent += chunk;

    // Process code blocks as we receive them
    const codeBlockMatch = this.bufferedContent.match(/```(\w*)\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      const [, language, content] = codeBlockMatch;
      const before = this.bufferedContent.slice(0, codeBlockMatch.index);
      const after = this.bufferedContent.slice(codeBlockMatch.index! + codeBlockMatch[0].length);

      // Emit content before code block
      if (before) {
        await this.emitContent(before);
      }

      // Emit code block as file/diff
      if (content) {
        this.emitCodeBlock(content, language || 'text');
      }

      this.bufferedContent = after;
    }

    // Emit chunks based on configured size (for non-code content)
    while (!this.inCodeBlock && this.bufferedContent.length >= this.config.chunkSize) {
      const emit = this.bufferedContent.slice(0, this.config.chunkSize);
      this.bufferedContent = this.bufferedContent.slice(this.config.chunkSize);

      await this.emitContent(emit);
    }

    if (this.config.chunkDelay) {
      await new Promise(resolve => setTimeout(resolve, this.config.chunkDelay));
    }
  }

  /**
   * Emit content chunk
   */
  private async emitContent(content: string): Promise<void> {
    this.outputTokens += estimateTokens(content);

    this.controller!.enqueue({
      type: 'content',
      content,
    });
    this.chunksSent++;
  }

  /**
   * Emit code block as file
   */
  private emitCodeBlock(content: string, language: string): void {
    // Try to detect file path from language hint
    const filePath = this.currentFilePath || `untitled.${this.getFileExtension(language)}`;

    this.controller!.enqueue({
      type: 'file',
      filePath,
      language,
      content,
    });
  }

  /**
   * Start a file edit context
   */
  startFileEdit(filePath: string, original: string): void {
    this.currentFilePath = filePath;
    this.currentOriginal = original;
    this.currentModified = '';
  }

  /**
   * Add content to the modified file
   */
  addFileContent(content: string): void {
    this.currentModified += content;
  }

  /**
   * Complete file edit and emit diff
   */
  async completeFileEdit(): Promise<void> {
    if (!this.controller || !this.currentFilePath) {
      return;
    }

    const { generateUnifiedDiff } = await import('./utils.js');

    const unified = generateUnifiedDiff(
      this.currentOriginal,
      this.currentModified,
      this.currentFilePath
    );

    this.controller.enqueue({
      type: 'diff',
      filePath: this.currentFilePath,
      language: detectLanguage(this.currentFilePath),
      diff: {
        original: this.currentOriginal,
        modified: this.currentModified,
        unified,
      },
    });

    this.currentFilePath = undefined;
    this.currentOriginal = '';
    this.currentModified = '';
  }

  /**
   * Flush remaining buffered content
   */
  async flush(): Promise<void> {
    if (!this.controller || this.bufferedContent.length === 0) {
      return;
    }

    this.outputTokens += estimateTokens(this.bufferedContent);

    this.controller.enqueue({
      type: 'content',
      content: this.bufferedContent,
    });
    this.bufferedContent = '';
  }

  /**
   * Complete the stream with metadata
   */
  async complete(
    inputTokens: number,
    cachedTokens = 0,
    cost = 0,
    model = '',
    provider = ''
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
          model,
          provider,
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
  getStats(): {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    chunksSent: number;
    duration: number;
  } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cachedTokens: this.cachedTokens,
      chunksSent: this.chunksSent,
      duration: Date.now() - this.startTime,
    };
  }

  /**
   * Get file extension from language
   */
  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      typescript: 'ts',
      javascript: 'js',
      python: 'py',
      rust: 'rs',
      go: 'go',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      csharp: 'cs',
      php: 'php',
      ruby: 'rb',
      swift: 'swift',
      kotlin: 'kt',
      scala: 'scala',
      bash: 'sh',
      json: 'json',
      yaml: 'yaml',
      toml: 'toml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      markdown: 'md',
      sql: 'sql',
    };

    return extensions[language.toLowerCase()] || 'txt';
  }
}

// ============================================================================
// SSE Helpers
// ============================================================================

/**
 * Convert stream chunk to SSE format
 */
export function toSSE(chunk: StreamChunk): string {
  let data = '';

  switch (chunk.type) {
    case 'content':
      data = JSON.stringify({ type: 'content', content: chunk.content });
      break;
    case 'diff':
      data = JSON.stringify({
        type: 'diff',
        filePath: chunk.filePath,
        language: chunk.language,
        diff: chunk.diff,
      });
      break;
    case 'file':
      data = JSON.stringify({
        type: 'file',
        filePath: chunk.filePath,
        language: chunk.language,
        content: chunk.content,
      });
      break;
    case 'metadata':
      data = JSON.stringify({ type: 'metadata', metadata: chunk.metadata });
      break;
    case 'status':
      data = JSON.stringify({ type: 'status', status: chunk.status });
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
      'X-Accel-Buffering': 'no', // Disable nginx buffering
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

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Detect language from file path
 */
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
  };

  return languageMap[ext || ''] || 'text';
}
