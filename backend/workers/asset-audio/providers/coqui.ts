/**
 * Coqui XTTS Provider Implementation
 *
 * Integration with Coqui TTS (XTTS v2) for open-source text-to-speech.
 * Coqui provides high-quality multilingual TTS with voice cloning capabilities.
 *
 * Reference: https://github.com/coqui-ai/TTS
 * Documentation: https://tts.readthedocs.io/
 *
 * Features:
 * - Multi-language TTS support
 * - Voice cloning from audio samples
 * - Cross-language voice cloning
 * - Neural TTS with natural prosody
 * - Self-hosted option
 */

import type {
    TTSRequest,
    TTSResponse,
    VoiceCloneRequest,
    VoiceCloneResponse,
    VoiceListResponse,
    Voice,
    CoquiConfig,
    CoquiResponse,
    AudioFormat,
    Locale
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const COQUI_DEFAULT_ENDPOINT = 'https://api.coqui.ai/v1';
const COQUI_HF_MODEL = 'coqui/XTTS-v2';

// Supported languages for XTTS v2
const COQUI_LANGUAGES: Record<string, Locale[]> = {
    'en': ['en-US', 'en-GB', 'en-AU', 'en-IN'],
    'es': ['es-ES', 'es-MX'],
    'fr': ['fr-FR'],
    'de': ['de-DE'],
    'it': ['it-IT'],
    'pt': ['pt-BR', 'pt-PT'],
    'pl': ['pl-PL'],
    'tr': ['tr-TR'],
    'ru': ['ru-RU'],
    'nl': ['nl-NL'],
    'cs': ['cs-CZ'],
    'ar': ['ar-SA'],
    'zh': ['zh-CN'],
    'ja': ['ja-JP'],
    'ko': ['ko-KR'],
    'hu': ['hu-HU'],
    'hi': ['hi-IN']
};

// Default voice mappings
const DEFAULT_VOICES: Record<string, string> = {
    'en-US': 'female_english_us',
    'en-GB': 'female_english_uk',
    'es-ES': 'female_spanish',
    'fr-FR': 'female_french',
    'de-DE': 'female_german',
    'it-IT': 'female_italian',
    'pt-BR': 'female_portuguese',
    'ja-JP': 'female_japanese',
    'ko-KR': 'female_korean',
    'zh-CN': 'female_chinese'
};

// ============================================================================
// Types
// ============================================================================

interface CoquiTTSRequest {
    text: string;
    voice_id?: string;
    language?: string;
    speed?: number;
    output_format?: 'wav' | 'mp3' | 'flac';
}

interface CoquiVoiceCloneRequest {
    name: string;
    audio_url?: string;
    audio_data?: string; // base64
    language?: string;
    sample_rate?: number;
}

interface CoquiVoice {
    voice_id: string;
    name: string;
    language: string;
    gender?: 'male' | 'female';
    is_cloned?: boolean;
    created_at?: string;
}

// ============================================================================
// Coqui Client Class
// ============================================================================

/**
 * Coqui TTS Client
 *
 * Provides access to Coqui's XTTS v2 for text-to-speech and voice cloning.
 * Can be used with Coqui's API or self-hosted instance.
 */
export class CoquiClient {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly modelEndpoint: string;
    private readonly enableCloning: boolean;

    // Voice cache
    private voiceCache: Map<string, CoquiVoice> | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_TTL = 3600000; // 1 hour

    // Custom voices (created via cloning)
    private readonly customVoices = new Map<string, CoquiVoice>();

    constructor(config: CoquiConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.endpoint || COQUI_DEFAULT_ENDPOINT;
        this.modelEndpoint = config.modelEndpoint || COQUI_HF_MODEL;
        this.enableCloning = config.enableCloning !== false;
    }

    // ========================================================================
    // Text-to-Speech
    // ========================================================================

    /**
     * Synthesize text to speech using XTTS v2
     *
     * @param request - TTS request parameters
     * @returns Promise resolving to TTS response
     */
    async synthesize(request: TTSRequest): Promise<TTSResponse> {
        const startTime = Date.now();

        try {
            const language = this.normalizeLanguage(request.language);
            const voiceId = this.getVoiceId(request.voice, language);

            const body: CoquiTTSRequest = {
                text: request.text,
                voice_id: voiceId,
                language: language,
                speed: request.speed || 1.0,
                output_format: this.mapFormat(request.outputFormat)
            };

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/tts`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || error.message || `Coqui error: ${response.status}`);
            }

            const data = await response.json() as CoquiResponse;

            // Convert base64 audio to ArrayBuffer
            const audioBuffer = this.base64ToArrayBuffer(data.audio);

            // Estimate duration
            const duration = this.estimateDuration(request.text, request.speed || 1);

            return {
                success: true,
                audioId: this.generateAssetId(),
                audioData: audioBuffer,
                format: request.outputFormat || 'wav',
                duration,
                characters: request.text.length,
                provider: 'coqui',
                voice: voiceId,
                processingTimeMs: Date.now() - startTime,
                costUsd: 0 // Self-hosted is free
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
            const voiceId = this.getVoiceId(request.voice, language);

            const body: CoquiTTSRequest = {
                text: request.text,
                voice_id: voiceId,
                language: language,
                speed: request.speed || 1.0,
                output_format: this.mapFormat(request.outputFormat)
            };

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/tts/stream`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
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
    // Voice Cloning
    // ========================================================================

    /**
     * Clone a voice from audio sample
     *
     * @param request - Voice cloning request
     * @returns Promise resolving to clone response
     */
    async cloneVoice(request: VoiceCloneRequest): Promise<VoiceCloneResponse> {
        const startTime = Date.now();

        if (!this.enableCloning) {
            return {
                success: false,
                error: 'Voice cloning is disabled'
            };
        }

        try {
            const language = this.normalizeLanguage(request.language);

            let audioData: string;
            if (request.sampleAudio instanceof ArrayBuffer) {
                audioData = this.arrayBufferToBase64(request.sampleAudio);
            } else if (request.sampleAudio.startsWith('http')) {
                audioData = request.sampleAudio; // URL
            } else {
                audioData = request.sampleAudio; // Assume base64
            }

            const body: CoquiVoiceCloneRequest = {
                name: request.voiceName,
                language: language,
                sample_rate: 24000 // XTTS default sample rate
            };

            // Use URL or data based on what we have
            if (audioData.startsWith('http')) {
                body.audio_url = audioData;
            } else {
                body.audio_data = audioData;
            }

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices/clone`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || error.message || `Cloning error: ${response.status}`);
            }

            const data = await response.json() as { voice_id: string };

            // Cache the new voice
            const newVoice: CoquiVoice = {
                voice_id: data.voice_id,
                name: request.voiceName,
                language: language,
                is_cloned: true,
                created_at: new Date().toISOString()
            };
            this.customVoices.set(data.voice_id, newVoice);

            return {
                success: true,
                voiceId: data.voice_id,
                voiceName: request.voiceName,
                provider: 'coqui',
                quality: 'high',
                processingTimeMs: Date.now() - startTime,
                costUsd: 0
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Voice cloning failed'
            };
        }
    }

    /**
     * Delete a cloned voice
     *
     * @param voiceId - Voice ID to delete
     * @returns True if deleted successfully
     */
    async deleteVoice(voiceId: string): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices/${voiceId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            this.customVoices.delete(voiceId);
            this.voiceCache = null;

            return response.ok;
        } catch {
            return false;
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

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            if (!response.ok) {
                // Use default voices if API fails
                const defaultVoices = this.getDefaultVoices();
                return this.formatVoices(defaultVoices);
            }

            const data = await response.json() as { voices: CoquiVoice[] };

            // Cache the voices
            this.voiceCache = new Map(data.voices.map(v => [v.voice_id, v]));
            this.cacheExpiry = Date.now() + this.CACHE_TTL;

            const allVoices = [...data.voices, ...this.customVoices.values()];
            const filtered = language
                ? allVoices.filter(v => v.language === language)
                : allVoices;

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
        // Check custom voices first
        if (this.customVoices.has(voiceId)) {
            return this.formatVoice(this.customVoices.get(voiceId)!);
        }

        // Check cache
        if (this.voiceCache && this.voiceCache.has(voiceId)) {
            return this.formatVoice(this.voiceCache.get(voiceId)!);
        }

        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices/${voiceId}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as CoquiVoice;
            return this.formatVoice(data);
        } catch {
            return null;
        }
    }

    // ========================================================================
    // Health & Status
    // ========================================================================

    /**
     * Check API health
     *
     * @returns True if API is accessible
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/health`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );
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
        return Object.values(COQUI_LANGUAGES).flat();
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Make authenticated fetch request
     */
    private async fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
        return fetch(url, options);
    }

    /**
     * Get voice ID from name or use default
     */
    private getVoiceId(voice: string | undefined, language: Locale): string {
        if (voice) {
            return voice;
        }
        return DEFAULT_VOICES[language] || DEFAULT_VOICES['en-US'] || 'female_english_us';
    }

    /**
     * Normalize language code to Coqui format
     */
    private normalizeLanguage(language: Locale | undefined): string {
        if (!language) {
            return 'en';
        }
        // Extract the language part (first 2 letters)
        const langCode = language.substring(0, 2).toLowerCase();

        // Verify it's supported
        if (COQUI_LANGUAGES[langCode]) {
            return langCode;
        }

        return 'en'; // Default to English
    }

    /**
     * Map output format to Coqui format
     */
    private mapFormat(format?: AudioFormat): string {
        switch (format) {
            case 'wav':
                return 'wav';
            case 'flac':
                return 'flac';
            case 'mp3':
            default:
                return 'wav'; // Coqui prefers WAV
        }
    }

    /**
     * Generate a unique asset ID
     */
    private generateAssetId(): string {
        return `coqui_${crypto.randomUUID()}`;
    }

    /**
     * Estimate audio duration from text
     */
    private estimateDuration(text: string, speed: number): number {
        // Average speaking rate: ~150 words per minute
        const wordCount = text.split(/\s+/).length;
        const baseDuration = (wordCount / 150) * 60;
        return baseDuration / speed;
    }

    /**
     * Get default built-in voices
     */
    private getDefaultVoices(): CoquiVoice[] {
        return Object.entries(DEFAULT_VOICES).map(([locale, voiceId]) => ({
            voice_id: voiceId,
            name: `Default ${locale}`,
            language: locale,
            is_cloned: false
        }));
    }

    /**
     * Format voices from API to standard format
     */
    private formatVoices(voices: CoquiVoice[]): VoiceListResponse {
        return {
            success: true,
            voices: voices.map(v => this.formatVoice(v)),
            total: voices.length,
            provider: 'coqui'
        };
    }

    /**
     * Format single voice
     */
    private formatVoice(voice: CoquiVoice): Voice {
        return {
            id: voice.voice_id,
            name: voice.name,
            provider: 'coqui',
            language: voice.language as Locale,
            gender: voice.gender,
            isCloned: voice.is_cloned,
            capabilities: {
                streaming: false,
                phonemes: false,
                styleControl: false,
                emotionControl: false,
                formats: ['wav', 'mp3', 'ogg']
            }
        };
    }

    /**
     * Convert ArrayBuffer to base64
     */
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        return btoa(binary);
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
 * Create a Coqui TTS client
 *
 * @param config - Coqui configuration
 * @returns Configured CoquiClient
 */
export function createCoquiClient(config: CoquiConfig): CoquiClient {
    return new CoquiClient(config);
}

/**
 * Create Coqui client from environment
 *
 * @param env - Environment object with COQUI_API_KEY
 * @returns Configured CoquiClient or null
 */
export function createCoquiClientFromEnv(env: {
    COQUI_API_KEY?: string;
    COQUI_ENDPOINT?: string;
}): CoquiClient | null {
    const apiKey = env.COQUI_API_KEY;
    if (!apiKey) {
        return null;
    }
    return createCoquiClient({
        apiKey,
        endpoint: env.COQUI_ENDPOINT
    });
}

// ============================================================================
// Re-exports
// ============================================================================

export { COQUI_LANGUAGES, DEFAULT_VOICES };
