/**
 * Sloyd AI Provider Integration
 * Parametric game-ready models (buildings, weapons, furniture, etc.)
 * Low-poly, UV unwrapping, LOD support
 *
 * API Docs: https://docs.sloyd.ai
 */

import {
    SloydConfig,
    SloydModelParams,
    SloydResponse,
    Generate3DRequest,
    GenerationResponse,
    Model3DMetadata,
    ModelFormat
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.sloyd.ai/v1';

// Sloyd predefined categories
const SLOYD_CATEGORIES = [
    'architecture',
    'buildings',
    'weapons',
    'furniture',
    'vehicles',
    'props',
    'nature',
    'characters',
    'sci-fi',
    'fantasy'
] as const;

const SLOYD_STYLES = [
    'realistic',
    'stylized',
    'low_poly',
    'cartoon',
    'pixel_art',
    'voxel',
    'hand_painted',
    'metallic',
    'organic'
] as const;

// ============================================================================
// Sloyd Provider Class
// ============================================================================

export class SloydProvider {
    private config: SloydConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: SloydConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 30;
        this.rateLimitResetAt = Date.now() + 60000;
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 30;
            this.rateLimitResetAt = Date.now() + 60000;
        }

        if (this.rateLimitRemaining <= 0) {
            const waitMs = this.rateLimitResetAt - Date.now();
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitMs / 1000)} seconds.`);
        }

        this.rateLimitRemaining--;
    }

    // ========================================================================
    // API Requests
    // ========================================================================

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        await this.checkRateLimit();

        const url = `${this.config.endpoint}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Sloyd API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Categories and Styles
    // ========================================================================

    /**
     * Get available model categories
     */
    getCategories(): readonly string[] {
        return SLOYD_CATEGORIES;
    }

    /**
     * Get available styles
     */
    getStyles(): readonly string[] {
        return SLOYD_STYLES;
    }

    /**
     * Fetch available preset templates from Sloyd
     */
    async getTemplates(category?: string): Promise<SloydTemplate[]> {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        return this.request<SloydTemplate[]>(`/templates${params}`);
    }

    // ========================================================================
    // Model Generation
    // ========================================================================

    /**
     * Generate a parametric 3D model
     */
    async generateModel(request: Generate3DRequest & SloydModelParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);

        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId
            };
        }

        try {
            const response = await this.request<SloydResponse>('/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    category: request.category,
                    style: request.style || 'stylized',
                    lod: request.lod || 1,
                    unwrap: request.unwrap !== false,
                    output_formats: ['glb', 'obj'], // Sloyd provides multiple formats
                    texture_resolution: request.quality === 'high' ? 2048 : 1024
                })
            });

            return {
                success: true,
                assetId: this.extractAssetId(response),
                status: 'completed', // Sloyd returns complete models immediately
                estimatedTimeSeconds: 0,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate from a preset template
     */
    async generateFromTemplate(
        templateId: string,
        modifications?: Record<string, number | string>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<SloydResponse>('/template/generate', {
                method: 'POST',
                body: JSON.stringify({
                    template_id: templateId,
                    modifications,
                    output_formats: ['glb', 'obj']
                })
            });

            return {
                success: true,
                assetId: this.extractAssetId(response),
                status: 'completed',
                estimatedTimeSeconds: 0,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate a building with specific parameters
     */
    async generateBuilding(params: SloydBuildingParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<SloydResponse>('/generate/building', {
                method: 'POST',
                body: JSON.stringify({
                    category: 'buildings',
                    building_type: params.type,
                    style: params.style || 'realistic',
                    floors: params.floors || 1,
                    width: params.width || 10,
                    depth: params.depth || 10,
                    has_roof: params.hasRoof !== false,
                    has_windows: params.hasWindows !== false,
                    roof_style: params.roofStyle || 'flat',
                    output_formats: ['glb', 'obj']
                })
            });

            return {
                success: true,
                assetId: this.extractAssetId(response),
                status: 'completed',
                estimatedTimeSeconds: 0,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate a weapon model
     */
    async generateWeapon(params: SloydWeaponParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<SloydResponse>('/generate/weapon', {
                method: 'POST',
                body: JSON.stringify({
                    category: 'weapons',
                    weapon_type: params.type,
                    style: params.style || 'fantasy',
                    size: params.size || 'medium',
                    has_sheath: params.hasSheath || false,
                    detail_level: params.detailLevel || 'standard',
                    output_formats: ['glb', 'obj']
                })
            });

            return {
                success: true,
                assetId: this.extractAssetId(response),
                status: 'completed',
                estimatedTimeSeconds: 0,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate furniture
     */
    async generateFurniture(params: SloydfurnitureParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<SloydResponse>('/generate/furniture', {
                method: 'POST',
                body: JSON.stringify({
                    category: 'furniture',
                    furniture_type: params.type,
                    style: params.style || 'modern',
                    material: params.material || 'wood',
                    cushioned: params.cushioned || false,
                    output_formats: ['glb', 'obj']
                })
            });

            return {
                success: true,
                assetId: this.extractAssetId(response),
                status: 'completed',
                estimatedTimeSeconds: 0,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    // ========================================================================
    // LOD (Level of Detail) Generation
    // ========================================================================

    /**
     * Generate LOD versions of a model
     */
    async generateLODs(assetId: string, levels: number[] = [0, 1, 2]): Promise<string[]> {
        const lodUrls: string[] = [];

        for (const level of levels) {
            try {
                const response = await this.request<{ url: string }>(`/lod/${assetId}`, {
                    method: 'POST',
                    body: JSON.stringify({ level })
                });
                lodUrls.push(response.url);
            } catch (error) {
                console.error(`Failed to generate LOD ${level}:`, error);
            }
        }

        return lodUrls;
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private extractAssetId(response: SloydResponse): string {
        // Extract ID from URL or generate from metadata
        const urlParts = response.model.glb.split('/');
        return urlParts[urlParts.length - 1].replace('.glb', '');
    }

    /**
     * Extract metadata from Sloyd response
     */
    extractMetadata(response: SloydResponse): Model3DMetadata {
        return {
            format: 'glb',
            polygonCount: response.metadata.polygons,
            vertexCount: response.metadata.vertices,
            textureCount: response.metadata.textures,
            hasRigging: false,
            hasAnimation: false,
            hasUVUnwrapping: true, // Sloyd always provides UV unwrapping
            lodLevels: 3, // Sloyd supports multiple LODs
            fileSizeBytes: 0, // Would get from actual file
            previewImageUrl: response.model.thumbnail,
            godotCompatible: true,
            theiaMetadata: {
                importPath: `res://assets/models/sloyd_${this.extractAssetId(response)}.glb`,
                resourceType: 'PackedScene',
                autoImport: true,
                customImportSettings: {
                    generate_lod: true,
                    lod_levels: 3
                }
            }
        };
    }

    /**
     * Validate request before sending to API
     */
    validateRequest(request: Generate3DRequest & Partial<SloydModelParams>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!request.prompt || request.prompt.length < 5) {
            errors.push('Prompt must be at least 5 characters');
        }

        if (request.prompt && request.prompt.length > 200) {
            errors.push('Prompt must not exceed 200 characters');
        }

        if (request.category && !SLOYD_CATEGORIES.includes(request.category as any)) {
            errors.push(`Invalid category. Must be one of: ${SLOYD_CATEGORIES.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: Generate3DRequest & Partial<SloydModelParams>): number {
        // Sloyd typically charges per model generated
        // Base cost around $0.05-0.15 per model depending on complexity
        const baseCost = 0.05;

        const complexityMultiplier = {
            draft: 0.5,
            standard: 1.0,
            high: 1.5
        };

        return baseCost * (complexityMultiplier[request.quality || 'standard'] || 1);
    }

    /**
     * Get model URLs in different formats
     */
    async getModelUrls(assetId: string): Promise<Record<ModelFormat, string | null>> {
        try {
            return await this.request<Record<string, string>>(`/model/${assetId}/formats`);
        } catch {
            return {
                glb: null,
                gltf: null,
                fbx: null,
                obj: null,
                usd: null,
                usdz: null
            };
        }
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface SloydTemplate {
    id: string;
    name: string;
    category: string;
    style: string;
    thumbnail: string;
    description: string;
    parameters: SloydTemplateParameter[];
}

export interface SloydTemplateParameter {
    name: string;
    type: 'slider' | 'select' | 'toggle' | 'color';
    min?: number;
    max?: number;
    default: number | string | boolean;
    options?: string[];
}

export interface SloydBuildingParams {
    type: 'house' | 'tower' | 'castle' | 'shop' | 'temple' | 'dungeon';
    style?: string;
    floors?: number;
    width?: number;
    depth?: number;
    hasRoof?: boolean;
    hasWindows?: boolean;
    roofStyle?: 'flat' | 'peaked' | 'dome' | 'spire';
}

export interface SloydWeaponParams {
    type: 'sword' | 'axe' | 'bow' | 'staff' | 'dagger' | 'mace' | 'spear';
    style?: string;
    size?: 'small' | 'medium' | 'large';
    hasSheath?: boolean;
    detailLevel?: 'basic' | 'standard' | 'ornate';
}

export interface SloydfurnitureParams {
    type: 'chair' | 'table' | 'bed' | 'cabinet' | 'desk' | 'shelf';
    style?: string;
    material?: 'wood' | 'metal' | 'plastic' | 'stone';
    cushioned?: boolean;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSloydProvider(config: SloydConfig): SloydProvider {
    return new SloydProvider(config);
}
