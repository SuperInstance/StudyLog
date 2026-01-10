-- Digital Human Worker Database Schema
-- For D1 (SQLite) database
-- Stores agent configurations and session data for NVIDIA Digital Human integration

-- Agent Configurations Table
-- Stores registered ACE agent configurations
CREATE TABLE IF NOT EXISTS agent_configs (
  agent_id TEXT PRIMARY KEY,
  config TEXT NOT NULL, -- JSON: ACEAgentConfig
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_updated ON agent_configs(updated_at DESC);

-- Digital Tutor Sessions Table
-- Stores conversation sessions with digital tutors
CREATE TABLE IF NOT EXISTS digital_tutor_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  personality TEXT NOT NULL, -- 'tutor' | 'captain' | 'teacher' | 'builder'

  -- Session timestamps
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  last_activity INTEGER NOT NULL,

  -- Conversation data
  messages TEXT NOT NULL DEFAULT '[]', -- JSON array of chat messages

  -- Session metadata
  metadata TEXT, -- JSON object for additional session data

  -- Creation timestamp
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_user ON digital_tutor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_agent ON digital_tutor_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON digital_tutor_sessions(last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_personality ON digital_tutor_sessions(personality);

-- Animation Cache Table
-- Caches generated facial animations to avoid reprocessing
CREATE TABLE IF NOT EXISTS animation_cache (
  id TEXT PRIMARY KEY,
  audio_hash TEXT NOT NULL, -- Hash of audio input for deduplication

  -- Animation data
  blend_shapes TEXT NOT NULL, -- JSON: blend shape data
  timeline TEXT NOT NULL, -- JSON: animation timeline

  -- Metadata
  emotion TEXT,
  duration REAL NOT NULL,
  frame_count INTEGER NOT NULL,

  -- Cache management
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  access_count INTEGER DEFAULT 1,
  last_accessed INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_animation_audio_hash ON animation_cache(audio_hash);
CREATE INDEX IF NOT EXISTS idx_animation_last_accessed ON animation_cache(last_accessed DESC);

-- Portrait Animations Table
-- Stores generated Live Portrait animations
CREATE TABLE IF NOT EXISTS portrait_animations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Input references
  portrait_image_url TEXT NOT NULL,
  audio_url TEXT NOT NULL,

  -- Output references
  video_url TEXT NOT NULL,

  -- Animation settings
  style TEXT NOT NULL, -- 'realistic' | 'expressive' | 'subtle'
  emotion TEXT,

  -- Processing metadata
  duration REAL NOT NULL,
  resolution_width INTEGER NOT NULL,
  resolution_height INTEGER NOT NULL,
  lip_sync_score REAL,

  -- Status
  status TEXT NOT NULL, -- 'processing' | 'completed' | 'failed'

  -- Timestamps
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_portrait_user ON portrait_animations(user_id);
CREATE INDEX IF NOT EXISTS idx_portrait_status ON portrait_animations(status);
CREATE INDEX IF NOT EXISTS idx_portrait_created ON portrait_animations(created_at DESC);

-- Audio Enhancements Table
-- Stores Studio Voice enhancement jobs
CREATE TABLE IF NOT EXISTS audio_enhancements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Input reference (R2 key or URL)
  input_audio_key TEXT NOT NULL,

  -- Output reference (R2 key or URL)
  output_audio_key TEXT NOT NULL,

  -- Enhancement settings
  preset TEXT NOT NULL, -- 'voice-only' | 'music-mixed' | 'noise-cancel'
  noise_reduction_level REAL,

  -- Processing results
  duration REAL NOT NULL,
  snr_improvement_db REAL,

  -- Status
  status TEXT NOT NULL, -- 'processing' | 'completed' | 'failed'

  -- Timestamps
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_audio_enhancement_user ON audio_enhancements(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_enhancement_status ON audio_enhancements(status);

-- User Preferences Table
-- Stores user preferences for digital human interactions
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,

  -- Preferred agent settings
  default_personality TEXT NOT NULL DEFAULT 'tutor',
  default_voice_model TEXT NOT NULL DEFAULT 'us-female-1',
  default_avatar_model TEXT NOT NULL DEFAULT 'studylog-tutor-1',

  -- Feature flags
  enable_facial_animation INTEGER NOT NULL DEFAULT 1,
  enable_eye_contact INTEGER NOT NULL DEFAULT 1,
  enable_emotion_detection INTEGER NOT NULL DEFAULT 1,
  auto_play_audio INTEGER NOT NULL DEFAULT 0,

  -- Display settings
  avatar_size REAL NOT NULL DEFAULT 1.0,
  avatar_position TEXT NOT NULL DEFAULT 'bottom-right', -- 'bottom-left', 'bottom-right', 'top-left', 'top-right'

  -- Timestamps
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Session Statistics (for analytics)
CREATE TABLE IF NOT EXISTS session_statistics (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  personality TEXT NOT NULL,

  -- Interaction counts
  message_count INTEGER NOT NULL DEFAULT 0,
  audio_duration REAL NOT NULL DEFAULT 0,
  animation_frames_generated INTEGER NOT NULL DEFAULT 0,

  -- Quality metrics
  avg_lip_sync_score REAL,
  avg_response_time_ms REAL,

  -- Timestamps
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_stats_session ON session_statistics(session_id);
CREATE INDEX IF NOT EXISTS idx_stats_user ON session_statistics(user_id);

-- Triggers for automatic timestamp updates

CREATE TRIGGER IF NOT EXISTS update_agent_configs_timestamp
AFTER UPDATE ON agent_configs
BEGIN
  UPDATE agent_configs SET updated_at = strftime('%s', 'now') WHERE agent_id = NEW.agent_id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp
AFTER UPDATE ON user_preferences
BEGIN
  UPDATE user_preferences SET updated_at = strftime('%s', 'now') WHERE user_id = NEW.user_id;
END;

-- Seed data for default agents

INSERT OR IGNORE INTO agent_configs (agent_id, config, created_at, updated_at)
VALUES (
  'tutor-1',
  json_object(
    'agentId', 'tutor-1',
    'personality', 'tutor',
    'voiceModel', 'us-female-1',
    'avatarModel', 'studylog-tutor-1',
    'capabilities', json_array('facial-animation', 'eye-contact', 'emotion-detection', 'emotion-rendering', 'lip-sync', 'natural-language'),
    'defaultEmotion', 'encouraging',
    'maxTokens', 512,
    'temperature', 0.7
  ),
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

INSERT OR IGNORE INTO agent_configs (agent_id, config, created_at, updated_at)
VALUES (
  'captain-1',
  json_object(
    'agentId', 'captain-1',
    'personality', 'captain',
    'voiceModel', 'us-male-1',
    'avatarModel', 'studylog-captain-1',
    'capabilities', json_array('facial-animation', 'eye-contact', 'gestures', 'emotion-rendering', 'lip-sync', 'natural-language'),
    'defaultEmotion', 'neutral',
    'maxTokens', 512,
    'temperature', 0.7
  ),
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

INSERT OR IGNORE INTO agent_configs (agent_id, config, created_at, updated_at)
VALUES (
  'teacher-1',
  json_object(
    'agentId', 'teacher-1',
    'personality', 'teacher',
    'voiceModel', 'us-female-1',
    'avatarModel', 'studylog-tutor-1',
    'capabilities', json_array('facial-animation', 'lip-sync', 'natural-language'),
    'defaultEmotion', 'neutral',
    'maxTokens', 512,
    'temperature', 0.7
  ),
  strftime('%s', 'now'),
  strftime('%s', 'now')
);

INSERT OR IGNORE INTO agent_configs (agent_id, config, created_at, updated_at)
VALUES (
  'builder-1',
  json_object(
    'agentId', 'builder-1',
    'personality', 'builder',
    'voiceModel', 'us-male-1',
    'avatarModel', 'studylog-tutor-1',
    'capabilities', json_array('facial-animation', 'lip-sync', 'natural-language'),
    'defaultEmotion', 'neutral',
    'maxTokens', 512,
    'temperature', 0.7
  ),
  strftime('%s', 'now'),
  strftime('%s', 'now')
);
