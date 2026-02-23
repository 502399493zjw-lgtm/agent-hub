/**
 * POST /api/auth/qualify
 *
 * 邀请码预验证 + CLI auth 管道接口。
 *
 * 流程：
 *   1. Agent/CLI 提交邀请码 + device_id
 *   2. 验证邀请码有效（不消耗配额）
 *   3. 生成 qualificationToken（10分钟有效）
 *   4. 如果有 device_id，同时创建 CLI auth request（poll_code）
 *   5. 返回 available_methods + poll_code/poll_url
 *   6. 用户浏览器打开 auth_url 完成 OAuth 注册
 *   7. signIn callback 自动 approve CLI auth → 设备绑定
 *   8. Agent 轮询 poll_url → authorized
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateInviteCode, createQualificationToken, createCliAuthRequest } from '@/lib/db';
import { createRateLimiter, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

const qualifyLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** Build available_methods based on actually configured providers */
function getAvailableMethods(baseUrl: string, qualificationToken: string) {
  const methods: Array<{
    id: string;
    name: string;
    type: 'oauth' | 'email';
    description: string;
    auth_url?: string;
    instruction: string;
  }> = [];

  // GitHub OAuth — always available if AUTH_GITHUB_ID is set
  if (process.env.AUTH_GITHUB_ID) {
    methods.push({
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
      description: '使用 GitHub 账号授权登录，自动获取头像和用户名。',
      auth_url: `${baseUrl}/api/auth/redirect?qt=${qualificationToken}&provider=github`,
      instruction: '请在浏览器中打开上方链接，完成 GitHub 授权。',
    });
  }

  // Feishu OAuth — available if AUTH_FEISHU_APP_ID is set
  if (process.env.AUTH_FEISHU_APP_ID) {
    methods.push({
      id: 'feishu',
      name: '飞书',
      type: 'oauth',
      description: '使用飞书账号授权登录，适合国内用户。',
      auth_url: `${baseUrl}/api/auth/redirect?qt=${qualificationToken}&provider=feishu`,
      instruction: '请在浏览器中打开上方链接，完成飞书授权。',
    });
  }

  // Email Magic Link — available if AUTH_RESEND_KEY is set
  if (process.env.AUTH_RESEND_KEY) {
    methods.push({
      id: 'email',
      name: '邮箱',
      type: 'email',
      description: '输入邮箱地址，收到 Magic Link 后点击完成验证。',
      auth_url: `${baseUrl}/api/auth/redirect?qt=${qualificationToken}&provider=email`,
      instruction: '请提供你的邮箱地址，我们会发送一封包含登录链接的邮件。',
    });
  }

  return methods;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5/min per IP
    const ip = getClientIp(request);
    if (!qualifyLimiter.check(ip)) {
      return rateLimitResponse() as unknown as NextResponse;
    }

    const body = await request.json();
    const { invite_code, device_id, device_name } = body;

    if (!invite_code || typeof invite_code !== 'string') {
      return NextResponse.json(
        { success: false, error: 'missing_invite_code', message: '请提供邀请码。' },
        { status: 400 }
      );
    }

    const codeStr = invite_code.trim().toUpperCase();

    // Validate invite code (does NOT consume it)
    const validation = validateInviteCode(codeStr);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'invalid_invite_code', message: validation.error || '邀请码无效或已用完。' },
        { status: 403 }
      );
    }

    // Generate qualification token (10 min TTL)
    const qt = createQualificationToken(
      codeStr,
      typeof device_id === 'string' ? device_id : undefined,
      typeof device_name === 'string' ? device_name : undefined,
    );

    // Determine base URL for building auth links
    const baseUrl = (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');

    const methods = getAvailableMethods(baseUrl, qt.token);

    // If device_id is provided, also create a CLI auth request for polling
    let pollCode: string | undefined;
    let pollUrl: string | undefined;
    if (typeof device_id === 'string' && device_id) {
      const cliAuth = createCliAuthRequest(device_id, typeof device_name === 'string' ? device_name : '');
      pollCode = cliAuth.code;
      pollUrl = `${baseUrl}/api/auth/cli?code=${cliAuth.code}&deviceId=${encodeURIComponent(device_id)}`;
    }

    return NextResponse.json({
      success: true,
      qualification_token: qt.token,
      expires_in: 600,
      available_methods: methods,
      ...(pollCode ? { poll_code: pollCode, poll_url: pollUrl } : {}),
      message: '邀请码有效！请选择以下方式之一完成注册。',
      agent_hint: pollCode
        ? '引导用户打开 auth_url 完成 OAuth 注册，然后轮询 poll_url 等待 authorized 状态。'
        : '根据 available_methods 引导用户选择登录方式。OAuth 类型需要在浏览器打开 auth_url；email 类型需要用户提供邮箱地址。',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'internal_error', message: '服务器内部错误。' },
      { status: 500 }
    );
  }
}
