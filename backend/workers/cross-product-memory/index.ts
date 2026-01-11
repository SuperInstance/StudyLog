/**
 * Cross-Product Memory Sharing System - Main API
 *
 * A comprehensive system for transferring memories between StudyLoG.AI and DMLoG.AI
 * so learnings transfer between products seamlessly.
 *
 * Core Concept: A student learns problem-solving in StudyLoG.AI -> Their DMLoG.AI
 * character applies those patterns as investigation skills.
 *
 * @module cross-product-memory
 *
 * @example
 * ```typescript
 * import { createCrossProductMemorySystem } from '@studylog/cross-product-memory';
 *
 * const system = createCrossProductMemorySystem();
 *
 * // Link user identities across products
 * await system.linkIdentities('studylog_user_123', 'dmlog_user_456');
 *
 * // Transfer a memory from StudyLoG to DMLoG
 * const result = await system.transferMemory({
 *   sourceProduct: 'studylog',
 *   targetProduct: 'dmlog',
 *   memoryId: 'mem_abc123',
 * });
 *
 * // Get cross-product analytics
 * const analytics = await system.getAnalytics('unified_id_xyz');
 * ```
 */

// ============================================================================
// Public API Exports
// ============================================================================

// Type exports
export * from './types.js';

// Core system exports
export {
  MemoryTransferEngine,
  createMemoryTransferEngine,
  DEFAULT_TRANSFER_CONFIG,
  type TransferConfig,
  type SourceMemory,
  type StudyLoGMemory,
  type DMLoGMemory,
} from './memory-transfer.js';

export {
  PatternMapper,
  createPatternMapper,
  STUDYLOG_PATTERNS,
  DMLOG_PATTERNS,
  STUDYLOG_TO_DMLOG_MAPPING,
  DMLOG_TO_STUDYLOG_MAPPING,
  CATEGORY_MAPPINGS,
  getCategoryMapping,
  findCategoryByKeywords,
  type SourcePattern,
  type LearningPattern,
  type PatternMappingResult,
} from './pattern-mapper.js';

export {
  SharedIdentityManager,
  createSharedIdentityManager,
  generateUnifiedId,
  DEFAULT_IDENTITY_CONFIG,
  type IdentityConfig,
  type TraitObservation,
  type SkillObservation,
} from './shared-identity.js';

export {
  SkillSynthesisEngine,
  createSkillSynthesisEngine,
  calculateSkillSimilarity,
  findSynthesisMatch,
  DEFAULT_SYNTHESIS_CONFIG,
  type SynthesisConfig,
  type ProductSkillForSynthesis,
  type SkillCluster,
  type SkillSimilarity,
} from './skill-synthesis.js';

export {
  LearningAnalyticsEngine,
  createLearningAnalyticsEngine,
  getDefaultAnalyticsConfig,
  type AnalyticsConfig,
  type AnalyticsPeriod,
  type AnalyticsDataPoint,
  type ProductActivity,
} from './learning-analytics.js';

export {
  TransferRulesEngine,
  TransferRuleBuilder,
  createTransferRulesEngine,
  createTransferRuleBuilder,
  createAutoApproveRule,
  createPrivacyRule,
  DEFAULT_TRANSFER_RULES,
  DEFAULT_PRIVACY_RULES,
  RulePriority,
  type RuleEvaluationContext,
  type RuleEvaluationResult,
  type EligibilityResult,
  type PrivacyRule,
} from './transfer-rules.js';

// ============================================================================
// Main System Interface
// ============================================================================

import { Product, TransferDirection, UnifiedIdentity } from './types.js';
import { MemoryTransferEngine } from './memory-transfer.js';
import { PatternMapper } from './pattern-mapper.js';
import { SharedIdentityManager } from './shared-identity.js';
import { SkillSynthesisEngine } from './skill-synthesis.js';
import { LearningAnalyticsEngine } from './learning-analytics.js';
import { TransferRulesEngine, RuleEvaluationContext } from './transfer-rules.js';

/**
 * Configuration for the cross-product memory system
 */
export interface CrossProductMemoryConfig {
  /** Enable memory transfer */
  enableTransfer: boolean;
  /** Enable pattern recognition */
  enablePatterns: boolean;
  /** Enable skill synthesis */
  enableSynthesis: boolean;
  /** Enable analytics */
  enableAnalytics: boolean;
  /** Enable rule evaluation */
  enableRules: boolean;
  /** Data persistence */
  persistData: boolean;
  /** Storage backend (if persisting) */
  storage?: 'd1' | 'kv' | 'custom';
}

/**
 * Default configuration
 */
export const DEFAULT_CROSS_PRODUCT_CONFIG: CrossProductMemoryConfig = {
  enableTransfer: true,
  enablePatterns: true,
  enableSynthesis: true,
  enableAnalytics: true,
  enableRules: true,
  persistData: false,
};

/**
 * Memory transfer request
 */
export interface MemoryTransferRequest {
  /** Source product */
  sourceProduct: Product;
  /** Target product */
  targetProduct: Product;
  /** User ID in source product */
  sourceUserId: string;
  /** Memory to transfer */
  memory: {
    id: string;
    content: string;
    tier: string;
    importance: number;
    emotionalValence: number;
    timestamp: number;
    tags: string[];
    metadata: Record<string, unknown>;
  };
  /** Optional character name for DMLoG */
  characterName?: string;
}

/**
 * The main cross-product memory system
 */
export class CrossProductMemorySystem {
  private readonly config: CrossProductMemoryConfig;
  private readonly transferEngine: MemoryTransferEngine;
  private readonly patternMapper: PatternMapper;
  private readonly identityManager: SharedIdentityManager;
  private readonly synthesisEngine: SkillSynthesisEngine;
  private readonly analyticsEngine: LearningAnalyticsEngine;
  private readonly rulesEngine: TransferRulesEngine;

  constructor(config?: Partial<CrossProductMemoryConfig>) {
    this.config = {
      ...DEFAULT_CROSS_PRODUCT_CONFIG,
      ...config,
    };

    // Initialize components
    this.transferEngine = new MemoryTransferEngine();
    this.patternMapper = new PatternMapper();
    this.identityManager = new SharedIdentityManager();
    this.synthesisEngine = new SkillSynthesisEngine(this.identityManager);
    this.analyticsEngine = new LearningAnalyticsEngine(
      this.identityManager,
      this.synthesisEngine
    );
    this.rulesEngine = new TransferRulesEngine();
  }

  // ========================================================================
  // Identity Management
  // ========================================================================

  /**
   * Get or create a unified identity
   */
  async getIdentity(
    product: Product,
    userId: string,
    displayName?: string
  ): Promise<UnifiedIdentity | undefined> {
    return await this.identityManager.getOrCreateIdentity(
      product,
      userId,
      displayName
    );
  }

  /**
   * Link identities across products
   */
  async linkIdentities(
    product1: Product,
    userId1: string,
    product2: Product,
    userId2: string
  ): Promise<boolean> {
    // Get or create identity for first product
    const identity1 = await this.identityManager.getOrCreateIdentity(
      product1,
      userId1
    );

    // Link second product identity
    return await this.identityManager.linkProductIdentity(
      identity1.unifiedId,
      product2,
      userId2
    );
  }

  /**
   * Get unified ID from product user ID
   */
  getUnifiedId(product: Product, userId: string): string | undefined {
    return this.identityManager.getUnifiedId(product, userId);
  }

  // ========================================================================
  // Memory Transfer
  // ========================================================================

  /**
   * Transfer a memory between products
   */
  async transferMemory(request: MemoryTransferRequest): Promise<{
    success: boolean;
    transferId?: string;
    requiresApproval?: boolean;
    message?: string;
  }> {
    // Check if transfer is enabled
    if (!this.config.enableTransfer) {
      return {
        success: false,
        message: 'Memory transfer is disabled',
      };
    }

    // Get unified identity
    const unifiedId = this.getUnifiedId(request.sourceProduct, request.sourceUserId);
    if (!unifiedId) {
      return {
        success: false,
        message: 'No unified identity found for user',
      };
    }

    // Evaluate rules
    const ruleContext: RuleEvaluationContext = {
      sourceProduct: request.sourceProduct,
      targetProduct: request.targetProduct,
      direction: this.getTransferDirection(request.sourceProduct, request.targetProduct),
      sourceTier: request.memory.tier as any,
      category: this.inferCategory(request.memory),
      importance: request.memory.importance,
      userId: unifiedId,
      confidence: 0.5, // Will be calculated
      metadata: request.memory.metadata,
    };

    const eligibility = this.rulesEngine.evaluateEligibility(ruleContext);

    if (!eligibility.eligible) {
      return {
        success: false,
        requiresApproval: false,
        message: `Transfer blocked: ${eligibility.reasons.join(', ')}`,
      };
    }

    // Execute transfer
    let result;
    if (request.sourceProduct === Product.STUDYLOG && request.targetProduct === Product.DMLOG) {
      result = await this.transferEngine.studyLogToDmLog(
        request.memory as any,
        request.characterName
      );
    } else if (request.sourceProduct === Product.DMLOG && request.targetProduct === Product.STUDYLOG) {
      result = await this.transferEngine.dmLogToStudyLog(
        request.memory as any
      );
    } else {
      return {
        success: false,
        message: 'Transfer direction not yet supported',
      };
    }

    // Record in analytics
    if (result.success && result.transferId) {
      await this.analyticsEngine.recordTransfer(
        unifiedId,
        request.sourceProduct,
        request.targetProduct,
        ruleContext.category,
        ruleContext.confidence
      );
    }

    return {
      success: result.success,
      transferId: result.transferId,
      requiresApproval: eligibility.requiresApproval,
      message: result.errors.length > 0 ? result.errors.join(', ') : undefined,
    };
  }

  /**
   * Approve a pending transfer
   */
  async approveTransfer(transferId: string): Promise<boolean> {
    return await this.transferEngine.approveTransfer(transferId);
  }

  /**
   * Reject a pending transfer
   */
  async rejectTransfer(transferId: string): Promise<boolean> {
    return await this.transferEngine.rejectTransfer(transferId);
  }

  /**
   * Get pending transfers for a user
   */
  async getPendingTransfers(unifiedId: string): Promise<any[]> {
    return this.transferEngine.getPendingTransfers(unifiedId);
  }

  // ========================================================================
  // Pattern Recognition
  // ========================================================================

  /**
   * Recognize patterns in content
   */
  recognizePatterns(
    content: string,
    product: Product,
    tags: string[] = []
  ): Map<string, number> {
    if (!this.config.enablePatterns) {
      return new Map();
    }

    return this.patternMapper.recognizePatterns(content, product, tags);
  }

  /**
   * Map a pattern to target product
   */
  mapPattern(
    patternId: string,
    sourceProduct: Product,
    targetProduct: Product
  ): any {
    if (!this.config.enablePatterns) {
      return null;
    }

    return this.patternMapper.mapPattern(patternId, sourceProduct, targetProduct);
  }

  // ========================================================================
  // Skill Synthesis
  // ========================================================================

  /**
   * Detect synthesis opportunities
   */
  async detectSynthesisOpportunities(unifiedId: string): Promise<any[]> {
    if (!this.config.enableSynthesis) {
      return [];
    }

    return await this.synthesisEngine.detectSynthesisOpportunities(unifiedId);
  }

  /**
   * Synthesize skills
   */
  async synthesizeSkills(unifiedId: string, cluster: any): Promise<any> {
    if (!this.config.enableSynthesis) {
      return null;
    }

    return await this.synthesisEngine.synthesizeSkills(unifiedId, cluster);
  }

  // ========================================================================
  // Analytics
  // ========================================================================

  /**
   * Get cross-product analytics
   */
  async getAnalytics(unifiedId: string, period?: any): Promise<any> {
    if (!this.config.enableAnalytics) {
      return null;
    }

    return await this.analyticsEngine.generateAnalytics(unifiedId, period);
  }

  /**
   * Record a practice event
   */
  async recordPractice(
    unifiedId: string,
    product: Product,
    category: any,
    success: number,
    timeSpent: number
  ): Promise<void> {
    if (!this.config.enableAnalytics) {
      return;
    }

    await this.analyticsEngine.recordPractice(
      unifiedId,
      product,
      category,
      success,
      timeSpent
    );
  }

  /**
   * Analyze trends
   */
  analyzeTrends(unifiedId: string, metric: any, period?: any): any {
    if (!this.config.enableAnalytics) {
      return null;
    }

    return this.analyticsEngine.analyzeTrends(unifiedId, metric, period);
  }

  // ========================================================================
  // Rules
  // ========================================================================

  /**
   * Add a custom rule for a user
   */
  addUserRule(unifiedId: string, rule: any): void {
    this.rulesEngine.addUserRule(unifiedId, rule);
  }

  /**
   * Remove a user rule
   */
  removeUserRule(unifiedId: string, ruleId: string): boolean {
    return this.rulesEngine.removeUserRule(unifiedId, ruleId);
  }

  /**
   * Get user rules
   */
  getUserRules(unifiedId: string): any[] {
    return this.rulesEngine.getUserRules(unifiedId);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Get transfer direction enum value
   */
  private getTransferDirection(
    source: Product,
    target: Product
  ): TransferDirection {
    if (source === Product.STUDYLOG && target === Product.DMLOG) {
      return TransferDirection.STUDYLOG_TO_DMLOG;
    }
    if (source === Product.DMLOG && target === Product.STUDYLOG) {
      return TransferDirection.DMLOG_TO_STUDYLOG;
    }
    return TransferDirection.BIDIRECTIONAL;
  }

  /**
   * Infer transfer category from memory
   */
  private inferCategory(memory: { content: string; tags: string[] }): any {
    const content = memory.content.toLowerCase();
    const tags = memory.tags.map(t => t.toLowerCase());

    // Simple keyword matching for common categories
    if (content.includes('collaborat') || tags.includes('team')) {
      return 'collaboration' as any;
    }
    if (content.includes('debug') || content.includes('solve')) {
      return 'problem_solving' as any;
    }
    if (content.includes('create') || content.includes('design')) {
      return 'creativity' as any;
    }
    if (content.includes('persist') || content.includes('keep trying')) {
      return 'persistence' as any;
    }

    return 'problem_solving' as any; // Default
  }

  // ========================================================================
  // System Management
  // ========================================================================

  /**
   * Get system statistics
   */
  getStats(): {
    identities: number;
    transfers: number;
    patterns: number;
    syntheses: number;
    dataPoints: number;
  } {
    return {
      identities: this.identityManager.getStats().totalIdentities,
      transfers: this.transferEngine.getTransferStats().total,
      patterns: this.patternMapper.getMappingStats().totalRecognitions,
      syntheses: this.synthesisEngine.getSynthesisStats().totalSynthesized,
      dataPoints: this.analyticsEngine.getStats().totalDataPoints,
    };
  }

  /**
   * Export user data
   */
  exportUserData(unifiedId: string): any {
    return {
      identity: this.identityManager.exportIdentity(unifiedId),
      analytics: this.analyticsEngine.exportUserData(unifiedId),
      transfers: this.transferEngine.getTransferHistory(unifiedId),
    };
  }

  /**
   * Clear all system data
   */
  clear(): void {
    this.transferEngine.clear();
    this.patternMapper.clear();
    this.identityManager.clear();
    this.synthesisEngine.clear();
    this.analyticsEngine.clear();
    this.rulesEngine.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a cross-product memory system
 */
export function createCrossProductMemorySystem(
  config?: Partial<CrossProductMemoryConfig>
): CrossProductMemorySystem {
  return new CrossProductMemorySystem(config);
}

/**
 * Create a minimal system for testing
 */
export function createMinimalCrossProductSystem(): CrossProductMemorySystem {
  return new CrossProductMemorySystem({
    enableTransfer: true,
    enablePatterns: true,
    enableSynthesis: false,
    enableAnalytics: false,
    enableRules: true,
    persistData: false,
  });
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration
 */
export { DEFAULT_CROSS_PRODUCT_CONFIG };

/**
 * Transfer categories
 */
export const TRANSFER_CATEGORIES = {
  PROBLEM_SOLVING: 'problem_solving',
  CRITICAL_THINKING: 'critical_thinking',
  CREATIVITY: 'creativity',
  PATTERN_RECOGNITION: 'pattern_recognition',
  SYSTEMS_THINKING: 'systems_thinking',
  ALGORITHMIC_THINKING: 'algorithmic_thinking',
  COLLABORATION: 'collaboration',
  COMMUNICATION: 'communication',
  EMPATHY: 'empathy',
  LEADERSHIP: 'leadership',
  NEGOTIATION: 'negotiation',
  PERSISTENCE: 'persistence',
  CURIOSITY: 'curiosity',
  ADAPTABILITY: 'adaptability',
  RESILIENCE: 'resilience',
  FOCUS: 'focus',
  TECHNICAL_KNOWLEDGE: 'technical_knowledge',
  RESEARCH_SKILLS: 'research_skills',
  DESIGN_THINKING: 'design_thinking',
  STRATEGIC_PLANNING: 'strategic_planning',
};

/**
 * StudyLoG to DMLoG skill mappings
 */
export const STUDYLOG_TO_DMLOG_SKILLS = {
  debugging: 'investigation',
  collaboration: 'party_coordination',
  persistence: 'constitution',
  creativity: 'improvisation',
  communication: 'persuasion',
  leadership: 'command',
  curiosity: 'perception',
  algorithmic_thinking: 'tactics',
  systems_thinking: 'world_building',
  problem_solving: 'investigation',
};

/**
 * DMLoG to StudyLoG skill mappings
 */
export const DMLOG_TO_STUDYLOG_SKILLS = {
  investigation: 'debugging',
  tactics: 'algorithmic_thinking',
  improvisation: 'creativity',
  roleplay: 'empathy',
  world_building: 'systems_thinking',
  party_coordination: 'collaboration',
  persuasion: 'communication',
  command: 'leadership',
  resilience: 'persistence',
  negotiation: 'communication',
};
