import { NextRequest, NextResponse } from 'next/server';
import { validateInviteCode } from '@/lib/db';
import { inviteValidateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // M01: Rate limiting — 5/min per IP
    const ip = getClientIp(request);
    if (!inviteValidateLimiter.check(ip)) {
      return rateLimitResponse() as unknown as NextResponse;
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: '请提供邀请码' }, { status: 400 });
    }

    const result = validateInviteCode(code.trim().toUpperCase());

    // M02: Add delay on failed validation to slow brute force
    if (!result.valid) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
