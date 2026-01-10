/**
 * Multi-Tenant Support Types
 *
 * Complete type definitions for multi-tenant architecture in StudyLoG.AI.
 * Supports tenant isolation, white-labeling, and per-tenant configuration.
 */

// ============================================================================
// Tenant Types
// ============================================================================

/**
 * Tenant status
 */
export type TenantStatus =
  | 'provisioning'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'deleted';

/**
 * Tenant tier with feature limits
 */
export type TenantTier =
  | 'personal'     // Free, single user
  | 'classroom'    // Small groups, $10/mo
  | 'school'       // Full school, $100/mo
  | 'district'     // School district, $500/mo
  | 'enterprise';  // Custom, unlimited

/**
 * Tenant entity
 */
export interface Tenant {
  /**
   * Unique tenant identifier (slug)
   */
  id: string;

  /**
   * Display name
   */
  name: string;

  /**
   * Tenant status
   */
  status: TenantStatus;

  /**
   * Pricing tier
   */
  tier: TenantTier;

  /**
   * Custom domain (optional)
   */
  customDomain?: string;

  /**
   * Subdomain on studylog.ai
   */
  subdomain: string;

  /**
   * Tenant owner user ID
   */
  ownerId: string;

  /**
   * Maximum number of users allowed
   */
  maxUsers: number;

  /**
   * Current number of users
   */
  currentUsers: number;

  /**
   * Feature flags and limits
   */
  limits: TenantLimits;

  /**
   * White-label theme configuration
   */
  theme?: TenantTheme;

  /**
   * Configuration overrides
   */
  config: TenantConfig;

  /**
   * Billing information
   */
  billing?: TenantBilling;

  /**
   * Timestamps
   */
  createdAt: string;
  updatedAt: string;
  suspendedAt?: string;
}

/**
 * Tenant limits based on tier
 */
export interface TenantLimits {
  /**
   * Maximum number of students
   */
  maxStudents: number;

  /**
   * Maximum number of teachers
   */
  maxTeachers: number;

  /**
   * Maximum AI requests per day
   */
  maxDailyRequests: number;

  /**
   * Maximum AI tokens per month
   */
  maxMonthlyTokens: number;

  /**
   * Maximum storage in GB
   */
  maxStorageGB: number;

  /**
   * Available modules
   */
  availableModules: string[];

  /**
   * Can use custom AI providers
   */
  customAIProviders: boolean;

  /**
   * Can white-label
   */
  whiteLabelEnabled: boolean;

  /**
   * API access enabled
   */
  apiAccess: boolean;

  /**
   * Priority support
   */
  prioritySupport: boolean;
}

/**
 * Default limits by tier
 */
export const DEFAULT_LIMITS: Record<TenantTier, TenantLimits> = {
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
  district: {
    maxStudents: 10_000,
    maxTeachers: 1_000,
    maxDailyRequests: 100_000,
    maxMonthlyTokens: 1_000_000_000,
    maxStorageGB: 1000,
    availableModules: ['cognitive-mill', 'intelligence-ranch', 'sitka-sound', 'digital-twins'],
    customAIProviders: true,
    whiteLabelEnabled: true,
    apiAccess: true,
    prioritySupport: true,
  },
  enterprise: {
    maxStudents: -1, // Unlimited
    maxTeachers: -1,
    maxDailyRequests: -1,
    maxMonthlyTokens: -1,
    maxStorageGB: -1,
    availableModules: ['cognitive-mill', 'intelligence-ranch', 'sitka-sound', 'digital-twins'],
    customAIProviders: true,
    whiteLabelEnabled: true,
    apiAccess: true,
    prioritySupport: true,
  },
};

// ============================================================================
// Theme Types
// ============================================================================

/**
 * White-label theme configuration
 */
export interface TenantTheme {
  /**
   * Brand colors
   */
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    error: string;
    warning: string;
    success: string;
  };

  /**
   * Typography
   */
  typography?: {
    fontFamily?: string;
    fontSize?: {
      base: string;
      small: string;
      large: string;
      heading: string;
    };
  };

  /**
   * Logo URLs
   */
  logos: {
    light: string; // URL to R2 storage
    dark?: string;
    icon?: string; // Favicon
  };

  /**
   * Custom CSS
   */
  customCSS?: string;

  /**
   * Layout preferences
   */
  layout?: {
    sidebarPosition?: 'left' | 'right';
    showBranding?: boolean;
    customFooter?: string;
  };
}

/**
 * Default theme
 */
export const DEFAULT_THEME: TenantTheme = {
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

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Tenant-specific configuration
 */
export interface TenantConfig {
  /**
   * Default language
   */
  language: string;

  /**
   * Default timezone
   */
  timezone: string;

  /**
   * Enabled features (feature flags)
   */
  features: Record<string, boolean>;

  /**
   * AI provider preferences
   */
  ai: {
    preferredProvider?: string;
    fallbackProviders: string[];
    maxTokensPerRequest: number;
    temperature: number;
  };

  /**
   * Module settings
   */
  modules: {
    [moduleName: string]: Record<string, unknown>;
  };

  /**
   * Integrations
   */
  integrations: {
    godot?: {
      enabled: boolean;
      maxScenes: number;
    };
    webhooks?: {
      enabled: boolean;
      urls: string[];
    };
  };

  /**
   * Privacy settings
   */
  privacy: {
    analyticsEnabled: boolean;
    dataRetentionDays: number;
    shareAnonymousUsage: boolean;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: TenantConfig = {
  language: 'en',
  timezone: 'UTC',
  features: {
    cognitiveMill: true,
    intelligenceRanch: true,
    sitkaSound: false,
    digitalTwins: false,
    bazaar: true,
    voiceAssistant: true,
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

// ============================================================================
// Billing Types
// ============================================================================

/**
 * Tenant billing information
 */
export interface TenantBilling {
  /**
   * Stripe customer ID
   */
  stripeCustomerId?: string;

  /**
   * Current subscription ID
   */
  subscriptionId?: string;

  /**
   * Monthly price in cents
   */
  monthlyPrice: number;

  /**
   * Currency code
   */
  currency: string;

  /**
   * Billing period
   */
  period: 'monthly' | 'yearly';

  /**
   * Next billing date
   */
  nextBillingDate?: string;

  /**
   * Payment method info
   */
  paymentMethod?: {
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
  };

  /**
   * Invoice settings
   */
  invoicing?: {
    enabled: boolean;
    email?: string;
    poNumber?: string;
  };
}

// ============================================================================
// User-Tenant Association
// ============================================================================

/**
 * User role within a tenant
 */
export type TenantRole =
  | 'owner'
  | 'admin'
  | 'teacher'
  | 'student'
  | 'viewer';

/**
 * User's association with a tenant
 */
export interface TenantUser {
  /**
   * User ID
   */
  userId: string;

  /**
   * Tenant ID
   */
  tenantId: string;

  /**
   * Role within this tenant
   */
  role: TenantRole;

  /**
   * Is this the user's primary tenant?
   */
  isPrimary: boolean;

  /**
   * User's status within tenant
   */
  status: 'active' | 'inactive' | 'pending';

  /**
   * Profile data specific to this tenant
   */
  profile?: {
    displayName?: string;
    avatar?: string;
    bio?: string;
  };

  /**
   * Timestamps
   */
  joinedAt: string;
  lastActiveAt: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Tenant context attached to requests
 */
export interface TenantContext {
  /**
   * Tenant ID
   */
  tenantId: string;

  /**
   * Tenant entity (cached)
   */
  tenant?: Tenant;

  /**
   * User's role in this tenant
   */
  role?: TenantRole;

  /**
   * User ID
   */
  userId?: string;

  /**
   * Theme override
   */
  theme?: TenantTheme;

  /**
   * Configuration override
   */
  config?: TenantConfig;

  /**
   * Request tracking
   */
  requestId: string;

  /**
   * Timestamp
   */
  timestamp: string;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Create tenant request
 */
export interface CreateTenantRequest {
  name: string;
  subdomain: string;
  tier?: TenantTier;
  ownerId: string;
  theme?: Partial<TenantTheme>;
  config?: Partial<TenantConfig>;
}

/**
 * Update tenant request
 */
export interface UpdateTenantRequest {
  name?: string;
  customDomain?: string;
  status?: TenantStatus;
  tier?: TenantTier;
  theme?: Partial<TenantTheme>;
  config?: Partial<TenantConfig>;
}

/**
 * Add user to tenant request
 */
export interface AddUserRequest {
  tenantId: string;
  userId: string;
  role: TenantRole;
  profile?: {
    displayName?: string;
    avatar?: string;
  };
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Tenant response with computed properties
 */
export interface TenantResponse extends Omit<Tenant, 'config' | 'theme'> {
  /**
   * Current usage statistics
   */
  usage: {
    students: number;
    teachers: number;
    dailyRequests: number;
    monthlyTokens: number;
    storageGB: number;
  };

  /**
   * Usage as percentage of limits
   */
  usagePercent: {
    students: number;
    teachers: number;
    dailyRequests: number;
    monthlyTokens: number;
    storageGB: number;
  };
}

/**
 * Tenant list response
 */
export interface TenantListResponse {
  tenants: TenantResponse[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Environment bindings for multi-tenant system
 */
export interface Env {
  // D1 Database
  DB: D1Database;

  // KV for caching tenant configs
  TENANT_CACHE: KVNamespace;

  // R2 for logos and assets
  ASSETS: R2Bucket;

  // Optional: Stripe for billing
  STRIPE_SECRET_KEY?: string;

  // Optional: Analytics
  ANALYTICS?: AnalyticsEngineDataset;
}
