import Database from 'better-sqlite3';
import path from 'path';
import {
  assets as mockAssets, Asset, User,
  users as mockUsers,
  comments as mockComments,
  issues as mockIssues,
  collections as mockCollections,
  mockNotifications,
  evolutionEvents as mockEvolutionEvents,
  activityEvents as mockActivityEvents,
  growthData as mockGrowthData,
} from '@/data/mock';

const DB_PATH = path.join(process.cwd(), 'data', 'hub.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initTables(_db);
    seedIfEmpty(_db);
  }
  return _db;
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
      max_uses INTEGER DEFAULT 1, use_count INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL
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
    CREATE TABLE IF NOT EXISTS daily_stats (
      day INTEGER PRIMARY KEY, downloads INTEGER NOT NULL DEFAULT 0,
      new_assets INTEGER NOT NULL DEFAULT 0, new_users INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed invite codes if empty
  const inviteCount = db.prepare('SELECT COUNT(*) as cnt FROM invite_codes').get() as { cnt: number };
  if (inviteCount.cnt === 0) {
    const now = new Date().toISOString();
    const insertCode = db.prepare(`INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, created_at) VALUES (?, 'system', ?, 0, ?)`);
    for (const c of [{ code: 'SEAFOOD-2026', m: 100 }, { code: 'CYBERNOVA-VIP', m: 100 }, { code: 'AGENT-HUB-BETA', m: 100 }]) {
      insertCode.run(c.code, c.m, now);
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
    hubScore: row.hub_score, hubScoreBreakdown: JSON.parse(row.hub_score_breakdown),
    upgradeRate: row.upgrade_rate,
  };
}

function assetToRow(a: Asset) {
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
    hub_score: a.hubScore ?? 70, hub_score_breakdown: JSON.stringify(a.hubScoreBreakdown ?? {}),
    upgrade_rate: a.upgradeRate ?? 50, compatibility: JSON.stringify(a.compatibility ?? {}),
  };
}

const FS_EVENT_TRIGGER_ASSET: Asset = {
  id: 's-fsevent', name: 'fs-event-trigger', displayName: '📂 FS Event Trigger', type: 'skill',
  author: { id: 'u1', name: 'CyberNova', avatar: '🤖' },
  description: '文件系统事件监听 — 监控目录变化，自动触发 Agent 动作',
  longDescription: '', version: '1.0.0', downloads: 0, rating: 0, ratingCount: 0,
  tags: ['filesystem','watcher','automation','hooks','trigger'], category: '系统工具',
  createdAt: '2026-02-20', updatedAt: '2026-02-20',
  installCommand: 'seafood-market install skill/@u1/fs-event-trigger',
  readme: '# FS Event Trigger',
  versions: [{ version: '1.0.0', changelog: '首次发布', date: '2026-02-20' }],
  dependencies: [], compatibility: { models: ['GPT-4','Claude 3'], platforms: ['OpenClaw'], frameworks: ['Node.js'] },
  issueCount: 0, hubScore: 65,
  hubScoreBreakdown: { downloadScore: 0, maintenanceScore: 100, reputationScore: 0 }, upgradeRate: 25,
};

// ════════════════════════════════════════════
// Seed all tables from mock data
// ════════════════════════════════════════════

function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number };
  if (count.cnt > 0) return;

  // Assets
  const insertAsset = db.prepare(`INSERT INTO assets (id,name,display_name,type,author_id,author_name,author_avatar,description,long_description,version,downloads,rating,rating_count,tags,category,created_at,updated_at,install_command,readme,versions,dependencies,issue_count,config_subtype,hub_score,hub_score_breakdown,upgrade_rate,compatibility,files) VALUES (@id,@name,@display_name,@type,@author_id,@author_name,@author_avatar,@description,@long_description,@version,@downloads,@rating,@rating_count,@tags,@category,@created_at,@updated_at,@install_command,@readme,@versions,@dependencies,@issue_count,@config_subtype,@hub_score,@hub_score_breakdown,@upgrade_rate,@compatibility,@files)`);
  db.transaction(() => { for (const a of [...mockAssets, FS_EVENT_TRIGGER_ASSET]) insertAsset.run(assetToRow(a)); })();

  // User profiles (deduplicate)
  const seenIds = new Set<string>();
  const uniqUsers = mockUsers.filter(u => { if (seenIds.has(u.id)) return false; seenIds.add(u.id); return true; });
  const insUser = db.prepare(`INSERT OR IGNORE INTO user_profiles (id,name,avatar,bio,joined_at,published_assets,favorite_assets,followers,following,is_agent,agent_model,agent_uptime,agent_tasks_completed,agent_specialization,contribution_points,contributor_level,instance_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => {
    for (const u of uniqUsers) {
      insUser.run(u.id, u.name, u.avatar, u.bio, u.joinedAt,
        JSON.stringify(u.publishedAssets), JSON.stringify(u.favoriteAssets),
        u.followers, u.following, u.isAgent ? 1 : 0,
        u.agentConfig?.model ?? null, u.agentConfig?.uptime ?? null,
        u.agentConfig?.tasksCompleted ?? 0,
        u.agentConfig?.specialization ? JSON.stringify(u.agentConfig.specialization) : null,
        u.contributionPoints ?? 0, u.contributorLevel ?? 'newcomer', u.instanceId ?? null);
    }
  })();

  // Comments
  const insComment = db.prepare(`INSERT OR IGNORE INTO comments (id,asset_id,user_id,user_name,user_avatar,content,rating,created_at,commenter_type) VALUES (?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => { for (const c of mockComments) insComment.run(c.id, c.assetId, c.userId, c.userName, c.userAvatar, c.content, c.rating, c.createdAt, c.commenterType); })();

  // Issues
  const insIssue = db.prepare(`INSERT OR IGNORE INTO issues (id,asset_id,author_id,author_name,author_avatar,author_type,title,body,status,labels,created_at,comment_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => { for (const i of mockIssues) insIssue.run(i.id, i.assetId, i.authorId, i.authorName, i.authorAvatar, i.authorType, i.title, i.body, i.status, JSON.stringify(i.labels), i.createdAt, i.commentCount); })();

  // Collections
  const insCol = db.prepare(`INSERT OR IGNORE INTO collections (id,title,description,curator_id,curator_name,curator_avatar,asset_ids,cover_emoji,followers,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => { for (const c of mockCollections) insCol.run(c.id, c.title, c.description, c.curatorId, c.curatorName, c.curatorAvatar, JSON.stringify(c.assetIds), c.coverEmoji, c.followers, c.createdAt); })();

  // Notifications
  const insNotif = db.prepare(`INSERT OR IGNORE INTO notifications (id,user_id,type,title,message,icon,link_to,is_read,created_at) VALUES (?,?,?,?,?,?,?,?,?)`);
  db.transaction(() => { for (const n of mockNotifications) insNotif.run(n.id, 'self', n.type, n.title, n.message, n.icon, n.linkTo ?? null, n.read ? 1 : 0, n.createdAt); })();

  // Evolution events
  const insEvo = db.prepare(`INSERT OR IGNORE INTO evolution_events (id,user_id,icon,title,description,date,type) VALUES (?,?,?,?,?,?,?)`);
  db.transaction(() => { for (const e of mockEvolutionEvents) insEvo.run(e.id, e.userId, e.icon, e.title, e.description, e.date, e.type); })();

  // Activity events
  const insAct = db.prepare(`INSERT OR IGNORE INTO activity_events (id,user_id,icon,text,date,type,link_to,actor_type) VALUES (?,?,?,?,?,?,?,?)`);
  db.transaction(() => { for (const a of mockActivityEvents) insAct.run(a.id, a.userId, a.icon, a.text, a.date, a.type, a.linkTo ?? null, a.actorType); })();

  // Daily stats
  const insStat = db.prepare(`INSERT OR IGNORE INTO daily_stats (day,downloads,new_assets,new_users) VALUES (?,?,?,?)`);
  db.transaction(() => { for (const d of mockGrowthData) insStat.run(d.day, d.downloads, d.newAssets, d.newUsers); })();
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
    hubScore: 65, hubScoreBreakdown: { downloadScore: 0, maintenanceScore: 100, reputationScore: 0 }, upgradeRate: 25,
  };
  db.prepare(`INSERT INTO assets (id,name,display_name,type,author_id,author_name,author_avatar,description,long_description,version,downloads,rating,rating_count,tags,category,created_at,updated_at,install_command,readme,versions,dependencies,issue_count,config_subtype,hub_score,hub_score_breakdown,upgrade_rate,compatibility,files) VALUES (@id,@name,@display_name,@type,@author_id,@author_name,@author_avatar,@description,@long_description,@version,@downloads,@rating,@rating_count,@tags,@category,@created_at,@updated_at,@install_command,@readme,@versions,@dependencies,@issue_count,@config_subtype,@hub_score,@hub_score_breakdown,@upgrade_rate,@compatibility,@files)`).run(assetToRow(asset));
  return asset;
}

export function updateAsset(id: string, data: Partial<{
  name: string; displayName: string; description: string; longDescription: string;
  version: string; tags: string[]; category: string; readme: string;
  authorId: string; authorName: string; authorAvatar: string;
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
}

export function findUserByProvider(provider: string, providerId: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId) as DbUser | undefined) ?? null;
}

export function findUserById(id: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined) ?? null;
}

export function createUser(data: { id: string; email: string | null; name: string; avatar: string; provider: string; providerId: string; }): DbUser {
  const now = new Date().toISOString();
  getDb().prepare(`INSERT INTO users (id,email,name,avatar,provider,provider_id,bio,invite_code,created_at,updated_at) VALUES (?,?,?,?,?,?,'',NULL,?,?)`).run(data.id, data.email, data.name, data.avatar, data.provider, data.providerId, now, now);
  return findUserById(data.id)!;
}

export function softDeleteUser(id: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id).changes > 0;
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
  })();
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
  const totalDevelopers = (db.prepare('SELECT COUNT(DISTINCT author_id) as cnt FROM assets').get() as { cnt: number }).cnt;
  const totalDownloads = (db.prepare('SELECT COALESCE(SUM(downloads), 0) as total FROM assets').get() as { total: number }).total;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weeklyNew = (db.prepare('SELECT COUNT(*) as cnt FROM assets WHERE created_at >= ?').get(sevenDaysAgo) as { cnt: number }).cnt;

  const topDevelopers = db.prepare(`SELECT author_id as id, author_name as name, author_avatar as avatar, COUNT(*) as assetCount, COALESCE(SUM(downloads),0) as totalDownloads FROM assets GROUP BY author_id ORDER BY totalDownloads DESC LIMIT 10`).all() as { id: string; name: string; avatar: string; assetCount: number; totalDownloads: number }[];

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