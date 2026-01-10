-- Schema for multi-model cost tracking
-- Create via: wrangler d1 execute multi-model-costs --file=schema.sql

CREATE TABLE IF NOT EXISTS costs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost REAL NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_id ON costs(user_id);
CREATE INDEX IF NOT EXISTS idx_timestamp ON costs(timestamp);
CREATE INDEX IF NOT EXISTS idx_provider ON costs(provider);

-- Cascade savings tracking for intent-based routing
CREATE TABLE IF NOT EXISTS cascade_savings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  recommended_provider TEXT NOT NULL,
  actual_provider TEXT NOT NULL,
  saved_cost REAL NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cascade_user_id ON cascade_savings(user_id);
CREATE INDEX IF NOT EXISTS idx_cascade_intent ON cascade_savings(intent);
CREATE INDEX IF NOT EXISTS idx_cascade_timestamp ON cascade_savings(timestamp);
