/**
 * Embedding Service
 *
 * Generate embeddings using Cloudflare AI or external providers.
 * Includes caching and batch processing.
 */

import type {
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingModel,
  EmbeddingCacheEntry,
  Env,
} from './types';

// ============================================================================
// Embedding Provider Configuration
// ============================================================================

interface EmbeddingProviderConfig {
  name: string;
  model: EmbeddingModel;
  dimensions: number;
  costPerMillionTokens: number;
  batchSize: number;
}

const EMBEDDING_PROVIDERS: Record<EmbeddingModel, EmbeddingProviderConfig> = {
  // Cloudflare AI (via OpenAI)
  'text-embedding-ada-002': {
    name: 'openai',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    costPerMillionTokens: 0.10,
    batchSize: 100,
  },
  'text-embedding-3-small': {
    name: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    costPerMillionTokens: 0.02,
    batchSize: 100,
  },
  'text-embedding-3-large': {
    name: 'openai',
    model: 'text-embedding-3-large',
    dimensions: 3072,
    costPerMillionTokens: 0.13,
    batchSize: 100,
  },
  // Jina AI
  'jina-embeddings-v2': {
    name: 'jina',
    model: 'jina-embeddings-v2',
    dimensions: 768,
    costPerMillionTokens: 0.01,
    batchSize: 100,
  },
  // BGE models (local/external)
  'bge-small-en': {
    name: 'bge',
    model: 'bge-small-en',
    dimensions: 384,
    costPerMillionTokens: 0,
    batchSize: 50,
  },
  'bge-base-en': {
    name: 'bge',
    model: 'bge-base-en',
    dimensions: 768,
    costPerMillionTokens: 0,
    batchSize: 50,
  },
  // E5
  'e5-large-v2': {
    name: 'e5',
    model: 'e5-large-v2',
    dimensions: 1024,
    costPerMillionTokens: 0,
    batchSize: 50,
  },
  // Cohere
  'cohere-embed-v3': {
    name: 'cohere',
    model: 'cohere-embed-v3',
    dimensions: 1024,
    costPerMillionTokens: 0.05,
    batchSize: 96,
  },
};

// ============================================================================
// Embedding Service Class
// ============================================================================

export class EmbeddingService {
  private db: D1Database;
  private cache: KVNamespace;
  private ai?: Ai;
  private apiKey?: string;

  constructor(env: Env) {
    this.db = env.DB;
    this.cache = env.CACHE;
    this.ai = env.AI;
    this.apiKey = env.OPENAI_API_KEY;
  }

  // ========================================================================
  // Public Methods
  // ========================================================================

  /**
   * Generate embeddings for input text(s).
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model || 'text-embedding-ada-002';
    const config = EMBEDDING_PROVIDERS[model];

    // Normalize input to array
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    // Check cache for each input
    const cached: { index: number; embedding: number[] }[] = [];
    const toEmbed: { index: number; text: string }[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const cachedEntry = await this.getFromCache(inputs[i], model);
      if (cachedEntry) {
        cached.push({ index: i, embedding: cachedEntry.embedding });
      } else {
        toEmbed.push({ index: i, text: inputs[i] });
      }
    }

    // Generate embeddings for uncached inputs
    const newEmbeddings = await this.generateEmbeddings(
      toEmbed.map(e => e.text),
      config
    );

    // Cache new embeddings
    for (let i = 0; i < toEmbed.length; i++) {
      await this.setInCache(toEmbed[i].text, model, newEmbeddings[i]);
    }

    // Merge cached and new embeddings
    const embeddings: number[][] = new Array(inputs.length);
    for (const { index, embedding } of cached) {
      embeddings[index] = embedding;
    }
    for (let i = 0; i < toEmbed.length; i++) {
      embeddings[toEmbed[i].index] = newEmbeddings[i];
    }

    // Calculate cost and tokens
    const totalChars = inputs.join('').length;
    const estimatedTokens = Math.ceil(totalChars / 4);
    const cost = (estimatedTokens / 1_000_000) * config.costPerMillionTokens;

    return {
      embeddings,
      model,
      dimensions: config.dimensions,
      tokens: estimatedTokens,
      cost,
    };
  }

  /**
   * Generate embedding for single text (convenience method).
   */
  async embedSingle(text: string, model?: EmbeddingModel): Promise<number[]> {
    const response = await this.embed({ input: text, model });
    return response.embeddings[0];
  }

  // ========================================================================
  // Provider Implementations
  // ========================================================================

  /**
   * Generate embeddings using appropriate provider.
   */
  private async generateEmbeddings(
    texts: string[],
    config: EmbeddingProviderConfig
  ): Promise<number[][]> {
    switch (config.name) {
      case 'openai':
        return this.embedWithOpenAI(texts, config);

      case 'jina':
        return this.embedWithJina(texts, config);

      case 'bge':
        return this.embedWithBGE(texts, config);

      case 'cohere':
        return this.embedWithCohere(texts, config);

      default:
        throw new Error(`Unknown provider: ${config.name}`);
    }
  }

  /**
   * Embed with OpenAI (via Cloudflare AI or direct API).
   */
  private async embedWithOpenAI(
    texts: string[],
    config: EmbeddingProviderConfig
  ): Promise<number[][]> {
    // Try Cloudflare AI first (faster, local)
    if (this.ai) {
      try {
        const results: number[][] = [];

        // Process in batches
        for (let i = 0; i < texts.length; i += config.batchSize) {
          const batch = texts.slice(i, i + config.batchSize);

          const response = await this.ai.run(
            '@cf/openai/text-embedding-ada-002',
            { text: batch.length === 1 ? batch[0] : batch }
          ) as any;

          if (Array.isArray(response)) {
            results.push(...response.map((r: any) => r.data || r));
          } else if (response.data) {
            results.push(response.data);
          } else {
            results.push(response);
          }
        }

        return results;
      } catch (error) {
        console.warn('Cloudflare AI embedding failed, falling back to API:', error);
      }
    }

    // Fallback to OpenAI API
    if (!this.apiKey) {
      throw new Error('OpenAI API key required for embedding generation');
    }

    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += config.batchSize) {
      const batch = texts.slice(i, i + config.batchSize);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          input: batch,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      results.push(...data.data.map((d: any) => d.embedding));
    }

    return results;
  }

  /**
   * Embed with Jina AI.
   */
  private async embedWithJina(
    texts: string[],
    config: EmbeddingProviderConfig
  ): Promise<number[][]> {
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
      throw new Error('Jina API key required');
    }

    const results: number[][] = [];

    for (const text of texts) {
      const response = await fetch('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'jina-embeddings-v2',
          input: [text],
        }),
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.statusText}`);
      }

      const data = await response.json();
      results.push(data.data[0].embedding);
    }

    return results;
  }

  /**
   * Embed with BGE (would require external service).
   */
  private async embedWithBGE(
    texts: string[],
    config: EmbeddingProviderConfig
  ): Promise<number[][]> {
    // For BGE, we'd call an external service or use local model
    // For now, fallback to OpenAI-compatible endpoint
    return this.embedWithOpenAI(texts, config);
  }

  /**
   * Embed with Cohere.
   */
  private async embedWithCohere(
    texts: string[],
    config: EmbeddingProviderConfig
  ): Promise<number[][]> {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error('Cohere API key required');
    }

    const response = await fetch('https://api.cohere.ai/v1/embed', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'embed-english-v3.0',
        texts,
        input_type: 'search_document',
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings;
  }

  // ========================================================================
  // Cache Management
  // ========================================================================

  /**
   * Get embedding from cache.
   */
  private async getFromCache(
    text: string,
    model: EmbeddingModel
  ): Promise<EmbeddingCacheEntry | null> {
    const key = this.getCacheKey(text, model);
    const cached = await this.cache.get(key, 'json');

    if (cached) {
      const entry = cached as EmbeddingCacheEntry;
      // Update hit count and last accessed
      await this.db.prepare(`
        UPDATE embedding_cache
        SET hits = hits + 1, last_accessed_at = ?
        WHERE key = ?
      `).bind(new Date().toISOString(), key).run();

      return entry;
    }

    return null;
  }

  /**
   * Store embedding in cache.
   */
  private async setInCache(
    text: string,
    model: EmbeddingModel,
    embedding: number[]
  ): Promise<void> {
    const key = this.getCacheKey(text, model);
    const now = new Date().toISOString();
    const ttl = 86400; // 24 hours

    const entry: EmbeddingCacheEntry = {
      key,
      input: text,
      embedding,
      model,
      cachedAt: now,
      ttl,
      hits: 0,
      lastAccessedAt: now,
    };

    // Store in KV
    await this.cache.put(key, JSON.stringify(embedding), {
      expirationTtl: ttl,
    });

    // Store metadata in D1
    await this.db.prepare(`
      INSERT INTO embedding_cache (
        key, input, model, cached_at, ttl, hits, last_accessed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET
        hits = hits + 1,
        last_accessed_at = excluded.last_accessed_at
    `).bind(
      key,
      text.substring(0, 1000), // Truncate for storage
      model,
      now,
      ttl,
      0,
      now
    ).run();
  }

  /**
   * Generate cache key for text and model.
   */
  private getCacheKey(text: string, model: EmbeddingModel): string {
    // Simple hash for cache key
    const content = `${model}:${text}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `embedding:${model}:${Math.abs(hash).toString(36)}`;
  }

  /**
   * Clear cache entries.
   */
  async clearCache(model?: EmbeddingModel): Promise<number> {
    let query = 'DELETE FROM embedding_cache';
    const params: string[] = [];

    if (model) {
      query += ' WHERE model = ?';
      params.push(model);
    }

    const result = await this.db.prepare(query).bind(...params).run();
    return result.meta.changes || 0;
  }

  /**
   * Get cache statistics.
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    hitRate: number;
    byModel: Record<string, number>;
  }> {
    const stats = await this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(hits) as total_hits,
        model,
        COUNT(*) as count
      FROM embedding_cache
      GROUP BY model
    `).all();

    const byModel: Record<string, number> = {};
    let totalEntries = 0;
    let totalHits = 0;

    for (const row of (stats.results || [])) {
      byModel[row.model] = row.count;
      totalEntries += row.total;
      totalHits += row.total_hits;
    }

    return {
      totalEntries,
      totalHits,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
      byModel,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create embedding service from environment.
 */
export function createEmbeddingService(env: Env): EmbeddingService {
  return new EmbeddingService(env);
}
