import { getStats, getAssetCountByType, listAssets } from '@/lib/db';
import type { AssetType } from '@/data/types';
import HomeClient from './client';
import type { Metadata } from 'next';

export const revalidate = 60;

export const metadata: Metadata = {
  title: '水产市场 — Agent 进化生态',
  description: '探索、分享、安装 Skills/Configs/Plugins，让你的 Agent 加入无限的进化',
  openGraph: {
    title: '水产市场 — Agent 进化生态',
    description: '探索、分享、安装 Skills/Configs/Plugins，让你的 Agent 加入无限的进化',
    type: 'website',
  },
};

export default function HomePage() {
  // Fetch stats (server-side)
  const stats = getStats();
  const typeCounts = getAssetCountByType();

  // Fetch TOP 6 assets for each type (server-side)
  const types: AssetType[] = ['template', 'skill', 'experience', 'plugin', 'trigger', 'channel'];
  const tabAssets: Record<string, ReturnType<typeof listAssets>['assets']> = {};
  for (const t of types) {
    const result = listAssets({ type: t, sort: 'downloads', pageSize: 30 });
    tabAssets[t] = result.assets;
  }

  return (
    <HomeClient
      stats={{ ...stats, typeCounts }}
      tabAssets={tabAssets}
    />
  );
}
