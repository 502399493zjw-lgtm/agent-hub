'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { Suspense, useState, useEffect } from 'react';

function AuthorizeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const code = searchParams.get('code')?.toUpperCase() || '';

  const [deviceInfo, setDeviceInfo] = useState<{
    deviceId: string;
    deviceName: string;
    status: string;
    expiresAt: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  // Fetch device info from the CLI auth request
  useEffect(() => {
    if (!code) {
      setError('缺少授权码。请从 CLI 获取正确的链接。');
      setLoading(false);
      return;
    }

    const fetchInfo = async () => {
      try {
        // Use GET with a dummy deviceId just to check existence
        // Actually, we need to use the GET endpoint which requires deviceId.
        // Instead, let's call PUT later directly. For now, show the code.
        setLoading(false);
      } catch {
        setError('获取设备信息失败');
        setLoading(false);
      }
    };

    fetchInfo();
  }, [code]);

  const handleApprove = async () => {
    if (approving) return;
    setApproving(true);
    setError('');

    try {
      const res = await fetch('/api/auth/cli', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.data?.message || '✅ 设备已授权！',
        });
      } else {
        setResult({
          success: false,
          message: data.error || '授权失败',
        });
      }
    } catch {
      setResult({
        success: false,
        message: '网络错误，请重试',
      });
    } finally {
      setApproving(false);
    }
  };

  // Not logged in — prompt to login
  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted">加载中...</div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold font-serif">设备授权</h1>
            <p className="text-muted mt-2 text-sm">请先登录以批准设备授权</p>
          </div>

          <div className="bg-white border border-card-border rounded-lg p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {code && (
              <div className="px-4 py-3 rounded-lg bg-blue/5 border border-blue/20 text-center">
                <p className="text-xs text-muted mb-1">授权码</p>
                <p className="font-mono text-lg font-bold tracking-widest text-foreground">{code}</p>
              </div>
            )}

            <button
              onClick={() => signIn(undefined, { callbackUrl: `/cli/authorize?code=${code}` })}
              className="w-full py-3 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors"
            >
              登录以继续
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold font-serif">授权失败</h1>
          </div>
          <div className="bg-white border border-card-border rounded-lg p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-sm text-red text-center">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="w-full mt-4 py-3 rounded-lg border border-card-border text-sm font-medium hover:bg-surface transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result state (after approval)
  if (result) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">{result.success ? '🎉' : '❌'}</div>
            <h1 className="text-2xl font-bold font-serif">
              {result.success ? '授权成功' : '授权失败'}
            </h1>
          </div>
          <div className="bg-white border border-card-border rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className={`px-4 py-3 rounded-lg text-center text-sm ${
              result.success
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red/10 border border-red/30 text-red'
            }`}>
              {result.message}
            </div>

            {result.success && (
              <p className="text-xs text-muted text-center">
                你的 CLI / Agent 已经可以使用了。此窗口可以关闭。
              </p>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full py-3 rounded-lg border border-card-border text-sm font-medium hover:bg-surface transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main: logged in, show approval UI
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold font-serif">确认设备授权</h1>
          <p className="text-muted mt-2 text-sm">
            将此设备绑定到你的账号
          </p>
        </div>

        <div className="bg-white border border-card-border rounded-lg p-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          {/* Current user info */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface border border-card-border">
            <div className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center text-sm">
              {session?.user?.image ? (
                <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
              ) : '👤'}
            </div>
            <div>
              <p className="text-sm font-medium">{session?.user?.name || '用户'}</p>
              <p className="text-xs text-muted">{session?.user?.email || ''}</p>
            </div>
          </div>

          {/* Auth code display */}
          <div className="px-4 py-4 rounded-lg bg-blue/5 border border-blue/20 text-center">
            <p className="text-xs text-muted mb-2">授权码</p>
            <p className="font-mono text-2xl font-bold tracking-widest text-foreground">{code}</p>
          </div>

          {/* Warning */}
          <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              ⚠️ 设备绑定是<strong>永久</strong>的。此设备将与你的账号关联，无法解绑。
              请确认这是你信任的设备。
            </p>
          </div>

          {/* Approve button */}
          <button
            onClick={handleApprove}
            disabled={approving}
            className="w-full py-3 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {approving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                授权中...
              </span>
            ) : '✅ 批准授权'}
          </button>

          {/* Cancel */}
          <button
            onClick={() => router.push('/')}
            className="w-full py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CliAuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted">加载中...</div>
      </div>
    }>
      <AuthorizeContent />
    </Suspense>
  );
}
