import { NextRequest, NextResponse } from 'next/server';
import { getAssetL2 } from '@/lib/db';
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
  const data = getAssetL2(id);
  if (!data) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
