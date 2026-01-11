/**
 * Leonardo AI Provider
 * Specializes in sprites, UI icons, and concept art
 * API: https://docs.leonardo.ai
 * Website: https://leonardo.ai
 */

import type {
    LeonardoConfig,
    LeonardoResponse,
    LeonardoImage,
    LeonardoGenerationRequest,
    LeonardoSpriteRequest,
    GenerateSpriteRequest,
    GenerateSpriteSheetRequest,
    GenerateUIRequest,
    GenerateConceptRequest,
    GenerationResponse,
    SpriteMetadata,
    SpriteSheetMetadata,
    UIMetadata,
    ConceptMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://cloud.leonardo.ai/api/rest/v1';

const LEONARDO_MODELS = [
    'leonardo-v2',
    'leonardo-v3',
    'kino-xl',
    'phoenix-v3',
    'rpg-v4',
    '3d-animation-style',
    'absolute-reality',
    'albedo-base-xl',
    'anime-pastel-dream'
] as const;

const LEONARDO_RESOLUTIONS = [
    '512x512',
    '768x1024',
    '1024x768',
    '1024x1024',
    '1920x1080'
] as const;

type LeonardoModel = typeof LEONARDO_MODELS[number];
type LeonardoResolution = typeof LEONARDO_RESOLUTIONS[number];

export class LeonardoProvider {
    private config: Required<LeonardoConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private subscriptionTier: 'free' | 'basic' | 'pro' | 'enterprise';

    constructor(config: LeonardoConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 2,
            model: config.model || 'leonardo-v3',
            defaultResolution: config.defaultResolution || '1024x1024',
            enableFineTuning: config.enableFineTuning ?? true,
            finetuneModels: config.finetuneModels || [],
            rateLimit: config.rateLimit || { requestsPerMinute: 50, requestsPerDay: 1000 }
        };
        this.rateLimitRemaining = this.config.rateLimit.requestsPerMinute;
        this.rateLimitResetAt = Date.now() + 60000;
        this.subscriptionTier = this.detectSubscriptionTier();
    }

    private detectSubscriptionTier(): 'free' | 'basic' | 'pro' | 'enterprise' {
        // This would typically be determined by API key validation
        // For now, default to a tier based on configuration
        return 'basic';
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
            'Accept': 'application/json',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Leonardo API error: ${response.status}`;
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
     * Generate a sprite using Leonardo AI
     */
    async generateSprite(request: GenerateSpriteRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'leonardo'
            };
        }

        try {
            const genRequest = this.buildGenerationRequest(request);
            const response = await this.request<LeonardoResponse>('/generations', {
                method: 'POST',
                body: JSON.stringify(genRequest)
            });

            const generationId = response.sdGenerationJob?.generationId;
            if (!generationId) {
                throw new Error('No generation ID returned');
            }

            // Wait for generation to complete and get results
            const images = await this.waitForGeneration(generationId);

            return {
                success: true,
                assetId: generationId,
                status: 'completed',
                estimatedTimeSeconds: 20,
                requestId,
                provider: 'leonardo',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Generate a sprite sheet with animations
     */
    async generateSpriteSheet(request: GenerateSpriteSheetRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            // Generate each animation frame as a separate image
            // then combine them into a sprite sheet
            const framesPerAnimation = request.framesPerAnimation || 4;
            const totalFrames = request.animations.reduce((sum, anim) =>
                sum + (anim.frames || framesPerAnimation), 0);

            // For sprite sheets, we'll use the sprite generation mode
            const spriteRequest: LeonardoSpriteRequest = {
                ...this.buildGenerationRequest(request),
                mode: 'SPRITE',
                spriteConfig: {
                    frameCount: totalFrames,
                    animation: true,
                    columns: request.columns || Math.ceil(Math.sqrt(totalFrames)),
                    rows: request.rows || Math.ceil(Math.sqrt(totalFrames))
                }
            };

            const response = await this.request<LeonardoResponse>('/generations', {
                method: 'POST',
                body: JSON.stringify(spriteRequest)
            });

            const generationId = response.sdGenerationJob?.generationId;
            if (!generationId) {
                throw new Error('No generation ID returned');
            }

            return {
                success: true,
                assetId: generationId,
                status: 'processing',
                estimatedTimeSeconds: 45,
                pollUrl: `/api/v1/assets/2d/leonardo/status/${generationId}`,
                requestId,
                provider: 'leonardo',
                costUsd: this.estimateSpriteSheetCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Generate UI icons
     */
    async generateUIIcon(request: GenerateUIRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const size = request.size || 512;
            const prompt = this.buildUIPrompt(request);

            const genRequest: LeonardoGenerationRequest = {
                prompt,
                negative_prompt: 'detailed, shaded, realistic, photograph, 3d render',
                width: size,
                height: size,
                num_images: request.batch ? Math.min(request.batchCount || 4, 8) : 1,
                modelId: this.getModelForUI(request.style),
                sd_version: 'xl-v1-0-0',
                promptMagic: true,
                tiling: false
            };

            const response = await this.request<LeonardoResponse>('/generations', {
                method: 'POST',
                body: JSON.stringify(genRequest)
            });

            const generationId = response.sdGenerationJob?.generationId;
            if (!generationId) {
                throw new Error('No generation ID returned');
            }

            return {
                success: true,
                assetId: generationId,
                status: 'processing',
                estimatedTimeSeconds: 15,
                pollUrl: `/api/v1/assets/2d/leonardo/status/${generationId}`,
                requestId,
                provider: 'leonardo',
                costUsd: 0.005
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Generate concept art
     */
    async generateConcept(request: GenerateConceptRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const [width, height] = this.getDimensionsFromAspectRatio(request.aspectRatio || '16:9');
            const prompt = this.buildConceptPrompt(request);

            const genRequest: LeonardoGenerationRequest = {
                prompt,
                negative_prompt: 'ugly, poorly drawn, low quality',
                width,
                height,
                num_images: request.iterations || 1,
                modelId: this.getModelForConcept(request.style),
                sd_version: 'xl-v1-0-0',
                promptMagic: true
            };

            const response = await this.request<LeonardoResponse>('/generations', {
                method: 'POST',
                body: JSON.stringify(genRequest)
            });

            const generationId = response.sdGenerationJob?.generationId;
            if (!generationId) {
                throw new Error('No generation ID returned');
            }

            return {
                success: true,
                assetId: generationId,
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/leonardo/status/${generationId}`,
                requestId,
                provider: 'leonardo',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Generate using image-to-image (with reference image)
     */
    async imageToImage(
        request: GenerateSpriteRequest & { inputImage: string },
        strength: number = 0.7
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<{ sdGenerationJob: { generationId: string } }>('/generations', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt || '',
                    width: request.width || 512,
                    height: request.height || 512,
                    num_images: 1,
                    init_image: true,
                    init_image_url: request.inputImage,
                    init_strength: strength,
                    modelId: this.config.model,
                    sd_version: 'xl-v1-0-0'
                })
            });

            const generationId = response.sdGenerationJob.generationId;

            return {
                success: true,
                assetId: generationId,
                status: 'processing',
                estimatedTimeSeconds: 25,
                pollUrl: `/api/v1/assets/2d/leonardo/status/${generationId}`,
                requestId,
                provider: 'leonardo',
                costUsd: 0.015
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Upscale an image
     */
    async upscale(imageId: string, scale: 2 | 4 = 2): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<{ id: string }>(`/variations/${imageId}/upscale`, {
                method: 'POST',
                body: JSON.stringify({ scale })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 20,
                requestId,
                provider: 'leonardo',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Remove background from an image
     */
    async removeBackground(imageId: string): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<{ id: string }>(`/generations/${imageId}/remove-bg`, {
                method: 'POST'
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 10,
                requestId,
                provider: 'leonardo',
                costUsd: 0.005
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Get generation status
     */
    async getGenerationStatus(generationId: string): Promise<LeonardoResponse> {
        return this.request<LeonardoResponse>(`/generations/${generationId}`);
    }

    /**
     * Wait for generation to complete and return images
     */
    async waitForGeneration(generationId: string, timeoutMs: number = 120000): Promise<LeonardoImage[]> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const response = await this.getGenerationStatus(generationId);
            if (response.object?.images && response.object.images.length > 0) {
                return response.object.images;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Generation timeout');
    }

    /**
     * Get available models
     */
    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await this.request<{ custom_models: Array<{ id: string }> }>('/me');
            const customModels = response.custom_models?.map(m => m.id) || [];
            return [...LEONARDO_MODELS, ...customModels];
        } catch {
            return LEONARDO_MODELS as string[];
        }
    }

    /**
     * Create a fine-tuned model
     */
    async createFineTune(
        name: string,
        images: string[],
        description?: string
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            if (!this.config.enableFineTuning) {
                throw new Error('Fine-tuning is not enabled');
            }

            const response = await this.request<{ id: string; status: string }>('/models/training', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    description,
                    images,
                    instance_prompt: name.toLowerCase().replace(/\s+/g, '-'),
                    modelType: 'PETALISE'
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 300,
                requestId,
                provider: 'leonardo',
                costUsd: 2.00
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'leonardo'
            };
        }
    }

    /**
     * Download generated image
     */
    async downloadImage(generationId: string, imageId: string): Promise<Blob> {
        const images = await this.waitForGeneration(generationId);
        const image = images.find(img => img.id === imageId);
        if (!image) {
            throw new Error(`Image ${imageId} not found in generation ${generationId}`);
        }

        const response = await fetch(image.urlGenerated || image.url);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
        }
        return response.blob();
    }

    /**
     * Extract metadata from generation
     */
    async extractMetadata(
        generationId: string,
        type: 'sprite' | 'ui' | 'concept' = 'sprite'
    ): Promise<SpriteMetadata | UIMetadata | ConceptMetadata> {
        const images = await this.waitForGeneration(generationId);
        const image = images[0];
        if (!image) {
            throw new Error('No images found in generation');
        }

        // Get image dimensions
        const dimensions = await this.getImageDimensions(image.urlGenerated || image.url);

        if (type === 'ui') {
            return {
                format: 'png',
                width: dimensions.width,
                height: dimensions.height,
                style: 'minimal',
                hasTransparency: true,
                isScalable: false,
                fileSizeBytes: 0
            } as UIMetadata;
        }

        if (type === 'concept') {
            return {
                format: 'png',
                width: dimensions.width,
                height: dimensions.height,
                aspectRatio: this.getAspectRatio(dimensions.width, dimensions.height),
                style: 'default',
                iterationCount: images.length,
                fileSizeBytes: 0,
                previewUrl: image.urlGenerated || image.url
            } as ConceptMetadata;
        }

        return {
            format: 'png',
            width: dimensions.width,
            height: dimensions.height,
            frameCount: 1,
            hasTransparency: true,
            colorDepth: 32,
            isAnimated: false,
            fileSizeBytes: 0,
            previewImageUrl: image.urlGenerated || image.url,
            godotCompatible: true
        } as SpriteMetadata;
    }

    /**
     * Check if provider is available
     */
    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }

    /**
     * Validate request
     */
    validateRequest(request: GenerateSpriteRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!request.prompt || request.prompt.length < 5) {
            errors.push('Prompt must be at least 5 characters');
        }
        if (request.prompt && request.prompt.length > 1000) {
            errors.push('Prompt must not exceed 1000 characters');
        }
        if (request.width && (request.width < 64 || request.width > 1920)) {
            errors.push('Width must be between 64 and 1920');
        }
        if (request.height && (request.height < 64 || request.height > 1920)) {
            errors.push('Height must be between 64 and 1920');
        }
        return { valid: errors.length === 0, errors };
    }

    // Private helper methods

    private buildGenerationRequest(request: GenerateSpriteRequest): LeonardoGenerationRequest {
        const [width, height] = request.width && request.height
            ? [request.width, request.height]
            : this.getDimensionsFromResolution(this.config.defaultResolution);

        return {
            prompt: request.prompt,
            negative_prompt: request.negativePrompt || 'blurry, low quality',
            width,
            height,
            num_images: 1,
            modelId: this.config.model,
            sd_version: 'xl-v1-0-0',
            promptMagic: true,
            tiling: false
        };
    }

    private buildUIPrompt(request: GenerateUIRequest): string {
        let prompt = `UI icon: ${request.prompt}, ${request.style || 'minimal'} style`;
        if (request.colorScheme && request.colorScheme.length > 0) {
            prompt += `, colors: ${request.colorScheme.join(', ')}`;
        }
        if (request.stroke?.enabled) {
            prompt += request.stroke.width ? `, ${request.stroke.width}px outline` : ', outline';
            if (request.stroke.color) {
                prompt += ` ${request.stroke.color}`;
            }
        }
        if (request.consistencyKey) {
            prompt = `${request.consistencyKey} style - ${prompt}`;
        }
        return prompt;
    }

    private buildConceptPrompt(request: GenerateConceptRequest): string {
        let prompt = request.prompt;
        if (request.style) {
            prompt = `${request.style} style - ${prompt}`;
        }
        if (request.mood) {
            prompt += `, mood: ${request.mood}`;
        }
        if (request.forCharacter) {
            prompt += ', character design, full body, detailed';
        } else if (request.forEnvironment) {
            prompt += ', environment, landscape, detailed background';
        } else if (request.forItem) {
            prompt += ', item design, game asset, detailed';
        }
        return prompt;
    }

    private getModelForUI(style?: string): LeonardoModel {
        const styleModels: Record<string, LeonardoModel> = {
            'minimal': 'leonardo-v3',
            'outlined': 'leonardo-v3',
            'filled': 'leonardo-v3',
            'pixel': 'rpg-v4',
            'flat': 'leonardo-v3'
        };
        return styleModels[style || ''] || this.config.model;
    }

    private getModelForConcept(style?: string): LeonardoModel {
        const conceptModels: Record<string, LeonardoModel> = {
            'realistic': 'absolute-reality',
            'anime': 'anime-pastel-dream',
            '3d': '3d-animation-style',
            'rpg': 'rpg-v4'
        };
        return conceptModels[style || ''] || this.config.model;
    }

    private getDimensionsFromResolution(resolution: LeonardoResolution): [number, number] {
        const [width, height] = resolution.split('x').map(Number);
        return [width, height];
    }

    private getDimensionsFromAspectRatio(aspectRatio: string): [number, number] {
        const ratioMap: Record<string, [number, number]> = {
            '1:1': [1024, 1024],
            '16:9': [1344, 768],
            '9:16': [768, 1344],
            '4:3': [1024, 768],
            '3:4': [768, 1024],
            '21:9': [1536, 640]
        };
        return ratioMap[aspectRatio] || [1024, 768];
    }

    private getAspectRatio(width: number, height: number): string {
        const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
        const divisor = gcd(width, height);
        return `${width / divisor}:${height / divisor}`;
    }

    private async getImageDimensions(url: string): Promise<{ width: number; height: number }> {
        // Default dimensions if we can't load the image
        return { width: 512, height: 512 };
    }

    private estimateCost(request: GenerateSpriteRequest): number {
        const baseCost = 0.01;
        const resolution = (request.width || 512) * (request.height || 512);
        const resolutionMultiplier = resolution / (512 * 512);
        return Math.round(baseCost * resolutionMultiplier * 1000) / 1000;
    }

    private estimateSpriteSheetCost(request: GenerateSpriteSheetRequest): number {
        const baseCost = this.estimateCost(request);
        const frameCount = request.animations.reduce((sum, anim) =>
            sum + (anim.frames || request.framesPerAnimation || 4), 0);
        return Math.round(baseCost * frameCount * 0.5 * 1000) / 1000;
    }
}

export function createLeonardoProvider(config: LeonardoConfig): LeonardoProvider {
    return new LeonardoProvider(config);
}
