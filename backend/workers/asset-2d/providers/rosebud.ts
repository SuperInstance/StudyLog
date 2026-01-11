/**
 * Rosebud AI (PixelVibe) Provider
 * Specializes in pixel art, sprites, and UGC game assets
 * API: https://docs.rosebud.ai
 * Website: https://rosebud.ai/pixelvibe
 */

import type {
    RosebudConfig,
    RosebudResponse,
    RosebudPixelArtRequest,
    GenerateSpriteRequest,
    GenerateSpriteSheetRequest,
    GenerationResponse,
    SpriteMetadata,
    SpriteSheetMetadata,
    AnimationConfig
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.rosebud.ai';

const ROSEBUD_MODELS = [
    'pixelvibe-1',
    'pixelvibe-2',
    'pixelvibe-turbo'
] as const;

const ROSEBUD_RESOLUTIONS = [
    '64x64',
    '128x128',
    '256x256',
    '512x512'
] as const;

const ROSEBUD_STYLES = [
    'pixel',
    '16bit',
    'vaporwave',
    'rpg',
    'gba',
    'nes',
    'snes',
    'arcade',
    'isometric'
] as const;

type RosebudModel = typeof ROSEBUD_MODELS[number];
type RosebudResolution = typeof ROSEBUD_RESOLUTIONS[number];
type RosebudStyle = typeof ROSEBUD_STYLES[number];

export class RosebudProvider {
    private config: Required<RosebudConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: RosebudConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 1,
            model: config.model || 'pixelvibe-2',
            defaultResolution: config.defaultResolution || '256x256',
            rateLimit: config.rateLimit || { requestsPerMinute: 60, requestsPerDay: 2000 }
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
            throw new Error(`Rosebud API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    /**
     * Generate a single pixel art sprite
     */
    async generateSprite(request: GenerateSpriteRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateSpriteRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'rosebud'
            };
        }

        try {
            const pixelArtRequest = this.buildPixelArtRequest(request);
            const response = await this.request<RosebudResponse>('/v1/pixel-art/generate', {
                method: 'POST',
                body: JSON.stringify(pixelArtRequest)
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: this.estimateTime(request),
                pollUrl: `/api/v1/assets/2d/rosebud/status/${response.id}`,
                requestId,
                provider: 'rosebud',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rosebud'
            };
        }
    }

    /**
     * Generate a sprite sheet with multiple animations
     */
    async generateSpriteSheet(request: GenerateSpriteSheetRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateSpriteSheetRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'rosebud'
            };
        }

        try {
            const pixelArtRequest = this.buildPixelArtRequest(request);
            const enhancedRequest = {
                ...pixelArtRequest,
                mode: 'spritesheet',
                animations: request.animations.map(anim => ({
                    type: anim.type,
                    direction: anim.direction || 'down',
                    frames: anim.frames || request.framesPerAnimation || 4,
                    looping: anim.looping !== false
                })),
                columns: request.columns || this.calculateColumns(request),
                rows: request.rows || this.calculateRows(request),
                frameWidth: request.frameWidth || parseInt(this.config.defaultResolution.split('x')[0]),
                frameHeight: request.frameHeight || parseInt(this.config.defaultResolution.split('x')[1]),
                padding: request.padding || 0,
                generateJson: request.includeJsonData !== false,
                jsonFormat: request.jsonFormat || 'godot'
            };

            const response = await this.request<RosebudResponse>('/v1/pixel-art/spritesheet', {
                method: 'POST',
                body: JSON.stringify(enhancedRequest)
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: this.estimateSpriteSheetTime(request),
                pollUrl: `/api/v1/assets/2d/rosebud/status/${response.id}`,
                requestId,
                provider: 'rosebud',
                costUsd: this.estimateSpriteSheetCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rosebud'
            };
        }
    }

    /**
     * Generate a tileset for game environments
     */
    async generateTileset(request: GenerateSpriteRequest & {
        tileSize?: number;
        tilesWide?: number;
        tilesHigh?: number;
        includeVariations?: boolean;
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const tileSize = request.tileSize || 32;
            const tilesWide = request.tilesWide || 8;
            const tilesHigh = request.tilesHigh || 8;

            const response = await this.request<RosebudResponse>('/v1/pixel-art/tileset', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    style: this.mapStyleToRosebud(request.style || 'pixel_art'),
                    tileSize,
                    tilesWide,
                    tilesHigh,
                    includeVariations: request.includeVariations !== false,
                    resolution: request.width && request.height
                        ? `${request.width}x${request.height}`
                        : `${tileSize * tilesWide}x${tileSize * tilesHigh}`,
                    transparent: request.transparent !== false
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/rosebud/status/${response.id}`,
                requestId,
                provider: 'rosebud',
                costUsd: 0.05
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rosebud'
            };
        }
    }

    /**
     * Generate UI icons in pixel art style
     */
    async generateUIIcon(request: GenerateSpriteRequest & {
        iconStyle?: 'minimal' | 'detailed' | 'outlined';
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const size = request.width || request.height || 32;
            const resolution = size <= 32 ? '32x32' : size <= 64 ? '64x64' : '128x128';

            const response = await this.request<RosebudResponse>('/v1/pixel-art/ui-icon', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: `UI icon: ${request.prompt}`,
                    negative_prompt: request.negativePrompt || 'blurry, anti-aliased',
                    style: 'pixel',
                    resolution,
                    transparent: true,
                    iconStyle: request.iconStyle || 'minimal'
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 10,
                pollUrl: `/api/v1/assets/2d/rosebud/status/${response.id}`,
                requestId,
                provider: 'rosebud',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rosebud'
            };
        }
    }

    /**
     * Get the status of a generation task
     */
    async getTaskStatus(taskId: string): Promise<RosebudResponse> {
        return this.request<RosebudResponse>(`/v1/pixel-art/status/${taskId}`);
    }

    /**
     * Wait for a task to complete
     */
    async waitForTask(taskId: string, timeoutMs: number = 120000): Promise<RosebudResponse> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);
            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Task timeout');
    }

    /**
     * Download the generated image
     */
    async downloadImage(taskId: string): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'completed' || !status.image_url) {
            throw new Error(`Task not completed or no image available. Status: ${status.status}`);
        }
        const response = await fetch(status.image_url);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
        }
        return response.blob();
    }

    /**
     * Download the sprite sheet JSON data
     */
    async downloadSpriteSheetJson(taskId: string): Promise<unknown> {
        return this.request<unknown>(`/v1/pixel-art/spritesheet/${taskId}/json`);
    }

    /**
     * Extract metadata from a completed task
     */
    async extractMetadata(taskId: string, type: 'sprite' | 'spritesheet' = 'sprite'): Promise<SpriteMetadata | SpriteSheetMetadata> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        const baseMetadata = {
            format: 'png' as const,
            width: 256,
            height: 256,
            frameCount: 1,
            hasTransparency: true,
            colorDepth: 32,
            palette: undefined,
            isAnimated: false,
            fileSizeBytes: 0,
            previewImageUrl: status.thumbnail_url || status.image_url,
            godotCompatible: true,
            godotImportPath: `res://assets/sprites/${taskId}.png`
        };

        if (type === 'spritesheet') {
            const json = await this.downloadSpriteSheetJson(taskId);
            return {
                ...baseMetadata,
                frameCount: (json as any).frames?.length || 1,
                isAnimated: true,
                animations: [],
                frameWidth: 64,
                frameHeight: 64,
                columns: 4,
                rows: 4,
                padding: 0,
                jsonData: json as any
            } as SpriteSheetMetadata;
        }

        return baseMetadata as SpriteMetadata;
    }

    /**
     * Generate multiple sprites in batch
     */
    async generateBatch(requests: GenerateSpriteRequest[]): Promise<GenerationResponse[]> {
        const results: GenerationResponse[] = [];
        for (const request of requests) {
            results.push(await this.generateSprite(request));
        }
        return results;
    }

    /**
     * Get available pixel art styles
     */
    getAvailableStyles(): readonly string[] {
        return ROSEBUD_STYLES;
    }

    /**
     * Get available resolutions
     */
    getAvailableResolutions(): readonly string[] {
        return ROSEBUD_RESOLUTIONS;
    }

    /**
     * Check if the provider is available
     */
    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }

    /**
     * Validate a sprite generation request
     */
    validateSpriteRequest(request: GenerateSpriteRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!request.prompt || request.prompt.length < 5) {
            errors.push('Prompt must be at least 5 characters');
        }
        if (request.prompt && request.prompt.length > 500) {
            errors.push('Prompt must not exceed 500 characters');
        }
        if (request.width && (request.width < 16 || request.width > 1024)) {
            errors.push('Width must be between 16 and 1024');
        }
        if (request.height && (request.height < 16 || request.height > 1024)) {
            errors.push('Height must be between 16 and 1024');
        }
        return { valid: errors.length === 0, errors };
    }

    /**
     * Validate a sprite sheet generation request
     */
    validateSpriteSheetRequest(request: GenerateSpriteSheetRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const baseValidation = this.validateSpriteRequest(request);
        errors.push(...baseValidation.errors);

        if (!request.animations || request.animations.length === 0) {
            errors.push('At least one animation must be specified');
        }
        if (request.columns && request.columns < 1) {
            errors.push('Columns must be at least 1');
        }
        if (request.rows && request.rows < 1) {
            errors.push('Rows must be at least 1');
        }
        return { valid: errors.length === 0, errors };
    }

    // Private helper methods

    private buildPixelArtRequest(request: GenerateSpriteRequest): RosebudPixelArtRequest {
        return {
            prompt: request.prompt,
            negative_prompt: request.negativePrompt,
            resolution: request.width && request.height
                ? `${request.width}x${request.height}` as RosebudResolution
                : this.config.defaultResolution,
            style: this.mapStyleToRosebud(request.style || 'pixel_art'),
            transparent: request.transparent !== false
        };
    }

    private mapStyleToRosebud(style: string): RosebudStyle {
        const styleMap: Record<string, RosebudStyle> = {
            'pixel_art': 'pixel',
            'pixel_perfect': 'pixel',
            '16bit': '16bit',
            'vaporwave': 'vaporwave',
            'rpg_maker': 'rpg',
            'gba': 'gba',
            'nes': 'nes',
            'snes': 'snes',
            'arcade': 'arcade',
            'isometric': 'isometric'
        };
        return styleMap[style] || 'pixel';
    }

    private mapStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
        const statusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'> = {
            'queued': 'pending',
            'processing': 'processing',
            'completed': 'completed',
            'failed': 'failed',
            'cancelled': 'cancelled'
        };
        return statusMap[status] || 'pending';
    }

    private calculateColumns(request: GenerateSpriteSheetRequest): number {
        const framesPerAnim = request.framesPerAnimation || 4;
        const totalFrames = request.animations.reduce((sum, anim) => sum + (anim.frames || framesPerAnim), 0);
        return Math.ceil(Math.sqrt(totalFrames));
    }

    private calculateRows(request: GenerateSpriteSheetRequest): number {
        const columns = this.calculateColumns(request);
        const framesPerAnim = request.framesPerAnimation || 4;
        const totalFrames = request.animations.reduce((sum, anim) => sum + (anim.frames || framesPerAnim), 0);
        return Math.ceil(totalFrames / columns);
    }

    private estimateTime(request: GenerateSpriteRequest): number {
        const resolution = request.width && request.height
            ? request.width * request.height
            : parseInt(this.config.defaultResolution.split('x')[0]) * parseInt(this.config.defaultResolution.split('x')[1]);
        const baseTime = 10;
        const timePerPixel = 0.0001;
        return Math.ceil(baseTime + (resolution * timePerPixel));
    }

    private estimateSpriteSheetTime(request: GenerateSpriteSheetRequest): number {
        const baseTime = this.estimateTime(request);
        const animationCount = request.animations.length;
        const framesPerAnimation = request.framesPerAnimation || 4;
        return Math.ceil(baseTime * animationCount * framesPerAnimation * 0.3);
    }

    private estimateCost(request: GenerateSpriteRequest): number {
        const baseCost = 0.02;
        const resolution = request.width && request.height
            ? request.width * request.height
            : 256 * 256;
        const resolutionMultiplier = resolution / (256 * 256);
        return Math.round(baseCost * resolutionMultiplier * 1000) / 1000;
    }

    private estimateSpriteSheetCost(request: GenerateSpriteSheetRequest): number {
        const baseCost = this.estimateCost(request);
        const animationCount = request.animations.length;
        return Math.round(baseCost * animationCount * 2 * 1000) / 1000;
    }
}

export function createRosebudProvider(config: RosebudConfig): RosebudProvider {
    return new RosebudProvider(config);
}
