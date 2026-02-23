import { findUserById, listAssets, getCommentCountsByAssetIds, getIssueCountsByAssetIds } from '@/lib/db';
import { auth } from '@/lib/auth';
import UserProfileClient from './client';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = findUserById(id);
  if (!user) {
    return { title: '用户未找到 — 水产市场' };
  }
  const displayName = user.custom_name || user.name;
  return {
    title: `${displayName} — 水产市场`,
    description: `${displayName} 的个人主页`,
    openGraph: {
      title: `${displayName} — 水产市场`,
      description: user.bio || `${displayName} 的个人主页`,
      type: 'profile',
    },
  };
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dbUser = findUserById(id);

  if (!dbUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="text-3xl mb-4 text-muted">?</div>
        <h1 className="text-2xl font-bold mb-2">用户未找到</h1>
        <a href="/explore" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue/10 text-blue border border-blue/30 hover:bg-blue/20 transition-colors">
          ← 返回探索
        </a>
      </div>
    );
  }

  // Get current session to determine isOwn
  const session = await auth();
  const isOwn = session?.user?.id === id;

  // Get user's published assets (filtered at DB level)
  const dbResult = listAssets({ authorId: id, pageSize: 200 });
  const publishedAssets = dbResult.assets;

  // Get stats: total downloads, total stars, total comments, total issues
  let totalDownloads = 0;
  let totalStars = 0;
  const assetIds = publishedAssets.map(a => a.id);
  const commentCounts = getCommentCountsByAssetIds(assetIds);
  const issueCounts = getIssueCountsByAssetIds(assetIds);
  let totalComments = 0;
  let totalIssues = 0;
  for (const asset of publishedAssets) {
    totalDownloads += asset.downloads;
    totalStars += asset.totalStars ?? asset.githubStars ?? 0;
    totalComments += commentCounts[asset.id] || 0;
    totalIssues += issueCounts[asset.id] || 0;
  }

  const profileData = {
    id: dbUser.id,
    name: dbUser.custom_name || dbUser.name,
    avatar: dbUser.custom_avatar || dbUser.avatar,
    bio: dbUser.bio || '',
    provider: dbUser.provider,
    providerName: dbUser.provider_name,
    providerAvatar: dbUser.provider_avatar,
    joinedAt: dbUser.created_at,
    reputation: dbUser.reputation,
    shrimpCoins: dbUser.shrimp_coins,
    role: dbUser.role,
    type: dbUser.type,
    stats: {
      assetCount: publishedAssets.length,
      totalDownloads,
      totalStars,
      totalComments,
      totalIssues,
    },
  };

  return (
    <UserProfileClient
      profile={profileData}
      publishedAssets={publishedAssets}
      isOwn={isOwn}
    />
  );
}
