/**
 * Tenant Context Middleware
 *
 * Cloudflare Workers middleware for tenant resolution and context injection.
 * Supports subdomain and custom domain resolution.
 */

import type {
  Tenant,
  TenantContext,
  TenantRole,
  Env,
} from './types';

// ============================================================================
// Tenant Resolver
// ============================================================================

/**
 * Resolve tenant from request hostname.
 *
 * Resolution order:
 * 1. Custom domain (exact match)
 * 2. Subdomain (tenant.studylog.ai)
 * 3. Header-based (for API testing)
 * 4. Default/development tenant
 */
export class TenantResolver {
  private db: D1Database;
  private cache: KVNamespace;

  constructor(db: D1Database, cache: KVNamespace) {
    this.db = db;
    this.cache = cache;
  }

  /**
   * Resolve tenant from hostname.
   */
  async resolveFromHostname(hostname: string): Promise<Tenant | null> {
    // Check cache first
    const cacheKey = `tenant:host:${hostname}`;
    const cached = await this.cache.get(cacheKey, 'json');
    if (cached) {
      return cached as Tenant;
    }

    let tenant: Tenant | null = null;

    // Try custom domain first
    tenant = await this.findByCustomDomain(hostname);

    // Try subdomain
    if (!tenant) {
      tenant = await this.findBySubdomain(hostname);
    }

    // Cache for 5 minutes
    if (tenant) {
      await this.cache.put(cacheKey, JSON.stringify(tenant), {
        expirationTtl: 300,
      });
    }

    return tenant;
  }

  /**
   * Find tenant by custom domain.
   */
  private async findByCustomDomain(domain: string): Promise<Tenant | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM tenants WHERE custom_domain = ? AND status = ?'
    );
    const result = await stmt.bind(domain, 'active').first();

    return result ? this.mapToTenant(result) : null;
  }

  /**
   * Find tenant by subdomain.
   */
  private async findBySubdomain(hostname: string): Promise<Tenant | null> {
    // Extract subdomain from hostname (e.g., 'school.studylog.ai' -> 'school')
    const parts = hostname.split('.');
    if (parts.length < 2) {
      return null;
    }

    const subdomain = parts[0];

    // Skip common system subdomains
    if (['www', 'api', 'admin', 'cdn', 'assets'].includes(subdomain)) {
      return null;
    }

    const stmt = this.db.prepare(
      'SELECT * FROM tenants WHERE subdomain = ? AND status = ?'
    );
    const result = await stmt.bind(subdomain, 'active').first();

    return result ? this.mapToTenant(result) : null;
  }

  /**
   * Find tenant by ID.
   */
  async findById(tenantId: string): Promise<Tenant | null> {
    const cacheKey = `tenant:id:${tenantId}`;
    const cached = await this.cache.get(cacheKey, 'json');
    if (cached) {
      return cached as Tenant;
    }

    const stmt = this.db.prepare(
      'SELECT * FROM tenants WHERE id = ?'
    );
    const result = await stmt.bind(tenantId).first();

    const tenant = result ? this.mapToTenant(result) : null;

    if (tenant) {
      await this.cache.put(cacheKey, JSON.stringify(tenant), {
        expirationTtl: 300,
      });
    }

    return tenant;
  }

  /**
   * Get user's role in tenant.
   */
  async getUserRole(tenantId: string, userId: string): Promise<TenantRole | null> {
    const stmt = this.db.prepare(
      'SELECT role FROM tenant_users WHERE tenant_id = ? AND user_id = ? AND status = ?'
    );
    const result = await stmt.bind(tenantId, userId, 'active').first<{ role: string }>();

    return (result?.role as TenantRole) ?? null;
  }

  /**
   * Map database row to Tenant entity.
   */
  private mapToTenant(row: any): Tenant {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      tier: row.tier,
      customDomain: row.custom_domain,
      subdomain: row.subdomain,
      ownerId: row.owner_id,
      maxUsers: row.max_users,
      currentUsers: row.current_users,
      limits: JSON.parse(row.limits),
      theme: row.theme ? JSON.parse(row.theme) : undefined,
      config: JSON.parse(row.config),
      billing: row.billing ? JSON.parse(row.billing) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      suspendedAt: row.suspended_at,
    };
  }
}

// ============================================================================
// Tenant Context Middleware
// ============================================================================

/**
 * Middleware that adds tenant context to requests.
 *
 * Usage in Cloudflare Workers:
 * ```typescript
 * export default {
 *   fetch: withTenantContext(handler)
 * };
 * ```
 */
export function withTenantContext(
  handler: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>,
  options?: {
    requireTenant?: boolean;
    requireAuth?: boolean;
    defaultTenantId?: string;
  }
): (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response> {
  return async (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Resolve tenant
    const resolver = new TenantResolver(env.DB, env.TENANT_CACHE);
    let tenant = await resolver.resolveFromHostname(hostname);

    // Fallback to default tenant for development
    if (!tenant && options?.defaultTenantId) {
      tenant = await resolver.findById(options.defaultTenantId);
    }

    // Require tenant check
    if (!tenant && options?.requireTenant) {
      return new Response(JSON.stringify({
        error: 'Tenant not found',
        hostname,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract user ID from JWT
    const authHeader = request.headers.get('Authorization');
    let userId: string | undefined;
    let userRole: TenantRole | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      // In production, verify JWT and extract userId
      const token = authHeader.substring(7);
      // TODO: Verify JWT
      // For now, extract from header for development
      userId = request.headers.get('X-User-ID') || undefined;

      if (tenant && userId) {
        userRole = await resolver.getUserRole(tenant.id, userId);
      }
    }

    // Build tenant context
    const tenantContext: TenantContext = {
      tenantId: tenant?.id || 'default',
      tenant: tenant || undefined,
      role: userRole,
      userId,
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Attach context to request for downstream handlers
    (request as any).tenantContext = tenantContext;

    // Add context headers for debugging
    const headers = new Headers();
    headers.set('X-Tenant-ID', tenantContext.tenantId);
    headers.set('X-Request-ID', tenantContext.requestId);
    if (tenantContext.role) {
      headers.set('X-User-Role', tenantContext.role);
    }

    // Call original handler
    const response = await handler(request, env, ctx);

    // Add context headers to response
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('X-Tenant-ID', tenantContext.tenantId);
    responseHeaders.set('X-Request-ID', tenantContext.requestId);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  };
}

/**
 * Helper to get tenant context from request.
 */
export function getTenantContext(request: Request): TenantContext {
  const context = (request as any).tenantContext as TenantContext;
  if (!context) {
    throw new Error('Tenant context not found. Make sure withTenantContext middleware is applied.');
  }
  return context;
}

// ============================================================================
// Authorization Helpers
// ============================================================================

/**
 * Check if user has required role.
 */
export function hasRole(context: TenantContext, requiredRole: TenantRole): boolean {
  if (!context.role) {
    return false;
  }

  const roleHierarchy: Record<TenantRole, number> = {
    owner: 5,
    admin: 4,
    teacher: 3,
    student: 2,
    viewer: 1,
  };

  return roleHierarchy[context.role] >= roleHierarchy[requiredRole];
}

/**
 * Check if user has any of the required roles.
 */
export function hasAnyRole(context: TenantContext, requiredRoles: TenantRole[]): boolean {
  return requiredRoles.some(role => hasRole(context, role));
}

/**
 * Require role or throw 403.
 */
export function requireRole(context: TenantContext, requiredRole: TenantRole): void {
  if (!hasRole(context, requiredRole)) {
    throw new Error(`Forbidden: Requires ${requiredRole} role`);
  }
}

/**
 * Check if tenant has a feature enabled.
 */
export function hasFeature(context: TenantContext, feature: string): boolean {
  return context.tenant?.config.features[feature] === true;
}

/**
 * Require feature or throw 403.
 */
export function requireFeature(context: TenantContext, feature: string): void {
  if (!hasFeature(context, feature)) {
    throw new Error(`Forbidden: Feature '${feature}' not enabled`);
  }
}

/**
 * Check if tenant is within limits.
 */
export function isWithinLimits(context: TenantContext, limitType: keyof Tenant['limits']): boolean {
  const tenant = context.tenant;
  if (!tenant) {
    return false;
  }

  const limits = tenant.limits;
  // In production, check actual usage against limits
  return true;
}
