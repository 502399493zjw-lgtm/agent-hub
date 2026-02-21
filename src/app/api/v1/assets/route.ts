import { NextRequest, NextResponse } from 'next/server';
import { listAssetsCompact } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;
  const tag = searchParams.get('tag') || undefined;
  const category = searchParams.get('category') || undefined;
  const q = searchParams.get('q') || undefined;
  const sort = searchParams.get('sort') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

  const result = listAssetsCompact({ type, tag, category, q, sort, page, pageSize });

  return NextResponse.json({
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    assets: result.assets,
  });
}
