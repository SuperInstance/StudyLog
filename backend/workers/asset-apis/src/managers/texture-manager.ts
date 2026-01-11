/**
 * Texture Manager - 2D Art/Texture Orchestration
 * Coordinates between Rosebud AI, Leonardo AI, and Scenario.gg
 */

import {
    Generate2DRequest,
    TrainStyleModelRequest,
    GenerationResponse,
    Art2DAsset,
    Art2DMetadata,
    ImageFormat,
    AssetProvider,
    ProductContext
} from '../types.js';

import { RosebudProvider } from '../providers/rosebud.js';
import { LeonardoProvider } from '../providers/leonardo.js';
import { ScenarioProvider } from '../providers/scenario.js';

// ============================================================================
// Provider Priority Configuration
// ============================================================================

interface TextureProviderCapability {
    provider: AssetProvider;
    priority: number;
    capabilities: string[];
    costLevel: 'low' | 'medium' | 'high';
    avgTimeSeconds: number;
    bestFor: string[];
}

const TEXTURE_PROVIDER_CAPABILITIES: TextureProviderCapability[] = [
    {
        provider: 'rosebud',
        priority: 1,
        capabilities: ['sprites', 'game_assets', 'tilesets', 'ui_elements', 'characters'],
        costLevel: 'low',
        avgTimeSeconds: 45,
        bestFor: ['sprites', 'tilesets', 'game_ui']
    },
    {
        provider: 'leonardo',
        priority: 2,
        capabilities: ['concept_art', 'illustrations', 'icons', 'editing', 'upscaling'],
        costLevel: 'medium',
        avgTimeSeconds: 30,
        bestFor: ['concept_art', 'illustrations', 'icons']
    },
    {
        provider: 'scenario',
        priority: 3,
        capabilities: ['style_models', 'consistent_art', 'inpainting', 'img2img'],
        costLevel: 'medium',
        avgTimeSeconds: 35,
        bestFor: ['consistent_style', 'style_transfer', 'variations']
    }
];

// ============================================================================
// Texture Manager Configuration
// ============================================================================

export interface TextureManagerConfig {
    apiKeys?: {
        rosebud?: string;
        leonardo?: string;
        scenario?: string;
    };
    endpoints?: {
        rosebud?: string;
        leonardo?: string;
        scenario?: string;
    };
    defaultProvider?: AssetProvider;
    cacheEnabled?: boolean;
}

// ============================================================================
// Texture Manager Class
// ============================================================================

export class TextureManager {
    private providers: Map<AssetProvider, RosebudProvider | LeonardoProvider | ScenarioProvider>;
    private config: TextureManagerConfig;
    private generationCache: Map<string, CachedGeneration>;
    private styleModels: Map<string, string>; // name -> modelId

    constructor(config: TextureManagerConfig) {
        this.config = config;
        this.providers = new Map();
        this.generationCache = new Map();
        this.styleModels = new Map();
        this.initializeProviders();
    }

    // ========================================================================
    // Provider Initialization
    // ========================================================================

    private initializeProviders(): void {
        if (this.config.apiKeys?.rosebud) {
            this.providers.set('rosebud', new RosebudProvider({
                apiKey: this.config.apiKeys.rosebud,
                endpoint: this.config.endpoints?.rosebud
            }));
        }

        if (this.config.apiKeys?.leonardo) {
            this.providers.set('leonardo', new LeonardoProvider({
                apiKey: this.config.apiKeys.leonardo,
                endpoint: this.config.endpoints?.leonardo
            }));
        }

        if (this.config.apiKeys?.scenario) {
            this.providers.set('scenario', new ScenarioProvider({
                apiKey: this.config.apiKeys.scenario,
                endpoint: this.config.endpoints?.scenario
            }));
        }
    }

    // ========================================================================
    // Provider Selection
    // ========================================================================

    /**
     * Select the best provider for a given request
     */
    selectProvider(
        request: Generate2DRequest,
        constraints?: TextureGenerationConstraints
    ): AssetProvider | null {
        const availableProviders = TEXTURE_PROVIDER_CAPABILITIES.filter(
            pc => this.providers.has(pc.provider)
        );

        if (availableProviders.length === 0) {
            return null;
        }

        // Check for preferred provider
        if (constraints?.preferredProvider) {
            if (this.providers.has(constraints.preferredProvider)) {
                return constraints.preferredProvider;
            }
        }

        // Check if this is for a specific use case
        if (constraints?.useCase) {
            const bestMatch = availableProviders.find(pc =>
                pc.bestFor.includes(constraints.useCase!)
            );
            if (bestMatch) {
                return bestMatch.provider;
            }
        }

        // Check constraints
        let candidates = availableProviders;

        if (constraints?.maxCostUsd) {
            const maxCostCents = constraints.maxCostUsd * 100;
            candidates = candidates.filter(pc => {
                const costMultiplier = pc.costLevel === 'low' ? 1 : pc.costLevel === 'medium' ? 2 : 3;
                return costMultiplier * 5 <= maxCostCents; // Rough estimate
            });
        }

        if (constraints?.maxTimeSeconds) {
            candidates = candidates.filter(
                pc => pc.avgTimeSeconds <= constraints.maxTimeSeconds!
            );
        }

        // Sort by priority
        candidates.sort((a, b) => a.priority - b.priority);
        return candidates[0]?.provider || null;
    }

    // ========================================================================
    // Image Generation
    // ========================================================================

    /**
     * Generate a 2D image with automatic provider selection
     */
    async generateImage(
        request: Generate2DRequest,
        constraints?: TextureGenerationConstraints
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        // Check cache first
        const cacheKey = this.getCacheKey(request);
        const cached = this.generationCache.get(cacheKey);
        if (cached && this.config.cacheEnabled !== false && cached.expiresAt > Date.now()) {
            return {
                success: true,
                assetId: cached.assetId,
                status: 'completed',
                estimatedTimeSeconds: 0,
                provider: cached.provider
            };
        }

        // Select provider
        const providerName = this.selectProvider(request, constraints);
        if (!providerName) {
            return {
                success: false,
                error: 'No suitable provider available for this request'
            };
        }

        const provider = this.providers.get(providerName);
        if (!provider) {
            return {
                success: false,
                error: `Provider ${providerName} not initialized`
            };
        }

        try {
            let result: GenerationResponse;

            if (providerName === 'rosebud') {
                result = await provider.generate2D(request);
            } else if (providerName === 'leonardo') {
                result = await provider.generateImage(request);
            } else if (providerName === 'scenario') {
                result = await provider.generateImage(request);
            } else {
                result = {
                    success: false,
                    error: `Unknown provider: ${providerName}`
                };
            }

            // Cache successful results
            if (result.success && result.assetId) {
                this.generationCache.set(cacheKey, {
                    assetId: result.assetId,
                    provider: providerName,
                    request,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 3600000 // 1 hour
                });
            }

            return { ...result, provider: providerName };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: providerName
            };
        }
    }

    // ========================================================================
    // Sprite Generation
    // ========================================================================

    /**
     * Generate a game sprite
     */
    async generateSprite(
        request: SpriteGenerationRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const providerName = request.provider || 'rosebud';
        const provider = this.providers.get(providerName);

        if (!provider) {
            return {
                success: false,
                error: `Provider ${providerName} not available`
            };
        }

        try {
            let result: GenerationResponse;

            if (providerName === 'rosebud') {
                result = await provider.generateSprite(request);
            } else if (providerName === 'leonardo') {
                result = await provider.generateSprite(request);
            } else if (providerName === 'scenario') {
                result = await provider.generateSpriteSheet(request);
            } else {
                result = {
                    success: false,
                    error: `Unknown provider: ${providerName}`
                };
            }

            return { ...result, provider: providerName };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: providerName
            };
        }
    }

    /**
     * Generate a sprite sheet
     */
    async generateSpriteSheet(
        request: SpriteSheetGenerationRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const providerName = request.provider || 'rosebud';
        const provider = this.providers.get(providerName);

        if (!provider) {
            return {
                success: false,
                error: `Provider ${providerName} not available`
            };
        }

        try {
            let result: GenerationResponse;

            if (providerName === 'rosebud') {
                result = await provider.generateSpriteSheet(request);
            } else if (providerName === 'leonardo') {
                result = await provider.generateSpriteSheet(request);
            } else if (providerName === 'scenario') {
                result = await provider.generateSpriteSheet(request);
            } else {
                result = {
                    success: false,
                    error: `Unknown provider: ${providerName}`
                };
            }

            return { ...result, provider: providerName };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: providerName
            };
        }
    }

    // ========================================================================
    // UI Element Generation
    // ========================================================================

    /**
     * Generate UI elements
     */
    async generateUIElement(
        request: UIElementGenerationRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        // Rosebud and Leonardo both support UI generation
        const providerName = request.provider || 'rosebud';
        const provider = this.providers.get(providerName);

        if (!provider) {
            return {
                success: false,
                error: `Provider ${providerName} not available`
            };
        }

        try {
            let result: GenerationResponse;

            if (providerName === 'rosebud') {
                result = await provider.generateUI(request);
            } else if (providerName === 'leonardo') {
                result = await provider.generateUIElement(request);
            } else {
                result = {
                    success: false,
                    error: `Provider ${providerName} does not support UI generation`
                };
            }

            return { ...result, provider: providerName };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: providerName
            };
        }
    }

    /**
     * Generate an icon set
     */
    async generateIconSet(
        request: IconSetGenerationRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const providerName = request.provider || 'rosebud';
        const provider = this.providers.get(providerName);

        if (!provider) {
            return {
                success: false,
                error: `Provider ${providerName} not available`
            };
        }

        try {
            let result: GenerationResponse;

            if (providerName === 'rosebud') {
                result = await provider.generateIconSet(request);
            } else if (providerName === 'leonardo') {
                // Generate icons one by one
                const results = await Promise.allSettled(
                    request.icons.map(icon =>
                        provider.generateUIElement({
                            elementType: 'icon',
                            description: icon,
                            style: request.style,
                            size: request.iconSize || 32,
                            colorScheme: request.colorScheme
                        })
                    )
                );

                const allSuccessful = results.every(r => r.status === 'fulfilled' && r.value.success);
                result = {
                    success: allSuccessful,
                    assetId: allSuccessful ? crypto.randomUUID() : undefined,
                    status: allSuccessful ? 'completed' : 'failed'
                };
            } else {
                result = {
                    success: false,
                    error: `Provider ${providerName} does not support icon generation`
                };
            }

            return { ...result, provider: providerName };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: providerName
            };
        }
    }

    // ========================================================================
    // Tileset Generation
    // ========================================================================

    /**
     * Generate a tileset
     */
    async generateTileset(
        request: TilesetGenerationRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const providerName = request.provider || 'rosebud';
        const provider = this.providers.get(providerName);

        if (!provider) {
            return {
                success: false,
                error: `Provider ${providerName} not available`
            };
        }

        try {
            let result: GenerationResponse;

            if (providerName === 'rosebud') {
                result = await provider.generateTileset(request);
            } else if (providerName === 'scenario') {
                // Scenario doesn't have tileset-specific, use general generation
                const tilesetPrompt = `game tileset, ${request.prompt}, ${request.theme} theme, ${request.tileSize}px tiles, ${request.tilesWide}x${request.tilesHigh} grid, seamless, game ready`;
                result = await provider.generateImage({
                    prompt: tilesetPrompt,
                    width: request.tileSize * request.tilesWide,
                    height: request.tileSize * request.tilesHigh,
                    style: request.style
                });
            } else {
                result = {
                    success: false,
                    error: `Provider ${providerName} does not support tileset generation`
                };
            }

            return { ...result, provider: providerName };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: providerName
            };
        }
    }

    // ========================================================================
    // Style Model Training (Scenario.gg)
    // ========================================================================

    /**
     * Train a custom style model
     */
    async trainStyleModel(
        request: TrainStyleModelRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const provider = this.providers.get('scenario');

        if (!provider) {
            return {
                success: false,
                error: 'Scenario provider not available for style training'
            };
        }

        try {
            const result = await provider.trainStyleModel(request);

            if (result.success && result.assetId) {
                // Cache the model ID
                this.styleModels.set(request.name, result.assetId);
            }

            return { ...result, provider: 'scenario' };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: 'scenario'
            };
        }
    }

    /**
     * Get trained style models
     */
    async getStyleModels(): Promise<Array<{ id: string; name: string; type: string }>> {
        const provider = this.providers.get('scenario');

        if (!provider) {
            return [];
        }

        try {
            return await provider.getStyleModels();
        } catch {
            return [];
        }
    }

    /**
     * Generate using a trained style model
     */
    async generateWithStyleModel(
        prompt: string,
        modelName: string,
        options?: {
            width?: number;
            height?: number;
            numImages?: number;
        }
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const provider = this.providers.get('scenario');

        if (!provider) {
            return {
                success: false,
                error: 'Scenario provider not available'
            };
        }

        // Get model ID from cache or fetch
        let modelId = this.styleModels.get(modelName);
        if (!modelId) {
            const models = await provider.getStyleModels();
            const model = models.find(m => m.name === modelName);
            if (model) {
                modelId = model.id;
                this.styleModels.set(modelName, modelId);
            }
        }

        if (!modelId) {
            return {
                success: false,
                error: `Style model '${modelName}' not found`
            };
        }

        try {
            const result = await provider.generateImage({
                prompt,
                styleModelId: modelId,
                width: options?.width || 512,
                height: options?.height || 512,
                numImages: options?.numImages || 1
            });

            return { ...result, provider: 'scenario' };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: 'scenario'
            };
        }
    }

    // ========================================================================
    // Image Editing (Leonardo AI)
    // ========================================================================

    /**
     * Edit an image
     */
    async editImage(
        request: ImageEditRequest
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const provider = this.providers.get('leonardo');

        if (!provider) {
            return {
                success: false,
                error: 'Leonardo provider not available for image editing'
            };
        }

        try {
            const result = await provider.editImage(request);
            return { ...result, provider: 'leonardo' };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: 'leonardo'
            };
        }
    }

    /**
     * Remove background from an image
     */
    async removeBackground(
        image: string
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const provider = this.providers.get('leonardo');

        if (!provider) {
            return {
                success: false,
                error: 'Leonardo provider not available for background removal'
            };
        }

        try {
            const result = await provider.removeBackground(image);
            return { ...result, provider: 'leonardo' };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: 'leonardo'
            };
        }
    }

    /**
     * Upscale an image
     */
    async upscaleImage(
        image: string,
        scale: 1 | 2 | 4 = 2
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const provider = this.providers.get('leonardo');

        if (!provider) {
            return {
                success: false,
                error: 'Leonardo provider not available for upscaling'
            };
        }

        try {
            const result = await provider.upscaleImage(image, scale);
            return { ...result, provider: 'leonardo' };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                provider: 'leonardo'
            };
        }
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Generate multiple images in batch
     */
    async batchGenerate(
        requests: Array<Generate2DRequest & { provider?: AssetProvider }>
    ): Promise<Array<GenerationResponse & { provider?: AssetProvider }>> {
        const results = await Promise.all(
            requests.map(req => this.generateImage(req))
        );

        return results;
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private getCacheKey(request: Generate2DRequest): string {
        const parts = [
            request.prompt.slice(0, 100),
            request.width || 512,
            request.height || 512,
            request.styleModelId || 'none'
        ];
        return parts.join('|').toLowerCase().replace(/\s+/g, '_');
    }

    /**
     * Get available providers
     */
    getAvailableProviders(): AssetProvider[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Get provider capabilities
     */
    getProviderCapabilities(): TextureProviderCapability[] {
        return TEXTURE_PROVIDER_CAPABILITIES.filter(pc => this.providers.has(pc.provider));
    }

    /**
     * Clear expired cache
     */
    clearExpiredCache(): void {
        const now = Date.now();
        for (const [key, value] of this.generationCache.entries()) {
            if (value.expiresAt < now) {
                this.generationCache.delete(key);
            }
        }
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface TextureGenerationConstraints {
    maxCostUsd?: number;
    maxTimeSeconds?: number;
    useCase?: string;
    preferredProvider?: AssetProvider;
    requireAlphaChannel?: boolean;
    requireSeamless?: boolean;
}

export interface SpriteGenerationRequest extends Generate2DRequest {
    spriteType?: string;
    view?: 'front' | 'side' | 'top' | 'back' | 'isometric';
    style?: 'pixel' | 'vector' | 'painted' | 'realistic';
    size?: 256 | 512 | 768;
    provider?: AssetProvider;
}

export interface SpriteSheetGenerationRequest {
    subject: string;
    animation?: string;
    frames: number;
    frameSize?: 32 | 64 | 128 | 256;
    columns?: number;
    style?: string;
    provider?: AssetProvider;
}

export interface UIElementGenerationRequest {
    elementType: 'button' | 'panel' | 'window' | 'icon' | 'slider' | 'checkbox' | 'dropdown';
    description?: string;
    style?: string;
    colorScheme?: string;
    size?: 128 | 256 | 512;
    provider?: AssetProvider;
}

export interface IconSetGenerationRequest {
    icons: string[];
    style?: string;
    iconSize?: 16 | 24 | 32 | 48 | 64;
    color?: string;
    backgroundColor?: string;
    colorScheme?: string;
    provider?: AssetProvider;
}

export interface TilesetGenerationRequest {
    prompt: string;
    tileSize: 16 | 32 | 64 | 128;
    tilesWide: number;
    tilesHigh: number;
    theme?: string;
    style?: string;
    seamless?: boolean;
    provider?: AssetProvider;
}

export interface ImageEditRequest {
    image: string;
    mask?: string;
    prompt: string;
    negativePrompt?: string;
    initStrength?: number;
    guidanceScale?: number;
}

interface CachedGeneration {
    assetId: string;
    provider: AssetProvider;
    request: Generate2DRequest;
    createdAt: number;
    expiresAt: number;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTextureManager(config: TextureManagerConfig): TextureManager {
    return new TextureManager(config);
}
