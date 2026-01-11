/**
 * Tencent Hunyuan 3D Provider
 * Text/image/sketch to 3D with OBJ/GLB export and HY-World 1.5 for large environments
 * API: https://hunyuan.tencent.com/en
 */

import type {
    HunyuanConfig,
    HunyuanResponse,
    GenerateModelRequest,
    GenerateEnvironmentRequest,
    GenerationResponse,
    ModelMetadata,
    EnvironmentMetadata,
    ModelFormat,
    SceneType
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://hunyuan.tencent.com/api/v1';

export class HunyuanProvider {
    private config: Required<HunyuanConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: HunyuanConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 6,
            model: config.model || 'hunyuan3d-1.0',
            rateLimit: config.rateLimit || { requestsPerMinute: 60, requestsPerDay: 1000 }
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
            throw new Error(`Hunyuan API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    async textTo3D(request: GenerateModelRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<HunyuanResponse>('/3d/text', {
                method: 'POST',
                body: JSON.stringify({
                    model: this.config.model,
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    format: request.format || 'glb',
                    quality: request.quality || 'standard',
                    style: request.style || 'realistic'
                })
            });
            return {
                success: true,
                assetId: response.data.taskId,
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/3d/status/${response.data.taskId}`,
                requestId,
                provider: 'hunyuan',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'hunyuan'
            };
        }
    }

    async imageTo3D(request: GenerateModelRequest & { inputImage: string }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let imageBody = request.inputImage;
            if (imageBody.startsWith('data:')) {
                imageBody = imageBody.split(',')[1];
            }
            const response = await this.request<HunyuanResponse>('/3d/image', {
                method: 'POST',
                body: JSON.stringify({
                    model: this.config.model,
                    image: imageBody,
                    prompt: request.prompt || 'Create a 3D model from this image',
                    format: request.format || 'glb',
                    quality: request.quality || 'standard'
                })
            });
            return {
                success: true,
                assetId: response.data.taskId,
                status: 'processing',
                estimatedTimeSeconds: 45,
                pollUrl: `/api/v1/assets/3d/status/${response.data.taskId}`,
                requestId,
                provider: 'hunyuan',
                costUsd: 0.10
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'hunyuan'
            };
        }
    }

    async sketchTo3D(request: GenerateModelRequest & { inputSketch: string }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let sketchBody = request.inputSketch;
            if (sketchBody.startsWith('data:')) {
                sketchBody = sketchBody.split(',')[1];
            }
            const response = await this.request<HunyuanResponse>('/3d/sketch', {
                method: 'POST',
                body: JSON.stringify({
                    model: this.config.model,
                    sketch: sketchBody,
                    prompt: request.prompt || 'Create a 3D model from this sketch',
                    format: request.format || 'glb'
                })
            });
            return {
                success: true,
                assetId: response.data.taskId,
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/3d/status/${response.data.taskId}`,
                requestId,
                provider: 'hunyuan',
                costUsd: 0.08
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'hunyuan'
            };
        }
    }

    async generateEnvironment(request: GenerateEnvironmentRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<HunyuanResponse>('/world/generate', {
                method: 'POST',
                body: JSON.stringify({
                    model: 'hy-world-1.5',
                    prompt: request.prompt,
                    scene_type: request.sceneType,
                    area_size: request.areaSize || [100, 20, 100],
                    object_count: request.objectCount || 100,
                    include_navmesh: request.includeNavmesh || false,
                    include_collision: request.includeCollision || true,
                    bake_lighting: request.bakeLighting || false,
                    style: request.style || 'realistic',
                    time_of_day: request.timeOfDay || 'day',
                    weather: request.weather || 'clear',
                    output_format: 'gltf'
                })
            });
            return {
                success: true,
                assetId: response.data.taskId,
                status: 'processing',
                estimatedTimeSeconds: 300,
                pollUrl: `/api/v1/assets/3d/world/status/${response.data.taskId}`,
                requestId,
                provider: 'hunyuan',
                costUsd: 1.0
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'hunyuan'
            };
        }
    }

    async getTaskStatus(taskId: string): Promise<HunyuanResponse> {
        return this.request<HunyuanResponse>(`/3d/task/${taskId}`);
    }

    async waitForTask(taskId: string, timeoutMs: number = 600000): Promise<HunyuanResponse> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);
            if (status.data.status === 'completed' || status.data.status === 'failed') {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Task timeout');
    }

    async downloadModel(taskId: string): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }
        if (!status.data.modelUrl) {
            throw new Error('No model URL available');
        }
        const response = await fetch(status.data.modelUrl);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.status}`);
        }
        return response.blob();
    }

    async extractMetadata(taskId: string, isEnvironment: boolean = false): Promise<ModelMetadata | EnvironmentMetadata> {
        const status = await this.getTaskStatus(taskId);
        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }
        const baseMetadata: ModelMetadata = {
            format: 'glb',
            polygonCount: undefined,
            vertexCount: undefined,
            triangleCount: undefined,
            textureCount: 1,
            materialCount: 1,
            hasRigging: false,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: status.data.thumbnailUrl,
            godotCompatible: true
        };
        if (isEnvironment) {
            return {
                ...baseMetadata,
                sceneType: 'terrain',
                objectCount: 100,
                navmeshGenerated: false,
                collisionBaked: false,
                lightingBaked: false,
                occlusionCulling: false
            } as EnvironmentMetadata;
        }
        return baseMetadata;
    }

    estimateCost(request: GenerateModelRequest | GenerateEnvironmentRequest): number {
        if ('sceneType' in request) {
            return 1.0;
        }
        const qualityMultiplier = { draft: 0.5, preview: 0.7, standard: 1.0, high: 2.0, ultra: 3.0 };
        return 0.10 * (qualityMultiplier[request.quality || 'standard'] || 1);
    }

    validateRequest(request: GenerateModelRequest | GenerateEnvironmentRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if ('sceneType' in request) {
            if (!request.prompt || request.prompt.length < 20) {
                errors.push('Environment prompt must be at least 20 characters');
            }
        } else {
            if (!request.prompt || request.prompt.length < 10) {
                errors.push('Prompt must be at least 10 characters');
            }
            if (request.prompt && request.prompt.length > 500) {
                errors.push('Prompt must not exceed 500 characters');
            }
        }
        return { valid: errors.length === 0, errors };
    }

    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }
}

export function createHunyuanProvider(config: HunyuanConfig): HunyuanProvider {
    return new HunyuanProvider(config);
}
