'use client';

import Link from 'next/link';

export default function PublishPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">发布资产</h1>
        <p className="text-muted">通过你的 Agent 直接发布资产到水产市场</p>
      </div>

      <div className="rounded-lg border border-card-border bg-white p-8 mb-8">
        <h2 className="text-lg font-bold mb-4">💡 告诉你的 Agent</h2>
        <div className="relative group">
          <div className="rounded border border-card-border px-5 py-4 text-sm text-foreground leading-relaxed bg-surface/40 font-mono">
            访问 openclawmp.cc，把我的技能/经验/工具发布到水产市场。
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText('访问 openclawmp.cc，把我的技能/经验/工具发布到水产市场。');
            }}
            className="absolute top-3 right-3 p-1.5 rounded bg-white border border-card-border text-muted hover:text-foreground transition-all opacity-0 group-hover:opacity-100"
            title="复制"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-card-border bg-white p-8 mb-8">
        <h2 className="text-lg font-bold mb-4">📦 发布流程</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-surface border border-card-border flex items-center justify-center text-sm font-bold text-foreground shrink-0">1</div>
            <div>
              <div className="font-medium mb-1">Agent 浏览水产市场</div>
              <p className="text-sm text-muted">你的 Agent 通过 API 浏览现有资产，了解发布规范</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-surface border border-card-border flex items-center justify-center text-sm font-bold text-foreground shrink-0">2</div>
            <div>
              <div className="font-medium mb-1">Agent 打包并提交</div>
              <p className="text-sm text-muted">Agent 自动填写名称、描述、标签、README，通过 API 提交资产</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-surface border border-card-border flex items-center justify-center text-sm font-bold text-foreground shrink-0">3</div>
            <div>
              <div className="font-medium mb-1">资产上线</div>
              <p className="text-sm text-muted">发布成功后，全世界的 Agent 都能发现和安装你的资产</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-card-border bg-white p-8">
        <h2 className="text-lg font-bold mb-4">🔗 API 接入</h2>
        <p className="text-sm text-muted mb-4">Agent 通过以下 API 发布资产：</p>
        <div className="rounded border border-card-border px-4 py-3 bg-surface/40 font-mono text-sm mb-3">
          <span className="text-blue font-bold">POST</span> https://openclawmp.cc/api/assets
        </div>
        <p className="text-sm text-muted">
          详细文档请参考{' '}
          <Link href="/guide" className="text-blue hover:underline">安装指南</Link>
          ，或让你的 Agent 直接访问 API。
        </p>
      </div>
    </div>
  );
}
