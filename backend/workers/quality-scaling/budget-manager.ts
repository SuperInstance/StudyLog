/**
 * Budget Manager Module
 *
 * Manages user budget tiers and quality constraints based on subscription.
 * Integrates with the budget-tracker worker for actual budget tracking.
 *
 * @fileoverview User budget and subscription quality management
 */

import type {
  UserBudget,
  BudgetTier,
  QualityTier,
  QualityConstraint,
  UpdateBudgetRequest,
} from './types.js';

// ============================================================================
// Budget Tier Configuration
// ============================================================================

/**
 * Maximum quality tier allowed for each budget tier.
 */
export const BUDGET_TIER_LIMITS: Record<BudgetTier, QualityTier> = {
  [BudgetTier.FREE]: QualityTier.LOW,      // Free users capped at LOW
  [BudgetTier.BASIC]: QualityTier.MEDIUM,  // Basic users capped at MEDIUM
  [BudgetTier.PREMIUM]: QualityTier.HIGH,  // Premium users capped at HIGH
  [BudgetTier.UNLIMITED]: QualityTier.ULTRA, // Unlimited users get ULTRA
};

/**
 * Daily cost allowance per budget tier (in USD).
 * This is how much "quality budget" each tier gets per day.
 */
export const DAILY_ALLOWANCES: Record<BudgetTier, number> = {
  [BudgetTier.FREE]: 0.00,      // No spending allowance
  [BudgetTier.BASIC]: 0.50,     // $0.50/day
  [BudgetTier.PREMIUM]: 2.00,   // $2.00/day
  [BudgetTier.UNLIMITED]: Infinity,
};

/**
 * Quality upgrade costs per tier (one-time charges).
 * Users can pay to unlock higher quality tiers temporarily.
 */
export const UPGRADE_COSTS: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 0,
  [QualityTier.LOW]: 0,
  [QualityTier.MEDIUM]: 0.10,    // $0.10 to upgrade to MEDIUM
  [QualityTier.HIGH]: 0.50,      // $0.50 to upgrade to HIGH
  [QualityTier.ULTRA]: 1.00,     // $1.00 to upgrade to ULTRA
};

/**
 * Grain token costs for permanent quality unlocks.
 */
export const GRAIN_UNLOCK_COSTS: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 0,
  [QualityTier.LOW]: 0,
  [QualityTier.MEDIUM]: 100,     // 100 grain for MEDIUM unlock
  [QualityTier.HIGH]: 500,       // 500 grain for HIGH unlock
  [QualityTier.ULTRA]: 2000,     // 2000 grain for ULTRA unlock
};

// ============================================================================
// Default User Budget
// ============================================================================

/**
 * Create a default user budget for new users.
 */
export function createDefaultUserBudget(userId: string): UserBudget {
  return {
    userId,
    tier: BudgetTier.FREE,
    dailyRemaining: 0,
    dailyLimit: DAILY_ALLOWANCES[BudgetTier.FREE],
    monthlyRemaining: 0,
    monthlyLimit: 0,
    grainBalance: 0,
    preference: 'balanced',
    highQualityOptIn: false,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Quality Constraint Calculation
// ============================================================================

/**
 * Calculate quality constraints based on budget and user preferences.
 */
export function calculateQualityConstraints(
  budget: UserBudget,
  hardwareMaxTier: QualityTier
): QualityConstraint {
  // Get the maximum tier allowed by budget
  const budgetMaxTier = BUDGET_TIER_LIMITS[budget.tier];

  // Check if user has override (e.g., grain unlock)
  let effectiveMaxTier = budgetMaxTier;
  if (budget.overrideTier !== undefined) {
    effectiveMaxTier = Math.min(budget.overrideTier, budgetMaxTier);
  }

  // The actual maximum is the minimum of budget and hardware
  const maxTier = Math.min(effectiveMaxTier, hardwareMaxTier) as QualityTier;

  // Check if quality is limited by hardware
  const hardwareLimited = effectiveMaxTier > hardwareMaxTier;

  // Check if quality is limited by budget
  const budgetLimited = effectiveMaxTier < hardwareMaxTier;

  // Can upgrade via payment or grain
  const canUpgrade = budgetLimited && budget.tier < BudgetTier.UNLIMITED;

  // Determine recommended tier based on preference
  let recommendedTier: QualityTier;
  switch (budget.preference) {
    case 'performance':
      recommendedTier = Math.max(QualityTier.POTATO, maxTier - 1) as QualityTier;
      break;
    case 'ultra':
    case 'quality':
      recommendedTier = maxTier;
      break;
    case 'balanced':
    default:
      recommendedTier = Math.max(QualityTier.LOW, maxTier - 1) as QualityTier;
      break;
  }

  // High quality opt-in bumps up recommendation
  if (budget.highQualityOptIn && recommendedTier < maxTier) {
    recommendedTier = maxTier;
  }

  return {
    maxTier,
    minTier: QualityTier.POTATO,
    recommendedTier,
    hardwareTier: budget.tier,
    budgetTier: budget.tier,
    hardwareLimited,
    budgetLimited,
    canUpgrade,
  };
}

/**
 * Check if a user can afford a quality upgrade.
 */
export function canAffordUpgrade(
  budget: UserBudget,
  targetTier: QualityTier,
  useGrain: boolean = false
): { canAfford: boolean; cost: number; currency: 'usd' | 'grain' } {
  if (targetTier <= BUDGET_TIER_LIMITS[budget.tier]) {
    // Already have access to this tier
    return { canAfford: true, cost: 0, currency: 'usd' };
  }

  if (useGrain) {
    const cost = GRAIN_UNLOCK_COSTS[targetTier];
    return {
      canAfford: budget.grainBalance >= cost,
      cost,
      currency: 'grain',
    };
  }

  const cost = UPGRADE_COSTS[targetTier];
  return {
    canAfford: budget.dailyRemaining >= cost,
    cost,
    currency: 'usd',
  };
}

/**
 * Process a quality upgrade purchase.
 */
export function processUpgrade(
  budget: UserBudget,
  targetTier: QualityTier,
  useGrain: boolean = false
): UserBudget | null {
  const { canAfford, cost } = canAffordUpgrade(budget, targetTier, useGrain);

  if (!canAfford) {
    return null;
  }

  const updated = { ...budget };

  if (useGrain) {
    updated.grainBalance -= cost;
  } else {
    updated.dailyRemaining -= cost;
    updated.monthlyRemaining -= cost;
  }

  // Set override tier
  updated.overrideTier = targetTier;
  updated.updatedAt = new Date().toISOString();

  return updated;
}

/**
 * Reset daily budget for a user.
 */
export function resetDailyBudget(budget: UserBudget): UserBudget {
  return {
    ...budget,
    dailyRemaining: DAILY_ALLOWANCES[budget.tier],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Reset monthly budget for a user.
 */
export function resetMonthlyBudget(budget: UserBudget, monthlyLimit: number): UserBudget {
  return {
    ...budget,
    monthlyRemaining: monthlyLimit,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Budget Tier Management
// ============================================================================

/**
 * Upgrade user to a higher budget tier.
 */
export function upgradeBudgetTier(
  budget: UserBudget,
  newTier: BudgetTier,
  monthlyLimit?: number
): UserBudget {
  return {
    ...budget,
    tier: newTier,
    dailyLimit: DAILY_ALLOWANCES[newTier],
    dailyRemaining: DAILY_ALLOWANCES[newTier],
    monthlyLimit: monthlyLimit ?? (newTier === BudgetTier.UNLIMITED ? Infinity : monthlyLimit ?? 0),
    monthlyRemaining: monthlyLimit ?? (newTier === BudgetTier.UNLIMITED ? Infinity : budget.monthlyRemaining),
    // Clear override when tier changes
    overrideTier: undefined,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if user's budget needs reset based on time.
 */
export function checkBudgetReset(budget: UserBudget): UserBudget {
  const now = new Date();
  const updatedAt = new Date(budget.updatedAt);

  let updated = budget;

  // Reset daily if it's a new day
  if (now.getDate() !== updatedAt.getDate() ||
      now.getMonth() !== updatedAt.getMonth() ||
      now.getFullYear() !== updatedAt.getFullYear()) {
    updated = resetDailyBudget(updated);
  }

  // Reset monthly if it's a new month
  if (now.getMonth() !== updatedAt.getMonth() ||
      now.getFullYear() !== updatedAt.getFullYear()) {
    updated = resetMonthlyBudget(updated, updated.monthlyLimit);
  }

  return updated;
}

// ============================================================================
// Update Budget from Request
// ============================================================================

/**
 * Update user budget from a request.
 */
export function updateBudgetFromRequest(
  current: UserBudget,
  request: UpdateBudgetRequest
): UserBudget {
  const updated = { ...current };

  if (request.tier !== undefined) {
    updated.tier = request.tier;
    updated.dailyLimit = DAILY_ALLOWANCES[request.tier];
  }

  if (request.dailyRemaining !== undefined) {
    updated.dailyRemaining = request.dailyRemaining;
  }

  if (request.monthlyRemaining !== undefined) {
    updated.monthlyRemaining = request.monthlyRemaining;
  }

  if (request.grainBalance !== undefined) {
    updated.grainBalance = request.grainBalance;
  }

  if (request.preference !== undefined) {
    updated.preference = request.preference;
  }

  updated.updatedAt = new Date().toISOString();

  return updated;
}

// ============================================================================
// Budget Queries
// ============================================================================

/**
 * Get the maximum quality tier available to a user.
 */
export function getMaxAvailableTier(budget: UserBudget): QualityTier {
  return BUDGET_TIER_LIMITS[budget.tier];
}

/**
 * Check if user has unlimited budget.
 */
export function isUnlimited(budget: UserBudget): boolean {
  return budget.tier === BudgetTier.UNLIMITED;
}

/**
 * Get budget tier name for display.
 */
export function getBudgetTierName(tier: BudgetTier): string {
  switch (tier) {
    case BudgetTier.FREE: return 'Free';
    case BudgetTier.BASIC: return 'Basic';
    case BudgetTier.PREMIUM: return 'Premium';
    case BudgetTier.UNLIMITED: return 'Unlimited';
    default: return 'Unknown';
  }
}

/**
 * Format user budget for display.
 */
export function formatUserBudget(budget: UserBudget): string {
  const lines: string[] = [];

  lines.push(`User Budget: ${budget.userId}`);
  lines.push('='.repeat(40));
  lines.push(`Tier: ${getBudgetTierName(budget.tier)}`);
  lines.push(`Preference: ${budget.preference}`);
  lines.push('');
  lines.push('Daily Budget:');
  lines.push(`  $${budget.dailyRemaining.toFixed(2)} / $${budget.dailyLimit.toFixed(2)} remaining`);
  lines.push('');
  lines.push('Monthly Budget:');
  const monthlyLimit = budget.monthlyLimit === Infinity ? 'Unlimited' : `$${budget.monthlyLimit.toFixed(2)}`;
  const monthlyRemaining = budget.monthlyRemaining === Infinity ? 'Unlimited' : `$${budget.monthlyRemaining.toFixed(2)}`;
  lines.push(`  ${monthlyRemaining} / ${monthlyLimit} remaining`);
  lines.push('');
  lines.push(`Grain Balance: ${budget.grainBalance}`);
  lines.push('');
  lines.push(`Max Quality Tier: ${QualityTier[getMaxAvailableTier(budget)]}`);

  if (budget.overrideTier !== undefined) {
    lines.push(`Override Tier: ${QualityTier[budget.overrideTier]}`);
  }

  return lines.join('\n');
}

// ============================================================================
// Grain Token Economy
// ============================================================================

/**
 * Award grain tokens to a user.
 */
export function awardGrain(budget: UserBudget, amount: number): UserBudget {
  return {
    ...budget,
    grainBalance: budget.grainBalance + amount,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Spend grain tokens if available.
 */
export function spendGrain(budget: UserBudget, amount: number): UserBudget | null {
  if (budget.grainBalance < amount) {
    return null;
  }

  return {
    ...budget,
    grainBalance: budget.grainBalance - amount,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate grain reward based on contribution quality.
 */
export function calculateGrainReward(qualityScore: number, uses: number): number {
  // Base reward
  let reward = 10;

  // Quality multiplier (1-4 Fuse Grade)
  reward *= qualityScore;

  // Popularity multiplier (uses)
  reward *= Math.log10(uses + 1);

  return Math.floor(reward);
}

/**
 * Get grain costs for various actions.
 */
export const GRAIN_COSTS = {
  UNLOCK_MEDIUM: GRAIN_UNLOCK_COSTS[QualityTier.MEDIUM],
  UNLOCK_HIGH: GRAIN_UNLOCK_COSTS[QualityTier.HIGH],
  UNLOCK_ULTRA: GRAIN_UNLOCK_COSTS[QualityTier.ULTRA],
  FORK_CREATION: 5,
  MERGE_REQUEST: 10,
  PREMIUM_SUPPORT: 50,
  CUSTOM_BADGE: 500,
};

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Create a budget manager instance.
 */
export function createBudgetManager() {
  return {
    createDefault: createDefaultUserBudget,
    calculateConstraints: calculateQualityConstraints,
    canAffordUpgrade,
    processUpgrade,
    upgradeTier: upgradeBudgetTier,
    checkReset: checkBudgetReset,
    updateFromRequest: updateBudgetFromRequest,
    getMaxTier: getMaxAvailableTier,
    isUnlimited,
    awardGrain,
    spendGrain,
    calculateReward: calculateGrainReward,
    format: formatUserBudget,
  };
}
