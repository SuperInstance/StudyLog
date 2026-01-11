/**
 * Quality Scaling for Ranch Simulation
 *
 * Adapts AI complexity and behaviors based on engine tier.
 * Ensures smooth performance across hardware capabilities.
 *
 * @fileoverview Adaptive AI scaling for different quality tiers
 */

import type {
  EngineTier,
  AIComplexityStage,
  QualityScaledAI,
  Animal,
  RanchState,
  Position3D,
  TerrainInfo,
} from './types.js';
import { QUALITY_AI_CONFIGS } from './types.js';

// ============================================================================
// Scaling Configuration
// ============================================================================

interface ScalingConfig {
  /** Current engine tier */
  tier: EngineTier;
  /** Maximum entities per update batch */
  batchSize: number;
  /** AI update interval (ms) */
  updateInterval: number;
  /** Whether to use spatial partitioning */
  useSpatialHash: boolean;
  /** Cell size for spatial hash */
  cellSize: number;
  /** Maximum visible distance */
  maxVisibleDistance: number;
  /** LOD distances */
  lodDistances: {
    low: number;
    medium: number;
    high: number;
  };
}

// ============================================================================
// Spatial Hash for Optimization
// ============================================================================

interface SpatialCell {
  x: number;
  z: number;
  animals: Set<string>;
}

class SpatialHash {
  private cellSize: number;
  private cells: Map<string, SpatialCell> = new Map();
  private animalPositions: Map<string, { x: number; z: number }> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  /**
   * Insert animal into spatial hash.
   */
  insert(animalId: string, position: Position3D): void {
    // Remove from old position
    this.remove(animalId);

    const cell = this.getCell(position.x, position.z);
    cell.animals.add(animalId);
    this.animalPositions.set(animalId, { x: position.x, z: position.z || 0 });
  }

  /**
   * Remove animal from spatial hash.
   */
  remove(animalId: string): void {
    const pos = this.animalPositions.get(animalId);
    if (pos) {
      const cell = this.getCell(pos.x, pos.z);
      cell.animals.delete(animalId);
      this.animalPositions.delete(animalId);
    }
  }

  /**
   * Get or create cell for position.
   */
  private getCell(x: number, z: number): SpatialCell {
    const cellX = Math.floor(x / this.cellSize);
    const cellZ = Math.floor(z / this.cellSize);
    const key = `${cellX},${cellZ}`;

    let cell = this.cells.get(key);
    if (!cell) {
      cell = { x: cellX, z: cellZ, animals: new Set() };
      this.cells.set(key, cell);
    }
    return cell;
  }

  /**
   * Query animals within radius of a position.
   */
  query(position: Position3D, radius: number): Set<string> {
    const result = new Set<string>();

    const minCellX = Math.floor((position.x - radius) / this.cellSize);
    const maxCellX = Math.floor((position.x + radius) / this.cellSize);
    const minCellZ = Math.floor(((position.z || 0) - radius) / this.cellSize);
    const maxCellZ = Math.floor(((position.z || 0) + radius) / this.cellSize);

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.cells.get(`${cx},${cz}`);
        if (cell) {
          for (const animalId of cell.animals) {
            const pos = this.animalPositions.get(animalId);
            if (pos) {
              const dx = pos.x - position.x;
              const dz = pos.z - (position.z || 0);
              const distance = Math.sqrt(dx * dx + dz * dz);
              if (distance <= radius) {
                result.add(animalId);
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Clear all data.
   */
  clear(): void {
    this.cells.clear();
    this.animalPositions.clear();
  }

  /**
   * Get statistics.
   */
  getStats(): { cells: number; entries: number } {
    let entries = 0;
    for (const cell of this.cells.values()) {
      entries += cell.animals.size;
    }
    return { cells: this.cells.size, entries };
  }
}

// ============================================================================
// Quality Scaler Class
// ============================================================================>

export class RanchQualityScaler {
  private config: ScalingConfig;
  private spatialHash: SpatialHash;
  private tierConfig: QualityScaledAI;
  private updateAccumulator = 0;
  private lastUpdateTime = 0;

  constructor(tier: EngineTier = EngineTier.MICROVERSE_2D) {
    this.tierConfig = QUALITY_AI_CONFIGS[tier];

    this.config = {
      tier,
      batchSize: this.tierConfig.batchSize,
      updateInterval: this.tierConfig.updateInterval,
      useSpatialHash: tier !== EngineTier.MICROVERSE_2D,
      cellSize: 10,
      maxVisibleDistance: tier === EngineTier.MICROVERSE_2D ? 20 : 50,
      lodDistances: {
        low: tier === EngineTier.MICROVERSE_2D ? 15 : 30,
        medium: tier === EngineTier.MICROVERSE_2D ? 10 : 20,
        high: tier === EngineTier.MICROVERSE_2D ? 5 : 10,
      },
    };

    this.spatialHash = new SpatialHash(this.config.cellSize);
  }

  // ============================================================================
  // Tier Management
  // ============================================================================

  /**
   * Set engine tier and update configuration.
   */
  setTier(tier: EngineTier): void {
    this.config.tier = tier;
    this.tierConfig = QUALITY_AI_CONFIGS[tier];
    this.config.batchSize = this.tierConfig.batchSize;
    this.config.updateInterval = this.tierConfig.updateInterval;
    this.config.useSpatialHash = tier !== EngineTier.MICROVERSE_2D;

    // Update spatial hash cell size based on tier
    this.config.cellSize = tier === EngineTier.OPENRTS_3D ? 15 : 10;
    this.spatialHash = new SpatialHash(this.config.cellSize);
  }

  /**
   * Get current engine tier.
   */
  getTier(): EngineTier {
    return this.config.tier;
  }

  /**
   * Get current AI configuration.
   */
  getAIConfig(): QualityScaledAI {
    return { ...this.tierConfig };
  }

  // ============================================================================
  // Spatial Partitioning
  // ============================================================================

  /**
   * Build spatial hash from animals.
   */
  buildSpatialHash(animals: Map<string, Animal>): void {
    if (!this.config.useSpatialHash) return;

    this.spatialHash.clear();

    for (const [id, animal] of animals.entries()) {
      this.spatialHash.insert(id, animal.position);
    }
  }

  /**
   * Update animal position in spatial hash.
   */
  updateSpatialPosition(animalId: string, position: Position3D): void {
    if (!this.config.useSpatialHash) return;

    this.spatialHash.insert(animalId, position);
  }

  /**
   * Query nearby animals efficiently.
   */
  queryNearby(
    position: Position3D,
    radius: number,
    animals: Map<string, Animal>
  ): Animal[] {
    if (this.config.useSpatialHash) {
      const nearbyIds = this.spatialHash.query(position, radius);
      return Array.from(nearbyIds)
        .map(id => animals.get(id))
        .filter((a): a is Animal => a !== undefined);
    } else {
      // Brute force for low tier
      return Array.from(animals.values()).filter(animal => {
        const dx = animal.position.x - position.x;
        const dz = (animal.position.z || 0) - (position.z || 0);
        return Math.sqrt(dx * dx + dz * dz) <= radius;
      });
    }
  }

  // ============================================================================
  // Update Scheduling
  // ============================================================================

  /**
   * Check if an animal should be updated this frame.
   */
  shouldUpdate(animal: Animal, currentTime: number, playerPosition?: Position3D): boolean {
    // Time-based update
    const timeSinceUpdate = currentTime - animal.lastUpdate;
    if (timeSinceUpdate < this.config.updateInterval) {
      return false;
    }

    // Distance-based culling for low-priority animals
    if (playerPosition && this.config.tier === EngineTier.MICROVERSE_2D) {
      const dx = animal.position.x - playerPosition.x;
      const dz = (animal.position.z || 0) - (playerPosition.z || 0);
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Skip updates for distant low-priority animals
      if (distance > this.config.maxVisibleDistance && animal.behaviorPriority < 0.5) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get batch of animals to update this frame.
   */
  getUpdateBatch(
    animals: Map<string, Animal>,
    currentTime: number,
    playerPosition?: Position3D
  ): Animal[] {
    const toUpdate: Animal[] = [];

    for (const animal of animals.values()) {
      if (toUpdate.length >= this.config.batchSize) break;

      if (this.shouldUpdate(animal, currentTime, playerPosition)) {
        toUpdate.push(animal);
      }
    }

    return toUpdate;
  }

  // ============================================================================
  // LOD Management
  // ============================================================================

  /**
   * Get LOD level for an animal based on distance.
   */
  getLODLevel(animal: Animal, viewerPosition: Position3D): 'low' | 'medium' | 'high' {
    const dx = animal.position.x - viewerPosition.x;
    const dz = (animal.position.z || 0) - (viewerPosition.z || 0);
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance > this.config.lodDistances.low) return 'low';
    if (distance > this.config.lodDistances.high) return 'medium';
    return 'high';
  }

  /**
   * Scale AI complexity based on LOD.
   */
  scaleAIForLOD(animal: Animal, lod: 'low' | 'medium' | 'high'): Partial<Animal> {
    const updates: Partial<Animal> = {};

    switch (lod) {
      case 'low':
        // Low detail: minimal updates, no memories
        updates.needs = animal.needs;
        updates.state = animal.state;
        // Limit memory
        updates.memories = animal.memories.slice(0, 3);
        break;

      case 'medium':
        // Medium detail: normal updates
        updates.needs = animal.needs;
        updates.state = animal.state;
        updates.memories = animal.memories;
        break;

      case 'high':
        // High detail: full AI
        updates.needs = animal.needs;
        updates.state = animal.state;
        updates.memories = animal.memories;
        break;
    }

    return updates;
  }

  // ============================================================================
  // Terrain Awareness
  // ============================================================================

  /**
   * Check if terrain should affect movement at current tier.
   */
  hasTerrainAwareness(): boolean {
    return this.tierConfig.terrainAwareness;
  }

  /**
   * Get simplified terrain info based on tier.
   */
  getSimplifiedTerrain(position: Position3D, fullTerrain?: TerrainInfo): TerrainInfo {
    if (!this.tierConfig.terrainAwareness || !fullTerrain) {
      // Simple terrain for low tiers
      return {
        height: 0,
        walkable: true,
        terrainType: 'grass',
        slope: 0,
      };
    }

    return fullTerrain;
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  /**
   * Estimate update time for a batch of animals.
   */
  estimateUpdateTime(animalCount: number): number {
    const baseTime = this.config.updateInterval;
    const perAnimalTime = this.config.tier === EngineTier.MICROVERSE_2D ? 0.1 : 0.5;

    return baseTime + (animalCount * perAnimalTime);
  }

  /**
   * Get maximum recommended animals for current tier.
   */
  getMaxRecommendedAnimals(): number {
    switch (this.config.tier) {
      case EngineTier.MICROVERSE_2D:
        return 50;
      case EngineTier.LUANTI_BLOCKY:
        return 100;
      case EngineTier.OPENRTS_3D:
        return 200;
      default:
        return 50;
    }
  }

  /**
   * Check if ranch should downgrade quality tier.
   */
  shouldDowngrade(performance: {
    avgFPS: number;
    avgFrameTime: number;
  }): boolean {
    // downgrade if consistently poor performance
    return performance.avgFPS < 20 && performance.avgFrameTime > 50;
  }

  /**
   * Check if ranch can upgrade quality tier.
   */
  canUpgrade(performance: {
    avgFPS: number;
    avgFrameTime: number;
  }, currentTier: EngineTier): boolean {
    // Can only upgrade if excellent performance
    if (performance.avgFPS < 55) return false;
    if (performance.avgFrameTime > 18) return false;
    if (currentTier === EngineTier.OPENRTS_3D) return false;

    return true;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get current statistics.
   */
  getStats(): {
    tier: EngineTier;
    batchSize: number;
    updateInterval: number;
    spatialHashStats?: { cells: number; entries: number };
    maxVisibleDistance: number;
    maxRecommendedAnimals: number;
  } {
    return {
      tier: this.config.tier,
      batchSize: this.config.batchSize,
      updateInterval: this.config.updateInterval,
      spatialHashStats: this.config.useSpatialHash ? this.spatialHash.getStats() : undefined,
      maxVisibleDistance: this.config.maxVisibleDistance,
      maxRecommendedAnimals: this.getMaxRecommendedAnimals(),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a quality scaler for a given engine tier.
 */
export function createQualityScaler(tier: EngineTier): RanchQualityScaler {
  return new RanchQualityScaler(tier);
}

/**
 * Get recommended AI configuration for a tier.
 */
export function getAIConfigForTier(tier: EngineTier): QualityScaledAI {
  return { ...QUALITY_AI_CONFIGS[tier] };
}

/**
 * Get all available AI configurations.
 */
export function getAllAIConfigs(): Record<EngineTier, QualityScaledAI> {
  return { ...QUALITY_AI_CONFIGS };
}

/**
 * Determine best tier for hardware capability.
 */
export function recommendTierForHardware(hardware: {
  gpuTier: number;
  ramGB: number;
  cpuCores: number;
}): EngineTier {
  // Very low end
  if (hardware.ramGB < 4 || hardware.gpuTier < 1) {
    return EngineTier.MICROVERSE_2D;
  }

  // Low to mid range
  if (hardware.ramGB < 8 || hardware.gpuTier < 2) {
    return EngineTier.LUANTI_BLOCKY;
  }

  // High end
  return EngineTier.OPENRTS_3D;
}

/**
 * Scale update interval based on animal count.
 */
export function scaleUpdateInterval(animalCount: number, baseTier: EngineTier): number {
  const base = QUALITY_AI_CONFIGS[baseTier].updateInterval;

  // Increase interval with more animals
  const multiplier = 1 + Math.max(0, (animalCount - 50) / 100);

  return Math.min(base * multiplier, 200);
}
