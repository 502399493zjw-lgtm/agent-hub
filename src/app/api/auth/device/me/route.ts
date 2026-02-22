import { NextRequest, NextResponse } from 'next/server';
import { getDeviceBinding } from '@/lib/db';

/**
 * GET /api/auth/device/me?deviceId=XXX
 *
 * Public endpoint (no authentication required).
 * Returns the binding status for a given device ID.
 * Used by Agent on startup to check if it's already bound to an account.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get('deviceId');

  if (!deviceId || typeof deviceId !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing deviceId parameter' }, { status: 400 });
  }

  const binding = getDeviceBinding(deviceId);

  if (!binding) {
    return NextResponse.json({
      success: true,
      data: {
        bound: false,
        deviceId: deviceId.slice(0, 12) + '...',
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      bound: true,
      deviceId: deviceId.slice(0, 12) + '...',
      userId: binding.userId,
      userName: binding.userName,
      deviceName: binding.deviceName,
      authorizedAt: binding.authorizedAt,
    },
  });
}
