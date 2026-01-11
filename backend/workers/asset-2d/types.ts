/**
 * 2D Art & Texturing API - Unified Type Definitions
 * For StudyLoG.AI and DMLoG.AI
 *
 * Supports:
 * - Rosebud AI (PixelVibe) - Pixel art, sprites, UGC
 * - Leonardo AI - Sprites, UI icons, concept art
 * - Scenario.gg - Style models for consistency
 * - Midjourney - Concept art via Discord
 * - Stability AI - SDXL, SD 3.5
 */

// ============================================================================
// Core Types
// ============================================================================

export type Asset2DProvider =
    | 'rosebud'
    | 'leonardo'
    | 'scenario'
    | 'midjourney'
    | 'stability'
    | 'cached';

export type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'general';

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'queued';

export type ImageFormat = 'png' | 'jpg' | 'webp' | 'gif' | 'svg';

export type QualityTier = 'draft' | 'preview' | 'standard' | 'high' | 'ultra';

export type ArtStyle =
    | 'pixel_art'
    | '16bit'
    | 'vaporwave'
    | 'anime'
    | 'cartoon'
    | 'realistic'
    | 'oil_painting'
    | 'watercolor'
    | 'pixel_perfect'
    | 'isometric'
    | 'top_down'
    | 'side_scroller'
    | 'rpg_maker'
    | 'gba'
    | 'nes'
    | 'snes'
    | 'arcade';

export type SpriteCategory =
    | 'character'
    | 'creature'
    | 'weapon'
    | 'armor'
    | 'item'
    | 'furniture'
    | 'vehicle'
    | 'prop'
    | 'effect'
    | 'ui_icon'
    | 'background'
    | 'tileset'
    | 'portrait'
    | 'emoji';

export type UIIconStyle =
    | 'minimal'
    | 'outlined'
    | 'filled'
    | 'duotone'
    | 'flat'
    | 'gradient'
    | 'neumorphic'
    | 'glassmorphic'
    | 'pixel'
    | 'hand_drawn';

export type AnimationType =
    | 'idle'
    | 'walk'
    | 'run'
    | 'jump'
    | 'attack'
    | 'hurt'
    | 'death'
    | 'cast'
    | 'block'
    | 'emote';

// ============================================================================
// Request Types
// ============================================================================

export interface GenerateSpriteRequest {
    prompt: string;
    negativePrompt?: string;
    style?: ArtStyle;
    format?: ImageFormat;
    quality?: QualityTier;
    width?: number;
    height?: number;
    category?: SpriteCategory;
    viewAngle?: 'front' | 'side' | 'top' | 'isometric' | 'quarter';
    backgroundColor?: string;
    transparent?: boolean;
    productContext?: ProductContext;
    tags?: string[];
    priority?: number;
    preferredProvider?: Asset2DProvider;
    referenceImage?: string;
    seed?: number;
}

export interface GenerateSpriteSheetRequest extends GenerateSpriteRequest {
    animations: AnimationConfig[];
    framesPerAnimation?: number;
    frameWidth?: number;
    frameHeight?: number;
    padding?: number;
    columns?: number;
    rows?: number;
    includeJsonData?: boolean;
    jsonFormat?: 'aseprite' | 'godot' | 'unity' | 'custom';
}

export interface AnimationConfig {
    type: AnimationType;
    direction?: 'up' | 'down' | 'left' | 'right' | 'diagonal';
    frames?: number;
    duration?: number; // milliseconds per frame
    looping?: boolean;
}

export interface GenerateUIRequest {
    prompt: string;
    style?: UIIconStyle;
    format?: ImageFormat;
    size?: number;
    colorScheme?: string[];
    stroke?: {
        enabled: boolean;
        width?: number;
        color?: string;
    };
    category?: string;
    productContext?: ProductContext;
    batch?: boolean;
    batchCount?: number;
    consistencyKey?: string; // For maintaining style across multiple icons
}

export interface GenerateConceptRequest {
    prompt: string;
    style?: string;
    mood?: string;
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9' | 'custom';
    quality?: QualityTier;
    referenceImages?: string[];
    iterations?: number;
    productContext?: ProductContext;
    forCharacter?: boolean;
    forEnvironment?: boolean;
    forItem?: boolean;
}

export interface GenerateTilesetRequest {
    prompt: string;
    style?: ArtStyle;
    tileSize?: number;
    tilesWide?: number;
    tilesHigh?: number;
    includeVariations?: boolean;
    includeAutotile?: boolean;
    terrainTypes?: string[];
    productContext?: ProductContext;
}

export interface TextureAtlasRequest {
    images: string[]; // URLs or base64
    maxWidth?: number;
    maxHeight?: number;
    padding?: number;
    powerOfTwo?: boolean;
    generateJson?: boolean;
    jsonFormat?: 'array' | 'hash' | 'custom';
    outputFormat?: ImageFormat;
}

export interface StyleTrainRequest {
    provider: 'scenario' | 'leonardo' | 'stability';
    name: string;
    images: string[];
    styleDescription?: string;
    triggerWord?: string;
    strength?: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface GenerationResponse {
    success: boolean;
    assetId?: string;
    status: GenerationStatus;
    estimatedTimeSeconds?: number;
    pollUrl?: string;
    error?: string;
    errorCode?: string;
    requestId: string;
    provider?: Asset2DProvider;
    costUsd?: number;
}

export interface SpriteMetadata {
    format: ImageFormat;
    width: number;
    height: number;
    frameCount: number;
    hasTransparency: boolean;
    colorDepth: number;
    palette?: string[];
    isAnimated: boolean;
    fileSizeBytes: number;
    previewUrl?: string;
    godotCompatible: boolean;
    godotImportPath?: string;
}

export interface SpriteSheetMetadata extends SpriteMetadata {
    animations: AnimationInfo[];
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
    padding: number;
    jsonData?: SpriteSheetJsonData;
}

export interface AnimationInfo {
    name: string;
    type: AnimationType;
    startFrame: number;
    endFrame: number;
    frameCount: number;
    duration: number;
    looping: boolean;
}

export interface SpriteSheetJsonData {
    format: 'aseprite' | 'godot' | 'unity' | 'array' | 'hash';
    frames: FrameData[];
    meta?: JsonMeta;
}

export interface FrameData {
    filename: string;
    frame: { x: number; y: number; w: number; h: number };
    rotated?: boolean;
    trimmed?: boolean;
    spriteSourceSize?: { x: number; y: number; w: number; h: number };
    sourceSize?: { w: number; h: number };
    duration?: number;
}

export interface JsonMeta {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
}

export interface UIMetadata {
    format: ImageFormat;
    width: number;
    height: number;
    style: UIIconStyle;
    hasTransparency: boolean;
    colorScheme?: string[];
    isScalable: boolean;
    fileSizeBytes: number;
    svgData?: string;
}

export interface ConceptMetadata {
    format: ImageFormat;
    width: number;
    height: number;
    aspectRatio: string;
    style: string;
    mood?: string;
    variationIndex?: number;
    iterationCount: number;
    fileSizeBytes: number;
    previewUrl?: string;
}

export interface TextureAtlasMetadata {
    format: ImageFormat;
    width: number;
    height: number;
    imageCount: number;
    padding: number;
    isPowerOfTwo: boolean;
    jsonData?: SpriteSheetJsonData;
    atlasImageUrl?: string;
}

export interface Asset2DDetails {
    id: string;
    type: 'sprite' | 'spritesheet' | 'ui' | 'concept' | 'tileset' | 'atlas';
    provider: Asset2DProvider;
    productContext: ProductContext;
    originalPrompt: string;
    generationParams: Record<string, unknown>;
    status: GenerationStatus;
    metadata: SpriteMetadata | SpriteSheetMetadata | UIMetadata | ConceptMetadata | TextureAtlasMetadata;
    storage: StorageLocation2D;
    createdAt: Date;
    updatedAt: Date;
    costCents: number;
    tags: string[];
}

export interface StorageLocation2D {
    storageType: 'r2' | 's3' | 'external_url' | 'cdn' | 'base64';
    bucketName?: string;
    filePath: string;
    cdnUrl?: string;
    directDownloadUrl?: string;
    hashSha256?: string;
    uploadedAt: Date;
    expiresAt?: Date;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

export interface Provider2DConfig {
    apiKey: string;
    endpoint?: string;
    enabled?: boolean;
    priority?: number;
    rateLimit?: {
        requestsPerMinute: number;
        requestsPerDay: number;
    };
}

export interface RosebudConfig extends Provider2DConfig {
    model?: 'pixelvibe-1' | 'pixelvibe-2' | 'pixelvibe-turbo';
    defaultResolution?: '64x64' | '128x128' | '256x256' | '512x512';
}

export interface LeonardoConfig extends Provider2DConfig {
    model?: 'leonardo-v2' | 'leonardo-v3' | 'kino-xl' | 'phoenix-v3';
    defaultResolution?: '512x512' | '768x1024' | '1024x768' | '1024x1024';
    enableFineTuning?: boolean;
    finetuneModels?: string[];
}

export interface ScenarioConfig extends Provider2DConfig {
    defaultStyleModel?: string;
    customStyleModels?: string[];
    enableTraining?: boolean;
}

export interface MidjourneyConfig extends Provider2DConfig {
    discordBotToken?: string;
    guildId?: string;
    channelId?: string;
    webhookUrl?: string;
}

export interface StabilityConfig extends Provider2DConfig {
    engine?: 'stable-diffusion-xl-1024' | 'stable-diffusion-3' | 'stable-diffusion-3.5';
    defaultSteps?: number;
    defaultCfgScale?: number;
    enableSDEdit?: boolean;
}

export interface AllProvider2DConfigs {
    rosebud?: RosebudConfig;
    leonardo?: LeonardoConfig;
    scenario?: ScenarioConfig;
    midjourney?: MidjourneyConfig;
    stability?: StabilityConfig;
}

// ============================================================================
// Provider-Specific Types
// ============================================================================

// Rosebud AI / PixelVibe
export interface RosebudResponse {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    image_url?: string;
    thumbnail_url?: string;
    error?: string;
}

export interface RosebudPixelArtRequest {
    prompt: string;
    negative_prompt?: string;
    resolution?: '64x64' | '128x128' | '256x256' | '512x512';
    style?: 'pixel' | '16bit' | 'vaporwave' | 'rpg';
    palette?: string;
    transparent?: boolean;
}

// Leonardo AI
export interface LeonardoResponse {
    sdGenerationJob?: {
        generationId: string;
    };
    object?: {
        id: string;
        images: LeonardoImage[];
    };
}

export interface LeonardoImage {
    id: string;
    url: string;
    urlGenerated?: string;
}

export interface LeonardoGenerationRequest {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
    num_images?: number;
    modelId?: string;
    sd_version?: 'v1_5' | 'v2' | 'xl-v1-0-0' | 'xl-v0-9-0';
    promptMagic?: boolean;
    tiling?: boolean;
}

export interface LeonardoSpriteRequest extends LeonardoGenerationRequest {
    mode: 'SPRITE';
    spriteConfig?: {
        frameCount?: number;
        animation?: boolean;
        columns?: number;
        rows?: number;
    };
}

// Scenario.gg
export interface ScenarioResponse {
    id: string;
    status: string;
    images?: string[];
    image_url?: string;
}

export interface ScenarioInferenceRequest {
    type: 'image-to-image' | 'text-to-image';
    prompt: string;
    negative?: string;
    style?: string;
    width?: number;
    height?: number;
    samples?: number;
    steps?: number;
    image?: string; // For image-to-image
    strength?: number;
}

export interface ScenarioStyleModel {
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    imageCount: number;
    createdAt: string;
}

// Midjourney (via Discord)
export interface MidjourneyResponse {
    id: string;
    status: 'pending' | 'in_progress' | 'complete' | 'failed';
    imageUrl?: string;
    imageUrlUpscaled?: string;
    messageUrl?: string;
}

export interface MidjourneyPrompt {
    prompt: string;
    version?: 'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6' | 'niji';
    aspect?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';
    quality?: number;
    stylize?: number;
    chaos?: number;
    weird?: number;
    tile?: boolean;
    no?: string;
}

// Stability AI
export interface StabilityResponse {
    artifacts: StabilityArtifact[];
    image?: string;
}

export interface StabilityArtifact {
    base64?: string;
    finishReason: string;
    seed: number;
}

export interface StabilityGenerationRequest {
    text_prompts: Array<{
        text: string;
        weight?: number;
    }>;
    cfg_scale?: number;
    height?: number;
    width?: number;
    steps?: number;
    samples?: number;
    seed?: number;
    sampler?: 'DDIM' | 'DDPM' | 'K_DPMPP_2M' | 'K_DPMPP_2S_ANCESTRAL' | 'K_EULER' | 'K_EULER_ANCESTRAL' | 'K_HEUN' | 'K_LMS';
}

// ============================================================================
// Cost and Pricing Types
// ============================================================================

export interface CostEstimate2D {
    provider: Asset2DProvider;
    estimatedCostUsd: number;
    currency: string;
    breakdown: CostBreakdown2D;
}

export interface CostBreakdown2D {
    generation: number;
    storage?: number;
    bandwidth?: number;
    processing?: number;
}

export interface ProviderPricing2D {
    provider: Asset2DProvider;
    pricingModel: 'per_generation' | 'subscription' | 'tiered' | 'credits';
    baseCostUsd: number;
    costs: {
        sprite: number;
        spriteSheet: number;
        uiIcon: number;
        concept: number;
        tileset: number;
        textureAtlas: number;
        styleTraining: number;
    };
    freeTier?: {
        generationsPerMonth: number;
        creditsPerMonth?: number;
    };
}

export const PROVIDER_2D_PRICING: Record<Asset2DProvider, ProviderPricing2D> = {
    rosebud: {
        provider: 'rosebud',
        pricingModel: 'per_generation',
        baseCostUsd: 0.02,
        costs: {
            sprite: 0.02,
            spriteSheet: 0.08,
            uiIcon: 0.01,
            concept: 0.03,
            tileset: 0.05,
            textureAtlas: 0.01,
            styleTraining: 0
        },
        freeTier: { generationsPerMonth: 200 }
    },
    leonardo: {
        provider: 'leonardo',
        pricingModel: 'subscription',
        baseCostUsd: 0.01,
        costs: {
            sprite: 0.01,
            spriteSheet: 0.06,
            uiIcon: 0.005,
            concept: 0.02,
            tileset: 0.04,
            textureAtlas: 0.005,
            styleTraining: 2.00
        },
        freeTier: { generationsPerMonth: 150, creditsPerMonth: 150 }
    },
    scenario: {
        provider: 'scenario',
        pricingModel: 'subscription',
        baseCostUsd: 0.015,
        costs: {
            sprite: 0.015,
            spriteSheet: 0.07,
            uiIcon: 0.008,
            concept: 0.025,
            tileset: 0.045,
            textureAtlas: 0.008,
            styleTraining: 5.00
        },
        freeTier: { generationsPerMonth: 100 }
    },
    midjourney: {
        provider: 'midjourney',
        pricingModel: 'subscription',
        baseCostUsd: 0.03,
        costs: {
            sprite: 0.03,
            spriteSheet: 0.12,
            uiIcon: 0.02,
            concept: 0.04,
            tileset: 0.08,
            textureAtlas: 0.015,
            styleTraining: 0
        },
        freeTier: { generationsPerMonth: 25 }
    },
    stability: {
        provider: 'stability',
        pricingModel: 'per_generation',
        baseCostUsd: 0.01,
        costs: {
            sprite: 0.01,
            spriteSheet: 0.05,
            uiIcon: 0.005,
            concept: 0.015,
            tileset: 0.035,
            textureAtlas: 0.005,
            styleTraining: 1.50
        },
        freeTier: { generationsPerMonth: 100 }
    },
    cached: {
        provider: 'cached',
        pricingModel: 'per_generation',
        baseCostUsd: 0,
        costs: {
            sprite: 0,
            spriteSheet: 0,
            uiIcon: 0,
            concept: 0,
            tileset: 0,
            textureAtlas: 0,
            styleTraining: 0
        }
    }
};

// ============================================================================
// Capabilities Types
// ============================================================================

export interface Provider2DCapabilities {
    pixelArt: boolean;
    spriteSheets: boolean;
    uiIcons: boolean;
    conceptArt: boolean;
    tilesets: boolean;
    textureAtlases: boolean;
    styleTraining: boolean;
    animationSupport: boolean;
    batchGeneration: boolean;
    godotExport: boolean;
    avgTimeSeconds: number;
}

export const PROVIDER_2D_CAPABILITIES: Record<Asset2DProvider, Provider2DCapabilities> = {
    rosebud: {
        pixelArt: true,
        spriteSheets: true,
        uiIcons: true,
        conceptArt: true,
        tilesets: true,
        textureAtlases: false,
        styleTraining: false,
        animationSupport: true,
        batchGeneration: true,
        godotExport: true,
        avgTimeSeconds: 15
    },
    leonardo: {
        pixelArt: false,
        spriteSheets: true,
        uiIcons: true,
        conceptArt: true,
        tilesets: true,
        textureAtlases: false,
        styleTraining: true,
        animationSupport: true,
        batchGeneration: true,
        godotExport: true,
        avgTimeSeconds: 20
    },
    scenario: {
        pixelArt: false,
        spriteSheets: true,
        uiIcons: true,
        conceptArt: true,
        tilesets: true,
        textureAtlases: false,
        styleTraining: true,
        animationSupport: false,
        batchGeneration: true,
        godotExport: true,
        avgTimeSeconds: 25
    },
    midjourney: {
        pixelArt: false,
        spriteSheets: false,
        uiIcons: false,
        conceptArt: true,
        tilesets: false,
        textureAtlases: false,
        styleTraining: false,
        animationSupport: false,
        batchGeneration: false,
        godotExport: false,
        avgTimeSeconds: 60
    },
    stability: {
        pixelArt: false,
        spriteSheets: false,
        uiIcons: true,
        conceptArt: true,
        tilesets: true,
        textureAtlases: false,
        styleTraining: true,
        animationSupport: false,
        batchGeneration: true,
        godotExport: true,
        avgTimeSeconds: 10
    },
    cached: {
        pixelArt: false,
        spriteSheets: false,
        uiIcons: false,
        conceptArt: false,
        tilesets: false,
        textureAtlases: false,
        styleTraining: false,
        animationSupport: false,
        batchGeneration: false,
        godotExport: false,
        avgTimeSeconds: 0
    }
};

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface ApiResponse2D<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    errorCode?: string;
    requestId: string;
    timestamp: number;
}

export interface PaginatedResponse2D<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface ProviderStatusResponse2D {
    provider: Asset2DProvider;
    enabled: boolean;
    available: boolean;
    healthy: boolean;
    quotaUsed: number;
    quotaLimit: number;
    quotaResetsAt: Date;
    avgResponseTimeMs: number;
}

// ============================================================================
// Cloudflare Worker Env
// ============================================================================

export interface Env2D {
    ROSEBUD_API_KEY?: string;
    LEONARDO_API_KEY?: string;
    SCENARIO_API_KEY?: string;
    MIDJOURNEY_DISCORD_TOKEN?: string;
    MIDJOURNEY_WEBHOOK_URL?: string;
    STABILITY_API_KEY?: string;
    ASSETS_2D_BUCKET?: R2Bucket;
    CACHE_2D?: KVNamespace;
    DB_2D?: D1Database;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ProviderRequest2D<T = unknown> = T & {
    provider?: Asset2DProvider;
};

export type WithProvider2D<T, P extends Asset2DProvider> = T & { provider: P };

// ============================================================================
// Style and Template Types
// ============================================================================

export interface StylePreset {
    id: string;
    name: string;
    description: string;
    provider: Asset2DProvider;
    styleModel?: string;
    promptTemplate: string;
    negativePrompt?: string;
    thumbnail?: string;
    tags: string[];
    parameters: Record<string, unknown>;
}

export interface SpriteTemplate {
    id: string;
    name: string;
    category: SpriteCategory;
    dimensions: {
        frameWidth: number;
        frameHeight: number;
        framesPerAnimation: number;
    };
    defaultAnimations: AnimationType[];
    style: ArtStyle;
    promptTemplate: string;
}

export const DEFAULT_STYLE_PRESETS: StylePreset[] = [
    {
        id: 'pixel-perfect-16bit',
        name: '16-bit Pixel Perfect',
        description: 'Classic 16-bit SNES style pixel art',
        provider: 'rosebud',
        promptTemplate: '{prompt}, pixel art, 16-bit, SNES style, dithering, limited color palette',
        negativePrompt: 'blurry, anti-aliased, high resolution',
        tags: ['pixel', '16bit', 'retro', 'snes'],
        parameters: { resolution: '128x128' }
    },
    {
        id: 'gba-style',
        name: 'Game Boy Advance',
        description: 'GBA era pixel art style',
        provider: 'rosebud',
        promptTemplate: '{prompt}, pixel art, GBA style, 32-bit color, sprite sheet style',
        negativePrompt: 'realistic, 3d, shaded',
        tags: ['pixel', 'gba', 'retro'],
        parameters: { resolution: '64x64' }
    },
    {
        id: 'vaporwave-aesthetic',
        name: 'Vaporwave',
        description: 'Vaporwave aesthetic with neon colors',
        provider: 'rosebud',
        promptTemplate: '{prompt}, vaporwave aesthetic, neon colors, grid, retro 80s, synthwave',
        negativePrompt: 'realistic, dark, muted',
        tags: ['vaporwave', 'retro', 'neon'],
        parameters: { resolution: '256x256' }
    },
    {
        id: 'isometric-game',
        name: 'Isometric Game Art',
        description: 'Isometric perspective game assets',
        provider: 'leonardo',
        promptTemplate: '{prompt}, isometric view, game asset, clean lines, flat colors',
        negativePrompt: 'perspective, realistic, photo',
        tags: ['isometric', 'game', 'top-down'],
        parameters: { aspectRatio: '1:1' }
    },
    {
        id: 'minimal-ui',
        name: 'Minimal UI Icons',
        description: 'Clean minimal UI icon style',
        provider: 'leonardo',
        promptTemplate: '{prompt}, minimal icon, flat design, vector style, clean lines',
        negativePrompt: 'detailed, shaded, realistic',
        tags: ['ui', 'minimal', 'icon'],
        parameters: { size: 512 }
    }
];

export const SPRITE_TEMPLATES: SpriteTemplate[] = [
    {
        id: 'rpg-character',
        name: 'RPG Character',
        category: 'character',
        dimensions: { frameWidth: 32, frameHeight: 48, framesPerAnimation: 4 },
        defaultAnimations: ['idle', 'walk', 'attack', 'hurt'],
        style: 'pixel_perfect',
        promptTemplate: 'RPG character sprite, {prompt}, pixel art, transparent background'
    },
    {
        id: 'top-down-hero',
        name: 'Top-Down Hero',
        category: 'character',
        dimensions: { frameWidth: 64, frameHeight: 64, framesPerAnimation: 8 },
        defaultAnimations: ['idle', 'walk', 'run', 'attack', 'cast'],
        style: 'pixel_art',
        promptTemplate: 'Top-down character sprite, {prompt}, game asset'
    },
    {
        id: 'side-scroller-enemy',
        name: 'Side-Scroller Enemy',
        category: 'creature',
        dimensions: { frameWidth: 48, frameHeight: 48, framesPerAnimation: 6 },
        defaultAnimations: ['idle', 'walk', 'attack', 'death'],
        style: '16bit',
        promptTemplate: 'Side-scroller enemy sprite, {prompt}, pixel art'
    },
    {
        id: 'isometric-prop',
        name: 'Isometric Prop',
        category: 'prop',
        dimensions: { frameWidth: 64, frameHeight: 64, framesPerAnimation: 1 },
        defaultAnimations: ['idle'],
        style: 'isometric',
        promptTemplate: 'Isometric {prompt}, game asset, top-down view'
    }
];
