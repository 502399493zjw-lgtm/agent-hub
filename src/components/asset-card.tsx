'use client';

import Link from 'next/link';
import { Asset, formatDownloads, typeConfig } from '@/data/mock';
import { useFavorites } from '@/hooks/use-favorites';
import { showToast } from '@/components/toast';

function InstallsBadge({ downloads }: { downloads: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg className="w-3.5 h-3.5 text-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      <span className="text-sm font-bold font-mono text-foreground">{formatDownloads(downloads)}</span>
      <span className="text-[10px] text-muted">安装</span>
    </div>
  );
}

export function AssetCard({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(asset.id);
  const isAgentPublished = asset.author.id.startsWith('agent-') || asset.author.id === 'xiaoyue';

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleFavorite(asset.id);
    showToast(added ? `❤️ 已收藏 ${asset.displayName}` : `已取消收藏 ${asset.displayName}`);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const installCmd = `seafood-market install ${asset.type}/@${asset.author.id}/${asset.name}`;
    navigator.clipboard.writeText(installCmd);
    showToast(`📋 已复制安装命令`);
  };

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className={`group relative rounded-lg border bg-white p-5 card-hover cursor-pointer overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        isAgentPublished ? 'border-purple-500/20' : 'border-card-border'
      }`}>

        {/* Favorite + Copy buttons (top-right, visible on hover) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={handleCopy}
            className="w-7 h-7 rounded-md bg-white/90 border border-card-border flex items-center justify-center text-muted hover:text-blue hover:border-blue/30 transition-colors backdrop-blur-sm"
            title="复制安装命令"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={handleFavorite}
            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors backdrop-blur-sm ${
              fav
                ? 'bg-red/10 border-red/30 text-red'
                : 'bg-surface/90 border-card-border text-muted hover:text-red hover:border-red/30'
            }`}
            title={fav ? '取消收藏' : '收藏'}
          >
            <svg className="w-3.5 h-3.5" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>

        {/* Always-visible heart indicator when favorited */}
        {fav && (
          <div className="absolute top-3 right-3 z-[5] group-hover:opacity-0 transition-opacity duration-200">
            <span className="text-red text-sm">❤️</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${config.bgColor} ${config.borderColor} ${config.color}`}>
              {config.icon} {config.label}
            </span>
          </div>
          <span className="text-xs text-muted font-mono">v{asset.version}</span>
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold mb-1.5 group-hover:text-blue transition-colors">
          {asset.displayName}
        </h3>

        {/* Author */}
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-sm">{asset.author.avatar}</span>
          <span className="text-xs text-muted">{asset.author.name}</span>
          {isAgentPublished && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">🤖 Agent</span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted mb-4 line-clamp-2 leading-relaxed">
          {asset.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {asset.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 rounded bg-surface text-muted border border-card-border">
              {tag}
            </span>
          ))}
          {asset.tags.length > 3 && (
            <span className="text-xs px-2 py-0.5 text-muted">+{asset.tags.length - 3}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-card-border">
          <InstallsBadge downloads={asset.downloads} />
          <div className="flex items-center gap-1 text-xs text-muted">
            {asset.rating > 0 && (
              <>
                <span className="text-yellow-400">★</span>
                <span>{asset.rating.toFixed(1)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
