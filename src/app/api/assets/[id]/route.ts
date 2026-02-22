import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, updateAsset, deleteAsset, findUserById, getCommentsByAssetId, getIssuesByAssetId, isStarred } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Auth required: viewing asset details needs login
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const comments = getCommentsByAssetId(id);
    const issues = getIssuesByAssetId(id);

    // Check if current user has starred
    const userStarred = isStarred(authResult.userId, id);

    return NextResponse.json({
      success: true,
      data: { asset, comments, issues, isStarred: userStarred },
    });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('GET /api/assets/[id] error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check: session or device token
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    // Check invite code activation
    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) {
      return inviteRequiredResponse();
    }

    const { id } = await params;

    // S03: Ownership check — only the author can update their asset
    const existingAsset = getAssetById(id);
    if (!existingAsset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }
    if (existingAsset.author.id !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: you can only update your own assets' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // S04: Filter out author fields — they cannot be changed via PUT
    const { authorId, authorName, authorAvatar, ...safeBody } = body;

    const updated = updateAsset(id, safeBody);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('PUT /api/assets/[id] error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // S02: Authentication required for DELETE
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    // Check invite code activation
    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) {
      return inviteRequiredResponse();
    }

    const { id } = await params;

    // S02: Ownership check — only the author can delete their asset
    const existingAsset = getAssetById(id);
    if (!existingAsset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }
    if (existingAsset.author.id !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: you can only delete your own assets' },
        { status: 403 }
      );
    }

    const deleted = deleteAsset(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    // M04: Don't leak internal error details
    console.error('DELETE /api/assets/[id] error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
