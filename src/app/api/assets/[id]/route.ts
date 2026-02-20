import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, updateAsset, deleteAsset } from '@/lib/db';
import { getCommentsByAssetId, getIssuesByAssetId } from '@/data/mock';

export async function GET(
  _request: NextRequest,
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

    // Comments and issues still from mock for now
    const comments = getCommentsByAssetId(id);
    const issues = getIssuesByAssetId(id);

    return NextResponse.json({
      success: true,
      data: { asset, comments, issues },
    });
  } catch (err) {
    console.error('GET /api/assets/[id] error:', err);
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
    const { id } = await params;
    const body = await request.json();

    const updated = updateAsset(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('PUT /api/assets/[id] error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = deleteAsset(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (err) {
    console.error('DELETE /api/assets/[id] error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
