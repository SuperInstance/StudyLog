/**
 * Memory Optimizer Worker
 *
 * Cloudflare Worker for optimizing the 6-tier memory system in StudyLoG.AI.
 * Provides endpoints for:
 * - Memory consolidation (episodic -> semantic)
 * - Fast retrieval with embeddings
 * - Temporal landmark detection
 * - Autobiographical narrative generation
 * - Cross-product memory sync (StudyLoG <-> DMLoG)
 *
 * Deploy: wrangler publish
 */

import { Router } from 'itty-router';

// Import memory optimization modules
import {
  MemoryConsolidationEngine,
  type EpisodicMemory,
  type SemanticMemory,
  type ConsolidationConfig,
} from './consolidation.js';

import {
  MemoryRetrievalEngine,
  RetrievalMode,
  type RetrievalOptions,
  type LearningContext,
} from './retrieval.js';

import {
  LandmarkDetector,
  type TemporalLandmark,
  type LandmarkType,
  type LandmarkCluster,
} from './landmarks.js';

import {
  NarrativeBuilder,
  type AutobiographicalNarrative,
  type NarrativeChapter,
} from './narrative-builder.js';

import {
  CrossProductMemorySync,
  Product,
  type UnifiedMemory,
} from './cross-product-sync.js';

// ═══════════════════════════════════════════════════════════
// Environment Types
// ═══════════════════════════════════════════════════════════

export interface Env {
  // KV for caching consolidated memories
  MEMORY_CACHE?: KVNamespace;

  // D1 Database for persistent storage
  DB?: D1Database;

  // Optional: Vector database for production
  VECTOR_DB_URL?: string;
  VECTOR_DB_API_KEY?: string;
}

// ═══════════════════════════════════════════════════════════
// Request/Response Types
// ═══════════════════════════════════════════════════════════

interface StoreMemoryRequest {
  studentId: string;
  content: string;
  subject?: string;
  topic?: string;
  difficulty?: number;
  successLevel?: number;
  importance?: number;
  emotionalValence?: number;
  tags?: string[];
  standards?: string[];
}

interface ConsolidateRequest {
  studentId: string;
  config?: Partial<ConsolidationConfig>;
}

interface RetrieveRequest {
  studentId: string;
  query: string;
  options?: Partial<RetrievalOptions>;
}

interface GenerateNarrativeRequest {
  studentId: string;
  config?: {
    minChapterSize?: number;
    maxChapters?: number;
    namingScheme?: 'descriptive' | 'journey' | 'thematic';
    tone?: 'encouraging' | 'analytical' | 'storytelling';
  };
}

interface SyncMemoriesRequest {
  studentId: string;
  targetProduct: Product;
  direction: 'studylog_to_dmlog' | 'dmlog_to_studylog' | 'bidirectional';
  memories?: any[];
}

// ═══════════════════════════════════════════════════════════
// Router Setup
// ═══════════════════════════════════════════════════════════

const router = Router();

// In-memory storage (for development - use D1 in production)
const consolidationEngines = new Map<string, MemoryConsolidationEngine>();
const retrievalEngines = new Map<string, MemoryRetrievalEngine>();
const landmarkDetectors = new Map<string, LandmarkDetector>();
const narrativeBuilders = new Map<string, NarrativeBuilder>();
const crossProductSyncs = new Map<string, CrossProductMemorySync>();

// ═══════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════

router.get('/', () => {
  return Response.json({
    service: 'Memory Optimizer',
    version: '1.0.0',
    status: 'healthy',
    endpoints: {
      consolidation: '/consolidate',
      retrieval: '/retrieve',
      landmarks: '/landmarks',
      narrative: '/narrative',
      sync: '/sync',
      stats: '/stats/:studentId',
    },
  });
});

// ═══════════════════════════════════════════════════════════
// Memory Storage
// ═══════════════════════════════════════════════════════════

/**
 * POST /memory/store
 * Store a new episodic memory
 */
router.post('/memory/store', async (req, env: Env) => {
  try {
    const body = await req.json() as StoreMemoryRequest;

    // Get or create consolidation engine
    let engine = consolidationEngines.get(body.studentId);
    if (!engine) {
      engine = new MemoryConsolidationEngine();
      consolidationEngines.set(body.studentId, engine);
    }

    // Get or create retrieval engine
    let retrieval = retrievalEngines.get(body.studentId);
    if (!retrieval) {
      retrieval = new MemoryRetrievalEngine();
      retrievalEngines.set(body.studentId, retrieval);
    }

    // Create episodic memory
    const memory: EpisodicMemory = {
      id: `episodic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      studentId: body.studentId,
      content: body.content,
      timestamp: Date.now(),
      importance: body.importance ?? 5,
      emotionalValence: body.emotionalValence ?? 0,
      subject: body.subject,
      topic: body.topic,
      difficulty: body.difficulty,
      successLevel: body.successLevel,
      consolidationState: 'unconsolidated',
      consolidationCount: 0,
      lastConsolidated: Date.now(),
      relatedMemoryIds: [],
      accessCount: 0,
      lastAccessed: Date.now(),
      tags: body.tags ?? [],
      standards: body.standards,
    };

    // Add to consolidation engine
    engine.addEpisodicMemory(memory);

    // Add to retrieval engine
    retrieval.addEpisodicMemory(memory);

    // Detect landmarks
    let detector = landmarkDetectors.get(body.studentId);
    if (!detector) {
      detector = new LandmarkDetector();
      landmarkDetectors.set(body.studentId, detector);
    }

    const detection = detector.detectLandmark(memory);
    let landmark: TemporalLandmark | undefined;
    if (detection.isLandmark) {
      landmark = detector.createLandmark(memory, detection);
    }

    return Response.json({
      success: true,
      memory: {
        id: memory.id,
        timestamp: memory.timestamp,
        importance: memory.importance,
      },
      landmark: landmark ? {
        id: landmark.id,
        type: landmark.type,
        title: landmark.title,
        significance: landmark.significance,
      } : null,
    });
  } catch (error) {
    return Response.json({
      error: 'Failed to store memory',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 400 });
  }
});

// ═══════════════════════════════════════════════════════════
// Consolidation Endpoints
// ═══════════════════════════════════════════════════════════

/**
 * POST /consolidate
 * Run memory consolidation for a student
 */
router.post('/consolidate', async (req, env: Env) => {
  try {
    const body = await req.json() as ConsolidateRequest;
    const { studentId, config } = body;

    let engine = consolidationEngines.get(studentId);
    if (!engine) {
      return Response.json({
        error: 'No memories found for student',
        studentId,
      }, { status: 404 });
    }

    // Run consolidation
    const result = await engine.consolidate(studentId);

    return Response.json({
      success: true,
      studentId,
      consolidation: result,
      stats: engine.getStats(studentId),
    });
  } catch (error) {
    return Response.json({
      error: 'Consolidation failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});

/**
 * GET /consolidate/status/:studentId
 * Check if consolidation is needed
 */
router.get('/consolidate/status/:studentId', (req: any) => {
  const studentId = req.studentId;

  const engine = consolidationEngines.get(studentId);
  if (!engine) {
    return Response.json({
      exists: false,
      needsConsolidation: false,
    });
  }

  const ready = engine.getMemoriesReadyForConsolidation(studentId);

  return Response.json({
    exists: true,
    needsConsolidation: ready.length > 0,
    readyCount: ready.length,
    stats: engine.getStats(studentId),
  });
});

// ═══════════════════════════════════════════════════════════
// Retrieval Endpoints
// ═══════════════════════════════════════════════════════════

/**
 * POST /retrieve
 * Retrieve memories based on query
 */
router.post('/retrieve', async (req, env: Env) => {
  try {
    const body = await req.json() as RetrieveRequest;
    const { studentId, query, options } = body;

    let retrieval = retrievalEngines.get(studentId);
    if (!retrieval) {
      // Initialize with no memories yet
      retrieval = new MemoryRetrievalEngine();
      retrievalEngines.set(studentId, retrieval);
    }

    // Ensure retrieval engine is initialized
    await retrieval.initialize();

    // Retrieve memories
    const results = await retrieval.retrieve(query, {
      topK: options?.topK ?? 10,
      mode: options?.mode ?? RetrievalMode.SEMANTIC,
      minRelevance: options?.minRelevance,
      subject: options?.subject,
      topic: options?.topic,
      tags: options?.tags,
      includeRelated: options?.includeRelated,
      learningContext: options?.learningContext,
    });

    return Response.json({
      success: true,
      query,
      results: results.results.map(r => ({
        memoryId: r.memory.id,
        content: r.memory.content,
        score: r.score,
        relevance: r.relevance,
        reasons: r.matchReasons,
        topic: r.memory.topic,
        importance: r.memory.importance,
      })),
      totalSearched: results.totalSearched,
      filtered: results.filtered,
      queryTimeMs: results.queryTimeMs.toFixed(2),
    });
  } catch (error) {
    return Response.json({
      error: 'Retrieval failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});

/**
 * GET /retrieve/reviews/:studentId
 * Get memories due for review (spaced repetition)
 */
router.get('/retrieve/reviews/:studentId', (req: any) => {
  const studentId = req.studentId;

  const retrieval = retrievalEngines.get(studentId);
  if (!retrieval) {
    return Response.json({
      due: [],
      studentId,
    });
  }

  const due = retrieval.findDueForReview(studentId);

  return Response.json({
    due: due.map(m => ({
      id: m.id,
      concept: m.concept,
      masteryLevel: m.masteryLevel,
      strength: m.strength,
      nextReview: new Date(m.nextReview).toISOString(),
    })),
    studentId,
  });
});

/**
 * GET /retrieve/zpd/:studentId
 * Get memories in the zone of proximal development
 */
router.get('/retrieve/zpd/:studentId', async (req: any, env: Env) => {
  const studentId = req.studentId;
  const skillLevel = parseFloat(req.query?.skillLevel ?? '0.5');
  const subject = req.query?.subject;

  const retrieval = retrievalEngines.get(studentId);
  if (!retrieval) {
    return Response.json({
      zpd: [],
      studentId,
    });
  }

  const zpd = await retrieval.findZPD(studentId, skillLevel, subject);

  return Response.json({
    zpd: zpd.map(z => ({
      concept: z.memory.concept,
      masteryLevel: z.memory.masteryLevel,
      zpdScore: z.zpdScore,
    })),
    studentId,
    currentSkillLevel: skillLevel,
  });
});

// ═══════════════════════════════════════════════════════════
// Landmark Endpoints
// ═══════════════════════════════════════════════════════════

/**
 * GET /landmarks/:studentId
 * Get all landmarks for a student
 */
router.get('/landmarks/:studentId', (req: any) => {
  const studentId = req.studentId;
  const type = req.query?.type as LandmarkType | undefined;

  const detector = landmarkDetectors.get(studentId);
  if (!detector) {
    return Response.json({
      landmarks: [],
      studentId,
    });
  }

  const landmarks = type
    ? detector.getLandmarksByType(studentId, type)
    : detector.getLandmarks(studentId);

  return Response.json({
    landmarks: landmarks.map(l => ({
      id: l.id,
      type: l.type,
      title: l.title,
      timestamp: l.timestamp,
      significance: l.significance,
      topic: l.topic,
    })),
    studentId,
    count: landmarks.length,
  });
});

/**
 * GET /landmarks/:studentId/clusters
 * Get landmark clusters for narrative building
 */
router.get('/landmarks/:studentId/clusters', (req: any) => {
  const studentId = req.studentId;

  const detector = landmarkDetectors.get(studentId);
  if (!detector) {
    return Response.json({
      clusters: [],
      studentId,
    });
  }

  const clusters = detector.clusterLandmarks(studentId);

  return Response.json({
    clusters: clusters.map(c => ({
      id: c.id,
      theme: c.theme,
      timeRange: c.timeRange,
      landmarkCount: c.landmarks.length,
      narrative: c.narrative,
    })),
    studentId,
    count: clusters.length,
  });
});

/**
 * GET /landmarks/:studentId/stats
 * Get temporal profile statistics
 */
router.get('/landmarks/:studentId/stats', (req: any) => {
  const studentId = req.studentId;

  const detector = landmarkDetectors.get(studentId);
  if (!detector) {
    return Response.json({
      error: 'No profile found',
      studentId,
    }, { status: 404 });
  }

  const stats = detector.getProfileStats(studentId);

  return Response.json({
    studentId,
    stats,
  });
});

// ═══════════════════════════════════════════════════════════
// Narrative Endpoints
// ═══════════════════════════════════════════════════════════

/**
 * POST /narrative
 * Generate autobiographical narrative
 */
router.post('/narrative', async (req, env: Env) => {
  try {
    const body = await req.json() as GenerateNarrativeRequest;
    const { studentId, config } = body;

    const consolidation = consolidationEngines.get(studentId);
    const detector = landmarkDetectors.get(studentId);

    if (!consolidation) {
      return Response.json({
        error: 'No memories found for student',
        studentId,
      }, { status: 404 });
    }

    // Get memories
    const episodicMemories = consolidation.exportState().episodicMemories.filter(
      m => m.studentId === studentId
    ) as EpisodicMemory[];
    const semanticMemories = consolidation.exportState().semanticMemories.filter(
      m => m.studentId === studentId
    ) as SemanticMemory[];
    const landmarks = detector?.getLandmarks(studentId) ?? [];
    const landmarkClusters = detector?.clusterLandmarks(studentId) ?? [];

    // Create narrative builder
    const builder = new NarrativeBuilder(config);

    // Build narrative
    const narrative = builder.buildNarrative({
      studentId,
      memories: episodicMemories,
      semanticMemories,
      landmarks,
      landmarkClusters,
    });

    return Response.json({
      success: true,
      narrative: {
        studentId: narrative.studentId,
        title: narrative.title,
        subtitle: narrative.subtitle,
        introduction: narrative.introduction,
        conclusion: narrative.conclusion,
        themes: narrative.themes,
        chapters: narrative.chapters.map(c => ({
          id: c.id,
          title: c.title,
          period: c.period,
          summary: c.summary,
          topics: c.topicsLearned,
          emotionalTone: c.emotionalTone,
        })),
        growth: narrative.growthDimensions.map(g => ({
          name: g.name,
          startLevel: g.startLevel,
          endLevel: g.endLevel,
          growth: g.growth,
        })),
        totalMemories: narrative.totalMemories,
        timeSpan: narrative.timeSpan,
      },
    });
  } catch (error) {
    return Response.json({
      error: 'Narrative generation failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});

/**
 * GET /narrative/:studentId/markdown
 * Export narrative as markdown
 */
router.get('/narrative/:studentId/markdown', async (req: any, env: Env) => {
  const studentId = req.studentId;

  const consolidation = consolidationEngines.get(studentId);
  const detector = landmarkDetectors.get(studentId);

  if (!consolidation) {
    return Response.json({
      error: 'No memories found',
    }, { status: 404 });
  }

  const episodicMemories = consolidation.exportState().episodicMemories.filter(
    m => m.studentId === studentId
  ) as EpisodicMemory[];
  const semanticMemories = consolidation.exportState().semanticMemories.filter(
    m => m.studentId === studentId
  ) as SemanticMemory[];
  const landmarks = detector?.getLandmarks(studentId) ?? [];

  const builder = new NarrativeBuilder();
  const narrative = builder.buildNarrative({
    studentId,
    memories: episodicMemories,
    semanticMemories,
    landmarks,
  });

  const markdown = builder.toMarkdown(narrative);

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
});

// ═══════════════════════════════════════════════════════════
// Cross-Product Sync Endpoints
// ═══════════════════════════════════════════════════════════

/**
 * POST /sync
 * Sync memories between products
 */
router.post('/sync', async (req, env: Env) => {
  try {
    const body = await req.json() as SyncMemoriesRequest;
    const { studentId, targetProduct, direction, memories } = body;

    // Get or create sync engine
    let sync = crossProductSyncs.get(studentId);
    if (!sync) {
      sync = new CrossProductMemorySync();
      crossProductSyncs.set(studentId, sync);
    }

    let result;

    if (direction === 'studylog_to_dmlog') {
      const consolidation = consolidationEngines.get(studentId);
      if (!consolidation) {
        return Response.json({
          error: 'No StudyLoG memories found',
        }, { status: 404 });
      }

      const episodicMemories = consolidation.exportState().episodicMemories.filter(
        m => m.studentId === studentId
      ) as EpisodicMemory[];
      const semanticMemories = consolidation.exportState().semanticMemories.filter(
        m => m.studentId === studentId
      ) as SemanticMemory[];

      result = await sync.syncStudyLogToDmLog(episodicMemories, semanticMemories);
    } else if (direction === 'dmlog_to_studylog') {
      if (!memories) {
        return Response.json({
          error: 'DMLoG memories required',
        }, { status: 400 });
      }
      result = await sync.syncDmLogToStudyLog(memories);
    } else {
      return Response.json({
        error: 'Bidirectional sync not yet implemented',
      }, { status: 501 });
    }

    return Response.json({
      success: true,
      studentId,
      targetProduct,
      direction,
      result,
    });
  } catch (error) {
    return Response.json({
      error: 'Sync failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
});

/**
 * GET /sync/:studentId/unified
 * Get unified memories for a student
 */
router.get('/sync/:studentId/unified', (req: any) => {
  const studentId = req.studentId;
  const product = req.query?.product as Product | undefined;

  const sync = crossProductSyncs.get(studentId);
  if (!sync) {
    return Response.json({
      unified: [],
      studentId,
    });
  }

  const unified = sync.getUnifiedMemories(studentId, product);

  return Response.json({
    unified: unified.map(u => ({
      id: u.id,
      sourceProduct: u.sourceProduct,
      content: u.content,
      category: u.category,
      timestamp: u.timestamp,
      syncedTo: u.syncedTo,
    })),
    studentId,
    count: unified.length,
  });
});

// ═══════════════════════════════════════════════════════════
// Statistics Endpoint
// ═══════════════════════════════════════════════════════════

/**
 * GET /stats/:studentId
 * Get comprehensive statistics for a student
 */
router.get('/stats/:studentId', (req: any) => {
  const studentId = req.studentId;

  const consolidation = consolidationEngines.get(studentId);
  const retrieval = retrievalEngines.get(studentId);
  const detector = landmarkDetectors.get(studentId);
  const sync = crossProductSyncs.get(studentId);

  const stats: Record<string, unknown> = {
    studentId,
    timestamp: Date.now(),
  };

  if (consolidation) {
    stats.consolidation = consolidation.getStats(studentId);
  }

  if (retrieval) {
    stats.retrieval = retrieval.getStats();
  }

  if (detector) {
    stats.landmarks = detector.getProfileStats(studentId);
  }

  if (sync) {
    stats.sync = sync.getSyncStats();
  }

  return Response.json(stats);
});

/**
 * DELETE /stats/:studentId
 * Clear all data for a student
 */
router.delete('/stats/:studentId', (req: any) => {
  const studentId = req.studentId;

  consolidationEngines.delete(studentId);
  retrievalEngines.delete(studentId);
  landmarkDetectors.delete(studentId);
  narrativeBuilders.delete(studentId);
  crossProductSyncs.delete(studentId);

  return Response.json({
    success: true,
    message: `All data cleared for student ${studentId}`,
  });
});

// ═══════════════════════════════════════════════════════════
// Cloudflare Worker Handler
// ═══════════════════════════════════════════════════════════

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    return router
      .handle(request, env, ctx)
      .catch((error: Error) => {
        return Response.json({
          error: 'Internal server error',
          message: error.message,
        }, { status: 500 });
      });
  },
} satisfies ExportedHandler<Env>;

// ═══════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════

export * from './consolidation.js';
export * from './retrieval.js';
export * from './landmarks.js';
export * from './narrative-builder.js';
export * from './cross-product-sync.js';
