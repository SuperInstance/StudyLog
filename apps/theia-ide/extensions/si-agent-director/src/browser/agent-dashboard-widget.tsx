/**
 * Agent Dashboard Widget
 *
 * Shows real-time agent status, model switching, cost tracking,
 * and progressive unlock UI.
 */

import * as React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { AgentDashboardFrontendService } from './agent-dashboard-frontend-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';

export interface AgentInfo {
  id: string;
  name: string;
  type: 'slm' | 'director_agent' | 'orchestrator' | 'vector_swarm';
  status: 'idle' | 'working' | 'error' | 'training';
  model?: string;
  currentTask?: string;
  tokensUsed: number;
  cost: number;
  mood: number; // -1 to 1, for biological agents
}

export interface StageInfo {
  id: number;
  name: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number; // 0-1
}

export interface DashboardState {
  agents: AgentInfo[];
  currentStage: number;
  stages: StageInfo[];
  totalCost: number;
  totalTokens: number;
  selectedAgent?: string;
}

@injectable()
export class AgentDashboardWidget extends ReactWidget {
  static readonly ID = 'si-agent-dashboard:widget';
  static readonly LABEL = 'Agent Dashboard';

  @inject(AgentDashboardFrontendService)
  protected readonly service: AgentDashboardFrontendService;

  protected state: DashboardState = {
    agents: [],
    currentStage: 1,
    stages: [],
    totalCost: 0,
    totalTokens: 0,
    selectedAgent: undefined,
  };

  private updateInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
    this.id = AgentDashboardWidget.ID;
    this.title.label = AgentDashboardWidget.LABEL;
    this.title.caption = 'AI Agent Dashboard';
    this.title.iconClass = 'fa fa-robot';
    this.addClass('si-agent-dashboard');
  }

  protected async onAfterAttach(msg: Message): Promise<void> {
    super.onAfterAttach(msg);

    // Load initial state
    const agents = await this.service.getAgents();
    const stages = await this.service.getStages();
    const { currentStage } = await this.service.getProgress();

    this.setState({ agents, stages, currentStage });

    // Set up periodic updates
    this.updateInterval = setInterval(() => this.updateState(), 2000);
  }

  protected async onBeforeDetach(msg: Message): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    super.onBeforeDetach(msg);
  }

  protected render(): React.ReactNode {
    const selectedAgent = this.state.agents.find((a) => a.id === this.state.selectedAgent);

    return (
      <div className="si-agent-dashboard-container">
        {/* Stage Progress */}
        <div className="stage-progress">
          <h3>Your Journey</h3>
          <div className="stages">
            {this.state.stages.map((stage) => (
              <div
                key={stage.id}
                className={`stage ${stage.unlocked ? 'unlocked' : 'locked'} ${stage.id === this.state.currentStage ? 'current' : ''}`}
                onClick={() => stage.unlocked && this.service.selectStage(stage.id)}
              >
                <div className="stage-icon">{this.getStageIcon(stage.name)}</div>
                <div className="stage-info">
                  <span className="stage-title">{stage.title}</span>
                  <span className="stage-description">{stage.description}</span>
                </div>
                {stage.progress > 0 && (
                  <div className="stage-progress-bar">
                    <div className="progress-fill" style={{ width: `${stage.progress * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <span className="stat-label">Active Agents</span>
            <span className="stat-value">{this.state.agents.filter((a) => a.status !== 'idle').length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Tokens</span>
            <span className="stat-value">{this.state.totalTokens.toLocaleString()}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Cost</span>
            <span className="stat-value">${this.state.totalCost.toFixed(4)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Current Stage</span>
            <span className="stat-value">Stage {this.state.currentStage}</span>
          </div>
        </div>

        {/* Agent List */}
        <div className="agent-list">
          <h3>Active Agents</h3>
          <div className="agents">
            {this.state.agents.map((agent) => (
              <div
                key={agent.id}
                className={`agent-card ${agent.status} ${this.state.selectedAgent === agent.id ? 'selected' : ''}`}
                onClick={() => this.setState({ selectedAgent: agent.id })}
              >
                <div className="agent-header">
                  <span className="agent-name">{agent.name}</span>
                  <span className={`agent-status ${agent.status}`}>{agent.status}</span>
                </div>
                <div className="agent-type">{this.getAgentTypeLabel(agent.type)}</div>
                {agent.model && <div className="agent-model">{agent.model}</div>}
                {agent.currentTask && <div className="agent-task">{agent.currentTask}</div>}
                <div className="agent-stats">
                  <span>{agent.tokensUsed.toLocaleString()} tokens</span>
                  <span>${agent.cost.toFixed(4)}</span>
                </div>
                {/* Biological mood indicator */}
                {agent.mood !== undefined && (
                  <div className="agent-mood">
                    <div className="mood-bar">
                      <div
                        className="mood-fill"
                        style={{
                          left: agent.mood < 0 ? `${50 + agent.mood * 50}%` : '50%',
                          right: agent.mood > 0 ? `${50 - agent.mood * 50}%` : '50%',
                          backgroundColor: agent.mood > 0 ? '#4ade80' : '#f87171',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Agent Button */}
          <button className="add-agent-btn" onClick={() => this.showAddAgentDialog()}>
            + Add Agent
          </button>
        </div>

        {/* Selected Agent Details */}
        {selectedAgent && (
          <div className="agent-details">
            <h3>{selectedAgent.name} Details</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Type</label>
                <span>{this.getAgentTypeLabel(selectedAgent.type)}</span>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <span>{selectedAgent.status}</span>
              </div>
              {selectedAgent.model && (
                <div className="detail-item">
                  <label>Model</label>
                  <span>{selectedAgent.model}</span>
                </div>
              )}
              <div className="detail-item">
                <label>Tokens Used</label>
                <span>{selectedAgent.tokensUsed.toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Cost</label>
                <span>${selectedAgent.cost.toFixed(4)}</span>
              </div>
              {selectedAgent.mood !== undefined && (
                <div className="detail-item">
                  <label>Mood</label>
                  <span>{selectedAgent.mood > 0 ? 'Happy' : selectedAgent.mood < 0 ? 'Unhappy' : 'Neutral'}</span>
                </div>
              )}
            </div>

            {/* Agent Actions */}
            <div className="agent-actions">
              <button onClick={() => this.service.switchModel(selectedAgent.id)}>Switch Model</button>
              <button onClick={() => this.service.restartAgent(selectedAgent.id)}>Restart</button>
              <button onClick={() => this.service.removeAgent(selectedAgent.id)}>Remove</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  private getStageIcon(name: string): string {
    const icons: Record<string, string> = {
      cognitive_mill: '⚙️',
      intelligence_ranch: '🐕',
      sitka_sound: '🚤',
      digital_twins: '🔬',
    };
    return icons[name] || '📦';
  }

  private getAgentTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      slm: 'Small Language Model (Deckhand)',
      director_agent: 'Director Agent (Captain)',
      orchestrator: 'Orchestrator (Whale)',
      vector_swarm: 'Vector Swarm (Herring)',
    };
    return labels[type] || type;
  }

  private async updateState(): Promise<void> {
    const agents = await this.service.getAgents();
    const stats = await this.service.getStats();

    this.setState({
      agents,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
    });
  }

  private showAddAgentDialog(): void {
    // TODO: Implement dialog
    console.log('[AgentDashboard] Show add agent dialog');
  }

  private setState(partial: Partial<DashboardState>): void {
    this.state = { ...this.state, ...partial };
    this.update();
  }
}
