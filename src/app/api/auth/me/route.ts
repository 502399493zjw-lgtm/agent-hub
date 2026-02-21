import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findUserById } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const user = findUserById(session.user.id);
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
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
  });
}
