/**
 * Audit Logger
 *
 * Comprehensive audit logging for security events,
 * compliance, and debugging.
 */

import type {
  AuditLogEntry,
  AuditEventType,
  AuditSeverity,
  Env,
} from './types';

// ============================================================================
// Audit Logger Class
// ============================================================================

export class AuditLogger {
  private db: D1Database;
  private analytics?: AnalyticsEngineDataset;
  private service: string;

  constructor(env: Env, service: string = 'security') {
    this.db = env.DB;
    this.analytics = env.ANALYTICS;
    this.service = service;
  }

  /**
   * Log an audit event.
   */
  async log(event: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<string> {
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Write to D1 for queryable audit log
    await this.db.prepare(`
      INSERT INTO audit_logs (
        id, event_type, severity, action, actor_id, actor_type,
        actor_name, actor_ip, actor_ua, resource_type, resource_id,
        resource_name, tenant_id, outcome, details, flags,
        correlation_id, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.id,
      entry.eventType,
      entry.severity,
      entry.action,
      entry.actor.id,
      entry.actor.type,
      entry.actor.name || null,
      entry.actor.ipAddress || null,
      entry.actor.userAgent || null,
      entry.resource?.type || null,
      entry.resource?.id || null,
      entry.resource?.name || null,
      entry.tenantId || null,
      entry.outcome,
      JSON.stringify(entry.details || {}),
      JSON.stringify({
        sensitive: entry.flags?.sensitive || false,
        pii: entry.flags?.pii || false,
        elevated: entry.flags?.elevated || false,
      }),
      entry.correlationId || null,
      entry.timestamp
    ).run();

    // Write to Analytics for aggregation
    if (this.analytics) {
      await this.analytics.writeDataPoint({
        blobs: [
          entry.eventType,
          entry.action,
          entry.actor.id,
          entry.outcome,
          entry.tenantId || 'none',
        ],
        doubles: [],
        indexes: [
          entry.eventType,
          entry.severity,
          entry.outcome,
          entry.tenantId || 'none',
        ],
      });
    }

    return entry.id;
  }

  // ========================================================================
  // Convenience Logging Methods
  // ========================================================================

  /**
   * Log authentication event.
   */
  async logAuthentication(options: {
    action: 'login' | 'logout' | 'register' | 'password_reset';
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    outcome: 'success' | 'failure';
    reason?: string;
    tenantId?: string;
  }): Promise<string> {
    return this.log({
      eventType: 'authentication',
      severity: options.outcome === 'success' ? 'info' : 'warning',
      action: options.action,
      actor: {
        id: options.userId,
        type: 'user',
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      outcome: options.outcome,
      tenantId: options.tenantId,
      details: {
        reason: options.reason,
      },
    });
  }

  /**
   * Log authorization event.
   */
  async logAuthorization(options: {
    action: string;
    userId: string;
    resourceType: string;
    resourceId?: string;
    permitted: boolean;
    reason?: string;
    ipAddress?: string;
    tenantId?: string;
  }): Promise<string> {
    return this.log({
      eventType: 'authorization',
      severity: options.permitted ? 'info' : 'warning',
      action: options.action,
      actor: {
        id: options.userId,
        type: 'user',
        ipAddress: options.ipAddress,
      },
      resource: {
        type: options.resourceType,
        id: options.resourceId,
      },
      outcome: options.permitted ? 'success' : 'failure',
      tenantId: options.tenantId,
      details: {
        permitted: options.permitted,
        reason: options.reason,
      },
    });
  }

  /**
   * Log data access event.
   */
  async logDataAccess(options: {
    action: 'read' | 'write' | 'delete' | 'export';
    userId: string;
    resourceType: string;
    resourceId: string;
    resourceName?: string;
    outcome: 'success' | 'failure';
    ipAddress?: string;
    tenantId?: string;
    sensitive?: boolean;
    pii?: boolean;
  }): Promise<string> {
    return this.log({
      eventType: 'data_access',
      severity: options.sensitive || options.pii ? 'warning' : 'info',
      action: options.action,
      actor: {
        id: options.userId,
        type: 'user',
        ipAddress: options.ipAddress,
      },
      resource: {
        type: options.resourceType,
        id: options.resourceId,
        name: options.resourceName,
      },
      outcome: options.outcome,
      tenantId: options.tenantId,
      flags: {
        sensitive: options.sensitive,
        pii: options.pii,
      },
    });
  }

  /**
   * Log security event.
   */
  async logSecurityEvent(options: {
    action: string;
    description: string;
    severity: AuditSeverity;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    outcome: 'success' | 'failure';
    details?: Record<string, unknown>;
    ipAddress?: string;
    tenantId?: string;
    correlationId?: string;
  }): Promise<string> {
    return this.log({
      eventType: 'security_event',
      severity: options.severity,
      action: options.action,
      actor: options.userId ? {
        id: options.userId,
        type: 'user',
        ipAddress: options.ipAddress,
      } : {
        id: 'system',
        type: 'service',
        ipAddress: options.ipAddress,
      },
      resource: options.resourceType ? {
        type: options.resourceType,
        id: options.resourceId,
      } : undefined,
      outcome: options.outcome,
      details: {
        description: options.description,
        ...options.details,
      },
      tenantId: options.tenantId,
      correlationId: options.correlationId,
    });
  }

  /**
   * Log API access.
   */
  async logAPIAccess(options: {
    method: string;
    path: string;
    userId?: string;
    statusCode: number;
    durationMs: number;
    ipAddress?: string;
    tenantId?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.log({
      eventType: 'api_access',
      severity: options.statusCode >= 400 ? 'warning' : 'info',
      action: `${options.method} ${options.path}`,
      actor: {
        id: options.userId || 'anonymous',
        type: options.userId ? 'user' : 'user',
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      outcome: options.statusCode < 400 ? 'success' : 'failure',
      tenantId: options.tenantId,
      details: {
        method: options.method,
        path: options.path,
        statusCode: options.statusCode,
        durationMs: options.durationMs,
      },
    });
  }

  // ========================================================================
  // Query Methods
  // ========================================================================

  /**
   * Query audit logs.
   */
  async query(options: {
    eventType?: AuditEventType | AuditEventType[];
    severity?: AuditSeverity;
    userId?: string;
    tenantId?: string;
    outcome?: 'success' | 'failure';
    startTime?: string;
    endTime?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ entries: AuditLogEntry[]; total: number }> {
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (options.eventType) {
      const types = Array.isArray(options.eventType) ? options.eventType : [options.eventType];
      query += ` AND event_type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    if (options.severity) {
      query += ' AND severity = ?';
      params.push(options.severity);
    }

    if (options.userId) {
      query += ' AND actor_id = ?';
      params.push(options.userId);
    }

    if (options.tenantId) {
      query += ' AND tenant_id = ?';
      params.push(options.tenantId);
    }

    if (options.outcome) {
      query += ' AND outcome = ?';
      params.push(options.outcome);
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

    const result = await this.db.prepare(query).bind(...params).all();

    // Get count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await this.db
      .prepare(countQuery.split('ORDER BY')[0])
      .bind(...params.slice(0, -options.limit ? -1 : undefined))
      .first<{ count: number }>();

    return {
      entries: (result.results || []).map(this.mapRowToEntry),
      total: countResult?.count || 0,
    };
  }

  /**
   * Get audit statistics.
   */
  async getStats(options?: {
    tenantId?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<{
    totalEvents: number;
    byType: Record<string, number>;
    bySeverity: Record<AuditSeverity, number>;
    failureRate: number;
  }> {
    let query = 'SELECT event_type, severity, outcome, COUNT(*) as count FROM audit_logs WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.tenantId) {
      query += ' AND tenant_id = ?';
      params.push(options.tenantId);
    }

    if (options?.startTime) {
      query += ' AND timestamp >= ?';
      params.push(options.startTime);
    }

    if (options?.endTime) {
      query += ' AND timestamp <= ?';
      params.push(options.endTime);
    }

    query += ' GROUP BY event_type, severity, outcome';

    const result = await this.db.prepare(query).bind(...params).all();

    const stats = {
      totalEvents: 0,
      byType: {} as Record<string, number>,
      bySeverity: {
        info: 0,
        warning: 0,
        error: 0,
        critical: 0,
      } as Record<AuditSeverity, number>,
      failureRate: 0,
    };

    let failures = 0;

    for (const row of (result.results || [])) {
      const r = row as any;
      stats.totalEvents += r.count;
      stats.byType[r.event_type] = (stats.byType[r.event_type] || 0) + r.count;
      stats.bySeverity[r.severity] = (stats.bySeverity[r.severity] || 0) + r.count;
      if (r.outcome === 'failure') failures += r.count;
    }

    stats.failureRate = stats.totalEvents > 0 ? failures / stats.totalEvents : 0;

    return stats;
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private mapRowToEntry(row: any): AuditLogEntry {
    return {
      id: row.id,
      eventType: row.event_type,
      severity: row.severity,
      action: row.action,
      actor: {
        id: row.actor_id,
        type: row.actor_type,
        name: row.actor_name,
        ipAddress: row.actor_ip,
        userAgent: row.actor_ua,
      },
      resource: row.resource_type ? {
        type: row.resource_type,
        id: row.resource_id,
        name: row.resource_name,
      } : undefined,
      tenantId: row.tenant_id,
      outcome: row.outcome,
      details: row.details ? JSON.parse(row.details) : undefined,
      flags: row.flags ? JSON.parse(row.flags) : undefined,
      correlationId: row.correlation_id,
      timestamp: row.timestamp,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create audit logger from environment.
 */
export function createAuditLogger(env: Env, service?: string): AuditLogger {
  return new AuditLogger(env, service);
}
