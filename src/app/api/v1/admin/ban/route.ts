import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndCheckBan, unauthorizedResponse, bannedResponse } from '@/lib/api-auth';
import { findUserById, banUser, getUserRole } from '@/lib/db';
import { hasRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { auth: authResult, banned: isBannedUser } = await authenticateAndCheckBan(request);
  if (!authResult) return unauthorizedResponse();
  if (isBannedUser) return bannedResponse();

  // Check moderator+ role
  const actorRole = getUserRole(authResult.userId);
  if (!actorRole || !hasRole(actorRole, 'moderator')) {
    return NextResponse.json({ success: false, error: 'forbidden', message: '需要 moderator 或 admin 角色' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ success: false, error: 'missing_user_id', message: '请提供 userId' }, { status: 400 });
  }

  const reason = body.reason || '';

  // Cannot ban yourself
  if (body.userId === authResult.userId) {
    return NextResponse.json({ success: false, error: 'cannot_ban_self', message: '不能封禁自己' }, { status: 400 });
  }

  // Cannot ban someone with equal or higher role
  const targetUser = findUserById(body.userId);
  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'user_not_found' }, { status: 404 });
  }
  if (hasRole(targetUser.role, actorRole as 'moderator' | 'admin')) {
    return NextResponse.json({ success: false, error: 'insufficient_role', message: '不能封禁同级或更高角色的用户' }, { status: 403 });
  }

  const didBan = banUser(body.userId, reason, authResult.userId);
  return NextResponse.json({
    ok: true,
    alreadyBanned: !didBan,
  });
}
