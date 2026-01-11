-- Vibe-Coding Chat Interface Database Schema
-- D1 Database for StudyLoG.AI vibe-coding worker

-- ============================================================================
-- Chat Sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON serialized ChatSession
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  INDEX idx_user_sessions (user_id, deleted_at),
  INDEX idx_workspace_sessions (workspace_id, deleted_at),
  INDEX idx_updated_at (updated_at DESC)
);

-- ============================================================================
-- Context Files Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS context_files (
  path TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  content TEXT NOT NULL,
  language TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  last_modified INTEGER NOT NULL,
  INDEX idx_workspace_files (workspace_id, path),
  INDEX idx_language (language)
);

-- ============================================================================
-- Code Symbols Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS code_symbols (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  symbol_kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  start_char INTEGER NOT NULL,
  end_char INTEGER NOT NULL,
  documentation TEXT,
  parent_id TEXT,
  workspace_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES code_symbols(id) ON DELETE CASCADE,
  INDEX idx_file_symbols (file_path, workspace_id),
  INDEX idx_symbol_name (symbol_name),
  INDEX idx_symbol_kind (symbol_kind)
);

-- ============================================================================
-- Usage Analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cached_tokens INTEGER DEFAULT 0,
  cost REAL NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_user_usage (user_id, created_at),
  INDEX idx_provider_usage (provider, created_at)
);

-- ============================================================================
-- File Edits History
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_edits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  operation TEXT NOT NULL, -- 'insert', 'replace', 'delete'
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  original_content TEXT,
  new_content TEXT,
  applied_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_session_edits (session_id),
  INDEX idx_file_edits (file_path, applied_at)
);

-- ============================================================================
-- Feedback
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
  INDEX idx_feedback_session (session_id),
  INDEX idx_feedback_user (user_id)
);
