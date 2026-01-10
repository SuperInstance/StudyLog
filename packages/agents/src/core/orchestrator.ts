/**
 * StudyLoG.AI - Agent Orchestrator
 *
 * Manages all agents and coordinates communication between them
 * using the A2A (Agent-to-Agent) protocol.
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
import { A2AProtocol, getA2AProtocol } from './a2a-protocol';
import { DirectorAgent } from '../agents/director';
import { CaptainAgent } from '../agents/captain';
import { DeckhandAgent } from '../agents/deckhand';
import { RanchhandAgent } from '../agents/ranchhand';
import { MechanicAgent } from '../agents/mechanic';
import { NPCAgent, createModuleNPCs } from '../npc/ace-agent';
import type { NPCIdentity } from '../npc/types';

// Extended agent ID to include new agents
export type ExtendedAgentId = AgentId | 'deckhand' | 'ranchhand' | 'mechanic' | string;

export interface OrchestratorConfig {
  preferLocalAI?: boolean;
  anthropicKey?: string;
  ollamaUrl?: string;
  aceEndpoint?: string;
  aceApiKey?: string;
  initialModule?: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  enableNPCs?: boolean;
  enableA2A?: boolean;
}

export class AgentOrchestrator {
  private agents: Map<ExtendedAgentId, BaseAgent> = new Map();
  private npcs: Map<string, NPCAgent> = new Map();
  private aiClient: AIClient;
  private context: AgentContext;
  private eventListeners: Array<(event: AgentEvent) => void> = [];
  private a2aProtocol: A2AProtocol;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig = {}) {
    this.config = config;

    // Create AI client
    this.aiClient = createAIClient(config.preferLocalAI, config.anthropicKey);

    // Get A2A protocol
    this.a2aProtocol = getA2AProtocol();

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

    // Initialize NPCs if enabled
    if (config.enableNPCs !== false) {
      this.initializeNPCs();
    }

    // Set up A2A event forwarding
    this.setupA2AEvents();
  }

  private initializeAgents(): void {
    // Create Director - Routes messages to appropriate agents
    const director = new DirectorAgent(this.aiClient);
    director.on((event) => this.handleAgentEvent('director', event));
    this.agents.set('director', director);
    this.registerWithA2A(director, [
      { name: 'routing', description: 'Route messages to agents', inputSchema: {}, outputSchema: {} },
      { name: 'delegation', description: 'Delegate tasks', inputSchema: {}, outputSchema: {} },
    ]);

    // Create Captain - Game control and narrative
    const captain = new CaptainAgent(this.aiClient);
    captain.on((event) => this.handleAgentEvent('captain', event));
    this.agents.set('captain', captain);
    this.registerWithA2A(captain, [
      { name: 'game-control', description: 'Control game state', inputSchema: {}, outputSchema: {} },
      { name: 'narrative', description: 'Generate narratives', inputSchema: {}, outputSchema: {} },
    ]);

    // Create Deckhand - Fishing operations (Sitka Sound)
    const deckhand = new DeckhandAgent(this.context);
    deckhand.on((event) => this.handleAgentEvent('deckhand', event));
    this.agents.set('deckhand', deckhand);
    this.registerWithA2A(deckhand, [
      { name: 'fishing', description: 'Handle fishing operations', inputSchema: {}, outputSchema: {} },
      { name: 'navigation', description: 'Boat navigation', inputSchema: {}, outputSchema: {} },
      { name: 'crew-management', description: 'Manage crew', inputSchema: {}, outputSchema: {} },
    ]);

    // Create Ranchhand - AI livestock management (Intelligence Ranch)
    const ranchhand = new RanchhandAgent(this.context);
    ranchhand.on((event) => this.handleAgentEvent('ranchhand', event));
    this.agents.set('ranchhand', ranchhand);
    this.registerWithA2A(ranchhand, [
      { name: 'agent-training', description: 'Train AI agents', inputSchema: {}, outputSchema: {} },
      { name: 'breeding', description: 'Breed/evolve agents', inputSchema: {}, outputSchema: {} },
      { name: 'swarm-management', description: 'Manage swarm behavior', inputSchema: {}, outputSchema: {} },
    ]);

    // Create Mechanic - Hardware troubleshooting
    const mechanic = new MechanicAgent(this.context);
    mechanic.on((event) => this.handleAgentEvent('mechanic', event));
    this.agents.set('mechanic', mechanic);
    this.registerWithA2A(mechanic, [
      { name: 'hardware-diagnostics', description: 'Diagnose hardware', inputSchema: {}, outputSchema: {} },
      { name: 'setup', description: 'Set up hardware/software', inputSchema: {}, outputSchema: {} },
      { name: 'troubleshooting', description: 'Troubleshoot issues', inputSchema: {}, outputSchema: {} },
    ]);
  }

  private initializeNPCs(): void {
    // Create NPCs for current module
    const moduleNPCs = createModuleNPCs(this.context.module, this.context);

    for (const [npcId, npc] of moduleNPCs) {
      npc.on((event) => this.handleAgentEvent(npcId as ExtendedAgentId, event));
      this.npcs.set(npcId, npc);
      this.registerWithA2A(npc, [
        { name: 'npc-interaction', description: 'Interact with player', inputSchema: {}, outputSchema: {} },
        { name: 'teaching', description: 'Teach concepts', inputSchema: {}, outputSchema: {} },
      ]);
    }
  }

  private registerWithA2A(agent: BaseAgent, capabilities: Array<{ name: string; description: string; inputSchema: Record<string, unknown>; outputSchema: Record<string, unknown> }>): void {
    if (this.config.enableA2A !== false) {
      this.a2aProtocol.registerAgent(agent, capabilities);
    }
  }

  private setupA2AEvents(): void {
    if (this.config.enableA2A !== false) {
      // Forward A2A events
      this.a2aProtocol.on('delegation', (data) => {
        this.emit({
          type: 'delegation',
          from: data.from,
          to: data.to,
          task: data.task,
        } as AgentEvent);
      });

      this.a2aProtocol.on('message', (message) => {
        this.emit({
          type: 'a2a-message',
          message,
        } as AgentEvent);
      });
    }
  }

  // Handle events from agents
  private handleAgentEvent(agentId: ExtendedAgentId, event: AgentEvent): void {
    // Re-emit with source agent info
    this.emit({
      ...event,
      source: agentId,
    } as AgentEvent & { source: ExtendedAgentId });
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

    // Start with Director for routing
    const director = this.agents.get('director') as DirectorAgent;
    let response = await director.process(userMessage, this.context);

    // Handle delegation if needed
    if (response.delegateTo) {
      const targetAgent = this.getAgentById(response.delegateTo);
      if (targetAgent) {
        this.emit({
          type: 'delegation',
          from: 'director',
          to: response.delegateTo,
        } as AgentEvent);

        response = await targetAgent.process(
          { role: 'user', content: userMessage },
          this.context
        );
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

  // Chat with a specific NPC
  async chatWithNPC(npcId: string, userMessage: string): Promise<AgentResponse> {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      return {
        agentId: 'system',
        content: `NPC "${npcId}" not found in current module.`,
      };
    }

    const message: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    this.context.conversationHistory.push(message);
    this.emit({ type: 'message', message });

    const response = await npc.process(message);

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

  // Get agent by ID (includes both regular agents and NPCs)
  private getAgentById(id: string): BaseAgent | undefined {
    return this.agents.get(id as ExtendedAgentId) || this.npcs.get(id);
  }

  // Get agent by ID (public)
  getAgent(id: ExtendedAgentId): BaseAgent | undefined {
    return this.agents.get(id);
  }

  // Get NPC by ID
  getNPC(id: string): NPCAgent | undefined {
    return this.npcs.get(id);
  }

  // Get all agents
  getAllAgents(): Map<ExtendedAgentId, BaseAgent> {
    return this.agents;
  }

  // Get all NPCs
  getAllNPCs(): Map<string, NPCAgent> {
    return this.npcs;
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

    // Reinitialize NPCs for new module
    if (this.config.enableNPCs !== false) {
      // Unregister old NPCs from A2A
      for (const [npcId] of this.npcs) {
        this.a2aProtocol.unregisterAgent(npcId);
      }
      this.npcs.clear();

      // Create new NPCs
      this.initializeNPCs();
    }
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

  // Get A2A protocol instance
  getA2AProtocol(): A2AProtocol {
    return this.a2aProtocol;
  }

  // Get agent for specific module operations
  getModuleAgent(): BaseAgent | undefined {
    switch (this.context.module) {
      case 'sitka-sound':
        return this.agents.get('deckhand');
      case 'intelligence-ranch':
        return this.agents.get('ranchhand');
      case 'cognitive-mill':
      default:
        return this.agents.get('captain');
    }
  }

  // Get mechanic for hardware help
  getMechanic(): MechanicAgent | undefined {
    return this.agents.get('mechanic') as MechanicAgent | undefined;
  }

  // Delegate task between agents using A2A
  async delegateTask(
    from: string,
    to: string,
    action: string,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    if (this.config.enableA2A === false) {
      throw new Error('A2A protocol is disabled');
    }

    const response = await this.a2aProtocol.delegate(from, to, {
      action,
      parameters,
    });

    return response.result;
  }

  // Broadcast message to all agents
  broadcastToAgents(from: string, payload: unknown): void {
    if (this.config.enableA2A !== false) {
      this.a2aProtocol.broadcast(from, payload);
    }
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
