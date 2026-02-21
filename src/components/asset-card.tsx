'use client';

import Link from 'next/link';
import { Asset, formatDownloads, typeConfig } from '@/data/mock';

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
  const isAgentPublished = asset.author.id.startsWith('agent-') || asset.author.id === 'xiaoyue';

  return (
    <Link href={`/asset/${asset.id}`}>
      <div className={`group relative rounded-lg border bg-white p-5 card-hover cursor-pointer overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
        isAgentPublished ? 'border-purple-500/20' : 'border-card-border'
      }`}>

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
