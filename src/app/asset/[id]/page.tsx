import { getAssetById, getCommentsByAssetId, getIssuesByAssetId, listAssets, getAssetsByIds, getDependentAssets } from '@/lib/db';
import type { Asset } from '@/data/types';
import AssetDetailClient from './client';
import type { Metadata } from 'next';

export const revalidate = 60;

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

  // Compute related/deps/dependents server-side instead of fetching all assets
  let relatedAssets: Asset[] = [];
  let depAssets: Asset[] = [];
  let dependentAssets: Asset[] = [];

  if (asset) {
    // Related: same type, sorted by popularity, limit 4
    const sameType = listAssets({ type: asset.type, pageSize: 10, sort: 'popular' });
    relatedAssets = sameType.assets
      .filter(a => a.id !== asset.id)
      .slice(0, 4);

    // Dependencies: resolve by IDs (getAssetsByIds returns AssetCompact, cast to Asset for display)
    if (asset.dependencies.length > 0) {
      const compactDeps = getAssetsByIds(asset.dependencies);
      // Map compact to minimal Asset shape for the client
      depAssets = compactDeps.map(d => ({
        ...asset, // base shape
        id: d.id, name: d.name, displayName: d.displayName, type: d.type as Asset['type'],
        description: d.description, tags: d.tags, downloads: d.installs,
        version: d.version, category: d.category, updatedAt: d.updatedAt,
        author: { id: d.authorId, name: d.author, avatar: '' },
      }));
    }

    // Dependents: assets that list this asset as a dependency
    dependentAssets = getDependentAssets(asset.id);
  }

  return (
    <AssetDetailClient
      id={id}
      initialAsset={asset}
      initialComments={comments}
      initialIssues={issues}
      relatedAssets={relatedAssets}
      depAssets={depAssets}
      dependentAssets={dependentAssets}
    />
  );
}
