/**
 * API Route Tests — /api/assets/[id]/star
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser, seedApiKey, seedAsset } from '../helpers/db-factory';
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

import { GET, POST, DELETE } from '../../src/app/api/assets/[id]/star/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API /api/assets/[id]/star', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  describe('POST — star', () => {
    it('should require authentication', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/star`, { method: 'POST' });
      const { status } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(401);
    });

    it('should star an asset', async () => {
      const user = seedUser(testDb, { id: 'u-star' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb, { githubStars: 10 });

      const req = authRequest(`/api/assets/${assetId}/star`, key, { method: 'POST' });
      const { status, data } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.starred).toBe(true);
      expect(data.data.created).toBe(true);
      expect(data.data.totalStars).toBe(11); // 10 github + 1 user
    });

    it('should be idempotent (double star)', async () => {
      const user = seedUser(testDb, { id: 'u-idem' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      const req1 = authRequest(`/api/assets/${assetId}/star`, key, { method: 'POST' });
      await POST(req1, makeParams(assetId));

      const req2 = authRequest(`/api/assets/${assetId}/star`, key, { method: 'POST' });
      const { data } = await parseResponse(await POST(req2, makeParams(assetId)));
      expect(data.data.created).toBe(false);
      expect(data.data.totalStars).toBe(1);
    });

    it('should return 404 for non-existent asset', async () => {
      const user = seedUser(testDb, { id: 'u-404star' });
      const key = seedApiKey(testDb, user.id);
      const req = authRequest('/api/assets/nope/star', key, { method: 'POST' });
      const { status } = await parseResponse(await POST(req, makeParams('nope')));
      expect(status).toBe(404);
    });
  });

  describe('DELETE — unstar', () => {
    it('should require authentication', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/star`, { method: 'DELETE' });
      const { status } = await parseResponse(await DELETE(req, makeParams(assetId)));
      expect(status).toBe(401);
    });

    it('should unstar an asset', async () => {
      const user = seedUser(testDb, { id: 'u-unstar' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);
      db.starAsset(user.id, assetId);

      const req = authRequest(`/api/assets/${assetId}/star`, key, { method: 'DELETE' });
      const { status, data } = await parseResponse(await DELETE(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.starred).toBe(false);
      expect(data.data.deleted).toBe(true);
    });
  });

  describe('GET — star info', () => {
    it('should return star counts', async () => {
      const assetId = seedAsset(testDb, { githubStars: 42 });
      const u1 = seedUser(testDb, { id: 'u-g1', name: 'G1' });
      db.starAsset(u1.id, assetId);

      const req = createTestRequest(`/api/assets/${assetId}/star`);
      const { status, data } = await parseResponse(await GET(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.totalStars).toBe(43);
      expect(data.data.userStars).toBe(1);
      expect(data.data.githubStars).toBe(42);
      expect(data.data.isStarred).toBe(false); // no auth
    });

    it('should show isStarred=true for authenticated user', async () => {
      const user = seedUser(testDb, { id: 'u-gs' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);
      db.starAsset(user.id, assetId);

      const req = authRequest(`/api/assets/${assetId}/star`, key);
      const { data } = await parseResponse(await GET(req, makeParams(assetId)));
      expect(data.data.isStarred).toBe(true);
    });

    it('should return 404 for non-existent asset', async () => {
      const req = createTestRequest('/api/assets/nope/star');
      const { status } = await parseResponse(await GET(req, makeParams('nope')));
      expect(status).toBe(404);
    });
  });
});
