/**
 * Model Manager - 3D Model Orchestration
 * Coordinates between multiple 3D generation providers
 */

import {
    Generate3DRequest,
    GenerateEnvironmentRequest,
    GenerationResponse,
    Model3DAsset,
    Model3DMetadata,
    EnvironmentMetadata,
    ModelFormat,
    AssetProvider,
    ProductContext,
    GenerationStatus
} from '../types.js';

import { Hunyuan3DProvider } from '../providers/hunyuan.js';
import { SloydProvider } from '../providers/sloyd.js';
import { MasterpieceXProvider } from '../providers/masterpiece-x.js';
import { TripoProvider } from '../providers/tripo.js';
import { RodinProvider } from '../providers/rodin.js';
import { MeshyProvider } from '../providers/meshy.js';

// ============================================================================
// Provider Priority Configuration
// ============================================================================

interface ProviderCapability {
    provider: AssetProvider;
    priority: number;
    capabilities: string[];
    costLevel: 'low' | 'medium' | 'high';
    avgTimeSeconds: number;
}

const PROVIDER_CAPABILITIES: ProviderCapability[] = [
    {
        provider: 'sloyd',
        priority: 1,
        capabilities: ['parametric', 'buildings', 'weapons', 'furniture', 'low_poly', 'uv_unwrap'],
        costLevel: 'low',
        avgTimeSeconds: 5
    },
    {
        provider: 'meshy',
        priority: 2,
        capabilities: ['text_to_3d', 'image_to_3d', 'cleanup', 'optimization'],
        costLevel: 'low',
        avgTimeSeconds: 60
    },
    {
        provider: 'rodin',
        priority: 3,
        capabilities: ['text_to_3d', 'image_to_3d', 'texture_baking', 'godot_plugin'],
        costLevel: 'low',
        avgTimeSeconds: 45
    },
    {
        provider: 'tripo',
        priority: 4,
        capabilities: ['text_to_3d', 'image_to_3d', 'rigging', 'segmentation'],
        costLevel: 'medium',
        avgTimeSeconds: 90
    },
    {
        provider: 'masterpiece_x',
        priority: 5,
        capabilities: ['characters', 'rigging', 'animation', 'creatures'],
        costLevel: 'medium',
        avgTimeSeconds: 120
    },
    {
        provider: 'hunyuan',
        priority: 6,
        capabilities: ['text_to_3d', 'image_to_3d', 'sketch_to_3d', 'environments'],
        costLevel: 'medium',
        avgTimeSeconds: 60
    }
];

// ============================================================================
// Model Manager Class
// ============================================================================

export class ModelManager {
    private providers: Map<AssetProvider, any>;
    private config: ModelManagerConfig;
    private generationCache: Map<string, CachedGeneration>;

    constructor(config: ModelManagerConfig) {
        this.config = config;
        this.providers = new Map();
        this.generationCache = new Map();
        this.initializeProviders();
    }

    // ========================================================================
    // Provider Initialization
    // ========================================================================

    private initializeProviders(): void {
        // Initialize providers with API keys from config
        if (this.config.apiKeys?.hunyuan) {
            this.providers.set('hunyuan', new Hunyuan3DProvider({
                apiKey: this.config.apiKeys.hunyuan,
                endpoint: this.config.endpoints?.hunyuan
            }));
        }

        if (this.config.apiKeys?.sloyd) {
            this.providers.set('sloyd', new SloydProvider({
                apiKey: this.config.apiKeys.sloyd,
                endpoint: this.config.endpoints?.sloyd
            }));
        }

        if (this.config.apiKeys?.masterpiece_x) {
            this.providers.set('masterpiece_x', new MasterpieceXProvider({
                apiKey: this.config.apiKeys.masterpiece_x,
                endpoint: this.config.endpoints?.masterpiece_x
            }));
        }

        if (this.config.apiKeys?.tripo) {
            this.providers.set('tripo', new TripoProvider({
                apiKey: this.config.apiKeys.tripo,
                endpoint: this.config.endpoints?.tripo
            }));
        }

        if (this.config.apiKeys?.rodin) {
            this.providers.set('rodin', new RodinProvider({
                apiKey: this.config.apiKeys.rodin,
                endpoint: this.config.endpoints?.rodin
            }));
        }

        if (this.config.apiKeys?.meshy) {
            this.providers.set('meshy', new MeshyProvider({
                apiKey: this.config.apiKeys.meshy,
                endpoint: this.config.endpoints?.meshy
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
        request: Generate3DRequest | GenerateEnvironmentRequest,
        constraints?: ModelGenerationConstraints
    ): AssetProvider | null {
        // Filter by available providers
        const availableProviders = PROVIDER_CAPABILITIES.filter(
            pc => this.providers.has(pc.provider)
        );

        if (availableProviders.length === 0) {
            return null;
        }

        // Filter by constraints
        let candidates = availableProviders;

        if (constraints?.maxCostUsd) {
            const maxCostCents = constraints.maxCostUsd * 100;
            candidates = candidates.filter(pc => {
                const cost = this.estimateProviderCost(pc.provider, request);
                return cost <= maxCostCents;
            });
        }

        if (constraints?.maxTimeSeconds) {
            candidates = candidates.filter(
                pc => pc.avgTimeSeconds <= constraints.maxTimeSeconds!
            );
        }

        if (constraints?.capabilities) {
            candidates = candidates.filter(pc =>
                constraints.capabilities!.some(c => pc.capabilities.includes(c))
            );
        }

        if (constraints?.preferredProviders) {
            const preferred = candidates.filter(pc =>
                constraints.preferredProviders!.includes(pc.provider)
            );
            if (preferred.length > 0) {
                candidates = preferred;
            }
        }

        // Sort by priority (lower is better) and return best
        candidates.sort((a, b) => a.priority - b.priority);
        return candidates[0]?.provider || null;
    }

    /**
     * Get multiple providers for fallback
     */
    selectProvidersWithFallback(
        request: Generate3DRequest | GenerateEnvironmentRequest,
        count: number = 3
    ): AssetProvider[] {
        const availableProviders = PROVIDER_CAPABILITIES.filter(
            pc => this.providers.has(pc.provider)
        );

        availableProviders.sort((a, b) => a.priority - b.priority);
        return availableProviders.slice(0, count).map(pc => pc.provider);
    }

    // ========================================================================
    // Model Generation
    // ========================================================================

    /**
     * Generate a 3D model with automatic provider selection
     */
    async generateModel(
        request: Generate3DRequest,
        constraints?: ModelGenerationConstraints
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        // Check cache first
        const cacheKey = this.getCacheKey(request);
        const cached = this.generationCache.get(cacheKey);
        if (cached && !cached.expiresAt || cached.expiresAt > Date.now()) {
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

        // Route to appropriate provider method
        try {
            let result: GenerationResponse;

            if (providerName === 'hunyuan') {
                if (request.inputSketch) {
                    result = await provider.sketchTo3D(request);
                } else if (request.inputImage) {
                    result = await provider.imageTo3D(request);
                } else {
                    result = await provider.textTo3D(request);
                }
            } else if (providerName === 'sloyd') {
                result = await provider.generateModel(request);
            } else if (providerName === 'masterpiece_x') {
                result = await provider.generateCharacter(request);
            } else if (providerName === 'tripo') {
                result = await provider.textTo3D(request);
            } else if (providerName === 'rodin') {
                result = await provider.textTo3D(request);
            } else if (providerName === 'meshy') {
                result = await provider.textTo3D(request);
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

    /**
     * Generate with automatic fallback
     */
    async generateWithFallback(
        request: Generate3DRequest,
        constraints?: ModelGenerationConstraints
    ): Promise<GenerationResponse & { provider?: AssetProvider }> {
        const providers = this.selectProvidersWithFallback(request, constraints?.fallbackCount || 3);

        for (const providerName of providers) {
            const provider = this.providers.get(providerName);
            if (!provider) continue;

            try {
                let result: GenerationResponse;

                if (providerName === 'hunyuan') {
                    result = request.inputSketch
                        ? await provider.sketchTo3D(request)
                        : request.inputImage
                            ? await provider.imageTo3D(request)
                            : await provider.textTo3D(request);
                } else if (providerName === 'sloyd') {
                    result = await provider.generateModel(request);
                } else if (providerName === 'masterpiece_x') {
                    result = await provider.generateCharacter(request);
                } else if (providerName === 'tripo') {
                    result = await provider.textTo3D(request);
                } else if (providerName === 'rodin') {
                    result = await provider.textTo3D(request);
                } else if (providerName === 'meshy') {
                    result = await provider.textTo3D(request);
                } else {
                    continue;
                }

                if (result.success) {
                    return { ...result, provider: providerName };
                }
            } catch {
                continue;
            }
        }

        return {
            success: false,
            error: 'All providers failed'
        };
    }

    // ========================================================================
    // Environment Generation
    // ========================================================================

    /**
     * Generate a 3D environment using Hunyuan HY-World
     */
    async generateEnvironment(
        request: GenerateEnvironmentRequest
    ): Promise<GenerationResponse> {
        const provider = this.providers.get('hunyuan');

        if (!provider) {
            return {
                success: false,
                error: 'Hunyuan provider not available for environment generation'
            };
        }

        return provider.generateEnvironment(request);
    }

    // ========================================================================
    // Batch Generation
    // ========================================================================

    /**
     * Generate multiple models in batch
     */
    async batchGenerate(
        requests: Generate3DRequest[],
        constraints?: ModelGenerationConstraints
    ): Promise<Array<GenerationResponse & { provider?: AssetProvider }>> {
        // Distribute across providers for parallel processing
        const results = await Promise.all(
            requests.map(req => this.generateModel(req, constraints))
        );

        return results;
    }

    // ========================================================================
    // Model Operations
    // ========================================================================

    /**
     * Optimize a model using Meshy
     */
    async optimizeModel(
        modelId: string,
        params: { targetPolygons: number }
    ): Promise<GenerationResponse> {
        const provider = this.providers.get('meshy');

        if (!provider) {
            return {
                success: false,
                error: 'Meshy provider not available for optimization'
            };
        }

        return provider.optimizeMesh(modelId, params);
    }

    /**
     * Refine a model using Meshy
     */
    async refineModel(
        modelId: string,
        params: {
            cleanupFactor?: number;
            fixTopology?: boolean;
            targetPolygons?: number;
        }
    ): Promise<GenerationResponse> {
        const provider = this.providers.get('meshy');

        if (!provider) {
            return {
                success: false,
                error: 'Meshy provider not available for refinement'
            };
        }

        return provider.refineMesh(modelId, params);
    }

    /**
     * Bake textures using Rodin
     */
    async bakeTextures(
        modelId: string,
        params: {
            resolution?: number;
            bakeDiffuse?: boolean;
            bakeNormal?: boolean;
            bakeAO?: boolean;
        }
    ): Promise<GenerationResponse> {
        const provider = this.providers.get('rodin');

        if (!provider) {
            return {
                success: false,
                error: 'Rodin provider not available for texture baking'
            };
        }

        return provider.bakeTextures(modelId, params);
    }

    /**
     * Add rigging using Tripo or Masterpiece X
     */
    async addRigging(
        modelId: string,
        rigType: 'humanoid' | 'quadruped' = 'humanoid'
    ): Promise<GenerationResponse> {
        // Try Tripo first (cheaper), then Masterpiece X
        let provider = this.providers.get('tripo');
        if (provider) {
            return provider.addRigging(modelId, rigType);
        }

        provider = this.providers.get('masterpiece_x');
        if (provider) {
            return provider.addRigging(modelId, rigType);
        }

        return {
            success: false,
            error: 'No rigging provider available'
        };
    }

    // ========================================================================
    // Status and Polling
    // ========================================================================

    /**
     * Check generation status across providers
     */
    async getStatus(
        assetId: string,
        provider: AssetProvider
    ): Promise<{ status: GenerationStatus; result?: any }> {
        const p = this.providers.get(provider);
        if (!p) {
            return { status: 'failed' };
        }

        try {
            const result = await p.getTaskStatus(assetId);
            return {
                status: (result.status || result.data?.status) as GenerationStatus,
                result
            };
        } catch {
            return { status: 'failed' };
        }
    }

    /**
     * Wait for generation to complete
     */
    async waitForCompletion(
        assetId: string,
        provider: AssetProvider,
        timeoutMs: number = 300000
    ): Promise<Model3DAsset | null> {
        const p = this.providers.get(provider);
        if (!p) return null;

        try {
            const result = await p.waitForTask(assetId, timeoutMs);
            const metadata = await p.extractMetadata(assetId);

            return {
                id: assetId,
                type: '3d_model',
                provider,
                productContext: 'general',
                originalPrompt: '',
                status: 'completed',
                createdAt: new Date(),
                updatedAt: new Date(),
                costCents: 0,
                metadata,
                storage: {
                    storageType: 'external_url',
                    filePath: result.model_url || result.data?.model_url || '',
                    directDownloadUrl: result.model_url || result.data?.model_url || '',
                    uploadedAt: new Date()
                }
            };
        } catch {
            return null;
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /**
     * Estimate cost for a request using a specific provider
     */
    private estimateProviderCost(provider: AssetProvider, request: Generate3DRequest): number {
        const p = this.providers.get(provider);
        if (!p || typeof p.estimateCost !== 'function') {
            return 999; // Unknown cost
        }
        return Math.ceil(p.estimateCost(request) * 100);
    }

    /**
     * Generate cache key for request
     */
    private getCacheKey(request: Generate3DRequest): string {
        const parts = [
            request.prompt,
            request.format || 'glb',
            request.quality || 'standard',
            request.style || ''
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
    getProviderCapabilities(): ProviderCapability[] {
        return PROVIDER_CAPABILITIES.filter(pc => this.providers.has(pc.provider));
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface ModelManagerConfig {
    apiKeys?: {
        hunyuan?: string;
        sloyd?: string;
        masterpiece_x?: string;
        tripo?: string;
        rodin?: string;
        meshy?: string;
    };
    endpoints?: {
        hunyuan?: string;
        sloyd?: string;
        masterpiece_x?: string;
        tripo?: string;
        rodin?: string;
        meshy?: string;
    };
    cacheEnabled?: boolean;
    defaultProvider?: AssetProvider;
}

export interface ModelGenerationConstraints {
    maxCostUsd?: number;
    maxTimeSeconds?: number;
    capabilities?: string[];
    preferredProviders?: AssetProvider[];
    fallbackCount?: number;
    requireRigging?: boolean;
    requireAnimation?: boolean;
    polygonTarget?: number;
}

interface CachedGeneration {
    assetId: string;
    provider: AssetProvider;
    request: Generate3DRequest;
    createdAt: number;
    expiresAt: number;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createModelManager(config: ModelManagerConfig): ModelManager {
    return new ModelManager(config);
}
