import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { softDeleteUser, findUserById } from '@/lib/db';

/**
 * DELETE /api/users/me — Soft-delete the current user's account.
 *
 * - Clears OAuth binding (provider_id) so the external account can re-register
 * - Revokes all API keys
 * - Removes authorized devices
 * - Sets deleted_at timestamp
 * - Does NOT delete the user row or their published assets
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  const userId = session.user.id;
  const user = findUserById(userId);
  if (!user) {
    return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
  }
  if (user.deleted_at) {
    return NextResponse.json({ success: false, error: '账号已注销' }, { status: 400 });
  }

  const ok = softDeleteUser(userId);
  if (!ok) {
    return NextResponse.json({ success: false, error: '注销失败，请重试' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: '账号已注销' });
}
