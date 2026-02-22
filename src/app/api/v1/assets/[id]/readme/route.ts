import { NextRequest, NextResponse } from 'next/server';
import { getAssetReadme, getAssetById } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth required
  const authResult = await authenticateRequest(request);
  if (!authResult) return unauthorizedResponse();

  const { id } = await params;
  const data = getAssetReadme(id);
  if (!data) {
    return new NextResponse('# 404 Not Found\n\n资产未找到。', {
      status: 404,
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  let markdown = data.readme;
  if (!markdown || !markdown.trim()) {
    // Auto-generate minimal readme
    const asset = getAssetById(id);
    if (asset) {
      markdown = `# ${asset.displayName}\n\n${asset.longDescription || asset.description}\n\n## 安装\n\n\`\`\`bash\n${asset.installCommand}\n\`\`\`\n`;
    } else {
      markdown = `# ${data.displayName}\n\n暂无 README。`;
    }
  }

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}
