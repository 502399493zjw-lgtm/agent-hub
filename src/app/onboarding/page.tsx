'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/lib/auth-context';
import { showToast } from '@/components/toast';

type Step = 'invite' | 'profile' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { update: updateSession } = useSession();
  const [step, setStep] = useState<Step>('invite');

  // Invite code
  const [inviteCode, setInviteCode] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [inviteError, setInviteError] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // Profile
  const [customName, setCustomName] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Pre-fill from OAuth
  useEffect(() => {
    if (user) {
      setCustomName(user.name || '');
      setCustomAvatar(user.avatar || '');
      setAvatarPreview(user.avatar || '');
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted">加载中...</div>
      </div>
    );
  }

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
      if (data.success && data.data?.valid) {
        setInviteStatus('valid');
      } else {
        setInviteStatus('invalid');
        setInviteError(data.data?.error || data.error || '邀请码无效');
      }
    } catch {
      setInviteStatus('invalid');
      setInviteError('验证失败，请稍后重试');
    }
  };

  const handleActivateInvite = async () => {
    if (!inviteCode.trim()) return;
    setIsActivating(true);
    setInviteError('');

    try {
      const res = await fetch('/api/auth/invite/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('🎉 邀请码激活成功！');
        setStep('profile');
      } else {
        setInviteStatus('invalid');
        setInviteError(data.error || '激活失败');
      }
    } catch {
      setInviteStatus('invalid');
      setInviteError('激活失败，请稍后重试');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSkipInvite = () => {
    setStep('profile');
  };

  const handleAvatarUrlChange = (url: string) => {
    setCustomAvatar(url);
    setAvatarPreview(url);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName.trim() || user.name,
          avatar: customAvatar.trim() || user.avatar,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh the session so onboardingCompleted becomes true
        await updateSession();
        setStep('done');
        showToast('🎉 欢迎加入水产市场！');
        setTimeout(() => router.push('/'), 1500);
      } else {
        showToast(data.error || '保存失败');
      }
    } catch {
      showToast('保存失败，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkipProfile = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.name,
          avatar: user.avatar,
        }),
      });
      // Refresh the session so onboardingCompleted becomes true
      await updateSession();
    } catch {
      // silently continue
    }
    setStep('done');
    showToast('🎉 欢迎加入水产市场！');
    setTimeout(() => router.push('/'), 1000);
    setIsSaving(false);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
            step === 'invite' ? 'border-blue bg-blue text-white' : 'border-blue/30 bg-blue/10 text-blue'
          }`}>1</div>
          <div className={`w-12 h-0.5 ${step !== 'invite' ? 'bg-blue' : 'bg-card-border'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
            step === 'profile' ? 'border-blue bg-blue text-white' : step === 'done' ? 'border-blue/30 bg-blue/10 text-blue' : 'border-card-border bg-surface text-muted'
          }`}>2</div>
          <div className={`w-12 h-0.5 ${step === 'done' ? 'bg-blue' : 'bg-card-border'}`} />
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
            step === 'done' ? 'border-blue bg-blue text-white' : 'border-card-border bg-surface text-muted'
          }`}>✓</div>
        </div>

        {/* Step 1: Invite Code */}
        {step === 'invite' && (
          <div className="bg-white border border-card-border rounded-lg p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🎟️</div>
              <h1 className="text-xl font-bold">输入邀请码</h1>
              <p className="text-sm text-muted mt-2">有邀请码？输入后可解锁发布权限</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => {
                    setInviteCode(e.target.value);
                    setInviteStatus('idle');
                    setInviteError('');
                  }}
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
                  <button
                    onClick={handleActivateInvite}
                    disabled={isActivating}
                    className="px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors disabled:opacity-50"
                  >
                    {isActivating ? '激活中...' : '确认激活'}
                  </button>
                </div>
              )}

              {inviteStatus === 'invalid' && inviteError && (
                <div className="p-3 rounded-lg bg-red/10 border border-red/30">
                  <p className="text-sm text-red">❌ {inviteError}</p>
                </div>
              )}

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-card-border" />
                <span className="text-xs text-muted">没有邀请码？</span>
                <div className="flex-1 h-px bg-card-border" />
              </div>

              <button
                onClick={handleSkipInvite}
                className="w-full py-2.5 rounded-lg border border-card-border text-sm font-medium text-muted hover:text-foreground hover:border-blue/30 transition-colors"
              >
                跳过，稍后再填 →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Profile Setup */}
        {step === 'profile' && (
          <div className="bg-white border border-card-border rounded-lg p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">👤</div>
              <h1 className="text-xl font-bold">设置你的身份</h1>
              <p className="text-sm text-muted mt-2">自定义你在水产市场的名字和头像</p>
            </div>

            <div className="space-y-5">
              {/* Avatar Preview */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-surface border-2 border-card-border flex items-center justify-center">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="头像预览"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarPreview('')}
                    />
                  ) : (
                    <span className="text-4xl">👤</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">来自</span>
                  {user.provider === 'github' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      <svg className="w-3 h-3 inline mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      GitHub
                    </span>
                  )}
                  {user.provider === 'google' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                      <svg className="w-3 h-3 inline mr-1" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google
                    </span>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">显示名称</label>
                <input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder={user.name || '你的名字'}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                  maxLength={50}
                />
                <p className="text-xs text-muted mt-1">留空则使用 {user.provider === 'github' ? 'GitHub' : 'Google'} 账号名</p>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">头像 URL（可选）</label>
                <input
                  type="url"
                  value={customAvatar}
                  onChange={e => handleAvatarUrlChange(e.target.value)}
                  placeholder="https://example.com/your-avatar.png"
                  className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors text-sm"
                />
                <p className="text-xs text-muted mt-1">留空则使用 {user.provider === 'github' ? 'GitHub' : 'Google'} 头像</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSkipProfile}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg border border-card-border text-sm font-medium text-muted hover:text-foreground hover:border-blue/30 transition-colors disabled:opacity-50"
                >
                  跳过
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '确认保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="bg-white border border-card-border rounded-lg p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold mb-2">欢迎加入水产市场！</h1>
            <p className="text-muted">正在跳转到首页...</p>
          </div>
        )}
      </div>
    </div>
  );
}
