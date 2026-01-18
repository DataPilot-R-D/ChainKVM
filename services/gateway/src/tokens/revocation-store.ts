/**
 * File-based persistence store for revocation cache.
 * Stores revoked entries as JSON for recovery after gateway restart.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { RevokedEntry } from './revocation-cache.js';

export interface RevocationStore {
  load(): Promise<RevokedEntry[]>;
  save(entries: RevokedEntry[]): Promise<void>;
  append(entry: RevokedEntry): Promise<void>;
}

interface StoredEntry {
  jti: string;
  revokedAt: string;
  expiresAt: string;
  reason?: string;
}

/** Parse stored entry back to RevokedEntry. */
function parseEntry(stored: StoredEntry): RevokedEntry {
  return {
    jti: stored.jti,
    revokedAt: new Date(stored.revokedAt),
    expiresAt: new Date(stored.expiresAt),
    reason: stored.reason,
  };
}

/** Convert RevokedEntry to storable format. */
function serializeEntry(entry: RevokedEntry): StoredEntry {
  return {
    jti: entry.jti,
    revokedAt: entry.revokedAt.toISOString(),
    expiresAt: entry.expiresAt.toISOString(),
    reason: entry.reason,
  };
}

/** Ensure directory exists for the store file. */
async function ensureDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

/** Create a file-based revocation store. */
export function createRevocationStore(filePath: string): RevocationStore {
  return {
    async load(): Promise<RevokedEntry[]> {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        const stored: StoredEntry[] = JSON.parse(data);
        return stored.map(parseEntry);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }
        console.warn('[REVOCATION_STORE] Failed to load revocations:', err);
        return [];
      }
    },

    async save(entries: RevokedEntry[]): Promise<void> {
      try {
        await ensureDir(filePath);
        const stored = entries.map(serializeEntry);
        await fs.writeFile(filePath, JSON.stringify(stored, null, 2), 'utf-8');
      } catch (err) {
        console.error('[REVOCATION_STORE] Failed to save revocations:', err);
      }
    },

    async append(entry: RevokedEntry): Promise<void> {
      try {
        const existing = await this.load();
        existing.push(entry);
        await this.save(existing);
      } catch (err) {
        console.error('[REVOCATION_STORE] Failed to append revocation:', err);
      }
    },
  };
}
