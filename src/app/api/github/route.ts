import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

// L12: Rate limit — 30 requests per minute per IP
const githubProxyLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

// L12: Endpoint whitelist — only safe read-only paths
const ALLOWED_PATH_PREFIXES = [
  '/repos/',
  '/users/',
  '/search/',
  '/orgs/',
  '/licenses',
];

function isAllowedEndpoint(repo: string): boolean {
  // The repo param is used to construct /repos/{owner}/{repo} calls
  // Only allow owner/repo format (no path traversal)
  const cleaned = repo.replace(/\.git$/, '');
  // Must be simple "owner/repo" — no slashes beyond one, no special chars
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(cleaned)) {
    return false;
  }
  return true;
}

/**
 * GET /api/github?repo=owner/repo
 * Fetch GitHub repo metadata (stars, forks, language, license, description, readme)
 * Used by the publish page to auto-populate fields from a GitHub URL
 */
export async function GET(request: NextRequest) {
  // L12: Rate limiting
  const ip = getClientIp(request);
  if (!githubProxyLimiter.check(ip)) {
    return rateLimitResponse() as unknown as NextResponse;
  }

  const { searchParams } = new URL(request.url);
  let repo = searchParams.get('repo') || '';

  // Accept full URL or owner/repo format
  const urlMatch = repo.match(/github\.com\/([^/]+\/[^/]+)/);
  if (urlMatch) repo = urlMatch[1].replace(/\.git$/, '');

  if (!repo || !repo.includes('/')) {
    return NextResponse.json(
      { success: false, error: 'Invalid repo format. Use owner/repo or full GitHub URL.' },
      { status: 400 }
    );
  }

  // L12: Validate endpoint is allowed
  if (!isAllowedEndpoint(repo)) {
    return NextResponse.json(
      { success: false, error: 'Invalid repository path.' },
      { status: 400 }
    );
  }

  try {
    const ghHeaders: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AgentHub/1.0',
      ...(process.env.GITHUB_TOKEN ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` } : {}),
    };

    // Fetch repo metadata
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: ghHeaders,
      next: { revalidate: 300 }, // cache 5 min
    });

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

    // Fetch README
    let readme = '';
    try {
      const readmeRes = await fetch(`https://api.github.com/repos/${repo}/readme`, {
        headers: {
          ...ghHeaders,
          'Accept': 'application/vnd.github.v3.raw',
        },
      });
      if (readmeRes.ok) {
        readme = await readmeRes.text();
      }
    } catch { /* no readme */ }

    // Fetch languages
    let languages: Record<string, number> = {};
    try {
      const langRes = await fetch(`https://api.github.com/repos/${repo}/languages`, {
        headers: ghHeaders,
      });
      if (langRes.ok) languages = await langRes.json();
    } catch { /* ignore */ }

    // Determine primary language
    const primaryLanguage = repoData.language || (Object.keys(languages)[0] ?? '');

    // Fetch topics/tags
    const tags = (repoData.topics || []).slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description || '',
        stars: repoData.stargazers_count || 0,
        forks: repoData.forks_count || 0,
        language: primaryLanguage,
        license: repoData.license?.spdx_id || '',
        topics: tags,
        htmlUrl: repoData.html_url,
        defaultBranch: repoData.default_branch || 'main',
        readme,
        languages,
        updatedAt: repoData.updated_at,
        owner: {
          login: repoData.owner?.login,
          avatarUrl: repoData.owner?.avatar_url,
        },
      },
    });
  } catch (err) {
    // L12: Sanitize error log — don't leak tokens or full error details
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('GitHub proxy error:', message.replace(/token\s+\S+/gi, 'token [REDACTED]'));
    return NextResponse.json(
      { success: false, error: 'Failed to fetch GitHub repo data' },
      { status: 500 }
    );
  }
}

// L12: Reject non-GET methods explicitly
export async function POST() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 });
}
