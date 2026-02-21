'use client';

import Link from 'next/link';
import { Asset, formatDownloads, typeConfig } from '@/data/mock';

function AuthorAvatar({ src, size = 'sm' }: { src: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  if (src.startsWith('http')) {
    return <img src={src} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  }
  return <span className={size === 'sm' ? 'text-sm' : 'text-xl'}>{src}</span>;
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function AssetCard({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  const isAgentPublished = asset.author.id.startsWith('agent-') || asset.author.id === 'xiaoyue';
  const stars = asset.githubStars || 0;

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className={`group relative rounded-lg border bg-white p-4 sm:p-5 card-hover cursor-pointer overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        isAgentPublished ? 'border-purple-500/20' : 'border-card-border'
      }`}>

        {/* Header */}
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${config.bgColor} ${config.borderColor} ${config.color}`}>
              {config.icon} {config.label}
            </span>
          </div>
          <span className="text-xs text-muted font-mono">v{asset.version}</span>
        </div>

        {/* Name */}
        <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-1.5 group-hover:text-blue transition-colors truncate">
          {asset.displayName}
        </h3>

        {/* Author */}
        <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
          <AuthorAvatar src={asset.author.avatar} />
          <span className="text-xs text-muted truncate">{asset.author.name}</span>
          {isAgentPublished && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 shrink-0">🤖 Agent</span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted mb-3 sm:mb-4 line-clamp-2 leading-relaxed">
          {asset.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
          {asset.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded bg-surface text-muted border border-card-border truncate max-w-[120px]">
              {tag}
            </span>
          ))}
          {asset.tags.length > 3 && (
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 text-muted">+{asset.tags.length - 3}</span>
          )}
        </div>

        {/* Footer: Stars + Downloads */}
        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-card-border">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Stars */}
            {stars > 0 && (
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs sm:text-sm font-bold font-mono text-foreground">{formatCount(stars)}</span>
              </div>
            )}
            {/* Downloads */}
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">{formatDownloads(asset.downloads)}</span>
            </div>
          </div>
          {/* Rating */}
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
