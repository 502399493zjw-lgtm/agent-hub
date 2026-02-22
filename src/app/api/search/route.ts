import { NextRequest, NextResponse } from 'next/server';
import { listAssets, searchUserProfiles, searchIssues, searchCollections } from '@/lib/db';
import { searchLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  // M01: Rate limiting — 30/min per IP
  const ip = getClientIp(request);
  if (!searchLimiter.check(ip)) {
    return rateLimitResponse() as unknown as NextResponse;
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }

  try {
    // Search assets from DB
    const dbResult = listAssets({ q, pageSize: 50 });
    const assetResults = dbResult.assets;

    const userResults = searchUserProfiles(q);
    const issueResults = searchIssues(q);
    const collectionResults = searchCollections(q);

    return NextResponse.json({
      query: q,
      results: {
        assets: { items: assetResults, count: assetResults.length },
        users: { items: userResults, count: userResults.length },
        issues: { items: issueResults, count: issueResults.length },
        collections: { items: collectionResults, count: collectionResults.length },
      },
      totalCount: assetResults.length + userResults.length + issueResults.length + collectionResults.length,
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('GET /api/search error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
