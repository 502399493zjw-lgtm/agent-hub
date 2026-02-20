import { NextRequest, NextResponse } from 'next/server';
import { createAsset, getAssetById, updateAsset } from '@/lib/db';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// data/packages/ 存放上传的包文件
const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // 必填：package 文件
    const file = formData.get('package') as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: package (file)' },
        { status: 400 }
      );
    }

    // 元数据字段
    const name = formData.get('name') as string;
    const displayName = formData.get('displayName') as string;
    const type = formData.get('type') as string;
    const description = formData.get('description') as string;
    const version = formData.get('version') as string;

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

    // 可选元数据
    const authorId = (formData.get('authorId') as string) || undefined;
    const authorName = (formData.get('authorName') as string) || undefined;
    const authorAvatar = (formData.get('authorAvatar') as string) || undefined;
    const longDescription = (formData.get('longDescription') as string) || undefined;
    const tagsRaw = formData.get('tags') as string;
    const tags = tagsRaw ? JSON.parse(tagsRaw) : undefined;
    const category = (formData.get('category') as string) || undefined;
    const configSubtype = (formData.get('configSubtype') as string) || undefined;

    // 如果没传 readme，尝试从包里提取 SKILL.md
    let readme = (formData.get('readme') as string) || undefined;

    // 读取文件 buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 确定文件扩展名
    const originalName = file.name || 'package.tar.gz';
    const isZip = originalName.endsWith('.zip') || originalName.endsWith('.skill');
    const isTarGz = originalName.endsWith('.tar.gz') || originalName.endsWith('.tgz');

    if (!isZip && !isTarGz) {
      return NextResponse.json(
        { success: false, error: 'Package must be .tar.gz, .tgz, .zip, or .skill file' },
        { status: 400 }
      );
    }

    // 先创建资产记录，拿到 ID
    const asset = createAsset({
      name,
      displayName,
      type,
      description,
      version,
      authorId,
      authorName,
      authorAvatar,
      longDescription,
      tags,
      category,
      readme: readme || '',
      configSubtype,
    });

    // 存储包文件：data/packages/{id}.{ext}
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
    const ext = isZip ? (originalName.endsWith('.skill') ? 'skill' : 'zip') : 'tar.gz';
    const packagePath = path.join(PACKAGES_DIR, `${asset.id}.${ext}`);
    fs.writeFileSync(packagePath, buffer);

    // 如果没有 readme，从包里提取 SKILL.md
    if (!readme) {
      try {
        const tmpDir = path.join(PACKAGES_DIR, `_tmp_${asset.id}`);
        fs.mkdirSync(tmpDir, { recursive: true });

        if (isZip) {
          execSync(`unzip -o -q "${packagePath}" -d "${tmpDir}"`, { timeout: 10000 });
        } else {
          execSync(`tar xzf "${packagePath}" -C "${tmpDir}"`, { timeout: 10000 });
        }

        // 搜索 SKILL.md（可能在子目录里）
        const findResult = execSync(`find "${tmpDir}" -name "SKILL.md" -type f | head -1`, { timeout: 5000 }).toString().trim();
        if (findResult) {
          readme = fs.readFileSync(findResult, 'utf-8');
          // 去除 frontmatter
          const fmMatch = readme.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
          if (fmMatch) readme = fmMatch[1].trim();
          // 更新资产的 readme
          updateAsset(asset.id, { readme });
        }

        // 清理临时目录
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to extract SKILL.md from package:', e);
      }
    }

    // 更新资产记录，标记有包文件
    updateAsset(asset.id, {
      // 存储包信息到 longDescription 末尾（简易方案）
      // 未来可加独立字段
    });

    return NextResponse.json({
      success: true,
      data: {
        ...asset,
        readme: readme || asset.readme,
        packageFile: `${asset.id}.${ext}`,
        packageSize: buffer.length,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/assets/upload error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
