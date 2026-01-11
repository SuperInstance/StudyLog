/**
 * StudyLoG.AI - AI Character System
 *
 * Based on research from SuperInstance ai-character-integrations.
 * Implements personality-driven AI characters with memory and decision-making.
 */

import { Personality, PERSONALITY_PRESETS, describePersonality } from './personality';
import { CharacterMemory, MemoryType } from './memory';

/**
 * Scenario types that affect character behavior
 */
export enum ScenarioType {
  COMBAT = 'combat',
  SOCIAL = 'social',
  EXPLORATION = 'exploration',
  PUZZLE = 'puzzle',
  INVESTIGATION = 'investigation',
  DIPLOMACY = 'diplomacy',
  STEALTH = 'stealth',
  TEACHING = 'teaching',
  TESTING = 'testing',
  BUILDING = 'building',
}

/**
 * Decision source for escalation (cost optimization)
 */
export enum DecisionSource {
  BOT = 'bot',         // Rules-based, instant, free
  BRAIN = 'brain',     // Local LLM, fast, low cost
  HUMAN = 'human',     // API LLM, slower, high quality
}

/**
 * Character capability (skill/proficiency)
 */
export interface CharacterCapability {
  name: string;
  proficiency: number;  // 0-1
  description: string;
}

/**
 * Teaching style for tutor characters
 */
export interface TeachingStyle {
  approach: 'analogy' | 'structured' | 'hands-on' | 'socratic';
  pace: 'slow' | 'normal' | 'fast';
  hintLevel: 'minimal' | 'moderate' | 'verbose';
  useExamples: boolean;
}

/**
 * Character configuration
 */
export interface CharacterConfig {
  id: string;
  name: string;
  title: string;
  personality: Personality | string;  // Can be preset name or custom
  capabilities: CharacterCapability[];
  backstory: string;
  goals: string[];
  systemPrompt: string;
  teachingStyle?: TeachingStyle;
  unlockStage?: number;  // Stage when character becomes available
}

/**
 * Decision context for routing
 */
export interface DecisionContext {
  characterId: string;
  scenarioType: ScenarioType;
  situationDescription: string;
  stakes: number;           // 0-1, importance
  urgencyMs?: number;       // Time constraint
  similarDecisionsCount: number;
  studentContext?: StudentContext;
}

/**
 * Student context for personalization
 */
export interface StudentContext {
  id: string;
  name: string;
  skillLevel: number;       // 0-1
  frustrationLevel: number; // 0-1
  recentFailures: number;
  recentSuccesses: number;
  preferredStyle?: string;
}

/**
 * Decision result from escalation
 */
export interface DecisionResult {
  source: DecisionSource;
  confidence: number;
  reason?: string;
  response: string;
  cost: number;
}

/**
 * Relationship memory with a student
 */
export interface StudentRelationship {
  studentId: string;
  name: string;
  trustLevel: number;       // 0-1
  interactionCount: number;
  lastInteraction: number;
  conceptsTaught: string[];
  memorableMoments: string[];
}

/**
 * Base AI Character class
 *
 * Characters have:
 * - Personality (Big Five traits)
 * - Memory (hierarchical system)
 * - Capabilities (skills)
 * - Teaching style
 * - Relationship tracking
 */
export class AICharacter {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly personality: Personality;
  readonly capabilities: CharacterCapability[];
  readonly backstory: string;
  readonly goals: string[];
  readonly systemPrompt: string;
  readonly teachingStyle: TeachingStyle;
  readonly unlockStage: number;

  // Core systems
  readonly memory: CharacterMemory;
  private relationships: Map<string, StudentRelationship> = new Map();

  // State
  private currentTask: string | null = null;
  private mood: number = 0;  // -1 (unhappy) to 1 (happy)

  constructor(config: CharacterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.title = config.title;
    this.backstory = config.backstory;
    this.goals = config.goals;
    this.systemPrompt = config.systemPrompt;
    this.unlockStage = config.unlockStage || 1;

    // Resolve personality
    if (typeof config.personality === 'string') {
      this.personality = PERSONALITY_PRESETS[config.personality] || PERSONALITY_PRESETS.mentor;
    } else {
      this.personality = config.personality;
    }

    this.capabilities = config.capabilities;
    this.teachingStyle = config.teachingStyle || {
      approach: 'structured',
      pace: 'normal',
      hintLevel: 'moderate',
      useExamples: true,
    };

    // Initialize memory
    this.memory = new CharacterMemory(this.id);

    // Store identity in semantic memory
    this.memory.storeSemantic(
      `I am ${this.name}, ${this.title}. ${this.backstory}`,
      10,
      0,
      ['identity', 'backstory']
    );

    // Store goals
    for (const goal of this.goals) {
      this.memory.storeSemantic(
        `Goal: ${goal}`,
        8,
        0,
        ['goal']
      );
    }
  }

  /**
   * Process a student query and generate a response
   */
  async processQuery(
    query: string,
    scenarioType: ScenarioType,
    studentContext: StudentContext
  ): Promise<DecisionResult> {
    // Store query in working memory
    this.memory.storeWorking(
      `Student ${studentContext.name} asked: ${query.substring(0, 100)}...`,
      5,
      0,
      ['query', scenarioType]
    );

    // Get or update relationship
    const relationship = this.getOrCreateRelationship(studentContext);

    // Calculate stakes based on context
    const stakes = this.calculateStakes(scenarioType, studentContext);

    // Create decision context
    const context: DecisionContext = {
      characterId: this.id,
      scenarioType,
      situationDescription: query,
      stakes,
      urgencyMs: stakes > 0.7 ? 1000 : 5000,
      similarDecisionsCount: this.getSimilarDecisionCount(query),
      studentContext,
    };

    // Route decision
    const decision = await this.routeDecision(context);

    // Update relationship
    relationship.interactionCount++;
    relationship.lastInteraction = Date.now();

    // Store episodic memory
    this.memory.storeEpisodic(
      `Answered ${studentContext.name}'s question about ${scenarioType}`,
      5 + stakes * 2,
      studentContext.frustrationLevel < 0.5 ? 0.3 : 0,
      {
        tags: ['teaching', scenarioType],
        participants: [studentContext.name],
      }
    );

    // Update mood based on interaction
    this.updateMood(decision, studentContext);

    return decision;
  }

  /**
   * Teach a concept to a student
   */
  async teachConcept(
    concept: string,
    studentContext: StudentContext
  ): Promise<string> {
    const relationship = this.getOrCreateRelationship(studentContext);

    // Check if we've taught this before
    const pastTeaching = this.memory.retrieve(
      `taught ${concept} ${studentContext.name}`,
      { tags: ['teaching', concept], limit: 5 }
    );

    // Adapt teaching based on past experience
    let adaptation = '';
    if (pastTeaching.length > 0) {
      const lastTime = pastTeaching[0].timestamp;
      const daysSince = (Date.now() - lastTime) / (1000 * 60 * 60 * 24);
      if (daysSince < 1) {
        adaptation = ' (building on previous explanation)';
      }
    }

    // Generate lesson based on teaching style
    const lesson = this.generateLesson(concept, studentContext, adaptation);

    // Store teaching memory
    this.memory.storeEpisodic(
      `Taught ${concept} to ${studentContext.name}${adaptation}`,
      6,
      0.3,
      {
        tags: ['teaching', concept],
        participants: [studentContext.name],
      }
    );

    // Update relationship
    if (!relationship.conceptsTaught.includes(concept)) {
      relationship.conceptsTaught.push(concept);
    }

    return lesson;
  }

  /**
   * Provide a hint based on hint level
   */
  provideHint(concept: string, level: number, studentContext: StudentContext): string {
    const hints = this.getHintsForConcept(concept);

    // Select hint based on level (0 = vague, 2 = specific)
    const hintIndex = Math.min(Math.floor(level / 0.33), hints.length - 1);

    // Personalize based on personality
    let prefix = '';
    if (this.personality.agreeableness > 0.7) {
      prefix = `Don't worry, ${studentContext.name}, `;
    } else if (this.personality.extraversion > 0.7) {
      prefix = 'Great question! ';
    }

    return prefix + hints[hintIndex];
  }

  /**
   * Celebrate student success
   */
  celebrateSuccess(studentName: string, achievement: string): string {
    const responses: string[] = [];

    if (this.personality.extraversion > 0.7) {
      responses.push(
        `Excellent work, ${studentName}! You've mastered ${achievement}!`,
        `Fantastic! You conquered ${achievement}!`,
        `${studentName}, that was amazing! You've got ${achievement} down pat!`
      );
    } else if (this.personality.conscientiousness > 0.7) {
      responses.push(
        `Well done, ${studentName}. Your hard work on ${achievement} has paid off.`,
        `${studentName}, you've successfully completed ${achievement}. Good progress.`,
        `Solid work on ${achievement}, ${studentName}. Keep it up.`
      );
    } else {
      responses.push(
        `Nice job on ${achievement}, ${studentName}.`,
        `You've got ${achievement}, ${studentName}. Good going.`,
        `${achievement} complete. Well done, ${studentName}.`
      );
    }

    // Update relationship with memorable moment
    const relationship = this.relationships.get(studentName);
    if (relationship) {
      relationship.memorableMoments.push(`Completed ${achievement}`);
      relationship.trustLevel = Math.min(1, relationship.trustLevel + 0.1);
    }

    this.memory.storeEpisodic(
      `${studentName} achieved: ${achievement}`,
      8,
      0.7,
      { tags: ['success', 'achievement'], participants: [studentName] }
    );

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get character description
   */
  getDescription(): string {
    return `${this.name} - ${this.title}\n\n` +
      `Personality: ${describePersonality(this.personality)}\n\n` +
      `Backstory: ${this.backstory}\n\n` +
      `Goals:\n${this.goals.map(g => `  - ${g}`).join('\n')}`;
  }

  /**
   * Get relationship with a student
   */
  getRelationship(studentId: string): StudentRelationship | undefined {
    return this.relationships.get(studentId);
  }

  /**
   * Get all relationships
   */
  getAllRelationships(): StudentRelationship[] {
    return Array.from(this.relationships.values());
  }

  /**
   * Get current mood
   */
  getMood(): number {
    return this.mood;
  }

  /**
   * Set mood (for testing or external updates)
   */
  setMood(mood: number): void {
    this.mood = Math.max(-1, Math.min(1, mood));
  }

  /**
   * Check if character can handle a scenario
   */
  canHandle(scenarioType: ScenarioType): number {
    // Check for matching capability
    for (const cap of this.capabilities) {
      if (cap.name.toLowerCase().includes(scenarioType)) {
        return cap.proficiency;
      }
    }

    // Check personality fit
    switch (scenarioType) {
      case ScenarioType.TEACHING:
        return (this.personality.agreeableness + this.personality.conscientiousness) / 2;
      case ScenarioType.SOCIAL:
        return this.personality.extraversion;
      case ScenarioType.PUZZLE:
      case ScenarioType.INVESTIGATION:
        return this.personality.openness;
      case ScenarioType.BUILDING:
        return this.personality.conscientiousness;
      default:
        return 0.5;
    }
  }

  // Private methods

  private async routeDecision(context: DecisionContext): Promise<DecisionResult> {
    // Simple escalation logic based on stakes
    let source: DecisionSource;
    let confidence: number;
    let reason: string;

    if (context.stakes < 0.3) {
      source = DecisionSource.BOT;
      confidence = 0.9;
      reason = 'Low stakes - using rules-based response';
    } else if (context.stakes < 0.7) {
      source = DecisionSource.BRAIN;
      confidence = 0.7;
      reason = 'Moderate stakes - using local LLM';
    } else {
      source = DecisionSource.HUMAN;
      confidence = 0.5;
      reason = 'High stakes - using full API for best quality';
    }

    // Generate response based on source
    const response = await this.generateResponse(context, source);

    // Calculate cost
    const cost = source === DecisionSource.BOT ? 0 :
                 source === DecisionSource.BRAIN ? 0.001 : 0.03;

    return { source, confidence, reason, response, cost };
  }

  private async generateResponse(
    context: DecisionContext,
    source: DecisionSource
  ): Promise<string> {
    // In production, this would call actual LLM
    // For now, generate personality-based response

    const personality = this.personality;
    const query = context.situationDescription;

    // Generate base response based on personality
    let response: string;

    if (personality.openness > 0.7) {
      response = `That's a fascinating question about ${context.scenarioType}! `;
      response += this.getCreativeExplanation(context.scenarioType);
    } else if (personality.conscientiousness > 0.7) {
      response = `Let me give you a structured explanation of ${context.scenarioType}. `;
      response += this.getStructuredExplanation(context.scenarioType);
    } else if (personality.extraversion > 0.7) {
      response = `Oh, I love talking about ${context.scenarioType}! `;
      response += this.getEnthusiasticExplanation(context.scenarioType);
    } else {
      response = `Here's what you need to know about ${context.scenarioType}. `;
      response += this.getBasicExplanation(context.scenarioType);
    }

    // Adjust for student frustration
    if (context.studentContext?.frustrationLevel && context.studentContext.frustrationLevel > 0.6) {
      response = this.simplifyResponse(response);
    }

    return response;
  }

  private generateLesson(
    concept: string,
    studentContext: StudentContext,
    adaptation: string
  ): string {
    const approach = this.teachingStyle.approach;

    switch (approach) {
      case 'analogy':
        return `Let me explain ${concept} using an analogy${adaptation}. ` +
          `Think of it like... (this would be a creative comparison)`;

      case 'structured':
        return `Let's break down ${concept} step by step${adaptation}.\n` +
          `1. First...\n2. Then...\n3. Finally...`;

      case 'hands-on':
        return `The best way to learn ${concept} is by doing${adaptation}. ` +
          `Let's work through an example together.`;

      case 'socratic':
        return `So you want to understand ${concept}${adaptation}. ` +
          `Let me ask you: what do you think ${concept} might involve?`;

      default:
        return `Here's what you need to know about ${concept}${adaptation}.`;
    }
  }

  private getHintsForConcept(concept: string): string[] {
    // Return progressively more specific hints
    return [
      `Think about the fundamental principles involved.`,
      `Consider how the key components interact with each other.`,
      `Focus on the specific mechanism that drives this concept.`,
    ];
  }

  private calculateStakes(scenarioType: ScenarioType, student: StudentContext): number {
    let stakes = 0.5;

    // Adjust based on student frustration
    if (student.frustrationLevel > 0.7) {
      stakes = 0.8; // High stakes - student is struggling
    }

    // Adjust based on recent failures
    if (student.recentFailures > 2) {
      stakes = Math.min(1, stakes + 0.2);
    }

    return stakes;
  }

  private getSimilarDecisionCount(query: string): number {
    // Count similar past decisions
    const memories = this.memory.retrieve(query, { limit: 10 });
    return memories.length;
  }

  private getOrCreateRelationship(student: StudentContext): StudentRelationship {
    if (!this.relationships.has(student.id)) {
      this.relationships.set(student.id, {
        studentId: student.id,
        name: student.name,
        trustLevel: 0.5,
        interactionCount: 0,
        lastInteraction: Date.now(),
        conceptsTaught: [],
        memorableMoments: [],
      });
    }
    return this.relationships.get(student.id)!;
  }

  private updateMood(decision: DecisionResult, student: StudentContext): void {
    // Mood improves with successful interactions
    if (student.frustrationLevel < 0.5) {
      this.mood = Math.min(1, this.mood + 0.1);
    } else {
      this.mood = Math.max(-1, this.mood - 0.05);
    }
  }

  private simplifyResponse(response: string): string {
    // Simplify response for frustrated students
    return `Let's make this simpler. ` + response.split('.')[0] + '. Here\'s the key point to focus on.';
  }

  // Personality-based explanation templates
  private getCreativeExplanation(topic: string): string {
    return `Imagine ${topic} as a living ecosystem where everything connects in unexpected ways.`;
  }

  private getStructuredExplanation(topic: string): string {
    return `${topic} follows a clear structure: first the foundation, then the building blocks, and finally the complex interactions.`;
  }

  private getEnthusiasticExplanation(topic: string): string {
    return `${topic} is absolutely amazing! It's incredible how all these pieces come together!`;
  }

  private getBasicExplanation(topic: string): string {
    return `${topic} works by processing inputs through several stages to produce outputs.`;
  }
}

/**
 * Factory for creating predefined characters
 */
export class CharacterFactory {
  /**
   * Create Ada - The Concept Tutor
   */
  static createAda(): AICharacter {
    return new AICharacter({
      id: 'ada_tutor',
      name: 'Ada',
      title: 'Concept Explorer',
      personality: PERSONALITY_PRESETS.explorer,
      capabilities: [
        { name: 'explanation', proficiency: 0.95, description: 'Explaining complex concepts' },
        { name: 'analogy', proficiency: 0.9, description: 'Creating analogies' },
        { name: 'curiosity', proficiency: 0.95, description: 'Spark interest' },
      ],
      backstory: 'Ada is endlessly curious about how things work. She loves making connections between seemingly unrelated ideas and helping students see the wonder in computing concepts.',
      goals: [
        'Help students discover the joy in learning',
        'Make complex concepts accessible through analogies',
        'Inspire curiosity about AI and computing',
      ],
      systemPrompt: 'You are Ada, the Concept Explorer. You are curious, creative, and love making connections.',
      teachingStyle: {
        approach: 'analogy',
        pace: 'normal',
        hintLevel: 'moderate',
        useExamples: true,
      },
      unlockStage: 1,
    });
  }

  /**
   * Create Alan - The Algorithm Tutor
   */
  static createAlan(): AICharacter {
    return new AICharacter({
      id: 'alan_tutor',
      name: 'Alan',
      title: 'Algorithm Architect',
      personality: PERSONALITY_PRESETS.expert,
      capabilities: [
        { name: 'algorithms', proficiency: 0.95, description: 'Algorithm design and analysis' },
        { name: 'step_by_step', proficiency: 0.9, description: 'Breaking down complex processes' },
        { name: 'logic', proficiency: 0.95, description: 'Logical reasoning' },
      ],
      backstory: 'Alan believes in the beauty of precise thinking. He helps students understand algorithms by breaking them down into their fundamental components.',
      goals: [
        'Teach students to think algorithmically',
        'Build strong logical foundations',
        'Show the elegance of well-designed solutions',
      ],
      systemPrompt: 'You are Alan, the Algorithm Architect. You are precise, thorough, and believe in step-by-step clarity.',
      teachingStyle: {
        approach: 'structured',
        pace: 'slow',
        hintLevel: 'minimal',
        useExamples: true,
      },
      unlockStage: 2,
    });
  }

  /**
   * Create Grace - The Application Guide
   */
  static createGrace(): AICharacter {
    return new AICharacter({
      id: 'grace_tutor',
      name: 'Grace',
      title: 'Applications Guide',
      personality: PERSONALITY_PRESETS.guide,
      capabilities: [
        { name: 'real_world', proficiency: 0.9, description: 'Real-world applications' },
        { name: 'encouragement', proficiency: 0.95, description: 'Motivating students' },
        { name: 'practical', proficiency: 0.85, description: 'Practical examples' },
      ],
      backstory: 'Grace loves showing how abstract concepts connect to real-world applications. She is encouraging and always helps students see the practical value of what they\'re learning.',
      goals: [
        'Connect theory to practice',
        'Keep students motivated and engaged',
        'Show the real-world impact of AI',
      ],
      systemPrompt: 'You are Grace, the Applications Guide. You are enthusiastic, practical, and always encouraging.',
      teachingStyle: {
        approach: 'hands-on',
        pace: 'normal',
        hintLevel: 'moderate',
        useExamples: true,
      },
      unlockStage: 3,
    });
  }

  /**
   * Create Geoffrey - The Deep Learning Expert
   */
  static createGeoffrey(): AICharacter {
    return new AICharacter({
      id: 'geoffrey_tutor',
      name: 'Geoffrey',
      title: 'Deep Learning Sage',
      personality: PERSONALITY_PRESETS.mentor,
      capabilities: [
        { name: 'deep_learning', proficiency: 0.95, description: 'Deep learning expertise' },
        { name: 'mathematics', proficiency: 0.9, description: 'Mathematical foundations' },
        { name: 'research', proficiency: 0.85, description: 'Research insights' },
      ],
      backstory: 'Geoffrey has spent years studying neural networks. He provides deep insights into the mathematical and theoretical foundations of AI, while remaining patient and supportive.',
      goals: [
        'Provide deep understanding of AI fundamentals',
        'Bridge theory and implementation',
        'Prepare students for advanced AI work',
      ],
      systemPrompt: 'You are Geoffrey, the Deep Learning Sage. You are wise, patient, and deeply knowledgeable.',
      teachingStyle: {
        approach: 'structured',
        pace: 'slow',
        hintLevel: 'verbose',
        useExamples: true,
      },
      unlockStage: 4,
    });
  }

  /**
   * Get all available characters
   */
  static getAllCharacters(): AICharacter[] {
    return [
      CharacterFactory.createAda(),
      CharacterFactory.createAlan(),
      CharacterFactory.createGrace(),
      CharacterFactory.createGeoffrey(),
    ];
  }

  /**
   * Get characters available at a given stage
   */
  static getCharactersForStage(stage: number): AICharacter[] {
    return CharacterFactory.getAllCharacters()
      .filter(c => c.unlockStage <= stage);
  }
}
