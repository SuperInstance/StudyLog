/**
 * Skill Synthesis Engine
 *
 * Combines skills from multiple products to create unified, cross-product skills.
 * When a user develops similar abilities in StudyLoG.AI and DMLoG.AI, this
 * system recognizes the connection and creates a synthesized skill that exists
 * at a higher level of abstraction.
 *
 * Examples:
 * - StudyLoG "algorithmic thinking" + DMLoG "tactics" -> Unified "strategic reasoning"
 * - StudyLoG "communication" + DMLoG "persuasion" -> Unified "influence"
 * - StudyLoG "collaboration" + DMLoG "party coordination" -> Unified "teamwork"
 *
 * The synthesis process:
 * 1. Detect similar skills across products
 * 2. Calculate synthesis confidence based on similarity
 * 3. Create unified skill with combined attributes
 * 4. Track synthesis quality and validate against user behavior
 */

import {
  Product,
  TransferCategory,
  UnifiedSkill,
  SkillPracticeEvent,
  SynthesizedSkill,
  SynthesisCandidate,
  SynthesisRejection,
} from './types.js';
import type { SharedIdentityManager } from './shared-identity.js';

// ============================================================================
// Synthesis Types
// ============================================================================

/**
 * A skill in a specific product that can be synthesized
 */
export interface ProductSkillForSynthesis {
  /** Product where skill exists */
  product: Product;
  /** Skill name in this product */
  skillName: string;
  /** Transfer category */
  category: TransferCategory;
  /** Skill level (0-1) */
  level: number;
  /** How many times practiced */
  practiceCount: number;
  /** Last practiced timestamp */
  lastPracticed: number;
  /** Related skills */
  relatedSkills: string[];
}

/**
 * A group of similar skills across products
 */
export interface SkillCluster {
  /** Cluster ID */
  id: string;
  /** Transfer category */
  category: TransferCategory;
  /** Skills in the cluster */
  skills: ProductSkillForSynthesis[];
  /** Proposed unified name */
  proposedName: string;
  /** Synthesis confidence (0-1) */
  synthesisConfidence: number;
  /** Why these skills cluster together */
  reasoning: string;
  /** Alternative names considered */
  alternativeNames: string[];
}

/**
 * Synthesis configuration
 */
export interface SynthesisConfig {
  /** Minimum skill level to consider for synthesis */
  minSkillLevel: number;
  /** Minimum practice count to consider */
  minPracticeCount: number;
  /** Minimum confidence threshold for synthesis */
  minSynthesisConfidence: number;
  /** How similar skills must be to cluster (0-1) */
  similarityThreshold: number;
  /** Whether to require user approval for synthesis */
  requireApproval: boolean;
  /** Maximum number of skills to synthesize at once */
  maxClusterSize: number;
}

/**
 * Default synthesis configuration
 */
export const DEFAULT_SYNTHESIS_CONFIG: SynthesisConfig = {
  minSkillLevel: 0.3,
  minPracticeCount: 5,
  minSynthesisConfidence: 0.7,
  similarityThreshold: 0.6,
  requireApproval: false,
  maxClusterSize: 4,
};

// ============================================================================
// Skill Similarity Calculation
// ============================================================================

/**
 * Similarity metric between two skills
 */
export interface SkillSimilarity {
  /** First skill */
  skill1: { product: Product; name: string };
  /** Second skill */
  skill2: { product: Product; name: string };
  /** Similarity score (0-1) */
  similarity: number;
  /** Similarity factors */
  factors: {
    categoryMatch: number;
    nameSimilarity: number;
    semanticSimilarity: number;
    practiceCorrelation: number;
  };
}

// ============================================================================
// Predefined Synthesis Mappings
// ============================================================================

/**
 * Known synthesis patterns for common skill combinations
 */
export const SYNTHESIS_PATTERNS: Array<{
  categories: TransferCategory[];
  requiredProducts: Product[];
  unifiedName: string;
  description: string;
  minConfidence: number;
}> = [
  {
    categories: [TransferCategory.ALGORITHMIC_THINKING, TransferCategory.STRATEGIC_PLANNING],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Strategic Reasoning',
    description: 'The ability to think several steps ahead and plan strategically',
    minConfidence: 0.75,
  },
  {
    categories: [TransferCategory.COLLABORATION, TransferCategory.LEADERSHIP],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Team Leadership',
    description: 'Leading and coordinating teams effectively',
    minConfidence: 0.8,
  },
  {
    categories: [TransferCategory.COMMUNICATION, TransferCategory.NEGOTIATION],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Influence',
    description: 'The ability to persuade and influence others',
    minConfidence: 0.7,
  },
  {
    categories: [TransferCategory.PROBLEM_SOLVING, TransferCategory.RESEARCH_SKILLS],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Investigative Problem Solving',
    description: 'Combining research skills with practical problem solving',
    minConfidence: 0.75,
  },
  {
    categories: [TransferCategory.CREATIVITY, TransferCategory.IMPROVISATION],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Adaptive Creativity',
    description: 'Creating novel solutions under pressure',
    minConfidence: 0.8,
  },
  {
    categories: [TransferCategory.PERSISTENCE, TransferCategory.RESILIENCE],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Grit',
    description: 'The combination of persistence and resilience in facing challenges',
    minConfidence: 0.9,
  },
  {
    categories: [TransferCategory.CURIOSITY, TransferCategory.INVESTIGATION],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Inquiry',
    description: 'The drive to explore and understand through investigation',
    minConfidence: 0.75,
  },
  {
    categories: [TransferCategory.CRITICAL_THINKING, TransferCategory.DEDUCTION],
    requiredProducts: [Product.STUDYLOG, Product.DMLOG],
    unifiedName: 'Analytical Reasoning',
    description: 'Deep analysis and logical reasoning from evidence',
    minConfidence: 0.8,
  },
];

// Add missing category for reference
const TransferCategoryExtended = {
  ...TransferCategory,
  IMPROVISATION: 'improvisation' as any,
  INVESTIGATION: 'investigation' as any,
  DEDUCTION: 'deduction' as any,
};

// ============================================================================
// Skill Synthesis Engine
// ============================================================================

/**
 * Engine for synthesizing skills across products
 */
export class SkillSynthesisEngine {
  private readonly config: SynthesisConfig;
  private readonly synthesizedSkills: Map<string, SynthesizedSkill>;
  private readonly candidates: Map<string, SynthesisCandidate>;
  private readonly rejections: SynthesisRejection[];
  private readonly identityManager: SharedIdentityManager | null;

  constructor(
    identityManager: SharedIdentityManager | null = null,
    config?: Partial<SynthesisConfig>
  ) {
    this.config = {
      ...DEFAULT_SYNTHESIS_CONFIG,
      ...config,
    };
    this.synthesizedSkills = new Map();
    this.candidates = new Map();
    this.rejections = [];
    this.identityManager = identityManager;
  }

  // ========================================================================
  // Synthesis Detection
  // ========================================================================

  /**
   * Analyze skills for synthesis opportunities
   */
  async detectSynthesisOpportunities(
    unifiedId: string
  ): Promise<SkillCluster[]> {
    if (!this.identityManager) return [];

    const skills = this.identityManager.getSkills(unifiedId);
    if (skills.length === 0) return [];

    // Group skills by category
    const byCategory = new Map<TransferCategory, ProductSkillForSynthesis[]>();

    for (const skill of skills) {
      for (const [product, level] of Object.entries(skill.productLevels)) {
        if (level.level < this.config.minSkillLevel) continue;
        if (level.practiceCount < this.config.minPracticeCount) continue;

        const skillForSynthesis: ProductSkillForSynthesis = {
          product: product as Product,
          skillName: skill.name,
          category: skill.category,
          level: level.level,
          practiceCount: level.practiceCount,
          lastPracticed: level.lastPracticed,
          relatedSkills: skill.relatedSkills,
        };

        let categorySkills = byCategory.get(skill.category);
        if (!categorySkills) {
          categorySkills = [];
          byCategory.set(skill.category, categorySkills);
        }
        categorySkills.push(skillForSynthesis);
      }
    }

    // Find synthesis opportunities
    const clusters: SkillCluster[] = [];

    for (const [category, categorySkills] of byCategory.entries()) {
      if (categorySkills.length < 2) continue;

      // Check for known synthesis patterns
      for (const pattern of SYNTHESIS_PATTERNS) {
        if (!pattern.categories.includes(category)) continue;

        // Check if we have skills from required products
        const patternSkills = categorySkills.filter(s =>
          pattern.requiredProducts.includes(s.product)
        );

        if (patternSkills.length >= pattern.requiredProducts.length) {
          const cluster: SkillCluster = {
            id: `cluster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            category,
            skills: patternSkills,
            proposedName: pattern.unifiedName,
            synthesisConfidence: this.calculateSynthesisConfidence(patternSkills),
            reasoning: pattern.description,
            alternativeNames: this.generateAlternativeNames(pattern.unifiedName),
          };

          clusters.push(cluster);
        }
      }
    }

    return clusters.sort((a, b) => b.synthesisConfidence - a.synthesisConfidence);
  }

  /**
   * Calculate synthesis confidence for a skill cluster
   */
  private calculateSynthesisConfidence(skills: ProductSkillForSynthesis[]): number {
    if (skills.length === 0) return 0;

    // Factor 1: Average skill level
    const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / skills.length;

    // Factor 2: Practice consistency (all skills well-practiced)
    const minPracticeCount = Math.min(...skills.map(s => s.practiceCount));
    const practiceFactor = Math.min(1, minPracticeCount / 10);

    // Factor 3: Category alignment (all same category)
    const categories = new Set(skills.map(s => s.category));
    const categoryAlignment = categories.size === 1 ? 1 : 0.5;

    // Factor 4: Recency (all recently practiced)
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const recencyFactor = skills.reduce((sum, s) => {
      const age = now - s.lastPracticed;
      return sum + Math.max(0, 1 - age / maxAge);
    }, 0) / skills.length;

    // Combine factors
    return (avgLevel * 0.3) +
           (practiceFactor * 0.25) +
           (categoryAlignment * 0.2) +
           (recencyFactor * 0.25);
  }

  /**
   * Generate alternative names for a synthesized skill
   */
  private generateAlternativeNames(primaryName: string): string[] {
    const alternatives: string[] = [];

    // Add simpler/complex variants
    if (primaryName.includes('Reasoning')) {
      alternatives.push('Logic', 'Analysis', 'Thought');
    }
    if (primaryName.includes('Leadership')) {
      alternatives.push('Command', 'Guidance', 'Direction');
    }
    if (primaryName.includes('Influence')) {
      alternatives.push('Persuasion', 'Impact', 'Sway');
    }
    if (primaryName.includes('Creativity')) {
      alternatives.push('Innovation', 'Imagination', 'Invention');
    }

    return alternatives;
  }

  // ========================================================================
  // Synthesis Execution
  // ========================================================================

  /**
   * Execute skill synthesis from a cluster
   */
  async synthesizeSkills(
    unifiedId: string,
    cluster: SkillCluster
  ): Promise<SynthesizedSkill | null> {
    // Check confidence threshold
    if (cluster.synthesisConfidence < this.config.minSynthesisConfidence) {
      this.rejections.push({
        name: cluster.proposedName,
        sources: cluster.skills.map(s => s.product),
        reason: `Confidence ${cluster.synthesisConfidence} below threshold ${this.config.minSynthesisConfidence}`,
        rejectedAt: Date.now(),
      });
      return null;
    }

    // Create synthesized skill
    const synthesizedSkill: SynthesizedSkill = {
      id: `synth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: cluster.proposedName,
      sources: cluster.skills.map(s => s.product),
      components: cluster.skills.map(s => `${s.product}:${s.skillName}`),
      quality: cluster.synthesisConfidence,
      level: this.calculateSynthesizedLevel(cluster.skills),
      synthesizedAt: Date.now(),
    };

    // Store synthesized skill
    this.synthesizedSkills.set(synthesizedSkill.id, synthesizedSkill);

    // Update unified identity if available
    if (this.identityManager) {
      await this.addSynthesizedSkillToIdentity(unifiedId, synthesizedSkill);
    }

    return synthesizedSkill;
  }

  /**
   * Calculate the level of a synthesized skill
   */
  private calculateSynthesizedLevel(skills: ProductSkillForSynthesis[]): number {
    // Weighted average with practice count as weight
    const totalWeight = skills.reduce((sum, s) => sum + Math.log(s.practiceCount + 1), 0);
    const weightedSum = skills.reduce(
      (sum, s) => sum + (s.level * Math.log(s.practiceCount + 1)),
      0
    );

    // Add a small bonus for synthesis (emergent property)
    const synthesisBonus = 0.05 * (skills.length - 1);

    return Math.min(1, (weightedSum / totalWeight) + synthesisBonus);
  }

  /**
   * Add synthesized skill to unified identity
   */
  private async addSynthesizedSkillToIdentity(
    unifiedId: string,
    synthesizedSkill: SynthesizedSkill
  ): Promise<void> {
    if (!this.identityManager) return;

    // In a real implementation, would update the identity with the new skill
    // For now, track the relationship
    const skillId = `${unifiedId}_${synthesizedSkill.name}`;
  }

  // ========================================================================
  // Synthesis Validation
  // ========================================================================

  /**
   * Validate a synthesized skill against user behavior
   */
  async validateSynthesis(
    synthesizedSkillId: string,
    practiceEvents: SkillPracticeEvent[]
  ): Promise {
    const skill = this.synthesizedSkills.get(synthesizedSkillId);
    if (!skill) return null;

    // Check if practice events support the synthesized skill
    const supportingEvents = practiceEvents.filter(e => {
      // Events from source products that occurred after synthesis
      return skill.sources.includes(e.product) &&
             e.timestamp >= skill.synthesizedAt;
    });

    if (supportingEvents.length === 0) {
      return {
        skillId: synthesizedSkillId,
        isValid: false,
        confidence: 0,
        reason: 'No supporting practice events since synthesis',
      };
    }

    // Calculate validation confidence
    const avgSuccess = supportingEvents.reduce((sum, e) => sum + e.success, 0) / supportingEvents.length;
    const recencyBonus = Math.min(0.2, supportingEvents.length * 0.02);

    const validation = {
      skillId: synthesizedSkillId,
      isValid: avgSuccess > 0.5,
      confidence: Math.min(1, avgSuccess + recencyBonus),
      supportingEvents: supportingEvents.length,
      reason: `${supportingEvents.length} events with ${avgSuccess.toFixed(2)} avg success`,
    };

    // Update skill quality based on validation
    if (validation.isValid) {
      skill.quality = Math.min(1, skill.quality + 0.05);
    } else {
      skill.quality = Math.max(0.3, skill.quality - 0.1);
    }

    return validation;
  }

  // ========================================================================
  // Synthesis Candidates
  // ========================================================================

  /**
   * Create a synthesis candidate for future consideration
   */
  async createCandidate(
    unifiedId: string,
    cluster: SkillCluster
  ): Promise<SynthesisCandidate> {
    const candidate: SynthesisCandidate = {
      id: `candidate_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: cluster.proposedName,
      sources: cluster.skills.map(s => s.product),
      components: cluster.skills.map(s => `${s.product}:${s.skillName}`),
      predictedQuality: cluster.synthesisConfidence,
      reason: cluster.reasoning,
    };

    this.candidates.set(candidate.id, candidate);

    return candidate;
  }

  /**
   * Get candidates ready for synthesis
   */
  getReadyCandidates(): SynthesisCandidate[] {
    return Array.from(this.candidates.values()).filter(
      c => c.predictedQuality >= this.config.minSynthesisConfidence
    ).sort((a, b) => b.predictedQuality - a.predictedQuality);
  }

  /**
   * Reject a candidate
   */
  async rejectCandidate(
    candidateId: string,
    reason: string
  ): Promise<boolean> {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) return false;

    this.rejections.push({
      name: candidate.name,
      sources: candidate.sources,
      reason,
      rejectedAt: Date.now(),
    });

    this.candidates.delete(candidateId);
    return true;
  }

  // ========================================================================
  // Analytics and Reporting
  // ========================================================================

  /**
   * Generate synthesis report
   */
  async generateSynthesisReport(unifiedId: string): Promise<{
    synthesized: SynthesizedSkill[];
    candidates: SynthesisCandidate[];
    rejected: SynthesisRejection[];
    opportunities: SkillCluster[];
  }> {
    const opportunities = await this.detectSynthesisOpportunities(unifiedId);

    return {
      synthesized: Array.from(this.synthesizedSkills.values()),
      candidates: Array.from(this.candidates.values()),
      rejected: this.rejections,
      opportunities: opportunities.filter(
        o => o.synthesisConfidence >= this.config.minSynthesisConfidence * 0.8
      ),
    };
  }

  /**
   * Get synthesis statistics
   */
  getSynthesisStats(): {
    totalSynthesized: number;
    totalCandidates: number;
    totalRejections: number;
    avgQuality: number;
    byCategory: Record<string, number>;
  } {
    const synthesized = Array.from(this.synthesizedSkills.values());
    const byCategory: Record<string, number> = {};

    for (const skill of synthesized) {
      // Determine category from name/patterns
      const category = this.inferCategory(skill.name);
      byCategory[category] = (byCategory[category] ?? 0) + 1;
    }

    return {
      totalSynthesized: synthesized.length,
      totalCandidates: this.candidates.size,
      totalRejections: this.rejections.length,
      avgQuality: synthesized.length > 0
        ? synthesized.reduce((sum, s) => sum + s.quality, 0) / synthesized.length
        : 0,
      byCategory,
    };
  }

  /**
   * Infer category from skill name
   */
  private inferCategory(skillName: string): string {
    const name = skillName.toLowerCase();

    if (name.includes('reasoning') || name.includes('logic') || name.includes('analysis')) {
      return 'critical_thinking';
    }
    if (name.includes('leadership') || name.includes('command')) {
      return 'leadership';
    }
    if (name.includes('influence') || name.includes('persuasion')) {
      return 'communication';
    }
    if (name.includes('creativity') || name.includes('innovation')) {
      return 'creativity';
    }
    if (name.includes('collaboration') || name.includes('teamwork')) {
      return 'collaboration';
    }

    return 'general';
  }

  // ========================================================================
  // Export / Import
  // ========================================================================

  /**
   * Export all synthesized skills
   */
  exportSynthesizedSkills(): SynthesizedSkill[] {
    return Array.from(this.synthesizedSkills.values());
  }

  /**
   * Import synthesized skills
   */
  importSynthesizedSkills(skills: SynthesizedSkill[]): void {
    for (const skill of skills) {
      this.synthesizedSkills.set(skill.id, skill);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.synthesizedSkills.clear();
    this.candidates.clear();
    this.rejections.length = 0;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate similarity between two skills
 */
export function calculateSkillSimilarity(
  skill1: ProductSkillForSynthesis,
  skill2: ProductSkillForSynthesis
): SkillSimilarity {
  // Category match (0 or 1)
  const categoryMatch = skill1.category === skill2.category ? 1 : 0;

  // Name similarity (based on common words)
  const nameSimilarity = calculateNameSimilarity(skill1.skillName, skill2.skillName);

  // Semantic similarity (based on category)
  const semanticSimilarity = categoryMatch === 1 ? 0.8 : 0.2;

  // Practice correlation (similar practice counts)
  const practiceDiff = Math.abs(skill1.practiceCount - skill2.practiceCount);
  const practiceCorrelation = Math.max(0, 1 - practiceDiff / 20);

  const similarity = (
    categoryMatch * 0.35 +
    nameSimilarity * 0.25 +
    semanticSimilarity * 0.25 +
    practiceCorrelation * 0.15
  );

  return {
    skill1: { product: skill1.product, name: skill1.skillName },
    skill2: { product: skill2.product, name: skill2.skillName },
    similarity,
    factors: {
      categoryMatch,
      nameSimilarity,
      semanticSimilarity,
      practiceCorrelation,
    },
  };
}

/**
 * Calculate similarity between two skill names
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const words1 = new Set(name1.toLowerCase().split(/\s+/));
  const words2 = new Set(name2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Find best synthesis match for skills
 */
export function findSynthesisMatch(
  skills: ProductSkillForSynthesis[]
): SkillCluster | null {
  if (skills.length < 2) return null;

  // Group by category
  const byCategory = new Map<TransferCategory, ProductSkillForSynthesis[]>();
  for (const skill of skills) {
    const categorySkills = byCategory.get(skill.category) ?? [];
    categorySkills.push(skill);
    byCategory.set(skill.category, categorySkills);
  }

  // Find best category match
  let bestCluster: SkillCluster | null = null;
  let bestConfidence = 0;

  for (const [category, categorySkills] of byCategory.entries()) {
    if (categorySkills.length < 2) continue;

    // Check against known patterns
    for (const pattern of SYNTHESIS_PATTERNS) {
      if (!pattern.categories.includes(category)) continue;

      const cluster: SkillCluster = {
        id: `cluster_temp`,
        category,
        skills: categorySkills,
        proposedName: pattern.unifiedName,
        synthesisConfidence: calculatePatternConfidence(categorySkills, pattern),
        reasoning: pattern.description,
        alternativeNames: [],
      };

      if (cluster.synthesisConfidence > bestConfidence) {
        bestConfidence = cluster.synthesisConfidence;
        bestCluster = cluster;
      }
    }
  }

  return bestCluster;
}

/**
 * Calculate confidence for a pattern match
 */
function calculatePatternConfidence(
  skills: ProductSkillForSynthesis[],
  pattern: {
    categories: TransferCategory[];
    requiredProducts: Product[];
    unifiedName: string;
    minConfidence: number;
  }
): number {
  // Check if we have skills from required products
  const productCoverage = pattern.requiredProducts.filter(p =>
    skills.some(s => s.product === p)
  ).length / pattern.requiredProducts.length;

  // Average skill level
  const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / skills.length;

  return productCoverage * 0.6 + avgLevel * 0.4;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a skill synthesis engine
 */
export function createSkillSynthesisEngine(
  identityManager: SharedIdentityManager | null = null,
  config?: Partial<SynthesisConfig>
): SkillSynthesisEngine {
  return new SkillSynthesisEngine(identityManager, config);
}
