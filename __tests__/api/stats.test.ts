/**
 * API Route Tests — /api/stats
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import * as db from '../../src/lib/db';
import { parseResponse } from '../helpers/api-helpers';

let testDb: Database.Database;
function freshDb() {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

import { GET } from '../../src/app/api/stats/route';

describe('API /api/stats', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  it('should return stats for empty database', async () => {
    const { status, data } = await parseResponse(await GET());
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalAssets).toBe(0);
    expect(data.data.totalDownloads).toBe(0);
    expect(data.data.totalComments).toBe(0);
    expect(data.data.totalIssues).toBe(0);
  });

  it('should return correct stats with data', async () => {
    db.createAsset({ name: 's1', displayName: 'S1', type: 'skill', description: 'd', version: '1.0.0' });
    db.createAsset({ name: 's2', displayName: 'S2', type: 'plugin', description: 'd', version: '1.0.0' });

    const { data } = await parseResponse(await GET());
    expect(data.data.totalAssets).toBe(2);
    expect(data.data.typeCounts).toEqual({ skill: 1, plugin: 1 });
  });
});
