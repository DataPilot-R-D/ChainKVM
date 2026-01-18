/**
 * In-memory revocation cache for tracking revoked tokens.
 * Provides fast O(1) lookup for revocation checks with automatic cleanup.
 */

import { createCacheMetrics, type CacheMetrics, type CacheMetricsSnapshot } from './cache-metrics.js';

export interface RevokedEntry {
  jti: string;
  revokedAt: Date;
  expiresAt: Date;
  reason?: string;
}

export interface RevocationCacheConfig {
  maxSize: number;
}

export interface RevocationCache {
  add(jti: string, expiresAt: Date, reason?: string): void;
  isRevoked(jti: string): boolean;
  remove(jti: string): boolean;
  cleanup(): number;
  getMetrics(): CacheMetricsSnapshot;
  getAll(): RevokedEntry[];
  loadFromStore(entries: RevokedEntry[]): void;
  size(): number;
}

const DEFAULT_MAX_SIZE = 100000;

/** Create a revocation cache instance. */
export function createRevocationCache(config?: Partial<RevocationCacheConfig>): RevocationCache {
  const maxSize = config?.maxSize ?? DEFAULT_MAX_SIZE;
  const cache = new Map<string, RevokedEntry>();
  const metrics: CacheMetrics = createCacheMetrics();

  /** Evict oldest entries when at capacity. */
  function evictIfNeeded(): void {
    if (cache.size < maxSize) return;

    const entries = Array.from(cache.values());
    entries.sort((a, b) => a.revokedAt.getTime() - b.revokedAt.getTime());

    const toEvict = Math.max(1, Math.floor(cache.size * 0.1));
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      cache.delete(entries[i].jti);
    }
    metrics.recordEviction(toEvict);
  }

  return {
    add(jti: string, expiresAt: Date, reason?: string): void {
      evictIfNeeded();
      cache.set(jti, {
        jti,
        revokedAt: new Date(),
        expiresAt,
        reason,
      });
      metrics.setSize(cache.size);
    },

    isRevoked(jti: string): boolean {
      const entry = cache.get(jti);
      if (!entry) {
        metrics.recordMiss();
        return false;
      }

      if (entry.expiresAt.getTime() <= Date.now()) {
        cache.delete(jti);
        metrics.setSize(cache.size);
        metrics.recordMiss();
        return false;
      }

      metrics.recordHit();
      return true;
    },

    remove(jti: string): boolean {
      const deleted = cache.delete(jti);
      if (deleted) {
        metrics.setSize(cache.size);
      }
      return deleted;
    },

    cleanup(): number {
      const now = Date.now();
      let removed = 0;

      for (const [jti, entry] of cache) {
        if (entry.expiresAt.getTime() <= now) {
          cache.delete(jti);
          removed++;
        }
      }

      if (removed > 0) {
        metrics.setSize(cache.size);
        metrics.recordEviction(removed);
      }
      return removed;
    },

    getMetrics(): CacheMetricsSnapshot {
      return metrics.getSnapshot();
    },

    getAll(): RevokedEntry[] {
      return Array.from(cache.values());
    },

    loadFromStore(entries: RevokedEntry[]): void {
      const now = Date.now();
      for (const entry of entries) {
        if (entry.expiresAt.getTime() > now) {
          cache.set(entry.jti, {
            ...entry,
            revokedAt: new Date(entry.revokedAt),
            expiresAt: new Date(entry.expiresAt),
          });
        }
      }
      metrics.setSize(cache.size);
    },

    size(): number {
      return cache.size;
    },
  };
}
