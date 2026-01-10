/**
 * StudyLoG.AI - Director Agent
 *
 * Top-level orchestrator that routes tasks to specialist agents
 * and manages the overall learning experience.
 */

import { BaseAgent } from '../core/base-agent';
import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  ToolCall,
  ToolDefinition,
  AgentId,
} from '../core/types';
import { AIClient } from '../core/ai-client';
import { DIRECTOR_SYSTEM_PROMPT, DIRECTOR_ROUTING_PROMPT } from '../prompts/director';

// Director tools
const DIRECTOR_TOOLS: ToolDefinition[] = [
  {
    name: 'delegate_to_agent',
    description: 'Delegate a task to a specialist agent',
    parameters: {
      type: 'object',
      properties: {
        agent: {
          type: 'string',
          description: 'The agent to delegate to',
          enum: ['captain', 'teacher', 'builder', 'tester'],
        },
        task: {
          type: 'string',
          description: 'Description of the task to delegate',
        },
        context: {
          type: 'string',
          description: 'Additional context for the agent',
        },
      },
      required: ['agent', 'task'],
    },
  },
  {
    name: 'get_student_progress',
    description: 'Get the current student progress and achievements',
    parameters: {
      type: 'object',
      properties: {
        module: {
          type: 'string',
          description: 'Optional: specific module to check',
          enum: ['cognitive-mill', 'sitka-sound', 'intelligence-ranch'],
        },
      },
    },
  },
  {
    name: 'advance_stage',
    description: 'Advance the student to the next stage in the current module',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why the student is ready to advance',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'unlock_phase',
    description: 'Unlock a new learning phase for the student',
    parameters: {
      type: 'object',
      properties: {
        phase: {
          type: 'string',
          description: 'The phase to unlock',
          enum: ['reader', 'tweaker', 'creator', 'mentor'],
        },
        reason: {
          type: 'string',
          description: 'Why the student earned this phase',
        },
      },
      required: ['phase', 'reason'],
    },
  },
];

export class DirectorAgent extends BaseAgent {
  private pendingDelegation: { agent: AgentId; task: string } | null = null;

  constructor(aiClient: AIClient) {
    const config: AgentConfig = {
      id: 'director',
      name: 'Director',
      description: 'Top-level orchestrator that manages the learning experience',
      systemPrompt: DIRECTOR_SYSTEM_PROMPT,
      tools: DIRECTOR_TOOLS,
      temperature: 0.7,
      maxTokens: 1024,
    };
    super(config, aiClient);
  }

  // Override to add routing logic
  async process(
    userMessage: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    // First, determine if we should route to another agent
    const targetAgent = await this.routeMessage(userMessage, context);

    if (targetAgent && targetAgent !== 'director') {
      // Delegate to the appropriate agent
      const response = await super.process(userMessage, context);
      response.delegateTo = targetAgent as AgentId;
      return response;
    }

    // Handle directly
    return super.process(userMessage, context);
  }

  // Route message to appropriate agent
  private async routeMessage(
    message: string,
    context: AgentContext
  ): Promise<string | null> {
    // Quick keyword-based routing for common patterns
    const quickRoute = this.quickRoute(message);
    if (quickRoute) {
      return quickRoute;
    }

    // Use AI for complex routing decisions
    try {
      const routingPrompt = `${DIRECTOR_ROUTING_PROMPT}

User message: "${message}"
Current module: ${context.module}
Current stage: ${context.stage}
Student phase: ${context.phase}`;

      const response = await this.aiClient.complete(routingPrompt, 50);
      const agent = response.trim().toUpperCase();

      if (['DIRECTOR', 'CAPTAIN', 'TEACHER', 'BUILDER', 'TESTER'].includes(agent)) {
        return agent.toLowerCase();
      }
    } catch (error) {
      console.error('Routing error:', error);
    }

    return 'director';
  }

  // Quick keyword-based routing
  private quickRoute(message: string): string | null {
    const lower = message.toLowerCase();

    // Game/simulation related
    if (
      lower.match(/\b(start|play|begin|launch|open)\b.*\b(game|module|level|stage|simulation)\b/) ||
      lower.match(/\b(pause|resume|stop|restart)\b/) ||
      lower.includes('what happens') ||
      lower.includes('show me')
    ) {
      return 'captain';
    }

    // Explanations and learning
    if (
      lower.match(/\b(explain|what is|how does|why does|tell me about)\b/) ||
      lower.match(/\b(understand|learn|concept|theory)\b/) ||
      lower.includes('hint') ||
      lower.includes('help me understand')
    ) {
      return 'teacher';
    }

    // Code-related
    if (
      lower.match(/\b(code|function|class|variable|implement|write)\b/) ||
      lower.match(/\b(syntax|programming|algorithm)\b/) ||
      lower.includes('how do i code')
    ) {
      return 'builder';
    }

    // Testing and debugging
    if (
      lower.match(/\b(test|debug|error|bug|fix|broken)\b/) ||
      lower.match(/\b(doesn't work|not working|wrong|fail)\b/) ||
      lower.includes('check my')
    ) {
      return 'tester';
    }

    return null;
  }

  // Execute director-specific tools
  protected async executeTool(
    call: ToolCall,
    context: AgentContext
  ): Promise<unknown> {
    switch (call.name) {
      case 'delegate_to_agent':
        return this.handleDelegation(call.arguments as {
          agent: string;
          task: string;
          context?: string;
        });

      case 'get_student_progress':
        return this.getStudentProgress(
          context,
          call.arguments.module as string | undefined
        );

      case 'advance_stage':
        return this.advanceStage(
          context,
          call.arguments.reason as string
        );

      case 'unlock_phase':
        return this.unlockPhase(
          context,
          call.arguments.phase as string,
          call.arguments.reason as string
        );

      default:
        throw new Error(`Unknown tool: ${call.name}`);
    }
  }

  private handleDelegation(args: {
    agent: string;
    task: string;
    context?: string;
  }): { delegated: boolean; agent: string; task: string } {
    this.pendingDelegation = {
      agent: args.agent as AgentId,
      task: args.task,
    };

    this.emit({
      type: 'delegation',
      from: 'director',
      to: args.agent as AgentId,
      task: args.task,
    });

    return {
      delegated: true,
      agent: args.agent,
      task: args.task,
    };
  }

  private getStudentProgress(
    context: AgentContext,
    module?: string
  ): {
    module: string;
    stage: number;
    phase: string;
    skills: Record<string, number>;
  } {
    return {
      module: module || context.module,
      stage: context.stage,
      phase: context.phase,
      skills: context.student?.skillLevels || {},
    };
  }

  private advanceStage(
    context: AgentContext,
    reason: string
  ): { success: boolean; newStage: number; message: string } {
    const newStage = context.stage + 1;
    // In real implementation, this would update the backend
    return {
      success: true,
      newStage,
      message: `Advanced to stage ${newStage}: ${reason}`,
    };
  }

  private unlockPhase(
    context: AgentContext,
    phase: string,
    reason: string
  ): { success: boolean; phase: string; message: string } {
    // In real implementation, this would update the backend
    return {
      success: true,
      phase,
      message: `Unlocked ${phase} phase: ${reason}`,
    };
  }

  // Get pending delegation
  getPendingDelegation(): { agent: AgentId; task: string } | null {
    const delegation = this.pendingDelegation;
    this.pendingDelegation = null;
    return delegation;
  }
}
