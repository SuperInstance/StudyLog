/**
 * Leonardo AI Texture Generation Integration
 *
 * Provides AI-powered texture generation for voxel assets using Leonardo AI.
 * Generates seamless textures, PBR texture sets, and voxel-specific tile textures.
 *
 * Features:
 * - Seamless texture generation
 * - PBR texture set generation (albedo, normal, roughness, metallic, AO)
 * - Voxel tile textures for blocky aesthetics
 * - Style-preserving generation
 * - Texture palette matching
 * - Runtime texture application
 *
 * @module leonardo-textures
 */

import type {
    Env,
    LeonardoTextureRequest,
    LeonardoTextureResponse,
    LeonardoTextureType,
    PBRTextureSet,
    ApplyVoxelTextureRequest,
    ProductContext,
    ApiResponse,
    Vector2,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const LEONARDO_API_BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const LEONARDO_GENERATION_TIMEOUT_MS = 120000;

/**
 * Leonardo AI model IDs for texture generation
 */
enum LeonardoModel {
    TEXTURE_GEN = '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3',
    PBR_GEN = 'ac614f96-1081-45bf-9a81-c0f3ef7521bf',
    PHOTOREAL = 'aca96835-c729-4bc0-9b49-adecf8f08e34',
}

// ============================================================================
// Leonardo API Client
// ============================================================================

/**
 * Client for interacting with Leonardo AI API
 */
export class LeonardoClient {
    private apiKey: string;
    private apiBase: string;

    constructor(apiKey: string, apiBase: string = LEONARDO_API_BASE) {
        this.apiKey = apiKey;
        this.apiBase = apiBase;
    }

    /**
     * Generate a single texture
     */
    async generateTexture(request: LeonardoTextureRequest): Promise<LeonardoTextureResponse> {
        const requestId = crypto.randomUUID();

        // Start generation
        const initResponse = await fetch(`${this.apiBase}/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: this.buildPrompt(request),
                num_images: request.count,
                width: parseInt(request.size.split('x')[0]),
                height: parseInt(request.size.split('x')[1]),
                modelId: LeonardoModel.TEXTURE_GEN,
                guidance_scale: 7,
                seed: Math.floor(Math.random() * 4294967295),
            }),
        });

        if (!initResponse.ok) {
            const error = await initResponse.text();
            throw new Error(`Leonardo API error: ${error}`);
        }

        const initData = await initResponse.json() as {
            sdGenerationJob: {
                generationId: string;
            };
        };

        const generationId = initData.sdGenerationJob.generationId;

        // Poll for completion
        return await this.pollForCompletion(generationId, request);
    }

    /**
     * Poll for texture generation completion
     */
    private async pollForCompletion(
        generationId: string,
        request: LeonardoTextureRequest
    ): Promise<LeonardoTextureResponse> {
        const startTime = Date.now();
        const maxAttempts = LEONARDO_GENERATION_TIMEOUT_MS / 1000;

        while (Date.now() - startTime < LEONARDO_GENERATION_TIMEOUT_MS) {
            const response = await fetch(
                `${this.apiBase}/generations/${generationId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`Leonardo poll error: ${response.statusText}`);
            }

            const data = await response.json() as {
                generations_by_pk: {
                    status: string;
                    generated_images: Array<{
                        url: string;
                    }> | null;
                };
            };

            if (data.generations_by_pk.status === 'COMPLETE') {
                const images = data.generations_by_pk.generated_images || [];
                if (images.length > 0) {
                    return {
                        textureId: generationId,
                        url: images[0].url,
                        type: request.textureType,
                        size: request.size,
                        seamless: request.seamless,
                        format: 'png',
                        metadata: {
                            generationId,
                            modelUsed: LeonardoModel.TEXTURE_GEN,
                            seed: Date.now(),
                        },
                    };
                }
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Leonardo generation timeout');
    }

    /**
     * Build a prompt for texture generation
     */
    private buildPrompt(request: LeonardoTextureRequest): string {
        const parts = [];

        // Add texture type specific keywords
        switch (request.textureType) {
            case 'albedo':
            case 'diffuse':
                parts.push('seamless texture', 'high quality', 'detailed');
                break;
            case 'normal':
                parts.push('normal map', 'surface detail', 'bump');
                break;
            case 'roughness':
                parts.push('roughness map', 'surface roughness', 'grayscale');
                break;
            case 'metallic':
                parts.push('metallic map', 'metalness', 'grayscale');
                break;
            case 'ambient_occlusion':
                parts.push('ambient occlusion', 'AO map', 'shadow', 'grayscale');
                break;
            case 'voxel_tile':
                parts.push('voxel style', 'blocky', 'minecraft-like', 'pixel art');
                break;
        }

        // Add seamless requirement
        if (request.seamless) {
            parts.push('seamless pattern', 'tileable');
        }

        // Add style
        if (request.style) {
            parts.push(request.style);
        }

        // Add color hints
        if (request.colors && request.colors.length > 0) {
            parts.push(`colors: ${request.colors.join(', ')}`);
        }

        // Add main prompt
        parts.unshift(request.prompt);

        // Add product context hints
        switch (request.productContext) {
            case 'studylog':
                parts.push('educational', 'clean', 'colorful');
                break;
            case 'dmlog':
                parts.push('fantasy', 'medieval', 'atmospheric');
                break;
        }

        return parts.join(', ');
    }

    /**
     * Generate a complete PBR texture set
     */
    async generatePBRTextureSet(
        prompt: string,
        size: string = '1024x1024',
        seamless: boolean = true
    ): Promise<PBRTextureSet> {
        const setId = crypto.randomUUID();

        // Generate all PBR maps in parallel
        const [albedo, normal, roughness, metallic, ao] = await Promise.all([
            this.generateTexture({
                prompt: `${prompt}, albedo color texture`,
                size,
                count: 1,
                textureType: 'albedo',
                seamless,
                productContext: 'general',
            }),
            this.generateTexture({
                prompt: `${prompt}, normal map for surface detail`,
                size,
                count: 1,
                textureType: 'normal',
                seamless,
                productContext: 'general',
            }),
            this.generateTexture({
                prompt: `${prompt}, roughness map`,
                size,
                count: 1,
                textureType: 'roughness',
                seamless,
                productContext: 'general',
            }),
            this.generateTexture({
                prompt: `${prompt}, metallic map`,
                size,
                count: 1,
                textureType: 'metallic',
                seamless,
                productContext: 'general',
            }),
            this.generateTexture({
                prompt: `${prompt}, ambient occlusion map`,
                size,
                count: 1,
                textureType: 'ambient_occlusion',
                seamless,
                productContext: 'general',
            }),
        ]);

        return {
            id: setId,
            name: prompt.split(',')[0],
            albedo: albedo.url,
            normal: normal.url,
            roughness: roughness.url,
            metallic: metallic.url,
            ambientOcclusion: ao.url,
            seamless,
            resolution: size,
        };
    }

    /**
     * Generate voxel-specific tile textures
     */
    async generateVoxelTileTextures(
        blockTypes: string[],
        style: string = 'stylized',
        size: string = '512x512'
    ): Promise<Map<string, PBRTextureSet>> {
        const textureMap = new Map<string, PBRTextureSet>();

        for (const blockType of blockTypes) {
            try {
                const textureSet = await this.generatePBRTextureSet(
                    `${blockType} voxel tile, ${style}`,
                    size,
                    true
                );
                textureMap.set(blockType, textureSet);
            } catch (error) {
                console.error(`Failed to generate texture for ${blockType}:`, error);
            }
        }

        return textureMap;
    }
}

// ============================================================================
// Voxel Material Manager
// ============================================================================

/**
 * Manager for voxel block materials and textures
 */
export class VoxelMaterialManager {
    private cache: KVNamespace | undefined;
    private db: D1Database | undefined;
    private leonardo: LeonardoClient;

    constructor(env: Env, apiKey: string) {
        this.cache = env.CACHE;
        this.db = env.DB;
        this.leonardo = new LeonardoClient(apiKey);
    }

    /**
     * Apply a texture set to a voxel block type
     */
    async applyTextureToBlock(request: ApplyVoxelTextureRequest): Promise<boolean> {
        const key = `voxel:material:${request.blockTypeId}`;

        const materialData = {
            textureSet: request.textureSet,
            uvScale: request.uvScale || { x: 1, y: 1 },
            material: request.material || {},
        };

        // Store in cache
        if (this.cache) {
            await this.cache.put(key, JSON.stringify(materialData), {
                expirationTtl: 86400, // 24 hours
            });
        }

        // Store in database
        if (this.db) {
            await this.db.prepare(`
                INSERT OR REPLACE INTO voxel_materials (block_type_id, texture_set, uv_scale, material_properties)
                VALUES (?, ?, ?, ?)
            `).bind(
                request.blockTypeId,
                JSON.stringify(request.textureSet),
                JSON.stringify(request.uvScale || { x: 1, y: 1 }),
                JSON.stringify(request.material || {})
            ).run();
        }

        return true;
    }

    /**
     * Get material for a block type
     */
    async getBlockMaterial(blockTypeId: number): Promise<{
        textureSet: PBRTextureSet;
        uvScale: Vector2;
        material: Record<string, unknown>;
    } | null> {
        const key = `voxel:material:${blockTypeId}`;

        // Check cache first
        if (this.cache) {
            const cached = await this.cache.get(key, 'json');
            if (cached) {
                return cached as {
                    textureSet: PBRTextureSet;
                    uvScale: Vector2;
                    material: Record<string, unknown>;
                };
            }
        }

        // Check database
        if (this.db) {
            const result = await this.db.prepare(`
                SELECT texture_set, uv_scale, material_properties
                FROM voxel_materials
                WHERE block_type_id = ?
            `).bind(blockTypeId).first();

            if (result) {
                return {
                    textureSet: JSON.parse(result.texture_set as string),
                    uvScale: JSON.parse(result.uv_scale as string),
                    material: JSON.parse(result.material_properties as string),
                };
            }
        }

        return null;
    }

    /**
     * Generate and apply textures for multiple block types
     */
    async generateBlockTextures(
        blockTypes: Array<{ id: number; name: string; description: string }>,
        style: string,
        productContext: ProductContext
    ): Promise<Map<number, PBRTextureSet>> {
        const textureMap = new Map<number, PBRTextureSet>();

        for (const block of blockTypes) {
            try {
                const textureSet = await this.leonardo.generatePBRTextureSet(
                    `${block.description}, ${style}`,
                    '512x512',
                    true
                );

                await this.applyTextureToBlock({
                    blockTypeId: block.id,
                    textureSet,
                    material: {
                        albedo: textureSet.albedo,
                        normal: textureSet.normal,
                        roughness: textureSet.roughness,
                        metallic: textureSet.metallic,
                    },
                });

                textureMap.set(block.id, textureSet);
            } catch (error) {
                console.error(`Failed to generate texture for block ${block.id}:`, error);
            }
        }

        return textureMap;
    }
}

// ============================================================================
// Preset Texture Palettes
// ============================================================================

/**
 * Predefined texture palettes for common use cases
 */
export const TEXTURE_PALETTES = {
    // StudyLoG.AI palettes
    cognitive_mill: {
        colors: ['#4A90E2', '#50E3C2', '#F5A623', '#9013FE', '#FFFFFF'],
        style: 'sci-fi technological glowing',
        description: 'Futuristic AI visualization',
    },
    intelligence_ranch: {
        colors: ['#7ED321', '#417505', '#F8E71C', '#8B572A', '#FFFFFF'],
        style: 'pastoral natural gradient fields',
        description: 'Peaceful ranch for AI training',
    },
    sitka_sound: {
        colors: ['#00B5D4', '#004D71', '#FF6B6B', '#F8E71C', '#7ED321'],
        style: 'underwater aquatic kelp forest',
        description: 'Underwater ecosystem',
    },
    science_lab: {
        colors: ['#FFFFFF', '#E0E0E0', '#00D9FF', '#50E3C2', '#F5A623'],
        style: 'clean laboratory scientific',
        description: 'Modern science laboratory',
    },

    // DMLoG.AI palettes
    dungeon: {
        colors: ['#3D3D3D', '#1A1A1A', '#8B4513', '#A0522D', '#F5A623'],
        style: 'dark stone dungeon medieval',
        description: 'Dark dungeon walls',
    },
    wilderness: {
        colors: ['#228B22', '#8B4513', '#006400', '#DEB887', '#87CEEB'],
        style: 'natural forest wild',
        description: 'Wild forest terrain',
    },
    underdark: {
        colors: ['#1A1A2E', '#16213E', '#0F3460', '#E056FD', '#686DE0'],
        style: 'bioluminescent underground alien',
        description: 'Underdark fungal glow',
    },

    // General palettes
    stone: {
        colors: ['#808080', '#696969', '#A9A9A9', '#778899', '#BDC3C7'],
        style: 'natural stone weathered',
        description: 'Natural stone texture',
    },
    wood: {
        colors: ['#8B4513', '#A0522D', '#DEB887', '#D2691E', '#CD853F'],
        style: 'wood grain natural oak',
        description: 'Oak wood texture',
    },
    metal: {
        colors: ['#708090', '#778899', '#B0C4DE', '#4682B4', '#C0C0C0'],
        style: 'brushed metal steel iron',
        description: 'Metal texture',
    },
};

// ============================================================================
// Texture Service (High-level API)
// ============================================================================

/**
 * High-level service for texture generation
 */
export class TextureService {
    private leonardo: LeonardoClient;
    private materialManager: VoxelMaterialManager;
    private cache: KVNamespace | undefined;

    constructor(env: Env) {
        if (!env.LEONARDO_API_KEY) {
            throw new Error('LEONARDO_API_KEY is required');
        }
        this.leonardo = new LeonardoClient(env.LEONARDO_API_KEY);
        this.materialManager = new VoxelMaterialManager(env, env.LEONARDO_API_KEY);
        this.cache = env.CACHE;
    }

    /**
     * Generate textures for a biome
     */
    async generateBiomeTextures(
        biome: string,
        productContext: ProductContext
    ): Promise<PBRTextureSet[]> {
        const palette = TEXTURE_PALETTES[biome as keyof typeof TEXTURE_PALETTES];

        if (!palette) {
            throw new Error(`Unknown biome: ${biome}`);
        }

        // Generate textures for each color in the palette
        const textureSets: PBRTextureSet[] = [];

        for (const color of palette.colors) {
            try {
                const textureSet = await this.leonardo.generatePBRTextureSet(
                    `${palette.style}, color ${color}, ${palette.description}`,
                    '512x512',
                    true
                );
                textureSets.push(textureSet);
            } catch (error) {
                console.error(`Failed to generate texture for color ${color}:`, error);
            }
        }

        return textureSets;
    }

    /**
     * Generate voxel tile texture set
     */
    async generateVoxelTileSet(
        blockName: string,
        productContext: ProductContext,
        style?: string
    ): Promise<PBRTextureSet> {
        const prompt = style
            ? `voxel tile, ${blockName}, ${style}`
            : `voxel tile, ${blockName}`;

        return this.leonardo.generatePBRTextureSet(prompt, '512x512', true);
    }

    /**
     * Get cached texture or generate if not exists
     */
    async getTexture(
        key: string,
        generator: () => Promise<PBRTextureSet>
    ): Promise<PBRTextureSet> {
        if (this.cache) {
            const cached = await this.cache.get(`texture:${key}`, 'json');
            if (cached) {
                return cached as PBRTextureSet;
            }
        }

        const textureSet = await generator();

        if (this.cache) {
            await this.cache.put(`texture:${key}`, JSON.stringify(textureSet), {
                expirationTtl: 604800, // 7 days
            });
        }

        return textureSet;
    }

    /**
     * Generate custom texture with prompt
     */
    async generateCustomTexture(
        prompt: string,
        productContext: ProductContext,
        options?: Partial<LeonardoTextureRequest>
    ): Promise<LeonardoTextureResponse> {
        const request: LeonardoTextureRequest = {
            prompt,
            size: options?.size || '1024x1024',
            count: options?.count || 1,
            textureType: options?.textureType || 'albedo',
            seamless: options?.seamless ?? true,
            style: options?.style,
            colors: options?.colors,
            productContext,
        };

        return this.leonardo.generateTexture(request);
    }

    /**
     * Create texture variant (color shift of existing)
     */
    async createTextureVariant(
        originalTextureUrl: string,
        colorShift: { h: number; s: number; l: number }
    ): Promise<string> {
        // In production, this would download the texture,
        // apply color transformation, and re-upload
        // For now, return the original URL

        return originalTextureUrl;
    }

    /**
     * Get material manager
     */
    getMaterialManager(): VoxelMaterialManager {
        return this.materialManager;
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a texture service
 */
export function createTextureService(env: Env): TextureService {
    return new TextureService(env);
}

/**
 * Create a Leonardo client
 */
export function createLeonardoClient(apiKey: string): LeonardoClient {
    return new LeonardoClient(apiKey);
}

/**
 * Create a voxel material manager
 */
export function createVoxelMaterialManager(env: Env, apiKey: string): VoxelMaterialManager {
    return new VoxelMaterialManager(env, apiKey);
}
