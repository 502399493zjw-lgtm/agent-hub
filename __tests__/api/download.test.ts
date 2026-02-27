/**
 * API Route Tests — /api/assets/[id]/download
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

import { POST } from '../../src/app/api/assets/[id]/download/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API /api/assets/[id]/download', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  describe('POST — increment download', () => {
    it('should increment download count', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/download`, { method: 'POST' });
      const { status, data } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.downloads).toBe(1);
    });

    it('should increment multiple times', async () => {
      const assetId = seedAsset(testDb);
      await POST(createTestRequest(`/api/assets/${assetId}/download`, { method: 'POST' }), makeParams(assetId));
      await POST(createTestRequest(`/api/assets/${assetId}/download`, { method: 'POST' }), makeParams(assetId));
      const res = await POST(createTestRequest(`/api/assets/${assetId}/download`, { method: 'POST' }), makeParams(assetId));
      const { data } = await parseResponse(res);
      expect(data.data.downloads).toBe(3);
    });

    it('should return 404 for non-existent asset', async () => {
      const req = createTestRequest('/api/assets/nope/download', { method: 'POST' });
      const { status } = await parseResponse(await POST(req, makeParams('nope')));
      expect(status).toBe(404);
    });

    it('should auto-star when authenticated', async () => {
      const user = seedUser(testDb, { id: 'u-dlauth' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      const req = authRequest(`/api/assets/${assetId}/download`, key, { method: 'POST' });
      await POST(req, makeParams(assetId));

      expect(db.isStarred(user.id, assetId)).toBe(true);
    });

    it('should not duplicate auto-star on repeated downloads', async () => {
      const user = seedUser(testDb, { id: 'u-dldup' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      await POST(authRequest(`/api/assets/${assetId}/download`, key, { method: 'POST' }), makeParams(assetId));
      await POST(authRequest(`/api/assets/${assetId}/download`, key, { method: 'POST' }), makeParams(assetId));

      expect(db.getAssetUserStarCount(assetId)).toBe(1);
    });
  });
});
