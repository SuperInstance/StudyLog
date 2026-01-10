-- Enhanced Security Database Schema
-- D1 schema for audit logs, rate limiting, and security tracking

-- ============================================================================
-- Audit Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- authentication, authorization, data_access, security_event, etc.
  severity TEXT NOT NULL, -- info, warning, error, critical
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- user, service, admin
  actor_name TEXT,
  actor_ip TEXT,
  actor_ua TEXT,
  resource_type TEXT,
  resource_id TEXT,
  resource_name TEXT,
  tenant_id TEXT,
  outcome TEXT NOT NULL, -- success, failure
  details TEXT, -- JSON
  flags TEXT, -- JSON (sensitive, pii, elevated)
  correlation_id TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_audit_type (event_type),
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_tenant (tenant_id),
  INDEX idx_audit_severity (severity),
  INDEX idx_audit_timestamp (timestamp),
  INDEX idx_audit_outcome (outcome)
);

-- ============================================================================
-- Rate Limit Rules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key TEXT NOT NULL, -- Pattern for rate limit key
  limit INTEGER NOT NULL,
  window INTEGER NOT NULL, -- Time window in seconds
  block_duration INTEGER, -- Block duration after limit hit
  scope TEXT NOT NULL DEFAULT 'global', -- global, tenant, user
  action_type TEXT, -- JSON array of action types to limit
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_rate_limit_enabled (enabled)
);

-- ============================================================================
-- Rate Limit Tracking Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL,
  blocked_until INTEGER,

  INDEX idx_rate_limit_key (key),
  INDEX idx_rate_limit_window (window_start)
);

-- ============================================================================
-- Security Events Table (for high-priority incidents)
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_id TEXT,
  actor_ip TEXT,
  resource_type TEXT,
  resource_id TEXT,
  tenant_id TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, investigating, resolved, false_positive
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,

  INDEX idx_security_status (status),
  INDEX idx_security_severity (severity),
  INDEX idx_security_tenant (tenant_id)
);

-- ============================================================================
-- Blocked Requests Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocked_requests (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL, -- rate_limit, injection, blocked_ip, etc.
  actor_id TEXT,
  actor_ip TEXT NOT NULL,
  request_details TEXT, -- JSON (method, path, headers, body preview)
  tenant_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_blocked_ip (actor_ip),
  INDEX idx_blocked_tenant (tenant_id),
  INDEX idx_blocked_created (created_at)
);

-- ============================================================================
-- PII Detections Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS pii_detections (
  id TEXT PRIMARY KEY,
  pii_type TEXT NOT NULL,
  original_value TEXT NOT NULL,
  redacted_value TEXT NOT NULL,
  context TEXT, -- Where it was found (request body, prompt, etc.)
  tenant_id TEXT,
  user_id TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_pii_type (pii_type),
  INDEX idx_pii_tenant (tenant_id),
  INDEX idx_pii_detected (detected_at)
);

-- ============================================================================
-- Input Validation Failures Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS validation_failures (
  id TEXT PRIMARY KEY,
  field_name TEXT NOT NULL,
  field_value TEXT,
  error_message TEXT NOT NULL,
  schema_name TEXT,
  user_id TEXT,
  tenant_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_validation_field (field_name),
  INDEX idx_validation_tenant (tenant_id)
);

-- ============================================================================
-- API Keys Table (for tracking and rotation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the key
  name TEXT NOT NULL,
  scopes TEXT NOT NULL, -- JSON array of scopes
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  last_used TEXT,
  expires_at TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_api_key_user (user_id),
  INDEX idx_api_key_hash (key_hash),
  INDEX idx_api_key_tenant (tenant_id)
);
