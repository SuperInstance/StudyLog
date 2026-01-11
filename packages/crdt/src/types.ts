/**
 * Core type definitions for CRDT operations
 */

/**
 * Unique identifier for a node/replica in the distributed system
 */
export type NodeId = string;

/**
 * Logical timestamp for ordering operations
 */
export type Timestamp = number;

/**
 * Logical clock value (Lamport clock)
 */
export type ClockValue = number;

/**
 * Unique identifier for an operation
 */
export type OperationId = string;

/**
 * Base interface for all CRDT states
 */
export interface CRDTState {
  /** Version of this state */
  version: ClockValue;
  /** Node that created this state */
  nodeId: NodeId;
  /** When this state was created */
  timestamp: Timestamp;
}

/**
 * Base interface for all CRDT operations
 */
export interface CRDTOperation {
  /** Unique operation identifier */
  id: OperationId;
  /** Node that performed the operation */
  nodeId: NodeId;
  /** Logical clock value */
  clock: ClockValue;
  /** Wall clock timestamp */
  timestamp: Timestamp;
}

/**
 * Result of a merge operation
 */
export interface MergeResult<T> {
  /** Merged state */
  state: T;
  /** Whether the merge changed the state */
  changed: boolean;
  /** Number of operations applied */
  operationsApplied: number;
}

/**
 * Configuration options for CRDT behavior
 */
export interface CRDTConfig {
  /** Maximum size of operation log before compaction */
  maxOperationLogSize?: number;
  /** Enable automatic compaction of operation log */
  autoCompact?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default CRDT configuration
 */
export const DEFAULT_CRDT_CONFIG: Required<CRDTConfig> = {
  maxOperationLogSize: 1000,
  autoCompact: true,
  debug: false,
};

/**
 * Priority for conflict resolution
 */
export enum ConflictPriority {
  /** Last writer wins (highest timestamp) */
  LastWriteWins = 'last-write-wins',
  /** First writer wins (lowest timestamp) */
  FirstWriteWins = 'first-write-wins',
  /** Node with highest ID wins */
  HighestNodeWins = 'highest-node-wins',
  /** Node with lowest ID wins */
  LowestNodeWins = 'lowest-node-wins',
  /** Manual resolution required */
  Manual = 'manual',
}
