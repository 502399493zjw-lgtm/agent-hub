'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { typeConfig, AssetType, Asset } from '@/data/mock';
import { AssetCard } from '@/components/asset-card';

const typeGlowColors: Record<AssetType, string> = {
  skill: '#60a5fa',
  config: '#f87171',
  plugin: '#60a5fa',
  trigger: '#f87171',
  channel: '#60a5fa',
  template: '#f87171',
};

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [trending, setTrending] = useState<Asset[]>([]);
  const [newest, setNewest] = useState<Asset[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/assets?sort=downloads&pageSize=6').then(r => r.json()),
      fetch('/api/assets?sort=created_at&pageSize=6').then(r => r.json()),
      fetch('/api/assets?pageSize=100').then(r => r.json()),
    ]).then(([hotJson, newJson, allJson]) => {
      if (hotJson.success) setTrending(hotJson.data.assets);
      if (newJson.success) setNewest(newJson.data.assets);
      if (allJson.success) setAllAssets(allJson.data.assets);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const typeEntries: { type: AssetType; title: string; desc: string; count: number }[] = [
    { type: 'template', title: '📋 合集', desc: '开箱即用的 Agent 整体方案，一键获得完整能力组合', count: allAssets.filter(a => a.type === 'template').length },
    { type: 'skill', title: '📦 技能', desc: '让 Agent 获得新技能，按需安装即刻生效', count: allAssets.filter(a => a.type === 'skill').length },
    { type: 'config', title: '⚙️ 配置', desc: '定义 Agent 的性格、行为与工作流偏好', count: allAssets.filter(a => a.type === 'config').length },
    { type: 'plugin', title: '🔌 插件', desc: '扩展 Agent 底层能力，接入新的工具与服务', count: allAssets.filter(a => a.type === 'plugin').length },
    { type: 'trigger', title: '🎯 触发器', desc: '监听外部事件，自动唤醒 Agent 执行任务', count: allAssets.filter(a => a.type === 'trigger').length },
    { type: 'channel', title: '📡 频道', desc: '连接 Agent 与外部世界的通信桥梁', count: allAssets.filter(a => a.type === 'channel').length },
  ];

  // "Trending this week" — mix downloads + recency
  const trendingWeek = [...allAssets]
    .sort((a, b) => {
      const aScore = a.downloads * 0.7 + (new Date(a.updatedAt).getTime() / 1e10) * 0.3;
      const bScore = b.downloads * 0.7 + (new Date(b.updatedAt).getTime() / 1e10) * 0.3;
      return bScore - aScore;
    })
    .slice(0, 6);

  const stats = [
    { label: '总资产数', value: allAssets.length, icon: '📦' },
    { label: '总下载量', value: Math.round(allAssets.reduce((s, a) => s + a.downloads, 0) / 1000) + 'k+', icon: '⬇️' },
    { label: '开发者', value: '4', icon: '👥' },
    { label: '平均评分', value: allAssets.length > 0 ? (allAssets.reduce((s, a) => s + a.rating, 0) / allAssets.length).toFixed(1) : '0', icon: '⭐' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue/20 bg-blue/5 text-blue text-sm mb-8">
              <span className="w-2 h-2 rounded-full bg-blue pulse-dot" />
              Web 4.0 · Agent 进化生态
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 font-serif">
              <span className="gradient-text">水产市场</span>
            </h1>

            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10">
              给人和 Agent 提供的 Web4.0，让你的 Agent 加入无限的进化吧
            </p>

            <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-8">
              <div className="relative">
                <div className="relative flex items-center">
                  <svg className="absolute left-4 w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索技能、配置、插件..."
                    className="w-full pl-12 pr-28 py-4 rounded-lg border border-card-border bg-white text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 px-5 py-2 rounded-lg bg-blue text-white font-semibold text-sm hover:bg-blue-dim transition-colors"
                  >
                    搜索
                  </button>
                </div>
              </div>
            </form>

            <div className="flex flex-wrap justify-center gap-6 md:gap-10">
              {stats.map(stat => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold font-mono text-blue">{stat.value}</div>
                  <div className="text-xs text-muted mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Type Cards - 6 types */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {typeEntries.map(entry => {
            const config = typeConfig[entry.type];
            return (
              <Link key={entry.type} href={`/explore?type=${entry.type}`}>
                <div className={`relative group rounded-lg border border-card-border bg-white p-8 card-hover overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}>
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20 pointer-events-none"
                    style={{ background: typeGlowColors[entry.type] }}
                  />
                  <div className="relative">
                    <h3 className="text-2xl font-bold mb-2">{entry.title}</h3>
                    <p className="text-sm text-muted mb-4">{entry.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-mono ${config.color}`}>{entry.count} 个可用</span>
                      <span className="text-muted group-hover:text-blue group-hover:translate-x-1 transition-all">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trending This Week */}
      {loaded && trendingWeek.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                📈 <span className="text-blue">Trending</span> 本周
              </h2>
              <p className="text-sm text-muted mt-1">本周最受欢迎的资产</p>
            </div>
            <Link href="/explore?sort=trending" className="text-sm text-blue hover:text-blue-dim transition-colors">
              查看全部 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingWeek.map((asset, i) => (
              <div key={asset.id} className="relative">
                <div className="absolute -top-2 -left-2 z-10 w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center text-sm font-bold shadow-md">
                  {i + 1}
                </div>
                <AssetCard asset={asset} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hot */}
      {loaded && trending.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                🔥 <span className="text-red">热门</span>资产
              </h2>
              <p className="text-sm text-muted mt-1">社区最受欢迎的资产</p>
            </div>
            <Link href="/explore?sort=downloads" className="text-sm text-blue hover:text-blue-dim transition-colors">
              查看全部 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trending.map(asset => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </section>
      )}

      {/* Newest */}
      {loaded && newest.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                ✨ <span className="text-blue">最新</span>更新
              </h2>
              <p className="text-sm text-muted mt-1">最近更新的资产</p>
            </div>
            <Link href="/explore?sort=updated" className="text-sm text-blue hover:text-blue-dim transition-colors">
              查看全部 →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {newest.map(asset => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative rounded-lg border border-card-border bg-white p-12 text-center overflow-hidden">
          <div className="relative">
            <h2 className="text-3xl font-bold mb-4">
              准备好<span className="text-blue">分享</span>你的创作了吗？
            </h2>
            <p className="text-muted mb-8 max-w-lg mx-auto">
              发布你的技能、配置或插件，让全世界的 Agent 受益
            </p>
            <Link
              href="/publish"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-md bg-blue text-white font-semibold hover:bg-blue-dim transition-colors"
            >
              开始发布 →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
