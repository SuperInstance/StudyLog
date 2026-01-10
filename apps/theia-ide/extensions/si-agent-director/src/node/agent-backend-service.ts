/**
 * Agent Backend Service
 *
 * RPC service for managing agents and tracking progress.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { ProgressTracker } from './progress-tracker';

export const AGENT_SERVICE_PATH = '/services/agent';

export interface AgentConfig {
  name: string;
  type: 'slm' | 'director_agent' | 'orchestrator' | 'vector_swarm';
  model: string;
  personality?: Record<string, number>;
}

export interface AgentService {
  createAgent(config: AgentConfig): Promise<AgentInfo>;
  removeAgent(agentId: string): Promise<void>;
  restartAgent(agentId: string): Promise<void>;
  switchModel(agentId: string, model: string): Promise<void>;
  getAgents(): Promise<AgentInfo[]>;
  getProgress(): Promise<ProgressInfo>;
  completePuzzle(puzzleId: string): Promise<void>;
}

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  model?: string;
  tokensUsed: number;
  cost: number;
  mood: number;
}

export interface ProgressInfo {
  currentStage: number;
  completedPuzzles: string[];
  unlockedFeatures: string[];
}

@injectable()
export class AgentBackendService implements AgentService {
  @inject(ProgressTracker)
  protected readonly progress: ProgressTracker;

  async createAgent(config: AgentConfig): Promise<AgentInfo> {
    const id = `agent-${Date.now()}`;

    // Create agent based on type
    const agentInfo: AgentInfo = {
      id,
      name: config.name,
      type: config.type,
      status: 'idle',
      model: config.model,
      tokensUsed: 0,
      cost: 0,
      mood: 0,
    };

    // TODO: Actually spawn the agent process/container

    return agentInfo;
  }

  async removeAgent(agentId: string): Promise<void> {
    // TODO: Clean up agent resources
  }

  async restartAgent(agentId: string): Promise<void> {
    // TODO: Restart agent process
  }

  async switchModel(agentId: string, model: string): Promise<void> {
    // TODO: Switch agent to new model
  }

  async getAgents(): Promise<AgentInfo[]> {
    // TODO: Fetch from database/registry
    return [];
  }

  async getProgress(): Promise<ProgressInfo> {
    return this.progress.getProgress();
  }

  async completePuzzle(puzzleId: string): Promise<void> {
    await this.progress.completePuzzle(puzzleId);
  }

  dispose(): void {
    // Cleanup
  }
}
