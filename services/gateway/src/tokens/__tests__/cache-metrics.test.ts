/**
 * Tests for CacheMetrics - hit/miss/eviction tracking.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createCacheMetrics, type CacheMetrics } from '../cache-metrics.js';

describe('CacheMetrics', () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = createCacheMetrics();
  });

  describe('recordHit', () => {
    it('should increment hits counter', () => {
      metrics.recordHit();
      expect(metrics.getSnapshot().hits).toBe(1);

      metrics.recordHit();
      metrics.recordHit();
      expect(metrics.getSnapshot().hits).toBe(3);
    });
  });

  describe('recordMiss', () => {
    it('should increment misses counter', () => {
      metrics.recordMiss();
      expect(metrics.getSnapshot().misses).toBe(1);

      metrics.recordMiss();
      expect(metrics.getSnapshot().misses).toBe(2);
    });
  });

  describe('recordEviction', () => {
    it('should increment evictions by count', () => {
      metrics.recordEviction(5);
      expect(metrics.getSnapshot().evictions).toBe(5);

      metrics.recordEviction(3);
      expect(metrics.getSnapshot().evictions).toBe(8);
    });

    it('should default to 1 when no count provided', () => {
      metrics.recordEviction();
      expect(metrics.getSnapshot().evictions).toBe(1);
    });
  });

  describe('setSize', () => {
    it('should update size value', () => {
      metrics.setSize(100);
      expect(metrics.getSnapshot().size).toBe(100);

      metrics.setSize(50);
      expect(metrics.getSnapshot().size).toBe(50);
    });
  });

  describe('getSnapshot', () => {
    it('should return all metrics', () => {
      metrics.recordHit();
      metrics.recordHit();
      metrics.recordMiss();
      metrics.recordEviction(2);
      metrics.setSize(10);

      const snapshot = metrics.getSnapshot();
      expect(snapshot).toEqual({
        hits: 2,
        misses: 1,
        size: 10,
        evictions: 2,
        hitRate: 2 / 3,
      });
    });

    it('should calculate hit rate correctly', () => {
      metrics.recordHit();
      metrics.recordHit();
      metrics.recordHit();
      metrics.recordMiss();

      expect(metrics.getSnapshot().hitRate).toBe(0.75);
    });

    it('should return 0 hit rate when no lookups', () => {
      expect(metrics.getSnapshot().hitRate).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all counters to zero', () => {
      metrics.recordHit();
      metrics.recordMiss();
      metrics.recordEviction(5);
      metrics.setSize(100);

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot).toEqual({
        hits: 0,
        misses: 0,
        size: 0,
        evictions: 0,
        hitRate: 0,
      });
    });
  });
});
