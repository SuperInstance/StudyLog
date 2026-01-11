/**
 * Transfer Rules Engine
 *
 * Defines what transfers between products (and what doesn't).
 * Rules govern when memories are eligible for transfer, how they
 * should be transformed, and what user approval is needed.
 *
 * Rule Categories:
 * - Eligibility Rules: What can be transferred
 * - Transformation Rules: How content should be transformed
 * - Approval Rules: When user approval is needed
 * - Privacy Rules: What data can be shared
 *
 * Rules can be:
 * - Default: Built-in rules for common cases
 * - Custom: User-defined rules
 * - Learned: Rules learned from user behavior
 */

import {
  Product,
  TransferDirection,
  TransferCategory,
  TransferStatus,
  MemoryTier,
  TransferRule,
  TransferCondition,
  TransferAction,
  TransferConfidence,
  MemoryTransfer,
} from './types.js';

// ============================================================================
// Rule Types
// ============================================================================

/**
 * Rule priority levels
 */
export enum RulePriority {
  CRITICAL = 1000,
  HIGH = 500,
  MEDIUM = 100,
  LOW = 50,
  DEFAULT = 10,
}

/**
 * Rule evaluation context
 */
export interface RuleEvaluationContext {
  /** Source product */
  sourceProduct: Product;
  /** Target product */
  targetProduct: Product;
  /** Transfer direction */
  direction: TransferDirection;
  /** Source memory tier */
  sourceTier: MemoryTier;
  /** Transfer category */
  category: TransferCategory;
  /** Memory importance (1-10) */
  importance: number;
  /** User ID */
  userId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Additional context */
  metadata: Record<string, unknown>;
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  /** Rule ID */
  ruleId: string;
  /** Whether rule matched */
  matched: boolean;
  /** Actions to take */
  actions: TransferAction[];
  /** Reason for result */
  reason: string;
  /** Rule priority */
  priority: number;
}

/**
 * Transfer eligibility result
 */
export interface EligibilityResult {
  /** Whether transfer is eligible */
  eligible: boolean;
  /** Required approval from user */
  requiresApproval: boolean;
  /** Confidence in eligibility decision */
  confidence: number;
  /** Reasons for decision */
  reasons: string[];
  /** Suggested transformations */
  suggestedTransformations: string[];
  /** Blocking rules */
  blockingRules: string[];
}

// ============================================================================
// Default Transfer Rules
// ============================================================================

/**
 * Built-in rules for common transfer scenarios
 */
export const DEFAULT_TRANSFER_RULES: TransferRule[] = [
  // High-confidence skill transfers
  {
    id: 'rule_high_confidence_skill',
    name: 'Auto-approve high confidence skill transfers',
    sourceProduct: Product.STUDYLOG,
    targetProduct: Product.DMLOG,
    direction: TransferDirection.STUDYLOG_TO_DMLOG,
    categories: [
      TransferCategory.PROBLEM_SOLVING,
      TransferCategory.COLLABORATION,
      TransferCategory.PERSISTENCE,
      TransferCategory.COMMUNICATION,
    ],
    minConfidenceForAuto: 0.85,
    active: true,
    priority: RulePriority.HIGH,
    conditions: [
      {
        type: 'importance_threshold',
        value: 6.0,
      },
      {
        type: 'tier_match',
        value: [MemoryTier.PROCEDURAL, MemoryTier.SEMANTIC],
      },
    ],
    actions: [
      {
        type: 'auto_approve',
      },
      {
        type: 'transform',
        params: {
          preserveConfidence: true,
          addCrossProductTag: true,
        },
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },

  // Low-confidence transfers require approval
  {
    id: 'rule_low_confidence_approval',
    name: 'Require approval for low confidence transfers',
    sourceProduct: Product.STUDYLOG,
    targetProduct: Product.DMLOG,
    direction: TransferDirection.BIDIRECTIONAL,
    categories: Object.values(TransferCategory) as TransferCategory[],
    minConfidenceForAuto: 0.5,
    active: true,
    priority: RulePriority.MEDIUM,
    conditions: [
      {
        type: 'importance_threshold',
        value: 3.0,
        negate: false,
      },
    ],
    actions: [
      {
        type: 'require_approval',
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },

  // Block working memory transfers
  {
    id: 'rule_block_working_memory',
    name: 'Block transfers from working memory',
    sourceProduct: Product.STUDYLOG,
    targetProduct: Product.DMLOG,
    direction: TransferDirection.BIDIRECTIONAL,
    categories: Object.values(TransferCategory) as TransferCategory[],
    minConfidenceForAuto: 0,
    active: true,
    priority: RulePriority.CRITICAL,
    conditions: [
      {
        type: 'tier_match',
        value: [MemoryTier.WORKING],
      },
    ],
    actions: [
      {
        type: 'reject',
        params: {
          reason: 'Working memory is too transient for cross-product transfer',
        },
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },

  // Identity tier transfers require special handling
  {
    id: 'rule_identity_special_handling',
    name: 'Special handling for identity-level traits',
    sourceProduct: Product.STUDYLOG,
    targetProduct: Product.DMLOG,
    direction: TransferDirection.BIDIRECTIONAL,
    categories: [
      TransferCategory.PERSISTENCE,
      TransferCategory.CURIOSITY,
      TransferCategory.RESILIENCE,
    ],
    minConfidenceForAuto: 0.9,
    active: true,
    priority: RulePriority.HIGH,
    conditions: [
      {
        type: 'tier_match',
        value: [MemoryTier.IDENTITY],
      },
    ],
    actions: [
      {
        type: 'require_approval',
      },
      {
        type: 'transform',
        params: {
          mergeMode: 'weighted_average',
          preserveSource: true,
        },
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },

  // Creative skills have lower threshold
  {
    id: 'rule_creative_skills',
    name: 'Lower threshold for creative skills',
    sourceProduct: Product.STUDYLOG,
    targetProduct: Product.DMLOG,
    direction: TransferDirection.STUDYLOG_TO_DMLOG,
    categories: [
      TransferCategory.CREATIVITY,
      TransferCategory.IMPROVISATION as any,
    ],
    minConfidenceForAuto: 0.7,
    active: true,
    priority: RulePriority.MEDIUM,
    conditions: [
      {
        type: 'importance_threshold',
        value: 4.0,
      },
    ],
    actions: [
      {
        type: 'transform',
        params: {
          targetForm: 'ability',
          narrativeStyle: 'creative',
        },
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },

  // Block transfers with private tags
  {
    id: 'rule_private_tags',
    name: 'Block transfers with private tags',
    sourceProduct: Product.ANY,
    targetProduct: Product.ANY,
    direction: TransferDirection.BIDIRECTIONAL,
    categories: Object.values(TransferCategory) as TransferCategory[],
    minConfidenceForAuto: 0,
    active: true,
    priority: RulePriority.CRITICAL,
    conditions: [
      {
        type: 'user_permission',
        value: 'no_private_tags',
      },
    ],
    actions: [
      {
        type: 'reject',
        params: {
          reason: 'Memory contains private tags',
        },
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  },
];

// Add Product.ANY for compatibility
(Product as any).ANY = 'any' as Product;

// ============================================================================
// Privacy Rules
// ============================================================================

/**
 * Privacy-sensitive categories that require additional scrutiny
 */
export const PRIVACY_SENSITIVE_CATEGORIES: TransferCategory[] = [
  TransferCategory.EMPATHY,
  TransferCategory.LEADERSHIP,
  TransferCategory.IDENTITY as any,
];

/**
 * Data types that require explicit consent
 */
export const CONSENT_REQUIRED_DATA: string[] = [
  'biometric',
  'health_data',
  'location_history',
  'personal_identifiers',
  'financial',
];

/**
 * Privacy rules for data sharing
 */
export interface PrivacyRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Whether this rule applies */
  applies: (context: RuleEvaluationContext) => boolean;
  /** Required consent level */
  consentLevel: 'none' | 'basic' | 'explicit' | 'none_of_the_above';
  /** Data transformations for privacy */
  transformations?: Array<{
    type: 'anonymize' | 'aggregate' | 'redact' | 'transform';
    description: string;
  }>;
}

/**
 * Default privacy rules
 */
export const DEFAULT_PRIVACY_RULES: PrivacyRule[] = [
  {
    id: 'privacy_anonymize_by_default',
    name: 'Anonymize by default',
    applies: (ctx) => ctx.importance < 5,
    consentLevel: 'basic',
    transformations: [
      {
        type: 'anonymize',
        description: 'Remove personally identifiable information',
      },
    ],
  },
  {
    id: 'privacy_explicit_for_identity',
    name: 'Explicit consent for identity-level data',
    applies: (ctx) => ctx.sourceTier === MemoryTier.IDENTITY,
    consentLevel: 'explicit',
    transformations: [
      {
        type: 'transform',
        description: 'Aggregate identity data into broader categories',
      },
    ],
  },
  {
    id: 'privacy_redact_sensitive_context',
    name: 'Redact sensitive context information',
    applies: (ctx) => {
      const sensitiveKeywords = ['address', 'phone', 'email', 'ssn', 'medical'];
      const context = JSON.stringify(ctx.metadata).toLowerCase();
      return sensitiveKeywords.some(kw => context.includes(kw));
    },
    consentLevel: 'explicit',
    transformations: [
      {
        type: 'redact',
        description: 'Remove sensitive contextual information',
      },
    ],
  },
];

// ============================================================================
// Transfer Rules Engine
// ============================================================================

/**
 * Engine for evaluating and managing transfer rules
 */
export class TransferRulesEngine {
  private readonly rules: Map<string, TransferRule>;
  private readonly privacyRules: Map<string, PrivacyRule>;
  private readonly learnedRules: Map<string, TransferRule>;
  private readonly userCustomRules: Map<string, TransferRule[]>;

  constructor() {
    this.rules = new Map();
    this.privacyRules = new Map();
    this.learnedRules = new Map();
    this.userCustomRules = new Map();

    // Load default rules
    this.loadDefaultRules();
  }

  // ========================================================================
  // Rule Evaluation
  // ========================================================================

  /**
   * Evaluate all rules for a transfer context
   */
  evaluateRules(context: RuleEvaluationContext): RuleEvaluationResult[] {
    const results: RuleEvaluationResult[] = [];

    // Get applicable rules
    const applicableRules = this.getApplicableRules(context);

    // Sort by priority (highest first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    // Evaluate each rule
    for (const rule of applicableRules) {
      const result = this.evaluateRule(rule, context);
      if (result.matched) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Evaluate transfer eligibility
   */
  evaluateEligibility(context: RuleEvaluationContext): EligibilityResult {
    const ruleResults = this.evaluateRules(context);
    const blockingRules: string[] = [];
    const reasons: string[] = [];

    let requiresApproval = false;
    let eligible = true;
    let confidence = 1.0;

    // Check for blocking actions
    for (const result of ruleResults) {
      for (const action of result.actions) {
        if (action.type === 'reject') {
          eligible = false;
          blockingRules.push(result.ruleId);
          reasons.push(result.reason || 'Transfer blocked by rule');
          confidence = 0;
        } else if (action.type === 'require_approval') {
          requiresApproval = true;
          reasons.push(`Approval required: ${result.reason}`);
        }
      }
    }

    // Check privacy rules
    for (const [id, privacyRule] of this.privacyRules) {
      if (privacyRule.applies(context)) {
        if (privacyRule.consentLevel === 'explicit') {
          requiresApproval = true;
          reasons.push(`Privacy rule ${id} requires explicit consent`);
        }
      }
    }

    return {
      eligible,
      requiresApproval,
      confidence,
      reasons,
      suggestedTransformations: this.getSuggestedTransformations(ruleResults),
      blockingRules,
    };
  }

  /**
   * Get applicable rules for a context
   */
  private getApplicableRules(context: RuleEvaluationContext): TransferRule[] {
    const applicable: TransferRule[] = [];

    // Check default rules
    for (const rule of this.rules.values()) {
      if (!rule.active) continue;
      if (!this.ruleMatchesContext(rule, context)) continue;
      applicable.push(rule);
    }

    // Check user custom rules
    const userRules = this.userCustomRules.get(context.userId) ?? [];
    for (const rule of userRules) {
      if (!rule.active) continue;
      if (!this.ruleMatchesContext(rule, context)) continue;
      applicable.push(rule);
    }

    // Check learned rules
    for (const rule of this.learnedRules.values()) {
      if (!rule.active) continue;
      if (!this.ruleMatchesContext(rule, context)) continue;
      applicable.push(rule);
    }

    return applicable;
  }

  /**
   * Check if a rule matches the evaluation context
   */
  private ruleMatchesContext(rule: TransferRule, context: RuleEvaluationContext): boolean {
    // Check direction
    if (rule.direction !== TransferDirection.BIDIRECTIONAL &&
        rule.direction !== context.direction) {
      return false;
    }

    // Check source product
    if (rule.sourceProduct !== Product.ANY && rule.sourceProduct !== context.sourceProduct) {
      return false;
    }

    // Check target product
    if (rule.targetProduct !== Product.ANY && rule.targetProduct !== context.targetProduct) {
      return false;
    }

    // Check categories
    if (rule.categories.length > 0 && !rule.categories.includes(context.category)) {
      return false;
    }

    // Check conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: TransferCondition, context: RuleEvaluationContext): boolean {
    let result = false;

    switch (condition.type) {
      case 'importance_threshold':
        result = context.importance >= (condition.value as number);
        break;

      case 'category_match':
        result = (condition.value as TransferCategory[]).includes(context.category);
        break;

      case 'tier_match':
        result = (condition.value as MemoryTier[]).includes(context.sourceTier);
        break;

      case 'time_window':
        // Check if timestamp is within window
        const window = condition.value as number;
        const age = Date.now() - (context.metadata.timestamp as number ?? 0);
        result = age <= window;
        break;

      case 'user_permission':
        // Check user permission setting
        const permission = condition.value as string;
        const hasPermission = context.metadata[permission] as boolean ?? false;
        result = hasPermission;
        break;
    }

    return condition.negate ? !result : result;
  }

  /**
   * Evaluate a single rule
   */
  private evaluateRule(rule: TransferRule, context: RuleEvaluationContext): RuleEvaluationResult {
    const matched = this.ruleMatchesContext(rule, context);

    let reason = rule.name;
    if (!matched) {
      reason = 'Rule does not match context';
    }

    return {
      ruleId: rule.id,
      matched,
      actions: matched ? rule.actions : [],
      reason,
      priority: rule.priority,
    };
  }

  /**
   * Get suggested transformations from rule results
   */
  private getSuggestedTransformations(results: RuleEvaluationResult[]): string[] {
    const transformations: string[] = [];

    for (const result of results) {
      for (const action of result.actions) {
        if (action.type === 'transform' && action.params) {
          for (const [key, value] of Object.entries(action.params)) {
            transformations.push(`${key}: ${value}`);
          }
        }
      }
    }

    return transformations;
  }

  // ========================================================================
  // Rule Management
  // ========================================================================

  /**
   * Add a custom rule for a user
   */
  addUserRule(userId: string, rule: TransferRule): void {
    let userRules = this.userCustomRules.get(userId);
    if (!userRules) {
      userRules = [];
      this.userCustomRules.set(userId, userRules);
    }

    // Remove existing rule with same ID
    const index = userRules.findIndex(r => r.id === rule.id);
    if (index >= 0) {
      userRules[index] = rule;
    } else {
      userRules.push(rule);
    }
  }

  /**
   * Remove a user rule
   */
  removeUserRule(userId: string, ruleId: string): boolean {
    const userRules = this.userCustomRules.get(userId);
    if (!userRules) return false;

    const index = userRules.findIndex(r => r.id === ruleId);
    if (index < 0) return false;

    userRules.splice(index, 1);
    return true;
  }

  /**
   * Get user rules
   */
  getUserRules(userId: string): TransferRule[] {
    return this.userCustomRules.get(userId) ?? [];
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<TransferRule>): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    const updated = { ...rule, ...updates, lastUpdatedAt: Date.now() };
    this.rules.set(ruleId, updated);
    return true;
  }

  /**
   * Activate or deactivate a rule
   */
  setRuleActive(ruleId: string, active: boolean): boolean {
    return this.updateRule(ruleId, { active });
  }

  /**
   * Learn a new rule from user behavior
   */
  learnRule(rule: TransferRule): void {
    rule.lastUpdatedAt = Date.now();
    this.learnedRules.set(rule.id, rule);
  }

  /**
   * Forget a learned rule
   */
  forgetRule(ruleId: string): boolean {
    return this.learnedRules.delete(ruleId);
  }

  // ========================================================================
  // Privacy Management
  // ========================================================================

  /**
   * Add a privacy rule
   */
  addPrivacyRule(rule: PrivacyRule): void {
    this.privacyRules.set(rule.id, rule);
  }

  /**
   * Remove a privacy rule
   */
  removePrivacyRule(ruleId: string): boolean {
    return this.privacyRules.delete(ruleId);
  }

  /**
   * Evaluate privacy rules
   */
  evaluatePrivacy(context: RuleEvaluationContext): {
    applicableRules: PrivacyRule[];
    requiredConsent: 'none' | 'basic' | 'explicit';
    transformations: Array<{ type: string; description: string }>;
  } {
    const applicableRules: PrivacyRule[] = [];
    let maxConsent: 'none' | 'basic' | 'explicit' = 'none';
    const transformations: Array<{ type: string; description: string }> = [];

    for (const rule of this.privacyRules.values()) {
      if (rule.applies(context)) {
        applicableRules.push(rule);

        // Track highest consent level
        if (rule.consentLevel === 'explicit') {
          maxConsent = 'explicit';
        } else if (rule.consentLevel === 'basic' && maxConsent !== 'explicit') {
          maxConsent = 'basic';
        }

        // Collect transformations
        if (rule.transformations) {
          transformations.push(...rule.transformations);
        }
      }
    }

    return {
      applicableRules,
      requiredConsent: maxConsent,
      transformations,
    };
  }

  // ========================================================================
  // Rule Discovery
  // ========================================================================

  /**
   * Find rules that match a pattern
   */
  findRules(pattern: {
    sourceProduct?: Product;
    targetProduct?: Product;
    category?: TransferCategory;
    active?: boolean;
  }): TransferRule[] {
    const results: TransferRule[] = [];

    const allRules = [
      ...Array.from(this.rules.values()),
      ...Array.from(this.learnedRules.values()),
    ];

    for (const rule of allRules) {
      if (pattern.sourceProduct && rule.sourceProduct !== pattern.sourceProduct &&
          rule.sourceProduct !== Product.ANY) {
        continue;
      }
      if (pattern.targetProduct && rule.targetProduct !== pattern.targetProduct &&
          rule.targetProduct !== Product.ANY) {
        continue;
      }
      if (pattern.category && !rule.categories.includes(pattern.category)) {
        continue;
      }
      if (pattern.active !== undefined && rule.active !== pattern.active) {
        continue;
      }
      results.push(rule);
    }

    return results;
  }

  /**
   * Get rule by ID
   */
  getRule(ruleId: string): TransferRule | undefined {
    return this.rules.get(ruleId) ?? this.learnedRules.get(ruleId);
  }

  /**
   * Get all rules
   */
  getAllRules(): TransferRule[] {
    return [
      ...Array.from(this.rules.values()),
      ...Array.from(this.learnedRules.values()),
    ];
  }

  // ========================================================================
  // Export / Import
  // ========================================================================

  /**
   * Export rules for a user
   */
  exportUserRules(userId: string): TransferRule[] {
    return this.getUserRules(userId);
  }

  /**
   * Import rules for a user
   */
  importUserRules(userId: string, rules: TransferRule[]): void {
    for (const rule of rules) {
      this.addUserRule(userId, rule);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.learnedRules.clear();
    this.userCustomRules.clear();
  }

  /**
   * Load default rules
   */
  private loadDefaultRules(): void {
    for (const rule of DEFAULT_TRANSFER_RULES) {
      this.rules.set(rule.id, rule);
    }

    for (const privacyRule of DEFAULT_PRIVACY_RULES) {
      this.privacyRules.set(privacyRule.id, privacyRule);
    }
  }
}

// ============================================================================
// Rule Builder
// ============================================================================

/**
 * Builder for creating custom transfer rules
 */
export class TransferRuleBuilder {
  private rule: Partial<TransferRule>;

  constructor() {
    this.rule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      active: true,
      priority: RulePriority.MEDIUM,
      direction: TransferDirection.BIDIRECTIONAL,
      categories: [],
      conditions: [],
      actions: [],
      minConfidenceForAuto: 0.7,
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };
  }

  withId(id: string): this {
    this.rule.id = id;
    return this;
  }

  withName(name: string): this {
    this.rule.name = name;
    return this;
  }

  withProducts(source: Product, target: Product): this {
    this.rule.sourceProduct = source;
    this.rule.targetProduct = target;
    return this;
  }

  withDirection(direction: TransferDirection): this {
    this.rule.direction = direction;
    return this;
  }

  withCategories(...categories: TransferCategory[]): this {
    this.rule.categories = categories;
    return this;
  }

  withPriority(priority: RulePriority): this {
    this.rule.priority = priority;
    return this;
  }

  withAutoApproveThreshold(threshold: number): this {
    this.rule.minConfidenceForAuto = threshold;
    return this;
  }

  withCondition(condition: TransferCondition): this {
    this.rule.conditions!.push(condition);
    return this;
  }

  withAction(action: TransferAction): this {
    this.rule.actions!.push(action);
    return this;
  }

  build(): TransferRule {
    if (!this.rule.name) {
      throw new Error('Rule name is required');
    }
    if (!this.rule.sourceProduct || !this.rule.targetProduct) {
      throw new Error('Source and target products are required');
    }

    return this.rule as TransferRule;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a transfer rules engine
 */
export function createTransferRulesEngine(): TransferRulesEngine {
  return new TransferRulesEngine();
}

/**
 * Create a transfer rule builder
 */
export function createTransferRuleBuilder(): TransferRuleBuilder {
  return new TransferRuleBuilder();
}

/**
 * Create a simple auto-approve rule
 */
export function createAutoApproveRule(config: {
  id: string;
  name: string;
  sourceProduct: Product;
  targetProduct: Product;
  categories: TransferCategory[];
  minImportance: number;
  minConfidence: number;
}): TransferRule {
  return {
    id: config.id,
    name: config.name,
    sourceProduct: config.sourceProduct,
    targetProduct: config.targetProduct,
    direction: TransferDirection.BIDIRECTIONAL,
    categories: config.categories,
    minConfidenceForAuto: config.minConfidence,
    active: true,
    priority: RulePriority.MEDIUM,
    conditions: [
      {
        type: 'importance_threshold',
        value: config.minImportance,
      },
    ],
    actions: [
      {
        type: 'auto_approve',
      },
    ],
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Create a privacy-sensitive rule
 */
export function createPrivacyRule(config: {
  id: string;
  name: string;
  applies: (context: RuleEvaluationContext) => boolean;
  consentLevel: 'none' | 'basic' | 'explicit';
}): PrivacyRule {
  return {
    id: config.id,
    name: config.name,
    applies: config.applies,
    consentLevel: config.consentLevel,
  };
}
