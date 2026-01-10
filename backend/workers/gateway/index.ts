/**
 * API Gateway - Main Entry Point
 *
 * Cloudflare Worker for API gateway with routing, rate limiting,
 * transformation, and versioning.
 */

import { GatewayRouter, getDefaultRoutes, buildContext, buildGatewayRequest } from './router';
import { RateLimiter } from './rate-limiter';
import type { RouteConfig, GatewayRequest, GatewayResponse, Env } from './types';

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-Request-ID',
  'Access-Control-Expose-Headers': 'X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID',
};

// ============================================================================
// Gateway Class
// ============================================================================

class APIGateway {
  private router: GatewayRouter;
  private rateLimiter: RateLimiter;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.router = new GatewayRouter({
      default: 'v1',
      supported: ['v1', 'v2'],
      type: 'path',
    });
    this.rateLimiter = new RateLimiter(env.CACHE);

    // Register default routes
    this.router.addRoutes(getDefaultRoutes());
  }

  /**
   * Handle incoming request.
   */
  async handle(request: Request, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Build context
      const context = await buildContext(request, url, this.env);

      // Match route
      const match = this.router.matchRoute(request, url);

      if (!match.route) {
        return this.errorResponse('not_found', 'Route not found', context);
      }

      // Add route to context
      context.route = match.route;

      // Check authentication
      if (match.route.authRequired && !context.userId) {
        return this.errorResponse('authentication_failed', 'Authentication required', context);
      }

      // Check authorization
      if (match.route.scopes && context.scopes) {
        const hasScope = match.route.scopes.some(s => context.scopes?.includes(s));
        if (!hasScope) {
          return this.errorResponse('authorization_failed', 'Insufficient permissions', context);
        }
      }

      // Check rate limit
      if (match.route.rateLimit) {
        const rateLimitResult = await this.rateLimiter.check(context, match.route.rateLimit);

        context.rateLimit = {
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        };

        if (!rateLimitResult.allowed) {
          return this.errorResponse('rate_limit_exceeded', 'Rate limit exceeded', context, {
            retryAfter: rateLimitResult.retryAfter,
          });
        }
      }

      // Build gateway request
      const gatewayRequest = buildGatewayRequest(request, context, match);

      // Check cache
      if (match.route.cache && match.route.cache.methods?.includes(request.method)) {
        const cached = await this.getCachedResponse(gatewayRequest, match.route.cache);
        if (cached) {
          context.cache = { hit: true };
          return this.buildCachedResponse(cached, context);
        }
      }

      // Proxy to target
      const response = await this.proxyRequest(gatewayRequest, match.route);

      // Cache response if applicable
      if (match.route.cache && this.isCacheable(response)) {
        await this.cacheResponse(gatewayRequest, response, match.route.cache);
      }

      // Add gateway headers
      return this.buildResponse(response, context, Date.now() - startTime);

    } catch (error) {
      console.error('Gateway error:', error);

      const context: any = {
        requestId: crypto.randomUUID(),
        clientIp: request.headers.get('CF-Connecting-IP') || 'unknown',
        timestamp: new Date().toISOString(),
      };

      return this.errorResponse('internal_error', 'Internal server error', context);
    }
  }

  /**
   * Proxy request to target service.
   */
  private async proxyRequest(
    gatewayRequest: GatewayRequest,
    route: RouteConfig
  ): Promise<Response> {
    const { request, context, params } = gatewayRequest;

    // Build target URL
    let targetUrl = route.target;

    // Add path parameters
    for (const [key, value] of Object.entries(params)) {
      targetUrl = targetUrl.replace(`:${key}`, value);
    }

    // Add query string
    const queryString = gatewayRequest.query.toString();
    if (queryString) {
      targetUrl += `?${queryString}`;
    }

    // Transform request if configured
    let body = request.body;
    let headers = new Headers(request.headers);

    if (route.transformRequest) {
      const transform = route.transformRequest;

      // Add headers
      if (transform.headers?.add) {
        for (const [key, value] of Object.entries(transform.headers.add)) {
          // Replace template variables
          const resolvedValue = value
            .replace('{{requestId}}', context.requestId)
            .replace('{{tenantId}}', context.tenantId || '')
            .replace('{{userId}}', context.userId || '');
          headers.set(key, resolvedValue);
        }
      }

      // Remove headers
      if (transform.headers?.remove) {
        for (const key of transform.headers.remove) {
          headers.delete(key);
        }
      }

      // Rename headers
      if (transform.headers?.rename) {
        for (const [oldName, newName] of Object.entries(transform.headers.rename)) {
          const value = headers.get(oldName);
          if (value !== null) {
            headers.set(newName, value);
            headers.delete(oldName);
          }
        }
      }

      // Transform body
      if (transform.body && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
        const originalBody = await request.json().catch(() => ({}));
        let transformedBody = { ...originalBody };

        // Remove fields
        if (transform.body.remove) {
          for (const key of transform.body.remove) {
            delete transformedBody[key];
          }
        }

        // Rename fields
        if (transform.body.rename) {
          for (const [oldKey, newKey] of Object.entries(transform.body.rename)) {
            if (oldKey in transformedBody) {
              transformedBody[newKey] = transformedBody[oldKey];
              delete transformedBody[oldKey];
            }
          }
        }

        body = JSON.stringify(transformedBody);
        headers.set('Content-Type', 'application/json');
      }
    }

    // Add gateway headers
    headers.set('X-Forwarded-By', 'StudyLoG-Gateway');
    headers.set('X-Request-ID', context.requestId);

    // Create proxy request
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers,
      body,
      // @ts-ignore - Cloudflare specific
      cf: {
        ...request.cf,
      },
    });

    // Fetch with retry logic
    const retryConfig = route.retry || {
      maxAttempts: 1,
      initialBackoff: 100,
      backoffMultiplier: 2,
      retryOnStatus: [503, 504],
    };

    return this.fetchWithRetry(proxyRequest, retryConfig);
  }

  /**
   * Fetch with retry logic.
   */
  private async fetchWithRetry(
    request: Request,
    config: { maxAttempts: number; initialBackoff: number; backoffMultiplier: number; retryOnStatus: number[] }
  ): Promise<Response> {
    let lastError: Error | undefined;
    let backoff = config.initialBackoff;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
      try {
        const response = await fetch(request);

        // Don't retry on client errors or success
        if (response.status < 500 || !config.retryOnStatus.includes(response.status)) {
          return response;
        }

        // Retry on server error
        if (attempt < config.maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= config.backoffMultiplier;
        }

        return response;

      } catch (error) {
        lastError = error as Error;

        if (attempt < config.maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= config.backoffMultiplier;
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if response is cacheable.
   */
  private isCacheable(response: Response): boolean {
    return response.ok && response.status === 200;
  }

  /**
   * Get cached response.
   */
  private async getCachedResponse(
    request: GatewayRequest,
    config: { ttl: number; keyPattern?: string; varyBy?: string[] }
  ): Promise<CachedResponse | null> {
    const key = this.getCacheKey(request, config);
    const cached = await this.env.CACHE.get(key, 'json');

    return cached as CachedResponse | null;
  }

  /**
   * Cache response.
   */
  private async cacheResponse(
    request: GatewayRequest,
    response: Response,
    config: { ttl: number; keyPattern?: string; varyBy?: string[] }
  ): Promise<void> {
    const key = this.getCacheKey(request, config);

    const cloned = response.clone();
    const body = await cloned.text();
    const headers: Record<string, string> = {};

    cloned.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const cached: CachedResponse = {
      status: cloned.status,
      headers,
      body,
      cachedAt: Date.now(),
    };

    await this.env.CACHE.put(key, JSON.stringify(cached), {
      expirationTtl: config.ttl,
    });
  }

  /**
   * Get cache key for request.
   */
  private getCacheKey(
    request: GatewayRequest,
    config: { keyPattern?: string; varyBy?: string[] }
  ): string {
    const parts = ['cache', request.context.tenantId || 'default', request.request.method];

    // Add URL path
    parts.push(request.url.pathname);

    // Add vary headers
    if (config.varyBy) {
      for (const header of config.varyBy) {
        const value = request.request.headers.get(header);
        if (value) {
          parts.push(header, value);
        }
      }
    }

    return parts.join(':');
  }

  /**
   * Build response from cache.
   */
  private buildCachedResponse(cached: CachedResponse, context: any): Response {
    const headers = new Headers(cached.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cached-At', new Date(cached.cachedAt).toISOString());
    headers.set('X-Request-ID', context.requestId);

    return new Response(cached.body, {
      status: cached.status,
      headers,
    });
  }

  /**
   * Build gateway response.
   */
  private buildResponse(
    response: Response,
    context: any,
    responseTime: number
  ): Response {
    const headers = new Headers(response.headers);

    // Add gateway headers
    headers.set('X-Request-ID', context.requestId);
    headers.set('X-Response-Time', `${responseTime}ms`);
    headers.set('X-Cache', 'MISS');

    // Add rate limit headers
    if (context.rateLimit) {
      headers.set('X-RateLimit-Remaining', String(context.rateLimit.remaining));
      headers.set('X-RateLimit-Reset', String(context.rateLimit.reset));
    }

    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /**
   * Build error response.
   */
  private errorResponse(
    type: string,
    message: string,
    context: any,
    details?: Record<string, unknown>
  ): Response {
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    headers.set('X-Request-ID', context.requestId);

    const statusMap: Record<string, number> = {
      authentication_failed: 401,
      authorization_failed: 403,
      rate_limit_exceeded: 429,
      not_found: 404,
      bad_request: 400,
      service_unavailable: 503,
      timeout: 504,
      upstream_error: 502,
      internal_error: 500,
    };

    const status = statusMap[type] || 500;

    if (type === 'rate_limit_exceeded') {
      headers.set('Retry-After', String(details?.retryAfter || 60));
    }

    const body = {
      error: type,
      message,
      requestId: context.requestId,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      status,
      headers,
    });
  }
}

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  cachedAt: number;
}

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const gateway = new APIGateway(env);
    return gateway.handle(request, ctx);
  },
};
