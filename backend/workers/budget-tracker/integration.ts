/**
 * Budget Tracker Integration Module
 *
 * This module provides integration points for the multi-model-router
 * to use budget tracking before and after API calls.
 *
 * ## Integration with Multi-Model Router
 *
 * The integration works in two phases:
 *
 * 1. **Pre-call Check (before API call)**:
 *    - Query budget-tracker for remaining budget
 *    - Estimate request cost based on model and token count
 *    - Return allow/deny decision
 *    - Suggest alternative provider if budget exceeded
 *
 * 2. **Post-call Record (after API call)**:
 *    - Record actual tokens used and cost
 *    - Update daily usage
 *    - Trigger alerts if near limit
 *    - Schedule fill-knowledge tasks if nearly exhausted
 *
 * ## Provider Rotation for Maximizing Free Tiers
 *
 * When a provider's budget is exhausted, the system:
 * 1. Checks budget-tracker for alternative providers
 * 2. Selects provider with most remaining free-tier budget
 * 3. Prioritizes by: remaining % > priority > pinned status
 * 4. Logs the rotation decision for analytics
 *
 * ## Usage Example
 *
 * ```ts
 * import { checkBudget, recordUsage, selectProvider } from './budget-tracker/integration';
 *
 * // Before making API call
 * const check = await checkBudget(env, userId, 'openai', 'gpt-4o', 1000, 500);
 * if (!check.allowed) {
 *   const alternative = await selectProvider(env, userId);
 *   // Use alternative provider instead
 * }
 *
 * // After API call completes
 * await recordUsage(env, {
 *   userId,
 *   providerId: 'openai',
 *   model: 'gpt-4o',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 *   cost: 0.005,
 * });
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Budget check configuration
 */
export interface BudgetCheckConfig {
  /** User making the request */
  userId: string;

  /** Provider to check */
  providerId: string;

  /** Model being called */
  model: string;

  /** Estimated input tokens */
  estimatedInputTokens: number;

  /** Estimated output tokens */
  estimatedOutputTokens: number;

  /** Request context for tracking */
  context?: string;

  /** Budget tracker worker URL */
  budgetTrackerUrl?: string;
}

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  /** Whether the request is allowed */
  allowed: boolean;

  /** Provider being checked */
  providerId: string;

  /** Remaining budget in USD */
  remaining: number;

  /** Remaining as percentage */
  remainingPercent: number;

  /** Estimated cost */
  estimatedCost: number;

  /** Would this exceed budget */
  wouldExceed: boolean;

  /** Alert triggered */
  alert: boolean;

  /** Message */
  message: string;

  /** Alternative provider suggested */
  alternativeProvider?: string;

  /** Queue for fill knowledge */
  queueForFillKnowledge?: boolean;
}

/**
 * Usage record configuration
 */
export interface UsageRecordConfig {
  /** User who made the request */
  userId: string;

  /** Provider used */
  providerId: string;

  /** Model called */
  model: string;

  /** Input tokens consumed */
  inputTokens: number;

  /** Output tokens consumed */
  outputTokens: number;

  /** Actual cost in USD */
  cost: number;

  /** Request latency in milliseconds */
  latencyMs?: number;

  /** Whether request succeeded */
  success?: boolean;

  /** Error message if failed */
  errorMessage?: string;

  /** Request context */
  context?: string;

  /** Budget tracker worker URL */
  budgetTrackerUrl?: string;
}

/**
 * Provider selection configuration
 */
export interface ProviderSelectionConfig {
  /** User to select provider for */
  userId: string;

  /** Exclude this provider from selection */
  excludeProvider?: string;

  /** Preferred provider type (optional) */
  preferredCategory?: 'llm' | 'image' | 'audio';

  /** Budget tracker worker URL */
  budgetTrackerUrl?: string;
}

/**
 * Selected provider information
 */
export interface SelectedProvider {
  /** Provider ID */
  providerId: string;

  /** Reason for selection */
  reason: string;

  /** Remaining budget */
  remaining: number;

  /** Remaining percentage */
  remainingPercent: number;
}

// ============================================================================
// Default Pricing Data (fallback if budget tracker unavailable)
// ============================================================================

/**
 * Default provider pricing for cost estimation.
 * Used as fallback when budget-tracker service is unavailable.
 */
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'openai:gpt-4o': { input: 2.50, output: 10.00 },
  'openai:gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openai:gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'xai:grok-beta': { input: 5.00, output: 15.00 },
  'google:gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'google:gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'anthropic:claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'anthropic:claude-3-5-haiku': { input: 0.80, output: 4.00 },
  'deepseek:deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek:deepseek-coder': { input: 0.14, output: 0.28 },
  'zhipu:glm-4-flash': { input: 0.01, output: 0.01 },
  'nvidia:llama-3.1-405b': { input: 0.40, output: 0.40 },
  'ollama:*': { input: 0, output: 0 },
};

// ============================================================================
// Budget Check Functions
// ============================================================================

/**
 * Check if a provider has sufficient budget for a request.
 *
 * This function queries the budget-tracker worker to determine if
 * the user has sufficient remaining free-tier budget for the request.
 *
 * ## How Budget Checks Optimize Free-Tier Usage
 *
 * 1. **Cost Estimation**: Calculates expected cost based on:
 *    - Provider's per-token pricing
 *    - Estimated input/output tokens
 *    - Model-specific pricing tiers
 *
 * 2. **Budget Comparison**: Compares estimated cost to:
 *    - Remaining daily budget
 *    - Alert threshold (default 90%)
 *    - Budget mode (conservative/balanced/aggressive)
 *
 * 3. **Decision**: Returns allow/deny with:
 *    - Alternative provider suggestion if denied
 *    - Alert trigger if near threshold
 *    - Fill-knowledge queue if nearly exhausted
 *
 * @param env - Cloudflare Worker environment
 * @param config - Budget check configuration
 * @returns Budget check result
 */
export async function checkBudget(
  env: { BUDGET_TRACKER_URL?: string; fetch?: typeof fetch },
  config: BudgetCheckConfig
): Promise<BudgetCheckResult> {
  const budgetTrackerUrl = config.budgetTrackerUrl || env.BUDGET_TRACKER_URL;

  if (!budgetTrackerUrl) {
    // Budget tracking not configured, allow all requests
    return {
      allowed: true,
      providerId: config.providerId,
      remaining: Infinity,
      remainingPercent: 100,
      estimatedCost: 0,
      wouldExceed: false,
      alert: false,
      message: 'Budget tracking not configured, allowing request',
    };
  }

  try {
    const response = await fetch(`${budgetTrackerUrl}/budget/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: config.userId,
        providerId: config.providerId,
        model: config.model,
        estimatedInputTokens: config.estimatedInputTokens,
        estimatedOutputTokens: config.estimatedOutputTokens,
        context: config.context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Budget check failed: ${response.status}`);
    }

    return await response.json() as BudgetCheckResult;
  } catch (error) {
    // On error, log but allow request (fail-open)
    console.error('[Budget Check] Error:', error);
    return {
      allowed: true,
      providerId: config.providerId,
      remaining: Infinity,
      remainingPercent: 100,
      estimatedCost: 0,
      wouldExceed: false,
      alert: false,
      message: `Budget check unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Record actual usage after an API call completes.
 *
 * This function reports the actual token usage and cost to the
 * budget-tracker for accurate daily budget tracking.
 *
 * ## Post-Call Processing
 *
 * After recording usage:
 * 1. Updates daily_used in provider_budgets
 * 2. Checks if alert threshold is breached
 * 3. Schedules fill-knowledge tasks if nearly exhausted
 * 4. Clears budget cache for stale data
 *
 * @param env - Cloudflare Worker environment
 * @param config - Usage record configuration
 * @returns Success status
 */
export async function recordUsage(
  env: { BUDGET_TRACKER_URL?: string; fetch?: typeof fetch },
  config: UsageRecordConfig
): Promise<boolean> {
  const budgetTrackerUrl = config.budgetTrackerUrl || env.BUDGET_TRACKER_URL;

  if (!budgetTrackerUrl) {
    return true; // No budget tracking configured
  }

  try {
    const response = await fetch(`${budgetTrackerUrl}/budget/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: config.userId,
        providerId: config.providerId,
        model: config.model,
        inputTokens: config.inputTokens,
        outputTokens: config.outputTokens,
        cost: config.cost,
        latencyMs: config.latencyMs,
        success: config.success !== false,
        errorMessage: config.errorMessage,
        context: config.context,
      }),
    });

    if (!response.ok) {
      throw new Error(`Usage record failed: ${response.status}`);
    }

    const result = await response.json() as { success: boolean };
    return result.success;
  } catch (error) {
    console.error('[Usage Record] Error:', error);
    return false;
  }
}

// ============================================================================
// Provider Selection Functions
// ============================================================================

/**
 * Select the best provider for a user based on budget status.
 *
 * ## Provider Rotation Algorithm
 *
 * The selection algorithm prioritizes:
 * 1. **Pinned Providers**: User-pinned providers get priority boost
 * 2. **Remaining Budget %**: More free tier = higher priority
 * 3. **Priority Score**: User-configured priority (1-10)
 * 4. **Cost Efficiency**: Cheaper providers preferred within budget tier
 *
 * ## When All Providers Are Exhausted
 *
 * If all free-tier providers are exhausted:
 * - Returns 'ollama' (local model) as fallback
 * - Local models have no API cost
 * - May be slower but prevents overage charges
 *
 * @param env - Cloudflare Worker environment
 * @param config - Provider selection configuration
 * @returns Selected provider or null
 */
export async function selectProvider(
  env: { BUDGET_TRACKER_URL?: string; fetch?: typeof fetch },
  config: ProviderSelectionConfig
): Promise<SelectedProvider | null> {
  const budgetTrackerUrl = config.budgetTrackerUrl || env.BUDGET_TRACKER_URL;

  if (!budgetTrackerUrl) {
    return null;
  }

  try {
    const response = await fetch(`${budgetTrackerUrl}/budget/status/${config.userId}`);

    if (!response.ok) {
      throw new Error(`Provider status failed: ${response.status}`);
    }

    const status = await response.json() as {
      providers: Array<{
        providerId: string;
        dailyLimit: number;
        dailyUsed: number;
        priority: number;
        pinned: boolean;
        enabled: boolean;
      }>;
      recommendation: {
        providerId: string;
        reason: string;
        remaining: number;
      };
    };

    // Filter out excluded provider and disabled providers
    const availableProviders = status.providers.filter(p =>
      p.enabled &&
      p.providerId !== config.excludeProvider &&
      p.dailyUsed < p.dailyLimit
    );

    if (availableProviders.length === 0) {
      // All providers exhausted, return Ollama fallback
      return {
        providerId: 'ollama',
        reason: 'All free-tier providers exhausted, using local model',
        remaining: Infinity,
        remainingPercent: 100,
      };
    }

    // Use the recommendation from budget-tracker
    const recommended = availableProviders.find(p =>
      p.providerId === status.recommendation.providerId
    );

    if (recommended) {
      const remaining = recommended.dailyLimit - recommended.dailyUsed;
      return {
        providerId: recommended.providerId,
        reason: status.recommendation.reason || 'Best available provider by budget',
        remaining,
        remainingPercent: (remaining / recommended.dailyLimit) * 100,
      };
    }

    // Fallback: select provider with most remaining budget percentage
    const bestProvider = availableProviders
      .map(p => ({
        ...p,
        remaining: p.dailyLimit - p.dailyUsed,
        remainingPercent: ((p.dailyLimit - p.dailyUsed) / p.dailyLimit) * 100,
      }))
      .sort((a, b) => {
        // Pinned providers first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        // Then by priority (lower number = higher priority)
        if (a.priority !== b.priority) return a.priority - b.priority;
        // Then by remaining percentage
        return b.remainingPercent - a.remainingPercent;
      })[0];

    return {
      providerId: bestProvider.providerId,
      reason: `Provider with most remaining budget (${bestProvider.remainingPercent.toFixed(1)}%)`,
      remaining: bestProvider.remaining,
      remainingPercent: bestProvider.remainingPercent,
    };
  } catch (error) {
    console.error('[Provider Selection] Error:', error);
    return null;
  }
}

// ============================================================================
// Cost Estimation Functions
// ============================================================================

/**
 * Estimate the cost of an API request.
 *
 * Uses provider pricing data to estimate cost before making the request.
 * This is used by the budget check to determine if sufficient budget exists.
 *
 * @param providerId - Provider identifier
 * @param model - Model name
 * @param inputTokens - Estimated input tokens
 * @param outputTokens - Estimated output tokens
 * @returns Estimated cost in USD
 */
export function estimateCost(
  providerId: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricingKey = `${providerId}:${model}`;
  const pricing = DEFAULT_PRICING[pricingKey] ||
                  DEFAULT_PRICING[`${providerId}:*`] ||
                  { input: 1.0, output: 1.0 };

  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

/**
 * Get pricing information for a provider/model combination.
 *
 * @param providerId - Provider identifier
 * @param model - Model name
 * @returns Pricing per million tokens or null
 */
export function getPricing(
  providerId: string,
  model: string
): { input: number; output: number } | null {
  const pricingKey = `${providerId}:${model}`;
  return DEFAULT_PRICING[pricingKey] ||
         DEFAULT_PRICING[`${providerId}:*`] ||
         null;
}

// ============================================================================
// Middleware for Multi-Model Router
// ============================================================================

/**
 * Middleware wrapper for budget-aware provider calls.
 *
 * Wraps a provider call with budget checking and usage recording.
 * Automatically handles provider rotation if budget is exceeded.
 *
 * @param env - Cloudflare Worker environment
 * @param config - Budget configuration
 * @param callFn - Function to call the provider
 * @returns Provider response with budget metadata
 */
export async function withBudgetCheck<T extends { cost: number; tokens: { input: number; output: number } }>(
  env: { BUDGET_TRACKER_URL?: string; fetch?: typeof fetch },
  config: BudgetCheckConfig & { userId: string },
  callFn: () => Promise<T>
): Promise<T & { budgetChecked: boolean; providerRotated: boolean }> {
  // Check budget before call
  const check = await checkBudget(env, config);

  if (!check.allowed) {
    // Try alternative provider
    if (check.alternativeProvider) {
      const alternative = await selectProvider(env, {
        userId: config.userId,
        excludeProvider: config.providerId,
      });

      if (alternative) {
        throw new Error(`Budget exceeded for ${config.providerId}. Use alternative: ${alternative.providerId}`);
      }
    }

    throw new Error(`Budget exceeded for ${config.providerId}: ${check.message}`);
  }

  // Make the API call
  const response = await callFn();

  // Record usage after call
  await recordUsage(env, {
    userId: config.userId,
    providerId: config.providerId,
    model: config.model,
    inputTokens: response.tokens.input,
    outputTokens: response.tokens.output,
    cost: response.cost,
    context: config.context,
  });

  return {
    ...response,
    budgetChecked: true,
    providerRotated: false,
  };
}
