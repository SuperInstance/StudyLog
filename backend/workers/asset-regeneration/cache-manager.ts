/**
 * Cache Manager for Asset Regeneration System
 *
 * Manages caching of all three asset forms (MicroVerse, Luanti, OpenRTS)
 * to avoid redundant regeneration operations.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import {
  AnyAsset,
  AssetForm,
  CacheStatus,
  RegenerationConfig,
  RegenerationRequest,
  GeneratedFormResult
} from './types.js';

// ============================================================================
// CACHE ENTRY
// ============================================================================

/**
 * Represents a single cache entry for an asset form
 */
interface CacheEntry {
  /** Asset ID */
  assetId: string;
  /** Form type */
  form: AssetForm;
  /** Cache key (hash of inputs) */
  key: string;
  /** Path to cached asset file */
  path: string;
  /** Paths to associated files (textures, metadata) */
  associatedPaths: string[];
  /** Entry creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessed: Date;
  /** Entry size in bytes */
  size: number;
  /** Cache key metadata */
  metadata: {
    quality: string;
    stylePriority: string;
    sourceHash: string;
    optionsHash: string;
  };
}

// ============================================================================
// CACHE MANAGER CLASS
// ============================================================================

export class CacheManager {
  private cache: Map<string, CacheEntry>;
  private config: RegenerationConfig['cache'];
  private cacheDirectory: string;
  private indexFile: string;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(config: RegenerationConfig['cache']) {
    this.config = config;
    this.cacheDirectory = config.directory;
    this.indexFile = path.join(this.cacheDirectory, 'cache-index.json');
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    // Ensure cache directory exists
    await this.ensureDirectory();

    // Load existing cache index
    await this.loadIndex();

    // Clean up expired entries if TTL is set
    if (this.config.ttl > 0) {
      await this.cleanupExpired();
    }
  }

  /**
   * Generate cache key for a regeneration request
   */
  generateKey(request: RegenerationRequest, form: AssetForm): string {
    const sourceId = typeof request.source === 'string'
      ? request.source
      : request.source.id;

    const keyData = {
      source: sourceId,
      form,
      quality: request.quality,
      stylePriority: request.stylePriority,
      styleOverrides: request.styleOverrides,
      // Include relevant form-specific options
      options: this.getFormOptions(request, form)
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Check if an asset form is cached
   */
  async has(assetId: string, form: AssetForm, key: string): Promise<boolean> {
    const cacheKey = this.getCacheKey(assetId, form, key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      return false;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      await this.remove(cacheKey);
      this.stats.misses++;
      return false;
    }

    // Update last accessed time
    entry.lastAccessed = new Date();
    this.stats.hits++;
    return true;
  }

  /**
   * Retrieve a cached asset form
   */
  async get(
    assetId: string,
    form: AssetForm,
    key: string
  ): Promise<AnyAsset | null> {
    const cacheKey = this.getCacheKey(assetId, form, key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      await this.remove(cacheKey);
      return null;
    }

    try {
      // Load asset from disk
      const assetData = await fs.readFile(entry.path, 'utf-8');
      const asset: AnyAsset = JSON.parse(assetData);

      // Update access time
      entry.lastAccessed = new Date();

      return asset;
    } catch (error) {
      console.error(`Failed to load cached asset: ${error}`);
      await this.remove(cacheKey);
      return null;
    }
  }

  /**
   * Store an asset form in cache
   */
  async set(
    assetId: string,
    form: AssetForm,
    key: string,
    asset: AnyAsset,
    associatedPaths: string[] = []
  ): Promise<void> {
    // Check cache size limit before adding
    await this.ensureCapacity();

    const cacheKey = this.getCacheKey(assetId, form, key);
    const assetPath = this.getAssetPath(assetId, form, key);

    // Ensure directory exists
    await fs.mkdir(path.dirname(assetPath), { recursive: true });

    // Write asset to disk
    const assetData = JSON.stringify(asset, null, 2);
    await fs.writeFile(assetPath, assetData, 'utf-8');

    // Get file size
    const stats = await fs.stat(assetPath);
    let totalSize = stats.size;

    // Calculate size of associated files
    for (const assocPath of associatedPaths) {
      try {
        const assocStats = await fs.stat(assocPath);
        totalSize += assocStats.size;
      } catch {
        // Associated file might not exist yet
      }
    }

    // Create cache entry
    const entry: CacheEntry = {
      assetId,
      form,
      key,
      path: assetPath,
      associatedPaths,
      createdAt: new Date(),
      lastAccessed: new Date(),
      size: totalSize,
      metadata: {
        quality: (asset as any).quality || 'standard',
        stylePriority: 'balanced',
        sourceHash: crypto.createHash('md5').update(assetId).digest('hex'),
        optionsHash: key.substring(0, 16)
      }
    };

    // Store in memory cache
    this.cache.set(cacheKey, entry);

    // Persist index
    await this.saveIndex();
  }

  /**
   * Remove an entry from cache
   */
  async remove(cacheKey: string): Promise<boolean> {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return false;
    }

    try {
      // Delete main asset file
      await fs.unlink(entry.path).catch(() => {});

      // Delete associated files
      for (const assocPath of entry.associatedPaths) {
        await fs.unlink(assocPath).catch(() => {});
      }

      // Remove from memory cache
      this.cache.delete(cacheKey);
      this.stats.evictions++;

      // Persist index
      await this.saveIndex();

      return true;
    } catch (error) {
      console.error(`Failed to remove cache entry: ${error}`);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Delete all files in cache directory
    const entries = Array.from(this.cache.values());
    for (const entry of entries) {
      await this.remove(this.getCacheKey(entry.assetId, entry.form, entry.key));
    }

    // Clear memory cache
    this.cache.clear();

    // Reset stats
    this.stats = { hits: 0, misses: 0, evictions: 0 };

    await this.saveIndex();
  }

  /**
   * Get cache status information
   */
  async getStatus(): Promise<CacheStatus> {
    const formCounts = {
      microverse: 0,
      luanti: 0,
      openrts: 0
    };

    let totalSize = 0;
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;
    const staleAssets: string[] = [];

    for (const entry of this.cache.values()) {
      formCounts[entry.form as keyof typeof formCounts]++;
      totalSize += entry.size;

      if (!oldestDate || entry.createdAt < oldestDate) {
        oldestDate = entry.createdAt;
      }
      if (!newestDate || entry.createdAt > newestDate) {
        newestDate = entry.createdAt;
      }

      if (this.isExpired(entry)) {
        staleAssets.push(entry.assetId);
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0
      ? this.stats.hits / totalRequests
      : 0;

    return {
      totalAssets: this.cache.size,
      cacheSize: totalSize,
      formCounts,
      hitRate,
      oldestEntry: oldestDate,
      newestEntry: newestDate,
      staleAssets
    };
  }

  /**
   * Prefetch cache for multiple assets
   */
  async prefetch(assetIds: string[], forms: AssetForm[]): Promise<void> {
    // This would typically trigger background regeneration
    // For now, just log the prefetch request
    console.log(`Prefetching ${assetIds.length} assets for ${forms.length} forms`);
  }

  /**
   * Invalidate cache for specific asset
   */
  async invalidate(assetId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.assetId === assetId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.remove(key);
    }
  }

  /**
   * Invalidate cache by form type
   */
  async invalidateForm(form: AssetForm): Promise<void> {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.form === form) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.remove(key);
    }
  }

  // ========================================================================
  // PRIVATE METHODS
  // ========================================================================

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDirectory, { recursive: true });
    } catch (error) {
      console.error(`Failed to create cache directory: ${error}`);
      throw error;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexFile, 'utf-8');
      const entries = JSON.parse(data) as CacheEntry[];

      this.cache.clear();
      for (const entry of entries) {
        // Convert date strings back to Date objects
        entry.createdAt = new Date(entry.createdAt);
        entry.lastAccessed = new Date(entry.lastAccessed);
        this.cache.set(this.getCacheKey(entry.assetId, entry.form, entry.key), entry);
      }
    } catch (error) {
      // Index file doesn't exist or is invalid - start fresh
      this.cache.clear();
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const entries = Array.from(this.cache.values());
      const data = JSON.stringify(entries, null, 2);
      await fs.writeFile(this.indexFile, data, 'utf-8');
    } catch (error) {
      console.error(`Failed to save cache index: ${error}`);
    }
  }

  private getCacheKey(assetId: string, form: AssetForm, key: string): string {
    return `${assetId}:${form}:${key}`;
  }

  private getAssetPath(assetId: string, form: AssetForm, key: string): string {
    // Use first 8 chars of key as subdirectory for distribution
    const subdir = key.substring(0, 8);
    return path.join(
      this.cacheDirectory,
      form,
      subdir,
      `${assetId}-${key.substring(0, 16)}.json`
    );
  }

  private isExpired(entry: CacheEntry): boolean {
    if (this.config.ttl <= 0) {
      return false;
    }
    const now = Date.now();
    const entryAge = now - entry.createdAt.getTime();
    return entryAge > this.config.ttl * 1000;
  }

  private async ensureCapacity(): Promise<void> {
    if (this.config.maxSize <= 0) {
      return;
    }

    // Calculate current cache size
    let currentSize = 0;
    for (const entry of this.cache.values()) {
      currentSize += entry.size;
    }

    // Evict entries if over capacity
    while (currentSize > this.config.maxSize && this.cache.size > 0) {
      // Find least recently used entry
      let lruKey: string | null = null;
      let lruTime = Date.now();

      for (const [key, entry] of this.cache.entries()) {
        if (entry.lastAccessed.getTime() < lruTime) {
          lruTime = entry.lastAccessed.getTime();
          lruKey = key;
        }
      }

      if (lruKey) {
        const entry = this.cache.get(lruKey);
        if (entry) {
          currentSize -= entry.size;
          await this.remove(lruKey);
        }
      } else {
        break;
      }
    }
  }

  private async cleanupExpired(): Promise<void> {
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.remove(key);
    }
  }

  private getFormOptions(request: RegenerationRequest, form: AssetForm): Record<string, unknown> {
    // Extract form-specific options from the request
    const overrides = request.styleOverrides || {};

    switch (form) {
      case AssetForm.MICROVERSE:
        return {
          spriteStyle: overrides.spriteStyle || 'nes_16bit',
          paletteSize: overrides.paletteSize || 16
        };
      case AssetForm.LUANTI:
        return {
          voxelStyle: overrides.voxelStyle || 'classic',
          maxVoxels: overrides.maxVoxels || 4096
        };
      case AssetForm.OPENRTS:
        return {
          meshStyle: overrides.meshStyle || 'standard',
          maxTriangles: overrides.maxTriangles || 5000
        };
      default:
        return {};
    }
  }

  /**
   * Warm up cache with commonly used assets
   */
  async warmup(assetIds: string[]): Promise<void> {
    console.log(`Warming up cache for ${assetIds.length} assets...`);
    // This would typically trigger regeneration for common assets
    // Implementation depends on your asset source
  }

  /**
   * Export cache statistics
   */
  getStats(): typeof CacheManager.prototype.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }
}

// ============================================================================
// CACHE MANAGER SINGLETON
// ============================================================================

let cacheManagerInstance: CacheManager | null = null;

export function getCacheManager(config?: RegenerationConfig['cache']): CacheManager {
  if (!cacheManagerInstance && config) {
    cacheManagerInstance = new CacheManager(config);
  }
  if (!cacheManagerInstance) {
    throw new Error('CacheManager not initialized. Call initialize() first.');
  }
  return cacheManagerInstance;
}

export async function initializeCacheManager(
  config: RegenerationConfig['cache']
): Promise<CacheManager> {
  if (!cacheManagerInstance) {
    cacheManagerInstance = new CacheManager(config);
  }
  await cacheManagerInstance.initialize();
  return cacheManagerInstance;
}
