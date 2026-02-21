'use client';

import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');
  const verify = searchParams.get('verify');
  const [email, setEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(!!verify);

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
            登录 <span className="text-blue">水产市场</span>
          </h1>
          <p className="text-muted mt-2 text-sm">使用社交账号或邮箱登录，探索 Agent 生态</p>
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
                : '登录失败，请稍后重试'}
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

                <button
                  onClick={() => signIn('google', { callbackUrl })}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-card-border hover:border-blue/30 hover:bg-surface text-sm font-medium text-foreground transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  使用 Google 登录
                  <span className="text-xs text-muted">（需科学上网）</span>
                </button>
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
                  {emailSending ? '发送中...' : '📧 发送登录链接'}
                </button>
              </form>
            </>
          )}

          {/* Info */}
          {!emailSent && (
            <div className="space-y-2 text-xs text-muted">
              <p>🔒 我们不会存储你的密码，仅通过 OAuth 或邮箱验证登录</p>
              <p>📧 首次登录将自动创建账号</p>
              <p>🎟️ 登录后需要激活邀请码才能发布内容</p>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-sm text-muted">
            <Link href="/" className="text-blue hover:text-blue-dim transition-colors">
              ← 返回首页
            </Link>
          </p>
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
