/**
 * Leonardo AI Provider Integration
 * Sprites, UI icons, concept art, AI Canvas
 *
 * API Docs: https://docs.leonardo.ai
 */

import {
    LeonardoConfig,
    LeonardoResponse,
    Generate2DRequest,
    GenerationResponse,
    Art2DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://cloud.leonardoai.ai/api/rest/v1';

// Leonardo AI models for game assets
const LEONARDO_MODELS = {
    // Game asset models
    LEONARDO_DIFFUSION: '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3',
    LEONARDO_CREATIVE: '9cc7b723-7b34-4445-a232-a8d75a49a69f',
    LEONARDO_PHOTOREAL: 'c24373f5-7140-4c26-8998-0a3928b172df',
    RPG_V4: 'aca9680f-3ead-4a8a-8f79-2d89f9a65e85',
    3D_ANIME: 'bd5cb2fe-2c89-4a29-b519-22f02e78f3e5',
    ABSOLUTE_REALITY: 'ccc28542-c5e5-4c93-8384-407d95fa1b8a',
    ILLUSTRATION: '4b718357-a84b-4f85-ab69-2e06ef6bc4f4',
    ESSentials: '8a42707a-428b-4f81-ab1e-c8aab2ca4e89',
    PAPER_CUT: 'fb770359-7361-40b3-850f-e6b4c3ee22f5'
} as const;

// ============================================================================
// Leonardo AI Provider Class
// ============================================================================

export class LeonardoProvider {
    private config: LeonardoConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private modelCache: Map<string, LeonardoModel>;

    constructor(config: LeonardoConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 30;
        this.rateLimitResetAt = Date.now() + 60000;
        this.modelCache = new Map();
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
        options: RequestInit = {},
        skipAuth: boolean = false
    ): Promise<T> {
        await this.checkRateLimit();

        const url = `${this.config.endpoint}${endpoint}`;
        const headers = {
            ...(skipAuth ? {} : { 'Authorization': `Bearer ${this.config.apiKey}` }),
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Leonardo API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Model Management
    // ========================================================================

    /**
     * Get available platforms/models
     */
    async getPlatforms(): Promise<LeonardoPlatform[]> {
        try {
            const response = await this.request<{ platforms: LeonardoPlatform[] }>('/platforms');
            return response.platforms || [];
        } catch {
            return [];
        }
    }

    /**
     * Get user's custom models
     */
    async getCustomModels(): Promise<LeonardoModel[]> {
        try {
            const response = await this.request<{ custom_models: LeonardoModel[] }>('/me');
            return response.custom_models || [];
        } catch {
            return [];
        }
    }

    // ========================================================================
    // Image Generation
    // ========================================================================

    /**
     * Generate a 2D image
     */
    async generateImage(request: Generate2DRequest & LeonardoGenerateParams): Promise<GenerationResponse> {
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
            const modelId = request.modelId || LEONARDO_MODELS.LEONARDO_DIFFUSION;

            const response = await this.request<{ sdGenerationJob: LeonardoGenerationJob }>('/generations', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    modelId: modelId,
                    width: request.width || 512,
                    height: request.height || 512,
                    num_images: request.numImages || 1,
                    quality: request.quality || 'STANDARD',
                    style: request.style,
                    guidance_scale: request.guidanceScale || 7,
                    init_strength: request.initStrength,
                    promptMagic: request.promptMagic !== false,
                    imagePrompts: request.inputImage ? [{ image: request.inputImage, weight: 0.5 }] : undefined
                })
            });

            // Leonardo returns generationJob, we need to poll for results
            const generationId = response.sdGenerationJob?.generationId || '';

            return {
                success: true,
                assetId: generationId,
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/status/${generationId}`,
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
    // Sprite Generation
    // ========================================================================

    /**
     * Generate a game sprite
     */
    async generateSprite(request: Generate2DRequest & LeonardoSpriteParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const spritePrompt = this.buildSpritePrompt(request);

            const response = await this.request<{ sdGenerationJob: LeonardoGenerationJob }>('/generations', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: spritePrompt,
                    negative_prompt: `blurry, low quality, distorted, ${request.negativePrompt || ''}`,
                    modelId: LEONARDO_MODELS.LEONARDO_DIFFUSION,
                    width: request.size || 512,
                    height: request.size || 512,
                    num_images: 1,
                    quality: 'STANDARD',
                    guidance_scale: 8,
                    promptMagic: true
                })
            });

            return {
                success: true,
                assetId: response.sdGenerationJob?.generationId || '',
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/status/${response.sdGenerationJob?.generationId}`,
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
     * Build optimized prompt for sprite generation
     */
    private buildSpritePrompt(request: LeonardoSpriteParams): string {
        const parts: string[] = [];

        parts.push('game sprite');

        if (request.spriteType) {
            parts.push(request.spriteType);
        }

        if (request.view) {
            parts.push(`${request.view} view`);
        }

        parts.push(request.prompt);

        if (request.style === 'pixel') {
            parts.push('pixel art style');
        } else if (request.style === 'vector') {
            parts.push('vector art style');
        } else if (request.style === 'painted') {
            parts.push('hand painted style');
        }

        parts.push('transparent background');
        parts.push('high quality');

        return parts.join(', ');
    }

    // ========================================================================
    // Sprite Sheet Generation
    // ========================================================================

    /**
     * Generate a sprite sheet with multiple frames
     */
    async generateSpriteSheet(request: LeonardoSpriteSheetParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const prompt = `sprite sheet of ${request.subject}, ${request.animation || 'idle animation'}, ${request.frames || 4} frames arranged in a grid, ${request.style || 'pixel art'} style, transparent background`;

            // Calculate dimensions based on frame size and count
            const frameSize = request.frameSize || 64;
            const columns = request.columns || 4;
            const rows = Math.ceil((request.frames || 4) / columns);
            const width = frameSize * columns;
            const height = frameSize * rows;

            const response = await this.request<{ sdGenerationJob: LeonardoGenerationJob }>('/generations', {
                method: 'POST',
                body: JSON.stringify({
                    prompt,
                    modelId: LEONARCO_MODELS_FOR_PIXEL,
                    width,
                    height,
                    num_images: 1,
                    quality: 'STANDARD',
                    guidance_scale: 7
                })
            });

            return {
                success: true,
                assetId: response.sdGenerationJob?.generationId || '',
                status: 'processing',
                estimatedTimeSeconds: 45,
                pollUrl: `/api/v1/assets/2d/status/${response.sdGenerationJob?.generationId}`,
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
    // UI Element Generation
    // ========================================================================

    /**
     * Generate UI elements (icons, buttons, panels)
     */
    async generateUIElement(request: LeonardoUIParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const prompt = this.buildUIPrompt(request);

            const size = request.size || 256;

            const response = await this.request<{ sdGenerationJob: LeonardoGenerationJob }>('/generations', {
                method: 'POST',
                body: JSON.stringify({
                    prompt,
                    modelId: LEONARDO_MODELS.ILLUSTRATION,
                    width: size,
                    height: request.elementType === 'button' || request.elementType === 'slider' ? size / 2 : size,
                    num_images: 1,
                    quality: 'STANDARD',
                    guidance_scale: 8,
                    promptMagic: true
                })
            });

            return {
                success: true,
                assetId: response.sdGenerationJob?.generationId || '',
                status: 'processing',
                estimatedTimeSeconds: 20,
                pollUrl: `/api/v1/assets/2d/status/${response.sdGenerationJob?.generationId}`,
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

    private buildUIPrompt(request: LeonardoUIParams): string {
        const parts = [
            'game UI',
            request.elementType,
            request.description || '',
            request.style || 'modern minimalist',
            'transparent background',
            'high quality'
        ];

        if (request.colorScheme) {
            parts.push(`${request.colorScheme} color scheme`);
        }

        return parts.filter(Boolean).join(', ');
    }

    // ========================================================================
    // Concept Art Generation
    // ========================================================================

    /**
     * Generate concept art for game development
     */
    async generateConceptArt(request: LeonardoConceptArtParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const modelId = request.style === 'realistic'
                ? LEONARDO_MODELS.ABSOLUTE_REALITY
                : LEONARDO_MODELS.LEONARDO_CREATIVE;

            const prompt = `concept art for a game, ${request.subject}, ${request.mood || 'epic'}, ${request.style || 'digital painting'} style, ${request.aspectRatio || '16:9'}`;

            const response = await this.request<{ sdGenerationJob: LeonardoGenerationJob }>('/generations', {
                method: 'POST',
                body: JSON.stringify({
                    prompt,
                    modelId,
                    width: request.width || 1920,
                    height: request.height || 1080,
                    num_images: request.numImages || 1,
                    quality: 'HIGH',
                    guidance_scale: request.guidanceScale || 7,
                    promptMagic: true
                })
            });

            return {
                success: true,
                assetId: response.sdGenerationJob?.generationId || '',
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/2d/status/${response.sdGenerationJob?.generationId}`,
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
    // AI Canvas (Image Editing)
    // ========================================================================

    /**
     * Edit an image using Leonardo AI Canvas
     */
    async editImage(request: LeonardoEditParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<{ canvasEdit: LeonardoCanvasEdit }>('/edit-image', {
                method: 'POST',
                body: JSON.stringify({
                    image: request.image,
                    mask: request.mask,
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    init_strength: request.initStrength || 0.6,
                    guidance_scale: request.guidanceScale || 7
                })
            });

            return {
                success: true,
                assetId: response.canvasEdit?.id || '',
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/edit-status/${response.canvasEdit?.id}`,
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
     * Remove background from an image
     */
    async removeBackground(image: string): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<{ id: string; status: string; url?: string }>('/remove-background', {
                method: 'POST',
                body: JSON.stringify({ image })
            });

            return {
                success: true,
                assetId: response.id,
                status: response.status === 'complete' ? 'completed' : 'processing',
                estimatedTimeSeconds: 10,
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
    // Task Status
    // ========================================================================

    /**
     * Check generation status
     */
    async getGenerationStatus(generationId: string): Promise<LeonardoGenerationStatus> {
        return this.request<LeonardoGenerationStatus>(`/generations/${generationId}`);
    }

    /**
     * Get generated images by generation ID
     */
    async getGeneratedImages(generationId: string): Promise<LeonardoGeneratedImage[]> {
        const status = await this.getGenerationStatus(generationId);
        return status.generations_by_pk.generated_images || [];
    }

    /**
     * Download generated image
     */
    async downloadImage(imageUrl: string): Promise<Blob> {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
        }
        return response.blob();
    }

    // ========================================================================
    // Upscaling
    // ========================================================================

    /**
     * Upscale an image
     */
    async upscaleImage(
        image: string,
        scale: 1 | 2 | 4 = 2
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<{ upscaled: { id: string; url: string } }>('/upscale', {
                method: 'POST',
                body: JSON.stringify({
                    image,
                    scale
                })
            });

            return {
                success: true,
                assetId: response.upscaled.id,
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
    // Validation
    // ========================================================================

    /**
     * Validate generation request
     */
    validateRequest(request: Generate2DRequest & Partial<LeonardoGenerateParams>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!request.prompt || request.prompt.length < 10) {
            errors.push('Prompt must be at least 10 characters');
        }

        if (request.prompt && request.prompt.length > 1000) {
            errors.push('Prompt must not exceed 1000 characters');
        }

        if (request.width && ![128, 192, 256, 384, 512, 768, 1024, 1920].includes(request.width)) {
            errors.push('Width must be one of: 128, 192, 256, 384, 512, 768, 1024, 1920');
        }

        if (request.height && ![128, 192, 256, 384, 512, 768, 1024, 1080].includes(request.height)) {
            errors.push('Height must be one of: 128, 192, 256, 384, 512, 768, 1024, 1080');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: Generate2DRequest & Partial<LeonardoGenerateParams>): number {
        // Leonardo is subscription-based
        // Estimate based on image size and quality
        const pixelCount = (request.width || 512) * (request.height || 512);
        const baseCost = 0.001; // per 1000 pixels
        const qualityMultiplier = request.quality === 'HIGH' ? 2 : 1;

        const numImages = request.numImages || 1;

        return (pixelCount / 1000) * baseCost * qualityMultiplier * numImages;
    }

    /**
     * Get quota usage
     */
    async getQuotaUsage(): Promise<{
        imageCount: number;
        remainingImages: number;
        subscription: string;
    }> {
        try {
            const data = await this.request<{
                apiSubscription: { subscriptionType: string };
                imageGenerations: { remaining: number };
            }>('/me');

            return {
                imageCount: 0,
                remainingImages: data.imageGenerations?.remaining || 0,
                subscription: data.apiSubscription?.subscriptionType || 'unknown'
            };
        } catch {
            return {
                imageCount: 0,
                remainingImages: 0,
                subscription: 'unknown'
            };
        }
    }
}

// ============================================================================
// Constants
// ============================================================================

const LEONARCO_MODELS_FOR_PIXEL = 'bd5cb2fe-2c89-4a29-b519-22f02e78f3e5'; // 3D Anime works well for sprites

// ============================================================================
// Type Definitions
// ============================================================================

export interface LeonardoGenerateParams {
    modelId?: string;
    quality?: 'STANDARD' | 'HIGH';
    guidanceScale?: number;
    initStrength?: number;
    promptMagic?: boolean;
    inputImage?: string;
    style?: string;
}

export interface LeonardoSpriteParams {
    spriteType?: string;
    view?: 'front' | 'side' | 'top' | 'back' | 'isometric';
    style?: 'pixel' | 'vector' | 'painted' | 'realistic';
    size?: 256 | 512 | 768;
}

export interface LeonardoSpriteSheetParams {
    subject: string;
    animation?: string;
    frames?: number;
    frameSize?: 32 | 64 | 128 | 256;
    columns?: number;
    style?: string;
}

export interface LeonardoUIParams {
    elementType: 'button' | 'panel' | 'window' | 'icon' | 'slider' | 'checkbox' | 'dropdown';
    description?: string;
    style?: string;
    colorScheme?: string;
    size?: 128 | 256 | 512;
}

export interface LeonardoConceptArtParams {
    subject: string;
    mood?: string;
    style?: string;
    width?: number;
    height?: number;
    numImages?: number;
    guidanceScale?: number;
    aspectRatio?: string;
}

export interface LeonardoEditParams {
    image: string;
    mask?: string;
    prompt: string;
    negativePrompt?: string;
    initStrength?: number;
    guidanceScale?: number;
}

export interface LeonardoPlatform {
    id: string;
    platform: string;
    platform_label: string;
}

export interface LeonardoModel {
    id: string;
    name: string;
    description: string;
    type: string;
}

export interface LeonardoGenerationJob {
    generationId: string;
    status: string;
}

export interface LeonardoGenerationStatus {
    generations_by_pk: {
        id: string;
        status: string;
        generated_images: LeonardoGeneratedImage[];
    };
}

export interface LeonardoGeneratedImage {
    id: string;
    generated_image: string;
    url: string;
}

export interface LeonardoCanvasEdit {
    id: string;
    url: string;
    status: string;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLeonardoProvider(config: LeonardoConfig): LeonardoProvider {
    return new LeonardoProvider(config);
}

// ============================================================================
// Exports
// ============================================================================

export { LEONARDO_MODELS };
