import { listAssets } from '@/lib/db';
import ExploreClientPage from './client';
import type { Metadata } from 'next';

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
  // Pre-fetch initial assets (all types, first 20, popular sort)
  const result = listAssets({ pageSize: 100, sort: 'popular' });
  // Also fetch all assets for sidebar counts
  const allResult = listAssets({ pageSize: 100 });

  return (
    <ExploreClientPage
      initialAssets={result.assets}
      initialTotal={result.total}
      initialAllAssets={allResult.assets}
    />
  );
}
