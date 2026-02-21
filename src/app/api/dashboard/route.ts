import { NextRequest, NextResponse } from 'next/server';
import { listAssets, getCommentsByAssetId, getIssuesByAssetId } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const authorId = searchParams.get('authorId');

    // If authorId is given, return that user's assets with their comments and issues
    const dbResult = listAssets({ pageSize: 200 });
    const allAssets = dbResult.assets;

    // Gather comments and issues for all assets (or filtered by author)
    const targetAssets = authorId ? allAssets.filter(a => a.author.id === authorId) : allAssets;
    const targetAssetIds = new Set(targetAssets.map(a => a.id));

    let allComments: ReturnType<typeof getCommentsByAssetId> = [];
    let allIssues: ReturnType<typeof getIssuesByAssetId> = [];

    for (const a of targetAssets) {
      allComments = allComments.concat(getCommentsByAssetId(a.id));
      allIssues = allIssues.concat(getIssuesByAssetId(a.id));
    }

    // Sort by date desc
    allComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    allIssues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      data: {
        assets: allAssets,
        comments: allComments.slice(0, 20),
        issues: allIssues.slice(0, 20),
      },
    });
  } catch (err) {
    console.error('GET /api/dashboard error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
