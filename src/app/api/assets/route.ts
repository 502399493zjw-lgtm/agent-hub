import { NextRequest, NextResponse } from 'next/server';
import { listAssets, createAsset, findUserById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';
import { createAssetLimiter, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // Auth required: listing assets needs login
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

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
    // M04: Don't leak internal error details
    console.error('GET /api/assets error:', err instanceof Error ? err.message : 'Unknown error');
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
      return unauthorizedResponse();
    }

    // M01: Rate limiting — 20/min per user
    if (!createAssetLimiter.check(authResult.userId)) {
      return rateLimitResponse() as unknown as NextResponse;
    }

    // Check invite code activation (same check for both session and token auth)
    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) {
      return inviteRequiredResponse();
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

    // M09: Input validation
    const trimmedName = String(name).trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return NextResponse.json(
        { success: false, error: 'name must be between 2 and 100 characters' },
        { status: 400 }
      );
    }

    const trimmedDesc = String(description).trim();
    if (trimmedDesc.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'description must be less than 2000 characters' },
        { status: 400 }
      );
    }

    const validTypes = ['skill', 'experience', 'plugin', 'trigger', 'channel', 'template'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // M09: tags validation — max 10 tags
    const tags = body.tags;
    if (tags && Array.isArray(tags) && tags.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 tags allowed' },
        { status: 400 }
      );
    }

    // M10: Force authorId from authenticated user, get name/avatar from DB
    const asset = createAsset({
      name: trimmedName,
      displayName,
      type,
      description: trimmedDesc,
      version,
      authorId: authResult.userId,
      authorName: dbUser.name,
      authorAvatar: dbUser.avatar,
      longDescription: body.longDescription,
      tags: tags,
      category: body.category,
      readme: body.readme,
      configSubtype: body.configSubtype,
      githubUrl: body.githubUrl,
      githubStars: body.githubStars,
      githubForks: body.githubForks,
      githubLanguage: body.githubLanguage,
      githubLicense: body.githubLicense,
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('POST /api/assets error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
