/**
 * Token Registry - Active token tracking with expiry cleanup.
 *
 * Tracks registered capability tokens and provides:
 * - Token validation (exists + not expired)
 * - Automatic expiry cleanup
 * - Near-expiry queries for warning generation
 * - Session-based token revocation
 * - Integration with revocation cache for persistence
 */

import type { RevocationCache } from './revocation-cache.js';
import type { RevocationStore } from './revocation-store.js';

/** Token entry stored in the registry. */
export interface TokenEntry {
  /** Unique token ID (jti claim). */
  jti: string;
  /** Associated session ID. */
  sessionId: string;
  /** Operator DID (subject). */
  operatorDid: string;
  /** Target robot ID. */
  robotId: string;
  /** When the token expires. */
  expiresAt: Date;
}

/** Token registry interface. */
export interface TokenRegistry {
  /** Register a new token. */
  register(entry: TokenEntry): void;
  /** Revoke a token by jti. Returns true if found and removed. */
  revoke(jti: string, reason?: string): boolean;
  /** Check if a token is valid (exists and not expired). */
  isValid(jti: string): boolean;
  /** Get token entry by jti. */
  get(jti: string): TokenEntry | undefined;
  /** Get tokens expiring within threshold (in ms). */
  getExpiringSoon(thresholdMs: number): TokenEntry[];
  /** Remove expired tokens. Returns count removed. */
  cleanup(): number;
  /** Start automatic cleanup on interval. */
  startCleanup(intervalMs: number): void;
  /** Stop automatic cleanup. */
  stopCleanup(): void;
  /** Get all tokens for a session. */
  getBySession(sessionId: string): TokenEntry[];
  /** Revoke all tokens for a session. Returns count revoked. */
  revokeBySession(sessionId: string, reason?: string): number;
  /** Get all tokens for an operator. */
  getByOperator(operatorDid: string): TokenEntry[];
  /** Revoke all tokens for an operator. Returns session IDs of revoked tokens. */
  revokeByOperator(operatorDid: string, reason?: string): string[];
  /** Get number of registered tokens. */
  size(): number;
  /** Set the revocation cache for tracking revoked tokens. */
  setRevocationCache(cache: RevocationCache): void;
  /** Set the revocation store for persistence. */
  setRevocationStore(store: RevocationStore): void;
  /** Get revocation cache metrics. */
  getRevocationMetrics(): { hits: number; misses: number; size: number; hitRate: number } | null;
}

/**
 * Create a new token registry instance.
 */
export function createTokenRegistry(): TokenRegistry {
  const tokens = new Map<string, TokenEntry>();
  let cleanupInterval: ReturnType<typeof setInterval> | null = null;
  let revocationCache: RevocationCache | null = null;
  let revocationStore: RevocationStore | null = null;

  function isExpired(entry: TokenEntry): boolean {
    return entry.expiresAt.getTime() <= Date.now();
  }

  /** Add entry to revocation cache and persist. */
  function addToRevocationCache(jti: string, expiresAt: Date, reason?: string): void {
    if (!revocationCache) return;
    revocationCache.add(jti, expiresAt, reason);
    if (revocationStore) {
      revocationStore.append({ jti, revokedAt: new Date(), expiresAt, reason }).catch((err) => {
        console.error('[TOKEN_REGISTRY] Failed to persist revocation:', err);
      });
    }
  }

  return {
    register(entry: TokenEntry): void {
      tokens.set(entry.jti, entry);
    },

    revoke(jti: string, reason?: string): boolean {
      const entry = tokens.get(jti);
      if (!entry) return false;
      addToRevocationCache(jti, entry.expiresAt, reason);
      tokens.delete(jti);
      return true;
    },

    isValid(jti: string): boolean {
      // Check revocation cache first (catches revoked tokens after restart)
      if (revocationCache?.isRevoked(jti)) {
        return false;
      }

      const entry = tokens.get(jti);
      if (!entry) return false;
      return !isExpired(entry);
    },

    get(jti: string): TokenEntry | undefined {
      return tokens.get(jti);
    },

    getExpiringSoon(thresholdMs: number): TokenEntry[] {
      const now = Date.now();
      const threshold = now + thresholdMs;

      return [...tokens.values()].filter((entry) => {
        const expiresAtMs = entry.expiresAt.getTime();
        return expiresAtMs > now && expiresAtMs <= threshold;
      });
    },

    cleanup(): number {
      let removed = 0;
      for (const [jti, entry] of tokens.entries()) {
        if (isExpired(entry)) {
          tokens.delete(jti);
          removed++;
        }
      }
      // Also cleanup revocation cache
      revocationCache?.cleanup();
      return removed;
    },

    startCleanup(intervalMs: number): void {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
      }
      cleanupInterval = setInterval(() => {
        this.cleanup();
      }, intervalMs);
    },

    stopCleanup(): void {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    },

    getBySession(sessionId: string): TokenEntry[] {
      return [...tokens.values()].filter((entry) => entry.sessionId === sessionId);
    },

    revokeBySession(sessionId: string, reason?: string): number {
      const sessionTokens = this.getBySession(sessionId);
      for (const entry of sessionTokens) {
        addToRevocationCache(entry.jti, entry.expiresAt, reason);
        tokens.delete(entry.jti);
      }
      return sessionTokens.length;
    },

    getByOperator(operatorDid: string): TokenEntry[] {
      return [...tokens.values()].filter((entry) => entry.operatorDid === operatorDid);
    },

    revokeByOperator(operatorDid: string, reason?: string): string[] {
      const operatorTokens = this.getByOperator(operatorDid);
      const sessionIds = [...new Set(operatorTokens.map((entry) => entry.sessionId))];
      for (const entry of operatorTokens) {
        addToRevocationCache(entry.jti, entry.expiresAt, reason);
        tokens.delete(entry.jti);
      }
      return sessionIds;
    },

    size(): number {
      return tokens.size;
    },

    setRevocationCache(cache: RevocationCache): void {
      revocationCache = cache;
    },

    setRevocationStore(store: RevocationStore): void {
      revocationStore = store;
    },

    getRevocationMetrics(): { hits: number; misses: number; size: number; hitRate: number } | null {
      if (!revocationCache) return null;
      return revocationCache.getMetrics();
    },
  };
}
