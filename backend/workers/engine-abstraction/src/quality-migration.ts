/**
 * Quality Migration
 *
 * Migrates save data between engines with quality preservation.
 * Handles data loss, version compatibility, and transform mappings.
 *
 * @module engine-abstraction/quality-migration
 */

import type {
  UniversalGameState,
  GameEngine,
  QualityTier,
  MigrationResult,
  DataLossSummary,
  EntityState,
  AssetMetadata,
  AssetFormat,
  WorldState,
  PlayerState,
  ProgressState,
} from "./types.js";
import { AssetTransformer } from "./asset-transformer.js";

// ============================================================================
// QUALITY MIGRATOR
// ============================================================================

/**
 * Migrates game state between different engines with quality preservation.
 * Handles bidirectional migration between MicroVerse, Luanti, and OpenRTS.
 */
export class QualityMigrator {
  private static _instance: QualityMigrator | null = null;
  private _assetTransformer: AssetTransformer;
  private _migrationRules: Map<MigrationPair, MigrationRule> = new Map();
  private _versionCompatibility: Map<string, VersionCompatibility> = new Map();
  private _migrationHistory: MigrationRecord[] = [];

  private constructor() {
    this._assetTransformer = AssetTransformer.getInstance();
    this.initializeMigrationRules();
    this.initializeVersionCompatibility();
  }

  /**
   * Get the singleton QualityMigrator instance.
   */
  static getInstance(): QualityMigrator {
    if (!QualityMigrator._instance) {
      QualityMigrator._instance = new QualityMigrator();
    }
    return QualityMigrator._instance;
  }

  /**
   * Migrate game state to a different engine.
   * @param state - Source game state
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Migration result
   */
  async migrate(
    state: UniversalGameState,
    targetEngine: GameEngine,
    options: MigrationOptions = {},
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const sourceEngine = state.engine;

    // Check if migration is needed
    if (sourceEngine === targetEngine) {
      return {
        success: true,
        sourceEngine,
        targetEngine,
        state,
        warnings: [],
        errors: [],
      };
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const dataLoss: DataLossSummary = {
      categories: {},
      percentageLost: 0,
      recommendations: [],
    };

    try {
      // Get migration rule
      const pair: MigrationPair = `${sourceEngine}->${targetEngine}` as MigrationPair;
      const rule = this._migrationRules.get(pair);

      if (!rule) {
        errors.push(`No migration rule found for ${pair}`);
        return {
          success: false,
          sourceEngine,
          targetEngine,
          state,
          warnings,
          errors,
          dataLoss,
        };
      }

      // Check version compatibility
      const compatibility = this.checkVersionCompatibility(state.version, targetEngine);
      if (!compatibility.compatible) {
        if (options.strictVersion) {
          errors.push(`Version incompatibility: ${state.version} not supported for ${targetEngine}`);
          return {
            success: false,
            sourceEngine,
            targetEngine,
            state,
            warnings,
            errors,
            dataLoss,
          };
        }
        warnings.push(`Version incompatibility: ${compatibility.reason}`);
      }

      // Transform world state
      const world = await this.migrateWorld(state.world, targetEngine, options);

      // Transform player state
      const player = await this.migratePlayer(state.player, targetEngine, options);

      // Transform progress state
      const progress = await this.migrateProgress(state.progress, targetEngine, options);

      // Collect data loss information
      this.collectDataLoss(dataLoss, state, targetEngine);

      // Create migrated state
      const migratedState: UniversalGameState = {
        ...state,
        version: this.getTargetVersion(targetEngine),
        engine: targetEngine,
        quality: this.adjustQuality(state.quality, targetEngine, options),
        world,
        player,
        progress,
      };

      // Record migration
      this.recordMigration({
        timestamp: Date.now(),
        sourceEngine,
        targetEngine,
        sourceVersion: state.version,
        targetVersion: migratedState.version,
        duration: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        sourceEngine,
        targetEngine,
        state: migratedState,
        warnings,
        errors,
        dataLoss: Object.keys(dataLoss.categories).length > 0 ? dataLoss : undefined,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      this.recordMigration({
        timestamp: Date.now(),
        sourceEngine,
        targetEngine,
        sourceVersion: state.version,
        targetVersion: state.version,
        duration: Date.now() - startTime,
        success: false,
        error: errorMessage,
      });

      return {
        success: false,
        sourceEngine,
        targetEngine,
        state,
        warnings,
        errors,
        dataLoss,
      };
    }
  }

  /**
   * Batch migrate multiple states.
   * @param states - Array of states with target engines
   * @param options - Migration options
   * @returns Array of migration results
   */
  async migrateBatch(
    states: Array<{ state: UniversalGameState; targetEngine: GameEngine }>,
    options: MigrationOptions = {},
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

    for (const { state, targetEngine } of states) {
      const result = await this.migrate(state, targetEngine, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Migrate world state to target engine.
   * @param world - Source world state
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Migrated world state
   */
  private async migrateWorld(
    world: WorldState,
    targetEngine: GameEngine,
    options: MigrationOptions,
  ): Promise<WorldState> {
    // Transform entities
    const entities = await Promise.all(
      world.entities.map((entity) => this.migrateEntity(entity, targetEngine, options)),
    );

    // Filter entities that couldn't be transformed
    const validEntities = entities.filter((e): e is EntityState => e !== null);

    return {
      ...world,
      entities: validEntities,
      // Adjust environment for target engine
      environment: this.migrateEnvironment(world.environment, targetEngine),
    };
  }

  /**
   * Migrate entity to target engine.
   * @param entity - Source entity
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Migrated entity or null if migration failed
   */
  private async migrateEntity(
    entity: EntityState,
    targetEngine: GameEngine,
    options: MigrationOptions,
  ): Promise<EntityState | null> {
    // Check if entity type is supported
    if (!this.isEntityTypeSupported(entity.type, targetEngine)) {
      if (!options.preserveUnsupported) {
        return null;
      }
    }

    // Transform position for target engine
    const position = this.transformPosition(entity.position, targetEngine);

    // Transform rotation for target engine
    const rotation = this.transformRotation(entity.rotation, targetEngine);

    // Transform scale for target engine
    const scale = this.transformScale(entity.scale, targetEngine);

    return {
      ...entity,
      position,
      rotation,
      scale,
    };
  }

  /**
   * Migrate player state to target engine.
   * @param player - Source player state
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Migrated player state
   */
  private async migratePlayer(
    player: PlayerState,
    targetEngine: GameEngine,
    options: MigrationOptions,
  ): Promise<PlayerState> {
    return {
      ...player,
      // Transform position
      position: this.transformPosition(player.position, targetEngine),
      // Transform rotation
      rotation: this.transformRotation(player.rotation, targetEngine),
    };
  }

  /**
   * Migrate progress state to target engine.
   * @param progress - Source progress state
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Migrated progress state
   */
  private async migrateProgress(
    progress: ProgressState,
    targetEngine: GameEngine,
    options: MigrationOptions,
  ): Promise<ProgressState> {
    // Progress state is generally engine-independent
    // But we may need to filter some features
    return progress;
  }

  /**
   * Migrate environment state to target engine.
   * @param environment - Source environment
   * @param targetEngine - Target engine
   * @returns Migrated environment
   */
  private migrateEnvironment(
    environment: WorldState["environment"],
    targetEngine: GameEngine,
  ): WorldState["environment"] {
    // Adjust environment for target engine capabilities
    switch (targetEngine) {
      case "microverse":
        // 2D engine - simplify environment
        return {
          ...environment,
          // Remove fog for 2D
          fog: environment.fog ? { ...environment.fog, enabled: false } : undefined,
          // Flatten gravity
          gravity: { x: 0, y: environment.gravity.y, z: 0 },
        };

      case "luanti":
        // Voxel engine - adjust for blocky world
        return {
          ...environment,
          // Quantize fog density
          fog: environment.fog
            ? { ...environment.fog, density: Math.round(environment.fog.density * 10) / 10 }
            : undefined,
        };

      case "openrts":
        // Full 3D engine - preserve everything
        return environment;

      default:
        return environment;
    }
  }

  /**
   * Transform position for target engine.
   * @param position - Source position
   * @param targetEngine - Target engine
   * @returns Transformed position
   */
  private transformPosition(
    position: { x: number; y: number; z: number },
    targetEngine: GameEngine,
  ): { x: number; y: number; z: number } {
    switch (targetEngine) {
      case "microverse":
        // 2D engine - flatten Z
        return { x: position.x, y: position.y, z: 0 };

      case "luanti":
        // Voxel engine - round to nearest block
        return {
          x: Math.round(position.x),
          y: Math.round(position.y),
          z: Math.round(position.z),
        };

      case "openrts":
        // Full 3D - preserve position
        return position;

      default:
        return position;
    }
  }

  /**
   * Transform rotation for target engine.
   * @param rotation - Source rotation
   * @param targetEngine - Target engine
   * @returns Transformed rotation
   */
  private transformRotation(
    rotation: { x: number; y: number; z: number },
    targetEngine: GameEngine,
  ): { x: number; y: number; z: number } {
    switch (targetEngine) {
      case "microverse":
        // 2D engine - only Z rotation matters
        return { x: 0, y: 0, z: rotation.z };

      case "luanti":
        // Voxel engine - round to 90 degree increments
        return {
          x: Math.round(rotation.x / 90) * 90,
          y: Math.round(rotation.y / 90) * 90,
          z: Math.round(rotation.z / 90) * 90,
        };

      case "openrts":
        // Full 3D - preserve rotation
        return rotation;

      default:
        return rotation;
    }
  }

  /**
   * Transform scale for target engine.
   * @param scale - Source scale
   * @param targetEngine - Target engine
   * @returns Transformed scale
   */
  private transformScale(
    scale: { x: number; y: number; z: number },
    targetEngine: GameEngine,
  ): { x: number; y: number; z: number } {
    switch (targetEngine) {
      case "microverse":
        // 2D engine - uniform scale
        const avg = (scale.x + scale.y + scale.z) / 3;
        return { x: avg, y: avg, z: 1 };

      case "luanti":
        // Voxel engine - snap to whole units
        return {
          x: Math.max(1, Math.round(scale.x)),
          y: Math.max(1, Math.round(scale.y)),
          z: Math.max(1, Math.round(scale.z)),
        };

      case "openrts":
        // Full 3D - preserve scale
        return scale;

      default:
        return scale;
    }
  }

  /**
   * Check if an entity type is supported by the target engine.
   * @param entityType - Entity type to check
   * @param targetEngine - Target engine
   * @returns True if supported
   */
  private isEntityTypeSupported(entityType: string, targetEngine: GameEngine): boolean {
    // Define entity type support per engine
    const supportedTypes: Record<GameEngine, string[]> = {
      microverse: ["character", "prop", "tile", "background", "ui"],
      luanti: ["character", "prop", "tile", "background"],
      openrts: ["character", "prop", "model", "background"],
    };

    return supportedTypes[targetEngine]?.includes(entityType) ?? false;
  }

  /**
   * Adjust quality tier for target engine.
   * @param sourceQuality - Source quality tier
   * @param targetEngine - Target engine
   * @param options - Migration options
   * @returns Adjusted quality tier
   */
  private adjustQuality(
    sourceQuality: QualityTier,
    targetEngine: GameEngine,
    options: MigrationOptions,
  ): QualityTier {
    // If quality is specified, use it
    if (options.quality !== undefined) {
      return options.quality;
    }

    // Adjust based on engine capabilities
    switch (targetEngine) {
      case "microverse":
        // MicroVerse only supports low quality
        return "low";

      case "luanti":
        // Luanti supports low and medium
        if (sourceQuality === "high" || sourceQuality === "ultra") {
          return "medium";
        }
        return sourceQuality;

      case "openrts":
        // OpenRTS supports all qualities
        return sourceQuality;

      default:
        return sourceQuality;
    }
  }

  /**
   * Collect data loss information.
   * @param dataLoss - Data loss summary to populate
   * @param state - Source state
   * @param targetEngine - Target engine
   */
  private collectDataLoss(
    dataLoss: DataLossSummary,
    state: UniversalGameState,
    targetEngine: GameEngine,
  ): void {
    let totalFeatures = 0;
    let lostFeatures = 0;

    // Check entity support
    for (const entity of state.world.entities) {
      totalFeatures++;
      if (!this.isEntityTypeSupported(entity.type, targetEngine)) {
        lostFeatures++;
        if (!dataLoss.categories.entities) {
          dataLoss.categories.entities = [];
        }
        dataLoss.categories.entities.push(`${entity.type}:${entity.id}`);
      }
    }

    // Check quality loss
    if (state.quality === "ultra" && targetEngine === "microverse") {
      lostFeatures += 5; // Estimated loss
      if (!dataLoss.categories.graphics) {
        dataLoss.categories.graphics = [];
      }
      dataLoss.categories.graphics.push("Ray tracing", "HDR", "Advanced shaders");
    }

    // Calculate percentage
    if (totalFeatures > 0) {
      dataLoss.percentageLost = Math.round((lostFeatures / totalFeatures) * 100);
    }

    // Generate recommendations
    if (dataLoss.percentageLost > 0) {
      if (targetEngine === "microverse") {
        dataLoss.recommendations.push(
          "Some 3D features will be simplified for 2D rendering",
          "Consider using Luanti or OpenRTS for full feature support",
        );
      } else if (targetEngine === "luanti") {
        dataLoss.recommendations.push(
          "Some visual effects will be simplified for voxel rendering",
          "Use OpenRTS for advanced graphics features",
        );
      }
    }
  }

  /**
   * Check version compatibility for migration.
   * @param version - State version
   * @param targetEngine - Target engine
   * @returns Compatibility check result
   */
  private checkVersionCompatibility(
    version: string,
    targetEngine: GameEngine,
  ): CompatibilityCheck {
    const compatibility = this._versionCompatibility.get(version);

    if (!compatibility) {
      return {
        compatible: false,
        reason: `Unknown state version: ${version}`,
      };
    }

    if (!compatibility.engines.includes(targetEngine)) {
      return {
        compatible: false,
        reason: `Version ${version} is not compatible with ${targetEngine}`,
      };
    }

    return {
      compatible: true,
      deprecated: compatibility.deprecated,
    };
  }

  /**
   * Get target version for engine.
   * @param targetEngine - Target engine
   * @returns Target version string
   */
  private getTargetVersion(targetEngine: GameEngine): string {
    // Return current version for target engine
    return "1.0.0";
  }

  /**
   * Record a migration in history.
   * @param record - Migration record
   */
  private recordMigration(record: MigrationRecord): void {
    this._migrationHistory.push(record);

    // Trim history if too large
    if (this._migrationHistory.length > 1000) {
      this._migrationHistory = this._migrationHistory.slice(-1000);
    }
  }

  /**
   * Get migration history.
   * @param limit - Maximum number of records to return
   * @returns Migration history
   */
  getHistory(limit?: number): MigrationRecord[] {
    if (limit) {
      return this._migrationHistory.slice(-limit);
    }
    return [...this._migrationHistory];
  }

  /**
   * Get migration statistics.
   * @returns Migration statistics
   */
  getStats(): MigrationStats {
    const successful = this._migrationHistory.filter((r) => r.success).length;
    const failed = this._migrationHistory.filter((r) => !r.success).length;

    const byPair: Map<string, { count: number; success: number; fail: number }> = new Map();

    for (const record of this._migrationHistory) {
      const pair = `${record.sourceEngine}->${record.targetEngine}`;
      const stats = byPair.get(pair) ?? { count: 0, success: 0, fail: 0 };
      stats.count++;
      if (record.success) {
        stats.success++;
      } else {
        stats.fail++;
      }
      byPair.set(pair, stats);
    }

    return {
      total: this._migrationHistory.length,
      successful,
      failed,
      successRate: this._migrationHistory.length > 0
        ? successful / this._migrationHistory.length
        : 0,
      byPair: Object.fromEntries(byPair),
    };
  }

  /**
   * Clear migration history.
   */
  clearHistory(): void {
    this._migrationHistory = [];
  }

  /**
   * Initialize default migration rules.
   */
  private initializeMigrationRules(): void {
    // MicroVerse -> Luanti
    this._migrationRules.set("microverse->luanti", {
      supportedFeatures: ["position", "rotation_2d", "scale_2d", "sprite"],
      lostFeatures: ["z_rotation", "3d_position", "advanced_shading"],
      qualityImpact: QualityImpact.LOW,
      reversible: true,
    });

    // MicroVerse -> OpenRTS
    this._migrationRules.set("microverse->openrts", {
      supportedFeatures: ["position", "rotation", "scale", "sprite", "basic_3d"],
      lostFeatures: ["advanced_lighting", "shadows"],
      qualityImpact: QualityImpact.MEDIUM,
      reversible: true,
    });

    // Luanti -> MicroVerse
    this._migrationRules.set("luanti->microverse", {
      supportedFeatures: ["position", "rotation_2d", "scale", "voxel"],
      lostFeatures: ["3d_rotation", "height", "depth"],
      qualityImpact: QualityImpact.HIGH,
      reversible: true,
    });

    // Luanti -> OpenRTS
    this._migrationRules.set("luanti->openrts", {
      supportedFeatures: ["position", "rotation", "scale", "voxel", "basic_3d"],
      lostFeatures: ["blocky_aesthetic", "grid_alignment"],
      qualityImpact: QualityImpact.LOW,
      reversible: true,
    });

    // OpenRTS -> MicroVerse
    this._migrationRules.set("openrts->microverse", {
      supportedFeatures: ["position", "scale", "mesh"],
      lostFeatures: ["3d_rotation", "z_position", "lighting", "shadows"],
      qualityImpact: QualityImpact.VERY_HIGH,
      reversible: false,
    });

    // OpenRTS -> Luanti
    this._migrationRules.set("openrts->luanti", {
      supportedFeatures: ["position", "rotation", "scale", "mesh"],
      lostFeatures: ["smooth_lighting", "advanced_shaders"],
      qualityImpact: QualityImpact.MEDIUM,
      reversible: true,
    });
  }

  /**
   * Initialize version compatibility information.
   */
  private initializeVersionCompatibility(): void {
    this._versionCompatibility.set("1.0.0", {
      version: "1.0.0",
      engines: ["microverse", "luanti", "openrts"],
      deprecated: [],
      features: ["basic_entities", "player_state", "world_state"],
    });

    this._versionCompatibility.set("1.1.0", {
      version: "1.1.0",
      engines: ["luanti", "openrts"],
      deprecated: [],
      features: ["basic_entities", "player_state", "world_state", "lighting"],
    });

    this._versionCompatibility.set("1.2.0", {
      version: "1.2.0",
      engines: ["openrts"],
      deprecated: [],
      features: [
        "basic_entities",
        "player_state",
        "world_state",
        "lighting",
        "advanced_materials",
      ],
    });
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Migration options.
 */
export interface MigrationOptions {
  /** Target quality tier */
  quality?: QualityTier;
  /** Preserve unsupported entities */
  preserveUnsupported?: boolean;
  /** Strict version checking */
  strictVersion?: boolean;
  /** Preserve assets if possible */
  preserveAssets?: boolean;
  /** Generate fallback assets */
  generateFallbacks?: boolean;
  /** Custom migration rules */
  customRules?: Record<string, unknown>;
}

/**
 * Migration rule for engine pair.
 */
export interface MigrationRule {
  /** Supported features in this migration */
  supportedFeatures: string[];
  /** Features that will be lost */
  lostFeatures: string[];
  ** Quality impact of migration */
  qualityImpact: QualityImpact;
  /** Is migration reversible */
  reversible: boolean;
}

/**
 * Quality impact levels.
 */
export enum QualityImpact {
  /** No quality loss */
  NONE = "none",
  /** Minor quality loss */
  LOW = "low",
  /** Moderate quality loss */
  MEDIUM = "medium",
  /** Significant quality loss */
  HIGH = "high",
  ** Severe quality loss */
  VERY_HIGH = "very_high",
}

/**
 * Migration pair identifier.
 */
export type MigrationPair =
  | "microverse->luanti"
  | "microverse->openrts"
  | "luanti->microverse"
  | "luanti->openrts"
  | "openrts->microverse"
  | "openrts->luanti";

/**
 * Compatibility check result.
 */
export interface CompatibilityCheck {
  /** Is compatible */
  compatible: boolean;
  /** Reason for incompatibility */
  reason?: string;
  /** Is version deprecated */
  deprecated?: boolean;
}

/**
 * Version compatibility information.
 */
export interface VersionCompatibility {
  /** Version string */
  version: string;
  /** Compatible engines */
  engines: GameEngine[];
  /** Deprecated features */
  deprecated: string[];
  /** New features */
  features: string[];
}

/**
 * Migration record.
 */
export interface MigrationRecord {
  /** Migration timestamp */
  timestamp: number;
  /** Source engine */
  sourceEngine: GameEngine;
  /** Target engine */
  targetEngine: GameEngine;
  /** Source version */
  sourceVersion: string;
  /** Target version */
  targetVersion: string;
  /** Migration duration in milliseconds */
  duration: number;
  /** Migration success */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Migration statistics.
 */
export interface MigrationStats {
  /** Total migrations */
  total: number;
  /** Successful migrations */
  successful: number;
  /** Failed migrations */
  failed: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Stats by migration pair */
  byPair: Record<string, { count: number; success: number; fail: number }>;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Migrate game state to a different engine.
 * @param state - Source game state
 * @param targetEngine - Target engine
 * @param options - Migration options
 * @returns Migration result
 */
export async function migrateState(
  state: UniversalGameState,
  targetEngine: GameEngine,
  options?: MigrationOptions,
): Promise<MigrationResult> {
  const migrator = QualityMigrator.getInstance();
  return migrator.migrate(state, targetEngine, options);
}

/**
 * Batch migrate multiple states.
 * @param states - Array of states with target engines
 * @param options - Migration options
 * @returns Array of migration results
 */
export async function migrateStateBatch(
  states: Array<{ state: UniversalGameState; targetEngine: GameEngine }>,
  options?: MigrationOptions,
): Promise<MigrationResult[]> {
  const migrator = QualityMigrator.getInstance();
  return migrator.migrateBatch(states, options);
}

/**
 * Get migration history.
 * @param limit - Maximum records to return
 * @returns Migration history
 */
export function getMigrationHistory(limit?: number): MigrationRecord[] {
  const migrator = QualityMigrator.getInstance();
  return migrator.getHistory(limit);
}

/**
 * Get migration statistics.
 * @returns Migration statistics
 */
export function getMigrationStats(): MigrationStats {
  const migrator = QualityMigrator.getInstance();
  return migrator.getStats();
}

/**
 * Clear migration history.
 */
export function clearMigrationHistory(): void {
  const migrator = QualityMigrator.getInstance();
  migrator.clearHistory();
}

/**
 * Check if migration is supported.
 * @param sourceEngine - Source engine
 * @param targetEngine - Target engine
 * @returns True if migration is supported
 */
export function isMigrationSupported(
  sourceEngine: GameEngine,
  targetEngine: GameEngine,
): boolean {
  const migrator = QualityMigrator.getInstance();
  const pair: MigrationPair = `${sourceEngine}->${targetEngine}` as MigrationPair;
  return migrator["getMigrationRule"] !== undefined;
}

/**
 * Get quality impact for a migration.
 * @param sourceEngine - Source engine
 * @param targetEngine - Target engine
 * @returns Quality impact level
 */
export function getMigrationQualityImpact(
  sourceEngine: GameEngine,
  targetEngine: GameEngine,
): QualityImpact {
  // Default impact levels
  const impacts: Record<string, QualityImpact> = {
    "microverse->luanti": QualityImpact.LOW,
    "microverse->openrts": QualityImpact.LOW,
    "luanti->microverse": QualityImpact.HIGH,
    "luanti->openrts": QualityImpact.LOW,
    "openrts->microverse": QualityImpact.VERY_HIGH,
    "openrts->luanti": QualityImpact.MEDIUM,
  };

  const pair = `${sourceEngine}->${targetEngine}`;
  return impacts[pair] ?? QualityImpact.MEDIUM;
}

/**
 * Get migration recommendations.
 * @param sourceEngine - Source engine
 * @param targetEngine - Target engine
 * @returns Array of recommendations
 */
export function getMigrationRecommendations(
  sourceEngine: GameEngine,
  targetEngine: GameEngine,
): string[] {
  const recommendations: string[] = [];

  // Check if migration is reversible
  if (!isMigrationReversible(sourceEngine, targetEngine)) {
    recommendations.push(
      "This migration is not fully reversible. Some features may be lost if you migrate back.",
    );
  }

  // Check quality impact
  const impact = getMigrationQualityImpact(sourceEngine, targetEngine);
  if (impact === QualityImpact.HIGH || impact === QualityImpact.VERY_HIGH) {
    recommendations.push(
      "This migration will result in significant quality loss. Consider creating a backup first.",
    );
  }

  // Engine-specific recommendations
  if (targetEngine === "microverse") {
    recommendations.push(
      "3D features will be simplified for 2D rendering.",
      "Some entities may not be supported and will be removed.",
    );
  } else if (targetEngine === "luanti") {
    recommendations.push(
      "Positions will be rounded to voxel grid.",
      "Some visual effects will be simplified.",
    );
  } else if (targetEngine === "openrts") {
    recommendations.push(
      "Full 3D rendering will be enabled.",
      "Advanced graphics features will be available if hardware supports them.",
    );
  }

  return recommendations;
}

/**
 * Check if migration is reversible.
 * @param sourceEngine - Source engine
 * @param targetEngine - Target engine
 * @returns True if migration is reversible
 */
export function isMigrationReversible(
  sourceEngine: GameEngine,
  targetEngine: GameEngine,
): boolean {
  // OpenRTS -> MicroVerse is not fully reversible
  if (sourceEngine === "openrts" && targetEngine === "microverse") {
    return false;
  }
  return true;
}
