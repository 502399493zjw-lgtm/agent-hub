import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndCheckBan, unauthorizedResponse, bannedResponse } from '@/lib/api-auth';
import { deleteAsset, getAssetById, getUserRole } from '@/lib/db';
import { hasRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { auth: authResult, banned } = await authenticateAndCheckBan(request);
  if (!authResult) return unauthorizedResponse();
  if (banned) return bannedResponse();

  const actorRole = getUserRole(authResult.userId);
  if (!actorRole || !hasRole(actorRole, 'moderator')) {
    return NextResponse.json({ success: false, error: 'forbidden', message: '需要 moderator 或 admin 角色' }, { status: 403 });
  }

  const { id } = await params;
  const asset = getAssetById(id);
  if (!asset) {
    return NextResponse.json({ success: false, error: 'asset_not_found' }, { status: 404 });
  }

  deleteAsset(id);
  return NextResponse.json({
    ok: true,
    deletedAssetId: id,
    deletedAssetName: asset.name,
  });
}
