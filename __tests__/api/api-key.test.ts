/**
 * API Route Tests — /api/auth/api-key
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser, seedApiKey } from '../helpers/db-factory';
import * as db from '../../src/lib/db';
import { createTestRequest, authRequest, parseResponse } from '../helpers/api-helpers';

vi.mock('../../src/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

let testDb: Database.Database;
function freshDb() {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

import { GET, POST, DELETE } from '../../src/app/api/auth/api-key/route';

describe('API /api/auth/api-key', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  describe('POST — create new key', () => {
    it('should require authentication', async () => {
      const req = createTestRequest('/api/auth/api-key', { method: 'POST' });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(401);
    });

    it('should create a new API key', async () => {
      const user = seedUser(testDb, { id: 'u-k' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/auth/api-key', key, {
        method: 'POST',
        body: { name: 'new-key' },
      });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(200);
      expect(data.api_key).toMatch(/^sk-/);
    });

    it('should create key with default name when no name provided', async () => {
      const user = seedUser(testDb, { id: 'u-kd' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/auth/api-key', key, { method: 'POST' });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(200);
      expect(data.api_key).toMatch(/^sk-/);
    });
  });

  describe('GET — list keys', () => {
    it('should require authentication', async () => {
      const req = createTestRequest('/api/auth/api-key');
      const { status } = await parseResponse(await GET(req));
      expect(status).toBe(401);
    });

    it('should list masked keys', async () => {
      const user = seedUser(testDb, { id: 'u-kl' });
      const key = seedApiKey(testDb, user.id, { key: 'sk-test1234567890abcdef' });
      seedApiKey(testDb, user.id, { key: 'sk-second1234567890xyz' });

      const req = authRequest('/api/auth/api-key', key);
      const { status, data } = await parseResponse(await GET(req));
      expect(status).toBe(200);
      expect(data.keys).toHaveLength(2);
      // Keys should be masked — API returns key_prefix (first 10 chars + '...')
      expect(data.keys[0].key_prefix).toContain('...');
      expect(data.keys[0].key_prefix.length).toBeLessThan('sk-test1234567890abcdef'.length);
    });
  });

  describe('DELETE — revoke key', () => {
    it('should require authentication', async () => {
      const req = createTestRequest('/api/auth/api-key', {
        method: 'DELETE', body: { key: 'sk-xxx' },
      });
      const { status } = await parseResponse(await DELETE(req));
      expect(status).toBe(401);
    });

    it('should revoke a key', async () => {
      const user = seedUser(testDb, { id: 'u-kr' });
      const authKey = seedApiKey(testDb, user.id, { key: 'sk-auth-key-for-revoke' });
      const keyToRevoke = seedApiKey(testDb, user.id, { key: 'sk-to-revoke-key1234' });

      const req = authRequest('/api/auth/api-key', authKey, {
        method: 'DELETE', body: { key: keyToRevoke },
      });
      const { status, data } = await parseResponse(await DELETE(req));
      expect(status).toBe(200);
      expect(data.success).toBe(true);

      // Key should no longer work
      expect(db.findUserByApiKey(keyToRevoke)).toBeNull();
    });

    it('should reject invalid key format', async () => {
      const user = seedUser(testDb, { id: 'u-ki' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/auth/api-key', key, {
        method: 'DELETE', body: { key: 'not-an-api-key' },
      });
      const { status } = await parseResponse(await DELETE(req));
      expect(status).toBe(400);
    });

    it('should return 404 for non-existent key', async () => {
      const user = seedUser(testDb, { id: 'u-kn' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/auth/api-key', key, {
        method: 'DELETE', body: { key: 'sk-does-not-exist-1234' },
      });
      const { status } = await parseResponse(await DELETE(req));
      expect(status).toBe(404);
    });
  });
});
