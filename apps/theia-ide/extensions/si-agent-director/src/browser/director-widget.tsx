/**
 * StudyLoG.AI - Director Widget
 *
 * Chat interface for interacting with the Director agent
 * and viewing agent activity.
 */

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import { DirectorService } from './director-service';
import { AgentType, AgentState, ConversationMessage } from '../common';

const DIRECTOR_WIDGET_ID = 'si-agent-director:widget';
const DIRECTOR_WIDGET_LABEL = 'Agent Chat';

@injectable()
export class DirectorWidget extends ReactWidget {
  static readonly ID = DIRECTOR_WIDGET_ID;
  static readonly LABEL = DIRECTOR_WIDGET_LABEL;

  @inject(MessageService)
  protected readonly messageService: MessageService;

  @inject(DirectorService)
  protected readonly directorService: DirectorService;

  private inputValue = '';
  private isProcessing = false;

  @postConstruct()
  protected init(): void {
    this.id = DirectorWidget.ID;
    this.title.label = DirectorWidget.LABEL;
    this.title.caption = 'Chat with AI Agents';
    this.title.closable = true;
    this.title.iconClass = 'fa fa-comments';
    this.addClass('si-director-widget');
    this.update();
  }

  protected render(): React.ReactNode {
    const messages = this.directorService.getConversationHistory();
    const agents = this.directorService.getAllAgentStatuses();

    return (
      <div className="si-director-container">
        {this.renderAgentStatus(agents)}
        {this.renderMessages(messages)}
        {this.renderInput()}
      </div>
    );
  }

  private renderAgentStatus(agents: AgentState[]): React.ReactNode {
    return (
      <div className="si-director-agents">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`si-director-agent si-director-agent-${agent.status}`}
            title={`${agent.type}: ${agent.status}`}
          >
            <span className="si-director-agent-icon">
              {this.getAgentIcon(agent.type)}
            </span>
            <span className="si-director-agent-status">
              {this.getStatusIndicator(agent.status)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  private getAgentIcon(type: AgentType): string {
    switch (type) {
      case 'director': return '🎬';
      case 'captain': return '⚓';
      case 'teacher': return '📚';
      case 'builder': return '🔨';
      case 'tester': return '🧪';
      default: return '🤖';
    }
  }

  private getStatusIndicator(status: string): string {
    switch (status) {
      case 'idle': return '○';
      case 'thinking': return '◐';
      case 'acting': return '●';
      case 'waiting': return '◑';
      case 'error': return '⚠';
      default: return '○';
    }
  }

  private renderMessages(messages: ConversationMessage[]): React.ReactNode {
    return (
      <div className="si-director-messages">
        {messages.length === 0 ? (
          <div className="si-director-welcome">
            <h3>Welcome to StudyLoG.AI</h3>
            <p>I'm the Director. I'll help guide your learning journey.</p>
            <p>Try saying:</p>
            <ul>
              <li>"Start the Cognitive Mill"</li>
              <li>"Explain how gears work"</li>
              <li>"I need a hint"</li>
            </ul>
          </div>
        ) : (
          messages.map((msg) => this.renderMessage(msg))
        )}
        {this.isProcessing && (
          <div className="si-director-message si-director-message-agent">
            <div className="si-director-message-avatar">🤔</div>
            <div className="si-director-message-content">
              <div className="si-director-typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  private renderMessage(msg: ConversationMessage): React.ReactNode {
    const isUser = msg.role === 'user';

    return (
      <div
        key={msg.id}
        className={`si-director-message si-director-message-${msg.role}`}
      >
        <div className="si-director-message-avatar">
          {isUser ? '👤' : this.getAgentIcon(msg.agent || 'director')}
        </div>
        <div className="si-director-message-content">
          {!isUser && msg.agent && (
            <div className="si-director-message-agent-name">
              {msg.agent.charAt(0).toUpperCase() + msg.agent.slice(1)}
            </div>
          )}
          <div className="si-director-message-text">{msg.content}</div>
          <div className="si-director-message-time">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    );
  }

  private renderInput(): React.ReactNode {
    return (
      <div className="si-director-input">
        <input
          type="text"
          className="theia-input"
          placeholder="Type a message..."
          value={this.inputValue}
          onChange={(e) => {
            this.inputValue = e.target.value;
            this.update();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              this.handleSend();
            }
          }}
          disabled={this.isProcessing}
        />
        <button
          className="theia-button"
          onClick={() => this.handleSend()}
          disabled={this.isProcessing || !this.inputValue.trim()}
        >
          <i className="fa fa-paper-plane" />
        </button>
      </div>
    );
  }

  private async handleSend(): Promise<void> {
    const content = this.inputValue.trim();
    if (!content || this.isProcessing) return;

    this.inputValue = '';
    this.isProcessing = true;
    this.update();

    try {
      await this.directorService.processUserMessage(content);
    } catch (error) {
      this.messageService.error(`Error: ${error}`);
    } finally {
      this.isProcessing = false;
      this.update();

      // Scroll to bottom
      const messagesEl = this.node.querySelector('.si-director-messages');
      if (messagesEl) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }
  }
}
