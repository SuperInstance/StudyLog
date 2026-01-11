/**
 * Performance Monitor Module
 *
 * Tracks real-time performance metrics including FPS, latency, and resource usage.
 * Provides data for adaptive quality scaling decisions.
 *
 * @fileoverview Real-time performance monitoring system
 */

import type {
  PerformanceMetrics,
  PerformanceSample,
  PerformanceThresholds,
  ReportPerformanceRequest,
  ReportPerformanceResponse,
  AdaptiveScalingRecommendation,
  QualityTier,
} from './types.js';

// ============================================================================
// Default Thresholds
// ============================================================================

/**
 * Default performance thresholds.
 */
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  targetFps: 60,
  minFps: 30,
  maxFrameTime: 33.33, // ~30 FPS
  maxGpuUsage: 90,
  maxCpuUsage: 85,
  maxMemoryPercent: 85,
  degradationTimeout: 5000,  // 5 seconds of poor performance
  improvementTimeout: 15000, // 15 seconds of good performance
};

/**
 * Quality tier-specific thresholds.
 */
export const TIER_THRESHOLDS: Record<QualityTier, PerformanceThresholds> = {
  [QualityTier.POTATO]: {
    targetFps: 30,
    minFps: 24,
    maxFrameTime: 41.67,
    maxGpuUsage: 95,
    maxCpuUsage: 95,
    maxMemoryPercent: 95,
    degradationTimeout: 10000,
    improvementTimeout: 30000,
  },
  [QualityTier.LOW]: {
    targetFps: 45,
    minFps: 30,
    maxFrameTime: 33.33,
    maxGpuUsage: 90,
    maxCpuUsage: 90,
    maxMemoryPercent: 90,
    degradationTimeout: 8000,
    improvementTimeout: 20000,
  },
  [QualityTier.MEDIUM]: {
    targetFps: 60,
    minFps: 45,
    maxFrameTime: 22.22,
    maxGpuUsage: 85,
    maxCpuUsage: 85,
    maxMemoryPercent: 85,
    degradationTimeout: 5000,
    improvementTimeout: 15000,
  },
  [QualityTier.HIGH]: {
    targetFps: 90,
    minFps: 60,
    maxFrameTime: 16.67,
    maxGpuUsage: 80,
    maxCpuUsage: 80,
    maxMemoryPercent: 80,
    degradationTimeout: 3000,
    improvementTimeout: 10000,
  },
  [QualityTier.ULTRA]: {
    targetFps: 120,
    minFps: 90,
    maxFrameTime: 11.11,
    maxGpuUsage: 75,
    maxCpuUsage: 75,
    maxMemoryPercent: 75,
    degradationTimeout: 2000,
    improvementTimeout: 8000,
  },
};

// ============================================================================
// Performance Storage
// ============================================================================

/**
 * In-memory storage for performance samples by session.
 */
const performanceStore = new Map<string, PerformanceMetrics[]>();

/**
 * In-memory storage for completed samples.
 */
const sampleStore = new Map<string, PerformanceSample[]>();

/**
 * Current sample accumulators by session.
 */
const currentSampleAccumulators = new Map<string, {
  metrics: PerformanceMetrics[];
  startTime: number;
  minFps: number;
  maxFps: number;
  frameDrops: number;
}>();

// ============================================================================
// Performance Tracking
// ============================================================================

/**
 * Start tracking performance for a session.
 */
export function startTracking(sessionId: string): void {
  performanceStore.set(sessionId, []);
  currentSampleAccumulators.set(sessionId, {
    metrics: [],
    startTime: Date.now(),
    minFps: Infinity,
    maxFps: 0,
    frameDrops: 0,
  });
}

/**
 * Stop tracking performance for a session.
 */
export function stopTracking(sessionId: string): PerformanceSample[] {
  currentSampleAccumulators.delete(sessionId);
  const samples = sampleStore.get(sessionId) ?? [];
  sampleStore.delete(sessionId);
  performanceStore.delete(sessionId);
  return samples;
}

/**
 * Record a performance metric.
 */
export function recordMetric(sessionId: string, metrics: PerformanceMetrics): void {
  const sessionMetrics = performanceStore.get(sessionId);

  if (!sessionMetrics) {
    startTracking(sessionId);
  }

  performanceStore.get(sessionId)?.push(metrics);

  // Update accumulator
  const accumulator = currentSampleAccumulators.get(sessionId);
  if (accumulator) {
    accumulator.metrics.push(metrics);
    accumulator.minFps = Math.min(accumulator.minFps, metrics.fps);
    accumulator.maxFps = Math.max(accumulator.maxFps, metrics.fps);

    // Count frame drops
    if (metrics.fps < DEFAULT_THRESHOLDS.minFps) {
      accumulator.frameDrops++;
    }
  }
}

/**
 * Get recent metrics for a session.
 */
export function getRecentMetrics(sessionId: string, count: number = 100): PerformanceMetrics[] {
  const metrics = performanceStore.get(sessionId) ?? [];
  return metrics.slice(-count);
}

/**
 * Calculate a performance sample from accumulated metrics.
 */
export function calculateSample(sessionId: string): PerformanceSample | null {
  const accumulator = currentSampleAccumulators.get(sessionId);

  if (!accumulator || accumulator.metrics.length === 0) {
    return null;
  }

  const metrics = accumulator.metrics;
  const now = Date.now();

  // Calculate averages
  const avgFps = metrics.reduce((sum, m) => sum + m.fps, 0) / metrics.length;
  const avgFrameTime = metrics.reduce((sum, m) => sum + m.frameTime, 0) / metrics.length;
  const avgGpu = metrics.reduce((sum, m) => sum + m.gpuUsage, 0) / metrics.length;
  const avgCpu = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
  const avgMem = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;

  // Calculate standard deviation for FPS
  const fpsVariance = metrics.reduce((sum, m) => sum + Math.pow(m.fps - avgFps, 2), 0) / metrics.length;
  const fpsStdDev = Math.sqrt(fpsVariance);

  // Calculate performance score (0-100)
  const fpsScore = Math.min(100, (avgFps / DEFAULT_THRESHOLDS.targetFps) * 100);
  const resourceScore = 100 - ((avgGpu + avgCpu) / 2);
  const score = Math.max(0, Math.min(100, (fpsScore + resourceScore) / 2));

  const sample: PerformanceSample = {
    startTime: new Date(accumulator.startTime).toISOString(),
    endTime: new Date(now).toISOString(),
    frameCount: metrics.length,
    average: {
      fps: avgFps,
      avgFps,
      fps1stPercentile: avgFps - (fpsStdDev * 2.33), // Approximation
      frameTime: avgFrameTime,
      avgFrameTime,
      gpuUsage: avgGpu,
      cpuUsage: avgCpu,
      memoryUsage: avgMem,
      memoryPercent: avgMem,
      latency: metrics[metrics.length - 1]?.latency ?? 0,
      timeToFirstFrame: metrics[0]?.timeToFirstFrame ?? 0,
      timestamp: new Date(now).toISOString(),
    },
    minFps: accumulator.minFps,
    maxFps: accumulator.maxFps,
    fpsStdDev,
    frameDrops: accumulator.frameDrops,
    score,
  };

  // Store sample
  const samples = sampleStore.get(sessionId) ?? [];
  samples.push(sample);
  sampleStore.set(sessionId, samples);

  // Reset accumulator
  currentSampleAccumulators.set(sessionId, {
    metrics: [],
    startTime: now,
    minFps: Infinity,
    maxFps: 0,
    frameDrops: 0,
  });

  return sample;
}

/**
 * Get all samples for a session.
 */
export function getSamples(sessionId: string): PerformanceSample[] {
  return sampleStore.get(sessionId) ?? [];
}

/**
 * Get the latest sample for a session.
 */
export function getLatestSample(sessionId: string): PerformanceSample | null {
  const samples = sampleStore.get(sessionId);
  return samples?.[samples.length - 1] ?? null;
}

// ============================================================================
// Performance Analysis
// ============================================================================

/**
 * Calculate performance score from metrics (0-100).
 */
export function calculatePerformanceScore(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
): number {
  const fpsScore = (metrics.fps / thresholds.targetFps) * 50;
  const frameTimeScore = ((thresholds.maxFrameTime - metrics.frameTime) / thresholds.maxFrameTime) * 20;
  const resourceScore = (100 - Math.max(metrics.gpuUsage, metrics.cpuUsage)) * 0.3;

  return Math.max(0, Math.min(100, fpsScore + frameTimeScore + resourceScore));
}

/**
 * Check if performance is poor based on thresholds.
 */
export function isPerformancePoor(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
): boolean {
  return (
    metrics.fps < thresholds.minFps ||
    metrics.frameTime > thresholds.maxFrameTime ||
    metrics.gpuUsage > thresholds.maxGpuUsage ||
    metrics.cpuUsage > thresholds.maxCpuUsage ||
    metrics.memoryPercent > thresholds.maxMemoryPercent
  );
}

/**
 * Check if performance is good based on thresholds.
 */
export function isPerformanceGood(
  metrics: PerformanceMetrics,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
): boolean {
  return (
    metrics.fps >= thresholds.targetFps &&
    metrics.frameTime <= thresholds.maxFrameTime * 0.8 &&
    metrics.gpuUsage <= thresholds.maxGpuUsage * 0.8 &&
    metrics.cpuUsage <= thresholds.maxCpuUsage * 0.8
  );
}

/**
 * Analyze recent performance trends.
 */
export function analyzeTrend(sessionId: string): {
  trend: 'improving' | 'stable' | 'degrading';
  confidence: number;
  fpsChange: number;
} {
  const samples = getSamples(sessionId);

  if (samples.length < 2) {
    return { trend: 'stable', confidence: 0, fpsChange: 0 };
  }

  const recent = samples.slice(-5);
  const older = samples.slice(-10, -5);

  if (older.length === 0) {
    return { trend: 'stable', confidence: 0, fpsChange: 0 };
  }

  const recentAvgFps = recent.reduce((sum, s) => sum + s.average.fps, 0) / recent.length;
  const olderAvgFps = older.reduce((sum, s) => sum + s.average.fps, 0) / older.length;

  const change = recentAvgFps - olderAvgFps;
  const percentChange = (change / olderAvgFps) * 100;

  let trend: 'improving' | 'stable' | 'degrading';
  let confidence: number;

  if (Math.abs(percentChange) < 5) {
    trend = 'stable';
    confidence = 100 - Math.abs(percentChange) * 10;
  } else if (percentChange > 0) {
    trend = 'improving';
    confidence = Math.min(100, Math.abs(percentChange) * 5);
  } else {
    trend = 'degrading';
    confidence = Math.min(100, Math.abs(percentChange) * 5);
  }

  return { trend, confidence, fpsChange: change };
}

// ============================================================================
// Report Performance Handler
// ============================================================================

/**
 * Handle a performance report request.
 */
export function handleReportPerformance(
  request: ReportPerformanceRequest,
  currentTier: QualityTier = QualityTier.MEDIUM
): ReportPerformanceResponse {
  // Record the metric
  recordMetric(request.sessionId, request.metrics);

  // Calculate sample if we have enough data
  const accumulator = currentSampleAccumulators.get(request.sessionId);
  let sample: PerformanceSample | null = null;

  if (accumulator && accumulator.metrics.length >= 30) { // ~0.5 seconds at 60fps
    sample = calculateSample(request.sessionId);
  } else {
    sample = getLatestSample(request.sessionId);
  }

  const thresholds = TIER_THRESHOLDS[currentTier];
  const isPoor = isPerformancePoor(request.metrics, thresholds);
  const isGood = isPerformanceGood(request.metrics, thresholds);

  let recommendation: AdaptiveScalingRecommendation | undefined;
  let qualityChangeTriggered = false;

  if (request.triggerAdaptive && sample) {
    recommendation = generateRecommendation(sample, currentTier, thresholds);

    if (recommendation.action !== 'maintain') {
      qualityChangeTriggered = true;
    }
  }

  return {
    recorded: true,
    sample: sample ?? {
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      frameCount: 1,
      average: request.metrics,
      minFps: request.metrics.fps,
      maxFps: request.metrics.fps,
      fpsStdDev: 0,
      frameDrops: 0,
      score: calculatePerformanceScore(request.metrics, thresholds),
    },
    recommendation,
    qualityChangeTriggered,
  };
}

// ============================================================================
// Adaptive Scaling Recommendations
// ============================================================================

/**
 * Generate an adaptive scaling recommendation based on performance.
 */
export function generateRecommendation(
  sample: PerformanceSample,
  currentTier: QualityTier,
  thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS
): AdaptiveScalingRecommendation {
  const score = sample.score;

  // Very poor performance - recommend downgrade
  if (score < 30 || sample.average.fps < thresholds.minFps * 0.7) {
    const newTier = Math.max(QualityTier.POTATO, currentTier - 1) as QualityTier;

    return {
      action: newTier === currentTier ? 'maintain' : 'downgrade',
      recommendedTier: newTier,
      confidence: 0.9,
      reason: `Poor performance: ${sample.average.fps.toFixed(1)} FPS (target: ${thresholds.targetFps})`,
      performanceScore: score,
      expectedScore: Math.min(100, score + 20),
    };
  }

  // Poor performance with frame drops
  if (score < 50 || sample.frameDrops > sample.frameCount * 0.1) {
    const newTier = Math.max(QualityTier.POTATO, currentTier - 1) as QualityTier;

    return {
      action: newTier === currentTier ? 'maintain' : 'downgrade',
      recommendedTier: newTier,
      confidence: 0.7,
      reason: `${sample.frameDrops} frame drops detected`,
      performanceScore: score,
      expectedScore: Math.min(100, score + 15),
    };
  }

  // Excellent performance - recommend upgrade
  if (score > 85 && currentTier < QualityTier.ULTRA) {
    const trend = analyzeTrend(sample.average.timestamp.split(':')[0]); // Simplified

    if (trend.trend !== 'degrading') {
      const newTier = Math.min(QualityTier.ULTRA, currentTier + 1) as QualityTier;

      return {
        action: 'upgrade',
        recommendedTier: newTier,
        confidence: 0.6,
        reason: `Excellent performance: ${sample.average.fps.toFixed(1)} FPS`,
        performanceScore: score,
        expectedScore: Math.max(50, score - 15),
      };
    }
  }

  // Maintain current quality
  return {
    action: 'maintain',
    confidence: 1.0,
    reason: 'Performance within acceptable range',
    performanceScore: score,
  };
}

// ============================================================================
// Statistics and Aggregation
// ============================================================================

/**
 * Get performance statistics for a session.
 */
export function getSessionStats(sessionId: string): {
  sessionId: string;
  totalSamples: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgScore: number;
  totalFrameDrops: number;
  avgGpuUsage: number;
  avgCpuUsage: number;
} | null {
  const samples = getSamples(sessionId);

  if (samples.length === 0) {
    return null;
  }

  const totalFrameDrops = samples.reduce((sum, s) => sum + s.frameDrops, 0);
  const avgFps = samples.reduce((sum, s) => sum + s.average.fps, 0) / samples.length;
  const minFps = Math.min(...samples.map(s => s.minFps));
  const maxFps = Math.max(...samples.map(s => s.maxFps));
  const avgScore = samples.reduce((sum, s) => sum + s.score, 0) / samples.length;
  const avgGpu = samples.reduce((sum, s) => sum + s.average.gpuUsage, 0) / samples.length;
  const avgCpu = samples.reduce((sum, s) => sum + s.average.cpuUsage, 0) / samples.length;

  return {
    sessionId,
    totalSamples: samples.length,
    avgFps,
    minFps,
    maxFps,
    avgScore,
    totalFrameDrops,
    avgGpuUsage: avgGpu,
    avgCpuUsage: avgCpu,
  };
}

/**
 * Clear performance data for a session.
 */
export function clearSession(sessionId: string): void {
  performanceStore.delete(sessionId);
  sampleStore.delete(sessionId);
  currentSampleAccumulators.delete(sessionId);
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Create a performance monitor instance.
 */
export function createPerformanceMonitor() {
  return {
    start: startTracking,
    stop: stopTracking,
    record: recordMetric,
    getMetrics: getRecentMetrics,
    getSamples,
    getLatestSample,
    calculateSample,
    handleReport: handleReportPerformance,
    calculateScore: calculatePerformanceScore,
    isPoor: isPerformancePoor,
    isGood: isPerformanceGood,
    analyzeTrend,
    generateRecommendation,
    getSessionStats,
    clear: clearSession,
  };
}
