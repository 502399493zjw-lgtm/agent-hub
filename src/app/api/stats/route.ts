import { NextResponse } from 'next/server';
import { getStats, getAssetCountByType } from '@/lib/db';

export async function GET() {
  try {
    const stats = getStats();
    const typeCounts = getAssetCountByType();

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        typeCounts,
      },
    });
  } catch (err) {
    console.error('GET /api/stats error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
