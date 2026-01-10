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

  onStart(): void {
    this.logger.info('Starting Agent Dashboard Frontend Service');
  }
}
