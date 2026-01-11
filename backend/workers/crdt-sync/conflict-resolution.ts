/**
 * @file conflict-resolution.ts - Merge strategies and conflict handling
 * @description Advanced conflict resolution strategies for CRDT operations
 * @module backend/workers/crdt-sync/conflict-resolution
 */

import type {
  DocumentOperation,
  ConflictResolution,
  OperationType
} from './types.js';

// ============================================================================
// CONFLICT DETECTION
// ============================================================================

/**
 * Conflict information
 */
export interface Conflict {
  /** The conflicting operations */
  operations: DocumentOperation[];
  /** Type of conflict */
  type: ConflictType;
  /** Severity level */
  severity: ConflictSeverity;
  /** Suggested resolution */
  resolution?: ConflictResolution;
}

/**
 * Conflict types
 */
export enum ConflictType {
  /** Concurrent insertions at same position */
  CONCURRENT_INSERT = 'concurrent_insert',
  /** Concurrent deletions of overlapping ranges */
  CONCURRENT_DELETE = 'concurrent_delete',
  /** Insert and delete at same position */
  INSERT_DELETE = 'insert_delete',
  /** Overlapping replacements */
  OVERLAPPING_REPLACE = 'overlapping_replace',
  /** Replace and delete overlap */
  REPLACE_DELETE = 'replace_delete',
  /** Multiple operations on same position */
  MULTI_WAY = 'multi_way'
}

/**
 * Conflict severity
 */
export enum ConflictSeverity {
  /** Low - can auto-resolve */
  LOW = 'low',
  /** Medium - may need user guidance */
  MEDIUM = 'medium',
  /** High - requires user intervention */
  HIGH = 'high'
}

// ============================================================================
// RESOLUTION STRATEGIES
// ============================================================================

/**
 * Resolution strategy type
 */
export enum ResolutionStrategy {
  /** Last-Writer-Wins based on timestamp */
  LWW = 'lww',
  /** First-Writer-Wins */
  FWW = 'fww',
  /** Operational transformation (merge both) */
  OT = 'ot',
  /** User intervention required */
  MANUAL = 'manual',
  /** Random choice */
  RANDOM = 'random',
  /** Replica ID order */
  REPLICA_ORDER = 'replica_order',
  /** Custom strategy */
  CUSTOM = 'custom'
}

/**
 * Resolution options
 */
export interface ResolutionOptions {
  /** Primary resolution strategy */
  strategy: ResolutionStrategy;
  /** Fallback strategy if primary fails */
  fallback?: ResolutionStrategy;
  /** Maximum time to wait for resolution (ms) */
  timeout?: number;
  /** Whether to notify users of conflicts */
  notifyUsers?: boolean;
  /** Custom resolver function */
  customResolver?: (conflicts: Conflict[]) => ConflictResolution;
}

/**
 * Default resolution options
 */
export const DEFAULT_RESOLUTION_OPTIONS: ResolutionOptions = {
  strategy: ResolutionStrategy.LWW,
  fallback: ResolutionStrategy.OT,
  timeout: 5000,
  notifyUsers: true
};

// ============================================================================
// CONFLICT RESOLVER
// ============================================================================

/**
 * Conflict Resolver
 *
 * Handles detection and resolution of conflicts in CRDT operations:
 * - Detects concurrent conflicting operations
 * - Applies various resolution strategies
 * - Provides user notification for severe conflicts
 * - Tracks conflict statistics
 */
export class ConflictResolver {
  /** Resolution options */
  private options: ResolutionOptions;

  /** Conflict statistics */
  private stats = {
    totalConflicts: 0,
    resolvedByLWW: 0,
    resolvedByOT: 0,
    resolvedByManual: 0,
    resolvedByOther: 0
  };

  /** Pending conflicts awaiting resolution */
  private pendingConflicts: Map<string, Conflict> = new Map();

  /**
   * Create a new Conflict Resolver
   *
   * @param options - Resolution options
   */
  constructor(options?: Partial<ResolutionOptions>) {
    this.options = {
      ...DEFAULT_RESOLUTION_OPTIONS,
      ...options
    };
  }

  // ========================================================================
  // CONFLICT DETECTION
  // ========================================================================

  /**
   * Detect conflicts between sets of operations
   *
   * @param localOps - Local operations
   * @param remoteOps - Remote operations
   * @returns Array of detected conflicts
   */
  detectConflicts(
    localOps: DocumentOperation[],
    remoteOps: DocumentOperation[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Index operations by position
    const localByPosition = this.indexByPosition(localOps);
    const remoteByPosition = this.indexByPosition(remoteOps);

    // Check each position for conflicts
    const allPositions = new Set([
      ...localByPosition.keys(),
      ...remoteByPosition.keys()
    ]);

    for (const position of allPositions) {
      const atLocal = localByPosition.get(position) || [];
      const atRemote = remoteByPosition.get(position) || [];

      if (atLocal.length === 0 || atRemote.length === 0) {
        continue;
      }

      // Check for concurrent operations
      for (const localOp of atLocal) {
        for (const remoteOp of atRemote) {
          if (this.areConcurrent(localOp, remoteOp)) {
            const conflict = this.analyzeConflict(localOp, remoteOp);
            conflicts.push(conflict);
          }
        }
      }
    }

    // Check for overlapping ranges
    const overlaps = this.detectOverlappingRanges(localOps, remoteOps);
    conflicts.push(...overlaps);

    return conflicts;
  }

  /**
   * Check if two operations are concurrent
   *
   * @param op1 - First operation
   * @param op2 - Second operation
   * @returns True if concurrent
   */
  areConcurrent(op1: DocumentOperation, op2: DocumentOperation): boolean {
    // Same replica means ordered
    if (op1.replicaId === op2.replicaId) {
      return false;
    }

    // Check timestamp proximity
    const timeDiff = Math.abs(op1.timestamp - op2.timestamp);
    if (timeDiff < 100) {
      // Within 100ms, likely concurrent
      return true;
    }

    // Check for causal relationship via clock
    // (This would need version vector in real implementation)

    return false;
  }

  // ========================================================================
  // CONFLICT ANALYSIS
  // ========================================================================

  /**
   * Analyze a pair of conflicting operations
   *
   * @param op1 - First operation
   * @param op2 - Second operation
   * @returns Conflict analysis
   */
  private analyzeConflict(op1: DocumentOperation, op2: DocumentOperation): Conflict {
    let type: ConflictType;
    let severity: ConflictSeverity;

    // Determine conflict type
    if (op1.type === 'insert' && op2.type === 'insert') {
      type = ConflictType.CONCURRENT_INSERT;
      severity = ConflictSeverity.LOW;
    } else if (op1.type === 'delete' && op2.type === 'delete') {
      type = ConflictType.CONCURRENT_DELETE;
      severity = ConflictSeverity.MEDIUM;
    } else if ((op1.type === 'insert' && op2.type === 'delete') ||
               (op1.type === 'delete' && op2.type === 'insert')) {
      type = ConflictType.INSERT_DELETE;
      severity = ConflictSeverity.MEDIUM;
    } else if (op1.type === 'replace' && op2.type === 'replace') {
      type = ConflictType.OVERLAPPING_REPLACE;
      severity = ConflictSeverity.HIGH;
    } else if ((op1.type === 'replace' && op2.type === 'delete') ||
               (op1.type === 'delete' && op2.type === 'replace')) {
      type = ConflictType.REPLACE_DELETE;
      severity = ConflictSeverity.HIGH;
    } else {
      type = ConflictType.MULTI_WAY;
      severity = ConflictSeverity.MEDIUM;
    }

    return {
      operations: [op1, op2],
      type,
      severity
    };
  }

  /**
   * Detect overlapping range conflicts
   *
   * @param localOps - Local operations
   * @param remoteOps - Remote operations
   * @returns Array of overlapping conflicts
   */
  private detectOverlappingRanges(
    localOps: DocumentOperation[],
    remoteOps: DocumentOperation[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    for (const localOp of localOps) {
      for (const remoteOp of remoteOps) {
        if (this.operationsOverlap(localOp, remoteOp)) {
          const conflict = this.analyzeConflict(localOp, remoteOp);
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two operations overlap
   *
   * @param op1 - First operation
   * @param op2 - Second operation
   * @returns True if operations overlap
   */
  private operationsOverlap(op1: DocumentOperation, op2: DocumentOperation): boolean {
    const op1End = op1.position + (op1.type === 'delete' || op1.type === 'replace' ? op1.length : 0);
    const op2End = op2.position + (op2.type === 'delete' || op2.type === 'replace' ? op2.length : 0);

    // Check if ranges overlap
    return !(op1End <= op2.position || op2End <= op1.position);
  }

  // ========================================================================
  // RESOLUTION STRATEGIES
  // ========================================================================

  /**
   * Resolve a conflict using configured strategy
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolve(conflict: Conflict): ConflictResolution {
    this.stats.totalConflicts++;

    try {
      switch (this.options.strategy) {
        case ResolutionStrategy.LWW:
          return this.resolveLWW(conflict);
        case ResolutionStrategy.FWW:
          return this.resolveFWW(conflict);
        case ResolutionStrategy.OT:
          return this.resolveOT(conflict);
        case ResolutionStrategy.RANDOM:
          return this.resolveRandom(conflict);
        case ResolutionStrategy.REPLICA_ORDER:
          return this.resolveReplicaOrder(conflict);
        case ResolutionStrategy.CUSTOM:
          if (this.options.customResolver) {
            return this.options.customResolver([conflict]);
          }
          // Fall through to fallback
          break;
        case ResolutionStrategy.MANUAL:
          return this.queueForManualResolution(conflict);
      }

      // Try fallback strategy
      if (this.options.fallback && this.options.fallback !== this.options.strategy) {
        return this.resolveWithStrategy(conflict, this.options.fallback);
      }

      // Default to LWW
      return this.resolveLWW(conflict);
    } catch (e) {
      console.error('Resolution error:', e);
      // Emergency fallback
      return this.resolveLWW(conflict);
    }
  }

  /**
   * Resolve with specific strategy
   *
   * @param conflict - Conflict to resolve
   * @param strategy - Strategy to use
   * @returns Resolution result
   */
  private resolveWithStrategy(conflict: Conflict, strategy: ResolutionStrategy): ConflictResolution {
    switch (strategy) {
      case ResolutionStrategy.LWW:
        return this.resolveLWW(conflict);
      case ResolutionStrategy.FWW:
        return this.resolveFWW(conflict);
      case ResolutionStrategy.OT:
        return this.resolveOT(conflict);
      default:
        return this.resolveLWW(conflict);
    }
  }

  /**
   * Last-Writer-Wins resolution
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolveLWW(conflict: Conflict): ConflictResolution {
    const [op1, op2] = conflict.operations;
    const winner = this.selectLWW(op1, op2);
    const loser = winner === op1 ? op2 : op1;

    this.stats.resolvedByLWW++;

    return {
      before: '', // Would need context for real before/after
      after: '',
      applied: [winner],
      rejected: [loser],
      conflictCount: 1
    };
  }

  /**
   * First-Writer-Wins resolution
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolveFWW(conflict: Conflict): ConflictResolution {
    const [op1, op2] = conflict.operations;
    const winner = op1.timestamp <= op2.timestamp ? op1 : op2;
    const loser = winner === op1 ? op2 : op1;

    this.stats.resolvedByOther++;

    return {
      before: '',
      after: '',
      applied: [winner],
      rejected: [loser],
      conflictCount: 1
    };
  }

  /**
   * Operational Transformation resolution
   *
   * Attempts to merge both operations
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolveOT(conflict: Conflict): ConflictResolution {
    const [op1, op2] = conflict.operations;

    // For concurrent inserts, can merge both
    if (conflict.type === ConflictType.CONCURRENT_INSERT) {
      this.stats.resolvedByOT++;

      return {
        before: '',
        after: '',
        applied: [op1, op2],
        rejected: [],
        conflictCount: 0
      };
    }

    // For other types, fall back to LWW
    return this.resolveLWW(conflict);
  }

  /**
   * Random resolution
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolveRandom(conflict: Conflict): ConflictResolution {
    const [op1, op2] = conflict.operations;
    const winner = Math.random() > 0.5 ? op1 : op2;
    const loser = winner === op1 ? op2 : op1;

    this.stats.resolvedByOther++;

    return {
      before: '',
      after: '',
      applied: [winner],
      rejected: [loser],
      conflictCount: 1
    };
  }

  /**
   * Replica ID order resolution
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolveReplicaOrder(conflict: Conflict): ConflictResolution {
    const [op1, op2] = conflict.operations;
    const winner = op1.replicaId > op2.replicaId ? op1 : op2;
    const loser = winner === op1 ? op2 : op1;

    this.stats.resolvedByOther++;

    return {
      before: '',
      after: '',
      applied: [winner],
      rejected: [loser],
      conflictCount: 1
    };
  }

  /**
   * Queue for manual resolution
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result (pending)
   */
  private queueForManualResolution(conflict: Conflict): ConflictResolution {
    const conflictId = this.generateConflictId(conflict);
    this.pendingConflicts.set(conflictId, conflict);

    this.stats.resolvedByManual++;

    return {
      before: '',
      after: '',
      applied: [],
      rejected: conflict.operations,
      conflictCount: conflict.operations.length
    };
  }

  // ========================================================================
  // LWW SELECTION
  // ========================================================================

  /**
   * Select winning operation using Last-Writer-Wins
   *
   * @param op1 - First operation
   * @param op2 - Second operation
   * @returns The winning operation
   */
  selectLWW(op1: DocumentOperation, op2: DocumentOperation): DocumentOperation {
    // First by timestamp
    if (op2.timestamp > op1.timestamp) {
      return op2;
    } else if (op2.timestamp < op1.timestamp) {
      return op1;
    }

    // Then by clock
    if (op2.clock > op1.clock) {
      return op2;
    } else if (op2.clock < op1.clock) {
      return op1;
    }

    // Finally by replica ID for deterministic tiebreak
    return op2.replicaId > op1.replicaId ? op2 : op1;
  }

  // ========================================================================
  // BATCH RESOLUTION
  // ========================================================================

  /**
   * Resolve multiple conflicts
   *
   * @param conflicts - Conflicts to resolve
   * @returns Array of resolution results
   */
  resolveBatch(conflicts: Conflict[]): ConflictResolution[] {
    return conflicts.map(c => this.resolve(c));
  }

  /**
   * Resolve conflicts with user guidance
   *
   * @param conflicts - Conflicts to resolve
   * @param userChoices - User's choices for each conflict
   * @returns Resolution results
   */
  resolveWithUserGuidance(
    conflicts: Conflict[],
    userChoices: Map<string, DocumentOperation>
  ): ConflictResolution[] {
    const results: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const conflictId = this.generateConflictId(conflict);
      const userChoice = userChoices.get(conflictId);

      if (userChoice) {
        // Apply user's choice
        const rejected = conflict.operations.filter(op => op.id !== userChoice.id);

        results.push({
          before: '',
          after: '',
          applied: [userChoice],
          rejected,
          conflictCount: conflict.operations.length
        });
      } else {
        // No user choice, use default strategy
        results.push(this.resolve(conflict));
      }
    }

    return results;
  }

  // ========================================================================
  // STATISTICS & INFO
  // ========================================================================

  /**
   * Get conflict statistics
   */
  getStats(): {
    totalConflicts: number;
    resolvedByLWW: number;
    resolvedByOT: number;
    resolvedByManual: number;
    resolvedByOther: number;
    pendingResolution: number;
  } {
    return {
      ...this.stats,
      pendingResolution: this.pendingConflicts.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalConflicts: 0,
      resolvedByLWW: 0,
      resolvedByOT: 0,
      resolvedByManual: 0,
      resolvedByOther: 0
    };
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): Conflict[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Resolve a pending conflict
   *
   * @param conflictId - Conflict ID
   * @param resolution - Resolution to apply
   */
  resolvePending(conflictId: string, resolution: ConflictResolution): void {
    this.pendingConflicts.delete(conflictId);
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Index operations by position
   *
   * @param operations - Operations to index
   * @returns Map of position to operations
   */
  private indexByPosition(operations: DocumentOperation[]): Map<number, DocumentOperation[]> {
    const index = new Map<number, DocumentOperation[]>();

    for (const op of operations) {
      if (!index.has(op.position)) {
        index.set(op.position, []);
      }
      index.get(op.position)!.push(op);
    }

    return index;
  }

  /**
   * Generate conflict ID
   *
   * @param conflict - Conflict
   * @returns Unique conflict ID
   */
  private generateConflictId(conflict: Conflict): string {
    const ids = conflict.operations.map(op => op.id).sort();
    return `conflict_${ids.join('_')}`;
  }
}

// ============================================================================
// PRODUCT-SPECIFIC RESOLVERS
// ============================================================================

/**
 * StudyLoG.AI specific conflict resolver
 *
 * Handles code-specific conflicts like:
 * - Syntax-aware merging
 * - Bracket matching
 * - Indentation preservation
 */
export class StudyLoGConflictResolver extends ConflictResolver {
  constructor() {
    super({
      strategy: ResolutionStrategy.OT,
      fallback: ResolutionStrategy.LWW,
      notifyUsers: true
    });
  }

  /**
   * Resolve conflict with code awareness
   *
   * @param conflict - Conflict to resolve
   * @returns Resolution result
   */
  resolveCodeConflict(conflict: Conflict, context?: string): ConflictResolution {
    // For code documents, try to preserve syntactic correctness

    // If inserting at same position, check for bracket/quote pairs
    if (conflict.type === ConflictType.CONCURRENT_INSERT && context) {
      const [op1, op2] = conflict.operations;
      const text1 = op1.text || '';
      const text2 = op2.text || '';

      // Check if both are inserting complementary brackets
      const bracketPairs: Record<string, string> = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'"
      };

      if (bracketPairs[text1] === text2 || bracketPairs[text2] === text1) {
        // Complementary brackets - apply both
        return {
          before: '',
          after: '',
          applied: [op1, op2],
          rejected: [],
          conflictCount: 0
        };
      }
    }

    // Fall back to parent resolution
    return this.resolve(conflict);
  }
}

/**
 * DMLoG.AI specific conflict resolver
 *
 * Handles game-specific conflicts like:
 * - Token movement (position-based LWW)
 * - Turn order changes
 * - HP/attribute updates
 */
export class DMLoGConflictResolver extends ConflictResolver {
  constructor() {
    super({
      strategy: ResolutionStrategy.LWW,
      fallback: ResolutionStrategy.REPLICA_ORDER,
      notifyUsers: true
    });
  }

  /**
   * Resolve token movement conflict
   *
   * @param tokenId - Token ID
   * @param positions - Map of user ID to position
   * @returns Winning position
   */
  resolveTokenMovement(tokenId: string, positions: Map<string, { x: number; y: number }>): {
    x: number;
    y: number;
    userId: string;
  } {
    // For battle maps, use most recent move
    let winner: { userId: string; position: { x: number; y: number }; timestamp: number } | null = null;

    for (const [userId, position] of positions.entries()) {
      // This would need timestamp from actual data
      // For now, use deterministic ordering
      if (!winner || userId > winner.userId) {
        winner = { userId, position, timestamp: Date.now() };
      }
    }

    return {
      ...winner!.position,
      userId: winner!.userId
    };
  }

  /**
   * Resolve turn order conflict
   *
   * @param currentOrder - Current turn order
   * @param proposedOrders - Proposed turn orders from users
   * @returns Resolved turn order
   */
  resolveTurnOrder(
    currentOrder: string[],
    proposedOrders: Map<string, string[]>
  ): string[] {
    // DM's decision wins (DM typically has lowest user ID)
    const dmId = Array.from(proposedOrders.keys()).sort()[0];
    return proposedOrders.get(dmId) || currentOrder;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a conflict resolver with default options
 */
export function createConflictResolver(
  options?: Partial<ResolutionOptions>
): ConflictResolver {
  return new ConflictResolver(options);
}

/**
 * Create a StudyLoG-specific conflict resolver
 */
export function createStudyLoGResolver(): StudyLoGConflictResolver {
  return new StudyLoGConflictResolver();
}

/**
 * Create a DMLoG-specific conflict resolver
 */
export function createDMLoGResolver(): DMLoGConflictResolver {
  return new DMLoGConflictResolver();
}
