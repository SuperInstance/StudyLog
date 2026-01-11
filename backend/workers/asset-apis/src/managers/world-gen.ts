/**
 * World Generator - HY-World Environment Generation
 * Specialized manager for generating large 3D environments using Hunyuan HY-World
 */

import {
    GenerateEnvironmentRequest,
    GenerationResponse,
    Model3DAsset,
    EnvironmentMetadata,
    AssetProvider,
    ProductContext,
    ModelFormat
} from '../types.js';

import { Hunyuan3DProvider } from '../providers/hunyuan.js';

// ============================================================================
// World Generator Configuration
// ============================================================================

export interface WorldGeneratorConfig {
    apiKey: string;
    endpoint?: string;
    defaultAreaSize?: [number, number, number];
    defaultObjectCount?: number;
    includeNavmesh?: boolean;
    includeCollision?: boolean;
    bakeLighting?: boolean;
}

// ============================================================================
// Environment Generation Parameters
// ============================================================================

export interface EnvironmentGenerationParams extends GenerateEnvironmentRequest {
    biome?: 'grassland' | 'forest' | 'desert' | 'snow' | 'swamp' | 'mountain' | 'volcanic' | 'underwater' | 'urban';
    timeOfDay?: 'dawn' | 'day' | 'dusk' | 'night';
    weather?: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'storm';
    season?: 'spring' | 'summer' | 'autumn' | 'winter';
    complexity?: 'simple' | 'medium' | 'complex';
    roadNetwork?: boolean;
    waterFeatures?: boolean;
    vegetationDensity?: 0 | 0.25 | 0.5 | 0.75 | 1;
}

// ============================================================================
// World Generator Class
// ============================================================================

export class WorldGenerator {
    private hunyuan: Hunyuan3DProvider;
    private config: WorldGeneratorConfig;

    constructor(config: WorldGeneratorConfig) {
        this.config = config;
        this.hunyuan = new Hunyuan3DProvider({
            apiKey: config.apiKey,
            endpoint: config.endpoint,
            model: 'hy-world-1.5'
        });
    }

    // ========================================================================
    // Environment Generation
    // ========================================================================

    /**
     * Generate a complete 3D environment
     */
    async generateEnvironment(
        params: EnvironmentGenerationParams
    ): Promise<GenerationResponse & { taskId?: string }> {
        // Build the prompt from parameters
        const prompt = this.buildEnvironmentPrompt(params);

        const request: GenerateEnvironmentRequest = {
            prompt,
            sceneType: params.sceneType,
            areaSize: params.areaSize || this.config.defaultAreaSize || [100, 20, 100],
            objectCount: params.objectCount || this.config.defaultObjectCount || 100,
            includeNavmesh: params.includeNavmesh ?? this.config.includeNavmesh ?? false,
            includeCollision: params.includeCollision ?? this.config.includeCollision ?? true,
            bakeLighting: params.bakeLighting ?? this.config.bakeLighting ?? false,
            style: params.style,
            productContext: params.productContext
        };

        const result = await this.hunyuan.generateEnvironment(request);

        return {
            ...result,
            taskId: result.assetId
        };
    }

    /**
     * Generate a terrain environment
     */
    async generateTerrain(params: TerrainGenerationParams): Promise<GenerationResponse> {
        const prompt = this.buildTerrainPrompt(params);

        return this.generateEnvironment({
            prompt,
            sceneType: 'terrain',
            areaSize: params.areaSize || [200, 50, 200],
            objectCount: params.objectCount || 50,
            includeNavmesh: params.includeNavmesh || false,
            includeCollision: true,
            productContext: params.productContext
        });
    }

    /**
     * Generate a building/structure
     */
    async generateBuilding(params: BuildingGenerationParams): Promise<GenerationResponse> {
        const prompt = this.buildBuildingPrompt(params);

        return this.generateEnvironment({
            prompt,
            sceneType: 'building',
            areaSize: params.areaSize || [50, 30, 50],
            objectCount: params.objectCount || 20,
            includeNavmesh: false,
            includeCollision: true,
            productContext: params.productContext
        });
    }

    /**
     * Generate a city scene
     */
    async generateCity(params: CityGenerationParams): Promise<GenerationResponse> {
        const prompt = this.buildCityPrompt(params);

        return this.generateEnvironment({
            prompt,
            sceneType: 'city',
            areaSize: params.areaSize || [500, 100, 500],
            objectCount: params.objectCount || 500,
            includeNavmesh: params.includeNavmesh || true,
            includeCollision: true,
            productContext: params.productContext
        });
    }

    /**
     * Generate a dungeon
     */
    async generateDungeon(params: DungeonGenerationParams): Promise<GenerationResponse> {
        const prompt = this.buildDungeonPrompt(params);

        return this.generateEnvironment({
            prompt,
            sceneType: 'dungeon',
            areaSize: params.areaSize || [100, 20, 100],
            objectCount: params.objectCount || 100,
            includeNavmesh: params.includeNavmesh || true,
            includeCollision: true,
            productContext: params.productContext
        });
    }

    /**
     * Generate an interior scene
     */
    async generateInterior(params: InteriorGenerationParams): Promise<GenerationResponse> {
        const prompt = this.buildInteriorPrompt(params);

        return this.generateEnvironment({
            prompt,
            sceneType: 'interior',
            areaSize: params.areaSize || [20, 5, 20],
            objectCount: params.objectCount || 30,
            includeNavmesh: false,
            includeCollision: true,
            productContext: params.productContext
        });
    }

    // ========================================================================
    // Prompt Building
    // ========================================================================

    private buildEnvironmentPrompt(params: EnvironmentGenerationParams): string {
        const parts: string[] = [];

        // Scene type
        parts.push(params.sceneType || 'environment');

        // Biome
        if (params.biome) {
            parts.push(params.biome);
        }

        // Time of day
        if (params.timeOfDay) {
            parts.push(`${params.timeOfDay}time`);
        }

        // Weather
        if (params.weather) {
            parts.push(params.weather);
        }

        // Season
        if (params.season) {
            parts.push(params.season);
        }

        // Complexity
        if (params.complexity) {
            parts.push(`${params.complexity} detail`);
        }

        // Features
        if (params.roadNetwork) {
            parts.push('with roads');
        }

        if (params.waterFeatures) {
            parts.push('with water features');
        }

        if (params.vegetationDensity !== undefined) {
            if (params.vegetationDensity === 0) {
                parts.push('barren');
            } else if (params.vegetationDensity < 0.5) {
                parts.push('sparse vegetation');
            } else if (params.vegetationDensity < 1) {
                parts.push('dense vegetation');
            } else {
                parts.push('overgrown');
            }
        }

        // User prompt
        if (params.prompt) {
            parts.push(params.prompt);
        }

        return parts.join(', ');
    }

    private buildTerrainPrompt(params: TerrainGenerationParams): string {
        const parts: string[] = ['terrain'];

        if (params.terrainType) {
            parts.push(params.terrainType);
        }

        if (params.heightVariation) {
            parts.push(`${params.heightVariation} elevation variation`);
        }

        if (params.includeWater) {
            parts.push('with water bodies');
        }

        if (params.includeCliffs) {
            parts.push('with cliffs and rock formations');
        }

        if (params.prompt) {
            parts.push(params.prompt);
        }

        return parts.join(', ');
    }

    private buildBuildingPrompt(params: BuildingGenerationParams): string {
        const parts: string[] = [params.buildingType || 'building'];

        if (params.architecturalStyle) {
            parts.push(params.architecturalStyle);
        }

        if (params.material) {
            parts.push(`${params.material} construction`);
        }

        if (params.condition) {
            parts.push(params.condition);
        }

        if (params.floors) {
            parts.push(`${params.floors} floors`);
        }

        if (params.prompt) {
            parts.push(params.prompt);
        }

        return parts.join(', ');
    }

    private buildCityPrompt(params: CityGenerationParams): string {
        const parts: string[] = ['city'];

        if (params.cityType) {
            parts.push(params.cityType);
        }

        if (params.era) {
            parts.push(params.era);
        }

        if (params.density) {
            parts.push(`${params.density} density`);
        }

        if (params.includeStreets) {
            parts.push('with street network');
        }

        if (params.includeVehicles) {
            parts.push('with vehicles');
        }

        if (params.includePeople) {
            parts.push('populated');
        }

        if (params.prompt) {
            parts.push(params.prompt);
        }

        return parts.join(', ');
    }

    private buildDungeonPrompt(params: DungeonGenerationParams): string {
        const parts: string[] = ['dungeon'];

        if (params.dungeonType) {
            parts.push(params.dungeonType);
        }

        if (params.theme) {
            parts.push(params.theme);
        }

        if (params.lighting) {
            parts.push(`${params.lighting} lighting`);
        }

        if (params.includeTraps) {
            parts.push('with traps');
        }

        if (params.includeTreasure) {
            parts.push('with treasure chests');
        }

        if (params.includeEnemies) {
            parts.push('with enemy spawn points');
        }

        if (params.prompt) {
            parts.push(params.prompt);
        }

        return parts.join(', ');
    }

    private buildInteriorPrompt(params: InteriorGenerationParams): string {
        const parts: string[] = [params.roomType || 'room'];

        if (params.style) {
            parts.push(params.style);
        }

        if (params.furnished) {
            parts.push('fully furnished');
        } else {
            parts.push('empty');
        }

        if (params.lighting) {
            parts.push(params.lighting);
        }

        if (params.decorations) {
            parts.push(params.decorations);
        }

        if (params.prompt) {
            parts.push(params.prompt);
        }

        return parts.join(', ');
    }

    // ========================================================================
    // Status and Download
    // ========================================================================

    /**
     * Check generation status
     */
    async getStatus(taskId: string): Promise<{ status: string; modelUrl?: string; thumbnailUrl?: string }> {
        try {
            const result = await this.hunyuan.getTaskStatus(taskId);
            return {
                status: result.data.status,
                modelUrl: result.data.modelUrl,
                thumbnailUrl: result.data.thumbnailUrl
            };
        } catch {
            return { status: 'failed' };
        }
    }

    /**
     * Wait for environment generation to complete
     */
    async waitForCompletion(
        taskId: string,
        timeoutMs: number = 600000 // 10 minutes for large environments
    ): Promise<Model3DAsset | null> {
        try {
            const result = await this.hunyuan.waitForTask(taskId, timeoutMs);
            const metadata = await this.hunyuan.extractMetadata(taskId);

            return {
                id: taskId,
                type: 'environment',
                provider: 'hunyuan',
                productContext: 'general',
                originalPrompt: '',
                status: 'completed',
                createdAt: new Date(),
                updatedAt: new Date(),
                costCents: 0,
                metadata: {
                    ...metadata,
                    sceneType: 'terrain',
                    areaSquareUnits: 10000,
                    objectCount: 100,
                    navmeshGenerated: false,
                    collisionBaked: true,
                    lightingBaked: false,
                    occlusionCulling: false
                },
                storage: {
                    storageType: 'external_url',
                    filePath: result.data.modelUrl || '',
                    directDownloadUrl: result.data.modelUrl || '',
                    uploadedAt: new Date()
                }
            };
        } catch {
            return null;
        }
    }

    /**
     * Download the generated environment
     */
    async downloadEnvironment(taskId: string): Promise<Blob> {
        return this.hunyuan.downloadModel(taskId);
    }

    // ========================================================================
    // Godot Integration
    // ========================================================================

    /**
     * Generate Godot scene file for the environment
     */
    async generateGodotScene(
        taskId: string,
        sceneName: string = 'generated_world'
    ): Promise<string> {
        const status = await this.getStatus(taskId);

        if (status.status !== 'completed' || !status.modelUrl) {
            throw new Error('Environment not ready for export');
        }

        // Generate a .tscn file with appropriate settings for a large environment
        const sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://${crypto.randomUUID()}"]

[ext_resource type="PackedScene" uid="uid://${crypto.randomUUID()}" path="${status.modelUrl}" id="world_${crypto.randomUUID().slice(0, 8)}"]

[node name="${sceneName}" type="Node3D]

[node name="World" parent="." instance=ExtResource("world_${crypto.randomUUID().slice(0, 8)}")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[node name="Environment" type="WorldEnvironment" parent="."]

[node name="Camera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.866025, 0.5, 0, -0.5, 0.866025, 0, 50, 100)
fov = 60.0

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.433013, 0.25, 0, 0.5, 0.866025, -0.5, -0.75, 0.433013, 0, 100, 0)
shadow_enabled = true
`;

        return sceneContent;
    }

    /**
     * Get environment metadata for Theia IDE
     */
    async getTheiaMetadata(taskId: string): Promise<Record<string, unknown>> {
        const status = await this.getStatus(taskId);

        return {
            importPath: `res://worlds/world_${taskId}.tscn`,
            resourceType: 'PackedScene',
            autoImport: true,
            customImportSettings: {
                generateCollision: true,
                generateNavmesh: true,
                bakeLighting: false,
                occlusionCulling: true
            },
            previewUrl: status.thumbnailUrl,
            downloadUrl: status.modelUrl
        };
    }

    // ========================================================================
    // Cost Estimation
    // ========================================================================

    /**
     * Estimate cost for environment generation
     */
    estimateCost(params: EnvironmentGenerationParams): number {
        // Hunyuan HY-World pricing estimate
        let baseCost = 1.0;

        // Area size multiplier
        const area = (params.areaSize?.[0] || 100) * (params.areaSize?.[2] || 100);
        const areaMultiplier = Math.max(1, area / 10000);
        baseCost *= areaMultiplier;

        // Object count multiplier
        const objectCount = params.objectCount || 100;
        const objectMultiplier = Math.max(1, objectCount / 100);
        baseCost *= objectMultiplier;

        // Lighting baking adds cost
        if (params.bakeLighting) {
            baseCost *= 2;
        }

        // Navmesh generation adds cost
        if (params.includeNavmesh) {
            baseCost *= 1.5;
        }

        return baseCost;
    }

    // ========================================================================
    // Presets
    // ========================================================================

    /**
     * Get preset configurations for common environment types
     */
    getPreset(type: 'fantasy_forest' | 'sci_fi_city' | 'dungeon' | 'desert' | 'underwater'): Partial<EnvironmentGenerationParams> {
        const presets: Record<string, Partial<EnvironmentGenerationParams>> = {
            fantasy_forest: {
                sceneType: 'nature',
                biome: 'forest',
                timeOfDay: 'day',
                weather: 'clear',
                style: 'fantasy',
                vegetationDensity: 1,
                complexity: 'complex',
                waterFeatures: true,
                prompt: 'lush fantasy forest with ancient trees, glowing mushrooms, magical creatures'
            },
            sci_fi_city: {
                sceneType: 'city',
                timeOfDay: 'night',
                weather: 'clear',
                style: 'sci-fi',
                complexity: 'complex',
                roadNetwork: true,
                prompt: 'futuristic cyberpunk city with neon lights, flying vehicles, towering skyscrapers'
            },
            dungeon: {
                sceneType: 'dungeon',
                timeOfDay: 'night',
                weather: 'clear',
                style: 'dark fantasy',
                complexity: 'medium',
                prompt: 'dark dungeon with stone corridors, torches, spider webs, ancient treasures'
            },
            desert: {
                sceneType: 'terrain',
                biome: 'desert',
                timeOfDay: 'day',
                weather: 'clear',
                style: 'realistic',
                vegetationDensity: 0,
                prompt: 'vast desert with sand dunes, occasional oasis, rocky outcrops'
            },
            underwater: {
                sceneType: 'nature',
                biome: 'underwater',
                timeOfDay: 'day',
                weather: 'clear',
                style: 'realistic',
                complexity: 'medium',
                vegetationDensity: 0.5,
                prompt: 'underwater coral reef with colorful fish, sea turtles, swaying kelp'
            }
        };

        return presets[type] || {};
    }

    /**
     * Generate using a preset
     */
    async generateFromPreset(
        preset: 'fantasy_forest' | 'sci_fi_city' | 'dungeon' | 'desert' | 'underwater',
        overrides?: Partial<EnvironmentGenerationParams>
    ): Promise<GenerationResponse> {
        const presetConfig = this.getPreset(preset);
        const params = { ...presetConfig, ...overrides } as EnvironmentGenerationParams;

        return this.generateEnvironment(params);
    }
}

// ============================================================================
// Additional Type Definitions
// ============================================================================

export interface TerrainGenerationParams extends Partial<EnvironmentGenerationParams> {
    terrainType?: 'mountains' | 'hills' | 'plains' | 'canyon' | 'volcanic';
    heightVariation?: 'low' | 'medium' | 'high' | 'extreme';
    includeWater?: boolean;
    includeCliffs?: boolean;
}

export interface BuildingGenerationParams extends Partial<EnvironmentGenerationParams> {
    buildingType?: 'house' | 'castle' | 'tower' | 'temple' | 'shop' | 'warehouse' | 'palace';
    architecturalStyle?: 'medieval' | 'modern' | 'futuristic' | 'ancient' | 'gothic';
    material?: 'stone' | 'wood' | 'brick' | 'glass' | 'metal';
    condition?: 'pristine' | 'weathered' | 'ruined' | 'under_construction';
    floors?: number;
}

export interface CityGenerationParams extends Partial<EnvironmentGenerationParams> {
    cityType?: 'metropolis' | 'town' | 'village' | 'industrial' | 'residential';
    era?: 'medieval' | 'modern' | 'futuristic' | 'post_apocalyptic';
    density?: 'low' | 'medium' | 'high';
    includeStreets?: boolean;
    includeVehicles?: boolean;
    includePeople?: boolean;
}

export interface DungeonGenerationParams extends Partial<EnvironmentGenerationParams> {
    dungeonType?: 'cave' | 'castle_dungeon' | 'temple_ruins' | 'crypt' | 'labyrinth';
    theme?: 'horror' | 'fantasy' | 'ancient' | 'elemental';
    lighting?: 'dark' | 'dim' | 'torchlit' | 'magical';
    includeTraps?: boolean;
    includeTreasure?: boolean;
    includeEnemies?: boolean;
}

export interface InteriorGenerationParams extends Partial<EnvironmentGenerationParams> {
    roomType?: 'bedroom' | 'kitchen' | 'throne_room' | 'dungeon_cell' | 'library' | 'workshop';
    style?: 'medieval' | 'modern' | 'luxury' | 'ruined';
    furnished?: boolean;
    lighting?: 'natural' | 'candle' | 'electric' | 'magical';
    decorations?: string;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createWorldGenerator(config: WorldGeneratorConfig): WorldGenerator {
    return new WorldGenerator(config);
}
