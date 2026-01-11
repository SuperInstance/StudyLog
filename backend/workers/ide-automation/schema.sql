-- IDE Automation Database Schema
-- For D1 (SQLite) database in Cloudflare Workers

-- ============================================================================
-- Chat Sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON-encoded ChatSession
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace ON chat_sessions(workspace_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);

-- ============================================================================
-- Background Jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS background_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL, -- queued, running, paused, completed, failed, cancelled
  data TEXT NOT NULL, -- JSON-encoded BackgroundJob
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_user ON background_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status, created_at);

-- ============================================================================
-- Gamification
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_xp (
  user_id TEXT PRIMARY KEY,
  total_xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  last_updated INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  rarity TEXT NOT NULL, -- common, rare, epic, legendary
  xp_reward INTEGER NOT NULL,
  criteria TEXT NOT NULL, -- JSON-encoded criteria
  hidden BOOLEAN DEFAULT 0
);

-- ============================================================================
-- Code Generations (for tracking AI-generated code)
-- ============================================================================

CREATE TABLE IF NOT EXISTS code_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL, -- theia-extension, godot-scene, worker, component
  quality TEXT NOT NULL, -- fast, balanced, premium
  model_used TEXT NOT NULL,
  tokens_generated INTEGER NOT NULL,
  work_ratio REAL NOT NULL,
  verified BOOLEAN DEFAULT 0,
  rollback_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_code_generations_user ON code_generations(user_id, created_at DESC);

-- ============================================================================
-- Agent Tasks
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  request TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, planning, in_progress, blocked, completed, failed, cancelled
  priority TEXT NOT NULL, -- low, normal, high, urgent
  plan TEXT, -- JSON-encoded ExecutionPlan
  results TEXT, -- JSON-encoded results
  error TEXT,
  retries INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  xp_awarded INTEGER,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_user ON agent_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status, created_at);

-- ============================================================================
-- Context Cache (for caching parsed symbols, dependencies, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS context_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON-encoded cached data
  workspace_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_cache_workspace ON context_cache(workspace_id, expires_at);

-- ============================================================================
-- Insert default achievements
-- ============================================================================

INSERT OR IGNORE INTO achievements (id, name, description, icon, rarity, xp_reward, criteria, hidden)
VALUES
  ('first_chat', 'First Conversation', 'Complete your first AI chat session', 'fa-comments', 'common', 10, '{"type": "count", "measure": "chat_sessions", "target": 1}', 0),
  ('code_generator', 'Code Generator', 'Generate code using AI', 'fa-code', 'common', 25, '{"type": "count", "measure": "code_generations", "target": 1}', 0),
  ('test_writer', 'Test Writer', 'Generate your first test', 'fa-flask', 'common', 20, '{"type": "count", "measure": "tests_generated", "target": 1}', 0),
  ('agent_master', 'Agent Master', 'Complete 10 agent tasks', 'fa-robot', 'rare', 100, '{"type": "count", "measure": "agent_tasks", "target": 10}', 0),
  ('refactoring_pro', 'Refactoring Pro', 'Refactor 5 files', 'fa-magic', 'rare', 75, '{"type": "count", "measure": "refactors", "target": 5}', 0),
  ('century Club', 'Century Club', 'Earn 1000 XP total', 'fa-trophy', 'epic', 500, '{"type": "threshold", "measure": "total_xp", "target": 1000}', 0),
  ('perfect_score', 'Perfect Score', 'Get 100% test coverage', 'fa-star', 'legendary', 200, '{"type": "threshold", "measure": "coverage", "target": 100}', 0);
