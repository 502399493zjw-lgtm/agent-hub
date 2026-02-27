/**
 * db/schema.ts — Table creation and migrations.
 */
import crypto from 'crypto';
import { getDb, __registerInitFn } from './connection';
import { inviteCodes } from '@/data/seed';

export function initTables(db: import('better-sqlite3').Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, display_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('skill','channel','plugin','trigger','experience','template')),
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
      expires_at TEXT,
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
    CREATE TABLE IF NOT EXISTS cli_auth_requests (
      code TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'authorized', 'expired')),
      user_id TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      authorized_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      key_hash TEXT PRIMARY KEY,
      key_prefix TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL,
      last_used_at TEXT,
      revoked INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
  `);

  // L03: Helper to check if a column exists before ALTER TABLE
  function hasColumn(table: string, column: string): boolean {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return cols.some(c => c.name === column);
  }

  // Migration: add reputation and shrimp_coins columns to users table if missing
  if (!hasColumn('users', 'reputation')) {
    db.exec(`ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn('users', 'shrimp_coins')) {
    db.exec(`ALTER TABLE users ADD COLUMN shrimp_coins INTEGER NOT NULL DEFAULT 100`);
  }
  // Migration: add onboarding + custom profile columns
  if (!hasColumn('users', 'onboarding_completed')) {
    db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn('users', 'custom_name')) {
    db.exec(`ALTER TABLE users ADD COLUMN custom_name TEXT`);
  }
  if (!hasColumn('users', 'custom_avatar')) {
    db.exec(`ALTER TABLE users ADD COLUMN custom_avatar TEXT`);
  }
  if (!hasColumn('users', 'provider_name')) {
    db.exec(`ALTER TABLE users ADD COLUMN provider_name TEXT`);
  }
  if (!hasColumn('users', 'provider_avatar')) {
    db.exec(`ALTER TABLE users ADD COLUMN provider_avatar TEXT`);
  }
  // Migration: add manifest column to assets
  if (!hasColumn('assets', 'manifest')) {
    db.exec(`ALTER TABLE assets ADD COLUMN manifest TEXT NOT NULL DEFAULT '{}'`);
  }
  // Migration: add GitHub columns to assets
  if (!hasColumn('assets', 'github_url')) { db.exec(`ALTER TABLE assets ADD COLUMN github_url TEXT NOT NULL DEFAULT ''`); }
  if (!hasColumn('assets', 'github_stars')) { db.exec(`ALTER TABLE assets ADD COLUMN github_stars INTEGER NOT NULL DEFAULT 0`); }
  if (!hasColumn('assets', 'github_forks')) { db.exec(`ALTER TABLE assets ADD COLUMN github_forks INTEGER NOT NULL DEFAULT 0`); }
  if (!hasColumn('assets', 'github_language')) { db.exec(`ALTER TABLE assets ADD COLUMN github_language TEXT NOT NULL DEFAULT ''`); }
  if (!hasColumn('assets', 'github_license')) { db.exec(`ALTER TABLE assets ADD COLUMN github_license TEXT NOT NULL DEFAULT ''`); }
  if (!hasColumn('assets', 'github_synced_at')) { db.exec(`ALTER TABLE assets ADD COLUMN github_synced_at TEXT NOT NULL DEFAULT ''`); }
  if (!hasColumn('assets', 'github_star_rep_synced')) { db.exec(`ALTER TABLE assets ADD COLUMN github_star_rep_synced INTEGER NOT NULL DEFAULT 0`); }
  // Migration: add type column to users table (agent vs user)
  if (!hasColumn('users', 'type')) { db.exec(`ALTER TABLE users ADD COLUMN type TEXT NOT NULL DEFAULT 'user'`); }

  // Migration S05: expires_at column now included in CREATE TABLE definition above.
  // Kept as no-op for existing DBs that already have the column.

  // Migration S01: migrate api_keys from plaintext key to key_hash
  try {
    const tableInfo = db.prepare("PRAGMA table_info(api_keys)").all() as { name: string }[];
    const hasOldKeyCol = tableInfo.some(c => c.name === 'key');
    const hasKeyHash = tableInfo.some(c => c.name === 'key_hash');
    if (hasOldKeyCol && !hasKeyHash) {
      db.exec(`ALTER TABLE api_keys RENAME TO api_keys_old`);
      db.exec(`
        CREATE TABLE api_keys (
          key_hash TEXT PRIMARY KEY,
          key_prefix TEXT NOT NULL DEFAULT '',
          user_id TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT 'default',
          created_at TEXT NOT NULL,
          last_used_at TEXT,
          revoked INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
      `);
      const oldRows = db.prepare('SELECT * FROM api_keys_old').all() as { key: string; user_id: string; name: string; created_at: string; last_used_at: string | null; revoked: number }[];
      const insertNew = db.prepare('INSERT OR IGNORE INTO api_keys (key_hash, key_prefix, user_id, name, created_at, last_used_at, revoked) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const row of oldRows) {
        const hash = crypto.createHash('sha256').update(row.key).digest('hex');
        const prefix = row.key.substring(0, 10);
        insertNew.run(hash, prefix, row.user_id, row.name, row.created_at, row.last_used_at, row.revoked);
      }
      db.exec('DROP TABLE api_keys_old');
    }
  } catch { /* migration already done or not needed */ }

  // Migration: add role column to users table
  if (!hasColumn('users', 'role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  }

  // Migration: add ban columns to users table
  if (!hasColumn('users', 'banned_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN banned_at TEXT`);
  }
  if (!hasColumn('users', 'ban_reason')) {
    db.exec(`ALTER TABLE users ADD COLUMN ban_reason TEXT`);
  }
  if (!hasColumn('users', 'banned_by')) {
    db.exec(`ALTER TABLE users ADD COLUMN banned_by TEXT`);
  }

  // Star system: user_stars table
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stars (
      user_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, asset_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_stars_asset ON user_stars(asset_id);
  `);

  // Install dedup table: tracks which users installed which assets at which version
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_installs (
      user_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      last_version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, asset_id)
    )
  `);

  // ════════════════════════════════════════════
  // Performance indexes
  // ════════════════════════════════════════════
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assets_type_downloads ON assets(type, downloads DESC);
    CREATE INDEX IF NOT EXISTS idx_assets_author ON assets(author_id);
    CREATE INDEX IF NOT EXISTS idx_assets_updated ON assets(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_comments_asset ON comments(asset_id);
    CREATE INDEX IF NOT EXISTS idx_issues_asset ON issues(asset_id);
  `);
  // Note: idx_user_stars_asset is already created above with user_stars table

  // FTS5 full-text search virtual table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
      name, display_name, description, tags, category, author_name,
      content='assets',
      content_rowid='rowid'
    );
  `);

  // FTS sync triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
      INSERT INTO assets_fts(rowid, name, display_name, description, tags, category, author_name)
      VALUES (new.rowid, new.name, new.display_name, new.description, new.tags, new.category, new.author_name);
    END;
    CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
      INSERT INTO assets_fts(assets_fts, rowid, name, display_name, description, tags, category, author_name)
      VALUES ('delete', old.rowid, old.name, old.display_name, old.description, old.tags, old.category, old.author_name);
    END;
    CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
      INSERT INTO assets_fts(assets_fts, rowid, name, display_name, description, tags, category, author_name)
      VALUES ('delete', old.rowid, old.name, old.display_name, old.description, old.tags, old.category, old.author_name);
      INSERT INTO assets_fts(rowid, name, display_name, description, tags, category, author_name)
      VALUES (new.rowid, new.name, new.display_name, new.description, new.tags, new.category, new.author_name);
    END;
  `);

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

/** Rebuild the FTS index from scratch (useful after bulk imports or initial setup) */
export function rebuildFtsIndex(): void {
  const db = getDb();
  // Clear existing FTS content
  db.exec(`DELETE FROM assets_fts`);
  // Re-populate from assets table
  db.exec(`
    INSERT INTO assets_fts(rowid, name, display_name, description, tags, category, author_name)
    SELECT rowid, name, display_name, description, tags, category, author_name FROM assets
  `);
}

// Register initTables as the DB initialization function
__registerInitFn(initTables);
