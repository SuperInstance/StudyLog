/**
 * Register CRDT: LWW-Register (Last-Writer-Wins Register)
 *
 * A register that stores a single value and uses Last-Writer-Wins for conflict resolution.
 */

import type { NodeId, ClockValue, CRDTState, CRDTOperation, Timestamp } from './types.js';
import { Merge } from './merge.js';

/**
 * State for LWW-Register
 */
export interface RegisterState<T = unknown> extends CRDTState {
  /** Current value */
  value: T;
  /** When the value was set */
  valueTimestamp: Timestamp;
}

/**
 * Operation for LWW-Register
 */
export interface RegisterOperation<T = unknown> extends CRDTOperation {
  type: 'set';
  value: T;
}

/**
 * Value with timestamp for LWW comparison
 */
export interface TimestampedValue<T> {
  value: T;
  timestamp: Timestamp;
  nodeId: NodeId;
  clock: ClockValue;
}

/**
 * LWW-Register (Last-Writer-Wins Register)
 *
 * A register that stores a single value with Last-Writer-Wins conflict resolution.
 * When merging, the value with the highest timestamp (and nodeId as tiebreaker) wins.
 *
 * Use cases: Single-value state, configuration, session state, settings
 *
 * @template T The type of value stored
 */
export class LWWRegister<T = unknown> {
  private value: T;
  private timestamp: Timestamp = 0;
  private nodeId: NodeId;
  private clock: ClockValue = 0;

  constructor(nodeId: NodeId, initialValue: T, initialState?: RegisterState<T>) {
    this.nodeId = nodeId;

    if (initialState) {
      this.value = initialState.value;
      this.timestamp = initialState.valueTimestamp;
      this.clock = initialState.version;
    } else {
      this.value = initialValue;
      this.timestamp = Date.now();
    }
  }

  /**
   * Set a new value
   */
  set(value: T): void {
    this.value = value;
    this.timestamp = Date.now();
    this.clock++;
  }

  /**
   * Get the current value
   */
  get(): T {
    return this.value;
  }

  /**
   * Get the value with its metadata
   */
  getTimestamped(): TimestampedValue<T> {
    return {
      value: this.value,
      timestamp: this.timestamp,
      nodeId: this.nodeId,
      clock: this.clock,
    };
  }

  /**
   * Get the timestamp
   */
  getTimestamp(): Timestamp {
    return this.timestamp;
  }

  /**
   * Merge with another LWW-Register
   * Takes the value with the highest timestamp (and nodeId as tiebreaker)
   */
  merge(other: LWWRegister<T>): void {
    const comparison = Merge.compareTimestamps(
      { timestamp: this.timestamp, nodeId: this.nodeId },
      { timestamp: other.timestamp, nodeId: other.nodeId }
    );

    if (comparison < 0) {
      // Other is newer
      this.value = other.value;
      this.timestamp = other.timestamp;
    }

    this.clock = Math.max(this.clock, other.clock);
  }

  /**
   * Create a merged copy without modifying self
   */
  merged(other: LWWRegister<T>): LWWRegister<T> {
    const merged = new LWWRegister(this.nodeId, this.value, this.getState());
    merged.merge(other);
    return merged;
  }

  /**
   * Export state for transmission
   */
  getState(): RegisterState<T> {
    return {
      version: this.clock,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      value: this.value,
      valueTimestamp: this.timestamp,
    };
  }

  /**
   * Import state from transmission
   */
  setState(state: RegisterState<T>): void {
    this.value = state.value;
    this.timestamp = state.valueTimestamp;
    this.clock = state.version;
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

  /**
   * Create an LWW-Register with a value
   */
  static create<T>(nodeId: NodeId, value: T): LWWRegister<T> {
    return new LWWRegister(nodeId, value);
  }
}

/**
 * MV-Register (Multi-Value Register)
 *
 * A register that can store multiple values concurrently.
 * Resolves conflicts by keeping all values and allowing application-level resolution.
 *
 * Use cases: Shopping carts, collaborative lists, conflict tracking
 */
export class MVRegister<T = unknown> {
  /** All current values with their timestamps */
  private values: Map<T, TimestampedValue<T>> = new Map();

  private nodeId: NodeId;
  private clock: ClockValue = 0;

  constructor(nodeId: NodeId, initialValues?: T[]) {
    this.nodeId = nodeId;

    if (initialValues) {
      for (const value of initialValues) {
        this.set(value);
      }
    }
  }

  /**
   * Set a new value
   */
  set(value: T): void {
    this.values.set(value, {
      value,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      clock: this.clock++,
    });
  }

  /**
   * Get all current values
   */
  getAll(): T[] {
    return Array.from(this.values.keys());
  }

  /**
   * Get all values with metadata
   */
  getAllTimestamped(): TimestampedValue<T>[] {
    return Array.from(this.values.values());
  }

  /**
   * Get a single value (uses LWW to resolve conflicts)
   */
  get(): T | undefined {
    if (this.values.size === 0) {
      return undefined;
    }

    let latest: TimestampedValue<T> | undefined;

    for (const tv of this.values.values()) {
      if (!latest || Merge.compareTimestamps(tv, latest) > 0) {
        latest = tv;
      }
    }

    return latest?.value;
  }

  /**
   * Check if has a value
   */
  has(value: T): boolean {
    return this.values.has(value);
  }

  /**
   * Get the number of values
   */
  size(): number {
    return this.values.size;
  }

  /**
   * Merge with another MV-Register
   */
  merge(other: MVRegister<T>): void {
    for (const [value, tv] of other.values) {
      const existing = this.values.get(value);

      if (!existing) {
        // New value, add it
        this.values.set(value, tv);
      } else {
        // Value exists, keep the newer version
        if (Merge.compareTimestamps(tv, existing) > 0) {
          this.values.set(value, tv);
        }
      }
    }

    this.clock = Math.max(this.clock, other.clock);
  }

  /**
   * Resolve conflicts by picking the latest value (LWW)
   * Returns a new LWW-Register with the resolved value
   */
  resolve(): LWWRegister<T> {
    const values = this.getAllTimestamped();
    if (values.length === 0) {
      return new LWWRegister(this.nodeId, undefined as T);
    }

    const latest = values.reduce((a, b) =>
      Merge.compareTimestamps(a, b) >= 0 ? a : b
    );

    return new LWWRegister(this.nodeId, latest.value, {
      version: this.clock,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      value: latest.value,
      valueTimestamp: latest.timestamp,
    });
  }

  /**
   * Clear all values
   */
  clear(): void {
    this.values.clear();
    this.clock++;
  }

  /**
   * Export state for transmission
   */
  getState(): {
    values: Array<{ value: T; timestamp: Timestamp; nodeId: NodeId }>;
    version: ClockValue;
  } {
    return {
      values: this.getAllTimestamped().map(({ value, timestamp, nodeId }) => ({
        value,
        timestamp,
        nodeId,
      })),
      version: this.clock,
    };
  }

  /**
   * Import state from transmission
   */
  setState(state: {
    values: Array<{ value: T; timestamp: Timestamp; nodeId: NodeId }>;
    version: ClockValue;
  }): void {
    this.values.clear();

    for (const { value, timestamp, nodeId } of state.values) {
      this.values.set(value, { value, timestamp, nodeId, clock: 0 });
    }

    this.clock = state.version;
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
