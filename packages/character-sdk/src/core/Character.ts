/**
 * Main Character Class
 *
 * Unified AI Character with memory, personality, and learning.
 * This is the main facade that combines all SDK subsystems.
 */

import type {
  BaseCharacter,
  CharacterConfig,
  CharacterResponse,
  CharacterStats,
  DecisionTier,
  ThoughtContext,
  Memory,
  MemoryTier,
  PersonalitySummary,
  LearningSignal,
  LearningSummary,
  ThinkHandler,
  ActHandler,
  CharacterState,
} from './types.js';

import { HierarchicalMemory } from '../memory/index.js';
import { DecisionEngine } from '../decision/index.js';
import { Personality } from '../personality/index.js';
import { OutcomeTracker } from '../learning/index.js';

/**
 * Character class
 *
 * The main entry point for the Character SDK. Combines memory, personality,
 * decision-making, and learning into a simple API.
 *
 * @example
 * ```ts
 * const hero = new Character({
 *   name: 'Luna',
 *   characterClass: 'ranger',
 *   personality: { bravery: 0.8, curiosity: 0.9 },
 *   backstory: 'A wanderer from the northern forests.',
 *   goals: ['Protect the forest', 'Help those in need'],
 * });
 *
 * // Use the character
 * const response = await hero.think('A merchant needs help');
 * hero.remember('Helped the merchant', 7.0);
 * hero.learn('Made a new ally', true, 10);
 * ```
 */
export class Character implements BaseCharacter {
  readonly name: string;
  readonly characterClass: string;
  readonly description: string;
  readonly backstory: string;
  readonly goals: string[];
  readonly fears: string[];
  readonly quirks: string[];
  readonly createdAt: Date;

  public state: CharacterState;
  public interactionCount: number;

  readonly memory: HierarchicalMemory;
  readonly personality: Personality;
  readonly decisionEngine: DecisionEngine;
  readonly outcomes: OutcomeTracker;

  private config: CharacterConfig;

  constructor(config: Partial<CharacterConfig> & { name: string }) {
    // Set defaults
    this.config = {
      name: config.name,
      characterClass: config.characterClass ?? 'adventurer',
      description: config.description ?? '',
      personality: config.personality ?? {},
      backstory: config.backstory ?? '',
      goals: config.goals ?? [],
      fears: config.fears ?? [],
      quirks: config.quirks ?? [],
      memoryStoragePath: config.memoryStoragePath ?? null,
      maxWorkingMemories: config.maxWorkingMemories ?? 10,
      memoryImportanceThreshold: config.memoryImportanceThreshold ?? 5.0,
      decisionConfidenceThreshold: config.decisionConfidenceThreshold ?? 0.7,
      enableEscalation: config.enableEscalation ?? true,
      enableLearning: config.enableLearning ?? true,
      learningRate: config.learningRate ?? 0.1,
      onThink: config.onThink ?? null,
      onAct: config.onAct ?? null,
    };

    // Basic properties
    this.name = this.config.name;
    this.characterClass = this.config.characterClass;
    this.description = this.config.description;
    this.backstory = this.config.backstory;
    this.goals = this.config.goals;
    this.fears = this.config.fears;
    this.quirks = this.config.quirks;

    // State
    this.state = 'idle' as CharacterState;
    this.createdAt = new Date();
    this.interactionCount = 0;

    // Initialize subsystems
    this.memory = new HierarchicalMemory(
      this.name,
      { maxWorkingMemories: this.config.maxWorkingMemories }
    );

    this.personality = new Personality(
      this.config.personality,
      {
        characterClass: this.characterClass,
        description: this.description,
        quirks: this.quirks,
      }
    );

    this.decisionEngine = new DecisionEngine({
      confidenceThreshold: this.config.decisionConfidenceThreshold,
      enableEscalation: this.config.enableEscalation,
      enableLearning: this.config.enableLearning,
    });

    this.outcomes = new OutcomeTracker({
      characterId: this.name,
      learningRate: this.config.learningRate,
      enabled: this.config.enableLearning,
    });

    // Store core identity as semantic memory
    this.initializeIdentity();
  }

  /**
   * THINK - Generate a response to a situation
   *
   * This is the main cognitive method. Routes through the decision engine
   * and applies personality modifiers.
   */
  async think(
    situation: string,
    stakes = 0.5,
    urgencyMs?: number,
    context?: ThoughtContext
  ): Promise<CharacterResponse> {
    const startTime = Date.now();
    this.state = 'thinking' as CharacterState;
    this.interactionCount++;

    // Build context
    const thoughtContext = context ?? {
      situation,
      stakes,
      urgencyMs,
      location: '',
      participants: [],
      metadata: {},
    };
    thoughtContext.situation = situation;

    // Get relevant memories
    const relevantMemories = this.memory.retrieve(situation, { topK: 5 });

    // Build character context
    const characterContext = this.buildContext(relevantMemories);

    // Classify situation
    const situationType = this.classifySituation(situation);

    // Route decision
    const decision = this.decisionEngine.route({
      characterId: this.name,
      situationType,
      situationDescription: situation,
      stakes,
      urgencyMs: urgencyMs ?? null,
      characterHpRatio: 1.0,
      availableResources: {},
      similarDecisionsCount: 0,
      recentFailures: 0,
      timestamp: Date.now(),
      customData: {},
    });

    // Generate response based on tier
    let response: CharacterResponse;
    const isHighStakes = stakes >= 0.8;

    if (decision.tier === 'bot') {
      response = this.generateBotResponse(thoughtContext, characterContext);
    } else if (decision.tier === 'brain') {
      response = await this.generateBrainResponse(thoughtContext, characterContext, isHighStakes);
    } else {
      response = await this.generateHumanResponse(thoughtContext, characterContext, isHighStakes);
    }

    // Apply personality modifiers
    response = this.personality.applyToResponse(response);

    // Set tier and timing
    response.tier = decision.tier;
    response.confidence = decision.confidenceRequired;
    response.timeTakenMs = Date.now() - startTime;

    // Store interaction in working memory
    this.memory.storeWorking(
      `Responded to: ${situation.slice(0, 100)}`,
      3.0 + stakes * 3
    );

    this.state = 'idle' as CharacterState;
    return response;
  }

  /**
   * REMEMBER - Store a memory
   */
  remember(
    content: string,
    importance = 5.0,
    emotionalValence = 0.0,
    memoryType = MemoryTier.EPISODIC
  ): Memory {
    return this.memory.store(content, {
      memoryType,
      importance,
      emotionalValence,
    });
  }

  /**
   * RECALL - Retrieve relevant memories
   */
  recall(query: string, topK = 5): Memory[] {
    return this.memory.retrieve(query, { topK });
  }

  /**
   * FORGET - Remove a memory
   */
  forget(memoryId: string): boolean {
    return this.memory.forget(memoryId);
  }

  /**
   * LEARN - Learn from an outcome
   */
  learn(
    outcome: string,
    success?: boolean,
    reward = 0.0,
    notes = ''
  ): LearningSignal {
    // Store as memory
    const emotionalValence = success ? 0.5 : -0.5;
    this.remember(
      `Outcome: ${outcome}`,
      5.0 + Math.abs(reward),
      emotionalValence,
      MemoryTier.EPISODIC
    );

    // Track outcome for learning
    return this.outcomes.record(outcome, {
      success,
      reward,
      notes,
    });
  }

  /**
   * Get learning summary
   */
  getLearningSummary(): LearningSummary {
    return this.outcomes.getSummary();
  }

  /**
   * Personality: Set a trait
   */
  setTrait(trait: string, value: number): void {
    this.personality.setTrait(trait, value);
  }

  /**
   * Personality: Get a trait
   */
  getTrait(trait: string, defaultValue = 0.5): number {
    return this.personality.getTrait(trait, defaultValue);
  }

  /**
   * Personality: Modify a trait
   */
  modifyTrait(trait: string, delta: number): void {
    this.personality.modifyTrait(trait, delta);
  }

  /**
   * Personality: Get summary
   */
  getPersonalitySummary(): PersonalitySummary {
    return this.personality.getSummary();
  }

  /**
   * SAVE - Save character state
   */
  async save(path?: string): Promise<void> {
    const savePath = path ?? `${this.name}_character.json`;
    const data = {
      name: this.name,
      characterClass: this.characterClass,
      description: this.description,
      backstory: this.backstory,
      goals: this.goals,
      fears: this.fears,
      quirks: this.quirks,
      personality: this.personality.traits,
      state: this.state,
      createdAt: this.createdAt.toISOString(),
      interactionCount: this.interactionCount,
      outcomes: this.outcomes.toJSON(),
      memory: this.memory.toJSON(),
    };

    if (typeof savePath === 'string') {
      // In Node.js environment
      await import('node:fs/promises').then(fs =>
        fs.writeFile(savePath, JSON.stringify(data, null, 2))
      );
    }
  }

  /**
   * LOAD - Load character state
   */
  async load(path?: string): Promise<void> {
    const loadPath = path ?? `${this.name}_character.json`;

    if (typeof loadPath === 'string') {
      const data = await import('node:fs/promises')
        .then(fs => fs.readFile(loadPath, 'utf-8'))
        .then(JSON.parse);

      this.name = data.name;
      this.characterClass = data.characterClass;
      this.description = data.description;
      this.backstory = data.backstory;
      this.goals = data.goals ?? [];
      this.fears = data.fears ?? [];
      this.quirks = data.quirks ?? [];
      this.state = data.state;
      this.interactionCount = data.interactionCount ?? 0;

      // Restore personality
      for (const [trait, value] of Object.entries(data.personality ?? {})) {
        this.personality.setTrait(trait, value as number);
      }

      // Restore outcomes
      if (data.outcomes) {
        this.outcomes.fromJSON(data.outcomes);
      }

      // Restore memory
      if (data.memory) {
        this.memory.fromJSON(data.memory);
      }
    }
  }

  /**
   * Get character statistics
   */
  getStats(): CharacterStats {
    return {
      name: this.name,
      characterClass: this.characterClass,
      state: this.state,
      createdAt: this.createdAt.toISOString(),
      interactionCount: this.interactionCount,
      personality: { ...this.personality.traits },
      memory: this.memory.getStats(),
      learning: this.outcomes.getSummary(),
    };
  }

  /**
   * Initialize identity memories
   */
  private initializeIdentity(): void {
    if (this.backstory) {
      this.memory.storeSemantic(
        `I am ${this.name}. ${this.backstory}`,
        10.0
      );
    }

    for (const goal of this.goals) {
      this.memory.storeSemantic(
        `My goal: ${goal}`,
        8.0
      );
    }
  }

  /**
   * Build context string from memories
   */
  private buildContext(memories: Memory[]): string {
    const parts: string[] = [
      `I am ${this.name}, a ${this.characterClass}.`,
    ];

    if (this.description) {
      parts.push(this.description);
    }

    if (Object.keys(this.personality.traits).length > 0) {
      const traitsStr = Object.entries(this.personality.traits)
        .map(([k, v]) => `${k}:${v.toFixed(1)}`)
        .join(', ');
      parts.push(`My personality: ${traitsStr}`);
    }

    if (this.goals.length > 0) {
      parts.push(`My goals: ${this.goals.slice(0, 3).join(', ')}`);
    }

    if (memories.length > 0) {
      parts.push('\nRelevant memories:');
      for (const m of memories.slice(0, 3)) {
        parts.push(`  - ${m.content.slice(0, 80)}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Classify the type of situation
   */
  private classifySituation(situation: string): string {
    const lower = situation.toLowerCase();

    if (/\b(attack|fight|combat|enemy|threat|battle)\b/.test(lower)) {
      return 'combat';
    } else if (/\b(talk|speak|discuss|negotiate|converse)\b/.test(lower)) {
      return 'social';
    } else if (/\b(explore|search|look|find|discover)\b/.test(lower)) {
      return 'exploration';
    } else if (/\b(help|heal|support|protect|assist)\b/.test(lower)) {
      return 'support';
    } else if (/\b(learn|study|practice|understand|explain)\b/.test(lower)) {
      return 'learning';
    } else if (/\b(buy|sell|trade|shop|market)\b/.test(lower)) {
      return 'commerce';
    } else {
      return 'general';
    }
  }

  /**
   * Generate BOT-tier response (rule-based)
   */
  private generateBotResponse(
    context: ThoughtContext,
    characterContext: string
  ): CharacterResponse {
    const situationLower = context.situation.toLowerCase();
    let content: string;
    let action = 'wait';

    if (/\b(attack|fight|combat)\b/.test(situationLower)) {
      if (this.personality.getTrait('bravery', 0.5) > 0.7) {
        content = 'I stand ready to face this threat!';
        action = 'attack';
      } else {
        content = 'I assess the situation carefully before acting.';
        action = 'defend';
      }
    } else if (/\b(talk|speak|discuss)\b/.test(situationLower)) {
      content = 'I listen attentively and respond thoughtfully.';
      action = 'talk';
    } else if (/\b(help|assist)\b/.test(situationLower)) {
      content = 'I offer my assistance.';
      action = 'help';
    } else if (/\b(learn|study|understand)\b/.test(situationLower)) {
      content = 'I approach this with curiosity and focus.';
      action = 'learn';
    } else {
      content = `I consider ${context.situation.slice(0, 50)}...`;
      action = 'wait';
    }

    return {
      content,
      action,
      tier: 'bot' as DecisionTier,
      confidence: 0.8,
      timeTakenMs: 1,
      thoughts: 'Quick assessment based on rules',
      emotions: {},
      metadata: {},
    };
  }

  /**
   * Generate BRAIN-tier response (personality-driven)
   */
  private async generateBrainResponse(
    context: ThoughtContext,
    characterContext: string,
    highStakes: boolean
  ): Promise<CharacterResponse> {
    // If callback is provided, use it
    if (this.config.onThink) {
      try {
        const result = this.config.onThink(
          this,
          context.situation,
          characterContext,
          highStakes
        );

        if (typeof result === 'string') {
          return {
            content: result,
            action: 'talk',
            tier: 'brain' as DecisionTier,
            confidence: 0.7,
            timeTakenMs: 50,
            thoughts: 'Generated via callback',
            emotions: {},
            metadata: {},
          };
        } else {
          return {
            content: result.content,
            action: result.action ?? 'talk',
            tier: 'brain' as DecisionTier,
            confidence: result.confidence ?? 0.7,
            timeTakenMs: 50,
            thoughts: result.thoughts ?? '',
            emotions: {},
            metadata: {},
          };
        }
      } catch {
        // Fall through to default
      }
    }

    // Default personality-based response
    const dominant = this.personality.getDominantTrait(0.5) ?? ['neutral', 0.5];

    const responses: Record<string, string> = {
      bravery: 'I step forward confidently to address this.',
      kindness: 'I approach with compassion and care.',
      curiosity: 'I\'m intrigued! Let me learn more about this.',
      caution: 'I carefully consider the risks before proceeding.',
      aggression: 'I confront this challenge head-on.',
      diplomacy: 'I seek a peaceful resolution through dialogue.',
      persistence: 'I stay focused on finding a solution.',
      creativity: 'I look for an innovative approach to this.',
      humor: 'I approach this with a bit of humor to lighten the mood.',
    };

    const content =
      responses[dominant[0]] ??
      `I consider the situation and respond as ${this.name} would.`;

    return {
      content,
      action: 'talk',
      tier: 'brain' as DecisionTier,
      confidence: 0.7,
      timeTakenMs: 50,
      thoughts: `Based on my dominant trait: ${dominant[0]}`,
      emotions: {},
      metadata: {},
    };
  }

  /**
   * Generate HUMAN-tier response (high-stakes, LLM-backed)
   */
  private async generateHumanResponse(
    context: ThoughtContext,
    characterContext: string,
    highStakes: boolean
  ): Promise<CharacterResponse> {
    // If callback is provided, use it
    if (this.config.onThink) {
      try {
        const result = this.config.onThink(
          this,
          context.situation,
          characterContext,
          highStakes
        );

        if (typeof result === 'string') {
          return {
            content: result,
            action: 'talk',
            tier: 'human' as DecisionTier,
            confidence: 0.9,
            timeTakenMs: 500,
            thoughts: 'Generated via callback (high stakes)',
            emotions: {},
            metadata: {},
          };
        } else {
          return {
            content: result.content,
            action: result.action ?? 'talk',
            tier: 'human' as DecisionTier,
            confidence: result.confidence ?? 0.9,
            timeTakenMs: 500,
            thoughts: result.thoughts ?? '',
            emotions: {},
            metadata: {},
          };
        }
      } catch {
        // Fall through to default
      }
    }

    // Default high-stakes response
    return {
      content: `This is a critical moment. I, ${this.name}, must choose wisely.`,
      action: 'think',
      tier: 'human' as DecisionTier,
      confidence: 0.9,
      timeTakenMs: 500,
      thoughts: 'This requires careful consideration',
      emotions: { seriousness: 0.8 },
      metadata: {},
    };
  }

  /**
   * String representation
   */
  toString(): string {
    const traitStr = Object.entries(this.personality.traits)
      .slice(0, 3)
      .map(([k, v]) => `${k}:${v.toFixed(1)}`)
      .join(', ');
    return `Character(name="${this.name}", class="${this.characterClass}", traits={${traitStr}})`;
  }
}

/**
 * Factory function to create a character
 */
export function createCharacter(
  name: string,
  options?: Partial<Omit<CharacterConfig, 'name'>>
): Character {
  return new Character({ name, ...options });
}
