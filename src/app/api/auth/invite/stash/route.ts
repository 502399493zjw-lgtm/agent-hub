/**
 * POST /api/auth/invite/stash
 *
 * Stash invite code for an email address before sending magic link.
 * This ensures the signIn callback can find the invite code even if
 * the magic link is opened in a different browser/device where the
 * invite_code cookie doesn't exist.
 */
import { NextRequest, NextResponse } from 'next/server';
import { setPendingEmailInvite, validateInviteCode } from '@/lib/db';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const stashLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!stashLimiter.check(ip)) {
      return rateLimitResponse() as unknown as NextResponse;
    }

    const body = await request.json().catch(() => ({})) as { email?: string; invite_code?: string };
    const { email, invite_code } = body;

    if (!email || !invite_code) {
      return NextResponse.json({ success: false, error: 'Missing email or invite_code' }, { status: 400 });
    }

    // Validate invite code is still valid
    const validation = validateInviteCode(invite_code.trim().toUpperCase());
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error || '邀请码无效' }, { status: 403 });
    }

    setPendingEmailInvite(email, invite_code);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
