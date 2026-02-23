import { NextRequest, NextResponse } from 'next/server';
import { getUserCoinEvents, getDb } from '@/lib/db';

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

    // Enrich events with asset names
    const refIds = [...new Set(result.events.filter(e => e.refId).map(e => e.refId!))];
    const assetNames: Record<string, string> = {};
    if (refIds.length > 0) {
      const db = getDb();
      for (const refId of refIds) {
        const row = db.prepare('SELECT name FROM assets WHERE id = ?').get(refId) as { name: string } | undefined;
        if (row) assetNames[refId] = row.name;
      }
    }

    const enrichedEvents = result.events.map(e => ({
      ...e,
      refName: e.refId ? (assetNames[e.refId] || null) : null,
    }));

    return NextResponse.json({
      success: true,
      ...result,
      events: enrichedEvents,
    });
  } catch (err) {
    console.error('GET /api/users/[id]/activity error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
