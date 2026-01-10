/**
 * StudyLoG.AI - Agent Orchestrator
 *
 * Manages all agents and coordinates communication between them.
 */

import type {
  AgentId,
  AgentContext,
  AgentResponse,
  Message,
  AgentEvent,
} from './types';
import { BaseAgent } from './base-agent';
import { AIClient, createAIClient } from './ai-client';
import { DirectorAgent } from '../agents/director';
import { CaptainAgent } from '../agents/captain';

export interface OrchestratorConfig {
  preferLocalAI?: boolean;
  anthropicKey?: string;
  ollamaUrl?: string;
  initialModule?: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
}

export class AgentOrchestrator {
  private agents: Map<AgentId, BaseAgent> = new Map();
  private aiClient: AIClient;
  private context: AgentContext;
  private eventListeners: Array<(event: AgentEvent) => void> = [];

  constructor(config: OrchestratorConfig = {}) {
    // Create AI client
    this.aiClient = createAIClient(config.preferLocalAI, config.anthropicKey);

    // Initialize context
    this.context = {
      module: config.initialModule || 'cognitive-mill',
      stage: 1,
      phase: 'player',
      conversationHistory: [],
      agentState: {},
    };

    // Create agents
    this.initializeAgents();
  }

  private initializeAgents(): void {
    // Create Director
    const director = new DirectorAgent(this.aiClient);
    director.on((event) => this.handleAgentEvent('director', event));
    this.agents.set('director', director);

    // Create Captain
    const captain = new CaptainAgent(this.aiClient);
    captain.on((event) => this.handleAgentEvent('captain', event));
    this.agents.set('captain', captain);

    // TODO: Add Teacher, Builder, Tester agents
  }

  // Handle events from agents
  private handleAgentEvent(agentId: AgentId, event: AgentEvent): void {
    // Re-emit with source agent info
    this.emit({
      ...event,
      source: agentId,
    } as AgentEvent & { source: AgentId });
  }

  // Add event listener
  on(listener: (event: AgentEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  // Emit event
  private emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  // Process a user message through the agent system
  async chat(userMessage: string): Promise<AgentResponse> {
    // Add user message to history
    const message: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.context.conversationHistory.push(message);
    this.emit({ type: 'message', message });

    // Start with Director
    const director = this.agents.get('director') as DirectorAgent;
    let response = await director.process(userMessage, this.context);

    // Handle delegation if needed
    if (response.delegateTo) {
      const delegatedAgent = this.agents.get(response.delegateTo);
      if (delegatedAgent) {
        response = await delegatedAgent.process(userMessage, this.context);
      }
    }

    // Add agent response to history
    const responseMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.content,
      agentId: response.agentId,
      timestamp: Date.now(),
    };
    this.context.conversationHistory.push(responseMessage);
    this.emit({ type: 'message', message: responseMessage });

    return response;
  }

  // Get agent by ID
  getAgent(id: AgentId): BaseAgent | undefined {
    return this.agents.get(id);
  }

  // Get all agents
  getAllAgents(): Map<AgentId, BaseAgent> {
    return this.agents;
  }

  // Get current context
  getContext(): AgentContext {
    return { ...this.context };
  }

  // Update context
  updateContext(updates: Partial<AgentContext>): void {
    this.context = { ...this.context, ...updates };
  }

  // Set module
  setModule(module: AgentContext['module']): void {
    this.context.module = module;
    this.context.stage = 1; // Reset stage when changing modules
  }

  // Advance stage
  advanceStage(): number {
    this.context.stage++;
    return this.context.stage;
  }

  // Set phase
  setPhase(phase: AgentContext['phase']): void {
    this.context.phase = phase;
  }

  // Set student info
  setStudent(student: AgentContext['student']): void {
    this.context.student = student;
  }

  // Update game state
  updateGameState(state: Partial<AgentContext['gameState']>): void {
    this.context.gameState = {
      ...this.context.gameState,
      ...state,
      lastUpdate: Date.now(),
    } as AgentContext['gameState'];
  }

  // Get conversation history
  getHistory(): Message[] {
    return [...this.context.conversationHistory];
  }

  // Clear conversation history
  clearHistory(): void {
    this.context.conversationHistory = [];
  }

  // Check if AI is available
  async isAIAvailable(): Promise<boolean> {
    return this.aiClient.isAvailable();
  }
}

// Singleton instance
let orchestratorInstance: AgentOrchestrator | null = null;

export function getOrchestrator(config?: OrchestratorConfig): AgentOrchestrator {
  if (!orchestratorInstance || config) {
    orchestratorInstance = new AgentOrchestrator(config);
  }
  return orchestratorInstance;
}
