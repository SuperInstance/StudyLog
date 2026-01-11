/**
 * Asset Level of Detail (LOD) Module
 *
 * Manages LOD levels for 3D assets, including voxel and sprite fallbacks.
 * Ensures appropriate assets are served based on quality tier and distance.
 *
 * @fileoverview Asset LOD system for quality scaling
 */

import type {
  LODLevel,
  AssetLOD,
  QualityTier,
  GetAssetRequest,
  GetAssetResponse,
  UpgradePath,
} from './types.js';

// ============================================================================
// LOD Configuration Constants
// ============================================================================

/**
 * Default LOD distances for each quality tier.
 */
const DEFAULT_LOD_DISTANCES: Record<QualityTier, number[]> = {
  [QualityTier.POTATO]: [10, 25],
  [QualityTier.LOW]: [20, 50, 100],
  [QualityTier.MEDIUM]: [30, 75, 150, 300],
  [QualityTier.HIGH]: [50, 100, 200, 400, 600],
  [QualityTier.ULTRA]: [75, 150, 300, 600, 900, 1200],
};

/**
 * Texture resolutions for each quality tier.
 */
const TEXTURE_RESOLUTIONS: Record<QualityTier, [number, number]> = {
  [QualityTier.POTATO]: [64, 64],
  [QualityTier.LOW]: [256, 256],
  [QualityTier.MEDIUM]: [512, 512],
  [QualityTier.HIGH]: [1024, 1024],
  [QualityTier.ULTRA]: [2048, 2048],
};

/**
 * Polygon count targets for each quality tier.
 */
const POLY_COUNTS: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 100,
  [QualityTier.LOW]: 500,
  [QualityTier.MEDIUM]: 2000,
  [QualityTier.HIGH]: 10000,
  [QualityTier.ULTRA]: 50000,
};

/**
 * Shader complexity levels for each quality tier.
 */
const SHADER_COMPLEXITY: Record<QualityTier, LODLevel['shaderComplexity']> = {
  [QualityTier.POTATO]: 'basic',
  [QualityTier.LOW]: 'basic',
  [QualityTier.MEDIUM]: 'standard',
  [QualityTier.HIGH]: 'advanced',
  [QualityTier.ULTRA]: 'cinematic',
};

/**
 * File size estimates for each quality tier (in bytes).
 */
const FILE_SIZE_ESTIMATES: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 50_000,      // 50KB voxel
  [QualityTier.LOW]: 500_000,        // 500KB
  [QualityTier.MEDIUM]: 2_000_000,   // 2MB
  [QualityTier.HIGH]: 8_000_000,     // 8MB
  [QualityTier.ULTRA]: 32_000_000,   // 32MB
};

// ============================================================================
// In-Memory Asset LOD Storage
// ============================================================================

/**
 * Storage for asset LOD configurations.
 * In production, this would be in a database or KV storage.
 */
const assetLODStore = new Map<string, AssetLOD>();

/**
 * Register an asset with its LOD configuration.
 */
export function registerAssetLOD(assetLOD: AssetLOD): void {
  assetLODStore.set(assetLOD.assetId, assetLOD);
}

/**
 * Get asset LOD configuration by ID.
 */
export function getAssetLOD(assetId: string): AssetLOD | undefined {
  return assetLODStore.get(assetId);
}

/**
 * Create LOD levels for an asset based on quality tiers.
 */
export function createLODLevels(
  assetId: string,
  baseUrl: string,
  assetType: AssetLOD['assetType']
): LODLevel[] {
  const levels: LODLevel[] = [];

  for (const tier of [QualityTier.POTATO, QualityTier.LOW, QualityTier.MEDIUM, QualityTier.HIGH, QualityTier.ULTRA]) {
    const distances = DEFAULT_LOD_DISTANCES[tier];
    const levelIndex = levels.length;

    levels.push({
      level: levelIndex,
      qualityTier: tier,
      maxDistance: distances[Math.min(levelIndex, distances.length - 1)],
      polyCount: POLY_COUNTS[tier],
      textureSize: TEXTURE_RESOLUTIONS[tier],
      useMipmaps: tier >= QualityTier.MEDIUM,
      shaderComplexity: SHADER_COMPLEXITY[tier],
      assetUrl: `${baseUrl}/${QualityTier[tier].toLowerCase()}.glb`,
      fileSize: FILE_SIZE_ESTIMATES[tier],
      estimatedLoadTime: estimateLoadTime(FILE_SIZE_ESTIMATES[tier]),
    });
  }

  return levels;
}

/**
 * Estimate load time based on file size and assumed bandwidth.
 */
function estimateLoadTime(fileSize: number, bandwidthMbps: number = 25): number {
  // Assume 25 Mbps default bandwidth
  const bitsPerSecond = bandwidthMbps * 1_000_000;
  const bits = fileSize * 8;
  return Math.ceil((bits / bitsPerSecond) * 1000); // Return in milliseconds
}

/**
 * Create a complete asset LOD configuration.
 */
export function createAssetLOD(
  assetId: string,
  assetType: AssetLOD['assetType'],
  baseUrl: string,
  options: {
    hasVoxelFallback?: boolean;
    voxelUrl?: string;
    hasSpriteFallback?: boolean;
    spriteUrl?: string;
  } = {}
): AssetLOD {
  return {
    assetId,
    assetType,
    lods: createLODLevels(assetId, baseUrl, assetType),
    hasVoxelFallback: options.hasVoxelFallback ?? false,
    voxelUrl: options.voxelUrl,
    hasSpriteFallback: options.hasSpriteFallback ?? false,
    spriteUrl: options.spriteUrl,
    currentLod: 0,
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// LOD Selection Logic
// ============================================================================

/**
 * Select the appropriate LOD level based on distance and quality tier.
 */
export function selectLODLevel(
  assetLOD: AssetLOD,
  qualityTier: QualityTier,
  distance: number = 0,
  screenSize: number = 1.0
): number {
  const availableLODs = assetLOD.lods.filter(lod => lod.qualityTier <= qualityTier);

  if (availableLODs.length === 0) {
    // No LODs available for this tier, return lowest
    return 0;
  }

  // Select based on distance
  for (let i = availableLODs.length - 1; i >= 0; i--) {
    if (distance <= availableLODs[i].maxDistance) {
      return i;
    }
  }

  // Distance exceeds all LOD max distances, return furthest
  return availableLODs.length - 1;
}

/**
 * Select the appropriate LOD level based on screen space size.
 */
export function selectLODByScreenSize(
  assetLOD: AssetLOD,
  qualityTier: QualityTier,
  screenSize: number
): number {
  const availableLODs = assetLOD.lods.filter(lod => lod.qualityTier <= qualityTier);

  if (availableLODs.length === 0) {
    return 0;
  }

  // Screen size thresholds (relative to screen height)
  const thresholds = [0.02, 0.05, 0.1, 0.2, 0.5];

  for (let i = 0; i < availableLODs.length; i++) {
    if (screenSize >= thresholds[i] || i === availableLODs.length - 1) {
      return i;
    }
  }

  return 0;
}

/**
 * Get the asset URL at the appropriate quality level.
 */
export function getAssetUrl(
  request: GetAssetRequest
): GetAssetResponse {
  const assetLOD = getAssetLOD(request.assetId);

  if (!assetLOD) {
    // Asset not found, return error
    return {
      assetUrl: '',
      lodLevel: 0,
      qualityTier: request.qualityTier,
      isVoxel: false,
      isSprite: false,
      estimatedLoadTime: 0,
      fileSize: 0,
    };
  }

  // Determine if we should use fallbacks
  const useVoxel = request.qualityTier === QualityTier.POTATO && assetLOD.hasVoxelFallback;
  const useSprite = request.qualityTier === QualityTier.POTATO && assetLOD.hasSpriteFallback && !useVoxel;

  if (useVoxel && assetLOD.voxelUrl) {
    return {
      assetUrl: assetLOD.voxelUrl,
      lodLevel: 0,
      qualityTier: request.qualityTier,
      isVoxel: true,
      isSprite: false,
      estimatedLoadTime: estimateLoadTime(FILE_SIZE_ESTIMATES[QualityTier.POTATO]),
      fileSize: FILE_SIZE_ESTIMATES[QualityTier.POTATO],
    };
  }

  if (useSprite && assetLOD.spriteUrl) {
    return {
      assetUrl: assetLOD.spriteUrl,
      lodLevel: 0,
      qualityTier: request.qualityTier,
      isVoxel: false,
      isSprite: true,
      estimatedLoadTime: estimateLoadTime(FILE_SIZE_ESTIMATES[QualityTier.POTATO]),
      fileSize: FILE_SIZE_ESTIMATES[QualityTier.POTATO] / 2,
    };
  }

  // Select LOD level
  const distance = request.distance ?? 0;
  const screenSize = request.screenSize ?? 1.0;
  const lodLevel = selectLODLevel(assetLOD, request.qualityTier, distance, screenSize);
  const availableLODs = assetLOD.lods.filter(lod => lod.qualityTier <= request.qualityTier);
  const selectedLOD = availableLODs[lodLevel] ?? assetLOD.lods[0];

  // Create upgrade path if not at max quality
  let upgradePath: UpgradePath | undefined;
  if (request.allowUpgrade && request.qualityTier < QualityTier.ULTRA) {
    const nextTier = (request.qualityTier + 1) as QualityTier;
    const nextLOD = assetLOD.lods.find(l => l.qualityTier === nextTier);

    if (nextLOD) {
      upgradePath = {
        sourceAssetId: request.assetId,
        targetAssetId: request.assetId,
        targetTier: nextTier,
        downloadSize: nextLOD.fileSize,
        processingTime: nextLOD.estimatedLoadTime,
        downloading: false,
        downloadProgress: 0,
        available: true,
      };
    }
  }

  return {
    assetUrl: selectedLOD.assetUrl,
    lodLevel: selectedLOD.level,
    qualityTier: selectedLOD.qualityTier,
    isVoxel: false,
    isSprite: false,
    estimatedLoadTime: selectedLOD.estimatedLoadTime,
    fileSize: selectedLOD.fileSize,
    upgradePath,
  };
}

// ============================================================================
// Voxel Fallback System
// ============================================================================

/**
 * Generate a voxel fallback URL for an asset.
 */
export function getVoxelFallbackUrl(assetId: string): string {
  return `/api/assets/${assetId}/voxel`;
}

/**
 * Generate a sprite fallback URL for an asset.
 */
export function getSpriteFallbackUrl(assetId: string, angle: number = 0): string {
  return `/api/assets/${assetId}/sprite?angle=${angle}`;
}

/**
 * Check if an asset has a voxel fallback available.
 */
export function hasVoxelFallback(assetId: string): boolean {
  const assetLOD = getAssetLOD(assetId);
  return assetLOD?.hasVoxelFallback ?? false;
}

/**
 * Check if an asset has a sprite fallback available.
 */
export function hasSpriteFallback(assetId: string): boolean {
  const assetLOD = getAssetLOD(assetId);
  return assetLOD?.hasSpriteFallback ?? false;
}

// ============================================================================
// Batch Asset Processing
// ============================================================================

/**
 * Get multiple assets with appropriate LODs in a single request.
 */
export function getAssetsBatch(
  requests: GetAssetRequest[]
): GetAssetResponse[] {
  return requests.map(req => getAssetUrl(req));
}

/**
 * Calculate total download size for a batch of assets.
 */
export function calculateBatchSize(requests: GetAssetRequest[]): {
  totalSize: number;
  totalTime: number;
  assets: GetAssetResponse[];
} {
  const assets = getAssetsBatch(requests);

  return {
    totalSize: assets.reduce((sum, a) => sum + a.fileSize, 0),
    totalTime: Math.max(...assets.map(a => a.estimatedLoadTime)),
    assets,
  };
}

// ============================================================================
// Progressive Loading
// ============================================================================

/**
 * Get a progressive loading plan for an asset.
 * Returns URLs from lowest to highest quality.
 */
export function getProgressiveLoadPlan(
  assetId: string,
  maxTier: QualityTier
): Array<{ url: string; tier: QualityTier; size: number; time: number }> {
  const assetLOD = getAssetLOD(assetId);

  if (!assetLOD) {
    return [];
  }

  const plan: Array<{ url: string; tier: QualityTier; size: number; time: number }> = [];

  // Add voxel fallback if available and starting from POTATO
  if (assetLOD.hasVoxelFallback && assetLOD.voxelUrl) {
    plan.push({
      url: assetLOD.voxelUrl,
      tier: QualityTier.POTATO,
      size: FILE_SIZE_ESTIMATES[QualityTier.POTATO],
      time: estimateLoadTime(FILE_SIZE_ESTIMATES[QualityTier.POTATO]),
    });
  }

  // Add each tier up to max
  for (const lod of assetLOD.lods) {
    if (lod.qualityTier > maxTier) break;

    plan.push({
      url: lod.assetUrl,
      tier: lod.qualityTier,
      size: lod.fileSize,
      time: lod.estimatedLoadTime,
    });
  }

  return plan;
}

// ============================================================================
// LOD Statistics
// ============================================================================

/**
 * Get statistics about LOD usage for an asset.
 */
export function getAssetLODStats(assetId: string): {
  assetId: string;
  totalLODs: number;
  availableTiers: QualityTier[];
  hasVoxel: boolean;
  hasSprite: boolean;
  totalSize: number;
  minLoadTime: number;
  maxLoadTime: number;
} | null {
  const assetLOD = getAssetLOD(assetId);

  if (!assetLOD) {
    return null;
  }

  const loadTimes = assetLOD.lods.map(l => l.estimatedLoadTime);

  return {
    assetId,
    totalLODs: assetLOD.lods.length,
    availableTiers: assetLOD.lods.map(l => l.qualityTier),
    hasVoxel: assetLOD.hasVoxelFallback,
    hasSprite: assetLOD.hasSpriteFallback,
    totalSize: assetLOD.lods.reduce((sum, l) => sum + l.fileSize, 0),
    minLoadTime: Math.min(...loadTimes),
    maxLoadTime: Math.max(...loadTimes),
  };
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Create an asset LOD manager instance.
 */
export function createAssetLODManager() {
  return {
    register: registerAssetLOD,
    get: getAssetLOD,
    create: createAssetLOD,
    getUrl: getAssetUrl,
    getBatch: getAssetsBatch,
    calculateBatchSize,
    getVoxelUrl: getVoxelFallbackUrl,
    getSpriteUrl: getSpriteFallbackUrl,
    hasVoxel: hasVoxelFallback,
    hasSprite: hasSpriteFallback,
    getProgressivePlan: getProgressiveLoadPlan,
    getStats: getAssetLODStats,
    selectLOD: selectLODLevel,
    selectByScreenSize: selectLODByScreenSize,
  };
}
