/**
 * API Route Tests — /api/assets/[id]/comments
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

import { GET, POST } from '../../src/app/api/assets/[id]/comments/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API /api/assets/[id]/comments', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  describe('GET', () => {
    it('should return empty array for no comments', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/comments`);
      const { status, data } = await parseResponse(await GET(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data).toEqual([]);
    });

    it('should return comments for asset', async () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb, { id: 'u-c' });
      db.createComment({ assetId, userId: user.id, userName: 'C', userAvatar: '', content: 'Hello', rating: 5, commenterType: 'user' });

      const req = createTestRequest(`/api/assets/${assetId}/comments`);
      const { data } = await parseResponse(await GET(req, makeParams(assetId)));
      expect(data.data).toHaveLength(1);
      expect(data.data[0].content).toBe('Hello');
    });
  });

  describe('POST', () => {
    it('should require authentication', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}/comments`, {
        method: 'POST', body: { content: 'Hello' },
      });
      const { status } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(401);
    });

    it('should require invite access', async () => {
      const user = seedUser(testDb, { id: 'u-noinv', inviteCode: null });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      const req = authRequest(`/api/assets/${assetId}/comments`, key, {
        method: 'POST', body: { content: 'Hello' },
      });
      const { status } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(403);
    });

    it('should create a comment with valid auth', async () => {
      const user = seedUser(testDb, { id: 'u-cmt', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      const req = authRequest(`/api/assets/${assetId}/comments`, key, {
        method: 'POST', body: { content: 'Great skill!', rating: 5 },
      });
      const { status, data } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(201);
      expect(data.data.content).toBe('Great skill!');
    });

    it('should reject empty content', async () => {
      const user = seedUser(testDb, { id: 'u-ec', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);

      const req = authRequest(`/api/assets/${assetId}/comments`, key, {
        method: 'POST', body: { content: '' },
      });
      const { status } = await parseResponse(await POST(req, makeParams(assetId)));
      expect(status).toBe(400);
    });

    it('should return 404 for non-existent asset', async () => {
      const user = seedUser(testDb, { id: 'u-c404', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets/nope/comments', key, {
        method: 'POST', body: { content: 'Hello' },
      });
      const { status } = await parseResponse(await POST(req, makeParams('nope')));
      expect(status).toBe(404);
    });
  });
});
