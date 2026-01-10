/**
 * Vector Database Integration - Main Entry Point
 *
 * Cloudflare Worker for embeddings, vector search, and RAG.
 */

import { EmbeddingService, createEmbeddingService } from './embeddings';
import { RAGPipeline, createRAGPipeline } from './rag';
import type {
  EmbeddingRequest,
  VectorSearchRequest,
  RAGQueryRequest,
  KnowledgeBaseConfig,
  Env,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ============================================================================
// Worker Fetch Handler
// ============================================================================

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check
      if (pathname === '/health') {
        return Response.json({
          status: 'healthy',
          service: 'vector-db',
          version: '1.0.0',
        }, { headers: corsHeaders });
      }

      // Embedding endpoints
      if (pathname === '/v1/embeddings' && request.method === 'POST') {
        return await handleEmbeddings(request, env);
      }

      // Vector search endpoints
      if (pathname === '/v1/search' && request.method === 'POST') {
        return await handleVectorSearch(request, env);
      }

      // RAG endpoints
      if (pathname === '/v1/rag/query' && request.method === 'POST') {
        return await handleRAGQuery(request, env);
      }

      if (pathname === '/v1/rag/stream' && request.method === 'POST') {
        return await handleRAGStream(request, env);
      }

      // Document ingestion
      if (pathname === '/v1/documents' && request.method === 'POST') {
        return await handleAddDocument(request, env);
      }

      if (pathname.match(/^\/v1\/documents\/[^/]+$/) && request.method === 'DELETE') {
        const docId = pathname.split('/')[3];
        return await handleDeleteDocument(docId, env);
      }

      // Knowledge base management
      if (pathname === '/v1/knowledge-bases' && request.method === 'GET') {
        return await handleListKnowledgeBases(request, env);
      }

      if (pathname === '/v1/knowledge-bases' && request.method === 'POST') {
        return await handleCreateKnowledgeBase(request, env);
      }

      if (pathname.match(/^\/v1\/knowledge-bases\/[^/]+$/) && request.method === 'GET') {
        const namespace = pathname.split('/')[3];
        return await handleGetKnowledgeBase(namespace, env);
      }

      // Cache management
      if (pathname === '/v1/cache/stats' && request.method === 'GET') {
        return await handleCacheStats(env);
      }

      if (pathname === '/v1/cache/clear' && request.method === 'POST') {
        return await handleClearCache(request, env);
      }

      // 404
      return new Response(JSON.stringify({
        error: 'Not found',
        path: pathname,
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error('Vector DB error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};

// ============================================================================
// Route Handlers
// ============================================================================

async function handleEmbeddings(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as EmbeddingRequest;
  const embeddingService = createEmbeddingService(env);

  const result = await embeddingService.embed(body);

  return Response.json(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleVectorSearch(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as VectorSearchRequest;
  const rag = createRAGPipeline(env);

  // @ts-ignore - access private method via RAGPipeline
  const results = await rag.searchVectors(body);

  return Response.json({
    results,
    count: results.length,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRAGQuery(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as RAGQueryRequest;
  const rag = createRAGPipeline(env);

  const result = await rag.query(body);

  return Response.json(result, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleRAGStream(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as RAGQueryRequest;
  const rag = createRAGPipeline(env);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of rag.queryStream(body)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function handleAddDocument(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  const rag = createRAGPipeline(env);

  const chunks = await rag.addDocument({
    namespace: body.namespace,
    content: body.content,
    metadata: body.metadata,
    tenantId: body.tenantId,
    chunkSize: body.chunkSize,
    chunkOverlap: body.chunkOverlap,
  });

  return Response.json({
    success: true,
    chunksCreated: chunks.length,
    chunks: chunks.map(c => ({
      id: c.id,
      chunkIndex: c.chunkIndex,
    })),
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleDeleteDocument(docId: string, env: Env): Promise<Response> {
  const rag = createRAGPipeline(env);
  await rag.deleteDocument(docId);

  return Response.json({
    success: true,
    message: 'Document deleted',
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleListKnowledgeBases(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get('tenantId') || undefined;

  const rag = createRAGPipeline(env);
  const knowledgeBases = await rag.listKnowledgeBase(tenantId);

  return Response.json({
    knowledgeBases,
    count: knowledgeBases.length,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCreateKnowledgeBase(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as KnowledgeBaseConfig;
  const rag = createRAGPipeline(env);

  await rag.createKnowledgeBase(body);

  return Response.json({
    success: true,
    namespace: body.namespace,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetKnowledgeBase(namespace: string, env: Env): Promise<Response> {
  const rag = createRAGPipeline(env);
  const kb = await rag.getKnowledgeBaseConfig(namespace);

  if (!kb) {
    return new Response(JSON.stringify({
      error: 'Knowledge base not found',
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return Response.json(kb, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCacheStats(env: Env): Promise<Response> {
  const embeddingService = createEmbeddingService(env);
  const stats = await embeddingService.getCacheStats();

  return Response.json(stats, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleClearCache(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const model = url.searchParams.get('model') as any || undefined;

  const embeddingService = createEmbeddingService(env);
  const count = await embeddingService.clearCache(model);

  return Response.json({
    success: true,
    cleared: count,
  }, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// Exports
// ============================================================================

export { EmbeddingService, RAGPipeline, createEmbeddingService, createRAGPipeline };
export type { Env, EmbeddingRequest, VectorSearchRequest, RAGQueryRequest, KnowledgeBaseConfig };
