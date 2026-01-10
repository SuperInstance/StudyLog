-- ═══════════════════════════════════════════════════════════════════════════
-- G-Assist Conversation History Schema
-- ═══════════════════════════════════════════════════════════════════════════
--
-- This schema defines the conversation history persistence for G-Assist.
--
-- DESIGN NOTES:
--
-- 1. Messages stored as JSON:
--    - Flexibility: Easy to add new fields (tokens, model used, metadata)
--    - Queryability: Can use SQLite JSON functions (json_extract, json_each)
--    - Simplicity: Single table vs separate messages table with JOINs
--    - Trade-off: Not ideal for complex queries on individual messages,
--      but for "load full conversation" pattern, it's optimal.
--
-- 2. Upsert Pattern (INSERT OR REPLACE):
--    - Allows create-or-update in single operation
--    - Uses PRIMARY KEY (id) to detect conflicts
--    - Replaces entire row on conflict - simpler than UPDATE with conditional
--    - Perfect for "save conversation after each message" pattern
--
-- 3. Title Generation:
--    - First 50 characters of first user message
--    - Truncated at word boundary to avoid cutting mid-word
--    - Fallback to "New Conversation" if no messages
--
-- 4. Index Strategy:
--    - idx_conversations_user_id: Fast lookup of user's conversations
--    - idx_conversations_updated_at: Efficient sorting by recency (DESC)
--    - Composite index could be added later for (user_id, updated_at)
--
-- ═══════════════════════════════════════════════════════════════════════════

-- Conversation History Table
CREATE TABLE IF NOT EXISTS conversations (
  -- Primary key: UUID for unique identification
  id TEXT PRIMARY KEY,

  -- User identification
  -- Maps to student_id in main D1 schema, TEXT for flexibility with OAuth IDs
  user_id TEXT NOT NULL,

  -- Agent that handled this conversation
  -- References GAssistAgent type: 'captain' | 'teacher' | 'builder' | 'tester' | 'director'
  agent TEXT NOT NULL,

  -- Human-readable title
  -- Generated from first user message (first 50 chars) or provided manually
  title TEXT,

  -- Full message history
  -- JSON array: [{ role, content, timestamp, agent?, tokens? }]
  -- Stored as JSON for flexibility - schema can evolve without migrations
  -- Example: '[{"role":"user","content":"Help me debug...","timestamp":1234567890}]'
  messages TEXT NOT NULL,

  -- Additional context for the conversation
  -- JSON object: { module, scene, files, currentSelection, etc. }
  -- Captures IDE state when conversation started
  context TEXT,

  -- Timestamps (milliseconds since epoch)
  -- Using INTEGER for efficient sorting and indexing
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════

-- User lookup index
-- Enables efficient queries like:
--   SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON conversations(user_id);

-- Recency sorting index
-- Enables efficient sorting by most recently updated
-- DESC is the default order for conversation lists
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations(updated_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- Example Queries
-- ═══════════════════════════════════════════════════════════════════════════
--
-- List user's conversations (most recent first):
--   SELECT id, title, agent,
--          json_array_length(messages) as message_count,
--          updated_at
--   FROM conversations
--   WHERE user_id = ?
--   ORDER BY updated_at DESC;
--
-- Load full conversation:
--   SELECT * FROM conversations WHERE id = ? AND user_id = ?;
--
-- Search conversations by content (using JSON functions):
--   SELECT id, title FROM conversations
--   WHERE user_id = ?
--     AND messages LIKE '%search_term%';
--
-- Get conversations for specific agent:
--   SELECT * FROM conversations
--   WHERE user_id = ? AND agent = ?
--   ORDER BY updated_at DESC;
--
-- ═══════════════════════════════════════════════════════════════════════════
