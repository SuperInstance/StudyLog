/**
 * StudyLoG.AI - Vibe Chat Streaming Adapter
 *
 * Handles Server-Sent Events (SSE) streaming for AI responses.
 * Provides a clean async generator interface over SSE streams.
 *
 * Based on streaming patterns from:
 * - Cursor IDE's streaming chat
 * - Windsurf's Cascade agent streaming
 * - Zed's agent panel streaming
 */

import { StreamChunk, StreamChunkType, VibeChatError, ERROR_CODES } from '../common';

// ============================================================================
// Configuration Constants
// ============================================================================

/** Maximum buffer size for SSE data before throwing an error */
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

/** Timeout for SSE connection in milliseconds */
const SSE_TIMEOUT = 60000; // 60 seconds

/** SSE line prefix for data events */
const SSE_DATA_PREFIX = 'data: ';

/** SSE line prefix for event type */
const SSE_EVENT_PREFIX = 'event: ';

/** SSE line prefix for ID */
const SSE_ID_PREFIX = 'id: ';

/** SSE comment prefix */
const SSE_COMMENT_PREFIX = ':';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for creating a stream reader
 */
export interface StreamOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional headers to include */
  headers?: Record<string, string>;
  /** Callback for progress updates */
  onProgress?: (bytesReceived: number) => void;
  /** Callback for error handling */
  onError?: (error: Error) => void;
}

/**
 * Parsed SSE event
 */
interface ParsedSSEEvent {
  /** Event type (default: 'message') */
  type: string;
  /** Event data (JSON parsed if possible) */
  data: string;
  /** Event ID (optional) */
  id?: string;
}

/**
 * Stream reader state
 */
interface StreamReaderState {
  /** Buffer for incomplete SSE data */
  buffer: string;
  /** Total bytes received */
  bytesReceived: number;
  /** Whether stream is complete */
  done: boolean;
  /** Abort controller for cancellation */
  controller: AbortController;
}

// ============================================================================
// Main Streaming Adapter Class
// ============================================================================

/**
 * Streaming adapter for SSE responses.
 *
 * Provides an async generator interface over Server-Sent Events,
 * parsing structured JSON chunks as they arrive.
 *
 * ## Usage
 *
 * ```ts
 * const adapter = new StreamingAdapter();
 *
 * for await (const chunk of adapter.stream('/api/chat', { messages })) {
 *   if (chunk.type === 'content') {
 *     console.log(chunk.content);
 *   }
 * }
 * ```
 *
 * ## SSE Format Expected
 *
 * The backend should send SSE in this format:
 * ```
 * data: {"type":"metadata","content":"","metadata":{"messageId":"msg-123"}}
 *
 * data: {"type":"content","content":"Hello","metadata":{}}
 *
 * data: {"type":"content","content":" world","metadata":{}}
 *
 * data: {"type":"done","content":"","metadata":{}}
 * ```
 *
 * ## Error Handling
 *
 * - Network errors are converted to VibeChatError with NETWORK_ERROR code
 * - Timeout errors use STREAM_INTERRUPTED code
 * - Parse errors are emitted as error-type chunks
 * - All errors are also forwarded to the onError callback if provided
 */
export class StreamingAdapter {
  private activeReaders = new Map<string, StreamReaderState>();

  /**
   * Stream SSE events from the given URL.
   *
   * @param url - The endpoint URL for streaming
   * @param body - Request body to send
   * @param options - Stream configuration options
   * @returns Async generator of StreamChunk objects
   */
  async *stream(
    url: string,
    body: unknown,
    options: StreamOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const readerId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timeout = options.timeout ?? SSE_TIMEOUT;

    // Create abort controller for this stream
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Initialize reader state
    const state: StreamReaderState = {
      buffer: '',
      bytesReceived: 0,
      done: false,
      controller,
    };
    this.activeReaders.set(readerId, state);

    try {
      // Make fetch request with abort signal
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...options.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      // Check response status
      if (!response.ok) {
        throw new VibeChatError(
          `HTTP ${response.status}: ${response.statusText}`,
          ERROR_CODES.API_ERROR,
          { status: response.status, statusText: response.statusText }
        );
      }

      // Check for streaming content type
      const contentType = response.headers.get('Content-Type') ?? '';
      if (!contentType.includes('text/event-stream') && !contentType.includes('application/json')) {
        throw new VibeChatError(
          `Expected stream response, got ${contentType}`,
          ERROR_CODES.API_ERROR
        );
      }

      // Get reader for the response body
      const reader = response.body?.getReader();
      if (!reader) {
        throw new VibeChatError(
          'Response body is not readable',
          ERROR_CODES.NETWORK_ERROR
        );
      }

      const decoder = new TextDecoder();

      // Read stream loop
      try {
        while (!state.done) {
          const { done, value } = await reader.read();

          if (done) {
            state.done = true;
            break;
          }

          // Decode chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          state.buffer += chunk;
          state.bytesReceived += value.length;

          // Report progress
          options.onProgress?.(state.bytesReceived);

          // Check buffer size
          if (state.buffer.length > MAX_BUFFER_SIZE) {
            throw new VibeChatError(
              'SSE buffer exceeded maximum size',
              ERROR_CODES.NETWORK_ERROR
            );
          }

          // Parse and yield complete events from buffer
          for (const event of this.parseSSEBuffer(state.buffer)) {
            // Remove parsed data from buffer
            state.buffer = state.buffer.slice(event.consumed);

            // Parse JSON data
            let parsedData: unknown;
            try {
              parsedData = JSON.parse(event.data);
            } catch {
              // If not JSON, emit as text content
              yield {
                type: 'content' as StreamChunkType,
                content: event.data,
              };
              continue;
            }

            // Validate StreamChunk format
            if (this.isValidStreamChunk(parsedData)) {
              yield parsedData;

              // Check for done signal
              if (parsedData.type === 'done') {
                state.done = true;
                break;
              }
            }
          }

          // Exit outer loop if done
          if (state.done) break;
        }
      } finally {
        // Ensure reader is closed
        reader.releaseLock();
      }

    } catch (error) {
      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        options.onError?.(new VibeChatError(
          'Stream request timed out',
          ERROR_CODES.STREAM_INTERRUPTED
        ));
        yield {
          type: 'error',
          content: 'Stream request timed out',
          metadata: { error: 'TIMEOUT' },
        };
        return;
      }

      // Handle VibeChatError
      if (error instanceof VibeChatError) {
        options.onError?.(error);
        yield {
          type: 'error',
          content: error.message,
          metadata: { error: error.code },
        };
        return;
      }

      // Handle other errors
      const message = error instanceof Error ? error.message : String(error);
      options.onError?.(new Error(message));
      yield {
        type: 'error',
        content: message,
        metadata: { error: 'UNKNOWN' },
      };

    } finally {
      // Cleanup
      clearTimeout(timeoutId);
      this.activeReaders.delete(readerId);
    }
  }

  /**
   * Parse SSE events from a buffer.
   *
   * SSE format:
   * - Lines starting with "data: " contain event data
   * - Lines starting with "event: " specify event type
   * - Lines starting with "id: " specify event ID
   * - Empty lines separate events
   * - Lines starting with ":" are comments and ignored
   *
   * @param buffer - Current buffer contents
   * @returns Array of parsed events with consumed byte count
   */
  private parseSSEBuffer(buffer: string): Array<ParsedSSEEvent & { consumed: number }> {
    const events: Array<ParsedSSEEvent & { consumed: number }> = [];
    let position = 0;
    const lines = buffer.split('\n');

    let currentEvent: Partial<ParsedSSEEvent> = {};
    let eventData = '';
    let eventStart = 0;
    let hasData = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLength = line.length + 1; // +1 for newline

      // Empty line = event boundary
      if (line === '') {
        if (hasData) {
          events.push({
            type: currentEvent.type ?? 'message',
            data: eventData,
            id: currentEvent.id,
            consumed: position + lineLength,
          });
          eventData = '';
          currentEvent = {};
          hasData = false;
          eventStart = position + lineLength;
        }
        position += lineLength;
        continue;
      }

      // Comment line - ignore
      if (line.startsWith(SSE_COMMENT_PREFIX)) {
        position += lineLength;
        continue;
      }

      // Event type line
      if (line.startsWith(SSE_EVENT_PREFIX)) {
        currentEvent.type = line.slice(SSE_EVENT_PREFIX.length).trim();
        position += lineLength;
        continue;
      }

      // Event ID line
      if (line.startsWith(SSE_ID_PREFIX)) {
        currentEvent.id = line.slice(SSE_ID_PREFIX.length).trim();
        position += lineLength;
        continue;
      }

      // Data line
      if (line.startsWith(SSE_DATA_PREFIX)) {
        const dataContent = line.slice(SSE_DATA_PREFIX.length);
        if (eventData) {
          eventData += '\n';
        }
        eventData += dataContent;
        hasData = true;
        position += lineLength;
        continue;
      }

      // Unknown line format - skip
      position += lineLength;
    }

    return events;
  }

  /**
   * Type guard for StreamChunk objects.
   */
  private isValidStreamChunk(data: unknown): data is StreamChunk {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const chunk = data as Record<string, unknown>;

    // Check type field
    if (typeof chunk.type !== 'string') {
      return false;
    }

    const validTypes: StreamChunkType[] = [
      'metadata', 'content', 'code_block', 'diff',
      'file_ref', 'status', 'error', 'done'
    ];

    if (!validTypes.includes(chunk.type as StreamChunkType)) {
      return false;
    }

    // Check content field
    if (typeof chunk.content !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Cancel an active stream by ID.
   *
   * @param readerId - The ID of the stream to cancel
   */
  cancelStream(readerId: string): void {
    const state = this.activeReaders.get(readerId);
    if (state) {
      state.controller.abort();
      state.done = true;
      this.activeReaders.delete(readerId);
    }
  }

  /**
   * Cancel all active streams.
   */
  cancelAllStreams(): void {
    for (const [id, state] of this.activeReaders) {
      state.controller.abort();
      state.done = true;
    }
    this.activeReaders.clear();
  }

  /**
   * Get the number of active streams.
   */
  getActiveStreamCount(): number {
    return this.activeReaders.size;
  }
}

// ============================================================================
// Streaming Message Accumulator
// ============================================================================

/**
 * Accumulates streaming chunks into a complete message.
 *
 * This helper class manages the state of building a complete
 * chat message from individual streaming chunks.
 */
export class StreamingMessageAccumulator {
  private content = '';
  private metadata: Record<string, unknown> = {};
  private codeBlocks: Array<{ language: string; code: string; filePath?: string }> = [];
  private currentCodeBlock: { language: string; code: string; filePath?: string } | null = null;
  private fileRefs: Array<{ uri: string; name: string; language: string }> = [];

  /**
   * Process a streaming chunk and update accumulated state.
   *
   * @param chunk - The stream chunk to process
   * @returns Whether the message is complete
   */
  processChunk(chunk: StreamChunk): boolean {
    switch (chunk.type) {
      case 'metadata':
        // Store metadata for the message
        if (chunk.metadata) {
          Object.assign(this.metadata, chunk.metadata);
        }
        break;

      case 'content':
        // Append text content
        this.content += chunk.content;
        break;

      case 'code_block':
        // Handle code block streaming
        if (chunk.metadata?.language) {
          if (!this.currentCodeBlock) {
            this.currentCodeBlock = {
              language: chunk.metadata.language as string,
              code: '',
              filePath: chunk.metadata.filePath as string | undefined,
            };
          }
          this.currentCodeBlock.code += chunk.content;
        }
        break;

      case 'file_ref':
        // Track file references
        if (chunk.metadata?.uri && chunk.metadata?.name) {
          this.fileRefs.push({
            uri: chunk.metadata.uri as string,
            name: chunk.metadata.name as string,
            language: chunk.metadata.language as string || 'text',
          });
        }
        break;

      case 'done':
        // Finalize any open code block
        if (this.currentCodeBlock) {
          this.codeBlocks.push(this.currentCodeBlock);
          this.currentCodeBlock = null;
        }
        return true;

      case 'error':
        // Error chunks don't complete the message normally
        // but we mark metadata to indicate error
        this.metadata.error = chunk.content;
        if (chunk.metadata?.error) {
          this.metadata.errorCode = chunk.metadata.error;
        }
        break;
    }

    return false;
  }

  /**
   * Get the accumulated content so far.
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Get all metadata accumulated.
   */
  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  /**
   * Get accumulated code blocks.
   */
  getCodeBlocks(): Array<{ language: string; code: string; filePath?: string }> {
    return [...this.codeBlocks];
  }

  /**
   * Get accumulated file references.
   */
  getFileRefs(): Array<{ uri: string; name: string; language: string }> {
    return [...this.fileRefs];
  }

  /**
   * Check if there's an active code block being streamed.
   */
  isInCodeBlock(): boolean {
    return this.currentCodeBlock !== null;
  }

  /**
   * Reset the accumulator for a new message.
   */
  reset(): void {
    this.content = '';
    this.metadata = {};
    this.codeBlocks = [];
    this.currentCodeBlock = null;
    this.fileRefs = [];
  }

  /**
   * Get the complete accumulated message data.
   */
  toMessageData(): {
    content: string;
    metadata: Record<string, unknown>;
    codeBlocks: Array<{ language: string; code: string; filePath?: string }>;
    fileRefs: Array<{ uri: string; name: string; language: string }>;
  } {
    return {
      content: this.content,
      metadata: this.getMetadata(),
      codeBlocks: this.getCodeBlocks(),
      fileRefs: this.getFileRefs(),
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default StreamingAdapter;
