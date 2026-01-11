/**
 * Visual State Module
 *
 * Handles generative AI-driven visual transformations for being states.
 * Integrates with image generation APIs and Godot material/shader systems.
 */

import type {
  BeingStateEnv,
  VisualState,
  VisualTransformation,
  VisualEffect,
  MaterialConfig,
  ParticleConfig,
  ShaderConfig,
  ModelModification,
  LightingConfig,
  RGB,
} from './types';

// ============================================================================
// Visual State Presets
// ============================================================================

interface VisualStatePreset {
  materials: MaterialConfig[];
  particles: ParticleConfig[];
  shaders?: ShaderConfig[];
  modelMods?: ModelModification[];
  lighting?: LightingConfig;
}

const VISUAL_PRESETS: Record<VisualState, VisualStatePreset> = {
  ethereal: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.8, g: 0.9, b: 1.0, a: 0.6 },
        metallic: 0.1,
        roughness: 0.3,
        emission: { r: 0.5, g: 0.7, b: 1.0 },
        emissionIntensity: 0.5,
        shaderCode: ETHEREAL_SHADER,
      },
    ],
    particles: [
      {
        name: 'ethereal_dust',
        target: 'entity',
        count: 100,
        lifetime: 3.0,
        shape: 'sphere',
        size: { min: 0.05, max: 0.15 },
        velocity: { min: 0.1, max: 0.3 },
        colors: [
          { r: 1, g: 1, b: 1, a: 0.8 },
          { r: 0.7, g: 0.8, b: 1, a: 0.4 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.3, g: 0.35, b: 0.4 },
      ambientIntensity: 0.5,
      lights: [
        {
          type: 'directional',
          position: [0, 10, 0],
          color: { r: 0.9, g: 0.95, b: 1 },
          intensity: 0.8,
          shadows: true,
        },
      ],
    },
  },

  mechanical: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.4, g: 0.45, b: 0.5 },
        metallic: 0.9,
        roughness: 0.2,
        emission: { r: 0.1, g: 0.3, b: 0.5 },
        emissionIntensity: 0.2,
        shaderCode: MECHANICAL_SHADER,
      },
    ],
    particles: [
      {
        name: 'sparks',
        target: 'joints',
        count: 20,
        lifetime: 0.5,
        shape: 'sphere',
        size: { min: 0.02, max: 0.05 },
        velocity: { min: 2, max: 4 },
        acceleration: [0, -9.8, 0],
        colors: [
          { r: 1, g: 0.8, b: 0.3, a: 1 },
          { r: 1, g: 0.4, b: 0.1, a: 0.5 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.15, g: 0.15, b: 0.2 },
      ambientIntensity: 0.3,
      lights: [
        {
          type: 'omni',
          position: [0, 2, 0],
          color: { r: 0.3, g: 0.5, b: 0.8 },
          intensity: 1.5,
          shadows: true,
        },
      ],
    },
  },

  organic: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.3, g: 0.6, b: 0.3 },
        metallic: 0.0,
        roughness: 0.8,
        shaderCode: ORGANIC_SHADER,
      },
    ],
    particles: [
      {
        name: 'pollen',
        target: 'entity',
        count: 50,
        lifetime: 5.0,
        shape: 'sphere',
        size: { min: 0.03, max: 0.08 },
        velocity: { min: 0.2, max: 0.5 },
        colors: [
          { r: 0.9, g: 0.95, b: 0.7, a: 0.9 },
          { r: 0.6, g: 0.8, b: 0.4, a: 0.6 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.35, g: 0.4, b: 0.3 },
      ambientIntensity: 0.6,
      lights: [
        {
          type: 'directional',
          position: [5, 10, 5],
          color: { r: 1, g: 0.95, b: 0.85 },
          intensity: 1.0,
          shadows: true,
        },
      ],
    },
  },

  crystalline: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.9, g: 0.95, b: 1 },
        metallic: 0.2,
        roughness: 0.05,
        emission: { r: 0.6, g: 0.8, b: 1 },
        emissionIntensity: 0.8,
        shaderCode: CRYSTALLINE_SHADER,
      },
    ],
    particles: [
      {
        name: 'crystal_shards',
        target: 'entity',
        count: 30,
        lifetime: 2.0,
        shape: 'box',
        size: { min: 0.1, max: 0.3 },
        velocity: { min: 0.5, max: 1.5 },
        colors: [
          { r: 0.7, g: 0.85, b: 1, a: 0.9 },
          { r: 0.5, g: 0.7, b: 0.95, a: 0.7 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.4, g: 0.45, b: 0.5 },
      ambientIntensity: 0.7,
      lights: [
        {
          type: 'spot',
          position: [0, 10, 0],
          color: { r: 0.8, g: 0.9, b: 1 },
          intensity: 2.0,
          shadows: true,
        },
      ],
    },
  },

  shadow: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.05, g: 0.05, b: 0.08 },
        metallic: 0.3,
        roughness: 0.7,
        shaderCode: SHADOW_SHADER,
      },
    ],
    particles: [
      {
        name: 'shadow wisps',
        target: 'entity',
        count: 40,
        lifetime: 4.0,
        shape: 'sphere',
        size: { min: 0.1, max: 0.4 },
        velocity: { min: 0.3, max: 0.8 },
        colors: [
          { r: 0.1, g: 0.1, b: 0.15, a: 0.5 },
          { r: 0.05, g: 0.05, b: 0.1, a: 0.2 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.02, g: 0.02, b: 0.03 },
      ambientIntensity: 0.2,
      lights: [],
    },
  },

  radiant: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 1, g: 0.98, b: 0.95 },
        metallic: 0.1,
        roughness: 0.2,
        emission: { r: 1, g: 0.95, b: 0.8 },
        emissionIntensity: 2.0,
        shaderCode: RADIANT_SHADER,
      },
    ],
    particles: [
      {
        name: 'light_rays',
        target: 'entity',
        count: 60,
        lifetime: 1.5,
        shape: 'cylinder',
        size: { min: 0.05, max: 0.15 },
        velocity: { min: 1, max: 3 },
        colors: [
          { r: 1, g: 1, b: 0.9, a: 0.8 },
          { r: 1, g: 0.9, b: 0.7, a: 0.4 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.5, g: 0.48, b: 0.45 },
      ambientIntensity: 1.0,
      lights: [
        {
          type: 'omni',
          position: [0, 0, 0],
          color: { r: 1, g: 0.98, b: 0.95 },
          intensity: 3.0,
          shadows: true,
        },
      ],
    },
  },

  void: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0, g: 0, b: 0 },
        metallic: 1.0,
        roughness: 0.0,
        shaderCode: VOID_SHADER,
      },
    ],
    particles: [
      {
        name: 'void_particles',
        target: 'entity',
        count: 80,
        lifetime: 6.0,
        shape: 'sphere',
        size: { min: 0.02, max: 0.1 },
        velocity: { min: -0.5, max: 0.5 },
        colors: [
          { r: 0.2, g: 0, b: 0.3, a: 0.6 },
          { r: 0, g: 0, b: 0, a: 0.3 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0, g: 0, b: 0 },
      ambientIntensity: 0,
      lights: [
        {
          type: 'omni',
          position: [0, 0, 0],
          color: { r: 0.3, g: 0, b: 0.4 },
          intensity: 0.5,
        },
      ],
    },
  },

  elemental: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.6, g: 0.4, b: 0.2 },
        metallic: 0.0,
        roughness: 0.9,
        emission: { r: 1, g: 0.5, b: 0 },
        emissionIntensity: 1.0,
        shaderCode: ELEMENTAL_SHADER,
      },
    ],
    particles: [
      {
        name: 'embers',
        target: 'entity',
        count: 70,
        lifetime: 2.5,
        shape: 'sphere',
        size: { min: 0.03, max: 0.1 },
        velocity: { min: 0.5, max: 2 },
        acceleration: [0, 1, 0],
        colors: [
          { r: 1, g: 0.8, b: 0.2, a: 1 },
          { r: 1, g: 0.3, b: 0, a: 0.6 },
          { r: 0.5, g: 0, b: 0, a: 0.2 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.25, g: 0.15, b: 0.1 },
      ambientIntensity: 0.4,
      lights: [
        {
          type: 'omni',
          position: [0, 1, 0],
          color: { r: 1, g: 0.6, b: 0.2 },
          intensity: 2.5,
          shadows: true,
        },
      ],
    },
  },

  cyber: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0, g: 0.1, b: 0.15 },
        metallic: 0.8,
        roughness: 0.3,
        emission: { r: 0, g: 1, b: 1 },
        emissionIntensity: 1.5,
        shaderCode: CYBER_SHADER,
      },
    ],
    particles: [
      {
        name: 'digital_fragments',
        target: 'entity',
        count: 50,
        lifetime: 1.0,
        shape: 'box',
        size: { min: 0.05, max: 0.15 },
        velocity: { min: 1, max: 3 },
        colors: [
          { r: 0, g: 1, b: 1, a: 0.9 },
          { r: 1, g: 0, b: 1, a: 0.7 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0, g: 0.05, b: 0.1 },
      ambientIntensity: 0.3,
      lights: [
        {
          type: 'spot',
          position: [2, 5, 0],
          color: { r: 0, g: 1, b: 1 },
          intensity: 2.0,
          shadows: true,
        },
      ],
    },
  },

  ancient: {
    materials: [
      {
        target: 'entity',
        albedo: { r: 0.4, g: 0.35, b: 0.3 },
        metallic: 0.1,
        roughness: 0.85,
        emission: { r: 0.4, g: 0.3, b: 0.2 },
        emissionIntensity: 0.3,
        shaderCode: ANCIENT_SHADER,
      },
    ],
    particles: [
      {
        name: 'ancient_dust',
        target: 'entity',
        count: 60,
        lifetime: 8.0,
        shape: 'sphere',
        size: { min: 0.02, max: 0.06 },
        velocity: { min: 0.1, max: 0.3 },
        colors: [
          { r: 0.6, g: 0.55, b: 0.45, a: 0.7 },
          { r: 0.4, g: 0.35, b: 0.3, a: 0.4 },
        ],
      },
    ],
    lighting: {
      ambient: { r: 0.2, g: 0.18, b: 0.15 },
      ambientIntensity: 0.35,
      lights: [
        {
          type: 'directional',
          position: [-3, 8, 3],
          color: { r: 0.9, g: 0.85, b: 0.75 },
          intensity: 0.7,
          shadows: true,
          shadowBias: 0.05,
        },
      ],
    },
  },
};

// ============================================================================
// Godot Shader Code
// ============================================================================

const ETHEREAL_SHADER = `
shader_type spatial;
render_mode blend_mix, depth_draw_alpha, cull_disabled;

uniform float intensity : hint_range(0, 1) = 0.5;
uniform float time : source_time = 0.0;

void fragment() {
    float noise = sin(NORMAL.x * 10.0 + time) * cos(NORMAL.y * 10.0 + time);
    float alpha = (0.3 + noise * 0.2) * intensity;
    ALBEDO = vec3(0.8, 0.9, 1.0) * (1.0 + noise * 0.2);
    EMISSION = vec3(0.5, 0.7, 1.0) * intensity * 0.5;
    ALPHA = alpha;
    ROUGHNESS = 0.3;
    METALLIC = 0.1;
}
`;

const MECHANICAL_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;

void fragment() {
    vec2 grid = floor(UV * 20.0);
    float grid_line = step(0.9, fract(grid.x)) + step(0.9, fract(grid.y));

    vec3 base_color = vec3(0.4, 0.45, 0.5);
    vec3 glow_color = vec3(0.1, 0.3, 0.5) * (0.5 + 0.5 * sin(time * 2.0));

    ALBEDO = mix(base_color, glow_color, grid_line * 0.5);
    METALLIC = 0.9;
    ROUGHNESS = 0.2;
    EMISSION = glow_color * grid_line;
}
`;

const ORGANIC_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;

void fragment() {
    float pulse = sin(time * 0.5) * 0.5 + 0.5;
    float vein = sin(UV.x * 50.0 + time) * sin(UV.y * 50.0);

    vec3 base = vec3(0.3, 0.6, 0.3);
    vec3 vein_color = vec3(0.2, 0.4, 0.2);

    ALBEDO = mix(base, vein_color, vein * 0.3 * pulse);
    ROUGHNESS = 0.8 + vein * 0.1;
    METALLIC = 0.0;
}
`;

const CRYSTALLINE_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;

void fragment() {
    vec3 view_dir = normalize(VIEW);
    float fresnel = pow(1.0 - dot(NORMAL, view_dir), 3.0);

    float sparkle = pow(sin(UV.x * 100.0) * sin(UV.y * 100.0), 10.0);

    vec3 base = vec3(0.9, 0.95, 1.0);
    vec3 glow = vec3(0.6, 0.8, 1.0) * (fresnel + sparkle);

    ALBEDO = base;
    METALLIC = 0.2;
    ROUGHNESS = 0.05;
    EMISSION = glow * 0.8;
}
`;

const SHADOW_SHADER = `
shader_type spatial;
render_mode blend_mix, unshaded;

uniform float time : source_time = 0.0;

void fragment() {
    float dissolve = sin(time * 0.3) * 0.5 + 0.5;
    float edge = dissolve * 0.3;

    float alpha = 0.7 + dissolve * 0.2;
    vec3 color = vec3(0.05, 0.05, 0.08) * (1.0 + dissolve * 0.5);

    ALBEDO = color;
    ALPHA = alpha;
}
`;

const RADIANT_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;
uniform float intensity : hint_range(0, 3) = 2.0;

void fragment() {
    float pulse = sin(time * 3.0) * 0.2 + 0.8;
    vec3 view_dir = normalize(VIEW);
    float rim = pow(1.0 - dot(NORMAL, view_dir), 2.0);

    vec3 base = vec3(1.0, 0.98, 0.95);
    vec3 glow = vec3(1.0, 0.95, 0.8) * rim * intensity * pulse;

    ALBEDO = base;
    METALLIC = 0.1;
    ROUGHNESS = 0.2;
    EMISSION = glow;
}
`;

const VOID_SHADER = `
shader_type spatial;
render_mode blend_add, unshaded;

uniform float time : source_time = 0.0;

void fragment() {
    float distortion = sin(UV.x * 20.0 + time) * sin(UV.y * 20.0 + time);
    float absorption = distortion * 0.3;

    vec3 color = vec3(0.0);
    float alpha = 0.5 + absorption * 0.3;

    ALBEDO = color * (1.0 - absorption);
    ALPHA = alpha;
}
`;

const ELEMENTAL_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;

void fragment() {
    float flicker = sin(time * 10.0) * 0.3 + 0.7;
    float heat = UV.y * flicker;

    vec3 cool = vec3(0.3, 0.1, 0.0);
    vec3 hot = vec3(1.0, 0.8, 0.2);
    vec3 burning = vec3(1.0, 0.2, 0.0);

    vec3 color;
    if (heat < 0.5) {
        color = mix(cool, hot, heat * 2.0);
    } else {
        color = mix(hot, burning, (heat - 0.5) * 2.0);
    }

    ALBEDO = color;
    EMISSION = color * flicker * 0.5;
    METALLIC = 0.0;
    ROUGHNESS = 0.9;
}
`;

const CYBER_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;

void fragment() {
    vec2 grid_uv = floor(UV * 15.0);
    float grid_hash = fract(sin(dot(grid_uv, vec2(12.9898, 78.233))) * 43758.5453);
    float glitch = step(0.95, grid_hash) * sin(time * 20.0 + grid_hash * 100.0);

    vec3 base = vec3(0.0, 0.1, 0.15);
    vec3 neon_cyan = vec3(0.0, 1.0, 1.0);
    vec3 neon_magenta = vec3(1.0, 0.0, 1.0);

    vec3 color = mix(neon_cyan, neon_magenta, UV.x + glitch);
    color = mix(base, color, 0.3 + abs(glitch) * 0.5);

    ALBEDO = base;
    EMISSION = color * 1.5;
    METALLIC = 0.8;
    ROUGHNESS = 0.3;
}
`;

const ANCIENT_SHADER = `
shader_type spatial;

uniform float time : source_time = 0.0;

void fragment() {
    float wear = fract(sin(dot(UV, vec2(12.9898, 78.233))) * 43758.5453);
    float rune_pattern = step(0.7, sin(UV.x * 8.0) * sin(UV.y * 8.0));

    vec3 base = vec3(0.4, 0.35, 0.3);
    vec3 aged = vec3(0.3, 0.25, 0.2);
    vec3 rune_glow = vec3(0.4, 0.3, 0.2);

    vec3 color = mix(base, aged, wear * 0.5);
    float glow = rune_pattern * (0.3 + 0.2 * sin(time * 0.5));

    ALBEDO = color;
    EMISSION = rune_glow * glow;
    ROUGHNESS = 0.85 + wear * 0.1;
    METALLIC = 0.1;
}
`;

// ============================================================================
// Visual State Manager Class
// ============================================================================

export class VisualStateManager {
  private env: BeingStateEnv;
  private textureCache: Map<string, string> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Visual Transformation Generation
  // ========================================================================

  /**
   * Generate visual transformation for a state
   */
  async generateTransformation(
    state: VisualState,
    intensity: number,
    targetEntity?: string
  ): Promise<VisualTransformation> {
    const preset = VISUAL_PRESETS[state];

    // Apply intensity scaling
    const transformation: VisualTransformation = {
      state,
      materials: this.scaleMaterials(preset.materials, intensity, targetEntity),
      particles: this.scaleParticles(preset.particles, intensity, targetEntity),
      shaders: preset.shaders?.map((s) => ({
        ...s,
        uniforms: {
          ...s.uniforms,
          intensity,
        },
      })),
      modelMods: preset.modelMods,
      lighting: preset.lighting,
    };

    return transformation;
  }

  /**
   * Generate AI-based textures for materials
   */
  async generateAITextures(
    state: VisualState,
    materialConfig: MaterialConfig
  ): Promise<MaterialConfig> {
    const enhanced: MaterialConfig = { ...materialConfig };

    if (materialConfig.texturePrompts) {
      const textures: Record<string, string> = {};

      for (const [type, prompt] of Object.entries(materialConfig.texturePrompts)) {
        const cacheKey = `${state}_${type}_${prompt}`;

        // Check cache
        if (this.textureCache.has(cacheKey)) {
          textures[type] = this.textureCache.get(cacheKey)!;
          continue;
        }

        // Generate texture (using configured image generation service)
        const textureUrl = await this.generateTexture(prompt, state);
        textures[type] = textureUrl;

        // Cache result
        this.textureCache.set(cacheKey, textureUrl);
      }

      enhanced.texturePrompts = textures as any;
    }

    return enhanced;
  }

  // ========================================================================
  // Visual Effects Generation
  // ========================================================================

  /**
   * Generate visual effects for state transition
   */
  async generateTransitionEffects(
    fromState: VisualState,
    toState: VisualState,
    intensity: number,
    target: string
  ): Promise<VisualEffect[]> {
    const effects: VisualEffect[] = [];

    // Transition particle burst
    effects.push({
      id: crypto.randomUUID(),
      type: 'particle',
      target,
      config: {
        name: 'transition_burst',
        count: Math.floor(50 * intensity),
        lifetime: 1.0,
        colors: this.getStateColor(fromState, intensity),
      },
      duration: 1000,
      easing: 'ease-out',
    });

    // Material transition
    effects.push({
      id: crypto.randomUUID(),
      type: 'material',
      target,
      config: {
        state: toState,
        duration: 500 * (1.1 - intensity),
      },
      duration: 500,
      easing: 'ease-in-out',
    });

    // Special effects for specific transitions
    if (toState === 'radiant' || toState === 'ethereal') {
      effects.push({
        id: crypto.randomUUID(),
        type: 'glow',
        target,
        config: {
          intensity: intensity * 2,
          duration: 1500,
        },
        duration: 1500,
        easing: 'ease-out',
      });
    }

    if (toState === 'void' || toState === 'shadow') {
      effects.push({
        id: crypto.randomUUID(),
        type: 'transparency',
        target,
        config: {
          opacity: 0.3 + intensity * 0.4,
          duration: 1000,
        },
        duration: 1000,
        easing: 'ease-in',
      });
    }

    return effects;
  }

  // ========================================================================
  // Procedural Asset Generation
  // ========================================================================

  /**
   * Generate procedural 3D model modifications
   */
  generateModelMods(
    state: VisualState,
    baseModel: string
  ): ModelModification[] {
    const mods: ModelModification[] = [];

    switch (state) {
      case 'ethereal':
        mods.push({
          target: baseModel,
          vertexDisplacement: {
            amplitude: 0.2,
            frequency: 2.0,
            speed: 1.0,
          },
        });
        break;

      case 'organic':
        mods.push({
          target: baseModel,
          deformation: {
            type: 'noise',
            strength: 0.3,
          },
        });
        break;

      case 'mechanical':
        mods.push({
          target: baseModel,
          deformation: {
            type: 'spike',
            strength: 0.1,
          },
        });
        break;

      case 'crystalline':
        mods.push({
          target: baseModel,
          deformation: {
            type: 'spike',
            strength: 0.2,
          },
        });
        break;
    }

    return mods;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Scale material properties by intensity
   */
  private scaleMaterials(
    materials: MaterialConfig[],
    intensity: number,
    target?: string
  ): MaterialConfig[] {
    return materials.map((m) => ({
      ...m,
      target: target ?? m.target,
      emissionIntensity: (m.emissionIntensity ?? 0) * intensity,
    }));
  }

  /**
   * Scale particle properties by intensity
   */
  private scaleParticles(
    particles: ParticleConfig[],
    intensity: number,
    target?: string
  ): ParticleConfig[] {
    return particles.map((p) => ({
      ...p,
      target: target ?? p.target,
      count: Math.floor(p.count * intensity),
      lifetime: p.lifetime * (0.8 + intensity * 0.4),
    }));
  }

  /**
   * Get state color for transitions
   */
  private getStateColor(state: VisualState, intensity: number): RGB[] {
    const colors: Record<VisualState, RGB[]> = {
      ethereal: [
        { r: 0.8, g: 0.9, b: 1, a: intensity },
        { r: 0.5, g: 0.7, b: 1, a: intensity * 0.5 },
      ],
      mechanical: [
        { r: 0.4, g: 0.5, b: 0.6, a: intensity },
        { r: 0.2, g: 0.3, b: 0.5, a: intensity * 0.5 },
      ],
      organic: [
        { r: 0.3, g: 0.6, b: 0.3, a: intensity },
        { r: 0.5, g: 0.7, b: 0.3, a: intensity * 0.5 },
      ],
      crystalline: [
        { r: 0.9, g: 0.95, b: 1, a: intensity },
        { r: 0.6, g: 0.8, b: 1, a: intensity * 0.5 },
      ],
      shadow: [
        { r: 0.1, g: 0.1, b: 0.15, a: intensity * 0.8 },
        { r: 0.05, g: 0.05, b: 0.1, a: intensity * 0.3 },
      ],
      radiant: [
        { r: 1, g: 0.98, b: 0.95, a: intensity },
        { r: 1, g: 0.9, b: 0.7, a: intensity * 0.5 },
      ],
      void: [
        { r: 0.2, g: 0, b: 0.3, a: intensity * 0.6 },
        { r: 0, g: 0, b: 0, a: intensity * 0.3 },
      ],
      elemental: [
        { r: 1, g: 0.8, b: 0.2, a: intensity },
        { r: 1, g: 0.3, b: 0, a: intensity * 0.5 },
      ],
      cyber: [
        { r: 0, g: 1, b: 1, a: intensity },
        { r: 1, g: 0, b: 1, a: intensity * 0.5 },
      ],
      ancient: [
        { r: 0.6, g: 0.55, b: 0.45, a: intensity },
        { r: 0.4, g: 0.35, b: 0.3, a: intensity * 0.5 },
      ],
    };

    return colors[state];
  }

  /**
   * Generate texture using AI service
   */
  private async generateTexture(
    prompt: string,
    state: VisualState
  ): Promise<string> {
    // For now, return a placeholder URL
    // In production, this would call the image-cascade worker
    // or a generative AI API

    const stylePrompts: Record<VisualState, string> = {
      ethereal: 'ethereal, glowing, translucent, soft lighting',
      mechanical: 'mechanical, metallic, geometric, industrial',
      organic: 'organic, natural, flowing, living',
      crystalline: 'crystalline, sharp, refractive, prismatic',
      shadow: 'shadowy, dark, mysterious, misty',
      radiant: 'radiant, bright, luminous, glowing',
      void: 'void, empty, dark, negative space',
      elemental: 'elemental, fire, water, earth, air',
      cyber: 'cyberpunk, neon, digital, glitch',
      ancient: 'ancient, weathered, rune-covered, mysterious',
    };

    const fullPrompt = `${stylePrompts[state]}, ${prompt}`;

    // Return R2 storage path or external generation URL
    return `generated://${state}/${btoa(fullPrompt).slice(0, 16)}`;
  }

  // ========================================================================
  // Godot Bridge Integration
  // ========================================================================

  /**
   * Convert visual transformation to Godot commands
   */
  toGodotCommands(
    transformation: VisualTransformation,
    targetNode: string
  ): string[] {
    const commands: string[] = [];

    // Material updates
    for (const material of transformation.materials) {
      commands.push(
        `rpc_call("${targetNode}", "set_material_override", ${JSON.stringify(material)})`
      );
    }

    // Particle spawns
    for (const particle of transformation.particles) {
      commands.push(
        `emit_particles("${particle.name}", "${particle.target}", ${JSON.stringify(particle.config)})`
      );
    }

    // Lighting updates
    if (transformation.lighting) {
      commands.push(
        `rpc_call("root/WorldEnvironment", "set_lighting", ${JSON.stringify(transformation.lighting)})`
      );
    }

    return commands;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createVisualStateManager(env: BeingStateEnv): VisualStateManager {
  return new VisualStateManager(env);
}
