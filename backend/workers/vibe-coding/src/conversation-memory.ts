/**
 * Conversation Memory
 *
 * Manages chat session persistence, message history, and branching.
 * Uses KV for fast access and D1 for durable storage.
 */

import type {
  ChatSession,
  ChatMessage,
  ChatBranch,
  ContextFile,
  ChatMode,
  MessageRole,
} from './types.js';
import type { VibeCodingEnv } from './types.js';
import {
  generateId,
  generateSessionId,
  generateMessageId,
  generateBranchId,
  generateTitle,
} from './utils.js';

// ============================================================================
// Conversation Memory
// ============================================================================

/**
 * Session TTL in seconds (30 days default)
 */
const SESSION_TTL = 60 * 60 * 24 * 30;

/**
 * Conversation memory manager
 */
export class ConversationMemory {
  constructor(
    private readonly kv: KVNamespace,
    private readonly db: D1Database | undefined
  ) {}

  /**
   * Create a new chat session
   */
  async createSession(
    userId: string,
    workspaceId: string,
    mode: ChatMode = 'vibe',
    initialContext: ContextFile[] = []
  ): Promise<ChatSession> {
    const sessionId = generateSessionId();
    const now = Date.now();

    const session: ChatSession = {
      id: sessionId,
      userId,
      workspaceId,
      title: 'New Conversation',
      mode,
      messages: [],
      contextFiles: initialContext,
      createdAt: now,
      updatedAt: now,
      activeBranchId: 'main',
      branches: [
        {
          id: 'main',
          name: 'Main',
          fromMessageId: '',
          createdAt: now,
          isActive: true,
        },
      ],
    };

    await this.saveSession(session);

    return session;
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<ChatSession | null> {
    // Try KV first
    const cached = await this.kv.get(this.sessionKey(sessionId), 'json');
    if (cached && typeof cached === 'object') {
      return cached as ChatSession;
    }

    // Fall back to D1
    if (!this.db) {
      return null;
    }

    const result = await this.db
      .prepare(
        `SELECT data FROM chat_sessions WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(sessionId)
      .first();

    if (!result) {
      return null;
    }

    const session = JSON.parse(result.data as string) as ChatSession;

    // Cache in KV
    await this.kv.put(
      this.sessionKey(sessionId),
      JSON.stringify(session),
      { expirationTtl: SESSION_TTL }
    );

    return session;
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    options: {
      codeReferences?: Array<{
        path: string;
        range: { start: number; end: number };
        symbol?: string;
        snippet: string;
      }>;
      toolCalls?: Array<{
        id: string;
        name: string;
        arguments: string;
        result?: string;
        success?: boolean;
      }>;
    } = {}
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const message: ChatMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: Date.now(),
      branchId: session.activeBranchId,
      codeReferences: options.codeReferences,
      toolCalls: options.toolCalls,
    };

    session.messages.push(message);
    session.updatedAt = Date.now();

    // Update title if this is the first user message
    const userMessages = session.messages.filter(m => m.role === 'user');
    if (userMessages.length === 1 && role === 'user') {
      session.title = generateTitle(content);
    }

    await this.saveSession(session);

    return message;
  }

  /**
   * Add multiple messages (batch)
   */
  async addMessages(
    sessionId: string,
    messages: Array<{
      role: MessageRole;
      content: string;
      codeReferences?: ChatMessage['codeReferences'];
      toolCalls?: ChatMessage['toolCalls'];
    }>
  ): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newMessages: ChatMessage[] = messages.map(msg => ({
      id: generateMessageId(),
      role: msg.role,
      content: msg.content,
      timestamp: Date.now(),
      branchId: session.activeBranchId,
      codeReferences: msg.codeReferences,
      toolCalls: msg.toolCalls,
    }));

    session.messages.push(...newMessages);
    session.updatedAt = Date.now();

    await this.saveSession(session);

    return newMessages;
  }

  /**
   * Update session mode
   */
  async setMode(sessionId: string, mode: ChatMode): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.mode = mode;
    session.updatedAt = Date.now();

    await this.saveSession(session);
  }

  /**
   * Attach context files to session
   */
  async attachContext(sessionId: string, files: ContextFile[]): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Merge with existing context, updating by path
    const existingPaths = new Map(session.contextFiles.map(f => [f.path, f]));
    for (const file of files) {
      existingPaths.set(file.path, file);
    }

    session.contextFiles = Array.from(existingPaths.values());
    session.updatedAt = Date.now();

    await this.saveSession(session);
  }

  /**
   * Remove context file from session
   */
  async removeContext(sessionId: string, filePath: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.contextFiles = session.contextFiles.filter(f => f.path !== filePath);
    session.updatedAt = Date.now();

    await this.saveSession(session);
  }

  /**
   * Create a branch from a specific message
   */
  async createBranch(
    sessionId: string,
    fromMessageId: string,
    branchName: string
  ): Promise<ChatBranch> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Find the message to branch from
    const fromIndex = session.messages.findIndex(m => m.id === fromMessageId);
    if (fromIndex === -1) {
      throw new Error(`Message not found: ${fromMessageId}`);
    }

    // Create new branch
    const branch: ChatBranch = {
      id: generateBranchId(),
      name: branchName,
      fromMessageId,
      createdAt: Date.now(),
      isActive: false,
    };

    session.branches.push(branch);

    // Truncate messages to the branch point
    session.messages = session.messages.slice(0, fromIndex + 1);
    session.activeBranchId = branch.id;

    // Deactivate other branches
    session.branches.forEach(b => b.isActive = b.id === branch.id);

    await this.saveSession(session);

    return branch;
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(sessionId: string, branchId: string): Promise<ChatSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const branch = session.branches.find(b => b.id === branchId);
    if (!branch) {
      throw new Error(`Branch not found: ${branchId}`);
    }

    // Load messages for this branch
    session.messages = await this.getBranchMessages(sessionId, branchId);
    session.activeBranchId = branchId;

    // Update active state
    session.branches.forEach(b => b.isActive = b.id === branchId);

    await this.saveSession(session);

    return session;
  }

  /**
   * List user's sessions
   */
  async listSessions(
    userId: string,
    workspaceId?: string,
    limit = 20,
    offset = 0
  ): Promise<ChatSession[]> {
    if (!this.db) {
      return [];
    }

    let query = `
      SELECT data FROM chat_sessions
      WHERE user_id = ? AND deleted_at IS NULL
    `;
    const params: unknown[] = [userId];

    if (workspaceId) {
      query += ` AND workspace_id = ?`;
      params.push(workspaceId);
    }

    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await this.db.prepare(query).bind(...params).all();

    return (result.results || []).map((row: any) => JSON.parse(row.data) as ChatSession);
  }

  /**
   * Delete a session (soft delete)
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) {
      // Only KV available - remove from cache
      await this.kv.delete(this.sessionKey(sessionId));
      return;
    }

    await this.db
      .prepare(`UPDATE chat_sessions SET deleted_at = ? WHERE id = ?`)
      .bind(Date.now(), sessionId)
      .run();

    // Remove from KV
    await this.kv.delete(this.sessionKey(sessionId));
  }

  /**
   * Get recent messages from session (for context window)
   */
  async getRecentMessages(
    sessionId: string,
    maxMessages = 50,
    maxTokens = 100000
  ): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    // Get messages from current branch
    let messages = session.messages;

    // Apply token limit
    if (maxTokens > 0) {
      const result: ChatMessage[] = [];
      let tokenCount = 0;

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const msgTokens = Math.ceil((msg.content?.length || 0) / 4);

        if (tokenCount + msgTokens > maxTokens) {
          break;
        }

        result.unshift(msg);
        tokenCount += msgTokens;
      }

      messages = result;
    }

    // Apply message limit
    return messages.slice(-maxMessages);
  }

  /**
   * Search messages by content
   */
  async searchMessages(
    sessionId: string,
    query: string,
    limit = 10
  ): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    const queryLower = query.toLowerCase();

    return session.messages
      .filter(m => m.content?.toLowerCase().includes(queryLower))
      .slice(0, limit);
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Save session to both KV and D1
   */
  private async saveSession(session: ChatSession): Promise<void> {
    // Update KV
    await this.kv.put(
      this.sessionKey(session.id),
      JSON.stringify(session),
      { expirationTtl: SESSION_TTL }
    );

    // Update D1
    if (this.db) {
      await this.persistSession(session);
    }
  }

  /**
   * Persist session to D1
   */
  private async persistSession(session: ChatSession): Promise<void> {
    await this.db
      .prepare(`
        INSERT INTO chat_sessions (id, user_id, workspace_id, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `)
      .bind(
        session.id,
        session.userId,
        session.workspaceId,
        JSON.stringify(session),
        session.createdAt,
        session.updatedAt
      )
      .run();
  }

  /**
   * Get messages for a specific branch
   */
  private async getBranchMessages(
    sessionId: string,
    branchId: string
  ): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return [];
    }

    if (branchId === 'main') {
      return session.messages.filter(m => !m.branchId || m.branchId === 'main');
    }

    // Find the branch
    const branch = session.branches.find(b => b.id === branchId);
    if (!branch) {
      return session.messages;
    }

    // Get messages up to the branch point
    const branchIndex = session.messages.findIndex(m => m.id === branch.fromMessageId);
    if (branchIndex === -1) {
      return session.messages;
    }

    return session.messages.slice(0, branchIndex + 1);
  }

  /**
   * KV key for session
   */
  private sessionKey(sessionId: string): string {
    return `vibe:session:${sessionId}`;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create conversation memory from environment
 */
export function createConversationMemory(env: VibeCodingEnv): ConversationMemory {
  return new ConversationMemory(env.CHAT_HISTORY, env.DB);
}
