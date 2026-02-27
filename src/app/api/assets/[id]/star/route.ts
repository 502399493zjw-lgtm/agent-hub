import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, starAsset, unstarAsset, isStarred, getTotalStars, getAssetUserStarCount } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const totalStars = getTotalStars(id);
    const userStars = getAssetUserStarCount(id);

    // Check if current user has starred (optional auth)
    let starred = false;
    const authResult = await authenticateRequest(request);
    if (authResult) {
      starred = isStarred(authResult.userId, id);
    }

    return NextResponse.json({
      success: true,
      data: { totalStars, userStars, githubStars: asset.githubStars ?? 0, isStarred: starred },
    });
  } catch (err) {
    console.error('GET /api/assets/[id]/star error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const { id } = await params;
    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const created = starAsset(authResult.userId, id, 'manual');
    const totalStars = getTotalStars(id);

    return NextResponse.json({
      success: true,
      data: { starred: true, created, totalStars },
    });
  } catch (err) {
    console.error('POST /api/assets/[id]/star error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const { id } = await params;
    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    const deleted = unstarAsset(authResult.userId, id);
    const totalStars = getTotalStars(id);

    return NextResponse.json({
      success: true,
      data: { starred: false, deleted, totalStars },
    });
  } catch (err) {
    console.error('DELETE /api/assets/[id]/star error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
