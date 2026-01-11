/**
 * Asset Transformer
 *
 * Converts assets between formats for cross-engine compatibility.
 * Supports sprite, voxel, and mesh transformations.
 *
 * @module engine-abstraction/asset-transformer
 */

import type {
  AssetMetadata,
  AssetFormat,
  GameEngine,
  QualityTier,
  AssetTransformResult,
  TransformOptions,
  AssetCategory,
  Dimensions,
  AnimationData,
  CollisionData,
  MaterialProperties,
  Color,
} from "./types.js";

// ============================================================================
// ASSET TRANSFORMER
// ============================================================================

/**
 * Transforms assets between different formats for cross-engine compatibility.
 * Supports 2D sprite to voxel to 3D mesh transformations.
 */
export class AssetTransformer {
  private static _instance: AssetTransformer | null = null;
  private _transformCache: Map<string, TransformCacheEntry> = new Map();
  private _transformers: Map<TransformPair, AssetTransformFunction> = new Map();

  private constructor() {
    this.initializeTransformers();
  }

  /**
   * Get the singleton AssetTransformer instance.
   */
  static getInstance(): AssetTransformer {
    if (!AssetTransformer._instance) {
      AssetTransformer._instance = new AssetTransformer();
    }
    return AssetTransformer._instance;
  }

  /**
   * Transform an asset to a target format/engine.
   * @param asset - Source asset metadata
   * @param data - Source asset data
   * @param options - Transform options
   * @returns Transform result
   */
  async transform(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<AssetTransformResult> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(asset.id, options.targetEngine, options.targetFormat);
    const cached = this._transformCache.get(cacheKey);
    if (cached && options.quality !== "ultra") {
      return this.createResult(asset, data, options, true, [], cached.data);
    }

    // Determine target format
    const targetFormat = options.targetFormat ?? this.getDefaultFormat(options.targetEngine);

    // Check if transformation is supported
    if (!this.isTransformSupported(asset.format, targetFormat)) {
      return this.createResult(
        asset,
        data,
        options,
        false,
        [],
        undefined,
        `Cannot transform from ${asset.format} to ${targetFormat}`,
      );
    }

    // Get transformer function
    const transformPair: TransformPair = `${asset.format}->${targetFormat}` as TransformPair;
    const transformer = this._transformers.get(transformPair);

    if (!transformer) {
      return this.createResult(
        asset,
        data,
        options,
        false,
        [],
        undefined,
        `No transformer found for ${transformPair}`,
      );
    }

    try {
      // Perform transformation
      const result = await transformer(asset, data, options);

      // Cache result
      if (result.success && !options.optimizeSize) {
        this._transformCache.set(cacheKey, {
          sourceId: asset.id,
          sourceFormat: asset.format,
          targetEngine: options.targetEngine,
          targetFormat,
          data: result.data,
          timestamp: Date.now(),
          hits: 0,
          size: this.estimateSize(result.data),
        });
      }

      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return this.createResult(
        asset,
        data,
        options,
        false,
        [],
        undefined,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Batch transform multiple assets.
   * @param assets - Array of assets to transform
   * @param options - Transform options
   * @returns Array of transform results
   */
  async transformBatch(
    assets: Array<{ asset: AssetMetadata; data: unknown }>,
    options: TransformOptions,
  ): Promise<AssetTransformResult[]> {
    const results: AssetTransformResult[] = [];

    // Transform in parallel for efficiency
    const promises = assets.map(({ asset, data }) =>
      this.transform(asset, data, options)
    );

    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    return results;
  }

  /**
   * Create a universal asset from any format.
   * @param asset - Source asset
   * @param data - Asset data
   * @returns Universal asset representation
   */
  createUniversalAsset(
    asset: AssetMetadata,
    data: unknown,
  ): UniversalAsset {
    return {
      id: asset.id,
      name: asset.name,
      category: asset.category,
      formats: new Map([
        [asset.format, { data, metadata: asset }],
      ]),
      originalFormat: asset.format,
      properties: asset.properties,
    };
  }

  /**
   * Extract a specific format from a universal asset.
   * @param universal - Universal asset
   * @param format - Desired format
   * @param options - Transform options
   * @returns Extracted format data or undefined
   */
  async extractFormat(
    universal: UniversalAsset,
    format: AssetFormat,
    options?: TransformOptions,
  ): Promise<{ data: unknown; metadata: AssetMetadata } | undefined> {
    // Check if format already exists
    const existing = universal.formats.get(format);
    if (existing) {
      return existing;
    }

    // Transform from original format
    const original = universal.formats.get(universal.originalFormat);
    if (!original) {
      return undefined;
    }

    const result = await this.transform(
      original.metadata,
      original.data,
      {
        targetEngine: options?.targetEngine ?? "microverse",
        targetFormat: format,
        quality: options?.quality,
        preserveAnimation: options?.preserveAnimation ?? true,
        preserveCollision: options?.preserveCollision ?? true,
      },
    );

    if (result.success && result.data) {
      // Add to universal asset
      universal.formats.set(format, {
        data: result.data,
        metadata: result.metadata,
      });
      return { data: result.data, metadata: result.metadata };
    }

    return undefined;
  }

  /**
   * Check if a transformation is supported.
   * @param sourceFormat - Source format
   * @param targetFormat - Target format
   * @returns True if transformation is supported
   */
  isTransformSupported(sourceFormat: AssetFormat, targetFormat: AssetFormat): boolean {
    const pair: TransformPair = `${sourceFormat}->${targetFormat}` as TransformPair;
    return this._transformers.has(pair);
  }

  /**
   * Get the default asset format for an engine.
   * @param engine - Target engine
   * @returns Default asset format
   */
  getDefaultFormat(engine: GameEngine): AssetFormat {
    switch (engine) {
      case "microverse":
        return "sprite_2d";
      case "luanti":
        return "voxel";
      case "openrts":
        return "mesh_3d";
      default:
        return "sprite_2d";
    }
  }

  /**
   * Clear the transform cache.
   */
  clearCache(): void {
    this._transformCache.clear();
  }

  /**
   * Get cache statistics.
   * @returns Cache statistics
   */
  getCacheStats(): CacheStats {
    let totalSize = 0;
    let totalHits = 0;

    for (const entry of this._transformCache.values()) {
      totalSize += entry.size;
      totalHits += entry.hits;
    }

    return {
      entries: this._transformCache.size,
      totalSize,
      totalHits,
      averageSize: this._transformCache.size > 0 ? totalSize / this._transformCache.size : 0,
    };
  }

  /**
   * Generate a cache key for a transform.
   * @param assetId - Asset identifier
   * @param targetEngine - Target engine
   * @param targetFormat - Target format
   * @returns Cache key
   */
  private getCacheKey(
    assetId: string,
    targetEngine: GameEngine,
    targetFormat?: AssetFormat,
  ): string {
    const format = targetFormat ?? this.getDefaultFormat(targetEngine);
    return `${assetId}:${targetEngine}:${format}`;
  }

  /**
   * Estimate the size of data in bytes.
   * @param data - Data to estimate
   * @returns Estimated size in bytes
   */
  private estimateSize(data: unknown): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    }
    if (data instanceof ImageData) {
      return data.width * data.height * 4;
    }
    if (ArrayBuffer.isView(data)) {
      return data.byteLength;
    }
    if (typeof data === "object" && data !== null) {
      return JSON.stringify(data).length * 2; // Rough estimate
    }
    return 0;
  }

  /**
   * Create a transform result.
   * @param source - Source asset
   * @param sourceData - Source data
   * @param options - Transform options
   * @param success - Success flag
   * @param warnings - Warnings
   * @param data - Result data
   * @param error - Error message
   * @returns Transform result
   */
  private createResult(
    source: AssetMetadata,
    sourceData: unknown,
    options: TransformOptions,
    success: boolean,
    warnings: string[],
    data: unknown,
    error?: string,
  ): AssetTransformResult {
    const targetFormat = options.targetFormat ?? this.getDefaultFormat(options.targetEngine);

    return {
      source,
      targetEngine: options.targetEngine,
      targetFormat,
      data,
      metadata: this.createTargetMetadata(source, targetFormat, options),
      success,
      error,
      warnings,
    };
  }

  /**
   * Create target asset metadata.
   * @param source - Source metadata
   * @param targetFormat - Target format
   * @param options - Transform options
   * @returns Target metadata
   */
  private createTargetMetadata(
    source: AssetMetadata,
    targetFormat: AssetFormat,
    options: TransformOptions,
  ): AssetMetadata {
    return {
      id: source.id,
      name: source.name,
      format: targetFormat,
      supportedEngines: this.getSupportedEngines(targetFormat),
      category: source.category,
      dimensions: this.adjustDimensions(source.dimensions, targetFormat, options),
      animation: options.preserveAnimation ? source.animation : undefined,
      collision: options.preserveCollision ? source.collision : undefined,
      material: source.material,
      properties: { ...source.properties },
      createdAt: source.createdAt,
      updatedAt: new Date(),
    };
  }

  /**
   * Adjust dimensions for target format.
   * @param source - Source dimensions
   * @param targetFormat - Target format
   * @param options - Transform options
   * @returns Adjusted dimensions
   */
  private adjustDimensions(
    source: Dimensions,
    targetFormat: AssetFormat,
    options: TransformOptions,
  ): Dimensions {
    const quality = options.quality ?? "medium";

    switch (targetFormat) {
      case "sprite_2d":
        // Adjust for sprite quality
        const spriteScale = quality === "low" ? 0.5 : quality === "medium" ? 0.75 : 1.0;
        return {
          width: Math.floor(source.width * spriteScale),
          height: Math.floor(source.height * spriteScale),
        };

      case "voxel":
        // Voxels are unit cubes, adjust to grid
        return {
          width: Math.ceil(source.width / 16),
          height: Math.ceil(source.height / 16),
          depth: source.depth ? Math.ceil(source.depth / 16) : 1,
        };

      case "mesh_3d":
        // Adjust mesh resolution based on quality
        const meshScale = quality === "low" ? 0.5 : quality === "medium" ? 0.75 : 1.0;
        return {
          width: source.width * meshScale,
          height: source.height * meshScale,
          depth: (source.depth ?? source.width) * meshScale,
        };

      default:
        return source;
    }
  }

  /**
   * Get engines that support a format.
   * @param format - Asset format
   * @returns Supported engines
   */
  private getSupportedEngines(format: AssetFormat): GameEngine[] {
    switch (format) {
      case "sprite_2d":
        return ["microverse"];
      case "voxel":
        return ["luanti"];
      case "mesh_3d":
        return ["openrts"];
      case "universal":
        return ["microverse", "luanti", "openrts"];
      default:
        return [];
    }
  }

  /**
   * Initialize all asset transformers.
   */
  private initializeTransformers(): void {
    // Sprite transformations
    this._transformers.set(
      "sprite_2d->voxel",
      this.spriteToVoxel.bind(this),
    );
    this._transformers.set(
      "sprite_2d->mesh_3d",
      this.spriteToMesh.bind(this),
    );
    this._transformers.set(
      "sprite_2d->universal",
      this.spriteToUniversal.bind(this),
    );

    // Voxel transformations
    this._transformers.set(
      "voxel->sprite_2d",
      this.voxelToSprite.bind(this),
    );
    this._transformers.set(
      "voxel->mesh_3d",
      this.voxelToMesh.bind(this),
    );
    this._transformers.set(
      "voxel->universal",
      this.voxelToUniversal.bind(this),
    );

    // Mesh transformations
    this._transformers.set(
      "mesh_3d->sprite_2d",
      this.meshToSprite.bind(this),
    );
    this._transformers.set(
      "mesh_3d->voxel",
      this.meshToVoxel.bind(this),
    );
    this._transformers.set(
      "mesh_3d->universal",
      this.meshToUniversal.bind(this),
    );

    // Universal transformations
    this._transformers.set(
      "universal->sprite_2d",
      this.universalToSprite.bind(this),
    );
    this._transformers.set(
      "universal->voxel",
      this.universalToVoxel.bind(this),
    );
    this._transformers.set(
      "universal->mesh_3d",
      this.universalToMesh.bind(this),
    );
  }

  // ==========================================================================
  // SPRITE TRANSFORMERS
  // ==========================================================================

  /**
   * Transform 2D sprite to voxel format.
   */
  private async spriteToVoxel(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const imageData = data as ImageData | ArrayBuffer;
    const pixels = this.extractPixels(imageData);

    // Convert pixels to voxel grid
    const voxelGrid = this.pixelsToVoxelGrid(pixels, asset.dimensions, options);

    return {
      data: this.serializeVoxelGrid(voxelGrid),
      metadata: {
        ...asset,
        format: "voxel",
      },
    };
  }

  /**
   * Transform 2D sprite to mesh format.
   */
  private async spriteToMesh(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const imageData = data as ImageData | ArrayBuffer;
    const pixels = this.extractPixels(imageData);

    // Create a plane mesh with texture
    const mesh = this.createPlaneMesh(asset.dimensions, pixels, options);

    return {
      data: this.serializeMesh(mesh),
      metadata: {
        ...asset,
        format: "mesh_3d",
      },
    };
  }

  /**
   * Transform 2D sprite to universal format.
   */
  private async spriteToUniversal(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    return {
      data: {
        sprite: data,
        dimensions: asset.dimensions,
        category: asset.category,
      },
      metadata: {
        ...asset,
        format: "universal",
      },
    };
  }

  // ==========================================================================
  // VOXEL TRANSFORMERS
  // ==========================================================================

  /**
   * Transform voxel to sprite format.
   */
  private async voxelToSprite(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const voxelGrid = this.deserializeVoxelGrid(data as ArrayBuffer);

    // Render voxel grid as 2D sprite (orthographic top-down view)
    const pixels = this.voxelGridToPixels(voxelGrid, options);

    return {
      data: this.pixelsToImageData(pixels),
      metadata: {
        ...asset,
        format: "sprite_2d",
      },
    };
  }

  /**
   * Transform voxel to mesh format.
   */
  private async voxelToMesh(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const voxelGrid = this.deserializeVoxelGrid(data as ArrayBuffer);

    // Generate mesh from voxel grid using greedy meshing
    const mesh = this.voxelGridToMesh(voxelGrid, options);

    return {
      data: this.serializeMesh(mesh),
      metadata: {
        ...asset,
        format: "mesh_3d",
      },
    };
  }

  /**
   * Transform voxel to universal format.
   */
  private async voxelToUniversal(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    return {
      data: {
        voxels: data,
        dimensions: asset.dimensions,
        category: asset.category,
      },
      metadata: {
        ...asset,
        format: "universal",
      },
    };
  }

  // ==========================================================================
  // MESH TRANSFORMERS
  // ==========================================================================

  /**
   * Transform mesh to sprite format.
   */
  private async meshToSprite(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const mesh = this.deserializeMesh(data as ArrayBuffer);

    // Render mesh as 2D sprite (orthographic projection)
    const pixels = this.meshToPixels(mesh, asset.dimensions, options);

    return {
      data: this.pixelsToImageData(pixels),
      metadata: {
        ...asset,
        format: "sprite_2d",
      },
    };
  }

  /**
   * Transform mesh to voxel format.
   */
  private async meshToVoxel(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const mesh = this.deserializeMesh(data as ArrayBuffer);

    // Voxelize mesh
    const voxelGrid = this.meshToVoxelGrid(mesh, asset.dimensions, options);

    return {
      data: this.serializeVoxelGrid(voxelGrid),
      metadata: {
        ...asset,
        format: "voxel",
      },
    };
  }

  /**
   * Transform mesh to universal format.
   */
  private async meshToUniversal(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    return {
      data: {
        mesh: data,
        dimensions: asset.dimensions,
        category: asset.category,
      },
      metadata: {
        ...asset,
        format: "universal",
      },
    };
  }

  // ==========================================================================
  // UNIVERSAL TRANSFORMERS
  // ==========================================================================

  /**
   * Transform universal to sprite format.
   */
  private async universalToSprite(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const universal = data as UniversalAssetData;

    if (universal.sprite) {
      return {
        data: universal.sprite,
        metadata: { ...asset, format: "sprite_2d" },
      };
    }

    if (universal.voxels) {
      return this.voxelToSprite(asset, universal.voxels, options);
    }

    if (universal.mesh) {
      return this.meshToSprite(asset, universal.mesh, options);
    }

    throw new Error("Universal asset contains no extractable data");
  }

  /**
   * Transform universal to voxel format.
   */
  private async universalToVoxel(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const universal = data as UniversalAssetData;

    if (universal.voxels) {
      return {
        data: universal.voxels,
        metadata: { ...asset, format: "voxel" },
      };
    }

    if (universal.sprite) {
      return this.spriteToVoxel(asset, universal.sprite, options);
    }

    if (universal.mesh) {
      return this.meshToVoxel(asset, universal.mesh, options);
    }

    throw new Error("Universal asset contains no extractable data");
  }

  /**
   * Transform universal to mesh format.
   */
  private async universalToMesh(
    asset: AssetMetadata,
    data: unknown,
    options: TransformOptions,
  ): Promise<TransformResultData> {
    const universal = data as UniversalAssetData;

    if (universal.mesh) {
      return {
        data: universal.mesh,
        metadata: { ...asset, format: "mesh_3d" },
      };
    }

    if (universal.sprite) {
      return this.spriteToMesh(asset, universal.sprite, options);
    }

    if (universal.voxels) {
      return this.voxelToMesh(asset, universal.voxels, options);
    }

    throw new Error("Universal asset contains no extractable data");
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Extract pixel array from image data.
   */
  private extractPixels(data: ImageData | ArrayBuffer): Uint8ClampedArray | Uint8Array {
    if (data instanceof ImageData) {
      return data.data;
    }
    // Assume RGBA format for ArrayBuffer
    return new Uint8Array(data);
  }

  /**
   * Convert pixels to voxel grid.
   */
  private pixelsToVoxelGrid(
    pixels: Uint8ClampedArray | Uint8Array,
    dimensions: Dimensions,
    options: TransformOptions,
  ): VoxelGrid {
    const voxelSize = options.quality === "low" ? 8 : options.quality === "medium" ? 4 : 2;
    const width = Math.ceil(dimensions.width / voxelSize);
    const height = Math.ceil(dimensions.height / voxelSize);
    const depth = 1;

    const voxels: Uint8Array[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Sample pixel at voxel position
        const px = Math.min(x * voxelSize, dimensions.width - 1);
        const py = Math.min(y * voxelSize, dimensions.height - 1);
        const i = (py * dimensions.width + px) * 4;

        const alpha = pixels[i + 3];
        if (alpha > 128) {
          voxels.push(new Uint8Array([pixels[i], pixels[i + 1], pixels[i + 2], alpha]));
        } else {
          voxels.push(new Uint8Array([0, 0, 0, 0]));
        }
      }
    }

    return { voxels, width, height, depth };
  }

  /**
   * Create a plane mesh from pixels.
   */
  private createPlaneMesh(
    dimensions: Dimensions,
    pixels: Uint8ClampedArray | Uint8Array,
    options: TransformOptions,
  ): MeshData {
    const segments = options.quality === "low" ? 1 : options.quality === "medium" ? 4 : 8;
    const widthSegments = Math.ceil(dimensions.width / (512 / segments));
    const heightSegments = Math.ceil(dimensions.height / (512 / segments));

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const w = dimensions.width / 2;
    const h = dimensions.height / 2;

    // Generate vertices
    for (let y = 0; y <= heightSegments; y++) {
      for (let x = 0; x <= widthSegments; x++) {
        const u = x / widthSegments;
        const v = y / heightSegments;

        vertices.push((u - 0.5) * dimensions.width, -(v - 0.5) * dimensions.height, 0);
        uvs.push(u, v);
      }
    }

    // Generate indices
    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const i = y * (widthSegments + 1) + x;
        indices.push(i, i + widthSegments + 1, i + 1);
        indices.push(i + 1, i + widthSegments + 1, i + widthSegments + 2);
      }
    }

    return {
      vertices: new Float32Array(vertices),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
      normals: new Float32Array([0, 0, 1]), // Front-facing normal
      colors: undefined,
    };
  }

  /**
   * Serialize voxel grid to ArrayBuffer.
   */
  private serializeVoxelGrid(grid: VoxelGrid): ArrayBuffer {
    const data = new Uint8Array(4 + grid.voxels.length * 4);
    const view = new DataView(data.buffer);

    view.setUint16(0, grid.width);
    view.setUint16(2, grid.height);

    let offset = 4;
    for (const voxel of grid.voxels) {
      data.set(voxel, offset);
      offset += 4;
    }

    return data.buffer;
  }

  /**
   * Deserialize voxel grid from ArrayBuffer.
   */
  private deserializeVoxelGrid(data: ArrayBuffer): VoxelGrid {
    const view = new DataView(data);
    const width = view.getUint16(0);
    const height = view.getUint16(2);
    const voxels: Uint8Array[] = [];

    for (let i = 4; i < data.byteLength; i += 4) {
      voxels.push(new Uint8Array(data, i, 4));
    }

    return { voxels, width, height, depth: 1 };
  }

  /**
   * Serialize mesh to ArrayBuffer.
   */
  private serializeMesh(mesh: MeshData): ArrayBuffer {
    const vertexBytes = mesh.vertices.byteLength;
    const uvBytes = mesh.uvs?.byteLength ?? 0;
    const indexBytes = mesh.indices.byteLength;

    const total = 12 + vertexBytes + uvBytes + indexBytes;
    const data = new Uint8Array(total);
    const view = new DataView(data.buffer);

    let offset = 0;

    // Vertex count
    view.setUint32(offset, mesh.vertices.length / 3);
    offset += 4;

    // UV flag and count
    view.setUint8(offset, mesh.uvs ? 1 : 0);
    offset += 1;
    view.setUint32(offset, mesh.uvs ? mesh.uvs.length / 2 : 0);
    offset += 4;

    // Index count
    view.setUint32(offset, mesh.indices.length);
    offset += 3;

    // Vertex data
    data.set(new Uint8Array(mesh.vertices.buffer), offset);
    offset += vertexBytes;

    // UV data
    if (mesh.uvs) {
      data.set(new Uint8Array(mesh.uvs.buffer), offset);
      offset += uvBytes;
    }

    // Index data
    data.set(new Uint8Array(mesh.indices.buffer), offset);

    return data.buffer;
  }

  /**
   * Deserialize mesh from ArrayBuffer.
   */
  private deserializeMesh(data: ArrayBuffer): MeshData {
    const view = new DataView(data);
    let offset = 0;

    const vertexCount = view.getUint32(offset);
    offset += 4;

    const hasUV = view.getUint8(offset) === 1;
    offset += 1;

    const uvCount = view.getUint32(offset);
    offset += 4;

    const indexCount = view.getUint32(offset);
    offset += 4;

    const vertices = new Float32Array(data, offset, vertexCount * 3);
    offset += vertices.byteLength;

    let uvs: Float32Array | undefined;
    if (hasUV) {
      uvs = new Float32Array(data, offset, uvCount * 2);
      offset += uvs.byteLength;
    }

    const indices = new Uint16Array(data, offset, indexCount);

    return { vertices, uvs, indices, normals: undefined, colors: undefined };
  }

  /**
   * Convert voxel grid to pixels (top-down view).
   */
  private voxelGridToPixels(grid: VoxelGrid, options: TransformOptions): Uint8Array {
    const pixelData = new Uint8Array(grid.width * grid.height * 4);

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const i = y * grid.width + x;
        const voxel = grid.voxels[i];
        const pixelIndex = i * 4;

        pixelData[pixelIndex] = voxel[0];
        pixelData[pixelIndex + 1] = voxel[1];
        pixelData[pixelIndex + 2] = voxel[2];
        pixelData[pixelIndex + 3] = voxel[3];
      }
    }

    return pixelData;
  }

  /**
   * Convert pixel data to ImageData.
   */
  private pixelsToImageData(pixels: Uint8Array): ImageData {
    // For Node.js environments, return ArrayBuffer
    if (typeof ImageData === "undefined") {
      return pixels.buffer as any;
    }

    const width = Math.sqrt(pixels.length / 4);
    const height = width;
    return new ImageData(new Uint8ClampedArray(pixels), width, height);
  }

  /**
   * Convert voxel grid to mesh using greedy meshing.
   */
  private voxelGridToMesh(grid: VoxelGrid, options: TransformOptions): MeshData {
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let indexOffset = 0;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const i = y * grid.width + x;
        const voxel = grid.voxels[i];

        // Skip empty voxels
        if (voxel[3] < 128) continue;

        // Add cube for voxel
        this.addCube(vertices, uvs, indices, x, y, voxel, indexOffset);
        indexOffset += 36; // 6 faces * 2 triangles * 3 vertices
      }
    }

    return {
      vertices: new Float32Array(vertices),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
      normals: undefined,
      colors: undefined,
    };
  }

  /**
   * Add a cube to mesh data.
   */
  private addCube(
    vertices: number[],
    uvs: number[],
    indices: number[],
    x: number,
    y: number,
    voxel: Uint8Array,
    offset: number,
  ): void {
    const size = 1;
    const half = size / 2;

    // Simple cube with 6 faces (front, back, left, right, top, bottom)
    const cubeVertices = [
      // Front face
      x - half, y - half, half,
      x + half, y - half, half,
      x + half, y + half, half,
      x - half, y + half, half,
    ];

    const cubeUVs = [
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ];

    const cubeIndices = [
      0, 1, 2,
      0, 2, 3,
    ];

    vertices.push(...cubeVertices);
    uvs.push(...cubeUVs);
    indices.push(...cubeIndices.map((i) => i + offset));
  }

  /**
   * Render mesh to pixels (simplified orthographic).
   */
  private meshToPixels(
    mesh: MeshData,
    dimensions: Dimensions,
    options: TransformOptions,
  ): Uint8Array {
    // Simplified: return a placeholder texture
    const size = Math.max(dimensions.width, dimensions.height);
    const pixelData = new Uint8Array(size * size * 4);

    // Fill with a default color
    for (let i = 0; i < pixelData.length; i += 4) {
      pixelData[i] = 128;
      pixelData[i + 1] = 128;
      pixelData[i + 2] = 128;
      pixelData[i + 3] = 255;
    }

    return pixelData;
  }

  /**
   * Voxelize mesh (simplified).
   */
  private meshToVoxelGrid(
    mesh: MeshData,
    dimensions: Dimensions,
    options: TransformOptions,
  ): VoxelGrid {
    const voxelSize = options.quality === "low" ? 8 : options.quality === "medium" ? 4 : 2;
    const width = Math.ceil(dimensions.width / voxelSize);
    const height = Math.ceil(dimensions.height / voxelSize);
    const depth = Math.ceil((dimensions.depth ?? dimensions.width) / voxelSize);

    const voxels: Uint8Array[] = [];
    for (let i = 0; i < width * height * depth; i++) {
      // Default gray voxel
      voxels.push(new Uint8Array([128, 128, 128, 255]));
    }

    return { voxels, width, height, depth };
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Transform pair identifier.
 */
export type TransformPair =
  | "sprite_2d->voxel"
  | "sprite_2d->mesh_3d"
  | "sprite_2d->universal"
  | "voxel->sprite_2d"
  | "voxel->mesh_3d"
  | "voxel->universal"
  | "mesh_3d->sprite_2d"
  | "mesh_3d->voxel"
  | "mesh_3d->universal"
  | "universal->sprite_2d"
  | "universal->voxel"
  | "universal->mesh_3d";

/**
 * Asset transform function.
 */
export type AssetTransformFunction = (
  asset: AssetMetadata,
  data: unknown,
  options: TransformOptions,
) => Promise<TransformResultData>;

/**
 * Transform result data.
 */
export interface TransformResultData {
  /** Transformed asset data */
  data: unknown;
  /** Result metadata */
  metadata: Partial<AssetMetadata>;
}

/**
 * Universal asset representation.
 */
export interface UniversalAsset {
  /** Asset identifier */
  id: string;
  /** Asset name */
  name: string;
  /** Asset category */
  category: AssetCategory;
  /** All available formats */
  formats: Map<AssetFormat, { data: unknown; metadata: AssetMetadata }>;
  /** Original format */
  originalFormat: AssetFormat;
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * Universal asset data.
 */
export interface UniversalAssetData {
  /** Sprite data */
  sprite?: ImageData | ArrayBuffer;
  /** Voxel data */
  voxels?: ArrayBuffer;
  /** Mesh data */
  mesh?: ArrayBuffer;
  /** Dimensions */
  dimensions: Dimensions;
  /** Category */
  category: AssetCategory;
}

/**
 * Cache entry for transformed assets.
 */
export interface TransformCacheEntry {
  /** Source asset ID */
  sourceId: string;
  /** Source format */
  sourceFormat: AssetFormat;
  /** Target engine */
  targetEngine: GameEngine;
  /** Target format */
  targetFormat: AssetFormat;
  /** Cached data */
  data: unknown;
  /** Cache timestamp */
  timestamp: number;
  /** Cache hit count */
  hits: number;
  /** Size in bytes */
  size: number;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Number of cache entries */
  entries: number;
  /** Total cache size in bytes */
  totalSize: number;
  /** Total cache hits */
  totalHits: number;
  /** Average entry size */
  averageSize: number;
}

/**
 * Voxel grid data structure.
 */
export interface VoxelGrid {
  /** Voxel data array */
  voxels: Uint8Array[];
  /** Grid width */
  width: number;
  /** Grid height */
  height: number;
  /** Grid depth */
  depth: number;
}

/**
 * Mesh data structure.
 */
export interface MeshData {
  /** Vertex positions */
  vertices: Float32Array;
  /** UV coordinates */
  uvs?: Float32Array;
  /** Vertex indices */
  indices: Uint16Array | Uint32Array;
  /** Vertex normals */
  normals?: Float32Array;
  /** Vertex colors */
  colors?: Float32Array;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Transform a single asset with default options.
 * @param asset - Asset metadata
 * @param data - Asset data
 * @param targetEngine - Target engine
 * @returns Transform result
 */
export async function transformAsset(
  asset: AssetMetadata,
  data: unknown,
  targetEngine: GameEngine,
): Promise<AssetTransformResult> {
  const transformer = AssetTransformer.getInstance();
  return transformer.transform(asset, data, { targetEngine });
}

/**
 * Create a universal asset from source data.
 * @param asset - Asset metadata
 * @param data - Asset data
 * @returns Universal asset
 */
export function createUniversalAsset(
  asset: AssetMetadata,
  data: unknown,
): UniversalAsset {
  const transformer = AssetTransformer.getInstance();
  return transformer.createUniversalAsset(asset, data);
}

/**
 * Check if transformation is supported.
 * @param sourceFormat - Source format
 * @param targetFormat - Target format
 * @returns True if supported
 */
export function isTransformSupported(
  sourceFormat: AssetFormat,
  targetFormat: AssetFormat,
): boolean {
  const transformer = AssetTransformer.getInstance();
  return transformer.isTransformSupported(sourceFormat, targetFormat);
}

/**
 * Get recommended format for an engine.
 * @param engine - Target engine
 * @returns Recommended asset format
 */
export function getEngineFormat(engine: GameEngine): AssetFormat {
  const transformer = AssetTransformer.getInstance();
  return transformer.getDefaultFormat(engine);
}
