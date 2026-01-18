/**
 * Token Registry - Active token tracking with expiry cleanup.
 *
 * Tracks registered capability tokens and provides:
 * - Token validation (exists + not expired)
 * - Automatic expiry cleanup
 * - Near-expiry queries for warning generation
 * - Session-based token revocation
 */

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
  revoke(jti: string): boolean;
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
  revokeBySession(sessionId: string): number;
  /** Get number of registered tokens. */
  size(): number;
}

/**
 * Create a new token registry instance.
 */
export function createTokenRegistry(): TokenRegistry {
  const tokens = new Map<string, TokenEntry>();
  let cleanupInterval: ReturnType<typeof setInterval> | null = null;

  function isExpired(entry: TokenEntry): boolean {
    return entry.expiresAt.getTime() <= Date.now();
  }

  return {
    register(entry: TokenEntry): void {
      tokens.set(entry.jti, entry);
    },

    revoke(jti: string): boolean {
      return tokens.delete(jti);
    },

    isValid(jti: string): boolean {
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
      const result: TokenEntry[] = [];

      for (const entry of tokens.values()) {
        const expiresAtMs = entry.expiresAt.getTime();
        // Not yet expired, but will expire within threshold
        if (expiresAtMs > now && expiresAtMs <= threshold) {
          result.push(entry);
        }
      }

      return result;
    },

    cleanup(): number {
      let removed = 0;
      for (const [jti, entry] of tokens.entries()) {
        if (isExpired(entry)) {
          tokens.delete(jti);
          removed++;
        }
      }
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
      const result: TokenEntry[] = [];
      for (const entry of tokens.values()) {
        if (entry.sessionId === sessionId) {
          result.push(entry);
        }
      }
      return result;
    },

    revokeBySession(sessionId: string): number {
      let count = 0;
      for (const [jti, entry] of tokens.entries()) {
        if (entry.sessionId === sessionId) {
          tokens.delete(jti);
          count++;
        }
      }
      return count;
    },

    size(): number {
      return tokens.size;
    },
  };
}
