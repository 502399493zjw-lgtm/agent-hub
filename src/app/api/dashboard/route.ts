import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { listAssets, getCommentsByAssetId, getIssuesByAssetId } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Auth required — only return data for the authenticated user's assets
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const authorId = authResult.userId;
    const dbResult = listAssets({ authorId, pageSize: 200 });
    const targetAssets = dbResult.assets;

    let allComments: ReturnType<typeof getCommentsByAssetId> = [];
    let allIssues: ReturnType<typeof getIssuesByAssetId> = [];

    for (const a of targetAssets) {
      allComments = allComments.concat(getCommentsByAssetId(a.id));
      allIssues = allIssues.concat(getIssuesByAssetId(a.id));
    }

    allComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    allIssues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: {
        assets: targetAssets,
        comments: allComments.slice(0, 20),
        issues: allIssues.slice(0, 20),
      },
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
