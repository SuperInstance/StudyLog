/**
 * StudyLoG.AI - Enhanced Director Service with Character System
 *
 * Integrates the personality-driven character system with the existing
 * agent director orchestration.
 *
 * Based on research from SuperInstance ai-character-integrations.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { MessageService } from '@theia/core';
import {
  AgentType,
  AgentState,
  AgentTask,
  TaskResult,
  DirectorCommand,
  AgentContext,
  ConversationMessage,
  DEFAULT_AGENTS,
} from '../common';

// Import character system (when integrated)
// import {
//   AICharacter,
//   CharacterFactory,
//   ScenarioType,
//   StudentContext,
//   Personality,
//   PERSONALITY_PRESETS,
// } from '@studylog/characters';

/**
 * Extended agent definition with character integration
 */
interface ExtendedAgentDefinition {
  id: string;
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  personality?: any;  // Personality from character system
  teachingStyle?: any;  // Teaching style for tutor agents
  unlockStage?: number;
}

/**
 * Enhanced Director Service with Character System
 *
 * This service extends the existing DirectorService to integrate
 * personality-driven AI characters with memory and relationship tracking.
 */
@injectable()
export class CharacterDirectorService {
  @inject(MessageService)
  protected readonly messageService: MessageService;

  private agents: Map<AgentType, AgentState> = new Map();
  private taskQueue: AgentTask[] = [];
  private conversationHistory: ConversationMessage[] = [];
  private currentModule = 'cognitive-mill';
  private currentStage = 1;

  // Character system integration
  private characters: Map<string, any> = new Map();  // AICharacter instances
  private studentProfile: any = null;  // Current student profile

  constructor() {
    this.initializeAgents();
    this.initializeCharacters();
  }

  private initializeAgents(): void {
    for (const def of DEFAULT_AGENTS) {
      this.agents.set(def.type, {
        id: def.id,
        type: def.type,
        status: 'idle',
        context: {
          module: this.currentModule,
          stage: this.currentStage,
          conversationHistory: [],
        },
        lastActivity: Date.now(),
      });
    }
  }

  /**
   * Initialize AI characters based on current stage
   */
  private initializeCharacters(): void {
    // When character system is integrated:
    // this.characters.set('ada', CharacterFactory.createAda());
    // this.characters.set('alan', CharacterFactory.createAlan());
    // this.characters.set('grace', CharacterFactory.createGrace());

    // For now, use mock character data
    const mockCharacters = [
      {
        id: 'ada',
        name: 'Ada',
        title: 'Concept Explorer',
        personality: PERSONALITY_PRESETS.explorer,
        unlockStage: 1,
      },
      {
        id: 'alan',
        name: 'Alan',
        title: 'Algorithm Architect',
        personality: PERSONALITY_PRESETS.expert,
        unlockStage: 2,
      },
      {
        id: 'grace',
        name: 'Grace',
        title: 'Applications Guide',
        personality: PERSONALITY_PRESETS.guide,
        unlockStage: 3,
      },
    ];

    for (const char of mockCharacters) {
      if (char.unlockStage <= this.currentStage) {
        this.characters.set(char.id, char);
      }
    }
  }

  /**
   * Process a user message with character-aware routing
   */
  async processUserMessage(
    content: string,
    studentContext?: any
  ): Promise<string> {
    // Add to history
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(userMessage);

    // Store student profile if provided
    if (studentContext) {
      this.studentProfile = studentContext;
    }

    // Determine intent and route to appropriate agent
    const intent = await this.classifyIntent(content);
    const targetAgent = this.routeToAgent(intent);

    // Select character for this interaction
    const character = this.selectCharacterForIntent(intent);

    // Execute with the target agent and character
    const response = await this.executeWithAgent(
      targetAgent,
      content,
      character
    );

    // Add response to history
    const agentMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      agent: targetAgent,
      content: response,
      timestamp: Date.now(),
      metadata: character ? { characterId: character.id } : undefined,
    };
    this.conversationHistory.push(agentMessage);

    return response;
  }

  /**
   * Select a character based on intent and context
   */
  private selectCharacterForIntent(intent: string): any {
    if (this.characters.size === 0) {
      return null;
    }

    // When character system is integrated, this would:
    // 1. Check which characters are available for current stage
    // 2. Match character personality to intent
    // 3. Consider student's relationship with each character
    // 4. Select best fit

    // Simple mapping for now
    switch (intent) {
      case 'explanation':
      case 'hint':
        return this.characters.get('ada') || this.characters.values().next().value;
      case 'code-help':
        return this.characters.get('alan');
      default:
        return Array.from(this.characters.values())[0];
    }
  }

  /**
   * Classify user intent (enhanced with character awareness)
   */
  private async classifyIntent(content: string): Promise<string> {
    const lower = content.toLowerCase();

    // Check for frustration indicators
    const frustrated = [
      'confused',
      'lost',
      'don\'t understand',
      'stuck',
      'frustrated',
      'help',
    ];
    const isFrustrated = frustrated.some(word => lower.includes(word));

    // Check for excitement indicators
    const excited = ['cool', 'awesome', 'get it', 'makes sense', 'finally'];
    const isExcited = excited.some(word => lower.includes(word));

    // Intent classification with emotional context
    if (isFrustrated) {
      if (lower.includes('explain') || lower.includes('what is')) {
        return 'explanation-simplified';
      }
      return 'help-needed';
    }

    if (isExcited) {
      return 'celebration';
    }

    // Standard intent classification
    if (lower.includes('play') || lower.includes('start') || lower.includes('game')) {
      return 'game-control';
    }
    if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does')) {
      return 'explanation';
    }
    if (lower.includes('hint')) {
      return 'hint';
    }
    if (lower.includes('code') || lower.includes('write') || lower.includes('function')) {
      return 'code-help';
    }
    if (lower.includes('test') || lower.includes('check') || lower.includes('run')) {
      return 'testing';
    }
    if (lower.includes('error') || lower.includes('bug') || lower.includes('wrong')) {
      return 'debugging';
    }

    return 'general';
  }

  /**
   * Route to appropriate agent based on intent
   */
  private routeToAgent(intent: string): AgentType {
    switch (intent) {
      case 'game-control':
        return 'captain';
      case 'explanation':
      case 'explanation-simplified':
      case 'hint':
      case 'help-needed':
        return 'teacher';
      case 'celebration':
        return 'teacher';  // Teacher handles celebrations too
      case 'code-help':
        return 'builder';
      case 'testing':
      case 'debugging':
        return 'tester';
      default:
        return 'director';
    }
  }

  /**
   * Execute task with specific agent and character
   */
  private async executeWithAgent(
    agentType: AgentType,
    content: string,
    character: any
  ): Promise<string> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      return 'Agent not available.';
    }

    // Update agent status
    agent.status = 'thinking';
    agent.lastActivity = Date.now();

    try {
      // Generate response with character personality
      const response = await this.generateCharacterResponse(
        agentType,
        content,
        character
      );

      agent.status = 'idle';
      return response;
    } catch (error) {
      agent.status = 'error';
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Generate response with character personality
   */
  private async generateCharacterResponse(
    agentType: AgentType,
    content: string,
    character: any
  ): Promise<string> {
    // Simulate thinking time
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get character personality if available
    const personality = character?.personality;
    const characterName = character?.name;

    // Generate response based on agent type and character personality
    switch (agentType) {
      case 'teacher':
        return this.generateTeacherResponse(content, characterName, personality);

      case 'captain':
        return this.generateCaptainResponse(content, characterName, personality);

      case 'builder':
        return this.generateBuilderResponse(content, characterName, personality);

      case 'tester':
        return this.generateTesterResponse(content, characterName, personality);

      default:
        return `I understand you're asking about "${content}". Let me help you with that.`;
    }
  }

  /**
   * Generate teacher response with personality
   */
  private generateTeacherResponse(
    content: string,
    characterName?: string,
    personality?: any
  ): string {
    const intro = characterName
      ? `${characterName} here`
      : 'Your teacher';

    // Adjust response based on personality
    if (personality) {
      if (personality.openness > 0.7) {
        return `${intro}: That's a fascinating question! Let me explore this idea with you...`;
      }
      if (personality.conscientiousness > 0.7) {
        return `${intro}: Let's break this down systematically. First...`;
      }
      if (personality.extraversion > 0.7) {
        return `${intro}: Oh, I love talking about this! Let me explain...`;
      }
    }

    return `${intro}: Great question! Let me explain this step by step...`;
  }

  /**
   * Generate captain response with personality
   */
  private generateCaptainResponse(
    content: string,
    characterName?: string,
    personality?: any
  ): string {
    const isExcited = content.toLowerCase().includes('start');

    if (isExcited && personality?.extraversion > 0.7) {
      return `*The mill creaks to life with energy* Welcome aboard, adventurer! Your journey begins now!`;
    }

    return `*The mill creaks to life* Welcome to the Cognitive Mill! Let's explore how things work.`;
  }

  /**
   * Generate builder response with personality
   */
  private generateBuilderResponse(
    content: string,
    characterName?: string,
    personality?: any
  ): string {
    if (personality?.conscientiousness > 0.7) {
      return `Let's build this carefully. I'll help you write clean, well-structured code.`;
    }
    return `I can help you write that code. Let's put it together step by step.`;
  }

  /**
   * Generate tester response with personality
   */
  private generateTesterResponse(
    content: string,
    characterName?: string,
    personality?: any
  ): string {
    if (personality?.conscientiousness > 0.8) {
      return `Let me run thorough tests on this. I'll check every edge case carefully.`;
    }
    return `Let me run some tests and check for any issues.`;
  }

  /**
   * Provide a hint with character personality
   */
  async provideHint(concept: string, level: number): Promise<string> {
    const character = this.selectCharacterForIntent('hint');

    if (!character) {
      return `Hint for ${concept}: Think about the fundamental principles involved.`;
    }

    // When character system is integrated:
    // return character.provideHint(concept, level, this.studentProfile);

    const hints = [
      `Think about how the key components interact.`,
      `Consider what's happening at each step of the process.`,
      `Focus on the core mechanism that makes ${concept} work.`,
    ];

    const hintIndex = Math.min(Math.floor(level / 0.33), hints.length - 1);

    return `${character.name} says: "${hints[hintIndex]}"`;
  }

  /**
   * Celebrate student achievement
   */
  celebrateSuccess(studentName: string, achievement: string): string {
    const character = this.selectCharacterForIntent('celebration');

    if (!character) {
      return `Great job, ${studentName}! You've completed ${achievement}!`;
    }

    // When character system is integrated:
    // return character.celebrateSuccess(studentName, achievement);

    return `${character.name}: "Excellent work, ${studentName}! You've mastered ${achievement}!"`;
  }

  /**
   * Advance to the next stage (unlocks new characters)
   */
  async advanceStage(): Promise<TaskResult> {
    const taskId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      this.currentStage++;
      this.updateAgentContexts();

      // Reinitialize characters for new stage
      this.initializeCharacters();

      return {
        taskId,
        success: true,
        result: { stage: this.currentStage },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get available characters for current stage
   */
  getAvailableCharacters(): any[] {
    return Array.from(this.characters.values());
  }

  /**
   * Get student's relationship with a character
   */
  getCharacterRelationship(characterId: string): any {
    // When character system is integrated:
    // const character = this.characters.get(characterId);
    // return character?.getRelationship(this.studentProfile?.id);

    return {
      characterId,
      interactionCount: 0,
      trustLevel: 0.5,
    };
  }

  /**
   * Execute a director command
   */
  async executeCommand(command: DirectorCommand): Promise<TaskResult> {
    const taskId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      switch (command.type) {
        case 'start_module':
          this.currentModule = command.module;
          this.currentStage = 1;
          this.updateAgentContexts();
          this.initializeCharacters();
          return {
            taskId,
            success: true,
            result: { module: command.module, stage: 1 },
            duration: Date.now() - startTime,
          };

        case 'advance_stage':
          return await this.advanceStage();

        case 'provide_hint':
          const hint = await this.provideHint(
            (command as any).concept || 'puzzle',
            (command as any).level || 1
          );
          return {
            taskId,
            success: true,
            result: { hint },
            duration: Date.now() - startTime,
          };

        case 'delegate':
          const result = await this.executeWithAgent(
            command.agent,
            JSON.stringify(command.task),
            null
          );
          return {
            taskId,
            success: true,
            result,
            duration: Date.now() - startTime,
          };

        default:
          return {
            taskId,
            success: false,
            error: 'Unknown command',
            duration: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        taskId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Update all agent contexts
   */
  private updateAgentContexts(): void {
    for (const agent of this.agents.values()) {
      agent.context.module = this.currentModule;
      agent.context.stage = this.currentStage;
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus(type: AgentType): AgentState | undefined {
    return this.agents.get(type);
  }

  /**
   * Get all agent statuses
   */
  getAllAgentStatuses(): AgentState[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current module
   */
  getCurrentModule(): string {
    return this.currentModule;
  }

  /**
   * Get current stage
   */
  getCurrentStage(): number {
    return this.currentStage;
  }

  /**
   * Set student profile
   */
  setStudentProfile(profile: any): void {
    this.studentProfile = profile;
  }

  /**
   * Get student profile
   */
  getStudentProfile(): any {
    return this.studentProfile;
  }
}

// Personality presets for reference (when not importing from character system)
const PERSONALITY_PRESETS: Record<string, any> = {
  explorer: {
    openness: 0.95,
    conscientiousness: 0.5,
    extraversion: 0.7,
    agreeableness: 0.6,
    neuroticism: 0.5,
  },
  expert: {
    openness: 0.6,
    conscientiousness: 0.95,
    extraversion: 0.3,
    agreeableness: 0.5,
    neuroticism: 0.4,
  },
  guide: {
    openness: 0.8,
    conscientiousness: 0.6,
    extraversion: 0.9,
    agreeableness: 0.9,
    neuroticism: 0.3,
  },
};
