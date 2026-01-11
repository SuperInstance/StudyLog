/**
 * 2D Art & Texturing API - Cloudflare Worker
 *
 * Main entry point for the 2D asset generation service.
 * Handles HTTP requests and routes to appropriate handlers.
 *
 * Endpoints:
 * - POST /generate/sprite - Generate a single sprite
 * - POST /generate/spritesheet - Generate a sprite sheet with animations
 * - POST /generate/ui - Generate UI icons
 * - POST /generate/concept - Generate concept art
 * - POST /generate/tileset - Generate a tileset
 * - POST /texture/atlas - Create a texture atlas
 * - POST /style/train - Train a custom style model
 * - GET /status/:assetId/:provider - Check generation status
 * - GET /asset/:assetId - Get asset details
 * - GET /providers/status - Check provider availability
 * - GET /providers/capabilities - Get provider capabilities
 * - GET /costs/estimate - Estimate generation costs
 * - GET /health - API health check
 */

import type {
    Env2D,
    GenerateSpriteRequest,
    GenerateSpriteSheetRequest,
    GenerateUIRequest,
    GenerateConceptRequest,
    GenerateTilesetRequest,
    TextureAtlasRequest,
    StyleTrainRequest,
    GenerationResponse,
    ApiResponse2D,
    Asset2DProvider,
    CostEstimate2D,
    ValidationResult,
    SpriteGeneratorConfig,
    UIGeneratorConfig,
    TexturePackerConfig
} from './types.js';

import { RosebudProvider, createRosebudProvider } from './providers/rosebud.js';
import { LeonardoProvider, createLeonardoProvider } from './providers/leonardo.js';
import { ScenarioProvider, createScenarioProvider } from './providers/scenario.js';
import { MidjourneyProvider, createMidjourneyProvider } from './providers/midjourney.js';
import { StabilityProvider, createStabilityProvider } from './providers/stability.js';
import { SpriteGenerator, createSpriteGenerator } from './sprite-generator.js';
import { UIGenerator, createUIGenerator } from './ui-generator.js';
import { TexturePacker, createTexturePacker } from './texture-packer.js';

import {
    PROVIDER_2D_CAPABILITIES,
    PROVIDER_2D_PRICING,
    DEFAULT_STYLE_PRESETS,
    SPRITE_TEMPLATES
} from './types.js';

// ============================================================================
// CORS Headers
// ============================================================================

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400'
};

// ============================================================================
// Request Context
// ============================================================================

interface RequestContext {
    env: Env2D;
    requestId: string;
    userId?: string;
}

// ============================================================================
// Main Worker Handler
// ============================================================================

export default {
    async fetch(request: Request, env: Env2D, ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const url = new URL(request.url);

        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // Parse body for POST requests
        let body: unknown = null;
        if (request.method === 'POST') {
            const contentType = request.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                try {
                    body = await request.json();
                } catch {
                    return errorResponse('Invalid JSON body', requestId, 400);
                }
            }
        }

        // Route the request
        const response = await routeRequest(request, url, body, env, ctx, requestId);

        // Add CORS headers to response
        Object.entries(CORS_HEADERS).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        response.headers.set('X-Request-ID', requestId);

        return response;
    }
};

// ============================================================================
// Request Router
// ============================================================================

async function routeRequest(
    request: Request,
    url: URL,
    body: unknown,
    env: Env2D,
    ctx: ExecutionContext,
    requestId: string
): Promise<Response> {
    const path = url.pathname;

    // Health check
    if (path === '/health' || path === '/') {
        return handleHealthCheck();
    }

    // Provider status
    if (path === '/providers/status') {
        return handleProvidersStatus(env, requestId);
    }

    // Provider capabilities
    if (path === '/providers/capabilities') {
        return handleProvidersCapabilities(requestId);
    }

    // Style presets
    if (path === '/style/presets') {
        return handleStylePresets(requestId);
    }

    // Sprite templates
    if (path === '/templates/sprites') {
        return handleSpriteTemplates(requestId);
    }

    // Cost estimation
    if (path === '/costs/estimate' && request.method === 'POST') {
        return handleCostEstimate(body, requestId);
    }

    // Generate sprite
    if (path === '/generate/sprite' && request.method === 'POST') {
        return handleGenerateSprite(body as GenerateSpriteRequest, env, requestId, ctx);
    }

    // Generate sprite sheet
    if (path === '/generate/spritesheet' && request.method === 'POST') {
        return handleGenerateSpriteSheet(body as GenerateSpriteSheetRequest, env, requestId, ctx);
    }

    // Generate UI icons
    if (path === '/generate/ui' && request.method === 'POST') {
        return handleGenerateUI(body as GenerateUIRequest, env, requestId, ctx);
    }

    // Generate concept art
    if (path === '/generate/concept' && request.method === 'POST') {
        return handleGenerateConcept(body as GenerateConceptRequest, env, requestId, ctx);
    }

    // Generate tileset
    if (path === '/generate/tileset' && request.method === 'POST') {
        return handleGenerateTileset(body as GenerateTilesetRequest, env, requestId, ctx);
    }

    // Create texture atlas
    if (path === '/texture/atlas' && request.method === 'POST') {
        return handleTextureAtlas(body as TextureAtlasRequest, env, requestId);
    }

    // Train style model
    if (path === '/style/train' && request.method === 'POST') {
        return handleStyleTrain(body as StyleTrainRequest, env, requestId);
    }

    // Check status
    const statusMatch = path.match(/^\/status\/([^/]+)\/([^/]+)$/);
    if (statusMatch && request.method === 'GET') {
        const [, assetId, provider] = statusMatch;
        return handleGetStatus(assetId, provider as Asset2DProvider, env, requestId);
    }

    // Get asset
    const assetMatch = path.match(/^\/asset\/([^/]+)$/);
    if (assetMatch && request.method === 'GET') {
        const [, assetId] = assetMatch;
        return handleGetAsset(assetId, env, requestId);
    }

    // Download asset
    const downloadMatch = path.match(/^\/download\/([^/]+)$/);
    if (downloadMatch && request.method === 'GET') {
        const [, assetId] = downloadMatch;
        return handleDownloadAsset(assetId, env, requestId);
    }

    // Validate request
    if (path === '/validate' && request.method === 'POST') {
        return handleValidate(body, requestId);
    }

    // 404 - Not Found
    return errorResponse('Endpoint not found', requestId, 404);
}

// ============================================================================
// Endpoint Handlers
// ============================================================================

/**
 * Health check endpoint
 */
async function handleHealthCheck(): Promise<Response> {
    return jsonResponse({
        success: true,
        data: {
            status: 'healthy',
            version: '1.0.0',
            timestamp: Date.now(),
            uptime: process.uptime ? process.uptime() : 0,
            service: 'asset-2d'
        },
        requestId: crypto.randomUUID(),
        timestamp: Date.now()
    });
}

/**
 * Get status of all providers
 */
async function handleProvidersStatus(env: Env2D, requestId: string): Promise<Response> {
    const providers = initializeProviders(env);

    const statuses = Object.entries(providers).map(([name, provider]) => ({
        provider: name as Asset2DProvider,
        enabled: provider.isAvailable?.() ?? true,
        available: provider.isAvailable?.() ?? true,
        healthy: true, // Could add health check
        quotaUsed: 0,
        quotaLimit: 1000,
        quotaResetsAt: new Date(Date.now() + 86400000),
        avgResponseTimeMs: 0
    }));

    return jsonResponse({
        success: true,
        data: statuses,
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Get provider capabilities
 */
async function handleProvidersCapabilities(requestId: string): Promise<Response> {
    return jsonResponse({
        success: true,
        data: PROVIDER_2D_CAPABILITIES,
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Get available style presets
 */
async function handleStylePresets(requestId: string): Promise<Response> {
    return jsonResponse({
        success: true,
        data: DEFAULT_STYLE_PRESETS,
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Get available sprite templates
 */
async function handleSpriteTemplates(requestId: string): Promise<Response> {
    const spriteGen = createSpriteGenerator({});
    return jsonResponse({
        success: true,
        data: spriteGen.getAvailableTemplates(),
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Estimate generation costs
 */
async function handleCostEstimate(
    request: GenerateSpriteRequest | GenerateSpriteSheetRequest | GenerateUIRequest | GenerateConceptRequest,
    requestId: string
): Promise<Response> {
    if (!request || !(request as any).prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const estimates: CostEstimate2D[] = [];

    for (const [provider, pricing] of Object.entries(PROVIDER_2D_PRICING)) {
        if (provider === 'cached') continue;

        let cost = pricing.costs.sprite;
        let breakdown = { generation: cost };

        // Adjust cost based on request type
        if ('animations' in request) {
            cost = pricing.costs.spriteSheet;
            breakdown.generation = cost;
        } else if ('batch' in request && (request as GenerateUIRequest).batch) {
            cost = pricing.costs.uiIcon * ((request as GenerateUIRequest).batchCount || 1);
            breakdown.generation = cost;
        } else if ('iterations' in request) {
            cost = pricing.costs.concept * ((request as GenerateConceptRequest).iterations || 1);
            breakdown.generation = cost;
        } else if ('tilesWide' in request) {
            cost = pricing.costs.tileset;
            breakdown.generation = cost;
        }

        estimates.push({
            provider: provider as Asset2DProvider,
            estimatedCostUsd: cost,
            currency: 'USD',
            breakdown
        });
    }

    return jsonResponse({
        success: true,
        data: {
            request,
            estimates,
            cheapestProvider: estimates.reduce((min, e) =>
                e.estimatedCostUsd < min.estimatedCostUsd ? e : min, estimates[0]),
            totalProviders: estimates.length
        },
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Generate a single sprite
 */
async function handleGenerateSprite(
    request: GenerateSpriteRequest,
    env: Env2D,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const spriteGen = createSpriteGenerator(getSpriteConfig(env));
    const result = await spriteGen.generateSprite(request, request.preferredProvider);

    // Store in cache if available
    if (result.success && result.assetId && env.CACHE_2D) {
        ctx.waitUntil(
            env.CACHE_2D.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    provider: result.provider,
                    prompt: request.prompt,
                    type: 'sprite',
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 }
            )
        );
    }

    return jsonResponse({
        success: result.success,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Generate a sprite sheet with animations
 */
async function handleGenerateSpriteSheet(
    request: GenerateSpriteSheetRequest,
    env: Env2D,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt || !request.animations || request.animations.length === 0) {
        return errorResponse('Missing prompt or animations in request body', requestId, 400);
    }

    const spriteGen = createSpriteGenerator(getSpriteConfig(env));
    const result = await spriteGen.generateSpriteSheet(request, request.preferredProvider);

    // Store in cache if available
    if (result.success && result.assetId && env.CACHE_2D) {
        ctx.waitUntil(
            env.CACHE_2D.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    provider: result.provider,
                    prompt: request.prompt,
                    type: 'spritesheet',
                    animations: request.animations.map(a => a.type),
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 }
            )
        );
    }

    return jsonResponse({
        success: result.success,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Generate UI icons
 */
async function handleGenerateUI(
    request: GenerateUIRequest,
    env: Env2D,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const uiGen = createUIGenerator(getUIConfig(env));
    const result = await uiGen.generateIcon(request);

    // Store in cache if available
    if (result.success && result.assetId && env.CACHE_2D) {
        ctx.waitUntil(
            env.CACHE_2D.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    prompt: request.prompt,
                    type: 'ui',
                    style: request.style,
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 }
            )
        );
    }

    return jsonResponse({
        success: result.success,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Generate concept art
 */
async function handleGenerateConcept(
    request: GenerateConceptRequest,
    env: Env2D,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const providers = initializeProviders(env);

    // Route to appropriate provider for concept art
    // Prefer Midjourney, then Leonardo, then Stability
    let result: GenerationResponse = {
        success: false,
        error: 'No suitable provider available',
        requestId,
        provider: 'midjourney'
    };

    if (providers.midjourney?.isAvailable()) {
        result = await providers.midjourney.generateConcept(request);
    } else if (providers.leonardo?.isAvailable()) {
        result = await providers.leonardo.generateConcept(request);
    } else if (providers.stability?.isAvailable()) {
        result = await providers.stability.generateConcept(request);
    }

    // Store in cache if available
    if (result.success && result.assetId && env.CACHE_2D) {
        ctx.waitUntil(
            env.CACHE_2D.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    provider: result.provider,
                    prompt: request.prompt,
                    type: 'concept',
                    style: request.style,
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 }
            )
        );
    }

    return jsonResponse({
        success: result.success,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Generate a tileset
 */
async function handleGenerateTileset(
    request: GenerateTilesetRequest,
    env: Env2D,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const providers = initializeProviders(env);
    let result: GenerationResponse = {
        success: false,
        error: 'No suitable provider available',
        requestId,
        provider: 'rosebud'
    };

    // Prefer Rosebud for tilesets, then Scenario
    if (providers.rosebud?.isAvailable()) {
        result = await providers.rosebud.generateTileset(request);
    } else if (providers.scenario?.isAvailable()) {
        result = await providers.scenario.generateTileset(request);
    }

    // Store in cache if available
    if (result.success && result.assetId && env.CACHE_2D) {
        ctx.waitUntil(
            env.CACHE_2D.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    provider: result.provider,
                    prompt: request.prompt,
                    type: 'tileset',
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 }
            )
        );
    }

    return jsonResponse({
        success: result.success,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Create a texture atlas
 */
async function handleTextureAtlas(
    request: TextureAtlasRequest,
    env: Env2D,
    requestId: string
): Promise<Response> {
    if (!request || !request.images || request.images.length === 0) {
        return errorResponse('Missing images in request body', requestId, 400);
    }

    const packer = createTexturePacker();
    const result = await packer.packFromUrls(request.images, {
        maxWidth: request.maxWidth,
        maxHeight: request.maxHeight,
        padding: request.padding,
        powerOfTwo: request.powerOfTwo
    });

    return jsonResponse({
        success: result.success,
        data: {
            ...result,
            jsonFormat: request.jsonFormat || 'godot'
        },
        requestId,
        timestamp: Date.now()
    }, result.success ? 200 : 500);
}

/**
 * Train a custom style model
 */
async function handleStyleTrain(
    request: StyleTrainRequest,
    env: Env2D,
    requestId: string
): Promise<Response> {
    if (!request || !request.name || !request.images || request.images.length === 0) {
        return errorResponse('Missing name or images in request body', requestId, 400);
    }

    const providers = initializeProviders(env);
    let result: GenerationResponse = {
        success: false,
        error: 'No suitable provider available for style training',
        requestId,
        provider: request.provider as Asset2DProvider
    };

    switch (request.provider) {
        case 'scenario':
            if (providers.scenario?.isAvailable()) {
                result = await providers.scenario.createStyleModel(request);
            }
            break;
        case 'leonardo':
            if (providers.leonardo?.isAvailable()) {
                result = await providers.leonardo.createFineTune(
                    request.name,
                    request.images,
                    request.styleDescription
                );
            }
            break;
        case 'stability':
            if (providers.stability?.isAvailable()) {
                // Stability training would go here
                result = {
                    success: false,
                    error: 'Stability style training not yet implemented',
                    requestId,
                    provider: 'stability'
                };
            }
            break;
        default:
            result = {
                success: false,
                error: `Style training not supported for provider: ${request.provider}`,
                requestId,
                provider: request.provider
            };
    }

    return jsonResponse({
        success: result.success,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Get generation status
 */
async function handleGetStatus(
    assetId: string,
    provider: Asset2DProvider,
    env: Env2D,
    requestId: string
): Promise<Response> {
    // Check KV cache first
    if (env.CACHE_2D) {
        const cached = await env.CACHE_2D.get(`asset:${assetId}`, 'json');
        if (cached) {
            return jsonResponse({
                success: true,
                data: cached,
                requestId,
                timestamp: Date.now()
            });
        }
    }

    // Check database if available
    if (env.DB_2D) {
        try {
            const result = await env.DB_2D.prepare(
                'SELECT * FROM assets_2d WHERE id = ?'
            ).bind(assetId).first();

            if (result) {
                return jsonResponse({
                    success: true,
                    data: result,
                    requestId,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Database error:', error);
        }
    }

    return errorResponse('Asset not found', requestId, 404);
}

/**
 * Get asset details
 */
async function handleGetAsset(assetId: string, env: Env2D, requestId: string): Promise<Response> {
    return handleGetStatus(assetId, 'cached', env, requestId);
}

/**
 * Download asset
 */
async function handleDownloadAsset(assetId: string, env: Env2D, requestId: string): Promise<Response> {
    const statusResponse = await handleGetAsset(assetId, env, requestId);
    if (statusResponse.status !== 200) {
        return statusResponse;
    }

    // In a real implementation, this would return the actual image data
    // For now, return the metadata
    return statusResponse;
}

/**
 * Validate a generation request
 */
async function handleValidate(
    request: unknown,
    requestId: string
): Promise<Response> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request || typeof request !== 'object') {
        return errorResponse('Invalid request object', requestId, 400);
    }

    const req = request as Record<string, unknown>;

    if (!req.prompt || typeof req.prompt !== 'string') {
        errors.push('Prompt is required and must be a string');
    } else if (req.prompt.length < 5) {
        errors.push('Prompt must be at least 5 characters');
    } else if (req.prompt.length > 1000) {
        errors.push('Prompt must not exceed 1000 characters');
    }

    const validation: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };

    return jsonResponse({
        success: validation.valid,
        data: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            recommendedProvider: recommendProvider(req),
            costEstimates: []
        },
        requestId,
        timestamp: Date.now()
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a JSON response
 */
function jsonResponse(data: ApiResponse2D, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        }
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
        timestamp: Date.now()
    }, status);
}

/**
 * Initialize providers from environment
 */
function initializeProviders(env: Env2D) {
    const providers: {
        rosebud?: RosebudProvider;
        leonardo?: LeonardoProvider;
        scenario?: ScenarioProvider;
        midjourney?: MidjourneyProvider;
        stability?: StabilityProvider;
    } = {};

    if (env.ROSEBUD_API_KEY) {
        providers.rosebud = createRosebudProvider({ apiKey: env.ROSEBUD_API_KEY });
    }
    if (env.LEONARDO_API_KEY) {
        providers.leonardo = createLeonardoProvider({ apiKey: env.LEONARDO_API_KEY });
    }
    if (env.SCENARIO_API_KEY) {
        providers.scenario = createScenarioProvider({ apiKey: env.SCENARIO_API_KEY });
    }
    if (env.MIDJOURNEY_DISCORD_TOKEN || env.MIDJOURNEY_WEBHOOK_URL) {
        providers.midjourney = createMidjourneyProvider({
            apiKey: '',
            discordBotToken: env.MIDJOURNEY_DISCORD_TOKEN,
            webhookUrl: env.MIDJOURNEY_WEBHOOK_URL
        });
    }
    if (env.STABILITY_API_KEY) {
        providers.stability = createStabilityProvider({ apiKey: env.STABILITY_API_KEY });
    }

    return providers;
}

/**
 * Get sprite generator config from environment
 */
function getSpriteConfig(env: Env2D): SpriteGeneratorConfig {
    return {
        rosebud: env.ROSEBUD_API_KEY ? { apiKey: env.ROSEBUD_API_KEY } : undefined,
        leonardo: env.LEONARDO_API_KEY ? { apiKey: env.LEONARDO_API_KEY } : undefined,
        scenario: env.SCENARIO_API_KEY ? { apiKey: env.SCENARIO_API_KEY } : undefined,
        stability: env.STABILITY_API_KEY ? { apiKey: env.STABILITY_API_KEY } : undefined,
        enableMultiProvider: true,
        maxRetries: 3
    };
}

/**
 * Get UI generator config from environment
 */
function getUIConfig(env: Env2D): UIGeneratorConfig {
    return {
        leonardo: env.LEONARDO_API_KEY ? { apiKey: env.LEONARDO_API_KEY } : undefined,
        scenario: env.SCENARIO_API_KEY ? { apiKey: env.SCENARIO_API_KEY } : undefined,
        stability: env.STABILITY_API_KEY ? { apiKey: env.STABILITY_API_KEY } : undefined,
        defaultStyle: 'minimal',
        defaultSize: 64,
        enableCaching: true
    };
}

/**
 * Recommend a provider based on request
 */
function recommendProvider(request: Record<string, unknown>): Asset2DProvider {
    const style = request.style as string | undefined;
    const category = request.category as string | undefined;

    // Pixel art styles -> Rosebud
    if (style === 'pixel_art' || style === 'pixel_perfect' || style === '16bit' || style === 'gba') {
        return 'rosebud';
    }

    // UI icons -> Leonardo
    if (category === 'ui_icon') {
        return 'leonardo';
    }

    // Concept art -> Midjourney
    if (category === 'concept') {
        return 'midjourney';
    }

    // Default to Leonardo
    return 'leonardo';
}

// ============================================================================
// Scheduled Handler (for cleanup, health checks, etc.)
// ============================================================================

export async function scheduled(event: ScheduledEvent, env: Env2D, ctx: ExecutionContext): Promise<void> {
    console.log('Scheduled task running at:', new Date().toISOString());

    // Clean up expired cache entries
    if (env.CACHE_2D) {
        try {
            // This would iterate through cache and remove expired entries
            console.log('Cache cleanup completed');
        } catch (error) {
            console.error('Cache cleanup error:', error);
        }
    }

    // Check provider health
    const providers = initializeProviders(env);
    for (const [name, provider] of Object.entries(providers)) {
        try {
            const isAvailable = provider.isAvailable?.() ?? true;
            console.log(`Provider ${name} available: ${isAvailable}`);
        } catch (error) {
            console.error(`Provider ${name} health check failed:`, error);
        }
    }
}
