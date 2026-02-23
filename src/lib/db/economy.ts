/**
 * db/economy.ts — Coins (Reputation & Shrimp Coins), Stars, Hub Score.
 */
import { getDb } from './connection';

// ════════════════════════════════════════════
// Hub Score — REMOVED (v3: display installs directly)
// ════════════════════════════════════════════

/**
 * @deprecated v3 已废弃 — 直接展示安装数（installs），不再计算综合分。
 * 保留函数定义以便未来复用，当前固定返回零值。
 */
export function calculateHubScore(_downloads: number, _rating: number, _ratingCount: number): {
  hubScore: number;
  hubScoreBreakdown: { downloadScore: number; maintenanceScore: number; reputationScore: number };
} {
  return { hubScore: 0, hubScoreBreakdown: { downloadScore: 0, maintenanceScore: 0, reputationScore: 0 } };
}

/**
 * @deprecated v3 已废弃 — 直接展示安装数（installs），不再计算综合分。
 * 保留函数定义以便未来复用。
 */
export function recalculateHubScore(assetId: string): void {
  const db = getDb();
  const row = db.prepare('SELECT downloads, rating, rating_count FROM assets WHERE id = ?').get(assetId) as { downloads: number; rating: number; rating_count: number } | undefined;
  if (!row) return;
  const { hubScore, hubScoreBreakdown } = calculateHubScore(row.downloads, row.rating, row.rating_count);
  db.prepare('UPDATE assets SET hub_score = ?, hub_score_breakdown = ? WHERE id = ?').run(hubScore, JSON.stringify(hubScoreBreakdown), assetId);
}

// ════════════════════════════════════════════
// Coin Events Config
// ════════════════════════════════════════════

export const USER_REP_EVENTS = {
  publish_asset: 1,
  asset_installed: 5,
  submit_issue: 1,
  invite_user: 5,
  publish_version: 1,
  asset_starred: 5,
  github_star_synced: 2,
} as const;

export const SHRIMP_COIN_EVENTS = {
  register: 100,
  publish_asset: 50,
  asset_installed: 10,
  write_comment: 3,
  submit_issue: 2,
  invite_user: 20,
  publish_version: 20,
  install_asset: -1,
} as const;

// ════════════════════════════════════════════
// Coin System — Reputation & Shrimp Coins
// ════════════════════════════════════════════

export function addCoins(userId: string, coinType: 'reputation' | 'shrimp_coin', amount: number, event: string, refId?: string): void {
  const db = getDb();
  const col = coinType === 'reputation' ? 'reputation' : 'shrimp_coins';

  const user = db.prepare(`SELECT ${col} FROM users WHERE id = ?`).get(userId) as Record<string, number> | undefined;
  if (!user) return;

  const currentBalance = user[col] ?? 0;
  const newBalance = Math.max(0, currentBalance + amount);

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
// Public API — User Stars
// ════════════════════════════════════════════

export function starAsset(userId: string, assetId: string, source: 'manual' | 'download' = 'manual'): boolean {
  const result = getDb().prepare(
    'INSERT OR IGNORE INTO user_stars (user_id, asset_id, source) VALUES (?, ?, ?)'
  ).run(userId, assetId, source);
  return result.changes > 0;
}

export function unstarAsset(userId: string, assetId: string): boolean {
  const result = getDb().prepare(
    'DELETE FROM user_stars WHERE user_id = ? AND asset_id = ?'
  ).run(userId, assetId);
  return result.changes > 0;
}

export function isStarred(userId: string, assetId: string): boolean {
  const row = getDb().prepare(
    'SELECT 1 FROM user_stars WHERE user_id = ? AND asset_id = ?'
  ).get(userId, assetId);
  return !!row;
}

export function getAssetUserStarCount(assetId: string): number {
  return (getDb().prepare(
    'SELECT COUNT(*) as cnt FROM user_stars WHERE asset_id = ?'
  ).get(assetId) as { cnt: number }).cnt;
}

export function getTotalStars(assetId: string): number {
  const row = getDb().prepare(
    `SELECT COALESCE(a.github_stars, 0) + COALESCE(us.cnt, 0) as total
     FROM assets a
     LEFT JOIN (SELECT asset_id, COUNT(*) as cnt FROM user_stars WHERE asset_id = ? GROUP BY asset_id) us ON us.asset_id = a.id
     WHERE a.id = ?`
  ).get(assetId, assetId) as { total: number } | undefined;
  return row?.total ?? 0;
}

/** Get star info for a user: total given stars, assets starred */
export function getUserStarInfo(userId: string): { totalStars: number; starredAssetIds: string[] } {
  const rows = getDb().prepare('SELECT asset_id FROM user_stars WHERE user_id = ?').all(userId) as { asset_id: string }[];
  return { totalStars: rows.length, starredAssetIds: rows.map(r => r.asset_id) };
}

/** Get user coin events with pagination (for activity timeline) */
export interface CoinEvent {
  id: number;
  userId: string;
  coinType: string;
  amount: number;
  event: string;
  refId: string | null;
  balanceAfter: number;
  createdAt: string;
}

export function getUserCoinEvents(
  userId: string,
  opts: { page?: number; pageSize?: number } = {}
): { events: CoinEvent[]; total: number; page: number; pageSize: number } {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;
  const db = getDb();

  const totalRow = db.prepare('SELECT COUNT(*) as cnt FROM coin_events WHERE user_id = ?').get(userId) as { cnt: number };
  const total = totalRow.cnt;

  const rows = db.prepare(
    'SELECT * FROM coin_events WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
  ).all(userId, pageSize, offset) as { id: number; user_id: string; coin_type: string; amount: number; event: string; ref_id: string | null; balance_after: number; created_at: string }[];

  return {
    events: rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      coinType: r.coin_type,
      amount: r.amount,
      event: r.event,
      refId: r.ref_id,
      balanceAfter: r.balance_after,
      createdAt: r.created_at,
    })),
    total,
    page,
    pageSize,
  };
}

/** Get top starred assets */
export function getTopStarredAssets(limit: number = 10): { assetId: string; starCount: number }[] {
  const rows = getDb().prepare(
    'SELECT asset_id, COUNT(*) as cnt FROM user_stars GROUP BY asset_id ORDER BY cnt DESC LIMIT ?'
  ).all(limit) as { asset_id: string; cnt: number }[];
  return rows.map(r => ({ assetId: r.asset_id, starCount: r.cnt }));
}
