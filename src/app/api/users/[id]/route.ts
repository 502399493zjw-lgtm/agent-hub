import { NextResponse } from 'next/server';
import { findUserById, listAssets, getCommentsByAssetId, getIssuesByAssetId } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dbUser = findUserById(id);
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get user's published assets
  const dbResult = listAssets({ pageSize: 200 });
  const publishedAssets = dbResult.assets.filter(a => a.author.id === id);

  // Compute stats
  let totalDownloads = 0;
  let totalStars = 0;
  let totalComments = 0;
  let totalIssues = 0;
  for (const asset of publishedAssets) {
    totalDownloads += asset.downloads;
    totalStars += asset.totalStars ?? asset.githubStars ?? 0;
    totalComments += getCommentsByAssetId(asset.id).length;
    totalIssues += getIssuesByAssetId(asset.id).length;
  }

  return NextResponse.json({
    success: true,
    data: {
      user: {
        id: dbUser.id,
        name: dbUser.custom_name || dbUser.name,
        avatar: dbUser.custom_avatar || dbUser.avatar,
        bio: dbUser.bio,
        provider: dbUser.provider,
        providerName: dbUser.provider_name,
        joinedAt: dbUser.created_at,
        reputation: dbUser.reputation,
        shrimpCoins: dbUser.shrimp_coins,
        role: dbUser.role,
        type: dbUser.type,
      },
      stats: {
        assetCount: publishedAssets.length,
        totalDownloads,
        totalStars,
        totalComments,
        totalIssues,
      },
      publishedAssets,
    },
  });
}
