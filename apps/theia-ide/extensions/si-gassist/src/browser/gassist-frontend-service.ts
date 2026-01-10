/**
 * StudyLoG.AI - G-Assist Frontend Service
 *
 * Handles API communication for G-Assist features:
 * - Speech-to-Text (STT)
 * - Text-to-Speech (TTS)
 * - First-mile routing
 * - Chat with agents
 * - Conversation history persistence
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  STTResult,
  TTSResult,
  RouteDecision,
  ChatMessage,
  IDEContext,
  API_ENDPOINTS,
  GAssistAgent,
  ConversationSummary,
  ConversationDetail,
  ConversationUpsertRequest,
  ConversationUpsertResponse,
  ConversationsListResponse,
} from '../common';

/**
 * In-memory state for the active conversation.
 *
 * This allows the service to auto-save after each message without requiring
 * the widget to track conversation state. The widget can focus on UI while
 * the service handles persistence.
 */
interface ActiveConversationState {
  id?: string;
  userId: string;
  agent: GAssistAgent;
  messages: ChatMessage[];
  context?: IDEContext;
}

@injectable()
export class GAssistFrontendService {
  private apiBase: string;
  private activeConversation: ActiveConversationState | null = null;

  constructor() {
    // API base URL - can be configured via environment variable
    // TODO: Make this configurable via Theia preferences system (tracked separately)
    this.apiBase = typeof process !== 'undefined' && process.env?.G_ASSIST_API_BASE
      ? process.env.G_ASSIST_API_BASE
      : '/api/v1/g-assist';

    // Initialize active conversation from session storage if available
    // This allows conversation to persist across page reloads
    this.restoreActiveConversation();
  }

  /**
   * Transcribe audio buffer to text using the specified STT provider.
   *
   * @param audioBuffer - Raw audio data from MediaRecorder
   * @param provider - STT provider to use ('local' for browser-based, others for API)
   * @returns Transcription result with text, confidence, and alternatives
   * @throws Error if transcription fails or provider is unavailable
   *
   * @example
   * ```ts
   * const audioBlob = await recorder.getAudioData();
   * const result = await service.transcribe(audioBlob, 'local');
   * console.log(`Transcribed: ${result.text} (${result.confidence}% confidence)`);
   * ```
   */
  async transcribe(audioBuffer: ArrayBuffer, provider: string): Promise<STTResult> {
    const response = await fetch(`${this.apiBase}/stt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/webm',
        'X-STT-Provider': provider,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      throw new Error(`STT failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Synthesize text to speech audio using the specified TTS provider.
   *
   * @param text - The text to synthesize to speech
   * @param provider - TTS provider ('web-speech' for browser, others for API)
   * @returns TTS result with audio URL or data, duration, and provider info
   * @throws Error if synthesis fails or provider is unavailable
   *
   * @example
   * ```ts
   * const result = await service.synthesize('Hello world', 'web-speech');
   * const audio = new Audio(result.audioUrl);
   * audio.play();
   * ```
   */
  async synthesize(text: string, provider: string): Promise<TTSResult> {
    const response = await fetch(`${this.apiBase}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, provider }),
    });

    if (!response.ok) {
      throw new Error(`TTS failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Route user query to the most appropriate agent based on intent classification.
   *
   * Uses the first-mile-router to analyze the query and determine which
   * specialized agent should handle it (teacher, builder, tester, director, captain).
   *
   * @param query - The user's question or request
   * @param context - Optional IDE context (module, open files, etc.)
   * @returns Route decision with agent, confidence, and reasoning
   * @throws Error if routing fails
   *
   * @example
   * ```ts
   * const decision = await service.route('Help me debug this function', {
   *   module: 'cognitive-mill',
   *   openFiles: ['main.ts']
   * });
   * console.log(`Routed to ${decision.agent} with ${decision.confidence} confidence`);
   * ```
   */
  async route(query: string, context: IDEContext): Promise<RouteDecision> {
    const response = await fetch(`${this.apiBase}/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, context }),
    });

    if (!response.ok) {
      throw new Error(`Routing failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send chat message to agent
   *
   * Auto-saves the conversation after each message exchange.
   * The conversation is persisted with the full message history.
   */
  async chat(
    agent: GAssistAgent,
    messages: ChatMessage[],
    context: IDEContext,
    userId?: string
  ): Promise<{ content: string; agent: string; model: string }> {
    const response = await fetch(`${this.apiBase}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agent, messages, context }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Auto-save conversation after successful chat
    // This happens automatically without requiring the widget to call save
    if (userId) {
      this.saveConversationInternal(userId, agent, messages, context).catch((error) => {
        // Don't fail the chat if save fails - log and continue
        console.error('[G-Assist] Failed to auto-save conversation:', error);
      });
    }

    return result;
  }

  /**
   * Speak text using browser TTS or API.
   *
   * Note: Errors are logged but do not throw to avoid interrupting chat flow.
   * TTS is a "nice to have" feature that should fail silently.
   */
  async speak(text: string, provider: string): Promise<void> {
    try {
      if (provider === 'web-speech' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      } else {
        // Use API-based TTS
        const result = await this.synthesize(text, provider);
        const audio = new Audio(result.audioUrl);
        // Note: audio.play() returns a Promise but we don't await it
        // as it's non-critical for the chat flow
        audio.play().catch((error) => {
          // Silently log TTS playback errors
          console.error('[G-Assist] TTS audio playback failed:', error);
        });
      }
    } catch (error) {
      // Silently log TTS errors - non-critical for chat functionality
      console.error('[G-Assist] TTS failed:', error);
    }
  }

  // ============================================================================
  // Conversation Persistence Methods
  // ============================================================================

  /**
   * Start a new conversation context.
   *
   * Call this when the user starts a new chat or loads an existing one.
   * This allows the service to track the active conversation and auto-save.
   *
   * @param userId - User identifier (student_id or OAuth ID)
   * @param agent - The agent handling this conversation
   * @param conversationId - Optional existing conversation ID (for loading)
   * @param context - Optional IDE context
   */
  startConversation(
    userId: string,
    agent: GAssistAgent,
    conversationId?: string,
    context?: IDEContext
  ): void {
    this.activeConversation = {
      id: conversationId,
      userId,
      agent,
      messages: [],
      context,
    };

    // Persist to session storage for reload recovery
    this.saveToSessionStorage();
  }

  /**
   * Add a message to the active conversation.
   *
   * Called by the widget when user sends a message or receives a response.
   * The message is added to local state and the conversation is auto-saved.
   *
   * @param message - The chat message to add
   * @returns The updated conversation ID and title
   */
  async addMessage(message: ChatMessage): Promise<ConversationUpsertResponse | null> {
    if (!this.activeConversation) {
      console.warn('[G-Assist] Cannot add message: no active conversation');
      return null;
    }

    // Add message to local state
    this.activeConversation.messages.push(message);

    // Auto-save after each message
    try {
      const result = await this.saveConversationInternal(
        this.activeConversation.userId,
        this.activeConversation.agent,
        this.activeConversation.messages,
        this.activeConversation.context,
        this.activeConversation.id
      );

      // Update the conversation ID if this was a new conversation
      if (result.conversationId && !this.activeConversation.id) {
        this.activeConversation.id = result.conversationId;
      }

      this.saveToSessionStorage();
      return result;
    } catch (error) {
      console.error('[G-Assist] Failed to save after adding message:', error);
      return null;
    }
  }

  /**
   * Get the current active conversation state.
   *
   * Useful for the widget to check if there's an active conversation
   * and display its messages.
   */
  getActiveConversation(): ActiveConversationState | null {
    return this.activeConversation;
  }

  /**
   * Clear the active conversation.
   *
   * Call this when the user explicitly starts a new conversation.
   */
  clearActiveConversation(): void {
    this.activeConversation = null;
    sessionStorage.removeItem('gassist:active_conversation');
  }

  /**
   * Save or update a conversation.
   *
   * Uses the upsert pattern - creates new conversation if no ID is provided,
   * otherwise updates the existing one.
   *
   * Why we store messages as JSON:
   * - Flexibility: Easy to add new fields without schema changes
   * - Queryability: SQLite has built-in JSON functions for extracting data
   * - Simplicity: Single table vs separate messages table with JOINs
   * - Trade-off: Not ideal for complex queries on individual messages,
   *   but perfect for "load full conversation" pattern
   *
   * @param request - The conversation upsert request
   * @returns The saved conversation ID and metadata
   */
  async saveConversation(request: ConversationUpsertRequest): Promise<ConversationUpsertResponse> {
    const response = await fetch(`${this.apiBase}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to save conversation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List all conversations for a user.
   *
   * Returns conversations sorted by most recently updated.
   * The summary excludes full messages for lighter payloads.
   *
   * @param userId - User identifier
   * @returns List of conversation summaries
   */
  async listConversations(userId: string): Promise<ConversationSummary[]> {
    const response = await fetch(`${this.apiBase}/conversations/${encodeURIComponent(userId)}`);

    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.statusText}`);
    }

    const data = (await response.json()) as ConversationsListResponse;
    return data.conversations;
  }

  /**
   * Load a full conversation by ID.
   *
   * Returns complete conversation with all messages and context.
   * Use this when user opens a conversation from the list.
   *
   * @param userId - User identifier
   * @param conversationId - The conversation ID to load
   * @returns Full conversation details
   */
  async loadConversation(
    userId: string,
    conversationId: string
  ): Promise<ConversationDetail> {
    const response = await fetch(
      `${this.apiBase}/conversations/${encodeURIComponent(userId)}/${encodeURIComponent(conversationId)}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Conversation not found');
      }
      throw new Error(`Failed to load conversation: ${response.statusText}`);
    }

    const conversation = (await response.json()) as ConversationDetail;

    // Set as active conversation
    this.activeConversation = {
      id: conversation.id,
      userId,
      agent: conversation.agent,
      messages: conversation.messages,
      context: conversation.context,
    };
    this.saveToSessionStorage();

    return conversation;
  }

  /**
   * Delete a conversation.
   *
   * Permanently removes a conversation from history.
   *
   * @param userId - User identifier
   * @param conversationId - The conversation ID to delete
   */
  async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const response = await fetch(
      `${this.apiBase}/conversations/${encodeURIComponent(userId)}/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`);
    }

    // Clear active conversation if it was the deleted one
    if (this.activeConversation?.id === conversationId) {
      this.clearActiveConversation();
    }
  }

  /**
   * Internal method to save conversation with auto-generated title.
   *
   * Title generation strategy:
   * - First 50 characters of first user message
   * - Truncated at word boundary to avoid cutting mid-word
   * - Fallback to "New Conversation" if no messages
   *
   * Example:
   *   "Help me understand how neural networks learn from training data"
   *   -> "Help me understand how neural networks learn..."
   *
   * This creates meaningful, human-readable titles without user input.
   *
   * @private
   */
  private async saveConversationInternal(
    userId: string,
    agent: GAssistAgent,
    messages: ChatMessage[],
    context?: IDEContext,
    conversationId?: string
  ): Promise<ConversationUpsertResponse> {
    // Generate title from first user message if not explicitly set
    // This happens automatically on first save
    const title = this.generateTitle(messages);

    const request: ConversationUpsertRequest = {
      id: conversationId,
      userId,
      agent,
      title,
      messages,
      context,
    };

    return this.saveConversation(request);
  }

  /**
   * Generate a conversation title from the first user message.
   *
   * Strategy:
   * 1. Find the first user message (not system or assistant)
   * 2. Take first 50 characters
   * 3. Truncate at last complete word within 50 chars
   * 4. Append ellipsis if truncated
   *
   * @private
   */
  private generateTitle(messages: ChatMessage[]): string | undefined {
    // Only generate on first save (when no custom title exists)
    if (messages.length === 0) {
      return undefined;
    }

    const firstUserMessage = messages.find((msg) => msg.role === 'user');
    if (!firstUserMessage || !firstUserMessage.content) {
      return undefined;
    }

    const content = firstUserMessage.content.trim();
    const maxLength = 50;

    if (content.length <= maxLength) {
      return content;
    }

    // Truncate at word boundary
    const truncated = content.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > 0) {
      return truncated.slice(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Restore active conversation from session storage.
   *
   * Allows conversation to persist across page reloads.
   *
   * @private
   */
  private restoreActiveConversation(): void {
    try {
      const stored = sessionStorage.getItem('gassist:active_conversation');
      if (stored) {
        this.activeConversation = JSON.parse(stored) as ActiveConversationState;
      }
    } catch (error) {
      console.error('[G-Assist] Failed to restore active conversation:', error);
    }
  }

  /**
   * Save active conversation to session storage.
   *
   * @private
   */
  private saveToSessionStorage(): void {
    if (this.activeConversation) {
      sessionStorage.setItem(
        'gassist:active_conversation',
        JSON.stringify(this.activeConversation)
      );
    }
  }
}
