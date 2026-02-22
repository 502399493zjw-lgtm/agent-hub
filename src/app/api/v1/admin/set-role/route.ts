import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndCheckBan, unauthorizedResponse, bannedResponse } from '@/lib/api-auth';
import { findUserById, setUserRole, getUserRole } from '@/lib/db';
import { hasRole, isValidRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { auth: authResult, banned } = await authenticateAndCheckBan(request);
  if (!authResult) return unauthorizedResponse();
  if (banned) return bannedResponse();

  // Only admin can set roles
  const actorRole = getUserRole(authResult.userId);
  if (!actorRole || !hasRole(actorRole, 'admin')) {
    return NextResponse.json({ success: false, error: 'forbidden', message: '需要 admin 角色' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ success: false, error: 'missing_user_id', message: '请提供 userId' }, { status: 400 });
  }
  if (!body?.role || !isValidRole(body.role)) {
    return NextResponse.json({ success: false, error: 'invalid_role', message: '角色必须是 user, moderator, admin 之一' }, { status: 400 });
  }

  // Cannot change own role
  if (body.userId === authResult.userId) {
    return NextResponse.json({ success: false, error: 'cannot_change_own_role', message: '不能修改自己的角色' }, { status: 400 });
  }

  const targetUser = findUserById(body.userId);
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'user_not_found' }, { status: 404 });
  }

  setUserRole(body.userId, body.role);
  return NextResponse.json({
    ok: true,
    role: body.role,
  });
}
