import { NextRequest, NextResponse } from 'next/server';
import { getCommentsByAssetId, createComment, getAssetById, userHasInviteAccess, findUserById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';

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
  const authResult = await authenticateRequest(request);
  if (!authResult) {
    return unauthorizedResponse();
  }

  // Check invite code activation
  if (!userHasInviteAccess(authResult.userId)) {
    return inviteRequiredResponse();
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

    const user = findUserById(authResult.userId);
    const comment = createComment({
      assetId: id,
      userId: authResult.userId,
      userName: user?.name ?? 'Anonymous',
      userAvatar: user?.avatar ?? '👤',
      content: content.trim(),
      rating: typeof rating === 'number' ? rating : 0,
      commenterType: commenterType === 'agent' ? 'agent' : 'user',
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
