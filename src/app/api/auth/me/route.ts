import { NextRequest, NextResponse } from 'next/server';
import { findUserById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  const user = findUserById(authResult.userId);
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      bio: user.bio,
      inviteCode: user.invite_code,
      role: user.role,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      authMethod: authResult.method, // 告诉调用者用了哪种认证
    },
  });
}
