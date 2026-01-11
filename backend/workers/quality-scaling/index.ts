/**
 * Quality Scaling System - Main Entry Point
 *
 * Adaptive quality system that scales from low-end voxels to high-end 3D
 * based on hardware capabilities and user budget constraints.
 *
 * @fileoverview Main API for the quality scaling system
 */

// Re-export all types
export * from './types.js';

// Re-export hardware detector
export {
  detectHardware,
  detectGPUFromClient,
  detectSystemFromClient,
  getMaxQualityTier,
  canHandleRayTracing,
  getDrawDistance,
  getMaxParticles,
  formatHardwareProfile,
} from './hardware-detector.js';

// Re-export budget manager
export {
  createDefaultUserBudget,
  calculateQualityConstraints,
  canAffordUpgrade,
  processUpgrade,
  resetDailyBudget,
  resetMonthlyBudget,
  upgradeBudgetTier,
  checkBudgetReset,
  updateBudgetFromRequest,
  getMaxAvailableTier,
  isUnlimited,
  getBudgetTierName,
  formatUserBudget,
  awardGrain,
  spendGrain,
  calculateGrainReward,
  createBudgetManager,
} from './budget-manager.js';

// Re-export quality presets
export {
  getQualitySettings,
  QUALITY_PRESETS,
  STUDYLOG_PRESETS,
  DMLOG_PRESETS,
  getProductPresets,
  getPresetById,
  getAvailablePresets,
  settingsToGodot,
  settingsToWebGL,
  applySettingsOverrides,
  getRecommendedSettings,
  createQualityPresetsManager,
} from './quality-presets.js';

// Re-export asset LOD
export {
  registerAssetLOD,
  getAssetLOD,
  createLODLevels,
  createAssetLOD,
  selectLODLevel,
  selectLODByScreenSize,
  getAssetUrl,
  getVoxelFallbackUrl,
  getSpriteFallbackUrl,
  hasVoxelFallback,
  hasSpriteFallback,
  getAssetsBatch,
  calculateBatchSize,
  getProgressiveLoadPlan,
  getAssetLODStats,
  createAssetLODManager,
} from './asset-lod.js';

// Re-export voxel to 3D
export {
  registerVoxelAsset,
  getVoxelAsset,
  canUpgradeTo3D,
  getUpgradePath,
  startUpgrade,
  updateUpgradeProgress,
  completeUpgrade,
  cancelUpgrade,
  getUpgradeStatus,
  generateVoxelFromMesh,
  generateVoxelBox,
  createVoxelStream,
  reconstructFromChunks,
  optimizeVoxelData,
  generateVoxelLOD,
  voxelToMesh,
  createVoxelTo3DManager,
} from './voxel-to-3d.js';

// Re-export performance monitor
export {
  DEFAULT_THRESHOLDS,
  TIER_THRESHOLDS,
  startTracking,
  stopTracking,
  recordMetric,
  getRecentMetrics,
  calculateSample,
  getSamples,
  getLatestSample,
  calculatePerformanceScore,
  isPerformancePoor,
  isPerformanceGood,
  analyzeTrend,
  handleReportPerformance,
  generateRecommendation,
  getSessionStats,
  clearSession,
  createPerformanceMonitor,
} from './performance-monitor.js';

// Re-export adaptive scaler
export {
  DEFAULT_ADAPTIVE_CONFIG,
  getQualityState,
  updateQualityState,
  setQualityTier,
  getAdaptiveConfig,
  setAdaptiveConfig,
  setAggressiveness,
  processAdaptiveScaling,
  calculateRenderScale,
  lockQuality,
  unlockQuality,
  enableAutoQuality,
  disableAutoQuality,
  getChangeHistory,
  getPerformanceHistory,
  calculateStabilityScore,
  clearSession,
  createAdaptiveScaler,
} from './adaptive-scaler.js';

// Re-export quality manager
export {
  getQualityManager,
  createQualityManager,
} from './quality-manager.js';

// ============================================================================
// Utility Constants
// ============================================================================

/**
 * Quality tier names for display.
 */
export const QUALITY_TIER_NAMES = Object.freeze({
  0: 'Potato',
  1: 'Low',
  2: 'Medium',
  3: 'High',
  4: 'Ultra',
} as const);

/**
 * Budget tier names for display.
 */
export const BUDGET_TIER_NAMES = Object.freeze({
  0: 'Free',
  1: 'Basic',
  2: 'Premium',
  3: 'Unlimited',
} as const);

/**
 * Hardware tier names for display.
 */
export const HARDWARE_TIER_NAMES = Object.freeze({
  0: 'Minimal',
  1: 'Entry',
  2: 'Mid-Range',
  3: 'High-End',
  4: 'Enthusiast',
} as const);

/**
 * Default quality tier for new sessions.
 */
export const DEFAULT_QUALITY_TIER = 2; // MEDIUM

/**
 * Minimum FPS threshold for quality scaling decisions.
 */
export const MIN_FPS_THRESHOLD = 30;

/**
 * Target FPS threshold for quality scaling decisions.
 */
export const TARGET_FPS_THRESHOLD = 60;

// ============================================================================
// Version Info
// ============================================================================

export const VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// ============================================================================
// Quick Start Functions
// ============================================================================

/**
 * Quick setup for a new quality session.
 * Detects hardware and sets up appropriate quality settings.
 */
export async function setupQualitySession(
  sessionId: string,
  userId?: string,
  hardwareRequest?: Parameters<typeof import('./hardware-detector.js').detectHardware>[0]
): Promise<{
  sessionId: string;
  qualityTier: number;
  settings: ReturnType<typeof import('./quality-presets.js').getQualitySettings>;
  hardware: Awaited<ReturnType<typeof import('./hardware-detector.js').detectHardware>>;
}> {
  // Detect hardware
  const hardware = await (hardwareRequest
    ? detectHardware(hardwareRequest)
    : detectHardware({}));

  // Get quality manager
  const manager = (await import('./quality-manager.js')).getQualityManager();

  // Get user constraints
  const constraints = userId
    ? manager.getQualityConstraints(userId)
    : { recommendedTier: 2, maxTier: 4 };

  // Get settings
  const settings = (await import('./quality-presets.js')).getQualitySettings(
    constraints.recommendedTier
  );

  return {
    sessionId,
    qualityTier: constraints.recommendedTier,
    settings,
    hardware,
  };
}

/**
 * Get recommended quality tier for a user.
 */
export async function getRecommendedTier(
  userId: string,
  hardwareRequest?: Parameters<typeof import('./hardware-detector.js').detectHardware>[0]
): Promise<number> {
  const manager = (await import('./quality-manager.js')).getQualityManager();

  const detection = await manager.detectHardware(
    hardwareRequest || {},
    userId
  );

  return detection.recommendedTier;
}
