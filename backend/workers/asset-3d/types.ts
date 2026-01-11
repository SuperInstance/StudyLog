/**
 * 3D Asset API - Unified Type Definitions
 * For StudyLoG.AI and DMLoG.AI
 *
 * Supports:
 * - Tencent Hunyuan 3D (OBJ/GLB export, HY-World 1.5)
 * - Sloyd AI (Parametric models, LOD, UV unwrapping)
 * - Masterpiece X (Rigged/animated characters)
 * - Tripo AI (Mesh generation with rigging, segmentation)
 * - Rodin Gen-2 (Godot plugin, texture baking)
 * - Meshy AI (Text/image to 3D)
 */

// ============================================================================
// Core Types
// ============================================================================

export type AssetProvider =
    | 'hunyuan'
    | 'sloyd'
    | 'masterpiece_x'
    | 'tripo'
    | 'rodin'
    | 'meshy'
    | 'cached';

export type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'general';

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type ModelFormat = 'glb' | 'gltf' | 'fbx' | 'obj' | 'usd' | 'usdz';

export type QualityTier = 'draft' | 'preview' | 'standard' | 'high' | 'ultra';

export type SceneType = 'terrain' | 'building' | 'city' | 'nature' | 'dungeon' | 'interior' | 'space';

export type AssetCategory =
    | 'character'
    | 'creature'
    | 'weapon'
    | 'armor'
    | 'furniture'
    | 'vehicle'
    | 'prop'
    | 'architecture'
    | 'environment'
    | 'fx';

// ============================================================================
// Request Types
// ============================================================================

export interface GenerateModelRequest {
    prompt: string;
    negativePrompt?: string;
    inputImage?: string;
    inputSketch?: string;
    format?: ModelFormat;
    quality?: QualityTier;
    style?: string;
    polygonTarget?: number;
    includeRigging?: boolean;
    includeAnimation?: boolean;
    productContext?: ProductContext;
    category?: AssetCategory;
    tags?: string[];
    priority?: number;
    preferredProvider?: AssetProvider;
}

export interface GenerateEnvironmentRequest {
    prompt: string;
    sceneType: SceneType;
    areaSize?: [number, number, number];
    objectCount?: number;
    includeNavmesh?: boolean;
    includeCollision?: boolean;
    bakeLighting?: boolean;
    style?: string;
    productContext?: ProductContext;
    priority?: number;
    timeOfDay?: 'day' | 'night' | 'dawn' | 'dusk' | 'indoor';
    weather?: 'clear' | 'rain' | 'snow' | 'fog' | 'storm';
}

export interface BatchGenerateRequest {
    requests: GenerateModelRequest[];
    parallel?: boolean;
    failFast?: boolean;
}

export interface ConvertRequest {
    assetId: string;
    sourceFormat: ModelFormat;
    targetFormat: ModelFormat;
    optimize?: boolean;
    targetPolygons?: number;
}

export interface ImportToGodotRequest {
    assetId: string;
    projectPath?: string;
    importPath?: string;
    generateLOD?: boolean;
    lodLevels?: number;
    importAsSkeleton?: boolean;
    generateCollision?: boolean;
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
    provider?: AssetProvider;
    costUsd?: number;
}

export interface ModelMetadata {
    format: ModelFormat;
    polygonCount?: number;
    vertexCount?: number;
    triangleCount?: number;
    textureCount?: number;
    materialCount?: number;
    hasRigging: boolean;
    hasAnimation: boolean;
    hasUVUnwrapping: boolean;
    lodLevels: number;
    boundingBox?: BoundingBox3D;
    fileSizeBytes: number;
    previewImageUrl?: string;
    godotCompatible: boolean;
    boneCount?: number;
    animationClipCount?: number;
}

export interface EnvironmentMetadata extends ModelMetadata {
    sceneType: SceneType;
    areaSquareUnits?: number;
    objectCount?: number;
    navmeshGenerated: boolean;
    collisionBaked: boolean;
    lightingBaked: boolean;
    occlusionCulling: boolean;
    lodDistance?: number;
}

export interface AssetDetails {
    id: string;
    type: 'model' | 'environment';
    provider: AssetProvider;
    productContext: ProductContext;
    originalPrompt: string;
    generationParams: Record<string, unknown>;
    status: GenerationStatus;
    metadata: ModelMetadata | EnvironmentMetadata;
    storage: StorageLocation;
    createdAt: Date;
    updatedAt: Date;
    costCents: number;
    tags: string[];
}

export interface StorageLocation {
    storageType: 'r2' | 's3' | 'external_url' | 'cdn';
    bucketName?: string;
    filePath: string;
    cdnUrl?: string;
    directDownloadUrl?: string;
    hashSha256?: string;
    uploadedAt: Date;
    expiresAt?: Date;
}

export interface BoundingBox3D {
    min: [number, number, number];
    max: [number, number, number];
    center: [number, number, number];
    size: [number, number, number];
}

// ============================================================================
// Godot Import Types
// ============================================================================

export interface GodotImportConfig {
    importPath: string;
    importType: 'scene' | 'mesh' | 'skeleton' | 'animation';
    importSettings?: GodotImportSettings;
}

export interface GodotImportSettings {
    generateTangents?: boolean;
    generateNormals?: boolean;
    compressTextures?: boolean;
    lodLevels?: number;
    importAsSkeleton?: boolean;
    generateCollision?: boolean;
    scale?: number;
}

export interface GodotSceneData {
    scenePath: string;
    nodes: GodotNode[];
    rootType: string;
    importSettings: GodotImportSettings;
    resources: GodotResource[];
}

export interface GodotNode {
    name: string;
    type: string;
    parent?: string;
    transform?: GodotTransform;
    properties?: Record<string, unknown>;
    children?: GodotNode[];
}

export interface GodotTransform {
    position: [number, number, number];
    rotation: [number, number, number]; // Euler angles in degrees
    scale: [number, number, number];
}

export interface GodotResource {
    path: string;
    type: string;
    importId?: string;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

export interface ProviderConfig {
    apiKey: string;
    endpoint?: string;
    enabled?: boolean;
    priority?: number;
    rateLimit?: {
        requestsPerMinute: number;
        requestsPerDay: number;
    };
}

export interface HunyuanConfig extends ProviderConfig {
    model?: 'hunyuan3d-1.0' | 'hy-world-1.5';
}

export interface SloydConfig extends ProviderConfig {
    categories?: string[];
    styles?: string[];
}

export interface MasterpieceXConfig extends ProviderConfig {
    defaultMeshQuality?: 'standard' | 'high' | 'ultra';
}

export interface TripoConfig extends ProviderConfig {
    enableRigging?: boolean;
    enableSegmentation?: boolean;
}

export interface RodinConfig extends ProviderConfig {
    godotPluginPath?: string;
    defaultTextureResolution?: number;
}

export interface MeshyConfig extends ProviderConfig {
    enablePBR?: boolean;
    defaultMode?: 'preview' | 'relax';
}

export interface AllProviderConfigs {
    hunyuan?: HunyuanConfig;
    sloyd?: SloydConfig;
    masterpiece_x?: MasterpieceXConfig;
    tripo?: TripoConfig;
    rodin?: RodinConfig;
    meshy?: MeshyConfig;
}

// ============================================================================
// Provider-Specific Types
// ============================================================================

// Hunyuan 3D
export interface HunyuanResponse {
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

export interface SloydTemplate {
    id: string;
    name: string;
    category: string;
    style: string;
    thumbnail: string;
    parameters: SloydTemplateParameter[];
}

export interface SloydTemplateParameter {
    name: string;
    type: 'slider' | 'select' | 'toggle' | 'color';
    min?: number;
    max?: number;
    default: number | string | boolean;
    options?: string[];
}

// Masterpiece X
export interface MasterpieceXResponse {
    id: string;
    status: string;
    result?: {
        glb: string;
        thumbnail: string;
    };
}

// Tripo AI
export interface TripoResponse {
    code: number;
    data: {
        id: string;
        status: string;
        model_url?: string;
        thumbnail_url?: string;
    };
}

export interface TripoSegmentationData {
    parts: TripoPart[];
    total_polygons: number;
    total_vertices: number;
}

export interface TripoPart {
    name: string;
    polygon_count: number;
    vertex_count: number;
    material_index?: number;
    bounds?: {
        min: [number, number, number];
        max: [number, number, number];
    };
}

// Rodin Gen-2
export interface RodinResponse {
    task_id: string;
    status: string;
    model_url?: string;
}

export interface RodinTextureMaps {
    diffuse?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    ao?: string;
    curvature?: string;
}

// Meshy AI
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

// ============================================================================
// Cost and Pricing Types
// ============================================================================

export interface CostEstimate {
    provider: AssetProvider;
    estimatedCostUsd: number;
    currency: string;
    breakdown: CostBreakdown;
}

export interface CostBreakdown {
    generation: number;
    storage?: number;
    bandwidth?: number;
    processing?: number;
}

export interface ProviderPricing {
    provider: AssetProvider;
    pricingModel: 'per_generation' | 'subscription' | 'tiered';
    baseCostUsd: number;
    costs: {
        textTo3D: number;
        imageTo3D: number;
        environment: number;
        rigging: number;
        animation: number;
        textureBake: number;
    };
    freeTier?: {
        generationsPerMonth: number;
    };
}

export const PROVIDER_PRICING: Record<AssetProvider, ProviderPricing> = {
    hunyuan: {
        provider: 'hunyuan',
        pricingModel: 'per_generation',
        baseCostUsd: 0.10,
        costs: {
            textTo3D: 0.10,
            imageTo3D: 0.10,
            environment: 1.00,
            rigging: 0,
            animation: 0,
            textureBake: 0
        }
    },
    sloyd: {
        provider: 'sloyd',
        pricingModel: 'per_generation',
        baseCostUsd: 0.05,
        costs: {
            textTo3D: 0.05,
            imageTo3D: 0.05,
            environment: 0,
            rigging: 0,
            animation: 0,
            textureBake: 0
        },
        freeTier: { generationsPerMonth: 100 }
    },
    masterpiece_x: {
        provider: 'masterpiece_x',
        pricingModel: 'subscription',
        baseCostUsd: 0.05,
        costs: {
            textTo3D: 0.05,
            imageTo3D: 0.05,
            environment: 0,
            rigging: 0.02,
            animation: 0.03,
            textureBake: 0
        }
    },
    tripo: {
        provider: 'tripo',
        pricingModel: 'subscription',
        baseCostUsd: 0.08,
        costs: {
            textTo3D: 0.08,
            imageTo3D: 0.08,
            environment: 0,
            rigging: 0.05,
            animation: 0,
            textureBake: 0
        }
    },
    rodin: {
        provider: 'rodin',
        pricingModel: 'per_generation',
        baseCostUsd: 0.07,
        costs: {
            textTo3D: 0.07,
            imageTo3D: 0.07,
            environment: 0,
            rigging: 0,
            animation: 0,
            textureBake: 0.02
        }
    },
    meshy: {
        provider: 'meshy',
        pricingModel: 'per_generation',
        baseCostUsd: 0.06,
        costs: {
            textTo3D: 0.06,
            imageTo3D: 0.06,
            environment: 0,
            rigging: 0,
            animation: 0,
            textureBake: 0.01
        },
        freeTier: { generationsPerMonth: 50 }
    },
    cached: {
        provider: 'cached',
        pricingModel: 'per_generation',
        baseCostUsd: 0,
        costs: {
            textTo3D: 0,
            imageTo3D: 0,
            environment: 0,
            rigging: 0,
            animation: 0,
            textureBake: 0
        }
    }
};

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry {
    assetId: string;
    key: string;
    data: unknown;
    expiresAt: number;
    createdAt: number;
    accessCount: number;
    lastAccessedAt: number;
    provider: AssetProvider;
}

export interface CacheStats {
    totalEntries: number;
    totalSizeBytes: number;
    hitRate: number;
    evictionCount: number;
    providers: Record<AssetProvider, number>;
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
    provider: AssetProvider;
}

export interface QueueStats {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
    avgWaitTimeSeconds: number;
    avgProcessTimeSeconds: number;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings?: string[];
}

export interface ProviderCapabilities {
    textTo3D: boolean;
    imageTo3D: boolean;
    sketchTo3D: boolean;
    environmentGen: boolean;
    rigging: boolean;
    animation: boolean;
    textureBaking: boolean;
    meshOptimization: boolean;
    lodGeneration: boolean;
    godotPlugin: boolean;
    avgTimeSeconds: number;
}

export const PROVIDER_CAPABILITIES: Record<AssetProvider, ProviderCapabilities> = {
    hunyuan: {
        textTo3D: true,
        imageTo3D: true,
        sketchTo3D: true,
        environmentGen: true,
        rigging: false,
        animation: false,
        textureBaking: false,
        meshOptimization: false,
        lodGeneration: false,
        godotPlugin: false,
        avgTimeSeconds: 60
    },
    sloyd: {
        textTo3D: true,
        imageTo3D: false,
        sketchTo3D: false,
        environmentGen: false,
        rigging: false,
        animation: false,
        textureBaking: false,
        meshOptimization: false,
        lodGeneration: true,
        godotPlugin: false,
        avgTimeSeconds: 5
    },
    masterpiece_x: {
        textTo3D: true,
        imageTo3D: true,
        sketchTo3D: false,
        environmentGen: false,
        rigging: true,
        animation: true,
        textureBaking: false,
        meshOptimization: false,
        lodGeneration: false,
        godotPlugin: false,
        avgTimeSeconds: 120
    },
    tripo: {
        textTo3D: true,
        imageTo3D: true,
        sketchTo3D: false,
        environmentGen: false,
        rigging: true,
        animation: false,
        textureBaking: false,
        meshOptimization: false,
        lodGeneration: false,
        godotPlugin: false,
        avgTimeSeconds: 90
    },
    rodin: {
        textTo3D: true,
        imageTo3D: true,
        sketchTo3D: false,
        environmentGen: false,
        rigging: false,
        animation: false,
        textureBaking: true,
        meshOptimization: true,
        lodGeneration: false,
        godotPlugin: true,
        avgTimeSeconds: 45
    },
    meshy: {
        textTo3D: true,
        imageTo3D: true,
        sketchTo3D: false,
        environmentGen: false,
        rigging: false,
        animation: false,
        textureBaking: true,
        meshOptimization: true,
        lodGeneration: false,
        godotPlugin: false,
        avgTimeSeconds: 60
    },
    cached: {
        textTo3D: false,
        imageTo3D: false,
        sketchTo3D: false,
        environmentGen: false,
        rigging: false,
        animation: false,
        textureBaking: false,
        meshOptimization: false,
        lodGeneration: false,
        godotPlugin: false,
        avgTimeSeconds: 0
    }
};

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    errorCode?: string;
    requestId: string;
    timestamp: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface ProviderStatusResponse {
    provider: AssetProvider;
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

export interface Env {
    HUNYUAN_API_KEY?: string;
    SLOYD_API_KEY?: string;
    MASTERPIECE_X_API_KEY?: string;
    TRIPO_API_KEY?: string;
    RODIN_API_KEY?: string;
    MESHY_API_KEY?: string;
    ASSETS_BUCKET?: R2Bucket;
    CACHE?: KVNamespace;
    DB?: D1Database;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ProviderRequest<T = unknown> = T & {
    provider?: AssetProvider;
};

export type WithProvider<T, P extends AssetProvider> = T & { provider: P };
