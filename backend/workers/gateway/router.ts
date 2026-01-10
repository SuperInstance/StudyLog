/**
 * API Gateway Router
 *
 * Request routing with support for:
 * - Path matching with wildcards
 * - HTTP method filtering
 * - API versioning
 * - Tenant context routing
 */

import type {
  RouteConfig,
  GatewayRequest,
  GatewayContext,
  ApiVersionConfig,
} from './types';

// ============================================================================
// Router Class
// ============================================================================

export class GatewayRouter {
  private routes: RouteConfig[] = [];
  private versionConfig: ApiVersionConfig;

  constructor(versionConfig?: Partial<ApiVersionConfig>) {
    this.versionConfig = {
      default: 'v1',
      supported: ['v1', 'v2'],
      type: 'path',
      pathPrefix: 'api',
      ...versionConfig,
    };
  }

  // ========================================================================
  // Route Registration
  // ========================================================================

  /**
   * Register a route.
   */
  addRoute(route: RouteConfig): void {
    this.routes.push(route);
  }

  /**
   * Register multiple routes.
   */
  addRoutes(routes: RouteConfig[]): void {
    this.routes.push(...routes);
  }

  /**
   * Remove a route by path.
   */
  removeRoute(path: string): void {
    this.routes = this.routes.filter(r => r.path !== path);
  }

  /**
   * Get all routes.
   */
  getRoutes(): RouteConfig[] {
    return [...this.routes];
  }

  /**
   * Clear all routes.
   */
  clearRoutes(): void {
    this.routes = [];
  }

  // ========================================================================
  // Route Matching
  // ========================================================================

  /**
   * Match a route for the given request.
   */
  matchRoute(request: Request, url: URL): {
    route: RouteConfig | null;
    params: Record<string, string>;
    version: string;
  } {
    const pathname = url.pathname;
    const method = request.method;

    // Extract API version
    const version = this.extractVersion(url);

    // Normalize path for matching
    let normalizedPath = pathname;
    if (this.versionConfig.type === 'path' && this.versionConfig.pathPrefix) {
      // Remove version prefix for matching
      normalizedPath = normalizedPath.replace(
        new RegExp(`^/${this.versionConfig.pathPrefix}/${this.versionConfig.default}`),
        ''
      );
    }

    // Try exact matches first
    for (const route of this.routes) {
      if (!route.methods.includes(method)) continue;

      const { match, params } = this.matchPath(route.path, normalizedPath);
      if (match) {
        return { route, params, version };
      }
    }

    // Try prefix matches for wildcard routes
    for (const route of this.routes) {
      if (!route.methods.includes(method)) continue;
      if (!route.path.includes('*')) continue;

      const { match, params } = this.matchWildcard(route.path, normalizedPath);
      if (match) {
        return { route, params, version };
      }
    }

    return { route: null, params: {}, version };
  }

  /**
   * Check if path matches pattern and extract parameters.
   */
  private matchPath(
    pattern: string,
    path: string
  ): { match: boolean; params: Record<string, string> } {
    // Simple exact match
    if (pattern === path) {
      return { match: true, params: {} };
    }

    // Parameterized match (/users/:id)
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    if (patternParts.length !== pathParts.length) {
      return { match: false, params: {} };
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        // Parameter
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart !== pathPart) {
        return { match: false, params: {} };
      }
    }

    return { match: true, params };
  }

  /**
   * Check wildcard path match.
   */
  private matchWildcard(
    pattern: string,
    path: string
  ): { match: boolean; params: Record<string, string> } {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];

      // Wildcard matches everything
      if (patternPart === '*') {
        return { match: true, params };
      }

      // Double wildcard matches rest
      if (patternPart === '**') {
        return { match: true, params };
      }

      // Parameter
      if (patternPart.startsWith(':')) {
        params[patternPart.slice(1)] = pathParts[i] || '';
        continue;
      }

      // Exact match required
      if (patternPart !== (pathParts[i] || '')) {
        return { match: false, params: {} };
      }
    }

    return { match: true, params };
  }

  // ========================================================================
  // API Versioning
  // ========================================================================

  /**
   * Extract API version from request.
   */
  private extractVersion(url: URL): string {
    switch (this.versionConfig.type) {
      case 'path':
        return this.extractVersionFromPath(url);

      case 'header':
        return this.extractVersionFromHeader(url);

      case 'query':
        return this.extractVersionFromQuery(url);

      default:
        return this.versionConfig.default;
    }
  }

  /**
   * Extract version from path (/api/v1/users -> v1)
   */
  private extractVersionFromPath(url: URL): string {
    const parts = url.pathname.split('/');
    const prefixIndex = parts.indexOf(this.versionConfig.pathPrefix || 'api');

    if (prefixIndex >= 0 && parts[prefixIndex + 1]) {
      const potentialVersion = parts[prefixIndex + 1];
      if (this.versionConfig.supported.includes(potentialVersion)) {
        return potentialVersion;
      }
    }

    return this.versionConfig.default;
  }

  /**
   * Extract version from header
   */
  private extractVersionFromHeader(url: URL): string {
    // This would be called in the fetch handler with request headers
    return this.versionConfig.default;
  }

  /**
   * Extract version from query parameter
   */
  private extractVersionFromQuery(url: URL): string {
    const param = this.versionConfig.queryParam || 'version';
    const version = url.searchParams.get(param);

    if (version && this.versionConfig.supported.includes(version)) {
      return version;
    }

    return this.versionConfig.default;
  }

  // ========================================================================
  // URL Building
  // ========================================================================

  /**
   * Build URL for a route with parameters.
   */
  buildUrl(
    routePath: string,
    params: Record<string, string>,
    version?: string
  ): string {
    let url = routePath;

    // Replace parameters
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, value);
    }

    // Add version prefix if using path versioning
    if (this.versionConfig.type === 'path') {
      const v = version || this.versionConfig.default;
      const prefix = this.versionConfig.pathPrefix || 'api';
      url = `/${prefix}/${v}${url}`;
    }

    return url;
  }
}

// ============================================================================
// Gateway Context Builder
// ============================================================================

/**
 * Build gateway context from request.
 */
export async function buildContext(
  request: Request,
  url: URL,
  env: Env
): Promise<GatewayContext> {
  const requestId = crypto.randomUUID();

  // Extract tenant ID from various sources
  let tenantId: string | undefined;
  const tenantFromHeader = request.headers.get('X-Tenant-ID');
  const tenantFromQuery = url.searchParams.get('tenantId');
  tenantId = tenantFromHeader || tenantFromQuery || undefined;

  // Extract user ID from JWT (simplified)
  let userId: string | undefined;
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    // TODO: Verify JWT
    // For now, extract from header for development
    userId = request.headers.get('X-User-ID') || undefined;
  }

  // Get client IP
  const clientIp = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') ||
                   'unknown';

  return {
    requestId,
    tenantId,
    userId,
    clientIp,
    userAgent: request.headers.get('User-Agent') || undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build gateway request.
 */
export function buildGatewayRequest(
  request: Request,
  context: GatewayContext,
  match: ReturnType<GatewayRouter['matchRoute']>
): GatewayRequest {
  const url = new URL(request.url);

  return {
    request,
    context,
    url,
    params: match.params,
    query: url.searchParams,
  };
}

// ============================================================================
// Default Routes Configuration
// ============================================================================

/**
 * Get default routes for StudyLoG.AI.
 */
export function getDefaultRoutes(): RouteConfig[] {
  return [
    // Health check (no auth required)
    {
      path: '/health',
      methods: ['GET'],
      target: 'internal://health',
      metadata: {
        name: 'Health Check',
        description: 'Gateway and service health status',
        tags: ['internal'],
      },
    },

    // Authentication (no auth required)
    {
      path: '/auth/*',
      methods: ['POST', 'GET'],
      target: 'https://auth.studylog.ai',
      authRequired: false,
      cache: {
        ttl: 0,
      },
      metadata: {
        name: 'Authentication Service',
        tags: ['auth'],
      },
    },

    // Students API
    {
      path: '/students',
      methods: ['GET', 'POST'],
      target: 'https://students.studylog.ai',
      authRequired: true,
      rateLimit: {
        limit: 100,
        window: 60,
        scope: 'tenant',
      },
      cache: {
        ttl: 300,
        methods: ['GET'],
      },
      metadata: {
        name: 'Students List',
        tags: ['students'],
        version: 'v1',
      },
    },
    {
      path: '/students/:id',
      methods: ['GET', 'PUT', 'DELETE'],
      target: 'https://students.studylog.ai',
      authRequired: true,
      rateLimit: {
        limit: 100,
        window: 60,
        scope: 'tenant',
      },
      cache: {
        ttl: 60,
        methods: ['GET'],
      },
      metadata: {
        name: 'Student Details',
        tags: ['students'],
        version: 'v1',
      },
    },

    // AI/LLM Router API
    {
      path: '/ai/*',
      methods: ['POST', 'GET'],
      target: 'https://ai-router.studylog.ai',
      authRequired: true,
      rateLimit: {
        limit: 1000,
        window: 60,
        scope: 'user',
        key: 'user.id',
      },
      transformRequest: {
        headers: {
          add: {
            'X-Request-ID': '{{requestId}}',
          },
        },
      },
      metadata: {
        name: 'AI Router',
        tags: ['ai', 'llm'],
        version: 'v1',
      },
    },

    // Multi-Model Router
    {
      path: '/models',
      methods: ['GET'],
      target: 'https://multi-model.studylog.ai',
      authRequired: true,
      cache: {
        ttl: 600,
        varyBy: ['Authorization'],
      },
      metadata: {
        name: 'Available Models',
        tags: ['ai'],
      },
    },

    // Real-time / WebSocket
    {
      path: '/realtime/*',
      methods: ['GET', 'POST', 'WebSocket'],
      target: 'https://realtime.studylog.ai',
      authRequired: true,
      metadata: {
        name: 'Real-time Communication',
        tags: ['realtime', 'websocket'],
      },
    },

    // Bazaar / Marketplace
    {
      path: '/bazaar/*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      target: 'https://bazaar.studylog.ai',
      authRequired: true,
      rateLimit: {
        limit: 200,
        window: 60,
        scope: 'user',
      },
      cache: {
        ttl: 120,
        methods: ['GET'],
      },
      metadata: {
        name: 'Bazaar Marketplace',
        tags: ['marketplace'],
      },
    },

    // Event System
    {
      path: '/events/*',
      methods: ['GET', 'POST'],
      target: 'https://events.studylog.ai',
      authRequired: true,
      metadata: {
        name: 'Event System',
        tags: ['events'],
      },
    },

    // Tenant Management
    {
      path: '/tenants/*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      target: 'https://tenants.studylog.ai',
      authRequired: true,
      rateLimit: {
        limit: 50,
        window: 60,
        scope: 'tenant',
      },
      metadata: {
        name: 'Tenant Management',
        tags: ['admin', 'tenant'],
      },
    },

    // Code Generation
    {
      path: '/generate/*',
      methods: ['POST', 'GET'],
      target: 'https://codegen.studylog.ai',
      authRequired: true,
      rateLimit: {
        limit: 50,
        window: 60,
        scope: 'user',
      },
      metadata: {
        name: 'Code Generation',
        tags: ['ai', 'code'],
      },
    },

    // Assets / Storage
    {
      path: '/assets/*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      target: 'https://assets.studylog.ai',
      authRequired: true,
      cache: {
        ttl: 3600,
        methods: ['GET'],
      },
      metadata: {
        name: 'Asset Management',
        tags: ['storage'],
      },
    },

    // Metrics / Observability
    {
      path: '/metrics',
      methods: ['GET'],
      target: 'internal://metrics',
      authRequired: true,
      scopes: ['admin', 'metrics:read'],
      metadata: {
        name: 'Metrics',
        tags: ['admin', 'observability'],
      },
    },
  ];
}
