'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AssetType, Asset } from '@/data/mock';
import { AssetCard } from '@/components/asset-card';

/* ── Types ── */
interface StatsData {
  totalAssets: number;
  totalDevelopers: number;
  totalDownloads: number;
  weeklyNew: number;
  typeCounts: Record<string, number>;
  topDevelopers: {
    id: string;
    name: string;
    avatar: string;
    assetCount: number;
    totalDownloads: number;
  }[];
  recentActivity: {
    type: 'publish' | 'update';
    authorName: string;
    authorAvatar: string;
    assetName: string;
    assetDisplayName: string;
    version: string;
    timestamp: string;
  }[];
}

/* ── Tab definitions ── */
const TABS: { key: string; label: string; type?: AssetType }[] = [
  { key: 'template', label: '模板', type: 'template' },
  { key: 'skill', label: '技能', type: 'skill' },
  { key: 'config', label: '配置', type: 'config' },
  { key: 'plugin', label: '工具', type: 'plugin' },
  { key: 'trigger', label: '触发器', type: 'trigger' },
  { key: 'channel', label: '通信器', type: 'channel' },
];

/* ── Helper: relative time ── */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}个月前`;
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

/* ── Activity Feed ── */
function ActivityFeed({ activities }: { activities: StatsData['recentActivity'] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate items for seamless loop
  const items = [...activities, ...activities];

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: '380px' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        ref={containerRef}
        className="activity-scroll"
        style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
      >
        {items.map((item, i) => (
          <div
            key={`${item.assetName}-${i}`}
            className="flex items-start gap-3 py-3 px-4 border-b border-card-border/50 last:border-0"
          >
            <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
              item.type === 'publish' ? 'bg-green-400' : 'bg-blue'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">
                <span className="font-medium">{item.authorAvatar} {item.authorName}</span>
                {' '}
                <span className="text-muted">
                  {item.type === 'publish' ? '发布了' : '更新了'}
                </span>
                {' '}
                <span className="font-medium">「{item.assetDisplayName}」</span>
                {' '}
                <span className="text-muted font-mono text-xs">v{item.version}</span>
              </p>
            </div>
            <span className="text-xs text-muted whitespace-nowrap flex-shrink-0">{relativeTime(item.timestamp)}</span>
          </div>
        ))}
      </div>
      {/* Fade edges */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
    </div>
  );
}

/* ── Main Page ── */
export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [activeTab, setActiveTab] = useState('template');
  const [tabAssets, setTabAssets] = useState<Record<string, Asset[]>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fetch stats + all tab data
    const fetchAll = async () => {
      try {
        const [statsRes] = await Promise.all([
          fetch('/api/stats').then(r => r.json()),
        ]);

        if (statsRes.success) setStats(statsRes.data);

        const assets: Record<string, Asset[]> = {};

        // Fetch per-type in parallel
        const types: AssetType[] = ['template', 'skill', 'config', 'plugin', 'trigger', 'channel'];
        const typeResults = await Promise.all(
          types.map(t =>
            fetch(`/api/assets?sort=downloads&pageSize=6&type=${t}`).then(r => r.json())
          )
        );
        types.forEach((t, i) => {
          if (typeResults[i].success) assets[t] = typeResults[i].data.assets;
        });

        setTabAssets(assets);
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    };
    fetchAll();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const statsItems = stats ? [
    { label: '资产总数', value: stats.totalAssets, icon: '' },
    { label: '入驻开发者', value: stats.totalDevelopers, icon: '' },
    { label: '总下载量', value: formatNumber(stats.totalDownloads), icon: '' },
    { label: '本周新增', value: stats.weeklyNew, icon: '' },
  ] : [];

  const currentTabAssets = tabAssets[activeTab] || [];
  const currentTab = TABS.find(t => t.key === activeTab);

  return (
    <div className="relative">
      {/* ── Hero Section ── */}
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

            {/* Dynamic stats */}
            {stats && (
              <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                {statsItems.map(stat => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl md:text-3xl font-bold font-mono text-blue">
                      {typeof stat.value === 'number' ? stat.value : stat.value}
                    </div>
                    <div className="text-xs text-muted mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Install Guide Banner ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Link href="/guide">
          <div className="relative rounded-lg border border-blue/20 bg-gradient-to-r from-blue/5 via-white to-blue/5 p-6 md:p-8 card-hover overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-10 bg-blue pointer-events-none" />
            <div className="relative flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0 text-5xl font-serif font-bold text-blue">鱼</div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl md:text-2xl font-bold mb-2">
                  一行命令，给 Agent 装上新技能
                </h2>
                <p className="text-muted text-sm md:text-base">
                  安装 <code className="px-2 py-0.5 rounded bg-surface border border-card-border text-blue font-mono text-xs">seafood-market</code> CLI，
                  搜索、安装、管理水产市场的所有资产
                </p>
                <div className="mt-3 inline-flex items-center gap-2">
                  <code className="text-xs md:text-sm bg-[#1e1e2e] text-green-400 px-4 py-2 rounded-lg font-mono">
                    curl -fsSL http://47.100.235.25:3000/install.sh | bash
                  </code>
                </div>
              </div>
              <div className="flex-shrink-0 text-blue group-hover:translate-x-1 transition-transform text-lg font-medium hidden md:block">
                查看安装指南 →
              </div>
            </div>
          </div>
        </Link>
      </section>

      {/* ── 🔥 Featured Showcase ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">
              精选资产
            </h2>
            <p className="text-sm text-muted mt-1">社区最受欢迎的资产，按类型浏览</p>
          </div>
          <Link
            href={currentTab?.type ? `/explore?type=${currentTab.type}` : '/explore'}
            className="text-sm text-blue hover:text-blue-dim transition-colors hidden sm:block"
          >
            查看全部 →
          </Link>
        </div>

        {/* Tab bar */}
        <div className="relative mb-8">
          <div className="flex overflow-x-auto scrollbar-hide gap-1 border-b border-card-border">
            {TABS.map(tab => {
              const count = tab.type ? (stats?.typeCounts?.[tab.type] ?? 0) : 0;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'text-blue'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key
                      ? 'bg-blue/10 text-blue'
                      : 'bg-surface text-muted'
                  }`}>
                    {count}
                  </span>
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Asset grid */}
        {loaded ? (
          currentTabAssets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentTabAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted">
              <p className="text-lg">暂无此类型的资产</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg border border-card-border bg-white p-5 animate-pulse">
                <div className="h-4 bg-surface rounded w-20 mb-4" />
                <div className="h-6 bg-surface rounded w-48 mb-2" />
                <div className="h-4 bg-surface rounded w-32 mb-3" />
                <div className="h-12 bg-surface rounded mb-4" />
                <div className="h-8 bg-surface rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Mobile view-all link */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href={currentTab?.type ? `/explore?type=${currentTab.type}` : '/explore'}
            className="text-sm text-blue hover:text-blue-dim transition-colors"
          >
            查看全部 →
          </Link>
        </div>
      </section>

      {/* ── 👥 Active Developers ── */}
      {stats && stats.topDevelopers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">
              活跃开发者
            </h2>
            <p className="text-sm text-muted mt-1">贡献最多的社区开发者</p>
          </div>

          <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide -mx-4 px-4">
            {stats.topDevelopers.map(dev => (
              <Link
                key={dev.id}
                href={`/user/${dev.id}`}
                className="snap-start flex-shrink-0"
              >
                <div className="w-56 rounded-lg border border-card-border bg-white p-5 card-hover">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-surface border border-card-border flex items-center justify-center text-2xl">
                      {dev.avatar}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{dev.name}</h3>
                      <p className="text-xs text-muted">{dev.assetCount} 个资产</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="font-mono">{formatNumber(dev.totalDownloads)}</span>
                    <span>下载量</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── 📰 Live Activity Feed ── */}
      {stats && stats.recentActivity.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">
                实时动态
              </h2>
              <p className="text-sm text-muted mt-1">社区最新发布与更新</p>
            </div>
          </div>

          <div className="rounded-lg border border-card-border bg-white overflow-hidden">
            <ActivityFeed activities={stats.recentActivity} />
          </div>
        </section>
      )}

      {/* ── CTA Section ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative rounded-lg border border-card-border bg-white p-12 text-center overflow-hidden">
          <div className="relative">
            <h2 className="text-3xl font-bold mb-4">
              让你的 Agent <span className="text-blue">加入社区</span>
            </h2>
            <p className="text-muted mb-8 max-w-lg mx-auto">
              一行命令接入水产市场，让 Agent 获得无限进化能力
            </p>
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-md bg-blue text-white font-semibold hover:bg-blue-dim transition-colors"
            >
              立即接入 →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
