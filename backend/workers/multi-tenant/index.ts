/**
 * Multi-Tenant System - Main Entry Point
 *
 * Cloudflare Worker for tenant management and context resolution.
 */

import { TenantService } from './tenant-service';
import { TenantResolver, withTenantContext, getTenantContext } from './middleware';
import type {
  CreateTenantRequest,
  UpdateTenantRequest,
  AddUserRequest,
  Env,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
};

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (pathname === '/health') {
        return Response.json({
          status: 'healthy',
          service: 'multi-tenant',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }, { headers: corsHeaders });
      }

      // Tenant management routes (require authentication)
      if (pathname === '/tenants' && request.method === 'POST') {
        return await handleCreateTenant(request, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+$/) && request.method === 'GET') {
        const tenantId = pathname.split('/')[2];
        return await handleGetTenant(tenantId, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+$/) && request.method === 'PUT') {
        const tenantId = pathname.split('/')[2];
        return await handleUpdateTenant(tenantId, request, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+$/) && request.method === 'DELETE') {
        const tenantId = pathname.split('/')[2];
        return await handleDeleteTenant(tenantId, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+\/usage$/) && request.method === 'GET') {
        const tenantId = pathname.split('/')[2];
        return await handleGetTenantUsage(tenantId, env);
      }

      // User management routes
      if (pathname === '/tenants/users' && request.method === 'POST') {
        return await handleAddUser(request, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+\/users$/) && request.method === 'GET') {
        const tenantId = pathname.split('/')[2];
        return await handleListUsers(tenantId, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+\/users\/[^/]+$/) && request.method === 'DELETE') {
        const parts = pathname.split('/');
        const tenantId = parts[2];
        const userId = parts[4];
        return await handleRemoveUser(tenantId, userId, env);
      }

      if (pathname.match(/^\/tenants\/[^/]+\/users\/[^/]+\/role$/) && request.method === 'PUT') {
        const parts = pathname.split('/');
        const tenantId = parts[2];
        const userId = parts[4];
        return await handleUpdateUserRole(tenantId, userId, request, env);
      }

      // Theme routes
      if (pathname.match(/^\/tenants\/[^/]+\/theme$/) && request.method === 'GET') {
        const tenantId = pathname.split('/')[2];
        return await handleGetTheme(tenantId, env);
      }

      // Config routes
      if (pathname.match(/^\/tenants\/[^/]+\/config$/) && request.method === 'GET') {
        const tenantId = pathname.split('/')[2];
        return await handleGetConfig(tenantId, env);
      }

      // Resolve tenant from hostname
      if (pathname === '/resolve' && request.method === 'GET') {
        return await handleResolveTenant(request, env);
      }

      // 404
      return new Response(JSON.stringify({
        error: 'Not found',
        path: pathname,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Multi-tenant error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ============================================================================
// Route Handlers
// ============================================================================

async function handleCreateTenant(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as CreateTenantRequest;

  // Validate request
  if (!body.name || !body.subdomain || !body.ownerId) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: name, subdomain, ownerId',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate subdomain format
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(body.subdomain)) {
    return new Response(JSON.stringify({
      error: 'Invalid subdomain format. Use lowercase letters, numbers, and hyphens.',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenant = await service.createTenant(body);

  return new Response(JSON.stringify({
    success: true,
    tenant,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetTenant(tenantId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenant = await service.getTenantWithUsage(tenantId);

  if (!tenant) {
    return new Response(JSON.stringify({
      error: 'Tenant not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(tenant), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdateTenant(tenantId: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as UpdateTenantRequest;

  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenant = await service.updateTenant(tenantId, body);

  return new Response(JSON.stringify({
    success: true,
    tenant,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDeleteTenant(tenantId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  await service.deleteTenant(tenantId);

  return new Response(JSON.stringify({
    success: true,
    message: 'Tenant deleted',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetTenantUsage(tenantId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenant = await service.getTenantWithUsage(tenantId);

  if (!tenant) {
    return new Response(JSON.stringify({
      error: 'Tenant not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    usage: tenant.usage,
    usagePercent: tenant.usagePercent,
    limits: tenant.limits,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleAddUser(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as AddUserRequest;

  if (!body.tenantId || !body.userId || !body.role) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: tenantId, userId, role',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenantUser = await service.addUser(body);

  return new Response(JSON.stringify({
    success: true,
    user: tenantUser,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListUsers(tenantId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const users = await service.listTenantUsers(tenantId);

  return new Response(JSON.stringify({
    users,
    count: users.length,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRemoveUser(tenantId: string, userId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  await service.removeUser(tenantId, userId);

  return new Response(JSON.stringify({
    success: true,
    message: 'User removed from tenant',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdateUserRole(
  tenantId: string,
  userId: string,
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json();

  if (!body.role) {
    return new Response(JSON.stringify({
      error: 'Missing required field: role',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const service = new TenantService(env.DB, env.TENANT_CACHE);
  await service.updateUserRole(tenantId, userId, body.role);

  return new Response(JSON.stringify({
    success: true,
    message: 'User role updated',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetTheme(tenantId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenant = await service.getTenant(tenantId);

  if (!tenant) {
    return new Response(JSON.stringify({
      error: 'Tenant not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Return CSS variables for the theme
  const theme = tenant.theme || {
    colors: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      accent: '#10b981',
      background: '#0f172a',
      text: '#f8fafc',
    },
  };

  const css = generateThemeCSS(theme);

  return new Response(css, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

async function handleGetConfig(tenantId: string, env: Env): Promise<Response> {
  const service = new TenantService(env.DB, env.TENANT_CACHE);
  const tenant = await service.getTenant(tenantId);

  if (!tenant) {
    return new Response(JSON.stringify({
      error: 'Tenant not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Return public config only (exclude sensitive data)
  const publicConfig = {
    language: tenant.config.language,
    features: tenant.config.features,
    modules: tenant.config.modules,
  };

  return new Response(JSON.stringify(publicConfig), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleResolveTenant(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.searchParams.get('hostname') || new URL(request.url).hostname;

  const resolver = new TenantResolver(env.DB, env.TENANT_CACHE);
  const tenant = await resolver.resolveFromHostname(hostname);

  if (!tenant) {
    return new Response(JSON.stringify({
      error: 'No tenant found for hostname',
      hostname,
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    tenantId: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
    tier: tenant.tier,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate CSS variables from theme configuration.
 */
function generateThemeCSS(theme: any): string {
  const colors = theme.colors || {};

  return `
:root {
  --color-primary: ${colors.primary || '#3b82f6'};
  --color-secondary: ${colors.secondary || '#8b5cf6'};
  --color-accent: ${colors.accent || '#10b981'};
  --color-background: ${colors.background || '#0f172a'};
  --color-text: ${colors.text || '#f8fafc'};
  --color-error: ${colors.error || '#ef4444'};
  --color-warning: ${colors.warning || '#f59e0b'};
  --color-success: ${colors.success || '#22c55e'};
}
  `.trim();
}

// ============================================================================
// Exports
// ============================================================================

export { TenantService, TenantResolver, withTenantContext, getTenantContext };
export type { Env, CreateTenantRequest, UpdateTenantRequest, AddUserRequest };
