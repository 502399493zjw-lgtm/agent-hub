'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AssetType, typeConfig } from '@/data/mock';
import { useAuth } from '@/lib/auth-context';

const allCategories = ['信息查询', '开发工具', '创意生成', '数据处理', '效率工具', '语言处理', '创意角色', '教育辅导', '商业顾问', '趣味角色', '存储引擎', '通信集成', '基础设施', '安全认证', '自动化', '语音处理', '事件触发', '知识工作', '内容创作', '开发运维', '客户服务', 'Agent 模板'];

const LIMITS = {
  name: 40,
  displayName: 60,
  description: 200,
  tags: 100,
} as const;

function CharCounter({ current, max }: { current: number; max: number }) {
  const pct = current / max;
  const color = pct > 1 ? 'text-red' : pct > 0.8 ? 'text-amber-400' : 'text-muted';
  return (
    <span className={`text-xs font-mono ${color}`}>{current}/{max}</span>
  );
}

export default function PublishPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [assetType, setAssetType] = useState<AssetType>('skill');
  const [configSubtype, setConfigSubtype] = useState<'routing' | 'model' | 'persona' | 'scope'>('persona');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [readme, setReadme] = useState('');
  const [category, setCategory] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill author from logged-in user
  useEffect(() => {
    if (user && !authorId) {
      setAuthorId(user.id);
    }
  }, [user, authorId]);

  const typeOptions: { value: AssetType; label: string; icon: string; desc: string }[] = [
    { value: 'skill', label: '技能', icon: '', desc: '让 Agent 获得新能力的技能包' },
    { value: 'config', label: '配置', icon: '', desc: '定义 Agent 人格与行为模式' },
    { value: 'plugin', label: '工具', icon: '', desc: '扩展 Agent 基础设施的工具' },
    { value: 'trigger', label: '触发器', icon: '', desc: '事件监听与条件触发模板' },
    { value: 'channel', label: '通信器', icon: '', desc: '连接 Agent 与外部世界' },
    { value: 'template', label: '合集', icon: '', desc: '完整 Agent 配置合集' },
  ];

  const parsedTags = useMemo(() => tags.split(',').map(t => t.trim()).filter(Boolean).slice(0, 5), [tags]);
  const isValid = name.trim().length > 0 && displayName.trim().length > 0 && description.trim().length > 0 && description.length <= LIMITS.description && name.length <= LIMITS.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          displayName: displayName.trim(),
          type: assetType,
          description: description.trim(),
          version: '1.0.0',
          longDescription: description.trim(),
          tags: parsedTags,
          category: category || undefined,
          readme: readme.trim() || undefined,
          configSubtype: assetType === 'config' ? configSubtype : undefined,
          authorId: authorId.trim() || user?.id || undefined,
          authorName: user?.name || undefined,
          authorAvatar: user?.avatar || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '发布失败');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      // Redirect to new asset detail page after 1.5s
      setTimeout(() => {
        router.push(`/asset/${data.data.id}`);
      }, 1500);
    } catch {
      setError('网络错误，请重试');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          发布<span className="text-blue">资产</span>
        </h1>
        <p className="text-muted">分享你的 Skills、Configs 或 Plugins，让全世界的 Agent 受益</p>
      </div>

      {/* Invite code gate */}
      {user && !user.inviteCode && (
        <div className="mb-8 p-6 rounded-lg bg-amber-50 border border-amber-200 text-center">
          <div className="text-4xl mb-3">🎟️</div>
          <h2 className="text-lg font-semibold text-amber-800 mb-2">需要邀请码</h2>
          <p className="text-sm text-amber-700 mb-4">
            你需要先激活邀请码才能发布资产。邀请码可以从社区获取。
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors"
          >
            🎟️ 去激活邀请码
          </Link>
        </div>
      )}

      {(!user || user.inviteCode) && (
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-8">
          {/* Asset Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-3">选择资产类型</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAssetType(opt.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    assetType === opt.value
                      ? `${typeConfig[opt.value].bgColor} ${typeConfig[opt.value].borderColor}`
                      : 'border-card-border bg-white hover:border-card-hover'
                  }`}
                >
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className={`font-semibold mb-1 ${assetType === opt.value ? typeConfig[opt.value].color : 'text-foreground'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Config Subtype Selector (shown when type is config) */}
          {assetType === 'config' && (
            <div>
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-3">Config 子类型</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([
                  { value: 'persona' as const, label: '人格', desc: 'Agent 人格与对话风格' },
                  { value: 'routing' as const, label: '路由', desc: '请求路由与分发规则' },
                  { value: 'model' as const, label: '模型', desc: '模型选择与参数配置' },
                  { value: 'scope' as const, label: '权限', desc: '访问范围与权限策略' },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfigSubtype(opt.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      configSubtype === opt.value
                        ? 'bg-red/10 border-red/30 text-red'
                        : 'border-card-border bg-white hover:border-card-hover text-muted'
                    }`}
                  >
                    <div className="text-sm font-semibold mb-0.5">{opt.label}</div>
                    <div className="text-[10px] opacity-70">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chinese Display Name (primary) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider">中文名称</label>
              <CharCounter current={displayName.length} max={LIMITS.displayName} />
            </div>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.displayName))}
              placeholder="📂 文件系统事件监听器"
              className="w-full px-4 py-3 rounded-lg bg-white border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
            />
            <p className="text-xs text-muted mt-1.5">用户看到的名字，支持 emoji 前缀</p>
          </div>

          {/* Package Name (secondary) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider">包名 <span className="normal-case font-normal text-muted/60">(Package Name)</span></label>
              <CharCounter current={name.length} max={LIMITS.name} />
            </div>
            <div className="flex items-center gap-0 rounded-lg overflow-hidden border border-card-border bg-white focus-within:border-blue/50 transition-colors">
              <span className="px-4 py-3 bg-surface text-muted text-sm border-r border-card-border font-mono">@{authorId || 'username'}/</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.replace(/[^a-z0-9-]/g, '').slice(0, LIMITS.name))}
                placeholder="fs-event-trigger"
                className="flex-1 px-4 py-3 bg-transparent text-foreground placeholder:text-muted/50 focus:outline-none font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted mt-1.5">小写字母、数字和连字符，用于安装命令</p>
          </div>

          {/* Author ID */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider">Author ID</label>
            </div>
            <input
              type="text"
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value.replace(/[^a-z0-9_-]/g, '').slice(0, 40))}
              placeholder="xiaoyue"
              className="w-full px-4 py-3 rounded-lg bg-white border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors font-mono text-sm"
            />
            <p className="text-xs text-muted mt-1.5">用于唯一标识作者身份，如 GitHub username</p>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider">简介</label>
              <CharCounter current={description.length} max={LIMITS.description} />
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, LIMITS.description + 20))}
              placeholder="一句话描述你的资产..."
              rows={2}
              className={`w-full px-4 py-3 rounded-lg bg-white border text-foreground placeholder:text-muted/50 focus:outline-none transition-colors resize-none ${description.length > LIMITS.description ? 'border-red/50 focus:border-red/70' : 'border-card-border focus:border-blue/50'}`}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-2">分类</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white border border-card-border text-foreground focus:outline-none focus:border-blue/50 transition-colors cursor-pointer"
            >
              <option value="">选择分类...</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-muted uppercase tracking-wider">标签</label>
              <CharCounter current={tags.length} max={LIMITS.tags} />
            </div>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value.slice(0, LIMITS.tags))}
              placeholder="用逗号分隔，例如: search, web, api"
              className="w-full px-4 py-3 rounded-lg bg-white border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
            />
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {parsedTags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-surface text-muted border border-card-border">#{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-2">上传文件</label>
            <div className="border-2 border-dashed border-card-border rounded-lg p-8 text-center hover:border-blue/30 transition-colors cursor-pointer group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">📁</div>
              <p className="text-sm text-muted mb-1">拖拽文件到此处，或点击选择</p>
              <p className="text-xs text-muted/50">支持 .zip, .tar.gz, .tgz（最大 50MB）</p>
              <input type="file" className="hidden" accept=".zip,.tar.gz,.tgz" />
            </div>
          </div>

          {/* README */}
          <div>
            <label className="block text-sm font-semibold text-muted uppercase tracking-wider mb-2">README (Markdown)</label>
            <p className="text-xs text-muted mb-2">支持完整 Markdown 语法，包括表格、图片、代码块</p>
            <textarea
              value={readme}
              onChange={(e) => setReadme(e.target.value)}
              placeholder={`# ${displayName || '中文名称'}\n${name ? `**${name}**` : '**package-name**'} — ${displayName || '中文名称'}\n\n## 概述\n描述你的资产做什么...\n\n## 安装\n\`\`\`bash\nseafood-market install ${assetType}/@${authorId || 'username'}/${name || 'package-name'}\n\`\`\`\n\n## 使用方法\n...\n\n## 功能特性\n| 功能 | 说明 |\n|------|------|\n| ... | ... |\n\n## 截图\n![示例](https://example.com/screenshot.png)`}
              rows={14}
              className="w-full px-4 py-3 rounded-lg bg-white border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors resize-y font-mono text-sm"
            />
          </div>

          {/* Submit */}
          <div className="space-y-3 pt-4">
            {error && (
              <div className="p-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm">
                ❌ {error}
              </div>
            )}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="flex-1 sm:flex-none px-8 py-3 rounded-md bg-blue text-white font-bold hover:bg-blue-dim transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? '⏳ 发布中...' : submitted ? '✓ 发布成功！' : '🚀 发布资产'}
              </button>
              <button
                type="button"
                className="px-6 py-3 rounded-md border border-card-border text-muted hover:text-foreground hover:border-blue/30 transition-colors text-sm"
              >
                存为草稿
              </button>
            </div>
          </div>
        </form>

        {/* Live Preview Panel */}
        <aside className="lg:w-80 shrink-0">
          <div className="sticky top-24">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">实时预览</h3>
            <div className="rounded-lg border border-card-border bg-white p-5 overflow-hidden">
              {/* Preview mimics AssetCard */}
              <div className="flex items-start justify-between mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${typeConfig[assetType].bgColor} ${typeConfig[assetType].borderColor} ${typeConfig[assetType].color}`}>
                  {typeConfig[assetType].icon} {typeConfig[assetType].label}
                </span>
                <span className="text-xs text-muted font-mono">v1.0.0</span>
              </div>
              <h3 className="text-lg font-semibold mb-1 text-blue">
                {displayName || '📦 中文名称'}
              </h3>
              {name && (
                <div className="text-xs font-mono text-muted/60 mb-2">@{authorId || 'username'}/{name}</div>
              )}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-sm">🤖</span>
                <span className="text-xs text-muted">CyberNova</span>
              </div>
              <p className="text-sm text-muted mb-4 line-clamp-2 leading-relaxed">
                {description || '在这里输入你的资产简介...'}
              </p>
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {parsedTags.slice(0, 3).map(tag => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded bg-surface text-muted border border-card-border">
                      {tag}
                    </span>
                  ))}
                  {parsedTags.length > 3 && (
                    <span className="text-xs px-2 py-0.5 text-muted">+{parsedTags.length - 3}</span>
                  )}
                </div>
              )}

              {/* Install command preview */}
              {name && (
                <div className="mt-4 pt-3 border-t border-card-border">
                  <div className="text-[10px] text-muted mb-1">安装命令</div>
                  <code className="text-xs font-mono text-blue bg-surface px-2 py-1 rounded block truncate">
                    seafood-market install {assetType}/@{authorId || 'username'}/{name}
                  </code>
                </div>
              )}
            </div>

            {/* Validation summary */}
            <div className="mt-4 p-4 rounded-lg border border-card-border bg-white">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">发布检查</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={name.trim() ? 'text-green-500' : 'text-muted'}>
                    {name.trim() ? '✓' : '○'}
                  </span>
                  <span className={name.trim() ? 'text-foreground' : 'text-muted'}>包名</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={authorId.trim() ? 'text-green-500' : 'text-muted'}>
                    {authorId.trim() ? '✓' : '○'}
                  </span>
                  <span className={authorId.trim() ? 'text-foreground' : 'text-muted'}>Author ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={displayName.trim() ? 'text-green-500' : 'text-muted'}>
                    {displayName.trim() ? '✓' : '○'}
                  </span>
                  <span className={displayName.trim() ? 'text-foreground' : 'text-muted'}>中文名称</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={description.trim() && description.length <= LIMITS.description ? 'text-green-500' : description.length > LIMITS.description ? 'text-red' : 'text-muted'}>
                    {description.trim() && description.length <= LIMITS.description ? '✓' : description.length > LIMITS.description ? '✕' : '○'}
                  </span>
                  <span className={description.trim() ? 'text-foreground' : 'text-muted'}>简介</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={category ? 'text-green-500' : 'text-muted'}>
                    {category ? '✓' : '○'}
                  </span>
                  <span className={category ? 'text-foreground' : 'text-muted'}>分类</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={parsedTags.length > 0 ? 'text-green-500' : 'text-muted'}>
                    {parsedTags.length > 0 ? '✓' : '○'}
                  </span>
                  <span className={parsedTags.length > 0 ? 'text-foreground' : 'text-muted'}>标签</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={readme.trim() ? 'text-green-500' : 'text-muted'}>
                    {readme.trim() ? '✓' : '○'}
                  </span>
                  <span className={readme.trim() ? 'text-foreground' : 'text-muted'}>README</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      )}

      {/* Submitted Success */}
      {submitted && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-paper/80 backdrop-blur-sm">
          <div className="p-8 rounded-lg bg-white border border-blue/30 text-center max-w-md mx-4">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">发布成功！</h2>
            <p className="text-muted">正在跳转到资产详情页...</p>
          </div>
        </div>
      )}
    </div>
  );
}
