/**
 * Multi-Model Frontend Service
 *
 * Frontend service that communicates with the backend multi-model router.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { WebSocketConnection, ILogger } from '@theia/core';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application';
import { MessageType } from '@theia/core/lib/common/messaging';

export interface SendMessageOptions {
  model: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  cost?: number;
  tokens?: { input: number; output: number };
  finishReason?: string;
}

export interface ProviderInfo {
  name: string;
  models: string[];
  status: 'available' | 'unconfigured' | 'error';
  costPerToken: number;
}

@injectable()
export class MultiModelFrontendService implements FrontendApplicationContribution {
  @inject(ILogger)
  protected readonly logger: ILogger;

  private connection: WebSocketConnection | null = null;

  async sendMessage(message: string, options: SendMessageOptions): Promise<ChatResponse> {
    // For now, make direct API calls from backend proxy
    // In production, this would go through the backend service
    return this.sendToBackend(message, options);
  }

  async getProviders(): Promise<ProviderInfo[]> {
    // Return configured providers from backend
    return [
      {
        name: 'anthropic',
        models: ['claude-3-5-sonnet', 'claude-3-5-haiku'],
        status: 'available',
        costPerToken: 0.000003,
      },
      {
        name: 'openai',
        models: ['gpt-4o', 'gpt-4o-mini'],
        status: 'unconfigured',
        costPerToken: 0.000005,
      },
      {
        name: 'ollama',
        models: ['llama3.1:8b', 'nemotron-mini:4b'],
        status: 'available',
        costPerToken: 0,
      },
    ];
  }

  async getTotalCost(): Promise<number> {
    // Fetch from backend
    return 0;
  }

  async resetCost(): Promise<void> {
    // Reset on backend
  }

  private async sendToBackend(message: string, options: SendMessageOptions): Promise<ChatResponse> {
    // This would connect to the backend multi-model router worker
    // For now, return a mock response
    return {
      content: `[Mock Response from ${options.model}]\n\nI received your message: "${message}"\n\nThis is a placeholder. The actual multi-model router worker will be implemented next.`,
      model: options.model,
      provider: options.provider || 'default',
      cost: 0.0001,
      tokens: { input: 10, output: 20 },
    };
  }

  onStart(): void {
    this.logger.info('Starting Multi-Model Frontend Service');
  }

  onStop(): void {
    this.connection?.close();
  }
}
