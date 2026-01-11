/**
 * Asset Regeneration System - Type Definitions
 *
 * Defines the complete type system for regenerating assets across
 * three engine forms: MicroVerse (2D sprite), Luanti (voxel), and OpenRTS (3D mesh).
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * The three engine forms that assets can be regenerated into
 */
export enum AssetForm {
  /** 2D/2.5D sprite, NES-SNES style pixel art */
  MICROVERSE = 'microverse',
  /** Voxel/blocky model, isometric projection */
  LUANTI = 'luanti',
  /** Full 3D mesh, PS2+ quality with modern features */
  OPENRTS = 'openrts'
}

/**
 * Status of an asset regeneration operation
 */
export enum RegenerationStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CACHED = 'cached',
  PARTIAL = 'partial' // Some forms succeeded, others failed
}

/**
 * Style preservation priority
 */
export enum StylePriority {
  /** Exact color match, may limit form conversion */
  COLOR_EXACT = 'color_exact',
  /** Balanced color and form adaptation */
  BALANCED = 'balanced',
  /** Prioritize form correctness over color */
  FORM_FOCUSED = 'form_focused'
}

/**
 * Quality level for generated assets
 */
export enum QualityLevel {
  /** Fast generation, lower quality */
  DRAFT = 'draft',
  /** Standard quality */
  STANDARD = 'standard',
  /** High quality with refinement */
  HIGH = 'high',
  /** Maximum quality, slower generation */
  ULTRA = 'ultra'
}

/**
 * Sprite rendering style for MicroVerse form
 */
export enum SpriteStyle {
  /** 8-bit NES style, limited palette */
  NES_8BIT = 'nes_8bit',
  /** 16-bit SNES style, more colors */
  SNES_16BIT = 'snes_16bit',
  /** Enhanced 16-bit with effects */
  GENESIS_16BIT = 'genesis_16bit',
  /** Modern pixel art with alpha */
  MODERN_PIXEL = 'modern_pixel'
}

/**
 * Voxel generation style for Luanti form
 */
export enum VoxelStyle {
  /** Classic Minecraft-style blocks */
  CLASSIC = 'classic',
  /** Smoother voxel clusters */
  SMOOTH = 'smooth',
  /** Cross-hatch pattern for detail */
  CROSS_HATCH = 'cross_hatch',
  /** Height-map based extrusion */
  HEIGHT_MAP = 'height_map'
}

/**
 * Mesh generation style for OpenRTS form
 */
export enum MeshStyle {
  /** Low poly, PS2 era */
  LOW_POLY = 'low_poly',
  /** Standard polygon count */
  STANDARD = 'standard',
  /** High detail mesh */
  HIGH_POLY = 'high_poly',
  /** Optimized for real-time */
  OPTIMIZED = 'optimized'
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Color palette for style preservation
 */
export interface ColorPalette {
  /** Primary color (most prominent) */
  primary: string;
  /** Secondary color */
  secondary: string;
  /** Accent color for highlights */
  accent: string;
  /** Shadow/dark color */
  shadow: string;
  /** Background color (optional) */
  background?: string;
  /** Additional palette colors */
  extras?: string[];
  /** Hex values for programmatic access */
  hexValues: string[];
}

/**
 * Proportional measurements for maintaining silhouette
 */
export interface Proportions {
  /** Width to height ratio (0-1) */
  widthToHeight: number;
  /** Character/object height in reference units */
  height: number;
  /** Shoulder width ratio */
  shoulderRatio?: number;
  /** Head size ratio */
  headRatio?: number;
  /** Limb length ratios */
  limbRatios?: {
    upperArm: number;
    lowerArm: number;
    upperLeg: number;
    lowerLeg: number;
  };
  /** Bounding box in reference space */
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

/**
 * Iconic silhouette features for recognition
 */
export interface SilhouetteFeatures {
  /** Outline path (normalized 0-1 coordinates) */
  outline: number[][];
  /** Key landmark points */
  landmarks: {
    [key: string]: [number, number]; // e.g., "head": [0.5, 0.1]
  };
  /** Distinctive features list */
  distinctiveFeatures: string[];
  /** Symmetry type */
  symmetry: 'bilateral' | 'radial' | 'none';
}

/**
 * Material hints for texturing
 */
export interface MaterialHints {
  /** Primary surface type */
  primary: SurfaceType;
  /** Secondary surface type */
  secondary?: SurfaceType;
  /** Metalness (0-1) */
  metalness?: number;
  /** Roughness (0-1) */
  roughness?: number;
  /** Emission strength */
  emission?: number;
  /** Transparency (0-1) */
  transparency?: number;
}

/**
 * Surface material types
 */
export type SurfaceType =
  | 'organic' // Skin, fur, wood
  | 'metallic' // Armor, weapons
  | 'stone' // Rock, brick
  | 'fabric' // Clothing, cloth
  | 'glass' // Windows, crystals
  | 'energy' // Magic, fire, electricity
  | 'liquid' // Water, slime
  | 'vegetation' // Plants, leaves
  | 'custom';

// ============================================================================
// ASSET DEFINITIONS
// ============================================================================

/**
 * Base asset definition
 */
export interface BaseAsset {
  /** Unique asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Asset category/type */
  category: string;
  /** Tags for search */
  tags: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  modifiedAt: Date;
  /** Original source file path */
  sourcePath: string;
}

/**
 * MicroVerse sprite asset
 */
export interface MicroVerseAsset extends BaseAsset {
  form: AssetForm.MICROVERSE;
  /** Sprite sheet configuration */
  spriteSheet: {
    width: number;
    height: number;
    frames: number;
    rows: number;
    columns: number;
  };
  /** Per-frame data */
  frames: SpriteFrame[];
  /** Sprite rendering style */
  style: SpriteStyle;
  /** Color palette */
  palette: ColorPalette;
  /** Animation data */
  animations?: SpriteAnimation[];
}

/**
 * Individual sprite frame
 */
export interface SpriteFrame {
  /** Frame index */
  index: number;
  /** Frame duration in ms */
  duration: number;
  /** Image data (base64 or buffer) */
  imageData: string | Buffer;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Pivot point (normalized) */
  pivot: [number, number];
}

/**
 * Sprite animation sequence
 */
export interface SpriteAnimation {
  /** Animation name */
  name: string;
  /** Frame indices */
  frames: number[];
  /** Looping behavior */
  loop: boolean;
  /** Playback speed multiplier */
  speed: number;
}

/**
 * Luanti voxel asset
 */
export interface LuantiAsset extends BaseAsset {
  form: AssetForm.LUANTI;
  /** Voxel grid dimensions */
  dimensions: [number, number, number]; // [width, height, depth]
  /** Voxel data array */
  voxels: VoxelData[];
  /** Voxel generation style */
  style: VoxelStyle;
  /** Isometric projection settings */
  isometric: {
    /** Angle in degrees */
    angle: number;
    /** Scale factor */
    scale: number;
  };
  /** Material mappings */
  materials: VoxelMaterialMap[];
}

/**
 * Individual voxel data
 */
export interface VoxelData {
  /** Grid position */
  position: [number, number, number];
  /** Color value */
  color: string;
  /** Material index */
  material: number;
  /** Optional variant for texture selection */
  variant?: number;
}

/**
 * Material mapping for voxels
 */
export interface VoxelMaterialMap {
  /** Material index */
  index: number;
  /** Material name */
  name: string;
  /** Texture path */
  texture: string;
  /** Base color */
  color: string;
}

/**
 * OpenRTS mesh asset
 */
export interface OpenRTSAsset extends BaseAsset {
  form: AssetForm.OPENRTS;
  /** Mesh generation style */
  style: MeshStyle;
  /** Mesh data */
  mesh: MeshData;
  /** Material assignments */
  materials: MeshMaterial[];
  /** Skeleton/bone data (optional) */
  skeleton?: SkeletonData;
  /** Animation data (optional) */
  animations?: MeshAnimation[];
  /** LOD levels */
  lods?: LODLevel[];
}

/**
 * 3D mesh geometry data
 */
export interface MeshData {
  /** Vertex positions */
  vertices: Float32Array;
  /** Vertex normals */
  normals: Float32Array;
  /** Texture coordinates */
  uvs: Float32Array;
  /** Triangle indices */
  indices: Uint16Array | Uint32Array;
  /** Vertex colors (optional) */
  colors?: Float32Array;
  /** Tangents for normal mapping */
  tangents?: Float32Array;
  /** Bone indices for skinning */
  boneIndices?: Float32Array;
  /** Bone weights for skinning */
  boneWeights?: Float32Array;
}

/**
 * Material for mesh rendering
 */
export interface MeshMaterial {
  /** Material name */
  name: string;
  /** Shader type */
  shader: 'standard' | 'unlit' | 'toon' | 'skin' | ' foliage';
  /** Albedo color */
  albedo: string;
  /** Albedo texture */
  albedoMap?: string;
  /** Normal map */
  normalMap?: string;
  /** Roughness map */
  roughnessMap?: string;
  /** Metallic map */
  metallicMap?: string;
  /** Emission map */
  emissionMap?: string;
  /** Material properties */
  properties: {
    metalness: number;
    roughness: number;
    emission: number;
    alphaTest?: number;
  };
}

/**
 * Skeleton for rigging
 */
export interface SkeletonData {
  /** Bone definitions */
  bones: Bone[];
  /** Bone hierarchy (parent indices) */
  hierarchy: number[];
  /** Inverse bind poses */
  inverseBindPoses: Float32Array[];
}

/**
 * Individual bone
 */
export interface Bone {
  /** Bone name */
  name: string;
  /** Bone index */
  index: number;
  /** Parent bone index (-1 for root) */
  parent: number;
  /** Local position */
  position: [number, number, number];
  /** Local rotation (quaternion) */
  rotation: [number, number, number, number];
  /** Local scale */
  scale: [number, number, number];
}

/**
 * Mesh animation
 */
export interface MeshAnimation {
  /** Animation name */
  name: string;
  /** Duration in seconds */
  duration: number;
  /** Frame rate */
  frameRate: number;
  /** Track data per bone */
  tracks: AnimationTrack[];
}

/**
 * Animation track for a single bone
 */
export interface AnimationTrack {
  /** Target bone index */
  bone: number;
  /** Position keyframes */
  positions?: Keyframe[];
  /** Rotation keyframes */
  rotations?: Keyframe[];
  /** Scale keyframes */
  scales?: Keyframe[];
}

/**
 * Animation keyframe
 */
export interface Keyframe {
  /** Time in seconds */
  time: number;
  /** Value (vec3 for position/scale, quat for rotation) */
  value: number[];
}

/**
 * Level of Detail definition
 */
export interface LODLevel {
  /** LOD level (0 = highest detail) */
  level: number;
  /** Distance threshold */
  distance: number;
  /** Screen size relative threshold */
  screenSize: number;
  /** Simplified mesh data */
  mesh: MeshData;
}

// ============================================================================
// REGENERATION REQUESTS
// ============================================================================

/**
 * Request to regenerate a single asset
 */
export interface RegenerationRequest {
  /** Source asset ID or data */
  source: string | BaseAsset;
  /** Target forms to generate (default: all) */
  targetForms?: AssetForm[];
  /** Quality level */
  quality: QualityLevel;
  /** Style preservation priority */
  stylePriority: StylePriority;
  /** Override style settings */
  styleOverrides?: Partial<StyleProfile>;
  /** Force regeneration even if cached */
  forceRegenerate?: boolean;
  /** Metadata to attach */
  metadata?: Record<string, unknown>;
}

/**
 * Style profile for cross-form consistency
 */
export interface StyleProfile {
  /** Color palette */
  palette: ColorPalette;
  /** Proportions */
  proportions: Proportions;
  /** Silhouette features */
  silhouette: SilhouetteFeatures;
  /** Material hints */
  materials: MaterialHints;
  /** Overall aesthetic theme */
  theme?: string;
  /** Era/time period reference */
  era?: string;
}

/**
 * Request for batch regeneration
 */
export interface BatchRegenerationRequest {
  /** List of asset IDs to regenerate */
  assetIds: string[];
  /** Target forms for all assets */
  targetForms?: AssetForm[];
  /** Quality level */
  quality: QualityLevel;
  /** Style priority */
  stylePriority: StylePriority;
  /** Individual asset overrides */
  overrides?: Map<string, Partial<RegenerationRequest>>;
  /** Process in parallel (default: true) */
  parallel?: boolean;
  /** Max concurrent jobs */
  maxConcurrent?: number;
}

/**
 * Response for regeneration operations
 */
export interface RegenerationResponse {
  /** Asset ID */
  assetId: string;
  /** Generated forms */
  forms: GeneratedFormResult[];
  /** Overall status */
  status: RegenerationStatus;
  /** Timestamp */
  timestamp: Date;
  /** Processing time in ms */
  processingTime: number;
  /** Any errors or warnings */
  errors?: string[];
  /** Warnings */
  warnings?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result for a single generated form
 */
export interface GeneratedFormResult {
  /** Form type */
  form: AssetForm;
  /** Success status */
  success: boolean;
  /** Generated asset data (if successful) */
  asset?: MicroVerseAsset | LuantiAsset | OpenRTSAsset;
  /** File paths to generated assets */
  paths?: {
    primary: string;
    textures?: string[];
    metadata?: string;
  };
  /** Error message (if failed) */
  error?: string;
  /** Processing time for this form */
  processingTime: number;
  /** Cache hit */
  fromCache: boolean;
}

/**
 * Side-by-side comparison data
 */
export interface ComparisonView {
  /** Asset being compared */
  assetId: string;
  /** Asset name */
  assetName: string;
  /** All available forms */
  forms: {
    microverse?: MicroVerseAsset;
    luanti?: LuantiAsset;
    openrts?: OpenRTSAsset;
  };
  /** Visual comparison metrics */
  metrics: ComparisonMetrics;
  /** Rendered preview URLs */
  previews: {
    microverse?: string;
    luanti?: string;
    openrts?: string;
    sideBySide?: string;
  };
}

/**
 * Metrics for comparing forms
 */
export interface ComparisonMetrics {
  /** Color similarity (0-1) */
  colorSimilarity: number;
  /** Silhouette similarity (0-1) */
  silhouetteSimilarity: number;
  /** Proportion similarity (0-1) */
  proportionSimilarity: number;
  /** Overall consistency score (0-1) */
  overallConsistency: number;
}

/**
 * Style transfer request
 */
export interface StyleTransferRequest {
  /** Source asset ID */
  sourceAsset: string;
  /** Source form to extract style from */
  sourceForm: AssetForm;
  /** Target asset IDs to apply style to */
  targetAssets: string[];
  /** Target forms to update */
  targetForms?: AssetForm[];
  /** What aspects to transfer */
  transfer: {
    colors: boolean;
    proportions: boolean;
    silhouette: boolean;
    materials: boolean;
  };
}

/**
 * Cache status information
 */
export interface CacheStatus {
  /** Total cached assets */
  totalAssets: number;
  /** Cache size in bytes */
  cacheSize: number;
  /** Per-form counts */
  formCounts: {
    microverse: number;
    luanti: number;
    openrts: number;
  };
  /** Cache hit rate */
  hitRate: number;
  /** Oldest entry */
  oldestEntry?: Date;
  /** Newest entry */
  newestEntry?: Date;
  /** Assets needing regeneration */
  staleAssets: string[];
}

// ============================================================================
// WORKER MESSAGE TYPES
// ============================================================================

/**
 * Message sent to worker for regeneration job
 */
export interface WorkerRegenerationMessage {
  type: 'regenerate';
  jobId: string;
  request: RegenerationRequest;
}

/**
 * Progress update from worker
 */
export interface WorkerProgressMessage {
  type: 'progress';
  jobId: string;
  assetId: string;
  currentForm: AssetForm;
  progress: number; // 0-1
  stage: string;
}

/**
 * Completion message from worker
 */
export interface WorkerCompletionMessage {
  type: 'complete' | 'error';
  jobId: string;
  result?: RegenerationResponse;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Main configuration for the regeneration system
 */
export interface RegenerationConfig {
  /** Default quality level */
  defaultQuality: QualityLevel;
  /** Default style priority */
  defaultStylePriority: StylePriority;
  /** Cache settings */
  cache: {
    enabled: boolean;
    maxSize: number; // bytes
    ttl: number; // seconds
    directory: string;
  };
  /** Worker settings */
  workers: {
    enabled: boolean;
    maxWorkers: number;
    timeout: number; // ms
  };
  /** API endpoints */
  api: {
    baseUrl: string;
    timeout: number;
  };
  /** Storage settings */
  storage: {
    type: 'local' | 's3' | 'gcs';
    basePath: string;
    bucket?: string;
  };
  /** Generation settings per form */
  formSettings: {
    microverse: {
      defaultStyle: SpriteStyle;
      maxDimensions: [number, number];
      paletteSize: number;
    };
    luanti: {
      defaultStyle: VoxelStyle;
      maxVoxels: number;
      voxelSize: number;
    };
    openrts: {
      defaultStyle: MeshStyle;
      maxTriangles: number;
      maxBones: number;
    };
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Any asset form
 */
export type AnyAsset = MicroVerseAsset | LuantiAsset | OpenRTSAsset;

/**
 * Asset by form type
 */
export type AssetByForm<F extends AssetForm> = F extends AssetForm.MICROVERSE
  ? MicroVerseAsset
  : F extends AssetForm.LUANTI
  ? LuantiAsset
  : F extends AssetForm.OPENRTS
  ? OpenRTSAsset
  : never;

/**
 * Worker message types union
 */
export type WorkerMessage =
  | WorkerRegenerationMessage
  | WorkerProgressMessage
  | WorkerCompletionMessage;

/**
 * Form-specific generation options
 */
export type FormGenerationOptions<F extends AssetForm> = F extends AssetForm.MICROVERSE
  ? {
      style?: SpriteStyle;
      paletteSize?: number;
      maxFrames?: number;
    }
  : F extends AssetForm.LUANTI
  ? {
      style?: VoxelStyle;
      maxVoxels?: number;
      isometricAngle?: number;
    }
  : F extends AssetForm.OPENRTS
  ? {
      style?: MeshStyle;
      maxTriangles?: number;
      includeSkeleton?: boolean;
      lodLevels?: number;
    }
  : never;
