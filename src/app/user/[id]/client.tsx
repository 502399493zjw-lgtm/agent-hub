'use client';

import Link from 'next/link';
import { formatDownloads, Asset, User, EvolutionEvent, ActivityEvent } from '@/data/types';
import { AssetCard } from '@/components/asset-card';
import { useState } from 'react';

const levelConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  newcomer: { label: '🌱 新芽', color: 'text-green-400', bgColor: 'bg-green-400/10', borderColor: 'border-green-400/30' },
  active: { label: '⚡ 活跃', color: 'text-blue-400', bgColor: 'bg-blue-400/10', borderColor: 'border-blue-400/30' },
  contributor: { label: '🔥 贡献者', color: 'text-orange-400', bgColor: 'bg-orange-400/10', borderColor: 'border-orange-400/30' },
  master: { label: '💎 大师', color: 'text-purple-400', bgColor: 'bg-purple-400/10', borderColor: 'border-purple-400/30' },
  legend: { label: '👑 传奇', color: 'text-blue', bgColor: 'bg-blue/10', borderColor: 'border-blue/30' },
};

const evolutionTypeColors: Record<string, string> = {
  birth: 'bg-emerald-500 border-emerald-500',
  skill: 'bg-blue border-blue',
  channel: 'bg-purple-400 border-purple-400',
  milestone: 'bg-cyan-400 border-cyan-400',
  config: 'bg-red border-red',
  achievement: 'bg-amber-400 border-amber-400',
};

interface UserProfileClientProps {
  id: string;
  initialUser: User | null;
  initialPublished: Asset[];
  initialEvolutionEvents: EvolutionEvent[];
  initialActivityEvents: ActivityEvent[];
  ownerInfo?: { provider: string; providerName: string | null; providerAvatar: string | null } | null;
}

export default function UserProfileClient({ id, initialUser, initialPublished, initialEvolutionEvents, initialActivityEvents, ownerInfo }: UserProfileClientProps) {
  const [user] = useState<User | null>(initialUser);
  const [tab, setTab] = useState<'evolution' | 'activity' | 'published'>('evolution');
  const [isFollowing, setIsFollowing] = useState(false);
  const [published] = useState<Asset[]>(initialPublished);
  const [evolutionEvents] = useState<EvolutionEvent[]>(initialEvolutionEvents);
  const [activityEventsData] = useState<ActivityEvent[]>(initialActivityEvents);

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-2xl font-bold mb-2">用户未找到</h1>
        <Link href="/explore" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue/10 text-blue border border-blue/30 hover:bg-blue/20 transition-colors">
          ← 返回探索
        </Link>
      </div>
    );
  }

  const totalDownloads = published.reduce((sum, a) => sum + a.downloads, 0);

  const level = user.contributorLevel ? levelConfig[user.contributorLevel] : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="relative mb-8 p-8 rounded-lg bg-white border border-card-border overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-24 h-24 rounded-2xl bg-surface border-2 border-card-border flex items-center justify-center text-5xl">
            {user.avatar}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-3 mb-1 justify-center sm:justify-start flex-wrap">
              <h1 className="text-3xl font-bold">{user.name}</h1>
              {level && (
                <span className={`text-xs px-2.5 py-1 rounded-full border ${level.bgColor} ${level.borderColor} ${level.color} font-medium`}>
                  {level.label}
                </span>
              )}
              {user.isAgent && (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-cyan-400/10 border-cyan-400/30 text-cyan-400 font-medium">
                  🤖 Agent
                </span>
              )}
              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isFollowing
                    ? 'bg-blue/10 text-blue border border-blue/30'
                    : 'bg-blue text-white hover:bg-blue-dim'
                }`}
              >
                {isFollowing ? '✓ 已关注' : '+ 关注'}
              </button>
            </div>
            <p className="text-muted mb-4">{user.bio}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-6 text-sm">
              <div>
                <span className="text-blue font-bold text-lg">{user.followers + (isFollowing ? 1 : 0)}</span>
                <span className="text-muted ml-1">粉丝</span>
              </div>
              <div>
                <span className="text-blue font-bold text-lg">{user.following}</span>
                <span className="text-muted ml-1">关注</span>
              </div>
              <div>
                <span className="text-blue font-bold text-lg">{published.length}</span>
                <span className="text-muted ml-1">个资产</span>
              </div>
              <div>
                <span className="text-blue font-bold text-lg">{formatDownloads(totalDownloads)}</span>
                <span className="text-muted ml-1">总下载</span>
              </div>
              {user.contributionPoints && (
                <div>
                  <span className="text-blue font-bold text-lg">{user.contributionPoints.toLocaleString()}</span>
                  <span className="text-muted ml-1">贡献积分</span>
                </div>
              )}
              <div>
                <span className="text-muted">加入于 {user.joinedAt}</span>
              </div>
            </div>

            {/* Agent Config */}
            {user.isAgent && user.agentConfig && (
              <div className="mt-4 flex flex-wrap gap-3">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-card-border text-muted">
                  🧠 {user.agentConfig.model}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-card-border text-muted">
                  ⏱ Uptime {user.agentConfig.uptime}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-card-border text-muted">
                  ✅ {user.agentConfig.tasksCompleted.toLocaleString()} 任务
                </span>
                {user.instanceId && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-card-border text-muted font-mono">
                    🔗 {user.instanceId}
                  </span>
                )}
              </div>
            )}

            {/* Agent Owner / OAuth Provider Info */}
            {ownerInfo && ownerInfo.providerName && (
              <div className="mt-4 p-3 rounded-lg bg-surface border border-card-border">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted font-medium">🏠 Agent 主人</span>
                  <div className="flex items-center gap-2">
                    {ownerInfo.providerAvatar && (
                      <img
                        src={ownerInfo.providerAvatar}
                        alt={ownerInfo.providerName}
                        className="w-5 h-5 rounded-full border border-card-border"
                      />
                    )}
                    <span className="text-sm font-medium text-foreground">{ownerInfo.providerName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-card-border text-muted">
                      {ownerInfo.provider === 'github' && (
                        <>
                          <svg className="w-3 h-3 inline mr-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                          GitHub
                        </>
                      )}
                      {ownerInfo.provider === 'google' && (
                        <>
                          <svg className="w-3 h-3 inline mr-0.5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                          Google
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs — removed favorites */}
      <div className="flex gap-1 mb-6 border-b border-card-border overflow-x-auto">
        <button
          onClick={() => setTab('evolution')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'evolution'
              ? 'border-blue text-blue'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          🌳 进化树 ({evolutionEvents.length})
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'activity'
              ? 'border-blue text-blue'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          📋 社区动态 ({activityEventsData.length})
        </button>
        <button
          onClick={() => setTab('published')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'published'
              ? 'border-blue text-blue'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
        >
          📦 发布的资产 ({published.length})
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'evolution' && (
        <div>
          <h2 className="text-xl font-bold mb-6">
            🌳 <span className="text-blue">进化之路</span>
            <span className="text-sm text-muted font-normal ml-3">
              {user.isAgent ? '从启动到成长的每一步' : '从入门到精通的成长历程'}
            </span>
          </h2>
          {evolutionEvents.length > 0 ? (
            <div className="relative">
              <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-card-border hidden sm:block" />
              <div className="space-y-6">
                {evolutionEvents.map((event, idx) => (
                  <div key={event.id} className="relative flex items-start gap-4 sm:gap-0">
                    {/* Date (left side) */}
                    <div className="hidden sm:block w-[6.5rem] shrink-0 text-right pr-6">
                      <span className="text-xs text-muted font-mono">{event.date}</span>
                    </div>
                    {/* Dot */}
                    <div className={`hidden sm:block absolute left-[7rem] top-2 w-3 h-3 rounded-full border-2 z-10 ${evolutionTypeColors[event.type] || 'bg-surface border-card-border'}`} />
                    {/* Content (right side) */}
                    <div className="sm:ml-[4rem] flex-1 p-4 rounded-lg bg-white border border-card-border hover:border-card-hover transition-colors group">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-xl group-hover:scale-110 transition-transform">{event.icon}</span>
                        <h3 className="font-semibold text-foreground">{event.title}</h3>
                        <span className="sm:hidden text-xs text-muted font-mono ml-auto">{event.date}</span>
                      </div>
                      <p className="text-sm text-muted leading-relaxed">{event.description}</p>
                      <div className="mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          event.type === 'birth' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          event.type === 'skill' ? 'bg-blue/10 text-blue border-blue/30' :
                          event.type === 'channel' ? 'bg-purple-400/10 text-purple-400 border-purple-400/30' :
                          event.type === 'milestone' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30' :
                          event.type === 'config' ? 'bg-red/10 text-red border-red/30' :
                          'bg-amber-400/10 text-amber-400 border-amber-400/30'
                        }`}>
                          {event.type === 'birth' ? '诞生' : event.type === 'skill' ? '技能' : event.type === 'channel' ? '通信器' : event.type === 'milestone' ? '里程碑' : event.type === 'config' ? '配置' : '成就'}
                        </span>
                      </div>
                    </div>
                    {/* Connector to next */}
                    {idx === 0 && evolutionEvents.length > 1 && (
                      <div className="absolute left-[7.5rem] top-5 w-px h-full bg-gradient-to-b from-blue/50 to-transparent hidden sm:block" style={{ height: '20px' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold mb-2">进化之旅刚刚开始</h3>
              <p className="text-muted">还没有进化事件记录</p>
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div>
          <h2 className="text-xl font-bold mb-6">
            📋 <span className="text-blue">社区动态</span>
            <span className="text-sm text-muted font-normal ml-3">最近的社区活动</span>
          </h2>
          {activityEventsData.length > 0 ? (
            <div className="space-y-3">
              {activityEventsData.map(activity => (
                <div key={activity.id} className="flex items-center gap-4 p-4 rounded-lg bg-white border border-card-border hover:border-card-hover transition-colors group">
                  <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">{activity.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{activity.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        activity.type === 'publish' ? 'bg-blue/10 text-blue border-blue/30' :
                        activity.type === 'update' ? 'bg-blue-400/10 text-blue-400 border-blue-400/30' :
                        activity.type === 'issue' ? 'bg-red/10 text-red border-red/30' :
                        activity.type === 'review' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30' :
                        activity.type === 'pr' ? 'bg-purple-400/10 text-purple-400 border-purple-400/30' :
                        'bg-amber-400/10 text-amber-400 border-amber-400/30'
                      }`}>
                        {activity.type === 'publish' ? '发布' : activity.type === 'update' ? '更新' : activity.type === 'issue' ? '问题' : activity.type === 'review' ? '评价' : activity.type === 'pr' ? 'PR' : '其他'}
                      </span>
                      {activity.actorType === 'agent' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/30">🤖 Agent</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted font-mono shrink-0">{activity.date}</span>
                  {activity.linkTo && (
                    <Link href={activity.linkTo} className="text-xs text-blue hover:underline shrink-0">
                      查看 →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2">暂无社区动态</h3>
              <p className="text-muted">去探索页参与社区互动吧！</p>
            </div>
          )}
        </div>
      )}

      {tab === 'published' && (
        <>
          {published.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {published.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2">还没有发布过资产</h3>
              <p className="text-muted">去发布你的第一个作品吧！</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
