/**
 * StudyLoG.AI - A2UI Widget
 *
 * Receives A2UI JSON manifests from agents and renders
 * native Theia/React components. Handles user interactions
 * and sends actions back to agents.
 */

import * as React from 'react';
import { injectable, postConstruct, inject } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { MessageService } from '@theia/core';
import {
  A2UI_WIDGET_ID,
  A2UI_WIDGET_LABEL,
  A2UIMessage,
  A2UIComponent,
  A2UIContext,
  A2UIComponentType,
} from '../common';

@injectable()
export class A2UIWidget extends ReactWidget {
  static readonly ID = A2UI_WIDGET_ID;
  static readonly LABEL = A2UI_WIDGET_LABEL;

  @inject(MessageService)
  protected readonly messageService: MessageService;

  private components: A2UIComponent[] = [];
  private context: A2UIContext = {
    agent: 'director',
    module: 'cognitive-mill',
    theme: 'dark',
    locale: 'en',
    state: {},
  };
  private messageQueue: A2UIMessage[] = [];

  @postConstruct()
  protected init(): void {
    this.id = A2UIWidget.ID;
    this.title.label = A2UI_WIDGET_LABEL;
    this.title.caption = 'Agent-Driven UI';
    this.title.closable = true;
    this.title.iconClass = 'fa fa-robot';
    this.addClass('si-a2ui-widget');
    this.update();
  }

  protected render(): React.ReactNode {
    return (
      <div className="si-a2ui-container">
        <div className="si-a2ui-header">
          <span className="si-a2ui-agent">Agent: {this.context.agent}</span>
          <span className="si-a2ui-module">{this.context.module}</span>
        </div>
        <div className="si-a2ui-content">
          {this.components.length === 0 ? (
            this.renderPlaceholder()
          ) : (
            this.components.map((comp) => this.renderComponent(comp))
          )}
        </div>
      </div>
    );
  }

  private renderPlaceholder(): React.ReactNode {
    return (
      <div className="si-a2ui-placeholder">
        <i className="fa fa-comments fa-2x" />
        <p>Waiting for agent...</p>
        <p className="si-a2ui-hint">The agent will display UI here</p>
      </div>
    );
  }

  // Main component renderer
  private renderComponent(component: A2UIComponent): React.ReactNode {
    const { id, type, props, children, style, events } = component;

    // Common event handler wrapper
    const handleEvent = (eventName: string, data?: unknown) => {
      const handler = events?.find((e) => e.event === eventName);
      if (handler) {
        this.emitAction(handler.action, { ...handler.payload, ...data as object });
      }
    };

    // Render based on component type
    switch (type) {
      case 'text':
        return (
          <p key={id} className="si-a2ui-text" style={style as React.CSSProperties}>
            {props.content as string}
          </p>
        );

      case 'button':
        return (
          <button
            key={id}
            className={`theia-button ${props.variant || 'primary'}`}
            style={style as React.CSSProperties}
            onClick={() => handleEvent('click')}
            disabled={props.disabled as boolean}
          >
            {props.icon && <i className={`fa fa-${props.icon}`} />}
            {props.label as string}
          </button>
        );

      case 'input':
        return (
          <div key={id} className="si-a2ui-input-group" style={style as React.CSSProperties}>
            {props.label && <label>{props.label as string}</label>}
            <input
              type={(props.inputType as string) || 'text'}
              className="theia-input"
              placeholder={props.placeholder as string}
              value={this.context.state[id] as string || props.value as string || ''}
              onChange={(e) => {
                this.updateState(id, e.target.value);
                handleEvent('change', { value: e.target.value });
              }}
            />
          </div>
        );

      case 'select':
        return (
          <div key={id} className="si-a2ui-select-group" style={style as React.CSSProperties}>
            {props.label && <label>{props.label as string}</label>}
            <select
              className="theia-select"
              value={this.context.state[id] as string || props.value as string}
              onChange={(e) => {
                this.updateState(id, e.target.value);
                handleEvent('change', { value: e.target.value });
              }}
            >
              {(props.options as Array<{ value: string; label: string }>)?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'checkbox':
        return (
          <label key={id} className="si-a2ui-checkbox" style={style as React.CSSProperties}>
            <input
              type="checkbox"
              checked={this.context.state[id] as boolean ?? props.checked as boolean}
              onChange={(e) => {
                this.updateState(id, e.target.checked);
                handleEvent('change', { checked: e.target.checked });
              }}
            />
            {props.label as string}
          </label>
        );

      case 'slider':
        return (
          <div key={id} className="si-a2ui-slider" style={style as React.CSSProperties}>
            {props.label && <label>{props.label as string}</label>}
            <input
              type="range"
              min={props.min as number ?? 0}
              max={props.max as number ?? 100}
              step={props.step as number ?? 1}
              value={this.context.state[id] as number ?? props.value as number ?? 50}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                this.updateState(id, value);
                handleEvent('change', { value });
              }}
            />
            <span className="si-a2ui-slider-value">
              {this.context.state[id] as number ?? props.value as number ?? 50}
            </span>
          </div>
        );

      case 'progress':
        return (
          <div key={id} className="si-a2ui-progress" style={style as React.CSSProperties}>
            {props.label && <span>{props.label as string}</span>}
            <div className="si-a2ui-progress-bar">
              <div
                className="si-a2ui-progress-fill"
                style={{ width: `${props.value as number || 0}%` }}
              />
            </div>
            <span className="si-a2ui-progress-text">{props.value as number || 0}%</span>
          </div>
        );

      case 'list':
        return (
          <ul key={id} className="si-a2ui-list" style={style as React.CSSProperties}>
            {(props.items as Array<{ id: string; content: string }>)?.map((item) => (
              <li
                key={item.id}
                onClick={() => handleEvent('itemClick', { itemId: item.id })}
              >
                {item.content}
              </li>
            ))}
          </ul>
        );

      case 'card':
        return (
          <div key={id} className="si-a2ui-card" style={style as React.CSSProperties}>
            {props.title && <h3 className="si-a2ui-card-title">{props.title as string}</h3>}
            <div className="si-a2ui-card-content">
              {children?.map((child) => this.renderComponent(child))}
            </div>
            {props.footer && (
              <div className="si-a2ui-card-footer">{props.footer as string}</div>
            )}
          </div>
        );

      case 'hint':
        return (
          <div key={id} className={`si-a2ui-hint si-a2ui-hint-${props.level || 'info'}`} style={style as React.CSSProperties}>
            <i className={`fa fa-${this.getHintIcon(props.level as string)}`} />
            <div className="si-a2ui-hint-content">
              {props.title && <strong>{props.title as string}</strong>}
              <p>{props.message as string}</p>
            </div>
            {props.dismissible && (
              <button className="si-a2ui-hint-dismiss" onClick={() => handleEvent('dismiss')}>
                <i className="fa fa-times" />
              </button>
            )}
          </div>
        );

      case 'code':
        return (
          <pre key={id} className="si-a2ui-code" style={style as React.CSSProperties}>
            <code className={`language-${props.language || 'javascript'}`}>
              {props.code as string}
            </code>
          </pre>
        );

      case 'markdown':
        return (
          <div
            key={id}
            className="si-a2ui-markdown"
            style={style as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: this.parseMarkdown(props.content as string) }}
          />
        );

      case 'container':
        return (
          <div
            key={id}
            className={`si-a2ui-container-${props.layout || 'vertical'}`}
            style={style as React.CSSProperties}
          >
            {children?.map((child) => this.renderComponent(child))}
          </div>
        );

      default:
        return (
          <div key={id} className="si-a2ui-unknown">
            Unknown component: {type}
          </div>
        );
    }
  }

  private getHintIcon(level?: string): string {
    switch (level) {
      case 'success': return 'check-circle';
      case 'warning': return 'exclamation-triangle';
      case 'error': return 'times-circle';
      default: return 'info-circle';
    }
  }

  private parseMarkdown(content: string): string {
    // Simple markdown parser (in production, use marked or similar)
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // State management
  private updateState(key: string, value: unknown): void {
    this.context.state[key] = value;
    this.update();
  }

  // Emit action to agent
  private emitAction(action: string, data: Record<string, unknown>): void {
    const message: A2UIMessage = {
      id: crypto.randomUUID(),
      type: 'action',
      agent: this.context.agent,
      priority: 'normal',
      timestamp: Date.now(),
      payload: {
        type: 'action',
        action,
        data,
      },
    };

    // In real implementation, send via WebSocket or event bus
    console.log('[A2UI] Action:', message);
    this.onAction?.(message);
  }

  // Public API
  public onAction?: (message: A2UIMessage) => void;

  public setContext(context: Partial<A2UIContext>): void {
    this.context = { ...this.context, ...context };
    this.update();
  }

  public pushMessage(message: A2UIMessage): void {
    this.messageQueue.push(message);
    this.processMessage(message);
  }

  private processMessage(message: A2UIMessage): void {
    switch (message.payload.type) {
      case 'component':
        const compPayload = message.payload as { type: 'component'; component: A2UIComponent };
        if (message.target) {
          // Update existing component
          this.updateComponent(message.target, compPayload.component);
        } else {
          // Add new component
          this.components.push(compPayload.component);
        }
        break;

      case 'notification':
        const notifPayload = message.payload as { type: 'notification'; level: string; title: string; message: string };
        this.showNotification(notifPayload);
        break;

      case 'state':
        const statePayload = message.payload as { type: 'state'; path: string; value: unknown };
        this.updateState(statePayload.path, statePayload.value);
        break;
    }

    this.update();
  }

  private updateComponent(id: string, component: A2UIComponent): void {
    const index = this.components.findIndex((c) => c.id === id);
    if (index >= 0) {
      this.components[index] = component;
    }
  }

  private showNotification(payload: { level: string; title: string; message: string }): void {
    const { level, title, message } = payload;
    const msg = `${title}: ${message}`;

    switch (level) {
      case 'error':
        this.messageService.error(msg);
        break;
      case 'warning':
        this.messageService.warn(msg);
        break;
      default:
        this.messageService.info(msg);
    }
  }

  public clearComponents(): void {
    this.components = [];
    this.update();
  }
}
