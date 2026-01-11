/**
 * Voice Router - Smart Audio Provider Routing
 *
 * Intelligently routes audio requests to the most appropriate provider
 * based on use case, quality requirements, cost constraints, and latency needs.
 *
 * Routing strategies:
 * - Use case optimization (dialogue, narration, realtime, etc.)
 * - Cost minimization for high-volume operations
 * - Quality tier selection
 * - Latency requirements (realtime vs batch)
 * - Provider health and availability
 * - Feature requirements (phonemes, cloning, etc.)
 */

import type {
    AudioProvider,
    AudioUseCase,
    QualityTier,
    TTSRequest,
    STTRequest,
    VoiceCloneRequest,
    SoundEffectRequest,
    Audio2FaceRequest,
    TTSResponse,
    STTResponse,
    VoiceCloneResponse,
    SoundEffectResponse,
    Audio2FaceResponse,
    ProviderCapabilities,
    CostEstimate,
    ProviderStatusResponse,
    AllProviderConfigs
} from './types.js';

import { PROVIDER_CAPABILITIES, PROVIDER_PRICING } from './types.js';

// Import provider clients
import { ElevenLabsClient, createElevenLabsClient } from './providers/elevenlabs.js';
import { AceAudio2FaceClient, createAceAudio2FaceClient } from './providers/ace-audio2face.js';
import { CoquiClient, createCoquiClient } from './providers/coqui.js';
import { WhisperClient, createWhisperClient } from './providers/whisper.js';
import { PiperClient, createPiperClient } from './providers/piper.js';
import { RivaClient, createRivaClient } from '../riva/index.js';

// ============================================================================
// Routing Decision Types
// ============================================================================

interface RoutingConstraints {
    /** Maximum acceptable latency in milliseconds */
    maxLatencyMs?: number;
    /** Maximum cost in USD */
    maxCostUsd?: number;
    /** Minimum quality tier */
    minQuality?: QualityTier;
    /** Require streaming support */
    requireStreaming?: boolean;
    /** Require phoneme timing */
    requirePhonemes?: boolean;
    /** Require voice cloning */
    requireVoiceCloning?: boolean;
    /** Require speaker diarization (for STT) */
    requireDiarization?: boolean;
    /** Preferred providers */
    preferredProviders?: AudioProvider[];
    /** Blocked providers */
    blockedProviders?: AudioProvider[];
    /** Use case for optimization */
    useCase?: AudioUseCase;
    /** Product context */
    productContext?: 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'general';
}

interface RoutingDecision {
    /** Selected provider */
    provider: AudioProvider;
    /** Confidence in this decision (0-1) */
    confidence: number;
    /** Reasoning for the decision */
    reasoning: string;
    /** Expected latency in milliseconds */
    expectedLatencyMs: number;
    /** Expected cost in USD */
    expectedCostUsd: number;
    /** Capabilities that will be used */
    capabilities: string[];
    /** Fallback providers in order */
    fallbacks: AudioProvider[];
}

// ============================================================================
// Voice Router Class
// ============================================================================

/**
 * Voice Router
 *
 * Intelligently routes audio requests to the best provider based on
 * constraints, use case, and availability.
 */
export class VoiceRouter {
    private readonly providers: Map<AudioProvider, any>;
    private readonly providerConfigs: AllProviderConfigs;
    private readonly providerStatus: Map<AudioProvider, ProviderStatusResponse>;

    // Usage tracking for cost optimization
    private readonly usageTracking: Map<AudioProvider, {
        requestCount: number;
        totalCostUsd: number;
        lastUsed: number;
    }>;

    constructor(configs: AllProviderConfigs) {
        this.providerConfigs = configs;
        this.providers = new Map();
        this.providerStatus = new Map();
        this.usageTracking = new Map();

        this.initializeProviders();
    }

    // ========================================================================
    // Provider Initialization
    // ========================================================================

    /**
     * Initialize provider clients based on configuration
     */
    private initializeProviders(): void {
        // ElevenLabs
        if (this.providerConfigs.elevenlabs?.apiKey) {
            this.providers.set('elevenlabs', createElevenLabsClient(this.providerConfigs.elevenlabs));
        }

        // ACE Audio2Face
        if (this.providerConfigs.ace_audio2face?.apiKey) {
            this.providers.set('ace_audio2face', createAceAudio2FaceClient(this.providerConfigs.ace_audio2face));
        }

        // Coqui
        if (this.providerConfigs.coqui?.apiKey) {
            this.providers.set('coqui', createCoquiClient(this.providerConfigs.coqui));
        }

        // Whisper
        if (this.providerConfigs.whisper?.apiKey || this.providerConfigs.whisper?.useLocal) {
            this.providers.set('whisper', createWhisperClient(this.providerConfigs.whisper));
        }

        // Piper
        if (this.providerConfigs.piper) {
            this.providers.set('piper', createPiperClient(this.providerConfigs.piper));
        }

        // Riva
        if (this.providerConfigs.riva?.apiKey) {
            this.providers.set('riva', createRivaClient({
                baseUrl: this.providerConfigs.riva.endpoint || 'https://riva.api.nvidia.com/v1',
                apiKey: this.providerConfigs.riva.apiKey
            }));
        }

        // Initialize status for all configured providers
        this.updateProviderStatuses();
    }

    /**
     * Update health status of all providers
     */
    private async updateProviderStatuses(): Promise<void> {
        const checks = Array.from(this.providers.keys()).map(async (provider) => {
            const status: ProviderStatusResponse = {
                provider,
                enabled: true,
                available: false,
                healthy: false,
                quotaUsed: 0,
                quotaLimit: Number.MAX_SAFE_INTEGER,
                quotaResetsAt: new Date(Date.now() + 86400000),
                avgResponseTimeMs: 0
            };

            try {
                const client = this.providers.get(provider);
                if (client && typeof client.healthCheck === 'function') {
                    status.healthy = await client.healthCheck();
                    status.available = status.healthy;
                }
            } catch {
                status.healthy = false;
                status.available = false;
            }

            this.providerStatus.set(provider, status);
        });

        await Promise.allSettled(checks);
    }

    // ========================================================================
    // TTS Routing
    // ========================================================================

    /**
     * Route TTS request to best provider
     *
     * @param request - TTS request
     * @param constraints - Routing constraints
     * @returns Promise resolving to TTS response
     */
    async routeTTS(request: TTSRequest, constraints?: RoutingConstraints): Promise<TTSResponse> {
        const decision = this.selectProviderForTTS(request, constraints);

        // Update usage tracking
        this.trackUsage(decision.provider, 0, decision.expectedCostUsd);

        // Get provider client and execute
        const provider = this.getProviderClient(decision.provider);
        if (!provider) {
            // Try fallback
            for (const fallback of decision.fallbacks) {
                const fallbackProvider = this.getProviderClient(fallback);
                if (fallbackProvider) {
                    const result = await fallbackProvider.synthesize(request);
                    if (result.success) {
                        return result;
                    }
                }
            }
            return {
                success: false,
                error: `No available providers for TTS request`
            };
        }

        try {
            const result = await provider.synthesize(request);
            if (!result.success && decision.fallbacks.length > 0) {
                // Try fallbacks
                for (const fallback of decision.fallbacks) {
                    const fallbackProvider = this.getProviderClient(fallback);
                    if (fallbackProvider) {
                        const fallbackResult = await fallbackProvider.synthesize(request);
                        if (fallbackResult.success) {
                            return fallbackResult;
                        }
                    }
                }
            }
            return result;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'TTS request failed'
            };
        }
    }

    /**
     * Select best provider for TTS request
     */
    private selectProviderForTTS(request: TTSRequest, constraints?: RoutingConstraints): RoutingDecision {
        const useCase = constraints?.useCase || request.useCase || 'dialogue';
        const quality = constraints?.minQuality || request.quality || 'standard';

        // Score each provider
        const scores = new Map<AudioProvider, number>();

        for (const [provider, capabilities] of Object.entries(PROVIDER_CAPABILITIES)) {
            if (!capabilities.tts) continue;
            if (!this.providers.has(provider as AudioProvider)) continue;
            if (constraints?.blockedProviders?.includes(provider as AudioProvider)) continue;

            let score = 0;
            const reasons: string[] = [];

            // Use case optimization
            switch (useCase) {
                case 'realtime':
                    // Piper (fastest local) > ElevenLabs Turbo > Coqui > Riva
                    if (provider === 'piper') score += 100;
                    else if (provider === 'elevenlabs') score += 80;
                    else if (provider === 'riva') score += 70;
                    else if (provider === 'coqui') score += 60;
                    reasons.push('realtime optimization');
                    break;

                case 'dialogue':
                    // ElevenLabs (best quality) > Coqui > Riva > Piper
                    if (provider === 'elevenlabs') score += 100;
                    else if (provider === 'coqui') score += 80;
                    else if (provider === 'riva') score += 70;
                    else if (provider === 'piper') score += 50;
                    reasons.push('dialogue quality');
                    break;

                case 'lip_sync':
                    // ElevenLabs (has phonemes) > ACE Audio2Face
                    if (provider === 'elevenlabs' && capabilities.phonemes) score += 100;
                    reasons.push('lip sync support');
                    break;

                case 'tutorial':
                case 'narration':
                    // ElevenLabs (best quality) > Coqui > Riva
                    if (provider === 'elevenlabs') score += 100;
                    else if (provider === 'coqui') score += 80;
                    else if (provider === 'riva') score += 70;
                    reasons.push('narration quality');
                    break;

                default:
                    if (provider === 'elevenlabs') score += 80;
                    else if (provider === 'piper') score += 70;
                    else if (provider === 'coqui') score += 60;
            }

            // Quality requirements
            if (quality === 'ultra' && provider === 'elevenlabs') score += 30;
            else if (quality === 'high' && (provider === 'elevenlabs' || provider === 'coqui')) score += 20;
            else if (quality === 'draft' && provider === 'piper') score += 30;

            // Streaming requirement
            if (constraints?.requireStreaming && capabilities.streaming) score += 40;

            // Phoneme requirement
            if (constraints?.requirePhonemes || request.enablePhonemes) {
                if (capabilities.phonemes) score += 50;
                else score -= 100; // Disqualify
            }

            // Cost constraints (lower is better)
            const pricing = PROVIDER_PRICING[provider as AudioProvider];
            if (constraints?.maxCostUsd) {
                const cost = pricing.costs.tts * (request.text.length / 1000);
                if (cost <= constraints.maxCostUsd) score += 20;
                else score -= 50; // Penalize over budget
            }

            // Provider health
            const status = this.providerStatus.get(provider as AudioProvider);
            if (status?.healthy) score += 20;
            if (status?.available) score += 10;

            // Preferred providers
            if (constraints?.preferredProviders?.includes(provider as AudioProvider)) {
                score += 30;
            }

            scores.set(provider as AudioProvider, score);
        }

        // Sort by score
        const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

        if (sorted.length === 0) {
            return {
                provider: 'elevenlabs',
                confidence: 0,
                reasoning: 'No providers available',
                expectedLatencyMs: 1000,
                expectedCostUsd: 0,
                capabilities: [],
                fallbacks: []
            };
        }

        const [bestProvider, bestScore] = sorted[0];
        const fallbacks = sorted.slice(1, 4).map(([p]) => p as AudioProvider);

        // Calculate expected values
        const capabilities = PROVIDER_CAPABILITIES[bestProvider as AudioProvider];
        const pricing = PROVIDER_PRICING[bestProvider as AudioProvider];
        const expectedCost = pricing.costs.tts * (request.text.length / 1000);
        const expectedLatency = capabilities.avgTimeSeconds * 1000;

        return {
            provider: bestProvider as AudioProvider,
            confidence: Math.min(bestScore / 200, 1),
            reasoning: `Selected ${bestProvider} for ${useCase} use case`,
            expectedLatencyMs: expectedLatency,
            expectedCostUsd: expectedCost,
            capabilities: Object.keys(capabilities).filter(k => capabilities[k as keyof typeof capabilities] === true),
            fallbacks
        };
    }

    // ========================================================================
    // STT Routing
    // ========================================================================

    /**
     * Route STT request to best provider
     *
     * @param request - STT request
     * @param constraints - Routing constraints
     * @returns Promise resolving to STT response
     */
    async routeSTT(request: STTRequest, constraints?: RoutingConstraints): Promise<STTResponse> {
        const decision = this.selectProviderForSTT(request, constraints);

        // Get provider client and execute
        const provider = this.getProviderClient(decision.provider);
        if (!provider) {
            // Try fallback
            for (const fallback of decision.fallbacks) {
                const fallbackProvider = this.getProviderClient(fallback);
                if (fallbackProvider && typeof fallbackProvider.transcribe === 'function') {
                    const result = await fallbackProvider.transcribe(request);
                    if (result.success) {
                        return result;
                    }
                }
            }
            return {
                success: false,
                error: `No available providers for STT request`
            };
        }

        try {
            const result = await provider.transcribe(request);
            if (!result.success && decision.fallbacks.length > 0) {
                // Try fallbacks
                for (const fallback of decision.fallbacks) {
                    const fallbackProvider = this.getProviderClient(fallback);
                    if (fallbackProvider && typeof fallbackProvider.transcribe === 'function') {
                        const fallbackResult = await fallbackProvider.transcribe(request);
                        if (fallbackResult.success) {
                            return fallbackResult;
                        }
                    }
                }
            }
            return result;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'STT request failed'
            };
        }
    }

    /**
     * Select best provider for STT request
     */
    private selectProviderForSTT(request: STTRequest, constraints?: RoutingConstraints): RoutingDecision {
        const scores = new Map<AudioProvider, number>();

        for (const [provider, capabilities] of Object.entries(PROVIDER_CAPABILITIES)) {
            if (!capabilities.stt) continue;
            if (!this.providers.has(provider as AudioProvider)) continue;
            if (constraints?.blockedProviders?.includes(provider as AudioProvider)) continue;

            let score = 0;

            // Diarization requirement
            if (constraints?.requireDiarization || request.enableDiarization) {
                if (capabilities.diarization) score += 100;
                else score -= 100; // Disqualify
            }

            // Word timings
            if (request.enableWordTimings) score += 30;

            // Quality tier
            const quality = request.quality || 'standard';
            if (quality === 'ultra' && provider === 'whisper') score += 40;
            else if (quality === 'draft' && provider === 'whisper') score += 20;

            // Cost
            const pricing = PROVIDER_PRICING[provider as AudioProvider];
            if (provider === 'riva' || provider === 'whisper') score += 30;

            // Provider health
            const status = this.providerStatus.get(provider as AudioProvider);
            if (status?.healthy) score += 20;

            // Preferred providers
            if (constraints?.preferredProviders?.includes(provider as AudioProvider)) {
                score += 30;
            }

            scores.set(provider as AudioProvider, score);
        }

        const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
        const [bestProvider] = sorted[0] || ['whisper', 0];
        const fallbacks = sorted.slice(1, 4).map(([p]) => p as AudioProvider);

        return {
            provider: bestProvider as AudioProvider,
            confidence: 0.9,
            reasoning: `Selected ${bestProvider} for speech-to-text`,
            expectedLatencyMs: 2000,
            expectedCostUsd: 0.01,
            capabilities: ['stt'],
            fallbacks
        };
    }

    // ========================================================================
    // Voice Clone Routing
    // ========================================================================

    /**
     * Route voice clone request
     */
    async routeVoiceClone(request: VoiceCloneRequest): Promise<VoiceCloneResponse> {
        // Voice cloning: ElevenLabs (best) > Coqui (open source)
        const providers: AudioProvider[] = ['elevenlabs', 'coqui'];

        for (const provider of providers) {
            const client = this.getProviderClient(provider);
            if (client && typeof client.cloneVoice === 'function') {
                try {
                    const result = await client.cloneVoice(request);
                    if (result.success) {
                        return result;
                    }
                } catch {
                    continue;
                }
            }
        }

        return {
            success: false,
            error: 'No available providers for voice cloning'
        };
    }

    // ========================================================================
    // Audio2Face Routing
    // ========================================================================

    /**
     * Route Audio2Face request
     */
    async routeAudio2Face(request: Audio2FaceRequest): Promise<Audio2FaceResponse> {
        const client = this.getProviderClient('ace_audio2face');
        if (client && typeof client.generateAnimation === 'function') {
            return await client.generateAnimation(request);
        }

        return {
            success: false,
            error: 'ACE Audio2Face provider not available'
        };
    }

    // ========================================================================
    // Sound Effects Routing
    // ========================================================================

    /**
     * Route sound effects request
     */
    async routeSoundEffect(request: SoundEffectRequest): Promise<SoundEffectResponse> {
        // Only ElevenLabs supports SFX generation
        const client = this.getProviderClient('elevenlabs');
        if (client && typeof client.generateSoundEffect === 'function') {
            return await client.generateSoundEffect(request);
        }

        return {
            success: false,
            error: 'Sound effects generation requires ElevenLabs'
        };
    }

    // ========================================================================
    // Cost Estimation
    // ========================================================================

    /**
     * Estimate cost for a request
     *
     * @param request - Request object
     * @param provider - Specific provider or auto-select
     * @returns Cost estimate
     */
    estimateCost(request: TTSRequest | STTRequest, provider?: AudioProvider): CostEstimate {
        const selectedProvider = provider || this.selectProviderForTTS(
            'text' in request ? request : { text: '', useCase: 'dialogue' } as TTSRequest
        ).provider;

        const pricing = PROVIDER_PRICING[selectedProvider];
        let cost = 0;

        if ('text' in request) {
            // TTS request
            cost = pricing.costs.tts * (request.text.length / 1000);
        } else {
            // STT request - estimate based on typical audio length
            cost = pricing.costs.stt * 0.5; // Assume 30 seconds
        }

        return {
            provider: selectedProvider,
            estimatedCostUsd: Math.max(cost, 0),
            currency: 'USD',
            breakdown: {
                generation: cost,
                storage: 0,
                processing: 0
            }
        };
    }

    /**
     * Get cost estimates for all providers
     */
    estimateAllCosts(request: TTSRequest | STTRequest): CostEstimate[] {
        const estimates: CostEstimate[] = [];

        for (const provider of Object.keys(PROVIDER_PRICING)) {
            estimates.push(this.estimateCost(request, provider as AudioProvider));
        }

        return estimates.sort((a, b) => a.estimatedCostUsd - b.estimatedCostUsd);
    }

    // ========================================================================
    // Provider Status
    // ========================================================================

    /**
     * Get status of all providers
     */
    getAllProviderStatus(): ProviderStatusResponse[] {
        return Array.from(this.providerStatus.values());
    }

    /**
     * Get status of a specific provider
     */
    getProviderStatus(provider: AudioProvider): ProviderStatusResponse | undefined {
        return this.providerStatus.get(provider);
    }

    /**
     * Get available providers for a capability
     */
    getAvailableProviders(capability: 'tts' | 'stt' | 'voiceCloning' | 'audio2face' | 'soundEffects'): AudioProvider[] {
        const available: AudioProvider[] = [];

        for (const [provider, capabilities] of Object.entries(PROVIDER_CAPABILITIES)) {
            if (capabilities[capability as keyof typeof capabilities] &&
                this.providers.has(provider as AudioProvider) &&
                this.providerStatus.get(provider as AudioProvider)?.healthy) {
                available.push(provider as AudioProvider);
            }
        }

        return available;
    }

    // ========================================================================
    // Usage Tracking
    // ========================================================================

    /**
     * Track provider usage
     */
    private trackUsage(provider: AudioProvider, requestCount: number, costUsd: number): void {
        const current = this.usageTracking.get(provider) || {
            requestCount: 0,
            totalCostUsd: 0,
            lastUsed: 0
        };

        current.requestCount += requestCount;
        current.totalCostUsd += costUsd;
        current.lastUsed = Date.now();

        this.usageTracking.set(provider, current);
    }

    /**
     * Get usage statistics
     */
    getUsageStats(): Map<AudioProvider, {
        requestCount: number;
        totalCostUsd: number;
        lastUsed: number;
    }> {
        return new Map(this.usageTracking);
    }

    // ========================================================================
    // Utility Methods
    // ========================================================================

    /**
     * Get provider client instance
     */
    private getProviderClient(provider: AudioProvider): any {
        return this.providers.get(provider);
    }

    /**
     * Check if a provider is available and healthy
     */
    isProviderAvailable(provider: AudioProvider): boolean {
        const status = this.providerStatus.get(provider);
        return status?.available === true && status?.healthy === true;
    }

    /**
     * Get provider capabilities
     */
    getProviderCapabilities(provider: AudioProvider): ProviderCapabilities | undefined {
        return PROVIDER_CAPABILITIES[provider];
    }

    /**
     * Get all provider capabilities
     */
    getAllProviderCapabilities(): Record<AudioProvider, ProviderCapabilities> {
        return PROVIDER_CAPABILITIES;
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a voice router
 *
 * @param configs - Provider configurations
 * @returns Configured VoiceRouter
 */
export function createVoiceRouter(configs: AllProviderConfigs): VoiceRouter {
    return new VoiceRouter(configs);
}

/**
 * Create voice router from environment
 *
 * @param env - Environment object with API keys
 * @returns Configured VoiceRouter
 */
export function createVoiceRouterFromEnv(env: {
    ELEVENLABS_API_KEY?: string;
    COQUI_API_KEY?: string;
    COQUI_ENDPOINT?: string;
    OPENAI_API_KEY?: string;
    WHISPER_ENDPOINT?: string;
    PIPER_ENDPOINT?: string;
    NVIDIA_API_KEY?: string;
    ACE_AUDIO2FACE_ENDPOINT?: string;
    RIVA_API_KEY?: string;
    RIVA_BASE_URL?: string;
}): VoiceRouter {
    const configs: AllProviderConfigs = {};

    if (env.ELEVENLABS_API_KEY) {
        configs.elevenlabs = { apiKey: env.ELEVENLABS_API_KEY };
    }
    if (env.COQUI_API_KEY) {
        configs.coqui = { apiKey: env.COQUI_API_KEY, endpoint: env.COQUI_ENDPOINT };
    }
    if (env.OPENAI_API_KEY || env.WHISPER_ENDPOINT) {
        configs.whisper = {
            apiKey: env.OPENAI_API_KEY,
            useLocal: !env.OPENAI_API_KEY,
            localEndpoint: env.WHISPER_ENDPOINT
        };
    }
    if (env.PIPER_ENDPOINT) {
        configs.piper = { endpoint: env.PIPER_ENDPOINT };
    }
    if (env.NVIDIA_API_KEY) {
        configs.ace_audio2face = {
            apiKey: env.NVIDIA_API_KEY,
            endpoint: env.ACE_AUDIO2FACE_ENDPOINT
        };
        if (env.RIVA_API_KEY) {
            configs.riva = {
                apiKey: env.RIVA_API_KEY,
                endpoint: env.RIVA_BASE_URL
            };
        }
    }

    return createVoiceRouter(configs);
}

// ============================================================================
// Re-exports
// ============================================================================

export type { RoutingConstraints, RoutingDecision };
