-- Multi-Tenant Database Schema
-- D1 schema for tenant isolation and management

-- ============================================================================
-- Tenants Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisioning', -- provisioning, active, suspended, archived, deleted
  tier TEXT NOT NULL DEFAULT 'personal', -- personal, classroom, school, district, enterprise
  custom_domain TEXT UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  max_users INTEGER NOT NULL,
  current_users INTEGER NOT NULL DEFAULT 0,
  limits TEXT NOT NULL, -- JSON
  theme TEXT, -- JSON
  config TEXT NOT NULL, -- JSON
  billing TEXT, -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  suspended_at TEXT,

  INDEX idx_tenants_status (status),
  INDEX idx_tenants_subdomain (subdomain),
  INDEX idx_tenants_custom_domain (custom_domain)
);

-- ============================================================================
-- Tenant Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL, -- owner, admin, teacher, student, viewer
  is_primary INTEGER NOT NULL DEFAULT 0, -- Is this the user's primary tenant?
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, pending
  profile TEXT, -- JSON (display_name, avatar, bio)
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE(tenant_id, user_id),
  INDEX idx_tenant_users_tenant (tenant_id),
  INDEX idx_tenant_users_user (user_id),
  INDEX idx_tenant_users_role (role)
);

-- ============================================================================
-- API Usage Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_api_usage_tenant (tenant_id, timestamp),
  INDEX idx_api_usage_date (DATE(timestamp))
);

-- ============================================================================
-- AI Usage Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_ai_usage_tenant (tenant_id, timestamp),
  INDEX idx_ai_usage_month (tenant_id, DATE(timestamp))
);

-- ============================================================================
-- Tenant Assets Table (for R2 tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  asset_type TEXT NOT NULL, -- logo, icon, background, etc.
  filename TEXT NOT NULL,
  size INTEGER NOT NULL, -- bytes
  r2_key TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_tenant_assets_tenant (tenant_id),
  INDEX idx_tenant_assets_type (asset_type)
);

-- ============================================================================
-- Tenant Settings History (for audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_settings_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  setting_type TEXT NOT NULL, -- config, theme, limits, billing
  old_value TEXT, -- JSON
  new_value TEXT, -- JSON
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_settings_history_tenant (tenant_id, timestamp)
);

-- ============================================================================
-- Tenant Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, expired
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_invitations_tenant (tenant_id),
  INDEX idx_invitations_email (email),
  INDEX idx_invitations_status (status)
);
