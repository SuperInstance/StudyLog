/**
 * Herd Manager
 *
 * Manages groups of animals (herds) including formation, movement,
 * territory, and interactions with dogs.
 *
 * @fileoverview Herd management and organization system
 */

import type {
  Herd,
  Animal,
  Position3D,
  SpeciesCategory,
  Obstacle,
  EngineTier,
  AIComplexityStage,
} from './types.js';
import { getSpecies, getSpeciesByCategory } from './species-registry.js';
import { createFlockingForTier } from './flocking-behavior.js';

// ============================================================================
// Herd Configuration
// ============================================================================

interface HerdManagerConfig {
  /** Maximum distance animals can be from herd center */
  maxHerdRadius: number;
  /** Minimum animals needed to form a herd */
  minHerdSize: number;
  /** Maximum animals in a single herd */
  maxHerdSize: number;
  /** Time before scattered herd is considered lost (ms) */
  scatterTimeout: number;
  /** Territory radius for free-range herds */
  defaultTerritoryRadius: number;
}

// ============================================================================
// Herd Formation Rules
// ============================================================================

interface HerdFormationRule {
  /** Species this rule applies to */
  speciesId?: string;
  /** Category this rule applies to */
  category?: SpeciesCategory;
  /** Preferred herd size */
  preferredSize: number;
  /** Maximum herd size */
  maxSize: number;
  /** Whether this species forms tight groups */
  tightGrouping: boolean;
}

// ============================================================================
// Herd Manager Class
// ============================================================================

export class HerdManager {
  private config: HerdManagerConfig;
  private herds: Map<string, Herd> = new Map();
  private flocking = createFlockingForTier(EngineTier.LUANTI_BLOCKY);

  constructor(config: Partial<HerdManagerConfig> = {}) {
    this.config = {
      maxHerdRadius: 15,
      minHerdSize: 3,
      maxHerdSize: 50,
      scatterTimeout: 30000,
      defaultTerritoryRadius: 30,
      ...config,
    };
  }

  // ============================================================================
  // Herd Creation and Management
  // ============================================================================

  /**
   * Form herds from a collection of animals.
   */
  formHerds(animals: Animal[], ownerId?: string): Herd[] {
    const newHerds: Herd[] = [];
    const unassigned = new Set(animals.map(a => a.id));

    // Group by species and proximity
    const speciesGroups = this.groupBySpecies(animals);

    for (const [speciesId, speciesAnimals] of speciesGroups.entries()) {
      const species = getSpecies(speciesId);
      if (!species || !species.behaviors.isHerding) continue;

      const rule = this.getFormationRule(speciesId, species.category);
      let groupStart = 0;

      while (groupStart < speciesAnimals.length) {
        const groupSize = Math.min(
          rule.preferredSize + Math.floor(Math.random() * 5),
          rule.maxSize,
          speciesAnimals.length - groupStart
        );

        // Find animals close to each other
        const groupAnimals = this.findProximityGroup(
          speciesAnimals.slice(groupStart),
          groupSize,
          rule.tightGrouping ? this.config.maxHerdRadius * 0.5 : this.config.maxHerdRadius
        );

        if (groupAnimals.length >= this.config.minHerdSize) {
          const herd = this.createHerd(groupAnimals, ownerId);
          this.herds.set(herd.id, herd);
          newHerds.push(herd);

          for (const animal of groupAnimals) {
            animal.herdId = herd.id;
            unassigned.delete(animal.id);
          }
        }

        groupStart += groupAnimals.length;
      }
    }

    return newHerds;
  }

  /**
   * Create a new herd from animals.
   */
  private createHerd(animals: Animal[], ownerId?: string): Herd {
    const firstAnimal = animals[0];
    const species = getSpecies(firstAnimal.speciesId);

    // Calculate herd center
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    for (const animal of animals) {
      centerX += animal.position.x;
      centerY += animal.position.y;
      centerZ += animal.position.z || 0;
    }
    centerX /= animals.length;
    centerY /= animals.length;
    centerZ /= animals.length;

    const herd: Herd = {
      id: crypto.randomUUID(),
      name: this.generateHerdName(firstAnimal.speciesId),
      speciesId: firstAnimal.speciesId,
      animals: animals.map(a => a.id),
      center: { x: centerX, y: centerY, z: centerZ },
      velocity: { x: 0, y: 0, z: 0 },
      state: 'grazing',
      cohesion: this.calculateInitialCohesion(animals),
      leaderId: undefined,
      territory: species?.behaviors.isHerding ? {
        center: { x: centerX, y: centerY, z: centerZ },
        radius: this.config.defaultTerritoryRadius,
      } : undefined,
      ownerId,
      createdAt: Date.now(),
    };

    return herd;
  }

  /**
   * Generate a descriptive name for the herd.
   */
  private generateHerdName(speciesId: string): string {
    const species = getSpecies(speciesId);
    const speciesName = species?.name || 'Animal';

    const adjectives = [
      'Peaceful', 'Grazing', 'Wandering', 'Mountain', 'River',
      'Sunrise', 'Meadow', 'Hillside', 'Valley', 'Morning',
    ];
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];

    const plural = speciesName.endsWith('s') ? speciesName : speciesName + 's';
    return `${adjective} ${plural}`;
  }

  /**
   * Group animals by species.
   */
  private groupBySpecies(animals: Animal[]): Map<string, Animal[]> {
    const groups = new Map<string, Animal[]>();

    for (const animal of animals) {
      if (!groups.has(animal.speciesId)) {
        groups.set(animal.speciesId, []);
      }
      groups.get(animal.speciesId)!.push(animal);
    }

    return groups;
  }

  /**
   * Find animals that are close to each other.
   */
  private findProximityGroup(
    candidates: Animal[],
    maxSize: number,
    maxDistance: number
  ): Animal[] {
    if (candidates.length === 0) return [];

    // Start with first animal
    const group = [candidates[0]];
    const remaining = candidates.slice(1);

    // Add animals that are close to any member of the group
    while (group.length < maxSize && remaining.length > 0) {
      let added = false;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        let closeToGroup = false;

        for (const member of group) {
          const dx = candidate.position.x - member.position.x;
          const dz = (candidate.position.z || 0) - (member.position.z || 0);
          const distance = Math.sqrt(dx * dx + dz * dz);

          if (distance < maxDistance) {
            closeToGroup = true;
            break;
          }
        }

        if (closeToGroup) {
          group.push(candidate);
          remaining.splice(i, 1);
          added = true;
          break;
        }
      }

      if (!added) break;
    }

    return group;
  }

  /**
   * Get formation rule for a species.
   */
  private getFormationRule(
    speciesId: string,
    category: SpeciesCategory
  ): HerdFormationRule {
    // Species-specific rules
    const speciesRules: Record<string, Partial<HerdFormationRule>> = {
      chicken: { preferredSize: 5, maxSize: 15, tightGrouping: true },
      goose: { preferredSize: 3, maxSize: 10, tightGrouping: true },
      duck: { preferredSize: 6, maxSize: 20, tightGrouping: true },
      sheep: { preferredSize: 10, maxSize: 50, tightGrouping: false },
      cow: { preferredSize: 8, maxSize: 30, tightGrouping: false },
      cattle: { preferredSize: 12, maxSize: 40, tightGrouping: false },
      goat: { preferredSize: 6, maxSize: 20, tightGrouping: false },
      horse: { preferredSize: 5, maxSize: 15, tightGrouping: false },
    };

    if (speciesRules[speciesId]) {
      return {
        speciesId,
        category,
        ...speciesRules[speciesId]!,
      };
    }

    // Category defaults
    const categoryRules: Record<SpeciesCategory, HerdFormationRule> = {
      herd: { preferredSize: 10, maxSize: 50, tightGrouping: false },
      poultry: { preferredSize: 5, maxSize: 15, tightGrouping: true },
      working_dog: { preferredSize: 1, maxSize: 1, tightGrouping: false },
      equine: { preferredSize: 5, maxSize: 15, tightGrouping: false },
      small: { preferredSize: 3, maxSize: 10, tightGrouping: true },
      pond: { preferredSize: 10, maxSize: 50, tightGrouping: true },
    };

    return {
      speciesId,
      category,
      ...categoryRules[category],
    };
  }

  /**
   * Calculate initial cohesion for a new herd.
   */
  private calculateInitialCohesion(animals: Animal[]): number {
    if (animals.length < 2) return 1;

    let totalDistance = 0;
    let pairs = 0;

    for (let i = 0; i < animals.length; i++) {
      for (let j = i + 1; j < animals.length; j++) {
        const dx = animals[i].position.x - animals[j].position.x;
        const dz = (animals[i].position.z || 0) - (animals[j].position.z || 0);
        totalDistance += Math.sqrt(dx * dx + dz * dz);
        pairs++;
      }
    }

    const avgDistance = pairs > 0 ? totalDistance / pairs : 0;
    return Math.max(0, 1 - avgDistance / this.config.maxHerdRadius);
  }

  // ============================================================================
  // Herd Updates
  // ============================================================================

  /**
   * Update all herds.
   */
  updateHerds(
    animals: Map<string, Animal>,
    deltaMs: number,
    threats?: Position3D[],
    obstacles?: Obstacle[]
  ): void {
    for (const herd of this.herds.values()) {
      this.updateHerd(herd, animals, deltaMs, threats, obstacles);
    }

    // Clean up empty herds
    this.cleanupEmptyHerds();
  }

  /**
   * Update a single herd.
   */
  private updateHerd(
    herd: Herd,
    animals: Map<string, Animal>,
    deltaMs: number,
    threats?: Position3D[],
    obstacles?: Obstacle[]
  ): void {
    // Remove dead or missing animals
    const validMembers = herd.animals.filter(id => {
      const animal = animals.get(id);
      return animal && animal.state !== 'dead';
    });

    if (validMembers.length === 0) {
      return; // Will be cleaned up
    }

    herd.animals = validMembers;

    // Update herd center
    this.updateHerdCenter(herd, animals);

    // Check if herd is scattered
    const dispersion = this.calculateDispersion(herd, animals);
    if (dispersion > this.config.maxHerdRadius * 2) {
      herd.state = 'scattered';
    } else if (threats && threats.length > 0) {
      herd.state = 'fleeing';
    } else {
      herd.state = 'grazing';
    }

    // Update cohesion
    herd.cohesion = Math.max(0, 1 - dispersion / this.config.maxHerdRadius);

    // Update leader if needed
    if (!herd.leaderId || !animals.has(herd.leaderId)) {
      herd.leaderId = this.selectLeader(herd, animals);
    }

    // Apply flocking behavior
    const herdAnimals = herd.animals
      .map(id => animals.get(id))
      .filter((a): a is Animal => a !== undefined);

    if (herdAnimals.length > 0 && herd.state !== 'scattered') {
      this.flocking.updateHerdState(herd, animals);

      // Set grazing/fleeing state for members
      for (const animal of herdAnimals) {
        if (herd.state === 'fleeing') {
          animal.state = 'fleeing' as any;
        } else if (animal.state !== 'fleeing' as any) {
          animal.state = 'following' as any;
        }
      }
    }
  }

  /**
   * Update herd center position.
   */
  private updateHerdCenter(herd: Herd, animals: Map<string, Animal>): void {
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let count = 0;

    for (const animalId of herd.animals) {
      const animal = animals.get(animalId);
      if (animal) {
        sumX += animal.position.x;
        sumY += animal.position.y;
        sumZ += animal.position.z || 0;
        count++;
      }
    }

    if (count > 0) {
      herd.center = {
        x: sumX / count,
        y: sumY / count,
        z: sumZ / count,
      };
    }
  }

  /**
   * Calculate herd dispersion (average distance from center).
   */
  private calculateDispersion(herd: Herd, animals: Map<string, Animal>): number {
    let totalDistance = 0;
    let count = 0;

    for (const animalId of herd.animals) {
      const animal = animals.get(animalId);
      if (animal) {
        const dx = animal.position.x - herd.center.x;
        const dz = (animal.position.z || 0) - herd.center.z;
        totalDistance += Math.sqrt(dx * dx + dz * dz);
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  /**
   * Select a leader for the herd.
   */
  private selectLeader(herd: Herd, animals: Map<string, Animal>): string | undefined {
    let bestLeader: string | undefined;
    let bestScore = -Infinity;

    for (const animalId of herd.animals) {
      const animal = animals.get(animalId);
      if (!animal) continue;

      // Score based on health, energy, and position
      const dx = animal.position.x - herd.center.x;
      const dz = (animal.position.z || 0) - herd.center.z;
      const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);

      const score = animal.health * 0.4 +
        (100 - animal.needs.energy * 100) * 0.3 +
        (this.config.maxHerdRadius - distanceFromCenter) * 2;

      if (score > bestScore) {
        bestScore = score;
        bestLeader = animalId;
      }
    }

    return bestLeader;
  }

  // ============================================================================
  // Herd Queries
  // ============================================================================

  /**
   * Get herd by ID.
   */
  getHerd(herdId: string): Herd | undefined {
    return this.herds.get(herdId);
  }

  /**
   * Get all herds.
   */
  getAllHerds(): Herd[] {
    return Array.from(this.herds.values());
  }

  /**
   * Get herds by species.
   */
  getHerdsBySpecies(speciesId: string): Herd[] {
    return this.getAllHerds().filter(h => h.speciesId === speciesId);
  }

  /**
   * Get herd containing an animal.
   */
  getHerdForAnimal(animalId: string): Herd | undefined {
    for (const herd of this.herds.values()) {
      if (herd.animals.includes(animalId)) {
        return herd;
      }
    }
    return undefined;
  }

  /**
   * Get herds by owner.
   */
  getHerdsByOwner(ownerId: string): Herd[] {
    return this.getAllHerds().filter(h => h.ownerId === ownerId);
  }

  // ============================================================================
  // Herd Operations
  // ============================================================================

  /**
   * Add animal to a herd.
   */
  addToHerd(herdId: string, animal: Animal): boolean {
    const herd = this.herds.get(herdId);
    if (!herd) return false;

    if (herd.speciesId !== animal.speciesId) {
      return false; // Different species
    }

    if (herd.animals.length >= this.config.maxHerdSize) {
      return false; // Herd full
    }

    herd.animals.push(animal.id);
    animal.herdId = herdId;
    return true;
  }

  /**
   * Remove animal from its herd.
   */
  removeFromHerd(animal: Animal): Herd | undefined {
    const herd = this.getHerdForAnimal(animal.id);
    if (!herd) return undefined;

    const index = herd.animals.indexOf(animal.id);
    if (index >= 0) {
      herd.animals.splice(index, 1);
    }

    animal.herdId = undefined;
    return herd;
  }

  /**
   * Merge two herds of the same species.
   */
  mergeHerds(herdId1: string, herdId2: string): Herd | null {
    const herd1 = this.herds.get(herdId1);
    const herd2 = this.herds.get(herdId2);

    if (!herd1 || !herd2) return null;
    if (herd1.speciesId !== herd2.speciesId) return null;
    if (herd1.animals.length + herd2.animals.length > this.config.maxHerdSize) {
      return null; // Would exceed max size
    }

    // Merge animals into herd1
    for (const animalId of herd2.animals) {
      if (!herd1.animals.includes(animalId)) {
        herd1.animals.push(animalId);
      }
    }

    // Remove herd2
    this.herds.delete(herdId2);

    // Update herd1 name if needed
    if (herd1.animals.length > 15) {
      herd1.name = herd1.name.replace('Peaceful', 'Large');
    }

    return herd1;
  }

  /**
   * Split a herd into two smaller herds.
   */
  splitHerd(herdId: string): Herd[] | null {
    const herd = this.herds.get(herdId);
    if (!herd) return null;
    if (herd.animals.length < this.config.minHerdSize * 2) return null;

    // Split roughly in half
    const half = Math.floor(herd.animals.length / 2);
    const group1 = herd.animals.slice(0, half);
    const group2 = herd.animals.slice(half);

    // Update original herd
    herd.animals = group1;

    // Create new herd
    const newHerd: Herd = {
      id: crypto.randomUUID(),
      name: herd.name + ' (B)',
      speciesId: herd.speciesId,
      animals: group2,
      center: { ...herd.center },
      velocity: { ...herd.velocity },
      state: herd.state,
      cohesion: herd.cohesion,
      territory: herd.territory ? { ...herd.territory } : undefined,
      ownerId: herd.ownerId,
      createdAt: Date.now(),
    };

    this.herds.set(newHerd.id, newHerd);

    return [herd, newHerd];
  }

  /**
   * Move herd toward a target position.
   */
  moveHerd(herdId: string, target: Position3D): boolean {
    const herd = this.herds.get(herdId);
    if (!herd) return false;

    // Update territory if herd has one
    if (herd.territory) {
      herd.territory.center = { ...target };
    }

    herd.state = 'moving';
    return true;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Remove empty herds.
   */
  private cleanupEmptyHerds(): void {
    for (const [id, herd] of this.herds.entries()) {
      if (herd.animals.length === 0) {
        this.herds.delete(id);
      }
    }
  }

  /**
   * Clear all herds.
   */
  clearAll(): void {
    this.herds.clear();
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update engine tier (affects flocking behavior).
   */
  setEngineTier(tier: EngineTier): void {
    this.flocking = createFlockingForTier(tier);
  }

  /**
   * Get herd statistics.
   */
  getStats(): {
    totalHerds: number;
    totalAnimals: number;
    speciesBreakdown: Record<string, number>;
  } {
    const stats = {
      totalHerds: this.herds.size,
      totalAnimals: 0,
      speciesBreakdown: {} as Record<string, number>,
    };

    for (const herd of this.herds.values()) {
      stats.totalAnimals += herd.animals.length;
      stats.speciesBreakdown[herd.speciesId] =
        (stats.speciesBreakdown[herd.speciesId] || 0) + herd.animals.length;
    }

    return stats;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a herd manager with default configuration.
 */
export function createHerdManager(
  config?: Partial<HerdManagerConfig>
): HerdManager {
  return new HerdManager(config);
}

/**
 * Create a herd manager configured for a specific engine tier.
 */
export function createHerdManagerForTier(
  tier: EngineTier,
  config?: Partial<HerdManagerConfig>
): HerdManager {
  const manager = new HerdManager(config);
  manager.setEngineTier(tier);
  return manager;
}
