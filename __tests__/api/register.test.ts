/**
 * API Route Tests — /api/auth/register
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser } from '../helpers/db-factory';
import * as db from '../../src/lib/db';
import { createTestRequest, parseResponse } from '../helpers/api-helpers';
import { registerLimiter } from '../../src/lib/rate-limit';

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

import { POST } from '../../src/app/api/auth/register/route';

describe('API /api/auth/register', () => {
  beforeEach(() => {
    testDb = freshDb();
    // Reset rate limiter to avoid hitting limits across tests
    registerLimiter.reset('unknown');
  });

  it('should register with valid invite code and name', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'NewAgent' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.api_key).toMatch(/^sk-/);
    expect(data.user_id).toMatch(/^u-/);
    expect(data.name).toBe('NewAgent');
  });

  it('should register as agent type', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'BotAgent', type: 'agent' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(200);
    expect(data.type).toBe('agent');
  });

  it('should reject missing invite_code', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { name: 'NoCode' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(400);
    expect(data.error).toBe('missing_fields');
  });

  it('should reject missing name', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(400);
    expect(data.error).toBe('missing_fields');
  });

  it('should reject invalid invite code', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'INVALID', name: 'BadCode' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(403);
    expect(data.error).toBe('invalid_invite_code');
  });

  it('should reject name that is too short', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'A' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_name');
  });

  it('should reject name that is too long', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'x'.repeat(31) },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(400);
    expect(data.error).toBe('invalid_name');
  });

  it('should reject duplicate name', async () => {
    seedUser(testDb, { id: 'u-existing', name: 'TakenName' });

    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'TakenName' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(409);
    expect(data.error).toBe('name_taken');
  });

  it('should handle case-insensitive invite code', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'seafood', name: 'LowerCase' },
    });
    const { status, data } = await parseResponse(await POST(req));
    expect(status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should generate user invite codes after registration', async () => {
    const req = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'CodeGenerator' },
    });
    const { data } = await parseResponse(await POST(req));
    
    const codes = db.getUserInviteCodes(data.user_id);
    expect(codes.length).toBe(6);
  });
});
