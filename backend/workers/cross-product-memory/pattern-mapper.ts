/**
 * Pattern Mapper
 *
 * Maps educational patterns from StudyLoG.AI to RPG concepts in DMLoG.AI
 * and vice versa. This is the core "translation layer" that makes
 * cross-product memory sharing meaningful.
 *
 * Transfer Examples:
 * - StudyLoG "debugging" -> DMLoG "investigation"
 * - StudyLoG "collaboration" -> DMLoG "party coordination"
 * - StudyLoG "persistence" -> DMLoG "constitution"
 * - StudyLoG "creativity" -> DMLoG "improvisation"
 *
 * Inverse Transfer:
 * - DMLoG "tactics" -> StudyLoG "algorithmic thinking"
 * - DMLoG "roleplay" -> StudyLoG "empathy"
 * - DMLoG "world-building" -> StudyLoG "system design"
 */

import {
  Product,
  TransferCategory,
  TransferDirection,
  CrossProductPattern,
  PatternManifestation,
  PatternMappingResult,
  MappingMethod,
  AlternativeMapping,
  MemoryTier,
} from './types.js';

// ============================================================================
// Pattern Mapping Types
// ============================================================================

/**
 * A pattern in source product that maps to target product
 */
export interface SourcePattern {
  /** Pattern identifier in source */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Keywords that indicate this pattern */
  keywords: string[];
  /** Transfer category */
  category: TransferCategory;
  /** Memory tiers where this appears */
  tiers: MemoryTier[];
  /** Related patterns in same product */
  relatedPatterns: string[];
}

/**
 * Learning pattern recognized in behavior
 */
export interface LearningPattern {
  /** Pattern ID */
  id: string;
  /** Pattern name */
  name: string;
  /** Observed behaviors */
  behaviors: string[];
  /** Skill indicators */
  indicators: string[];
  /** Mastery level (0-1) */
  mastery: number;
  /** Products where observed */
  products: Product[];
  /** Last observed */
  lastObserved: number;
  /** Observation count */
  observationCount: number;
}

// ============================================================================
// Pattern Databases
// ============================================================================

/**
 * StudyLoG.AI patterns that can transfer to DMLoG.AI
 */
export const STUDYLOG_PATTERNS: SourcePattern[] = [
  // Problem Solving Patterns
  {
    id: 'sl_debugging',
    name: 'Debugging',
    description: 'Systematic identification and resolution of errors',
    keywords: ['debug', 'fix error', 'troubleshoot', 'bug', 'resolve issue', 'correct'],
    category: TransferCategory.PROBLEM_SOLVING,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.SEMANTIC],
    relatedPatterns: ['sl_algorithmic_thinking', 'sl_persistence'],
  },
  {
    id: 'sl_hypothesis_testing',
    name: 'Hypothesis Testing',
    description: 'Formulating and testing hypotheses systematically',
    keywords: ['hypothesis', 'experiment', 'test', 'predict', 'verify', 'validate'],
    category: TransferCategory.CRITICAL_THINKING,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['sl_scientific_method', 'sl_data_analysis'],
  },
  {
    id: 'sl_algorithmic_thinking',
    name: 'Algorithmic Thinking',
    description: 'Breaking down problems into step-by-step procedures',
    keywords: ['algorithm', 'procedure', 'sequence', 'step by step', 'systematic'],
    category: TransferCategory.ALGORITHMIC_THINKING,
    tiers: [MemoryTier.SEMANTIC, MemoryTier.PROCEDURAL],
    relatedPatterns: ['sl_debugging', 'sl_problem_decomposition'],
  },

  // Collaboration Patterns
  {
    id: 'sl_peer_teaching',
    name: 'Peer Teaching',
    description: 'Explaining concepts to fellow students',
    keywords: ['teach', 'explain to', 'show', 'help understand', 'tutor'],
    category: TransferCategory.COMMUNICATION,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['sl_collaboration', 'sl_empathy'],
  },
  {
    id: 'sl_collaborative_problem_solving',
    name: 'Collaborative Problem Solving',
    description: 'Working together to solve complex problems',
    keywords: ['team', 'together', 'group', 'collaborate', 'pair', 'joint'],
    category: TransferCategory.COLLABORATION,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['sl_communication', 'sl_leadership'],
  },

  // Persistence Patterns
  {
    id: 'sl_productive_struggle',
    name: 'Productive Struggle',
    description: 'Persisting through difficult problems without giving up',
    keywords: ['stuck but kept trying', 'didn\'t give up', 'persistent', 'resilient', 'continued'],
    category: TransferCategory.PERSISTENCE,
    tiers: [MemoryTier.IDENTITY, MemoryTier.REFLECTION],
    relatedPatterns: ['sl_growth_mindset', 'sl_resilience'],
  },
  {
    id: 'sl_iteration',
    name: 'Iterative Improvement',
    description: 'Trying multiple approaches to improve solutions',
    keywords: ['improve', 'refine', 'revise', 'iterate', 'better version', 'optimized'],
    category: TransferCategory.CREATIVITY,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.REFLECTION],
    relatedPatterns: ['sl_productive_struggle', 'sl_creativity'],
  },

  // Creativity Patterns
  {
    id: 'sl_creative_solution',
    name: 'Creative Problem Solving',
    description: 'Finding novel solutions to problems',
    keywords: ['creative', 'innovative', 'novel', 'unique', 'original', 'inventive'],
    category: TransferCategory.CREATIVITY,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.REFLECTION],
    relatedPatterns: ['sl_divergent_thinking', 'sl_iteration'],
  },
  {
    id: 'sl_divergent_thinking',
    name: 'Divergent Thinking',
    description: 'Generating multiple possible solutions',
    keywords: ['alternatives', 'multiple ways', 'different approaches', 'brainstorm'],
    category: TransferCategory.CREATIVITY,
    tiers: [MemoryTier.SEMANTIC, MemoryTier.PROCEDURAL],
    relatedPatterns: ['sl_creative_solution', 'sl_algorithmic_thinking'],
  },

  // Curiosity Patterns
  {
    id: 'sl_exploratory_learning',
    name: 'Exploratory Learning',
    description: 'Actively seeking to learn new things',
    keywords: ['explore', 'discover', 'investigate', 'curious', 'wonder', 'find out'],
    category: TransferCategory.CURIOSITY,
    tiers: [MemoryTier.IDENTITY, MemoryTier.EPISODIC],
    relatedPatterns: ['sl_inquiry', 'sl_research_skills'],
  },
  {
    id: 'sl_question_asking',
    name: 'Question Asking',
    description: 'Formulating and asking questions to understand',
    keywords: ['question', 'ask', 'wonder why', 'how does', 'what if', 'clarify'],
    category: TransferCategory.CURIOSITY,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['sl_exploratory_learning', 'sl_critical_thinking'],
  },

  // Systems Thinking
  {
    id: 'sl_systems_analysis',
    name: 'Systems Analysis',
    description: 'Understanding how parts relate to the whole',
    keywords: ['system', 'interconnect', 'relationship', 'holistic', 'integrated', 'components'],
    category: TransferCategory.SYSTEMS_THINKING,
    tiers: [MemoryTier.SEMANTIC, MemoryTier.REFLECTION],
    relatedPatterns: ['sl_pattern_recognition', 'sl_algorithmic_thinking'],
  },
  {
    id: 'sl_pattern_recognition',
    name: 'Pattern Recognition',
    description: 'Identifying patterns in data or behavior',
    keywords: ['pattern', 'recognize', 'identify', 'classify', 'trend', 'regularity'],
    category: TransferCategory.PATTERN_RECOGNITION,
    tiers: [MemoryTier.SEMANTIC, MemoryTier.PROCEDURAL],
    relatedPatterns: ['sl_systems_analysis', 'sl_abstraction'],
  },
];

/**
 * DMLoG.AI patterns that can transfer to StudyLoG.AI
 */
export const DMLOG_PATTERNS: SourcePattern[] = [
  // Tactical Patterns
  {
    id: 'dl_tactical_planning',
    name: 'Tactical Planning',
    description: 'Planning actions strategically for optimal outcomes',
    keywords: ['tactics', 'plan action', 'strategic', 'position', 'advantage'],
    category: TransferCategory.STRATEGIC_PLANNING,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.SEMANTIC],
    relatedPatterns: ['dl_resource_management', 'dl_risk_assessment'],
  },
  {
    id: 'dl_resource_management',
    name: 'Resource Management',
    description: 'Managing limited resources effectively',
    keywords: ['resource', 'manage', 'conserve', 'allocate', 'ration', 'budget'],
    category: TransferCategory.STRATEGIC_PLANNING,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.SEMANTIC],
    relatedPatterns: ['dl_tactical_planning', 'dl_prioritization'],
  },

  // Social Patterns
  {
    id: 'dl_negotiation',
    name: 'Negotiation',
    description: 'Reaching agreements through discussion',
    keywords: ['negotiate', 'compromise', 'agree', 'bargain', 'persuade', 'deal'],
    category: TransferCategory.NEGOTIATION,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['dl_persuasion', 'dl_diplomacy'],
  },
  {
    id: 'dl_roleplay',
    name: 'Roleplay',
    description: 'Adopting and embodying a character perspective',
    keywords: ['roleplay', 'in character', 'persona', 'portray', 'embody'],
    category: TransferCategory.EMPATHY,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['dl_perspective_taking', 'dl_social_intelligence'],
  },
  {
    id: 'dl_party_coordination',
    name: 'Party Coordination',
    description: 'Coordinating actions with party members',
    keywords: ['coordinate', 'party', 'team up', 'combine actions', 'support'],
    category: TransferCategory.COLLABORATION,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['dl_leadership', 'dl_communication'],
  },

  // Creative Patterns
  {
    id: 'dl_improvisation',
    name: 'Improvisation',
    description: 'Adapting creatively to unexpected situations',
    keywords: ['improvise', 'adapt', 'wing it', 'creative solution', 'quick thinking'],
    category: TransferCategory.CREATIVITY,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.EPISODIC],
    relatedPatterns: ['dl_adaptability', 'dl_creativity'],
  },
  {
    id: 'dl_world_building',
    name: 'World Building',
    description: 'Creating coherent fictional worlds and systems',
    keywords: ['world build', 'create setting', 'lore', 'backstory', 'history', 'geography'],
    category: TransferCategory.SYSTEMS_THINKING,
    tiers: [MemoryTier.SEMANTIC, MemoryTier.PROCEDURAL],
    relatedPatterns: ['dl_systems_thinking', 'dl_creativity'],
  },

  // Investigation Patterns
  {
    id: 'dl_investigation',
    name: 'Investigation',
    description: 'Gathering and analyzing information to solve mysteries',
    keywords: ['investigate', 'examine', 'search', 'analyze', 'deduce', 'clues'],
    category: TransferCategory.RESEARCH_SKILLS,
    tiers: [MemoryTier.PROCEDURAL, MemoryTier.SEMANTIC],
    relatedPatterns: ['dl_perception', 'dl_logic'],
  },
  {
    id: 'dl_deduction',
    name: 'Deduction',
    description: 'Logical reasoning from evidence to conclusions',
    keywords: ['deduce', 'conclude', 'infer', 'reasoning', 'logic', 'evidence'],
    category: TransferCategory.CRITICAL_THINKING,
    tiers: [MemoryTier.SEMANTIC, MemoryTier.PROCEDURAL],
    relatedPatterns: ['dl_investigation', 'dl_analysis'],
  },

  // Resilience Patterns
  {
    id: 'dl_resilience',
    name: 'Resilience',
    description: 'Recovering from setbacks and continuing forward',
    keywords: ['recover', 'bounce back', 'persevere', 'endure', 'withstand'],
    category: TransferCategory.RESILIENCE,
    tiers: [MemoryTier.IDENTITY, MemoryTier.REFLECTION],
    relatedPatterns: ['dl_constitution', 'dl_willpower'],
  },
];

// ============================================================================
// Pattern Mapping Tables
// ============================================================================

/**
 * Mapping from StudyLoG patterns to DMLoG equivalents
 */
export const STUDYLOG_TO_DMLOG_MAPPING: Record<string, {
  targetPattern: string;
  confidence: number;
  method: MappingMethod;
  explanation: string;
}> = {
  'sl_debugging': {
    targetPattern: 'dl_investigation',
    confidence: 0.9,
    method: MappingMethod.SEMANTIC,
    explanation: 'Debugging and investigation both involve systematic examination to find solutions',
  },
  'sl_algorithmic_thinking': {
    targetPattern: 'dl_tactical_planning',
    confidence: 0.85,
    method: MappingMethod.STRUCTURAL,
    explanation: 'Both involve breaking down complex situations into manageable steps',
  },
  'sl_collaborative_problem_solving': {
    targetPattern: 'dl_party_coordination',
    confidence: 0.95,
    method: MappingMethod.EXACT,
    explanation: 'Direct equivalent - working with others to achieve goals',
  },
  'sl_peer_teaching': {
    targetPattern: 'dl_negotiation',
    confidence: 0.75,
    method: MappingMethod.DERIVED,
    explanation: 'Both involve communication to achieve understanding/agreement',
  },
  'sl_productive_struggle': {
    targetPattern: 'dl_resilience',
    confidence: 0.9,
    method: MappingMethod.SEMANTIC,
    explanation: 'Both represent persistence through challenges',
  },
  'sl_creative_solution': {
    targetPattern: 'dl_improvisation',
    confidence: 0.85,
    method: MappingMethod.SEMANTIC,
    explanation: 'Both involve finding novel approaches to problems',
  },
  'sl_divergent_thinking': {
    targetPattern: 'dl_improvisation',
    confidence: 0.8,
    method: MappingMethod.DERIVED,
    explanation: 'Generating alternatives supports creative adaptation',
  },
  'sl_exploratory_learning': {
    targetPattern: 'dl_investigation',
    confidence: 0.75,
    method: MappingMethod.DERIVED,
    explanation: 'Curiosity drives investigation and exploration',
  },
  'sl_systems_analysis': {
    targetPattern: 'dl_world_building',
    confidence: 0.7,
    method: MappingMethod.STRUCTURAL,
    explanation: 'Both involve understanding how components form a whole',
  },
  'sl_pattern_recognition': {
    targetPattern: 'dl_deduction',
    confidence: 0.8,
    method: MappingMethod.SEMANTIC,
    explanation: 'Pattern recognition supports logical deduction',
  },
  'sl_hypothesis_testing': {
    targetPattern: 'dl_deduction',
    confidence: 0.85,
    method: MappingMethod.STRUCTURAL,
    explanation: 'Both involve forming and testing conclusions from evidence',
  },
  'sl_iteration': {
    targetPattern: 'dl_resilience',
    confidence: 0.7,
    method: MappingMethod.DERIVED,
    explanation: 'Iterative improvement requires resilience through failures',
  },
  'sl_question_asking': {
    targetPattern: 'dl_investigation',
    confidence: 0.8,
    method: MappingMethod.SEMANTIC,
    explanation: 'Questions drive investigation',
  },
};

/**
 * Mapping from DMLoG patterns to StudyLoG equivalents
 */
export const DMLOG_TO_STUDYLOG_MAPPING: Record<string, {
  targetPattern: string;
  confidence: number;
  method: MappingMethod;
  explanation: string;
}> = {
  'dl_tactical_planning': {
    targetPattern: 'sl_algorithmic_thinking',
    confidence: 0.9,
    method: MappingMethod.STRUCTURAL,
    explanation: 'Tactical planning requires algorithmic thinking and procedural reasoning',
  },
  'dl_resource_management': {
    targetPattern: 'sl_systems_analysis',
    confidence: 0.8,
    method: MappingMethod.DERIVED,
    explanation: 'Resource management requires understanding system constraints',
  },
  'dl_negotiation': {
    targetPattern: 'sl_peer_teaching',
    confidence: 0.75,
    method: MappingMethod.SEMANTIC,
    explanation: 'Both involve communication and social intelligence',
  },
  'dl_roleplay': {
    targetPattern: 'sl_empathy', // Maps to communication/understanding
    confidence: 0.85,
    method: MappingMethod.SEMANTIC,
    explanation: 'Roleplay develops empathy and perspective-taking',
  },
  'dl_party_coordination': {
    targetPattern: 'sl_collaborative_problem_solving',
    confidence: 0.95,
    method: MappingMethod.EXACT,
    explanation: 'Direct equivalent - coordinating with others',
  },
  'dl_improvisation': {
    targetPattern: 'sl_creative_solution',
    confidence: 0.9,
    method: MappingMethod.SEMANTIC,
    explanation: 'Both involve creative thinking under constraints',
  },
  'dl_world_building': {
    targetPattern: 'sl_systems_analysis',
    confidence: 0.85,
    method: MappingMethod.STRUCTURAL,
    explanation: 'World building is essentially systems thinking applied to fiction',
  },
  'dl_investigation': {
    targetPattern: 'sl_debugging',
    confidence: 0.85,
    method: MappingMethod.SEMANTIC,
    explanation: 'Both involve systematic examination to find answers',
  },
  'dl_deduction': {
    targetPattern: 'sl_hypothesis_testing',
    confidence: 0.9,
    method: MappingMethod.STRUCTURAL,
    explanation: 'Deduction is the practical application of hypothesis testing',
  },
  'dl_resilience': {
    targetPattern: 'sl_productive_struggle',
    confidence: 0.9,
    method: MappingMethod.SEMANTIC,
    explanation: 'Both represent persistence through challenges',
  },
};

// ============================================================================
// Pattern Mapper Engine
// ============================================================================

/**
 * Pattern mapper for cross-product translation
 */
export class PatternMapper {
  private readonly learnedMappings: Map<string, PatternMappingResult>;
  private readonly patternRecognitions: Map<string, number>;

  constructor() {
    this.learnedMappings = new Map();
    this.patternRecognitions = new Map();
  }

  // ========================================================================
  // Pattern Recognition
  // ========================================================================

  /**
   * Recognize patterns in text content
   */
  recognizePatterns(
    content: string,
    product: Product,
    tags: string[] = []
  ): Map<string, number> {
    const patterns = new Map<string, number>();
    const normalizedContent = content.toLowerCase();

    const patternDatabase = product === Product.STUDYLOG
      ? STUDYLOG_PATTERNS
      : DMLOG_PATTERNS;

    for (const pattern of patternDatabase) {
      let score = 0;

      // Check keywords in content
      for (const keyword of pattern.keywords) {
        if (normalizedContent.includes(keyword.toLowerCase())) {
          score += 2;
        }
      }

      // Check tags
      for (const tag of tags) {
        if (pattern.keywords.some(k => tag.toLowerCase().includes(k.toLowerCase()))) {
          score += 3;
        }
      }

      if (score > 0) {
        patterns.set(pattern.id, Math.min(score, 10));
      }
    }

    return patterns;
  }

  /**
   * Get pattern details by ID
   */
  getPattern(patternId: string): SourcePattern | undefined {
    const prefix = patternId.substring(0, 3);
    const database = prefix === 'sl_'
      ? STUDYLOG_PATTERNS
      : DMLOG_PATTERNS;

    return database.find(p => p.id === patternId);
  }

  // ========================================================================
  // Pattern Mapping
  // ========================================================================

  /**
   * Map a pattern from source product to target product
   */
  mapPattern(
    sourcePatternId: string,
    sourceProduct: Product,
    targetProduct: Product
  ): PatternMappingResult | null {
    // Validate products
    if (sourceProduct === targetProduct) {
      return null;
    }

    // Check for learned mapping first
    const cacheKey = `${sourcePatternId}_${targetProduct}`;
    const cached = this.learnedMappings.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get appropriate mapping table
    const mappingTable = sourceProduct === Product.STUDYLOG
      ? STUDYLOG_TO_DMLOG_MAPPING
      : sourceProduct === Product.DMLOG
        ? DMLOG_TO_STUDYLOG_MAPPING
        : {};

    const mapping = mappingTable[sourcePatternId];
    if (!mapping) {
      // Try to find a semantic match
      return this.findSemanticMatch(sourcePatternId, sourceProduct, targetProduct);
    }

    const result: PatternMappingResult = {
      sourcePattern: sourcePatternId,
      targetPattern: mapping.targetPattern,
      confidence: mapping.confidence,
      method: mapping.method,
      alternatives: this.findAlternatives(
        sourcePatternId,
        mapping.targetPattern,
        sourceProduct,
        targetProduct
      ),
    };

    // Cache the result
    this.learnedMappings.set(cacheKey, result);

    return result;
  }

  /**
   * Find semantic match when no direct mapping exists
   */
  private findSemanticMatch(
    sourcePatternId: string,
    sourceProduct: Product,
    targetProduct: Product
  ): PatternMappingResult | null {
    const sourcePattern = this.getPattern(sourcePatternId);
    if (!sourcePattern) return null;

    const targetDatabase = targetProduct === Product.STUDYLOG
      ? STUDYLOG_PATTERNS
      : DMLOG_PATTERNS;

    let bestMatch: { pattern: SourcePattern; score: number } | null = null;

    for (const targetPattern of targetDatabase) {
      // Check category match
      if (targetPattern.category !== sourcePattern.category) {
        continue;
      }

      // Calculate similarity based on keywords
      let score = 0;
      for (const sourceKeyword of sourcePattern.keywords) {
        for (const targetKeyword of targetPattern.keywords) {
          if (sourceKeyword.toLowerCase() === targetKeyword.toLowerCase()) {
            score += 5;
          } else if (sourceKeyword.toLowerCase().includes(targetKeyword.toLowerCase()) ||
                     targetKeyword.toLowerCase().includes(sourceKeyword.toLowerCase())) {
            score += 2;
          }
        }
      }

      if (bestMatch === null || score > bestMatch.score) {
        bestMatch = { pattern: targetPattern, score };
      }
    }

    if (bestMatch && bestMatch.score > 0) {
      const confidence = Math.min(0.9, bestMatch.score / 10);

      return {
        sourcePattern: sourcePatternId,
        targetPattern: bestMatch.pattern.id,
        confidence,
        method: MappingMethod.SEMANTIC,
        alternatives: [],
      };
    }

    return null;
  }

  /**
   * Find alternative mappings with lower confidence
   */
  private findAlternatives(
    sourcePatternId: string,
    primaryTarget: string,
    sourceProduct: Product,
    targetProduct: Product
  ): AlternativeMapping[] {
    const sourcePattern = this.getPattern(sourcePatternId);
    if (!sourcePattern) return [];

    const targetDatabase = targetProduct === Product.STUDYLOG
      ? STUDYLOG_PATTERNS
      : DMLOG_PATTERNS;

    const alternatives: AlternativeMapping[] = [];

    for (const targetPattern of targetDatabase) {
      if (targetPattern.id === primaryTarget) continue;

      // Check if same category
      if (targetPattern.category !== sourcePattern.category) continue;

      // Calculate overlap
      const keywordOverlap = sourcePattern.keywords.filter(sk =>
        targetPattern.keywords.some(tk =>
          sk.toLowerCase().includes(tk.toLowerCase()) ||
          tk.toLowerCase().includes(sk.toLowerCase())
        )
      ).length;

      if (keywordOverlap > 0) {
        alternatives.push({
          targetPattern: targetPattern.id,
          confidence: Math.min(0.7, keywordOverlap * 0.2),
          reason: `Shares ${keywordOverlap} keywords with source pattern`,
        });
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  // ========================================================================
  // Cross-Product Pattern Creation
  // ========================================================================

  /**
   * Create a cross-product pattern from recognized patterns
   */
  createCrossProductPattern(
    patternId: string,
    sourceProduct: Product,
    recognitions: Map<string, number>
  ): CrossProductPattern | null {
    const sourcePattern = this.getPattern(patternId);
    if (!sourcePattern) return null;

    const targetProduct = sourceProduct === Product.STUDYLOG
      ? Product.DMLOG
      : Product.STUDYLOG;

    const mapping = this.mapPattern(patternId, sourceProduct, targetProduct);
    if (!mapping) return null;

    const targetPattern = this.getPattern(mapping.targetPattern);
    if (!targetPattern) return null;

    const crossProductPattern: CrossProductPattern = {
      id: `cp_${sourcePattern.id}_${targetPattern.id}`,
      name: sourcePattern.name,
      description: `Cross-product pattern: ${sourcePattern.name} (${sourceProduct}) -> ${targetPattern.name} (${targetProduct})`,
      products: [sourceProduct, targetProduct],
      category: sourcePattern.category,
      manifestations: {
        [sourceProduct]: {
          name: sourcePattern.name,
          description: sourcePattern.description,
          indicators: sourcePattern.keywords,
          examples: this.generateExamples(sourcePattern, sourceProduct),
          relatedSkills: sourcePattern.relatedPatterns,
        },
        [targetProduct]: {
          name: targetPattern.name,
          description: targetPattern.description,
          indicators: targetPattern.keywords,
          examples: this.generateExamples(targetPattern, targetProduct),
          relatedSkills: targetPattern.relatedPatterns,
        },
      },
      recognitionCount: recognitions.get(patternId) ?? 1,
      strength: mapping.confidence,
      relatedPatterns: [
        ...sourcePattern.relatedPatterns,
        ...targetPattern.relatedPatterns,
      ],
      tags: [sourcePattern.category, 'cross_product'],
      createdAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };

    return crossProductPattern;
  }

  /**
   * Generate examples for a pattern
   */
  private generateExamples(pattern: SourcePattern, product: Product): string[] {
    const examples: string[] = [];

    if (product === Product.STUDYLOG) {
      examples.push(`Student demonstrates ${pattern.name.toLowerCase()} when ${pattern.keywords[0]}`);
      examples.push(`Learning session shows evidence of ${pattern.name.toLowerCase()}`);
    } else {
      examples.push(`Character uses ${pattern.name.toLowerCase()} during ${pattern.keywords[0]}`);
      examples.push(`Roleplay scenario demonstrates ${pattern.name.toLowerCase()}`);
    }

    return examples;
  }

  // ========================================================================
  // Learning from User Behavior
  // ========================================================================

  /**
   * Record a pattern recognition for learning
   */
  recordRecognition(patternId: string, context: string): void {
    const current = this.patternRecognitions.get(patternId) ?? 0;
    this.patternRecognitions.set(patternId, current + 1);
  }

  /**
   * Learn from user feedback on mappings
   */
  learnFromFeedback(
    sourcePatternId: string,
    targetPatternId: string,
    wasCorrect: boolean
  ): void {
    const cacheKey = `${sourcePatternId}_${targetPatternId}`;
    const existing = this.learnedMappings.get(cacheKey);

    if (existing) {
      // Adjust confidence based on feedback
      const adjustment = wasCorrect ? 0.05 : -0.1;
      const newConfidence = Math.max(0, Math.min(1, existing.confidence + adjustment));

      this.learnedMappings.set(cacheKey, {
        ...existing,
        confidence: newConfidence,
        method: newConfidence > 0.8 ? MappingMethod.LEARNED : existing.method,
      });
    }
  }

  /**
   * Add a custom mapping
   */
  addCustomMapping(
    sourcePatternId: string,
    targetPatternId: string,
    confidence: number
  ): void {
    const cacheKey = `${sourcePatternId}_${targetPatternId}`;

    this.learnedMappings.set(cacheKey, {
      sourcePattern: sourcePatternId,
      targetPattern: targetPatternId,
      confidence,
      method: MappingMethod.MANUAL,
      alternatives: [],
    });
  }

  // ========================================================================
  // Analytics and Export
  // ========================================================================

  /**
   * Get pattern mapping statistics
   */
  getMappingStats(): {
    totalLearnedMappings: number;
    totalRecognitions: number;
    topPatterns: Array<{ patternId: string; count: number }>;
  } {
    return {
      totalLearnedMappings: this.learnedMappings.size,
      totalRecognitions: this.patternRecognitions.size,
      topPatterns: Array.from(this.patternRecognitions.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([patternId, count]) => ({ patternId, count })),
    };
  }

  /**
   * Export all learned mappings
   */
  exportLearnedMappings(): Array<{
    sourcePattern: string;
    targetPattern: string;
    confidence: number;
    method: MappingMethod;
  }> {
    return Array.from(this.learnedMappings.values()).map(m => ({
      sourcePattern: m.sourcePattern,
      targetPattern: m.targetPattern,
      confidence: m.confidence,
      method: m.method,
    }));
  }

  /**
   * Import learned mappings
   */
  importLearnedMappings(
    mappings: Array<{
      sourcePattern: string;
      targetPattern: string;
      confidence: number;
      method?: MappingMethod;
    }>
  ): void {
    for (const mapping of mappings) {
      const cacheKey = `${mapping.sourcePattern}_${mapping.targetPattern}`;
      this.learnedMappings.set(cacheKey, {
        sourcePattern: mapping.sourcePattern,
        targetPattern: mapping.targetPattern,
        confidence: mapping.confidence,
        method: mapping.method ?? MappingMethod.MANUAL,
        alternatives: [],
      });
    }
  }

  /**
   * Clear all learned data
   */
  clear(): void {
    this.learnedMappings.clear();
    this.patternRecognitions.clear();
  }
}

// ============================================================================
// Category Mapping Table
// ============================================================================

/**
 * Direct category mappings between products
 */
export const CATEGORY_MAPPINGS: Record<TransferCategory, {
  studylogTerm: string;
  dmlogTerm: string;
  description: string;
}> = {
  [TransferCategory.PROBLEM_SOLVING]: {
    studylogTerm: 'Debugging / Problem Solving',
    dmlogTerm: 'Investigation',
    description: 'Systematic approach to finding solutions',
  },
  [TransferCategory.CRITICAL_THINKING]: {
    studylogTerm: 'Critical Analysis',
    dmlogTerm: 'Insight / Perception',
    description: 'Analyzing information to form judgments',
  },
  [TransferCategory.CREATIVITY]: {
    studylogTerm: 'Creative Problem Solving',
    dmlogTerm: 'Improvisation',
    description: 'Generating novel solutions',
  },
  [TransferCategory.PATTERN_RECOGNITION]: {
    studylogTerm: 'Pattern Recognition',
    dmlogTerm: 'Investigation',
    description: 'Identifying recurring structures',
  },
  [TransferCategory.SYSTEMS_THINKING]: {
    studylogTerm: 'Systems Analysis',
    dmlogTerm: 'World Building',
    description: 'Understanding component relationships',
  },
  [TransferCategory.ALGORITHMIC_THINKING]: {
    studylogTerm: 'Algorithmic Thinking',
    dmlogTerm: 'Tactics',
    description: 'Step-by-step procedural reasoning',
  },
  [TransferCategory.COLLABORATION]: {
    studylogTerm: 'Collaborative Learning',
    dmlogTerm: 'Party Coordination',
    description: 'Working effectively with others',
  },
  [TransferCategory.COMMUNICATION]: {
    studylogTerm: 'Communication',
    dmlogTerm: 'Persuasion / Performance',
    description: 'Conveying information effectively',
  },
  [TransferCategory.EMPATHY]: {
    studylogTerm: 'Perspective Taking',
    dmlogTerm: 'Roleplay',
    description: 'Understanding others\' viewpoints',
  },
  [TransferCategory.LEADERSHIP]: {
    studylogTerm: 'Leadership',
    dmlogTerm: 'Command',
    description: 'Guiding others toward goals',
  },
  [TransferCategory.NEGOTIATION]: {
    studylogTerm: 'Communication',
    dmlogTerm: 'Negotiation',
    description: 'Reaching mutually beneficial agreements',
  },
  [TransferCategory.PERSISTENCE]: {
    studylogTerm: 'Productive Struggle',
    dmlogTerm: 'Constitution',
    description: 'Continuing despite difficulties',
  },
  [TransferCategory.CURIOSITY]: {
    studylogTerm: 'Exploratory Learning',
    dmlogTerm: 'Investigation',
    description: 'Seeking to understand more',
  },
  [TransferCategory.ADAPTABILITY]: {
    studylogTerm: 'Adaptive Learning',
    dmlogTerm: 'Improvisation',
    description: 'Adjusting to changing conditions',
  },
  [TransferCategory.RESILIENCE]: {
    studylogTerm: 'Resilience',
    dmlogTerm: 'Resilience',
    description: 'Recovering from setbacks',
  },
  [TransferCategory.FOCUS]: {
    studylogTerm: 'Sustained Attention',
    dmlogTerm: 'Concentration',
    description: 'Maintaining attention on task',
  },
  [TransferCategory.TECHNICAL_KNOWLEDGE]: {
    studylogTerm: 'Technical Skills',
    dmlogTerm: 'Arcana / Tinkering',
    description: 'Specialized domain knowledge',
  },
  [TransferCategory.RESEARCH_SKILLS]: {
    studylogTerm: 'Research Methods',
    dmlogTerm: 'Investigation',
    description: 'Finding and analyzing information',
  },
  [TransferCategory.DESIGN_THINKING]: {
    studylogTerm: 'Design Thinking',
    dmlogTerm: 'Crafting',
    description: 'Human-centered problem solving',
  },
  [TransferCategory.STRATEGIC_PLANNING]: {
    studylogTerm: 'Strategic Planning',
    dmlogTerm: 'Tactics',
    description: 'Planning for optimal outcomes',
  },
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pattern mapper instance
 */
export function createPatternMapper(): PatternMapper {
  return new PatternMapper();
}

/**
 * Get pattern mapping between categories
 */
export function getCategoryMapping(
  category: TransferCategory
): { studylogTerm: string; dmlogTerm: string; description: string } | undefined {
  return CATEGORY_MAPPINGS[category];
}

/**
 * Find category by keywords
 */
export function findCategoryByKeywords(keywords: string[]): TransferCategory[] {
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  const matches: TransferCategory[] = [];

  for (const [category, mapping] of Object.entries(CATEGORY_MAPPINGS)) {
    const combined = `${mapping.studylogTerm} ${mapping.dmlogTerm} ${mapping.description}`.toLowerCase();
    if (normalizedKeywords.some(kw => combined.includes(kw))) {
      matches.push(category as TransferCategory);
    }
  }

  return matches;
}
