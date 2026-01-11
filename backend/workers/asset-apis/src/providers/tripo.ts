/**
 * Tripo AI Provider Integration
 * Text/image to 3D with rigging, part segmentation, GLB/FBX
 * $15.90/month subscription
 *
 * API Docs: https://docs.tripo.ai
 */

import {
    TripoConfig,
    TripoResponse,
    Generate3DRequest,
    GenerationResponse,
    Model3DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.tripo.ai/v1';

const TRIPO_MODEL_TYPES = [
    'text-to-3d',
    'image-to-3d',
    'text-to-character',
    'image-to-character'
] as const;

const TRIPO_OUTPUT_FORMATS = ['glb', 'fbx', 'obj', 'usd'] as const;

// ============================================================================
// Tripo AI Provider Class
// ============================================================================

export class TripoProvider {
    private config: TripoConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: TripoConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 20;
        this.rateLimitResetAt = Date.now() + 60000;
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
            throw new Error(`Tripo API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Text to 3D
    // ========================================================================

    /**
     * Generate a 3D model from text description
     */
    async textTo3D(request: Generate3DRequest & TripoGenerationParams): Promise<GenerationResponse> {
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
            const response = await this.request<TripoResponse>('/generate/text', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    model_type: request.modelType || 'text-to-3d',
                    output_format: request.outputFormat || 'glb',
                    quality: request.quality || 'standard',
                    enable_rigging: request.enableRigging || false,
                    enable_segmentation: request.enableSegmentation || false,
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
        request: Generate3DRequest & { inputImage: string } & Partial<TripoGenerationParams>
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
                    enable_rigging: request.enableRigging || false,
                    enable_segmentation: request.enableSegmentation || false,
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
    // Character Generation
    // ========================================================================

    /**
     * Generate a rigged character from text
     */
    async generateCharacter(request: Generate3DRequest & TripoCharacterParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<TripoResponse>('/character/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    model_type: 'text-to-character',
                    output_format: request.outputFormat || 'glb',
                    quality: request.quality || 'high',
                    enable_rigging: true, // Always rig characters
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
                estimatedTimeSeconds: 180, // Characters take longer
                pollUrl: `/api/v1/assets/3d/status/${response.data.id}`,
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
     * Generate a character from an image
     */
    async generateCharacterFromImage(
        image: string,
        params?: Partial<TripoCharacterParams>
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
                    output_format: params?.outputFormat || 'glb',
                    quality: params?.quality || 'high',
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
    // Part Segmentation
    // ========================================================================

    /**
     * Get part segmentation data for a model
     * Returns information about different parts of the model (head, arms, legs, etc.)
     */
    async getPartSegmentation(modelId: string): Promise<TripoSegmentationData> {
        return this.request<TripoSegmentationData>(`/model/${modelId}/segmentation`);
    }

    /**
     * Generate a model with part segmentation enabled
     */
    async generateWithSegmentation(
        request: Generate3DRequest & { segmentParts?: string[] }
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
    async getTaskStatus(taskId: string): Promise<TripoResponse> {
        return this.request<TripoResponse>(`/task/${taskId}`);
    }

    /**
     * Wait for task completion
     */
    async waitForTask(
        taskId: string,
        timeoutMs: number = 600000 // 10 minutes for Tripo
    ): Promise<TripoResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);

            if (status.data.status === 'completed' || status.data.status === 'failed') {
                return status;
            }

            // Tripo can take a while for complex models
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error('Task timeout');
    }

    // ========================================================================
    // Model Download
    // ========================================================================

    /**
     * Download the generated model
     */
    async downloadModel(taskId: string, format?: 'glb' | 'fbx'): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);

        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }

        if (!status.data.model_url) {
            throw new Error('No model URL available');
        }

        // Request format conversion if needed
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

    /**
     * Download thumbnail
     */
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

    // ========================================================================
    // Metadata Extraction
    // ========================================================================

    /**
     * Extract metadata from a completed task
     */
    async extractMetadata(taskId: string, hasRigging: boolean = false): Promise<Model3DMetadata> {
        const status = await this.getTaskStatus(taskId);

        if (status.data.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.data.status}`);
        }

        // Try to get segmentation data for more detailed metadata
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
            textureCount: 1,
            hasRigging,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: status.data.thumbnail_url,
            godotCompatible: true,
            theiaMetadata: {
                importPath: `res://assets/models/tripo_${taskId}.glb`,
                resourceType: hasRigging ? 'Skeleton3D' : 'PackedScene',
                autoImport: true,
                customImportSettings: segmentationData ? {
                    import_as_skeleton: hasRigging,
                    parts: segmentationData.parts.map(p => p.name)
                } : undefined
            }
        };
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Generate multiple models in batch
     */
    async batchGenerate(requests: (Generate3DRequest & TripoGenerationParams)[]): Promise<GenerationResponse[]> {
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

    private estimateTime(request: Generate3DRequest & Partial<TripoGenerationParams>): number {
        let baseTime = 60; // 1 minute base

        if (request.quality === 'high') {
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

    /**
     * Validate request
     */
    validateRequest(request: Generate3DRequest & Partial<TripoGenerationParams>): {
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

        if (request.outputFormat && !TRIPO_OUTPUT_FORMATS.includes(request.outputFormat as any)) {
            errors.push(`Invalid format. Must be one of: ${TRIPO_OUTPUT_FORMATS.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: Generate3DRequest & Partial<TripoGenerationParams>): number {
        // Tripo is subscription-based ($15.90/month)
        // Estimate per-generation cost based on quota usage
        let baseCost = 0.08;

        if (request.quality === 'high') {
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

export interface TripoGenerationParams {
    modelType?: typeof TRIPO_MODEL_TYPES[number];
    outputFormat?: 'glb' | 'fbx' | 'obj' | 'usd';
    quality?: 'draft' | 'standard' | 'high';
    enableRigging?: boolean;
    enableSegmentation?: boolean;
    textureQuality?: 'low' | 'medium' | 'high';
    autoUV?: boolean;
    foregroundRatio?: number;
}

export interface TripoCharacterParams {
    outputFormat?: 'glb' | 'fbx';
    quality?: 'draft' | 'standard' | 'high';
    rigType?: 'humanoid' | 'quadruped' | 'custom';
    bodyType?: 'standard' | 'heroic' | 'slender' | 'heavy';
    style?: 'realistic' | 'stylized' | 'cartoon' | 'anime' | 'fantasy';
    textureQuality?: 'low' | 'medium' | 'high';
}

export interface TripoSegmentationData {
    parts: TripoPart[];
    total_polygons: number;
    total_vertices: number;
}

export interface TripoPart {
    name: string;
    polygon_count: number;
    vertex_count: number;
    material_index?: number;
    bounds?: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTripoProvider(config: TripoConfig): TripoProvider {
    return new TripoProvider(config);
}
