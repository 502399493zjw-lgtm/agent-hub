import { NextRequest, NextResponse } from 'next/server';

/**
 * L11: CORS middleware for public API routes (/api/v1/*)
 * Adds CORS headers to allow cross-origin GET requests.
 */
export function middleware(request: NextRequest) {
  // Only apply CORS to /api/v1/* routes
  if (request.nextUrl.pathname.startsWith('/api/v1')) {
    // Handle preflight OPTIONS request
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

    // For actual requests, add CORS headers and API version to response
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('X-API-Version', '1.0');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/v1/:path*',
};
