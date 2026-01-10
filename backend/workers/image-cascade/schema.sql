-- ═══════════════════════════════════════════════════════════════════════
-- Image Cascade Database Schema
-- ═══════════════════════════════════════════════════════════════════════
--
-- This schema extends the main StudyLoG.AI database with tables for
-- tracking image generation with cascade routing.
--
-- Features:
-- - Track all image generations with cost and latency
-- - Store prompt history for agent learning
-- - Monitor cost savings from cascade strategy
-- - Track provider performance and availability
--
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- Image Generations - Main tracking table
-- ═══════════════════════════════════════════════════════════════════════
-- Tracks every image generation request with full context for analytics
-- and cost tracking.

CREATE TABLE IF NOT EXISTS image_generations (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User information
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,

    -- Prompts
    prompt TEXT NOT NULL,              -- Original user prompt
    refined_prompt TEXT,               -- Agent-refined prompt (if used)
    negative_prompt TEXT,              -- Negative prompt (what to avoid)

    -- Generation parameters
    tier TEXT NOT NULL CHECK (tier IN ('draft', 'preview', 'final')),
    resolution TEXT DEFAULT '512x512',
    count INTEGER DEFAULT 1,

    -- Provider information
    provider TEXT NOT NULL,            -- cloudflare, zhipu, replicate, openai
    model TEXT NOT NULL,

    -- Results
    success INTEGER DEFAULT 0,         -- 1 = success, 0 = failure
    error_message TEXT,                -- Error details if failed

    -- Image URLs (stored in R2)
    image_urls TEXT DEFAULT '[]',      -- JSON array of image URLs

    -- Performance metrics
    cost REAL DEFAULT 0.0,             -- Actual cost in USD
    latency_ms INTEGER,                -- Generation time in milliseconds

    -- Agent information
    agent_used INTEGER DEFAULT 0,      -- 1 if agent crafted the prompt
    agent_type TEXT,                   -- captain, builder, teacher, artist
    agent_confidence REAL,             -- Agent's confidence score

    -- Cascade tracking
    parent_id TEXT REFERENCES image_generations(id) ON DELETE SET NULL,
    generation_chain TEXT,             -- JSON array of generation IDs in chain

    -- User feedback
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,

    -- Metadata
    ip_address TEXT,                   -- For abuse detection
    user_agent TEXT,

    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_image_gens_user ON image_generations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_gens_tier ON image_generations(tier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_gens_provider ON image_generations(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_gens_parent ON image_generations(parent_id);
CREATE INDEX IF NOT EXISTS idx_image_gens_success ON image_generations(success, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- Prompt History - For agent learning
-- ═══════════════════════════════════════════════════════════════════════
-- Stores detailed prompt history with results to help agents learn
-- which prompts work best for different scenarios.

CREATE TABLE IF NOT EXISTS image_prompt_history (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User information
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,

    -- Prompts
    original_input TEXT NOT NULL,      -- User's original input
    crafted_prompt TEXT NOT NULL,      -- Agent-crafted prompt
    negative_prompt TEXT,

    -- Agent information
    agent TEXT NOT NULL CHECK (agent IN ('captain', 'builder', 'teacher', 'artist')),

    -- Generation context
    tier TEXT NOT NULL CHECK (tier IN ('draft', 'preview', 'final')),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,

    -- Results
    success INTEGER DEFAULT 0,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,

    -- Agent metrics (for learning)
    confidence REAL,                   -- Agent's confidence in this prompt
    expected_improvement REAL,         -- Expected improvement over base prompt

    -- Tags for categorization
    tags TEXT DEFAULT '[]',            -- JSON array of tags

    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for learning queries
CREATE INDEX IF NOT EXISTS idx_prompt_hist_user ON image_prompt_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_hist_agent ON image_prompt_history(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_hist_success ON image_prompt_history(success, rating DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_hist_tags ON image_prompt_history(agent, success);

-- ═══════════════════════════════════════════════════════════════════════
-- Cascade Savings - Track cost savings from cascade approach
-- ═══════════════════════════════════════════════════════════════════════
-- Tracks the cost savings achieved by using the cascade approach
-- (draft → preview → final) vs generating all images at final quality.

CREATE TABLE IF NOT EXISTS cascade_savings (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User information
    user_id TEXT REFERENCES students(id) ON DELETE SET NULL,

    -- Generation chain
    chain_id TEXT NOT NULL,            -- Groups related generations
    final_generation_id TEXT REFERENCES image_generations(id) ON DELETE SET NULL,

    -- Cost breakdown
    draft_count INTEGER DEFAULT 0,
    draft_cost REAL DEFAULT 0.0,

    preview_count INTEGER DEFAULT 0,
    preview_cost REAL DEFAULT 0.0,

    final_count INTEGER DEFAULT 0,
    final_cost REAL DEFAULT 0.0,

    -- Savings calculation
    total_cost REAL DEFAULT 0.0,
    traditional_cost REAL DEFAULT 0.0, -- Cost if all were final quality
    savings_amount REAL DEFAULT 0.0,
    savings_percentage REAL DEFAULT 0.0,

    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_cascade_savings_user ON cascade_savings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cascade_savings_chain ON cascade_savings(chain_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Provider Metrics - Track provider performance
-- ═══════════════════════════════════════════════════════════════════════
-- Tracks performance metrics for each image generation provider
-- to help with routing decisions and cost optimization.

CREATE TABLE IF NOT EXISTS provider_metrics (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Provider information
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    tier TEXT NOT NULL CHECK (tier IN ('draft', 'preview', 'final')),

    -- Performance metrics (aggregated)
    total_generations INTEGER DEFAULT 0,
    successful_generations INTEGER DEFAULT 0,
    failed_generations INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0.0,

    -- Latency metrics
    avg_latency_ms REAL DEFAULT 0.0,
    min_latency_ms INTEGER,
    max_latency_ms INTEGER,

    -- Cost metrics
    total_cost REAL DEFAULT 0.0,
    avg_cost_per_image REAL DEFAULT 0.0,

    -- Time window
    date TEXT NOT NULL,                -- YYYY-MM-DD for daily aggregation
    hour INTEGER CHECK (hour BETWEEN 0 AND 23), -- Optional hourly breakdown

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(provider, model, tier, date, hour)
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_provider_metrics_provider ON provider_metrics(provider, date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_date ON provider_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_provider_metrics_success ON provider_metrics(success_rate DESC);

-- ═══════════════════════════════════════════════════════════════════════
-- User Quotas - Track daily usage limits
-- ═══════════════════════════════════════════════════════════════════════
-- Tracks daily image generation counts per user for quota enforcement.

CREATE TABLE IF NOT EXISTS image_user_quotas (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User information
    user_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,

    -- Quota limits
    daily_limit INTEGER DEFAULT 50,
    daily_count INTEGER DEFAULT 0,

    -- Usage by tier
    draft_count INTEGER DEFAULT 0,
    preview_count INTEGER DEFAULT 0,
    final_count INTEGER DEFAULT 0,

    -- Reset tracking
    last_reset_date TEXT DEFAULT (date('now')),

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for quota checks
CREATE INDEX IF NOT EXISTS idx_user_quotas_reset ON image_user_quotas(last_reset_date);

-- ═══════════════════════════════════════════════════════════════════════
-- Views for Analytics
-- ═══════════════════════════════════════════════════════════════════════

-- Daily cost summary per user
CREATE VIEW IF NOT EXISTS daily_image_costs AS
SELECT
    user_id,
    date(created_at) as date,
    tier,
    COUNT(*) as generations,
    SUM(cost) as total_cost,
    AVG(latency_ms) as avg_latency,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
FROM image_generations
WHERE user_id IS NOT NULL
GROUP BY user_id, date(created_at), tier
ORDER BY date DESC, total_cost DESC;

-- Provider performance summary
CREATE VIEW IF NOT EXISTS provider_performance AS
SELECT
    provider,
    model,
    tier,
    COUNT(*) as total_generations,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
    CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate,
    AVG(cost) as avg_cost,
    AVG(latency_ms) as avg_latency
FROM image_generations
GROUP BY provider, model, tier
ORDER BY success_rate DESC, avg_cost ASC;

-- Cascade savings summary
CREATE VIEW IF NOT EXISTS cascade_savings_summary AS
SELECT
    COUNT(*) as chains_analyzed,
    SUM(savings_amount) as total_saved,
    AVG(savings_percentage) as avg_savings_percent,
    SUM(traditional_cost) as total_traditional_cost,
    SUM(total_cost) as total_actual_cost
FROM cascade_savings;

-- ═══════════════════════════════════════════════════════════════════════
-- Triggers for Automatic Updates
-- ═══════════════════════════════════════════════════════════════════════

-- Update provider metrics when a new generation is recorded
CREATE TRIGGER IF NOT EXISTS update_provider_metrics_after_insert
AFTER INSERT ON image_generations
WHEN NEW.success = 1
BEGIN
    INSERT OR REPLACE INTO provider_metrics (
        id, provider, model, tier, total_generations, successful_generations,
        avg_latency_ms, total_cost, avg_cost_per_image, date, created_at, updated_at
    )
    SELECT
        lower(hex(randomblob(16))),
        NEW.provider,
        NEW.model,
        NEW.tier,
        COALESCE((SELECT total_generations FROM provider_metrics
                  WHERE provider = NEW.provider AND model = NEW.model
                  AND tier = NEW.tier AND date = date(NEW.created_at)), 0) + 1,
        COALESCE((SELECT successful_generations FROM provider_metrics
                  WHERE provider = NEW.provider AND model = NEW.model
                  AND tier = NEW.tier AND date = date(NEW.created_at)), 0) + 1,
        COALESCE((SELECT avg_latency_ms FROM provider_metrics
                  WHERE provider = NEW.provider AND model = NEW.model
                  AND tier = NEW.tier AND date = date(NEW.created_at)), 0) * 0.9 + NEW.latency_ms * 0.1,
        COALESCE((SELECT total_cost FROM provider_metrics
                  WHERE provider = NEW.provider AND model = NEW.model
                  AND tier = NEW.tier AND date = date(NEW.created_at)), 0) + NEW.cost,
        COALESCE((SELECT avg_cost_per_image FROM provider_metrics
                  WHERE provider = NEW.provider AND model = NEW.model
                  AND tier = NEW.tier AND date = date(NEW.created_at)), 0) * 0.9 + NEW.cost * 0.1,
        date(NEW.created_at),
        datetime('now'),
        datetime('now')
    WHERE provider = NEW.provider AND model = NEW.model AND tier = NEW.tier AND date = date(NEW.created_at);
END;

-- ═══════════════════════════════════════════════════════════════════════
-- Seed Data - Example queries and documentation
-- ═══════════════════════════════════════════════════════════════════════

-- Example: Find users exceeding their daily quota
-- SELECT user_id, daily_count, daily_limit
-- FROM image_user_quotas
-- WHERE daily_count >= daily_limit
-- ORDER BY daily_count DESC;

-- Example: Calculate cascade savings for a user
-- SELECT
--     user_id,
--     SUM(savings_amount) as total_saved,
--     AVG(savings_percentage) as avg_savings_percent
-- FROM cascade_savings
-- WHERE user_id = ?
-- GROUP BY user_id;

-- Example: Find most successful prompts by agent
-- SELECT
--     agent,
--     crafted_prompt,
--     AVG(CASE WHEN success = 1 THEN 1.0 ELSE 0.0 END) as success_rate,
--     AVG(rating) as avg_rating,
--     COUNT(*) as uses
-- FROM image_prompt_history
-- GROUP BY agent, crafted_prompt
-- HAVING uses >= 5
-- ORDER BY success_rate DESC, avg_rating DESC
-- LIMIT 20;
