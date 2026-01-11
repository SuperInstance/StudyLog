/**
 * Fish AI - Behavior Simulation
 *
 * Implements fish behavior including:
 * - Flocking (Boids algorithm)
 * - Feeding patterns
 * - Spawning cycles
 * - Fleeing behavior
 * - Bite detection
 */

import {
  Fish,
  FishBehavior,
  FishSchool,
  SchoolBehavior,
  Vector2,
  Vector3,
  BoidParams,
  FishSpecies,
  DepthZone,
  ActivityPattern,
  Season,
  Lure
} from './types';
import { fishRegistry } from './fish-registry';

// ============================================================================
// BOIDS IMPLEMENTATION
// ============================================================================

/**
 * Default boid parameters
 */
export const DEFAULT_BOID_PARAMS: BoidParams = {
  separation: 3,
  alignment: 1,
  cohesion: 1,
  perception: 15,
  maxSpeed: 5,
  maxForce: 0.2
};

/**
 * Boid flocking simulation for fish schooling behavior
 */
export class BoidFlocking {
  private params: BoidParams;

  constructor(params: Partial<BoidParams> = {}) {
    this.params = { ...DEFAULT_BOID_PARAMS, ...params };
  }

  /**
   * Calculate flocking forces for a fish within its school
   */
  calculateForces(
    fish: Fish,
    school: FishSchool,
    allFish: Map<string, Fish>
  ): Vector3 {
    const neighbors = this.getNeighbors(fish, school, allFish);
    if (neighbors.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Calculate the three core boid forces
    const separation = this.separation(fish, neighbors);
    const alignment = this.alignment(fish, neighbors);
    const cohesion = this.cohesion(fish, neighbors);

    // Apply weights
    return {
      x: separation.x * this.params.separation +
          alignment.x * this.params.alignment +
          cohesion.x * this.params.cohesion,
      y: separation.y * this.params.separation +
          alignment.y * this.params.alignment +
          cohesion.y * this.params.cohesion,
      z: separation.z * this.params.separation +
          alignment.z * this.params.alignment +
          cohesion.z * this.params.cohesion
    };
  }

  /**
   * Get neighboring fish within perception radius
   */
  private getNeighbors(
    fish: Fish,
    school: FishSchool,
    allFish: Map<string, Fish>
  ): Fish[] {
    const neighbors: Fish[] = [];

    for (const memberId of school.members) {
      if (memberId === fish.id) continue;

      const other = allFish.get(memberId);
      if (!other) continue;

      const dist = this.distance(fish.position3D, other.position3D);
      if (dist < this.params.perception) {
        neighbors.push(other);
      }
    }

    return neighbors;
  }

  /**
   * Separation - avoid crowding neighbors
   */
  private separation(fish: Fish, neighbors: Fish[]): Vector3 {
    let steer = { x: 0, y: 0, z: 0 };
    let count = 0;

    for (const other of neighbors) {
      const dist = this.distance(fish.position3D, other.position3D);
      if (dist > 0 && dist < this.params.separation) {
        // Vector pointing away from neighbor
        const diff = {
          x: fish.position3D.x - other.position3D.x,
          y: fish.position3D.y - other.position3D.y,
          z: fish.position3D.z - other.position3D.z
        };

        // Weight by distance (closer = stronger repulsion)
        const weight = 1 / dist;
        steer.x += diff.x * weight;
        steer.y += diff.y * weight;
        steer.z += diff.z * weight;
        count++;
      }
    }

    if (count > 0) {
      steer.x /= count;
      steer.y /= count;
      steer.z /= count;

      // Normalize to max speed
      const mag = Math.sqrt(steer.x ** 2 + steer.y ** 2 + steer.z ** 2);
      if (mag > 0) {
        steer.x = (steer.x / mag) * this.params.maxSpeed;
        steer.y = (steer.y / mag) * this.params.maxSpeed;
        steer.z = (steer.z / mag) * this.params.maxSpeed;

        // Steer = desired - velocity
        steer.x -= fish.velocity.x;
        steer.y -= fish.velocity.y;
        steer.z -= fish.velocity.z;

        // Limit to max force
        const steerMag = Math.sqrt(steer.x ** 2 + steer.y ** 2 + steer.z ** 2);
        if (steerMag > this.params.maxForce) {
          steer.x = (steer.x / steerMag) * this.params.maxForce;
          steer.y = (steer.y / steerMag) * this.params.maxForce;
          steer.z = (steer.z / steerMag) * this.params.maxForce;
        }
      }
    }

    return steer;
  }

  /**
   * Alignment - steer towards average heading of neighbors
   */
  private alignment(fish: Fish, neighbors: Fish[]): Vector3 {
    let sum = { x: 0, y: 0, z: 0 };
    let count = 0;

    for (const other of neighbors) {
      sum.x += other.velocity.x;
      sum.y += other.velocity.y;
      sum.z += other.velocity.z;
      count++;
    }

    if (count > 0) {
      sum.x /= count;
      sum.y /= count;
      sum.z /= count;

      // Normalize to max speed
      const mag = Math.sqrt(sum.x ** 2 + sum.y ** 2 + sum.z ** 2);
      if (mag > 0) {
        sum.x = (sum.x / mag) * this.params.maxSpeed;
        sum.y = (sum.y / mag) * this.params.maxSpeed;
        sum.z = (sum.z / mag) * this.params.maxSpeed;

        // Steer = desired - velocity
        sum.x -= fish.velocity.x;
        sum.y -= fish.velocity.y;
        sum.z -= fish.velocity.z;

        // Limit to max force
        const steerMag = Math.sqrt(sum.x ** 2 + sum.y ** 2 + sum.z ** 2);
        if (steerMag > this.params.maxForce) {
          sum.x = (sum.x / steerMag) * this.params.maxForce;
          sum.y = (sum.y / steerMag) * this.params.maxForce;
          sum.z = (sum.z / steerMag) * this.params.maxForce;
        }
      }

      return sum;
    }

    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Cohesion - steer toward average position of neighbors
   */
  private cohesion(fish: Fish, neighbors: Fish[]): Vector3 {
    let sum = { x: 0, y: 0, z: 0 };
    let count = 0;

    for (const other of neighbors) {
      sum.x += other.position3D.x;
      sum.y += other.position3D.y;
      sum.z += other.position3D.z;
      count++;
    }

    if (count > 0) {
      sum.x /= count;
      sum.y /= count;
      sum.z /= count;

      // Vector toward center
      return this.seek(fish, sum);
    }

    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Seek behavior - steer toward target
   */
  private seek(fish: Fish, target: Vector3): Vector3 {
    // Desired velocity toward target
    const desired = {
      x: target.x - fish.position3D.x,
      y: target.y - fish.position3D.y,
      z: target.z - fish.position3D.z
    };

    // Normalize to max speed
    const mag = Math.sqrt(desired.x ** 2 + desired.y ** 2 + desired.z ** 2);
    if (mag > 0) {
      desired.x = (desired.x / mag) * this.params.maxSpeed;
      desired.y = (desired.y / mag) * this.params.maxSpeed;
      desired.z = (desired.z / mag) * this.params.maxSpeed;

      // Steer = desired - velocity
      const steer = {
        x: desired.x - fish.velocity.x,
        y: desired.y - fish.velocity.y,
        z: desired.z - fish.velocity.z
      };

      // Limit to max force
      const steerMag = Math.sqrt(steer.x ** 2 + steer.y ** 2 + steer.z ** 2);
      if (steerMag > this.params.maxForce) {
        steer.x = (steer.x / steerMag) * this.params.maxForce;
        steer.y = (steer.y / steerMag) * this.params.maxForce;
        steer.z = (steer.z / steerMag) * this.params.maxForce;
      }

      return steer;
    }

    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Calculate distance between two vectors
   */
  private distance(a: Vector3, b: Vector3): number {
    return Math.sqrt(
      (a.x - b.x) ** 2 +
      (a.y - b.y) ** 2 +
      (a.z - b.z) ** 2
    );
  }
}

// ============================================================================
// FISH BEHAVIOR STATE MACHINE
// ============================================================================

/**
 * Manages individual fish behavior states
 */
export class FishBehaviorStateMachine {
  private state: FishBehavior = FishBehavior.IDLE;
  private stateTimer: number = 0;
  private stateDuration: number = 0;

  /**
   * Update fish behavior based on conditions
   */
  update(
    fish: Fish,
    species: FishSpecies,
    conditions: BehaviorConditions
  ): BehaviorUpdate {
    this.stateTimer += conditions.deltaTime;

    // Check for state transitions
    this.checkTransitions(fish, species, conditions);

    // Execute current state behavior
    return this.executeState(fish, species, conditions);
  }

  /**
   * Check for state transitions
   */
  private checkTransitions(
    fish: Fish,
    species: FishSpecies,
    conditions: BehaviorConditions
  ): void {
    // Priority: FLEEING > HOOKED > SPAWNING > FEEDING > SCHOOLING > RESTING > IDLE > CRUISING

    // Hooked is highest priority (external)
    if (fish.behavior === FishBehavior.HOOKED) {
      return;
    }

    // Check for threats (fleeing)
    if (conditions.hasThreat && this.state !== FishBehavior.FLEEING) {
      this.transitionTo(FishBehavior.FLEEING, 3);
      return;
    }

    // Check if done fleeing
    if (this.state === FishBehavior.FLEEING && this.stateTimer >= this.stateDuration) {
      this.transitionTo(FishBehavior.IDLE, 2);
      return;
    }

    // Check spawning conditions
    if (conditions.isSpawnSeason && conditions.isNearSpawnSite && this.state !== FishBehavior.SPAWNING) {
      this.transitionTo(FishBehavior.SPAWNING, 10);
      return;
    }

    // Check feeding conditions
    if (this.shouldFeed(fish, species, conditions)) {
      if (this.state !== FishBehavior.FEEDING) {
        this.transitionTo(FishBehavior.FEEDING, 5);
      }
      return;
    }

    // Check for school behavior
    if (fish.schoolId && conditions.schoolBehavior === SchoolBehavior.FEEDING) {
      if (this.state !== FishBehavior.SCHOOLING) {
        this.transitionTo(FishBehavior.SCHOOLING, 8);
      }
      return;
    }

    // Check rest (night or low activity)
    if (conditions.activityLevel < 0.3 && this.state !== FishBehavior.RESTING) {
      this.transitionTo(FishBehavior.RESTING, 5);
      return;
    }

    // State timeout behaviors
    if (this.stateTimer >= this.stateDuration) {
      switch (this.state) {
        case FishBehavior.IDLE:
          this.transitionTo(FishBehavior.CRUISING, 10);
          break;
        case FishBehavior.CRUISING:
          if (Math.random() > 0.5) {
            this.transitionTo(FishBehavior.IDLE, 5);
          } else {
            this.stateDuration += 5; // Continue cruising
          }
          break;
        case FishBehavior.FEEDING:
        case FishBehavior.SPAWNING:
        case FishBehavior.SCHOOLING:
          this.transitionTo(FishBehavior.CRUISING, 8);
          break;
        case FishBehavior.RESTING:
          if (conditions.activityLevel > 0.4) {
            this.transitionTo(FishBehavior.CRUISING, 5);
          } else {
            this.stateDuration += 5; // Keep resting
          }
          break;
      }
    }
  }

  /**
   * Determine if fish should be feeding
   */
  private shouldFeed(
    fish: Fish,
    species: FishSpecies,
    conditions: BehaviorConditions
  ): boolean {
    // Time of day check
    const isActivityTime = this.matchesActivityPattern(
      species.activityPattern,
      conditions.timeOfDay
    );

    // Temperature check
    const tempOk = conditions.waterTemperature >= species.preferredTemp.min &&
                   conditions.waterTemperature <= species.preferredTemp.max;

    // Hunger check
    const isHungry = fish.hungerLevel > 0.3;

    // Not spawning or fleeing
    const canFeed = this.state !== FishBehavior.SPAWNING &&
                    this.state !== FishBehavior.FLEEING &&
                    this.state !== FishBehavior.HOOKED;

    return isActivityTime && tempOk && isHungry && canFeed;
  }

  /**
   * Check if current time matches species activity pattern
   */
  private matchesActivityPattern(
    pattern: ActivityPattern,
    hour: number
  ): boolean {
    switch (pattern) {
      case ActivityPattern.DAWN:
        return hour >= 5 && hour <= 7;
      case ActivityPattern.DAY:
        return hour >= 9 && hour <= 16;
      case ActivityPattern.DUSK:
        return hour >= 18 && hour <= 20;
      case ActivityPattern.NIGHT:
        return hour >= 21 || hour <= 4;
      case ActivityPattern.ALL_DAY:
        return true;
      case ActivityPattern.TWILIGHT:
        return (hour >= 5 && hour <= 7) || (hour >= 18 && hour <= 20);
    }
  }

  /**
   * Transition to new behavior state
   */
  private transitionTo(state: FishBehavior, duration: number): void {
    this.state = state;
    this.stateTimer = 0;
    this.stateDuration = duration + Math.random() * 3;
  }

  /**
   * Execute current state behavior
   */
  private executeState(
    fish: Fish,
    species: FishSpecies,
    conditions: BehaviorConditions
  ): BehaviorUpdate {
    const update: BehaviorUpdate = {
      behavior: this.state,
      velocity: { ...fish.velocity },
      activityLevel: conditions.activityLevel
    };

    switch (this.state) {
      case FishBehavior.IDLE:
        update.velocity = this.calculateIdleVelocity(fish);
        break;

      case FishBehavior.CRUISING:
        update.velocity = this.calculateCruisingVelocity(fish, species);
        break;

      case FishBehavior.FEEDING:
        update.velocity = this.calculateFeedingVelocity(fish, conditions);
        update.activityLevel = 0.8;
        break;

      case FishBehavior.FLEEING:
        update.velocity = this.calculateFleeingVelocity(fish, conditions.threatPosition!);
        update.activityLevel = 1.0;
        break;

      case FishBehavior.SCHOOLING:
        // Schooling velocity calculated by boid system
        update.activityLevel = 0.6;
        break;

      case FishBehavior.RESTING:
        update.velocity = { x: 0, y: 0, z: 0 };
        update.activityLevel = 0.1;
        break;

      case FishBehavior.SPAWNING:
        update.velocity = this.calculateSpawningVelocity(fish, conditions);
        update.activityLevel = 0.7;
        break;

      case FishBehavior.INVESTIGATING:
        update.velocity = this.calculateInvestigatingVelocity(fish, conditions.lurePosition!);
        update.activityLevel = 0.9;
        break;
    }

    return update;
  }

  /**
   * Idle - minimal movement
   */
  private calculateIdleVelocity(fish: Fish): Vector3 {
    return {
      x: (Math.random() - 0.5) * 0.5,
      y: (Math.random() - 0.5) * 0.2,
      z: (Math.random() - 0.5) * 0.5
    };
  }

  /**
   * Cruising - steady movement
   */
  private calculateCruisingVelocity(fish: Fish, species: FishSpecies): Vector3 {
    const speed = species.baseFightStrength * 2;

    // Add some randomness to current velocity
    return {
      x: fish.velocity.x * 0.9 + (Math.random() - 0.5) * 0.5,
      y: fish.velocity.y * 0.9 + (Math.random() - 0.5) * 0.2,
      z: fish.velocity.z * 0.9 + (Math.random() - 0.5) * 0.5
    };
  }

  /**
   * Feeding - erratic, searching for food
   */
  private calculateFeedingVelocity(fish: Fish, conditions: BehaviorConditions): Vector3 {
    if (conditions.hasLure) {
      // Move toward lure if present
      return this.seek(fish.position3D, conditions.lurePosition!, 2);
    }

    // Erratic searching pattern
    return {
      x: (Math.random() - 0.5) * 3,
      y: (Math.random() - 0.5) * 0.5,
      z: (Math.random() - 0.5) * 3
    };
  }

  /**
   * Fleeing - rapid movement away from threat
   */
  private calculateFleeingVelocity(fish: Fish, threat: Vector3): Vector3 {
    return this.flee(fish.position3D, threat, 5);
  }

  /**
   * Spawning - movement toward shallow areas
   */
  private calculateSpawningVelocity(fish: Fish, conditions: BehaviorConditions): Vector3 {
    // Move toward spawn site (usually shallow)
    return {
      x: (Math.random() - 0.5) * 1.5,
      y: -0.3, // Move toward surface
      z: (Math.random() - 0.5) * 1.5
    };
  }

  /**
   * Investigating - slow approach to lure
   */
  private calculateInvestigatingVelocity(fish: Fish, lure: Vector3): Vector3 {
    return this.seek(fish.position3D, lure, 1);
  }

  /**
   * Seek behavior - move toward target
   */
  private seek(from: Vector3, to: Vector3, speed: number): Vector3 {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > 0) {
      return {
        x: (dx / dist) * speed,
        y: (dy / dist) * speed,
        z: (dz / dist) * speed
      };
    }

    return { x: 0, y: 0, z: 0 };
  }

  /**
   * Flee behavior - move away from threat
   */
  private flee(from: Vector3, threat: Vector3, speed: number): Vector3 {
    const dx = from.x - threat.x;
    const dy = from.y - threat.y;
    const dz = from.z - threat.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > 0) {
      return {
        x: (dx / dist) * speed,
        y: (dy / dist) * speed,
        z: (dz / dist) * speed
      };
    }

    return { x: 0, y: 0, z: 0 };
  }
}

// ============================================================================
// BITE DETECTION SYSTEM
// ============================================================================

/**
 * Conditions for behavior evaluation
 */
export interface BehaviorConditions {
  deltaTime: number;
  timeOfDay: number; // 0-24
  waterTemperature: number;
  weatherConditions: number; // 0-1, severity
  hasThreat: boolean;
  threatPosition?: Vector3;
  hasLure: boolean;
  lurePosition?: Vector3;
  lureType?: string;
  isNearSpawnSite: boolean;
  isSpawnSeason: boolean;
  activityLevel: number; // 0-1
  schoolBehavior: SchoolBehavior;
  waterClarity: number; // 0-1
}

/**
 * Result of behavior update
 */
export interface BehaviorUpdate {
  behavior: FishBehavior;
  velocity: Vector3;
  activityLevel: number;
}

/**
 * Bite detection result
 */
export interface BiteDetection {
  willBite: boolean;
  confidence: number;
  biteType: string;
  window: number; // seconds to react
}

/**
 * Detects and evaluates fish bites on lures
 */
export class BiteDetectionSystem {
  /**
   * Check if fish will bite given lure
   */
  evaluateBite(
    fish: Fish,
    species: FishSpecies,
    lure: Lure,
    conditions: BehaviorConditions
  ): BiteDetection {
    // Base probability from species
    let biteChance = species.baseBiteChance;

    // Modify by lure effectiveness
    const lureEffectiveness = this.getLureEffectiveness(species, lure);
    biteChance *= lureEffectiveness;

    // Modify by fish state
    if (fish.behavior === FishBehavior.FEEDING) {
      biteChance *= 2;
    } else if (fish.behavior === FishBehavior.INVESTIGATING) {
      biteChance *= 1.5;
    } else if (fish.behavior === FishBehavior.FLEEING || fish.behavior === FishBehavior.RESTING) {
      biteChance *= 0.1;
    }

    // Modify by activity level
    biteChance *= (0.5 + fish.activityLevel * 0.5);

    // Modify by hunger
    biteChance *= (0.3 + fish.hungerLevel * 0.7);

    // Modify by conditions
    biteChance *= this.getConditionModifier(species, conditions);

    // Modify by distance to lure
    const dist = conditions.lurePosition ?
      this.distance(fish.position3D, conditions.lurePosition) : 100;
    if (dist > 10) {
      biteChance *= 0.5;
    } else if (dist > 20) {
      biteChance *= 0.1;
    }

    // Water clarity affects lure visibility
    biteChance *= (0.5 + conditions.waterClarity * 0.5);

    // Roll for bite
    const willBite = Math.random() < biteChance;

    return {
      willBite,
      confidence: willBite ? biteChance * 10 : 0,
      biteType: this.getBiteType(species, lure, biteChance),
      window: species.biteWindow * (0.8 + Math.random() * 0.4)
    };
  }

  /**
   * Get lure effectiveness for species
   */
  private getLureEffectiveness(species: FishSpecies, lure: Lure): number {
    // Check if lure type is in preferred list
    const isPreferred = species.preferredLures.some(pref =>
      lure.category.toLowerCase().includes(pref.toLowerCase())
    );

    if (isPreferred) {
      return 1.5;
    }

    // Check species-specific effectiveness map
    const specific = species.effectiveness[lure.id];
    if (specific) {
      return specific;
    }

    // Base effectiveness by lure characteristics
    let effectiveness = 0.5;

    // Size matching
    if (lure.length >= 2 && lure.length <= 6) {
      effectiveness *= 1.2;
    }

    // Vibration and flash
    effectiveness *= (0.8 + lure.vibration * 0.2);
    effectiveness *= (0.8 + lure.flash * 0.2);

    return effectiveness;
  }

  /**
   * Get condition modifier
   */
  private getConditionModifier(species: FishSpecies, conditions: BehaviorConditions): number {
    let modifier = 1.0;

    // Temperature match
    const tempDiff = Math.abs(
      conditions.waterTemperature -
      (species.preferredTemp.min + species.preferredTemp.max) / 2
    );
    const tempRange = species.preferredTemp.max - species.preferredTemp.min;
    modifier *= Math.max(0.3, 1 - (tempDiff / tempRange));

    // Activity level
    modifier *= (0.5 + conditions.activityLevel * 0.5);

    // Weather
    if (conditions.weatherConditions > 0.7) {
      // Stormy weather reduces activity for most species
      modifier *= 0.7;
    }

    // Light level (time of day)
    const hour = conditions.timeOfDay;
    if (species.activityPattern === ActivityPattern.DAWN ||
        species.activityPattern === ActivityPattern.DUSK ||
        species.activityPattern === ActivityPattern.NIGHT) {
      // Bonus during preferred times
      modifier *= 1.2;
    }

    return Math.max(0.1, modifier);
  }

  /**
   * Determine bite type based on species and lure
   */
  private getBiteType(species: FishSpecies, lure: Lure, probability: number): string {
    if (probability > 0.3) {
      return 'SLAM'; // Aggressive hit
    } else if (species.category === 'catfish') {
      return 'SUCKER'; // Steady pull
    } else if (species.category === 'salmonid') {
      return 'RING'; // Trout indicator
    } else if (lure.category === 'jig' || lure.category === 'soft_plastic') {
      return 'TAP'; // Light tap
    } else {
      return 'THUMP'; // Solid hit
    }
  }

  /**
   * Calculate distance between vectors
   */
  private distance(a: Vector3, b: Vector3): number {
    return Math.sqrt(
      (a.x - b.x) ** 2 +
      (a.y - b.y) ** 2 +
      (a.z - b.z) ** 2
    );
  }
}

// ============================================================================
// FISH SPAWNING SYSTEM
// ============================================================================

/**
 * Manages fish spawning and lifecycle
 */
export class FishSpawningSystem {
  /**
   * Spawn a new fish
   */
  spawnFish(
    speciesId: string,
    position: Vector3,
    schoolId?: string
  ): Fish | null {
    const species = fishRegistry.getSpecies(speciesId);
    if (!species) return null;

    const length = species.minLength + Math.random() * (species.maxLength - species.minLength);
    const weight = species.minWeight + Math.random() * (species.maxWeight - species.minWeight);
    const age = Math.floor(Math.random() * species.maxAge);

    return {
      id: this.generateId(),
      species: speciesId,
      category: species.category,
      rarity: species.rarity,

      length,
      weight,
      age,

      position2D: { x: position.x, y: position.z },
      position3D: { ...position },
      velocity: { x: 0, y: 0, z: 0 },

      behavior: FishBehavior.CRUISING,
      activityLevel: 0.5,
      hungerLevel: 0.5 + Math.random() * 0.5,
      stressLevel: 0,

      schoolId: schoolId || null,
      isLeader: !schoolId,
      biteProbability: species.baseBiteChance,
      fightStrength: species.baseFightStrength * (0.8 + Math.random() * 0.4),

      spawnedAt: Date.now(),
      caughtBy: null
    };
  }

  /**
   * Spawn a school of fish
   */
  spawnSchool(
    speciesId: string,
    position: Vector3,
    count: number
  ): FishSchool & { fish: Fish[] } {
    const species = fishRegistry.getSpecies(speciesId);
    if (!species) {
      throw new Error(`Unknown species: ${speciesId}`);
    }

    const schoolId = this.generateId();
    const schoolSize = Math.max(
      species.schoolSize.min,
      Math.min(species.schoolSize.max, count)
    );

    const fish: Fish[] = [];
    const leader = this.spawnFish(speciesId, position, schoolId);
    if (leader) {
      leader.isLeader = true;
      fish.push(leader);
    }

    for (let i = 1; i < schoolSize; i++) {
      // Spawn near leader
      const offset = {
        x: (Math.random() - 0.5) * 10,
        y: (Math.random() - 0.5) * 3,
        z: (Math.random() - 0.5) * 10
      };

      const member = this.spawnFish(
        speciesId,
        {
          x: position.x + offset.x,
          y: position.y + offset.y,
          z: position.z + offset.z
        },
        schoolId
      );

      if (member) {
        fish.push(member);
      }
    }

    return {
      id: schoolId,
      species: speciesId,
      members: fish.map(f => f.id),
      leaderId: fish[0]?.id || '',

      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },

      behavior: SchoolBehavior.CRUISING,
      targetPosition: null,

      spawnedAt: Date.now(),
      fish
    };
  }

  /**
   * Age fish and handle lifecycle events
   */
  ageFish(fish: Fish, deltaTime: number): Fish | null {
    // Simulated aging - much faster than real life
    const ageIncrement = deltaTime / (365 * 24 * 3600); // Convert to years

    // Grow based on age
    const species = fishRegistry.getSpecies(fish.species);
    if (!species) return fish;

    // Simple growth model
    const growthRate = 1 - (fish.age / species.maxAge);
    if (Math.random() < growthRate * 0.01) {
      fish.length += 0.01;
      fish.weight += 0.005;
    }

    // Check for natural death
    if (fish.age >= species.maxAge) {
      return null; // Fish dies of old age
    }

    return fish;
  }

  /**
   * Handle spawn season - create new fish
   */
  handleSpawnSeason(
    locationFish: Map<string, Fish>,
    season: Season,
    maxCapacity: number
  ): Fish[] {
    const newFish: Fish[] = [];

    if (season !== Season.SPRING) return newFish;

    // Only spawn if under capacity
    if (locationFish.size >= maxCapacity) return newFish;

    const targetSpecies = fishRegistry.getBySeason(season);

    for (const species of targetSpecies) {
      if (species.spawnSeason === season) {
        // Spawn a few new fish
        const spawnCount = Math.min(
          Math.floor(Math.random() * 5),
          maxCapacity - locationFish.size
        );

        for (let i = 0; i < spawnCount; i++) {
          const position = this.getRandomSpawnPosition();
          const fish = this.spawnFish(species.id, position);
          if (fish) {
            newFish.push(fish);
          }
        }
      }
    }

    return newFish;
  }

  /**
   * Get random spawn position in location
   */
  private getRandomSpawnPosition(): Vector3 {
    return {
      x: Math.random() * 100 - 50,
      y: -5 - Math.random() * 10,
      z: Math.random() * 100 - 50
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `fish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FISH AI MANAGER - Main entry point
// ============================================================================

/**
 * Main fish AI manager combining all systems
 */
export class FishAIManager {
  private boids: BoidFlocking;
  private spawning: FishSpawningSystem;
  private biteDetection: BiteDetectionSystem;
  private behaviorMachines: Map<string, FishBehaviorStateMachine> = new Map();

  constructor() {
    this.boids = new BoidFlocking();
    this.spawning = new FishSpawningSystem();
    this.biteDetection = new BiteDetectionSystem();
  }

  /**
   * Update all fish in a location
   */
  updateFish(
    fish: Map<string, Fish>,
    schools: Map<string, FishSchool>,
    conditions: BehaviorConditions,
    deltaTime: number
  ): Map<string, Fish> {
    const updated = new Map<string, Fish>();

    for (const [id, f] of fish) {
      if (f.caughtBy) {
        updated.set(id, f);
        continue;
      }

      // Get or create behavior machine
      let machine = this.behaviorMachines.get(id);
      if (!machine) {
        machine = new FishBehaviorStateMachine();
        this.behaviorMachines.set(id, machine);
      }

      // Get species data
      const species = fishRegistry.getSpecies(f.species);
      if (!species) {
        updated.set(id, f);
        continue;
      }

      // Update behavior state machine
      const behaviorUpdate = machine.update(f, species, conditions);

      // Apply flocking if in school
      let velocity = behaviorUpdate.velocity;
      if (f.schoolId) {
        const school = schools.get(f.schoolId);
        if (school) {
          const flocking = this.boids.calculateForces(f, school, fish);
          velocity.x += flocking.x * 0.3;
          velocity.y += flocking.y * 0.3;
          velocity.z += flocking.z * 0.3;
        }
      }

      // Clamp velocity
      const maxSpeed = species.baseFightStrength * 4;
      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
      if (speed > maxSpeed) {
        velocity.x = (velocity.x / speed) * maxSpeed;
        velocity.y = (velocity.y / speed) * maxSpeed;
        velocity.z = (velocity.z / speed) * maxSpeed;
      }

      // Update fish
      const updatedFish: Fish = {
        ...f,
        position3D: {
          x: f.position3D.x + velocity.x * deltaTime,
          y: f.position3D.y + velocity.y * deltaTime,
          z: f.position3D.z + velocity.z * deltaTime
        },
        position2D: {
          x: f.position3D.x + velocity.x * deltaTime,
          y: f.position3D.z + velocity.z * deltaTime
        },
        velocity,
        behavior: behaviorUpdate.behavior,
        activityLevel: behaviorUpdate.activityLevel
      };

      // Decrease hunger over time
      updatedFish.hungerLevel = Math.max(0, f.hungerLevel - deltaTime * 0.001);

      updated.set(id, updatedFish);
    }

    return updated;
  }

  /**
   * Check for bites on active lures
   */
  checkBites(
    fish: Map<string, Fish>,
    lurePosition: Vector3,
    lure: Lure,
    conditions: BehaviorConditions
  ): { fishId: string; detection: BiteDetection } | null {
    for (const [id, f] of fish) {
      if (f.caughtBy) continue;

      const species = fishRegistry.getSpecies(f.species);
      if (!species) continue;

      // Check distance to lure
      const dist = Math.sqrt(
        (f.position3D.x - lurePosition.x) ** 2 +
        (f.position3D.y - lurePosition.y) ** 2 +
        (f.position3D.z - lurePosition.z) ** 2
      );

      if (dist < 15) {
        conditions.lurePosition = lurePosition;
        conditions.lureType = lure.category;
        conditions.hasLure = true;

        const detection = this.biteDetection.evaluateBite(f, species, lure, conditions);

        if (detection.willBite) {
          return { fishId: id, detection };
        }
      }
    }

    return null;
  }

  /**
   * Hook a fish
   */
  hookFish(fish: Fish): Fish {
    return {
      ...fish,
      behavior: FishBehavior.HOOKED,
      stressLevel: 0.5
    };
  }

  /**
   * Get spawning system
   */
  getSpawningSystem(): FishSpawningSystem {
    return this.spawning;
  }

  /**
   * Spawn fish at location
   */
  spawnFish(speciesId: string, position: Vector3): Fish | null {
    return this.spawning.spawnFish(speciesId, position);
  }

  /**
   * Spawn school at location
   */
  spawnSchool(speciesId: string, position: Vector3, count: number) {
    return this.spawning.spawnSchool(speciesId, position, count);
  }
}

// Export singleton instance
export const fishAI = new FishAIManager();
