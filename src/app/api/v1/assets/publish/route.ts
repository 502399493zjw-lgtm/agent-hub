import { NextRequest, NextResponse } from 'next/server';
import { createAsset, getAssetById, updateAsset, findUserById, getDb } from '@/lib/db';
import { authenticateAndCheckBan, unauthorizedResponse, bannedResponse, inviteRequiredResponse } from '@/lib/api-auth';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { auth: authResult, banned } = await authenticateAndCheckBan(request);
    if (!authResult) return unauthorizedResponse();
    if (banned) return bannedResponse();

    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) return inviteRequiredResponse();

    const formData = await request.formData();

    // Parse metadata JSON
    const metadataRaw = formData.get('metadata') as string | null;
    if (!metadataRaw) {
      return NextResponse.json({ success: false, error: 'Missing required field: metadata (JSON string)' }, { status: 400 });
    }

    let metadata: {
      name: string; displayName: string; type: string; description: string;
      tags?: string[]; version: string; longDescription?: string;
      category?: string; configSubtype?: string; readme?: string;
    };
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid metadata JSON' }, { status: 400 });
    }

    const { name, displayName, type, description, version } = metadata;
    if (!name || !displayName || !type || !description || !version) {
      return NextResponse.json({ success: false, error: 'metadata must include: name, displayName, type, description, version' }, { status: 400 });
    }

    const validTypes = ['skill', 'experience', 'plugin', 'trigger', 'channel', 'template'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Collect uploaded files
    const uploadedFiles: { path: string; size: number; sha256: string; contentType: string; buffer: Buffer }[] = [];
    let packageFile: { buffer: Buffer; ext: string } | null = null;

    for (const [key, value] of formData.entries()) {
      if (key === 'metadata') continue;
      if (value instanceof File) {
        if (value.size > MAX_FILE_SIZE) {
          return NextResponse.json({ success: false, error: `File ${value.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, { status: 400 });
        }
        const buf = Buffer.from(await value.arrayBuffer());
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        if (key === 'package') {
          // Traditional package upload (.tar.gz / .zip / .skill)
          const origName = value.name || 'package.tar.gz';
          const isZip = origName.endsWith('.zip') || origName.endsWith('.skill');
          const isTarGz = origName.endsWith('.tar.gz') || origName.endsWith('.tgz');
          if (!isZip && !isTarGz) {
            return NextResponse.json({ success: false, error: 'Package must be .tar.gz, .tgz, .zip, or .skill file' }, { status: 400 });
          }
          packageFile = { buffer: buf, ext: isZip ? (origName.endsWith('.skill') ? 'skill' : 'zip') : 'tar.gz' };
        }

        uploadedFiles.push({
          path: value.name || key,
          size: buf.length,
          sha256,
          contentType: value.type || 'application/octet-stream',
          buffer: buf,
        });
      }
    }

    // Extract file list from package (tar.gz / zip) if provided
    let packageFilesMetadata: { path: string; size: number; sha256: string; contentType: string }[] = [];
    if (packageFile) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclawmp-pkg-'));
      const tmpPkg = path.join(tmpDir, `pkg.${packageFile.ext}`);
      const extractDir = path.join(tmpDir, 'extracted');
      fs.mkdirSync(extractDir, { recursive: true });
      fs.writeFileSync(tmpPkg, packageFile.buffer);

      try {
        if (packageFile.ext === 'tar.gz') {
          try {
            execSync(`tar xzf "${tmpPkg}" -C "${extractDir}" --strip-components=1 2>/dev/null`, { stdio: 'pipe' });
          } catch {
            // Retry without --strip-components (flat archive)
            try { execSync(`tar xzf "${tmpPkg}" -C "${extractDir}" 2>/dev/null`, { stdio: 'pipe' }); } catch { /* ignore */ }
          }
        } else {
          try { execSync(`unzip -o -q "${tmpPkg}" -d "${extractDir}" 2>/dev/null`, { stdio: 'pipe' }); } catch { /* ignore */ }
        }

        // Walk extracted directory to build file list
        const walkDir = (dir: string, prefix: string): void => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              walkDir(path.join(dir, entry.name), rel);
            } else if (entry.isFile()) {
              const fullPath = path.join(dir, entry.name);
              const buf = fs.readFileSync(fullPath);
              const sha = crypto.createHash('sha256').update(buf).digest('hex');
              const ext = path.extname(entry.name).toLowerCase();
              const ct = ext === '.md' ? 'text/markdown'
                : ext === '.json' ? 'application/json'
                : ext === '.js' || ext === '.ts' ? 'text/javascript'
                : ext === '.py' ? 'text/x-python'
                : ext === '.sh' ? 'text/x-shellscript'
                : ext === '.yaml' || ext === '.yml' ? 'text/yaml'
                : 'application/octet-stream';
              packageFilesMetadata.push({ path: rel, size: buf.length, sha256: sha, contentType: ct });
            }
          }
        };
        walkDir(extractDir, '');
      } finally {
        // Cleanup temp dir
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }

    // Use package-extracted files if available, otherwise fall back to uploaded files
    const filesMetadata = packageFilesMetadata.length > 0
      ? packageFilesMetadata
      : uploadedFiles.filter(f => f.path !== (packageFile ? `pkg.${packageFile.ext}` : '')).map(f => ({ path: f.path, size: f.size, sha256: f.sha256, contentType: f.contentType }));

    // Check if asset already exists (update vs create)
    const db = getDb();
    const existingAssets = db.prepare('SELECT id FROM assets WHERE name = ? AND author_id = ?').all(name, authResult.userId) as { id: string }[];

    let asset;

    if (existingAssets.length > 0) {
      // Update existing asset
      const existingId = existingAssets[0].id;
      updateAsset(existingId, {
        displayName,
        description,
        version,
        tags: metadata.tags,
        category: metadata.category,
        longDescription: metadata.longDescription,
        readme: metadata.readme,
        files: filesMetadata as unknown as Array<{ name: string; type: string }>,
      });
      asset = getAssetById(existingId)!;
    } else {
      // Create new asset
      asset = createAsset({
        name,
        displayName,
        type,
        description,
        version,
        authorId: authResult.userId,
        authorName: dbUser.name,
        authorAvatar: dbUser.avatar,
        tags: metadata.tags,
        category: metadata.category,
        longDescription: metadata.longDescription,
        readme: metadata.readme || '',
        configSubtype: metadata.configSubtype,
      });
      // Update files metadata
      if (filesMetadata.length > 0) {
        updateAsset(asset.id, { files: filesMetadata as unknown as Array<{ name: string; type: string }> });
      }
    }

    // Save package file if provided
    if (packageFile) {
      fs.mkdirSync(PACKAGES_DIR, { recursive: true });
      const packagePath = path.join(PACKAGES_DIR, `${asset.id}.${packageFile.ext}`);
      fs.writeFileSync(packagePath, packageFile.buffer);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: asset.id,
        name: asset.name,
        version: asset.version,
        files: filesMetadata,
        packageFile: packageFile ? `${asset.id}.${packageFile.ext}` : null,
      },
    }, { status: existingAssets.length > 0 ? 200 : 201 });
  } catch (err) {
    console.error('POST /api/v1/assets/publish error:', err instanceof Error ? err.message : 'Unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
