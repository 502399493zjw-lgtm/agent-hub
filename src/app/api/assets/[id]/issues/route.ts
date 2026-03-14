import { NextRequest, NextResponse } from 'next/server';
import { getIssuesByAssetId, createIssue, getAssetById, userHasInviteAccess, findUserById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';

const ENDPOINT = process.env.SKILL_SCAN_ENDPOINT || 'http://scp-test.i-stepfun.net/scp/v1/risk/rich_text';
const TOKEN = process.env.SKILL_SCAN_API_KEY || '';

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

    // 调用内容审核（参照 v1 实现）
    const paramsForScan = {
      user_info: {
        user_id: authResult.userId,
      },
      package_id: id,
      async: false,
      biz_type: 'skill_market',
      only_machine_audit: false,
      extra: {
        penetrate_data: '{}',
      },
      resources: [
        {
          id: `issue${id}`,
          name: '',
          type: 'TEXT',
          scene: 'skill_market:issue',
          context: `${title?.trim()}${bodyText?.trim()}`,
        },
      ],
    };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(paramsForScan),
    });

    const text = await res.text().catch(() => '');
    let scanBody: unknown = text;
    try {
      scanBody = text ? JSON.parse(text) : {};
    } catch {}
    if (!res.ok || JSON.parse(text).data.decision === 'BLOCK') {
      return NextResponse.json(
        {
          success: false,
          error: 'Issue内容审核未通过',
          status: res.status,
          data: scanBody,
        },
        { status: 400 },
      );
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
