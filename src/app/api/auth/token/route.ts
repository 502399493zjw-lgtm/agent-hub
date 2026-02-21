import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserById, createApiToken, listApiTokens, revokeApiToken } from '@/lib/db';

// GET — List my tokens
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }
    const tokens = listApiTokens(session.user.id);
    return NextResponse.json({ success: true, data: { tokens } });
  } catch (err) {
    console.error('GET /api/auth/token error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST — Create a new API token (requires activated invite code)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const dbUser = findUserById(session.user.id);
    if (!dbUser?.invite_code) {
      return NextResponse.json({ success: false, error: '需要先激活邀请码才能生成 API Token' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const name = (body as { name?: string }).name || 'default';

    const token = createApiToken(session.user.id, name);

    return NextResponse.json({
      success: true,
      data: {
        token,
        message: '⚠️ 请保存好你的 token，它只会显示一次！',
      },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/auth/token error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Revoke a token
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const tokenToRevoke = (body as { token?: string }).token;
    if (!tokenToRevoke) {
      return NextResponse.json({ success: false, error: 'Missing token field' }, { status: 400 });
    }

    const deleted = revokeApiToken(tokenToRevoke, session.user.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Token not found or not yours' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { message: 'Token revoked' } });
  } catch (err) {
    console.error('DELETE /api/auth/token error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
