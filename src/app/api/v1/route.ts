import { NextResponse } from 'next/server';
import { getAssetCountByType, getAllTags, getAllCategories } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const typeCounts = getAssetCountByType();
  const totalAssets = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return NextResponse.json({
    name: '水产市场 API',
    version: '1.0.0',
    description: 'Agent Hub — 探索、安装、发布 Agent 技能与配置。Agent 和人类均可使用。',
    endpoints: {
      search: { method: 'GET', path: '/api/v1/search', params: { q: 'string (required)', type: 'skill|config|plugin|trigger|channel|template', tag: 'string', limit: 'number (1-50, default 20)' } },
      assets: { method: 'GET', path: '/api/v1/assets', params: { type: 'string', tag: 'string', category: 'string', q: 'string', sort: 'installs|rating|newest', page: 'number', pageSize: 'number (1-100)' } },
      asset_detail: { method: 'GET', path: '/api/v1/assets/{id}', description: '完整资产信息' },
      asset_manifest: { method: 'GET', path: '/api/v1/assets/{id}/manifest', description: '结构化元数据（机器可读）' },
      asset_readme: { method: 'GET', path: '/api/v1/assets/{id}/readme', description: 'README (text/markdown)' },
      batch: { method: 'POST', path: '/api/v1/assets/batch', body: { ids: 'string[]', fields: 'compact|full' } },
      trending: { method: 'GET', path: '/api/v1/trending', params: { period: 'day|week|month|all', limit: 'number' } },
      tags: { method: 'GET', path: '/api/v1/tags' },
      categories: { method: 'GET', path: '/api/v1/categories' },
    },
    asset_types: Object.keys(typeCounts),
    stats: {
      total_assets: totalAssets,
      type_breakdown: typeCounts,
    },
    agent_hint: '建议流程: search/assets → asset_detail → manifest → install。compact 模式节省 token，manifest 提供机器可读的触发词、环境变量、示例等。',
    tags: getAllTags().slice(0, 20),
    categories: getAllCategories(),
  });
}
