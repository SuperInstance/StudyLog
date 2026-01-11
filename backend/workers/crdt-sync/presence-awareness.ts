/**
 * @file presence-awareness.ts - Real-time presence awareness system
 * @description Manages user presence, cursors, typing indicators, and activity tracking
 * @module backend/workers/crdt-sync/presence-awareness
 */

import type {
  UserPresence,
  UserStatus,
  UserCursor,
  CursorPosition,
  SelectionRange,
  TypingState,
  PresenceEvent,
  PresenceEventType,
  PresenceConfig,
  PresenceObserver,
  PresenceFilter,
  PresenceStats,
  DEFAULT_PRESENCE_CONFIG,
  ActivityTimeouts,
  ColorStrategy
} from './types.js';

// ============================================================================
// PRESENCE MANAGER
// ============================================================================

/**
 * Presence timeout state
 */
interface TimeoutState {
  idleTimer?: ReturnType<typeof setTimeout>;
  offlineTimer?: ReturnType<typeof setTimeout>;
  typingTimer?: ReturnType<typeof setTimeout>;
}

/**
 * User presence with internal state
 */
interface PresenceState extends UserPresence {
  /** Internal timeout references */
  timeouts: TimeoutState;
  /** Client connection IDs */
  clientConnections: Set<string>;
}

/**
 * Color palette for user assignment
 */
const DEFAULT_COLOR_PALETTE = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F8B739', '#52C7B8', '#FF7675', '#74B9FF',
  '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7'
];

/**
 * Presence Manager
 *
 * Manages user presence across all documents:
 * - User online/offline/idle status
 * - Cursor positions
 * - Typing indicators
 * - Activity timeout management
 * - Event emission for presence changes
 */
export class PresenceManager {
  /** User presence state by user ID */
  private users: Map<string, PresenceState> = new Map();

  /** Presence by document */
  private documentUsers: Map<string, Set<string>> = new Map();

  /** Configuration */
  private config: PresenceConfig;

  /** Event observers */
  private observers: Set<PresenceObserver> = new Set();

  /** Color assignments */
  private userColors: Map<string, string> = new Map();

  /**
   * Create a new Presence Manager
   *
   * @param config - Configuration options
   */
  constructor(config?: Partial<PresenceConfig>) {
    this.config = {
      ...DEFAULT_PRESENCE_CONFIG,
      ...config,
      timeouts: {
        ...DEFAULT_PRESENCE_CONFIG.timeouts,
        ...(config?.timeouts || {})
      }
    };
  }

  // ========================================================================
  // USER PRESENCE MANAGEMENT
  // ========================================================================

  /**
   * Add or update a user's presence
   *
   * @param userId - User ID
   * @param userName - User display name
   * @param documentId - Current document ID
   * @param clientId - Client connection ID
   * @returns Updated presence
   */
  addUser(
    userId: string,
    userName: string,
    documentId: string,
    clientId: string
  ): UserPresence {
    const now = Date.now();
    const existing = this.users.get(userId);

    if (existing) {
      // Update existing user
      existing.userName = userName;
      existing.status = UserStatus.ONLINE;
      existing.documentId = documentId;
      existing.lastActivity = now;
      existing.clientConnections.add(clientId);

      // Reset idle/offline timers
      this.resetTimeouts(userId, documentId);

      // Update document mapping
      this.addToDocument(documentId, userId);

      this.emit({
        type: PresenceEventType.STATUS_CHANGED,
        userId,
        presence: this.sanitizePresence(existing),
        timestamp: now
      });

      return this.sanitizePresence(existing);
    }

    // Create new user
    const color = this.assignColor(userId);

    const newState: PresenceState = {
      userId,
      userName,
      status: UserStatus.ONLINE,
      cursor: {
        userId,
        userName,
        position: { line: 0, column: 0 },
        color,
        timestamp: now
      },
      documentId,
      lastActivity: now,
      timeouts: {},
      clientConnections: new Set([clientId])
    };

    this.users.set(userId);
    this.addToDocument(documentId, userId);

    // Start idle timer
    this.resetTimeouts(userId, documentId);

    this.emit({
      type: PresenceEventType.USER_JOINED,
      userId,
      presence: this.sanitizePresence(newState),
      timestamp: now
    });

    return this.sanitizePresence(newState);
  }

  /**
   * Remove a user from a specific client connection
   *
   * @param userId - User ID
   * @param clientId - Client connection ID
   */
  removeUser(userId: string, clientId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    // Remove this client connection
    state.clientConnections.delete(clientId);

    // If no more connections, mark as offline
    if (state.clientConnections.size === 0) {
      this.markOffline(userId);
    }
  }

  /**
   * Remove a user completely
   *
   * @param userId - User ID
   */
  deleteUser(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    // Clear all timeouts
    this.clearTimeouts(userId);

    // Remove from documents
    if (state.documentId) {
      this.removeFromDocument(state.documentId, userId);
    }

    // Remove user
    this.users.delete(userId);
    this.userColors.delete(userId);

    this.emit({
      type: PresenceEventType.USER_LEFT,
      userId,
      presence: state,
      timestamp: Date.now()
    });
  }

  /**
   * Get a user's presence
   *
   * @param userId - User ID
   * @returns User presence, or undefined
   */
  getUser(userId: string): UserPresence | undefined {
    const state = this.users.get(userId);
    return state ? this.sanitizePresence(state) : undefined;
  }

  /**
   * Get multiple users' presence
   *
   * @param userIds - User IDs
   * @returns Map of user presence
   */
  getUsers(userIds: string[]): Map<string, UserPresence> {
    const result = new Map<string, UserPresence>();
    for (const userId of userIds) {
      const presence = this.getUser(userId);
      if (presence) {
        result.set(userId, presence);
      }
    }
    return result;
  }

  // ========================================================================
  // STATUS MANAGEMENT
  // ========================================================================

  /**
   * Update user status
   *
   * @param userId - User ID
   * @param status - New status
   */
  setStatus(userId: string, status: UserStatus): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    const oldStatus = state.status;
    state.status = status;
    state.lastActivity = Date.now();

    // Clear cursor when going idle/offline
    if (status === UserStatus.IDLE || status === UserStatus.OFFLINE) {
      state.cursor = undefined;
      state.typing = undefined;
    }

    if (oldStatus !== status) {
      this.emit({
        type: PresenceEventType.STATUS_CHANGED,
        userId,
        presence: this.sanitizePresence(state),
        timestamp: Date.now()
      });
    }
  }

  /**
   * Update user activity (resets idle timer)
   *
   * @param userId - User ID
   */
  updateActivity(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    state.lastActivity = Date.now();

    // If was idle/offline, bring back online
    if (state.status !== UserStatus.ONLINE && state.status !== UserStatus.BUSY) {
      state.status = UserStatus.ONLINE;
      this.emit({
        type: PresenceEventType.STATUS_CHANGED,
        userId,
        presence: this.sanitizePresence(state),
        timestamp: Date.now()
      });
    }

    // Reset idle timer
    this.resetIdleTimer(userId);
  }

  /**
   * Mark user as busy
   *
   * @param userId - User ID
   */
  setBusy(userId: string): void {
    this.setStatus(userId, UserStatus.BUSY);
  }

  /**
   * Mark user as available
   *
   * @param userId - User ID
   */
  setAvailable(userId: string): void {
    this.setStatus(userId, UserStatus.ONLINE);
  }

  // ========================================================================
  // CURSOR MANAGEMENT
  // ========================================================================

  /**
   * Update user's cursor position
   *
   * @param userId - User ID
   * @param position - New cursor position
   * @param selection - Optional selection range
   */
  updateCursor(
    userId: string,
    position: CursorPosition,
    selection?: SelectionRange
  ): void {
    const state = this.users.get(userId);
    if (!state || !this.config.enableCursors) {
      return;
    }

    const color = this.userColors.get(userId) || this.assignColor(userId);

    state.cursor = {
      userId,
      userName: state.userName,
      position,
      selection,
      color,
      timestamp: Date.now()
    };

    state.lastActivity = Date.now();
    this.resetIdleTimer(userId);

    this.emit({
      type: PresenceEventType.CURSOR_MOVED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  /**
   * Clear user's cursor
   *
   * @param userId - User ID
   */
  clearCursor(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    state.cursor = undefined;

    this.emit({
      type: PresenceEventType.CURSOR_MOVED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  /**
   * Get all cursors in a document
   *
   * @param documentId - Document ID
   * @returns Map of user cursors
   */
  getDocumentCursors(documentId: string): Map<string, UserCursor> {
    const cursors = new Map<string, UserCursor>();
    const users = this.getDocumentUsers(documentId);

    for (const [userId, presence] of users.entries()) {
      if (presence.cursor && presence.status === UserStatus.ONLINE) {
        cursors.set(userId, presence.cursor);
      }
    }

    return cursors;
  }

  /**
   * Get cursors on a specific line
   *
   * @param documentId - Document ID
   * @param line - Line number
   * @returns Cursors on that line
   */
  getCursorsOnLine(documentId: string, line: number): UserCursor[] {
    const cursors: UserCursor[] = [];
    const users = this.getDocumentUsers(documentId);

    for (const presence of users.values()) {
      if (
        presence.cursor &&
        presence.cursor.position.line === line &&
        presence.status === UserStatus.ONLINE
      ) {
        cursors.push(presence.cursor);
      }
    }

    return cursors;
  }

  // ========================================================================
  // TYPING INDICATORS
  // ========================================================================

  /**
   * Set user typing state
   *
   * @param userId - User ID
   * @param isTyping - Whether user is typing
   * @param partialLength - Optional partial text length
   */
  setTyping(userId: string, isTyping: boolean, partialLength?: number): void {
    const state = this.users.get(userId);
    if (!state || !this.config.enableTyping) {
      return;
    }

    if (isTyping) {
      state.typing = {
        isTyping: true,
        startTime: Date.now(),
        partialLength
      };
      state.lastActivity = Date.now();

      // Set typing timeout
      this.resetTypingTimer(userId);
    } else {
      state.typing = undefined;
    }

    this.emit({
      type: PresenceEventType.TYPING_CHANGED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  /**
   * Start typing indicator
   *
   * @param userId - User ID
   */
  startTyping(userId: string): void {
    this.setTyping(userId, true);
  }

  /**
   * Stop typing indicator
   *
   * @param userId - User ID
   */
  stopTyping(userId: string): void {
    this.setTyping(userId, false);
  }

  /**
   * Get typing users in a document
   *
   * @param documentId - Document ID
   * @returns Array of typing users
   */
  getTypingUsers(documentId: string): UserPresence[] {
    const users = this.getDocumentUsers(documentId);
    const typing: UserPresence[] = [];

    for (const presence of users.values()) {
      if (presence.typing?.isTyping) {
        typing.push(presence);
      }
    }

    return typing;
  }

  // ========================================================================
  // DOCUMENT MANAGEMENT
  // ========================================================================

  /**
   * Change user's current document
   *
   * @param userId - User ID
   * @param documentId - New document ID
   */
  changeDocument(userId: string, documentId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    const oldDocumentId = state.documentId;
    state.documentId = documentId;
    state.lastActivity = Date.now();

    // Update document mappings
    if (oldDocumentId) {
      this.removeFromDocument(oldDocumentId, userId);
    }
    this.addToDocument(documentId, userId);

    // Clear cursor for new document
    state.cursor = undefined;

    this.emit({
      type: PresenceEventType.DOCUMENT_CHANGED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  /**
   * Get users in a document
   *
   * @param documentId - Document ID
   * @param filter - Optional presence filter
   * @returns Map of user presence in document
   */
  getDocumentUsers(
    documentId: string,
    filter?: PresenceFilter
  ): Map<string, UserPresence> {
    const userIds = this.documentUsers.get(documentId);
    if (!userIds) {
      return new Map();
    }

    const result = new Map<string, UserPresence>();

    for (const userId of userIds) {
      const state = this.users.get(userId);
      if (!state) {
        continue;
      }

      // Apply filter
      if (filter) {
        if (filter.status && state.status !== filter.status) {
          continue;
        }
        if (filter.onlyTyping && !state.typing?.isTyping) {
          continue;
        }
        if (filter.cursorInLine !== undefined) {
          if (!state.cursor || state.cursor.position.line !== filter.cursorInLine) {
            continue;
          }
        }
      }

      result.set(userId, this.sanitizePresence(state));
    }

    return result;
  }

  /**
   * Get all documents with active users
   *
   * @returns Map of document ID to user count
   */
  getActiveDocuments(): Map<string, number> {
    const result = new Map<string, number>();

    for (const [documentId, userIds] of this.documentUsers.entries()) {
      let activeCount = 0;
      for (const userId of userIds) {
        const state = this.users.get(userId);
        if (state && state.status === UserStatus.ONLINE) {
          activeCount++;
        }
      }
      if (activeCount > 0) {
        result.set(documentId, activeCount);
      }
    }

    return result;
  }

  // ========================================================================
  // QUERY & FILTER
  // ========================================================================

  /**
   * Get users matching criteria
   *
   * @param filter - Filter criteria
   * @returns Array of matching users
   */
  getUsersByFilter(filter: PresenceFilter): UserPresence[] {
    const result: UserPresence[] = [];

    for (const state of this.users.values()) {
      if (filter.status && state.status !== filter.status) {
        continue;
      }
      if (filter.documentId && state.documentId !== filter.documentId) {
        continue;
      }
      if (filter.onlyTyping && !state.typing?.isTyping) {
        continue;
      }
      if (filter.cursorInLine !== undefined) {
        if (!state.cursor || state.cursor.position.line !== filter.cursorInLine) {
          continue;
        }
      }

      result.push(this.sanitizePresence(state));
    }

    return result;
  }

  /**
   * Get online users
   *
   * @param documentId - Optional document filter
   * @returns Online users
   */
  getOnlineUsers(documentId?: string): UserPresence[] {
    return this.getUsersByFilter({
      status: UserStatus.ONLINE,
      documentId
    });
  }

  /**
   * Get idle users
   *
   * @param documentId - Optional document filter
   * @returns Idle users
   */
  getIdleUsers(documentId?: string): UserPresence[] {
    return this.getUsersByFilter({
      status: UserStatus.IDLE,
      documentId
    });
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get presence statistics
   *
   * @param documentId - Optional document to scope stats
   * @returns Presence statistics
   */
  getStats(documentId?: string): PresenceStats {
    const users = documentId
      ? Array.from(this.getDocumentUsers(documentId).values())
      : Array.from(this.users.values()).map(s => this.sanitizePresence(s));

    const onlineCount = users.filter(u => u.status === UserStatus.ONLINE).length;
    const idleCount = users.filter(u => u.status === UserStatus.IDLE).length;
    const typingCount = users.filter(u => u.typing?.isTyping).length;

    // Calculate average activity time
    const now = Date.now();
    const averageActivityTime = users.length > 0
      ? users.reduce((sum, u) => sum + (now - u.lastActivity), 0) / users.length
      : 0;

    // Find most active document
    let mostActiveDocument: string | undefined;
    let maxCount = 0;
    for (const [docId, userIds] of this.documentUsers.entries()) {
      let count = 0;
      for (const userId of userIds) {
        const state = this.users.get(userId);
        if (state && state.status === UserStatus.ONLINE) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
        mostActiveDocument = docId;
      }
    }

    return {
      totalUsers: users.length,
      onlineCount,
      idleCount,
      typingCount,
      averageActivityTime,
      mostActiveDocument
    };
  }

  // ========================================================================
  // EVENT HANDLING
  // ========================================================================

  /**
   * Subscribe to presence events
   *
   * @param observer - Event callback
   * @returns Unsubscribe function
   */
  onPresenceChange(observer: PresenceObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Emit a presence event
   *
   * @param event - Event to emit
   */
  private emit(event: PresenceEvent): void {
    for (const observer of this.observers) {
      try {
        observer(event);
      } catch (e) {
        console.error('Presence observer error:', e);
      }
    }
  }

  // ========================================================================
  // TIMEOUT MANAGEMENT
  // ========================================================================

  /**
   * Reset all timeouts for a user
   *
   * @param userId - User ID
   * @param documentId - Current document ID
   */
  private resetTimeouts(userId: string, documentId: string): void {
    this.clearTimeouts(userId);
    this.resetIdleTimer(userId);
  }

  /**
   * Reset idle timer for a user
   *
   * @param userId - User ID
   */
  private resetIdleTimer(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    // Clear existing timers
    if (state.timeouts.idleTimer) {
      clearTimeout(state.timeouts.idleTimer);
    }
    if (state.timeouts.offlineTimer) {
      clearTimeout(state.timeouts.offlineTimer);
    }

    // Set idle timer
    state.timeouts.idleTimer = setTimeout(() => {
      this.markIdle(userId);
    }, this.config.timeouts.idleTimeout);

    // Set offline timer
    state.timeouts.offlineTimer = setTimeout(() => {
      this.markOffline(userId);
    }, this.config.timeouts.offlineTimeout);
  }

  /**
   * Reset typing timer for a user
   *
   * @param userId - User ID
   */
  private resetTypingTimer(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    if (state.timeouts.typingTimer) {
      clearTimeout(state.timeouts.typingTimer);
    }

    state.timeouts.typingTimer = setTimeout(() => {
      this.clearTyping(userId);
    }, this.config.timeouts.typingTimeout);
  }

  /**
   * Clear all timeouts for a user
   *
   * @param userId - User ID
   */
  private clearTimeouts(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    if (state.timeouts.idleTimer) {
      clearTimeout(state.timeouts.idleTimer);
    }
    if (state.timeouts.offlineTimer) {
      clearTimeout(state.timeouts.offlineTimer);
    }
    if (state.timeouts.typingTimer) {
      clearTimeout(state.timeouts.typingTimer);
    }

    state.timeouts = {};
  }

  /**
   * Mark user as idle
   *
   * @param userId - User ID
   */
  private markIdle(userId: string): void {
    const state = this.users.get(userId);
    if (!state || state.status !== UserStatus.ONLINE) {
      return;
    }

    state.status = UserStatus.IDLE;
    state.cursor = undefined;
    state.typing = undefined;

    this.emit({
      type: PresenceEventType.STATUS_CHANGED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  /**
   * Mark user as offline
   *
   * @param userId - User ID
   */
  private markOffline(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    state.status = UserStatus.OFFLINE;
    state.cursor = undefined;
    state.typing = undefined;

    this.clearTimeouts(userId);

    this.emit({
      type: PresenceEventType.STATUS_CHANGED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  /**
   * Clear typing indicator
   *
   * @param userId - User ID
   */
  private clearTyping(userId: string): void {
    const state = this.users.get(userId);
    if (!state) {
      return;
    }

    state.typing = undefined;

    this.emit({
      type: PresenceEventType.TYPING_CHANGED,
      userId,
      presence: this.sanitizePresence(state),
      timestamp: Date.now()
    });
  }

  // ========================================================================
  // DOCUMENT HELPERS
  // ========================================================================

  /**
   * Add user to document mapping
   *
   * @param documentId - Document ID
   * @param userId - User ID
   */
  private addToDocument(documentId: string, userId: string): void {
    if (!this.documentUsers.has(documentId)) {
      this.documentUsers.set(documentId, new Set());
    }
    this.documentUsers.get(documentId)!.add(userId);
  }

  /**
   * Remove user from document mapping
   *
   * @param documentId - Document ID
   * @param userId - User ID
   */
  private removeFromDocument(documentId: string, userId: string): void {
    const users = this.documentUsers.get(documentId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.documentUsers.delete(documentId);
      }
    }
  }

  // ========================================================================
  // COLOR ASSIGNMENT
  // ========================================================================

  /**
   * Assign a color to a user
   *
   * @param userId - User ID
   * @param strategy - Color assignment strategy
   * @returns Hex color string
   */
  private assignColor(userId: string, strategy: ColorStrategy = ColorStrategy.HASHED): string {
    // Check if already assigned
    const existing = this.userColors.get(userId);
    if (existing) {
      return existing;
    }

    const palette = this.config.colorPalette;
    let color: string;

    switch (strategy) {
      case ColorStrategy.SEQUENTIAL:
        const index = this.userColors.size % palette.length;
        color = palette[index];
        break;

      case ColorStrategy.RANDOM:
        color = palette[Math.floor(Math.random() * palette.length)];
        break;

      case ColorStrategy.HASHED:
      default:
        // Simple hash of userId for consistent color
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
          hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
        }
        color = palette[Math.abs(hash) % palette.length];
        break;
    }

    this.userColors.set(userId, color);
    return color;
  }

  // ========================================================================
  // SANITIZATION
  // ========================================================================

  /**
   * Sanitize presence state for external use
   * Removes internal state like timeouts and client connections
   *
   * @param state - Internal presence state
   * @returns Clean presence object
   */
  private sanitizePresence(state: PresenceState): UserPresence {
    const { timeouts, clientConnections, ...presence } = state;
    return presence;
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Shutdown the presence manager
   *
   * Clears all users, timers, and observers.
   */
  shutdown(): void {
    // Clear all timeouts
    for (const [userId, state] of this.users.entries()) {
      this.clearTimeouts(userId);
    }

    // Clear all data
    this.users.clear();
    this.documentUsers.clear();
    this.userColors.clear();
    this.observers.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a presence manager with default configuration
 */
export function createPresenceManager(
  config?: Partial<PresenceConfig>
): PresenceManager {
  return new PresenceManager(config);
}

/**
 * Create a presence manager for a specific product
 */
export function createProductPresenceManager(
  product: 'studylog' | 'dmlog',
  config?: Partial<PresenceConfig>
): PresenceManager {
  const productConfig: Partial<PresenceConfig> = {
    enableCursors: true,
    enableTyping: true,
    colorPalette: product === 'studylog'
      ? ['#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8']
      : ['#FF6B6B', '#C0392B', '#E74C3C', '#9B59B6', '#3498DB', '#1ABC9C']
  };

  return new PresenceManager({
    ...productConfig,
    ...config
  });
}
