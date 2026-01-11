/**
 * Engine Registry
 *
 * Manages registration, initialization, and lifecycle of game engines.
 * Provides centralized access to MicroVerse, Luanti, and OpenRTS engines.
 *
 * @module engine-abstraction/engine-registry
 */

import type {
  GameEngine,
  QualityTier,
  PlatformCapabilities,
  EngineDisplayInfo,
  EngineConfig,
  RenderingBackend,
  UniversalGameState,
} from "./types.js";
import type {
  IGameEngine,
  EngineInitConfig,
  EngineInitResult,
  EngineMetrics,
  CapabilityChangeResult,
} from "./engine-interface.js";

// ============================================================================
// ENGINE REGISTRY
// ============================================================================

/**
 * Central registry for managing game engines.
 * Handles registration, initialization, and lifecycle coordination.
 */
export class EngineRegistry {
  private static _instance: EngineRegistry | null = null;
  private _engines: Map<GameEngine, IGameEngine> = new Map();
  private _activeEngine: GameEngine | null = null;
  private _engineConfigs: Map<GameEngine, EngineConfigEntry> = new Map();
  private _engineFactories: Map<GameEngine, EngineFactory> = new Map();
  private _capabilities: PlatformCapabilities | null = null;

  private constructor() {
    this.initializeBuiltInEngines();
  }

  /**
   * Get the singleton EngineRegistry instance.
   */
  static getInstance(): EngineRegistry {
    if (!EngineRegistry._instance) {
      EngineRegistry._instance = new EngineRegistry();
    }
    return EngineRegistry._instance;
  }

  /**
   * Register an engine with the registry.
   * @param engineId - Engine identifier
   * @param factory - Factory function to create engine instances
   * @param config - Engine configuration
   */
  registerEngine(
    engineId: GameEngine,
    factory: EngineFactory,
    config?: Partial<EngineConfigEntry>,
  ): void {
    this._engineFactories.set(engineId, factory);
    this._engineConfigs.set(engineId, {
      enabled: config?.enabled ?? true,
      priority: config?.priority ?? 0,
      config: config?.config ?? {},
      autoLoad: config?.autoLoad ?? false,
      lazyLoad: config?.lazyLoad ?? true,
    });
  }

  /**
   * Unregister an engine from the registry.
   * @param engineId - Engine identifier
   */
  unregisterEngine(engineId: GameEngine): void {
    if (this._activeEngine === engineId) {
      throw new Error(`Cannot unregister active engine: ${engineId}`);
    }
    this._engineFactories.delete(engineId);
    this._engineConfigs.delete(engineId);

    const engine = this._engines.get(engineId);
    if (engine) {
      engine.shutdown().catch(console.error);
      this._engines.delete(engineId);
    }
  }

  /**
   * Get a registered engine instance.
   * @param engineId - Engine identifier
   * @returns Engine instance or undefined if not found
   */
  getEngine(engineId: GameEngine): IGameEngine | undefined {
    return this._engines.get(engineId);
  }

  /**
   * Get or create an engine instance.
   * @param engineId - Engine identifier
   * @returns Engine instance
   * @throws Error if engine is not registered
   */
  async getOrCreateEngine(engineId: GameEngine): Promise<IGameEngine> {
    let engine = this._engines.get(engineId);

    if (!engine) {
      const factory = this._engineFactories.get(engineId);
      if (!factory) {
        throw new Error(`Engine not registered: ${engineId}`);
      }

      engine = factory();
      this._engines.set(engineId, engine);
    }

    return engine;
  }

  /**
   * Get the currently active engine.
   * @returns Active engine or undefined if none is active
   */
  getActiveEngine(): IGameEngine | undefined {
    return this._activeEngine
      ? this._engines.get(this._activeEngine)
      : undefined;
  }

  /**
   * Set the active engine.
   * @param engineId - Engine identifier
   * @returns The newly active engine
   */
  async setActiveEngine(engineId: GameEngine): Promise<IGameEngine> {
    const engine = await this.getOrCreateEngine(engineId);

    // Stop previous engine if running
    if (this._activeEngine && this._activeEngine !== engineId) {
      const prevEngine = this._engines.get(this._activeEngine);
      if (prevEngine?.isRunning) {
        await prevEngine.stop();
      }
    }

    this._activeEngine = engineId;
    return engine;
  }

  /**
   * Get all registered engine IDs.
   * @returns Array of registered engine identifiers
   */
  getRegisteredEngines(): GameEngine[] {
    return Array.from(this._engineFactories.keys());
  }

  /**
   * Get all enabled engine IDs.
   * @returns Array of enabled engine identifiers
   */
  getEnabledEngines(): GameEngine[] {
    return Array.from(this._engineConfigs.entries())
      .filter(([, config]) => config.enabled)
      .map(([engineId]) => engineId);
  }

  /**
   * Check if an engine is registered.
   * @param engineId - Engine identifier
   * @returns True if engine is registered
   */
  isRegistered(engineId: GameEngine): boolean {
    return this._engineFactories.has(engineId);
  }

  /**
   * Check if an engine is enabled.
   * @param engineId - Engine identifier
   * @returns True if engine is enabled
   */
  isEnabled(engineId: GameEngine): boolean {
    const config = this._engineConfigs.get(engineId);
    return config?.enabled ?? false;
  }

  /**
   * Enable or disable an engine.
   * @param engineId - Engine identifier
   * @param enabled - Enable state
   */
  setEnabled(engineId: GameEngine, enabled: boolean): void {
    const config = this._engineConfigs.get(engineId);
    if (config) {
      config.enabled = enabled;
    }
  }

  /**
   * Get engine configuration.
   * @param engineId - Engine identifier
   * @returns Engine configuration or undefined
   */
  getEngineConfig(engineId: GameEngine): EngineConfigEntry | undefined {
    return this._engineConfigs.get(engineId);
  }

  /**
   * Set engine configuration.
   * @param engineId - Engine identifier
   * @param config - Configuration to set
   */
  setEngineConfig(engineId: GameEngine, config: Partial<EngineConfigEntry>): void {
    const existing = this._engineConfigs.get(engineId);
    if (existing) {
      this._engineConfigs.set(engineId, { ...existing, ...config });
    }
  }

  /**
   * Initialize an engine.
   * @param engineId - Engine identifier
   * @param config - Initialization configuration
   * @returns Initialization result
   */
  async initializeEngine(
    engineId: GameEngine,
    config?: EngineInitConfig,
  ): Promise<EngineInitResult> {
    const engine = await this.getOrCreateEngine(engineId);

    // Merge registry config with init config
    const registryConfig = this._engineConfigs.get(engineId);
    const mergedConfig: EngineInitConfig = {
      ...config,
      engineConfig: {
        ...registryConfig?.config,
        ...config?.engineConfig,
      },
    };

    return engine.initialize(mergedConfig);
  }

  /**
   * Initialize all enabled engines.
   * @param config - Base initialization configuration
   * @returns Map of engine IDs to initialization results
   */
  async initializeAllEngines(
    config?: EngineInitConfig,
  ): Promise<Map<GameEngine, EngineInitResult>> {
    const results = new Map<GameEngine, EngineInitResult>();
    const enabled = this.getEnabledEngines();

    for (const engineId of enabled) {
      try {
        const result = await this.initializeEngine(engineId, config);
        results.set(engineId, result);
      } catch (error) {
        console.error(`Failed to initialize engine ${engineId}:`, error);
        results.set(engineId, {
          success: false,
          quality: "medium",
          backend: "opengl",
          warnings: [],
          errors: [String(error)],
          duration: 0,
          metrics: this.getEmptyMetrics(engineId),
        });
      }
    }

    return results;
  }

  /**
   * Start the active engine.
   * @returns Promise that resolves when engine is started
   */
  async startActiveEngine(): Promise<void> {
    const engine = this.getActiveEngine();
    if (!engine) {
      throw new Error("No active engine");
    }
    await engine.start();
  }

  /**
   * Stop the active engine.
   * @returns Promise that resolves when engine is stopped
   */
  async stopActiveEngine(): Promise<void> {
    const engine = this.getActiveEngine();
    if (!engine) {
      throw new Error("No active engine");
    }
    await engine.stop();
  }

  /**
   * Shutdown all engines.
   * @returns Promise that resolves when all engines are shut down
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this._engines.values()).map((engine) =>
      engine.shutdown().catch((error) => {
        console.error(`Error shutting down engine ${engine.engineId}:`, error);
      }),
    );

    await Promise.all(shutdownPromises);
    this._engines.clear();
    this._activeEngine = null;
  }

  /**
   * Get metrics from all engines.
   * @returns Map of engine IDs to metrics
   */
  getAllMetrics(): Map<GameEngine, EngineMetrics> {
    const metrics = new Map<GameEngine, EngineMetrics>();

    for (const [engineId, engine] of this._engines) {
      try {
        metrics.set(engineId, engine.getMetrics());
      } catch (error) {
        console.error(`Error getting metrics from ${engineId}:`, error);
      }
    }

    return metrics;
  }

  /**
   * Select the best engine for the given platform capabilities.
   * @param capabilities - Platform capabilities
   * @param preferredEngine - Optional preferred engine
   * @returns Selected engine ID
   */
  selectBestEngine(
    capabilities: PlatformCapabilities,
    preferredEngine?: GameEngine,
  ): GameEngine {
    // Store capabilities for future use
    this._capabilities = capabilities;

    // If preferred engine is available and supported, use it
    if (preferredEngine && this.isEngineSupported(preferredEngine, capabilities)) {
      return preferredEngine;
    }

    // Select based on platform capabilities
    const enabled = this.getEnabledEngines();
    let bestEngine: GameEngine | null = null;
    let bestScore = -1;

    for (const engineId of enabled) {
      const score = this.scoreEngine(engineId, capabilities);
      if (score > bestScore) {
        bestScore = score;
        bestEngine = engineId;
      }
    }

    return bestEngine ?? capabilities.recommendedEngine;
  }

  /**
   * Check if an engine is supported on the given platform.
   * @param engineId - Engine identifier
   * @param capabilities - Platform capabilities
   * @returns True if engine is supported
   */
  isEngineSupported(
    engineId: GameEngine,
    capabilities: PlatformCapabilities,
  ): boolean {
    switch (engineId) {
      case "microverse":
        // MicroVerse works on all platforms
        return true;

      case "luanti":
        // Luanti needs at least medium quality
        return (
          capabilities.recommendedQuality === "medium" ||
          capabilities.recommendedQuality === "high" ||
          capabilities.recommendedQuality === "ultra"
        );

      case "openrts":
        // OpenRTS needs at least medium quality and desktop platform
        return (
          (capabilities.platform === "desktop" ||
            capabilities.platform === "web") &&
          (capabilities.recommendedQuality === "high" ||
            capabilities.recommendedQuality === "ultra")
        );

      default:
        return false;
    }
  }

  /**
   * Score an engine for the given platform (higher is better).
   * @param engineId - Engine identifier
   * @param capabilities - Platform capabilities
   * @returns Engine score
   */
  private scoreEngine(engineId: GameEngine, capabilities: PlatformCapabilities): number {
    let score = 0;

    switch (engineId) {
      case "microverse":
        // Base score for compatibility
        score = 50;
        // Bonus for mobile
        if (capabilities.platform === "mobile") score += 30;
        // Bonus for low memory
        if (capabilities.memoryMB < 2048) score += 20;
        break;

      case "luanti":
        // Base score
        score = 70;
        // Bonus for desktop
        if (capabilities.platform === "desktop") score += 10;
        // Bonus for medium quality
        if (capabilities.recommendedQuality === "medium") score += 20;
        // Penalty for low memory
        if (capabilities.memoryMB < 2048) score -= 30;
        break;

      case "openrts":
        // Base score
        score = 90;
        // Bonus for high/ultra quality
        if (capabilities.recommendedQuality === "high") score += 20;
        if (capabilities.recommendedQuality === "ultra") score += 40;
        // Bonus for RTX
        if (capabilities.gpu.isRTX) score += 30;
        // Bonus for Vulkan/DirectX 12
        if (capabilities.supportedBackends.includes("vulkan" as RenderingBackend)) score += 10;
        if (capabilities.supportedBackends.includes("direct3d" as RenderingBackend)) score += 10;
        // Penalty for low VRAM
        if (capabilities.gpu.vramMB < 2048) score -= 40;
        break;
    }

    // Apply priority from config
    const config = this._engineConfigs.get(engineId);
    if (config) {
      score += config.priority * 10;
    }

    return Math.max(0, score);
  }

  /**
   * Update platform capabilities for all engines.
   * @param capabilities - New platform capabilities
   * @returns Map of engine IDs to capability change results
   */
  async updateCapabilities(
    capabilities: PlatformCapabilities,
  ): Promise<Map<GameEngine, CapabilityChangeResult>> {
    this._capabilities = capabilities;
    const results = new Map<GameEngine, CapabilityChangeResult>();

    for (const [engineId, engine] of this._engines) {
      if (engine.isInitialized) {
        try {
          const result = await engine.handleCapabilityChange(capabilities);
          results.set(engineId, result);
        } catch (error) {
          console.error(`Error updating capabilities for ${engineId}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Get engine display information.
   * @param engineId - Engine identifier
   * @returns Display information or undefined
   */
  getDisplayInfo(engineId: GameEngine): EngineDisplayInfo | undefined {
    const engine = this._engines.get(engineId);
    return engine?.displayInfo;
  }

  /**
   * Get all display information.
   * @returns Map of engine IDs to display information
   */
  getAllDisplayInfo(): Map<GameEngine, EngineDisplayInfo> {
    const info = new Map<GameEngine, EngineDisplayInfo>();

    for (const [engineId, engine] of this._engines) {
      info.set(engineId, engine.displayInfo);
    }

    return info;
  }

  /**
   * Migrate state from one engine to another.
   * @param state - Current game state
   * @param targetEngine - Target engine
   * @returns Migrated state
   */
  async migrateState(
    state: UniversalGameState,
    targetEngine: GameEngine,
  ): Promise<UniversalGameState> {
    // Get source and target engines
    const sourceEngine = this._engines.get(state.engine);
    const target = await this.getOrCreateEngine(targetEngine);

    if (!sourceEngine) {
      // No source engine, return state as-is
      return {
        ...state,
        engine: targetEngine,
      };
    }

    // Save current state from source engine
    const currentState = sourceEngine.getState();

    // Load state into target engine
    const loadResult = await target.loadState(currentState);

    // Return the migrated state
    return target.getState();
  }

  /**
   * Create empty metrics for an engine.
   * @param engineId - Engine identifier
   * @returns Empty metrics
   */
  private getEmptyMetrics(engineId: GameEngine): EngineMetrics {
    return {
      engine: engineId,
      timestamp: Date.now(),
      performance: {
        fps: 0,
        fpsMin: 0,
        fpsMax: 0,
        frameTime: 0,
        cpuUsage: 0,
        mainThreadBlocked: 0,
      },
      memory: {
        heapTotal: 0,
        heapUsed: 0,
        heapLimit: 0,
        gpuMemory: 0,
        assetMemory: 0,
        audioMemory: 0,
      },
      graphics: {
        resolution: [0, 0],
        displayResolution: [0, 0],
        pixelRatio: 1,
        textureMemory: 0,
        bufferMemory: 0,
        shaderCount: 0,
        drawCalls: 0,
      },
      entities: {
        total: 0,
        active: 0,
        visible: 0,
        byCategory: {},
      },
      custom: {},
    };
  }

  /**
   * Initialize built-in engine configurations.
   */
  private initializeBuiltInEngines(): void {
    // MicroVerse - NES-SNES era 2D, mobile-friendly
    this._engineConfigs.set("microverse", {
      enabled: true,
      priority: 0,
      config: {
        maxResolution: [480, 360],
        targetFps: 30,
        maxTextureSize: 512,
      },
      autoLoad: false,
      lazyLoad: true,
    });

    // Luanti - Blocky voxel-based, medium quality
    this._engineConfigs.set("luanti", {
      enabled: true,
      priority: 10,
      config: {
        maxResolution: [1280, 720],
        targetFps: 60,
        maxTextureSize: 1024,
        voxelSize: 1,
      },
      autoLoad: false,
      lazyLoad: true,
    });

    // OpenRTS - PS2-level 3D, desktop/gaming
    this._engineConfigs.set("openrts", {
      enabled: true,
      priority: 20,
      config: {
        maxResolution: [3840, 2160],
        targetFps: 60,
        maxTextureSize: 4096,
        enableShadows: true,
        enablePostProcessing: true,
      },
      autoLoad: false,
      lazyLoad: true,
    });
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Factory function for creating engine instances.
 */
export type EngineFactory = () => IGameEngine;

/**
 * Engine configuration entry in the registry.
 */
export interface EngineConfigEntry {
  /** Is engine enabled */
  enabled: boolean;
  /** Priority for engine selection (higher preferred) */
  priority: number;
  /** Engine-specific configuration */
  config: Record<string, unknown>;
  /** Auto-load engine on startup */
  autoLoad: boolean;
  /** Lazy-load engine (only when needed) */
  lazyLoad: boolean;
}

// ============================================================================
// ENGINE DISPLAY INFO
// ============================================================================

/**
 * Built-in engine display information.
 */
export const ENGINE_DISPLAY_INFO: Record<GameEngine, EngineDisplayInfo> = {
  microverse: {
    id: "microverse",
    displayName: "MicroVerse",
    description:
      "NES-SNES era 2D/2.5D graphics. Perfect for mobile devices and low-end hardware. Lightweight and responsive.",
    icon: "engine-microverse",
    screenshots: [],
    minRequirements: {
      cpu: "Any dual-core 1.0 GHz",
      ram: 1,
      gpu: "Integrated graphics",
      storage: 0.5,
    },
    recommendedRequirements: {
      cpu: "Any dual-core 1.5 GHz",
      ram: 2,
      gpu: "Integrated graphics",
      storage: 1,
    },
  },
  luanti: {
    id: "luanti",
    displayName: "Luanti",
    description:
      "Blocky voxel-based engine with Minecraft-inspired aesthetics. Features electronics-themed gameplay and infinite procedural worlds.",
    icon: "engine-luanti",
    screenshots: [],
    minRequirements: {
      cpu: "Dual-core 2.0 GHz",
      ram: 4,
      gpu: "OpenGL 3.3 compatible",
      vram: 1,
      storage: 2,
    },
    recommendedRequirements: {
      cpu: "Quad-core 2.5 GHz",
      ram: 8,
      gpu: "NVIDIA GTX 1050 / AMD RX 560",
      vram: 2,
      storage: 4,
    },
  },
  openrts: {
    id: "openrts",
    displayName: "OpenRTS",
    description:
      "PS2-era 3D graphics with modern enhancements. Full lighting, shadows, and post-processing for the best visual experience.",
    icon: "engine-openrts",
    screenshots: [],
    minRequirements: {
      cpu: "Quad-core 2.5 GHz",
      ram: 8,
      gpu: "NVIDIA GTX 1050 Ti / AMD RX 570",
      vram: 4,
      storage: 5,
    },
    recommendedRequirements: {
      cpu: "Hexa-core 3.0 GHz",
      ram: 16,
      gpu: "NVIDIA RTX 3060 / AMD RX 6700 XT",
      vram: 8,
      storage: 10,
    },
  },
};

// ============================================================================
// ENGINE SELECTION CRITERIA
// ============================================================================

/**
 * Criteria for selecting an engine.
 */
export interface EngineSelectionCriteria {
  /** Platform type */
  platform?: "mobile" | "desktop" | "web" | "console";
  /** Available RAM in MB */
  memoryMB?: number;
  /** GPU VRAM in MB */
  vramMB?: number;
  /** Is RTX GPU */
  isRTX?: boolean;
  /** Preferred quality tier */
  preferredQuality?: QualityTier;
  /** Target FPS */
  targetFps?: number;
  /** User preference */
  userPreference?: GameEngine;
}

/**
 * Select the best engine based on selection criteria.
 * @param criteria - Selection criteria
 * @returns Recommended engine
 */
export function selectEngineByCriteria(criteria: EngineSelectionCriteria): GameEngine {
  const { platform, memoryMB, vramMB, isRTX, preferredQuality, userPreference } = criteria;

  // If user has a preference and it's available, respect it
  if (userPreference) {
    return userPreference;
  }

  // Mobile always gets MicroVerse
  if (platform === "mobile") {
    return "microverse";
  }

  // Low memory gets MicroVerse
  if (memoryMB !== undefined && memoryMB < 4096) {
    return "microverse";
  }

  // Low VRAM gets Luanti
  if (vramMB !== undefined && vramMB < 2048) {
    return "luanti";
  }

  // High quality preference gets OpenRTS if hardware allows
  if (preferredQuality === "high" || preferredQuality === "ultra") {
    if (memoryMB !== undefined && memoryMB >= 8192 && vramMB !== undefined && vramMB >= 4096) {
      return "openrts";
    }
    return "luanti";
  }

  // RTX GPUs get OpenRTS
  if (isRTX) {
    return "openrts";
  }

  // Default to Luanti for mid-range hardware
  return "luanti";
}

/**
 * Get recommended quality for an engine based on hardware.
 * @param engine - Engine identifier
 * @param memoryMB - Available RAM in MB
 * @param vramMB - Available VRAM in MB
 * @returns Recommended quality tier
 */
export function getRecommendedQuality(
  engine: GameEngine,
  memoryMB: number,
  vramMB: number,
): QualityTier {
  switch (engine) {
    case "microverse":
      // MicroVerse only supports low quality
      return "low";

    case "luanti":
      if (memoryMB >= 8192 && vramMB >= 2048) {
        return "medium";
      }
      return "low";

    case "openrts":
      if (memoryMB >= 16384 && vramMB >= 8192) {
        return "ultra";
      }
      if (memoryMB >= 8192 && vramMB >= 4096) {
        return "high";
      }
      return "medium";

    default:
      return "low";
  }
}
