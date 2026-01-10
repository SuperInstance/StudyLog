/**
 * Riva Speech Services Client
 *
 * Client for NVIDIA Riva speech AI services.
 *
 * Reference: https://developer.nvidia.com/riva
 *
 * Riva provides:
 * - Automatic Speech Recognition (ASR) - Streaming and batch transcription
 * - Text-to-Speech (TTS) - Neural voice synthesis
 * - Neural Machine Translation (NMT) - 26+ language support
 *
 * Note: This implementation uses REST endpoints. For production
 * deployments with low-latency requirements, consider using gRPC.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Supported audio formats for transcription
 */
export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'flac' | 'raw' | 'webm';

/**
 * Supported Riva voice models
 */
export type RivaVoice =
  | 'english-us-female-1'
  | 'english-us-female-2'
  | 'english-us-male-1'
  | 'english-uk-female-1'
  | 'spanish-female-1'
  | 'german-female-1'
  | 'french-female-1'
  | 'italian-female-1';

/**
 * Language codes for Riva services
 */
export type RivaLanguage =
  | 'en-US'
  | 'en-GB'
  | 'es-ES'
  | 'de-DE'
  | 'fr-FR'
  | 'it-IT'
  | 'pt-BR'
  | 'zh-CN'
  | 'ja-JP'
  | 'ko-KR'
  | 'ru-RU'
  | 'ar-SA'
  | 'hi-IN';

/**
 * Transcript result from ASR
 */
export interface Transcript {
  /** Recognized text */
  text: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Word-level timings (if available) */
  words?: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}

/**
 * ASR request configuration
 */
export interface ASRRequest {
  /** Audio data (base64 encoded or URL) */
  audio: string | ArrayBuffer;
  /** Audio format */
  format: AudioFormat;
  /** Language code */
  language: RivaLanguage;
  /** Enable automatic punctuation */
  enableAutomaticPunctuation?: boolean;
  /** Enable inverse text normalization (123 -> one hundred twenty three) */
  enableInverseTextNormalization?: boolean;
  /** Sample rate (for raw audio) */
  sampleRateHertz?: number;
}

/**
 * ASR response
 */
export interface ASRResponse {
  /** Full transcript */
  transcript: string;
  /** Individual transcript segments */
  segments: Transcript[];
  /** Overall confidence */
  confidence: number;
  /** Language detected */
  language: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Streaming transcript chunk
 */
export interface StreamingTranscript {
  /** Partial transcript */
  text: string;
  /** Is this a final result? */
  isFinal: boolean;
  /** Timestamp */
  timestamp: number;
}

/**
 * TTS request configuration
 */
export interface TTSRequest {
  /** Text to synthesize */
  text: string;
  /** Voice to use */
  voice?: RivaVoice;
  /** Language code */
  language?: RivaLanguage;
  /** Speech rate (0.5 = half speed, 2.0 = double speed) */
  rate?: number;
  /** Pitch adjustment (-20.0 to 20.0) */
  pitch?: number;
  /** Output audio format */
  outputFormat?: 'wav' | 'mp3' | 'ogg';
}

/**
 * TTS response
 */
export interface TTSResponse {
  /** Generated audio data */
  audio: ArrayBuffer;
  /** Audio format */
  format: string;
  /** Duration in seconds */
  duration: number;
  /** Number of characters synthesized */
  characters: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Translation request
 */
export interface TranslationRequest {
  /** Source text */
  text: string;
  /** Source language */
  sourceLang: RivaLanguage;
  /** Target language */
  targetLang: RivaLanguage;
}

/**
 * Translation response
 */
export interface TranslationResponse {
  /** Translated text */
  translatedText: string;
  /** Source language detected */
  sourceLanguage: string;
  /** Target language */
  targetLanguage: string;
  /** Confidence score */
  confidence: number;
}

/**
 * Riva client configuration
 */
export interface RivaClientConfig {
  /** Base URL for Riva API */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Default language for speech operations */
  defaultLanguage?: RivaLanguage;
  /** Default voice for TTS */
  defaultVoice?: RivaVoice;
  /** Request timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Language display names
 */
const LANGUAGE_NAMES: Record<RivaLanguage, string> = {
  'en-US': 'English (US)',
  'en-GB': 'English (UK)',
  'es-ES': 'Spanish',
  'de-DE': 'German',
  'fr-FR': 'French',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese (Brazil)',
  'zh-CN': 'Chinese (Mandarin)',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'ru-RU': 'Russian',
  'ar-SA': 'Arabic',
  'hi-IN': 'Hindi',
};

/**
 * Voice gender mapping
 */
const VOICE_GENDER: Record<RivaVoice, 'male' | 'female'> = {
  'english-us-female-1': 'female',
  'english-us-female-2': 'female',
  'english-us-male-1': 'male',
  'english-uk-female-1': 'female',
  'spanish-female-1': 'female',
  'german-female-1': 'female',
  'french-female-1': 'female',
  'italian-female-1': 'female',
};

/**
 * Default voice for each language
 */
const DEFAULT_VOICES: Partial<Record<RivaLanguage, RivaVoice>> = {
  'en-US': 'english-us-female-1',
  'en-GB': 'english-uk-female-1',
  'es-ES': 'spanish-female-1',
  'de-DE': 'german-female-1',
  'fr-FR': 'french-female-1',
  'it-IT': 'italian-female-1',
};

// ============================================================================
// Riva Client Implementation
// ============================================================================

/**
 * Riva Speech Services Client
 *
 * Provides access to ASR, TTS, and translation capabilities.
 *
 * @example
 * ```typescript
 * const client = new RivaClient({
 *   baseUrl: 'https://riva.api.nvidia.com/v1',
 *   apiKey: process.env.RIVA_API_KEY
 * });
 *
 * // Transcribe audio
 * const transcript = await client.transcribe(audioData, 'wav', 'en-US');
 *
 * // Synthesize speech
 * const audio = await client.synthesize('Hello world', 'english-us-female-1');
 *
 * // Translate text
 * const translation = await client.translate('Hola mundo', 'es-ES', 'en-US');
 * ```
 */
export class RivaClient {
  private readonly config: Required<Pick<RivaClientConfig, 'baseUrl' | 'apiKey'>> &
    Omit<RivaClientConfig, 'baseUrl' | 'apiKey'>;

  constructor(config: RivaClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      defaultLanguage: config.defaultLanguage || 'en-US',
      defaultVoice: config.defaultVoice || 'english-us-female-1',
      timeout: config.timeout || 30000,
    };
  }

  /**
   * Transcribe audio to text (batch ASR)
   *
   * @param audioStream - Audio data as ReadableStream or ArrayBuffer
   * @param format - Audio format
   * @param language - Language code
   * @returns Promise resolving to ASRResponse with transcript
   */
  async transcribe(
    audioStream: ReadableStream | ArrayBuffer,
    format: AudioFormat,
    language: RivaLanguage = this.config.defaultLanguage
  ): Promise<ASRResponse> {
    const startTime = Date.now();

    try {
      let audioData: ArrayBuffer;

      if (audioStream instanceof ReadableStream) {
        const reader = audioStream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        audioData = new ArrayBuffer(totalLength);
        const view = new Uint8Array(audioData);
        let offset = 0;
        for (const chunk of chunks) {
          view.set(chunk, offset);
          offset += chunk.length;
        }
      } else {
        audioData = audioStream;
      }

      // Convert to base64
      const base64Audio = this.arrayBufferToBase64(audioData);

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/asr/transcribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            audio: base64Audio,
            format,
            language,
            enableAutomaticPunctuation: true,
            enableInverseTextNormalization: true,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Riva ASR error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      return {
        transcript: data.transcript || '',
        segments: data.segments || [],
        confidence: data.confidence || 0,
        language: data.language || language,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Riva ASR request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Transcribe audio stream with streaming results
   *
   * @param audioStream - Audio stream
   * @param format - Audio format
   * @param language - Language code
   * @returns Async iterable of streaming transcript results
   */
  async *transcribeStream(
    audioStream: ReadableStream,
    format: AudioFormat,
    language: RivaLanguage = this.config.defaultLanguage
  ): AsyncIterable<StreamingTranscript> {
    // For streaming, we'd typically use WebSocket or gRPC
    // This is a simplified implementation using polling
    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);

          // Process partial results
          // In a real implementation, this would send chunks to the server
          // and receive streaming responses
          yield {
            text: '[Processing partial audio...]',
            isFinal: false,
            timestamp: Date.now(),
          };
        }
      }

      // Final transcription
      const result = await this.transcribe(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        }),
        format,
        language
      );

      yield {
        text: result.transcript,
        isFinal: true,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new Error(`Streaming transcription failed: ${error}`);
    }
  }

  /**
   * Synthesize text to speech
   *
   * @param text - Text to synthesize
   * @param voice - Voice model to use
   * @returns Promise resolving to TTSResponse with audio data
   */
  async synthesize(
    text: string,
    voice: string = this.config.defaultVoice
  ): Promise<ArrayBuffer> {
    const startTime = Date.now();

    try {
      const language = this.voiceToLanguage(voice);

      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/tts/synthesize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            text,
            voice,
            language,
            rate: 1.0,
            pitch: 0.0,
            outputFormat: 'wav',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Riva TTS error: ${response.status} - ${errorText}`);
      }

      // Get audio data directly
      const audioBuffer = await response.arrayBuffer();

      return audioBuffer;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Riva TTS request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Translate text between languages
   *
   * @param text - Source text
   * @param sourceLang - Source language code
   * @param targetLang - Target language code
   * @returns Promise resolving to TranslationResponse
   */
  async translate(
    text: string,
    sourceLang: RivaLanguage,
    targetLang: RivaLanguage
  ): Promise<string> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/nmt/translate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({
            text,
            source_lang: sourceLang,
            target_lang: targetLang,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Riva NMT error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as TranslationResponse;
      return data.translatedText;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Riva translation request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): Array<{ code: RivaLanguage; name: string }> {
    return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
      code: code as RivaLanguage,
      name,
    }));
  }

  /**
   * Get available voices for a language
   */
  getAvailableVoices(language?: RivaLanguage): Array<{ id: RivaVoice; gender: 'male' | 'female' }> {
    const voices = Object.entries(VOICE_GENDER) as Array<[RivaVoice, 'male' | 'female']>;

    if (language) {
      const defaultVoice = DEFAULT_VOICES[language];
      const filtered = voices.filter(([voiceId]) => voiceId === defaultVoice);
      return filtered.map(([id, gender]) => ({ id, gender }));
    }

    return voices.map(([id, gender]) => ({ id, gender }));
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Convert ArrayBuffer to base64 string
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
   * Get language code from voice ID
   */
  private voiceToLanguage(voice: string): RivaLanguage {
    if (voice.startsWith('english-us')) return 'en-US';
    if (voice.startsWith('english-uk')) return 'en-GB';
    if (voice.startsWith('spanish')) return 'es-ES';
    if (voice.startsWith('german')) return 'de-DE';
    if (voice.startsWith('french')) return 'fr-FR';
    if (voice.startsWith('italian')) return 'it-IT';
    return this.config.defaultLanguage;
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if the client is configured and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.config.baseUrl}/health`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Riva client from environment configuration
 *
 * @param env - Environment object containing RIVA_API_KEY
 * @param config - Optional additional configuration
 * @returns Configured RivaClient instance
 */
export function createRivaClient(
  env: { RIVA_API_KEY?: string; RIVA_BASE_URL?: string },
  config?: Partial<RivaClientConfig>
): RivaClient {
  const apiKey = env.RIVA_API_KEY || config?.apiKey;
  if (!apiKey) {
    throw new Error('RIVA_API_KEY is required for Riva client');
  }

  return new RivaClient({
    baseUrl: env.RIVA_BASE_URL || config?.baseUrl || 'https://riva.api.nvidia.com/v1',
    apiKey,
    ...config,
  });
}

// ============================================================================
// Re-exports
// ============================================================================

export * from './types';
