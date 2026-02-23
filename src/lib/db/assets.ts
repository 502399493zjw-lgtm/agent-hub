/**
 * db/assets.ts — Asset CRUD operations.
 */
import crypto from 'crypto';
import { Asset, User } from '@/data/types';
import { getDb } from './connection';
import { calculateHubScore } from './economy';
import { addCoins, USER_REP_EVENTS, SHRIMP_COIN_EVENTS, hasEnoughCoins } from './economy';
import { getCached } from '../cache';

// ════════════════════════════════════════════
// Safe JSON.parse wrapper
// ════════════════════════════════════════════

function safeParse(str: string, fallback: unknown = []) {
  try { return JSON.parse(str); } catch { return fallback; }
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
  user_star_count?: number;
}

export function rowToAsset(row: DbRow): Asset {
  const userStars = row.user_star_count ?? 0;
  const totalStars = (row.github_stars || 0) + userStars;
  return {
    id: row.id, name: row.name, displayName: row.display_name,
    type: row.type as Asset['type'],
    author: { id: row.author_id || ('u-' + row.author_name.toLowerCase().replace(/\s+/g, '-')), name: row.author_name, avatar: row.author_avatar },
    description: row.description, longDescription: row.long_description, version: row.version,
    downloads: row.downloads, rating: row.rating, ratingCount: row.rating_count,
    tags: safeParse(row.tags, []) as string[], category: row.category,
    createdAt: row.created_at, updatedAt: row.updated_at,
    installCommand: row.install_command, readme: row.readme,
    versions: safeParse(row.versions, []), dependencies: safeParse(row.dependencies, []),
    compatibility: safeParse(row.compatibility, {}), issueCount: row.issue_count,
    files: safeParse(row.files || '[]', []),
    configSubtype: (row.config_subtype ?? undefined) as Asset['configSubtype'],
    githubUrl: row.github_url || undefined,
    githubStars: row.github_stars || undefined,
    githubForks: row.github_forks || undefined,
    githubLanguage: row.github_language || undefined,
    githubLicense: row.github_license || undefined,
    userStars,
    totalStars,
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
// FTS5 Search Helpers
// ════════════════════════════════════════════

/** Escape special FTS5 query characters for safe user input */
function escapeFts5Query(input: string): string {
  // Remove/escape FTS5 special characters: " * OR AND NOT NEAR ( )
  // Wrap each token in double quotes to treat as literal
  const cleaned = input
    .replace(/"/g, '')     // remove double quotes
    .replace(/\*/g, '')    // remove wildcards
    .trim();
  if (!cleaned) return '';
  // Split into tokens and wrap each in quotes for exact matching
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.map(t => `"${t}"`).join(' ');
}

/** Check if FTS5 table has content (i.e., triggers are working) */
function ftsHasContent(): boolean {
  try {
    const row = getDb().prepare('SELECT COUNT(*) as cnt FROM assets_fts').get() as { cnt: number };
    return row.cnt > 0;
  } catch {
    return false;
  }
}

// ════════════════════════════════════════════
// Public API — Assets
// ════════════════════════════════════════════

export interface ListParams {
  type?: string; category?: string; q?: string; sort?: string; page?: number; pageSize?: number; authorId?: string;
}

export function listAssets(params: ListParams): { assets: Asset[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const conditions: string[] = [];
  const bindings: Record<string, string | number> = {};
  let usingFtsRelevance = false;

  if (params.type && ['skill','experience','plugin','trigger','channel','template'].includes(params.type)) {
    conditions.push('a.type = @type'); bindings.type = params.type;
  }
  if (params.authorId) { conditions.push('a.author_id = @authorId'); bindings.authorId = params.authorId; }
  if (params.category) { conditions.push('a.category = @category'); bindings.category = params.category; }
  if (params.q) {
    // Try FTS5 search first, fall back to LIKE
    const ftsQuery = escapeFts5Query(params.q);
    if (ftsQuery && ftsHasContent()) {
      conditions.push(`a.rowid IN (SELECT rowid FROM assets_fts WHERE assets_fts MATCH @q)`);
      bindings.q = ftsQuery;
      usingFtsRelevance = true;
    } else {
      conditions.push(`(a.name LIKE @q ESCAPE '\\' OR a.display_name LIKE @q ESCAPE '\\' OR a.description LIKE @q ESCAPE '\\' OR a.tags LIKE @q ESCAPE '\\')`);
      const escaped = params.q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      bindings.q = `%${escaped}%`;
    }
  }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM assets a ${where}`).get(bindings) as { cnt: number }).cnt;

  let orderBy: string;
  switch (params.sort) {
    case 'newest': orderBy = 'a.updated_at DESC'; break;
    case 'popular':
    default:
      // 综合热度：下载量(对数衰减)*3 + github_stars(对数衰减,权重=下载的10%)*0.3 + 站内收藏*2 + 中文+30
      orderBy = '(ln(a.downloads + 2) / ln(2) * 3 + ln(a.github_stars + 2) / ln(2) * 0.3 + COALESCE(us.cnt, 0) * 2 + CASE WHEN has_chinese(a.display_name) OR has_chinese(a.description) OR has_chinese(a.readme) OR has_chinese(a.author_name) THEN 30 ELSE 0 END) DESC, a.updated_at DESC';
      break;
  }

  // When FTS5 is active and sort is default/relevance, use hybrid relevance + business metrics scoring
  if (usingFtsRelevance && (!params.sort || params.sort === 'relevance')) {
    orderBy = `(
      (-fts.rank) * 0.6 +
      (ln(a.downloads + 2) / ln(2) * 3 + a.github_stars * 2) * 0.4
    ) DESC`;
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  let query: string;
  if (usingFtsRelevance && (!params.sort || params.sort === 'relevance')) {
    query = `SELECT a.*, COALESCE(us.cnt, 0) as user_star_count
      FROM assets a
      LEFT JOIN (SELECT asset_id, COUNT(*) as cnt FROM user_stars GROUP BY asset_id) us ON us.asset_id = a.id
      JOIN assets_fts fts ON a.rowid = fts.rowid AND assets_fts MATCH @q
      ${where ? where.replace(/a\.rowid IN \(SELECT rowid FROM assets_fts WHERE assets_fts MATCH @q\)/, '1=1') : ''}
      ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;
  } else {
    query = `SELECT a.*, COALESCE(us.cnt, 0) as user_star_count FROM assets a LEFT JOIN (SELECT asset_id, COUNT(*) as cnt FROM user_stars GROUP BY asset_id) us ON us.asset_id = a.id ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;
  }

  const rows = db.prepare(query).all({ ...bindings, limit: pageSize, offset }) as DbRow[];
  return { assets: rows.map(rowToAsset), total, page, pageSize };
}

export function getAssetById(id: string): Asset | null {
  const db = getDb();
  const row = db.prepare('SELECT a.*, COALESCE(us.cnt, 0) as user_star_count FROM assets a LEFT JOIN (SELECT asset_id, COUNT(*) as cnt FROM user_stars WHERE asset_id = ? GROUP BY asset_id) us ON us.asset_id = a.id WHERE a.id = ?').get(id, id) as DbRow | undefined;
  return row ? rowToAsset(row) : null;
}

export function createAsset(data: {
  name: string; displayName: string; type: string; description: string; version: string;
  authorId?: string; authorName?: string; authorAvatar?: string;
  longDescription?: string; tags?: string[]; category?: string; readme?: string; configSubtype?: string;
  githubUrl?: string; githubStars?: number; githubForks?: number; githubLanguage?: string; githubLicense?: string;
  /** Skip coin rewards (e.g. for GitHub imports where user didn't manually publish) */
  skipCoinReward?: boolean;
}): Asset {
  const db = getDb();
  const typePrefixes: Record<string, string> = { skill: 's', config: 'c', plugin: 'p', trigger: 'tr', channel: 'ch', template: 't' };
  const prefix = typePrefixes[data.type] || 'x';
  const id = `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString().split('T')[0];
  const authorName = data.authorName || 'Anonymous';
  const authorAvatar = data.authorAvatar || '🤖';
  const authorId = data.authorId || ('u-' + authorName.toLowerCase().replace(/\s+/g, '-'));

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
    githubUrl: data.githubUrl, githubStars: data.githubStars, githubForks: data.githubForks,
    githubLanguage: data.githubLanguage, githubLicense: data.githubLicense,
  };
  const row = assetToRow(asset);
  db.prepare(`INSERT INTO assets (id,name,display_name,type,author_id,author_name,author_avatar,description,long_description,version,downloads,rating,rating_count,tags,category,created_at,updated_at,install_command,readme,versions,dependencies,issue_count,config_subtype,hub_score,hub_score_breakdown,upgrade_rate,compatibility,files,github_url,github_stars,github_forks,github_language,github_license,github_synced_at) VALUES (@id,@name,@display_name,@type,@author_id,@author_name,@author_avatar,@description,@long_description,@version,@downloads,@rating,@rating_count,@tags,@category,@created_at,@updated_at,@install_command,@readme,@versions,@dependencies,@issue_count,@config_subtype,@hub_score,@hub_score_breakdown,@upgrade_rate,@compatibility,@files,@github_url,@github_stars,@github_forks,@github_language,@github_license,@github_synced_at)`).run({ ...row, github_url: data.githubUrl ?? '', github_stars: data.githubStars ?? 0, github_forks: data.githubForks ?? 0, github_language: data.githubLanguage ?? '', github_license: data.githubLicense ?? '', github_synced_at: data.githubUrl ? new Date().toISOString() : '' });

  // Award coins to publisher (skip for imports / non-user actions)
  if (data.authorId && !data.skipCoinReward) {
    addCoins(data.authorId, 'reputation', USER_REP_EVENTS.publish_asset, 'publish_asset', id);
    addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_asset, 'publish_asset', id);
  }

  return asset;
}

export function updateAsset(id: string, data: Partial<{
  name: string; displayName: string; description: string; longDescription: string;
  version: string; tags: string[]; category: string; readme: string;
  files: Array<{ name: string; type: string; size?: number; children?: unknown[]; content?: string }>;
  githubUrl: string; githubStars: number; githubForks: number; githubLanguage: string; githubLicense: string;
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
  if ((data as { files?: unknown }).files !== undefined) { updates.push('files = @files'); bindings.files = JSON.stringify((data as { files: unknown }).files); }
  if (data.githubUrl !== undefined) { updates.push('github_url = @ghu'); bindings.ghu = data.githubUrl; }
  if (data.githubStars !== undefined) { updates.push('github_stars = @ghs'); bindings.ghs = data.githubStars; }
  if (data.githubForks !== undefined) { updates.push('github_forks = @ghf'); bindings.ghf = data.githubForks; }
  if (data.githubLanguage !== undefined) { updates.push('github_language = @ghl'); bindings.ghl = data.githubLanguage; }
  if (data.githubLicense !== undefined) { updates.push('github_license = @ghli'); bindings.ghli = data.githubLicense; }
  if (data.githubUrl !== undefined) { updates.push('github_synced_at = @ghsa'); bindings.ghsa = new Date().toISOString(); }
  updates.push('updated_at = @ua'); bindings.ua = new Date().toISOString().split('T')[0];
  db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = @id`).run(bindings);
  return rowToAsset(db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow);
}

export function deleteAsset(id: string): boolean {
  return getDb().prepare('DELETE FROM assets WHERE id = ?').run(id).changes > 0;
}

export function incrementDownload(assetId: string, userId?: string): number | null {
  const db = getDb();

  // Always increment the download counter
  const result = db.prepare('UPDATE assets SET downloads = downloads + 1 WHERE id = ?').run(assetId);
  if (result.changes === 0) return null;

  const asset = db.prepare('SELECT author_id, version, downloads FROM assets WHERE id = ?').get(assetId) as { author_id: string; version: string; downloads: number } | undefined;
  if (!asset) return null;

  if (userId) {
    // Auto-star on download
    db.prepare('INSERT OR IGNORE INTO user_stars (user_id, asset_id, source) VALUES (?, ?, ?)').run(userId, assetId, 'download');

    // Deduct 1 shrimp coin from installer (if they have enough)
    if (hasEnoughCoins(userId, 1)) {
      addCoins(userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.install_asset, 'install_asset', assetId);
    }

    // Dedup: check if this user already installed this asset at this version
    const existing = db.prepare('SELECT last_version FROM user_installs WHERE user_id = ? AND asset_id = ?').get(userId, assetId) as { last_version: string } | undefined;
    const now = new Date().toISOString();

    if (!existing) {
      // First install ever — reward author
      db.prepare('INSERT INTO user_installs (user_id, asset_id, last_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(userId, assetId, asset.version, now, now);
      if (asset.author_id && asset.author_id !== userId) {
        addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
        addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
      }
    } else if (existing.last_version !== asset.version) {
      // Update install (new version) — reward author again
      db.prepare('UPDATE user_installs SET last_version = ?, updated_at = ? WHERE user_id = ? AND asset_id = ?').run(asset.version, now, userId, assetId);
      if (asset.author_id && asset.author_id !== userId) {
        addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
        addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
      }
    }
    // else: same user, same version — no author reward (dedup)
  } else {
    // Anonymous download — no dedup possible, reward author
    if (asset.author_id) {
      addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
      addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
    }
  }

  return asset.downloads;
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

  // Track whether we're doing an FTS5 relevance-aware query
  let usingFtsRelevance = false;

  if (params.type && ['skill','experience','plugin','trigger','channel','template'].includes(params.type)) {
    conditions.push('a.type = @type'); bindings.type = params.type;
  }
  if (params.category) { conditions.push('a.category = @category'); bindings.category = params.category; }
  if (params.tag) {
    conditions.push('a.tags LIKE @tag');
    bindings.tag = `%"${params.tag}"%`;
  }
  if (params.q) {
    // Try FTS5 search first, fall back to LIKE
    const ftsQuery = escapeFts5Query(params.q);
    if (ftsQuery && ftsHasContent()) {
      conditions.push(`a.rowid IN (SELECT rowid FROM assets_fts WHERE assets_fts MATCH @q)`);
      bindings.q = ftsQuery;
      usingFtsRelevance = true;
    } else {
      conditions.push(`(a.name LIKE @q ESCAPE '\\' OR a.display_name LIKE @q ESCAPE '\\' OR a.description LIKE @q ESCAPE '\\' OR a.tags LIKE @q ESCAPE '\\')`);
      const escaped = params.q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      bindings.q = `%${escaped}%`;
    }
  }
  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM assets a ${where}`).get(bindings) as { cnt: number }).cnt;

  let orderBy: string;
  switch (params.sort) {
    case 'newest': case 'updated_at': orderBy = 'a.updated_at DESC'; break;
    case 'popular':
    default:
      // 综合热度：下载量(对数衰减)*3 + github_stars(对数衰减,权重=下载的10%)*0.3 + 中文+30（V1无user_stars）
      orderBy = '(ln(a.downloads + 2) / ln(2) * 3 + ln(a.github_stars + 2) / ln(2) * 0.3 + CASE WHEN has_chinese(a.display_name) OR has_chinese(a.description) OR has_chinese(a.readme) OR has_chinese(a.author_name) THEN 30 ELSE 0 END) DESC, a.updated_at DESC';
      break;
  }

  // When FTS5 is active and sort is default/relevance, use hybrid relevance + business metrics scoring
  // Formula: relevance_score * 0.6 + normalized_business_score * 0.4
  // - FTS5 rank is negative (closer to 0 = more relevant), we negate it
  // - Business score: log2(downloads+2) * 3 + github_stars * 2 (log-dampened to avoid download count domination)
  if (usingFtsRelevance && (!params.sort || params.sort === 'relevance')) {
    orderBy = `(
      (-fts.rank) * 0.6 +
      (ln(a.downloads + 2) / ln(2) * 3 + a.github_stars * 2) * 0.4
    ) DESC`;
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  // When using FTS relevance scoring, JOIN with assets_fts to access rank
  let query: string;
  if (usingFtsRelevance && (!params.sort || params.sort === 'relevance')) {
    query = `SELECT a.id, a.name, a.display_name, a.type, a.description, a.tags, a.downloads, a.rating, a.author_name, a.author_id, a.version, a.install_command, a.updated_at, a.category
      FROM assets a
      JOIN assets_fts fts ON a.rowid = fts.rowid AND assets_fts MATCH @q
      ${where ? where.replace(/a\.rowid IN \(SELECT rowid FROM assets_fts WHERE assets_fts MATCH @q\)/, '1=1') : ''}
      ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;
  } else {
    query = `SELECT a.id, a.name, a.display_name, a.type, a.description, a.tags, a.downloads, a.rating, a.author_name, a.author_id, a.version, a.install_command, a.updated_at, a.category FROM assets a ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`;
  }

  const rows = db.prepare(query).all({ ...bindings, limit: pageSize, offset }) as {
    id: string; name: string; display_name: string; type: string; description: string;
    tags: string; downloads: number; rating: number; author_name: string; author_id: string;
    version: string; install_command: string; updated_at: string; category: string;
  }[];

  return {
    assets: rows.map(r => ({
      id: r.id, name: r.name, displayName: r.display_name, type: r.type,
      description: r.description, tags: safeParse(r.tags, []), installs: r.downloads,
      rating: r.rating, author: r.author_name, authorId: r.author_id, version: r.version,
      installCommand: r.install_command, updatedAt: r.updated_at, category: r.category,
    })),
    total, page, pageSize,
  };
}

export function getAllTags(): { name: string; count: number }[] {
  return getCached('allTags', 60_000, () => {
    const db = getDb();
    const rows = db.prepare('SELECT tags FROM assets').all() as { tags: string }[];
    const tagMap = new Map<string, number>();
    for (const row of rows) {
      const tags = safeParse(row.tags, []) as string[];
      for (const t of tags) {
        tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
      }
    }
    return [...tagMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });
}

export function getAllCategories(): { name: string; count: number }[] {
  const rows = getDb().prepare("SELECT category, COUNT(*) as cnt FROM assets WHERE category != '' GROUP BY category ORDER BY cnt DESC").all() as { category: string; cnt: number }[];
  return rows.map(r => ({ name: r.category, count: r.cnt }));
}

export function getAssetManifest(id: string): { id: string; manifest: Record<string, unknown> } | null {
  const row = getDb().prepare('SELECT id, manifest FROM assets WHERE id = ?').get(id) as { id: string; manifest: string } | undefined;
  if (!row) return null;
  return { id: row.id, manifest: safeParse(row.manifest || '{}', {}) };
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
    description: r.description, tags: safeParse(r.tags, []), installs: r.downloads,
    rating: r.rating, author: r.author_name, authorId: r.author_id, version: r.version,
    installCommand: r.install_command, updatedAt: r.updated_at, category: r.category,
  }));
}

// ════════════════════════════════════════════
// V1 L1/L2 API helpers (cursor-based)
// ════════════════════════════════════════════

export interface L1ListParams {
  type?: string; tag?: string; category?: string; q?: string; sort?: string;
  cursor?: string; limit?: number;
}

export function listAssetsL1(params: L1ListParams): { total: number; items: AssetCompact[]; nextCursor: string | null } {
  const page = params.cursor ? parseInt(params.cursor, 10) : 1;
  const pageSize = Math.min(50, Math.max(1, params.limit ?? 20));
  const result = listAssetsCompact({
    type: params.type,
    category: params.category,
    q: params.q,
    sort: params.sort,
    tag: params.tag,
    page,
    pageSize,
  });
  const hasMore = page * pageSize < result.total;
  return {
    total: result.total,
    items: result.assets,
    nextCursor: hasMore ? String(page + 1) : null,
  };
}

export function getAssetL2(id: string): (AssetCompact & { readme: string; longDescription: string; versions: unknown[]; dependencies: string[]; files: unknown[] }) | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow | undefined;
  if (!row) return null;
  return {
    id: row.id, name: row.name, displayName: row.display_name, type: row.type,
    description: row.description, tags: safeParse(row.tags, []), installs: row.downloads,
    rating: row.rating, author: row.author_name, authorId: row.author_id, version: row.version,
    installCommand: row.install_command, updatedAt: row.updated_at, category: row.category,
    readme: row.readme, longDescription: row.long_description,
    versions: safeParse(row.versions, []), dependencies: safeParse(row.dependencies, []),
    files: safeParse(row.files || '[]', []),
  };
}

export function getTrendingAssets(period: string, limit: number = 10): AssetCompact[] {
  const db = getDb();
  const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets ORDER BY downloads DESC, updated_at DESC LIMIT ?`).all(Math.min(limit, 50)) as {
    id: string; name: string; display_name: string; type: string; description: string;
    tags: string; downloads: number; rating: number; author_name: string; author_id: string;
    version: string; install_command: string; updated_at: string; category: string;
  }[];
  return rows.map(r => ({
    id: r.id, name: r.name, displayName: r.display_name, type: r.type,
    description: r.description, tags: safeParse(r.tags, []), installs: r.downloads,
    rating: r.rating, author: r.author_name, authorId: r.author_id, version: r.version,
    installCommand: r.install_command, updatedAt: r.updated_at, category: r.category,
  }));
}

// ════════════════════════════════════════════
// Version Management
// ════════════════════════════════════════════

export interface AssetVersionInfo {
  version: string;
  changelog: string;
  date: string;
  files?: { path: string; size: number; sha256: string; contentType: string }[];
}

/** Get all versions for an asset */
export function getAssetVersions(assetId: string): AssetVersionInfo[] | null {
  const db = getDb();
  const row = db.prepare('SELECT versions FROM assets WHERE id = ?').get(assetId) as { versions: string } | undefined;
  if (!row) return null;
  return safeParse(row.versions, []);
}

/** Get a specific version for an asset */
export function getAssetVersion(assetId: string, version: string): AssetVersionInfo | null {
  const versions = getAssetVersions(assetId);
  if (!versions) return null;
  return versions.find(v => v.version === version) ?? null;
}

// ════════════════════════════════════════════
// Dependents (reverse dependency lookup)
// ════════════════════════════════════════════

/** Find assets that depend on the given assetId */
export function getDependentAssets(assetId: string): Asset[] {
  const db = getDb();
  // dependencies is stored as JSON array; use LIKE for a quick filter then verify in JS
  const rows = db.prepare(
    `SELECT * FROM assets WHERE dependencies LIKE ?`
  ).all(`%${assetId}%`) as DbRow[];
  return rows
    .map(rowToAsset)
    .filter(a => a.dependencies.includes(assetId));
}

// ════════════════════════════════════════════
// Hash Resolve
// ════════════════════════════════════════════

export interface HashResolveResult {
  assetId: string;
  assetName: string;
  filePath: string;
  version: string;
}

/** Resolve a file by sha256 hash across all assets */
export function resolveByHash(hash: string): HashResolveResult[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, version, files FROM assets').all() as { id: string; name: string; version: string; files: string }[];
  const results: HashResolveResult[] = [];
  for (const row of rows) {
    const files = safeParse(row.files || '[]', []) as { path: string; sha256?: string }[];
    for (const f of files) {
      if (f.sha256 === hash) {
        results.push({ assetId: row.id, assetName: row.name, filePath: f.path, version: row.version });
      }
    }
  }
  return results;
}
