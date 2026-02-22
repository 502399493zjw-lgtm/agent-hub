import { NextRequest, NextResponse } from 'next/server';
import { getAssetVersions, getAssetVersion } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth required
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version');

  if (version) {
    const v = getAssetVersion(id, version);
    if (!v) {
      return NextResponse.json({ success: false, error: 'Version not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: v });
  }

  const versions = getAssetVersions(id);
  if (versions === null) {
    return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      total: versions.length,
      versions,
    },
  });
}
