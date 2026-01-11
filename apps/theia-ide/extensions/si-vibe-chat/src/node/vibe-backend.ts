/**
 * StudyLoG.AI - Vibe Chat Backend Service
 *
 * Backend service for AI chat interactions running in Node.js.
 * Integrates with the multi-model router worker for AI responses.
 *
 * Features:
 * - Chat completion with streaming support
 * - Agent routing via first-mile router
 * - Context gathering from workspace
 * - Diff generation and application
 * - Conversation persistence
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { FileSystem } from '@theia/filesystem/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/common/workspace-service';
import {
  ChatMessage,
  FileReference,
  FileDiff,
  AgentType,
  ContextReason,
  Conversation,
} from '../common';

// ============================================================================
// Types
// ============================================================================

/**
 * Chat request from frontend
 */
export interface BackendChatRequest {
  messages: ChatMessage[];
  agent?: AgentType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  files?: FileReference[];
  stream?: boolean;
}

/**
 * Chat response for non-streaming
 */
export interface BackendChatResponse {
  message: ChatMessage;
  agent: AgentType;
  model: string;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

/**
 * Streaming chunk for SSE
 */
export interface BackendStreamChunk {
  type: 'metadata' | 'content' | 'code_block' | 'diff' | 'file_ref' | 'status' | 'error' | 'done';
  content: string;
  metadata?: {
    messageId?: string;
    agent?: AgentType;
    model?: string;
    language?: string;
    filePath?: string;
    line?: number;
    changeType?: string;
    tokens?: number;
    cost?: number;
  };
}

/**
 * Context gathering request
 */
export interface ContextRequest {
  maxTokens?: number;
  includeActiveFile?: boolean;
  includeSelection?: boolean;
  semanticSearch?: boolean;
  query?: string;
}

/**
 * Route request
 */
export interface RouteRequest {
  query: string;
  context?: {
    files?: FileReference[];
    activeModule?: string;
  };
}

/**
 * Route response
 */
export interface RouteResponse {
  agent: AgentType;
  confidence: number;
  reasoning: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Vibe Chat backend service.
 *
 * Handles AI chat requests by integrating with the multi-model router
 * and first-mile router workers.
 */
@injectable()
export class VibeChatBackendService {
  // Base URL for the multi-model router API
  private readonly multiModelApiBase: string;

  // Base URL for the first-mile router
  private readonly firstMileApiBase: string;

  @inject(FileSystem)
  protected readonly fileSystem: FileSystem;

  @inject(WorkspaceService)
  protected readonly workspaceService: WorkspaceService;

  constructor() {
    // Determine API base URLs from environment or defaults
    this.multiModelApiBase =
      process.env?.MULTI_MODEL_API_BASE || 'http://localhost:8787';
    this.firstMileApiBase =
      process.env?.FIRST_MILE_API_BASE || 'http://localhost:8788';
  }

  /**
   * Handle chat completion request (non-streaming).
   */
  async chat(request: BackendChatRequest): Promise<BackendChatResponse> {
    // Route to agent if auto
    let agent = request.agent || 'auto';
    if (agent === 'auto') {
      const route = await this.route(request.messages[request.messages.length - 1]?.content || '');
      agent = route.agent;
    }

    // Build request for multi-model router
    const apiRequest = {
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      model: request.model || 'claude-sonnet-4-5',
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 4096,
      agent,
      context: await this.buildContext(request.files),
    };

    // Call the API
    const response = await fetch(`${this.multiModelApiBase}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat API error: ${response.statusText} - ${error}`);
    }

    const data = await response.json();

    return {
      message: {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: data.content || data.message?.content || '',
        timestamp: Date.now(),
        agent,
        model: data.model || request.model || 'claude-sonnet-4-5',
        cost: data.cost,
        tokens: data.usage || data.tokens,
      },
      agent,
      model: data.model || request.model || 'claude-sonnet-4-5',
      cost: data.cost,
      tokens: data.usage || data.tokens,
    };
  }

  /**
   * Handle streaming chat completion.
   *
   * Returns a readable stream for SSE responses.
   */
  async *chatStream(request: BackendChatRequest): AsyncGenerator<BackendStreamChunk> {
    // Route to agent if auto
    let agent = request.agent || 'auto';
    if (agent === 'auto' && request.messages.length > 0) {
      const lastMessage = request.messages[request.messages.length - 1];
      const route = await this.route(lastMessage?.content || '');
      agent = route.agent;
    }

    const messageId = `msg-${Date.now()}`;

    // Send metadata first
    yield {
      type: 'metadata',
      content: '',
      metadata: {
        messageId,
        agent,
        model: request.model || 'claude-sonnet-4-5',
      },
    };

    try {
      // Build request for multi-model router
      const apiRequest = {
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        model: request.model || 'claude-sonnet-4-5',
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 4096,
        agent,
        context: await this.buildContext(request.files),
        stream: true,
      };

      // Call the streaming API
      const response = await fetch(`${this.multiModelApiBase}/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(apiRequest),
      });

      if (!response.ok) {
        throw new Error(`Stream API error: ${response.statusText}`);
      }

      // Read SSE stream
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

        // Parse SSE data lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content') {
                yield {
                  type: 'content',
                  content: parsed.content || '',
                  metadata: {
                    messageId,
                    tokens: parsed.tokens,
                    cost: parsed.cost,
                  },
                };
              } else if (parsed.type === 'done') {
                yield {
                  type: 'done',
                  content: '',
                };
                return;
              } else if (parsed.type === 'error') {
                yield {
                  type: 'error',
                  content: parsed.error || 'Unknown error',
                };
                return;
              }
            } catch {
              // Not JSON, might be [DONE] or similar
              if (data === '[DONE]') {
                yield {
                  type: 'done',
                  content: '',
                };
                return;
              }
            }
          }
        }
      }

      // Ensure we send done
      yield {
        type: 'done',
        content: '',
      };

    } catch (error) {
      yield {
        type: 'error',
        content: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Route a query to the appropriate agent.
   */
  async route(query: string, context?: RouteRequest['context']): Promise<RouteResponse> {
    try {
      const response = await fetch(`${this.firstMileApiBase}/route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, context }),
      });

      if (!response.ok) {
        // Fallback to builder agent on error
        return {
          agent: 'builder',
          confidence: 0,
          reasoning: 'Routing unavailable, using builder agent',
        };
      }

      return await response.json() as RouteResponse;
    } catch (error) {
      return {
        agent: 'builder',
        confidence: 0,
        reasoning: 'Routing error, using builder agent',
      };
    }
  }

  /**
   * Gather context from the workspace.
   */
  async gatherContext(request: ContextRequest = {}): Promise<FileReference[]> {
    const files: FileReference[] = [];

    try {
      // Get workspace root
      const workspaceRoot = await this.workspaceService.roots;
      if (!workspaceRoot || workspaceRoot.length === 0) {
        return files;
      }

      const rootUri = workspaceRoot[0].resource.toString();

      // Include active file if requested
      if (request.includeActiveFile) {
        // This would need to be implemented with editor service integration
        // For now, skip
      }

      // Semantic search if requested
      if (request.semanticSearch && request.query) {
        // This would need to be implemented with a vector search service
        // For now, add some heuristic-based results
      }

      return files;
    } catch (error) {
      console.error('[VibeChatBackend] Context gathering error:', error);
      return files;
    }
  }

  /**
   * Generate a diff for file changes.
   */
  async generateDiff(
    fileUri: string,
    original: string,
    modified: string,
    explanation?: string
  ): Promise<FileDiff> {
    // Import diff library
    // For now, use simple line-by-line comparison
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    const changes: FileDiff['changes'] = [];
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

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

  /**
   * Apply a diff to a file.
   */
  async applyDiff(diff: FileDiff): Promise<{ success: boolean; error?: string }> {
    try {
      const stat = await this.fileSystem.getFileStat(diff.uri);

      if (!stat) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      // Write the modified content
      await this.fileSystem.setContent(diff.uri, modified);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ========================================================================
  // Conversation Persistence
  // ========================================================================

  /**
   * Save a conversation to storage.
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    // Use Theia's storage service or localStorage
    try {
      const key = `vibe-chat:conversation:${conversation.id}`;
      const data = JSON.stringify(conversation);

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, data);
      }

      // Update index
      if (typeof localStorage !== 'undefined') {
        const indexKey = 'vibe-chat:conversations:index';
        const index: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');

        if (!index.includes(conversation.id)) {
          index.push(conversation.id);
          localStorage.setItem(indexKey, JSON.stringify(index));
        }
      }
    } catch (error) {
      console.error('[VibeChatBackend] Save conversation error:', error);
    }
  }

  /**
   * List all conversations.
   */
  async listConversations(): Promise<Conversation[]> {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }

      const indexKey = 'vibe-chat:conversations:index';
      const index: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');

      const conversations: Conversation[] = [];

      for (const id of index) {
        const key = `vibe-chat:conversation:${id}`;
        const data = localStorage.getItem(key);

        if (data) {
          try {
            const conversation = JSON.parse(data) as Conversation;
            conversations.push(conversation);
          } catch {
            // Skip invalid conversations
          }
        }
      }

      // Sort by updated time
      conversations.sort((a, b) => b.updatedAt - a.updatedAt);

      return conversations;
    } catch (error) {
      console.error('[VibeChatBackend] List conversations error:', error);
      return [];
    }
  }

  /**
   * Load a conversation by ID.
   */
  async loadConversation(id: string): Promise<Conversation | null> {
    try {
      if (typeof localStorage === 'undefined') {
        return null;
      }

      const key = `vibe-chat:conversation:${id}`;
      const data = localStorage.getItem(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as Conversation;
    } catch (error) {
      console.error('[VibeChatBackend] Load conversation error:', error);
      return null;
    }
  }

  /**
   * Delete a conversation.
   */
  async deleteConversation(id: string): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const key = `vibe-chat:conversation:${id}`;
      localStorage.removeItem(key);

      // Update index
      const indexKey = 'vibe-chat:conversations:index';
      const index: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');

      const updatedIndex = index.filter((i) => i !== id);
      localStorage.setItem(indexKey, JSON.stringify(updatedIndex));
    } catch (error) {
      console.error('[VibeChatBackend] Delete conversation error:', error);
    }
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Build context string from file references.
   */
  private async buildContext(files?: FileReference[]): Promise<string> {
    if (!files || files.length === 0) {
      return '';
    }

    const contextParts: string[] = [];

    for (const file of files) {
      try {
        const content = await this.fileSystem.getContent(file.uri);
        contextParts.push(`\n// File: ${file.name}\n${content}`);
      } catch {
        // Skip files that can't be read
      }
    }

    return contextParts.join('\n');
  }

  /**
   * Estimate token count for text.
   */
  private estimateTokens(text: string): number {
    // Rough approximation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }
}

export default VibeChatBackendService;
