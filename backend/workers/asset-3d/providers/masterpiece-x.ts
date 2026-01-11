/**
 * Masterpiece X Provider
 * Rigged/animated characters, GLB export
 * API: https://api.masterpiecex.com/docs
 */

import type {
    MasterpieceXConfig,
    MasterpieceXResponse,
    GenerateModelRequest,
    GenerationResponse,
    ModelMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.masterpiecex.com/v1';

export class MasterpieceXProvider {
    private config: Required<MasterpieceXConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: MasterpieceXConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 5,
            defaultMeshQuality: config.defaultMeshQuality || 'standard',
            rateLimit: config.rateLimit || { requestsPerMinute: 10, requestsPerDay: 500 }
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
            throw new Error(`Masterpiece X API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    async generateCharacter(request: GenerateModelRequest & {
        meshQuality?: 'standard' | 'high' | 'ultra';
        includeRigging?: boolean;
        includeAnimation?: boolean;
        style?: 'realistic' | 'stylized' | 'cartoon' | 'fantasy' | 'sci-fi';
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'masterpiece_x'
            };
        }
        try {
            const body: Record<string, unknown> = {
                text: request.prompt,
                mesh: request.meshQuality || this.config.defaultMeshQuality,
                texture: true,
                rig: request.includeRigging !== false,
                animate: request.includeAnimation || false
            };
            if (request.inputImage) {
                body.image = request.inputImage;
            }
            const response = await this.request<MasterpieceXResponse>('/character/generate', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            return {
                success: true,
                assetId: response.id,
                status: response.status === 'completed' ? 'completed' : 'processing',
                estimatedTimeSeconds: 120,
                pollUrl: response.status !== 'completed' ? `/api/v1/assets/3d/status/${response.id}` : undefined,
                requestId,
                provider: 'masterpiece_x',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'masterpiece_x'
            };
        }
    }

    async generateCharacterFromImage(
        image: string,
        params?: {
            meshQuality?: 'standard' | 'high' | 'ultra';
            includeRigging?: boolean;
            includeAnimation?: boolean;
            style?: 'realistic' | 'stylized' | 'cartoon' | 'fantasy' | 'sci-fi';
        }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<MasterpieceXResponse>('/character/from-image', {
                method: 'POST',
                body: JSON.stringify({
                    image,
                    mesh: params?.meshQuality || this.config.defaultMeshQuality,
                    texture: true,
                    rig: params?.includeRigging !== false,
                    animate: params?.includeAnimation || false,
                    style: params?.style || 'realistic'
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: response.status === 'completed' ? 'completed' : 'processing',
                estimatedTimeSeconds: 90,
                pollUrl: response.status !== 'completed' ? `/api/v1/assets/3d/status/${response.id}` : undefined,
                requestId,
                provider: 'masterpiece_x',
                costUsd: 0.08
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'masterpiece_x'
            };
        }
    }

    async generateCreature(request: GenerateModelRequest & {
        creatureType?: 'fantasy' | 'realistic' | 'sci-fi' | 'horror' | 'mythical';
        meshQuality?: 'standard' | 'high' | 'ultra';
        includeRigging?: boolean;
        includeAnimation?: boolean;
        scale?: number;
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<MasterpieceXResponse>('/creature/generate', {
                method: 'POST',
                body: JSON.stringify({
                    text: request.prompt,
                    creature_type: request.creatureType || 'fantasy',
                    mesh: request.meshQuality || this.config.defaultMeshQuality,
                    texture: true,
                    rig: request.includeRigging !== false,
                    animate: request.includeAnimation || false,
                    scale: request.scale || 1.0
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: response.status === 'completed' ? 'completed' : 'processing',
                estimatedTimeSeconds: 120,
                pollUrl: response.status !== 'completed' ? `/api/v1/assets/3d/status/${response.id}` : undefined,
                requestId,
                provider: 'masterpiece_x',
                costUsd: 0.10
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'masterpiece_x'
            };
        }
    }

    async generateAnimation(
        characterId: string,
        animationRequest: {
            type: string;
            duration?: number;
            loop?: boolean;
            style?: 'natural' | 'exaggerated' | 'realistic' | 'cartoonish';
        }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<{ id: string; status: string; animation_url?: string }>(
                '/animation/generate',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        character_id: characterId,
                        animation_type: animationRequest.type,
                        duration: animationRequest.duration || 2.0,
                        loop: animationRequest.loop || false,
                        style: animationRequest.style || 'natural'
                    })
                }
            );
            return {
                success: true,
                assetId: response.id,
                status: response.status === 'completed' ? 'completed' : 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: response.status !== 'completed' ? `/api/v1/assets/animation/status/${response.id}` : undefined,
                requestId,
                provider: 'masterpiece_x',
                costUsd: 0.03
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'masterpiece_x'
            };
        }
    }

    async getAnimationTypes(characterId: string): Promise<string[]> {
        try {
            return await this.request<string[]>(`/character/${characterId}/animations`);
        } catch {
            return ['idle', 'walk', 'run', 'jump', 'attack', 'death', 'emote'];
        }
    }

    async addRigging(
        modelId: string,
        rigType: 'humanoid' | 'quadruped' | 'custom' = 'humanoid'
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        try {
            const response = await this.request<MasterpieceXResponse>(`/model/${modelId}/rig`, {
                method: 'POST',
                body: JSON.stringify({
                    rig_type: rigType,
                    auto_skin: true
                })
            });
            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/3d/status/${response.id}`,
                requestId,
                provider: 'masterpiece_x',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'masterpiece_x'
            };
        }
    }

    async getTaskStatus(taskId: string): Promise<MasterpieceXResponse> {
        return this.request<MasterpieceXResponse>(`/task/${taskId}`);
    }

    async waitForTask(taskId: string, timeoutMs: number = 300000): Promise<MasterpieceXResponse> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);
            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        throw new Error('Task timeout');
    }

    async downloadModel(taskId: string): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'completed' || !status.result?.glb) {
            throw new Error(`Task not completed or no result available. Status: ${status.status}`);
        }
        const response = await fetch(status.result.glb);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.status}`);
        }
        return response.blob();
    }

    async extractMetadata(taskId: string): Promise<ModelMetadata> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }
        return {
            format: 'glb',
            polygonCount: undefined,
            vertexCount: undefined,
            triangleCount: undefined,
            textureCount: 1,
            materialCount: 1,
            hasRigging: true,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: status.result?.thumbnail,
            godotCompatible: true,
            boneCount: 50
        };
    }

    validateRequest(request: GenerateModelRequest): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        if (!request.prompt || request.prompt.length < 10) {
            errors.push('Prompt must be at least 10 characters');
        }
        if (request.prompt && request.prompt.length > 1000) {
            errors.push('Prompt must not exceed 1000 characters');
        }
        return { valid: errors.length === 0, errors };
    }

    estimateCost(request: GenerateModelRequest & {
        meshQuality?: 'standard' | 'high' | 'ultra';
        includeRigging?: boolean;
        includeAnimation?: boolean;
    }): number {
        let baseCost = 0.05;
        const qualityMultiplier = { standard: 1, high: 2, ultra: 4 };
        baseCost *= qualityMultiplier[request.meshQuality || 'standard'];
        if (request.includeRigging) baseCost += 0.02;
        if (request.includeAnimation) baseCost += 0.03;
        return baseCost;
    }

    async getQuotaUsage(): Promise<{ used: number; limit: number; resetsAt: Date }> {
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

export function createMasterpieceXProvider(config: MasterpieceXConfig): MasterpieceXProvider {
    return new MasterpieceXProvider(config);
}
