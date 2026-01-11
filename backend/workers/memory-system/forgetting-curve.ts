/**
 * StudyLoG.AI Memory System - Forgetting Curve & Spaced Repetition
 *
 * Implements the Ebbinghaus forgetting curve and spaced repetition
 * scheduling for optimal memory retention.
 *
 * Features:
 * - Forgetting curve calculation for memories and skills
 * - SM-2 (SuperMemo 2) spaced repetition algorithm
 * - Review scheduling and tracking
 * - Retention rate calculation
 * - Optimal review timing recommendations
 */

import {
  ForgettingCurve,
  ForgettingCurvePoint,
  ScheduledReview,
  ReviewRecommendation,
  MemoryTier,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory
} from './types.js';
import { HierarchicalMemory } from './memory-hierarchy.js';

// ============================================================================
// Forgetting Curve Configuration
// ============================================================================

export interface ForgettingCurveConfig {
  // Default parameters
  defaultHalfLife: number; // milliseconds
  defaultDecayRate: number;

  // Spaced repetition (SM-2 algorithm)
  initialInterval: number; // milliseconds
  minEaseFactor: number;
  defaultEaseFactor: number;
  easeFactorBoost: number;
  easeFactorPenalty: number;

  // Review thresholds
  minRetentionBeforeReview: number;
  urgentReviewThreshold: number;
  maxRetention: number;
}

export const DEFAULT_FORGETTING_CONFIG: ForgettingCurveConfig = {
  defaultHalfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
  defaultDecayRate: 0.1, // 10% per day
  initialInterval: 24 * 60 * 60 * 1000, // 1 day
  minEaseFactor: 1.3,
  defaultEaseFactor: 2.5,
  easeFactorBoost: 0.1,
  easeFactorPenalty: 0.2,
  minRetentionBeforeReview: 0.7,
  urgentReviewThreshold: 0.4,
  maxRetention: 0.95
};

// ============================================================================
// Forgetting Curve Calculator
// ============================================================================

/**
 * Calculates and tracks forgetting curves for memories
 */
export class ForgettingCurveCalculator {
  private _config: ForgettingCurveConfig;
  private _curves: Map<string, ForgettingCurve>;

  constructor(config: Partial<ForgettingCurveConfig> = {}) {
    this._config = { ...DEFAULT_FORGETTING_CONFIG, ...config };
    this._curves = new Map();
  }

  /**
   * Calculate forgetting curve for a memory
   * Uses exponential decay: R(t) = e^(-λt)
   */
  calculateCurve(
    memoryId: string,
    initialStrength: number = 1,
    daysToProject: number = 30
  ): ForgettingCurve {
    const curve: ForgettingCurve = {
      memoryId,
      curve: [],
      halflife: this._config.defaultHalfLife,
      decayRate: this._config.defaultDecayRate,
      lastCalculated: Date.now()
    };

    const dayMs = 24 * 60 * 60 * 1000;

    for (let day = 0; day <= daysToProject; day++) {
      const time = day * dayMs;
      // Exponential decay formula: R(t) = R0 * e^(-λt)
      const decay = Math.exp(-this._config.defaultDecayRate * day);
      const retention = initialStrength * decay;
      const strength = Math.max(0, retention);

      curve.curve.push({ time, retention, strength });

      // Calculate half-life (time to 50% retention)
      if (retention < 0.5 && curve.halflife === this._config.defaultHalfLife) {
        curve.halflife = time;
      }
    }

    this._curves.set(memoryId, curve);
    return curve;
  }

  /**
   * Get retention at a specific time
   */
  getRetentionAt(memoryId: string, timeMs: number): number {
    const curve = this._curves.get(memoryId);
    if (!curve) {
      this.calculateCurve(memoryId);
      return this.getRetentionAt(memoryId, timeMs);
    }

    // Find closest point
    const point = curve.curve.find(p => p.time >= timeMs);
    if (point) {
      return point.retention;
    }

    // Extrapolate
    const lastPoint = curve.curve[curve.curve.length - 1];
    if (timeMs <= lastPoint.time) {
      return lastPoint.retention;
    }

    // Exponential extrapolation
    const additionalDays = (timeMs - lastPoint.time) / (24 * 60 * 60 * 1000);
    return Math.max(0, lastPoint.retention * Math.exp(-this._config.defaultDecayRate * additionalDays));
  }

  /**
   * Get current retention for a memory
   */
  getCurrentRetention(memoryId: string, createdAt: number): number {
    const age = Date.now() - createdAt;
    return this.getRetentionAt(memoryId, age);
  }

  /**
   * Calculate skill-specific forgetting curve
   */
  calculateSkillCurve(
    skill: ProceduralMemory,
    daysToProject: number = 30
  ): ForgettingCurve {
    const baseStrength = skill.masteryLevel / 6; // Normalize to 0-1
    const daysSincePractice = (Date.now() - skill.lastPracticed) / (24 * 60 * 60 * 1000);

    const curve: ForgettingCurve = {
      memoryId: skill.id,
      curve: [],
      halflife: 0,
      decayRate: this._config.defaultDecayRate * (1 - baseStrength * 0.5), // Better skills decay slower
      lastCalculated: Date.now()
    };

    const dayMs = 24 * 60 * 60 * 1000;

    for (let day = 0; day <= daysToProject; day++) {
      const time = day * dayMs;
      const totalDays = daysSincePractice + day;
      const decay = Math.exp(-curve.decayRate * totalDays);
      const retention = baseStrength * decay;

      curve.curve.push({ time, retention, strength: Math.max(0, retention) });

      if (retention < 0.5 && curve.halflife === 0) {
        curve.halflife = time;
      }
    }

    return curve;
  }

  /**
   * Get time until retention drops below threshold
   */
  getTimeUntilThreshold(
    memoryId: string,
    threshold: number = 0.7,
    createdAt?: number
  ): number {
    const curve = this._curves.get(memoryId);
    if (!curve) {
      this.calculateCurve(memoryId);
      return this.getTimeUntilThreshold(memoryId, threshold, createdAt);
    }

    const point = curve.curve.find(p => p.retention < threshold);
    if (point) {
      return point.time;
    }

    // Extrapolate
    const lastPoint = curve.curve[curve.curve.length - 1];
    if (lastPoint.retention <= threshold) {
      return lastPoint.time;
    }

    // Calculate using log
    // R(t) = e^(-λt) => t = -ln(R) / λ
    return -Math.log(threshold) / this._config.defaultDecayRate * 24 * 60 * 60 * 1000;
  }

  /**
   * Get all stored curves
   */
  getAllCurves(): ForgettingCurve[] {
    return Array.from(this._curves.values());
  }

  /**
   * Clear all curves
   */
  clear(): void {
    this._curves.clear();
  }
}

// ============================================================================
// Spaced Repetition Scheduler (SM-2 Algorithm)
// ============================================================================

/**
 * Implements SM-2 (SuperMemo 2) spaced repetition algorithm
 */
export class SpacedRepetitionScheduler {
  private _config: ForgettingCurveConfig;
  private _reviews: Map<string, ScheduledReview>;
  private _memory: HierarchicalMemory;

  constructor(
    memory: HierarchicalMemory,
    config: Partial<ForgettingCurveConfig> = {}
  ) {
    this._memory = memory;
    this._config = { ...DEFAULT_FORGETTING_CONFIG, ...config };
    this._reviews = new Map();
  }

  /**
   * Schedule a new review
   */
  scheduleReview(
    memoryId: string,
    initialQuality: number = 3
  ): ScheduledReview {
    const now = Date.now();

    const review: ScheduledReview = {
      id: `review_${memoryId}_${now}`,
      memoryId,
      scheduledFor: now + this._config.initialInterval,
      interval: this._config.initialInterval,
      easeFactor: this._config.defaultEaseFactor,
      reviewCount: 0,
      lastReview: now,
      lastReviewQuality: initialQuality
    };

    this._reviews.set(review.id, review);
    return review;
  }

  /**
   * Process a review result and schedule next review
   * Based on SM-2 algorithm
   */
  processReview(
    reviewId: string,
    quality: number // 0-5: 0=blackout, 5=perfect
  ): ScheduledReview | null {
    const review = this._reviews.get(reviewId);
    if (!review) return null;

    const now = Date.now();
    review.reviewCount++;
    review.lastReview = now;
    review.lastReviewQuality = quality;

    // SM-2 algorithm
    if (quality >= 3) {
      // Correct response
      if (review.reviewCount === 0) {
        review.interval = this._config.initialInterval;
      } else if (review.reviewCount === 1) {
        review.interval = 6 * 24 * 60 * 60 * 1000; // 6 days
      } else {
        review.interval = Math.round(review.interval * review.easeFactor);
      }
    } else {
      // Incorrect response - reset
      review.interval = this._config.initialInterval;
      review.reviewCount = 0;
    }

    // Update ease factor
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    review.easeFactor = Math.max(
      this._config.minEaseFactor,
      review.easeFactor + easeDelta
    );

    // Schedule next review
    review.scheduledFor = now + review.interval;

    return review;
  }

  /**
   * Get due reviews
   */
  getDueReviews(before?: number): ScheduledReview[] {
    const cutoff = before || Date.now();
    return Array.from(this._reviews.values()).filter(r => r.scheduledFor <= cutoff);
  }

  /**
   * Get upcoming reviews
   */
  getUpcomingReviews(after?: number, limit: number = 10): ScheduledReview[] {
    const cutoff = after || Date.now();
    return Array.from(this._reviews.values())
      .filter(r => r.scheduledFor > cutoff)
      .sort((a, b) => a.scheduledFor - b.scheduledFor)
      .slice(0, limit);
  }

  /**
   * Get review for a specific memory
   */
  getReview(memoryId: string): ScheduledReview | null {
    return Array.from(this._reviews.values()).find(r => r.memoryId === memoryId) || null;
  }

  /**
   * Calculate next review time based on performance
   */
  calculateNextReview(
    previousInterval: number,
    quality: number,
    easeFactor: number = this._config.defaultEaseFactor
  ): { interval: number; easeFactor: number } {
    let newInterval = previousInterval;
    let newEaseFactor = easeFactor;

    if (quality >= 3) {
      newInterval = Math.round(previousInterval * easeFactor);
    } else {
      newInterval = this._config.initialInterval;
    }

    const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
    newEaseFactor = Math.max(this._config.minEaseFactor, easeFactor + easeDelta);

    return { interval: newInterval, easeFactor: newEaseFactor };
  }

  /**
   * Remove a review
   */
  cancelReview(reviewId: string): boolean {
    return this._reviews.delete(reviewId);
  }

  /**
   * Clear all reviews
   */
  clear(): void {
    this._reviews.clear();
  }
}

// ============================================================================
// Review Recommender
// ============================================================================

/**
 * Generates review recommendations based on forgetting curves
 */
export class ReviewRecommender {
  private _memory: HierarchicalMemory;
  private _curveCalculator: ForgettingCurveCalculator;
  private _scheduler: SpacedRepetitionScheduler;
  private _config: ForgettingCurveConfig;

  constructor(
    memory: HierarchicalMemory,
    curveCalculator: ForgettingCurveCalculator,
    scheduler: SpacedRepetitionScheduler,
    config: Partial<ForgettingCurveConfig> = {}
  ) {
    this._memory = memory;
    this._curveCalculator = curveCalculator;
    this._scheduler = scheduler;
    this._config = { ...DEFAULT_FORGETTING_CONFIG, ...config };
  }

  /**
   * Get review recommendations for all memories
   */
  getRecommendations(): ReviewRecommendation[] {
    const recommendations: ReviewRecommendation[] = [];

    // Check episodic memories
    for (const memory of this._memory.episodic.getAll()) {
      const retention = this._curveCalculator.getCurrentRetention(
        memory.id,
        memory.timestamp
      );

      if (retention < this._config.minRetentionBeforeReview) {
        const recommendation = this._createRecommendation(memory, retention);
        recommendations.push(recommendation);
      }
    }

    // Check skills
    for (const skill of this._memory.procedural.getAll()) {
      const curve = this._curveCalculator.calculateSkillCurve(skill);
      const currentPoint = curve.curve.find(p => p.time >= 0);

      if (currentPoint && currentPoint.retention < this._config.minRetentionBeforeReview) {
        recommendations.push({
          memoryId: skill.id,
          urgency: 1 - currentPoint.retention,
          recommendedInterval: 24 * 60 * 60 * 1000, // 1 day
          reason: `Skill "${skill.skillName}" at mastery ${skill.masteryLevel} needs practice`,
          currentRetention: currentPoint.retention
        });
      }
    }

    // Check semantic concepts
    for (const concept of this._memory.semantic.getAll()) {
      if (concept.confidence < this._config.minRetentionBeforeReview) {
        recommendations.push({
          memoryId: concept.id,
          urgency: 1 - concept.confidence,
          recommendedInterval: 12 * 60 * 60 * 1000, // 12 hours
          reason: `Concept "${concept.conceptName}" confidence is low`,
          currentRetention: concept.confidence
        });
      }
    }

    return recommendations.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * Get urgent reviews (retention below threshold)
   */
  getUrgentReviews(threshold: number = 0.5): ReviewRecommendation[] {
    return this.getRecommendations().filter(r => r.currentRetention < threshold);
  }

  /**
   * Get today's review schedule
   */
  getTodaysSchedule(): Array<{
    memoryId: string;
    memoryType: string;
    scheduledTime: number;
    urgency: number;
    description: string;
  }> {
    const now = Date.now();
    const endOfDay = now + (24 * 60 * 60 * 1000);

    const schedule: Array<{
      memoryId: string;
      memoryType: string;
      scheduledTime: number;
      urgency: number;
      description: string;
    }> = [];

    // Get due reviews from scheduler
    const dueReviews = this._scheduler.getDueReviews(endOfDay);
    for (const review of dueReviews) {
      const memory = this._memory.getMemory(review.memoryId);
      if (memory) {
        schedule.push({
          memoryId: review.memoryId,
          memoryType: MemoryTier[memory.tier],
          scheduledTime: review.scheduledFor,
          urgency: review.scheduledFor < now ? 1 : 0.5,
          description: `Review scheduled (${review.reviewCount} prior reviews)`
        });
      }
    }

    // Add urgent recommendations
    const urgent = this.getUrgentReviews();
    for (const rec of urgent.slice(0, 10)) {
      if (!schedule.find(s => s.memoryId === rec.memoryId)) {
        const memory = this._memory.getMemory(rec.memoryId);
        if (memory) {
          schedule.push({
            memoryId: rec.memoryId,
            memoryType: memory ? MemoryTier[memory.tier] : 'unknown',
            scheduledTime: now,
            urgency: rec.urgency,
            description: rec.reason
          });
        }
      }
    }

    return schedule.sort((a, b) => {
      // Sort by urgency first, then by time
      if (a.urgency !== b.urgency) {
        return b.urgency - a.urgency;
      }
      return a.scheduledTime - b.scheduledTime;
    });
  }

  /**
   * Create recommendation for a memory
   */
  private _createRecommendation(
    memory: EpisodicMemory | SemanticMemory | ProceduralMemory,
    currentRetention: number
  ): ReviewRecommendation {
    const urgency = 1 - currentRetention;
    let recommendedInterval = 24 * 60 * 60 * 1000; // Default 1 day

    // Adjust interval based on urgency
    if (urgency > 0.7) {
      recommendedInterval = 6 * 60 * 60 * 1000; // 6 hours
    } else if (urgency > 0.5) {
      recommendedInterval = 12 * 60 * 60 * 1000; // 12 hours
    } else if (urgency < 0.2) {
      recommendedInterval = 3 * 24 * 60 * 60 * 1000; // 3 days
    }

    let reason = '';
    let description = '';

    if ('skillName' in memory) {
      reason = `Skill "${memory.skillName}" needs practice`;
      description = `Mastery level: ${memory.masteryLevel}`;
    } else if ('conceptName' in memory) {
      reason = `Concept "${memory.conceptName}" needs review`;
      description = `Confidence: ${Math.round(memory.confidence * 100)}%`;
    } else {
      reason = 'Memory needs review';
      description = memory.content.slice(0, 50);
    }

    return {
      memoryId: memory.id,
      urgency,
      recommendedInterval,
      reason: `${reason}. ${description}`,
      currentRetention
    };
  }

  /**
   * Get optimal review time for a memory
   */
  getOptimalReviewTime(memoryId: string, createdAt: number): number {
    const retention = this._curveCalculator.getCurrentRetention(memoryId, createdAt);

    if (retention < this._config.urgentReviewThreshold) {
      return Date.now(); // Review immediately
    }

    const timeUntilThreshold = this._curveCalculator.getTimeUntilThreshold(
      memoryId,
      this._config.minRetentionBeforeReview,
      createdAt
    );

    // Schedule slightly before threshold
    return Date.now() + Math.max(0, timeUntilThreshold * 0.8);
  }
}

// ============================================================================
// Retention Analytics
// ============================================================================

/**
 * Analytics for memory retention across the system
 */
export class RetentionAnalytics {
  private _memory: HierarchicalMemory;
  private _curveCalculator: ForgettingCurveCalculator;

  constructor(
    memory: HierarchicalMemory,
    curveCalculator: ForgettingCurveCalculator
  ) {
    this._memory = memory;
    this._curveCalculator = curveCalculator;
  }

  /**
   * Get overall retention statistics
   */
  getRetentionStats(): {
    averageRetention: number;
    byTier: Record<MemoryTier, number>;
    atRiskCount: number;
    wellRetainedCount: number;
  } {
    const byTier: Record<string, number> = {};
    let totalRetention = 0;
    let totalCount = 0;
    let atRisk = 0;
    let wellRetained = 0;

    // Working memory
    const working = this._memory.working.items();
    if (working.length > 0) {
      const avgWorking = 0.9; // Working memory is fresh
      byTier[MemoryTier.WORKING] = avgWorking;
      totalRetention += avgWorking * working.length;
      totalCount += working.length;
    }

    // Episodic memory
    const episodic = this._memory.episodic.getAll();
    for (const mem of episodic) {
      const retention = this._curveCalculator.getCurrentRetention(mem.id, mem.timestamp);
      byTier[MemoryTier.EPISODIC] = (byTier[MemoryTier.EPISODIC] || 0) + retention;
      totalRetention += retention;
      totalCount++;

      if (retention < 0.5) atRisk++;
      else if (retention > 0.8) wellRetained++;
    }
    if (episodic.length > 0) {
      byTier[MemoryTier.EPISODIC] /= episodic.length;
    }

    // Semantic memory
    const semantic = this._memory.semantic.getAll();
    for (const mem of semantic) {
      byTier[MemoryTier.SEMANTIC] = (byTier[MemoryTier.SEMANTIC] || 0) + mem.confidence;
      totalRetention += mem.confidence;
      totalCount++;

      if (mem.confidence < 0.5) atRisk++;
      else if (mem.confidence > 0.8) wellRetained++;
    }
    if (semantic.length > 0) {
      byTier[MemoryTier.SEMANTIC] /= semantic.length;
    }

    // Procedural memory
    const procedural = this._memory.procedural.getAll();
    for (const skill of procedural) {
      const retention = this._memory.procedural.getMastery(skill.id);
      byTier[MemoryTier.PROCEDURAL] = (byTier[MemoryTier.PROCEDURAL] || 0) + retention;
      totalRetention += retention;
      totalCount++;

      if (retention < 0.5) atRisk++;
      else if (retention > 0.8) wellRetained++;
    }
    if (procedural.length > 0) {
      byTier[MemoryTier.PROCEDURAL] /= procedural.length;
    }

    return {
      averageRetention: totalCount > 0 ? totalRetention / totalCount : 0,
      byTier: byTier as Record<MemoryTier, number>,
      atRiskCount: atRisk,
      wellRetainedCount: wellRetained
    };
  }

  /**
   * Get retention trend over time
   */
  getRetentionTrend(days: number = 30): Array<{
    date: Date;
    averageRetention: number;
  }> {
    const trend: Array<{ date: Date; averageRetention: number }> = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (let day = 0; day <= days; day++) {
      const timestamp = now - (day * dayMs);
      const date = new Date(timestamp);

      // Calculate retention as of this timestamp
      let totalRetention = 0;
      let count = 0;

      const episodic = this._memory.episodic.getAll();
      for (const mem of episodic) {
        if (mem.timestamp <= timestamp) {
          const ageAtTime = timestamp - mem.timestamp;
          const retention = this._curveCalculator.getRetentionAt(mem.id, ageAtTime);
          totalRetention += retention;
          count++;
        }
      }

      trend.push({
        date,
        averageRetention: count > 0 ? totalRetention / count : 0
      });
    }

    return trend;
  }

  /**
   * Predict future retention
   */
  predictFutureRetention(days: number = 30): Array<{
    date: Date;
    predictedRetention: number;
    confidence: number;
  }> {
    const prediction: Array<{ date: Date; predictedRetention: number; confidence: number }> = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (let day = 1; day <= days; day++) {
      const futureTime = now + (day * dayMs);
      const date = new Date(futureTime);

      let totalRetention = 0;
      let count = 0;

      // Predict for each memory type
      const memories = [
        ...this._memory.episodic.getAll(),
        ...this._memory.semantic.getAll(),
        ...this._memory.procedural.getAll()
      ];

      for (const mem of memories) {
        let retention = 0;

        if ('confidence' in mem) {
          // Semantic memory
          retention = mem.confidence * Math.exp(-0.05 * day);
        } else if ('timestamp' in mem) {
          // Episodic memory
          const age = (now - mem.timestamp) / dayMs;
          const futureAge = age + day;
          retention = Math.exp(-0.1 * futureAge);
        } else if ('masteryLevel' in mem) {
          // Procedural memory
          const baseMastery = mem.masteryLevel / 6;
          retention = baseMastery * Math.exp(-0.05 * day);
        }

        totalRetention += retention;
        count++;
      }

      // Confidence decreases with prediction distance
      const confidence = Math.max(0.1, 1 - (day / days));

      prediction.push({
        date,
        predictedRetention: count > 0 ? totalRetention / count : 0,
        confidence
      });
    }

    return prediction;
  }

  /**
   * Get memories at risk of being forgotten
   */
  getAtRiskMemories(threshold: number = 0.5): Array<{
    memoryId: string;
    tier: MemoryTier;
    description: string;
    currentRetention: number;
  }> {
    const atRisk: Array<{
      memoryId: string;
      tier: MemoryTier;
      description: string;
      currentRetention: number;
    }> = [];

    // Check episodic memories
    for (const mem of this._memory.episodic.getAll()) {
      const retention = this._curveCalculator.getCurrentRetention(mem.id, mem.timestamp);
      if (retention < threshold) {
        atRisk.push({
          memoryId: mem.id,
          tier: MemoryTier.EPISODIC,
          description: mem.content.slice(0, 100),
          currentRetention: retention
        });
      }
    }

    // Check skills
    for (const skill of this._memory.procedural.getAll()) {
      const retention = this._memory.procedural.getMastery(skill.id);
      if (retention < threshold) {
        atRisk.push({
          memoryId: skill.id,
          tier: MemoryTier.PROCEDURAL,
          description: `Skill: ${skill.skillName}`,
          currentRetention: retention
        });
      }
    }

    // Check concepts
    for (const concept of this._memory.semantic.getAll()) {
      if (concept.confidence < threshold) {
        atRisk.push({
          memoryId: concept.id,
          tier: MemoryTier.SEMANTIC,
          description: `Concept: ${concept.conceptName}`,
          currentRetention: concept.confidence
        });
      }
    }

    return atRisk.sort((a, b) => a.currentRetention - b.currentRetention);
  }
}
