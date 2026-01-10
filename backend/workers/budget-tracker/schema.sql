-- Budget Tracker Schema
-- D1 (SQLite) compatible
--
-- This schema defines tables for tracking daily API usage budgets across
-- multiple free-tier providers. The system maximizes free-tier usage while
-- preventing overage charges.
--
-- ## How Budget Checks Optimize Free-Tier Usage
--
-- The pre-call budget check (`provider_budgets` table) works as follows:
--
-- 1. **Before API Call**: Multi-model-router checks budget-tracker:
--    - Queries provider_budgets for remaining balance
--    - Compares estimated cost vs remaining budget
--    - Returns allow/deny with alternative provider suggestion
--
-- 2. **Cost Estimation**: Uses provider pricing to estimate request cost:
--    - OpenAI GPT-4o: ~$2.50/M input, $10/M output
--    - Grok (X.ai): ~$5/M input, $15/M output
--    - DeepSeek: ~$0.14/M input, $0.28/output (cheapest!)
--
-- 3. **Provider Rotation**: When budget exhausted:
--    - Automatically switches to next provider with available budget
--    - Prioritizes by: remaining % > priority > pinned status
--
-- ## The Fill Knowledge Strategy
--
-- When a provider's free tier is nearly exhausted (>90% used):
--
-- 1. **Switch Provider**: Route to next available free-tier provider
-- 2. **Queue Tasks**: Schedule "fill knowledge" tasks for end-of-day
-- 3. **Use Remaining**: Tasks use last 5-10% for:
--    - Generating embeddings for semantic search
--    - Warming response cache for common queries
--    - Creating training data for fine-tuning
--    - Summarizing documents for faster retrieval
-- 4. **Next Day**: Start fresh with renewed free tier
--
-- This ensures every bit of free tier is used productively, with the
-- knowledge base benefits carrying forward to reduce future costs.

-- ═══════════════════════════════════════════════════════════
-- Provider Budgets - User's API keys and daily limits
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS provider_budgets (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User who owns this budget config
    user_id TEXT NOT NULL,

    -- Provider being configured (openai, xai, qwen, google, etc.)
    provider_id TEXT NOT NULL CHECK (provider_id IN (
        'openai', 'xai', 'qwen', 'google', 'anthropic',
        'deepseek', 'zhipu', 'nvidia', 'ollama', 'deepinfra',
        'replicate', 'elevenlabs', 'custom'
    )),

    -- User's API key for this provider (should be encrypted in production)
    api_key TEXT NOT NULL,

    -- Daily budget limit in USD (0 for unlimited)
    daily_limit REAL NOT NULL DEFAULT 0.0,

    -- Amount used today in USD
    daily_used REAL NOT NULL DEFAULT 0.0,

    -- Alternative: Track by tokens for some providers
    tokens_used INTEGER DEFAULT 0,

    -- Token limit (if tracking by tokens instead of USD)
    token_limit INTEGER DEFAULT NULL,

    -- When the daily budget resets (ISO 8601 datetime)
    reset_time TEXT NOT NULL,

    -- Reset schedule: daily, weekly, monthly, rolling, one-time, never
    reset_schedule TEXT NOT NULL DEFAULT 'daily' CHECK (reset_schedule IN (
        'daily', 'weekly', 'monthly', 'rolling', 'one-time', 'never'
    )),

    -- Alert threshold (0-100): Alert when usage exceeds this % of limit
    alert_threshold INTEGER NOT NULL DEFAULT 90 CHECK (alert_threshold BETWEEN 0 AND 100),

    -- Budget mode: conservative, balanced, aggressive, unlimited
    mode TEXT NOT NULL DEFAULT 'balanced' CHECK (mode IN (
        'conservative', 'balanced', 'aggressive', 'unlimited'
    )),

    -- Provider priority in rotation (1 = highest, 10 = lowest)
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

    -- Whether this provider is currently enabled
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),

    -- Whether user has pinned this provider (always prefer)
    pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),

    -- Custom provider endpoint URL (for 'custom' provider type)
    custom_endpoint TEXT,

    -- Audit timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Ensure one budget config per user per provider
    UNIQUE(user_id, provider_id)
);

-- Indexes for common queries
CREATE INDEX idx_provider_budgets_user ON provider_budgets(user_id);
CREATE INDEX idx_provider_budgets_provider ON provider_budgets(provider_id);
CREATE INDEX idx_provider_budgets_enabled ON provider_budgets(enabled, priority);
CREATE INDEX idx_provider_budgets_reset ON provider_budgets(reset_time);

-- ═══════════════════════════════════════════════════════════
-- Usage Records - Track each API call for accurate budgeting
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS usage_records (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User who made the request
    user_id TEXT NOT NULL,

    -- Provider that was used
    provider_id TEXT NOT NULL,

    -- Model that was called (e.g., 'gpt-4o', 'grok-beta')
    model TEXT NOT NULL,

    -- Number of input tokens consumed
    input_tokens INTEGER NOT NULL DEFAULT 0,

    -- Number of output tokens consumed
    output_tokens INTEGER NOT NULL DEFAULT 0,

    -- Total cost in USD
    cost REAL NOT NULL DEFAULT 0.0,

    -- Request duration in milliseconds
    latency_ms INTEGER DEFAULT 0,

    -- Whether the request succeeded
    success INTEGER NOT NULL DEFAULT 1 CHECK (success IN (0, 1)),

    -- Error message if request failed
    error_message TEXT,

    -- Context/feature that triggered this request
    context TEXT,

    -- Timestamp of the API call
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for analytics and billing queries
CREATE INDEX idx_usage_records_user ON usage_records(user_id, timestamp DESC);
CREATE INDEX idx_usage_records_provider ON usage_records(provider_id, timestamp DESC);
CREATE INDEX idx_usage_records_date ON usage_records(date(timestamp));
CREATE INDEX idx_usage_records_success ON usage_records(success, timestamp DESC);

-- ═══════════════════════════════════════════════════════════
-- Budget Alerts - History of budget limit alerts
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS budget_alerts (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User who received the alert
    user_id TEXT NOT NULL,

    -- Provider that triggered the alert
    provider_id TEXT NOT NULL,

    -- Alert type: info, warning, critical
    alert_type TEXT NOT NULL DEFAULT 'warning' CHECK (alert_type IN ('info', 'warning', 'critical')),

    -- Current usage percentage when alert was triggered
    usage_percent REAL NOT NULL,

    -- Alert threshold that was triggered
    threshold INTEGER NOT NULL,

    -- Alert message
    message TEXT NOT NULL,

    -- Whether the alert was dismissed by user
    dismissed INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),

    -- Timestamp when alert was triggered
    triggered_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Timestamp when alert was dismissed
    dismissed_at TEXT
);

CREATE INDEX idx_budget_alerts_user ON budget_alerts(user_id, triggered_at DESC);
CREATE INDEX idx_budget_alerts_provider ON budget_alerts(provider_id, triggered_at DESC);
CREATE INDEX idx_budget_alerts_dismissed ON budget_alerts(dismissed, triggered_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Fill Knowledge Tasks - End-of-day knowledge expansion tasks
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fill_knowledge_tasks (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User who queued this task
    user_id TEXT NOT NULL,

    -- Provider to use for processing
    provider_id TEXT NOT NULL,

    -- Task type
    task_type TEXT NOT NULL CHECK (task_type IN (
        'embedding',       -- Generate embeddings for knowledge base
        'cache-warm',      -- Warm up response cache
        'training-data',   -- Generate training data
        'summarization',   -- Summarize documents
        'classification',  -- Classify content
        'custom'           -- Custom knowledge task
    )),

    -- Task priority (1 = highest)
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

    -- Estimated cost to complete
    estimated_cost REAL NOT NULL DEFAULT 0.0,

    -- Task parameters (JSON blob)
    parameters TEXT NOT NULL DEFAULT '{}',

    -- Task status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled'
    )),

    -- Number of retry attempts
    retry_count INTEGER NOT NULL DEFAULT 0,

    -- Maximum retries allowed
    max_retries INTEGER NOT NULL DEFAULT 3,

    -- Actual cost when completed
    actual_cost REAL DEFAULT NULL,

    -- Result data (JSON blob)
    result TEXT DEFAULT NULL,

    -- Error message if failed
    error_message TEXT DEFAULT NULL,

    -- When to schedule this task (ISO 8601)
    scheduled_for TEXT NOT NULL,

    -- When task started execution
    started_at TEXT DEFAULT NULL,

    -- When task completed or failed
    completed_at TEXT DEFAULT NULL,

    -- Audit timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_fill_knowledge_user ON fill_knowledge_tasks(user_id, status, priority);
CREATE INDEX idx_fill_knowledge_scheduled ON fill_knowledge_tasks(scheduled_for, status);
CREATE INDEX idx_fill_knowledge_provider ON fill_knowledge_tasks(provider_id, status);
CREATE INDEX idx_fill_knowledge_status ON fill_knowledge_tasks(status, scheduled_for);

-- ═══════════════════════════════════════════════════════════
-- Provider Pricing Cache - Cached pricing information
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS provider_pricing (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- Provider identifier
    provider_id TEXT NOT NULL,

    -- Model name
    model TEXT NOT NULL,

    -- Cost per 1M input tokens (USD)
    input_cost_per_million REAL NOT NULL DEFAULT 0.0,

    -- Cost per 1M output tokens (USD)
    output_cost_per_million REAL NOT NULL DEFAULT 0.0,

    -- Whether provider has free tier
    has_free_tier INTEGER NOT NULL DEFAULT 0 CHECK (has_free_tier IN (0, 1)),

    -- Free tier daily limit (USD)
    free_tier_daily_limit REAL DEFAULT NULL,

    -- Free tier reset schedule
    free_tier_reset_schedule TEXT DEFAULT NULL,

    -- Data source (e.g., 'provider', 'user', 'estimated')
    data_source TEXT NOT NULL DEFAULT 'provider',

    -- Last updated timestamp
    last_updated TEXT NOT NULL DEFAULT (datetime('now')),

    -- Unique constraint
    UNIQUE(provider_id, model)
);

CREATE INDEX idx_provider_pricing_lookup ON provider_pricing(provider_id, model);

-- Insert default pricing data (as of 2025)
INSERT OR IGNORE INTO provider_pricing (id, provider_id, model, input_cost_per_million, output_cost_per_million, has_free_tier, free_tier_daily_limit, free_tier_reset_schedule) VALUES
    -- OpenAI
    ('pricing-openai-gpt4o', 'openai', 'gpt-4o', 2.50, 10.00, 1, 5.00, 'monthly'),
    ('pricing-openai-gpt4o-mini', 'openai', 'gpt-4o-mini', 0.15, 0.60, 1, 5.00, 'monthly'),
    ('pricing-openai-gpt35', 'openai', 'gpt-3.5-turbo', 0.50, 1.50, 1, 5.00, 'monthly'),

    -- X.ai (Grok)
    ('pricing-xai-grok', 'xai', 'grok-beta', 5.00, 15.00, 1, 0.50, 'daily'),

    -- Qwen (Alibaba)
    ('pricing-qwen-max', 'qwen', 'qwen-max', 1.00, 2.00, 1, 1.00, 'daily'),
    ('pricing-qwen-plus', 'qwen', 'qwen-plus', 0.40, 0.80, 1, 1.00, 'daily'),

    -- Google
    ('pricing-google-gemini-pro', 'google', 'gemini-1.5-pro', 1.25, 5.00, 1, 10.00, 'monthly'),
    ('pricing-google-gemini-flash', 'google', 'gemini-1.5-flash', 0.075, 0.30, 1, 10.00, 'monthly'),

    -- Anthropic
    ('pricing-anthropic-sonnet', 'anthropic', 'claude-3-5-sonnet', 3.00, 15.00, 1, 5.00, 'monthly'),
    ('pricing-anthropic-haiku', 'anthropic', 'claude-3-5-haiku', 0.80, 4.00, 1, 5.00, 'monthly'),
    ('pricing-anthropic-opus', 'anthropic', 'claude-3-opus', 15.00, 75.00, 1, 5.00, 'monthly'),

    -- DeepSeek (ultra-low cost!)
    ('pricing-deepseek-chat', 'deepseek', 'deepseek-chat', 0.14, 0.28, 1, 0.50, 'daily'),
    ('pricing-deepseek-coder', 'deepseek', 'deepseek-coder', 0.14, 0.28, 1, 0.50, 'daily'),
    ('pricing-deepseek-reasoner', 'deepseek', 'deepseek-reasoner', 0.55, 2.19, 1, 0.50, 'daily'),

    -- Zhipu AI (GLM models)
    ('pricing-zhipu-flash', 'zhipu', 'glm-4-flash', 0.01, 0.01, 1, 1.00, 'daily'),
    ('pricing-zhipu-45', 'zhipu', 'glm-4.5', 0.05, 0.05, 1, 1.00, 'daily'),
    ('pricing-zhipu-47', 'zhipu', 'glm-4.7', 0.08, 0.30, 1, 1.00, 'daily'),

    -- NVIDIA
    ('pricing-nvidia-llama', 'nvidia', 'llama-3.1-405b', 0.40, 0.40, 1, 2.00, 'monthly'),
    ('pricing-nvidia-nemotron', 'nvidia', 'nemotron-4-340b', 0.40, 0.40, 1, 2.00, 'monthly'),

    -- DeepInfra
    ('pricing-deepinfra-llama', 'deepinfra', 'meta-llama-3.1-405b', 0.10, 0.10, 1, 1.00, 'daily'),

    -- Ollama (local, always free)
    ('pricing-ollama-local', 'ollama', '*', 0.0, 0.0, 1, NULL, 'never');

-- ═══════════════════════════════════════════════════════════
-- Daily Summaries - Aggregated daily usage per user
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_summaries (
    -- Composite primary key: user + date
    user_id TEXT NOT NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD format

    -- Total spent across all providers (USD)
    total_spent REAL NOT NULL DEFAULT 0.0,

    -- Total budget across all providers (USD)
    total_budget REAL NOT NULL DEFAULT 0.0,

    -- Budget utilization percentage
    utilization_percent REAL NOT NULL DEFAULT 0.0,

    -- Number of API calls made
    total_calls INTEGER NOT NULL DEFAULT 0,

    -- Total tokens consumed
    total_tokens INTEGER NOT NULL DEFAULT 0,

    -- Number of alerts triggered
    alert_count INTEGER NOT NULL DEFAULT 0,

    -- Number of fill-knowledge tasks completed
    fill_tasks_completed INTEGER NOT NULL DEFAULT 0,

    -- Timestamp of last update
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    PRIMARY KEY (user_id, date)
);

CREATE INDEX idx_daily_summaries_date ON daily_summaries(date DESC);
CREATE INDEX idx_daily_summaries_utilization ON daily_summaries(utilization_percent DESC);

-- ═══════════════════════════════════════════════════════════
-- Provider Rotation History - Track provider switching decisions
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS provider_rotation_history (
    -- Primary key
    id TEXT PRIMARY KEY,

    -- User who experienced the rotation
    user_id TEXT NOT NULL,

    -- Original provider that was requested
    from_provider TEXT NOT NULL,

    -- New provider that was used instead
    to_provider TEXT NOT NULL,

    -- Reason for rotation (budget_exceeded, alert, error, manual)
    reason TEXT NOT NULL,

    -- Remaining budget on from_provider at time of rotation
    from_remaining REAL DEFAULT NULL,

    -- Estimated cost savings from rotation
    estimated_savings REAL DEFAULT NULL,

    -- Context of the request that triggered rotation
    request_context TEXT,

    -- Timestamp of rotation decision
    rotated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rotation_user ON provider_rotation_history(user_id, rotated_at DESC);
CREATE INDEX idx_rotation_from ON provider_rotation_history(from_provider, rotated_at DESC);
CREATE INDEX idx_rotation_reason ON provider_rotation_history(reason, rotated_at DESC);

-- ═══════════════════════════════════════════════════════════
-- Views for Common Queries
-- ═══════════════════════════════════════════════════════════

-- Current budget status for all users
CREATE VIEW IF NOT EXISTS v_current_budget_status AS
SELECT
    user_id,
    provider_id,
    daily_limit,
    daily_used,
    ROUND((daily_used / daily_limit) * 100, 2) as usage_percent,
    daily_limit - daily_used as remaining,
    reset_time,
    enabled,
    priority,
    pinned
FROM provider_budgets
WHERE enabled = 1;

-- Today's usage by provider
CREATE VIEW IF NOT EXISTS v_today_usage_by_provider AS
SELECT
    user_id,
    provider_id,
    COUNT(*) as call_count,
    SUM(input_tokens + output_tokens) as total_tokens,
    SUM(cost) as total_cost,
    AVG(latency_ms) as avg_latency_ms,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count
FROM usage_records
WHERE date(timestamp) = date('now')
GROUP BY user_id, provider_id;

-- Providers nearing budget limits
CREATE VIEW IF NOT EXISTS v_providers_near_limit AS
SELECT
    pb.user_id,
    pb.provider_id,
    pb.daily_limit,
    pb.daily_used,
    pb.alert_threshold,
    ROUND((pb.daily_used / pb.daily_limit) * 100, 2) as usage_percent,
    CASE
        WHEN pb.daily_used >= pb.daily_limit THEN 'exceeded'
        WHEN (pb.daily_used / pb.daily_limit) * 100 >= pb.alert_threshold THEN 'near_limit'
        ELSE 'ok'
    END as status
FROM provider_budgets pb
WHERE pb.enabled = 1
  AND pb.daily_limit > 0
ORDER BY (pb.daily_used / pb.daily_limit) DESC;
