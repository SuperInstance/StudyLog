/**
 * Unified Game Engine Abstraction Layer
 *
 * Main API export for cross-engine gameplay between MicroVerse, Luanti, and OpenRTS.
 *
 * @module engine-abstraction
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export * from "./types.js";

// Re-export commonly used types at top level
export type {
  // Engine types
  GameEngine,
  QualityTier,
  AssetFormat,
  Platform,
  RenderingBackend,

  // Core types
  PlatformCapabilities,
  GPUInfo,
  AssetMetadata,
  UniversalGameState,
  EntityState,
  WorldState,
  PlayerState,

  // API types
  EngineSelectionRequest,
  EngineSelectionResponse,
  EngineCapabilitiesResponse,
  StateSyncRequest,
  StateSyncResponse,
  AssetTransformResult,
  TransformOptions,
  MigrationResult,

  // Error types
  EngineAbstractionError,
  EngineOperationError,
  AssetTransformationError,
  MigrationError,
} from "./types.js";

// ============================================================================
// INTERFACE EXPORTS
// ============================================================================

export * from "./engine-interface.js";

export type {
  // Core interface
  IGameEngine,

  // Asset interfaces
  IAssetRenderer,
  IAssetFactory,

  // Scene interfaces
  ISceneManager,
  IScene,

  // Input interfaces
  IInputHandler,

  // Audio interfaces
  IAudioHandler,

  // Physics interfaces
  IPhysicsHandler,

  // Configuration types
  EngineInitConfig,
  EngineInitResult,
  StateLoadResult,
  RenderStats,
  UpdateStats,
  EngineMetrics,
  CapabilityChangeResult,

  // Asset factory types
  SpriteConfig,
  VoxelConfig,
  MeshConfig,
  AnimatedAssetConfig,
  TileConfig,
  BackgroundConfig,

  // Scene types
  SceneConfig,
  SceneLoadResult,

  // Input types
  InputAction,
  InputState,
  InputActionType,

  // Audio types
  AudioConfig,
  PlaybackOptions,
  AudioHandle,
  SoundMetadata,

  // Physics types
  PhysicsConfig,
  PhysicsBody,
  PhysicsBodyState,
  RaycastResult,

  // Base class
  BaseEngine,
  EngineStateValue,
} from "./engine-interface.js";

// ============================================================================
// REGISTRY EXPORTS
// ============================================================================

export * from "./engine-registry.js";

export type {
  EngineFactory,
  EngineConfigEntry,
} from "./engine-registry.js";

export {
  // Main class
  EngineRegistry,

  // Display info
  ENGINE_DISPLAY_INFO,

  // Utility functions
  selectEngineByCriteria,
  getRecommendedQuality,
} from "./engine-registry.js";

// ============================================================================
// PLATFORM DETECTOR EXPORTS
// ============================================================================

export * from "./platform-detector.js";

export {
  // Main class
  PlatformDetector,

  // Utility functions
  detectPlatform,
  detectPlatformSync,
  isMobile,
  isDesktop,
  hasRTX,
  getRecommendedQuality as getPlatformRecommendedQuality,
  getRecommendedEngine as getPlatformRecommendedEngine,
  getVRAM,
  getSystemMemory,
  getCPUCores,
  getSupportedBackends,
  supportsBackend,
  supportsRayTracing,
  isWebGPUAvailable,
  isWebGL2Available,
  getGPUVendor,
  getGPUModel,
  getPlatformProfile,
} from "./platform-detector.js";

// ============================================================================
// RENDERER SELECTOR EXPORTS
// ============================================================================

export * from "./renderer-selector.js";

export type {
  RenderingSettings,
  RendererFeature,
} from "./renderer-selector.js";

export {
  // Main class
  RendererSelector,

  // Enums
  ShadowQuality,
  AntiAliasingMode,
  ReflectionQuality,
  ParticleQuality,
  TextureQuality,

  // Utility functions
  supportsFeature,
  getMaxRenderScale,
  getRecommendedMSAA,
  isDLSSAvailable,
  isFSSRAvailable,
  selectUpscaler,
  getShadowResolution,
  getTextureSizeMultiplier,
  getParticleCountMultiplier,
  validateRenderingSettings,
} from "./renderer-selector.js";

// ============================================================================
// ASSET TRANSFORMER EXPORTS
// ============================================================================

export * from "./asset-transformer.js";

export type {
  TransformPair,
  AssetTransformFunction,
  UniversalAsset,
  UniversalAssetData,
  TransformCacheEntry,
  CacheStats,
  VoxelGrid,
  MeshData,
} from "./asset-transformer.js";

export {
  // Main class
  AssetTransformer,

  // Utility functions
  transformAsset,
  createUniversalAsset,
  isTransformSupported,
  getEngineFormat,
} from "./asset-transformer.js";

// ============================================================================
// STATE SYNC EXPORTS
// ============================================================================

export * from "./state-sync.js";

export type {
  SyncChannelConfig,
  SyncChannel,
  StateFilter,
  StateFilterType,
  SyncStats,
  StateDelta,
  DeltaType,
  EntityDelta,
  EntityPropertyChange,
  PlayerDelta,
  EnvironmentDelta,
} from "./state-sync.js";

export {
  // Main class
  StateSyncManager,

  // Utility functions
  createStateSyncManager,
  syncState,
  createStateDelta,
  applyStateDelta,
  createSyncChannel,
  startSyncSession,
  stopSyncSession,
} from "./state-sync.js";

// ============================================================================
// QUALITY MIGRATION EXPORTS
// ============================================================================

export * from "./quality-migration.js";

export type {
  MigrationOptions,
  MigrationRule,
  QualityImpact,
  MigrationPair,
  CompatibilityCheck,
  VersionCompatibility,
  MigrationRecord,
  MigrationStats,
} from "./quality-migration.js";

export {
  // Main class
  QualityMigrator,

  // Utility functions
  migrateState,
  migrateStateBatch,
  getMigrationHistory,
  getMigrationStats,
  clearMigrationHistory,
  isMigrationSupported,
  getMigrationQualityImpact,
  getMigrationRecommendations,
  isMigrationReversible,
} from "./quality-migration.js";

// ============================================================================
// UNIFIED API
// ============================================================================

import { EngineRegistry } from "./engine-registry.js";
import { PlatformDetector } from "./platform-detector.js";
import { RendererSelector } from "./renderer-selector.js";
import { AssetTransformer } from "./asset-transformer.js";
import { StateSyncManager } from "./state-sync.js";
import { QualityMigrator } from "./quality-migration.js";
import type {
  GameEngine,
  PlatformCapabilities,
  EngineSelectionRequest,
  EngineSelectionResponse,
  EngineCapabilitiesResponse,
  UniversalGameState,
  AssetTransformResult,
  TransformOptions,
  MigrationResult,
  StateSyncRequest,
  StateSyncResponse,
  QualityTier,
  AssetMetadata,
} from "./types.js";
import type { IGameEngine } from "./engine-interface.js";

/**
 * Unified Game Engine Abstraction API.
 *
 * Provides a single entry point for all engine abstraction functionality.
 */
export class EngineAbstraction {
  private static _instance: EngineAbstraction | null = null;

  private constructor(
    public readonly registry: EngineRegistry,
    public readonly platform: PlatformDetector,
    public readonly renderer: RendererSelector,
    public readonly assets: AssetTransformer,
    public readonly sync: StateSyncManager,
    public readonly migration: QualityMigrator,
  ) {}

  /**
   * Get the singleton EngineAbstraction instance.
   */
  static getInstance(): EngineAbstraction {
    if (!EngineAbstraction._instance) {
      EngineAbstraction._instance = new EngineAbstraction(
        EngineRegistry.getInstance(),
        PlatformDetector.getInstance(),
        RendererSelector.getInstance(),
        AssetTransformer.getInstance(),
        StateSyncManager.getInstance(),
        QualityMigrator.getInstance(),
      );
    }
    return EngineAbstraction._instance;
  }

  // ========================================================================
  // ENGINE SELECTION
  // ========================================================================

  /**
   * Select the best engine for a session.
   * @param request - Engine selection request
   * @returns Engine selection response
   */
  async selectEngine(request: EngineSelectionRequest): Promise<EngineSelectionResponse> {
    // Detect platform capabilities if not provided
    const capabilities = request.capabilities ?? await this.platform.detect();

    // Select engine based on capabilities and preferences
    const engine = this.registry.selectBestEngine(
      capabilities,
      request.preferredEngine,
    );

    // Select rendering backend
    const backend = this.renderer.selectBackend(engine, capabilities);

    // Determine quality tier
    const quality = request.preferredQuality ?? capabilities.recommendedQuality;

    // Estimate performance
    const performance = this.estimatePerformance(engine, quality, capabilities);

    return {
      engine,
      quality,
      backend,
      reason: this.getSelectionReason(engine, capabilities),
      performance,
    };
  }

  /**
   * Get engine capabilities for the current platform.
   * @returns Engine capabilities response
   */
  async getCapabilities(): Promise<EngineCapabilitiesResponse> {
    const capabilities = await this.platform.detect();

    return {
      supportedEngines: this.registry.getRegisteredEngines(),
      platform: capabilities,
      availableQualities: this.getAvailableQualities(capabilities),
      availableBackends: capabilities.supportedBackends,
    };
  }

  // ========================================================================
  // STATE MANAGEMENT
  // ========================================================================

  /**
   * Synchronize state between engines.
   * @param request - State sync request
   * @returns State sync response
   */
  async syncState(request: StateSyncRequest): Promise<StateSyncResponse> {
    return this.sync.sync(request);
  }

  /**
   * Migrate state to a different engine.
   * @param state - Source state
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Migration result
   */
  async migrateState(
    state: UniversalGameState,
    targetEngine: GameEngine,
    options?: TransformOptions,
  ): Promise<MigrationResult> {
    return this.migration.migrate(state, targetEngine, options);
  }

  // ========================================================================
  // ASSET TRANSFORMATION
  // ========================================================================

  /**
   * Transform an asset for a target engine.
   * @param asset - Asset metadata
   * @param data - Asset data
   * @param targetEngine - Target engine
   * @param options - Transform options
   * @returns Transform result
   */
  async transformAsset(
    asset: AssetMetadata,
    data: unknown,
    targetEngine: GameEngine,
    options?: Partial<TransformOptions>,
  ): Promise<AssetTransformResult> {
    return this.assets.transform(asset, data, {
      targetEngine,
      ...options,
    });
  }

  // ========================================================================
  // ENGINE LIFECYCLE
  // ========================================================================

  /**
   * Initialize all enabled engines.
   * @returns Map of engine IDs to init results
   */
  async initializeAll() {
    const capabilities = await this.platform.detect();
    return this.registry.initializeAllEngines({
      quality: capabilities.recommendedQuality,
    });
  }

  /**
   * Start the active engine.
   */
  async start() {
    return this.registry.startActiveEngine();
  }

  /**
   * Stop the active engine.
   */
  async stop() {
    return this.registry.stopActiveEngine();
  }

  /**
   * Shutdown all engines.
   */
  async shutdown() {
    return this.registry.shutdownAll();
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get the reason for engine selection.
   * @param engine - Selected engine
   * @param capabilities - Platform capabilities
   * @returns Selection reason
   */
  private getSelectionReason(engine: GameEngine, capabilities: PlatformCapabilities): string {
    const reasons: Record<GameEngine, string> = {
      microverse: "Lightweight 2D engine optimized for your mobile/low-end device",
      luanti: "Voxel-based engine balancing performance and visuals",
      openrts: "Full 3D engine leveraging your capable hardware",
    };

    let reason = reasons[engine] ?? "Selected based on platform capabilities";

    if (capabilities.gpu.isRTX && engine === "openrts") {
      reason += " with RTX acceleration";
    }

    return reason;
  }

  /**
   * Estimate performance for engine and quality.
   * @param engine - Game engine
   * @param quality - Quality tier
   * @param capabilities - Platform capabilities
   * @returns Performance estimate
   */
  private estimatePerformance(
    engine: GameEngine,
    quality: QualityTier,
    capabilities: PlatformCapabilities,
  ) {
    // Base FPS targets by quality
    const baseFps: Record<QualityTier, [number, number]> = {
      low: [30, 60],
      medium: [30, 60],
      high: [45, 60],
      ultra: [60, 120],
    };

    let fps = baseFps[quality];

    // Adjust based on engine
    if (engine === "microverse") {
      fps = [fps[0] * 1.5, fps[1] * 2];
    } else if (engine === "openrts") {
      fps = [fps[0] * 0.7, fps[1] * 0.8];
    }

    // Adjust based on hardware
    if (capabilities.gpu.isRTX) {
      fps = [fps[0] * 1.2, fps[1] * 1.3];
    }

    // Estimate memory usage
    const memoryBase: Record<GameEngine, number> = {
      microverse: 128,
      luanti: 512,
      openrts: 1024,
    };

    const qualityMultipliers: Record<QualityTier, number> = {
      low: 0.5,
      medium: 1,
      high: 1.5,
      ultra: 2,
    };

    const memoryUsage = memoryBase[engine] * qualityMultipliers[quality];

    // Estimate load times
    const loadTime: [number, number] = [
      memoryUsage / 256,
      memoryUsage / 128,
    ];

    return {
      fps: [Math.round(fps[0]), Math.round(fps[1])] as [number, number],
      loadTime,
      memoryUsage: Math.round(memoryUsage),
    };
  }

  /**
   * Get available quality tiers for platform.
   * @param capabilities - Platform capabilities
   * @returns Available quality tiers
   */
  private getAvailableQualities(capabilities: PlatformCapabilities): QualityTier[] {
    const qualities: QualityTier[] = ["low", "medium"];

    if (capabilities.memoryMB >= 8192 && capabilities.gpu.vramMB >= 2048) {
      qualities.push("high");
    }

    if (capabilities.memoryMB >= 16384 && capabilities.gpu.vramMB >= 8192) {
      qualities.push("ultra");
    }

    return qualities;
  }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the EngineAbstraction singleton instance.
 * @returns EngineAbstraction instance
 */
export function getEngineAbstraction(): EngineAbstraction {
  return EngineAbstraction.getInstance();
}

/**
 * Select the best engine for the current platform.
 * @param preferredEngine - Optional preferred engine
 * @returns Selected engine
 */
export async function selectBestEngine(preferredEngine?: GameEngine): Promise<GameEngine> {
  const api = getEngineAbstraction();
  const result = await api.selectEngine({ sessionId: "auto", preferredEngine });
  return result.engine;
}

/**
 * Detect platform capabilities.
 * @returns Platform capabilities
 */
export async function detectCapabilities(): Promise<PlatformCapabilities> {
  const api = getEngineAbstraction();
  const result = await api.getCapabilities();
  return result.platform;
}

/**
 * Transform an asset for a target engine.
 * @param asset - Asset metadata
 * @param data - Asset data
 * @param targetEngine - Target engine
 * @returns Transform result
 */
export async function transformAssetForEngine(
  asset: AssetMetadata,
  data: unknown,
  targetEngine: GameEngine,
): Promise<AssetTransformResult> {
  const api = getEngineAbstraction();
  return api.transformAsset(asset, data, targetEngine);
}

/**
 * Migrate game state to a different engine.
 * @param state - Source state
 * @param targetEngine - Target engine
 * @returns Migration result
 */
export async function migrateToEngine(
  state: UniversalGameState,
  targetEngine: GameEngine,
): Promise<MigrationResult> {
  const api = getEngineAbstraction();
  return api.migrateState(state, targetEngine);
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default EngineAbstraction;
