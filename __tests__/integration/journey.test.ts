/**
 * Integration Tests — full user journeys across multiple API endpoints.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
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

import { POST as register } from '../../src/app/api/auth/register/route';
import { GET as listAssets, POST as createAssetRoute } from '../../src/app/api/assets/route';
import { GET as getAsset } from '../../src/app/api/assets/[id]/route';
import { POST as starAsset } from '../../src/app/api/assets/[id]/star/route';
import { POST as downloadAsset } from '../../src/app/api/assets/[id]/download/route';
import { POST as createCommentRoute } from '../../src/app/api/assets/[id]/comments/route';
import { GET as getCoins } from '../../src/app/api/users/[id]/coins/route';
import { GET as getStats } from '../../src/app/api/stats/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Integration: Complete Agent Journey', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  it('register → publish → download → star → comment → check coins', async () => {
    // Step 1: Register a new agent
    const regReq = createTestRequest('/api/auth/register', {
      method: 'POST',
      body: { invite_code: 'SEAFOOD', name: 'TestAgent', type: 'agent' },
    });
    const { data: regData } = await parseResponse(await register(regReq));
    expect(regData.success).toBe(true);
    const apiKey = regData.api_key;
    const userId = regData.user_id;

    // Step 2: Verify coins after registration
    const coinsReq1 = createTestRequest(`/api/users/${userId}/coins`);
    const { data: coins1 } = await parseResponse(await getCoins(coinsReq1, makeParams(userId)));
    expect(coins1.data.shrimpCoins).toBe(100); // welcome bonus

    // Step 3: Publish a new asset (include authorId for coin rewards)
    const pubReq = authRequest('/api/assets', apiKey, {
      method: 'POST',
      body: {
        name: 'my-weather-skill', displayName: 'Weather Skill',
        type: 'skill', description: 'Get weather data',
        version: '1.0.0', category: 'productivity',
        tags: ['weather', 'api'],
        authorId: userId, authorName: 'TestAgent',
      },
    });
    const { status: pubStatus, data: pubData } = await parseResponse(await createAssetRoute(pubReq));
    expect(pubStatus).toBe(201);
    const assetId = pubData.data.id;

    // Step 4: Verify coins increased after publishing
    const { data: coins2 } = await parseResponse(await getCoins(
      createTestRequest(`/api/users/${userId}/coins`), makeParams(userId)
    ));
    expect(coins2.data.reputation).toBeGreaterThan(0);
    expect(coins2.data.shrimpCoins).toBeGreaterThan(100);

    // Step 5: Register a second agent to download the asset
    const reg2 = await parseResponse(await register(
      createTestRequest('/api/auth/register', {
        method: 'POST', body: { invite_code: 'SEAFOOD', name: 'Downloader', type: 'agent' },
      })
    ));
    const key2 = reg2.data.api_key;
    const userId2 = reg2.data.user_id;

    // Step 6: Download the asset (should auto-star)
    const dlReq = authRequest(`/api/assets/${assetId}/download`, key2, { method: 'POST' });
    const { data: dlData } = await parseResponse(await downloadAsset(dlReq, makeParams(assetId)));
    expect(dlData.data.downloads).toBe(1);

    // Step 7: Verify auto-star happened
    expect(db.isStarred(userId2, assetId)).toBe(true);

    // Step 8: Star the asset manually (should be idempotent)
    const starReq = authRequest(`/api/assets/${assetId}/star`, key2, { method: 'POST' });
    const { data: starData } = await parseResponse(await starAsset(starReq, makeParams(assetId)));
    expect(starData.data.starred).toBe(true);
    expect(starData.data.created).toBe(false); // already starred via download

    // Step 9: Comment on the asset
    const cmtReq = authRequest(`/api/assets/${assetId}/comments`, key2, {
      method: 'POST', body: { content: 'Great weather skill! Works perfectly.', rating: 5 },
    });
    const { status: cmtStatus } = await parseResponse(await createCommentRoute(cmtReq, makeParams(assetId)));
    expect(cmtStatus).toBe(201);

    // Step 10: Verify asset details show comment
    const assetReq = createTestRequest(`/api/assets/${assetId}`);
    const { data: assetDetail } = await parseResponse(await getAsset(assetReq, makeParams(assetId)));
    expect(assetDetail.data.comments).toHaveLength(1);
    expect(assetDetail.data.asset.downloads).toBe(1);

    // Step 11: Check author's coins increased from download
    const { data: coins3 } = await parseResponse(await getCoins(
      createTestRequest(`/api/users/${userId}/coins`), makeParams(userId)
    ));
    expect(coins3.data.reputation).toBeGreaterThan(coins2.data.reputation);

    // Step 12: Check stats reflect the activity
    const { data: statsData } = await parseResponse(await getStats());
    expect(statsData.data.totalAssets).toBeGreaterThanOrEqual(1);
    expect(statsData.data.totalDownloads).toBeGreaterThanOrEqual(1);
    expect(statsData.data.totalComments).toBeGreaterThanOrEqual(1);
  });

  it('register → list assets → filter and search', async () => {
    // Register
    const { data: reg } = await parseResponse(await register(
      createTestRequest('/api/auth/register', {
        method: 'POST', body: { invite_code: 'SEAFOOD', name: 'Publisher2' },
      })
    ));

    // Publish multiple assets
    for (const [name, type, category] of [
      ['weather-skill', 'skill', 'productivity'],
      ['discord-channel', 'channel', 'communication'],
      ['theme-dark', 'config', 'appearance'],
    ] as const) {
      await createAssetRoute(authRequest('/api/assets', reg.api_key, {
        method: 'POST',
        body: { name, displayName: name, type, description: `A ${type}`, version: '1.0.0', category },
      }));
    }

    // List all
    const { data: all } = await parseResponse(await listAssets(
      createTestRequest('/api/assets')
    ));
    expect(all.data.total).toBe(3);

    // Filter by type
    const { data: skills } = await parseResponse(await listAssets(
      createTestRequest('/api/assets', { searchParams: { type: 'skill' } })
    ));
    expect(skills.data.total).toBe(1);

    // Search
    const { data: search } = await parseResponse(await listAssets(
      createTestRequest('/api/assets', { searchParams: { q: 'weather' } })
    ));
    expect(search.data.total).toBe(1);
    expect(search.data.assets[0].name).toBe('weather-skill');
  });

  it('GitHub import → stars sync → manual star → totalStars correct', async () => {
    // Register
    const { data: reg } = await parseResponse(await register(
      createTestRequest('/api/auth/register', {
        method: 'POST', body: { invite_code: 'SEAFOOD', name: 'GHImporter' },
      })
    ));

    // Publish asset with GitHub stars
    const { data: pub } = await parseResponse(await createAssetRoute(authRequest('/api/assets', reg.api_key, {
      method: 'POST',
      body: {
        name: 'gh-imported', displayName: 'GH Imported', type: 'skill',
        description: 'From GitHub', version: '1.0.0',
        githubUrl: 'https://github.com/test/repo', githubStars: 500,
      },
    })));

    const assetId = pub.data.id;

    // Register a second user to star
    const { data: reg2 } = await parseResponse(await register(
      createTestRequest('/api/auth/register', {
        method: 'POST', body: { invite_code: 'SEAFOOD', name: 'StarFan' },
      })
    ));

    // Manual star
    const { data: starResult } = await parseResponse(await starAsset(
      authRequest(`/api/assets/${assetId}/star`, reg2.api_key, { method: 'POST' }),
      makeParams(assetId)
    ));

    // totalStars = 500 github + 1 manual
    expect(starResult.data.totalStars).toBe(501);
  });
});
