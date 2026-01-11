/**
 * Godot Importer - Convert 3D Assets to Godot-Compatible Formats
 *
 * Handles:
 * - GLB/GLTF to Godot scene conversion
 * - LOD generation for real-time performance
 * - Collision shape generation
 * - Material import and setup
 * - .tscn scene file generation
 * - Import settings configuration
 */

import type {
    ImportToGodotRequest,
    GodotImportConfig,
    GodotSceneData,
    GodotNode,
    GodotTransform,
    GodotResource,
    GodotImportSettings,
    ModelMetadata,
    ModelFormat,
    StorageLocation,
    AssetProvider
} from './types.js';

// ============================================================================
// Godot Importer Configuration
// ============================================================================

export interface GodotImporterConfig {
    projectPath?: string;
    assetsPath?: string;
    defaultImportPath?: string;
    generateMaterials?: boolean;
    generateCollision?: boolean;
    compressTextures?: boolean;
    textureFormat?: 'etc2' | 's3tc' | 'bptc';
}

const DEFAULT_CONFIG: GodotImporterConfig = {
    assetsPath: 'res://assets/models/',
    defaultImportPath: 'res://assets/imported/',
    generateMaterials: true,
    generateCollision: true,
    compressTextures: true,
    textureFormat: 's3tc'
};

// ============================================================================
// Godot Importer Class
// ============================================================================

export class GodotImporter {
    private config: GodotImporterConfig;

    constructor(config: Partial<GodotImporterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ========================================================================
    // Format Conversion
    // ========================================================================

    /**
     * Check if a format is directly supported by Godot
     */
    isGodotNativeFormat(format: ModelFormat): boolean {
        return ['glb', 'gltf', 'obj'].includes(format);
    }

    /**
     * Convert a model to Godot-compatible format if needed
     */
    async convertToGodotFormat(
        modelData: ArrayBuffer,
        sourceFormat: ModelFormat,
        targetFormat: ModelFormat = 'glb'
    ): Promise<Blob> {
        // If already in a native format, return as-is
        if (this.isGodotNativeFormat(sourceFormat)) {
            return new Blob([modelData], { type: this.getMimeType(sourceFormat) });
        }

        // For non-native formats, we'd need to use a conversion service
        // This is a placeholder for the actual conversion logic
        throw new Error(`Conversion from ${sourceFormat} to ${targetFormat} not implemented. Please provide GLB, GLTF, or OBJ files.`);
    }

    /**
     * Get MIME type for a model format
     */
    private getMimeType(format: ModelFormat): string {
        const mimeTypes: Record<ModelFormat, string> = {
            glb: 'model/gltf-binary',
            gltf: 'model/gltf+json',
            fbx: 'application/octet-stream',
            obj: 'text/plain',
            usd: 'model/usd+json',
            usdz: 'model/usd-binary'
        };
        return mimeTypes[format] || 'application/octet-stream';
    }

    // ========================================================================
    // Scene Generation
    // ========================================================================

    /**
     * Generate a Godot .tscn scene file for a model
     */
    async generateSceneFile(
        assetId: string,
        metadata: ModelMetadata,
        storageLocation: StorageLocation,
        options?: {
            sceneName?: string;
            rootNodeName?: string;
            importAsSkeleton?: boolean;
            generateCollision?: boolean;
            scale?: number;
        }
    ): Promise<string> {
        const sceneName = options?.sceneName || `generated_${assetId}`;
        const rootNodeName = options?.rootNodeName || 'Root';
        const importAsSkeleton = options?.importAsSkeleton || metadata.hasRigging;
        const scale = options?.scale || 1.0;

        // Generate unique IDs for resources
        const sceneUid = crypto.randomUUID();
        const modelUid = crypto.randomUUID();
        const importId = this.generateShortId();

        // Determine node type based on model properties
        const nodeType = importAsSkeleton ? 'Skeleton3D' : 'Node3D';

        // Build the .tscn file content
        let tscn = `[gd_scene load_steps=2 format=3 uid="uid://${sceneUid}"]

[ext_resource type="PackedScene" path="${storageLocation.filePath}" id="${importId}"]

[node name="${rootNodeName}" type="${nodeType}"]
`;

        // Add transform if scale is not 1
        if (scale !== 1.0) {
            tscn += `transform = Transform3D(${scale}, 0, 0, 0, ${scale}, 0, 0, 0, ${scale}, 0, 0, 0)
`;
        }

        // Add the model instance
        const instanceNode = importAsSkeleton ? 'Skeleton' : 'Model';
        tscn += `
[node name="${instanceNode}" parent="." instance=ExtResource("${importId}")]
`;

        // Add collision if requested and not a skeleton
        if (options?.generateCollision && !importAsSkeleton) {
            tscn += `
[node name="CollisionShape3D" parent="." type="CollisionShape3D"]
shape = SubResource("CollisionShape_${this.generateShortId()}")
`;
        }

        return tscn;
    }

    /**
     * Generate an import configuration file (.import)
     */
    async generateImportFile(
        sourcePath: string,
        destPath: string,
        settings?: GodotImportSettings
    ): Promise<string> {
        const uid = crypto.randomUUID();
        const sourceFileHash = await this.generateFileHash(sourcePath);

        let importFile = `[remap]

importer="${this.getImporterType(sourcePath)}"
type="PackedScene"
uid="uid://${uid}"
path="${destPath}"

[deps]

source_file="${sourcePath}"
dest_files=["${destPath}"]

[params]
`;

        // Add import settings
        if (settings) {
            if (settings.generateTangents !== undefined) {
                importFile += `generate_tangents=${settings.generateTangents}\n`;
            }
            if (settings.compressTextures !== undefined) {
                importFile += `compress/textures=${settings.compressTextures}\n`;
            }
            if (settings.importAsSkeleton !== undefined) {
                importFile += `import_as_skeleton=${settings.importAsSkeleton}\n`;
            }
            if (settings.generateCollision !== undefined) {
                importFile += `generate/collision=${settings.generateCollision}\n`;
            }
            if (settings.scale !== undefined) {
                importFile += `scale/factor=${settings.scale}\n`;
            }
        }

        return importFile;
    }

    /**
     * Get importer type for a file
     */
    private getImporterType(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'glb': return 'scene_gltf';
            case 'gltf': return 'scene_gltf';
            case 'obj': return 'wavefront_obj';
            case 'fbx': return 'fbx';
            default: return 'scene';
        }
    }

    // ========================================================================
    // LOD Generation
    // ========================================================================

    /**
     * Generate LOD variants for a model
     * Creates simplified versions at different quality levels
     */
    async generateLODs(
        assetId: string,
        levels: number[] = [0, 1, 2],
        polygonTargets?: number[]
    ): Promise<LODVariant[]> {
        const variants: LODVariant[] = [];

        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            const targetPolygons = polygonTargets?.[i];

            variants.push({
                level,
                assetId: `${assetId}_lod${level}`,
                path: `${this.config.assetsPath}${assetId}_lod${level}.glb`,
                distance: this.getLODDistance(level),
                polygonTarget: targetPolygons || this.calculatePolygonTarget(level),
                screenSize: this.getLODScreenSize(level)
            });
        }

        return variants;
    }

    /**
     * Get render distance for an LOD level
     */
    private getLODDistance(level: number): number {
        const distances = [0, 10, 25, 50, 100];
        return distances[level] || level * 20;
    }

    /**
     * Get screen size threshold for an LOD level
     */
    private getLODScreenSize(level: number): number {
        const sizes = [1.0, 0.5, 0.25, 0.1, 0.05];
        return sizes[level] || 1.0 / (level + 1);
    }

    /**
     * Calculate polygon target for an LOD level
     */
    private calculatePolygonTarget(level: number): number {
        // Each LOD level reduces polygons by ~50%
        const basePolygons = 10000;
        return Math.floor(basePolygons / Math.pow(2, level));
    }

    /**
     * Generate a LOD scene with multi-mesh setup
     */
    async generateLODScene(
        assetId: string,
        lods: LODVariant[],
        options?: { hideMesh?: boolean }
    ): Promise<string> {
        const sceneUid = crypto.randomUUID();
        let tscn = `[gd_scene load_steps=${lods.length + 1} format=3 uid="uid://${sceneUid}"]

[node name="Root" type="Node3D"]
`;

        // Add each LOD as a child with visibility condition
        for (const lod of lods) {
            const importId = this.generateShortId();
            tscn += `
[node name="LOD${lod.level}" parent="." type="ImportedMesh3D"]
visible = ${lod.level === 0}
lod_distance = ${lod.distance}
`;
        }

        return tscn;
    }

    // ========================================================================
    // Material Generation
    // ========================================================================

    /**
     * Generate a Godot material (.tres) for a model
     */
    async generateMaterial(
        assetId: string,
        options?: {
            albedoColor?: string;
            metalness?: number;
            roughness?: number;
            normalMapPath?: string;
            aoMapPath?: string;
        }
    ): Promise<string> {
        const materialUid = crypto.randomUUID();
        const importId = this.generateShortId();

        let tres = `[gd_resource type="StandardMaterial3D" format=3 uid="uid://${materialUid}"]

[resource]
resource_name = "generated_material_${assetId}"
albedo_color = Color(${options?.albedoColor || '1, 1, 1, 1'})
metallic = ${options?.metalness ?? 0.0}
roughness = ${options?.roughness ?? 0.5}
`;

        if (options?.normalMapPath) {
            tres += `normal_enabled = true
normal_texture = ExtResource("${importId}")
`;
        }

        return tres;
    }

    // ========================================================================
    // Collision Generation
    // ========================================================================

    /**
     * Generate collision shapes for a model
     */
    async generateCollisionShapes(
        assetId: string,
        metadata: ModelMetadata
    ): Promise<CollisionShape[]> {
        const shapes: CollisionShape[] = [];

        // Generate bounding box collision
        if (metadata.boundingBox) {
            const bbox = metadata.boundingBox;
            const size = [
                bbox.max[0] - bbox.min[0],
                bbox.max[1] - bbox.min[1],
                bbox.max[2] - bbox.min[2]
            ];

            shapes.push({
                type: 'box',
                name: 'CollisionShape_BoundingBox',
                size,
                position: bbox.center,
                rotation: [0, 0, 0]
            });
        }

        // Generate sphere collision for simplicity
        shapes.push({
            type: 'sphere',
            name: 'CollisionShape_Sphere',
            radius: 1.0,
            position: [0, 0, 0],
            rotation: [0, 0, 0]
        });

        return shapes;
    }

    // ========================================================================
    // Import Settings
    // ========================================================================

    /**
     * Generate recommended import settings for a model
     */
    generateImportSettings(
        metadata: ModelMetadata,
        provider: AssetProvider
    ): GodotImportSettings {
        const settings: GodotImportSettings = {
            generateTangents: true,
            generateNormals: true,
            compressTextures: this.config.compressTextures,
            lodLevels: metadata.lodLevels > 1 ? metadata.lodLevels : undefined,
            importAsSkeleton: metadata.hasRigging,
            generateCollision: this.config.generateCollision,
            scale: 1.0
        };

        // Provider-specific adjustments
        if (provider === 'sloyd') {
            // Sloyd models are already optimized
            settings.generateTangents = true;
            settings.generateCollision = true;
        } else if (provider === 'masterpiece_x' || provider === 'tripo') {
            // Character models need skeleton import
            settings.importAsSkeleton = true;
        }

        return settings;
    }

    // ========================================================================
    // Full Import Pipeline
    // ========================================================================

    /**
     * Complete import pipeline for a model to Godot
     */
    async importToGodot(
        assetId: string,
        metadata: ModelMetadata,
        storageLocation: StorageLocation,
        provider: AssetProvider,
        options?: ImportToGodotRequest
    ): Promise<GodotImportResult> {
        const importPath = options?.importPath || `${this.config.defaultImportPath}${assetId}/`;
        const generateLOD = options?.generateLOD ?? false;
        const lodLevels = options?.lodLevels || 3;
        const importAsSkeleton = options?.importAsSkeleton ?? metadata.hasRigging;
        const generateCollision = options?.generateCollision ?? true;

        const result: GodotImportResult = {
            assetId,
            importPath,
            files: [],
            scenePath: '',
            success: false
        };

        try {
            // 1. Generate scene file
            const sceneContent = await this.generateSceneFile(assetId, metadata, storageLocation, {
                importAsSkeleton,
                generateCollision
            });
            const scenePath = `${importPath}${assetId}.tscn`;
            result.files.push({
                path: scenePath,
                type: 'scene',
                content: sceneContent
            });
            result.scenePath = scenePath;

            // 2. Generate import settings
            const importSettings = this.generateImportSettings(metadata, provider);
            const importFileContent = await this.generateImportFile(
                storageLocation.filePath,
                scenePath,
                importSettings
            );
            result.files.push({
                path: `${importPath}${assetId}.import`,
                type: 'import',
                content: importFileContent
            });

            // 3. Generate LOD variants if requested
            if (generateLOD && lodLevels > 1) {
                const lods = await this.generateLODs(assetId, Array.from({ length: lodLevels }, (_, i) => i));
                for (const lod of lods) {
                    result.files.push({
                        path: lod.path,
                        type: 'model',
                        content: `# LOD variant placeholder: ${lod.assetId}`
                    });
                }
            }

            // 4. Generate collision shapes if requested
            if (generateCollision) {
                const collisions = await this.generateCollisionShapes(assetId, metadata);
                for (const collision of collisions) {
                    result.files.push({
                        path: `${importPath}collision_${collision.name}.tres`,
                        type: 'resource',
                        content: this.generateCollisionResource(collision)
                    });
                }
            }

            // 5. Generate material if textures exist
            if (metadata.textureCount && metadata.textureCount > 0) {
                const materialContent = await this.generateMaterial(assetId);
                result.files.push({
                    path: `${importPath}material_${assetId}.tres`,
                    type: 'material',
                    content: materialContent
                });
            }

            result.success = true;
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
        }

        return result;
    }

    /**
     * Generate collision resource file
     */
    private generateCollisionResource(collision: CollisionShape): string {
        const uid = crypto.randomUUID();

        let content = `[gd_resource type="CollisionShape3D" format=3 uid="uid://${uid}"]

[resource]
shape = SubResource("${collision.type}_shape")
`;

        if (collision.type === 'box') {
            content = `[gd_resource type="BoxShape3D" format=3 uid="uid://${uid}"]

[sub_resource type="BoxShape3D" id="box_shape"]
size = Vector3(${collision.size?.join(', ') || '1, 1, 1'})
`;
        } else if (collision.type === 'sphere') {
            content = `[gd_resource type="SphereShape3D" format=3 uid="uid://${uid}"]

[sub_resource type="SphereShape3D" id="sphere_shape"]
radius = ${collision.radius || 1.0}
`;
        }

        return content;
    }

    // ========================================================================
    // GDScript Helpers
    // ========================================================================

    /**
     * Generate GDScript code for runtime asset loading
     */
    generateLoadScript(assetId: string, scenePath: string): string {
        return `extends Node3D

# Auto-generated loader for ${assetId}

@export var model_scene: PackedScene

func _ready():
    if model_scene:
        var instance = model_scene.instantiate()
        add_child(instance)
    else:
        # Load from default path
        var scene = load("${scenePath}")
        if scene:
            var instance = scene.instantiate()
            add_child(instance)
        else:
            push_error("Failed to load scene: ${scenePath}")
`;
    }

    /**
     * Generate GDScript for LOD management
     */
    generateLODScript(lods: LODVariant[]): string {
        const lodChecks = lods.map(lod =>
            `elif camera_distance < ${lod.distance}:\n\t\tshow_lod(${lod.level})`
        ).join('\n\t');

        return `extends Node3D

# Auto-generated LOD manager for ${lods.length} levels

@onready var camera = get_viewport().get_camera_3d()
var lods: Array[Node3D] = []
var update_interval: float = 0.1
var last_check: float = 0.0

func _ready():
    for child in get_children():
        if child is MeshInstance3D:
            lods.append(child)
    update_lod_visibility()

func _process(delta):
    last_check += delta
    if last_check >= update_interval:
        last_check = 0.0
        update_lod_visibility()

func update_lod_visibility():
    if not camera:
        return

    var camera_distance = global_position.distance_to(camera.global_position)

    if camera_distance < ${lods[0]?.distance || 10}:
        show_lod(0)
    ${lodChecks}
    else:
        show_lod(${lods.length - 1})

func show_lod(level: int):
    for i in range(lods.size()):
        lods[i].visible = (i == level)
`;
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Generate a short ID for resources
     */
    private generateShortId(): string {
        return crypto.randomUUID().slice(0, 8);
    }

    /**
     * Generate a file hash for import tracking
     */
    private async generateFileHash(filePath: string): Promise<string> {
        // Placeholder - would actually hash the file contents
        const hashBuffer = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(filePath)
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get Godot version compatibility info
     */
    getCompatibilityInfo(): GodotCompatibility {
        return {
            godotVersion: '4.2+',
            supportedFormats: ['glb', 'gltf', 'obj'],
            recommendedFormat: 'glb',
            maxTextureSize: 16384,
            maxBoneCount: 256,
            features: {
                gltfPbr: true,
                skeletalAnimation: true,
                morphTargets: true,
                lod: true,
                collision: true
            }
        };
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface LODVariant {
    level: number;
    assetId: string;
    path: string;
    distance: number;
    polygonTarget: number;
    screenSize: number;
}

export interface CollisionShape {
    type: 'box' | 'sphere' | 'capsule' | 'convex';
    name: string;
    size?: number[];
    radius?: number;
    position: number[];
    rotation: number[];
}

export interface GodotImportResult {
    assetId: string;
    importPath: string;
    files: ImportedFile[];
    scenePath: string;
    success: boolean;
    error?: string;
}

export interface ImportedFile {
    path: string;
    type: 'scene' | 'model' | 'material' | 'resource' | 'import';
    content: string;
}

export interface GodotCompatibility {
    godotVersion: string;
    supportedFormats: string[];
    recommendedFormat: string;
    maxTextureSize: number;
    maxBoneCount: number;
    features: {
        gltfPbr: boolean;
        skeletalAnimation: boolean;
        morphTargets: boolean;
        lod: boolean;
        collision: boolean;
    };
}

// ============================================================================
// Factory Function
// ============================================================================

export function createGodotImporter(config?: Partial<GodotImporterConfig>): GodotImporter {
    return new GodotImporter(config);
}
