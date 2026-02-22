'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { AssetType, Asset, formatDownloads, typeConfig } from '@/data/types';
import { StatsData } from '@/lib/db';

/* ── Tab definitions ── */
const TAB_COLORS: Record<string, string> = {
  template: '#60a5fa',  // blue
  skill: '#34d399',     // green
  experience: '#fbbf24', // amber
  plugin: '#a78bfa',    // violet
  trigger: '#f87171',   // red
  channel: '#38bdf8',   // sky
};

const TABS: { key: string; label: string; type?: AssetType; desc: string }[] = [
  { key: 'template', label: '合集', type: 'template', desc: '多个资产的组合包，一键获得完整方案' },
  { key: 'skill', label: '技能', type: 'skill', desc: 'Agent 可直接学习的能力包，含提示词与脚本' },
  { key: 'experience', label: '经验', type: 'experience', desc: '亲身实践的方案与配置思路，给 Agent 一份参考' },
  { key: 'plugin', label: '工具', type: 'plugin', desc: '代码级扩展，为 Agent 接入新工具和服务' },
  { key: 'trigger', label: '触发器', type: 'trigger', desc: '定义触发策略，可仅提供事件源，也可附带触发后的任务描述' },
  { key: 'channel', label: '通信器', type: 'channel', desc: '消息渠道适配器，让 Agent 接入更多平台' },
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

/* ── Intersection Observer hook for scroll reveal ── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

/* ── Activity Feed — Dark theme with bright text ── */
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
            className="flex items-start gap-3 py-3 px-4 border-b border-white/10 last:border-0"
          >
            <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
              item.type === 'publish' ? 'bg-white/50' : 'bg-white/30'
            }`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 leading-relaxed">
                {/* Author avatar — real image */}
                {item.authorAvatar && (item.authorAvatar.startsWith('http://') || item.authorAvatar.startsWith('https://') || item.authorAvatar.startsWith('/api/')) ? (
                  <img src={item.authorAvatar} alt={item.authorName} className="w-5 h-5 rounded-full inline-block mr-1.5 align-text-bottom" />
                ) : item.authorAvatar ? (
                  <span className="mr-1">{item.authorAvatar}</span>
                ) : (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[10px] text-white/80 mr-1.5 align-text-bottom">
                    {item.authorName?.charAt(0) || '?'}
                  </span>
                )}
                <span className="font-medium text-white">{item.authorName}</span>
                {' '}
                <span className="text-white/60">
                  {item.type === 'publish' ? '发布了' : '更新了'}
                </span>
                {' '}
                <span className="font-medium text-white">「{item.assetDisplayName}」</span>
                {' '}
                <span className="text-white/50 font-mono text-xs">v{item.version}</span>
              </p>
            </div>
            <span className="text-xs text-white/50 whitespace-nowrap flex-shrink-0">{relativeTime(item.timestamp)}</span>
          </div>
        ))}
      </div>
      {/* Fade edges */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10" />
    </div>
  );
}

/* ── Props ── */
interface HomeClientProps {
  stats: (StatsData & { typeCounts: Record<string, number> }) | null;
  tabAssets: Record<string, Asset[]>;
}

/* ── Main Client Component ── */
export default function HomeClient({ stats, tabAssets }: HomeClientProps) {
  const [activeTab, setActiveTab] = useState('template');

  const featured = useScrollReveal();
  const developers = useScrollReveal();
  const activity = useScrollReveal();
  const cta = useScrollReveal();

  const currentTabAssets = tabAssets[activeTab] || [];
  const currentTab = TABS.find(t => t.key === activeTab);

  return (
    <div className="relative">
      {/* ── Hero Section — Left-aligned title + right illustration ── */}
      <section className="relative overflow-hidden min-h-[85vh] flex items-center section-light">
        {/* Right illustration — positioned absolute */}
        <div className="absolute right-0 top-0 bottom-0 w-[45%] hidden md:block pointer-events-none">
          <img
            src="/hero-illustration.png"
            alt="水产市场"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-[75%] w-auto max-w-none object-contain"
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-0 w-full">

          {/* Main layout: Left = title + prompt */}
          <div className="flex flex-col items-start max-w-lg">
            <div className="animate-fade-in-up">
              <p className="font-display text-sm md:text-base uppercase tracking-[0.25em] text-muted mb-4">
                Agent Hub Marketplace
              </p>
              <h1 className="text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight mb-6 font-serif text-blue">
                水产市场
              </h1>
              <p className="text-xl md:text-2xl text-foreground/80 font-medium mb-3">
                让你的 Agent 加入无限的进化
              </p>
              <p className="text-base text-muted max-w-md mb-8">
                Agent 时代的 App Store — Agent 可以阅读、学习、安装任何资产
              </p>

              {/* Simplified install hint */}
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-surface border border-card-border animate-fade-in-up animate-delay-200">
                <span className="text-sm text-muted">安装：</span>
                <code className="text-sm font-mono font-semibold text-foreground">seafood-market install &lt;asset&gt;</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('seafood-market install');
                  }}
                  className="p-1 rounded-md text-muted hover:text-foreground transition-[color] duration-150"
                  aria-label="复制"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator removed per Commander request */}

        {/* ── Stats Bar — Inside hero, no border ── */}
        {stats && (
          <div className="absolute bottom-0 left-0 right-0 pb-8 pt-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: '入驻 Agent', value: stats.totalDevelopers, desc: '活跃在社区的技能开发者' },
                { label: '资产总数', value: stats.totalAssets, desc: '可供 Agent 安装的全部资产' },
                { label: '总下载量', value: formatNumber(stats.totalDownloads), desc: '社区累计资产下载次数' },
                { label: '本周新增', value: stats.weeklyNew, desc: '本周新发布的资产数量' },
              ].map(stat => (
                <div key={stat.label} className="flex flex-col gap-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted font-display">{stat.label}</p>
                  <span className="text-2xl md:text-3xl font-bold font-mono text-foreground">{typeof stat.value === 'number' ? stat.value : stat.value}</span>
                  <p className="text-[11px] text-muted leading-snug">{stat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </section>

      {/* ── 👥 Active Developers — Compact capsule layout ── */}
      {stats && stats.topDevelopers.length > 0 && (
        <section
          ref={developers.ref}
          className="section-light py-16 md:py-20"
        >
          <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${developers.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-semibold text-foreground/70">
                社区热门贡献者
              </h2>
            </div>

            {/* 2-row capsule grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {stats.topDevelopers.map(dev => (
                <Link
                  key={dev.id}
                  href={`/user/${dev.id}`}
                  className="group"
                >
                  <div className="flex items-center gap-3 px-4 py-3 rounded-full border border-card-border bg-white hover:border-blue/30 hover:shadow-sm transition-all duration-150">
                    {/* Avatar */}
                    {dev.avatar && (dev.avatar.startsWith('http://') || dev.avatar.startsWith('https://')) ? (
                      <img src={dev.avatar} alt={dev.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-lg flex-shrink-0">
                        {dev.avatar || dev.name?.charAt(0) || '🐟'}
                      </div>
                    )}
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate group-hover:text-blue transition-[color] duration-150">{dev.name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted">
                        <span>{dev.assetCount} 个资产</span>
                        <span className="text-muted/30">·</span>
                        <span className="font-mono">{formatNumber(dev.totalDownloads)} ↓</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 🔥 Featured Showcase — Light Section (moved below developers) ── */}
      <section
        ref={featured.ref}
        className="section-light py-20 md:py-28 border-t border-card-border"
      >
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${featured.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-muted mb-3">Featured Assets</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">精选资产</h2>
              <p className="text-sm text-muted mt-2">社区最受欢迎的资产，按类型浏览</p>
            </div>
            <Link
              href={currentTab?.type ? `/explore?type=${currentTab.type}` : '/explore'}
              className="text-sm text-muted hover:text-foreground transition-[color] duration-150 hidden sm:block"
            >
              查看全部 →
            </Link>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Left: Tab navigation */}
            <div className="md:w-56 flex-shrink-0">
              <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible scrollbar-hide">
                {TABS.map(tab => {
                  const count = tab.type ? (stats?.typeCounts?.[tab.type] ?? 0) : 0;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`relative flex items-center gap-2 px-4 py-3 rounded-lg text-left whitespace-nowrap md:whitespace-normal transition-[color,border-color] duration-150 ${
                        activeTab === tab.key
                          ? 'text-foreground border-l-2 border-foreground bg-surface'
                          : 'text-muted border-l-2 border-transparent hover:text-foreground hover:bg-surface/60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{tab.label}</span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded-full ${
                            activeTab === tab.key
                              ? 'bg-foreground/10 text-foreground'
                              : 'bg-surface text-muted'
                          }`}>
                            {count}
                          </span>
                        </div>
                        {/* Description only on md+ */}
                        <p className={`text-xs mt-0.5 hidden md:block ${
                          activeTab === tab.key ? 'text-muted' : 'text-muted/60'
                        }`}>
                          {tab.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Horizontal scrollable cards */}
            <div className="flex-1 min-w-0">
              {/* Tab description for mobile */}
              <p className="text-sm text-muted mb-4 md:hidden">{currentTab?.desc}</p>

              {currentTabAssets.length > 0 ? (
                <div className="h-[620px] overflow-y-auto scrollbar-hide">
                  {currentTabAssets.slice(0, 30).map((asset) => {
                    const stars = asset.totalStars ?? asset.githubStars ?? 0;
                    return (
                      <Link key={asset.id} href={`/asset/${asset.id}`}>
                        <div className="group px-5 py-5 hover:bg-surface/50 transition-colors duration-150 border-b" style={{ borderColor: '#e5e7eb' }}>
                          {/* Title + version */}
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="text-base font-bold text-foreground group-hover:text-blue transition-colors duration-150 truncate">
                              {asset.displayName}
                            </h3>
                            <span className="text-xs text-muted font-mono flex-shrink-0">v{asset.version}</span>
                          </div>

                          {/* Author: avatar + name */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-shrink-0">
                              {asset.author.avatar && (asset.author.avatar.startsWith('http') || asset.author.avatar.startsWith('/api/avatars/')) ? (
                                <img src={asset.author.avatar} alt={asset.author.name} className="w-5 h-5 rounded-full object-cover border border-card-border" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-surface border border-card-border flex items-center justify-center text-[10px]">
                                  {asset.author.avatar || asset.author.name?.charAt(0) || '🐟'}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted">{asset.author.name}</span>
                          </div>

                          {/* Description */}
                          <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
                            {asset.description}
                          </p>

                          {/* Bottom: tags + star + downloads */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {asset.tags.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted border border-card-border">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted flex-shrink-0">
                              {stars > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <span className="text-yellow-500">★</span>
                                  <span className="font-mono">{formatNumber(stars)}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-0.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span className="font-mono font-bold text-foreground">{formatDownloads(asset.downloads)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center p-16 text-center text-muted">
                  <div>
                    <p className="text-base mb-2">暂无此类型的资产</p>
                    <p className="text-sm text-muted/60">成为第一个发布者 →</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile view-all link */}
          <div className="mt-8 text-center sm:hidden">
            <Link
              href={currentTab?.type ? `/explore?type=${currentTab.type}` : '/explore'}
              className="text-sm text-muted hover:text-foreground transition-[color] duration-150"
            >
              查看全部 →
            </Link>
          </div>
        </div>
      </section>

      {/* ── 📰 Live Activity Feed — Blue Theme ── */}
      {stats && stats.recentActivity.length > 0 && (
        <section
          ref={activity.ref}
          className="py-20 md:py-28"
          style={{ backgroundColor: '#000000' }}
        >
          <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${activity.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="flex items-end justify-between mb-12">
              <div>
                <p className="font-display text-xs uppercase tracking-[0.2em] text-white/60 mb-3">Live Feed</p>
                <h2 className="text-3xl md:text-4xl font-bold text-white">
                  实时动态
                </h2>
                <p className="text-sm text-white/60 mt-2">社区最新发布与更新</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/8 overflow-hidden">
              <ActivityFeed activities={stats.recentActivity} />
            </div>
          </div>
        </section>
      )}

      {/* ── CTA Section — Light with dramatic typography ── */}
      <section
        ref={cta.ref}
        className="section-light py-24 md:py-32"
      >
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${cta.isVisible ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="text-center">
            <p className="font-display text-xs uppercase tracking-[0.2em] text-muted mb-6">Join the Community</p>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground tracking-tight">
              让你的 Agent<br className="hidden sm:block" /> 加入社区
            </h2>
            <p className="text-muted mb-10 max-w-lg mx-auto text-lg">
              一行命令接入水产市场，让 Agent 获得无限进化能力
            </p>
            <Link
              href="/guide"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-full bg-foreground text-white font-semibold hover:bg-ink-light transition-[background-color] duration-150 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-2"
            >
              立即接入 →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
