/**
 * Tripo AI Provider
 * Text/image to 3D with rigging, part segmentation, GLB/FBX
 * API: https://docs.tripo.ai
 */

import type {
    TripoConfig,
    TripoResponse,
    TripoSegmentationData,
    GenerateModelRequest,
    GenerationResponse,
    ModelMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.tripo.ai/v1';

const TRIPO_MODEL_TYPES = [
    'text-to-3d',
    'image-to-3d',
    'text-to-character',
    'image-to-character'
] as const;

const TRIPO_OUTPUT_FORMATS = ['glb', 'fbx', 'obj', 'usd'] as const;

export class TripoProvider {
    private config: Required<TripoConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: TripoConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 4,
            enableRigging: config.enableRigging ?? false,
            enableSegmentation: config.enableSegmentation ?? false,
            rateLimit: config.rateLimit || { requestsPerMinute: 20, requestsPerDay: 500 }
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
            throw new Error(`Tripo API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    async textTo3D(request: GenerateModelRequest & {
        modelType?: typeof TRIPO_MODEL_TYPES[number];
        outputFormat?: 'glb' | 'fbx' | 'obj' | 'usd';
        enableRigging?: boolean;
        enableSegmentation?: boolean;
        textureQuality?: 'low' | 'medium' | 'high';
        autoUV?: boolean;
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'tripo'
            };
        }
        try {
            const response = await this.request<TripoResponse>('/generate/text', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    model_type: request.modelType || 'text-to-3d',
                    output_format: request.outputFormat || 'glb',
                    quality: request.quality || 'standard',
                    enable_rigging: request.enableRigging ?? this.config.enableRigging,
                    enable_segmentation: request.enableSegmentation ?? this.config.enableSegmentation,
                    texture_quality: request.textureQuality || 'high',
                    auto_uv: request.autoUV !== false
                })
            });
            return {
                success: true,
                assetId: response.data.id,
                status: 'processing',
                estimatedTimeSeconds: this.estimateTime(request),
                pollUrl: `/api/v1/assets/3d/status/${response.data.id}`,
                requestId,
                provider: 'tripo',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'tripo'
            };
        }
    }

    async imageTo3D(
        request: GenerateModelRequest & { inputImage: string } & Partial<{
            outputFormat: 'glb' | 'fbx' | 'obj' | 'usd';
            enableRigging: boolean;
            enableSegmentation: boolean;
            textureQuality: 'low' | 'medium' | 'high';
            autoUV: boolean;
            foregroundRatio: number;
        }>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let imageBody = request.inputImage;
            if (imageBody.startsWith('data:')) {
                imageBody = imageBody.split(',')[1];
            }
            const response = await this.request<TripoResponse>('/generate/image', {
                method: 'POST',
                body: JSON.stringify({
                    image: imageBody,
                    prompt: request.prompt || 'Create a 3D model from this image',
                    model_type: 'image-to-3d',
                    output_format: request.outputFormat || 'glb',
                    quality: request.quality || 'standard',
                    enable_rigging: request.enableRigging ?? this.config.enableRigging,
                    enable_segmentation: request.enableSegmentation ?? this.config.enableSegmentation,
                    texture_quality: request.textureQuality || 'high',
                    auto_uv: request.autoUV !== false,
                    foreground_ratio: request.foregroundRatio || 0.9
                })
            });
            return {
                success: true,
                assetId: response.data.id,
                status: 'processing',
                estimatedTimeSeconds: 45,
                pollUrl: `/api/v1/assets/3d/status/${response.data.id}`,
                requestId,
                provider: 'tripo',
                costUsd: 0.08
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'tripo'
            };
        }
    }

    async generateCharacter(request: GenerateModelRequest & {
        rigType?: 'humanoid' | 'quadruped' | 'custom';
        bodyType?: 'standard' | 'heroic' | 'slender' | 'heavy';
        style?: 'realistic' | 'stylized' | 'cartoon' | 'anime' | 'fantasy';
        textureQuality?: 'low' | 'medium' | 'high';
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<TripoResponse>('/character/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    model_type: 'text-to-character',
                    output_format: 'glb',
                    quality: request.quality || 'high',
                    enable_rigging: true,
                    rig_type: request.rigType || 'humanoid',
                    body_type: request.bodyType || 'standard',
                    style: request.style || 'realistic',
                    texture_quality: request.textureQuality || 'high'
                })
            });
            return {
                success: true,
                assetId: response.data.id,
                status: 'processing',
                estimatedTimeSeconds: 180,
                pollUrl: `/api/v1/assets/3d/status/${response.data.id}`,
                requestId,
                provider: 'tripo',
                costUsd: 0.15
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'tripo'
            };
        }
    }

    async generateCharacterFromImage(
        image: string,
        params?: {
            rigType?: 'humanoid' | 'quadruped' | 'custom';
            bodyType?: 'standard' | 'heroic' | 'slender' | 'heavy';
            style?: 'realistic' | 'stylized' | 'cartoon' | 'anime' | 'fantasy';
            textureQuality?: 'low' | 'medium' | 'high';
        }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let imageBody = image;
            if (image.startsWith('data:')) {
                imageBody = image.split(',')[1];
            }
            const response = await this.request<TripoResponse>('/character/from-image', {
                method: 'POST',
                body: JSON.stringify({
                    image: imageBody,
                    model_type: 'image-to-character',
                    output_format: 'glb',
                    quality: 'high',
                    enable_rigging: true,
                    rig_type: params?.rigType || 'humanoid',
                    style: params?.style || 'realistic',
                    texture_quality: params?.textureQuality || 'high'
                })
            });
            return {
                success: true,
                assetId: response.data.id,
                status: 'processing',
                estimatedTimeSeconds: 150,
                pollUrl: `/api/v1/assets/3d/status/${response.data.id}`,
                requestId,
                provider: 'tripo',
                costUsd: 0.12
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'tripo'
            };
        }
    }

    async getPartSegmentation(modelId: string): Promise<TripoSegmentationData> {
        return this.request<TripoSegmentationData>(`/model/${modelId}/segmentation`);
    }

    async generateWithSegmentation(
        request: GenerateModelRequest & { segmentParts?: string[] }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<TripoResponse>('/generate/with-segmentation', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    enable_segmentation: true,
                    target_parts: request.segmentParts || ['head', 'torso', 'arms', 'legs'],
                    output_format: 'glb',
                    quality: request.quality || 'standard'
                })
            });
            return {
                success: true,
                assetId: response.data.id,
                status: 'processing',
                estimatedTimeSeconds: 90,
                pollUrl: `/api/v1/assets/3d/status/${response.data.id}`,
                requestId,
                provider: 'tripo',
                costUsd: 0.11
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'tripo'
            };
        }
    }

    async getTaskStatus(taskId: string): Promise<TripoResponse> {
        return this.request<TripoResponse>(`/task/${taskId}`);
    }

    async waitForTask(taskId: string, timeoutMs: number = 600000): Promise<TripoResponse> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);
            if (status.data.status === 'completed' || status.data.status === 'failed') {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        throw new Error('Task timeout');
    }

    async downloadModel(taskId: string, format?: 'glb' | 'fbx'): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }
        if (!status.data.model_url) {
            throw new Error('No model URL available');
        }
        let downloadUrl = status.data.model_url;
        if (format && format !== 'glb') {
            const conversion = await this.request<{ url: string }>(`/model/${taskId}/convert`, {
                method: 'POST',
                body: JSON.stringify({ format })
            });
            downloadUrl = conversion.url;
        }
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.status}`);
        }
        return response.blob();
    }

    async downloadThumbnail(taskId: string): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.data.status !== 'completed' || !status.data.thumbnail_url) {
            throw new Error('No thumbnail available');
        }
        const response = await fetch(status.data.thumbnail_url);
        if (!response.ok) {
            throw new Error(`Failed to download thumbnail: ${response.status}`);
        }
        return response.blob();
    }

    async extractMetadata(taskId: string, hasRigging: boolean = false): Promise<ModelMetadata> {
        const status = await this.getTaskStatus(taskId);
        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }
        let segmentationData: TripoSegmentationData | undefined;
        try {
            segmentationData = await this.getPartSegmentation(taskId);
        } catch {
            // Segmentation not available
        }
        return {
            format: 'glb',
            polygonCount: segmentationData?.total_polygons,
            vertexCount: segmentationData?.total_vertices,
            triangleCount: segmentationData?.total_polygons,
            textureCount: 1,
            materialCount: segmentationData?.parts.length || 1,
            hasRigging,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: status.data.thumbnail_url,
            godotCompatible: true,
            boneCount: hasRigging ? 50 : undefined
        };
    }

    private estimateTime(request: GenerateModelRequest & {
        enableRigging?: boolean;
        enableSegmentation?: boolean;
    }): number {
        let baseTime = 60;
        if (request.quality === 'high' || request.quality === 'ultra') {
            baseTime *= 2;
        }
        if (request.enableRigging) {
            baseTime += 60;
        }
        if (request.enableSegmentation) {
            baseTime += 30;
        }
        return baseTime;
    }

    validateRequest(request: GenerateModelRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!request.prompt || request.prompt.length < 10) {
            errors.push('Prompt must be at least 10 characters');
        }
        if (request.prompt && request.prompt.length > 500) {
            errors.push('Prompt must not exceed 500 characters');
        }
        return { valid: errors.length === 0, errors };
    }

    estimateCost(request: GenerateModelRequest & {
        enableRigging?: boolean;
        enableSegmentation?: boolean;
    }): number {
        let baseCost = 0.08;
        if (request.quality === 'high' || request.quality === 'ultra') {
            baseCost *= 1.5;
        }
        if (request.enableRigging) {
            baseCost += 0.05;
        }
        if (request.enableSegmentation) {
            baseCost += 0.03;
        }
        return baseCost;
    }

    async getQuotaUsage(): Promise<{
        used: number;
        limit: number;
        resetsAt: Date;
    }> {
        try {
            const data = await this.request<{ used: number; limit: number; resets_at: string }>('/quota');
            return {
                used: data.used,
                limit: data.limit,
                resetsAt: new Date(data.resets_at)
            };
        } catch {
            return {
                used: 0,
                limit: 1000,
                resetsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
        }
    }

    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }
}

export function createTripoProvider(config: TripoConfig): TripoProvider {
    return new TripoProvider(config);
}
