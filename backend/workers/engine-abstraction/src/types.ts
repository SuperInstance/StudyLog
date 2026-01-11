/**
 * Unified Game Engine Abstraction Layer - Type Definitions
 *
 * Provides common types for MicroVerse, Luanti, and OpenRTS engines.
 * Enables gameplay to move between engines while preserving game state.
 *
 * @module engine-abstraction/types
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Supported game engines in the unified abstraction layer.
 */
export enum GameEngine {
  /** MicroVerse - NES-SNES era, 2D/2.5D graphics, mobile-friendly */
  MICROVERSE = "microverse",
  /** Luanti - Blocky voxel-based, Minecraft-like, electronics theme */
  LUANTI = "luanti",
  /** OpenRTS - PS2-level 3D graphics, desktop/gaming hardware */
  OPENRTS = "openrts",
}

/**
 * Graphics quality tiers based on hardware capability.
 */
export enum QualityTier {
  /** Low quality - sprite-based, minimal effects */
  LOW = "low",
  /** Medium quality - simple 3D, basic lighting */
  MEDIUM = "medium",
  /** High quality - full 3D, advanced lighting, shaders */
  HIGH = "high",
  /** Ultra quality - ray tracing, maximum detail */
  ULTRA = "ultra",
}

/**
 * Asset format types for cross-engine compatibility.
 */
export enum AssetFormat {
  /** 2D sprite sheet for MicroVerse */
  SPRITE_2D = "sprite_2d",
  /** Voxel model for Luanti */
  VOXEL = "voxel",
  /** 3D mesh for OpenRTS */
  MESH_3D = "mesh_3d",
  /** Universal format that can render as any of the above */
  UNIVERSAL = "universal",
}

/**
 * Platform types for hardware detection.
 */
export enum Platform {
  /** Mobile device (iOS/Android) */
  MOBILE = "mobile",
  /** Desktop computer */
  DESKTOP = "desktop",
  /** Web browser */
  WEB = "web",
  /** Console device */
  CONSOLE = "console",
}

/**
 * Rendering backend options.
 */
export enum RenderingBackend {
  /** Software rendering - CPU-based */
  SOFTWARE = "software",
  /** OpenGL 2.x/3.x */
  OPENGL = "opengl",
  /** Vulkan */
  VULKAN = "vulkan",
  ** Direct3D 11/12 */
  DIRECT3D = "direct3d",
  /** Metal (iOS/macOS) */
  METAL = "metal",
  /** WebGPU */
  WEBGPU = "webgpu",
  /** WebGL 1/2 */
  WEBGL = "webgl",
}

/**
 * GPU capabilities flags.
 */
export enum GPUCapability {
  /** Hardware supports ray tracing */
  RAY_TRACING = "ray_tracing",
  /** Hardware supports compute shaders */
  COMPUTE_SHADERS = "compute_shaders",
  /** Hardware supports geometry shaders */
  GEOMETRY_SHADERS = "geometry_shaders",
  /** Hardware supports tessellation */
  TESSELLATION = "tessellation",
  /** Hardware supports HDR rendering */
  HDR = "hdr",
  /** Hardware supports VR rendering */
  VR = "vr",
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Platform hardware capabilities detected by the platform detector.
 */
export interface PlatformCapabilities {
  /** Detected platform type */
  platform: Platform;
  /** CPU core count */
  cpuCores: number;
  /** Available RAM in MB */
  memoryMB: number;
  /** GPU information */
  gpu: GPUInfo;
  /** Supported rendering backends */
  supportedBackends: RenderingBackend[];
  /** GPU capability flags */
  capabilities: GPUCapability[];
  /** Recommended quality tier */
  recommendedQuality: QualityTier;
  /** Recommended engine for this platform */
  recommendedEngine: GameEngine;
}

/**
 * GPU information structure.
 */
export interface GPUInfo {
  /** GPU vendor (NVIDIA, AMD, Intel, etc.) */
  vendor: string;
  /** GPU model name */
  model: string;
  /** VRAM in MB (estimated) */
  vramMB: number;
  /** DirectX/OpenGL feature level */
  featureLevel: string;
  /** Is NVIDIA RTX GPU (has tensor cores) */
  isRTX: boolean;
}

/**
 * Asset metadata for cross-engine conversion.
 */
export interface AssetMetadata {
  /** Unique asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Current asset format */
  format: AssetFormat;
  /** Supported engines for this asset */
  supportedEngines: GameEngine[];
  /** Asset category for type-specific handling */
  category: AssetCategory;
  /** Primary dimensions (width/height or bounds) */
  dimensions: Dimensions;
  /** Animation data if applicable */
  animation?: AnimationData;
  /** Collision data */
  collision?: CollisionData;
  /** Material properties */
  material?: MaterialProperties;
  /** Custom properties map */
  properties: Record<string, unknown>;
  /** Timestamp when asset was created */
  createdAt: Date;
  /** Timestamp when asset was last modified */
  updatedAt: Date;
}

/**
 * Asset category for type-specific processing.
 */
export enum AssetCategory {
  /** Character/entity sprite */
  CHARACTER = "character",
  /** Prop/object sprite */
  PROP = "prop",
  /** Tile/terrain sprite */
  TILE = "tile",
  /** Background/environment */
  BACKGROUND = "background",
  /** UI element */
  UI = "ui",
  /** Particle effect */
  EFFECT = "effect",
  /** Audio data */
  AUDIO = "audio",
  /** 3D model */
  MODEL = "model",
}

/**
 * Dimensions structure for 2D and 3D assets.
 */
export interface Dimensions {
  /** Width in pixels/units */
  width: number;
  /** Height in pixels/units */
  height: number;
  /** Depth in units (3D only) */
  depth?: number;
}

/**
 * Animation data for animated assets.
 */
export interface AnimationData {
  /** List of animation sequences */
  sequences: AnimationSequence[];
  /** Frames per second */
  fps: number;
  /** Animation mode (loop, ping-pong, once) */
  mode: AnimationMode;
}

/**
 * Animation sequence definition.
 */
export interface AnimationSequence {
  /** Sequence identifier */
  id: string;
  /** Sequence name (idle, walk, attack, etc.) */
  name: string;
  /** Starting frame */
  startFrame: number;
  /** Ending frame */
  endFrame: number;
  /** Loop this sequence */
  loop: boolean;
}

/**
 * Animation playback modes.
 */
export enum AnimationMode {
  /** Play once and stop */
  ONCE = "once",
  /** Loop from end back to start */
  LOOP = "loop",
  /** Ping-pong back and forth */
  PING_PONG = "ping_pong",
}

/**
 * Collision data for physics interaction.
 */
export interface CollisionData {
  /** Collision shape type */
  type: CollisionShape;
  /** Collision bounds */
  bounds: Bounds;
  /** Is this a trigger (no physical response) */
  isTrigger: boolean;
  /** Collision layers/mask */
  layers: number;
}

/**
 * Collision shape types.
 */
export enum CollisionShape {
  /** Axis-aligned bounding box */
  AABB = "aabb",
  /** Circle/sphere */
  CIRCLE = "circle",
  /** Custom polygon/polyhedron */
  POLYGON = "polygon",
  /** Tile-based collision */
  TILE = "tile",
}

/**
 * Bounding box/sphere definition.
 */
export interface Bounds {
  /** Minimum X coordinate */
  minX: number;
  /** Maximum X coordinate */
  maxX: number;
  /** Minimum Y coordinate */
  minY: number;
  /** Maximum Y coordinate */
  maxY: number;
  /** Minimum Z coordinate (3D only) */
  minZ?: number;
  /** Maximum Z coordinate (3D only) */
  maxZ?: number;
}

/**
 * Material properties for rendering.
 */
export interface MaterialProperties {
  /** Base color */
  color?: Color;
  /** Emissive/glow color */
  emissive?: Color;
  /** Roughness (0-1) */
  roughness?: number;
  /** Metalness (0-1) */
  metalness?: number;
  /** Transparency (0-1) */
  opacity?: number;
  /** Texture references */
  textures?: TextureReference[];
  /** Shader effects */
  shaders?: ShaderEffect[];
}

/**
 * RGBA color definition.
 */
export interface Color {
  /** Red component (0-255) */
  r: number;
  /** Green component (0-255) */
  g: number;
  /** Blue component (0-255) */
  b: number;
  /** Alpha component (0-255) */
  a: number;
}

/**
 * Texture reference for materials.
 */
export interface TextureReference {
  /** Texture slot/type (albedo, normal, etc.) */
  slot: TextureSlot;
  /** Texture asset ID */
  assetId: string;
  /** UV transform if needed */
  transform?: UVTransform;
}

/**
 * Texture slot types.
 */
export enum TextureSlot {
  /** Base color/albedo */
  ALBEDO = "albedo",
  /** Normal map */
  NORMAL = "normal",
  /** Roughness map */
  ROUGHNESS = "roughness",
  /** Metalness map */
  METALNESS = "metalness",
  /** Emissive map */
  EMISSIVE = "emissive",
  /** Ambient occlusion */
  AO = "ao",
}

/**
 * UV transformation for texture mapping.
 */
export interface UVTransform {
  /** X offset */
  offsetX: number;
  /** Y offset */
  offsetY: number;
  /** X scale */
  scaleX: number;
  /** Y scale */
  scaleY: number;
  /** Rotation in degrees */
  rotation: number;
}

/**
 * Shader effect for materials.
 */
export interface ShaderEffect {
  /** Effect type */
  type: ShaderType;
  /** Effect parameters */
  params: Record<string, number | string | boolean>;
}

/**
 * Shader effect types.
 */
export enum ShaderType {
  /** Vertex displacement */
  VERTEX_DISPLACEMENT = "vertex_displacement",
  /** Fresnel effect */
  FRESNEL = "fresnel",
  /** Dissolve/transition */
  DISSOLVE = "dissolve",
  /** Holographic effect */
  HOLOGRAPHIC = "holographic",
  /** Water/caustics */
  WATER = "water",
  /** Particle system */
  PARTICLE = "particle",
}

// ============================================================================
// GAME STATE TYPES
// ============================================================================

/**
 * Universal game state that can be represented in any engine.
 */
export interface UniversalGameState {
  /** State version for migration compatibility */
  version: string;
  /** Session identifier */
  sessionId: string;
  /** Timestamp of last save */
  timestamp: number;
  /** Current engine that created this state */
  engine: GameEngine;
  /** Current quality tier */
  quality: QualityTier;
  /** World/entities state */
  world: WorldState;
  /** Player state */
  player: PlayerState;
  /** Game progress flags */
  progress: ProgressState;
  /** Custom mod data */
  mods?: ModData[];
}

/**
 * World state containing all entities.
 */
export interface WorldState {
  /** World identifier */
  id: string;
  /** World name */
  name: string;
  /** World seed for procedural generation */
  seed: number;
  /** Current active scene/area */
  currentScene: string;
  /** All entities in the world */
  entities: EntityState[];
  /** Global environment settings */
  environment: EnvironmentState;
  /** Lighting configuration */
  lighting: LightingState;
}

/**
 * Entity state that can be rendered in any engine.
 */
export interface EntityState {
  /** Unique entity identifier */
  id: string;
  /** Entity type identifier */
  type: string;
  /** Entity name */
  name: string;
  /** Position in world space */
  position: Vector3;
  /** Rotation (Euler angles in degrees) */
  rotation: Vector3;
  /** Scale */
  scale: Vector3;
  /** Asset reference for rendering */
  asset: string;
  /** Current animation state */
  animation?: EntityAnimationState;
  /** Entity properties */
  properties: Record<string, unknown>;
  /** Child entities */
  children?: EntityState[];
}

/**
 * 3D vector for position, rotation, scale.
 */
export interface Vector3 {
  /** X component */
  x: number;
  /** Y component */
  y: number;
  /** Z component (0 for 2D) */
  z: number;
}

/**
 * Entity animation state.
 */
export interface EntityAnimationState {
  /** Current animation sequence */
  sequence: string;
  /** Current frame */
  frame: number;
  /** Playback speed multiplier */
  speed: number;
  /** Is animation playing */
  playing: boolean;
}

/**
 * Environment state for world settings.
 */
export interface EnvironmentState {
  /** Background color */
  backgroundColor: Color;
  /** Fog settings */
  fog?: FogState;
  /** Gravity vector */
  gravity: Vector3;
  /** Time of day (0-1) */
  timeOfDay: number;
  /** Weather condition */
  weather: WeatherCondition;
}

/**
 * Fog configuration.
 */
export interface FogState {
  /** Is fog enabled */
  enabled: boolean;
  /** Fog color */
  color: Color;
  /** Fog density */
  density: number;
  /** Fog start distance */
  start: number;
  /** Fog end distance */
  end: number;
}

/**
 * Weather conditions.
 */
export enum WeatherCondition {
  /** Clear sky */
  CLEAR = "clear",
  /** Rain */
  RAIN = "rain",
  /** Snow */
  SNOW = "snow",
  /** Storm */
  STORM = "storm",
  /** Fog */
  FOG = "fog",
}

/**
 * Lighting state configuration.
 */
export interface LightingState {
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Ambient light color */
  ambientColor: Color;
  /** All light sources */
  lights: LightState[];
}

/**
 * Light source state.
 */
export interface LightState {
  /** Light identifier */
  id: string;
  /** Light type */
  type: LightType;
  /** Light position */
  position: Vector3;
  /** Light direction (for directional/spot) */
  direction?: Vector3;
  /** Light intensity */
  intensity: number;
  /** Light color */
  color: Color;
  /** Light range */
  range?: number;
  /** Spot light inner angle */
  innerAngle?: number;
  /** Spot light outer angle */
  outerAngle?: number;
}

/**
 * Light source types.
 */
export enum LightType {
  /** Directional light (sun) */
  DIRECTIONAL = "directional",
  /** Point light (omnidirectional) */
  POINT = "point",
  /** Spot light (cone) */
  SPOT = "spot",
  /** Ambient light (hemisphere) */
  AMBIENT = "ambient",
}

/**
 * Player state for save/load.
 */
export interface PlayerState {
  /** Player unique identifier */
  id: string;
  /** Player name */
  name: string;
  /** Player position */
  position: Vector3;
  /** Player rotation */
  rotation: Vector3;
  /** Player stats/attributes */
  stats: PlayerStats;
  /** Inventory items */
  inventory: InventoryItem[];
  /** Completed quests/objectives */
  completedObjectives: string[];
  /** Active quests/objectives */
  activeObjectives: string[];
}

/**
 * Player stats/attributes.
 */
export interface PlayerStats {
  /** Current health */
  health: number;
  /** Maximum health */
  maxHealth: number;
  /** Current mana/energy */
  mana: number;
  /** Maximum mana/energy */
  maxMana: number;
  /** Experience points */
  experience: number;
  /** Character level */
  level: number;
  /** Custom stat map */
  custom: Record<string, number>;
}

/**
 * Inventory item reference.
 */
export interface InventoryItem {
  /** Item identifier */
  id: string;
  /** Item quantity */
  quantity: number;
  /** Item durability */
  durability?: number;
  /** Custom item data */
  data?: Record<string, unknown>;
}

/**
 * Game progress tracking.
 */
export interface ProgressState {
  /** Current chapter/stage */
  chapter: string;
  /** Unlocked areas/scenes */
  unlockedAreas: string[];
  /** Flags for conditional events */
  flags: Record<string, boolean>;
  /** Counters for tracking progress */
  counters: Record<string, number>;
  /** Timestamps of key events */
  timestamps: Record<string, number>;
}

/**
 * Mod data for custom game modifications.
 */
export interface ModData {
  /** Mod identifier */
  id: string;
  /** Mod version */
  version: string;
  /** Is mod enabled */
  enabled: boolean;
  /** Mod-specific data */
  data: Record<string, unknown>;
}

// ============================================================================
// TRANSFORM TYPES
// ============================================================================

/**
 * Asset transformation result.
 */
export interface AssetTransformResult {
  /** Original asset metadata */
  source: AssetMetadata;
  /** Target engine */
  targetEngine: GameEngine;
  /** Target format */
  targetFormat: AssetFormat;
  /** Transformed asset data */
  data: unknown;
  /** Generated metadata */
  metadata: AssetMetadata;
  /** Transformation success */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Warnings about quality loss */
  warnings?: string[];
}

/**
 * Transformation options for quality control.
 */
export interface TransformOptions {
  /** Target engine */
  targetEngine: GameEngine;
  /** Target format */
  targetFormat?: AssetFormat;
  /** Quality level */
  quality?: QualityTier;
  /** Preserve animation data */
  preserveAnimation?: boolean;
  /** Preserve collision data */
  preserveCollision?: boolean;
  /** Optimize for file size */
  optimizeSize?: boolean;
  /** Generate LOD levels */
  generateLOD?: boolean;
}

/**
 * Migration result for save data.
 */
export interface MigrationResult {
  /** Migration success */
  success: boolean;
  /** Source engine */
  sourceEngine: GameEngine;
  /** Target engine */
  targetEngine: GameEngine;
  /** Migrated game state */
  state: UniversalGameState;
  /** Migration warnings */
  warnings: string[];
  /** Migration errors */
  errors: string[];
  /** Data loss summary */
  dataLoss?: DataLossSummary;
}

/**
 * Summary of data that couldn't be preserved during migration.
 */
export interface DataLossSummary {
  /** Lost features by category */
  categories: Record<string, string[]>;
  /** Approximate percentage of data lost */
  percentageLost: number;
  /** Recommendations to user */
  recommendations: string[];
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Request to select engine for a session.
 */
export interface EngineSelectionRequest {
  /** Session identifier */
  sessionId: string;
  /** Preferred engine (optional - auto-select if omitted) */
  preferredEngine?: GameEngine;
  /** Preferred quality (optional) */
  preferredQuality?: QualityTier;
  /** Platform capabilities (if available) */
  capabilities?: PlatformCapabilities;
}

/**
 * Response for engine selection.
 */
export interface EngineSelectionResponse {
  /** Selected engine */
  engine: GameEngine;
  /** Selected quality tier */
  quality: QualityTier;
  /** Rendering backend to use */
  backend: RenderingBackend;
  /** Selection reason */
  reason: string;
  /** Estimated performance metrics */
  performance: PerformanceEstimate;
}

/**
 * Estimated performance metrics.
 */
export interface PerformanceEstimate {
  /** Expected FPS range */
  fps: [number, number];
  /** Expected load times in seconds */
  loadTime: [number, number];
  /** Memory usage estimate in MB */
  memoryUsage: number;
}

/**
 * Engine capabilities response.
 */
export interface EngineCapabilitiesResponse {
  /** Supported engines for this platform */
  supportedEngines: GameEngine[];
  /** Platform capabilities */
  platform: PlatformCapabilities;
  /** Quality tiers available */
  availableQualities: QualityTier[];
  /** Rendering backends available */
  availableBackends: RenderingBackend[];
}

/**
 * State synchronization request.
 */
export interface StateSyncRequest {
  /** Current game state */
  state: UniversalGameState;
  /** Target engine for sync */
  targetEngine: GameEngine;
  /** Sync mode */
  mode: SyncMode;
}

/**
 * State synchronization modes.
 */
export enum SyncMode {
  /** Real-time streaming sync */
  REALTIME = "realtime",
  /** Periodic batch sync */
  PERIODIC = "periodic",
  /** Manual one-time sync */
  MANUAL = "manual",
}

/**
 * State synchronization response.
 */
export interface StateSyncResponse {
  /** Sync success */
  success: boolean;
  /** Synced state for target engine */
  state: UniversalGameState;
  /** Changes applied during sync */
  changes: StateChange[];
  /** Sync duration in milliseconds */
  duration: number;
}

/**
 * Individual state change during sync.
 */
export interface StateChange {
  /** Change type */
  type: ChangeType;
  /** Entity/property affected */
  target: string;
  /** Previous value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** Reason for change */
  reason: string;
}

/**
 * Types of state changes.
 */
export enum ChangeType {
  /** Entity added */
  ENTITY_ADDED = "entity_added",
  /** Entity removed */
  ENTITY_REMOVED = "entity_removed",
  /** Entity modified */
  ENTITY_MODIFIED = "entity_modified",
  /** Property changed */
  PROPERTY_CHANGED = "property_changed",
  /** Asset converted */
  ASSET_CONVERTED = "asset_converted",
  /** Quality downgraded */
  QUALITY_DOWNGRADED = "quality_downgraded",
  /** Quality upgraded */
  QUALITY_UPGRADED = "quality_upgraded",
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base error type for engine abstraction layer.
 */
export class EngineAbstractionError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public engine?: GameEngine,
  ) {
    super(message);
    this.name = "EngineAbstractionError";
  }
}

/**
 * Error codes for engine operations.
 */
export enum ErrorCode {
  /** Engine not supported on this platform */
  ENGINE_NOT_SUPPORTED = "engine_not_supported",
  /** Asset format not supported by target engine */
  ASSET_FORMAT_NOT_SUPPORTED = "asset_format_not_supported",
  /** Transformation failed */
  TRANSFORMATION_FAILED = "transformation_failed",
  /** Migration failed */
  MIGRATION_FAILED = "migration_failed",
  /** State sync failed */
  SYNC_FAILED = "sync_failed",
  /** Platform detection failed */
  PLATFORM_DETECTION_FAILED = "platform_detection_failed",
  /** Renderer not available */
  RENDERER_NOT_AVAILABLE = "renderer_not_available",
  /** Hardware insufficient */
  HARDWARE_INSUFFICIENT = "hardware_insufficient",
  /** Invalid state data */
  INVALID_STATE = "invalid_state",
  /** Version incompatibility */
  VERSION_INCOMPATIBLE = "version_incompatible",
}

/**
 * Error thrown when an engine operation fails.
 */
export class EngineOperationError extends EngineAbstractionError {
  constructor(message: string, engine: GameEngine) {
    super(message, ErrorCode.ENGINE_NOT_SUPPORTED, engine);
    this.name = "EngineOperationError";
  }
}

/**
 * Error thrown when asset transformation fails.
 */
export class AssetTransformationError extends EngineAbstractionError {
  constructor(
    message: string,
    public sourceFormat: AssetFormat,
    public targetFormat: AssetFormat,
  ) {
    super(message, ErrorCode.TRANSFORMATION_FAILED);
    this.name = "AssetTransformationError";
  }
}

/**
 * Error thrown when migration fails.
 */
export class MigrationError extends EngineAbstractionError {
  constructor(
    message: string,
    public sourceEngine: GameEngine,
    public targetEngine: GameEngine,
  ) {
    super(message, ErrorCode.MIGRATION_FAILED);
    this.name = "MigrationError";
  }
}

/**
 * Error thrown when platform detection fails.
 */
export class PlatformDetectionError extends EngineAbstractionError {
  constructor(message: string) {
    super(message, ErrorCode.PLATFORM_DETECTION_FAILED);
    this.name = "PlatformDetectionError";
  }
}

/**
 * Error thrown when hardware is insufficient.
 */
export class HardwareInsufficientError extends EngineAbstractionError {
  constructor(message: string, public required: QualityTier) {
    super(message, ErrorCode.HARDWARE_INSUFFICIENT);
    this.name = "HardwareInsufficientError";
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type for optional nested updates.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Engine-specific configuration.
 */
export type EngineConfig = {
  [K in GameEngine]?: {
    enabled: boolean;
    priority: number;
    config: Record<string, unknown>;
  };
};

/**
 * Map of engine names to display information.
 */
export interface EngineDisplayInfo {
  /** Internal identifier */
  id: GameEngine;
  /** Display name for UI */
  displayName: string;
  /** Short description */
  description: string;
  /** Icon URL or identifier */
  icon?: string;
  /** Screenshot URLs for showcase */
  screenshots?: string[];
  /** Minimum system requirements */
  minRequirements: SystemRequirements;
  /** Recommended system requirements */
  recommendedRequirements: SystemRequirements;
}

/**
 * System requirements for an engine.
 */
export interface SystemRequirements {
  /** Minimum CPU */
  cpu: string;
  /** Minimum RAM in GB */
  ram: number;
  /** Minimum GPU */
  gpu: string;
  /** Minimum VRAM in GB */
  vram?: number;
  /** Storage space in GB */
  storage: number;
}

/**
 * Version compatibility matrix.
 */
export interface VersionCompatibility {
  /** State format version */
  version: string;
  /** Compatible engines */
  engines: GameEngine[];
  /** Deprecated features */
  deprecated: string[];
  /** New features */
  features: string[];
}

/**
 * Cache entry for transformed assets.
 */
export interface AssetCacheEntry {
  /** Original asset ID */
  sourceId: string;
  /** Original format */
  sourceFormat: AssetFormat;
  /** Target engine */
  targetEngine: GameEngine;
  /** Target format */
  targetFormat: AssetFormat;
  /** Cached asset data */
  data: unknown;
  /** Timestamp of cache entry */
  timestamp: number;
  /** Cache hit count */
  hits: number;
  /** Size in bytes */
  size: number;
}
