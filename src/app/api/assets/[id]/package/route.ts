import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, updateAsset, findUserById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';
import { uploadLimiter, rateLimitResponse } from '@/lib/rate-limit';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Maximum file size — 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// data/packages/ 存放上传的包文件
const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

/**
 * POST /api/assets/[id]/package
 * Upload or update the package file for an existing asset.
 * Requires authentication + ownership.
 *
 * FormData:
 *   - package: File (required) — .tar.gz, .tgz, .zip, or .skill
 *
 * If the package contains SKILL.md, the asset's readme will be auto-updated.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return unauthorizedResponse();
    }

    // Rate limiting — reuse upload limiter (10/min per user)
    if (!uploadLimiter.check(authResult.userId)) {
      return rateLimitResponse() as unknown as NextResponse;
    }

    // Check invite code activation
    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) {
      return inviteRequiredResponse();
    }

    const { id } = await params;

    // Verify asset exists
    const asset = getAssetById(id);
    if (!asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Ownership check — only the author can upload/update the package
    if (asset.author.id !== authResult.userId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: you can only upload packages for your own assets' },
        { status: 403 }
      );
    }

    const formData = await request.formData();

    // Required: package file
    const file = formData.get('package') as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: package (file)' },
        { status: 400 }
      );
    }

    // File size check
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Determine file extension
    const originalName = file.name || 'package.tar.gz';
    const isZip = originalName.endsWith('.zip') || originalName.endsWith('.skill');
    const isTarGz = originalName.endsWith('.tar.gz') || originalName.endsWith('.tgz');

    if (!isZip && !isTarGz) {
      return NextResponse.json(
        { success: false, error: 'Package must be .tar.gz, .tgz, .zip, or .skill file' },
        { status: 400 }
      );
    }

    // Store package file: data/packages/{id}.{ext}
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
    const ext = isZip ? (originalName.endsWith('.skill') ? 'skill' : 'zip') : 'tar.gz';

    // Remove any existing package for this asset (different extension possible)
    for (const existingExt of ['tar.gz', 'zip', 'skill']) {
      const existingPath = path.join(PACKAGES_DIR, `${id}.${existingExt}`);
      if (fs.existsSync(existingPath)) {
        fs.unlinkSync(existingPath);
      }
    }

    const packagePath = path.join(PACKAGES_DIR, `${id}.${ext}`);
    fs.writeFileSync(packagePath, buffer);

    // Try to extract SKILL.md from the package and auto-update readme
    let readmeUpdated = false;
    try {
      const tmpDir = path.join(PACKAGES_DIR, `_tmp_${id}`);
      fs.mkdirSync(tmpDir, { recursive: true });

      if (isZip) {
        execSync(`unzip -o -q "${packagePath}" -d "${tmpDir}"`, { timeout: 10000 });
      } else {
        execSync(`tar xzf "${packagePath}" -C "${tmpDir}"`, { timeout: 10000 });
      }

      // Search for SKILL.md
      const findResult = execSync(`find "${tmpDir}" -name "SKILL.md" -type f | head -1`, { timeout: 5000 }).toString().trim();
      if (findResult) {
        let readme = fs.readFileSync(findResult, 'utf-8');
        // Strip frontmatter
        const fmMatch = readme.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        if (fmMatch) readme = fmMatch[1].trim();
        updateAsset(id, { readme });
        readmeUpdated = true;
      }

      // Cleanup temp directory
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to extract SKILL.md from package:', e instanceof Error ? e.message : 'Unknown error');
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
  } catch (err) {
    console.error('POST /api/assets/[id]/package error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
