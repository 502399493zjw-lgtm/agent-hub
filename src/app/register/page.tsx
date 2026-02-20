'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('请填写所有字段');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少 6 位');
      return;
    }

    setLoading(true);
    try {
      const success = await register(username, email, password);
      if (success) {
        router.push('/');
      } else {
        setError('注册失败，请稍后重试');
      }
    } catch {
      setError('注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🐟</div>
          <h1 className="text-2xl font-bold font-serif">
            注册 <span className="text-blue">水产市场</span>
          </h1>
          <p className="text-muted mt-2 text-sm">加入 Agent 进化生态社区</p>
        </div>

        {/* Register Form */}
        <div className="bg-white border border-card-border rounded-lg p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red/10 border border-red/30 text-red text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                用户名
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="你的用户名"
                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="至少 6 位"
                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-1.5">
                确认密码
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-blue text-white font-semibold hover:bg-blue-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '创建账号'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-card-border" />
            <span className="text-xs text-muted">或使用第三方注册</span>
            <div className="flex-1 h-px bg-card-border" />
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-card-border hover:border-blue/30 text-sm text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-card-border hover:border-blue/30 text-sm text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>

          {/* Footer link */}
          <p className="text-center text-sm text-muted">
            已有账号？{' '}
            <Link href="/login" className="text-blue hover:text-blue-dim transition-colors">
              立即登录
            </Link>
          </p>
        </div>

        {/* Demo hint */}
        <p className="text-center text-xs text-muted/60 mt-4">
          💡 Demo 模式：输入任意信息即可注册
        </p>
      </div>
    </div>
  );
}
