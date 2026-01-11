/**
 * Vector Clock / Lamport Clock implementation for CRDTs
 *
 * Provides causal ordering for distributed operations.
 */

import type { NodeId, ClockValue } from './types.js';

/**
 * Lamport Clock - single logical clock for ordering events
 */
export class VectorClock {
  private clock: ClockValue = 0;
  private nodeId: NodeId;

  constructor(nodeId: NodeId, initialClock: ClockValue = 0) {
    this.nodeId = nodeId;
    this.clock = initialClock;
  }

  /**
   * Get current clock value
   */
  get(): ClockValue {
    return this.clock;
  }

  /**
   * Increment clock (local event)
   */
  tick(): ClockValue {
    return ++this.clock;
  }

  /**
   * Merge with another clock value (receive event)
   * Returns max of both clocks + 1
   */
  merge(otherClock: ClockValue): ClockValue {
    this.clock = Math.max(this.clock, otherClock) + 1;
    return this.clock;
  }

  /**
   * Compare this clock with another
   * Returns: -1 if this < other, 0 if equal, 1 if this > other
   */
  compare(other: ClockValue): number {
    if (this.clock < other) return -1;
    if (this.clock > other) return 1;
    return 0;
  }

  /**
   * Check if this clock is less than another
   */
  lessThan(other: ClockValue): boolean {
    return this.clock < other;
  }

  /**
   * Check if this clock equals another
   */
  equals(other: ClockValue): boolean {
    return this.clock === other;
  }

  /**
   * Reset clock (use with caution)
   */
  reset(): void {
    this.clock = 0;
  }

  /**
   * Clone this clock
   */
  clone(): VectorClock {
    return new VectorClock(this.nodeId, this.clock);
  }

  /**
   * Get node ID
   */
  getNodeId(): NodeId {
    return this.nodeId;
  }

  /**
   * Convert to JSON
   */
  toJSON(): { nodeId: NodeId; clock: ClockValue } {
    return { nodeId: this.nodeId, clock: this.clock };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data: { nodeId: NodeId; clock: ClockValue }): VectorClock {
    return new VectorClock(data.nodeId, data.clock);
  }
}

/**
 * Vector Clock with per-node tracking
 * Used for more sophisticated causal ordering
 */
export class MultiVectorClock {
  private clocks: Map<NodeId, ClockValue> = new Map();
  private nodeId: NodeId;

  constructor(nodeId: NodeId, initialClocks?: Record<NodeId, ClockValue>) {
    this.nodeId = nodeId;
    if (initialClocks) {
      for (const [node, clock] of Object.entries(initialClocks)) {
        this.clocks.set(node, clock);
      }
    }
  }

  /**
   * Get clock value for a node
   */
  get(nodeId: NodeId): ClockValue {
    return this.clocks.get(nodeId) || 0;
  }

  /**
   * Get this node's clock value
   */
  getCurrent(): ClockValue {
    return this.get(this.nodeId);
  }

  /**
   * Increment this node's clock
   */
  tick(): ClockValue {
    const current = this.getCurrent();
    this.clocks.set(this.nodeId, current + 1);
    return current + 1;
  }

  /**
   * Merge with another vector clock
   */
  merge(other: MultiVectorClock): void {
    for (const [node, clock] of other.clocks) {
      const current = this.clocks.get(node) || 0;
      this.clocks.set(node, Math.max(current, clock));
    }
  }

  /**
   * Compare two vector clocks
   * Returns: -1 if this < other, 0 if concurrent, 1 if this > other
   */
  compare(other: MultiVectorClock): -1 | 0 | 1 {
    let lessThan = false;
    let greaterThan = false;

    const allNodes = new Set([...this.clocks.keys(), ...other.clocks.keys()]);

    for (const node of allNodes) {
      const a = this.get(node);
      const b = other.get(node);

      if (a < b) lessThan = true;
      if (a > b) greaterThan = true;
    }

    if (lessThan && !greaterThan) return -1;
    if (greaterThan && !lessThan) return 1;
    return 0; // Concurrent or equal
  }

  /**
   * Check if this clock is less than another
   */
  lessThan(other: MultiVectorClock): boolean {
    return this.compare(other) === -1;
  }

  /**
   * Check if this clock is concurrent with another
   */
  concurrent(other: MultiVectorClock): boolean {
    return this.compare(other) === 0;
  }

  /**
   * Clone this vector clock
   */
  clone(): MultiVectorClock {
    const clocks: Record<NodeId, ClockValue> = {};
    for (const [node, clock] of this.clocks) {
      clocks[node] = clock;
    }
    return new MultiVectorClock(this.nodeId, clocks);
  }

  /**
   * Convert to JSON
   */
  toJSON(): Record<NodeId, ClockValue> {
    return Object.fromEntries(this.clocks);
  }

  /**
   * Create from JSON
   */
  static fromJSON(nodeId: NodeId, data: Record<NodeId, ClockValue>): MultiVectorClock {
    return new MultiVectorClock(nodeId, data);
  }
}
