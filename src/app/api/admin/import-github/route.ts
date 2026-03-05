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
// Admin auth
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
// GitHub API (from local script — rate limit aware)
// ═══════════════════════════════════════════

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

interface RateLimitInfo {
  remaining: number;
  resetAt: number; // epoch seconds
}

function parseRateLimit(res: Response): RateLimitInfo {
  return {
    remaining: parseInt(res.headers.get('x-ratelimit-remaining') || '999', 10),
    resetAt: parseInt(res.headers.get('x-ratelimit-reset') || '0', 10),
  };
}

/**
 * GitHub API fetch with retry + rate limit awareness.
 * Returns null on 404.
 */
async function ghFetch(endpoint: string, opts?: { accept?: string; raw?: boolean }): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const headers = ghHeaders();
  if (opts?.accept) headers['Accept'] = opts.accept;

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, { headers });

    if (res.status === 404) return null;

    const rl = parseRateLimit(res);

    // Rate limit exhausted
    if (res.status === 403 && rl.remaining === 0) {
      const waitMs = (rl.resetAt * 1000) - Date.now() + 2000;
      if (waitMs > 0 && waitMs < 600_000) {
        await sleep(waitMs);
        continue;
      }
      throw new Error(`GitHub rate limit exceeded. Resets at ${new Date(rl.resetAt * 1000).toISOString()}`);
    }

    // Retry on 429 / 5xx
    if (res.status === 429 || res.status >= 500) {
      if (attempt < maxRetries - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
    }

    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${(await res.text()).slice(0, 200)}`);

    // Warn low quota
    if (rl.remaining < 10) {
      console.warn(`⚠️ GitHub rate limit low: ${rl.remaining} remaining`);
    }

    if (opts?.raw) return res.text();
    return res.json();
  }
  throw new Error(`GitHub API failed after ${maxRetries} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════
// Text file detection (from local script)
// ═══════════════════════════════════════════

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml',
  '.toml', '.cfg', '.ini', '.env', '.sh', '.bash', '.zsh', '.py', '.rb',
  '.go', '.rs', '.java', '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
  '.css', '.scss', '.less', '.html', '.htm', '.xml', '.svg',
  '.dockerfile', '.gitignore', '.gitattributes',
  '.prettierrc', '.prettierignore', '.eslintrc', '.mjs', '.cjs',
  '.lock', '.example', '.bat', '.ps1', '.swift', '.kt', '.kts',
  '.r', '.R', '.lua', '.pl', '.pm', '.ex', '.exs', '.erl', '.hrl',
  '.hs', '.lhs', '.ml', '.mli', '.fs', '.fsx', '.clj', '.cljs',
  '.scala', '.sc', '.vue', '.svelte', '.astro', '.php', '.phtml',
  '.tf', '.hcl', '.nix', '.dhall', '.graphql', '.gql', '.proto',
  '.sql', '.prisma', '.wasm', '.wat', '.zig', '.nim', '.v',
  '.d', '.dart', '.cmake', '.gradle', '.sbt', '.cabal',
]);

const TEXT_FILENAMES = new Set([
  'Dockerfile', 'Makefile', 'LICENSE', 'Procfile', 'Gemfile',
  '.gitignore', '.gitattributes', '.prettierrc', '.prettierignore',
  '.dockerignore', '.env', '.env.example', 'CLAUDE.md', 'AGENTS.md',
  'SKILL.md', 'INSTRUCTIONS.md', 'Rakefile', 'Justfile', 'Taskfile',
  'Vagrantfile', 'Brewfile', 'Cakefile', 'Guardfile', 'Thorfile',
]);

const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

// Binary file extensions that should be included in packages (but not stored as text in DB)
const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg',
  // Fonts
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.m4a',
  // Documents
  '.pdf',
  // Data
  '.sqlite', '.db',
  // Compiled / binary assets
  '.wasm',
]);

const MAX_SINGLE_BINARY = 5 * 1024 * 1024; // 5MB per binary file

function isBinaryFile(filepath: string): boolean {
  const ext = path.extname(filepath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

const PRIORITY_PATTERNS = [
  /^README/i, /^LICENSE/i, /^CONTRIBUTING/i, /^CHANGELOG/i, /^CLAUDE\.md$/i, /^AGENTS\.md$/i,
  /^SKILL\.md$/i, /^INSTRUCTIONS\.md$/i,
  /^package\.json$/, /^Dockerfile$/, /^docker-compose/,
  /^\.gitignore$/, /^\.env\.example$/,
  /^src\//, /^lib\//, /^skills\//, /^scripts\//,
];

function isTextFile(filepath: string): boolean {
  const basename = path.basename(filepath);
  if (SKIP_FILES.has(basename)) return false;
  if (TEXT_FILENAMES.has(basename)) return true;
  const ext = path.extname(filepath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // No-extension files in root are often text (LICENSE, Makefile, etc.)
  if (!ext && !filepath.includes('/')) return true;
  return false;
}

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

/** Flat file for DB storage + tar.gz generation */
interface FlatFile {
  path: string;
  content: string;       // text content, or '' for binary/directory
  binary?: boolean;       // true = binary file (content stored in package only)
  size?: number;          // file size in bytes (useful for binary display)
}

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
  ownerType: string;
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

// ═══════════════════════════════════════════
// Batch file fetching — the core improvement
// ═══════════════════════════════════════════

/**
 * Batched file content fetching strategy:
 *
 * Limits (dual-cap, whichever hits first):
 *   - MAX_FILES_PER_BATCH = 100 files
 *   - MAX_BYTES_PER_BATCH = 50MB cumulative content
 *   - MAX_SINGLE_FILE = 10MB per file
 *
 * Returns:
 *   - files: FlatFile[] fetched in this batch
 *   - remaining: number of unfetched files
 *   - nextOffset: starting index for next batch (0 = done)
 *   - totalEligible: total text files eligible for fetching
 */
const MAX_FILES_PER_BATCH = 100;
const MAX_BYTES_PER_BATCH = 50 * 1024 * 1024; // 50MB
const MAX_SINGLE_FILE = 10 * 1024 * 1024;      // 10MB

interface BatchResult {
  files: FlatFile[];
  binaryBuffers: Map<string, Buffer>;  // path → raw buffer (for tar.gz only, not stored in DB)
  totalEligible: number;
  fetchedInBatch: number;
  totalBytes: number;
  remaining: number;
  nextOffset: number; // 0 = all done
}

async function fetchFilesBatched(
  owner: string, repo: string, branch: string,
  offset: number = 0,
  subPath?: string,
): Promise<BatchResult> {
  const emptyResult: BatchResult = { files: [], binaryBuffers: new Map(), totalEligible: 0, fetchedInBatch: 0, totalBytes: 0, remaining: 0, nextOffset: 0 };

  // 1. Get full tree (one API call, returns all paths)
  const data = await ghFetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  if (!data?.tree) return emptyResult;

  // Filter to subPath if specified
  const prefix = subPath ? (subPath.endsWith('/') ? subPath : subPath + '/') : '';
  let items = data.tree;
  if (prefix) {
    items = items.filter((i: any) => i.path.startsWith(prefix)).map((i: any) => ({ ...i, path: i.path.slice(prefix.length) }));
  }

  // 2. Filter: text OR whitelisted binary files, within size limit, skip junk
  let blobs = items.filter((item: any) => {
    if (item.type !== 'blob') return false;
    const basename = path.basename(item.path);
    if (SKIP_FILES.has(basename)) return false;
    const fileSize = item.size || 0;

    // Text file: up to MAX_SINGLE_FILE (10MB)
    if (isTextFile(item.path) && fileSize <= MAX_SINGLE_FILE) return true;

    // Binary file: up to MAX_SINGLE_BINARY (5MB), must be in whitelist
    if (isBinaryFile(item.path) && fileSize <= MAX_SINGLE_BINARY) return true;

    return false;
  });

  // Also collect top-level directory names (for tree structure context)
  const topDirs = items
    .filter((i: any) => i.type === 'tree' && !i.path.includes('/'))
    .map((i: any) => ({ path: i.path, content: '' } as FlatFile));

  const totalEligible = blobs.length;

  // 3. Sort: priority files first, then alphabetical
  blobs.sort((a: any, b: any) => {
    const aPri = PRIORITY_PATTERNS.some(p => p.test(a.path)) ? 0 : 1;
    const bPri = PRIORITY_PATTERNS.some(p => p.test(b.path)) ? 0 : 1;
    if (aPri !== bPri) return aPri - bPri;
    return a.path.localeCompare(b.path);
  });

  // 4. Slice from offset
  const blobsFromOffset = blobs.slice(offset);

  // 5. Fetch with dual-cap (text + binary)
  const files: FlatFile[] = offset === 0 ? [...topDirs] : []; // only include dirs in first batch
  const binaryBuffers = new Map<string, Buffer>();
  let totalBytes = 0;
  let fetchedCount = 0;

  for (const blob of blobsFromOffset) {
    if (fetchedCount >= MAX_FILES_PER_BATCH) break;
    if (totalBytes >= MAX_BYTES_PER_BATCH) break;

    const knownBinary = isBinaryFile(blob.path);

    try {
      const blobData = await ghFetch(`/repos/${owner}/${repo}/git/blobs/${blob.sha}`);

      if (knownBinary) {
        // ── Binary file: decode to buffer, store for tar.gz only ──
        const buf = Buffer.from(blobData?.content || '', 'base64');
        if (totalBytes + buf.length > MAX_BYTES_PER_BATCH && fetchedCount > 0) break;
        binaryBuffers.set(blob.path, buf);
        files.push({ path: blob.path, content: '', binary: true, size: buf.length });
        totalBytes += buf.length;
        fetchedCount++;
      } else {
        // ── Text file: decode to string ──
        let content = '';
        if (blobData?.encoding === 'base64') {
          content = Buffer.from(blobData.content, 'base64').toString('utf8');
        } else if (blobData?.content) {
          content = blobData.content;
        }

        // Check if it's actually binary (null bytes in first 8KB)
        const probe = Buffer.from(content.slice(0, 8192));
        if (probe.includes(0)) {
          // Unexpected binary — include as binary asset if within size limit
          const buf = Buffer.from(blobData.content, 'base64');
          if (buf.length <= MAX_SINGLE_BINARY) {
            if (totalBytes + buf.length > MAX_BYTES_PER_BATCH && fetchedCount > 0) break;
            binaryBuffers.set(blob.path, buf);
            files.push({ path: blob.path, content: '', binary: true, size: buf.length });
            totalBytes += buf.length;
            fetchedCount++;
          }
          continue;
        }

        const contentBytes = Buffer.byteLength(content, 'utf8');
        if (totalBytes + contentBytes > MAX_BYTES_PER_BATCH && fetchedCount > 0) break;

        files.push({ path: blob.path, content });
        totalBytes += contentBytes;
        fetchedCount++;
      }

      // Gentle rate limiting: 50ms between blob fetches
      await sleep(50);
    } catch (err: any) {
      // Log but continue
      console.warn(`  ⚠️ ${blob.path}: ${err.message?.split('\n')[0]}`);
      files.push({ path: blob.path, content: '' });
      fetchedCount++;
    }
  }

  const remaining = totalEligible - offset - fetchedCount;
  const nextOffset = remaining > 0 ? offset + fetchedCount : 0;

  return { files, binaryBuffers, totalEligible, fetchedInBatch: fetchedCount, totalBytes, remaining, nextOffset };
}

// ═══════════════════════════════════════════
// Repo metadata fetching
// ═══════════════════════════════════════════

async function fetchRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
  const data = await ghFetch(`/repos/${owner}/${repo}`);
  if (!data) throw new Error(`Repo not found: ${owner}/${repo}`);
  return {
    owner, repo,
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

async function fetchReadme(owner: string, repo: string, subPath?: string, branch?: string): Promise<string> {
  // Try sub-directory README first
  if (subPath) {
    const subReadme = await ghFetch(
      `/repos/${owner}/${repo}/contents/${subPath}/README.md?ref=${branch || 'main'}`,
      { accept: 'application/vnd.github.v3.raw', raw: true }
    );
    if (subReadme) return subReadme;
  }
  // Fallback to repo-level
  const data = await ghFetch(`/repos/${owner}/${repo}/readme`);
  if (!data?.content) return '';
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function fetchIssues(owner: string, repo: string, limit = 20): Promise<IssueInfo[]> {
  const data = await ghFetch(`/repos/${owner}/${repo}/issues?state=all&per_page=${limit}&sort=created&direction=desc`);
  if (!data || !Array.isArray(data)) return [];
  return data
    .filter((i: any) => !i.pull_request)
    .map((i: any) => ({
      number: i.number,
      title: i.title,
      body: (i.body || '').substring(0, 2000),
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

// ═══════════════════════════════════════════
// Asset type detection (enriched from local script)
// ═══════════════════════════════════════════

function detectAssetType(info: RepoInfo, readme: string): string {
  const text = `${info.description} ${info.topics.join(' ')} ${readme.substring(0, 1500)}`.toLowerCase();

  // 1. Channel
  if (text.includes('channel') || text.includes('adapter') || text.includes('bridge') || text.includes('通信')) return 'channel';
  if ((text.includes('websocket') || text.includes('gateway')) && (text.includes('ui') || text.includes('desktop'))) return 'channel';
  if ((text.includes('feishu') || text.includes('telegram') || text.includes('discord')) && (text.includes('bot') || text.includes('message'))) return 'channel';

  // 2. Trigger
  if (text.includes('trigger') || text.includes('watcher') || text.includes('monitor') || text.includes('触发')) return 'trigger';
  if (text.includes('webhook') && !text.includes('channel')) return 'trigger';

  // 3. Plugin
  if (text.includes('plugin') || text.includes('tool') || text.includes('mcp') || text.includes('插件')) return 'plugin';
  if (text.includes('api') && text.includes('wrapper')) return 'plugin';

  // 4. Experience
  if (text.includes('config') || text.includes('preset') || text.includes('persona') || text.includes('experience')) return 'experience';

  // 5. Default: Skill
  return 'skill';
}

// ═══════════════════════════════════════════
// Package generation (.tar.gz)
// ═══════════════════════════════════════════

const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

function generatePackage(
  assetId: string,
  flatFiles: FlatFile[],
  binaryBuffers?: Map<string, Buffer>,
): { path: string; size: number } | null {
  const hasContent = flatFiles.some(f => f.content || f.binary);
  if (!hasContent) return null;

  fs.mkdirSync(PACKAGES_DIR, { recursive: true });

  const tmpDir = `/tmp/ghimport-${assetId}`;
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  for (const f of flatFiles) {
    // Skip directory placeholders (no content, not binary)
    if (!f.content && !f.binary) continue;

    const filePath = path.join(tmpDir, f.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (f.binary && binaryBuffers?.has(f.path)) {
      // Binary file: write raw buffer
      fs.writeFileSync(filePath, binaryBuffers.get(f.path)!);
    } else if (f.content) {
      // Text file: write string
      fs.writeFileSync(filePath, f.content);
    }
  }

  const tarPath = path.join(PACKAGES_DIR, `${assetId}.tar.gz`);
  execSync(`tar czf "${tarPath}" -C "${tmpDir}" .`, { stdio: 'pipe' });
  const size = fs.statSync(tarPath).size;

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });

  return { path: tarPath, size };
}

function computePackageSha256(tarPath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(tarPath));
  return hash.digest('hex');
}

// ═══════════════════════════════════════════
// Dedup: find existing asset by github_url
// ═══════════════════════════════════════════

function findByGithubUrl(githubUrl: string): { id: string; name: string } | null {
  const db = getDb();
  const row = db.prepare('SELECT id, name FROM assets WHERE github_url = ?').get(githubUrl) as { id: string; name: string } | undefined;
  return row || null;
}

// ═══════════════════════════════════════════
// Long description with stats
// ═══════════════════════════════════════════

function buildLongDescription(info: RepoInfo, release: ReleaseInfo | null): string {
  return [
    `⭐ ${info.stars} stars | 🍴 ${info.forks} forks | 📝 ${info.language || 'N/A'}`,
    info.license ? `📜 License: ${info.license}` : '',
    info.homepage ? `🌐 ${info.homepage}` : '',
    `\nImported from [${info.fullName}](https://github.com/${info.fullName})`,
    release ? `\nLatest release: ${release.tag} (${release.publishedAt})` : '',
  ].filter(Boolean).join('\n');
}

// ═══════════════════════════════════════════
// POST /api/admin/import-github
// ═══════════════════════════════════════════

/**
 * Admin-only: Import a GitHub repo as an asset.
 *
 * Features (migrated from local script):
 * - Text-only file fetching (TEXT_EXTENSIONS whitelist)
 * - Batched: 100 files / 50MB per call, pass offset for continuation
 * - Single file ≤ 10MB
 * - Dedup via github_url (skip or update)
 * - Rate limit aware (retry + exponential backoff)
 * - Generates .tar.gz package for CLI download
 * - Fetches issues + latest release
 * - Priority file ordering (README, package.json first)
 *
 * Body: {
 *   repo: "owner/repo",              // required
 *   path?: string,                   // optional sub-directory
 *   type?: "skill"|"channel"|...,    // optional, auto-detected if omitted
 *   category?: string,
 *   update?: boolean,                // update existing asset (default: skip)
 *   offset?: number,                 // file batch offset (0 = first batch, default)
 *   skipFiles?: boolean,             // skip file fetching entirely
 * }
 *
 * Response includes `nextOffset` — if > 0, call again with that offset to fetch more files.
 */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  let repo = String(body.repo || '').trim();
  const urlMatch = repo.match(/github\.com\/([^/]+\/[^/]+)/);
  if (urlMatch) repo = urlMatch[1].replace(/\.git$/, '');

  if (!repo || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
    return NextResponse.json(
      { success: false, error: 'Invalid repo format. Use owner/repo or full GitHub URL.' },
      { status: 400 }
    );
  }

  const [owner, repoName] = repo.split('/');
  const subPath = (body.path as string) || '';
  const shouldUpdate = body.update === true;
  const offset = typeof body.offset === 'number' ? body.offset : 0;
  const skipFiles = body.skipFiles === true;

  try {
    // ── 1. Repo info ──
    const info = await fetchRepoInfo(owner, repoName);

    // ── 2. Determine github_url (may include subPath) ──
    const isSingleFile = subPath && /\.[a-zA-Z0-9]+$/.test(subPath);
    const githubUrl = subPath
      ? `https://github.com/${info.fullName}/${isSingleFile ? 'blob' : 'tree'}/${info.defaultBranch}/${subPath}`
      : `https://github.com/${info.fullName}`;

    // ── 3. Dedup check ──
    const existing = findByGithubUrl(githubUrl);
    if (existing && !shouldUpdate && offset === 0) {
      return NextResponse.json({
        success: true,
        data: {
          action: 'skipped',
          reason: 'already_exists',
          assetId: existing.id,
          assetName: existing.name,
          hint: 'Pass update:true to overwrite, or offset>0 to continue file fetching',
        },
      }, { status: 200 });
    }

    // ── 4. README ──
    const readme = await fetchReadme(owner, repoName, subPath || undefined, info.defaultBranch);

    // ── 5. Asset type ──
    const assetType = (body.type as string) || detectAssetType(info, readme);

    // ── 6. Issues + Release ──
    const issues = await fetchIssues(owner, repoName);
    const latestRelease = await fetchLatestRelease(owner, repoName);

    // ── 7. Batched file fetching ──
    let batchResult: BatchResult = {
      files: [], binaryBuffers: new Map(), totalEligible: 0, fetchedInBatch: 0, totalBytes: 0, remaining: 0, nextOffset: 0,
    };
    if (!skipFiles) {
      batchResult = await fetchFilesBatched(owner, repoName, info.defaultBranch, offset, subPath || undefined);
    }

    // ── 8. Find or create user ──
    let user = findUserByProvider('github', String(info.avatarUrl ? info.owner : owner));
    // Try by owner login
    if (!user) user = findUserByProvider('github', owner);
    // Fetch owner ID from the info we already have
    const ownerData = await ghFetch(`/users/${owner}`);
    const ownerId = ownerData?.id ? String(ownerData.id) : owner;
    if (!user) user = findUserByProvider('github', ownerId);

    if (!user) {
      const userId = `u-${crypto.randomBytes(8).toString('hex')}`;
      user = createUser({
        id: userId,
        email: null,
        name: owner,
        avatar: info.avatarUrl || '🤖',
        provider: 'github',
        providerId: ownerId,
      });
      getDb().prepare('UPDATE users SET invite_code = ? WHERE id = ?').run('ADMIN_IMPORT', user.id);
    }

    // ── 9. Version from release ──
    const version = latestRelease?.tag?.replace(/^v/, '') || '1.0.0';

    // ── 10. Create or update asset ──
    let assetId: string;
    let assetName: string = '';
    let action: string;

    if (existing && (shouldUpdate || offset > 0)) {
      // UPDATE: merge new files with existing
      assetId = existing.id;
      action = offset > 0 ? 'continued' : 'updated';

      // For continuation (offset > 0), we need to merge files
      if (offset > 0 && batchResult.files.length > 0) {
        const db = getDb();
        const row = db.prepare('SELECT files FROM assets WHERE id = ?').get(assetId) as { files: string } | undefined;
        let existingFiles: FlatFile[] = [];
        try { existingFiles = JSON.parse(row?.files || '[]'); } catch { /* empty */ }

        // Merge: add new files, replace if same path exists
        const pathSet = new Set(existingFiles.map(f => f.path));
        for (const f of batchResult.files) {
          if (!pathSet.has(f.path)) {
            existingFiles.push(f);
            pathSet.add(f.path);
          }
        }

        updateAsset(assetId, { files: existingFiles as any });
      } else {
        // Full update (offset=0, update=true)
        const longDesc = buildLongDescription(info, latestRelease);
        updateAsset(assetId, {
          description: info.description || `GitHub: ${repo}`,
          longDescription: longDesc,
          readme,
          version,
          githubStars: info.stars,
          githubForks: info.forks,
          githubLanguage: info.language,
          githubLicense: info.license || '',
          tags: [...info.topics.slice(0, 5), 'github-import'],
          files: batchResult.files as any,
        });
      }
    } else {
      // CREATE new asset
      action = 'created';

      const displayName = subPath
        ? (isSingleFile
          ? (subPath.split('/').pop() || subPath).replace(/\.[^.]+$/, '').split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          : subPath.split('/').filter(Boolean).pop() || info.repo)
        : info.repo;

      assetName = (subPath ? displayName : info.repo).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const name = assetName;

      const tags = [...info.topics.slice(0, 5)];
      if (info.language && !tags.includes(info.language.toLowerCase())) {
        tags.push(info.language.toLowerCase());
      }
      tags.push('github-import');

      let description = info.description;
      if (!description && readme) {
        const firstLine = readme.split('\n').find(l => l.trim() && !l.startsWith('#'));
        description = firstLine?.trim() || `${info.fullName} - imported from GitHub`;
      }
      if (!description) description = `${info.fullName} - imported from GitHub`;

      const longDesc = buildLongDescription(info, latestRelease);

      const asset = createAsset({
        name,
        displayName,
        type: assetType,
        description,
        longDescription: longDesc,
        version,
        authorId: user.id,
        authorName: owner,
        authorAvatar: info.avatarUrl || '🤖',
        tags,
        category: (body.category as string) || info.language || '',
        readme,
        githubUrl,
        githubStars: info.stars,
        githubForks: info.forks,
        githubLanguage: info.language,
        githubLicense: info.license || '',
        skipCoinReward: true, // admin import, no coin reward
      });
      assetId = asset.id;

      // Store files
      if (batchResult.files.length > 0) {
        updateAsset(assetId, { files: batchResult.files as any });
      }
    }

    // ── 11. Generate .tar.gz package ──
    // Re-read all files from DB to build complete package (with binary re-fetch for multi-batch)
    let packageInfo: { size: number; sha256: string } | null = null;
    if (batchResult.remaining === 0) {
      // All files fetched — generate final package
      const db = getDb();
      const row = db.prepare('SELECT files FROM assets WHERE id = ?').get(assetId) as { files: string } | undefined;
      let allFiles: FlatFile[] = [];
      try { allFiles = JSON.parse(row?.files || '[]'); } catch { /* empty */ }

      if (allFiles.length > 0) {
        // For binary files: use in-memory buffers from current batch,
        // or re-fetch from GitHub if this is a multi-batch completion
        let allBinaryBuffers = batchResult.binaryBuffers;

        // Check if there are binary files that aren't in current batch buffers
        const missingBinaries = allFiles.filter(f => f.binary && !allBinaryBuffers.has(f.path));
        if (missingBinaries.length > 0) {
          // Re-fetch missing binary blobs from GitHub
          const treeData = await ghFetch(`/repos/${owner}/${repoName}/git/trees/${info.defaultBranch}?recursive=1`);
          if (treeData?.tree) {
            for (const missing of missingBinaries) {
              const treeItem = treeData.tree.find((t: any) => t.path === missing.path || t.path === (subPath ? `${subPath}/${missing.path}` : missing.path));
              if (treeItem?.sha) {
                try {
                  const blobData = await ghFetch(`/repos/${owner}/${repoName}/git/blobs/${treeItem.sha}`);
                  if (blobData?.content) {
                    allBinaryBuffers.set(missing.path, Buffer.from(blobData.content, 'base64'));
                  }
                  await sleep(50);
                } catch { /* skip on error */ }
              }
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

    // ── 12. Sync issues to issues table ──
    if (offset === 0 && issues.length > 0) {
      const db = getDb();
      for (const issue of issues.slice(0, 50)) {
        const issueId = `gi-${assetId}-${issue.number}`;
        db.prepare(`
          INSERT OR IGNORE INTO issues (id, asset_id, author_id, author_name, author_avatar, author_type, title, body, status, labels, created_at, comment_count)
          VALUES (?, ?, ?, ?, '🐙', 'user', ?, ?, ?, ?, ?, ?)
        `).run(
          issueId, assetId, `gh-${issue.author}`, issue.author,
          issue.title, issue.body, issue.state === 'open' ? 'open' : 'closed',
          JSON.stringify(issue.labels), issue.createdAt, issue.commentCount
        );
      }
    }

    // ── 13. Sync hub score ──
    syncGithubStarReputation(assetId);

    // ── Response ──
    return NextResponse.json({
      success: true,
      data: {
        action,
        asset: {
          id: assetId,
          name: existing?.name || assetName,
          type: assetType,
          githubUrl,
          version,
        },
        user: { id: user.id, name: user.name },
        files: {
          totalEligible: batchResult.totalEligible,
          fetchedInBatch: batchResult.fetchedInBatch,
          totalBytes: batchResult.totalBytes,
          remaining: batchResult.remaining,
          nextOffset: batchResult.nextOffset,
        },
        package: packageInfo ? {
          size: packageInfo.size,
          sizeHuman: `${(packageInfo.size / 1024).toFixed(1)}KB`,
          sha256: packageInfo.sha256,
        } : (batchResult.remaining > 0 ? { pending: true, hint: `Call again with offset:${batchResult.nextOffset} to continue` } : null),
        issues: { total: issues.length, open: issues.filter(i => i.state === 'open').length },
        release: latestRelease ? { tag: latestRelease.tag, date: latestRelease.publishedAt } : null,
      },
    }, { status: action === 'created' ? 201 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Admin import-github error:', message.replace(/token\s+\S+/gi, 'token [REDACTED]'));
    return NextResponse.json(
      { success: false, error: `Failed to import: ${message.slice(0, 200)}` },
      { status: 500 }
    );
  }
}