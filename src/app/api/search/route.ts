import { NextRequest, NextResponse } from 'next/server';
import { searchUsers, searchIssues } from '@/data/mock';
import { listAssets } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }

  // Search assets from DB
  const dbResult = listAssets({ q, pageSize: 50 });
  const assetResults = dbResult.assets;

  const userResults = searchUsers(q);
  const issueResults = searchIssues(q);

  return NextResponse.json({
    query: q,
    results: {
      assets: { items: assetResults, count: assetResults.length },
      users: { items: userResults, count: userResults.length },
      issues: { items: issueResults, count: issueResults.length },
    },
    totalCount: assetResults.length + userResults.length + issueResults.length,
  });
}
