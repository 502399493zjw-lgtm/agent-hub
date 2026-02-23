import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, getAssetReadme, getAssetManifest } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

/**
 * Extract a single file from a saved package (tar.gz or zip).
 */
function extractFileFromPackage(assetId: string, filePath: string): { content: string; binary: boolean } | null {
  // Find the package file
  const exts = ['tar.gz', 'zip', 'skill'];
  let pkgPath: string | null = null;
  let pkgExt: string | null = null;
  for (const ext of exts) {
    const candidate = path.join(PACKAGES_DIR, `${assetId}.${ext}`);
    if (fs.existsSync(candidate)) {
      pkgPath = candidate;
      pkgExt = ext;
      break;
    }
  }
  if (!pkgPath || !pkgExt) return null;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclawmp-file-'));
  try {
    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    if (pkgExt === 'tar.gz') {
      // Try with --strip-components=1 first (standard npm-pack style)
      try {
        execSync(`tar xzf "${pkgPath}" -C "${extractDir}" --strip-components=1 2>/dev/null`, { stdio: 'pipe' });
      } catch {
        try { execSync(`tar xzf "${pkgPath}" -C "${extractDir}" 2>/dev/null`, { stdio: 'pipe' }); } catch { /* ignore */ }
      }
    } else {
      try { execSync(`unzip -o -q "${pkgPath}" -d "${extractDir}" 2>/dev/null`, { stdio: 'pipe' }); } catch { /* ignore */ }
    }

    const targetFile = path.join(extractDir, filePath);
    // Security: prevent path traversal
    if (!targetFile.startsWith(extractDir)) return null;

    if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
      const buf = fs.readFileSync(targetFile);
      // Check if binary
      const isBinary = buf.some((b, i) => i < 8192 && b === 0);
      if (isBinary) {
        return { content: '[Binary file]', binary: true };
      }
      return { content: buf.toString('utf-8'), binary: false };
    }

    // If strip-components didn't work, try finding the file inside a single top-level directory
    const entries = fs.readdirSync(extractDir);
    if (entries.length === 1) {
      const nested = path.join(extractDir, entries[0], filePath);
      if (fs.existsSync(nested) && fs.statSync(nested).isFile()) {
        const buf = fs.readFileSync(nested);
        const isBinary = buf.some((b, i) => i < 8192 && b === 0);
        if (isBinary) return { content: '[Binary file]', binary: true };
        return { content: buf.toString('utf-8'), binary: false };
      }
    }

    return null;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  // Public endpoint - no auth required for file preview
  const { id, path: pathSegments } = await params;
  const filePath = pathSegments.join('/');

  const asset = getAssetById(id);
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const lowerPath = filePath.toLowerCase();

  // Handle README / SKILL.md requests
  if (lowerPath === 'readme.md' || lowerPath === 'skill.md' || lowerPath === 'readme') {
    const data = getAssetReadme(id);
    let markdown = data?.readme || '';
    if (!markdown.trim()) {
      markdown = `# ${asset.displayName}\n\n${asset.longDescription || asset.description}\n`;
    }
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  }

  // Handle manifest.json / manifest.yaml requests
  if (lowerPath === 'manifest.json' || lowerPath === 'manifest.yaml' || lowerPath === 'manifest') {
    const manifestData = getAssetManifest(id);
    const manifest = {
      name: asset.name,
      type: asset.type,
      version: asset.version,
      author: asset.author.name,
      description: asset.description,
      tags: asset.tags,
      install: { command: asset.installCommand },
      compatibility: asset.compatibility,
      ...(manifestData?.manifest ?? {}),
    };
    return NextResponse.json(manifest, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  }

  // 1) Check in-DB files array (legacy: files with content field)
  const files = asset.files || [];
  const matchedFile = files.find(
    (f) => {
      const name = ('name' in f ? f.name : '') || ('path' in f ? (f as unknown as { path: string }).path : '');
      return name.toLowerCase() === lowerPath || name === filePath;
    }
  );

  if (matchedFile && 'content' in matchedFile && matchedFile.content) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentTypes: Record<string, string> = {
      md: 'text/markdown; charset=utf-8',
      json: 'application/json; charset=utf-8',
      yaml: 'text/yaml; charset=utf-8',
      yml: 'text/yaml; charset=utf-8',
      txt: 'text/plain; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      ts: 'application/typescript; charset=utf-8',
    };
    return new NextResponse(matchedFile.content, {
      headers: {
        'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  // 2) Extract from saved package file
  const extracted = extractFileFromPackage(id, filePath);
  if (extracted) {
    if (extracted.binary) {
      return NextResponse.json({ error: 'Binary file, cannot preview' }, { status: 415 });
    }
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentTypes: Record<string, string> = {
      md: 'text/markdown; charset=utf-8',
      json: 'application/json; charset=utf-8',
      yaml: 'text/yaml; charset=utf-8',
      yml: 'text/yaml; charset=utf-8',
      txt: 'text/plain; charset=utf-8',
      js: 'application/javascript; charset=utf-8',
      ts: 'application/typescript; charset=utf-8',
      py: 'text/x-python; charset=utf-8',
      sh: 'text/x-shellscript; charset=utf-8',
    };
    return new NextResponse(extracted.content, {
      headers: {
        'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  return NextResponse.json(
    {
      error: 'File not found',
      hint: `File "${filePath}" does not exist in asset ${id}. Try /api/v1/assets/${id}/readme or /api/v1/assets/${id}/manifest`,
    },
    { status: 404 }
  );
}
