'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AssetType, typeConfig, Asset, formatDownloads } from '@/data/types';

const categories = ['全部', '信息查询', '开发工具', '创意生成', '数据处理', '效率工具', '语言处理', '创意角色', '教育辅导', '商业顾问', '趣味角色', '存储引擎', '通信集成', '基础设施', '安全认证', '自动化', '语音处理', 'DevOps', '事件驱动', '数据工程', '通用助手', '专业开发', '内容创作', '系统工具', '事件触发', '知识工作', '开发运维', '客户服务', 'Agent 模板'];
const sortOptions = [
  { value: 'popular', label: '最热' },
  { value: 'newest', label: '最新' },
];

function AuthorAvatar({ src, name }: { src: string; name: string }) {
  if (src?.startsWith('http') || src?.startsWith('/api/avatars/')) {
    return <img src={src} alt={name} className="w-5 h-5 rounded-full object-cover border border-card-border" />;
  }
  return (
    <div className="w-5 h-5 rounded-full bg-surface border border-card-border flex items-center justify-center text-[10px]">
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

/** Single asset row matching production list layout */
function AssetListItem({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  const stars = asset.totalStars ?? asset.githubStars ?? 0;

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className="group px-5 py-5 hover:bg-surface/50 transition-colors duration-150 border-b" style={{ borderColor: '#e5e7eb' }}>
        {/* Row 1: Badge + Name + Version */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full border bg-surface border-card-border text-ink-light">
            {config.label}
          </span>
          <h3 className="text-base font-bold text-foreground group-hover:text-blue transition-colors duration-150 truncate">
            {asset.displayName}
          </h3>
          <span className="text-xs text-muted font-mono flex-shrink-0">v{asset.version}</span>
        </div>

        {/* Row 2: Author */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-shrink-0">
            <AuthorAvatar src={asset.author.avatar} name={asset.author.name} />
          </div>
          <span className="text-xs text-muted">{asset.author.name}</span>
          {asset.author.reputation != null && asset.author.reputation > 0 && (
            <span className="text-[10px] text-muted/70 font-mono" title="声望">🎖️{asset.author.reputation}</span>
          )}
        </div>

        {/* Row 3: Description */}
        <p className="text-sm text-muted leading-relaxed line-clamp-2 mb-3">
          {asset.description}
        </p>

        {/* Row 4: Tags left, Stats right */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(asset.tags ?? []).slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-muted border border-card-border">
                {tag}
              </span>
            ))}
            {(asset.tags ?? []).length > 3 && (
              <span className="text-[10px] px-1.5 py-0.5 text-muted">+{(asset.tags ?? []).length - 3}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted flex-shrink-0">
            {stars > 0 && (
              <span className="flex items-center gap-0.5">
                <span className="text-yellow-500">★</span>
                <span className="font-mono">{formatCount(stars)}</span>
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
}

interface ExploreContentProps {
  initialAssets: Asset[];
  initialTotal: number;
  typeCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  totalCount: number;
}

function ExploreContent({ initialAssets, initialTotal, typeCounts, categoryCounts, totalCount }: ExploreContentProps) {
  const searchParams = useSearchParams();

  const initialQ = searchParams.get('q') || '';
  const initialType = (searchParams.get('type') as AssetType | 'all') || 'all';
  const initialSort = searchParams.get('sort') || 'popular';

  const [search, setSearch] = useState(initialQ);
  const [selectedType, setSelectedType] = useState<'all' | AssetType>(
    initialType && (initialType === 'all' || ['skill','experience','plugin','trigger','channel'].includes(initialType))
      ? initialType
      : 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [sortBy, setSortBy] = useState(
    sortOptions.some(o => o.value === initialSort) ? initialSort : 'popular'
  );

  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const PAGE_SIZE = 30;

  // Sync when URL params change
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') as AssetType | 'all' | null;
    const sort = searchParams.get('sort');

    if (q) setSearch(q);
    if (type && (type === 'all' || ['skill','experience','plugin','trigger','channel'].includes(type))) {
      setSelectedType(type);
    }
    if (sort && sortOptions.some(o => o.value === sort)) {
      setSortBy(sort);
    }
  }, [searchParams]);

  const fetchAssets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedType !== 'all') {
      // "经验/合集" filter: fetch both experience and template
      if (selectedType === 'experience' || selectedType === 'template') {
        params.set('type', selectedType);
      } else {
        params.set('type', selectedType);
      }
    }
    if (selectedCategory !== '全部') params.set('category', selectedCategory);
    if (search) params.set('q', search);
    params.set('sort', sortBy);
    params.set('limit', String(PAGE_SIZE));
    params.set('cursor', String(page));

    fetch(`/api/v1/assets?${params.toString()}`)
      .then(res => res.json())
      .then(json => {
        // V1 API returns { total, items, nextCursor }
        // Normalize V1 compact format to match Asset shape expected by UI
        const normalized = (json.items ?? []).map((item: Record<string, unknown>) => ({
          ...item,
          downloads: item.installs ?? item.downloads ?? 0,
          author: typeof item.author === 'string'
            ? { id: item.authorId ?? '', name: item.author, avatar: '', reputation: 0 }
            : item.author,
        }));
        setAssets(normalized);
        setTotal(json.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedType, selectedCategory, search, sortBy, page]);

  // If SSR bailed out and we got empty initial data, fetch on mount
  useEffect(() => {
    if (initialAssets.length === 0 && assets.length === 0 && !loading) {
      fetchAssets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced fetch on filter change, but skip the first render (use SSR data)
  useEffect(() => {
    if (!hasUserInteracted) return;
    const timer = setTimeout(fetchAssets, 150);
    return () => clearTimeout(timer);
  }, [fetchAssets, hasUserInteracted]);

  // Track user interaction
  const handleTypeChange = (type: 'all' | AssetType) => {
    setSelectedType(type);
    setPage(1);
    setHasUserInteracted(true);
  };
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
    setHasUserInteracted(true);
  };
  const handleSortChange = (sort: string) => {
    setSortBy(sort);
    setPage(1);
    setHasUserInteracted(true);
  };
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    setHasUserInteracted(true);
  };

  const typeFilters: { value: 'all' | AssetType; label: string; icon: string }[] = [
    { value: 'all', label: '全部', icon: '' },
    { value: 'experience', label: '经验/合集', icon: '' },
    { value: 'skill', label: '技能', icon: '' },
    { value: 'plugin', label: '插件', icon: '' },
    { value: 'trigger', label: '触发器', icon: '' },
    { value: 'channel', label: '通信器', icon: '' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-muted mb-3">Explore</p>
        <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground tracking-tight">
          探索资产
        </h1>
        <p className="text-muted text-lg">发现社区分享的技能、经验、插件、触发器和通信器</p>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <label htmlFor="explore-search" className="sr-only">搜索资产</label>
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="explore-search"
            type="text"
            placeholder="搜索技能、插件、触发器…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-full bg-white border border-card-border text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 transition-[border-color] duration-150"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-[color] duration-150"
              aria-label="清除搜索"
            >
              ✕
            </button>
          )}
        </div>
        <div className="relative">
          <label htmlFor="explore-sort" className="sr-only">排序方式</label>
          <select
            id="explore-sort"
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="appearance-none pl-4 pr-9 py-3 rounded-full bg-white border border-card-border text-foreground text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 transition-[border-color] duration-150 cursor-pointer"
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Filters */}
        <aside className="lg:w-60 shrink-0">
          {/* Type Filter */}
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-[0.15em] mb-3 font-sans">资产类型</h3>
            <div className="space-y-1">
              {typeFilters.map(tf => {
                // Count: "经验/合集" combines experience + template
                const count = tf.value === 'all'
                  ? totalCount
                  : tf.value === 'experience'
                    ? (typeCounts['experience'] || 0) + (typeCounts['template'] || 0)
                    : (typeCounts[tf.value] || 0);

                // Hide zero-count types (except 全部)
                if (tf.value !== 'all' && count === 0) return null;

                return (
                  <button
                    key={tf.value}
                    onClick={() => handleTypeChange(tf.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-[color,background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 ${
                      selectedType === tf.value
                        ? 'bg-surface text-foreground border border-card-border'
                        : 'text-muted hover:bg-white hover:text-foreground border border-transparent'
                    }`}
                  >
                    <span>{tf.icon}</span>
                    <span>{tf.label}</span>
                    <span className="ml-auto text-xs opacity-60">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="text-xs font-semibold text-muted uppercase tracking-[0.15em] mb-3 font-sans">分类</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {categories.map(cat => {
                const count = cat === '全部' ? totalCount : (categoryCounts[cat] || 0);
                if (cat !== '全部' && count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-[color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 ${
                      selectedCategory === cat
                        ? 'bg-white text-foreground font-medium'
                        : 'text-muted hover:bg-white hover:text-foreground'
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span className="text-xs opacity-50">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Results List */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-muted">
              {loading ? (
                '加载中…'
              ) : (
                <>
                  找到 <span className="text-foreground font-semibold">{total}</span> 个资产
                  {search && <span className="ml-2">· 搜索: &quot;{search}&quot;</span>}
                </>
              )}
            </span>
          </div>

          {loading ? (
            <div className="rounded-lg border border-card-border bg-white overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-5 py-5 border-b animate-pulse" style={{ borderColor: '#e5e7eb' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 bg-surface rounded-full w-12" />
                    <div className="h-5 bg-surface rounded w-1/3" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-surface rounded-full" />
                    <div className="h-3 bg-surface rounded w-20" />
                  </div>
                  <div className="h-4 bg-surface rounded w-full mb-2" />
                  <div className="h-4 bg-surface rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : assets.length > 0 ? (
            <div className="rounded-lg border border-card-border bg-white overflow-hidden">
              {assets.map(asset => (
                <AssetListItem key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="text-center py-24">
              <div className="text-7xl mb-6">🔍</div>
              <h3 className="text-2xl font-bold mb-3">未找到匹配的资产</h3>
              <p className="text-muted text-lg">试试调整筛选条件或搜索关键词</p>
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); setHasUserInteracted(true); }}
                disabled={page <= 1}
                className="px-3 py-2 rounded-lg text-sm border border-card-border bg-white text-muted hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
              >
                ← 上一页
              </button>
              {(() => {
                const totalPages = Math.ceil(total / PAGE_SIZE);
                const pages: (number | '...')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 3) pages.push('...');
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                  if (page < totalPages - 2) pages.push('...');
                  pages.push(totalPages);
                }
                return pages.map((p, idx) =>
                  p === '...' ? (
                    <span key={`dots-${idx}`} className="px-2 text-muted">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => { setPage(p); setHasUserInteracted(true); }}
                      className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors duration-150 ${
                        page === p
                          ? 'bg-foreground text-white'
                          : 'border border-card-border bg-white text-muted hover:text-foreground hover:bg-surface'
                      }`}
                    >
                      {p}
                    </button>
                  )
                );
              })()}
              <button
                onClick={() => { setPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1)); setHasUserInteracted(true); }}
                disabled={page >= Math.ceil(total / PAGE_SIZE)}
                className="px-3 py-2 rounded-lg text-sm border border-card-border bg-white text-muted hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150"
              >
                下一页 →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ExploreClientPageProps {
  initialAssets: Asset[];
  initialTotal: number;
  typeCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  totalCount: number;
}

export default function ExploreClientPage({ initialAssets, initialTotal, typeCounts, categoryCounts, totalCount }: ExploreClientPageProps) {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-foreground tracking-tight">
            探索资产
          </h1>
          <p className="text-muted text-lg">加载中…</p>
        </div>
      </div>
    }>
      <ExploreContent initialAssets={initialAssets} initialTotal={initialTotal} typeCounts={typeCounts} categoryCounts={categoryCounts} totalCount={totalCount} />
    </Suspense>
  );
}
