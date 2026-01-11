/**
 * Chat Message Store
 *
 * Handles message history with branching support.
 * Stores conversations in KV for fast access and D1 for persistence.
 */

import type {
  ChatMessage,
  ChatSession,
  ChatBranch,
  ContextFile,
  ChatMode,
} from '../types/index.js';
import type { IDEAutomationEnv } from '../types/index.js';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique nanoid-style ID
 */
export function generateId(prefix = ''): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = prefix;
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Generate a session ID
 */
export function generateSessionId(): string {
  return generateId('sess_');
}

/**
 * Generate a message ID
 */
export function generateMessageId(): string {
  return generateId('msg_');
}

/**
 * Generate a branch ID
 */
export function generateBranchId(): string {
  return generateId('branch_');
}

// ============================================================================
// Message Store
// ============================================================================

/**
 * Message Store handles chat history with branching support
 */
export class MessageStore {
  constructor(
    private readonly kv: KVNamespace,
    private readonly db: D1Database,
    private readonly ttl: number = 60 * 60 * 24 * 30 // 30 days default
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

    // Generate title from first message or use default
    const title = this.generateTitle(initialContext);

    const session: ChatSession = {
      id: sessionId,
      userId,
      workspaceId,
      title,
      mode,
      messages: [],
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
      contextFiles: initialContext,
      createdAt: now,
      updatedAt: now,
    };

    // Store in KV for fast access
    await this.kv.put(
      this.sessionKey(sessionId),
      JSON.stringify(session),
      { expirationTtl: this.ttl }
    );

    // Persist to D1
    await this.persistSession(session);

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
      { expirationTtl: this.ttl }
    );

    return session;
  }

  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'timestamp'>
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newMessage: ChatMessage = {
      ...message,
      id: generateMessageId(),
      timestamp: Date.now(),
      branchId: session.activeBranchId,
    };

    session.messages.push(newMessage);
    session.updatedAt = Date.now();

    // Update session title if this is the first user message
    if (session.messages.filter(m => m.role === 'user').length === 1 && message.role === 'user') {
      session.title = this.generateTitleFromMessage(message.content || '');
    }

    await this.updateSession(session);

    return newMessage;
  }

  /**
   * Add multiple messages (batch)
   */
  async addMessages(
    sessionId: string,
    messages: Omit<ChatMessage, 'id' | 'timestamp'>[]
  ): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const newMessages: ChatMessage[] = messages.map((msg) => ({
      ...msg,
      id: generateMessageId(),
      timestamp: Date.now(),
      branchId: session.activeBranchId,
    }));

    session.messages.push(...newMessages);
    session.updatedAt = Date.now();

    await this.updateSession(session);

    return newMessages;
  }

  /**
   * Create a new branch from a specific message
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

    await this.updateSession(session);

    return branch;
  }

  /**
   * Switch to a different branch
   */
  async switchBranch(
    sessionId: string,
    branchId: string
  ): Promise<ChatSession> {
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

    await this.updateSession(session);

    return session;
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

    await this.updateSession(session);
  }

  /**
   * Attach context files to session
   */
  async attachContext(
    sessionId: string,
    files: ContextFile[]
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Merge with existing context, updating by path
    const existingPaths = new Set(session.contextFiles.map(f => f.path));
    const newFiles = files.filter(f => !existingPaths.has(f.path));

    session.contextFiles = [...session.contextFiles, ...newFiles];
    session.updatedAt = Date.now();

    await this.updateSession(session);
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

    await this.updateSession(session);
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
    await this.db
      .prepare(`UPDATE chat_sessions SET deleted_at = ? WHERE id = ?`)
      .bind(Date.now(), sessionId)
      .run();

    // Remove from KV
    await this.kv.delete(this.sessionKey(sessionId));
  }

  /**
   * Update session in both KV and D1
   */
  private async updateSession(session: ChatSession): Promise<void> {
    // Update KV
    await this.kv.put(
      this.sessionKey(session.id),
      JSON.stringify(session),
      { expirationTtl: this.ttl }
    );

    // Update D1
    await this.persistSession(session);
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
    // For 'main' branch, get all messages without a branch or from main
    // For other branches, this would require more complex logic
    // For now, we'll load all messages and filter

    const result = await this.db
      .prepare(`SELECT data FROM chat_sessions WHERE id = ?`)
      .bind(sessionId)
      .first();

    if (!result) {
      return [];
    }

    const session = JSON.parse(result.data as string) as ChatSession;

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
   * Generate a title from context files
   */
  private generateTitle(context: ContextFile[]): string {
    if (context.length === 0) {
      return 'New Conversation';
    }

    const fileNames = context.map(f => f.path.split('/').pop() || f.path);
    if (fileNames.length === 1) {
      return `About ${fileNames[0]}`;
    }
    return `About ${fileNames.length} files`;
  }

  /**
   * Generate a title from a user message
   */
  private generateTitleFromMessage(message: string): string {
    // Take first 50 chars, truncate at word boundary
    const truncated = message.slice(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace > 0 ? lastSpace : truncated.length) + '...';
  }

  /**
   * KV key for session
   */
  private sessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a message store from environment
 */
export function createMessageStore(env: IDEAutomationEnv): MessageStore {
  return new MessageStore(env.CHAT_HISTORY, env.IDE_STATE);
}
