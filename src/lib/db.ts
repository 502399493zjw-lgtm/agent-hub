import Database from 'better-sqlite3';
import path from 'path';
import { assets as mockAssets, Asset } from '@/data/mock';

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

function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('skill','channel','plugin','trigger','config','template')),
      author_id TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      author_avatar TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      long_description TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0.0',
      downloads INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      install_command TEXT NOT NULL DEFAULT '',
      readme TEXT NOT NULL DEFAULT '',
      versions TEXT NOT NULL DEFAULT '[]',
      dependencies TEXT NOT NULL DEFAULT '[]',
      issue_count INTEGER NOT NULL DEFAULT 0,
      config_subtype TEXT,
      hub_score INTEGER NOT NULL DEFAULT 70,
      hub_score_breakdown TEXT NOT NULL DEFAULT '{}',
      upgrade_rate REAL NOT NULL DEFAULT 50,
      compatibility TEXT NOT NULL DEFAULT '{}',
      files TEXT NOT NULL DEFAULT '[]'
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      bio TEXT DEFAULT '',
      invite_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      UNIQUE(provider, provider_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY,
      created_by TEXT DEFAULT 'system',
      used_by TEXT,
      used_at TEXT,
      max_uses INTEGER DEFAULT 1,
      use_count INTEGER DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Seed invite codes if empty
  const inviteCount = db.prepare('SELECT COUNT(*) as cnt FROM invite_codes').get() as { cnt: number };
  if (inviteCount.cnt === 0) {
    const now = new Date().toISOString();
    const seedCodes = [
      { code: 'SEAFOOD-2026', max_uses: 100 },
      { code: 'CYBERNOVA-VIP', max_uses: 100 },
      { code: 'AGENT-HUB-BETA', max_uses: 100 },
    ];
    const insertCode = db.prepare(
      `INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, created_at)
       VALUES (?, 'system', ?, 0, ?)`
    );
    for (const c of seedCodes) {
      insertCode.run(c.code, c.max_uses, now);
    }
  }
}

// Convert a DB row to the Asset type used by the frontend
export interface DbRow {
  id: string;
  name: string;
  display_name: string;
  type: string;
  author_id: string;
  author_name: string;
  author_avatar: string;
  description: string;
  long_description: string;
  version: string;
  downloads: number;
  rating: number;
  rating_count: number;
  tags: string;
  category: string;
  created_at: string;
  updated_at: string;
  install_command: string;
  readme: string;
  versions: string;
  dependencies: string;
  issue_count: number;
  config_subtype: string | null;
  hub_score: number;
  hub_score_breakdown: string;
  upgrade_rate: number;
  compatibility: string;
  files: string;
}

export function rowToAsset(row: DbRow): Asset {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    type: row.type as Asset['type'],
    author: {
      id: row.author_id || ('u-' + row.author_name.toLowerCase().replace(/\s+/g, '-')),
      name: row.author_name,
      avatar: row.author_avatar,
    },
    description: row.description,
    longDescription: row.long_description,
    version: row.version,
    downloads: row.downloads,
    rating: row.rating,
    ratingCount: row.rating_count,
    tags: JSON.parse(row.tags) as string[],
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    installCommand: row.install_command,
    readme: row.readme,
    versions: JSON.parse(row.versions),
    dependencies: JSON.parse(row.dependencies),
    compatibility: JSON.parse(row.compatibility),
    issueCount: row.issue_count,
    files: JSON.parse(row.files || '[]'),
    configSubtype: (row.config_subtype ?? undefined) as Asset['configSubtype'],
    hubScore: row.hub_score,
    hubScoreBreakdown: JSON.parse(row.hub_score_breakdown),
    upgradeRate: row.upgrade_rate,
  };
}

function assetToRow(a: Asset) {
  return {
    id: a.id,
    name: a.name,
    display_name: a.displayName,
    type: a.type,
    author_id: a.author.id,
    author_name: a.author.name,
    author_avatar: a.author.avatar,
    description: a.description,
    long_description: a.longDescription,
    version: a.version,
    downloads: a.downloads,
    rating: a.rating,
    rating_count: a.ratingCount,
    tags: JSON.stringify(a.tags),
    category: a.category,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
    install_command: a.installCommand,
    readme: a.readme,
    versions: JSON.stringify(a.versions),
    dependencies: JSON.stringify(a.dependencies),
    issue_count: a.issueCount,
    config_subtype: a.configSubtype ?? null,
    files: JSON.stringify(a.files ?? []),
    hub_score: a.hubScore ?? 70,
    hub_score_breakdown: JSON.stringify(a.hubScoreBreakdown ?? {}),
    upgrade_rate: a.upgradeRate ?? 50,
    compatibility: JSON.stringify(a.compatibility ?? {}),
  };
}

const FS_EVENT_TRIGGER_ASSET: Asset = {
  id: 's-fsevent',
  name: 'fs-event-trigger',
  displayName: '📂 FS Event Trigger',
  type: 'skill',
  author: { id: 'u1', name: 'CyberNova', avatar: '🤖' },
  description: '文件系统事件监听 — 监控目录变化，自动触发 Agent 动作',
  longDescription: '创建文件系统事件 watcher，当指定目录有新文件或文件变更时，自动通过 hooks 唤醒 Agent 处理。支持 PDF、截图、CSV 等多种文件类型的自动化处理流水线。',
  version: '1.0.0',
  downloads: 0,
  rating: 0,
  ratingCount: 0,
  tags: ['filesystem', 'watcher', 'automation', 'hooks', 'trigger'],
  category: '系统工具',
  createdAt: '2026-02-20',
  updatedAt: '2026-02-20',
  installCommand: 'seafood-market install skill/@u1/fs-event-trigger',
  readme: `# 📂 FS Event Trigger

## 概述

FS Event Trigger 是一个文件系统事件监听 Skill，让你的 Agent 能够实时感知目录变化并自动触发相应动作。当指定目录中出现新文件、文件被修改或删除时，Agent 会自动唤醒并执行预设的处理流程。

## ✨ 功能特性

- **实时监听** — 基于 OS 原生 fs events，零延迟感知文件变化
- **多类型支持** — PDF、截图(PNG/JPG)、CSV、JSON、Markdown 等
- **智能过滤** — 通过 glob 模式和正则表达式精确匹配目标文件
- **Hook 机制** — 文件事件自动触发 Agent hooks，支持链式处理
- **批量处理** — 多文件同时变更时自动合并为批量任务
- **断点续传** — 重启后自动检查上次运行以来的变更

## 📦 安装

\`\`\`bash
openclaw skill install @cybernova/fs-event-trigger
\`\`\`

## 🚀 快速开始

### 基本配置

在 \`openclaw.yaml\` 中添加：

\`\`\`yaml
skills:
  - name: fs-event-trigger
    config:
      watch_dirs:
        - path: ~/Downloads
          patterns: ["*.pdf", "*.csv", "*.png"]
          recursive: false
        - path: ~/Documents/reports
          patterns: ["**/*.md"]
          recursive: true
      debounce_ms: 500
      ignore_hidden: true
\`\`\`

### Hook 配置

\`\`\`yaml
hooks:
  on_file_created:
    - action: notify
      message: "新文件: {{file.name}}"
    - action: process
      handler: auto  # 根据文件类型自动选择处理器
  on_file_modified:
    - action: diff
      handler: text-diff
  on_file_deleted:
    - action: log
      level: warn
\`\`\`

## 📖 使用示例

### 示例 1: 自动处理下载的 PDF

\`\`\`
监听 ~/Downloads 目录
↓ 检测到新 PDF
↓ 自动提取文本和元数据
↓ 生成摘要并存入知识库
↓ 通知用户: "已处理 report.pdf，摘要已保存"
\`\`\`

### 示例 2: 截图自动归档

\`\`\`
监听 ~/Desktop
↓ 检测到新截图 (Screenshot*.png)
↓ OCR 提取文字内容
↓ 自动重命名: 2026-02-20_meeting-notes.png
↓ 移动到 ~/Pictures/Screenshots/2026-02/
\`\`\`

### 示例 3: CSV 数据自动分析

\`\`\`
监听 ~/Data/incoming
↓ 检测到新 CSV 文件
↓ 自动读取并验证数据格式
↓ 生成数据概览和可视化图表
↓ 发送分析报告到飞书群
\`\`\`

## ⚙️ 配置说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| \`watch_dirs\` | array | \`[]\` | 监听目录列表 |
| \`watch_dirs[].path\` | string | - | 目录路径，支持 ~ 展开 |
| \`watch_dirs[].patterns\` | string[] | \`["*"]\` | glob 匹配模式 |
| \`watch_dirs[].recursive\` | boolean | \`false\` | 是否递归监听子目录 |
| \`debounce_ms\` | number | \`300\` | 去抖动延迟（毫秒） |
| \`ignore_hidden\` | boolean | \`true\` | 忽略隐藏文件（.开头） |
| \`max_file_size\` | string | \`"50MB"\` | 最大处理文件大小 |
| \`batch_window_ms\` | number | \`1000\` | 批量合并时间窗口 |

## 🔗 依赖

- OpenClaw >= 1.0.0
- Node.js >= 18

## 📄 License

MIT
`,
  versions: [{ version: '1.0.0', changelog: '首次发布 — 文件系统事件监听与自动触发', date: '2026-02-20' }],
  dependencies: [],
  compatibility: { models: ['GPT-4', 'Claude 3'], platforms: ['OpenClaw'], frameworks: ['Node.js'] },
  issueCount: 0,
  hubScore: 65,
  hubScoreBreakdown: { downloadScore: 0, maintenanceScore: 100, reputationScore: 0 },
  upgradeRate: 25,
};

function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number };
  if (count.cnt > 0) return;

  const insertStmt = db.prepare(`
    INSERT INTO assets (id, name, display_name, type, author_id, author_name, author_avatar, description, long_description, version, downloads, rating, rating_count, tags, category, created_at, updated_at, install_command, readme, versions, dependencies, issue_count, config_subtype, hub_score, hub_score_breakdown, upgrade_rate, compatibility, files)
    VALUES (@id, @name, @display_name, @type, @author_id, @author_name, @author_avatar, @description, @long_description, @version, @downloads, @rating, @rating_count, @tags, @category, @created_at, @updated_at, @install_command, @readme, @versions, @dependencies, @issue_count, @config_subtype, @hub_score, @hub_score_breakdown, @upgrade_rate, @compatibility, @files)
  `);

  const insertMany = db.transaction((assetList: Asset[]) => {
    for (const a of assetList) {
      insertStmt.run(assetToRow(a));
    }
  });

  // Seed from mock data + extra fs-event-trigger
  insertMany([...mockAssets, FS_EVENT_TRIGGER_ASSET]);
}

// ── Public API ──

export interface ListParams {
  type?: string;
  category?: string;
  q?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export function listAssets(params: ListParams): { assets: Asset[]; total: number; page: number; pageSize: number } {
  const db = getDb();
  const conditions: string[] = [];
  const bindings: Record<string, string | number> = {};

  if (params.type && ['skill', 'config', 'plugin', 'trigger', 'channel', 'template'].includes(params.type)) {
    conditions.push('type = @type');
    bindings.type = params.type;
  }

  if (params.category) {
    conditions.push('category = @category');
    bindings.category = params.category;
  }

  if (params.q) {
    conditions.push(`(
      name LIKE @q OR
      display_name LIKE @q OR
      description LIKE @q OR
      tags LIKE @q
    )`);
    bindings.q = `%${params.q}%`;
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Count total
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM assets ${where}`).get(bindings) as { cnt: number };
  const total = countRow.cnt;

  // Sort
  let orderBy: string;
  switch (params.sort) {
    case 'downloads':
      orderBy = 'downloads DESC';
      break;
    case 'rating':
      orderBy = 'rating DESC';
      break;
    case 'updated_at':
    case 'newest':
      orderBy = 'updated_at DESC';
      break;
    case 'created_at':
      orderBy = 'created_at DESC';
      break;
    case 'trending':
      orderBy = 'downloads DESC, updated_at DESC';
      break;
    default:
      orderBy = '(downloads * rating) DESC';
  }

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT * FROM assets ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`
  ).all({ ...bindings, limit: pageSize, offset }) as DbRow[];

  return {
    assets: rows.map(rowToAsset),
    total,
    page,
    pageSize,
  };
}

export function getAssetById(id: string): Asset | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow | undefined;
  return row ? rowToAsset(row) : null;
}

export function createAsset(data: {
  name: string;
  displayName: string;
  type: string;
  description: string;
  version: string;
  authorId?: string;
  authorName?: string;
  authorAvatar?: string;
  longDescription?: string;
  tags?: string[];
  category?: string;
  readme?: string;
  configSubtype?: string;
}): Asset {
  const db = getDb();

  const typePrefixes: Record<string, string> = {
    skill: 's',
    config: 'c',
    plugin: 'p',
    trigger: 'tr',
    channel: 'ch',
    template: 't',
  };
  const prefix = typePrefixes[data.type] || 'x';
  const shortId = Math.random().toString(36).substring(2, 8);
  const id = `${prefix}-${shortId}`;

  const now = new Date().toISOString().split('T')[0];
  const authorName = data.authorName || 'CyberNova';
  const authorAvatar = data.authorAvatar || '🤖';
  const authorId = data.authorId || ('u-' + authorName.toLowerCase().replace(/\s+/g, '-'));
  const installCommand = `seafood-market install ${data.type}/@${authorId}/${data.name}`;

  const asset: Asset = {
    id,
    name: data.name,
    displayName: data.displayName,
    type: data.type as Asset['type'],
    author: {
      id: authorId,
      name: authorName,
      avatar: authorAvatar,
    },
    description: data.description,
    longDescription: data.longDescription || '',
    version: data.version,
    downloads: 0,
    rating: 0,
    ratingCount: 0,
    tags: data.tags || [],
    category: data.category || '',
    createdAt: now,
    updatedAt: now,
    installCommand,
    readme: data.readme || '',
    versions: [{ version: data.version, changelog: '首次发布', date: now }],
    dependencies: [],
    compatibility: { models: ['GPT-4', 'Claude 3'], platforms: ['OpenClaw'], frameworks: ['Node.js'] },
    issueCount: 0,
    configSubtype: data.configSubtype as Asset['configSubtype'],
    hubScore: 65,
    hubScoreBreakdown: { downloadScore: 0, maintenanceScore: 100, reputationScore: 0 },
    upgradeRate: 25,
  };

  const row = assetToRow(asset);
  db.prepare(`
    INSERT INTO assets (id, name, display_name, type, author_id, author_name, author_avatar, description, long_description, version, downloads, rating, rating_count, tags, category, created_at, updated_at, install_command, readme, versions, dependencies, issue_count, config_subtype, hub_score, hub_score_breakdown, upgrade_rate, compatibility, files)
    VALUES (@id, @name, @display_name, @type, @author_id, @author_name, @author_avatar, @description, @long_description, @version, @downloads, @rating, @rating_count, @tags, @category, @created_at, @updated_at, @install_command, @readme, @versions, @dependencies, @issue_count, @config_subtype, @hub_score, @hub_score_breakdown, @upgrade_rate, @compatibility, @files)
  `).run(row);

  return asset;
}

export function updateAsset(id: string, data: Partial<{
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  version: string;
  tags: string[];
  category: string;
  readme: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
}>): Asset | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow | undefined;
  if (!existing) return null;

  const updates: string[] = [];
  const bindings: Record<string, string | number> = { id };

  if (data.name !== undefined) { updates.push('name = @name'); bindings.name = data.name; }
  if (data.displayName !== undefined) { updates.push('display_name = @displayName'); bindings.displayName = data.displayName; }
  if (data.description !== undefined) { updates.push('description = @description'); bindings.description = data.description; }
  if (data.longDescription !== undefined) { updates.push('long_description = @longDescription'); bindings.longDescription = data.longDescription; }
  if (data.version !== undefined) { updates.push('version = @version'); bindings.version = data.version; }
  if (data.tags !== undefined) { updates.push('tags = @tags'); bindings.tags = JSON.stringify(data.tags); }
  if (data.category !== undefined) { updates.push('category = @category'); bindings.category = data.category; }
  if (data.readme !== undefined) { updates.push('readme = @readme'); bindings.readme = data.readme; }
  if (data.authorId !== undefined) { updates.push('author_id = @authorId'); bindings.authorId = data.authorId; }
  if (data.authorName !== undefined) { updates.push('author_name = @authorName'); bindings.authorName = data.authorName; }
  if (data.authorAvatar !== undefined) { updates.push('author_avatar = @authorAvatar'); bindings.authorAvatar = data.authorAvatar; }

  const now = new Date().toISOString().split('T')[0];
  updates.push('updated_at = @updatedAt');
  bindings.updatedAt = now;

  if (updates.length === 0) return rowToAsset(existing);

  db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = @id`).run(bindings);

  const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as DbRow;
  return rowToAsset(updated);
}

export function deleteAsset(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── User API ──

export interface DbUser {
  id: string;
  email: string | null;
  name: string;
  avatar: string;
  provider: string;
  provider_id: string;
  bio: string;
  invite_code: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function findUserByProvider(provider: string, providerId: string): DbUser | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId) as DbUser | undefined;
  return row ?? null;
}

export function findUserById(id: string): DbUser | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined;
  return row ?? null;
}

export function createUser(data: {
  id: string;
  email: string | null;
  name: string;
  avatar: string;
  provider: string;
  providerId: string;
}): DbUser {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, name, avatar, provider, provider_id, bio, invite_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '', NULL, ?, ?)`
  ).run(data.id, data.email, data.name, data.avatar, data.provider, data.providerId, now, now);
  return findUserById(data.id)!;
}

export function softDeleteUser(id: string): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
  return result.changes > 0;
}

export function activateInviteCode(userId: string, code: string): { success: boolean; error?: string } {
  const db = getDb();
  const user = findUserById(userId);
  if (!user) return { success: false, error: '用户不存在' };
  if (user.invite_code) return { success: false, error: '已激活邀请码' };

  const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as {
    code: string; max_uses: number; use_count: number; expires_at: string | null; created_at: string;
  } | undefined;

  if (!invite) return { success: false, error: '邀请码不存在' };
  if (invite.use_count >= invite.max_uses) return { success: false, error: '邀请码已用完' };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { success: false, error: '邀请码已过期' };

  const now = new Date().toISOString();
  const updateUser = db.prepare('UPDATE users SET invite_code = ?, updated_at = ? WHERE id = ?');
  const updateCode = db.prepare('UPDATE invite_codes SET use_count = use_count + 1, used_at = ? WHERE code = ?');

  db.transaction(() => {
    updateUser.run(code, now, userId);
    updateCode.run(now, code);
  })();

  return { success: true };
}

export function validateInviteCode(code: string): { valid: boolean; error?: string } {
  const db = getDb();
  const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code) as {
    code: string; max_uses: number; use_count: number; expires_at: string | null;
  } | undefined;

  if (!invite) return { valid: false, error: '邀请码不存在' };
  if (invite.use_count >= invite.max_uses) return { valid: false, error: '邀请码已用完' };
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { valid: false, error: '邀请码已过期' };
  return { valid: true };
}

