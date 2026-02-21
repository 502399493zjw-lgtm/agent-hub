import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { activateInviteCode } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: '请提供邀请码' }, { status: 400 });
    }

    const result = activateInviteCode(session.user.id, code.trim().toUpperCase());
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { message: '邀请码激活成功' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
