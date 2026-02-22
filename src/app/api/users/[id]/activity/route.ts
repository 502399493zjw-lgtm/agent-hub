import { NextRequest, NextResponse } from 'next/server';
import { getUserCoinEvents } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20));

    const result = getUserCoinEvents(id, { page, pageSize });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error('GET /api/users/[id]/activity error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
