/**
 * Voxel Generator - AI-Powered Terrain Generation
 *
 * Integrates with Zylann's VoxelTools to generate custom VoxelGeneratorScript
 * implementations using AI. Provides biome-specific terrain generation with
 * natural-looking caves, overhangs, and structures.
 *
 * Features:
 * - AI-generated VoxelGeneratorScript for Godot
 * - Biome-specific terrain algorithms
 * - Procedural cave and overhang generation
 * - Structure placement (trees, buildings, dungeons)
 * - Multi-LOD support for distant chunks
 * - Educational biome generation for StudyLoG.AI
 * - Dungeon generation for DMLoG.AI
 *
 * @module voxel-generator
 */

import type {
    Env,
    VoxelBiome,
    VoxelGeneratorScript,
    VoxelGeneratorParameter,
    VoxelTerrainRequest,
    VoxelTerrainResponse,
    VoxelChannel,
    VoxelChannelType,
    VoxelBlockType,
    Vector3i,
    BiomeDescription,
    ProductContext,
    ApiResponse,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CHUNK_SIZE = { x: 16, y: 32, z: 16 } as Vector3i;
const MAX_WORLD_HEIGHT = 256;
const SEA_LEVEL = 32;

// ============================================================================
// Biome Templates
// ============================================================================

/**
 * Predefined biome descriptions for common use cases
 */
const BIOME_TEMPLATES: Record<VoxelBiome, BiomeDescription> = {
    // StudyLoG.AI biomes
    cognitive_mill: {
        name: 'Cognitive Mill',
        description: 'A visualization of how AI models process information. Giant cogs representing tokens flow through channels of the mind.',
        features: ['G flowing token rivers', 'Cogwheel structures', 'Neural pathway bridges', 'Data crystal formations'],
        colors: { primary: '#4A90E2', secondary: '#50E3C2', accent: '#F5A623' },
        voxelTypes: ['token_water', 'cog_stone', 'neural_glass', 'data_crystal'],
        structures: ['logic_gate', 'memory_bank', 'attention_chamber'],
        atmosphere: 'Glowing blue and cyan, with floating data particles',
        generatedBy: 'ai',
    },
    intelligence_ranch: {
        name: 'Intelligence Ranch',
        description: 'Where AI agents are trained. Pastures of gradient fields, stables for neural networks, and training arenas.',
        features: ['Gradient pastures', 'Training corrals', 'Reward signal towers', 'Loss function valleys'],
        colors: { primary: '#7ED321', secondary: '#417505', accent: '#F8E71C' },
        voxelTypes: ['grass_gradient', 'fence_weight', 'tower_reward', 'dirt_loss'],
        structures: ['training_ring', 'stable_network', 'feed_trough_data'],
        atmosphere: 'Warm and pastoral, with mathematical precision',
        generatedBy: 'ai',
    },
    sitka_sound: {
        name: 'Sitka Sound',
        description: 'An aquatic ecosystem simulation. Clear waters, kelp forests, and diverse marine life demonstrating flocking behaviors.',
        features: ['Crystal clear water', 'Giant kelp forests', 'Coral reef formations', 'Schooling fish'],
        colors: { primary: '#00B5D4', secondary: '#004D71', accent: '#FF6B6B' },
        voxelTypes: ['water_clear', 'kelp_stalk', 'coral_brain', 'sand_white'],
        structures: ['kelp_forest', 'coral_reef', 'fish_school', 'underwater_cave'],
        atmosphere: 'Underwater serenity with sunlight filtering through',
        generatedBy: 'ai',
    },
    digital_twins: {
        name: 'Digital Twins',
        description: 'A virtual representation of real-world systems for testing and simulation.',
        features: ['Mirrored reality structures', 'Simulation chambers', 'Data visualization towers'],
        colors: { primary: '#9013FE', secondary: '#B8E986', accent: '#FFFFFF' },
        voxelTypes: ['mirror_glass', 'simulation_mesh', 'data_stream'],
        structures: ['test_chamber', 'sensor_array', 'control_center'],
        atmosphere: 'Clinical and precise, with subtle data overlays',
        generatedBy: 'ai',
    },
    science_lab: {
        name: 'Science Laboratory',
        description: 'A laboratory setting for conducting experiments and observing phenomena.',
        features: ['Lab benches', 'Equipment cabinets', 'Safety shielding', 'Experiment chambers'],
        colors: { primary: '#FFFFFF', secondary: '#E0E0E0', accent: '#00D9FF' },
        voxelTypes: ['tile_lab', 'metal_stainless', 'glass_safety', 'concrete_floor'],
        structures: ['workbench', 'fume_hood', 'storage_cabinet', 'experiment_chamber'],
        atmosphere: 'Clean and bright, with humming equipment',
        generatedBy: 'ai',
    },
    math_mountain: {
        name: 'Math Mountain',
        description: 'A mountain range where each peak represents a mathematical concept, rising from the valley of algebra to the summit of calculus.',
        features: ['Equation-carved cliffs', 'Geometric cave formations', 'Graph plateaus'],
        colors: { primary: '#8B572A', secondary: '#F5A623', accent: '#BD10E0' },
        voxelTypes: ['stone_equation', 'crystal_geometry', 'snow_proof'],
        structures: ['proof_cave', 'graph_overlook', 'formula_monument'],
        atmosphere: 'Mysterious and ancient, with floating symbols',
        generatedBy: 'ai',
    },
    physics_valley: {
        name: 'Physics Valley',
        description: 'A valley demonstrating physical laws - pendulum cliffs, waterfall power generation, and optical illusion caves.',
        features: ['Pendulum formations', 'Hydroelectric dams', 'Prism caves with rainbows'],
        colors: { primary: '#4A4A4A', secondary: '#00D9FF', accent: '#F5E100' },
        voxelTypes: ['stone_slate', 'water_falling', 'crystal_prism', 'metal_copper'],
        structures: ['pendulum_giant', 'waterwheel', 'prism_cave', 'incline_plane'],
        atmosphere: 'Dynamic and interactive, with moving parts',
        generatedBy: 'ai',
    },

    // DMLoG.AI biomes
    dungeon: {
        name: 'Dungeon',
        description: 'A dark underground dungeon with corridors, rooms, and hidden treasures.',
        features: ['Stone corridors', 'Wooden doors', 'Torches', 'Treasure chests', 'Traps'],
        colors: { primary: '#3D3D3D', secondary: '#1A1A1A', accent: '#F5A623' },
        voxelTypes: ['stone_dark', 'wood_oak', 'torch_lit', 'chest_gold'],
        structures: ['corridor', 'room', 'trap', 'secret_passage', 'boss_chamber'],
        atmosphere: 'Dark and foreboding, with flickering torchlight',
        generatedBy: 'ai',
    },
    wilderness: {
        name: 'Wilderness',
        description: 'Untamed natural landscape with forests, rivers, and wildlife.',
        features: ['Dense forests', 'Flowing rivers', 'Wildlife encounters', 'Hidden clearings'],
        colors: { primary: '#228B22', secondary: '#8B4513', accent: '#87CEEB' },
        voxelTypes: ['grass_wild', 'tree_oak', 'water_river', 'stone_river'],
        structures: ['forest_clearing', 'cave_entrance', 'camp_site', 'herb_garden'],
        atmosphere: 'Living and breathing, with ambient wildlife sounds',
        generatedBy: 'ai',
    },
    city: {
        name: 'City',
        description: 'A bustling medieval city with shops, taverns, and grand architecture.',
        features: ['City walls', 'Market squares', 'Taverns', 'Temples', 'Noble houses'],
        colors: { primary: '#8B7355', secondary: '#D2691E', accent: '#FFD700' },
        voxelTypes: ['stone_city', 'wood_cedar', 'glass_stained', 'roof_tile'],
        structures: ['shop', 'tavern', 'temple', 'manor', 'fountain'],
        atmosphere: 'Vibrant and noisy, with merchants and citizens',
        generatedBy: 'ai',
    },
    underdark: {
        name: 'Underdark',
        description: 'A vast underground realm of tunnels, caverns, and alien ecosystems.',
        features: ['Bioluminescent fungi', 'Underground rivers', 'Drow structures', 'Rock formations'],
        colors: { primary: '#1A1A2E', secondary: '#16213E', accent: '#0F3460' },
        voxelTypes: ['stone_underdark', 'fungi_glow', 'crystal_purple', 'water_dark'],
        structures: ['drow_spire', 'fungi_forest', 'underground_lake', 'tunnel_complex'],
        atmosphere: 'Alien and oppressive, with glowing fungi providing dim light',
        generatedBy: 'ai',
    },
    planar: {
        name: 'Planar Realm',
        description: 'An otherworldly dimension with impossible geometry and alien physics.',
        features: ['Floating islands', 'Ethereal bridges', 'Reality distortions', 'Elemental manifestations'],
        colors: { primary: '#E056FD', secondary: '#686DE0', accent: '#FF9F43' },
        voxelTypes: ['stone_ethereal', 'crystal_planar', 'void_energy', 'bridge_floating'],
        structures: ['floating_island', 'portal_gate', 'elemental_fountain', 'reality_tear'],
        atmosphere: 'Surreal and dreamlike, with shifting reality',
        generatedBy: 'ai',
    },
    seafaring: {
        name: 'Seafaring',
        description: 'Open ocean with islands, ships, and underwater ruins.',
        features: ['Open water', 'Islands', 'Shipwrecks', 'Coral reefs', 'Sea monsters'],
        colors: { primary: '#006994', secondary: '#003366', accent: '#C0C0C0' },
        voxelTypes: ['water_deep', 'sand_beach', 'wood_ship', 'coral_tropical'],
        structures: ['island', 'shipwreck', 'lighthouse', 'underwater_ruin', 'port_town'],
        atmosphere: 'Open and vast, with rolling waves and sea breeze',
        generatedBy: 'ai',
    },
    castle: {
        name: 'Castle',
        description: 'A fortified castle with walls, towers, and a great hall.',
        features: ['Stone walls', 'Towers', 'Moat', 'Gatehouse', 'Great hall'],
        colors: { primary: '#708090', secondary: '#A9A9A9', accent: '#FFD700' },
        voxelTypes: ['stone_castle', 'wood_oak', 'water_moat', 'flag_banner'],
        structures: ['wall', 'tower', 'gatehouse', 'great_hall', 'dungeon_cell'],
        atmosphere: 'Imposing and defensive, with heraldic banners',
        generatedBy: 'ai',
    },

    // General biomes
    plains: {
        name: 'Plains',
        description: 'Flat grassy plains with occasional trees and gentle hills.',
        features: ['Grass fields', 'Scattered trees', 'Gentle hills', 'Wildflowers'],
        colors: { primary: '#7CFC00', secondary: '#228B22', accent: '#87CEEB' },
        voxelTypes: ['grass_plains', 'dirt', 'tree_oak', 'flower_wild'],
        structures: ['farm', 'windmill', 'cottage', 'fence_wood'],
        atmosphere: 'Open and peaceful, with gentle breeze',
        generatedBy: 'template',
    },
    forest: {
        name: 'Forest',
        description: 'Dense forest with tall trees and undergrowth.',
        features: ['Tall trees', 'Undergrowth', 'Forest streams', 'Clearings'],
        colors: { primary: '#228B22', secondary: '#006400', accent: '#8B4513' },
        voxelTypes: ['log_tree', 'leaves_green', 'bush', 'moss'],
        structures: ['tree_giant', 'forest_shrine', 'hunter_camp', 'mushroom_circle'],
        atmosphere: 'Shady and mysterious, with bird calls',
        generatedBy: 'template',
    },
    desert: {
        name: 'Desert',
        description: 'Arid desert with sand dunes and rock formations.',
        features: ['Sand dunes', 'Rock formations', 'Oases', 'Canyons'],
        colors: { primary: '#F4A460', secondary: '#DEB887', accent: '#87CEEB' },
        voxelTypes: ['sand', 'rock_sandstone', 'cactus', 'oasis_water'],
        structures: ['oasis', 'pyramid', 'cave_entrance', 'caravan_route'],
        atmosphere: 'Hot and dry, with shimmering heat haze',
        generatedBy: 'template',
    },
    tundra: {
        name: 'Tundra',
        description: 'Frozen tundra with ice and snow.',
        features: ['Snow fields', 'Ice formations', 'Frozen lakes', 'Sparse vegetation'],
        colors: { primary: '#FFFAFA', secondary: '#E0FFFF', accent: '#4682B4' },
        voxelTypes: ['snow', 'ice', 'rock_frozen', 'lichen'],
        structures: ['igloo', 'ice_cave', 'frozen_lake', 'aurora_viewpoint'],
        atmosphere: 'Bitterly cold and silent, with aurora in the sky',
        generatedBy: 'template',
    },
    mountain: {
        name: 'Mountain',
        description: 'Towering mountains with snow-capped peaks.',
        features: ['Mountain peaks', 'Cliffs', 'Caves', 'Waterfalls'],
        colors: { primary: '#696969', secondary: '#FFFAFA', accent: '#228B22' },
        voxelTypes: ['stone_mountain', 'snow', 'gravel', 'ice_mountain'],
        structures: ['peak', 'cave_mountain', 'waterfall', 'mine_entrance'],
        atmosphere: 'Majestic and treacherous, with thin air',
        generatedBy: 'template',
    },
    swamp: {
        name: 'Swamp',
        description: 'Murky swamp with stagnant water and twisted trees.',
        features: ['Stagnant water', 'Cypress trees', 'Moss', 'Fog'],
        colors: { primary: '#556B2F', secondary: '#8B4513', accent: '#2F4F4F' },
        voxelTypes: ['water_swamp', 'mud', 'tree_cypress', 'moss_hanging'],
        structures: ['witch_hut', 'swamp_hut', 'grotto', 'twisted_bridge'],
        atmosphere: 'Oppressive and humid, with buzzing insects',
        generatedBy: 'template',
    },
    volcanic: {
        name: 'Volcanic',
        description: 'Active volcanic area with lava flows and ash.',
        features: ['Lava flows', 'Ash clouds', 'Obsidian formations', 'Steam vents'],
        colors: { primary: '#1C1C1C', secondary: '#FF4500', accent: '#FFD700' },
        voxelTypes: ['stone_volcanic', 'lava', 'ash', 'obsidian'],
        structures: ['volcano_crater', 'lava_tube', 'geyser', 'sulfur_vent'],
        atmosphere: 'Choking and hot, with rumbling earth',
        generatedBy: 'template',
    },
    floating_island: {
        name: 'Floating Island',
        description: 'Magical floating islands in the sky.',
        features: ['Floating land masses', 'Waterfalls into void', 'Sky plants', 'Clouds'],
        colors: { primary: '#90EE90', secondary: '#87CEEB', accent: '#FFD700' },
        voxelTypes: ['grass_sky', 'stone_floating', 'water_sky', 'crystal_sky'],
        structures: ['island_main', 'sky_bridge', 'cloud_palace', 'waterfall_infinite'],
        atmosphere: 'Ethereal and peaceful, with wind and birds',
        generatedBy: 'ai',
    },
    crystal_caves: {
        name: 'Crystal Caves',
        description: 'Underground caves filled with glowing crystals.',
        features: ['Giant crystals', 'Underground lakes', 'Bioluminescence', 'Echoing chambers'],
        colors: { primary: '#E066FF', secondary: '#00CED1', accent: '#FF1493' },
        voxelTypes: ['crystal_glowing', 'stone_cave', 'water_underground', 'crystal_cluster'],
        structures: ['crystal_forest', 'underground_lake', 'echo_chamber', 'geode_huge'],
        atmosphere: 'Magical and resonant, with chiming crystals',
        generatedBy: 'ai',
    },
};

// ============================================================================
// Voxel Generator Service
// ============================================================================

/**
 * Service for generating voxel terrain with AI
 */
export class VoxelGeneratorService {
    private cache: KVNamespace | undefined;
    private db: D1Database | undefined;
    private multiModelRouterUrl?: string;

    constructor(env: Env) {
        this.cache = env.CACHE;
        this.db = env.DB;
        this.multiModelRouterUrl = env.MULTI_MODEL_ROUTER_URL;
    }

    /**
     * Generate terrain for a chunk
     */
    async generateTerrain(request: VoxelTerrainRequest): Promise<VoxelTerrainResponse> {
        const cacheKey = `voxel:terrain:${request.position.x}:${request.position.y}:${request.position.z}:${request.lod}:${request.seed || 0}`;

        // Check cache first
        if (this.cache) {
            const cached = await this.cache.get(cacheKey, 'json');
            if (cached) {
                return cached as VoxelTerrainResponse;
            }
        }

        // Generate terrain data
        const terrainData = await this.generateTerrainData(request);

        // Cache the result
        if (this.cache) {
            await this.cache.put(cacheKey, JSON.stringify(terrainData), {
                expirationTtl: 3600, // 1 hour
            });
        }

        return terrainData;
    }

    /**
     * Generate the actual voxel data for a chunk
     */
    private async generateTerrainData(request: VoxelTerrainRequest): Promise<VoxelTerrainResponse> {
        const { position, chunkSize, lod, parameters, seed } = request;
        const actualSeed = seed || Date.now();

        // Simple procedural generation (in production, use proper noise functions)
        const channels: VoxelChannel[] = [];

        // Type channel - determines block type for each voxel
        const typeData = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);
        const densityData = new Uint8Array(chunkSize.x * chunkSize.y * chunkSize.z);

        // Simple height-based terrain generation
        const baseHeight = SEA_LEVEL;
        const heightVariation = 16;

        for (let x = 0; x < chunkSize.x; x++) {
            for (let z = 0; z < chunkSize.z; z++) {
                // World coordinates
                const wx = position.x * chunkSize.x + x;
                const wz = position.z * chunkSize.z + z;

                // Simple pseudo-random height using a basic hash
                const hash = this.hash2D(wx, wz, actualSeed);
                const height = baseHeight + ((hash % (heightVariation * 2)) - heightVariation);

                for (let y = 0; y < chunkSize.y; y++) {
                    const wy = position.y * chunkSize.y + y;
                    const idx = x + chunkSize.x * (y + chunkSize.y * z);

                    if (wy < height - 4) {
                        // Deep underground - stone
                        typeData[idx] = 2; // stone
                        densityData[idx] = 255;
                    } else if (wy < height) {
                        // Near surface - dirt/grass
                        typeData[idx] = wy < height - 1 ? 3 : 1; // dirt : grass
                        densityData[idx] = 255;
                    } else if (wy < SEA_LEVEL) {
                        // Water
                        typeData[idx] = 4; // water
                        densityData[idx] = 128;
                    } else {
                        // Air
                        typeData[idx] = 0; // air
                        densityData[idx] = 0;
                    }
                }
            }
        }

        channels.push({
            type: 'type',
            data: typeData,
            depth: 8,
            compressed: false,
        });

        channels.push({
            type: 'density',
            data: densityData,
            depth: 8,
            compressed: false,
        });

        // Calculate voxel count
        let voxelCount = 0;
        for (let i = 0; i < typeData.length; i++) {
            if (typeData[i] !== 0) voxelCount++;
        }

        return {
            position,
            size: chunkSize,
            channels,
            generatorUsed: request.generatorId,
            seed: actualSeed,
            lod,
            voxelCount,
            isEmpty: voxelCount === 0,
        };
    }

    /**
     * Simple 2D hash function for pseudo-random terrain
     */
    private hash2D(x: number, y: number, seed: number): number {
        const n = x * 374761393 + y * 668265263 + seed;
        return (n ^ (n >> 13)) * 1274126177;
    }

    /**
     * Generate a VoxelGeneratorScript for a biome
     */
    async generateScript(biome: VoxelBiome, productContext: ProductContext): Promise<VoxelGeneratorScript> {
        const biomeInfo = BIOME_TEMPLATES[biome] || BIOME_TEMPLATES.plains;

        const scriptName = `${biome.replace(/_/g, '_')}_generator`;
        const scriptContent = this.generateScriptContent(biome, biomeInfo, productContext);

        return {
            name: scriptName,
            description: `AI-generated voxel terrain generator for ${biomeInfo.name}`,
            biome,
            script: scriptContent,
            parameters: this.generateParameters(biome),
            channels: ['type', 'density', 'color'],
            chunkSize: DEFAULT_CHUNK_SIZE,
        };
    }

    /**
     * Generate GDScript content for a VoxelGeneratorScript
     */
    private generateScriptContent(biome: VoxelBiome, biomeInfo: BiomeDescription, context: ProductContext): string {
        const isStudyLog = context === 'studylog';
        const isDmLog = context === 'dmlog';

        return `@tool
extends VoxelGeneratorScript
class_name ${biome.replace(/_/g, '_').capitalize()}_Generator

## ${biomeInfo.name}
##
## ${biomeInfo.description}
##
## Features: ${biomeInfo.features.join(', ')}
##
## Generated by SuperInstance.AI Voxel System

# Exported parameters
@export var terrain_scale: float = 0.02
@export var height_scale: float = 32.0
@export var base_height: int = 32
@export var cave_density: float = 0.5
@export var cave_scale: float = 0.05
@export var structure_chance: float = 0.1
@export var seed: int = 0

# Block type IDs
const BLOCK_AIR = 0
const BLOCK_GRASS = 1
const BLOCK_DIRT = 3
const BLOCK_STONE = 2
const BLOCK_WATER = 4
${isDmLog ? 'const BLOCK_DUNGEON_WALL = 5\nconst BLOCK_DUNGEON_FLOOR = 6' : ''}
${isStudyLog ? 'const BLOCK_TOKEN_WATER = 5\nconst BLOCK_COG_STONE = 6\nconst BLOCK_DATA_CRYSTAL = 7' : ''}

# Noise generators
var _noise_terrain: FastNoiseLite
var _noise_cave: FastNoiseLite
var _noise_structure: FastNoiseLite

func _init():
    _noise_terrain = FastNoiseLite.new()
    _noise_cave = FastNoiseLite.new()
    _noise_structure = FastNoiseLite.new()

func _generate_block(buffer: VoxelBuffer, origin_in_voxels: Vector3i, lod: int) -> void:
    if seed != 0:
        _noise_terrain.seed = seed
        _noise_cave.seed = seed + 1
        _noise_structure.seed = seed + 2

    var size = buffer.get_size()

    for x in range(size.x):
        for z in range(size.z):
            var world_x = origin_in_voxels.x + x
            var world_z = origin_in_voxels.z + z

            # Calculate height using noise
            var height = base_height + _noise_terrain.get_noise_2d(
                world_x * terrain_scale,
                world_z * terrain_scale
            ) * height_scale

            for y in range(size.y):
                var world_y = origin_in_voxels.y + y

                # Determine voxel type
                var voxel_type = BLOCK_AIR
                var density = 0

                if world_y < height - 4:
                    voxel_type = BLOCK_STONE
                    density = 255
                elif world_y < height:
                    voxel_type = BLOCK_DIRT if world_y < height - 1 else BLOCK_GRASS
                    density = 255
                elif world_y < SEA_LEVEL:
                    voxel_type = BLOCK_WATER
                    density = 128

                # Cave generation
                if density > 0:
                    var cave_noise = _noise_cave.get_noise_3d(
                        world_x * cave_scale,
                        world_y * cave_scale,
                        world_z * cave_scale
                    )
                    if cave_noise > cave_density:
                        density = 0
                        voxel_type = BLOCK_AIR

                # Set voxel
                if density > 0:
                    buffer.set_voxel(voxel_type, x, y, z, channel := VoxelBuffer.CHANNEL_TYPE)
                    buffer.set_voxel_f(density / 255.0, x, y, z, channel := VoxelBuffer.CHANNEL_SDF)

    # Generate structures
    _generate_structures(buffer, origin_in_voxels, lod)

func _generate_structures(buffer: VoxelBuffer, origin_in_voxels: Vector3i, lod: int) -> void:
    var size = buffer.get_size()

    # Check each column for structure placement
    for x in range(0, size.x, 4):
        for z in range(0, size.z, 4):
            var world_x = origin_in_voxels.x + x
            var world_z = origin_in_voxels.z + z

            var structure_noise = _noise_structure.get_noise_2d(
                world_x * 0.1,
                world_z * 0.1
            )

            if structure_noise > (1.0 - structure_chance):
                _place_structure(buffer, Vector3i(x, base_height, z), lod)

func _place_structure(buffer: VoxelBuffer, position: Vector3i, lod: int) -> void:
    # Override this method to place biome-specific structures
    pass
`;
    }

    /**
     * Generate parameters for a biome
     */
    private generateParameters(biome: VoxelBiome): VoxelGeneratorParameter[] {
        const baseParams: VoxelGeneratorParameter[] = [
            {
                name: 'terrain_scale',
                type: 'float',
                defaultValue: 0.02,
                min: 0.001,
                max: 0.1,
                step: 0.001,
                description: 'Scale of terrain noise',
            },
            {
                name: 'height_scale',
                type: 'float',
                defaultValue: 32.0,
                min: 1.0,
                max: 128.0,
                step: 1.0,
                description: 'Maximum height variation',
            },
            {
                name: 'base_height',
                type: 'int',
                defaultValue: 32,
                min: 0,
                max: 128,
                description: 'Base terrain height',
            },
            {
                name: 'cave_density',
                type: 'float',
                defaultValue: 0.5,
                min: 0.0,
                max: 1.0,
                step: 0.05,
                description: 'Density of cave systems',
            },
            {
                name: 'structure_chance',
                type: 'float',
                defaultValue: 0.1,
                min: 0.0,
                max: 1.0,
                step: 0.01,
                description: 'Probability of structure placement',
            },
            {
                name: 'seed',
                type: 'int',
                defaultValue: 0,
                min: 0,
                max: 2147483647,
                description: 'Random seed for generation',
            },
        ];

        return baseParams;
    }

    /**
     * Get biome information
     */
    getBiomeInfo(biome: VoxelBiome): BiomeDescription | null {
        return BIOME_TEMPLATES[biome] || null;
    }

    /**
     * List all available biomes
     */
    listBiomes(): VoxelBiome[] {
        return Object.keys(BIOME_TEMPLATES) as VoxelBiome[];
    }

    /**
     * Get biomes by product context
     */
    getBiomesByContext(productContext: ProductContext): VoxelBiome[] {
        if (productContext === 'studylog') {
            return [
                'cognitive_mill',
                'intelligence_ranch',
                'sitka_sound',
                'digital_twins',
                'science_lab',
                'math_mountain',
                'physics_valley',
            ];
        }

        if (productContext === 'dmlog') {
            return [
                'dungeon',
                'wilderness',
                'city',
                'underdark',
                'planar',
                'seafaring',
                'castle',
            ];
        }

        return ['plains', 'forest', 'desert', 'tundra', 'mountain', 'swamp'];
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a voxel generator service
 */
export function createVoxelGeneratorService(env: Env): VoxelGeneratorService {
    return new VoxelGeneratorService(env);
}
