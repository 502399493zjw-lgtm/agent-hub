import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, getAssetVersion, incrementDownload } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';
import path from 'path';
import fs from 'fs';

const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Public endpoint: downloading is open (no auth required)
    // Auth is optional — used to track who downloaded
    const authResult = await authenticateRequest(request);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const requestedVersion = searchParams.get('version');

    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }

    // If specific version requested, verify it exists
    if (requestedVersion && requestedVersion !== asset.version) {
      const versionInfo = getAssetVersion(id, requestedVersion);
      if (!versionInfo) {
        return NextResponse.json({ success: false, error: `Version ${requestedVersion} not found` }, { status: 404 });
      }
    }

    const version = requestedVersion || asset.version;

    // Look for versioned package first, then default
    const extensions = ['tar.gz', 'tgz', 'zip', 'skill'];
    let packagePath: string | null = null;
    let contentType = 'application/octet-stream';
    let fileName = '';

    for (const ext of extensions) {
      // Try versioned path first: {id}-{version}.{ext}
      const versionedCandidate = path.join(PACKAGES_DIR, `${id}-${version}.${ext}`);
      if (fs.existsSync(versionedCandidate)) {
        packagePath = versionedCandidate;
        fileName = `${asset.name}-${version}.${ext}`;
        break;
      }
      // Fallback to unversioned: {id}.{ext}
      const candidate = path.join(PACKAGES_DIR, `${id}.${ext}`);
      if (fs.existsSync(candidate)) {
        packagePath = candidate;
        fileName = `${asset.name}-${version}.${ext}`;
        break;
      }
    }

    if (packagePath) {
      if (packagePath.endsWith('.tar.gz') || packagePath.endsWith('.tgz')) contentType = 'application/gzip';
      else if (packagePath.endsWith('.zip') || packagePath.endsWith('.skill')) contentType = 'application/zip';
    }

    if (!packagePath) {
      return NextResponse.json(
        { success: false, error: 'Package file not found. This asset was published without a package.' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(packagePath);

    // Auto-increment download counter
    incrementDownload(id, authResult?.userId);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Asset-Id': id,
        'X-Asset-Version': version,
      },
    });
  } catch (err) {
    console.error('GET /api/v1/assets/[id]/download error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/** POST to record a download (increment counter) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authResult = await authenticateRequest(request);
    const userId = authResult?.userId;

    const newCount = incrementDownload(id, userId);
    if (newCount === null) {
      return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: { downloads: newCount } });
  } catch (err) {
    console.error('POST /api/v1/assets/[id]/download error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
