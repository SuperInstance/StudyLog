/**
 * Audio & Voice API - Main Entry Point
 * For StudyLoG.AI and DMLoG.AI
 *
 * Comprehensive audio/voice API with provider routing and caching.
 *
 * Endpoints:
 * - POST /tts/generate - Text to speech
 * - POST /stt/transcribe - Speech to text
 * - POST /audio2face - Generate facial animation
 * - POST /sfx/generate - Sound effects
 * - POST /voice/clone - Voice cloning
 * - GET /voices/list - Available voices
 * - GET /health - API health check
 *
 * @example
 * ```typescript
 * import { createAudioAssetAPI } from './index.js';
 *
 * const api = createAudioAssetAPI(env);
 * const response = await api.generateSpeech({
 *   text: 'Hello, world!',
 *   voice: 'Rachel',
 *   useCase: 'dialogue'
 * });
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export * from './types.js';

// ============================================================================
// Provider Exports
// ============================================================================

export * from './providers/elevenlabs.js';
export * from './providers/ace-audio2face.js';
export * from './providers/coqui.js';
export * from './providers/whisper.js';
export * from './providers/piper.js';

// ============================================================================
// Core Module Exports
// ============================================================================

export * from './voice-router.js';
export * from './lip-sync.js';
export * from './sound-effects.js';

// ============================================================================
// Imports
// ============================================================================

import type {
    Env,
    TTSRequest,
    TTSResponse,
    STTRequest,
    STTResponse,
    VoiceCloneRequest,
    VoiceCloneResponse,
    Audio2FaceRequest,
    Audio2FaceResponse,
    SoundEffectRequest,
    SoundEffectResponse,
    VoiceListResponse,
    BatchTTSRequest,
    BatchTTSResponse,
    CostEstimate,
    AudioProvider,
    AudioUseCase,
    QualityTier,
    Locale,
    ProviderStatusResponse,
    ApiResponse,
    AllProviderConfigs
} from './types.js';

import { VoiceRouter, createVoiceRouterFromEnv, RoutingConstraints } from './voice-router.js';
import { LipSyncGenerator, createLipSyncGenerator } from './lip-sync.js';
import { SoundEffectsGenerator, createSoundEffectsGeneratorFromEnv } from './sound-effects.js';
import { PROVIDER_CAPABILITIES, PROVIDER_PRICING } from './types.js';

// ============================================================================
// CORS Headers
// ============================================================================

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400'
};

// ============================================================================
// Audio Asset API Class
// ============================================================================

/**
 * Audio Asset API
 *
 * Main API class that combines all audio/voice functionality.
 */
export class AudioAssetAPI {
    private readonly router: VoiceRouter;
    private readonly lipSync: LipSyncGenerator;
    private readonly sfx: SoundEffectsGenerator | null;
    private readonly env: Env;

    constructor(env: Env) {
        this.env = env;
        this.router = createVoiceRouterFromEnv(env);
        this.lipSync = createLipSyncGenerator({
            frameRate: 60,
            visemeStandard: 'oculus',
            includeEyes: true
        });
        this.sfx = createSoundEffectsGeneratorFromEnv(env);
    }

    // ========================================================================
    // TTS Operations
    // ========================================================================

    /**
     * Generate speech from text
     *
     * @param request - TTS request
     * @param constraints - Optional routing constraints
     * @returns Promise resolving to TTS response
     */
    async generateSpeech(request: TTSRequest, constraints?: RoutingConstraints): Promise<TTSResponse> {
        return await this.router.routeTTS(request, constraints);
    }

    /**
     * Generate speech with lip-sync data
     *
     * @param request - TTS request
     * @returns Promise resolving to TTS response with animation data
     */
    async generateSpeechWithLipSync(request: TTSRequest): Promise<TTSResponse & {
        animation?: import('./types.js').AnimationData;
    }> {
        const response = await this.generateSpeech({
            ...request,
            enablePhonemes: true,
            useCase: 'lip_sync'
        });

        if (response.success && response.phonemes) {
            const lipSyncResult = this.lipSync.generateFromPhonemes(
                response.phonemes,
                response.duration || 0
            );

            if (lipSyncResult.success && lipSyncResult.animation) {
                return {
                    ...response,
                    animation: lipSyncResult.animation
                };
            }
        }

        return response;
    }

    /**
     * Generate multiple speeches in batch
     *
     * @param request - Batch TTS request
     * @returns Promise resolving to batch TTS response
     */
    async generateSpeechBatch(request: BatchTTSRequest): Promise<BatchTTSResponse> {
        const startTime = Date.now();
        const results: Array<TTSResponse & { index: number }> = [];

        for (let i = 0; i < request.requests.length; i++) {
            const req = request.requests[i];
            const response = await this.generateSpeech({
                text: req.text,
                voice: req.voice,
                language: req.language,
                quality: request.quality,
                outputFormat: request.outputFormat,
                speed: request.speed,
                useCase: request.useCase,
                preferredProvider: request.preferredProvider
            });

            results.push({ ...response, index: i });

            // Don't run in parallel if not requested
            if (!request.parallel) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;

        // Calculate total cost
        const totalCostUsd = results.reduce((sum, r) => sum + (r.costUsd || 0), 0);

        return {
            success: true,
            results,
            successful,
            failed,
            totalCostUsd,
            totalProcessingTimeMs: Date.now() - startTime
        };
    }

    // ========================================================================
    // STT Operations
    // ========================================================================

    /**
     * Transcribe audio to text
     *
     * @param request - STT request
     * @returns Promise resolving to STT response
     */
    async transcribe(request: STTRequest): Promise<STTResponse> {
        return await this.router.routeSTT(request);
    }

    // ========================================================================
    // Voice Cloning
    // ========================================================================

    /**
     * Clone a voice from audio sample
     *
     * @param request - Voice cloning request
     * @returns Promise resolving to clone response
     */
    async cloneVoice(request: VoiceCloneRequest): Promise<VoiceCloneResponse> {
        return await this.router.routeVoiceClone(request);
    }

    // ========================================================================
    // Audio2Face Operations
    // ========================================================================

    /**
     * Generate facial animation from audio
     *
     * @param request - Audio2Face request
     * @returns Promise resolving to animation response
     */
    async generateAudio2Face(request: Audio2FaceRequest): Promise<Audio2FaceResponse> {
        return await this.router.routeAudio2Face(request);
    }

    /**
     * Generate lip-sync animation from text (no audio output)
     *
     * @param text - Text to animate
     * @param language - Language code
     * @returns Promise resolving to animation data
     */
    async generateLipSyncFromText(
        text: string,
        language: Locale = 'en-US'
    ): Promise<Audio2FaceResponse> {
        const result = this.lipSync.generateFromText(text, language);

        return {
            success: result.success,
            animationId: `lip_${crypto.randomUUID()}`,
            animationData: result.animation,
            provider: 'cached',
            duration: result.animation?.duration,
            frameCount: result.animation?.frameCount,
            processingTimeMs: 0,
            costUsd: 0,
            error: result.error
        };
    }

    // ========================================================================
    // Sound Effects
    // ========================================================================

    /**
     * Generate sound effect
     *
     * @param request - Sound effect request
     * @returns Promise resolving to sound effect response
     */
    async generateSoundEffect(request: SoundEffectRequest): Promise<SoundEffectResponse> {
        if (!this.sfx) {
            return {
                success: false,
                error: 'Sound effects not available (ElevenLabs API key required)'
            };
        }
        return await this.sfx.generate(request);
    }

    /**
     * Generate sound from preset
     *
     * @param presetName - Preset name
     * @param variations - Number of variations
     * @returns Promise resolving to array of sound effects
     */
    async generateSoundFromPreset(
        presetName: string,
        variations: number = 1
    ): Promise<SoundEffectResponse[]> {
        if (!this.sfx) {
            return [{
                success: false,
                error: 'Sound effects not available'
            }];
        }
        return await this.sfx.generateFromPreset(presetName, variations);
    }

    /**
     * Get sound effects library
     *
     * @returns Sound library information
     */
    getSoundLibrary(): ReturnType<SoundEffectsGenerator['getLibrary']> {
        if (!this.sfx) {
            return {
                presets: [],
                byCategory: {} as any,
                byTag: {} as any
            };
        }
        return this.sfx.getLibrary();
    }

    // ========================================================================
    // Voice Library
    // ========================================================================

    /**
     * Get list of available voices
     *
     * @param language - Optional language filter
     * @param provider - Optional provider filter
     * @returns Promise resolving to voice list
     */
    async getVoices(language?: Locale, provider?: AudioProvider): Promise<VoiceListResponse> {
        // This would aggregate voices from all providers
        // For now, return a placeholder
        return {
            success: true,
            voices: [],
            total: 0,
            provider
        };
    }

    // ========================================================================
    // Cost Estimation
    // ========================================================================

    /**
     * Estimate cost for a request
     *
     * @param request - TTS or STT request
     * @param provider - Specific provider or auto-select
     * @returns Cost estimate
     */
    estimateCost(request: TTSRequest | STTRequest, provider?: AudioProvider): CostEstimate {
        return this.router.estimateCost(request, provider);
    }

    /**
     * Get cost estimates for all providers
     *
     * @param request - TTS or STT request
     * @returns Array of cost estimates
     */
    estimateAllCosts(request: TTSRequest | STTRequest): CostEstimate[] {
        return this.router.estimateAllCosts(request);
    }

    // ========================================================================
    // Provider Status
    // ========================================================================

    /**
     * Get status of all providers
     *
     * @returns Array of provider statuses
     */
    getProviderStatuses(): ProviderStatusResponse[] {
        return this.router.getAllProviderStatus();
    }

    /**
     * Get status of specific provider
     *
     * @param provider - Provider name
     * @returns Provider status or undefined
     */
    getProviderStatus(provider: AudioProvider): ProviderStatusResponse | undefined {
        return this.router.getProviderStatus(provider);
    }

    /**
     * Get available providers for a capability
     *
     * @param capability - Capability name
     * @returns Array of available providers
     */
    getAvailableProviders(
        capability: 'tts' | 'stt' | 'voiceCloning' | 'audio2face' | 'soundEffects'
    ): AudioProvider[] {
        return this.router.getAvailableProviders(capability);
    }

    /**
     * Get provider capabilities
     *
     * @param provider - Provider name
     * @returns Provider capabilities
     */
    getProviderCapabilities(provider: AudioProvider) {
        return this.router.getProviderCapabilities(provider);
    }

    /**
     * Get all provider capabilities
     *
     * @returns Record of provider capabilities
     */
    getAllProviderCapabilities() {
        return this.router.getAllProviderCapabilities();
    }

    // ========================================================================
    // Health Check
    // ========================================================================

    /**
     * Check API health
     *
     * @returns Health status object
     */
    async healthCheck(): Promise<{
        healthy: boolean;
        providers: Record<string, boolean>;
        timestamp: number;
    }> {
        const statuses = this.getProviderStatuses();
        const providers: Record<string, boolean> = {};

        let healthy = false;
        for (const status of statuses) {
            providers[status.provider] = status.healthy;
            if (status.healthy) {
                healthy = true;
            }
        }

        return {
            healthy,
            providers,
            timestamp: Date.now()
        };
    }

    // ========================================================================
    // Usage Statistics
    // ========================================================================

    /**
     * Get usage statistics
     *
     * @returns Usage statistics by provider
     */
    getUsageStats() {
        return this.router.getUsageStats();
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Audio Asset API from environment
 *
 * @param env - Environment object with API keys
 * @returns Configured AudioAssetAPI
 */
export function createAudioAssetAPI(env: Env): AudioAssetAPI {
    return new AudioAssetAPI(env);
}

// ============================================================================
// Cloudflare Worker Entry Point
// ============================================================================

interface RequestContext {
    env: Env;
    requestId: string;
    userId?: string;
}

/**
 * Handle HTTP request (Cloudflare Worker)
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Parse body for POST requests
        let body: unknown = null;
        if (request.method === 'POST') {
            try {
                body = await request.json();
            } catch {
                return errorResponse('Invalid JSON body', requestId, 400);
            }
        }

        // Route the request
        const response = await routeRequest(request, url, body, env, ctx, requestId);

        // Add CORS headers to response
        Object.entries(CORS_HEADERS).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        response.headers.set('X-Request-ID', requestId);

        return response;
    }
};

// ============================================================================
// Request Router
// ============================================================================

async function routeRequest(
    request: Request,
    url: URL,
    body: unknown,
    env: Env,
    ctx: ExecutionContext,
    requestId: string
): Promise<Response> {
    const path = url.pathname;
    const api = createAudioAssetAPI(env);

    // Health check
    if (path === '/health' || path === '/') {
        const health = await api.healthCheck();
        return jsonResponse({
            success: true,
            data: health,
            requestId,
            timestamp: Date.now()
        });
    }

    // TTS Generate
    if (path === '/tts/generate' && request.method === 'POST') {
        const result = await api.generateSpeech(body as TTSRequest);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // TTS with lip sync
    if (path === '/tts/generate/lipsync' && request.method === 'POST') {
        const result = await api.generateSpeechWithLipSync(body as TTSRequest);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // TTS Batch
    if (path === '/tts/batch' && request.method === 'POST') {
        const result = await api.generateSpeechBatch(body as BatchTTSRequest);
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // STT Transcribe
    if (path === '/stt/transcribe' && request.method === 'POST') {
        const result = await api.transcribe(body as STTRequest);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Audio2Face
    if (path === '/audio2face' && request.method === 'POST') {
        const result = await api.generateAudio2Face(body as Audio2FaceRequest);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Lip sync from text
    if (path === '/lipsync/text' && request.method === 'POST') {
        const req = body as { text: string; language?: Locale };
        const result = await api.generateLipSyncFromText(req.text, req.language);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Sound effects
    if (path === '/sfx/generate' && request.method === 'POST') {
        const result = await api.generateSoundEffect(body as SoundEffectRequest);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Sound from preset
    if (path === '/sfx/preset' && request.method === 'POST') {
        const req = body as { preset: string; variations?: number };
        const result = await api.generateSoundFromPreset(req.preset, req.variations);
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Sound library
    if (path === '/sfx/library' && request.method === 'GET') {
        const library = api.getSoundLibrary();
        return jsonResponse({
            success: true,
            data: library,
            requestId,
            timestamp: Date.now()
        });
    }

    // Voice clone
    if (path === '/voice/clone' && request.method === 'POST') {
        const result = await api.cloneVoice(body as VoiceCloneRequest);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Voices list
    if (path === '/voices/list' && request.method === 'GET') {
        const language = url.searchParams.get('language') as Locale | null;
        const provider = url.searchParams.get('provider') as AudioProvider | null;
        const result = await api.getVoices(language || undefined, provider || undefined);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now()
        });
    }

    // Providers status
    if (path === '/providers/status' && request.method === 'GET') {
        const statuses = api.getProviderStatuses();
        return jsonResponse({
            success: true,
            data: statuses,
            requestId,
            timestamp: Date.now()
        });
    }

    // Providers capabilities
    if (path === '/providers/capabilities' && request.method === 'GET') {
        const capabilities = api.getAllProviderCapabilities();
        return jsonResponse({
            success: true,
            data: capabilities,
            requestId,
            timestamp: Date.now()
        });
    }

    // Cost estimate
    if (path === '/costs/estimate' && request.method === 'POST') {
        const req = body as { request: TTSRequest | STTRequest; provider?: AudioProvider };
        const estimate = api.estimateCost(req.request, req.provider);
        return jsonResponse({
            success: true,
            data: estimate,
            requestId,
            timestamp: Date.now()
        });
    }

    // All cost estimates
    if (path === '/costs/estimate/all' && request.method === 'POST') {
        const estimates = api.estimateAllCosts(body as TTSRequest | STTRequest);
        return jsonResponse({
            success: true,
            data: estimates,
            requestId,
            timestamp: Date.now()
        });
    }

    // 404 - Not Found
    return errorResponse('Endpoint not found', requestId, 404);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a JSON response
 */
function jsonResponse(data: ApiResponse, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        }
    });
}

/**
 * Create an error response
 */
function errorResponse(message: string, requestId: string, status: number = 500): Response {
    return jsonResponse({
        success: false,
        error: message,
        errorCode: status.toString(),
        requestId,
        timestamp: Date.now()
    }, status);
}

// ============================================================================
// Scheduled Handler
// ============================================================================

/**
 * Scheduled task handler (for cleanup, etc.)
 */
export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Audio Asset Worker scheduled task:', new Date().toISOString());

    const api = createAudioAssetAPI(env);

    // Update provider statuses
    await api.healthCheck();

    // Cleanup could be added here for caches, etc.
}
