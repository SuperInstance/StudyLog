/**
 * Audio Manager - Audio/Voice Orchestration
 * Coordinates ElevenLabs TTS and NVIDIA ACE Audio2Face
 */

import {
    GenerateAudioRequest,
    CreateVoiceRequest,
    GenerateSoundEffectRequest,
    GenerationResponse,
    AudioAsset,
    AudioMetadata,
    AudioFormat,
    AssetProvider,
    LipSyncData
} from '../types.js';

import { ElevenLabsProvider } from '../providers/elevenlabs.js';
import { Audio2FaceProvider } from '../providers/audio2face.js';

// ============================================================================
// Audio Manager Configuration
// ============================================================================

export interface AudioManagerConfig {
    providers?: {
        elevenlabs?: {
            apiKey: string;
            endpoint?: string;
        };
        audio2face?: {
            apiKey: string;
            endpoint?: string;
            arkit?: boolean;
        };
    };
    defaultVoiceId?: string;
    defaultFormat?: AudioFormat;
    enableLipSync?: boolean;
    cacheEnabled?: boolean;
}

// ============================================================================
// Audio Manager Class
// ============================================================================

export class AudioManager {
    private elevenlabs: ElevenLabsProvider | null;
    private audio2face: Audio2FaceProvider | null;
    private config: AudioManagerConfig;
    private voiceCache: Map<string, CachedVoice>;
    private audioCache: Map<string, CachedAudio>;

    constructor(config: AudioManagerConfig) {
        this.config = config;
        this.voiceCache = new Map();
        this.audioCache = new Map();

        // Initialize ElevenLabs
        if (config.providers?.elevenlabs?.apiKey) {
            this.elevenlabs = new ElevenLabsProvider({
                apiKey: config.providers.elevenlabs.apiKey,
                endpoint: config.providers.elevenlabs.endpoint
            });
        } else {
            this.elevenlabs = null;
        }

        // Initialize Audio2Face
        if (config.providers?.audio2face?.apiKey) {
            this.audio2face = new Audio2FaceProvider({
                apiKey: config.providers.audio2face.apiKey,
                endpoint: config.providers.audio2face.endpoint,
                arkit: config.providers.audio2face.arkit
            });
        } else {
            this.audio2face = null;
        }
    }

    // ========================================================================
    // Text to Speech
    // ========================================================================

    /**
     * Generate speech from text
     */
    async textToSpeech(
        request: GenerateAudioRequest
    ): Promise<GenerationResponse & { audioBlob?: Blob; lipSyncData?: LipSyncData }> {
        if (!this.elevenlabs) {
            return {
                success: false,
                error: 'ElevenLabs provider not available'
            };
        }

        // Check cache first
        const cacheKey = this.getAudioCacheKey(request);
        const cached = this.audioCache.get(cacheKey);
        if (cached && this.config.cacheEnabled !== false) {
            return {
                success: true,
                assetId: cached.assetId,
                status: 'completed',
                estimatedTimeSeconds: 0,
                audioBlob: cached.audioBlob,
                lipSyncData: cached.lipSyncData
            };
        }

        const result = await this.elevenlabs.textToSpeech(request);

        if (!result.success) {
            return result;
        }

        // Generate lip sync data if enabled
        let lipSyncData: LipSyncData | undefined;
        if (this.config.enableLipSync && request.generateLipSync) {
            // Estimate duration from text (rough estimate: ~150 words per minute)
            const wordCount = request.text.split(/\s+/).length;
            const durationSeconds = (wordCount / 150) * 60;

            if (this.audio2face) {
                try {
                    lipSyncData = await this.audio2face.generateLipSync(request.text, durationSeconds);
                } catch (e) {
                    console.warn('Failed to generate lip sync:', e);
                }
            }
        }

        // Cache the result
        if (result.audioId && this.config.cacheEnabled !== false) {
            // Note: In real implementation, we'd cache the actual audio blob
            this.audioCache.set(cacheKey, {
                assetId: result.audioId,
                audioBlob: undefined, // Would be set after download
                lipSyncData,
                createdAt: Date.now(),
                expiresAt: Date.now() + 86400000 // 24 hours
            });
        }

        return {
            ...result,
            lipSyncData
        };
    }

    /**
     * Stream text to speech for real-time applications
     */
    async streamTextToSpeech(
        request: GenerateAudioRequest,
        onChunk: (chunk: ArrayBuffer) => void
    ): Promise<void> {
        if (!this.elevenlabs) {
            throw new Error('ElevenLabs provider not available');
        }

        await this.elevenlabs.streamTextToSpeech(request, onChunk);
    }

    // ========================================================================
    // Voice Management
    // ========================================================================

    /**
     * Get all available voices
     */
    async getVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
        if (!this.elevenlabs) {
            return [];
        }

        return this.elevenlabs.getVoices();
    }

    /**
     * Get a specific voice
     */
    async getVoice(voiceId: string): Promise<any> {
        if (!this.elevenlabs) {
            return null;
        }

        // Check cache first
        if (this.voiceCache.has(voiceId)) {
            return this.voiceCache.get(voiceId);
        }

        const voice = await this.elevenlabs.getVoice(voiceId);
        if (voice) {
            this.voiceCache.set(voiceId, voice);
        }

        return voice;
    }

    /**
     * Get the default voice ID
     */
    async getDefaultVoiceId(): Promise<string> {
        if (this.config.defaultVoiceId) {
            return this.config.defaultVoiceId;
        }

        if (!this.elevenlabs) {
            return '';
        }

        return this.elevenlabs.getDefaultVoiceId();
    }

    /**
     * Create a custom voice
     */
    async createVoice(request: CreateVoiceRequest): Promise<GenerationResponse> {
        if (!this.elevenlabs) {
            return {
                success: false,
                error: 'ElevenLabs provider not available'
            };
        }

        return this.elevenlabs.createVoice(request);
    }

    /**
     * Delete a custom voice
     */
    async deleteVoice(voiceId: string): Promise<boolean> {
        if (!this.elevenlabs) {
            return false;
        }

        return this.elevenlabs.deleteVoice(voiceId);
    }

    // ========================================================================
    // Sound Effects
    // ========================================================================

    /**
     * Generate sound effects
     */
    async generateSoundEffect(
        request: GenerateSoundEffectRequest
    ): Promise<GenerationResponse> {
        if (!this.elevenlabs) {
            return {
                success: false,
                error: 'ElevenLabs provider not available'
            };
        }

        return this.elevenlabs.generateSoundEffect(request.prompt, request.durationSeconds);
    }

    // ========================================================================
    // Facial Animation
    // ========================================================================

    /**
     * Generate facial animation from audio
     */
    async generateFacialAnimation(
        audioData: string | Blob,
        character?: string
    ): Promise<LipSyncData | null> {
        if (!this.audio2face) {
            return null;
        }

        try {
            let audioString = audioData as string;

            // Convert Blob to base64 if needed
            if (audioData instanceof Blob) {
                const arrayBuffer = await audioData.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                audioString = `data:audio/mp3;base64,${btoa(String.fromCharCode(...bytes))}`;
            }

            const response = await this.audio2face.generateAnimation({
                audio: audioString,
                character,
                enableGaze: false,
                enableBlinks: true
            });

            // Convert response to LipSyncData format
            // This is a simplified conversion
            return {
                visemes: [],
                durationSeconds: 0,
                framerate: 60
            };
        } catch (e) {
            console.error('Failed to generate facial animation:', e);
            return null;
        }
    }

    /**
     * Generate lip sync data from text
     */
    async generateLipSyncFromText(
        text: string,
        audioDurationSeconds: number
    ): Promise<LipSyncData> {
        if (this.audio2face) {
            return this.audio2face.generateLipSync(text, audioDurationSeconds);
        }

        // Fallback: return empty lip sync data
        return {
            visemes: [],
            durationSeconds: audioDurationSeconds,
            framerate: 60
        };
    }

    // ========================================================================
    // Batch Operations
    // ========================================================================

    /**
     * Generate multiple audio files
     */
    async batchGenerateTTS(
        requests: GenerateAudioRequest[]
    ): Promise<GenerationResponse[]> {
        if (!this.elevenlabs) {
            return requests.map(() => ({
                success: false,
                error: 'ElevenLabs provider not available'
            }));
        }

        const results = await Promise.allSettled(
            requests.map(req => this.textToSpeech(req))
        );

        return results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                success: false,
                error: result.reason?.message || 'Generation failed'
            };
        });
    }

    /**
     * Generate dialogue with multiple characters
     */
    async generateDialogue(
        dialogue: Array<{ speaker: string; voiceId?: string; text: string }>,
        onProgress?: (completed: number, total: number) => void
    ): Promise<Array<{ speaker: string; audioId?: string; success: boolean }>> {
        const results: Array<{ speaker: string; audioId?: string; success: boolean }> = [];

        for (let i = 0; i < dialogue.length; i++) {
            const line = dialogue[i];
            const result = await this.textToSpeech({
                text: line.text,
                voiceId: line.voiceId,
                generateLipSync: true
            });

            results.push({
                speaker: line.speaker,
                audioId: result.assetId,
                success: result.success
            });

            if (onProgress) {
                onProgress(i + 1, dialogue.length);
            }
        }

        return results;
    }

    // ========================================================================
    // Audio Processing
    // ========================================================================

    /**
     * Convert audio to different format
     */
    async convertFormat(
        audioBlob: Blob,
        targetFormat: AudioFormat
    ): Promise<Blob> {
        // In a real implementation, this would use audio processing libraries
        // For now, return the original blob
        return audioBlob;
    }

    /**
     * Combine multiple audio files
     */
    async combineAudio(audioBlobs: Blob[]): Promise<Blob> {
        // In a real implementation, this would concatenate the audio
        // For now, return the first blob
        return audioBlobs[0];
    }

    /**
     * Apply effects to audio
     */
    async applyEffects(
        audioBlob: Blob,
        effects: AudioEffect[]
    ): Promise<Blob> {
        // In a real implementation, this would apply audio effects
        return audioBlob;
    }

    // ========================================================================
    // Metadata and Info
    // ========================================================================

    /**
     * Extract metadata from audio
     */
    async extractMetadata(
        audioBlob: Blob,
        transcript?: string
    ): Promise<AudioMetadata> {
        if (this.elevenlabs) {
            return this.elevenlabs.extractMetadata(audioBlob, undefined, transcript);
        }

        // Fallback implementation
        return {
            format: this.getFormatFromBlob(audioBlob),
            durationSeconds: 0,
            sampleRate: 44100,
            bitrate: 128000,
            channels: 1,
            voiceId: undefined,
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
        if (type.includes('wav') || type.includes('wave')) return 'wav';
        if (type.includes('ogg')) return 'ogg';
        if (type.includes('aac')) return 'aac';
        if (type.includes('flac')) return 'flac';
        return 'mp3';
    }

    /**
     * Get quota usage
     */
    async getQuotaUsage(): Promise<{
        characterCount: number;
        characterLimit: number;
    }> {
        if (!this.elevenlabs) {
            return {
                characterCount: 0,
                characterLimit: 0
            };
        }

        const quota = await this.elevenlabs.getQuotaUsage();
        return {
            characterCount: quota.characterCount,
            characterLimit: quota.characterLimit
        };
    }

    /**
     * Estimate cost for generation
     */
    estimateCost(request: GenerateAudioRequest): number {
        if (!this.elevenlabs) {
            return 0;
        }

        return this.elevenlabs.estimateCost(request);
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private getAudioCacheKey(request: GenerateAudioRequest): string {
        const parts = [
            request.text.slice(0, 100), // First 100 chars
            request.voiceId || 'default',
            request.model || 'default',
            request.outputFormat || 'mp3'
        ];
        return parts.join('|');
    }

    /**
     * Clear expired cache entries
     */
    clearExpiredCache(): void {
        const now = Date.now();

        for (const [key, value] of this.audioCache.entries()) {
            if (value.expiresAt < now) {
                this.audioCache.delete(key);
            }
        }

        for (const [key, value] of this.voiceCache.entries()) {
            if (value.expiresAt && value.expiresAt < now) {
                this.voiceCache.delete(key);
            }
        }
    }

    /**
     * Get provider status
     */
    getProviderStatus(): {
        elevenlabs: boolean;
        audio2face: boolean;
    } {
        return {
            elevenlabs: this.elevenlabs !== null,
            audio2face: this.audio2face !== null
        };
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface CachedVoice {
    voice_id: string;
    name: string;
    category: string;
    expiresAt?: number;
}

interface CachedAudio {
    assetId: string;
    audioBlob?: Blob;
    lipSyncData?: LipSyncData;
    createdAt: number;
    expiresAt: number;
}

export type AudioEffect =
    | 'reverb'
    | 'echo'
    | 'normalize'
    | 'compress'
    | 'pitch_shift'
    | 'time_stretch'
    | 'fade_in'
    | 'fade_out';

// ============================================================================
// Factory Function
// ============================================================================

export function createAudioManager(config: AudioManagerConfig): AudioManager {
    return new AudioManager(config);
}
