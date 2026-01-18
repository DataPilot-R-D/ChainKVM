/**
 * Tests for RevocationStore - file-based persistence.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createRevocationStore, type RevocationStore } from '../revocation-store.js';
import type { RevokedEntry } from '../revocation-cache.js';

describe('RevocationStore', () => {
  let store: RevocationStore;
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revocation-store-test-'));
    testFilePath = path.join(tempDir, 'revocations.json');
    store = createRevocationStore(testFilePath);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function makeEntry(jti: string): RevokedEntry {
    return {
      jti,
      revokedAt: new Date('2024-01-15T10:00:00Z'),
      expiresAt: new Date('2024-01-15T11:00:00Z'),
      reason: 'test revocation',
    };
  }

  describe('load', () => {
    it('should return empty array when file does not exist', async () => {
      const entries = await store.load();
      expect(entries).toEqual([]);
    });

    it('should load entries from file', async () => {
      const data = [
        { jti: 'jti_1', revokedAt: '2024-01-15T10:00:00.000Z', expiresAt: '2024-01-15T11:00:00.000Z', reason: 'r1' },
        { jti: 'jti_2', revokedAt: '2024-01-15T10:01:00.000Z', expiresAt: '2024-01-15T11:01:00.000Z' },
      ];
      await fs.writeFile(testFilePath, JSON.stringify(data));

      const entries = await store.load();
      expect(entries).toHaveLength(2);
      expect(entries[0].jti).toBe('jti_1');
      expect(entries[0].revokedAt).toBeInstanceOf(Date);
      expect(entries[0].expiresAt).toBeInstanceOf(Date);
      expect(entries[0].reason).toBe('r1');
      expect(entries[1].reason).toBeUndefined();
    });

    it('should throw error for corrupted file', async () => {
      await fs.writeFile(testFilePath, 'not json');
      await expect(store.load()).rejects.toThrow('Revocation store corrupted');
    });
  });

  describe('error handling', () => {
    it('should throw on save failure and not corrupt existing data', async () => {
      // Save initial data
      await store.save([makeEntry('jti_original')]);

      // Make file read-only to cause write failure
      await fs.chmod(testFilePath, 0o444);

      try {
        await expect(store.save([makeEntry('jti_new')])).rejects.toThrow('Failed to persist');
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(testFilePath, 0o644);
      }

      // Original data should remain intact
      const entries = await store.load();
      expect(entries[0].jti).toBe('jti_original');
    });

    it('should throw on append failure', async () => {
      await store.save([makeEntry('jti_1')]);
      await fs.chmod(testFilePath, 0o444);

      try {
        await expect(store.append(makeEntry('jti_2'))).rejects.toThrow('Failed to persist');
      } finally {
        await fs.chmod(testFilePath, 0o644);
      }
    });
  });

  describe('save', () => {
    it('should save entries to file', async () => {
      const entries: RevokedEntry[] = [makeEntry('jti_1'), makeEntry('jti_2')];

      await store.save(entries);

      const content = await fs.readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].jti).toBe('jti_1');
    });

    it('should create directory if it does not exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'revocations.json');
      const nestedStore = createRevocationStore(nestedPath);

      await nestedStore.save([makeEntry('jti_1')]);

      const content = await fs.readFile(nestedPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveLength(1);
    });

    it('should overwrite existing file', async () => {
      await store.save([makeEntry('jti_old')]);
      await store.save([makeEntry('jti_new')]);

      const entries = await store.load();
      expect(entries).toHaveLength(1);
      expect(entries[0].jti).toBe('jti_new');
    });
  });

  describe('append', () => {
    it('should append entry to existing file', async () => {
      await store.save([makeEntry('jti_1')]);
      await store.append(makeEntry('jti_2'));

      const entries = await store.load();
      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.jti)).toContain('jti_1');
      expect(entries.map(e => e.jti)).toContain('jti_2');
    });

    it('should create file if it does not exist', async () => {
      await store.append(makeEntry('jti_new'));

      const entries = await store.load();
      expect(entries).toHaveLength(1);
      expect(entries[0].jti).toBe('jti_new');
    });
  });

  describe('date serialization', () => {
    it('should correctly serialize and deserialize dates', async () => {
      const entry: RevokedEntry = {
        jti: 'jti_date_test',
        revokedAt: new Date('2024-06-15T14:30:00.000Z'),
        expiresAt: new Date('2024-06-15T15:30:00.000Z'),
        reason: 'date test',
      };

      await store.save([entry]);
      const loaded = await store.load();

      expect(loaded[0].revokedAt.getTime()).toBe(entry.revokedAt.getTime());
      expect(loaded[0].expiresAt.getTime()).toBe(entry.expiresAt.getTime());
    });
  });
});
