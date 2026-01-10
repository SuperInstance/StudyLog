/**
 * Provider Registry and Factory
 *
 * Central registry for all AI providers with factory pattern
 * for dynamic provider instantiation.
 */

import type {
  AIProvider,
  ProviderConfig,
  ProviderRegistry,
  ProviderFactory,
  ProviderCapabilities,
  ProviderType,
} from './base';

import { ZhipuProvider } from './zhipu';
import { DeepSeekProvider } from './deepseek';

// Re-export all types
export * from './base';
export { ZhipuProvider } from './zhipu';
export { DeepSeekProvider } from './deepseek';

/**
 * Default provider configurations for common use cases
 */
export const DEFAULT_PROVIDER_CONFIGS: Record<string, Partial<ProviderConfig>> = {
  zhipu: {
    name: 'zhipu',
    type: 'llm',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    costPerMillion: 0.15,
    apiFormat: 'openai',
  },
  deepseek: {
    name: 'deepseek',
    type: 'llm',
    baseUrl: 'https://api.deepseek.com',
    costPerMillion: 0.20,
    apiFormat: 'openai',
  },
  kimi: {
    name: 'kimi',
    type: 'llm',
    baseUrl: 'https://api.moonshot.cn/v1',
    costPerMillion: 1.50,
    apiFormat: 'openai',
  },
  xai: {
    name: 'xai',
    type: 'llm',
    baseUrl: 'https://api.x.ai/v1',
    costPerMillion: 2.00,
    apiFormat: 'openai',
  },
  deepinfra: {
    name: 'deepinfra',
    type: 'llm',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    costPerMillion: 0.10,
    apiFormat: 'openai',
  },
  replicate: {
    name: 'replicate',
    type: 'image',
    baseUrl: 'https://api.replicate.com/v1',
    costPerMillion: 0,
    apiFormat: 'custom',
  },
  elevenlabs: {
    name: 'elevenlabs',
    type: 'audio',
    baseUrl: 'https://api.elevenlabs.io/v1',
    costPerMillion: 15,
    apiFormat: 'custom',
  },
};

/**
 * Provider registry implementation
 */
class ProviderRegistryImpl implements ProviderRegistry {
  private factories = new Map<string, ProviderFactory>();
  private providers = new Map<string, AIProvider>();

  register(factory: ProviderFactory): void {
    this.factories.set(factory.constructor.name, factory);
  }

  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailable(): AIProvider[] {
    return Array.from(this.providers.values()).filter((p) =>
      // Providers are considered available if they have an API key
      p.config.apiKey && p.config.apiKey.length > 0
    );
  }

  getByCapability(capability: keyof ProviderCapabilities): AIProvider[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.config.capabilities[capability]
    );
  }

  /**
   * Create and register a provider instance
   */
  async createProvider(
    name: string,
    apiKey: string,
    configOverrides?: Partial<ProviderConfig>
  ): Promise<AIProvider> {
    const defaultConfig = DEFAULT_PROVIDER_CONFIGS[name];
    if (!defaultConfig) {
      throw new Error(`Unknown provider: ${name}`);
    }

    // Build the provider config with proper type assertions
    const config: ProviderConfig = {
      name: defaultConfig.name as string,
      type: defaultConfig.type as ProviderType,
      baseUrl: defaultConfig.baseUrl || '',
      apiKey,
      apiFormat: defaultConfig.apiFormat || 'openai',
      models: [], // Will be populated by the provider
      costPerMillion: defaultConfig.costPerMillion || 0,
      capabilities: {
        streaming: false,
        functionCalling: false,
        vision: false,
        maxContext: 0,
        imageGeneration: false,
        audioGeneration: false,
        videoGeneration: false,
        jsonMode: false,
        systemPrompt: false,
      },
      ...(configOverrides || {}),
    };

    let provider: AIProvider;

    switch (name) {
      case 'zhipu':
        // Extract only valid config overrides for Zhipu
        provider = new ZhipuProvider({
          apiKey,
          baseUrl: configOverrides?.baseUrl,
          costPerMillion: configOverrides?.costPerMillion,
        });
        break;
      case 'deepseek':
        // Extract only valid config overrides for DeepSeek
        provider = new DeepSeekProvider({
          apiKey,
          baseUrl: configOverrides?.baseUrl,
          costPerMillion: configOverrides?.costPerMillion,
        });
        break;
      default:
        throw new Error(`Provider factory not implemented for: ${name}`);
    }

    await provider.initialize();
    this.providers.set(name, provider);

    return provider;
  }

  /**
   * Remove a provider from the registry
   */
  remove(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.dispose();
      this.providers.delete(name);
    }
  }

  /**
   * Clear all providers
   */
  clear(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
  }
}

/**
 * Global provider registry instance
 */
export const providerRegistry = new ProviderRegistryImpl();

/**
 * Helper function to create a provider from environment configuration
 */
export async function createProviderFromEnv(
  name: string,
  env: Record<string, string | undefined>
): Promise<AIProvider> {
  const apiKey = env[`${name.toUpperCase()}_API_KEY`];
  if (!apiKey) {
    throw new Error(`Missing API key for provider: ${name}`);
  }

  return providerRegistry.createProvider(name, apiKey);
}

/**
 * Get all configured provider names from environment
 */
export function getConfiguredProviders(
  env: Record<string, string | undefined>
): string[] {
  const providers: string[] = [];

  for (const name of Object.keys(DEFAULT_PROVIDER_CONFIGS)) {
    if (env[`${name.toUpperCase()}_API_KEY`]) {
      providers.push(name);
    }
  }

  return providers;
}

/**
 * Compare providers by cost for routing decisions
 */
export function compareProvidersByCost(
  a: AIProvider,
  b: AIProvider
): number {
  return a.config.costPerMillion - b.config.costPerMillion;
}

/**
 * Sort providers by cost (cheapest first)
 */
export function sortProvidersByCost(providers: AIProvider[]): AIProvider[] {
  return [...providers].sort(compareProvidersByCost);
}

/**
 * Get the cheapest available provider with a specific capability
 */
export function getCheapestProviderWithCapability(
  registry: ProviderRegistry,
  capability: keyof ProviderCapabilities
): AIProvider | undefined {
  const capable = sortProvidersByCost(
    registry.getByCapability(capability)
  );

  return capable.find((p) => p.config.apiKey);
}
