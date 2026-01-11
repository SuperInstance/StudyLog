/**
 * Actions Module - Code Action System
 *
 * Exports all code action functionality:
 * - CodeActionsService: File editing, refactoring, symbol search
 * - DiffGenerator: Unified diff generation and application
 */

export * from './code-actions.js';
export * from './diff-generator.js';

// Re-export commonly used types
export type {
  FileEdit,
  FileDiff,
  CodeSymbol,
  SymbolKind,
  ReferenceLocation,
  CodeExplanation,
  MultiFileOperation,
  Position,
  Range,
} from '../types/index.js';
