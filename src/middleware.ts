import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware:
 * 1. /api/auth/* — Force no-cache headers to prevent CDN (Cloudflare) from
 *    caching auth responses and stripping Set-Cookie headers.
 * 2. /api/v1/*  — CORS headers for public API routes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Auth routes: force no-cache so CDN never strips Set-Cookie ──
  if (pathname.startsWith('/api/auth')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('CDN-Cache-Control', 'no-store');
    response.headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  }

  // ── Public API routes: CORS ──
  if (pathname.startsWith('/api/v1')) {
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('X-API-Version', '1.0');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/:path*', '/api/v1/:path*'],
};
