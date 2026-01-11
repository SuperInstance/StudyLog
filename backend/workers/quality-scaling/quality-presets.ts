/**
 * Quality Presets Module
 *
 * Defines quality settings for each tier.
 * Provides presets for StudyLoG.AI and DMLoG.AI products.
 *
 * @fileoverview Quality preset definitions
 */

import type {
  QualityTier,
  QualitySettings,
  QualityPreset,
  ProductPresets,
  ShadowQuality,
  TextureQuality,
} from './types.js';

// ============================================================================
// Shadow Quality by Tier
// ============================================================================

const SHADOW_QUALITY: Record<QualityTier, ShadowQuality> = {
  [QualityTier.POTATO]: 'none',
  [QualityTier.LOW]: 'blob',
  [QualityTier.MEDIUM]: 'hard',
  [QualityTier.HIGH]: 'soft-pcf',
  [QualityTier.ULTRA]: 'raytraced',
};

// ============================================================================
// Texture Quality by Tier
// ============================================================================

const TEXTURE_QUALITY: Record<QualityTier, TextureQuality> = {
  [QualityTier.POTATO]: 'lowest',
  [QualityTier.LOW]: 'low',
  [QualityTier.MEDIUM]: 'medium',
  [QualityTier.HIGH]: 'high',
  [QualityTier.ULTRA]: 'native',
};

// ============================================================================
// Post Processing by Tier
// ============================================================================

const POST_PROCESSING: Record<QualityTier, QualitySettings['postProcessing']> = {
  [QualityTier.POTATO]: {
    bloom: false,
    ambientOcclusion: false,
    depthOfField: false,
    motionBlur: false,
    chromaticAberration: false,
    colorGrading: false,
    antiAliasing: 'none',
    vignette: false,
  },
  [QualityTier.LOW]: {
    bloom: false,
    ambientOcclusion: false,
    depthOfField: false,
    motionBlur: false,
    chromaticAberration: false,
    colorGrading: true,
    antiAliasing: 'fxaa',
    vignette: false,
  },
  [QualityTier.MEDIUM]: {
    bloom: true,
    ambientOcclusion: false,
    depthOfField: false,
    motionBlur: false,
    chromaticAberration: false,
    colorGrading: true,
    antiAliasing: 'fxaa',
    vignette: true,
  },
  [QualityTier.HIGH]: {
    bloom: true,
    ambientOcclusion: true,
    depthOfField: true,
    motionBlur: false,
    chromaticAberration: false,
    colorGrading: true,
    antiAliasing: 'smaa',
    vignette: true,
  },
  [QualityTier.ULTRA]: {
    bloom: true,
    ambientOcclusion: true,
    depthOfField: true,
    motionBlur: true,
    chromaticAberration: true,
    colorGrading: true,
    antiAliasing: 'taa',
    vignette: true,
  },
};

// ============================================================================
// Effects Quality by Tier
// ============================================================================

const EFFECTS_QUALITY: Record<QualityTier, QualitySettings['effects']> = {
  [QualityTier.POTATO]: {
    particles: 'none',
    water: 'basic',
    fireSmoke: 'none',
    weather: 'none',
    screenSpace: false,
  },
  [QualityTier.LOW]: {
    particles: 'simple',
    water: 'basic',
    fireSmoke: 'simple',
    weather: 'simple',
    screenSpace: false,
  },
  [QualityTier.MEDIUM]: {
    particles: 'standard',
    water: 'standard',
    fireSmoke: 'standard',
    weather: 'standard',
    screenSpace: true,
  },
  [QualityTier.HIGH]: {
    particles: 'standard',
    water: 'high',
    fireSmoke: 'standard',
    weather: 'standard',
    screenSpace: true,
  },
  [QualityTier.ULTRA]: {
    particles: 'advanced',
    water: 'ultra',
    fireSmoke: 'advanced',
    weather: 'advanced',
    screenSpace: true,
  },
};

// ============================================================================
// Rendering Settings by Tier
// ============================================================================

const RENDERING_SETTINGS: Record<QualityTier, QualitySettings['rendering']> = {
  [QualityTier.POTATO]: {
    renderScale: 0.5,
    vsync: false,
    frameRateCap: 30,
    reflections: 'none',
    globalIllumination: 'none',
    tessellation: false,
  },
  [QualityTier.LOW]: {
    renderScale: 0.67,
    vsync: true,
    frameRateCap: 60,
    reflections: 'none',
    globalIllumination: 'none',
    tessellation: false,
  },
  [QualityTier.MEDIUM]: {
    renderScale: 1.0,
    vsync: true,
    frameRateCap: 60,
    reflections: 'probes',
    globalIllumination: 'lightprobes',
    tessellation: false,
  },
  [QualityTier.HIGH]: {
    renderScale: 1.0,
    vsync: true,
    frameRateCap: 144,
    reflections: 'ssr',
    globalIllumination: 'lumen',
    tessellation: true,
  },
  [QualityTier.ULTRA]: {
    renderScale: 1.5,
    vsync: true,
    frameRateCap: 0,
    reflections: 'raytraced',
    globalIllumination: 'lumen',
    tessellation: true,
  },
};

// ============================================================================
// LOD Settings by Tier
// ============================================================================

const LOD_SETTINGS: Record<QualityTier, QualitySettings['lod']> = {
  [QualityTier.POTATO]: {
    enabled: true,
    levels: 2,
    distanceMultiplier: 0.5,
    screenRatioThreshold: 0.1,
    ditherTransitions: false,
  },
  [QualityTier.LOW]: {
    enabled: true,
    levels: 2,
    distanceMultiplier: 0.75,
    screenRatioThreshold: 0.08,
    ditherTransitions: false,
  },
  [QualityTier.MEDIUM]: {
    enabled: true,
    levels: 3,
    distanceMultiplier: 1.0,
    screenRatioThreshold: 0.05,
    ditherTransitions: true,
  },
  [QualityTier.HIGH]: {
    enabled: true,
    levels: 4,
    distanceMultiplier: 1.5,
    screenRatioThreshold: 0.03,
    ditherTransitions: true,
  },
  [QualityTier.ULTRA]: {
    enabled: true,
    levels: 5,
    distanceMultiplier: 2.0,
    screenRatioThreshold: 0.02,
    ditherTransitions: true,
  },
};

// ============================================================================
// Tier Limits
// ============================================================================

const MAX_DYNAMIC_LIGHTS: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 2,
  [QualityTier.LOW]: 4,
  [QualityTier.MEDIUM]: 8,
  [QualityTier.HIGH]: 16,
  [QualityTier.ULTRA]: 32,
};

const MAX_PARTICLES: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 500,
  [QualityTier.LOW]: 2000,
  [QualityTier.MEDIUM]: 10000,
  [QualityTier.HIGH]: 20000,
  [QualityTier.ULTRA]: 50000,
};

const DRAW_DISTANCE: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 50,
  [QualityTier.LOW]: 100,
  [QualityTier.MEDIUM]: 200,
  [QualityTier.HIGH]: 300,
  [QualityTier.ULTRA]: 500,
};

// ============================================================================
// Quality Settings by Tier
// ============================================================================

/**
 * Get quality settings for a specific tier.
 */
export function getQualitySettings(tier: QualityTier): QualitySettings {
  return {
    tier,
    name: QualityTier[tier],
    description: getTierDescription(tier),
    shadows: SHADOW_QUALITY[tier],
    textures: TEXTURE_QUALITY[tier],
    effects: EFFECTS_QUALITY[tier],
    postProcessing: POST_PROCESSING[tier],
    rendering: RENDERING_SETTINGS[tier],
    lod: LOD_SETTINGS[tier],
    maxDynamicLights: MAX_DYNAMIC_LIGHTS[tier],
    maxParticles: MAX_PARTICLES[tier],
    drawDistance: DRAW_DISTANCE[tier],
    useStreaming: tier >= QualityTier.MEDIUM,
  };
}

/**
 * Get description for a quality tier.
 */
function getTierDescription(tier: QualityTier): string {
  switch (tier) {
    case QualityTier.POTATO:
      return 'Minimal quality - pure voxels and 2D sprites. Best performance.';
    case QualityTier.LOW:
      return 'Low quality - simple 3D with basic lighting. Good performance.';
    case QualityTier.MEDIUM:
      return 'Medium quality - standard 3D with shaders. Balanced.';
    case QualityTier.HIGH:
      return 'High quality - detailed 3D with PBR materials and shadows.';
    case QualityTier.ULTRA:
      return 'Ultra quality - cinematic visuals with ray tracing.';
    default:
      return 'Unknown tier';
  }
}

// ============================================================================
// Quality Presets
// ============================================================================

/**
 * All quality presets available to users.
 */
export const QUALITY_PRESETS: QualityPreset[] = [
  {
    id: 'potato',
    name: 'Potato',
    description: 'Minimum quality for maximum performance. Pure voxels and 2D sprites.',
    tier: QualityTier.POTATO,
    settings: getQualitySettings(QualityTier.POTATO),
    icon: '🥔',
    badge: 'Max FPS',
  },
  {
    id: 'low',
    name: 'Low',
    description: 'Simple 3D models with basic lighting. Good for older hardware.',
    tier: QualityTier.LOW,
    settings: getQualitySettings(QualityTier.LOW),
    icon: '⚡',
    badge: 'Performance',
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Standard 3D quality with shaders and effects. Recommended for most users.',
    tier: QualityTier.MEDIUM,
    settings: getQualitySettings(QualityTier.MEDIUM),
    icon: '⚖️',
    badge: 'Balanced',
    recommended: true,
  },
  {
    id: 'high',
    name: 'High',
    description: 'Detailed 3D with PBR materials, shadows, and advanced effects.',
    tier: QualityTier.HIGH,
    settings: getQualitySettings(QualityTier.HIGH),
    icon: '✨',
    badge: 'Quality',
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: 'Cinematic quality with ray tracing and maximum detail.',
    tier: QualityTier.ULTRA,
    settings: getQualitySettings(QualityTier.ULTRA),
    icon: '💎',
    badge: 'Ultra',
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Manually configure each setting for your preference.',
    tier: QualityTier.MEDIUM,
    settings: getQualitySettings(QualityTier.MEDIUM),
    icon: '🎨',
    badge: 'Custom',
  },
];

// ============================================================================
// Product-Specific Presets
// ============================================================================

/**
 * StudyLoG.AI quality presets with education-specific optimizations.
 */
export const STUDYLOG_PRESETS: ProductPresets = {
  product: 'studylog',
  presets: QUALITY_PRESETS,
  defaultPreset: 'medium',
  overrides: {
    // StudyLoG prioritizes clarity for educational content
    [QualityTier.LOW.toString()]: {
      rendering: {
        ...RENDERING_SETTINGS[QualityTier.LOW],
        frameRateCap: 30, // Educational content doesn't need high FPS
      },
    },
  },
};

/**
 * DMLoG.AI quality presets with TTRPG-specific optimizations.
 */
export const DMLOG_PRESETS: ProductPresets = {
  product: 'dmlog',
  presets: QUALITY_PRESETS,
  defaultPreset: 'medium',
  overrides: {
    // DMLoG prioritizes visual fidelity for battle maps
    [QualityTier.MEDIUM.toString()]: {
      drawDistance: 150, // Battle maps don't need long draw distance
      maxDynamicLights: 12, // More lights for dungeon ambiance
    },
  },
};

/**
 * Get presets for a specific product.
 */
export function getProductPresets(product: 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog'): ProductPresets {
  switch (product) {
    case 'studylog':
      return STUDYLOG_PRESETS;
    case 'dmlog':
      return DMLOG_PRESETS;
    default:
      return {
        product,
        presets: QUALITY_PRESETS,
        defaultPreset: 'medium',
      };
  }
}

/**
 * Get a preset by ID.
 */
export function getPresetById(id: string): QualityPreset | undefined {
  return QUALITY_PRESETS.find(p => p.id === id);
}

/**
 * Get presets available to a user based on their budget tier.
 */
export function getAvailablePresets(maxTier: QualityTier): QualityPreset[] {
  return QUALITY_PRESETS.filter(p => p.tier <= maxTier || p.id === 'custom');
}

// ============================================================================
// Settings Conversion
// ============================================================================

/**
 * Convert quality settings to a format suitable for Godot.
 */
export function settingsToGodot(settings: QualitySettings): Record<string, unknown> {
  return {
    rendering_quality: QualityTier[settings.tier].toLowerCase(),
    shadows: settings.shadows,
    texture_quality: settings.textures,
    msaa: settings.postProcessing.antiAliasing === 'msaa' ? 4 : 0,
    fxaa: settings.postProcessing.antiAliasing === 'fxaa' ? 1 : 0,
    taa: settings.postProcessing.antiAliasing === 'taa' ? 1 : 0,
    bloom: settings.postProcessing.bloom ? 1 : 0,
    ssao: settings.postProcessing.ambientOcclusion ? 1 : 0,
    dof: settings.postProcessing.depthOfField ? 1 : 0,
    motion_blur: settings.postProcessing.motionBlur ? 1 : 0,
    render_scale: settings.rendering.renderScale,
    max_fps: settings.rendering.frameRateCap,
    vsync: settings.rendering.vsync ? 1 : 0,
    reflection_quality: settings.rendering.reflections,
    gi_quality: settings.rendering.globalIllumination,
    lod_levels: settings.lod.levels,
    draw_distance: settings.drawDistance,
    max_particles: settings.maxParticles,
  };
}

/**
 * Convert quality settings to a format suitable for WebGL/Three.js.
 */
export function settingsToWebGL(settings: QualitySettings): Record<string, unknown> {
  return {
    pixelRatio: settings.rendering.renderScale,
    antialias: settings.postProcessing.antiAliasing !== 'none',
    shadows: {
      enabled: settings.shadows !== 'none',
      type: settings.shadows,
    },
    textureEncoding: settings.tier >= QualityTier.HIGH ? 'srgb' : 'linear',
    outputEncoding: 'srgb',
    toneMapping: settings.tier >= QualityTier.MEDIUM ? 'aces' : 'linear',
    toneMappingExposure: 1.0,
    physicallyCorrectLights: settings.tier >= QualityTier.HIGH,
    particles: {
      count: settings.maxParticles,
    },
  };
}

/**
 * Merge user overrides with base quality settings.
 */
export function applySettingsOverrides(
  base: QualitySettings,
  overrides: Partial<QualitySettings>
): QualitySettings {
  return {
    ...base,
    ...overrides,
    postProcessing: {
      ...base.postProcessing,
      ...overrides.postProcessing,
    },
    rendering: {
      ...base.rendering,
      ...overrides.rendering,
    },
    effects: {
      ...base.effects,
      ...overrides.effects,
    },
    lod: {
      ...base.lod,
      ...overrides.lod,
    },
  };
}

/**
 * Get recommended settings for a specific use case.
 */
export function getRecommendedSettings(useCase: 'education' | 'gaming' | 'visualization'): QualitySettings {
  switch (useCase) {
    case 'education':
      // Prioritize clarity and readability
      return applySettingsOverrides(getQualitySettings(QualityTier.MEDIUM), {
        rendering: {
          renderScale: 1.2, // Sharper for text
          frameRateCap: 60,
        },
      });
    case 'gaming':
      // Prioritize responsiveness
      return applySettingsOverrides(getQualitySettings(QualityTier.MEDIUM), {
        rendering: {
          renderScale: 1.0,
          frameRateCap: 0, // Unlimited for gaming
        },
        postProcessing: {
          motionBlur: true, // Motion blur for gaming feel
        },
      });
    case 'visualization':
      // Prioritize quality
      return applySettingsOverrides(getQualitySettings(QualityTier.HIGH), {
        rendering: {
          renderScale: 1.0,
          frameRateCap: 30, // Don't need high FPS for visualization
        },
      });
  }
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Create a quality presets manager instance.
 */
export function createQualityPresetsManager() {
  return {
    getSettings: getQualitySettings,
    getPreset: getPresetById,
    getPresets: () => QUALITY_PRESETS,
    getAvailablePresets,
    getProductPresets,
    toGodot: settingsToGodot,
    toWebGL: settingsToWebGL,
    applyOverrides: applySettingsOverrides,
    getRecommended: getRecommendedSettings,
  };
}
