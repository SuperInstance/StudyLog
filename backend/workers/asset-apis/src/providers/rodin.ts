/**
 * Rodin Gen-2 Provider Integration
 * Godot plugin support, mesh generation, texture baking
 *
 * API Docs: https://docs.rodin.ai
 */

import {
    RodinConfig,
    RodinResponse,
    Generate3DRequest,
    GenerationResponse,
    Model3DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.rodin.ai/v2';

// Rodin Gen-2 specialized models
const RODIN_MODELS = [
    'rodin-gen-2',           // Standard text-to-3D
    'rodin-gen-2-turbo',     // Faster, lower quality
    'rodin-gen-2-hd',        // High detail
    'rodin-gen-2-character', // Character specialization
    'rodin-gen-2-prop'       // Props and objects
] as const;

// ============================================================================
// Rodin Gen-2 Provider Class
// ============================================================================

export class RodinProvider {
    private config: RodinConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private godotPluginInstalled: boolean;

    constructor(config: RodinConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 15;
        this.rateLimitResetAt = Date.now() + 60000;
        this.godotPluginInstalled = !!config.godotPluginPath;
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 15;
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
            throw new Error(`Rodin API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Text to 3D
    // ========================================================================

    /**
     * Generate a 3D model from text description
     */
    async textTo3D(request: Generate3DRequest & RodinGenerationParams): Promise<GenerationResponse> {
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
            const response = await this.request<RodinResponse>('/generate/text', {
                method: 'POST',
                body: JSON.stringify({
                    model: request.model || 'rodin-gen-2',
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    quality: request.quality || 'medium',
                    mesh_format: request.meshFormat || 'glb',
                    texture_resolution: request.textureResolution || 1024,
                    bake_lighting: request.bakeLighting || false,
                    enable_normals: request.enableNormals !== false,
                    enable_ao: request.enableAO || false
                })
            });

            return {
                success: true,
                assetId: response.task_id,
                status: 'processing',
                estimatedTimeSeconds: this.estimateTime(request),
                pollUrl: `/api/v1/assets/3d/status/${response.task_id}`,
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
        request: Generate3DRequest & { inputImage: string } & Partial<RodinGenerationParams>
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            let imageBody = request.inputImage;
            if (imageBody.startsWith('data:')) {
                imageBody = imageBody.split(',')[1];
            }

            const response = await this.request<RodinResponse>('/generate/image', {
                method: 'POST',
                body: JSON.stringify({
                    model: 'rodin-gen-2',
                    image: imageBody,
                    prompt: request.prompt || '',
                    quality: request.quality || 'medium',
                    mesh_format: request.meshFormat || 'glb',
                    texture_resolution: request.textureResolution || 1024,
                    bake_lighting: request.bakeLighting || false,
                    multi_view: request.multiView || false
                })
            });

            return {
                success: true,
                assetId: response.task_id,
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/3d/status/${response.task_id}`,
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
    // Texture Baking
    // ========================================================================

    /**
     * Bake high-quality textures onto a model
     * Includes diffuse, normal, roughness, metallic, and AO maps
     */
    async bakeTextures(
        modelId: string,
        params: RodinTextureBakeParams
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RodinResponse>(`/model/${modelId}/bake`, {
                method: 'POST',
                body: JSON.stringify({
                    resolution: params.resolution || 2048,
                    bake_diffuse: params.bakeDiffuse !== false,
                    bake_normal: params.bakeNormal !== false,
                    bake_roughness: params.bakeRoughness !== false,
                    bake_metallic: params.bakeMetallic !== false,
                    bake_ao: params.bakeAO !== false,
                    bake_curvature: params.bakeCurvature || false,
                    samples: params.samples || 64
                })
            });

            return {
                success: true,
                assetId: response.task_id,
                status: 'processing',
                estimatedTimeSeconds: 120,
                pollUrl: `/api/v1/assets/3d/status/${response.task_id}`,
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
    // Mesh Optimization
    // ========================================================================

    /**
     * Optimize mesh for real-time rendering
     * Reduces polygon count while maintaining visual quality
     */
    async optimizeMesh(
        modelId: string,
        params: RodinOptimizationParams
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RodinResponse>(`/model/${modelId}/optimize`, {
                method: 'POST',
                body: JSON.stringify({
                    target_polygons: params.targetPolygons,
                    preserve_silhouette: params.preserveSilhouette !== false,
                    preserve_uv: params.preserveUV !== false,
                    preserve_materials: params.preserveMaterials !== false,
                    simplify_method: params.simplifyMethod || 'quadric'
                })
            });

            return {
                success: true,
                assetId: response.task_id,
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/3d/status/${response.task_id}`,
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
    async getTaskStatus(taskId: string): Promise<RodinResponse> {
        return this.request<RodinResponse>(`/task/${taskId}`);
    }

    /**
     * Wait for task completion
     */
    async waitForTask(
        taskId: string,
        timeoutMs: number = 300000
    ): Promise<RodinResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);

            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
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

        if (status.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        if (!status.model_url) {
            throw new Error('No model URL available');
        }

        const response = await fetch(status.model_url);
        if (!response.ok) {
            throw new Error(`Failed to download model: ${response.status}`);
        }

        return response.blob();
    }

    /**
     * Download baked texture maps
     */
    async downloadTextureMaps(taskId: string): Promise<RodinTextureMaps | null> {
        try {
            return await this.request<RodinTextureMaps>(`/task/${taskId}/textures`);
        } catch {
            return null;
        }
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
            previewImageUrl: undefined,
            godotCompatible: true,
            theiaMetadata: {
                importPath: `res://assets/models/rodin_${taskId}.glb`,
                resourceType: 'PackedScene',
                autoImport: true,
                customImportSettings: {
                    import_as_mesh: true,
                    generate_tangents: true
                }
            }
        };
    }

    // ========================================================================
    // Godot Integration
    // ========================================================================

    /**
     * Check if Godot plugin is installed
     */
    isGodotPluginAvailable(): boolean {
        return this.godotPluginInstalled;
    }

    /**
     * Get Godot plugin installation instructions
     */
    getGodotPluginInstructions(): string {
        return `
# Rodin Gen-2 Godot Plugin Installation

1. Download the plugin from: https://godot.rodin.ai/download
2. Extract to your Godot project's 'addons/' folder
3. Enable the plugin in Project Settings > Plugins
4. Configure your API key in Project Settings > Rodin

## Usage in GDScript:

```gdscript
extends Node3D

@onready var rodin = $RodinGenerator

func _ready():
    # Generate a model from text
    rodin.generate_from_text("A fantasy sword", func(task_id):
        print("Generation started: " + task_id)
    )

func _on_rodin_generation_completed(model_path):
    var scene = load(model_path).instantiate()
    add_child(scene)
```

## Plugin Settings:

- API Endpoint: ${this.config.endpoint}
- Default Quality: medium
- Default Texture Resolution: 1024
- Auto-import: true
        `;
    }

    /**
     * Generate a Godot scene file (.tscn) for a model
     */
    async generateGodotScene(
        taskId: string,
        sceneName: string = 'generated_model'
    ): Promise<string> {
        const status = await this.getTaskStatus(taskId);

        if (status.status !== 'completed' || !status.model_url) {
            throw new Error('Task not completed or no model available');
        }

        // Generate a basic .tscn file content
        const sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://${crypto.randomUUID()}"]

[ext_resource type="PackedScene" uid="uid://${crypto.randomUUID()}" path="${status.model_url}" id="1_${crypto.randomUUID().slice(0, 8)}"]

[node name="${sceneName}" type="Node3D"]

[node name="Model" parent="." instance=ExtResource("1_${crypto.randomUUID().slice(0, 8)}")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

        return sceneContent;
    }

    /**
     * Export model directly to Godot project folder
     */
    async exportToGodotProject(
        taskId: string,
        projectPath: string,
        subfolder: string = 'res://assets/models/'
    ): Promise<string> {
        const modelBlob = await this.downloadModel(taskId);
        const fileName = `rodin_${taskId}.glb`;
        const fullPath = `${subfolder}${fileName}`;

        // In a real implementation, this would write to the filesystem
        // For Cloudflare Workers, this would be handled differently
        return fullPath;
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private estimateTime(request: Generate3DRequest & Partial<RodinGenerationParams>): number {
        let baseTime = 45;

        const model = request.model || 'rodin-gen-2';
        if (model === 'rodin-gen-2-hd') {
            baseTime *= 2;
        } else if (model === 'rodin-gen-2-turbo') {
            baseTime *= 0.5;
        }

        if (request.quality === 'high') {
            baseTime *= 1.5;
        }

        if (request.textureResolution && request.textureResolution > 1024) {
            baseTime *= 1.2;
        }

        return Math.ceil(baseTime);
    }

    /**
     * Validate request
     */
    validateRequest(request: Generate3DRequest & Partial<RodinGenerationParams>): {
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

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost
     */
    estimateCost(request: Generate3DRequest & Partial<RodinGenerationParams>): number {
        let baseCost = 0.07;

        const model = request.model || 'rodin-gen-2';
        if (model === 'rodin-gen-2-hd') {
            baseCost *= 2;
        } else if (model === 'rodin-gen-2-turbo') {
            baseCost *= 0.7;
        }

        if (request.bakeLighting) {
            baseCost += 0.02;
        }

        return baseCost;
    }

    /**
     * Get available models
     */
    getAvailableModels(): readonly string[] {
        return RODIN_MODELS;
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface RodinGenerationParams {
    model?: typeof RODIN_MODELS[number];
    quality?: 'low' | 'medium' | 'high';
    meshFormat?: 'glb' | 'gltf' | 'obj' | 'fbx';
    textureResolution?: 512 | 1024 | 2048 | 4096;
    bakeLighting?: boolean;
    enableNormals?: boolean;
    enableAO?: boolean;
    multiView?: boolean;
}

export interface RodinTextureBakeParams {
    resolution?: 1024 | 2048 | 4096;
    bakeDiffuse?: boolean;
    bakeNormal?: boolean;
    bakeRoughness?: boolean;
    bakeMetallic?: boolean;
    bakeAO?: boolean;
    bakeCurvature?: boolean;
    samples?: number;
}

export interface RodinOptimizationParams {
    targetPolygons: number;
    preserveSilhouette?: boolean;
    preserveUV?: boolean;
    preserveMaterials?: boolean;
    simplifyMethod?: 'quadric' | 'edge_collapse';
}

export interface RodinTextureMaps {
    diffuse?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    ao?: string;
    curvature?: string;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRodinProvider(config: RodinConfig): RodinProvider {
    return new RodinProvider(config);
}
