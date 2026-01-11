/**
 * Meshy AI Provider Integration
 * Text/image to 3D with clean optimized meshes
 *
 * API Docs: https://docs.meshy.ai
 */

import {
    MeshyConfig,
    MeshyResponse,
    Generate3DRequest,
    GenerationResponse,
    Model3DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.meshy.ai/v1';

const MESHY_MODELS = [
    'meshy-1',           // Standard text-to-3D
    'meshy-1-turbo',     // Faster generation
    'meshy-1-refine',    // Mesh refinement
    'meshy-texture',     // Texture generation
    'meshy-character'    // Character specialization
] as const;

// ============================================================================
// Meshy AI Provider Class
// ============================================================================

export class MeshyProvider {
    private config: MeshyConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: MeshyConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 30;
        this.rateLimitResetAt = Date.now() + 60000;
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
            throw new Error(`Meshy API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Text to 3D
    // ========================================================================

    /**
     * Generate a 3D model from text description
     */
    async textTo3D(request: Generate3DRequest & MeshyGenerationParams): Promise<GenerationResponse> {
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
            const response = await this.request<MeshyResponse>('/text-to-3d', {
                method: 'POST',
                body: JSON.stringify({
                    model: request.model || 'meshy-1',
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    mode: request.mode || 'preview',
                    enable_pbr: request.enablePBR !== false,
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
    // Image to 3D
    // ========================================================================

    /**
     * Generate a 3D model from an image
     */
    async imageTo3D(
        request: Generate3DRequest & { inputImage: string } & Partial<MeshyGenerationParams>
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
                    mode: request.mode || 'preview',
                    enable_pbr: request.enablePBR !== false,
                    target_mesh: request.targetMesh || 'auto'
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
    // Mesh Refinement
    // ========================================================================

    /**
     * Refine an existing mesh to improve quality
     * Meshy specializes in mesh cleanup and optimization
     */
    async refineMesh(
        modelId: string,
        params: MeshyRefineParams
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
    // Texture Generation
    // ========================================================================

    /**
     * Generate textures for an existing mesh
     */
    async generateTexture(
        modelId: string,
        params: MeshyTextureParams
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
    async getTaskStatus(taskId: string): Promise<MeshyResponse> {
        return this.request<MeshyResponse>(`/task/${taskId}`);
    }

    /**
     * Wait for task completion
     */
    async waitForTask(
        taskId: string,
        timeoutMs: number = 300000
    ): Promise<MeshyResponse> {
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

    // ========================================================================
    // Download
    // ========================================================================

    /**
     * Download the generated model
     */
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

    /**
     * Download thumbnail
     */
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

    // ========================================================================
    // Metadata
    // ========================================================================

    /**
     * Extract metadata from a completed task
     */
    async extractMetadata(taskId: string): Promise<Model3DMetadata> {
        const status = await this.getTaskStatus(taskId);

        if (status.status !== 'succeeded') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        return {
            format: 'glb',
            polygonCount: undefined,
            vertexCount: undefined,
            textureCount: 1,
            hasRigging: false,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: status.thumbnail_url,
            godotCompatible: true,
            theiaMetadata: {
                importPath: `res://assets/models/meshy_${taskId}.glb`,
                resourceType: 'PackedScene',
                autoImport: true,
                customImportSettings: {
                    import_as_mesh: true
                }
            }
        };
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Generate multiple models in batch
     */
    async batchGenerate(requests: (Generate3DRequest & MeshyGenerationParams)[]): Promise<GenerationResponse[]> {
        const results = await Promise.allSettled(
            requests.map(req => this.textTo3D(req))
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

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private estimateTime(request: Generate3DRequest & Partial<MeshyGenerationParams>): number {
        let baseTime = 60;

        const model = request.model || 'meshy-1';
        if (model === 'meshy-1-turbo') {
            baseTime *= 0.5;
        }

        if (request.mode === 'relax') {
            baseTime *= 2;
        }

        return baseTime;
    }

    /**
     * Validate request
     */
    validateRequest(request: Generate3DRequest & Partial<MeshyGenerationParams>): {
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

        if (request.cleanupFactor !== undefined && (request.cleanupFactor < 0 || request.cleanupFactor > 1)) {
            errors.push('cleanupFactor must be between 0 and 1');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost
     */
    estimateCost(request: Generate3DRequest & Partial<MeshyGenerationParams>): number {
        let baseCost = 0.06;

        if (request.mode === 'relax') {
            baseCost *= 1.5;
        }

        if (request.enablePBR === false) {
            baseCost *= 0.8;
        }

        return baseCost;
    }

    /**
     * Get available models
     */
    getAvailableModels(): readonly string[] {
        return MESHY_MODELS;
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface MeshyGenerationParams {
    model?: typeof MESHY_MODELS[number];
    mode?: 'preview' | 'relax';
    enablePBR?: boolean;
    autoUV?: boolean;
    cleanupFactor?: number;
    targetMesh?: 'auto' | 'organic' | 'hard_surface';
}

export interface MeshyRefineParams {
    cleanupFactor?: number;
    fixTopology?: boolean;
    removeDuplicates?: boolean;
    fillHoles?: boolean;
    smoothNormals?: boolean;
    targetPolygons?: number;
}

export interface MeshyTextureParams {
    prompt: string;
    style?: 'realistic' | 'stylized' | 'cartoon' | 'painterly';
    resolution?: 512 | 1024 | 2048;
    generateNormal?: boolean;
    generateRoughness?: boolean;
    generateMetallic?: boolean;
    generateAO?: boolean;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMeshyProvider(config: MeshyConfig): MeshyProvider {
    return new MeshyProvider(config);
}
