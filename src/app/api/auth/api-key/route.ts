import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';
import { createApiKey, listApiKeys, revokeApiKey, revokeApiKeyByRawKey } from '@/lib/db';

/**
 * POST /api/auth/api-key
 * Generate a new API key for the authenticated user.
 * Body: { name?: string }
 * Returns: { success: true, api_key: "sk-xxx" }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    let name = 'default';
    try {
      const body = await request.json();
      if (body.name && typeof body.name === 'string') {
        name = body.name.trim().slice(0, 50);
      }
    } catch {
      // Body is optional / may be empty
    }

    const apiKey = createApiKey(authResult.userId, name);

    return NextResponse.json({
      success: true,
      api_key: apiKey,
      message: '请保存好你的 API Key，它不会再次完整显示。',
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('POST /api/auth/api-key error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'internal_error', message: '服务器内部错误。' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/api-key
 * List all API keys for the authenticated user (only prefix shown, never full key).
 * Returns: { success: true, keys: [...] }
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const keys = listApiKeys(authResult.userId);

    // S01: Only return key_prefix (first 10 chars) — full key is never stored
    const maskedKeys = keys.map((k) => ({
      key_hash: k.key_hash,
      key_prefix: k.key_prefix + '...',
      name: k.name,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked: !!k.revoked,
    }));

    return NextResponse.json({
      success: true,
      keys: maskedKeys,
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('GET /api/auth/api-key error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'internal_error', message: '服务器内部错误。' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/api-key
 * Revoke an API key by key_hash or raw key.
 * Body: { key_hash: "abc..." } or { key: "sk-xxx" }
 * Returns: { success: true }
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const body = await request.json();
    const { key, key_hash } = body;

    let revoked = false;

    if (key_hash && typeof key_hash === 'string') {
      // Revoke by hash (preferred method — used by frontend listing)
      revoked = revokeApiKey(key_hash, authResult.userId);
    } else if (key && typeof key === 'string' && key.startsWith('sk-')) {
      // Revoke by raw key (backward compatibility)
      revoked = revokeApiKeyByRawKey(key, authResult.userId);
    } else {
      return NextResponse.json(
        { success: false, error: 'invalid_key', message: '请提供有效的 key_hash 或 API Key。' },
        { status: 400 }
      );
    }

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: 'key_not_found', message: 'API Key 不存在或不属于当前用户。' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API Key 已撤销。',
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('DELETE /api/auth/api-key error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'internal_error', message: '服务器内部错误。' },
      { status: 500 }
    );
  }
}
