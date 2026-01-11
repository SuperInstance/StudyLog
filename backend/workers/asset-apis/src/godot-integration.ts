/**
 * Godot Integration Module
 * Handles export to Godot-compatible formats and Theia IDE integration
 */

import {
    Model3DAsset,
    AudioAsset,
    Art2DAsset,
    ModelFormat,
    AudioFormat,
    ImageFormat,
    GodotImportConfig,
    GodotSceneData,
    GodotNode
} from './types.js';

// ============================================================================
// Godot Import Configuration
// ============================================================================

interface GodotProjectConfig {
    projectPath: string;
    importPaths: {
        models?: string;
        textures?: string;
        audio?: string;
        scenes?: string;
    };
    autoReimport?: boolean;
    compression?: {
        textures?: 'lossless' | 'lossy' | 'vram' | 'bvram' | 'etc2';
        meshes?: boolean;
    };
}

// ============================================================================
// Godot Integration Class
// ============================================================================

export class GodotIntegration {
    private config: GodotProjectConfig;

    constructor(config: GodotProjectConfig) {
        this.config = config;
    }

    // ========================================================================
    // 3D Model Import
    // ========================================================================

    /**
     * Prepare a 3D model for Godot import
     */
    async prepareModelImport(asset: Model3DAsset): Promise<GodotImportConfig> {
        const format = asset.metadata.format;

        // Determine import settings based on format
        const importSettings: Record<string, unknown> = {
            'glb': this.getGLBImportSettings(asset),
            'gltf': this.getGLTFImportSettings(asset),
            'fbx': this.getFBXImportSettings(asset),
            'obj': this.getOBJImportSettings(asset),
            'usd': this.getUSDImportSettings(asset)
        }[format] || {};

        return {
            importPath: this.getImportPath('models', asset.id, format),
            importType: this.getModelImportType(asset),
            importSettings,
            postImportScript: asset.metadata.hasRigging ? this.getRiggingPostScript(asset) : undefined
        };
    }

    /**
     * Generate a .tscn scene file for a model
     */
    async generateSceneFile(
        asset: Model3DAsset,
        sceneName: string
    ): Promise<string> {
        const importConfig = await this.prepareModelImport(asset);
        const uid = crypto.randomUUID();

        let sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://${uid}"]

[ext_resource type="${this.getGodotResourceType(asset)}" path="${importConfig.importPath}" id="model_${uid.slice(0, 8)}"]

[node name="${sceneName}" type="Node3D"]

[node name="Model" parent="." instance=ExtResource("model_${uid.slice(0, 8)}")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
`;

        // Add collision shape if applicable
        if (asset.metadata.theiaMetadata?.customImportSettings?.import_as_mesh) {
            sceneContent += `
[node name="CollisionShape3D" type="CollisionShape3D" parent="Model"]
shape = SubResource("collision_shape_${uid.slice(0, 8)}")

[sub_resource type="BoxShape3D" id="collision_shape_${uid.slice(0, 8)}"]
size = Vector3(1, 1, 1)
`;
        }

        return sceneContent;
    }

    /**
     * Generate an exported scene with full node tree
     */
    async generateSceneData(
        asset: Model3DAsset,
        sceneName: string
    ): Promise<GodotSceneData> {
        const nodes: GodotNode[] = [];

        // Root node
        nodes.push({
            name: sceneName,
            type: 'Node3D',
            transform: {
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            }
        });

        // Model instance
        nodes.push({
            name: 'Model',
            type: this.getModelImportType(asset),
            parent: sceneName,
            transform: {
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1]
            },
            properties: {
                'import_path': this.getImportPath('models', asset.id, asset.metadata.format)
            }
        });

        // Add collision if needed
        if (asset.metadata.theiaMetadata?.customImportSettings?.import_as_mesh) {
            nodes.push({
                name: 'StaticBody3D',
                type: 'StaticBody3D',
                parent: sceneName,
                transform: {
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1]
                }
            });

            nodes.push({
                name: 'CollisionShape3D',
                type: 'CollisionShape3D',
                parent: 'StaticBody3D',
                properties: {
                    'shape': 'BoxShape3D'
                }
            });
        }

        return {
            scenePath: `res://scenes/${sceneName}.tscn`,
            nodes,
            rootType: 'Node3D',
            importSettings: {
                generate_collision: true,
                generate_navmesh: false
            }
        };
    }

    // ========================================================================
    // Audio Import
    // ========================================================================

    /**
     * Prepare audio for Godot import
     */
    prepareAudioImport(asset: AudioAsset): GodotImportConfig {
        const format = asset.metadata.format;

        const importSettings: Record<string, unknown> = {
            'mp3': { compress: true },
            'ogg': { compress: true },
            'wav': { compress: false },
            'flac': { compress: false }
        }[format] || {};

        return {
            importPath: this.getImportPath('audio', asset.id, format),
            importType: 'Audio',
            importSettings
        };
    }

    /**
     * Generate an AudioStreamPlayer3D configuration
     */
    generateAudioPlayerConfig(
        asset: AudioAsset,
        playerName: string
    ): string {
        const importConfig = this.prepareAudioImport(asset);
        const uid = crypto.randomUUID();

        return `[gd_scene load_steps=2 format=3 uid="uid://${uid}"]

[ext_resource type="AudioStream" path="${importConfig.importPath}" id="audio_${uid.slice(0, 8)}"]

[node name="${playerName}" type="AudioStreamPlayer3D"]
stream = ExtResource("audio_${uid.slice(0, 8)}")
max_distance = 50.0
attenuation = 2.0
`;
    }

    // ========================================================================
    // Texture/2D Art Import
    // ========================================================================

    /**
     * Prepare texture for Godot import
     */
    prepareTextureImport(asset: Art2DAsset): GodotImportConfig {
        const format = asset.metadata.format;

        const importSettings: Record<string, unknown> = {
            compression: this.config.compression?.textures || 'lossless',
            filter: true,
            mipmaps: asset.metadata.width > 512,
            srgb: true
        };

        // Sprite sheet specific settings
        if (asset.metadata.isSpriteSheet) {
            importSettings['import_as_sprite_frames'] = true;
            importSettings['horizontal_frames'] = asset.metadata.spriteColumns || 1;
            importSettings['vertical_frames'] = asset.metadata.spriteRows || 1;
        }

        return {
            importPath: this.getImportPath('textures', asset.id, format),
            importType: asset.metadata.godotImportType || 'Texture2D',
            importSettings
        };
    }

    /**
     * Generate a sprite frames configuration
     */
    generateSpriteFramesConfig(
        asset: Art2DAsset,
        animationName: string = 'default'
    ): string {
        const importConfig = this.prepareTextureImport(asset);
        const uid = crypto.randomUUID();
        const columns = asset.metadata.spriteColumns || 1;
        const rows = asset.metadata.spriteRows || 1;
        const fps = asset.metadata.framesPerSecond || 12;

        return `[gd_resource type="SpriteFrames" load_steps=2 format=3 uid="uid://${uid}"]

[ext_resource type="Texture2D" path="${importConfig.importPath}" id="texture_${uid.slice(0, 8)}"]

[resource]
animations = [{
  "frames": [{
    "duration": 1.0,
    "texture": ExtResource("texture_${uid.slice(0, 8)}")
  }],
  "loop": true,
  "name": &"${animationName}",
  "speed": ${fps.0}
}]
`;
    }

    // ========================================================================
    // Character Import (Rigged Models)
    // ========================================================================

    /**
     * Generate an AnimatedCharacter3D scene
     */
    async generateCharacterScene(
        asset: Model3DAsset,
        characterName: string,
        animations?: string[]
    ): Promise<string> {
        const importConfig = await this.prepareModelImport(asset);
        const uid = crypto.randomUUID();

        let sceneContent = `[gd_scene load_steps=2 format=3 uid="uid://${uid}"]

[ext_resource type="${this.getGodotResourceType(asset)}" path="${importConfig.importPath}" id="character_${uid.slice(0, 8)}"]

[node name="${characterName}" type="CharacterBody3D"]

[node name="Visual" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.5, 0)

[node name="Skeleton3D" parent="Visual" instance=ExtResource("character_${uid.slice(0, 8)}")]
`;

        // Add AnimationTree if rigging is present
        if (asset.metadata.hasRigging) {
            sceneContent += `
[node name="AnimationTree" type="AnimationTree" parent="."]
tree_root = SubResource("animation_library_${uid.slice(0, 8)}")
active = true

[sub_resource type="AnimationNodeBlendTree" id="animation_library_${uid.slice(0, 8)}"]
`;
        }

        // Add collision shape
        sceneContent += `
[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
shape = SubResource("capsule_${uid.slice(0, 8)}")

[sub_resource type="CapsuleShape3D" id="capsule_${uid.slice(0, 8)}"]
radius = 0.5
height = 2.0
`;

        return sceneContent;
    }

    // ========================================================================
    // Theia IDE Integration
    // ========================================================================

    /**
     * Generate Theia IDE metadata for an asset
     */
    async generateTheiaMetadata(asset: Model3DAsset | AudioAsset | Art2DAsset): Promise<{
        id: string;
        type: string;
        importPath: string;
        resourceType: string;
        previewUrl?: string;
        autoImport: boolean;
        customImportSettings?: Record<string, unknown>;
    }> {
        const baseMetadata = {
            id: asset.id,
            type: asset.type,
            autoImport: true
        };

        if (asset.type === '3d_model' || asset.type === 'environment') {
            const modelAsset = asset as Model3DAsset;
            const importConfig = await this.prepareModelImport(modelAsset);

            return {
                ...baseMetadata,
                importPath: importConfig.importPath,
                resourceType: this.getGodotResourceType(modelAsset),
                previewUrl: modelAsset.metadata.previewImageUrl,
                customImportSettings: modelAsset.metadata.theiaMetadata?.customImportSettings
            };
        } else if (asset.type === 'audio') {
            const audioAsset = asset as AudioAsset;
            const importConfig = this.prepareAudioImport(audioAsset);

            return {
                ...baseMetadata,
                importPath: importConfig.importPath,
                resourceType: 'AudioStream',
                previewUrl: audioAsset.metadata.previewUrl
            };
        } else {
            const artAsset = asset as Art2DAsset;
            const importConfig = this.prepareTextureImport(artAsset);

            return {
                ...baseMetadata,
                importPath: importConfig.importPath,
                resourceType: importConfig.importType || 'Texture2D'
            };
        }
    }

    /**
     * Generate Theia IDE project import script
     */
    generateTheiaImportScript(assets: Array<Model3DAsset | AudioAsset | Art2DAsset>): string {
        const gdscript = `# Theia IDE Asset Import Script
# Generated by Asset API

extends EditorScript

func _run():
    var import_success = true

${assets.map(asset => this.generateTheiaImportLine(asset)).join('\n')}

    if import_success:
        print("All assets imported successfully!")
    else:
        print("Some assets failed to import. Check the console for details.")
`;

        return gdscript;
    }

    private generateTheiaImportLine(asset: Model3DAsset | AudioAsset | Art2DAsset): string {
        if (asset.type === '3d_model' || asset.type === 'environment') {
            const modelAsset = asset as Model3DAsset;
            return `    # Import 3D model: ${asset.id}
    import_model("${modelAsset.metadata.format}", "${this.getImportPath('models', asset.id, modelAsset.metadata.format)}")`;
        } else if (asset.type === 'audio') {
            const audioAsset = asset as AudioAsset;
            return `    # Import audio: ${asset.id}
    import_audio("${audioAsset.metadata.format}", "${this.getImportPath('audio', asset.id, audioAsset.metadata.format)}")`;
        } else {
            const artAsset = asset as Art2DAsset;
            return `    # Import texture: ${asset.id}
    import_texture("${artAsset.metadata.format}", "${this.getImportPath('textures', asset.id, artAsset.metadata.format)}")`;
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private getImportPath(category: string, assetId: string, extension: string): string {
        const basePath = this.config.importPaths?.[category] || `res://assets/${category}/`;
        return `${basePath}${assetId}.${extension}`;
    }

    private getModelImportType(asset: Model3DAsset): string {
        if (asset.metadata.hasRigging) {
            return 'Skeleton3D';
        }
        return 'PackedScene';
    }

    private getGodotResourceType(asset: Model3DAsset): string {
        if (asset.metadata.hasRigging) {
            return 'PackedScene'; // Skeleton3D is contained in PackedScene
        }
        return 'PackedScene';
    }

    private getGLBImportSettings(asset: Model3DAsset): Record<string, unknown> {
        return {
            'importer': 'scene',
            'scale': 0.01,
            'generate_tangents': true,
            'force_generate_tangents': true,
            'import_as_skeleton': asset.metadata.hasRigging,
            'generate_collision': true
        };
    }

    private getGLTFImportSettings(asset: Model3DAsset): Record<string, unknown> {
        return this.getGLBImportSettings(asset);
    }

    private getFBXImportSettings(asset: Model3DAsset): Record<string, unknown> {
        return {
            'importer': 'scene',
            'scale': 0.01,
            'generate_tangents': true,
            'import_as_skeleton': asset.metadata.hasRigging,
            'generate_collision': true,
            'bake_fps': 30
        };
    }

    private getOBJImportSettings(asset: Model3DAsset): Record<string, unknown> {
        return {
            'importer': 'scene',
            'scale': 1.0,
            'generate_tangents': true,
            'force_generate_tangents': true,
            'generate_collision': true
        };
    }

    private getUSDImportSettings(asset: Model3DAsset): Record<string, unknown> {
        return {
            'importer': 'scene',
            'scale': 1.0,
            'generate_tangents': true,
            'generate_collision': false
        };
    }

    private getRiggingPostScript(asset: Model3DAsset): string {
        return `
# Post-import script for rigged character
func _post_import(scene):
    # Set up AnimationTree
    var animation_tree = AnimationTree.new()
    scene.add_child(animation_tree)
    animation_tree.owner = scene
    animation_tree.active = true

    # Create blend tree
    var blend_tree = AnimationNodeBlendTree.new()
    animation_tree.tree_root = blend_tree

    # Add basic animation states
    var idle = blend_tree.add_node("idle", AnimationNodeAnimation.new())
    idle.animation = "idle"

    var walk = blend_tree.add_node("walk", AnimationNodeAnimation.new())
    walk.animation = "walk"

    return scene
`;
    }

    /**
     * Validate an asset for Godot compatibility
     */
    validateForGodot(asset: Model3DAsset | AudioAsset | Art2DAsset): {
        compatible: boolean;
        warnings: string[];
        errors: string[];
    } {
        const warnings: string[] = [];
        const errors: string[] = [];

        if (asset.type === '3d_model' || asset.type === 'environment') {
            const model = asset as Model3DAsset;

            if (!['glb', 'gltf', 'fbx', 'obj'].includes(model.metadata.format)) {
                errors.push(`Format ${model.metadata.format} is not natively supported by Godot`);
            }

            if (model.metadata.polygonCount && model.metadata.polygonCount > 100000) {
                warnings.push('High polygon count may impact performance');
            }

            if (model.metadata.textureCount && model.metadata.textureCount > 10) {
                warnings.push('Many textures may increase memory usage');
            }

            if (!model.metadata.godotCompatible) {
                errors.push('Asset is marked as not Godot-compatible');
            }
        } else if (asset.type === 'audio') {
            const audio = asset as AudioAsset;

            if (audio.metadata.durationSeconds > 60) {
                warnings.push('Long audio files may take time to import');
            }

            if (audio.metadata.channels > 2) {
                errors.push('Godot only supports mono and stereo audio');
            }
        } else if (asset.type === '2d_art' || asset.type === 'texture') {
            const art = asset as Art2DAsset;

            if (!['png', 'jpg', 'webp', 'svg'].includes(art.metadata.format)) {
                errors.push(`Format ${art.metadata.format} is not supported by Godot`);
            }

            if (art.metadata.width > 4096 || art.metadata.height > 4096) {
                warnings.push('Large texture dimensions may not be compatible with all platforms');
            }
        }

        return {
            compatible: errors.length === 0,
            warnings,
            errors
        };
    }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createGodotIntegration(config: GodotProjectConfig): GodotIntegration {
    return new GodotIntegration(config);
}
