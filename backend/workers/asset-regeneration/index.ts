/**
 * Asset Regeneration System - Main API
 *
 * Entry point for the asset regeneration system.
 * Exports all public APIs for:
 * - Single asset regeneration
 * - Batch processing
 * - Style preservation
 * - Comparison viewing
 * - Cache management
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export * from './types.js';

// ============================================================================
// CORE REGENERATION EXPORTS
// ============================================================================

export {
  Regenerator,
  getRegenerator,
  createRegenerator,
  type RegeneratorConfig,
  type ProgressCallback
} from './regenerator.js';

export {
  SpriteGenerator,
  SpriteGenerationOptions
} from './sprite-generator.js';

export {
  VoxelGenerator,
  VoxelGenerationOptions
} from './voxel-generator.js';

export {
  MeshGenerator,
  MeshGenerationOptions
} from './mesh-generator.js';

// ============================================================================
// BATCH PROCESSING EXPORTS
// ============================================================================

export {
  BatchRegenerator,
  BatchProgressTracker,
  BatchReportGenerator,
  type BatchJob,
  type BatchProgress,
  type BatchReport
} from './batch-regenerator.js';

// ============================================================================
// STYLE PRESERVATION EXPORTS
// ============================================================================

export {
  StylePreserver
} from './style-preserver.js';

// ============================================================================
// CACHE MANAGEMENT EXPORTS
// ============================================================================

export {
  CacheManager,
  getCacheManager,
  initializeCacheManager
} from './cache-manager.js';

// ============================================================================
// COMPARISON VIEWING EXPORTS
// ============================================================================

export {
  ComparisonViewer,
  ComparisonReportGenerator,
  type ViewerConfig,
  type ComparisonReport
} from './comparison-viewer.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

import { Regenerator, getRegenerator, createRegenerator } from './regenerator.js';
import { BatchRegenerator } from './batch-regenerator.js';
import { ComparisonViewer } from './comparison-viewer.js';
import {
  AssetForm,
  RegenerationRequest,
  BatchRegenerationRequest,
  QualityLevel,
  StylePriority
} from './types.js';

/**
 * Quick regeneration of a single asset to all forms
 */
export async function regenerateAsset(
  source: string,
  options?: {
    quality?: QualityLevel;
    stylePriority?: StylePriority;
    forceRegenerate?: boolean;
  }
) {
  const regenerator = await getRegenerator();

  return regenerator.regenerate({
    source,
    quality: options?.quality ?? QualityLevel.STANDARD,
    stylePriority: options?.stylePriority ?? StylePriority.BALANCED,
    forceRegenerate: options?.forceRegenerate ?? false
  });
}

/**
 * Quick batch regeneration
 */
export async function regenerateBatch(
  assetIds: string[],
  options?: {
    quality?: QualityLevel;
    stylePriority?: StylePriority;
    maxConcurrent?: number;
  }
) {
  const regenerator = await getRegenerator();
  const batchRegenerator = new BatchRegenerator(regenerator, {
    maxConcurrent: options?.maxConcurrent ?? 4
  });

  return batchRegenerator.submitBatch({
    assetIds,
    quality: options?.quality ?? QualityLevel.STANDARD,
    stylePriority: options?.stylePriority ?? StylePriority.BALANCED,
    parallel: true
  });
}

/**
 * Get comparison for an asset
 */
export async function compareAsset(assetId: string) {
  const regenerator = await getRegenerator();
  return regenerator.createComparisonView(assetId);
}

/**
 * Clear cache
 */
export async function clearCache() {
  const regenerator = await getRegenerator();
  return regenerator.clearCache();
}

// ============================================================================
// API ROUTE HANDLERS (for use with HTTP frameworks)
// ============================================================================

export const ApiHandlers = {
  /**
   * POST /regenerate/single
   * Regenerate a single asset to all target forms
   */
  async regenerateSingle(request: RegenerationRequest) {
    const regenerator = await getRegenerator();
    return regenerator.regenerate(request);
  },

  /**
   * POST /regenerate/batch
   * Submit a batch regeneration job
   */
  async regenerateBatch(request: BatchRegenerationRequest) {
    const regenerator = await getRegenerator();
    const batchRegenerator = new BatchRegenerator(regenerator, {
      maxConcurrent: request.maxConcurrent ?? 4
    });
    const jobId = await batchRegenerator.submitBatch(request);
    return { jobId };
  },

  /**
   * GET /batch/:jobId
   * Get batch job status
   */
  async getBatchStatus(jobId: string) {
    // This would need shared state between requests
    // In production, use Redis or similar for shared job tracking
    return { jobId, status: 'processing' };
  },

  /**
   * GET /compare/:assetId
   * View comparison of all asset forms
   */
  async getComparison(assetId: string) {
    const regenerator = await getRegenerator();
    return regenerator.createComparisonView(assetId);
  },

  /**
   * POST /style/transfer
   * Transfer style from source to target assets
   */
  async transferStyle(request: {
    sourceAsset: string;
    sourceForm?: AssetForm;
    targetAssets: string[];
    targetForms?: AssetForm[];
    preserveColors?: boolean;
    preserveProportions?: boolean;
    preserveSilhouette?: boolean;
    preserveMaterials?: boolean;
  }) {
    const regenerator = await getRegenerator();
    return regenerator.transferStyle(
      request.sourceAsset,
      request.targetAssets,
      request
    );
  },

  /**
   * GET /cache/status
   * Get cache status
   */
  async getCacheStatus() {
    const regenerator = await getRegenerator();
    return regenerator.getCacheStatus();
  },

  /**
   * DELETE /cache
   * Clear all cache
   */
  async clearCacheEndpoint() {
    const regenerator = await getRegenerator();
    await regenerator.clearCache();
    return { success: true };
  },

  /**
   * DELETE /cache/:assetId
   * Invalidate cache for specific asset
   */
  async invalidateAssetCache(assetId: string) {
    const regenerator = await getRegenerator();
    await regenerator.invalidateAsset(assetId);
    return { success: true };
  }
};

// ============================================================================
// CLOUDFLARE WORKER EXPORT
// ============================================================================

export interface CloudflareWorkerEnv {
  ASSET_BUCKET: R2Bucket;
  CACHE: KVNamespace;
  DB: D1Database;
}

/**
 * Cloudflare Worker entry point
 */
export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Parse request body for POST requests
      let body: any = {};
      if (request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          body = await request.json();
        }
      }

      // Route the request
      let result: any;
      let status = 200;

      switch (true) {
        case path === '/regenerate/single' && request.method === 'POST':
          result = await ApiHandlers.regenerateSingle(body);
          break;

        case path === '/regenerate/batch' && request.method === 'POST':
          result = await ApiHandlers.regenerateBatch(body);
          break;

        case path.startsWith('/batch/') && request.method === 'GET':
          const jobId = path.split('/')[2];
          result = await ApiHandlers.getBatchStatus(jobId);
          break;

        case path.startsWith('/compare/') && request.method === 'GET':
          const assetId = path.split('/')[2];
          result = await ApiHandlers.getComparison(assetId);
          break;

        case path === '/style/transfer' && request.method === 'POST':
          result = await ApiHandlers.transferStyle(body);
          break;

        case path === '/cache/status' && request.method === 'GET':
          result = await ApiHandlers.getCacheStatus();
          break;

        case path === '/cache' && request.method === 'DELETE':
          result = await ApiHandlers.clearCacheEndpoint();
          break;

        case path.startsWith('/cache/') && request.method === 'DELETE':
          const cacheAssetId = path.split('/')[2];
          result = await ApiHandlers.invalidateAssetCache(cacheAssetId);
          break;

        default:
          status = 404;
          result = { error: 'Not found' };
      }

      return new Response(JSON.stringify(result), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
};

// ============================================================================
// VERSION INFO
// ============================================================================

export const VERSION = '1.0.0';

export const INFO = {
  name: 'Asset Regeneration System',
  version: VERSION,
  description: 'Regenerate assets across MicroVerse, Luanti, and OpenRTS forms',
  forms: [
    {
      id: AssetForm.MICROVERSE,
      name: 'MicroVerse',
      description: '2D/2.5D sprite, NES-SNES style'
    },
    {
      id: AssetForm.LUANTI,
      name: 'Luanti',
      description: 'Voxel/blocky model, isometric'
    },
    {
      id: AssetForm.OPENRTS,
      name: 'OpenRTS',
      description: 'Full 3D mesh, PS2+ quality'
    }
  ],
  qualityLevels: [
    QualityLevel.DRAFT,
    QualityLevel.STANDARD,
    QualityLevel.HIGH,
    QualityLevel.ULTRA
  ],
  stylePriorities: [
    StylePriority.COLOR_EXACT,
    StylePriority.BALANCED,
    StylePriority.FORM_FOCUSED
  ]
};
