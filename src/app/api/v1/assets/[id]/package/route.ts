import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  getAssetById,
  findUserById,
  updateAsset,
} from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';
import { uploadLimiter, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return unauthorizedResponse();

    if (!uploadLimiter.check(auth.userId)) {
      return rateLimitResponse();
    }

    const user = findUserById(auth.userId);
    if (!user?.invite_code) {
      return inviteRequiredResponse();
    }

    const { id } = await params;

    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    if (asset.author.id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: you can only upload packages for your own assets' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const packageFile = formData.get('package') as File | null;

    if (!packageFile) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: package (file)' },
        { status: 400 }
      );
    }

    // 10MB = 0xa00000
    if (packageFile.size > 0xa00000) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const arrayBuffer = await packageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 0xa00000) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    const filename = packageFile.name || 'package.tar.gz';
    const isZipLike = filename.endsWith('.zip') || filename.endsWith('.skill');
    const isTarGz = filename.endsWith('.tar.gz') || filename.endsWith('.tgz');

    if (!isZipLike && !isTarGz) {
      return NextResponse.json(
        { success: false, error: 'Package must be .tar.gz, .tgz, .zip, or .skill file' },
        { status: 400 }
      );
    }

    fs.mkdirSync(PACKAGES_DIR, { recursive: true });

    const ext = isZipLike
      ? filename.endsWith('.skill') ? 'skill' : 'zip'
      : 'tar.gz';

    // Remove any existing package files for this asset
    for (const oldExt of ['tar.gz', 'zip', 'skill']) {
      const oldPath = path.join(PACKAGES_DIR, `${id}.${oldExt}`);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const packagePath = path.join(PACKAGES_DIR, `${id}.${ext}`);
    fs.writeFileSync(packagePath, buffer);

    // Try to extract SKILL.md from the package
    let readmeUpdated = false;
    try {
      const tmpDir = path.join(PACKAGES_DIR, `_tmp_${id}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      if (isZipLike) {
        execSync(`unzip -o -q "${packagePath}" -d "${tmpDir}"`, { timeout: 10000 });
      } else {
        execSync(`tar xzf "${packagePath}" -C "${tmpDir}"`, { timeout: 10000 });
      }

      const skillMdPath = execSync(
        `find "${tmpDir}" -name "SKILL.md" -type f | head -1`,
        { timeout: 5000 }
      ).toString().trim();

      if (skillMdPath) {
        let content = fs.readFileSync(skillMdPath, 'utf-8');
        // Strip YAML frontmatter if present
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        if (match) {
          content = match[1].trim();
        }
        updateAsset(id, { readme: content });
        readmeUpdated = true;
      }

      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn(
        'Failed to extract SKILL.md from package:',
        e instanceof Error ? e.message : 'Unknown error'
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id,
        packageFile: `${id}.${ext}`,
        packageSize: buffer.length,
        readmeUpdated,
      },
    });
  } catch (error) {
    console.error(
      'POST /api/assets/[id]/package error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
