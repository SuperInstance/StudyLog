/**
 * Renderer Selector
 *
 * Selects the optimal rendering backend based on hardware capabilities
 * and engine requirements. Handles fallback between rendering backends.
 *
 * @module engine-abstraction/renderer-selector
 */

import type {
  RenderingBackend,
  PlatformCapabilities,
  GameEngine,
  QualityTier,
  GPUInfo,
  GPUCapability,
} from "./types.js";

// ============================================================================
// RENDERER SELECTOR
// ============================================================================

/**
 * Selects the optimal rendering backend for a given platform and engine.
 */
export class RendererSelector {
  private static _instance: RendererSelector | null = null;
  private _backendPriorities: Map<GameEngine, RenderingBackend[]> = new Map();
  private _backendScores: Map<RenderingBackend, number> = new Map();
  private _activeBackend: RenderingBackend | null = null;

  private constructor() {
    this.initializeBackendPriorities();
  }

  /**
   * Get the singleton RendererSelector instance.
   */
  static getInstance(): RendererSelector {
    if (!RendererSelector._instance) {
      RendererSelector._instance = new RendererSelector();
    }
    return RendererSelector._instance;
  }

  /**
   * Select the best rendering backend for the given configuration.
   * @param engine - Target game engine
   * @param capabilities - Platform capabilities
   * @param preferredBackend - Optional preferred backend
   * @returns Selected rendering backend
   */
  selectBackend(
    engine: GameEngine,
    capabilities: PlatformCapabilities,
    preferredBackend?: RenderingBackend,
  ): RenderingBackend {
    // If preferred backend is available, use it
    if (preferredBackend && this.isBackendSupported(preferredBackend, capabilities)) {
      this._activeBackend = preferredBackend;
      return preferredBackend;
    }

    // Get backend priorities for this engine
    const priorities = this.getBackendPriorities(engine);

    // Score each backend based on capabilities
    let bestBackend: RenderingBackend = "software";
    let bestScore = -1;

    for (const backend of priorities) {
      if (!this.isBackendSupported(backend, capabilities)) {
        continue;
      }

      const score = this.scoreBackend(backend, engine, capabilities);
      if (score > bestScore) {
        bestScore = score;
        bestBackend = backend;
      }
    }

    this._activeBackend = bestBackend;
    return bestBackend;
  }

  /**
   * Check if a rendering backend is supported.
   * @param backend - Backend to check
   * @param capabilities - Platform capabilities
   * @returns True if backend is supported
   */
  isBackendSupported(
    backend: RenderingBackend,
    capabilities: PlatformCapabilities,
  ): boolean {
    return capabilities.supportedBackends.includes(backend);
  }

  /**
   * Get the priority order of backends for an engine.
   * @param engine - Game engine
   * @returns Array of backends in priority order
   */
  getBackendPriorities(engine: GameEngine): RenderingBackend[] {
    return this._backendPriorities.get(engine) ?? this.getDefaultPriorities();
  }

  /**
   * Score a backend based on platform capabilities.
   * @param backend - Backend to score
   * @param engine - Target engine
   * @param capabilities - Platform capabilities
   * @returns Backend score (higher is better)
   */
  scoreBackend(
    backend: RenderingBackend,
    engine: GameEngine,
    capabilities: PlatformCapabilities,
  ): number {
    let score = 0;

    // Base score by backend type
    score += this.getBaseBackendScore(backend);

    // Platform bonus
    score += this.getPlatformScore(backend, capabilities.platform);

    // GPU capability bonus
    score += this.getCapabilityScore(backend, capabilities);

    // Engine-specific adjustments
    score += this.getEngineScore(backend, engine);

    // Quality tier bonus
    score += this.getQualityScore(backend, capabilities.recommendedQuality);

    return score;
  }

  /**
   * Get base score for a backend type.
   * @param backend - Backend type
   * @returns Base score
   */
  private getBaseBackendScore(backend: RenderingBackend): number {
    const baseScores: Record<RenderingBackend, number> = {
      webgpu: 100,
      vulkan: 95,
      direct3d: 90,
      metal: 85,
      webgl: 70,
      opengl: 60,
      software: 10,
    };
    return baseScores[backend] ?? 0;
  }

  /**
   * Get platform-specific score for a backend.
   * @param backend - Backend type
   * @param platform - Platform type
   * @returns Platform score modifier
   */
  private getPlatformScore(backend: RenderingBackend, platform: string): number {
    // Web platforms prefer WebGPU/WebGL
    if (platform === "web" || platform === "mobile") {
      if (backend === "webgpu") return 20;
      if (backend === "webgl") return 15;
    }

    // Windows prefers Direct3D
    if (typeof process !== "undefined" && process.platform === "win32") {
      if (backend === "direct3d") return 20;
    }

    // macOS prefers Metal
    if (typeof process !== "undefined" && process.platform === "darwin") {
      if (backend === "metal") return 25;
    }

    // Linux prefers Vulkan
    if (typeof process !== "undefined" && process.platform === "linux") {
      if (backend === "vulkan") return 20;
    }

    return 0;
  }

  /**
   * Get capability-specific score for a backend.
   * @param backend - Backend type
   * @param capabilities - Platform capabilities
   * @returns Capability score modifier
   */
  private getCapabilityScore(
    backend: RenderingBackend,
    capabilities: PlatformCapabilities,
  ): number {
    let score = 0;

    // RTX bonus for modern backends
    if (capabilities.gpu.isRTX) {
      if (backend === "vulkan" || backend === "direct3d" || backend === "webgpu") {
        score += 15;
      }
    }

    // Ray tracing bonus
    if (capabilities.capabilities.includes("ray_tracing" as GPUCapability)) {
      if (backend === "vulkan" || backend === "direct3d") {
        score += 10;
      }
    }

    // VRAM bonus for hardware backends
    if (capabilities.gpu.vramMB >= 8192) {
      if (backend !== "software" && backend !== "webgl") {
        score += 10;
      }
    }

    return score;
  }

  /**
   * Get engine-specific score for a backend.
   * @param backend - Backend type
   * @param engine - Game engine
   * @returns Engine score modifier
   */
  private getEngineScore(backend: RenderingBackend, engine: GameEngine): number {
    let score = 0;

    switch (engine) {
      case "microverse":
        // MicroVerse works well with any backend, prefers lightweight
        if (backend === "webgl") score += 10;
        break;

      case "luanti":
        // Luanti benefits from hardware acceleration
        if (backend === "opengl" || backend === "webgl") score += 15;
        if (backend === "vulkan") score += 10;
        break;

      case "openrts":
        // OpenRTS needs modern backends for best results
        if (backend === "vulkan" || backend === "direct3d") score += 20;
        if (backend === "webgpu") score += 15;
        break;
    }

    return score;
  }

  /**
   * Get quality-specific score for a backend.
   * @param backend - Backend type
   * @param quality - Quality tier
   * @returns Quality score modifier
   */
  private getQualityScore(backend: RenderingBackend, quality: QualityTier): number {
    let score = 0;

    // Ultra quality needs modern backends
    if (quality === "ultra") {
      if (backend === "vulkan" || backend === "direct3d" || backend === "webgpu") {
        score += 20;
      }
      if (backend === "software") score -= 50;
    }

    // High quality
    if (quality === "high") {
      if (backend === "opengl" || backend === "webgl") score += 10;
      if (backend === "software") score -= 30;
    }

    // Medium quality
    if (quality === "medium") {
      if (backend === "opengl" || backend === "webgl") score += 5;
    }

    // Low quality works with anything
    if (quality === "low") {
      if (backend === "software") score += 5;
    }

    return score;
  }

  /**
   * Get the active rendering backend.
   * @returns Active backend or null if none selected
   */
  getActiveBackend(): RenderingBackend | null {
    return this._activeBackend;
  }

  /**
   * Set backend priorities for an engine.
   * @param engine - Game engine
   * @param priorities - Backend priority order
   */
  setBackendPriorities(engine: GameEngine, priorities: RenderingBackend[]): void {
    this._backendPriorities.set(engine, priorities);
  }

  /**
   * Get default backend priorities for all platforms.
   * @returns Default backend priorities
   */
  private getDefaultPriorities(): RenderingBackend[] {
    return [
      "webgpu",
      "vulkan",
      "direct3d",
      "metal",
      "opengl",
      "webgl",
      "software",
    ];
  }

  /**
   * Initialize default backend priorities for each engine.
   */
  private initializeBackendPriorities(): void {
    // MicroVerse - lightweight 2D engine
    this._backendPriorities.set("microverse", [
      "webgl",
      "webgpu",
      "opengl",
      "software",
    ]);

    // Luanti - voxel-based engine
    this._backendPriorities.set("luanti", [
      "opengl",
      "vulkan",
      "webgl",
      "webgpu",
      "direct3d",
      "metal",
    ]);

    // OpenRTS - modern 3D engine
    this._backendPriorities.set("openrts", [
      "vulkan",
      "direct3d",
      "webgpu",
      "metal",
      "opengl",
    ]);
  }

  /**
   * Get recommended rendering settings for a backend.
   * @param backend - Rendering backend
   * @param quality - Quality tier
   * @returns Rendering settings
   */
  getRenderingSettings(
    backend: RenderingBackend,
    quality: QualityTier,
  ): RenderingSettings {
    const baseSettings = this.getBaseSettings(backend, quality);

    // Adjust based on quality tier
    switch (quality) {
      case "ultra":
        return {
          ...baseSettings,
          shadows: ShadowQuality.ULTRA,
          antialiasing: AntiAliasingMode.TAA,
          reflections: ReflectionQuality.RAY_TRACED,
          ambientOcclusion: true,
          bloom: true,
          motionBlur: true,
          depthOfField: true,
          screenSpaceReflections: true,
          globalIllumination: true,
        };

      case "high":
        return {
          ...baseSettings,
          shadows: ShadowQuality.HIGH,
          antialiasing: AntiAliasingMode.MSAA_4X,
          reflections: ReflectionQuality.SSR,
          ambientOcclusion: true,
          bloom: true,
          motionBlur: false,
          depthOfField: false,
          screenSpaceReflections: true,
          globalIllumination: false,
        };

      case "medium":
        return {
          ...baseSettings,
          shadows: ShadowQuality.MEDIUM,
          antialiasing: AntiAliasingMode.FXAA,
          reflections: ReflectionQuality.PROBE,
          ambientOcclusion: true,
          bloom: false,
          motionBlur: false,
          depthOfField: false,
          screenSpaceReflections: false,
          globalIllumination: false,
        };

      case "low":
        return {
          ...baseSettings,
          shadows: ShadowQuality.LOW,
          antialiasing: AntiAliasingMode.NONE,
          reflections: ReflectionQuality.NONE,
          ambientOcclusion: false,
          bloom: false,
          motionBlur: false,
          depthOfField: false,
          screenSpaceReflections: false,
          globalIllumination: false,
        };

      default:
        return baseSettings;
    }
  }

  /**
   * Get base rendering settings for a backend.
   * @param backend - Rendering backend
   * @param quality - Quality tier
   * @returns Base rendering settings
   */
  private getBaseSettings(
    backend: RenderingBackend,
    quality: QualityTier,
  ): RenderingSettings {
    const resolutions = this.getResolutionForQuality(quality);

    return {
      backend,
      width: resolutions[0],
      height: resolutions[1],
      renderScale: 1.0,
      shadows: ShadowQuality.MEDIUM,
      antialiasing: AntiAliasingMode.NONE,
      reflections: ReflectionQuality.NONE,
      ambientOcclusion: false,
      bloom: false,
      motionBlur: false,
      depthOfField: false,
      screenSpaceReflections: false,
      globalIllumination: false,
      volumetricLighting: false,
      tessellation: false,
      particleQuality: ParticleQuality.MEDIUM,
      textureQuality: TextureQuality.MEDIUM,
      anisotropicFiltering: 4,
      lodBias: 0,
    };
  }

  /**
   * Get resolution for a quality tier.
   * @param quality - Quality tier
   * @returns Resolution [width, height]
   */
  private getResolutionForQuality(quality: QualityTier): [number, number] {
    // Get current display resolution
    const displayWidth =
      typeof window !== "undefined" ? window.screen.width : 1920;
    const displayHeight =
      typeof window !== "undefined" ? window.screen.height : 1080;

    switch (quality) {
      case "ultra":
        return [displayWidth, displayHeight];
      case "high":
        return [Math.floor(displayWidth * 0.9), Math.floor(displayHeight * 0.9)];
      case "medium":
        return [Math.floor(displayWidth * 0.75), Math.floor(displayHeight * 0.75)];
      case "low":
        return [Math.floor(displayWidth * 0.5), Math.floor(displayHeight * 0.5)];
      default:
        return [1280, 720];
    }
  }
}

// ============================================================================
// RENDERING SETTINGS TYPES
// ============================================================================

/**
 * Rendering settings for a backend.
 */
export interface RenderingSettings {
  /** Rendering backend */
  backend: RenderingBackend;
  /** Render width in pixels */
  width: number;
  /** Render height in pixels */
  height: number;
  /** Render scale (0.5 = half resolution, 1.0 = native) */
  renderScale: number;
  /** Shadow quality */
  shadows: ShadowQuality;
  /** Anti-aliasing mode */
  antialiasing: AntiAliasingMode;
  /** Reflection quality */
  reflections: ReflectionQuality;
  /** Enable ambient occlusion */
  ambientOcclusion: boolean;
  /** Enable bloom */
  bloom: boolean;
  /** Enable motion blur */
  motionBlur: boolean;
  /** Enable depth of field */
  depthOfField: boolean;
  /** Enable screen space reflections */
  screenSpaceReflections: boolean;
  /** Enable global illumination */
  globalIllumination: boolean;
  /** Enable volumetric lighting */
  volumetricLighting?: boolean;
  /** Enable tessellation */
  tessellation?: boolean;
  ** Particle quality */
  particleQuality: ParticleQuality;
  /** Texture quality */
  textureQuality: TextureQuality;
  /** Anisotropic filtering level (0-16) */
  anisotropicFiltering: number;
  /** LOD bias */
  lodBias: number;
}

/**
 * Shadow quality levels.
 */
export enum ShadowQuality {
  /** No shadows */
  NONE = "none",
  /** Low resolution shadows */
  LOW = "low",
  /** Medium resolution shadows */
  MEDIUM = "medium",
  /** High resolution shadows */
  HIGH = "high",
  /** Ultra resolution shadows with PCSS */
  ULTRA = "ultra",
}

/**
 * Anti-aliasing modes.
 */
export enum AntiAliasingMode {
  /** No anti-aliasing */
  NONE = "none",
  /** Fast approximate anti-aliasing */
  FXAA = "fxaa",
  /** Subpixel morphological anti-aliasing */
  SMAA = "smaa",
  /** Multi-sample anti-aliasing 2x */
  MSAA_2X = "msaa_2x",
  /** Multi-sample anti-aliasing 4x */
  MSAA_4X = "msaa_4x",
  /** Multi-sample anti-aliasing 8x */
  MSAA_8X = "msaa_8x",
  /** Temporal anti-aliasing */
  TAA = "taa",
  /** Deep learning super sampling */
  DLSS = "dlss",
  /** FidelityFX super resolution */
  FSR = "fsr",
}

/**
 * Reflection quality levels.
 */
export enum ReflectionQuality {
  /** No reflections */
  NONE = "none",
  /** Static reflection probes */
  PROBE = "probe",
  /** Planar reflections */
  PLANAR = "planar",
  /** Screen space reflections */
  SSR = "ssr",
  /** Ray traced reflections */
  RAY_TRACED = "ray_traced",
}

/**
 * Particle quality levels.
 */
export enum ParticleQuality {
  /** Low particle count and quality */
  LOW = "low",
  /** Medium particle count and quality */
  MEDIUM = "medium",
  /** High particle count and quality */
  HIGH = "high",
  /** Ultra particle count with GPU simulation */
  ULTRA = "ultra",
}

/**
 * Texture quality levels.
 */
export enum TextureQuality {
  /** Low resolution textures */
  LOW = "low",
  /** Medium resolution textures */
  MEDIUM = "medium",
  /** High resolution textures */
  HIGH = "high",
  /** Ultra resolution textures */
  ULTRA = "ultra",
}

// ============================================================================
// RENDERER CAPABILITY CHECKS
// ============================================================================

/**
 * Check if a backend supports a specific feature.
 * @param backend - Rendering backend
 * @param feature - Feature to check
 * @returns True if feature is supported
 */
export function supportsFeature(
  backend: RenderingBackend,
  feature: RendererFeature,
): boolean {
  const featureSupport: Record<RendererFeature, RenderingBackend[]> = {
    [RendererFeature.RAY_TRACING]: ["vulkan", "direct3d", "webgpu"],
    [RendererFeature.COMPUTE_SHADERS]: ["vulkan", "direct3d", "webgpu", "metal"],
    [RendererFeature.GEOMETRY_SHADERS]: ["vulkan", "direct3d", "opengl", "metal"],
    [RendererFeature.TESSELLATION]: ["vulkan", "direct3d", "metal"],
    [RendererFeature.HDR]: ["vulkan", "direct3d", "metal", "webgpu"],
    [RendererFeature.VR]: ["vulkan", "direct3d"],
    [RendererFeature.BINDLESS_TEXTURES]: ["vulkan", "direct3d"],
    [RendererFeature.MESH_SHADERS]: ["vulkan", "direct3d"],
    [RendererFeature.VARIABLE_RATE_SHADING]: ["vulkan", "direct3d"],
  };

  return featureSupport[feature]?.includes(backend) ?? false;
}

/**
 * Renderer features that can be queried.
 */
export enum RendererFeature {
  /** Hardware ray tracing */
  RAY_TRACING = "ray_tracing",
  /** Compute shader support */
  COMPUTE_SHADERS = "compute_shaders",
  /** Geometry shader support */
  GEOMETRY_SHADERS = "geometry_shaders",
  /** Tessellation support */
  TESSELLATION = "tessellation",
  /** HDR rendering */
  HDR = "hdr",
  /** VR rendering */
  VR = "vr",
  /** Bindless textures */
  BINDLESS_TEXTURES = "bindless_textures",
  /** Mesh shaders */
  MESH_SHADERS = "mesh_shaders",
  /** Variable rate shading */
  VARIABLE_RATE_SHADING = "variable_rate_shading",
}

/**
 * Get the maximum render scale for a backend and quality.
 * @param backend - Rendering backend
 * @param quality - Quality tier
 * @returns Maximum render scale (1.0 = native, >1.0 = supersampling)
 */
export function getMaxRenderScale(
  backend: RenderingBackend,
  quality: QualityTier,
): number {
  // Software rendering can't handle supersampling
  if (backend === "software") {
    return 0.5;
  }

  // WebGL has limitations
  if (backend === "webgl") {
    switch (quality) {
      case "ultra":
      case "high":
        return 1.0;
      case "medium":
        return 0.75;
      case "low":
        return 0.5;
    }
  }

  // Modern backends can supersample
  switch (quality) {
    case "ultra":
      return 1.5;
    case "high":
      return 1.2;
    case "medium":
      return 1.0;
    case "low":
      return 0.75;
  }

  return 1.0;
}

/**
 * Get recommended MSAA level for backend and quality.
 * @param backend - Rendering backend
 * @param quality - Quality tier
 * @returns Recommended MSAA mode
 */
export function getRecommendedMSAA(
  backend: RenderingBackend,
  quality: QualityTier,
): AntiAliasingMode {
  // Software and low-end backends don't support MSAA
  if (backend === "software") {
    return AntiAliasingMode.NONE;
  }

  // Low quality doesn't use MSAA
  if (quality === "low") {
    return AntiAliasingMode.NONE;
  }

  // High-end backends get higher MSAA
  if (backend === "vulkan" || backend === "direct3d") {
    switch (quality) {
      case "ultra":
        return AntiAliasingMode.MSAA_8X;
      case "high":
        return AntiAliasingMode.MSAA_4X;
      case "medium":
        return AntiAliasingMode.MSAA_2X;
    }
  }

  // Mid-range backends get lower MSAA
  if (backend === "opengl" || backend === "webgl" || backend === "metal") {
    switch (quality) {
      case "ultra":
      case "high":
        return AntiAliasingMode.MSAA_4X;
      case "medium":
        return AntiAliasingMode.MSAA_2X;
    }
  }

  // WebGPU uses TAA instead
  if (backend === "webgpu") {
    if (quality === "ultra" || quality === "high") {
      return AntiAliasingMode.TAA;
    }
  }

  return AntiAliasingMode.NONE;
}

/**
 * Check if DLSS is available.
 * @param gpu - GPU information
 * @returns True if DLSS is available
 */
export function isDLSSAvailable(gpu: GPUInfo): boolean {
  return (
    gpu.vendor === "NVIDIA" &&
    gpu.isRTX &&
    (gpu.model.includes("RTX 20") ||
      gpu.model.includes("RTX 30") ||
      gpu.model.includes("RTX 40") ||
      gpu.model.includes("RTX 50"))
  );
}

/**
 * Check if FSR is available.
 * @returns True if FSR is available (always true for supported backends)
 */
export function isFSSRAvailable(): boolean {
  return true; // FSR works on all hardware
}

/**
 * Select upscaler based on GPU and backend.
 * @param gpu - GPU information
 * @param backend - Rendering backend
 * @param quality - Quality tier
 * @returns Recommended upscaler or none
 */
export function selectUpscaler(
  gpu: GPUInfo,
  backend: RenderingBackend,
  quality: QualityTier,
): AntiAliasingMode {
  // Only upscale at high/ultra quality
  if (quality !== "high" && quality !== "ultra") {
    return AntiAliasingMode.NONE;
  }

  // NVIDIA RTX gets DLSS
  if (isDLSSAvailable(gpu)) {
    return AntiAliasingMode.DLSS;
  }

  // Everyone else gets FSR
  if (backend === "vulkan" || backend === "direct3d" || backend === "webgpu") {
    return AntiAliasingMode.FSR;
  }

  return AntiAliasingMode.NONE;
}

/**
 * Get shadow resolution for a quality level.
 * @param quality - Shadow quality
 * @returns Shadow resolution in pixels
 */
export function getShadowResolution(quality: ShadowQuality): number {
  switch (quality) {
    case ShadowQuality.ULTRA:
      return 4096;
    case ShadowQuality.HIGH:
      return 2048;
    case ShadowQuality.MEDIUM:
      return 1024;
    case ShadowQuality.LOW:
      return 512;
    case ShadowQuality.NONE:
      return 0;
  }
}

/**
 * Get texture size multiplier for a quality level.
 * @param quality - Texture quality
 * @returns Size multiplier (0.5 = half resolution, 1.0 = full)
 */
export function getTextureSizeMultiplier(quality: TextureQuality): number {
  switch (quality) {
    case TextureQuality.ULTRA:
    case TextureQuality.HIGH:
      return 1.0;
    case TextureQuality.MEDIUM:
      return 0.5;
    case TextureQuality.LOW:
      return 0.25;
  }
}

/**
 * Get particle count multiplier for a quality level.
 * @param quality - Particle quality
 * @returns Count multiplier
 */
export function getParticleCountMultiplier(quality: ParticleQuality): number {
  switch (quality) {
    case ParticleQuality.ULTRA:
      return 2.0;
    case ParticleQuality.HIGH:
      return 1.0;
    case ParticleQuality.MEDIUM:
      return 0.5;
    case ParticleQuality.LOW:
      return 0.25;
  }
}

// ============================================================================
// RENDERER VALIDATION
// ============================================================================

/**
 * Validate rendering settings for a backend.
 * @param settings - Rendering settings to validate
 * @param capabilities - Platform capabilities
 * @returns Validated settings with adjustments
 */
export function validateRenderingSettings(
  settings: RenderingSettings,
  capabilities: PlatformCapabilities,
): RenderingSettings {
  const validated = { ...settings };

  // Disable unsupported features
  if (!capabilities.capabilities.includes("ray_tracing" as GPUCapability)) {
    validated.reflections = ReflectionQuality.SSR;
    validated.globalIllumination = false;
  }

  // Adjust antialiasing based on backend
  if (validated.antialiasing === AntiAliasingMode.DLSS) {
    if (!isDLSSAvailable(capabilities.gpu)) {
      validated.antialiasing = AntiAliasingMode.FSR;
    }
  }

  // Disable VR if not supported
  if (validated.volumetricLighting && !capabilities.capabilities.includes("hdr" as GPUCapability)) {
    validated.volumetricLighting = false;
  }

  // Adjust render scale
  const maxScale = getMaxRenderScale(validated.backend, capabilities.recommendedQuality);
  validated.renderScale = Math.min(validated.renderScale, maxScale);

  return validated;
}
