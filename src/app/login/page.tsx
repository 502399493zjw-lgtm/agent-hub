'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect, useRef } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');
  const verify = searchParams.get('verify');

  // Email login
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(!!verify);

  // Poll session to detect magic-link auth in another tab
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => {
    if (!emailSent) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data?.user) {
          clearInterval(pollRef.current);
          router.push(callbackUrl);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [emailSent, callbackUrl, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
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
            登录水产市场
          </h1>
          <p className="text-muted mt-2 text-sm">
            选择登录方式，进入水产市场
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-card-border rounded-lg p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm">
              {error === 'AccessDenied'
                ? '账号已被停用，无法登录'
                : error === 'Configuration'
                ? '登录服务配置错误，请联系管理员'
                : error === 'Verification'
                ? '链接已过期或已使用，请重新发送'
                : error === 'not_registered'
                ? '该账号尚未注册，请先注册后再登录'
                : error === 'invite_required'
                ? '需要邀请码才能注册新账号'
                : error === 'OAuthAccountNotLinked'
                ? '该账号已通过其他方式登录，请使用原登录方式'
                : '登录失败，请稍后重试'}
            </div>
          )}

          {/* Redirect to register if not_registered or invite_required */}
          {(error === 'not_registered' || error === 'invite_required') && (
            <div className="text-center">
              <Link
                href="/register"
                className="inline-block px-4 py-2 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors"
              >
                前往注册 →
              </Link>
            </div>
          )}

          {emailSent ? (
            /* Email sent confirmation */
            <div className="text-center py-4 space-y-3">
              <div className="text-4xl">📬</div>
              <h2 className="text-lg font-bold">验证邮件已发送</h2>
              <p className="text-sm text-muted">
                请检查你的邮箱 <span className="font-medium text-foreground">{email || '收件箱'}</span>，
                点击邮件中的链接完成登录。
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
                  使用 GitHub 登录
                </button>
                {/* Feishu login removed — self-built app can't cross tenants */}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-card-border" />
                <span className="text-xs text-muted">或使用邮箱</span>
                <div className="flex-1 h-px bg-card-border" />
              </div>

              {/* Email Magic Link */}
              <form onSubmit={handleEmailLogin} className="space-y-3">
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
                  {emailSending ? '发送中...' : <><span suppressHydrationWarning>📧</span> 发送登录链接</>}
                </button>
              </form>
            </>
          )}

          {/* Info */}
          {!emailSent && (
            <div className="space-y-2 text-xs text-muted">
              <p>🔒 我们不会存储你的密码，仅通过 OAuth 或邮箱验证登录</p>
            </div>
          )}

          {/* Footer links */}
          <div className="flex items-center justify-between pt-1">
            <Link href="/register" className="text-sm text-muted hover:text-blue transition-colors">
              没有账号？<span className="underline underline-offset-2">注册</span>
            </Link>
            <Link href="/" className="text-sm text-blue hover:text-blue-dim transition-colors">
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted">加载中...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
