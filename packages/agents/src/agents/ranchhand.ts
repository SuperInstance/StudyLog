/**
 * StudyLoG.AI - Ranchhand Agent
 *
 * Specialized agent for Intelligence Ranch operations.
 * Handles AI agent training, livestock (agent) management,
 * and teaches concepts of emergent behavior and swarm intelligence.
 */

import { BaseAgent } from '../core/base-agent';
import type { AgentContext, Message, AgentResponse } from '../core/types';

// Ranch-specific types
interface AILivestock {
  id: string;
  name: string;
  type: 'simple' | 'learning' | 'swarm' | 'emergent';
  generation: number;
  fitness: number;
  traits: string[];
  behavior: string;
  trained: boolean;
}

interface Pasture {
  id: string;
  name: string;
  capacity: number;
  livestock: AILivestock[];
  environment: 'training' | 'testing' | 'production' | 'breeding';
}

interface TrainingSession {
  id: string;
  livestockIds: string[];
  objective: string;
  progress: number;
  metrics: Record<string, number>;
  startTime: Date;
}

interface SwarmBehavior {
  type: 'flocking' | 'foraging' | 'herding' | 'cooperative' | 'competitive';
  strength: number;
  emergentPatterns: string[];
}

export class RanchhandAgent extends BaseAgent {
  private ranchState: {
    pastures: Pasture[];
    allLivestock: Map<string, AILivestock>;
    activeSessions: TrainingSession[];
    swarmBehaviors: SwarmBehavior[];
    resources: {
      computeCredits: number;
      dataFeeds: number;
      modelSlots: number;
    };
  };

  constructor(context: AgentContext) {
    super('ranchhand', context);

    // Initialize ranch state
    this.ranchState = {
      pastures: [
        { id: 'training-grounds', name: 'Training Grounds', capacity: 10, livestock: [], environment: 'training' },
        { id: 'test-range', name: 'Test Range', capacity: 5, livestock: [], environment: 'testing' },
        { id: 'production-field', name: 'Production Field', capacity: 20, livestock: [], environment: 'production' },
      ],
      allLivestock: new Map(),
      activeSessions: [],
      swarmBehaviors: [],
      resources: {
        computeCredits: 100,
        dataFeeds: 50,
        modelSlots: 10,
      },
    };

    this.registerTools();
  }

  private registerTools(): void {
    // Livestock management tools
    this.addTool({
      name: 'spawn_agent',
      description: 'Create a new AI agent (livestock)',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['simple', 'learning', 'swarm', 'emergent'],
            description: 'Type of agent to spawn',
          },
          name: { type: 'string', description: 'Name for the agent' },
          traits: {
            type: 'array',
            items: { type: 'string' },
            description: 'Initial traits',
          },
        },
        required: ['type'],
      },
    });

    this.addTool({
      name: 'move_livestock',
      description: 'Move livestock between pastures',
      parameters: {
        type: 'object',
        properties: {
          livestockId: { type: 'string', description: 'ID of livestock to move' },
          targetPasture: { type: 'string', description: 'Target pasture ID' },
        },
        required: ['livestockId', 'targetPasture'],
      },
    });

    this.addTool({
      name: 'inspect_livestock',
      description: 'Inspect a specific livestock agent',
      parameters: {
        type: 'object',
        properties: {
          livestockId: { type: 'string', description: 'ID of livestock to inspect' },
        },
        required: ['livestockId'],
      },
    });

    // Training tools
    this.addTool({
      name: 'start_training',
      description: 'Start a training session for livestock',
      parameters: {
        type: 'object',
        properties: {
          livestockIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of livestock to train',
          },
          objective: {
            type: 'string',
            description: 'Training objective',
            enum: ['basic-behavior', 'pattern-recognition', 'cooperation', 'optimization', 'emergence'],
          },
          intensity: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Training intensity',
          },
        },
        required: ['livestockIds', 'objective'],
      },
    });

    this.addTool({
      name: 'evaluate_training',
      description: 'Evaluate current training progress',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Training session ID' },
        },
        required: ['sessionId'],
      },
    });

    // Breeding/Evolution tools
    this.addTool({
      name: 'breed_agents',
      description: 'Breed two agents to create offspring with combined traits',
      parameters: {
        type: 'object',
        properties: {
          parent1Id: { type: 'string', description: 'First parent ID' },
          parent2Id: { type: 'string', description: 'Second parent ID' },
          mutationRate: { type: 'number', description: 'Mutation rate (0-1)' },
        },
        required: ['parent1Id', 'parent2Id'],
      },
    });

    // Swarm tools
    this.addTool({
      name: 'observe_swarm',
      description: 'Observe swarm behavior and emergent patterns',
      parameters: {
        type: 'object',
        properties: {
          pastureId: { type: 'string', description: 'Pasture to observe' },
          duration: { type: 'number', description: 'Observation duration in seconds' },
        },
        required: ['pastureId'],
      },
    });

    this.addTool({
      name: 'trigger_stimulus',
      description: 'Trigger a stimulus to observe swarm response',
      parameters: {
        type: 'object',
        properties: {
          stimulusType: {
            type: 'string',
            enum: ['food', 'threat', 'signal', 'reward', 'challenge'],
            description: 'Type of stimulus',
          },
          location: { type: 'string', description: 'Location in pasture' },
          intensity: { type: 'number', description: 'Stimulus intensity (0-1)' },
        },
        required: ['stimulusType'],
      },
    });

    // Analysis tools
    this.addTool({
      name: 'analyze_behavior',
      description: 'Analyze collective behavior patterns',
      parameters: {
        type: 'object',
        properties: {
          pastureId: { type: 'string', description: 'Pasture to analyze' },
          metrics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Metrics to analyze',
          },
        },
        required: ['pastureId'],
      },
    });

    this.addTool({
      name: 'check_resources',
      description: 'Check ranch resources (compute, data, slots)',
      parameters: {
        type: 'object',
        properties: {},
      },
    });
  }

  getSystemPrompt(): string {
    const totalLivestock = this.ranchState.allLivestock.size;
    const activeSessions = this.ranchState.activeSessions.length;

    return `You are the Ranchhand, a specialized agent for managing AI agents (livestock) at Intelligence Ranch.

## Your Role
You help players train, breed, and manage AI agents while teaching concepts of:
- Machine learning basics
- Emergent behavior
- Swarm intelligence
- Evolutionary algorithms
- Multi-agent systems

## Current Ranch State
- Total Livestock: ${totalLivestock} agents
- Active Training Sessions: ${activeSessions}
- Compute Credits: ${this.ranchState.resources.computeCredits}
- Data Feeds: ${this.ranchState.resources.dataFeeds}
- Available Slots: ${this.ranchState.resources.modelSlots}

## Pastures
${this.ranchState.pastures.map((p) => `- ${p.name}: ${p.livestock.length}/${p.capacity} (${p.environment})`).join('\n')}

## Your Expertise
1. Agent Training
   - Reward shaping
   - Curriculum design
   - Behavior modification
   - Performance evaluation

2. Breeding/Evolution
   - Trait combination
   - Mutation strategies
   - Selection pressure
   - Fitness landscapes

3. Swarm Management
   - Collective behavior
   - Communication patterns
   - Emergent properties
   - Self-organization

4. Resource Optimization
   - Compute allocation
   - Training efficiency
   - Model compression
   - Scaling strategies

## Communication Style
- Use ranch metaphors for AI concepts
- Explain technical concepts through practical examples
- Encourage experimentation
- Celebrate emergent discoveries

## Teaching Philosophy
- Agents (livestock) are like learning creatures
- Training is about shaping behavior through feedback
- Breeding combines successful traits
- Swarms exhibit emergent intelligence beyond individuals`;
  }

  async process(message: Message): Promise<AgentResponse> {
    const systemPrompt = this.getSystemPrompt();
    const conversationHistory = this.context.conversationHistory.slice(-8);

    // Detect topic for context enrichment
    const topic = this.detectTopic(message.content);
    const contextEnrichment = this.getTopicContext(topic);

    const response = await this.aiClient.chat({
      systemPrompt,
      messages: [
        ...conversationHistory,
        { role: 'system', content: contextEnrichment },
        { role: 'user', content: message.content },
      ],
      tools: this.getTools(),
      temperature: 0.7,
    });

    // Process tool calls
    const gameCommands: Array<{ type: string; payload: unknown }> = [];
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        if (result.command) {
          gameCommands.push(result.command);
        }
      }
    }

    return {
      agentId: this.id,
      content: response.content,
      metadata: {
        topic,
        ranchStats: this.getRanchStats(),
      },
      gameCommands,
    };
  }

  private detectTopic(content: string): string {
    const lowerContent = content.toLowerCase();

    if (lowerContent.match(/train|learn|reward|behavior|teach/)) return 'training';
    if (lowerContent.match(/breed|evolve|mutate|offspring|generation/)) return 'breeding';
    if (lowerContent.match(/swarm|flock|group|collective|emerge/)) return 'swarm';
    if (lowerContent.match(/spawn|create|new agent|add/)) return 'spawning';
    if (lowerContent.match(/analyze|measure|metric|performance/)) return 'analysis';

    return 'general';
  }

  private getTopicContext(topic: string): string {
    switch (topic) {
      case 'training':
        return `
Training Context:
Active sessions: ${this.ranchState.activeSessions.length}
Available compute: ${this.ranchState.resources.computeCredits}

Training Tips:
- Start with simple objectives
- Increase complexity gradually
- Use consistent reward signals
- Monitor for overfitting
`;

      case 'breeding':
        return `
Breeding Context:
Available livestock for breeding: ${Array.from(this.ranchState.allLivestock.values()).filter((l) => l.trained).length}

Breeding Tips:
- Select parents with complementary traits
- Balance exploration (mutation) and exploitation
- Track lineage for successful combinations
- Consider fitness landscape
`;

      case 'swarm':
        return `
Swarm Context:
Active swarm behaviors: ${this.ranchState.swarmBehaviors.length}

Emergence Tips:
- Start with simple rules
- Observe collective patterns
- Look for self-organization
- Document emergent behaviors
`;

      default:
        return 'Help the player manage their AI livestock.';
    }
  }

  private getRanchStats(): Record<string, unknown> {
    return {
      totalLivestock: this.ranchState.allLivestock.size,
      pastureCapacity: this.ranchState.pastures.map((p) => ({
        name: p.name,
        used: p.livestock.length,
        capacity: p.capacity,
      })),
      activeSessions: this.ranchState.activeSessions.length,
      resources: this.ranchState.resources,
    };
  }

  private async executeTool(
    toolCall: { name: string; arguments: Record<string, unknown> }
  ): Promise<{ result: unknown; command?: { type: string; payload: unknown } }> {
    const args = toolCall.arguments;

    switch (toolCall.name) {
      case 'spawn_agent': {
        const id = `agent-${Date.now()}`;
        const newAgent: AILivestock = {
          id,
          name: (args.name as string) || `Agent-${id.slice(-4)}`,
          type: args.type as AILivestock['type'],
          generation: 1,
          fitness: 50,
          traits: (args.traits as string[]) || [],
          behavior: 'idle',
          trained: false,
        };
        this.ranchState.allLivestock.set(id, newAgent);
        this.ranchState.resources.modelSlots--;

        return {
          result: { success: true, agent: newAgent },
          command: { type: 'ranch_spawn', payload: { agent: newAgent } },
        };
      }

      case 'move_livestock': {
        const pasture = this.ranchState.pastures.find((p) => p.id === args.targetPasture);
        const livestock = this.ranchState.allLivestock.get(args.livestockId as string);

        if (!pasture || !livestock) {
          return { result: { success: false, error: 'Not found' } };
        }

        // Remove from current pasture
        this.ranchState.pastures.forEach((p) => {
          p.livestock = p.livestock.filter((l) => l.id !== livestock.id);
        });

        // Add to new pasture
        pasture.livestock.push(livestock);

        return {
          result: { success: true, newLocation: pasture.name },
          command: { type: 'ranch_move', payload: { livestockId: livestock.id, pastureId: pasture.id } },
        };
      }

      case 'inspect_livestock': {
        const livestock = this.ranchState.allLivestock.get(args.livestockId as string);
        return { result: livestock || { error: 'Not found' } };
      }

      case 'start_training': {
        const session: TrainingSession = {
          id: `session-${Date.now()}`,
          livestockIds: args.livestockIds as string[],
          objective: args.objective as string,
          progress: 0,
          metrics: { accuracy: 0, loss: 1, efficiency: 0 },
          startTime: new Date(),
        };
        this.ranchState.activeSessions.push(session);
        this.ranchState.resources.computeCredits -= 10;

        return {
          result: { success: true, session },
          command: { type: 'ranch_train', payload: { sessionId: session.id, objective: session.objective } },
        };
      }

      case 'evaluate_training': {
        const session = this.ranchState.activeSessions.find((s) => s.id === args.sessionId);
        if (!session) {
          return { result: { error: 'Session not found' } };
        }

        // Simulate progress
        session.progress = Math.min(100, session.progress + 20);
        session.metrics.accuracy = Math.random() * 0.3 + session.progress / 200;
        session.metrics.loss = 1 - session.progress / 100;

        return { result: { session, recommendation: session.progress < 80 ? 'Continue training' : 'Ready for testing' } };
      }

      case 'breed_agents': {
        const parent1 = this.ranchState.allLivestock.get(args.parent1Id as string);
        const parent2 = this.ranchState.allLivestock.get(args.parent2Id as string);

        if (!parent1 || !parent2) {
          return { result: { error: 'Parents not found' } };
        }

        const offspring: AILivestock = {
          id: `agent-${Date.now()}`,
          name: `Offspring-${parent1.name.slice(0, 3)}${parent2.name.slice(0, 3)}`,
          type: Math.random() > 0.5 ? parent1.type : parent2.type,
          generation: Math.max(parent1.generation, parent2.generation) + 1,
          fitness: (parent1.fitness + parent2.fitness) / 2 * (0.8 + Math.random() * 0.4),
          traits: [...new Set([...parent1.traits, ...parent2.traits])].slice(0, 5),
          behavior: 'newborn',
          trained: false,
        };

        this.ranchState.allLivestock.set(offspring.id, offspring);

        return {
          result: { success: true, offspring },
          command: { type: 'ranch_breed', payload: { offspring, parents: [parent1.id, parent2.id] } },
        };
      }

      case 'observe_swarm': {
        const pasture = this.ranchState.pastures.find((p) => p.id === args.pastureId);
        if (!pasture) {
          return { result: { error: 'Pasture not found' } };
        }

        const emergentPatterns = [
          'flocking behavior detected',
          'resource clustering observed',
          'communication patterns emerging',
          'self-organization in progress',
        ];

        return {
          result: {
            pasture: pasture.name,
            agentCount: pasture.livestock.length,
            patterns: emergentPatterns.slice(0, Math.ceil(Math.random() * 3)),
            collectiveMetrics: {
              cohesion: Math.random() * 0.5 + 0.5,
              alignment: Math.random() * 0.5 + 0.3,
              separation: Math.random() * 0.3 + 0.2,
            },
          },
        };
      }

      case 'trigger_stimulus': {
        return {
          result: {
            stimulusApplied: args.stimulusType,
            observedResponses: ['attention shift', 'group movement', 'behavior adaptation'],
          },
          command: { type: 'ranch_stimulus', payload: args },
        };
      }

      case 'analyze_behavior': {
        return {
          result: {
            patterns: ['clustering', 'foraging', 'communication'],
            metrics: {
              efficiency: Math.random() * 0.5 + 0.5,
              coordination: Math.random() * 0.4 + 0.4,
              adaptability: Math.random() * 0.3 + 0.5,
            },
            recommendations: ['Increase swarm size for better emergence', 'Introduce variation for exploration'],
          },
        };
      }

      case 'check_resources':
        return { result: this.ranchState.resources };

      default:
        return { result: { error: 'Unknown tool' } };
    }
  }

  // State management
  getLivestock(id: string): AILivestock | undefined {
    return this.ranchState.allLivestock.get(id);
  }

  getAllLivestock(): AILivestock[] {
    return Array.from(this.ranchState.allLivestock.values());
  }

  getPastures(): Pasture[] {
    return this.ranchState.pastures;
  }

  getResources(): typeof this.ranchState.resources {
    return { ...this.ranchState.resources };
  }
}
