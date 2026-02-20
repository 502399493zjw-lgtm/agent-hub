import { NextRequest, NextResponse } from 'next/server';
import { listAssets, createAsset } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const category = searchParams.get('category') || undefined;
    const q = searchParams.get('q') || undefined;
    const sort = searchParams.get('sort') || undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : undefined;

    const result = listAssets({ type, category, q, sort, page, pageSize });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('GET /api/assets error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { name, displayName, type, description, version } = body;
    if (!name || !displayName || !type || !description || !version) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, displayName, type, description, version' },
        { status: 400 }
      );
    }

    const validTypes = ['skill', 'config', 'plugin', 'trigger', 'channel', 'template'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const asset = createAsset({
      name,
      displayName,
      type,
      description,
      version,
      authorId: body.authorId,
      authorName: body.authorName,
      authorAvatar: body.authorAvatar,
      longDescription: body.longDescription,
      tags: body.tags,
      category: body.category,
      readme: body.readme,
      configSubtype: body.configSubtype,
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (err) {
    console.error('POST /api/assets error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
