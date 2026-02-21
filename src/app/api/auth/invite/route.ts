import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserInviteCodes, userHasInviteAccess } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const activated = userHasInviteAccess(session.user.id);
  const codes = activated ? getUserInviteCodes(session.user.id) : [];

  return NextResponse.json({
    success: true,
    data: {
      activated,
      codes,
    },
  });
}
