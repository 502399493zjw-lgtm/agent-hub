/**
 * DB Factory — creates isolated in-memory SQLite databases for testing.
 *
 * Uses the __setTestDb() hook we added to db.ts to inject a test DB.
 * This approach reuses the real initTables() from db.ts, ensuring schema parity.
 */
import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Create a fresh in-memory SQLite database (raw — tables NOT yet initialized).
 * Use `initTestDb()` for a fully initialized DB with tables + seed data.
 */
export function createRawTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  return db;
}

/** Seed a test invite code into the DB */
export function seedInviteCode(db: Database.Database, code: string, maxUses: number = 100, type: string = 'super'): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, 'system', ?, 0, ?, ?)`
  ).run(code, maxUses, type, now);
}

/** Create a test user in the DB. Returns the user row. */
export function seedUser(db: Database.Database, overrides: Partial<{
  id: string; email: string | null; name: string; avatar: string;
  provider: string; providerId: string; inviteCode: string | null;
  reputation: number; shrimpCoins: number;
}> = {}): { id: string; name: string; email: string | null } {
  const id = overrides.id ?? 'u-test-' + Math.random().toString(36).substring(2, 8);
  const name = overrides.name ?? 'TestUser';
  const email = overrides.email ?? null;
  const avatar = overrides.avatar ?? '🧪';
  const provider = overrides.provider ?? 'api_key';
  const providerId = overrides.providerId ?? id;
  const inviteCode = overrides.inviteCode ?? null;
  const reputation = overrides.reputation ?? 0;
  const shrimpCoins = overrides.shrimpCoins ?? 100;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, name, avatar, provider, provider_id, bio, invite_code, created_at, updated_at, reputation, shrimp_coins, onboarding_completed, provider_name, provider_avatar, type)
     VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 0, ?, ?, 'user')`
  ).run(id, email, name, avatar, provider, providerId, inviteCode, now, now, reputation, shrimpCoins, name, avatar);

  return { id, name, email };
}

/** Create a test asset in the DB. Returns the asset id. */
export function seedAsset(db: Database.Database, overrides: Partial<{
  id: string; name: string; displayName: string; type: string;
  authorId: string; authorName: string; description: string;
  downloads: number; rating: number; ratingCount: number;
  tags: string[]; category: string; githubStars: number; githubUrl: string;
}> = {}): string {
  const id = overrides.id ?? 's-test-' + Math.random().toString(36).substring(2, 8);
  const name = overrides.name ?? 'test-asset';
  const displayName = overrides.displayName ?? 'Test Asset';
  const type = overrides.type ?? 'skill';
  const authorId = overrides.authorId ?? 'u-test';
  const authorName = overrides.authorName ?? 'TestUser';
  const description = overrides.description ?? 'A test asset';
  const downloads = overrides.downloads ?? 0;
  const rating = overrides.rating ?? 0;
  const ratingCount = overrides.ratingCount ?? 0;
  const tags = JSON.stringify(overrides.tags ?? ['test']);
  const category = overrides.category ?? 'testing';
  const githubStars = overrides.githubStars ?? 0;
  const githubUrl = overrides.githubUrl ?? '';
  const now = new Date().toISOString().split('T')[0];

  db.prepare(
    `INSERT INTO assets (id, name, display_name, type, author_id, author_name, author_avatar, description, long_description, version, downloads, rating, rating_count, tags, category, created_at, updated_at, install_command, readme, versions, dependencies, issue_count, hub_score, hub_score_breakdown, upgrade_rate, compatibility, files, manifest, github_url, github_stars, github_forks, github_language, github_license, github_synced_at)
     VALUES (?, ?, ?, ?, ?, ?, '🧪', ?, '', '1.0.0', ?, ?, ?, ?, ?, ?, ?, '', '', '[]', '[]', 0, 0, '{}', 0, '{}', '[]', '{}', ?, ?, 0, '', '', '')`
  ).run(id, name, displayName, type, authorId, authorName, description, downloads, rating, ratingCount, tags, category, now, now, githubUrl, githubStars);

  return id;
}

/** Create a test API key in the DB. Returns the key string. */
export function seedApiKey(db: Database.Database, userId: string, overrides: Partial<{
  key: string; name: string; revoked: boolean;
}> = {}): string {
  const key = overrides.key ?? 'sk-test-' + Math.random().toString(36).substring(2, 16);
  const name = overrides.name ?? 'default';
  const revoked = overrides.revoked ? 1 : 0;
  const now = new Date().toISOString();
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const keyPrefix = key.substring(0, 10);

  db.prepare(
    `INSERT INTO api_keys (key_hash, key_prefix, user_id, name, created_at, revoked) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(keyHash, keyPrefix, userId, name, now, revoked);

  return key;
}

/** Authorize a device for a user */
export function seedDevice(db: Database.Database, userId: string, deviceId: string, name: string = 'test-device'): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO authorized_devices (device_id, user_id, name, authorized_at) VALUES (?, ?, ?, ?)`
  ).run(deviceId, userId, name, now);
}
