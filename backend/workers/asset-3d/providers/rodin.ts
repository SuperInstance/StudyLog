/**
 * Rodin Gen-2 Provider
 * Godot plugin support, mesh generation, texture baking
 * API: https://docs.rodin.ai
 */

import type {
    RodinConfig,
    RodinResponse,
    RodinTextureMaps,
    GenerateModelRequest,
    GenerationResponse,
    ModelMetadata
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.rodin.ai/v2';

const RODIN_MODELS = [
    'rodin-gen-2',
    'rodin-gen-2-turbo',
    'rodin-gen-2-hd',
    'rodin-gen-2-character',
    'rodin-gen-2-prop'
] as const;

export class RodinProvider {
    private config: Required<RodinConfig>;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: RodinConfig) {
        this.config = {
            apiKey: config.apiKey,
            endpoint: config.endpoint || DEFAULT_ENDPOINT,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 3,
            godotPluginPath: config.godotPluginPath || '',
            defaultTextureResolution: config.defaultTextureResolution || 1024,
            rateLimit: config.rateLimit || { requestsPerMinute: 15, requestsPerDay: 300 }
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
            throw new Error(`Rodin API error: ${response.status} - ${error}`);
        }
        return response.json() as Promise<T>;
    }

    async textTo3D(request: GenerateModelRequest & {
        model?: typeof RODIN_MODELS[number];
        quality?: 'low' | 'medium' | 'high';
        meshFormat?: 'glb' | 'gltf' | 'obj' | 'fbx';
        textureResolution?: 512 | 1024 | 2048 | 4096;
        bakeLighting?: boolean;
        enableNormals?: boolean;
        enableAO?: boolean;
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);
        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId,
                provider: 'rodin'
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
                    texture_resolution: request.textureResolution || this.config.defaultTextureResolution,
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
                requestId,
                provider: 'rodin',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rodin'
            };
        }
    }

    async imageTo3D(
        request: GenerateModelRequest & { inputImage: string } & Partial<{
            quality: 'low' | 'medium' | 'high';
            meshFormat: 'glb' | 'gltf' | 'obj' | 'fbx';
            textureResolution: 512 | 1024 | 2048 | 4096;
            bakeLighting: boolean;
            multiView: boolean;
        }>
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
                    texture_resolution: request.textureResolution || this.config.defaultTextureResolution,
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
                requestId,
                provider: 'rodin',
                costUsd: 0.07
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rodin'
            };
        }
    }

    async bakeTextures(
        modelId: string,
        params: {
            resolution?: 1024 | 2048 | 4096;
            bakeDiffuse?: boolean;
            bakeNormal?: boolean;
            bakeRoughness?: boolean;
            bakeMetallic?: boolean;
            bakeAO?: boolean;
            bakeCurvature?: boolean;
            samples?: number;
        }
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
                requestId,
                provider: 'rodin',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rodin'
            };
        }
    }

    async optimizeMesh(
        modelId: string,
        params: {
            targetPolygons: number;
            preserveSilhouette?: boolean;
            preserveUV?: boolean;
            preserveMaterials?: boolean;
            simplifyMethod?: 'quadric' | 'edge_collapse';
        }
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
                requestId,
                provider: 'rodin',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'rodin'
            };
        }
    }

    async getTaskStatus(taskId: string): Promise<RodinResponse> {
        return this.request<RodinResponse>(`/task/${taskId}`);
    }

    async waitForTask(taskId: string, timeoutMs: number = 300000): Promise<RodinResponse> {
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

    async downloadTextureMaps(taskId: string): Promise<RodinTextureMaps | null> {
        try {
            return await this.request<RodinTextureMaps>(`/task/${taskId}/textures`);
        } catch {
            return null;
        }
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
            hasRigging: false,
            hasAnimation: false,
            hasUVUnwrapping: true,
            lodLevels: 1,
            fileSizeBytes: 0,
            previewImageUrl: undefined,
            godotCompatible: true
        };
    }

    isGodotPluginAvailable(): boolean {
        return !!this.config.godotPluginPath;
    }

    getGodotPluginInstructions(): string {
        return `
# Rodin Gen-2 Godot Plugin Installation

1. Download the plugin from: https://godot.rodin.ai/download
2. Extract to your Godot project's 'addons/' folder
3. Enable the plugin in Project Settings > Plugins
4. Configure your API key in Project Settings > Rodin

## Usage in GDScript:

\`\`\`gdscript
extends Node3D

@onready var rodin = $RodinGenerator

func _ready():
    rodin.generate_from_text("A fantasy sword", func(task_id):
        print("Generation started: " + task_id)
    )

func _on_rodin_generation_completed(model_path):
    var scene = load(model_path).instantiate()
    add_child(scene)
\`\`\`

## Plugin Settings:
- API Endpoint: ${this.config.endpoint}
- Default Quality: medium
- Default Texture Resolution: ${this.config.defaultTextureResolution}
- Auto-import: true
        `;
    }

    async generateGodotScene(taskId: string, sceneName: string = 'generated_model'): Promise<string> {
        const status = await this.getTaskStatus(taskId);
        if (status.status !== 'completed' || !status.model_url) {
            throw new Error('Task not completed or no model available');
        }
        const uid1 = crypto.randomUUID();
        const uid2 = crypto.randomUUID().slice(0, 8);
        const sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://${uid1}"]

[ext_resource type="PackedScene" uid="uid://${uid1}" path="${status.model_url}" id="1_${uid2}"]

[node name="${sceneName}" type="Node3D"]

[node name="Model" parent="." instance=ExtResource("1_${uid2}")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;
        return sceneContent;
    }

    private estimateTime(request: GenerateModelRequest & {
        model?: typeof RODIN_MODELS[number];
        textureResolution?: number;
        bakeLighting?: boolean;
    }): number {
        let baseTime = 45;
        const model = request.model || 'rodin-gen-2';
        if (model === 'rodin-gen-2-hd') {
            baseTime *= 2;
        } else if (model === 'rodin-gen-2-turbo') {
            baseTime *= 0.5;
        }
        if (request.quality === 'high' || request.quality === 'ultra') {
            baseTime *= 1.5;
        }
        if (request.textureResolution && request.textureResolution > 1024) {
            baseTime *= 1.2;
        }
        if (request.bakeLighting) {
            baseTime *= 1.5;
        }
        return Math.ceil(baseTime);
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
        model?: typeof RODIN_MODELS[number];
        bakeLighting?: boolean;
    }): number {
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

    getAvailableModels(): readonly string[] {
        return RODIN_MODELS;
    }

    isAvailable(): boolean {
        return this.config.enabled && !!this.config.apiKey;
    }
}

export function createRodinProvider(config: RodinConfig): RodinProvider {
    return new RodinProvider(config);
}
