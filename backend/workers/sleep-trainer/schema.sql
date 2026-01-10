-- Schema for Sleep Trainer
-- Create via: wrangler d1 execute sleep-trainer --file=schema.sql

-- Journal entries (daily logs from agents)
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  entry TEXT NOT NULL,
  mood REAL DEFAULT 0,
  context TEXT, -- JSON string
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_agent ON journal_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_journal_timestamp ON journal_entries(timestamp);

-- Long-term memory storage (metadata, actual embeddings in Vectorize)
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_accessed INTEGER DEFAULT (strftime('%s', 'now')),
  access_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);

-- LoRA adapter tracking
CREATE TABLE IF NOT EXISTS lora_adapters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  dataset_path TEXT NOT NULL,
  rank INTEGER DEFAULT 8,
  alpha INTEGER DEFAULT 16,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  status TEXT DEFAULT 'pending' -- pending, training, completed, failed
);

CREATE INDEX IF NOT EXISTS idx_lora_user ON lora_adapters(user_id);
CREATE INDEX IF NOT EXISTS idx_lora_agent ON lora_adapters(agent_id);

-- Sleep cycle log
CREATE TABLE IF NOT EXISTS sleep_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  embeddings_created INTEGER DEFAULT 0,
  lora_trained INTEGER DEFAULT 0,
  memories_consolidated INTEGER DEFAULT 0,
  started_at INTEGER DEFAULT (strftime('%s', 'now')),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sleep_user ON sleep_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_cycles(date);
