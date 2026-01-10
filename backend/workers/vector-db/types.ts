/**
 * Vector Database Integration Types
 *
 * Complete type definitions for vector embeddings, similarity search,
 * RAG pipelines, and cache management.
 */

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Embedding model
 */
export type EmbeddingModel =
  | 'text-embedding-ada-002'
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'jina-embeddings-v2'
  | 'bge-small-en'
  | 'bge-base-en'
  | 'e5-large-v2'
  | 'cohere-embed-v3';

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  /**
   * Input text(s) to embed
   */
  input: string | string[];

  /**
   * Model to use
   */
  model?: EmbeddingModel;

  /**
   * Embedding dimensions
   */
  dimensions?: number;

  /**
   * Tenant ID (for isolation)
   */
  tenantId?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /**
   * Generated embeddings
   */
  embeddings: number[][];

  /**
   * Model used
   */
  model: EmbeddingModel;

  /**
   * Embedding dimensions
   */
  dimensions: number;

  /**
   * Tokens processed
   */
  tokens: number;

  /**
   * Cost in USD
   */
  cost: number;
}

// ============================================================================
// Vector Search Types
// ============================================================================

/**
 * Similarity metric
 */
export type SimilarityMetric = 'cosine' | 'euclidean' | 'dotproduct';

/**
 * Vector search request
 */
export interface VectorSearchRequest {
  /**
   * Query vector or text to embed
   */
  query: number[] | string;

  /**
   * Namespace/index to search
   */
  namespace: string;

  /**
   * Number of results to return
   */
  topK?: number;

  /**
   * Filter by metadata
   */
  filter?: Record<string, unknown>;

  /**
   * Minimum similarity score
   */
  minScore?: number;

  /**
   * Similarity metric
   */
  metric?: SimilarityMetric;

  /**
   * Tenant ID
   */
  tenantId?: string;

  /**
   * Include vector in results
   */
  includeVectors?: boolean;

  /**
   * Include metadata in results
   */
  includeMetadata?: boolean;
}

/**
 * Vector search result
 */
export interface VectorSearchResult {
  /**
   * Document ID
   */
  id: string;

  /**
   * Similarity score
   */
  score: number;

  /**
   * Document vector (if requested)
   */
  vector?: number[];

  /**
   * Document metadata
   */
  metadata?: VectorMetadata;

  /**
   * Document content (if stored)
   */
  content?: string;
}

/**
 * Vector document metadata
 */
export interface VectorMetadata {
  /**
   * Document title
   */
  title?: string;

  /**
   * Document type
   */
  type?: string;

  /**
   * Source URL or reference
   */
  source?: string;

  /**
   * Created at timestamp
   */
  createdAt?: string;

  /**
   * Updated at timestamp
   */
  updatedAt?: string;

  /**
   * Author/owner
   */
  author?: string;

  /**
   * Tags
   */
  tags?: string[];

  /**
   * Additional custom fields
   */
  [key: string]: unknown;
}

/**
 * Vector document
 */
export interface VectorDocument {
  /**
   * Unique document ID
   */
  id: string;

  /**
   * Document vector
   */
  vector: number[];

  /**
   * Document metadata
   */
  metadata: VectorMetadata;

  /**
   * Namespace/index
   */
  namespace: string;

  /**
   * Tenant ID
   */
  tenantId?: string;

  /**
   * Created at
   */
  createdAt: string;

  /**
   * Updated at
   */
  updatedAt: string;
}

// ============================================================================
// RAG Pipeline Types
// ============================================================================

/**
 * RAG query request
 */
export interface RAGQueryRequest {
  /**
   * User query
   */
  query: string;

  /**
   * Knowledge base namespace
   */
  namespace: string;

  /**
   * Number of documents to retrieve
   */
  topK?: number;

  /**
   * Minimum relevance score
   */
  minScore?: number;

  /**
   * Rerank retrieved documents
   */
  rerank?: boolean;

  /**
   * System prompt for LLM
   */
  systemPrompt?: string;

  /**
   * Chat history for context
   */
  chatHistory?: ChatMessage[];

  /**
   * Maximum response tokens
   */
  maxTokens?: number;

  /**
   * Temperature
   */
  temperature?: number;

  /**
   * Stream response
   */
  stream?: boolean;

  /**
   * Tenant ID
   */
  tenantId?: string;
}

/**
 * Chat message for RAG context
 */
export interface ChatMessage {
  /**
   * Message role
   */
  role: 'system' | 'user' | 'assistant';

  /**
   * Message content
   */
  content: string;

  /**
   * Citations (if any)
   */
  citations?: string[];
}

/**
 * RAG query response
 */
export interface RAGQueryResponse {
  /**
   * Generated answer
   */
  answer: string;

  /**
   * Retrieved documents used
   */
  sources: VectorSearchResult[];

  /**
   * Citations (document IDs)
   */
  citations: string[];

  /**
   * Tokens used
   */
  tokens: {
    input: number;
    output: number;
    total: number;
  };

  /**
   * Cost in USD
   */
  cost: number;

  /**
   * Model used
   */
  model: string;

  /**
   * Generation time in milliseconds
   */
  generationTimeMs: number;
}

/**
 * Document chunk for RAG
 */
export interface DocumentChunk {
  /**
   * Chunk ID
   */
  id: string;

  /**
   * Parent document ID
   */
  documentId: string;

  /**
   * Chunk text content
   */
  content: string;

  /**
   * Chunk index
   */
  chunkIndex: number;

  /**
   * Total chunks in document
   */
  totalChunks: number;

  /**
   * Chunk vector embedding
   */
  vector?: number[];

  /**
   * Chunk metadata
   */
  metadata?: VectorMetadata;

  /**
   * Created at
   */
  createdAt: string;
}

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Cache entry for embeddings
 */
export interface EmbeddingCacheEntry {
  /**
   * Cache key (hash of input)
   */
  key: string;

  /**
   * Input text
   */
  input: string;

  /**
   * Generated embedding
   */
  embedding: number[];

  /**
   * Model used
   */
  model: EmbeddingModel;

  /**
   * Cached at timestamp
   */
  cachedAt: string;

  /**
   * TTL in seconds
   */
  ttl?: number;

  /**
   * Hit count
   */
  hits: number;

  /**
   * Last accessed timestamp
   */
  lastAccessedAt: string;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /**
   * Total entries in cache
   */
  totalEntries: number;

  /**
   * Cache size in bytes
   */
  sizeBytes: number;

  /**
   * Total hits
   */
  hits: number;

  /**
   * Total misses
   */
  misses: number;

  /**
   * Hit rate
   */
  hitRate: number;

  /**
   * Evictions
   */
  evictions: number;
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

/**
 * Knowledge base configuration
 */
export interface KnowledgeBaseConfig {
  /**
   * Namespace/index name
   */
  namespace: string;

  /**
   * Embedding model
   */
  embeddingModel: EmbeddingModel;

  /**
   * Chunk size (characters)
   */
  chunkSize?: number;

  /**
   * Chunk overlap
   */
  chunkOverlap?: number;

  /**
   * Strategy for chunking
   */
  chunkStrategy?: 'fixed' | 'semantic' | 'recursive';

  /**
   * Similarity metric
   */
  metric?: SimilarityMetric;

  /**
   * Description
   */
  description?: string;

  /**
   * Is public
   */
  isPublic?: boolean;
}

/**
 * Document ingestion status
 */
export type IngestionStatus =
  | 'pending'
  | 'processing'
  | 'embedding'
  | 'indexing'
  | 'completed'
  | 'failed';

/**
 * Document ingestion job
 */
export interface IngestionJob {
  /**
   * Job ID
   */
  id: string;

  /**
   * Namespace
   */
  namespace: string;

  /**
   * Source URL or content
   */
  source: string;

  /**
   * Source type
   */
  sourceType: 'url' | 'text' | 'file' | 'database';

  /**
   * Job status
   */
  status: IngestionStatus;

  /**
   * Documents processed
   */
  documentsProcessed: number;

  /**
   * Total documents
   */
  totalDocuments: number;

  /**
   * Chunks created
   */
  chunksCreated: number;

  /**
   * Error message (if failed)
   */
  error?: string;

  /**
   * Started at
   */
  startedAt: string;

  /**
   * Completed at
   */
  completedAt?: string;

  /**
   * Progress (0-100)
   */
  progress: number;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for vector database
 */
export interface Env {
  // Vectorize index
  VECTORIZE_INDEX?: VectorizeIndex;

  // Cloudflare AI for embeddings
  AI?: Ai;

  // D1 for document storage and cache
  DB: D1Database;

  // KV for cache
  CACHE: KVNamespace;

  // R2 for document storage
  STORAGE?: R2Bucket;

  // API keys for external embedding providers
  OPENAI_API_KEY?: string;
  COHERE_API_KEY?: string;
  JINA_API_KEY?: string;
}
