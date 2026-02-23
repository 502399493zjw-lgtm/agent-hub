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
 * - One account can only bind ONE device
 * - One device can only bind ONE account
 * - If already bound to same device → idempotent success
 * - If account already has a different device → error (unbind first)
 * - If device already bound to another account → error with owner hint
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
        alreadyBound: result.alreadyBound || false,
        message: result.alreadyBound
          ? '设备已绑定，无需重复操作。'
          : '✅ 设备已绑定到你的账号。',
      },
    });
  } catch (err) {
    console.error('POST /api/auth/device/bind error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
