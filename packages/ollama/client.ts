/**
 * StudyLoG.AI - Ollama Client
 *
 * Wrapper for Ollama API with automatic model management,
 * health checks, and graceful fallback.
 */

import { OLLAMA_DEFAULT_CONFIG, OLLAMA_MODELS, type OllamaModelConfig } from './config';

export interface OllamaOptions {
  host?: string;
  timeout?: number;
  retries?: number;
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
  stream?: boolean;
}

export interface GenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // Base64 encoded images for vision models
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  options?: GenerateOptions['options'];
  stream?: boolean;
}

export interface EmbedOptions {
  model: string;
  input: string | string[];
}

export interface EmbedResponse {
  embeddings: number[][];
}

export interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export class OllamaClient {
  private host: string;
  private timeout: number;
  private retries: number;

  constructor(options: OllamaOptions = {}) {
    this.host = options.host || OLLAMA_DEFAULT_CONFIG.host;
    this.timeout = options.timeout || OLLAMA_DEFAULT_CONFIG.timeout;
    this.retries = options.retries || OLLAMA_DEFAULT_CONFIG.retries;
  }

  // Check if Ollama is running
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // List installed models
  async listModels(): Promise<ModelInfo[]> {
    const response = await this.fetch('/api/tags');
    const data = await response.json();
    return data.models || [];
  }

  // Check if a specific model is installed
  async hasModel(name: string): Promise<boolean> {
    const models = await this.listModels();
    return models.some((m) => m.name === name || m.name.startsWith(`${name}:`));
  }

  // Pull a model with progress callback
  async pullModel(
    name: string,
    onProgress?: (progress: PullProgress) => void
  ): Promise<void> {
    const response = await this.fetch('/api/pull', {
      method: 'POST',
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const progress = JSON.parse(line) as PullProgress;
          onProgress?.(progress);
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  // Delete a model
  async deleteModel(name: string): Promise<void> {
    await this.fetch('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({ name }),
    });
  }

  // Generate completion (non-streaming)
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const response = await this.fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ ...options, stream: false }),
    });

    return response.json();
  }

  // Generate completion (streaming)
  async *generateStream(
    options: GenerateOptions
  ): AsyncGenerator<GenerateResponse> {
    const response = await this.fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ ...options, stream: true }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        yield JSON.parse(line);
      }
    }
  }

  // Chat completion (non-streaming)
  async chat(options: ChatOptions): Promise<GenerateResponse> {
    const response = await this.fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ ...options, stream: false }),
    });

    const data = await response.json();
    return {
      model: options.model,
      response: data.message?.content || '',
      done: true,
      ...data,
    };
  }

  // Chat completion (streaming)
  async *chatStream(options: ChatOptions): AsyncGenerator<GenerateResponse> {
    const response = await this.fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ ...options, stream: true }),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        const data = JSON.parse(line);
        yield {
          model: options.model,
          response: data.message?.content || '',
          done: data.done || false,
          ...data,
        };
      }
    }
  }

  // Generate embeddings
  async embed(options: EmbedOptions): Promise<EmbedResponse> {
    const response = await this.fetch('/api/embed', {
      method: 'POST',
      body: JSON.stringify({
        model: options.model,
        input: options.input,
      }),
    });

    return response.json();
  }

  // Get model info
  async showModel(name: string): Promise<Record<string, unknown>> {
    const response = await this.fetch('/api/show', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    return response.json();
  }

  // Internal fetch with retries and timeout
  private async fetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.host}${path}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Ollama error: ${response.status} - ${error}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on client errors
        if (lastError.message.includes('4')) {
          throw lastError;
        }

        // Exponential backoff
        if (attempt < this.retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError || new Error('Failed after retries');
  }
}

// Convenience functions
export async function createClient(
  options?: OllamaOptions
): Promise<OllamaClient | null> {
  const client = new OllamaClient(options);

  if (await client.isHealthy()) {
    return client;
  }

  return null;
}

// Ensure required models are installed
export async function ensureModels(
  client: OllamaClient,
  models: string[],
  onProgress?: (model: string, progress: PullProgress) => void
): Promise<void> {
  for (const model of models) {
    if (!(await client.hasModel(model))) {
      console.log(`Pulling model: ${model}`);
      await client.pullModel(model, (progress) => {
        onProgress?.(model, progress);
      });
    }
  }
}

// Get model config from our registry
export function getModelConfig(name: string): OllamaModelConfig | undefined {
  // Handle versioned names like "llama3.3:8b"
  const baseName = name.includes(':') ? name : `${name}:latest`;
  return OLLAMA_MODELS[baseName] || OLLAMA_MODELS[name];
}
