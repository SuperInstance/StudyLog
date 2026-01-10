/**
 * Structured Logger
 *
 * JSON-structured logging with levels, context, and error handling.
 * Optimized for Cloudflare Workers.
 */

import type { LogEntry, LogLevel, LogContext, LogError, Env } from './types';

// ============================================================================
// Logger Class
// ============================================================================

export class Logger {
  private db?: D1Database;
  private cache?: KVNamespace;
  private analytics?: AnalyticsEngineDataset;
  private baseContext: Partial<LogContext>;
  private minLevel: LogLevel;
  private service: string;

  constructor(config: {
    db?: D1Database;
    cache?: KVNamespace;
    analytics?: AnalyticsEngineDataset;
    service: string;
    environment: string;
    minLevel?: LogLevel;
  }) {
    this.db = config.db;
    this.cache = config.cache;
    this.analytics = config.analytics;
    this.service = config.service;
    this.minLevel = config.minLevel || 'info';
    this.baseContext = {
      service: this.service,
      environment: config.environment,
    };
  }

  // ========================================================================
  // Logging Methods
  // ========================================================================

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorDetails: LogError | undefined = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : typeof error === 'string' ? {
      name: 'Error',
      message: error,
    } : undefined;

    this.log('error', message, metadata, errorDetails);
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error | unknown, metadata?: Record<string, unknown>): void {
    const errorDetails: LogError | undefined = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : undefined;

    this.log('fatal', message, metadata, errorDetails);
  }

  /**
   * Core logging method
   */
  log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: LogError
  ): void {
    // Check min level
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: { ...this.baseContext },
      metadata,
      error,
    };

    // Output to console (always)
    this.outputToConsole(entry);

    // Persist to storage (async, don't await)
    if (this.db || this.analytics) {
      this.persist(entry).catch(err => {
        console.error('Failed to persist log:', err);
      });
    }
  }

  // ========================================================================
  // Context Management
  // ========================================================================

  /**
   * Create child logger with additional context
   */
  withContext(additionalContext: Partial<LogContext>): Logger {
    const child = new Logger({
      service: this.service,
      environment: this.baseContext.environment || 'development',
      db: this.db,
      cache: this.cache,
      analytics: this.analytics,
      minLevel: this.minLevel,
    });
    child.baseContext = { ...this.baseContext, ...additionalContext };
    return child;
  }

  /**
   * Add tenant context
   */
  withTenant(tenantId: string): Logger {
    return this.withContext({ tenantId });
  }

  /**
   * Add user context
   */
  withUser(userId: string): Logger {
    return this.withContext({ userId });
  }

  /**
   * Add request context
   */
  withRequest(method: string, path: string, ip?: string): Logger {
    return this.withContext({
      request: { method, path, ip },
    });
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * Output to console with formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${this.service}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.metadata || '');
        break;
      case 'info':
        console.info(message, entry.metadata || '');
        break;
      case 'warn':
        console.warn(message, entry.metadata || '');
        break;
      case 'error':
      case 'fatal':
        console.error(message, entry.error || entry.metadata || '');
        break;
    }
  }

  /**
   * Persist log entry to storage
   */
  private async persist(entry: LogEntry): Promise<void> {
    // Write to Analytics Engine (high volume, no index)
    if (this.analytics) {
      await this.analytics.writeDataPoint({
        blobs: [entry.message, JSON.stringify(entry.context), JSON.stringify(entry.metadata)],
        doubles: [],
        indexes: [entry.level, this.service, entry.context?.tenantId || 'none'],
      });
    }

    // Write to D1 for recent logs (queryable)
    if (this.db && this.shouldPersistToDb(entry.level)) {
      await this.db.prepare(`
        INSERT INTO logs (
          id, level, message, context, metadata, error, timestamp, service
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        entry.level,
        entry.message,
        JSON.stringify(entry.context || {}),
        JSON.stringify(entry.metadata || {}),
        JSON.stringify(entry.error || {}),
        entry.timestamp,
        this.service
      ).run();
    }

    // Cache recent errors for alerting
    if (entry.level === 'error' || entry.level === 'fatal') {
      await this.cache?.put(
        `recent_error:${crypto.randomUUID()}`,
        JSON.stringify(entry),
        { expirationTtl: 3600 }
      );
    }
  }

  /**
   * Check if log level should be persisted to database
   */
  private shouldPersistToDb(level: LogLevel): boolean {
    // Only persist warn and above to D1
    return ['warn', 'error', 'fatal'].includes(level);
  }
}

// ============================================================================
// Request Logger Middleware
// ============================================================================

/**
 * Log request/response
 */
export interface RequestLogOptions {
  logger: Logger;
  requestId: string;
  traceId?: string;
}

/**
 * Log incoming request
 */
export function logRequest(
  logger: Logger,
  request: Request,
  requestId?: string
): Logger {
  const url = new URL(request.url);
  const ip = request.headers.get('CF-Connecting-IP') ||
            request.headers.get('X-Forwarded-For') ||
            'unknown';

  return logger
    .withContext({
      request: {
        method: request.method,
        path: url.pathname,
        ip,
      },
    })
    .withContext({
      requestId: requestId || crypto.randomUUID(),
    });
}

/**
 * Log response
 */
export function logResponse(
  logger: Logger,
  status: number,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

  logger.log(level, `Request completed with status ${status}`, {
    status,
    duration,
    ...metadata,
  });
}

// ============================================================================
// Log Query Helper
// ============================================================================

/**
 * Query logs from database
 */
export async function queryLogs(
  db: D1Database,
  options: {
    service?: string;
    level?: LogLevel;
    tenantId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
    startTime?: string;
    endTime?: string;
  }
): Promise<LogEntry[]> {
  let query = 'SELECT * FROM logs WHERE 1=1';
  const params: (string | number)[] = [];

  if (options.service) {
    query += ' AND service = ?';
    params.push(options.service);
  }
  if (options.level) {
    query += ' AND level = ?';
    params.push(options.level);
  }
  if (options.tenantId) {
    query += " AND json_extract(context, '$.tenantId') = ?";
    params.push(options.tenantId);
  }
  if (options.startTime) {
    query += ' AND timestamp >= ?';
    params.push(options.startTime);
  }
  if (options.endTime) {
    query += ' AND timestamp <= ?';
    params.push(options.endTime);
  }

  query += ' ORDER BY timestamp DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const result = await db.prepare(query).bind(...params).all();

  return (result.results || []).map((row: any) => ({
    level: row.level,
    message: row.message,
    timestamp: row.timestamp,
    context: JSON.parse(row.context),
    metadata: JSON.parse(row.metadata || '{}'),
    error: row.error ? JSON.parse(row.error) : undefined,
    requestId: row.request_id,
    traceId: row.trace_id,
    spanId: row.span_id,
  }));
}

// ============================================================================
// Default Logger Factory
// ============================================================================

/**
 * Create a logger instance from environment
 */
export function createLogger(env: Env, service: string): Logger {
  return new Logger({
    db: env.DB,
    cache: env.CACHE,
    analytics: env.ANALYTICS,
    service,
    environment: env.ENVIRONMENT || 'development',
  });
}
