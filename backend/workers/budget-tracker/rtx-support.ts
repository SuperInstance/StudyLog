/**
 * Budget Tracker - RTX AI PC Support
 *
 * Extends the budget tracker to support RTX local inference tracking.
 *
 * This module adds:
 * 1. RTX GPU detection and capability tracking
 * 2. Local vs cloud usage tracking
 * 3. Cost savings calculation from local processing
 * 4. Integration with rtx-local worker
 *
 * ## Usage
 *
 * Import this module to extend budget tracker with RTX support:
 *
 * ```typescript
 * import { applyRTXSupport } from './rtx-support';
 *
 * // Apply RTX support to existing router
 * applyRTXSupport(router);
 * ```
 */

// ============================================================================
// Type Extensions for RTX Support
// ============================================================================

/**
 * RTX GPU information for budget tracking
 */
export interface RTXGPUInfo {
  /** GPU device ID */
  deviceId: number;

  /** GPU name */
  name: string;

  /** Total VRAM in bytes */
  totalMemory: number;

  /** TensorRT supported */
  tensorRTSupported: boolean;

  /** Last detected timestamp */
  lastDetected: string;
}

/**
 * Local vs cloud usage record
 */
export interface LocalCloudUsageRecord {
  /** Record ID */
  id: string;

  /** User ID */
  userId: string;

  /** Whether processing was local */
  isLocal: boolean;

  /** Model used */
  model: string;

  /** Operation type */
  operation: string;

  /** Input tokens */
  inputTokens: number;

  /** Output tokens */
  outputTokens: number;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Actual cost (0 for local) */
  actualCost: number;

  /** Estimated cloud cost if this was processed in cloud */
  estimatedCloudCost: number;

  /** Cost savings from local processing */
  costSaved: number;

  /** GPU memory used (local only) */
  gpuMemoryUsed?: number;

  /** Tokens per second (local only) */
  tokensPerSecond?: number;

  /** Timestamp */
  timestamp: string;
}

/**
 * Local vs cloud usage statistics
 */
export interface LocalCloudStats {
  /** User ID */
  userId: string;

  /** Date (YYYY-MM-DD) */
  date: string;

  /** Local inference count */
  localInferences: number;

  /** Cloud API call count */
  cloudCalls: number;

  /** Total tokens processed locally */
  localTokens: number;

  /** Total tokens processed in cloud */
  cloudTokens: number;

  /** Total cloud cost */
  cloudCost: number;

  /** Estimated savings from local processing */
  estimatedSavings: number;

  /** Average local tokens per second */
  avgLocalTokensPerSecond: number;

  /** GPU hours used */
  gpuHours: number;

  /** Percentage of total processing done locally */
  localProcessingPercent: number;

  /** RTX GPU info */
  gpuInfo?: RTXGPUInfo;
}

/**
 * RTX budget check result
 */
export interface RTXBudgetCheckResult {
  /** Should use local processing */
  useLocal: boolean;

  /** Reason for recommendation */
  reason: string;

  /** Estimated cloud cost */
  estimatedCloudCost: number;

  /** Local processing time estimate */
  estimatedLocalTimeMs: number;

  /** Cost savings if using local */
  costSaved: number;

  /** GPU memory required */
  gpuMemoryRequired: number;

  /** Sufficient GPU memory available */
  sufficientGPUMemory: boolean;

  /** RTX GPU detected */
  rtxDetected: boolean;
}

// ============================================================================
// RTX Support Implementation
// ============================================================================

/**
 * RTX budget tracker extension
 *
 * Tracks local vs cloud usage and calculates cost savings.
 */
export class RTXBudgetTracker {
  private rtxDetectionCache: Map<string, { info: RTXGPUInfo; expiresAt: number }> = new Map();
  private readonly DETECTION_CACHE_TTL = 60000; // 1 minute

  /**
   * Detect if user has RTX GPU available
   *
   * @param userId User ID
   * @param rtxLocalUrl URL of rtx-local worker
   * @returns GPU info or null
   */
  async detectRTXGPU(
    userId: string,
    rtxLocalUrl: string = 'http://localhost:8080'
  ): Promise<RTXGPUInfo | null> {
    // Check cache first
    const cached = this.rtxDetectionCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.info;
    }

    try {
      const response = await fetch(`${rtxLocalUrl}/gpu/detect`, {
        signal: AbortSignal.timeout(2000),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as {
        hasRTXGPU: boolean;
        gpu?: RTXGPUInfo;
      };

      if (data.hasRTXGPU && data.gpu) {
        // Cache the result
        this.rtxDetectionCache.set(userId, {
          info: data.gpu,
          expiresAt: Date.now() + this.DETECTION_CACHE_TTL,
        });

        return data.gpu;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if should use local inference
   *
   * @param userId User ID
   * @param model Model name
   * @param inputTokens Estimated input tokens
   * @param outputTokens Estimated output tokens
   * @param rtxLocalUrl URL of rtx-local worker
   * @returns Budget check result
   */
  async checkRTXBudget(
    userId: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    rtxLocalUrl: string = 'http://localhost:8080'
  ): Promise<RTXBudgetCheckResult> {
    // Detect GPU
    const gpuInfo = await this.detectRTXGPU(userId, rtxLocalUrl);

    if (!gpuInfo) {
      return {
        useLocal: false,
        reason: 'No RTX GPU detected',
        estimatedCloudCost: this.estimateCloudCost(model, inputTokens, outputTokens),
        estimatedLocalTimeMs: 0,
        costSaved: 0,
        gpuMemoryRequired: 0,
        sufficientGPUMemory: false,
        rtxDetected: false,
      };
    }

    // Check if model is available locally
    const modelAvailable = await this.isModelAvailableLocally(model, rtxLocalUrl);

    if (!modelAvailable) {
      return {
        useLocal: false,
        reason: `Model ${model} not available locally`,
        estimatedCloudCost: this.estimateCloudCost(model, inputTokens, outputTokens),
        estimatedLocalTimeMs: 0,
        costSaved: 0,
        gpuMemoryRequired: 0,
        sufficientGPUMemory: true,
        rtxDetected: true,
      };
    }

    // Estimate memory requirements
    const gpuMemoryRequired = this.estimateGPUMemory(model, inputTokens + outputTokens);
    const sufficientGPUMemory = gpuInfo.totalMemory > gpuMemoryRequired;

    if (!sufficientGPUMemory) {
      return {
        useLocal: false,
        reason: `Insufficient GPU memory (need ${(gpuMemoryRequired / 1024**3).toFixed(2)}GB, have ${(gpuInfo.totalMemory / 1024**3).toFixed(2)}GB)`,
        estimatedCloudCost: this.estimateCloudCost(model, inputTokens, outputTokens),
        estimatedLocalTimeMs: 0,
        costSaved: 0,
        gpuMemoryRequired,
        sufficientGPUMemory: false,
        rtxDetected: true,
      };
    }

    // Calculate savings
    const estimatedCloudCost = this.estimateCloudCost(model, inputTokens, outputTokens);
    const estimatedLocalTimeMs = this.estimateLocalInferenceTime(model, inputTokens + outputTokens, gpuInfo);

    return {
      useLocal: true,
      reason: `RTX GPU available with sufficient memory (${(gpuInfo.totalMemory / 1024**3).toFixed(1)}GB)`,
      estimatedCloudCost,
      estimatedLocalTimeMs,
      costSaved: estimatedCloudCost,
      gpuMemoryRequired,
      sufficientGPUMemory: true,
      rtxDetected: true,
    };
  }

  /**
   * Check if model is available locally
   */
  private async isModelAvailableLocally(
    model: string,
    rtxLocalUrl: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${rtxLocalUrl}/models/${model}/available`, {
        signal: AbortSignal.timeout(1000),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json() as { available: boolean };
      return data.available;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cloud API cost
   */
  private estimateCloudCost(model: string, inputTokens: number, outputTokens: number): number {
    // Simplified pricing (adjust based on actual pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
      'claude-3-5-haiku': { input: 0.80, output: 4.00 },
      'llama-3.1-8b': { input: 0.10, output: 0.10 },
      'mistral-7b': { input: 0.07, output: 0.07 },
    };

    const modelPricing = pricing[model] || pricing['llama-3.1-8b'];

    return (
      (inputTokens / 1_000_000) * modelPricing.input +
      (outputTokens / 1_000_000) * modelPricing.output
    );
  }

  /**
   * Estimate GPU memory requirements
   */
  private estimateGPUMemory(model: string, totalTokens: number): number {
    // Rough estimate: ~2GB base + 0.5GB per 1K tokens
    const baseMemory = 2 * 1024 * 1024 * 1024; // 2GB
    const tokenMemory = (totalTokens / 1000) * 0.5 * 1024 * 1024 * 1024; // 0.5GB per 1K tokens

    return baseMemory + tokenMemory;
  }

  /**
   * Estimate local inference time
   */
  private estimateLocalInferenceTime(
    model: string,
    totalTokens: number,
    gpuInfo: RTXGPUInfo
  ): number {
    // Rough estimate: ~50 tokens/ms on RTX 4090, scale based on GPU
    const baselineTokensPerMs = 50;
    const gpuScaleFactor = gpuInfo.tensorRTSupported ? 2.0 : 1.0;

    return totalTokens / (baselineTokensPerMs * gpuScaleFactor);
  }

  /**
   * Record local vs cloud usage
   *
   * @param env Cloudflare Worker environment
   * @param record Usage record
   */
  async recordLocalCloudUsage(
    env: { DB: D1Database; BUDGET_CACHE: KVNamespace },
    record: Omit<LocalCloudUsageRecord, 'id' | 'timestamp'>
  ): Promise<LocalCloudUsageRecord> {
    const usageRecord: LocalCloudUsageRecord = {
      id: crypto.randomUUID(),
      ...record,
      timestamp: new Date().toISOString(),
    };

    // Insert into database
    await env.DB
      .prepare(`INSERT INTO local_cloud_usage (
        id, user_id, is_local, model, operation, input_tokens, output_tokens,
        execution_time_ms, actual_cost, estimated_cloud_cost, cost_saved,
        gpu_memory_used, tokens_per_second, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        usageRecord.id,
        usageRecord.userId,
        usageRecord.isLocal ? 1 : 0,
        usageRecord.model,
        usageRecord.operation,
        usageRecord.inputTokens,
        usageRecord.outputTokens,
        usageRecord.executionTimeMs,
        usageRecord.actualCost,
        usageRecord.estimatedCloudCost,
        usageRecord.costSaved,
        usageRecord.gpuMemoryUsed ?? null,
        usageRecord.tokensPerSecond ?? null,
        usageRecord.timestamp
      )
      .run();

    // Clear cache
    await env.BUDGET_CACHE.delete(`budget:${usageRecord.userId}`);
    await env.BUDGET_CACHE.delete(`local-cloud:${usageRecord.userId}`);

    return usageRecord;
  }

  /**
   * Get local vs cloud usage statistics
   *
   * @param env Cloudflare Worker environment
   * @param userId User ID
   * @param date Date (YYYY-MM-DD), defaults to today
   * @returns Usage statistics
   */
  async getLocalCloudStats(
    env: { DB: D1Database; BUDGET_CACHE: KVNamespace },
    userId: string,
    date: string = new Date().toISOString().split('T')[0]
  ): Promise<LocalCloudStats> {
    // Try cache first
    const cached = await env.BUDGET_CACHE.get(
      `local-cloud:${userId}:${date}`,
      'json'
    ) as LocalCloudStats | null;

    if (cached) {
      return cached;
    }

    // Query database
    const result = await env.DB
      .prepare(`SELECT
        SUM(CASE WHEN is_local = 1 THEN 1 ELSE 0 END) as local_inferences,
        SUM(CASE WHEN is_local = 0 THEN 1 ELSE 0 END) as cloud_calls,
        SUM(CASE WHEN is_local = 1 THEN input_tokens + output_tokens ELSE 0 END) as local_tokens,
        SUM(CASE WHEN is_local = 0 THEN input_tokens + output_tokens ELSE 0 END) as cloud_tokens,
        SUM(CASE WHEN is_local = 0 THEN actual_cost ELSE 0 END) as cloud_cost,
        SUM(CASE WHEN is_local = 1 THEN cost_saved ELSE 0 END) as estimated_savings,
        AVG(CASE WHEN is_local = 1 THEN tokens_per_second ELSE NULL END) as avg_tokens_per_second,
        SUM(CASE WHEN is_local = 1 THEN execution_time_ms ELSE 0 END) as total_local_time_ms
        FROM local_cloud_usage
        WHERE user_id = ? AND date(timestamp) = ?`)
      .bind(userId, date)
      .first();

    const stats: LocalCloudStats = {
      userId,
      date,
      localInferences: result?.local_inferences ?? 0,
      cloudCalls: result?.cloud_calls ?? 0,
      localTokens: result?.local_tokens ?? 0,
      cloudTokens: result?.cloud_tokens ?? 0,
      cloudCost: result?.cloud_cost ?? 0,
      estimatedSavings: result?.estimated_savings ?? 0,
      avgLocalTokensPerSecond: result?.avg_tokens_per_second ?? 0,
      gpuHours: ((result?.total_local_time_ms ?? 0) / 1000 / 3600),
      localProcessingPercent: 0,
    };

    const totalInferences = stats.localInferences + stats.cloudCalls;
    if (totalInferences > 0) {
      stats.localProcessingPercent = (stats.localInferences / totalInferences) * 100;
    }

    // Get GPU info
    const gpuInfo = await this.detectRTXGPU(userId);
    if (gpuInfo) {
      stats.gpuInfo = gpuInfo;
    }

    // Cache for 60 seconds
    await env.BUDGET_CACHE.put(
      `local-cloud:${userId}:${date}`,
      JSON.stringify(stats),
      { expirationTtl: 60 }
    );

    return stats;
  }

  /**
   * Get savings summary for a user
   *
   * @param env Cloudflare Worker environment
   * @param userId User ID
   * @param days Number of days to include
   * @returns Savings summary
   */
  async getSavingsSummary(
    env: { DB: D1Database },
    userId: string,
    days: number = 30
  ): Promise<{
    totalSaved: number;
    totalCloudCost: number;
    totalLocalInferences: number;
    totalCloudCalls: number;
    avgDailySavings: number;
    bestDay: { date: string; savings: number };
  }> {
    const result = await env.DB
      .prepare(`SELECT
        date(timestamp) as date,
        SUM(cost_saved) as daily_savings,
        SUM(actual_cost) as daily_cloud_cost,
        SUM(CASE WHEN is_local = 1 THEN 1 ELSE 0 END) as daily_local,
        SUM(CASE WHEN is_local = 0 THEN 1 ELSE 0 END) as daily_cloud
        FROM local_cloud_usage
        WHERE user_id = ? AND timestamp >= date('now', '-' || ? || ' days')
        GROUP BY date(timestamp)
        ORDER BY date DESC`)
      .bind(userId, days)
      .all();

    let totalSaved = 0;
    let totalCloudCost = 0;
    let totalLocalInferences = 0;
    let totalCloudCalls = 0;
    let maxDailySavings = 0;
    let bestDate = '';

    for (const row of result.results as any[]) {
      totalSaved += row.daily_savings;
      totalCloudCost += row.daily_cloud_cost;
      totalLocalInferences += row.daily_local;
      totalCloudCalls += row.daily_cloud;

      if (row.daily_savings > maxDailySavings) {
        maxDailySavings = row.daily_savings;
        bestDate = row.date;
      }
    }

    return {
      totalSaved,
      totalCloudCost,
      totalLocalInferences,
      totalCloudCalls,
      avgDailySavings: totalSaved / days,
      bestDay: { date: bestDate, savings: maxDailySavings },
    };
  }
}

// ============================================================================
// SQL Schema for RTX Support
// ============================================================================

/**
 * SQL to add local_cloud_usage table to existing database
 *
 * Run this on existing D1 databases to enable RTX tracking:
 *
 * ```sql
 * -- Include this in schema.sql
 * CREATE TABLE IF NOT EXISTS local_cloud_usage (
 *   id TEXT PRIMARY KEY,
 *   user_id TEXT NOT NULL,
 *   is_local INTEGER NOT NULL,
 *   model TEXT NOT NULL,
 *   operation TEXT NOT NULL,
 *   input_tokens INTEGER NOT NULL,
 *   output_tokens INTEGER NOT NULL,
 *   execution_time_ms REAL NOT NULL,
 *   actual_cost REAL NOT NULL,
 *   estimated_cloud_cost REAL NOT NULL,
 *   cost_saved REAL NOT NULL,
 *   gpu_memory_used INTEGER,
 *   tokens_per_second REAL,
 *   timestamp TEXT NOT NULL,
 *   INDEX idx_user_date (user_id, date(timestamp))
 * );
 * ```
 */
export const RTX_SUPPORT_SQL = `
CREATE TABLE IF NOT EXISTS local_cloud_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  is_local INTEGER NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  execution_time_ms REAL NOT NULL,
  actual_cost REAL NOT NULL,
  estimated_cloud_cost REAL NOT NULL,
  cost_saved REAL NOT NULL,
  gpu_memory_used INTEGER,
  tokens_per_second REAL,
  timestamp TEXT NOT NULL,
  INDEX idx_user_date (user_id, date(timestamp))
);
`;

// ============================================================================
// Export
// ============================================================================

export default RTXBudgetTracker;
