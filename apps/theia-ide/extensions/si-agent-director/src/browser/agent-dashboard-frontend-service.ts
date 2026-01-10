/**
 * Agent Dashboard Frontend Service
 *
 * Frontend service for agent management, progress tracking,
 * and stage unlocking.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';

export interface AgentInfo {
  id: string;
  name: string;
  type: 'slm' | 'director_agent' | 'orchestrator' | 'vector_swarm';
  status: 'idle' | 'working' | 'error' | 'training';
  model?: string;
  currentTask?: string;
  tokensUsed: number;
  cost: number;
  mood: number;
}

export interface StageInfo {
  id: number;
  name: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
}

export interface DashboardStats {
  totalCost: number;
  totalTokens: number;
  activeAgents: number;
}

@injectable()
export class AgentDashboardFrontendService implements FrontendApplicationContribution {
  @inject(ILogger)
  protected readonly logger: ILogger;

  private agents: AgentInfo[] = [
    {
      id: 'captain-001',
      name: 'Captain',
      type: 'director_agent',
      status: 'idle',
      model: 'llama-3.1-70b',
      tokensUsed: 12500,
      cost: 0.025,
      mood: 0.5,
    },
    {
      id: 'deckhand-001',
      name: 'Deckhand',
      type: 'slm',
      status: 'working',
      model: 'nemotron-mini:4b',
      currentTask: 'Processing fish catch data',
      tokensUsed: 3500,
      cost: 0.001,
      mood: 0.2,
    },
    {
      id: 'herring-swarm',
      name: 'Herring School',
      type: 'vector_swarm',
      status: 'idle',
      tokensUsed: 0,
      cost: 0,
      mood: 0,
    },
  ];

  private stages: StageInfo[] = [
    {
      id: 1,
      name: 'cognitive_mill',
      title: 'Cognitive Mill',
      description: 'Learn how AI models work through the metaphor of a waterwheel',
      unlocked: true,
      progress: 0.3,
    },
    {
      id: 2,
      name: 'intelligence_ranch',
      title: 'Intelligence Ranch',
      description: 'Train and breed AI agents like working dogs',
      unlocked: false,
      progress: 0,
    },
    {
      id: 3,
      name: 'sitka_sound',
      title: 'Sitka Sound',
      description: 'Explore multi-agent systems through fishing fleet simulation',
      unlocked: false,
      progress: 0,
    },
    {
      id: 4,
      name: 'digital_twins',
      title: 'Digital Twins',
      description: 'Deploy AI to real hardware with NVIDIA acceleration',
      unlocked: false,
      progress: 0,
    },
  ];

  private currentStage = 1;
  private stats: DashboardStats = {
    totalCost: 0.026,
    totalTokens: 16000,
    activeAgents: 1,
  };

  async getAgents(): Promise<AgentInfo[]> {
    return [...this.agents];
  }

  async getStages(): Promise<StageInfo[]> {
    return [...this.stages];
  }

  async getProgress(): Promise<{ currentStage: number; completedPuzzles: string[] }> {
    return {
      currentStage: this.currentStage,
      completedPuzzles: [],
    };
  }

  async getStats(): Promise<DashboardStats> {
    return { ...this.stats };
  }

  async switchModel(agentId: string): Promise<void> {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      this.logger.info(`Switching model for ${agent.name}`);
      // Would open model selection dialog
    }
  }

  async restartAgent(agentId: string): Promise<void> {
    const agent = this.agents.find((a) => a.id === agentId);
    if (agent) {
      this.logger.info(`Restarting agent ${agent.name}`);
      agent.status = 'idle';
      agent.mood = 0;
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    const index = this.agents.findIndex((a) => a.id === agentId);
    if (index >= 0) {
      this.logger.info(`Removing agent ${this.agents[index].name}`);
      this.agents.splice(index, 1);
    }
  }

  async selectStage(stageId: number): Promise<void> {
    this.currentStage = stageId;
    this.logger.info(`Selected stage ${stageId}`);
  }

  /**
   * Create a new agent with the specified configuration.
   *
   * UI Flow:
   * 1. User clicks "Add Agent" button in dashboard
   * 2. Dialog opens with form fields (name, type, model)
   * 3. User fills form and clicks Create
   * 4. This method validates and creates the agent
   * 5. Dashboard refreshes to show new agent
   *
   * Validation:
   * - Name must be unique (no duplicates)
   * - Name and type are required
   * - Model defaults based on agent type if not specified
   *
   * Future enhancements:
   * - Agent configuration (personality, temperature, max_tokens)
   * - Permission system (which users can modify which agents)
   * - Agent templates (presets for common use cases)
   * - Bulk agent creation
   *
   * @param config - Agent configuration including name, type, and model
   * @returns The newly created agent info
   * @throws Error if validation fails (duplicate name, missing required fields)
   */
  async createAgent(config: {
    name: string;
    type: 'slm' | 'director_agent' | 'orchestrator' | 'vector_swarm';
    model?: string;
  }): Promise<AgentInfo> {
    // Validation: Name is required
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    // Validation: Name must be unique
    const nameExists = this.agents.some(
      (a) => a.name.toLowerCase() === config.name.toLowerCase()
    );
    if (nameExists) {
      throw new Error(`An agent named "${config.name}" already exists`);
    }

    // Validation: Type is required
    if (!config.type) {
      throw new Error('Agent type is required');
    }

    // Default model based on type if not specified
    const defaultModels: Record<string, string> = {
      slm: 'nemotron-mini:4b',
      director_agent: 'llama-3.1-70b',
      orchestrator: 'claude-opus-4-5',
      vector_swarm: 'text-embedding-3-small',
    };

    const model = config.model || defaultModels[config.type] || 'unknown';

    // Generate unique ID
    const id = `${config.type.toLowerCase().replace('_', '-')}-${Date.now()}`;

    // Create new agent
    const newAgent: AgentInfo = {
      id,
      name: config.name.trim(),
      type: config.type,
      status: 'idle',
      model,
      tokensUsed: 0,
      cost: 0,
      mood: 0,
    };

    this.agents.push(newAgent);
    this.logger.info(`Created new agent: ${newAgent.name} (${newAgent.id})`);

    return newAgent;
  }

  onStart(): void {
    this.logger.info('Starting Agent Dashboard Frontend Service');
  }
}
