/**
 * Voxel AI Asset Integration Worker - Type Definitions
 *
 * Integrates voxel/AI asset stack for StudyLoG.AI and DMLoG.AI:
 * - Zylann's Voxel Tools - Volumetric data access, terrain editing
 * - GDAI MCP Plugin - AI-assisted Godot development
 * - LimboAI - Behavior trees, state machines, blackboards
 * - Ollama Integration - Local LLM for NPC dialogue
 * - Meshy AI - Text-to-3D with Godot plugin
 * - Leonardo AI - Texture generation for voxels
 *
 * @packageDocumentation
 */

// ============================================================================
// Product Context
// ============================================================================

export type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog' | 'general';

/**
 * Voxel terrain biomes for different product contexts
 */
export type VoxelBiome =
    // StudyLoG.AI biomes - Educational visualization
    | 'cognitive_mill'
    | 'intelligence_ranch'
    | 'sitka_sound'
    | 'digital_twins'
    | 'science_lab'
    | 'math_mountain'
    | 'physics_valley'
    // DMLoG.AI biomes - TTRPG environments
    | 'dungeon'
    | 'wilderness'
    | 'city'
    | 'underdark'
    | 'planar'
    | 'seafaring'
    | 'castle'
    // General biomes
    | 'plains'
    | 'forest'
    | 'desert'
    | 'tundra'
    | 'mountain'
    | 'swamp'
    | 'volcanic'
    | 'floating_island'
    | 'crystal_caves';

// ============================================================================
// Voxel Types (Zylann's Voxel Tools)
// ============================================================================

/**
 * Voxel data structure matching Zylann's VoxelBuffer format
 */
export interface VoxelBuffer {
    /**
     * Channel data for the voxel buffer
     * Each channel contains raw voxel data
     */
    channels: VoxelChannel[];
    /**
     * Buffer dimensions in voxels
     */
    size: Vector3i;
    /**
     * Position in world space
     */
    position: Vector3;
    /**
     * Voxel storage format
     */
    format: VoxelFormat;
}

/**
 * Individual voxel data channels
 */
export interface VoxelChannel {
    /**
     * Channel type (color, type, density, etc.)
     */
    type: VoxelChannelType;
    /**
     * Raw channel data (compressed or uncompressed)
     */
    data: Uint8Array;
    /**
     * Channel depth in bits
     */
    depth: 8 | 16;
    /**
     * Whether data is compressed
     */
    compressed: boolean;
}

/**
 * Supported voxel channel types from Zylann's VoxelTools
 */
export type VoxelChannelType =
    | 'color'        // RGB color data
    | 'type'         // Voxel type ID
    | 'density'      // Density/isolevel
    | 'height'       // Heightmap data
    | 'normal'       // Normal vectors
    | 'sdf';         // Signed distance field

/**
 * Voxel storage format
 */
export type VoxelFormat =
    | 'uint8'        // 8-bit unsigned integers
    | 'uint16'       // 16-bit unsigned integers
    | 'float';       // 32-bit floats (for SDF)

/**
 * Integer 3D vector
 */
export interface Vector3i {
    x: number;
    y: number;
    z: number;
}

/**
 * Float 3D vector
 */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Voxel block types for blocky voxel models
 */
export interface VoxelBlockType {
    id: number;
    name: string;
    category: VoxelCategory;
    material: VoxelMaterial;
    transparent: boolean;
    solid: boolean;
    rotateX: boolean;
    rotateY: boolean;
    rotateZ: boolean;
    scale: Vector3;
    translation: Vector3;
}

/**
 * Voxel material categories
 */
export type VoxelCategory =
    | 'terrain'
    | 'stone'
    | 'wood'
    | 'metal'
    | 'organic'
    | 'liquid'
    | 'glass'
    | 'foliage'
    | 'manufactured'
    | 'magical';

/**
 * Voxel material properties
 */
export interface VoxelMaterial {
    /**
     * Base color texture
     */
    albedo?: string;
    /**
     * Normal map texture
     */
    normal?: string;
    /**
     * Roughness value (0-1)
     */
    roughness?: number;
    /**
     * Metallic value (0-1)
     */
    metallic?: number;
    /**
     * Emission color
     */
    emission?: string;
    /**
     * UV scale for tiling
     */
    uvScale?: Vector2;
}

/**
 * 2D vector for UV coordinates
 */
export interface Vector2 {
    x: number;
    y: number;
}

// ============================================================================
// GDAI MCP Plugin Types
// ============================================================================

/**
 * MCP (Model Context Protocol) tool definition for GDAI
 */
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: string;
}

/**
 * MCP resource definition
 */
export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

/**
 * GDAI scene manipulation request
 */
export interface GDAISceneRequest {
    /**
     * Type of scene operation
     */
    operation: GDAIOperationType;
    /**
     * Target scene path
     */
    scenePath: string;
    /**
     * Node manipulation data
     */
    nodes?: GDAINodeData[];
    /**
     * Script generation prompt
     */
    scriptPrompt?: string;
    /**
     * Resource references
     */
    resources?: string[];
}

/**
 * GDAI operation types
 */
export type GDAIOperationType =
    | 'create_scene'
    | 'modify_scene'
    | 'create_node'
    | 'delete_node'
    | 'modify_node'
    | 'generate_script'
    | 'attach_script'
    | 'query_scene'
    | 'debug_scene'
    | 'hot_reload';

/**
 * Node data for scene manipulation
 */
export interface GDAINodeData {
    name: string;
    type: string;
    parent?: string;
    properties?: Record<string, unknown>;
    transform?: GDScriptTransform;
    children?: GDAINodeData[];
}

/**
 * Transform matching Godot's Transform3D
 */
export interface GDScriptTransform {
    origin: Vector3;
    basis: {
        x: Vector3;
        y: Vector3;
        z: Vector3;
    };
}

/**
 * GDAI response wrapper
 */
export interface GDAIResponse {
    success: boolean;
    operation: GDAIOperationType;
    result?: unknown;
    error?: string;
    logs?: string[];
    modifiedFiles?: string[];
}

// ============================================================================
// LimboAI Behavior Tree Types
// ============================================================================

/**
 * LimboAI behavior tree node types
 */
export type LimboNodeType =
    | 'selector'
    | 'sequence'
    | 'parallel'
    | 'decorator'
    | 'action'
    | 'condition'
    | 'subtree';

/**
 * Behavior tree definition
 */
export interface BehaviorTree {
    id: string;
    name: string;
    description?: string;
    rootNode: LimboNode;
    blackboard?: BlackboardDefinition;
    variables?: Record<string, BehaviorVariable>;
}

/**
 * LimboAI behavior tree node
 */
export interface LimboNode {
    id: string;
    type: LimboNodeType;
    name: string;
    children?: LimboNode[];
    decorator?: LimboDecorator;
    action?: LimboAction;
    condition?: LimboCondition;
    comment?: string;
}

/**
 * LimboAI decorator that wraps child nodes
 */
export interface LimboDecorator {
    type:
        | 'invert'
        | 'repeat'
        | 'retry'
        | 'timeout'
        | 'cooldown'
        | 'always_succeed'
        | 'always_fail';
    config?: Record<string, unknown>;
}

/**
 * LimboAI action node (leaf node)
 */
export interface LimboAction {
    script: string;
    params?: Record<string, unknown>;
}

/**
 * LimboAI condition node
 */
export interface LimboCondition {
    script: string;
    params?: Record<string, unknown>;
}

/**
 * Blackboard variable definition
 */
export interface BlackboardDefinition {
    variables: Record<string, BlackboardVariable>;
}

/**
 * Single blackboard variable
 */
export interface BlackboardVariable {
    type: 'bool' | 'int' | 'float' | 'string' | 'vector3' | 'object';
    defaultValue: unknown;
    exported: boolean;
    description?: string;
}

/**
 * Behavior variable for runtime state
 */
export interface BehaviorVariable {
    name: string;
    value: unknown;
    type: string;
    lastModified: number;
}

/**
 * Behavior tree execution state for sync
 */
export interface BehaviorTreeState {
    treeId: string;
    agentId: string;
    currentNodeId: string;
    status: 'running' | 'success' | 'failure';
    blackboard: Record<string, unknown>;
    lastTick: number;
    tickCount: number;
}

// ============================================================================
// Ollama Integration Types
// ============================================================================

/**
 * Ollama model configuration
 */
export interface OllamaModel {
    name: string;
    model: string;
    /**
     * Model size in parameters
     */
    size: '1b' | '3b' | '7b' | '14b' | '32b' | '70b';
    contextWindow: number;
    /**
     * Whether this is a reasoning model
     */
    reasoning: boolean;
    recommended: boolean;
}

/**
 * Ollama chat request
 */
export interface OllamaChatRequest {
    model: string;
    messages: OllamaMessage[];
    stream?: boolean;
    options?: OllamaOptions;
    format?: 'json' | '';
}

/**
 * Ollama message format
 */
export interface OllamaMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    images?: string[];
}

/**
 * Ollama generation options
 */
export interface OllamaOptions {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    repeat_penalty?: number;
    seed?: number;
}

/**
 * Ollama chat response
 */
export interface OllamaChatResponse {
    model: string;
    created_at: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

/**
 * NPC character profile for dialogue
 */
export interface NPCCharacterProfile {
    id: string;
    name: string;
    description: string;
    personality: string[];
    backstory: string;
    knowledge: string[];
    relationships: Record<string, string>;
    dialogueStyle: 'formal' | 'casual' | 'archaic' | 'slang' | 'technical' | 'mystical';
    productContext: ProductContext;
    systemPrompt: string;
    model: string;
    ollamaEndpoint?: string;
}

/**
 * Context injection for NPC dialogue
 */
export interface NPCDialogueContext {
    location: string;
    nearbyEntities: string[];
    currentActivity: string;
    timeOfDay: string;
    weather?: string;
    questState?: Record<string, unknown>;
    playerRelationship?: number;
    recentTopics?: string[];
}

/**
 * NPC dialogue request with full context
 */
export interface NPCDialogueRequest {
    characterId: string;
    playerMessage: string;
    context: NPCDialogueContext;
    conversationHistory?: OllamaMessage[];
    maxTokens?: number;
}

/**
 * NPC dialogue response
 */
export interface NPCDialogueResponse {
    characterId: string;
    message: string;
    emotion: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised' | 'disgusted';
    actionHint?: string;
    topics: string[];
    modelUsed: string;
    tokensUsed: number;
    latencyMs: number;
}

// ============================================================================
// Voxel Generator Types (VoxelGeneratorScript)
// ============================================================================

/**
 * Custom voxel generator script (extends VoxelGeneratorScript)
 */
export interface VoxelGeneratorScript {
    name: string;
    description: string;
    biome: VoxelBiome;
    script: string;
    /**
     * Generator parameters exposed to editor
     */
    parameters: VoxelGeneratorParameter[];
    /**
     * Required voxel channel types
     */
    channels: VoxelChannelType[];
    /**
     * Expected chunk size
     */
    chunkSize: Vector3i;
}

/**
 * Generator parameter for runtime customization
 */
export interface VoxelGeneratorParameter {
    name: string;
    type: 'int' | 'float' | 'enum' | 'bool' | 'color';
    defaultValue: unknown;
    min?: number;
    max?: number;
    step?: number;
    enumOptions?: string[];
    description?: string;
}

/**
 * Voxel terrain generation request
 */
export interface VoxelTerrainRequest {
    /**
     * Generator to use
     */
    generatorId: string;
    /**
     * World position to generate
     */
    position: Vector3i;
    /**
     * Chunk size
     */
    chunkSize: Vector3i;
    /**
     * Generator parameters override
     */
    parameters?: Record<string, unknown>;
    /**
     * Seed for procedural generation
     */
    seed?: number;
    /**
     * LOD level (0 = full detail)
     */
    lod: number;
}

/**
 * Generated voxel data response
 */
export interface VoxelTerrainResponse {
    position: Vector3i;
    size: Vector3i;
    channels: VoxelChannel[];
    generatorUsed: string;
    seed: number;
    lod: number;
    voxelCount: number;
    isEmpty: boolean;
}

/**
 * AI-generated biome description
 */
export interface BiomeDescription {
    name: string;
    description: string;
    features: string[];
    colors: {
        primary: string;
        secondary: string;
        accent: string;
    };
    voxelTypes: string[];
    structures: string[];
    atmosphere: string;
    generatedBy: 'ai' | 'template' | 'custom';
}

// ============================================================================
// Meshy AI Integration Types
// ============================================================================

/**
 * Meshy AI generation request
 */
export interface MeshyGenerationRequest {
    prompt: string;
    negativePrompt?: string;
    /**
     * Image reference for image-to-3D
     */
    referenceImage?: string;
    /**
     * Generate as voxel-style model
     */
    voxelStyle: boolean;
    /**
     * Target format
     */
    format: 'glb' | 'obj' | 'fbx' | 'vox';
    quality: 'draft' | 'preview' | 'standard';
    /**
     * For voxel models, voxel size in world units
     */
    voxelSize?: number;
    productContext: ProductContext;
}

/**
 * Meshy generation response
 */
export interface MeshyGenerationResponse {
    taskId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    modelUrl?: string;
    thumbnailUrl?: string;
    voxelData?: VoxelBuffer;
    metadata?: MeshyMetadata;
}

/**
 * Meshy generation metadata
 */
export interface MeshyMetadata {
    format: string;
    vertexCount: number;
    triangleCount: number;
    voxelCount?: number;
    textureCount: number;
    fileSizeBytes: number;
    generationTimeSeconds: number;
}

/**
 * Runtime 3D model import request for Godot
 */
export interface RuntimeImportRequest {
    /**
     * URL to the model file
     */
    modelUrl: string;
    /**
     * Import path in Godot project
     */
    importPath: string;
    /**
     * Target scene path
     */
    scenePath: string;
    /**
     * Parent node to attach to
     */
    parentNode?: string;
    /**
     * Transform to apply
     */
    transform?: GDScriptTransform;
    /**
     * Import settings
     */
    settings: RuntimeImportSettings;
}

/**
 * Runtime import settings
 */
export interface RuntimeImportSettings {
    generateTangents: boolean;
    generateNormals: boolean;
    importAsSkeleton: boolean;
    generateCollision: boolean;
    scale: number;
    voxelize?: boolean;
    voxelSize?: number;
}

/**
 * Runtime import response
 */
export interface RuntimeImportResponse {
    success: boolean;
    scenePath: string;
    nodeId: string;
    voxelized: boolean;
    importErrors?: string[];
}

// ============================================================================
// Leonardo AI Texture Generation Types
// ============================================================================

/**
 * Leonardo AI texture generation request
 */
export interface LeonardoTextureRequest {
    prompt: string;
    negativePrompt?: string;
    /**
     * Texture dimensions
     */
    size: '256x256' | '512x512' | '1024x1024' | '2048x2048';
    /**
     * Number of texture variations
     */
    count: number;
    /**
     * Texture type
     */
    textureType: LeonardoTextureType;
    /**
     * For seamless tileable textures
     */
    seamless: boolean;
    /**
     * Style preset
     */
    style?: string;
    /**
     * Color palette hints
     */
    colors?: string[];
    productContext: ProductContext;
}

/**
 * Leonardo texture types
 */
export type LeonardoTextureType =
    | 'albedo'
    | 'normal'
    | 'roughness'
    | 'metallic'
    | 'emission'
    | 'height'
    | 'ambient_occlusion'
    | 'diffuse'
    | 'cube_map'
    | 'voxel_tile';

/**
 * Leonardo texture generation response
 */
export interface LeonardoTextureResponse {
    textureId: string;
    url: string;
    type: LeonardoTextureType;
    size: string;
    seamless: boolean;
    format: 'png' | 'jpg';
    metadata: {
        generationId: string;
        modelUsed: string;
        seed: number;
    };
}

/**
 * Complete PBR texture set
 */
export interface PBRTextureSet {
    id: string;
    name: string;
    albedo?: string;
    normal?: string;
    roughness?: string;
    metallic?: string;
    ambientOcclusion?: string;
    height?: string;
    emission?: string;
    /**
     * Whether textures are seamless
     */
    seamless: boolean;
    /**
     * Base resolution
     */
    resolution: string;
}

/**
 * Apply texture to voxel block type request
 */
export interface ApplyVoxelTextureRequest {
    blockTypeId: number;
    textureSet: PBRTextureSet;
    uvScale?: Vector2;
    material?: VoxelMaterial;
}

// ============================================================================
// AI Creator NPC Types
// ============================================================================

/**
 * AI Creator NPC - An NPC that can build assets during gameplay
 */
export interface AICreatorNPC {
    id: string;
    name: string;
    description: string;
    /**
     * NPC's character profile for dialogue
     */
    character: NPCCharacterProfile;
    /**
     * Behavior tree for asset creation workflow
     */
    behaviorTree: BehaviorTree;
    /**
     * Capabilities of this creator NPC
     */
    capabilities: CreatorCapabilities;
    /**
     * Current state
     */
    state: AICreatorState;
}

/**
 * Creator NPC capabilities
 */
export interface CreatorCapabilities {
    canGenerateModels: boolean;
    canGenerateTextures: boolean;
    canGenerateTerrain: boolean;
    canGenerateScenes: boolean;
    canModifyExisting: boolean;
    maxComplexity: number;
    supportedStyles: string[];
    costPerAction: number;
}

/**
 * Creator NPC current state
 */
export interface AICreatorState {
    status: 'idle' | 'thinking' | 'creating' | 'error';
    currentTask?: CreatorTask;
    progress: number;
    lastActivity: number;
    inventory: Record<string, number>;
}

/**
 * Asset creation task for the AI Creator NPC
 */
export interface CreatorTask {
    id: string;
    type: 'model' | 'texture' | 'terrain' | 'scene' | 'script';
    prompt: string;
    requesterId: string;
    priority: number;
    constraints: CreatorConstraints;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
}

/**
 * Creation constraints
 */
export interface CreatorConstraints {
    maxCostUsd?: number;
    maxTimeSeconds?: number;
    voxelStyle?: boolean;
    qualityTier?: 'draft' | 'preview' | 'standard' | 'high';
    style?: string;
    colorPalette?: string[];
    sizeLimit?: number;
}

/**
 * Player request to AI Creator NPC
 */
export interface CreatorRequest {
    npcId: string;
    playerId: string;
    request: string;
    type?: 'model' | 'texture' | 'terrain' | 'scene' | 'auto';
    constraints?: Partial<CreatorConstraints>;
    context?: {
        location: Vector3;
        nearbyObjects?: string[];
        currentBiome?: VoxelBiome;
    };
}

/**
 * AI Creator NPC response
 */
export interface CreatorResponse {
    success: boolean;
    taskId: string;
    estimatedTimeSeconds?: number;
    estimatedCostUsd?: number;
    message?: string;
    dialogue?: NPCDialogueResponse;
}

// ============================================================================
// Godot Bridge Communication Types
// ============================================================================

/**
 * WebSocket message from Godot to backend
 */
export interface GodotToBackendMessage {
    type: GodotMessageType;
    requestId: string;
    payload: unknown;
    timestamp: number;
}

/**
 * WebSocket message from backend to Godot
 */
export interface BackendToGodotMessage {
    type: GodotMessageType;
    requestId: string;
    success: boolean;
    payload?: unknown;
    error?: string;
    timestamp: number;
}

/**
 * Message types for Godot-backend communication
 */
export type GodotMessageType =
    | 'ping'
    | 'pong'
    | 'generate_terrain'
    | 'generate_model'
    | 'generate_texture'
    | 'npc_dialogue'
    | 'hot_reload_asset'
    | 'create_scene'
    | 'modify_scene'
    | 'behavior_tree_sync'
    | 'blackboard_update'
    | 'creator_request'
    | 'voxel_edit';

/**
 * Voxel edit operation (runtime terrain editing)
 */
export interface VoxelEditOperation {
    position: Vector3i;
    radius: number;
    shape: 'sphere' | 'cube' | 'cylinder';
    mode: 'add' | 'remove' | 'replace';
    voxelType?: number;
    strength?: number;
}

/**
 * Hot reload asset message
 */
export interface HotReloadAsset {
    assetType: 'scene' | 'script' | 'texture' | 'model' | 'voxel_data';
    assetPath: string;
    data?: string | Uint8Array;
    importSettings?: Record<string, unknown>;
}

// ============================================================================
// Cloudflare Worker Environment
// ============================================================================

/**
 * Environment variables for the voxel-ai worker
 */
export interface Env {
    // Ollama local LLM
    OLLAMA_ENDPOINT?: string;
    OLLAMA_DEFAULT_MODEL?: string;

    // Meshy AI
    MESHY_API_KEY?: string;

    // Leonardo AI
    LEONARDO_API_KEY?: string;

    // Storage
    ASSETS_BUCKET?: R2Bucket;
    CACHE?: KVNamespace;

    // Database
    DB?: D1Database;

    // Godot bridge
    GODOT_BRIDGE_URL?: string;
    GODOT_BRIDGE_PORT?: number;

    // Multi-model router for complex generation
    MULTI_MODEL_ROUTER_URL?: string;

    // Rate limiting
    RATE_LIMIT_REQUESTS?: string;
    RATE_LIMIT_WINDOW?: string;

    // Environment
    ENVIRONMENT?: string;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    errorCode?: string;
    requestId: string;
    timestamp: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

// ============================================================================
// Cost Tracking
// ============================================================================

/**
 * Cost entry for AI asset generation
 */
export interface VoxelCostEntry {
    userId: string;
    productContext: ProductContext;
    operation: string;
    provider: string;
    costUsd: number;
    tokensUsed?: number;
    generationTimeMs: number;
    timestamp: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type for optional nested objects
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
    | { success: true; data: T }
    | { success: false; error: E };
