/**
 * API Route Tests — /api/assets/[id]/issues
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

import { GET, POST } from '../../src/app/api/assets/[id]/issues/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API /api/assets/[id]/issues', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  describe('GET', () => {
    it('should return empty array', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/issues`);
      const { status, data } = await parseResponse(await GET(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it('should return issues for asset', async () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb, { id: 'u-iss' });
      db.createIssue({ assetId, authorId: user.id, authorName: 'Iss', authorAvatar: '', authorType: 'user', title: 'Bug', body: 'desc', labels: ['bug'] });

      const req = createTestRequest(`/api/assets/${assetId}/issues`);
      const { data } = await parseResponse(await GET(req, makeParams(assetId)));
      expect(data.data).toHaveLength(1);
    });
  });

  describe('POST', () => {
    it('should require authentication', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/issues`, {
        method: 'POST', body: { title: 'Bug', body: 'desc' },
      });
      const { status } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(401);
    });

    it('should create an issue with valid auth', async () => {
      const user = seedUser(testDb, { id: 'u-iss2', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      const req = authRequest(`/api/assets/${assetId}/issues`, key, {
        method: 'POST', body: { title: 'Bug report', body: 'Something broken', labels: ['bug'] },
      });
      const { status, data } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(201);
      expect(data.data.title).toBe('Bug report');
      expect(data.data.status).toBe('open');
    });

    it('should return 404 for non-existent asset', async () => {
      const user = seedUser(testDb, { id: 'u-i404', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets/nope/issues', key, {
        method: 'POST', body: { title: 'Bug', body: 'desc' },
      });
      const { status } = await parseResponse(await POST(req, makeParams('nope')));
      expect(status).toBe(404);
    });
  });
});
