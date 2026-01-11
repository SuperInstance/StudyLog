/**
 * Chat Service
 *
 * Main chat service with streaming support, context building,
 * and integration with multi-model router.
 */

import type {
  ChatRequest,
  ChatResponse,
  ChatSession,
  ChatMode,
  StreamChunk,
  ContextFile,
} from './types.js';
import type { VibeCodingEnv } from './types.js';
import { StreamProcessor } from './streaming.js';
import { ConversationMemory } from './conversation-memory.js';
import { ContextBuilder } from './context-builder.js';
import { estimateTokens, generateTitle } from './utils.js';

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPTS: Record<ChatMode, string> = {
  vibe: `You are StudyLoG.AI's vibe-coding assistant, helping developers write code in their IDE.

Your role is to be helpful, concise, and practical. Focus on:
- Solving specific problems the user presents
- Providing working code examples when helpful
- Explaining concepts clearly but briefly
- Suggesting improvements when appropriate

Keep responses focused and actionable. When you provide code:
- Include necessary imports
- Add brief comments for complex logic
- Mention any dependencies or setup required

You have access to the user's workspace files. Use this context to provide relevant assistance.`,

  spec: `You are StudyLoG.AI's technical specification assistant.

Your role is to help create detailed, structured specifications for:
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

  refactor: `You are StudyLoG.AI's refactoring assistant.

Your role is to help improve code quality while maintaining functionality:
- Identify code smells and anti-patterns
- Suggest cleaner, more maintainable alternatives
- Help with applying design patterns appropriately
- Ensure changes don't break existing functionality

When suggesting refactoring:
- Explain the reasoning behind the change
- Show before/after comparisons when helpful
- Highlight potential risks or edge cases
- Suggest testing strategies`,

  debug: `You are StudyLoG.AI's debugging assistant.

Your role is to help identify and fix bugs:
- Analyze error messages and stack traces
- Identify root causes of issues
- Suggest targeted fixes
- Recommend preventive measures

When debugging:
- Ask for relevant code snippets and error messages
- Consider edge cases and race conditions
- Suggest logging strategies for future debugging
- Help write tests to prevent regression`,
};

// ============================================================================
// Chat Options
// ============================================================================

export interface ChatOptions {
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
  /** Include context files */
  includeContext?: boolean;
}

// ============================================================================
// Chat Service
// ============================================================================

/**
 * Main chat service for vibe-coding interface
 */
export class ChatService {
  private readonly memory: ConversationMemory;
  private readonly contextBuilder: ContextBuilder;
  private readonly routerUrl: string;

  constructor(
    private readonly env: VibeCodingEnv,
    routerUrl?: string
  ) {
    this.memory = new ConversationMemory(env.CHAT_HISTORY, env.DB);
    this.contextBuilder = new ContextBuilder(env);
    this.routerUrl = routerUrl || env.MULTI_MODEL_ROUTER_URL || 'https://multi-model-router.studylog.ai';
  }

  /**
   * Handle a chat request with streaming
   */
  async chatStream(
    request: ChatRequest,
    processor: StreamProcessor
  ): Promise<ReadableStream<StreamChunk>> {
    const { sessionId, userId, workspaceId, message, mode = 'vibe' } = request;

    // Get or create session
    let session: ChatSession;
    if (sessionId) {
      const existing = await this.memory.getSession(sessionId);
      if (!existing) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      session = existing;
    } else {
      session = await this.memory.createSession(userId, workspaceId, mode, request.contextFiles || []);
    }

    // Update mode if provided
    if (request.mode && request.mode !== session.mode) {
      await this.memory.setMode(session.id, request.mode);
      session.mode = request.mode;
    }

    // Send status
    processor.sendStatus('thinking');

    // Build context if needed
    let contextFiles = session.contextFiles;

    if (request.includeContext !== false && contextFiles.length > 0) {
      processor.sendStatus('reading_files');
    }

    // Add user message
    await this.memory.addMessage(session.id, 'user', message);

    // Prepare messages for API
    const apiMessages = await this.prepareMessages(session, message);

    // Call the router with streaming
    processor.setStatus('generating');

    const stream = await this.callRouterStream(apiMessages, session.mode, request);

    // Process stream and update memory
    return this.processResponseStream(stream, processor, session.id);
  }

  /**
   * Handle a chat request without streaming
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { sessionId, userId, workspaceId, message, mode = 'vibe' } = request;

    // Get or create session
    let session: ChatSession;
    if (sessionId) {
      const existing = await this.memory.getSession(sessionId);
      if (!existing) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      session = existing;
    } else {
      session = await this.memory.createSession(userId, workspaceId, mode, request.contextFiles || []);
    }

    // Update mode if provided
    if (request.mode && request.mode !== session.mode) {
      await this.memory.setMode(session.id, request.mode);
      session.mode = request.mode;
    }

    // Add user message
    await this.memory.addMessage(session.id, 'user', message);

    // Prepare messages for API
    const apiMessages = await this.prepareMessages(session, message);

    // Call the router
    const response = await this.callRouter(apiMessages, session.mode, request);

    // Add assistant message
    await this.memory.addMessage(session.id, 'assistant', response.content);

    return {
      ...response,
      sessionId: session.id,
    };
  }

  /**
   * Get session history
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    return await this.memory.getSession(sessionId);
  }

  /**
   * List user's sessions
   */
  async listSessions(
    userId: string,
    workspaceId?: string,
    limit = 20
  ): Promise<ChatSession[]> {
    return await this.memory.listSessions(userId, workspaceId, limit);
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.memory.deleteSession(sessionId);
  }

  /**
   * Add context files to session
   */
  async addContext(sessionId: string, files: ContextFile[]): Promise<void> {
    await this.memory.attachContext(sessionId, files);
  }

  /**
   * Remove context file from session
   */
  async removeContext(sessionId: string, filePath: string): Promise<void> {
    await this.memory.removeContext(sessionId, filePath);
  }

  /**
   * Create a branch from a message
   */
  async createBranch(
    sessionId: string,
    fromMessageId: string,
    branchName: string
  ): Promise<ChatSession> {
    await this.memory.createBranch(sessionId, fromMessageId, branchName);
    return await this.memory.getSession(sessionId) as ChatSession;
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(sessionId: string, branchId: string): Promise<ChatSession> {
    return await this.memory.switchBranch(sessionId, branchId);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Prepare messages for API call
   */
  private async prepareMessages(session: ChatSession, newContent: string): Promise<Array<{ role: string; content: string }>> {
    const messages: Array<{ role: string; content: string }> = [];

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

    // Add recent messages (for context window management)
    const recentMessages = await this.memory.getRecentMessages(
      session.id,
      50,
      100000
    );

    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content || '',
      });
    }

    // Add the new user message
    messages.push({
      role: 'user',
      content: newContent,
    });

    return messages;
  }

  /**
   * Build context text from files
   */
  private buildContextText(files: ContextFile[]): string {
    return files.map(file => {
      let text = `File: ${file.path}`;
      if (file.symbol) {
        text += ` (symbol: ${file.symbol})`;
      }
      if (file.startLine || file.endLine) {
        text += ` (lines ${file.startLine || 1}-${file.endLine || ''})`;
      }
      text += `\n\`\`\`${file.language}\n${file.content}\n\`\`\`\n`;
      return text;
    }).join('\n');
  }

  /**
   * Call the multi-model router (non-streaming)
   */
  private async callRouter(
    messages: Array<{ role: string; content: string }>,
    mode: ChatMode,
    request: ChatRequest
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    usage: { input: number; output: number; cached: number };
    cost: number;
  }> {
    const requestBody = {
      model: request.model || 'deepseek-chat',
      messages,
      temperature: request.temperature ?? (mode === 'vibe' ? 0.7 : 0.3),
      max_tokens: request.maxTokens || 4096,
      provider: request.provider,
      stream: false,
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
   * Call the multi-model router with streaming
   */
  private async callRouterStream(
    messages: Array<{ role: string; content: string }>,
    mode: ChatMode,
    request: ChatRequest
  ): Promise<Response> {
    const requestBody = {
      model: request.model || 'deepseek-chat',
      messages,
      temperature: request.temperature ?? (mode === 'vibe' ? 0.7 : 0.3),
      max_tokens: request.maxTokens || 4096,
      provider: request.provider,
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

    return response;
  }

  /**
   * Process streaming response
   */
  private async processResponseStream(
    response: Response,
    processor: StreamProcessor,
    sessionId: string
  ): Promise<ReadableStream<StreamChunk>> {
    // Create a transform stream to process the response
    const stream = processor.createStream();

    // Process asynchronously
    this.processStreamToCompletion(response, processor, sessionId)
      .catch((error) => {
        processor.error(error.message);
      });

    return stream;
  }

  /**
   * Process stream to completion
   */
  private async processStreamToCompletion(
    response: Response,
    processor: StreamProcessor,
    sessionId: string
  ): Promise<void> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
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
              fullContent += content;
              await processor.processChunk(content);
            }

            // Check for completion metadata
            if (parsed.usage) {
              await processor.complete(
                parsed.usage.prompt_tokens || 0,
                parsed.usage.cache_read_tokens || 0,
                parsed.estimated_cost || 0,
                parsed.model || '',
                parsed.provider || ''
              );

              // Save the complete response
              await this.memory.addMessage(sessionId, 'assistant', fullContent);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }

      await processor.flush();
    } catch (error) {
      processor.error(error instanceof Error ? error.message : 'Stream processing failed');
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a chat service from environment
 */
export function createChatService(env: VibeCodingEnv, routerUrl?: string): ChatService {
  return new ChatService(env, routerUrl);
}
