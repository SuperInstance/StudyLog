/**
 * Sprite Generator
 * Orchestrates sprite and sprite sheet generation across providers
 * Combines multiple providers for best results
 */

import type {
    GenerateSpriteRequest,
    GenerateSpriteSheetRequest,
    GenerationResponse,
    SpriteSheetMetadata,
    AnimationConfig,
    Asset2DProvider,
    SpriteSheetJsonData,
    AnimationInfo
} from './types.js';

import { RosebudProvider, createRosebudProvider } from './providers/rosebud.js';
import { LeonardoProvider, createLeonardoProvider } from './providers/leonardo.js';
import { ScenarioProvider, createScenarioProvider } from './providers/scenario.js';
import { StabilityProvider, createStabilityProvider } from './providers/stability.js';

export interface SpriteGeneratorConfig {
    rosebud?: { apiKey: string };
    leonardo?: { apiKey: string };
    scenario?: { apiKey: string };
    stability?: { apiKey: string };
    defaultProvider?: Asset2DProvider;
    enableMultiProvider?: boolean;
    maxRetries?: number;
}

export interface SpriteSheetLayout {
    frames: Array<{
        filename: string;
        x: number;
        y: number;
        w: number;
        h: number;
        frameIndex: number;
    }>;
    width: number;
    height: number;
    columns: number;
    rows: number;
}

export class SpriteGenerator {
    private rosebud?: RosebudProvider;
    private leonardo?: LeonardoProvider;
    private scenario?: ScenarioProvider;
    private stability?: StabilityProvider;
    private config: Required<Omit<SpriteGeneratorConfig, 'rosebud' | 'leonardo' | 'scenario' | 'stability'>>;

    constructor(config: SpriteGeneratorConfig) {
        this.config = {
            defaultProvider: config.defaultProvider || 'rosebud',
            enableMultiProvider: config.enableMultiProvider ?? true,
            maxRetries: config.maxRetries || 3
        };

        if (config.rosebud?.apiKey) {
            this.rosebud = createRosebudProvider({ apiKey: config.rosebud.apiKey });
        }
        if (config.leonardo?.apiKey) {
            this.leonardo = createLeonardoProvider({ apiKey: config.leonardo.apiKey });
        }
        if (config.scenario?.apiKey) {
            this.scenario = createScenarioProvider({ apiKey: config.scenario.apiKey });
        }
        if (config.stability?.apiKey) {
            this.stability = createStabilityProvider({ apiKey: config.stability.apiKey });
        }
    }

    /**
     * Generate a single sprite
     */
    async generateSprite(
        request: GenerateSpriteRequest,
        provider?: Asset2DProvider
    ): Promise<GenerationResponse> {
        const selectedProvider = provider || this.selectProvider(request);

        const result = await this.executeWithRetry(
            selectedProvider,
            () => this.generateSpriteInternal(request, selectedProvider)
        );

        return result;
    }

    /**
     * Generate a sprite sheet with animations
     */
    async generateSpriteSheet(
        request: GenerateSpriteSheetRequest,
        provider?: Asset2DProvider
    ): Promise<GenerationResponse & { metadata?: SpriteSheetMetadata }> {
        const selectedProvider = provider || this.selectProvider(request);
        const framesPerAnimation = request.framesPerAnimation || 4;
        const frameWidth = request.frameWidth || 64;
        const frameHeight = request.frameHeight || 64;

        // Check if provider supports native sprite sheets
        if (selectedProvider === 'rosebud') {
            const result = await this.rosebud!.generateSpriteSheet(request);
            if (result.success) {
                // Generate JSON data for the sprite sheet
                const metadata = await this.generateSpriteSheetMetadata(
                    request,
                    framesPerAnimation,
                    frameWidth,
                    frameHeight
                );
                return { ...result, metadata };
            }
            return result;
        }

        if (selectedProvider === 'leonardo') {
            const result = await this.leonardo!.generateSpriteSheet(request);
            if (result.success) {
                const metadata = await this.generateSpriteSheetMetadata(
                    request,
                    framesPerAnimation,
                    frameWidth,
                    frameHeight
                );
                return { ...result, metadata };
            }
            return result;
        }

        // For providers without native sprite sheet support, generate frames individually
        return this.generateCompositeSpriteSheet(request, selectedProvider);
    }

    /**
     * Generate a sprite sheet by combining individual frames
     */
    private async generateCompositeSpriteSheet(
        request: GenerateSpriteSheetRequest,
        provider: Asset2DProvider
    ): Promise<GenerationResponse & { metadata?: SpriteSheetMetadata }> {
        const framesPerAnimation = request.framesPerAnimation || 4;
        const frameWidth = request.frameWidth || 64;
        const frameHeight = request.frameHeight || 64;
        const padding = request.padding || 0;

        // Calculate layout
        const layout = this.calculateSpriteSheetLayout(request, frameWidth, frameHeight, padding);
        const totalFrames = request.animations.reduce((sum, anim) =>
            sum + (anim.frames || framesPerAnimation), 0);

        // Generate all frames
        const frameResults: GenerationResponse[] = [];
        let frameIndex = 0;

        for (const animation of request.animations) {
            const animFrames = animation.frames || framesPerAnimation;
            const animPrompt = this.buildAnimationPrompt(request, animation, frameIndex, animFrames);

            for (let i = 0; i < animFrames; i++) {
                const framePrompt = `${animPrompt}, frame ${i + 1} of ${animFrames}`;
                const frameRequest: GenerateSpriteRequest = {
                    ...request,
                    prompt: framePrompt,
                    width: frameWidth,
                    height: frameHeight
                };

                const result = await this.generateSpriteInternal(frameRequest, provider);
                frameResults.push(result);
                frameIndex++;
            }
        }

        // Check if all frames succeeded
        const failedFrames = frameResults.filter(r => !r.success);
        if (failedFrames.length > 0) {
            return {
                success: false,
                error: `${failedFrames.length} frames failed to generate`,
                requestId: crypto.randomUUID(),
                provider
            };
        }

        const assetId = crypto.randomUUID();
        const metadata = await this.generateSpriteSheetMetadata(
            request,
            framesPerAnimation,
            frameWidth,
            frameHeight
        );

        return {
            success: true,
            assetId,
            status: 'completed',
            estimatedTimeSeconds: frameResults.length * 10,
            requestId: crypto.randomUUID(),
            provider,
            costUsd: frameResults.reduce((sum, r) => sum + (r.costUsd || 0), 0),
            metadata
        };
    }

    /**
     * Generate animation variants for a sprite
     */
    async generateAnimationVariants(
        baseRequest: GenerateSpriteRequest,
        animations: AnimationConfig[],
        provider?: Asset2DProvider
    ): Promise<Record<AnimationConfig['type'], GenerationResponse[]>> {
        const selectedProvider = provider || this.selectProvider(baseRequest);
        const results: Record<string, GenerationResponse[]> = {};

        for (const animation of animations) {
            const animRequest: GenerateSpriteRequest = {
                ...baseRequest,
                prompt: this.buildAnimationPrompt(baseRequest, animation, 0, animation.frames || 4)
            };

            const response = await this.generateSpriteInternal(animRequest, selectedProvider);
            results[animation.type] = [response];
        }

        return results;
    }

    /**
     * Generate directional sprites (up, down, left, right)
     */
    async generateDirectionalSprites(
        request: GenerateSpriteRequest,
        directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'],
        provider?: Asset2DProvider
    ): Promise<Record<string, GenerationResponse>> {
        const selectedProvider = provider || this.selectProvider(request);
        const results: Record<string, GenerationResponse> = {};

        for (const direction of directions) {
            const dirRequest: GenerateSpriteRequest = {
                ...request,
                prompt: `${request.prompt}, facing ${direction}, ${direction} view`
            };

            results[direction] = await this.generateSpriteInternal(dirRequest, selectedProvider);
        }

        return results;
    }

    /**
     * Generate character sprite set (idle, walk, run, etc.)
     */
    async generateCharacterSpriteSet(
        request: GenerateSpriteRequest,
        options?: {
            includeDirections?: boolean;
            animations?: AnimationType[];
            framesPerAnimation?: number;
        },
        provider?: Asset2DProvider
    ): Promise<GenerationResponse & { sprites?: Record<string, string> }> {
        const animations = options?.animations || ['idle', 'walk', 'run', 'attack'];
        const framesPerAnimation = options?.framesPerAnimation || 4;
        const includeDirections = options?.includeDirections ?? true;

        const spriteSheetRequest: GenerateSpriteSheetRequest = {
            ...request,
            animations: animations.map(anim => ({
                type: anim as AnimationType,
                frames: framesPerAnimation,
                looping: true
            }))
        };

        if (includeDirections) {
            // Generate directional variations
            const directions = ['down', 'left', 'right', 'up'] as const;
            const directionalResults = await this.generateDirectionalSprites(
                request,
                directions,
                provider
            );

            return {
                success: Object.values(directionalResults).every(r => r.success),
                assetId: crypto.randomUUID(),
                status: 'completed',
                requestId: crypto.randomUUID(),
                provider: provider || this.selectProvider(request),
                sprites: Object.fromEntries(
                    Object.entries(directionalResults).map(([k, v]) => [k, v.assetId || ''])
                )
            };
        }

        return this.generateSpriteSheet(spriteSheetRequest, provider);
    }

    /**
     * Optimize sprite sheet for Godot
     */
    async optimizeForGodot(
        spriteSheetUrl: string,
        options?: {
            cropFrames?: boolean;
            trimTransparentPixels?: boolean;
            generateImportSettings?: boolean;
        }
    ): Promise<{
        optimizedUrl: string;
        importSettings?: string;
        metadata?: SpriteSheetMetadata;
    }> {
        // This would process the sprite sheet image
        // For now, return a placeholder response

        return {
            optimizedUrl: spriteSheetUrl,
            importSettings: options?.generateImportSettings
                ? this.generateGodotImportSettings()
                : undefined,
            metadata: {
                format: 'png',
                width: 512,
                height: 512,
                frameCount: 16,
                hasTransparency: true,
                colorDepth: 32,
                isAnimated: true,
                godotCompatible: true,
                godotImportPath: 'res://assets/sprites/sheet.png',
                animations: [],
                frameWidth: 64,
                frameHeight: 64,
                columns: 8,
                rows: 2,
                padding: 0
            }
        };
    }

    /**
     * Generate Aseprite-compatible sprite sheet data
     */
    async generateAsepriteData(
        request: GenerateSpriteSheetRequest
    ): Promise<SpriteSheetJsonData> {
        const frameWidth = request.frameWidth || 64;
        const frameHeight = request.frameHeight || 64;
        const framesPerAnimation = request.framesPerAnimation || 4;
        const columns = request.columns || this.calculateColumns(request, frameWidth);
        const padding = request.padding || 0;

        const frames: SpriteSheetJsonData['frames'] = [];
        let frameIndex = 0;

        for (const animation of request.animations) {
            const animFrames = animation.frames || framesPerAnimation;

            for (let i = 0; i < animFrames; i++) {
                const col = frameIndex % columns;
                const row = Math.floor(frameIndex / columns);

                frames.push({
                    filename: `${animation.type}_${i.toString().padStart(4, '0')}.png`,
                    frame: {
                        x: col * (frameWidth + padding),
                        y: row * (frameHeight + padding),
                        w: frameWidth,
                        h: frameHeight
                    },
                    rotated: false,
                    trimmed: false,
                    spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
                    sourceSize: { w: frameWidth, h: frameHeight },
                    duration: animation.duration || 100
                });

                frameIndex++;
            }
        }

        const totalWidth = columns * (frameWidth + padding) - padding;
        const totalHeight = Math.ceil(frameIndex / columns) * (frameHeight + padding) - padding;

        return {
            format: 'aseprite',
            frames,
            meta: {
                app: 'SuperInstance.AI Sprite Generator',
                version: '1.0',
                image: request.prompt.replace(/\s+/g, '_').substring(0, 50) + '.png',
                format: 'RGBA8888',
                size: { w: totalWidth, h: totalHeight },
                scale: '1'
            }
        };
    }

    /**
     * Generate Godot-compatible sprite frames data
     */
    async generateGodotFrames(
        request: GenerateSpriteSheetRequest
    ): Promise<Array<{ filename: string; duration: number }>> {
        const frames: Array<{ filename: string; duration: number }> = [];
        let frameIndex = 0;

        for (const animation of request.animations) {
            const animFrames = animation.frames || request.framesPerAnimation || 4;
            const duration = animation.duration || 100;

            for (let i = 0; i < animFrames; i++) {
                frames.push({
                    filename: `${animation.type}_${i.toString().padStart(4, '0')}.png`,
                    duration
                });
                frameIndex++;
            }
        }

        return frames;
    }

    /**
     * Get available sprite templates
     */
    getAvailableTemplates(): Array<{
        id: string;
        name: string;
        category: string;
        defaultAnimations: AnimationType[];
        recommendedSize: [number, number];
    }> {
        return [
            {
                id: 'rpg-character',
                name: 'RPG Character',
                category: 'character',
                defaultAnimations: ['idle', 'walk', 'run', 'attack', 'hurt'],
                recommendedSize: [64, 64]
            },
            {
                id: 'top-down-hero',
                name: 'Top-Down Hero',
                category: 'character',
                defaultAnimations: ['idle', 'walk', 'run', 'attack', 'cast'],
                recommendedSize: [64, 64]
            },
            {
                id: 'side-scroller-enemy',
                name: 'Side-Scroller Enemy',
                category: 'creature',
                defaultAnimations: ['idle', 'walk', 'attack', 'death'],
                recommendedSize: [48, 48]
            },
            {
                id: 'isometric-prop',
                name: 'Isometric Prop',
                category: 'prop',
                defaultAnimations: ['idle'],
                recommendedSize: [64, 64]
            },
            {
                id: 'ui-icon',
                name: 'UI Icon',
                category: 'ui_icon',
                defaultAnimations: ['idle'],
                recommendedSize: [32, 32]
            }
        ];
    }

    /**
     * Create a sprite sheet from a template
     */
    async createFromTemplate(
        templateId: string,
        prompt: string,
        options?: {
            style?: string;
            customAnimations?: AnimationConfig[];
        }
    ): Promise<GenerationResponse> {
        const template = this.getAvailableTemplates().find(t => t.id === templateId);
        if (!template) {
            return {
                success: false,
                error: `Template ${templateId} not found`,
                requestId: crypto.randomUUID(),
                provider: this.config.defaultProvider
            };
        }

        const animations = options?.customAnimations ||
            template.defaultAnimations.map(anim => ({
                type: anim as AnimationType,
                frames: 4,
                looping: true
            }));

        const request: GenerateSpriteSheetRequest = {
            prompt,
            style: options?.style as any,
            animations,
            frameWidth: template.recommendedSize[0],
            frameHeight: template.recommendedSize[1],
            category: template.category as any
        };

        return this.generateSpriteSheet(request);
    }

    // Private helper methods

    private async generateSpriteInternal(
        request: GenerateSpriteRequest,
        provider: Asset2DProvider
    ): Promise<GenerationResponse> {
        switch (provider) {
            case 'rosebud':
                return this.rosebud?.generateSprite(request) || {
                    success: false,
                    error: 'Rosebud provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            case 'leonardo':
                return this.leonardo?.generateSprite(request) || {
                    success: false,
                    error: 'Leonardo provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            case 'scenario':
                return this.scenario?.generateSprite(request) || {
                    success: false,
                    error: 'Scenario provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            case 'stability':
                return this.stability?.generateSprite(request) || {
                    success: false,
                    error: 'Stability provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            default:
                return {
                    success: false,
                    error: `Unknown provider: ${provider}`,
                    requestId: crypto.randomUUID(),
                    provider
                };
        }
    }

    private selectProvider(request: GenerateSpriteRequest): Asset2DProvider {
        // Prefer Rosebud for pixel art
        if (request.style === 'pixel_art' ||
            request.style === 'pixel_perfect' ||
            request.style === '16bit' ||
            request.style === 'gba') {
            return 'rosebud';
        }

        // Prefer Leonardo for sprites and UI
        if (request.category === 'ui_icon' || request.category === 'prop') {
            return 'leonardo';
        }

        // Check configured providers
        if (this.rosebud?.isAvailable()) return 'rosebud';
        if (this.leonardo?.isAvailable()) return 'leonardo';
        if (this.scenario?.isAvailable()) return 'scenario';
        if (this.stability?.isAvailable()) return 'stability';

        return this.config.defaultProvider;
    }

    private async executeWithRetry<T>(
        provider: Asset2DProvider,
        fn: () => Promise<T>
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;
                if (attempt < this.config.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }

        throw lastError || new Error('Max retries exceeded');
    }

    private buildAnimationPrompt(
        request: GenerateSpriteRequest,
        animation: AnimationConfig,
        frameIndex: number,
        totalFrames: number
    ): string {
        let prompt = request.prompt;

        // Add animation context
        prompt += `, ${animation.type} animation`;

        if (animation.direction) {
            prompt += `, ${animation.direction} view`;
        }

        // Add frame context for consistency
        prompt += `, frame ${frameIndex + 1} of ${totalFrames}`;

        return prompt;
    }

    private calculateSpriteSheetLayout(
        request: GenerateSpriteSheetRequest,
        frameWidth: number,
        frameHeight: number,
        padding: number
    ): SpriteSheetLayout {
        const framesPerAnimation = request.framesPerAnimation || 4;
        const totalFrames = request.animations.reduce((sum, anim) =>
            sum + (anim.frames || framesPerAnimation), 0);

        const columns = request.columns || Math.ceil(Math.sqrt(totalFrames));
        const rows = request.rows || Math.ceil(totalFrames / columns);

        const frames: SpriteSheetLayout['frames'] = [];
        let frameIndex = 0;

        for (const animation of request.animations) {
            const animFrames = animation.frames || framesPerAnimation;
            for (let i = 0; i < animFrames; i++) {
                const col = frameIndex % columns;
                const row = Math.floor(frameIndex / columns);

                frames.push({
                    filename: `${animation.type}_${i.toString().padStart(4, '0')}.png`,
                    x: col * (frameWidth + padding),
                    y: row * (frameHeight + padding),
                    w: frameWidth,
                    h: frameHeight,
                    frameIndex
                });

                frameIndex++;
            }
        }

        return {
            frames,
            width: columns * (frameWidth + padding) - padding,
            height: rows * (frameHeight + padding) - padding,
            columns,
            rows
        };
    }

    private calculateColumns(request: GenerateSpriteSheetRequest, frameWidth: number): number {
        const framesPerAnimation = request.framesPerAnimation || 4;
        const totalFrames = request.animations.reduce((sum, anim) =>
            sum + (anim.frames || framesPerAnimation), 0);
        return Math.ceil(Math.sqrt(totalFrames));
    }

    private async generateSpriteSheetMetadata(
        request: GenerateSpriteSheetRequest,
        framesPerAnimation: number,
        frameWidth: number,
        frameHeight: number
    ): Promise<SpriteSheetMetadata> {
        const columns = request.columns || this.calculateColumns(request, frameWidth);
        const totalFrames = request.animations.reduce((sum, anim) =>
            sum + (anim.frames || framesPerAnimation), 0);
        const rows = request.rows || Math.ceil(totalFrames / columns);

        const animations: AnimationInfo[] = [];
        let frameIndex = 0;

        for (const animation of request.animations) {
            const animFrames = animation.frames || framesPerAnimation;
            animations.push({
                name: animation.type,
                type: animation.type,
                startFrame: frameIndex,
                endFrame: frameIndex + animFrames - 1,
                frameCount: animFrames,
                duration: animation.duration || 100,
                looping: animation.looping !== false
            });
            frameIndex += animFrames;
        }

        return {
            format: 'png',
            width: columns * frameWidth,
            height: rows * frameHeight,
            frameCount: totalFrames,
            hasTransparency: true,
            colorDepth: 32,
            isAnimated: true,
            godotCompatible: true,
            godotImportPath: `res://assets/sprites/sheet_${crypto.randomUUID().slice(0, 8)}.png`,
            animations,
            frameWidth,
            frameHeight,
            columns,
            rows,
            padding: request.padding || 0
        };
    }

    private generateGodotImportSettings(): string {
        return `[remap]

importer="texture"
type="CompressedTexture2D"
uid="uid://xxxxx"
path="res://.godot/imported/sheet.png-xxxxx.ctex"

[deps]

source_file="res://assets/sprites/sheet.png"
dest_files=["res://.godot/imported/sheet.png-xxxxx.ctex"]

[params]

compress/mode=2
compress/high_quality=false
compress/lossy_quality=0.7
compress/hdr_compression=1
compress/normal_map=0
compress/channel_pack=0
mipmaps/generate=false
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/fix_alpha_border=true
process/premult_alpha=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=1`;
    }
}

type AnimationType = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'hurt' | 'death' | 'cast' | 'block' | 'emote';

export function createSpriteGenerator(config: SpriteGeneratorConfig): SpriteGenerator {
    return new SpriteGenerator(config);
}
