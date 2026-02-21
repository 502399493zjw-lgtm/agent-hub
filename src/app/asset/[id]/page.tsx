import { getAssetById, getCommentsByAssetId, getIssuesByAssetId, listAssets } from '@/lib/db';
import AssetDetailClient from './client';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const asset = getAssetById(id);
  if (!asset) {
    return { title: '资产未找到 — 水产市场' };
  }
  return {
    title: `${asset.displayName} — 水产市场`,
    description: asset.description,
    openGraph: {
      title: `${asset.displayName} — 水产市场`,
      description: asset.description,
      type: 'website',
    },
  };
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = getAssetById(id);
  const comments = getCommentsByAssetId(id);
  const issues = getIssuesByAssetId(id);
  const allAssetsResult = listAssets({ pageSize: 100 });

  return (
    <AssetDetailClient
      id={id}
      initialAsset={asset}
      initialComments={comments}
      initialIssues={issues}
      initialAllAssets={allAssetsResult.assets}
    />
  );
}
