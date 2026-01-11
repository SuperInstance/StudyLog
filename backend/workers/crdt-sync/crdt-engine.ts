/**
 * @file crdt-engine.ts - Core CRDT operations and data structures
 * @description Implements CRDT operations using Lamport clocks and operational transformation
 * @module backend/workers/crdt-sync/crdt-engine
 */

import type {
  DocumentOperation,
  DocumentSnapshot,
  ConflictResolution,
  OperationType
} from './types.js';

// ============================================================================
// LAMPORT CLOCK
// ============================================================================

/**
 * Lamport Clock for ordering operations in distributed systems
 *
 * Provides a logical clock that increments locally and merges with
 * received clock values to establish causal ordering.
 */
export class LamportClock {
  private time: number = 0;

  /**
   * Get current time
   */
  getTime(): number {
    return this.time;
  }

  /**
   * Increment clock (local event)
   */
  tick(): number {
    return ++this.time;
  }

  /**
   * Merge with another clock value (received event)
   */
  merge(otherTime: number): number {
    this.time = Math.max(this.time, otherTime) + 1;
    return this.time;
  }

  /**
   * Set clock to specific value (for initialization)
   */
  setTime(time: number): void {
    this.time = time;
  }

  /**
   * Reset clock to zero
   */
  reset(): void {
    this.time = 0;
  }
}

// ============================================================================
// VERSION VECTOR
// ============================================================================

/**
 * Version Vector for tracking causal relationships across replicas
 *
 * Tracks the latest version seen from each replica to determine
 * if operations are concurrent or causal.
 */
export class VersionVector {
  private vector: Map<string, number> = new Map();

  /**
   * Get version for a replica
   */
  get(replicaId: string): number {
    return this.vector.get(replicaId) || 0;
  }

  /**
   * Set version for a replica
   */
  set(replicaId: string, version: number): void {
    this.vector.set(replicaId, version);
  }

  /**
   * Increment version for a replica
   */
  increment(replicaId: string): number {
    const current = this.get(replicaId);
    const next = current + 1;
    this.set(replicaId, next);
    return next;
  }

  /**
   * Merge with another version vector
   * Takes the maximum version for each replica
   */
  merge(other: VersionVector): void {
    for (const [replicaId, version] of other.vector.entries()) {
      const current = this.get(replicaId);
      if (version > current) {
        this.set(replicaId, version);
      }
    }
  }

  /**
   * Check if an operation has been seen
   */
  hasSeen(operation: DocumentOperation): boolean {
    const replicaVersion = this.get(operation.replicaId);
    return operation.clock <= replicaVersion;
  }

  /**
   * Mark an operation as seen
   */
  markSeen(operation: DocumentOperation): void {
    const current = this.get(operation.replicaId);
    if (operation.clock > current) {
      this.set(operation.replicaId, operation.clock);
    }
  }

  /**
   * Check if two operations are concurrent
   */
  areConcurrent(op1: DocumentOperation, op2: DocumentOperation): boolean {
    // Different replicas
    if (op1.replicaId === op2.replicaId) {
      return false; // Same replica, ordered by clock
    }

    // Check causal relationship
    const op1SeenOp2 = this.get(op1.replicaId) >= op2.clock;
    const op2SeenOp1 = this.get(op2.replicaId) >= op1.clock;

    // If neither saw the other, they're concurrent
    return !op1SeenOp2 && !op2SeenOp1;
  }

  /**
   * Get all entries
   */
  entries(): Map<string, number> {
    return new Map(this.vector);
  }

  /**
   * Clear the vector
   */
  clear(): void {
    this.vector.clear();
  }

  /**
   * Clone the vector
   */
  clone(): VersionVector {
    const clone = new VersionVector();
    clone.merge(this);
    return clone;
  }
}

// ============================================================================
// CRDT ENGINE
// ============================================================================

/**
 * CRDT Engine Configuration
 */
export interface CRDTEngineConfig {
  /** Maximum operations to keep in log */
  maxOperationLogSize: number;
  /** Enable automatic compaction */
  enableCompaction: boolean;
  /** Compaction threshold (ratio of log size to content length) */
  compactionThreshold: number;
}

/**
 * Default CRDT Engine configuration
 */
export const DEFAULT_CRDT_CONFIG: CRDTEngineConfig = {
  maxOperationLogSize: 1000,
  enableCompaction: true,
  compactionThreshold: 10
};

/**
 * Transformation result
 */
interface TransformResult {
  /** Transformed operation */
  operation: DocumentOperation;
  /** Was transformation successful? */
  success: boolean;
  /** Reason for failure if any */
  reason?: string;
}

/**
 * CRDT Engine - Core CRDT operations for collaborative documents
 *
 * Implements a state-based CRDT for text documents with:
 * - Lamport clocks for operation ordering
 * - Operational transformation for concurrent edits
 * - Last-Writer-Wins for conflict resolution
 * - Causal ordering of operations
 * - Automatic log compaction
 */
export class CRDTEngine {
  /** Current document content */
  private content: string;

  /** Lamport clock for ordering */
  private clock: LamportClock;

  /** Version vector for replica tracking */
  private versionVector: VersionVector;

  /** All operations by ID */
  private operations: Map<string, DocumentOperation> = new Map();

  /** Ordered operation log */
  private operationLog: DocumentOperation[] = [];

  /** Active users in this document */
  private activeUsers: Set<string> = new Set();

  /** Configuration */
  private config: CRDTEngineConfig;

  /** Replica ID for this engine instance */
  private replicaId: string;

  /**
   * Create a new CRDT Engine
   *
   * @param initialContent - Initial document content
   * @param replicaId - Unique ID for this replica
   * @param config - Optional configuration
   */
  constructor(
    initialContent: string = '',
    replicaId: string,
    config?: Partial<CRDTEngineConfig>
  ) {
    this.content = initialContent;
    this.replicaId = replicaId;
    this.clock = new LamportClock();
    this.versionVector = new VersionVector();
    this.config = {
      ...DEFAULT_CRDT_CONFIG,
      ...config
    };
  }

  // ========================================================================
  // CONTENT ACCESS
  // ========================================================================

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
   * Get content length
   */
  getLength(): number {
    return this.content.length;
  }

  // ========================================================================
  // CLOCK ACCESS
  // ========================================================================

  /**
   * Get current clock value
   */
  getVersion(): number {
    return this.clock.getTime();
  }

  /**
   * Get version vector
   */
  getVersionVector(): VersionVector {
    return this.versionVector.clone();
  }

  /**
   * Get replica ID
   */
  getReplicaId(): string {
    return this.replicaId;
  }

  // ========================================================================
  // LOCAL OPERATIONS
  // ========================================================================

  /**
   * Insert text at position (local operation)
   *
   * @param userId - User performing the operation
   * @param position - Character position to insert at
   * @param text - Text to insert
   * @returns The created operation
   */
  insert(userId: string, position: number, text: string): DocumentOperation {
    this.validatePosition(position);

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      userId,
      type: 'insert',
      position,
      length: 0,
      text,
      timestamp: Date.now(),
      clock: this.clock.tick(),
      replicaId: this.replicaId
    };

    // Apply operation locally
    this.applyInsert(operation);

    // Record operation
    this.recordOperation(operation);

    // Update version vector
    this.versionVector.increment(this.replicaId);

    return operation;
  }

  /**
   * Delete text at position (local operation)
   *
   * @param userId - User performing the operation
   * @param position - Character position to delete from
   * @param length - Number of characters to delete
   * @returns The created operation
   */
  delete(userId: string, position: number, length: number): DocumentOperation {
    this.validateDeleteRange(position, length);

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      userId,
      type: 'delete',
      position,
      length,
      timestamp: Date.now(),
      clock: this.clock.tick(),
      replicaId: this.replicaId
    };

    // Apply operation locally
    this.applyDelete(operation);

    // Record operation
    this.recordOperation(operation);

    // Update version vector
    this.versionVector.increment(this.replicaId);

    return operation;
  }

  /**
   * Replace text at position (local operation)
   *
   * @param userId - User performing the operation
   * @param position - Character position to start replacement
   * @param length - Number of characters to replace
   * @param text - Replacement text
   * @returns The created operation
   */
  replace(
    userId: string,
    position: number,
    length: number,
    text: string
  ): DocumentOperation {
    this.validateReplaceRange(position, length);

    const operation: DocumentOperation = {
      id: this.generateOpId(),
      userId,
      type: 'replace',
      position,
      length,
      text,
      timestamp: Date.now(),
      clock: this.clock.tick(),
      replicaId: this.replicaId
    };

    // Apply operation locally
    this.applyReplace(operation);

    // Record operation
    this.recordOperation(operation);

    // Update version vector
    this.versionVector.increment(this.replicaId);

    return operation;
  }

  // ========================================================================
  // REMOTE OPERATIONS
  // ========================================================================

  /**
   * Apply a remote operation from another replica
   *
   * Handles operational transformation to handle concurrent edits.
   *
   * @param operation - Operation to apply
   * @returns The applied operation, or null if rejected
   */
  applyRemote(operation: DocumentOperation): DocumentOperation | null {
    // Check if we've already seen this operation
    if (this.operations.has(operation.id)) {
      return null; // Duplicate
    }

    // Check version vector for causal ordering
    if (this.versionVector.hasSeen(operation)) {
      return null; // Already seen an operation with higher clock from this replica
    }

    // Merge clocks
    this.clock.merge(operation.clock);

    // Transform operation based on concurrent operations
    const transformed = this.transformOperation(operation);

    if (!transformed.success) {
      return null; // Transformation failed
    }

    const op = transformed.operation;

    // Apply the transformed operation
    try {
      switch (op.type) {
        case 'insert':
          this.applyInsert(op);
          break;
        case 'delete':
          this.applyDelete(op);
          break;
        case 'replace':
          this.applyReplace(op);
          break;
      }

      // Record operation
      this.recordOperation(op);

      // Update version vector
      this.versionVector.markSeen(op);

      return op;
    } catch (e) {
      // Operation could not be applied - out of bounds
      console.warn('Failed to apply remote operation:', e);
      return null;
    }
  }

  /**
   * Apply multiple operations in batch
   *
   * @param operations - Operations to apply
   * @returns Results for each operation
   */
  applyRemoteBatch(operations: DocumentOperation[]): DocumentOperation[] {
    const applied: DocumentOperation[] = [];

    for (const op of operations) {
      const result = this.applyRemote(op);
      if (result) {
        applied.push(result);
      }
    }

    return applied;
  }

  // ========================================================================
  // MERGE & CONFLICT RESOLUTION
  // ========================================================================

  /**
   * Merge state from another replica
   *
   * @param remoteContent - Remote document content
   * @param remoteOperations - Operations from remote replica
   * @returns Conflict resolution information
   */
  merge(
    remoteContent: string,
    remoteOperations: DocumentOperation[]
  ): ConflictResolution {
    const before = this.content;
    const applied: DocumentOperation[] = [];
    const rejected: DocumentOperation[] = [];
    let conflictCount = 0;

    for (const op of remoteOperations) {
      // Skip if we already have this operation
      if (this.operations.has(op.id)) {
        continue;
      }

      const result = this.applyRemote(op);

      if (result) {
        applied.push(result);
      } else {
        rejected.push(op);
        // Only count as conflict if it's a legitimate reject (not duplicate)
        if (!this.operations.has(op.id)) {
          conflictCount++;
        }
      }
    }

    return {
      before,
      after: this.content,
      applied,
      rejected,
      conflictCount
    };
  }

  /**
   * Detect conflicts between local and remote operations
   *
   * @param localOps - Local operations
   * @param remoteOps - Remote operations
   * @returns Conflicting operation pairs
   */
  detectConflicts(
    localOps: DocumentOperation[],
    remoteOps: DocumentOperation[]
  ): Array<{ local: DocumentOperation; remote: DocumentOperation }> {
    const conflicts: Array<{ local: DocumentOperation; remote: DocumentOperation }> = [];
    const localOpsByPosition = new Map<number, DocumentOperation>();

    // Index local operations by position
    for (const op of localOps) {
      localOpsByPosition.set(op.position, op);
    }

    // Check for overlapping operations
    for (const remoteOp of remoteOps) {
      const localOp = localOpsByPosition.get(remoteOp.position);

      if (localOp && localOp.userId !== remoteOp.userId) {
        // Same position, different users = potential conflict
        const timeDiff = Math.abs(remoteOp.timestamp - localOp.timestamp);

        // If timestamps are close (< 100ms), consider it concurrent
        if (timeDiff < 100) {
          conflicts.push({ local: localOp, remote: remoteOp });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflict using Last-Writer-Wins
   *
   * @param local - Local operation
   * @param remote - Remote operation
   * @returns The winning operation
   */
  resolveConflictLWW(
    local: DocumentOperation,
    remote: DocumentOperation
  ): DocumentOperation {
    // Last-Writer-Wins based on timestamp
    if (remote.timestamp > local.timestamp) {
      return remote;
    } else if (remote.timestamp < local.timestamp) {
      return local;
    } else {
      // Timestamps are equal, use replica ID as tiebreaker
      return remote.replicaId > local.replicaId ? remote : local;
    }
  }

  // ========================================================================
  // SNAPSHOT & STATE
  // ========================================================================

  /**
   * Get a snapshot of current state
   */
  getSnapshot(): DocumentSnapshot {
    return {
      content: this.content,
      version: this.clock.getTime(),
      operations: [...this.operationLog],
      activeUsers: Array.from(this.activeUsers),
      createdAt: Date.now()
    };
  }

  /**
   * Load from a snapshot
   */
  loadSnapshot(snapshot: DocumentSnapshot): void {
    this.content = snapshot.content;
    this.clock = new LamportClock();
    this.clock.setTime(snapshot.version);
    this.operationLog = snapshot.operations;
    this.operations.clear();
    this.activeUsers = new Set(snapshot.activeUsers);

    for (const op of snapshot.operations) {
      this.operations.set(op.id, op);
      // Update version vector
      this.versionVector.markSeen(op);
    }
  }

  /**
   * Compact operation log
   *
   * Removes old operations when log exceeds threshold.
   * Keeps operations needed for future merges.
   */
  compact(): void {
    if (!this.config.enableCompaction) {
      return;
    }

    const logSize = this.operationLog.length;
    const contentLength = this.content.length;
    const ratio = contentLength > 0 ? logSize / contentLength : logSize;

    if (logSize > this.config.maxOperationLogSize ||
        ratio > this.config.compactionThreshold) {
      // Keep recent operations and remove old ones
      const keepCount = Math.min(
        this.config.maxOperationLogSize,
        Math.floor(contentLength * this.config.compactionThreshold * 0.5)
      );

      if (logSize > keepCount) {
        const removed = this.operationLog.splice(0, logSize - keepCount);
        for (const op of removed) {
          // Only remove if not needed for version vector
          const replicaVersion = this.versionVector.get(op.replicaId);
          if (op.clock < replicaVersion) {
            this.operations.delete(op.id);
          }
        }
      }
    }
  }

  // ========================================================================
  // USER MANAGEMENT
  // ========================================================================

  /**
   * Mark user as active in document
   */
  addActiveUser(userId: string): void {
    this.activeUsers.add(userId);
  }

  /**
   * Mark user as inactive
   */
  removeActiveUser(userId: string): void {
    this.activeUsers.delete(userId);
  }

  /**
   * Get active users
   */
  getActiveUsers(): string[] {
    return Array.from(this.activeUsers);
  }

  /**
   * Get operations by a specific user
   */
  getUserOperations(userId: string): DocumentOperation[] {
    return this.operationLog.filter((op) => op.userId === userId);
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get engine statistics
   */
  getStats(): {
    contentLength: number;
    version: number;
    operationCount: number;
    userCount: number;
    replicaId: string;
  } {
    const userCount = new Set(this.operationLog.map((op) => op.userId)).size;

    return {
      contentLength: this.content.length,
      version: this.clock.getTime(),
      operationCount: this.operationLog.length,
      userCount,
      replicaId: this.replicaId
    };
  }

  /**
   * Get all operations
   */
  getOperations(): DocumentOperation[] {
    return [...this.operationLog];
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Clear document and reset state
   */
  clear(): void {
    this.content = '';
    this.clock = new LamportClock();
    this.versionVector = new VersionVector();
    this.operations.clear();
    this.operationLog = [];
    this.activeUsers.clear();
  }

  /**
   * Export state to JSON
   */
  export(): string {
    return JSON.stringify(this.getSnapshot());
  }

  /**
   * Import state from JSON
   */
  import(data: string): void {
    try {
      const snapshot = JSON.parse(data) as DocumentSnapshot;
      this.loadSnapshot(snapshot);
    } catch (e) {
      throw new Error('Invalid snapshot data');
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  /**
   * Validate position is within bounds
   */
  private validatePosition(position: number): void {
    if (position < 0 || position > this.content.length) {
      throw new Error(`Invalid position: ${position} (content length: ${this.content.length})`);
    }
  }

  /**
   * Validate delete range
   */
  private validateDeleteRange(position: number, length: number): void {
    if (length <= 0) {
      throw new Error(`Invalid length: ${length}`);
    }
    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid delete range: ${position}, ${length}`);
    }
  }

  /**
   * Validate replace range
   */
  private validateReplaceRange(position: number, length: number): void {
    if (position < 0 || position + length > this.content.length) {
      throw new Error(`Invalid replace range: ${position}, ${length}`);
    }
  }

  /**
   * Apply insert operation to content
   */
  private applyInsert(operation: DocumentOperation): void {
    const { position, text = '' } = operation;
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position);
  }

  /**
   * Apply delete operation to content
   */
  private applyDelete(operation: DocumentOperation): void {
    const { position, length } = operation;
    this.content =
      this.content.slice(0, position) + this.content.slice(position + length);
  }

  /**
   * Apply replace operation to content
   */
  private applyReplace(operation: DocumentOperation): void {
    const { position, length, text = '' } = operation;
    this.content =
      this.content.slice(0, position) + text + this.content.slice(position + length);
  }

  /**
   * Transform operation based on concurrent operations
   *
   * Implements operational transformation to handle concurrent edits.
   */
  private transformOperation(operation: DocumentOperation): TransformResult {
    let transformed = { ...operation };
    let position = operation.position;

    // Apply concurrent operations that happened before this one
    for (const op of this.operationLog) {
      // Skip operations from same replica (already ordered)
      if (op.replicaId === operation.replicaId) {
        continue;
      }

      // Skip if this operation happened after the concurrent one
      if (op.clock > operation.clock) {
        continue;
      }

      // Transform position based on concurrent operation
      if (op.type === 'insert' && op.position <= position) {
        // Concurrent insert before our position - shift right
        position += (op.text?.length || 0);
      } else if (op.type === 'delete') {
        if (op.position + op.length <= position) {
          // Delete entirely before our position - shift left
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
          // Replace before our position - adjust for size difference
          const sizeDiff = (op.text?.length || 0) - op.length;
          position += sizeDiff;
        } else if (
          op.position < position &&
          op.position + op.length > position
        ) {
          // Overlapping replace - complex case
          // For simplicity, reject this operation
          return {
            operation: transformed,
            success: false,
            reason: 'Overlapping replace operation'
          };
        }
      }
    }

    // Validate transformed position
    if (position < 0 || position > this.content.length) {
      // Position out of bounds after transformation
      return {
        operation: transformed,
        success: false,
        reason: 'Transformed position out of bounds'
      };
    }

    // For replace operations, also validate the range
    if (operation.type === 'replace') {
      const endPos = position + transformed.length;
      if (endPos > this.content.length) {
        return {
          operation: transformed,
          success: false,
          reason: 'Transformed range out of bounds'
        };
      }
    }

    transformed.position = position;
    return {
      operation: transformed,
      success: true
    };
  }

  /**
   * Record operation in log and map
   */
  private recordOperation(operation: DocumentOperation): void {
    this.operations.set(operation.id, operation);
    this.operationLog.push(operation);
    this.activeUsers.add(operation.userId);

    // Trim log if too large
    if (this.operationLog.length > this.config.maxOperationLogSize) {
      this.compact();
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOpId(): string {
    return `${this.replicaId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new CRDT Engine with default settings
 */
export function createCRDTEngine(
  initialContent?: string,
  replicaId?: string
): CRDTEngine {
  return new CRDTEngine(
    initialContent || '',
    replicaId || `replica_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
}

/**
 * Create CRDT Engines for a group of replicas
 */
export function createCRDTGroup(
  replicaCount: number,
  initialContent?: string
): Map<string, CRDTEngine> {
  const group = new Map<string, CRDTEngine>();

  for (let i = 0; i < replicaCount; i++) {
    const replicaId = `replica_${i}`;
    group.set(replicaId, new CRDTEngine(initialContent || '', replicaId));
  }

  return group;
}
