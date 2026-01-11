/**
 * Audio & Voice API - Unified Type Definitions
 * For StudyLoG.AI and DMLoG.AI
 *
 * Supports:
 * - ElevenLabs - Turbo v2.5, TTS, Voice Design, SFX
 * - NVIDIA ACE/Audio2Face - Facial animation from audio
 * - Coqui XTTS v2 - Open source TTS
 * - Whisper - Speech-to-text (OpenAI, local)
 * - Piper - Fast local TTS
 * - Riva - NVIDIA Speech AI (ASR, TTS, NMT)
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Supported audio providers
 */
export type AudioProvider =
    | 'elevenlabs'
    | 'ace_audio2face'
    | 'coqui'
    | 'whisper'
    | 'piper'
    | 'riva'
    | 'cached';

/**
 * Product context for audio generation
 */
export type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'general';

/**
 * Audio generation status
 */
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Audio format types
 */
export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac' | 'pcm' | 'webm' | 'opus';

/**
 * Voice gender
 */
export type VoiceGender = 'male' | 'female' | 'non-binary';

/**
 * Voice age category
 */
export type VoiceAge = 'young' | 'middle' | 'old';

/**
 * TTS quality tier
 */
export type QualityTier = 'draft' | 'standard' | 'high' | 'ultra';

/**
 * Language codes (ISO 639-1)
 */
export type LanguageCode =
    | 'en'
    | 'es'
    | 'fr'
    | 'de'
    | 'it'
    | 'pt'
    | 'ja'
    | 'ko'
    | 'zh'
    | 'ar'
    | 'hi'
    | 'ru'
    | 'nl'
    | 'pl'
    | 'sv'
    | 'da'
    | 'no'
    | 'fi';

/**
 * Full locale with region
 */
export type Locale = `${LanguageCode}-${string}`;

/**
 * Use case for audio generation (affects routing)
 */
export type AudioUseCase =
    | 'dialogue'          // Character dialogue
    | 'narration'         // Story narration
    | 'tutorial'          // Educational content
    | 'announcement'      // System announcements
    | 'ambient'           // Background audio
    | 'sound_effect'      // SFX generation
    | 'voice_clone'       // Voice cloning
    | 'lip_sync'          // For facial animation
    | 'realtime';         // Low-latency requirements

// ============================================================================
// TTS Request/Response Types
// ============================================================================

/**
 * Text-to-speech generation request
 */
export interface TTSRequest {
    /** Text to synthesize */
    text: string;
    /** Voice ID or name */
    voice?: string;
    /** Language code */
    language?: Locale;
    /** Audio quality tier */
    quality?: QualityTier;
    /** Output format */
    outputFormat?: AudioFormat;
    /** Speech rate (0.25 to 4.0, default 1.0) */
    speed?: number;
    /** Pitch adjustment (-20 to 20, default 0) */
    pitch?: number;
    /** Use case for routing */
    useCase?: AudioUseCase;
    /** Product context */
    productContext?: ProductContext;
    /** Preferred provider */
    preferredProvider?: AudioProvider;
    /** Enable phoneme timing for lip sync */
    enablePhonemes?: boolean;
    /** Seed for reproducible results */
    seed?: number;
    /** Maximum cost in USD */
    maxCostUsd?: number;
}

/**
 * Text-to-speech response
 */
export interface TTSResponse {
    /** Success status */
    success: boolean;
    /** Audio asset ID */
    audioId?: string;
    /** Audio URL */
    audioUrl?: string;
    /** Audio data (for small responses) */
    audioData?: ArrayBuffer;
    /** Audio format */
    format?: AudioFormat;
    /** Duration in seconds */
    duration?: number;
    /** Number of characters synthesized */
    characters?: number;
    /** Provider used */
    provider?: AudioProvider;
    /** Voice used */
    voice?: string;
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Cost in USD */
    costUsd?: number;
    /** Phoneme timing data (if requested) */
    phonemes?: PhonemeTiming[];
    /** Word-level timing */
    wordTimings?: WordTiming[];
    /** Error message */
    error?: string;
}

/**
 * Phoneme timing for lip sync
 */
export interface PhonemeTiming {
    /** Phoneme symbol (viseme) */
    phoneme: string;
    /** Viseme code (0-20 for standard) */
    viseme: number;
    /** Start time in seconds */
    startTime: number;
    /** End time in seconds */
    endTime: number;
}

/**
 * Word-level timing
 */
export interface WordTiming {
    /** Word text */
    word: string;
    /** Start time in seconds */
    startTime: number;
    /** End time in seconds */
    endTime: number;
    /** Confidence score */
    confidence?: number;
}

// ============================================================================
// STT Request/Response Types
// ============================================================================

/**
 * Speech-to-text transcription request
 */
export interface STTRequest {
    /** Audio data (base64 or URL) */
    audio: string | ArrayBuffer;
    /** Audio format */
    format?: AudioFormat;
    /** Language code */
    language?: Locale;
    /** Enable automatic punctuation */
    enablePunctuation?: boolean;
    /** Enable timestamps */
    enableTimestamps?: boolean;
    /** Enable word-level timings */
    enableWordTimings?: boolean;
    /** Enable speaker diarization */
    enableDiarization?: boolean;
    /** Number of speakers (for diarization) */
    numSpeakers?: number;
    /** Use case for routing */
    useCase?: AudioUseCase;
    /** Product context */
    productContext?: ProductContext;
    /** Preferred provider */
    preferredProvider?: AudioProvider;
    /** Vocabulary list for better accuracy */
    vocabulary?: string[];
}

/**
 * Speech-to-text response
 */
export interface STTResponse {
    /** Success status */
    success: boolean;
    /** Full transcript */
    transcript?: string;
    /** Language detected */
    language?: string;
    /** Individual segments */
    segments?: TranscriptSegment[];
    /** Word timings */
    words?: WordTiming[];
    /** Speakers (if diarization enabled) */
    speakers?: SpeakerSegment[];
    /** Overall confidence */
    confidence?: number;
    /** Provider used */
    provider?: AudioProvider;
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Cost in USD */
    costUsd?: number;
    /** Error message */
    error?: string;
}

/**
 * Transcript segment with timing
 */
export interface TranscriptSegment {
    /** Segment text */
    text: string;
    /** Start time in seconds */
    startTime: number;
    /** End time in seconds */
    endTime: number;
    /** Confidence score */
    confidence: number;
    /** Speaker (if diarization) */
    speaker?: string;
}

/**
 * Speaker segment from diarization
 */
export interface SpeakerSegment {
    /** Speaker identifier */
    speaker: string;
    /** Segments for this speaker */
    segments: Array<{
        text: string;
        startTime: number;
        endTime: number;
    }>;
    /** Total duration */
    duration: number;
}

// ============================================================================
// Voice Cloning Types
// ============================================================================

/**
 * Voice cloning request
 */
export interface VoiceCloneRequest {
    /** Name for the cloned voice */
    voiceName: string;
    /** Sample audio URL or data */
    sampleAudio: string | ArrayBuffer;
    /** Audio format of sample */
    sampleFormat?: AudioFormat;
    /** Description of the voice */
    description?: string;
    /** Language of the voice */
    language?: Locale;
    /** Use case for routing */
    useCase?: AudioUseCase;
    /** Product context */
    productContext?: ProductContext;
    /** Preferred provider */
    preferredProvider?: AudioProvider;
}

/**
 * Voice cloning response
 */
export interface VoiceCloneResponse {
    /** Success status */
    success: boolean;
    /** Voice ID */
    voiceId?: string;
    /** Voice name */
    voiceName?: string;
    /** Provider used */
    provider?: AudioProvider;
    /** Quality assessment */
    quality?: 'low' | 'medium' | 'high';
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Cost in USD */
    costUsd?: number;
    /** Error message */
    error?: string;
}

// ============================================================================
// Audio2Face Types
// ============================================================================

/**
 * Audio to facial animation request
 */
export interface Audio2FaceRequest {
    /** Audio URL or data */
    audio: string | ArrayBuffer;
    /** Audio format */
    format?: AudioFormat;
    /** Character/face mesh ID */
    characterId?: string;
    /** Output format */
    outputFormat?: 'json' | 'blendshapes' | 'bones';
    /** Frame rate for animation */
    frameRate?: number;
    /** Include blendshapes */
    includeBlendshapes?: boolean;
    /** Include bone rotations */
    includeBones?: boolean;
    /** Quality level */
    quality?: 'draft' | 'standard' | 'high';
}

/**
 * Audio to facial animation response
 */
export interface Audio2FaceResponse {
    /** Success status */
    success: boolean;
    /** Animation asset ID */
    animationId?: string;
    /** Animation URL */
    animationUrl?: string;
    /** Animation data (for small responses) */
    animationData?: AnimationData;
    /** Provider used */
    provider?: AudioProvider;
    /** Duration in seconds */
    duration?: number;
    /** Number of frames */
    frameCount?: number;
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Cost in USD */
    costUsd?: number;
    /** Error message */
    error?: string;
}

/**
 * Animation data structure
 */
export interface AnimationData {
    /** Frame rate */
    frameRate: number;
    /** Duration in seconds */
    duration: number;
    /** Number of frames */
    frameCount: number;
    /** Blendshape data per frame */
    blendshapes?: BlendshapeFrame[];
    /** Bone rotation data */
    bones?: BoneFrame[];
    /** Metadata */
    metadata?: {
        sourceAudio?: string;
        characterId?: string;
        generatedAt: number;
    };
}

/**
 * Blendshape frame data
 */
export interface BlendshapeFrame {
    /** Frame number */
    frame: number;
    /** Time in seconds */
    time: number;
    /** Blendshape values (0-1) */
    values: number[];
    /** Named blendshapes */
    named?: Record<string, number>;
}

/**
 * Bone rotation frame data
 */
export interface BoneFrame {
    /** Frame number */
    frame: number;
    /** Time in seconds */
    time: number;
    /** Bone rotations */
    rotations: BoneRotation[];
}

/**
 * Single bone rotation
 */
export interface BoneRotation {
    /** Bone name */
    bone: string;
    /** Quaternion rotation (x, y, z, w) */
    quaternion: [number, number, number, number];
}

// ============================================================================
// Sound Effects Types
// ============================================================================

/**
 * Sound effect generation request
 */
export interface SoundEffectRequest {
    /** Text description of the sound */
    prompt: string;
    /** Duration in seconds */
    duration?: number;
    /** Output format */
    outputFormat?: AudioFormat;
    /** Use case for routing */
    useCase?: AudioUseCase;
    /** Product context */
    productContext?: ProductContext;
    /** Preferred provider */
    preferredProvider?: AudioProvider;
    /** Seed for reproducibility */
    seed?: number;
    /** Temperature for randomness (0-1) */
    temperature?: number;
}

/**
 * Sound effect response
 */
export interface SoundEffectResponse {
    /** Success status */
    success: boolean;
    /** SFX asset ID */
    sfxId?: string;
    /** Audio URL */
    audioUrl?: string;
    /** Audio data */
    audioData?: ArrayBuffer;
    /** Audio format */
    format?: AudioFormat;
    /** Duration in seconds */
    duration?: number;
    /** Provider used */
    provider?: AudioProvider;
    /** Processing time in milliseconds */
    processingTimeMs?: number;
    /** Cost in USD */
    costUsd?: number;
    /** Error message */
    error?: string;
}

// ============================================================================
// Voice List Types
// ============================================================================

/**
 * Voice information
 */
export interface Voice {
    /** Unique voice ID */
    id: string;
    /** Display name */
    name: string;
    /** Provider */
    provider: AudioProvider;
    /** Language */
    language: Locale;
    /** Gender */
    gender?: VoiceGender;
    /** Age category */
    age?: VoiceAge;
    /** Voice style description */
    style?: string;
    /** Is this a cloned voice */
    isCloned?: boolean;
    /** Sample audio URL */
    sampleUrl?: string;
    /** Capabilities */
    capabilities?: VoiceCapabilities;
}

/**
 * Voice capabilities
 */
export interface VoiceCapabilities {
    /** Supports streaming */
    streaming: boolean;
    /** Supports phoneme timing */
    phonemes: boolean;
    /** Supports style control */
    styleControl: boolean;
    /** Supports emotion control */
    emotionControl: boolean;
    /** Supported output formats */
    formats: AudioFormat[];
}

/**
 * Voice list response
 */
export interface VoiceListResponse {
    /** Success status */
    success: boolean;
    /** List of voices */
    voices?: Voice[];
    /** Total count */
    total?: number;
    /** Provider filter used */
    provider?: AudioProvider;
    /** Language filter used */
    language?: Locale;
    /** Pagination */
    page?: number;
    pageSize?: number;
    /** Error message */
    error?: string;
}

// ============================================================================
// Batch Request Types
// ============================================================================

/**
 * Batch TTS request
 */
export interface BatchTTSRequest {
    /** Individual TTS requests */
    requests: Array<{
        text: string;
        voice?: string;
        language?: Locale;
    }>;
    /** Common settings */
    quality?: QualityTier;
    outputFormat?: AudioFormat;
    speed?: number;
    /** Execute in parallel */
    parallel?: boolean;
    /** Use case for routing */
    useCase?: AudioUseCase;
    /** Product context */
    productContext?: ProductContext;
    /** Preferred provider */
    preferredProvider?: AudioProvider;
}

/**
 * Batch TTS response
 */
export interface BatchTTSResponse {
    /** Success status */
    success: boolean;
    /** Individual results */
    results?: Array<TTSResponse & { index: number }>;
    /** Total successful */
    successful?: number;
    /** Total failed */
    failed?: number;
    /** Provider used */
    provider?: AudioProvider;
    /** Total cost in USD */
    totalCostUsd?: number;
    /** Total processing time in milliseconds */
    totalProcessingTimeMs?: number;
    /** Error message */
    error?: string;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Base provider configuration
 */
export interface ProviderConfig {
    /** API key */
    apiKey: string;
    /** API endpoint (optional, uses default) */
    endpoint?: string;
    /** Is provider enabled */
    enabled?: boolean;
    /** Priority for routing (higher = preferred) */
    priority?: number;
    /** Rate limits */
    rateLimit?: RateLimit;
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
    /** Requests per minute */
    requestsPerMinute: number;
    /** Requests per day */
    requestsPerDay: number;
    /** Characters per month (for TTS) */
    charactersPerMonth?: number;
}

/**
 * ElevenLabs configuration
 */
export interface ElevenLabsConfig extends ProviderConfig {
    /** Default model */
    model?: 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' | 'eleven_turbo_v2' | 'eleven_monolingual_v1';
    /** Default voice settings */
    defaultVoiceSettings?: {
        stability: number;
        similarity_boost: number;
        style: number;
        use_speaker_boost: boolean;
    };
}

/**
 * Coqui configuration
 */
export interface CoquiConfig extends ProviderConfig {
    /** XTTS model endpoint */
    modelEndpoint?: string;
    /** Enable voice cloning */
    enableCloning?: boolean;
}

/**
 * Whisper configuration
 */
export interface WhisperConfig extends ProviderConfig {
    /** Model size */
    modelSize?: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
    /** Use local or API */
    useLocal?: boolean;
    /** Local endpoint */
    localEndpoint?: string;
}

/**
 * Piper configuration
 */
export interface PiperConfig extends ProviderConfig {
    /** Model endpoint */
    modelEndpoint?: string;
    /** Voice model directory */
    voiceDir?: string;
}

/**
 * ACE Audio2Face configuration
 */
export interface AceAudio2FaceConfig extends ProviderConfig {
    /** Face mesh to use */
    defaultMesh?: string;
    /** Animation server endpoint */
    animationServer?: string;
}

/**
 * Riva configuration
 */
export interface RivaConfig extends ProviderConfig {
    /** Default language */
    defaultLanguage?: Locale;
    /** Default voice */
    defaultVoice?: string;
}

/**
 * All provider configurations
 */
export interface AllProviderConfigs {
    elevenlabs?: ElevenLabsConfig;
    coqui?: CoquiConfig;
    whisper?: WhisperConfig;
    piper?: PiperConfig;
    ace_audio2face?: AceAudio2FaceConfig;
    riva?: RivaConfig;
}

// ============================================================================
// Provider-Specific Types
// ============================================================================

/**
 * ElevenLabs voice settings
 */
export interface ElevenLabsVoiceSettings {
    /** Voice stability (0-1) */
    stability: number;
    /** Similarity boost (0-1) */
    similarity_boost: number;
    /** Style exaggeration (0-1) */
    style: number;
    /** Use speaker boost */
    use_speaker_boost: boolean;
}

/**
 * ElevenLabs API response
 */
export interface ElevenLabsResponse {
    /** Audio data (base64) */
    audio_base64?: string;
    /** Task ID for async requests */
    task_id?: string;
    /** Task status */
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    /** Error message */
    detail?: string;
}

/**
 * ElevenLabs voice object
 */
export interface ElevenLabsVoice {
    voice_id: string;
    name: string;
    category: string;
    labels: Record<string, string>;
    preview_url: string;
    samples: Array<{
        sample_id: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
    }>;
}

/**
 * Coqui XTTS response
 */
export interface CoquiResponse {
    /** Audio data (base64) */
    audio: string;
    /** Duration in seconds */
    duration: number;
    /** Sample rate */
    sample_rate: number;
}

/**
 * Whisper API response
 */
export interface WhisperResponse {
    /** Transcribed text */
    text: string;
    /** Language detected */
    language: string;
    /** Duration in seconds */
    duration: number;
    /** Word-level segments */
    words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
    }>;
    /** Segments */
    segments?: Array<{
        id: number;
        text: string;
        start: number;
        end: number;
        language?: string;
    }>;
}

/**
 * Piper response
 */
export interface PiperResponse {
    /** Audio data (base64) */
    audio: string;
    /** Sample rate */
    sample_rate: number;
}

/**
 * ACE Audio2Face response
 */
export interface AceAudio2FaceResponse {
    /** Animation data */
    animation: AnimationData;
    /** Status */
    status: string;
    /** Job ID */
    job_id?: string;
}

// ============================================================================
// Cost and Pricing Types
// ============================================================================

/**
 * Cost estimate for audio operation
 */
export interface CostEstimate {
    /** Provider */
    provider: AudioProvider;
    /** Estimated cost in USD */
    estimatedCostUsd: number;
    /** Currency */
    currency: string;
    /** Cost breakdown */
    breakdown: CostBreakdown;
}

/**
 * Cost breakdown
 */
export interface CostBreakdown {
    /** Generation cost */
    generation: number;
    /** Storage cost (if applicable) */
    storage?: number;
    /** Processing cost (for Audio2Face) */
    processing?: number;
}

/**
 * Provider pricing information
 */
export interface ProviderPricing {
    /** Provider */
    provider: AudioProvider;
    /** Pricing model */
    pricingModel: 'per_character' | 'per_second' | 'per_request' | 'subscription';
    /** Base cost per unit */
    baseCostUsd: number;
    /** Cost breakdown by service */
    costs: {
        /** Text-to-speech cost */
        tts: number;
        /** Speech-to-text cost */
        stt: number;
        /** Voice cloning cost */
        voiceClone: number;
        /** Sound effects cost */
        sfx: number;
        /** Audio2Face cost */
        audio2face: number;
    };
    /** Free tier information */
    freeTier?: {
        /** Characters per month */
        charactersPerMonth?: number;
        /** Minutes per month */
        minutesPerMonth?: number;
        /** Clones per month */
        clonesPerMonth?: number;
    };
}

// ============================================================================
// Capabilities Types
// ============================================================================

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
    /** Supports TTS */
    tts: boolean;
    /** Supports STT */
    stt: boolean;
    /** Supports voice cloning */
    voiceCloning: boolean;
    /** Supports sound effects */
    soundEffects: boolean;
    /** Supports Audio2Face */
    audio2face: boolean;
    /** Supports streaming */
    streaming: boolean;
    /** Supports phoneme timing */
    phonemes: boolean;
    /** Supports speaker diarization */
    diarization: boolean;
    /** Average processing time in seconds */
    avgTimeSeconds: number;
    /** Supported languages */
    languages: Locale[];
    /** Maximum audio length for STT (seconds) */
    maxAudioLengthSeconds?: number;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Storage location for audio assets
 */
export interface AudioStorageLocation {
    /** Storage type */
    storageType: 'r2' | 's3' | 'external_url' | 'cdn';
    /** Bucket name */
    bucketName?: string;
    /** File path */
    filePath: string;
    /** CDN URL */
    cdnUrl?: string;
    /** Direct download URL */
    directDownloadUrl?: string;
    /** SHA256 hash */
    hashSha256?: string;
    /** Upload timestamp */
    uploadedAt: Date;
    /** Expiration date */
    expiresAt?: Date;
}

/**
 * Audio asset metadata
 */
export interface AudioAssetMetadata {
    /** Asset ID */
    id: string;
    /** Asset type */
    type: 'tts' | 'stt' | 'voice_clone' | 'sfx' | 'audio2face';
    /** Provider */
    provider: AudioProvider;
    /** Product context */
    productContext: ProductContext;
    /** Original text/prompt */
    originalPrompt: string;
    /** Generation parameters */
    generationParams: Record<string, unknown>;
    /** Status */
    status: GenerationStatus;
    /** Storage location */
    storage: AudioStorageLocation;
    /** Created at */
    createdAt: Date;
    /** Updated at */
    updatedAt: Date;
    /** Cost in cents */
    costCents: number;
    /** Tags */
    tags: string[];
    /** Duration (for audio) */
    duration?: number;
    /** Format */
    format?: AudioFormat;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Standard API response
 */
export interface ApiResponse<T = unknown> {
    /** Success status */
    success: boolean;
    /** Response data */
    data?: T;
    /** Error message */
    error?: string;
    /** Error code */
    errorCode?: string;
    /** Request ID */
    requestId: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * Provider status response
 */
export interface ProviderStatusResponse {
    /** Provider */
    provider: AudioProvider;
    /** Is enabled */
    enabled: boolean;
    /** Is available */
    available: boolean;
    /** Is healthy */
    healthy: boolean;
    /** Quota used */
    quotaUsed: number;
    /** Quota limit */
    quotaLimit: number;
    /** Quota reset time */
    quotaResetsAt: Date;
    /** Average response time in milliseconds */
    avgResponseTimeMs: number;
}

// ============================================================================
// Cloudflare Worker Env
// ============================================================================

/**
 * Cloudflare Worker environment bindings
 */
export interface Env {
    // ElevenLabs
    ELEVENLABS_API_KEY?: string;

    // Coqui
    COQUI_API_KEY?: string;
    COQUI_ENDPOINT?: string;

    // Whisper
    OPENAI_API_KEY?: string; // For Whisper API
    WHISPER_ENDPOINT?: string; // For local Whisper

    // Piper
    PIPER_ENDPOINT?: string;

    // NVIDIA ACE/Riva
    NVIDIA_API_KEY?: string;
    ACE_AUDIO2FACE_ENDPOINT?: string;
    RIVA_API_KEY?: string;
    RIVA_BASE_URL?: string;

    // Storage
    AUDIO_BUCKET?: R2Bucket;
    CACHE?: KVNamespace;
    DB?: D1Database;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Provider pricing constants
 */
export const PROVIDER_PRICING: Record<AudioProvider, ProviderPricing> = {
    elevenlabs: {
        provider: 'elevenlabs',
        pricingModel: 'per_character',
        baseCostUsd: 0.00030,
        costs: {
            tts: 0.00030,
            stt: 0,
            voiceClone: 5.00,
            sfx: 0.01,
            audio2face: 0
        },
        freeTier: {
            charactersPerMonth: 10000
        }
    },
    ace_audio2face: {
        provider: 'ace_audio2face',
        pricingModel: 'per_second',
        baseCostUsd: 0.001,
        costs: {
            tts: 0,
            stt: 0,
            voiceClone: 0,
            sfx: 0,
            audio2face: 0.001
        }
    },
    coqui: {
        provider: 'coqui',
        pricingModel: 'per_second',
        baseCostUsd: 0,
        costs: {
            tts: 0,
            stt: 0,
            voiceClone: 0,
            sfx: 0,
            audio2face: 0
        }
    },
    whisper: {
        provider: 'whisper',
        pricingModel: 'per_second',
        baseCostUsd: 0.00006,
        costs: {
            tts: 0,
            stt: 0.00006,
            voiceClone: 0,
            sfx: 0,
            audio2face: 0
        }
    },
    piper: {
        provider: 'piper',
        pricingModel: 'per_second',
        baseCostUsd: 0,
        costs: {
            tts: 0,
            stt: 0,
            voiceClone: 0,
            sfx: 0,
            audio2face: 0
        }
    },
    riva: {
        provider: 'riva',
        pricingModel: 'per_second',
        baseCostUsd: 0.001,
        costs: {
            tts: 0.001,
            stt: 0.001,
            voiceClone: 0,
            sfx: 0,
            audio2face: 0
        }
    },
    cached: {
        provider: 'cached',
        pricingModel: 'per_request',
        baseCostUsd: 0,
        costs: {
            tts: 0,
            stt: 0,
            voiceClone: 0,
            sfx: 0,
            audio2face: 0
        }
    }
};

/**
 * Provider capabilities constants
 */
export const PROVIDER_CAPABILITIES: Record<AudioProvider, ProviderCapabilities> = {
    elevenlabs: {
        tts: true,
        stt: false,
        voiceCloning: true,
        soundEffects: true,
        audio2face: false,
        streaming: true,
        phonemes: true,
        diarization: false,
        avgTimeSeconds: 0.5,
        languages: ['en-US', 'en-GB', 'es-ES', 'de-DE', 'fr-FR', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'hi-IN'],
        maxAudioLengthSeconds: 0
    },
    ace_audio2face: {
        tts: false,
        stt: false,
        voiceCloning: false,
        soundEffects: false,
        audio2face: true,
        streaming: false,
        phonemes: true,
        diarization: false,
        avgTimeSeconds: 2,
        languages: [],
        maxAudioLengthSeconds: 600
    },
    coqui: {
        tts: true,
        stt: false,
        voiceCloning: true,
        soundEffects: false,
        audio2face: false,
        streaming: false,
        phonemes: false,
        diarization: false,
        avgTimeSeconds: 1,
        languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'],
        maxAudioLengthSeconds: 0
    },
    whisper: {
        tts: false,
        stt: true,
        voiceCloning: false,
        soundEffects: false,
        audio2face: false,
        streaming: false,
        phonemes: false,
        diarization: false,
        avgTimeSeconds: 2,
        languages: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ru-RU', 'ar-SA', 'hi-IN'],
        maxAudioLengthSeconds: 600
    },
    piper: {
        tts: true,
        stt: false,
        voiceCloning: false,
        soundEffects: false,
        audio2face: false,
        streaming: false,
        phonemes: false,
        diarization: false,
        avgTimeSeconds: 0.1,
        languages: ['en-US', 'en-GB', 'es-ES', 'de-DE', 'fr-FR', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN'],
        maxAudioLengthSeconds: 0
    },
    riva: {
        tts: true,
        stt: true,
        voiceCloning: false,
        soundEffects: false,
        audio2face: false,
        streaming: true,
        phonemes: false,
        diarization: true,
        avgTimeSeconds: 1,
        languages: ['en-US', 'en-GB', 'es-ES', 'de-DE', 'fr-FR', 'it-IT', 'pt-BR', 'ja-JP', 'ko-KR', 'zh-CN', 'ru-RU'],
        maxAudioLengthSeconds: 300
    },
    cached: {
        tts: false,
        stt: false,
        voiceCloning: false,
        soundEffects: false,
        audio2face: false,
        streaming: false,
        phonemes: false,
        diarization: false,
        avgTimeSeconds: 0,
        languages: [],
        maxAudioLengthSeconds: 0
    }
};

/**
 * Default voice settings for ElevenLabs
 */
export const DEFAULT_ELEVENLABS_VOICE_SETTINGS: ElevenLabsVoiceSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: false
};

/**
 * Supported audio formats by provider
 */
export const SUPPORTED_FORMATS: Record<AudioProvider, AudioFormat[]> = {
    elevenlabs: ['mp3', 'pcm', 'opus'],
    ace_audio2face: ['wav', 'mp3'],
    coqui: ['wav', 'mp3', 'ogg'],
    whisper: ['mp3', 'wav', 'ogg', 'flac', 'webm'],
    piper: ['wav'],
    riva: ['wav', 'mp3', 'ogg'],
    cached: ['mp3', 'wav', 'ogg', 'flac']
};

/**
 * Viseme mapping for lip sync (standard 20 visemes)
 */
export const VISEME_MAPPING: Record<string, number> = {
    // Vowel-like sounds
    'a': 0, 'aa': 0, 'ae': 0, 'ah': 0, 'ay': 0, 'aw': 0,
    'e': 1, 'eh': 1, 'er': 1, 'ey': 1,
    'i': 2, 'ih': 2, 'iy': 2, 'y': 2,
    'o': 3, 'ao': 3, 'ow': 3,
    'u': 4, 'uh': 4, 'uw': 4,
    // Consonant sounds
    'b': 5, 'p': 5, 'm': 6, 'f': 7, 'v': 7,
    'th': 8, 'dh': 8, 's': 9, 'z': 9, 'd': 10, 't': 10,
    'n': 11, 'l': 12, 'ch': 13, 'sh': 13, 'j': 13, 'zh': 13,
    'k': 14, 'g': 14, 'ng': 15, 'w': 16, 'r': 17,
    // Silent/closed
    'sil': 18, 'pau': 18,
    // Other
    '': 18
};

/**
 * Quality tier to model mapping
 */
export const QUALITY_MODEL_MAPPING: Record<AudioProvider, Record<QualityTier, string>> = {
    elevenlabs: {
        draft: 'eleven_turbo_v2',
        standard: 'eleven_turbo_v2_5',
        high: 'eleven_multilingual_v2',
        ultra: 'eleven_multilingual_v2'
    },
    ace_audio2face: {
        draft: 'draft',
        standard: 'standard',
        high: 'high',
        ultra: 'high'
    },
    coqui: {
        draft: 'xtts_v2',
        standard: 'xtts_v2',
        high: 'xtts_v2',
        ultra: 'xtts_v2'
    },
    whisper: {
        draft: 'tiny',
        standard: 'base',
        high: 'small',
        ultra: 'medium'
    },
    piper: {
        draft: 'medium',
        standard: 'medium',
        high: 'high',
        ultra: 'high'
    },
    riva: {
        draft: 'fast',
        standard: 'standard',
        high: 'high',
        ultra: 'ultra'
    },
    cached: {
        draft: 'cached',
        standard: 'cached',
        high: 'cached',
        ultra: 'cached'
    }
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Provider request with optional provider
 */
export type ProviderRequest<T = unknown> = T & {
    provider?: AudioProvider;
};

/**
 * Result wrapper
 */
export type Result<T, E = Error> = {
    success: true;
    data: T;
} | {
    success: false;
    error: E;
};
