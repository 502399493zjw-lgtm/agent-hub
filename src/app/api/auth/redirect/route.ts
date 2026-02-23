/**
 * Server-side OAuth redirect — proxies NextAuth's signIn flow to get the real
 * provider authorize URL, then 302 redirects the user directly.
 *
 * This avoids client-side rendering delay (no React hydration needed).
 *
 * Usage: GET /api/auth/redirect?qt=<qualification_token>&provider=feishu
 */
import { NextRequest, NextResponse } from 'next/server';
import { peekQualificationToken } from '@/lib/db';

/**
 * Extract individual Set-Cookie headers from a fetch Response.
 * `getSetCookie()` is the standard API; fall back to splitting the raw header.
 */
function extractSetCookies(headers: Headers): string[] {
  // Modern Node.js and browsers support getSetCookie()
  if (typeof headers.getSetCookie === 'function') {
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) return cookies;
  }
  // Fallback: split raw header on ", " but be careful with Expires dates
  const raw = headers.get('set-cookie');
  if (!raw) return [];
  // Split on ", " that's followed by a cookie name (word=)
  return raw.split(/,\s*(?=[A-Za-z\-]+=)/).map(c => c.trim());
}

export async function GET(req: NextRequest) {
  const qt = req.nextUrl.searchParams.get('qt');
  const provider = req.nextUrl.searchParams.get('provider');

  if (!qt || !provider) {
    return NextResponse.json({ error: 'Missing qt or provider parameter' }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'http://localhost:3002';

  // For email, redirect to the register page (needs client-side form)
  if (provider === 'email') {
    return NextResponse.redirect(`${baseUrl}/register?qt=${qt}&provider=email`);
  }

  // Supported OAuth providers
  if (!['github', 'feishu', 'google'].includes(provider)) {
    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
  }

  try {
    // Step 1: Get CSRF token from NextAuth (server-side fetch to ourselves)
    // IMPORTANT: Use localhost to bypass Cloudflare CDN cache, which strips Set-Cookie headers
    const internalBase = `http://localhost:${process.env.PORT || '3000'}`;
    const csrfRes = await fetch(`${internalBase}/api/auth/csrf`);
    const csrfData = await csrfRes.json() as { csrfToken: string };
    const csrfToken = csrfData.csrfToken;

    // Get the cookies that NextAuth set
    const csrfCookies = extractSetCookies(csrfRes.headers);
    const cookieHeader = csrfCookies.map(c => c.split(';')[0]).join('; ');

    // Step 2: POST to NextAuth's signIn endpoint to get the OAuth redirect URL
    // After successful auth, redirect to home page (not register page)
    const callbackUrl = `${baseUrl}/`;
    const signInRes = await fetch(`${internalBase}/api/auth/signin/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookieHeader,
      },
      body: new URLSearchParams({
        csrfToken,
        callbackUrl,
      }).toString(),
      redirect: 'manual',
    });

    const location = signInRes.headers.get('location');
    if (!location) {
      return NextResponse.json({ error: 'Failed to get OAuth redirect URL' }, { status: 500 });
    }

    // Check if it's an error redirect
    if (location.includes('/api/auth/error') || location.includes('error=')) {
      return NextResponse.json({ error: 'OAuth provider configuration error', location }, { status: 500 });
    }

    // Step 3: Build response with redirect + all necessary cookies
    // IMPORTANT: Use raw Headers to avoid NextResponse.cookies overwriting set-cookie headers
    const headers = new Headers();
    headers.set('location', location);

    // Forward ALL cookies from both the csrf and signIn responses
    // These include: next-auth.csrf-token, next-auth.callback-url, next-auth.state
    const allCookies = [...csrfCookies, ...extractSetCookies(signInRes.headers)];
    for (const cookie of allCookies) {
      headers.append('set-cookie', cookie);
    }

    // Also set qualification_token cookie (Secure to match NextAuth cookies behind Cloudflare Tunnel)
    headers.append('set-cookie', `qualification_token=${qt}; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure`);

    // Set invite_code cookie — NextAuth's signIn callback reads this to allow new user registration
    const peek = peekQualificationToken(qt);
    if (peek.valid && peek.inviteCode) {
      headers.append('set-cookie', `invite_code=${encodeURIComponent(peek.inviteCode)}; Path=/; Max-Age=600; SameSite=Lax; Secure`);
      console.log('[auth/redirect] invite_code cookie set for code:', peek.inviteCode);
    } else {
      console.warn('[auth/redirect] No valid invite_code from qt:', qt, 'peek:', JSON.stringify(peek));
    }

    return new Response(null, { status: 307, headers });
  } catch (error) {
    console.error('[auth/redirect] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
