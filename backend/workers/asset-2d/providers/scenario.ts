/**
 * Scenario.gg Provider
 * Specializes in style-consistent game asset generation
 * Uses custom trained style models for consistent output
 * API: https://docs.scenario.com
 * Website: https://scenario.com
 */

import type {
    ScenarioConfig,
    ScenarioResponse,
    ScenarioInferenceRequest,
    ScenarioStyleModel,
    GenerateSpriteRequest,
    GenerateSpriteSheetRequest,
    GenerateUIRequest,
    GenerateTilesetRequest,
    GenerationResponse,
    StyleTrainRequest,
    SpriteMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.scenario.com';

const SCENARIO_ENGINES = [
    'stable-diffusion-xl',
    'stable-diffusion-xl-lightning',
    'stable-diffusion-2.1'
] as const;

type ScenarioEngine = typeof SCENARIO_ENGINES[number];

export class ScenarioProvider {
    private config: Required<ScenarioConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private cachedStyleModels: Map<string, ScenarioStyleModel[]> = new Map();

    constructor(config: ScenarioConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 2,
            defaultStyleModel: config.defaultStyleModel || '',
            customStyleModels: config.customStyleModels || [],
            enableTraining: config.enableTraining ?? true,
            rateLimit: config.rateLimit || { requestsPerMinute: 30, requestsPerDay: 500 }
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
            const errorText = await response.text();
            let errorMessage = `Scenario API error: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage += ` - ${errorJson.error || errorJson.message || errorText}`;
            } catch {
                errorMessage += ` - ${errorText}`;
            }
            throw new Error(errorMessage);
        }
        return response.json() as Promise<T>;
    }

    /**
     * Generate a sprite using a style model
     */
    async generateSprite(request: GenerateSpriteRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const styleModel = request.tags?.find(t => t.startsWith('style:'))?.substring(6)
                || this.config.defaultStyleModel;

            if (!styleModel) {
                throw new Error('No style model specified. Use a style tag or configure defaultStyleModel');
            }

            const inferenceRequest: ScenarioInferenceRequest = {
                type: 'text-to-image',
                prompt: request.prompt,
                negative: request.negativePrompt || 'ugly, blurry, low quality',
                style: styleModel,
                width: request.width || 512,
                height: request.height || 512,
                samples: 1,
                steps: 30,
                strength: 1
            };

            const response = await this.request<ScenarioResponse>('/v1/models/inference', {
                method: 'POST',
                body: JSON.stringify(inferenceRequest)
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 25,
                pollUrl: `/api/v1/assets/2d/scenario/status/${response.id}`,
                requestId,
                provider: 'scenario',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Generate using image-to-image (style transfer)
     */
    async imageToImage(
        request: GenerateSpriteRequest & { inputImage: string },
        styleModel?: string,
        strength: number = 0.7
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const style = styleModel || this.config.defaultStyleModel;

            const inferenceRequest: ScenarioInferenceRequest = {
                type: 'image-to-image',
                prompt: request.prompt,
                negative: request.negativePrompt || 'ugly, blurry',
                style: style || '',
                width: request.width || 512,
                height: request.height || 512,
                samples: 1,
                steps: 25,
                strength,
                image: request.inputImage
            };

            const response = await this.request<ScenarioResponse>('/v1/models/inference', {
                method: 'POST',
                body: JSON.stringify(inferenceRequest)
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/scenario/status/${response.id}`,
                requestId,
                provider: 'scenario',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Generate a sprite sheet
     */
    async generateSpriteSheet(request: GenerateSpriteSheetRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const styleModel = request.tags?.find(t => t.startsWith('style:'))?.substring(6)
                || this.config.defaultStyleModel;

            if (!styleModel) {
                throw new Error('No style model specified');
            }

            // Generate each animation separately
            const animationRequests = request.animations.map(anim => {
                const animPrompt = `${request.prompt}, ${anim.type} animation frame, game sprite`;
                return this.request<ScenarioResponse>('/v1/models/inference', {
                    method: 'POST',
                    body: JSON.stringify({
                        type: 'text-to-image',
                        prompt: animPrompt,
                        negative: request.negativePrompt || 'ugly',
                        style: styleModel,
                        width: request.frameWidth || 64,
                        height: request.frameHeight || 64,
                        samples: anim.frames || request.framesPerAnimation || 4,
                        steps: 25
                    })
                });
            });

            const responses = await Promise.all(animationRequests);
            const batchId = crypto.randomUUID();

            return {
                success: true,
                assetId: batchId,
                status: 'processing',
                estimatedTimeSeconds: request.animations.length * 25,
                requestId,
                provider: 'scenario',
                costUsd: this.estimateSpriteSheetCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Generate UI icons with style consistency
     */
    async generateUIIcon(request: GenerateUIRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const styleModel = request.consistencyKey
                || this.config.defaultStyleModel;

            if (!styleModel) {
                throw new Error('No style model specified for consistent UI generation');
            }

            const prompt = this.buildUIPrompt(request);
            const batchCount = request.batch ? Math.min(request.batchCount || 4, 8) : 1;

            const inferenceRequest: ScenarioInferenceRequest = {
                type: 'text-to-image',
                prompt,
                negative: 'detailed, realistic, photograph, ugly',
                style: styleModel,
                width: request.size || 512,
                height: request.size || 512,
                samples: batchCount,
                steps: 20,
                strength: 1
            };

            const response = await this.request<ScenarioResponse>('/v1/models/inference', {
                method: 'POST',
                body: JSON.stringify(inferenceRequest)
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 20,
                pollUrl: `/api/v1/assets/2d/scenario/status/${response.id}`,
                requestId,
                provider: 'scenario',
                costUsd: 0.008
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Generate a tileset for game environments
     */
    async generateTileset(request: GenerateTilesetRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const styleModel = request.tags?.find(t => t.startsWith('style:'))?.substring(6)
                || this.config.defaultStyleModel;

            if (!styleModel) {
                throw new Error('No style model specified');
            }

            const tileSize = request.tileSize || 32;
            const tilesWide = request.tilesWide || 8;
            const tilesHigh = request.tilesHigh || 8;

            // Generate a grid of tiles
            const prompt = `game tileset, ${request.prompt}, ${request.style || 'top_down'} view, seamless tiles, grid layout`;

            const inferenceRequest: ScenarioInferenceRequest = {
                type: 'text-to-image',
                prompt,
                negative: 'photorealistic, messy, non-seamless',
                style: styleModel,
                width: tileSize * tilesWide,
                height: tileSize * tilesHigh,
                samples: request.includeVariations ? 4 : 1,
                steps: 30
            };

            const response = await this.request<ScenarioResponse>('/v1/models/inference', {
                method: 'POST',
                body: JSON.stringify(inferenceRequest)
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 35,
                pollUrl: `/api/v1/assets/2d/scenario/status/${response.id}`,
                requestId,
                provider: 'scenario',
                costUsd: 0.045
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Get available style models
     */
    async getStyleModels(): Promise<ScenarioStyleModel[]> {
        if (this.cachedStyleModels.has('all')) {
            return this.cachedStyleModels.get('all')!;
        }

        try {
            const response = await this.request<{ models: ScenarioStyleModel[] }>('/v1/models');
            const models = response.models || [];
            this.cachedStyleModels.set('all', models);

            // Filter to include custom style models
            const customModels = this.config.customStyleModels;
            if (customModels.length > 0) {
                return models.filter(m => customModels.includes(m.id));
            }

            return models;
        } catch (error) {
            console.error('Failed to fetch style models:', error);
            return [];
        }
    }

    /**
     * Get a specific style model by ID
     */
    async getStyleModel(modelId: string): Promise<ScenarioStyleModel | null> {
        try {
            return await this.request<ScenarioStyleModel>(`/v1/models/${modelId}`);
        } catch {
            return null;
        }
    }

    /**
     * Create a new style model (train)
     */
    async createStyleModel(request: StyleTrainRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        if (request.provider !== 'scenario') {
            return {
                success: false,
                error: 'Provider must be scenario for style training',
                requestId,
                provider: 'scenario'
            };
        }

        if (!this.config.enableTraining) {
            return {
                success: false,
                error: 'Style training is not enabled',
                requestId,
                provider: 'scenario'
            };
        }

        try {
            const response = await this.request<{ id: string; status: string }>('/v1/models', {
                method: 'POST',
                body: JSON.stringify({
                    name: request.name,
                    images: request.images,
                    description: request.styleDescription,
                    triggerWord: request.triggerWord,
                    strength: request.strength || 0.7
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 300, // 5 minutes average
                pollUrl: `/api/v1/assets/2d/scenario/training/${response.id}`,
                requestId,
                provider: 'scenario',
                costUsd: 5.00
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Get training status for a style model
     */
    async getTrainingStatus(modelId: string): Promise<{ id: string; status: string; progress: number }> {
        return this.request<{ id: string; status: string; progress: number }>(`/v1/models/${modelId}/training`);
    }

    /**
     * Get generation status
     */
    async getGenerationStatus(taskId: string): Promise<ScenarioResponse> {
        return this.request<ScenarioResponse>(`/v1/models/inference/${taskId}`);
    }

    /**
     * Wait for generation to complete
     */
    async waitForGeneration(taskId: string, timeoutMs: number = 180000): Promise<ScenarioResponse> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getGenerationStatus(taskId);
            if (status.status === 'succeeded' || status.status === 'failed') {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        throw new Error('Generation timeout');
    }

    /**
     * Download generated image(s)
     */
    async downloadImages(taskId: string): Promise<Blob[]> {
        const status = await this.waitForGeneration(taskId);
        if (status.status !== 'succeeded' || (!status.images && !status.image_url)) {
            throw new Error('Generation not completed or no images available');
        }

        const urls = status.images || [status.image_url!];
        const blobs: Blob[] = [];

        for (const url of urls) {
            const response = await fetch(url);
            if (response.ok) {
                blobs.push(await response.blob());
            }
        }

        return blobs;
    }

    /**
     * Upscale an image using the style model
     */
    async upscale(
        imageId: string,
        styleModel: string,
        scale: 2 | 4 = 2
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<ScenarioResponse>('/v1/models/inference', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'upscale',
                    style: styleModel,
                    image: imageId,
                    scale
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 15,
                requestId,
                provider: 'scenario',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Inpaint (edit part of an image)
     */
    async inpaint(
        image: string,
        mask: string,
        prompt: string,
        styleModel: string
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<ScenarioResponse>('/v1/models/inference', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'inpainting',
                    prompt,
                    style: styleModel,
                    image,
                    mask,
                    width: 512,
                    height: 512
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: this.mapStatus(response.status),
                estimatedTimeSeconds: 25,
                requestId,
                provider: 'scenario',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'scenario'
            };
        }
    }

    /**
     * Check if provider is available
     */
    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }

    /**
     * Extract metadata from generation
     */
    async extractMetadata(taskId: string): Promise<SpriteMetadata> {
        const status = await this.getGenerationStatus(taskId);
        if (status.status !== 'succeeded') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        return {
            format: 'png',
            width: 512,
            height: 512,
            frameCount: 1,
            hasTransparency: false,
            colorDepth: 32,
            isAnimated: false,
            fileSizeBytes: 0,
            previewImageUrl: status.image_url,
            godotCompatible: true
        };
    }

    // Private helper methods

    private buildUIPrompt(request: GenerateUIRequest): string {
        let prompt = `UI icon: ${request.prompt}, ${request.style || 'minimal'} style, flat design`;
        if (request.colorScheme && request.colorScheme.length > 0) {
            prompt += `, colors: ${request.colorScheme.join(', ')}`;
        }
        if (request.category) {
            prompt += `, ${request.category} icon`;
        }
        if (request.stroke?.enabled) {
            prompt += ', outline icon';
        }
        return prompt;
    }

    private mapStatus(status: string): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
        const statusMap: Record<string, 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'> = {
            'pending': 'pending',
            'processing': 'processing',
            'succeeded': 'completed',
            'failed': 'failed',
            'cancelled': 'cancelled'
        };
        return statusMap[status] || 'pending';
    }

    private estimateCost(request: GenerateSpriteRequest): number {
        const baseCost = 0.015;
        const resolution = (request.width || 512) * (request.height || 512);
        const resolutionMultiplier = resolution / (512 * 512);
        return Math.round(baseCost * resolutionMultiplier * 1000) / 1000;
    }

    private estimateSpriteSheetCost(request: GenerateSpriteSheetRequest): number {
        const baseCost = this.estimateCost(request);
        const animationCount = request.animations.length;
        return Math.round(baseCost * animationCount * 3 * 1000) / 1000;
    }
}

export function createScenarioProvider(config: ScenarioConfig): ScenarioProvider {
    return new ScenarioProvider(config);
}
