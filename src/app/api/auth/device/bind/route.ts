import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserById, authorizeDevice } from '@/lib/db';

/**
 * POST /api/auth/device/bind
 *
 * Authenticated endpoint (requires NextAuth session).
 * Binds a device to the currently logged-in user.
 *
 * Body: { deviceId: string }
 *
 * Rules:
 * - Device not bound → bind to current user
 * - Device already bound to current user → return "already bound"
 * - Device already bound to another user → return error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated. Please login first.' }, { status: 401 });
    }

    // Verify user has invite code (only activated users can bind devices)
    const dbUser = findUserById(session.user.id);
    if (!dbUser?.invite_code) {
      return NextResponse.json({ success: false, error: '需要先激活邀请码才能绑定设备' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { deviceId?: string };
    const { deviceId } = body;

    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing deviceId' }, { status: 400 });
    }

    const result = authorizeDevice(session.user.id, deviceId);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || '设备绑定失败',
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      data: {
        deviceId: deviceId.slice(0, 12) + '...',
        userId: session.user.id,
        message: '✅ 设备已绑定到你的账号。',
      },
    });
  } catch (err) {
    console.error('POST /api/auth/device/bind error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
