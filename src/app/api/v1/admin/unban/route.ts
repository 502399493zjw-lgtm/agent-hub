import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndCheckBan, unauthorizedResponse, bannedResponse } from '@/lib/api-auth';
import { unbanUser, getUserRole } from '@/lib/db';
import { hasRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { auth: authResult, banned } = await authenticateAndCheckBan(request);
  if (!authResult) return unauthorizedResponse();
  if (banned) return bannedResponse();

  const actorRole = getUserRole(authResult.userId);
  if (!actorRole || !hasRole(actorRole, 'moderator')) {
    return NextResponse.json({ success: false, error: 'forbidden', message: '需要 moderator 或 admin 角色' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.userId || typeof body.userId !== 'string') {
    return NextResponse.json({ success: false, error: 'missing_user_id', message: '请提供 userId' }, { status: 400 });
  }

  const unbanned = unbanUser(body.userId);
  return NextResponse.json({
    ok: true,
    alreadyUnbanned: !unbanned,
  });
}
