/**
 * API Gateway Types
 *
 * Complete type definitions for the API Gateway including
 * routing, rate limiting, transformation, and versioning.
 */

// ============================================================================
// Gateway Configuration
// ============================================================================

/**
 * Route configuration
 */
export interface RouteConfig {
  /**
   * Route path pattern (supports wildcards)
   */
  path: string;

  /**
   * HTTP methods allowed
   */
  methods: string[];

  /**
   * Target service URL
   */
  target: string;

  /**
   * Rate limit configuration
   */
  rateLimit?: RateLimitConfig;

  /**
   * Authentication required
   */
  authRequired?: boolean;

  /**
   * Required scopes/permissions
   */
  scopes?: string[];

  /**
   * Request transformation
   */
  transformRequest?: TransformationConfig;

  /**
   * Response transformation
   */
  transformResponse?: TransformationConfig;

  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Retry configuration
   */
  retry?: RetryConfig;

  /**
   * Cache configuration
   */
  cache?: CacheConfig;

  /**
   * Route metadata
   */
  metadata?: RouteMetadata;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum requests per window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Rate limit key (e.g., 'tenant.id', 'user.id', 'ip.address')
   */
  key?: string;

  /**
   * Burst allowance
   */
  burst?: number;

  /**
   * Scope (global, per-tenant, per-user)
   */
  scope?: 'global' | 'tenant' | 'user';
}

/**
 * Transformation configuration
 */
export interface TransformationConfig {
  /**
   * Headers to add/remove
   */
  headers?: {
    add?: Record<string, string>;
    remove?: string[];
    rename?: Record<string, string>;
  };

  /**
   * Query parameters to add/remove
   */
  query?: {
    add?: Record<string, string>;
    remove?: string[];
  };

  /**
   * Body transformation
   */
  body?: {
    /**
     * JSON path transformations
     */
    transform?: Record<string, string>;

    /**
     * Fields to remove
     */
    remove?: string[];

    /**
     * Fields to rename
     */
    rename?: Record<string, string>;
  };
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum retry attempts
   */
  maxAttempts: number;

  /**
   * Initial backoff in milliseconds
   */
  initialBackoff: number;

  /**
   * Backoff multiplier
   */
  backoffMultiplier: number;

  /**
   * HTTP status codes to retry
   */
  retryOnStatus: number[];
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Cache TTL in seconds
   */
  ttl: number;

  /**
   * Cache key pattern
   */
  keyPattern?: string;

  /**
   * Cache methods (only GET/HEAD by default)
   */
  methods?: string[];

  /**
   * Vary by headers
   */
  varyBy?: string[];

  /**
   * Allow stale cache while revalidating
   */
  staleWhileRevalidate?: number;
}

/**
 * Route metadata
 */
export interface RouteMetadata {
  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Tags for grouping
   */
  tags?: string[];

  /**
   * Deprecated flag
   */
  deprecated?: boolean;

  /**
   * API version
   */
  version?: string;

  /**
   * Owner team
   */
  owner?: string;
}

// ============================================================================
// Gateway Request/Response Types
// ============================================================================

/**
 * Gateway request context
 */
export interface GatewayContext {
  /**
   * Request ID (unique)
   */
  requestId: string;

  /**
   * Tenant ID (if multi-tenant)
   */
  tenantId?: string;

  /**
   * User ID (if authenticated)
   */
  userId?: string;

  /**
   * User's role/permissions
   */
  scopes?: string[];

  /**
   * Client IP address
   */
  clientIp: string;

  /**
   * User agent
   */
  userAgent?: string;

  /**
   * Request timestamp
   */
  timestamp: string;

  /**
   * Matched route
   */
  route?: RouteConfig;

  /**
   * Rate limit info
   */
  rateLimit?: {
    remaining: number;
    reset: number;
  };

  /**
   * Cache info
   */
  cache?: {
    hit: boolean;
    key?: string;
  };
}

/**
 * Gateway request
 */
export interface GatewayRequest {
  /**
   * Original request
   */
  request: Request;

  /**
   * Request context
   */
  context: GatewayContext;

  /**
   * Parsed URL
   */
  url: URL;

  /**
   * Path parameters
   */
  params: Record<string, string>;

  /**
   * Query parameters
   */
  query: URLSearchParams;
}

/**
 * Gateway response
 */
export interface GatewayResponse {
  /**
   * Response status
   */
  status: number;

  /**
   * Response headers
   */
  headers: Headers;

  /**
   * Response body
   */
  body?: ReadableStream | string;

  /**
   * Context (from request)
   */
  context: GatewayContext;

  /**
   * Response time in milliseconds
   */
  responseTime: number;

  /**
   * Cache status
   */
  cacheStatus?: 'hit' | 'miss' | 'stale' | 'bypass';

  /**
   * Upstream response time
   */
  upstreamTime?: number;
}

// ============================================================================
// API Versioning Types
// ============================================================================

/**
 * API version type
 */
export type ApiVersionType = 'header' | 'path' | 'query';

/**
 * API version configuration
 */
export interface ApiVersionConfig {
  /**
   * Default version
   */
  default: string;

  /**
   * Supported versions
   */
  supported: string[];

  /**
   * Versioning method
   */
  type: ApiVersionType;

  /**
   * Header name (if type is 'header')
   */
  headerName?: string;

  /**
   * Path prefix (if type is 'path')
   */
  pathPrefix?: string;

  /**
   * Query parameter (if type is 'query')
   */
  queryParam?: string;

  /**
   * Deprecated versions
   */
  deprecated?: {
    version: string;
    sunsetDate: string;
    migrationGuide?: string;
  }[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Gateway error types
 */
export type GatewayErrorType =
  | 'authentication_failed'
  | 'authorization_failed'
  | 'rate_limit_exceeded'
  | 'service_unavailable'
  | 'bad_request'
  | 'not_found'
  | 'timeout'
  | 'upstream_error'
  | 'internal_error';

/**
 * Gateway error response
 */
export interface GatewayErrorResponse {
  /**
   * Error type
   */
  error: GatewayErrorType;

  /**
   * Human-readable message
   */
  message: string;

  /**
   * Request ID
   */
  requestId: string;

  /**
   * Additional details
   */
  details?: Record<string, unknown>;

  /**
   * Timestamp
   */
  timestamp: string;
}

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Service health status
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
   * Individual service status
   */
  services: Record<string, ServiceHealth>;

  /**
   * Timestamp
   */
  timestamp: string;
}

/**
 * Individual service health
 */
export interface ServiceHealth {
  /**
   * Service status
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
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Metrics data point
 */
export interface MetricData {
  /**
   * Metric name
   */
  name: string;

  /**
   * Metric value
   */
  value: number;

  /**
   * Metric type
   */
  type: 'counter' | 'gauge' | 'histogram';

  /**
   * Labels/dimensions
   */
  labels?: Record<string, string>;

  /**
   * Timestamp
   */
  timestamp: string;
}

/**
 * Aggregated metrics
 */
export interface Metrics {
  /**
   * Request count by route
   */
  requests: Record<string, number>;

  /**
   * Error count by route
   */
  errors: Record<string, number>;

  /**
   * Average response time by route
   */
  avgResponseTime: Record<string, number>;

  /**
   * P50, P95, P99 response times
   */
  percentiles: {
    p50: number;
    p95: number;
    p99: number;
  };

  /**
   * Active connections
   */
  activeConnections: number;

  /**
   * Rate limit hits
   */
  rateLimitHits: number;

  /**
   * Cache hit rate
   */
  cacheHitRate: number;

  /**
   * Time period covered
   */
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for API gateway
 */
export interface Env {
  // KV for caching and rate limiting
  CACHE: KVNamespace;

  // D1 for metrics and configuration storage
  DB: D1Database;

  // Analytics Engine for metrics
  ANALYTICS?: AnalyticsEngineDataset;

  // Service binding configurations
  SERVICES?: Record<string, Fetcher>;

  // JWT verification secret
  JWT_SECRET?: string;

  // API keys
  API_KEYS?: Record<string, string>;

  // Rate limit configuration
  RATE_LIMIT_CONFIG?: string; // JSON
}
