/**
 * StudyLoG.AI - Ollama Service
 *
 * High-level service for managing Ollama in StudyLoG.
 * Handles automatic model selection, health monitoring, and fallback.
 */

import { OllamaClient, createClient, ensureModels } from './client';
import {
  HARDWARE_TIERS,
  getRecommendedTier,
  getModelsForTier,
  type HardwareTier,
} from './config';
import { detectHardware, type HardwareProfile } from '../hardware/detect';

export interface OllamaServiceConfig {
  host?: string;
  autoDetectHardware?: boolean;
  forceTier?: string;
  autoDownloadModels?: boolean;
  fallbackToCloudflare?: boolean;
}

export interface InferenceRequest {
  type: 'chat' | 'code' | 'embed';
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface InferenceResult {
  text: string;
  model: string;
  provider: 'ollama' | 'cloudflare';
  tokensUsed: number;
  latencyMs: number;
}

export class OllamaService {
  private client: OllamaClient | null = null;
  private config: OllamaServiceConfig;
  private tier: HardwareTier | null = null;
  private hardwareProfile: HardwareProfile | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: OllamaServiceConfig = {}) {
    this.config = {
      autoDetectHardware: true,
      autoDownloadModels: false, // Don't download by default
      fallbackToCloudflare: true,
      ...config,
    };
  }

  // Initialize the service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    await this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    // Try to connect to Ollama
    this.client = await createClient({ host: this.config.host });

    if (!this.client) {
      console.warn('Ollama is not running. Local AI will be unavailable.');
      this.isInitialized = true;
      return;
    }

    // Detect hardware if enabled
    if (this.config.autoDetectHardware) {
      try {
        this.hardwareProfile = await detectHardware();
        this.tier = getRecommendedTier(
          Math.max(0, ...this.hardwareProfile.gpus.map((g) => g.vramMb)),
          this.hardwareProfile.system.ramMb
        );
      } catch (error) {
        console.warn('Hardware detection failed:', error);
        this.tier = HARDWARE_TIERS.starter;
      }
    }

    // Force specific tier if configured
    if (this.config.forceTier && HARDWARE_TIERS[this.config.forceTier]) {
      this.tier = HARDWARE_TIERS[this.config.forceTier];
    }

    // Download models if enabled
    if (this.config.autoDownloadModels && this.tier) {
      const models = getModelsForTier(this.tier);
      await ensureModels(this.client, models, (model, progress) => {
        console.log(`Downloading ${model}: ${progress.status}`);
      });
    }

    this.isInitialized = true;
  }

  // Check if local AI is available
  async isAvailable(): Promise<boolean> {
    await this.initialize();
    return this.client !== null && (await this.client.isHealthy());
  }

  // Get current hardware profile
  getHardwareProfile(): HardwareProfile | null {
    return this.hardwareProfile;
  }

  // Get current tier
  getTier(): HardwareTier | null {
    return this.tier;
  }

  // Get the appropriate model for a task
  getModelForTask(type: 'chat' | 'code' | 'embed' | 'vision'): string | null {
    if (!this.tier) return null;
    return this.tier.models[type] || null;
  }

  // Perform inference
  async infer(request: InferenceRequest): Promise<InferenceResult> {
    await this.initialize();

    const startTime = Date.now();

    // Try local Ollama first
    if (this.client && (await this.client.isHealthy())) {
      const model = this.getModelForTask(request.type);

      if (model && (await this.client.hasModel(model))) {
        try {
          let response: string;

          if (request.type === 'embed') {
            const result = await this.client.embed({
              model,
              input: request.prompt,
            });
            response = JSON.stringify(result.embeddings);
          } else {
            const result = await this.client.chat({
              model,
              messages: [
                ...(request.context
                  ? [{ role: 'system' as const, content: request.context }]
                  : []),
                { role: 'user' as const, content: request.prompt },
              ],
              options: {
                temperature: request.temperature ?? 0.7,
                num_predict: request.maxTokens ?? 1024,
              },
            });
            response = result.response;
          }

          return {
            text: response,
            model,
            provider: 'ollama',
            tokensUsed: 0, // Ollama doesn't always report this
            latencyMs: Date.now() - startTime,
          };
        } catch (error) {
          console.warn('Ollama inference failed:', error);
          // Fall through to fallback
        }
      }
    }

    // Fallback to Cloudflare if enabled
    if (this.config.fallbackToCloudflare) {
      return this.cloudfareFallback(request, startTime);
    }

    throw new Error('No AI provider available');
  }

  // Chat with streaming
  async *chatStream(
    prompt: string,
    context?: string
  ): AsyncGenerator<string> {
    await this.initialize();

    if (!this.client || !(await this.client.isHealthy())) {
      throw new Error('Ollama not available');
    }

    const model = this.getModelForTask('chat');
    if (!model) {
      throw new Error('No chat model configured');
    }

    const stream = this.client.chatStream({
      model,
      messages: [
        ...(context ? [{ role: 'system' as const, content: context }] : []),
        { role: 'user' as const, content: prompt },
      ],
    });

    for await (const chunk of stream) {
      if (chunk.response) {
        yield chunk.response;
      }
    }
  }

  // Code completion
  async completeCode(
    prefix: string,
    suffix?: string,
    language?: string
  ): Promise<string> {
    const context = language
      ? `You are a ${language} code completion assistant. Complete the code naturally.`
      : 'Complete the code naturally.';

    const prompt = suffix
      ? `Complete this code:\n\n${prefix}<CURSOR>${suffix}`
      : `Complete this code:\n\n${prefix}`;

    const result = await this.infer({
      type: 'code',
      prompt,
      context,
      temperature: 0.3, // Lower temperature for code
      maxTokens: 256,
    });

    return result.text;
  }

  // Generate embeddings
  async embed(texts: string[]): Promise<number[][]> {
    await this.initialize();

    if (!this.client || !(await this.client.isHealthy())) {
      throw new Error('Ollama not available for embeddings');
    }

    const model = this.getModelForTask('embed');
    if (!model) {
      throw new Error('No embedding model configured');
    }

    const result = await this.client.embed({
      model,
      input: texts,
    });

    return result.embeddings;
  }

  // List installed models
  async listModels(): Promise<string[]> {
    await this.initialize();

    if (!this.client) return [];

    const models = await this.client.listModels();
    return models.map((m) => m.name);
  }

  // Pull a model
  async pullModel(
    name: string,
    onProgress?: (progress: { status: string; percent?: number }) => void
  ): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Ollama not available');
    }

    await this.client.pullModel(name, (progress) => {
      const percent =
        progress.total && progress.completed
          ? Math.round((progress.completed / progress.total) * 100)
          : undefined;

      onProgress?.({ status: progress.status, percent });
    });
  }

  // Cloudflare fallback (stub - actual implementation in backend)
  private async cloudfareFallback(
    request: InferenceRequest,
    startTime: number
  ): Promise<InferenceResult> {
    // This would call the Cloudflare Workers backend
    // For now, return a placeholder
    return {
      text: '[Cloudflare fallback not implemented in client]',
      model: 'cloudflare',
      provider: 'cloudflare',
      tokensUsed: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  // Shutdown
  async shutdown(): Promise<void> {
    this.client = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}

// Singleton instance
let defaultService: OllamaService | null = null;

export function getOllamaService(config?: OllamaServiceConfig): OllamaService {
  if (!defaultService || config) {
    defaultService = new OllamaService(config);
  }
  return defaultService;
}
