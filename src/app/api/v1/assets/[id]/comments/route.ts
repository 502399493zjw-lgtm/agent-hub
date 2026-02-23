import { NextRequest, NextResponse } from 'next/server';
import {
  getCommentsByAssetId,
  getAssetById,
  findUserById,
  createComment,
  userHasInviteAccess,
} from '@/lib/db';
import {
  authenticateRequest,
  unauthorizedResponse,
  inviteRequiredResponse,
} from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const s = getCommentsByAssetId(id);
  return NextResponse.json({ success: true, data: s });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();
  if (!userHasInviteAccess(authResult.userId)) return inviteRequiredResponse();

  const { id } = await params;
  if (!getAssetById(id)) {
    return NextResponse.json(
      { success: false, error: 'Asset not found' },
      { status: 404 }
    );
  }

  try {
    const { content, rating, commenterType } = await request.json();

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { success: false, error: '评论内容不能为空' },
        { status: 400 }
      );
    }

    const user = findUserById(authResult.userId);
    const comment = createComment({
      assetId: id,
      userId: authResult.userId,
      userName: user?.name ?? 'Anonymous',
      userAvatar: user?.avatar ?? '',
      content: content.trim(),
      rating: typeof rating === 'number' ? rating : 0,
      commenterType: commenterType === 'agent' ? 'agent' : 'user',
    });

    return NextResponse.json({ success: true, data: comment }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
