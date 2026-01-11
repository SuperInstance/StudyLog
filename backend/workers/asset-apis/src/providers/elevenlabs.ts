/**
 * ElevenLabs Turbo v2.5 Provider Integration
 * Real-time TTS, Voice Design, sound effects
 *
 * API Docs: https://docs.elevenlabs.io
 */

import {
    ElevenLabsConfig,
    ElevenLabsVoice,
    ElevenLabsResponse,
    GenerateAudioRequest,
    CreateVoiceRequest,
    GenerationResponse,
    AudioMetadata,
    AudioFormat
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.elevenlabs.io/v1';

const ELEVENLABS_MODELS = {
    ELEVEN_MONOLINGUAL_V1: 'eleven_monolingual_v1',
    ELEVEN_MULTILINGUAL_V1: 'eleven_multilingual_v1',
    ELEVEN_MULTILINGUAL_V2: 'eleven_multilingual_v2',
    ELEVEN_TURBO_V2: 'eleven_turbo_v2',
    ELEVEN_TURBO_V2_5: 'eleven_turbo_v2_5'
} as const;

// ============================================================================
// ElevenLabs Provider Class
// ============================================================================

export class ElevenLabsProvider {
    private config: ElevenLabsConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;
    private voiceCache: Map<string, ElevenLabsVoice>;

    constructor(config: ElevenLabsConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 60;
        this.rateLimitResetAt = Date.now() + 60000;
        this.voiceCache = new Map();
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 60;
            this.rateLimitResetAt = Date.now() + 60000;
        }

        if (this.rateLimitRemaining <= 0) {
            const waitMs = this.rateLimitResetAt - Date.now();
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitMs / 1000)} seconds.`);
        }

        this.rateLimitRemaining--;
    }

    // ========================================================================
    // API Requests
    // ========================================================================

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        skipRateLimit: boolean = false
    ): Promise<T> {
        if (!skipRateLimit) {
            await this.checkRateLimit();
        }

        const url = `${this.config.endpoint}${endpoint}`;
        const headers = {
            'xi-api-key': this.config.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
        }

        // TTS responses return audio, not JSON
        if (endpoint.includes('text-to-speech') || endpoint.includes('generate')) {
            return (await response.blob()) as unknown as T;
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // Text to Speech
    // ========================================================================

    /**
     * Generate speech from text
     */
    async textToSpeech(request: GenerateAudioRequest): Promise<GenerationResponse & { audioId?: string }> {
        const requestId = crypto.randomUUID();
        const validation = this.validateRequest(request);

        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId
            };
        }

        try {
            const voiceId = request.voiceId || await this.getDefaultVoiceId();

            // Build request body
            const body: Record<string, unknown> = {
                model_id: request.model || ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5,
                text: request.text
            };

            if (request.stability !== undefined) {
                body.voice_settings = {
                    ...(body.voice_settings as Record<string, unknown> || {}),
                    stability: request.stability,
                    similarity_boost: request.similarityBoost || 0.75,
                    style: request.style || 0,
                    use_speaker_boost: request.useSpeakerBoost || false
                };
            }

            // Generate speech
            const audioBlob = await this.request<Blob>(
                `/text-to-speech/${voiceId}`,
                {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            const audioId = crypto.randomUUID();

            return {
                success: true,
                assetId: audioId,
                status: 'completed',
                estimatedTimeSeconds: 0,
                audioId,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Stream text to speech for real-time applications
     */
    async streamTextToSpeech(
        request: GenerateAudioRequest,
        onChunk: (chunk: ArrayBuffer) => void
    ): Promise<void> {
        const voiceId = request.voiceId || await this.getDefaultVoiceId();

        const body = {
            model_id: request.model || ELEVENLABS_MODELS.ELEVEN_TURBO_V2_5,
            text: request.text,
            voice_settings: {
                stability: request.stability || 0.5,
                similarity_boost: request.similarityBoost || 0.75
            }
        };

        const response = await fetch(
            `${this.config.endpoint}/text-to-speech/${voiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': this.config.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            throw new Error(`Streaming error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No reader available');
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onChunk(value);
        }
    }

    // ========================================================================
    // Voice Management
    // ========================================================================

    /**
     * Get all available voices
     */
    async getVoices(): Promise<ElevenLabsVoice[]> {
        try {
            const voices = await this.request<{ voices: ElevenLabsVoice[] }>('/voices');
            // Cache the voices
            voices.voices.forEach(voice => {
                this.voiceCache.set(voice.voice_id, voice);
            });
            return voices.voices;
        } catch (error) {
            console.error('Failed to fetch voices:', error);
            return [];
        }
    }

    /**
     * Get a specific voice by ID
     */
    async getVoice(voiceId: string): Promise<ElevenLabsVoice | null> {
        if (this.voiceCache.has(voiceId)) {
            return this.voiceCache.get(voiceId)!;
        }

        try {
            const voice = await this.request<ElevenLabsVoice>(`/voices/${voiceId}`, {}, true);
            this.voiceCache.set(voiceId, voice);
            return voice;
        } catch {
            return null;
        }
    }

    /**
     * Get the default voice ID
     */
    async getDefaultVoiceId(): Promise<string> {
        const voices = await this.getVoices();
        // Return the first "premade" voice as default
        const premade = voices.find(v => v.category === 'premade');
        return premade?.voice_id || voices[0]?.voice_id || '21m00Tcm4TlvDq8ikWAM';
    }

    // ========================================================================
    // Voice Design
    // ========================================================================

    /**
     * Create a custom voice using Voice Design
     */
    async createVoice(request: CreateVoiceRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const body: Record<string, unknown> = {
                name: request.name,
                description: request.description || '',
                labels: {
                    gender: request.gender || 'custom',
                    age: request.age || 'middle_aged',
                    accent: request.accent || 'american',
                    style: request.style || 'conversational'
                }
            };

            // If audio samples are provided, use voice cloning
            if (request.audioSamples && request.audioSamples.length > 0) {
                const formData = new FormData();
                formData.append('name', request.name);
                formData.append('description', request.description || '');

                for (let i = 0; i < request.audioSamples.length; i++) {
                    const sample = request.audioSamples[i];
                    // Convert base64 to blob
                    const byteString = atob(sample.split(',')[1]);
                    const array = new Uint8Array(byteString.length);
                    for (let j = 0; j < byteString.length; j++) {
                        array[j] = byteString.charCodeAt(j);
                    }
                    const blob = new Blob([array], { type: 'audio/mpeg' });
                    formData.append(`files`, blob, `sample_${i}.mp3`);
                }

                const response = await fetch(`${this.config.endpoint}/voices/add`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': this.config.apiKey
                    },
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Voice creation failed: ${response.status}`);
                }

                const result = await response.json();

                return {
                    success: true,
                    assetId: result.voice_id,
                    status: 'completed',
                    requestId
                };
            }

            // Voice Design without samples
            const response = await this.request<{ voice_id: string }>('/voices/add', {
                method: 'POST',
                body: JSON.stringify(body)
            });

            return {
                success: false,
                error: 'Voice Design requires audio samples for cloning. Use Voice Design tool in ElevenLabs dashboard.',
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Delete a custom voice
     */
    async deleteVoice(voiceId: string): Promise<boolean> {
        try {
            await this.request(`/voices/${voiceId}`, { method: 'DELETE' }, true);
            this.voiceCache.delete(voiceId);
            return true;
        } catch {
            return false;
        }
    }

    // ========================================================================
    // Sound Effects
    // ========================================================================

    /**
     * Generate sound effects using ElevenLabs SFX
     */
    async generateSoundEffect(prompt: string, durationSeconds: number = 5): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<{ audio_url?: string }>('/sound-effects', {
                method: 'POST',
                body: JSON.stringify({
                    text: prompt,
                    duration_seconds: durationSeconds,
                    prompt_influence: 0.3
                })
            });

            return {
                success: true,
                assetId: requestId,
                status: 'completed',
                estimatedTimeSeconds: 0,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    // ========================================================================
    // Metadata Extraction
    // ========================================================================

    /**
     * Extract metadata for audio
     */
    async extractMetadata(
        audioBlob: Blob,
        voiceId?: string,
        transcript?: string
    ): Promise<AudioMetadata> {
        // Get audio context to analyze the blob
        let duration = 0;
        let sampleRate = 44100;

        try {
            const audioContext = new AudioContext();
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            duration = audioBuffer.duration;
            sampleRate = audioBuffer.sampleRate;
        } catch {
            // Use defaults if analysis fails
        }

        return {
            format: this.getFormatFromBlob(audioBlob),
            durationSeconds: duration,
            sampleRate: sampleRate,
            bitrate: 128000,
            channels: 1,
            voiceId,
            isVoiceDesign: false,
            hasLipSync: false,
            transcript,
            emotionTags: [],
            fileSizeBytes: audioBlob.size
        };
    }

    private getFormatFromBlob(blob: Blob): AudioFormat {
        const type = blob.type;
        if (type.includes('mp3')) return 'mp3';
        if (type.includes('wav')) return 'wav';
        if (type.includes('ogg')) return 'ogg';
        if (type.includes('aac')) return 'aac';
        if (type.includes('flac')) return 'flac';
        return 'mp3';
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /**
     * Validate TTS request
     */
    validateRequest(request: GenerateAudioRequest): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!request.text || request.text.length === 0) {
            errors.push('Text is required');
        }

        if (request.text && request.text.length > 5000) {
            errors.push('Text must not exceed 5000 characters');
        }

        if (request.stability !== undefined && (request.stability < 0 || request.stability > 1)) {
            errors.push('Stability must be between 0 and 1');
        }

        if (request.similarityBoost !== undefined && (request.similarityBoost < 0 || request.similarityBoost > 1)) {
            errors.push('Similarity boost must be between 0 and 1');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: GenerateAudioRequest): number {
        // ElevenLabs pricing (as of 2024)
        // Turbo v2.5: ~$0.15 per 1K characters
        const charCount = request.text.length;
        const costPer1K = 0.15;
        return (charCount / 1000) * costPer1K;
    }

    /**
     * Get quota usage
     */
    async getQuotaUsage(): Promise<{
        used: number;
        limit: number;
        characterCount: number;
        characterLimit: number;
    }> {
        try {
            const data = await this.request<{
                character_count: number;
                character_limit: number;
            }>('/user/subscription', {}, true);

            return {
                used: 0, // Not provided by API
                limit: 0,
                characterCount: data.character_count,
                characterLimit: data.character_limit
            };
        } catch {
            return {
                used: 0,
                limit: 0,
                characterCount: 0,
                characterLimit: 100000
            };
        }
    }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createElevenLabsProvider(config: ElevenLabsConfig): ElevenLabsProvider {
    return new ElevenLabsProvider(config);
}

// ============================================================================
// Exports
// ============================================================================

export { ELEVENLABS_MODELS };
