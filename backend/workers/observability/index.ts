/**
 * Observability System - Main Entry Point
 *
 * Cloudflare Worker for monitoring, health checks, and metrics.
 */

import { Logger, createLogger, logRequest, logResponse } from './logger';
import { MetricsCollector, createMetricsCollector } from './metrics';
import type { HealthCheck, ComponentHealth, Env, HealthStatus } from './types';

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Create logger and metrics collector
    const logger = createLogger(env, 'observability');
    const metrics = createMetricsCollector(env, 'observability');

    // Log request
    const requestLogger = logRequest(logger, request);

    const startTime = Date.now();

    try {
      // Health check (always accessible)
      if (pathname === '/health' || pathname === '/healthz') {
        return await handleHealthCheck(env, metrics);
      }

      // Readiness check
      if (pathname === '/ready') {
        return await handleReadinessCheck(env);
      }

      // Liveness check
      if (pathname === '/live') {
        return Response.json({ status: 'ok' }, { headers: corsHeaders });
      }

      // Metrics endpoint (Prometheus format)
      if (pathname === '/metrics') {
        return await handleMetrics(env, url);
      }

      // Metrics query API
      if (pathname === '/api/v1/metrics' && request.method === 'GET') {
        return await handleQueryMetrics(env, url);
      }

      // Logs query API
      if (pathname === '/api/v1/logs' && request.method === 'GET') {
        return await handleQueryLogs(env, url);
      }

      // Status dashboard
      if (pathname === '/' || pathname === '/status') {
        return await handleDashboard(env);
      }

      // 404
      logResponse(requestLogger, 404, Date.now() - startTime);
      return new Response(JSON.stringify({
        error: 'Not found',
        path: pathname,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      requestLogger.error('Request failed', error);
      logResponse(requestLogger, 500, Date.now() - startTime);

      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ============================================================================
// Route Handlers
// ============================================================================

async function handleHealthCheck(env: Env, metrics: MetricsCollector): Promise<Response> {
  const checks: Record<string, ComponentHealth> = {};

  // Check D1 database
  try {
    const start = Date.now();
    await env.DB.prepare('SELECT 1').first();
    checks.database = {
      status: 'healthy',
      responseTime: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString(),
    };
  }

  // Check KV cache
  try {
    const start = Date.now();
    await env.CACHE.put('health:check', 'ok', { expirationTtl: 10 });
    await env.CACHE.get('health:check');
    checks.cache = {
      status: 'healthy',
      responseTime: Date.now() - start,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    checks.cache = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date().toISOString(),
    };
  }

  // Check Analytics Engine
  if (env.ANALYTICS) {
    try {
      checks.analytics = {
        status: 'healthy',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      checks.analytics = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // Check R2 (if configured)
  if (env.LOG_ARCHIVE) {
    try {
      const start = Date.now();
      await env.LOG_ARCHIVE.list({ limit: 1 });
      checks.storage = {
        status: 'healthy',
        responseTime: Date.now() - start,
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      checks.storage = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
      };
    }
  }

  // Determine overall status
  const overallStatus: HealthStatus = Object.values(checks).every(c => c.status === 'healthy')
    ? 'healthy'
    : Object.values(checks).some(c => c.status === 'unhealthy')
    ? 'unhealthy'
    : 'degraded';

  const healthCheck: HealthCheck = {
    status: overallStatus,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusMap: Record<HealthStatus, number> = {
    healthy: 200,
    degraded: 200,
    unhealthy: 503,
  };

  return Response.json(healthCheck, {
    status: statusMap[overallStatus],
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleReadinessCheck(env: Env): Promise<Response> {
  const ready = await checkReadiness(env);

  return Response.json({
    ready,
    timestamp: new Date().toISOString(),
  }, {
    status: ready ? 200 : 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function checkReadiness(env: Env): Promise<boolean> {
  try {
    // Check database connectivity
    await env.DB.prepare('SELECT 1').first();

    // Check cache connectivity
    await env.CACHE.get('ready');

    return true;
  } catch {
    return false;
  }
}

async function handleMetrics(env: Env, url: URL): Promise<Response> {
  // Query recent metrics from D1
  const result = await env.DB.prepare(`
    SELECT
      metric_name,
      labels,
      SUM(sum) as total,
      COUNT(*) as count
    FROM metric_aggregates
    WHERE timestamp > ?
    GROUP BY metric_name, labels
    ORDER BY metric_name
  `).bind(Date.now() - 300000).all(); // Last 5 minutes

  // Format as Prometheus text format
  const lines: string[] = [
    '# StudyLoG.AI Metrics',
    `# Generated at ${new Date().toISOString()}`,
    '',
  ];

  for (const row of (result.results || [])) {
    const labels = JSON.parse(row.labels);
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    lines.push(`${row.metric_name}{${labelStr}} ${row.total}`);
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4',
    },
  });
}

async function handleQueryMetrics(env: Env, url: URL): Promise<Response> {
  const metricName = url.searchParams.get('name');
  const startTime = url.searchParams.get('start');
  const endTime = url.searchParams.get('end');
  const aggregate = url.searchParams.get('aggregate') || 'sum';

  let query = 'SELECT * FROM metric_aggregates WHERE 1=1';
  const params: (string | number)[] = [];

  if (metricName) {
    query += ' AND metric_name = ?';
    params.push(metricName);
  }
  if (startTime) {
    query += ' AND timestamp >= ?';
    params.push(parseInt(startTime, 10));
  }
  if (endTime) {
    query += ' AND timestamp <= ?';
    params.push(parseInt(endTime, 10));
  }

  query += ' ORDER BY timestamp DESC';

  if (url.searchParams.has('limit')) {
    query += ' LIMIT ?';
    params.push(parseInt(url.searchParams.get('limit') || '100', 10));
  }

  const result = await env.DB.prepare(query).bind(...params).all();

  // Calculate aggregates
  const metrics: any[] = [];
  const byMetric = new Map<string, any[]>();

  for (const row of (result.results || [])) {
    const key = `${row.metric_name}:${row.labels}`;
    if (!byMetric.has(key)) {
      byMetric.set(key, []);
    }
    byMetric.get(key).push(row);
  }

  for (const [key, rows] of byMetric) {
    const sum = rows.reduce((acc: number, r: any) => acc + r.sum, 0);
    const count = rows.reduce((acc: number, r: any) => acc + r.count, 0);
    const min = Math.min(...rows.map((r: any) => r.min));
    const max = Math.max(...rows.map((r: any) => r.max));

    metrics.push({
      metricName: rows[0].metric_name,
      labels: JSON.parse(rows[0].labels),
      aggregate: {
        sum,
        avg: count > 0 ? sum / count : 0,
        min,
        max,
        count,
      },
      samples: rows.length,
    });
  }

  return Response.json({ metrics }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleQueryLogs(env: Env, url: URL): Promise<Response> {
  const options = {
    service: url.searchParams.get('service') || undefined,
    level: url.searchParams.get('level') as any || undefined,
    tenantId: url.searchParams.get('tenantId') || undefined,
    limit: parseInt(url.searchParams.get('limit') || '100', 10),
    offset: parseInt(url.searchParams.get('offset') || '0', 10),
    startTime: url.searchParams.get('start') || undefined,
    endTime: url.searchParams.get('end') || undefined,
  };

  const result = await env.DB.prepare(`
    SELECT * FROM logs
    WHERE 1=1
    ${options.service ? 'AND service = ?' : ''}
    ${options.level ? 'AND level = ?' : ''}
    ${options.tenantId ? "AND json_extract(context, '$.tenantId') = ?" : ''}
    ${options.startTime ? 'AND timestamp >= ?' : ''}
    ${options.endTime ? 'AND timestamp <= ?' : ''}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).bind(
    ...[
      options.service,
      options.level,
      options.tenantId,
      options.startTime,
      options.endTime,
      options.limit,
      options.offset,
    ].filter(Boolean) as (string | number)[]
  ).all();

  return Response.json({
    logs: result.results || [],
    pagination: {
      limit: options.limit,
      offset: options.offset,
      total: (result.results || []).length,
    },
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDashboard(env: Env): Promise<Response> {
  // Get system status
  const healthResult = await env.DB.prepare(`
    SELECT * FROM metric_aggregates
    WHERE timestamp > ?
    ORDER BY timestamp DESC
  `).bind(Date.now() - 300000).all();

  // Get recent errors
  const errorsResult = await env.DB.prepare(`
    SELECT * FROM logs
    WHERE level IN ('error', 'fatal')
    ORDER BY timestamp DESC
    LIMIT 10
  `).all();

  // Calculate summary stats
  const totalRequests = healthResult.results?.filter(
    (r: any) => r.metric_name === 'observability_http_requests_total'
  ).reduce((acc: number, r: any) => acc + r.sum, 0) || 0;

  const errorRate = healthResult.results?.filter(
    (r: any) => r.metric_name === 'observability_http_errors_total'
  ).reduce((acc: number, r: any) => acc + r.sum, 0) || 0;

  const avgResponseTime = 0; // Would calculate from aggregates

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>StudyLoG.AI - Observability Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #0f172a; color: #f8fafc; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: bold; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: #1e293b; border-radius: 8px; padding: 20px; }
    .stat-label { color: #94a3b8; font-size: 14px; }
    .stat-value { font-size: 32px; font-weight: bold; margin-top: 8px; }
    .stat-value.healthy { color: #22c55e; }
    .stat-value.warning { color: #f59e0b; }
    .stat-value.error { color: #ef4444; }
    .section { background: #1e293b; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
    .log-entry { padding: 10px; border-left: 3px solid #3b82f6; margin-bottom: 10px; background: #0f172a; }
    .log-entry.error { border-color: #ef4444; }
    .log-time { color: #94a3b8; font-size: 12px; }
    .log-message { margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">StudyLoG.AI - Observability</div>
    <div style="color: #94a3b8;">${new Date().toISOString()}</div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Total Requests (5m)</div>
      <div class="stat-value healthy">${totalRequests}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Errors (5m)</div>
      <div class="stat-value ${errorRate > 0 ? 'warning' : 'healthy'}">${errorRate}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Error Rate</div>
      <div class="stat-value ${totalRequests > 0 && errorRate / totalRequests > 0.05 ? 'error' : 'healthy'}">
        ${totalRequests > 0 ? ((errorRate / totalRequests) * 100).toFixed(1) : 0}%
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Status</div>
      <div class="stat-value healthy">Operational</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Recent Errors</div>
    ${(errorsResult.results || []).map((log: any) => `
      <div class="log-entry error">
        <div class="log-time">${log.timestamp}</div>
        <div class="log-message">${log.message}</div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">Endpoints</div>
    <ul style="margin: 0; padding-left: 20px; color: #94a3b8;">
      <li><a href="/health" style="color: #3b82f6;">/health</a> - Health check</li>
      <li><a href="/metrics" style="color: #3b82f6;">/metrics</a> - Prometheus metrics</li>
      <li><a href="/api/v1/metrics" style="color: #3b82f6;">/api/v1/metrics</a> - Metrics API</li>
      <li><a href="/api/v1/logs" style="color: #3b82f6;">/api/v1/logs</a> - Logs API</li>
    </ul>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

// ============================================================================
// Exports
// ============================================================================

export { Logger, MetricsCollector, createLogger, createMetricsCollector };
export type { Env, HealthCheck, ComponentHealth };
