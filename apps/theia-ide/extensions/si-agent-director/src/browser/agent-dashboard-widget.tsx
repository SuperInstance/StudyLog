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
import { MessageService } from '@theia/core/lib/common/message-service';

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
  showDialog: boolean;
  dialogError?: string;
}

/**
 * Agent type options for the creation form
 */
const AGENT_TYPES = [
  { value: 'slm', label: 'Small Language Model (Deckhand)', defaultModel: 'nemotron-mini:4b' },
  { value: 'director_agent', label: 'Director Agent (Captain)', defaultModel: 'llama-3.1-70b' },
  { value: 'orchestrator', label: 'Orchestrator (Whale)', defaultModel: 'claude-opus-4-5' },
  { value: 'vector_swarm', label: 'Vector Swarm (Herring)', defaultModel: 'text-embedding-3-small' },
] as const;

/**
 * Available model options for each agent type
 */
const MODEL_OPTIONS = [
  'nemotron-mini:4b',
  'llama-3.1-8b',
  'llama-3.1-70b',
  'claude-haiku-4-5',
  'claude-sonnet-4-5',
  'claude-opus-4-5',
  'gpt-4o-mini',
  'gpt-4o',
  'text-embedding-3-small',
  'text-embedding-3-large',
] as const;

@injectable()
export class AgentDashboardWidget extends ReactWidget {
  static readonly ID = 'si-agent-dashboard:widget';
  static readonly LABEL = 'Agent Dashboard';

  @inject(AgentDashboardFrontendService)
  protected readonly service: AgentDashboardFrontendService;

  @inject(MessageService)
  protected readonly messageService: MessageService;

  /**
   * Dialog state for the Add Agent form
   * These are separate from dashboard state as they're only used during dialog interaction
   */
  private dialogName = '';
  private dialogType: AgentInfo['type'] = 'slm';
  private dialogModel = '';

  protected state: DashboardState = {
    agents: [],
    currentStage: 1,
    stages: [],
    totalCost: 0,
    totalTokens: 0,
    selectedAgent: undefined,
    showDialog: false,
    dialogError: undefined,
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

        {/* Add Agent Dialog Overlay */}
        {this.state.showDialog && this.renderAddAgentDialog()}

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

  /**
   * Show the Add Agent dialog.
   *
   * UI Flow:
   * 1. User clicks "Add Agent" button
   * 2. Dialog opens with empty form
   * 3. User fills in agent details
   * 4. User clicks Create or Cancel
   *
   * Future enhancements:
   * - Agent templates/presets dropdown
   * - Import from file/URL
   * - Clone existing agent
   */
  private showAddAgentDialog(): void {
    // Reset dialog state
    this.dialogName = '';
    this.dialogType = 'slm';
    this.dialogModel = '';
    this.setState({ showDialog: true, dialogError: undefined });
  }

  /**
   * Hide the Add Agent dialog.
   */
  private hideAddAgentDialog(): void {
    this.setState({ showDialog: false, dialogError: undefined });
  }

  /**
   * Handle form submission for creating a new agent.
   *
   * Flow:
   * 1. Validate form inputs
   * 2. Call service.createAgent()
   * 3. On success: show success message, refresh agent list, close dialog
   * 4. On error: display error in dialog
   */
  private async handleCreateAgent(): Promise<void> {
    // Client-side validation
    if (!this.dialogName.trim()) {
      this.setState({ dialogError: 'Agent name is required' });
      return;
    }

    // Check for duplicate names
    const nameExists = this.state.agents.some(
      (a) => a.name.toLowerCase() === this.dialogName.toLowerCase()
    );
    if (nameExists) {
      this.setState({ dialogError: `An agent named "${this.dialogName}" already exists` });
      return;
    }

    try {
      // Call service to create the agent
      await this.service.createAgent({
        name: this.dialogName,
        type: this.dialogType,
        model: this.dialogModel || undefined,
      });

      // Show success feedback
      this.messageService.info(`Agent "${this.dialogName}" created successfully`);

      // Refresh agent list
      const agents = await this.service.getAgents();
      this.setState({
        agents,
        showDialog: false,
        dialogError: undefined,
      });
    } catch (error) {
      // Display error in dialog
      const errorMessage = error instanceof Error ? error.message : 'Failed to create agent';
      this.setState({ dialogError: errorMessage });
    }
  }

  /**
   * Render the Add Agent dialog modal.
   *
   * UI Components:
   * - Modal overlay with centered dialog
   * - Form fields: Agent Name (text), Agent Type (select), Model (select)
   * - Validation error display
   * - Action buttons: Cancel, Create
   *
   * Future enhancements:
   * - Agent personality configuration
   * - Permission settings
   * - Resource limits (tokens, cost)
   * - Auto-start toggle
   */
  private renderAddAgentDialog(): React.ReactNode {
    // Get default model for selected type
    const defaultModel = AGENT_TYPES.find((t) => t.value === this.dialogType)?.defaultModel || '';
    const modelValue = this.dialogModel || defaultModel;

    return (
      <div className="si-dialog-overlay" onClick={(e) => {
        // Close on overlay click (but not when clicking dialog content)
        if (e.target === e.currentTarget) {
          this.hideAddAgentDialog();
        }
      }}>
        <div className="si-dialog">
          {/* Dialog Header */}
          <div className="si-dialog-header">
            <h3>Add New Agent</h3>
            <button
              className="si-dialog-close"
              onClick={() => this.hideAddAgentDialog()}
              aria-label="Close dialog"
            >
              <i className="fa fa-times" />
            </button>
          </div>

          {/* Dialog Body - Form */}
          <div className="si-dialog-body">
            {/* Validation Error */}
            {this.state.dialogError && (
              <div className="si-dialog-error">
                <i className="fa fa-exclamation-circle" />
                <span>{this.state.dialogError}</span>
              </div>
            )}

            {/* Agent Name Field */}
            <div className="si-form-field">
              <label htmlFor="agent-name">
                Agent Name <span className="required">*</span>
              </label>
              <input
                id="agent-name"
                type="text"
                className="si-form-input"
                placeholder="e.g., My Assistant"
                value={this.dialogName}
                onChange={(e) => {
                  this.dialogName = e.target.value;
                  // Clear error when user starts typing
                  if (this.state.dialogError) {
                    this.setState({ dialogError: undefined });
                  }
                  this.update();
                }}
                onKeyDown={(e) => {
                  // Submit on Enter key
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleCreateAgent();
                  }
                }}
                autoFocus
              />
              <small className="si-form-hint">
                Unique name for this agent (no duplicates)
              </small>
            </div>

            {/* Agent Type Field */}
            <div className="si-form-field">
              <label htmlFor="agent-type">
                Agent Type <span className="required">*</span>
              </label>
              <select
                id="agent-type"
                className="si-form-select"
                value={this.dialogType}
                onChange={(e) => {
                  this.dialogType = e.target.value as AgentInfo['type'];
                  // Reset model when type changes (will use new default)
                  this.dialogModel = '';
                  this.update();
                }}
              >
                {AGENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <small className="si-form-hint">
                Determines the agent's capabilities and default model
              </small>
            </div>

            {/* Model Field */}
            <div className="si-form-field">
              <label htmlFor="agent-model">Model</label>
              <select
                id="agent-model"
                className="si-form-select"
                value={modelValue}
                onChange={(e) => {
                  this.dialogModel = e.target.value;
                  this.update();
                }}
              >
                <option value="">Default: {defaultModel}</option>
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <small className="si-form-hint">
                AI model to use (empty = default for type)
              </small>
            </div>

            {/* Future Enhancement Hints */}
            <div className="si-form-notice">
              <i className="fa fa-info-circle" />
              <span>
                Future: Configure personality, permissions, and resource limits after creation
              </span>
            </div>
          </div>

          {/* Dialog Footer - Action Buttons */}
          <div className="si-dialog-footer">
            <button
              className="si-button secondary"
              onClick={() => this.hideAddAgentDialog()}
              type="button"
            >
              Cancel
            </button>
            <button
              className="si-button primary"
              onClick={() => this.handleCreateAgent()}
              disabled={!this.dialogName.trim()}
              type="button"
            >
              <i className="fa fa-plus" />
              Create Agent
            </button>
          </div>
        </div>
      </div>
    );
  }

  private setState(partial: Partial<DashboardState>): void {
    this.state = { ...this.state, ...partial };
    this.update();
  }
}
