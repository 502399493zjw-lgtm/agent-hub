import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createAsset, updateAsset, findUserByProvider, createUser, findUserByApiKey,
  isAdmin as isAdminUser, getDb,
} from '@/lib/db';
import { syncGithubStarReputation } from '@/lib/db/economy';

// ── Admin auth (same as /api/admin/invite) ──

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

// ── GitHub fetch helpers ──

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AgentHub/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    h['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function ghFetch(url: string, accept?: string): Promise<Response> {
  const headers = ghHeaders();
  if (accept) headers['Accept'] = accept;
  return fetch(url, { headers });
}

// ── File tree fetching ──

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  content?: string;
  encoding?: 'base64';
  children?: FileNode[];
}

/** Size limit for fetching individual file content (20MB) */
const MAX_FILE_SIZE = 20 * 1024 * 1024;
/** Max total tree items to process (skip huge repos) */
const MAX_TREE_ITEMS = 2000;
/** Skip only OS junk files */
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
/** Important files to always try to fetch content for */
const IMPORTANT_FILES = new Set([
  'SKILL.md', 'AGENTS.md', 'README.md', 'readme.md',
  'package.json', 'CLAUDE.md', 'INSTRUCTIONS.md',
  'config.json', 'capabilities.json', 'manifest.json',
]);

function shouldSkipFile(name: string): boolean {
  return SKIP_FILES.has(name);
}

function isImportantFile(name: string): boolean {
  return IMPORTANT_FILES.has(name);
}

/**
 * Fetch the full file tree from a GitHub repo using the Trees API (recursive).
 * Then selectively fetch content for important / small text files.
 */
async function fetchRepoFiles(repo: string, defaultBranch: string, subPath?: string): Promise<FileNode[]> {
  // 1. Get recursive tree
  const treeRes = await ghFetch(
    `https://api.github.com/repos/${repo}/git/trees/${defaultBranch}?recursive=1`
  );
  if (!treeRes.ok) return [];

  const treeData = await treeRes.json();
  const allItems: Array<{ path: string; type: string; size?: number }> = treeData.tree || [];

  // Guard: skip huge repos to avoid OOM
  if (allItems.length > MAX_TREE_ITEMS) {
    console.warn(`Repo ${repo} has ${allItems.length} items (>${MAX_TREE_ITEMS}), truncating tree`);
  }
  const items = allItems.slice(0, MAX_TREE_ITEMS);

  // If subPath specified, filter to only items under that path
  const prefix = subPath ? (subPath.endsWith('/') ? subPath : subPath + '/') : '';
  const filtered = prefix
    ? items.filter((i) => i.path.startsWith(prefix)).map((i) => ({ ...i, path: i.path.slice(prefix.length) }))
    : items;

  // 2. Build tree structure
  const root: FileNode[] = [];
  const dirMap = new Map<string, FileNode>();

  // Sort so directories come first, then files
  const sorted = [...filtered].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    const parts = item.path.split('/');
    const name = parts[parts.length - 1];
    if (!name || shouldSkipFile(name)) continue;

    const node: FileNode = {
      name,
      type: item.type === 'tree' ? 'directory' : 'file',
      size: item.size,
    };

    if (item.type === 'tree') {
      node.children = [];
      dirMap.set(item.path, node);
    }

    // Find parent
    if (parts.length === 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join('/');
      const parent = dirMap.get(parentPath);
      if (parent?.children) {
        parent.children.push(node);
      }
      // else: orphan (parent was skipped), attach to root
    }
  }

  // 3. Fetch content for ALL text files (skip binary via extension check)
  const filesToFetch: Array<{ path: string; node: FileNode }> = [];

  function collectFiles(nodes: FileNode[], pathPrefix: string) {
    for (const n of nodes) {
      const fullPath = pathPrefix ? `${pathPrefix}/${n.name}` : n.name;
      if (n.type === 'file' && !shouldSkipFile(n.name)) {
        if ((n.size ?? 0) === 0) {
          // Zero-byte files: set empty content directly
          n.content = '';
        } else if ((n.size ?? 0) <= MAX_FILE_SIZE) {
          filesToFetch.push({ path: fullPath, node: n });
        }
        // Files > MAX_FILE_SIZE: keep in tree but without content (too large)
      } else if (n.type === 'directory' && n.children) {
        collectFiles(n.children, fullPath);
      }
    }
  }
  collectFiles(root, '');

  // Prioritize important files first, then by size
  filesToFetch.sort((a, b) => {
    const aImp = isImportantFile(a.node.name) ? 0 : 1;
    const bImp = isImportantFile(b.node.name) ? 0 : 1;
    if (aImp !== bImp) return aImp - bImp;
    return (a.node.size || 0) - (b.node.size || 0);
  });

  // Fetch ALL files in batches of 10
  for (let i = 0; i < filesToFetch.length; i += 10) {
    const batch = filesToFetch.slice(i, i + 10);
    await Promise.allSettled(
      batch.map(async ({ path: filePath, node }) => {
        const contentPath = prefix ? prefix + filePath : filePath;
        const res = await ghFetch(
          `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(contentPath)}?ref=${defaultBranch}`,
          'application/vnd.github.v3.raw'
        );
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          // Check if binary (null bytes in first 8KB)
          const probe = buf.subarray(0, 8192);
          if (probe.includes(0)) {
            // Binary file: store as base64
            node.content = buf.toString('base64');
            node.encoding = 'base64';
          } else {
            node.content = buf.toString('utf-8');
          }
        }
      })
    );
    // Ignore individual failures
  }

  return root;
}

// ── Infer asset type from repo metadata ──

function inferAssetType(repoData: Record<string, unknown>, topics: string[]): string {
  const allTopics = topics.map((t) => t.toLowerCase());
  const desc = ((repoData.description as string) || '').toLowerCase();

  if (allTopics.includes('openclaw-channel') || desc.includes('channel')) return 'channel';
  if (allTopics.includes('openclaw-plugin') || desc.includes('plugin')) return 'plugin';
  if (allTopics.includes('openclaw-trigger') || desc.includes('trigger')) return 'trigger';
  if (allTopics.includes('openclaw-template') || desc.includes('template')) return 'template';
  if (allTopics.includes('openclaw-experience') || desc.includes('config') || desc.includes('persona')) return 'experience';
  return 'skill'; // default
}

/**
 * POST /api/admin/import-github
 *
 * Admin-only: Import a GitHub repo as an asset.
 * Automatically finds or creates a user for the repo owner (provider=github).
 *
 * Body: {
 *   repo: "owner/repo",         // required — GitHub owner/repo
 *   path?: string,              // optional — sub-directory path (for monorepo skills)
 *   type?: "skill"|"channel"..., // optional — override auto-detected type
 *   category?: string,          // optional
 *   skipFiles?: boolean,        // optional — skip file tree fetching (faster)
 * }
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

  // Accept full URL or owner/repo
  const urlMatch = repo.match(/github\.com\/([^/]+\/[^/]+)/);
  if (urlMatch) repo = urlMatch[1].replace(/\.git$/, '');

  if (!repo || !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
    return NextResponse.json(
      { success: false, error: 'Invalid repo format. Use owner/repo or full GitHub URL.' },
      { status: 400 }
    );
  }

  try {
    // ── 1. Fetch repo metadata ──
    const repoRes = await ghFetch(`https://api.github.com/repos/${repo}`);
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        return NextResponse.json({ success: false, error: 'Repository not found' }, { status: 404 });
      }
      return NextResponse.json(
        { success: false, error: `GitHub API error: ${repoRes.status}` },
        { status: repoRes.status }
      );
    }
    const repoData = await repoRes.json();

    // ── 2. Fetch README ──
    let readme = '';
    const subPath = (body.path as string) || '';
    try {
      // If sub-path, try sub-directory README first
      if (subPath) {
        const subReadmeRes = await ghFetch(
          `https://api.github.com/repos/${repo}/contents/${subPath}/README.md?ref=${(repoData.default_branch as string) || 'main'}`,
          'application/vnd.github.v3.raw'
        );
        if (subReadmeRes.ok) readme = await subReadmeRes.text();
      }
      // Fallback to repo-level README
      if (!readme) {
        const readmeRes = await ghFetch(
          `https://api.github.com/repos/${repo}/readme`,
          'application/vnd.github.v3.raw'
        );
        if (readmeRes.ok) readme = await readmeRes.text();
      }
    } catch { /* no readme */ }

    // ── 3. Find or create user for the repo owner ──
    const ownerLogin = repoData.owner?.login as string;
    const ownerAvatar = (repoData.owner?.avatar_url as string) || '🤖';
    const ownerId = String(repoData.owner?.id || '');

    let user = findUserByProvider('github', ownerId);
    if (!user) {
      // Also try matching by provider_id = login (older records may use login)
      user = findUserByProvider('github', ownerLogin);
    }
    if (!user) {
      // Create a new user linked to this GitHub account
      const userId = `u-${crypto.randomBytes(8).toString('hex')}`;
      user = createUser({
        id: userId,
        email: null,
        name: ownerLogin,
        avatar: ownerAvatar,
        provider: 'github',
        providerId: ownerId,
      });
      // Auto-activate (admin-imported users get a system invite code)
      getDb().prepare('UPDATE users SET invite_code = ? WHERE id = ?').run('ADMIN_IMPORT', user.id);
    }

    // ── 4. Determine asset type ──
    const topics: string[] = (repoData.topics || []) as string[];
    const assetType = (body.type as string) || inferAssetType(repoData, topics);

    // ── 4.5. Fetch file tree ──
    let files: FileNode[] = [];
    if (!body.skipFiles) {
      try {
        const defaultBranch = (repoData.default_branch as string) || 'main';
        files = await fetchRepoFiles(repo, defaultBranch, subPath || undefined);
      } catch (e) {
        console.warn('Failed to fetch file tree:', e instanceof Error ? e.message : e);
        // Non-fatal: continue without files
      }
    }

    // ── 5. Create asset ──
    // Determine GitHub URL (might include sub-path)
    const githubUrl = subPath
      ? `${repoData.html_url as string}/tree/${(repoData.default_branch as string) || 'main'}/${subPath}`
      : (repoData.html_url as string);

    // Determine display name (use sub-path folder name if applicable)
    const displayName = subPath
      ? subPath.split('/').filter(Boolean).pop() || (repoData.name as string)
      : (repoData.name as string);

    const asset = createAsset({
      name: subPath ? displayName : (repoData.name as string),
      displayName,
      type: assetType,
      description: (repoData.description as string) || `GitHub: ${repo}`,
      version: '1.0.0',
      authorId: user.id,
      authorName: ownerLogin,
      authorAvatar: ownerAvatar,
      tags: topics.slice(0, 5),
      category: (body.category as string) || '',
      readme,
      githubUrl,
      githubStars: (repoData.stargazers_count as number) || 0,
      githubForks: (repoData.forks_count as number) || 0,
      githubLanguage: (repoData.language as string) || '',
      githubLicense: (repoData.license as Record<string, string>)?.spdx_id || '',
    });

    // ── 6. Update files separately (createAsset doesn't accept files param) ──
    if (files.length > 0) {
      updateAsset(asset.id, { files } as Parameters<typeof updateAsset>[1]);
    }

    // ── 7. Sync GitHub star count → reputation ──
    syncGithubStarReputation(asset.id);

    // Count files recursively
    function countFiles(nodes: FileNode[]): number {
      let count = 0;
      for (const n of nodes) {
        if (n.type === 'file') count++;
        if (n.children) count += countFiles(n.children);
      }
      return count;
    }

    return NextResponse.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          author: asset.author,
          githubUrl: asset.githubUrl,
          fileCount: countFiles(files),
        },
        user: {
          id: user.id,
          name: user.name,
          provider: 'github',
          isNew: !findUserByProvider('github', ownerId),
        },
      },
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Admin import-github error:', message.replace(/token\s+\S+/gi, 'token [REDACTED]'));
    return NextResponse.json(
      { success: false, error: 'Failed to import from GitHub' },
      { status: 500 }
    );
  }
}
