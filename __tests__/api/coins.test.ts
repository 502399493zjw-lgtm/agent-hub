/**
 * API Route Tests — /api/users/[id]/coins
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser } from '../helpers/db-factory';
import * as db from '../../src/lib/db';
import { createTestRequest, parseResponse } from '../helpers/api-helpers';

let testDb: Database.Database;
function freshDb() {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

import { GET } from '../../src/app/api/users/[id]/coins/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('API /api/users/[id]/coins', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  it('should return user coins', async () => {
    seedUser(testDb, { id: 'u-c', shrimpCoins: 200, reputation: 50 });
    const req = createTestRequest('/api/users/u-c/coins');
    const { status, data } = await parseResponse(await GET(req, makeParams('u-c')));
    expect(status).toBe(200);
    expect(data.data.reputation).toBe(50);
    expect(data.data.shrimpCoins).toBe(200);
  });

  it('should include history when requested', async () => {
    seedUser(testDb, { id: 'u-h' });
    db.addCoins('u-h', 'reputation', 10, 'ev1', 'r1');
    db.addCoins('u-h', 'shrimp_coin', 5, 'ev2', 'r2');

    const req = createTestRequest('/api/users/u-h/coins', { searchParams: { history: 'true' } });
    const { data } = await parseResponse(await GET(req, makeParams('u-h')));
    expect(data.data.history).toHaveLength(2);
  });

  it('should filter history by coin type', async () => {
    seedUser(testDb, { id: 'u-ft' });
    db.addCoins('u-ft', 'reputation', 10, 'ev1', 'r1');
    db.addCoins('u-ft', 'shrimp_coin', 5, 'ev2', 'r2');

    const req = createTestRequest('/api/users/u-ft/coins', { searchParams: { history: 'true', type: 'reputation' } });
    const { data } = await parseResponse(await GET(req, makeParams('u-ft')));
    expect(data.data.history).toHaveLength(1);
    expect(data.data.history[0].event).toBe('ev1');
  });

  it('should respect limit parameter', async () => {
    seedUser(testDb, { id: 'u-lim' });
    for (let i = 0; i < 10; i++) {
      db.addCoins('u-lim', 'reputation', 1, `ev${i}`, `r${i}`);
    }

    const req = createTestRequest('/api/users/u-lim/coins', { searchParams: { history: 'true', limit: '3' } });
    const { data } = await parseResponse(await GET(req, makeParams('u-lim')));
    expect(data.data.history).toHaveLength(3);
  });

  it('should return defaults for non-existent user', async () => {
    const req = createTestRequest('/api/users/nope/coins');
    const { status, data } = await parseResponse(await GET(req, makeParams('nope')));
    expect(status).toBe(200);
    expect(data.data.reputation).toBe(0);
    // getUserCoins defaults to shrimp_coins=100 for missing users
    expect(data.data.shrimpCoins).toBe(100);
  });
});
