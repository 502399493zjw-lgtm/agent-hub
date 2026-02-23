import { NextRequest, NextResponse } from 'next/server';
import { resolveByHash } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hashParam = searchParams.get('hash');

  if (!hashParam) {
    return NextResponse.json({ success: false, error: 'Missing required param: hash (e.g. sha256:abc123...)' }, { status: 400 });
  }

  // Support "sha256:xxxx" or raw hex
  const hash = hashParam.startsWith('sha256:') ? hashParam.slice(7) : hashParam;

  if (!hash || hash.length < 8) {
    return NextResponse.json({ success: false, error: 'Hash too short. Provide at least 8 hex characters.' }, { status: 400 });
  }

  const results = resolveByHash(hash);

  return NextResponse.json({
    success: true,
    data: {
      total: results.length,
      matches: results,
    },
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
