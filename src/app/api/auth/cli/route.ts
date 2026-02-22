import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCliAuthRequest, pollCliAuthRequest, approveCliAuthRequest, getCliAuthRequest, findUserById } from '@/lib/db';

/**
 * CLI Device Auth Flow API
 *
 * POST /api/auth/cli — Step 1: CLI initiates auth, gets a code to display
 *   Body: { deviceId: string, deviceName?: string }
 *   Returns: { code: string, expiresAt: string, approveUrl: string }
 *
 * GET /api/auth/cli?code=XXX&deviceId=YYY — Step 2: CLI polls for approval
 *   Returns: { status: 'pending' | 'authorized' | 'expired', userId?: string }
 *
 * PUT /api/auth/cli — Step 3: Logged-in user approves (from browser)
 *   Body: { code: string }
 *   Requires: NextAuth session
 *   Returns: { success: true }
 */

// Step 1: CLI requests auth code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { deviceId?: string; deviceName?: string };
    const { deviceId, deviceName } = body;

    if (!deviceId || typeof deviceId !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing deviceId' }, { status: 400 });
    }

    const result = createCliAuthRequest(deviceId, deviceName || '');
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || 'https://hub.openclawmp.cc';

    return NextResponse.json({
      success: true,
      data: {
        code: result.code,
        expiresAt: result.expiresAt,
        approveUrl: `${baseUrl}/cli/authorize?code=${result.code}`,
        pollInterval: 3000, // suggested poll interval in ms
      },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/auth/cli error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// Step 2: CLI polls for status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const deviceId = searchParams.get('deviceId');

  if (!code || !deviceId) {
    return NextResponse.json({ success: false, error: 'Missing code or deviceId' }, { status: 400 });
  }

  const result = pollCliAuthRequest(code.toUpperCase(), deviceId);
  if (!result) {
    return NextResponse.json({ success: false, error: 'Auth request not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: result });
}

// Step 3: Logged-in user approves the CLI auth request
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated. Please login first.' }, { status: 401 });
    }

    // Verify user has invite code (only activated users can authorize devices)
    const dbUser = findUserById(session.user.id);
    if (!dbUser?.invite_code) {
      return NextResponse.json({ success: false, error: '需要先激活邀请码才能授权设备' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as { code?: string };
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Missing code' }, { status: 400 });
    }

    // Get request info for response
    const info = getCliAuthRequest(code.toUpperCase());
    if (!info) {
      return NextResponse.json({ success: false, error: '授权码不存在' }, { status: 404 });
    }

    const result = approveCliAuthRequest(code.toUpperCase(), session.user.id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '✅ 设备已授权！CLI 现在可以使用了。',
        deviceId: info.deviceId.slice(0, 12) + '...',
      },
    });
  } catch (err) {
    console.error('PUT /api/auth/cli error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
