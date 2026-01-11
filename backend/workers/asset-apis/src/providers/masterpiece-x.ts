/**
 * Masterpiece X Provider Integration
 * Rigged/animated characters, GLB export, $10.99/month
 *
 * API Docs: https://api.masterpiecex.com/docs
 */

import {
    MasterpieceXConfig,
    MasterpieceXGenerateRequest,
    MasterpieceXResponse,
    Generate3DRequest,
    GenerationResponse,
    Model3DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.masterpiecex.com/v1';

// ============================================================================
// Masterpiece X Provider Class
// ============================================================================

export class MasterpieceXProvider {
    private config: MasterpieceXConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: MasterpieceXConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 10;
        this.rateLimitResetAt = Date.now() + 60000;
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 10;
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
            throw new Error(`Masterpiece X API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Character Generation
    // ========================================================================

    /**
     * Generate a 3D character with optional rigging and animation
     * Masterpiece X specializes in character generation
     */
    async generateCharacter(request: Generate3DRequest & MasterpieceXCharacterParams): Promise<GenerationResponse> {
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
            const body: MasterpieceXGenerateRequest = {
                text: request.prompt,
                mesh: request.meshQuality || 'standard',
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
                estimatedTimeSeconds: 120, // 2 minutes average
                pollUrl: response.status !== 'completed' ? `/api/v1/assets/3d/status/${response.id}` : undefined,
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
     * Generate a character from an image (image-to-3D)
     */
    async generateCharacterFromImage(
        image: string,
        params?: Partial<MasterpieceXCharacterParams>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<MasterpieceXResponse>('/character/from-image', {
                method: 'POST',
                body: JSON.stringify({
                    image,
                    mesh: params?.meshQuality || 'standard',
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
     * Generate a creature/monster
     */
    async generateCreature(request: Generate3DRequest & MasterpieceXCreatureParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<MasterpieceXResponse>('/creature/generate', {
                method: 'POST',
                body: JSON.stringify({
                    text: request.prompt,
                    creature_type: request.creatureType || 'fantasy',
                    mesh: request.meshQuality || 'standard',
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
    // Animation Generation
    // ========================================================================

    /**
     * Generate animation for an existing rigged character
     */
    async generateAnimation(
        characterId: string,
        animationRequest: MasterpieceXAnimationRequest
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
     * Get available animation types for a character
     */
    async getAnimationTypes(characterId: string): Promise<string[]> {
        try {
            return await this.request<string[]>(`/character/${characterId}/animations`);
        } catch {
            return ['idle', 'walk', 'run', 'jump', 'attack', 'death', 'emote'];
        }
    }

    // ========================================================================
    // Rigging Services
    // ========================================================================

    /**
     * Add rigging to an existing non-rigged model
     */
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
     * Check the status of a generation task
     */
    async getTaskStatus(taskId: string): Promise<MasterpieceXResponse> {
        return this.request<MasterpieceXResponse>(`/task/${taskId}`);
    }

    /**
     * Wait for task completion
     */
    async waitForTask(
        taskId: string,
        timeoutMs: number = 300000
    ): Promise<MasterpieceXResponse> {
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

    // ========================================================================
    // Download
    // ========================================================================

    /**
     * Download the generated model
     */
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

    /**
     * Download the thumbnail
     */
    async downloadThumbnail(taskId: string): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);

        if (status.status !== 'completed' || !status.result?.thumbnail) {
            throw new Error(`Task not completed or no thumbnail available. Status: ${status.status}`);
        }

        const response = await fetch(status.result.thumbnail);
        if (!response.ok) {
            throw new Error(`Failed to download thumbnail: ${response.status}`);
        }

        return response.blob();
    }

    // ========================================================================
    // Metadata
    // ========================================================================

    /**
     * Extract metadata from a completed task
     */
    async extractMetadata(taskId: string): Promise<Model3DMetadata> {
        const status = await this.getTaskStatus(taskId);

        if (status.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        // Masterpiece X characters are always rigged (they specialize in rigged characters)
        return {
            format: 'glb',
            polygonCount: undefined,
            vertexCount: undefined,
            textureCount: 1, // Masterpiece X includes textures
            hasRigging: true,
            hasAnimation: false, // Check if animation was specifically requested
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: status.result?.thumbnail,
            godotCompatible: true,
            theiaMetadata: {
                importPath: `res://assets/characters/masterpiece_${taskId}.glb`,
                resourceType: 'PackedScene',
                autoImport: true,
                customImportSettings: {
                    import_as_skeleton: true,
                    generate_import_report: true
                }
            }
        };
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /**
     * Validate a generation request
     */
    validateRequest(request: Generate3DRequest & Partial<MasterpieceXCharacterParams>): {
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

        if (request.includeAnimation && !request.includeRigging) {
            // Animation requires rigging, so we should auto-enable rigging
            request.includeRigging = true;
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: Generate3DRequest & Partial<MasterpieceXCharacterParams>): number {
        // Masterpiece X is subscription-based ($10.99/month)
        // But we can estimate per-generation cost based on quota usage
        let baseCost = 0.05; // Base per-model cost allocation

        if (request.meshQuality === 'high') {
            baseCost *= 2;
        } else if (request.meshQuality === 'ultra') {
            baseCost *= 4;
        }

        if (request.includeRigging) {
            baseCost += 0.02;
        }

        if (request.includeAnimation) {
            baseCost += 0.03;
        }

        return baseCost;
    }

    /**
     * Get quota usage
     */
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
            // Return default values if API fails
            return {
                used: 0,
                limit: 1000,
                resetsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
        }
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface MasterpieceXCharacterParams {
    meshQuality?: 'standard' | 'high' | 'ultra';
    includeRigging?: boolean;
    includeAnimation?: boolean;
    style?: 'realistic' | 'stylized' | 'cartoon' | 'fantasy' | 'sci-fi';
}

export interface MasterpieceXCreatureParams {
    creatureType?: 'fantasy' | 'realistic' | 'sci-fi' | 'horror' | 'mythical';
    meshQuality?: 'standard' | 'high' | 'ultra';
    includeRigging?: boolean;
    includeAnimation?: boolean;
    scale?: number;
}

export interface MasterpieceXAnimationRequest {
    type: string;
    duration?: number;
    loop?: boolean;
    style?: 'natural' | 'exaggerated' | 'realistic' | 'cartoonish';
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMasterpieceXProvider(config: MasterpieceXConfig): MasterpieceXProvider {
    return new MasterpieceXProvider(config);
}
