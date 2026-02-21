import { NextRequest, NextResponse } from 'next/server';
import { getTrendingAssets } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'week';
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));

  const assets = getTrendingAssets(period, limit);

  return NextResponse.json({
    period,
    assets,
  });
}
