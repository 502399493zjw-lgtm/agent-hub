import { listAssets, searchUserProfiles, searchIssues } from '@/lib/db';
import SearchClientPage from './client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '搜索 — 水产市场',
  description: '搜索水产市场中的资产、用户和 Issues',
  openGraph: {
    title: '搜索 — 水产市场',
    description: '搜索水产市场中的资产、用户和 Issues',
    type: 'website',
  },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q?.trim() || '';

  let assets: ReturnType<typeof listAssets>['assets'] = [];
  let users: ReturnType<typeof searchUserProfiles> = [];
  let issues: ReturnType<typeof searchIssues> = [];

  if (query) {
    const dbResult = listAssets({ q: query, pageSize: 50 });
    assets = dbResult.assets;
    users = searchUserProfiles(query);
    issues = searchIssues(query);
  }

  return (
    <SearchClientPage
      initialAssets={assets}
      initialUsers={users}
      initialIssues={issues}
      initialQuery={query}
    />
  );
}
