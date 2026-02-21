import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { activateInviteCode, authorizeDevice } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code, deviceId, deviceName } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: '请提供邀请码' }, { status: 400 });
    }

    const result = activateInviteCode(session.user.id, code.trim().toUpperCase());
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // If deviceId provided, auto-authorize the device
    let deviceAuthorized = false;
    if (deviceId && typeof deviceId === 'string') {
      authorizeDevice(session.user.id, deviceId, deviceName || '');
      deviceAuthorized = true;
    }

    return NextResponse.json({
      success: true,
      data: {
        message: deviceAuthorized
          ? '🎉 邀请码激活成功，设备已自动授权！可以直接发布了。'
          : '邀请码激活成功',
        deviceAuthorized,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
