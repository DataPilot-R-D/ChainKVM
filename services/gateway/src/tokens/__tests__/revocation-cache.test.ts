/**
 * Tests for RevocationCache - in-memory revocation tracking with metrics.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRevocationCache, type RevocationCache, type RevokedEntry } from '../revocation-cache.js';

describe('RevocationCache', () => {
  let cache: RevocationCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createRevocationCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('add', () => {
    it('should add a revoked entry', () => {
      const expiresAt = new Date(Date.now() + 60000);
      cache.add('jti_123', expiresAt, 'test reason');
      expect(cache.isRevoked('jti_123')).toBe(true);
    });

    it('should update size metric', () => {
      cache.add('jti_1', new Date(Date.now() + 60000));
      cache.add('jti_2', new Date(Date.now() + 60000));
      expect(cache.size()).toBe(2);
      expect(cache.getMetrics().size).toBe(2);
    });
  });

  describe('isRevoked', () => {
    it('should return true for revoked token', () => {
      cache.add('jti_revoked', new Date(Date.now() + 60000));
      expect(cache.isRevoked('jti_revoked')).toBe(true);
    });

    it('should return false for unknown token', () => {
      expect(cache.isRevoked('jti_unknown')).toBe(false);
    });

    it('should return false for expired revocation and remove it', () => {
      cache.add('jti_expired', new Date(Date.now() - 1000));
      expect(cache.isRevoked('jti_expired')).toBe(false);
      expect(cache.size()).toBe(0);
    });

    it('should record cache hits and misses', () => {
      cache.add('jti_1', new Date(Date.now() + 60000));

      cache.isRevoked('jti_1'); // hit
      cache.isRevoked('jti_unknown'); // miss

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove entry and return true', () => {
      cache.add('jti_1', new Date(Date.now() + 60000));
      const result = cache.remove('jti_1');
      expect(result).toBe(true);
      expect(cache.isRevoked('jti_1')).toBe(false);
    });

    it('should return false for unknown token', () => {
      const result = cache.remove('jti_unknown');
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      const now = Date.now();
      cache.add('jti_expired1', new Date(now - 1000));
      cache.add('jti_expired2', new Date(now - 2000));
      cache.add('jti_valid', new Date(now + 60000));

      const removed = cache.cleanup();
      expect(removed).toBe(2);
      expect(cache.size()).toBe(1);
    });

    it('should return 0 when nothing to clean', () => {
      cache.add('jti_valid', new Date(Date.now() + 60000));
      const removed = cache.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe('getAll', () => {
    it('should return all cached entries', () => {
      cache.add('jti_1', new Date(Date.now() + 60000), 'reason 1');
      cache.add('jti_2', new Date(Date.now() + 60000), 'reason 2');

      const all = cache.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(e => e.jti)).toContain('jti_1');
      expect(all.map(e => e.jti)).toContain('jti_2');
    });
  });

  describe('loadFromStore', () => {
    it('should load valid entries from store', () => {
      const now = Date.now();
      const entries: RevokedEntry[] = [
        { jti: 'jti_1', revokedAt: new Date(now - 1000), expiresAt: new Date(now + 60000), reason: 'r1' },
        { jti: 'jti_2', revokedAt: new Date(now - 2000), expiresAt: new Date(now + 60000), reason: 'r2' },
      ];

      cache.loadFromStore(entries);
      expect(cache.size()).toBe(2);
      expect(cache.isRevoked('jti_1')).toBe(true);
      expect(cache.isRevoked('jti_2')).toBe(true);
    });

    it('should skip expired entries when loading', () => {
      const now = Date.now();
      const entries: RevokedEntry[] = [
        { jti: 'jti_expired', revokedAt: new Date(now - 1000), expiresAt: new Date(now - 100), reason: 'r1' },
        { jti: 'jti_valid', revokedAt: new Date(now - 1000), expiresAt: new Date(now + 60000), reason: 'r2' },
      ];

      cache.loadFromStore(entries);
      expect(cache.size()).toBe(1);
      expect(cache.isRevoked('jti_valid')).toBe(true);
    });
  });

  describe('size limits and eviction', () => {
    it('should evict oldest entries when at capacity', () => {
      const smallCache = createRevocationCache({ maxSize: 5 });

      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100); // Ensure different revokedAt times
        smallCache.add(`jti_${i}`, new Date(Date.now() + 60000));
      }
      expect(smallCache.size()).toBe(5);

      // Add one more - should trigger eviction
      vi.advanceTimersByTime(100);
      smallCache.add('jti_new', new Date(Date.now() + 60000));

      // Should have evicted at least 1 entry (10% = 0.5, rounded up to 1)
      expect(smallCache.size()).toBeLessThanOrEqual(5);
      expect(smallCache.isRevoked('jti_new')).toBe(true);
    });

    it('should record eviction metrics', () => {
      const smallCache = createRevocationCache({ maxSize: 3 });

      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100);
        smallCache.add(`jti_${i}`, new Date(Date.now() + 60000));
      }

      expect(smallCache.getMetrics().evictions).toBeGreaterThan(0);
    });
  });

  describe('getMetrics', () => {
    it('should return accurate metrics snapshot', () => {
      cache.add('jti_1', new Date(Date.now() + 60000));
      cache.add('jti_2', new Date(Date.now() + 60000));

      cache.isRevoked('jti_1'); // hit
      cache.isRevoked('jti_unknown'); // miss
      cache.isRevoked('jti_unknown'); // miss

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(2);
      expect(metrics.size).toBe(2);
      expect(metrics.hitRate).toBeCloseTo(1 / 3);
    });
  });
});
