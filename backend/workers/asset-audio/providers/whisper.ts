/**
 * Whisper Provider Implementation
 *
 * Integration with OpenAI Whisper API for speech-to-text transcription.
 * Supports both OpenAI-hosted API and local Whisper deployments.
 *
 * Reference: https://platform.openai.com/docs/guides/speech-to-text
 * GitHub: https://github.com/openai/whisper
 *
 * Features:
 * - Multi-language transcription
 * - High accuracy even with accented speech
 * - Word-level timestamps
 * - Translation support
 * - Speaker diarization (via third-party)
 */

import type {
    STTRequest,
    STTResponse,
    WhisperConfig,
    WhisperResponse,
    TranscriptSegment,
    WordTiming,
    AudioFormat,
    Locale
} from '../types.js';

// ============================================================================
// Constants
// ============================================================================

const OPENAI_WHISPER_API = 'https://api.openai.com/v1/audio';
const LOCAL_WHISPER_DEFAULT_ENDPOINT = 'http://localhost:9000';

// Whisper model sizes
const WHISPER_MODELS = {
    TINY: 'tiny',
    BASE: 'base',
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    LARGE_V2: 'large-v2',
    LARGE_V3: 'large-v3'
} as const;

// Supported audio formats for Whisper
const WHISPER_SUPPORTED_FORMATS: AudioFormat[] = ['mp3', 'wav', 'ogg', 'flac', 'webm', 'pcm'];

// Language codes (ISO 639-1) supported by Whisper
const WHISPER_LANGUAGES: Locale[] = [
    'en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'pl-PL', 'tr-TR',
    'ru-RU', 'nl-NL', 'cs-CZ', 'ar-SA', 'zh-CN', 'ja-JP', 'ko-KR', 'hu-HU',
    'hi-IN', 'fi-FI', 'sv-SE', 'uk-UA', 'el-GR', 'ro-RO', 'da-DK', 'bg-BG',
    'lt-LT', 'lv-LV', 'sk-SK', 'sl-SI', 'hr-HR', 'et-EE', 'id-ID', 'ms-MY',
    'vi-VN', 'th-TH', 'nb-NO', 'tr-TR', 'he-IL', 'ur-PK', 'ka-GE', 'az-AZ',
    'hy-AM', 'bn-IN', 'ca-ES', 'kk-KZ', 'sr-RS', 'fa-IR', 'tl-PH'
];

// ============================================================================
// Types
// ============================================================================

interface WhisperTranscriptionRequest {
    file: File | Blob;
    model: string;
    language?: string;
    prompt?: string;
    response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    temperature?: number;
    timestamp_granularities?: ('word' | 'segment')[];
}

interface WhisperSegment {
    id: number;
    text: string;
    start: number;
    end: number;
    language?: string;
}

interface WhisperWord {
    word: string;
    start: number;
    end: number;
}

interface WhisperVerboseResponse {
    task: string;
    language: string;
    duration: number;
    text: string;
    words?: WhisperWord[];
    segments?: WhisperSegment[];
}

interface LocalWhisperRequest {
    audio_base64: string;
    model?: string;
    language?: string;
    task?: 'transcribe' | 'translate';
    output?: 'json' | 'text' | 'srt' | 'vtt';
    word_timestamps?: boolean;
}

// ============================================================================
// Whisper Client Class
// ============================================================================

/**
 * Whisper Speech-to-Text Client
 *
 * Provides speech-to-text transcription using OpenAI's Whisper model.
 * Can use OpenAI's API or a local Whisper deployment.
 */
export class WhisperClient {
    private readonly apiKey?: string;
    private readonly baseUrl: string;
    private readonly useLocal: boolean;
    private readonly localEndpoint: string;
    private readonly modelSize: string;

    constructor(config: WhisperConfig) {
        this.apiKey = config.apiKey;
        this.useLocal = config.useLocal || false;
        this.localEndpoint = config.localEndpoint || LOCAL_WHISPER_DEFAULT_ENDPOINT;
        this.baseUrl = this.useLocal ? this.localEndpoint : OPENAI_WHISPER_API;
        this.modelSize = config.modelSize || 'base';
    }

    // ========================================================================
    // Transcription
    // ========================================================================

    /**
     * Transcribe audio to text
     *
     * @param request - STT request parameters
     * @returns Promise resolving to STT response
     */
    async transcribe(request: STTRequest): Promise<STTResponse> {
        const startTime = Date.now();

        try {
            // Validate audio format
            const format = request.format || 'wav';
            if (!WHISPER_SUPPORTED_FORMATS.includes(format)) {
                throw new Error(`Unsupported audio format: ${format}`);
            }

            if (this.useLocal) {
                return await this.transcribeLocal(request, startTime);
            } else {
                return await this.transcribeOpenAI(request, startTime);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Transcription failed'
            };
        }
    }

    /**
     * Transcribe using OpenAI API
     */
    private async transcribeOpenAI(request: STTRequest, startTime: number): Promise<STTResponse> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required for Whisper API');
        }

        // Prepare audio file
        let audioBlob: Blob;
        if (typeof request.audio === 'string') {
            // Assume base64 encoded
            const audioBuffer = this.base64ToArrayBuffer(request.audio);
            audioBlob = new Blob([audioBuffer], { type: this.mimeTypeForFormat(request.format) });
        } else {
            audioBlob = new Blob([request.audio], { type: this.mimeTypeForFormat(request.format) });
        }

        // Build form data
        const formData = new FormData();
        formData.append('file', audioBlob, `audio.${request.format || 'wav'}`);
        formData.append('model', 'whisper-1');

        // Add language if specified
        if (request.language) {
            const langCode = request.language.substring(0, 2);
            formData.append('language', langCode);
        }

        // Add prompt (optional, for context)
        if (request.vocabulary && request.vocabulary.length > 0) {
            formData.append('prompt', request.vocabulary.join(', '));
        }

        // Request word timestamps if needed
        const granularities: ('word' | 'segment')[] = ['segment'];
        if (request.enableWordTimings) {
            granularities.push('word');
        }

        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities', granularities.join(','));

        // Make request
        const response = await fetch(`${OPENAI_WHISPER_API}/transcriptions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(error.error?.message || error.error || `Whisper API error: ${response.status}`);
        }

        const data = await response.json() as WhisperVerboseResponse;

        // Format response
        return this.formatWhisperResponse(data, startTime);
    }

    /**
     * Transcribe using local Whisper server
     */
    private async transcribeLocal(request: STTRequest, startTime: number): Promise<STTResponse> {
        // Prepare audio data
        let audioBase64: string;
        if (typeof request.audio === 'string') {
            audioBase64 = request.audio;
        } else {
            audioBase64 = this.arrayBufferToBase64(request.audio);
        }

        const body: LocalWhisperRequest = {
            audio_base64: audioBase64,
            model: this.modelSize,
            task: 'transcribe',
            output: 'json',
            word_timestamps: request.enableWordTimings || false
        };

        // Add language if specified
        if (request.language) {
            body.language = request.language.substring(0, 2);
        }

        const response = await fetch(`${this.localEndpoint}/asr`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Local Whisper error: ${response.status}`);
        }

        const data = await response.json();

        // Format the response (local Whisper has different format)
        return this.formatLocalWhisperResponse(data, startTime);
    }

    /**
     * Translate audio to English (Whisper supports translation)
     *
     * @param audio - Audio data (base64 or ArrayBuffer)
     * @param format - Audio format
     * @returns Promise resolving to translated transcript
     */
    async translate(audio: string | ArrayBuffer, format: AudioFormat = 'wav'): Promise<STTResponse> {
        const startTime = Date.now();

        try {
            if (!this.apiKey) {
                throw new Error('OpenAI API key is required for translation');
            }

            // Prepare audio file
            let audioBlob: Blob;
            if (typeof audio === 'string') {
                const audioBuffer = this.base64ToArrayBuffer(audio);
                audioBlob = new Blob([audioBuffer], { type: this.mimeTypeForFormat(format) });
            } else {
                audioBlob = new Blob([audio], { type: this.mimeTypeForFormat(format) });
            }

            // Build form data
            const formData = new FormData();
            formData.append('file', audioBlob, `audio.${format}`);
            formData.append('model', 'whisper-1');
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities', 'segment');

            // Make request to translate endpoint
            const response = await fetch(`${OPENAI_WHISPER_API}/translations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Translation error: ${response.status}`);
            }

            const data = await response.json() as WhisperVerboseResponse;

            return {
                success: true,
                transcript: data.text,
                language: 'en-US', // Translated to English
                segments: this.formatSegments(data.segments || []),
                confidence: 0.95, // Whisper typically has high confidence
                provider: 'whisper',
                processingTimeMs: Date.now() - startTime,
                costUsd: this.calculateCost(data.duration)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Translation failed'
            };
        }
    }

    // ========================================================================
    // Batch Transcription
    // ========================================================================

    /**
     * Transcribe multiple audio files in batch
     *
     * @param requests - Array of STT requests
     * @returns Promise resolving to array of responses
     */
    async transcribeBatch(requests: STTRequest[]): Promise<STTResponse[]> {
        const results = await Promise.allSettled(
            requests.map(req => this.transcribe(req))
        );

        return results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                success: false,
                error: result.reason?.message || 'Batch transcription failed'
            };
        });
    }

    // ========================================================================
    // Health & Status
    // ========================================================================

    /**
     * Check API health
     *
     * @returns True if API/service is accessible
     */
    async healthCheck(): Promise<boolean> {
        try {
            if (this.useLocal) {
                const response = await fetch(`${this.localEndpoint}/health`, {
                    method: 'GET'
                });
                return response.ok;
            } else {
                // Simple check by making a minimal request
                const response = await fetch(`${OPENAI_WHISPER_API}/models`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                });
                return response.ok;
            }
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
        return [...WHISPER_LANGUAGES];
    }

    /**
     * Get model information
     *
     * @returns Model details
     */
    getModelInfo(): {
        model: string;
        useLocal: boolean;
        endpoint: string;
        languages: Locale[];
        maxAudioLength: number;
    } {
        return {
            model: this.useLocal ? this.modelSize : 'whisper-1',
            useLocal: this.useLocal,
            endpoint: this.baseUrl,
            languages: WHISPER_LANGUAGES,
            maxAudioLength: 600 // 10 minutes max
        };
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Format Whisper API response to standard format
     */
    private formatWhisperResponse(data: WhisperVerboseResponse, startTime: number): STTResponse {
        const segments = this.formatSegments(data.segments || []);
        const words = this.formatWords(data.words || []);

        return {
            success: true,
            transcript: data.text,
            language: this.localeFromCode(data.language),
            segments,
            words,
            confidence: 0.95, // Whisper doesn't provide confidence, assume high
            provider: 'whisper',
            processingTimeMs: Date.now() - startTime,
            costUsd: this.calculateCost(data.duration)
        };
    }

    /**
     * Format local Whisper response to standard format
     */
    private formatLocalWhisperResponse(data: any, startTime: number): STTResponse {
        // Local Whisper servers (like whisper.cpp) have different response formats
        // This is a generic handler for common formats

        const transcript = data.text || data.transcript || '';

        // Handle segments if available
        const segments: TranscriptSegment[] = [];
        if (data.segments && Array.isArray(data.segments)) {
            for (const seg of data.segments) {
                segments.push({
                    text: seg.text || '',
                    startTime: seg.start || 0,
                    endTime: seg.end || 0,
                    confidence: seg.confidence || 0.9
                });
            }
        }

        // Handle word timings if available
        const words: WordTiming[] = [];
        if (data.words && Array.isArray(data.words)) {
            for (const word of data.words) {
                words.push({
                    word: word.word || '',
                    startTime: word.start || 0,
                    endTime: word.end || 0,
                    confidence: word.confidence || 0.9
                });
            }
        }

        return {
            success: true,
            transcript,
            language: data.language ? this.localeFromCode(data.language) : 'en-US',
            segments: segments.length > 0 ? segments : undefined,
            words: words.length > 0 ? words : undefined,
            confidence: 0.9,
            provider: 'whisper',
            processingTimeMs: Date.now() - startTime,
            costUsd: 0 // Local is free
        };
    }

    /**
     * Format segments from Whisper response
     */
    private formatSegments(segments: WhisperSegment[]): TranscriptSegment[] {
        return segments.map(seg => ({
            text: seg.text,
            startTime: seg.start,
            endTime: seg.end,
            confidence: 0.95
        }));
    }

    /**
     * Format words from Whisper response
     */
    private formatWords(words: WhisperWord[]): WordTiming[] {
        return words.map(word => ({
            word: word.word,
            startTime: word.start,
            endTime: word.end,
            confidence: 0.95
        }));
    }

    /**
     * Convert language code to locale
     */
    private localeFromCode(code: string): Locale {
        const langMap: Record<string, Locale> = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'pt': 'pt-BR',
            'pl': 'pl-PL',
            'tr': 'tr-TR',
            'ru': 'ru-RU',
            'nl': 'nl-NL',
            'cs': 'cs-CZ',
            'ar': 'ar-SA',
            'zh': 'zh-CN',
            'ja': 'ja-JP',
            'ko': 'ko-KR',
            'hu': 'hu-HU',
            'hi': 'hi-IN',
            'fi': 'fi-FI',
            'sv': 'sv-SE',
            'uk': 'uk-UA',
            'el': 'el-GR',
            'ro': 'ro-RO',
            'da': 'da-DK',
            'bg': 'bg-BG'
        };

        return langMap[code.toLowerCase()] || 'en-US';
    }

    /**
     * Get MIME type for audio format
     */
    private mimeTypeForFormat(format?: AudioFormat): string {
        const mimeTypes: Record<AudioFormat, string> = {
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            flac: 'audio/flac',
            webm: 'audio/webm',
            pcm: 'audio/pcm',
            opus: 'audio/opus'
        };

        return mimeTypes[format || 'wav'] || 'audio/wav';
    }

    /**
     * Calculate transcription cost
     */
    private calculateCost(durationSeconds: number): number {
        // OpenAI Whisper pricing: $0.006 per minute
        const costPerMinute = 0.006;
        return (durationSeconds / 60) * costPerMinute;
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
 * Create a Whisper client
 *
 * @param config - Whisper configuration
 * @returns Configured WhisperClient
 */
export function createWhisperClient(config: WhisperConfig): WhisperClient {
    return new WhisperClient(config);
}

/**
 * Create Whisper client from environment
 *
 * @param env - Environment object with API keys
 * @returns Configured WhisperClient
 */
export function createWhisperClientFromEnv(env: {
    OPENAI_API_KEY?: string;
    WHISPER_ENDPOINT?: string;
}): WhisperClient {
    const useLocal = !env.OPENAI_API_KEY && env.WHISPER_ENDPOINT;

    return createWhisperClient({
        apiKey: env.OPENAI_API_KEY,
        localEndpoint: env.WHISPER_ENDPOINT,
        useLocal,
        modelSize: useLocal ? 'base' : undefined
    });
}

// ============================================================================
// Re-exports
// ============================================================================

export { WHISPER_MODELS, WHISPER_LANGUAGES, WHISPER_SUPPORTED_FORMATS };
