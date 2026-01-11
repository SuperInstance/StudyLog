/**
 * Unified types for asset generation across StudyLoG.AI and DMLoG.AI
 * Handles 3D models, audio, and 2D art from multiple providers
 */

// ============================================================================
// Core Asset Types
// ============================================================================

export type AssetType = '3d_model' | 'audio' | '2d_art' | 'texture' | 'animation' | 'environment';

export type AssetProvider =
    | 'hunyuan'           // Tencent Hunyuan 3D
    | 'sloyd'             // Sloyd AI
    | 'masterpiece_x'     // Masterpiece X
    | 'tripo'             // Tripo AI
    | 'rodin'             // Rodin Gen-2
    | 'meshy'             // Meshy AI
    | 'elevenlabs'        // ElevenLabs
    | 'audio2face'        // NVIDIA ACE
    | 'rosebud'           // Rosebud AI
    | 'leonardo'          // Leonardo AI
    | 'scenario'          // Scenario.gg
    | 'user_upload'
    | 'cached';

export type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'general';

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type ModelFormat = 'glb' | 'gltf' | 'fbx' | 'obj' | 'usd' | 'usdz';

export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'aac' | 'flac';

export type ImageFormat = 'png' | 'jpg' | 'webp' | 'svg' | 'gif';

// ============================================================================
// Base Asset Interfaces
// ============================================================================

export interface BaseAsset {
    id: string;
    type: AssetType;
    provider: AssetProvider;
    productContext: ProductContext;
    originalPrompt: string;
    generationParams?: Record<string, unknown>;
    status: GenerationStatus;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
    parentAssetId?: string;
    costCents: number;
    apiRequestId?: string;
    errorMessage?: string;
}

export interface StorageLocation {
    storageType: 'r2' | 's3' | 'local' | 'external_url';
    bucketName?: string;
    filePath: string;
    cdnUrl?: string;
    directDownloadUrl?: string;
    hashSha256?: string;
    hashMd5?: string;
    uploadedAt: Date;
}

export interface Tag {
    id: string;
    name: string;
    category: 'style' | 'subject' | 'use_case' | 'product' | 'era' | 'mood';
    color: string;
    createdAt: Date;
}

export interface AssetTag {
    assetId: string;
    tagId: string;
    confidence: number;
}

// ============================================================================
// 3D Model Types
// ============================================================================

export interface Model3DAsset extends BaseAsset {
    type: '3d_model' | 'environment';
    metadata: Model3DMetadata;
    storage: StorageLocation;
}

export interface Model3DMetadata {
    format: ModelFormat;
    polygonCount?: number;
    vertexCount?: number;
    textureCount?: number;
    hasRigging: boolean;
    hasAnimation: boolean;
    hasUVUnwrapping: boolean;
    lodLevels: number;
    boundingBox?: BoundingBox3D;
    fileSizeBytes: number;
    previewImageUrl?: string;
    godotCompatible: boolean;
    theiaMetadata?: TheiaMetadata;
}

export interface EnvironmentMetadata extends Model3DMetadata {
    sceneType: 'terrain' | 'building' | 'city' | 'nature' | 'dungeon' | 'interior';
    areaSquareUnits?: number;
    objectCount?: number;
    navmeshGenerated: boolean;
    collisionBaked: boolean;
    lightingBaked: boolean;
    occlusionCulling: boolean;
    lodDistance?: number;
    godotScenePath?: string;
    importSettings?: Record<string, unknown>;
}

export interface BoundingBox3D {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    size: [number, number, number];
}

export interface TheiaMetadata {
    importPath?: string;
    resourceType?: string;
    autoImport?: boolean;
    customImportSettings?: Record<string, unknown>;
}

// ============================================================================
// Audio Types
// ============================================================================

export interface AudioAsset extends BaseAsset {
    type: 'audio';
    metadata: AudioMetadata;
    storage: StorageLocation;
}

export interface AudioMetadata {
    format: AudioFormat;
    durationSeconds: number;
    sampleRate: number;
    bitrate?: number;
    channels: number;
    voiceId?: string;
    isVoiceDesign: boolean;
    hasLipSync: boolean;
    transcript?: string;
    emotionTags?: string[];
    fileSizeBytes: number;
    previewUrl?: string;
}

export interface LipSyncData {
    visemes: VisemeFrame[];
    durationSeconds: number;
    framerate: number;
}

export interface VisemeFrame {
    time: number;
    viseme: string;
    blendWeight: number;
    mouthShape?: number[];
}

// ============================================================================
// 2D Art Types
// ============================================================================

export interface Art2DAsset extends BaseAsset {
    type: '2d_art' | 'texture';
    metadata: Art2DMetadata;
    storage: StorageLocation;
}

export interface Art2DMetadata {
    format: ImageFormat;
    width: number;
    height: number;
    isSpriteSheet: boolean;
    spriteColumns?: number;
    spriteRows?: number;
    framesPerSecond?: number;
    styleModelId?: string;
    alphaChannel: boolean;
    fileSizeBytes: number;
    colorPalette?: string[];
    godotImportType?: 'Texture2D' | 'CompressedTexture2D' | 'AtlasTexture' | 'AnimatedTexture';
}

// ============================================================================
// Generation Request Types
// ============================================================================

export interface Generate3DRequest {
    prompt: string;
    negativePrompt?: string;
    inputImage?: string; // Base64 or URL
    inputSketch?: string; // Base64 or URL
    format?: ModelFormat;
    style?: string;
    quality?: 'draft' | 'standard' | 'high';
    polygonTarget?: number;
    includeRigging?: boolean;
    includeAnimation?: boolean;
    productContext?: ProductContext;
    tags?: string[];
    priority?: number;
}

export interface GenerateEnvironmentRequest {
    prompt: string;
    sceneType: EnvironmentMetadata['sceneType'];
    areaSize?: [number, number, number];
    objectCount?: number;
    includeNavmesh?: boolean;
    includeCollision?: boolean;
    bakeLighting?: boolean;
    style?: string;
    productContext?: ProductContext;
    priority?: number;
}

export interface GenerateAudioRequest {
    text: string;
    voiceId?: string;
    model?: 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' | 'eleven_turbo_v2';
    outputFormat?: AudioFormat;
    sampleRate?: number;
    stability?: number;
    similarityBoost?: number;
    style?: number;
    useSpeakerBoost?: boolean;
    generateLipSync?: boolean;
    productContext?: ProductContext;
    priority?: number;
}

export interface CreateVoiceRequest {
    name: string;
    description?: string;
    audioSamples?: string[]; // Base64 audio samples for cloning
    gender?: 'male' | 'female' | 'non_binary' | 'custom';
    age?: 'young' | 'middle_aged' | 'elderly';
    accent?: string;
    style?: 'conversational' | 'narration' | 'character' | 'news';
}

export interface GenerateSoundEffectRequest {
    prompt: string;
    durationSeconds?: number;
    outputFormat?: AudioFormat;
    productContext?: ProductContext;
}

export interface Generate2DRequest {
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    format?: ImageFormat;
    styleModelId?: string;
    numImages?: number;
    isSpriteSheet?: boolean;
    spriteColumns?: number;
    spriteRows?: number;
    framesPerSecond?: number;
    alphaChannel?: boolean;
    productContext?: ProductContext;
    tags?: string[];
    priority?: number;
}

export interface TrainStyleModelRequest {
    name: string;
    description?: string;
    trainingImages: string[]; // URLs or base64
    triggerWord?: string;
    styleType?: 'character' | 'environment' | 'item' | 'ui';
    productContext?: ProductContext;
}

// ============================================================================
// Provider-Specific Types
// ============================================================================

// Hunyuan 3D
export interface Hunyuan3DConfig {
    apiKey: string;
    endpoint: string;
    model: 'hunyuan3d-1.0' | 'hy-world-1.5';
}

export interface Hunyuan3DResponse {
    code: number;
    message: string;
    data: {
        taskId: string;
        status: string;
        modelUrl?: string;
        thumbnailUrl?: string;
    };
}

// Sloyd AI
export interface SloydConfig {
    apiKey: string;
    endpoint: string;
}

export interface SloydModelParams {
    category: string;
    style: string;
    lod: 0 | 1 | 2;
    unwrap: boolean;
}

export interface SloydResponse {
    model: {
        glb: string;
        obj?: string;
        fbx?: string;
        thumbnail: string;
        metadata: {
            polygons: number;
            vertices: number;
            textures: number;
        };
    };
}

// Masterpiece X
export interface MasterpieceXConfig {
    apiKey: string;
    endpoint: string;
}

export interface MasterpieceXGenerateRequest {
    text: string;
    image?: string;
    mesh: 'standard' | 'high' | 'ultra';
    texture: true;
    rig: boolean;
    animate: boolean;
}

export interface MasterpieceXResponse {
    id: string;
    status: string;
    result?: {
        glb: string;
        thumbnail: string;
    };
}

// Tripo AI
export interface TripoConfig {
    apiKey: string;
    endpoint: string;
}

export interface TripoResponse {
    code: number;
    data: {
        id: string;
        status: string;
        model_url?: string;
        thumbnail_url?: string;
    };
}

// Rodin Gen-2
export interface RodinConfig {
    apiKey: string;
    endpoint: string;
    godotPluginPath?: string;
}

export interface RodinResponse {
    task_id: string;
    status: string;
    model_url?: string;
}

// Meshy AI
export interface MeshyConfig {
    apiKey: string;
    endpoint: string;
}

export interface MeshyResponse {
    id: string;
    status: string;
    model_urls?: {
        glb?: string;
        obj?: string;
        fbx?: string;
    };
    thumbnail_url?: string;
}

// ElevenLabs
export interface ElevenLabsConfig {
    apiKey: string;
    endpoint: string;
}

export interface ElevenLabsVoice {
    voice_id: string;
    name: string;
    category: string;
    labels?: Record<string, string>;
}

export interface ElevenLabsResponse {
    id: string;
    status: string;
    audio_url?: string;
    lip_sync_url?: string;
}

// NVIDIA ACE Audio2Face
export interface Audio2FaceConfig {
    apiKey: string;
    endpoint: string;
    arkit?: boolean; // Use ARKit blendshapes
}

export interface Audio2FaceRequest {
    audio: string; // URL or base64
    character?: string; // Predefined character preset
    enableGaze?: boolean;
    enableBlinks?: boolean;
}

export interface Audio2FaceResponse {
    animation_url: string;
    format: 'json' | 'usd' | 'fbx';
    blendshapes?: Record<string, number[]>;
}

// Rosebud AI
export interface RosebudConfig {
    apiKey: string;
    endpoint: string;
}

export interface RosebudResponse {
    id: string;
    status: string;
    assets?: {
        png?: string;
        glb?: string;
        sprite_sheet?: string;
    };
}

// Leonardo AI
export interface LeonardoConfig {
    apiKey: string;
    endpoint: string;
}

export interface LeonardoResponse {
    sdGenerationJob: {
        status: string;
        generated_images?: Array<{
            id: string;
            url: string;
        }>;
    };
}

// Scenario.gg
export interface ScenarioConfig {
    apiKey: string;
    endpoint: string;
}

export interface ScenarioTrainResponse {
    id: string;
    status: string;
    model_id?: string;
}

export interface ScenarioGenerateResponse {
    images: Array<{
        url: string;
        seed: number;
    }>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface AssetResponse<T = BaseAsset> {
    success: boolean;
    asset?: T;
    error?: string;
    requestId: string;
}

export interface GenerationResponse {
    success: boolean;
    assetId?: string;
    status: GenerationStatus;
    estimatedTimeSeconds?: number;
    pollUrl?: string;
    error?: string;
    requestId: string;
}

export interface ListAssetsResponse {
    assets: BaseAsset[];
    total: number;
    page: number;
    pageSize: number;
}

// ============================================================================
// Queue Types
// ============================================================================

export interface QueueItem {
    id: string;
    assetId: string;
    priority: number;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    queuedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    workerId?: string;
    retryCount: number;
    maxRetries: number;
    errorLog?: string;
}

export interface QueueStats {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    avgWaitTimeSeconds: number;
    avgProcessTimeSeconds: number;
}

// ============================================================================
// Cost Tracking
// ============================================================================

export interface ProviderCost {
    id: string;
    provider: AssetProvider;
    operation: string;
    costUsd: number;
    currency: string;
    assetCount: number;
    trackedAt: Date;
}

export interface CostEstimate {
    provider: AssetProvider;
    estimatedCostUsd: number;
    currency: string;
    breakdown: {
        generation: number;
        storage?: number;
        bandwidth?: number;
    };
}

// ============================================================================
// Godot Import Types
// ============================================================================

export interface GodotImportConfig {
    importPath: string;
    importType: 'scene' | 'mesh' | 'texture' | 'audio' | 'material';
    importSettings?: Record<string, unknown>;
    postImportScript?: string;
}

export interface GodotSceneData {
    scenePath: string;
    nodes: GodotNode[];
    rootType: string;
    importSettings: Record<string, unknown>;
}

export interface GodotNode {
    name: string;
    type: string;
    parent?: string;
    transform?: {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
    };
    properties?: Record<string, unknown>;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
    assetId: string;
    key: string;
    data: unknown;
    expiresAt: Date;
    createdAt: Date;
    accessCount: number;
    lastAccessedAt: Date;
}

export interface CacheStats {
    totalEntries: number;
    totalSizeBytes: number;
    hitRate: number;
    evictionCount: number;
}

// ============================================================================
// Validation Schemas (partial - for reference)
// ============================================================================

export interface ValidationSchema {
    prompt: { min: number; max: number };
    maxFileSize: number;
    allowedFormats: string[];
    rateLimits: {
        perMinute: number;
        perDay: number;
    };
}

export const PROVIDER_LIMITS: Record<AssetProvider, ValidationSchema> = {
    hunyuan: {
        prompt: { min: 10, max: 500 },
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 20, perDay: 500 }
    },
    sloyd: {
        prompt: { min: 5, max: 200 },
        maxFileSize: 5 * 1024 * 1024,
        allowedFormats: ['glb'],
        rateLimits: { perMinute: 30, perDay: 1000 }
    },
    masterpiece_x: {
        prompt: { min: 10, max: 1000 },
        maxFileSize: 20 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 10, perDay: 100 }
    },
    tripo: {
        prompt: { min: 10, max: 500 },
        maxFileSize: 10 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 20, perDay: 500 }
    },
    rodin: {
        prompt: { min: 10, max: 500 },
        maxFileSize: 10 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 15, perDay: 300 }
    },
    meshy: {
        prompt: { min: 10, max: 500 },
        maxFileSize: 10 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 30, perDay: 1000 }
    },
    elevenlabs: {
        prompt: { min: 1, max: 5000 },
        maxFileSize: 0,
        allowedFormats: [],
        rateLimits: { perMinute: 60, perDay: 10000 }
    },
    audio2face: {
        prompt: { min: 0, max: 0 },
        maxFileSize: 50 * 1024 * 1024,
        allowedFormats: ['wav', 'mp3'],
        rateLimits: { perMinute: 10, perDay: 100 }
    },
    rosebud: {
        prompt: { min: 10, max: 500 },
        maxFileSize: 10 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 20, perDay: 200 }
    },
    leonardo: {
        prompt: { min: 10, max: 1000 },
        maxFileSize: 10 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 30, perDay: 3000 }
    },
    scenario: {
        prompt: { min: 10, max: 500 },
        maxFileSize: 20 * 1024 * 1024,
        allowedFormats: ['png', 'jpg'],
        rateLimits: { perMinute: 20, perDay: 500 }
    },
    user_upload: {
        prompt: { min: 0, max: 0 },
        maxFileSize: 100 * 1024 * 1024,
        allowedFormats: ['*'],
        rateLimits: { perMinute: 10, perDay: 100 }
    },
    cached: {
        prompt: { min: 0, max: 0 },
        maxFileSize: 0,
        allowedFormats: [],
        rateLimits: { perMinute: 1000, perDay: 100000 }
    }
};
