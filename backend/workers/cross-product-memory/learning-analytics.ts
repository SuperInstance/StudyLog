/**
 * Learning Analytics Engine
 *
 * Tracks cross-product growth and provides insights into how learning
 * transfers between StudyLoG.AI, DMLoG.AI, and other products.
 *
 * Key Metrics:
 * - Overall growth across products
 * - Skill transfer efficacy
 * - Cross-product synergy score
 * - Learning velocity
 * - Retention rates
 *
 * Analytics help users understand:
 * - Which skills transfer best between products
 * - Where to focus learning efforts
 * - How their abilities are developing holistically
 * - Which product combinations work best for their learning style
 */

import {
  Product,
  TransferCategory,
  CrossProductAnalytics,
  GrowthMetrics,
  ProductBreakdown,
  TransferStatistics,
  SkillSynthesisReport,
  AnalyticsRecommendation,
  TransferDirection,
} from './types.js';
import type { SharedIdentityManager } from './shared-identity.js';
import type { SkillSynthesisEngine } from './skill-synthesis.js';

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Time period for analytics
 */
export type AnalyticsPeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'all';

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Default period for analytics */
  defaultPeriod: AnalyticsPeriod;
  /** Minimum data points for trend analysis */
  minDataPointsForTrend: number;
  /** Synergy calculation weights */
  synergyWeights: {
    skillTransfer: number;
    practiceConsistency: number;
    traitAlignment: number;
    categoryBreadth: number;
  };
  /** Growth velocity window (ms) */
  velocityWindow: number;
}

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG: AnalyticsConfig = {
  defaultPeriod: 'month',
  minDataPointsForTrend: 5,
  synergyWeights: {
    skillTransfer: 0.35,
    practiceConsistency: 0.25,
    traitAlignment: 0.25,
    categoryBreadth: 0.15,
  },
  velocityWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ============================================================================
// Data Points
// ============================================================================

/**
 * A data point for time-series analysis
 */
export interface AnalyticsDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Product */
  product: Product;
  /** Event type */
  eventType: 'practice' | 'transfer' | 'synthesis' | 'milestone';
  /** Associated category */
  category?: TransferCategory;
  /** Value/metric */
  value: number;
  /** Context */
  context?: string;
}

/**
 * Product activity snapshot
 */
export interface ProductActivity {
  /** Product */
  product: Product;
  /** Active time in period (ms) */
  activeTime: number;
  /** Session count */
  sessionCount: number;
  /** Skills practiced */
  skillsPracticed: number;
  /** Skills learned (new) */
  skillsLearned: number;
  /** Transfers out */
  transfersOut: number;
  /** Transfers in */
  transfersIn: number;
  /** Average session quality (0-1) */
  avgSessionQuality: number;
}

// ============================================================================
// Learning Analytics Engine
// ============================================================================

/**
 * Engine for cross-product learning analytics
 */
export class LearningAnalyticsEngine {
  private readonly config: AnalyticsConfig;
  private readonly identityManager: SharedIdentityManager | null;
  private readonly synthesisEngine: SkillSynthesisEngine | null;
  private readonly dataPoints: Map<string, AnalyticsDataPoint[]>;
  private readonly activityCache: Map<string, Map<string, ProductActivity>>;

  constructor(
    identityManager: SharedIdentityManager | null = null,
    synthesisEngine: SkillSynthesisEngine | null = null,
    config?: Partial<AnalyticsConfig>
  ) {
    this.config = {
      ...DEFAULT_ANALYTICS_CONFIG,
      ...config,
      synergyWeights: {
        ...DEFAULT_ANALYTICS_CONFIG.synergyWeights,
        ...config?.synergyWeights,
      },
    };
    this.identityManager = identityManager;
    this.synthesisEngine = synthesisEngine;
    this.dataPoints = new Map();
    this.activityCache = new Map();
  }

  // ========================================================================
  // Data Collection
  // ========================================================================

  /**
   * Record an analytics data point
   */
  async recordDataPoint(
    unifiedId: string,
    dataPoint: AnalyticsDataPoint
  ): Promise<void> {
    let points = this.dataPoints.get(unifiedId);
    if (!points) {
      points = [];
      this.dataPoints.set(unifiedId, points);
    }

    points.push(dataPoint);

    // Invalidate activity cache
    this.activityCache.delete(unifiedId);
  }

  /**
   * Record multiple data points
   */
  async recordDataPoints(
    unifiedId: string,
    dataPoints: AnalyticsDataPoint[]
  ): Promise<void> {
    for (const point of dataPoints) {
      await this.recordDataPoint(unifiedId, point);
    }
  }

  /**
   * Record a practice event
   */
  async recordPractice(
    unifiedId: string,
    product: Product,
    category: TransferCategory,
    success: number,
    timeSpent: number
  ): Promise<void> {
    await this.recordDataPoint(unifiedId, {
      timestamp: Date.now(),
      product,
      eventType: 'practice',
      category,
      value: success,
      context: `time_spent:${timeSpent}`,
    });
  }

  /**
   * Record a transfer event
   */
  async recordTransfer(
    unifiedId: string,
    sourceProduct: Product,
    targetProduct: Product,
    category: TransferCategory,
    confidence: number
  ): Promise<void> {
    await this.recordDataPoint(unifiedId, {
      timestamp: Date.now(),
      product: sourceProduct,
      eventType: 'transfer',
      category,
      value: confidence,
      context: `target:${targetProduct}`,
    });
  }

  /**
   * Record a synthesis event
   */
  async recordSynthesis(
    unifiedId: string,
    skillName: string,
    quality: number
  ): Promise<void> {
    await this.recordDataPoint(unifiedId, {
      timestamp: Date.now(),
      product: Product.STUDYLOG, // Synthesis is cross-product
      eventType: 'synthesis',
      value: quality,
      context: `skill:${skillName}`,
    });
  }

  // ========================================================================
  // Analytics Generation
  // ========================================================================

  /**
   * Generate comprehensive cross-product analytics
   */
  async generateAnalytics(
    unifiedId: string,
    period: AnalyticsPeriod = this.config.defaultPeriod
  ): Promise<CrossProductAnalytics | null> {
    if (!this.identityManager) return null;

    const identity = this.identityManager.getIdentity(unifiedId);
    if (!identity) return null;

    const { periodStart, periodEnd } = this.getPeriodBounds(period);

    // Get relevant data points
    const dataPoints = this.getDataPointsInPeriod(unifiedId, periodStart, periodEnd);

    // Generate growth metrics
    const growth = this.calculateGrowthMetrics(unifiedId, dataPoints);

    // Generate product breakdown
    const productBreakdown = this.calculateProductBreakdown(unifiedId, dataPoints, periodStart, periodEnd);

    // Generate transfer statistics
    const transferStats = this.calculateTransferStatistics(unifiedId, dataPoints);

    // Generate skill synthesis report
    const skillSynthesis = await this.generateSkillSynthesisReport(unifiedId);

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      unifiedId,
      growth,
      productBreakdown,
      transferStats
    );

    return {
      unifiedId,
      periodStart,
      periodEnd,
      growth,
      productBreakdown,
      transferStats,
      skillSynthesis,
      recommendations,
      generatedAt: Date.now(),
    };
  }

  /**
   * Calculate growth metrics
   */
  private calculateGrowthMetrics(
    unifiedId: string,
    dataPoints: AnalyticsDataPoint[]
  ): GrowthMetrics {
    if (!this.identityManager) {
      return this.getEmptyGrowthMetrics();
    }

    const identity = this.identityManager.getIdentity(unifiedId);
    if (!identity) return this.getEmptyGrowthMetrics();

    // Overall growth - average skill improvement
    const skills = this.identityManager.getSkills(unifiedId);
    const overallGrowth = skills.length > 0
      ? skills.reduce((sum, s) => sum + s.level, 0) / skills.length
      : 0;

    // Strongest categories
    const categoryScores = new Map<TransferCategory, number>();
    for (const skill of skills) {
      const current = categoryScores.get(skill.category) ?? 0;
      categoryScores.set(skill.category, current + skill.level);
    }

    const strongestCategories = Array.from(categoryScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);

    // Areas needing attention (categories with low levels)
    const attentionAreas = Array.from(categoryScores.entries())
      .filter(([_, score]) => score < 0.5)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // Synergy score
    const synergyScore = this.calculateSynergyScore(unifiedId, dataPoints);

    // Learning velocity - skills per week
    const practicePoints = dataPoints.filter(p => p.eventType === 'practice');
    const velocityWindow = this.config.velocityWindow;
    const recentPractices = practicePoints.filter(
      p => Date.now() - p.timestamp <= velocityWindow
    );
    const learningVelocity = recentPractices.length / (velocityWindow / (7 * 24 * 60 * 60 * 1000));

    // Retention rate - skills still practiced after learning
    const retentionRate = this.calculateRetentionRate(unifiedId, practicePoints);

    return {
      overallGrowth,
      strongestCategories,
      attentionAreas,
      synergyScore,
      learningVelocity,
      retentionRate,
    };
  }

  /**
   * Calculate cross-product synergy score
   */
  private calculateSynergyScore(
    unifiedId: string,
    dataPoints: AnalyticsDataPoint[]
  ): number {
    const weights = this.config.synergyWeights;
    let score = 0;

    if (!this.identityManager) return 0;

    // Skill transfer component
    const transferPoints = dataPoints.filter(p => p.eventType === 'transfer');
    const successfulTransfers = transferPoints.filter(p => p.value > 0.7).length;
    const skillTransferScore = transferPoints.length > 0
      ? successfulTransfers / transferPoints.length
      : 0;
    score += skillTransferScore * weights.skillTransfer;

    // Practice consistency component
    const practicesByProduct = new Map<Product, number>();
    for (const point of dataPoints) {
      if (point.eventType === 'practice') {
        const current = practicesByProduct.get(point.product) ?? 0;
        practicesByProduct.set(point.product, current + 1);
      }
    }
    const practiceCounts = Array.from(practicesByProduct.values());
    const practiceConsistency = practiceCounts.length > 1
      ? 1 - (Math.max(...practiceCounts) - Math.min(...practiceCounts)) / Math.max(...practiceCounts)
      : 0;
    score += practiceConsistency * weights.practiceConsistency;

    // Trait alignment component
    const traits = this.identityManager.getTraits(unifiedId);
    const avgTraitConfidence = traits.length > 0
      ? traits.reduce((sum, t) => sum + t.confidence, 0) / traits.length
      : 0;
    score += avgTraitConfidence * weights.traitAlignment;

    // Category breadth component
    const categories = new Set(
      dataPoints.filter(p => p.category).map(p => p.category!)
    );
    const categoryBreadth = Math.min(1, categories.size / 10);
    score += categoryBreadth * weights.categoryBreadth;

    return Math.min(1, score);
  }

  /**
   * Calculate retention rate
   */
  private calculateRetentionRate(
    unifiedId: string,
    practicePoints: AnalyticsDataPoint[]
  ): number {
    if (practicePoints.length === 0) return 0;

    // Group by skill/category
    const firstPractices = new Map<string, number>();
    const lastPractices = new Map<string, number>();

    for (const point of practicePoints) {
      const key = `${point.product}_${point.category ?? 'unknown'}`;

      if (!firstPractices.has(key)) {
        firstPractices.set(key, point.timestamp);
      }
      lastPractices.set(key, point.timestamp);
    }

    // Count skills practiced multiple times (retained)
    let retainedCount = 0;
    for (const [key, first] of firstPractices) {
      const last = lastPractices.get(key);
      if (last && last - first > 7 * 24 * 60 * 60 * 1000) { // Practiced again after a week
        retainedCount++;
      }
    }

    return firstPractices.size > 0 ? retainedCount / firstPractices.size : 0;
  }

  /**
   * Calculate product breakdown
   */
  private calculateProductBreakdown(
    unifiedId: string,
    dataPoints: AnalyticsDataPoint[],
    periodStart: number,
    periodEnd: number
  ): ProductBreakdown[] {
    const byProduct = new Map<Product, ProductBreakdown>();

    // Initialize for all active products
    if (this.identityManager) {
      const identity = this.identityManager.getIdentity(unifiedId);
      if (identity) {
        for (const pi of identity.productIdentities) {
          byProduct.set(pi.product, {
            product: pi.product,
            timeSpent: 0,
            skillsLearned: 0,
            skillsTransferredOut: 0,
            skillsTransferredIn: 0,
            activeSessions: 0,
            engagementScore: 0,
          });
        }
      }
    }

    // Process data points
    for (const point of dataPoints) {
      let breakdown = byProduct.get(point.product);
      if (!breakdown) {
        breakdown = {
          product: point.product,
          timeSpent: 0,
          skillsLearned: 0,
          skillsTransferredOut: 0,
          skillsTransferredIn: 0,
          activeSessions: 0,
          engagementScore: 0,
        };
        byProduct.set(point.product, breakdown);
      }

      switch (point.eventType) {
        case 'practice':
          // Extract time from context
          const timeMatch = point.context?.match(/time_spent:(\d+)/);
          if (timeMatch) {
            breakdown.timeSpent += parseInt(timeMatch[1], 10);
          }
          breakdown.activeSessions++;
          break;
        case 'transfer':
          breakdown.skillsTransferredOut++;
          break;
      }
    }

    // Calculate engagement scores
    for (const [product, breakdown] of byProduct) {
      const productPoints = dataPoints.filter(p => p.product === product);
      const avgQuality = productPoints.length > 0
        ? productPoints.reduce((sum, p) => sum + p.value, 0) / productPoints.length
        : 0;
      const sessionFrequency = productPoints.length / ((periodEnd - periodStart) / (24 * 60 * 60 * 1000));

      breakdown.engagementScore = (avgQuality * 0.6) + (Math.min(1, sessionFrequency / 7) * 0.4);
    }

    return Array.from(byProduct.values()).sort((a, b) => b.timeSpent - a.timeSpent);
  }

  /**
   * Calculate transfer statistics
   */
  private calculateTransferStatistics(
    unifiedId: string,
    dataPoints: AnalyticsDataPoint[]
  ): TransferStatistics {
    const transferPoints = dataPoints.filter(p => p.eventType === 'transfer');

    const byCategory: Record<string, number> = {};
    const byDirection: Record<string, number> = {};

    let totalConfidence = 0;
    let successCount = 0;

    for (const point of transferPoints) {
      // Count by category
      if (point.category) {
        byCategory[point.category] = (byCategory[point.category] ?? 0) + 1;
      }

      // Count by direction
      const targetMatch = point.context?.match(/target:(\w+)/);
      if (targetMatch) {
        const direction = `${point.product}_to_${targetMatch[1]}`;
        byDirection[direction] = (byDirection[direction] ?? 0) + 1;
      }

      totalConfidence += point.value;
      if (point.value > 0.7) successCount++;
    }

    return {
      totalProposed: transferPoints.length,
      totalApproved: transferPoints.filter(p => p.value > this.config.synergyWeights.skillTransfer).length,
      totalRejected: transferPoints.filter(p => p.value < 0.3).length,
      totalApplied: successCount,
      approvalRate: transferPoints.length > 0 ? successCount / transferPoints.length : 0,
      byCategory: byCategory as Record<TransferCategory, number>,
      byDirection: byDirection as Record<TransferDirection, number>,
      avgConfidence: transferPoints.length > 0 ? totalConfidence / transferPoints.length : 0,
      successRate: transferPoints.length > 0 ? successCount / transferPoints.length : 0,
    };
  }

  /**
   * Generate skill synthesis report
   */
  private async generateSkillSynthesisReport(
    unifiedId: string
  ): Promise<SkillSynthesisReport> {
    if (!this.synthesisEngine) {
      return {
        synthesizedSkills: [],
        candidates: [],
        rejected: [],
      };
    }

    const report = await this.synthesisEngine.generateSynthesisReport(unifiedId);

    return {
      synthesizedSkills: report.synthesized,
      candidates: report.candidates,
      rejected: report.rejected,
    };
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(
    unifiedId: string,
    growth: GrowthMetrics,
    productBreakdown: ProductBreakdown[],
    transferStats: TransferStatistics
  ): Promise<AnalyticsRecommendation[]> {
    const recommendations: AnalyticsRecommendation[] = [];

    // Check for underutilized products
    const mostUsedProduct = productBreakdown[0];
    for (const product of productBreakdown) {
      if (product.product === mostUsedProduct.product) continue;

      const usageRatio = product.timeSpent / Math.max(1, mostUsedProduct.timeSpent);
      if (usageRatio < 0.3) {
        recommendations.push({
          type: 'product_explore',
          title: `Explore ${product.product}`,
          description: `You've been spending most of your time in ${mostUsedProduct.product}. Try exploring ${product.product} to develop new skills.`,
          priority: 0.7,
          expectedImpact: 0.6,
          steps: [
            `Start a beginner session in ${product.product}`,
            'Complete the tutorial',
            'Try one activity per day for a week',
          ],
          related: [product.product],
        });
      }
    }

    // Check for skill focus areas
    for (const category of growth.attentionAreas) {
      recommendations.push({
        type: 'skill_focus',
        title: `Develop ${category} skills`,
        description: `Your ${category} skills could use some attention. Focus on activities that build this area.`,
        priority: 0.6,
        expectedImpact: 0.5,
        steps: [
          `Find activities focusing on ${category}`,
          'Practice consistently for two weeks',
          'Track your progress',
        ],
        related: [category],
      });
    }

    // Check transfer optimization
    if (transferStats.avgConfidence < 0.7 && transferStats.totalProposed > 5) {
      recommendations.push({
        type: 'transfer_enable',
        title: 'Improve skill transfer',
        description: 'Your skill transfers could be more effective. Focus on building deeper skills before transferring.',
        priority: 0.5,
        expectedImpact: 0.4,
        steps: [
          'Practice skills to higher levels in source product',
          'Wait for consolidation before attempting transfer',
          'Focus on high-confidence categories',
        ],
        related: [],
      });
    }

    // Check for practice suggestions
    const lowEngagementProducts = productBreakdown.filter(p => p.engagementScore < 0.4);
    for (const product of lowEngagementProducts) {
      recommendations.push({
        type: 'practice_suggest',
        title: `Increase engagement in ${product.product}`,
        description: `Your engagement in ${product.product} is low. Try more challenging or interesting activities.`,
        priority: 0.5,
        expectedImpact: 0.5,
        steps: [
          'Try a higher difficulty level',
          'Explore new activity types',
          'Set smaller, achievable goals',
        ],
        related: [product.product],
      });
    }

    // Sort by priority and limit
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  // ========================================================================
  // Trend Analysis
  // ========================================================================

  /**
   * Analyze trends over time
   */
  analyzeTrends(
    unifiedId: string,
    metric: 'overall_growth' | 'synergy' | 'velocity' | 'retention',
    period: AnalyticsPeriod = this.config.defaultPeriod
  ): {
    trend: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    confidence: number;
    dataPoints: Array<{ timestamp: number; value: number }>;
  } | null {
    const dataPoints = this.dataPoints.get(unifiedId);
    if (!dataPoints || dataPoints.length < this.config.minDataPointsForTrend) {
      return null;
    }

    const { periodStart, periodEnd } = this.getPeriodBounds(period);
    const periodPoints = dataPoints.filter(p => p.timestamp >= periodStart && p.timestamp <= periodEnd);

    if (periodPoints.length < this.config.minDataPointsForTrend) {
      return null;
    }

    // Calculate values based on metric type
    const values = this.calculateMetricValues(unifiedId, periodPoints, metric);

    // Linear regression to find trend
    const n = values.length;
    const sumX = values.reduce((sum, v, i) => sum + i, 0);
    const sumY = values.reduce((sum, v) => sum + v.value, 0);
    const sumXY = values.reduce((sum, v, i) => sum + (i * v.value), 0);
    const sumX2 = values.reduce((sum, _, i) => sum + (i * i), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const yIntercept = (sumY - slope * sumX) / n;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Calculate R² for confidence
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, v) => sum + Math.pow(v.value - yMean, 2), 0);
    const ssResidual = values.reduce((sum, v, i) => {
      const predicted = yIntercept + slope * i;
      return sum + Math.pow(v.value - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;

    return {
      trend,
      slope,
      confidence: rSquared,
      dataPoints: values,
    };
  }

  /**
   * Calculate metric values for trend analysis
   */
  private calculateMetricValues(
    unifiedId: string,
    dataPoints: AnalyticsDataPoint[],
    metric: string
  ): Array<{ timestamp: number; value: number }> {
    // Group by time buckets (e.g., days)
    const bucketSize = 24 * 60 * 60 * 1000; // 1 day
    const buckets = new Map<number, AnalyticsDataPoint[]>();

    for (const point of dataPoints) {
      const bucket = Math.floor(point.timestamp / bucketSize) * bucketSize;
      const bucketPoints = buckets.get(bucket) ?? [];
      bucketPoints.push(point);
      buckets.set(bucket, bucketPoints);
    }

    // Calculate value for each bucket
    return Array.from(buckets.entries()).map(([timestamp, points]) => {
      let value = 0;

      switch (metric) {
        case 'overall_growth':
          value = points.filter(p => p.eventType === 'practice')
            .reduce((sum, p) => sum + p.value, 0) / Math.max(1, points.length);
          break;
        case 'synergy':
          const products = new Set(points.map(p => p.product)).size;
          value = Math.min(1, products / 3);
          break;
        case 'velocity':
          value = points.filter(p => p.eventType === 'practice').length;
          break;
        case 'retention':
          value = points.filter(p => p.value > 0.5).length / Math.max(1, points.length);
          break;
      }

      return { timestamp, value };
    });
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get period bounds
   */
  private getPeriodBounds(period: AnalyticsPeriod): { periodStart: number; periodEnd: number } {
    const now = Date.now();
    let periodStart: number;

    switch (period) {
      case 'day':
        periodStart = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        periodStart = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        periodStart = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'quarter':
        periodStart = now - 90 * 24 * 60 * 60 * 1000;
        break;
      case 'year':
        periodStart = now - 365 * 24 * 60 * 60 * 1000;
        break;
      case 'all':
        periodStart = 0;
        break;
    }

    return { periodStart, periodEnd: now };
  }

  /**
   * Get data points within a period
   */
  private getDataPointsInPeriod(
    unifiedId: string,
    periodStart: number,
    periodEnd: number
  ): AnalyticsDataPoint[] {
    const points = this.dataPoints.get(unifiedId) ?? [];
    return points.filter(p => p.timestamp >= periodStart && p.timestamp <= periodEnd);
  }

  /**
   * Get empty growth metrics
   */
  private getEmptyGrowthMetrics(): GrowthMetrics {
    return {
      overallGrowth: 0,
      strongestCategories: [],
      attentionAreas: [],
      synergyScore: 0,
      learningVelocity: 0,
      retentionRate: 0,
    };
  }

  // ========================================================================
  // Export / Import
  // ========================================================================

  /**
   * Export analytics data for a user
   */
  exportUserData(unifiedId: string): {
    dataPoints: AnalyticsDataPoint[];
    exportTimestamp: number;
  } | null {
    const points = this.dataPoints.get(unifiedId);
    if (!points) return null;

    return {
      dataPoints: points,
      exportTimestamp: Date.now(),
    };
  }

  /**
   * Import analytics data for a user
   */
  importUserData(
    unifiedId: string,
    data: AnalyticsDataPoint[]
  ): void {
    let points = this.dataPoints.get(unifiedId);
    if (!points) {
      points = [];
      this.dataPoints.set(unifiedId, points);
    }

    points.push(...data);

    // Invalidate cache
    this.activityCache.delete(unifiedId);
  }

  /**
   * Clear all data for a user
   */
  clearUserData(unifiedId: string): void {
    this.dataPoints.delete(unifiedId);
    this.activityCache.delete(unifiedId);
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.dataPoints.clear();
    this.activityCache.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalUsers: number;
    totalDataPoints: number;
    avgPointsPerUser: number;
  } {
    let totalPoints = 0;

    for (const points of this.dataPoints.values()) {
      totalPoints += points.length;
    }

    return {
      totalUsers: this.dataPoints.size,
      totalDataPoints: totalPoints,
      avgPointsPerUser: this.dataPoints.size > 0 ? totalPoints / this.dataPoints.size : 0,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a learning analytics engine
 */
export function createLearningAnalyticsEngine(
  identityManager: SharedIdentityManager | null = null,
  synthesisEngine: SkillSynthesisEngine | null = null,
  config?: Partial<AnalyticsConfig>
): LearningAnalyticsEngine {
  return new LearningAnalyticsEngine(identityManager, synthesisEngine, config);
}

/**
 * Get default analytics configuration
 */
export function getDefaultAnalyticsConfig(): AnalyticsConfig {
  return { ...DEFAULT_ANALYTICS_CONFIG };
}
