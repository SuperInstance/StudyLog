/**
 * Voxel AI Asset Integration Worker - Main Entry Point
 *
 * Cloudflare Worker that integrates voxel/AI asset stack for StudyLoG.AI and DMLoG.AI.
 *
 * Technologies Integrated:
 * - Zylann's Voxel Tools - Volumetric data access, terrain editing
 * - GDAI MCP Plugin - AI-assisted Godot development
 * - LimboAI - Behavior trees, state machines, blackboards
 * - Ollama Integration - Local LLM for NPC dialogue
 * - Meshy AI - Text-to-3D with Godot plugin
 * - Leonardo AI - Texture generation for voxels
 *
 * Endpoints:
 * - POST /generate/terrain - Generate voxel terrain
 * - POST /generate/model - Generate 3D model with Meshy
 * - POST /generate/texture - Generate texture with Leonardo
 * - POST /npc/dialogue - NPC dialogue with Ollama
 * - POST /npc/creator - AI Creator NPC requests
 * - GET /npc/:id - Get NPC character profile
 * - POST /gdai/scene - GDAI scene manipulation
 * - POST /gdai/script - GDAI script generation
 * - POST /limboai/state - Sync behavior tree state
 * - GET /biomes - List available biomes
 * - GET /health - Health check
 *
 * @packageDocumentation
 */

import type {
    Env,
    ApiResponse,
    VoxelTerrainRequest,
    MeshyGenerationRequest,
    LeonardoTextureRequest,
    NPCDialogueRequest,
    CreatorRequest,
    ProductContext,
} from './types.js';

// Import services
import {
    createVoxelGeneratorService,
    type VoxelGeneratorService,
} from './voxel-generator.js';

import {
    createMeshyService,
    type MeshyService,
} from './meshy-runtime.js';

import {
    createTextureService,
    type TextureService,
} from './leonardo-textures.js';

import {
    createNPCDialogueService,
    createNPCCharacterManager,
    type NPCDialogueService,
    type NPCCharacterManager,
} from './ollama-dialogue.js';

import {
    createGDAIClient,
    type GDAIService,
} from './gdai-mcp.js';

import {
    createLimboAIBridge,
    createLimboAITreeManager,
    type LimboAIBridgeClient,
    type LimboAITreeManager,
} from './limboai-bridge.js';

import {
    createAICreatorNPCManager,
    createStudyLogCreatorNPC,
    createDMLoGCreatorNPC,
    type AICreatorNPCManager,
} from './ai-creator-npc.js';

// ============================================================================
// CORS Headers
// ============================================================================

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400',
};

// ============================================================================
// Service Instances (created per request)
// ============================================================================

function createServices(env: Env) {
    return {
        voxelGenerator: createVoxelGeneratorService(env),
        meshy: env.MESHY_API_KEY ? createMeshyService(env) : null,
        texture: env.LEONARDO_API_KEY ? createTextureService(env) : null,
        dialogue: createNPCDialogueService(env),
        characterManager: createNPCCharacterManager(env),
        gdai: createGDAIClient(env),
        limboBridge: createLimboAIBridge(env),
        limboTreeManager: createLimboAITreeManager(env),
        creatorManager: createAICreatorNPCManager(env),
    };
}

// ============================================================================
// Main Worker Handler
// ============================================================================

export default {
    /**
     * Handle incoming HTTP requests
     */
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Parse body for POST requests
        let body: unknown = null;
        if (request.method === 'POST') {
            try {
                body = await request.json();
            } catch {
                // Invalid JSON
            }
        }

        // Route the request
        const response = await routeRequest(request, url, body, env, ctx, requestId);

        // Add CORS headers and request ID to response
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.headers.set('X-Request-ID', requestId);

        return response;
    },

    /**
     * Scheduled tasks (cron triggers)
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log('[VoxelAI] Scheduled task running at:', new Date().toISOString());

        // Clean up expired cache entries
        if (env.CACHE) {
            // Cache cleanup is automatic with expirationTtl
            console.log('[VoxelAI] Cache cleanup completed');
        }

        // Update service availability status
        const services = createServices(env);

        // Check Ollama availability
        const ollamaAvailable = await services.dialogue.init();
        console.log('[VoxelAI] Ollama available:', ollamaAvailable);
    },
};

// ============================================================================
// Request Router
// ============================================================================

async function routeRequest(
    request: Request,
    url: URL,
    body: unknown,
    env: Env,
    ctx: ExecutionContext,
    requestId: string
): Promise<Response> {
    const path = url.pathname;
    const services = createServices(env);

    // Health check
    if (path === '/health' || path === '/') {
        return handleHealthCheck(services, requestId);
    }

    // ============================================================================
    // Voxel Terrain Generation
    // ============================================================================

    if (path === '/generate/terrain' && request.method === 'POST') {
        return handleGenerateTerrain(body, services.voxelGenerator, requestId);
    }

    if (path === '/generate/script' && request.method === 'POST') {
        return handleGenerateScript(body, services.voxelGenerator, requestId);
    }

    // ============================================================================
    // 3D Model Generation (Meshy AI)
    // ============================================================================

    if (path === '/generate/model' && request.method === 'POST') {
        return handleGenerateModel(body, services.meshy, requestId);
    }

    if (path === '/generate/model/poll' && request.method === 'GET') {
        const taskId = url.searchParams.get('taskId');
        return handlePollModel(taskId, services.meshy, requestId);
    }

    // ============================================================================
    // Texture Generation (Leonardo AI)
    // ============================================================================

    if (path === '/generate/texture' && request.method === 'POST') {
        return handleGenerateTexture(body, services.texture, requestId);
    }

    if (path === '/generate/pbr-textures' && request.method === 'POST') {
        return handleGeneratePBRTextures(body, services.texture, requestId);
    }

    // ============================================================================
    // NPC Dialogue (Ollama)
    // ============================================================================

    if (path === '/npc/dialogue' && request.method === 'POST') {
        return handleNPCDialogue(body, services.dialogue, requestId);
    }

    if (path === '/npc/:id' && request.method === 'GET') {
        const npcId = path.split('/').pop();
        return handleGetNPC(npcId!, services.characterManager, requestId);
    }

    if (path.startsWith('/npc/') && path.endsWith('/dialogue') && request.method === 'POST') {
        const npcId = path.split('/')[2];
        return handleNPCDialogueById(npcId, body, services.dialogue, requestId);
    }

    // ============================================================================
    // AI Creator NPC
    // ============================================================================

    if (path === '/npc/creator/request' && request.method === 'POST') {
        return handleCreatorRequest(body, services.creatorManager, requestId);
    }

    if (path === '/npc/creator/:id/status' && request.method === 'GET') {
        const npcId = path.split('/')[3];
        return handleCreatorStatus(npcId!, services.creatorManager, requestId);
    }

    if (path === '/npc/creator/:id/task/:taskId' && request.method === 'GET') {
        const parts = path.split('/');
        const npcId = parts[3];
        const taskId = parts[5];
        return handleCreatorTaskStatus(npcId!, taskId!, services.creatorManager, requestId);
    }

    if (path === '/npc/creator/register' && request.method === 'POST') {
        return handleRegisterCreator(body, services.creatorManager, requestId);
    }

    // ============================================================================
    // GDAI MCP Plugin Integration
    // ============================================================================

    if (path === '/gdai/scene' && request.method === 'POST') {
        return handleGDAIScene(body, services.gdai, requestId);
    }

    if (path === '/gdai/script' && request.method === 'POST') {
        return handleGDAIScript(body, services.gdai, requestId);
    }

    // ============================================================================
    // LimboAI Integration
    // ============================================================================

    if (path === '/limboai/state' && request.method === 'POST') {
        return handleLimboAIState(body, services.limboBridge, requestId);
    }

    if (path === '/limboai/tree' && request.method === 'POST') {
        return handleLimboAITree(body, services.limboTreeManager, requestId);
    }

    // ============================================================================
    // Biome Information
    // ============================================================================

    if (path === '/biomes' && request.method === 'GET') {
        return handleListBiomes(url, services.voxelGenerator, requestId);
    }

    if (path.startsWith('/biomes/') && request.method === 'GET') {
        const biome = path.split('/')[2];
        return handleGetBiome(biome, services.voxelGenerator, requestId);
    }

    // ============================================================================
    // Product Context Specific
    // ============================================================================

    if (path === '/studylog/biomes' && request.method === 'GET') {
        return handleStudyLogBiomes(services.voxelGenerator, requestId);
    }

    if (path === '/dmlog/biomes' && request.method === 'GET') {
        return handleDMLoGBiomes(services.voxelGenerator, requestId);
    }

    // 404 - Not Found
    return jsonResponse({
        success: false,
        error: 'Endpoint not found',
        errorCode: '404',
        requestId,
        timestamp: Date.now(),
    }, 404);
}

// ============================================================================
// Handler Functions
// ============================================================================

/**
 * Health check endpoint
 */
async function handleHealthCheck(services: ReturnType<typeof createServices>, requestId: string): Promise<Response> {
    const health = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: Date.now(),
        services: {
            voxelGenerator: true,
            meshy: !!services.meshy,
            texture: !!services.texture,
            dialogue: true,
            gdai: true,
            limboai: true,
            creator: true,
        },
    };

    return jsonResponse({
        success: true,
        data: health,
        requestId,
        timestamp: Date.now(),
    });
}

/**
 * Generate voxel terrain
 */
async function handleGenerateTerrain(
    body: unknown,
    service: VoxelGeneratorService,
    requestId: string
): Promise<Response> {
    const request = body as VoxelTerrainRequest;

    if (!request) {
        return errorResponse('Missing request body', requestId, 400);
    }

    try {
        const result = await service.generateTerrain(request);
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Generation failed',
            requestId,
            500
        );
    }
}

/**
 * Generate VoxelGeneratorScript
 */
async function handleGenerateScript(
    body: unknown,
    service: VoxelGeneratorService,
    requestId: string
): Promise<Response> {
    const request = body as { biome: string; productContext: ProductContext };

    if (!request?.biome) {
        return errorResponse('Missing biome in request', requestId, 400);
    }

    try {
        const script = await service.generateScript(
            request.biome as any,
            request.productContext || 'general'
        );
        return jsonResponse({
            success: true,
            data: script,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Script generation failed',
            requestId,
            500
        );
    }
}

/**
 * Generate 3D model with Meshy
 */
async function handleGenerateModel(
    body: unknown,
    service: MeshyService | null,
    requestId: string
): Promise<Response> {
    if (!service) {
        return errorResponse('Meshy service not available (MESHY_API_KEY not configured)', requestId, 503);
    }

    const request = body as MeshyGenerationRequest & {
        importSettings?: {
            generateTangents?: boolean;
            generateNormals?: boolean;
            generateCollision?: boolean;
            voxelize?: boolean;
            voxelSize?: number;
        };
    };

    if (!request?.prompt) {
        return errorResponse('Missing prompt in request', requestId, 400);
    }

    try {
        const importSettings = request.importSettings || {
            generateTangents: true,
            generateNormals: true,
            generateCollision: true,
            voxelize: request.voxelStyle,
            voxelSize: 0.1,
        };

        const result = await service.generateAndImport(request, importSettings);
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Model generation failed',
            requestId,
            500
        );
    }
}

/**
 * Poll for model generation status
 */
async function handlePollModel(
    taskId: string | null,
    service: MeshyService | null,
    requestId: string
): Promise<Response> {
    if (!service) {
        return errorResponse('Meshy service not available', requestId, 503);
    }

    if (!taskId) {
        return errorResponse('Missing taskId parameter', requestId, 400);
    }

    try {
        const result = await service.pollAndImport(taskId, {
            generateTangents: true,
            generateNormals: true,
            generateCollision: true,
            scale: 1.0,
        });
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Poll failed',
            requestId,
            500
        );
    }
}

/**
 * Generate single texture
 */
async function handleGenerateTexture(
    body: unknown,
    service: TextureService | null,
    requestId: string
): Promise<Response> {
    if (!service) {
        return errorResponse('Texture service not available (LEONARDO_API_KEY not configured)', requestId, 503);
    }

    const request = body as LeonardoTextureRequest;

    if (!request?.prompt) {
        return errorResponse('Missing prompt in request', requestId, 400);
    }

    try {
        const result = await service.generateCustomTexture(
            request.prompt,
            request.productContext || 'general',
            request
        );
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Texture generation failed',
            requestId,
            500
        );
    }
}

/**
 * Generate PBR texture set
 */
async function handleGeneratePBRTextures(
    body: unknown,
    service: TextureService | null,
    requestId: string
): Promise<Response> {
    if (!service) {
        return errorResponse('Texture service not available', requestId, 503);
    }

    const request = body as { prompt: string; productContext: ProductContext };

    if (!request?.prompt) {
        return errorResponse('Missing prompt in request', requestId, 400);
    }

    try {
        const result = await (service as TextureService)['leonardo'].generatePBRTextureSet(
            request.prompt,
            '1024x1024',
            true
        );
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'PBR texture generation failed',
            requestId,
            500
        );
    }
}

/**
 * NPC dialogue endpoint
 */
async function handleNPCDialogue(
    body: unknown,
    service: NPCDialogueService,
    requestId: string
): Promise<Response> {
    const request = body as NPCDialogueRequest;

    if (!request?.characterId || !request?.playerMessage) {
        return errorResponse('Missing characterId or playerMessage', requestId, 400);
    }

    try {
        const result = await service.handleDialogue(request);
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Dialogue generation failed',
            requestId,
            500
        );
    }
}

/**
 * Get NPC character profile
 */
async function handleGetNPC(
    npcId: string,
    service: NPCCharacterManager,
    requestId: string
): Promise<Response> {
    try {
        const character = await service.getCharacter(npcId);

        if (!character) {
            return errorResponse('Character not found', requestId, 404);
        }

        return jsonResponse({
            success: true,
            data: character,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Failed to get character',
            requestId,
            500
        );
    }
}

/**
 * NPC dialogue by character ID (convenience endpoint)
 */
async function handleNPCDialogueById(
    npcId: string,
    body: unknown,
    service: NPCDialogueService,
    requestId: string
): Promise<Response> {
    const request = body as Omit<NPCDialogueRequest, 'characterId'>;

    if (!request?.playerMessage) {
        return errorResponse('Missing playerMessage', requestId, 400);
    }

    try {
        const result = await service.handleDialogue({
            ...request,
            characterId: npcId,
        });
        return jsonResponse({
            success: true,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Dialogue generation failed',
            requestId,
            500
        );
    }
}

/**
 * AI Creator NPC request
 */
async function handleCreatorRequest(
    body: unknown,
    service: AICreatorNPCManager,
    requestId: string
): Promise<Response> {
    const request = body as CreatorRequest;

    if (!request?.npcId || !request?.request) {
        return errorResponse('Missing npcId or request', requestId, 400);
    }

    try {
        const result = await service.processRequest(request);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Creator request failed',
            requestId,
            500
        );
    }
}

/**
 * Get AI Creator NPC status
 */
async function handleCreatorStatus(
    npcId: string,
    service: AICreatorNPCManager,
    requestId: string
): Promise<Response> {
    try {
        const state = service.getNPCState(npcId);

        if (!state) {
            return errorResponse('Creator NPC not found', requestId, 404);
        }

        return jsonResponse({
            success: true,
            data: state,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Failed to get creator status',
            requestId,
            500
        );
    }
}

/**
 * Get creator task status
 */
async function handleCreatorTaskStatus(
    npcId: string,
    taskId: string,
    service: AICreatorNPCManager,
    requestId: string
): Promise<Response> {
    try {
        const task = service.getTaskStatus(taskId);

        if (!task) {
            return errorResponse('Task not found', requestId, 404);
        }

        return jsonResponse({
            success: true,
            data: task,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Failed to get task status',
            requestId,
            500
        );
    }
}

/**
 * Register new AI Creator NPC
 */
async function handleRegisterCreator(
    body: unknown,
    service: AICreatorNPCManager,
    requestId: string
): Promise<Response> {
    const request = body as { productContext: ProductContext };

    try {
        let creator;
        if (request.productContext === 'studylog') {
            creator = createStudyLogCreatorNPC();
        } else if (request.productContext === 'dmlog') {
            creator = createDMLoGCreatorNPC();
        } else {
            return errorResponse('Invalid productContext. Use "studylog" or "dmlog"', requestId, 400);
        }

        const npcId = await service.registerCreator(creator);

        return jsonResponse({
            success: true,
            data: {
                npcId,
                creator,
            },
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Failed to register creator',
            requestId,
            500
        );
    }
}

/**
 * GDAI scene manipulation
 */
async function handleGDAIScene(
    body: unknown,
    service: GDAIService,
    requestId: string
): Promise<Response> {
    if (!body) {
        return errorResponse('Missing request body', requestId, 400);
    }

    try {
        const result = await service['client'].execute(body as any);
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'GDAI scene operation failed',
            requestId,
            500
        );
    }
}

/**
 * GDAI script generation
 */
async function handleGDAIScript(
    body: unknown,
    service: GDAIService,
    requestId: string
): Promise<Response> {
    const request = body as { scriptPath: string; prompt: string; baseClass?: string };

    if (!request?.scriptPath || !request?.prompt) {
        return errorResponse('Missing scriptPath or prompt', requestId, 400);
    }

    try {
        const result = await service.generateScript(
            request.scriptPath,
            request.prompt,
            request.baseClass || 'Node3D'
        );
        return jsonResponse({
            success: result.success,
            data: result,
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Script generation failed',
            requestId,
            500
        );
    }
}

/**
 * LimboAI state sync
 */
async function handleLimboAIState(
    body: unknown,
    service: LimboAIBridgeClient,
    requestId: string
): Promise<Response> {
    if (!body) {
        return errorResponse('Missing request body', requestId, 400);
    }

    try {
        await service.receiveStateUpdate(body as any);
        return jsonResponse({
            success: true,
            data: { message: 'State updated' },
            requestId,
            timestamp: Date.now(),
        });
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'State sync failed',
            requestId,
            500
        );
    }
}

/**
 * LimboAI tree management
 */
async function handleLimboAITree(
    body: unknown,
    service: LimboAITreeManager,
    requestId: string
): Promise<Response> {
    try {
        const request = body as { operation: 'create' | 'get' | 'update' | 'delete'; tree?: any };

        switch (request.operation) {
            case 'create':
                const treeId = await service.createTree(request.tree);
                return jsonResponse({
                    success: true,
                    data: { treeId },
                    requestId,
                    timestamp: Date.now(),
                });

            case 'get':
                const tree = await service.getTree(request.tree?.id);
                return jsonResponse({
                    success: true,
                    data: tree,
                    requestId,
                    timestamp: Date.now(),
                });

            case 'update':
                await service.updateTree(request.tree?.id, request.tree);
                return jsonResponse({
                    success: true,
                    data: { message: 'Tree updated' },
                    requestId,
                    timestamp: Date.now(),
                });

            case 'delete':
                await service.deleteTree(request.tree?.id);
                return jsonResponse({
                    success: true,
                    data: { message: 'Tree deleted' },
                    requestId,
                    timestamp: Date.now(),
                });

            default:
                return errorResponse('Invalid operation', requestId, 400);
        }
    } catch (error) {
        return errorResponse(
            error instanceof Error ? error.message : 'Tree operation failed',
            requestId,
            500
        );
    }
}

/**
 * List all biomes
 */
async function handleListBiomes(
    url: URL,
    service: VoxelGeneratorService,
    requestId: string
): Promise<Response> {
    const context = url.searchParams.get('context') as ProductContext | null;
    const biomes = context
        ? service.getBiomesByContext(context)
        : service.listBiomes();

    return jsonResponse({
        success: true,
        data: {
            biomes,
            context: context || 'all',
            count: biomes.length,
        },
        requestId,
        timestamp: Date.now(),
    });
}

/**
 * Get specific biome info
 */
async function handleGetBiome(
    biome: string,
    service: VoxelGeneratorService,
    requestId: string
): Promise<Response> {
    const biomeInfo = service.getBiomeInfo(biome as any);

    if (!biomeInfo) {
        return errorResponse('Biome not found', requestId, 404);
    }

    return jsonResponse({
        success: true,
        data: biomeInfo,
        requestId,
        timestamp: Date.now(),
    });
}

/**
 * StudyLoG.AI biomes
 */
async function handleStudyLogBiomes(
    service: VoxelGeneratorService,
    requestId: string
): Promise<Response> {
    const biomes = service.getBiomesByContext('studylog');

    return jsonResponse({
        success: true,
        data: {
            biomes,
            product: 'studylog',
            count: biomes.length,
        },
        requestId,
        timestamp: Date.now(),
    });
}

/**
 * DMLoG.AI biomes
 */
async function handleDMLoGBiomes(
    service: VoxelGeneratorService,
    requestId: string
): Promise<Response> {
    const biomes = service.getBiomesByContext('dmlog');

    return jsonResponse({
        success: true,
        data: {
            biomes,
            product: 'dmlog',
            count: biomes.length,
        },
        requestId,
        timestamp: Date.now(),
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a JSON response
 */
function jsonResponse(data: ApiResponse, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS,
        },
    });
}

/**
 * Create an error response
 */
function errorResponse(message: string, requestId: string, status: number = 500): Response {
    return jsonResponse({
        success: false,
        error: message,
        errorCode: status.toString(),
        requestId,
        timestamp: Date.now(),
    }, status);
}
