import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { softDeleteUser } from '@/lib/db';

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const deleted = softDeleteUser(session.user.id);
  if (!deleted) {
    return NextResponse.json({ success: false, error: 'Failed to delete account' }, { status: 400 });
  }

  return NextResponse.json({ success: true, data: { message: 'Account deleted' } });
}
