/**
 * Merge trait for CRDT operations
 *
 * All CRDTs must support merge with the following guarantees:
 * - Commutative: a.merge(b) == b.merge(a)
 * - Associative: a.merge(b).merge(c) == a.merge(b.merge(c))
 * - Idempotent: a.merge(a) == a
 */

import type { MergeResult } from './types.js';

/**
 * Interface for mergeable CRDTs
 */
export interface Mergeable<T> {
  /**
   * Merge another CRDT state into this one
   * The merge operation must be commutative, associative, and idempotent
   */
  merge(other: T): void;

  /**
   * Create a merged copy without modifying self
   */
  merged(other: T): T;
}

/**
 * Base Merge trait implementation
 *
 * Provides utility methods for CRDT merge operations
 */
export class Merge {
  /**
   * Merge two maps by taking the maximum value for each key
   * Used for G-Counter style merges
   */
  static mergeMaps<K, V extends number | bigint>(
    a: Map<K, V>,
    b: Map<K, V>
  ): Map<K, V> {
    const result = new Map(a);

    for (const [key, value] of b) {
      const existing = result.get(key);
      if (existing === undefined || value > existing) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Merge two maps by combining positive and negative counters
   * Used for PN-Counter style merges
   */
  static mergePNMaps<K>(
    aPos: Map<K, number>,
    aNeg: Map<K, number>,
    bPos: Map<K, number>,
    bNeg: Map<K, number>
  ): { pos: Map<K, number>; neg: Map<K, number> } {
    return {
      pos: Merge.mergeMaps(aPos, bPos),
      neg: Merge.mergeMaps(aNeg, bNeg),
    };
  }

  /**
   * Merge two sets by taking the union
   */
  static mergeSets<T>(a: Set<T>, b: Set<T>): Set<T> {
    return new Set([...a, ...b]);
  }

  /**
   * Merge two sets with tombstones (OR-Set style)
   */
  static mergeORSets<T>(
    aElements: Map<T, Set<string>>,
    aTombstones: Set<string>,
    bElements: Map<T, Set<string>>,
    bTombstones: Set<string>
  ): { elements: Map<T, Set<string>>; tombstones: Set<string> } {
    const elements = new Map(aElements);

    // Merge elements (union of tags)
    for (const [elem, tags] of bElements) {
      const existing = elements.get(elem);
      if (existing) {
        elements.set(elem, new Set([...existing, ...tags]));
      } else {
        elements.set(elem, new Set(tags));
      }
    }

    // Merge tombstones
    const tombstones = new Set([...aTombstones, ...bTombstones]);

    return { elements, tombstones };
  }

  /**
   * Compare two timestamps for Last-Writer-Wins
   * Returns: -1 if a < b, 0 if equal, 1 if a > b
   */
  static compareTimestamps(
    a: { timestamp: number; nodeId: string },
    b: { timestamp: number; nodeId: string }
  ): -1 | 0 | 1 {
    if (a.timestamp < b.timestamp) return -1;
    if (a.timestamp > b.timestamp) return 1;

    // Same timestamp, compare node IDs for deterministic ordering
    if (a.nodeId < b.nodeId) return -1;
    if (a.nodeId > b.nodeId) return 1;

    return 0;
  }

  /**
   * Take the maximum value (for LWW)
   */
  static max<T extends { timestamp: number; nodeId: string }>(a: T, b: T): T {
    return Merge.compareTimestamps(a, b) >= 0 ? a : b;
  }

  /**
   * Take the minimum value (for FWW)
   */
  static min<T extends { timestamp: number; nodeId: string }>(a: T, b: T): T {
    return Merge.compareTimestamps(a, b) <= 0 ? a : b;
  }

  /**
   * Create a merge result
   */
  static result<T>(state: T, changed: boolean, operationsApplied: number = 0): MergeResult<T> {
    return { state, changed, operationsApplied };
  }
}

/**
 * Helper class to track merge statistics
 */
export class MergeStats {
  private mergeCount = 0;
  private conflictCount = 0;
  private operationsApplied = 0;

  recordMerge(): void {
    this.mergeCount++;
  }

  recordConflict(): void {
    this.conflictCount++;
  }

  recordOperations(count: number): void {
    this.operationsApplied += count;
  }

  getStats(): { mergeCount: number; conflictCount: number; operationsApplied: number } {
    return {
      mergeCount: this.mergeCount,
      conflictCount: this.conflictCount,
      operationsApplied: this.operationsApplied,
    };
  }

  reset(): void {
    this.mergeCount = 0;
    this.conflictCount = 0;
    this.operationsApplied = 0;
  }
}
