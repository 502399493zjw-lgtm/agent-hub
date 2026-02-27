/**
 * Unified API authentication helper.
 *
 * Supports three authentication methods (in priority order):
 * 1. NextAuth session (web browser — cookie-based)
 * 2. Device ID (CLI / Agent — X-Device-ID header)
 * 3. API Key (Agent — Authorization: Bearer sk-xxx header)
 *
 * Usage in any API route:
 *   const authResult = await authenticateRequest(request);
 *   if (!authResult) return unauthorizedResponse();
 *   // authResult.userId is the authenticated user's ID
 *   // authResult.method is 'session' | 'device' | 'api_key'
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { validateDevice, findUserByApiKey, updateApiKeyLastUsed, isBanned } from '@/lib/db';

export interface AuthResult {
  userId: string;
  method: 'session' | 'device' | 'api_key';
}

/**
 * Authenticate an API request via NextAuth session, X-Device-ID header, or API Key.
 * Returns null if no method succeeds.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult | null> {
  let result: AuthResult | null = null;

  // 1. Try NextAuth session first (web browser)
  const session = await auth();
  if (session?.user?.id) {
    result = { userId: session.user.id, method: 'session' };
  }

  // 2. Try Device ID (CLI / Agent — reads from ~/.openclaw/identity/device.json)
  if (!result) {
    const deviceId = request.headers.get('X-Device-ID');
    if (deviceId) {
      const deviceInfo = validateDevice(deviceId);
      if (deviceInfo) {
        result = { userId: deviceInfo.userId, method: 'device' };
      }
    }
  }

  // 3. Try API Key (Authorization: Bearer sk-xxx)
  if (!result) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer sk-')) {
      const apiKey = authHeader.slice(7); // Remove 'Bearer ' prefix
      const user = findUserByApiKey(apiKey);
      if (user) {
        updateApiKeyLastUsed(apiKey);
        result = { userId: user.id, method: 'api_key' };
      }
    }
  }

  return result;
}

/**
 * Authenticate and check ban status. Returns { auth, banned } tuple.
 * Use this in routes that need ban enforcement.
 */
export async function authenticateAndCheckBan(request: NextRequest): Promise<{ auth: AuthResult | null; banned: boolean }> {
  const auth = await authenticateRequest(request);
  if (!auth) return { auth: null, banned: false };
  const banned = isBanned(auth.userId);
  return { auth, banned };
}

/**
 * Standard 401 Unauthorized response with helpful guidance for agents.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'authentication_required',
      message:
        '请先认证。推荐流程：1) 人类用户网页注册 2) 绑定设备 /api/auth/device/bind 3) Agent 通过 X-Device-ID 认证。也可使用 API Key (Authorization: Bearer sk-xxx)。',
      docs_url: '/explore',
    },
    { status: 401 }
  );
}

/**
 * Standard 403 Forbidden response when user is banned.
 */
export function bannedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'user_banned',
      message: '账号已被封禁。如有疑问请联系管理员。',
    },
    { status: 403 }
  );
}

/**
 * Standard 403 Forbidden response when user lacks invite code / permissions.
 */
export function inviteRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'invite_required',
      message: '需要有效邀请码。请通过 POST /api/auth/register 提供邀请码注册。',
      register_url: '/api/auth/register',
    },
    { status: 403 }
  );
}
