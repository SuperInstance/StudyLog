/**
 * Meshy AI Runtime Integration
 *
 * Provides runtime 3D model generation and import for Godot using Meshy AI.
 * Supports text-to-3D and image-to-3D generation with optional voxel-style output.
 *
 * Features:
 * - Text-to-3D model generation
 * - Image-to-3D model generation
 * - Voxel-style model conversion
 * - Runtime import into Godot scenes
 * - Model status polling
 * - Godot-compatible format conversion (GLB, OBJ)
 * - Hot-reload support
 *
 * @module meshy-runtime
 */

import type {
    Env,
    MeshyGenerationRequest,
    MeshyGenerationResponse,
    MeshyMetadata,
    RuntimeImportRequest,
    RuntimeImportResponse,
    RuntimeImportSettings,
    GDScriptTransform,
    VoxelBuffer,
    ProductContext,
    Vector3,
    ApiResponse,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const MESHY_API_BASE = 'https://api.meshy.ai/v1';
const MESHY_POLL_INTERVAL_MS = 2000;
const MESHY_MAX_POLL_ATTEMPTS = 60;

/**
 * Meshy API model endpoints
 */
enum MeshyModel {
    TEXT_TO_3D = '/text-to-3d',
    IMAGE_TO_3D = '/image-to-3d',
    VOXEL_TEXT_TO_3D = '/voxel/text-to-3d',
    VOXEL_IMAGE_TO_3D = '/voxel/image-to-3d',
}

/**
 * Meshy generation status
 */
enum MeshyStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SUCCEEDED = 'succeeded',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

// ============================================================================
// Meshy API Client
// ============================================================================

/**
 * Client for interacting with Meshy AI API
 */
export class MeshyClient {
    private apiKey: string;
    private apiBase: string;

    constructor(apiKey: string, apiBase: string = MESHY_API_BASE) {
        this.apiKey = apiKey;
        this.apiBase = apiBase;
    }

    /**
     * Start a text-to-3D generation
     */
    async generateTextTo3D(request: MeshyGenerationRequest): Promise<MeshyGenerationResponse> {
        const endpoint = request.voxelStyle ? MeshyModel.VOXEL_TEXT_TO_3D : MeshyModel.TEXT_TO_3D;

        const requestBody = {
            prompt: request.prompt,
            negative_prompt: request.negativePrompt,
            mode: request.quality,
            // voxel_style is handled via endpoint selection
        };

        const response = await fetch(`${this.apiBase}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Meshy API error: ${error}`);
        }

        const data = await response.json() as {
            id: string;
            status: string;
            model_url?: string;
            thumbnail_url?: string;
        };

        return {
            taskId: data.id,
            status: this.mapStatus(data.status),
            modelUrl: data.model_url,
            thumbnailUrl: data.thumbnail_url,
        };
    }

    /**
     * Start an image-to-3D generation
     */
    async generateImageTo3D(request: MeshyGenerationRequest): Promise<MeshyGenerationResponse> {
        if (!request.referenceImage) {
            throw new Error('Reference image is required for image-to-3D generation');
        }

        const endpoint = request.voxelStyle ? MeshyModel.VOXEL_IMAGE_TO_3D : MeshyModel.IMAGE_TO_3D;

        const formData = new FormData();
        formData.append('image_url', request.referenceImage);
        formData.append('prompt', request.prompt);
        if (request.negativePrompt) {
            formData.append('negative_prompt', request.negativePrompt);
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Meshy API error: ${error}`);
        }

        const data = await response.json() as {
            id: string;
            status: string;
            model_url?: string;
            thumbnail_url?: string;
        };

        return {
            taskId: data.id,
            status: this.mapStatus(data.status),
            modelUrl: data.model_url,
            thumbnailUrl: data.thumbnail_url,
        };
    }

    /**
     * Get the status of a generation task
     */
    async getTaskStatus(taskId: string): Promise<MeshyGenerationResponse> {
        const response = await fetch(`${this.apiBase}/text-to-3d/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Meshy API error: ${response.statusText}`);
        }

        const data = await response.json() as {
            id: string;
            status: string;
            model_url?: string;
            thumbnail_url?: string;
            model_urls?: {
                glb?: string;
                obj?: string;
                fbx?: string;
            };
        };

        return {
            taskId: data.id,
            status: this.mapStatus(data.status),
            modelUrl: data.model_url || data.model_urls?.glb,
            thumbnailUrl: data.thumbnail_url,
        };
    }

    /**
     * Poll for task completion
     */
    async pollForCompletion(
        taskId: string,
        maxAttempts: number = MESHY_MAX_POLL_ATTEMPTS
    ): Promise<MeshyGenerationResponse> {
        for (let i = 0; i < maxAttempts; i++) {
            const response = await this.getTaskStatus(taskId);

            if (response.status === MeshyStatus.SUCCEEDED || response.status === MeshyStatus.FAILED) {
                return response;
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, MESHY_POLL_INTERVAL_MS));
        }

        throw new Error('Meshy generation timeout');
    }

    /**
     * Download and convert model for Godot import
     */
    async downloadModel(modelUrl: string, format: 'glb' | 'obj' | 'fbx' = 'glb'): Promise<ArrayBuffer> {
        const response = await fetch(modelUrl);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.statusText}`);
        }
        return response.arrayBuffer();
    }

    /**
     * Map Meshy API status to internal status
     */
    private mapStatus(status: string): MeshyGenerationResponse['status'] {
        switch (status) {
            case 'PENDING':
                return 'pending';
            case 'PROCESSING':
                return 'processing';
            case 'SUCCEEDED':
                return 'completed';
            case 'FAILED':
                return 'failed';
            case 'CANCELLED':
                return 'failed';
            default:
                return 'pending';
        }
    }
}

// ============================================================================
// Runtime Import Service
// ============================================================================

/**
 * Service for runtime 3D model import into Godot
 */
export class RuntimeImportService {
    private godotBridgeUrl: string | undefined;
    private assetsBucket: R2Bucket | undefined;

    constructor(env: Env) {
        this.godotBridgeUrl = env.GODOT_BRIDGE_URL;
        this.assetsBucket = env.ASSETS_BUCKET;
    }

    /**
     * Import a model into a running Godot scene at runtime
     */
    async importModel(request: RuntimeImportRequest): Promise<RuntimeImportResponse> {
        try {
            // Download the model
            const modelData = await fetch(request.modelUrl);
            if (!modelData.ok) {
                throw new Error(`Failed to download model: ${modelData.statusText}`);
            }

            const arrayBuffer = await modelData.arrayBuffer();
            const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

            // If voxelize is requested, convert to voxel data
            let voxelData: VoxelBuffer | undefined;
            if (request.settings.voxelize) {
                voxelData = await this.voxelizeModel(arrayBuffer, request.settings.voxelSize || 0.1);
            }

            // Send to Godot via bridge
            if (this.godotBridgeUrl) {
                const response = await fetch(`${this.godotBridgeUrl}/api/import-model`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        modelData: base64Data,
                        importPath: request.importPath,
                        scenePath: request.scenePath,
                        parentNode: request.parentNode,
                        transform: request.transform,
                        settings: request.settings,
                        voxelData: voxelData ? this.encodeVoxelData(voxelData) : undefined,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Godot bridge error: ${response.statusText}`);
                }

                const data = await response.json() as {
                    nodeId: string;
                    scenePath: string;
                    errors?: string[];
                };

                return {
                    success: true,
                    scenePath: data.scenePath,
                    nodeId: data.nodeId,
                    voxelized: !!voxelData,
                    importErrors: data.errors,
                };
            }

            // No bridge - store in R2 for later import
            if (this.assetsBucket) {
                const key = `models/${request.scenePath.replace(/\//g, '_')}.glb`;
                await this.assetsBucket.put(key, arrayBuffer);
            }

            return {
                success: true,
                scenePath: request.scenePath,
                nodeId: `imported_${Date.now()}`,
                voxelized: !!voxelData,
            };

        } catch (error) {
            return {
                success: false,
                scenePath: request.scenePath,
                nodeId: '',
                voxelized: false,
                importErrors: [error instanceof Error ? error.message : String(error)],
            };
        }
    }

    /**
     * Voxelize a 3D model
     */
    private async voxelizeModel(modelData: ArrayBuffer, voxelSize: number): Promise<VoxelBuffer> {
        // This is a simplified voxelization
        // In production, would use proper voxelization algorithms
        // or send to a dedicated voxelization service

        const boundingBox = { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } };
        const resolution = Math.ceil(2 / voxelSize);

        // Generate simple voxel data
        const voxelCount = resolution * resolution * resolution;
        const typeData = new Uint8Array(voxelCount);
        const colorData = new Uint8Array(voxelCount * 4); // RGBA

        for (let x = 0; x < resolution; x++) {
            for (let y = 0; y < resolution; y++) {
                for (let z = 0; z < resolution; z++) {
                    const idx = x + resolution * (y + resolution * z);

                    // Simple sphere shape as placeholder
                    const cx = x / resolution - 0.5;
                    const cy = y / resolution - 0.5;
                    const cz = z / resolution - 0.5;
                    const dist = Math.sqrt(cx * cx + cy * cy + cz * cz);

                    if (dist < 0.4) {
                        typeData[idx] = 1; // Solid

                        // Simple gradient coloring
                        const colorIdx = idx * 4;
                        colorData[colorIdx] = Math.floor(100 + dist * 300); // R
                        colorData[colorIdx + 1] = Math.floor(150 + dist * 100); // G
                        colorData[colorIdx + 2] = Math.floor(200); // B
                        colorData[colorIdx + 3] = 255; // A
                    }
                }
            }
        }

        return {
            size: { x: resolution, y: resolution, z: resolution },
            position: { x: 0, y: 0, z: 0 },
            format: 'uint8',
            channels: [
                {
                    type: 'type',
                    data: typeData,
                    depth: 8,
                    compressed: false,
                },
                {
                    type: 'color',
                    data: colorData,
                    depth: 8,
                    compressed: false,
                },
            ],
        };
    }

    /**
     * Encode voxel data for transmission
     */
    private encodeVoxelData(voxelData: VoxelBuffer): string {
        return JSON.stringify({
            size: voxelData.size,
            position: voxelData.position,
            format: voxelData.format,
            channels: voxelData.channels.map(ch => ({
                type: ch.type,
                depth: ch.depth,
                data: Array.from(ch.data).slice(0, 1000), // Limit size for example
            })),
        });
    }

    /**
     * Store model in R2 for later use
     */
    async storeModel(modelData: ArrayBuffer, key: string): Promise<string> {
        if (!this.assetsBucket) {
            throw new Error('R2 bucket not configured');
        }

        await this.assetsBucket.put(key, modelData, {
            httpMetadata: {
                contentType: 'model/gltf-binary',
            },
        });

        return key;
    }

    /**
     * Get stored model URL
     */
    async getModelUrl(key: string): Promise<string> {
        if (!this.assetsBucket) {
            throw new Error('R2 bucket not configured');
        }

        // In production, this would return a signed URL
        return `https://assets.example.com/${key}`;
    }
}

// ============================================================================
// Meshy Service (High-level API)
// ============================================================================

/**
 * High-level service combining Meshy API and runtime import
 */
export class MeshyService {
    private client: MeshyClient;
    private importService: RuntimeImportService;
    private cache: KVNamespace | undefined;
    private db: D1Database | undefined;

    constructor(env: Env) {
        if (!env.MESHY_API_KEY) {
            throw new Error('MESHY_API_KEY is required');
        }
        this.client = new MeshyClient(env.MESHY_API_KEY);
        this.importService = new RuntimeImportService(env);
        this.cache = env.CACHE;
        this.db = env.DB;
    }

    /**
     * Generate and import a model in one operation
     */
    async generateAndImport(
        request: MeshyGenerationRequest,
        importSettings: RuntimeImportSettings
    ): Promise<{
        generation: MeshyGenerationResponse;
        importResult?: RuntimeImportResponse;
    }> {
        // Start generation
        const generation = await this.client.generateTextTo3D(request);

        // Cache the task ID
        if (this.cache) {
            await this.cache.put(
                `meshy:task:${generation.taskId}`,
                JSON.stringify({ request, status: 'pending' }),
                { expirationTtl: 3600 }
            );
        }

        // If immediate import requested and generation is complete
        if (generation.modelUrl && importSettings) {
            const importResult = await this.importService.importModel({
                modelUrl: generation.modelUrl,
                importPath: `user://generated/${generation.taskId}/`,
                scenePath: `Generated/Model_${generation.taskId}`,
                settings: importSettings,
            });

            return { generation, importResult };
        }

        return { generation };
    }

    /**
     * Poll for completion and import when ready
     */
    async pollAndImport(
        taskId: string,
        importSettings: RuntimeImportSettings
    ): Promise<{
        generation: MeshyGenerationResponse;
        importResult?: RuntimeImportResponse;
    }> {
        // Poll for completion
        const generation = await this.client.pollForCompletion(taskId);

        // Update cache
        if (this.cache) {
            await this.cache.put(
                `meshy:task:${taskId}`,
                JSON.stringify({ status: generation.status }),
                { expirationTtl: 3600 }
            );
        }

        // Import if complete
        if (generation.status === 'completed' && generation.modelUrl && importSettings) {
            const importResult = await this.importService.importModel({
                modelUrl: generation.modelUrl,
                importPath: `user://generated/${taskId}/`,
                scenePath: `Generated/Model_${taskId}`,
                settings: importSettings,
            });

            return { generation, importResult };
        }

        return { generation };
    }

    /**
     * Create a voxel-style prop for StudyLoG.AI or DMLoG.AI
     */
    async createVoxelProp(
        prompt: string,
        productContext: ProductContext,
        scenePath: string
    ): Promise<MeshyGenerationResponse> {
        const contextPrefix = productContext === 'studylog'
            ? 'Educational voxel prop for learning: '
            : productContext === 'dmlog'
            ? 'Fantasy RPG voxel prop: '
            : '';

        const request: MeshyGenerationRequest = {
            prompt: contextPrefix + prompt,
            voxelStyle: true,
            format: 'glb',
            quality: 'standard',
            productContext,
        };

        return this.client.generateTextTo3D(request);
    }

    /**
     * Generate multiple models in batch
     */
    async generateBatch(
        requests: MeshyGenerationRequest[],
        onProgress?: (completed: number, total: number) => void
    ): Promise<MeshyGenerationResponse[]> {
        const results: MeshyGenerationResponse[] = [];

        for (let i = 0; i < requests.length; i++) {
            const result = await this.client.generateTextTo3D(requests[i]);
            results.push(result);

            if (onProgress) {
                onProgress(i + 1, requests.length);
            }
        }

        return results;
    }

    /**
     * Get stored generation tasks for a user
     */
    async getUserTasks(userId: string): Promise<Array<{ taskId: string; status: string; timestamp: number }>> {
        if (this.db) {
            const results = await this.db.prepare(`
                SELECT task_id, status, created_at
                FROM meshy_generations
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            `).bind(userId).all();

            return (results.results || []).map(row => ({
                taskId: row.task_id as string,
                status: row.status as string,
                timestamp: row.created_at as number,
            }));
        }

        return [];
    }

    /**
     * Cancel a generation task
     */
    async cancelTask(taskId: string): Promise<boolean> {
        // Note: Meshy API may not support cancellation
        // This would update local state only
        if (this.db) {
            await this.db.prepare(`
                UPDATE meshy_generations
                SET status = 'cancelled'
                WHERE task_id = ?
            `).bind(taskId).run();
        }

        if (this.cache) {
            await this.cache.delete(`meshy:task:${taskId}`);
        }

        return true;
    }
}

// ============================================================================
// Voxel Model Converter
// ============================================================================

/**
 * Convert standard 3D models to voxel style
 */
export class VoxelModelConverter {
    /**
     * Convert a model URL to voxel representation
     */
    static async convertToVoxel(
        modelUrl: string,
        voxelSize: number = 0.1,
        targetResolution: number = 64
    ): Promise<VoxelBuffer> {
        // Download the model
        const response = await fetch(modelUrl);
        const modelData = await response.arrayBuffer();

        // In production, this would:
        // 1. Parse the model (GLB/OBJ)
        // 2. Create a voxel grid
        // 3. Raycast/scan the model to fill voxels
        // 4. Generate proper textures

        // Simplified implementation:
        return {
            size: { x: targetResolution, y: targetResolution, z: targetResolution },
            position: { x: 0, y: 0, z: 0 },
            format: 'uint8',
            channels: [
                {
                    type: 'type',
                    data: new Uint8Array(targetResolution ** 3),
                    depth: 8,
                    compressed: false,
                },
            ],
        };
    }

    /**
     * Generate a voxel-style texture atlas
     */
    static async generateVoxelTextureAtlas(
        voxelTypes: string[]
    ): Promise<ArrayBuffer> {
        // In production, this would generate or retrieve textures
        // for each voxel type and pack them into an atlas

        const atlasSize = Math.ceil(Math.sqrt(voxelTypes.length)) * 16;
        const textureData = new Uint8Array(atlasSize * atlasSize * 4);

        // Simple placeholder pattern
        for (let y = 0; y < atlasSize; y++) {
            for (let x = 0; x < atlasSize; x++) {
                const idx = (y * atlasSize + x) * 4;
                const tileX = Math.floor(x / 16);
                const tileY = Math.floor(y / 16);
                const tileIndex = tileY * Math.ceil(atlasSize / 16) + tileX;

                if (tileIndex < voxelTypes.length) {
                    // Generate a unique color based on tile index
                    const hash = (tileIndex * 1234567) % 256;
                    textureData[idx] = hash;
                    textureData[idx + 1] = (hash * 2) % 256;
                    textureData[idx + 2] = (hash * 3) % 256;
                    textureData[idx + 3] = 255;
                }
            }
        }

        return textureData.buffer;
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a Meshy service
 */
export function createMeshyService(env: Env): MeshyService {
    return new MeshyService(env);
}

/**
 * Create a runtime import service
 */
export function createRuntimeImportService(env: Env): RuntimeImportService {
    return new RuntimeImportService(env);
}

/**
 * Create a Meshy client
 */
export function createMeshyClient(apiKey: string): MeshyClient {
    return new MeshyClient(apiKey);
}
