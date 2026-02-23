import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { softDeleteUser, findUserById } from '@/lib/db';

/**
 * DELETE /api/users/me — 注销当前账号（Web Session 专用）
 *
 * 完整注销流程：软删除 + OAuth 解绑 + 设备解绑 + API Key 撤销
 * 已发布的资产保留，不删除。
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

  return NextResponse.json({
    success: true,
    message: '账号已注销。设备已解绑，API Key 已撤销，OAuth 已解除关联。',
  });
}
