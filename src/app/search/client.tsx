'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { typeConfig, formatDownloads, Asset, User, Issue } from '@/data/types';

interface SearchContentProps {
  initialAssets: Asset[];
  initialUsers: User[];
  initialIssues: Issue[];
  initialQuery: string;
}

function SearchContent({ initialAssets, initialUsers, initialIssues, initialQuery }: SearchContentProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentQ = searchParams.get('q') || initialQuery;
  const urlQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(urlQuery || currentQ);

  // Assets from API (DB-backed)
  const [assetResults, setAssetResults] = useState<Asset[]>(initialAssets);
  const [userResults, setUserResults] = useState<User[]>(initialUsers);
  const [issueResults, setIssueResults] = useState<Issue[]>(initialIssues);

  // Re-fetch when URL q param changes (client-side navigation)
  useEffect(() => {
    const fetchResults = async () => {
      if (urlQuery && urlQuery !== initialQuery) {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(urlQuery)}`);
          const json = await res.json();
          if (json.results) {
            setAssetResults(json.results.assets?.items || []);
            setUserResults(json.results.users?.items || []);
            setIssueResults(json.results.issues?.items || []);
          }
        } catch {
          // ignore
        }
      } else if (!urlQuery) {
        setAssetResults([]);
        setUserResults([]);
        setIssueResults([]);
      }
    };
    
    fetchResults();
  }, [urlQuery, initialQuery]);

  const totalCount = assetResults.length + userResults.length + issueResults.length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 grid-bg pointer-events-none" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">
            🔍 全局搜索
          </h1>

          <form onSubmit={handleSearch}>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索资产、用户、Issues..."
                className="w-full pl-12 pr-28 py-4 rounded-lg border border-card-border bg-white text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 rounded-lg bg-blue text-white font-semibold text-sm hover:bg-blue-dim transition-colors">
                搜索
              </button>
            </div>
          </form>
        </div>

        {currentQ && (
          <div className="mb-6 text-sm text-muted">
            搜索 &ldquo;<span className="text-foreground font-medium">{currentQ}</span>&rdquo; 找到 <span className="text-foreground font-mono font-bold">{totalCount}</span> 个结果
          </div>
        )}

        {!currentQ ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">输入关键词开始搜索</h3>
            <p className="text-muted">搜索涵盖资产、用户和 Issues</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">😔</div>
            <h3 className="text-xl font-semibold mb-2">未找到相关结果</h3>
            <p className="text-muted">试试其他关键词</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Assets */}
            {assetResults.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  📦 资产 <span className="text-sm font-normal text-muted">({assetResults.length})</span>
                </h2>
                <div className="space-y-3">
                  {assetResults.map(asset => (
                    <AssetResult key={asset.id} asset={asset} />
                  ))}
                </div>
              </section>
            )}

            {/* Users */}
            {userResults.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  👥 用户 <span className="text-sm font-normal text-muted">({userResults.length})</span>
                </h2>
                <div className="space-y-3">
                  {userResults.map(user => (
                    <UserResult key={user.id} user={user} />
                  ))}
                </div>
              </section>
            )}

            {/* Issues */}
            {issueResults.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  🐛 Issues <span className="text-sm font-normal text-muted">({issueResults.length})</span>
                </h2>
                <div className="space-y-3">
                  {issueResults.map(issue => (
                    <IssueResult key={issue.id} issue={issue} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssetResult({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  return (
    <Link href={`/asset/${asset.id}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white border border-card-border hover:border-blue/30 transition-colors group">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${config.bgColor} border ${config.borderColor}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold group-hover:text-foreground transition-colors">{asset.displayName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${config.bgColor} ${config.borderColor} ${config.color}`}>{config.label}</span>
            <span className="text-xs font-mono text-muted">v{asset.version}</span>
          </div>
          <p className="text-xs text-muted mt-0.5 line-clamp-1">{asset.description}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted shrink-0">
          <span>⬇ {formatDownloads(asset.downloads)}</span>
        </div>
      </div>
    </Link>
  );
}

function UserResult({ user }: { user: User }) {
  return (
    <Link href={`/user/${user.id}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white border border-card-border hover:border-blue/30 transition-colors group">
        <div className="w-10 h-10 rounded-lg bg-surface border border-card-border flex items-center justify-center text-xl">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold group-hover:text-foreground transition-colors">{user.name}</span>
            {user.isAgent && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">🤖 Agent</span>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5 line-clamp-1">{user.bio}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted shrink-0">
          <span>{user.followers} 粉丝</span>
          <span>{user.publishedAssets.length} 资产</span>
        </div>
      </div>
    </Link>
  );
}

function IssueResult({ issue }: { issue: Issue }) {
  return (
    <Link href={`/asset/${issue.assetId}`}>
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white border border-card-border hover:border-blue/30 transition-colors group">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
          issue.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/10 text-muted'
        }`}>
          {issue.status === 'open'
            ? <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="7" /></svg>
            : <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z" /></svg>
          }
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold group-hover:text-foreground transition-colors">{issue.title}</span>
          <div className="flex items-center gap-2 text-[10px] text-muted mt-0.5">
            <span>{issue.authorName}</span>
            <span>·</span>
            <span>{issue.createdAt}</span>
            <span>·</span>
            <span>💬 {issue.commentCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {issue.labels.slice(0, 2).map(l => (
            <span key={l} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted border border-card-border">{l}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

interface SearchClientPageProps {
  initialAssets: Asset[];
  initialUsers: User[];
  initialIssues: Issue[];
  initialQuery: string;
}

export default function SearchClientPage({ initialAssets, initialUsers, initialIssues, initialQuery }: SearchClientPageProps) {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-4">🔍 全局搜索</h1>
        <p className="text-muted">加载中...</p>
      </div>
    }>
      <SearchContent initialAssets={initialAssets} initialUsers={initialUsers} initialIssues={initialIssues} initialQuery={initialQuery} />
    </Suspense>
  );
}
