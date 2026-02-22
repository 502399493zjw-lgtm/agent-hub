/**
 * db/auth.ts — API Keys, Devices, Invite Codes, CLI Auth, Verification Tokens.
 */
import crypto from 'crypto';
import { getDb } from './connection';
import { findUserById } from './users';
import { addCoins, USER_REP_EVENTS, SHRIMP_COIN_EVENTS } from './economy';
import type { DbUser } from './users';

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

// ════════════════════════════════════════════
// Invite Code System
// ════════════════════════════════════════════

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
    generateUserInviteCodes(userId);
  })();

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

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(7);
  let code = '';
  for (let i = 0; i < 7; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

export interface InviteCode {
  code: string; createdBy: string; usedBy: string | null; usedAt: string | null;
  maxUses: number; useCount: number; expiresAt: string | null; type: string; createdAt: string;
}

interface DbInviteCode {
  code: string; created_by: string; used_by: string | null; used_at: string | null;
  max_uses: number; use_count: number; expires_at: string | null; type: string; created_at: string;
}

function dbInviteToInvite(row: DbInviteCode): InviteCode {
  return {
    code: row.code, createdBy: row.created_by, usedBy: row.used_by, usedAt: row.used_at,
    maxUses: row.max_uses, useCount: row.use_count, expiresAt: row.expires_at,
    type: row.type, createdAt: row.created_at,
  };
}

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
    if (result.changes > 0) codes.push(code);
    attempts++;
  }
  return codes;
}

export function getUserInviteCodes(userId: string): InviteCode[] {
  const rows = getDb().prepare('SELECT * FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC').all(userId) as DbInviteCode[];
  return rows.map(dbInviteToInvite);
}

export function createSuperInviteCode(code: string, maxUses: number, createdBy: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    db.prepare(
      `INSERT INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, ?, ?, 0, 'super', ?)`
    ).run(code, createdBy, maxUses, now);
    return true;
  } catch {
    return false;
  }
}

export function getInviteCodeDetail(code: string): InviteCode | null {
  const row = getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as DbInviteCode | undefined;
  return row ? dbInviteToInvite(row) : null;
}

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

export function deleteInviteCode(code: string): boolean {
  return getDb().prepare('DELETE FROM invite_codes WHERE code = ?').run(code).changes > 0;
}

export function userHasInviteAccess(userId: string): boolean {
  const user = findUserById(userId);
  return !!user?.invite_code;
}

// ════════════════════════════════════════════
// Public API — API Keys (Agent auth)
// ════════════════════════════════════════════

export interface DbApiKey {
  key_hash: string;
  key_prefix: string;
  user_id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  revoked: number;
}

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function createApiKey(userId: string, name: string = 'default'): string {
  const key = 'sk-' + crypto.randomBytes(16).toString('hex');
  const keyHash = hashApiKey(key);
  const keyPrefix = key.substring(0, 10);
  const now = new Date().toISOString();
  getDb().prepare(
    'INSERT INTO api_keys (key_hash, key_prefix, user_id, name, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)'
  ).run(keyHash, keyPrefix, userId, name, now);
  return key;
}

export function findUserByApiKey(key: string): DbUser | null {
  const keyHash = hashApiKey(key);
  const row = getDb().prepare(
    'SELECT user_id FROM api_keys WHERE key_hash = ? AND revoked = 0'
  ).get(keyHash) as { user_id: string } | undefined;
  if (!row) return null;
  return findUserById(row.user_id);
}

export function updateApiKeyLastUsed(key: string): void {
  const keyHash = hashApiKey(key);
  getDb().prepare('UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?').run(new Date().toISOString(), keyHash);
}

export function listApiKeys(userId: string): DbApiKey[] {
  return getDb().prepare(
    'SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId) as DbApiKey[];
}

export function revokeApiKey(keyHash: string, userId: string): boolean {
  const result = getDb().prepare(
    'UPDATE api_keys SET revoked = 1 WHERE key_hash = ? AND user_id = ?'
  ).run(keyHash, userId);
  return result.changes > 0;
}

export function revokeApiKeyByRawKey(key: string, userId: string): boolean {
  return revokeApiKey(hashApiKey(key), userId);
}

// ════════════════════════════════════════════
// Public API — Authorized Devices
// ════════════════════════════════════════════

export function authorizeDevice(userId: string, deviceId: string, name: string = ''): { success: boolean; error?: string } {
  const db = getDb();
  const now = new Date().toISOString();

  // Check if device is already bound
  const existing = db.prepare('SELECT user_id FROM authorized_devices WHERE device_id = ?').get(deviceId) as { user_id: string } | undefined;

  if (existing) {
    if (existing.user_id === userId) {
      // Already bound to the same user — update name/timestamp, return success
      db.prepare('UPDATE authorized_devices SET name = ?, authorized_at = ? WHERE device_id = ?').run(name || '', now, deviceId);
      return { success: true };
    }
    // Bound to a different user — reject
    return { success: false, error: '此设备已绑定到其他账号' };
  }

  // Device not bound yet — create binding (permanent, no expires_at)
  db.prepare('INSERT INTO authorized_devices (device_id, user_id, name, authorized_at) VALUES (?, ?, ?, ?)').run(deviceId, userId, name, now);
  return { success: true };
}

export function validateDevice(deviceId: string): { userId: string; name: string } | null {
  const row = getDb().prepare('SELECT user_id, name FROM authorized_devices WHERE device_id = ?').get(deviceId) as { user_id: string; name: string } | undefined;
  if (!row) return null;
  // Permanent binding — no expiry check
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

/**
 * Revoke (unbind) a device. This is an admin/account-deletion operation only.
 * Normal users should NOT be able to unbind devices through the UI.
 * A device binding is permanent unless the account is deleted.
 */
export function revokeDevice(deviceId: string, userId: string): boolean {
  const result = getDb().prepare('DELETE FROM authorized_devices WHERE device_id = ? AND user_id = ?').run(deviceId, userId);
  return result.changes > 0;
}

/**
 * Get the current binding for a device.
 * Returns the bound user info, or null if the device is not bound.
 * Used by Agent to check its own binding status on startup.
 */
export function getDeviceBinding(deviceId: string): { userId: string; userName: string; deviceName: string; authorizedAt: string } | null {
  const row = getDb().prepare(
    `SELECT d.user_id, d.name AS device_name, d.authorized_at, u.name AS user_name
     FROM authorized_devices d
     LEFT JOIN users u ON u.id = d.user_id
     WHERE d.device_id = ?`
  ).get(deviceId) as { user_id: string; device_name: string; authorized_at: string; user_name: string | null } | undefined;

  if (!row) return null;
  return {
    userId: row.user_id,
    userName: row.user_name || '',
    deviceName: row.device_name,
    authorizedAt: row.authorized_at,
  };
}

// ════════════════════════════════════════════
// CLI Device Auth Flow (polling-based)
// ════════════════════════════════════════════

export function createCliAuthRequest(deviceId: string, deviceName: string = ''): { code: string; expiresAt: string } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  getDb().prepare('DELETE FROM cli_auth_requests WHERE device_id = ? OR expires_at < ?').run(deviceId, now);

  getDb().prepare(
    'INSERT INTO cli_auth_requests (code, device_id, device_name, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(code, deviceId, deviceName, 'pending', now, expiresAt);

  return { code, expiresAt };
}

export function pollCliAuthRequest(code: string, deviceId: string): { status: 'pending' | 'authorized' | 'expired'; userId?: string } | null {
  const now = new Date().toISOString();
  const row = getDb().prepare(
    'SELECT status, user_id, expires_at FROM cli_auth_requests WHERE code = ? AND device_id = ?'
  ).get(code, deviceId) as { status: string; user_id: string | null; expires_at: string } | undefined;

  if (!row) return null;

  if (row.expires_at < now && row.status === 'pending') {
    getDb().prepare('UPDATE cli_auth_requests SET status = ? WHERE code = ?').run('expired', code);
    return { status: 'expired' };
  }

  if (row.status === 'authorized' && row.user_id) {
    getDb().prepare('DELETE FROM cli_auth_requests WHERE code = ?').run(code);
    return { status: 'authorized', userId: row.user_id };
  }

  return { status: row.status as 'pending' | 'authorized' | 'expired' };
}

export function approveCliAuthRequest(code: string, userId: string): { success: boolean; error?: string } {
  const now = new Date().toISOString();
  const row = getDb().prepare(
    'SELECT device_id, device_name, status, expires_at FROM cli_auth_requests WHERE code = ?'
  ).get(code) as { device_id: string; device_name: string; status: string; expires_at: string } | undefined;

  if (!row) return { success: false, error: '授权码不存在' };
  if (row.status !== 'pending') return { success: false, error: '授权码已使用或已过期' };
  if (row.expires_at < now) {
    getDb().prepare('UPDATE cli_auth_requests SET status = ? WHERE code = ?').run('expired', code);
    return { success: false, error: '授权码已过期' };
  }

  const bindResult = authorizeDevice(userId, row.device_id, row.device_name);
  if (!bindResult.success) {
    return { success: false, error: bindResult.error || '设备绑定失败' };
  }

  getDb().prepare(
    'UPDATE cli_auth_requests SET status = ?, user_id = ?, authorized_at = ? WHERE code = ?'
  ).run('authorized', userId, now, code);

  return { success: true };
}

export function getCliAuthRequest(code: string): { deviceId: string; deviceName: string; status: string; expiresAt: string } | null {
  const row = getDb().prepare(
    'SELECT device_id, device_name, status, expires_at FROM cli_auth_requests WHERE code = ?'
  ).get(code) as { device_id: string; device_name: string; status: string; expires_at: string } | undefined;

  if (!row) return null;
  return { deviceId: row.device_id, deviceName: row.device_name, status: row.status, expiresAt: row.expires_at };
}
