/**
 * DB Layer Tests — direct SQLite operations via db.ts functions.
 *
 * Each test gets a fresh in-memory database via __setTestDb(), which calls
 * initTables() internally. This guarantees schema parity with production.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { seedUser, seedAsset, seedInviteCode } from './helpers/db-factory';
import * as db from '../src/lib/db';

let testDb: Database.Database;

function freshDb(): Database.Database {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d);
  return d;
}

describe('DB Layer', () => {
  beforeEach(() => {
    testDb = freshDb();
  });

  // ═══════════════ Asset CRUD ═══════════════
  describe('Asset CRUD', () => {
    it('should create an asset and retrieve it by id', () => {
      const asset = db.createAsset({ name: 'my-skill', displayName: 'My Skill', type: 'skill', description: 'A test skill', version: '1.0.0' });
      expect(asset.id).toMatch(/^s-/);
      expect(asset.name).toBe('my-skill');
      expect(asset.displayName).toBe('My Skill');
      expect(asset.downloads).toBe(0);
      const fetched = db.getAssetById(asset.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('my-skill');
    });

    it('should create assets with correct type prefixes', () => {
      const types: Record<string, string> = { skill: 's-', config: 'c-', plugin: 'p-', trigger: 'tr-', channel: 'ch-', template: 't-' };
      for (const [type, prefix] of Object.entries(types)) {
        const asset = db.createAsset({ name: `test-${type}`, displayName: `T ${type}`, type, description: 'd', version: '1.0.0' });
        expect(asset.id.startsWith(prefix)).toBe(true);
      }
    });

    it('should update an asset', () => {
      const asset = db.createAsset({ name: 'up', displayName: 'Up', type: 'plugin', description: 'Orig', version: '1.0.0' });
      const updated = db.updateAsset(asset.id, { description: 'New', version: '2.0.0', tags: ['new'] });
      expect(updated).not.toBeNull();
      expect(updated!.description).toBe('New');
      expect(updated!.version).toBe('2.0.0');
      expect(updated!.tags).toContain('new');
    });

    it('should return null when updating non-existent asset', () => {
      expect(db.updateAsset('nope', { description: 'x' })).toBeNull();
    });

    it('should delete an asset', () => {
      const asset = db.createAsset({ name: 'del', displayName: 'Del', type: 'skill', description: 'd', version: '1.0.0' });
      expect(db.deleteAsset(asset.id)).toBe(true);
      expect(db.getAssetById(asset.id)).toBeNull();
    });

    it('should return false when deleting non-existent asset', () => {
      expect(db.deleteAsset('nope')).toBe(false);
    });

    it('should return null for non-existent asset ID', () => {
      expect(db.getAssetById('nope')).toBeNull();
    });

    it('should create asset with github fields', () => {
      const asset = db.createAsset({
        name: 'gh', displayName: 'GH', type: 'skill', description: 'd', version: '1.0.0',
        githubUrl: 'https://github.com/test/repo', githubStars: 100, githubForks: 20,
        githubLanguage: 'TypeScript', githubLicense: 'MIT',
      });
      const fetched = db.getAssetById(asset.id);
      expect(fetched!.githubUrl).toBe('https://github.com/test/repo');
      expect(fetched!.githubStars).toBe(100);
    });
  });

  // ═══════════════ List & Pagination ═══════════════
  describe('List & Pagination', () => {
    it('should list assets with pagination', () => {
      for (let i = 0; i < 5; i++) db.createAsset({ name: `a-${i}`, displayName: `A${i}`, type: 'skill', description: 'd', version: '1.0.0' });
      const p1 = db.listAssets({ page: 1, pageSize: 2 });
      expect(p1.assets).toHaveLength(2);
      expect(p1.total).toBe(5);
      const p3 = db.listAssets({ page: 3, pageSize: 2 });
      expect(p3.assets).toHaveLength(1);
    });

    it('should filter by type', () => {
      db.createAsset({ name: 's1', displayName: 'S1', type: 'skill', description: 'd', version: '1.0.0' });
      db.createAsset({ name: 'p1', displayName: 'P1', type: 'plugin', description: 'd', version: '1.0.0' });
      const r = db.listAssets({ type: 'skill' });
      expect(r.assets).toHaveLength(1);
      expect(r.assets[0].type).toBe('skill');
    });

    it('should filter by category', () => {
      db.createAsset({ name: 'a1', displayName: 'A1', type: 'skill', description: 'd', version: '1.0.0', category: 'ai' });
      db.createAsset({ name: 'a2', displayName: 'A2', type: 'skill', description: 'd', version: '1.0.0', category: 'web' });
      expect(db.listAssets({ category: 'ai' }).assets).toHaveLength(1);
    });

    it('should search by query string', () => {
      db.createAsset({ name: 'weather-skill', displayName: 'Weather', type: 'skill', description: 'Get weather', version: '1.0.0' });
      db.createAsset({ name: 'translator', displayName: 'Trans', type: 'skill', description: 'Translate', version: '1.0.0' });
      const r = db.listAssets({ q: 'weather' });
      expect(r.assets).toHaveLength(1);
      expect(r.assets[0].name).toBe('weather-skill');
    });

    it('should sort by downloads', () => {
      const a1 = db.createAsset({ name: 'pop', displayName: 'Pop', type: 'skill', description: 'd', version: '1.0.0' });
      db.createAsset({ name: 'new', displayName: 'New', type: 'skill', description: 'd', version: '1.0.0' });
      testDb.prepare('UPDATE assets SET downloads = 100 WHERE id = ?').run(a1.id);
      expect(db.listAssets({ sort: 'downloads' }).assets[0].name).toBe('pop');
    });

    it('should return empty for empty database', () => {
      const r = db.listAssets({});
      expect(r.assets).toHaveLength(0);
      expect(r.total).toBe(0);
    });
  });

  // ═══════════════ Download Counter ═══════════════
  describe('Download Counter', () => {
    it('should increment download count by 1', () => {
      const asset = db.createAsset({ name: 'dl', displayName: 'DL', type: 'skill', description: 'd', version: '1.0.0' });
      expect(db.incrementDownload(asset.id)).toBe(1);
    });

    it('should return null for non-existent asset', () => {
      expect(db.incrementDownload('nope')).toBeNull();
    });

    it('should increment multiple times correctly', () => {
      const asset = db.createAsset({ name: 'mdl', displayName: 'MDL', type: 'skill', description: 'd', version: '1.0.0' });
      db.incrementDownload(asset.id);
      db.incrementDownload(asset.id);
      expect(db.incrementDownload(asset.id)).toBe(3);
    });
  });

  // ═══════════════ Star System ═══════════════
  describe('Star System', () => {
    it('should star an asset', () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb);
      expect(db.starAsset(user.id, assetId, 'manual')).toBe(true);
      expect(db.isStarred(user.id, assetId)).toBe(true);
    });

    it('should de-duplicate stars', () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb);
      expect(db.starAsset(user.id, assetId)).toBe(true);
      expect(db.starAsset(user.id, assetId)).toBe(false);
      expect(db.getAssetUserStarCount(assetId)).toBe(1);
    });

    it('should unstar an asset', () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb);
      db.starAsset(user.id, assetId);
      expect(db.unstarAsset(user.id, assetId)).toBe(true);
      expect(db.isStarred(user.id, assetId)).toBe(false);
    });

    it('should return false when unstarring not-starred', () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb);
      expect(db.unstarAsset(user.id, assetId)).toBe(false);
    });

    it('should calculate totalStars = github_stars + user_stars', () => {
      const assetId = seedAsset(testDb, { githubStars: 42 });
      const u1 = seedUser(testDb, { id: 'u-s1', name: 'S1' });
      const u2 = seedUser(testDb, { id: 'u-s2', name: 'S2' });
      db.starAsset(u1.id, assetId);
      db.starAsset(u2.id, assetId);
      expect(db.getTotalStars(assetId)).toBe(44);
    });

    it('should auto-star on download with userId', () => {
      const user = seedUser(testDb, { id: 'u-dl' });
      const asset = db.createAsset({ name: 'as', displayName: 'AS', type: 'skill', description: 'd', version: '1.0.0', authorId: user.id });
      db.incrementDownload(asset.id, user.id);
      expect(db.isStarred(user.id, asset.id)).toBe(true);
    });

    it('should not duplicate auto-star on repeated downloads', () => {
      const auth = seedUser(testDb, { id: 'u-au', name: 'Au' });
      const dler = seedUser(testDb, { id: 'u-dl2', name: 'DL2' });
      const asset = db.createAsset({ name: 'rd', displayName: 'RD', type: 'skill', description: 'd', version: '1.0.0', authorId: auth.id });
      db.incrementDownload(asset.id, dler.id);
      db.incrementDownload(asset.id, dler.id);
      expect(db.getAssetUserStarCount(asset.id)).toBe(1);
    });

    it('should return 0 totalStars for non-existent asset', () => {
      expect(db.getTotalStars('nope')).toBe(0);
    });
  });

  // ═══════════════ User System ═══════════════
  describe('User System', () => {
    it('should create and find a user by ID', () => {
      const user = db.createUser({ id: 'u-1', email: 'a@b.com', name: 'U1', avatar: '🤖', provider: 'github', providerId: 'gh-1' });
      expect(user.id).toBe('u-1');
      expect(user.shrimp_coins).toBe(100);
      expect(db.findUserById('u-1')).not.toBeNull();
    });

    it('should find user by provider', () => {
      db.createUser({ id: 'u-gh', email: null, name: 'GH', avatar: '', provider: 'github', providerId: 'gh-456' });
      expect(db.findUserByProvider('github', 'gh-456')!.id).toBe('u-gh');
    });

    it('should find user by email', () => {
      db.createUser({ id: 'u-e', email: 'a@b.com', name: 'E', avatar: '', provider: 'email', providerId: 'u-e' });
      expect(db.findUserByEmail('a@b.com')!.id).toBe('u-e');
    });

    it('should find user by name (case-insensitive)', () => {
      db.createUser({ id: 'u-n', email: null, name: 'CoolAgent', avatar: '', provider: 'api_key', providerId: 'u-n' });
      expect(db.findUserByName('coolagent')).not.toBeNull();
      expect(db.findUserByName('COOLAGENT')).not.toBeNull();
    });

    it('should return null for non-existent user', () => {
      expect(db.findUserById('nope')).toBeNull();
      expect(db.findUserByEmail('nope@x.com')).toBeNull();
      expect(db.findUserByProvider('gh', 'nope')).toBeNull();
      expect(db.findUserByName('nope')).toBeNull();
    });

    it('should soft-delete a user', () => {
      db.createUser({ id: 'u-d', email: null, name: 'D', avatar: '', provider: 'api_key', providerId: 'u-d' });
      expect(db.softDeleteUser('u-d')).toBe(true);
      expect(db.findUserById('u-d')!.deleted_at).not.toBeNull();
    });

    it('should not double soft-delete', () => {
      db.createUser({ id: 'u-dd', email: null, name: 'DD', avatar: '', provider: 'api_key', providerId: 'u-dd' });
      db.softDeleteUser('u-dd');
      expect(db.softDeleteUser('u-dd')).toBe(false);
    });
  });

  // ═══════════════ Invite Codes ═══════════════
  describe('Invite Codes', () => {
    it('should validate seeded invite codes', () => {
      expect(db.validateInviteCode('SEAFOOD').valid).toBe(true);
    });

    it('should reject non-existent invite code', () => {
      expect(db.validateInviteCode('NONEXIST').valid).toBe(false);
    });

    it('should reject fully-used invite code', () => {
      seedInviteCode(testDb, 'SINGLE', 1);
      testDb.prepare('UPDATE invite_codes SET use_count = 1 WHERE code = ?').run('SINGLE');
      expect(db.validateInviteCode('SINGLE').valid).toBe(false);
    });

    it('should activate an invite code for a user', () => {
      db.createUser({ id: 'u-act', email: null, name: 'Act', avatar: '', provider: 'api_key', providerId: 'u-act' });
      expect(db.activateInviteCode('u-act', 'SEAFOOD').success).toBe(true);
      expect(db.findUserById('u-act')!.invite_code).toBe('SEAFOOD');
      expect((testDb.prepare('SELECT use_count FROM invite_codes WHERE code = ?').get('SEAFOOD') as any).use_count).toBe(1);
    });

    it('should reject activation if user already has invite code', () => {
      seedUser(testDb, { id: 'u-al', name: 'Al', inviteCode: 'SEAFOOD' });
      expect(db.activateInviteCode('u-al', 'SEAFOOD').success).toBe(false);
    });

    it('should generate user invite codes after activation', () => {
      db.createUser({ id: 'u-gen', email: null, name: 'Gen', avatar: '', provider: 'api_key', providerId: 'u-gen' });
      db.activateInviteCode('u-gen', 'SEAFOOD');
      const codes = db.getUserInviteCodes('u-gen');
      expect(codes.length).toBe(6);
      for (const c of codes) { expect(c.createdBy).toBe('u-gen'); expect(c.maxUses).toBe(1); }
    });

    it('should check userHasInviteAccess', () => {
      seedUser(testDb, { id: 'u-nc', name: 'NC', inviteCode: null });
      seedUser(testDb, { id: 'u-wc', name: 'WC', inviteCode: 'SEAFOOD' });
      expect(db.userHasInviteAccess('u-nc')).toBe(false);
      expect(db.userHasInviteAccess('u-wc')).toBe(true);
    });

    it('should create and delete super invite code', () => {
      expect(db.createSuperInviteCode('SUPER1', 500, 'admin')).toBe(true);
      expect(db.getInviteCodeDetail('SUPER1')!.maxUses).toBe(500);
      expect(db.createSuperInviteCode('SUPER1', 20, 'admin')).toBe(false); // dup
      expect(db.deleteInviteCode('SUPER1')).toBe(true);
      expect(db.getInviteCodeDetail('SUPER1')).toBeNull();
    });

    it('should list all invite codes', () => {
      const r = db.listAllInviteCodes({ page: 1, pageSize: 10 });
      expect(r.total).toBeGreaterThanOrEqual(3);
    });
  });

  // ═══════════════ API Keys ═══════════════
  describe('API Keys', () => {
    it('should create and find user by API key', () => {
      db.createUser({ id: 'u-api', email: null, name: 'API', avatar: '', provider: 'api_key', providerId: 'u-api' });
      const key = db.createApiKey('u-api', 'k');
      expect(key).toMatch(/^sk-/);
      expect(db.findUserByApiKey(key)!.id).toBe('u-api');
    });

    it('should not find user by revoked API key', () => {
      db.createUser({ id: 'u-rv', email: null, name: 'RV', avatar: '', provider: 'api_key', providerId: 'u-rv' });
      const key = db.createApiKey('u-rv');
      db.revokeApiKeyByRawKey(key, 'u-rv');
      expect(db.findUserByApiKey(key)).toBeNull();
    });

    it('should list keys and update last_used_at', () => {
      db.createUser({ id: 'u-kl', email: null, name: 'KL', avatar: '', provider: 'api_key', providerId: 'u-kl' });
      db.createApiKey('u-kl', 'k1');
      const k2 = db.createApiKey('u-kl', 'k2');
      expect(db.listApiKeys('u-kl')).toHaveLength(2);
      db.updateApiKeyLastUsed(k2);
      const keys = db.listApiKeys('u-kl');
      // S01: key is now stored as hash; match by key_prefix instead
      const prefix = k2.substring(0, 10);
      const updated = keys.find(k => k.key_prefix === prefix);
      expect(updated!.last_used_at).not.toBeNull();
    });

    it('should return null for non-existent key', () => {
      expect(db.findUserByApiKey('sk-nope')).toBeNull();
    });
  });

  // ═══════════════ Device Authorization ═══════════════
  describe('Device Authorization', () => {
    it('should authorize and validate', () => {
      seedUser(testDb, { id: 'u-dv' });
      db.authorizeDevice('u-dv', 'dev-1', 'MB');
      expect(db.validateDevice('dev-1')!.userId).toBe('u-dv');
    });

    it('should return null for unauthorized device', () => {
      expect(db.validateDevice('unknown')).toBeNull();
    });

    it('should list and revoke devices', () => {
      seedUser(testDb, { id: 'u-dl' });
      db.authorizeDevice('u-dl', 'da', 'A');
      db.authorizeDevice('u-dl', 'db', 'B');
      expect(db.listAuthorizedDevices('u-dl')).toHaveLength(2);
      expect(db.revokeDevice('da', 'u-dl')).toBe(true);
      expect(db.validateDevice('da')).toBeNull();
    });

    it('should not revoke device belonging to another user', () => {
      seedUser(testDb, { id: 'u-own' });
      seedUser(testDb, { id: 'u-oth', name: 'Oth' });
      db.authorizeDevice('u-own', 'dv-x', 'X');
      expect(db.revokeDevice('dv-x', 'u-oth')).toBe(false);
      expect(db.validateDevice('dv-x')).not.toBeNull();
    });
  });

  // ═══════════════ Coin System ═══════════════
  describe('Coin System', () => {
    it('should add coins correctly', () => {
      seedUser(testDb, { id: 'u-co', shrimpCoins: 100, reputation: 0 });
      db.addCoins('u-co', 'reputation', 20, 'pub', 'r1');
      db.addCoins('u-co', 'shrimp_coin', 50, 'pub', 'r1');
      const c = db.getUserCoins('u-co');
      expect(c.reputation).toBe(20);
      expect(c.shrimpCoins).toBe(150);
    });

    it('should never go below 0', () => {
      seedUser(testDb, { id: 'u-br', shrimpCoins: 10 });
      db.addCoins('u-br', 'shrimp_coin', -50, 'spend');
      expect(db.getUserCoins('u-br').shrimpCoins).toBe(0);
    });

    it('should record coin events in history', () => {
      seedUser(testDb, { id: 'u-hi' });
      db.addCoins('u-hi', 'reputation', 10, 'ev_a', 'ra');
      db.addCoins('u-hi', 'shrimp_coin', 5, 'ev_b', 'rb');
      expect(db.getCoinHistory('u-hi')).toHaveLength(2);
      expect(db.getCoinHistory('u-hi', 'reputation')).toHaveLength(1);
    });

    it('should ignore addCoins for non-existent user', () => {
      db.addCoins('nope', 'reputation', 100, 'test');
      expect(db.getCoinHistory('nope')).toHaveLength(0);
    });

    it('should award coins on asset publish', () => {
      db.createUser({ id: 'u-pb', email: null, name: 'PB', avatar: '', provider: 'api_key', providerId: 'u-pb' });
      db.createAsset({ name: 'pa', displayName: 'PA', type: 'skill', description: 'd', version: '1.0.0', authorId: 'u-pb' });
      const c = db.getUserCoins('u-pb');
      expect(c.reputation).toBeGreaterThan(0);
      expect(c.shrimpCoins).toBeGreaterThan(100);
    });

    it('should award coins on download to author', () => {
      db.createUser({ id: 'u-da', email: null, name: 'DA', avatar: '', provider: 'api_key', providerId: 'u-da' });
      const asset = db.createAsset({ name: 'dra', displayName: 'DRA', type: 'skill', description: 'd', version: '1.0.0', authorId: 'u-da' });
      const before = db.getUserCoins('u-da');
      db.incrementDownload(asset.id);
      const after = db.getUserCoins('u-da');
      expect(after.reputation).toBeGreaterThan(before.reputation);
    });
  });

  // ═══════════════ Comments ═══════════════
  describe('Comments', () => {
    it('should create and list comments', () => {
      const assetId = seedAsset(testDb);
      const user = seedUser(testDb, { id: 'u-cm', name: 'CM' });
      const c = db.createComment({ assetId, userId: user.id, userName: user.name, userAvatar: '🧪', content: 'Great!', rating: 5, commenterType: 'user' });
      expect(c.id).toBeTruthy();
      expect(db.getCommentsByAssetId(assetId)).toHaveLength(1);
    });

    it('should return empty for no comments', () => {
      expect(db.getCommentsByAssetId(seedAsset(testDb))).toHaveLength(0);
    });

    it('should award coins on comment', () => {
      db.createUser({ id: 'u-cc', email: null, name: 'CC', avatar: '', provider: 'api_key', providerId: 'u-cc' });
      const aid = seedAsset(testDb, { authorId: 'u-other' });
      const before = db.getUserCoins('u-cc');
      db.createComment({ assetId: aid, userId: 'u-cc', userName: 'CC', userAvatar: '', content: 'Nice', rating: 4, commenterType: 'user' });
      const after = db.getUserCoins('u-cc');
      expect(after.reputation).toBeGreaterThanOrEqual(before.reputation);
    });
  });

  // ═══════════════ Issues ═══════════════
  describe('Issues', () => {
    it('should create and list issues', () => {
      const aid = seedAsset(testDb);
      seedUser(testDb, { id: 'u-is', name: 'IS' });
      const issue = db.createIssue({ assetId: aid, authorId: 'u-is', authorName: 'IS', authorAvatar: '🧪', authorType: 'user', title: 'Bug', body: 'Broken', labels: ['bug'] });
      expect(issue.id).toBeTruthy();
      expect(issue.status).toBe('open');
      expect(db.getIssuesByAssetId(aid)).toHaveLength(1);
    });

    it('should return empty for no issues', () => {
      expect(db.getIssuesByAssetId(seedAsset(testDb))).toHaveLength(0);
    });

    it('should track issue_count via getIssueCount', () => {
      const asset = db.createAsset({ name: 'ic', displayName: 'IC', type: 'skill', description: 'd', version: '1.0.0' });
      seedUser(testDb, { id: 'u-ic' });
      db.createIssue({ assetId: asset.id, authorId: 'u-ic', authorName: 'IC', authorAvatar: '', authorType: 'user', title: 'I1', body: '', labels: [] });
      expect(db.getIssueCount(asset.id)).toBe(1);
    });
  });

  // ═══════════════ Stats ═══════════════
  describe('Stats', () => {
    it('should return correct stats', () => {
      db.createAsset({ name: 'st1', displayName: 'S1', type: 'skill', description: 'd', version: '1.0.0' });
      db.createAsset({ name: 'st2', displayName: 'S2', type: 'plugin', description: 'd', version: '1.0.0' });
      const stats = db.getStats();
      expect(stats.totalAssets).toBe(2);
      expect(stats.totalDownloads).toBe(0);
    });

    it('should return asset count by type', () => {
      db.createAsset({ name: 'tc1', displayName: 'TC1', type: 'skill', description: 'd', version: '1.0.0' });
      db.createAsset({ name: 'tc2', displayName: 'TC2', type: 'skill', description: 'd', version: '1.0.0' });
      db.createAsset({ name: 'tc3', displayName: 'TC3', type: 'plugin', description: 'd', version: '1.0.0' });
      const counts = db.getAssetCountByType();
      expect(counts['skill']).toBe(2);
      expect(counts['plugin']).toBe(1);
    });
  });

  // ═══════════════ Edge Cases ═══════════════
  describe('Edge Cases', () => {
    it('should handle SQL injection attempt safely', () => {
      const asset = db.createAsset({
        name: "'; DROP TABLE assets;--", displayName: "'; DROP TABLE assets;--",
        type: 'skill', description: "Robert'); DROP TABLE assets;--", version: '1.0.0',
      });
      expect(asset.id).toBeTruthy();
      expect(asset.name).toBe("'; DROP TABLE assets;--");
      expect(db.listAssets({}).assets).toHaveLength(1);
    });

    it('should handle long strings', () => {
      const long = 'x'.repeat(10000);
      const asset = db.createAsset({ name: long, displayName: long, type: 'skill', description: 'long', version: '1.0.0' });
      expect(asset.name).toBe(long);
    });

    it('should handle empty string fields', () => {
      const asset = db.createAsset({ name: '', displayName: '', type: 'skill', description: '', version: '' });
      expect(asset.id).toBeTruthy();
    });

    it('should handle unicode and emoji in names', () => {
      const asset = db.createAsset({ name: '水产市场-🦐', displayName: '水产 🦐🐟', type: 'skill', description: '中文 🎉', version: '1.0.0' });
      expect(asset.name).toBe('水产市场-🦐');
      expect(asset.displayName).toBe('水产 🦐🐟');
    });
  });

  // ════════════════════════════════════════════
  // FTS5 Full-Text Search
  // ════════════════════════════════════════════

  describe('FTS5 Search', () => {
    beforeEach(() => {
      testDb = freshDb();
      // Create test assets for FTS
      db.createAsset({ name: 'weather-skill', displayName: 'Weather Forecast', type: 'skill', description: 'Get weather data and forecasts', version: '1.0.0', tags: ['weather', 'forecast'] });
      db.createAsset({ name: 'translator', displayName: 'Multi Translator', type: 'plugin', description: 'Translate text between languages', version: '2.0.0', tags: ['translation', 'language'] });
      db.createAsset({ name: 'code-review', displayName: 'Code Review Assistant', type: 'skill', description: 'AI code review and suggestions', version: '1.0.0', tags: ['code', 'review'] });
      // Rebuild FTS index after seeding (triggers should handle inserts, but rebuild to be safe)
      db.rebuildFtsIndex();
    });

    it('should find assets by name via FTS', () => {
      const result = db.listAssets({ q: 'weather' });
      expect(result.total).toBe(1);
      expect(result.assets[0].name).toBe('weather-skill');
    });

    it('should find assets by description via FTS', () => {
      const result = db.listAssets({ q: 'translate' });
      expect(result.total).toBe(1);
      expect(result.assets[0].name).toBe('translator');
    });

    it('should find assets by display name via FTS', () => {
      const result = db.listAssets({ q: 'Assistant' });
      expect(result.total).toBe(1);
      expect(result.assets[0].name).toBe('code-review');
    });

    it('should return empty for non-matching queries', () => {
      const result = db.listAssets({ q: 'nonexistentxyz' });
      expect(result.total).toBe(0);
      expect(result.assets).toHaveLength(0);
    });

    it('should handle special FTS characters safely', () => {
      // These should not throw errors
      const result1 = db.listAssets({ q: '"weather" OR code' });
      expect(result1.total).toBeGreaterThanOrEqual(0);

      const result2 = db.listAssets({ q: 'weather*' });
      expect(result2.total).toBeGreaterThanOrEqual(0);

      const result3 = db.listAssets({ q: 'NEAR(weather, code)' });
      expect(result3.total).toBeGreaterThanOrEqual(0);
    });

    it('should work with listAssetsCompact (V1 API)', () => {
      const result = db.listAssetsCompact({ q: 'forecast' });
      expect(result.total).toBe(1);
      expect(result.assets[0].name).toBe('weather-skill');
    });

    it('should support rebuildFtsIndex', () => {
      // After rebuild, search should still work
      db.rebuildFtsIndex();
      const result = db.listAssets({ q: 'weather' });
      expect(result.total).toBe(1);
    });
  });
});