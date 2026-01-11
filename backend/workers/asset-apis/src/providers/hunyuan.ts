/**
 * Tencent Hunyuan 3D Provider Integration
 * Text/image/sketch to 3D with OBJ/GLB export and HY-World 1.5 for large environments
 *
 * API Docs: https://hunyuan.tencent.com/en
 */

import {
    Hunyuan3DConfig,
    Hunyuan3DResponse,
    Generate3DRequest,
    GenerateEnvironmentRequest,
    GenerationResponse,
    Model3DMetadata,
    EnvironmentMetadata,
    ModelFormat
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://hunyuan.tencent.com/api/v1';
const DEFAULT_MODEL = 'hunyuan3d-1.0';

// ============================================================================
// Hunyuan 3D Provider Class
// ============================================================================

export class Hunyuan3DProvider {
    private config: Hunyuan3DConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: Hunyuan3DConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 60;
        this.rateLimitResetAt = Date.now() + 60000;
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 60;
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
            throw new Error(`Hunyuan API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Text to 3D
    // ========================================================================

    /**
     * Generate a 3D model from text description
     */
    async textTo3D(request: Generate3DRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<Hunyuan3DResponse>('/3d/text', {
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
        request: Generate3DRequest & { inputImage: string }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            // Convert base64 to blob if needed
            let imageBody = request.inputImage;
            if (imageBody.startsWith('data:')) {
                imageBody = imageBody.split(',')[1];
            }

            const response = await this.request<Hunyuan3DResponse>('/3d/image', {
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
    // Sketch to 3D
    // ========================================================================

    /**
     * Generate a 3D model from a sketch drawing
     */
    async sketchTo3D(
        request: Generate3DRequest & { inputSketch: string }
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            let sketchBody = request.inputSketch;
            if (sketchBody.startsWith('data:')) {
                sketchBody = sketchBody.split(',')[1];
            }

            const response = await this.request<Hunyuan3DResponse>('/3d/sketch', {
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
    // HY-World Environment Generation
    // ========================================================================

    /**
     * Generate a large 3D environment using HY-World 1.5
     * This is specialized for creating terrains, cities, dungeons, etc.
     */
    async generateEnvironment(
        request: GenerateEnvironmentRequest
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<Hunyuan3DResponse>('/world/generate', {
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
                    output_format: 'gltf' // For better compatibility with Godot
                })
            });

            return {
                success: true,
                assetId: response.data.taskId,
                status: 'processing',
                estimatedTimeSeconds: 300, // 5 minutes for large environments
                pollUrl: `/api/v1/assets/3d/world/status/${response.data.taskId}`,
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
    async getTaskStatus(taskId: string): Promise<Hunyuan3DResponse> {
        return this.request<Hunyuan3DResponse>(`/3d/task/${taskId}`);
    }

    /**
     * Wait for task completion and return the result
     */
    async waitForTask(
        taskId: string,
        timeoutMs: number = 300000
    ): Promise<Hunyuan3DResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);

            if (status.data.status === 'completed' || status.data.status === 'failed') {
                return status;
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        throw new Error('Task timeout');
    }

    // ========================================================================
    // Model Download
    // ========================================================================

    /**
     * Download the generated model file
     */
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

    /**
     * Download model as specific format
     */
    async downloadModelAs(taskId: string, format: ModelFormat): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);

        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }

        // Request format conversion if needed
        const response = await this.request<{ url: string }>(`/3d/convert/${taskId}`, {
            method: 'POST',
            body: JSON.stringify({ format })
        });

        const modelResponse = await fetch(response.url);
        if (!modelResponse.ok) {
            throw new Error(`Failed to download model: ${modelResponse.status}`);
        }

        return modelResponse.blob();
    }

    // ========================================================================
    // Metadata Extraction
    // ========================================================================

    /**
     * Extract metadata from a completed task
     */
    async extractMetadata(taskId: string): Promise<Model3DMetadata | EnvironmentMetadata> {
        const status = await this.getTaskStatus(taskId);

        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }

        // Download and analyze the model to extract metadata
        const modelBlob = await this.downloadModel(taskId);

        // Basic metadata (in production, would analyze the actual model file)
        return {
            format: 'glb',
            polygonCount: undefined, // Would parse from model
            vertexCount: undefined,
            textureCount: undefined,
            hasRigging: false,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: modelBlob.size,
            previewImageUrl: status.data.thumbnailUrl,
            godotCompatible: true,
            theiaMetadata: {
                importPath: `res://assets/models/hunyuan_${taskId}.glb`,
                resourceType: 'PackedScene',
                autoImport: true
            }
        };
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Generate multiple models in batch
     */
    async batchTextTo3D(requests: Generate3DRequest[]): Promise<GenerationResponse[]> {
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
    // Cost Estimation
    // ========================================================================

    /**
     * Estimate cost for a generation request
     */
    estimateCost(request: Generate3DRequest | GenerateEnvironmentRequest): number {
        // Hunyuan pricing (estimated)
        // Standard 3D: ~$0.10 per model
        // HY-World: ~$1.00 per environment

        if ('sceneType' in request) {
            // Environment generation
            return 1.0;
        }

        // Standard model
        const qualityMultiplier = {
            draft: 0.5,
            standard: 1.0,
            high: 2.0
        };

        return 0.10 * (qualityMultiplier[request.quality || 'standard'] || 1);
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /**
     * Validate a generation request
     */
    validateRequest(request: Generate3DRequest | GenerateEnvironmentRequest): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if ('sceneType' in request) {
            // Environment validation
            if (!request.prompt || request.prompt.length < 20) {
                errors.push('Environment prompt must be at least 20 characters');
            }

            const validSceneTypes = ['terrain', 'building', 'city', 'nature', 'dungeon', 'interior'];
            if (!validSceneTypes.includes(request.sceneType)) {
                errors.push(`Invalid scene type. Must be one of: ${validSceneTypes.join(', ')}`);
            }
        } else {
            // Model validation
            if (!request.prompt || request.prompt.length < 10) {
                errors.push('Prompt must be at least 10 characters');
            }

            if (request.prompt && request.prompt.length > 500) {
                errors.push('Prompt must not exceed 500 characters');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createHunyuan3DProvider(config: Hunyuan3DConfig): Hunyuan3DProvider {
    return new Hunyuan3DProvider(config);
}
