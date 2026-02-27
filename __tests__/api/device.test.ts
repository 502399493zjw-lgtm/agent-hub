/**
 * API Route Tests — /api/auth/device
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser, seedDevice } from '../helpers/db-factory';
import * as db from '../../src/lib/db';
import { createTestRequest, parseResponse } from '../helpers/api-helpers';

// Mock auth to return session
vi.mock('../../src/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { auth } from '../../src/lib/auth';

let testDb: Database.Database;
function freshDb() {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

import { GET, POST, DELETE } from '../../src/app/api/auth/device/route';

function mockSession(userId: string) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: userId, email: 'test@test.com', name: 'Test' },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as any);
}

describe('API /api/auth/device', () => {
  beforeEach(() => {
    testDb = freshDb();
    vi.mocked(auth).mockResolvedValue(null);
  });

  describe('GET — list devices', () => {
    it('should require session', async () => {
      const { status } = await parseResponse(await GET());
      expect(status).toBe(401);
    });

    it('should list authorized devices', async () => {
      seedUser(testDb, { id: 'u-dl' });
      seedDevice(testDb, 'u-dl', 'dev-1', 'MacBook');
      seedDevice(testDb, 'u-dl', 'dev-2', 'iPhone');
      mockSession('u-dl');

      const { status, data } = await parseResponse(await GET());
      expect(status).toBe(200);
      expect(data.data.devices).toHaveLength(2);
    });
  });

  describe('POST — authorize device', () => {
    it('should require session', async () => {
      const req = createTestRequest('/api/auth/device', { method: 'POST', body: { deviceId: 'x' } });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(401);
    });

    it('should require invite code', async () => {
      seedUser(testDb, { id: 'u-noinv', inviteCode: null });
      mockSession('u-noinv');

      const req = createTestRequest('/api/auth/device', { method: 'POST', body: { deviceId: 'x' } });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(403);
    });

    it('should authorize a device', async () => {
      seedUser(testDb, { id: 'u-auth', inviteCode: 'SEAFOOD' });
      mockSession('u-auth');

      const req = createTestRequest('/api/auth/device', { method: 'POST', body: { deviceId: 'my-device', name: 'MacBook' } });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(201);
      expect(data.success).toBe(true);

      // Verify device works
      expect(db.validateDevice('my-device')).not.toBeNull();
    });

    it('should reject device already bound to another user', async () => {
      seedUser(testDb, { id: 'u-first', inviteCode: 'SEAFOOD' });
      seedUser(testDb, { id: 'u-second', inviteCode: 'SEAFOOD2' });
      seedDevice(testDb, 'u-first', 'dev-taken', 'MacBook');
      mockSession('u-second');

      const req = createTestRequest('/api/auth/device', { method: 'POST', body: { deviceId: 'dev-taken' } });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('已绑定');
    });

    it('should allow re-binding same user', async () => {
      seedUser(testDb, { id: 'u-same', inviteCode: 'SEAFOOD' });
      seedDevice(testDb, 'u-same', 'dev-mine', 'MacBook');
      mockSession('u-same');

      const req = createTestRequest('/api/auth/device', { method: 'POST', body: { deviceId: 'dev-mine', name: 'MacBook Pro' } });
      const { status, data } = await parseResponse(await POST(req));
      expect(status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('should require deviceId', async () => {
      seedUser(testDb, { id: 'u-nodv', inviteCode: 'SEAFOOD' });
      mockSession('u-nodv');

      const req = createTestRequest('/api/auth/device', { method: 'POST', body: {} });
      const { status } = await parseResponse(await POST(req));
      expect(status).toBe(400);
    });
  });

  describe('DELETE — permanently disabled', () => {
    it('should return 403 (device binding is permanent)', async () => {
      const { status, data } = await parseResponse(await DELETE());
      expect(status).toBe(403);
      expect(data.error).toContain('永久绑定');
    });
  });
});
