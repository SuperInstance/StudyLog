/**
 * Chat Service
 *
 * Main chat interface handling vibe coding mode and spec mode.
 * Integrates with multi-model router for AI responses.
 */

import type {
  ChatMessage,
  ChatSession,
  ChatMode,
  ContextFile,
  StreamChunk,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';
import { MessageStore, generateSessionId } from './message-store.js';
import {
  StreamProcessor,
  createSSEResponse,
  parseOpenAIStream,
  parseAnthropicStream,
  simulateStreaming,
  createContextWindowManager,
} from './streaming.js';

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  vibe: `You are StudyLoG.AI's coding assistant, helping a developer in their IDE workspace.

Your role is to be helpful, concise, and practical. Focus on:
- Solving specific problems the user presents
- Providing code examples when helpful
- Explaining concepts clearly but briefly
- Suggesting improvements when appropriate

Keep responses focused and actionable. If you need more context, ask specific questions.

You have access to the user's workspace files. Use this context to provide relevant assistance.`,
  spec: `You are StudyLoG.AI's technical specification assistant.

Your role is to help the user create detailed, structured specifications for:
- New features and components
- API endpoints and services
- Database schemas and migrations
- System architecture changes

When generating specifications, include:
1. **Overview**: Brief description of what's being specified
2. **Requirements**: Functional and non-functional requirements
3. **Interface**: APIs, types, and data structures
4. **Implementation Notes**: Technical considerations
5. **Testing**: Test cases and validation criteria

Be thorough and structured. Use clear formatting with headers and bullet points.`,
};

// ============================================================================
// Chat Service
// ============================================================================

interface ChatOptions {
  /** Stream response */
  stream?: boolean;
  /** Model to use */
  model?: string;
  /** Provider to use */
  provider?: string;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  maxTokens?: number;
}

interface ChatResponse {
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
  /** Token usage */
  usage: {
    input: number;
    output: number;
    cached: number;
  };
  /** Cost in USD */
  cost: number;
}

/**
 * Main chat service
 */
export class ChatService {
  private readonly messageStore: MessageStore;
  private readonly contextManager: ReturnType<typeof createContextWindowManager>;
  private readonly routerUrl: string;

  constructor(
    private readonly env: IDEAutomationEnv,
    routerUrl = 'https://multi-model-router.studylog.ai'
  ) {
    this.messageStore = new MessageStore(env.CHAT_HISTORY, env.IDE_STATE);
    this.contextManager = createContextWindowManager(
      parseInt(env.MAX_CONTEXT_TOKENS || '128000')
    );
    this.routerUrl = routerUrl;
  }

  /**
   * Start a new chat session
   */
  async startSession(
    userId: string,
    workspaceId: string,
    mode: ChatMode = 'vibe',
    contextFiles: ContextFile[] = []
  ): Promise<ChatSession> {
    return await this.messageStore.createSession(userId, workspaceId, mode, contextFiles);
  }

  /**
   * Send a message and get response
   */
  async chat(
    sessionId: string,
    content: string,
    options: ChatOptions = {}
  ): Promise<ChatResponse> {
    const session = await this.messageStore.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message
    await this.messageStore.addMessage(sessionId, {
      role: 'user',
      content,
    });

    // Prepare messages for API
    const messages = this.prepareMessages(session, content);

    // Call the router
    const response = await this.callRouter(messages, session.mode, options);

    // Add assistant message
    await this.messageStore.addMessage(sessionId, {
      role: 'assistant',
      content: response.content,
    });

    return response;
  }

  /**
   * Send a message with streaming response
   */
  async chatStream(
    sessionId: string,
    content: string,
    options: ChatOptions = {}
  ): Promise<ReadableStream<StreamChunk>> {
    const session = await this.messageStore.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add user message
    await this.messageStore.addMessage(sessionId, {
      role: 'user',
      content,
    });

    // Create stream processor
    const processor = new StreamProcessor({
      chunkSize: parseInt(env.STREAM_CHUNK_SIZE || '100'),
      includeMetadata: true,
    });

    const stream = processor.createStream();

    // Process asynchronously
    this.processStreamResponse(session, content, processor, options)
      .catch((error) => {
        processor.error(error.message);
      });

    return stream;
  }

  /**
   * Create SSE response from chat
   */
  async chatSSE(
    sessionId: string,
    content: string,
    options: ChatOptions = {}
  ): Promise<Response> {
    const stream = await this.chatStream(sessionId, content, options);
    return createSSEResponse(stream);
  }

  /**
   * Add context files to session
   */
  async addContext(sessionId: string, files: ContextFile[]): Promise<void> {
    await this.messageStore.attachContext(sessionId, files);
  }

  /**
   * Remove context file from session
   */
  async removeContext(sessionId: string, filePath: string): Promise<void> {
    await this.messageStore.removeContext(sessionId, filePath);
  }

  /**
   * Set chat mode
   */
  async setMode(sessionId: string, mode: ChatMode): Promise<void> {
    await this.messageStore.setMode(sessionId, mode);
  }

  /**
   * Get session history
   */
  async getHistory(sessionId: string): Promise<ChatSession | null> {
    return await this.messageStore.getSession(sessionId);
  }

  /**
   * List user's sessions
   */
  async listSessions(
    userId: string,
    workspaceId?: string,
    limit = 20
  ): Promise<ChatSession[]> {
    return await this.messageStore.listSessions(userId, workspaceId, limit);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.messageStore.deleteSession(sessionId);
  }

  /**
   * Create a branch from a message
   */
  async createBranch(
    sessionId: string,
    fromMessageId: string,
    branchName: string
  ): Promise<ChatSession> {
    await this.messageStore.createBranch(sessionId, fromMessageId, branchName);
    return await this.messageStore.getSession(sessionId) as ChatSession;
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(sessionId: string, branchId: string): Promise<ChatSession> {
    return await this.messageStore.switchBranch(sessionId, branchId);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Prepare messages for API call
   */
  private prepareMessages(session: ChatSession, newContent: string): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // Add system prompt
    messages.push({
      role: 'system',
      content: SYSTEM_PROMPTS[session.mode],
    });

    // Add context files if present
    if (session.contextFiles.length > 0) {
      const contextText = this.buildContextText(session.contextFiles);
      messages.push({
        role: 'system',
        content: `Here are the relevant files from the workspace:\n\n${contextText}`,
      });
    }

    // Add recent messages
    const maxTokens = this.contextManager.getAvailableTokens(
      SYSTEM_PROMPTS[session.mode],
      session.messages.length
    );

    const truncated = this.contextManager.truncateMessages(
      session.messages,
      maxTokens
    );

    messages.push(...truncated);

    return messages;
  }

  /**
   * Build context text from files
   */
  private buildContextText(files: ContextFile[]): string {
    return files.map((file) => {
      let text = `File: ${file.path}`;
      if (file.symbol) {
        text += ` (symbol: ${file.symbol})`;
      }
      text += `\n\`\`\`${file.language}`;
      if (file.startLine || file.endLine) {
        text += ` #L${file.startLine || 1}-${file.endLine || ''}`;
      }
      text += `\n${file.content}\n\`\`\`\n`;
      return text;
    }).join('\n');
  }

  /**
   * Call the multi-model router
   */
  private async callRouter(
    messages: ChatMessage[],
    mode: ChatMode,
    options: ChatOptions
  ): Promise<ChatResponse> {
    const requestBody = {
      model: options.model || 'deepseek-chat',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content || '',
      })),
      temperature: options.temperature ?? (mode === 'vibe' ? 0.7 : 0.3),
      max_tokens: options.maxTokens || 4096,
      provider: options.provider,
    };

    const response = await fetch(`${this.routerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Router error: ${error}`);
    }

    const data = await response.json() as {
      content: string;
      model: string;
      provider: string;
      tokens: { input: number; output: number; cacheRead?: number };
      cost: number;
    };

    return {
      content: data.content,
      model: data.model,
      provider: data.provider,
      usage: {
        input: data.tokens.input,
        output: data.tokens.output,
        cached: data.tokens.cacheRead || 0,
      },
      cost: data.cost,
    };
  }

  /**
   * Process streaming response
   */
  private async processStreamResponse(
    session: ChatSession,
    content: string,
    processor: StreamProcessor,
    options: ChatOptions
  ): Promise<void> {
    try {
      const messages = this.prepareMessages(session, content);

      const requestBody = {
        model: options.model || 'deepseek-chat',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content || '',
        })),
        temperature: options.temperature ?? (session.mode === 'vibe' ? 0.7 : 0.3),
        max_tokens: options.maxTokens || 4096,
        provider: options.provider,
        stream: true,
      };

      const response = await fetch(`${this.routerUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Router error: ${response.status}`);
      }

      // Parse the streaming response
      const provider = options.provider || 'deepseek';

      if (provider === 'anthropic' || requestBody.model.includes('claude')) {
        await parseAnthropicStream(response, processor);
      } else {
        await parseOpenAIStream(response, processor);
      }

      // Complete with metadata
      await processor.complete(0, 0, 0);

      // Save the complete response
      const stats = processor.getStats();
      await this.messageStore.addMessage(session.id, {
        role: 'assistant',
        content: '', // Will be reconstructed on client
      });

    } catch (error) {
      processor.error(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a chat service from environment
 */
export function createChatService(env: IDEAutomationEnv): ChatService {
  return new ChatService(env);
}
