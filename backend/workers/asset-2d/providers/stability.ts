/**
 * Stability AI Provider
 * SDXL, SD 3.5 image generation
 * API: https://docs.stability.ai
 * Website: https://stability.ai
 */

import type {
    StabilityConfig,
    StabilityResponse,
    StabilityArtifact,
    StabilityGenerationRequest,
    GenerateSpriteRequest,
    GenerateUIRequest,
    GenerateConceptRequest,
    GenerateTilesetRequest,
    GenerationResponse,
    SpriteMetadata,
    UIMetadata,
    ConceptMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.stability.ai';

const STABILITY_ENGINES = [
    'stable-diffusion-xl-1024',
    'stable-diffusion-xl-1024-v1-0',
    'stable-diffusion-2-1',
    'stable-diffusion-3',
    'stable-diffusion-3.5'
] as const;

const SAMPLERS = [
    'DDIM',
    'DDPM',
    'K_DPMPP_2M',
    'K_DPMPP_2S_ANCESTRAL',
    'K_EULER',
    'K_EULER_ANCESTRAL',
    'K_HEUN',
    'K_LMS'
] as const;

type StabilityEngine = typeof STABILITY_ENGINES[number];
type StabilitySampler = typeof SAMPLERS[number];

export class StabilityProvider {
    private config: Required<StabilityConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: StabilityConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 2,
            engine: config.engine || 'stable-diffusion-xl-1024',
            defaultSteps: config.defaultSteps || 30,
            defaultCfgScale: config.defaultCfgScale || 7,
            enableSDEdit: config.enableSDEdit ?? true,
            rateLimit: config.rateLimit || { requestsPerMinute: 50, requestsPerDay: 1000 }
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

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        version: 'v1' | 'v2beta' = 'v1'
    ): Promise<T> {
        await this.checkRateLimit();
        const apiVersion = version;
        const url = `${this.config.endpoint}/${apiVersion}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Stability API error: ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage += ` - ${errorJson.message || errorJson.errors?.[0] || errorText}`;
            } catch {
                errorMessage += ` - ${errorText}`;
            }
            throw new Error(errorMessage);
        }
        return response.json() as Promise<T>;
    }

    /**
     * Generate a sprite
     */
    async generateSprite(request: GenerateSpriteRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const genRequest = this.buildGenerationRequest(request);
            const engine = this.getSpriteEngine(request);

            const response = await this.request<StabilityResponse>(
                `/generation/${engine}/text-to-image`,
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const artifact = response.artifacts[0];
            const assetId = crypto.randomUUID();

            // Store the base64 image for retrieval
            const base64Data = artifact.base64;
            if (base64Data && this.config.enableSDEdit) {
                // Could store to R2 here
            }

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 10,
                requestId,
                provider: 'stability',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Generate using image-to-image
     */
    async imageToImage(
        request: GenerateSpriteRequest & { inputImage: string },
        strength: number = 0.35,
        initImageMode: 'IMAGE_STRENGTH' | 'STEP_SCHEDULE' = 'IMAGE_STRENGTH'
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const engine = this.getSpriteEngine(request);

            // Convert base64 or URL to format
            let image = request.inputImage;
            if (image.startsWith('data:')) {
                image = image.split(',')[1];
            }

            const genRequest = {
                text_prompts: [
                    { text: request.prompt, weight: 1 },
                    ...(request.negativePrompt ? [{ text: request.negativePrompt, weight: -1 }] : [])
                ],
                init_image: image,
                init_image_mode: initImageMode,
                image_strength: strength,
                cfg_scale: this.config.defaultCfgScale,
                samples: 1,
                steps: this.config.defaultSteps
            };

            const response = await this.request<StabilityResponse>(
                `/generation/${engine}/image-to-image`,
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 15,
                requestId,
                provider: 'stability',
                costUsd: 0.015
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Generate using SDEdit (Stochastic Differential Equation Editing)
     */
    async sdEdit(
        request: GenerateSpriteRequest & { inputImage: string },
        prompt: string,
        strength: number = 0.5
    ): Promise<GenerationResponse> {
        if (!this.config.enableSDEdit) {
            return {
                success: false,
                error: 'SDEdit is not enabled',
                requestId: crypto.randomUUID(),
                provider: 'stability'
            };
        }

        return this.imageToImage({ ...request, prompt }, strength, 'STEP_SCHEDULE');
    }

    /**
     * Generate UI icons
     */
    async generateUIIcon(request: GenerateUIRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const size = request.size || 512;
            const prompt = this.buildUIPrompt(request);

            const genRequest: StabilityGenerationRequest = {
                text_prompts: [
                    { text: prompt, weight: 1 },
                    { text: 'ugly, blurry, low quality, realistic', weight: -1 }
                ],
                cfg_scale: this.config.defaultCfgScale,
                width: size,
                height: size,
                samples: request.batch ? Math.min(request.batchCount || 4, 10) : 1,
                steps: 25
            };

            const response = await this.request<StabilityResponse>(
                '/generation/stable-diffusion-xl-1024/text-to-image',
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 8,
                requestId,
                provider: 'stability',
                costUsd: 0.005
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
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
            const engine = this.getConceptEngine(request);

            const genRequest: StabilityGenerationRequest = {
                text_prompts: [
                    { text: prompt, weight: 1 },
                    { text: 'ugly, poorly drawn, low quality, distorted', weight: -1 }
                ],
                cfg_scale: this.config.defaultCfgScale,
                width,
                height,
                samples: request.iterations || 1,
                steps: request.quality === 'ultra' ? 50 : 30,
                sampler: this.config.enableSDEdit ? 'K_DPMPP_2M' : 'K_EULER'
            };

            const response = await this.request<StabilityResponse>(
                `/generation/${engine}/text-to-image`,
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 20,
                requestId,
                provider: 'stability',
                costUsd: this.estimateConceptCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Generate a tileset
     */
    async generateTileset(request: GenerateTilesetRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const tileSize = request.tileSize || 32;
            const tilesWide = request.tilesWide || 8;
            const tilesHigh = request.tilesHigh || 8;
            const totalWidth = tileSize * tilesWide;
            const totalHeight = tileSize * tilesHigh;

            const prompt = `game tileset, ${request.prompt}, seamless tiles, grid layout, ${request.style || 'top_down'} view`;

            const genRequest: StabilityGenerationRequest = {
                text_prompts: [
                    { text: prompt, weight: 1 },
                    { text: 'photorealistic, non-seamless, messy, blurry', weight: -1 }
                ],
                cfg_scale: this.config.defaultCfgScale,
                width: totalWidth,
                height: totalHeight,
                samples: request.includeVariations ? 4 : 1,
                steps: 30
            };

            const response = await this.request<StabilityResponse>(
                '/generation/stable-diffusion-xl-1024/text-to-image',
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 15,
                requestId,
                provider: 'stability',
                costUsd: 0.035
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Upscale an image
     */
    async upscale(
        image: string,
        scale: 2 | 4 = 2
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            // Convert image to base64 if needed
            let base64Image = image;
            if (image.startsWith('data:')) {
                base64Image = image.split(',')[1];
            }

            const response = await this.request<StabilityResponse>(
                '/generation/esrgan-v1-x2xupscaling-sd-6.0/upscale',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        image: base64Image,
                        scale
                    })
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 10,
                requestId,
                provider: 'stability',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Remove background from an image
     */
    async removeBackground(image: string): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let base64Image = image;
            if (image.startsWith('data:')) {
                base64Image = image.split(',')[1];
            }

            const response = await this.request<StabilityResponse>(
                '/v2beta/stable-diffusion/remove-background',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        image: base64Image,
                        output_format: 'png'
                    })
                },
                'v2beta'
            );

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 5,
                requestId,
                provider: 'stability',
                costUsd: 0.005
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Inpaint (edit part of an image)
     */
    async inpaint(
        initImage: string,
        maskImage: string,
        prompt: string,
        negativePrompt?: string
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let initBase64 = initImage;
            let maskBase64 = maskImage;

            if (initBase64.startsWith('data:')) {
                initBase64 = initBase64.split(',')[1];
            }
            if (maskBase64.startsWith('data:')) {
                maskBase64 = maskBase64.split(',')[1];
            }

            const genRequest = {
                text_prompts: [
                    { text: prompt, weight: 1 },
                    ...(negativePrompt ? [{ text: negativePrompt, weight: -1 }] : [])
                ],
                init_image: initBase64,
                mask_image: maskBase64,
                cfg_scale: this.config.defaultCfgScale,
                samples: 1,
                steps: 30
            };

            const response = await this.request<StabilityResponse>(
                '/generation/stable-diffusion-xl-1024/inpaint',
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 15,
                requestId,
                provider: 'stability',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Generate with ControlNet guidance
     */
    async controlNet(
        image: string,
        prompt: string,
        controlType: 'canny' | 'depth' | 'pose' | 'scribble' = 'canny'
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            // ControlNet is available in SDXL through stability API
            const genRequest = {
                text_prompts: [{ text: prompt, weight: 1 }],
                init_image: image.startsWith('data:') ? image.split(',')[1] : image,
                control_strength: 0.9,
                cfg_scale: this.config.defaultCfgScale,
                samples: 1,
                steps: 30
            };

            const response = await this.request<StabilityResponse>(
                `/generation/stable-diffusion-xl-1024/controlnet/${controlType}`,
                {
                    method: 'POST',
                    body: JSON.stringify(genRequest)
                }
            );

            if (!response.artifacts || response.artifacts.length === 0) {
                throw new Error('No artifacts returned');
            }

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                estimatedTimeSeconds: 20,
                requestId,
                provider: 'stability',
                costUsd: 0.025
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'stability'
            };
        }
    }

    /**
     * Get account balance and usage
     */
    async getAccountInfo(): Promise<{ credits: number; remaining_credits: number }> {
        return this.request<{ credits: number; remaining_credits: }>('/user/account');
    }

    /**
     * List available engines
     */
    async listEngines(): Promise<string[]> {
        try {
            const response = await this.request<{ engines: Array<{ id: string; name: string }> }>('/engines/list');
            return response.engines.map(e => e.id);
        } catch {
            return STABILITY_ENGINES as string[];
        }
    }

    /**
     * Download image from artifact
     */
    async downloadImage(artifact: StabilityArtifact): Promise<Blob> {
        if (!artifact.base64) {
            throw new Error('No base64 data in artifact');
        }

        const binaryString = atob(artifact.base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return new Blob([bytes], { type: 'image/png' });
    }

    /**
     * Check if provider is available
     */
    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }

    /**
     * Extract metadata from artifact
     */
    extractMetadata(
        artifact: StabilityArtifact,
        type: 'sprite' | 'ui' | 'concept' = 'sprite'
    ): SpriteMetadata | UIMetadata | ConceptMetadata {
        if (type === 'ui') {
            return {
                format: 'png',
                width: 512,
                height: 512,
                style: 'minimal',
                hasTransparency: false,
                isScalable: false,
                fileSizeBytes: 0
            } as UIMetadata;
        }

        if (type === 'concept') {
            return {
                format: 'png',
                width: 1024,
                height: 1024,
                aspectRatio: '1:1',
                style: 'default',
                iterationCount: 1,
                fileSizeBytes: 0
            } as ConceptMetadata;
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
            godotCompatible: true
        } as SpriteMetadata;
    }

    // Private helper methods

    private buildGenerationRequest(request: GenerateSpriteRequest): StabilityGenerationRequest {
        const prompts: Array<{ text: string; weight: number }> = [
            { text: request.prompt, weight: 1 }
        ];

        if (request.negativePrompt) {
            prompts.push({ text: request.negativePrompt, weight: -1 });
        }

        return {
            text_prompts: prompts,
            cfg_scale: this.config.defaultCfgScale,
            width: request.width || 512,
            height: request.height || 512,
            samples: 1,
            steps: this.config.defaultSteps,
            sampler: this.config.enableSDEdit ? 'K_DPMPP_2M' : 'K_EULER',
            seed: request.seed
        };
    }

    private buildUIPrompt(request: GenerateUIRequest): string {
        let prompt = `UI icon, ${request.prompt}, ${request.style || 'minimal'} style, flat design, vector style`;
        if (request.colorScheme && request.colorScheme.length > 0) {
            prompt += `, colors: ${request.colorScheme.join(', ')}`;
        }
        if (request.stroke?.enabled) {
            prompt += ', outline icon';
        }
        if (request.category) {
            prompt += `, ${request.category} icon`;
        }
        return prompt;
    }

    private buildConceptPrompt(request: GenerateConceptRequest): string {
        let prompt = request.prompt;
        if (request.style) {
            prompt = `${request.style} style, ${prompt}`;
        }
        if (request.mood) {
            prompt += `, ${request.mood} mood`;
        }
        if (request.forCharacter) {
            prompt += ', character design, full body, detailed, concept art';
        } else if (request.forEnvironment) {
            prompt += ', environment, landscape, detailed, concept art';
        } else if (request.forItem) {
            prompt += ', item design, game asset, detailed, concept art';
        }
        return prompt;
    }

    private getSpriteEngine(request: GenerateSpriteRequest): StabilityEngine {
        // Use SDXL for higher quality, SD 2.1 for faster/smaller
        if (request.quality === 'draft' || (request.width && request.width < 512)) {
            return 'stable-diffusion-2-1';
        }
        return this.config.engine;
    }

    private getConceptEngine(request: GenerateConceptRequest): StabilityEngine {
        if (request.quality === 'ultra' && this.config.engine.includes('3.5')) {
            return 'stable-diffusion-3.5';
        }
        if (request.quality === 'high') {
            return 'stable-diffusion-3';
        }
        return 'stable-diffusion-xl-1024';
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

    private estimateCost(request: GenerateSpriteRequest): number {
        const baseCost = 0.01;
        const resolution = (request.width || 512) * (request.height || 512);
        const resolutionMultiplier = resolution / (512 * 512);
        return Math.round(baseCost * resolutionMultiplier * 1000) / 1000;
    }

    private estimateConceptCost(request: GenerateConceptRequest): number {
        const baseCost = 0.015;
        const qualityMultiplier = request.quality === 'ultra' ? 1.5 : request.quality === 'high' ? 1.2 : 1;
        return Math.round(baseCost * qualityMultiplier * 1000) / 1000;
    }
}

export function createStabilityProvider(config: StabilityConfig): StabilityProvider {
    return new StabilityProvider(config);
}
