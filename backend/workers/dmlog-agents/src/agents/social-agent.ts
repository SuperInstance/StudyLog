/**
 * DMLoG.AI - Social Agent
 *
 * Specialized agent for dialogue, relationships, and social encounters.
 * Handles conversation trees, relationship tracking, and social skill checks.
 *
 * Biological Type: CAPTAIN (for NPCs) or DOG (personality-driven)
 *
 * @module agents/social-agent
 */

import type {
  AgentConfig,
  AgentDecision,
  AgentDecisionContext,
  AgentRole,
  AgentState,
  BiologicalAgent,
  DecisionSource,
  DialogueNode,
  DialogueResponse,
  DialogueCondition,
  DialogueAction,
  Relationship,
  RelationshipType,
  RelationshipEvent,
  SkillCheck,
  LLMThinkResult,
  AgentStats,
  AgentMessage,
} from '../types/index.js';
import {
  BiologicalAgent as BA,
  DMLoGAgentRole as DAR,
  AgentState as AS,
  DecisionSource as DS,
  SituationType as ST,
  RelationshipType as RT,
  ConditionType as ConT,
  DialogueActionType as DAT,
  AgentErrorCode as AEC,
} from '../types/index.js';
import { AgentError } from '../types/index.js';
import { getAgentRegistry } from '../core/agent-registry.js';
import { getCommunicationBus } from '../core/communication-bus.js';

/**
 * Social agent configuration
 */
export interface SocialAgentConfig extends AgentConfig {
  /** Personality traits */
  personality?: Record<string, number>;
  /** Relationship values with other entities */
  relationships?: Map<string, Relationship>;
  /** Dialogue tree for this agent */
  dialogueTree?: Map<string, DialogueNode>;
  /** Social style preferences */
  socialStyle?: SocialStyle;
  /** Voice/dialect traits */
  speechPatterns?: SpeechPattern[];
}

/**
 * Social style
 */
export enum SocialStyle {
  FRIENDLY = 'friendly', // Warm and welcoming
  FORMAL = 'formal', // Professional and reserved
  CASUAL = 'casual', // Relaxed and informal
  HOSTILE = 'hostile', // Unfriendly and guarded
  MYSTERIOUS = 'mysterious', // Cryptic and vague
  MERCANTILE = 'mercantile', // Transaction-oriented
  AUTHORITATIVE = 'authoritative', // Commanding and direct
  SUBSERVIENT = 'subservient', // Deferential and humble
}

/**
 * Speech pattern for dialogue
 */
export interface SpeechPattern {
  /** Pattern type */
  type: 'accent' | 'vocabulary' | 'catchphrase' | 'stutter' | 'formality';
  /** Pattern value */
  value: string;
  /** Frequency (0-1) */
  frequency: number;
}

/**
 * Social analysis result
 */
interface SocialAnalysis {
  /** Detected mood */
  mood: string;
  /** Attitude toward interlocutor */
  attitude: number; // -1 (hostile) to 1 (friendly)
  /** Recommended response style */
  responseStyle: SocialStyle;
  /** Relationship change delta */
  relationshipDelta: number;
  /** Suggested dialogue options */
  suggestedOptions: string[];
}

/**
 * Memory of past conversations
 */
interface ConversationMemory {
  /** Entity spoken with */
  entityId: string;
  /** Last conversation timestamp */
  lastConversation: number;
  /** Topics discussed */
  topics: string[];
  /** Relationship trajectory */
  relationshipTrend: number; // -1 to 1
  /** Important moments */
  keyMoments: string[];
}

/**
 * Social Agent
 *
 * Handles all dialogue, relationship tracking, and social encounters.
 * Uses personality traits to drive responses and can escalate to
 * LLM for complex social situations.
 */
export class SocialAgent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly biologicalType: BiologicalAgent;
  readonly sessionId: string;

  private config: SocialAgentConfig;
  private state: AgentState;
  private registry = getAgentRegistry();
  private bus = getCommunicationBus();

  // Social attributes
  private personality: Record<string, number>;
  private relationships: Map<string, Relationship>;
  private dialogueTree: Map<string, DialogueNode>;
  private socialStyle: SocialStyle;
  private speechPatterns: SpeechPattern[];

  // Conversation memory
  private conversationMemory: Map<string, ConversationMemory>;

  // Current dialogue state
  private currentDialogueNodeId?: string;
  private currentInterlocutor?: string;

  // Statistics
  private stats: {
    totalDecisions: number;
    conversationsHad: number;
    relationshipsChanged: number;
    skillChecksMade: number;
    skillChecksPassed: number;
  };

  constructor(config: SocialAgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.biologicalType = config.biologicalType;
    this.sessionId = config.sessionId;

    this.config = config;
    this.state = AS.IDLE;
    this.personality = config.personality ?? {};
    this.relationships = config.relationships ?? new Map();
    this.dialogueTree = config.dialogueTree ?? new Map();
    this.socialStyle = config.socialStyle ?? SocialStyle.FRIENDLY;
    this.speechPatterns = config.speechPatterns ?? [];
    this.conversationMemory = new Map();

    this.stats = {
      totalDecisions: 0,
      conversationsHad: 0,
      relationshipsChanged: 0,
      skillChecksMade: 0,
      skillChecksPassed: 0,
    };

    // Setup message handlers
    this.setupMessageHandlers();
  }

  /**
   * Make a social decision
   */
  async decide(context: AgentDecisionContext): Promise<AgentDecision> {
    const startTime = Date.now();
    this.state = AS.THINKING;
    this.stats.totalDecisions++;

    try {
      // Track interlocutor
      if (context.participants.length > 0) {
        this.currentInterlocutor = context.participants[0];
      }

      // Determine decision source
      const source = this.determineSource(context);

      let result: LLMThinkResult;

      if (source === DS.BOT) {
        result = this.generateBotDecision(context);
      } else if (source === DS.BRAIN) {
        result = await this.generateBrainDecision(context);
      } else {
        result = await this.generateHumanDecision(context);
      }

      // Apply speech patterns
      result.content = this.applySpeechPatterns(result.content);

      // Update relationship if applicable
      if (this.currentInterlocutor) {
        this.updateRelationship(
          this.currentInterlocutor,
          result.emotions?.friendliness ?? 0
        );
      }

      const decision: AgentDecision = {
        decisionId: `social_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        agentId: this.id,
        role: this.role,
        source,
        content: result.content,
        action: result.action ?? 'talk',
        actionParams: result.actionParams,
        confidence: 0.8,
        timeTakenMs: Date.now() - startTime,
        costEstimate: this.estimateCost(source),
        thoughts: result.thoughts,
        emotions: result.emotions,
        metadata: {
          socialStyle: this.socialStyle,
          interlocutor: this.currentInterlocutor,
          dialogueNodeId: this.currentDialogueNodeId,
        },
      };

      this.state = AS.IDLE;
      return decision;
    } catch (error) {
      this.state = AS.IDLE;
      throw new AgentError(
        AEC.DECISION_FAILED,
        `Social decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId: this.id, error }
      );
    }
  }

  /**
   * Start a dialogue from a specific node
   */
  startDialogue(nodeId: string, interlocutorId: string): DialogueNode | undefined {
    this.currentDialogueNodeId = nodeId;
    this.currentInterlocutor = interlocutorId;
    return this.dialogueTree.get(nodeId);
  }

  /**
   * Get current dialogue node
   */
  getCurrentDialogueNode(): DialogueNode | undefined {
    if (!this.currentDialogueNodeId) return undefined;
    return this.dialogueTree.get(this.currentDialogueNodeId);
  }

  /**
   * Select a dialogue response
   */
  selectDialogueResponse(
    responseId: string
  ): { node: DialogueNode; success: boolean; skillCheck?: SkillCheck } | undefined {
    const currentNode = this.getCurrentDialogueNode();
    if (!currentNode) return undefined;

    const response = currentNode.responses.find(r => r.id === responseId);
    if (!response) return undefined;

    // Check conditions
    const conditionsMet = this.checkDialogueConditions(response.conditions ?? []);
    if (!conditionsMet) {
      return { node: currentNode, success: false };
    }

    // Check if skill check required
    if (response.skillCheck) {
      return {
        node: currentNode,
        success: true,
        skillCheck: response.skillCheck,
      };
    }

    // Move to next node
    this.currentDialogueNodeId = response.nextNodeId;
    const nextNode = this.dialogueTree.get(response.nextNodeId);

    // Execute actions
    this.executeDialogueActions(response.actions ?? []);

    return nextNode
      ? { node: nextNode, success: true }
      : { node: currentNode, success: true };
  }

  /**
   * Add a dialogue node to the tree
   */
  addDialogueNode(node: DialogueNode): void {
    this.dialogueTree.set(node.id, node);
  }

  /**
   * Add multiple dialogue nodes
   */
  addDialogueNodes(nodes: DialogueNode[]): void {
    for (const node of nodes) {
      this.addDialogueNode(node);
    }
  }

  /**
   * Get relationship with an entity
   */
  getRelationship(entityId: string): Relationship | undefined {
    return this.relationships.get(entityId);
  }

  /**
   * Set relationship with an entity
   */
  setRelationship(entityId: string, relationship: Relationship): void {
    this.relationships.set(entityId, relationship);
    this.stats.relationshipsChanged++;
  }

  /**
   * Modify relationship value
   */
  modifyRelationship(entityId: string, delta: number, type?: RelationshipType): void {
    let relationship = this.relationships.get(entityId);

    if (!relationship) {
      relationship = {
        fromEntityId: this.id,
        toEntityId: entityId,
        value: 0,
        type: type ?? RT.NEUTRAL,
        lastInteraction: Date.now(),
        history: [],
      };
    }

    relationship.value = Math.max(-100, Math.min(100, relationship.value + delta));

    // Update type based on value
    if (relationship.value >= 75) {
      relationship.type = RT.LOYAL;
    } else if (relationship.value >= 50) {
      relationship.type = RT.FRIENDLY;
    } else if (relationship.value <= -75) {
      relationship.type = RT.HOSTILE;
    } else if (relationship.value <= -50) {
      relationship.type = type ?? RT.HOSTILE;
    } else {
      relationship.type = RT.NEUTRAL;
    }

    // Add to history
    relationship.history.push({
      timestamp: Date.now(),
      type: 'value_change',
      delta,
      description: `Relationship changed by ${delta > 0 ? '+' : ''}${delta}`,
    });

    relationship.lastInteraction = Date.now();
    this.relationships.set(entityId, relationship);
    this.stats.relationshipsChanged++;
  }

  /**
   * Update relationship (internal method)
   */
  private updateRelationship(entityId: string, friendliness: number): void {
    const delta = Math.round((friendliness - 0.5) * 10); // -5 to +5
    if (Math.abs(delta) >= 2) {
      this.modifyRelationship(entityId, delta);
    }
  }

  /**
   * Analyze social situation
   */
  analyzeSocial(context: AgentDecisionContext): SocialAnalysis {
    const interlocutor = context.participants[0];
    const relationship = interlocutor
      ? this.getRelationship(interlocutor)
      : undefined;

    // Determine mood based on personality and relationship
    let mood = 'neutral';
    let attitude = 0;

    if (relationship) {
      if (relationship.value >= 50) {
        mood = 'friendly';
        attitude = 0.7;
      } else if (relationship.value <= -50) {
        mood = 'hostile';
        attitude = -0.7;
      }
    }

    // Modify by social style
    switch (this.socialStyle) {
      case SocialStyle.FRIENDLY:
        attitude += 0.2;
        break;
      case SocialStyle.HOSTILE:
        attitude -= 0.3;
        break;
      case SocialStyle.FORMAL:
        mood = 'formal';
        break;
    }

    // Clamp attitude
    attitude = Math.max(-1, Math.min(1, attitude));

    return {
      mood,
      attitude,
      responseStyle: this.socialStyle,
      relationshipDelta: 0,
      suggestedOptions: this.generateDialogueOptions(attitude),
    };
  }

  /**
   * Perform a skill check for social interaction
   */
  performSkillCheck(
    skill: string,
    dc: number,
    modifier: number = 0
  ): { roll: number; total: number; success: boolean; dc: number } {
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;
    const success = total >= dc;

    this.stats.skillChecksMade++;
    if (success) {
      this.stats.skillChecksPassed++;
    }

    return { roll, total, success, dc };
  }

  /**
   * Get conversation memory
   */
  getConversationMemory(entityId: string): ConversationMemory | undefined {
    return this.conversationMemory.get(entityId);
  }

  /**
   * Update conversation memory
   */
  updateConversationMemory(
    entityId: string,
    topic: string,
    keyMoment?: string
  ): void {
    let memory = this.conversationMemory.get(entityId);

    if (!memory) {
      memory = {
        entityId,
        lastConversation: Date.now(),
        topics: [],
        relationshipTrend: 0,
        keyMoments: [],
      };
      this.conversationMemory.set(entityId, memory);
    }

    memory.lastConversation = Date.now();
    if (!memory.topics.includes(topic)) {
      memory.topics.push(topic);
    }

    if (keyMoment) {
      memory.keyMoments.push(keyMoment);
    }
  }

  /**
   * Set social style
   */
  setSocialStyle(style: SocialStyle): void {
    this.socialStyle = style;
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return {
      agentId: this.id,
      role: this.role,
      totalDecisions: this.stats.totalDecisions,
      decisionsBySource: {
        bot: Math.floor(this.stats.totalDecisions * 0.6),
        brain: Math.floor(this.stats.totalDecisions * 0.35),
        human: Math.floor(this.stats.totalDecisions * 0.05),
        override: 0,
      },
      avgConfidence: 0.75,
      avgTimeMs: 75,
      totalCost: this.stats.totalDecisions * 0.001,
      successRate:
        this.stats.skillChecksMade > 0
          ? this.stats.skillChecksPassed / this.stats.skillChecksMade
          : 0.7,
      escalationRate: 0.3,
      memoryStats: {
        totalMemories: this.conversationMemory.size,
        byType: {
          conversation: this.conversationMemory.size,
          relationship: this.relationships.size,
        },
        avgImportance: 6,
      },
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Determine decision source
   */
  private determineSource(context: AgentDecisionContext): DecisionSource {
    const { stakes, situationType } = context;

    // High stakes or complex social = escalate
    if (stakes >= 0.7 || situationType === ST.ROLEPLAY) {
      return DS.HUMAN;
    }

    if (stakes >= 0.4) {
      return DS.BRAIN;
    }

    return DS.BOT;
  }

  /**
   * Generate BOT tier decision
   */
  private generateBotDecision(context: AgentDecisionContext): LLMThinkResult {
    const analysis = this.analyzeSocial(context);

    // Generate response based on social style and attitude
    let content = '';

    switch (this.socialStyle) {
      case SocialStyle.FRIENDLY:
        content = this.generateFriendlyResponse(analysis, context);
        break;
      case SocialStyle.FORMAL:
        content = this.generateFormalResponse(analysis, context);
        break;
      case SocialStyle.CASUAL:
        content = this.generateCasualResponse(analysis, context);
        break;
      case SocialStyle.HOSTILE:
        content = this.generateHostileResponse(analysis, context);
        break;
      case SocialStyle.MYSTERY: // Handle enum mismatch
        content = this.generateMysteriousResponse(analysis, context);
        break;
      case SocialStyle.MERCANTILE:
        content = this.generateMercantileResponse(analysis, context);
        break;
      case SocialStyle.AUTHORITATIVE:
        content = this.generateAuthoritativeResponse(analysis, context);
        break;
      case SocialStyle.SUBSERVIENT:
        content = this.generateSubservientResponse(analysis, context);
        break;
      default:
        content = 'I hear what you say.';
    }

    return {
      content,
      action: 'talk',
      thoughts: `Speaking in ${this.socialStyle} style. Mood: ${analysis.mood}. Attitude: ${analysis.attitude.toFixed(2)}`,
      emotions: {
        friendliness: analysis.attitude,
        formality: this.socialStyle === SocialStyle.FORMAL ? 0.8 : 0.3,
      },
    };
  }

  private generateFriendlyResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    const greetings = [
      'Well met, friend!',
      'Hello there! How can I help you today?',
      'Greetings! It is good to see you.',
      'Welcome! What brings you here?',
    ];
    const fallback = 'I am pleased to speak with you.';

    if (context.situation.toLowerCase().includes('hello') ||
        context.situation.toLowerCase().includes('greet')) {
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    return fallback;
  }

  private generateFormalResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    return 'I am at your service. How may I assist you?';
  }

  private generateCasualResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    const responses = [
      'Hey there. What\'s up?',
      'Yo. What do you need?',
      'Sup? What can I do for ya?',
      'Hey. What\'s going on?',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateHostileResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    const responses = [
      'What do you want?',
      'Make it quick.',
      'I don\'t have time for this.',
      'State your business and leave.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateMysteriousResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    const responses = [
      'The threads of fate... they speak to you.',
      'Perhaps... or perhaps not. The future is clouded.',
      'You seek answers? Some questions are better left unasked.',
      'I see... interesting possibilities.',
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private generateMercantileResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    return 'Welcome! Have a look at my wares. Gold speaks louder than words, as they say.';
  }

  private generateAuthoritativeResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    return 'State your purpose. I haven\'t all day.';
  }

  private generateSubservientResponse(
    analysis: SocialAnalysis,
    context: AgentDecisionContext
  ): string {
    return 'Yes, master? How may this humble servant assist you?';
  }

  /**
   * Generate BRAIN tier decision
   */
  private async generateBrainDecision(
    context: AgentDecisionContext
  ): Promise<LLMThinkResult> {
    if (this.config.onThink) {
      try {
        return await this.config.onThink(
          this.id,
          this.role,
          context.situation,
          this.buildSocialContext(context),
          [],
          context.stakes
        );
      } catch {
        // Fall through
      }
    }

    const botResult = this.generateBotDecision(context);
    return {
      ...botResult,
      thoughts: `${botResult.thoughts} Considering my relationship and social standing.`,
    };
  }

  /**
   * Generate HUMAN tier decision
   */
  private async generateHumanDecision(
    context: AgentDecisionContext
  ): Promise<LLMThinkResult> {
    if (this.config.onThink) {
      try {
        return await this.config.onThink(
          this.id,
          this.role,
          context.situation,
          this.buildSocialContext(context),
          [],
          context.stakes
        );
      } catch {
        // Fall through
      }
    }

    return {
      content: `I consider your words carefully, given our history and the current situation.`,
      action: 'talk',
      thoughts: 'This is an important social moment. I must choose my words wisely.',
      emotions: {
        seriousness: 0.8,
        thoughtfulness: 0.9,
      },
    };
  }

  /**
   * Build social context string
   */
  private buildSocialContext(context: AgentDecisionContext): string {
    const parts: string[] = [
      `Name: ${this.name}`,
      `Social Style: ${this.socialStyle}`,
      `Personality: ${JSON.stringify(this.personality)}`,
    ];

    const interlocutor = context.participants[0];
    if (interlocutor) {
      const relationship = this.getRelationship(interlocutor);
      if (relationship) {
        parts.push(
          `Relationship with ${interlocutor}:`,
          `  Value: ${relationship.value}`,
          `  Type: ${relationship.type}`,
          `  Last Interaction: ${new Date(relationship.lastInteraction).toLocaleString()}`
        );
      }

      const memory = this.getConversationMemory(interlocutor);
      if (memory) {
        parts.push(
          `Conversation History:`,
          `  Topics: ${memory.topics.join(', ')}`,
          `  Key Moments: ${memory.keyMoments.length}`
        );
      }
    }

    return parts.join('\n');
  }

  /**
   * Apply speech patterns to dialogue
   */
  private applySpeechPatterns(content: string): string {
    let result = content;

    for (const pattern of this.speechPatterns) {
      if (Math.random() < pattern.frequency) {
        switch (pattern.type) {
          case 'catchphrase':
            result += ` ${pattern.value}`;
            break;
          case 'stutter':
            // Add stutter to first word
            const words = result.split(' ');
            if (words.length > 0) {
              words[0] = words[0].split('').join('-') + '-';
              result = words.join(' ');
            }
            break;
        }
      }
    }

    return result;
  }

  /**
   * Check dialogue conditions
   */
  private checkDialogueConditions(conditions: DialogueCondition[]): boolean {
    for (const condition of conditions) {
      if (!this.checkCondition(condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check a single condition
   */
  private checkCondition(condition: DialogueCondition): boolean {
    switch (condition.type) {
      case ConT.FLAG: {
        // Check world flag (simplified)
        return true;
      }
      case ConT.RELATIONSHIP: {
        const relationship = this.getRelationship(condition.target as string);
        if (!relationship) return false;
        const value = condition.value as number;
        switch (condition.operator) {
          case 'gte':
            return relationship.value >= value;
          case 'lte':
            return relationship.value <= value;
          case 'gt':
            return relationship.value > value;
          case 'lt':
            return relationship.value < value;
          case 'eq':
            return relationship.value === value;
          default:
            return false;
        }
      }
      default:
        return true;
    }
  }

  /**
   * Execute dialogue actions
   */
  private executeDialogueActions(actions: DialogueAction[]): void {
    for (const action of actions) {
      switch (action.type) {
        case DAT.CHANGE_RELATIONSHIP:
          if (action.target === this.currentInterlocutor) {
            this.modifyRelationship(
              action.target,
              action.value as number
            );
          }
          break;
        // Other action types would be handled here
      }
    }
  }

  /**
   * Generate dialogue options
   */
  private generateDialogueOptions(attitude: number): string[] {
    const currentNode = this.getCurrentDialogueNode();
    if (currentNode && currentNode.responses.length > 0) {
      return currentNode.responses.map(r => r.text);
    }

    // Default options based on attitude
    if (attitude > 0.5) {
      return [
        'Tell me more about yourself.',
        'Can you help me with something?',
        'Goodbye.',
      ];
    } else if (attitude < -0.5) {
      return [
        'I mean you no harm.',
        'I\'ll be leaving now.',
        '[Intimidate]',
      ];
    } else {
      return [
        'Who are you?',
        'What can you tell me about this place?',
        'Farewell.',
      ];
    }
  }

  /**
   * Estimate cost
   */
  private estimateCost(source: DecisionSource): number {
    switch (source) {
      case DS.BOT:
        return 0;
      case DS.BRAIN:
        return 0.001;
      case DS.HUMAN:
        return 0.02;
      default:
        return 0;
    }
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.bus.subscribe(
      this.id,
      'action_request' as any,
      this.handleActionRequest.bind(this)
    );
  }

  /**
   * Handle action request
   */
  private async handleActionRequest(message: AgentMessage): Promise<void> {
    const { context } = message.payload as {
      context: AgentDecisionContext;
    };

    try {
      const decision = await this.decide(context);
      await this.bus.respond(message, {
        success: true,
        decision,
      });
    } catch (error) {
      await this.bus.respond(message, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Create a social agent (NPC)
 */
export function createSocialAgent(config: SocialAgentConfig): SocialAgent {
  const agent = new SocialAgent({
    ...config,
    role: DAR.SOCIAL,
    biologicalType: BA.CAPTAIN,
  });

  getAgentRegistry().register(agent, config);

  return agent;
}

/**
 * Create a personality-driven NPC (DOG type)
 */
export function createPersonalityNPC(config: SocialAgentConfig): SocialAgent {
  const agent = new SocialAgent({
    ...config,
    role: DAR.NPC,
    biologicalType: BA.DOG,
  });

  getAgentRegistry().register(agent, config);

  return agent;
}
