import { NextRequest, NextResponse } from 'next/server';
import { listAssets, createAsset, findUserById, validateApiToken } from '@/lib/db';
import { auth } from '@/lib/auth';

// Authenticate via NextAuth session OR per-user API token (Bearer)
async function authenticateRequest(request: NextRequest): Promise<{ userId: string } | null> {
  // 1. Try NextAuth session first
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  // 2. Try Bearer token (per-user API token from DB)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenInfo = validateApiToken(token);
    if (tokenInfo) {
      return { userId: tokenInfo.userId };
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const category = searchParams.get('category') || undefined;
    const q = searchParams.get('q') || undefined;
    const sort = searchParams.get('sort') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

    const result = listAssets({ type, category, q, sort, page, pageSize });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('GET /api/assets error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Auth check: session or API token
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json(
        { success: false, error: 'Authentication required. Login on web or use API token (seafood-market login).' },
        { status: 401 }
      );
    }

    // Check invite code activation (same check for both session and token auth)
    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) {
      return NextResponse.json(
        { success: false, error: '需要激活邀请码才能发布。请先在网页上激活邀请码。' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { name, displayName, type, description, version } = body;
    if (!name || !displayName || !type || !description || !version) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, displayName, type, description, version' },
        { status: 400 }
      );
    }

    const validTypes = ['skill', 'config', 'plugin', 'trigger', 'channel', 'template'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const asset = createAsset({
      name,
      displayName,
      type,
      description,
      version,
      authorId: body.authorId,
      authorName: body.authorName,
      authorAvatar: body.authorAvatar,
      longDescription: body.longDescription,
      tags: body.tags,
      category: body.category,
      readme: body.readme,
      configSubtype: body.configSubtype,
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    console.error('POST /api/assets error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
