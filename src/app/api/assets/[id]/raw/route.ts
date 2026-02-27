import { NextRequest, NextResponse } from 'next/server';
import { getAssetById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth required
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();

    const { id } = await params;
    const asset = getAssetById(id);

    if (!asset) {
      return new NextResponse('# 404 Not Found\n\n资产未找到。', {
        status: 404,
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }

    // Build YAML frontmatter
    const frontmatter = [
      '---',
      `name: ${asset.name}`,
      `type: ${asset.type}`,
      `version: ${asset.version}`,
      `author: ${asset.author.name}`,
      `description: "${asset.description.replace(/"/g, '\\"')}"`,
      `tags: [${asset.tags.join(', ')}]`,
      '---',
    ].join('\n');

    let markdown: string;

    if (asset.readme && asset.readme.trim()) {
      // Has readme — prepend frontmatter
      markdown = `${frontmatter}\n\n${asset.readme}`;
    } else {
      // No readme — auto-generate from metadata
      const sections: string[] = [frontmatter, ''];

      sections.push(`# ${asset.displayName}`, '');
      sections.push(asset.longDescription || asset.description, '');

      if (asset.installCommand) {
        sections.push('## 安装', '', '```bash', asset.installCommand, '```', '');
      }

      if (asset.compatibility) {
        sections.push('## 兼容性', '');
        if (asset.compatibility.models.length > 0) {
          sections.push(`- 模型: ${asset.compatibility.models.join(', ')}`);
        }
        if (asset.compatibility.platforms.length > 0) {
          sections.push(`- 平台: ${asset.compatibility.platforms.join(', ')}`);
        }
        if (asset.compatibility.frameworks.length > 0) {
          sections.push(`- 框架: ${asset.compatibility.frameworks.join(', ')}`);
        }
        sections.push('');
      }

      if (asset.versions.length > 0) {
        sections.push('## 版本历史', '');
        sections.push('| 版本 | 日期 | 变更说明 |');
        sections.push('| --- | --- | --- |');
        for (const v of asset.versions) {
          sections.push(`| v${v.version} | ${v.date} | ${v.changelog} |`);
        }
        sections.push('');
      }

      markdown = sections.join('\n');
    }

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (err) {
    console.error('GET /api/assets/[id]/raw error:', err);
    return new NextResponse('# 500 Internal Server Error\n\n服务器内部错误。', {
      status: 500,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }
}
