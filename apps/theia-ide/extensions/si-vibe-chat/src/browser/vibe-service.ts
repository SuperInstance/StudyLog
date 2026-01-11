/**
 * StudyLoG.AI - Vibe Chat Service
 *
 * Frontend service for AI chat interactions.
 * Handles API communication, streaming responses, and state management.
 *
 * Features:
 * - Streaming chat completions
 * - Agent routing
 * - Context gathering
 * - Diff generation
 * - Conversation persistence
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  ChatMessage,
  FileReference,
  FileDiff,
  StreamChunk,
  AgentType,
  VIBE_CHAT_API,
  VibeChatError,
  ERROR_CODES,
  Conversation,
  ConversationSummary,
} from '../common';
import StreamingAdapter, { StreamingMessageAccumulator } from './streaming-adapter';

// ============================================================================
// Types
// ============================================================================

/**
 * Request for chat completion
 */
export interface ChatRequest {
  /** Messages in the conversation */
  messages: ChatMessage[];
  /** Agent to use (or 'auto' for routing) */
  agent?: AgentType;
  /** Model to use */
  model?: string;
  /** Temperature (0.0 - 1.0) */
  temperature?: number;
  /** Maximum tokens */
  maxTokens?: number;
  /** File context */
  files?: FileReference[];
  /** Whether to stream response */
  stream?: boolean;
}

/**
 * Response from chat completion (non-streaming)
 */
export interface ChatResponse {
  /** Generated message */
  message: ChatMessage;
  /** Agent that handled the request */
  agent: AgentType;
  /** Model used */
  model: string;
  /** Estimated cost */
  cost?: number;
  /** Token usage */
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

/**
 * Streaming callback type
 */
export type StreamingCallback = (chunk: StreamChunk) => void;

/**
 * Context gathering options
 */
export interface ContextOptions {
  /** Maximum tokens to include */
  maxTokens?: number;
  /** Whether to include active file */
  includeActiveFile?: boolean;
  /** Whether to include selection */
  includeSelection?: boolean;
  /** Whether to do semantic search */
  semanticSearch?: boolean;
  /** Query for semantic search */
  query?: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Vibe Chat frontend service.
 *
 * Provides a clean API for chat interactions with the AI backend.
 * Handles both streaming and non-streaming requests.
 */
@injectable()
export class VibeChatService {
  private apiBase: string;
  private streamingAdapter: StreamingAdapter;
  private activeStreams = new Set<string>();

  // Event emitters (simple callback-based)
  private messageCallbacks = new Set<StreamingCallback>();
  private stateChangeCallbacks = new Set<(state: 'idle' | 'streaming' | 'error') => void>();

  private currentState: 'idle' | 'streaming' | 'error' = 'idle';

  constructor() {
    // Determine API base URL
    this.apiBase = this.getApiBaseUrl();
    this.streamingAdapter = new StreamingAdapter();
  }

  /**
   * Get the API base URL from environment or default
   */
  private getApiBaseUrl(): string {
    if (typeof process !== 'undefined' && process.env?.VIBE_CHAT_API_BASE) {
      return process.env.VIBE_CHAT_API_BASE;
    }
    // Default to relative path for same-origin requests
    return VIBE_CHAT_API.CHAT.split('/chat')[0];
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Send a chat message and get a response (non-streaming).
   *
   * @param request - Chat request with messages and options
   * @returns Complete chat response
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.setState('streaming');

    try {
      const response = await fetch(`${this.apiBase}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw this.createErrorFromResponse(response);
      }

      const data = await response.json();
      this.setState('idle');

      return {
        message: data.message,
        agent: data.agent,
        model: data.model,
        cost: data.cost,
        tokens: data.tokens,
      };
    } catch (error) {
      this.setState('error');
      throw error instanceof VibeChatError
        ? error
        : new VibeChatError(
            error instanceof Error ? error.message : String(error),
            ERROR_CODES.NETWORK_ERROR
          );
    }
  }

  /**
   * Send a chat message and stream the response.
   *
   * Returns an async generator that yields chunks as they arrive.
   *
   * @param request - Chat request with messages and options
   * @returns Async generator of stream chunks
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    this.setState('streaming');
    const streamId = `stream-${Date.now()}`;
    this.activeStreams.add(streamId);

    try {
      for await (const chunk of this.streamingAdapter.stream(
        `${this.apiBase}/stream`,
        {
          ...request,
          stream: true,
        },
        {
          timeout: 120000, // 2 minutes
          onProgress: (bytes) => {
            // Could emit progress event here
          },
          onError: (error) => {
            console.error('[VibeChat] Stream error:', error);
          },
        }
      )) {
        // Notify listeners
        this.notifyMessageListeners(chunk);

        // Yield to caller
        yield chunk;

        // Check for completion
        if (chunk.type === 'done' || chunk.type === 'error') {
          break;
        }
      }

      this.setState('idle');
    } catch (error) {
      this.setState('error');
      throw error instanceof VibeChatError
        ? error
        : new VibeChatError(
            error instanceof Error ? error.message : String(error),
            ERROR_CODES.NETWORK_ERROR
          );
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  /**
   * Route a query to the appropriate agent.
   *
   * @param query - User query to route
   * @param context - Optional context (files, active module, etc.)
   * @returns Routing decision with agent and confidence
   */
  async route(
    query: string,
    context?: { files?: FileReference[]; activeModule?: string }
  ): Promise<{ agent: AgentType; confidence: number; reasoning: string }> {
    try {
      const response = await fetch(`${this.apiBase}/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, context }),
      });

      if (!response.ok) {
        throw new VibeChatError(
          `Routing failed: ${response.statusText}`,
          ERROR_CODES.API_ERROR
        );
      }

      return await response.json();
    } catch (error) {
      // Fallback to auto agent on error
      console.error('[VibeChat] Routing error, using auto:', error);
      return {
        agent: 'auto',
        confidence: 0,
        reasoning: 'Routing unavailable, using auto mode',
      };
    }
  }

  /**
   * Gather context for the current workspace.
   *
   * @param options - Context gathering options
   * @returns Array of file references with estimated tokens
   */
  async gatherContext(options: ContextOptions = {}): Promise<FileReference[]> {
    try {
      const response = await fetch(`${this.apiBase}/context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        throw new VibeChatError(
          `Context gathering failed: ${response.statusText}`,
          ERROR_CODES.API_ERROR
        );
      }

      const files = await response.json();
      return files as FileReference[];
    } catch (error) {
      console.error('[VibeChat] Context gathering error:', error);
      return [];
    }
  }

  /**
   * Generate a diff for the given code changes.
   *
   * @param fileUri - URI of the file to diff
   * @param original - Original content
   * @param modified - Modified content
   * @param explanation - AI's explanation for changes
   * @returns File diff with change metadata
   */
  async generateDiff(
    fileUri: string,
    original: string,
    modified: string,
    explanation?: string
  ): Promise<FileDiff> {
    try {
      const response = await fetch(`${this.apiBase}/diff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uri: fileUri,
          original,
          modified,
          explanation,
        }),
      });

      if (!response.ok) {
        throw new VibeChatError(
          `Diff generation failed: ${response.statusText}`,
          ERROR_CODES.API_ERROR
        );
      }

      return await response.json() as FileDiff;
    } catch (error) {
      // Fallback: generate simple diff locally
      console.error('[VibeChat] Diff API error, using fallback:', error);
      return this.generateSimpleDiff(fileUri, original, modified, explanation);
    }
  }

  /**
   * Apply a diff to a file.
   *
   * @param diff - The diff to apply
   * @returns Whether the application was successful
   */
  async applyDiff(diff: FileDiff): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/apply-diff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(diff),
      });

      if (!response.ok) {
        throw new VibeChatError(
          `Diff application failed: ${response.statusText}`,
          ERROR_CODES.API_ERROR
        );
      }

      const result = await response.json();
      return result.success === true;
    } catch (error) {
      console.error('[VibeChat] Apply diff error:', error);
      return false;
    }
  }

  // ========================================================================
  // Conversation Persistence
  // ========================================================================

  /**
   * Save a conversation.
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    try {
      const response = await fetch(`${this.apiBase}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(conversation),
      });

      if (!response.ok) {
        throw new VibeChatError(
          `Failed to save conversation: ${response.statusText}`,
          ERROR_CODES.API_ERROR
        );
      }
    } catch (error) {
      console.error('[VibeChat] Save conversation error:', error);
      // Non-fatal: continue without saving
    }
  }

  /**
   * List all conversations.
   */
  async listConversations(): Promise<ConversationSummary[]> {
    try {
      const response = await fetch(`${this.apiBase}/conversations`);

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.conversations || [];
    } catch (error) {
      console.error('[VibeChat] List conversations error:', error);
      return [];
    }
  }

  /**
   * Load a conversation by ID.
   */
  async loadConversation(id: string): Promise<Conversation | null> {
    try {
      const response = await fetch(`${this.apiBase}/conversations/${encodeURIComponent(id)}`);

      if (!response.ok) {
        return null;
      }

      return await response.json() as Conversation;
    } catch (error) {
      console.error('[VibeChat] Load conversation error:', error);
      return null;
    }
  }

  /**
   * Delete a conversation.
   */
  async deleteConversation(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      console.error('[VibeChat] Delete conversation error:', error);
      return false;
    }
  }

  // ========================================================================
  // Event Listeners
  // ========================================================================

  /**
   * Subscribe to streaming message events.
   */
  onMessage(callback: StreamingCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  /**
   * Subscribe to state change events.
   */
  onStateChange(
    callback: (state: 'idle' | 'streaming' | 'error') => void
  ): () => void {
    this.stateChangeCallbacks.add(callback);
    callback(this.currentState);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  /**
   * Get current state.
   */
  getState(): 'idle' | 'streaming' | 'error' {
    return this.currentState;
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Cancel all active streams.
   */
  cancelAllStreams(): void {
    this.streamingAdapter.cancelAllStreams();
    this.activeStreams.clear();
    this.setState('idle');
  }

  /**
   * Create a message object.
   */
  createMessage(
    content: string,
    role: ChatMessage['role'] = 'user',
    metadata?: Partial<ChatMessage>
  ): ChatMessage {
    return {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
      timestamp: Date.now(),
      ...metadata,
    };
  }

  /**
   * Estimate token count for text (rough approximation).
   */
  estimateTokens(text: string): number {
    // Rough approximation: ~4 chars per token for English text
    // This varies by language and content
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate cost for a given model and token usage.
   */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Pricing per 1M tokens (as of 2025)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-opus-4-5': { input: 15, output: 75 },
      'claude-sonnet-4-5': { input: 3, output: 15 },
      'claude-haiku-4-5': { input: 1, output: 5 },
      'gpt-4o': { input: 5, output: 15 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'o1': { input: 15, output: 60 },
      'o1-mini': { input: 3, output: 12 },
    };

    const prices = pricing[model] || pricing['claude-sonnet-4-5'];
    const inputCost = (inputTokens / 1_000_000) * prices.input;
    const outputCost = (outputTokens / 1_000_000) * prices.output;

    return inputCost + outputCost;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private setState(state: 'idle' | 'streaming' | 'error'): void {
    this.currentState = state;
    this.stateChangeCallbacks.forEach((cb) => {
      try {
        cb(state);
      } catch (error) {
        console.error('[VibeChat] State change callback error:', error);
      }
    });
  }

  private notifyMessageListeners(chunk: StreamChunk): void {
    this.messageCallbacks.forEach((cb) => {
      try {
        cb(chunk);
      } catch (error) {
        console.error('[VibeChat] Message callback error:', error);
      }
    });
  }

  private createErrorFromResponse(response: Response): VibeChatError {
    let code = ERROR_CODES.API_ERROR;
    let message = `HTTP ${response.status}: ${response.statusText}`;

    if (response.status === 429) {
      code = ERROR_CODES.RATE_LIMIT;
      message = 'Rate limit exceeded. Please wait a moment.';
    } else if (response.status === 413) {
      code = ERROR_CODES.CONTEXT_TOO_LARGE;
      message = 'Context too large. Try reducing the number of files.';
    }

    return new VibeChatError(message, code);
  }

  /**
   * Generate a simple diff locally (fallback when API fails).
   */
  private generateSimpleDiff(
    fileUri: string,
    original: string,
    modified: string,
    explanation?: string
  ): FileDiff {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    const changes: FileDiff['changes'] = [];

    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const modifiedLine = modifiedLines[i];

      if (originalLine !== modifiedLine) {
        changes.push({
          line: i + 1,
          type: !originalLine ? 'addition' : !modifiedLine ? 'deletion' : 'modification',
          original: originalLine,
          modified: modifiedLine,
          reason: explanation,
        });
      }
    }

    // Extract language from URI
    const ext = fileUri.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
    };

    return {
      uri: fileUri,
      name: fileUri.split('/').pop() || fileUri,
      language: languageMap[ext] || ext,
      original,
      modified,
      changes,
      explanation,
      applicable: true,
    };
  }
}

// ============================================================================
// Helper Classes
// ============================================================================

/**
 * Conversation manager for handling chat history.
 */
export class ConversationManager {
  private service: VibeChatService;
  private currentConversation: Conversation | null = null;

  constructor(service: VibeChatService) {
    this.service = service;
  }

  /**
   * Start a new conversation.
   */
  startNew(title?: string): Conversation {
    this.currentConversation = {
      id: `conv-${Date.now()}`,
      title: title || 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return this.currentConversation;
  }

  /**
   * Add a message to the current conversation.
   */
  addMessage(message: ChatMessage): void {
    if (!this.currentConversation) {
      this.startNew();
    }

    this.currentConversation!.messages.push(message);
    this.currentConversation!.updatedAt = Date.now();

    // Auto-save
    this.save().catch(console.error);
  }

  /**
   * Get the current conversation.
   */
  getCurrent(): Conversation | null {
    return this.currentConversation;
  }

  /**
   * Load a conversation.
   */
  async load(id: string): Promise<Conversation | null> {
    const conversation = await this.service.loadConversation(id);
    if (conversation) {
      this.currentConversation = conversation;
    }
    return conversation;
  }

  /**
   * Save the current conversation.
   */
  async save(): Promise<void> {
    if (this.currentConversation) {
      await this.service.saveConversation(this.currentConversation);
    }
  }

  /**
   * Clear the current conversation.
   */
  clear(): void {
    this.currentConversation = null;
  }

  /**
   * Generate a title from the first user message.
   */
  generateTitle(): void {
    if (!this.currentConversation || this.currentConversation.messages.length === 0) {
      return;
    }

    const firstUserMessage = this.currentConversation.messages.find(
      (m) => m.role === 'user'
    );

    if (firstUserMessage) {
      const title = this.generateTitleFromMessage(firstUserMessage.content);
      this.currentConversation.title = title;
    }
  }

  private generateTitleFromMessage(content: string): string {
    const maxLength = 50;
    const trimmed = content.trim();

    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    const truncated = trimmed.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 0) {
      return truncated.slice(0, lastSpace) + '...';
    }

    return truncated + '...';
  }
}

export default VibeChatService;
