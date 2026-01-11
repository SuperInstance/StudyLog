/**
 * Meshy AI Provider
 * Text/image to 3D with clean optimized meshes
 * API: https://docs.meshy.ai
 */

import type {
    MeshyConfig,
    MeshyResponse,
    GenerateModelRequest,
    GenerationResponse,
    ModelMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.meshy.ai/v1';

const MESHY_MODELS = [
    'meshy-1',
    'meshy-1-turbo',
    'meshy-1-refine',
    'meshy-texture',
    'meshy-character'
] as const;

export class MeshyProvider {
    private config: Required<MeshyConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: MeshyConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 2,
            enablePBR: config.enablePBR ?? true,
            defaultMode: config.defaultMode || 'preview',
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
            throw new Error(`Meshy API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    async textTo3D(request: GenerateModelRequest & {
        model?: typeof MESHY_MODELS[number];
        mode?: 'preview' | 'relax';
        enablePBR?: boolean;
        autoUV?: boolean;
        cleanupFactor?: number;
        targetMesh?: 'auto' | 'organic' | 'hard_surface';
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'meshy'
            };
        }
        try {
            const response = await this.request<MeshyResponse>('/text-to-3d', {
                method: 'POST',
                body: JSON.stringify({
                    model: request.model || 'meshy-1',
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    mode: request.mode || this.config.defaultMode,
                    enable_pbr: request.enablePBR ?? this.config.enablePBR,
                    auto_uv: request.autoUV !== false,
                    cleanup_factor: request.cleanupFactor || 0.5
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: this.estimateTime(request),
                pollUrl: `/api/v1/assets/3d/status/${response.id}`,
                requestId,
                provider: 'meshy',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'meshy'
            };
        }
    }

    async imageTo3D(
        request: GenerateModelRequest & { inputImage: string } & Partial<{
            mode: 'preview' | 'relax';
            enablePBR: boolean;
            targetMesh: 'auto' | 'organic' | 'hard_surface';
        }>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            let imageBody = request.inputImage;
            if (imageBody.startsWith('data:')) {
                imageBody = imageBody.split(',')[1];
            }
            const response = await this.request<MeshyResponse>('/image-to-3d', {
                method: 'POST',
                body: JSON.stringify({
                    model: 'meshy-1',
                    image: imageBody,
                    prompt: request.prompt || '',
                    mode: request.mode || this.config.defaultMode,
                    enable_pbr: request.enablePBR ?? this.config.enablePBR,
                    target_mesh: request.targetMesh || 'auto'
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/3d/status/${response.id}`,
                requestId,
                provider: 'meshy',
                costUsd: 0.06
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'meshy'
            };
        }
    }

    async refineMesh(
        modelId: string,
        params: {
            cleanupFactor?: number;
            fixTopology?: boolean;
            removeDuplicates?: boolean;
            fillHoles?: boolean;
            smoothNormals?: boolean;
            targetPolygons?: number;
        }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<MeshyResponse>('/refine', {
                method: 'POST',
                body: JSON.stringify({
                    source_model: modelId,
                    model: 'meshy-1-refine',
                    cleanup_factor: params.cleanupFactor || 0.7,
                    fix_topology: params.fixTopology !== false,
                    remove_duplicates: params.removeDuplicates !== false,
                    fill_holes: params.fillHoles !== false,
                    smooth_normals: params.smoothNormals !== false,
                    target_polygons: params.targetPolygons
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 45,
                pollUrl: `/api/v1/assets/3d/status/${response.id}`,
                requestId,
                provider: 'meshy',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'meshy'
            };
        }
    }

    async optimizeMesh(
        modelId: string,
        params: {
            targetPolygons: number;
            preserveSilhouette?: boolean;
            preserveUV?: boolean;
        }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<MeshyResponse>('/optimize', {
                method: 'POST',
                body: JSON.stringify({
                    source_model: modelId,
                    target_polygons: params.targetPolygons,
                    preserve_silhouette: params.preserveSilhouette !== false,
                    preserve_uv: params.preserveUV !== false
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/3d/status/${response.id}`,
                requestId,
                provider: 'meshy',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'meshy'
            };
        }
    }

    async generateTexture(
        modelId: string,
        params: {
            prompt: string;
            style?: 'realistic' | 'stylized' | 'cartoon' | 'painterly';
            resolution?: 512 | 1024 | 2048;
            generateNormal?: boolean;
            generateRoughness?: boolean;
            generateMetallic?: boolean;
            generateAO?: boolean;
        }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<{ id: string; status: string; texture_url?: string }>(
                '/texture/generate',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        model: 'meshy-texture',
                        source_model: modelId,
                        prompt: params.prompt,
                        style: params.style || 'realistic',
                        resolution: params.resolution || 1024,
                        generate_normal: params.generateNormal !== false,
                        generate_roughness: params.generateRoughness !== false,
                        generate_metallic: params.generateMetallic !== false,
                        generate_ao: params.generateAO !== false
                    })
                }
            );
            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/texture/status/${response.id}`,
                requestId,
                provider: 'meshy',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'meshy'
            };
        }
    }

    async getTaskStatus(taskId: string): Promise<MeshyResponse> {
        return this.request<MeshyResponse>(`/task/${taskId}`);
    }

    async waitForTask(taskId: string, timeoutMs: number = 300000): Promise<MeshyResponse> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);
            if (status.status === 'succeeded' || status.status === 'failed') {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        throw new Error('Task timeout');
    }

    async downloadModel(
        taskId: string,
        format: 'glb' | 'obj' | 'fbx' = 'glb'
    ): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'succeeded') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }
        if (!status.model_urls || !status.model_urls[format]) {
            throw new Error(`No ${format} model URL available`);
        }
        const response = await fetch(status.model_urls[format]);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.status}`);
        }
        return response.blob();
    }

    async downloadThumbnail(taskId: string): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'succeeded' || !status.thumbnail_url) {
            throw new Error('No thumbnail available');
        }
        const response = await fetch(status.thumbnail_url);
        if (!response.ok) {
            throw new Error(`Failed to download thumbnail: ${response.status}`);
        }
        return response.blob();
    }

    async extractMetadata(taskId: string): Promise<ModelMetadata> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'succeeded') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }
        return {
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
            previewImageUrl: status.thumbnail_url,
            godotCompatible: true
        };
    }

    private estimateTime(request: GenerateModelRequest & {
        model?: typeof MESHY_MODELS[number];
        mode?: 'preview' | 'relax';
    }): number {
        let baseTime = 60;
        const model = request.model || 'meshy-1';
        if (model === 'meshy-1-turbo') {
            baseTime *= 0.5;
        }
        const mode = request.mode || this.config.defaultMode;
        if (mode === 'relax') {
            baseTime *= 2;
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
        mode?: 'preview' | 'relax';
        enablePBR?: boolean;
    }): number {
        let baseCost = 0.06;
        const mode = request.mode || this.config.defaultMode;
        if (mode === 'relax') {
            baseCost *= 1.5;
        }
        if (request.enablePBR === false) {
            baseCost *= 0.8;
        }
        return baseCost;
    }

    getAvailableModels(): readonly string[] {
        return MESHY_MODELS;
    }

    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }
}

export function createMeshyProvider(config: MeshyConfig): MeshyProvider {
    return new MeshyProvider(config);
}
