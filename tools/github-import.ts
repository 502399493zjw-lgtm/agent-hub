#!/usr/bin/env npx tsx
/**
 * GitHub → 水产市场 批量导入工具
 *
 * Usage:
 *   npx tsx tools/github-import.ts <github_url_1> [github_url_2] ...
 *   npx tsx tools/github-import.ts --file urls.txt
 *   npx tsx tools/github-import.ts --file urls.txt --type skill --dry-run
 *
 * Options:
 *   --type <type>     资产类型 (skill|plugin|trigger|channel|config|template) 默认 skill
 *   --file <path>     从文件读取 URL 列表（每行一个）
 *   --dry-run         只预览不写入
 *   --category <cat>  分类标签
 *   --author-id <id>  覆盖作者 ID
 *   --author-name <n> 覆盖作者名
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

// ═══════════════════════════════════════════
// Config
// ═══════════════════════════════════════════

const DB_PATH = path.join(process.cwd(), 'data', 'hub.db');
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  topics: string[];
  license: string | null;
  homepage: string | null;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
  avatarUrl: string;
  ownerType: string; // "User" | "Organization"
}

interface RepoContent {
  readme: string;
  files: FileNode[];
  issues: IssueInfo[];
  latestRelease: ReleaseInfo | null;
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  content?: string;
}

interface IssueInfo {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  createdAt: string;
  author: string;
  commentCount: number;
}

interface ReleaseInfo {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
}

interface ImportResult {
  url: string;
  success: boolean;
  assetId?: string;
  error?: string;
}

// ═══════════════════════════════════════════
// GitHub API helpers
// ═══════════════════════════════════════════

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'agent-hub-importer/1.0',
  };
  if (GITHUB_TOKEN) {
    h['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }
  return h;
}

async function ghFetch(endpoint: string): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers: githubHeaders() });

    if (res.status === 404) return null;

    // L10: Check rate limit headers
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 403 && remaining === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const resetDate = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'unknown';
      throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate}. Set GITHUB_TOKEN for higher limits.`);
    }

    if (res.status === 403) {
      throw new Error(`GitHub API 403: ${await res.text()}`);
    }

    // L10: Retry on 5xx or 429 with exponential backoff
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`  ⏳ Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries}, status ${res.status})...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }

    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);

    // L10: Warn when rate limit is getting low
    if (remaining && parseInt(remaining) < 10) {
      console.log(`  ⚠️  GitHub API rate limit low: ${remaining} remaining`);
    }

    return res.json();
  }

  throw new Error(`GitHub API request failed after ${maxRetries} retries`);
}

// ═══════════════════════════════════════════
// Parse GitHub URL
// ═══════════════════════════════════════════

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // Supports:
  //   https://github.com/owner/repo
  //   https://github.com/owner/repo.git
  //   github.com/owner/repo
  //   owner/repo
  const cleaned = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleaned.match(/(?:(?:https?:\/\/)?github\.com\/)?([^\/\s]+)\/([^\/\s#?]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

// ═══════════════════════════════════════════
// Fetch repo data
// ═══════════════════════════════════════════

async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const data = await ghFetch(`/repos/${owner}/${repo}`);
  if (!data) throw new Error(`Repo not found: ${owner}/${repo}`);
  return {
    owner,
    repo,
    fullName: data.full_name,
    description: data.description || '',
    stars: data.stargazers_count,
    forks: data.forks_count,
    language: data.language || '',
    topics: data.topics || [],
    license: data.license?.spdx_id || null,
    homepage: data.homepage || null,
    defaultBranch: data.default_branch,
    createdAt: data.created_at?.split('T')[0] || '',
    updatedAt: data.updated_at?.split('T')[0] || '',
    avatarUrl: data.owner?.avatar_url || '',
    ownerType: data.owner?.type || 'User',
  };
}

async function fetchReadme(owner: string, repo: string): Promise<string> {
  const data = await ghFetch(`/repos/${owner}/${repo}/readme`);
  if (!data?.content) return '';
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function fetchFileTree(owner: string, repo: string, branch: string): Promise<FileNode[]> {
  const data = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  if (!data?.tree) return [];

  // Build tree from flat list
  const root: FileNode[] = [];
  const dirMap = new Map<string, FileNode>();

  // Sort so directories come first
  const sorted = [...data.tree].sort((a: any, b: any) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1;
    if (a.type !== 'tree' && b.type === 'tree') return 1;
    return a.path.localeCompare(b.path);
  });

  for (const item of sorted) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    const node: FileNode = {
      name,
      type: item.type === 'tree' ? 'directory' : 'file',
      ...(item.type !== 'tree' ? { size: item.size } : {}),
      ...(item.type === 'tree' ? { children: [] } : {}),
    };

    if (item.type === 'tree') {
      dirMap.set(item.path, node);
    }

    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = dirMap.get(parentPath);
      if (parent?.children) {
        parent.children.push(node);
      }
    }
  }

  return root;
}

async function fetchIssues(owner: string, repo: string, limit: number = 20): Promise<IssueInfo[]> {
  const data = await ghFetch(`/repos/${owner}/${repo}/issues?state=all&per_page=${limit}&sort=created&direction=desc`);
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((i: any) => !i.pull_request) // exclude PRs
    .map((i: any) => ({
      number: i.number,
      title: i.title,
      body: (i.body || '').substring(0, 2000), // truncate
      state: i.state,
      labels: (i.labels || []).map((l: any) => l.name),
      createdAt: i.created_at?.split('T')[0] || '',
      author: i.user?.login || '',
      commentCount: i.comments || 0,
    }));
}

async function fetchLatestRelease(owner: string, repo: string): Promise<ReleaseInfo | null> {
  const data = await ghFetch(`/repos/${owner}/${repo}/releases/latest`);
  if (!data) return null;
  return {
    tag: data.tag_name,
    name: data.name || data.tag_name,
    body: (data.body || '').substring(0, 2000),
    publishedAt: data.published_at?.split('T')[0] || '',
  };
}

async function fetchAllRepoData(owner: string, repo: string): Promise<{ info: RepoInfo; content: RepoContent }> {
  console.log(`  📡 Fetching repo info...`);
  const info = await fetchRepoInfo(owner, repo);

  console.log(`  📄 Fetching README...`);
  const readme = await fetchReadme(owner, repo);

  console.log(`  📂 Fetching file tree...`);
  const files = await fetchFileTree(owner, repo, info.defaultBranch);

  console.log(`  🐛 Fetching issues...`);
  const issues = await fetchIssues(owner, repo);

  console.log(`  📦 Fetching latest release...`);
  const latestRelease = await fetchLatestRelease(owner, repo);

  return { info, content: { readme, files, issues, latestRelease } };
}

// ═══════════════════════════════════════════
// Auto-detect asset type from repo
// ═══════════════════════════════════════════

function detectAssetType(info: RepoInfo, readme: string): string {
  const text = `${info.description} ${info.topics.join(' ')} ${readme.substring(0, 1500)}`.toLowerCase();

  // 1. Channel（通信器）— 消息渠道适配器，优先判断
  //    包括：飞书/Telegram/Discord 适配器、桌面可视化客户端（WebSocket+UI+双向通信）
  //    核心标准：承担 Agent 与用户之间的消息输入/输出通道
  if (text.includes('channel') || text.includes('adapter') || text.includes('bridge') || text.includes('通信')) return 'channel';
  if ((text.includes('websocket') || text.includes('gateway')) && (text.includes('ui') || text.includes('desktop') || text.includes('display') || text.includes('avatar') || text.includes('companion'))) return 'channel';
  if (text.includes('feishu') && (text.includes('bot') || text.includes('message'))) return 'channel';
  if (text.includes('telegram') && (text.includes('bot') || text.includes('message'))) return 'channel';
  if (text.includes('discord') && (text.includes('bot') || text.includes('message'))) return 'channel';
  if (text.includes('desktop') && (text.includes('tts') || text.includes('voice') || text.includes('speech')) && (text.includes('openclaw') || text.includes('agent'))) return 'channel';

  // 2. Trigger（触发器）— 事件监听与唤醒
  if (text.includes('trigger') || text.includes('watcher') || text.includes('monitor') || text.includes('监控') || text.includes('触发')) return 'trigger';
  if (text.includes('webhook') && !text.includes('channel')) return 'trigger';
  if (text.includes('fswatch') || text.includes('inotify') || text.includes('file watch')) return 'trigger';

  // 3. Plugin（插件工具）— 代码级工具扩展
  if (text.includes('plugin') || text.includes('tool') || text.includes('mcp') || text.includes('插件')) return 'plugin';
  if (text.includes('api') && text.includes('wrapper')) return 'plugin';

  // 4. Config（配置）— Agent 人格/行为/路由定义
  if (text.includes('config') || text.includes('preset') || text.includes('dotfile') || text.includes('配置')) return 'config';
  if (text.includes('soul') && text.includes('persona')) return 'config';

  // 5. Template（模板）— 多类型组合包
  if (text.includes('template') || text.includes('starter') || text.includes('boilerplate') || text.includes('模板')) return 'template';

  // 6. 默认 Skill（技能包）
  return 'skill';
}

// ═══════════════════════════════════════════
// DB operations
// ═══════════════════════════════════════════

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Ensure github-specific columns exist
  const cols = db.prepare("PRAGMA table_info(assets)").all() as { name: string }[];
  const colNames = new Set(cols.map(c => c.name));

  if (!colNames.has('github_url')) {
    db.exec(`ALTER TABLE assets ADD COLUMN github_url TEXT DEFAULT ''`);
  }
  if (!colNames.has('github_stars')) {
    db.exec(`ALTER TABLE assets ADD COLUMN github_stars INTEGER DEFAULT 0`);
  }
  if (!colNames.has('github_forks')) {
    db.exec(`ALTER TABLE assets ADD COLUMN github_forks INTEGER DEFAULT 0`);
  }
  if (!colNames.has('github_language')) {
    db.exec(`ALTER TABLE assets ADD COLUMN github_language TEXT DEFAULT ''`);
  }
  if (!colNames.has('github_license')) {
    db.exec(`ALTER TABLE assets ADD COLUMN github_license TEXT DEFAULT ''`);
  }
  if (!colNames.has('github_synced_at')) {
    db.exec(`ALTER TABLE assets ADD COLUMN github_synced_at TEXT DEFAULT ''`);
  }

  return db;
}

function insertAsset(db: Database.Database, info: RepoInfo, content: RepoContent, opts: {
  type: string; category: string; authorId: string; authorName: string;
}): string {
  const typePrefixes: Record<string, string> = { skill: 's', config: 'c', plugin: 'p', trigger: 'tr', channel: 'ch', template: 't' };
  const prefix = typePrefixes[opts.type] || 'x';
  const id = `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString().split('T')[0];

  // Smart name: use repo name
  const name = info.repo.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const displayName = info.repo.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Tags from topics + language
  const tags = [...info.topics];
  if (info.language && !tags.includes(info.language.toLowerCase())) {
    tags.push(info.language.toLowerCase());
  }
  tags.push('github-import');

  // Description: use GitHub description, fallback to first line of readme
  let description = info.description;
  if (!description && content.readme) {
    const firstLine = content.readme.split('\n').find(l => l.trim() && !l.startsWith('#'));
    description = firstLine?.trim() || `${info.fullName} - imported from GitHub`;
  }
  if (!description) description = `${info.fullName} - imported from GitHub`;

  // Long description with stats
  const longDesc = [
    `⭐ ${info.stars} stars | 🍴 ${info.forks} forks | 📝 ${info.language || 'N/A'}`,
    info.license ? `📜 License: ${info.license}` : '',
    info.homepage ? `🌐 ${info.homepage}` : '',
    `\nImported from [${info.fullName}](https://github.com/${info.fullName})`,
  ].filter(Boolean).join('\n');

  // Version from release or default
  const version = content.latestRelease?.tag?.replace(/^v/, '') || '1.0.0';

  // Versions array
  const versions = content.latestRelease
    ? [{ version, changelog: content.latestRelease.name || content.latestRelease.tag, date: content.latestRelease.publishedAt }]
    : [{ version: '1.0.0', changelog: 'Initial import from GitHub', date: now }];

  const stmt = db.prepare(`
    INSERT INTO assets (
      id, name, display_name, type, author_id, author_name, author_avatar,
      description, long_description, version, downloads, rating, rating_count,
      tags, category, created_at, updated_at, install_command, readme,
      versions, dependencies, issue_count, config_subtype,
      hub_score, hub_score_breakdown, upgrade_rate, compatibility, files,
      github_url, github_stars, github_forks, github_language, github_license, github_synced_at
    ) VALUES (
      @id, @name, @display_name, @type, @author_id, @author_name, @author_avatar,
      @description, @long_description, @version, 0, 0, 0,
      @tags, @category, @created_at, @updated_at, @install_command, @readme,
      @versions, '[]', @issue_count, NULL,
      0, '{}', 0, @compatibility, @files,
      @github_url, @github_stars, @github_forks, @github_language, @github_license, @github_synced_at
    )
  `);

  stmt.run({
    id,
    name,
    display_name: displayName,
    type: opts.type,
    author_id: opts.authorId || `gh-${info.owner.toLowerCase()}`,
    author_name: opts.authorName || info.owner,
    author_avatar: info.avatarUrl || '🐙',
    description,
    long_description: longDesc,
    version,
    tags: JSON.stringify(tags),
    category: opts.category || info.language || '',
    created_at: info.createdAt || now,
    updated_at: now,
    install_command: `seafood-market install ${opts.type}/@gh-${info.owner.toLowerCase()}/${name}`,
    readme: content.readme,
    versions: JSON.stringify(versions),
    issue_count: content.issues.filter(i => i.state === 'open').length,
    compatibility: JSON.stringify({ models: ['Any'], platforms: ['OpenClaw'], frameworks: [info.language || 'N/A'] }),
    files: JSON.stringify(content.files.slice(0, 200)), // limit file tree size
    github_url: `https://github.com/${info.fullName}`,
    github_stars: info.stars,
    github_forks: info.forks,
    github_language: info.language,
    github_license: info.license || '',
    github_synced_at: new Date().toISOString(),
  });

  // Also sync issues to the issues table
  for (const issue of content.issues.slice(0, 50)) {
    const issueId = `gi-${id}-${issue.number}`;
    db.prepare(`
      INSERT OR IGNORE INTO issues (id, asset_id, author_id, author_name, author_avatar, author_type, title, body, status, labels, created_at, comment_count)
      VALUES (?, ?, ?, ?, '🐙', 'user', ?, ?, ?, ?, ?, ?)
    `).run(
      issueId, id, `gh-${issue.author}`, issue.author,
      issue.title, issue.body, issue.state === 'open' ? 'open' : 'closed',
      JSON.stringify(issue.labels), issue.createdAt, issue.commentCount
    );
  }

  return id;
}

function findByGitHubUrl(db: Database.Database, url: string): string | null {
  const row = db.prepare(`SELECT id FROM assets WHERE github_url = ?`).get(url) as { id: string } | undefined;
  return row?.id || null;
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`
🐟 水产市场 GitHub 批量导入工具

Usage:
  npx tsx tools/github-import.ts <url1> [url2] ...
  npx tsx tools/github-import.ts --file urls.txt

Options:
  --type <type>        资产类型 (skill|plugin|trigger|channel|config|template) 默认: 自动检测
  --file <path>        从文件读取 URL（每行一个）
  --dry-run            只预览不写入
  --category <cat>     分类
  --author-id <id>     覆盖作者 ID
  --author-name <name> 覆盖作者名
  --update             如果已存在则更新（默认跳过）

Examples:
  npx tsx tools/github-import.ts https://github.com/anthropics/claude-code
  npx tsx tools/github-import.ts langchain-ai/langchain openai/openai-agents-python --type plugin
  npx tsx tools/github-import.ts --file my-repos.txt --dry-run
`);
    process.exit(0);
  }

  // Parse args
  const urls: string[] = [];
  let type = '';
  let filePath = '';
  let dryRun = false;
  let category = '';
  let authorId = '';
  let authorName = '';
  let update = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type': type = args[++i]; break;
      case '--file': filePath = args[++i]; break;
      case '--dry-run': dryRun = true; break;
      case '--category': category = args[++i]; break;
      case '--author-id': authorId = args[++i]; break;
      case '--author-name': authorName = args[++i]; break;
      case '--update': update = true; break;
      default: urls.push(args[i]);
    }
  }

  // Load URLs from file
  if (filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    urls.push(...lines);
  }

  if (urls.length === 0) {
    console.error('❌ No URLs provided');
    process.exit(1);
  }

  // Parse all URLs
  const repos = urls.map(url => {
    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      console.error(`⚠️  Invalid GitHub URL: ${url}`);
      return null;
    }
    return { url, ...parsed };
  }).filter(Boolean) as { url: string; owner: string; repo: string }[];

  console.log(`\n🐟 水产市场 GitHub 批量导入`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📦 ${repos.length} repos to import`);
  console.log(`${GITHUB_TOKEN ? '🔑 Using GitHub token' : '⚠️  No GitHub token (rate limit: 60 req/h). Set GITHUB_TOKEN for 5000/h'}`);
  if (dryRun) console.log(`🔍 DRY RUN — no database writes`);
  console.log();

  const db = dryRun ? null : getDb();
  const results: ImportResult[] = [];

  for (let i = 0; i < repos.length; i++) {
    const { url, owner, repo } = repos[i];
    console.log(`[${i + 1}/${repos.length}] 🐙 ${owner}/${repo}`);

    try {
      // Check if already imported
      if (db) {
        const existing = findByGitHubUrl(db, `https://github.com/${owner}/${repo}`);
        if (existing && !update) {
          console.log(`  ⏭️  Already imported as ${existing}, skipping (use --update to overwrite)\n`);
          results.push({ url, success: true, assetId: existing, error: 'skipped (already exists)' });
          continue;
        }
      }

      const { info, content } = await fetchAllRepoData(owner, repo);

      // Auto-detect type if not specified
      const assetType = type || detectAssetType(info, content.readme);

      console.log(`  ✅ ${info.fullName}: ⭐${info.stars} 🍴${info.forks} 📝${info.language} → type:${assetType}`);
      console.log(`  📄 README: ${content.readme.length} chars | 📂 Files: ${content.files.length} | 🐛 Issues: ${content.issues.length}`);

      if (dryRun) {
        console.log(`  🔍 DRY RUN — would create asset\n`);
        results.push({ url, success: true });
        continue;
      }

      const assetId = insertAsset(db!, info, content, { type: assetType, category, authorId, authorName });
      console.log(`  💾 Saved as ${assetId}\n`);
      results.push({ url, success: true, assetId });

      // Small delay between requests to be nice to GitHub API
      if (i < repos.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}\n`);
      results.push({ url, success: false, error: err.message });
    }
  }

  // Summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Import Summary`);
  const succeeded = results.filter(r => r.success && !r.error?.includes('skipped'));
  const skipped = results.filter(r => r.error?.includes('skipped'));
  const failed = results.filter(r => !r.success);
  console.log(`  ✅ Imported: ${succeeded.length}`);
  if (skipped.length) console.log(`  ⏭️  Skipped: ${skipped.length}`);
  if (failed.length) console.log(`  ❌ Failed: ${failed.length}`);
  for (const f of failed) {
    console.log(`     ${f.url}: ${f.error}`);
  }
  console.log();

  if (db) db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
