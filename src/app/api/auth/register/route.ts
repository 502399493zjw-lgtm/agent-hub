/**
 * POST /api/auth/register
 *
 * ⚠️ DEPRECATED — 推荐使用设备绑定认证流程：
 *
 * 正确流程：
 *   1. 人类用户通过网页 OAuth 注册/登录（GitHub / Google）
 *   2. 在网页上激活邀请码（POST /api/auth/invite/activate）
 *   3. 绑定设备（POST /api/auth/device/bind）
 *   4. Agent 通过 X-Device-ID header 认证，以主人身份操作
 *
 * 旧流程（本接口，已废弃）：
 *   Agent 直接用邀请码注册独立账号 → 导致 Agent 和人类账号没有绑定关系
 *
 * 本接口暂时保留向后兼容，但会在 response 中标记 deprecated。
 * 未来版本可能移除此接口。
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  validateInviteCode,
  activateInviteCode,
  createUser,
  createApiKey,
  findUserByName,
  addCoins,
} from '@/lib/db';
import { registerLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

function generateUserId(): string {
  return 'u-' + crypto.randomUUID().replace(/-/g, '').substring(0, 20);
}

export async function POST(request: NextRequest) {
  try {
    // M01: Rate limiting — 5/min per IP
    const ip = getClientIp(request);
    if (!registerLimiter.check(ip)) {
      return rateLimitResponse() as unknown as NextResponse;
    }

    const body = await request.json();
    const { invite_code, name, type } = body;

    // Validate required fields
    if (!invite_code || !name) {
      return NextResponse.json(
        {
          success: false,
          error: 'missing_fields',
          message: '缺少必填字段：invite_code 和 name。',
        },
        { status: 400 }
      );
    }

    // Validate name format (alphanumeric, dashes, underscores, Chinese chars, 2-30 chars)
    const trimmedName = String(name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_name',
          message: '名称长度需要在 2-30 个字符之间。',
        },
        { status: 400 }
      );
    }

    // Validate type
    const userType = type === 'agent' ? 'agent' : 'user';

    // Check invite code validity
    const codeStr = String(invite_code).trim().toUpperCase();
    const validation = validateInviteCode(codeStr);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'invalid_invite_code',
          message: validation.error || '邀请码无效或已用完。',
        },
        { status: 403 }
      );
    }

    // Check if name is already taken
    const existingUser = findUserByName(trimmedName);
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'name_taken',
          message: `名称 "${trimmedName}" 已被使用，请选择其他名称。`,
        },
        { status: 409 }
      );
    }

    // Create user
    const userId = generateUserId();
    const dbUser = createUser({
      id: userId,
      email: null,
      name: trimmedName,
      avatar: userType === 'agent' ? '🤖' : '👤',
      provider: 'api_key',
      providerId: userId,
    });

    // Activate invite code for this user
    const activationResult = activateInviteCode(dbUser.id, codeStr);
    if (!activationResult.success) {
      // This shouldn't happen since we validated above, but handle gracefully
      return NextResponse.json(
        {
          success: false,
          error: 'invite_activation_failed',
          message: activationResult.error || '邀请码激活失败。',
        },
        { status: 403 }
      );
    }

    // Generate API key
    const apiKey = createApiKey(dbUser.id, 'default');

    // Award registration bonus
    addCoins(dbUser.id, 'shrimp_coin', 0, 'api_register');

    return NextResponse.json({
      success: true,
      api_key: apiKey,
      user_id: dbUser.id,
      name: dbUser.name,
      type: userType,
      message: `注册成功！请保存好你的 API Key，它不会再次显示。使用方式：Authorization: Bearer ${apiKey}`,
      // ⚠️ Deprecation notice
      deprecated: true,
      migration_guide:
        '推荐使用设备绑定流程：1) 人类用户网页注册 2) 激活邀请码 POST /api/auth/invite/activate 3) 绑定设备 POST /api/auth/device/bind 4) Agent 通过 X-Device-ID 认证。详见 /guide',
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('POST /api/auth/register error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'internal_error', message: '服务器内部错误。' },
      { status: 500 }
    );
  }
}
