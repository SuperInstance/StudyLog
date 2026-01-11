/**
 * Animal AI Controller
 *
 * Base AI system for all animals in the ranch simulation.
 * Implements behavior state machine, needs system, and memory.
 *
 * @fileoverview Core animal AI with progressive complexity stages
 */

import type {
  Animal,
  AnimalState,
  AnimalNeeds,
  AnimalMemory,
  AIComplexityStage,
  EngineTier,
  Position3D,
  Velocity,
  SpeciesConfig,
  SimulationDelta,
  Obstacle,
  TerrainInfo,
  AnimalStateChangeEvent,
} from './types.js';
import { getSpecies } from './species-registry.js';
import { SIMULATION_DEFAULTS } from './types.js';

// ============================================================================
// AI Controller Configuration
// ============================================================================

interface AIControllerConfig {
  /** Engine tier for quality scaling */
  engineTier: EngineTier;
  /** AI complexity stage */
  aiStage: AIComplexityStage;
  /** Update interval in ms */
  updateInterval: number;
  /** Memory slots per animal */
  memorySlots: number;
  /** Perception distance multiplier */
  perceptionMultiplier: number;
  /** Pathfinding enabled */
  pathfindingEnabled: boolean;
  /** Terrain awareness enabled */
  terrainAwareness: boolean;
}

// ============================================================================
// Behavior State Machine
// ============================================================================

/**
 * State transition rule for behavior state machine.
 */
interface StateTransition {
  from: AnimalState;
  to: AnimalState;
  condition: (animal: Animal, context: AIContext) => boolean;
  priority: number;
}

/**
 * Context information for AI decisions.
 */
interface AIContext {
  /** Nearby animals */
  nearbyAnimals: Animal[];
  /** Nearby obstacles */
  nearbyObstacles: Obstacle[];
  /** Player position */
  playerPosition?: Position3D;
  /** Terrain at current position */
  terrain?: TerrainInfo;
  /** Current time */
  currentTime: number;
  /** Delta time */
  deltaTime: number;
  /** Herd center (if in herd) */
  herdCenter?: Position3D;
  /** Threat position */
  threatPosition?: Position3D;
  /** Target position */
  targetPosition?: Position3D;
}

// ============================================================================
// Animal AI Controller Class
// ============================================================================

export class AnimalAIController {
  private config: AIControllerConfig;
  private stateTransitions: StateTransition[] = [];

  constructor(config: Partial<AIControllerConfig> = {}) {
    this.config = {
      engineTier: EngineTier.MICROVERSE_2D,
      aiStage: AIComplexityStage.SIMPLE,
      updateInterval: SIMULATION_DEFAULTS.TICK_RATE,
      memorySlots: SIMULATION_DEFAULTS.MEMORY_DECAY_RATE * 100,
      perceptionMultiplier: 1.0,
      pathfindingEnabled: false,
      terrainAwareness: false,
      ...config,
    };
    this.initializeStateTransitions();
  }

  // ============================================================================
  // State Machine Initialization
  // ============================================================================

  private initializeStateTransitions(): void {
    this.stateTransitions = [
      // IDLE transitions
      {
        from: AnimalState.IDLE,
        to: AnimalState.WANDERING,
        condition: () => Math.random() < 0.3,
        priority: 1,
      },
      {
        from: AnimalState.IDLE,
        to: AnimalState.GRAZING,
        condition: (animal) => animal.needs.hunger > 0.3,
        priority: 2,
      },
      {
        from: AnimalState.IDLE,
        to: AnimalState.SLEEPING,
        condition: (animal) => animal.needs.energy > 0.7,
        priority: 2,
      },
      {
        from: AnimalState.IDLE,
        to: AnimalState.FLEEING,
        condition: (_, ctx) => ctx.threatPosition !== undefined,
        priority: 10,
      },

      // WANDERING transitions
      {
        from: AnimalState.WANDERING,
        to: AnimalState.IDLE,
        condition: () => Math.random() < 0.2,
        priority: 1,
      },
      {
        from: AnimalState.WANDERING,
        to: AnimalState.GRAZING,
        condition: (animal) => animal.needs.hunger > 0.5,
        priority: 3,
      },
      {
        from: AnimalState.WANDERING,
        to: AnimalState.FLEEING,
        condition: (_, ctx) => ctx.threatPosition !== undefined,
        priority: 10,
      },
      {
        from: AnimalState.WANDERING,
        to: AnimalState.STUCK,
        condition: (animal, ctx) => this.isStuck(animal, ctx),
        priority: 5,
      },

      // GRAZING transitions
      {
        from: AnimalState.GRAZING,
        to: AnimalState.IDLE,
        condition: (animal) => animal.needs.hunger < 0.2,
        priority: 2,
      },
      {
        from: AnimalState.GRAZING,
        to: AnimalState.FLEEING,
        condition: (_, ctx) => ctx.threatPosition !== undefined,
        priority: 10,
      },

      // FLEEING transitions
      {
        from: AnimalState.FLEEING,
        to: AnimalState.IDLE,
        condition: (_, ctx) => ctx.threatPosition === undefined,
        priority: 5,
      },
      {
        from: AnimalState.FLEEING,
        to: AnimalState.WANDERING,
        condition: (_, ctx) => ctx.threatPosition === undefined,
        priority: 4,
      },

      // SLEEPING transitions
      {
        from: AnimalState.SLEEPING,
        to: AnimalState.IDLE,
        condition: (animal) => animal.needs.energy < 0.2,
        priority: 2,
      },
      {
        from: AnimalState.SLEEPING,
        to: AnimalState.FLEEING,
        condition: (_, ctx) => ctx.threatPosition !== undefined,
        priority: 10,
      },

      // STUCK transitions
      {
        from: AnimalState.STUCK,
        to: AnimalState.WANDERING,
        condition: () => Math.random() < 0.5,
        priority: 2,
      },
      {
        from: AnimalState.STUCK,
        to: AnimalState.FLEEING,
        condition: (_, ctx) => ctx.threatPosition !== undefined,
        priority: 10,
      },

      // FOLLOWING (for herd animals)
      {
        from: AnimalState.FOLLOWING,
        to: AnimalState.FLEEING,
        condition: (_, ctx) => ctx.threatPosition !== undefined,
        priority: 10,
      },
      {
        from: AnimalState.FOLLOWING,
        to: AnimalState.GRAZING,
        condition: (animal) => animal.needs.hunger > 0.6,
        priority: 3,
      },
      {
        from: AnimalState.FOLLOWING,
        to: AnimalState.WANDERING,
        condition: (_, ctx) => ctx.herdCenter === undefined,
        priority: 2,
      },
    ];
  }

  // ============================================================================
  // Main Update Method
  // ============================================================================

  /**
   * Update AI for a single animal.
   */
  update(
    animal: Animal,
    context: AIContext
  ): AnimalStateChangeEvent | null {
    const event = this.updateState(animal, context);
    this.updateNeeds(animal, context);
    this.updateMemories(animal, context);
    this.calculateMovement(animal, context);

    return event;
  }

  /**
   * Update animal state based on transitions.
   */
  private updateState(animal: Animal, context: AIContext): AnimalStateChangeEvent | null {
    const validTransitions = this.stateTransitions
      .filter(t => t.from === animal.state)
      .filter(t => t.condition(animal, context))
      .sort((a, b) => b.priority - a.priority);

    if (validTransitions.length > 0) {
      const transition = validTransitions[0];
      const previousState = animal.state;
      animal.state = transition.to;

      return {
        animalId: animal.id,
        previousState,
        newState: transition.to,
        reason: this.getTransitionReason(transition, context),
        timestamp: context.currentTime,
      };
    }

    return null;
  }

  /**
   * Get human-readable reason for state transition.
   */
  private getTransitionReason(transition: StateTransition, context: AIContext): string {
    switch (transition.to) {
      case AnimalState.FLEEING:
        return 'threat_detected';
      case AnimalState.GRAZING:
        return 'hunger';
      case AnimalState.SLEEPING:
        return 'exhausted';
      case AnimalState.WANDERING:
        return 'exploring';
      case AnimalState.IDLE:
        return 'content';
      case AnimalState.STUCK:
        return 'blocked';
      case AnimalState.FOLLOWING:
        return 'herding';
      default:
        return 'state_change';
    }
  }

  // ============================================================================
  // Needs System
  // ============================================================================

  /**
   * Update animal needs based on current state and time.
   */
  private updateNeeds(animal: Animal, context: AIContext): void {
    const deltaSeconds = context.deltaTime / 1000;
    const species = animal.species;

    if (!species) return;

    // Decay rates based on species stats
    const hungerRate = 0.01 / (species.stats.maxHunger / 100);
    const energyRate = 0.005 / (species.stats.maxEnergy / 100);
    const fearDecay = 0.05;

    // Update needs based on state
    switch (animal.state) {
      case AnimalState.GRAZING:
        animal.needs.hunger = Math.max(0, animal.needs.hunger - hungerRate * 5);
        animal.needs.energy = Math.min(1, animal.needs.energy + energyRate * 0.5);
        break;

      case AnimalState.WANDERING:
      case AnimalState.FOLLOWING:
        animal.needs.hunger = Math.min(1, animal.needs.hunger + hungerRate);
        animal.needs.energy = Math.min(1, animal.needs.energy + energyRate * 2);
        break;

      case AnimalState.FLEEING:
        animal.needs.hunger = Math.min(1, animal.needs.hunger + hungerRate * 3);
        animal.needs.energy = Math.min(1, animal.needs.energy + energyRate * 4);
        animal.needs.stress = Math.min(1, animal.needs.stress + 0.1);
        break;

      case AnimalState.SLEEPING:
        animal.needs.energy = Math.max(0, animal.needs.energy - energyRate * 10);
        animal.needs.stress = Math.max(0, animal.needs.stress - 0.05);
        break;

      case AnimalState.IDLE:
        animal.needs.hunger = Math.min(1, animal.needs.hunger + hungerRate * 0.5);
        animal.needs.energy = Math.max(0, animal.needs.energy - energyRate * 0.3);
        animal.needs.stress = Math.max(0, animal.needs.stress - 0.02);
        break;

      case AnimalState.PLAYING:
        animal.needs.hunger = Math.min(1, animal.needs.hunger + hungerRate * 2);
        animal.needs.energy = Math.min(1, animal.needs.energy + energyRate * 3);
        animal.needs.social = Math.max(0, animal.needs.social - 0.1);
        animal.needs.stress = Math.max(0, animal.needs.stress - 0.1);
        break;

      case AnimalState.STUCK:
        animal.needs.stress = Math.min(1, animal.needs.stress + 0.05);
        break;
    }

    // Natural fear decay
    if (context.threatPosition === undefined) {
      animal.needs.fear = Math.max(0, animal.needs.fear - fearDecay);
    }

    // Social need based on nearby animals
    if (this.config.aiStage >= AIComplexityStage.HERD_ANIMALS) {
      const socialNeed = this.calculateSocialNeed(animal, context);
      animal.needs.social = Math.max(0, Math.min(1, socialNeed));
    }

    // Clamp all needs to 0-1
    animal.needs.hunger = Math.max(0, Math.min(1, animal.needs.hunger));
    animal.needs.energy = Math.max(0, Math.min(1, animal.needs.energy));
    animal.needs.thirst = Math.max(0, Math.min(1, animal.needs.thirst));
    animal.needs.social = Math.max(0, Math.min(1, animal.needs.social));
    animal.needs.fear = Math.max(0, Math.min(1, animal.needs.fear));
    animal.needs.stress = Math.max(0, Math.min(1, animal.needs.stress));
  }

  /**
   * Calculate social need based on nearby conspecifics.
   */
  private calculateSocialNeed(animal: Animal, context: AIContext): number {
    const nearbySameSpecies = context.nearbyAnimals.filter(
      a => a.speciesId === animal.speciesId && a.id !== animal.id
    );

    if (nearbySameSpecies.length === 0) {
      return Math.min(1, animal.needs.social + 0.01);
    }

    // Social need decreases with more nearby herd members
    const socialFactor = Math.max(0, 1 - nearbySameSpecies.length / 10);
    return socialFactor * 0.5 + animal.needs.social * 0.5;
  }

  // ============================================================================
  // Memory System
  // ============================================================================

  /**
   * Update and decay animal memories.
   */
  private updateMemories(animal: Animal, context: AIContext): void {
    if (this.config.aiStage < AIComplexityStage.HERD_ANIMALS) {
      // Simple stages don't use memory
      return;
    }

    const deltaSeconds = context.deltaTime / 1000;
    const decayRate = SIMULATION_DEFAULTS.MEMORY_DECAY_RATE * deltaSeconds;

    // Decay existing memories
    animal.memories = animal.memories
      .map(memory => ({
        ...memory,
        strength: Math.max(0, memory.strength - decayRate),
      }))
      .filter(m => m.strength > 0);

    // Limit memory slots based on quality
    if (animal.memories.length > this.config.memorySlots) {
      // Keep only strongest memories
      animal.memories.sort((a, b) => b.strength - a.strength);
      animal.memories = animal.memories.slice(0, this.config.memorySlots);
    }

    // Form new memories based on context
    this.formMemories(animal, context);
  }

  /**
   * Form new memories based on current context.
   */
  private formMemories(animal: Animal, context: AIContext): void {
    // Threat memory
    if (context.threatPosition) {
      const existingThreat = animal.memories.find(
        m => m.type === 'threat' && m.entityId === 'player'
      );

      if (existingThreat) {
        existingThreat.position = context.threatPosition;
        existingThreat.strength = Math.min(1, existingThreat.strength + 0.3);
        existingThreat.timestamp = context.currentTime;
      } else {
        animal.memories.push({
          type: 'threat',
          position: context.threatPosition,
          strength: 0.8,
          timestamp: context.currentTime,
          entityId: 'player',
        });
      }
    }

    // Food memory (grazing spots)
    if (animal.state === AnimalState.GRAZING && animal.needs.hunger < 0.5) {
      const existingFood = animal.memories.find(m => m.type === 'food');

      if (!existingFood) {
        animal.memories.push({
          type: 'food',
          position: { ...animal.position },
          strength: 0.6,
          timestamp: context.currentTime,
        });
      }
    }

    // Safe zone memory (where threat was lost)
    if (animal.state === AnimalState.FLEEING && context.threatPosition === undefined) {
      const existingSafe = animal.memories.find(m => m.type === 'safe_zone');

      if (!existingSafe) {
        animal.memories.push({
          type: 'safe_zone',
          position: { ...animal.position },
          strength: 0.5,
          timestamp: context.currentTime,
        });
      }
    }
  }

  // ============================================================================
  // Movement Calculation
  // ============================================================================

  /**
   * Calculate velocity based on current state and context.
   */
  private calculateMovement(animal: Animal, context: AIContext): void {
    const species = animal.species;
    if (!species) return;

    let targetVelocity: Velocity = { x: 0, y: 0, z: 0 };

    switch (animal.state) {
      case AnimalState.IDLE:
      case AnimalState.SLEEPING:
        targetVelocity = { x: 0, y: 0, z: 0 };
        break;

      case AnimalState.WANDERING:
        targetVelocity = this.calculateWanderingVelocity(animal, context);
        break;

      case AnimalState.GRAZING:
        targetVelocity = this.calculateGrazingVelocity(animal, context);
        break;

      case AnimalState.FLEEING:
        targetVelocity = this.calculateFleeingVelocity(animal, context);
        break;

      case AnimalState.FOLLOWING:
        targetVelocity = this.calculateFollowingVelocity(animal, context);
        break;

      case AnimalState.PLAYING:
        targetVelocity = this.calculatePlayingVelocity(animal, context);
        break;

      case AnimalState.STUCK:
        targetVelocity = this.calculateUnstuckVelocity(animal, context);
        break;

      default:
        targetVelocity = { x: 0, y: 0, z: 0 };
    }

    // Apply terrain constraints if enabled
    if (this.config.terrainAwareness && context.terrain) {
      targetVelocity = this.applyTerrainConstraints(targetVelocity, context.terrain);
    }

    // Apply obstacle avoidance
    targetVelocity = this.applyObstacleAvoidance(animal, targetVelocity, context);

    // Normalize and apply speed
    const speed = this.getCurrentSpeed(animal);
    const magnitude = Math.sqrt(
      targetVelocity.x ** 2 + targetVelocity.y ** 2 +
      (targetVelocity.z ?? 0) ** 2
    );

    if (magnitude > 0.01) {
      animal.velocity = {
        x: (targetVelocity.x / magnitude) * speed,
        y: 0, // No vertical movement in basic mode
        z: (targetVelocity.z ?? 0) / magnitude * speed,
      };
    } else {
      animal.velocity = { x: 0, y: 0, z: 0 };
    }

    // Update position based on velocity
    const deltaSeconds = context.deltaTime / 1000;
    animal.position.x += animal.velocity.x * deltaSeconds;
    animal.position.z += (animal.velocity.z ?? 0) * deltaSeconds;

    // Update rotation to face movement direction
    if (magnitude > 0.01) {
      animal.rotation = Math.atan2(animal.velocity.x, animal.velocity.z ?? 1) * 180 / Math.PI;
    }
  }

  /**
   * Calculate wandering velocity with random direction changes.
   */
  private calculateWanderingVelocity(animal: Animal, context: AIContext): Velocity {
    // Use Perlin-like noise for natural wandering
    const time = context.currentTime / 1000;
    const noiseX = Math.sin(time * 0.5 + animal.id.charCodeAt(0)) * 0.5 +
                   Math.sin(time * 1.3 + animal.id.charCodeAt(1)) * 0.3;
    const noiseZ = Math.cos(time * 0.6 + animal.id.charCodeAt(2)) * 0.5 +
                   Math.cos(time * 1.1 + animal.id.charCodeAt(3)) * 0.3;

    return { x: noiseX, y: 0, z: noiseZ };
  }

  /**
   * Calculate grazing velocity (slow, occasional movements).
   */
  private calculateGrazingVelocity(animal: Animal, context: AIContext): Velocity {
    // Mostly stationary with small movements
    if (Math.random() < 0.95) {
      return { x: 0, y: 0, z: 0 };
    }

    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * 0.3,
      y: 0,
      z: Math.sin(angle) * 0.3,
    };
  }

  /**
   * Calculate fleeing velocity away from threat.
   */
  private calculateFleeingVelocity(animal: Animal, context: AIContext): Velocity {
    if (!context.threatPosition) {
      return { x: 0, y: 0, z: 0 };
    }

    const dx = animal.position.x - context.threatPosition.x;
    const dz = animal.position.z - (context.threatPosition.z ?? 0);
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 0.01) {
      // Random direction if on top of threat
      const angle = Math.random() * Math.PI * 2;
      return { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    }

    return {
      x: dx / distance,
      y: 0,
      z: dz / distance,
    };
  }

  /**
   * Calculate following velocity toward herd center.
   */
  private calculateFollowingVelocity(animal: Animal, context: AIContext): Velocity {
    if (!context.herdCenter) {
      return this.calculateWanderingVelocity(animal, context);
    }

    const dx = context.herdCenter.x - animal.position.x;
    const dz = context.herdCenter.z - animal.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 1) {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: dx / distance,
      y: 0,
      z: dz / distance,
    };
  }

  /**
   * Calculate playing velocity with energetic movements.
   */
  private calculatePlayingVelocity(animal: Animal, context: AIContext): Velocity {
    const time = context.currentTime / 1000;
    const fastNoise = Math.sin(time * 3 + animal.id.charCodeAt(0));

    const angle = fastNoise * Math.PI * 2;
    return {
      x: Math.cos(angle),
      y: 0,
      z: Math.sin(angle),
    };
  }

  /**
   * Calculate velocity to escape from being stuck.
   */
  private calculateUnstuckVelocity(animal: Animal, context: AIContext): Velocity {
    // Try random directions
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle),
      y: 0,
      z: Math.sin(angle),
    };
  }

  /**
   * Apply terrain constraints to velocity.
   */
  private applyTerrainConstraints(velocity: Velocity, terrain: TerrainInfo): Velocity {
    if (!terrain.walkable) {
      // Slow down significantly on unwalkable terrain
      return {
        x: velocity.x * 0.1,
        y: velocity.y,
        z: (velocity.z ?? 0) * 0.1,
      };
    }

    if (terrain.slope > 0.5) {
      // Slow down on steep slopes
      const slopeFactor = 1 - terrain.slope * 0.5;
      return {
        x: velocity.x * slopeFactor,
        y: velocity.y,
        z: (velocity.z ?? 0) * slopeFactor,
      };
    }

    return velocity;
  }

  /**
   * Apply obstacle avoidance to velocity.
   */
  private applyObstacleAvoidance(animal: Animal, velocity: Velocity, context: AIContext): Velocity {
    if (context.nearbyObstacles.length === 0) {
      return velocity;
    }

    let avoidanceX = 0;
    let avoidanceZ = 0;

    for (const obstacle of context.nearbyObstacles) {
      const dx = animal.position.x - ((obstacle.bounds.min.x + obstacle.bounds.max.x) / 2);
      const dz = animal.position.z - ((obstacle.bounds.min.z + obstacle.bounds.max.z) / 2);
      const distance = Math.sqrt(dx * dx + dz * dz);

      const avoidanceRadius = animal.species?.stats.personalSpace ?? 2;

      if (distance < avoidanceRadius && distance > 0) {
        const strength = (avoidanceRadius - distance) / avoidanceRadius;
        avoidanceX += (dx / distance) * strength * 2;
        avoidanceZ += (dz / distance) * strength * 2;
      }
    }

    return {
      x: velocity.x + avoidanceX,
      y: velocity.y,
      z: (velocity.z ?? 0) + avoidanceZ,
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current speed based on animal state and stats.
   */
  private getCurrentSpeed(animal: Animal): number {
    const species = animal.species;
    if (!species) return 1;

    switch (animal.state) {
      case AnimalState.FLEEING:
      case AnimalState.PLAYING:
        return species.stats.fleeSpeed;
      case AnimalState.GRAZING:
        return species.stats.moveSpeed * 0.2;
      case AnimalState.WANDERING:
      case AnimalState.FOLLOWING:
        return species.stats.moveSpeed;
      default:
        return 0;
    }
  }

  /**
   * Check if animal is stuck.
   */
  private isStuck(animal: Animal, context: AIContext): boolean {
    // Check if velocity is very low but state expects movement
    const speed = Math.sqrt(
      animal.velocity.x ** 2 + (animal.velocity.z ?? 0) ** 2
    );

    const expectsMovement = [
      AnimalState.WANDERING,
      AnimalState.FLEEING,
      AnimalState.FOLLOWING,
    ].includes(animal.state);

    return expectsMovement && speed < 0.1;
  }

  /**
   * Create a new animal instance.
   */
  static createAnimal(
    id: string,
    speciesId: string,
    position: Position3D,
    engineTier: EngineTier,
    aiStage: AIComplexityStage
  ): Animal {
    const species = getSpecies(speciesId);

    if (!species) {
      throw new Error(`Unknown species: ${speciesId}`);
    }

    return {
      id,
      speciesId,
      species,
      engineTier,
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      state: AnimalState.IDLE,
      needs: {
        hunger: 0.3,
        energy: 0,
        thirst: 0.2,
        social: 0.5,
        fear: 0,
        stress: 0,
      },
      memories: [],
      aiStage,
      age: 0,
      health: species.stats.maxHealth,
      traits: [],
      lastUpdate: Date.now(),
      spawned: true,
      behaviorPriority: 0.5,
    };
  }

  /**
   * Clone an animal (for save/load).
   */
  static cloneAnimal(animal: Animal): Animal {
    return JSON.parse(JSON.stringify(animal)) as Animal;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AI controller with default configuration.
 */
export function createAIController(config?: Partial<AIControllerConfig>): AnimalAIController {
  return new AnimalAIController(config);
}

/**
 * Create a batch of AI controllers for parallel processing.
 */
export function createAIControllerBatch(
  count: number,
  config?: Partial<AIControllerConfig>
): AnimalAIController[] {
  return Array.from({ length: count }, () => new AnimalAIController(config));
}
