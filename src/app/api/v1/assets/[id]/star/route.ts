import { NextRequest, NextResponse } from 'next/server';
import {
  getAssetById,
  getTotalStars,
  getAssetUserStarCount,
  isStarred,
  starAsset,
  unstarAsset,
} from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

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

    const totalStars = getTotalStars(id);
    const userStars = getAssetUserStarCount(id);

    let isStarredByUser = false;
    const auth = await authenticateRequest(request);
    if (auth) {
      isStarredByUser = isStarred(auth.userId, id);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalStars,
        userStars,
        githubStars: asset.githubStars ?? 0,
        isStarred: isStarredByUser,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('GET /api/assets/[id]/star error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    if (!getAssetById(id)) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    const created = starAsset(auth.userId, id, 'manual');
    const totalStars = getTotalStars(id);

    return NextResponse.json({
      success: true,
      data: {
        starred: true,
        created,
        totalStars,
      },
    });
  } catch (error) {
    console.error('POST /api/assets/[id]/star error:', error);
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
    const auth = await authenticateRequest(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    if (!getAssetById(id)) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    const deleted = unstarAsset(auth.userId, id);
    const totalStars = getTotalStars(id);

    return NextResponse.json({
      success: true,
      data: {
        starred: false,
        deleted,
        totalStars,
      },
    });
  } catch (error) {
    console.error('DELETE /api/assets/[id]/star error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
