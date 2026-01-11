/**
 * @file document-sync.ts - Real-time document synchronization
 * @description Manages document state, persistence, and sync coordination
 * @module backend/workers/crdt-sync/document-sync
 */

import { CRDTEngine, createCRDTEngine } from './crdt-engine.js';
import type {
  DocumentOperation,
  DocumentSnapshot,
  DocumentWithMeta,
  DocumentMeta,
  ProductType,
  SyncMessage,
  SyncMessageType,
  SyncConfig,
  DEFAULT_SYNC_CONFIG,
  GatewayStats
} from './types.js';

// ============================================================================
// DOCUMENT STORE
// ============================================================================

/**
 * Document in-memory state with sync metadata
 */
interface DocumentState {
  /** CRDT engine for this document */
  engine: CRDTEngine;
  /** Document metadata */
  metadata: DocumentMeta;
  /** Product type */
  product: ProductType;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Last snapshot time */
  lastSnapshotTime: number;
  /** Connected clients */
  connectedClients: Set<string>;
}

/**
 * Document persistence interface
 */
export interface DocumentPersistence {
  /** Save document snapshot */
  save(documentId: string, snapshot: DocumentSnapshot, metadata: DocumentMeta): Promise<void>;
  /** Load document snapshot */
  load(documentId: string): Promise<DocumentSnapshot | null>;
  /** Load metadata */
  loadMetadata(documentId: string): Promise<DocumentMeta | null>;
  /** Delete document */
  delete(documentId: string): Promise<void>;
  /** List all documents */
  list(): Promise<Array<{ id: string; metadata: DocumentMeta }>>;
}

/**
 * In-memory document persistence (for development/testing)
 */
export class InMemoryDocumentPersistence implements DocumentPersistence {
  private snapshots: Map<string, DocumentSnapshot> = new Map();
  private metadata: Map<string, DocumentMeta> = new Map();

  async save(
    documentId: string,
    snapshot: DocumentSnapshot,
    metadata: DocumentMeta
  ): Promise<void> {
    this.snapshots.set(documentId, snapshot);
    this.metadata.set(documentId, metadata);
  }

  async load(documentId: string): Promise<DocumentSnapshot | null> {
    return this.snapshots.get(documentId) || null;
  }

  async loadMetadata(documentId: string): Promise<DocumentMeta | null> {
    return this.metadata.get(documentId) || null;
  }

  async delete(documentId: string): Promise<void> {
    this.snapshots.delete(documentId);
    this.metadata.delete(documentId);
  }

  async list(): Promise<Array<{ id: string; metadata: DocumentMeta }>> {
    const result: Array<{ id: string; metadata: DocumentMeta }> = [];
    for (const [id, metadata] of this.metadata.entries()) {
      result.push({ id, metadata });
    }
    return result;
  }
}

// ============================================================================
// DOCUMENT SYNC MANAGER
// ============================================================================

/**
 * Document Sync Manager Configuration
 */
export interface DocumentSyncConfig {
  /** Sync configuration */
  sync: SyncConfig;
  /** Auto-save interval in milliseconds */
  autoSaveInterval: number;
  /** Persistence layer */
  persistence: DocumentPersistence;
  /** Enable automatic snapshots */
  enableSnapshots: boolean;
}

/**
 * Default document sync configuration
 */
export const DEFAULT_DOCUMENT_SYNC_CONFIG: DocumentSyncConfig = {
  sync: DEFAULT_SYNC_CONFIG,
  autoSaveInterval: 30000, // 30 seconds
  persistence: new InMemoryDocumentPersistence(),
  enableSnapshots: true
};

/**
 * Document Sync Manager
 *
 * Manages document synchronization across clients:
 * - Document lifecycle (create, load, save, delete)
 * - Operation distribution
 * - Snapshot persistence
 * - Client connection tracking
 */
export class DocumentSyncManager {
  /** Documents by ID */
  private documents: Map<string, DocumentState> = new Map();

  /** Configuration */
  private config: DocumentSyncConfig;

  /** Auto-save timer */
  private autoSaveTimer?: ReturnType<typeof setInterval>;

  /** Message handlers by type */
  private messageHandlers: Map<SyncMessageType, Set<(message: SyncMessage) => void>> = new Map();

  /** Stats */
  private stats: GatewayStats = {
    connectedClients: 0,
    documentCount: 0,
    totalOperations: 0,
    messagesSent: 0,
    messagesReceived: 0,
    activeSyncSessions: 0,
    uptime: 0
  };

  /** Start time */
  private startTime: number = Date.now();

  /**
   * Create a new Document Sync Manager
   *
   * @param config - Configuration options
   */
  constructor(config?: Partial<DocumentSyncConfig>) {
    this.config = {
      ...DEFAULT_DOCUMENT_SYNC_CONFIG,
      ...config,
      sync: {
        ...DEFAULT_DOCUMENT_SYNC_CONFIG.sync,
        ...(config?.sync || {})
      }
    };

    // Start auto-save timer
    this.startAutoSave();
  }

  // ========================================================================
  // DOCUMENT LIFECYCLE
  // ========================================================================

  /**
   * Create a new document
   *
   * @param documentId - Unique document ID
   * @param initialContent - Initial document content
   * @param product - Product type (studylog or dmlog)
   * @param metadata - Product-specific metadata
   * @returns The created document state
   */
  async createDocument(
    documentId: string,
    initialContent: string,
    product: ProductType,
    metadata: DocumentMeta
  ): Promise<DocumentState> {
    if (this.documents.has(documentId)) {
      throw new Error(`Document already exists: ${documentId}`);
    }

    const replicaId = `server_${documentId}`;
    const engine = new CRDTEngine(initialContent, replicaId);

    const state: DocumentState = {
      engine,
      metadata,
      product,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastSnapshotTime: Date.now(),
      connectedClients: new Set()
    };

    this.documents.set(documentId, state);
    this.stats.documentCount = this.documents.size;

    // Save initial snapshot
    if (this.config.enableSnapshots) {
      await this.saveSnapshot(documentId);
    }

    return state;
  }

  /**
   * Load a document from persistence
   *
   * @param documentId - Document ID to load
   * @returns The loaded document state, or null if not found
   */
  async loadDocument(documentId: string): Promise<DocumentState | null> {
    // Check if already loaded
    const existing = this.documents.get(documentId);
    if (existing) {
      return existing;
    }

    // Load from persistence
    const snapshot = await this.config.persistence.load(documentId);
    if (!snapshot) {
      return null;
    }

    const metadata = await this.config.persistence.loadMetadata(documentId);
    if (!metadata) {
      return null;
    }

    // Determine product type from metadata
    const product = 'projectId' in metadata ? 'studylog' : 'dmlog';

    // Create engine and load snapshot
    const replicaId = `server_${documentId}`;
    const engine = new CRDTEngine('', replicaId);
    engine.loadSnapshot(snapshot);

    const state: DocumentState = {
      engine,
      metadata,
      product,
      createdAt: snapshot.createdAt,
      updatedAt: Date.now(),
      lastSnapshotTime: Date.now(),
      connectedClients: new Set()
    };

    this.documents.set(documentId, state);
    this.stats.documentCount = this.documents.size;

    return state;
  }

  /**
   * Get or load a document
   *
   * @param documentId - Document ID
   * @returns Document state, or null if not found
   */
  async getDocument(documentId: string): Promise<DocumentState | null> {
    let state = this.documents.get(documentId);
    if (!state) {
      state = await this.loadDocument(documentId);
    }
    return state;
  }

  /**
   * Delete a document
   *
   * @param documentId - Document ID to delete
   */
  async deleteDocument(documentId: string): Promise<void> {
    const state = this.documents.get(documentId);
    if (state) {
      // Disconnect all clients
      state.connectedClients.clear();
    }

    this.documents.delete(documentId);
    await this.config.persistence.delete(documentId);
    this.stats.documentCount = this.documents.size;
  }

  /**
   * List all documents
   *
   * @returns Array of document summaries
   */
  async listDocuments(): Promise<Array<{ id: string; metadata: DocumentMeta }>> {
    return this.config.persistence.list();
  }

  // ========================================================================
  // OPERATION HANDLING
  // ========================================================================

  /**
   * Apply a local operation to a document
   *
   * @param documentId - Document ID
   * @param userId - User ID
   * @param operation - Operation to apply
   * @returns The applied operation
   */
  async applyOperation(
    documentId: string,
    userId: string,
    operation: DocumentOperation
  ): Promise<DocumentOperation | null> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return null;
    }

    // Apply operation
    let applied: DocumentOperation | null = null;

    switch (operation.type) {
      case 'insert':
        applied = state.engine.insert(userId, operation.position, operation.text || '');
        break;
      case 'delete':
        applied = state.engine.delete(userId, operation.position, operation.length);
        break;
      case 'replace':
        applied = state.engine.replace(
          userId,
          operation.position,
          operation.length,
          operation.text || ''
        );
        break;
    }

    if (applied) {
      state.updatedAt = Date.now();
      this.stats.totalOperations++;
    }

    return applied;
  }

  /**
   * Apply a remote operation from another client
   *
   * @param documentId - Document ID
   * @param operation - Remote operation to apply
   * @returns The applied operation, or null if rejected
   */
  async applyRemoteOperation(
    documentId: string,
    operation: DocumentOperation
  ): Promise<DocumentOperation | null> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return null;
    }

    const applied = state.engine.applyRemote(operation);

    if (applied) {
      state.updatedAt = Date.now();
      this.stats.totalOperations++;
    }

    return applied;
  }

  /**
   * Apply a batch of remote operations
   *
   * @param documentId - Document ID
   * @param operations - Operations to apply
   * @returns Applied operations
   */
  async applyRemoteOperations(
    documentId: string,
    operations: DocumentOperation[]
  ): Promise<DocumentOperation[]> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return [];
    }

    const applied = state.engine.applyRemoteBatch(operations);

    if (applied.length > 0) {
      state.updatedAt = Date.now();
      this.stats.totalOperations += applied.length;
    }

    return applied;
  }

  // ========================================================================
  // SNAPSHOT MANAGEMENT
  // ========================================================================

  /**
   * Save a document snapshot
   *
   * @param documentId - Document ID
   */
  async saveSnapshot(documentId: string): Promise<void> {
    const state = this.documents.get(documentId);
    if (!state) {
      return;
    }

    const snapshot = state.engine.getSnapshot();
    await this.config.persistence.save(documentId, snapshot, state.metadata);
    state.lastSnapshotTime = Date.now();
  }

  /**
   * Get document snapshot
   *
   * @param documentId - Document ID
   * @returns Document snapshot, or null if not found
   */
  async getSnapshot(documentId: string): Promise<DocumentSnapshot | null> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return null;
    }

    return state.engine.getSnapshot();
  }

  /**
   * Restore document from snapshot
   *
   * @param documentId - Document ID
   * @param snapshot - Snapshot to restore
   */
  async restoreSnapshot(documentId: string, snapshot: DocumentSnapshot): Promise<void> {
    const state = await this.getDocument(documentId);
    if (!state) {
      throw new Error(`Document not found: ${documentId}`);
    }

    state.engine.loadSnapshot(snapshot);
    state.updatedAt = Date.now();

    // Persist the restored state
    if (this.config.enableSnapshots) {
      await this.saveSnapshot(documentId);
    }
  }

  // ========================================================================
  // CLIENT MANAGEMENT
  // ========================================================================

  /**
   * Add a client to a document
   *
   * @param documentId - Document ID
   * @param clientId - Client ID (connection ID)
   * @param userId - User ID
   */
  async addClient(documentId: string, clientId: string, userId: string): Promise<void> {
    const state = await this.getDocument(documentId);
    if (!state) {
      throw new Error(`Document not found: ${documentId}`);
    }

    state.connectedClients.add(clientId);
    state.engine.addActiveUser(userId);
  }

  /**
   * Remove a client from a document
   *
   * @param documentId - Document ID
   * @param clientId - Client ID
   * @param userId - User ID
   */
  async removeClient(documentId: string, clientId: string, userId: string): Promise<void> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return;
    }

    state.connectedClients.delete(clientId);
    state.engine.removeActiveUser(userId);

    // Save snapshot when last client disconnects
    if (state.connectedClients.size === 0 && this.config.enableSnapshots) {
      await this.saveSnapshot(documentId);
    }
  }

  /**
   * Get clients connected to a document
   *
   * @param documentId - Document ID
   * @returns Set of client IDs
   */
  async getDocumentClients(documentId: string): Promise<Set<string>> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return new Set();
    }

    return new Set(state.connectedClients);
  }

  // ========================================================================
  // MESSAGING
  // ========================================================================

  /**
   * Register a message handler
   *
   * @param messageType - Message type to handle
   * @param handler - Handler function
   * @returns Unsubscribe function
   */
  on(
    messageType: SyncMessageType,
    handler: (message: SyncMessage) => void
  ): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }

    this.messageHandlers.get(messageType)!.add(handler);

    return () => {
      this.messageHandlers.get(messageType)?.delete(handler);
    };
  }

  /**
   * Emit a message to all handlers
   *
   * @param message - Message to emit
   */
  private emit(message: SyncMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message);
        } catch (e) {
          console.error('Handler error:', e);
        }
      }
    }
  }

  // ========================================================================
  // AUTO-SAVE
  // ========================================================================

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(async () => {
      if (!this.config.enableSnapshots) {
        return;
      }

      for (const [documentId] of this.documents.entries()) {
        const state = this.documents.get(documentId);
        if (state && state.connectedClients.size > 0) {
          await this.saveSnapshot(documentId);
        }
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get manager statistics
   */
  getStats(): GatewayStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get document statistics
   *
   * @param documentId - Document ID
   * @returns Document statistics, or null if not found
   */
  async getDocumentStats(documentId: string): Promise<{
    documentId: string;
    contentLength: number;
    version: number;
    operationCount: number;
    activeUsers: number;
    connectedClients: number;
    createdAt: number;
    updatedAt: number;
  } | null> {
    const state = await this.getDocument(documentId);
    if (!state) {
      return null;
    }

    const engineStats = state.engine.getStats();

    return {
      documentId,
      contentLength: engineStats.contentLength,
      version: engineStats.version,
      operationCount: engineStats.operationCount,
      activeUsers: engineStats.userCount,
      connectedClients: state.connectedClients.size,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt
    };
  }

  /**
   * Get all document IDs
   */
  getDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Shutdown the manager
   *
   * Saves all documents and stops timers.
   */
  async shutdown(): Promise<void> {
    this.stopAutoSave();

    // Save all documents
    if (this.config.enableSnapshots) {
      for (const documentId of this.documents.keys()) {
        await this.saveSnapshot(documentId);
      }
    }

    // Clear all documents
    this.documents.clear();
    this.messageHandlers.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a document sync manager with default configuration
 */
export function createDocumentSyncManager(
  config?: Partial<DocumentSyncConfig>
): DocumentSyncManager {
  return new DocumentSyncManager(config);
}

/**
 * Create a document sync manager with custom persistence
 */
export function createDocumentSyncManagerWithPersistence(
  persistence: DocumentPersistence,
  config?: Partial<Omit<DocumentSyncConfig, 'persistence'>>
): DocumentSyncManager {
  return new DocumentSyncManager({
    ...config,
    persistence
  });
}
