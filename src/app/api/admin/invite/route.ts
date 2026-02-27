import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSuperInviteCode, listAllInviteCodes, deleteInviteCode, getInviteCodeDetail, findUserByApiKey, isAdmin as isAdminUser } from '@/lib/db';

// S06: Use constant-time comparison to prevent timing attacks
function hasAdminSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return false;
  const secretBuf = Buffer.from(secret);
  const adminSecretBuf = Buffer.from(adminSecret);
  if (secretBuf.length !== adminSecretBuf.length) {
    const padded = Buffer.alloc(adminSecretBuf.length);
    secretBuf.copy(padded);
    crypto.timingSafeEqual(padded, adminSecretBuf);
    return false;
  }
  return crypto.timingSafeEqual(secretBuf, adminSecretBuf);
}

/** Check admin access: X-Admin-Secret header OR authenticated admin-role user via API key */
function isAdmin(request: NextRequest): boolean {
  // Method 1: X-Admin-Secret header (backwards compatible)
  if (hasAdminSecret(request)) return true;

  // Method 2: Authenticated user with admin role
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const apiKey = authHeader.slice(7);
    const user = findUserByApiKey(apiKey);
    if (user && isAdminUser(user.id)) return true;
  }

  return false;
}

/** GET /api/admin/invite — list all invite codes (paginated, optional type filter) */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
  const pageSize = searchParams.get('pageSize') ? Math.min(parseInt(searchParams.get('pageSize')!, 10), 100) : undefined;

  const result = listAllInviteCodes({ type, page, pageSize });
  return NextResponse.json({ success: true, data: result });
}

/** POST /api/admin/invite — create a super invite code */
export async function POST(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code, maxUses } = body;

    if (!maxUses || typeof maxUses !== 'number' || maxUses < 1) {
      return NextResponse.json({ success: false, error: 'maxUses must be a positive number' }, { status: 400 });
    }

    // Generate code if not provided — M11: use crypto.randomBytes instead of Math.random()
    let finalCode = code?.trim()?.toUpperCase();
    if (!finalCode) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const bytes = crypto.randomBytes(7);
      finalCode = '';
      for (let i = 0; i < 7; i++) {
        finalCode += chars.charAt(bytes[i] % chars.length);
      }
    }

    const success = createSuperInviteCode(finalCode, maxUses, 'admin');
    if (!success) {
      return NextResponse.json({ success: false, error: '邀请码已存在' }, { status: 409 });
    }

    const detail = getInviteCodeDetail(finalCode);
    return NextResponse.json({ success: true, data: detail }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}

/** DELETE /api/admin/invite — delete an invite code */
export async function DELETE(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'code is required' }, { status: 400 });
    }

    const deleted = deleteInviteCode(code.trim());
    if (!deleted) {
      return NextResponse.json({ success: false, error: '邀请码不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { code } });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
