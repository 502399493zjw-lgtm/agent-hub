import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  createAsset, updateAsset, findUserByProvider, createUser, findUserByApiKey,
  isAdmin as isAdminUser, getDb,
} from '@/lib/db';
import { syncGithubStarReputation } from '@/lib/db/economy';

// ═══════════════════════════════════════════
// Auth (shared with import-github)
// ═══════════════════════════════════════════

function hasAdminSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return false;
  const secretBuf = Buffer.from(secret);
  const adminSecretBuf = Buffer.from(adminSecret);
  if (secretBuf.length !== adminSecretBuf.length) {
    const padded = Buffer.alloc(adminSecretBuf.length);
    secretBuf.copy(padded);
    crypto.timingSafeEqual(padded, adminSecretBuf);
    return false;
  }
  return crypto.timingSafeEqual(secretBuf, adminSecretBuf);
}

function isAdmin(request: NextRequest): boolean {
  if (hasAdminSecret(request)) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const user = findUserByApiKey(apiKey);
    if (user && isAdminUser(user.id)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════
// GitHub helpers (fetch from monorepo)
// ═══════════════════════════════════════════

const SKILLS_REPO_OWNER = 'openclaw';
const SKILLS_REPO_NAME = 'skills';

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AgentHub/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function ghFetch(endpoint: string, opts?: { accept?: string; raw?: boolean }): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const headers = ghHeaders();
  if (opts?.accept) headers['Accept'] = opts.accept;

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers });
    if (res.status === 404) return null;

    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') || '999', 10);
    const resetAt = parseInt(res.headers.get('x-ratelimit-reset') || '0', 10);

    if (res.status === 403 && remaining === 0) {
      const waitMs = (resetAt * 1000) - Date.now() + 2000;
      if (waitMs > 0 && waitMs < 600_000) { await sleep(waitMs); continue; }
      throw new Error(`GitHub rate limit exceeded. Resets at ${new Date(resetAt * 1000).toISOString()}`);
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries - 1) { await sleep(Math.pow(2, attempt) * 1000); continue; }
    }
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    if (remaining < 10) console.warn(`⚠️ GitHub rate limit low: ${remaining} remaining`);

    if (opts?.raw) return res.text();
    return res.json();
  }
  throw new Error(`GitHub API failed after ${maxRetries} retries`);
}

// ═══════════════════════════════════════════
// File handling
// ═══════════════════════════════════════════

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml',
  '.toml', '.cfg', '.ini', '.env', '.sh', '.bash', '.zsh', '.py', '.rb',
  '.go', '.rs', '.java', '.c', '.h', '.cpp', '.hpp', '.css', '.scss',
  '.less', '.html', '.htm', '.xml', '.svg', '.dockerfile', '.gitignore',
  '.mjs', '.cjs', '.lock', '.example', '.bat', '.ps1', '.swift', '.kt',
  '.lua', '.pl', '.ex', '.exs', '.vue', '.svelte', '.php', '.sql',
  '.prisma', '.zig', '.dart', '.gradle', '.graphql', '.gql', '.proto',
]);

const TEXT_FILENAMES = new Set([
  'Dockerfile', 'Makefile', 'LICENSE', 'Procfile', 'Gemfile',
  '.gitignore', '.dockerignore', '.env.example', 'SKILL.md',
  'INSTRUCTIONS.md', 'CLAUDE.md', 'AGENTS.md',
]);

const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.wav', '.ogg', '.pdf', '.wasm',
]);

const MAX_SINGLE_FILE = 10 * 1024 * 1024;
const MAX_SINGLE_BINARY = 5 * 1024 * 1024;
const MAX_FILES = 100;
const MAX_BYTES = 50 * 1024 * 1024;

function isTextFile(filepath: string): boolean {
  const basename = path.basename(filepath);
  if (SKIP_FILES.has(basename)) return false;
  if (TEXT_FILENAMES.has(basename)) return true;
  const ext = path.extname(filepath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (!ext && !filepath.includes('/')) return true;
  return false;
}

function isBinaryFile(filepath: string): boolean {
  return BINARY_EXTENSIONS.has(path.extname(filepath).toLowerCase());
}

interface FlatFile {
  path: string;
  content: string;
  binary?: boolean;
  size?: number;
}

/**
 * Recursively list files in a skill directory via GitHub Contents API.
 * (Cannot use recursive tree — monorepo has 67k+ items, truncated by GitHub.)
 */
async function listContentsRecursive(dirPath: string): Promise<Array<{ path: string; sha: string; size: number; type: string }>> {
  const data = await ghFetch(`/repos/${SKILLS_REPO_OWNER}/${SKILLS_REPO_NAME}/contents/${dirPath}?ref=main`);
  if (!data || !Array.isArray(data)) return [];

  const results: Array<{ path: string; sha: string; size: number; type: string }> = [];
  for (const item of data) {
    if (item.type === 'file') {
      results.push({ path: item.name, sha: item.sha, size: item.size || 0, type: 'file' });
    } else if (item.type === 'dir') {
      const subItems = await listContentsRecursive(item.path);
      // Prefix sub-items with relative dir name
      const dirName = item.name;
      for (const sub of subItems) {
        results.push({ ...sub, path: `${dirName}/${sub.path}` });
      }
      await sleep(50); // Rate limiting between dir fetches
    }
  }
  return results;
}

/**
 * Fetch files from a skill directory in the openclaw/skills monorepo.
 * Supports batched fetching via offset — returns up to MAX_FILES files starting from offset.
 * Returns nextOffset for the caller to continue fetching if there are more files.
 */
async function fetchSkillFiles(
  owner: string, slug: string, offset = 0,
): Promise<{ files: FlatFile[]; binaryBuffers: Map<string, Buffer>; nextOffset: number; totalListed: number }> {
  const dirPath = `skills/${owner}/${slug}`;

  // List all files via Contents API (handles monorepo truncation)
  const allItems = await listContentsRecursive(dirPath);

  const blobs = allItems.filter(item => {
    if (item.type !== 'file') return false;
    if (SKIP_FILES.has(path.basename(item.path))) return false;
    if (isTextFile(item.path) && item.size <= MAX_SINGLE_FILE) return true;
    if (isBinaryFile(item.path) && item.size <= MAX_SINGLE_BINARY) return true;
    return false;
  });

  // Priority sort: SKILL.md, README.md, package.json first (ensures metadata in first batch)
  const PRIORITY_FILES = /^(SKILL\.md|README\.md|package\.json|requirements\.txt|LICENSE)/i;
  blobs.sort((a, b) => {
    const aPri = PRIORITY_FILES.test(a.path) ? 0 : 1;
    const bPri = PRIORITY_FILES.test(b.path) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return a.path.localeCompare(b.path);
  });

  // Apply offset-based batching
  const batch = blobs.slice(offset, offset + MAX_FILES);
  const nextOffset = (offset + MAX_FILES < blobs.length) ? offset + MAX_FILES : 0;

  const files: FlatFile[] = [];
  const binaryBuffers = new Map<string, Buffer>();
  let totalBytes = 0;

  for (const blob of batch) {
    if (totalBytes >= MAX_BYTES) break;

    try {
      const blobData = await ghFetch(`/repos/${SKILLS_REPO_OWNER}/${SKILLS_REPO_NAME}/git/blobs/${blob.sha}`);

      if (isBinaryFile(blob.path)) {
        const buf = Buffer.from(blobData?.content || '', 'base64');
        binaryBuffers.set(blob.path, buf);
        files.push({ path: blob.path, content: '', binary: true, size: buf.length });
        totalBytes += buf.length;
      } else {
        let content = '';
        if (blobData?.encoding === 'base64') {
          content = Buffer.from(blobData.content, 'base64').toString('utf8');
        } else if (blobData?.content) {
          content = blobData.content;
        }
        // Skip actual binary content masquerading as text
        const probe = Buffer.from(content.slice(0, 8192));
        if (probe.includes(0)) continue;

        files.push({ path: blob.path, content });
        totalBytes += Buffer.byteLength(content, 'utf8');
      }

      await sleep(50);
    } catch (err: any) {
      console.warn(`  ⚠️ ${blob.path}: ${err.message?.split('\n')[0]}`);
      files.push({ path: blob.path, content: '' });
    }
  }

  return { files, binaryBuffers, nextOffset, totalListed: blobs.length };
}

// ═══════════════════════════════════════════
// Asset type detection for ClawHub skills
// ═══════════════════════════════════════════

/**
 * Detect asset type from SKILL.md content + metadata.
 *
 * 水产市场 DB 合法类型: skill | channel | plugin | trigger | config | template
 * (experience 在新 schema 中可用，但老 DB 不支持，暂映射到 skill)
 *
 * 判定优先级: channel > trigger > plugin > skill (default)
 */
function detectAssetTypeFromSkill(
  skillMd: string,
  readmeMd: string,
  files: FlatFile[],
  meta: { slug: string; displayName: string; description: string },
): string {
  const text = `${meta.slug} ${meta.displayName} ${meta.description} ${skillMd.substring(0, 3000)} ${readmeMd.substring(0, 2000)}`.toLowerCase();
  const filePaths = files.map(f => f.path.toLowerCase());
  const hasCode = filePaths.some(f =>
    f.endsWith('.py') || f.endsWith('.ts') || f.endsWith('.js') ||
    f.endsWith('.go') || f.endsWith('.rs') || f.endsWith('.sh')
  );
  const hasDeps = filePaths.some(f =>
    f === 'package.json' || f === 'requirements.txt' || f === 'cargo.toml' ||
    f === 'go.mod' || f === 'pyproject.toml'
  );
  const hasDockerfile = filePaths.some(f => f === 'dockerfile' || f.startsWith('docker'));

  // ── 1. Channel: messaging adapter / bridge ──
  const channelKeywords = [
    'channel', 'adapter', 'bridge', '通信', 'messaging',
    'telegram bot', 'discord bot', 'slack bot', 'whatsapp',
    'feishu', 'dingtalk', 'wechat bot', 'line bot',
    'irc', 'matrix', 'xmpp', 'signal bot',
  ];
  if (channelKeywords.some(kw => text.includes(kw)) &&
      (text.includes('message') || text.includes('chat') || text.includes('bot'))) {
    if (text.includes('send message') || text.includes('receive') || text.includes('webhook') ||
        text.includes('gateway') || text.includes('relay') || text.includes('integration')) {
      return 'channel';
    }
  }

  // ── 2. Trigger: event listener / watcher / monitor ──
  const triggerKeywords = [
    'trigger', 'watcher', 'monitor', 'listener', 'cron',
    'scheduled', 'polling', 'webhook receiver', 'event-driven',
    'file watch', 'auto-detect', 'surveillance', 'alerting',
    'on new', 'on change', 'when detected',
  ];
  if (triggerKeywords.some(kw => text.includes(kw)) &&
      (text.includes('event') || text.includes('watch') || text.includes('detect') ||
       text.includes('alert') || text.includes('notify'))) {
    return 'trigger';
  }

  // ── 3. Plugin: code-level tool / MCP / CLI / API wrapper ──
  //    Needs actual executable code + dependencies, or explicitly mentions MCP/tool
  const pluginSignals = [
    'mcp', 'plugin', 'cli tool', 'api wrapper', 'server',
    'npm install', 'pip install', 'brew install',
    'binary', 'executable', 'daemon', 'service',
  ];
  const pluginScore = pluginSignals.filter(kw => text.includes(kw)).length;

  // MCP skills are always plugins
  if (text.includes('mcp') && (text.includes('server') || text.includes('tool'))) {
    return 'plugin';
  }
  // Has real code + dependencies = plugin
  if (hasCode && hasDeps) {
    return 'plugin';
  }
  // Strong plugin signals + code
  if (pluginScore >= 2 && (hasCode || hasDockerfile)) {
    return 'plugin';
  }

  // ── 4. Default: skill ──
  // Pure prompt-based ability (SKILL.md + references, maybe light scripts)
  return 'skill';
}

// ═══════════════════════════════════════════
// Package generation
// ═══════════════════════════════════════════

const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

function generatePackage(
  assetId: string, flatFiles: FlatFile[], binaryBuffers?: Map<string, Buffer>,
): { path: string; size: number } | null {
  const hasContent = flatFiles.some(f => f.content || f.binary);
  if (!hasContent) return null;

  fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  const tmpDir = `/tmp/clawhub-import-${assetId}`;
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const f of flatFiles) {
    if (!f.content && !f.binary) continue;
    const filePath = path.join(tmpDir, f.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (f.binary && binaryBuffers?.has(f.path)) {
      fs.writeFileSync(filePath, binaryBuffers.get(f.path)!);
    } else if (f.content) {
      fs.writeFileSync(filePath, f.content);
    }
  }

  const tarPath = path.join(PACKAGES_DIR, `${assetId}.tar.gz`);
  execSync(`tar czf "${tarPath}" -C "${tmpDir}" .`, { stdio: 'pipe' });
  const size = fs.statSync(tarPath).size;
  fs.rmSync(tmpDir, { recursive: true });
  return { path: tarPath, size };
}

function computePackageSha256(tarPath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(tarPath));
  return hash.digest('hex');
}

// ═══════════════════════════════════════════
// Dedup
// ═══════════════════════════════════════════

function findByGithubUrl(githubUrl: string): { id: string; name: string } | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name FROM assets WHERE github_url = ?').get(githubUrl) as { id: string; name: string } | undefined;
  return row || null;
}

// ═══════════════════════════════════════════
// Parse SKILL.md frontmatter
// ═══════════════════════════════════════════

function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)/);
  if (!match) return { data: {}, body: content };
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*)\s*:\s*(.+)/);
    if (m) result[m[1]] = m[2].trim();
  }
  return { data: result, body: match[2].trim() };
}

// ═══════════════════════════════════════════
// POST /api/admin/import-clawhub
// ═══════════════════════════════════════════

/**
 * Import a skill from ClawHub (openclaw/skills monorepo) into 水产市场.
 *
 * Body: {
 *   slug: "wechat-search",           // required — ClawHub skill slug
 *   owner?: "jixsonwang",            // optional — auto-detected from _meta.json if omitted
 *   type?: "skill"|"plugin"|...,     // optional — auto-detected if omitted
 *   update?: boolean,                // update existing (default: skip)
 *   offset?: number,                 // file batch offset (0 = first batch, default)
 *   skipFiles?: boolean,             // skip file fetching entirely (metadata-only import)
 * }
 *
 * Batched: 100 files / 50MB per call. If response includes nextOffset > 0, call again
 * with that offset to fetch remaining files. offset=0 creates the asset + fetches first batch.
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const slug = String(body.slug || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9][a-z0-9._-]*$/.test(slug)) {
    return NextResponse.json(
      { success: false, error: 'Invalid slug. Use the ClawHub skill slug (e.g., "wechat-search").' },
      { status: 400 },
    );
  }

  const shouldUpdate = body.update === true;
  const forceType = (body.type as string) || '';
  const offset = typeof body.offset === 'number' ? Math.max(0, Math.round(body.offset)) : 0;
  const skipFiles = body.skipFiles === true;

  try {
    // ── 1. Resolve owner from _meta.json (or body.owner) ──
    let owner = String(body.owner || '').trim();

    if (!owner) {
      // Try listing skill directories at /repos/openclaw/skills/contents/skills/
      // Then search each owner dir for the slug. More reliable: use _meta.json from known locations.
      // Strategy: fetch the top-level skills/ directory, then check each owner dir for the slug.
      // Optimization: the slug often appears in the awesome-list Excel or _meta.json.
      // For now, try common approach: fetch contents API for the slug name.
      const searchResult = await ghFetch(
        `/search/code?q=filename:_meta.json+path:skills+repo:${SKILLS_REPO_OWNER}/${SKILLS_REPO_NAME}+"${slug}"&per_page=5`
      );
      if (searchResult?.items?.length > 0) {
        for (const item of searchResult.items) {
          // path format: skills/{owner}/{slug}/_meta.json
          const parts = item.path.split('/');
          if (parts.length >= 3 && parts[2] === slug) {
            owner = parts[1];
            break;
          }
        }
      }
    }

    if (!owner) {
      return NextResponse.json(
        { success: false, error: `Cannot find skill "${slug}" in openclaw/skills repo. Provide owner explicitly.` },
        { status: 404 },
      );
    }

    // ── 2. Fetch _meta.json + ClawHub stats ──
    const metaRaw = await ghFetch(
      `/repos/${SKILLS_REPO_OWNER}/${SKILLS_REPO_NAME}/contents/skills/${owner}/${slug}/_meta.json?ref=main`,
      { accept: 'application/vnd.github.v3.raw', raw: true },
    );
    let meta: any = {};
    try { meta = JSON.parse(metaRaw || '{}'); } catch { /* empty */ }

    // Fetch ClawHub stats (stars, owner avatar) via ClawHub API
    let clawhubStats = { stars: 0 };
    let clawhubOwnerAvatar = '';
    try {
      const chRes = await fetch(`https://clawhub.ai/api/v1/skills/${encodeURIComponent(slug)}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (chRes.ok) {
        const chData = await chRes.json();
        clawhubStats.stars = chData?.skill?.stats?.stars || 0;
        clawhubOwnerAvatar = chData?.owner?.image || '';
      }
    } catch { /* ClawHub API optional, continue without */ }

    const slugToTitle = (s: string) => s.split(/[-_]+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    // Use _meta.json displayName only if it's different from slug (otherwise it's just the slug repeated)
    const rawDisplayName = meta.displayName || '';
    const displayName = (rawDisplayName && rawDisplayName !== slug && rawDisplayName !== slug.replace(/-/g, ' '))
      ? rawDisplayName
      : slugToTitle(slug);
    const version = meta.latest?.version || '1.0.0';

    // ── 3. GitHub URL + dedup ──
    const githubUrl = `https://github.com/${SKILLS_REPO_OWNER}/${SKILLS_REPO_NAME}/tree/main/skills/${owner}/${slug}`;

    const existing = findByGithubUrl(githubUrl);
    if (existing && !shouldUpdate) {
      return NextResponse.json({
        success: true,
        data: {
          action: 'skipped',
          reason: 'already_exists',
          assetId: existing.id,
          assetName: existing.name,
          hint: 'Pass update:true to overwrite',
        },
      });
    }

    // ── 4. Fetch files from monorepo (batched) ──
    let files: FlatFile[] = [];
    let binaryBuffers = new Map<string, Buffer>();
    let nextOffset = 0;
    let totalListed = 0;

    if (!skipFiles) {
      const result = await fetchSkillFiles(owner, slug, offset);
      files = result.files;
      binaryBuffers = result.binaryBuffers;
      nextOffset = result.nextOffset;
      totalListed = result.totalListed;
    }

    // ── 5. Extract SKILL.md and README.md ──
    const skillMdFile = files.find(f => f.path === 'SKILL.md');
    const readmeFile = files.find(f => f.path.toLowerCase() === 'readme.md');
    const skillMd = skillMdFile?.content || '';
    const { data: frontmatter, body: skillBody } = parseFrontmatter(skillMd);
    // README: prefer README.md > SKILL.md body (frontmatter stripped)
    const readme = readmeFile?.content || skillBody || skillMd;
    const description = frontmatter.description || meta.description || `${displayName} — imported from ClawHub`;

    // ── 5b. Detect license ──
    let license = '';
    // Check frontmatter first
    if (frontmatter.license) {
      license = frontmatter.license;
    }
    // Check for LICENSE file
    if (!license) {
      const licenseFile = files.find(f => f.path.toUpperCase().startsWith('LICENSE'));
      if (licenseFile?.content) {
        // Try to detect common licenses from content
        const lc = licenseFile.content.substring(0, 500).toLowerCase();
        if (lc.includes('mit license')) license = 'MIT';
        else if (lc.includes('apache license') && lc.includes('2.0')) license = 'Apache-2.0';
        else if (lc.includes('gnu general public license') && lc.includes('version 3')) license = 'GPL-3.0';
        else if (lc.includes('gnu general public license') && lc.includes('version 2')) license = 'GPL-2.0';
        else if (lc.includes('bsd 2-clause')) license = 'BSD-2-Clause';
        else if (lc.includes('bsd 3-clause')) license = 'BSD-3-Clause';
        else if (lc.includes('isc license')) license = 'ISC';
        else if (lc.includes('unlicense')) license = 'Unlicense';
        else if (lc.includes('mozilla public license')) license = 'MPL-2.0';
        else license = 'Other';
      }
    }

    // ── 6. Detect asset type ──
    const assetType = forceType || detectAssetTypeFromSkill(skillMd, readme, files, {
      slug, displayName, description,
    });

    // ── 7. Find or create user ──
    let user = findUserByProvider('github', owner);
    if (!user) {
      // Try to fetch GitHub user info
      const ghUser = await ghFetch(`/users/${owner}`);
      const ghId = ghUser?.id ? String(ghUser.id) : owner;
      user = findUserByProvider('github', ghId);

      if (!user) {
        const userId = `u-${crypto.randomBytes(8).toString('hex')}`;
        // Prefer ClawHub owner avatar > GitHub avatar > emoji fallback
        const avatar = clawhubOwnerAvatar || ghUser?.avatar_url || '🤖';
        user = createUser({
          id: userId,
          email: null,
          name: owner,
          avatar,
          provider: 'github',
          providerId: ghId,
        });
        getDb().prepare('UPDATE users SET invite_code = ? WHERE id = ?').run('CLAWHUB_IMPORT', user.id);
      } else if (clawhubOwnerAvatar && (user.avatar === '🤖' || !user.avatar)) {
        // Update existing user's avatar if it was a placeholder
        getDb().prepare('UPDATE users SET avatar = ? WHERE id = ?').run(clawhubOwnerAvatar, user.id);
        user = { ...user, avatar: clawhubOwnerAvatar };
      }
    } else if (clawhubOwnerAvatar && (user.avatar === '🤖' || !user.avatar)) {
      getDb().prepare('UPDATE users SET avatar = ? WHERE id = ?').run(clawhubOwnerAvatar, user.id);
      user = { ...user, avatar: clawhubOwnerAvatar };
    }

    // ── 8. Build long description ──
    const longDesc = [
      `📦 ClawHub: [${owner}/${slug}](https://clawhub.ai/${owner}/${slug})`,
      `📂 Source: [openclaw/skills](${githubUrl})`,
      version !== '1.0.0' ? `🏷️ Version: ${version}` : '',
      meta.latest?.publishedAt ? `📅 Published: ${new Date(meta.latest.publishedAt).toISOString().split('T')[0]}` : '',
    ].filter(Boolean).join('\n');

    // ── 9. Create or update asset ──
    let assetId: string;
    let action: string;

    if (offset > 0) {
      // Continuation batch — asset must already exist
      const cont = findByGithubUrl(githubUrl);
      if (!cont) {
        return NextResponse.json(
          { success: false, error: `Asset not found for continuation (offset=${offset}). Run offset=0 first.` },
          { status: 400 },
        );
      }
      assetId = cont.id;
      action = 'continued';
      // Merge new files with existing (same logic as import-github)
      if (files.length > 0) {
        const db = getDb();
        const row = db.prepare('SELECT files FROM assets WHERE id = ?').get(assetId) as { files: string } | undefined;
        let existingFiles: FlatFile[] = [];
        try { existingFiles = JSON.parse(row?.files || '[]'); } catch { /* empty */ }

        const pathSet = new Set(existingFiles.map(f => f.path));
        for (const f of files) {
          if (!pathSet.has(f.path)) {
            existingFiles.push(f);
            pathSet.add(f.path);
          }
        }
        updateAsset(assetId, { files: existingFiles as any });
      }
    } else if (existing && shouldUpdate) {
      assetId = existing.id;
      action = 'updated';
      updateAsset(assetId, {
        description,
        longDescription: longDesc,
        readme,
        version,
        files: files as any,
        githubStars: clawhubStats.stars,
        githubLicense: license,
      });
    } else {
      action = 'created';
      const tags: string[] = [];
      // Add frontmatter tags if present
      if (frontmatter.name) {
        const words = frontmatter.name.split(/[-_ ]+/).filter((w: string) => w.length > 2);
        tags.push(...words.slice(0, 3));
      }

      const asset = createAsset({
        name: slug,
        displayName,
        type: assetType,
        description,
        longDescription: longDesc,
        version,
        authorId: user.id,
        authorName: owner,
        authorAvatar: user.avatar || '🤖',
        tags,
        category: '',
        readme,
        githubUrl,
        githubStars: clawhubStats.stars,
        githubForks: 0,
        githubLanguage: '',
        githubLicense: license,
        skipCoinReward: true,
      });
      assetId = asset.id;
      updateAsset(assetId, { files: files as any });
    }

    // ── 10. Generate package (only when all files are fetched) ──
    let packageInfo: { size: number; sha256: string } | null = null;
    if (nextOffset === 0) {
      // All files fetched — generate final package from DB
      const db = getDb();
      const row = db.prepare('SELECT files FROM assets WHERE id = ?').get(assetId) as { files: string } | undefined;
      let allFiles: FlatFile[] = [];
      try { allFiles = JSON.parse(row?.files || '[]'); } catch { /* empty */ }

      if (allFiles.length > 0) {
        // For multi-batch: re-fetch binary blobs not in current batch
        let allBinaryBuffers = binaryBuffers;
        const missingBinaries = allFiles.filter(f => f.binary && !allBinaryBuffers.has(f.path));
        if (missingBinaries.length > 0) {
          const dirItems = await listContentsRecursive(`skills/${owner}/${slug}`);
          for (const missing of missingBinaries) {
            const item = dirItems.find(i => i.path === missing.path);
            if (item?.sha) {
              try {
                const blobData = await ghFetch(`/repos/${SKILLS_REPO_OWNER}/${SKILLS_REPO_NAME}/git/blobs/${item.sha}`);
                if (blobData?.content) {
                  allBinaryBuffers.set(missing.path, Buffer.from(blobData.content, 'base64'));
                }
              } catch { /* skip */ }
            }
          }
        }

        const pkg = generatePackage(assetId, allFiles, allBinaryBuffers);
        if (pkg) {
          const sha256 = computePackageSha256(pkg.path);
          updateAsset(assetId, { packageSha256: sha256 });
          packageInfo = { size: pkg.size, sha256 };
        }
      }
    }

    // ── 11. Sync hub score (only on final batch) ──
    if (nextOffset === 0) {
      syncGithubStarReputation(assetId);
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        asset: {
          id: assetId,
          name: slug,
          displayName,
          type: assetType,
          typeReason: forceType ? 'explicit' : 'auto-detected',
          githubUrl,
          version,
          license: license || null,
        },
        user: { id: user.id, name: user.name },
        files: {
          total: files.length,
          text: files.filter(f => !f.binary).length,
          binary: files.filter(f => f.binary).length,
          totalListed,
        },
        batch: {
          offset,
          nextOffset,
          hint: nextOffset > 0
            ? `More files available. Call again with offset:${nextOffset} to continue.`
            : 'All files fetched.',
        },
        package: packageInfo ? {
          size: packageInfo.size,
          sizeHuman: `${(packageInfo.size / 1024).toFixed(1)}KB`,
          sha256: packageInfo.sha256,
        } : null,
        clawhub: {
          owner,
          slug,
          version,
          stars: clawhubStats.stars,
          url: `https://clawhub.ai/${owner}/${slug}`,
        },
      },
    }, { status: action === 'created' ? 201 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Admin import-clawhub error:', message);
    return NextResponse.json(
      { success: false, error: `Failed to import: ${message.slice(0, 300)}` },
      { status: 500 },
    );
  }
}
