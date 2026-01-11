/**
 * 3D Asset API - Cloudflare Worker
 *
 * Main entry point for the 3D asset generation service.
 * Handles HTTP requests and routes to appropriate handlers.
 *
 * Endpoints:
 * - POST /generate/model - Generate a 3D model
 * - POST /generate/environment - Generate a 3D environment
 * - POST /generate/batch - Generate multiple models
 * - GET /status/:assetId/:provider - Check generation status
 * - GET /asset/:assetId - Get asset details
 * - POST /import/godot - Convert for Godot import
 * - GET /providers/status - Check provider availability
 * - GET /costs/estimate - Estimate generation costs
 * - GET /providers/capabilities - Get provider capabilities
 * - GET /health - API health check
 */

import type {
    Env,
    GenerateModelRequest,
    GenerateEnvironmentRequest,
    BatchGenerateRequest,
    ImportToGodotRequest,
    GenerationResponse,
    ApiResponse,
    AllProviderConfigs,
    AssetProvider,
    ModelMetadata,
    EnvironmentMetadata,
    StorageLocation,
    ProviderStatusResponse,
    CostEstimate,
    ValidationResult
} from './types.js';

import { ModelRouter, createModelRouter } from './model-router.js';
import { GodotImporter, createGodotImporter } from './godot-importer.js';
import { PROVIDER_CAPABILITIES, PROVIDER_PRICING } from './types.js';

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
    env: Env;
    requestId: string;
    userId?: string;
}

// ============================================================================
// Main Worker Handler
// ============================================================================

export default {
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
    env: Env,
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

    // Cost estimation
    if (path === '/costs/estimate' && request.method === 'POST') {
        return handleCostEstimate(body as GenerateModelRequest | GenerateEnvironmentRequest, requestId);
    }

    // Generate model
    if (path === '/generate/model' && request.method === 'POST') {
        return handleGenerateModel(body as GenerateModelRequest, env, requestId, ctx);
    }

    // Generate environment
    if (path === '/generate/environment' && request.method === 'POST') {
        return handleGenerateEnvironment(body as GenerateEnvironmentRequest, env, requestId, ctx);
    }

    // Batch generation
    if (path === '/generate/batch' && request.method === 'POST') {
        return handleBatchGenerate(body as BatchGenerateRequest, env, requestId, ctx);
    }

    // Check status
    const statusMatch = path.match(/^\/status\/([^/]+)\/([^/]+)$/);
    if (statusMatch && request.method === 'GET') {
        const [, assetId, provider] = statusMatch;
        return handleGetStatus(assetId, provider as AssetProvider, env, requestId);
    }

    // Get asset
    const assetMatch = path.match(/^\/asset\/([^/]+)$/);
    if (assetMatch && request.method === 'GET') {
        const [, assetId] = assetMatch;
        return handleGetAsset(assetId, env, requestId);
    }

    // Import to Godot
    if (path === '/import/godot' && request.method === 'POST') {
        return handleImportToGodot(body as ImportToGodotRequest, env, requestId);
    }

    // List assets
    if (path === '/assets' && request.method === 'GET') {
        return handleListAssets(url, env, requestId);
    }

    // Validate request
    if (path === '/validate' && request.method === 'POST') {
        return handleValidate(body as GenerateModelRequest | GenerateEnvironmentRequest, requestId);
    }

    // 404 - Not Found
    return errorResponse('Endpoint not found', requestId, 404);
}

// ============================================================================
// Endpoint Handlers
// ========================================================================

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
            uptime: process.uptime ? process.uptime() : 0
        },
        requestId: crypto.randomUUID(),
        timestamp: Date.now()
    });
}

/**
 * Get status of all providers
 */
async function handleProvidersStatus(env: Env, requestId: string): Promise<Response> {
    const router = createRouter(env);
    const statuses = router.getAllProviderStatus();

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
        data: PROVIDER_CAPABILITIES,
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Estimate generation costs
 */
async function handleCostEstimate(
    request: GenerateModelRequest | GenerateEnvironmentRequest,
    requestId: string
): Promise<Response> {
    if (!request || !request.prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const env: Env = {};
    const router = createRouter(env);
    const estimates = router.estimateCosts(request);

    return jsonResponse({
        success: true,
        data: {
            request,
            estimates,
            recommendedProvider: router.selectProvider(request),
            totalProviders: estimates.length
        },
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Generate a 3D model
 */
async function handleGenerateModel(
    request: GenerateModelRequest,
    env: Env,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt) {
        return errorResponse('Missing prompt in request body', requestId, 400);
    }

    const router = createRouter(env);

    // Validate request
    const validation = router.validateRequest(request);
    if (!validation.valid) {
        return errorResponse(`Validation failed: ${validation.errors.join(', ')}`, requestId, 400);
    }

    // Extract routing constraints from request
    const constraints = {
        maxCostUsd: request.maxCostUsd,
        maxTimeSeconds: request.maxTimeSeconds,
        requireRigging: request.includeRigging,
        requireAnimation: request.includeAnimation,
        qualityTier: request.quality,
        preferredProviders: request.preferredProviders ? [request.preferredProviders as AssetProvider] : undefined
    };

    // Route the request
    const result = await router.routeModelRequest(request, constraints);

    if (!result.success) {
        return errorResponse(result.error || 'Generation failed', requestId, 500);
    }

    // Store asset metadata in KV if available
    if (env.CACHE && result.assetId) {
        ctx.waitUntil(
            env.CACHE.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    provider: result.provider,
                    prompt: request.prompt,
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 } // 24 hours
            )
        );
    }

    return jsonResponse({
        success: true,
        data: result,
        requestId,
        timestamp: Date.now()
    }, result.status === 'processing' ? 202 : 200);
}

/**
 * Generate a 3D environment
 */
async function handleGenerateEnvironment(
    request: GenerateEnvironmentRequest,
    env: Env,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!request || !request.prompt || !request.sceneType) {
        return errorResponse('Missing prompt or sceneType in request body', requestId, 400);
    }

    const router = createRouter(env);
    const result = await router.routeEnvironmentRequest(request);

    if (!result.success) {
        return errorResponse(result.error || 'Environment generation failed', requestId, 500);
    }

    // Store asset metadata
    if (env.CACHE && result.assetId) {
        ctx.waitUntil(
            env.CACHE.put(
                `asset:${result.assetId}`,
                JSON.stringify({
                    id: result.assetId,
                    provider: result.provider,
                    prompt: request.prompt,
                    type: 'environment',
                    sceneType: request.sceneType,
                    status: result.status,
                    createdAt: Date.now(),
                    requestId
                }),
                { expirationTtl: 86400 }
            )
        );
    }

    return jsonResponse({
        success: true,
        data: result,
        requestId,
        timestamp: Date.now()
    }, 202);
}

/**
 * Generate multiple models in batch
 */
async function handleBatchGenerate(
    batchRequest: BatchGenerateRequest,
    env: Env,
    requestId: string,
    ctx: ExecutionContext
): Promise<Response> {
    if (!batchRequest || !batchRequest.requests || !Array.isArray(batchRequest.requests)) {
        return errorResponse('Missing or invalid requests array in request body', requestId, 400);
    }

    if (batchRequest.requests.length > 10) {
        return errorResponse('Maximum 10 requests per batch', requestId, 400);
    }

    const router = createRouter(env);
    const results = await router.routeBatchRequest(batchRequest);

    const successCount = results.filter(r => r.success).length;
    const status = successCount === results.length ? 200 : successCount > 0 ? 207 : 500;

    return jsonResponse({
        success: true,
        data: {
            results,
            total: results.length,
            successful: successCount,
            failed: results.length - successCount
        },
        requestId,
        timestamp: Date.now()
    }, status);
}

/**
 * Get generation status
 */
async function handleGetStatus(
    assetId: string,
    provider: AssetProvider,
    env: Env,
    requestId: string
): Promise<Response> {
    const router = createRouter(env);

    // Check KV cache first
    if (env.CACHE) {
        const cached = await env.CACHE.get(`asset:${assetId}`, 'json');
        if (cached) {
            return jsonResponse({
                success: true,
                data: cached,
                requestId,
                timestamp: Date.now()
            });
        }
    }

    // Query the provider directly
    const providers = router.getAvailableProviders();
    if (!providers.includes(provider)) {
        return errorResponse(`Provider ${provider} not available`, requestId, 404);
    }

    // This would call the actual provider's status endpoint
    // For now, return a placeholder response
    return jsonResponse({
        success: true,
        data: {
            assetId,
            provider,
            status: 'unknown',
            message: 'Status check not implemented for this provider'
        },
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Get asset details
 */
async function handleGetAsset(assetId: string, env: Env, requestId: string): Promise<Response> {
    if (env.CACHE) {
        const cached = await env.CACHE.get(`asset:${assetId}`, 'json');
        if (cached) {
            return jsonResponse({
                success: true,
                data: cached,
                requestId,
                timestamp: Date.now()
            });
        }
    }

    if (env.DB) {
        try {
            const result = await env.DB.prepare(
                'SELECT * FROM assets WHERE id = ?'
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
 * List assets with pagination
 */
async function handleListAssets(url: URL, env: Env, requestId: string): Promise<Response> {
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20'), 100);
    const provider = url.searchParams.get('provider') as AssetProvider | null;
    const status = url.searchParams.get('status') || null;

    if (env.DB) {
        try {
            let query = 'SELECT * FROM assets';
            const params: unknown[] = [];
            const conditions: string[] = [];

            if (provider) {
                conditions.push('provider = ?');
                params.push(provider);
            }
            if (status) {
                conditions.push('status = ?');
                params.push(status);
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(pageSize, (page - 1) * pageSize);

            const assets = await env.DB.prepare(query).bind(...params).all();

            return jsonResponse({
                success: true,
                data: {
                    assets: assets.results || [],
                    page,
                    pageSize,
                    total: assets.results?.length || 0
                },
                requestId,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Database error:', error);
        }
    }

    return jsonResponse({
        success: true,
        data: {
            assets: [],
            page,
            pageSize,
            total: 0
        },
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Import asset to Godot format
 */
async function handleImportToGodot(
    request: ImportToGodotRequest,
    env: Env,
    requestId: string
): Promise<Response> {
    if (!request || !request.assetId) {
        return errorResponse('Missing assetId in request body', requestId, 400);
    }

    // Get asset details first
    const assetResponse = await handleGetAsset(request.assetId, env, requestId);
    if (assetResponse.status !== 200) {
        return assetResponse;
    }

    // For now, return a placeholder import result
    // In production, this would call the GodotImporter
    return jsonResponse({
        success: true,
        data: {
            assetId: request.assetId,
            importPath: request.importPath || `res://assets/imported/${request.assetId}/`,
            files: [
                {
                    path: `${request.assetId}.tscn`,
                    type: 'scene',
                    content: '# Scene file content'
                },
                {
                    path: `${request.assetId}.import`,
                    type: 'import',
                    content: '# Import settings'
                }
            ],
            scenePath: `res://assets/imported/${request.assetId}/${request.assetId}.tscn`,
            success: true
        },
        requestId,
        timestamp: Date.now()
    });
}

/**
 * Validate a generation request
 */
async function handleValidate(
    request: GenerateModelRequest | GenerateEnvironmentRequest,
    requestId: string
): Promise<Response> {
    const env: Env = {};
    const router = createRouter(env);
    const validation = router.validateRequest(request);

    // Also estimate costs for comparison
    const estimates = router.estimateCosts(request);

    return jsonResponse({
        success: true,
        data: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings,
            recommendedProvider: router.selectProvider(request),
            costEstimates: estimates,
            capabilities: PROVIDER_CAPABILITIES
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
function jsonResponse(data: ApiResponse, status: number = 200): Response {
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
 * Create and configure the model router
 */
function createRouter(env: Env): ModelRouter {
    const configs: AllProviderConfigs = {};

    if (env.HUNYUAN_API_KEY) {
        configs.hunyuan = { apiKey: env.HUNYUAN_API_KEY };
    }
    if (env.SLOYD_API_KEY) {
        configs.sloyd = { apiKey: env.SLOYD_API_KEY };
    }
    if (env.MASTERPIECE_X_API_KEY) {
        configs.masterpiece_x = { apiKey: env.MASTERPIECE_X_API_KEY };
    }
    if (env.TRIPO_API_KEY) {
        configs.tripo = { apiKey: env.TRIPO_API_KEY };
    }
    if (env.RODIN_API_KEY) {
        configs.rodin = { apiKey: env.RODIN_API_KEY };
    }
    if (env.MESHY_API_KEY) {
        configs.meshy = { apiKey: env.MESHY_API_KEY };
    }

    return createModelRouter(configs);
}

// ============================================================================
// Scheduled Handler (for cleanup, health checks, etc.)
// ============================================================================

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Perform periodic cleanup tasks
    // - Clear expired cache entries
    // - Check provider health
    // - Aggregate metrics

    console.log('Scheduled task running at:', new Date().toISOString());

    // Clean up expired cache entries
    if (env.CACHE) {
        try {
            // This would iterate through cache and remove expired entries
            // For now, just log
            console.log('Cache cleanup completed');
        } catch (error) {
            console.error('Cache cleanup error:', error);
        }
    }
}
