/**
 * Budget Tracker - Type Definitions
 *
 * This module defines types for tracking daily API usage budgets across
 * multiple free-tier providers. The system maximizes free-tier usage while
 * preventing overage charges.
 *
 * ## Core Concepts
 *
 * ### Provider Budget Tracking
 * Each provider has a daily budget limit that resets at a configurable time.
 * The system tracks usage in both USD and tokens to support different
 * provider pricing models.
 *
 * ### Free-Tier Maximization Strategy
 * Many providers offer free credits that reset daily or monthly:
 * - OpenAI: Free tier credits for new accounts
 * - Grok (X.ai): Limited free requests
 * - Qwen (Alibaba): Daily free tier limits
 * - Google Cloud: $300 free credit, then free tiers
 * - Others: Various free-tier options
 *
 * The budget tracker monitors usage to:
 * 1. Use free tiers to their maximum before switching providers
 * 2. Prevent overage charges when free tiers are exhausted
 * 3. Schedule "fill knowledge" tasks when free tiers are nearly exhausted
 *
 * ### Fill Knowledge Strategy
 * When a free tier is nearly exhausted (e.g., >90% used), the system:
 * 1. Switches to the next available free-tier provider
 * 2. Queues "fill knowledge" tasks for end-of-day processing
 * 3. These tasks use remaining free tier for knowledge expansion (e.g.,
 *    pre-warming caches, generating embeddings, training data)
 * 4. Next day, starts fresh with renewed free tier
 *
 * ### Provider Rotation
 * Providers are rotated based on:
 * 1. Available free tier (remaining budget)
 * 2. Cost per million tokens (cheapest first within free tier)
 * 3. Time-of-day (some providers reset at specific times)
 * 4. User preferences (can pin favorite providers)
 */

// ============================================================================
// Supported Providers
// ============================================================================

/**
 * All supported API providers that can be tracked for budget purposes.
 *
 * Each provider may have different free-tier structures:
 * - Daily reset: Budget resets at same time each day
 * - Monthly reset: Budget resets on billing cycle
 * - One-time: Fixed free credit amount (e.g., Google's $300)
 * - Rolling: Free credits replenish over time
 */
export type BudgetProvider =
  | 'openai'        // OpenAI - Free tier credits
  | 'xai'           // X.ai (Grok) - Limited free requests
  | 'qwen'          // Alibaba Qwen - Daily free tier
  | 'google'        // Google Cloud - $300 credit + free tiers
  | 'anthropic'     // Anthropic Claude - Usage-based credits
  | 'deepseek'      // DeepSeek - Ultra-low cost, minimal free tier
  | 'zhipu'         // Zhipu AI - GLM models with free tier
  | 'nvidia'        // NVIDIA - Free tier for hosted models
  | 'ollama'        // Local Ollama - Always free (no budget tracking)
  | 'deepinfra'     // DeepInfra - Discount with some free tier
  | 'replicate'     // Replicate - Free credits for testing
  | 'elevenlabs'    // ElevenLabs - Audio generation free tier
  | 'custom';       // User-defined provider

/**
 * Provider free-tier reset schedule types
 */
export type ResetSchedule =
  | 'daily'         // Resets at same time every day (e.g., 00:00 UTC)
  | 'weekly'        // Resets on specific day of week
  | 'monthly'       // Resets on billing cycle (e.g., 1st of month)
  | 'rolling'       // Rolling window (e.g., last 24 hours)
  | 'one-time'      // One-time credit that doesn't reset
  | 'never';        // No reset (pure pay-as-you-go)

/**
 * Budget tracking modes
 */
export type BudgetMode =
  | 'conservative'  // Stop at 90% of free tier to prevent overage
  | 'balanced'      // Use full free tier, allow small overage
  | 'aggressive'    // Use full free tier + small paid buffer
  | 'unlimited';    // No budget limits (dangerous!)

// ============================================================================
// Core Budget Types
// ============================================================================

/**
 * Provider budget configuration for a user
 *
 * This stores the user's API key and budget limits for a specific provider.
 * The budget can be expressed in USD or tokens, depending on the provider's
 * pricing model.
 *
 * ## Daily Limit Calculation
 *
 * The daily limit is calculated based on the free-tier structure:
 * - For daily reset providers: The exact daily free amount
 * - For monthly reset providers: (Monthly free tier) / 30
 * - For one-time credits: Amortized over expected usage period
 *
 * ## Alert Threshold
 *
 * The alert threshold (0-100) determines when to trigger warnings:
 * - 90: Alert when 90% of free tier is used (conservative)
 * - 95: Alert when 95% is used (balanced)
 * - 100: Alert only when fully exhausted (aggressive)
 *
 * When the alert threshold is reached:
 * 1. User is notified
 * 2. Provider is deprioritized in rotation
 * 3. "Fill knowledge" tasks may be scheduled
 */
export interface ProviderBudget {
  /** Unique identifier for this budget config */
  id: string;

  /** User ID who owns this budget config */
  userId: string;

  /** Provider identifier (e.g., 'openai', 'xai', 'qwen') */
  providerId: BudgetProvider;

  /** User's API key for this provider (encrypted in storage) */
  apiKey: string;

  /** Daily budget limit in USD (or 0 for unlimited) */
  dailyLimit: number;

  /** Amount used today in USD */
  dailyUsed: number;

  /** Alternative: Track by tokens for some providers */
  tokensUsed?: number;

  /** Token limit (if tracking by tokens instead of USD) */
  tokenLimit?: number;

  /** When the daily budget resets (ISO 8601 datetime) */
  resetTime: string;

  /** Reset schedule type */
  resetSchedule: ResetSchedule;

  /** Alert threshold (0-100): Alert when usage exceeds this % of limit */
  alertThreshold: number;

  /** Current budget mode */
  mode: BudgetMode;

  /** Provider priority in rotation (1 = highest) */
  priority: number;

  /** Whether this provider is currently enabled */
  enabled: boolean;

  /** Whether user has pinned this provider (always prefer) */
  pinned: boolean;

  /** Custom provider endpoint URL (for 'custom' provider type) */
  customEndpoint?: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Usage record for a single API call
 *
 * Each API call is recorded to track actual usage against budget.
 * This allows accurate budget tracking and provider rotation decisions.
 */
export interface UsageRecord {
  /** Unique identifier for this usage record */
  id: string;

  /** User who made the request */
  userId: string;

  /** Provider that was used */
  providerId: BudgetProvider;

  /** Model that was called (e.g., 'gpt-4o', 'grok-beta') */
  model: string;

  /** Number of input tokens consumed */
  inputTokens: number;

  /** Number of output tokens consumed */
  outputTokens: number;

  /** Total cost in USD */
  cost: number;

  /** Request duration in milliseconds */
  latencyMs: number;

  /** Whether the request succeeded */
  success: boolean;

  /** Error message if request failed */
  errorMessage?: string;

  /** Context/feature that triggered this request */
  context?: string;

  /** Timestamp of the API call */
  timestamp: string;
}

/**
 * Budget check result for pre-call validation
 *
 * Before making an API call, the system checks if the provider has
 * sufficient budget. This result tells the caller whether to proceed
 * or switch to a different provider.
 */
export interface BudgetCheckResult {
  /** Whether the request is allowed within budget */
  allowed: boolean;

  /** Provider being checked */
  providerId: BudgetProvider;

  /** Remaining budget in USD */
  remaining: number;

  /** Remaining budget as percentage (0-100) */
  remainingPercent: number;

  /** Estimated cost for the pending request */
  estimatedCost: number;

  /** Whether this request would exceed budget */
  wouldExceed: boolean;

  /** Alert if budget is low (>= alert threshold used) */
  alert: boolean;

  /** Message explaining the check result */
  message: string;

  /** Suggested alternative provider if this one is over budget */
  alternativeProvider?: BudgetProvider;

  /** Whether to queue for end-of-day processing instead */
  queueForFillKnowledge?: boolean;
}

/**
 * Pre-call budget check request
 *
 * When the multi-model-router is about to make a call, it sends this
 * request to check if the provider has sufficient budget.
 */
export interface BudgetCheckRequest {
  /** User making the request */
  userId: string;

  /** Provider to check */
  providerId: BudgetProvider;

  /** Model being called */
  model: string;

  /** Estimated input tokens */
  estimatedInputTokens: number;

  /** Estimated output tokens */
  estimatedOutputTokens: number;

  /** Request context for tracking */
  context?: string;
}

/**
 * Daily usage summary for a user
 *
 * Aggregated view of usage across all providers for the current day.
 */
export interface DailyUsageSummary {
  /** User ID */
  userId: string;

  /** Date of this summary (YYYY-MM-DD) */
  date: string;

  /** Total spent across all providers (USD) */
  totalSpent: number;

  /** Total budget across all providers (USD) */
  totalBudget: number;

  /** Budget utilization percentage */
  utilizationPercent: number;

  /** Number of API calls made */
  totalCalls: number;

  /** Total tokens consumed */
  totalTokens: number;

  /** Breakdown by provider */
  byProvider: ProviderUsageSummary[];

  /** Providers with alerts (near/over budget) */
  alerts: ProviderAlert[];
}

/**
 * Per-provider usage summary
 */
export interface ProviderUsageSummary {
  /** Provider identifier */
  providerId: BudgetProvider;

  /** Amount spent (USD) */
  spent: number;

  /** Daily limit (USD) */
  limit: number;

  /** Utilization percentage */
  utilizationPercent: number;

  /** Number of calls */
  calls: number;

  /** Whether provider is over budget */
  overBudget: boolean;

  /** Whether provider is near alert threshold */
  nearLimit: boolean;
}

/**
 * Budget alert notification
 */
export interface ProviderAlert {
  /** Provider with the alert */
  providerId: BudgetProvider;

  /** Alert type */
  type: 'info' | 'warning' | 'critical';

  /** Alert message */
  message: string;

  /** Current usage percentage */
  usagePercent: number;

  /** Alert threshold that was triggered */
  threshold: number;

  /** Timestamp when alert was triggered */
  timestamp: string;
}

// ============================================================================
// Fill Knowledge Types
// ============================================================================

/**
 * Fill knowledge task for end-of-day processing
 *
 * When a free tier is nearly exhausted, the system queues tasks that
 * can use the remaining budget for knowledge expansion. These tasks
 * run at the end of the day to maximize free-tier value.
 *
 * ## Fill Knowledge Strategy
 *
 * The idea is to use every bit of free tier value productively:
 * 1. Pre-generate embeddings for frequently accessed content
 * 2. Warm up caches with common queries
 * 3. Generate training data for fine-tuning
 * 4. Process knowledge base updates
 *
 * By doing this at end-of-day, we ensure no free tier is wasted while
 * also building up the knowledge base for faster/cheaper responses
 * the next day.
 */
export interface FillKnowledgeTask {
  /** Unique identifier */
  id: string;

  /** User who queued this task */
  userId: string;

  /** Provider to use for processing */
  providerId: BudgetProvider;

  /** Task type */
  taskType: FillKnowledgeTaskType;

  /** Task priority (1 = highest) */
  priority: number;

  /** Estimated cost to complete */
  estimatedCost: number;

  /** Task parameters (JSON) */
  parameters: Record<string, unknown>;

  /** Task status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

  /** Number of retry attempts */
  retryCount: number;

  /** Maximum retries allowed */
  maxRetries: number;

  /** Actual cost when completed */
  actualCost?: number;

  /** Result data (JSON) */
  result?: Record<string, unknown>;

  /** Error message if failed */
  errorMessage?: string;

  /** When to schedule this task (ISO 8601) */
  scheduledFor: string;

  /** When task started execution */
  startedAt?: string;

  /** When task completed or failed */
  completedAt?: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Types of fill knowledge tasks
 *
 * These tasks use remaining free-tier budget for knowledge expansion:
 *
 * - `embedding`: Generate embeddings for content to enable semantic search
 * - `cache-warm`: Pre-generate responses for common queries
 * - `training-data`: Generate synthetic training data for fine-tuning
 * - `summarization`: Summarize documents for faster retrieval
 * - `classification`: Classify content for better routing
 */
export type FillKnowledgeTaskType =
  | 'embedding'        // Generate embeddings for knowledge base
  | 'cache-warm'       // Warm up response cache
  | 'training-data'    // Generate training data
  | 'summarization'    // Summarize documents
  | 'classification'   // Classify content
  | 'custom';          // Custom knowledge task

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Request to configure a user's API key and budget for a provider
 */
export interface ConfigureBudgetRequest {
  /** Provider to configure */
  providerId: BudgetProvider;

  /** User's API key for this provider */
  apiKey: string;

  /** Daily budget limit (USD) */
  dailyLimit?: number;

  /** Alert threshold (0-100, default: 90) */
  alertThreshold?: number;

  /** Budget mode (default: 'balanced') */
  mode?: BudgetMode;

  /** Priority in rotation (1-10, default: 5) */
  priority?: number;

  /** Reset schedule (default: 'daily') */
  resetSchedule?: ResetSchedule;

  /** Reset time (HH:MM format, for daily schedule) */
  resetTime?: string;

  /** Custom endpoint URL (for custom provider) */
  customEndpoint?: string;
}

/**
 * Response when configuring a provider budget
 */
export interface ConfigureBudgetResponse {
  /** Whether configuration was successful */
  success: boolean;

  /** Created/updated budget config */
  budget?: ProviderBudget;

  /** Error message if failed */
  error?: string;

  /** Warning messages (e.g., approaching global limit) */
  warnings?: string[];
}

/**
 * Provider rotation recommendation
 *
 * Based on current budget status, suggests which provider to use next.
 */
export interface ProviderRecommendation {
  /** Recommended provider */
  providerId: BudgetProvider;

  /** Reason for recommendation */
  reason: string;

  /** Remaining budget */
  remaining: number;

  /** Expected cost savings vs alternatives */
  savingsVsAlternative?: number;
}

/**
 * Budget status for all providers
 */
export interface AllProvidersStatus {
  /** User ID */
  userId: string;

  /** Status of each configured provider */
  providers: ProviderBudget[];

  /** Current daily summary */
  summary: DailyUsageSummary;

  /** Recommended provider for next request */
  recommendation: ProviderRecommendation;

  /** Pending fill-knowledge tasks */
  pendingTasks: FillKnowledgeTask[];
}

// ============================================================================
// Cost Calculation Types
// ============================================================================

/**
 * Provider pricing information
 *
 * Used to estimate costs before making API calls.
 */
export interface ProviderPricing {
  /** Provider identifier */
  providerId: BudgetProvider;

  /** Model name */
  model: string;

  /** Cost per 1M input tokens (USD) */
  inputCostPerMillion: number;

  /** Cost per 1M output tokens (USD) */
  outputCostPerMillion: number;

  /** Whether provider has free tier */
  hasFreeTier: boolean;

  /** Free tier daily limit (USD) */
  freeTierDailyLimit?: number;

  /** Free tier reset schedule */
  freeTierResetSchedule?: ResetSchedule;
}

/**
 * Free tier information for providers
 *
 * Cached information about each provider's free tier offering.
 */
export interface FreeTierInfo {
  /** Provider identifier */
  providerId: BudgetProvider;

  /** Whether provider offers free tier */
  hasFreeTier: boolean;

  /** Free tier daily limit (USD) */
  dailyLimit: number;

  /** Reset schedule */
  resetSchedule: ResetSchedule;

  /** Reset time (for daily schedule) */
  resetTime: string;

  /** Notes about the free tier */
  notes: string;

  /** Link to provider's pricing page */
  pricingUrl: string;

  /** Last updated timestamp */
  lastUpdated: string;
}
