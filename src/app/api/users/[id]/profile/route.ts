import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { findUserById, updateProfile } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    if (authResult.userId !== id) {
      return NextResponse.json({ success: false, error: '只能修改自己的资料' }, { status: 403 });
    }

    const user = findUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    const body = await request.json();
    const { name, bio } = body as { name?: string; bio?: string };

    const update: { name?: string; bio?: string } = {};

    // Name validation
    if (name !== undefined) {
      if (user.provider !== 'email') {
        return NextResponse.json({ success: false, error: '仅邮箱注册用户可修改昵称' }, { status: 403 });
      }
      const trimmed = String(name).trim();
      if (trimmed.length < 2 || trimmed.length > 30) {
        return NextResponse.json({ success: false, error: '昵称长度需在 2-30 字符之间' }, { status: 400 });
      }
      update.name = trimmed;
    }

    // Bio validation
    if (bio !== undefined) {
      const trimmed = String(bio).trim();
      if (trimmed.length > 200) {
        return NextResponse.json({ success: false, error: '个人简介不能超过 200 字符' }, { status: 400 });
      }
      update.bio = trimmed;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: false, error: '没有需要更新的字段' }, { status: 400 });
    }

    updateProfile(id, update);

    // Return updated user info
    const updated = findUserById(id);
    return NextResponse.json({
      success: true,
      user: {
        id: updated!.id,
        name: updated!.custom_name || updated!.name,
        avatar: updated!.custom_avatar || updated!.avatar,
        bio: updated!.bio,
        provider: updated!.provider,
      },
    });
  } catch (err) {
    console.error('PATCH /api/users/[id]/profile error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
