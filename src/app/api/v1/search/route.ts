import { NextRequest, NextResponse } from 'next/server';
import { listAssetsL1 } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Query parameter q is required', hint: 'GET /api/v1/search?q=weather' }, { status: 400 });
  }

  const type = searchParams.get('type') || undefined;
  const tag = searchParams.get('tag') || undefined;
  const sort = searchParams.get('sort') || 'installs';
  const cursor = searchParams.get('cursor') || undefined;
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const result = listAssetsL1({ q, type, tag, sort, cursor, limit });

  return NextResponse.json({
    query: q,
    total: result.total,
    items: result.items,
    nextCursor: result.nextCursor,
  });
}
