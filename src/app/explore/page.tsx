'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { AssetType, typeConfig, Asset } from '@/data/mock';
import { AssetCard } from '@/components/asset-card';

const categories = ['全部', '信息查询', '开发工具', '创意生成', '数据处理', '效率工具', '语言处理', '创意角色', '教育辅导', '商业顾问', '趣味角色', '存储引擎', '通信集成', '基础设施', '安全认证', '自动化', '语音处理', 'DevOps', '事件驱动', '数据工程', '通用助手', '专业开发', '内容创作', '系统工具', '事件触发', '知识工作', '开发运维', '客户服务', 'Agent 模板'];
const sortOptions = [
  { value: 'popular', label: '🔥 最热' },
  { value: 'trending', label: '📈 Trending' },
  { value: 'newest', label: '✨ 最新' },
  { value: 'downloads', label: '📥 下载最多' },
];

function ExploreContent() {
  const searchParams = useSearchParams();

  const initialQ = searchParams.get('q') || '';
  const initialType = (searchParams.get('type') as AssetType | 'all') || 'all';
  const initialSort = searchParams.get('sort') || 'popular';

  const [search, setSearch] = useState(initialQ);
  const [selectedType, setSelectedType] = useState<'all' | AssetType>(
    initialType && (initialType === 'all' || ['skill','config','plugin','trigger','channel','template'].includes(initialType))
      ? initialType
      : 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [sortBy, setSortBy] = useState(
    sortOptions.some(o => o.value === initialSort) ? initialSort : 'popular'
  );

  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // For counting assets per type in sidebar
  const [allAssets, setAllAssets] = useState<Asset[]>([]);

  // Fetch all assets once for sidebar counts
  useEffect(() => {
    fetch('/api/assets?pageSize=100')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setAllAssets(json.data.assets);
        }
      })
      .catch(() => {});
  }, []);

  // Sync when URL params change
  useEffect(() => {
    const q = searchParams.get('q') || '';
    const type = searchParams.get('type') as AssetType | 'all' | null;
    const sort = searchParams.get('sort');

    if (q) setSearch(q);
    if (type && (type === 'all' || ['skill','config','plugin','trigger','channel','template'].includes(type))) {
      setSelectedType(type);
    }
    if (sort && sortOptions.some(o => o.value === sort)) {
      setSortBy(sort);
    }
  }, [searchParams]);

  const fetchAssets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedType !== 'all') params.set('type', selectedType);
    if (selectedCategory !== '全部') params.set('category', selectedCategory);
    if (search) params.set('q', search);
    params.set('sort', sortBy);
    params.set('pageSize', '100');

    fetch(`/api/assets?${params.toString()}`)
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setAssets(json.data.assets);
          setTotal(json.data.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedType, selectedCategory, search, sortBy]);

  // Debounced fetch on filter change
  useEffect(() => {
    const timer = setTimeout(fetchAssets, 150);
    return () => clearTimeout(timer);
  }, [fetchAssets]);

  const typeFilters: { value: 'all' | AssetType; label: string; icon: string }[] = [
    { value: 'all', label: '全部', icon: '' },
    { value: 'template', label: '合集', icon: '' },
    { value: 'skill', label: '技能', icon: '' },
    { value: 'config', label: '配置', icon: '' },
    { value: 'plugin', label: '工具', icon: '' },
    { value: 'trigger', label: '触发器', icon: '' },
    { value: 'channel', label: '通信器', icon: '' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          探索 <span className="text-blue">Agent 资产</span>
        </h1>
        <p className="text-muted">发现社区分享的 Skills、Configs、Plugins、Triggers、Channels 和 Templates</p>
      </div>

      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索 Skills, Configs, Plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-white border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-blue/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-3 rounded-lg bg-white border border-card-border text-foreground focus:outline-none focus:border-blue/50 transition-colors cursor-pointer"
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:w-60 shrink-0">
          {/* Type Filter */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">资产类型</h3>
            <div className="space-y-1">
              {typeFilters.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setSelectedType(tf.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedType === tf.value
                      ? 'bg-blue/10 text-blue border border-blue/30'
                      : 'text-muted hover:bg-white hover:text-foreground border border-transparent'
                  }`}
                >
                  <span>{tf.icon}</span>
                  <span>{tf.label}</span>
                  <span className="ml-auto text-xs opacity-60">
                    {tf.value === 'all' ? allAssets.length : allAssets.filter(a => a.type === tf.value).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">分类</h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {categories.map(cat => {
                const count = cat === '全部' ? allAssets.length : allAssets.filter(a => a.category === cat).length;
                if (cat !== '全部' && count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all ${
                      selectedCategory === cat
                        ? 'bg-white text-blue'
                        : 'text-muted hover:bg-white hover:text-foreground'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="text-xs opacity-50">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Results Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted">
              {loading ? (
                '加载中...'
              ) : (
                <>
                  找到 <span className="text-blue font-semibold">{total}</span> 个资产
                  {search && <span className="ml-2">· 搜索: &quot;{search}&quot;</span>}
                </>
              )}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-card-border bg-white p-6 animate-pulse">
                  <div className="h-4 bg-surface rounded w-1/3 mb-4" />
                  <div className="h-5 bg-surface rounded w-2/3 mb-3" />
                  <div className="h-3 bg-surface rounded w-full mb-2" />
                  <div className="h-3 bg-surface rounded w-4/5" />
                </div>
              ))}
            </div>
          ) : assets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {assets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">未找到匹配的资产</h3>
              <p className="text-muted">试试调整筛选条件或搜索关键词</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            探索 <span className="text-blue">Agent 资产</span>
          </h1>
          <p className="text-muted">加载中...</p>
        </div>
      </div>
    }>
      <ExploreContent />
    </Suspense>
  );
}
