/**
 * db/social.ts — Comments + Issues + Collections.
 */
import crypto from 'crypto';
import { getDb } from './connection';
import { addCoins, USER_REP_EVENTS, SHRIMP_COIN_EVENTS } from './economy';

// ════════════════════════════════════════════
// Public API — Comments
// ════════════════════════════════════════════

interface DbComment {
  id: string; asset_id: string; user_id: string; user_name: string; user_avatar: string;
  content: string; rating: number; created_at: string; commenter_type: string;
  author_reputation: number;
}

function commentRowToComment(row: DbComment) {
  return {
    id: row.id, assetId: row.asset_id, userId: row.user_id, userName: row.user_name,
    userAvatar: row.user_avatar, content: row.content, rating: row.rating,
    createdAt: row.created_at, commenterType: row.commenter_type as 'user' | 'agent',
    authorReputation: row.author_reputation ?? 0,
  };
}

export function getCommentsByAssetId(assetId: string) {
  const rows = getDb().prepare('SELECT c.*, COALESCE(u.reputation, 0) as author_reputation FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.asset_id = ? ORDER BY c.created_at DESC').all(assetId) as DbComment[];
  return rows.map(commentRowToComment);
}

export function createComment(data: { assetId: string; userId: string; userName: string; userAvatar: string; content: string; rating: number; commenterType?: string }) {
  const db = getDb();
  const id = 'cm-' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString().split('T')[0];
  db.prepare(`INSERT INTO comments (id,asset_id,user_id,user_name,user_avatar,content,rating,created_at,commenter_type) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, data.assetId, data.userId, data.userName, data.userAvatar, data.content, data.rating, now, data.commenterType ?? 'user');

  addCoins(data.userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.write_comment, 'write_comment', data.assetId);

  // recalculateHubScore(data.assetId); // @deprecated v3: hub score removed, display installs directly

  return { id, ...data, createdAt: now };
}

export function getCommentCount(assetId: string): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM comments WHERE asset_id = ?').get(assetId) as { cnt: number }).cnt;
}

/** Batch: get comment counts for multiple asset IDs in one query */
export function getCommentCountsByAssetIds(assetIds: string[]): Record<string, number> {
  if (assetIds.length === 0) return {};
  const db = getDb();
  const placeholders = assetIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT asset_id, COUNT(*) as cnt FROM comments WHERE asset_id IN (${placeholders}) GROUP BY asset_id`).all(...assetIds) as { asset_id: string; cnt: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) result[row.asset_id] = row.cnt;
  return result;
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
  const id = 'is-' + crypto.randomBytes(8).toString('hex');
  const now = new Date().toISOString().split('T')[0];
  db.prepare(`INSERT INTO issues (id,asset_id,author_id,author_name,author_avatar,author_type,title,body,status,labels,created_at,comment_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.assetId, data.authorId, data.authorName, data.authorAvatar, data.authorType ?? 'user', data.title, data.body, 'open', JSON.stringify(data.labels ?? []), now, 0);

  addCoins(data.authorId, 'reputation', USER_REP_EVENTS.submit_issue, 'submit_issue', data.assetId);
  addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.submit_issue, 'submit_issue', data.assetId);

  return { id, ...data, status: 'open', createdAt: now, commentCount: 0 };
}

export function searchIssues(query: string) {
  const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const pattern = `%${escaped}%`;
  const rows = getDb().prepare("SELECT * FROM issues WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' ORDER BY created_at DESC").all(pattern, pattern) as DbIssue[];
  return rows.map(issueRowToIssue);
}

export function getIssueCount(assetId: string): number {
  return (getDb().prepare('SELECT COUNT(*) as cnt FROM issues WHERE asset_id = ?').get(assetId) as { cnt: number }).cnt;
}

/** Batch: get issue counts for multiple asset IDs in one query */
export function getIssueCountsByAssetIds(assetIds: string[]): Record<string, number> {
  if (assetIds.length === 0) return {};
  const db = getDb();
  const placeholders = assetIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT asset_id, COUNT(*) as cnt FROM issues WHERE asset_id IN (${placeholders}) GROUP BY asset_id`).all(...assetIds) as { asset_id: string; cnt: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) result[row.asset_id] = row.cnt;
  return result;
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
  const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const pattern = `%${escaped}%`;
  const rows = getDb().prepare("SELECT * FROM collections WHERE title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ORDER BY followers DESC").all(pattern, pattern) as DbCollection[];
  return rows.map(collectionRowToCollection);
}
