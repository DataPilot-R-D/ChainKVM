/**
 * Expiry Monitor - Near-expiry warning generation.
 *
 * Periodically checks the token registry for tokens approaching
 * expiry and emits warnings via callback.
 */
import type { TokenRegistry } from './token-registry.js';

/** Warning emitted when a token is near expiry. */
export interface ExpiryWarning {
  /** Unique token ID. */
  jti: string;
  /** Associated session ID. */
  sessionId: string;
  /** When the token expires. */
  expiresAt: Date;
  /** Milliseconds remaining until expiry. */
  remainingMs: number;
}

/** Configuration options for the expiry monitor. */
export interface ExpiryMonitorOptions {
  /** Warn this many ms before token expiry (e.g., 60000 = 1 minute). */
  warningThresholdMs: number;
  /** How often to check for expiring tokens (ms). */
  checkIntervalMs: number;
}

/** Callback invoked when a token is near expiry. */
export type ExpiryCallback = (warning: ExpiryWarning) => void;

/** Expiry monitor interface. */
export interface ExpiryMonitor {
  /** Start monitoring. Throws if already running. */
  start(registry: TokenRegistry, onWarning: ExpiryCallback, options: ExpiryMonitorOptions): void;
  /** Stop monitoring. */
  stop(): void;
  /** Check if monitor is currently running. */
  isRunning(): boolean;
  /** Clear the set of already-warned tokens. */
  clearWarned(): void;
}

/**
 * Create a new expiry monitor instance.
 */
export function createExpiryMonitor(): ExpiryMonitor {
  const warnedTokens = new Set<string>();
  let checkInterval: ReturnType<typeof setInterval> | null = null;

  return {
    start(registry: TokenRegistry, onWarning: ExpiryCallback, options: ExpiryMonitorOptions): void {
      if (checkInterval) {
        throw new Error('Monitor is already running');
      }

      checkInterval = setInterval(() => {
        const expiring = registry.getExpiringSoon(options.warningThresholdMs);
        const now = Date.now();

        for (const entry of expiring) {
          if (!warnedTokens.has(entry.jti)) {
            warnedTokens.add(entry.jti);
            const warning: ExpiryWarning = {
              jti: entry.jti,
              sessionId: entry.sessionId,
              expiresAt: entry.expiresAt,
              remainingMs: entry.expiresAt.getTime() - now,
            };
            onWarning(warning);
          }
        }

        // Prune warned tokens no longer in registry to prevent memory leak
        for (const jti of warnedTokens) {
          if (!registry.get(jti)) {
            warnedTokens.delete(jti);
          }
        }
      }, options.checkIntervalMs);
    },

    stop(): void {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    },

    isRunning(): boolean {
      return checkInterval !== null;
    },

    clearWarned(): void {
      warnedTokens.clear();
    },
  };
}
