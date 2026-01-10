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

-- ═══════════════════════════════════════════════════════════
-- Bazaar - Community marketplace for creations
-- ═══════════════════════════════════════════════════════════

-- User reputation and grain tokens (extends students table)
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    bio TEXT,
    reputation INTEGER DEFAULT 0,
    grain_tokens INTEGER DEFAULT 0,
    creations_shared INTEGER DEFAULT 0,
    forks_made INTEGER DEFAULT 0,
    quality_verifications INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_profiles_reputation ON user_profiles(reputation DESC);
CREATE INDEX idx_user_profiles_tokens ON user_profiles(grain_tokens DESC);

-- Creations (simulations, puzzles, agents, extensions)
CREATE TABLE IF NOT EXISTS creations (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('simulation', 'puzzle', 'agent', 'extension', 'godot-scene')),
    millfile TEXT,              -- TOML format metadata
    content_hash TEXT,          -- For deduplication
    storage_path TEXT,          -- R2 path to files
    quality INTEGER DEFAULT 1 CHECK (quality BETWEEN 1 AND 4),  -- Fuse Grade
    is_public INTEGER DEFAULT 1,
    forks_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_creations_author ON creations(author_id);
CREATE INDEX idx_creations_type ON creations(type);
CREATE INDEX idx_creations_quality ON creations(quality DESC);
CREATE INDEX idx_creations_public ON creations(is_public, created_at DESC);

-- Forks (GitHub-style)
CREATE TABLE IF NOT EXISTS forks (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
    forker_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    merged INTEGER DEFAULT 0,
    merge_requested_at TEXT,
    merged_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(parent_id, child_id)
);

CREATE INDEX idx_forks_parent ON forks(parent_id);
CREATE INDEX idx_forks_child ON forks(child_id);
CREATE INDEX idx_forks_forker ON forks(forker_id);

-- Feedback (likes, comments, verifications)
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    creation_id TEXT NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'verification', 'fork')),
    content TEXT,
    grain_tokens INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(creation_id, user_id, type)
);

CREATE INDEX idx_feedback_creation ON feedback(creation_id, created_at DESC);
CREATE INDEX idx_feedback_user ON feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_type ON feedback(type);

-- Merge requests
CREATE TABLE IF NOT EXISTS merge_requests (
    id TEXT PRIMARY KEY,
    fork_id TEXT NOT NULL REFERENCES forks(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    title TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    closed_at TEXT
);

CREATE INDEX idx_merge_requests_fork ON merge_requests(fork_id);
CREATE INDEX idx_merge_requests_status ON merge_requests(status, created_at DESC);

-- Code generations (for work ratio tracking)
CREATE TABLE IF NOT EXISTS code_generations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    creation_id TEXT REFERENCES creations(id) ON DELETE SET NULL,
    prompt TEXT,
    model_used TEXT,
    quality_level TEXT CHECK (quality_level IN ('fast', 'balanced', 'premium')),
    tokens_generated INTEGER,
    work_ratio REAL DEFAULT 0.0,  -- AI contribution percentage
    verified INTEGER DEFAULT 0,
    rollback_id TEXT,  -- Reference to previous if rolled back
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_generations_user ON code_generations(user_id, created_at DESC);
CREATE INDEX idx_generations_creation ON code_generations(creation_id);

-- ═══════════════════════════════════════════════════════════
-- Image Cascade - Image generation with tiered routing
-- ═══════════════════════════════════════════════════════════

-- Image generations - Main tracking table for cascade routing
CREATE TABLE IF NOT EXISTS image_generations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    refined_prompt TEXT,
    negative_prompt TEXT,
    tier TEXT NOT NULL CHECK (tier IN ('draft', 'preview', 'final')),
    resolution TEXT DEFAULT '512x512',
    count INTEGER DEFAULT 1,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    success INTEGER DEFAULT 0,
    error_message TEXT,
    image_urls TEXT DEFAULT '[]',
    cost REAL DEFAULT 0.0,
    latency_ms INTEGER,
    agent_used INTEGER DEFAULT 0,
    agent_type TEXT,
    agent_confidence REAL,
    parent_id TEXT REFERENCES image_generations(id) ON DELETE SET NULL,
    generation_chain TEXT,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_image_gens_user ON image_generations(user_id, created_at DESC);
CREATE INDEX idx_image_gens_tier ON image_generations(tier, created_at DESC);
CREATE INDEX idx_image_gens_provider ON image_generations(provider, created_at DESC);
CREATE INDEX idx_image_gens_parent ON image_generations(parent_id);
CREATE INDEX idx_image_gens_success ON image_generations(success, created_at DESC);

-- Prompt history - For agent learning
CREATE TABLE IF NOT EXISTS image_prompt_history (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    original_input TEXT NOT NULL,
    crafted_prompt TEXT NOT NULL,
    negative_prompt TEXT,
    agent TEXT NOT NULL CHECK (agent IN ('captain', 'builder', 'teacher', 'artist')),
    tier TEXT NOT NULL CHECK (tier IN ('draft', 'preview', 'final')),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    success INTEGER DEFAULT 0,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,
    confidence REAL,
    expected_improvement REAL,
    tags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_prompt_hist_user ON image_prompt_history(user_id, created_at DESC);
CREATE INDEX idx_prompt_hist_agent ON image_prompt_history(agent, created_at DESC);
CREATE INDEX idx_prompt_hist_success ON image_prompt_history(success, rating DESC);

-- Cascade savings - Track cost savings from tiered approach
CREATE TABLE IF NOT EXISTS cascade_savings (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    chain_id TEXT NOT NULL,
    final_generation_id TEXT REFERENCES image_generations(id) ON DELETE SET NULL,
    draft_count INTEGER DEFAULT 0,
    draft_cost REAL DEFAULT 0.0,
    preview_count INTEGER DEFAULT 0,
    preview_cost REAL DEFAULT 0.0,
    final_count INTEGER DEFAULT 0,
    final_cost REAL DEFAULT 0.0,
    total_cost REAL DEFAULT 0.0,
    traditional_cost REAL DEFAULT 0.0,
    savings_amount REAL DEFAULT 0.0,
    savings_percentage REAL DEFAULT 0.0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_cascade_savings_user ON cascade_savings(user_id, created_at DESC);
CREATE INDEX idx_cascade_savings_chain ON cascade_savings(chain_id);

-- Provider metrics - Track provider performance
CREATE TABLE IF NOT EXISTS provider_metrics (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('draft', 'preview', 'final')),
    total_generations INTEGER DEFAULT 0,
    successful_generations INTEGER DEFAULT 0,
    failed_generations INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,
    avg_latency_ms REAL DEFAULT 0.0,
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,
    total_cost REAL DEFAULT 0.0,
    avg_cost_per_image REAL DEFAULT 0.0,
    date TEXT NOT NULL,
    hour INTEGER CHECK (hour BETWEEN 0 AND 23),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, model, tier, date, hour)
);

CREATE INDEX idx_provider_metrics_provider ON provider_metrics(provider, date DESC);
CREATE INDEX idx_provider_metrics_date ON provider_metrics(date DESC);

-- User quotas - Track daily image generation limits
CREATE TABLE IF NOT EXISTS image_user_quotas (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    daily_limit INTEGER DEFAULT 50,
    daily_count INTEGER DEFAULT 0,
    draft_count INTEGER DEFAULT 0,
    preview_count INTEGER DEFAULT 0,
    final_count INTEGER DEFAULT 0,
    last_reset_date TEXT DEFAULT (date('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_user_quotas_reset ON image_user_quotas(last_reset_date);

-- ═══════════════════════════════════════════════════════════
-- Bazaar Seed Data
-- ═══════════════════════════════════════════════════════════

INSERT OR IGNORE INTO achievements (id, code, name, description, xp_reward, rarity) VALUES
    ('ach_bz_first_share', 'bz_first_share', 'Open Source', 'Share your first creation', 50, 'common'),
    ('ach_bz_first_fork', 'bz_first_fork', 'Branching Out', 'Fork a creation', 25, 'common'),
    ('ach_bz_first_merge', 'bz_first_merge', 'Code Review', 'Get a merge approved', 100, 'uncommon'),
    ('ach_bz_quality_2', 'bz_quality_2', 'Proven', 'Creation reaches Fuse Grade 2', 75, 'uncommon'),
    ('ach_bz_quality_3', 'bz_quality_3', 'Verified', 'Creation reaches Fuse Grade 3', 200, 'rare'),
    ('ach_bz_quality_4', 'bz_quality_4', 'Masterpiece', 'Creation reaches Fuse Grade 4', 500, 'epic'),
    ('ach_bz_100_likes', 'bz_100_likes', 'Crowd Favorite', 'Creation gets 100 likes', 150, 'rare'),
    ('ach_bz_mentor', 'bz_mentor', 'Community Leader', 'Reach 1000 reputation', 300, 'epic');

-- ═══════════════════════════════════════════════════════════
-- Budget Tracker - Free-tier API budget management
-- ═══════════════════════════════════════════════════════════

-- Provider budgets - User's API keys and daily limits for free-tier providers
CREATE TABLE IF NOT EXISTS provider_budgets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL CHECK (provider_id IN (
        'openai', 'xai', 'qwen', 'google', 'anthropic',
        'deepseek', 'zhipu', 'nvidia', 'ollama', 'deepinfra',
        'replicate', 'elevenlabs', 'custom'
    )),
    api_key TEXT NOT NULL,
    daily_limit REAL NOT NULL DEFAULT 0.0,
    daily_used REAL NOT NULL DEFAULT 0.0,
    tokens_used INTEGER DEFAULT 0,
    token_limit INTEGER DEFAULT NULL,
    reset_time TEXT NOT NULL,
    reset_schedule TEXT NOT NULL DEFAULT 'daily' CHECK (reset_schedule IN (
        'daily', 'weekly', 'monthly', 'rolling', 'one-time', 'never'
    )),
    alert_threshold INTEGER NOT NULL DEFAULT 90 CHECK (alert_threshold BETWEEN 0 AND 100),
    mode TEXT NOT NULL DEFAULT 'balanced' CHECK (mode IN (
        'conservative', 'balanced', 'aggressive', 'unlimited'
    )),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
    custom_endpoint TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, provider_id)
);

CREATE INDEX idx_provider_budgets_user ON provider_budgets(user_id);
CREATE INDEX idx_provider_budgets_enabled ON provider_budgets(enabled, priority);

-- Usage records - Track each API call for accurate budgeting
CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE SET NULL,
    provider_id TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0.0,
    latency_ms INTEGER DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 1 CHECK (success IN (0, 1)),
    error_message TEXT,
    context TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_usage_records_user ON usage_records(user_id, timestamp DESC);
CREATE INDEX idx_usage_records_provider ON usage_records(provider_id, timestamp DESC);
CREATE INDEX idx_usage_records_date ON usage_records(date(timestamp));

-- Budget alerts - History of budget limit alerts
CREATE TABLE IF NOT EXISTS budget_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    alert_type TEXT NOT NULL DEFAULT 'warning' CHECK (alert_type IN ('info', 'warning', 'critical')),
    usage_percent REAL NOT NULL,
    threshold INTEGER NOT NULL,
    message TEXT NOT NULL,
    dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
    triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
    dismissed_at TEXT
);

CREATE INDEX idx_budget_alerts_user ON budget_alerts(user_id, triggered_at DESC);

-- Fill knowledge tasks - End-of-day knowledge expansion tasks
CREATE TABLE IF NOT EXISTS fill_knowledge_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK (task_type IN (
        'embedding', 'cache-warm', 'training-data',
        'summarization', 'classification', 'custom'
    )),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    estimated_cost REAL NOT NULL DEFAULT 0.0,
    parameters TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled'
    )),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    actual_cost REAL DEFAULT NULL,
    result TEXT DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    scheduled_for TEXT NOT NULL,
    started_at TEXT DEFAULT NULL,
    completed_at TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fill_knowledge_user ON fill_knowledge_tasks(user_id, status, priority);
CREATE INDEX idx_fill_knowledge_scheduled ON fill_knowledge_tasks(scheduled_for, status);

-- Provider rotation history - Track provider switching decisions
CREATE TABLE IF NOT EXISTS provider_rotation_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    from_provider TEXT NOT NULL,
    to_provider TEXT NOT NULL,
    reason TEXT NOT NULL,
    from_remaining REAL DEFAULT NULL,
    estimated_savings REAL DEFAULT NULL,
    request_context TEXT,
    rotated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rotation_user ON provider_rotation_history(user_id, rotated_at DESC);

-- Daily budget summaries
CREATE TABLE IF NOT EXISTS daily_budget_summaries (
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    total_spent REAL NOT NULL DEFAULT 0.0,
    total_budget REAL NOT NULL DEFAULT 0.0,
    utilization_percent REAL NOT NULL DEFAULT 0.0,
    total_calls INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    alert_count INTEGER NOT NULL DEFAULT 0,
    fill_tasks_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_daily_budget_date ON daily_budget_summaries(date DESC);
