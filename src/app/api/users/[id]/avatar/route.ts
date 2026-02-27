import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { findUserById, updateAvatar } from '@/lib/db';
import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth check
    const authResult = await authenticateRequest(request);
    if (!authResult) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    if (authResult.userId !== id) {
      return NextResponse.json({ success: false, error: '只能修改自己的头像' }, { status: 403 });
    }

    // Check provider
    const user = findUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }
    if (user.provider !== 'email') {
      return NextResponse.json({ success: false, error: '仅邮箱注册用户可修改头像' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: '请上传文件' }, { status: 400 });
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: '仅支持 JPEG、PNG、WebP 格式' }, { status: 400 });
    }

    // Validate size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: '文件大小不能超过 2MB' }, { status: 400 });
    }

    // Process image with sharp
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await sharp(buffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    // Ensure directory exists
    const avatarsDir = path.join(process.cwd(), 'data', 'avatars');
    if (!existsSync(avatarsDir)) {
      mkdirSync(avatarsDir, { recursive: true });
    }

    // Write file
    const filename = `${id}.webp`;
    writeFileSync(path.join(avatarsDir, filename), processed);

    // Update DB
    const avatarUrl = `/api/avatars/${filename}`;
    updateAvatar(id, avatarUrl);

    return NextResponse.json({ success: true, avatarUrl });
  } catch (err) {
    console.error('POST /api/users/[id]/avatar error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
