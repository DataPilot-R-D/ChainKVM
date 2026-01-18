/**
 * Cache metrics tracking for revocation cache performance monitoring.
 */

export interface CacheMetricsSnapshot {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
  hitRate: number;
}

export interface CacheMetrics {
  recordHit(): void;
  recordMiss(): void;
  recordEviction(count?: number): void;
  setSize(size: number): void;
  getSnapshot(): CacheMetricsSnapshot;
  reset(): void;
}

/** Create a cache metrics tracker. */
export function createCacheMetrics(): CacheMetrics {
  let hits = 0;
  let misses = 0;
  let evictions = 0;
  let size = 0;

  return {
    recordHit(): void {
      hits++;
    },

    recordMiss(): void {
      misses++;
    },

    recordEviction(count = 1): void {
      evictions += count;
    },

    setSize(newSize: number): void {
      size = newSize;
    },

    getSnapshot(): CacheMetricsSnapshot {
      const total = hits + misses;
      return {
        hits,
        misses,
        size,
        evictions,
        hitRate: total > 0 ? hits / total : 0,
      };
    },

    reset(): void {
      hits = 0;
      misses = 0;
      evictions = 0;
      size = 0;
    },
  };
}
