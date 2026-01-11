/**
 * Scenario.gg Provider Integration
 * Style models for consistent game art
 *
 * API Docs: https://docs.scenario.com
 */

import {
    ScenarioConfig,
    ScenarioTrainResponse,
    ScenarioGenerateResponse,
    Generate2DRequest,
    TrainStyleModelRequest,
    GenerationResponse,
    Art2DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.scenario.com/v1';

// ============================================================================
// Scenario.gg Provider Class
// ============================================================================

export class ScenarioProvider {
    private config: ScenarioConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private styleCache: Map<string, ScenarioStyleModel>;

    constructor(config: ScenarioConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 20;
        this.rateLimitResetAt = Date.now() + 60000;
        this.styleCache = new Map();
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 20;
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
            throw new Error(`Scenario API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Style Model Management
    // ========================================================================

    /**
     * Get all style models for the account
     */
    async getStyleModels(): Promise<ScenarioStyleModel[]> {
        try {
            const response = await this.request<{ models: ScenarioStyleModel[] }>('/models');
            // Cache the models
            response.models.forEach(model => {
                this.styleCache.set(model.id, model);
            });
            return response.models;
        } catch {
            return [];
        }
    }

    /**
     * Get a specific style model
     */
    async getStyleModel(modelId: string): Promise<ScenarioStyleModel | null> {
        if (this.styleCache.has(modelId)) {
            return this.styleCache.get(modelId)!;
        }

        try {
            return await this.request<ScenarioStyleModel>(`/models/${modelId}`, {}, true);
        } catch {
            return null;
        }
    }

    /**
     * Train a new style model
     */
    async trainStyleModel(request: TrainStyleModelRequest & ScenarioTrainParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            // Upload training images first
            const imageUrls: string[] = [];

            for (let i = 0; i < request.trainingImages.length; i++) {
                const image = request.trainingImages[i];
                try {
                    const uploadedUrl = await this.uploadImage(image, `${request.name}_training_${i}`);
                    imageUrls.push(uploadedUrl);
                } catch (e) {
                    console.error(`Failed to upload training image ${i}:`, e);
                }
            }

            if (imageUrls.length === 0) {
                return {
                    success: false,
                    error: 'No training images could be uploaded',
                    requestId
                };
            }

            const response = await this.request<ScenarioTrainResponse>('/models/train', {
                method: 'POST',
                body: JSON.stringify({
                    name: request.name,
                    description: request.description || '',
                    images: imageUrls,
                    type: request.styleType || 'environment',
                    trigger_word: request.triggerWord,
                    steps: request.steps || 1000,
                    resolution: request.resolution || 512
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: response.status === 'ready' ? 'completed' : 'processing',
                estimatedTimeSeconds: 1800, // 30 minutes for training
                pollUrl: `/api/v1/assets/style/status/${response.id}`,
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
     * Get training status
     */
    async getTrainingStatus(modelId: string): Promise<ScenarioTrainResponse> {
        return this.request<ScenarioTrainResponse>(`/models/${modelId}/training-status`, {}, true);
    }

    // ========================================================================
    // Image Generation
    // ========================================================================

    /**
     * Generate images using a style model
     */
    async generateImage(request: Generate2DRequest & ScenarioGenerateParams): Promise<GenerationResponse> {
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
            const modelId = request.styleModelId || await this.getDefaultModelId();

            const response = await this.request<ScenarioGenerateResponse>('/images/generate', {
                method: 'POST',
                body: JSON.stringify({
                    model_id: modelId,
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt || 'blurry, low quality',
                    width: request.width || 512,
                    height: request.height || 512,
                    samples: request.numImages || 1,
                    steps: request.steps || 30,
                    cfg_scale: request.cfgScale || 7,
                    seed: request.seed,
                    image_strength: request.imageStrength
                })
            });

            return {
                success: true,
                assetId: response.images[0]?.url || requestId,
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
     * Generate using image-to-image
     */
    async generateFromImage(
        inputImage: string,
        request: Omit<Generate2DRequest & ScenarioGenerateParams, 'inputImage'>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const modelId = request.styleModelId || await this.getDefaultModelId();

            const response = await this.request<ScenarioGenerateResponse>('/images/img2img', {
                method: 'POST',
                body: JSON.stringify({
                    model_id: modelId,
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt || 'blurry, low quality',
                    image: inputImage,
                    width: request.width || 512,
                    height: request.height || 512,
                    samples: request.numImages || 1,
                    steps: request.steps || 30,
                    cfg_scale: request.cfgScale || 7,
                    image_strength: request.imageStrength || 0.75
                })
            });

            return {
                success: true,
                assetId: response.images[0]?.url || requestId,
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
     * Generate using inpainting
     */
    async inpaint(
        inputImage: string,
        maskImage: string,
        prompt: string,
        options?: Partial<ScenarioGenerateParams>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const modelId = options?.styleModelId || await this.getDefaultModelId();

            const response = await this.request<ScenarioGenerateResponse>('/images/inpaint', {
                method: 'POST',
                body: JSON.stringify({
                    model_id: modelId,
                    prompt,
                    negative_prompt: options?.negativePrompt || 'blurry, low quality',
                    image: inputImage,
                    mask: maskImage,
                    samples: 1,
                    steps: options?.steps || 30,
                    cfg_scale: options?.cfgScale || 7
                })
            });

            return {
                success: true,
                assetId: response.images[0]?.url || requestId,
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
    // Batch Generation
    // ========================================================================

    /**
     * Generate multiple images in a batch
     */
    async batchGenerate(
        requests: Array<Generate2DRequest & ScenarioGenerateParams>
    ): Promise<GenerationResponse[]> {
        const results = await Promise.allSettled(
            requests.map(req => this.generateImage(req))
        );

        return results.map((result, index) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                success: false,
                error: result.reason?.message || 'Batch generation failed',
                requestId: requests[index].prompt.slice(0, 36)
            };
        });
    }

    /**
     * Generate a sprite sheet from a style model
     */
    async generateSpriteSheet(
        request: ScenarioSpriteSheetParams
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const modelId = request.styleModelId || await this.getDefaultModelId();

            const prompt = `sprite sheet of ${request.subject}, ${request.animation || 'idle animation'}, ${request.frames} frames arranged ${request.arrangement || 'horizontal'}, pixel art style, transparent background`;

            // Calculate dimensions
            const frameSize = request.frameSize || 64;
            const frames = request.frames || 4;
            let width = frameSize;
            let height = frameSize;

            if (request.arrangement === 'horizontal') {
                width = frameSize * frames;
            } else if (request.arrangement === 'vertical') {
                height = frameSize * frames;
            } else {
                // grid
                const cols = Math.ceil(Math.sqrt(frames));
                const rows = Math.ceil(frames / cols);
                width = frameSize * cols;
                height = frameSize * rows;
            }

            const response = await this.request<ScenarioGenerateResponse>('/images/generate', {
                method: 'POST',
                body: JSON.stringify({
                    model_id: modelId,
                    prompt,
                    width,
                    height,
                    samples: 1,
                    steps: request.steps || 30,
                    cfg_scale: request.cfgScale || 7
                })
            });

            return {
                success: true,
                assetId: response.images[0]?.url || requestId,
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
    // Helper Methods
    // ========================================================================

    /**
     * Upload an image to Scenario
     */
    private async uploadImage(image: string, filename: string): Promise<string> {
        let imageBody = image;
        if (image.startsWith('data:')) {
            imageBody = image.split(',')[1];
        }

        const byteString = atob(imageBody);
        const array = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            array[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([array], { type: 'image/png' });

        const formData = new FormData();
        formData.append('file', blob, filename);

        const response = await fetch(`${this.config.endpoint}/images/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        return data.url;
    }

    /**
     * Get the default style model ID
     */
    private async getDefaultModelId(): Promise<string> {
        const models = await this.getStyleModels();
        return models[0]?.id || '';
    }

    /**
     * Validate request
     */
    validateRequest(request: Generate2DRequest & Partial<ScenarioGenerateParams>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!request.prompt || request.prompt.length < 10) {
            errors.push('Prompt must be at least 10 characters');
        }

        if (request.prompt && request.prompt.length > 500) {
            errors.push('Prompt must not exceed 500 characters');
        }

        if (request.steps !== undefined && (request.steps < 10 || request.steps > 150)) {
            errors.push('Steps must be between 10 and 150');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: Generate2DRequest & Partial<ScenarioGenerateParams>): number {
        // Scenario pricing (estimated)
        // Per-image cost varies by subscription tier
        const baseCost = 0.02;
        const stepMultiplier = (request.steps || 30) / 30;
        const imageCount = request.numImages || 1;

        return baseCost * stepMultiplier * imageCount;
    }

    /**
     * Get quota usage
     */
    async getQuotaUsage(): Promise<{
        imagesUsed: number;
        imagesLimit: number;
        modelsUsed: number;
        modelsLimit: number;
    }> {
        try {
            const data = await this.request<{
                quota: {
                    images_used: number;
                    images_limit: number;
                    models_used: number;
                    models_limit: number;
                };
            }>('/account/quota', {}, true);

            return {
                imagesUsed: data.quota.images_used,
                imagesLimit: data.quota.images_limit,
                modelsUsed: data.quota.models_used,
                modelsLimit: data.quota.models_limit
            };
        } catch {
            return {
                imagesUsed: 0,
                imagesLimit: 1000,
                modelsUsed: 0,
                modelsLimit: 10
            };
        }
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface ScenarioStyleModel {
    id: string;
    name: string;
    description: string;
    type: string;
    status: string;
    thumbnail?: string;
    created_at: string;
    trigger_word?: string;
}

export interface ScenarioGenerateParams {
    styleModelId?: string;
    steps?: number;
    cfgScale?: number;
    seed?: number;
    imageStrength?: number;
}

export interface ScenarioTrainParams {
    steps?: number;
    resolution?: 256 | 512 | 768;
}

export interface ScenarioSpriteSheetParams {
    subject: string;
    animation?: string;
    frames: number;
    frameSize?: 32 | 64 | 128 | 256;
    arrangement?: 'horizontal' | 'vertical' | 'grid';
    styleModelId?: string;
    steps?: number;
    cfgScale?: number;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createScenarioProvider(config: ScenarioConfig): ScenarioProvider {
    return new ScenarioProvider(config);
}
