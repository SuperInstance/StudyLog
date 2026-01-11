/**
 * Sloyd AI Provider
 * Parametric game-ready models (buildings, weapons, furniture, etc.)
 * Low-poly, UV unwrapping, LOD support
 * API: https://docs.sloyd.ai
 */

import type {
    SloydConfig,
    SloydResponse,
    SloydTemplate,
    GenerateModelRequest,
    GenerationResponse,
    ModelMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.sloyd.ai/v1';

const SLOYD_CATEGORIES = [
    'architecture', 'buildings', 'weapons', 'furniture', 'vehicles',
    'props', 'nature', 'characters', 'sci-fi', 'fantasy'
] as const;

const SLOYD_STYLES = [
    'realistic', 'stylized', 'low_poly', 'cartoon', 'pixel_art',
    'voxel', 'hand_painted', 'metallic', 'organic'
] as const;

export class SloydProvider {
    private config: Required<SloydConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: SloydConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 1,
            categories: config.categories || [...SLOYD_CATEGORIES],
            styles: config.styles || [...SLOYD_STYLES],
            rateLimit: config.rateLimit || { requestsPerMinute: 30, requestsPerDay: 1000 }
        };
        this.rateLimitRemaining = this.config.rateLimit.requestsPerMinute;
        this.rateLimitResetAt = Date.now() + 60000;
    }

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = this.config.rateLimit.requestsPerMinute;
            this.rateLimitResetAt = Date.now() + 60000;
        }
        if (this.rateLimitRemaining <= 0) {
            const waitMs = this.rateLimitResetAt - Date.now();
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitMs / 1000)}s`);
        }
        this.rateLimitRemaining--;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        await this.checkRateLimit();
        const url = `${this.config.endpoint}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Sloyd API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    getCategories(): readonly string[] {
        return this.config.categories;
    }

    getStyles(): readonly string[] {
        return this.config.styles;
    }

    async getTemplates(category?: string): Promise<SloydTemplate[]> {
        const params = category ? `?category=${encodeURIComponent(category)}` : '';
        return this.request<SloydTemplate[]>(`/templates${params}`);
    }

    async generateModel(request: GenerateModelRequest & {
        category?: string;
        style?: string;
        lod?: 0 | 1 | 2;
        unwrap?: boolean;
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'sloyd'
            };
        }
        try {
            const response = await this.request<SloydResponse>('/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    category: request.category || 'props',
                    style: request.style || 'stylized',
                    lod: request.lod || 1,
                    unwrap: request.unwrap !== false,
                    output_formats: ['glb', 'obj'],
                    texture_resolution: request.quality === 'high' || request.quality === 'ultra' ? 2048 : 1024
                })
            });
            return {
                success: true,
                assetId: this.extractAssetId(response),
                status: 'completed',
                estimatedTimeSeconds: 0,
                requestId,
                provider: 'sloyd',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'sloyd'
            };
        }
    }

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
                requestId,
                provider: 'sloyd',
                costUsd: 0.05
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'sloyd'
            };
        }
    }

    async generateBuilding(params: {
        type: 'house' | 'tower' | 'castle' | 'shop' | 'temple' | 'dungeon';
        style?: string;
        floors?: number;
        width?: number;
        depth?: number;
        hasRoof?: boolean;
        hasWindows?: boolean;
        roofStyle?: 'flat' | 'peaked' | 'dome' | 'spire';
    }): Promise<GenerationResponse> {
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
                requestId,
                provider: 'sloyd',
                costUsd: 0.05
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'sloyd'
            };
        }
    }

    async generateWeapon(params: {
        type: 'sword' | 'axe' | 'bow' | 'staff' | 'dagger' | 'mace' | 'spear';
        style?: string;
        size?: 'small' | 'medium' | 'large';
        hasSheath?: boolean;
        detailLevel?: 'basic' | 'standard' | 'ornate';
    }): Promise<GenerationResponse> {
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
                requestId,
                provider: 'sloyd',
                costUsd: 0.05
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'sloyd'
            };
        }
    }

    async generateFurniture(params: {
        type: 'chair' | 'table' | 'bed' | 'cabinet' | 'desk' | 'shelf';
        style?: string;
        material?: 'wood' | 'metal' | 'plastic' | 'stone';
        cushioned?: boolean;
    }): Promise<GenerationResponse> {
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
                requestId,
                provider: 'sloyd',
                costUsd: 0.05
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'sloyd'
            };
        }
    }

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

    private extractAssetId(response: SloydResponse): string {
        const urlParts = response.model.glb.split('/');
        return urlParts[urlParts.length - 1].replace('.glb', '');
    }

    extractMetadata(response: SloydResponse): ModelMetadata {
        return {
            format: 'glb',
            polygonCount: response.metadata.polygons,
            vertexCount: response.metadata.vertices,
            triangleCount: response.metadata.polygons,
            textureCount: response.metadata.textures,
            materialCount: response.metadata.textures,
            hasRigging: false,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 3,
            fileSizeBytes: 0,
            previewImageUrl: response.model.thumbnail,
            godotCompatible: true
        };
    }

    validateRequest(request: GenerateModelRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!request.prompt || request.prompt.length < 5) {
            errors.push('Prompt must be at least 5 characters');
        }
        if (request.prompt && request.prompt.length > 200) {
            errors.push('Prompt must not exceed 200 characters');
        }
        return { valid: errors.length === 0, errors };
    }

    estimateCost(request: GenerateModelRequest): number {
        const baseCost = 0.05;
        const qualityMultiplier = { draft: 0.5, preview: 0.7, standard: 1.0, high: 1.5, ultra: 2.0 };
        return baseCost * (qualityMultiplier[request.quality || 'standard'] || 1);
    }

    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }
}

export function createSloydProvider(config: SloydConfig): SloydProvider {
    return new SloydProvider(config);
}
