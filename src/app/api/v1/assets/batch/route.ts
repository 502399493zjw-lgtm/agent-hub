import { NextRequest, NextResponse } from 'next/server';
import { getAssetsByIds, getAssetById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth required
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  const body = await request.json();
  const ids: string[] = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array is required', hint: 'POST with {"ids": ["s-xxx", "p-yyy"]}' }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 ids per batch' }, { status: 400 });
  }

  const fields = body.fields || 'compact';

  if (fields === 'full') {
    const assets = ids.map(id => getAssetById(id)).filter(Boolean);
    return NextResponse.json({ assets });
  }

  const assets = getAssetsByIds(ids);
  return NextResponse.json({ assets });
}
