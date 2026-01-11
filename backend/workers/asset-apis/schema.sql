-- Asset Registry Database Schema for SuperInstance.AI
-- Stores metadata for all generated 3D models, audio, and 2D assets

-- Assets table: Unified storage for all asset types
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('3d_model', 'audio', '2d_art', 'texture', 'animation', 'environment')),
    provider TEXT NOT NULL CHECK(provider IN (
        'hunyuan', 'sloyd', 'masterpiece_x', 'tripo', 'rodin', 'meshy',
        'elevenlabs', 'audio2face', 'rosebud', 'leonardo', 'scenario',
        'user_upload', 'cached'
    )),
    product_context TEXT CHECK(product_context IN ('studylog', 'dmlog', 'makerlog', 'fishinglog', 'general')),
    original_prompt TEXT NOT NULL,
    generation_params TEXT, -- JSON string of parameters used
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    parent_asset_id TEXT, -- For derived assets
    cost_cents INTEGER DEFAULT 0,
    api_request_id TEXT,
    error_message TEXT
);

-- Asset metadata for 3D models
CREATE TABLE IF NOT EXISTS asset_3d_metadata (
    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    format TEXT CHECK(format IN ('glb', 'gltf', 'fbx', 'obj', 'usd', 'usdz')),
    polygon_count INTEGER,
    vertex_count INTEGER,
    texture_count INTEGER,
    has_rigging BOOLEAN DEFAULT 0,
    has_animation BOOLEAN DEFAULT 0,
    has_uv_unwrapping BOOLEAN DEFAULT 0,
    lod_levels INTEGER DEFAULT 1,
    bounding_box TEXT, -- JSON: {min: [x,y,z], max: [x,y,z]}
    file_size_bytes INTEGER,
    preview_image_url TEXT,
    godot_compatible BOOLEAN DEFAULT 1,
    theia_metadata TEXT -- JSON for Theia IDE integration
);

-- Asset metadata for audio
CREATE TABLE IF NOT EXISTS asset_audio_metadata (
    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    format TEXT CHECK(format IN ('mp3', 'wav', 'ogg', 'aac', 'flac')),
    duration_seconds REAL,
    sample_rate INTEGER,
    bitrate INTEGER,
    channels INTEGER DEFAULT 1,
    voice_id TEXT,
    is_voice_design BOOLEAN DEFAULT 0,
    has_lip_sync BOOLEAN DEFAULT 0,
    transcript TEXT,
    emotion_tags TEXT, -- JSON array
    file_size_bytes INTEGER,
    preview_url TEXT
);

-- Asset metadata for 2D art
CREATE TABLE IF NOT EXISTS asset_2d_metadata (
    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    format TEXT CHECK(format IN ('png', 'jpg', 'webp', 'svg', 'gif')),
    width INTEGER,
    height INTEGER,
    is_sprite_sheet BOOLEAN DEFAULT 0,
    sprite_columns INTEGER,
    sprite_rows INTEGER,
    frames_per_second INTEGER,
    style_model_id TEXT,
    alpha_channel BOOLEAN DEFAULT 0,
    file_size_bytes INTEGER,
    color_palette TEXT, -- JSON array of hex colors
    godot_import_type TEXT -- 'Texture2D', 'CompressedTexture2D', etc.
);

-- Environment metadata for HY-World large scenes
CREATE TABLE IF NOT EXISTS asset_environment_metadata (
    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    scene_type TEXT CHECK(scene_type IN ('terrain', 'building', 'city', 'nature', 'dungeon', 'interior')),
    area_square_units REAL,
    object_count INTEGER,
    navmesh_generated BOOLEAN DEFAULT 0,
    collision_baked BOOLEAN DEFAULT 0,
    lighting_baked BOOLEAN DEFAULT 0,
    occlusion_culling BOOLEAN DEFAULT 0,
    lod_distance REAL,
    godot_scene_path TEXT,
    import_settings TEXT -- JSON
);

-- Storage locations for actual files
CREATE TABLE IF NOT EXISTS asset_storage (
    asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    storage_type TEXT CHECK(storage_type IN ('r2', 's3', 'local', 'external_url')),
    bucket_name TEXT,
    file_path TEXT,
    cdn_url TEXT,
    direct_download_url TEXT,
    hash_sha256 TEXT,
    hash_md5 TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tagging system
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT CHECK(category IN ('style', 'subject', 'use_case', 'product', 'era', 'mood')),
    color TEXT DEFAULT '#888888',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS asset_tags (
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
    confidence REAL DEFAULT 1.0,
    PRIMARY KEY (asset_id, tag_id)
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS asset_usage (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    session_id TEXT,
    user_id TEXT,
    project_id TEXT,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    usage_type TEXT CHECK(usage_type IN ('preview', 'export', 'import_godot', 'download'))
);

-- Generation queue
CREATE TABLE IF NOT EXISTS generation_queue (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 5 CHECK(priority BETWEEN 1 AND 10),
    status TEXT DEFAULT 'queued' CHECK(status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    worker_id TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_log TEXT
);

-- Cost tracking per provider
CREATE TABLE IF NOT EXISTS provider_costs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    cost_usd REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    asset_count INTEGER DEFAULT 1,
    tracked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API credentials management (encrypted in production)
CREATE TABLE IF NOT EXISTS provider_credentials (
    provider TEXT PRIMARY KEY,
    api_key_encrypted TEXT NOT NULL,
    api_endpoint TEXT,
    rate_limit_per_minute INTEGER DEFAULT 60,
    rate_limit_per_day INTEGER DEFAULT 1000,
    tier TEXT CHECK(tier IN ('free', 'basic', 'pro', 'enterprise')),
    monthly_quota INTEGER,
    current_usage INTEGER DEFAULT 0,
    resets_at DATETIME,
    last_verified DATETIME
);

-- Cache invalidation tracking
CREATE TABLE IF NOT EXISTS cache_invalidation (
    id TEXT PRIMARY KEY,
    asset_id TEXT REFERENCES assets(id) ON DELETE CASCADE,
    reason TEXT CHECK(reason IN ('expired', 'policy_update', 'user_request', 'error', 'quota_exceeded')),
    invalidated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    triggered_by TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_provider ON assets(provider);
CREATE INDEX IF NOT EXISTS idx_assets_product_context ON assets(product_context);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_generation_queue_queued_at ON generation_queue(queued_at);
CREATE INDEX IF NOT EXISTS idx_asset_usage_asset_id ON asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_used_at ON asset_usage(used_at);
CREATE INDEX IF NOT EXISTS idx_provider_costs_provider ON provider_costs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_costs_tracked_at ON provider_costs(tracked_at);

-- Full-text search indexes
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    id, original_prompt, error_message,
    content='assets',
    content_rowid='rowid'
);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_assets_timestamp
AFTER UPDATE ON assets
BEGIN
    UPDATE assets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Triggers for FTS sync
CREATE TRIGGER IF NOT EXISTS assets_fts_insert AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, id, original_prompt, error_message)
    VALUES (NEW.rowid, NEW.id, NEW.original_prompt, NEW.error_message);
END;

CREATE TRIGGER IF NOT EXISTS assets_fts_delete AFTER DELETE ON assets BEGIN
    DELETE FROM assets_fts WHERE rowid = OLD.rowid;
END;

CREATE TRIGGER IF NOT EXISTS assets_fts_update AFTER UPDATE ON assets BEGIN
    UPDATE assets_fts SET original_prompt = NEW.original_prompt, error_message = NEW.error_message
    WHERE rowid = NEW.rowid;
END;
