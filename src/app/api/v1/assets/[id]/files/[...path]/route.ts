import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, getAssetReadme, getAssetManifest } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  // Auth required
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

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

  // Look for the file in the asset's files array
  const files = asset.files || [];
  const matchedFile = files.find(
    (f) => (f.name || '').toLowerCase() === lowerPath || (f.name || '') === filePath
  );

  if (matchedFile && matchedFile.content) {
    // Determine content type from file extension
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
    const contentType = contentTypes[ext] || 'text/plain; charset=utf-8';

    return new NextResponse(matchedFile.content, {
      headers: {
        'Content-Type': contentType,
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
