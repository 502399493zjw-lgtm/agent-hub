import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, incrementDownload } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';
import path from 'path';
import fs from 'fs';

const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth required: downloading needs login
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const { id } = await params;
    
    // 验证资产存在
    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // 查找包文件（可能是 .tar.gz / .zip / .skill）
    const extensions = ['tar.gz', 'tgz', 'zip', 'skill'];
    let packagePath: string | null = null;
    let contentType = 'application/octet-stream';
    let fileName = '';

    for (const ext of extensions) {
      const candidate = path.join(PACKAGES_DIR, `${id}.${ext}`);
      if (fs.existsSync(candidate)) {
        packagePath = candidate;
        fileName = `${asset.name}-${asset.version}.${ext}`;
        if (ext === 'tar.gz' || ext === 'tgz') {
          contentType = 'application/gzip';
        } else if (ext === 'zip' || ext === 'skill') {
          contentType = 'application/zip';
        }
        break;
      }
    }

    if (!packagePath) {
      return NextResponse.json(
        { success: false, error: 'Package file not found. This asset was published without a package.' },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(packagePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Asset-Id': id,
        'X-Asset-Version': asset.version,
      },
    });
  } catch (err) {
    console.error('GET /api/assets/[id]/download error:', err);
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
    const { id } = await params;

    // Try to identify user for auto-star on download
    const authResult = await authenticateRequest(request);
    const userId = authResult?.userId;

    const newCount = incrementDownload(id, userId);
    if (newCount === null) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { downloads: newCount },
    });
  } catch (err) {
    console.error('POST /api/assets/[id]/download error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
