import { NextRequest, NextResponse } from 'next/server';
import { getUserCoins, getCoinHistory } from '@/lib/db';

// GET /api/users/[id]/coins — get user reputation & shrimp coins + optional history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const coins = getUserCoins(id);
  
  const url = new URL(request.url);
  const includeHistory = url.searchParams.get('history') === 'true';
  const coinType = url.searchParams.get('type') as 'reputation' | 'shrimp_coin' | undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const result: Record<string, unknown> = {
    userId: id,
    reputation: coins.reputation,
    shrimpCoins: coins.shrimpCoins,
  };

  if (includeHistory) {
    result.history = getCoinHistory(id, coinType || undefined, Math.min(limit, 200));
  }

  return NextResponse.json({ success: true, data: result });
}
