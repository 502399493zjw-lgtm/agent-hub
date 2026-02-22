/**
 * db/users.ts — User CRUD + Profile operations.
 */
import { User } from '@/data/types';
import { getDb } from './connection';
import { addCoins, SHRIMP_COIN_EVENTS } from './economy';

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
  type: string;
  role: string;
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
  addCoins(data.id, 'shrimp_coin', 0, 'register_bonus');

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
  const db = getDb();
  if (avatar) {
    // Always update avatar from OAuth provider (keep it fresh)
    db.prepare('UPDATE users SET provider_name = ?, provider_avatar = ?, avatar = ?, updated_at = ? WHERE id = ?')
      .run(name, avatar, avatar, new Date().toISOString(), userId);
  } else {
    db.prepare('UPDATE users SET provider_name = ?, provider_avatar = ?, updated_at = ? WHERE id = ?')
      .run(name, avatar, new Date().toISOString(), userId);
  }
}

export function findUserByEmail(email: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined) ?? null;
}

export function findUserByName(name: string): DbUser | null {
  return (getDb().prepare('SELECT * FROM users WHERE LOWER(name) = LOWER(?)').get(name) as DbUser | undefined) ?? null;
}

/** Check if a user is an admin */
export function isAdmin(userId: string): boolean {
  const row = getDb().prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
  return row?.role === 'admin';
}

/** Ban a user */
export function banUser(userId: string, reason: string, bannedBy: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare('UPDATE users SET banned_at = ?, ban_reason = ?, banned_by = ?, updated_at = ? WHERE id = ? AND banned_at IS NULL')
    .run(now, reason, bannedBy, now, userId).changes > 0;
}

/** Unban a user */
export function unbanUser(userId: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare('UPDATE users SET banned_at = NULL, ban_reason = NULL, banned_by = NULL, updated_at = ? WHERE id = ? AND banned_at IS NOT NULL')
    .run(now, userId).changes > 0;
}

/** Check if a user is banned */
export function isBanned(userId: string): boolean {
  const row = getDb().prepare('SELECT banned_at FROM users WHERE id = ?').get(userId) as { banned_at: string | null } | undefined;
  return !!row?.banned_at;
}

/** Set a user's role */
export function setUserRole(userId: string, role: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
    .run(role, now, userId).changes > 0;
}

/** Get user role */
export function getUserRole(userId: string): string | null {
  const row = getDb().prepare('SELECT role FROM users WHERE id = ?').get(userId) as { role: string } | undefined;
  return row?.role ?? null;
}

/** Update custom_name and/or bio */
export function updateProfile(userId: string, data: { name?: string; bio?: string }): boolean {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: (string)[] = [now];

  if (data.name !== undefined) {
    sets.push('custom_name = ?', 'name = ?');
    params.push(data.name, data.name);
  }
  if (data.bio !== undefined) {
    sets.push('bio = ?');
    params.push(data.bio);
  }

  params.push(userId);
  return getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes > 0;
}

/** Update custom_avatar path */
export function updateAvatar(userId: string, avatarPath: string): boolean {
  const now = new Date().toISOString();
  return getDb().prepare('UPDATE users SET custom_avatar = ?, avatar = ?, updated_at = ? WHERE id = ?')
    .run(avatarPath, avatarPath, now, userId).changes > 0;
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
  const escaped = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const pattern = `%${escaped}%`;
  const rows = getDb().prepare("SELECT * FROM user_profiles WHERE name LIKE ? ESCAPE '\\' OR bio LIKE ? ESCAPE '\\' ORDER BY followers DESC").all(pattern, pattern) as DbUserProfile[];
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
