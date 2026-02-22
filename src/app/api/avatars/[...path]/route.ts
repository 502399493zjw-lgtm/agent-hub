import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params;
    const filePath = segments.join('/');

    // Sanitize: only allow alphanumeric, dash, underscore, dot
    if (!/^[\w.\-]+$/.test(filePath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const fullPath = path.join(process.cwd(), 'data', 'avatars', filePath);
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const buffer = readFileSync(fullPath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('GET /api/avatars error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
