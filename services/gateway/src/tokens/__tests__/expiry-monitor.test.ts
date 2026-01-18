/**
 * Tests for ExpiryMonitor - near-expiry warning generation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTokenRegistry, type TokenRegistry, type TokenEntry } from '../token-registry.js';
import { createExpiryMonitor, type ExpiryMonitor, type ExpiryWarning } from '../expiry-monitor.js';

describe('ExpiryMonitor', () => {
  let registry: TokenRegistry;
  let monitor: ExpiryMonitor;
  let warnings: ExpiryWarning[];

  beforeEach(() => {
    vi.useFakeTimers();
    registry = createTokenRegistry();
    monitor = createExpiryMonitor();
    warnings = [];
  });

  afterEach(() => {
    monitor.stop();
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

  describe('start/stop lifecycle', () => {
    it('should start monitoring and can be stopped', () => {
      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      expect(monitor.isRunning()).toBe(true);

      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should throw if started while already running', () => {
      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      expect(() => {
        monitor.start(registry, (w) => warnings.push(w), {
          warningThresholdMs: 30000,
          checkIntervalMs: 1000,
        });
      }).toThrow('Monitor is already running');
    });

    it('should be safe to stop when not running', () => {
      expect(() => monitor.stop()).not.toThrow();
    });
  });

  describe('warning generation', () => {
    it('should emit warning when token enters warning threshold', () => {
      const entry = makeEntry({
        jti: 'tok_warn',
        expiresAt: new Date(Date.now() + 25000), // 25s from now
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000, // warn 30s before expiry
        checkIntervalMs: 1000,
      });

      // Advance time to trigger check
      vi.advanceTimersByTime(1000);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].jti).toBe('tok_warn');
      expect(warnings[0].sessionId).toBe('ses_test123');
    });

    it('should not warn for tokens outside threshold', () => {
      const entry = makeEntry({
        jti: 'tok_later',
        expiresAt: new Date(Date.now() + 120000), // 2min from now
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      vi.advanceTimersByTime(1000);
      expect(warnings).toHaveLength(0);
    });

    it('should not warn for already expired tokens', () => {
      const entry = makeEntry({
        jti: 'tok_expired',
        expiresAt: new Date(Date.now() - 1000),
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      vi.advanceTimersByTime(1000);
      expect(warnings).toHaveLength(0);
    });

    it('should only warn once per token', () => {
      const entry = makeEntry({
        jti: 'tok_once',
        expiresAt: new Date(Date.now() + 25000),
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      // Multiple check cycles
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000);
      vi.advanceTimersByTime(1000);

      expect(warnings).toHaveLength(1);
    });

    it('should track multiple tokens independently', () => {
      const entry1 = makeEntry({
        jti: 'tok_1',
        expiresAt: new Date(Date.now() + 20000),
      });
      const entry2 = makeEntry({
        jti: 'tok_2',
        expiresAt: new Date(Date.now() + 25000),
      });
      registry.register(entry1);
      registry.register(entry2);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      vi.advanceTimersByTime(1000);

      expect(warnings).toHaveLength(2);
      expect(warnings.map(w => w.jti)).toContain('tok_1');
      expect(warnings.map(w => w.jti)).toContain('tok_2');
    });
  });

  describe('warning content', () => {
    it('should include correct remaining time', () => {
      const expiresAt = new Date(Date.now() + 20000);
      const entry = makeEntry({
        jti: 'tok_time',
        expiresAt,
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      vi.advanceTimersByTime(1000);

      expect(warnings).toHaveLength(1);
      // Remaining time should be roughly 19s (20s - 1s elapsed)
      expect(warnings[0].remainingMs).toBeLessThanOrEqual(20000);
      expect(warnings[0].remainingMs).toBeGreaterThan(18000);
    });

    it('should include expiry timestamp', () => {
      const expiresAt = new Date(Date.now() + 25000);
      const entry = makeEntry({
        jti: 'tok_ts',
        expiresAt,
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      vi.advanceTimersByTime(1000);

      expect(warnings[0].expiresAt).toEqual(expiresAt);
    });
  });

  describe('dynamic token registration', () => {
    it('should detect newly registered tokens that are near expiry', () => {
      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      // No tokens initially
      vi.advanceTimersByTime(1000);
      expect(warnings).toHaveLength(0);

      // Add token mid-monitoring
      const entry = makeEntry({
        jti: 'tok_new',
        expiresAt: new Date(Date.now() + 20000),
      });
      registry.register(entry);

      // Next check cycle should detect it
      vi.advanceTimersByTime(1000);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].jti).toBe('tok_new');
    });
  });

  describe('clearWarned', () => {
    it('should allow re-warning after clear', () => {
      const entry = makeEntry({
        jti: 'tok_clear',
        expiresAt: new Date(Date.now() + 25000),
      });
      registry.register(entry);

      monitor.start(registry, (w) => warnings.push(w), {
        warningThresholdMs: 30000,
        checkIntervalMs: 1000,
      });

      vi.advanceTimersByTime(1000);
      expect(warnings).toHaveLength(1);

      // Clear the warned set
      monitor.clearWarned();

      vi.advanceTimersByTime(1000);
      expect(warnings).toHaveLength(2);
    });
  });
});
