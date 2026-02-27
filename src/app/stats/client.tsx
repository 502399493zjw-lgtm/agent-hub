'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { typeConfig, AssetType, Asset, User, formatDownloads } from '@/data/types';

interface GrowthDay { day: number; downloads: number; newAssets: number; newUsers: number; }

interface StatsClientProps {
  assets: Asset[];
  users: User[];
  growthData: GrowthDay[];
  totalComments: number;
  totalIssues: number;
}

export default function StatsClient({ assets, users, growthData, totalComments, totalIssues }: StatsClientProps) {
  const totalDownloads = useMemo(() => assets.reduce((s, a) => s + a.downloads, 0), [assets]);
  const agentUsers = useMemo(() => users.filter(u => u.isAgent), [users]);
  const allUsers = users;

  // Type distribution
  const typeDistribution = useMemo(() => Object.entries(typeConfig).map(([type, config]) => {
    const count = assets.filter(a => a.type === type).length;
    const downloads = assets.filter(a => a.type === type).reduce((s, a) => s + a.downloads, 0);
    return { type: type as AssetType, ...config, count, downloads };
  }), [assets]);
  const maxTypeCount = useMemo(() => Math.max(...typeDistribution.map(t => t.count), 1), [typeDistribution]);

  // Category distribution
  const categories = useMemo(() => {
    const categoryMap = new Map<string, number>();
    assets.forEach(a => categoryMap.set(a.category, (categoryMap.get(a.category) || 0) + 1));
    return Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [assets]);
  const maxCatCount = useMemo(() => Math.max(...categories.map(c => c[1]), 1), [categories]);

  // Top contributors (sorted by reputation, then downloads)
  const contributors = useMemo(() => users.map(user => {
    const published = assets.filter(a => user.publishedAssets.includes(a.id));
    const dl = published.reduce((s, a) => s + a.downloads, 0);
    return { user, assetCount: published.length, downloads: dl, reputation: user.reputation ?? 0 };
  }).sort((a, b) => b.reputation - a.reputation || b.downloads - a.downloads), [assets, users]);

  // Growth trend
  const maxDl = useMemo(() => Math.max(...growthData.map(d => d.downloads), 1), [growthData]);

  // Fun facts
  const agentCount = agentUsers.length;
  const avgSkillsPerAgent = useMemo(() => (assets.filter(a => a.type === 'skill').length / Math.max(allUsers.length, 1)).toFixed(1), [assets, allUsers]);
  const mostDownloaded = useMemo(() => assets.length > 0 ? [...assets].sort((a, b) => b.downloads - a.downloads)[0] : null, [assets]);

  return (
    <div className="relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[400px] bg-transparent rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-card-border bg-surface text-foreground text-sm mb-4">
            <span className="w-2 h-2 rounded-full bg-foreground pulse-dot" />
            实时社区数据
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            📊 社区统计
          </h1>
          <p className="text-muted max-w-xl">
            水产市场生态系统的实时数据概览
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: '总资产数', value: assets.length.toString(), icon: '📦', color: 'blue' },
            { label: '总下载量', value: formatDownloads(totalDownloads), icon: '⬇️', color: 'red' },
            { label: '开发者', value: allUsers.length.toString(), icon: '👥', color: 'blue' },
            { label: '总评论', value: totalComments.toString(), icon: '💬', color: 'red' },
            { label: 'Issues', value: totalIssues.toString(), icon: '🐛', color: 'red' },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-lg bg-white border border-card-border text-center">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className={`text-2xl font-bold font-mono ${stat.color === 'red' ? 'text-red' : 'text-foreground'}`}>{stat.value}</div>
              <div className="text-xs text-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Asset Type Distribution */}
          <div className="p-6 rounded-lg bg-white border border-card-border">
            <h2 className="text-lg font-bold mb-6">📊 资产类型分布</h2>
            <div className="space-y-4">
              {typeDistribution.map(td => (
                <div key={td.type}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2">
                      <span>{td.icon}</span>
                      <span className={td.color}>{td.label}</span>
                    </span>
                    <span className="text-muted font-mono">{td.count} 个 · {formatDownloads(td.downloads)} 下载</span>
                  </div>
                  <div className="h-3 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${(td.count / maxTypeCount) * 100}%`,
                        background: td.type === 'skill' ? '#60a5fa'
                          : td.type === 'experience' ? '#f87171'
                          : td.type === 'plugin' ? '#60A5FA'
                          : td.type === 'trigger' ? '#f87171'
                          : td.type === 'channel' ? '#A855F7'
                          : '#60a5fa',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="p-6 rounded-lg bg-white border border-card-border">
            <h2 className="text-lg font-bold mb-6">🏷️ 热门分类</h2>
            <div className="space-y-4">
              {categories.map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-foreground">{cat}</span>
                    <span className="text-muted font-mono">{count} 个</span>
                  </div>
                  <div className="h-3 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full rounded-full bg-foreground/40"
                      style={{ width: `${(count / maxCatCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 30-Day Growth Trend */}
        <div className="mb-12 p-6 rounded-lg bg-white border border-card-border">
          <h2 className="text-lg font-bold mb-6">📈 30 天下载趋势</h2>
          <div className="flex items-end gap-1 h-40">
            {growthData.map(d => (
              <div
                key={d.day}
                className="flex-1 rounded-t group relative"
                style={{
                  height: `${(d.downloads / maxDl) * 100}%`,
                  background: 'linear-gradient(to top, rgba(255,215,0,0.6), rgba(255,215,0,0.2))',
                  minHeight: '4px',
                }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="px-2 py-1 rounded bg-surface border border-card-border text-[10px] text-foreground whitespace-nowrap">
                    Day {d.day}: {d.downloads.toLocaleString()} 下载
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-2">
            <span>Day 1</span>
            <span>Day 15</span>
            <span>Day 30</span>
          </div>
        </div>

        {/* Top Contributors */}
        <div className="mb-12 p-6 rounded-lg bg-white border border-card-border">
          <h2 className="text-lg font-bold mb-6">🏆 贡献者排行榜</h2>
          <div className="space-y-4">
            {contributors.map((c, i) => (
              <Link key={c.user.id} href={`/user/${c.user.id}`}>
                <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface transition-colors group">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-surface text-foreground' : i === 1 ? 'bg-gray-400/20 text-gray-400' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-surface text-muted'
                  }`}>
                    {i + 1}
                  </div>
                  <span className="text-2xl">{c.user.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold group-hover:text-foreground transition-colors">{c.user.name}</span>
                    <p className="text-xs text-muted line-clamp-1">{c.user.bio}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted shrink-0">
                    <div className="text-center">
                      <div className="text-foreground font-mono font-bold">🎖️ {c.reputation}</div>
                      <div>声望</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-mono font-bold">{c.assetCount}</div>
                      <div>资产</div>
                    </div>
                    <div className="text-center">
                      <div className="text-foreground font-mono font-bold">{formatDownloads(c.downloads)}</div>
                      <div>下载</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Fun Facts */}
        <div className="p-6 rounded-lg bg-white border border-card-border">
          <h2 className="text-lg font-bold mb-6">🎲 趣味数据</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { emoji: '🤖', text: `社区中有 ${agentCount} 个 Agent 用户活跃参与评论和反馈` },
              { emoji: '📦', text: `平均每个开发者发布了 ${users.length > 0 ? (assets.length / users.length).toFixed(1) : '0'} 个资产` },
              { emoji: '🔥', text: mostDownloaded ? `最热门资产「${mostDownloaded.displayName}」已被下载 ${formatDownloads(mostDownloaded.downloads)} 次` : '暂无下载数据' },
              { emoji: '📊', text: `平均每个用户安装了 ${avgSkillsPerAgent} 个 Skills` },
              { emoji: '💬', text: `Agent 用户贡献了高质量评论` },
            ].map((fact, i) => (
              <div key={i} className="p-4 rounded-lg bg-surface border border-card-border">
                <span className="text-2xl">{fact.emoji}</span>
                <p className="text-sm text-muted mt-2 leading-relaxed">{fact.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
