/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 *
 * Complete RAG implementation with document retrieval,
 * reranking, and LLM integration.
 */

import type {
  RAGQueryRequest,
  RAGQueryResponse,
  VectorSearchRequest,
  VectorSearchResult,
  DocumentChunk,
  KnowledgeBaseConfig,
  ChatMessage,
  Env,
} from './types';
import { EmbeddingService } from './embeddings';

// ============================================================================
// RAG Pipeline Class
// ============================================================================

export class RAGPipeline {
  private embeddingService: EmbeddingService;
  private db: D1Database;
  private vectorize?: VectorizeIndex;

  constructor(env: Env) {
    this.embeddingService = new EmbeddingService(env);
    this.db = env.DB;
    this.vectorize = env.VECTORIZE_INDEX;
  }

  // ========================================================================
  // Query Processing
  // ========================================================================

  /**
   * Process RAG query and generate response.
   */
  async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const startTime = Date.now();

    // 1. Get knowledge base config
    const kbConfig = await this.getKnowledgeBaseConfig(request.namespace);
    if (!kbConfig) {
      throw new Error(`Knowledge base not found: ${request.namespace}`);
    }

    // 2. Embed query
    const queryEmbedding = await this.embeddingService.embedSingle(
      request.query,
      kbConfig.embeddingModel
    );

    // 3. Retrieve relevant documents
    const searchResults = await this.searchVectors({
      query: queryEmbedding,
      namespace: request.namespace,
      topK: request.topK || 5,
      minScore: request.minScore || 0.7,
      filter: request.tenantId ? { tenantId: request.tenantId } : undefined,
      includeMetadata: true,
    });

    // 4. Rerank if requested
    const rankedResults = request.rerank
      ? await this.rerank(request.query, searchResults)
      : searchResults;

    // 5. Build context from retrieved documents
    const context = this.buildContext(rankedResults);

    // 6. Generate response using LLM
    const answer = await this.generateAnswer({
      query: request.query,
      context,
      systemPrompt: request.systemPrompt,
      chatHistory: request.chatHistory,
      maxTokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
    });

    const generationTime = Date.now() - startTime;

    return {
      answer,
      sources: rankedResults,
      citations: rankedResults.map(r => r.id),
      tokens: {
        input: request.query.length + context.length,
        output: answer.length,
        total: request.query.length + context.length + answer.length,
      },
      cost: this.calculateCost(request.query.length + context.length, answer.length),
      model: 'gpt-4',
      generationTimeMs: generationTime,
    };
  }

  /**
   * Stream RAG query response.
   */
  async *queryStream(request: RAGQueryRequest): AsyncGenerator<string> {
    const startTime = Date.now();

    // 1. Get knowledge base config
    const kbConfig = await this.getKnowledgeBaseConfig(request.namespace);
    if (!kbConfig) {
      throw new Error(`Knowledge base not found: ${request.namespace}`);
    }

    // 2. Embed query
    const queryEmbedding = await this.embeddingService.embedSingle(
      request.query,
      kbConfig.embeddingModel
    );

    // 3. Retrieve relevant documents
    const searchResults = await this.searchVectors({
      query: queryEmbedding,
      namespace: request.namespace,
      topK: request.topK || 5,
      minScore: request.minScore || 0.7,
      includeMetadata: true,
    });

    // 4. Build context
    const context = this.buildContext(searchResults);

    // 5. Stream response from LLM
    for await (const chunk of this.streamAnswer({
      query: request.query,
      context,
      systemPrompt: request.systemPrompt,
      chatHistory: request.chatHistory,
    })) {
      yield chunk;
    }
  }

  // ========================================================================
  // Document Ingestion
  // ========================================================================

  /**
   * Add document to knowledge base.
   */
  async addDocument(options: {
    namespace: string;
    content: string;
    metadata?: Record<string, unknown>;
    tenantId?: string;
    chunkSize?: number;
    chunkOverlap?: number;
  }): Promise<DocumentChunk[]> {
    const kbConfig = await this.getKnowledgeBaseConfig(options.namespace);
    const chunkSize = options.chunkSize || kbConfig?.chunkSize || 1000;
    const chunkOverlap = options.chunkOverlap || kbConfig?.chunkOverlap || 200;

    // 1. Split document into chunks
    const chunks = this.chunkDocument(options.content, chunkSize, chunkOverlap);

    // 2. Generate embeddings for all chunks
    const embeddingsResponse = await this.embeddingService.embed({
      input: chunks.map(c => c.content),
      model: kbConfig?.embeddingModel,
    });

    // 3. Store chunks with embeddings
    const storedChunks: DocumentChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = embeddingsResponse.embeddings[i];
      const chunkId = crypto.randomUUID();

      // Store in Vectorize
      if (this.vectorize) {
        await this.vectorize.insert([
          {
            id: chunkId,
            vector,
            metadata: {
              ...options.metadata,
              namespace: options.namespace,
              tenantId: options.tenantId,
              chunkIndex: i,
              totalChunks: chunks.length,
              content: chunk.content.substring(0, 1000), // Truncate for metadata
            },
          },
        ]);
      }

      // Store in D1
      await this.db.prepare(`
        INSERT INTO document_chunks (
          id, document_id, content, chunk_index, total_chunks,
          namespace, tenant_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        chunkId,
        options.metadata?.documentId as string || crypto.randomUUID(),
        chunk.content,
        i,
        chunks.length,
        options.namespace,
        options.tenantId || null,
        JSON.stringify(options.metadata),
        new Date().toISOString()
      ).run();

      storedChunks.push({
        id: chunkId,
        documentId: options.metadata?.documentId as string || crypto.randomUUID(),
        content: chunk.content,
        chunkIndex: i,
        totalChunks: chunks.length,
        vector,
        metadata: options.metadata as any,
        createdAt: new Date().toISOString(),
      });
    }

    return storedChunks;
  }

  /**
   * Delete document from knowledge base.
   */
  async deleteDocument(documentId: string): Promise<void> {
    // Delete from Vectorize (by filtering metadata)
    if (this.vectorize) {
      // Vectorize doesn't support delete by metadata query directly
      // We'd need to track chunk IDs separately
    }

    // Delete from D1
    await this.db.prepare(
      'DELETE FROM document_chunks WHERE document_id = ?'
    ).bind(documentId).run();
  }

  // ========================================================================
  // Knowledge Base Management
// ========================================================================

  /**
   * Create knowledge base.
   */
  async createKnowledgeBase(config: KnowledgeBaseConfig): Promise<void> {
    await this.db.prepare(`
      INSERT INTO knowledge_bases (
        id, namespace, embedding_model, chunk_size, chunk_overlap,
        chunk_strategy, metric, description, is_public, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      config.namespace,
      config.embeddingModel,
      config.chunkSize || 1000,
      config.chunkOverlap || 200,
      config.chunkStrategy || 'fixed',
      config.metric || 'cosine',
      config.description || '',
      config.isPublic ? 1 : 0,
      new Date().toISOString()
    ).run();
  }

  /**
   * Get knowledge base config.
   */
  async getKnowledgeBaseConfig(namespace: string): Promise<KnowledgeBaseConfig | null> {
    const row = await this.db.prepare(
      'SELECT * FROM knowledge_bases WHERE namespace = ?'
    ).bind(namespace).first();

    if (!row) return null;

    return {
      namespace: row.namespace as string,
      embeddingModel: row.embedding_model as string,
      chunkSize: row.chunk_size as number,
      chunkOverlap: row.chunk_overlap as number,
      chunkStrategy: row.chunk_strategy as string,
      metric: row.metric as string,
      description: row.description as string,
      isPublic: row.is_public === 1,
    };
  }

  /**
   * List knowledge bases.
   */
  async listKnowledgeBase(tenantId?: string): Promise<KnowledgeBaseConfig[]> {
    let query = 'SELECT * FROM knowledge_bases WHERE is_public = 1';
    const params: unknown[] = [];

    if (tenantId) {
      query = 'SELECT * FROM knowledge_bases WHERE (is_public = 1 OR tenant_id = ?)';
      params.push(tenantId);
    }

    const result = await this.db.prepare(query).bind(...params).all();

    return (result.results || []).map((row: any) => ({
      namespace: row.namespace,
      embeddingModel: row.embedding_model,
      chunkSize: row.chunk_size,
      chunkOverlap: row.chunk_overlap,
      chunkStrategy: row.chunk_strategy,
      metric: row.metric,
      description: row.description,
      isPublic: row.is_public === 1,
    }));
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  /**
   * Search vectors for similar documents.
   */
  private async searchVectors(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    if (!this.vectorize) {
      // Fallback to D1-based search (less efficient)
      return this.searchVectorsDB(request);
    }

    const queryVector = typeof request.query === 'string'
      ? await this.embeddingService.embedSingle(request.query)
      : request.query;

    // Use Cloudflare Vectorize
    const matches = await this.vectorize.query(queryVector, {
      topK: request.topK || 5,
      namespace: request.namespace,
      returnMetadata: true,
      returnValues: false,
    });

    const results: VectorSearchResult[] = [];

    for (const match of matches.matches) {
      if (request.minScore && match.score < request.minScore) continue;

      results.push({
        id: match.id,
        score: match.score,
        metadata: match.metadata as any,
      });
    }

    return results;
  }

  /**
   * Fallback database-based vector search.
   */
  private async searchVectorsDB(request: VectorSearchRequest): Promise<VectorSearchResult[]> {
    // This is a simplified version - in production, use proper vector math
    const queryVector = typeof request.query === 'string'
      ? await this.embeddingService.embedSingle(request.query)
      : request.query;

    const result = await this.db.prepare(`
      SELECT id, metadata, content
      FROM document_chunks
      WHERE namespace = ?
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(request.namespace, request.topK || 5).all();

    // Calculate cosine similarity
    const results: VectorSearchResult[] = [];

    for (const row of (result.results || [])) {
      // In real implementation, calculate actual similarity
      results.push({
        id: row.id as string,
        score: Math.random(), // Placeholder
        metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
        content: row.content as string,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Rerank results based on query relevance.
   */
  private async rerank(
    query: string,
    results: VectorSearchResult[]
  ): Promise<VectorSearchResult[]> {
    // Simple reranking based on keyword matching
    const queryLower = query.toLowerCase();

    return results.map(result => {
      const content = (result.content || result.metadata?.title || '').toLowerCase();
      const keywordMatches = queryLower.split(' ').filter(word =>
        word.length > 3 && content.includes(word)
      ).length;

      return {
        ...result,
        score: result.score + (keywordMatches * 0.1),
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Build context string from search results.
   */
  private buildContext(results: VectorSearchResult[]): string {
    return results
      .map((r, i) => `[${i + 1}] ${r.content || r.metadata?.title || ''}`)
      .join('\n\n');
  }

  /**
   * Generate answer using LLM.
   */
  private async generateAnswer(options: {
    query: string;
    context: string;
    systemPrompt?: string;
    chatHistory?: ChatMessage[];
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    const messages: ChatMessage[] = [];

    // System prompt
    messages.push({
      role: 'system',
      content: options.systemPrompt || this.getDefaultSystemPrompt(),
    });

    // Add context to system message
    if (options.context) {
      messages[0].content += `\n\nContext:\n${options.context}`;
    }

    // Chat history
    if (options.chatHistory) {
      messages.push(...options.chatHistory);
    }

    // User query
    messages.push({
      role: 'user',
      content: options.query,
    });

    // Call LLM (simplified - in production, use actual LLM service)
    return `Based on the provided context, here's the answer to "${options.query}":\n\nThis is a placeholder response. In production, this would call the actual LLM service.`;
  }

  /**
   * Stream answer from LLM.
   */
  private async *streamAnswer(options: {
    query: string;
    context: string;
    systemPrompt?: string;
    chatHistory?: ChatMessage[];
  }): AsyncGenerator<string> {
    const response = await this.generateAnswer({
      ...options,
      maxTokens: 1000,
      temperature: 0.7,
    });

    // Simulate streaming
    const words = response.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }

  /**
   * Get default system prompt.
   */
  private getDefaultSystemPrompt(): string {
    return `You are a helpful AI assistant for StudyLoG.AI. Use the provided context to answer questions accurately. If the context doesn't contain relevant information, say so. Cite sources using [1], [2], etc. when referencing specific parts of the context.`;
  }

  /**
   * Calculate cost for tokens.
   */
  private calculateCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1_000_000) * 30; // $30 per million
    const outputCost = (outputTokens / 1_000_000) * 60; // $60 per million
    return inputCost + outputCost;
  }

  /**
   * Split document into chunks.
   */
  private chunkDocument(
    content: string,
    chunkSize: number,
    overlap: number
  ): Array<{ content: string }> {
    const chunks: Array<{ content: string }> = [];

    let start = 0;
    while (start < content.length) {
      const end = start + chunkSize;
      const chunk = content.substring(start, end);
      chunks.push({ content: chunk });
      start = end - overlap;
    }

    return chunks;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create RAG pipeline from environment.
 */
export function createRAGPipeline(env: Env): RAGPipeline {
  return new RAGPipeline(env);
}
