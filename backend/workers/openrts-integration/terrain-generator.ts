/**
 * Terrain Generator
 *
 * Generates 3D battle maps with PS2-level terrain quality for OpenRTS.
 *
 * ## Features
 *
 * - Procedural heightmap generation (Perlin/Simplex noise)
 * - Terrain layer blending based on slope/height
 * - Automatic decoration placement
 * - Water features (lakes, rivers)
 * - StudyLoG lab map templates
 * - DMLoG battle map templates
 * - Quality-based LOD generation
 *
 * ## Algorithms
 *
 * - **Perlin Noise**: Natural terrain with rolling hills
 * - **Voronoi**: Region-based terrain (biomes)
 * - **Diamond-Square**: Fractal terrain
 * - **Hybrid**: Combine multiple algorithms
 */

import type {
  Vector3,
  Vector2,
  TerrainData,
  TerrainHeightmap,
  TerrainLayer,
  TerrainDecoration,
  QualityTier,
  BattleMapConfig,
  LabStation,
  MapMarker,
  Color,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface TerrainGeneratorConfig {
  /** Map dimensions (in grid cells) */
  mapSize: {
    width: number;
    depth: number;
  };

  /** Height scale */
  heightScale: number;

  /** Cell size in world units */
  cellSize: number;

  /** Quality tier */
  qualityTier: QualityTier;

  /** Seed for random generation */
  seed: number;

  /** Water level */
  waterLevel: number;

  /** Generation algorithm */
  algorithm: TerrainAlgorithm;

  /** Terrain layers */
  layers: TerrainLayer[];

  /** Decoration density */
  decorationDensity: number;
}

export type TerrainAlgorithm =
  | 'perlin'
  | 'simplex'
  | 'voronoi'
  | 'diamond_square'
  | 'hybrid';

export const DEFAULT_TERRAIN_CONFIG: TerrainGeneratorConfig = {
  mapSize: { width: 128, depth: 128 },
  heightScale: 20.0,
  cellSize: 2.0,
  qualityTier: 'high',
  seed: Date.now(),
  waterLevel: 0.2,
  algorithm: 'perlin',
  layers: DEFAULT_TERRAIN_LAYERS,
  decorationDensity: 0.3,
};

// ============================================================================
// Default Terrain Layers
// ============================================================================

export const DEFAULT_TERRAIN_LAYERS: TerrainLayer[] = [
  {
    id: 'sand',
    name: 'Sand',
    albedo: 'res://textures/terrain/sand_albedo.png',
    normal: 'res://textures/terrain/sand_normal.png',
    minSlope: 0,
    maxSlope: 15,
    minHeight: 0,
    maxHeight: 0.25,
  },
  {
    id: 'grass',
    name: 'Grass',
    albedo: 'res://textures/terrain/grass_albedo.png',
    normal: 'res://textures/terrain/grass_normal.png',
    minSlope: 0,
    maxSlope: 30,
    minHeight: 0.15,
    maxHeight: 0.6,
  },
  {
    id: 'dirt',
    name: 'Dirt',
    albedo: 'res://textures/terrain/dirt_albedo.png',
    normal: 'res://textures/terrain/dirt_normal.png',
    minSlope: 15,
    maxSlope: 45,
    minHeight: 0,
    maxHeight: 0.8,
  },
  {
    id: 'rock',
    name: 'Rock',
    albedo: 'res://textures/terrain/rock_albedo.png',
    normal: 'res://textures/terrain/rock_normal.png',
    roughness: 'res://textures/terrain/rock_roughness.png',
    minSlope: 30,
    maxSlope: 90,
    minHeight: 0.5,
    maxHeight: 1.0,
  },
  {
    id: 'snow',
    name: 'Snow',
    albedo: 'res://textures/terrain/snow_albedo.png',
    normal: 'res://textures/terrain/snow_normal.png',
    minSlope: 0,
    maxSlope: 90,
    minHeight: 0.7,
    maxHeight: 1.0,
  },
];

// ============================================================================
// StudyLoG Lab Map Presets
// ============================================================================

export interface LabMapPreset {
  id: string;
  name: string;
  description: string;
  stations: LabStation[];
  markers: MapMarker[];
  lighting: {
    ambient: Color;
    sunDirection: Vector3;
    sunColor: Color;
  };
}

export const STUDYLOG_LAB_PRESETS: LabMapPreset[] = [
  {
    id: 'physics_lab',
    name: 'Physics Laboratory',
    description: 'A hands-on physics lab with 3D equipment for experiments',
    stations: [
      {
        id: 'station_1',
        name: 'Mechanics Station',
        position: { x: -8, y: 0, z: -5 },
        equipment: ['pendulum', 'inclined_plane', 'springs'],
        experiments: ['pendulum_motion', 'friction', 'harmonic_motion'],
      },
      {
        id: 'station_2',
        name: 'Optics Station',
        position: { x: 8, y: 0, z: -5 },
        equipment: ['laser', 'prisms', 'lenses'],
        experiments: ['refraction', 'reflection', 'diffraction'],
      },
      {
        id: 'station_3',
        name: 'Electricity Station',
        position: { x: -8, y: 0, z: 5 },
        equipment: ['circuit_board', 'multimeter', 'power_supply'],
        experiments: ['circuits', 'ohms_law', 'capacitors'],
      },
      {
        id: 'station_4',
        name: 'Waves Station',
        position: { x: 8, y: 0, z: 5 },
        equipment: ['wave_tank', 'oscilloscope', 'signal_generator'],
        experiments: ['wave_properties', 'interference', 'standing_waves'],
      },
    ],
    markers: [
      {
        id: 'safety_note',
        position: { x: 0, y: 1, z: 0 },
        type: 'note',
        label: 'Safety Equipment Location',
        visibleToPlayers: true,
        icon: 'res://icons/safety.png',
      },
    ],
    lighting: {
      ambient: { r: 0.4, g: 0.4, b: 0.5, a: 1 },
      sunDirection: { x: 0.5, y: -1, z: -0.5 },
      sunColor: { r: 1, g: 0.98, b: 0.95, a: 1 },
    },
  },
  {
    id: 'chemistry_lab',
    name: 'Chemistry Laboratory',
    description: 'Virtual chemistry lab for safe experimentation',
    stations: [
      {
        id: 'chem_1',
        name: 'Reaction Station',
        position: { x: -6, y: 0, z: 0 },
        equipment: ['beaker', 'test_tube_rack', 'bunsen_burner'],
        experiments: ['acid_base', 'precipitation', 'combustion'],
      },
      {
        id: 'chem_2',
        name: 'Analysis Station',
        position: { x: 6, y: 0, z: 0 },
        equipment: ['spectrometer', 'ph_meter', 'balance'],
        experiments: ['spectroscopy', 'titration', 'separation'],
      },
    ],
    markers: [],
    lighting: {
      ambient: { r: 0.3, g: 0.35, b: 0.4, a: 1 },
      sunDirection: { x: 0.3, y: -0.8, z: -0.3 },
      sunColor: { r: 1, g: 0.95, b: 0.9, a: 1 },
    },
  },
  {
    id: 'biology_lab',
    name: 'Biology Laboratory',
    description: 'Explore living organisms and ecosystems',
    stations: [
      {
        id: 'bio_1',
        name: 'Microscopy Station',
        position: { x: -5, y: 0, z: -5 },
        equipment: ['microscope', 'slides', 'petri_dish'],
        experiments: ['cell_structure', 'bacteria', 'protists'],
      },
      {
        id: 'bio_2',
        name: 'Genetics Station',
        position: { x: 5, y: 0, z: -5 },
        equipment: ['dna_model', 'centrifuge', 'pipette'],
        experiments: ['dna_extraction', 'punnett_squares', 'mutation'],
      },
      {
        id: 'bio_3',
        name: 'Ecology Station',
        position: { x: 0, y: 0, z: 5 },
        equipment: ['terrarium', 'specimen_jars'],
        experiments: ['food_chains', 'population_dynamics', 'symbiosis'],
      },
    ],
    markers: [],
    lighting: {
      ambient: { r: 0.35, g: 0.4, b: 0.35, a: 1 },
      sunDirection: { x: 0.4, y: -1, z: -0.2 },
      sunColor: { r: 0.95, g: 1, b: 0.95, a: 1 },
    },
  },
];

// ============================================================================
// DMLoG Battle Map Presets
// ============================================================================

export interface BattleMapPreset {
  id: string;
  name: string;
  description: string;
  terrainType: 'dungeon' | 'wilderness' | 'urban' | 'planar' | 'custom';
  dimensions: { width: number; depth: number };
  encounterLevel: number;
  features: BattleMapFeature[];
}

export interface BattleMapFeature {
  type: 'obstacle' | 'cover' | 'hazard' | 'elevation' | 'water' | 'decoration';
  position: Vector3;
  size?: Vector2;
  height?: number;
  modelPath?: string;
  metadata?: Record<string, unknown>;
}

export const DMLOG_BATTLE_PRESETS: BattleMapPreset[] = [
  {
    id: 'dungeon_chamber',
    name: 'Ancient Chamber',
    description: 'A stone-walled dungeon chamber with pillars',
    terrainType: 'dungeon',
    dimensions: { width: 64, depth: 64 },
    encounterLevel: 3,
    features: [
      {
        type: 'obstacle',
        position: { x: -5, y: 0, z: -5 },
        size: { x: 2, y: 2 },
        modelPath: 'res://models/dungeon/pillar.glb',
      },
      {
        type: 'obstacle',
        position: { x: 5, y: 0, z: -5 },
        size: { x: 2, y: 2 },
        modelPath: 'res://models/dungeon/pillar.glb',
      },
      {
        type: 'obstacle',
        position: { x: -5, y: 0, z: 5 },
        size: { x: 2, y: 2 },
        modelPath: 'res://models/dungeon/pillar.glb',
      },
      {
        type: 'obstacle',
        position: { x: 5, y: 0, z: 5 },
        size: { x: 2, y: 2 },
        modelPath: 'res://models/dungeon/pillar.glb',
      },
      {
        type: 'elevation',
        position: { x: 0, y: 1, z: 0 },
        size: { x: 8, y: 8 },
        height: 1,
      },
    ],
  },
  {
    id: 'forest_clearing',
    name: 'Forest Clearing',
    description: 'A woodland clearing with scattered trees',
    terrainType: 'wilderness',
    dimensions: { width: 96, depth: 96 },
    encounterLevel: 2,
    features: [
      {
        type: 'obstacle',
        position: { x: -10, y: 0, z: -8 },
        modelPath: 'res://models/nature/tree_oak.glb',
      },
      {
        type: 'obstacle',
        position: { x: 10, y: 0, z: -8 },
        modelPath: 'res://models/nature/tree_pine.glb',
      },
      {
        type: 'obstacle',
        position: { x: -8, y: 0, z: 10 },
        modelPath: 'res://models/nature/tree_oak.glb',
      },
      {
        type: 'obstacle',
        position: { x: 8, y: 0, z: 10 },
        modelPath: 'res://models/nature/tree_pine.glb',
      },
      {
        type: 'cover',
        position: { x: 0, y: 0, z: -5 },
        size: { x: 4, y: 2 },
        modelPath: 'res://models/nature/boulder.glb',
      },
      {
        type: 'water',
        position: { x: 5, y: -0.5, z: 0 },
        size: { x: 6, y: 4 },
      },
    ],
  },
  {
    id: 'ruined_temple',
    name: 'Ruined Temple',
    description: 'Ancient ruins overgrown with vegetation',
    terrainType: 'wilderness',
    dimensions: { width: 128, depth: 128 },
    encounterLevel: 5,
    features: [
      {
        type: 'elevation',
        position: { x: 0, y: 0.5, z: 0 },
        size: { x: 20, y: 20 },
        height: 0.5,
      },
      {
        type: 'obstacle',
        position: { x: -8, y: 0, z: -8 },
        modelPath: 'res://models/ruins/column_broken.glb',
      },
      {
        type: 'obstacle',
        position: { x: 8, y: 0, z: -8 },
        modelPath: 'res://models/ruins/column_broken.glb',
      },
      {
        type: 'obstacle',
        position: { x: 0, y: 2, z: -10 },
        modelPath: 'res://models/ruins/archway.glb',
      },
    ],
  },
  {
    id: 'urban_alleys',
    name: 'City Alleys',
    description: 'Narrow streets and alleyways of a medieval city',
    terrainType: 'urban',
    dimensions: { width: 80, depth: 80 },
    encounterLevel: 4,
    features: [
      {
        type: 'obstacle',
        position: { x: -10, y: 0, z: 0 },
        size: { x: 4, y: 15 },
        modelPath: 'res://models/urban/building_wall.glb',
      },
      {
        type: 'obstacle',
        position: { x: 10, y: 0, z: 0 },
        size: { x: 4, y: 15 },
        modelPath: 'res://models/urban/building_wall.glb',
      },
      {
        type: 'cover',
        position: { x: 0, y: 0, z: 5 },
        size: { x: 3, y: 1.5 },
        modelPath: 'res://models/urban/crate.glb',
      },
      {
        type: 'elevation',
        position: { x: 5, y: 0.3, z: -5 },
        size: { x: 4, y: 3 },
        height: 0.3,
      },
    ],
  },
];

// ============================================================================
// Terrain Generator Class
// ============================================================================

/**
 * Generates 3D terrain for OpenRTS battle maps
 */
export class TerrainGenerator {
  private permutation: number[] = [];
  private gradients: Vector2[][] = [];

  constructor(
    private config: TerrainGeneratorConfig = DEFAULT_TERRAIN_CONFIG
  ) {
    this.initializeNoise(this.config.seed);
  }

  // ========================================================================
  // Main Generation Methods
  // ========================================================================

  /**
   * Generate complete terrain data
   */
  generate(): TerrainData {
    const heightmap = this.generateHeightmap();
    const layers = this.config.layers;
    const decorations = this.generateDecorations(heightmap);

    // Adjust layers based on quality tier
    const adjustedLayers = this.adjustLayersForQuality(layers);

    return {
      heightmap,
      layers: adjustedLayers,
      decorations,
      waterLevel: this.config.waterLevel,
      material: {
        uvScale: { x: 10, y: 10 },
        triplanar: true,
        blendSharpness: this.qualityTierToBlendSharpness(this.config.qualityTier),
      },
    };
  }

  /**
   * Generate just the heightmap
   */
  generateHeightmap(): TerrainHeightmap {
    const { width, depth } = this.config.mapSize;
    const heights = new Float32Array(width * depth);

    switch (this.config.algorithm) {
      case 'perlin':
      case 'simplex':
        this.noiseHeightmap(heights, width, depth);
        break;
      case 'voronoi':
        this.voronoiHeightmap(heights, width, depth);
        break;
      case 'diamond_square':
        this.diamondSquareHeightmap(heights, width, depth);
        break;
      case 'hybrid':
        this.hybridHeightmap(heights, width, depth);
        break;
    }

    // Normalize heights to 0-1
    this.normalizeHeightmap(heights);

    // Apply height scale
    for (let i = 0; i < heights.length; i++) {
      heights[i] *= this.config.heightScale;
    }

    return {
      width,
      depth,
      heights,
      cellScale: {
        x: this.config.cellSize,
        y: this.config.heightScale,
        z: this.config.cellSize,
      },
      offset: { x: 0, y: 0, z: 0 },
    };
  }

  /**
   * Generate terrain decorations
   */
  generateDecorations(heightmap: TerrainHeightmap): TerrainDecoration[] {
    const decorations: TerrainDecoration[] = [];

    if (this.config.decorationDensity <= 0) {
      return decorations;
    }

    const { width, depth } = this.config.mapSize;
    const cellCount = width * depth;
    const decorationCount = Math.floor(cellCount * this.config.decorationDensity * 0.01);

    // Seeded random for consistent decoration placement
    let seed = this.config.seed + 1000;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < decorationCount; i++) {
      const x = Math.floor(random() * width);
      const z = Math.floor(random() * depth);
      const heightIndex = z * width + x;
      const height = heightmap.heights[heightIndex];

      // Skip underwater decorations
      if (height < this.config.waterLevel * this.config.heightScale) {
        continue;
      }

      const decoration = this.createDecoration(x, z, height, random());
      if (decoration) {
        decorations.push(decoration);
      }
    }

    return decorations;
  }

  // ========================================================================
  // StudyLoG Lab Generation
  // ========================================================================

  /**
   * Generate a StudyLoG lab map
   */
  generateLabMap(presetId: string): {
    terrain: TerrainData;
    preset: LabMapPreset;
  } {
    // Find preset
    const preset = STUDYLOG_LAB_PRESETS.find((p) => p.id === presetId) ||
                   STUDYLOG_LAB_PRESETS[0];

    // Create flat terrain for indoor lab
    const config = { ...this.config };
    config.mapSize = { width: 64, depth: 64 };
    config.heightScale = 0.1; // Nearly flat
    config.algorithm = 'perlin';

    const generator = new TerrainGenerator(config);
    const terrain = generator.generate();

    return { terrain, preset };
  }

  // ========================================================================
  // DMLoG Battle Map Generation
  // ========================================================================

  /**
   * Generate a DMLoG battle map
   */
  generateBattleMap(presetId: string): {
    terrain: TerrainData;
    preset: BattleMapPreset;
  } {
    // Find preset
    const preset = DMLOG_BATTLE_PRESETS.find((p) => p.id === presetId) ||
                   DMLOG_BATTLE_PRESETS[0];

    // Configure terrain based on preset
    const config = { ...this.config };
    config.mapSize = preset.dimensions;

    switch (preset.terrainType) {
      case 'dungeon':
        config.heightScale = 0.5;
        config.algorithm = 'perlin';
        config.layers = DUNGEON_LAYERS;
        break;
      case 'wilderness':
        config.heightScale = 15;
        config.algorithm = 'hybrid';
        config.layers = WILDERNESS_LAYERS;
        break;
      case 'urban':
        config.heightScale = 2;
        config.algorithm = 'perlin';
        config.layers = URBAN_LAYERS;
        break;
      default:
        config.heightScale = 10;
        config.algorithm = 'hybrid';
    }

    const generator = new TerrainGenerator(config);
    const terrain = generator.generate();

    return { terrain, preset };
  }

  /**
   * Create BattleMapConfig from preset
   */
  createBattleMapConfig(presetId: string, presetOverride?: Partial<BattleMapPreset>): BattleMapConfig {
    const result = this.generateBattleMap(presetId);

    const preset: BattleMapPreset = presetOverride
      ? { ...result.preset, ...presetOverride }
      : result.preset;

    return {
      id: preset.id,
      name: preset.name,
      terrain: result.terrain,
      gridSize: 5, // 5ft squares for D&D
      dimensions: preset.dimensions,
      figures: [],
      markers: [],
      lighting: {
        ambient: preset.terrainType === 'dungeon'
          ? { r: 0.2, g: 0.2, b: 0.25, a: 1 }
          : { r: 0.4, g: 0.45, b: 0.5, a: 1 },
        sunDirection: { x: 0.5, y: -1, z: -0.5 },
        sunColor: { r: 1, g: 0.98, b: 0.95, a: 1 },
        shadows: preset.terrainType !== 'dungeon',
      },
      fogAreas: [],
    };
  }

  // ========================================================================
  // Noise Algorithms
  // ========================================================================

  /**
   * Initialize permutation tables for noise
   */
  private initializeNoise(seed: number): void {
    this.permutation = new Array(512);
    const p = new Array(256);

    // Initialize with values 0-255
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for overflow
    for (let i = 0; i < 512; i++) {
      this.permutation[i] = p[i & 255];
    }

    // Initialize gradients
    this.gradients = [];
    for (let i = 0; i < 256; i++) {
      const angle = (i / 256) * Math.PI * 2;
      this.gradients[i] = {
        x: Math.cos(angle),
        y: Math.sin(angle),
      };
    }
  }

  /**
   * Generate heightmap using Perlin-like noise
   */
  private noiseHeightmap(heights: Float32Array, width: number, depth: number): void {
    const octaves = this.qualityTierToOctaves(this.config.qualityTier);
    const persistence = 0.5;
    const lacunarity = 2.0;
    const scale = 0.02;

    let maxAmplitude = 0;
    let amplitude = 1;
    let frequency = scale;

    for (let o = 0; o < octaves; o++) {
      maxAmplitude += amplitude;

      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const idx = z * width + x;
          const noise = this.perlinNoise(x * frequency, z * frequency);
          heights[idx] += noise * amplitude;
        }
      }

      amplitude *= persistence;
      frequency *= lacunarity;
    }

    // Normalize
    for (let i = 0; i < heights.length; i++) {
      heights[i] /= maxAmplitude;
    }
  }

  /**
   * Perlin noise function
   */
  private perlinNoise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const p = this.permutation;
    const g = this.gradients;

    const aa = g[p[X] + p[Y]];
    const ab = g[p[X] + p[Y + 1]];
    const ba = g[p[X + 1] + p[Y]];
    const bb = g[p[X + 1] + p[Y + 1]];

    const x1 = this.lerp(this.dot(aa, xf, yf), this.dot(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.dot(ab, xf, yf - 1), this.dot(bb, xf - 1, yf - 1), u);

    return this.lerp(x1, x2, v);
  }

  /**
   * Generate heightmap using Voronoi diagram
   */
  private voronoiHeightmap(heights: Float32Array, width: number, depth: number): void {
    const pointCount = 50;
    const points: Vector2[] = [];

    // Generate random points
    let seed = this.config.seed;
    for (let i = 0; i < pointCount; i++) {
      seed = (seed * 16807) % 2147483647;
      points.push({
        x: (seed % 1000) / 1000 * width,
        y: ((seed * 16807) % 1000) / 1000 * depth,
      });
    }

    // Assign heights based on nearest point
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        let minDist = Infinity;
        let secondMinDist = Infinity;

        for (const point of points) {
          const dist = Math.sqrt((x - point.x) ** 2 + (z - point.y) ** 2);
          if (dist < minDist) {
            secondMinDist = minDist;
            minDist = dist;
          } else if (dist < secondMinDist) {
            secondMinDist = dist;
          }
        }

        // Use distance to nearest and second nearest for variation
        heights[z * width + x] = (minDist + secondMinDist * 0.5) / 50;
      }
    }
  }

  /**
   * Diamond-Square algorithm for fractal terrain
   */
  private diamondSquareHeightmap(heights: Float32Array, width: number, depth: number): void {
    const size = Math.max(width, depth);
    const powerOfTwo = Math.pow(2, Math.ceil(Math.log2(size)));

    // Initialize corners
    const roughness = 0.5;
    let seed = this.config.seed;

    const getSeededRandom = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed % 10000) / 10000;
    };

    // Simplified implementation - set center and interpolate
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const nz = z / depth;

        // Combine multiple frequencies
        let value = 0;
        let amplitude = 1;
        let frequency = 1;

        for (let o = 0; o < 4; o++) {
          value += Math.sin(nx * Math.PI * 2 * frequency + getSeededRandom() * 10) *
                   Math.sin(nz * Math.PI * 2 * frequency) * amplitude;
          amplitude *= roughness;
          frequency *= 2;
        }

        heights[z * width + x] = (value + 1) * 0.5;
      }
    }
  }

  /**
   * Hybrid: Combine noise and Voronoi
   */
  private hybridHeightmap(heights: Float32Array, width: number, depth: number): void {
    // Generate base noise
    this.noiseHeightmap(heights, width, depth);

    // Apply Voronoi regions for biome-like variation
    const regions = 8;
    const regionSize = width / regions;

    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) {
        const regionX = Math.floor(x / regionSize);
        const regionZ = Math.floor(z / regionSize);
        const regionIdx = (regionX + regionZ * regions) % (regions * regions);

        // Apply region-based modifier
        const modifier = Math.sin(regionIdx * 0.7) * 0.2;
        heights[z * width + x] += modifier;
      }
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private normalizeHeightmap(heights: Float32Array): void {
    let min = Infinity;
    let max = -Infinity;

    for (let i = 0; i < heights.length; i++) {
      min = Math.min(min, heights[i]);
      max = Math.max(max, heights[i]);
    }

    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < heights.length; i++) {
        heights[i] = (heights[i] - min) / range;
      }
    }
  }

  private createDecoration(
    x: number,
    z: number,
    height: number,
    random: () => number
  ): TerrainDecoration | null {
    const decorationRoll = random();

    // Determine decoration type based on height
    const normalizedHeight = height / this.config.heightScale;

    let type: TerrainDecoration['type'];
    let scenePath: string;

    if (normalizedHeight > 0.7) {
      type = 'rock';
      scenePath = 'res://models/terrain/rock.glb';
    } else if (normalizedHeight > this.config.waterLevel) {
      if (decorationRoll < 0.6) {
        type = 'grass';
        scenePath = 'res://models/terrain/grass_clump.glb';
      } else if (decorationRoll < 0.9) {
        type = 'bush';
        scenePath = 'res://models/terrain/bush.glb';
      } else {
        type = 'tree';
        scenePath = random() < 0.5
          ? 'res://models/terrain/tree_oak.glb'
          : 'res://models/terrain/tree_pine.glb';
      }
    } else {
      return null; // No underwater decorations
    }

    return {
      type,
      scenePath,
      position: {
        x: x * this.config.cellSize,
        y: height,
        z: z * this.config.cellSize,
      },
      rotation: { x: 0, y: random() * 360, z: 0 },
      scale: 0.8 + random() * 0.4,
      seed: Math.floor(random() * 10000),
    };
  }

  private adjustLayersForQuality(layers: TerrainLayer[]): TerrainLayer[] {
    const tier = this.config.qualityTier;

    // Low quality: fewer layers, simpler blending
    if (tier === 'low') {
      return layers.slice(0, 3);
    }

    // High quality: all layers
    return layers;
  }

  private qualityTierToOctaves(tier: QualityTier): number {
    const octaves: Record<QualityTier, number> = {
      low: 3,
      medium: 5,
      high: 7,
      ultra: 9,
    };
    return octaves[tier];
  }

  private qualityTierToBlendSharpness(tier: QualityTier): number {
    const sharpness: Record<QualityTier, number> = {
      low: 0.5,
      medium: 1.0,
      high: 1.5,
      ultra: 2.0,
    };
    return sharpness[tier];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private dot(g: Vector2, x: number, y: number): number {
    return g.x * x + g.y * y;
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  setSeed(seed: number): void {
    this.config.seed = seed;
    this.initializeNoise(seed);
  }

  setQualityTier(tier: QualityTier): void {
    this.config.qualityTier = tier;
  }

  setMapSize(width: number, depth: number): void {
    this.config.mapSize = { width, depth };
  }
}

// ============================================================================
// Terrain Layer Presets
// ============================================================================

const DUNGEON_LAYERS: TerrainLayer[] = [
  {
    id: 'stone_floor',
    name: 'Stone Floor',
    albedo: 'res://textures/dungeon/stone_albedo.png',
    normal: 'res://textures/dungeon/stone_normal.png',
    minSlope: 0,
    maxSlope: 45,
    minHeight: 0,
    maxHeight: 1,
  },
  {
    id: 'stone_wall',
    name: 'Stone Wall',
    albedo: 'res://textures/dungeon/wall_albedo.png',
    normal: 'res://textures/dungeon/wall_normal.png',
    minSlope: 45,
    maxSlope: 90,
    minHeight: 0,
    maxHeight: 1,
  },
];

const WILDERNESS_LAYERS: TerrainLayer[] = [
  {
    id: 'dirt_path',
    name: 'Dirt Path',
    albedo: 'res://textures/nature/dirt_albedo.png',
    normal: 'res://textures/nature/dirt_normal.png',
    minSlope: 0,
    maxSlope: 10,
    minHeight: 0,
    maxHeight: 0.3,
  },
  {
    id: 'grass',
    name: 'Grass',
    albedo: 'res://textures/nature/grass_albedo.png',
    normal: 'res://textures/nature/grass_normal.png',
    minSlope: 0,
    maxSlope: 30,
    minHeight: 0.2,
    maxHeight: 0.6,
  },
  {
    id: 'forest_floor',
    name: 'Forest Floor',
    albedo: 'res://textures/nature/forest_albedo.png',
    normal: 'res://textures/nature/forest_normal.png',
    minSlope: 10,
    maxSlope: 45,
    minHeight: 0,
    maxHeight: 0.7,
  },
  {
    id: 'rock',
    name: 'Rock',
    albedo: 'res://textures/nature/rock_albedo.png',
    normal: 'res://textures/nature/rock_normal.png',
    minSlope: 30,
    maxSlope: 90,
    minHeight: 0.5,
    maxHeight: 1,
  },
];

const URBAN_LAYERS: TerrainLayer[] = [
  {
    id: 'cobblestone',
    name: 'Cobblestone',
    albedo: 'res://textures/urban/cobble_albedo.png',
    normal: 'res://textures/urban/cobble_normal.png',
    minSlope: 0,
    maxSlope: 15,
    minHeight: 0,
    maxHeight: 0.4,
  },
  {
    id: 'stone_paver',
    name: 'Stone Paver',
    albedo: 'res://textures/urban/paver_albedo.png',
    normal: 'res://textures/urban/paver_normal.png',
    minSlope: 0,
    maxSlope: 30,
    minHeight: 0,
    maxHeight: 0.6,
  },
  {
    id: 'rubble',
    name: 'Rubble',
    albedo: 'res://textures/urban/rubble_albedo.png',
    normal: 'res://textures/urban/rubble_normal.png',
    minSlope: 15,
    maxSlope: 90,
    minHeight: 0,
    maxHeight: 1,
  },
];

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a terrain generator with configuration
 */
export function createTerrainGenerator(
  config?: Partial<TerrainGeneratorConfig>
): TerrainGenerator {
  return new TerrainGenerator({
    ...DEFAULT_TERRAIN_CONFIG,
    ...config,
  });
}

/**
 * Generate a StudyLoG lab map
 */
export function generateLabMap(
  presetId?: string
): { terrain: TerrainData; preset: LabMapPreset } {
  const generator = new TerrainGenerator();
  return generator.generateLabMap(presetId || 'physics_lab');
}

/**
 * Generate a DMLoG battle map
 */
export function generateBattleMap(
  presetId?: string
): { terrain: TerrainData; preset: BattleMapPreset } {
  const generator = new TerrainGenerator();
  return generator.generateBattleMap(presetId || 'dungeon_chamber');
}

export default TerrainGenerator;
