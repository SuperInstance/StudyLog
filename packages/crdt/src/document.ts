/**
 * Document CRDT for collaborative text editing
 *
 * Implements a text document CRDT using operational transformation
 * with Lamport clocks for causal ordering.
 */

import type { NodeId, ClockValue, Timestamp, CRDTState, CRDTOperation } from './types.js';
import { VectorClock } from './clock.js';
import { Merge } from './merge.js';

/**
 * Operation types for text documents
 */
export type TextOperationType = 'insert' | 'delete' | 'replace';

/**
 * A document operation
 */
export interface DocumentOperation extends CRDTOperation {
  /** Type of operation */
  type: TextOperationType;
  /** Position in the document */
  position: number;
  /** Length of affected text (for delete/replace) */
  length: number;
  /** Text being inserted (for insert/replace) */
  text?: string;
}

/**
 * Snapshot of document state
 */
export interface DocumentSnapshot {
  /** Document content */
  content: string;
  /** Current version (Lamport clock) */
  version: ClockValue;
  /** List of operations that created this state */
  operations: DocumentOperation[];
  /** Users currently editing */
  activeUsers: NodeId[];
}

/**
 * State for document persistence
 */
export interface DocumentState extends CRDTState {
  /** Document content */
  content: string;
  /** Operation log */
  operations: DocumentOperation[];
  /** Active users */
  activeUsers: NodeId[];
}

/**
 * Result of a merge/operation application
 */
export interface ConflictResolution {
  /** Original content before merge */
  before: string;
  /** Merged content after conflict resolution */
  after: string;
  /** Operations that were applied */
  applied: DocumentOperation[];
  /** Operations that were rejected (conflicting) */
  rejected: DocumentOperation[];
  /** Number of conflicts resolved */
  conflictCount: number;
}

/**
 * Result of applying an operation
 */
export interface OperationResult {
  /** The operation that was applied */
  operation: DocumentOperation;
  /** New content */
  content: string;
  /** Whether content changed */
  changed: boolean;
}

/**
 * Text Document CRDT
 *
 * Implements a state-based CRDT for text documents using:
 * - Lamport clocks for operation ordering
 * - Operational transformation for concurrent edits
 * - Last-Writer-Wins for conflict resolution
 * - Causal ordering of operations
 *
 * Use cases: Collaborative text editing, code collaboration, notes
 */
export class Document {
  private content: string = '';
  private clock: VectorClock;
  private operations: DocumentOperation[] = [];
  private operationMap: Map<string, DocumentOperation> = new Map();
  private userClocks: Map<NodeId, ClockValue> = new Map();
  private activeUsers: Set<NodeId> = new Set();

  constructor(nodeId: NodeId, initialContent: string = '') {
    this.clock = new VectorClock(nodeId);
    this.content = initialContent;
  }

  /**
   * Get current document content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Set content directly (for initialization)
   */
  setContent(content: string): void {
    this.content = content;
  }

  /**
   * Get current version (Lamport clock)
   */
  getVersion(): ClockValue {
    return this.clock.get();
  }

  /**
   * Get node ID
   */
  getNodeId(): NodeId {
    return this.clock.getNodeId();
  }

  /**
   * Insert text at position
   */
  insert(position: number, text: string): DocumentOperation {
    if (position < 0 || position > this.content.length) {
      throw new Error(`Invalid position: ${position}`);
    }

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      nodeId: this.clock.getNodeId(),
      type: 'insert',
      position,
      length: 0,
      text,
      timestamp: Date.now(),
      clock: this.clock.tick(),
    };

    // Apply operation
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position);

    // Record operation
    this.recordOperation(operation);

    return operation;
  }

  /**
   * Delete text at position
   */
  delete(position: number, length: number): DocumentOperation {
    if (length <= 0) {
      throw new Error(`Invalid length: ${length}`);
    }

    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid delete range: ${position}, ${length}`);
    }

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      nodeId: this.clock.getNodeId(),
      type: 'delete',
      position,
      length,
      timestamp: Date.now(),
      clock: this.clock.tick(),
    };

    // Apply operation
    this.content =
      this.content.slice(0, position) + this.content.slice(position + length);

    // Record operation
    this.recordOperation(operation);

    return operation;
  }

  /**
   * Replace text at position
   */
  replace(position: number, length: number, text: string): DocumentOperation {
    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid replace range: ${position}, ${length}`);
    }

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      nodeId: this.clock.getNodeId(),
      type: 'replace',
      position,
      length,
      text,
      timestamp: Date.now(),
      clock: this.clock.tick(),
    };

    // Apply operation
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position + length);

    // Record operation
    this.recordOperation(operation);

    return operation;
  }

  /**
   * Apply a remote operation from another replica
   * Implements operational transformation for concurrent edits
   */
  applyRemote(operation: DocumentOperation): OperationResult | null {
    // Check if already seen
    const userClock = this.userClocks.get(operation.nodeId) || 0;

    if (operation.clock <= userClock) {
      // Already seen this operation or it's old
      return null;
    }

    this.userClocks.set(operation.nodeId, operation.clock);

    // Merge clocks
    this.clock.merge(operation.clock);

    // Check if we already have this operation
    if (this.operationMap.has(operation.id)) {
      return null;
    }

    // Transform operation based on current state
    const transformed = this.transformOperation(operation);

    if (!transformed) {
      return null;
    }

    // Apply the transformed operation
    try {
      const beforeLength = this.content.length;

      switch (transformed.type) {
        case 'insert':
          if (
            transformed.position >= 0 &&
            transformed.position <= this.content.length
          ) {
            this.content =
              this.content.slice(0, transformed.position) +
              transformed.text! +
              this.content.slice(transformed.position);
          }
          break;

        case 'delete':
          if (
            transformed.position >= 0 &&
            transformed.position + transformed.length <= this.content.length
          ) {
            this.content =
              this.content.slice(0, transformed.position) +
              this.content.slice(transformed.position + transformed.length);
          }
          break;

        case 'replace':
          if (
            transformed.position >= 0 &&
            transformed.position + transformed.length <= this.content.length
          ) {
            this.content =
              this.content.slice(0, transformed.position) +
              transformed.text! +
              this.content.slice(transformed.position + transformed.length);
          }
          break;
      }

      const changed = this.content.length !== beforeLength || this.content !== this.content.slice(0, beforeLength) + this.content.slice(beforeLength);

      // Record operation
      this.recordOperation(transformed);

      return {
        operation: transformed,
        content: this.content,
        changed,
      };
    } catch (e) {
      // Operation could not be applied - out of bounds
      console.warn('Failed to apply remote operation:', e);
      return null;
    }
  }

  /**
   * Transform operation based on concurrent operations
   * This is a simplified OT implementation
   */
  private transformOperation(operation: DocumentOperation): DocumentOperation | null {
    let transformed = { ...operation };
    let position = operation.position;

    // Apply concurrent operations that happened before this one
    for (const op of this.operations) {
      if (op.nodeId === operation.nodeId) {
        continue; // Skip operations from same user
      }

      // Transform position based on concurrent operation
      if (op.type === 'insert' && op.position <= position) {
        position += op.text!.length;
      } else if (op.type === 'delete') {
        if (op.position + op.length <= position) {
          position -= op.length;
        } else if (op.position < position && op.position + op.length > position) {
          // Overlapping delete - adjust position and length
          const overlap = op.position + op.length - position;
          transformed.position = op.position;
          transformed.length = Math.max(0, transformed.length - overlap);
          position = op.position;
        }
      } else if (op.type === 'replace') {
        if (op.position + op.length <= position) {
          position += op.text!.length - op.length;
        } else if (op.position < position && op.position + op.length > position) {
          // Overlapping replace - use LWW
          if (op.clock > operation.clock) {
            // Their replace wins, reject this one
            return null;
          }
        }
      }
    }

    transformed.position = position;
    return transformed;
  }

  /**
   * Merge state from another document
   * Returns conflict resolution information
   */
  merge(remote: Document): ConflictResolution {
    const before = this.content;
    const applied: DocumentOperation[] = [];
    const rejected: DocumentOperation[] = [];
    let conflictCount = 0;

    // Get remote operations
    const remoteOps = remote.getOperations();

    for (const op of remoteOps) {
      // Check if we already have this operation
      if (this.operationMap.has(op.id)) {
        continue;
      }

      const result = this.applyRemote(op);

      if (result) {
        applied.push(result.operation);
      } else {
        rejected.push(op);
        if (op.position < this.content.length) {
          conflictCount++;
        }
      }
    }

    return {
      before,
      after: this.content,
      applied,
      rejected,
      conflictCount,
    };
  }

  /**
   * Get snapshot of current state
   */
  getSnapshot(): DocumentSnapshot {
    return {
      content: this.content,
      version: this.clock.get(),
      operations: [...this.operations],
      activeUsers: Array.from(this.activeUsers),
    };
  }

  /**
   * Load from snapshot
   */
  loadSnapshot(snapshot: DocumentSnapshot): void {
    this.content = snapshot.content;
    this.clock = new VectorClock(this.clock.getNodeId(), snapshot.version);
    this.operations = snapshot.operations;
    this.activeUsers = new Set(snapshot.activeUsers);

    this.operationMap.clear();
    for (const op of this.operations) {
      this.operationMap.set(op.id, op);
      this.userClocks.set(op.nodeId, Math.max(this.userClocks.get(op.nodeId) || 0, op.clock));
    }
  }

  /**
   * Get all operations
   */
  getOperations(): DocumentOperation[] {
    return [...this.operations];
  }

  /**
   * Get operation history for a user
   */
  getUserOperations(userId: NodeId): DocumentOperation[] {
    return this.operations.filter((op) => op.nodeId === userId);
  }

  /**
   * Mark user as active
   */
  addActiveUser(userId: NodeId): void {
    this.activeUsers.add(userId);
  }

  /**
   * Mark user as inactive
   */
  removeActiveUser(userId: NodeId): void {
    this.activeUsers.delete(userId);
  }

  /**
   * Get active users
   */
  getActiveUsers(): NodeId[] {
    return Array.from(this.activeUsers);
  }

  /**
   * Get statistics
   */
  getStats(): {
    contentLength: number;
    version: ClockValue;
    operationCount: number;
    userCount: number;
  } {
    const userCount = new Set(this.operations.map((op) => op.nodeId)).size;

    return {
      contentLength: this.content.length,
      version: this.clock.get(),
      operationCount: this.operations.length,
      userCount,
    };
  }

  /**
   * Clear document and reset state
   */
  clear(): void {
    this.content = '';
    this.clock = new VectorClock(this.clock.getNodeId());
    this.operations = [];
    this.operationMap.clear();
    this.activeUsers.clear();
    this.userClocks.clear();
  }

  /**
   * Record operation in log and map
   */
  private recordOperation(operation: DocumentOperation): void {
    this.operationMap.set(operation.id, operation);
    this.operations.push(operation);
    this.activeUsers.add(operation.nodeId);

    // Trim log if too long (keep last 1000 operations)
    if (this.operations.length > 1000) {
      const removed = this.operations.shift()!;
      this.operationMap.delete(removed.id);
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOpId(): string {
    return `${this.clock.getNodeId()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export state for transmission
   */
  export(): string {
    return JSON.stringify(this.getSnapshot());
  }

  /**
   * Import state from transmission
   */
  import(data: string): void {
    const snapshot = JSON.parse(data) as DocumentSnapshot;
    this.loadSnapshot(snapshot);
  }
}

/**
 * Factory for creating and managing multiple documents
 */
export class DocumentStore {
  private static documents: Map<string, Document> = new Map();

  /**
   * Get or create a document
   */
  static get(documentId: string, nodeId: NodeId = 'default'): Document {
    if (!this.documents.has(documentId)) {
      this.documents.set(documentId, new Document(nodeId));
    }
    return this.documents.get(documentId)!;
  }

  /**
   * Create a new document with initial content
   */
  static create(documentId: string, content: string, nodeId: NodeId = 'default'): Document {
    const doc = new Document(nodeId, content);
    this.documents.set(documentId, doc);
    return doc;
  }

  /**
   * Delete a document
   */
  static delete(documentId: string): void {
    this.documents.delete(documentId);
  }

  /**
   * Check if a document exists
   */
  static has(documentId: string): boolean {
    return this.documents.has(documentId);
  }

  /**
   * Get all document IDs
   */
  static getAllDocumentIds(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get statistics for all documents
   */
  static getStats(): Array<{ documentId: string; stats: ReturnType<Document['getStats']> }> {
    return Array.from(this.documents.entries()).map(([documentId, doc]) => ({
      documentId,
      stats: doc.getStats(),
    }));
  }

  /**
   * Clear all documents
   */
  static clearAll(): void {
    this.documents.clear();
  }
}
