/**
 * Multi-Model Backend Service
 *
 * RPC service for routing requests to cheapest available LLM provider.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { ModelRouter } from './model-router';

export const MULTI_MODEL_SERVICE_PATH = '/services/multi-model';

export interface SendMessageRequest {
  message: string;
  model?: string;
  provider?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface SendMessageResponse {
  content: string;
  model: string;
  provider: string;
  cost: number;
  tokens: { input: number; output: number };
  finishReason: string;
}

export interface MultiModelService {
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  getProviders(): Promise<ProviderInfo[]>;
  getTotalCost(): Promise<number>;
  resetCost(): Promise<void>;
}

export interface ProviderInfo {
  name: string;
  models: string[];
  status: 'available' | 'unconfigured' | 'error';
  costPerToken: number;
}

@injectable()
export class MultiModelBackendService implements MultiModelService {
  @inject(ModelRouter)
  protected readonly router: ModelRouter;

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.router.route(request);
  }

  async getProviders(): Promise<ProviderInfo[]> {
    return this.router.getProviders();
  }

  async getTotalCost(): Promise<number> {
    return this.router.getTotalCost();
  }

  async resetCost(): Promise<void> {
    this.router.resetCost();
  }

  dispose(): void {
    // Cleanup
  }
}
