/**
 * Asset Cache Module
 * Handles caching of generated assets using R2 and D1
 */

import {
    BaseAsset,
    CacheEntry,
    CacheStats
} from './types.js';

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
    // R2 bucket for storing cached assets
    r2Bucket?: string;

    // D1 database for cache metadata
    d1Database?: any;

    // Default TTL for cache entries (milliseconds)
    defaultTTL?: number;

    // Maximum cache size (bytes)
    maxSizeBytes?: number;

    // Enable/disable caching
    enabled?: boolean;
}

// ============================================================================
// Cache Entry
// ============================================================================

interface StoredCacheEntry {
    key: string;
    asset_id: string;
    data: string; // JSON stringified data
    content_type: string;
    created_at: number;
    expires_at: number;
    access_count: number;
    last_accessed: number;
    size_bytes: number;
    tags?: string[];
}

// ============================================================================
// Asset Cache Class
// ============================================================================

export class AssetCache {
    private config: CacheConfig;
    private memoryCache: Map<string, StoredCacheEntry>;
    private totalSizeBytes: number;
    private hitCount: number;
    private missCount: number;
    private evictionCount: number;

    constructor(config: CacheConfig) {
        this.config = {
            defaultTTL: 3600000, // 1 hour
            maxSizeBytes: 1073741824, // 1GB
            enabled: true,
            ...config
        };
        this.memoryCache = new Map();
        this.totalSizeBytes = 0;
        this.hitCount = 0;
        this.missCount = 0;
        this.evictionCount = 0;
    }

    // ========================================================================
    // Cache Operations
    // ========================================================================

    /**
     * Get a cached asset
     */
    async get(key: string): Promise<StoredCacheEntry | null> {
        if (!this.config.enabled) {
            this.missCount++;
            return null;
        }

        // Check memory cache first
        const entry = this.memoryCache.get(key);

        if (!entry) {
            // Check D1/R2 cache
            const storedEntry = await this.getStoredEntry(key);
            if (storedEntry) {
                // Move to memory cache
                this.memoryCache.set(key, storedEntry);
                this.updateAccess(key);
                this.hitCount++;
                return storedEntry;
            }

            this.missCount++;
            return null;
        }

        // Check if expired
        if (entry.expires_at < Date.now()) {
            this.memoryCache.delete(key);
            this.missCount++;
            return null;
        }

        // Update access statistics
        this.updateAccess(key);
        this.hitCount++;

        return entry;
    }

    /**
     * Set a cached asset
     */
    async set(
        key: string,
        assetId: string,
        data: unknown,
        options?: CacheSetOptions
    ): Promise<boolean> {
        if (!this.config.enabled) {
            return false;
        }

        const now = Date.now();
        const ttl = options?.ttl || this.config.defaultTTL!;
        const dataStr = JSON.stringify(data);
        const sizeBytes = new Blob([dataStr]).size;

        // Check size limit
        if (this.config.maxSizeBytes && this.totalSizeBytes + sizeBytes > this.config.maxSizeBytes) {
            await this.evictLRU(sizeBytes);
        }

        const entry: StoredCacheEntry = {
            key,
            asset_id: assetId,
            data: dataStr,
            content_type: options?.contentType || 'application/json',
            created_at: now,
            expires_at: now + ttl,
            access_count: 0,
            last_accessed: now,
            size_bytes: sizeBytes,
            tags: options?.tags
        };

        // Store in memory
        this.memoryCache.set(key, entry);
        this.totalSizeBytes += sizeBytes;

        // Store in D1/R2 if configured
        if (this.config.r2Bucket || this.config.d1Database) {
            await this.storeEntry(key, entry, options?.dataBlob);
        }

        return true;
    }

    /**
     * Check if a key exists in cache
     */
    async has(key: string): Promise<boolean> {
        if (!this.config.enabled) {
            return false;
        }

        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key)!;
            return entry.expires_at > Date.now();
        }

        return await this.hasStoredEntry(key);
    }

    /**
     * Delete a cached entry
     */
    async delete(key: string): Promise<boolean> {
        let deleted = false;

        // Delete from memory
        if (this.memoryCache.has(key)) {
            const entry = this.memoryCache.get(key)!;
            this.totalSizeBytes -= entry.size_bytes;
            this.memoryCache.delete(key);
            deleted = true;
        }

        // Delete from storage
        if (this.config.r2Bucket || this.config.d1Database) {
            await this.deleteStoredEntry(key);
            deleted = true;
        }

        return deleted;
    }

    /**
     * Clear all cache entries
     */
    async clear(): Promise<void> {
        this.memoryCache.clear();
        this.totalSizeBytes = 0;

        if (this.config.r2Bucket || this.config.d1Database) {
            await this.clearStoredEntries();
        }
    }

    // ========================================================================
    // Cache Tags
    // ========================================================================

    /**
     * Get entries by tag
     */
    async getByTag(tag: string): Promise<StoredCacheEntry[]> {
        const results: StoredCacheEntry[] = [];

        for (const entry of this.memoryCache.values()) {
            if (entry.tags?.includes(tag) && entry.expires_at > Date.now()) {
                results.push(entry);
            }
        }

        // Also check stored entries
        const storedEntries = await this.getStoredEntriesByTag(tag);
        results.push(...storedEntries);

        return results;
    }

    /**
     * Invalidate entries by tag
     */
    async invalidateByTag(tag: string): Promise<number> {
        let count = 0;

        const keysToDelete: string[] = [];

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.tags?.includes(tag)) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            await this.delete(key);
            count++;
        }

        return count;
    }

    // ========================================================================
    // Cache Statistics
    // ========================================================================

    /**
     * Get cache statistics
     */
    async getStats(): Promise<CacheStats> {
        const storedStats = await this.getStoredStats();

        return {
            totalEntries: this.memoryCache.size + (storedStats.totalEntries || 0),
            totalSizeBytes: this.totalSizeBytes + (storedStats.totalSizeBytes || 0),
            hitRate: this.hitCount + this.missCount > 0
                ? this.hitCount / (this.hitCount + this.missCount)
                : 0,
            evictionCount: this.evictionCount + (storedStats.evictionCount || 0)
        };
    }

    /**
     * Get cache keys matching a pattern
     */
    async keys(pattern?: string): Promise<string[]> {
        const memoryKeys = Array.from(this.memoryCache.keys());

        if (!pattern) {
            return [...memoryKeys, ...(await this.getStoredKeys())];
        }

        const regex = new RegExp(pattern);
        const matchingKeys = memoryKeys.filter(key => regex.test(key));
        const storedKeys = await this.getStoredKeys(pattern);

        return [...matchingKeys, ...storedKeys];
    }

    // ========================================================================
    // Eviction
    // ========================================================================

    /**
     * Evict least recently used entries to free up space
     */
    private async evictLRU(requiredBytes: number): Promise<void> {
        // Sort entries by last accessed time
        const sortedEntries = Array.from(this.memoryCache.entries())
            .sort((a, b) => a[1].last_accessed - b[1].last_accessed);

        let freedBytes = 0;

        for (const [key, entry] of sortedEntries) {
            if (freedBytes >= requiredBytes) {
                break;
            }

            this.totalSizeBytes -= entry.size_bytes;
            this.memoryCache.delete(key);
            freedBytes += entry.size_bytes;
            this.evictionCount++;
        }

        // Also evict from storage if needed
        if (freedBytes < requiredBytes && (this.config.r2Bucket || this.config.d1Database)) {
            await this.evictStoredLRU(requiredBytes - freedBytes);
        }
    }

    /**
     * Clean up expired entries
     */
    async cleanup(): Promise<number> {
        const now = Date.now();
        let cleaned = 0;

        const keysToDelete: string[] = [];

        for (const [key, entry] of this.memoryCache.entries()) {
            if (entry.expires_at < now) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            await this.delete(key);
            cleaned++;
        }

        // Also clean up stored entries
        cleaned += await this.cleanupStoredEntries();

        return cleaned;
    }

    // ========================================================================
    // Storage Operations (D1/R2)
    // ========================================================================

    private async getStoredEntry(key: string): Promise<StoredCacheEntry | null> {
        // D1 lookup implementation
        if (this.config.d1Database) {
            try {
                const result = await this.config.d1Database.prepare(
                    'SELECT * FROM asset_cache WHERE key = ? AND expires_at > ?'
                ).bind(key, Date.now()).first();

                if (result) {
                    return result as StoredCacheEntry;
                }
            } catch (e) {
                console.error('D1 lookup error:', e);
            }
        }

        return null;
    }

    private async hasStoredEntry(key: string): Promise<boolean> {
        if (this.config.d1Database) {
            try {
                const result = await this.config.d1Database.prepare(
                    'SELECT 1 FROM asset_cache WHERE key = ? AND expires_at > ?'
                ).bind(key, Date.now()).first();

                return !!result;
            } catch {
                return false;
            }
        }

        return false;
    }

    private async storeEntry(
        key: string,
        entry: StoredCacheEntry,
        dataBlob?: Blob
    ): Promise<void> {
        // Store metadata in D1
        if (this.config.d1Database) {
            try {
                await this.config.d1Database.prepare(`
                    INSERT OR REPLACE INTO asset_cache
                    (key, asset_id, data, content_type, created_at, expires_at, access_count, last_accessed, size_bytes, tags)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    key,
                    entry.asset_id,
                    entry.data,
                    entry.content_type,
                    entry.created_at,
                    entry.expires_at,
                    entry.access_count,
                    entry.last_accessed,
                    entry.size_bytes,
                    entry.tags ? JSON.stringify(entry.tags) : null
                ).run();
            } catch (e) {
                console.error('D1 store error:', e);
            }
        }

        // Store actual data in R2 if blob provided
        if (this.config.r2Bucket && dataBlob) {
            try {
                await this.config.r2Bucket.put(key, dataBlob, {
                    httpMetadata: {
                        contentType: entry.content_type
                    },
                    customMetadata: {
                        assetId: entry.asset_id,
                        expiresAt: entry.expires_at.toString()
                    }
                });
            } catch (e) {
                console.error('R2 store error:', e);
            }
        }
    }

    private async deleteStoredEntry(key: string): Promise<void> {
        if (this.config.d1Database) {
            try {
                await this.config.d1Database.prepare(
                    'DELETE FROM asset_cache WHERE key = ?'
                ).bind(key).run();
            } catch (e) {
                console.error('D1 delete error:', e);
            }
        }

        if (this.config.r2Bucket) {
            try {
                await this.config.r2Bucket.delete(key);
            } catch (e) {
                console.error('R2 delete error:', e);
            }
        }
    }

    private async clearStoredEntries(): Promise<void> {
        if (this.config.d1Database) {
            try {
                await this.config.d1Database.prepare(
                    'DELETE FROM asset_cache'
                ).run();
            } catch (e) {
                console.error('D1 clear error:', e);
            }
        }

        if (this.config.r2Bucket) {
            try {
                // List and delete all objects
                const listed = await this.config.r2Bucket.list();
                if (listed.objects.length > 0) {
                    await this.config.r2Bucket.delete(listed.objects.map(o => o.key));
                }
            } catch (e) {
                console.error('R2 clear error:', e);
            }
        }
    }

    private async getStoredKeys(pattern?: string): Promise<string[]> {
        if (!this.config.d1Database) {
            return [];
        }

        try {
            let query = 'SELECT key FROM asset_cache WHERE expires_at > ?';
            const params: [number, string | undefined] = [Date.now(), undefined];

            if (pattern) {
                query += ' AND key LIKE ?';
                params[1] = pattern;
            }

            const result = await this.config.d1Database.prepare(query).bind(...params).all();
            return result.map((r: any) => r.key);
        } catch {
            return [];
        }
    }

    private async getStoredEntriesByTag(tag: string): Promise<StoredCacheEntry[]> {
        if (!this.config.d1Database) {
            return [];
        }

        try {
            const result = await this.config.d1Database.prepare(`
                SELECT * FROM asset_cache
                WHERE expires_at > ?
                AND JSON_EXTRACT(tags, '$') LIKE ?
            `).bind(Date.now(), `%"${tag}"%`).all();

            return result as StoredCacheEntry[];
        } catch {
            return [];
        }
    }

    private async evictStoredLRU(requiredBytes: number): Promise<void> {
        if (!this.config.d1Database) {
            return;
        }

        try {
            // Get and delete LRU entries until we've freed enough space
            const entries = await this.config.d1Database.prepare(`
                SELECT key, size_bytes FROM asset_cache
                WHERE expires_at > ?
                ORDER BY last_accessed ASC
            `).bind(Date.now()).all();

            let freedBytes = 0;

            for (const entry of entries as Array<{ key: string; size_bytes: number }>) {
                if (freedBytes >= requiredBytes) {
                    break;
                }

                await this.deleteStoredEntry(entry.key);
                freedBytes += entry.size_bytes;
                this.evictionCount++;
            }
        } catch (e) {
            console.error('D1 evict error:', e);
        }
    }

    private async cleanupStoredEntries(): Promise<number> {
        if (!this.config.d1Database) {
            return 0;
        }

        try {
            const result = await this.config.d1Database.prepare(`
                DELETE FROM asset_cache WHERE expires_at < ?
            `).bind(Date.now()).run();

            return result.meta.changes || 0;
        } catch {
            return 0;
        }
    }

    private async getStoredStats(): Promise<Partial<CacheStats>> {
        if (!this.config.d1Database) {
            return {};
        }

        try {
            const result = await this.config.d1Database.prepare(`
                SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as size
                FROM asset_cache
                WHERE expires_at > ?
            `).bind(Date.now()).first();

            return {
                totalEntries: (result as any)?.count || 0,
                totalSizeBytes: (result as any)?.size || 0
            };
        } catch {
            return {};
        }
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private updateAccess(key: string): void {
        const entry = this.memoryCache.get(key);
        if (entry) {
            entry.access_count++;
            entry.last_accessed = Date.now();
        }
    }

    /**
     * Generate a cache key from request parameters
     */
    static generateKey(provider: string, operation: string, params: Record<string, unknown>): string {
        const paramStr = JSON.stringify(params, Object.keys(params).sort());
        const hash = btoa(paramStr).slice(0, 16);
        return `${provider}:${operation}:${hash}`;
    }

    /**
     * Generate a cache key for an asset
     */
    static generateAssetKey(assetType: string, prompt: string, options?: Record<string, unknown>): string {
        const optionsStr = options ? JSON.stringify(options, Object.keys(options).sort()) : '';
        const combined = `${assetType}:${prompt}:${optionsStr}`;
        const hash = btoa(combined).slice(0, 16);
        return `asset:${assetType}:${hash}`;
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface CacheSetOptions {
    ttl?: number;
    contentType?: string;
    tags?: string[];
    dataBlob?: Blob;
}

// ============================================================================
// Factory Function
// ============================================================================

export function createAssetCache(config: CacheConfig): AssetCache {
    return new AssetCache(config);
}
