import { listAssets, getAssetCountByType, getAssetCountByCategory, getTotalAssetCount } from '@/lib/db';
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
  // Pre-fetch initial assets (all types, first 100, popular sort)
  const result = listAssets({ pageSize: 100, sort: 'popular' });
  // Use lightweight count queries for sidebar instead of fetching all assets again
  const typeCounts = getAssetCountByType();
  const categoryCounts = getAssetCountByCategory();
  const totalCount = getTotalAssetCount();

  return (
    <ExploreClientPage
      initialAssets={result.assets}
      initialTotal={result.total}
      typeCounts={typeCounts}
      categoryCounts={categoryCounts}
      totalCount={totalCount}
    />
  );
}
