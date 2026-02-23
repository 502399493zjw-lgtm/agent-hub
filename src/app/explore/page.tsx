import { listAssets, getAssetCountByType, getAssetCountByCategory, getTotalAssetCount } from '@/lib/db';
import type { Asset } from '@/data/types';
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

  // Strip heavy fields (readme, files content, longDescription) to keep RSC payload small
  // These fields can be 10s of KB each and are not needed for the list view
  const lightAssets = result.assets.map(({ readme, files, longDescription, ...rest }) => ({
    ...rest,
    readme: '',
    longDescription: '',
    files: [] as Asset['files'],
  }));

  return (
    <ExploreClientPage
      initialAssets={lightAssets}
      initialTotal={result.total}
      typeCounts={typeCounts}
      categoryCounts={categoryCounts}
      totalCount={totalCount}
    />
  );
}
