'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  comments, issues, getAssetById,
  formatDownloads, typeConfig, Asset, Comment, Issue,
} from '@/data/mock';

// Simulated 7-day download data
const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const weekData = [2340, 3120, 2890, 4210, 3870, 5120, 4560];
const maxWeek = Math.max(...weekData);

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-card-border bg-white p-5 card-hover">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-muted">{label}</span>
      </div>
      <div className="text-3xl font-bold font-mono text-blue ">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

function MyAssetRow({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  return (
    <Link href={`/asset/${asset.id}`}>
      <div className="flex items-center gap-4 p-3 rounded-lg hover:bg-card-hover transition-colors cursor-pointer group">
        {/* Type badge */}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${config.bgColor} ${config.borderColor} ${config.color} whitespace-nowrap`}>
          {config.icon} {config.label}
        </span>
        {/* Name */}
        <span className="flex-1 text-sm font-medium group-hover:text-blue transition-colors truncate">
          {asset.displayName}
        </span>
        {/* Version */}
        <span className="text-xs text-muted font-mono">v{asset.version}</span>
        {/* Downloads */}
        <span className="text-xs text-muted font-mono w-16 text-right">⬇️ {formatDownloads(asset.downloads)}</span>
        {/* Issues */}
        <span className="text-xs text-muted font-mono w-12 text-right">
          {asset.issueCount > 0 ? (
            <span className={asset.issueCount > 5 ? 'text-red' : 'text-muted'}>🐛 {asset.issueCount}</span>
          ) : (
            <span className="text-green-500">✓</span>
          )}
        </span>
      </div>
    </Link>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const asset = getAssetById(comment.assetId);
  const isAgent = comment.commenterType === 'agent';

  return (
    <div className={`p-3 rounded-lg border ${isAgent ? 'border-purple-500/20 bg-purple-500/5' : 'border-card-border bg-white/50'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{comment.userAvatar}</span>
        <span className={`text-xs font-medium ${isAgent ? 'text-purple-400' : 'text-foreground'}`}>
          {comment.userName}
          {isAgent && <span className="ml-1 text-[10px] text-purple-400/70">🤖 Agent</span>}
        </span>
        <span className="text-[10px] text-muted ml-auto">{comment.createdAt}</span>
      </div>
      <p className="text-xs text-muted line-clamp-2 mb-1">{comment.content}</p>
      {asset && (
        <Link href={`/asset/${asset.id}`} className="text-[10px] text-blue hover:text-blue-dim transition-colors">
          → {asset.displayName}
        </Link>
      )}
    </div>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  const asset = getAssetById(issue.assetId);
  const isOpen = issue.status === 'open';
  const isAgent = issue.authorType === 'agent';

  return (
    <div className="p-3 rounded-lg border border-card-border bg-white/50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-muted'}`} />
        <span className="text-xs font-medium text-foreground flex-1 truncate">{issue.title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOpen ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-muted/10 text-muted border border-card-border'}`}>
          {isOpen ? 'Open' : 'Closed'}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span className={isAgent ? 'text-purple-400' : ''}>
          {issue.authorAvatar} {issue.authorName}
          {isAgent && ' 🤖'}
        </span>
        <span>·</span>
        <span>{issue.createdAt}</span>
        <span>·</span>
        <span>💬 {issue.commentCount}</span>
        {issue.labels.map(label => (
          <span key={label} className="px-1.5 py-0.5 rounded bg-surface border border-card-border text-muted">
            {label}
          </span>
        ))}
      </div>
      {asset && (
        <Link href={`/asset/${asset.id}`} className="text-[10px] text-blue hover:text-blue-dim transition-colors mt-1 inline-block">
          → {asset.displayName}
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assets?pageSize=100')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data?.assets) {
          setAllAssets(json.data.assets);
        }
      })
      .catch(err => console.error('Failed to fetch assets:', err))
      .finally(() => setLoading(false));
  }, []);

  if (authLoading || loading) {
    return (
      <div className="relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-4xl mb-4 animate-pulse">📦</div>
            <p className="text-muted">加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative">
        <div className="absolute inset-0 grid-bg pointer-events-none" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <p className="text-muted mb-4">请先登录以查看 Dashboard</p>
            <Link href="/" className="text-blue hover:text-blue-dim transition-colors">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const myAssets = allAssets.filter(a => a.author.id === user.id);
  const totalDownloads = myAssets.reduce((sum, a) => sum + a.downloads, 0);

  // Recent comments on my assets
  const myAssetIds = new Set(myAssets.map(a => a.id));
  const recentComments = comments
    .filter(c => myAssetIds.has(c.assetId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Recent issues on my assets
  const recentIssues = issues
    .filter(i => myAssetIds.has(i.assetId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="relative">
      {/* Background */}
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-blue/3 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-red/3 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center gap-6 mb-10">
          <div className="w-16 h-16 rounded-full border-2 border-blue/30 bg-blue/10 flex items-center justify-center text-3xl overflow-hidden">
            {user.avatar?.startsWith('http') ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              user.avatar || '👤'
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="text-blue">{user.name}</span>
              <span className="text-muted text-lg ml-3">Dashboard</span>
            </h1>
            <p className="text-sm text-muted mt-1">{user.email || ''}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link href="/publish" className="group p-4 rounded-lg border border-card-border bg-white card-hover flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue/10 border border-blue/30 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🚀</div>
            <div>
              <div className="text-sm font-semibold group-hover:text-blue transition-colors">发布新资产</div>
              <div className="text-xs text-muted">分享你的创作</div>
            </div>
          </Link>
          <a href="#issues-section" className="group p-4 rounded-lg border border-card-border bg-white card-hover flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-red/10 border border-red/30 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">🐛</div>
            <div>
              <div className="text-sm font-semibold group-hover:text-red transition-colors">查看全部 Issues</div>
              <div className="text-xs text-muted">{recentIssues.length} 个待处理</div>
            </div>
          </a>
          <Link href={`/user/${user.id}`} className="group p-4 rounded-lg border border-card-border bg-white card-hover flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-400/10 border border-blue-400/30 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">👤</div>
            <div>
              <div className="text-sm font-semibold group-hover:text-blue-400 transition-colors">管理 Profile</div>
              <div className="text-xs text-muted">编辑个人信息</div>
            </div>
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard icon="📦" label="已发布组件" value={myAssets.length} sub={`${new Set(myAssets.map(a => a.type)).size} 种类型`} />
          <StatCard icon="⬇️" label="总下载量" value={formatDownloads(totalDownloads)} sub="累计所有组件" />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: My Assets + Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* My Assets */}
            <div className="rounded-lg border border-card-border bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">
                  📦 <span className="text-blue">我的组件</span>
                </h2>
                <span className="text-xs text-muted font-mono">{myAssets.length} 个</span>
              </div>
              <div className="space-y-1">
                {myAssets.length > 0 ? (
                  myAssets
                    .sort((a, b) => b.downloads - a.downloads)
                    .map(asset => (
                      <MyAssetRow key={asset.id} asset={asset} />
                    ))
                ) : (
                  <p className="text-sm text-muted text-center py-8">还没有发布组件，去发布第一个吧！</p>
                )}
              </div>
            </div>

            {/* Download chart */}
            <div className="rounded-lg border border-card-border bg-white p-6">
              <h2 className="text-lg font-bold mb-6">
                📈 <span className="text-blue">近 7 天下载趋势</span>
              </h2>
              <div className="flex items-end gap-3 h-40">
                {weekData.map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] text-muted font-mono">{formatDownloads(val)}</span>
                    <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: `${(val / maxWeek) * 100}%` }}>
                      <div
                        className="absolute inset-0 rounded-t-md"
                        style={{
                          background: 'linear-gradient(to top, rgba(255,215,0,0.3), rgba(255,215,0,0.7))',
                          boxShadow: '0 0 10px rgba(255,215,0,0.2)',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted">{weekDays[i]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-card-border flex items-center justify-between text-xs text-muted">
                <span>本周总计：<span className="text-blue font-mono font-bold">{formatDownloads(weekData.reduce((a, b) => a + b, 0))}</span></span>
                <span>日均：<span className="text-blue font-mono">{formatDownloads(Math.round(weekData.reduce((a, b) => a + b, 0) / 7))}</span></span>
              </div>
            </div>
          </div>

          {/* Right column: Comments + Issues */}
          <div className="space-y-6">
            {/* Recent Comments */}
            <div className="rounded-lg border border-card-border bg-white p-6">
              <h2 className="text-lg font-bold mb-4">
                💬 <span className="text-blue">最近评论</span>
              </h2>
              <div className="space-y-3">
                {recentComments.length > 0 ? (
                  recentComments.map(comment => (
                    <CommentRow key={comment.id} comment={comment} />
                  ))
                ) : (
                  <p className="text-sm text-muted text-center py-4">暂无评论</p>
                )}
              </div>
            </div>

            {/* Recent Issues */}
            <div id="issues-section" className="rounded-lg border border-card-border bg-white p-6">
              <h2 className="text-lg font-bold mb-4">
                🐛 <span className="text-blue">最近 Issue</span>
              </h2>
              <div className="space-y-3">
                {recentIssues.length > 0 ? (
                  recentIssues.map(issue => (
                    <IssueRow key={issue.id} issue={issue} />
                  ))
                ) : (
                  <p className="text-sm text-muted text-center py-4">暂无 Issue</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
