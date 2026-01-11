/**
 * Model Router - Smart 3D Asset Provider Selection
 * Automatically routes requests to the best provider based on:
 * - Request type (character, environment, prop, etc.)
 * - Quality tier requirements
 * - Cost constraints
 * - Time constraints
 * - Provider availability
 * - User preferences
 */

import type {
    AssetProvider,
    GenerateModelRequest,
    GenerateEnvironmentRequest,
    GenerationResponse,
    BatchGenerateRequest,
    QualityTier,
    AssetCategory,
    AllProviderConfigs,
    ProviderCapabilities,
    CostEstimate,
    ProviderStatusResponse,
    ValidationResult
} from './types.js';

import { PROVIDER_CAPABILITIES, PROVIDER_PRICING } from './types.js';

import { HunyuanProvider } from './providers/hunyuan.js';
import { SloydProvider } from './providers/sloyd.js';
import { MasterpieceXProvider } from './providers/masterpiece-x.js';
import { TripoProvider } from './providers/tripo.js';
import { RodinProvider } from './providers/rodin.js';
import { MeshyProvider } from './providers/meshy.js';

// ============================================================================
// Provider Scoring Weights
// ============================================================================

interface ScoringWeights {
    capabilityMatch: number;
    costEfficiency: number;
    speedPriority: number;
    qualityLevel: number;
    availability: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
    capabilityMatch: 0.4,
    costEfficiency: 0.2,
    speedPriority: 0.2,
    qualityLevel: 0.15,
    availability: 0.05
};

// ============================================================================
// Routing Constraints
// ============================================================================

export interface RoutingConstraints {
    maxCostUsd?: number;
    maxTimeSeconds?: number;
    requireRigging?: boolean;
    requireAnimation?: boolean;
    requireSegmentation?: boolean;
    requireTextureBaking?: boolean;
    requireGodotPlugin?: boolean;
    polygonTarget?: number;
    preferredProviders?: AssetProvider[];
    excludedProviders?: AssetProvider[];
    qualityTier?: QualityTier;
}

// ============================================================================
// Model Router Class
// ============================================================================

export class ModelRouter {
    private providers: Map<AssetProvider, any>;
    private configs: AllProviderConfigs;
    private weights: ScoringWeights;
    private cache: Map<string, CachedResult>;
    private providerStatus: Map<AssetProvider, ProviderHealth>;

    constructor(configs: AllProviderConfigs, weights?: Partial<ScoringWeights>) {
        this.configs = configs;
        this.weights = { ...DEFAULT_WEIGHTS, ...weights };
        this.providers = new Map();
        this.cache = new Map();
        this.providerStatus = new Map();
        this.initializeProviders();
        this.startHealthChecks();
    }

    // ========================================================================
    // Provider Initialization
    // ========================================================================

    private initializeProviders(): void {
        if (this.configs.hunyuan?.apiKey) {
            this.providers.set('hunyuan', new HunyuanProvider(this.configs.hunyuan));
        }
        if (this.configs.sloyd?.apiKey) {
            this.providers.set('sloyd', new SloydProvider(this.configs.sloyd));
        }
        if (this.configs.masterpiece_x?.apiKey) {
            this.providers.set('masterpiece_x', new MasterpieceXProvider(this.configs.masterpiece_x));
        }
        if (this.configs.tripo?.apiKey) {
            this.providers.set('tripo', new TripoProvider(this.configs.tripo));
        }
        if (this.configs.rodin?.apiKey) {
            this.providers.set('rodin', new RodinProvider(this.configs.rodin));
        }
        if (this.configs.meshy?.apiKey) {
            this.providers.set('meshy', new MeshyProvider(this.configs.meshy));
        }
    }

    // ========================================================================
    // Health Monitoring
    // ========================================================================

    private startHealthChecks(): void {
        // Initialize health status for all known providers
        const allProviders: AssetProvider[] = [
            'hunyuan', 'sloyd', 'masterpiece_x', 'tripo', 'rodin', 'meshy'
        ];
        for (const provider of allProviders) {
            this.providerStatus.set(provider, {
                healthy: true,
                lastCheck: Date.now(),
                consecutiveFailures: 0,
                avgResponseTime: PROVIDER_CAPABILITIES[provider].avgTimeSeconds * 1000
            });
        }
    }

    private updateProviderHealth(provider: AssetProvider, success: boolean, responseTimeMs: number): void {
        const status = this.providerStatus.get(provider);
        if (!status) return;

        status.lastCheck = Date.now();
        if (success) {
            status.consecutiveFailures = 0;
            status.healthy = true;
            // Update average response time with exponential smoothing
            status.avgResponseTime = status.avgResponseTime * 0.8 + responseTimeMs * 0.2;
        } else {
            status.consecutiveFailures++;
            if (status.consecutiveFailures >= 3) {
                status.healthy = false;
            }
        }
        this.providerStatus.set(provider, status);
    }

    getProviderStatus(provider: AssetProvider): ProviderHealth {
        return this.providerStatus.get(provider) || {
            healthy: false,
            lastCheck: 0,
            consecutiveFailures: 999,
            avgResponseTime: 999999
        };
    }

    // ========================================================================
    // Provider Selection
    // ========================================================================

    /**
     * Select the best provider for a given request
     */
    selectProvider(
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): AssetProvider | null {
        const availableProviders = this.getAvailableProviders(constraints);
        if (availableProviders.length === 0) {
            return null;
        }

        // Score each provider
        const scores = availableProviders.map(provider => ({
            provider,
            score: this.scoreProvider(provider, request, constraints)
        }));

        // Sort by score (descending)
        scores.sort((a, b) => b.score - a.score);

        return scores[0].provider;
    }

    /**
     * Get ranked list of providers for fallback
     */
    rankProviders(
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints,
        count: number = 3
    ): AssetProvider[] {
        const availableProviders = this.getAvailableProviders(constraints);
        const scores = availableProviders.map(provider => ({
            provider,
            score: this.scoreProvider(provider, request, constraints)
        }));
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, count).map(s => s.provider);
    }

    /**
     * Score a provider for a specific request (higher is better)
     */
    private scoreProvider(
        provider: AssetProvider,
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): number {
        let score = 0;
        const capabilities = PROVIDER_CAPABILITIES[provider];
        const health = this.getProviderStatus(provider);
        const pricing = PROVIDER_PRICING[provider];

        // 1. Capability Match (40%)
        score += this.scoreCapabilityMatch(provider, request, constraints) *
                 this.weights.capabilityMatch * 100;

        // 2. Cost Efficiency (20%)
        score += this.scoreCostEfficiency(provider, request, constraints) *
                 this.weights.costEfficiency * 100;

        // 3. Speed Priority (20%)
        score += this.scoreSpeedPriority(provider, request, constraints, health) *
                 this.weights.speedPriority * 100;

        // 4. Quality Level (15%)
        score += this.scoreQualityLevel(provider, request, constraints) *
                 this.weights.qualityLevel * 100;

        // 5. Availability (5%)
        score += (health.healthy ? 1 : 0) * this.weights.availability * 100;

        return score;
    }

    private scoreCapabilityMatch(
        provider: AssetProvider,
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): number {
        let score = 0;
        const capabilities = PROVIDER_CAPABILITIES[provider];

        // Check required capabilities
        if (constraints?.requireRigging && !capabilities.rigging) {
            return 0;
        }
        if (constraints?.requireAnimation && !capabilities.animation) {
            return 0;
        }
        if (constraints?.requireSegmentation && provider !== 'tripo') {
            return 0;
        }
        if (constraints?.requireTextureBaking && !capabilities.textureBaking) {
            return 0;
        }
        if (constraints?.requireGodotPlugin && !capabilities.godotPlugin) {
            return 0;
        }

        // Environment generation
        if ('sceneType' in request) {
            if (provider === 'hunyuan') {
                return 1.0; // Hunyuan is best for environments
            }
            return 0;
        }

        // Character generation
        if (request.category === 'character' || request.category === 'creature') {
            if (provider === 'masterpiece_x') return 1.0;
            if (provider === 'tripo') return 0.9;
            return 0.5;
        }

        // Props/objects
        if (request.category === 'prop' || request.category === 'weapon' || request.category === 'armor') {
            if (provider === 'sloyd') return 1.0;
            if (provider === 'meshy') return 0.9;
            if (provider === 'rodin') return 0.8;
            return 0.5;
        }

        // Architecture
        if (request.category === 'architecture' || request.category === 'furniture') {
            if (provider === 'sloyd') return 1.0;
            return 0.6;
        }

        // Default: moderate score for most providers
        return 0.6;
    }

    private scoreCostEfficiency(
        provider: AssetProvider,
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): number {
        const pricing = PROVIDER_PRICING[provider];
        let cost = pricing.baseCostUsd;

        if ('sceneType' in request) {
            cost = pricing.costs.environment;
        } else if (request.includeRigging) {
            cost += pricing.costs.rigging;
        } else if (request.includeAnimation) {
            cost += pricing.costs.animation;
        } else {
            cost = pricing.costs.textTo3D;
        }

        // Quality multiplier
        if (request.quality) {
            const qualityMultiplier = {
                draft: 0.5, preview: 0.7, standard: 1.0, high: 1.5, ultra: 2.0
            };
            cost *= qualityMultiplier[request.quality];
        }

        // Check against constraints
        if (constraints?.maxCostUsd && cost > constraints.maxCostUsd) {
            return 0; // Over budget
        }

        // Lower cost = higher score (inverse relationship)
        // Best case (free) = 1.0, worst case ($1) = 0.0
        return Math.max(0, 1 - cost);
    }

    private scoreSpeedPriority(
        provider: AssetProvider,
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints,
        health?: ProviderHealth
    ): number {
        const capabilities = PROVIDER_CAPABILITIES[provider];
        let estimatedTime = capabilities.avgTimeSeconds;

        // Quality affects time
        if (request.quality === 'high' || request.quality === 'ultra') {
            estimatedTime *= 2;
        } else if (request.quality === 'draft' || request.quality === 'preview') {
            estimatedTime *= 0.5;
        }

        // Rigging/animation adds time
        if (request.includeRigging) {
            estimatedTime += 60;
        }
        if (request.includeAnimation) {
            estimatedTime += 30;
        }

        // Check against constraints
        if (constraints?.maxTimeSeconds && estimatedTime > constraints.maxTimeSeconds) {
            return 0;
        }

        // Add actual health response time if available
        if (health?.avgResponseTime) {
            estimatedTime = Math.max(estimatedTime, health.avgResponseTime / 1000);
        }

        // Faster = higher score (inverse relationship)
        // 5 seconds = 1.0, 300 seconds = 0.0
        return Math.max(0, 1 - (estimatedTime / 300));
    }

    private scoreQualityLevel(
        provider: AssetProvider,
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): number {
        const requestedQuality = constraints?.qualityTier || request.quality || 'standard';

        // Map quality tiers to scores
        const qualityScores: Record<QualityTier, Record<AssetProvider, number>> = {
            draft: {
                sloyd: 1.0, meshy: 0.9, rodin: 0.8, hunyuan: 0.7,
                tripo: 0.6, masterpiece_x: 0.5, cached: 1.0
            },
            preview: {
                sloyd: 1.0, meshy: 0.9, rodin: 0.8, hunyuan: 0.7,
                tripo: 0.7, masterpiece_x: 0.6, cached: 1.0
            },
            standard: {
                sloyd: 0.9, meshy: 0.9, rodin: 0.9, hunyuan: 0.8,
                tripo: 0.8, masterpiece_x: 0.8, cached: 0.5
            },
            high: {
                rodin: 1.0, tripo: 0.9, masterpiece_x: 0.9, hunyuan: 0.8,
                meshy: 0.7, sloyd: 0.6, cached: 0.3
            },
            ultra: {
                rodin: 1.0, masterpiece_x: 1.0, tripo: 0.9, hunyuan: 0.8,
                meshy: 0.6, sloyd: 0.5, cached: 0.2
            }
        };

        return qualityScores[requestedQuality]?.[provider] || 0.5;
    }

    private getAvailableProviders(constraints?: RoutingConstraints): AssetProvider[] {
        let providers = Array.from(this.providers.keys()).filter(p => {
            const providerInstance = this.providers.get(p);
            return providerInstance?.isAvailable?.() ?? true;
        });

        // Filter by exclusions
        if (constraints?.excludedProviders) {
            providers = providers.filter(p => !constraints.excludedProviders!.includes(p));
        }

        // Filter by preferences (if any are available)
        if (constraints?.preferredProviders && constraints.preferredProviders.length > 0) {
            const preferred = providers.filter(p => constraints.preferredProviders!.includes(p));
            if (preferred.length > 0) {
                providers = preferred;
            }
        }

        return providers;
    }

    // ========================================================================
    // Request Routing
    // ========================================================================

    /**
     * Route a model generation request to the best provider
     */
    async routeModelRequest(
        request: GenerateModelRequest,
        constraints?: RoutingConstraints
    ): Promise<GenerationResponse> {
        const startTime = Date.now();
        const requestId = crypto.randomUUID();

        // Check cache first
        const cacheKey = this.getCacheKey(request);
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return {
                ...cached.response,
                requestId
            };
        }

        // Select provider
        const provider = this.selectProvider(request, constraints);
        if (!provider) {
            return {
                success: false,
                error: 'No suitable provider available',
                requestId
            };
        }

        // Get provider instance
        const providerInstance = this.providers.get(provider);
        if (!providerInstance) {
            return {
                success: false,
                error: `Provider ${provider} not initialized`,
                requestId
            };
        }

        // Execute request
        try {
            const result = await this.executeProviderRequest(providerInstance, provider, request);
            const responseTime = Date.now() - startTime;
            this.updateProviderHealth(provider, result.success, responseTime);

            // Cache successful results
            if (result.success && result.assetId) {
                this.cache.set(cacheKey, {
                    response: result,
                    expiresAt: Date.now() + 3600000 // 1 hour
                });
            }

            return {
                ...result,
                provider,
                requestId
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.updateProviderHealth(provider, false, responseTime);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider
            };
        }
    }

    /**
     * Route with automatic fallback
     */
    async routeWithFallback(
        request: GenerateModelRequest,
        constraints?: RoutingConstraints & { fallbackCount?: number }
    ): Promise<GenerationResponse> {
        const fallbackCount = constraints?.fallbackCount || 3;
        const providers = this.rankProviders(request, constraints, fallbackCount);

        for (const provider of providers) {
            const providerInstance = this.providers.get(provider);
            if (!providerInstance) continue;

            try {
                const result = await this.executeProviderRequest(providerInstance, provider, request);
                if (result.success) {
                    return { ...result, provider };
                }
            } catch {
                continue;
            }
        }

        return {
            success: false,
            error: 'All providers failed',
            requestId: crypto.randomUUID()
        };
    }

    /**
     * Route an environment generation request
     */
    async routeEnvironmentRequest(
        request: GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        // Only Hunyuan supports environments
        const provider = this.providers.get('hunyuan');
        if (!provider) {
            return {
                success: false,
                error: 'Hunyuan provider not available for environment generation',
                requestId
            };
        }

        try {
            const result = await provider.generateEnvironment(request);
            return { ...result, provider: 'hunyuan', requestId };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'hunyuan'
            };
        }
    }

    /**
     * Route batch requests across multiple providers
     */
    async routeBatchRequest(
        batchRequest: BatchGenerateRequest,
        constraints?: RoutingConstraints
    ): Promise<GenerationResponse[]> {
        const { requests, parallel = true, failFast = false } = batchRequest;

        if (parallel) {
            // Process all requests in parallel
            const results = await Promise.all(
                requests.map(req => this.routeModelRequest(req, constraints))
            );

            if (failFast && results.some(r => !r.success)) {
                throw new Error('One or more batch requests failed');
            }

            return results;
        } else {
            // Process sequentially
            const results: GenerationResponse[] = [];
            for (const request of requests) {
                const result = await this.routeModelRequest(request, constraints);
                results.push(result);
                if (failFast && !result.success) {
                    break;
                }
            }
            return results;
        }
    }

    // ========================================================================
    // Provider Execution
    // ========================================================================

    private async executeProviderRequest(
        provider: any,
        providerName: AssetProvider,
        request: GenerateModelRequest
    ): Promise<GenerationResponse> {
        // Route to appropriate method based on provider and request
        if (providerName === 'hunyuan') {
            if (request.inputSketch) {
                return provider.sketchTo3D(request);
            } else if (request.inputImage) {
                return provider.imageTo3D({ ...request, inputImage: request.inputImage });
            }
            return provider.textTo3D(request);
        }

        if (providerName === 'sloyd') {
            return provider.generateModel(request);
        }

        if (providerName === 'masterpiece_x') {
            return provider.generateCharacter(request);
        }

        if (providerName === 'tripo') {
            return provider.textTo3D(request);
        }

        if (providerName === 'rodin') {
            return provider.textTo3D(request);
        }

        if (providerName === 'meshy') {
            return provider.textTo3D(request);
        }

        throw new Error(`Unknown provider: ${providerName}`);
    }

    // ========================================================================
    // Cost Estimation
    // ========================================================================

    /**
     * Estimate cost for a request across providers
     */
    estimateCosts(
        request: GenerateModelRequest | GenerateEnvironmentRequest,
        constraints?: RoutingConstraints
    ): CostEstimate[] {
        const providers = this.getAvailableProviders(constraints);
        return providers.map(provider => {
            const pricing = PROVIDER_PRICING[provider];
            let cost = pricing.baseCostUsd;

            if ('sceneType' in request) {
                cost = pricing.costs.environment;
            } else {
                const modelRequest = request as GenerateModelRequest;
                if (modelRequest.includeRigging) {
                    cost += pricing.costs.rigging;
                }
                if (modelRequest.includeAnimation) {
                    cost += pricing.costs.animation;
                }
            }

            // Quality multiplier
            const quality = request.quality || 'standard';
            const qualityMultiplier = {
                draft: 0.5, preview: 0.7, standard: 1.0, high: 1.5, ultra: 2.0
            };
            cost *= qualityMultiplier[quality];

            return {
                provider,
                estimatedCostUsd: cost,
                currency: 'USD',
                breakdown: {
                    generation: cost,
                    storage: 0,
                    bandwidth: 0
                }
            };
        }).sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd);
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /**
     * Validate a request before routing
     */
    validateRequest(
        request: GenerateModelRequest | GenerateEnvironmentRequest
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Basic validation
        if (!request.prompt || request.prompt.length < 5) {
            errors.push('Prompt must be at least 5 characters');
        }

        if (request.prompt && request.prompt.length > 1000) {
            errors.push('Prompt must not exceed 1000 characters');
        }

        // Quality tier validation
        if (request.quality) {
            const validTiers: QualityTier[] = ['draft', 'preview', 'standard', 'high', 'ultra'];
            if (!validTiers.includes(request.quality)) {
                errors.push(`Invalid quality tier. Must be one of: ${validTiers.join(', ')}`);
            }
        }

        // Format validation
        if ('format' in request && request.format) {
            const validFormats = ['glb', 'gltf', 'fbx', 'obj', 'usd', 'usdz'];
            if (!validFormats.includes(request.format)) {
                errors.push(`Invalid format. Must be one of: ${validFormats.join(', ')}`);
            }
        }

        // Image validation
        if ('inputImage' in request && request.inputImage) {
            if (!request.inputImage.startsWith('data:image/') &&
                !request.inputImage.startsWith('http://') &&
                !request.inputImage.startsWith('https://')) {
                errors.push('Input image must be a valid data URL or HTTP(S) URL');
            }
        }

        // Check if any providers are available
        if (this.providers.size === 0) {
            errors.push('No providers configured');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ========================================================================
    // Provider Status
    // ========================================================================

    /**
     * Get status of all providers
     */
    getAllProviderStatus(): ProviderStatusResponse[] {
        const responses: ProviderStatusResponse[] = [];
        const now = Date.now();

        for (const [provider, instance] of this.providers) {
            const health = this.getProviderStatus(provider);
            const capabilities = PROVIDER_CAPABILITIES[provider];
            const pricing = PROVIDER_PRICING[provider];

            responses.push({
                provider,
                enabled: instance.isAvailable ? instance.isAvailable() : true,
                available: instance.isAvailable ? instance.isAvailable() : true,
                healthy: health.healthy,
                quotaUsed: 0, // Would fetch from provider
                quotaLimit: pricing.freeTier?.generationsPerMonth || 1000,
                quotaResetsAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
                avgResponseTimeMs: health.avgResponseTime
            });
        }

        return responses;
    }

    // ========================================================================
    // Cache Management
    // ========================================================================

    private getCacheKey(request: GenerateModelRequest | GenerateEnvironmentRequest): string {
        const parts = [
            request.prompt,
            ('format' in request && request.format) || '',
            request.quality || '',
            request.style || '',
            ('inputImage' in request && request.inputImage) || ''
        ];
        return parts.join('|').toLowerCase().replace(/\s+/g, '_');
    }

    clearCache(): void {
        this.cache.clear();
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    getAvailableProviders(): AssetProvider[] {
        return Array.from(this.providers.keys());
    }

    getProviderCapabilities(): Record<AssetProvider, ProviderCapabilities> {
        const result: Record<string, ProviderCapabilities> = {};
        for (const [provider, instance] of this.providers) {
            if (instance.isAvailable ? instance.isAvailable() : true) {
                result[provider] = PROVIDER_CAPABILITIES[provider];
            }
        }
        return result;
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface ProviderHealth {
    healthy: boolean;
    lastCheck: number;
    consecutiveFailures: number;
    avgResponseTime: number;
}

interface CachedResult {
    response: GenerationResponse;
    expiresAt: number;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createModelRouter(
    configs: AllProviderConfigs,
    weights?: Partial<ScoringWeights>
): ModelRouter {
    return new ModelRouter(configs, weights);
}
