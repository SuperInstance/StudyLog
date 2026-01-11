/**
 * Flocking Behavior
 *
 * Implements boids-based herd movement for animals.
 * Includes cohesion, alignment, separation, and goal-seeking behaviors.
 *
 * Based on Craig Reynolds' boids algorithm with terrain-aware modifications.
 *
 * @fileoverview Boids-based flocking for herd animals
 */

import type {
  Animal,
  Position3D,
  Velocity,
  FlockingWeights,
  Herd,
  EngineTier,
  AIComplexityStage,
  Obstacle,
  TerrainInfo,
} from './types.js';
import { SIMULATION_DEFAULTS } from './types.js';

// ============================================================================
// Flocking Configuration
// ============================================================================

interface FlockingConfig {
  /** Perception radius for detecting neighbors */
  perceptionRadius: number;
  /** Maximum steering force */
  maxForce: number;
  /** Maximum speed */
  maxSpeed: number;
  /** Weights for different behaviors */
  weights: FlockingWeights;
  /** Engine tier for quality scaling */
  engineTier: EngineTier;
  /** Whether to use terrain awareness */
  terrainAwareness: boolean;
}

// ============================================================================
// Neighbor Query Results
// ============================================================================

interface NeighborData {
  /** All neighbors within perception radius */
  all: Animal[];
  /** Close neighbors (within personal space) */
  close: Animal[];
  /** Average position of neighbors */
  centerOfMass: Position3D;
  /** Average velocity of neighbors */
  averageVelocity: Velocity;
  /** Count of neighbors */
  count: number;
}

// ============================================================================
// Flocking Behavior Class
// ============================================================================

export class FlockingBehavior {
  private config: FlockingConfig;

  constructor(config: Partial<FlockingConfig> = {}) {
    this.config = {
      perceptionRadius: SIMULATION_DEFAULTS.FLOCKING_RADIUS,
      maxForce: 0.5,
      maxSpeed: 3.0,
      weights: {
        cohesion: SIMULATION_DEFAULTS.COHESION_WEIGHT,
        alignment: SIMULATION_DEFAULTS.ALIGNMENT_WEIGHT,
        separation: SIMULATION_DEFAULTS.SEPARATION_WEIGHT,
        goal: SIMULATION_DEFAULTS.GOAL_WEIGHT,
        avoidance: SIMULATION_DEFAULTS.AVOIDANCE_WEIGHT,
      },
      engineTier: EngineTier.MICROVERSE_2D,
      terrainAwareness: false,
      ...config,
    };
  }

  // ============================================================================
  // Main Flocking Calculation
  // ============================================================================

  /**
   * Calculate flocking acceleration for an animal.
   */
  calculateFlocking(
    animal: Animal,
    herd: Herd,
    allAnimals: Animal[],
    goal?: Position3D,
    threats?: Position3D[],
    obstacles?: Obstacle[]
  ): Velocity {
    const neighborData = this.getNeighborData(animal, allAnimals);

    // Calculate each steering behavior
    const cohesion = this.calculateCohesion(animal, neighborData);
    const alignment = this.calculateAlignment(animal, neighborData);
    const separation = this.calculateSeparation(animal, neighborData);
    const goalSeeking = goal ? this.calculateGoalSeeking(animal, goal) : this.zeroVector();
    const avoidance = threats ? this.calculateThreatAvoidance(animal, threats) : this.zeroVector();
    const obstacleAvoidance = obstacles ? this.calculateObstacleAvoidance(animal, obstacles) : this.zeroVector();

    // Apply weights and sum
    const acceleration = {
      x: cohesion.x * this.config.weights.cohesion +
          alignment.x * this.config.weights.alignment +
          separation.x * this.config.weights.separation +
          goalSeeking.x * this.config.weights.goal +
          avoidance.x * this.config.weights.avoidance +
          obstacleAvoidance.x * this.config.weights.avoidance,
      y: 0,
      z: cohesion.z * this.config.weights.cohesion +
          alignment.z * this.config.weights.alignment +
          separation.z * this.config.weights.separation +
          goalSeeking.z * this.config.weights.goal +
          avoidance.z * this.config.weights.avoidance +
          obstacleAvoidance.z * this.config.weights.avoidance,
    };

    // Limit to maximum force
    return this.limitVector(acceleration, this.config.maxForce);
  }

  /**
   * Get neighbor data for an animal.
   */
  private getNeighborData(animal: Animal, allAnimals: Animal[]): NeighborData {
    const neighbors: Animal[] = [];
    const closeNeighbors: Animal[] = [];
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let velX = 0;
    let velY = 0;
    let velZ = 0;

    const perceptionRadius = this.config.perceptionRadius *
      (animal.species?.stats.detectionRadius / 15) || 1;
    const personalSpace = animal.species?.stats.personalSpace || 1;

    for (const other of allAnimals) {
      if (other.id === animal.id) continue;
      if (other.speciesId !== animal.speciesId) continue;

      const dx = other.position.x - animal.position.x;
      const dy = other.position.y - animal.position.y;
      const dz = (other.position.z || 0) - (animal.position.z || 0);
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < perceptionRadius) {
        neighbors.push(other);
        sumX += other.position.x;
        sumY += other.position.y;
        sumZ += other.position.z || 0;
        velX += other.velocity.x;
        velY += other.velocity.y;
        velZ += other.velocity.z || 0;
      }

      if (distance < personalSpace) {
        closeNeighbors.push(other);
      }
    }

    const count = neighbors.length;

    return {
      all: neighbors,
      close: closeNeighbors,
      centerOfMass: count > 0 ? {
        x: sumX / count,
        y: sumY / count,
        z: sumZ / count,
      } : { ...animal.position },
      averageVelocity: count > 0 ? {
        x: velX / count,
        y: velY / count,
        z: velZ / count,
      } : { ...animal.velocity },
      count,
    };
  }

  // ============================================================================
  // Steering Behaviors
  // ============================================================================

  /**
   * Cohesion: Steer toward the center of mass of neighbors.
   */
  private calculateCohesion(animal: Animal, data: NeighborData): Velocity {
    if (data.count === 0) {
      return this.zeroVector();
    }

    // Vector to center of mass
    let target = {
      x: data.centerOfMass.x - animal.position.x,
      y: data.centerOfMass.y - animal.position.y,
      z: data.centerOfMass.z - (animal.position.z || 0),
    };

    // Normalize and scale to max speed
    target = this.setMagnitude(target, this.config.maxSpeed);

    // Steering = desired - velocity
    const steering = {
      x: target.x - animal.velocity.x,
      y: 0,
      z: (target.z || 0) - (animal.velocity.z || 0),
    };

    return this.limitVector(steering, this.config.maxForce);
  }

  /**
   * Alignment: Steer toward the average heading of neighbors.
   */
  private calculateAlignment(animal: Animal, data: NeighborData): Velocity {
    if (data.count === 0) {
      return this.zeroVector();
    }

    // Use average velocity as target
    let target = {
      x: data.averageVelocity.x,
      y: data.averageVelocity.y,
      z: data.averageVelocity.z || 0,
    };

    // Normalize and scale to max speed
    const magnitude = Math.sqrt(target.x ** 2 + target.y ** 2 + (target.z || 0) ** 2);
    if (magnitude > 0) {
      target = {
        x: (target.x / magnitude) * this.config.maxSpeed,
        y: 0,
        z: ((target.z || 0) / magnitude) * this.config.maxSpeed,
      };
    }

    // Steering = desired - velocity
    const steering = {
      x: target.x - animal.velocity.x,
      y: 0,
      z: (target.z || 0) - (animal.velocity.z || 0),
    };

    return this.limitVector(steering, this.config.maxForce);
  }

  /**
   * Separation: Steer away from nearby neighbors to avoid crowding.
   */
  private calculateSeparation(animal: Animal, data: NeighborData): Velocity {
    if (data.close.length === 0) {
      return this.zeroVector();
    }

    let steerX = 0;
    let steerY = 0;
    let steerZ = 0;

    for (const other of data.close) {
      const dx = animal.position.x - other.position.x;
      const dy = animal.position.y - other.position.y;
      const dz = (animal.position.z || 0) - (other.position.z || 0);
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance > 0 && distance < (animal.species?.stats.personalSpace || 2)) {
        // Weight by distance (closer = stronger repulsion)
        const diff = 1 / distance;
        steerX += (dx / distance) * diff;
        steerY += (dy / distance) * diff;
        steerZ += (dz / distance) * diff;
      }
    }

    // Normalize and scale to max speed
    const steering = {
      x: steerX,
      y: 0,
      z: steerZ,
    };

    const magnitude = Math.sqrt(steering.x ** 2 + steering.z ** 2);
    if (magnitude > 0) {
      return {
        x: (steering.x / magnitude) * this.config.maxSpeed - animal.velocity.x,
        y: 0,
        z: (steering.z / magnitude) * this.config.maxSpeed - (animal.velocity.z || 0),
      };
    }

    return this.limitVector(steering, this.config.maxForce);
  }

  /**
   * Goal Seeking: Steer toward a target position.
   */
  private calculateGoalSeeking(animal: Animal, goal: Position3D): Velocity {
    const dx = goal.x - animal.position.x;
    const dy = goal.y - animal.position.y;
    const dz = (goal.z || 0) - (animal.position.z || 0);
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance < 0.5) {
      return this.zeroVector();
    }

    // Normalize and scale to max speed
    const desired = {
      x: (dx / distance) * this.config.maxSpeed,
      y: 0,
      z: (dz / distance) * this.config.maxSpeed,
    };

    // Steering = desired - velocity
    const steering = {
      x: desired.x - animal.velocity.x,
      y: 0,
      z: desired.z - (animal.velocity.z || 0),
    };

    return this.limitVector(steering, this.config.maxForce);
  }

  /**
   * Threat Avoidance: Steer away from threats.
   */
  private calculateThreatAvoidance(animal: Animal, threats: Position3D[]): Velocity {
    if (threats.length === 0) {
      return this.zeroVector();
    }

    let avoidX = 0;
    let avoidZ = 0;

    for (const threat of threats) {
      const dx = animal.position.x - threat.x;
      const dz = (animal.position.z || 0) - (threat.z || 0);
      const distance = Math.sqrt(dx * dx + dz * dz);

      const fleeRadius = (animal.species?.stats.detectionRadius || 10) *
        (this.config.engineTier === EngineTier.MICROVERSE_2D ? 0.7 : 1.0);

      if (distance < fleeRadius) {
        const strength = (fleeRadius - distance) / fleeRadius;
        avoidX += (dx / distance) * strength * 3;
        avoidZ += (dz / distance) * strength * 3;
      }
    }

    return {
      x: avoidX,
      y: 0,
      z: avoidZ,
    };
  }

  /**
   * Obstacle Avoidance: Steer around obstacles.
   */
  private calculateObstacleAvoidance(animal: Animal, obstacles: Obstacle[]): Velocity {
    if (obstacles.length === 0) {
      return this.zeroVector();
    }

    let avoidX = 0;
    let avoidZ = 0;

    for (const obstacle of obstacles) {
      if (obstacle.passable) continue;

      const centerX = (obstacle.bounds.min.x + obstacle.bounds.max.x) / 2;
      const centerZ = (obstacle.bounds.min.z + obstacle.bounds.max.z) / 2;

      const dx = animal.position.x - centerX;
      const dz = (animal.position.z || 0) - centerZ;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Approximate obstacle radius
      const radiusX = (obstacle.bounds.max.x - obstacle.bounds.min.x) / 2;
      const radiusZ = (obstacle.bounds.max.z - obstacle.bounds.min.z) / 2;
      const obstacleRadius = Math.max(radiusX, radiusZ);

      const avoidRadius = obstacleRadius + (animal.species?.stats.personalSpace || 2) + 1;

      if (distance < avoidRadius) {
        const strength = (avoidRadius - distance) / avoidRadius;
        avoidX += (dx / distance) * strength * 2;
        avoidZ += (dz / distance) * strength * 2;
      }
    }

    return {
      x: avoidX,
      y: 0,
      z: avoidZ,
    };
  }

  // ============================================================================
  // Terrain-Aware Flocking
  // ============================================================================

  /**
   * Apply terrain constraints to flocking behavior.
   */
  applyTerrainConstraints(
    velocity: Velocity,
    terrain: TerrainInfo,
    currentSpeed: number
  ): Velocity {
    if (!this.config.terrainAwareness) {
      return velocity;
    }

    let constrained = { ...velocity };

    // Slow down on steep slopes
    if (terrain.slope > 0.3) {
      const slopeFactor = 1 - (terrain.slope - 0.3) * 2;
      constrained.x *= Math.max(0.2, slopeFactor);
      constrained.z *= Math.max(0.2, slopeFactor);
    }

    // Very slow on unwalkable terrain
    if (!terrain.walkable) {
      constrained.x *= 0.1;
      constrained.z *= 0.1;
    }

    return constrained;
  }

  // ============================================================================
  // Herd Management
  // ============================================================================

  /**
   * Update herd center and velocity based on member positions.
   */
  updateHerdState(herd: Herd, animals: Map<string, Animal>): void {
    if (herd.animals.length === 0) {
      return;
    }

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let velX = 0;
    let velY = 0;
    let velZ = 0;
    let count = 0;

    for (const animalId of herd.animals) {
      const animal = animals.get(animalId);
      if (animal && animal.state !== 'dead') {
        sumX += animal.position.x;
        sumY += animal.position.y;
        sumZ += animal.position.z || 0;
        velX += animal.velocity.x;
        velY += animal.velocity.y;
        velZ += animal.velocity.z || 0;
        count++;
      }
    }

    if (count > 0) {
      herd.center = {
        x: sumX / count,
        y: sumY / count,
        z: sumZ / count,
      };
      herd.velocity = {
        x: velX / count,
        y: velY / count,
        z: velZ / count,
      };
    }

    // Update herd state based on cohesion
    const dispersion = this.calculateHerdDispersion(herd, animals);
    if (dispersion > 10) {
      herd.state = 'scattered';
    } else if (dispersion > 5) {
      herd.state = 'moving';
    } else {
      herd.state = 'grazing';
    }
  }

  /**
   * Calculate how spread out the herd is.
   */
  private calculateHerdDispersion(herd: Herd, animals: Map<string, Animal>): number {
    if (herd.animals.length === 0) return 0;

    let maxDistance = 0;

    for (const animalId of herd.animals) {
      const animal = animals.get(animalId);
      if (!animal) continue;

      const dx = animal.position.x - herd.center.x;
      const dz = (animal.position.z || 0) - herd.center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      maxDistance = Math.max(maxDistance, distance);
    }

    return maxDistance;
  }

  /**
   * Find the best leader for a herd.
   */
  selectHerdLeader(herd: Herd, animals: Map<string, Animal>): string | undefined {
    if (herd.animals.length === 0) return undefined;

    // Select animal closest to center with good health
    let bestLeader: string | undefined;
    let bestScore = -Infinity;

    for (const animalId of herd.animals) {
      const animal = animals.get(animalId);
      if (!animal || animal.state === 'dead') continue;

      const dx = animal.position.x - herd.center.x;
      const dz = (animal.position.z || 0) - herd.center.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Score based on proximity to center, health, and energy
      const score = -distance * 0.5 + animal.health * 0.3 +
        (100 - animal.needs.energy * 100) * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestLeader = animalId;
      }
    }

    return bestLeader;
  }

  // ============================================================================
  // Vector Math Utilities
  // ============================================================================

  private zeroVector(): Velocity {
    return { x: 0, y: 0, z: 0 };
  }

  private limitVector(vector: Velocity, max: number): Velocity {
    const magnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2 + (vector.z || 0) ** 2);
    if (magnitude > max) {
      return {
        x: (vector.x / magnitude) * max,
        y: (vector.y / magnitude) * max,
        z: ((vector.z || 0) / magnitude) * max,
      };
    }
    return vector;
  }

  private setMagnitude(vector: Velocity, magnitude: number): Velocity {
    const currentMag = Math.sqrt(vector.x ** 2 + vector.y ** 2 + (vector.z || 0) ** 2);
    if (currentMag === 0) {
      return { x: magnitude, y: 0, z: 0 };
    }
    return {
      x: (vector.x / currentMag) * magnitude,
      y: (vector.y / currentMag) * magnitude,
      z: ((vector.z || 0) / currentMag) * magnitude,
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update flocking weights.
   */
  setWeights(weights: Partial<FlockingWeights>): void {
    this.config.weights = { ...this.config.weights, ...weights };
  }

  /**
   * Get current weights.
   */
  getWeights(): FlockingWeights {
    return { ...this.config.weights };
  }

  /**
   * Update configuration for engine tier.
   */
  setEngineTier(tier: EngineTier): void {
    this.config.engineTier = tier;

    // Scale perception radius based on tier
    switch (tier) {
      case EngineTier.MICROVERSE_2D:
        this.config.perceptionRadius = SIMULATION_DEFAULTS.FLOCKING_RADIUS * 0.7;
        this.config.terrainAwareness = false;
        break;
      case EngineTier.LUANTI_BLOCKY:
        this.config.perceptionRadius = SIMULATION_DEFAULTS.FLOCKING_RADIUS * 0.9;
        this.config.terrainAwareness = false;
        break;
      case EngineTier.OPENRTS_3D:
        this.config.perceptionRadius = SIMULATION_DEFAULTS.FLOCKING_RADIUS;
        this.config.terrainAwareness = true;
        break;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a flocking behavior instance with default configuration.
 */
export function createFlockingBehavior(config?: Partial<FlockingConfig>): FlockingBehavior {
  return new FlockingBehavior(config);
}

/**
 * Create quality-scaled flocking behavior for an engine tier.
 */
export function createFlockingForTier(tier: EngineTier): FlockingBehavior {
  return new FlockingBehavior({
    engineTier: tier,
    terrainAwareness: tier === EngineTier.OPENRTS_3D,
    perceptionRadius: tier === EngineTier.MICROVERSE_2D
      ? SIMULATION_DEFAULTS.FLOCKING_RADIUS * 0.7
      : tier === EngineTier.LUANTI_BLOCKY
        ? SIMULATION_DEFAULTS.FLOCKING_RADIUS * 0.9
        : SIMULATION_DEFAULTS.FLOCKING_RADIUS,
  });
}

/**
 * Calculate flocking for a herd of animals.
 */
export function updateHerdFlocking(
  herd: Herd,
  animals: Map<string, Animal>,
  goal?: Position3D,
  threats?: Position3D[],
  obstacles?: Obstacle[],
  flocking?: FlockingBehavior
): void {
  const behavior = flocking || createFlockingBehavior();

  for (const animalId of herd.animals) {
    const animal = animals.get(animalId);
    if (!animal || animal.state === 'dead') continue;

    // Calculate flocking acceleration
    const acceleration = behavior.calculateFlocking(
      animal,
      herd,
      Array.from(animals.values()),
      goal,
      threats,
      obstacles
    );

    // Apply acceleration to velocity
    animal.velocity.x += acceleration.x;
    animal.velocity.z += acceleration.z || 0;

    // Limit velocity to max speed
    const maxSpeed = animal.species?.stats.moveSpeed || 2;
    const speed = Math.sqrt(
      animal.velocity.x ** 2 + (animal.velocity.z || 0) ** 2
    );

    if (speed > maxSpeed) {
      animal.velocity.x = (animal.velocity.x / speed) * maxSpeed;
      animal.velocity.z = ((animal.velocity.z || 0) / speed) * maxSpeed;
    }
  }

  // Update herd state
  behavior.updateHerdState(herd, animals);
}
