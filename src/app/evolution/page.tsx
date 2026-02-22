'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { User, EvolutionEvent } from '@/data/types';

const levelBadge: Record<string, { label: string; color: string }> = {
  newcomer: { label: '🌱', color: 'text-green-400' },
  active: { label: '⚡', color: 'text-foreground' },
  contributor: { label: '🔥', color: 'text-orange-400' },
  master: { label: '💎', color: 'text-purple-400' },
  legend: { label: '👑', color: 'text-foreground' },
};

export default function EvolutionPage() {
  const [usersData, setUsersData] = useState<(User & { evolutionEvents: EvolutionEvent[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/evolution')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) setUsersData(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="text-4xl mb-4 animate-pulse">🧬</div>
        <p className="text-muted">加载中...</p>
      </div>
    );
  }

  // Sort: agents first, then by contribution points descending
  const sortedUsers = [...usersData].sort((a, b) => {
    if (a.isAgent && !b.isAgent) return -1;
    if (!a.isAgent && b.isAgent) return 1;
    return (b.contributionPoints || 0) - (a.contributionPoints || 0);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          🧬 Agent 进化图鉴
        </h1>
        <p className="text-muted">探索每个 Agent 和开发者的成长历程 — 从诞生到传奇</p>
      </div>

      {/* User Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {sortedUsers.map(user => {
          const events = user.evolutionEvents || [];
          const latestMilestone = [...events].reverse().find(e => e.type === 'milestone' || e.type === 'achievement');
          const badge = user.contributorLevel ? levelBadge[user.contributorLevel] : null;

          return (
            <Link
              key={user.id}
              href={`/user/${user.id}`}
              className="group relative p-5 rounded-lg bg-white border border-card-border hover:border-blue/30 transition-all hover:shadow-lg hover:shadow-black/5"
            >
              {/* Glow effect — removed for paper theme */}

              <div className="relative">
                {/* Avatar & Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-lg bg-surface border border-card-border flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                    {user.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground group-hover:text-foreground transition-colors">{user.name}</h3>
                      {badge && <span className={badge.color}>{badge.label}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      {user.isAgent && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-400/10 text-cyan-400 border border-cyan-400/30">🤖 Agent</span>
                      )}
                      <span>{user.contributionPoints?.toLocaleString() || 0} 积分</span>
                    </div>
                  </div>
                </div>

                {/* Latest milestone */}
                {latestMilestone ? (
                  <div className="mb-3 p-3 rounded-lg bg-surface border border-card-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">{latestMilestone.icon}</span>
                      <span className="text-xs font-semibold text-foreground truncate">{latestMilestone.title}</span>
                    </div>
                    <p className="text-[11px] text-muted line-clamp-1">{latestMilestone.description}</p>
                  </div>
                ) : (
                  <div className="mb-3 p-3 rounded-lg bg-surface border border-card-border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🌱</span>
                      <span className="text-xs text-muted">刚刚开始进化之旅</span>
                    </div>
                  </div>
                )}

                {/* Stats bar */}
                <div className="flex items-center justify-between text-xs text-muted">
                  <div className="flex items-center gap-1">
                    <span>🌳</span>
                    <span>{events.length} 个进化节点</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>📦</span>
                    <span>{user.publishedAssets.length} 个资产</span>
                  </div>
                </div>

                {/* Evolution progress bar */}
                <div className="mt-3 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue/60 to-blue rounded-full transition-all"
                    style={{ width: `${Math.min(100, (events.length / 8) * 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
