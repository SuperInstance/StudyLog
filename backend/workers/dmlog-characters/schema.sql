-- DMLoG.AI - Character Persistence Schema
-- D1 (SQLite) compatible
-- Cross-product character system for DMLoG.AI and StudyLoG.AI

-- ═══════════════════════════════════════════════════════════
-- Characters - Main character storage
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_domain TEXT NOT NULL CHECK (product_domain IN ('dmlog', 'studylog', 'makerlog', 'shared')),
    character_type TEXT NOT NULL CHECK (character_type IN ('player', 'npc', 'dm_agent', 'tutor', 'student', 'generic')),

    -- Core identity
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    character_class TEXT,
    description TEXT NOT NULL,
    avatar_url TEXT,

    -- DMLoG-specific attributes
    race TEXT,
    alignment TEXT CHECK (alignment IN (
        'lawful_good', 'neutral_good', 'chaotic_good',
        'lawful_neutral', 'true_neutral', 'chaotic_neutal',
        'lawful_evil', 'neutral_evil', 'chaotic_evil'
    )),
    level INTEGER DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
    xp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 10,
    max_hp INTEGER DEFAULT 10,
    ac INTEGER DEFAULT 10,
    initiative INTEGER DEFAULT 0,
    speed INTEGER DEFAULT 30,

    -- Personality (JSON)
    personality TEXT DEFAULT '{}',

    -- Backstory and traits (JSON arrays)
    backstory TEXT DEFAULT '',
    goals TEXT DEFAULT '[]',
    fears TEXT DEFAULT '[]',
    quirks TEXT DEFAULT '[]',
    virtues TEXT DEFAULT '[]',
    vices TEXT DEFAULT '[]',

    -- StudyLoG-specific attributes
    learning_style TEXT CHECK (learning_style IN ('visual', 'auditory', 'kinesthetic', 'reading', 'multimodal')),
    grade_level INTEGER CHECK (grade_level BETWEEN 1 AND 12),
    interests TEXT DEFAULT '[]',
    learning_goals TEXT DEFAULT '[]',
    strengths TEXT DEFAULT '[]',
    support_areas TEXT DEFAULT '[]',

    -- State tracking
    state TEXT DEFAULT 'idle' CHECK (state IN ('idle', 'thinking', 'acting', 'resting', 'incapacitated', 'learning', 'teaching')),
    interaction_count INTEGER DEFAULT 0,

    -- Relationships
    campaign_id TEXT,
    session_id TEXT,
    parent_id TEXT,  -- For forked characters

    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL,
    version INTEGER DEFAULT 1,

    -- Tags and visibility
    tags TEXT DEFAULT '[]',
    is_public INTEGER DEFAULT 0,
    is_template INTEGER DEFAULT 0,

    FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES characters(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_product ON characters(product_domain);
CREATE INDEX IF NOT EXISTS idx_characters_type ON characters(character_type);
CREATE INDEX IF NOT EXISTS idx_characters_campaign ON characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_characters_session ON characters(session_id);
CREATE INDEX IF NOT EXISTS idx_characters_parent ON characters(parent_id);
CREATE INDEX IF NOT EXISTS idx_characters_public ON characters(is_public, is_template) WHERE is_public = 1 OR is_template = 1;
CREATE INDEX IF NOT EXISTS idx_characters_updated ON characters(updated_at DESC);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS characters_fts USING fts5(
    name,
    description,
    backstory,
    content='characters',
    content_rowid='rowid'
);

-- ═══════════════════════════════════════════════════════════
-- Character Memories - Hierarchical memory integration
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS character_memories (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    -- Memory content
    content TEXT NOT NULL,
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'working', 'short_term', 'long_term', 'episodic', 'semantic', 'procedural'
    )),

    -- Memory attributes
    importance REAL DEFAULT 5.0 CHECK (importance BETWEEN 0 AND 10),
    emotional_valence REAL DEFAULT 0.0 CHECK (emotional_valence BETWEEN -1 AND 1),

    -- Context
    participants TEXT DEFAULT '[]',
    location TEXT DEFAULT '',

    -- Access tracking
    access_count INTEGER DEFAULT 0,
    last_accessed TEXT,
    consolidated INTEGER DEFAULT 0,

    -- Related memories
    related_memory_ids TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',

    -- Timestamp
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_character ON character_memories(character_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON character_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON character_memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_created ON character_memories(created_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Character History - Change tracking for undo/redo
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS character_history (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,

    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'create', 'update', 'delete', 'memory_add', 'memory_remove',
        'memory_update', 'state_change', 'level_up', 'hp_change',
        'xp_gain', 'session_join', 'session_leave'
    )),

    timestamp INTEGER NOT NULL,
    version INTEGER NOT NULL,
    previous_version INTEGER,

    -- Changes (JSON)
    changes TEXT DEFAULT '[]',

    -- Full state snapshot (optional, for quick restore)
    snapshot TEXT,

    session_id TEXT,
    description TEXT,
    metadata TEXT DEFAULT '{}',

    -- Reversion tracking
    reverted INTEGER DEFAULT 0,
    reverted_at INTEGER,
    reverted_by TEXT REFERENCES user_id
);

CREATE INDEX IF NOT EXISTS idx_history_character ON character_history(character_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON character_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_type ON character_history(entry_type);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON character_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_version ON character_history(character_id, version);

-- ═══════════════════════════════════════════════════════════
-- Character Snapshots - Time travel points
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS character_snapshots (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,

    -- Full state (JSON)
    state_data TEXT NOT NULL,

    -- Vector clock for distributed systems
    vector_clock TEXT DEFAULT '[]',

    created_at INTEGER NOT NULL,

    UNIQUE(character_id, version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_character ON character_snapshots(character_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_version ON character_snapshots(character_id, version DESC);

-- ═══════════════════════════════════════════════════════════
-- Character History Branches - Branching undo/redo
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS character_history_branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    branch_point_version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL,

    current_version INTEGER NOT NULL,
    parent_id TEXT REFERENCES character_history_branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_branches_character ON character_history_branches(character_id);
CREATE INDEX IF NOT EXISTS idx_branches_parent ON character_history_branches(parent_id);

-- ═══════════════════════════════════════════════════════════
-- Character Conflicts - Unresolved merge conflicts
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS character_conflicts (
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    current_state TEXT NOT NULL,
    incoming_state TEXT NOT NULL,

    created_at INTEGER NOT NULL,
    resolved_at INTEGER,
    resolution TEXT,
    resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_conflicts_character ON character_conflicts(character_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON character_conflicts(resolved_at) WHERE resolved_at IS NULL;

-- ═══════════════════════════════════════════════════════════
-- Session Sync Events - Real-time state sync
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS session_sync_events (
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,

    state_data TEXT NOT NULL,
    created_at INTEGER NOT NULL,

    PRIMARY KEY (character_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_session ON session_sync_events(session_id);
CREATE INDEX IF NOT EXISTS idx_sync_created ON session_sync_events(created_at);

-- ═══════════════════════════════════════════════════════════
-- Campaigns - DMLoG campaign metadata
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    dm_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    setting TEXT,

    is_active INTEGER DEFAULT 1,
    is_public INTEGER DEFAULT 0,

    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_dm ON campaigns(dm_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active) WHERE is_active = 1;

-- ═══════════════════════════════════════════════════════════
-- Campaign Members - Characters in campaigns
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS campaign_members (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    joined_at INTEGER NOT NULL,

    PRIMARY KEY (campaign_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);

-- ═══════════════════════════════════════════════════════════
-- Triggers for FTS sync
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER IF NOT EXISTS characters_fts_insert AFTER INSERT ON characters BEGIN
    INSERT INTO characters_fts(rowid, name, description, backstory)
    VALUES (new.rowid, new.name, new.description, new.backstory);
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_delete AFTER DELETE ON characters BEGIN
    DELETE FROM characters_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS characters_fts_update AFTER UPDATE ON characters BEGIN
    UPDATE characters_fts
    SET name = new.name, description = new.description, backstory = new.backstory
    WHERE rowid = old.rowid;
END;

-- ═══════════════════════════════════════════════════════════
-- Triggers for timestamp management
-- ═══════════════════════════════════════════════════════════
CREATE TRIGGER IF NOT EXISTS characters_updated_at BEFORE UPDATE ON characters BEGIN
    UPDATE characters SET updated_at = strftime('%s', 'submittable', 'now') * 1000 WHERE id = new.id;
END;

-- ═══════════════════════════════════════════════════════════
-- Seed Data - Default templates
-- ═══════════════════════════════════════════════════════════

-- DMLoG character templates
INSERT OR IGNORE INTO characters (id, user_id, product_domain, character_type, name, display_name, description, personality, backstory, is_template, is_public, created_at, updated_at, last_active_at) VALUES
    ('tpl_fighter', 'system', 'dmlog', 'player', 'Fighter', 'Fighter', 'A brave warrior skilled in combat.', '{"bravery": 0.8, "strength": 0.9}', 'A veteran of many battles.', 1, 1, 0, 0, 0),
    ('tpl_wizard', 'system', 'dmlog', 'player', 'Wizard', 'Wizard', 'A scholarly magic user with vast arcane knowledge.', '{"intelligence": 0.9, "curiosity": 0.8}', 'Trained at the Academy of Arcane Arts.', 1, 1, 0, 0, 0),
    ('tpl_rogue', 'system', 'dmlog', 'player', 'Rogue', 'Rogue', 'A stealthy trickster skilled in infiltration.', '{"dexterity": 0.9, "creativity": 0.8}', 'Grew up on the streets, learned to survive.', 1, 1, 0, 0, 0),
    ('tpl_cleric', 'system', 'dmlog', 'player', 'Cleric', 'Cleric', 'A divine spellcaster sworn to a deity.', '{"wisdom": 0.9, "kindness": 0.8}', 'Chosen by the gods to serve.', 1, 1, 0, 0, 0),
    ('tpl_dm', 'system', 'dmlog', 'dm_agent', 'Dungeon Master', 'Dungeon Master', 'An AI agent that runs TTRPG sessions.', '{"creativity": 0.9, "diplomacy": 0.8}', 'The narrator and referee of the game.', 1, 1, 0, 0, 0);

-- StudyLoG character templates
INSERT OR IGNORE INTO characters (id, user_id, product_domain, character_type, name, display_name, description, personality, learning_style, is_template, is_public, created_at, updated_at, last_active_at) VALUES
    ('tpl_tutor_math', 'system', 'studylog', 'tutor', 'Math Tutor', 'Math Tutor', 'An AI tutor specializing in mathematics.', '{"patience": 0.9, "encouragement": 0.8}', 'visual', 1, 1, 0, 0, 0),
    ('tpl_tutor_science', 'system', 'studylog', 'tutor', 'Science Tutor', 'Science Tutor', 'An AI tutor specializing in sciences.', '{"curiosity": 0.9, "creativity": 0.8}', 'kinesthetic', 1, 1, 0, 0, 0),
    ('tpl_tutor_coding', 'system', 'studylog', 'tutor', 'Coding Tutor', 'Coding Tutor', 'An AI tutor specializing in programming.', '{"persistence": 0.9, "logic": 0.9}', 'reading', 1, 1, 0, 0, 0);
