/**
 * Set CRDTs: OR-Set (Observed-Remove Set)
 *
 * OR-Set supports add and remove operations with proper conflict resolution.
 * Uses unique tags for each element addition to handle concurrent adds/removes.
 */

import type { NodeId, ClockValue, CRDTState, CRDTOperation } from './types.js';
import { Merge } from './merge.js';

/**
 * Unique tag for an element in the set
 */
export type ORSetTag = string;

/**
 * Element in OR-Set with its tags
 */
export interface ORSetElement<T = string> {
  /** The element value */
  value: T;
  /** Unique tags for this element */
  tags: Set<ORSetTag>;
}

/**
 * State for OR-Set
 */
export interface ORSetState<T = string> extends CRDTState {
  /** Elements and their tags */
  elements: Array<{ value: T; tags: ORSetTag[] }>;
  /** Tombstones (removed tags) */
  tombstones: ORSetTag[];
}

/**
 * Operation for OR-Set
 */
export interface ORSetOperation<T = string> extends CRDTOperation {
  type: 'add' | 'remove';
  value: T;
  tag?: ORSetTag;
}

/**
 * OR-Set (Observed-Remove Set)
 *
 * A set that supports add and remove operations with proper conflict resolution.
 * Each element addition is tagged with a unique identifier.
 * Removal marks tags as tombstones but doesn't immediately remove them.
 * Merge takes the union of tags and removes elements with only tombstone tags.
 *
 * Use cases: User lists, document collections, asset management, any collection with adds/removes
 *
 * @template T The type of elements in the set
 */
export class ORSet<T = string> {
  /** Elements and their unique tags */
  private elements: Map<T, Set<ORSetTag>> = new Map();

  /** Tombstones (removed element tags) */
  private tombstones: Set<ORSetTag> = new Set();

  private nodeId: NodeId;
  private clock: ClockValue = 0;
  private tagCounter = 0;

  constructor(nodeId: NodeId, initialState?: ORSetState<T>) {
    this.nodeId = nodeId;

    if (initialState) {
      for (const { value, tags } of initialState.elements) {
        this.elements.set(value, new Set(tags));
      }
      this.tombstones = new Set(initialState.tombstones);
      this.clock = initialState.version;
    }
  }

  /**
   * Generate a unique tag for an element
   */
  private generateTag(): ORSetTag {
    return `${this.nodeId}:${this.clock}:${++this.tagCounter}`;
  }

  /**
   * Add an element to the set
   */
  add(value: T): void {
    const tag = this.generateTag();
    const tags = this.elements.get(value);

    if (tags) {
      tags.add(tag);
    } else {
      this.elements.set(value, new Set([tag]));
    }

    this.clock++;
  }

  /**
   * Remove an element from the set
   * Marks all current tags as tombstones
   */
  remove(value: T): void {
    const tags = this.elements.get(value);

    if (tags) {
      // Mark all tags as tombstones
      for (const tag of tags) {
        this.tombstones.add(tag);
      }

      // Remove from elements
      this.elements.delete(value);
    }

    this.clock++;
  }

  /**
   * Check if an element is in the set
   */
  has(value: T): boolean {
    return this.elements.has(value);
  }

  /**
   * Get all elements in the set
   */
  values(): T[] {
    return Array.from(this.elements.keys());
  }

  /**
   * Get the number of elements
   */
  size(): number {
    return this.elements.size;
  }

  /**
   * Check if the set is empty
   */
  isEmpty(): boolean {
    return this.elements.size === 0;
  }

  /**
   * Get tags for an element
   */
  getTags(value: T): ORSetTag[] {
    const tags = this.elements.get(value);
    return tags ? Array.from(tags) : [];
  }

  /**
   * Merge with another OR-Set
   * Takes the union of tags and removes elements with only tombstone tags
   */
  merge(other: ORSet<T>): void {
    // Merge elements (union of tags)
    for (const [value, tags] of other.elements) {
      const existing = this.elements.get(value);

      if (existing) {
        // Union of tags
        for (const tag of tags) {
          existing.add(tag);
        }
      } else {
        // Clone the tags
        this.elements.set(value, new Set(tags));
      }
    }

    // Merge tombstones
    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
    }

    // Remove elements with only tombstone tags
    for (const [value, tags] of this.elements) {
      // Check if all tags are tombstones
      const hasLiveTag = Array.from(tags).some((tag) => !this.tombstones.has(tag));

      if (!hasLiveTag) {
        this.elements.delete(value);
      }
    }

    this.clock = Math.max(this.clock, other.clock);
  }

  /**
   * Create a merged copy without modifying self
   */
  merged(other: ORSet<T>): ORSet<T> {
    const merged = new ORSet(this.nodeId, this.getState());
    merged.merge(other);
    return merged;
  }

  /**
   * Clear all elements
   */
  clear(): void {
    this.elements.clear();
    this.tombstones.clear();
    this.clock++;
  }

  /**
   * Export state for transmission
   */
  getState(): ORSetState<T> {
    const elements: Array<{ value: T; tags: ORSetTag[] }> = [];

    for (const [value, tags] of this.elements) {
      elements.push({
        value,
        tags: Array.from(tags),
      });
    }

    return {
      version: this.clock,
      nodeId: this.nodeId,
      timestamp: Date.now(),
      elements,
      tombstones: Array.from(this.tombstones),
    };
  }

  /**
   * Import state from transmission
   */
  setState(state: ORSetState<T>): void {
    this.elements.clear();

    for (const { value, tags } of state.elements) {
      this.elements.set(value, new Set(tags));
    }

    this.tombstones = new Set(state.tombstones);
    this.clock = state.version;
  }

  /**
   * Iterate over elements
   */
  [Symbol.iterator](): Iterator<T> {
    return this.elements.keys()[Symbol.iterator]();
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
   * Create an OR-Set from an array of values
   */
  static fromArray<T>(nodeId: NodeId, values: T[]): ORSet<T> {
    const set = new ORSet<T>(nodeId);
    for (const value of values) {
      set.add(value);
    }
    return set;
  }

  /**
   * Create an OR-Set from a JavaScript Set
   */
  static fromSet<T>(nodeId: NodeId, set: Set<T>): ORSet<T> {
    return ORSet.fromArray(nodeId, Array.from(set));
  }
}

/**
 * 2P-Set (Two-Phase Set)
 *
 * A simpler set CRDT with add and remove operations.
 * Once an element is removed, it can never be added again.
 *
 * Use cases: Event logs, audit trails, append-only collections
 */
export class TwoPSet<T = string> {
  /** Added elements */
  private added: Set<T> = new Set();

  /** Removed elements */
  private removed: Set<T> = new Set();

  private nodeId: NodeId;
  private clock: ClockValue = 0;

  constructor(nodeId: NodeId) {
    this.nodeId = nodeId;
  }

  /**
   * Add an element (only if not previously removed)
   */
  add(value: T): boolean {
    if (this.removed.has(value)) {
      return false; // Can't add removed element
    }

    this.added.add(value);
    this.clock++;
    return true;
  }

  /**
   * Remove an element
   */
  remove(value: T): void {
    this.removed.add(value);
    this.clock++;
  }

  /**
   * Check if an element is in the set
   */
  has(value: T): boolean {
    return this.added.has(value) && !this.removed.has(value);
  }

  /**
   * Get all elements in the set
   */
  values(): T[] {
    return Array.from(this.added).filter((v) => !this.removed.has(v));
  }

  /**
   * Get the number of elements
   */
  size(): number {
    return this.values().length;
  }

  /**
   * Merge with another 2P-Set
   */
  merge(other: TwoPSet<T>): void {
    // Union of added elements
    for (const value of other.added) {
      this.added.add(value);
    }

    // Union of removed elements
    for (const value of other.removed) {
      this.removed.add(value);
    }

    this.clock = Math.max(this.clock, other.clock);
  }

  /**
   * Export state for transmission
   */
  getState(): { added: T[]; removed: T[]; version: ClockValue } {
    return {
      added: Array.from(this.added),
      removed: Array.from(this.removed),
      version: this.clock,
    };
  }

  /**
   * Import state from transmission
   */
  setState(state: { added: T[]; removed: T[]; version: ClockValue }): void {
    this.added = new Set(state.added);
    this.removed = new Set(state.removed);
    this.clock = state.version;
  }
}
