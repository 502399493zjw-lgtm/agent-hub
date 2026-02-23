import { listAssetsCompact, getAssetCountByType, getAssetCountByCategory, getTotalAssetCount } from '@/lib/db';
import ExploreClientPage from './client';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '探索 Agent 资产 — 水产市场',
  description: '发现社区分享的 Skills、Configs、Plugins、Triggers、Channels 和 Templates',
  openGraph: {
    title: '探索 Agent 资产 — 水产市场',
    description: '发现社区分享的 Skills、Configs、Plugins、Triggers、Channels 和 Templates',
    type: 'website',
  },
};

export default function ExplorePage() {
  // Pre-fetch initial assets using compact query (same as V1 API)
  const result = listAssetsCompact({ pageSize: 100, sort: 'popular' });
  // Use lightweight count queries for sidebar instead of fetching all assets again
  const typeCounts = getAssetCountByType();
  const categoryCounts = getAssetCountByCategory();
  const totalCount = getTotalAssetCount();

  // Normalize compact format to match what client expects
  // (author string → author object, installs → downloads)
  const normalizedAssets = result.assets.map(item => ({
    ...item,
    downloads: item.installs ?? 0,
    author: typeof item.author === 'string'
      ? { id: item.authorId ?? '', name: item.author, avatar: '', reputation: 0 }
      : item.author,
  }));

  return (
    <ExploreClientPage
      initialAssets={normalizedAssets as any}
      initialTotal={result.total}
      typeCounts={typeCounts}
      categoryCounts={categoryCounts}
      totalCount={totalCount}
    />
  );
}
