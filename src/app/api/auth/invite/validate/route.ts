import { NextRequest, NextResponse } from 'next/server';
import { validateInviteCode } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: '请提供邀请码' }, { status: 400 });
    }

    const result = validateInviteCode(code.trim().toUpperCase());
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
