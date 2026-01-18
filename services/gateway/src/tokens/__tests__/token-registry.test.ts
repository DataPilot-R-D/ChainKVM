/**
 * Tests for TokenRegistry - active token tracking with expiry cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTokenRegistry, type TokenRegistry, type TokenEntry } from '../token-registry.js';

describe('TokenRegistry', () => {
  let registry: TokenRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = createTokenRegistry();
  });

  afterEach(() => {
    registry.stopCleanup();
    vi.useRealTimers();
  });

  function makeEntry(overrides: Partial<TokenEntry> = {}): TokenEntry {
    return {
      jti: `tok_${Math.random().toString(36).slice(2)}`,
      sessionId: 'ses_test123',
      operatorDid: 'did:key:z6MkTest',
      robotId: 'robot-001',
      expiresAt: new Date(Date.now() + 60000), // 1 minute from now
      ...overrides,
    };
  }

  describe('register', () => {
    it('should register a token entry', () => {
      const entry = makeEntry({ jti: 'tok_abc123' });
      registry.register(entry);
      expect(registry.isValid('tok_abc123')).toBe(true);
    });

    it('should overwrite existing entry with same jti', () => {
      const entry1 = makeEntry({ jti: 'tok_same', sessionId: 'ses_1' });
      const entry2 = makeEntry({ jti: 'tok_same', sessionId: 'ses_2' });

      registry.register(entry1);
      registry.register(entry2);

      const found = registry.get('tok_same');
      expect(found?.sessionId).toBe('ses_2');
    });
  });

  describe('isValid', () => {
    it('should return true for valid unexpired token', () => {
      const entry = makeEntry({ jti: 'tok_valid' });
      registry.register(entry);
      expect(registry.isValid('tok_valid')).toBe(true);
    });

    it('should return false for unregistered token', () => {
      expect(registry.isValid('tok_unknown')).toBe(false);
    });

    it('should return false for expired token', () => {
      const entry = makeEntry({
        jti: 'tok_expired',
        expiresAt: new Date(Date.now() - 1000), // 1s in the past
      });
      registry.register(entry);
      expect(registry.isValid('tok_expired')).toBe(false);
    });
  });

  describe('revoke', () => {
    it('should revoke existing token and return true', () => {
      const entry = makeEntry({ jti: 'tok_revoke' });
      registry.register(entry);

      const result = registry.revoke('tok_revoke');
      expect(result).toBe(true);
      expect(registry.isValid('tok_revoke')).toBe(false);
    });

    it('should return false for unknown token', () => {
      const result = registry.revoke('tok_unknown');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return token entry if exists', () => {
      const entry = makeEntry({ jti: 'tok_get' });
      registry.register(entry);

      const found = registry.get('tok_get');
      expect(found).toEqual(entry);
    });

    it('should return undefined for unknown token', () => {
      expect(registry.get('tok_unknown')).toBeUndefined();
    });
  });

  describe('getExpiringSoon', () => {
    it('should return tokens expiring within threshold', () => {
      const now = Date.now();
      const soonEntry = makeEntry({
        jti: 'tok_soon',
        expiresAt: new Date(now + 30000), // 30s
      });
      const laterEntry = makeEntry({
        jti: 'tok_later',
        expiresAt: new Date(now + 120000), // 2min
      });

      registry.register(soonEntry);
      registry.register(laterEntry);

      const expiring = registry.getExpiringSoon(60000); // 1min threshold
      expect(expiring.map(e => e.jti)).toContain('tok_soon');
      expect(expiring.map(e => e.jti)).not.toContain('tok_later');
    });

    it('should not include already expired tokens', () => {
      const expiredEntry = makeEntry({
        jti: 'tok_expired',
        expiresAt: new Date(Date.now() - 1000),
      });
      registry.register(expiredEntry);

      const expiring = registry.getExpiringSoon(60000);
      expect(expiring.map(e => e.jti)).not.toContain('tok_expired');
    });
  });

  describe('cleanup', () => {
    it('should remove expired tokens and return count', () => {
      const now = Date.now();
      const expiredEntry = makeEntry({
        jti: 'tok_expired',
        expiresAt: new Date(now - 1000),
      });
      const validEntry = makeEntry({
        jti: 'tok_valid',
        expiresAt: new Date(now + 60000),
      });

      registry.register(expiredEntry);
      registry.register(validEntry);

      const removed = registry.cleanup();
      expect(removed).toBe(1);
      expect(registry.isValid('tok_expired')).toBe(false);
      expect(registry.isValid('tok_valid')).toBe(true);
    });

    it('should return 0 when no tokens to clean', () => {
      const validEntry = makeEntry({ jti: 'tok_valid' });
      registry.register(validEntry);

      const removed = registry.cleanup();
      expect(removed).toBe(0);
    });
  });

  describe('automatic cleanup', () => {
    it('should run cleanup on interval', () => {
      const now = Date.now();
      const expiredEntry = makeEntry({
        jti: 'tok_will_expire',
        expiresAt: new Date(now + 5000), // expires in 5s
      });
      registry.register(expiredEntry);

      registry.startCleanup(10000); // cleanup every 10s

      // Initially valid
      expect(registry.isValid('tok_will_expire')).toBe(true);

      // Advance time past expiry
      vi.advanceTimersByTime(6000);
      expect(registry.isValid('tok_will_expire')).toBe(false);

      // Advance to trigger cleanup
      vi.advanceTimersByTime(5000);
      expect(registry.get('tok_will_expire')).toBeUndefined();
    });

    it('should stop cleanup when requested', () => {
      registry.startCleanup(1000);
      registry.stopCleanup();

      // Add expired entry
      const expiredEntry = makeEntry({
        jti: 'tok_expired',
        expiresAt: new Date(Date.now() - 1000),
      });
      registry.register(expiredEntry);

      // Advance time - cleanup should not run
      vi.advanceTimersByTime(5000);
      // Entry still exists (not cleaned up automatically)
      expect(registry.get('tok_expired')).toBeDefined();
    });
  });

  describe('getBySession', () => {
    it('should return all tokens for a session', () => {
      const entry1 = makeEntry({ jti: 'tok_1', sessionId: 'ses_target' });
      const entry2 = makeEntry({ jti: 'tok_2', sessionId: 'ses_target' });
      const entry3 = makeEntry({ jti: 'tok_3', sessionId: 'ses_other' });

      registry.register(entry1);
      registry.register(entry2);
      registry.register(entry3);

      const tokens = registry.getBySession('ses_target');
      expect(tokens).toHaveLength(2);
      expect(tokens.map(t => t.jti)).toContain('tok_1');
      expect(tokens.map(t => t.jti)).toContain('tok_2');
    });
  });

  describe('revokeBySession', () => {
    it('should revoke all tokens for a session', () => {
      const entry1 = makeEntry({ jti: 'tok_1', sessionId: 'ses_target' });
      const entry2 = makeEntry({ jti: 'tok_2', sessionId: 'ses_target' });
      const entry3 = makeEntry({ jti: 'tok_3', sessionId: 'ses_other' });

      registry.register(entry1);
      registry.register(entry2);
      registry.register(entry3);

      const count = registry.revokeBySession('ses_target');
      expect(count).toBe(2);
      expect(registry.isValid('tok_1')).toBe(false);
      expect(registry.isValid('tok_2')).toBe(false);
      expect(registry.isValid('tok_3')).toBe(true);
    });
  });

  describe('size', () => {
    it('should return number of registered tokens', () => {
      expect(registry.size()).toBe(0);

      registry.register(makeEntry({ jti: 'tok_1' }));
      expect(registry.size()).toBe(1);

      registry.register(makeEntry({ jti: 'tok_2' }));
      expect(registry.size()).toBe(2);
    });
  });
});
