/**
 * @studylog/crdt
 *
 * Conflict-free Replicated Data Types for StudyLoG.AI
 *
 * Provides CRDT implementations for real-time collaboration:
 * - G-Counter: Grow-only counter
 * - PN-Counter: Positive-negative counter
 * - OR-Set: Observed-remove set
 * - LWW-Register: Last-writer-wins register
 * - Document: Text document CRDT for collaborative editing
 *
 * @packageDocumentation
 */

// Core types
export type * from './types.js';

// Counters
export { GCounter } from './counters.js';
export type { GCounterState } from './counters.js';

export { PNCounter } from './counters.js';
export type { PNCounterState } from './counters.js';

// Sets
export { ORSet } from './sets.js';
export type { ORSetState, ORSetElement } from './sets.js';

// Registers
export { LWWRegister } from './register.js';
export type { RegisterState } from './register.js';

// Document CRDT
export { Document, DocumentStore } from './document.js';
export type {
  DocumentOperation,
  DocumentSnapshot,
  DocumentState,
  ConflictResolution
} from './document.js';

// Utilities
export { VectorClock } from './clock.js';
export { Merge } from './merge.js';
export type { Mergeable } from './merge.js';
