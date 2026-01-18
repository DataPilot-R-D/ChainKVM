/**
 * Tests for TokenRegistry - active token tracking with expiry cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTokenRegistry, type TokenRegistry, type TokenEntry } from '../token-registry.js';
import { createRevocationCache, type RevocationCache } from '../revocation-cache.js';

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

  describe('getByOperator', () => {
    it('should return all tokens for an operator', () => {
      const entry1 = makeEntry({ jti: 'tok_1', operatorDid: 'did:key:z6MkOperator1' });
      const entry2 = makeEntry({ jti: 'tok_2', operatorDid: 'did:key:z6MkOperator1' });
      const entry3 = makeEntry({ jti: 'tok_3', operatorDid: 'did:key:z6MkOperator2' });

      registry.register(entry1);
      registry.register(entry2);
      registry.register(entry3);

      const tokens = registry.getByOperator('did:key:z6MkOperator1');
      expect(tokens).toHaveLength(2);
      expect(tokens.map(t => t.jti)).toContain('tok_1');
      expect(tokens.map(t => t.jti)).toContain('tok_2');
    });

    it('should return empty array for unknown operator', () => {
      const tokens = registry.getByOperator('did:key:z6MkUnknown');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('revokeByOperator', () => {
    it('should revoke all tokens for an operator and return session IDs', () => {
      const entry1 = makeEntry({ jti: 'tok_1', operatorDid: 'did:key:z6MkOperator1', sessionId: 'ses_1' });
      const entry2 = makeEntry({ jti: 'tok_2', operatorDid: 'did:key:z6MkOperator1', sessionId: 'ses_2' });
      const entry3 = makeEntry({ jti: 'tok_3', operatorDid: 'did:key:z6MkOperator2', sessionId: 'ses_3' });

      registry.register(entry1);
      registry.register(entry2);
      registry.register(entry3);

      const sessionIds = registry.revokeByOperator('did:key:z6MkOperator1');
      expect(sessionIds).toHaveLength(2);
      expect(sessionIds).toContain('ses_1');
      expect(sessionIds).toContain('ses_2');
      expect(registry.isValid('tok_1')).toBe(false);
      expect(registry.isValid('tok_2')).toBe(false);
      expect(registry.isValid('tok_3')).toBe(true);
    });

    it('should return unique session IDs when operator has multiple tokens per session', () => {
      const entry1 = makeEntry({ jti: 'tok_1', operatorDid: 'did:key:z6MkOperator1', sessionId: 'ses_1' });
      const entry2 = makeEntry({ jti: 'tok_2', operatorDid: 'did:key:z6MkOperator1', sessionId: 'ses_1' });
      const entry3 = makeEntry({ jti: 'tok_3', operatorDid: 'did:key:z6MkOperator1', sessionId: 'ses_2' });

      registry.register(entry1);
      registry.register(entry2);
      registry.register(entry3);

      const sessionIds = registry.revokeByOperator('did:key:z6MkOperator1');
      expect(sessionIds).toHaveLength(2);
      expect(sessionIds).toContain('ses_1');
      expect(sessionIds).toContain('ses_2');
    });

    it('should return empty array for unknown operator', () => {
      const sessionIds = registry.revokeByOperator('did:key:z6MkUnknown');
      expect(sessionIds).toHaveLength(0);
    });
  });

  describe('revocation cache integration', () => {
    let revocationCache: RevocationCache;

    beforeEach(() => {
      revocationCache = createRevocationCache();
      registry.setRevocationCache(revocationCache);
    });

    it('should add revoked tokens to cache', () => {
      const entry = makeEntry({ jti: 'tok_revoke' });
      registry.register(entry);
      registry.revoke('tok_revoke', 'test reason');

      expect(revocationCache.isRevoked('tok_revoke')).toBe(true);
    });

    it('should check revocation cache in isValid', () => {
      revocationCache.add('tok_cached', new Date(Date.now() + 60000), 'cached');

      expect(registry.isValid('tok_cached')).toBe(false);
    });

    it('should reject tokens that exist in revocation cache but not registry', () => {
      revocationCache.add('tok_only_cached', new Date(Date.now() + 60000));
      expect(registry.isValid('tok_only_cached')).toBe(false);
    });

    it('should add session tokens to cache on revokeBySession', () => {
      const entry1 = makeEntry({ jti: 'tok_1', sessionId: 'ses_target' });
      const entry2 = makeEntry({ jti: 'tok_2', sessionId: 'ses_target' });
      registry.register(entry1);
      registry.register(entry2);

      registry.revokeBySession('ses_target', 'session revoked');

      expect(revocationCache.isRevoked('tok_1')).toBe(true);
      expect(revocationCache.isRevoked('tok_2')).toBe(true);
    });

    it('should add operator tokens to cache on revokeByOperator', () => {
      const entry1 = makeEntry({ jti: 'tok_1', operatorDid: 'did:key:z6MkOp1' });
      const entry2 = makeEntry({ jti: 'tok_2', operatorDid: 'did:key:z6MkOp1' });
      registry.register(entry1);
      registry.register(entry2);

      registry.revokeByOperator('did:key:z6MkOp1', 'operator revoked');

      expect(revocationCache.isRevoked('tok_1')).toBe(true);
      expect(revocationCache.isRevoked('tok_2')).toBe(true);
    });

    it('should cleanup revocation cache during registry cleanup', () => {
      const now = Date.now();
      revocationCache.add('tok_expired', new Date(now - 1000));
      revocationCache.add('tok_valid', new Date(now + 60000));

      registry.cleanup();

      expect(revocationCache.size()).toBe(1);
    });

    it('should return revocation metrics', () => {
      revocationCache.add('tok_1', new Date(Date.now() + 60000));
      revocationCache.isRevoked('tok_1'); // hit
      revocationCache.isRevoked('tok_unknown'); // miss

      const metrics = registry.getRevocationMetrics();
      expect(metrics).not.toBeNull();
      expect(metrics?.hits).toBe(1);
      expect(metrics?.misses).toBe(1);
    });

    it('should return null metrics when no cache configured', () => {
      const plainRegistry = createTokenRegistry();
      expect(plainRegistry.getRevocationMetrics()).toBeNull();
    });
  });
});
