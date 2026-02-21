import { NextResponse } from 'next/server';
import { getStats, getAssetCountByType, listUserProfiles, getGrowthData, getTotalCommentCount, getTotalIssueCount } from '@/lib/db';

export async function GET() {
  try {
    const stats = getStats();
    const typeCounts = getAssetCountByType();
    const users = listUserProfiles();
    const growthData = getGrowthData();
    const totalComments = getTotalCommentCount();
    const totalIssues = getTotalIssueCount();

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        typeCounts,
        users,
        growthData,
        totalComments,
        totalIssues,
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
