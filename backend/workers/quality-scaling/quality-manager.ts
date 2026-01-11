/**
 * Quality Manager Module
 *
 * Main orchestration module for the quality scaling system.
 * Coordinates hardware detection, budget management, and adaptive scaling.
 *
 * @fileoverview Main quality management system
 */

import type {
  QualityTier,
  BudgetTier,
  HardwareTier,
  QualityState,
  QualitySettings,
  QualityConstraint,
  UserBudget,
  HardwareProfile,
  DetectHardwareRequest,
  DetectHardwareResponse,
  SetQualityRequest,
  SetQualityResponse,
  UpdateBudgetRequest,
  ReportPerformanceRequest,
  ReportPerformanceResponse,
  GetAssetRequest,
  GetAssetResponse,
  PerformanceSample,
  AdaptiveScalingConfig,
} from './types.js';

// Import modules
import { detectHardware, getMaxQualityTier } from './hardware-detector.js';
import {
  createDefaultUserBudget,
  calculateQualityConstraints,
  updateBudgetFromRequest,
  checkBudgetReset,
  getMaxAvailableTier,
  createBudgetManager,
} from './budget-manager.js';
import { getQualitySettings, createQualityPresetsManager } from './quality-presets.js';
import {
  registerAssetLOD,
  getAssetUrl,
  createAssetLODManager,
} from './asset-lod.js';
import {
  handleReportPerformance,
  startTracking,
  stopTracking,
  getSessionStats,
  createPerformanceMonitor,
} from './performance-monitor.js';
import {
  getQualityState,
  setQualityTier,
  getAdaptiveConfig,
  setAdaptiveConfig,
  processAdaptiveScaling,
  lockQuality,
  unlockQuality,
  clearSession,
  createAdaptiveScaler,
} from './adaptive-scaler.js';

// ============================================================================
// Manager Instance
// ============================================================================

/**
 * Main quality manager instance.
 * Coordinates all quality scaling operations.
 */
class QualityManager {
  private budgetManager = createBudgetManager();
  private presetsManager = createQualityPresetsManager();
  private assetLODManager = createAssetLODManager();
  private performanceMonitor = createPerformanceMonitor();
  private adaptiveScaler = createAdaptiveScaler();

  private userBudgets = new Map<string, UserBudget>();
  private hardwareProfiles = new Map<string, HardwareProfile>();

  // ========================================================================
  // Hardware Detection
  // ========================================================================

  /**
   * Detect hardware capabilities and return quality recommendations.
   */
  async detectHardware(request: DetectHardwareRequest, userId?: string): Promise<DetectHardwareResponse> {
    const hardware = await detectHardware(request);

    // Store hardware profile for user
    if (userId) {
      this.hardwareProfiles.set(userId, hardware);
    }

    // Get or create user budget
    const budget = userId ? this.getUserBudget(userId) : createDefaultUserBudget('anonymous');

    // Calculate quality constraints
    const hardwareMaxTier = getMaxQualityTier(hardware);
    const constraints = calculateQualityConstraints(budget, hardwareMaxTier);

    return {
      hardware,
      recommendedTier: constraints.recommendedTier,
      maxTier: constraints.maxTier,
      constraints,
      settings: getQualitySettings(constraints.recommendedTier),
    };
  }

  /**
   * Get stored hardware profile for a user.
   */
  getHardwareProfile(userId: string): HardwareProfile | undefined {
    return this.hardwareProfiles.get(userId);
  }

  // ========================================================================
  // Budget Management
  // ========================================================================

  /**
   * Get or create user budget.
   */
  getUserBudget(userId: string): UserBudget {
    let budget = this.userBudgets.get(userId);

    if (!budget) {
      budget = createDefaultUserBudget(userId);
      this.userBudgets.set(userId, budget);
    }

    // Check for reset
    budget = checkBudgetReset(budget);
    this.userBudgets.set(userId, budget);

    return budget;
  }

  /**
   * Update user budget.
   */
  updateUserBudget(userId: string, request: UpdateBudgetRequest): UserBudget {
    const current = this.getUserBudget(userId);
    const updated = updateBudgetFromRequest(current, request);

    this.userBudgets.set(userId, updated);

    return updated;
  }

  /**
   * Set user budget tier.
   */
  setUserBudgetTier(userId: string, tier: BudgetTier): UserBudget {
    const current = this.getUserBudget(userId);
    const updated = this.budgetManager.upgradeTier(current, tier);

    this.userBudgets.set(userId, updated);

    return updated;
  }

  /**
   * Get quality constraints for a user.
   */
  getQualityConstraints(userId: string): QualityConstraint {
    const budget = this.getUserBudget(userId);
    const hardware = this.hardwareProfiles.get(userId);

    if (!hardware) {
      // No hardware detected, use budget tier only
      return {
        maxTier: getMaxAvailableTier(budget),
        minTier: 0,
        recommendedTier: Math.max(0, getMaxAvailableTier(budget) - 1) as QualityTier,
        hardwareTier: 0,
        budgetTier: budget.tier,
        hardwareLimited: false,
        budgetLimited: true,
        canUpgrade: budget.tier < BudgetTier.UNLIMITED,
      };
    }

    const hardwareMaxTier = getMaxQualityTier(hardware);
    return calculateQualityConstraints(budget, hardwareMaxTier);
  }

  // ========================================================================
  // Quality State Management
  // ========================================================================

  /**
   * Get quality state for a session.
   */
  getQualityState(sessionId: string): QualityState {
    return this.adaptiveScaler.getState(sessionId);
  }

  /**
   * Set quality tier for a session.
   */
  async setQuality(request: SetQualityRequest): Promise<SetQualityResponse> {
    const { userId, sessionId, tier, overrides, reason } = request;

    // Get user constraints
    const constraints = userId ? this.getQualityConstraints(userId) : {
      maxTier: QualityTier.ULTRA,
      minTier: QualityTier.POTATO,
      recommendedTier: QualityTier.MEDIUM,
      hardwareTier: 0,
      budgetTier: BudgetTier.FREE,
      hardwareLimited: false,
      budgetLimited: false,
      canUpgrade: false,
    };

    // Check if requested tier is allowed
    if (tier > constraints.maxTier) {
      return {
        state: this.adaptiveScaler.getState(sessionId),
        immediate: false,
        estimatedTime: 0,
        warnings: [`Requested tier ${QualityTier[tier]} exceeds maximum allowed tier ${QualityTier[constraints.maxTier]}`],
      };
    }

    // Set the tier
    const state = setQualityTier(sessionId, tier, 'manual', reason || 'User request');

    // Apply overrides if provided
    if (overrides) {
      const currentSettings = state.settings;
      // Merge would happen here with quality-presets module
    }

    return {
      state,
      immediate: true,
      estimatedTime: 100, // 100ms typical
      warnings: [],
    };
  }

  /**
   * Get quality settings for a specific tier.
   */
  getQualitySettings(tier: QualityTier): QualitySettings {
    return this.presetsManager.getSettings(tier);
  }

  // ========================================================================
  // Performance and Adaptive Scaling
  // ========================================================================

  /**
   * Report performance metrics.
   */
  reportPerformance(request: ReportPerformanceRequest): ReportPerformanceResponse {
    const state = this.adaptiveScaler.getState(request.sessionId);

    const response = this.performanceMonitor.handleReport(
      request,
      state.currentTier
    );

    // Process adaptive scaling if enabled
    if (request.triggerAdaptive && response.sample) {
      const { changed } = this.adaptiveScaler.processAdaptiveScaling(
        request.sessionId,
        response.sample
      );

      response.qualityChangeTriggered = changed;
    }

    return response;
  }

  /**
   * Start performance tracking for a session.
   */
  startTracking(sessionId: string): void {
    this.performanceMonitor.start(sessionId);
  }

  /**
   * Stop performance tracking for a session.
   */
  stopTracking(sessionId: string): PerformanceSample[] {
    return this.performanceMonitor.stop(sessionId);
  }

  /**
   * Get performance statistics for a session.
   */
  getPerformanceStats(sessionId: string) {
    return this.performanceMonitor.getSessionStats(sessionId);
  }

  /**
   * Configure adaptive scaling for a session.
   */
  configureAdaptive(sessionId: string, config: Partial<AdaptiveScalingConfig>): AdaptiveScalingConfig {
    return this.adaptiveScaler.setConfig(sessionId, config);
  }

  /**
   * Get adaptive configuration for a session.
   */
  getAdaptiveConfig(sessionId: string): AdaptiveScalingConfig {
    return this.adaptiveScaler.getConfig(sessionId);
  }

  /**
   * Lock quality at current level.
   */
  lockQuality(sessionId: string, reason?: string): QualityState {
    return lockQuality(sessionId, reason);
  }

  /**
   * Unlock quality for auto-adjustment.
   */
  unlockQuality(sessionId: string): QualityState {
    return unlockQuality(sessionId);
  }

  // ========================================================================
  // Asset LOD Management
  // ========================================================================

  /**
   * Register an asset with LOD configuration.
   */
  registerAsset(assetLOD: Parameters<typeof registerAssetLOD>[0]): void {
    this.assetLODManager.register(assetLOD);
  }

  /**
   * Get asset URL at appropriate quality level.
   */
  getAsset(request: GetAssetRequest): GetAssetResponse {
    return this.assetLODManager.getUrl(request);
  }

  // ========================================================================
  // Session Cleanup
  // ========================================================================

  /**
   * Clean up session data.
   */
  cleanupSession(sessionId: string): void {
    this.performanceMonitor.clear(sessionId);
    this.adaptiveScaler.clear(sessionId);
  }

  /**
   * Clean up user data.
   */
  cleanupUser(userId: string): void {
    this.userBudgets.delete(userId);
    this.hardwareProfiles.delete(userId);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let managerInstance: QualityManager | null = null;

/**
 * Get the global quality manager instance.
 */
export function getQualityManager(): QualityManager {
  if (!managerInstance) {
    managerInstance = new QualityManager();
  }
  return managerInstance;
}

/**
 * Create a new quality manager instance.
 */
export function createQualityManager(): QualityManager {
  return new QualityManager();
}

// ============================================================================
// Export All Modules
// ============================================================================

export {
  // Types
  type QualityTier,
  type BudgetTier,
  type HardwareTier,
  type QualityState,
  type QualitySettings,
  type QualityConstraint,
  type UserBudget,
  type HardwareProfile,
  type DetectHardwareRequest,
  type DetectHardwareResponse,
  type SetQualityRequest,
  type SetQualityResponse,
  type UpdateBudgetRequest,
  type ReportPerformanceRequest,
  type ReportPerformanceResponse,
  type GetAssetRequest,
  type GetAssetResponse,
  type PerformanceSample,
  type AdaptiveScalingConfig,

  // Hardware detector
  detectHardware,
  getMaxQualityTier,

  // Budget manager
  createDefaultUserBudget,
  calculateQualityConstraints,
  getMaxAvailableTier,

  // Quality presets
  getQualitySettings,

  // Asset LOD
  registerAssetLOD,
  getAssetUrl,

  // Performance monitor
  handleReportPerformance,
  startTracking,
  stopTracking,
  getSessionStats,

  // Adaptive scaler
  getQualityState as getAdaptiveState,
  setQualityTier,
  processAdaptiveScaling,
  lockQuality,
  unlockQuality,

  // Manager
  getQualityManager,
  createQualityManager,
};

export default getQualityManager;
