import { NextRequest, NextResponse } from 'next/server';
import {
  getIssuesByAssetId,
  getAssetById,
  findUserById,
  createIssue,
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
  const s = getIssuesByAssetId(id);
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
    const { title, bodyText, labels, authorType } = await request.json();

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Issue 标题不能为空' },
        { status: 400 }
      );
    }

    const user = findUserById(authResult.userId);
    const issue = createIssue({
      assetId: id,
      authorId: authResult.userId,
      authorName: user?.name ?? 'Anonymous',
      authorAvatar: user?.avatar ?? '',
      authorType: authorType === 'agent' ? 'agent' : 'user',
      title: title.trim(),
      body: bodyText?.trim() ?? '',
      labels: Array.isArray(labels) ? labels : [],
    });

    return NextResponse.json({ success: true, data: issue }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
