/**
 * OpenRTS Integration - Type Definitions
 *
 * This module provides TypeScript type definitions for integrating
 * godot-open-rts (https://github.com/lampe-games/godot-open-rts)
 * with StudyLoG.AI and DMLoG.AI.
 *
 * ## Product Usage
 *
 * ### StudyLoG.AI
 * - Science lab simulations with 3D equipment
 * - Physics experiments with terrain elevation
 * - Interactive 3D learning environments
 *
 * ### DMLoG.AI
 * - Full 3D battle maps
 * - Miniature-style figure rendering
 * - Terrain-based tactical combat
 *
 * ## Quality Tier
 *
 * PS2-level 3D graphics with cloud AI offloading:
 * - Device renders graphics locally
 * - Cloud AI handles game logic/decisions
 * - Fallback to Luanti/MicroVerse on weak devices
 */

// ============================================================================
// Core Vector Types
// ============================================================================

/**
 * 3D vector for positions and directions
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 2D vector for UI and screen coordinates
 */
export interface Vector2 {
  x: number;
  y: number;
}

/**
 * Color with RGBA components
 */
export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

// ============================================================================
// Terrain Types
// ============================================================================

/**
 * Terrain heightmap data
 */
export interface TerrainHeightmap {
  /** Width of the heightmap in vertices */
  width: number;

  /** Depth of the heightmap in vertices */
  depth: number;

  /** Height values (flattened 2D array) */
  heights: Float32Array;

  /** Scale of each terrain cell */
  cellScale: Vector3;

  /** Offset of terrain origin */
  offset: Vector3;
}

/**
 * Terrain layer for texture blending
 */
export interface TerrainLayer {
  /** Layer identifier */
  id: string;

  /** Layer name */
  name: string;

  /** Albedo texture path */
  albedo: string;

  /** Normal map path (optional) */
  normal?: string;

  /** Roughness map path (optional) */
  roughness?: string;

  /** Minimum slope angle for this layer */
  minSlope: number;

  /** Maximum slope angle for this layer */
  maxSlope: number;

  /** Minimum height for this layer */
  minHeight: number;

  /** Maximum height for this layer */
  maxHeight: number;
}

/**
 * Terrain decoration (grass, rocks, trees, etc.)
 */
export interface TerrainDecoration {
  /** Type of decoration */
  type: 'grass' | 'rock' | 'tree' | 'bush' | 'custom';

  /** Scene path for the decoration mesh */
  scenePath: string;

  /** Position in world space */
  position: Vector3;

  /** Rotation (Euler angles in degrees) */
  rotation: Vector3;

  /** Scale multiplier */
  scale: number;

  /** Random variation seed */
  seed: number;
}

/**
 * Complete terrain data
 */
export interface TerrainData {
  /** Heightmap information */
  heightmap: TerrainHeightmap;

  /** Terrain layers for texture blending */
  layers: TerrainLayer[];

  /** Decorations placed on terrain */
  decorations: TerrainDecoration[];

  /** Water level (below this value is water) */
  waterLevel?: number;

  /** Terrain material properties */
  material: {
    /** UV scale for textures */
    uvScale: Vector2;

    /** Triplanar mapping enabled */
    triplanar: boolean;

    /** Texture blend sharpness */
    blendSharpness: number;
  };
}

// ============================================================================
// Unit Types
// ============================================================================

/**
 * Unit classification
 */
export type UnitClass =
  | 'infantry'
  | 'vehicle'
  | 'aircraft'
  | 'naval'
  | 'structure'
  | 'hero';

/**
 * Unit faction
 */
export type UnitFaction = 'player' | 'enemy' | 'neutral' | 'ally';

/**
 * Unit state machine states
 */
export type UnitState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'patrolling'
  | 'guarding'
  | 'producing'
  | 'constructing'
  | 'dying'
  | 'dead';

/**
 * Unit statistics
 */
export interface UnitStats {
  /** Maximum health points */
  maxHealth: number;

  /** Current health points */
  health: number;

  /** Movement speed in units/second */
  speed: number;

  /** Attack damage */
  damage: number;

  /** Attack range in units */
  range: number;

  /** Attack cooldown in seconds */
  attackCooldown: number;

  /** Armor value (damage reduction) */
  armor: number;

  /** Sight radius in units */
  sightRadius: number;

  /** Construction time in seconds */
  buildTime?: number;

  /** Cost to build */
  cost?: ResourceCost;

  /** Supply cost (for population cap) */
  supply?: number;
}

/**
 * Resource cost for units/structures
 */
export interface ResourceCost {
  /** Gold/minerals cost */
  gold: number;

  /** Wood/lumber cost */
  wood: number;

  /** Energy/power cost */
  energy: number;

  /** Time to build */
  time: number;
}

/**
 * Unit definition
 */
export interface UnitDefinition {
  /** Unique unit identifier */
  id: string;

  /** Display name */
  name: string;

  /** Unit description */
  description: string;

  /** Unit class */
  class: UnitClass;

  /** Scene path for 3D model */
  scenePath: string;

  /** Icon texture path */
  iconPath: string;

  /** Base statistics */
  stats: UnitStats;

  /** Available abilities */
  abilities: string[];

  /** Required structures to build */
  requirements: string[];

  /** Production structure (what produces this unit) */
  producedBy?: string;

  /** Size in grid cells */
  size: Vector2;

  /** Faction affiliation */
  faction: UnitFaction;

  /** Selection size (for clicking) */
  selectionRadius: number;

  /** Shadow configuration */
  shadow: {
    enabled: boolean;
    size: number;
    textureSize: number;
  };
}

/**
 * Active unit instance
 */
export interface UnitInstance {
  /** Unique instance ID */
  instanceId: string;

  /** Unit definition reference */
  definitionId: string;

  /** Current position */
  position: Vector3;

  /** Current rotation (Y-axis only in degrees) */
  rotation: number;

  /** Current state */
  state: UnitState;

  /** Current statistics (may differ from base) */
  stats: UnitStats;

  /** Current target (unit or position) */
  target?: UnitTarget;

  /** Current order queue */
  orders: UnitOrder[];

  /** Owner player ID */
  ownerId: string;

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Unit target for attacks/movement
 */
export type UnitTarget =
  | { type: 'position'; position: Vector3 }
  | { type: 'unit'; unitId: string }
  | { type: 'structure'; structureId: string };

/**
 * Unit order
 */
export type UnitOrder =
  | { type: 'move'; target: Vector3; queued: boolean }
  | { type: 'attack'; target: string; queued: boolean }
  | { type: 'patrol'; waypoints: Vector3[]; cyclic: boolean; queued: boolean }
  | { type: 'guard'; target: string; queued: boolean }
  | { type: 'hold'; queued: boolean }
  | { type: 'stop'; queued: boolean };

// ============================================================================
// Player Types
// ============================================================================

/**
 * Player state
 */
export interface PlayerState {
  /** Unique player ID */
  id: string;

  /** Player name */
  name: string;

  /** Player faction */
  faction: string;

  /** Is this the local player */
  isLocal: boolean;

  /** Is this an AI player */
  isAI: boolean;

  /** Current resources */
  resources: PlayerResources;

  /** Current population */
  population: {
    current: number;
    cap: number;
  };

  /** Player color */
  color: Color;

  /** Starting position */
  startPosition: Vector3;

  /** Is player defeated */
  isDefeated: boolean;

  /** Is player victorious */
  isVictorious: boolean;

  /** Team ID (for alliance) */
  teamId: number;
}

/**
 * Player resources
 */
export interface PlayerResources {
  /** Gold/minerals */
  gold: number;

  /** Wood/lumber */
  wood: number;

  /** Energy/power */
  energy: number;

  /** Current energy usage */
  energyUsage: number;
}

// ============================================================================
// Selection Types
// ============================================================================

/**
 * Selection group
 */
export interface SelectionGroup {
  /** Group ID (0-9 for number keys) */
  groupId: number;

  /** Unit instance IDs in this group */
  units: string[];

  /** Center position of group */
  center: Vector3;
}

/**
 * Selection state
 */
export interface SelectionState {
  /** Currently selected unit IDs */
  selectedUnits: string[];

  /** Selection box start (screen space) */
  selectionStart?: Vector2;

  /** Selection box end (screen space) */
  selectionEnd?: Vector2;

  /** Is selection active */
  isSelecting: boolean;

  /** Control groups (number keys 0-9) */
  controlGroups: Map<number, string[]>;
}

// ============================================================================
// Camera Types
// ============================================================================

/**
 * RTS Camera configuration
 */
export interface RTSCameraConfig {
  /** Camera position */
  position: Vector3;

  /** Look-at target */
  target: Vector3;

  /** Distance from target */
  distance: number;

  /** Rotation angle (degrees) */
  rotation: number;

  /** Pitch angle (degrees from horizontal) */
  pitch: number;

  /** Field of view */
  fov: number;

  /** Minimum zoom distance */
  minDistance: number;

  /** Maximum zoom distance */
  maxDistance: number;

  /** Minimum pitch angle */
  minPitch: number;

  /** Maximum pitch angle */
  maxPitch: number;

  /** Panning speed */
  panSpeed: number;

  /** Zoom speed */
  zoomSpeed: number;

  /** Rotation speed */
  rotationSpeed: number;

  /** Edge scroll margin (pixels) */
  edgeScrollMargin: number;

  /** Edge scroll enabled */
  edgeScrollEnabled: boolean;

  /** Camera bounds */
  bounds: {
    min: Vector2;
    max: Vector2;
  } | null;
}

// ============================================================================
// Pathfinding Types
// ============================================================================

/**
 * Pathfinding node
 */
export interface PathNode {
  /** Grid position */
  position: Vector2;

  /** World position (including height) */
  worldPosition: Vector3;

  /** G cost (distance from start) */
  gCost: number;

  /** H cost (heuristic to goal) */
  hCost: number;

  /** F cost (g + h) */
  fCost: number;

  /** Parent node for path reconstruction */
  parent?: PathNode;

  /** Is walkable */
  walkable: boolean;

  /** Movement cost multiplier */
  costMultiplier: number;
}

/**
 * Pathfinding result
 */
export interface PathResult {
  /** Success status */
  success: boolean;

  /** Path as array of world positions */
  path: Vector3[];

  /** Total path length */
  length: number;

  /** Estimated travel time */
  travelTime: number;

  /** Path nodes used (for debugging) */
  nodes: PathNode[];
}

/**
 * Pathfinding request
 */
export interface PathRequest {
  /** Start position */
  start: Vector3;

  /** Goal position */
  goal: Vector3;

  /** Unit ID requesting path */
  unitId: string;

  /** Unit size for collision */
  unitSize: Vector2;

  /** Maximum path length */
  maxLength: number;

  /** Allow partial paths */
  allowPartial: boolean;

  /** Path smoothing enabled */
  smoothing: boolean;
}

// ============================================================================
// AI Commander Types
// ============================================================================

/**
 * AI difficulty level
 */
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'insane';

/**
 * AI personality type
 */
export type AIPersonality =
  | 'balanced'
  | 'aggressive'
  | 'defensive'
  | 'economic'
  | 'rusher';

/**
 * AI state
 */
export interface AIState {
  /** Current game phase */
  phase: 'early' | 'mid' | 'late' | 'endgame';

  /** Current strategy */
  strategy: AIStrategy;

  /** Threat assessment */
  threats: ThreatAssessment;

  /** Opportunity targets */
  opportunities: OpportunityTarget[];

  /** Resource allocation priorities */
  priorities: ResourcePriority;

  /** Current build queue */
  buildQueue: BuildOrder[];

  /** Attack plans */
  attackPlans: AttackPlan[];

  /** Defense plans */
  defensePlans: DefensePlan[];
}

/**
 * AI strategy
 */
export interface AIStrategy {
  /** Strategy type */
  type: 'rush' | 'boom' | 'turtle' | 'raid' | 'cheese';

  /** Aggressiveness (0-1) */
  aggressiveness: number;

  /** Expansion timing */
  expandTiming: number;

  /** Tech focus */
  techFocus: 'military' | 'economic' | 'balanced';

  /** Unit composition preference */
  unitPreference: Record<string, number>;
}

/**
 * Threat assessment
 */
export interface ThreatAssessment {
  /** Overall threat level (0-1) */
  level: number;

  /** Threats by player */
  byPlayer: Map<string, PlayerThreat>;

  /** Most threatening enemy position */
  primaryThreat: Vector3 | null;

  /** Expected attack timing */
  expectedAttack: number; // seconds
}

/**
 * Player threat info
 */
export interface PlayerThreat {
  /** Player ID */
  playerId: string;

  /** Military strength (0-1) */
  militaryStrength: number;

  /** Economic strength (0-1) */
  economicStrength: number;

  /** Estimated army position */
  armyPosition: Vector3 | null;

  /** Last known army size */
  armySize: number;
}

/**
 * Opportunity target
 */
export interface OpportunityTarget {
  /** Target type */
  type: 'resource' | 'structure' | 'unit' | 'expansion';

  /** Target position */
  position: Vector3;

  /** Target value (0-1) */
  value: number;

  /** Risk level (0-1) */
  risk: number;

  /** Required force */
  requiredForce: number;

  /** Expiration time */
  expiresAt: number;
}

/**
 * Resource priority
 */
export interface ResourcePriority {
  /** Military priority (0-1) */
  military: number;

  /** Economic priority (0-1) */
  economic: number;

  /** Technology priority (0-1) */
  technology: number;

  /** Expansion priority (0-1) */
  expansion: number;
}

/**
 * Build order
 */
export interface BuildOrder {
  /** What to build */
  type: 'unit' | 'structure' | 'research' | 'upgrade';

  /** ID of thing to build */
  id: string;

  /** Priority (0-1, higher is more important) */
  priority: number;

  /** Trigger conditions */
  triggers: BuildTrigger[];

  /** Retry on failure */
  retry: boolean;

  /** Status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Build trigger conditions
 */
export interface BuildTrigger {
  /** Trigger type */
  type: 'resources' | 'time' | 'unit_count' | 'enemy_attack' | 'custom';

  /** Trigger value */
  value: number | string;

  /** Comparison operator */
  operator: '>' | '<' | '=' | '>=' | '<=';
}

/**
 * Attack plan
 */
export interface AttackPlan {
  /** Plan ID */
  id: string;

  /** Target position */
  target: Vector3;

  /** Required units */
  requiredUnits: Record<string, number>;

  /** Current assigned units */
  assignedUnits: string[];

  /** Readiness (0-1) */
  readiness: number;

  /** Attack timing */
  timing: 'immediate' | 'when_ready' | 'scheduled';

  /** Scheduled time */
  scheduledAt?: number;

  /** Status */
  status: 'planning' | 'preparing' | 'executing' | 'completed' | 'cancelled';
}

/**
 * Defense plan
 */
export interface DefensePlan {
  /** Plan ID */
  id: string;

  /** Base/area to defend */
  target: Vector3;

  /** Defense radius */
  radius: number;

  /** Assigned defenders */
  defenders: string[];

  /** Patrol routes */
  patrolRoutes: Vector3[][];

  /** Status */
  status: 'active' | 'alert' | 'under_attack' | 'lost';
}

// ============================================================================
// Multiplayer Types
// ============================================================================

/**
 * Network message types
 */
export type NetworkMessageType =
  | 'unit_spawned'
  | 'unit_moved'
  | 'unit_attacked'
  | 'unit_died'
  | 'structure_built'
  | 'resource_gathered'
  | 'player_state'
  | 'game_state'
  | 'chat_message'
  | 'ping';

/**
 * Network message base
 */
export interface NetworkMessage {
  /** Message type */
  type: NetworkMessageType;

  /** Sender player ID */
  senderId: string;

  /** Message timestamp */
  timestamp: number;

  /** Sequence number */
  sequence: number;

  /** Message data */
  data: unknown;
}

/**
 * Game state snapshot
 */
export interface GameStateSnapshot {
  /** Snapshot sequence number */
  sequence: number;

  /** Snapshot timestamp */
  timestamp: number;

  /** All unit states */
  units: UnitInstance[];

  /** All structure states */
  structures: StructureInstance[];

  /** All player states */
  players: PlayerState[];

  /** Current game time */
  gameTime: number;

  /** Current game phase */
  gamePhase: string;
}

/**
 * Network sync config
 */
export interface NetworkSyncConfig {
  /** Server endpoint */
  serverUrl: string;

  /** Room/game ID */
  roomId: string;

  /** Player ID */
  playerId: string;

  /** Auth token */
  authToken?: string;

  /** Tick rate (Hz) */
  tickRate: number;

  /** Snapshot interval (ms) */
  snapshotInterval: number;

  /** Interpolation delay (ms) */
  interpolationDelay: number;

  /** Client-side prediction enabled */
  prediction: boolean;

  /** Reconciliation enabled */
  reconciliation: boolean;
}

// ============================================================================
// Structure Types
// ============================================================================

/**
 * Structure classification
 */
export type StructureClass =
  | 'base'
  | 'production'
  | 'defense'
  | 'resource'
  | 'research'
  | 'power'
  | 'wall';

/**
 * Structure instance
 */
export interface StructureInstance {
  /** Unique instance ID */
  instanceId: string;

  /** Structure definition reference */
  definitionId: string;

  /** Current position */
  position: Vector3;

  /** Current rotation (Y-axis in degrees) */
  rotation: number;

  /** Construction progress (0-1) */
  constructionProgress: number;

  /** Is under construction */
  isUnderConstruction: boolean;

  /** Current health */
  health: number;

  /** Owner player ID */
  ownerId: string;

  /** Rally point for produced units */
  rallyPoint?: Vector3;

  /** Current production queue */
  productionQueue: ProductionQueueItem[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Production queue item
 */
export interface ProductionQueueItem {
  /** Unit ID being produced */
  unitId: string;

  /** Production progress (0-1) */
  progress: number;

  /** Start timestamp */
  startedAt: number;

  /** Expected completion */
  completesAt: number;
}

// ============================================================================
// Game Types
// ============================================================================

/**
 * Game mode
 */
export type GameMode =
  | 'skirmish'
  | 'campaign'
  | 'multiplayer'
  | 'tutorial'
  | 'scenario';

/**
 * Game settings
 */
export interface GameSettings {
  /** Game mode */
  mode: GameMode;

  /** Map name/ID */
  mapId: string;

  /** Max players */
  maxPlayers: number;

  /** Starting resources */
  startingResources: PlayerResources;

  /** Starting population cap */
  startingPopCap: number;

  /** Victory condition */
  victoryCondition: 'annihilation' | 'economic' | 'domination' | 'custom';

  /** Game time limit (seconds, 0 = unlimited) */
  timeLimit: number;

  /** Teams enabled */
  teamsEnabled: boolean;

  /** Fog of war enabled */
  fogOfWar: boolean;

  /** Reveal map */
  revealMap: boolean;

  /** Difficulty for AI players */
  difficulty: AIDifficulty;
}

/**
 * Game state
 */
export interface GameState {
  /** Game ID */
  gameId: string;

  /** Game settings */
  settings: GameSettings;

  /** Current game phase */
  phase: 'lobby' | 'loading' | 'playing' | 'paused' | 'ended';

  /** Game time (seconds) */
  gameTime: number;

  /** All players */
  players: PlayerState[];

  /** All units */
  units: Map<string, UnitInstance>;

  /** All structures */
  structures: Map<string, StructureInstance>;

  /** Terrain data */
  terrain: TerrainData;

  /** Current selection state */
  selection: SelectionState;

  /** Camera state */
  camera: RTSCameraConfig;

  /** Winner player ID (when game ends) */
  winner?: string;
}

// ============================================================================
// StudyLoG.AI Specific Types
// ============================================================================

/**
 * Science lab equipment type
 */
export type LabEquipment =
  | 'microscope'
  | 'centrifuge'
  | 'beaker'
  | 'bunsen_burner'
  | 'test_tube'
  | 'petri_dish'
  | 'spectrometer'
  | 'custom';

/**
 * Science lab station
 */
export interface LabStation {
  /** Station ID */
  id: string;

  /** Station name */
  name: string;

  /** Position in lab */
  position: Vector3;

  /** Equipment at this station */
  equipment: LabEquipment[];

  /** Available experiments */
  experiments: string[];

  /** Current activity */
  currentActivity?: LabActivity;

  /** Is occupied by student */
  occupiedBy?: string;
}

/**
 * Lab activity state
 */
export interface LabActivity {
  /** Activity ID */
  id: string;

  /** Activity type */
  type: 'experiment' | 'observation' | 'analysis' | 'demonstration';

  /** Progress (0-1) */
  progress: number;

  /** Started at timestamp */
  startedAt: number;

  /** Expected completion */
  completesAt: number;

  /** Activity data */
  data: Record<string, unknown>;
}

/**
 * Physics simulation object
 */
export interface PhysicsObject {
  /** Object ID */
  id: string;

  /** Object type */
  type: 'sphere' | 'cube' | 'cylinder' | 'complex';

  /** Physical properties */
  physics: {
    mass: number;
    velocity: Vector3;
    acceleration: Vector3;
    angularVelocity: Vector3;
    friction: number;
    restitution: number;
  };

  /** Position and orientation */
  transform: {
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
  };

  /** Material properties */
  material: {
    density: number;
    dragCoefficient: number;
  };
}

// ============================================================================
// DMLoG.AI Specific Types
// ============================================================================

/**
 * Miniature figure type
 */
export type FigureType =
  | 'humanoid'
  | 'beast'
  | 'construct'
  | 'undead'
  | 'dragon'
  | 'elemental'
  | 'custom';

/**
 * Miniature figure
 */
export interface MiniatureFigure {
  /** Figure ID */
  id: string;

  /** Figure type */
  type: FigureType;

  /** Display name */
  name: string;

  /** Scene path for 3D model */
  scenePath: string;

  /** Base size in mm */
  baseSize: number;

  /** Scale multiplier */
  scale: number;

  /** Position on battle map */
  position: Vector3;

  /** Rotation (Y-axis) */
  rotation: number;

  /** Character sheet data */
  character: {
    health: number;
    maxHealth: number;
    armorClass: number;
    speed: number;
    abilities: string[];
  };

  /** Owner (DM or player) */
  ownerId: string;

  /** Token color */
  tokenColor: Color;
}

/**
 * Battle map configuration
 */
export interface BattleMapConfig {
  /** Map ID */
  id: string;

  /** Map name */
  name: string;

  /** Terrain data */
  terrain: TerrainData;

  /** Grid size */
  gridSize: number; // 5ft squares

  /** Map dimensions (in squares) */
  dimensions: {
    width: number;
    depth: number;
  };

  /** Placed figures */
  figures: MiniatureFigure[];

  /** Map markers/notes */
  markers: MapMarker[];

  /** Lighting configuration */
  lighting: {
    ambient: Color;
    sunDirection: Vector3;
    sunColor: Color;
    shadows: boolean;
  };

  /** Fog of war areas */
  fogAreas: FogArea[];
}

/**
 * Map marker for notes
 */
export interface MapMarker {
  /** Marker ID */
  id: string;

  /** Marker position */
  position: Vector3;

  /** Marker type */
  type: 'note' | 'trap' | 'treasure' | 'encounter' | 'custom';

  /** Marker label */
  label: string;

  /** Is visible to players */
  visibleToPlayers: boolean;

  /** Icon to display */
  icon?: string;
}

/**
 * Fog of war area
 */
export interface FogArea {
  /** Area ID */
  id: string;

  /** Area shape */
  shape: 'circle' | 'rectangle' | 'polygon';

  /** Area dimensions */
  dimensions: {
    center: Vector3;
    radius?: number;
    size?: Vector2;
    points?: Vector3[];
  };

  /** Is currently revealed */
  revealed: boolean;

  /** Which players have seen this area */
  seenBy: string[];
}

// ============================================================================
// Quality Tier Types
// ============================================================================

/**
 * Graphics quality tier
 */
export type QualityTier =
  | 'low'      // Fallback to MicroVerse/Luanti
  | 'medium'   // Mobile-friendly reduced detail
  | 'high'     // Standard PS2-level quality
  | 'ultra';   // Enhanced PC quality

/**
 * Quality tier configuration
 */
export interface QualityConfig {
  /** Current quality tier */
  tier: QualityTier;

  /** Auto-detect from device */
  autoDetect: boolean;

  /** Tier-specific settings */
  settings: Record<QualityTier, QualityTierSettings>;
}

/**
 * Settings for a quality tier
 */
export interface QualityTierSettings {
  /** Texture quality */
  textureQuality: 'low' | 'medium' | 'high' | 'ultra';

  /** Shadow quality */
  shadowQuality: 'off' | 'low' | 'medium' | 'high';

  /** Shadow distance */
  shadowDistance: number;

  /** Anti-aliasing */
  antiAliasing: 'off' | 'fxaa' | 'msaa_2x' | 'msaa_4x';

  /** Post-processing enabled */
  postProcessing: boolean;

  /** Particle count multiplier */
  particleMultiplier: number;

  /** View distance */
  viewDistance: number;

  /** Grass enabled */
  grassEnabled: boolean;

  /** Water quality */
  waterQuality: 'low' | 'medium' | 'high';

  /** Terrain LOD distance */
  terrainLOD: number;
}

/**
 * Device capability detection result
 */
export interface DeviceCapabilities {
  /** Detected GPU */
  gpu: string;

  /** Detected VRAM (MB) */
  vram: number;

  /** Estimated tier */
  recommendedTier: QualityTier;

  /** Can run PS2-level graphics */
  canRunHighQuality: boolean;

  /** Should fallback to simpler engine */
  shouldFallback: boolean;
}

// ============================================================================
// Bridge Communication Types
// ============================================================================

/**
 * Message from backend to OpenRTS
 */
export interface ToOpenRTSMessage {
  /** Message type */
  type: OpenRTSMessageType;

  /** Message ID for request/response */
  id?: string;

  /** Timestamp */
  timestamp: number;

  /** Message payload */
  payload: unknown;
}

/**
 * Message types for OpenRTS bridge
 */
export type OpenRTSMessageType =
  | 'initialize'
  | 'load_map'
  | 'spawn_unit'
  | 'despawn_unit'
  | 'move_units'
  | 'attack_order'
  | 'set_camera'
  | 'update_selection'
  | 'ping'
  | 'pong'
  | 'game_state_update'
  | 'terrain_update'
  | 'ai_command';

/**
 * Message from OpenRTS to backend
 */
export interface FromOpenRTSMessage {
  /** Message type */
  type: OpenRTSEventType;

  /** Message ID for request/response */
  id?: string;

  /** Timestamp */
  timestamp: number;

  /** Message payload */
  payload: unknown;
}

/**
 * Event types from OpenRTS
 */
export type OpenRTSEventType =
  | 'initialized'
  | 'map_loaded'
  | 'unit_spawned'
  | 'unit_died'
  | 'unit_attacked'
  | 'structure_built'
  | 'resource_changed'
  | 'selection_changed'
  | 'camera_moved'
  | 'error'
  | 'ping';

// ============================================================================
// Error Types
// ============================================================================

/**
 * OpenRTS integration error
 */
export class OpenRTSError extends Error {
  constructor(
    public code: OpenRTSErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OpenRTSError';
  }
}

/**
 * Error codes
 */
export enum OpenRTSErrorCode {
  // Connection errors
  BRIDGE_DISCONNECTED = 'BRIDGE_DISCONNECTED',
  BRIDGE_TIMEOUT = 'BRIDGE_TIMEOUT',

  // Map errors
  MAP_NOT_FOUND = 'MAP_NOT_FOUND',
  MAP_LOAD_FAILED = 'MAP_LOAD_FAILED',
  TERRAIN_GENERATION_FAILED = 'TERRAIN_GENERATION_FAILED',

  // Unit errors
  UNIT_NOT_FOUND = 'UNIT_NOT_FOUND',
  UNIT_SPAWN_FAILED = 'UNIT_SPAWN_FAILED',
  INVALID_UNIT_ORDER = 'INVALID_UNIT_ORDER',

  // Pathfinding errors
  PATH_NOT_FOUND = 'PATH_NOT_FOUND',
  PATHFINDING_TIMEOUT = 'PATHFINDING_TIMEOUT',

  // AI errors
  AI_INIT_FAILED = 'AI_INIT_FAILED',
  AI_COMMAND_FAILED = 'AI_COMMAND_FAILED',

  // Network errors
  NETWORK_DISCONNECTED = 'NETWORK_DISCONNECTED',
  SYNC_ERROR = 'SYNC_ERROR',
  INVALID_STATE = 'INVALID_STATE',

  // Resource errors
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  POPULATION_CAP_REACHED = 'POPULATION_CAP_REACHED',
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * OpenRTS integration configuration
 */
export interface OpenRTSConfig {
  /** Bridge connection settings */
  bridge: {
    /** WebSocket host */
    host: string;

    /** WebSocket port */
    port: number;

    /** Auto-reconnect */
    autoReconnect: boolean;

    /** Reconnect interval (ms) */
    reconnectInterval: number;

    /** Max reconnect attempts */
    maxReconnectAttempts: number;

    /** Request timeout (ms) */
    requestTimeout: number;
  };

  /** Pathfinding settings */
  pathfinding: {
    /** Pathfinding thread count */
    threads: number;

    /** Max path length */
    maxPathLength: number;

    /** Path smoothing */
    smoothing: boolean;

    /** Path cache enabled */
    cacheEnabled: boolean;

    /** Cache size */
    cacheSize: number;
  };

  /** AI settings */
  ai: {
    /** Update interval (ms) */
    updateInterval: number;

    /** Difficulty for AI players */
    difficulty: AIDifficulty;

    /** Personality type */
    personality: AIPersonality;
  };

  /** Quality settings */
  quality: QualityConfig;

  /** Product-specific settings */
  product: {
    /** Product type */
    type: 'studylog' | 'dmlog' | 'generic';

    /** Product-specific configuration */
    settings: Record<string, unknown>;
  };

  /** Logging */
  logging: {
    /** Log level */
    level: 'debug' | 'info' | 'warn' | 'error';

    /** Bridge logging enabled */
    bridgeLog: boolean;
  };
}
