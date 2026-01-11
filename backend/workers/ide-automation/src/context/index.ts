/**
 * Context Module - Context Builder
 *
 * Exports all context building functionality:
 * - ContextBuilder: File reading, semantic search, RAG integration
 * - Symbol extraction and dependency mapping
 */

export * from './builder.js';

// Re-export commonly used types
export type {
  ContextFile,
  ReadStrategy,
  SymbolInfo,
  DependencyMap,
  SemanticResult,
  ContextBuildResult,
  RAGConfig,
} from '../types/index.js';
