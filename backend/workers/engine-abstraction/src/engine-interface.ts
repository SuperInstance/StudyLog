/**
 * Unified Game Engine Interface
 *
 * Defines the common interface that all engines (MicroVerse, Luanti, OpenRTS)
 * must implement to enable cross-engine gameplay and asset sharing.
 *
 * @module engine-abstraction/engine-interface
 */

import type {
  AssetMetadata,
  AssetFormat,
  GameEngine,
  QualityTier,
  UniversalGameState,
  PlatformCapabilities,
  EngineDisplayInfo,
  RenderingBackend,
  EntityState,
  AssetCategory,
  Dimensions,
  AnimationData,
  CollisionData,
  MaterialProperties,
  LightState,
  EnvironmentState,
} from "./types.js";

// ============================================================================
// ENGINE INTERFACE
// ============================================================================

/**
 * Common interface that all game engines must implement.
 * Enables unified gameplay across MicroVerse, Luanti, and OpenRTS.
 */
export interface IGameEngine {
  /** Engine identifier */
  readonly engineId: GameEngine;

  /** Engine display information */
  readonly displayInfo: EngineDisplayInfo;

  /** Current engine state */
  readonly state: EngineState;

  /** Is engine initialized */
  readonly isInitialized: boolean;

  /** Is engine currently running */
  readonly isRunning: boolean;

  /** Current quality tier */
  readonly currentQuality: QualityTier;

  /** Active rendering backend */
  readonly activeBackend: RenderingBackend;

  /**
   * Initialize the engine with the given configuration.
   * @param config - Engine configuration options
   * @returns Promise that resolves when initialization is complete
   */
  initialize(config: EngineInitConfig): Promise<EngineInitResult>;

  /**
   * Start the engine main loop.
   * @returns Promise that resolves when engine is running
   */
  start(): Promise<void>;

  /**
   * Stop the engine main loop.
   * @returns Promise that resolves when engine is stopped
   */
  stop(): Promise<void>;

  /**
   * Shut down the engine and release resources.
   * @returns Promise that resolves when shutdown is complete
   */
  shutdown(): Promise<void>;

  /**
   * Load a game state into the engine.
   * @param state - Universal game state to load
   * @returns Promise that resolves when state is loaded
   */
  loadState(state: UniversalGameState): Promise<StateLoadResult>;

  /**
   * Save the current engine state.
   * @returns Promise that resolves with the saved state
   */
  saveState(): Promise<UniversalGameState>;

  /**
   * Get the current engine state.
   * @returns Current universal game state
   */
  getState(): UniversalGameState;

  /**
   * Render a single frame.
   * @param deltaTime - Time since last frame in seconds
   * @returns Render statistics
   */
  render(deltaTime: number): RenderStats;

  /**
   * Update engine simulation.
   * @param deltaTime - Time since last frame in seconds
   * @returns Update statistics
   */
  update(deltaTime: number): UpdateStats;

  /**
   * Check if the engine supports a specific asset format.
   * @param format - Asset format to check
   * @returns True if format is supported
   */
  supportsAssetFormat(format: AssetFormat): boolean;

  /**
   * Check if the engine supports a specific quality tier.
   * @param quality - Quality tier to check
   * @returns True if quality tier is supported
   */
  supportsQuality(quality: QualityTier): boolean;

  /**
   * Get engine-specific metrics.
   * @returns Current engine metrics
   */
  getMetrics(): EngineMetrics;

  /**
   * Handle platform capability changes.
   * @param capabilities - New platform capabilities
   * @returns Promise that resolves when changes are applied
   */
  handleCapabilityChange(
    capabilities: PlatformCapabilities,
  ): Promise<CapabilityChangeResult>;
}

// ============================================================================
// ENGINE STATE TYPES
// ============================================================================

/**
 * Current engine state.
 */
export enum EngineStateValue {
  /** Engine not initialized */
  UNINITIALIZED = "uninitialized",
  /** Engine initializing */
  INITIALIZING = "initializing",
  /** Engine initialized but not running */
  IDLE = "idle",
  /** Engine running */
  RUNNING = "running",
  /** Engine paused */
  PAUSED = "paused",
  /** Engine shutting down */
  SHUTTING_DOWN = "shutting_down",
  /** Engine error state */
  ERROR = "error",
}

/**
 * Engine state with additional context.
 */
export interface EngineState {
  /** Current state value */
  value: EngineStateValue;
  /** State timestamp */
  timestamp: number;
  /** Error message if in error state */
  error?: string;
  /** Additional state metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// INITIALIZATION TYPES
// ============================================================================

/**
 * Engine initialization configuration.
 */
export interface EngineInitConfig {
  /** Target quality tier */
  quality?: QualityTier;
  /** Preferred rendering backend */
  backend?: RenderingBackend;
  /** Canvas or container element for rendering */
  container?: HTMLElement | OffscreenCanvas;
  /** Platform capabilities */
  capabilities?: PlatformCapabilities;
  /** Engine-specific configuration */
  engineConfig?: Record<string, unknown>;
  /** Custom initialization parameters */
  params?: Record<string, unknown>;
}

/**
 * Result of engine initialization.
 */
export interface EngineInitResult {
  /** Initialization success */
  success: boolean;
  /** Actual quality tier selected */
  quality: QualityTier;
  /** Actual rendering backend selected */
  backend: RenderingBackend;
  /** Initialization warnings */
  warnings: string[];
  /** Initialization errors */
  errors: string[];
  /** Initialization duration in milliseconds */
  duration: number;
  /** Engine metrics after initialization */
  metrics: EngineMetrics;
}

// ============================================================================
// STATE MANAGEMENT TYPES
// ============================================================================

/**
 * Result of loading a game state.
 */
export interface StateLoadResult {
  /** Load success */
  success: boolean;
  /** Load warnings */
  warnings: string[];
  /** Load errors */
  errors: string[];
  /** Transformations applied during load */
  transformations: StateTransformation[];
  /** Load duration in milliseconds */
  duration: number;
  /** Entities loaded */
  entitiesLoaded: number;
  /** Entities skipped */
  entitiesSkipped: number;
}

/**
 * State transformation applied during load.
 */
export interface StateTransformation {
  /** Transformation type */
  type: TransformationType;
  /** Target entity/property */
  target: string;
  /** Original value */
  original: unknown;
  /** Transformed value */
  transformed: unknown;
  /** Reason for transformation */
  reason: string;
}

/**
 * Types of state transformations.
 */
export enum TransformationType {
  /** Entity position adjusted for engine */
  POSITION_ADJUSTED = "position_adjusted",
  /** Asset converted to supported format */
  ASSET_CONVERTED = "asset_converted",
  /** Animation downsampled */
  ANIMATION_DOWNSAMPLED = "animation_downsampled",
  /** Physics approximation applied */
  PHYSICS_APPROXIMATED = "physics_approximated",
  /** Lighting simplified */
  LIGHTING_SIMPLIFIED = "lighting_simplified",
  /** Quality reduced for performance */
  QUALITY_REDUCED = "quality_reduced",
}

// ============================================================================
// RENDERING TYPES
// ============================================================================

/**
 * Statistics from a single render frame.
 */
export interface RenderStats {
  /** Frame timestamp */
  timestamp: number;
  /** Frame time in milliseconds */
  frameTime: number;
  /** FPS (frames per second) */
  fps: number;
  /** Draw calls */
  drawCalls: number;
  /** Vertices rendered */
  vertices: number;
  /** Triangles rendered */
  triangles: number;
  /** Texture binds */
  textureBinds: number;
  /** Shader switches */
  shaderSwitches: number;
  /** GPU memory usage in bytes */
  gpuMemory: number;
  /** Render passes */
  renderPasses: number;
}

/**
 * Statistics from a single update frame.
 */
export interface UpdateStats {
  /** Update timestamp */
  timestamp: number;
  /** Update time in milliseconds */
  updateTime: number;
  /** Entities updated */
  entitiesUpdated: number;
  /** Physics steps */
  physicsSteps: number;
  /** Collisions detected */
  collisions: number;
  /** Scripts executed */
  scriptsExecuted: number;
  /** AI updates */
  aiUpdates: number;
}

/**
 * Combined frame statistics.
 */
export interface FrameStats extends RenderStats, UpdateStats {
  /** Total frame time */
  totalTime: number;
  /** Frame number */
  frameNumber: number;
}

// ============================================================================
// ENGINE METRICS
// ============================================================================

/**
 * Current engine metrics.
 */
export interface EngineMetrics {
  /** Engine identifier */
  engine: GameEngine;
  /** Metrics timestamp */
  timestamp: number;
  /** Performance metrics */
  performance: PerformanceMetrics;
  ** Memory metrics */
  memory: MemoryMetrics;
  /** Graphics metrics */
  graphics: GraphicsMetrics;
  /** Entity metrics */
  entities: EntityMetrics;
  /** Custom metrics */
  custom: Record<string, number | string | boolean>;
}

/**
 * Performance metrics.
 */
export interface PerformanceMetrics {
  /** Average FPS over last second */
  fps: number;
  /** Minimum FPS over last second */
  fpsMin: number;
  /** Maximum FPS over last second */
  fpsMax: number;
  /** Average frame time in milliseconds */
  frameTime: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Main thread blocked time */
  mainThreadBlocked: number;
}

/**
 * Memory metrics.
 */
export interface MemoryMetrics {
  /** Total heap size in bytes */
  heapTotal: number;
  /** Used heap size in bytes */
  heapUsed: number;
  /** Memory limit in bytes */
  heapLimit: number;
  /** GPU memory in bytes */
  gpuMemory: number;
  /** Asset memory in bytes */
  assetMemory: number;
  /** Audio memory in bytes */
  audioMemory: number;
}

/**
 * Graphics metrics.
 */
export interface GraphicsMetrics {
  /** Current resolution */
  resolution: [number, number];
  /** Display resolution */
  displayResolution: [number, number];
  /** Pixel ratio */
  pixelRatio: number;
  /** Texture memory in bytes */
  textureMemory: number;
  /** Buffer memory in bytes */
  bufferMemory: number;
  /** Shader count */
  shaderCount: number;
  /** Active draw calls */
  drawCalls: number;
}

/**
 * Entity metrics.
 */
export interface EntityMetrics {
  /** Total entities */
  total: number;
  /** Active entities */
  active: number;
  /** Visible entities */
  visible: number;
  /** Entities by category */
  byCategory: Record<string, number>;
}

// ============================================================================
// CAPABILITY CHANGE TYPES
// ============================================================================

/**
 * Result of handling platform capability changes.
 */
export interface CapabilityChangeResult {
  /** Change applied successfully */
  success: boolean;
  ** Quality tier changed */
  qualityChanged: boolean;
  /** New quality tier */
  newQuality?: QualityTier;
  /** Backend changed */
  backendChanged: boolean;
  /** New backend */
  newBackend?: RenderingBackend;
  /** Warnings generated */
  warnings: string[];
  /** Actions taken */
  actions: CapabilityChangeAction[];
}

/**
 * Action taken in response to capability change.
 */
export interface CapabilityChangeAction {
  /** Action type */
  type: CapabilityActionType;
  /** Action description */
  description: string;
  /** Action parameters */
  params: Record<string, unknown>;
  /** Action result */
  result: "success" | "partial" | "failed";
}

/**
 * Types of capability change actions.
 */
export enum CapabilityActionType {
  /** Quality tier adjusted */
  QUALITY_ADJUSTED = "quality_adjusted",
  /** Rendering backend changed */
  BACKEND_CHANGED = "backend_changed",
  ** Resolution reduced */
  RESOLUTION_REDUCED = "resolution_reduced",
  /** Effects disabled */
  EFFECTS_DISABLED = "effects_disabled",
  /** Shadow quality reduced */
  SHADOWS_REDUCED = "shadows_reduced",
  /** Anti-aliasing disabled */
  AA_DISABLED = "aa_disabled",
}

// ============================================================================
// ASSET RENDERING INTERFACE
// ============================================================================

/**
 * Interface for rendering assets in an engine.
 */
export interface IAssetRenderer {
  /**
   * Register an asset for rendering.
   * @param metadata - Asset metadata
   * @returns Promise that resolves when asset is registered
   */
  registerAsset(metadata: AssetMetadata): Promise<void>;

  /**
   * Unregister an asset.
   * @param assetId - Asset identifier
   * @returns Promise that resolves when asset is unregistered
   */
  unregisterAsset(assetId: string): Promise<void>;

  /**
   * Get asset metadata.
   * @param assetId - Asset identifier
   * @returns Asset metadata or undefined if not found
   */
  getAsset(assetId: string): AssetMetadata | undefined;

  /**
   * Check if an asset is registered.
   * @param assetId - Asset identifier
   * @returns True if asset is registered
   */
  hasAsset(assetId: string): boolean;

  /**
   * Get all registered assets.
   * @returns Map of asset IDs to metadata
   */
  getAllAssets(): Map<string, AssetMetadata>;

  /**
   * Preload assets for optimal performance.
   * @param assetIds - Array of asset IDs to preload
   * @returns Promise that resolves when assets are loaded
   */
  preloadAssets(assetIds: string[]): Promise<AssetLoadResult>;

  /**
   * Release memory for unused assets.
   * @param assetIds - Array of asset IDs to unload
   * @returns Promise that resolves when assets are unloaded
   */
  unloadAssets(assetIds: string[]): Promise<void>;

  /**
   * Create a renderable instance of an asset.
   * @param assetId - Asset identifier
   * @param entityState - Initial entity state
   * @returns Renderable entity instance
   */
  createInstance(assetId: string, entityState: EntityState): RenderableEntity;
}

/**
 * Result of loading assets.
 */
export interface AssetLoadResult {
  /** Load success */
  success: boolean;
  /** Assets loaded */
  loaded: string[];
  /** Assets failed to load */
  failed: Array<{ id: string; error: string }>;
  /** Load duration in milliseconds */
  duration: number;
  /** Total size in bytes */
  totalSize: number;
}

/**
 * Renderable entity instance.
 */
export interface RenderableEntity {
  /** Unique instance identifier */
  id: string;
  /** Asset identifier */
  assetId: string;
  /** Current entity state */
  state: EntityState;
  /** Is instance visible */
  visible: boolean;
  /** Update instance state */
  update(state: Partial<EntityState>): void;
  /** Set visibility */
  setVisible(visible: boolean): void;
  /** Destroy instance */
  destroy(): void;
}

// ============================================================================
// ASSET CREATION INTERFACE
// ============================================================================

/**
 * Interface for creating engine-specific assets.
 */
export interface IAssetFactory {
  /**
   * Create a 2D sprite asset.
   * @param config - Sprite configuration
   * @returns Asset metadata
   */
  createSprite(config: SpriteConfig): AssetMetadata;

  /**
   * Create a voxel asset.
   * @param config - Voxel configuration
   * @returns Asset metadata
   */
  createVoxel(config: VoxelConfig): AssetMetadata;

  /**
   * Create a 3D mesh asset.
   * @param config - Mesh configuration
   * @returns Asset metadata
   */
  createMesh(config: MeshConfig): AssetMetadata;

  /**
   * Create an animated asset.
   * @param config - Animated asset configuration
   * @returns Asset metadata
   */
  createAnimated(config: AnimatedAssetConfig): AssetMetadata;

  /**
   * Create a tile asset.
   * @param config - Tile configuration
   * @returns Asset metadata
   */
  createTile(config: TileConfig): AssetMetadata;

  /**
   * Create a background asset.
   * @param config - Background configuration
   * @returns Asset metadata
   */
  createBackground(config: BackgroundConfig): AssetMetadata;
}

/**
 * Sprite asset configuration (2D).
 */
export interface SpriteConfig {
  /** Asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Sprite dimensions */
  dimensions: Dimensions;
  /** Sprite image data */
  imageData: ImageData | ArrayBuffer;
  /** Animation data if animated */
  animation?: AnimationData;
  /** Collision data */
  collision?: CollisionData;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

/**
 * Voxel asset configuration (blocky).
 */
export interface VoxelConfig {
  /** Asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Voxel grid dimensions */
  dimensions: Dimensions;
  /** Voxel data (3D array of colors/materials) */
  voxels: ArrayBuffer | Uint8Array;
  /** Voxel size in world units */
  voxelSize: number;
  /** Animation data if animated */
  animation?: AnimationData;
  /** Collision data */
  collision?: CollisionData;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

/**
 * Mesh asset configuration (3D).
 */
export interface MeshConfig {
  /** Asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Mesh dimensions/bounds */
  dimensions: Dimensions;
  ** Vertex positions */
  vertices: Float32Array;
  ** Vertex indices */
  indices: Uint16Array | Uint32Array;
  ** UV coordinates */
  uvs?: Float32Array;
  /** Vertex normals */
  normals?: Float32Array;
  /** Vertex colors */
  colors?: Float32Array;
  /** Material properties */
  material?: MaterialProperties;
  /** Animation data if rigged */
  animation?: AnimationData;
  /** Collision data */
  collision?: CollisionData;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

/**
 * Animated asset configuration.
 */
export interface AnimatedAssetConfig {
  /** Base asset configuration */
  asset: SpriteConfig | VoxelConfig | MeshConfig;
  /** Animation sequences */
  animations: AnimationData;
  /** Skeleton/bone data (for 3D) */
  skeleton?: SkeletonData;
}

/**
 * Skeleton data for rigged 3D models.
 */
export interface SkeletonData {
  /** Bone hierarchy */
  bones: BoneData[];
  /** Inverse bind poses */
  inverseBindPoses: Float32Array[];
}

/**
 * Bone data for skeleton.
 */
export interface BoneData {
  /** Bone name */
  name: string;
  /** Parent bone index (-1 for root) */
  parent: number;
  /** Bone transform */
  transform: TransformData;
}

/**
 * Transform data for bones.
 */
export interface TransformData {
  /** Position */
  position: [number, number, number];
  /** Rotation (quaternion) */
  rotation: [number, number, number, number];
  /** Scale */
  scale: [number, number, number];
}

/**
 * Tile asset configuration.
 */
export interface TileConfig {
  /** Asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Tile dimensions */
  dimensions: Dimensions;
  /** Tile category */
  category: AssetCategory;
  /** Tile image data */
  imageData: ImageData | ArrayBuffer;
  /** Collision data */
  collision?: CollisionData;
  /** Tile type (solid, water, etc.) */
  type?: string;
  /** Custom properties */
  properties?: Record<string, unknown>;
}

/**
 * Background asset configuration.
 */
export interface BackgroundConfig {
  /** Asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Background dimensions */
  dimensions: Dimensions;
  /** Background image data */
  imageData: ImageData | ArrayBuffer;
  /** Parallax factor (0 = no parallax, 1 = full) */
  parallax?: number;
  /** Scroll speed for animated backgrounds */
  scrollSpeed?: [number, number];
  /** Custom properties */
  properties?: Record<string, unknown>;
}

// ============================================================================
// SCENE MANAGEMENT INTERFACE
// ============================================================================

/**
 * Interface for managing game scenes.
 */
export interface ISceneManager {
  /**
   * Load a scene.
   * @param sceneId - Scene identifier
   * @returns Promise that resolves when scene is loaded
   */
  loadScene(sceneId: string): Promise<SceneLoadResult>;

  /**
   * Unload current scene.
   * @returns Promise that resolves when scene is unloaded
   */
  unloadScene(): Promise<void>;

  /**
   * Get current scene.
   * @returns Current scene or undefined if none loaded
   */
  getCurrentScene(): IScene | undefined;

  /**
   * Create a new scene.
   * @param config - Scene configuration
   * @returns New scene instance
   */
  createScene(config: SceneConfig): IScene;

  /**
   * Add an entity to current scene.
   * @param entity - Entity to add
   * @returns Added entity
   */
  addEntity(entity: EntityState): RenderableEntity;

  /**
   * Remove an entity from current scene.
   * @param entityId - Entity identifier
   * @returns True if entity was removed
   */
  removeEntity(entityId: string): boolean;

  /**
   * Get an entity by ID.
   * @param entityId - Entity identifier
   * @returns Entity or undefined if not found
   */
  getEntity(entityId: string): RenderableEntity | undefined;
}

/**
 * Result of loading a scene.
 */
export interface SceneLoadResult {
  /** Load success */
  success: boolean;
  /** Scene identifier */
  sceneId: string;
  /** Load warnings */
  warnings: string[];
  /** Load errors */
  errors: string[];
  /** Load duration in milliseconds */
  duration: number;
  /** Entities loaded */
  entitiesLoaded: number;
}

/**
 * Scene configuration.
 */
export interface SceneConfig {
  /** Scene identifier */
  id: string;
  /** Scene name */
  name: string;
  /** Scene dimensions */
  dimensions: Dimensions;
  /** Environment settings */
  environment: EnvironmentState;
  /** Lighting configuration */
  lighting: LightState[];
  /** Initial entities */
  entities?: EntityState[];
  /** Scene metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Scene interface.
 */
export interface IScene {
  /** Scene identifier */
  readonly id: string;
  /** Scene name */
  readonly name: string;
  /** Scene dimensions */
  readonly dimensions: Dimensions;
  /** Is scene loaded */
  readonly isLoaded: boolean;
  /** Entities in scene */
  readonly entities: Map<string, RenderableEntity>;
  /** Scene environment */
  environment: EnvironmentState;
  /** Scene lighting */
  lighting: LightState[];

  /**
   * Update scene.
   * @param deltaTime - Time since last update in seconds
   */
  update(deltaTime: number): void;

  /**
   * Render scene.
   */
  render(): void;

  /**
   * Add an entity to scene.
   * @param entity - Entity to add
   * @returns Added renderable entity
   */
  addEntity(entity: EntityState): RenderableEntity;

  /**
   * Remove an entity from scene.
   * @param entityId - Entity identifier
   * @returns True if entity was removed
   */
  removeEntity(entityId: string): boolean;

  /**
   * Get an entity by ID.
   * @param entityId - Entity identifier
   * @returns Entity or undefined
   */
  getEntity(entityId: string): RenderableEntity | undefined;

  /**
   * Clear all entities from scene.
   */
  clearEntities(): void;
}

// ============================================================================
// INPUT HANDLING INTERFACE
// ============================================================================

/**
 * Interface for handling input across engines.
 */
export interface IInputHandler {
  /**
   * Initialize input handling.
   * @param element - Target DOM element for input capture
   */
  initialize(element: HTMLElement): void;

  /**
   * Register an input action.
   * @param action - Action configuration
   */
  registerAction(action: InputAction): void;

  /**
   * Unregister an input action.
   * @param actionId - Action identifier
   */
  unregisterAction(actionId: string): void;

  /**
   * Get current input state.
   * @returns Current input state
   */
  getState(): InputState;

  /**
   * Check if an action is active.
   * @param actionId - Action identifier
   * @returns True if action is active
   */
  isActionActive(actionId: string): boolean;

  /**
   * Get action value (for analog input).
   * @param actionId - Action identifier
   * @returns Action value (-1 to 1)
   */
  getActionValue(actionId: string): number;

  /**
   * Set input context.
   * @param context - Context identifier
   */
  setContext(context: string): void;

  /**
   * Enable or disable input handling.
   * @param enabled - Enable state
   */
  setEnabled(enabled: boolean): void;
}

/**
 * Input action configuration.
 */
export interface InputAction {
  /** Action identifier */
  id: string;
  /** Action name */
  name: string;
  /** Input bindings */
  bindings: InputBinding[];
  /** Action type */
  type: InputActionType;
  /** Context this action belongs to */
  context?: string;
}

/**
 * Input binding types.
 */
export interface InputBinding {
  /** Binding type */
  type: "keyboard" | "mouse" | "gamepad" | "touch";
  /** Binding code (e.g., "KeyA", "MouseLeft") */
  code: string;
  /** Modifier keys required */
  modifiers?: string[];
}

/**
 * Input action types.
 */
export enum InputActionType {
  /** Binary (pressed/released) */
  BINARY = "binary",
  /** Analog (continuous value) */
  ANALOG = "analog",
  /** Vector (2D/3D direction) */
  VECTOR = "vector",
}

/**
 * Current input state.
 */
export interface InputState {
  /** Active actions */
  actions: Record<string, boolean | number | [number, number]>;
  /** Mouse position */
  mousePosition: [number, number];
  /** Mouse delta */
  mouseDelta: [number, number];
  /** Mouse wheel delta */
  mouseWheel: number;
  /** Active context */
  context: string;
  /** Input enabled */
  enabled: boolean;
}

// ============================================================================
// AUDIO INTERFACE
// ============================================================================

/**
 * Interface for audio playback across engines.
 */
export interface IAudioHandler {
  /**
   * Initialize audio system.
   * @param config - Audio configuration
   */
  initialize(config: AudioConfig): void;

  /**
   * Play a sound.
   * @param soundId - Sound identifier
   * @param options - Playback options
   * @returns Playback handle
   */
  play(soundId: string, options?: PlaybackOptions): AudioHandle;

  /**
   * Stop a playing sound.
   * @param handle - Playback handle
   */
  stop(handle: AudioHandle): void;

  /**
   * Pause a playing sound.
   * @param handle - Playback handle
   */
  pause(handle: AudioHandle): void;

  /**
   * Resume a paused sound.
   * @param handle - Playback handle
   */
  resume(handle: AudioHandle): void;

  /**
   * Set master volume.
   * @param volume - Volume (0-1)
   */
  setMasterVolume(volume: number): void;

  /**
   * Set music volume.
   * @param volume - Volume (0-1)
   */
  setMusicVolume(volume: number): void;

  /**
   * Set SFX volume.
   * @param volume - Volume (0-1)
   */
  setSFXVolume(volume: number): void;

  /**
   * Register a sound.
   * @param soundId - Sound identifier
   * @param data - Audio data
   * @param metadata - Sound metadata
   */
  registerSound(
    soundId: string,
    data: ArrayBuffer,
    metadata: SoundMetadata,
  ): void;

  /**
   * Unregister a sound.
   * @param soundId - Sound identifier
   */
  unregisterSound(soundId: string): void;
}

/**
 * Audio configuration.
 */
export interface AudioConfig {
  /** Sample rate */
  sampleRate: number;
  /** Channel count */
  channels: number;
  /** Buffer size */
  bufferSize: number;
  /** Enable spatial audio */
  spatial?: boolean;
}

/**
 * Playback options.
 */
export interface PlaybackOptions {
  /** Volume (0-1) */
  volume?: number;
  ** Pitch multiplier */
  pitch?: number;
  /** Pan (-1 to 1) */
  pan?: number;
  /** Loop playback */
  loop?: boolean;
  /** 3D position for spatial audio */
  position?: [number, number, number];
}

/**
 * Audio playback handle.
 */
export interface AudioHandle {
  /** Unique handle identifier */
  id: string;
  /** Sound being played */
  soundId: string;
  /** Is currently playing */
  playing: boolean;
  /** Playback position in seconds */
  position: number;
  /** Duration in seconds */
  duration: number;
}

/**
 * Sound metadata.
 */
export interface SoundMetadata {
  /** Sound name */
  name: string;
  /** Sound category (music, sfx, ambient) */
  category: "music" | "sfx" | "ambient";
  /** Duration in seconds */
  duration: number;
  /** Sample rate */
  sampleRate: number;
  /** Channels */
  channels: number;
}

// ============================================================================
// PHYSICS INTERFACE
// ============================================================================

/**
 * Interface for physics simulation across engines.
 */
export interface IPhysicsHandler {
  /**
   * Initialize physics system.
   * @param config - Physics configuration
   */
  initialize(config: PhysicsConfig): void;

  /**
   * Step physics simulation.
   * @param deltaTime - Time step in seconds
   */
  step(deltaTime: number): void;

  /**
   * Add a physics body.
   * @param body - Body configuration
   * @returns Body handle
   */
  addBody(body: PhysicsBody): PhysicsBodyHandle;

  /**
   * Remove a physics body.
   * @param handle - Body handle
   */
  removeBody(handle: PhysicsBodyHandle): void;

  /**
   * Get body state.
   * @param handle - Body handle
   * @returns Current body state
   */
  getBodyState(handle: PhysicsBodyHandle): PhysicsBodyState;

  /**
   * Set body state.
   * @param handle - Body handle
   * @param state - New body state
   */
  setBodyState(handle: PhysicsBodyHandle, state: PhysicsBodyState): void;

  /**
   * Apply force to a body.
   * @param handle - Body handle
   * @param force - Force vector
   * @param point - Application point (optional)
   */
  applyForce(
    handle: PhysicsBodyHandle,
    force: [number, number, number],
    point?: [number, number, number],
  ): void;

  /**
   * Apply impulse to a body.
   * @param handle - Body handle
   * @param impulse - Impulse vector
   * @param point - Application point (optional)
   */
  applyImpulse(
    handle: PhysicsBodyHandle,
    impulse: [number, number, number],
    point?: [number, number, number],
  ): void;

  /**
   * Set body velocity.
   * @param handle - Body handle
   * @param velocity - Velocity vector
   */
  setVelocity(
    handle: PhysicsBodyHandle,
    velocity: [number, number, number],
  ): void;

  /**
   * Raycast for collision detection.
   * @param from - Start point
   * @param to - End point
   * @returns Raycast result
   */
  raycast(
    from: [number, number, number],
    to: [number, number, number],
  ): RaycastResult | null;
}

/**
 * Physics configuration.
 */
export interface PhysicsConfig {
  /** Gravity vector */
  gravity: [number, number, number];
  /** Physics steps per second */
  stepsPerSecond: number;
  /** Number of solver iterations */
  iterations: number;
  /** Enable 3D physics (false = 2D) */
  is3D: boolean;
}

/**
 * Physics body configuration.
 */
export interface PhysicsBody {
  /** Body identifier */
  id: string;
  /** Body type */
  type: PhysicsBodyType;
  /** Collision shape */
  shape: CollisionShape;
  /** Mass */
  mass: number;
  /** Friction coefficient */
  friction: number;
  /** Restitution (bounciness) */
  restitution: number;
  /** Initial position */
  position: [number, number, number];
  /** Initial rotation */
  rotation: [number, number, number];
  /** Linear damping */
  linearDamping?: number;
  /** Angular damping */
  angularDamping?: number;
}

/**
 * Physics body types.
 */
export enum PhysicsBodyType {
  /** Static body (infinite mass, immovable) */
  STATIC = "static",
  /** Dynamic body (affected by forces) */
  DYNAMIC = "dynamic",
  /** Kinematic body (moved by code, not forces) */
  KINEMATIC = "kinematic",
}

/**
 * Collision shape configuration.
 */
export interface CollisionShape {
  /** Shape type */
  type: "box" | "sphere" | "capsule" | "cylinder" | "convex" | "mesh";
  /** Shape dimensions (type-dependent) */
  dimensions: Record<string, number>;
  /** Shape offset */
  offset?: [number, number, number];
}

/**
 * Physics body handle.
 */
export interface PhysicsBodyHandle {
  /** Unique handle identifier */
  id: string;
  /** Body identifier */
  bodyId: string;
}

/**
 * Physics body state.
 */
export interface PhysicsBodyState {
  /** Position */
  position: [number, number, number];
  /** Rotation (Euler angles) */
  rotation: [number, number, number];
  /** Linear velocity */
  velocity: [number, number, number];
  /** Angular velocity */
  angularVelocity: [number, number, number];
  /** Is sleeping */
  sleeping: boolean;
}

/**
 * Raycast result.
 */
export interface RaycastResult {
  /** Hit position */
  position: [number, number, number];
  /** Hit normal */
  normal: [number, number, number];
  /** Hit body */
  body: PhysicsBodyHandle;
  /** Distance from start */
  distance: number;
}

// ============================================================================
// BASE ENGINE CLASS
// ============================================================================

/**
 * Base implementation of IGameEngine that all engines should extend.
 * Provides common functionality and enforces the interface contract.
 */
export abstract class BaseEngine implements IGameEngine {
  protected _state: EngineState = {
    value: EngineStateValue.UNINITIALIZED,
    timestamp: Date.now(),
    metadata: {},
  };
  protected _config: EngineInitConfig | null = null;
  protected _quality: QualityTier = "medium" as QualityTier;
  protected _backend: RenderingBackend = "opengl" as RenderingBackend;

  abstract readonly engineId: GameEngine;
  abstract readonly displayInfo: EngineDisplayInfo;

  get state(): EngineState {
    return this._state;
  }

  get isInitialized(): boolean {
    return (
      this._state.value === EngineStateValue.IDLE ||
      this._state.value === EngineStateValue.RUNNING ||
      this._state.value === EngineStateValue.PAUSED
    );
  }

  get isRunning(): boolean {
    return this._state.value === EngineStateValue.RUNNING;
  }

  get currentQuality(): QualityTier {
    return this._quality;
  }

  get activeBackend(): RenderingBackend {
    return this._backend;
  }

  abstract initialize(config: EngineInitConfig): Promise<EngineInitResult>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract loadState(state: UniversalGameState): Promise<StateLoadResult>;
  abstract saveState(): Promise<UniversalGameState>;
  abstract getState(): UniversalGameState;
  abstract render(deltaTime: number): RenderStats;
  abstract update(deltaTime: number): UpdateStats;

  supportsAssetFormat(format: AssetFormat): boolean {
    switch (this.engineId) {
      case "microverse":
        return format === "sprite_2d" || format === "universal";
      case "luanti":
        return format === "voxel" || format === "universal";
      case "openrts":
        return format === "mesh_3d" || format === "universal";
      default:
        return false;
    }
  }

  supportsQuality(quality: QualityTier): boolean {
    switch (this.engineId) {
      case "microverse":
        return quality === "low";
      case "luanti":
        return quality === "low" || quality === "medium";
      case "openrts":
        return quality === "medium" || quality === "high" || quality === "ultra";
      default:
        return false;
    }
  }

  abstract getMetrics(): EngineMetrics;

  async handleCapabilityChange(
    capabilities: PlatformCapabilities,
  ): Promise<CapabilityChangeResult> {
    const actions: CapabilityChangeAction[] = [];
    const warnings: string[] = [];
    let qualityChanged = false;
    let backendChanged = false;
    let newQuality: QualityTier | undefined;
    let newBackend: RenderingBackend | undefined;

    // Check if we need to adjust quality
    if (!this.supportsQuality(capabilities.recommendedQuality)) {
      newQuality = this.getBestSupportedQuality(capabilities);
      if (newQuality !== this._quality) {
        actions.push({
          type: CapabilityActionType.QUALITY_ADJUSTED,
          description: `Quality tier adjusted from ${this._quality} to ${newQuality}`,
          params: { oldQuality: this._quality, newQuality },
          result: "success",
        });
        this._quality = newQuality;
        qualityChanged = true;
      }
    }

    // Check if we need to change backend
    if (!capabilities.supportedBackends.includes(this._backend)) {
      newBackend = capabilities.supportedBackends[0];
      actions.push({
        type: CapabilityActionType.BACKEND_CHANGED,
        description: `Rendering backend changed from ${this._backend} to ${newBackend}`,
        params: { oldBackend: this._backend, newBackend },
        result: "success",
      });
      this._backend = newBackend;
      backendChanged = true;
    }

    return {
      success: true,
      qualityChanged,
      newQuality,
      backendChanged,
      newBackend,
      warnings,
      actions,
    };
  }

  protected getBestSupportedQuality(
    capabilities: PlatformCapabilities,
  ): QualityTier {
    const qualities: QualityTier[] = ["ultra", "high", "medium", "low"];
    for (const quality of qualities) {
      if (this.supportsQuality(quality)) {
        return quality;
      }
    }
    return "low";
  }

  protected updateState(value: EngineStateValue, error?: string): void {
    this._state = {
      value,
      timestamp: Date.now(),
      metadata: { ...this._state.metadata },
      error,
    };
  }
}

// ============================================================================
// ENGINE ADAPTER TYPES
// ============================================================================

/**
 * Adapter for integrating existing engines with the abstraction layer.
 */
export interface IEngineAdapter {
  /** Engine being adapted */
  readonly engineId: GameEngine;

  /**
   * Initialize the adapter.
   * @param config - Initialization configuration
   */
  initialize(config: AdapterConfig): Promise<void>;

  /**
   * Convert universal state to engine-specific state.
   * @param state - Universal game state
   * @returns Engine-specific state data
   */
  universalToEngine(state: UniversalGameState): unknown;

  /**
   * Convert engine state to universal state.
   * @param state - Engine-specific state
   * @returns Universal game state
   */
  engineToUniversal(state: unknown): UniversalGameState;

  /**
   * Convert universal asset to engine-specific asset.
   * @param asset - Universal asset data
   * @returns Engine-specific asset data
   */
  assetToEngine(asset: AssetMetadata): unknown;

  /**
   * Get engine-specific metrics.
   * @returns Engine metrics
   */
  getMetrics(): EngineMetrics;
}

/**
 * Adapter initialization configuration.
 */
export interface AdapterConfig {
  /** Target quality tier */
  quality: QualityTier;
  /** Rendering backend */
  backend: RenderingBackend;
  /** Platform capabilities */
  capabilities: PlatformCapabilities;
  /** Engine-specific configuration */
  engineConfig?: Record<string, unknown>;
}
