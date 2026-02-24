'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signOut } from 'next-auth/react';
import { showToast } from '@/components/toast';

interface InviteCodeInfo {
  code: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: string | null;
  maxUses: number;
  useCount: number;
  type: string;
  createdAt: string;
}

interface DeviceInfo {
  deviceId: string;
  deviceIdShort: string;
  name: string;
  authorizedAt: string;
  lastPublishAt: string | null;
}

function SettingsContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();

  // Invite code
  const [inviteCode, setInviteCode] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string>('idle');
  const [inviteError, setInviteError] = useState('');
  const [activatedCode, setActivatedCode] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [userCodes, setUserCodes] = useState<InviteCodeInfo[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Devices
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [bindingDevice, setBindingDevice] = useState(false);
  const [bindError, setBindError] = useState('');
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);

  // Copy install command
  const [copiedInstall, setCopiedInstall] = useState(false);
  const handleCopyInstall = () => {
    navigator.clipboard.writeText('帮我安装技能，命令行指令是 curl -sL https://openclawmp.cc/api/v1/assets/s-65623b82a16d719e/download -o /tmp/_oc_pkg.zip && unzip -oq /tmp/_oc_pkg.zip -d ~/.openclaw/skills/openclawmp && rm /tmp/_oc_pkg.zip');
    setCopiedInstall(true);
    showToast('命令已复制');
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Active section
  const initialSection = searchParams.get('section') || 'profile';
  const [activeSection, setActiveSection] = useState(initialSection);

  // Fetch user invite code status
  useEffect(() => {
    if (user?.inviteCode) {
      setActivatedCode(user.inviteCode);
    }
  }, [user]);

  // Fetch user's invite codes when viewing invite section
  useEffect(() => {
    if (activeSection === 'invite' && activatedCode) {
      fetchUserCodes();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activatedCode]);

  // Fetch devices when viewing device section
  useEffect(() => {
    if (activeSection === 'devices') {
      fetchDevices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const fetchUserCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch('/api/auth/invite');
      const data = await res.json();
      if (data.success && data.data?.codes) {
        setUserCodes(data.data.codes);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingCodes(false);
    }
  };

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const res = await fetch('/api/auth/device');
      const data = await res.json();
      if (data.success && data.data?.devices) {
        setDevices(data.data.devices);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleBindDevice = async () => {
    const trimmed = newDeviceId.trim();
    if (!trimmed) return;

    setBindingDevice(true);
    setBindError('');

    try {
      const res = await fetch('/api/auth/device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: trimmed, name: newDeviceName.trim() || '' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.data?.alreadyBound ? '设备已绑定（无需重复操作）' : '设备绑定成功');
        setNewDeviceId('');
        setNewDeviceName('');
        fetchDevices();
      } else {
        setBindError(data.error || '绑定失败');
      }
    } catch {
      setBindError('网络错误，请稍后重试');
    } finally {
      setBindingDevice(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm('确定要解绑此设备？解绑后该设备上的 Agent 将无法再以你的身份操作。')) return;

    setRemovingDeviceId(deviceId);
    try {
      const res = await fetch('/api/auth/device', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('设备已解绑');
        fetchDevices();
      } else {
        showToast(data.error || '解绑失败');
      }
    } catch {
      showToast('网络错误');
    } finally {
      setRemovingDeviceId(null);
    }
  };

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
        setActivatedCode(inviteCode.trim().toUpperCase());
        setInviteCode('');
        setInviteStatus('idle');
        showToast('邀请码激活成功！你已获得 6 个邀请码');
        if (data.data?.generatedCodes) {
          setUserCodes(data.data.generatedCodes);
        } else {
          fetchUserCodes();
        }
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

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`已复制邀请码: ${code}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);

    try {
      const res = await fetch('/api/auth/account', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('账号已删除');
        await signOut({ callbackUrl: '/' });
      } else {
        showToast(data.error || '删除失败');
      }
    } catch {
      showToast('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const sections = [
    { id: 'profile', label: '个人信息', icon: '👤' },
    { id: 'devices', label: '我的设备', icon: '🔗' },
    { id: 'invite', label: '邀请码', icon: '🎟️' },
    { id: 'danger', label: '危险操作', icon: '⚠️' },
  ];

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-8">
        账号设置
      </h1>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <nav className="md:w-56 shrink-0">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeSection === section.id
                    ? 'bg-surface text-foreground border border-card-border'
                    : 'text-muted hover:text-foreground hover:bg-white border border-transparent'
                }`}
              >
                <span>{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {/* ── Profile Section ── */}
          {activeSection === 'profile' && (
            <section className="bg-white border border-card-border rounded-lg p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                👤 个人信息
              </h2>
              <p className="text-sm text-muted">以下信息来自你的 OAuth 账号，不可手动修改。</p>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-surface border border-card-border flex items-center justify-center">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">👤</span>
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground text-lg">{user.name}</p>
                  <p className="text-sm text-muted">{user.email}</p>
                </div>
              </div>

              {/* Read-only fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">用户名</label>
                  <input
                    type="text"
                    value={user.name}
                    disabled
                    className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-surface border border-card-border text-muted cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">邮箱</label>
                  <input
                    type="text"
                    value={user.email}
                    disabled
                    className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-surface border border-card-border text-muted cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">登录方式</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-card-border w-fit">
                    {user.provider === 'github' && (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        <span className="text-sm text-muted">GitHub</span>
                      </>
                    )}
                    {user.provider === 'google' && (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        <span className="text-sm text-muted">Google</span>
                      </>
                    )}
                    {user.provider === 'feishu' && (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M3 17.6L9.3 6.5c.3-.5.9-.7 1.4-.4l8.7 5c.5.3.7.9.4 1.4L13.5 23.6c-.3.5-.9.7-1.4.4l-8.7-5c-.5-.3-.7-.9-.4-1.4z" fill="#3370FF"/><path d="M7.5 3.8L13.8 0c.5-.3 1.1-.1 1.4.4l3.3 5.7c.3.5.1 1.1-.4 1.4l-6.3 3.6c-.5.3-1.1.1-1.4-.4L7.1 5.2c-.3-.5-.1-1.1.4-1.4z" fill="#00D6B9"/></svg>
                        <span className="text-sm text-muted">飞书</span>
                      </>
                    )}
                    {!user.provider && <span className="text-sm text-muted">未知</span>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Devices Section ── */}
          {activeSection === 'devices' && (
            <section className="bg-white border border-card-border rounded-lg p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🔗 我的设备
              </h2>
              <p className="text-sm text-muted">
                每个账号只能绑定一个设备（Agent），绑定后该设备可以用你的身份发布、下载资产。
              </p>

              {/* 安装技能指令 */}
              <div className="p-4 rounded-lg bg-surface border border-card-border">
                <p className="text-sm font-medium text-foreground mb-2">让你的 Agent 能在水产市场上活动</p>
                <p className="text-sm text-muted mb-3">
                  将下面的内容发给 Agent，安装水产市场技能
                </p>
                <div className="bg-white rounded-lg border border-card-border p-3 font-mono text-xs text-foreground flex items-start justify-between gap-2">
                  <code className="break-all whitespace-pre-wrap">帮我安装技能，命令行指令是 curl -sL https://openclawmp.cc/api/v1/assets/s-65623b82a16d719e/download -o /tmp/_oc_pkg.zip &amp;&amp; unzip -oq /tmp/_oc_pkg.zip -d ~/.openclaw/skills/openclawmp &amp;&amp; rm /tmp/_oc_pkg.zip</code>
                  <button
                    onClick={handleCopyInstall}
                    className="text-xs px-2.5 py-1 rounded-lg border border-card-border text-muted hover:text-foreground transition-colors shrink-0"
                  >
                    {copiedInstall ? '✓ 已复制' : '复制'}
                  </button>
                </div>
              </div>

              {/* Loading state */}
              {loadingDevices ? (
                <div className="text-sm text-muted py-8 text-center">加载中...</div>
              ) : devices.length > 0 ? (
                /* ── Has bound device: show current device ── */
                <div className="space-y-4">
                  {devices.map(device => (
                    <div
                      key={device.deviceId}
                      className="p-5 rounded-lg border-2 border-green-200 bg-green-50/30 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ✓ 已绑定
                            </span>
                          </div>
                          <p className="text-base font-medium text-foreground">
                            {device.name || '未命名设备'}
                          </p>
                          <p className="text-xs font-mono text-muted mt-1 break-all">
                            {device.deviceIdShort || device.deviceId.slice(0, 12) + '...'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-muted">
                        <span>绑定于 {formatDate(device.authorizedAt)}</span>
                        {device.lastPublishAt && (
                          <span>上次发布 {formatDate(device.lastPublishAt)}</span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-green-200/50">
                        <button
                          onClick={() => handleRemoveDevice(device.deviceId)}
                          disabled={removingDeviceId === device.deviceId}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red/30 text-red hover:bg-red/10 transition-colors disabled:opacity-50"
                        >
                          {removingDeviceId === device.deviceId ? '解绑中...' : '解绑设备（换绑其他设备前需先解绑）'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── No device: show bind form ── */
                <>
                  {!activatedCode ? (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-sm text-amber-800">
                        需要先激活邀请码才能绑定设备。前往「邀请码」页面激活。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* How to find Device ID */}
                      <div className="p-4 rounded-lg bg-blue-50/50 border border-blue/20">
                        <p className="text-sm font-medium text-foreground mb-2">如何获取 Device ID？</p>
                        <p className="text-sm text-muted mb-2">
                          在你的 Agent 终端运行以下命令，复制输出的 Device ID：
                        </p>
                        <div className="bg-white rounded-lg border border-card-border p-3 font-mono text-sm text-foreground flex items-center justify-between gap-2">
                          <code>cat ~/.openclaw/identity/device.json</code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText('cat ~/.openclaw/identity/device.json');
                              showToast('命令已复制');
                            }}
                            className="text-xs px-2 py-1 rounded border border-card-border text-muted hover:text-foreground transition-colors shrink-0"
                          >
                            复制
                          </button>
                        </div>
                      </div>

                      {/* Bind form */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-muted mb-1">Device ID</label>
                          <input
                            type="text"
                            value={newDeviceId}
                            onChange={e => {
                              setNewDeviceId(e.target.value);
                              setBindError('');
                            }}
                            placeholder="粘贴 Agent 的 Device ID"
                            className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-muted mb-1">备注名称（可选）</label>
                          <input
                            type="text"
                            value={newDeviceName}
                            onChange={e => setNewDeviceName(e.target.value)}
                            placeholder="如：我的 MacBook、服务器 Agent"
                            className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors text-sm"
                          />
                        </div>
                        {bindError && (
                          <div className="p-3 rounded-lg bg-red/10 border border-red/30">
                            <p className="text-sm text-red">{bindError}</p>
                          </div>
                        )}
                        <button
                          onClick={handleBindDevice}
                          disabled={!newDeviceId.trim() || bindingDevice}
                          className="px-5 py-2.5 rounded-lg bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {bindingDevice ? '绑定中...' : '绑定设备'}
                        </button>
                      </div>

                      {/* Empty state hint */}
                      <div className="text-sm text-muted py-4 text-center border border-dashed border-card-border rounded-lg">
                        暂未绑定设备。绑定后你的 Agent 即可以你的身份操作水产市场。
                      </div>
                    </div>
                  )}
                </>
              )}

            </section>
          )}

          {/* ── Invite Code Section ── */}
          {activeSection === 'invite' && (
            <section className="bg-white border border-card-border rounded-lg p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🎟️ 邀请码
              </h2>

              {activatedCode ? (
                <>
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
                      <h3 className="text-sm font-semibold text-muted uppercase tracking-wider">
                        我的邀请码
                      </h3>
                      <span className="text-xs text-muted">分享给朋友，邀请他们加入</span>
                    </div>

                    {loadingCodes ? (
                      <div className="text-sm text-muted py-4 text-center">加载中...</div>
                    ) : userCodes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {userCodes.map((c) => {
                          const isUsed = c.useCount >= c.maxUses;
                          return (
                            <div
                              key={c.code}
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                isUsed
                                  ? 'bg-gray-50 border-gray-200'
                                  : 'bg-blue-50/50 border-blue/20'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-mono text-sm font-semibold ${isUsed ? 'text-gray-400 line-through' : 'text-blue'}`}>
                                  {c.code}
                                </span>
                                {isUsed && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                                    已使用
                                  </span>
                                )}
                              </div>
                              {!isUsed && (
                                <button
                                  onClick={() => handleCopyCode(c.code)}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-blue/30 text-blue hover:bg-blue/10 transition-colors"
                                >
                                  {copiedCode === c.code ? '✓ 已复制' : '复制'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-muted py-4 text-center border border-card-border rounded-lg">
                        暂无邀请码
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    输入邀请码以解锁发布权限。邀请码可以从社区获取。
                  </p>

                  <div className="space-y-3">
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
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── Danger Zone ── */}
          {activeSection === 'danger' && (
            <section className="bg-white border border-red/30 rounded-lg p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-red">
                ⚠️ 危险操作
              </h2>

              <div className="p-4 rounded-lg bg-red/5 border border-red/20">
                <h3 className="font-medium text-foreground mb-1">删除账号</h3>
                <p className="text-sm text-muted mb-4">
                  删除后你将无法再登录此账号。此操作不可撤销。
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 rounded-lg bg-red text-white text-sm font-medium hover:bg-red-dim transition-colors"
                >
                  删除我的账号
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md bg-white rounded-lg border border-card-border p-6 shadow-lg space-y-4">
            <h3 className="text-lg font-semibold text-foreground">确认删除账号</h3>
            <p className="text-sm text-muted">
              你确定要删除账号吗？删除后你将无法再使用此账号登录。
            </p>
            <p className="text-sm text-muted">
              请输入 <span className="font-mono font-bold text-red">DELETE</span> 确认：
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="输入 DELETE"
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-red/50 transition-colors font-mono"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }}
                className="px-4 py-2 rounded-lg border border-card-border text-sm text-muted hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="px-4 py-2 rounded-lg bg-red text-white text-sm font-medium hover:bg-red-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-muted">加载中...</div>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}