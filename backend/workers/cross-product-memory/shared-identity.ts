/**
 * Shared Identity System
 *
 * Manages unified user identity across SuperInstance.AI products.
 * A single user has one unified identity that encompasses their
 * StudyLoG.AI student identity, DMLoG.AI character identity, and
 * identities in other products.
 *
 * Key Concepts:
 * - Unified ID: Single identifier for a user across all products
 * - Product Identity: Product-specific user data (display name, avatar, etc.)
 * - Unified Traits: Cross-product characteristics (persistence, curiosity, etc.)
 * - Unified Skills: Skills that exist across products with product-specific levels
 *
 * The shared identity enables:
 * - Transfer of learnings between products
 * - Consistent user experience across products
 * - Cross-product analytics and insights
 * - Unified preferences and privacy controls
 */

import {
  Product,
  TransferCategory,
  UnifiedIdentity,
  ProductIdentity,
  UnifiedTrait,
  UnifiedSkill,
  ProductSkillLevel,
  SkillPracticeEvent,
  IdentityPreferences,
  SyncMatrix,
  NotificationPreferences,
  PrivacyPreferences,
  ShareableDataType,
} from './types.js';

// ============================================================================
// Identity Creation Types
// ============================================================================

/**
 * Configuration for identity creation
 */
export interface IdentityConfig {
  /** Minimum observations before trait is established */
  minTraitObservations: number;
  /** Default trait stability */
  defaultTraitStability: number;
  /** Minimum skill level to record */
  minSkillLevel: number;
  /** Maximum number of product identities per unified identity */
  maxProductIdentities: number;
  /** Whether to automatically link new product identities */
  autoLinkProductIdentities: boolean;
  /** Default privacy preferences */
  defaultPrivacy: Partial<PrivacyPreferences>;
  /** Default notification preferences */
  defaultNotifications: Partial<NotificationPreferences>;
}

/**
 * Default identity configuration
 */
export const DEFAULT_IDENTITY_CONFIG: IdentityConfig = {
  minTraitObservations: 3,
  defaultTraitStability: 0.5,
  minSkillLevel: 0.1,
  maxProductIdentities: 10,
  autoLinkProductIdentities: true,
  defaultPrivacy: {
    shareableData: [
      ShareableDataType.SKILLS,
      ShareableDataType.PATTERNS,
      ShareableDataType.ACHIEVEMENTS,
    ],
    minAnonymity: 'basic',
    allowAnalytics: true,
    retentionPeriod: 0, // Forever
  },
  defaultNotifications: {
    notifyOnProposal: true,
    notifyOnAutoApprove: false,
    notifyOnReject: false,
    notifyOnApplied: true,
    dailySummary: false,
  },
};

// ============================================================================
// Trait Observation Data
// ============================================================================

/**
 * An observation of a trait in a specific product
 */
export interface TraitObservation {
  /** Product where observed */
  product: Product;
  /** Transfer category */
  category: TransferCategory;
  /** Observed value (0-1) */
  value: number;
  /** Confidence in observation (0-1) */
  confidence: number;
  /** Context of observation */
  context: string;
  /** When observed */
  timestamp: number;
  /** Evidence for this observation */
  evidence: string[];
}

/**
 * Skill observation in a specific product
 */
export interface SkillObservation {
  /** Product where observed */
  product: Product;
  /** Skill name */
  skillName: string;
  /** Transfer category */
  category: TransferCategory;
  /** Observed level (0-1) */
  level: number;
  /** Practice context */
  context: string;
  /** Time spent (ms) */
  timeSpent: number;
  /** Success level (0-1) */
  success: number;
  /** When observed */
  timestamp: number;
}

// ============================================================================
// Shared Identity Manager
// ============================================================================

/**
 * Manages unified identity across all SuperInstance.AI products
 */
export class SharedIdentityManager {
  private readonly config: IdentityConfig;
  private readonly identities: Map<string, UnifiedIdentity>;
  private readonly userIdToUnifiedId: Map<string, string>; // product_userId -> unifiedId

  constructor(config?: Partial<IdentityConfig>) {
    this.config = {
      ...DEFAULT_IDENTITY_CONFIG,
      ...config,
      defaultPrivacy: {
        ...DEFAULT_IDENTITY_CONFIG.defaultPrivacy,
        ...config?.defaultPrivacy,
      },
      defaultNotifications: {
        ...DEFAULT_IDENTITY_CONFIG.defaultNotifications,
        ...config?.defaultNotifications,
      },
    };
    this.identities = new Map();
    this.userIdToUnifiedId = new Map();
  }

  // ========================================================================
  // Identity Creation & Linking
  // ========================================================================

  /**
   * Create or get a unified identity for a product user
   */
  async getOrCreateIdentity(
    product: Product,
    userId: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<UnifiedIdentity> {
    const productKey = `${product}_${userId}`;

    // Check for existing mapping
    const existingUnifiedId = this.userIdToUnifiedId.get(productKey);
    if (existingUnifiedId) {
      const identity = this.identities.get(existingUnifiedId);
      if (identity) {
        // Update product identity if needed
        const productIdentity = identity.productIdentities.find(
          pi => pi.product === product && pi.userId === userId
        );
        if (productIdentity) {
          productIdentity.lastActiveAt = Date.now();
          if (displayName) productIdentity.displayName = displayName;
          if (avatarUrl) productIdentity.avatarUrl = avatarUrl;
        }
        return identity;
      }
    }

    // Create new unified identity
    const unifiedId = this.generateUnifiedId();
    const identity: UnifiedIdentity = {
      unifiedId,
      productIdentities: [
        {
          product,
          userId,
          displayName: displayName ?? userId,
          avatarUrl,
          attributes: {},
          linkedAt: Date.now(),
          lastActiveAt: Date.now(),
        },
      ],
      traits: [],
      skills: [],
      transferHistory: [],
      preferences: this.createDefaultPreferences(),
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
      version: 1,
    };

    this.identities.set(unifiedId, identity);
    this.userIdToUnifiedId.set(productKey, unifiedId);

    return identity;
  }

  /**
   * Link a product identity to an existing unified identity
   */
  async linkProductIdentity(
    unifiedId: string,
    product: Product,
    userId: string,
    displayName?: string,
    avatarUrl?: string
  ): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    // Check if already linked
    const existing = identity.productIdentities.find(
      pi => pi.product === product && pi.userId === userId
    );
    if (existing) {
      existing.lastActiveAt = Date.now();
      return true;
    }

    // Check max limit
    if (identity.productIdentities.length >= this.config.maxProductIdentities) {
      return false;
    }

    // Add new product identity
    const newProductIdentity: ProductIdentity = {
      product,
      userId,
      displayName: displayName ?? userId,
      avatarUrl,
      attributes: {},
      linkedAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    identity.productIdentities.push(newProductIdentity);
    identity.version++;
    identity.lastUpdatedAt = Date.now();

    // Update mapping
    const productKey = `${product}_${userId}`;
    this.userIdToUnifiedId.set(productKey, unifiedId);

    return true;
  }

  /**
   * Unlink a product identity from unified identity
   */
  async unlinkProductIdentity(
    unifiedId: string,
    product: Product,
    userId: string
  ): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    const index = identity.productIdentities.findIndex(
      pi => pi.product === product && pi.userId === userId
    );
    if (index === -1) return false;

    // Don't allow unlinking if it's the last identity
    if (identity.productIdentities.length === 1) {
      return false;
    }

    identity.productIdentities.splice(index, 1);
    identity.version++;
    identity.lastUpdatedAt = Date.now();

    // Remove mapping
    const productKey = `${product}_${userId}`;
    this.userIdToUnifiedId.delete(productKey);

    return true;
  }

  /**
   * Get unified ID from product user ID
   */
  getUnifiedId(product: Product, userId: string): string | undefined {
    const productKey = `${product}_${userId}`;
    return this.userIdToUnifiedId.get(productKey);
  }

  /**
   * Get unified identity by unified ID
   */
  getIdentity(unifiedId: string): UnifiedIdentity | undefined {
    return this.identities.get(unifiedId);
  }

  // ========================================================================
  // Trait Management
  // ========================================================================

  /**
   * Record an observation of a trait
   */
  async recordTraitObservation(
    unifiedId: string,
    observation: TraitObservation
  ): Promise<void> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return;

    // Find existing trait
    let trait = identity.traits.find(t => t.category === observation.category);

    if (!trait) {
      // Check if we have enough observations to create trait
      const observations = this.getRecentTraitObservations(unifiedId, observation.category, this.config.minTraitObservations);

      if (observations.length < this.config.minTraitObservations - 1) {
        // Not enough observations yet, store for later
        // In a real implementation, would store pending observations
        return;
      }

      // Create new trait
      trait = this.createTraitFromObservations([
        ...observations,
        observation,
      ]);
      identity.traits.push(trait);
    } else {
      // Update existing trait
      this.updateTraitFromObservation(trait, observation);
    }

    identity.version++;
    identity.lastUpdatedAt = Date.now();
  }

  /**
   * Get all traits for a unified identity
   */
  getTraits(unifiedId: string): UnifiedTrait[] {
    const identity = this.identities.get(unifiedId);
    return identity?.traits ?? [];
  }

  /**
   * Get trait by category
   */
  getTrait(unifiedId: string, category: TransferCategory): UnifiedTrait | undefined {
    const identity = this.identities.get(unifiedId);
    return identity?.traits.find(t => t.category === category);
  }

  /**
   * Update trait value directly (for manual adjustments)
   */
  async updateTrait(
    unifiedId: string,
    category: TransferCategory,
    value: number,
    confidence?: number
  ): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    const trait = identity.traits.find(t => t.category === category);
    if (!trait) return false;

    trait.value = Math.max(0, Math.min(1, value));
    if (confidence !== undefined) {
      trait.confidence = confidence;
    }
    trait.lastUpdatedAt = Date.now();
    identity.version++;
    identity.lastUpdatedAt = Date.now();

    return true;
  }

  // ========================================================================
  // Skill Management
  // ========================================================================

  /**
   * Record a skill practice event
   */
  async recordSkillPractice(
    unifiedId: string,
    observation: SkillObservation
  ): Promise<void> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return;

    // Find or create skill
    let skill = identity.skills.find(s => s.name === observation.skillName);

    if (!skill) {
      skill = this.createSkill(observation);
      identity.skills.push(skill);
    }

    // Update product level
    let productLevel = skill.productLevels[observation.product];
    if (!productLevel) {
      productLevel = {
        level: 0,
        practiceCount: 0,
        lastPracticed: 0,
        displayName: observation.skillName,
      };
      skill.productLevels[observation.product] = productLevel;
    }

    // Calculate improvement
    const previousLevel = productLevel.level;
    const improvement = this.calculateImprovement(observation, productLevel);

    // Update product level
    productLevel.level = Math.max(0, Math.min(1, productLevel.level + improvement));
    productLevel.practiceCount++;
    productLevel.lastPracticed = observation.timestamp;

    // Add practice event
    skill.practiceHistory.push({
      product: observation.product,
      timestamp: observation.timestamp,
      success: observation.success,
      context: observation.context,
      timeSpent: observation.timeSpent,
      improvement: productLevel.level - previousLevel,
    });

    // Update overall level (weighted average across products)
    skill.level = this.calculateOverallSkillLevel(skill);
    skill.lastUpdatedAt = Date.now();

    identity.version++;
    identity.lastUpdatedAt = Date.now();
  }

  /**
   * Get all skills for a unified identity
   */
  getSkills(unifiedId: string): UnifiedSkill[] {
    const identity = this.identities.get(unifiedId);
    return identity?.skills ?? [];
  }

  /**
   * Get skill by name
   */
  getSkill(unifiedId: string, skillName: string): UnifiedSkill | undefined {
    const identity = this.identities.get(unifiedId);
    return identity?.skills.find(s => s.name === skillName);
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(unifiedId: string, category: TransferCategory): UnifiedSkill[] {
    const identity = this.identities.get(unifiedId);
    return identity?.skills.filter(s => s.category === category) ?? [];
  }

  /**
   * Get skill level in a specific product
   */
  getSkillLevelInProduct(
    unifiedId: string,
    skillName: string,
    product: Product
  ): number | undefined {
    const skill = this.getSkill(unifiedId, skillName);
    return skill?.productLevels[product]?.level;
  }

  // ========================================================================
  // Preferences Management
  // ========================================================================

  /**
   * Update identity preferences
   */
  async updatePreferences(
    unifiedId: string,
    preferences: Partial<IdentityPreferences>
  ): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    identity.preferences = {
      ...identity.preferences,
      ...preferences,
      notifications: {
        ...identity.preferences.notifications,
        ...preferences.notifications,
      },
      privacy: {
        ...identity.preferences.privacy,
        ...preferences.privacy,
      },
      syncMatrix: preferences.syncMatrix ?? identity.preferences.syncMatrix,
    };

    identity.version++;
    identity.lastUpdatedAt = Date.now();

    return true;
  }

  /**
   * Update sync matrix
   */
  async updateSyncMatrix(
    unifiedId: string,
    syncMatrix: Partial<SyncMatrix>
  ): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    identity.preferences.syncMatrix = {
      ...identity.preferences.syncMatrix,
      ...syncMatrix,
    };

    identity.version++;
    identity.lastUpdatedAt = Date.now();

    return true;
  }

  /**
   * Check if sync is enabled between products
   */
  isSyncEnabled(
    unifiedId: string,
    sourceProduct: Product,
    targetProduct: Product
  ): boolean {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    return identity.preferences.syncMatrix[sourceProduct]?.[targetProduct] ?? false;
  }

  // ========================================================================
  // Transfer History
  // ========================================================================

  /**
   * Add transfer to history
   */
  async addTransferToHistory(
    unifiedId: string,
    transferId: string
  ): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    identity.transferHistory.push(transferId);
    identity.version++;
    identity.lastUpdatedAt = Date.now();

    return true;
  }

  /**
   * Get transfer history
   */
  getTransferHistory(unifiedId: string, limit = 50): string[] {
    const identity = this.identities.get(unifiedId);
    if (!identity) return [];

    return identity.transferHistory.slice(-limit);
  }

  // ========================================================================
  // Analytics & Insights
  // ========================================================================

  /**
   * Get identity profile summary
   */
  getIdentityProfile(unifiedId: string): {
    unifiedId: string;
    products: Product[];
    topTraits: Array<{ category: TransferCategory; value: number }>;
    topSkills: Array<{ name: string; level: number; category: TransferCategory }>;
    totalPracticeTime: number;
    activeProducts: Product[];
  } | undefined {
    const identity = this.identities.get(unifiedId);
    if (!identity) return undefined;

    const products = identity.productIdentities.map(pi => pi.product);
    const activeProducts = identity.productIdentities
      .filter(pi => Date.now() - pi.lastActiveAt < 30 * 24 * 60 * 60 * 1000) // 30 days
      .map(pi => pi.product);

    return {
      unifiedId: identity.unifiedId,
      products,
      topTraits: identity.traits
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map(t => ({ category: t.category, value: t.value })),
      topSkills: identity.skills
        .sort((a, b) => b.level - a.level)
        .slice(0, 5)
        .map(s => ({ name: s.name, level: s.level, category: s.category })),
      totalPracticeTime: identity.skills.reduce(
        (sum, s) => sum + s.practiceHistory.reduce((h, e) => h + e.timeSpent, 0),
        0
      ),
      activeProducts,
    };
  }

  /**
   * Get cross-product skill analysis
   */
  getCrossProductSkillAnalysis(unifiedId: string): Array<{
    skillName: string;
    category: TransferCategory;
    overallLevel: number;
    productLevels: Array<{ product: Product; level: number; practiceCount: number }>;
    strongestProduct: Product;
    transferPotential: number;
  }> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return [];

    return identity.skills.map(skill => {
      const productEntries = Object.entries(skill.productLevels).map(
        ([product, level]) => ({
          product: product as Product,
          ...level,
        })
      );

      const strongest = productEntries.reduce((best, current) =>
        current.level > best.level ? current : best
      );

      // Transfer potential based on variance across products
      const levels = productEntries.map(e => e.level);
      const variance = levels.length > 1
        ? Math.max(...levels) - Math.min(...levels)
        : 0;
      const transferPotential = Math.min(1, variance * 2);

      return {
        skillName: skill.name,
        category: skill.category,
        overallLevel: skill.level,
        productLevels: productEntries,
        strongestProduct: strongest.product,
        transferPotential,
      };
    }).sort((a, b) => b.transferPotential - a.transferPotential);
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  /**
   * Generate a new unified ID
   */
  private generateUnifiedId(): string {
    return `uid_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create default preferences
   */
  private createDefaultPreferences(): IdentityPreferences {
    // Create default sync matrix (all enabled by default)
    const syncMatrix: SyncMatrix = {};
    const products = Object.values(Product);

    for (const source of products) {
      syncMatrix[source] = {};
      for (const target of products) {
        if (source !== target) {
          syncMatrix[source][target] = true;
        }
      }
    }

    return {
      autoApprove: false,
      autoApproveThreshold: 0.8,
      syncMatrix,
      notifications: { ...this.config.defaultNotifications } as NotificationPreferences,
      privacy: {
        shareableData: this.config.defaultPrivacy.shareableData ?? [],
        minAnonymity: this.config.defaultPrivacy.minAnonymity ?? 'basic',
        allowAnalytics: this.config.defaultPrivacy.allowAnalytics ?? true,
        retentionPeriod: this.config.defaultPrivacy.retentionPeriod ?? 0,
      },
    };
  }

  /**
   * Get recent trait observations
   */
  private getRecentTraitObservations(
    unifiedId: string,
    category: TransferCategory,
    limit: number
  ): TraitObservation[] {
    // In a real implementation, would query a persistent store
    // For now, return empty array
    return [];
  }

  /**
   * Create trait from observations
   */
  private createTraitFromObservations(observations: TraitObservation[]): UnifiedTrait {
    const category = observations[0].category;

    // Calculate weighted average value
    const totalWeight = observations.reduce((sum, o) => sum + o.confidence, 0);
    const value = observations.reduce(
      (sum, o) => sum + (o.value * o.confidence),
      0
    ) / totalWeight;

    // Average confidence
    const confidence = observations.reduce((sum, o) => sum + o.confidence, 0) / observations.length;

    // Unique products
    const sources = Array.from(new Set(observations.map(o => o.product)));

    // Collect evidence
    const evidence = observations.flatMap(o => o.evidence);

    return {
      id: `trait_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: this.getTraitDisplayName(category),
      category,
      value: Math.max(0, Math.min(1, value)),
      confidence,
      stability: this.config.defaultTraitStability,
      sources,
      evidence,
      lastUpdatedAt: Date.now(),
    };
  }

  /**
   * Update trait from new observation
   */
  private updateTraitFromObservation(
    trait: UnifiedTrait,
    observation: TraitObservation
  ): void {
    // Weighted update based on stability
    const newWeight = 1 - trait.stability;
    trait.value = (trait.value * trait.stability) + (observation.value * newWeight);
    trait.value = Math.max(0, Math.min(1, trait.value));

    // Update confidence
    trait.confidence = (trait.confidence * 0.9) + (observation.confidence * 0.1);

    // Add source if not present
    if (!trait.sources.includes(observation.product)) {
      trait.sources.push(observation.product);
    }

    // Add evidence
    trait.evidence.push(...observation.evidence);

    // Increase stability slightly with each update
    trait.stability = Math.min(0.95, trait.stability + 0.01);

    trait.lastUpdatedAt = Date.now();
  }

  /**
   * Create skill from first observation
   */
  private createSkill(observation: SkillObservation): UnifiedSkill {
    return {
      id: `skill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: observation.skillName,
      category: observation.category,
      level: observation.level,
      productLevels: {
        [observation.product]: {
          level: observation.level,
          practiceCount: 1,
          lastPracticed: observation.timestamp,
          displayName: observation.skillName,
        },
      },
      relatedSkills: [],
      prerequisites: [],
      dependents: [],
      practiceHistory: [
        {
          product: observation.product,
          timestamp: observation.timestamp,
          success: observation.success,
          context: observation.context,
          timeSpent: observation.timeSpent,
          improvement: 0,
        },
      ],
      lastUpdatedAt: Date.now(),
    };
  }

  /**
   * Calculate improvement from practice
   */
  private calculateImprovement(
    observation: SkillObservation,
    currentLevel: ProductSkillLevel
  ): number {
    // Factors affecting improvement
    const successFactor = (observation.success - 0.5) * 0.1; // -0.05 to 0.05
    const timeFactor = Math.min(0.05, observation.timeSpent / (60 * 60 * 1000)) * 0.1; // Up to 0.05 for 1 hour
    const practiceCountFactor = -0.01 / (currentLevel.practiceCount + 1); // Diminishing returns

    return successFactor + timeFactor + practiceCountFactor;
  }

  /**
   * Calculate overall skill level from product levels
   */
  private calculateOverallSkillLevel(skill: UnifiedSkill): number {
    const levels = Object.values(skill.productLevels).map(l => l.level);
    if (levels.length === 0) return 0;

    // Weighted by practice count
    const weights = Object.values(skill.productLevels).map(l => Math.log(l.practiceCount + 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    if (totalWeight === 0) {
      return levels.reduce((sum, l) => sum + l, 0) / levels.length;
    }

    return levels.reduce((sum, l, i) => sum + (l * weights[i]), 0) / totalWeight;
  }

  /**
   * Get display name for trait category
   */
  private getTraitDisplayName(category: TransferCategory): string {
    const names: Record<TransferCategory, string> = {
      [TransferCategory.PROBLEM_SOLVING]: 'Problem Solving',
      [TransferCategory.CRITICAL_THINKING]: 'Critical Thinking',
      [TransferCategory.CREATIVITY]: 'Creativity',
      [TransferCategory.PATTERN_RECOGNITION]: 'Pattern Recognition',
      [TransferCategory.SYSTEMS_THINKING]: 'Systems Thinking',
      [TransferCategory.ALGORITHMIC_THINKING]: 'Algorithmic Thinking',
      [TransferCategory.COLLABORATION]: 'Collaboration',
      [TransferCategory.COMMUNICATION]: 'Communication',
      [TransferCategory.EMPATHY]: 'Empathy',
      [TransferCategory.LEADERSHIP]: 'Leadership',
      [TransferCategory.NEGOTIATION]: 'Negotiation',
      [TransferCategory.PERSISTENCE]: 'Persistence',
      [TransferCategory.CURIOSITY]: 'Curiosity',
      [TransferCategory.ADAPTABILITY]: 'Adaptability',
      [TransferCategory.RESILIENCE]: 'Resilience',
      [TransferCategory.FOCUS]: 'Focus',
      [TransferCategory.TECHNICAL_KNOWLEDGE]: 'Technical Knowledge',
      [TransferCategory.RESEARCH_SKILLS]: 'Research Skills',
      [TransferCategory.DESIGN_THINKING]: 'Design Thinking',
      [TransferCategory.STRATEGIC_PLANNING]: 'Strategic Planning',
    };

    return names[category] ?? category;
  }

  // ========================================================================
  // Export / Import
  // ========================================================================

  /**
   * Export identity data
   */
  exportIdentity(unifiedId: string): UnifiedIdentity | undefined {
    return this.identities.get(unifiedId);
  }

  /**
   * Import identity data
   */
  importIdentity(identity: UnifiedIdentity): void {
    this.identities.set(identity.unifiedId, identity);

    // Update user ID mappings
    for (const pi of identity.productIdentities) {
      const productKey = `${pi.product}_${pi.userId}`;
      this.userIdToUnifiedId.set(productKey, identity.unifiedId);
    }
  }

  /**
   * Get all identities
   */
  getAllIdentities(): UnifiedIdentity[] {
    return Array.from(this.identities.values());
  }

  /**
   * Delete identity
   */
  async deleteIdentity(unifiedId: string): Promise<boolean> {
    const identity = this.identities.get(unifiedId);
    if (!identity) return false;

    // Remove user ID mappings
    for (const pi of identity.productIdentities) {
      const productKey = `${pi.product}_${pi.userId}`;
      this.userIdToUnifiedId.delete(productKey);
    }

    this.identities.delete(unifiedId);
    return true;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.identities.clear();
    this.userIdToUnifiedId.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalIdentities: number;
    totalProductIdentities: number;
    totalTraits: number;
    totalSkills: number;
    totalPracticeEvents: number;
  } {
    let totalProductIdentities = 0;
    let totalTraits = 0;
    let totalSkills = 0;
    let totalPracticeEvents = 0;

    for (const identity of this.identities.values()) {
      totalProductIdentities += identity.productIdentities.length;
      totalTraits += identity.traits.length;
      totalSkills += identity.skills.length;
      totalPracticeEvents += identity.skills.reduce(
        (sum, s) => sum + s.practiceHistory.length,
        0
      );
    }

    return {
      totalIdentities: this.identities.size,
      totalProductIdentities,
      totalTraits,
      totalSkills,
      totalPracticeEvents,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a shared identity manager
 */
export function createSharedIdentityManager(
  config?: Partial<IdentityConfig>
): SharedIdentityManager {
  return new SharedIdentityManager(config);
}

/**
 * Generate a unified ID
 */
export function generateUnifiedId(): string {
  return `uid_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
