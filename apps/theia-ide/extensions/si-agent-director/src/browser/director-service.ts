/**
 * StudyLoG.AI - Director Service
 *
 * Core orchestration service that manages all agents
 * and routes tasks between them.
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

@injectable()
export class DirectorService {
  @inject(MessageService)
  protected readonly messageService: MessageService;

  private agents: Map<AgentType, AgentState> = new Map();
  private taskQueue: AgentTask[] = [];
  private conversationHistory: ConversationMessage[] = [];
  private currentModule = 'cognitive-mill';
  private currentStage = 1;

  constructor() {
    this.initializeAgents();
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

  // Process a user message
  async processUserMessage(content: string): Promise<string> {
    // Add to history
    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(userMessage);

    // Determine intent and route to appropriate agent
    const intent = await this.classifyIntent(content);
    const targetAgent = this.routeToAgent(intent);

    // Execute with the target agent
    const response = await this.executeWithAgent(targetAgent, content);

    // Add response to history
    const agentMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      agent: targetAgent,
      content: response,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(agentMessage);

    return response;
  }

  // Classify user intent
  private async classifyIntent(content: string): Promise<string> {
    const lower = content.toLowerCase();

    // Simple keyword-based classification
    // In production, use AI for better classification
    if (lower.includes('play') || lower.includes('start') || lower.includes('game')) {
      return 'game-control';
    }
    if (lower.includes('explain') || lower.includes('what is') || lower.includes('how does')) {
      return 'explanation';
    }
    if (lower.includes('hint') || lower.includes('help') || lower.includes('stuck')) {
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

  // Route to appropriate agent based on intent
  private routeToAgent(intent: string): AgentType {
    switch (intent) {
      case 'game-control':
        return 'captain';
      case 'explanation':
      case 'hint':
        return 'teacher';
      case 'code-help':
        return 'builder';
      case 'testing':
      case 'debugging':
        return 'tester';
      default:
        return 'director';
    }
  }

  // Execute task with specific agent
  private async executeWithAgent(agentType: AgentType, content: string): Promise<string> {
    const agent = this.agents.get(agentType);
    if (!agent) {
      return 'Agent not available.';
    }

    // Update agent status
    agent.status = 'thinking';
    agent.lastActivity = Date.now();

    try {
      // In production, this would call the AI backend
      // For now, return a placeholder response
      const response = await this.mockAgentResponse(agentType, content);

      agent.status = 'idle';
      return response;
    } catch (error) {
      agent.status = 'error';
      return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Mock agent responses for development
  private async mockAgentResponse(agentType: AgentType, content: string): Promise<string> {
    // Simulate thinking time
    await new Promise((resolve) => setTimeout(resolve, 500));

    switch (agentType) {
      case 'director':
        return `I understand you're asking about "${content}". Let me help you with that.`;

      case 'captain':
        return `*The mill creaks to life* Welcome to the Cognitive Mill! Let's explore how simple machines work.`;

      case 'teacher':
        return `Great question! Let me explain this concept step by step...`;

      case 'builder':
        return `I can help you write that code. Here's how we might approach it...`;

      case 'tester':
        return `Let me run some tests on that. Checking...`;

      default:
        return `Processing your request...`;
    }
  }

  // Execute a director command
  async executeCommand(command: DirectorCommand): Promise<TaskResult> {
    const taskId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      switch (command.type) {
        case 'start_module':
          this.currentModule = command.module;
          this.currentStage = 1;
          this.updateAgentContexts();
          return {
            taskId,
            success: true,
            result: { module: command.module, stage: 1 },
            duration: Date.now() - startTime,
          };

        case 'advance_stage':
          this.currentStage++;
          this.updateAgentContexts();
          return {
            taskId,
            success: true,
            result: { stage: this.currentStage },
            duration: Date.now() - startTime,
          };

        case 'provide_hint':
          const hint = await this.executeWithAgent('teacher', `Provide a level ${command.level} hint`);
          return {
            taskId,
            success: true,
            result: { hint },
            duration: Date.now() - startTime,
          };

        case 'delegate':
          const result = await this.executeWithAgent(command.agent, JSON.stringify(command.task));
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

  // Update all agent contexts
  private updateAgentContexts(): void {
    for (const agent of this.agents.values()) {
      agent.context.module = this.currentModule;
      agent.context.stage = this.currentStage;
    }
  }

  // Get agent status
  getAgentStatus(type: AgentType): AgentState | undefined {
    return this.agents.get(type);
  }

  // Get all agent statuses
  getAllAgentStatuses(): AgentState[] {
    return Array.from(this.agents.values());
  }

  // Get conversation history
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  // Clear conversation history
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  // Get current module
  getCurrentModule(): string {
    return this.currentModule;
  }

  // Get current stage
  getCurrentStage(): number {
    return this.currentStage;
  }
}
