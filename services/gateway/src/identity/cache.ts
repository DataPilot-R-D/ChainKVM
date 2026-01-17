/**
 * Simple TTL cache with max size eviction.
 */

import type { CacheConfig } from './types.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  clear(): void;
}

/**
 * Create a cache with TTL expiration and LRU-style eviction.
 */
export function createCache<T>(config: CacheConfig): Cache<T> {
  const entries = new Map<string, CacheEntry<T>>();
  const insertionOrder: string[] = [];

  function removeExpired(): void {
    const now = Date.now();
    const keysToRemove: string[] = [];

    entries.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach((key) => {
      entries.delete(key);
      const idx = insertionOrder.indexOf(key);
      if (idx !== -1) insertionOrder.splice(idx, 1);
    });
  }

  function evictOldest(): void {
    while (entries.size >= config.maxSize && insertionOrder.length > 0) {
      const oldest = insertionOrder.shift();
      if (oldest) entries.delete(oldest);
    }
  }

  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;

      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        const idx = insertionOrder.indexOf(key);
        if (idx !== -1) insertionOrder.splice(idx, 1);
        return undefined;
      }

      return entry.value;
    },

    set(key: string, value: T): void {
      removeExpired();

      const existingIdx = insertionOrder.indexOf(key);
      if (existingIdx !== -1) {
        insertionOrder.splice(existingIdx, 1);
      } else {
        evictOldest();
      }

      entries.set(key, {
        value,
        expiresAt: Date.now() + config.ttlMs,
      });
      insertionOrder.push(key);
    },

    clear(): void {
      entries.clear();
      insertionOrder.length = 0;
    },
  };
}
