/**
 * Fishing Simulation - Type Definitions
 *
 * Core types for the progressive fishing simulation system supporting
 * MicroVerse (2D), Luanti (Voxel), and OpenRTS (3D) engine tiers.
 */

// ============================================================================
// ENGINE TIER ENUMERATIONS
// ============================================================================

/**
 * Quality tiers for progressive rendering complexity
 */
export enum EngineTier {
  /** 2D top-down view with simple sprites */
  MICROVERSE = 'microverse',
  /** Voxel-based isometric view with blocky water */
  LUANTI = 'luanti',
  /** Full 3D with realistic water physics, waves, and reflections */
  OPENRTS = 'openrts'
}

/**
 * Rendering quality presets per tier
 */
export interface RenderQuality {
  tier: EngineTier;
  maxParticles: number;
  waterVertices: number;
  fishDetailLevel: 'low' | 'medium' | 'high';
  shadowQuality: 'none' | 'blob' | 'cascaded';
  reflectionQuality: 'none' | 'simple' | 'screen-space' | 'planar';
  waveComplexity: number; // 0-1
  foamParticles: boolean;
  underwaterCaustics: boolean;
}

export const RENDER_QUALITY_PRESETS: Record<EngineTier, RenderQuality> = {
  [EngineTier.MICROVERSE]: {
    tier: EngineTier.MICROVERSE,
    maxParticles: 100,
    waterVertices: 100,
    fishDetailLevel: 'low',
    shadowQuality: 'none',
    reflectionQuality: 'none',
    waveComplexity: 0.1,
    foamParticles: false,
    underwaterCaustics: false
  },
  [EngineTier.LUANTI]: {
    tier: EngineTier.LUANTI,
    maxParticles: 500,
    waterVertices: 500,
    fishDetailLevel: 'medium',
    shadowQuality: 'blob',
    reflectionQuality: 'simple',
    waveComplexity: 0.4,
    foamParticles: true,
    underwaterCaustics: false
  },
  [EngineTier.OPENRTS]: {
    tier: EngineTier.OPENRTS,
    maxParticles: 5000,
    waterVertices: 10000,
    fishDetailLevel: 'high',
    shadowQuality: 'cascaded',
    reflectionQuality: 'planar',
    waveComplexity: 1.0,
    foamParticles: true,
    underwaterCaustics: true
  }
};

// ============================================================================
// VECTOR TYPES
// ============================================================================

/**
 * 2D vector for MicroVerse tier
 */
export interface Vector2 {
  x: number;
  y: number;
}

/**
 * 3D vector for Luanti and OpenRTS tiers
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Quaternion for 3D rotations
 */
export interface Quaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ============================================================================
// FISH TYPES
// ============================================================================

/**
 * Fish species categories
 */
export enum FishCategory {
  PANFISH = 'panfish',        // Bluegill, crappie, perch
  GAME_FISH = 'game_fish',    // Bass, trout, walleye
  PREDATORY = 'predatory',    // Pike, muskie
  CATFISH = 'catfish',        // Channel, flathead, blue
  SALMONID = 'salmonid',      // Salmon, steelhead, char
  RARE = 'rare',              // Sturgeon, paddlefish
  TROPHY = 'trophy'           // Record-sized specimens
}

/**
 * Rarity affects catch probability and base value
 */
export enum FishRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

/**
 * Time of day when fish are most active
 */
export enum ActivityPattern {
  DAWN = 'dawn',              // 5-7 AM
  DAY = 'day',                // 9 AM - 4 PM
  DUSK = 'dusk',              // 6-8 PM
  NIGHT = 'night',            // 9 PM - 4 AM
  ALL_DAY = 'all_day',
  TWILIGHT = 'twilight'       // Dawn + Dusk
}

/**
 * Preferred depth zone
 */
export enum DepthZone {
  SURFACE = 'surface',        // 0-3 ft
  SHALLOW = 'shallow',        // 3-10 ft
  MID = 'mid',                // 10-30 ft
  DEEP = 'deep',              // 30-60 ft
  ABYSSAL = 'abyssal'         // 60+ ft
}

/**
 * Seasonal availability
 */
export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  FALL = 'fall',
  WINTER = 'winter',
  ALL_YEAR = 'all_year'
}

/**
 * Individual fish instance state
 */
export interface Fish {
  id: string;
  species: string;
  category: FishCategory;
  rarity: FishRarity;

  // Physical properties
  length: number;             // inches
  weight: number;             // pounds
  age: number;                // years

  // Position (tier-dependent)
  position2D: Vector2;        // MicroVerse
  position3D: Vector3;        // Luanti/OpenRTS
  velocity: Vector3;

  // Behavior state
  behavior: FishBehavior;
  activityLevel: number;      // 0-1, affects bite chance
  hungerLevel: number;        // 0-1
  stressLevel: number;        // 0-1, increases when hooked

  // AI properties
  schoolId: string | null;
  isLeader: boolean;
  biteProbability: number;    // Base bite chance
  fightStrength: number;      // 0-1, affects reel difficulty

  // Metadata
  spawnedAt: number;          // timestamp
  caughtBy: string | null;    // player ID or null
  timestamp?: number;         // catch timestamp
}

/**
 * Current fish behavior state
 */
export enum FishBehavior {
  IDLE = 'idle',
  CRUISING = 'cruising',
  FEEDING = 'feeding',
  FLEEING = 'fleeing',
  HOOKED = 'hooked',
  SCHOOLING = 'schooling',
  SPAWNING = 'spawning',
  RESTING = 'resting',
  INVESTIGATING = 'investigating'
}

/**
 * Fish species definition
 */
export interface FishSpecies {
  id: string;
  name: string;
  scientificName: string;
  category: FishCategory;
  rarity: FishRarity;

  // Size ranges
  minLength: number;
  maxLength: number;
  minWeight: number;
  maxWeight: number;
  maxAge: number;

  // Behavior
  activityPattern: ActivityPattern;
  preferredDepth: DepthZone;
  preferredTemp: { min: number; max: number }; // Fahrenheit
  schoolSize: { min: number; max: number };
  baseFightStrength: number;

  // Seasonal
  activeSeasons: Season[];
  spawnSeason: Season;

  // Catch mechanics
  biteWindow: number;         // seconds
  baseBiteChance: number;     // 0-1 per tick when active
  preferredLures: string[];

  // Educational (StudyLoG integration)
  description: string;
  habitat: string;
  diet: string;
  conservation: string;
  funFact: string;

  // Visual
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  spriteRef: string;          // Asset reference per tier
}

// ============================================================================
// FISHING EQUIPMENT TYPES
// ============================================================================

/**
 * Fishing rod power rating
 */
export enum RodPower {
  ULTRALIGHT = 'ultralight',
  LIGHT = 'light',
  MEDIUM = 'medium',
  MEDIUM_HEAVY = 'medium_heavy',
  HEAVY = 'heavy',
  EXTRA_HEAVY = 'extra_heavy'
}

/**
 * Rod action (flex profile)
 */
export enum RodAction {
  SLOW = 'slow',              // Bends throughout
  MODERATE = 'moderate',      // Bends through upper half
  FAST = 'fast',              // Bends at tip
  EXTRA_FAST = 'extra_fast'   // Bends only at tip
}

/**
 * Reel types
 */
export enum ReelType {
  SPINNING = 'spinning',
  BAITCASTING = 'baitcasting',
  SPINCAST = 'spincast',
  FLY = 'fly',
  CENTERPIN = 'centerpin'
}

/**
 * Lure categories
 */
export enum LureCategory {
  CRANKBAIT = 'crankbait',
  JIG = 'jig',
  SOFT_PLASTIC = 'soft_plastic',
  SPOON = 'spoon',
  SPINNER = 'spinner',
  TOPWATER = 'topwater',
  SWIMBAIT = 'swimbait',
  FLY = 'fly',
  LIVE_BAIT = 'live_bait'
}

/**
 * Lure retrieval action
 */
export enum LureAction {
  STEADY = 'steady',
  TWITCH = 'twitch',
  JERK = 'jerk',
  HOP = 'hop',
  DEADSTICK = 'deadstick',
  BURN = 'burn'               // Fast retrieve
}

/**
 * Fishing line material
 */
export enum LineMaterial {
  MONOFILAMENT = 'monofilament',
  FLUOROCARBON = 'fluorocarbon',
  BRAID = 'braid',
  FLY_LINE = 'fly_line'
}

/**
 * Complete fishing rod setup
 */
export interface FishingRod {
  id: string;
  name: string;
  power: RodPower;
  action: RodAction;
  length: number;             // feet
  lineRating: { min: number; max: number }; // lbs test

  // Visual properties
  color: string;
  material: string;
  quality: number;            // 0-1, affects durability
}

/**
 * Fishing reel
 */
export interface FishingReel {
  id: string;
  name: string;
  type: ReelType;
  gearRatio: number;          // e.g., 6.2:1
  lineCapacity: {
    [LineMaterial.MONOFILAMENT]: { test: number; yards: number };
  };
  maxDrag: number;            // lbs
  ballBearings: number;

  quality: number;            // 0-1
}

/**
 * Fishing line
 */
export interface FishingLine {
  material: LineMaterial;
  test: number;               // breaking strength in lbs
  diameter: string;           // e.g., "0.30mm"
  length: number;             // yards
  color: string;

  currentLength: number;      // remaining length
}

/**
 * Lure or bait
 */
export interface Lure {
  id: string;
  name: string;
  category: LureCategory;
  weight: number;             // ounces
  length: number;             // inches
  depth: { min: number; max: number }; // running depth

  // Visual
  color: string;
  pattern: string;

  // Action
  action: LureAction;
  actionProfile: string;      // description of movement

  // Attraction
  vibration: number;          // 0-1
  flash: number;              // 0-1
  scent: number;              // 0-1 (for baits)

  // Species effectiveness
  effectiveness: Record<string, number>; // speciesId -> 0-1

  quantity: number;
}

/**
 * Complete fishing setup
 */
export interface FishingSetup {
  rod: FishingRod;
  reel: FishingReel;
  line: FishingLine;
  leader: FishingLine | null;
  lure: Lure;

  // Derived stats
  castingDistance: number;    // max cast distance
  hookStrength: number;       // 0-1
}

// ============================================================================
// FISHING MECHANICS TYPES
// ============================================================================

/**
 * Current cast state
 */
export interface CastState {
  isActive: boolean;
  phase: CastPhase;

  // Position
  position: Vector3;
  targetPosition: Vector3;

  // Physics
  velocity: Vector3;
  distance: number;
  height: number;

  // Line
  lineOut: number;
  lineTension: number;        // 0-1

  // Timing
  castAt: number;
  landAt?: number;
}

/**
 * Phases of a cast
 */
export enum CastPhase {
  PREPARING = 'preparing',
  CASTING = 'casting',
  AIRBORNE = 'airborne',
  LANDING = 'landing',
  RETRIEVING = 'retrieving',
  HOOKED = 'hooked',
  LANDING_FISH = 'landing_fish',
  COMPLETE = 'complete'
}

/**
 * Hook state when fish is on
 */
export interface HookState {
  fishId: string;
  hookSet: boolean;
  hookDepth: number;          // how well set
  fishPosition: Vector3;
  linePressure: number;       // 0-1

  // Fish behavior while hooked
  fishBehavior: HookedFishBehavior;

  // Player input
  isReeling: boolean;
  reelSpeed: number;
  drag: number;               // 0-1

  // Fatigue
  fishFatigue: number;        // 0-1, increases during fight
  lineHealth: number;         // 0-1, decreases if too much tension
}

/**
 * Fish behavior while hooked
 */
export enum HookedFishBehavior {
  RUN = 'run',                // Strong sustained run
  JUMP = 'jump',              // Attempt to throw hook
  DIVE = 'dive',              // Go deep
  SHAKE = 'shake',            // Head shake
  ROLL = 'roll',              // Alligator roll (catfish/pike)
  TAIL_WALK = 'tail_walk',    // Surface charge
  SULG = 'sulk'               // Dead weight
}

/**
 Bite detection state
 */
export interface BiteIndicator {
  hasBite: boolean;
  confidence: number;         // 0-1
  biteType: BiteType;
  strength: number;           // 0-1
  position: Vector3;
}

/**
 * Types of bites
 */
export enum BiteType {
  TAP = 'tap',                // Light tap, hesitate
  THUMP = 'thump',            // Solid hit
  PECK = 'peck',              // Rapid light bites
  SLAM = 'slam',              // Aggressive hit
  SUCKER = 'sucker',          // Steady pull (catfish)
  RING = 'ring'               // Trout "taking" indicator
}

// ============================================================================
// WATER PHYSICS TYPES
// ============================================================================

/**
 * Water body type
 */
export enum WaterBodyType {
  POND = 'pond',
  LAKE = 'lake',
  RIVER = 'river',
  STREAM = 'stream',
  OCEAN = 'ocean',
  RESERVOIR = 'reservoir',
  SWAMP = 'swamp',
  CANAL = 'canal'
}

/**
 * Water clarity affects lure visibility
 */
export enum WaterClarity {
  MURKY = 'murky',            // < 1 ft visibility
  STAINED = 'stained',        // 1-3 ft
  CLEAR = 'clear',            // 3-6 ft
  VERY_CLEAR = 'very_clear',  // 6-15 ft
  CRYSTAL = 'crystal'         // 15+ ft
}

/**
 * Current strength
 */
export enum CurrentStrength {
  STILL = 'still',
  SLIGHT = 'slight',
  MODERATE = 'moderate',
  STRONG = 'strong',
  DANGEROUS = 'dangerous'
}

/**
 * Water simulation state
 */
export interface WaterState {
  // Properties
  type: WaterBodyType;
  clarity: WaterClarity;
  depth: number;              // max depth in feet
  surfaceArea: number;        // square feet

  // Physics
  temperature: number;        // Fahrenheit at surface
  thermoclineDepth: number;   // depth of temp change
  current: {
    direction: Vector3;
    strength: CurrentStrength;
    speed: number;            // ft/s
  };

  // Wave simulation (tier-dependent)
  waves: {
    amplitude: number;        // wave height
    frequency: number;        // wave speed
    direction: Vector3;
    chop: number;             // randomness factor
  };

  // Simulation data
  vertices: WaveVertex[];     // For OpenRTS
  foamParticles: FoamParticle[];
}

/**
 * Single wave vertex for simulation
 */
export interface WaveVertex {
  position: Vector3;
  height: number;
  velocity: number;
  targetHeight: number;
}

/**
 * Foam/bubble particle
 */
export interface FoamParticle {
  position: Vector3;
  velocity: Vector3;
  life: number;               // 0-1
  size: number;
}

// ============================================================================
// LOCATION TYPES
// ============================================================================

/**
 * Fishing location structure
 */
export interface FishingLocation {
  id: string;
  name: string;
  type: WaterBodyType;

  // Geography
  position: Vector3;
  size: number;               // acres

  // Water properties
  depth: number;
  clarity: WaterClarity;
  temperature: number;
  current: CurrentStrength;

  // Quality tier support
  supportedTiers: EngineTier[];

  // Fishing spots
  spots: FishingSpot[];

  // Available fish
  fishSpecies: string[];      // species IDs

  // Features
  features: LocationFeature[];
  structures: Structure[];
  vegetation: Vegetation[];

  // Access
  accessPoints: AccessPoint[];
  boatLaunch: boolean;
  shoreAccess: boolean;

  // Metadata
  region: string;
  description: string;
  bestSeasons: Season[];
  pressure: number;           // 0-1, fishing pressure
}

/**
 * Specific fishing spot within a location
 */
export interface FishingSpot {
  id: string;
  name: string;
  position: Vector3;

  // Depth profile
  depth: number;
  dropoff: boolean;
  underwater: boolean;

  // Features
  cover: CoverType[];
  structure: boolean;
  vegetation: boolean;

  // Fish attraction
  attractiveness: number;     // 0-1 base attraction
  activeFish: string[];       // fish IDs currently here

  // Time-based
  peakTimes: ActivityPattern[];
  peakSeasons: Season[];
}

/**
 * Types of fish cover
 */
export enum CoverType {
  WEEDS = 'weeds',
  LILY_PADS = 'lily_pads',
  DOWNED_TREES = 'downed_trees',
  ROCKS = 'rocks',
  DOCKS = 'docks',
  BRIDGE_PILINGS = 'bridge_pilings',
  OVERHANGING = 'overhanging',
  SUBMERGED_GRASS = 'submerged_grass'
}

/**
 * Structure in water
 */
export interface Structure {
  id: string;
  type: string;
  position: Vector3;
  size: Vector3;
  fishHold: number;           // 0-1, fish holding likelihood
}

/**
 * Aquatic vegetation
 */
export interface Vegetation {
  type: string;
  position: Vector3;
  density: number;            // 0-1
  height: number;
}

/**
 * Location feature
 */
export interface LocationFeature {
  type: string;
  position: Vector3;
  description: string;
}

/**
 * Access point for fishing
 */
export interface AccessPoint {
  id: string;
  name: string;
  position: Vector3;
  type: 'shore' | 'boat_launch' | 'dock' | 'pier';
  available: boolean;
}

// ============================================================================
// WEATHER TYPES
// ============================================================================

/**
 * Weather conditions affecting fishing
 */
export interface WeatherState {
  // Current
  condition: WeatherCondition;
  temperature: number;        // Fahrenheit
  humidity: number;           // 0-100%

  // Wind
  wind: {
    direction: number;        // degrees
    speed: number;            // mph
    gust: number;             // mph
  };

  // Precipitation
  precipitation: {
    type: 'none' | 'rain' | 'snow' | 'storm';
    intensity: number;        // 0-1
  };

  // Sky
  cloudCover: number;         // 0-1, 0=clear, 1=overcast
  barometricPressure: number; // inHg
  pressureTrend: 'rising' | 'falling' | 'steady';

  // Light
  uvIndex: number;
  visibility: number;         // miles

  // Forecast
  forecast: WeatherForecast[];

  // Fishing impact
  fishActivity: number;       // 0-1, calculated modifier
  biteQuality: number;        // 0-1
}

/**
 * Weather condition types
 */
export enum WeatherCondition {
  SUNNY = 'sunny',
  PARTLY_CLOUDY = 'partly_cloudy',
  CLOUDY = 'cloudy',
  OVERCAST = 'overcast',
  RAIN = 'rain',
  THUNDERSTORM = 'thunderstorm',
  SNOW = 'snow',
  FOG = 'fog'
}

/**
 * Weather forecast entry
 */
export interface WeatherForecast {
  time: number;               // timestamp
  condition: WeatherCondition;
  temperature: number;
  wind: { speed: number; direction: number };
  precipitation: { type: string; intensity: number };
}

// ============================================================================
// CATCH & INVENTORY TYPES
// ============================================================================

/**
 * Caught fish record
 */
export interface CatchRecord {
  id: string;
  fishId: string;
  species: string;

  // Stats
  length: number;
  weight: number;
  age: number;

  // Catch info
  caughtAt: number;
  location: string;
  spot: string;
  depth: number;

  // Equipment used
  rod: string;
  reel: string;
  lure: string;

  // Conditions
  weather: WeatherCondition;
  temperature: number;
  timeOfDay: string;

  // Quality
  quality: CatchQuality;
  isPersonalBest: boolean;
  isRecord: boolean;

  // Photo/Metadata
  photo?: string;
  notes?: string;
  released: boolean;
  tagged: boolean;
}

/**
 * Catch quality rating
 */
export enum CatchQuality {
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  EXCELLENT = 'excellent',
  TROPHY = 'trophy'
}

/**
 * Player inventory
 */
export interface PlayerInventory {
  ownerId: string;

  // Equipment
  rods: FishingRod[];
  reels: FishingReel[];
  lines: FishingLine[];
  lures: Lure[];

  // Current setup
  currentSetup: FishingSetup;

  // Storage limits
  maxRods: number;
  maxReels: number;
  maxLures: number;

  // Currency
  currency: number;

  // Catches
  totalCatches: number;
  biggestCatch: CatchRecord | null;
  speciesCaught: Set<string>;

  // Achievements
  achievements: Achievement[];
}

/**
 * Achievement/badge
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  progress: number;
  maxProgress: number;
}

// ============================================================================
// BOIDS (FLOCKING) TYPES
// ============================================================================

/**
 * Boid simulation parameters for fish schooling
 */
export interface BoidParams {
  separation: number;         // distance to maintain
  alignment: number;          // match neighbors
  cohesion: number;           // move toward center
  perception: number;         // neighbor detection radius
  maxSpeed: number;
  maxForce: number;
}

/**
 * Flocking state for a school
 */
export interface FishSchool {
  id: string;
  species: string;
  members: string[];          // fish IDs
  leaderId: string;

  position: Vector3;
  velocity: Vector3;

  behavior: SchoolBehavior;
  targetPosition: Vector3 | null;

  spawnedAt: number;
}

/**
 * School behavior modes
 */
export enum SchoolBehavior {
  CRUISING = 'cruising',
  FEEDING = 'feeding',
  FLEEING = 'fleeing',
  RESTING = 'resting',
  DISPERSING = 'dispersing',
  GATHERING = 'gathering'
}

// ============================================================================
// EDUCATIONAL (StudyLoG) TYPES
// ============================================================================

/**
 * Educational lesson about fish/ecosystem
 */
export interface FishingLesson {
  id: string;
  title: string;
  category: 'biology' | 'ecology' | 'conservation' | 'physics' | 'technique';
  difficulty: 'beginner' | 'intermediate' | 'advanced';

  content: {
    introduction: string;
    keyPoints: string[];
    interactive: InteractiveElement[];
    quiz?: Quiz;
  };

  relatedFish: string[];
  relatedLocations: string[];

  completionReward: {
    xp: number;
    unlocks?: string[];
  };
}

/**
 * Interactive learning element
 */
export interface InteractiveElement {
  type: 'simulation' | 'visualization' | 'experiment';
  title: string;
  description: string;
  params: Record<string, unknown>;
}

/**
 * Quiz for learning verification
 */
export interface Quiz {
  questions: QuizQuestion[];
  passingScore: number;
}

/**
 * Quiz question
 */
export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// ============================================================================
// SIMULATION CONFIG
// ============================================================================

/**
 * Global simulation configuration
 */
export interface SimulationConfig {
  engineTier: EngineTier;
  renderQuality: RenderQuality;

  // Simulation speed
  timeScale: number;          // 1 = real time
  tickRate: number;           // ticks per second

  // Fish population
  maxFishPerLocation: number;
  spawnRate: number;
  despawnTime: number;

  // Physics
  gravity: number;
  waterDensity: number;

  // Gameplay
  difficulty: number;         // 0-1
  realism: number;            // 0-1 (arcade to sim)

  // Educational
  showInfo: boolean;
  lessonMode: boolean;
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Cast request
 */
export interface CastRequest {
  playerId: string;
  locationId: string;
  spotId: string;
  setup: FishingSetup;
  targetPosition?: Vector3;
  power: number;              // 0-1
}

/**
 * Cast result
 */
export interface CastResult {
  success: boolean;
  castId: string;
  position: Vector3;
  distance: number;
  estimatedDepth: number;
}

/**
 * Reel action
 */
export interface ReelAction {
  playerId: string;
  castId: string;
  speed: number;              // 0-1
  action: LureAction;
}

/**
 * Hook set action
 */
export interface HookSetAction {
  playerId: string;
  castId: string;
  power: number;              // 0-1
  timing: number;             // 0-1, how good the timing was
}

/**
 * Simulation tick event
 */
export interface TickEvent {
  timestamp: number;
  deltaTime: number;
  tickNumber: number;

  // State changes
  fishUpdates: FishUpdate[];
  weatherUpdates?: Partial<WeatherState>;
  waterUpdates?: Partial<WaterState>;

  // Events
  bites: BiteEvent[];
  catches: CatchEvent[];
  schools: SchoolEvent[];
}

/**
 * Fish state update
 */
export interface FishUpdate {
  fishId: string;
  position: Vector3;
  behavior: FishBehavior;
  schoolId: string | null;
}

/**
 * Bite event
 */
export interface BiteEvent {
  fishId: string;
  playerId: string;
  position: Vector3;
  biteType: BiteType;
  confidence: number;
  window: number;             // seconds to hook set
}

/**
 * Catch event
 */
export interface CatchEvent {
  fishId: string;
  playerId: string;
  species: string;
  length: number;
  weight: number;
  quality: CatchQuality;
  released: boolean;
}

/**
 * School event
 */
export interface SchoolEvent {
  schoolId: string;
  event: 'formed' | 'dispersed' | 'merged' | 'split';
  position: Vector3;
  species: string;
  size: number;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Fish location for rendering
 */
export interface RenderFish {
  id: string;
  species: string;
  position: Vector3;
  rotation: Quaternion;
  behavior: FishBehavior;
  isVisible: boolean;
  depth: number;
}

/**
 * Complete state snapshot for client sync
 */
export interface WorldSnapshot {
  timestamp: number;

  // Fish
  fish: RenderFish[];

  // Weather
  weather: WeatherState;

  // Water
  water: WaterState;

  // Fishing activity
  activeCasts: CastState[];
  hookedFish: HookState[];

  // Time
  timeOfDay: number;          // 0-24
  season: Season;
}
