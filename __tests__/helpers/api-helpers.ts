/**
 * API test helpers — utilities for testing Next.js App Router route handlers.
 *
 * These helpers construct proper Request objects and call route handlers directly,
 * bypassing HTTP to test the handler logic in isolation.
 */
import { NextRequest } from 'next/server';

/**
 * Create a NextRequest for testing route handlers.
 */
export function createTestRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown> | string;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', headers = {}, body, searchParams } = options;
  
  // Build URL with search params
  const fullUrl = new URL(url, 'http://localhost:3000');
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      fullUrl.searchParams.set(k, v);
    }
  }

  const requestInit: RequestInit = {
    method,
    headers: new Headers(headers),
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'string') {
      requestInit.body = body;
    } else {
      requestInit.body = JSON.stringify(body);
      (requestInit.headers as Headers).set('Content-Type', 'application/json');
    }
  }

  return new NextRequest(fullUrl.toString(), requestInit);
}

/**
 * Shorthand for authenticated requests with API key.
 */
export function authRequest(
  url: string,
  apiKey: string,
  options: Parameters<typeof createTestRequest>[1] = {}
): NextRequest {
  return createTestRequest(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

/**
 * Shorthand for authenticated requests with Device ID.
 */
export function deviceRequest(
  url: string,
  deviceId: string,
  options: Parameters<typeof createTestRequest>[1] = {}
): NextRequest {
  return createTestRequest(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Device-ID': deviceId,
    },
  });
}

/**
 * Parse JSON response from a NextResponse.
 */
export async function parseResponse(response: Response): Promise<{ status: number; data: any }> {
  const status = response.status;
  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status, data };
}
