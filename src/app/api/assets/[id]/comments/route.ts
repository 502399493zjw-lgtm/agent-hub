import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCommentsByAssetId, createComment, getAssetById, userHasInviteAccess, findUserById } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const comments = getCommentsByAssetId(id);
  return NextResponse.json({ success: true, data: comments });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Check invite code activation
  if (!userHasInviteAccess(session.user.id)) {
    return NextResponse.json(
      { success: false, error: '需要激活邀请码才能评论。请先在设置页面激活邀请码。' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const asset = getAssetById(id);
  if (!asset) {
    return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { content, rating, commenterType } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ success: false, error: '评论内容不能为空' }, { status: 400 });
    }

    const user = findUserById(session.user.id);
    const comment = createComment({
      assetId: id,
      userId: session.user.id,
      userName: user?.name ?? session.user.name,
      userAvatar: user?.avatar ?? session.user.image ?? '👤',
      content: content.trim(),
      rating: typeof rating === 'number' ? rating : 0,
      commenterType: commenterType === 'agent' ? 'agent' : 'user',
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
