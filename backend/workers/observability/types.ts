/**
 * Observability Types
 *
 * Complete type definitions for monitoring, logging,
 * distributed tracing, and metrics collection.
 */

// ============================================================================
// Log Types
// ============================================================================

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log entry
 */
export interface LogEntry {
  /**
   * Log level
   */
  level: LogLevel;

  /**
   * Log message
   */
  message: string;

  /**
   * Timestamp (ISO 8601)
   */
  timestamp: string;

  /**
   * Log context
   */
  context?: LogContext;

  /**
   * Error details (if error log)
   */
  error?: LogError;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * Request ID for correlation
   */
  requestId?: string;

  /**
   * Trace ID for distributed tracing
   */
  traceId?: string;

  /**
   * Span ID for distributed tracing
   */
  spanId?: string;
}

/**
 * Log context
 */
export interface LogContext {
  /**
   * Service name
   */
  service: string;

  /**
   * Environment
   */
  environment: string;

  /**
   * Tenant ID
   */
  tenantId?: string;

  /**
   * User ID
   */
  userId?: string;

  /**
   * Request path/method
   */
  request?: {
    method: string;
    path: string;
    ip?: string;
  };
}

/**
 * Error details in log
 */
export interface LogError {
  /**
   * Error name/type
   */
  name: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Stack trace
   */
  stack?: string;

  /**
   * Error code
   */
  code?: string;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Metric type
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Metric data
 */
export interface Metric {
  /**
   * Metric name
   */
  name: string;

  /**
   * Metric type
   */
  type: MetricType;

  /**
   * Metric value
   */
  value: number;

  /**
   * Labels/dimensions
   */
  labels?: Record<string, string>;

  /**
   * Timestamp (Unix milliseconds)
   */
  timestamp: number;

  /**
   * Unit
   */
  unit?: string;

  /**
   * Description
   */
  description?: string;
}

/**
 * Histogram bucket
 */
export interface HistogramBucket {
  /**
   * Upper bound
   */
  le: string;

  /**
   * Count
   */
  count: number;
}

/**
 * Histogram metric (for distributions)
 */
export interface HistogramMetric extends Metric {
  type: 'histogram';

  /**
   * Sum of all values
   */
  sum: number;

  /**
   * Count of observations
   */
  count: number;

  /**
   * Buckets
   */
  buckets: HistogramBucket[];
}

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Span status
 */
export type SpanStatus = 'ok' | 'error' | 'cancelled';

/**
 * Trace span
 */
export interface Span {
  /**
   * Unique span ID
   */
  id: string;

  /**
   * Parent span ID (if nested)
   */
  parentId?: string;

  /**
   * Trace ID (groups related spans)
   */
  traceId: string;

  /**
   * Operation name
   */
  name: string;

  /**
   * Service that generated the span
   */
  service: string;

  /**
   * Span start time (Unix nanoseconds)
   */
  startTime: number;

  /**
   * Span duration (nanoseconds)
   */
  duration: number;

  /**
   * Span status
   */
  status: SpanStatus;

  /**
   * Tags/attributes
   */
  tags: Record<string, string | number | boolean>;

  /**
   * Log events within span
   */
  logs?: SpanLog[];

  /**
   * Links to other traces
   */
  links?: SpanLink[];
}

/**
 * Log event within a span
 */
export interface SpanLog {
  /**
   * Log timestamp (Unix nanoseconds)
   */
  timestamp: number;

  /**
   * Log fields
   */
  fields: Record<string, unknown>;
}

/**
 * Link to another span/trace
 */
export interface SpanLink {
  /**
   * Linked trace ID
   */
  traceId: string;

  /**
   * Linked span ID
   */
  spanId: string;

  /**
   * Link attributes
   */
  attributes?: Record<string, unknown>;
}

/**
 * Trace (collection of spans)
 */
export interface Trace {
  /**
   * Trace ID
   */
  id: string;

  /**
   * Root span ID
   */
  rootSpanId: string;

  /**
   * All spans in trace
   */
  spans: Span[];

  /**
   * Trace start time
   */
  startTime: number;

  /**
   * Trace duration
   */
  duration: number;

  /**
   * Services involved
   */
  services: string[];
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check result
 */
export interface HealthCheck {
  /**
   * Overall status
   */
  status: HealthStatus;

  /**
   * Service version
   */
  version?: string;

  /**
   * Check timestamp
   */
  timestamp: string;

  /**
   * Individual component checks
   */
  checks: Record<string, ComponentHealth>;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Component health check
 */
export interface ComponentHealth {
  /**
   * Component status
   */
  status: HealthStatus;

  /**
   * Response time in milliseconds
   */
  responseTime?: number;

  /**
   * Error message (if unhealthy)
   */
  error?: string;

  /**
   * Last check timestamp
   */
  checkedAt: string;

  /**
   * Additional details
   */
  details?: Record<string, unknown>;
}

// ============================================================================
// Alert Types
// ============================================================================

/**
 * Alert severity
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert status
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

/**
 * Alert condition
 */
export interface AlertCondition {
  /**
   * Metric name to monitor
   */
  metric: string;

  /**
   * Comparison operator
   */
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

  /**
   * Threshold value
   */
  threshold: number;

  /**
   * Duration condition must be met (seconds)
   */
  for: number;
}

/**
 * Alert rule
 */
export interface AlertRule {
  /**
   * Rule ID
   */
  id: string;

  /**
   * Rule name
   */
  name: string;

  /**
   * Alert condition
   */
  condition: AlertCondition;

  /**
   * Alert severity
   */
  severity: AlertSeverity;

  /**
   * Alert status
   */
  status: AlertStatus;

  /**
   * Labels to filter
   */
  labels?: Record<string, string>;

  /**
   * Notification channels
   */
  notifications?: string[];

  /**
   * Rule description
   */
  description?: string;

  /**
   * Created at
   */
  createdAt: string;

  /**
   * Updated at
   */
  updatedAt: string;
}

/**
 * Alert instance
 */
export interface Alert {
  /**
   * Alert ID
   */
  id: string;

  /**
   * Rule ID
   */
  ruleId: string;

  /**
   * Severity
   */
  severity: AlertSeverity;

  /**
   * Status
   */
  status: AlertStatus;

  /**
   * Alert message
   */
  message: string;

  /**
   * Triggering value
   */
  value: number;

  /**
   * Fired at
   */
  firedAt: string;

  /**
   * Resolved at
   */
  resolvedAt?: string;

  /**
   * Acknowledged by
   */
  acknowledgedBy?: string;

  /**
   * Acknowledged at
   */
  acknowledgedAt?: string;

  /**
   * Labels
   */
  labels: Record<string, string>;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Dashboard visualization type
 */
export type VisualizationType =
  | 'line'
  | 'bar'
  | 'stat'
  | 'table'
  | 'heatmap'
  | 'gauge';

/**
 * Dashboard panel
 */
export interface DashboardPanel {
  /**
   * Panel ID
   */
  id: string;

  /**
   * Panel title
   */
  title: string;

  /**
   * Visualization type
   */
  type: VisualizationType;

  /**
   * Query to fetch data
   */
  query: string;

  /**
   * Panel position
   */
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };

  /**
   * Panel configuration
   */
  config?: Record<string, unknown>;

  /**
   * Refresh interval (seconds)
   */
  refreshInterval?: number;
}

/**
 * Dashboard
 */
export interface Dashboard {
  /**
   * Dashboard ID
   */
  id: string;

  /**
   * Dashboard name
   */
  name: string;

  /**
   * Dashboard description
   */
  description?: string;

  /**
   * Dashboard panels
   */
  panels: DashboardPanel[];

  /**
   * Refresh interval (seconds)
   */
  refreshInterval?: number;

  /**
   * Time range (default)
   */
  timeRange?: {
    start: string;
    end: string;
  };

  /**
   * Tags
   */
  tags?: string[];

  /**
   * Owner
   */
  owner?: string;

  /**
   * Created at
   */
  createdAt: string;

  /**
   * Updated at
   */
  updatedAt: string;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for observability system
 */
export interface Env {
  // D1 Database for log/metric storage
  DB: D1Database;

  // KV for caching and recent data
  CACHE: KVNamespace;

  // Analytics Engine for high-volume metrics
  ANALYTICS?: AnalyticsEngineDataset;

  // R2 for log archival
  LOG_ARCHIVE?: R2Bucket;

  // Secret for signatures
  SECRET?: string;
}
