import { NextRequest, NextResponse } from 'next/server';
import { createSuperInviteCode, listAllInviteCodes, deleteInviteCode, getInviteCodeDetail } from '@/lib/db';

function isAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return false;
  return secret === adminSecret;
}

/** GET /api/admin/invite — list all invite codes (paginated, optional type filter) */
export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

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

    // Generate code if not provided
    let finalCode = code?.trim()?.toUpperCase();
    if (!finalCode) {
      // Generate a 7-char random code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      finalCode = '';
      for (let i = 0; i < 7; i++) {
        finalCode += chars.charAt(Math.floor(Math.random() * chars.length));
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
