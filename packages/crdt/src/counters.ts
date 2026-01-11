/**
 * Counter CRDTs: G-Counter and PN-Counter
 *
 * G-Counter: Grow-only counter (increments only)
 * PN-Counter: Positive-Negative counter (increments and decrements)
 */

import type { NodeId, ClockValue, CRDTState, CRDTOperation } from './types.js';
import { Merge } from './merge.js';

/**
 * State for G-Counter
 */
export interface GCounterState extends CRDTState {
  /** Per-node counts */
  counts: Record<NodeId, number>;
}

/**
 * Operation for G-Counter
 */
export interface GCounterOperation extends CRDTOperation {
  type: 'increment';
  amount: number;
}

/**
 * G-Counter (Grow-only Counter)
 *
 * A counter that can only increment. Supports distributed merging.
 * Merge takes the maximum value for each node.
 *
 * Use cases: Event counting, metrics, analytics
 */
export class GCounter {
  private counts: Map<NodeId, number> = new Map();
  private nodeId: NodeId;
  private clock: ClockValue = 0;

  constructor(nodeId: NodeId, initialState?: GCounterState) {
    this.nodeId = nodeId;

    if (initialState) {
      for (const [node, count] of Object.entries(initialState.counts)) {
        this.counts.set(node, count);
      }
      this.clock = initialState.version;
    }
  }

  /**
   * Increment the counter
   */
  increment(amount: number = 1): void {
    if (amount < 0) {
      throw new Error('G-Counter can only increment (use PN-Counter for decrements)');
    }

    const current = this.counts.get(this.nodeId) || 0;
    this.counts.set(this.nodeId, current + amount);
    this.clock++;
  }

  /**
   * Get the current value (sum of all node counts)
   */
  value(): number {
    let sum = 0;
    for (const count of this.counts.values()) {
      sum += count;
    }
    return sum;
  }

  /**
   * Get the count for a specific node
   */
  get(nodeId: NodeId): number {
    return this.counts.get(nodeId) || 0;
  }

  /**
   * Get all node counts
   */
  counts(): Record<NodeId, number> {
    return Object.fromEntries(this.counts);
  }

  /**
   * Merge with another G-Counter
   * Takes the maximum value for each node
   */
  merge(other: GCounter): void {
    for (const [node, count] of other.counts) {
      const existing = this.counts.get(node) || 0;
      this.counts.set(node, Math.max(existing, count));
    }
    this.clock = Math.max(this.clock, other.clock);
  }

  /**
   * Create a merged copy without modifying self
   */
  merged(other: GCounter): GCounter {
    const merged = new GCounter(this.nodeId, this.getState());
    merged.merge(other);
    return merged;
  }

  /**
   * Export state for transmission
   */
  getState(): GCounterState {
    return {
      version: this.clock,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      counts: Object.fromEntries(this.counts),
    };
  }

  /**
   * Import state from transmission
   */
  setState(state: GCounterState): void {
    this.counts.clear();
    for (const [node, count] of Object.entries(state.counts)) {
      this.counts.set(node, count);
    }
    this.clock = state.version;
  }

  /**
   * Reset all counts (use with caution)
   */
  reset(): void {
    this.counts.clear();
    this.clock = 0;
  }

  /**
   * Get node ID
   */
  getNodeId(): NodeId {
    return this.nodeId;
  }

  /**
   * Get clock value
   */
  getClock(): ClockValue {
    return this.clock;
  }
}

/**
 * State for PN-Counter
 */
export interface PNCounterState extends CRDTState {
  /** Positive counts (increments) */
  pCounts: Record<NodeId, number>;
  /** Negative counts (decrements) */
  nCounts: Record<NodeId, number>;
}

/**
 * Operation for PN-Counter
 */
export interface PNCounterOperation extends CRDTOperation {
  type: 'increment' | 'decrement';
  amount: number;
}

/**
 * PN-Counter (Positive-Negative Counter)
 *
 * A counter that supports both increments and decrements.
 * Internally uses two G-Counters: one for positive, one for negative.
 *
 * Use cases: Scores, balances, inventory, any counter that needs decrement
 */
export class PNCounter {
  private pCounts: Map<NodeId, number> = new Map(); // Positive
  private nCounts: Map<NodeId, number> = new Map(); // Negative
  private nodeId: NodeId;
  private clock: ClockValue = 0;

  constructor(nodeId: NodeId, initialState?: PNCounterState) {
    this.nodeId = nodeId;

    if (initialState) {
      for (const [node, count] of Object.entries(initialState.pCounts)) {
        this.pCounts.set(node, count);
      }
      for (const [node, count] of Object.entries(initialState.nCounts)) {
        this.nCounts.set(node, count);
      }
      this.clock = initialState.version;
    }
  }

  /**
   * Increment the counter
   */
  increment(amount: number = 1): void {
    if (amount < 0) {
      throw new Error('Increment amount must be positive');
    }

    const current = this.pCounts.get(this.nodeId) || 0;
    this.pCounts.set(this.nodeId, current + amount);
    this.clock++;
  }

  /**
   * Decrement the counter
   */
  decrement(amount: number = 1): void {
    if (amount < 0) {
      throw new Error('Decrement amount must be positive');
    }

    const current = this.nCounts.get(this.nodeId) || 0;
    this.nCounts.set(this.nodeId, current + amount);
    this.clock++;
  }

  /**
   * Get the current value (sum of positive - sum of negative)
   */
  value(): number {
    let pSum = 0;
    let nSum = 0;

    for (const count of this.pCounts.values()) {
      pSum += count;
    }
    for (const count of this.nCounts.values()) {
      nSum += count;
    }

    return pSum - nSum;
  }

  /**
   * Get the positive count for a specific node
   */
  getPositive(nodeId: NodeId): number {
    return this.pCounts.get(nodeId) || 0;
  }

  /**
   * Get the negative count for a specific node
   */
  getNegative(nodeId: NodeId): number {
    return this.nCounts.get(nodeId) || 0;
  }

  /**
   * Get all positive counts
   */
  positiveCounts(): Record<NodeId, number> {
    return Object.fromEntries(this.pCounts);
  }

  /**
   * Get all negative counts
   */
  negativeCounts(): Record<NodeId, number> {
    return Object.fromEntries(this.nCounts);
  }

  /**
   * Merge with another PN-Counter
   * Merges positive and negative counters separately
   */
  merge(other: PNCounter): void {
    // Merge positive counts
    for (const [node, count] of other.pCounts) {
      const existing = this.pCounts.get(node) || 0;
      this.pCounts.set(node, Math.max(existing, count));
    }

    // Merge negative counts
    for (const [node, count] of other.nCounts) {
      const existing = this.nCounts.get(node) || 0;
      this.nCounts.set(node, Math.max(existing, count));
    }

    this.clock = Math.max(this.clock, other.clock);
  }

  /**
   * Create a merged copy without modifying self
   */
  merged(other: PNCounter): PNCounter {
    const merged = new PNCounter(this.nodeId, this.getState());
    merged.merge(other);
    return merged;
  }

  /**
   * Export state for transmission
   */
  getState(): PNCounterState {
    return {
      version: this.clock,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      pCounts: Object.fromEntries(this.pCounts),
      nCounts: Object.fromEntries(this.nCounts),
    };
  }

  /**
   * Import state from transmission
   */
  setState(state: PNCounterState): void {
    this.pCounts.clear();
    this.nCounts.clear();

    for (const [node, count] of Object.entries(state.pCounts)) {
      this.pCounts.set(node, count);
    }
    for (const [node, count] of Object.entries(state.nCounts)) {
      this.nCounts.set(node, count);
    }

    this.clock = state.version;
  }

  /**
   * Reset all counts (use with caution)
   */
  reset(): void {
    this.pCounts.clear();
    this.nCounts.clear();
    this.clock = 0;
  }

  /**
   * Get node ID
   */
  getNodeId(): NodeId {
    return this.nodeId;
  }

  /**
   * Get clock value
   */
  getClock(): ClockValue {
    return this.clock;
  }
}
