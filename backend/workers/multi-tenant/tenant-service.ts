/**
 * Tenant Service
 *
 * Business logic for tenant management including CRUD operations,
 * user management, and configuration.
 */

import type {
  Tenant,
  TenantUser,
  TenantContext,
  CreateTenantRequest,
  UpdateTenantRequest,
  AddUserRequest,
  TenantResponse,
  TenantRole,
  DEFAULT_LIMITS,
  DEFAULT_CONFIG,
  DEFAULT_THEME,
} from './types';
import type { Env } from './types';

// Import defaults (redefine for standalone use)
const DEFAULT_LIMITS_VAL = {
  personal: {
    maxStudents: 1,
    maxTeachers: 1,
    maxDailyRequests: 100,
    maxMonthlyTokens: 1_000_000,
    maxStorageGB: 1,
    availableModules: ['cognitive-mill', 'intelligence-ranch'],
    customAIProviders: false,
    whiteLabelEnabled: false,
    apiAccess: false,
    prioritySupport: false,
  },
  classroom: {
    maxStudents: 30,
    maxTeachers: 3,
    maxDailyRequests: 1_000,
    maxMonthlyTokens: 10_000_000,
    maxStorageGB: 10,
    availableModules: ['cognitive-mill', 'intelligence-ranch', 'sitka-sound'],
    customAIProviders: false,
    whiteLabelEnabled: true,
    apiAccess: false,
    prioritySupport: false,
  },
  school: {
    maxStudents: 500,
    maxTeachers: 50,
    maxDailyRequests: 10_000,
    maxMonthlyTokens: 100_000_000,
    maxStorageGB: 100,
    availableModules: ['cognitive-mill', 'intelligence-ranch', 'sitka-sound', 'digital-twins'],
    customAIProviders: true,
    whiteLabelEnabled: true,
    apiAccess: true,
    prioritySupport: true,
  },
};

// ============================================================================
// Tenant Service
// ============================================================================

export class TenantService {
  private db: D1Database;
  private cache: KVNamespace;

  constructor(db: D1Database, cache: KVNamespace) {
    this.db = db;
    this.cache = cache;
  }

  // ========================================================================
  // Tenant CRUD
  // ========================================================================

  /**
   * Create a new tenant.
   */
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    const {
      name,
      subdomain,
      tier = 'personal',
      ownerId,
      theme,
      config,
    } = request;

    // Check if subdomain is available
    const existing = await this.db.prepare(
      'SELECT id FROM tenants WHERE subdomain = ?'
    ).bind(subdomain).first();

    if (existing) {
      throw new Error(`Subdomain '${subdomain}' is already taken`);
    }

    // Generate tenant ID
    const tenantId = this.generateTenantId(subdomain);

    // Merge with defaults
    const limits = DEFAULT_LIMITS_VAL[tier] || DEFAULT_LIMITS_VAL.personal;
    const mergedConfig = { ...DEFAULT_CONFIG_VAL, ...config };
    const mergedTheme = theme ? { ...DEFAULT_THEME_VAL, ...theme } : DEFAULT_THEME_VAL;

    // Create tenant
    await this.db.prepare(`
      INSERT INTO tenants (
        id, name, status, tier, subdomain, owner_id,
        max_users, current_users, limits, theme, config,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId,
      name,
      'provisioning',
      tier,
      subdomain,
      ownerId,
      limits.maxStudents + limits.maxTeachers,
      0,
      JSON.stringify(limits),
      JSON.stringify(mergedTheme),
      JSON.stringify(mergedConfig),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    // Add owner as first user
    await this.addUser({
      tenantId,
      userId: ownerId,
      role: 'owner',
      isPrimary: true,
    });

    // Invalidate cache
    await this.cache.delete(`tenant:subdomain:${subdomain}`);

    return (await this.getTenant(tenantId))!;
  }

  /**
   * Get tenant by ID.
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    const cacheKey = `tenant:id:${tenantId}`;
    const cached = await this.cache.get(cacheKey, 'json');
    if (cached) {
      return cached as Tenant;
    }

    const row = await this.db.prepare(
      'SELECT * FROM tenants WHERE id = ?'
    ).bind(tenantId).first();

    if (!row) {
      return null;
    }

    const tenant = this.mapToTenant(row);

    // Cache for 5 minutes
    await this.cache.put(cacheKey, JSON.stringify(tenant), {
      expirationTtl: 300,
    });

    return tenant;
  }

  /**
   * Get tenant with usage statistics.
   */
  async getTenantWithUsage(tenantId: string): Promise<TenantResponse | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return null;
    }

    // Get usage statistics
    const usage = await this.getTenantUsage(tenantId);

    return {
      ...tenant,
      usage,
      usagePercent: {
        students: this.calcPercent(usage.students, tenant.limits.maxStudents),
        teachers: this.calcPercent(usage.teachers, tenant.limits.maxTeachers),
        dailyRequests: this.calcPercent(usage.dailyRequests, tenant.limits.maxDailyRequests),
        monthlyTokens: this.calcPercent(usage.monthlyTokens, tenant.limits.maxMonthlyTokens),
        storageGB: this.calcPercent(usage.storageGB, tenant.limits.maxStorageGB),
      },
    };
  }

  /**
   * Update tenant.
   */
  async updateTenant(tenantId: string, updates: UpdateTenantRequest): Promise<Tenant> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
      if (updates.status === 'suspended') {
        fields.push('suspended_at = ?');
        values.push(new Date().toISOString());
      }
    }
    if (updates.tier !== undefined) {
      const newLimits = DEFAULT_LIMITS_VAL[updates.tier];
      fields.push('tier = ?, limits = ?, max_users = ?');
      values.push(
        updates.tier,
        JSON.stringify(newLimits),
        newLimits.maxStudents + newLimits.maxTeachers
      );
    }
    if (updates.customDomain !== undefined) {
      // Validate custom domain availability
      if (updates.customDomain) {
        const existing = await this.db.prepare(
          'SELECT id FROM tenants WHERE custom_domain = ? AND id != ?'
        ).bind(updates.customDomain, tenantId).first();

        if (existing) {
          throw new Error(`Custom domain '${updates.customDomain}' is already in use`);
        }
      }
      fields.push('custom_domain = ?');
      values.push(updates.customDomain);
    }
    if (updates.theme !== undefined) {
      const mergedTheme = { ...DEFAULT_THEME_VAL, ...tenant.theme, ...updates.theme };
      fields.push('theme = ?');
      values.push(JSON.stringify(mergedTheme));
    }
    if (updates.config !== undefined) {
      const mergedConfig = { ...DEFAULT_CONFIG_VAL, ...tenant.config, ...updates.config };
      fields.push('config = ?');
      values.push(JSON.stringify(mergedConfig));
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(tenantId);

    await this.db.prepare(`
      UPDATE tenants SET ${fields.join(', ')} WHERE id = ?
    `).bind(...values).run();

    // Invalidate cache
    await this.invalidateTenantCache(tenantId);

    return (await this.getTenant(tenantId))!;
  }

  /**
   * Delete tenant (soft delete, sets status to deleted).
   */
  async deleteTenant(tenantId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE tenants SET status = ?, updated_at = ? WHERE id = ?
    `).bind('deleted', new Date().toISOString(), tenantId).run();

    await this.invalidateTenantCache(tenantId);
  }

  // ========================================================================
  // User Management
  // ========================================================================

  /**
   * Add user to tenant.
   */
  async addUser(request: AddUserRequest & { isPrimary?: boolean }): Promise<TenantUser> {
    const { tenantId, userId, role, profile, isPrimary = false } = request;

    // Check tenant exists
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Check if user is already in tenant
    const existing = await this.db.prepare(
      'SELECT * FROM tenant_users WHERE tenant_id = ? AND user_id = ?'
    ).bind(tenantId, userId).first();

    if (existing) {
      throw new Error('User is already a member of this tenant');
    }

    // Check tenant capacity
    const userCount = await this.db.prepare(
      'SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = ? AND status = ?'
    ).bind(tenantId, 'active').first<{ count: number }>();

    if ((userCount?.count || 0) >= tenant.maxUsers) {
      throw new Error('Tenant has reached maximum user capacity');
    }

    // If this is primary, unset other primary for user
    if (isPrimary) {
      await this.db.prepare(`
        UPDATE tenant_users SET is_primary = 0 WHERE user_id = ?
      `).bind(userId).run();
    }

    // Add user
    await this.db.prepare(`
      INSERT INTO tenant_users (
        id, tenant_id, user_id, role, is_primary, status, profile, joined_at, last_active_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      tenantId,
      userId,
      role,
      isPrimary ? 1 : 0,
      'active',
      JSON.stringify(profile || {}),
      new Date().toISOString(),
      new Date().toISOString()
    ).run();

    // Update tenant user count
    await this.updateUserCount(tenantId);

    return (await this.getTenantUser(tenantId, userId))!;
  }

  /**
   * Remove user from tenant.
   */
  async removeUser(tenantId: string, userId: string): Promise<void> {
    // Prevent removing owner
    const tenant = await this.getTenant(tenantId);
    if (tenant?.ownerId === userId) {
      throw new Error('Cannot remove tenant owner');
    }

    await this.db.prepare(`
      DELETE FROM tenant_users WHERE tenant_id = ? AND user_id = ?
    `).bind(tenantId, userId).run();

    await this.updateUserCount(tenantId);
  }

  /**
   * Update user role.
   */
  async updateUserRole(tenantId: string, userId: string, newRole: TenantRole): Promise<void> {
    // Prevent changing owner role
    const tenant = await this.getTenant(tenantId);
    if (tenant?.ownerId === userId && newRole !== 'owner') {
      throw new Error('Cannot change owner role');
    }

    await this.db.prepare(`
      UPDATE tenant_users SET role = ? WHERE tenant_id = ? AND user_id = ?
    `).bind(newRole, tenantId, userId).run();
  }

  /**
   * Get user's role in tenant.
   */
  async getTenantUser(tenantId: string, userId: string): Promise<TenantUser | null> {
    const row = await this.db.prepare(`
      SELECT * FROM tenant_users WHERE tenant_id = ? AND user_id = ?
    `).bind(tenantId, userId).first();

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id as string,
      tenantId: row.tenant_id as string,
      role: row.role as TenantRole,
      isPrimary: (row.is_primary as number) === 1,
      status: row.status as 'active' | 'inactive' | 'pending',
      profile: row.profile ? JSON.parse(row.profile as string) : undefined,
      joinedAt: row.joined_at as string,
      lastActiveAt: row.last_active_at as string,
    };
  }

  /**
   * List users in tenant.
   */
  async listTenantUsers(tenantId: string): Promise<TenantUser[]> {
    const result = await this.db.prepare(`
      SELECT * FROM tenant_users WHERE tenant_id = ? ORDER BY joined_at DESC
    `).bind(tenantId).all();

    return (result.results || []).map((row: any) => ({
      userId: row.user_id,
      tenantId: row.tenant_id,
      role: row.role,
      isPrimary: row.is_primary === 1,
      status: row.status,
      profile: row.profile ? JSON.parse(row.profile) : undefined,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
    }));
  }

  // ========================================================================
  // Usage Tracking
  // ========================================================================

  /**
   * Get tenant usage statistics.
   */
  async getTenantUsage(tenantId: string): Promise<{
    students: number;
    teachers: number;
    dailyRequests: number;
    monthlyTokens: number;
    storageGB: number;
  }> {
    // Count students and teachers
    const users = await this.db.prepare(`
      SELECT
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
        SUM(CASE WHEN role IN ('owner', 'admin', 'teacher') THEN 1 ELSE 0 END) as teachers
      FROM tenant_users
      WHERE tenant_id = ? AND status = 'active'
    `).bind(tenantId).first<{ students: number; teachers: number }>();

    // Get daily request count (from usage tracking table)
    const today = new Date().toISOString().split('T')[0];
    const requests = await this.db.prepare(`
      SELECT COUNT(*) as count FROM api_usage
      WHERE tenant_id = ? AND DATE(timestamp) = ?
    `).bind(tenantId, today).first<{ count: number }>();

    // Get monthly token usage
    const thisMonth = new Date().toISOString().slice(0, 7);
    const tokens = await this.db.prepare(`
      SELECT SUM(input_tokens + output_tokens) as tokens
      FROM ai_usage
      WHERE tenant_id = ? AND DATE(timestamp) LIKE ?
    `).bind(tenantId, `${thisMonth}%`).first<{ tokens: number }>();

    // Get storage usage (from R2 or database stats)
    const storage = await this.db.prepare(`
      SELECT COALESCE(SUM(size), 0) as total_size
      FROM tenant_assets
      WHERE tenant_id = ?
    `).bind(tenantId).first<{ total_size: number }>();

    return {
      students: users?.students || 0,
      teachers: users?.teachers || 0,
      dailyRequests: requests?.count || 0,
      monthlyTokens: tokens?.tokens || 0,
      storageGB: ((storage?.total_size || 0) / (1024 * 1024 * 1024)),
    };
  }

  /**
   * Record API usage.
   */
  async recordApiUsage(
    tenantId: string,
    endpoint: string,
    statusCode: number
  ): Promise<void> {
    await this.db.prepare(`
      INSERT INTO api_usage (tenant_id, endpoint, status_code, timestamp)
      VALUES (?, ?, ?, ?)
    `).bind(tenantId, endpoint, statusCode, new Date().toISOString()).run();
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Generate tenant ID from subdomain.
   */
  private generateTenantId(subdomain: string): string {
    // Normalize subdomain to valid tenant ID
    return `tn_${subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '-')}_${Date.now()}`;
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

  /**
   * Calculate usage percentage.
   */
  private calcPercent(used: number, limit: number): number {
    if (limit < 0) return 0; // Unlimited
    if (limit === 0) return 100;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  /**
   * Update user count for tenant.
   */
  private async updateUserCount(tenantId: string): Promise<void> {
    const result = await this.db.prepare(`
      SELECT COUNT(*) as count FROM tenant_users WHERE tenant_id = ? AND status = 'active'
    `).bind(tenantId).first<{ count: number }>();

    await this.db.prepare(`
      UPDATE tenants SET current_users = ? WHERE id = ?
    `).bind(result?.count || 0, tenantId).run();
  }

  /**
   * Invalidate tenant cache.
   */
  private async invalidateTenantCache(tenantId: string): Promise<void> {
    await this.cache.delete(`tenant:id:${tenantId}`);

    // Also delete by subdomain
    const tenant = await this.db.prepare(
      'SELECT subdomain, custom_domain FROM tenants WHERE id = ?'
    ).bind(tenantId).first<{ subdomain: string; custom_domain: string }>();

    if (tenant) {
      await this.cache.delete(`tenant:subdomain:${tenant.subdomain}`);
      if (tenant.custom_domain) {
        await this.cache.delete(`tenant:custom:${tenant.custom_domain}`);
      }
    }
  }
}

// Defaults for standalone use
const DEFAULT_CONFIG_VAL: any = {
  language: 'en',
  timezone: 'UTC',
  features: {
    cognitiveMill: true,
    intelligenceRanch: true,
    sitkaSound: false,
  },
  ai: {
    fallbackProviders: ['cloudflare', 'deepseek', 'zhipu'],
    maxTokensPerRequest: 4096,
    temperature: 0.7,
  },
  modules: {},
  integrations: {
    godot: {
      enabled: true,
      maxScenes: 10,
    },
  },
  privacy: {
    analyticsEnabled: true,
    dataRetentionDays: 365,
    shareAnonymousUsage: true,
  },
};

const DEFAULT_THEME_VAL: any = {
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    accent: '#10b981',
    background: '#0f172a',
    text: '#f8fafc',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
  },
  logos: {
    light: '/assets/logos/default-light.svg',
    dark: '/assets/logos/default-dark.svg',
    icon: '/assets/logos/favicon.svg',
  },
};
