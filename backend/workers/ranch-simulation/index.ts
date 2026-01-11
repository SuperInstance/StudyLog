/**
 * Ranch Simulation - Main API
 *
 * Progressive AI system for ranch/fishing simulation.
 * Supports MicroVerse 2D, Luanti blocky, and OpenRTS 3D engines.
 *
 * @fileoverview Main entry point for the ranch simulation system
 */

// Re-export all types
export * from './types.js';

// Re-export species registry
export {
  getSpecies,
  getSpeciesByCategory,
  getSpeciesByStage,
  getTrainingTargetsForLevel,
  getTrait,
  getRandomTraits,
  isSpeciesCompatibleWithTier,
  getAllSpeciesIds,
  getSpeciesCategory,
  SPECIES_REGISTRY,
  TRAINING_TARGETS,
  ANIMAL_TRAITS,
} from './species-registry.js';

// Re-export animal AI
export {
  AnimalAIController,
  createAIController,
  createAIControllerBatch,
  type AIControllerConfig,
  type AIContext,
} from './animal-ai.js';

// Re-export flocking behavior
export {
  FlockingBehavior,
  createFlockingBehavior,
  createFlockingForTier,
  updateHerdFlocking,
  type FlockingConfig,
  type NeighborData,
} from './flocking-behavior.js';

// Re-export dog training
export {
  DogTrainingManager,
  createDogTrainingManager,
  createPuppy,
  getAllDogCommands,
  getCommandDisplayName,
  getSkillLevelDisplayName,
  type TrainingConfig,
  type CommandResult,
} from './dog-training.js';

// Re-export herd manager
export {
  HerdManager,
  createHerdManager,
  createHerdManagerForTier,
  type HerdManagerConfig,
  type HerdFormationRule,
} from './herd-manager.js';

// Re-export ranch state manager
export {
  RanchStateManager,
  createRanchStateManager,
  createNewRanch,
  serializeRanch,
  deserializeRanch,
} from './ranch-state.js';

// Re-export quality scaling
export {
  RanchQualityScaler,
  createQualityScaler,
  getAIConfigForTier,
  getAllAIConfigs,
  recommendTierForHardware,
  scaleUpdateInterval,
} from './quality-scaling.js';

// ============================================================================
// Ranch Simulation Class - Main API
// ============================================================================

import type {
  Animal,
  Herd,
  HerdingDog,
  RanchState,
  EngineTier,
  AIComplexityStage,
  Position3D,
  UpdateAnimalAIRequest,
  UpdateAnimalAIResponse,
  SpawnAnimalsRequest,
  SpawnAnimalsResponse,
  DogCommand,
  DogCommandRequest,
  DogCommandResponse,
  StartTrainingRequest,
  StartTrainingResponse,
  ProgressStageRequest,
  ProgressStageResponse,
  Obstacle,
  SimulationDelta,
  TerrainInfo,
} from './types.js';
import { AnimalAIController, type AIContext } from './animal-ai.js';
import { HerdManager } from './herd-manager.js';
import { RanchStateManager } from './ranch-state.js';
import { DogTrainingManager } from './dog-training.js';
import { RanchQualityScaler } from './quality-scaling.js';
import { getSpecies, getRandomTraits } from './species-registry.js';

/**
 * Main ranch simulation class.
 * Coordinates all subsystems for a complete ranch simulation.
 */
export class RanchSimulation {
  private stateManager: RanchStateManager;
  private herdManager: HerdManager;
  private trainingManager: DogTrainingManager;
  private qualityScaler: RanchQualityScaler;
  private aiControllers: Map<EngineTier, AnimalAIController> = new Map();

  constructor() {
    this.stateManager = new RanchStateManager();
    this.herdManager = new HerdManager();
    this.trainingManager = new DogTrainingManager();
    this.qualityScaler = new RanchQualityScaler();

    // Create AI controllers for each tier
    for (const tier of [0, 1, 2] as EngineTier[]) {
      this.aiControllers.set(tier, new AnimalAIController({
        engineTier: tier,
        aiStage: AIComplexityStage.SIMPLE,
        updateInterval: 50,
        memorySlots: 8,
        perceptionMultiplier: 1.0,
        pathfindingEnabled: tier >= 1,
        terrainAwareness: tier === 2,
      }));
    }
  }

  // ============================================================================
  // Ranch Management
  // ============================================================================

  /**
   * Create a new ranch.
   */
  createRanch(
    ownerId: string,
    name: string,
    engineTier: EngineTier = EngineTier.MICROVERSE_2D
  ): RanchState {
    const ranch = this.stateManager.createRanch(ownerId, name, engineTier);
    this.updateEngineTier(ranch.id, engineTier);
    return ranch;
  }

  /**
   * Get ranch by ID.
   */
  getRanch(ranchId: string): RanchState | undefined {
    return this.stateManager.getRanch(ranchId);
  }

  /**
   * Load ranch from save data.
   */
  loadRanch(saveData: string): RanchState | null {
    try {
      const parsed = JSON.parse(saveData);
      const ranch = this.stateManager.loadRanch(parsed);
      if (ranch) {
        this.updateEngineTier(ranch.id, ranch.engineTier);
      }
      return ranch;
    } catch {
      return null;
    }
  }

  /**
   * Save ranch to string.
   */
  saveRanch(ranchId: string): string | null {
    const saveData = this.stateManager.saveRanch(ranchId);
    return saveData ? JSON.stringify(saveData) : null;
  }

  // ============================================================================
  // Engine Tier Management
  // ============================================================================

  /**
   * Update engine tier for a ranch.
   */
  updateEngineTier(ranchId: string, tier: EngineTier): void {
    const ranch = this.stateManager.getRanch(ranchId);
    if (!ranch) return;

    ranch.engineTier = tier;
    this.qualityScaler.setTier(tier);
    this.herdManager.setEngineTier(tier);

    // Update AI stage compatibility
    if (tier === EngineTier.MICROVERSE_2D && ranch.aiStage > AIComplexityStage.PUPPY_TRAINING) {
      ranch.aiStage = AIComplexityStage.PUPPY_TRAINING;
    } else if (tier === EngineTier.LUANTI_BLOCKY && ranch.aiStage > AIComplexityStage.HERD_ANIMALS) {
      ranch.aiStage = AIComplexityStage.HERD_ANIMALS;
    }
  }

  // ============================================================================
  // Animal Spawning
  // ============================================================================

  /**
   * Spawn animals in a ranch.
   */
  spawnAnimals(request: SpawnAnimalsRequest): SpawnAnimalsResponse {
    const ranch = this.stateManager.getRanch(request.ranchId);
    if (!ranch) {
      return { animalIds: [], failures: request.spawns.map(s => ({ config: s, reason: 'ranch_not_found' })) };
    }

    const animalIds: string[] = [];
    const failures: { config: typeof request.spawns[0]; reason: string }[] = [];

    for (const spawn of request.spawns) {
      const species = getSpecies(spawn.speciesId);
      if (!species) {
        failures.push({ config: spawn, reason: 'unknown_species' });
        continue;
      }

      // Check AI stage compatibility
      const minStage = species.supportedStages[0];
      if (ranch.aiStage < minStage) {
        failures.push({ config: spawn, reason: 'stage_not_unlocked' });
        continue;
      }

      // Create animal
      const position = spawn.position || {
        x: Math.random() * ranch.dimensions.width,
        y: 0,
        z: Math.random() * (ranch.dimensions.depth || ranch.dimensions.height),
      };

      const animal = AnimalAIController.createAnimal(
        crypto.randomUUID(),
        spawn.speciesId,
        position,
        ranch.engineTier,
        ranch.aiStage
      );

      // Apply random traits if specified
      if (!spawn.traits || spawn.traits.length === 0) {
        animal.traits = getRandomTraits(2);
      }

      // Set ownership
      if (spawn.ownerId) {
        animal.ownerId = spawn.ownerId;
      }
      if (spawn.herdId) {
        animal.herdId = spawn.herdId;
      }

      // Add to ranch
      if (this.stateManager.addAnimal(ranch.id, animal)) {
        animalIds.push(animal.id);
      } else {
        failures.push({ config: spawn, reason: 'failed_to_add' });
      }
    }

    // Auto-form herds for herdable animals
    if (animalIds.length > 0) {
      const animals = animalIds.map(id => ranch.animals[id]).filter((a): a is Animal => a !== undefined);
      const newHerds = this.herdManager.formHerds(animals, ranch.ownerId);
      for (const herd of newHerds) {
        this.stateManager.addHerd(ranch.id, herd);
      }
    }

    return { animalIds, failures };
  }

  // ============================================================================
  // AI Updates
  // ============================================================================

  /**
   * Update AI for animals in a ranch.
   */
  updateAI(request: UpdateAnimalAIRequest): UpdateAnimalAIResponse {
    const ranch = this.stateManager.getRanch(request.ranchId);
    if (!ranch) {
      return { animals: {}, herds: {}, processingTime: 0 };
    }

    const startTime = performance.now();

    // Build spatial hash for efficient queries
    const animalsMap = new Map(Object.entries(ranch.animals));
    this.qualityScaler.buildSpatialHash(animalsMap);

    // Determine which animals to update
    const animalIds = request.animalIds || Object.keys(ranch.animals);
    const batch = this.qualityScaler.getUpdateBatch(
      animalsMap,
      request.delta.currentTime,
      request.playerPosition
    );

    // Get AI controller for this tier
    const aiController = this.aiControllers.get(ranch.engineTier);
    if (!aiController) {
      return { animals: {}, herds: {}, processingTime: 0 };
    }

    // Update each animal
    const updatedAnimals: UpdateAnimalAIResponse['animals'] = {};
    const threats: Position3D[] = [];

    for (const animal of batch) {
      // Build AI context
      const nearbyAnimals = this.qualityScaler.queryNearby(
        animal.position,
        animal.species?.stats.detectionRadius || 10,
        animalsMap
      );

      const context: AIContext = {
        nearbyAnimals,
        nearbyObstacles: request.obstacles || [],
        playerPosition: request.playerPosition,
        terrain: request.terrain?.getPosition?.(animal.position),
        currentTime: request.delta.currentTime,
        deltaTime: request.delta.deltaTime,
        herdCenter: animal.herdId ? ranch.herds[animal.herdId]?.center : undefined,
        threatPosition: undefined,
        targetPosition: undefined,
      };

      // Detect threats (player if dog nearby)
      if (request.playerPosition && this.hasThreat(nearbyAnimals)) {
        context.threatPosition = request.playerPosition;
        threats.push(request.playerPosition);
      }

      // Update AI
      aiController.update(animal, context);

      // Update spatial hash
      this.qualityScaler.updateSpatialPosition(animal.id, animal.position);

      // Store update result
      updatedAnimals[animal.id] = {
        id: animal.id,
        position: animal.position,
        state: animal.state,
        velocity: animal.velocity,
      };
    }

    // Update herds
    const updatedHerds: UpdateAnimalAIResponse['herds'] = {};
    this.herdManager.updateHerds(animalsMap, request.delta.deltaTime, threats, request.obstacles);

    for (const [herdId, herd] of Object.entries(ranch.herds)) {
      updatedHerds[herdId] = {
        id: herdId,
        center: herd.center,
        state: herd.state,
      };
    }

    // Update dogs
    for (const dogId of ranch.dogs) {
      const dog = ranch.animals[dogId] as HerdingDog;
      if (dog?.dog) {
        this.trainingManager.updateDogRecovery(dog, request.delta.deltaTime / 1000);
      }
    }

    const processingTime = performance.now() - startTime;

    return { animals: updatedAnimals, herds: updatedHerds, processingTime };
  }

  /**
   * Check if any nearby animals are threats (dogs).
   */
  private hasThreat(nearbyAnimals: Animal[]): boolean {
    return nearbyAnimals.some(a => a.speciesId === 'border_collie' || a.speciesId === 'aussie_shepherd');
  }

  // ============================================================================
  // Dog Commands
  // ============================================================================

  /**
   * Give a command to a dog.
   */
  giveDogCommand(request: DogCommandRequest): DogCommandResponse {
    const ranch = this.stateManager.getRanch(request.ranchId);
    if (!ranch) {
      return { accepted: false, dogResponse: { id: '', state: 'idle' as any } };
    }

    const dog = this.stateManager.getDog(request.ranchId, request.dogId);
    if (!dog) {
      return { accepted: false, dogResponse: { id: '', state: 'idle' as any } };
    }

    // Get target animals
    const targets = request.targetAnimals
      ? request.targetAnimals.map(id => ranch.animals[id]).filter((a): a is Animal => a !== undefined)
      : [];

    // Execute command
    const result = this.trainingManager.executeCommand(
      dog,
      request.command,
      targets,
      request.target
    );

    // Update training stats
    if (result.success) {
      ranch.stats.trainingSessions++;
      dog.dog.animalsHerded += targets.length;
    }

    return {
      accepted: result.success,
      dogResponse: {
        id: dog.id,
        state: dog.state,
        currentCommand: dog.dog.currentCommand,
      },
      expectedDuration: result.executionTime,
    };
  }

  // ============================================================================
  // Training Sessions
  // ============================================================================

  /**
   * Start a training session.
   */
  startTraining(request: StartTrainingRequest): StartTrainingResponse | null {
    const ranch = this.stateManager.getRanch(request.ranchId);
    if (!ranch) return null;

    const dog = this.stateManager.getDog(request.ranchId, request.dogId);
    if (!dog) return null;

    // Spawn training animals
    const spawnResults = this.spawnAnimals({
      ranchId: request.ranchId,
      spawns: request.targets.flatMap(t =>
        Array.from({ length: t.count }, () => ({
          speciesId: t.species,
          ownerId: ranch.ownerId,
        }))
      ),
    });

    const trainingAnimals = spawnResults.animalIds.map(id => ranch.animals[id]).filter((a): a is Animal => a !== undefined);

    // Start session
    const session = this.trainingManager.startTrainingSession(
      dog,
      request.command,
      trainingAnimals
    );

    // Calculate difficulty
    let totalDifficulty = 0;
    for (const target of request.targets) {
      const trainingTarget = TRAINING_TARGETS[target.species];
      if (trainingTarget) {
        totalDifficulty += trainingTarget.difficulty * target.count;
      }
    }
    const avgDifficulty = request.targets.reduce((sum, t) => sum + t.count, 0) > 0
      ? totalDifficulty / request.targets.reduce((sum, t) => sum + t.count, 0)
      : 1;

    // Calculate available XP
    const experienceAvailable = Math.floor(100 * avgDifficulty * trainingAnimals.length);

    return {
      sessionId: session.id,
      animalIds: spawnResults.animalIds,
      difficulty: avgDifficulty,
      experienceAvailable,
    };
  }

  // ============================================================================
  // Stage Progression
  // ============================================================================

  /**
   * Progress to the next AI stage.
   */
  progressStage(request: ProgressStageRequest): ProgressStageResponse {
    const ranch = this.stateManager.getRanch(request.ranchId);
    if (!ranch) {
      return {
        newStage: AIComplexityStage.SIMPLE,
        unlockedFeatures: [],
        requirementsMet: false,
      };
    }

    const result = this.stateManager.progressStage(request.ranchId, request.targetStage);

    // Update AI controller stages
    if (result.success) {
      for (const controller of this.aiControllers.values()) {
        // Update would happen through config
      }
    }

    const warnings: string[] = [];

    // Check engine tier compatibility
    if (result.newStage === AIComplexityStage.HERD_ANIMALS && ranch.engineTier < EngineTier.LUANTI_BLOCKY) {
      warnings.push('herd_animals_requires_blocky_tier');
    }
    if (result.newStage === AIComplexityStage.ADVANCED_HERDING && ranch.engineTier < EngineTier.OPENRTS_3D) {
      warnings.push('advanced_herding_requires_3d_tier');
    }

    return {
      ...result,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // ============================================================================
  // Queries
  // ============================================================================

  /**
   * Get all animals in a ranch.
   */
  getAnimals(ranchId: string): Animal[] {
    const ranch = this.stateManager.getRanch(ranchId);
    if (!ranch) return [];
    return Object.values(ranch.animals);
  }

  /**
   * Get all herds in a ranch.
   */
  getHerds(ranchId: string): Herd[] {
    const ranch = this.stateManager.getRanch(ranchId);
    if (!ranch) return [];
    return Object.values(ranch.herds);
  }

  /**
   * Get all dogs in a ranch.
   */
  getDogs(ranchId: string): HerdingDog[] {
    return this.stateManager.getDogs(ranchId);
  }

  /**
   * Get quality scaler statistics.
   */
  getQualityStats(ranchId: string) {
    const ranch = this.stateManager.getRanch(ranchId);
    if (!ranch) return null;

    return this.qualityScaler.getStats();
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Unload a ranch from memory.
   */
  unloadRanch(ranchId: string): void {
    this.stateManager.unloadRanch(ranchId);
  }

  /**
   * Unload all ranches.
   */
  unloadAll(): void {
    this.stateManager.clearCache();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new ranch simulation instance.
 */
export function createRanchSimulation(): RanchSimulation {
  return new RanchSimulation();
}

/**
 * Get the singleton ranch simulation instance.
 */
let singletonInstance: RanchSimulation | undefined;

export function getRanchSimulation(): RanchSimulation {
  if (!singletonInstance) {
    singletonInstance = new RanchSimulation();
  }
  return singletonInstance;
}

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';
