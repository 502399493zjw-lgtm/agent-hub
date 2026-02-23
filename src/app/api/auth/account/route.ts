import { NextRequest, NextResponse } from 'next/server';
import { softDeleteUser } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

/**
 * DELETE /api/auth/account — 注销账号（软删除 + 解绑设备 + 撤销 API Key + 清 OAuth）
 *
 * 支持所有认证方式：Web Session / API Key / Device ID
 * 注销后：
 *   - 设 deleted_at，账号不再可用
 *   - 清除 provider_id（OAuth 解绑，外部账号可重新注册）
 *   - 删除所有 authorized_devices（设备解绑）
 *   - 撤销所有 API Key
 *   - 已发布的资产保留（不删除）
 */
export async function DELETE(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  const deleted = softDeleteUser(authResult.userId);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: 'delete_failed', message: '注销失败，账号可能已注销或不存在。' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      message: '账号已注销。设备已解绑，API Key 已撤销，OAuth 已解除关联。已发布的资产仍会保留。',
    },
  });
}
