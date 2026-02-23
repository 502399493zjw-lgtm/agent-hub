'use client';

import Link from 'next/link';
import { Asset, formatDownloads, typeConfig } from '@/data/types';
import { LetterAvatar } from '@/components/letter-avatar';

function AuthorAvatar({ src, name, authorId, size = 'sm' }: { src: string; name: string; authorId: string; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const px = size === 'sm' ? 20 : 28;
  if (src?.startsWith('http') || src?.startsWith('/api/avatars/')) {
    return <img src={src} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  }
  return <LetterAvatar name={name} userId={authorId} size={px} className="rounded-full" />;
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

export function AssetCard({ asset }: { asset: Asset }) {
  const config = typeConfig[asset.type];
  const stars = asset.totalStars ?? asset.githubStars ?? 0;

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className="group relative rounded-lg border border-card-border bg-white p-4 sm:p-5 card-hover cursor-pointer overflow-hidden">

        {/* Header row: badge left, author right */}
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface text-ink-light border border-card-border">
            {config.icon ? `${config.icon} ` : ''}{config.label}
          </span>
          <Link
            href={`/user/${asset.author.id}`}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-[color] duration-150 shrink-0 ml-2"
            onClick={e => e.stopPropagation()}
          >
            <AuthorAvatar src={asset.author.avatar} name={asset.author.name} authorId={asset.author.id} />
            <span className="truncate max-w-[80px]">{asset.author.name}</span>
          </Link>
        </div>

        {/* Name */}
        <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1.5 sm:mb-2 group-hover:text-blue transition-[color] duration-150 truncate">
          {asset.displayName}
        </h3>

        {/* Description */}
        <p className="text-xs sm:text-sm text-muted mb-3 sm:mb-4 line-clamp-2 leading-relaxed break-words">
          {asset.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
          {(asset.tags ?? []).slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 rounded-full bg-surface text-muted border border-card-border truncate max-w-[120px]">
              {tag}
            </span>
          ))}
          {(asset.tags ?? []).length > 3 && (
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 text-muted">+{(asset.tags ?? []).length - 3}</span>
          )}
        </div>

        {/* Footer: Stars + Downloads — better visual separation */}
        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-card-border/80">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Stars */}
            {stars > 0 && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-bold font-mono text-foreground">{formatCount(stars)}</span>
              </div>
            )}
            {/* Downloads */}
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="text-sm font-bold font-mono text-foreground">{formatDownloads(asset.downloads)}</span>
            </div>
          </div>
          {/* Version */}
          <span className="text-xs text-muted font-mono">v{asset.version}</span>
        </div>
      </div>
    </Link>
  );
}
