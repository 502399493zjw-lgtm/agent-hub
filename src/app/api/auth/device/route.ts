import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserById, authorizeDevice, listAuthorizedDevices, revokeDevice } from '@/lib/db';

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

    authorizeDevice(session.user.id, deviceId, body.name || '');

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

// DELETE — Revoke a device
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as { deviceId?: string };
    if (!body.deviceId) {
      return NextResponse.json({ success: false, error: 'Missing deviceId' }, { status: 400 });
    }

    const deleted = revokeDevice(body.deviceId, session.user.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Device not found or not yours' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { message: '设备授权已撤销' } });
  } catch (err) {
    console.error('DELETE /api/auth/device error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
