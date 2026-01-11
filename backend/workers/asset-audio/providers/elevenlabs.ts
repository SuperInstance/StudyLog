/**
 * ElevenLabs Provider Implementation
 *
 * Comprehensive integration with ElevenLabs API:
 * - Text-to-Speech (TTS) with Turbo v2.5
 * - Voice Cloning and Voice Design
 * - Sound Effects generation
 * - Streaming support
 * - Phoneme/viseme timing for lip sync
 *
 * API Reference: https://elevenlabs.io/docs/api
 */

import type {
    TTSRequest,
    TTSResponse,
    VoiceCloneRequest,
    VoiceCloneResponse,
    SoundEffectRequest,
    SoundEffectResponse,
    VoiceListResponse,
    Voice,
    ElevenLabsConfig,
    ElevenLabsVoiceSettings,
    ElevenLabsResponse,
    ElevenLabsVoice,
    PhonemeTiming,
    AudioFormat,
    Locale
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

const ELEVENLABS_MODELS = {
    ELEVEN_MONOLINGUAL_V1: 'eleven_monolingual_v1',
    ELEVEN_MULTILINGUAL_V2: 'eleven_multilingual_v2',
    ELEVEN_TURBO_V2: 'eleven_turbo_v2',
    ELEVEN_TURBO_V2_5: 'eleven_turbo_v2_5',
    ELEVEN_TURBO_V2_5_LOWDATASET: 'eleven_turbo_v2_5_lowdataset'
} as const;

const ELEVENLABS_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

const DEFAULT_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: false
};

// Voice ID to name mapping for common voices
const PRESET_VOICES: Record<string, string> = {
    '21m00Tcm4TlvDq8ikWAM': 'Rachel',
    'AZnzlk1XvdvUeBnXmlld': 'Domi',
    'EXAVITQu4vr4xnSDxMaL': 'Bella',
    'ErXwobaYiN0WP9Lgc85a': 'Antoni',
    'D38z5RhdWvJvqFEgT9nQ': 'Josh',
    'Cwh6TVqTEPf7BmqFQYt3': 'Fin',
    'TxGEqnHWrfWFTfGW9XjX': 'Myrtle'
};

// ============================================================================
// Types
// ============================================================================

interface ElevenLabsTTSOptions {
    model_id: string;
    voice_settings: ElevenLabsVoiceSettings;
    pronunciation_dictionary_locators?: Array<{
        pronunciation_dictionary_id: string;
        version_id: string;
    }>;
}

interface ElevenLabsVoiceCloneBody {
    name: string;
    description?: string;
    files?: Array<{
        name: string;
        content: string; // base64
    }>;
    // URL-based cloning
    url?: string;
}

interface ElevenLabsSoundEffectsBody {
    text: string;
    duration_seconds?: number;
    prompt_influence?: number;
    seed?: number;
}

interface PhonemeTimingData {
    phonemes: Array<{
        phoneme: string;
        start_time: number;
        end_time: number;
    }>;
}

// ============================================================================
// ElevenLabs Client Class
// ============================================================================

/**
 * ElevenLabs API Client
 *
 * Provides comprehensive access to ElevenLabs services including:
 * - Text-to-Speech with multiple models
 * - Voice cloning from samples
 * - Sound effects generation
 * - Voice library management
 * - Phoneme timing for lip sync
 */
export class ElevenLabsClient {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly defaultVoiceSettings: ElevenLabsVoiceSettings;
    private readonly defaultModel: string;

    // Cache for voices
    private voiceCache: Map<string, ElevenLabsVoice> | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_TTL = 3600000; // 1 hour

    constructor(config: ElevenLabsConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.endpoint || ELEVENLABS_BASE_URL;
        this.defaultVoiceSettings = {
            ...DEFAULT_VOICE_SETTINGS,
            ...(config.defaultVoiceSettings || {})
        };
        this.defaultModel = config.model || 'eleven_turbo_v2_5';
    }

    // ========================================================================
    // Text-to-Speech
    // ========================================================================

    /**
     * Synthesize text to speech
     *
     * @param request - TTS request parameters
     * @returns Promise resolving to TTS response
     */
    async synthesize(request: TTSRequest): Promise<TTSResponse> {
        const startTime = Date.now();

        try {
            const voiceId = this.getVoiceId(request.voice);
            const modelId = this.getModelId(request.quality);

            // Build request body
            const body: ElevenLabsTTSOptions = {
                model_id: modelId,
                voice_settings: {
                    ...this.defaultVoiceSettings,
                    stability: request.speed !== undefined ? 1 - (request.speed - 1) * 0.5 : this.defaultVoiceSettings.stability,
                    similarity_boost: this.defaultVoiceSettings.similarity_boost,
                    style: 0,
                    use_speaker_boost: false
                }
            };

            // Check if phonemes are requested
            const includePhonemes = request.enablePhonemes || request.useCase === 'lip_sync';

            // Make request
            const url = `${this.baseUrl}/text-to-speech/${voiceId}`;
            const response = await this.fetchWithAuth(
                includePhonemes ? `${url}?output_format=mp3_44100_128&optimize_streaming_latency=0` : url,
                {
                    method: 'POST',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify({
                        text: request.text,
                        model_id: modelId,
                        voice_settings: body.voice_settings
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(error.detail || `ElevenLabs error: ${response.status}`);
            }

            // Get audio data
            const audioBuffer = await response.arrayBuffer();
            const audioData = new Uint8Array(audioBuffer);

            // Calculate duration (rough estimate based on text length and speed)
            const estimatedDuration = this.estimateDuration(request.text, request.speed || 1);

            // Get phoneme timing if requested (via separate endpoint)
            let phonemes: PhonemeTiming[] | undefined;
            if (includePhonemes) {
                phonemes = await this.getPhonemeTiming(request.text, voiceId);
            }

            // Calculate cost
            const cost = this.calculateCost(request.text.length, modelId);

            return {
                success: true,
                audioId: this.generateAssetId(),
                audioData: audioBuffer,
                format: request.outputFormat || 'mp3',
                duration: estimatedDuration,
                characters: request.text.length,
                provider: 'elevenlabs',
                voice: request.voice || PRESET_VOICES[voiceId] || voiceId,
                processingTimeMs: Date.now() - startTime,
                costUsd: cost,
                phonemes
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
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
            const voiceId = this.getVoiceId(request.voice);
            const modelId = this.getModelId(request.quality);

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
                {
                    method: 'POST',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify({
                        text: request.text,
                        model_id: modelId,
                        voice_settings: {
                            ...this.defaultVoiceSettings,
                            stability: request.speed !== undefined ? 1 - (request.speed - 1) * 0.5 : this.defaultVoiceSettings.stability,
                            similarity_boost: this.defaultVoiceSettings.similarity_boost,
                            style: 0,
                            use_speaker_boost: false
                        }
                    })
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
     * Clone a voice from audio samples
     *
     * @param request - Voice cloning request
     * @returns Promise resolving to clone response
     */
    async cloneVoice(request: VoiceCloneRequest): Promise<VoiceCloneResponse> {
        const startTime = Date.now();

        try {
            // Convert audio to base64 if it's an ArrayBuffer
            let audioBase64: string;
            if (request.sampleAudio instanceof ArrayBuffer) {
                audioBase64 = this.arrayBufferToBase64(request.sampleAudio);
            } else {
                audioBase64 = request.sampleAudio;
            }

            const body: ElevenLabsVoiceCloneBody = {
                name: request.voiceName,
                description: request.description
            };

            // If it's a URL, use URL-based cloning
            if (request.sampleAudio.startsWith('http')) {
                body.url = request.sampleAudio;
            } else {
                // File-based cloning
                const fileExtension = request.sampleFormat || 'mp3';
                body.files = [
                    {
                        name: `sample.${fileExtension}`,
                        content: audioBase64
                    }
                ];
            }

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices/add`,
                {
                    method: 'POST',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(error.detail?.message || error.detail || `ElevenLabs error: ${response.status}`);
            }

            const data = await response.json() as { voice_id?: string };

            // Clear voice cache since we added a new voice
            this.voiceCache = null;

            return {
                success: true,
                voiceId: data.voice_id,
                voiceName: request.voiceName,
                provider: 'elevenlabs',
                quality: 'high',
                processingTimeMs: Date.now() - startTime,
                costUsd: 5.00 // Voice cloning costs $5
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Voice cloning failed'
            };
        }
    }

    // ========================================================================
    // Sound Effects
    // ========================================================================

    /**
     * Generate sound effects from text description
     *
     * @param request - Sound effect generation request
     * @returns Promise resolving to sound effect response
     */
    async generateSoundEffect(request: SoundEffectRequest): Promise<SoundEffectResponse> {
        const startTime = Date.now();

        try {
            const body: ElevenLabsSoundEffectsBody = {
                text: request.prompt,
                duration_seconds: request.duration || 5,
                prompt_influence: 0.3
            };

            if (request.seed !== undefined) {
                body.seed = request.seed;
            }

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/sound-generation`,
                {
                    method: 'POST',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    },
                    body: JSON.stringify(body)
                }
            );

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(error.detail?.message || error.detail || `ElevenLabs SFX error: ${response.status}`);
            }

            // ElevenLabs returns async generation response
            const data = await response.json() as ElevenLabsResponse;

            if (data.status === 'pending' || data.status === 'processing') {
                // Return the task ID for polling
                return {
                    success: true,
                    sfxId: data.task_id,
                    provider: 'elevenlabs',
                    processingTimeMs: Date.now() - startTime,
                    costUsd: 0.01
                };
            }

            // If completed, get the audio
            if (data.status === 'completed' && data.audio_base64) {
                const audioData = this.base64ToArrayBuffer(data.audio_base64);
                const duration = request.duration || 5;

                return {
                    success: true,
                    sfxId: data.task_id,
                    audioData,
                    format: 'mp3',
                    duration,
                    provider: 'elevenlabs',
                    processingTimeMs: Date.now() - startTime,
                    costUsd: 0.01
                };
            }

            throw new Error(`Unexpected status: ${data.status}`);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'SFX generation failed'
            };
        }
    }

    /**
     * Get status of a sound effect generation task
     *
     * @param taskId - The task ID from generation request
     * @returns Promise resolving to task status
     */
    async getSoundGenerationStatus(taskId: string): Promise<{
        status: 'pending' | 'processing' | 'completed' | 'failed';
        audioUrl?: string;
        error?: string;
    }> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/sound-generation/${taskId}`,
                {
                    method: 'GET',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Status check failed: ${response.status}`);
            }

            const data = await response.json() as ElevenLabsResponse;

            return {
                status: data.status as 'pending' | 'processing' | 'completed' | 'failed',
                audioUrl: data.audio_base64 ? `data:audio/mp3;base64,${data.audio_base64}` : undefined
            };
        } catch (error) {
            return {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Status check failed'
            };
        }
    }

    // ========================================================================
    // Voice Library
    // ========================================================================

    /**
     * Get list of available voices
     *
     * @returns Promise resolving to voice list
     */
    async getVoices(): Promise<VoiceListResponse> {
        try {
            // Check cache first
            if (this.voiceCache && Date.now() < this.cacheExpiry) {
                const voices = Array.from(this.voiceCache.values());
                return this.formatVoices(voices);
            }

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices`,
                {
                    method: 'GET',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.status}`);
            }

            const data = await response.json() as { voices: ElevenLabsVoice[] };

            // Cache the voices
            this.voiceCache = new Map(data.voices.map(v => [v.voice_id, v]));
            this.cacheExpiry = Date.now() + this.CACHE_TTL;

            return this.formatVoices(data.voices);
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to fetch voices'
            };
        }
    }

    /**
     * Get a specific voice by ID
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

            const response = await this.fetchWithAuth(
                `${this.baseUrl}/voices/${voiceId}`,
                {
                    method: 'GET',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as ElevenLabsVoice;
            return this.formatVoice(data);
        } catch {
            return null;
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
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    }
                }
            );

            // Clear cache
            this.voiceCache = null;

            return response.ok;
        } catch {
            return false;
        }
    }

    // ========================================================================
    // Phoneme Timing for Lip Sync
    // ========================================================================

    /**
     * Get phoneme timing for text
     *
     * @param text - Text to get phonemes for
     * @param voiceId - Voice ID to use
     * @returns Array of phoneme timings
     */
    async getPhonemeTiming(text: string, voiceId?: string): Promise<PhonemeTiming[]> {
        try {
            const voice = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel

            // Note: ElevenLabs doesn't directly expose phoneme timing API
            // This is a placeholder implementation that would need to be updated
            // when/if ElevenLabs exposes this functionality
            // For now, we'll return estimated timing based on text

            const phonemes: PhonemeTiming[] = [];
            const words = text.split(/\s+/);
            let currentTime = 0;

            for (const word of words) {
                // Estimate duration based on word length
                const wordDuration = word.length * 0.05; // ~50ms per character

                // Split word into phonemes (simplified)
                const wordPhonemes = this.wordToPhonemes(word);

                for (const phoneme of wordPhonemes) {
                    const phonemeDuration = wordDuration / wordPhonemes.length;
                    phonemes.push({
                        phoneme,
                        viseme: this.phonemeToViseme(phoneme),
                        startTime: currentTime,
                        endTime: currentTime + phonemeDuration
                    });
                    currentTime += phonemeDuration;
                }
            }

            return phonemes;
        } catch {
            return [];
        }
    }

    // ========================================================================
    // User Info & Quota
    // ========================================================================

    /**
     * Get user information and subscription details
     *
     * @returns User info object
     */
    async getUserInfo(): Promise<{
        subscription: string;
        character_count: number;
        character_limit: number;
        allowed: number;
    } | null> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/user/subscription`,
                {
                    method: 'GET',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                return null;
            }

            return await response.json();
        } catch {
            return null;
        }
    }

    /**
     * Check API health and validity
     *
     * @returns True if API is accessible
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth(
                `${this.baseUrl}/user`,
                {
                    method: 'GET',
                    headers: {
                        ...ELEVENLABS_HEADERS,
                        'xi-api-key': this.apiKey
                    }
                }
            );
            return response.ok;
        } catch {
            return false;
        }
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
     * Get voice ID from voice name or ID
     */
    private getVoiceId(voice?: string): string {
        if (!voice) {
            return '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
        }

        // Check if it's a preset voice name
        const presetId = Object.entries(PRESET_VOICES).find(([_, name]) => name === voice)?.[0];
        if (presetId) {
            return presetId;
        }

        // Assume it's already a voice ID
        return voice;
    }

    /**
     * Get model ID based on quality tier
     */
    private getModelId(quality?: 'draft' | 'standard' | 'high' | 'ultra'): string {
        switch (quality) {
            case 'draft':
                return ELEVENLABS_MODELS.ELEVEN_TURBO_V2;
            case 'high':
            case 'ultra':
                return ELEVENLABS_MODELS.ELEVEN_MULTILINGUAL_V2;
            case 'standard':
            default:
                return this.defaultModel;
        }
    }

    /**
     * Generate a unique asset ID
     */
    private generateAssetId(): string {
        return `el_${crypto.randomUUID()}`;
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
     * Calculate cost for generation
     */
    private calculateCost(characterCount: number, model: string): number {
        // Pricing (as of 2024):
        // Turbo v2: $0.30 per 1K characters
        // Multilingual v2: $0.30 per 1K characters
        const costPerK = 0.30;
        return (characterCount / 1000) * costPerK;
    }

    /**
     * Format voices from API to standard format
     */
    private formatVoices(voices: ElevenLabsVoice[]): VoiceListResponse {
        return {
            success: true,
            voices: voices.map(v => this.formatVoice(v)),
            total: voices.length,
            provider: 'elevenlabs'
        };
    }

    /**
     * Format single voice from API to standard format
     */
    private formatVoice(voice: ElevenLabsVoice): Voice {
        // Extract gender from labels if available
        const gender = this.extractGender(voice.labels);

        return {
            id: voice.voice_id,
            name: voice.name,
            provider: 'elevenlabs',
            language: this.extractLanguage(voice.labels),
            gender,
            style: voice.category,
            isCloned: false,
            sampleUrl: voice.preview_url,
            capabilities: {
                streaming: true,
                phonemes: true,
                styleControl: true,
                emotionControl: true,
                formats: ['mp3', 'pcm', 'opus']
            }
        };
    }

    /**
     * Extract gender from voice labels
     */
    private extractGender(labels: Record<string, string>): 'male' | 'female' | undefined {
        const gender = labels?.gender;
        if (gender === 'male') return 'male';
        if (gender === 'female') return 'female';
        return undefined;
    }

    /**
     * Extract language from voice labels
     */
    private extractLanguage(labels: Record<string, string>): Locale {
        const accent = labels?.accent || 'american';
        const language = labels?.language || 'english';

        // Map to locale
        const localeMap: Record<string, Locale> = {
            'english-american': 'en-US',
            'english-british': 'en-GB',
            'english-australian': 'en-AU',
            'english-indian': 'en-IN',
            'spanish': 'es-ES',
            'french': 'fr-FR',
            'german': 'de-DE',
            'italian': 'it-IT',
            'portuguese': 'pt-BR',
            'polish': 'pl-PL',
            'dutch': 'nl-NL',
            'japanese': 'ja-JP',
            'korean': 'ko-KR',
            'chinese': 'zh-CN',
            'hindi': 'hi-IN'
        };

        const key = `${language}-${accent}`.toLowerCase();
        return localeMap[key] || 'en-US';
    }

    /**
     * Convert word to phonemes (simplified)
     */
    private wordToPhonemes(word: string): string[] {
        // This is a very simplified phoneme breakdown
        // A real implementation would use a proper phoneme dictionary
        const phonemes: string[] = [];
        const normalized = word.toLowerCase().replace(/[^a-z]/g, '');

        for (const char of normalized) {
            phonemes.push(char);
        }

        return phonemes;
    }

    /**
     * Map phoneme to viseme (0-20)
     */
    private phonemeToViseme(phoneme: string): number {
        const visemeMap: Record<string, number> = {
            'a': 0, 'e': 1, 'i': 2, 'o': 3, 'u': 4,
            'b': 5, 'p': 5, 'm': 6, 'f': 7, 'v': 7,
            'th': 8, 't': 9, 'd': 9, 's': 9, 'z': 9,
            'n': 10, 'l': 11, 'ch': 12, 'sh': 12, 'j': 12,
            'k': 13, 'g': 13, 'ng': 14, 'w': 15, 'r': 16
        };

        return visemeMap[phoneme] ?? 18; // Default to silent
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
// Factory Function
// ============================================================================

/**
 * Create an ElevenLabs client
 *
 * @param config - ElevenLabs configuration
 * @returns Configured ElevenLabsClient
 */
export function createElevenLabsClient(config: ElevenLabsConfig): ElevenLabsClient {
    return new ElevenLabsClient(config);
}

/**
 * Create ElevenLabs client from environment
 *
 * @param env - Environment object with ELEVENLABS_API_KEY
 * @returns Configured ElevenLabsClient
 */
export function createElevenLabsClientFromEnv(env: { ELEVENLABS_API_KEY?: string }): ElevenLabsClient | null {
    const apiKey = env.ELEVENLABS_API_KEY;
    if (!apiKey) {
        return null;
    }
    return createElevenLabsClient({ apiKey });
}

// ============================================================================
// Re-exports
// ============================================================================

export { ELEVENLABS_MODELS, DEFAULT_VOICE_SETTINGS, PRESET_VOICES };
