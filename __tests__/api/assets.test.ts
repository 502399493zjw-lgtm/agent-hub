/**
 * API Route Tests — /api/assets and /api/assets/[id]
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser, seedApiKey, seedAsset } from '../helpers/db-factory';
import * as db from '../../src/lib/db';
import { createTestRequest, authRequest, parseResponse } from '../helpers/api-helpers';

// Mock NextAuth
vi.mock('../../src/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

let testDb: Database.Database;

function freshDb(): Database.Database {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

// Import route handlers after mocking
import { GET, POST } from '../../src/app/api/assets/route';
import {
  GET as GET_BY_ID,
  PUT as PUT_BY_ID,
  DELETE as DELETE_BY_ID,
} from '../../src/app/api/assets/[id]/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API /api/assets', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  // ═══════════════ GET /api/assets ═══════════════
  describe('GET /api/assets', () => {
    it('should return empty list', async () => {
      const req = createTestRequest('/api/assets');
      const { status, data } = await parseResponse(await GET(req));
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.assets).toHaveLength(0);
    });

    it('should list assets with pagination', async () => {
      for (let i = 0; i < 5; i++) {
        db.createAsset({ name: `a-${i}`, displayName: `A${i}`, type: 'skill', description: 'd', version: '1.0.0' });
      }

      const req = createTestRequest('/api/assets', { searchParams: { page: '1', pageSize: '2' } });
      const { data } = await parseResponse(await GET(req));
      expect(data.data.assets).toHaveLength(2);
      expect(data.data.total).toBe(5);
    });

    it('should filter by type', async () => {
      db.createAsset({ name: 's', displayName: 'S', type: 'skill', description: 'd', version: '1.0.0' });
      db.createAsset({ name: 'p', displayName: 'P', type: 'plugin', description: 'd', version: '1.0.0' });

      const req = createTestRequest('/api/assets', { searchParams: { type: 'skill' } });
      const { data } = await parseResponse(await GET(req));
      expect(data.data.assets).toHaveLength(1);
      expect(data.data.assets[0].type).toBe('skill');
    });

    it('should search by query', async () => {
      db.createAsset({ name: 'weather', displayName: 'Weather', type: 'skill', description: 'Get weather', version: '1.0.0' });
      db.createAsset({ name: 'trans', displayName: 'Trans', type: 'skill', description: 'Translate', version: '1.0.0' });

      const req = createTestRequest('/api/assets', { searchParams: { q: 'weather' } });
      const { data } = await parseResponse(await GET(req));
      expect(data.data.assets).toHaveLength(1);
    });
  });

  // ═══════════════ POST /api/assets ═══════════════
  describe('POST /api/assets', () => {
    it('should require authentication', async () => {
      const req = createTestRequest('/api/assets', {
        method: 'POST',
        body: { name: 'x', displayName: 'X', type: 'skill', description: 'd', version: '1.0.0' },
      });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(401);
    });

    it('should require invite code activation', async () => {
      const user = seedUser(testDb, { id: 'u-noinvite', inviteCode: null });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets', key, {
        method: 'POST',
        body: { name: 'x', displayName: 'X', type: 'skill', description: 'd', version: '1.0.0' },
      });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(403);
      expect(data.error).toBe('invite_required');
    });

    it('should create an asset with valid auth and invite code', async () => {
      const user = seedUser(testDb, { id: 'u-pub', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets', key, {
        method: 'POST',
        body: { name: 'new-skill', displayName: 'New Skill', type: 'skill', description: 'Brand new', version: '1.0.0' },
      });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe('new-skill');
      expect(data.data.id).toMatch(/^s-/);
    });

    it('should reject missing required fields', async () => {
      const user = seedUser(testDb, { id: 'u-miss', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets', key, {
        method: 'POST',
        body: { name: 'incomplete' },
      });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(400);
    });

    it('should reject invalid type', async () => {
      const user = seedUser(testDb, { id: 'u-inv', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets', key, {
        method: 'POST',
        body: { name: 'bad', displayName: 'Bad', type: 'invalid_type', description: 'd', version: '1.0.0' },
      });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(400);
    });
  });
});

describe('API /api/assets/[id]', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  describe('GET /api/assets/[id]', () => {
    it('should return asset with comments and issues', async () => {
      const assetId = seedAsset(testDb, { id: 's-test1', name: 'test-asset' });
      const req = createTestRequest(`/api/assets/${assetId}`);
      const { status, data } = await parseResponse(await GET_BY_ID(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.asset.name).toBe('test-asset');
      expect(data.data.comments).toEqual([]);
      expect(data.data.issues).toEqual([]);
    });

    it('should return 404 for non-existent asset', async () => {
      const req = createTestRequest('/api/assets/nope');
      const { status } = await parseResponse(await GET_BY_ID(req, makeParams('nope')));
      expect(status).toBe(404);
    });

    it('should show isStarred=true when authenticated user has starred', async () => {
      const user = seedUser(testDb, { id: 'u-starred' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb);
      db.starAsset(user.id, assetId);

      const req = authRequest(`/api/assets/${assetId}`, key);
      const { data } = await parseResponse(await GET_BY_ID(req, makeParams(assetId)));
      expect(data.data.isStarred).toBe(true);
    });
  });

  describe('PUT /api/assets/[id]', () => {
    it('should require authentication', async () => {
      const assetId = seedAsset(testDb);
      const req = createTestRequest(`/api/assets/${assetId}`, {
        method: 'PUT', body: { description: 'Updated' },
      });
      const { status } = await parseResponse(await PUT_BY_ID(req, makeParams(assetId)));
      expect(status).toBe(401);
    });

    it('should update asset with valid auth', async () => {
      const user = seedUser(testDb, { id: 'u-up', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb, { authorId: user.id });

      const req = authRequest(`/api/assets/${assetId}`, key, {
        method: 'PUT', body: { description: 'Updated!' },
      });
      const { status, data } = await parseResponse(await PUT_BY_ID(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.description).toBe('Updated!');
    });

    it('should return 404 for non-existent asset', async () => {
      const user = seedUser(testDb, { id: 'u-up2', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);

      const req = authRequest('/api/assets/nope', key, {
        method: 'PUT', body: { description: 'nope' },
      });
      const { status } = await parseResponse(await PUT_BY_ID(req, makeParams('nope')));
      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/assets/[id]', () => {
    it('should delete an asset', async () => {
      const user = seedUser(testDb, { id: 'u-del', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);
      const assetId = seedAsset(testDb, { authorId: user.id });
      const req = authRequest(`/api/assets/${assetId}`, key, { method: 'DELETE' });
      const { status, data } = await parseResponse(await DELETE_BY_ID(req, makeParams(assetId)));
      expect(status).toBe(200);
      expect(data.data.id).toBe(assetId);
      expect(db.getAssetById(assetId)).toBeNull();
    });

    it('should return 404 for non-existent asset', async () => {
      const user = seedUser(testDb, { id: 'u-del2', inviteCode: 'SEAFOOD' });
      const key = seedApiKey(testDb, user.id);
      const req = authRequest('/api/assets/nope', key, { method: 'DELETE' });
      const { status } = await parseResponse(await DELETE_BY_ID(req, makeParams('nope')));
      expect(status).toBe(404);
    });
  });
});
