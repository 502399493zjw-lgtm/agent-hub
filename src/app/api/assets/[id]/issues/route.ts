import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getIssuesByAssetId, createIssue, getAssetById, userHasInviteAccess, findUserById } from '@/lib/db';

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // Check invite code activation
  if (!userHasInviteAccess(session.user.id)) {
    return NextResponse.json(
      { success: false, error: '需要激活邀请码才能提交 Issue。请先在设置页面激活邀请码。' },
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
    const { title, bodyText, labels, authorType } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ success: false, error: 'Issue 标题不能为空' }, { status: 400 });
    }

    const user = findUserById(session.user.id);
    const issue = createIssue({
      assetId: id,
      authorId: session.user.id,
      authorName: user?.name ?? session.user.name,
      authorAvatar: user?.avatar ?? session.user.image ?? '👤',
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
