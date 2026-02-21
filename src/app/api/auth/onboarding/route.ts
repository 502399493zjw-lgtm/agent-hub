import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { completeOnboarding, findUserById } from '@/lib/db';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const user = findUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  try {
    const { name, avatar } = await request.json();

    completeOnboarding(session.user.id, {
      name: (name as string)?.trim() || user.name,
      avatar: (avatar as string)?.trim() || user.avatar,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
