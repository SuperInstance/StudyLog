/**
 * Quality Scaling - Adapt to Engine Tier
 *
 * Scales rendering and simulation quality based on engine tier:
 * - MicroVerse (2D): Minimal quality, sprites only
 * - Luanti (Voxel): Medium quality, blocky aesthetics
 * - OpenRTS (3D): Maximum quality, realistic graphics
 */

import {
  EngineTier,
  RenderQuality,
  Vector3,
  WaterState,
  WeatherState,
  Fish
} from './types';
import { RENDER_QUALITY_PRESETS } from './types';

// ============================================================================
// QUALITY PRESET MANAGEMENT
// ============================================================================

/**
 * Quality scaling manager
 */
export class QualityScalingManager {
  private currentTier: EngineTier = EngineTier.MICROVERSE;
  private customQuality: RenderQuality | null = null;

  /**
   * Set engine tier
   */
  setTier(tier: EngineTier): void {
    this.currentTier = tier;
    this.customQuality = null;
  }

  /**
   * Get current tier
   */
  getTier(): EngineTier {
    return this.currentTier;
  }

  /**
   * Get current quality settings
   */
  getQuality(): RenderQuality {
    return this.customQuality || RENDER_QUALITY_PRESETS[this.currentTier];
  }

  /**
   * Set custom quality override
   */
  setCustomQuality(quality: Partial<RenderQuality>): void {
    this.customQuality = {
      ...RENDER_QUALITY_PRESETS[this.currentTier],
      ...quality,
      tier: this.currentTier
    };
  }

  /**
   * Reset to preset
   */
  resetToPreset(): void {
    this.customQuality = null;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(feature: QualityFeature): boolean {
    const quality = this.getQuality();

    switch (feature) {
      case QualityFeature.SHADOWS:
        return quality.shadowQuality !== 'none';

      case QualityFeature.REFLECTIONS:
        return quality.reflectionQuality !== 'none';

      case QualityFeature.FOAM_PARTICLES:
        return quality.foamParticles;

      case QualityFeature.UNDERWATER_CAUSTICS:
        return quality.underwaterCaustics;

      case QualityFeature.WAVES:
        return quality.waveComplexity > 0;

      case QualityFeature.WIND_EFFECTS:
        return quality.waveComplexity > 0.3;

      case QualityFeature.MULTIPLE_LIGHTS:
        return this.currentTier === EngineTier.OPENRTS;

      case QualityFeature.HIGH_DETAIL_FISH:
        return quality.fishDetailLevel === 'high';

      case QualityFeature.POST_PROCESSING:
        return this.currentTier === EngineTier.OPENRTS;

      default:
        return false;
    }
  }

  /**
   * Get scaled value based on tier
   */
  getScaledValue(base: number, feature: QualityFeature): number {
    const quality = this.getQuality();
    const tierMultiplier = {
      [EngineTier.MICROVERSE]: 0.3,
      [EngineTier.LUANTI]: 0.6,
      [EngineTier.OPENRTS]: 1.0
    };

    return base * tierMultiplier[this.currentTier];
  }
}

/**
 * Quality features that can be toggled
 */
export enum QualityFeature {
  SHADOWS = 'shadows',
  REFLECTIONS = 'reflections',
  FOAM_PARTICLES = 'foam_particles',
  UNDERWATER_CAUSTICS = 'underwater_caustics',
  WAVES = 'waves',
  WIND_EFFECTS = 'wind_effects',
  MULTIPLE_LIGHTS = 'multiple_lights',
  HIGH_DETAIL_FISH = 'high_detail_fish',
  POST_PROCESSING = 'post_processing'
}

// ============================================================================
// TIER-SPECIFIC RENDERERS
// ============================================================================

/**
 * MicroVerse (2D) renderer configuration
 */
export class MicroVerseRenderer {
  private quality: RenderQuality;

  constructor(quality: RenderQuality) {
    this.quality = quality;
  }

  /**
   * Get sprite render data for fish
   */
  getFishSpriteData(fish: Fish): SpriteRenderData {
    const species = fish.species;
    const behavior = fish.behavior;

    return {
      sprite: `fish/${species}/2d`,
      position: {
        x: fish.position2D.x,
        y: fish.position2D.y
      },
      scale: this.calculateSpriteScale(fish),
      rotation: this.calculate2DRotation(fish),
      frame: this.getAnimationFrame(behavior, Date.now()),
      flip: fish.velocity.x < 0,
      opacity: this.calculateOpacity(fish)
    };
  }

  /**
   * Calculate sprite scale based on fish size
   */
  private calculateSpriteScale(fish: Fish): number {
    const baseScale = 0.5;
    const sizeMultiplier = fish.length / 15; // Normalize around 15 inches
    return baseScale * sizeMultiplier;
  }

  /**
   * Calculate 2D rotation
   */
  private calculate2DRotation(fish: Fish): number {
    // 2D sprites only flip, don't rotate
    return 0;
  }

  /**
   * Get animation frame
   */
  private getAnimationFrame(behavior: string, time: number): number {
    const frameCount = 4;
    const speed = behavior === 'fleeing' ? 15 : 8;
    return Math.floor((time / 100) % frameCount);
  }

  /**
   * Calculate opacity (depth effect)
   */
  private calculateOpacity(fish: Fish): number {
    const depth = Math.abs(fish.position3D.y);
    return Math.max(0.3, 1 - depth / 30);
  }

  /**
   * Get water surface render data
   */
  getWaterSurfaceData(): WaterSurfaceData {
    return {
      type: 'sprite',
      sprite: 'water/2d_surface',
      color: '#3498DB',
      alpha: 0.7,
      animationSpeed: 0.5
    };
  }

  /**
   * Get UI render settings
   */
  getUISettings(): UISettings {
    return {
      showMinimap: true,
      showDepthIndicator: true,
      showWeatherIcon: true,
      pixelPerfect: true
    };
  }
}

/**
 * Luanti (Voxel) renderer configuration
 */
export class LuantiRenderer {
  private quality: RenderQuality;

  constructor(quality: RenderQuality) {
    this.quality = quality;
  }

  /**
   * Get voxel render data for fish
   */
  getFishVoxelData(fish: Fish): VoxelRenderData {
    const sizeCategory = this.getSizeCategory(fish.length);

    return {
      voxelModel: `fish/${fish.species}/voxel_${sizeCategory}`,
      position: fish.position3D,
      scale: this.calculateVoxelScale(fish),
      rotation: this.calculateVoxelRotation(fish),
      blockSize: 1,
      detail: this.quality.fishDetailLevel
    };
  }

  /**
   * Get size category for voxel model
   */
  private getSizeCategory(length: number): string {
    if (length < 6) return 'small';
    if (length < 15) return 'medium';
    return 'large';
  }

  /**
   * Calculate voxel scale
   */
  private calculateVoxelScale(fish: Fish): number {
    const baseScale = 0.8;
    return baseScale * (fish.length / 15);
  }

  /**
   * Calculate voxel rotation
   */
  private calculateVoxelRotation(fish: Fish): { x: number; y: number; z: number } {
    // Simplified rotation for voxel aesthetic
    const angle = Math.atan2(fish.velocity.x, fish.velocity.z);
    return { x: 0, y: angle, z: 0 };
  }

  /**
   * Get water voxel data
   */
  getWaterVoxelData(): WaterVoxelData {
    return {
      voxelType: 'water',
      blockSize: 1,
      transparency: 0.7,
      flowAnimation: true,
      waveHeight: this.quality.waveComplexity * 2
    };
  }

  /**
   * Get isometric camera settings
   */
  getCameraSettings(): CameraSettings {
    return {
      type: 'isometric',
      angle: 45,
      distance: 80,
      height: 60,
      rotationSpeed: 0.5
    };
  }

  /**
   * Get environment block palette
   */
  getBlockPalette(): BlockPalette {
    return {
      water: ['#3498DB', '#2980B9', '#5DADE2'],
      vegetation: ['#27AE60', '#2ECC71', '#1E8449'],
      rock: ['#7F8C8D', '#95A5A6', '#5D6D7E'],
      wood: ['#A0522D', '#8B4513', '#6B3E0A'],
      sand: ['#F4D03F', '#D4AC0D', '#B7950B']
    };
  }
}

/**
 * OpenRTS (3D) renderer configuration
 */
export class OpenRTSRenderer {
  private quality: RenderQuality;

  constructor(quality: RenderQuality) {
    this.quality = quality;
  }

  /**
   * Get 3D render data for fish
   */
  getFish3DData(fish: Fish): Fish3DRenderData {
    return {
      model: `fish/${fish.species}/high_poly`,
      position: fish.position3D,
      scale: this.calculate3DScale(fish),
      rotation: this.calculate3DRotation(fish),
      skeleton: this.getFishSkeletonAnimation(fish),
      material: this.getFishMaterial(fish),
      lod: this.calculateLOD(fish)
    };
  }

  /**
   * Calculate 3D scale
   */
  private calculate3DScale(fish: Fish): Vector3 {
    const baseScale = 1;
    const lengthScale = fish.length / 15;
    const weightScale = Math.pow(fish.weight, 1/3) / Math.pow(2, 1/3);

    return {
      x: lengthScale * baseScale,
      y: weightScale * baseScale,
      z: weightScale * baseScale
    };
  }

  /**
   * Calculate full 3D rotation
   */
  private calculate3DRotation(fish: Fish): Vector3 {
    // Direction of movement
    const yaw = Math.atan2(fish.velocity.x, fish.velocity.z);

    // Pitch based on vertical movement
    const pitch = Math.atan2(fish.velocity.y, Math.sqrt(fish.velocity.x ** 2 + fish.velocity.z ** 2));

    // Roll during turns
    const roll = 0; // Would calculate from turning rate

    return { x: pitch, y: yaw, z: roll };
  }

  /**
   * Get skeleton animation data
   */
  private getFishSkeletonAnimation(fish: Fish): SkeletonAnimation {
    return {
      swimSpeed: this.calculateSwimSpeed(fish),
      tailAmplitude: fish.behavior === 'fleeing' ? 0.5 : 0.2,
      finActivity: fish.behavior === 'hooked' ? 1 : 0.5,
      mouthOpen: fish.behavior === 'feeding' ? 1 : 0
    };
  }

  /**
   * Calculate swim animation speed
   */
  private calculateSwimSpeed(fish: Fish): number {
    const speed = Math.sqrt(
      fish.velocity.x ** 2 +
      fish.velocity.y ** 2 +
      fish.velocity.z ** 2
    );
    return Math.min(2, speed * 0.5);
  }

  /**
   * Get fish material settings
   */
  private getFishMaterial(fish: Fish): FishMaterial {
    return {
      roughness: 0.3,
      metallicness: 0.1,
      subsurfaceScattering: true,
      iridescence: fish.species.includes('trout') || fish.species.includes('salmon'),
      normalMap: this.quality.fishDetailLevel === 'high'
    };
  }

  /**
   * Calculate level of detail
   */
  private calculateLOD(fish: Fish): number {
    // Would calculate based on distance to camera
    return this.quality.fishDetailLevel === 'high' ? 0 : 1;
  }

  /**
   * Get water render data
   */
  getWaterRenderData(waterState: WaterState): Water3DData {
    return {
      shader: 'realistic_water',
      tessellation: this.quality.waterVertices >= 5000,
      displacementScale: waterState.waves.amplitude,
      normalMap: true,
      reflection: this.quality.reflectionQuality,
      refraction: true,
      foam: {
        enabled: this.quality.foamParticles,
        particles: this.quality.maxParticles,
        texture: 'foam_atlas'
      },
      caustics: {
        enabled: this.quality.underwaterCaustics,
        intensity: 0.5
      },
      depthFog: {
        enabled: true,
        color: this.getWaterColor(waterState.clarity),
        density: this.getFogDensity(waterState.clarity)
      }
    };
  }

  /**
   * Get water color based on clarity
   */
  private getWaterColor(clarity: string): { r: number; g: number; b: number } {
    const colors: Record<string, { r: number; g: number; b: number }> = {
      murky: { r: 93, g: 109, b: 126 },
      stained: { r: 84, g: 153, b: 199 },
      clear: { r: 46, g: 134, b: 193 },
      very_clear: { r: 26, g: 82, b: 118 },
      crystal: { r: 21, g: 67, b: 96 }
    };
    return colors[clarify] || colors.clear;
  }

  /**
   * Get fog density
   */
  private getFogDensity(clarity: string): number {
    const densities: Record<string, number> = {
      murky: 0.15,
      stained: 0.1,
      clear: 0.05,
      very_clear: 0.02,
      crystal: 0.01
    };
    return densities[clarify] || 0.05;
  }

  /**
   * Get lighting settings
   */
  getLightingSettings(weather: WeatherState): LightingSettings {
    return {
      ambientIntensity: this.getAmbientIntensity(weather),
      sunIntensity: this.getSunIntensity(weather),
      sunColor: this.getSunColor(weather),
      shadowType: this.quality.shadowQuality,
      godRays: weather.condition === 'partly_cloudy' && this.quality.reflectionQuality === 'screen-space',
      volumetricClouds: this.currentTier === EngineTier.OPENRTS
    };
  }

  /**
   * Get ambient intensity based on weather
   */
  private getAmbientIntensity(weather: WeatherState): number {
    switch (weather.condition) {
      case 'sunny':
        return 0.4;
      case 'partly_cloudy':
        return 0.5;
      case 'cloudy':
      case 'overcast':
        return 0.7;
      case 'rain':
      case 'thunderstorm':
        return 0.6;
      default:
        return 0.5;
    }
  }

  /**
   * Get sun intensity based on weather
   */
  private getSunIntensity(weather: WeatherState): number {
    switch (weather.condition) {
      case 'sunny':
        return 1.2;
      case 'partly_cloudy':
        return 0.9;
      case 'cloudy':
      case 'overcast':
        return 0.5;
      case 'rain':
        return 0.3;
      case 'thunderstorm':
        return 0.2;
      default:
        return 1.0;
    }
  }

  /**
   * Get sun color
   */
  private getSunColor(weather: WeatherState): { r: number; g: number; b: number } {
    if (weather.condition === 'sunny') {
      return { r: 1.0, g: 0.95, b: 0.8 };
    } else if (weather.condition === 'thunderstorm') {
      return { r: 0.7, g: 0.7, b: 0.9 };
    }
    return { r: 1.0, g: 1.0, b: 1.0 };
  }

  /**
   * Get post-processing settings
   */
  getPostProcessingSettings(): PostProcessingSettings {
    return {
      bloom: this.quality.tier === EngineTier.OPENRTS,
      bloomIntensity: 0.3,
      tonemapping: 'aces',
      colorGrading: true,
      chromaticAberration: false,
      motionBlur: false,
      depthOfField: true,
      antiAliasing: this.quality.tier === EngineTier.OPENRTS ? 'taa' : 'fxaa'
    };
  }

  private currentTier: EngineTier = EngineTier.OPENRTS;
  public setTier(tier: EngineTier) { this.currentTier = tier; }
}

// ============================================================================
// RENDER DATA TYPES
// ============================================================================

/**
 * Sprite render data for 2D
 */
export interface SpriteRenderData {
  sprite: string;
  position: Vector2;
  scale: number;
  rotation: number;
  frame: number;
  flip: boolean;
  opacity: number;
}

/**
 * Water surface data for 2D
 */
export interface WaterSurfaceData {
  type: 'sprite';
  sprite: string;
  color: string;
  alpha: number;
  animationSpeed: number;
}

/**
 * UI settings for 2D
 */
export interface UISettings {
  showMinimap: boolean;
  showDepthIndicator: boolean;
  showWeatherIcon: boolean;
  pixelPerfect: boolean;
}

/**
 * Voxel render data
 */
export interface VoxelRenderData {
  voxelModel: string;
  position: Vector3;
  scale: number;
  rotation: { x: number; y: number; z: number };
  blockSize: number;
  detail: 'low' | 'medium' | 'high';
}

/**
 * Water voxel data
 */
export interface WaterVoxelData {
  voxelType: string;
  blockSize: number;
  transparency: number;
  flowAnimation: boolean;
  waveHeight: number;
}

/**
 * Camera settings
 */
export interface CameraSettings {
  type: 'isometric' | 'perspective' | 'orthographic';
  angle: number;
  distance: number;
  height: number;
  rotationSpeed: number;
}

/**
 * Block palette for voxel rendering
 */
export interface BlockPalette {
  water: string[];
  vegetation: string[];
  rock: string[];
  wood: string[];
  sand: string[];
}

/**
 * 3D fish render data
 */
export interface Fish3DRenderData {
  model: string;
  position: Vector3;
  scale: Vector3;
  rotation: Vector3;
  skeleton: SkeletonAnimation;
  material: FishMaterial;
  lod: number;
}

/**
 * Skeleton animation data
 */
export interface SkeletonAnimation {
  swimSpeed: number;
  tailAmplitude: number;
  finActivity: number;
  mouthOpen: number;
}

/**
 * Fish material settings
 */
export interface FishMaterial {
  roughness: number;
  metallicness: number;
  subsurfaceScattering: boolean;
  iridescence: boolean;
  normalMap: boolean;
}

/**
 * 3D water render data
 */
export interface Water3DData {
  shader: string;
  tessellation: boolean;
  displacementScale: number;
  normalMap: boolean;
  reflection: string;
  refraction: boolean;
  foam: {
    enabled: boolean;
    particles: number;
    texture: string;
  };
  caustics: {
    enabled: boolean;
    intensity: number;
  };
  depthFog: {
    enabled: boolean;
    color: { r: number; g: number; b: number };
    density: number;
  };
}

/**
 * Lighting settings
 */
export interface LightingSettings {
  ambientIntensity: number;
  sunIntensity: number;
  sunColor: { r: number; g: number; b: number };
  shadowType: string;
  godRays: boolean;
  volumetricClouds: boolean;
}

/**
 * Post-processing settings
 */
export interface PostProcessingSettings {
  bloom: boolean;
  bloomIntensity: number;
  tonemapping: string;
  colorGrading: boolean;
  chromaticAberration: boolean;
  motionBlur: boolean;
  depthOfField: boolean;
  antiAliasing: string;
}

// ============================================================================
// RENDERER FACTORY
// ============================================================================

/**
 * Creates appropriate renderer for tier
 */
export class RendererFactory {
  /**
   * Create renderer for current tier
   */
  static createRenderer(tier: EngineTier, quality: RenderQuality) {
    switch (tier) {
      case EngineTier.MICROVERSE:
        return new MicroVerseRenderer(quality);

      case EngineTier.LUANTI:
        return new LuantiRenderer(quality);

      case EngineTier.OPENRTS:
        return new OpenRTSRenderer(quality);

      default:
        return new MicroVerseRenderer(quality);
    }
  }

  /**
   * Get tier from device capabilities
   */
  static detectTier(): EngineTier {
    // In a real implementation, this would detect device capabilities
    // For now, default to medium tier
    return EngineTier.LUANTI;
  }
}

// ============================================================================
// ADAPTIVE QUALITY
// ============================================================================

/**
 * Manages adaptive quality settings
 */
export class AdaptiveQualityManager {
  private targetFrameTime: number = 16.67; // 60 FPS
  private currentQuality: RenderQuality;
  private frameTimeHistory: number[] = [];
  private maxHistorySize: number = 60;

  constructor(initialQuality: RenderQuality) {
    this.currentQuality = initialQuality;
  }

  /**
   * Update adaptive quality based on performance
   */
  update(frameTime: number): RenderQuality | null {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.maxHistorySize) {
      this.frameTimeHistory.shift();
    }

    // Only evaluate every 30 frames
    if (this.frameTimeHistory.length < 30) {
      return null;
    }

    const avgFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;

    // If consistently slow, reduce quality
    if (avgFrameTime > this.targetFrameTime * 1.5) {
      return this.reduceQuality();
    }

    // If consistently fast, increase quality
    if (avgFrameTime < this.targetFrameTime * 0.7) {
      return this.increaseQuality();
    }

    return null;
  }

  /**
   * Reduce quality to improve performance
   */
  private reduceQuality(): RenderQuality {
    const changes: Partial<RenderQuality> = {};

    // Try reducing different settings
    if (this.currentQuality.maxParticles > 100) {
      changes.maxParticles = Math.floor(this.currentQuality.maxParticles * 0.7);
    } else if (this.currentQuality.waterVertices > 100) {
      changes.waterVertices = Math.floor(this.currentQuality.waterVertices * 0.7);
    } else if (this.currentQuality.shadowQuality !== 'none') {
      changes.shadowQuality = 'none' as const;
    } else if (this.currentQuality.foamParticles) {
      changes.foamParticles = false;
    }

    if (Object.keys(changes).length > 0) {
      this.currentQuality = { ...this.currentQuality, ...changes };
      return this.currentQuality;
    }

    return this.currentQuality;
  }

  /**
   * Increase quality for better visuals
   */
  private increaseQuality(): RenderQuality {
    const changes: Partial<RenderQuality> = {};

    if (this.currentQuality.maxParticles < 5000) {
      changes.maxParticles = Math.floor(this.currentQuality.maxParticles * 1.3);
    } else if (this.currentQuality.waterVertices < 10000) {
      changes.waterVertices = Math.floor(this.currentQuality.waterVertices * 1.3);
    } else if (!this.currentQuality.foamParticles) {
      changes.foamParticles = true;
    } else if (this.currentQuality.shadowQuality === 'none') {
      changes.shadowQuality = 'blob' as const;
    }

    if (Object.keys(changes).length > 0) {
      this.currentQuality = { ...this.currentQuality, ...changes };
      return this.currentQuality;
    }

    return this.currentQuality;
  }

  /**
   * Reset frame time history
   */
  resetHistory(): void {
    this.frameTimeHistory = [];
  }

  /**
   * Get current quality
   */
  getCurrentQuality(): RenderQuality {
    return this.currentQuality;
  }
}

// Export singleton
export const qualityManager = new QualityScalingManager();

// Type fix
const clarify = 'clear';
