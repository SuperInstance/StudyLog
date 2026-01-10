-- Vector Database Integration Schema
-- D1 schema for embeddings cache, documents, and knowledge bases

-- ============================================================================
-- Knowledge Bases Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  namespace TEXT UNIQUE NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-ada-002',
  chunk_size INTEGER NOT NULL DEFAULT 1000,
  chunk_overlap INTEGER NOT NULL DEFAULT 200,
  chunk_strategy TEXT NOT NULL DEFAULT 'fixed', -- fixed, semantic, recursive
  metric TEXT NOT NULL DEFAULT 'cosine', -- cosine, euclidean, dotproduct
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_kb_namespace (namespace),
  INDEX idx_kb_tenant (tenant_id)
);

-- ============================================================================
-- Document Chunks Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  namespace TEXT NOT NULL,
  tenant_id TEXT,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_chunks_document (document_id),
  INDEX idx_chunks_namespace (namespace),
  INDEX idx_chunks_tenant (tenant_id)
);

-- ============================================================================
-- Embedding Cache Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS embedding_cache (
  key TEXT PRIMARY KEY,
  input TEXT NOT NULL,
  model TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  ttl INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_cache_model (model),
  INDEX idx_cache_accessed (last_accessed_at)
);

-- ============================================================================
-- Ingestion Jobs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL, -- url, text, file, database
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, embedding, indexing, completed, failed
  documents_processed INTEGER NOT NULL DEFAULT 0,
  total_documents INTEGER NOT NULL DEFAULT 0,
  chunks_created INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100

  INDEX idx_ingestion_namespace (namespace),
  INDEX idx_ingestion_status (status)
);

-- ============================================================================
-- RAG Query History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_queries (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  sources TEXT, -- JSON array of source IDs
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  generation_time_ms INTEGER NOT NULL DEFAULT 0,
  tenant_id TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_rag_namespace (namespace),
  INDEX idx_rag_tenant (tenant_id),
  INDEX idx_rag_created (created_at)
);

-- ============================================================================
-- Vector Mappings Table (for Vectorize ID tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vector_mappings (
  id TEXT PRIMARY KEY,
  vectorize_id TEXT NOT NULL, -- ID in Vectorize index
  resource_type TEXT NOT NULL, -- chunk, document, etc.
  resource_id TEXT NOT NULL, -- Local resource ID
  namespace TEXT NOT NULL,
  tenant_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_vector_resource (resource_type, resource_id),
  INDEX idx_vector_namespace (namespace),
  INDEX idx_vector_vectorize (vectorize_id)
);
