import { NextRequest, NextResponse } from 'next/server';
import { listAssets } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    // Auth required: listing assets needs login
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const category = searchParams.get('category') || undefined;
    const q = searchParams.get('q') || undefined;
    const sort = searchParams.get('sort') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

    const result = listAssets({ type, category, q, sort, page, pageSize });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('GET /api/assets error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/assets removed — use POST /api/v1/assets/publish instead
