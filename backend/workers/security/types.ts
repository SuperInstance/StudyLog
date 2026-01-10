/**
 * Enhanced Security Types
 *
 * Complete type definitions for input validation, prompt injection
 * detection, PII redaction, and audit logging.
 */

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation rule types
 */
export type ValidationRuleType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'email'
  | 'url'
  | 'uuid'
  | 'enum'
  | 'array'
  | 'object'
  | 'date'
  | 'regex'
  | 'range'
  | 'length';

/**
 * Validation result
 */
export interface ValidationResult {
  /**
   * Is value valid
   */
  valid: boolean;

  /**
   * Error message (if invalid)
   */
  error?: string;

  /**
   * Sanitized value (if applicable)
   */
  sanitized?: unknown;

  /**
   * Path to invalid field
   */
  path?: string;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  /**
   * Schema type
   */
  type: ValidationRuleType;

  /**
   * Is required
   */
  required?: boolean;

  /**
   * Default value
   */
  default?: unknown;

  /**
   * Allowed values (for enum)
   */
  enum?: unknown[];

  /**
   * Min/max values
   */
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;

  /**
   * Regex pattern
   */
  pattern?: RegExp;

  /**
   * Nested properties (for object)
   */
  properties?: Record<string, ValidationSchema>;

  /**
   * Array item schema
   */
  items?: ValidationSchema;

  /**
   * Custom validator function
   */
  validate?: (value: unknown) => boolean | string;

  /**
   * Sanitizer function
   */
  sanitize?: (value: unknown) => unknown;
}

/**
 * Schema definitions for common inputs
 */
export interface Schemas {
  /**
   * User input schema
   */
  userInput: ValidationSchema;

  /**
   * AI prompt schema
   */
  aiPrompt: ValidationSchema;

  /**
   * File upload schema
   */
  fileUpload: ValidationSchema;

  /**
   * Code execution schema
   */
  codeExecution: ValidationSchema;
}

// ============================================================================
// Security Types
// ============================================================================

/**
 * Security threat level
 */
export type ThreatLevel = 'safe' | 'suspicious' | 'dangerous';

/**
 * Detected threat type
 */
export type ThreatType =
  | 'prompt_injection'
  | 'jailbreak'
  | 'xss'
  | 'sqli'
  | 'command_injection'
  | 'path_traversal'
  | 'ssrf'
  | 'pii_exposure'
  | 'malicious_content'
  | 'rate_limit_exceeded';

/**
 * Security scan result
 */
export interface SecurityScanResult {
  /**
   * Overall threat level
   */
  threatLevel: ThreatLevel;

  /**
   * Detected threats
   */
  threats: DetectedThreat[];

  /**
   * Sanitized input (with threats removed)
   */
  sanitized?: string;

  /**
   * Should block request
   */
  shouldBlock: boolean;

  /**
   * Scan duration in milliseconds
   */
  scanTimeMs: number;
}

/**
 * Individual detected threat
 */
export interface DetectedThreat {
  /**
   * Threat type
   */
  type: ThreatType;

  /**
   * Threat severity (1-10)
   */
  severity: number;

  /**
   * Matched pattern
   */
  pattern?: string;

  /**
   * Location in input (start, end)
   */
  location?: { start: number; end: number };

  /**
   * Description
   */
  description: string;

  /**
   * Confidence score (0-1)
   */
  confidence: number;
}

// ============================================================================
// PII Types
// ============================================================================

/**
 * PII data types
 */
export type PIIType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'ip_address'
  | 'address'
  | 'name'
  | 'date_of_birth'
  | 'passport'
  | 'license_plate'
  | 'bank_account'
  | 'api_key'
  | 'password'
  | 'token';

/**
 * PII detection result
 */
export interface PIIDetectionResult {
  /**
   * Detected PII instances
   */
  instances: PIIInstance[];

  /**
   * Text with PII redacted
   */
  redacted: string;

  /**
   * Scan time in milliseconds
   */
  scanTimeMs: number;
}

/**
 * Detected PII instance
 */
export interface PIIInstance {
  /**
   * PII type
   */
  type: PIIType;

  /**
   * Detected value (original)
   */
  value: string;

  /**
   * Redacted value
   */
  redacted: string;

  /**
   * Location in text
   */
  location: { start: number; end: number };

  /**
   * Confidence score
   */
  confidence: number;
}

/**
 * PII redaction options
 */
export interface PIIRedactionOptions {
  /**
   * Which PII types to detect
   */
  types?: PIIType[];

  /**
   * Redaction character
   */
  redactionChar?: string;

  /**
   * Keep first N characters
   */
  keepFirst?: number;

  /**
   * Keep last N characters
   */
  keepLast?: number;

  /**
   * Custom replacement format
   */
  replacementFormat?: string; // e.g., "[EMAIL]", "****"
}

// ============================================================================
// Audit Types
// ============================================================================

/**
 * Audit event types
 */
export type AuditEventType =
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'data_deletion'
  | 'configuration_change'
  | 'security_event'
  | 'admin_action'
  | 'api_access'
  | 'file_access';

/**
 * Audit event severity
 */
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /**
   * Unique event ID
   */
  id: string;

  /**
   * Event type
   */
  eventType: AuditEventType;

  /**
   * Event severity
   */
  severity: AuditSeverity;

  /**
   * Action performed
   */
  action: string;

  /**
   * Actor (user who performed action)
   */
  actor: {
    id: string;
    type: 'user' | 'service' | 'admin';
    name?: string;
    ipAddress?: string;
    userAgent?: string;
  };

  /**
   * Resource being acted upon
   */
  resource?: {
    type: string;
    id: string;
    name?: string;
  };

  /**
   * Tenant context
   */
  tenantId?: string;

  /**
   * Outcome (success/failure)
   */
  outcome: 'success' | 'failure';

  /**
   * Additional details
   */
  details?: Record<string, unknown>;

  /**
   * Security flags
   */
  flags?: {
    sensitive?: boolean;
    pii?: boolean;
    elevated?: boolean;
  };

  /**
   * Correlation ID
   */
  correlationId?: string;

  /**
   * Timestamp
   */
  timestamp: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit rule
 */
export interface RateLimitRule {
  /**
   * Rule ID
   */
  id: string;

  /**
   * Rule name
   */
  name: string;

  /**
   * Key pattern (e.g., "user:{userId}", "ip:{ipAddress}")
   */
  key: string;

  /**
   * Maximum requests per window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Block duration after limit (seconds)
   */
  blockDuration?: number;

  /**
   * Scope (global, per-tenant, per-user)
   */
  scope?: 'global' | 'tenant' | 'user';

  /**
   * Action type to rate limit
   */
  actionType?: string[];

  /**
   * Is enabled
   */
  enabled?: boolean;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for security system
 */
export interface Env {
  // D1 Database for audit logs
  DB: D1Database;

  // KV for rate limiting and caching
  CACHE: KVNamespace;

  // Analytics for security metrics
  ANALYTICS?: AnalyticsEngineDataset;

  // AI for content analysis
  AI?: Ai;

  // Secret for signatures
  SECRET?: string;
}
