import { NextRequest, NextResponse } from 'next/server';
import { getAssetManifest, getAssetById, updateAssetManifest, validateDevice } from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = getAssetManifest(id);
  if (!data) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const accept = request.headers.get('accept') || '';
  const asset = getAssetById(id);

  // Build full manifest (merge stored manifest with auto-generated fields)
  const manifest = {
    name: asset?.name,
    type: asset?.type,
    version: asset?.version,
    author: asset?.author.name,
    description: asset?.description,
    tags: asset?.tags,
    install: {
      command: asset?.installCommand,
    },
    compatibility: asset?.compatibility,
    // User-defined manifest fields override
    ...data.manifest,
  };

  // If client wants YAML, return text/yaml
  if (accept.includes('text/yaml') || accept.includes('application/yaml')) {
    const yaml = toYaml(manifest);
    return new NextResponse(yaml, {
      headers: {
        'Content-Type': 'text/yaml; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }

  return NextResponse.json(manifest);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const session = await auth();
  const deviceId = request.headers.get('X-Device-ID');
  let authenticated = false;
  if (session?.user?.id) authenticated = true;
  if (deviceId && validateDevice(deviceId)) authenticated = true;
  if (!authenticated) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const success = updateAssetManifest(id, body);
  if (!success) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Manifest updated' });
}

function toYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (typeof val[0] === 'object') {
        lines.push(`${pad}${key}:`);
        for (const item of val) {
          lines.push(`${pad}  - ${typeof item === 'object' ? JSON.stringify(item) : item}`);
        }
      } else {
        lines.push(`${pad}${key}:`);
        for (const item of val) {
          lines.push(`${pad}  - ${JSON.stringify(item)}`);
        }
      }
    } else if (typeof val === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(toYaml(val as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${pad}${key}: ${typeof val === 'string' && (val.includes(':') || val.includes('"')) ? JSON.stringify(val) : val}`);
    }
  }
  return lines.join('\n');
}
