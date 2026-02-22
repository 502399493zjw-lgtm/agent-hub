import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserById, authorizeDevice, listAuthorizedDevices } from '@/lib/db';

// GET — List my authorized devices
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    const devices = listAuthorizedDevices(session.user.id);
    return NextResponse.json({ success: true, data: { devices } });
  } catch (err) {
    console.error('GET /api/auth/device error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Authorize a device (requires activated invite code)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const dbUser = findUserById(session.user.id);
    if (!dbUser?.invite_code) {
      return NextResponse.json({ success: false, error: '需要先激活邀请码才能授权设备' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { deviceId?: string; name?: string };
    const deviceId = body.deviceId;
    if (!deviceId) {
      return NextResponse.json({ success: false, error: 'Missing deviceId — from ~/.openclaw/identity/device.json' }, { status: 400 });
    }

    const result = authorizeDevice(session.user.id, deviceId, body.name || '');
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      data: {
        deviceId: deviceId.slice(0, 12) + '...',
        message: '✅ 设备已授权！该设备上的 Agent 现在可以发布资产了。',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/auth/device error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Disabled. Device binding is permanent (admin operation only).
// Kept as a stub to return a clear error message.
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: '设备绑定为永久绑定，不支持主动解绑。如需帮助请联系管理员。' },
    { status: 403 }
  );
}
