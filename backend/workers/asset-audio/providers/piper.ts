/**
 * Piper Provider Implementation
 *
 * Integration with Piper for fast, local neural text-to-speech.
 * Piper is a fast, local neural text-to-speech system that can run
 * on CPUs and provides high-quality speech synthesis.
 *
 * Reference: https://github.com/rhasspy/piper
 *
 * Features:
 * - Fast local inference (CPU-friendly)
 * - Multi-language support
 * - Multiple voice models
 * - Low latency (suitable for realtime)
 * - Self-hosted/private
 * - Free and open source
 */

import type {
    TTSRequest,
    TTSResponse,
    VoiceListResponse,
    Voice,
    PiperConfig,
    PiperResponse,
    AudioFormat,
    Locale
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const PIPER_DEFAULT_ENDPOINT = 'http://localhost:5000';

// Quality levels map to model sizes
const PIPER_MODELS = {
    'draft': 'tiny',
    'standard': 'base',
    'high': 'medium',
    'ultra': 'medium'
} as const;

// Sample rates for different quality levels
const PIPER_SAMPLE_RATES = {
    'tiny': 16000,
    'base': 22050,
    'medium': 22050,
    'high': 22050
} as const;

// Default voices for each language/quality combination
const PIPER_DEFAULT_VOICES: Record<string, string> = {
    'en-US-low': 'en_US-lessac-medium',
    'en-US-medium': 'en_US-lessac-medium',
    'en-US-high': 'en_US-amy-medium',
    'es-ES-medium': 'es_ES-carlfm-x-low',
    'fr-FR-medium': 'fr_FR-siwis-low',
    'de-DE-medium': 'de_DE-eva_k-x-low',
    'it-IT-medium': 'it_IT-riccardo-femminile-medium',
    'pt-BR-medium': 'pt_BR-faber-medium',
    'pl-PL-medium': 'pl_PL-mc- medium',
    'nl-NL-medium': 'nl_NV-mls-medium',
    'ru-RU-medium': 'ru_RU-dmitri-medium',
    'sv-SE-medium': 'sv_SE-nst-medium',
    'uk-UA-medium': 'uk_UA-moder- medium',
    'ja-JP-medium': 'ja_JP-haru-low',
    'ko-KR-medium': 'ko_KR-kss-medium',
    'zh-CN-medium': 'zh_CN-huayan-medium',
    'vi-VN-medium': 'vi_VN-single-medium',
    'el-GR-medium': 'el_GR-pafpat-medium',
    'fi-FI-medium': 'fi_FI-harri-low',
    'tr-TR-medium': 'tr_TR-fahrettin-medium',
    'ar-SA-medium': 'ar_AR-karim-medium'
};

// ============================================================================
// Types
// ============================================================================

interface PiperVoice {
    name: string;
    language: string;
    quality: string;
    sample_rate: number;
    speakers?: number;
}

interface PiperTTSRequest {
    text: string;
    voice?: string;
    quality?: 'tiny' | 'base' | 'medium' | 'high';
    speaker_id?: number;
    noise_scale?: number;
    length_scale?: number;
    noise_w?: number;
}

interface PiperTTSResponse {
    audio: string; // base64
    sample_rate: number;
    duration?: number;
}

// ============================================================================
// Piper Client Class
// ============================================================================

/**
 * Piper TTS Client
 *
 * Fast, local neural text-to-speech using Piper.
 * Ideal for low-latency applications and privacy-sensitive use cases.
 */
export class PiperClient {
    private readonly baseUrl: string;
    private readonly modelEndpoint: string;
    private readonly voiceDir: string;

    // Voice cache
    private voiceCache: Map<string, PiperVoice> | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_TTL = 3600000; // 1 hour

    constructor(config: PiperConfig) {
        this.baseUrl = config.endpoint || PIPER_DEFAULT_ENDPOINT;
        this.modelEndpoint = config.modelEndpoint || this.baseUrl;
        this.voiceDir = config.voiceDir || '/models';
    }

    // ========================================================================
    // Text-to-Speech
    // ========================================================================

    /**
     * Synthesize text to speech using Piper
     *
     * @param request - TTS request parameters
     * @returns Promise resolving to TTS response
     */
    async synthesize(request: TTSRequest): Promise<TTSResponse> {
        const startTime = Date.now();

        try {
            const language = this.normalizeLanguage(request.language);
            const quality = this.getQuality(request.quality);
            const voice = this.getVoiceId(request.voice, language, quality);

            const body: PiperTTSRequest = {
                text: request.text,
                voice: voice,
                quality: quality,
                speaker_id: undefined,
                noise_scale: 0.667,
                length_scale: request.speed !== undefined ? 1 / request.speed : 1.0,
                noise_w: 0.8
            };

            const response = await this.fetchPiper(
                '/tts',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || error.message || `Piper error: ${response.status}`);
            }

            const data = await response.json() as PiperTTSResponse;

            // Convert base64 audio to ArrayBuffer
            const audioBuffer = this.base64ToArrayBuffer(data.audio);

            // Calculate duration
            const duration = data.duration || this.estimateDuration(request.text, request.speed || 1, data.sample_rate);

            return {
                success: true,
                audioId: this.generateAssetId(),
                audioData: audioBuffer,
                format: 'wav', // Piper always outputs WAV
                duration,
                characters: request.text.length,
                provider: 'piper',
                voice: voice,
                processingTimeMs: Date.now() - startTime,
                costUsd: 0 // Local is free
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'TTS synthesis failed'
            };
        }
    }

    /**
     * Synthesize with streaming response
     *
     * @param request - TTS request parameters
     * @returns ReadableStream of audio chunks
     */
    async synthesizeStream(request: TTSRequest): Promise<ReadableStream<Uint8Array> | null> {
        try {
            const language = this.normalizeLanguage(request.language);
            const quality = this.getQuality(request.quality);
            const voice = this.getVoiceId(request.voice, language, quality);

            const body: PiperTTSRequest = {
                text: request.text,
                voice: voice,
                quality: quality,
                length_scale: request.speed !== undefined ? 1 / request.speed : 1.0
            };

            const response = await this.fetchPiper(
                '/tts/stream',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                return null;
            }

            return response.body!;
        } catch {
            return null;
        }
    }

    // ========================================================================
    // Voice Library
    // ========================================================================

    /**
     * Get list of available voices
     *
     * @param language - Optional language filter
     * @returns Promise resolving to voice list
     */
    async getVoices(language?: Locale): Promise<VoiceListResponse> {
        try {
            // Check cache first
            if (this.voiceCache && Date.now() < this.cacheExpiry) {
                const voices = Array.from(this.voiceCache.values());
                const filtered = language
                    ? voices.filter(v => v.language === language)
                    : voices;
                return this.formatVoices(filtered);
            }

            const response = await this.fetchPiper('/voices', {
                method: 'GET'
            });

            if (!response.ok) {
                // Use default voices if API fails
                const defaultVoices = this.getDefaultVoices();
                const filtered = language
                    ? defaultVoices.filter(v => v.language === language)
                    : defaultVoices;
                return this.formatVoices(filtered);
            }

            const data = await response.json() as { voices: PiperVoice[] };

            // Cache the voices
            this.voiceCache = new Map(data.voices.map(v => [v.name, v]));
            this.cacheExpiry = Date.now() + this.CACHE_TTL;

            const filtered = language
                ? data.voices.filter(v => v.language === language)
                : data.voices;

            return this.formatVoices(filtered);
        } catch (error) {
            // Return default voices on error
            const defaultVoices = this.getDefaultVoices();
            const filtered = language
                ? defaultVoices.filter(v => v.language === language)
                : defaultVoices;
            return this.formatVoices(filtered);
        }
    }

    /**
     * Get a specific voice
     *
     * @param voiceId - Voice ID
     * @returns Voice details or null
     */
    async getVoice(voiceId: string): Promise<Voice | null> {
        try {
            // Check cache first
            if (this.voiceCache && this.voiceCache.has(voiceId)) {
                return this.formatVoice(this.voiceCache.get(voiceId)!);
            }

            const response = await this.fetchPiper(`/voices/${voiceId}`, {
                method: 'GET'
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as PiperVoice;
            return this.formatVoice(data);
        } catch {
            return null;
        }
    }

    // ========================================================================
    // Health & Status
    // ========================================================================

    /**
     * Check Piper server health
     *
     * @returns True if server is accessible
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.fetchPiper('/health', {
                method: 'GET'
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get supported languages
     *
     * @returns Array of supported locale codes
     */
    getSupportedLanguages(): Locale[] {
        return Object.keys(PIPER_DEFAULT_VOICES).map(k => {
            const [lang, region] = k.split('-');
            return `${lang}-${region}` as Locale;
        });
    }

    /**
     * Get server information
     *
     * @returns Server info
     */
    async getServerInfo(): Promise<{
        version: string;
        models_loaded: string[];
        sample_rate: number;
    } | null> {
        try {
            const response = await this.fetchPiper('/info', {
                method: 'GET'
            });

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch {
            return null;
        }
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Make fetch request to Piper server
     */
    private async fetchPiper(path: string, options: RequestInit): Promise<Response> {
        return fetch(`${this.baseUrl}${path}`, options);
    }

    /**
     * Get voice ID from name or use default for language
     */
    private getVoiceId(voice: string | undefined, language: Locale, quality: string): string {
        if (voice) {
            return voice;
        }

        // Get default voice for language and quality
        const key = `${language}-${quality}`;
        return PIPER_DEFAULT_VOICES[key] || PIPER_DEFAULT_VOICES['en-US-medium'] || 'en_US-lessac-medium';
    }

    /**
     * Normalize language code
     */
    private normalizeLanguage(language?: Locale): Locale {
        if (!language) {
            return 'en-US';
        }

        // Extract language and region
        const parts = language.split('-');
        if (parts.length >= 2) {
            return `${parts[0]}-${parts[1]}` as Locale;
        }

        // Default to US for English
        if (parts[0] === 'en') {
            return 'en-US';
        }

        return language;
    }

    /**
     * Get quality tier as Piper model size
     */
    private getQuality(quality?: 'draft' | 'standard' | 'high' | 'ultra'): string {
        return PIPER_MODELS[quality || 'standard'] || 'base';
    }

    /**
     * Generate a unique asset ID
     */
    private generateAssetId(): string {
        return `piper_${crypto.randomUUID()}`;
    }

    /**
     * Estimate audio duration from text
     */
    private estimateDuration(text: string, speed: number, sampleRate: number): number {
        // Piper generates audio at specific sample rates
        // Rough estimate based on character count
        const baseDuration = text.length * 0.05; // ~50ms per character
        return baseDuration / speed;
    }

    /**
     * Get default built-in voices
     */
    private getDefaultVoices(): PiperVoice[] {
        return Object.entries(PIPER_DEFAULT_VOICES).map(([key, name]) => {
            const [language, regionQuality] = key.split('-');
            const [region, quality] = regionQuality.split('-');
            const sampleRate = PIPER_SAMPLE_RATES[quality as keyof typeof PIPER_SAMPLE_RATES] || 22050;

            return {
                name: name,
                language: `${language}-${region}`,
                quality: quality,
                sample_rate: sampleRate
            };
        });
    }

    /**
     * Format voices from API to standard format
     */
    private formatVoices(voices: PiperVoice[]): VoiceListResponse {
        return {
            success: true,
            voices: voices.map(v => this.formatVoice(v)),
            total: voices.length,
            provider: 'piper'
        };
    }

    /**
     * Format single voice
     */
    private formatVoice(voice: PiperVoice): Voice {
        // Extract gender from voice name if possible
        const nameLower = voice.name.toLowerCase();
        let gender: 'male' | 'female' | undefined;

        if (nameLower.includes('female') || nameLower.includes('amy') || nameLower.includes('eva') || nameLower.includes('carlfm')) {
            gender = 'female';
        } else if (nameLower.includes('male') || nameLower.includes('lessac') || nameLower.includes('dmitri')) {
            gender = 'male';
        }

        return {
            id: voice.name,
            name: voice.name,
            provider: 'piper',
            language: voice.language as Locale,
            gender,
            isCloned: false,
            capabilities: {
                streaming: true,
                phonemes: false,
                styleControl: false,
                emotionControl: false,
                formats: ['wav']
            }
        };
    }

    /**
     * Convert base64 to ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a Piper TTS client
 *
 * @param config - Piper configuration
 * @returns Configured PiperClient
 */
export function createPiperClient(config: PiperConfig): PiperClient {
    return new PiperClient(config);
}

/**
 * Create Piper client from environment
 *
 * @param env - Environment object with PIPER_ENDPOINT
 * @returns Configured PiperClient or null
 */
export function createPiperClientFromEnv(env: {
    PIPER_ENDPOINT?: string;
}): PiperClient | null {
    const endpoint = env.PIPER_ENDPOINT;
    if (!endpoint) {
        return null;
    }
    return createPiperClient({ endpoint });
}

// ============================================================================
// Re-exports
// ============================================================================

export { PIPER_MODELS, PIPER_SAMPLE_RATES, PIPER_DEFAULT_VOICES };
