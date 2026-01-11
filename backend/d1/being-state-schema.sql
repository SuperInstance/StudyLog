-- ============================================================================
-- Being State System - Database Schema
-- ============================================================================
-- D1 Database schema for the Being State System
-- Handles multi-layered being states with visual, audio, gameplay, and agent layers

-- ============================================================================
-- Being States Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS being_states (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  visual TEXT NOT NULL DEFAULT 'ethereal',
  audio TEXT NOT NULL DEFAULT 'serene',
  gameplay TEXT NOT NULL DEFAULT 'exploration',
  agent TEXT NOT NULL DEFAULT 'directed',
  intensity REAL NOT NULL DEFAULT 0.5,
  previous_state TEXT, -- JSON
  transition_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,

  -- Indexes
  INDEX idx_session (session_id),
  INDEX idx_updated (updated_at),
  INDEX idx_expires (expires_at)
);

-- Valid state constraints (enforced at application level)
-- visual: ethereal, mechanical, organic, crystalline, shadow, radiant, void, elemental, cyber, ancient
-- audio: eerie, triumphant, muted, chaotic, serene, intense, mystical, mechanical, natural, digital
-- gameplay: chaotic, ordered, dreamlike, survival, creative, competitive, cooperative, exploration, puzzle, narrative
-- agent: autonomous, directed, emergent, dormant, rogue, symbiotic, learning, teaching, mimicking, transcendent

-- ============================================================================
-- Game Events Table (for RAG)
-- ============================================================================

CREATE TABLE IF NOT EXISTS game_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  source TEXT,
  target TEXT,
  data TEXT NOT NULL, -- JSON

  INDEX idx_session_time (session_id, timestamp),
  INDEX idx_type (event_type),
  INDEX idx_source (source)
);

-- ============================================================================
-- Gameplay Mutations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS gameplay_mutations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  rule TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON
  duration INTEGER, -- milliseconds
  created_at INTEGER NOT NULL,

  INDEX idx_session (session_id),
  INDEX idx_rule (rule),
  INDEX idx_created (created_at)
);

-- ============================================================================
-- Agent Memories Table (NVIDIA Nemotron style)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  tier TEXT NOT NULL, -- episodic, semantic, procedural
  memory TEXT NOT NULL, -- JSON
  timestamp INTEGER NOT NULL,
  consolidated INTEGER DEFAULT 0,

  INDEX idx_agent (agent_id),
  INDEX idx_tier (tier),
  INDEX idx_timestamp (timestamp),
  INDEX idx_consolidated (consolidated)
);

-- ============================================================================
-- Crew Configurations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS crew_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  agents TEXT NOT NULL, -- JSON array of crew agents
  tasks TEXT, -- JSON array of crew tasks
  coordination TEXT NOT NULL, -- JSON
  updated_at INTEGER NOT NULL
);

-- ============================================================================
-- Feedback Events Table (for learning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id TEXT,
  action_id TEXT NOT NULL,
  outcome TEXT NOT NULL, -- success, failure, partial
  metrics TEXT NOT NULL, -- JSON
  observations TEXT NOT NULL, -- JSON array
  surprises TEXT, -- JSON array
  learning_signal REAL,
  timestamp INTEGER NOT NULL,

  INDEX idx_session (session_id),
  INDEX idx_agent (agent_id),
  INDEX idx_action (action_id),
  INDEX idx_timestamp (timestamp)
);

-- ============================================================================
-- Cost Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS being_state_costs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  state_layers TEXT NOT NULL, -- JSON array of layers modified
  cost REAL NOT NULL,
  tokens TEXT, -- JSON with input/output counts
  timestamp INTEGER NOT NULL,

  INDEX idx_session (session_id),
  INDEX idx_operation (operation),
  INDEX idx_timestamp (timestamp)
);

-- ============================================================================
-- Triggers for Automatic Cleanup
-- ============================================================================

-- Trigger to clean up expired states
CREATE TRIGGER IF NOT EXISTS cleanup_expired_states
AFTER SELECT ON being_states
WHEN NEW.expires_at IS NOT NULL AND NEW.expires_at < strftime('%s', 'now') * 1000
BEGIN
  DELETE FROM being_states WHERE id = NEW.id AND expires_at < strftime('%s', 'now') * 1000;
END;

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- Active states view (non-expired)
CREATE VIEW IF NOT EXISTS active_states AS
SELECT * FROM being_states
WHERE expires_at IS NULL OR expires_at > strftime('%s', 'now') * 1000;

-- Agent learning progress view
CREATE VIEW IF NOT EXISTS agent_learning_progress AS
SELECT
  agent_id,
  COUNT(*) as total_signals,
  AVG(CASE WHEN learning_signal > 0 THEN learning_signal ELSE 0 END) as avg_positive_signal,
  AVG(ABS(learning_signal)) as avg_signal_magnitude,
  MAX(timestamp) as last_signal_time
FROM feedback_events
WHERE agent_id IS NOT NULL
GROUP BY agent_id;

-- Recent events view (last 100 per session)
CREATE VIEW IF NOT EXISTS recent_session_events AS
SELECT
  session_id,
  event_type,
  COUNT(*) as event_count,
  MAX(timestamp) as last_event_time
FROM game_events
WHERE timestamp > strftime('%s', 'now') * 1000 - 3600000 -- Last hour
GROUP BY session_id, event_type;

-- ============================================================================
-- Seed Data (Optional)
-- ============================================================================

-- Insert default state configurations
INSERT OR IGNORE INTO being_states (id, session_id, visual, audio, gameplay, agent, intensity, created_at, updated_at)
VALUES
  ('default_ethereal', 'default', 'ethereal', 'serene', 'exploration', 'directed', 0.5, 0, 0),
  ('default_mechanical', 'default', 'mechanical', 'mechanical', 'ordered', 'autonomous', 0.7, 0, 0),
  ('default_shadow', 'default', 'shadow', 'eerie', 'dreamlike', 'emergent', 0.6, 0, 0);
