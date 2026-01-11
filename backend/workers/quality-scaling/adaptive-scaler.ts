/**
 * Adaptive Quality Scaler Module
 *
 * Dynamically adjusts quality settings based on real-time performance.
 * Implements hysteresis to prevent rapid quality changes.
 *
 * @fileoverview Adaptive quality scaling system
 */

import type {
  QualityTier,
  QualityState,
  AdaptiveScalingConfig,
  AdaptiveScalingRecommendation,
  PerformanceSample,
  QualityChangeEvent,
} from './types.js';

import {
  generateRecommendation,
  analyzeTrend,
  isPerformancePoor,
  isPerformanceGood,
  DEFAULT_THRESHOLDS,
  TIER_THRESHOLDS,
} from './performance-monitor.js';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default adaptive scaling configuration.
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveScalingConfig = {
  enabled: true,
  aggressiveness: 0.5,  // Moderate scaling
  downscaleSpeed: 0.8,  // Quick to scale down
  upscaleSpeed: 0.3,    // Slow to scale up (hysteresis)
  minTier: QualityTier.POTATO,
  maxTier: QualityTier.ULTRA,
  thresholds: DEFAULT_THRESHOLDS,
  checkInterval: 1000,   // Check every second
  sampleWindow: 30,      // Use 30 samples per decision
};

// ============================================================================
// Quality State Storage
// ============================================================================

/**
 * Active quality states by session.
 */
const qualityStates = new Map<string, QualityState>();

/**
 * Adaptive configuration by session.
 */
const adaptiveConfigs = new Map<string, AdaptiveScalingConfig>();

/**
 * Quality change history by session.
 */
const changeHistory = new Map<string, QualityChangeEvent[]>();

/**
 * Timestamp of last quality change by session.
 */
const lastChangeTime = new Map<string, number>();

/**
 * Cooldown period between quality changes (ms).
 */
const CHANGE_COOLDOWN = 5000; // 5 seconds minimum between changes

// ============================================================================
// Quality State Management
// ============================================================================

/**
 * Get or create quality state for a session.
 */
export function getQualityState(sessionId: string): QualityState {
  let state = qualityStates.get(sessionId);

  if (!state) {
    state = {
      currentTier: QualityTier.MEDIUM,
      settings: getDefaultSettings(QualityTier.MEDIUM),
      locked: false,
      autoQuality: true,
      sessionStart: new Date().toISOString(),
      qualityChanges: 0,
      performanceHistory: [],
    };
    qualityStates.set(sessionId, state);
  }

  return state;
}

/**
 * Update quality state for a session.
 */
export function updateQualityState(sessionId: string, updates: Partial<QualityState>): QualityState {
  const state = getQualityState(sessionId);
  const updated = { ...state, ...updates };
  qualityStates.set(sessionId, updated);
  return updated;
}

/**
 * Set quality tier for a session.
 */
export function setQualityTier(
  sessionId: string,
  tier: QualityTier,
  reason: QualityChangeEvent['reason'] = 'manual',
  trigger: string = 'manual'
): QualityState {
  const state = getQualityState(sessionId);
  const previousTier = state.currentTier;

  if (previousTier === tier) {
    return state;
  }

  // Check cooldown
  const lastChange = lastChangeTime.get(sessionId) ?? 0;
  const now = Date.now();

  if (reason !== 'manual' && now - lastChange < CHANGE_COOLDOWN) {
    // In cooldown period, don't change
    return state;
  }

  // Create change event
  const event: QualityChangeEvent = {
    id: crypto.randomUUID(),
    fromTier: previousTier,
    toTier: tier,
    reason,
    trigger,
    timestamp: new Date().toISOString(),
    sessionId,
  };

  // Record history
  const history = changeHistory.get(sessionId) ?? [];
  history.push(event);
  changeHistory.set(sessionId, history);

  // Update state
  const updated = {
    ...state,
    currentTier: tier,
    targetTier: undefined,
    settings: getDefaultSettings(tier),
    qualityChanges: state.qualityChanges + 1,
    lastQualityChange: event.timestamp,
  };

  qualityStates.set(sessionId, updated);
  lastChangeTime.set(sessionId, now);

  return updated;
}

/**
 * Get default settings for a quality tier.
 */
function getDefaultSettings(tier: QualityTier) {
  // Import lazily to avoid circular dependency
  // In actual implementation, this would import from quality-presets
  return {
    tier,
    name: QualityTier[tier],
    description: '',
    shadows: 'none',
    textures: 'medium',
    effects: {
      particles: 'standard',
      water: 'standard',
      fireSmoke: 'standard',
      weather: 'standard',
      screenSpace: true,
    },
    postProcessing: {
      bloom: tier >= QualityTier.MEDIUM,
      ambientOcclusion: tier >= QualityTier.HIGH,
      depthOfField: false,
      motionBlur: false,
      chromaticAberration: false,
      colorGrading: true,
      antiAliasing: 'fxaa',
      vignette: false,
    },
    rendering: {
      renderScale: tier === QualityTier.POTATO ? 0.5 : tier === QualityTier.ULTRA ? 1.5 : 1.0,
      vsync: true,
      frameRateCap: tier >= QualityTier.HIGH ? 144 : 60,
      reflections: tier >= QualityTier.HIGH ? 'ssr' : 'none',
      globalIllumination: tier >= QualityTier.MEDIUM ? 'lightprobes' : 'none',
      tessellation: tier >= QualityTier.HIGH,
    },
    lod: {
      enabled: true,
      levels: tier >= QualityTier.MEDIUM ? 3 : 2,
      distanceMultiplier: tier >= QualityTier.HIGH ? 1.5 : 1.0,
      screenRatioThreshold: 0.05,
      ditherTransitions: tier >= QualityTier.MEDIUM,
    },
    maxDynamicLights: tier >= QualityTier.HIGH ? 16 : tier >= QualityTier.MEDIUM ? 8 : 4,
    maxParticles: tier * 5000,
    drawDistance: (tier + 1) * 100,
    useStreaming: tier >= QualityTier.MEDIUM,
  };
}

// ============================================================================
// Adaptive Configuration
// ============================================================================

/**
 * Get adaptive configuration for a session.
 */
export function getAdaptiveConfig(sessionId: string): AdaptiveScalingConfig {
  return adaptiveConfigs.get(sessionId) ?? { ...DEFAULT_ADAPTIVE_CONFIG };
}

/**
 * Set adaptive configuration for a session.
 */
export function setAdaptiveConfig(sessionId: string, config: Partial<AdaptiveScalingConfig>): AdaptiveScalingConfig {
  const current = getAdaptiveConfig(sessionId);
  const updated = { ...current, ...config };
  adaptiveConfigs.set(sessionId, updated);
  return updated;
}

/**
 * Update adaptive aggressiveness.
 */
export function setAggressiveness(sessionId: string, aggressiveness: number): void {
  const config = getAdaptiveConfig(sessionId);
  config.aggressiveness = Math.max(0, Math.min(1, aggressiveness));
  adaptiveConfigs.set(sessionId, config);
}

// ============================================================================
// Adaptive Scaling Logic
// ============================================================================

/**
 * Process adaptive scaling based on performance sample.
 */
export function processAdaptiveScaling(
  sessionId: string,
  sample: PerformanceSample
): {
  state: QualityState;
  recommendation: AdaptiveScalingRecommendation;
  changed: boolean;
} {
  const state = getQualityState(sessionId);
  const config = getAdaptiveConfig(sessionId);

  if (!config.enabled || state.locked || !state.autoQuality) {
    return {
      state,
      recommendation: {
        action: 'maintain',
        confidence: 1,
        reason: 'Auto-quality disabled or locked',
        performanceScore: sample.score,
      },
      changed: false,
    };
  }

  // Get thresholds for current tier
  const thresholds = TIER_THRESHOLDS[state.currentTier] ?? config.thresholds;

  // Generate base recommendation
  let recommendation = generateRecommendation(sample, state.currentTier, thresholds);

  // Apply aggressiveness modifier
  recommendation = applyAggressiveness(recommendation, config);

  // Apply hysteresis
  recommendation = applyHysteresis(recommendation, state, config);

  // Execute recommendation
  let changed = false;

  if (recommendation.action !== 'maintain' && recommendation.recommendedTier !== undefined) {
    const newTier = recommendation.recommendedTier;

    // Check min/max bounds
    const boundedTier = Math.max(
      config.minTier,
      Math.min(config.maxTier, newTier)
    ) as QualityTier;

    if (boundedTier !== state.currentTier) {
      const action = recommendation.action === 'downgrade' ? 'downgrade' : 'upgrade';
      setQualityTier(sessionId, boundedTier, 'auto', recommendation.reason);

      changed = true;
    }
  }

  // Update performance history
  state.performanceHistory.push(sample);
  if (state.performanceHistory.length > 100) {
    state.performanceHistory.shift();
  }

  return {
    state: getQualityState(sessionId),
    recommendation,
    changed,
  };
}

/**
 * Apply aggressiveness to recommendation confidence.
 */
function applyAggressiveness(
  recommendation: AdaptiveScalingRecommendation,
  config: AdaptiveScalingConfig
): AdaptiveScalingRecommendation {
  const adjusted = { ...recommendation };

  // Higher aggressiveness = lower confidence threshold for changes
  if (config.aggressiveness > 0.5) {
    adjusted.confidence = Math.min(1, adjusted.confidence * (1 + config.aggressiveness * 0.5));
  } else {
    adjusted.confidence = adjusted.confidence * config.aggressiveness * 2;
  }

  return adjusted;
}

/**
 * Apply hysteresis to prevent rapid changes.
 */
function applyHysteresis(
  recommendation: AdaptiveScalingRecommendation,
  state: QualityState,
  config: AdaptiveScalingConfig
): AdaptiveScalingRecommendation {
  const adjusted = { ...recommendation };

  // Check time since last change
  const lastChange = lastChangeTime.get(state.sessionStart) ?? 0;
  const timeSinceChange = Date.now() - lastChange;

  // Downscale quickly, upscale slowly
  if (recommendation.action === 'upgrade') {
    // Require higher confidence for upgrade
    if (adjusted.confidence < config.upscaleSpeed) {
      adjusted.action = 'maintain';
      adjusted.recommendedTier = undefined;
    }

    // Require minimum time since last change
    if (timeSinceChange < config.improvementTimeout) {
      adjusted.action = 'maintain';
      adjusted.recommendedTier = undefined;
      adjusted.reason += ' (waiting for stability)';
    }
  } else if (recommendation.action === 'downgrade') {
    // Lower confidence threshold for downgrade
    if (adjusted.confidence < config.downscaleSpeed) {
      adjusted.action = 'maintain';
      adjusted.recommendedTier = undefined;
    }
  }

  return adjusted;
}

/**
 * Calculate adaptive scale factor for render resolution.
 */
export function calculateRenderScale(
  sessionId: string,
  currentFps: number,
  targetFps: number
): number {
  const config = getAdaptiveConfig(sessionId);

  // Calculate FPS ratio
  const fpsRatio = currentFps / targetFps;

  let scale = 1.0;

  if (fpsRatio < 0.5) {
    // Very poor FPS, scale down significantly
    scale = 0.5;
  } else if (fpsRatio < 0.75) {
    // Poor FPS, scale down moderately
    scale = 0.67;
  } else if (fpsRatio < 0.9) {
    // Slightly poor FPS, scale down slightly
    scale = 0.85;
  } else if (fpsRatio > 1.5) {
    // Excellent FPS, could scale up
    scale = 1.2;
  }

  // Apply aggressiveness
  const adjustedScale = 1.0 - ((1.0 - scale) * config.aggressiveness);

  return Math.max(0.5, Math.min(1.5, adjustedScale));
}

// ============================================================================
// Quality Locking
// ============================================================================

/**
 * Lock quality at current tier.
 */
export function lockQuality(sessionId: string, reason?: string): QualityState {
  return updateQualityState(sessionId, {
    locked: true,
    lockReason: reason,
  });
}

/**
 * Unlock quality for auto-adjustment.
 */
export function unlockQuality(sessionId: string): QualityState {
  return updateQualityState(sessionId, {
    locked: false,
    lockReason: undefined,
  });
}

/**
 * Enable auto-quality.
 */
export function enableAutoQuality(sessionId: string): QualityState {
  return updateQualityState(sessionId, {
    autoQuality: true,
  });
}

/**
 * Disable auto-quality.
 */
export function disableAutoQuality(sessionId: string): QualityState {
  return updateQualityState(sessionId, {
    autoQuality: false,
  });
}

// ============================================================================
// History and Analytics
// ============================================================================

/**
 * Get quality change history for a session.
 */
export function getChangeHistory(sessionId: string): QualityChangeEvent[] {
  return changeHistory.get(sessionId) ?? [];
}

/**
 * Get performance history for a session.
 */
export function getPerformanceHistory(sessionId: string): PerformanceSample[] {
  const state = qualityStates.get(sessionId);
  return state?.performanceHistory ?? [];
}

/**
 * Calculate quality stability score (0-1).
 * Higher means more stable (fewer changes).
 */
export function calculateStabilityScore(sessionId: string): number {
  const history = getChangeHistory(sessionId);
  const state = qualityStates.get(sessionId);

  if (!state) return 0;

  const sessionDuration = Date.now() - new Date(state.sessionStart).getTime();
  const hours = sessionDuration / (1000 * 60 * 60);

  if (hours < 0.1) return 1; // Not enough data

  const changesPerHour = history.length / hours;

  // Fewer than 1 change per hour = stable
  return Math.max(0, 1 - (changesPerHour / 5));
}

/**
 * Clear session data.
 */
export function clearSession(sessionId: string): void {
  qualityStates.delete(sessionId);
  adaptiveConfigs.delete(sessionId);
  changeHistory.delete(sessionId);
  lastChangeTime.delete(sessionId);
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Create an adaptive scaler instance.
 */
export function createAdaptiveScaler() {
  return {
    getState: getQualityState,
    updateState: updateQualityState,
    setTier: setQualityTier,
    getConfig: getAdaptiveConfig,
    setConfig: setAdaptiveConfig,
    setAggressiveness,
    processAdaptiveScaling,
    calculateRenderScale,
    lock: lockQuality,
    unlock: unlockQuality,
    enableAuto: enableAutoQuality,
    disableAuto: disableAutoQuality,
    getHistory: getChangeHistory,
    getPerformanceHistory,
    getStabilityScore: calculateStabilityScore,
    clear: clearSession,
  };
}
