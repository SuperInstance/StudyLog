/**
 * Theia Extension Template
 *
 * This is a minimal template for creating a Theia extension that integrates
 * with the StudyLoG.AI agent system. It demonstrates:
 * - Frontend module setup
 * - Backend service with RPC
 * - Widget contribution
 * - Command registration
 * - Menu integration
 *
 * To create a new extension:
 * 1. Copy this template to apps/theia-ide/extensions/your-extension/
 * 2. Rename classes and files
 * 3. Implement your specific functionality
 * 4. Add to browser/src/browser/your-extension-frontend-module.ts
 * 5. Add to node/src/node/your-extension-backend-module.ts
 *
 * Based on the si-gassist, si-multi-model, and si-bazaar extensions.
 */

// ═══════════════════════════════════════════════════════════════
// Package.json for the extension
// ═══════════════════════════════════════════════════════════════

/**
 * package.json template:
 *
 * {
 *   "name": "si-your-extension",
 *   "version": "0.1.0",
 *   "description": "Your StudyLoG.AI extension description",
 *   "keywords": ["theia-extension", "studylog"],
 *   "license": "MIT",
 *   "files": [
 *     "lib",
 *     "src"
 *   ],
 *   "theiaExtensions": [
 *     {
 *       "frontend": "lib/browser/your-extension-frontend-module",
 *       "backend": "lib/node/your-extension-backend-module"
 *     }
 *   ],
 *   "dependencies": {
 *     "@theia/core": "^1.54.0",
 *     "@theia/workspace": "^1.54.0"
 *   },
 *   "devDependencies": {
 *     "typescript": "^5.7.3",
 *     "@types/node": "^22.10.5"
 *   },
 *   "scripts": {
 *     "build": "tsc",
 *     "watch": "tsc -w"
 *   }
 * }
 */

// ═══════════════════════════════════════════════════════════════
// Common Types (src/common/types.ts)
// ═══════════════════════════════════════════════════════════════

export interface YourExtensionConfig {
  enabled: boolean;
  apiUrl: string;
  defaultModel: string;
  showInSidebar: boolean;
}

export interface YourExtensionRequest {
  action: string;
  data?: unknown;
}

export interface YourExtensionResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// Backend Service (src/node/your-extension-backend-service.ts)
// ═══════════════════════════════════════════════════════════════

import { injectable, inject } from '@theia/core/shared/inversify';
import { WebSocketConnection, EventEmitter } from '@theia/core';

export const YOUR_EXTENSION_SERVICE_PATH = '/services/your-extension';

export interface YourExtensionService {
  getConfig(): Promise<YourExtensionConfig>;
  setConfig(config: Partial<YourExtensionConfig>): Promise<void>;
  executeRequest(request: YourExtensionRequest): Promise<YourExtensionResponse>;
}

@injectable()
export class YourExtensionBackendService implements YourExtensionService {
  protected readonly config: YourExtensionConfig = {
    enabled: true,
    apiUrl: 'http://localhost:8787',
    defaultModel: 'claude-3-5-haiku',
    showInSidebar: true,
  };

  protected readonly onConfigChangedEmitter = new EventEmitter<YourExtensionConfig>();

  readonly onConfigChanged = this.onConfigChangedEmitter.event;

  async getConfig(): Promise<YourExtensionConfig> {
    return { ...this.config };
  }

  async setConfig(updates: Partial<YourExtensionConfig>): Promise<void> {
    Object.assign(this.config, updates);
    this.onConfigChangedEmitter.fire(this.config);
  }

  async executeRequest(request: YourExtensionRequest): Promise<YourExtensionResponse> {
    try {
      // Implement your backend logic here
      switch (request.action) {
        case 'getStatus':
          return {
            success: true,
            data: { status: 'running', version: '0.1.0' },
          };

        case 'processData':
          // Example: Call external API
          const response = await fetch(`${this.config.apiUrl}/api/v1/endpoint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.data),
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }

          const data = await response.json();
          return { success: true, data };

        default:
          return {
            success: false,
            error: `Unknown action: ${request.action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  dispose(): void {
    // Cleanup
  }
}

// ═══════════════════════════════════════════════════════════════
// Backend Module (src/node/your-extension-backend-module.ts)
// ═══════════════════════════════════════════════════════════════

import { ContainerModule } from '@theia/core/shared/inversify';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging/ws-connection-provider';
import {
  YourExtensionService,
  YourExtensionBackendService,
} from '../node/your-extension-backend-service';

export const YourExtensionBackendModule = new ContainerModule((bind) => {
  bind(YourExtensionBackendService).toSelf().inSingletonScope();
  bind(YourExtensionService).toDynamicValue((context) => {
    const connection = context.container.get<WebSocketConnectionProvider>(WebSocketConnectionProvider);
    return connection.createProxy<YourExtensionService>(YOUR_EXTENSION_SERVICE_PATH);
  }).inSingletonScope();
});

// ═══════════════════════════════════════════════════════════════
// Frontend Widget (src/browser/your-extension-widget.tsx)
// ═══════════════════════════════════════════════════════════════

import React from 'react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { Widget, Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { YourExtensionService } from '../common/your-extension-service-protocol';
import { DisposableCollection } from '@theia/core/lib/common/disposable';

export const YOUR_EXTENSION_WIDGET_ID = 'your-extension-widget';
export const YOUR_EXTENSION_WIDGET_LABEL = 'Your Extension';

@injectable()
export class YourExtensionWidget extends ReactWidget {
  static ID = YOUR_EXTENSION_WIDGET_ID;
  static LABEL = YOUR_EXTENSION_WIDGET_LABEL;

  @inject(YourExtensionService)
  protected readonly service: YourExtensionService;

  protected readonly toDispose = new DisposableCollection();

  constructor() {
    super();
    this.id = YourExtensionWidget.ID;
    this.title.label = YourExtensionWidget.LABEL;
    this.title.iconClass = 'fa fa-paw'; // Choose an icon
    this.title.closable = true;
  }

  override async onActivateRequest(msg: Message): Promise<void> {
    await super.onActivateRequest(msg);
    this.update();
  }

  override async onClose(): Promise<void> {
    this.toDispose.dispose();
    await super.onClose();
  }

  protected render(): React.ReactNode {
    return <YourExtensionComponent service={this.service} />;
  }
}

interface YourExtensionComponentProps {
  service: YourExtensionService;
}

interface YourExtensionComponentState {
  config: YourExtensionConfig | null;
  isLoading: boolean;
  status?: string;
  error?: string;
}

class YourExtensionComponent extends React.Component<YourExtensionComponentProps, YourExtensionComponentState> {
  constructor(props: YourExtensionComponentProps) {
    super(props);
    this.state = {
      config: null,
      isLoading: false,
    };
  }

  override async componentDidMount(): Promise<void> {
    await this.loadConfig();
  }

  async loadConfig(): Promise<void> {
    try {
      const config = await this.props.service.getConfig();
      this.setState({ config });
    } catch (error) {
      this.setState({ error: 'Failed to load config' });
    }
  }

  handleAction = async (action: string): Promise<void> => {
    this.setState({ isLoading: true, error: undefined });

    try {
      const response = await this.props.service.executeRequest({
        action,
        data: { timestamp: Date.now() },
      });

      if (response.success) {
        this.setState({ status: JSON.stringify(response.data) });
      } else {
        this.setState({ error: response.error || 'Action failed' });
      }
    } catch (error) {
      this.setState({ error: 'Request failed' });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  override render(): React.ReactNode {
    const { config, isLoading, status, error } = this.state;

    return (
      <div style={{
        padding: '16px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <header style={{
          borderBottom: '1px solid var(--theia-border-color)',
          paddingBottom: '12px',
        }}>
          <h2 style={{ margin: 0 }}>Your Extension</h2>
          <p style={{ margin: '4px 0 0 0', opacity: 0.7 }}>
            StudyLoG.AI Integration
          </p>
        </header>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {config && (
            <div style={{
              padding: '12px',
              background: 'var(--theia-editor-background)',
              borderRadius: '4px',
              marginBottom: '16px',
            }}>
              <h3>Configuration</h3>
              <pre style={{ fontSize: '12px' }}>
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          )}

          {status && (
            <div style={{
              padding: '12px',
              background: 'var(--theia-notificationInfo-background)',
              borderRadius: '4px',
              marginBottom: '16px',
            }}>
              <h3>Status</h3>
              <pre style={{ fontSize: '12px' }}>{status}</pre>
            </div>
          )}

          {error && (
            <div style={{
              padding: '12px',
              background: 'var(--theia-notificationError-background)',
              borderRadius: '4px',
              marginBottom: '16px',
            }}>
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => this.handleAction('getStatus')}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                background: 'var(--theia-primary-button-background)',
                color: 'var(--theia-button-foreground)',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Loading...' : 'Get Status'}
            </button>

            <button
              onClick={() => this.handleAction('processData')}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                background: 'var(--theia-secondary-button-background)',
                color: 'var(--theia-button-foreground)',
                border: 'none',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Processing...' : 'Process Data'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Frontend Contribution (src/browser/your-extension-widget-contribution.ts)
// ═══════════════════════════════════════════════════════════════

import { injectable } from '@theia/core/shared/inversify';
import {
  FrontendApplicationContribution,
  FrontendApplication,
} from '@theia/core/lib/browser/frontend-application';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import {
  MenuModelRegistry,
  MenuPath,
  CommandContribution,
  CommandRegistry,
} from '@theia/core/lib/common';
import { YourExtensionWidget } from './your-extension-widget';

export const YOUR_EXTENSION_MENU: MenuPath = ['your-extension-menu'];

@injectable()
export class YourExtensionWidgetContribution implements FrontendApplicationContribution, CommandContribution {
  @inject(MenuModelRegistry)
  protected readonly menuRegistry: MenuModelRegistry;

  async initializeLayout(app: FrontendApplication): Promise<void> {
    // Register menu
    this.menuRegistry.registerMenuAction(CommonMenus.VIEW, {
      commandId: YourExtensionWidget.ID,
      label: YOUR_EXTENSION_WIDGET_LABEL,
    });
  }

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand({
      id: YourExtensionWidget.ID,
      label: YOUR_EXTENSION_WIDGET_LABEL,
      iconClass: 'fa fa-paw',
    }, {
      execute: () => {
        registry.executeCommand('widget.open', { widget: YourExtensionWidget.ID });
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Frontend Module (src/browser/your-extension-frontend-module.ts)
// ═══════════════════════════════════════════════════════════════

import { ContainerModule, Container } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import {
  YourExtensionWidget,
  YOUR_EXTENSION_WIDGET_ID,
  YOUR_EXTENSION_WIDGET_LABEL,
} from './your-extension-widget';
import { YourExtensionWidgetContribution } from './your-extension-widget-contribution';
import { YourExtensionFrontendService } from './your-extension-frontend-service';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
  // Bind Widget
  bind(YourExtensionWidget).toSelf();
  bind(WidgetFactory).toDynamicValue(ctx => ({
    id: YOUR_EXTENSION_WIDGET_ID,
    createWidget: () => ctx.container.get<YourExtensionWidget>(YourExtensionWidget),
  })).inSingletonScope();

  // Bind Frontend Contribution
  bind(YourExtensionWidgetContribution).toSelf().inSingletonScope();

  // Bind Frontend Service
  bind(YourExtensionFrontendService).toSelf().inSingletonScope();

  // Bind Service Proxy
  [YourExtensionWidget, YourExtensionFrontendService].forEach(service => {
    bind(service).toDynamicValue(context => {
      const connection = context.container.get<{ getProxy<T>(service: string): T }>('WebSocketConnectionProvider');
      return connection.getProxy(service);
    }).inSingletonScope();
  });
});

// ═══════════════════════════════════════════════════════════════
// Frontend Service (src/browser/your-extension-frontend-service.ts)
// ═══════════════════════════════════════════════════════════════

import { injectable, inject } from '@theia/core/shared/inversify';
import { EventEmitter, Emitter } from '@theia/core/lib/common/event';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { YourExtensionService } from '../common/your-extension-service-protocol';

@injectable()
export class YourExtensionFrontendService implements FrontendApplicationContribution {
  @inject(YourExtensionService)
  protected readonly service: YourExtensionService;

  private readonly onConfigChangedEmitter = new Emitter<YourExtensionConfig>();
  readonly onConfigChanged = this.onConfigChangedEmitter.event;

  async onStart(): Promise<void> {
    console.log('Your Extension Frontend Service starting...');

    // Subscribe to config changes
    if (this.service.onConfigChanged) {
      this.service.onConfigChanged((config) => {
        this.onConfigChangedEmitter.fire(config);
      });
    }
  }

  async executeRequest(action: string, data?: unknown): Promise<YourExtensionResponse> {
    return this.service.executeRequest({ action, data });
  }

  async getConfig(): Promise<YourExtensionConfig> {
    return this.service.getConfig();
  }

  async setConfig(config: Partial<YourExtensionConfig>): Promise<void> {
    return this.service.setConfig(config);
  }
}

// ═══════════════════════════════════════════════════════════════
// Common Protocol (src/common/your-extension-service-protocol.ts)
// ═══════════════════════════════════════════════════════════════

export const YOUR_EXTENSION_SERVICE_PATH = '/services/your-extension';

export interface YourExtensionService {
  getConfig(): Promise<YourExtensionConfig>;
  setConfig(config: Partial<YourExtensionConfig>): Promise<void>;
  executeRequest(request: YourExtensionRequest): Promise<YourExtensionResponse>;
  onConfigChanged?: (config: YourExtensionConfig) => void | Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// Export Index
// ═══════════════════════════════════════════════════════════════

export {
  YourExtensionWidget,
  YourExtensionWidgetContribution,
  YourExtensionFrontendService,
  YourExtensionBackendService,
  YourExtensionBackendModule,
};

export type {
  YourExtensionConfig,
  YourExtensionRequest,
  YourExtensionResponse,
};
