-- Observability Database Schema
-- D1 schema for logging, metrics, and health checks

-- ============================================================================
-- Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL, -- debug, info, warn, error, fatal
  message TEXT NOT NULL,
  context TEXT, -- JSON (service, environment, tenant_id, user_id, request)
  metadata TEXT, -- JSON (additional fields)
  error TEXT, -- JSON (name, message, stack, code)
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  service TEXT NOT NULL,
  request_id TEXT,
  trace_id TEXT,
  span_id TEXT,

  INDEX idx_logs_level (level),
  INDEX idx_logs_timestamp (timestamp),
  INDEX idx_logs_service (service),
  INDEX idx_logs_request (request_id),
  INDEX idx_logs_trace (trace_id)
);

-- ============================================================================
-- Metric Aggregates Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS metric_aggregates (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  labels TEXT NOT NULL, -- JSON
  count INTEGER NOT NULL,
  sum REAL NOT NULL,
  min REAL NOT NULL,
  max REAL NOT NULL,
  timestamp INTEGER NOT NULL, -- Unix milliseconds

  INDEX idx_metrics_name (metric_name),
  INDEX idx_metrics_timestamp (timestamp)
);

-- ============================================================================
-- Health Check History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  component TEXT NOT NULL,
  status TEXT NOT NULL, -- healthy, degraded, unhealthy
  response_time_ms INTEGER,
  error TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_health_component (component),
  INDEX idx_health_timestamp (timestamp)
);

-- ============================================================================
-- Alerts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL, -- info, warning, error, critical
  status TEXT NOT NULL DEFAULT 'active', -- active, acknowledged, resolved
  message TEXT NOT NULL,
  value REAL,
  labels TEXT, -- JSON
  fired_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  acknowledged_by TEXT,
  acknowledged_at TEXT,

  INDEX idx_alerts_status (status),
  INDEX idx_alerts_severity (severity),
  INDEX idx_alerts_fired (fired_at)
);

-- ============================================================================
-- Alert Rules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL, -- gt, lt, gte, lte, eq
  threshold REAL NOT NULL,
  duration_seconds INTEGER NOT NULL,
  severity TEXT NOT NULL,
  labels TEXT, -- JSON filter
  notifications TEXT, -- JSON array of channel IDs
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- Traces Table (for distributed tracing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_span_id TEXT,
  operation_name TEXT NOT NULL,
  service TEXT NOT NULL,
  start_time INTEGER NOT NULL, -- Unix nanoseconds
  duration INTEGER NOT NULL, -- Nanoseconds
  status TEXT NOT NULL, -- ok, error, cancelled
  tags TEXT, -- JSON
  logs TEXT, -- JSON array
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),

  INDEX idx_traces_trace_id (trace_id),
  INDEX idx_traces_service (service),
  INDEX idx_traces_timestamp (timestamp)
);
