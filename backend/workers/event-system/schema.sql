-- Event System Database Schema
-- D1 schema for event sourcing and projections

-- ============================================================================
-- Events Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  data TEXT NOT NULL, -- JSON
  metadata TEXT NOT NULL, -- JSON
  timestamp TEXT NOT NULL,
  sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Indexes for common queries
  INDEX idx_events_aggregate (aggregate_id, aggregate_type, version),
  INDEX idx_events_type (event_type),
  INDEX idx_events_sequence (sequence_number),
  INDEX idx_events_tenant (json_extract(metadata, '$.tenantId'))
);

-- ============================================================================
-- Snapshots Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  aggregate_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  state TEXT NOT NULL, -- JSON
  timestamp TEXT NOT NULL,
  size INTEGER NOT NULL,

  INDEX idx_snapshots_aggregate (aggregate_id, version DESC),
  INDEX idx_snapshots_type (aggregate_type)
);

-- ============================================================================
-- Projection States Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS projection_states (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle', -- idle, processing, error, rebuilding
  error TEXT,
  updated_at TEXT NOT NULL,
  stats TEXT NOT NULL DEFAULT '{"totalProcessed":0,"totalErrors":0,"avgProcessingTimeMs":0}', -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_projection_status (status)
);

-- ============================================================================
-- Replay Progress Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS replay_progress (
  id TEXT PRIMARY KEY,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  total_events INTEGER NOT NULL DEFAULT 0,
  processed_events INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  started_at TEXT NOT NULL,
  completed_at TEXT,
  estimated_completion TEXT,

  INDEX idx_replay_status (status)
);

-- ============================================================================
-- Student Progress Read Model (Projection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_progress_read_model (
  student_id TEXT PRIMARY KEY,
  total_xp INTEGER NOT NULL DEFAULT 0,
  completed_puzzles INTEGER NOT NULL DEFAULT 0,
  achievements TEXT NOT NULL DEFAULT '[]', -- JSON array
  last_activity TEXT,
  current_phase TEXT NOT NULL DEFAULT 'player',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_progress_xp (total_xp DESC),
  INDEX idx_progress_phase (current_phase)
);

-- ============================================================================
-- Cost Tracking Read Model (Projection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cost_read_model (
  date TEXT PRIMARY KEY,
  total_cost REAL NOT NULL DEFAULT 0,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  by_provider TEXT NOT NULL DEFAULT '{}', -- JSON
  by_model TEXT NOT NULL DEFAULT '{}', -- JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_cost_date (date DESC)
);

-- ============================================================================
-- Subscriptions Table (for persistent subscriptions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  filter TEXT NOT NULL, -- JSON
  delivery TEXT NOT NULL DEFAULT 'inline', -- inline, queue, webhook
  webhook_url TEXT,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, error
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_subscriptions_status (status)
);
