import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, getAssetManifest } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const asset = getAssetById(id);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const manifestData = getAssetManifest(id);

  return NextResponse.json({
    asset: {
      id: asset.id,
      name: asset.name,
      displayName: asset.displayName,
      type: asset.type,
      author: asset.author,
      description: asset.description,
      longDescription: asset.longDescription,
      version: asset.version,
      installs: asset.downloads,
      rating: asset.rating,
      ratingCount: asset.ratingCount,
      tags: asset.tags,
      category: asset.category,
      installCommand: asset.installCommand,
      versions: asset.versions,
      compatibility: asset.compatibility,
      dependencies: asset.dependencies,
      updatedAt: asset.updatedAt,
      createdAt: asset.createdAt,
    },
    manifest: manifestData?.manifest ?? {},
    readme_url: `/api/v1/assets/${id}/readme`,
    manifest_url: `/api/v1/assets/${id}/manifest`,
  });
}
