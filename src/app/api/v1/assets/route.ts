import { NextRequest, NextResponse } from 'next/server';
import { listAssetsL1, getAllTags, getAllCategories } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Auth required: listing assets needs login
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;
  const tag = searchParams.get('tag') || undefined;
  const category = searchParams.get('category') || undefined;
  const q = searchParams.get('q') || undefined;
  const sort = searchParams.get('sort') || undefined;
  const cursor = searchParams.get('cursor') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
  const facets = searchParams.get('facets') === 'true';

  const result = listAssetsL1({ type, tag, category, q, sort, cursor, limit });

  const response: Record<string, unknown> = {
    total: result.total,
    items: result.items,
    nextCursor: result.nextCursor,
  };

  if (facets) {
    response.facets = {
      tags: getAllTags(),
      categories: getAllCategories(),
    };
  }

  return NextResponse.json(response);
}
