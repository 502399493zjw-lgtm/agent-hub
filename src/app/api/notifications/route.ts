import { NextRequest, NextResponse } from 'next/server';
import { getNotifications, markNotificationRead, markAllRead } from '@/lib/db';

export async function GET() {
  try {
    const notifications = getNotifications('self');
    return NextResponse.json({ success: true, data: notifications });
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'markRead' && body.id) {
      markNotificationRead(body.id);
    } else if (body.action === 'markAllRead') {
      markAllRead('self');
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
