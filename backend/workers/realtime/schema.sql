-- Real-Time Communication Database Schema
-- D1 schema for rooms, presence, and chat persistence

-- ============================================================================
-- Rooms Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'classroom', -- classroom, study_group, lecture, lab, office_hours, breakout
  tenant_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'forming', -- forming, active, paused, ended
  owner_id TEXT NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 50,
  current_participants INTEGER NOT NULL DEFAULT 0,
  settings TEXT NOT NULL, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT,
  scheduled_for TEXT,
  duration_minutes INTEGER,

  INDEX idx_rooms_tenant (tenant_id),
  INDEX idx_rooms_state (state),
  INDEX idx_rooms_owner (owner_id),
  INDEX idx_rooms_scheduled (scheduled_for)
);

-- ============================================================================
-- Chat Messages Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, emoji, file, system
  is_private INTEGER NOT NULL DEFAULT 0,
  target_user_id TEXT,
  reply_to TEXT,
  reactions TEXT DEFAULT '[]', -- JSON
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  edited_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0,

  INDEX idx_chat_room (room_id, timestamp),
  INDEX idx_chat_sender (sender_id),
  INDEX idx_chat_reply (reply_to)
);

-- ============================================================================
-- Presence Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS presence (
  user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline', -- online, away, busy, offline
  current_room TEXT,
  activity TEXT,
  device TEXT, -- JSON (type, os, browser)
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_presence_status (status),
  INDEX idx_presence_room (current_room)
);

-- ============================================================================
-- WebRTC Sessions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS webrtc_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  session_type TEXT NOT NULL, -- audio, video, screen
  state TEXT NOT NULL DEFAULT 'new', -- new, connecting, connected, disconnected, failed
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,

  INDEX idx_webrtc_room (room_id),
  INDEX idx_webrtc_users (user_id, target_user_id)
);

-- ============================================================================
-- ICE Candidates Table (for relay through TURN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ice_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  candidate TEXT NOT NULL, -- JSON
  sdp_mid TEXT,
  sdp_mline_index INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_ice_session (session_id)
);

-- ============================================================================
-- Hand Raises Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS hand_raises (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  raised_at TEXT NOT NULL DEFAULT (datetime('now')),
  lowered_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,

  INDEX idx_hand_raises_room (room_id, active)
);

-- ============================================================================
-- Polls Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL, -- JSON
  type TEXT NOT NULL DEFAULT 'single', -- single, multiple
  anonymous INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,

  INDEX idx_polls_room (room_id, active)
);

-- ============================================================================
-- Poll Votes Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS poll_votes (
  id TEXT PRIMARY KEY,
  poll_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  option_id TEXT NOT NULL,
  voted_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_votes_poll (poll_id),
  INDEX idx_votes_user (user_id),
  UNIQUE(poll_id, user_id, option_id)
);

-- ============================================================================
-- Recordings Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS recordings (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  started_by TEXT NOT NULL,
  format TEXT NOT NULL, -- video, audio, slides
  state TEXT NOT NULL DEFAULT 'starting', -- starting, recording, paused, stopped, failed
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_seconds INTEGER,
  storage_key TEXT,
  file_size INTEGER,

  INDEX idx_recordings_room (room_id),
  INDEX idx_recordings_state (state)
);

-- ============================================================================
-- Whiteboard Data Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS whiteboard_data (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  element_id TEXT NOT NULL,
  element_type TEXT NOT NULL, -- stroke, text, shape, image
  data TEXT NOT NULL, -- JSON
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted INTEGER NOT NULL DEFAULT 0,

  INDEX idx_whiteboard_room (room_id, deleted)
);

-- ============================================================================
-- Breakout Rooms Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS breakout_rooms (
  id TEXT PRIMARY KEY,
  parent_room_id TEXT NOT NULL,
  name TEXT NOT NULL,
  max_participants INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,

  INDEX idx_breakout_parent (parent_room_id)
);
