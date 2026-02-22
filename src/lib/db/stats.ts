/**
 * db/stats.ts — Stats, Daily Growth, Notifications, Evolution/Activity Events.
 */
import { getDb } from './connection';

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
