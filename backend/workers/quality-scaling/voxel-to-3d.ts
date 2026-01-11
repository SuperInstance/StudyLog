/**
 * Voxel to 3D Upgrade Module
 *
 * Handles runtime quality upgrades from voxel representations to full 3D models.
 * Provides progressive enhancement as bandwidth and processing allow.
 *
 * @fileoverview Voxel to 3D runtime upgrade system
 */

import type {
  VoxelAsset,
  UpgradePath,
  QualityTier,
  AssetLOD,
} from './types.js';

// ============================================================================
// Voxel Processing Constants
// ============================================================================

/**
 * Maximum voxel grid dimensions for processing.
 */
const MAX_VOXEL_DIMENSIONS = 128;

/**
 * Voxel resolution for each quality tier.
 */
const VOXEL_RESOLUTIONS: Record<QualityTier, number> = {
  [QualityTier.POTATO]: 16,
  [QualityTier.LOW]: 32,
  [QualityTier.MEDIUM]: 48,
  [QualityTier.HIGH]: 64,
  [QualityTier.ULTRA]: 96,
};

/**
 * Processing time estimates per voxel (in microseconds).
 */
const PROCESSING_TIME_PER_VOXEL = 10; // 10 microseconds per voxel

// ============================================================================
// Voxel Asset Management
// ============================================================================

/**
 * Storage for voxel assets.
 * In production, this would be in R2 or similar object storage.
 */
const voxelAssetStore = new Map<string, VoxelAsset>();

/**
 * Active upgrade downloads.
 */
const activeUpgrades = new Map<string, UpgradePath>();

/**
 * Register a voxel asset.
 */
export function registerVoxelAsset(voxel: VoxelAsset): void {
  voxelAssetStore.set(voxel.assetId, voxel);
}

/**
 * Get a voxel asset by ID.
 */
export function getVoxelAsset(assetId: string): VoxelAsset | undefined {
  return voxelAssetStore.get(assetId);
}

/**
 * Check if a voxel asset can be upgraded to 3D.
 */
export function canUpgradeTo3D(assetId: string): boolean {
  const voxel = getVoxelAsset(assetId);
  return voxel?.upgradable ?? false;
}

// ============================================================================
// Voxel Data Processing
// ============================================================================

/**
 * Estimate processing time for voxel to 3D conversion.
 */
export function estimateProcessingTime(voxel: VoxelAsset): number {
  const voxelCount = voxel.dimensions[0] * voxel.dimensions[1] * voxel.dimensions[2];
  const totalTime = voxelCount * PROCESSING_TIME_PER_VOXEL;
  return totalTime; // Returns microseconds
}

/**
 * Estimate the resulting 3D model file size.
 */
export function estimate3DFileSize(voxel: VoxelAsset, targetTier: QualityTier): number {
  const voxelCount = voxel.dimensions[0] * voxel.dimensions[1] * voxel.dimensions[2];

  // Base size estimate per voxel at each tier
  const bytesPerVoxel: Record<QualityTier, number> = {
    [QualityTier.POTATO]: 1,      // Simple block
    [QualityTier.LOW]: 8,         // Basic mesh data
    [QualityTier.MEDIUM]: 32,     // Standard mesh + UVs
    [QualityTier.HIGH]: 128,      // Detailed mesh + UVs + normals
    [QualityTier.ULTRA]: 512,     // Full detail + materials
  };

  return voxelCount * bytesPerVoxel[targetTier];
}

/**
 * Get upgrade path for a voxel asset.
 */
export function getUpgradePath(
  voxelAssetId: string,
  targetTier: QualityTier
): UpgradePath | null {
  const voxel = getVoxelAsset(voxelAssetId);

  if (!voxel || !voxel.upgradable) {
    return null;
  }

  const fileSize = estimate3DFileSize(voxel, targetTier);
  const processingTime = estimateProcessingTime(voxel);

  return {
    sourceAssetId: voxelAssetId,
    targetAssetId: voxel.targetAssetId || `${voxelAssetId}_3d`,
    targetTier,
    downloadSize: fileSize,
    processingTime,
    downloading: false,
    downloadProgress: 0,
    available: true,
  };
}

/**
 * Start an upgrade download.
 */
export function startUpgrade(upgradePath: UpgradePath): UpgradePath {
  const updated = { ...upgradePath, downloading: true, downloadProgress: 0 };
  activeUpgrades.set(upgradePath.sourceAssetId, updated);
  return updated;
}

/**
 * Update upgrade progress.
 */
export function updateUpgradeProgress(
  sourceAssetId: string,
  progress: number
): UpgradePath | null {
  const upgrade = activeUpgrades.get(sourceAssetId);

  if (!upgrade) {
    return null;
  }

  const updated = { ...upgrade, downloadProgress: Math.min(1, Math.max(0, progress)) };

  if (updated.downloadProgress >= 1) {
    updated.downloading = false;
  }

  activeUpgrades.set(sourceAssetId, updated);
  return updated;
}

/**
 * Complete an upgrade.
 */
export function completeUpgrade(sourceAssetId: string): UpgradePath | null {
  const upgrade = activeUpgrades.get(sourceAssetId);

  if (!upgrade) {
    return null;
  }

  const completed = { ...upgrade, downloading: false, downloadProgress: 1 };
  activeUpgrades.delete(sourceAssetId);
  return completed;
}

/**
 * Cancel an upgrade.
 */
export function cancelUpgrade(sourceAssetId: string): boolean {
  return activeUpgrades.delete(sourceAssetId);
}

/**
 * Get upgrade status.
 */
export function getUpgradeStatus(sourceAssetId: string): UpgradePath | null {
  return activeUpgrades.get(sourceAssetId) ?? null;
}

// ============================================================================
// Voxel Generation from 3D
// ============================================================================

/**
 * Generate a voxel representation from a 3D model description.
 * This is a simplified implementation - real voxelization would use
 * mesh processing libraries.
 */
export function generateVoxelFromMesh(
  meshData: {
    vertices: number[][];
    faces: number[][];
  },
  resolution: number
): VoxelAsset {
  const assetId = crypto.randomUUID();

  // Simple voxelization: create a grid and mark filled voxels
  const dimensions: [number, number, number] = [resolution, resolution, resolution];
  const voxelData = new Uint8Array(resolution * resolution * resolution);

  // Find bounding box
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];

  for (const vertex of meshData.vertices) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], vertex[i]);
      max[i] = Math.max(max[i], vertex[i]);
    }
  }

  // Normalize and fill voxels
  const range = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];

  for (const vertex of meshData.vertices) {
    const x = Math.floor(((vertex[0] - min[0]) / range[0]) * (resolution - 1));
    const y = Math.floor(((vertex[1] - min[1]) / range[1]) * (resolution - 1));
    const z = Math.floor(((vertex[2] - min[2]) / range[2]) * (resolution - 1));

    const index = x + y * resolution + z * resolution * resolution;
    voxelData[index] = 1;
  }

  return {
    assetId,
    dimensions,
    voxelData,
    palette: [[255, 255, 255]], // Default white palette
    voxelSize: 1.0,
    origin: [0, 0, 0],
    upgradable: true,
  };
}

/**
 * Generate a voxel asset from a simple box description.
 */
export function generateVoxelBox(
  width: number,
  height: number,
  depth: number,
  color: [number, number, number]
): VoxelAsset {
  const assetId = crypto.randomUUID();
  const resolution = 16;
  const dimensions: [number, number, number] = [resolution, resolution, resolution];
  const voxelData = new Uint8Array(resolution * resolution * resolution);

  // Fill a box in the center of the voxel grid
  const startX = Math.floor((resolution - width) / 2);
  const startY = Math.floor((resolution - height) / 2);
  const startZ = Math.floor((resolution - depth) / 2);

  for (let x = startX; x < startX + width && x < resolution; x++) {
    for (let y = startY; y < startY + height && y < resolution; y++) {
      for (let z = startZ; z < startZ + depth && z < resolution; z++) {
        const index = x + y * resolution + z * resolution * resolution;
        voxelData[index] = 1;
      }
    }
  }

  return {
    assetId,
    dimensions,
    voxelData,
    palette: [color],
    voxelSize: 1.0,
    origin: [0, 0, 0],
    upgradable: true,
  };
}

// ============================================================================
// Voxel Streaming
// ============================================================================

/**
 * Create a streaming voxel representation for progressive loading.
 * Breaks the voxel data into chunks that can be loaded incrementally.
 */
export function createVoxelStream(
  voxel: VoxelAsset,
  chunkSize: number = 4096
): Array<{
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
}> {
  const totalSize = voxel.voxelData.length;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  const chunks: Array<{ chunkIndex: number; totalChunks: number; data: Uint8Array }> = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const data = voxel.voxelData.slice(start, end);

    chunks.push({
      chunkIndex: i,
      totalChunks,
      data,
    });
  }

  return chunks;
}

/**
 * Reconstruct a voxel asset from streamed chunks.
 */
export function reconstructFromChunks(
  assetId: string,
  dimensions: [number, number, number],
  chunks: Uint8Array[],
  palette: Array<[number, number, number]>
): VoxelAsset {
  const totalSize = dimensions[0] * dimensions[1] * dimensions[2];
  const voxelData = new Uint8Array(totalSize);

  let offset = 0;
  for (const chunk of chunks) {
    voxelData.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    assetId,
    dimensions,
    voxelData,
    palette,
    voxelSize: 1.0,
    origin: [0, 0, 0],
    upgradable: true,
  };
}

// ============================================================================
// Voxel Optimization
// ============================================================================

/**
 * Optimize voxel data by merging adjacent voxels of the same color.
 * Returns a run-length encoded version.
 */
export function optimizeVoxelData(voxel: VoxelAsset): {
  runs: Array<{ count: number; colorIndex: number }>;
  compressionRatio: number;
} {
  const runs: Array<{ count: number; colorIndex: number }> = [];
  let currentRun = { count: 1, colorIndex: 0 };

  for (let i = 1; i < voxel.voxelData.length; i++) {
    if (voxel.voxelData[i] === voxel.voxelData[i - 1]) {
      currentRun.count++;
    } else {
      runs.push({ ...currentRun });
      currentRun = { count: 1, colorIndex: voxel.voxelData[i] };
    }
  }
  runs.push(currentRun);

  const compressionRatio = voxel.voxelData.length / runs.length;

  return { runs, compressionRatio };
}

/**
 * Generate a lower-resolution voxel (LOD) from a high-resolution voxel.
 */
export function generateVoxelLOD(
  voxel: VoxelAsset,
  targetResolution: number
): VoxelAsset {
  const scale = targetResolution / voxel.dimensions[0];
  const newDimensions: [number, number, number] = [
    targetResolution,
    targetResolution,
    targetResolution,
  ];

  const newData = new Uint8Array(targetResolution * targetResolution * targetResolution);

  // Downsample by averaging
  for (let x = 0; x < targetResolution; x++) {
    for (let y = 0; y < targetResolution; y++) {
      for (let z = 0; z < targetResolution; z++) {
        // Sample from source
        const srcX = Math.floor(x / scale);
        const srcY = Math.floor(y / scale);
        const srcZ = Math.floor(z / scale);

        const srcIndex = srcX + srcY * voxel.dimensions[0] + srcZ * voxel.dimensions[0] * voxel.dimensions[1];
        const dstIndex = x + y * targetResolution + z * targetResolution * targetResolution;

        newData[dstIndex] = voxel.voxelData[srcIndex];
      }
    }
  }

  return {
    ...voxel,
    assetId: `${voxel.assetId}_lod_${targetResolution}`,
    dimensions: newDimensions,
    voxelData: newData,
    voxelSize: voxel.voxelSize / scale,
  };
}

// ============================================================================
// Voxel to Mesh Conversion
// ============================================================================

/**
 * Convert voxel data to a simple mesh representation.
 * This generates a mesh with separate quads for each visible voxel face.
 */
export function voxelToMesh(voxel: VoxelAsset): {
  vertices: number[][];
  faces: number[][];
  vertexCount: number;
  faceCount: number;
} {
  const vertices: number[][] = [];
  const faces: number[][] = [];

  const [width, height, depth] = voxel.dimensions;

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      for (let z = 0; z < depth; z++) {
        const index = x + y * width + z * width * height;

        if (voxel.voxelData[index] === 0) continue; // Empty voxel

        const vx = x * voxel.voxelSize;
        const vy = y * voxel.voxelSize;
        const vz = z * voxel.voxelSize;

        const baseVertex = vertices.length;

        // Add vertices for a cube
        vertices.push(
          [vx, vy, vz],
          [vx + voxel.voxelSize, vy, vz],
          [vx + voxel.voxelSize, vy + voxel.voxelSize, vz],
          [vx, vy + voxel.voxelSize, vz],
          [vx, vy, vz + voxel.voxelSize],
          [vx + voxel.voxelSize, vy, vz + voxel.voxelSize],
          [vx + voxel.voxelSize, vy + voxel.voxelSize, vz + voxel.voxelSize],
          [vx, vy + voxel.voxelSize, vz + voxel.voxelSize]
        );

        // Add faces (only where there's no neighbor)
        const hasNeighbor = (dx: number, dy: number, dz: number) => {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height || nz < 0 || nz >= depth) {
            return false;
          }

          const nIndex = nx + ny * width + nz * width * height;
          return voxel.voxelData[nIndex] !== 0;
        };

        // Front face
        if (!hasNeighbor(0, 0, 1)) {
          faces.push([baseVertex + 4, baseVertex + 5, baseVertex + 6, baseVertex + 7]);
        }
        // Back face
        if (!hasNeighbor(0, 0, -1)) {
          faces.push([baseVertex + 3, baseVertex + 2, baseVertex + 1, baseVertex]);
        }
        // Top face
        if (!hasNeighbor(0, 1, 0)) {
          faces.push([baseVertex + 2, baseVertex + 6, baseVertex + 7, baseVertex + 3]);
        }
        // Bottom face
        if (!hasNeighbor(0, -1, 0)) {
          faces.push([baseVertex, baseVertex + 4, baseVertex + 5, baseVertex + 1]);
        }
        // Right face
        if (!hasNeighbor(1, 0, 0)) {
          faces.push([baseVertex + 1, baseVertex + 5, baseVertex + 6, baseVertex + 2]);
        }
        // Left face
        if (!hasNeighbor(-1, 0, 0)) {
          faces.push([baseVertex, baseVertex + 3, baseVertex + 7, baseVertex + 4]);
        }
      }
    }
  }

  return {
    vertices,
    faces,
    vertexCount: vertices.length,
    faceCount: faces.length,
  };
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Create a voxel to 3D manager instance.
 */
export function createVoxelTo3DManager() {
  return {
    register: registerVoxelAsset,
    get: getVoxelAsset,
    canUpgrade: canUpgradeTo3D,
    getUpgradePath,
    startUpgrade,
    updateProgress: updateUpgradeProgress,
    completeUpgrade,
    cancelUpgrade,
    getStatus: getUpgradeStatus,
    generateFromMesh: generateVoxelFromMesh,
    generateBox: generateVoxelBox,
    createStream: createVoxelStream,
    reconstructFromChunks,
    optimize: optimizeVoxelData,
    generateLOD: generateVoxelLOD,
    toMesh: voxelToMesh,
  };
}
