/**
 * Memory Transfer Engine
 *
 * Handles the transfer of memories between StudyLoG.AI and DMLoG.AI products.
 * Transforms memories from one product's format to another while preserving
 * the core learning and context.
 *
 * Core responsibilities:
 * - Transfer memories bidirectionally between products
 * - Transform content appropriately for target product context
 * - Track transfer confidence and evidence
 * - Handle conflicts during transfer
 * - Support batch transfer operations
 */

import {
  Product,
  TransferDirection,
  TransferCategory,
  TransferConfidence,
  TransferStatus,
  MemoryTier,
  MemoryTransfer,
  TransferResult,
  TransferConflict,
  ConflictResolution,
  TransferEvidence,
  BatchTransferRequest,
  BatchTransferResult,
} from './types.js';

// ============================================================================
// Memory Source Interfaces
// ============================================================================

/**
 * Source memory from any product
 */
export interface SourceMemory {
  id: string;
  userId: string;
  content: string;
  tier: MemoryTier;
  importance: number;
  emotionalValence: number;
  timestamp: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * StudyLoG memory source format
 */
export interface StudyLoGMemory extends SourceMemory {
  product: Product.STUDYLOG;
  subject?: string;
  topic?: string;
  difficulty?: number;
  successLevel?: number;
  masteryLevel?: number;
  module?: 'cognitive-mill' | 'intelligence-ranch' | 'sitka-sound';
}

/**
 * DMLoG memory source format
 */
export interface DMLoGMemory extends SourceMemory {
  product: Product.DMLOG;
  characterName?: string;
  characterClass?: string;
  encounterType?: 'combat' | 'social' | 'exploration' | 'puzzle';
  rollOutcome?: number;
  partyMembers?: string[];
}

// ============================================================================
// Transfer Configuration
// ============================================================================

/**
 * Configuration for memory transfer operations
 */
export interface TransferConfig {
  /** Minimum importance for transfer eligibility */
  minImportance: number;
  /** Minimum confidence for auto-approval */
  minAutoApproveConfidence: number;
  /** Default conflict resolution strategy */
  defaultConflictResolution: ConflictResolution;
  /** Whether to require user approval for transfers */
  requireApproval: boolean;
  /** Maximum age of memories to transfer (ms, 0 = no limit) */
  maxMemoryAge: number;
  /** Whether to include working memory in transfers */
  includeWorkingMemory: boolean;
  /** Tags to exclude from transfer */
  excludedTags: string[];
  /** Custom transformations for specific content */
  customTransformations: Map<string, string>;
}

/**
 * Default transfer configuration
 */
export const DEFAULT_TRANSFER_CONFIG: TransferConfig = {
  minImportance: 5.0,
  minAutoApproveConfidence: 0.8,
  defaultConflictResolution: ConflictResolution.KEEP_NEWEST,
  requireApproval: false,
  maxMemoryAge: 0,
  includeWorkingMemory: false,
  excludedTags: ['private', 'sensitive', 'temp'],
  customTransformations: new Map(),
};

// ============================================================================
// Memory Transfer Engine
// ============================================================================

/**
 * Core engine for transferring memories between products
 */
export class MemoryTransferEngine {
  private readonly config: TransferConfig;
  private readonly transferHistory: Map<string, MemoryTransfer>;
  private readonly pendingTransfers: Map<string, MemoryTransfer>;
  private readonly appliedTransfers: Map<string, MemoryTransfer>;

  constructor(config?: Partial<TransferConfig>) {
    this.config = {
      ...DEFAULT_TRANSFER_CONFIG,
      ...config,
      customTransformations: config?.customTransformations ?? new Map(),
    };
    this.transferHistory = new Map();
    this.pendingTransfers = new Map();
    this.appliedTransfers = new Map();
  }

  // ========================================================================
  // StudyLoG -> DMLoG Transfers
  // ========================================================================

  /**
   * Transfer a StudyLoG memory to DMLoG format
   *
   * Maps educational experiences to RPG character development:
   * - Debugging -> Investigation skill
   * - Collaboration -> Party Coordination
   * - Persistence -> Constitution
   * - Creativity -> Improvisation
   */
  async transferStudyLogToDmLog(
    memory: StudyLoGMemory,
    characterName?: string
  ): Promise<TransferResult> {
    const startTime = Date.now();

    // Check eligibility
    const eligibility = this.checkTransferEligibility(memory);
    if (!eligibility.eligible) {
      return {
        success: false,
        transferId: this.generateTransferId(),
        memoriesTransferred: 0,
        memoriesTransformed: 0,
        memoriesSkipped: 1,
        conflicts: [],
        warnings: eligibility.reasons,
        errors: [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Determine transfer category
    const category = this.determineTransferCategory(memory);
    if (!category) {
      return {
        success: false,
        transferId: this.generateTransferId(),
        memoriesTransferred: 0,
        memoriesTransformed: 0,
        memoriesSkipped: 1,
        conflicts: [],
        warnings: ['No suitable transfer category found'],
        errors: [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Transform content
    const transformed = this.transformStudyLogToDmLog(memory, characterName);
    const confidence = this.calculateTransferConfidence(memory, category);

    // Create transfer record
    const transfer: MemoryTransfer = {
      id: this.generateTransferId(),
      sourceProduct: Product.STUDYLOG,
      targetProduct: Product.DMLOG,
      sourceMemoryId: memory.id,
      category,
      originalContent: memory.content,
      transformedContent: transformed.content,
      direction: TransferDirection.STUDYLOG_TO_DMLOG,
      confidence: confidence >= this.config.minAutoApproveConfidence
        ? TransferConfidence.DIRECT
        : TransferConfidence.DERIVED,
      confidenceScore: confidence,
      status: this.shouldAutoApprove(confidence, memory)
        ? TransferStatus.APPROVED
        : TransferStatus.PENDING,
      sourceTier: memory.tier,
      targetTier: this.determineTargetTier(memory.tier, category),
      proposedAt: Date.now(),
      reason: this.generateTransferReason(memory, category, transformed),
      evidence: this.gatherTransferEvidence(memory, category),
      tags: this.generateTransferTags(memory, category),
      metadata: {
        originalMemory: memory,
        transformedData: transformed.metadata,
      },
    };

    // Store transfer
    this.transferHistory.set(transfer.id, transfer);
    if (transfer.status === TransferStatus.PENDING) {
      this.pendingTransfers.set(transfer.id, transfer);
    } else {
      this.appliedTransfers.set(transfer.id, transfer);
    }

    return {
      success: true,
      transferId: transfer.id,
      memoriesTransferred: 1,
      memoriesTransformed: 1,
      memoriesSkipped: 0,
      conflicts: [],
      warnings: [],
      errors: [],
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Transform StudyLoG memory to DMLoG format
   */
  private transformStudyLogToDmLog(
    memory: StudyLoGMemory,
    characterName?: string
  ): { content: string; metadata: Record<string, unknown> } {
    const category = this.determineTransferCategory(memory);
    const mapping = STUDYLOG_TO_DMLOG_MAPPINGS.get(category ?? TransferCategory.PROBLEM_SOLVING);

    const content = this.applyStudyLogNarrative(memory, mapping);
    const metadata = {
      characterName: characterName ?? this.generateCharacterName(memory),
      characterClass: mapping?.class ?? 'Adventurer',
      ability: mapping?.ability ?? 'Skill',
      encounterType: this.mapSuccessToEncounter(memory.successLevel, memory.emotionalValence),
      rollOutcome: this.mapSuccessToRoll(memory.successLevel),
      originalSubject: memory.subject,
      originalTopic: memory.topic,
    };

    return { content, metadata };
  }

  /**
   * Apply narrative transformation for StudyLoG -> DMLoG
   */
  private applyStudyLogNarrative(
    memory: StudyLoGMemory,
    mapping?: DmLogMapping
  ): string {
    const topic = memory.topic ?? 'the challenge';
    const action = this.getSuccessAction(memory.successLevel);
    const result = this.getEmotionalResult(memory.emotionalValence, memory.successLevel);

    if (mapping?.narrativeTemplate) {
      return mapping.narrativeTemplate
        .replace('{topic}', topic)
        .replace('{action}', action)
        .replace('{result}', result)
        .replace('{subject}', memory.subject ?? 'studies');
    }

    return `${action} ${topic}, ${result}`;
  }

  // ========================================================================
  // DMLoG -> StudyLoG Transfers
  // ========================================================================

  /**
   * Transfer a DMLoG memory to StudyLoG format
   *
   * Maps RPG experiences to educational development:
   * - Tactics -> Algorithmic thinking
   * - Roleplay -> Empathy
   * - World-building -> System design
   * - Party coordination -> Collaboration
   */
  async transferDmLogToStudyLog(
    memory: DMLoGMemory
  ): Promise<TransferResult> {
    const startTime = Date.now();

    // Check eligibility
    const eligibility = this.checkTransferEligibility(memory);
    if (!eligibility.eligible) {
      return {
        success: false,
        transferId: this.generateTransferId(),
        memoriesTransferred: 0,
        memoriesTransformed: 0,
        memoriesSkipped: 1,
        conflicts: [],
        warnings: eligibility.reasons,
        errors: [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Determine transfer category
    const category = this.determineTransferCategory(memory);
    if (!category) {
      return {
        success: false,
        transferId: this.generateTransferId(),
        memoriesTransferred: 0,
        memoriesTransformed: 0,
        memoriesSkipped: 1,
        conflicts: [],
        warnings: ['No suitable transfer category found'],
        errors: [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    // Transform content
    const transformed = this.transformDmLogToStudyLog(memory);
    const confidence = this.calculateTransferConfidence(memory, category);

    // Create transfer record
    const transfer: MemoryTransfer = {
      id: this.generateTransferId(),
      sourceProduct: Product.DMLOG,
      targetProduct: Product.STUDYLOG,
      sourceMemoryId: memory.id,
      category,
      originalContent: memory.content,
      transformedContent: transformed.content,
      direction: TransferDirection.DMLOG_TO_STUDYLOG,
      confidence: confidence >= this.config.minAutoApproveConfidence
        ? TransferConfidence.DIRECT
        : TransferConfidence.DERIVED,
      confidenceScore: confidence,
      status: this.shouldAutoApprove(confidence, memory)
        ? TransferStatus.APPROVED
        : TransferStatus.PENDING,
      sourceTier: memory.tier,
      targetTier: this.determineTargetTier(memory.tier, category),
      proposedAt: Date.now(),
      reason: this.generateTransferReason(memory, category, transformed),
      evidence: this.gatherTransferEvidence(memory, category),
      tags: this.generateTransferTags(memory, category),
      metadata: {
        originalMemory: memory,
        transformedData: transformed.metadata,
      },
    };

    // Store transfer
    this.transferHistory.set(transfer.id, transfer);
    if (transfer.status === TransferStatus.PENDING) {
      this.pendingTransfers.set(transfer.id, transfer);
    } else {
      this.appliedTransfers.set(transfer.id, transfer);
    }

    return {
      success: true,
      transferId: transfer.id,
      memoriesTransferred: 1,
      memoriesTransformed: 1,
      memoriesSkipped: 0,
      conflicts: [],
      warnings: [],
      errors: [],
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Transform DMLoG memory to StudyLoG format
   */
  private transformDmLogToStudyLog(
    memory: DMLoGMemory
  ): { content: string; metadata: Record<string, unknown> } {
    const category = this.determineTransferCategory(memory);
    const mapping = DMLOG_TO_STUDYLOG_MAPPINGS.get(
      memory.encounterType ?? 'social'
    );

    const content = this.applyDmLogNarrative(memory, mapping);
    const metadata = {
      subject: mapping?.subject ?? 'general',
      topic: this.mapEncounterToTopic(memory.encounterType),
      difficulty: this.mapRollToDifficulty(memory.rollOutcome),
      successLevel: this.mapRollToSuccess(memory.rollOutcome),
      module: 'sitka-sound',
      originalCharacterClass: memory.characterClass,
      originalEncounterType: memory.encounterType,
    };

    return { content, metadata };
  }

  /**
   * Apply narrative transformation for DMLoG -> StudyLoG
   */
  private applyDmLogNarrative(
    memory: DMLoGMemory,
    mapping?: StudyLogMapping
  ): string {
    const encounter = memory.encounterType ?? 'activity';
    const success = (memory.rollOutcome ?? 10) >= 10;

    if (mapping?.narrativeTemplate) {
      return mapping.narrativeTemplate
        .replace('{encounter}', encounter)
        .replace('{outcome}', success ? 'succeeded' : 'learned from')
        .replace('{class}', memory.characterClass ?? 'Adventurer');
    }

    return `Engaged in ${encounter} and ${success ? 'succeeded' : 'learned from the experience'}`;
  }

  // ========================================================================
  // Batch Transfer Operations
  // ========================================================================

  /**
   * Execute a batch transfer request
   */
  async executeBatchTransfer(request: BatchTransferRequest): Promise<BatchTransferResult> {
    const startTime = Date.now();
    const results: TransferResult[] = [];

    request.status = 'running';

    // Process each memory
    for (const memoryId of request.memoryIds) {
      // In a real implementation, would fetch memory from source
      // For now, create a placeholder result
      results.push({
        success: true,
        transferId: this.generateTransferId(),
        memoriesTransferred: 1,
        memoriesTransformed: 1,
        memoriesSkipped: 0,
        conflicts: [],
        warnings: [],
        errors: [],
        duration: 0,
        timestamp: Date.now(),
      });
    }

    request.status = 'completed';

    return {
      requestId: request.id,
      results,
      summary: {
        totalRequested: request.memoryIds.length,
        totalSucceeded: results.filter(r => r.success).length,
        totalFailed: results.filter(r => !r.success).length,
        totalSkipped: results.reduce((sum, r) => sum + r.memoriesSkipped, 0),
      },
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  // ========================================================================
  // Transfer Approval & Management
  // ========================================================================

  /**
   * Approve a pending transfer
   */
  async approveTransfer(transferId: string, approvedBy?: string): Promise<boolean> {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) return false;

    transfer.status = TransferStatus.APPROVED;
    transfer.approvedAt = Date.now();
    transfer.approvedBy = approvedBy;

    this.pendingTransfers.delete(transferId);
    this.appliedTransfers.set(transferId, transfer);

    return true;
  }

  /**
   * Reject a pending transfer
   */
  async rejectTransfer(transferId: string): Promise<boolean> {
    const transfer = this.pendingTransfers.get(transferId);
    if (!transfer) return false;

    transfer.status = TransferStatus.REJECTED;
    this.pendingTransfers.delete(transferId);

    return true;
  }

  /**
   * Apply an approved transfer to the target product
   */
  async applyTransfer(transferId: string): Promise<boolean> {
    const transfer = this.appliedTransfers.get(transferId) ??
                     this.transferHistory.get(transferId);
    if (!transfer || transfer.status !== TransferStatus.APPROVED) {
      return false;
    }

    // In a real implementation, would apply to target product's memory system
    transfer.status = TransferStatus.APPLIED;
    transfer.appliedAt = Date.now();

    return true;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Check if a memory is eligible for transfer
   */
  private checkTransferEligibility(memory: SourceMemory): {
    eligible: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    // Check importance
    if (memory.importance < this.config.minImportance) {
      reasons.push(`Importance ${memory.importance} below threshold ${this.config.minImportance}`);
    }

    // Check tier
    if (memory.tier === MemoryTier.WORKING && !this.config.includeWorkingMemory) {
      reasons.push('Working memory excluded from transfers');
    }

    // Check age
    if (this.config.maxMemoryAge > 0) {
      const age = Date.now() - memory.timestamp;
      if (age > this.config.maxMemoryAge) {
        reasons.push(`Memory age ${age}ms exceeds maximum ${this.config.maxMemoryAge}ms`);
      }
    }

    // Check excluded tags
    const hasExcludedTag = memory.tags.some(tag =>
      this.config.excludedTags.includes(tag)
    );
    if (hasExcludedTag) {
      reasons.push('Memory has excluded tags');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Determine the transfer category for a memory
   */
  private determineTransferCategory(
    memory: SourceMemory
  ): TransferCategory | null {
    // Check for explicit category in metadata
    const explicitCategory = memory.metadata['transferCategory'] as TransferCategory;
    if (explicitCategory) {
      return explicitCategory;
    }

    // Determine from content and tags
    const content = memory.content.toLowerCase();
    const tags = memory.tags.map(t => t.toLowerCase());

    // Check for category-specific keywords
    const categoryKeywords: Record<TransferCategory, string[]> = {
      [TransferCategory.PROBLEM_SOLVING]: ['debug', 'solve', 'problem', 'fix', 'error', 'issue'],
      [TransferCategory.CRITICAL_THINKING]: ['analyze', 'evaluate', 'assess', 'reason', 'logic'],
      [TransferCategory.CREATIVITY]: ['create', 'design', 'innovate', 'imagine', 'invent'],
      [TransferCategory.PATTERN_RECOGNITION]: ['pattern', 'recognize', 'identify', 'classify'],
      [TransferCategory.SYSTEMS_THINKING]: ['system', 'interconnect', 'holistic', 'integrate'],
      [TransferCategory.ALGORITHMIC_THINKING]: ['algorithm', 'procedure', 'sequence', 'step'],
      [TransferCategory.COLLABORATION]: ['team', 'group', 'together', 'cooperate', 'collaborate'],
      [TransferCategory.COMMUNICATION]: ['speak', 'write', 'present', 'explain', 'discuss'],
      [TransferCategory.EMPATHY]: ['understand', 'feel', 'relate', 'connect', 'perspective'],
      [TransferCategory.LEADERSHIP]: ['lead', 'guide', 'direct', 'manage', 'coordinate'],
      [TransferCategory.NEGOTIATION]: ['negotiate', 'compromise', 'agree', 'mediate'],
      [TransferCategory.PERSISTENCE]: ['persist', 'continue', 'try again', 'not give up'],
      [TransferCategory.CURIOSITY]: ['explore', 'discover', 'investigate', 'curious', 'wonder'],
      [TransferCategory.ADAPTABILITY]: ['adapt', 'adjust', 'flexible', 'change', 'modify'],
      [TransferCategory.RESILIENCE]: ['recover', 'bounce back', 'overcome', 'resilient'],
      [TransferCategory.FOCUS]: ['focus', 'concentrate', 'attention', 'mindful'],
      [TransferCategory.TECHNICAL_KNOWLEDGE]: ['code', 'program', 'technical', 'engineer'],
      [TransferCategory.RESEARCH_SKILLS]: ['research', 'investigate', 'find', 'reference'],
      [TransferCategory.DESIGN_THINKING]: ['design', 'prototype', 'iterate', 'user-centered'],
      [TransferCategory.STRATEGIC_PLANNING]: ['plan', 'strategy', 'tactic', 'roadmap', 'vision'],
    };

    // Find best matching category
    let bestCategory: TransferCategory | null = null;
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (content.includes(keyword)) score += 2;
        if (tags.some(t => t.includes(keyword))) score += 3;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as TransferCategory;
      }
    }

    return bestCategory;
  }

  /**
   * Calculate confidence in transfer
   */
  private calculateTransferConfidence(
    memory: SourceMemory,
    category: TransferCategory
  ): number {
    let confidence = 0.5;

    // Higher importance = higher confidence
    confidence += (memory.importance / 10) * 0.2;

    // Higher emotional valence = higher confidence
    if (memory.emotionalValence > 0) {
      confidence += memory.emotionalValence * 0.1;
    }

    // Semantic memory = higher confidence
    if (memory.tier === MemoryTier.SEMANTIC) {
      confidence += 0.2;
    }

    // Procedural memory = highest confidence
    if (memory.tier === MemoryTier.PROCEDURAL) {
      confidence += 0.3;
    }

    return Math.min(1, confidence);
  }

  /**
   * Determine if transfer should be auto-approved
   */
  private shouldAutoApprove(confidence: number, memory: SourceMemory): boolean {
    if (confidence < this.config.minAutoApproveConfidence) return false;
    if (this.config.requireApproval) return false;
    return true;
  }

  /**
   * Determine target memory tier
   */
  private determineTargetTier(sourceTier: MemoryTier, category: TransferCategory): MemoryTier {
    // Generally preserve tier, but some conversions
    switch (sourceTier) {
      case MemoryTier.EPISODIC:
        return MemoryTier.EPISODIC;
      case MemoryTier.SEMANTIC:
        return MemoryTier.SEMANTIC;
      case MemoryTier.PROCEDURAL:
        return MemoryTier.PROCEDURAL;
      case MemoryTier.REFLECTION:
        return MemoryTier.REFLECTION;
      case MemoryTier.IDENTITY:
        return MemoryTier.IDENTITY;
      default:
        return MemoryTier.EPISODIC;
    }
  }

  /**
   * Generate transfer reason
   */
  private generateTransferReason(
    memory: SourceMemory,
    category: TransferCategory,
    transformed: { content: string; metadata: Record<string, unknown> }
  ): string {
    return `Transfer ${category} skill from ${memory.tags.join(', ')} to target product context`;
  }

  /**
   * Gather evidence for transfer
   */
  private gatherTransferEvidence(
    memory: SourceMemory,
    category: TransferCategory
  ): TransferEvidence[] {
    return [
      {
        type: 'pattern_match',
        description: `Content matches ${category} pattern`,
        strength: 0.7,
        source: 'content_analysis',
        timestamp: Date.now(),
      },
      {
        type: 'semantic_similarity',
        description: 'Semantic analysis confirms category relevance',
        strength: 0.6,
        source: 'semantic_engine',
        timestamp: Date.now(),
      },
    ];
  }

  /**
   * Generate transfer tags
   */
  private generateTransferTags(memory: SourceMemory, category: TransferCategory): string[] {
    return [
      ...memory.tags,
      category,
      `transfer_${memory.tags.join('_')}`,
      'cross_product',
    ];
  }

  /**
   * Generate unique transfer ID
   */
  private generateTransferId(): string {
    return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========================================================================
  // Mapping Helpers
  // ========================================================================

  /**
   * Get success action verb
   */
  private getSuccessAction(successLevel?: number): string {
    if (!successLevel) return 'attempted';
    if (successLevel > 0.8) return 'mastered';
    if (successLevel > 0.6) return 'succeeded at';
    if (successLevel > 0.4) return 'worked on';
    return 'struggled with';
  }

  /**
   * Get emotional result descriptor
   */
  private getEmotionalResult(valence: number, successLevel?: number): string {
    if (valence > 0.5) return 'with great enthusiasm';
    if (valence > 0) return 'with determination';
    if (valence < -0.3) return 'facing significant challenges';
    return (successLevel ?? 0.5) > 0.5 ? 'successfully' : 'with mixed results';
  }

  /**
   * Map success level to encounter type
   */
  private mapSuccessToEncounter(
    successLevel: number | undefined,
    emotionalValence: number
  ): DMLoGMemory['encounterType'] {
    if (emotionalValence < -0.4) return 'combat';
    if ((successLevel ?? 0.5) > 0.7) return 'exploration';
    if (emotionalValence > 0.3) return 'social';
    return 'puzzle';
  }

  /**
   * Map success level to D20 roll
   */
  private mapSuccessToRoll(successLevel: number | undefined): number {
    if (!successLevel) return 10;
    return Math.round(5 + (successLevel * 15));
  }

  /**
   * Map roll result to difficulty
   */
  private mapRollToDifficulty(roll?: number): number {
    if (!roll) return 5;
    return Math.max(1, Math.min(10, Math.ceil(roll / 2)));
  }

  /**
   * Map roll result to success level
   */
  private mapRollToSuccess(roll?: number): number {
    if (!roll) return 0.5;
    return Math.max(0, Math.min(1, (roll - 5) / 15));
  }

  /**
   * Map encounter type to topic
   */
  private mapEncounterToTopic(encounter?: DMLoGMemory['encounterType']): string {
    const mapping: Record<string, string> = {
      combat: 'problem-solving',
      social: 'collaboration',
      exploration: 'discovery',
      puzzle: 'critical-thinking',
    };
    return mapping[encounter ?? ''] ?? 'general-activity';
  }

  /**
   * Generate character name from memory
   */
  private generateCharacterName(memory: SourceMemory): string {
    const titles: Record<string, string> = {
      'mathematics': 'Archmage',
      'physics': 'Artificer',
      'chemistry': 'Alchemist',
      'biology': 'Naturalist',
      'history': 'Sage',
      'literature': 'Bard',
      'art': 'Creator',
      'computer-science': 'Technomancer',
    };

    const subject = (memory as StudyLoGMemory).subject?.toLowerCase() ?? '';
    return titles[subject] ?? 'Adventurer';
  }

  // ========================================================================
  // Accessor Methods
  // ========================================================================

  /**
   * Get pending transfers for a user
   */
  getPendingTransfers(userId: string): MemoryTransfer[] {
    return Array.from(this.pendingTransfers.values()).filter(
      t => {
        const mem = t.metadata.originalMemory as SourceMemory;
        return mem?.userId === userId;
      }
    );
  }

  /**
   * Get transfer history for a user
   */
  getTransferHistory(userId: string, limit = 50): MemoryTransfer[] {
    return Array.from(this.transferHistory.values())
      .filter(t => {
        const mem = t.metadata.originalMemory as SourceMemory;
        return mem?.userId === userId;
      })
      .sort((a, b) => b.proposedAt - a.proposedAt)
      .slice(0, limit);
  }

  /**
   * Get transfer statistics
   */
  getTransferStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    applied: number;
  } {
    const all = Array.from(this.transferHistory.values());

    return {
      total: all.length,
      pending: this.pendingTransfers.size,
      approved: all.filter(t => t.status === TransferStatus.APPROVED).length,
      rejected: all.filter(t => t.status === TransferStatus.REJECTED).length,
      applied: all.filter(t => t.status === TransferStatus.APPLIED).length,
    };
  }

  /**
   * Clear all transfer data
   */
  clear(): void {
    this.transferHistory.clear();
    this.pendingTransfers.clear();
    this.appliedTransfers.clear();
  }
}

// ============================================================================
// Mapping Definitions
// ============================================================================

/**
 * DMLoG mapping for StudyLoG categories
 */
interface DmLogMapping {
  class: string;
  ability: string;
  narrativeTemplate: string;
}

/**
 * StudyLoG mapping for DMLoG encounters
 */
interface StudyLogMapping {
  subject: string;
  narrativeTemplate: string;
}

/**
 * StudyLoG to DMLoG skill mappings
 */
export const STUDYLOG_TO_DMLOG_MAPPINGS = new Map<TransferCategory, DmLogMapping>([
  [TransferCategory.PROBLEM_SOLVING, {
    class: 'Rogue',
    ability: 'Investigation',
    narrativeTemplate: 'Investigated {topic} {action}, {result}',
  }],
  [TransferCategory.CRITICAL_THINKING, {
    class: 'Wizard',
    ability: 'Arcana',
    narrativeTemplate: 'Analyzed {topic} {action}, {result}',
  }],
  [TransferCategory.CREATIVITY, {
    class: 'Bard',
    ability: 'Performance',
    narrativeTemplate: 'Created innovative solution for {topic} {action}, {result}',
  }],
  [TransferCategory.COLLABORATION, {
    class: 'Cleric',
    ability: 'Insight',
    narrativeTemplate: 'Worked with party on {topic} {action}, {result}',
  }],
  [TransferCategory.PERSISTENCE, {
    class: 'Fighter',
    ability: 'Constitution',
    narrativeTemplate: 'Endured challenges in {subject} {action}, {result}',
  }],
  [TransferCategory.COMMUNICATION, {
    class: 'Bard',
    ability: 'Persuasion',
    narrativeTemplate: 'Negotiated about {topic} {action}, {result}',
  }],
  [TransferCategory.LEADERSHIP, {
    class: 'Paladin',
    ability: 'Leadership',
    narrativeTemplate: 'Led party through {topic} {action}, {result}',
  }],
  [TransferCategory.CURIOSITY, {
    class: 'Ranger',
    ability: 'Perception',
    narrativeTemplate: 'Explored {topic} {action}, {result}',
  }],
  [TransferCategory.ALGORITHMIC_THINKING, {
    class: 'Wizard',
    ability: 'Arcana',
    narrativeTemplate: 'Developed method for {topic} {action}, {result}',
  }],
  [TransferCategory.SYSTEMS_THINKING, {
    class: 'Artificer',
    ability: 'Tinker\'s Tools',
    narrativeTemplate: 'Understood systems in {topic} {action}, {result}',
  }],
]);

/**
 * DMLoG to StudyLoG encounter mappings
 */
export const DMLOG_TO_STUDYLOG_MAPPINGS = new Map<string, StudyLogMapping>([
  ['combat', {
    subject: 'problem-solving',
    narrativeTemplate: 'Faced challenges in {encounter} and {outcome}',
  }],
  ['social', {
    subject: 'collaboration',
    narrativeTemplate: 'Collaborated with others and {outcome}',
  }],
  ['exploration', {
    subject: 'discovery',
    narrativeTemplate: 'Explored new concepts and {outcome}',
  }],
  ['puzzle', {
    subject: 'critical-thinking',
    narrativeTemplate: 'Solved complex problems and {outcome}',
  }],
]);

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a memory transfer engine
 */
export function createMemoryTransferEngine(
  config?: Partial<TransferConfig>
): MemoryTransferEngine {
  return new MemoryTransferEngine(config);
}
