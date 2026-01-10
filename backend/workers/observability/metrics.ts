/**
 * Metrics Collector
 *
 * Collect and aggregate metrics for monitoring.
 * Supports counters, gauges, and histograms.
 */

import type {
  Metric,
  HistogramMetric,
  MetricType,
  Env,
} from './types';

// ============================================================================
// Metrics Collector Class
// ============================================================================

export class MetricsCollector {
  private db: D1Database;
  private analytics: AnalyticsEngineDataset;
  private service: string;
  private bufferedMetrics: Metric[] = [];
  private bufferMaxSize: number = 100;

  constructor(config: {
    db: D1Database;
    analytics: AnalyticsEngineDataset;
    service: string;
    bufferMaxSize?: number;
  }) {
    this.db = config.db;
    this.analytics = config.analytics;
    this.service = config.service;
    this.bufferMaxSize = config.bufferMaxSize || 100;
  }

  // ========================================================================
  // Counter Methods
  // ========================================================================

  /**
   * Increment a counter metric
   */
  increment(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): void {
    this.counter(name, value, labels);
  }

  /**
   * Decrement a counter metric
   */
  decrement(
    name: string,
    value: number = 1,
    labels?: Record<string, string>
  ): void {
    this.counter(name, -value, labels);
  }

  /**
   * Record counter value
   */
  counter(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.addMetric({
      name: this.prefixName(name),
      type: 'counter',
      value,
      labels: {
        service: this.service,
        ...labels,
      },
      timestamp: Date.now(),
    });
  }

  // ========================================================================
  // Gauge Methods
  // ========================================================================

  /**
   * Set gauge value
   */
  gauge(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.addMetric({
      name: this.prefixName(name),
      type: 'gauge',
      value,
      labels: {
        service: this.service,
        ...labels,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Increment gauge
   */
  gaugeIncrement(
    name: string,
    delta: number = 1,
    labels?: Record<string, string>
  ): void {
    this.gauge(name, delta, labels);
  }

  /**
   * Decrement gauge
   */
  gaugeDecrement(
    name: string,
    delta: number = 1,
    labels?: Record<string, string>
  ): void {
    this.gauge(name, -delta, labels);
  }

  // ========================================================================
  // Histogram Methods
// ========================================================================

  /**
   * Record value in histogram
   */
  histogram(
    name: string,
    value: number,
    labels?: Record<string, string>
  ): void {
    this.addMetric({
      name: this.prefixName(name),
      type: 'histogram',
      value,
      labels: {
        service: this.service,
        ...labels,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Record timing in milliseconds
   */
  timing(
    name: string,
    durationMs: number,
    labels?: Record<string, string>
  ): void {
    this.histogram(name, durationMs, labels);
  }

  // ========================================================================
  // HTTP/Request Metrics
  // ========================================================================

  /**
   * Record HTTP request
   */
  recordHttpRequest(options: {
    method: string;
    path: string;
    status: number;
    duration: number;
    tenantId?: string;
  }): void {
    const statusCategory = this.getStatusCategory(options.status);

    this.counter('http_requests_total', 1, {
      method: options.method,
      path: this.sanitizePath(options.path),
      status: statusCategory,
      tenant_id: options.tenantId || 'none',
    });

    this.timing('http_request_duration_ms', options.duration, {
      method: options.method,
      path: this.sanitizePath(options.path),
      status: statusCategory,
    });

    if (options.status >= 400) {
      this.counter('http_errors_total', 1, {
        method: options.method,
        path: this.sanitizePath(options.path),
        status: String(options.status),
        tenant_id: options.tenantId || 'none',
      });
    }
  }

  // ========================================================================
  // AI/LLM Metrics
  // ========================================================================

  /**
   * Record AI request
   */
  recordAIRequest(options: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    duration: number;
    cached: boolean;
  }): void {
    this.counter('ai_requests_total', 1, {
      provider: options.provider,
      model: options.model,
    });

    this.counter('ai_tokens_total', options.inputTokens + options.outputTokens, {
      provider: options.provider,
      model: options.model,
      type: 'total',
    });

    this.counter('ai_tokens_total', options.inputTokens, {
      provider: options.provider,
      model: options.model,
      type: 'input',
    });

    this.counter('ai_tokens_total', options.outputTokens, {
      provider: options.provider,
      model: options.model,
      type: 'output',
    });

    this.gauge('ai_cost_usd', options.cost, {
      provider: options.provider,
      model: options.model,
    });

    this.timing('ai_request_duration_ms', options.duration, {
      provider: options.provider,
      model: options.model,
    });

    if (options.cached) {
      this.counter('ai_cache_hits', 1, {
        provider: options.provider,
        model: options.model,
      });
    }
  }

  // ========================================================================
  // Database Metrics
  // ========================================================================

  /**
   * Record database query
   */
  recordDBQuery(options: {
    operation: string;
    table: string;
    duration: number;
    success: boolean;
  }): void {
    this.timing('db_query_duration_ms', options.duration, {
      operation: options.operation,
      table: options.table,
    });

    if (!options.success) {
      this.counter('db_errors_total', 1, {
        operation: options.operation,
        table: options.table,
      });
    }
  }

  // ========================================================================
  // Metric Management
  // ========================================================================

  /**
   * Add metric to buffer
   */
  private addMetric(metric: Metric): void {
    this.bufferedMetrics.push(metric);

    // Flush if buffer is full
    if (this.bufferedMetrics.length >= this.bufferMaxSize) {
      this.flush().catch(err => console.error('Failed to flush metrics:', err));
    }
  }

  /**
   * Flush buffered metrics to storage
   */
  async flush(): Promise<void> {
    if (this.bufferedMetrics.length === 0) {
      return;
    }

    const metrics = [...this.bufferedMetrics];
    this.bufferedMetrics = [];

    // Write to Analytics Engine
    for (const metric of metrics) {
      try {
        await this.analytics.writeDataPoint({
          blobs: [metric.name, JSON.stringify(metric.labels || {})],
          doubles: [metric.value],
          indexes: [
            metric.name,
            metric.type,
            metric.labels?.service || this.service,
            metric.labels?.tenant_id || 'none',
          ],
        });
      } catch (error) {
        console.error('Failed to write metric to analytics:', error);
      }
    }

    // Also write aggregates to D1 for querying
    await this.writeAggregates(metrics);
  }

  /**
   * Write metric aggregates to D1
   */
  private async writeAggregates(metrics: Metric[]): Promise<void> {
    // Group by metric name and labels
    const groups = new Map<string, {
      count: number;
      sum: number;
      min: number;
      max: number;
    }>();

    for (const metric of metrics) {
      const key = `${metric.name}:${JSON.stringify(metric.labels)}`;
      const group = groups.get(key) || { count: 0, sum: 0, min: Infinity, max: -Infinity };

      group.count++;
      group.sum += metric.value;
      group.min = Math.min(group.min, metric.value);
      group.max = Math.max(group.max, metric.value);

      groups.set(key, group);
    }

    // Write aggregates
    const stmt = this.db.prepare(`
      INSERT INTO metric_aggregates (
        id, metric_name, labels, count, sum, min, max, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();

    for (const [key, aggregate] of groups.entries()) {
      const [name, labelsStr] = key.split(':');
      await stmt.bind(
        crypto.randomUUID(),
        name,
        labelsStr,
        aggregate.count,
        aggregate.sum,
        aggregate.min === Infinity ? 0 : aggregate.min,
        aggregate.max === -Infinity ? 0 : aggregate.max,
        now
      ).run();
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Prefix metric name with service
   */
  private prefixName(name: string): string {
    return `${this.service}_${name}`;
  }

  /**
   * Get HTTP status category
   */
  private getStatusCategory(status: number): string {
    if (status >= 200 && status < 300) return '2xx';
    if (status >= 300 && status < 400) return '3xx';
    if (status >= 400 && status < 500) return '4xx';
    if (status >= 500) return '5xx';
    return 'other';
  }

  /**
   * Sanitize path for metrics (replace IDs with placeholders)
   */
  private sanitizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f-]{36}/g, '/:uuid')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[^/]+\/[a-f0-9]{64}/g, '/:hash');
  }
}

// ============================================================================
// Metrics Middleware
// ============================================================================

/**
 * Create metrics collection middleware
 */
export function createMetricsMiddleware(
  collector: MetricsCollector
): (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response> {
  return async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    const start = Date.now();
    const tenantId = request.headers.get('X-Tenant-ID') || undefined;

    // Add response time to context
    const originalWaitUntil = ctx.waitUntil.bind(ctx);
    ctx.waitUntil = (promise: Promise<any>) => {
      originalWaitUntil(promise);
      return promise;
    };

    try {
      // Request is handled by the actual handler
      // This middleware is meant to wrap existing handlers

      const response = await (async () => {
        // Placeholder - actual handler would be passed in
        return new Response('OK');
      })();

      const duration = Date.now() - start;

      // Record metrics
      collector.recordHttpRequest({
        method: request.method,
        path: url.pathname,
        status: response.status,
        duration,
        tenantId,
      });

      // Flush metrics asynchronously
      ctx.waitUntil(collector.flush());

      return response;
    } catch (error) {
      const duration = Date.now() - start;

      collector.recordHttpRequest({
        method: request.method,
        path: url.pathname,
        status: 500,
        duration,
        tenantId,
      });

      throw error;
    }
  };
}

// ============================================================================
// Metrics Query Helper
// ============================================================================

/**
 * Query metrics from database
 */
export async function queryMetrics(
  db: D1Database,
  options: {
    metricName?: string;
    service?: string;
    labels?: Record<string, string>;
    startTime?: number;
    endTime?: number;
    aggregate?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }
): Promise<Metric[]> {
  let query = 'SELECT * FROM metric_aggregates WHERE 1=1';
  const params: (string | number)[] = [];

  if (options.metricName) {
    query += ' AND metric_name = ?';
    params.push(options.metricName);
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

  const result = await db.prepare(query).bind(...params).all();

  return (result.results || []).map((row: any) => ({
    name: row.metric_name,
    type: 'gauge' as MetricType,
    value: options.aggregate === 'sum' ? row.sum :
             options.aggregate === 'avg' ? row.sum / row.count :
             options.aggregate === 'min' ? row.min :
             options.aggregate === 'max' ? row.max :
             row.count,
    labels: JSON.parse(row.labels),
    timestamp: row.timestamp,
  }));
}

// ============================================================================
// Default Factory
// ============================================================================

/**
 * Create metrics collector from environment
 */
export function createMetricsCollector(env: Env, service: string): MetricsCollector {
  return new MetricsCollector({
    db: env.DB,
    analytics: env.ANALYTICS!,
    service,
  });
}
