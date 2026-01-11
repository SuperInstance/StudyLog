/**
 * Quality Scaling System - Type Definitions
 *
 * Progressive enhancement system for 3D assets and simulations.
 * Scales from low-end voxels to high-end 3D based on hardware and budget.
 *
 * @fileoverview Core types for the quality scaling system
 */

// ============================================================================
// Quality Tier Enumeration
// ============================================================================

/**
 * Quality tiers represent discrete levels of visual fidelity.
 * Each tier defines the maximum quality level that can be used
 * based on hardware capabilities and user budget constraints.
 */
export enum QualityTier {
  /** Pure voxels, 2D sprites, minimal effects */
  POTATO = 0,
  /** Simple 3D, low poly, basic lighting */
  LOW = 1,
  /** Standard 3D, basic shaders, standard textures */
  MEDIUM = 2,
  /** Detailed 3D, PBR materials, shadows */
  HIGH = 3,
  /** Cinematic, ray tracing, maximum detail */
  ULTRA = 4,
}

/**
 * User subscription/budget tiers that constrain maximum quality.
 * Free users have lower quality ceilings than paid users.
 */
export enum BudgetTier {
  /** Free tier users - quality capped at LOW */
  FREE = 0,
  /** Basic subscription - quality capped at MEDIUM */
  BASIC = 1,
  /** Premium subscription - quality capped at HIGH */
  PREMIUM = 2,
  /** Pro/Enterprise - no quality caps */
  UNLIMITED = 3,
}

/**
 * Hardware capability tiers based on detected GPU/CPU performance.
 */
export enum HardwareTier {
  /** Minimal hardware - integrated graphics, low RAM */
  MINIMAL = 0,
  /** Entry level - dedicated GPU, moderate RAM */
  ENTRY = 1,
  /** Mid range - decent GPU, good RAM */
  MID_RANGE = 2,
  /** High end - powerful GPU, ample RAM */
  HIGH_END = 3,
  /** Enthusiast - top-tier hardware, SLI/Crossfire */
  ENTHUSIAST = 4,
}

// ============================================================================
// Hardware Detection Types
// ============================================================================

/**
 * GPU capability information for quality decisions.
 */
export interface GPUCapabilities {
  /** GPU vendor */
  vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'qualcomm' | 'unknown';
  /** GPU name/model */
  name: string;
  /** Video RAM in megabytes */
  vramMb: number;
  /** Estimated GPU tier based on performance */
  tier: HardwareTier;
  /** CUDA compute capability (NVIDIA only) */
  computeCapability?: string;
  /** Ray tracing support */
  supportsRayTracing: boolean;
  /** Estimated TFLOPS (for performance comparison) */
  estimatedTFLOPS: number;
  /** Supported graphics API versions */
  apis: {
    webgl2: boolean;
    webgpu: boolean;
    directx12?: boolean;
    vulkan?: boolean;
    metal?: boolean;
  };
  /** Is this a mobile/integrated GPU */
  isMobile: boolean;
  /** Is this a Jetson/embedded device */
  isEmbedded: boolean;
}

/**
 * System capability information.
 */
export interface SystemCapabilities {
  /** Operating system platform */
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'unknown';
  /** CPU architecture */
  arch: 'x64' | 'arm64' | 'x86' | 'unknown';
  /** Total system RAM in megabytes */
  ramMb: number;
  /** Number of CPU cores (physical) */
  cpuCores: number;
  /** CPU model name */
  cpuModel: string;
  /** Estimated CPU tier */
  cpuTier: HardwareTier;
  /** Available storage space in MB */
  storageMb: number;
  /** Network connection type (for cloud asset decisions) */
  networkType: 'offline' | 'slow' | '3g' | '4g' | '5g' | 'wifi' | 'ethernet';
  /** Estimated bandwidth in Mbps */
  estimatedBandwidth: number;
}

/**
 * Complete hardware profile combining GPU and system capabilities.
 */
export interface HardwareProfile {
  /** GPU information */
  gpu: GPUCapabilities;
  /** System information */
  system: SystemCapabilities;
  /** Overall hardware tier (minimum of GPU and CPU tiers) */
  overallTier: HardwareTier;
  /** Timestamp of detection */
  detectedAt: string;
  /** Unique hardware fingerprint for caching */
  fingerprint: string;
}

// ============================================================================
// Budget/User Types
// ============================================================================

/**
 * User budget information for quality constraints.
 */
export interface UserBudget {
  /** Unique user identifier */
  userId: string;
  /** Current subscription tier */
  tier: BudgetTier;
  /** Daily remaining budget in USD */
  dailyRemaining: number;
  /** Daily budget limit in USD */
  dailyLimit: number;
  /** Monthly remaining budget in USD */
  monthlyRemaining: number;
  /** Monthly budget limit in USD */
  monthlyLimit: number;
  /** Grain tokens balance (platform currency) */
  grainBalance: number;
  /** User preferences for quality vs performance */
  preference: 'performance' | 'balanced' | 'quality' | 'ultra';
  /** Override quality tier (if manually set) */
  overrideTier?: QualityTier;
  /** Whether user has opted into higher quality at cost */
  highQualityOptIn: boolean;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Quality constraint combining hardware and budget limitations.
 */
export interface QualityConstraint {
  /** Maximum allowed quality tier */
  maxTier: QualityTier;
  /** Minimum required quality tier */
  minTier: QualityTier;
  /** Recommended quality tier */
  recommendedTier: QualityTier;
  /** Hardware tier */
  hardwareTier: HardwareTier;
  /** Budget tier */
  budgetTier: BudgetTier;
  /** Whether quality is limited by hardware */
  hardwareLimited: boolean;
  /** Whether quality is limited by budget */
  budgetLimited: boolean;
  /** Can user upgrade quality via payment */
  canUpgrade: boolean;
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

/**
 * Real-time performance metrics.
 */
export interface PerformanceMetrics {
  /** Current frames per second */
  fps: number;
  /** Average FPS over the sampling period */
  avgFps: number;
  /** 1st percentile FPS (worst 1% of frames) */
  fps1stPercentile: number;
  /** Frame time in milliseconds */
  frameTime: number;
  /** Average frame time */
  avgFrameTime: number;
  /** GPU usage percentage (0-100) */
  gpuUsage: number;
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Memory usage in megabytes */
  memoryUsage: number;
  /** Memory usage percentage */
  memoryPercent: number;
  /** Network latency in milliseconds */
  latency: number;
  /** Time to first frame in milliseconds */
  timeToFirstFrame: number;
  /** Timestamp of measurement */
  timestamp: string;
}

/**
 * Performance threshold configuration.
 */
export interface PerformanceThresholds {
  /** Target FPS */
  targetFps: number;
  /** Minimum acceptable FPS */
  minFps: number;
  /** Maximum acceptable frame time (ms) */
  maxFrameTime: number;
  /** Maximum GPU usage percentage */
  maxGpuUsage: number;
  /** Maximum CPU usage percentage */
  maxCpuUsage: number;
  /** Maximum memory usage percentage */
  maxMemoryPercent: number;
  /** Duration of poor performance before downgrade (ms) */
  degradationTimeout: number;
  /** Duration of good performance before upgrade (ms) */
  improvementTimeout: number;
}

/**
 * Performance sampling result over a time window.
 */
export interface PerformanceSample {
  /** Start of sample window */
  startTime: string;
  /** End of sample window */
  endTime: string;
  /** Number of frames in sample */
  frameCount: number;
  /** Average metrics */
  average: PerformanceMetrics;
  /** Minimum FPS during sample */
  minFps: number;
  /** Maximum FPS during sample */
  maxFps: number;
  /** Standard deviation of FPS */
  fpsStdDev: number;
  /** Number of frame drops (below min FPS) */
  frameDrops: number;
  /** Overall performance score (0-100) */
  score: number;
}

// ============================================================================
// Level of Detail (LOD) Types
// ============================================================================

/**
 * LOD level for assets at different distances/quality settings.
 */
export interface LODLevel {
  /** LOD level (0 = highest quality) */
  level: number;
  /** Quality tier this LOD is for */
  qualityTier: QualityTier;
  /** Maximum distance to use this LOD */
  maxDistance: number;
  /** Polygon count target */
  polyCount: number;
  /** Texture resolution (width x height) */
  textureSize: [number, number];
  /** Whether to use mipmaps */
  useMipmaps: boolean;
  /** Shader complexity level */
  shaderComplexity: 'basic' | 'standard' | 'advanced' | 'cinematic';
  /** Asset file/URL for this LOD */
  assetUrl: string;
  /** Estimated file size in bytes */
  fileSize: number;
  /** Estimated load time in milliseconds */
  estimatedLoadTime: number;
}

/**
 * LOD configuration for a specific asset.
 */
export interface AssetLOD {
  /** Asset identifier */
  assetId: string;
  /** Asset type */
  assetType: 'model' | 'environment' | 'character' | 'prop' | 'effect';
  /** Available LOD levels */
  lods: LODLevel[];
  /** Whether to use voxel fallback */
  hasVoxelFallback: boolean;
  /** Voxel asset URL */
  voxelUrl?: string;
  /** Whether to use 2D sprite fallback */
  hasSpriteFallback: boolean;
  /** Sprite asset URL */
  spriteUrl?: string;
  /** Current active LOD level */
  currentLod: number;
  /** Last updated timestamp */
  updatedAt: string;
}

// ============================================================================
// Voxel to 3D Types
// ============================================================================

/**
 * Voxel representation of an asset.
 */
export interface VoxelAsset {
  /** Asset identifier */
  assetId: string;
  /** Voxel grid dimensions */
  dimensions: [number, number, number];
  /** Voxel data (packed) */
  voxelData: Uint8Array;
  /** Color palette */
  palette: Array<[number, number, number]>;
  /** Voxel size in world units */
  voxelSize: number;
  /** Origin point in grid */
  origin: [number, number, number];
  /** Whether this can be upgraded to 3D */
  upgradable: boolean;
  /** Target 3D asset ID if upgraded */
  targetAssetId?: string;
}

/**
 * Runtime upgrade path from voxel to 3D.
 */
export interface UpgradePath {
  /** Source asset ID (voxel) */
  sourceAssetId: string;
  /** Target asset ID (3D) */
  targetAssetId: string;
  /** Quality tier of target */
  targetTier: QualityTier;
  /** Estimated download size */
  downloadSize: number;
  /** Estimated processing time */
  processingTime: number;
  /** Whether download is in progress */
  downloading: boolean;
  /** Download progress (0-1) */
  downloadProgress: number;
  /** Whether upgrade is available */
  available: boolean;
  /** Cost in USD (if applicable) */
  cost?: number;
}

// ============================================================================
// Quality Settings Types
// ============================================================================

/**
 * Per-quality-tier settings.
 */
export interface QualitySettings {
  /** Quality tier */
  tier: QualityTier;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Shadow quality */
  shadows: ShadowQuality;
  /** Texture quality */
  textures: TextureQuality;
  /** Effects quality */
  effects: EffectsQuality;
  /** Post-processing settings */
  postProcessing: PostProcessingSettings;
  /** Rendering settings */
  rendering: RenderingSettings;
  /** LOD settings */
  lod: LODSettings;
  /** Maximum number of dynamic lights */
  maxDynamicLights: number;
  /** Maximum particle count */
  maxParticles: number;
  /** Draw distance */
  drawDistance: number;
  /** Whether to use streaming */
  useStreaming: boolean;
}

/**
 * Shadow quality settings.
 */
export type ShadowQuality =
  | 'none'        // No shadows
  | 'blob'        // Blob shadows
  | 'hard'        // Hard shadows
  | 'soft'        // Soft shadows
  | 'soft-pcf'    // Soft shadows with PCF filtering
  | 'raytraced';  // Ray-traced shadows

/**
 * Texture quality settings.
 */
export type TextureQuality =
  | 'lowest'      // 128x128 or less
  | 'low'         // 256x256
  | 'medium'      // 512x512
  | 'high'        // 1024x1024
  | 'ultra'       // 2048x2048 or higher
  | 'native';     // Original resolution

/**
 * Effects quality settings.
 */
export interface EffectsQuality {
  /** Particle effects */
  particles: 'none' | 'simple' | 'standard' | 'advanced';
  /** Water quality */
  water: 'basic' | 'standard' | 'high' | 'ultra';
  /** Fire/smoke quality */
  fireSmoke: 'none' | 'simple' | 'standard' | 'advanced';
  /** Weather effects */
  weather: 'none' | 'simple' | 'standard' | 'advanced';
  /** Screen space effects */
  screenSpace: boolean;
}

/**
 * Post-processing settings.
 */
export interface PostProcessingSettings {
  /** Bloom */
  bloom: boolean;
  /** Ambient occlusion */
  ambientOcclusion: boolean;
  /** Depth of field */
  depthOfField: boolean;
  /** Motion blur */
  motionBlur: boolean;
  /** Chromatic aberration */
  chromaticAberration: boolean;
  /** Color grading */
  colorGrading: boolean;
  /** Anti-aliasing */
  antiAliasing: 'none' | 'fxaa' | 'smaa' | 'taa' | 'msaa';
  /** Vignette */
  vignette: boolean;
}

/**
 * Rendering settings.
 */
export interface RenderingSettings {
  /** Render scale (0.5 - 2.0) */
  renderScale: number;
  /** Vertical sync */
  vsync: boolean;
  /** Frame rate cap (0 = unlimited) */
  frameRateCap: number;
  /** Reflection quality */
  reflections: 'none' | 'ssr' | 'planar' | 'probes' | 'raytraced';
  /** Global illumination */
  globalIllumination: 'none' | 'baked' | 'lightprobes' | 'lumen' | 'voxel-gi';
  /** Tessellation */
  tessellation: boolean;
}

/**
 * Level of detail settings.
 */
export interface LODSettings {
  /** Whether LOD is enabled */
  enabled: boolean;
  /** Number of LOD levels */
  levels: number;
  /** Distance multiplier */
  distanceMultiplier: number;
  /** Screen size transition threshold */
  screenRatioThreshold: number;
  /** Whether to use dithered transitions */
  ditherTransitions: boolean;
}

// ============================================================================
// Quality Manager Types
// ============================================================================

/**
 * Current quality state for a session.
 */
export interface QualityState {
  /** Current quality tier */
  currentTier: QualityTier;
  /** Target quality tier (during transition) */
  targetTier?: QualityTier;
  /** Current quality settings */
  settings: QualitySettings;
  /** Whether quality is locked */
  locked: boolean;
  /** Lock reason if locked */
  lockReason?: string;
  /** Whether auto-quality is enabled */
  autoQuality: boolean;
  /** Session start time */
  sessionStart: string;
  /** Number of quality changes this session */
  qualityChanges: number;
  /** Last quality change time */
  lastQualityChange?: string;
  /** Performance history */
  performanceHistory: PerformanceSample[];
}

/**
 * Quality change event.
 */
export interface QualityChangeEvent {
  /** Event ID */
  id: string;
  /** Previous tier */
  fromTier: QualityTier;
  /** New tier */
  toTier: QualityTier;
  /** Reason for change */
  reason: 'manual' | 'performance' | 'budget' | 'hardware' | 'auto';
  /** Trigger for change */
  trigger: string;
  /** Timestamp */
  timestamp: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId: string;
}

// ============================================================================
// Adaptive Scaling Types
// ============================================================================

/**
 * Adaptive scaling configuration.
 */
export interface AdaptiveScalingConfig {
  /** Whether adaptive scaling is enabled */
  enabled: boolean;
  /** Aggressiveness of scaling (0-1) */
  aggressiveness: number;
  /** How quickly to scale down (0-1) */
  downscaleSpeed: number;
  /** How quickly to scale up (0-1) */
  upscaleSpeed: number;
  /** Minimum quality tier */
  minTier: QualityTier;
  /** Maximum quality tier */
  maxTier: QualityTier;
  /** Performance thresholds */
  thresholds: PerformanceThresholds;
  /** How often to check performance (ms) */
  checkInterval: number;
  /** How many samples before making a decision */
  sampleWindow: number;
}

/**
 * Adaptive scaling recommendation.
 */
export interface AdaptiveScalingRecommendation {
  /** Recommended action */
  action: 'maintain' | 'upgrade' | 'downgrade';
  /** Recommended tier if changing */
  recommendedTier?: QualityTier;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Primary reason for recommendation */
  reason: string;
  /** Current performance score */
  performanceScore: number;
  /** Expected performance score after change */
  expectedScore?: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to detect hardware and get quality recommendations.
 */
export interface DetectHardwareRequest {
  /** Optional client-provided GPU info (for browser detection) */
  clientGpuInfo?: {
    vendor: string;
    renderer: string;
    webglVersion?: string;
    webgpuVersion?: string;
  };
  /** Optional client-provided system info */
  clientSystemInfo?: {
    cores: number;
    memory: number;
    platform: string;
  };
  /** Optional network info */
  networkInfo?: {
    type: string;
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

/**
 * Response to hardware detection request.
 */
export interface DetectHardwareResponse {
  /** Detected hardware profile */
  hardware: HardwareProfile;
  /** Recommended quality tier */
  recommendedTier: QualityTier;
  /** Maximum achievable tier */
  maxTier: QualityTier;
  /** Quality constraints */
  constraints: QualityConstraint;
  /** Default settings for recommended tier */
  settings: QualitySettings;
}

/**
 * Request to set quality tier.
 */
export interface SetQualityRequest {
  /** User ID */
  userId: string;
  /** Session ID */
  sessionId: string;
  /** Desired quality tier */
  tier: QualityTier;
  /** Optional: specific settings to override */
  overrides?: Partial<QualitySettings>;
  /** Reason for change (for tracking) */
  reason?: string;
}

/**
 * Response to quality set request.
 */
export interface SetQualityResponse {
  /** New quality state */
  state: QualityState;
  /** Whether change was immediate or queued */
  immediate: boolean;
  /** Estimated time for change to take effect (ms) */
  estimatedTime: number;
  /** Any warnings about the change */
  warnings?: string[];
}

/**
 * Request to update user budget.
 */
export interface UpdateBudgetRequest {
  /** User ID */
  userId: string;
  /** Budget tier */
  tier?: BudgetTier;
  /** Daily remaining budget */
  dailyRemaining?: number;
  /** Monthly remaining budget */
  monthlyRemaining?: number;
  /** Grain balance */
  grainBalance?: number;
  /** User preference */
  preference?: 'performance' | 'balanced' | 'quality' | 'ultra';
}

/**
 * Request to report performance metrics.
 */
export interface ReportPerformanceRequest {
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId: string;
  /** Performance metrics */
  metrics: PerformanceMetrics;
  /** Whether to trigger adaptive scaling */
  triggerAdaptive?: boolean;
}

/**
 * Performance report response with adaptive recommendations.
 */
export interface ReportPerformanceResponse {
  /** Whether metrics were recorded */
  recorded: boolean;
  /** Current performance sample */
  sample: PerformanceSample;
  /** Adaptive scaling recommendation (if triggered) */
  recommendation?: AdaptiveScalingRecommendation;
  /** Whether a quality change was triggered */
  qualityChangeTriggered: boolean;
}

/**
 * Request to get asset with appropriate LOD.
 */
export interface GetAssetRequest {
  /** Asset ID */
  assetId: string;
  /** Current quality tier */
  qualityTier: QualityTier;
  /** Distance from camera (for LOD selection) */
  distance?: number;
  /** Screen space size (for LOD selection) */
  screenSize?: number;
  /** Whether to allow upgrades */
  allowUpgrade?: boolean;
}

/**
 * Response with asset URL at appropriate quality.
 */
export interface GetAssetResponse {
  /** Asset URL */
  assetUrl: string;
  /** LOD level selected */
  lodLevel: number;
  /** Quality tier */
  qualityTier: QualityTier;
  /** Whether using voxel fallback */
  isVoxel: boolean;
  /** Whether using sprite fallback */
  isSprite: boolean;
  /** Estimated load time */
  estimatedLoadTime: number;
  /** File size */
  fileSize: number;
  /** Available upgrade path (if not at max quality) */
  upgradePath?: UpgradePath;
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Quality preset configuration.
 */
export interface QualityPreset {
  /** Preset identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Quality tier */
  tier: QualityTier;
  /** Settings for this preset */
  settings: QualitySettings;
  /** Icon identifier */
  icon?: string;
  /** Badge text */
  badge?: string;
  /** Whether this is a recommended preset */
  recommended?: boolean;
}

/**
 * Product-specific quality presets.
 */
export interface ProductPresets {
  /** Product identifier */
  product: 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog';
  /** Available presets for this product */
  presets: QualityPreset[];
  /** Default preset for new users */
  defaultPreset: string;
  /** Product-specific overrides */
  overrides?: {
    [tier: string]: Partial<QualitySettings>;
  };
}

// ============================================================================
// Statistics and Analytics
// ============================================================================

/**
 * Quality usage statistics.
 */
export interface QualityUsageStats {
  /** User ID */
  userId: string;
  /** Time range */
  timeRange: {
    start: string;
    end: string;
  };
  /** Quality tier distribution */
  tierDistribution: {
    tier: QualityTier;
    duration: number;  // milliseconds
    percentage: number;
  }[];
  /** Total time spent */
  totalTime: number;
  /** Average quality tier */
  avgTier: number;
  /** Number of quality changes */
  qualityChanges: number;
  /** Performance summary */
  performanceSummary: {
    avgFps: number;
    minFps: number;
    frameDrops: number;
  };
}

/**
 * Aggregate statistics for analytics.
 */
export interface AggregateQualityStats {
  /** Number of users */
  userCount: number;
  /** Tier distribution across all users */
  tierDistribution: {
    tier: QualityTier;
    count: number;
    percentage: number;
  }[];
  /** Hardware tier distribution */
  hardwareDistribution: {
    tier: HardwareTier;
    count: number;
    percentage: number;
  }[];
  /** Most common GPUs */
  topGPUs: {
    name: string;
    count: number;
  }[];
  /** Average performance by tier */
  avgPerformanceByTier: {
    tier: QualityTier;
    avgFps: number;
    avgFrameTime: number;
  };
}
