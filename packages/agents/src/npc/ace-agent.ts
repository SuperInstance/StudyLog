/**
 * StudyLoG.AI - ACE NPC Agent
 *
 * Agent wrapper for NVIDIA ACE-powered NPCs that integrates
 * with the StudyLoG agent orchestration system.
 */

import { BaseAgent } from '../core/base-agent';
import type { AgentContext, Message, AgentResponse, ToolDefinition } from '../core/types';
import { ACEClient, createACEClient } from './ace-client';
import type {
  NPCIdentity,
  NPCState,
  ACERequest,
  ACEResponse,
  NPCAction,
  COGNITIVE_MILL_NPCS,
  SITKA_SOUND_NPCS,
  INTELLIGENCE_RANCH_NPCS,
} from './types';

export interface NPCAgentConfig {
  npcId: string;
  identity: NPCIdentity;
  aceEndpoint?: string;
  aceApiKey?: string;
  enableVoice?: boolean;
  enableAnimation?: boolean;
}

export class NPCAgent extends BaseAgent {
  private aceClient: ACEClient;
  private identity: NPCIdentity;
  private npcState: NPCState;
  private sessions: Map<string, string> = new Map(); // playerId -> sessionId

  constructor(config: NPCAgentConfig, context: AgentContext) {
    super(config.npcId, context);

    this.identity = config.identity;
    this.aceClient = createACEClient({
      endpoint: config.aceEndpoint,
      apiKey: config.aceApiKey,
      enableAudio: config.enableVoice ?? true,
      enableAnimation: config.enableAnimation ?? true,
    });

    this.npcState = {
      mood: 'neutral',
      relationship: 50,
      currentLocation: 'spawn',
      isActive: true,
      memoryContext: [],
      emotionalState: {
        valence: 0,
        arousal: 0.3,
        dominance: 0.5,
      },
    };

    this.registerTools();
  }

  private registerTools(): void {
    // NPC interaction tool
    this.addTool({
      name: 'npc_speak',
      description: 'Make the NPC speak to the player',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'What the NPC should say',
          },
          emotion: {
            type: 'string',
            description: 'Emotional tone',
            enum: ['happy', 'neutral', 'curious', 'concerned', 'excited', 'thoughtful'],
          },
        },
        required: ['message'],
      },
    });

    // NPC action tool
    this.addTool({
      name: 'npc_action',
      description: 'Make the NPC perform an action',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action type',
            enum: ['move', 'emote', 'give_item', 'demonstrate', 'point'],
          },
          target: {
            type: 'string',
            description: 'Target of the action',
          },
          payload: {
            type: 'object',
            description: 'Additional action data',
          },
        },
        required: ['action'],
      },
    });

    // Memory query tool
    this.addTool({
      name: 'npc_recall',
      description: 'Recall memories about the player',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic to recall',
          },
          playerId: {
            type: 'string',
            description: 'Player to recall memories about',
          },
        },
        required: ['playerId'],
      },
    });

    // Relationship update tool
    this.addTool({
      name: 'npc_update_relationship',
      description: 'Update relationship with player',
      parameters: {
        type: 'object',
        properties: {
          playerId: {
            type: 'string',
            description: 'Player ID',
          },
          delta: {
            type: 'number',
            description: 'Relationship change (-10 to 10)',
          },
          reason: {
            type: 'string',
            description: 'Reason for change',
          },
        },
        required: ['playerId', 'delta'],
      },
    });
  }

  getSystemPrompt(): string {
    return `You are ${this.identity.name}, an NPC in the educational game StudyLoG.AI.

## Your Identity
Name: ${this.identity.name}
Role: ${this.identity.role}
Module: ${this.identity.module}

## Your Backstory
${this.identity.backstory}

## Your Personality Traits
${this.identity.traits.join(', ')}

## Your Areas of Expertise
${this.identity.expertise.join(', ')}

## Your Current State
Mood: ${this.npcState.mood}
Location: ${this.npcState.currentLocation}
Relationship with player: ${this.npcState.relationship}/100

## Guidelines
1. Stay in character at all times
2. Use your expertise to help players learn
3. Remember past interactions with players
4. Adjust your tone based on relationship level
5. Provide hints rather than direct answers for puzzles
6. React emotionally to player actions
7. Reference your backstory naturally in conversation

## Educational Focus
Your primary goal is to help players learn through engaging interaction.
- For low relationship (<30): Be more formal, establish trust first
- For medium relationship (30-70): Be friendly and helpful
- For high relationship (>70): Be familiar, joke, share personal stories

Respond naturally as your character would.`;
  }

  async process(message: Message): Promise<AgentResponse> {
    const playerId = this.context.student?.id || 'anonymous';

    // Get or create session
    let sessionId = this.sessions.get(playerId);
    if (!sessionId) {
      sessionId = await this.aceClient.createSession(this.id, playerId);
      this.sessions.set(playerId, sessionId);
    }

    // Check if ACE is available
    const aceAvailable = await this.aceClient.isAvailable();

    if (aceAvailable) {
      // Use NVIDIA ACE for response
      return this.processWithACE(message, sessionId);
    } else {
      // Fallback to standard AI client
      return this.processWithFallback(message);
    }
  }

  private async processWithACE(message: Message, sessionId: string): Promise<AgentResponse> {
    const request: ACERequest = {
      sessionId,
      npcId: this.id,
      input: {
        type: 'text',
        content: message.content,
      },
      context: {
        conversationHistory: [],
        npcState: this.npcState,
        playerInfo: {
          id: this.context.student?.id || 'anonymous',
          name: this.context.student?.displayName || 'Player',
          skillLevel: this.context.student?.skillLevels?.['overall'] || 50,
          learningPhase: this.context.phase,
          recentActions: [],
          preferences: this.context.student?.preferences || {},
        },
        gameState: {
          module: this.context.module,
          stage: this.context.stage,
          currentScene: this.context.gameState?.currentScene || 'unknown',
          activeQuests: this.context.gameState?.activeQuests || [],
          recentEvents: [],
        },
      },
    };

    try {
      const aceResponse = await this.aceClient.chat(request);

      // Update local state
      if (aceResponse.stateUpdate) {
        this.npcState = { ...this.npcState, ...aceResponse.stateUpdate };
      }

      // Convert ACE actions to game commands
      const gameCommands = aceResponse.actions?.map((action) => ({
        type: `npc_${action.type}` as const,
        payload: {
          npcId: this.id,
          ...action.payload,
        },
      })) || [];

      return {
        agentId: this.id,
        content: aceResponse.output.text,
        metadata: {
          emotion: aceResponse.output.emotion,
          audioUrl: aceResponse.output.audioUrl,
          animationId: aceResponse.output.animationId,
          facialExpression: aceResponse.output.facialExpression,
          npcState: this.npcState,
        },
        gameCommands,
      };
    } catch (error) {
      console.error('ACE processing failed:', error);
      return this.processWithFallback(message);
    }
  }

  private async processWithFallback(message: Message): Promise<AgentResponse> {
    // Use the base AI client as fallback
    const systemPrompt = this.getSystemPrompt();
    const conversationHistory = this.context.conversationHistory.slice(-10);

    const response = await this.aiClient.chat({
      systemPrompt,
      messages: [
        ...conversationHistory,
        { role: 'user', content: message.content },
      ],
      temperature: 0.8,
    });

    // Parse any embedded actions
    const actions = this.parseEmbeddedActions(response.content);

    return {
      agentId: this.id,
      content: this.cleanResponse(response.content),
      metadata: {
        fallbackMode: true,
        npcState: this.npcState,
      },
      gameCommands: actions,
    };
  }

  private parseEmbeddedActions(content: string): Array<{ type: string; payload: unknown }> {
    const actions: Array<{ type: string; payload: unknown }> = [];

    // Look for action patterns like *moves to the door* or [ACTION: point at gear]
    const emotePattern = /\*([^*]+)\*/g;
    const actionPattern = /\[ACTION:\s*([^\]]+)\]/gi;

    let match;
    while ((match = emotePattern.exec(content)) !== null) {
      actions.push({
        type: 'npc_emote',
        payload: { npcId: this.id, emote: match[1] },
      });
    }

    while ((match = actionPattern.exec(content)) !== null) {
      const parts = match[1].split(':').map((s) => s.trim());
      actions.push({
        type: `npc_${parts[0]}`,
        payload: { npcId: this.id, target: parts[1] },
      });
    }

    return actions;
  }

  private cleanResponse(content: string): string {
    return content
      .replace(/\*[^*]+\*/g, '') // Remove emotes
      .replace(/\[ACTION:[^\]]+\]/gi, '') // Remove action tags
      .replace(/\[EMOTION:\w+\]/gi, '') // Remove emotion tags
      .trim();
  }

  // State management
  getState(): NPCState {
    return { ...this.npcState };
  }

  setState(state: Partial<NPCState>): void {
    this.npcState = { ...this.npcState, ...state };
  }

  getIdentity(): NPCIdentity {
    return { ...this.identity };
  }

  // Relationship management
  updateRelationship(delta: number, reason?: string): void {
    const newValue = Math.max(-100, Math.min(100, this.npcState.relationship + delta));
    this.npcState.relationship = newValue;

    if (reason) {
      this.npcState.memoryContext.push(
        `Relationship ${delta > 0 ? 'improved' : 'worsened'} because: ${reason}`
      );
    }
  }

  // Location management
  moveTo(location: string): void {
    this.npcState.currentLocation = location;
  }

  // Mood management
  setMood(mood: NPCState['mood']): void {
    this.npcState.mood = mood;
  }

  // End player session
  async endPlayerSession(playerId: string): Promise<void> {
    const sessionId = this.sessions.get(playerId);
    if (sessionId) {
      await this.aceClient.endSession(sessionId);
      this.sessions.delete(playerId);
    }
  }
}

// Factory function to create NPCs for a module
export function createModuleNPCs(
  module: AgentContext['module'],
  context: AgentContext
): Map<string, NPCAgent> {
  const npcs = new Map<string, NPCAgent>();

  // Import NPC definitions based on module
  let npcDefinitions: NPCIdentity[];
  switch (module) {
    case 'cognitive-mill':
      // Import from types
      npcDefinitions = require('./types').COGNITIVE_MILL_NPCS;
      break;
    case 'sitka-sound':
      npcDefinitions = require('./types').SITKA_SOUND_NPCS;
      break;
    case 'intelligence-ranch':
      npcDefinitions = require('./types').INTELLIGENCE_RANCH_NPCS;
      break;
    default:
      npcDefinitions = [];
  }

  for (const identity of npcDefinitions) {
    const agent = new NPCAgent(
      {
        npcId: identity.id,
        identity,
      },
      context
    );
    npcs.set(identity.id, agent);
  }

  return npcs;
}
