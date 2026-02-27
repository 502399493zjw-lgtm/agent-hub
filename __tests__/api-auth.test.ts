/**
 * API Auth middleware tests — tests the authenticateRequest function
 * from src/lib/api-auth.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser, seedApiKey, seedDevice } from './helpers/db-factory';
import * as db from '../src/lib/db';

let testDb: Database.Database;

function freshDb(): Database.Database {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

// Mock NextAuth's auth() function
vi.mock('../src/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import { authenticateRequest } from '../src/lib/api-auth';
import { auth } from '../src/lib/auth';

function makeRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers();
  for (const [k, v] of Object.entries(headers)) h.set(k, v);
  return new Request('http://localhost/api/test', { headers: h });
}

describe('API Auth Middleware', () => {
  beforeEach(() => {
    testDb = freshDb();
    vi.mocked(auth).mockResolvedValue(null);
  });

  it('should return null for request with no auth', async () => {
    const result = await authenticateRequest(makeRequest() as any);
    expect(result).toBeNull();
  });

  it('should authenticate with valid API key (Bearer token)', async () => {
    const user = seedUser(testDb, { id: 'u-bearer' });
    const key = seedApiKey(testDb, user.id);

    const result = await authenticateRequest(
      makeRequest({ Authorization: `Bearer ${key}` }) as any
    );
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(user.id);
    expect(result!.method).toBe('api_key');
  });

  it('should reject invalid Bearer token', async () => {
    const result = await authenticateRequest(
      makeRequest({ Authorization: 'Bearer sk-invalid-key' }) as any
    );
    expect(result).toBeNull();
  });

  it('should reject revoked API key', async () => {
    const user = seedUser(testDb, { id: 'u-revoked' });
    const key = seedApiKey(testDb, user.id, { revoked: true });

    const result = await authenticateRequest(
      makeRequest({ Authorization: `Bearer ${key}` }) as any
    );
    expect(result).toBeNull();
  });

  it('should authenticate with valid Device ID', async () => {
    const user = seedUser(testDb, { id: 'u-device' });
    seedDevice(testDb, user.id, 'my-device-123');

    const result = await authenticateRequest(
      makeRequest({ 'x-device-id': 'my-device-123' }) as any
    );
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(user.id);
    expect(result!.method).toBe('device');
  });

  it('should reject unauthorized Device ID', async () => {
    const result = await authenticateRequest(
      makeRequest({ 'x-device-id': 'unknown-device' }) as any
    );
    expect(result).toBeNull();
  });

  it('should authenticate with valid session (mock NextAuth)', async () => {
    seedUser(testDb, { id: 'u-session', email: 'session@test.com' });

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u-session', email: 'session@test.com', name: 'Session' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as any);

    const result = await authenticateRequest(makeRequest() as any);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('u-session');
    expect(result!.method).toBe('session');
  });

  it('session has highest priority (session > device > api_key)', async () => {
    const user = seedUser(testDb, { id: 'u-session-prio', email: 'prio@test.com' });
    seedDevice(testDb, user.id, 'dev-prio');
    const key = seedApiKey(testDb, user.id);

    vi.mocked(auth).mockResolvedValue({
      user: { id: 'u-session-prio', email: 'prio@test.com', name: 'Prio' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as any);

    const result = await authenticateRequest(
      makeRequest({
        Authorization: `Bearer ${key}`,
        'x-device-id': 'dev-prio',
      }) as any
    );
    expect(result!.method).toBe('session');
  });

  it('device_id has priority over api_key when no session', async () => {
    const devUser = seedUser(testDb, { id: 'u-dev-user' });
    seedDevice(testDb, devUser.id, 'dev-x');
    const apiUser = seedUser(testDb, { id: 'u-api-user', name: 'APIUser' });
    const key = seedApiKey(testDb, apiUser.id);

    const result = await authenticateRequest(
      makeRequest({
        Authorization: `Bearer ${key}`,
        'x-device-id': 'dev-x',
      }) as any
    );
    expect(result!.method).toBe('device');
    expect(result!.userId).toBe(devUser.id);
  });
});
