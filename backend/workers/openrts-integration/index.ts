/**
 * OpenRTS Integration
 *
 * Main API for integrating godot-open-rts with StudyLoG.AI and DMLoG.AI.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createOpenRTSIntegration } from '@studylog/openrts-integration';
 *
 * const openrts = await createOpenRTSIntegration({
 *   product: 'studylog',
 *   qualityTier: 'high',
 * });
 *
 * // Generate a lab map
 * const map = await openrts.generateLabMap('physics_lab');
 * await openrts.loadMap(map);
 *
 * // Spawn equipment units
 * await openrts.spawnLabEquipment('microscope', { x: -5, y: 0, z: 0 });
 * ```
 *
 * ## Product Integration
 *
 * ### StudyLoG.AI
 * - Science lab simulations with 3D equipment
 * - Physics experiments with terrain
 * - Interactive learning environments
 *
 * ### DMLoG.AI
 * - Full 3D battle maps
 * - Miniature-style figures
 * - Terrain-based tactical combat
 *
 * ## Quality Scaling
 *
 * - Cloud AI handles intelligence
 * - Device renders graphics
 * - Fallback to Luanti/MicroVerse on weak devices
 *
 * @packageDocumentation
 */

// ============================================================================
// Public API Exports
// ============================================================================

export * from './types.js';
export * from './openrts-bridge.js';
export * from './unit-adapter.js';
export * from './terrain-generator.js';
export * from './camera-controller.js';
export * from './selection-system.js';
export * from './pathfinding-3d.js';
export * from './ai-commander.js';
export * from './multiplayer-sync.js';

// Re-export commonly used items
export {
  OpenRTSBridge,
  createOpenRTSBridge,
  shouldOffloadToCloud,
  getWorkerConfig,
} from './openrts-bridge.js';

export {
  UnitAdapter,
  createUnitAdapter,
  createStudyLogAdapter,
  createDMLoGAdapter,
} from './unit-adapter.js';

export {
  TerrainGenerator,
  createTerrainGenerator,
  generateLabMap,
  generateBattleMap,
  STUDYLOG_LAB_PRESETS,
  DMLOG_BATTLE_PRESETS,
} from './terrain-generator.js';

export {
  CameraController,
  createCameraController,
  createStudyLogCamera,
  createDMLoGCamera,
} from './camera-controller.js';

export {
  SelectionSystem,
  createSelectionSystem,
  createStudyLogSelection,
  createDMLoGSelection,
} from './selection-system.js';

export {
  Pathfinding3D,
  CloudPathfinding,
  createPathfinding,
  createCloudPathfinding,
} from './pathfinding-3d.js';

export {
  AICommander,
  createAICommander,
  createStudyLogTutor,
  createDMLoGDM,
  DIFFICULTY_PRESETS,
  PERSONALITY_PRESETS,
} from './ai-commander.js';

export {
  MultiplayerSync,
  createMultiplayerSync,
  createStudyLogSession,
  createDMLoGSession,
} from './multiplayer-sync.js';

// Import types for use in main API
import type {
  OpenRTSConfig,
  QualityTier,
  TerrainData,
  GameState,
  Vector3,
  UnitInstance,
  StructureInstance,
  PlayerState,
  SelectionState,
  RTSCameraConfig,
  PathRequest,
  PathResult,
  LabEquipment,
  MiniatureFigure,
} from './types.js';

import {
  OpenRTSBridge,
  createOpenRTSBridge as createBridge,
} from './openrts-bridge.js';

import {
  UnitAdapter,
  createStudyLogAdapter,
  createDMLoGAdapter,
} from './unit-adapter.js';

import {
  TerrainGenerator,
  generateLabMap as generateLab,
  generateBattleMap as generateBattle,
} from './terrain-generator.js';

import {
  CameraController,
  createStudyLogCamera,
  createDMLoGCamera,
} from './camera-controller.js';

import {
  SelectionSystem,
  createStudyLogSelection,
  createDMLoGSelection,
} from './selection-system.js';

import {
  Pathfinding3D,
  createPathfinding,
} from './pathfinding-3d.js';

import {
  AICommander,
  createStudyLogTutor,
  createDMLoGDM,
} from './ai-commander.js';

import {
  MultiplayerSync,
  createStudyLogSession,
  createDMLoGSession,
} from './multiplayer-sync.js';

// ============================================================================
// Integration Configuration
// ============================================================================

export interface OpenRTSIntegrationConfig {
  /** Product type (studylog or dmlog) */
  product: 'studylog' | 'dmlog' | 'generic';

  /** Quality tier */
  qualityTier: QualityTier;

  /** Auto-detect device capabilities */
  autoDetectQuality?: boolean;

  /** Bridge configuration */
  bridge?: {
    host?: string;
    port?: number;
  };

  /** Pathfinding configuration */
  pathfinding?: {
    threads?: number;
    cacheSize?: number;
    useCloud?: boolean;
    cloudEndpoint?: string;
  };

  /** AI configuration */
  ai?: {
    useCloud?: boolean;
    cloudEndpoint?: string;
    difficulty?: 'easy' | 'medium' | 'hard' | 'expert' | 'insane';
  };

  /** Multiplayer configuration */
  multiplayer?: {
    serverUrl?: string;
    autoConnect?: boolean;
  };
}

export const DEFAULT_INTEGRATION_CONFIG: OpenRTSIntegrationConfig = {
  product: 'generic',
  qualityTier: 'high',
  autoDetectQuality: true,
  bridge: {
    host: '127.0.0.1',
    port: 9877,
  },
};

// ============================================================================
// Main Integration Class
// ============================================================================

/**
 * Main OpenRTS integration class
 *
 * Provides a unified API for integrating godot-open-rts with
 * StudyLoG.AI and DMLoG.AI products.
 */
export class OpenRTSIntegration {
  private bridge: OpenRTSBridge | null = null;
  private unitAdapter: UnitAdapter;
  private terrainGenerator: TerrainGenerator;
  private cameraController: CameraController;
  private selectionSystem: SelectionSystem;
  private pathfinding: Pathfinding3D;
  private aiCommander: AICommander | null = null;
  private multiplayer: MultiplayerSync | null = null;

  private currentTerrain: TerrainData | null = null;
  private currentMap: string | null = null;
  private isInitialized: boolean = false;

  private constructor(
    private config: OpenRTSIntegrationConfig
  ) {
    // Create subsystems based on product type
    switch (config.product) {
      case 'studylog':
        this.unitAdapter = createStudyLogAdapter(config.qualityTier);
        this.cameraController = createStudyLogCamera();
        this.selectionSystem = createStudyLogSelection();
        break;

      case 'dmlog':
        this.unitAdapter = createDMLoGAdapter(config.qualityTier);
        this.cameraController = createDMLoGCamera();
        this.selectionSystem = createDMLoGSelection();
        break;

      default:
        this.unitAdapter = new UnitAdapter({ qualityTier: config.qualityTier });
        this.cameraController = new CameraController();
        this.selectionSystem = new SelectionSystem();
    }

    this.terrainGenerator = new TerrainGenerator();
    this.pathfinding = createPathfinding(config.pathfinding);
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  /**
   * Initialize the OpenRTS integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Connect to bridge
    this.bridge = await createBridge({
      host: this.config.bridge?.host ?? '127.0.0.1',
      port: this.config.bridge?.port ?? 9877,
    });

    // Initialize with config
    await this.bridge.initialize({
      qualityTier: this.config.qualityTier,
      productType: this.config.product,
    });

    // Detect quality tier if enabled
    if (this.config.autoDetectQuality) {
      const capabilities = this.bridge.getDeviceCapabilities();
      if (capabilities) {
        this.config.qualityTier = capabilities.recommendedTier;
        this.unitAdapter.setQualityTier(this.config.qualityTier);
      }
    }

    // Setup AI commander
    if (this.config.product === 'dmlog') {
      this.aiCommander = createDMLoGDM(
        this.config.ai?.difficulty ?? 'medium',
        'ai_dm'
      );
    } else if (this.config.product === 'studylog') {
      this.aiCommander = createStudyLogTutor('friendly', 'ai_tutor');
    }

    // Connect multiplayer if enabled
    if (this.config.multiplayer?.autoConnect) {
      await this.connectMultiplayer();
    }

    this.isInitialized = true;
  }

  // ========================================================================
  // Map Generation
  // ========================================================================

  /**
   * Generate a StudyLoG lab map
   */
  async generateLabMap(
    presetId: string = 'physics_lab'
  ): Promise<TerrainData> {
    const result = generateLab(presetId);
    this.currentTerrain = result.terrain;
    this.currentMap = presetId;
    return result.terrain;
  }

  /**
   * Generate a DMLoG battle map
   */
  async generateBattleMap(
    presetId: string = 'dungeon_chamber'
  ): Promise<TerrainData> {
    const result = generateBattle(presetId);
    this.currentTerrain = result.terrain;
    this.currentMap = presetId;
    return result.terrain;
  }

  /**
   * Generate procedural terrain
   */
  async generateTerrain(options?: {
    seed?: number;
    heightScale?: number;
    waterLevel?: number;
    algorithm?: 'perlin' | 'simplex' | 'hybrid';
  }): Promise<TerrainData> {
    if (options?.seed) {
      this.terrainGenerator.setSeed(options.seed);
    }

    const terrain = this.terrainGenerator.generate();
    this.currentTerrain = terrain;
    return terrain;
  }

  /**
   * Load a map into the engine
   */
  async loadMap(
    mapId: string,
    terrain?: TerrainData
  ): Promise<boolean> {
    if (!this.bridge) {
      throw new Error('OpenRTS not initialized');
    }

    const toLoad = terrain || this.currentTerrain;
    if (!toLoad) {
      throw new Error('No terrain data available');
    }

    const result = await this.bridge.loadMap(mapId, toLoad);

    if (result.success) {
      // Build navigation grid for pathfinding
      this.pathfinding.buildGrid(toLoad.heightmap);
      this.currentMap = mapId;
    }

    return result.success;
  }

  // ========================================================================
  // Unit Management
  // ========================================================================

  /**
   * Spawn a unit at position
   */
  async spawnUnit(
    definitionId: string,
    position: Vector3,
    ownerId: string
  ): Promise<string> {
    if (!this.bridge) {
      throw new Error('OpenRTS not initialized');
    }

    const unitId = `${definitionId}_${Date.now()}`;
    const result = await this.bridge.spawnUnit(unitId, definitionId, position, ownerId);

    if (!result.success) {
      throw new Error(`Failed to spawn unit: ${definitionId}`);
    }

    return result.instanceId;
  }

  /**
   * Spawn StudyLoG lab equipment
   */
  async spawnLabEquipment(
    equipment: LabEquipment,
    position: Vector3,
    ownerId: string = 'lab'
  ): Promise<string> {
    const definition = this.unitAdapter.labEquipmentToUnit(equipment, position, ownerId);
    return this.spawnUnit(definition.id, position, ownerId);
  }

  /**
   * Spawn DMLoG miniature figure
   */
  async spawnMiniature(
    figure: MiniatureFigure
  ): Promise<string> {
    const definition = this.unitAdapter.miniatureToUnit(figure);
    return this.spawnUnit(definition.id, figure.position, figure.ownerId);
  }

  /**
   * Despawn a unit
   */
  despawnUnit(unitId: string): void {
    if (!this.bridge) {
      throw new Error('OpenRTS not initialized');
    }

    this.bridge.despawnUnit(unitId);
  }

  /**
   * Move units to position
   */
  moveUnits(unitIds: string[], target: Vector3, queued: boolean = false): void {
    if (!this.bridge) {
      throw new Error('OpenRTS not initialized');
    }

    this.bridge.moveUnits(unitIds, target, queued);
  }

  /**
   * Order units to attack
   */
  attackOrder(unitIds: string[], targetId: string, queued: boolean = false): void {
    if (!this.bridge) {
      throw new Error('OpenRTS not initialized');
    }

    this.bridge.attackOrder(unitIds, targetId, queued);
  }

  // ========================================================================
  // Camera Control
  // ========================================================================

  /**
   * Get camera controller
   */
  getCamera(): CameraController {
    return this.cameraController;
  }

  /**
   * Update camera from controller state
   */
  syncCamera(): void {
    if (!this.bridge) return;

    const config = this.cameraController.getConfig();
    this.bridge.setCamera(config);
  }

  /**
   * Focus camera on units
   */
  focusOnUnits(unitIds: string[]): void {
    this.cameraController.focusOnUnits(unitIds);
  }

  // ========================================================================
  // Selection
  // ========================================================================

  /**
   * Get selection system
   */
  getSelection(): SelectionSystem {
    return this.selectionSystem;
  }

  /**
   * Get current selection
   */
  getSelectedUnits(): string[] {
    return this.selectionSystem.getSelectedUnits();
  }

  /**
   * Set selection
   */
  setSelection(unitIds: string[]): void {
    this.selectionSystem.setSelection(unitIds);

    if (this.bridge) {
      this.bridge.updateSelection(this.selectionSystem.getState());
    }
  }

  // ========================================================================
  // Pathfinding
  // ========================================================================

  /**
   * Find path between two points
   */
  async findPath(request: PathRequest): Promise<PathResult> {
    return this.pathfinding.findPath(request);
  }

  /**
   * Find paths for multiple units
   */
  async findPathsBatch(requests: PathRequest[]): Promise<PathResult[]> {
    return this.pathfinding.findPathsBatch(requests);
  }

  // ========================================================================
  // AI
  // ========================================================================

  /**
   * Get AI commander
   */
  getAI(): AICommander | null {
    return this.aiCommander;
  }

  /**
   * Start AI
   */
  async startAI(gameState: {
    units: Map<string, UnitInstance>;
    structures: Map<string, StructureInstance>;
    players: Map<string, PlayerState>;
  }): Promise<void> {
    if (!this.aiCommander) {
      throw new Error('No AI commander configured');
    }

    this.aiCommander.start(gameState);
  }

  /**
   * Stop AI
   */
  stopAI(): void {
    if (this.aiCommander) {
      this.aiCommander.stop();
    }
  }

  // ========================================================================
  // Multiplayer
  // ========================================================================

  /**
   * Get multiplayer sync
   */
  getMultiplayer(): MultiplayerSync | null {
    return this.multiplayer;
  }

  /**
   * Connect to multiplayer server
   */
  async connectMultiplayer(roomId?: string): Promise<void> {
    if (this.multiplayer?.isConnected) {
      return;
    }

    let session: MultiplayerSync;

    switch (this.config.product) {
      case 'studylog':
        session = createStudyLogSession(
          roomId || 'default',
          'local_player'
        );
        break;
      case 'dmlog':
        session = createDMLoGSession(
          roomId || 'default',
          'local_player'
        );
        break;
      default:
        session = createMultiplayerSync({
          roomId: roomId || 'default',
          playerId: 'local_player',
          serverUrl: this.config.multiplayer?.serverUrl,
        });
    }

    await session.connect();
    this.multiplayer = session;
  }

  /**
   * Disconnect from multiplayer
   */
  disconnectMultiplayer(): void {
    if (this.multiplayer) {
      this.multiplayer.disconnect();
      this.multiplayer = null;
    }
  }

  // ========================================================================
  // State
  // ========================================================================

  /**
   * Get current terrain
   */
  getTerrain(): TerrainData | null {
    return this.currentTerrain;
  }

  /**
   * Get current map ID
   */
  getMapId(): string | null {
    return this.currentMap;
  }

  /**
   * Check if initialized
   */
  get ready(): boolean {
    return this.isInitialized;
  }

  /**
   * Get bridge connection status
   */
  get connected(): boolean {
    return this.bridge?.isConnected ?? false;
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Update quality tier
   */
  setQualityTier(tier: QualityTier): void {
    this.config.qualityTier = tier;
    this.unitAdapter.setQualityTier(tier);
  }

  /**
   * Get current configuration
   */
  getConfig(): OpenRTSIntegrationConfig {
    return { ...this.config };
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAI();
    this.disconnectMultiplayer();

    if (this.bridge) {
      this.bridge.disconnect();
      this.bridge = null;
    }

    this.isInitialized = false;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create and initialize OpenRTS integration
 */
export async function createOpenRTSIntegration(
  config?: Partial<OpenRTSIntegrationConfig>
): Promise<OpenRTSIntegration> {
  const fullConfig: OpenRTSIntegrationConfig = {
    ...DEFAULT_INTEGRATION_CONFIG,
    ...config,
    bridge: {
      ...DEFAULT_INTEGRATION_CONFIG.bridge,
      ...(config?.bridge ?? {}),
    },
  };

  const integration = new OpenRTSIntegration(fullConfig);
  await integration.initialize();

  return integration;
}

/**
 * Create StudyLoG-specific integration
 */
export async function createStudyLogIntegration(
  config?: Partial<Omit<OpenRTSIntegrationConfig, 'product'>>
): Promise<OpenRTSIntegration> {
  return createOpenRTSIntegration({
    ...config,
    product: 'studylog',
    qualityTier: config?.qualityTier || 'high',
  });
}

/**
 * Create DMLoG-specific integration
 */
export async function createDMLoGIntegration(
  config?: Partial<Omit<OpenRTSIntegrationConfig, 'product'>>
): Promise<OpenRTSIntegration> {
  return createOpenRTSIntegration({
    ...config,
    product: 'dmlog',
    qualityTier: config?.qualityTier || 'high',
  });
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';

// ============================================================================
// Default Export
// ============================================================================

export default OpenRTSIntegration;
