'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';

function RegisterContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');
  const codeParam = searchParams.get('code');

  // Step management: 'invite' | 'register'
  const [step, setStep] = useState<'invite' | 'register'>('invite');
  const [inviteCode, setInviteCode] = useState(codeParam || '');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [inviteError, setInviteError] = useState('');

  // Email registration
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Auto-validate if code param is provided
  useEffect(() => {
    if (codeParam && codeParam.trim()) {
      handleValidateInvite(codeParam.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleValidateInvite = async (code?: string) => {
    const codeToCheck = (code || inviteCode).trim().toUpperCase();
    if (!codeToCheck) return;
    setInviteStatus('checking');
    setInviteError('');

    try {
      const res = await fetch('/api/auth/invite/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToCheck }),
      });
      const data = await res.json();
      if (data.success && data.data?.valid) {
        setInviteStatus('valid');
        setInviteCode(codeToCheck);
        // Store invite code in cookie for OAuth callback to read
        document.cookie = `invite_code=${encodeURIComponent(codeToCheck)}; path=/; max-age=3600; SameSite=Lax`;
        // Proceed to register step
        setTimeout(() => setStep('register'), 600);
      } else {
        setInviteStatus('invalid');
        setInviteError(data.data?.error || data.error || '邀请码无效');
      }
    } catch {
      setInviteStatus('invalid');
      setInviteError('验证失败，请稍后重试');
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || emailSending) return;
    setEmailSending(true);
    await signIn('resend', { email, callbackUrl, redirect: true });
    setEmailSent(true);
    setEmailSending(false);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🐟</div>
          <h1 className="text-2xl font-bold font-serif">
            {step === 'invite' ? '加入' : '注册'}{' '}
            水产市场
          </h1>
          <p className="text-muted mt-2 text-sm">
            {step === 'invite'
              ? '输入邀请码，开启 Agent 生态之旅'
              : '选择注册方式，加入水产市场'}
          </p>
        </div>

        {/* Step 1: Invite Code */}
        {step === 'invite' && (
          <div className="bg-white border border-card-border rounded-lg p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {/* Error from auth callback */}
            {error === 'invite_required' && (
              <div className="px-4 py-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm">
                请先输入邀请码再注册
              </div>
            )}

            <div className="text-center">
              <div className="text-3xl mb-2">🎟️</div>
              <p className="text-sm text-muted">水产市场目前为邀请制，请输入邀请码</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => {
                    setInviteCode(e.target.value.toUpperCase());
                    setInviteStatus('idle');
                    setInviteError('');
                  }}
                  placeholder="请输入 7 位邀请码"
                  className="flex-1 px-4 py-3 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 focus:ring-1 focus:ring-blue/20 transition-colors font-mono uppercase tracking-widest text-center text-lg"
                  maxLength={10}
                  onKeyDown={e => e.key === 'Enter' && handleValidateInvite()}
                  autoFocus
                />
              </div>

              <button
                onClick={() => handleValidateInvite()}
                disabled={!inviteCode.trim() || inviteStatus === 'checking'}
                className="w-full py-3 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {inviteStatus === 'checking' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    验证中...
                  </span>
                ) : '验证邀请码'}
              </button>

              {inviteStatus === 'valid' && (
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
                  <p className="text-sm text-green-700">✅ 邀请码有效！正在跳转...</p>
                </div>
              )}

              {inviteStatus === 'invalid' && inviteError && (
                <div className="p-3 rounded-lg bg-red/10 border border-red/30">
                  <p className="text-sm text-red">❌ {inviteError}</p>
                </div>
              )}
            </div>

            {/* Footer links */}
            <div className="flex items-center justify-between pt-2">
              <Link href="/login" className="text-sm text-muted hover:text-blue transition-colors">
                已有账号？<span className="underline underline-offset-2">登录</span>
              </Link>
              <Link href="/" className="text-sm text-blue hover:text-blue-dim transition-colors">
                返回首页
              </Link>
            </div>
          </div>
        )}

        {/* Step 2: Register Buttons */}
        {step === 'register' && (
          <div className="bg-white border border-card-border rounded-lg p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {inviteCode && inviteStatus === 'valid' && (
              <div className="px-3 py-2 rounded-lg bg-blue/5 border border-blue/20 text-center">
                <p className="text-xs text-blue">
                  🎟️ 邀请码 <span className="font-mono font-medium">{inviteCode}</span> 已验证
                </p>
              </div>
            )}

            {emailSent ? (
              /* Email sent confirmation */
              <div className="text-center py-4 space-y-3">
                <div className="text-4xl">📬</div>
                <h2 className="text-lg font-bold">验证邮件已发送</h2>
                <p className="text-sm text-muted">
                  请检查你的邮箱 <span className="font-medium text-foreground">{email || '收件箱'}</span>，
                  点击邮件中的链接完成注册。
                </p>
                <p className="text-xs text-muted">没收到？检查垃圾邮件文件夹，或</p>
                <button
                  onClick={() => { setEmailSent(false); setEmail(''); }}
                  className="text-sm text-blue hover:text-blue-dim transition-colors"
                >
                  重新发送
                </button>
              </div>
            ) : (
              <>
                {/* OAuth Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={() => signIn('github', { callbackUrl })}
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-card-border hover:border-blue/30 hover:bg-surface text-sm font-medium text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    使用 GitHub 注册
                  </button>
                  <button
                    onClick={() => signIn('feishu', { callbackUrl })}
                    className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-card-border hover:border-[#3370ff]/30 hover:bg-surface text-sm font-medium text-foreground transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <path d="M3.947 6.137c1.262-1.089 6.758-5.478 7.222-3.748.464 1.73-3.59 7.952-3.59 7.952s7.595-5.313 8.232-3.274c.638 2.04-5.106 7.873-5.106 7.873s6.65-3.637 6.903-1.726c.254 1.911-7.95 7.665-7.95 7.665L3 15.48l.947-9.343z" fill="#3370FF"/>
                      <path d="M9.657 14.94s5.75-5.833 6.388-3.794c.638 2.04-5.106 7.873-5.106 7.873s6.65-3.637 6.903-1.726c.254 1.911-7.95 7.665-7.95 7.665L3 19.56" fill="#00D6B9" fillOpacity="0.8"/>
                    </svg>
                    使用飞书注册
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-card-border" />
                  <span className="text-xs text-muted">或使用邮箱</span>
                  <div className="flex-1 h-px bg-card-border" />
                </div>

                {/* Email Magic Link */}
                <form onSubmit={handleEmailRegister} className="space-y-3">
                  <input
                    type="email"
                    placeholder="输入邮箱地址"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-card-border bg-surface text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-blue/50 focus:ring-1 focus:ring-blue/20 transition-colors"
                    required
                  />
                  <button
                    type="submit"
                    disabled={emailSending || !email}
                    className="w-full py-3 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {emailSending ? '发送中...' : <><span suppressHydrationWarning>📧</span> 发送注册链接</>}
                  </button>
                </form>
              </>
            )}

            {/* Info */}
            {!emailSent && (
              <div className="space-y-2 text-xs text-muted">
                <p>🔒 我们不会存储你的密码，仅通过 OAuth 或邮箱验证注册</p>
                <p>📧 注册后将自动创建账号并激活邀请码</p>
              </div>
            )}

            {/* Footer links */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setStep('invite')}
                className="text-sm text-muted hover:text-blue transition-colors"
              >
                ← 重新输入邀请码
              </button>
              <Link href="/login" className="text-sm text-blue hover:text-blue-dim transition-colors">
                已有账号？登录
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted">加载中...</div>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
