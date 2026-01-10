-- StudyLoG.AI Database Schema
-- D1 (SQLite) compatible

-- ═══════════════════════════════════════════════════════════
-- Students - Core user accounts
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT,  -- NULL for OAuth users
    avatar_url TEXT,
    tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'forge', 'studio', 'lab')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT,
    settings TEXT DEFAULT '{}'  -- JSON blob for user preferences
);

CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_tier ON students(tier);

-- ═══════════════════════════════════════════════════════════
-- OAuth Providers - External auth connections
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS oauth_connections (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'google', 'discord')),
    provider_user_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_student ON oauth_connections(student_id);

-- ═══════════════════════════════════════════════════════════
-- Module Progress - Per-module advancement
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS module_progress (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module TEXT NOT NULL CHECK (module IN ('cognitive-mill', 'sitka-sound', 'intelligence-ranch')),
    current_stage INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    started_at TEXT DEFAULT (datetime('now')),
    last_activity_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    UNIQUE(student_id, module)
);

CREATE INDEX idx_progress_student ON module_progress(student_id);
CREATE INDEX idx_progress_module ON module_progress(module);

-- ═══════════════════════════════════════════════════════════
-- Learner Phase - Gamer → Developer progression
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS learner_phases (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    phase TEXT NOT NULL CHECK (phase IN ('player', 'reader', 'tweaker', 'creator', 'mentor')),
    unlocked_at TEXT DEFAULT (datetime('now')),
    challenges_completed INTEGER DEFAULT 0,
    UNIQUE(student_id, phase)
);

CREATE INDEX idx_phases_student ON learner_phases(student_id);

-- ═══════════════════════════════════════════════════════════
-- Achievements - Unlockable badges and rewards
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    xp_reward INTEGER DEFAULT 0,
    module TEXT,  -- NULL for global achievements
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
);

CREATE TABLE IF NOT EXISTS student_achievements (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES achievements(id),
    earned_at TEXT DEFAULT (datetime('now')),
    UNIQUE(student_id, achievement_id)
);

CREATE INDEX idx_student_achievements ON student_achievements(student_id);

-- ═══════════════════════════════════════════════════════════
-- Puzzles - Learning challenges
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS puzzles (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    stage INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    xp_reward INTEGER DEFAULT 10,
    hints TEXT DEFAULT '[]',  -- JSON array of hints
    solution_hash TEXT,  -- For verification without storing solution
    created_at TEXT DEFAULT (datetime('now')),
    tags TEXT DEFAULT '[]'  -- JSON array for semantic search
);

CREATE INDEX idx_puzzles_module_stage ON puzzles(module, stage);
CREATE INDEX idx_puzzles_difficulty ON puzzles(difficulty);

-- ═══════════════════════════════════════════════════════════
-- Puzzle Attempts - Track student solutions
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS puzzle_attempts (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    puzzle_id TEXT NOT NULL REFERENCES puzzles(id),
    submitted_at TEXT DEFAULT (datetime('now')),
    solution TEXT,
    is_correct INTEGER DEFAULT 0,
    hints_used INTEGER DEFAULT 0,
    time_spent_seconds INTEGER,
    ai_feedback TEXT
);

CREATE INDEX idx_attempts_student ON puzzle_attempts(student_id);
CREATE INDEX idx_attempts_puzzle ON puzzle_attempts(puzzle_id);

-- ═══════════════════════════════════════════════════════════
-- Game Sessions - Active gameplay tracking
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    scene TEXT NOT NULL,
    state TEXT DEFAULT '{}',  -- JSON game state
    started_at TEXT DEFAULT (datetime('now')),
    last_save_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT
);

CREATE INDEX idx_sessions_student ON game_sessions(student_id);
CREATE INDEX idx_sessions_active ON game_sessions(student_id, ended_at) WHERE ended_at IS NULL;

-- ═══════════════════════════════════════════════════════════
-- AI Interactions - Track AI usage for analytics
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_interactions (
    id TEXT PRIMARY KEY,
    student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    provider TEXT NOT NULL CHECK (provider IN ('cloudflare', 'ollama', 'anthropic')),
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    latency_ms INTEGER,
    context TEXT,  -- What feature triggered this
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_student ON ai_interactions(student_id);
CREATE INDEX idx_ai_provider ON ai_interactions(provider);
CREATE INDEX idx_ai_created ON ai_interactions(created_at);

-- ═══════════════════════════════════════════════════════════
-- Hardware Profiles - Detected hardware capabilities
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hardware_profiles (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    detected_at TEXT DEFAULT (datetime('now')),
    tier TEXT CHECK (tier IN ('starter', 'maker', 'edge', 'power', 'pro')),
    has_arduino INTEGER DEFAULT 0,
    has_jetson INTEGER DEFAULT 0,
    has_nvidia_gpu INTEGER DEFAULT 0,
    gpu_model TEXT,
    gpu_vram_gb INTEGER,
    system_ram_gb INTEGER,
    can_run_ollama INTEGER DEFAULT 0,
    can_run_ace INTEGER DEFAULT 0,
    raw_detection TEXT  -- JSON of full detection results
);

CREATE INDEX idx_hardware_student ON hardware_profiles(student_id);

-- ═══════════════════════════════════════════════════════════
-- Seed Data - Default achievements
-- ═══════════════════════════════════════════════════════════
INSERT OR IGNORE INTO achievements (id, code, name, description, xp_reward, rarity) VALUES
    ('ach_first_login', 'first_login', 'Welcome Aboard', 'Log in for the first time', 10, 'common'),
    ('ach_first_puzzle', 'first_puzzle', 'Problem Solver', 'Complete your first puzzle', 25, 'common'),
    ('ach_reader_phase', 'reader_phase', 'Code Curious', 'Unlock the Reader phase', 50, 'uncommon'),
    ('ach_tweaker_phase', 'tweaker_phase', 'Tinkerer', 'Unlock the Tweaker phase', 100, 'uncommon'),
    ('ach_creator_phase', 'creator_phase', 'Builder', 'Unlock the Creator phase', 250, 'rare'),
    ('ach_mentor_phase', 'mentor_phase', 'Guide', 'Unlock the Mentor phase', 500, 'epic'),
    ('ach_all_modules', 'all_modules', 'Renaissance', 'Complete all three modules', 1000, 'legendary');

INSERT OR IGNORE INTO achievements (id, code, name, description, xp_reward, module, rarity) VALUES
    ('ach_cm_start', 'cm_start', 'Apprentice Miller', 'Start Cognitive Mill', 10, 'cognitive-mill', 'common'),
    ('ach_cm_steam', 'cm_steam', 'Steam Powered', 'Reach the Steam Engine stage', 50, 'cognitive-mill', 'uncommon'),
    ('ach_cm_complete', 'cm_complete', 'Master Engineer', 'Complete Cognitive Mill', 200, 'cognitive-mill', 'rare'),
    ('ach_ss_start', 'ss_start', 'Deckhand', 'Start Sitka Sound', 10, 'sitka-sound', 'common'),
    ('ach_ss_fleet', 'ss_fleet', 'Fleet Captain', 'Command your first fleet', 50, 'sitka-sound', 'uncommon'),
    ('ach_ss_complete', 'ss_complete', 'Harbor Master', 'Complete Sitka Sound', 200, 'sitka-sound', 'rare'),
    ('ach_ir_start', 'ir_start', 'Shepherd', 'Start Intelligence Ranch', 10, 'intelligence-ranch', 'common'),
    ('ach_ir_dogs', 'ir_dogs', 'Dog Whisperer', 'Train your first working dog', 50, 'intelligence-ranch', 'uncommon'),
    ('ach_ir_complete', 'ir_complete', 'Ranch Baron', 'Complete Intelligence Ranch', 200, 'intelligence-ranch', 'rare');
