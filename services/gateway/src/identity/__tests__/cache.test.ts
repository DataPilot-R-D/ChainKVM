import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCache } from '../cache.js';

describe('createCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      const cache = createCache<string>({ ttlMs: 60000, maxSize: 10 });

      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      const cache = createCache<string>({ ttlMs: 60000, maxSize: 10 });

      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should clear all entries', () => {
      const cache = createCache<string>({ ttlMs: 60000, maxSize: 10 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should return value before TTL expires', () => {
      const cache = createCache<string>({ ttlMs: 1000, maxSize: 10 });

      cache.set('key', 'value');
      vi.advanceTimersByTime(500);

      expect(cache.get('key')).toBe('value');
    });

    it('should return undefined after TTL expires', () => {
      const cache = createCache<string>({ ttlMs: 1000, maxSize: 10 });

      cache.set('key', 'value');
      vi.advanceTimersByTime(1001);

      expect(cache.get('key')).toBeUndefined();
    });

    it('should handle different TTLs for different entries', () => {
      const cache = createCache<string>({ ttlMs: 1000, maxSize: 10 });

      cache.set('key1', 'value1');
      vi.advanceTimersByTime(500);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(600);

      expect(cache.get('key1')).toBeUndefined(); // expired
      expect(cache.get('key2')).toBe('value2'); // still valid
    });
  });

  describe('max size eviction', () => {
    it('should evict oldest entry when max size exceeded', () => {
      const cache = createCache<string>({ ttlMs: 60000, maxSize: 2 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      expect(cache.get('key1')).toBeUndefined(); // evicted
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
    });

    it('should respect max size of 1', () => {
      const cache = createCache<string>({ ttlMs: 60000, maxSize: 1 });

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });
  });

  describe('update behavior', () => {
    it('should update existing entry', () => {
      const cache = createCache<string>({ ttlMs: 60000, maxSize: 10 });

      cache.set('key', 'value1');
      cache.set('key', 'value2');

      expect(cache.get('key')).toBe('value2');
    });

    it('should reset TTL on update', () => {
      const cache = createCache<string>({ ttlMs: 1000, maxSize: 10 });

      cache.set('key', 'value1');
      vi.advanceTimersByTime(800);
      cache.set('key', 'value2');
      vi.advanceTimersByTime(800);

      expect(cache.get('key')).toBe('value2'); // still valid
    });
  });
});
