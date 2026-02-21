import { listAssets, listUserProfiles, getGrowthData, getTotalCommentCount, getTotalIssueCount } from '@/lib/db';
import StatsClient from './client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '社区统计 — 水产市场',
  description: '水产市场生态系统的实时数据概览',
  openGraph: {
    title: '社区统计 — 水产市场',
    description: '水产市场生态系统的实时数据概览',
    type: 'website',
  },
};

export default function StatsPage() {
  const assetsResult = listAssets({ pageSize: 200 });
  const users = listUserProfiles();
  const growthData = getGrowthData();
  const totalComments = getTotalCommentCount();
  const totalIssues = getTotalIssueCount();

  return (
    <StatsClient
      assets={assetsResult.assets}
      users={users}
      growthData={growthData}
      totalComments={totalComments}
      totalIssues={totalIssues}
    />
  );
}
