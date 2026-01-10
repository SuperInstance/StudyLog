/**
 * Multi-Model Chat Widget
 *
 * Chat interface with model switching, cost tracking, and provider display.
 */

import * as React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MultiModelFrontendService } from './multi-model-frontend-service';
import { Message } from '@theia/core/lib/browser/widgets/widget';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
  cost?: number;
  tokens?: { input: number; output: number };
}

export interface MultiModelState {
  messages: ChatMessage[];
  currentModel: string;
  currentProvider: string;
  availableProviders: ProviderInfo[];
  totalCost: number;
  isLoading: boolean;
  inputText: string;
}

export interface ProviderInfo {
  name: string;
  models: string[];
  status: 'available' | 'unconfigured' | 'error';
  costPerToken: number;
}

@injectable()
export class MultiModelChatWidget extends ReactWidget {
  static readonly ID = 'si-multi-model:chat';
  static readonly LABEL = 'AI Chat';

  @inject(MultiModelFrontendService)
  protected readonly service: MultiModelFrontendService;

  protected state: MultiModelState = {
    messages: [],
    currentModel: 'claude-3-5-haiku',
    currentProvider: 'anthropic',
    availableProviders: [],
    totalCost: 0,
    isLoading: false,
    inputText: '',
  };

  constructor() {
    super();
    this.id = MultiModelChatWidget.ID;
    this.title.label = MultiModelChatWidget.LABEL;
    this.title.caption = 'Multi-Model AI Chat';
    this.title.iconClass = 'fa fa-comments';
    this.addClass('si-multi-model-chat');
  }

  protected async onAfterAttach(msg: Message): Promise<void> {
    super.onAfterAttach(msg);

    // Load available providers
    const providers = await this.service.getProviders();
    this.setState({ availableProviders: providers });
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-multi-model-chat-container">
        {/* Header with provider/model selector */}
        <div className="chat-header">
          <div className="model-selector">
            <label>Provider:</label>
            <select
              value={this.state.currentProvider}
              onChange={(e) => this.handleProviderChange(e.target.value)}
            >
              {this.state.availableProviders.map((p) => (
                <option key={p.name} value={p.name} disabled={p.status !== 'available'}>
                  {p.name} {p.status !== 'available' && `(${p.status})`}
                </option>
              ))}
            </select>

            <label>Model:</label>
            <select
              value={this.state.currentModel}
              onChange={(e) => this.handleModelChange(e.target.value)}
            >
              {this.getCurrentProvider()?.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="cost-display">
            <span>Total Cost: ${this.state.totalCost.toFixed(4)}</span>
            <button onClick={() => this.service.resetCost()}>Reset</button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {this.state.messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="message-header">
                <span className="message-role">{msg.role}</span>
                {msg.model && <span className="message-model">{msg.model}</span>}
                {msg.cost !== undefined && <span className="message-cost">${msg.cost.toFixed(6)}</span>}
              </div>
              <div className="message-content">{msg.content}</div>
              {msg.tokens && (
                <div className="message-tokens">
                  {msg.tokens.input} in / {msg.tokens.output} out
                </div>
              )}
            </div>
          ))}

          {this.state.isLoading && (
            <div className="chat-message assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="chat-input">
          <textarea
            value={this.state.inputText}
            onChange={(e) => this.setState({ inputText: e.target.value })}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
              }
            }}
            placeholder="Ask anything... (Shift+Enter for newline)"
            disabled={this.state.isLoading}
          />
          <button
            className="send-button"
            onClick={() => this.sendMessage()}
            disabled={this.state.isLoading || !this.state.inputText.trim()}
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  private getCurrentProvider(): ProviderInfo | undefined {
    return this.state.availableProviders.find((p) => p.name === this.state.currentProvider);
  }

  private handleProviderChange(provider: string): void {
    const providerInfo = this.state.availableProviders.find((p) => p.name === provider);
    if (providerInfo && providerInfo.models.length > 0) {
      this.setState({
        currentProvider: provider,
        currentModel: providerInfo.models[0],
      });
    }
  }

  private handleModelChange(model: string): void {
    this.setState({ currentModel: model });
  }

  private async sendMessage(): Promise<void> {
    const content = this.state.inputText.trim();
    if (!content || this.state.isLoading) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    this.setState({
      messages: [...this.state.messages, userMessage],
      inputText: '',
      isLoading: true,
    });

    try {
      const response = await this.service.sendMessage(content, {
        model: this.state.currentModel,
        provider: this.state.currentProvider,
      });

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        model: response.model,
        provider: response.provider,
        cost: response.cost,
        tokens: response.tokens,
      };

      this.setState({
        messages: [...this.state.messages, userMessage, assistantMessage],
        totalCost: this.state.totalCost + (response.cost || 0),
        isLoading: false,
      });
    } catch (error) {
      console.error('[MultiModel] Send failed:', error);

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };

      this.setState({
        messages: [...this.state.messages, userMessage, errorMessage],
        isLoading: false,
      });
    }
  }

  private setState(partial: Partial<MultiModelState>): void {
    this.state = { ...this.state, ...partial };
    this.update();
  }
}
