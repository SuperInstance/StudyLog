/**
 * Style Preserver for Asset Regeneration System
 *
 * Maintains visual consistency across all three asset forms by preserving:
 * - Color palette consistency
 * - Proportion matching
 * - Iconic silhouettes
 * - Material hints
 */

import {
  ColorPalette,
  Proportions,
  SilhouetteFeatures,
  MaterialHints,
  StyleProfile,
  AnyAsset,
  MicroVerseAsset,
  LuantiAsset,
  OpenRTSAsset,
  AssetForm,
  StylePriority,
  ComparisonMetrics
} from './types.js';

// ============================================================================
// COLOR ANALYSIS & PALETTE EXTRACTION
// ============================================================================

interface ColorBucket {
  color: string;
  count: number;
  rgb: [number, number, number];
}

interface ColorDominance {
  primary: string;
  secondary: string;
  accent: string;
  shadow: string;
  allColors: ColorBucket[];
}

// ============================================================================
// STYLE PRESERVER CLASS
// ============================================================================

export class StylePreserver {
  private colorDistanceCache: Map<string, number>;
  private silhouetteCache: Map<string, number[][]>;

  constructor() {
    this.colorDistanceCache = new Map();
    this.silhouetteCache = new Map();
  }

  /**
   * Extract a complete style profile from any asset form
   */
  extractStyleProfile(asset: AnyAsset): StyleProfile {
    const palette = this.extractPalette(asset);
    const proportions = this.extractProportions(asset);
    const silhouette = this.extractSilhouette(asset);
    const materials = this.extractMaterialHints(asset);

    return {
      palette,
      proportions,
      silhouette,
      materials
    };
  }

  /**
   * Extract color palette from an asset
   */
  extractPalette(asset: AnyAsset): ColorPalette {
    switch (asset.form) {
      case AssetForm.MICROVERSE:
        return this.extractSpritePalette(asset as MicroVerseAsset);
      case AssetForm.LUANTI:
        return this.extractVoxelPalette(asset as LuantiAsset);
      case AssetForm.OPENRTS:
        return this.extractMeshPalette(asset as OpenRTSAsset);
      default:
        return this.getDefaultPalette();
    }
  }

  /**
   * Extract proportions from an asset
   */
  extractProportions(asset: AnyAsset): Proportions {
    switch (asset.form) {
      case AssetForm.MICROVERSE:
        return this.extractSpriteProportions(asset as MicroVerseAsset);
      case AssetForm.LUANTI:
        return this.extractVoxelProportions(asset as LuantiAsset);
      case AssetForm.OPENRTS:
        return this.extractMeshProportions(asset as OpenRTSAsset);
      default:
        return this.getDefaultProportions();
    }
  }

  /**
   * Extract silhouette features from an asset
   */
  extractSilhouette(asset: AnyAsset): SilhouetteFeatures {
    switch (asset.form) {
      case AssetForm.MICROVERSE:
        return this.extractSpriteSilhouette(asset as MicroVerseAsset);
      case AssetForm.LUANTI:
        return this.extractVoxelSilhouette(asset as LuantiAsset);
      case AssetForm.OPENRTS:
        return this.extractMeshSilhouette(asset as OpenRTSAsset);
      default:
        return this.getDefaultSilhouette();
    }
  }

  /**
   * Extract material hints from an asset
   */
  extractMaterialHints(asset: AnyAsset): MaterialHints {
    switch (asset.form) {
      case AssetForm.MICROVERSE:
        return this.inferMaterialsFromSprite(asset as MicroVerseAsset);
      case AssetForm.LUANTI:
        return this.inferMaterialsFromVoxels(asset as LuantiAsset);
      case AssetForm.OPENRTS:
        return this.getMeshMaterials(asset as OpenRTSAsset);
      default:
        return this.getDefaultMaterialHints();
    }
  }

  /**
   * Compare two style profiles for similarity
   */
  compareProfiles(profile1: StyleProfile, profile2: StyleProfile): ComparisonMetrics {
    const colorSimilarity = this.comparePalettes(profile1.palette, profile2.palette);
    const proportionSimilarity = this.compareProportions(
      profile1.proportions,
      profile2.proportions
    );
    const silhouetteSimilarity = this.compareSilhouettes(
      profile1.silhouette,
      profile2.silhouette
    );

    // Weighted average for overall consistency
    const overallConsistency =
      colorSimilarity * 0.4 +
      proportionSimilarity * 0.3 +
      silhouetteSimilarity * 0.3;

    return {
      colorSimilarity,
      proportionSimilarity,
      silhouetteSimilarity,
      overallConsistency
    };
  }

  /**
   * Adapt a palette for a specific target form
   */
  adaptPaletteForForm(
    palette: ColorPalette,
    targetForm: AssetForm,
    priority: StylePriority
  ): ColorPalette {
    switch (targetForm) {
      case AssetForm.MICROVERSE:
        return this.adaptForSprite(palette, priority);
      case AssetForm.LUANTI:
        return this.adaptForVoxel(palette, priority);
      case AssetForm.OPENRTS:
        return this.adaptForMesh(palette, priority);
      default:
        return palette;
    }
  }

  /**
   * Transfer style from one asset to another
   */
  transferStyle(
    source: StyleProfile,
    target: AnyAsset,
    options: {
      preserveColors?: boolean;
      preserveProportions?: boolean;
      preserveSilhouette?: boolean;
      preserveMaterials?: boolean;
    } = {}
  ): Partial<StyleProfile> {
    const result: Partial<StyleProfile> = {};

    if (options.preserveColors !== false) {
      result.palette = source.palette;
    }
    if (options.preserveProportions !== false) {
      result.proportions = source.proportions;
    }
    if (options.preserveSilhouette !== false) {
      result.silhouette = source.silhouette;
    }
    if (options.preserveMaterials !== false) {
      result.materials = source.materials;
    }

    return result;
  }

  // ========================================================================
  // SPRITE-SPECIFIC METHODS
  // ========================================================================

  private extractSpritePalette(asset: MicroVerseAsset): ColorPalette {
    // Extract from existing palette
    if (asset.palette && asset.palette.hexValues.length > 0) {
      return asset.palette;
    }

    // Analyze sprite frames to extract palette
    const colorCounts = new Map<string, number>();

    for (const frame of asset.frames) {
      const colors = this.extractColorsFromImageData(frame.imageData);
      for (const color of colors) {
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
      }
    }

    return this.dominanceToPalette(this.sortColorsByCount(colorCounts));
  }

  private extractSpriteProportions(asset: MicroVerseAsset): Proportions {
    const frame = asset.frames[0];
    if (!frame) {
      return this.getDefaultProportions();
    }

    const widthToHeight = frame.width / frame.height;

    return {
      widthToHeight,
      height: frame.height,
      shoulderRatio: 0.6, // Default estimate
      headRatio: 0.25, // Default estimate
      boundingBox: {
        min: [0, 0, 0],
        max: [frame.width, frame.height, 0]
      }
    };
  }

  private extractSpriteSilhouette(asset: MicroVerseAsset): SilhouetteFeatures {
    const frame = asset.frames[0];
    if (!frame) {
      return this.getDefaultSilhouette();
    }

    const outline = this.traceOutlineFromSprite(frame);
    const landmarks = this.detectLandmarksFromSprite(frame);

    return {
      outline,
      landmarks,
      distinctiveFeatures: this.analyzeDistinctiveFeatures(outline, landmarks),
      symmetry: this.detectSymmetry(outline)
    };
  }

  private inferMaterialsFromSprite(asset: MicroVerseAsset): MaterialHints {
    const palette = this.extractSpritePalette(asset);

    // Infer materials from color characteristics
    const primaryRgb = this.hexToRgb(palette.primary);
    const secondaryRgb = this.hexToRgb(palette.secondary);

    let primarySurface: MaterialHints['primary'] = 'organic';
    let metalness = 0;
    let roughness = 0.8;

    // Analyze color characteristics
    const brightness = (primaryRgb[0] + primaryRgb[1] + primaryRgb[2]) / 3;
    const saturation = this.calculateSaturation(primaryRgb);

    // High saturation + medium brightness = organic/fabric
    // Low saturation + high brightness = metallic
    // Very low saturation = stone

    if (saturation < 30 && brightness > 150) {
      primarySurface = 'metallic';
      metalness = 0.8;
      roughness = 0.3;
    } else if (saturation < 30 && brightness < 100) {
      primarySurface = 'stone';
      roughness = 0.9;
    } else if (brightness > 200) {
      primarySurface = 'energy';
      roughness = 0.1;
    }

    return {
      primary: primarySurface,
      metalness,
      roughness,
      transparency: 0
    };
  }

  // ========================================================================
  // VOXEL-SPECIFIC METHODS
  // ========================================================================

  private extractVoxelPalette(asset: LuantiAsset): ColorPalette {
    const colorCounts = new Map<string, number>();

    for (const voxel of asset.voxels) {
      colorCounts.set(voxel.color, (colorCounts.get(voxel.color) || 0) + 1);
    }

    return this.dominanceToPalette(this.sortColorsByCount(colorCounts));
  }

  private extractVoxelProportions(asset: LuantiAsset): Proportions {
    const [width, height, depth] = asset.dimensions;

    // Find actual occupied bounds
    let minX = width, maxX = 0;
    let minY = height, maxY = 0;
    let minZ = depth, maxZ = 0;

    for (const voxel of asset.voxels) {
      const [x, y, z] = voxel.position;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    const actualWidth = maxX - minX + 1;
    const actualHeight = maxY - minY + 1;
    const actualDepth = maxZ - minZ + 1;

    return {
      widthToHeight: actualWidth / actualHeight,
      height: actualHeight,
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      }
    };
  }

  private extractVoxelSilhouette(asset: LuantiAsset): SilhouetteFeatures {
    // Create 2D projection silhouette
    const [width, height, depth] = asset.dimensions;

    // Create occupancy grid for front view
    const grid: boolean[][] = [];
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = false;
      }
    }

    for (const voxel of asset.voxels) {
      const [x, y, z] = voxel.position;
      if (y >= 0 && y < height && x >= 0 && x < width) {
        grid[y][x] = true;
      }
    }

    const outline = this.traceOutlineFromGrid(grid);
    const landmarks = this.detectLandmarksFromVoxels(asset.voxels);

    return {
      outline,
      landmarks,
      distinctiveFeatures: this.analyzeDistinctiveFeatures(outline, landmarks),
      symmetry: 'bilateral'
    };
  }

  private inferMaterialsFromVoxels(asset: LuantiAsset): MaterialHints {
    // Analyze material mappings
    const materialTypes = new Set<string>();

    for (const voxel of asset.voxels) {
      const material = asset.materials[voxel.material];
      if (material) {
        materialTypes.add(material.name.toLowerCase());
      }
    }

    // Infer primary surface type from material names
    let primarySurface: MaterialHints['primary'] = 'organic';

    if (materialTypes.has('metal') || materialTypes.has('iron') || materialTypes.has('steel')) {
      primarySurface = 'metallic';
    } else if (materialTypes.has('stone') || materialTypes.has('rock') || materialTypes.has('brick')) {
      primarySurface = 'stone';
    } else if (materialTypes.has('wood') || materialTypes.has('leaves')) {
      primarySurface = 'organic';
    } else if (materialTypes.has('water') || materialTypes.has('glass')) {
      primarySurface = materialTypes.has('water') ? 'liquid' : 'glass';
    }

    return {
      primary: primarySurface,
      metalness: primarySurface === 'metallic' ? 0.8 : 0,
      roughness: primarySurface === 'stone' ? 0.9 : 0.6,
      transparency: primarySurface === 'glass' || primarySurface === 'liquid' ? 0.7 : 0
    };
  }

  // ========================================================================
  // MESH-SPECIFIC METHODS
  // ========================================================================

  private extractMeshPalette(asset: OpenRTSAsset): ColorPalette {
    const colorCounts = new Map<string, number>();

    // Extract from materials
    for (const material of asset.materials) {
      colorCounts.set(material.albedo, (colorCounts.get(material.albedo) || 0) + 1);
    }

    // Extract from vertex colors if available
    if (asset.mesh.colors) {
      const colors = asset.mesh.colors;
      for (let i = 0; i < colors.length; i += 3) {
        const r = Math.round(colors[i] * 255);
        const g = Math.round(colors[i + 1] * 255);
        const b = Math.round(colors[i + 2] * 255);
        const hex = this.rgbToHex([r, g, b]);
        colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
      }
    }

    return this.dominanceToPalette(this.sortColorsByCount(colorCounts));
  }

  private extractMeshProportions(asset: OpenRTSAsset): Proportions {
    const vertices = asset.mesh.vertices;
    if (vertices.length === 0) {
      return this.getDefaultProportions();
    }

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]);
      maxX = Math.max(maxX, vertices[i]);
      minY = Math.min(minY, vertices[i + 1]);
      maxY = Math.max(maxY, vertices[i + 1]);
      minZ = Math.min(minZ, vertices[i + 2]);
      maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;

    return {
      widthToHeight: width / height,
      height,
      shoulderRatio: width / height * 0.6,
      headRatio: 0.25,
      boundingBox: {
        min: [minX, minY, minZ],
        max: [maxX, maxY, maxZ]
      }
    };
  }

  private extractMeshSilhouette(asset: OpenRTSAsset): SilhouetteFeatures {
    // Create silhouette from mesh projection
    const vertices = asset.mesh.vertices;
    const indices = asset.mesh.indices;

    if (vertices.length === 0) {
      return this.getDefaultSilhouette();
    }

    // Project to 2D (front view, ignore Z)
    const projectedPoints: [number, number][] = [];
    for (let i = 0; i < vertices.length; i += 3) {
      projectedPoints.push([vertices[i], vertices[i + 1]]);
    }

    // Find convex hull for outline
    const outline = this.computeConvexHull(projectedPoints);

    // Detect landmarks from mesh structure
    const landmarks = this.detectLandmarksFromMesh(asset);

    return {
      outline: outline.map(p => [p[0], p[1]]),
      landmarks,
      distinctiveFeatures: [],
      symmetry: 'bilateral'
    };
  }

  private getMeshMaterials(asset: OpenRTSAsset): MaterialHints {
    if (asset.materials.length === 0) {
      return this.getDefaultMaterialHints();
    }

    const primaryMat = asset.materials[0];

    // Map shader type to surface type
    const surfaceMap: Record<string, MaterialHints['primary']> = {
      'standard': 'organic',
      'unlit': 'organic',
      'toon': 'organic',
      'skin': 'organic',
      'foliage': 'vegetation'
    };

    return {
      primary: surfaceMap[primaryMat.shader] || 'organic',
      metalness: primaryMat.properties.metalness,
      roughness: primaryMat.properties.roughness,
      emission: primaryMat.properties.emission,
      transparency: primaryMat.properties.alphaTest ? 1 - primaryMat.properties.alphaTest : 0
    };
  }

  // ========================================================================
  // PALETTE ADAPTATION METHODS
  // ========================================================================

  private adaptForSprite(palette: ColorPalette, priority: StylePriority): ColorPalette {
    // Limit palette size for sprite constraints
    const maxColors = priority === StylePriority.COLOR_EXACT ? 16 : 32;

    if (palette.hexValues.length <= maxColors) {
      return palette;
    }

    // Select most important colors
    const selected = this.selectDominantColors(palette.hexValues, maxColors);

    return {
      primary: selected[0] || palette.primary,
      secondary: selected[1] || palette.secondary,
      accent: selected[2] || palette.accent,
      shadow: selected[selected.length - 1] || palette.shadow,
      hexValues: selected
    };
  }

  private adaptForVoxel(palette: ColorPalette, priority: StylePriority): ColorPalette {
    // Voxels benefit from fewer, more distinct colors
    const maxColors = priority === StylePriority.COLOR_EXACT ? 32 : 64;

    if (palette.hexValues.length <= maxColors) {
      return palette;
    }

    const selected = this.selectDominantColors(palette.hexValues, maxColors);

    return {
      primary: selected[0] || palette.primary,
      secondary: selected[1] || palette.secondary,
      accent: selected[2] || palette.accent,
      shadow: selected[selected.length - 1] || palette.shadow,
      hexValues: selected
    };
  }

  private adaptForMesh(palette: ColorTemplate, priority: StylePriority): ColorPalette {
    // Meshes can handle full color range
    if (priority === StylePriority.FORM_FOCUSED) {
      // Expand palette for better gradients
      return this.expandPalette(palette);
    }

    return palette;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private extractColorsFromImageData(imageData: string | Buffer): string[] {
    // Parse image data and extract unique colors
    // This is a simplified version - real implementation would decode the image
    return [];
  }

  private sortColorsByCount(colorCounts: Map<string, number>): ColorBucket[] {
    const buckets: ColorBucket[] = [];

    for (const [color, count] of colorCounts.entries()) {
      const rgb = this.hexToRgb(color);
      buckets.push({ color, count, rgb });
    }

    return buckets.sort((a, b) => b.count - a.count);
  }

  private dominanceToPalette(sorted: ColorBucket[]): ColorPalette {
    if (sorted.length === 0) {
      return this.getDefaultPalette();
    }

    const getLuminance = (rgb: [number, number, number]) => {
      return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    };

    // Find brightest for accent, darkest for shadow
    let brightest = sorted[0];
    let darkest = sorted[0];

    for (const bucket of sorted) {
      if (getLuminance(bucket.rgb) > getLuminance(brightest.rgb)) {
        brightest = bucket;
      }
      if (getLuminance(bucket.rgb) < getLuminance(darkest.rgb)) {
        darkest = bucket;
      }
    }

    return {
      primary: sorted[0].color,
      secondary: sorted[1]?.color || sorted[0].color,
      accent: brightest.color,
      shadow: darkest.color,
      hexValues: sorted.map(b => b.color)
    };
  }

  private selectDominantColors(colors: string[], maxCount: number): string[] {
    if (colors.length <= maxCount) {
      return colors;
    }

    // Use k-means clustering to reduce colors
    return this.clusterColors(colors, maxCount);
  }

  private clusterColors(colors: string[], k: number): string[] {
    // Simplified k-means for color quantization
    if (colors.length <= k) {
      return colors;
    }

    // Initialize with first k colors
    let centroids = colors.slice(0, k).map(c => this.hexToRgb(c));

    for (let iter = 0; iter < 10; iter++) {
      // Assign colors to nearest centroid
      const clusters: number[][][] = Array.from({ length: k }, () => []);

      for (const color of colors) {
        const rgb = this.hexToRgb(color);
        let nearest = 0;
        let minDist = Infinity;

        for (let i = 0; i < centroids.length; i++) {
          const dist = this.colorDistance(rgb, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            nearest = i;
          }
        }

        clusters[nearest].push(rgb);
      }

      // Update centroids
      for (let i = 0; i < k; i++) {
        if (clusters[i].length > 0) {
          const sum = clusters[i].reduce((acc, c) => [
            acc[0] + c[0],
            acc[1] + c[1],
            acc[2] + c[2]
          ], [0, 0, 0]);

          centroids[i] = [
            Math.round(sum[0] / clusters[i].length),
            Math.round(sum[1] / clusters[i].length),
            Math.round(sum[2] / clusters[i].length)
          ];
        }
      }
    }

    return centroids.map(c => this.rgbToHex(c as [number, number, number]));
  }

  private colorDistance(c1: [number, number, number], c2: [number, number, number]): number {
    const cacheKey = `${c1.join(',')}-${c2.join(',')}`;

    if (this.colorDistanceCache.has(cacheKey)) {
      return this.colorDistanceCache.get(cacheKey)!;
    }

    // Perceptual color distance (CIE76 approximation)
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];

    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    this.colorDistanceCache.set(cacheKey, distance);

    return distance;
  }

  private comparePalettes(p1: ColorPalette, p2: ColorPalette): number {
    // Compare dominant colors
    const p1Rgb = this.hexToRgb(p1.primary);
    const p2Rgb = this.hexToRgb(p2.primary);

    const primaryDist = this.colorDistance(p1Rgb, p2Rgb);
    const maxDist = Math.sqrt(255 * 255 * 3);

    // Convert distance to similarity (0-1)
    let similarity = 1 - (primaryDist / maxDist);

    // Factor in palette size similarity
    const sizeRatio = Math.min(p1.hexValues.length, p2.hexValues.length) /
                     Math.max(p1.hexValues.length, p2.hexValues.length);

    similarity = (similarity + sizeRatio) / 2;

    return similarity;
  }

  private compareProportions(p1: Proportions, p2: Proportions): number {
    // Compare width-to-height ratio
    const ratioDiff = Math.abs(p1.widthToHeight - p2.widthToHeight);
    const ratioSimilarity = Math.max(0, 1 - ratioDiff * 2);

    // Compare bounding box aspect
    const p1Size = this.boundingBoxSize(p1.boundingBox);
    const p2Size = this.boundingBoxSize(p2.boundingBox);
    const sizeSimilarity = Math.min(p1Size, p2Size) / Math.max(p1Size, p2Size);

    return (ratioSimilarity + sizeSimilarity) / 2;
  }

  private compareSilhouettes(s1: SilhouetteFeatures, s2: SilhouetteFeatures): number {
    if (s1.outline.length === 0 || s2.outline.length === 0) {
      return 0.5;
    }

    // Resample outlines to same length
    const len = Math.min(s1.outline.length, s2.outline.length);
    const sampled1 = this.resampleOutline(s1.outline, len);
    const sampled2 = this.resampleOutline(s2.outline, len);

    // Calculate average point distance
    let totalDist = 0;
    for (let i = 0; i < len; i++) {
      const dx = sampled1[i][0] - sampled2[i][0];
      const dy = sampled1[i][1] - sampled2[i][1];
      totalDist += Math.sqrt(dx * dx + dy * dy);
    }

    const avgDist = totalDist / len;
    return Math.max(0, 1 - avgDist);
  }

  private traceOutlineFromSprite(frame: { width: number; height: number; imageData: string | Buffer }): number[][] {
    // Simplified outline tracing - would use proper marching squares in production
    const outline: number[][] = [];
    const w = frame.width;
    const h = frame.height;

    // Simple bounding box outline
    outline.push([0, 0], [w, 0], [w, h], [0, h], [0, 0]);

    return outline;
  }

  private traceOutlineFromGrid(grid: boolean[][]): number[][] {
    if (grid.length === 0) return [];

    const h = grid.length;
    const w = grid[0].length;
    const outline: number[][] = [];

    // Trace occupied cells
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x]) {
          // Add to outline (simplified)
          outline.push([x, y]);
        }
      }
    }

    return outline;
  }

  private computeConvexHull(points: [number, number][]): [number, number][] {
    if (points.length < 3) return points;

    // Graham scan implementation
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    const cross = (o: [number, number], a: [number, number], b: [number, number]) => {
      return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    };

    const lower: [number, number][] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: [number, number][] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
        upper.pop();
      }
      upper.push(sorted[i]);
    }

    lower.pop();
    upper.pop();

    return [...lower, ...upper];
  }

  private detectLandmarksFromSprite(frame: { width: number; height: number }): Record<string, [number, number]> {
    // Default landmark positions
    return {
      top: [frame.width / 2, 0],
      center: [frame.width / 2, frame.height / 2],
      bottom: [frame.width / 2, frame.height],
      left: [0, frame.height / 2],
      right: [frame.width, frame.height / 2]
    };
  }

  private detectLandmarksFromVoxels(voxels: Array<{ position: [number, number, number] }>): Record<string, [number, number]> {
    if (voxels.length === 0) return {};

    let minY = Infinity, maxY = -Infinity;
    let minX = Infinity, maxX = -Infinity;

    for (const v of voxels) {
      minY = Math.min(minY, v.position[1]);
      maxY = Math.max(maxY, v.position[1]);
      minX = Math.min(minX, v.position[0]);
      maxX = Math.max(maxX, v.position[0]);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return {
      top: [centerX, minY],
      center: [centerX, centerY],
      bottom: [centerX, maxY],
      left: [minX, centerY],
      right: [maxX, centerY]
    };
  }

  private detectLandmarksFromMesh(asset: OpenRTSAsset): Record<string, [number, number]> {
    const proportions = this.extractMeshProportions(asset);
    const bb = proportions.boundingBox;

    return {
      top: [(bb.min[0] + bb.max[0]) / 2, bb.min[1]],
      center: [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2],
      bottom: [(bb.min[0] + bb.max[0]) / 2, bb.max[1]],
      left: [bb.min[0], (bb.min[1] + bb.max[1]) / 2],
      right: [bb.max[0], (bb.min[1] + bb.max[1]) / 2]
    };
  }

  private analyzeDistinctiveFeatures(outline: number[][], landmarks: Record<string, [number, number]>): string[] {
    const features: string[] = [];

    // Analyze outline complexity
    if (outline.length > 50) {
      features.push('complex_outline');
    }

    // Check for elongation
    if (landmarks.top && landmarks.bottom) {
      const height = Math.abs(landmarks.bottom[1] - landmarks.top[1]);
      const width = Math.abs((landmarks.right?.[0] || 1) - (landmarks.left?.[0] || 0));
      if (height > width * 2) {
        features.push('vertical_elongated');
      } else if (width > height * 2) {
        features.push('horizontal_elongated');
      }
    }

    return features;
  }

  private detectSymmetry(outline: number[][]): 'bilateral' | 'radial' | 'none' {
    if (outline.length < 4) return 'none';

    // Simple symmetry check
    const center = this.findOutlineCenter(outline);

    let symmetricalPoints = 0;
    for (const point of outline) {
      const mirrored = [2 * center[0] - point[0], point[1]];
      if (this.pointNearOutline(mirrored, outline, 5)) {
        symmetricalPoints++;
      }
    }

    if (symmetricalPoints > outline.length * 0.7) {
      return 'bilateral';
    }

    return 'none';
  }

  private findOutlineCenter(outline: number[][]): [number, number] {
    let sumX = 0, sumY = 0;
    for (const [x, y] of outline) {
      sumX += x;
      sumY += y;
    }
    return [sumX / outline.length, sumY / outline.length];
  }

  private pointNearOutline(point: number[], outline: number[][], threshold: number): boolean {
    for (const [ox, oy] of outline) {
      const dist = Math.sqrt((point[0] - ox) ** 2 + (point[1] - oy) ** 2);
      if (dist < threshold) return true;
    }
    return false;
  }

  private resampleOutline(outline: number[][], targetLength: number): number[][] {
    if (outline.length <= targetLength) {
      return outline;
    }

    const step = (outline.length - 1) / (targetLength - 1);
    const resampled: number[][] = [];

    for (let i = 0; i < targetLength; i++) {
      const index = Math.min(Math.round(i * step), outline.length - 1);
      resampled.push(outline[index]);
    }

    return resampled;
  }

  private expandPalette(palette: ColorPalette): ColorPalette {
    // Add intermediate gradient colors
    const expanded = [...palette.hexValues];
    const primary = this.hexToRgb(palette.primary);
    const secondary = this.hexToRgb(palette.secondary);

    // Add 2 intermediate colors
    for (let i = 1; i <= 2; i++) {
      const t = i / 3;
      const r = Math.round(primary[0] + (secondary[0] - primary[0]) * t);
      const g = Math.round(primary[1] + (secondary[1] - primary[1]) * t);
      const b = Math.round(primary[2] + (secondary[2] - primary[2]) * t);
      expanded.splice(i * 2, 0, this.rgbToHex([r, g, b]));
    }

    return {
      ...palette,
      hexValues: expanded
    };
  }

  private boundingBoxSize(bb: { min: [number, number, number]; max: [number, number, number] }): number {
    const w = bb.max[0] - bb.min[0];
    const h = bb.max[1] - bb.min[1];
    const d = bb.max[2] - bb.min[2];
    return Math.sqrt(w * w + h * h + d * d);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }

  private rgbToHex(rgb: [number, number, number]): string {
    return '#' + rgb.map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private calculateSaturation(rgb: [number, number, number]): number {
    const max = Math.max(rgb[0], rgb[1], rgb[2]);
    const min = Math.min(rgb[0], rgb[1], rgb[2]);
    return max === 0 ? 0 : ((max - min) / max) * 100;
  }

  // ========================================================================
  // DEFAULT VALUES
  // ========================================================================

  private getDefaultPalette(): ColorPalette {
    return {
      primary: '#808080',
      secondary: '#606060',
      accent: '#FFFFFF',
      shadow: '#202020',
      hexValues: ['#808080', '#606060', '#FFFFFF', '#202020']
    };
  }

  private getDefaultProportions(): Proportions {
    return {
      widthToHeight: 0.6,
      height: 64,
      boundingBox: {
        min: [0, 0, 0],
        max: [32, 64, 32]
      }
    };
  }

  private getDefaultSilhouette(): SilhouetteFeatures {
    return {
      outline: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]],
      landmarks: {
        center: [0.5, 0.5]
      },
      distinctiveFeatures: [],
      symmetry: 'bilateral'
    };
  }

  private getDefaultMaterialHints(): MaterialHints {
    return {
      primary: 'organic',
      metalness: 0,
      roughness: 0.8
    };
  }
}

// Type alias for internal use
type ColorTemplate = ColorPalette;
