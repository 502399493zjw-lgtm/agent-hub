import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createAsset, findUserByProvider, createUser, findUserByApiKey,
  isAdmin as isAdminUser, getDb,
} from '@/lib/db';

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
 *   type?: "skill"|"channel"..., // optional — override auto-detected type
 *   category?: string,          // optional
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
    try {
      const readmeRes = await ghFetch(
        `https://api.github.com/repos/${repo}/readme`,
        'application/vnd.github.v3.raw'
      );
      if (readmeRes.ok) readme = await readmeRes.text();
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

    // ── 5. Create asset ──
    const asset = createAsset({
      name: repoData.name as string,
      displayName: repoData.name as string,
      type: assetType,
      description: (repoData.description as string) || `GitHub: ${repo}`,
      version: '1.0.0',
      authorId: user.id,
      authorName: ownerLogin,
      authorAvatar: ownerAvatar,
      tags: topics.slice(0, 5),
      category: (body.category as string) || '',
      readme,
      githubUrl: repoData.html_url as string,
      githubStars: (repoData.stargazers_count as number) || 0,
      githubForks: (repoData.forks_count as number) || 0,
      githubLanguage: (repoData.language as string) || '',
      githubLicense: (repoData.license as Record<string, string>)?.spdx_id || '',
    });

    return NextResponse.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          author: asset.author,
          githubUrl: asset.githubUrl,
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
