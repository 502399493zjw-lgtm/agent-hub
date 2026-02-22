import { NextResponse } from 'next/server';
import { getAssetCountByType } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const typeCounts = getAssetCountByType();
  const totalAssets = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    name: '水产市场 API',
    api_version: '1.0',
    version: '1.0.0',
    description: 'Agent Hub — 探索、安装、发布 Agent 技能与配置。Agent 和人类均可使用。',
    endpoints: {
      search: { method: 'GET', path: '/api/v1/search', params: { q: 'string (required)', type: 'skill|config|plugin|trigger|channel|template', tag: 'string', cursor: 'string', limit: 'number (1-50, default 20)' } },
      assets: { method: 'GET', path: '/api/v1/assets', params: { type: 'string', tag: 'string', category: 'string', q: 'string', sort: 'installs|newest|trending', cursor: 'string', limit: 'number (1-100)', facets: 'boolean — 附带 tags/categories 聚合' } },
      asset_detail: { method: 'GET', path: '/api/v1/assets/{id}', description: 'L2 检视：资产详情、最新版本、作者' },
      asset_versions: { method: 'GET', path: '/api/v1/assets/{id}/versions', params: { version: 'string (可选，查特定版本)' }, description: '版本列表或指定版本详情' },
      asset_download: { method: 'GET', path: '/api/v1/assets/{id}/download', params: { version: 'string (可选，默认最新)' }, description: '下载资产包文件' },
      asset_files: { method: 'GET', path: '/api/v1/assets/{id}/files/{path}', description: 'L3 深潜：单个文件原始内容' },
      asset_manifest: { method: 'GET', path: '/api/v1/assets/{id}/manifest', description: '结构化元数据（JSON）' },
      asset_readme: { method: 'GET', path: '/api/v1/assets/{id}/readme', description: 'README (text/markdown)' },
      batch: { method: 'POST', path: '/api/v1/assets/batch', body: { ids: 'string[]', fields: 'compact|full' } },
      publish: { method: 'POST', path: '/api/v1/assets/publish', description: '发布/更新资产（multipart: metadata JSON + files）', auth: 'required' },
      resolve: { method: 'GET', path: '/api/v1/resolve', params: { hash: 'sha256:xxx 或 hex' }, description: '通过文件哈希定位资产' },
      admin_ban: { method: 'POST', path: '/api/v1/admin/ban', body: { userId: 'string', reason: 'string' }, auth: 'moderator+' },
      admin_unban: { method: 'POST', path: '/api/v1/admin/unban', body: { userId: 'string' }, auth: 'moderator+' },
      admin_set_role: { method: 'POST', path: '/api/v1/admin/set-role', body: { userId: 'string', role: 'user|moderator|admin' }, auth: 'admin' },
      admin_delete_asset: { method: 'DELETE', path: '/api/v1/admin/assets/{id}', auth: 'moderator+' },
    },
    asset_types: Object.keys(typeCounts),
    stats: {
      total_assets: totalAssets,
      type_breakdown: typeCounts,
    },
    agent_hint: '推荐流程: search → assets/{id} → files/{path} → download。L1 搜索即可决策，L2 检视确认详情，L3 按需读文件。?facets=true 获取聚合。resolve?hash=sha256:xxx 通过哈希定位文件。versions 查版本历史。publish 发布资产。',
  });
}
