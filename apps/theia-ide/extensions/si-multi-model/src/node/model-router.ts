/**
 * Model Router
 *
 * Routes requests to cheapest available model with fallback support.
 * Caches responses and tracks costs per user/session.
 */

import { injectable } from '@theia/core/shared/inversify';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
}

interface RoutingConfig {
  cheapFirst: boolean;
  fallbackChain: string[];
  cacheTtl: number;
  maxRetries: number;
}

interface ModelCosts {
  [model: string]: number;
}

@injectable()
export class ModelRouter {
  private providers: Map<string, ProviderConfig> = new Map();
  private config: RoutingConfig;
  private costs: ModelCosts = {};
  private totalCost = 0;
  private cache: Map<string, { response: unknown; expires: number }> = new Map();

  constructor() {
    this.config = {
      cheapFirst: true,
      fallbackChain: ['ollama', 'google', 'nvidia', 'anthropic', 'openai'],
      cacheTtl: 300,
      maxRetries: 3,
    };

    this.loadConfig();
    this.loadCosts();
  }

  async route(request: {
    message: string;
    model?: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
    finishReason: string;
  }> {
    // Check cache
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.response as any;
    }

    // Select provider
    const provider = request.provider || await this.selectCheapest(request.model);
    const model = request.model || this.getDefaultModel(provider);

    // Make API call with fallback
    const response = await this.callWithFallback(provider, model, request);

    // Cache response
    this.cache.set(cacheKey, {
      response,
      expires: Date.now() + this.config.cacheTtl * 1000,
    });

    // Track cost
    this.totalCost += response.cost;

    return response;
  }

  private async selectCheapest(preferredModel?: string): Promise<string> {
    if (!this.config.cheapFirst) {
      return this.config.fallbackChain[0];
    }

    // Find cheapest available provider
    for (const provider of this.config.fallbackChain) {
      const config = this.providers.get(provider);
      if (config && config.apiKey) {
        return provider;
      }
    }

    return this.config.fallbackChain[0];
  }

  private getDefaultModel(provider: string): string {
    const config = this.providers.get(provider);
    return config?.models[0] || 'default';
  }

  private async callWithFallback(
    provider: string,
    model: string,
    request: { message: string; temperature?: number; maxTokens?: number }
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
    finishReason: string;
  }> {
    const providerIndex = this.config.fallbackChain.indexOf(provider);
    const fallbacks = this.config.fallbackChain.slice(providerIndex);

    for (const attemptProvider of fallbacks) {
      const config = this.providers.get(attemptProvider);
      if (!config || !config.apiKey) {
        continue;
      }

      try {
        const response = await this.callProvider(attemptProvider, model, request);
        return response;
      } catch (error) {
        console.error(`[ModelRouter] ${attemptProvider} failed:`, error);
        // Try next provider
      }
    }

    throw new Error('All providers failed');
  }

  private async callProvider(
    provider: string,
    model: string,
    request: { message: string; temperature?: number; maxTokens?: number }
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
    finishReason: string;
  }> {
    const config = this.providers.get(provider);
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    switch (provider) {
      case 'anthropic':
        return this.callAnthropic(config, model, request);
      case 'openai':
        return this.callOpenAI(config, model, request);
      case 'ollama':
        return this.callOllama(config, model, request);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async callAnthropic(
    config: ProviderConfig,
    model: string,
    request: { message: string; temperature?: number; maxTokens?: number }
  ): Promise<any> {
    const response = await fetch(`${config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens || 1024,
        messages: [{ role: 'user', content: request.message }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error: ${response.statusText}`);
    }

    const data = await response.json();
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cost = this.calculateCost('anthropic', model, inputTokens, outputTokens);

    return {
      content: data.content[0]?.text || '',
      model,
      provider: 'anthropic',
      cost,
      tokens: { input: inputTokens, output: outputTokens },
      finishReason: data.stop_reason || 'unknown',
    };
  }

  private async callOpenAI(
    config: ProviderConfig,
    model: string,
    request: { message: string; temperature?: number; maxTokens?: number }
  ): Promise<any> {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: request.message }],
        max_tokens: request.maxTokens || 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.statusText}`);
    }

    const data = await response.json();
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;
    const cost = this.calculateCost('openai', model, inputTokens, outputTokens);

    return {
      content: data.choices[0]?.message?.content || '',
      model,
      provider: 'openai',
      cost,
      tokens: { input: inputTokens, output: outputTokens },
      finishReason: data.choices[0]?.finish_reason || 'unknown',
    };
  }

  private async callOllama(
    config: ProviderConfig,
    model: string,
    request: { message: string; temperature?: number; maxTokens?: number }
  ): Promise<any> {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: request.message }],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.message?.content || '',
      model,
      provider: 'ollama',
      cost: 0, // Local models are free
      tokens: { input: data.prompt_eval_count || 0, output: data.eval_count || 0 },
      finishReason: 'done',
    };
  }

  private calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    const costPerMillion = this.costs[model] || 1;
    return ((inputTokens + outputTokens) / 1_000_000) * costPerMillion;
  }

  private getCacheKey(request: { message: string; model?: string; temperature?: number }): string {
    return `${request.message}:${request.model || ''}:${request.temperature || ''}`;
  }

  private async loadConfig(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'models.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      // Load providers
      if (config.providers) {
        for (const [name, p] of Object.entries(config.providers)) {
          const provider = p as any;
          this.providers.set(name, {
            name,
            apiKey: provider.key || process.env[`${name.toUpperCase()}_API_KEY`] || '',
            baseUrl: provider.base_url || provider.url || '',
            models: provider.models || [],
          });
        }
      }

      // Load routing config
      if (config.routing) {
        this.config = { ...this.config, ...config.routing };
      }
    } catch (error) {
      console.error('[ModelRouter] Failed to load config:', error);
    }
  }

  private async loadCosts(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'models.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.costs) {
        this.costs = config.costs;
      }
    } catch (error) {
      console.error('[ModelRouter] Failed to load costs:', error);
    }
  }

  getProviders(): Array<{ name: string; models: string[]; status: 'available' | 'unconfigured' | 'error'; costPerToken: number }> {
    return Array.from(this.providers.values()).map((p) => ({
      name: p.name,
      models: p.models,
      status: p.apiKey ? 'available' : 'unconfigured',
      costPerToken: this.costs[p.models[0]] || 0,
    }));
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  resetCost(): void {
    this.totalCost = 0;
    this.cache.clear();
  }
}
