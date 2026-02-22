import { NextRequest, NextResponse } from 'next/server';
import { softDeleteUser } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  // Account deletion is a sensitive operation — only allow via web session
  if (authResult.method !== 'session') {
    return NextResponse.json(
      {
        success: false,
        error: 'web_session_required',
        message: '账号删除操作仅允许通过网页登录进行。',
      },
      { status: 403 }
    );
  }

  const deleted = softDeleteUser(authResult.userId);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { message: 'Account deleted' } });
}
