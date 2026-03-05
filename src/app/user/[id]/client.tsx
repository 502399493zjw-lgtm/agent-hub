'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Asset, formatDownloads, Comment, Issue } from '@/data/types';
import { AssetCard } from '@/components/asset-card';
import { LetterAvatar } from '@/components/letter-avatar';

// ── Types ──────────────────────────────────────────

interface ProfileData {
  id: string;
  name: string;
  avatar: string;
  bio: string;
  provider: string;
  providerName: string | null;
  providerAvatar: string | null;
  joinedAt: string;
  reputation: number;
  shrimpCoins: number;
  role: string;
  type: string;
  isBound: boolean;
  inviteCode: string | null;
  stats: {
    assetCount: number;
    totalDownloads: number;
    totalStars: number;
    totalComments: number;
    totalIssues: number;
  };
}

interface CoinEvent {
  id: number;
  userId: string;
  coinType: string;
  amount: number;
  event: string;
  refId: string | null;
  refName?: string | null;
  balanceAfter: number;
  createdAt: string;
}

interface UserProfileClientProps {
  profile: ProfileData;
  publishedAssets: Asset[];
  isOwn: boolean;
}

// ── Helpers ────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 0) return '刚刚';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '昨天';
  if (days < 30) return `${days}天前`;
  return formatDate(iso);
}

function eventToDisplay(event: CoinEvent): { icon: string; text: string } {
  const name = event.refName;
  switch (event.event) {
    case 'publish_asset':
      return { icon: '', text: name ? `发布了资产「${name}」` : '发布了资产' };
    case 'write_comment':
      return { icon: '', text: name ? `评论了「${name}」` : '发表了评论' };
    case 'submit_issue':
      return { icon: '', text: name ? `向「${name}」提交了 Issue` : '提交了 Issue' };
    case 'register_bonus':
      return { icon: '', text: '加入了水产市场' };
    case 'install_asset':
    case 'asset_installed':
      return { icon: '', text: name ? `安装了「${name}」` : '安装了资产' };
    default:
      if (event.coinType === 'reputation') {
        return { icon: '', text: `获得 +${event.amount} 声望` };
      }
      return { icon: '', text: `获得 +${event.amount} 龙虾币` };
  }
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'github') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    );
  }
  if (provider === 'google') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    );
  }
  if (provider === 'feishu') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path d="M3.947 6.137c1.262-1.089 6.758-5.478 7.222-3.748.464 1.73-3.59 7.952-3.59 7.952s7.595-5.313 8.232-3.274c.638 2.04-5.106 7.873-5.106 7.873s6.65-3.637 6.903-1.726c.254 1.911-7.95 7.665-7.95 7.665L3 15.48l.947-9.343z" fill="#3370FF"/>
        <path d="M9.657 14.94s5.75-5.833 6.388-3.794c.638 2.04-5.106 7.873-5.106 7.873s6.65-3.637 6.903-1.726c.254 1.911-7.95 7.665-7.95 7.665L3 19.56" fill="#00D6B9" fillOpacity="0.8"/>
      </svg>
    );
  }
  if (provider === 'email') {
    return <span className="text-sm">✉️</span>;
  }
  return <span className="text-sm">🔗</span>;
}

// ── Avatar with LetterAvatar fallback ──────────────

function ProfileAvatar({ src, name, userId, size = 'xl' }: { src: string; name: string; userId: string; size?: 'lg' | 'xl' }) {
  const sizeClass = size === 'xl' ? 'w-28 h-28' : 'w-20 h-20';
  const px = size === 'xl' ? 112 : 80;

  if (src?.startsWith('http') || src?.startsWith('/api/avatars/') || src?.startsWith('data:')) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-lg object-cover border border-card-border`}
        referrerPolicy="no-referrer"
      />
    );
  }
  return <LetterAvatar name={name} userId={userId} size={px} className="rounded-lg" />;
}

// ── StatCard ───────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center p-4 rounded-lg bg-surface/50 border border-card-border">
      <div className="text-xl font-bold font-mono text-foreground">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

// ── Activity Timeline ──────────────────────────────

function ActivityTimeline({ userId }: { userId: string }) {
  const [events, setEvents] = useState<CoinEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}/activity?page=${page}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setEvents(data.events);
          setTotal(data.total);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId, page]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">加载动态...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">暂无动态</p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="space-y-1">
        {events.map(ev => {
          const { icon, text } = eventToDisplay(ev);
          return (
            <div key={ev.id} className="flex items-start gap-3 py-3 px-4 rounded-lg hover:bg-surface/50 transition-colors">
              {icon && <span className="text-lg mt-0.5 shrink-0">{icon}</span>}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{text}</p>
              </div>
              <span className="text-xs text-muted shrink-0 mt-0.5">{relativeTime(ev.createdAt)}</span>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-card-border">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-card-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← 上一页
          </button>
          <span className="text-xs text-muted">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-card-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dashboard Data Tab (isOwn only) ────────────────

function DashboardTab({ userId, publishedAssets }: { userId: string; publishedAssets: Asset[] }) {
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard?authorId=${userId}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) {
          setAllComments(json.data.comments || []);
          setAllIssues(json.data.issues || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-2xl animate-pulse mb-2">📊</div>
        <p className="text-sm text-muted">加载数据...</p>
      </div>
    );
  }

  // TODO: Replace with real daily_stats data from API
  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const weekData = [0, 0, 0, 0, 0, 0, 0]; // Placeholder — wire up to /api/stats when ready
  const maxWeek = Math.max(...weekData, 1); // avoid division by zero

  return (
    <div className="space-y-6">
      {/* Download chart */}
      <div className="rounded-xl bg-white border border-card-border p-6">
        <h3 className="text-base font-bold mb-6">📈 近 7 天下载趋势</h3>
        <div className="flex items-end gap-3 h-40">
          {weekData.map((val, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted font-mono">{formatDownloads(val)}</span>
              <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: `${(val / maxWeek) * 100}%` }}>
                <div
                  className="absolute inset-0 rounded-t-md"
                  style={{ background: 'linear-gradient(to top, rgba(255,215,0,0.3), rgba(255,215,0,0.7))', boxShadow: '0 0 10px rgba(255,215,0,0.2)' }}
                />
              </div>
              <span className="text-[10px] text-muted">{weekDays[i]}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-card-border flex items-center justify-between text-xs text-muted">
          <span>本周总计：<span className="text-foreground font-mono font-bold">{formatDownloads(weekData.reduce((a, b) => a + b, 0))}</span></span>
          <span>日均：<span className="text-foreground font-mono">{formatDownloads(Math.round(weekData.reduce((a, b) => a + b, 0) / 7))}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Comments */}
        <div className="rounded-xl bg-white border border-card-border p-6">
          <h3 className="text-base font-bold mb-4">💬 收到的评论</h3>
          <div className="space-y-3">
            {allComments.length > 0 ? (
              allComments.slice(0, 10).map(comment => {
                const isAgent = comment.commenterType === 'agent';
                const asset = publishedAssets.find(a => a.id === comment.assetId);
                return (
                  <div key={comment.id} className={`p-3 rounded-lg border ${isAgent ? 'border-purple-500/20 bg-purple-500/5' : 'border-card-border bg-white/50'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm">{comment.userAvatar}</span>
                      <span className={`text-xs font-medium ${isAgent ? 'text-purple-400' : 'text-foreground'}`}>
                        {comment.userName}{isAgent && <span className="ml-1 text-[10px] text-purple-400/70">🤖</span>}
                      </span>
                      <span className="text-[10px] text-muted ml-auto">{relativeTime(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted line-clamp-2 mb-1">{comment.content}</p>
                    {asset && (
                      <Link href={`/asset/${asset.id}`} className="text-[10px] text-blue hover:text-blue-dim transition-colors">
                        → {asset.displayName}
                      </Link>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted text-center py-4">暂无评论</p>
            )}
          </div>
        </div>

        {/* Recent Issues */}
        <div className="rounded-xl bg-white border border-card-border p-6">
          <h3 className="text-base font-bold mb-4">🐛 收到的 Issue</h3>
          <div className="space-y-3">
            {allIssues.length > 0 ? (
              allIssues.slice(0, 10).map(issue => {
                const isOpen = issue.status === 'open';
                const asset = publishedAssets.find(a => a.id === issue.assetId);
                return (
                  <div key={issue.id} className="p-3 rounded-lg border border-card-border bg-white/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500' : 'bg-muted'}`} />
                      <span className="text-xs font-medium text-foreground flex-1 truncate">{issue.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isOpen ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-muted/10 text-muted border border-card-border'}`}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <span>{issue.authorName}</span>
                      <span>·</span>
                      <span>{relativeTime(issue.createdAt)}</span>
                      <span>·</span>
                      <span>💬 {issue.commentCount}</span>
                    </div>
                    {asset && (
                      <Link href={`/asset/${asset.id}`} className="text-[10px] text-blue hover:text-blue-dim transition-colors mt-1 inline-block">
                        → {asset.displayName}
                      </Link>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted text-center py-4">暂无 Issue</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Edit Profile Modal ─────────────────────────────

function EditProfileModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: ProfileData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const isEmail = profile.provider === 'email';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('文件大小不能超过 2MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPEG、PNG、WebP 格式');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      // Upload avatar first if changed
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const res = await fetch(`/api/users/${profile.id}/avatar`, { method: 'POST', body: fd });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || '头像上传失败');
          setSaving(false);
          return;
        }
      }

      // Update profile
      const updates: Record<string, string> = {};
      if (isEmail && name !== profile.name) updates.name = name;
      if (bio !== profile.bio) updates.bio = bio;

      if (Object.keys(updates).length > 0) {
        const res = await fetch(`/api/users/${profile.id}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || '保存失败');
          setSaving(false);
          return;
        }
      }

      onSaved();
    } catch {
      setError('网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg border border-card-border w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">✏️ 编辑资料</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors text-xl">✕</button>
        </div>

        {/* Avatar upload (email users only) */}
        {isEmail && (
          <div className="mb-5">
            <label className="text-sm font-medium text-foreground block mb-2">头像</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-card-border shrink-0">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ProfileAvatar src={profile.avatar} name={profile.name} userId={profile.id} size="lg" />
                )}
              </div>
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="text-sm px-3 py-1.5 rounded-lg border border-card-border hover:bg-surface transition-colors"
                >
                  选择图片
                </button>
                <p className="text-[10px] text-muted mt-1">JPEG/PNG/WebP, 最大 2MB</p>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
        )}

        {/* Name (email users only) */}
        {isEmail && (
          <div className="mb-5">
            <label className="text-sm font-medium text-foreground block mb-2">昵称</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={30}
              className="w-full px-3 py-2 rounded-lg border border-card-border bg-surface text-sm text-foreground focus:outline-none focus:border-blue/50 transition-colors"
              placeholder="2-30 个字符"
            />
          </div>
        )}

        {/* Bio (all users) */}
        <div className="mb-5">
          <label className="text-sm font-medium text-foreground block mb-2">个人简介</label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-card-border bg-surface text-sm text-foreground focus:outline-none focus:border-blue/50 resize-none transition-colors"
            placeholder="介绍一下自己..."
          />
          <p className="text-[10px] text-muted text-right mt-1">{bio.length}/200</p>
        </div>

        {error && (
          <p className="text-sm text-red mb-4 bg-red/5 border border-red/20 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-card-border hover:bg-surface transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue text-white hover:bg-blue-dim disabled:opacity-60 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────

type TabKey = 'assets' | 'activity' | 'data' | 'about' | 'invite';

export default function UserProfileClient({ profile, publishedAssets, isOwn }: UserProfileClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('assets');
  const [showEditModal, setShowEditModal] = useState(false);

  // Invite code state
  const [inviteCode, setInviteCode] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [inviteError, setInviteError] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activatedCode, setActivatedCode] = useState(profile.inviteCode || '');
  const [userCodes, setUserCodes] = useState<{ code: string; useCount: number; maxUses: number }[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch invite codes when invite tab is active
  useEffect(() => {
    if (tab === 'invite' && activatedCode && isOwn) {
      setLoadingCodes(true);
      fetch('/api/auth/invite')
        .then(r => r.json())
        .then(data => {
          if (data.codes) setUserCodes(data.codes.map((c: { code: string; use_count?: number; useCount?: number; max_uses?: number; maxUses?: number }) => ({
            code: c.code,
            useCount: c.use_count ?? c.useCount ?? 0,
            maxUses: c.max_uses ?? c.maxUses ?? 1,
          })));
        })
        .catch(() => {})
        .finally(() => setLoadingCodes(false));
    }
  }, [tab, activatedCode, isOwn]);

  const handleValidateInvite = async () => {
    if (!inviteCode.trim()) return;
    setInviteStatus('checking');
    setInviteError('');
    try {
      const res = await fetch('/api/auth/invite/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const data = await res.json();
      if (data.valid) { setInviteStatus('valid'); }
      else { setInviteStatus('invalid'); setInviteError(data.error || '邀请码无效'); }
    } catch { setInviteStatus('invalid'); setInviteError('验证失败'); }
  };

  const handleActivateInvite = async () => {
    if (!inviteCode.trim()) return;
    setIsActivating(true);
    try {
      const res = await fetch('/api/auth/invite/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setActivatedCode(inviteCode.trim().toUpperCase());
        setInviteCode('');
        setInviteStatus('idle');
      } else { setInviteError(data.error || '激活失败'); setInviteStatus('invalid'); }
    } catch { setInviteError('激活失败'); setInviteStatus('invalid'); }
    finally { setIsActivating(false); }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const roleBadge = null as { bg: string; border: string; color: string; label: string } | null;

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'assets', label: `资产 (${publishedAssets.length})`, show: true },
    { key: 'activity', label: '动态', show: true },
    { key: 'data', label: '数据', show: isOwn },
    { key: 'about', label: '关于', show: true },
    { key: 'invite', label: '邀请码', show: isOwn },
  ];

  const handleSaved = () => {
    setShowEditModal(false);
    router.refresh();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* ── Section Label ── */}
      <p className="font-display text-xs uppercase tracking-[0.2em] text-muted mb-4">User Profile</p>

      {/* ── Profile Header ── */}
      <div className="relative mb-8 p-6 sm:p-8 rounded-xl bg-white border border-card-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <ProfileAvatar src={profile.avatar} name={profile.name} userId={profile.id} size="xl" />

          <div className="flex-1 text-center sm:text-left">
            {/* Name + Badges */}
            <div className="flex items-center gap-3 mb-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{profile.name}</h1>
              {roleBadge && (
                <span className={`text-xs px-2.5 py-1 rounded-full border ${roleBadge.bg} ${roleBadge.border} ${roleBadge.color} font-medium`}>
                  {roleBadge.label}
                </span>
              )}
              {profile.type === 'agent' && (
                <span className="text-xs px-2.5 py-1 rounded-full border bg-purple-500/10 border-purple-500/30 text-purple-400 font-medium">
                  🤖 Agent
                </span>
              )}
            </div>

            {/* Bio */}
            <p className="text-muted text-sm mb-4 max-w-lg">
              {profile.bio || '这个人很懒，什么都没写...'}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted justify-center sm:justify-start">
              <div className="flex items-center gap-1.5">
                <ProviderIcon provider={profile.provider} />
                <span>{profile.providerName || profile.provider}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{profile.isBound ? `加入于 ${formatDate(profile.joinedAt)}` : '暂未绑定 Agent'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-yellow-500">🎖️</span>
                <span>{profile.reputation} 声望</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex gap-3 justify-center sm:justify-start">
              {isOwn ? (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-card-border bg-white hover:bg-surface transition-colors"
                >
                  ✏️ 编辑资料
                </button>
              ) : (
                <button
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue text-white hover:bg-blue-dim transition-colors"
                  disabled
                  title="关注功能即将上线"
                >
                  + 关注
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <StatCard label="资产" value={profile.stats.assetCount} />
        <StatCard label="下载" value={formatDownloads(profile.stats.totalDownloads)} />
        <StatCard label="Star" value={profile.stats.totalStars} />
        <StatCard label="评论" value={profile.stats.totalComments} />
        <StatCard label="Issue" value={profile.stats.totalIssues} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 border-b border-card-border overflow-x-auto">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'assets' && (
        <>
          {publishedAssets.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {publishedAssets.map(asset => (
                <AssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold mb-2">还没有发布过资产</h3>
              <p className="text-muted text-sm">
                {isOwn ? '去发布你的第一个作品吧！' : '该用户还没有发布任何资产'}
              </p>
              {isOwn && (
                <Link
                  href="/publish"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-blue text-white text-sm hover:bg-blue-dim transition-colors"
                >
                  🚀 发布资产
                </Link>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'activity' && (
        <div className="rounded-xl bg-white border border-card-border p-6">
          <ActivityTimeline userId={profile.id} />
        </div>
      )}

      {tab === 'data' && isOwn && (
        <DashboardTab userId={profile.id} publishedAssets={publishedAssets} />
      )}

      {tab === 'about' && (
        <div className="rounded-xl bg-white border border-card-border p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-6">📝 关于 {profile.name}</h2>

          <div className="space-y-5">
            {/* Provider info */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-surface/50 border border-card-border">
              {profile.providerAvatar ? (
                <img
                  src={profile.providerAvatar}
                  alt=""
                  className="w-10 h-10 rounded-full border border-card-border"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <LetterAvatar name={profile.providerName || profile.name} userId={profile.id} size={40} />
              )}
              <div>
                <div className="text-sm font-medium">{profile.providerName || profile.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <ProviderIcon provider={profile.provider} />
                  <span>通过 {profile.provider === 'github' ? 'GitHub' : profile.provider === 'google' ? 'Google' : profile.provider === 'email' ? '邮箱' : profile.provider === 'feishu' ? '飞书' : profile.provider} 登录</span>
                </div>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div>
                <h3 className="text-sm font-medium text-muted mb-2">个人简介</h3>
                <p className="text-sm text-foreground leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Economy */}
            <div>
              <h3 className="text-sm font-medium text-muted mb-3">经济系统</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200/50">
                  <div className="text-xs text-yellow-600 mb-1">🎖️ 声望</div>
                  <div className="text-xl font-bold font-mono text-yellow-700">{profile.reputation}</div>
                </div>
                <div className="p-3 rounded-lg bg-orange-50 border border-orange-200/50">
                  <div className="text-xs text-orange-600 mb-1">💎 龙虾币</div>
                  <div className="text-xl font-bold font-mono text-orange-700">{profile.shrimpCoins}</div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="pt-4 border-t border-card-border">
              <div className="text-xs text-muted">
                注册时间：{profile.isBound ? formatDate(profile.joinedAt) : '暂未绑定 Agent'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invite Code Tab ── */}
      {tab === 'invite' && isOwn && (
        <div className="rounded-xl bg-white border border-card-border p-6 sm:p-8">
          <h2 className="text-lg font-bold mb-6">🎟️ 邀请码</h2>

          {activatedCode ? (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-lg">✅</span>
                  <div>
                    <p className="font-medium text-green-800">邀请码已激活</p>
                    <p className="text-sm text-green-600 font-mono mt-1">{activatedCode}</p>
                  </div>
                </div>
                <p className="text-sm text-green-600 mt-2">你可以自由发布和编辑内容了</p>
              </div>

              {/* User's invite codes */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">我的邀请码</h3>
                  <span className="text-xs text-muted">分享给朋友，邀请他们加入</span>
                </div>

                {loadingCodes ? (
                  <div className="text-sm text-muted py-4 text-center">加载中...</div>
                ) : userCodes.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {userCodes.map((c) => {
                      const isUsed = c.useCount >= c.maxUses;
                      return (
                        <div key={c.code} className={`flex items-center justify-between p-3 rounded-lg border ${isUsed ? 'bg-gray-50 border-gray-200' : 'bg-blue-50/50 border-blue/20'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono text-sm font-semibold ${isUsed ? 'text-gray-400 line-through' : 'text-blue'}`}>{c.code}</span>
                            {isUsed && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">已使用</span>}
                          </div>
                          {!isUsed && (
                            <button onClick={() => handleCopyCode(c.code)} className="text-xs px-2.5 py-1 rounded-lg border border-blue/30 text-blue hover:bg-blue/10 transition-colors">
                              {copiedCode === c.code ? '✓ 已复制' : '复制'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-sm text-muted py-4 text-center border border-card-border rounded-lg">暂无邀请码</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted">输入邀请码以解锁发布权限。邀请码可以从社区获取。</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); setInviteStatus('idle'); setInviteError(''); }}
                  placeholder="请输入邀请码"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors font-mono uppercase"
                  onKeyDown={e => e.key === 'Enter' && handleValidateInvite()}
                />
                <button
                  onClick={handleValidateInvite}
                  disabled={!inviteCode.trim() || inviteStatus === 'checking'}
                  className="px-4 py-2.5 rounded-lg border border-card-border text-sm font-medium text-muted hover:text-foreground hover:border-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {inviteStatus === 'checking' ? '验证中...' : '验证'}
                </button>
              </div>
              {inviteStatus === 'valid' && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-sm text-green-700 mb-2">✅ 邀请码有效！</p>
                  <button onClick={handleActivateInvite} disabled={isActivating} className="px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors disabled:opacity-50">
                    {isActivating ? '激活中...' : '确认激活'}
                  </button>
                </div>
              )}
              {inviteStatus === 'invalid' && inviteError && (
                <div className="p-3 rounded-lg bg-red/10 border border-red/30">
                  <p className="text-sm text-red">❌ {inviteError}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}