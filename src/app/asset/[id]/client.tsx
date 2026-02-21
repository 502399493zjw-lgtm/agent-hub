'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { formatDownloads, typeConfig, Asset, Comment, Issue, FileNode } from '@/data/types';
import { useState } from 'react';
import { InstallDialog } from '@/components/install-dialog';
import { useAuth } from '@/lib/auth-context';

type TabId = 'overview' | 'files' | 'versions' | 'issues' | 'comments' | 'dependencies';

function AuthorAvatar({ src, size = 'md' }: { src: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : size === 'lg' ? 'w-10 h-10' : 'w-7 h-7';
  if (src.startsWith('http')) {
    return <img src={src} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  }
  return <span className={size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl'}>{src}</span>;
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'gold' | 'red' | 'green' | 'purple' | 'cyan' | 'amber' }) {
  const styles: Record<string, string> = {
    default: 'bg-surface text-muted border-card-border',
    gold: 'bg-blue/10 text-blue border-blue/30',
    red: 'bg-red/10 text-red border-red/30',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    cyan: 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30',
    amber: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${styles[variant]}`}>
      {children}
    </span>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="px-5 py-3 rounded-lg bg-white border border-blue/30 shadow-lg shadow-black/5 flex items-center gap-3">
        <span className="text-blue">✓</span>
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="text-muted hover:text-foreground ml-2">✕</button>
      </div>
    </div>
  );
}

/** Rewrite relative image/link paths in GitHub README to raw.githubusercontent.com URLs */
function rewriteGitHubReadmeUrls(readme: string, githubUrl?: string): string {
  if (!githubUrl) return readme;
  // Extract owner/repo from https://github.com/owner/repo
  const match = githubUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return readme;
  const ownerRepo = match[1].replace(/\.git$/, '');
  const rawBase = `https://raw.githubusercontent.com/${ownerRepo}/main`;
  const blobBase = `https://github.com/${ownerRepo}/blob/main`;

  return readme
    // ![alt](relative/path.png) → ![alt](raw url)
    .replace(/!\[([^\]]*)\]\((?!https?:\/\/|data:)([^)]+)\)/g, (_, alt, path) => {
      const clean = path.replace(/^\.\//, '');
      return `![${alt}](${rawBase}/${clean})`;
    })
    // [text](relative/path) → [text](blob url)  (non-image links)
    .replace(/(?<!!)\[([^\]]*)\]\((?!https?:\/\/|#|mailto:)([^)]+)\)/g, (_, text, path) => {
      const clean = path.replace(/^\.\//, '');
      return `[${text}](${blobBase}/${clean})`;
    })
    // <img src="relative/path"> → <img src="raw url">
    .replace(/(<img\s[^>]*src=["'])(?!https?:\/\/|data:)([^"']+)(["'])/g, (_, pre, path, post) => {
      const clean = path.replace(/^\.\//, '');
      return `${pre}${rawBase}/${clean}${post}`;
    });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getNodesAtPath(files: FileNode[], pathParts: string[]): FileNode[] {
  let current = files;
  for (const part of pathParts) {
    const dir = current.find(n => n.name === part && n.type === 'directory');
    if (dir && dir.children) {
      current = dir.children;
    } else {
      return [];
    }
  }
  return current;
}

function FileTree({ files }: { files: FileNode[] }) {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  const currentNodes = getNodesAtPath(files, currentPath);
  const sorted = [...currentNodes].sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  const handleClick = (node: FileNode) => {
    if (node.type === 'directory') {
      setCurrentPath(prev => [...prev, node.name]);
      setSelectedFile(null);
    } else if (node.content) {
      setSelectedFile(prev => prev?.name === node.name ? null : node);
    }
  };

  const navigateTo = (index: number) => {
    setCurrentPath(prev => prev.slice(0, index));
    setSelectedFile(null);
  };

  return (
    <div>
      {/* Breadcrumb */}
      {currentPath.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3 text-sm flex-wrap">
          <button onClick={() => navigateTo(0)} className="text-blue hover:underline font-medium">📁 root</button>
          {currentPath.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="text-muted">/</span>
              <button onClick={() => navigateTo(i + 1)} className={`${i === currentPath.length - 1 ? 'text-foreground font-medium' : 'text-blue hover:underline'}`}>{part}</button>
            </span>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="rounded-lg bg-white border border-card-border overflow-hidden">
        {currentPath.length > 0 && (
          <button onClick={() => { setCurrentPath(prev => prev.slice(0, -1)); setSelectedFile(null); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm border-b border-card-border hover:bg-card-hover transition-colors text-muted">
            <span>📁</span>
            <span>..</span>
          </button>
        )}
        {sorted.map((node, i) => (
          <button key={node.name} onClick={() => handleClick(node)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
              i < sorted.length - 1 || selectedFile ? 'border-b border-card-border' : ''
            } ${node.type === 'directory' || node.content ? 'hover:bg-card-hover cursor-pointer' : 'cursor-default'} ${
              selectedFile?.name === node.name ? 'bg-blue/5' : ''
            }`}>
            <span>{node.type === 'directory' ? '📁' : '📄'}</span>
            <span className={`flex-1 ${node.type === 'directory' ? 'text-blue font-medium' : 'text-foreground'}`}>{node.name}</span>
            {node.type === 'file' && node.size !== undefined && (
              <span className="text-xs text-muted font-mono">{formatFileSize(node.size)}</span>
            )}
            {node.type === 'directory' && (
              <span className="text-xs text-muted">→</span>
            )}
          </button>
        ))}
        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-muted text-sm">空目录</div>
        )}
      </div>

      {/* File content preview */}
      {selectedFile && selectedFile.content && (
        <div className="mt-4 rounded-lg bg-white border border-card-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface border-b border-card-border">
            <span className="text-xs">📄</span>
            <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
            {selectedFile.size !== undefined && (
              <span className="text-xs text-muted font-mono ml-auto">{formatFileSize(selectedFile.size)}</span>
            )}
          </div>
          <pre className="p-4 text-sm font-mono text-foreground overflow-x-auto bg-surface/50 leading-relaxed">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

interface AssetDetailClientProps {
  id: string;
  initialAsset: Asset | null;
  initialComments: Comment[];
  initialIssues: Issue[];
  initialAllAssets: Asset[];
}

export default function AssetDetailClient({ id, initialAsset, initialComments, initialIssues, initialAllAssets }: AssetDetailClientProps) {
  const { user } = useAuth();
  const hasInviteAccess = !!user?.inviteCode;
  const [asset] = useState<Asset | null>(initialAsset);
  const [allAssets] = useState<Asset[]>(initialAllAssets);
  const [copied, setCopied] = useState(false);
  const [rawCopied, setRawCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [toast, setToast] = useState<string | null>(null);
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [serverComments] = useState<Comment[]>(initialComments);
  const [serverIssues] = useState<Issue[]>(initialIssues);
  const [commentText, setCommentText] = useState('');
  const [commenterType, setCommenterType] = useState<'user' | 'agent'>('user');
  const [issueFilter, setIssueFilter] = useState<'all' | 'open' | 'closed'>('all');

  if (!asset) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold mb-2">资产未找到</h1>
        <p className="text-muted mb-6">该资产可能已被移除或链接无效</p>
        <Link href="/explore" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue/10 text-blue border border-blue/30 hover:bg-blue/20 transition-colors">
          ← 返回探索
        </Link>
      </div>
    );
  }

  const config = typeConfig[asset.type];
  const allComments = [...localComments, ...serverComments];
  const issuesList = serverIssues;
  const related = allAssets
    .filter(a => a.id !== asset.id && (a.type === asset.type || a.tags.some(t => asset.tags.includes(t))))
    .slice(0, 4);
  const depAssets = asset.dependencies.map(depId => allAssets.find(a => a.id === depId)).filter(Boolean) as Asset[];
  const dependents = allAssets.filter(a => a.dependencies.includes(asset.id));
  const installCmd = `seafood-market install ${asset.type}/@${asset.author.id}/${asset.name}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRawUrl = () => {
    const url = `${window.location.origin}/api/assets/${asset.id}/raw`;
    navigator.clipboard.writeText(url);
    setRawCopied(true);
    setTimeout(() => setRawCopied(false), 2000);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };


  const handlePostComment = () => {
    if (!commentText.trim()) return;
    const nc: Comment = {
      id: `local-${Date.now()}`, assetId: asset.id,
      userId: commenterType === 'agent' ? 'agent-local' : 'u-local',
      userName: commenterType === 'agent' ? 'MyAgent Bot' : '当前用户',
      userAvatar: commenterType === 'agent' ? '🤖' : '👤',
      content: commentText.trim(), rating: 0,
      createdAt: new Date().toISOString().slice(0, 10), commenterType,
    };
    setLocalComments(prev => [nc, ...prev]);
    setCommentText('');
    showToast('评论发布成功！');
  };

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: '📖' },
    { id: 'files', label: '文件', icon: '📂', count: asset.files?.length },
    { id: 'versions', label: 'Versions', icon: '📦', count: asset.versions.length },
    { id: 'dependencies', label: '依赖图', icon: '🔗', count: depAssets.length + dependents.length },
    { id: 'issues', label: 'Issues', icon: '🐛', count: issuesList.length },
    { id: 'comments', label: '评论', icon: '💬', count: allComments.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href="/" className="hover:text-blue transition-colors">首页</Link>
        <span>/</span>
        <Link href="/explore" className="hover:text-blue transition-colors">探索</Link>
        <span>/</span>
        <span className="text-foreground">{asset.displayName}</span>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className={`text-sm px-3 py-1 rounded-full border ${config.bgColor} ${config.borderColor} ${config.color}`}>
            {config.icon} {config.label}
          </span>
          <span className="text-sm text-muted font-mono">v{asset.version}</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-3">
          <h1 className="text-3xl sm:text-4xl font-bold">{asset.displayName}</h1>
          <div className="flex items-center gap-2">
            <InstallDialog asset={asset} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <Link href={`/user/${asset.author.id}`} className="flex items-center gap-2 hover:text-blue transition-colors">
            <AuthorAvatar src={asset.author.avatar} />
            <span className="text-sm font-medium">{asset.author.name}</span>
          </Link>
          {(asset.githubStars ?? 0) > 0 && asset.githubUrl && (
            <a href={asset.githubUrl} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-card-border bg-surface hover:bg-card-hover transition-colors text-sm">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-semibold text-foreground">{asset.githubStars}</span>
            </a>
          )}
          <span className="flex items-center gap-1 text-sm text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {formatDownloads(asset.downloads)} 次下载
          </span>
        </div>
        <p className="text-lg text-muted leading-relaxed">{asset.longDescription}</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-card-border overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-blue text-blue' : 'border-transparent text-muted hover:text-foreground'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
            {t.count !== undefined && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-blue/10 text-blue' : 'bg-surface text-muted'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {activeTab === 'overview' && (
            <>
              <div className="mb-8 p-4 rounded-lg bg-white border border-card-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue">⚡ 安装命令</span>
                  <button onClick={handleCopy} className="text-xs px-3 py-1 rounded-lg bg-blue/10 text-blue border border-blue/30 hover:bg-blue/20 transition-colors">
                    {copied ? '✓ 已复制' : '复制'}
                  </button>
                </div>
                <code className="block text-sm font-mono text-foreground bg-surface p-3 rounded-lg overflow-x-auto">{installCmd}</code>
              </div>

              <div className="mb-8 p-4 rounded-lg bg-surface border border-card-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🤖</span>
                  <h3 className="font-semibold text-sm">Agent 直读</h3>
                  <span className="text-xs text-muted">— Agent 可以直接阅读并使用此资产</span>
                </div>
                <p className="text-xs text-muted mb-3">
                  此资产可被任何 AI Agent 直接读取。Agent 通过访问下方链接获取完整内容，无需安装，即可在此基础上理解、修改和创作。
                </p>
                <div className="flex items-center gap-2 bg-background rounded-md p-2 border border-card-border/50">
                  <code className="text-xs text-blue flex-1 truncate">
                    curl {typeof window !== 'undefined' ? window.location.origin : ''}/api/assets/{asset.id}/raw
                  </code>
                  <button onClick={copyRawUrl} className="text-xs px-2 py-1 rounded bg-blue/10 text-blue hover:bg-blue/20 transition-colors flex-shrink-0">
                    {rawCopied ? '✓ 已复制' : '复制'}
                  </button>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">标签</h3>
                <div className="flex flex-wrap gap-2">
                  {asset.tags.map(tag => (
                    <span key={tag} className="text-sm px-3 py-1 rounded-lg bg-surface text-muted border border-card-border hover:border-blue/30 hover:text-blue transition-colors cursor-pointer">#{tag}</span>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">README</h3>
                <div className="prose max-w-none p-3 sm:p-6 rounded-lg bg-white border border-card-border overflow-x-auto">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    components={{
                      h1: ({ children }) => <h1 className="text-2xl font-bold text-blue mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-bold text-foreground mt-8 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-semibold text-foreground mt-6 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-muted leading-relaxed mb-4">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-1 text-muted">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-1 text-muted">{children}</ol>,
                      li: ({ children }) => <li className="text-muted">{children}</li>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-blue/50 pl-4 text-muted italic my-4">{children}</blockquote>,
                      code: ({ className, children }) => {
                        const isBlock = className?.includes('language-');
                        return isBlock ? (
                          <pre className="bg-surface p-4 rounded-lg overflow-x-auto my-4">
                            <code className="text-sm font-mono text-foreground">{children}</code>
                          </pre>
                        ) : (
                          <code className="bg-surface px-1.5 py-0.5 rounded text-blue text-sm font-mono">{children}</code>
                        );
                      },
                      pre: ({ children }) => <>{children}</>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="w-full text-sm border-collapse border border-card-border rounded-lg overflow-hidden">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-surface">{children}</thead>,
                      th: ({ children }) => <th className="px-4 py-2 text-left font-semibold text-foreground border border-card-border">{children}</th>,
                      td: ({ children }) => <td className="px-4 py-2 text-muted border border-card-border">{children}</td>,
                      a: ({ href, children }) => <a href={href} className="text-blue hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      img: ({ src, alt }) => (
                        <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg my-4 border border-card-border" />
                      ),
                      strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
                      hr: () => <hr className="border-card-border my-6" />,
                    }}
                  >
                    {rewriteGitHubReadmeUrls(asset.readme, asset.githubUrl)}
                  </ReactMarkdown>
                </div>
              </div>

              {related.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">相关推荐</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {related.map(r => (
                      <Link key={r.id} href={`/asset/${r.id}`} className="block p-4 rounded-lg bg-white border border-card-border hover:border-blue/30 transition-colors group">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs">{typeConfig[r.type].icon}</span>
                          <span className="text-sm font-medium group-hover:text-blue transition-colors">{r.displayName}</span>
                          <span className="ml-auto text-xs text-muted font-mono">v{r.version}</span>
                        </div>
                        <p className="text-xs text-muted line-clamp-1">{r.description}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'files' && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">文件浏览</h3>
              {asset.files && asset.files.length > 0 ? (
                <FileTree files={asset.files} />
              ) : (
                <div className="text-center py-12 rounded-lg bg-white border border-card-border">
                  <div className="text-4xl mb-2">📂</div>
                  <p className="text-muted">暂无文件</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'versions' && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">版本历史</h3>
              {asset.versions.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-card-border" />
                  <div className="space-y-6">
                    {asset.versions.map((v, i) => (
                      <div key={v.version} className="relative pl-10">
                        <div className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 ${i === 0 ? 'bg-blue border-blue shadow-sm shadow-blue/30' : 'bg-surface border-card-border'}`} />
                        <div className="p-4 rounded-lg bg-white border border-card-border">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`font-mono font-semibold ${i === 0 ? 'text-blue' : 'text-foreground'}`}>v{v.version}</span>
                            {i === 0 && <Badge variant="gold">最新</Badge>}
                            <span className="text-xs text-muted ml-auto">{v.date}</span>
                          </div>
                          <p className="text-sm text-muted leading-relaxed">{v.changelog}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 rounded-lg bg-white border border-card-border">
                  <div className="text-4xl mb-2">📦</div><p className="text-muted">暂无版本记录</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'issues' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">Issues ({issuesList.length})</h3>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setIssueFilter('all')} className={`px-2.5 py-1 rounded-lg border transition-colors ${issueFilter === 'all' ? 'bg-blue/10 text-blue border-blue/30' : 'border-card-border text-muted hover:text-foreground'}`}>全部 ({issuesList.length})</button>
                  <button onClick={() => setIssueFilter('open')} className={`px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${issueFilter === 'open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'border-card-border text-muted hover:text-foreground'}`}><span className="w-2 h-2 rounded-full bg-emerald-400" />需解决 ({issuesList.filter(i => i.status === 'open').length})</button>
                  <button onClick={() => setIssueFilter('closed')} className={`px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${issueFilter === 'closed' ? 'bg-muted/10 text-muted border-muted/30' : 'border-card-border text-muted hover:text-foreground'}`}><span className="w-2 h-2 rounded-full bg-muted" />已解决 ({issuesList.filter(i => i.status === 'closed').length})</button>
                </div>
              </div>
              {(() => {
                const filtered = issueFilter === 'all' ? issuesList : issuesList.filter(i => i.status === issueFilter);
                return filtered.length > 0 ? (
                <div className="space-y-3">
                  {filtered.map(issue => (
                    <div key={issue.id} className="p-4 rounded-lg bg-white border border-card-border hover:border-card-hover transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${issue.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/10 text-muted'}`}>
                          {issue.status === 'open'
                            ? <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="7" /></svg>
                            : <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z" /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-foreground">{issue.title}</span>
                            {issue.labels.map(l => <Badge key={l} variant={l === 'bug' ? 'red' : l === 'feature-request' ? 'purple' : l === 'enhancement' ? 'cyan' : l === 'performance' ? 'amber' : 'default'}>{l}</Badge>)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span className="flex items-center gap-1"><AuthorAvatar src={issue.authorAvatar} size="sm" /> {issue.authorName}
                              {issue.authorType === 'agent' && <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 rounded px-1">🤖</span>}
                            </span>
                            <span>·</span><span>{issue.createdAt}</span><span>·</span><span>💬 {issue.commentCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-lg bg-white border border-card-border">
                  <div className="text-4xl mb-2">✅</div><p className="text-muted">{issueFilter === 'all' ? '暂无 Issue，一切运行良好！' : issueFilter === 'open' ? '没有待解决的 Issue' : '没有已解决的 Issue'}</p>
                </div>
              );
              })()}
            </div>
          )}

          {activeTab === 'dependencies' && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">依赖关系图</h3>
              <div className="space-y-6">
                <div className="p-5 rounded-lg bg-white border border-card-border">
                  <div className="text-xs text-muted uppercase tracking-wider mb-3">⬆️ 上游依赖 ({depAssets.length})</div>
                  {depAssets.length > 0 ? (
                    <div className="space-y-2">
                      {depAssets.map(dep => (
                        <Link key={dep.id} href={`/asset/${dep.id}`} className="group flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${typeConfig[dep.type].bgColor} border ${typeConfig[dep.type].borderColor}`}>
                            {typeConfig[dep.type].icon}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-semibold group-hover:text-blue transition-colors">{dep.displayName}</span>
                            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                              <span className="flex items-center gap-1"><AuthorAvatar src={dep.author.avatar} size="sm" /> {dep.author.name}</span>
                              <span>v{dep.version}</span>
                            </div>
                          </div>
                          <Badge variant="cyan">上游</Badge>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted py-2">无上游依赖 — 完全独立运行 ✨</p>
                  )}
                </div>

                {(depAssets.length > 0 || dependents.length > 0) && (
                  <div className="p-5 rounded-lg bg-white border border-card-border">
                    <div className="text-xs text-muted uppercase tracking-wider mb-4">🔗 可视化关系</div>
                    <div className="flex flex-col items-center gap-2">
                      {depAssets.length > 0 && (
                        <>
                          <div className="flex flex-wrap justify-center gap-3">
                            {depAssets.map(dep => (
                              <Link key={dep.id} href={`/asset/${dep.id}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue/50 ${typeConfig[dep.type].bgColor} ${typeConfig[dep.type].borderColor} ${typeConfig[dep.type].color}`}>
                                {typeConfig[dep.type].icon} {dep.name}
                              </Link>
                            ))}
                          </div>
                          <svg width="40" height="30" className="text-blue/30">
                            <line x1="20" y1="0" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
                            <polygon points="16,22 24,22 20,28" fill="currentColor" />
                          </svg>
                        </>
                      )}
                      <div className="px-4 py-2 rounded-lg border-2 border-blue/50 bg-blue/10 text-blue font-semibold text-sm">
                        {config.icon} {asset.name}
                      </div>
                      {dependents.length > 0 && (
                        <>
                          <svg width="40" height="30" className="text-blue/30">
                            <line x1="20" y1="0" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
                            <polygon points="16,22 24,22 20,28" fill="currentColor" />
                          </svg>
                          <div className="flex flex-wrap justify-center gap-3">
                            {dependents.map(dep => (
                              <Link key={dep.id} href={`/asset/${dep.id}`}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:border-blue/50 ${typeConfig[dep.type].bgColor} ${typeConfig[dep.type].borderColor} ${typeConfig[dep.type].color}`}>
                                {typeConfig[dep.type].icon} {dep.name}
                              </Link>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-5 rounded-lg bg-white border border-card-border">
                  <div className="text-xs text-muted uppercase tracking-wider mb-3">⬇️ 下游消费者 ({dependents.length})</div>
                  {dependents.length > 0 ? (
                    <div className="space-y-2">
                      {dependents.map(dep => (
                        <Link key={dep.id} href={`/asset/${dep.id}`} className="group flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${typeConfig[dep.type].bgColor} border ${typeConfig[dep.type].borderColor}`}>
                            {typeConfig[dep.type].icon}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-semibold group-hover:text-blue transition-colors">{dep.displayName}</span>
                            <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                              <span className="flex items-center gap-1"><AuthorAvatar src={dep.author.avatar} size="sm" /> {dep.author.name}</span>
                              <span>v{dep.version}</span>
                            </div>
                          </div>
                          <Badge variant="amber">下游</Badge>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted py-2">暂无下游消费者</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'comments' && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">评论 ({allComments.length})</h3>

              {/* Comment form - gated by invite code */}
              {user && !hasInviteAccess ? (
                <div className="mb-6 p-5 rounded-lg bg-amber-50 border border-amber-200 text-center">
                  <p className="text-sm text-amber-700 mb-3">🎟️ 需要激活邀请码才能发表评论</p>
                  <Link href="/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors">
                    去激活邀请码
                  </Link>
                </div>
              ) : (
              <div className="mb-6 p-5 rounded-lg bg-white border border-card-border">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-semibold">发表评论</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => setCommenterType('user')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${commenterType === 'user' ? 'bg-blue/10 text-blue border-blue/30' : 'border-card-border text-muted hover:text-foreground'}`}>👤 用户</button>
                    <button onClick={() => setCommenterType('agent')} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${commenterType === 'agent' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : 'border-card-border text-muted hover:text-foreground'}`}>🤖 Agent</button>
                  </div>
                </div>
                <div className="mb-3">
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    placeholder={commenterType === 'agent' ? '以 Agent 身份发表评论... (支持 Markdown 格式)' : '写下你的评论... (支持 Markdown 格式)'} rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors resize-none text-sm font-mono" />
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted">
                    <span>💡 支持 Markdown：**粗体**、*斜体*、`代码`、- 列表</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted">
                    {commentText.trim().length > 0 && <span>{commentText.trim().length} 字符</span>}
                  </div>
                  <button onClick={handlePostComment} disabled={!commentText.trim()}
                    className="px-5 py-2 rounded-lg bg-blue text-white font-semibold text-sm hover:bg-blue-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed">发布评论</button>
                </div>
              </div>
              )}
              {allComments.length > 0 ? (
                <div className="space-y-4">
                  {allComments.map(c => {
                    const isA = c.commenterType === 'agent';
                    return (
                      <div key={c.id} className={`p-4 rounded-lg bg-white border ${isA ? 'border-purple-500/30 shadow-sm shadow-purple-500/5' : 'border-card-border'}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xl">{c.userAvatar}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{c.userName}</span>
                            {isA && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">🤖 Agent</span>}
                            <span className="text-xs text-muted">{c.createdAt}</span>
                          </div>
                        </div>
                        <p className={`text-sm leading-relaxed ${isA ? 'text-purple-600/80' : 'text-muted'}`}>{c.content}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 rounded-lg bg-white border border-card-border">
                  <div className="text-4xl mb-2">💬</div><p className="text-muted">还没有评论，来留下第一条吧</p>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-6">
            <div className="p-5 rounded-lg bg-white border border-card-border">
              <h3 className="text-sm font-semibold mb-4">📊 安装统计</h3>
              <div className="text-center mb-2">
                <span className="text-4xl font-bold text-blue">{formatDownloads(asset.downloads)}</span>
                <span className="text-sm text-muted ml-1">次安装</span>
              </div>
              {asset.rating > 0 && (
                <div className="text-center text-sm text-muted">
                  <span className="text-yellow-400">★</span> {asset.rating.toFixed(1)} ({asset.ratingCount} 评价)
                </div>
              )}
            </div>

            <div className="p-5 rounded-lg bg-white border border-card-border">
              <h3 className="text-sm font-semibold mb-4">资产信息</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted">版本</span><span className="font-mono">{asset.version}</span></div>
                <div className="flex justify-between"><span className="text-muted">分类</span><span>{asset.category}</span></div>
                <div className="flex justify-between"><span className="text-muted">创建时间</span><span>{asset.createdAt}</span></div>
                <div className="flex justify-between"><span className="text-muted">最后更新</span><span>{asset.updatedAt}</span></div>
                <div className="flex justify-between"><span className="text-muted">下载量</span><span className="text-blue font-semibold">{asset.downloads.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted">Issues</span><span>{asset.issueCount}</span></div>
              </div>
              <div className="mt-5">
                <InstallDialog asset={asset} />
              </div>
            </div>

            {depAssets.length > 0 && (
              <div className="p-5 rounded-lg bg-white border border-card-border">
                <h3 className="text-sm font-semibold mb-3">依赖 ({depAssets.length})</h3>
                <div className="space-y-2">
                  {depAssets.map(d => d && (
                    <Link key={d.id} href={`/asset/${d.id}`} className="flex items-center gap-2 text-sm hover:text-blue transition-colors">
                      <span className="text-xs">{typeConfig[d.type].icon}</span>
                      <span className="truncate">{d.displayName}</span>
                      <span className="ml-auto text-xs text-muted font-mono">v{d.version}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="p-5 rounded-lg bg-white border border-card-border">
              <h3 className="text-sm font-semibold mb-4">📖 安装指南</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue/10 text-blue text-xs font-bold flex items-center justify-center mt-0.5">1</div>
                  <div>
                    <p className="text-sm font-medium mb-1">安装 Seafood Market CLI</p>
                    <code className="block text-xs font-mono text-muted bg-surface p-2 rounded-lg">npm install -g seafood-market</code>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue/10 text-blue text-xs font-bold flex items-center justify-center mt-0.5">2</div>
                  <div>
                    <p className="text-sm font-medium mb-1">安装此{config.label}</p>
                    <code className="block text-xs font-mono text-muted bg-surface p-2 rounded-lg">{installCmd}</code>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue/10 text-blue text-xs font-bold flex items-center justify-center mt-0.5">3</div>
                  <div>
                    <p className="text-sm font-medium mb-1">重启 Agent 生效</p>
                    <code className="block text-xs font-mono text-muted bg-surface p-2 rounded-lg">seafood-market gateway restart</code>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-card-border">
                <p className="text-xs text-muted">💡 安装后在 Agent 对话中即可使用新能力，也可通过 <code className="bg-surface px-1 rounded text-blue">seafood-market status</code> 查看已安装列表。</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}