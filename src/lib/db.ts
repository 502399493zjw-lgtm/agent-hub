import Database from 'better-sqlite3';
import path from 'path';
import { Asset, User } from '@/data/types';
import { inviteCodes } from '@/data/seed';

const DB_PATH = path.join(process.cwd(), 'data', 'hub.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initTables(_db);
  }
  return _db;
}

// ════════════════════════════════════════════
// Hub Score — REMOVED (v3: display installs directly)
// calculateHubScore kept only for internal DB column compat
// ════════════════════════════════════════════

export function calculateHubScore(_downloads: number, _rating: number, _ratingCount: number): {
  hubScore: number;
  hubScoreBreakdown: { downloadScore: number; maintenanceScore: number; reputationScore: number };
} {
  return { hubScore: 0, hubScoreBreakdown: { downloadScore: 0, maintenanceScore: 0, reputationScore: 0 } };
}

// ════════════════════════════════════════════
// Coin System — Event Values
// ════════════════════════════════════════════

// User reputation events (honor currency, only goes up)
const USER_REP_EVENTS = {
  publish_asset:   20,
  asset_installed:  3,
  asset_rated_good: 5,  // 4-5 star
  issue_closed:     5,
  write_comment:    2,
  submit_issue:     2,
  invite_user:     10,
  new_version:      8,
} as const;

// Shrimp coins events (spendable currency)
const SHRIMP_COIN_EVENTS = {
  register:        100,  // welcome bonus
  daily_login:       5,
  publish_asset:    50,
  asset_installed:  10,
  asset_rated_5star: 15,
  write_comment:     3,
  submit_issue:      5,
  invite_user:      30,
  new_version:      20,
} as const;

export function recalculateHubScore(assetId: string): void {
  const db = getDb();
  const row = db.prepare('SELECT downloads, rating, rating_count FROM assets WHERE id = ?').get(assetId) as { downloads: number; rating: number; rating_count: number } | undefined;
  if (!row) return;
  const { hubScore, hubScoreBreakdown } = calculateHubScore(row.downloads, row.rating, row.rating_count);
  db.prepare('UPDATE assets SET hub_score = ?, hub_score_breakdown = ? WHERE id = ?').run(
    hubScore, JSON.stringify(hubScoreBreakdown), assetId
  );
}

export function incrementDownload(assetId: string): number | null {
  const db = getDb();
  const result = db.prepare('UPDATE assets SET downloads = downloads + 1 WHERE id = ?').run(assetId);
  if (result.changes === 0) return null;
  recalculateHubScore(assetId);

  // Award coins to asset author
  const asset = db.prepare('SELECT author_id, downloads FROM assets WHERE id = ?').get(assetId) as { author_id: string; downloads: number } | undefined;
  if (asset?.author_id) {
    addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
    addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
  }
  return asset?.downloads ?? null;
}

// ════════════════════════════════════════════
// Coin System — Reputation & Shrimp Coins
// ════════════════════════════════════════════

export function addCoins(userId: string, coinType: 'reputation' | 'shrimp_coin', amount: number, event: string, refId?: string): void {
  const db = getDb();
  const col = coinType === 'reputation' ? 'reputation' : 'shrimp_coins';

  // Check user exists
  const user = db.prepare(`SELECT ${col} FROM users WHERE id = ?`).get(userId) as Record<string, number> | undefined;
  if (!user) return;

  const currentBalance = user[col] ?? 0;
  const newBalance = Math.max(0, currentBalance + amount); // never go below 0

  db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(newBalance, userId);
  db.prepare(`INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    userId, coinType, amount, event, refId ?? null, newBalance, new Date().toISOString()
  );
}

export function getUserCoins(userId: string): { reputation: number; shrimpCoins: number } {
  const row = getDb().prepare('SELECT reputation, shrimp_coins FROM users WHERE id = ?').get(userId) as { reputation: number; shrimp_coins: number } | undefined;
  return { reputation: row?.reputation ?? 0, shrimpCoins: row?.shrimp_coins ?? 100 };
}

export function getCoinHistory(userId: string, coinType?: 'reputation' | 'shrimp_coin', limit: number = 50): { id: number; coinType: string; amount: number; event: string; refId: string | null; balanceAfter: number; createdAt: string }[] {
  const db = getDb();
  let sql = 'SELECT * FROM coin_events WHERE user_id = ?';
  const params: (string | number)[] = [userId];
  if (coinType) {
    sql += ' AND coin_type = ?';
    params.push(coinType);
  }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(limit);
  const rows = db.prepare(sql).all(...params) as { id: number; user_id: string; coin_type: string; amount: number; event: string; ref_id: string | null; balance_after: number; created_at: string }[];
  return rows.map(r => ({ id: r.id, coinType: r.coin_type, amount: r.amount, event: r.event, refId: r.ref_id, balanceAfter: r.balance_after, createdAt: r.created_at }));
}

export function hasEnoughCoins(userId: string, amount: number): boolean {
  const { shrimpCoins } = getUserCoins(userId);
  return shrimpCoins >= amount;
}

// ════════════════════════════════════════════
// Table creation
// ════════════════════════════════════════════

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, display_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('skill','channel','plugin','trigger','config','template')),
      author_id TEXT NOT NULL DEFAULT '', author_name TEXT NOT NULL DEFAULT '', author_avatar TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', long_description TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0.0', downloads INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]', category TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
      install_command TEXT NOT NULL DEFAULT '', readme TEXT NOT NULL DEFAULT '',
      versions TEXT NOT NULL DEFAULT '[]', dependencies TEXT NOT NULL DEFAULT '[]',
      issue_count INTEGER NOT NULL DEFAULT 0, config_subtype TEXT,
      hub_score INTEGER NOT NULL DEFAULT 70, hub_score_breakdown TEXT NOT NULL DEFAULT '{}',
      upgrade_rate REAL NOT NULL DEFAULT 50, compatibility TEXT NOT NULL DEFAULT '{}',
      files TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, avatar TEXT DEFAULT '',
      provider TEXT NOT NULL, provider_id TEXT NOT NULL, bio TEXT DEFAULT '',
      invite_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
      UNIQUE(provider, provider_id)
    );
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY, created_by TEXT DEFAULT 'system', used_by TEXT, used_at TEXT,
      max_uses INTEGER DEFAULT 1, use_count INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'normal'
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT '', published_assets TEXT NOT NULL DEFAULT '[]',
      favorite_assets TEXT NOT NULL DEFAULT '[]', followers INTEGER NOT NULL DEFAULT 0,
      following INTEGER NOT NULL DEFAULT 0, is_agent BOOLEAN NOT NULL DEFAULT 0,
      agent_model TEXT, agent_uptime TEXT, agent_tasks_completed INTEGER NOT NULL DEFAULT 0,
      agent_specialization TEXT, contribution_points INTEGER NOT NULL DEFAULT 0,
      contributor_level TEXT NOT NULL DEFAULT 'newcomer', instance_id TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, user_id TEXT NOT NULL,
      user_name TEXT, user_avatar TEXT, content TEXT, rating INTEGER,
      created_at TEXT, commenter_type TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, author_id TEXT,
      author_name TEXT, author_avatar TEXT, author_type TEXT NOT NULL DEFAULT 'user',
      title TEXT, body TEXT, status TEXT NOT NULL DEFAULT 'open',
      labels TEXT NOT NULL DEFAULT '[]', created_at TEXT, comment_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY, title TEXT, description TEXT,
      curator_id TEXT, curator_name TEXT, curator_avatar TEXT,
      asset_ids TEXT NOT NULL DEFAULT '[]', cover_emoji TEXT,
      followers INTEGER NOT NULL DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'self', type TEXT,
      title TEXT, message TEXT, icon TEXT, link_to TEXT,
      is_read BOOLEAN NOT NULL DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS evolution_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, icon TEXT,
      title TEXT, description TEXT, date TEXT, type TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, icon TEXT,
      text TEXT, date TEXT, type TEXT, link_to TEXT,
      actor_type TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS authorized_devices (
      device_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      authorized_at TEXT NOT NULL,
      last_publish_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT NOT NULL,
      expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );
    CREATE TABLE IF NOT EXISTS daily_stats (
      day INTEGER PRIMARY KEY, downloads INTEGER NOT NULL DEFAULT 0,
      new_assets INTEGER NOT NULL DEFAULT 0, new_users INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS coin_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      coin_type TEXT NOT NULL CHECK(coin_type IN ('reputation', 'shrimp_coin')),
      amount INTEGER NOT NULL,
      event TEXT NOT NULL,
      ref_id TEXT,
      balance_after INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_coin_events_user ON coin_events(user_id, coin_type);
    CREATE INDEX IF NOT EXISTS idx_coin_events_ref ON coin_events(ref_id);
  `);

  // Migration: add reputation and shrimp_coins columns to users table if missing
  try {
    db.exec(`ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN shrimp_coins INTEGER NOT NULL DEFAULT 100`);
  } catch { /* column already exists */ }
  // Migration: add onboarding + custom profile columns
  try {
    db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN custom_name TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN custom_avatar TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN provider_name TEXT`);
  } catch { /* column already exists */ }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN provider_avatar TEXT`);
  } catch { /* column already exists */ }
  // Migration: add manifest column to assets
  try {
    db.exec(`ALTER TABLE assets ADD COLUMN manifest TEXT NOT NULL DEFAULT '{}'`);
  } catch { /* column already exists */ }

  // Seed invite codes if empty
  const inviteCount = db.prepare('SELECT COUNT(*) as cnt FROM invite_codes').get() as { cnt: number };
  if (inviteCount.cnt === 0) {
    const now = new Date().toISOString();
    const insertCode = db.prepare(`INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, 'system', ?, 0, ?, ?)`);
    for (const c of inviteCodes) {
      insertCode.run(c.code, c.maxUses, c.type ?? 'system', now);
    }
  }
}

// ════════════════════════════════════════════
// Asset row conversion
// ════════════════════════════════════════════

export interface DbRow {
  id: string; name: string; display_name: string; type: string;
  author_id: string; author_name: string; author_avatar: string;
  description: string; long_description: string; version: string;
  downloads: number; rating: number; rating_count: number;
  tags: string; category: string; created_at: string; updated_at: string;
  install_command: string; readme: string; versions: string; dependencies: string;
  issue_count: number; config_subtype: string | null;
  hub_score: number; hub_score_breakdown: string; upgrade_rate: number;
  compatibility: string; files: string;
  github_url: string; github_stars: number; github_forks: number;
  github_language: string; github_license: string; github_synced_at: string;
}

export function rowToAsset(row: DbRow): Asset {
  return {
    id: row.id, name: row.name, displayName: row.display_name,
    type: row.type as Asset['type'],
    author: { id: row.author_id || ('u-' + row.author_name.toLowerCase().replace(/\s+/g, '-')), name: row.author_name, avatar: row.author_avatar },
    description: row.description, longDescription: row.long_description, version: row.version,
    downloads: row.downloads, rating: row.rating, ratingCount: row.rating_count,
    tags: JSON.parse(row.tags) as string[], category: row.category,
    createdAt: row.created_at, updatedAt: row.updated_at,
    installCommand: row.install_command, readme: row.readme,
    versions: JSON.parse(row.versions), dependencies: JSON.parse(row.dependencies),
    compatibility: JSON.parse(row.compatibility), issueCount: row.issue_count,
    files: JSON.parse(row.files || '[]'),
    configSubtype: (row.config_subtype ?? undefined) as Asset['configSubtype'],
    githubUrl: row.github_url || undefined,
    githubStars: row.github_stars || undefined,
    githubForks: row.github_forks || undefined,
  };
}

function assetToRow(a: Asset) {
  const { hubScore, hubScoreBreakdown } = calculateHubScore(a.downloads, a.rating, a.ratingCount);
  return {
    id: a.id, name: a.name, display_name: a.displayName, type: a.type,
    author_id: a.author.id, author_name: a.author.name, author_avatar: a.author.avatar,
    description: a.description, long_description: a.longDescription, version: a.version,
    downloads: a.downloads, rating: a.rating, rating_count: a.ratingCount,
    tags: JSON.stringify(a.tags), category: a.category,
    created_at: a.createdAt, updated_at: a.updatedAt,
    install_command: a.installCommand, readme: a.readme,
    versions: JSON.stringify(a.versions), dependencies: JSON.stringify(a.dependencies),
    issue_count: a.issueCount, config_subtype: a.configSubtype ?? null,
    files: JSON.stringify(a.files ?? []),
    hub_score: hubScore, hub_score_breakdown: JSON.stringify(hubScoreBreakdown),
    upgrade_rate: 0, compatibility: JSON.stringify(a.compatibility ?? {}),
  };
}

// ════════════════════════════════════════════
// Public API — Assets
// ════════════════════════════════════════════

export interface ListParams {
  type?: string; category?: string; q?: string; sort?: string; page?: number; pageSize?: number;
}

export function listAssets(params: ListParams): { assets: Asset[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const conditions: string[] = [];
  const bindings: Record<string, string | number> = {};

  if (params.type && ['skill','config','plugin','trigger','channel','template'].includes(params.type)) {
    conditions.push('type = @type'); bindings.type = params.type;
  }
  if (params.category) { conditions.push('category = @category'); bindings.category = params.category; }
  if (params.q) {
    conditions.push(`(name LIKE @q OR display_name LIKE @q OR description LIKE @q OR tags LIKE @q)`);
    bindings.q = `%${params.q}%`;
  }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM assets ${where}`).get(bindings) as { cnt: number }).cnt;

  let orderBy: string;
  switch (params.sort) {
    case 'downloads': orderBy = 'downloads DESC'; break;
    case 'rating': orderBy = 'rating DESC'; break;
    case 'updated_at': case 'newest': orderBy = 'updated_at DESC'; break;
    case 'created_at': orderBy = 'created_at DESC'; break;
    case 'trending': orderBy = 'downloads DESC, updated_at DESC'; break;
    default: orderBy = '(downloads * rating) DESC';
  }
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`SELECT * FROM assets ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`).all({ ...bindings, limit: pageSize, offset }) as DbRow[];
  return { assets: rows.map(rowToAsset), total, page, pageSize };
}

export function getAssetById(id: string): Asset | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow | undefined;
  return row ? rowToAsset(row) : null;
}

export function createAsset(data: {
  name: string; displayName: string; type: string; description: string; version: string;
  authorId?: string; authorName?: string; authorAvatar?: string;
  longDescription?: string; tags?: string[]; category?: string; readme?: string; configSubtype?: string;
}): Asset {
  const db = getDb();
  const typePrefixes: Record<string, string> = { skill: 's', config: 'c', plugin: 'p', trigger: 'tr', channel: 'ch', template: 't' };
  const prefix = typePrefixes[data.type] || 'x';
  const id = `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
  const now = new Date().toISOString().split('T')[0];
  const authorName = data.authorName || 'CyberNova';
  const authorAvatar = data.authorAvatar || '🤖';
  const authorId = data.authorId || ('u-' + authorName.toLowerCase().replace(/\s+/g, '-'));

  // Calculate initial hub score (0 downloads, 0 ratings)
  const { hubScore, hubScoreBreakdown } = calculateHubScore(0, 0, 0);

  const asset: Asset = {
    id, name: data.name, displayName: data.displayName, type: data.type as Asset['type'],
    author: { id: authorId, name: authorName, avatar: authorAvatar },
    description: data.description, longDescription: data.longDescription || '',
    version: data.version, downloads: 0, rating: 0, ratingCount: 0,
    tags: data.tags || [], category: data.category || '',
    createdAt: now, updatedAt: now,
    installCommand: `seafood-market install ${data.type}/@${authorId}/${data.name}`,
    readme: data.readme || '',
    versions: [{ version: data.version, changelog: '首次发布', date: now }],
    dependencies: [], compatibility: { models: ['GPT-4','Claude 3'], platforms: ['OpenClaw'], frameworks: ['Node.js'] },
    issueCount: 0, configSubtype: data.configSubtype as Asset['configSubtype'],
  };
  db.prepare(`INSERT INTO assets (id,name,display_name,type,author_id,author_name,author_avatar,description,long_description,version,downloads,rating,rating_count,tags,category,created_at,updated_at,install_command,readme,versions,dependencies,issue_count,config_subtype,hub_score,hub_score_breakdown,upgrade_rate,compatibility,files) VALUES (@id,@name,@display_name,@type,@author_id,@author_name,@author_avatar,@description,@long_description,@version,@downloads,@rating,@rating_count,@tags,@category,@created_at,@updated_at,@install_command,@readme,@versions,@dependencies,@issue_count,@config_subtype,@hub_score,@hub_score_breakdown,@upgrade_rate,@compatibility,@files)`).run(assetToRow(asset));

  // Award coins to publisher
  if (data.authorId) {
    addCoins(data.authorId, 'reputation', USER_REP_EVENTS.publish_asset, 'publish_asset', id);
    addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_asset, 'publish_asset', id);
  }

  return asset;
}

export function updateAsset(id: string, data: Partial<{
  name: string; displayName: string; description: string; longDescription: string;
  version: string; tags: string[]; category: string; readme: string;
  authorId: string; authorName: string; authorAvatar: string;
  files: Array<{ name: string; type: string; size?: number; children?: unknown[]; content?: string }>;
}>): Asset | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow | undefined;
  if (!existing) return null;
  const updates: string[] = [];
  const bindings: Record<string, string | number> = { id };
  if (data.name !== undefined) { updates.push('name = @name'); bindings.name = data.name; }
  if (data.displayName !== undefined) { updates.push('display_name = @dn'); bindings.dn = data.displayName; }
  if (data.description !== undefined) { updates.push('description = @desc'); bindings.desc = data.description; }
  if (data.longDescription !== undefined) { updates.push('long_description = @ld'); bindings.ld = data.longDescription; }
  if (data.version !== undefined) { updates.push('version = @ver'); bindings.ver = data.version; }
  if (data.tags !== undefined) { updates.push('tags = @tags'); bindings.tags = JSON.stringify(data.tags); }
  if (data.category !== undefined) { updates.push('category = @cat'); bindings.cat = data.category; }
  if (data.readme !== undefined) { updates.push('readme = @rm'); bindings.rm = data.readme; }
  if (data.authorId !== undefined) { updates.push('author_id = @ai'); bindings.ai = data.authorId; }
  if (data.authorName !== undefined) { updates.push('author_name = @an'); bindings.an = data.authorName; }
  if (data.authorAvatar !== undefined) { updates.push('author_avatar = @aa'); bindings.aa = data.authorAvatar; }
  if ((data as { files?: unknown }).files !== undefined) { updates.push('files = @files'); bindings.files = JSON.stringify((data as { files: unknown }).files); }
  updates.push('updated_at = @ua'); bindings.ua = new Date().toISOString().split('T')[0];
  db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = @id`).run(bindings);
  return rowToAsset(db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow);
}

export function deleteAsset(id: string): boolean {
  return getDb().prepare('DELETE FROM assets WHERE id = ?').run(id).changes > 0;
}

// ════════════════════════════════════════════
// Public API — Auth Users (OAuth)
// ════════════════════════════════════════════

export interface DbUser {
  id: string; email: string | null; name: string; avatar: string;
  provider: string; provider_id: string; bio: string;
  invite_code: string | null; created_at: string; updated_at: string; deleted_at: string | null;
  reputation: number; shrimp_coins: number;
  onboarding_completed: number;
  custom_name: string | null; custom_avatar: string | null;
  provider_name: string | null; provider_avatar: string | null;
}

export function findUserByProvider(provider: string, providerId: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId) as DbUser | undefined) ?? null;
}

export function findUserById(id: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined) ?? null;
}

export function createUser(data: { id: string; email: string | null; name: string; avatar: string; provider: string; providerId: string; }): DbUser {
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO users (id,email,name,avatar,provider,provider_id,bio,invite_code,created_at,updated_at,reputation,shrimp_coins,onboarding_completed,provider_name,provider_avatar) VALUES (?,?,?,?,?,?,'',NULL,?,?,0,?,0,?,?)`).run(data.id, data.email, data.name, data.avatar, data.provider, data.providerId, now, now, SHRIMP_COIN_EVENTS.register, data.name, data.avatar);

  // Record the welcome bonus in coin_events
  addCoins(data.id, 'shrimp_coin', 0, 'register_bonus'); // balance already set to 100 above, just log it

  return findUserById(data.id)!;
}

export function softDeleteUser(id: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id).changes > 0;
}

export function completeOnboarding(userId: string, data: { name: string; avatar: string }): boolean {
  const now = new Date().toISOString();
  const db = getDb();
  return db.prepare('UPDATE users SET name = ?, avatar = ?, custom_name = ?, custom_avatar = ?, onboarding_completed = 1, updated_at = ? WHERE id = ?')
    .run(data.name, data.avatar, data.name, data.avatar, now, userId).changes > 0;
}

export function isOnboardingCompleted(userId: string): boolean {
  const row = getDb().prepare('SELECT onboarding_completed FROM users WHERE id = ?').get(userId) as { onboarding_completed: number } | undefined;
  return !!row?.onboarding_completed;
}

export function getUserProviderInfo(userId: string): { provider: string; providerName: string | null; providerAvatar: string | null } | null {
  const row = getDb().prepare('SELECT provider, provider_name, provider_avatar FROM users WHERE id = ?').get(userId) as { provider: string; provider_name: string | null; provider_avatar: string | null } | undefined;
  return row ? { provider: row.provider, providerName: row.provider_name, providerAvatar: row.provider_avatar } : null;
}

export function updateProviderInfo(userId: string, name: string, avatar: string): void {
  getDb().prepare('UPDATE users SET provider_name = ?, provider_avatar = ?, updated_at = ? WHERE id = ?')
    .run(name, avatar, new Date().toISOString(), userId);
}

export function findUserByEmail(email: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined) ?? null;
}

// ════════════════════════════════════════════
// Verification Tokens (for Magic Link email login)
// ════════════════════════════════════════════

export function createVerificationToken(data: { identifier: string; token: string; expires: Date }): { identifier: string; token: string; expires: Date } {
  getDb().prepare('INSERT OR REPLACE INTO verification_tokens (identifier, token, expires) VALUES (?, ?, ?)').run(data.identifier, data.token, data.expires.toISOString());
  return data;
}

export function useVerificationToken(data: { identifier: string; token: string }): { identifier: string; token: string; expires: Date } | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?').get(data.identifier, data.token) as { identifier: string; token: string; expires: string } | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM verification_tokens WHERE identifier = ? AND token = ?').run(data.identifier, data.token);
  return { identifier: row.identifier, token: row.token, expires: new Date(row.expires) };
}

export function activateInviteCode(userId: string, code: string): { success: boolean; error?: string } {
  const db = getDb();
  const user = findUserById(userId);
  if (!user) return { success: false, error: '用户不存在' };
  if (user.invite_code) return { success: false, error: '已激活邀请码' };
  const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as { code: string; max_uses: number; use_count: number; expires_at: string | null } | undefined;
  if (!invite) return { success: false, error: '邀请码不存在' };
  if (invite.use_count >= invite.max_uses) return { success: false, error: '邀请码已用完' };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { success: false, error: '邀请码已过期' };
  const now = new Date().toISOString();
  db.transaction(() => {
    db.prepare('UPDATE users SET invite_code = ?, updated_at = ? WHERE id = ?').run(code, now, userId);
    db.prepare('UPDATE invite_codes SET use_count = use_count + 1, used_at = ? WHERE code = ?').run(now, code);
    // Auto-generate 6 invite codes for the newly activated user
    generateUserInviteCodes(userId);
  })();

  // Award coins to the invite code creator
  const inviteDetail = db.prepare('SELECT created_by FROM invite_codes WHERE code = ?').get(code) as { created_by: string } | undefined;
  if (inviteDetail?.created_by && inviteDetail.created_by !== 'system') {
    addCoins(inviteDetail.created_by, 'reputation', USER_REP_EVENTS.invite_user, 'invite_user', userId);
    addCoins(inviteDetail.created_by, 'shrimp_coin', SHRIMP_COIN_EVENTS.invite_user, 'invite_user', userId);
  }

  return { success: true };
}

export function validateInviteCode(code: string): { valid: boolean; error?: string } {
  const invite = getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as { code: string; max_uses: number; use_count: number; expires_at: string | null } | undefined;
  if (!invite) return { valid: false, error: '邀请码不存在' };
  if (invite.use_count >= invite.max_uses) return { valid: false, error: '邀请码已用完' };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { valid: false, error: '邀请码已过期' };
  return { valid: true };
}

// ════════════════════════════════════════════
// Invite Code System — Generate / Query / Admin
// ════════════════════════════════════════════

/** Generate a random 7-char uppercase letter invite code */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface InviteCode {
  code: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: string | null;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  type: string;
  createdAt: string;
}

interface DbInviteCode {
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  type: string;
  created_at: string;
}

function dbInviteToInvite(row: DbInviteCode): InviteCode {
  return {
    code: row.code,
    createdBy: row.created_by,
    usedBy: row.used_by,
    usedAt: row.used_at,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    type: row.type,
    createdAt: row.created_at,
  };
}

/** Generate 6 one-time invite codes for a user (called after activation) */
export function generateUserInviteCodes(userId: string): string[] {
  const db = getDb();
  const now = new Date().toISOString();
  const codes: string[] = [];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, ?, 1, 0, 'normal', ?)`
  );
  let attempts = 0;
  while (codes.length < 6 && attempts < 30) {
    const code = generateInviteCode();
    const result = insert.run(code, userId, now);
    if (result.changes > 0) {
      codes.push(code);
    }
    attempts++;
  }
  return codes;
}

/** Get all invite codes created by a user */
export function getUserInviteCodes(userId: string): InviteCode[] {
  const rows = getDb().prepare('SELECT * FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC').all(userId) as DbInviteCode[];
  return rows.map(dbInviteToInvite);
}

/** Create a super invite code (admin) */
export function createSuperInviteCode(code: string, maxUses: number, createdBy: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, ?, ?, 0, 'super', ?)`
    ).run(code, createdBy, maxUses, now);
    return true;
  } catch {
    return false; // code already exists
  }
}

/** Get invite code detail */
export function getInviteCodeDetail(code: string): InviteCode | null {
  const row = getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as DbInviteCode | undefined;
  return row ? dbInviteToInvite(row) : null;
}

/** List all invite codes (admin, with pagination and optional type filter) */
export function listAllInviteCodes(params?: { type?: string; page?: number; pageSize?: number }): { codes: InviteCode[]; total: number } {
  const db = getDb();
  const conditions: string[] = [];
  const bindings: Record<string, string | number> = {};

  if (params?.type) {
    conditions.push('type = @type');
    bindings.type = params.type;
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM invite_codes ${where}`).get(bindings) as { cnt: number }).cnt;

  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(`SELECT * FROM invite_codes ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`).all({ ...bindings, limit: pageSize, offset }) as DbInviteCode[];
  return { codes: rows.map(dbInviteToInvite), total };
}

/** Delete an invite code (admin) */
export function deleteInviteCode(code: string): boolean {
  return getDb().prepare('DELETE FROM invite_codes WHERE code = ?').run(code).changes > 0;
}

/** Check if a user has activated an invite code (has publish/comment access) */
export function userHasInviteAccess(userId: string): boolean {
  const user = findUserById(userId);
  return !!user?.invite_code;
}

// ════════════════════════════════════════════
// Public API — Authorized Devices
// ════════════════════════════════════════════

export function authorizeDevice(userId: string, deviceId: string, name: string = ''): boolean {
  const now = new Date().toISOString();
  getDb().prepare('INSERT OR REPLACE INTO authorized_devices (device_id, user_id, name, authorized_at) VALUES (?, ?, ?, ?)').run(deviceId, userId, name, now);
  return true;
}

export function validateDevice(deviceId: string): { userId: string; name: string } | null {
  const row = getDb().prepare('SELECT user_id, name FROM authorized_devices WHERE device_id = ?').get(deviceId) as { user_id: string; name: string } | undefined;
  if (!row) return null;
  getDb().prepare('UPDATE authorized_devices SET last_publish_at = ? WHERE device_id = ?').run(new Date().toISOString(), deviceId);
  return { userId: row.user_id, name: row.name };
}

export function listAuthorizedDevices(userId: string): { deviceId: string; name: string; authorizedAt: string; lastPublishAt: string | null }[] {
  const rows = getDb().prepare('SELECT device_id, name, authorized_at, last_publish_at FROM authorized_devices WHERE user_id = ?').all(userId) as { device_id: string; name: string; authorized_at: string; last_publish_at: string | null }[];
  return rows.map(r => ({
    deviceId: r.device_id.slice(0, 12) + '...',
    name: r.name,
    authorizedAt: r.authorized_at,
    lastPublishAt: r.last_publish_at,
  }));
}

export function revokeDevice(deviceId: string, userId: string): boolean {
  const result = getDb().prepare('DELETE FROM authorized_devices WHERE device_id = ? AND user_id = ?').run(deviceId, userId);
  return result.changes > 0;
}

// ════════════════════════════════════════════
// Public API — User Profiles
// ════════════════════════════════════════════

export interface DbUserProfile {
  id: string; name: string; avatar: string; bio: string; joined_at: string;
  published_assets: string; favorite_assets: string;
  followers: number; following: number; is_agent: number;
  agent_model: string | null; agent_uptime: string | null; agent_tasks_completed: number;
  agent_specialization: string | null; contribution_points: number;
  contributor_level: string; instance_id: string | null;
}

function profileRowToUser(row: DbUserProfile): User {
  const isAgent = !!row.is_agent;
  return {
    id: row.id, name: row.name, avatar: row.avatar, bio: row.bio, joinedAt: row.joined_at,
    publishedAssets: JSON.parse(row.published_assets),
    favoriteAssets: JSON.parse(row.favorite_assets),
    followers: row.followers, following: row.following, isAgent: isAgent,
    agentConfig: isAgent ? {
      model: row.agent_model || '', uptime: row.agent_uptime || '',
      tasksCompleted: row.agent_tasks_completed,
      specialization: row.agent_specialization ? JSON.parse(row.agent_specialization) : [],
    } : undefined,
    contributionPoints: row.contribution_points,
    contributorLevel: row.contributor_level as User['contributorLevel'],
    instanceId: row.instance_id ?? undefined,
  };
}

export function getUserProfile(id: string): User | null {
  const row = getDb().prepare('SELECT * FROM user_profiles WHERE id = ?').get(id) as DbUserProfile | undefined;
  return row ? profileRowToUser(row) : null;
}

export function listUserProfiles(): User[] {
  const rows = getDb().prepare('SELECT * FROM user_profiles ORDER BY followers DESC').all() as DbUserProfile[];
  return rows.map(profileRowToUser);
}

export function searchUserProfiles(query: string): User[] {
  const rows = getDb().prepare('SELECT * FROM user_profiles WHERE name LIKE ? OR bio LIKE ? ORDER BY followers DESC').all(`%${query}%`, `%${query}%`) as DbUserProfile[];
  return rows.map(profileRowToUser);
}

export function getAgentUserProfiles(): User[] {
  const rows = getDb().prepare('SELECT * FROM user_profiles WHERE is_agent = 1 ORDER BY followers DESC').all() as DbUserProfile[];
  return rows.map(profileRowToUser);
}

export function listUserProfileIds(): string[] {
  const rows = getDb().prepare('SELECT id FROM user_profiles').all() as { id: string }[];
  return rows.map(r => r.id);
}

// ════════════════════════════════════════════
// Public API — Comments
// ════════════════════════════════════════════

interface DbComment {
  id: string; asset_id: string; user_id: string; user_name: string; user_avatar: string;
  content: string; rating: number; created_at: string; commenter_type: string;
}

function commentRowToComment(row: DbComment) {
  return {
    id: row.id, assetId: row.asset_id, userId: row.user_id, userName: row.user_name,
    userAvatar: row.user_avatar, content: row.content, rating: row.rating,
    createdAt: row.created_at, commenterType: row.commenter_type as 'user' | 'agent',
  };
}

export function getCommentsByAssetId(assetId: string) {
  const rows = getDb().prepare('SELECT * FROM comments WHERE asset_id = ? ORDER BY created_at DESC').all(assetId) as DbComment[];
  return rows.map(commentRowToComment);
}

export function createComment(data: { assetId: string; userId: string; userName: string; userAvatar: string; content: string; rating: number; commenterType?: string }) {
  const db = getDb();
  const id = 'cm-' + Math.random().toString(36).substring(2, 8);
  const now = new Date().toISOString().split('T')[0];
  db.prepare(`INSERT INTO comments (id,asset_id,user_id,user_name,user_avatar,content,rating,created_at,commenter_type) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, data.assetId, data.userId, data.userName, data.userAvatar, data.content, data.rating, now, data.commenterType ?? 'user');

  // Award coins to commenter
  addCoins(data.userId, 'reputation', USER_REP_EVENTS.write_comment, 'write_comment', data.assetId);
  addCoins(data.userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.write_comment, 'write_comment', data.assetId);

  // Award coins to asset author for receiving a comment/rating
  const asset = db.prepare('SELECT author_id FROM assets WHERE id = ?').get(data.assetId) as { author_id: string } | undefined;
  if (asset?.author_id && asset.author_id !== data.userId) {
    if (data.rating >= 4) {
      addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_rated_good, 'asset_rated_good', data.assetId);
    }
    if (data.rating === 5) {
      addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_rated_5star, 'asset_rated_5star', data.assetId);
    }
  }

  // Recalculate hub score after rating
  recalculateHubScore(data.assetId);

  return { id, ...data, createdAt: now };
}

export function getCommentCount(assetId: string): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM comments WHERE asset_id = ?').get(assetId) as { cnt: number }).cnt;
}

// ════════════════════════════════════════════
// Public API — Issues
// ════════════════════════════════════════════

interface DbIssue {
  id: string; asset_id: string; author_id: string; author_name: string; author_avatar: string;
  author_type: string; title: string; body: string; status: string;
  labels: string; created_at: string; comment_count: number;
}

function issueRowToIssue(row: DbIssue) {
  return {
    id: row.id, assetId: row.asset_id, authorId: row.author_id, authorName: row.author_name,
    authorAvatar: row.author_avatar, authorType: row.author_type as 'user' | 'agent',
    title: row.title, body: row.body, status: row.status as 'open' | 'closed',
    labels: JSON.parse(row.labels) as string[], createdAt: row.created_at,
    commentCount: row.comment_count,
  };
}

export function getIssuesByAssetId(assetId: string) {
  const rows = getDb().prepare('SELECT * FROM issues WHERE asset_id = ? ORDER BY created_at DESC').all(assetId) as DbIssue[];
  return rows.map(issueRowToIssue);
}

export function createIssue(data: { assetId: string; authorId: string; authorName: string; authorAvatar: string; authorType?: string; title: string; body: string; labels?: string[] }) {
  const db = getDb();
  const id = 'is-' + Math.random().toString(36).substring(2, 8);
  const now = new Date().toISOString().split('T')[0];
  db.prepare(`INSERT INTO issues (id,asset_id,author_id,author_name,author_avatar,author_type,title,body,status,labels,created_at,comment_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.assetId, data.authorId, data.authorName, data.authorAvatar, data.authorType ?? 'user', data.title, data.body, 'open', JSON.stringify(data.labels ?? []), now, 0);

  // Award coins to issue submitter
  addCoins(data.authorId, 'reputation', USER_REP_EVENTS.submit_issue, 'submit_issue', data.assetId);
  addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.submit_issue, 'submit_issue', data.assetId);

  return { id, ...data, status: 'open', createdAt: now, commentCount: 0 };
}

export function searchIssues(query: string) {
  const rows = getDb().prepare('SELECT * FROM issues WHERE title LIKE ? OR body LIKE ? ORDER BY created_at DESC').all(`%${query}%`, `%${query}%`) as DbIssue[];
  return rows.map(issueRowToIssue);
}

export function getIssueCount(assetId: string): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM issues WHERE asset_id = ?').get(assetId) as { cnt: number }).cnt;
}

// ════════════════════════════════════════════
// Public API — Collections
// ════════════════════════════════════════════

interface DbCollection {
  id: string; title: string; description: string; curator_id: string;
  curator_name: string; curator_avatar: string; asset_ids: string;
  cover_emoji: string; followers: number; created_at: string;
}

function collectionRowToCollection(row: DbCollection) {
  return {
    id: row.id, title: row.title, description: row.description,
    curatorId: row.curator_id, curatorName: row.curator_name, curatorAvatar: row.curator_avatar,
    assetIds: JSON.parse(row.asset_ids) as string[], coverEmoji: row.cover_emoji,
    followers: row.followers, createdAt: row.created_at,
  };
}

export function getCollections() {
  const rows = getDb().prepare('SELECT * FROM collections ORDER BY followers DESC').all() as DbCollection[];
  return rows.map(collectionRowToCollection);
}

export function searchCollections(query: string) {
  const rows = getDb().prepare('SELECT * FROM collections WHERE title LIKE ? OR description LIKE ? ORDER BY followers DESC').all(`%${query}%`, `%${query}%`) as DbCollection[];
  return rows.map(collectionRowToCollection);
}

// ════════════════════════════════════════════
// Public API — Notifications
// ════════════════════════════════════════════

interface DbNotification {
  id: string; user_id: string; type: string; title: string; message: string;
  icon: string; link_to: string | null; is_read: number; created_at: string;
}

function notifRowToNotif(row: DbNotification) {
  return {
    id: row.id, type: row.type as 'comment' | 'issue' | 'download' | 'follower',
    title: row.title, message: row.message, icon: row.icon,
    linkTo: row.link_to ?? undefined, read: !!row.is_read, createdAt: row.created_at,
  };
}

export function getNotifications(userId: string = 'self') {
  const rows = getDb().prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId) as DbNotification[];
  return rows.map(notifRowToNotif);
}

export function markNotificationRead(id: string) {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}

export function markAllRead(userId: string = 'self') {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
}

// ════════════════════════════════════════════
// Public API — Evolution & Activity Events
// ════════════════════════════════════════════

interface DbEvolutionEvent {
  id: string; user_id: string; icon: string; title: string;
  description: string; date: string; type: string;
}

export function getEvolutionEventsByUserId(userId: string) {
  const rows = getDb().prepare('SELECT * FROM evolution_events WHERE user_id = ? ORDER BY date ASC').all(userId) as DbEvolutionEvent[];
  return rows.map(r => ({ id: r.id, userId: r.user_id, icon: r.icon, title: r.title, description: r.description, date: r.date, type: r.type }));
}

interface DbActivityEvent {
  id: string; user_id: string; icon: string; text: string;
  date: string; type: string; link_to: string | null; actor_type: string;
}

export function getActivityEventsByUserId(userId: string) {
  const rows = getDb().prepare('SELECT * FROM activity_events WHERE user_id = ? ORDER BY date DESC').all(userId) as DbActivityEvent[];
  return rows.map(r => ({ id: r.id, userId: r.user_id, icon: r.icon, text: r.text, date: r.date, type: r.type, linkTo: r.link_to ?? undefined, actorType: r.actor_type as 'user' | 'agent' }));
}

// ════════════════════════════════════════════
// Public API — Growth / Stats
// ════════════════════════════════════════════

export function getGrowthData() {
  const rows = getDb().prepare('SELECT * FROM daily_stats ORDER BY day ASC').all() as { day: number; downloads: number; new_assets: number; new_users: number }[];
  return rows.map(r => ({ day: r.day, downloads: r.downloads, newAssets: r.new_assets, newUsers: r.new_users }));
}

export interface StatsData {
  totalAssets: number; totalDevelopers: number; totalDownloads: number; weeklyNew: number;
  topDevelopers: { id: string; name: string; avatar: string; assetCount: number; totalDownloads: number }[];
  recentActivity: { type: 'publish' | 'update'; authorName: string; authorAvatar: string; assetName: string; assetDisplayName: string; version: string; timestamp: string }[];
}

export function getStats(): StatsData {
  const db = getDb();
  const totalAssets = (db.prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number }).cnt;
  const totalDevelopers = (db.prepare("SELECT COUNT(DISTINCT author_id) as cnt FROM assets WHERE author_id != ''").get() as { cnt: number }).cnt;
  const totalDownloads = (db.prepare('SELECT COALESCE(SUM(downloads), 0) as total FROM assets').get() as { total: number }).total;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weeklyNew = (db.prepare('SELECT COUNT(*) as cnt FROM assets WHERE created_at >= ?').get(sevenDaysAgo) as { cnt: number }).cnt;

  const topDevelopers = db.prepare(`SELECT author_id as id, author_name as name, author_avatar as avatar, COUNT(*) as assetCount, COALESCE(SUM(downloads),0) as totalDownloads FROM assets WHERE author_id != '' GROUP BY author_id ORDER BY totalDownloads DESC LIMIT 10`).all() as { id: string; name: string; avatar: string; assetCount: number; totalDownloads: number }[];

  const recentRows = db.prepare(`SELECT name, display_name, author_name, author_avatar, version, created_at, updated_at FROM assets ORDER BY updated_at DESC LIMIT 20`).all() as { name: string; display_name: string; author_name: string; author_avatar: string; version: string; created_at: string; updated_at: string }[];
  const recentActivity = recentRows.map(row => ({
    type: (row.created_at === row.updated_at ? 'publish' : 'update') as 'publish' | 'update',
    authorName: row.author_name, authorAvatar: row.author_avatar,
    assetName: row.name, assetDisplayName: row.display_name,
    version: row.version, timestamp: row.updated_at,
  }));

  return { totalAssets, totalDevelopers, totalDownloads, weeklyNew, topDevelopers, recentActivity };
}

export function getAssetCountByType(): Record<string, number> {
  const rows = getDb().prepare('SELECT type, COUNT(*) as cnt FROM assets GROUP BY type').all() as { type: string; cnt: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) result[row.type] = row.cnt;
  return result;
}

export function getTotalCommentCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM comments').get() as { cnt: number }).cnt;
}

export function getTotalIssueCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM issues').get() as { cnt: number }).cnt;
}

export function getTotalUserCount(): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM user_profiles').get() as { cnt: number }).cnt;
}

// ════════════════════════════════════════════
// V1 API helpers
// ════════════════════════════════════════════

export interface AssetCompact {
  id: string; name: string; displayName: string; type: string;
  description: string; tags: string[]; installs: number; rating: number;
  author: string; authorId: string; version: string;
  installCommand: string; updatedAt: string; category: string;
}

export function listAssetsCompact(params: ListParams & { tag?: string }): { assets: AssetCompact[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const conditions: string[] = [];
  const bindings: Record<string, string | number> = {};

  if (params.type && ['skill','config','plugin','trigger','channel','template'].includes(params.type)) {
    conditions.push('type = @type'); bindings.type = params.type;
  }
  if (params.category) { conditions.push('category = @category'); bindings.category = params.category; }
  if (params.tag) {
    conditions.push('tags LIKE @tag');
    bindings.tag = `%"${params.tag}"%`;
  }
  if (params.q) {
    conditions.push(`(name LIKE @q OR display_name LIKE @q OR description LIKE @q OR tags LIKE @q)`);
    bindings.q = `%${params.q}%`;
  }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM assets ${where}`).get(bindings) as { cnt: number }).cnt;

  let orderBy: string;
  switch (params.sort) {
    case 'installs': case 'downloads': orderBy = 'downloads DESC'; break;
    case 'rating': orderBy = 'rating DESC'; break;
    case 'newest': case 'updated_at': orderBy = 'updated_at DESC'; break;
    case 'created_at': orderBy = 'created_at DESC'; break;
    default: orderBy = 'downloads DESC, updated_at DESC';
  }
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`).all({ ...bindings, limit: pageSize, offset }) as {
    id: string; name: string; display_name: string; type: string; description: string;
    tags: string; downloads: number; rating: number; author_name: string; author_id: string;
    version: string; install_command: string; updated_at: string; category: string;
  }[];

  return {
    assets: rows.map(r => ({
      id: r.id, name: r.name, displayName: r.display_name, type: r.type,
      description: r.description, tags: JSON.parse(r.tags), installs: r.downloads,
      rating: r.rating, author: r.author_name, authorId: r.author_id, version: r.version,
      installCommand: r.install_command, updatedAt: r.updated_at, category: r.category,
    })),
    total, page, pageSize,
  };
}

export function getAllTags(): { name: string; count: number }[] {
  const db = getDb();
  const rows = db.prepare('SELECT tags FROM assets').all() as { tags: string }[];
  const tagMap = new Map<string, number>();
  for (const row of rows) {
    const tags = JSON.parse(row.tags) as string[];
    for (const t of tags) {
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    }
  }
  return [...tagMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function getAllCategories(): { name: string; count: number }[] {
  const rows = getDb().prepare("SELECT category, COUNT(*) as cnt FROM assets WHERE category != '' GROUP BY category ORDER BY cnt DESC").all() as { category: string; cnt: number }[];
  return rows.map(r => ({ name: r.category, count: r.cnt }));
}

export function getAssetManifest(id: string): { id: string; manifest: Record<string, unknown> } | null {
  const row = getDb().prepare('SELECT id, manifest FROM assets WHERE id = ?').get(id) as { id: string; manifest: string } | undefined;
  if (!row) return null;
  return { id: row.id, manifest: JSON.parse(row.manifest || '{}') };
}

export function updateAssetManifest(id: string, manifest: Record<string, unknown>): boolean {
  return getDb().prepare('UPDATE assets SET manifest = ? WHERE id = ?').run(JSON.stringify(manifest), id).changes > 0;
}

export function getAssetReadme(id: string): { name: string; displayName: string; readme: string; version: string } | null {
  const row = getDb().prepare('SELECT name, display_name, readme, version FROM assets WHERE id = ?').get(id) as { name: string; display_name: string; readme: string; version: string } | undefined;
  if (!row) return null;
  return { name: row.name, displayName: row.display_name, readme: row.readme, version: row.version };
}

export function getAssetsByIds(ids: string[]): AssetCompact[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets WHERE id IN (${placeholders})`).all(...ids) as {
    id: string; name: string; display_name: string; type: string; description: string;
    tags: string; downloads: number; rating: number; author_name: string; author_id: string;
    version: string; install_command: string; updated_at: string; category: string;
  }[];
  return rows.map(r => ({
    id: r.id, name: r.name, displayName: r.display_name, type: r.type,
    description: r.description, tags: JSON.parse(r.tags), installs: r.downloads,
    rating: r.rating, author: r.author_name, authorId: r.author_id, version: r.version,
    installCommand: r.install_command, updatedAt: r.updated_at, category: r.category,
  }));
}

export function getTrendingAssets(period: string, limit: number = 10): AssetCompact[] {
  const db = getDb();
  // For now, trending = most downloads. With more data, could use time-windowed installs.
  const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets ORDER BY downloads DESC, updated_at DESC LIMIT ?`).all(Math.min(limit, 50)) as {
    id: string; name: string; display_name: string; type: string; description: string;
    tags: string; downloads: number; rating: number; author_name: string; author_id: string;
    version: string; install_command: string; updated_at: string; category: string;
  }[];
  return rows.map(r => ({
    id: r.id, name: r.name, displayName: r.display_name, type: r.type,
    description: r.description, tags: JSON.parse(r.tags), installs: r.downloads,
    rating: r.rating, author: r.author_name, authorId: r.author_id, version: r.version,
    installCommand: r.install_command, updatedAt: r.updated_at, category: r.category,
  }));
}
