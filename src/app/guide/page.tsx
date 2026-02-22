'use client';

import Link from 'next/link';
import { useState } from 'react';

const installMethods = [
  {
    id: 'cli',
    title: '🐟 seafood-market CLI',
    subtitle: '推荐',
    desc: '命令行工具，一键安装和管理资产',
    steps: [
      {
        title: '安装 CLI',
        code: 'curl -fsSL http://47.100.235.25:3000/install.sh | bash',
        note: '自动安装到 ~/.local/bin/seafood-market',
      },
      {
        title: '搜索资产',
        code: 'seafood-market search "飞书"',
        note: '模糊搜索技能、配置、插件等',
      },
      {
        title: '安装资产',
        code: 'seafood-market install skill/@xiaoyue/feishu-group-summary',
        note: '格式：seafood-market install <类型>/@<作者>/<名称>',
      },
      {
        title: '查看已安装',
        code: 'seafood-market list',
        note: '列出所有已安装的资产',
      },
    ],
  },
  {
    id: 'api',
    title: '🔌 REST API',
    subtitle: '进阶',
    desc: '直接调用 API，适合脚本和自动化',
    steps: [
      {
        title: '搜索资产',
        code: 'curl "http://47.100.235.25:3000/api/assets?q=weather&type=skill"',
        note: '支持 type / category / q / sort / pageSize 参数',
      },
      {
        title: '获取详情',
        code: 'curl "http://47.100.235.25:3000/api/assets/s-2mv27m"',
        note: '返回完整资产信息 + README',
      },
      {
        title: '发布资产',
        code: `curl -X POST http://47.100.235.25:3000/api/assets \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-skill",
    "displayName": "🌟 My Skill",
    "type": "skill",
    "description": "一句话描述",
    "version": "1.0.0",
    "authorId": "your-id",
    "authorName": "Your Name"
  }'`,
        note: '返回 { success: true, data: { id: "..." } }',
      },
    ],
  },
  {
    id: 'manual',
    title: '📁 手动安装',
    subtitle: '灵活',
    desc: '直接下载文件到本地 skills 目录',
    steps: [
      {
        title: '浏览市场',
        code: '# 访问 http://47.100.235.25:3000/explore',
        note: '在网页上找到想要的资产',
      },
      {
        title: '复制安装命令',
        code: '# 在资产详情页点击 "安装命令" 复制',
        note: '每个资产详情页都有一键复制功能',
      },
      {
        title: '手动放置文件',
        code: `# 技能放到 OpenClaw skills 目录
cp -r my-skill/ ~/openclaw/skills/my-skill/
# 确保包含 SKILL.md`,
        note: '重启 OpenClaw 后自动识别新技能',
      },
    ],
  },
];

const assetTypes = [
  { type: 'skill', emoji: '🛠️', name: '技能包', desc: 'SKILL.md + 脚本，prompt 驱动', example: 'seafood-market install skill/@xiaoyue/feishu-group-summary', color: 'text-foreground' },
  { type: 'experience', emoji: '💡', name: '经验', desc: '亲身实践方案、配置思路与参考文件', example: 'seafood-market install experience/@xiaoyue/quantum-sorcerer-persona', color: 'text-foreground' },
  { type: 'plugin', emoji: '🔌', name: '插件', desc: '代码级扩展，接入新工具和服务', example: 'seafood-market install plugin/@xiaoyue/stepsearch-engine', color: 'text-foreground' },
  { type: 'trigger', emoji: '🔔', name: '触发器', desc: '触发策略 + 可选的任务描述，纯事件源或完整自动化', example: 'seafood-market install trigger/@xiaoyue/pdf-watcher-v2', color: 'text-foreground' },
  { type: 'channel', emoji: '📡', name: '通信器', desc: '消息渠道适配器', example: 'seafood-market install channel/@xiaoyue/feishu-connector', color: 'text-foreground' },
  { type: 'template', emoji: '📋', name: '合集', desc: '多个资产的组合包，一键获得完整方案', example: 'seafood-market install template/@cybernova/personal-assistant', color: 'text-foreground' },
];

const faq = [
  { q: '安装后如何生效？', a: '大多数资产安装后即时生效。技能(Skill)和配置(Config)会在下次对话中自动加载；插件(Plugin)可能需要重启 OpenClaw。' },
  { q: '如何卸载资产？', a: '运行 `seafood-market uninstall <type>/<name>`，或手动删除对应目录。' },
  { q: '如何发布自己的资产？', a: '在网页上点击「发布」，或通过 API `POST /api/assets` 提交。详见发布页面。' },
  { q: 'CLI 连接不上怎么办？', a: '检查环境变量：`SEAFOOD_REGISTRY=http://47.100.235.25:3000`，确认网络可达。' },
  { q: '资产之间可以有依赖吗？', a: '可以。资产的 `dependencies` 字段声明依赖关系，CLI 安装时会提示。' },
];

export default function GuidePage() {
  const [activeMethod, setActiveMethod] = useState('cli');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const copyCode = (code: string, key: string) => {
    navigator.clipboard.writeText(code.replace(/^# .*$/gm, '').trim());
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-card-border bg-surface text-foreground text-sm mb-6">
          <span className="w-2 h-2 rounded-full bg-blue pulse-dot" />
          安装指南
        </div>
        <h1 className="text-4xl md:text-5xl font-bold font-serif mb-4">
          开始使用 <span className="gradient-text">水产市场</span>
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          三种方式为你的 Agent 安装新能力 — 选择最适合你的
        </p>
      </div>

      {/* Quick Start */}
      <div className="mb-16 p-8 rounded-lg border border-blue/20 bg-blue/5">
        <h2 className="text-xl font-bold mb-4">⚡ 30 秒快速开始</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue text-white flex items-center justify-center text-sm font-bold">1</span>
            <div>
              <code className="text-sm bg-white px-3 py-1.5 rounded-lg border border-card-border font-mono block">
                curl -fsSL http://47.100.235.25:3000/install.sh | bash
              </code>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue text-white flex items-center justify-center text-sm font-bold">2</span>
            <div>
              <code className="text-sm bg-white px-3 py-1.5 rounded-lg border border-card-border font-mono block">
                seafood-market search &quot;你想要的能力&quot;
              </code>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue text-white flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <code className="text-sm bg-white px-3 py-1.5 rounded-lg border border-card-border font-mono block">
                seafood-market install skill/@xiaoyue/feishu-group-summary
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Install Methods Tabs */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">📥 安装方式</h2>
        
        {/* Tab buttons */}
        <div className="flex gap-3 mb-8">
          {installMethods.map(method => (
            <button
              key={method.id}
              onClick={() => setActiveMethod(method.id)}
              className={`px-5 py-3 rounded-lg border text-sm font-medium transition-all ${
                activeMethod === method.id
                  ? 'border-card-border bg-surface text-foreground shadow-sm'
                  : 'border-card-border bg-white text-muted hover:border-blue/30'
              }`}
            >
              <div className="font-bold">{method.title}</div>
              <div className="text-xs opacity-70">{method.subtitle}</div>
            </button>
          ))}
        </div>

        {/* Active method steps */}
        {installMethods.map(method => method.id === activeMethod && (
          <div key={method.id} className="space-y-4">
            <p className="text-muted mb-6">{method.desc}</p>
            {method.steps.map((step, i) => (
              <div key={i} className="rounded-lg border border-card-border bg-white p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-surface text-foreground flex items-center justify-center text-sm font-bold font-mono">{i + 1}</span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <button
                    onClick={() => copyCode(step.code, `${method.id}-${i}`)}
                    className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded border border-card-border hover:border-foreground/15"
                  >
                    {copiedIndex === `${method.id}-${i}` ? '✅ 已复制' : '📋 复制'}
                  </button>
                </div>
                <pre className="bg-[#1e1e2e] text-green-400 rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  <code>{step.code}</code>
                </pre>
                {step.note && (
                  <p className="text-xs text-muted mt-3">💡 {step.note}</p>
                )}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Asset Types */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">📦 资产类型速查</h2>
        <p className="text-muted mb-8">水产市场有 6 种资产类型，各司其职</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assetTypes.map(at => (
            <div key={at.type} className="rounded-lg border border-card-border bg-white p-5 hover:border-blue/30 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{at.emoji}</span>
                <div>
                  <span className={`font-bold ${at.color}`}>{at.name}</span>
                  <span className="text-xs text-muted ml-2 font-mono">{at.type}</span>
                </div>
              </div>
              <p className="text-sm text-muted mb-3">{at.desc}</p>
              <code className="text-xs bg-surface px-2 py-1 rounded font-mono text-muted block truncate">
                {at.example}
              </code>
            </div>
          ))}
        </div>
      </section>

      {/* seafood-market CLI Reference */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">🐟 CLI 命令速查</h2>
        <div className="rounded-lg border border-card-border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface">
                <th className="text-left px-6 py-3 font-semibold">命令</th>
                <th className="text-left px-6 py-3 font-semibold">说明</th>
                <th className="text-left px-6 py-3 font-semibold">示例</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cmd: 'search', desc: '搜索资产', ex: 'seafood-market search "天气"' },
                { cmd: 'install', desc: '安装资产', ex: 'seafood-market install skill/@xiaoyue/web-search' },
                { cmd: 'list', desc: '已安装列表', ex: 'seafood-market list' },
                { cmd: 'info', desc: '查看详情', ex: 'seafood-market info skill/web-search' },
                { cmd: 'uninstall', desc: '卸载资产', ex: 'seafood-market uninstall skill/web-search' },
                { cmd: 'publish', desc: '发布资产', ex: 'seafood-market publish ./my-skill/' },
              ].map((row, i) => (
                <tr key={row.cmd} className={i % 2 === 0 ? '' : 'bg-surface/50'}>
                  <td className="px-6 py-3 font-mono text-foreground font-medium">{row.cmd}</td>
                  <td className="px-6 py-3 text-muted">{row.desc}</td>
                  <td className="px-6 py-3 font-mono text-xs text-muted">{row.ex}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6">❓ 常见问题</h2>
        <div className="space-y-4">
          {faq.map((item, i) => (
            <div key={i} className="rounded-lg border border-card-border bg-white p-6">
              <h3 className="font-semibold mb-2">{item.q}</h3>
              <p className="text-sm text-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">准备好了？</h2>
        <p className="text-muted mb-8">去探索市场，找到你的 Agent 需要的能力</p>
        <div className="flex justify-center gap-4">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-blue text-white font-semibold hover:bg-blue-dim transition-colors"
          >
            🐟 探索市场
          </Link>
          <Link
            href="/publish"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg border border-card-border text-foreground font-semibold hover:border-blue/30 transition-colors"
          >
            📤 发布资产
          </Link>
        </div>
      </section>
    </div>
  );
}
