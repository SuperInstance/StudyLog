/**
 * Main Regenerator - Asset Regeneration Orchestrator
 *
 * Coordinates regeneration of assets across all three forms:
 * - MicroVerse (2D sprites)
 * - Luanti (voxels)
 * - OpenRTS (3D meshes)
 *
 * Maintains style consistency across all forms.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  AnyAsset,
  AssetForm,
  BaseAsset,
  RegenerationRequest,
  RegenerationResponse,
  RegenerationStatus,
  GeneratedFormResult,
  StyleProfile,
  QualityLevel,
  StylePriority,
  ComparisonView,
  ComparisonMetrics
} from './types.js';
import { StylePreserver } from './style-preserver.js';
import { SpriteGenerator } from './sprite-generator.js';
import { VoxelGenerator } from './voxel-generator.js';
import { MeshGenerator } from './mesh-generator.js';
import { CacheManager, initializeCacheManager } from './cache-manager.js';

// ============================================================================
// REGENERATOR CONFIGURATION
// ============================================================================

export interface RegeneratorConfig {
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    directory: string;
  };
  workers: {
    enabled: boolean;
    maxWorkers: number;
    timeout: number;
  };
  storage: {
    type: 'local' | 's3' | 'gcs';
    basePath: string;
    bucket?: string;
  };
  outputPaths: {
    microverse: string;
    luanti: string;
    openrts: string;
  };
  defaultQuality: QualityLevel;
  defaultStylePriority: StylePriority;
}

// ============================================================================
// PROGRESS CALLBACK
// ============================================================================

export interface ProgressCallback {
  (progress: {
    assetId: string;
    currentForm: AssetForm;
    progress: number; // 0-1
    stage: string;
  }): void;
}

// ============================================================================
// REGENERATOR CLASS
// ============================================================================

export class Regenerator {
  private spriteGenerator: SpriteGenerator;
  private voxelGenerator: VoxelGenerator;
  private meshGenerator: MeshGenerator;
  private stylePreserver: StylePreserver;
  private cacheManager: CacheManager | null;
  private config: RegeneratorConfig;

  constructor(config: Partial<RegeneratorConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.spriteGenerator = new SpriteGenerator(this.config.outputPaths.microverse);
    this.voxelGenerator = new VoxelGenerator(this.config.outputPaths.luanti);
    this.meshGenerator = new MeshGenerator(this.config.outputPaths.openrts);
    this.stylePreserver = new StylePreserver();
    this.cacheManager = null;
  }

  /**
   * Initialize the regenerator (sets up cache, etc.)
   */
  async initialize(): Promise<void> {
    if (this.config.cache.enabled) {
      this.cacheManager = await initializeCacheManager(this.config.cache);
    }

    // Ensure output directories exist
    await Promise.all([
      this.ensureDirectory(this.config.outputPaths.microverse),
      this.ensureDirectory(this.config.outputPaths.luanti),
      this.ensureDirectory(this.config.outputPaths.openrts)
    ]);
  }

  /**
   * Regenerate a single asset into all target forms
   */
  async regenerate(
    request: RegenerationRequest,
    onProgress?: ProgressCallback
  ): Promise<RegenerationResponse> {
    const startTime = Date.now();
    const assetId = typeof request.source === 'string'
      ? request.source
      : request.source.id;

    // Determine target forms
    const targetForms = request.targetForms || [
      AssetForm.MICROVERSE,
      AssetForm.LUANTI,
      AssetForm.OPENRTS
    ];

    const formResults: GeneratedFormResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Load or extract source asset
    const sourceAsset = await this.loadSourceAsset(request.source);

    if (!sourceAsset) {
      return {
        assetId,
        forms: [],
        status: RegenerationStatus.FAILED,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        errors: ['Failed to load source asset']
      };
    }

    // Extract style profile from source
    const styleProfile = this.stylePreserver.extractStyleProfile(sourceAsset);

    // Apply style overrides if provided
    if (request.styleOverrides) {
      Object.assign(styleProfile, request.styleOverrides);
    }

    // Generate each target form
    for (const form of targetForms) {
      onProgress?.({
        assetId,
        currentForm: form,
        progress: 0,
        stage: 'starting'
      });

      try {
        const result = await this.regenerateForm(
          sourceAsset,
          form,
          request,
          styleProfile,
          onProgress?.bind(null, { assetId, currentForm: form, progress: 0, stage: '' })
        );
        formResults.push(result);

        if (!result.success) {
          errors.push(`${form}: ${result.error}`);
        }

        onProgress?.({
          assetId,
          currentForm: form,
          progress: 1,
          stage: 'complete'
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`${form}: ${errorMessage}`);
        formResults.push({
          form,
          success: false,
          error: errorMessage,
          processingTime: 0,
          fromCache: false
        });
      }
    }

    // Determine overall status
    const status = this.determineStatus(formResults);

    // Cache successful results
    if (this.cacheManager) {
      for (const result of formResults) {
        if (result.success && result.asset) {
          const cacheKey = this.cacheManager.generateKey(request, result.form);
          await this.cacheManager.set(
            assetId,
            result.form,
            cacheKey,
            result.asset
          );
        }
      }
    }

    return {
      assetId,
      forms: formResults,
      status,
      timestamp: new Date(),
      processingTime: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      metadata: request.metadata
    };
  }

  /**
   * Regenerate a specific form from source
   */
  async regenerateForm(
    sourceAsset: BaseAsset | AnyAsset,
    targetForm: AssetForm,
    request: RegenerationRequest,
    styleProfile: StyleProfile,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<GeneratedFormResult> {
    const startTime = Date.now();
    const assetId = typeof request.source === 'string'
      ? request.source
      : request.source.id;

    // Check cache first
    if (this.cacheManager && !request.forceRegenerate) {
      const cacheKey = this.cacheManager.generateKey(request, targetForm);
      const cached = await this.cacheManager.get(assetId, targetForm, cacheKey);

      if (cached) {
        return {
          form: targetForm,
          success: true,
          asset: cached,
          processingTime: Date.now() - startTime,
          fromCache: true
        };
      }
    }

    let asset: AnyAsset | null = null;
    let error: string | undefined;

    // Generate based on source and target types
    try {
      switch (targetForm) {
        case AssetForm.MICROVERSE:
          asset = await this.generateMicroVerse(sourceAsset, request, styleProfile, onProgress);
          break;
        case AssetForm.LUANTI:
          asset = await this.generateLuanti(sourceAsset, request, styleProfile, onProgress);
          break;
        case AssetForm.OPENRTS:
          asset = await this.generateOpenRTS(sourceAsset, request, styleProfile, onProgress);
          break;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    return {
      form: targetForm,
      success: asset !== null,
      asset: asset || undefined,
      error,
      processingTime: Date.now() - startTime,
      fromCache: false
    };
  }

  // ========================================================================
  // FORM-SPECIFIC GENERATION
  // ========================================================================

  private async generateMicroVerse(
    sourceAsset: BaseAsset | AnyAsset,
    request: RegenerationRequest,
    styleProfile: StyleProfile,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<AnyAsset> {
    onProgress?.(0.1, 'extracting_palette');

    // Adapt palette for sprite form
    const adaptedPalette = this.stylePreserver.adaptPaletteForForm(
      styleProfile.palette,
      AssetForm.MICROVERSE,
      request.stylePriority
    );

    onProgress?.(0.3, 'generating_sprite');

    // Generate based on source type
    if (this.isAssetForm(sourceAsset, AssetForm.LUANTI)) {
      return await this.spriteGenerator.convertFrom3D(
        sourceAsset,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality
        }
      );
    } else if (this.isAssetForm(sourceAsset, AssetForm.OPENRTS)) {
      return await this.spriteGenerator.convertFrom3D(
        sourceAsset,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality
        }
      );
    } else {
      // Source is an image path or base asset
      const sourcePath = this.getAssetPath(sourceAsset);
      return await this.spriteGenerator.generateFromImage(
        sourcePath,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality
        }
      );
    }
  }

  private async generateLuanti(
    sourceAsset: BaseAsset | AnyAsset,
    request: RegenerationRequest,
    styleProfile: StyleProfile,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<AnyAsset> {
    onProgress?.(0.1, 'extracting_palette');

    const adaptedPalette = this.stylePreserver.adaptPaletteForForm(
      styleProfile.palette,
      AssetForm.LUANTI,
      request.stylePriority
    );

    onProgress?.(0.3, 'generating_voxels');

    if (this.isAssetForm(sourceAsset, AssetForm.MICROVERSE)) {
      return await this.voxelGenerator.generateFromSprite(
        sourceAsset,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality
        }
      );
    } else if (this.isAssetForm(sourceAsset, AssetForm.OPENRTS)) {
      return await this.voxelGenerator.generateFromMesh(
        sourceAsset,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality
        }
      );
    } else {
      // Generate from image path
      const sourcePath = this.getAssetPath(sourceAsset);
      // First convert to sprite, then to voxel
      const tempSprite = await this.spriteGenerator.generateFromImage(sourcePath, {
        palette: adaptedPalette,
        quality: request.quality
      });
      return await this.voxelGenerator.generateFromSprite(tempSprite, {
        palette: adaptedPalette,
        proportions: styleProfile.proportions,
        quality: request.quality
      });
    }
  }

  private async generateOpenRTS(
    sourceAsset: BaseAsset | AnyAsset,
    request: RegenerationRequest,
    styleProfile: StyleProfile,
    onProgress?: (progress: number, stage: string) => void
  ): Promise<AnyAsset> {
    onProgress?.(0.1, 'extracting_palette');

    const adaptedPalette = this.stylePreserver.adaptPaletteForForm(
      styleProfile.palette,
      AssetForm.OPENRTS,
      request.stylePriority
    );

    onProgress?.(0.3, 'generating_mesh');

    if (this.isAssetForm(sourceAsset, AssetForm.MICROVERSE)) {
      return await this.meshGenerator.generateFromSprite(
        sourceAsset,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality,
          includeSkeleton: true,
          lodLevels: 3
        }
      );
    } else if (this.isAssetForm(sourceAsset, AssetForm.LUANTI)) {
      return await this.meshGenerator.generateFromVoxels(
        sourceAsset,
        {
          palette: adaptedPalette,
          proportions: styleProfile.proportions,
          quality: request.quality,
          lodLevels: 3
        }
      );
    } else {
      // Generate from image path
      const sourcePath = this.getAssetPath(sourceAsset);
      const tempSprite = await this.spriteGenerator.generateFromImage(sourcePath, {
        palette: adaptedPalette,
        quality: request.quality
      });
      return await this.meshGenerator.generateFromSprite(tempSprite, {
        palette: adaptedPalette,
        proportions: styleProfile.proportions,
        quality: request.quality,
        includeSkeleton: true,
        lodLevels: 3
      });
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private async loadSourceAsset(source: string | BaseAsset): Promise<BaseAsset | AnyAsset | null> {
    if (typeof source !== 'string') {
      return source;
    }

    // Try to load from storage
    const assetPath = path.join(this.config.storage.basePath, `${source}.json`);

    try {
      const data = await fs.readFile(assetPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      // File doesn't exist - treat as image path
      return {
        id: source,
        name: path.basename(source),
        category: 'unknown',
        tags: [],
        createdAt: new Date(),
        modifiedAt: new Date(),
        sourcePath: source
      } as BaseAsset;
    }
  }

  private getAssetPath(asset: BaseAsset | AnyAsset): string {
    if ('sourcePath' in asset && asset.sourcePath) {
      return asset.sourcePath;
    }
    return path.join(this.config.storage.basePath, asset.id);
  }

  private isAssetForm(asset: BaseAsset | AnyAsset, form: AssetForm): asset is AnyAsset {
    return 'form' in asset && asset.form === form;
  }

  private determineStatus(results: GeneratedFormResult[]): RegenerationStatus {
    if (results.length === 0) {
      return RegenerationStatus.FAILED;
    }

    const allSuccess = results.every(r => r.success);
    const anySuccess = results.some(r => r.success);
    const allCached = results.every(r => r.fromCache);

    if (allSuccess && allCached) {
      return RegenerationStatus.CACHED;
    } else if (allSuccess) {
      return RegenerationStatus.COMPLETED;
    } else if (anySuccess) {
      return RegenerationStatus.PARTIAL;
    } else {
      return RegenerationStatus.FAILED;
    }
  }

  private mergeConfig(userConfig: Partial<RegeneratorConfig>): RegeneratorConfig {
    const defaultConfig: RegeneratorConfig = {
      cache: {
        enabled: true,
        maxSize: 1024 * 1024 * 1024, // 1GB
        ttl: 86400 * 7, // 7 days
        directory: '/tmp/asset-regeneration-cache'
      },
      workers: {
        enabled: false,
        maxWorkers: 4,
        timeout: 300000 // 5 minutes
      },
      storage: {
        type: 'local',
        basePath: '/tmp/asset-regeneration-storage'
      },
      outputPaths: {
        microverse: '/tmp/asset-regeneration/microverse',
        luanti: '/tmp/asset-regeneration/luanti',
        openrts: '/tmp/asset-regeneration/openrts'
      },
      defaultQuality: QualityLevel.STANDARD,
      defaultStylePriority: StylePriority.BALANCED
    };

    return {
      cache: { ...defaultConfig.cache, ...userConfig.cache },
      workers: { ...defaultConfig.workers, ...userConfig.workers },
      storage: { ...defaultConfig.storage, ...userConfig.storage },
      outputPaths: { ...defaultConfig.outputPaths, ...userConfig.outputPaths },
      defaultQuality: userConfig.defaultQuality ?? defaultConfig.defaultQuality,
      defaultStylePriority: userConfig.defaultStylePriority ?? defaultConfig.defaultStylePriority
    };
  }

  private async ensureDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  // ========================================================================
  // PUBLIC API METHODS
  // ========================================================================

  /**
   * Create comparison view for an asset across all forms
   */
  async createComparisonView(assetId: string): Promise<ComparisonView> {
    // Load all available forms for the asset
    const forms: ComparisonView['forms'] = {};

    // Try to load from cache or storage
    if (this.cacheManager) {
      for (const form of [AssetForm.MICROVERSE, AssetForm.LUANTI, AssetForm.OPENRTS]) {
        // Would need cache key - simplified here
        // In production, would query storage for all forms
      }
    }

    // Calculate comparison metrics
    const metrics = this.calculateComparisonMetrics(forms);

    return {
      assetId,
      assetName: assetId,
      forms,
      metrics,
      previews: {}
    };
  }

  private calculateComparisonMetrics(
    forms: ComparisonView['forms']
  ): ComparisonMetrics {
    let colorSimilarity = 1;
    let silhouetteSimilarity = 1;
    let proportionSimilarity = 1;

    // Compare if we have at least 2 forms
    const availableForms = Object.keys(forms).length;

    if (availableForms >= 2) {
      // Extract style profiles and compare
      const profiles: any[] = [];

      if (forms.microverse) {
        profiles.push(this.stylePreserver.extractStyleProfile(forms.microverse));
      }
      if (forms.luanti) {
        profiles.push(this.stylePreserver.extractStyleProfile(forms.luanti));
      }
      if (forms.openrts) {
        profiles.push(this.stylePreserver.extractStyleProfile(forms.openrts));
      }

      if (profiles.length >= 2) {
        const comparisons = [];
        for (let i = 0; i < profiles.length - 1; i++) {
          comparisons.push(this.stylePreserver.compareProfiles(profiles[i], profiles[i + 1]));
        }

        colorSimilarity = comparisons.reduce((sum, c) => sum + c.colorSimilarity, 0) / comparisons.length;
        silhouetteSimilarity = comparisons.reduce((sum, c) => sum + c.silhouetteSimilarity, 0) / comparisons.length;
        proportionSimilarity = comparisons.reduce((sum, c) => sum + c.proportionSimilarity, 0) / comparisons.length;
      }
    }

    const overallConsistency = (colorSimilarity + silhouetteSimilarity + proportionSimilarity) / 3;

    return {
      colorSimilarity,
      silhouetteSimilarity,
      proportionSimilarity,
      overallConsistency
    };
  }

  /**
   * Get cache status
   */
  async getCacheStatus() {
    if (!this.cacheManager) {
      return {
        totalAssets: 0,
        cacheSize: 0,
        formCounts: {
          microverse: 0,
          luanti: 0,
          openrts: 0
        },
        hitRate: 0,
        staleAssets: []
      };
    }

    return await this.cacheManager.getStatus();
  }

  /**
   * Clear cache for a specific asset
   */
  async invalidateAsset(assetId: string): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.invalidate(assetId);
    }
  }

  /**
   * Clear cache for a specific form
   */
  async invalidateForm(form: AssetForm): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.invalidateForm(form);
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.clear();
    }
  }

  /**
   * Transfer style from source to target assets
   */
  async transferStyle(
    sourceAssetId: string,
    targetAssetIds: string[],
    options: {
      sourceForm?: AssetForm;
      targetForms?: AssetForm[];
      preserveColors?: boolean;
      preserveProportions?: boolean;
      preserveSilhouette?: boolean;
      preserveMaterials?: boolean;
    } = {}
  ): Promise<Map<string, RegenerationResponse>> {
    const results = new Map<string, RegenerationResponse>();

    // Load source asset to extract style
    const sourceAsset = await this.loadSourceAsset(sourceAssetId);
    if (!sourceAsset || !('form' in sourceAsset)) {
      throw new Error('Source asset not found or invalid');
    }

    const sourceForm = options.sourceForm || sourceAsset.form;
    const sourceProfile = this.stylePreserver.extractStyleProfile(sourceAsset as AnyAsset);

    // Transfer style to each target
    for (const targetId of targetAssetIds) {
      const request: RegenerationRequest = {
        source: targetId,
        quality: this.config.defaultQuality,
        stylePriority: StylePriority.COLOR_EXACT,
        styleOverrides: this.stylePreserver.transferStyle(
          sourceProfile,
          sourceAsset as AnyAsset,
          options
        ),
        forceRegenerate: true
      };

      try {
        const response = await this.regenerate(request);
        results.set(targetId, response);
      } catch (error) {
        results.set(targetId, {
          assetId: targetId,
          forms: [],
          status: RegenerationStatus.FAILED,
          timestamp: new Date(),
          processingTime: 0,
          errors: [error instanceof Error ? error.message : String(error)]
        });
      }
    }

    return results;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let regeneratorInstance: Regenerator | null = null;

export async function getRegenerator(config?: Partial<RegeneratorConfig>): Promise<Regenerator> {
  if (!regeneratorInstance) {
    regeneratorInstance = new Regenerator(config);
    await regeneratorInstance.initialize();
  }
  return regeneratorInstance;
}

export function createRegenerator(config?: Partial<RegeneratorConfig>): Regenerator {
  return new Regenerator(config);
}
