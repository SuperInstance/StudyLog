/**
 * Ranch Simulation - Type Definitions
 *
 * Progressive AI system for ranch/fishing simulation with animal complexity scaling.
 * Supports MicroVerse 2D, Luanti blocky, and OpenRTS 3D engine tiers.
 *
 * @fileoverview Core types for the ranch simulation system
 */

// ============================================================================
// Engine Tier Enumeration
// ============================================================================

/**
 * Engine tiers represent the visualization complexity level.
 * Each tier supports different AI capabilities and visual fidelity.
 */
export enum EngineTier {
  /** MicroVerse 2D - Simple sprites, basic behaviors */
  MICROVERSE_2D = 0,
  /** Luanti blocky - Voxel 3D, moderate flocking */
  LUANTI_BLOCKY = 1,
  /** OpenRTS 3D - Full 3D with terrain, complex behaviors */
  OPENRTS_3D = 2,
}

/**
 * Animal AI complexity stages for progressive difficulty.
 */
export enum AIComplexityStage {
  /** Stage 1: Simple random movement, basic reactions */
  SIMPLE = 1,
  /** Stage 2: Puppy training on geese/chickens */
  PUPPY_TRAINING = 2,
  /** Stage 3: Herd animals with flocking behaviors */
  HERD_ANIMALS = 3,
  /** Stage 4: Advanced herding with terrain awareness */
  ADVANCED_HERDING = 4,
}

/**
 * Species categories for behavioral grouping.
 */
export enum SpeciesCategory {
  /** Birds - Chickens, geese, ducks */
  POULTRY = 'poultry',
  /** Herd animals - Sheep, cattle, goats */
  HERD = 'herd',
  /** Working dogs - Border collies, Australian shepherds */
  WORKING_DOG = 'working_dog',
  /** Transport animals - Horses, donkeys */
  EQUINE = 'equine',
  /** Small animals - Rabbits, guinea pigs */
  SMALL = 'small',
  /** Pond animals - Fish, frogs */
  POND = 'pond',
}

/**
 * Animal states for behavior state machine.
 */
export enum AnimalState {
  /** Idle/standing - no particular behavior */
  IDLE = 'idle',
  /** Walking/moving randomly */
  WANDERING = 'wandering',
  /** Eating grass/feed */
  GRAZING = 'grazing',
  /** Running away from threat */
  FLEEING = 'fleeing',
  /** Moving toward target */
  APPROACHING = 'approaching',
  /** Following another animal/leader */
  FOLLOWING = 'following',
  /** Herding behavior (dogs) */
  HERDING = 'herding',
  /** Barking at animals */
  BARKING = 'barking',
  /** Sleeping/resting */
  SLEEPING = 'sleeping',
  /** Playing/running happily */
  PLAYING = 'playing',
  /** Stuck or blocked */
  STUCK = 'stuck',
  /** Dead/removed from simulation */
  DEAD = 'dead',
}

/**
 * Dog commands for training system.
 */
export enum DogCommand {
  /** Bark to gather attention */
  BARK = 'bark',
  /** Move to left flank of herd */
  FLANK_LEFT = 'flank_left',
  /** Move to right flank of herd */
  FLANK_RIGHT = 'flank_right',
  /** Circle around the herd */
  CIRCLE = 'circle',
  /** Bring animals toward player */
  GATHER = 'gather',
  /** Hold position and watch */
  STAY = 'stay',
  /** Return to player */
  COME = 'come',
  /** Move forward slowly */
  WALK_UP = 'walk_up',
}

/**
 * Skill levels for dog training progression.
 */
export enum DogSkillLevel {
  /** Novice - Just starting, fails often */
  NOVICE = 1,
  /** Apprentice - Can handle small groups */
  APPRENTICE = 2,
  /** Competent - Reliable with most animals */
  COMPETENT = 3,
  /** Expert - Can handle difficult situations */
  EXPERT = 4,
  /** Master - Flawless herding, teaches other dogs */
  MASTER = 5,
}

// ============================================================================
// Position and Physics Types
// ============================================================================

/**
 * 2D position for MicroVerse engine.
 */
export interface Position2D {
  x: number;
  y: number;
}

/**
 * 3D position for Luanti and OpenRTS engines.
 */
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Velocity vector for movement.
 */
export interface Velocity {
  x: number;
  y: number;
  z?: number;
}

/**
 * Rotation in degrees/yaw.
 */
export type Rotation = number;

/**
 * Bounding box for collision detection.
 */
export interface BoundingBox {
  min: Position3D;
  max: Position3D;
}

/**
 * Terrain height at a position (for 3D engines).
 */
export interface TerrainInfo {
  /** Height at this position */
  height: number;
  /** Whether this position is walkable */
  walkable: boolean;
  /** Terrain type */
  terrainType: 'grass' | 'dirt' | 'water' | 'rock' | 'sand';
  /** Slope steepness (0-1) */
  slope: number;
}

// ============================================================================
// Animal Definition Types
// ============================================================================

/**
 * Base statistics for an animal species.
 */
export interface SpeciesStats {
  /** Movement speed in units/second */
  moveSpeed: number;
  /** Flee speed when threatened */
  fleeSpeed: number;
  /** Detection radius for threats */
  detectionRadius: number;
  /** Personal space radius */
  personalSpace: number;
  /** Flocking cohesion strength (0-1) */
  cohesion: number;
  /** Alignment with neighbors (0-1) */
  alignment: number;
  /** Separation from neighbors (0-1) */
  separation: number;
  /** Weight affecting physics */
  weight: number;
  /** Size for collision */
  size: number;
  /** Energy max value */
  maxEnergy: number;
  /** Hunger max value */
  maxHunger: number;
  /** Health max value */
  maxHealth: number;
}

/**
 * Species configuration with behaviors and rendering info.
 */
export interface SpeciesConfig {
  /** Unique species identifier */
  id: string;
  /** Display name */
  name: string;
  /** Category for grouping */
  category: SpeciesCategory;
  /** Base statistics */
  stats: SpeciesStats;
  /** Supported AI stages */
  supportedStages: AIComplexityStage[];
  /** Asset paths by engine tier */
  assets: {
    [key in EngineTier]?: {
      sprite?: string;
      model?: string;
      materials?: string[];
      animations?: {
        [key: string]: string;
      };
    };
  };
  /** Behavior-specific properties */
  behaviors: {
    /** Whether this species forms herds/flocks */
    isHerding: boolean;
    /** Whether this species can be herded by dogs */
    herdableByDog: boolean;
    /** Preferred group size */
    preferredGroupSize: number;
    /** Maximum group size before stress */
    maxGroupSize: number;
    /** Flee reaction time (seconds) */
    fleeReactionTime: number;
    /** Training target difficulty (for dogs) */
    trainingDifficulty: number;
  };
  /** Production values (for ranch economy) */
  production?: {
    /** Resource produced */
    resource: string;
    /** Production interval (ms) */
    interval: number;
    /** Amount per production */
    amount: number;
  };
}

// ============================================================================
// Animal Instance Types
// ============================================================================

/**
 * Memory of an event for animal learning.
 */
export interface AnimalMemory {
  /** Type of memory */
  type: 'threat' | 'food' | 'safe_zone' | 'herd_mate' | 'player';
  /** Position of memory */
  position: Position3D;
  /** Strength of memory (0-1, decays over time) */
  strength: number;
  /** Timestamp when created */
  timestamp: number;
  /** Associated entity ID */
  entityId?: string;
}

/**
 * Need values for animal motivation.
 */
export interface AnimalNeeds {
  /** Hunger (0 = full, 1 = starving) */
  hunger: number;
  /** Energy (0 = rested, 1 = exhausted) */
  energy: number;
  /** Thirst (0 = hydrated, 1 = dehydrated) */
  thirst: number;
  /** Social (0 = content, 1 = lonely) */
  social: number;
  /** Fear (0 = calm, 1 = terrified) */
  fear: number;
  /** Stress (0 = relaxed, 1 = stressed) */
  stress: number;
}

/**
 * An individual animal in the simulation.
 */
export interface Animal {
  /** Unique animal ID */
  id: string;
  /** Species ID */
  speciesId: string;
  /** Species configuration (cached) */
  species?: SpeciesConfig;
  /** Current engine tier */
  engineTier: EngineTier;
  /** Current position */
  position: Position3D;
  /** Current velocity */
  velocity: Velocity;
  /** Current rotation (yaw) */
  rotation: Rotation;
  /** Current state */
  state: AnimalState;
  /** Current needs */
  needs: AnimalNeeds;
  /** Short-term memories */
  memories: AnimalMemory[];
  /** Current AI complexity stage */
  aiStage: AIComplexityStage;
  /** Age in simulation ticks */
  age: number;
  /** Health (0-max) */
  health: number;
  /** Unique traits (genetic variation) */
  traits: AnimalTrait[];
  /** Owner/user ID */
  ownerId?: string;
  /** Herd/group ID */
  herdId?: string;
  /** Last update timestamp */
  lastUpdate: number;
  /** Whether spawned in world */
  spawned: boolean;
  /** Target entity ID (if approaching/following) */
  targetId?: string;
  /** Current behavior priority (0-1) */
  behaviorPriority: number;
}

/**
 * Genetic traits for animal individuality.
 */
export interface AnimalTrait {
  /** Trait identifier */
  id: string;
  /** Trait name */
  name: string;
  /** Stat modifier (statName: modifier) */
  modifiers: {
    [stat: string]: number;
  };
  /** Display color */
  color?: string;
}

/**
 * Animal spawn configuration.
 */
export interface AnimalSpawnConfig {
  /** Species ID */
  speciesId: string;
  /** Position override */
  position?: Position3D;
  /** Specific traits to apply */
  traits?: string[];
  /** Age override */
  age?: number;
  /** Owner ID */
  ownerId?: string;
  /** Herd ID to join */
  herdId?: string;
}

// ============================================================================
// Dog Training Types
// ============================================================================

/**
 * Individual dog skill tracking.
 */
export interface DogSkill {
  /** The command/skill */
  command: DogCommand;
  /** Current skill level */
  level: DogSkillLevel;
  /** Experience points (0-100 per level) */
  experience: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Times used */
  timesUsed: number;
  /** Times succeeded */
  timesSucceeded: number;
  /** Last practice timestamp */
  lastPracticed: number;
}

/**
 * A herding dog instance.
 */
export interface HerdingDog extends Animal {
  /** Dog-specific properties */
  dog: {
    /** Name */
    name: string;
    /** Coat color */
    coatColor: string;
    /** Skills by command */
    skills: {
      [key in DogCommand]?: DogSkill;
    };
    /** Overall skill level */
    overallLevel: DogSkillLevel;
    /** Total experience */
    totalExperience: number;
    /** Commands mastered */
    commandsMastered: number;
    /** Current command being executed */
    currentCommand?: DogCommand;
    /** Command target position */
    commandTarget?: Position3D;
    /** Stamina for working (0-1) */
    stamina: number;
    /** Focus level (0-1, affected by distractions) */
    focus: number;
    /** Bond with player (0-1) */
    bond: number;
    /** Lifetime animals herded */
    animalsHerded: number;
    /** Successful herding sessions */
    successfulSessions: number;
  };
}

/**
 * Training session for dog skill improvement.
 */
export interface TrainingSession {
  /** Session ID */
  id: string;
  /** Dog ID */
  dogId: string;
  /** Animal(s) being trained on */
  targetAnimals: string[];
  /** Command being practiced */
  command: DogCommand;
  /** Start timestamp */
  startTime: number;
  /** End timestamp (0 if active) */
  endTime: number;
  /** Whether session was successful */
  successful?: boolean;
  /** Experience gained */
  experienceGained: number;
  /** Mistakes made during session */
  mistakes: number;
  /** Session notes */
  notes: string[];
}

/**
 * Training targets for puppy practice.
 */
export interface TrainingTarget {
  /** Species used for training */
  speciesId: string;
  /** Difficulty modifier (0-2, 1 = baseline) */
  difficulty: number;
  /** Experience multiplier */
  xpMultiplier: number;
  /** Maximum skill level trainable with this target */
  maxSkillLevel: DogSkillLevel;
  /** Recommended group size */
  recommendedGroupSize: number;
}

// ============================================================================
// Herd Types
// ============================================================================

/**
 * A group of animals moving together.
 */
export interface Herd {
  /** Unique herd ID */
  id: string;
  /** Display name */
  name: string;
  /** Species ID (all animals in herd are same species) */
  speciesId: string;
  /** Animal IDs in this herd */
  animals: string[];
  /** Herd center position */
  center: Position3D;
  /** Herd velocity (average of members) */
  velocity: Velocity;
  /** Current herd state */
  state: 'grazing' | 'moving' | 'fleeing' | 'scattered';
  /** Herd cohesion (0-1) */
  cohesion: number;
  /** Designated leader ID */
  leaderId?: string;
  /** Herd territory bounds */
  territory?: {
    center: Position3D;
    radius: number;
  };
  /** Owner ID */
  ownerId?: string;
  /** Created timestamp */
  createdAt: number;
}

/**
 * Flocking behavior weights for boids algorithm.
 */
export interface FlockingWeights {
  /** Cohesion - move toward group center */
  cohesion: number;
  /** Alignment - match velocity of neighbors */
  alignment: number;
  /** Separation - avoid crowding neighbors */
  separation: number;
  /** Goal seeking - move toward target */
  goal: number;
  /** Avoidance - avoid threats/obstacles */
  avoidance: number;
}

// ============================================================================
// Ranch State Types
// ============================================================================

/**
 * Ranch configuration and progress.
 */
export interface RanchState {
  /** Ranch ID */
  id: string;
  /** Owner/user ID */
  ownerId: string;
  /** Ranch name */
  name: string;
  /** Current engine tier */
  engineTier: EngineTier;
  /** Current AI complexity stage */
  aiStage: AIComplexityStage;
  /** Ranch dimensions */
  dimensions: {
    width: number;
    height: number;
    depth?: number;
  };
  /** Spawned animals */
  animals: {
    [id: string]: Animal;
  };
  /** Herds */
  herds: {
    [id: string]: Herd;
  };
  /** Dogs owned */
  dogs: string[];
  /** Unlocked features */
  unlockedFeatures: {
    /** Dog training unlocked */
    dogTraining: boolean;
    /** Herd animals unlocked */
    herdAnimals: boolean;
    /** Advanced herding unlocked */
    advancedHerding: boolean;
    /** Terrain features unlocked */
    terrainFeatures: boolean;
  };
  /** Ranch resources/economy */
  resources: {
    /** Grass quality (0-1) */
    grassQuality: number;
    /** Water level (0-1) */
    waterLevel: number;
    /** Fence integrity (0-1) */
    fenceIntegrity: number;
  };
  /** Statistics */
  stats: {
    /** Total animals raised */
    animalsRaised: number;
    /** Training sessions completed */
    trainingSessions: number;
    /** Ranch establishment date */
    establishedAt: number;
    /** Last simulation update */
    lastUpdate: number;
  };
  /** Save version for migration */
  version: string;
}

/**
 * Ranch save data for persistence.
 */
export interface RanchSaveData {
  /** Ranch state to save */
  ranch: RanchState;
  /** Additional metadata */
  metadata: {
    savedAt: number;
    version: string;
    checksum: string;
  };
}

// ============================================================================
// Simulation Types
// ============================================================================

/**
 * Simulation delta time info.
 */
export interface SimulationDelta {
  /** Time since last update (ms) */
  deltaTime: number;
  /** Current simulation time */
  currentTime: number;
  /** Time scale (1 = real-time) */
  timeScale: number;
}

/**
 * Collision result for physics.
 */
export interface CollisionResult {
  /** Whether collision occurred */
  collided: boolean;
  /** Collision normal */
  normal?: Velocity;
  /** Penetration depth */
  penetration?: number;
  /** Other entity ID */
  otherId?: string;
}

/**
 * Obstacle in the ranch.
 */
export interface Obstacle {
  /** Obstacle ID */
  id: string;
  /** Type of obstacle */
  type: 'fence' | 'gate' | 'tree' | 'rock' | 'water' | 'building';
  /** Bounding box */
  bounds: BoundingBox;
  /** Whether animals can pass through */
  passable: boolean;
  /** Gate state (if gate) */
  gateState?: 'open' | 'closed' | 'locked';
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to update animal AI.
 */
export interface UpdateAnimalAIRequest {
  /** Ranch ID */
  ranchId: string;
  /** Animal IDs to update (empty = all) */
  animalIds?: string[];
  /** Simulation delta */
  delta: SimulationDelta;
  /** Terrain data (for 3D) */
  terrain?: {
    getPosition?: (pos: Position3D) => TerrainInfo;
  };
  /** Obstacles in scene */
  obstacles?: Obstacle[];
  /** Player position (for reactions) */
  playerPosition?: Position3D;
}

/**
 * Response from animal AI update.
 */
export interface UpdateAnimalAIResponse {
  /** Updated animals */
  animals: {
    [id: string]: {
      id: string;
      position: Position3D;
      state: AnimalState;
      velocity: Velocity;
    };
  };
  /** Herd updates */
  herds: {
    [id: string]: {
      id: string;
      center: Position3D;
      state: Herd['state'];
    };
  };
  /** Processing time */
  processingTime: number;
}

/**
 * Request to spawn animals.
 */
export interface SpawnAnimalsRequest {
  /** Ranch ID */
  ranchId: string;
  /** Spawn configurations */
  spawns: AnimalSpawnConfig[];
}

/**
 * Response from spawn request.
 */
export interface SpawnAnimalsResponse {
  /** Spawned animal IDs */
  animalIds: string[];
  /** Any failures */
  failures: {
    config: AnimalSpawnConfig;
    reason: string;
  }[];
}

/**
 * Request to give dog command.
 */
export interface DogCommandRequest {
  /** Ranch ID */
  ranchId: string;
  /** Dog ID */
  dogId: string;
  /** Command to give */
  command: DogCommand;
  /** Target position (if applicable) */
  target?: Position3D;
  /** Target herd/animal IDs */
  targetAnimals?: string[];
}

/**
 * Response from dog command.
 */
export interface DogCommandResponse {
  /** Whether command was accepted */
  accepted: boolean;
  /** Dog response */
  dogResponse: {
    id: string;
    state: AnimalState;
    currentCommand?: DogCommand;
  };
  /** Expected duration (ms) */
  expectedDuration?: number;
}

/**
 * Request to start training session.
 */
export interface StartTrainingRequest {
  /** Ranch ID */
  ranchId: string;
  /** Dog ID */
  dogId: string;
  /** Command to practice */
  command: DogCommand;
  /** Training targets to spawn/use */
  targets: {
    speciesId: string;
    count: number;
  }[];
}

/**
 * Response from training start.
 */
export interface StartTrainingResponse {
  /** Training session ID */
  sessionId: string;
  /** Spawned training animals */
  animalIds: string[];
  /** Estimated difficulty */
  difficulty: number;
  /** Experience available */
  experienceAvailable: number;
}

/**
 * Request to progress to next AI stage.
 */
export interface ProgressStageRequest {
  /** Ranch ID */
  ranchId: string;
  /** Target stage */
  targetStage: AIComplexityStage;
  /** Force progression (skip requirements) */
  force?: boolean;
}

/**
 * Response from stage progression.
 */
export interface ProgressStageResponse {
  /** New stage */
  newStage: AIComplexityStage;
  /** Unlocked features */
  unlockedFeatures: string[];
  /** Requirements met */
  requirementsMet: boolean;
  /** Warnings or missing requirements */
  warnings?: string[];
}

/**
 * Quality-scaled AI configuration.
 */
export interface QualityScaledAI {
  /** Engine tier */
  tier: EngineTier;
  /** AI update interval (ms) */
  updateInterval: number;
  /** Max animals per update batch */
  batchSize: number;
  /** Flocking enabled */
  flockingEnabled: boolean;
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
// Event Types
// ============================================================================

/**
 * Ranch event for logging/tracking.
 */
export interface RanchEvent {
  /** Event ID */
  id: string;
  /** Event type */
  type: 'animal_spawned' | 'animal_died' | 'training_complete' | 'stage_unlocked' | 'herd_formed';
  /** Ranch ID */
  ranchId: string;
  /** Timestamp */
  timestamp: number;
  /** Event data */
  data: {
    [key: string]: unknown;
  };
}

/**
 * Animal state change event.
 */
export interface AnimalStateChangeEvent {
  /** Animal ID */
  animalId: string;
  /** Previous state */
  previousState: AnimalState;
  /** New state */
  newState: AnimalState;
  /** Reason for change */
  reason: string;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default simulation values.
 */
export const SIMULATION_DEFAULTS = {
  /** Default update tick rate (ms) */
  TICK_RATE: 50,
  /** Memory decay rate per second */
  MEMORY_DECAY_RATE: 0.1,
  /** Default personal space radius */
  PERSONAL_SPACE: 2.0,
  /** Default detection radius */
  DETECTION_RADIUS: 10.0,
  /** Default flocking radius */
  FLOCKING_RADIUS: 5.0,
  /** Default cohesion weight */
  COHESION_WEIGHT: 0.5,
  /** Default alignment weight */
  ALIGNMENT_WEIGHT: 0.5,
  /** Default separation weight */
  SEPARATION_WEIGHT: 1.0,
  /** Default goal weight */
  GOAL_WEIGHT: 0.8,
  /** Default avoidance weight */
  AVOIDANCE_WEIGHT: 2.0,
} as const;

/**
 * Quality tier configurations for AI scaling.
 */
export const QUALITY_AI_CONFIGS: Record<EngineTier, QualityScaledAI> = {
  [EngineTier.MICROVERSE_2D]: {
    tier: EngineTier.MICROVERSE_2D,
    updateInterval: 100,
    batchSize: 50,
    flockingEnabled: false,
    memorySlots: 3,
    perceptionMultiplier: 0.5,
    pathfindingEnabled: false,
    terrainAwareness: false,
  },
  [EngineTier.LUANTI_BLOCKY]: {
    tier: EngineTier.LUANTI_BLOCKY,
    updateInterval: 50,
    batchSize: 30,
    flockingEnabled: true,
    memorySlots: 8,
    perceptionMultiplier: 0.8,
    pathfindingEnabled: true,
    terrainAwareness: false,
  },
  [EngineTier.OPENRTS_3D]: {
    tier: EngineTier.OPENRTS_3D,
    updateInterval: 33,
    batchSize: 20,
    flockingEnabled: true,
    memorySlots: 16,
    perceptionMultiplier: 1.0,
    pathfindingEnabled: true,
    terrainAwareness: true,
  },
};
