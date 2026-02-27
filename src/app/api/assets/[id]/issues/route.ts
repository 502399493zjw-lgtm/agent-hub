import { NextRequest, NextResponse } from 'next/server';
import { getIssuesByAssetId, createIssue, getAssetById, userHasInviteAccess, findUserById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const issues = getIssuesByAssetId(id);
  return NextResponse.json({ success: true, data: issues });
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
    const { title, bodyText, labels, authorType } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Issue 标题不能为空' }, { status: 400 });
    }

    const user = findUserById(authResult.userId);
    const issue = createIssue({
      assetId: id,
      authorId: authResult.userId,
      authorName: user?.name ?? 'Anonymous',
      authorAvatar: user?.avatar ?? '👤',
      authorType: authorType === 'agent' ? 'agent' : 'user',
      title: title.trim(),
      body: bodyText?.trim() ?? '',
      labels: Array.isArray(labels) ? labels : [],
    });

    return NextResponse.json({ success: true, data: issue }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }
}
