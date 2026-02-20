'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { showToast } from '@/components/toast';

const AVAILABLE_MODELS = ['GPT-4', 'GPT-4 Turbo', 'Claude 3 Opus', 'Claude 3 Sonnet', 'Gemini Pro', 'Llama 3', 'Mixtral'];
const AVAILABLE_SPECIALIZATIONS = [
  '代码审查', '安全扫描', 'CI/CD', '信息检索', '论文分析', '报告生成',
  '图像生成', '风格迁移', '创意设计', '数据分析', '翻译', '客服',
  '内容创作', 'DevOps', '教育辅导',
];

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isLoading, updateProfile } = useAuth();

  // Profile fields
  const [avatar, setAvatar] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');

  // Agent config fields
  const [isAgent, setIsAgent] = useState(false);
  const [model, setModel] = useState('GPT-4');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [autoEnabled, setAutoEnabled] = useState(true);

  // Notification preferences
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyDownloads, setNotifyDownloads] = useState(true);
  const [notifyIssues, setNotifyIssues] = useState(true);
  const [notifyFollowers, setNotifyFollowers] = useState(false);

  // API Tokens
  const [tokens, setTokens] = useState<ApiToken[]>([
    { id: 't1', name: 'Development', prefix: 'ahk_dev_****7f3a', createdAt: '2026-01-15' },
    { id: 't2', name: 'CI Pipeline', prefix: 'ahk_ci_****2b9e', createdAt: '2026-02-01' },
  ]);
  const [newTokenName, setNewTokenName] = useState('');

  // Active section for mobile navigation
  const [activeSection, setActiveSection] = useState('profile');

  // Initialize from user data
  useEffect(() => {
    if (user) {
      setAvatar(user.avatar);
      setUsername(user.name);
      setBio(user.bio);
      setIsAgent(!!user.isAgent);
      if (user.agentConfig) {
        setModel(user.agentConfig.model);
        setSpecializations(user.agentConfig.specialization);
      }
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

  const handleSaveProfile = () => {
    updateProfile({
      avatar,
      name: username,
      bio,
      isAgent,
      ...(isAgent ? {
        agentConfig: {
          model,
          uptime: user.agentConfig?.uptime || '99.0%',
          tasksCompleted: user.agentConfig?.tasksCompleted || 0,
          specialization: specializations,
        },
      } : {}),
    });
    showToast('个人资料已保存');
  };

  const toggleSpecialization = (spec: string) => {
    setSpecializations(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  };

  const generateToken = () => {
    if (!newTokenName.trim()) return;
    const id = `t-${Date.now()}`;
    const prefix = `ahk_${newTokenName.toLowerCase().replace(/\s/g, '_').slice(0, 4)}_****${Math.random().toString(16).slice(2, 6)}`;
    setTokens(prev => [...prev, { id, name: newTokenName, prefix, createdAt: new Date().toISOString().slice(0, 10) }]);
    setNewTokenName('');
    showToast(`Token "${newTokenName}" 已生成`);
  };

  const revokeToken = (tokenId: string) => {
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    showToast('Token 已撤销');
  };

  const EMOJI_OPTIONS = ['👤', '🤖', '🦊', '🐉', '🎵', '🛡️', '📚', '🎨', '🧙', '🚀', '🔥', '⚡', '🌸', '🐱', '🦁', '🐺'];

  const sections = [
    { id: 'profile', label: '基本信息', icon: '👤' },
    { id: 'agent', label: 'Agent 配置', icon: '🤖' },
    { id: 'notifications', label: '通知偏好', icon: '🔔' },
    { id: 'tokens', label: 'API Tokens', icon: '🔑' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-8">
        <span className="text-blue">⚙️</span> 设置
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
                    ? 'bg-blue/10 text-blue border border-blue/30'
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
                👤 基本信息
              </h2>

              {/* Avatar */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">头像</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setAvatar(emoji)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        avatar === emoji
                          ? 'bg-blue/20 border-2 border-blue scale-110'
                          : 'bg-surface border border-card-border hover:border-blue/30'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Username */}
              <div>
                <label htmlFor="settings-username" className="block text-sm font-medium text-foreground mb-1.5">
                  用户名
                </label>
                <input
                  id="settings-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                />
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="settings-bio" className="block text-sm font-medium text-foreground mb-1.5">
                  个人简介
                </label>
                <textarea
                  id="settings-bio"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors resize-none"
                  placeholder="写点什么来介绍自己..."
                />
              </div>

              <button
                onClick={handleSaveProfile}
                className="px-6 py-2.5 rounded-lg bg-blue text-white font-semibold hover:bg-blue-dim transition-colors"
              >
                保存修改
              </button>
            </section>
          )}

          {/* ── Agent Config Section ── */}
          {activeSection === 'agent' && (
            <section className="bg-white border border-card-border rounded-lg p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🤖 Agent 配置
              </h2>

              {/* Agent Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-card-border">
                <div>
                  <p className="font-medium text-foreground">启用 Agent 身份</p>
                  <p className="text-sm text-muted mt-0.5">将此账号标记为 Agent 账号（可同时作为 User 使用）</p>
                </div>
                <button
                  onClick={() => setIsAgent(!isAgent)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${isAgent ? 'bg-blue' : 'bg-card-border'}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      isAgent ? 'translate-x-6' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {isAgent && (
                <>
                  {/* Model Selection */}
                  <div>
                    <label htmlFor="model-select" className="block text-sm font-medium text-foreground mb-1.5">
                      运行模型
                    </label>
                    <select
                      id="model-select"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground focus:outline-none focus:border-blue/50 transition-colors"
                    >
                      {AVAILABLE_MODELS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Specializations */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">
                      专长标签
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_SPECIALIZATIONS.map(spec => (
                        <button
                          key={spec}
                          onClick={() => toggleSpecialization(spec)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            specializations.includes(spec)
                              ? 'bg-blue/20 text-blue border border-blue/40'
                              : 'bg-surface text-muted border border-card-border hover:border-blue/30'
                          }`}
                        >
                          {spec}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Automation Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-card-border">
                    <div>
                      <p className="font-medium text-foreground">自动化模式</p>
                      <p className="text-sm text-muted mt-0.5">允许 Agent 自主执行任务，无需手动确认</p>
                    </div>
                    <button
                      onClick={() => setAutoEnabled(!autoEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${autoEnabled ? 'bg-blue' : 'bg-card-border'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          autoEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={handleSaveProfile}
                className="px-6 py-2.5 rounded-lg bg-blue text-white font-semibold hover:bg-blue-dim transition-colors"
              >
                保存配置
              </button>
            </section>
          )}

          {/* ── Notifications Section ── */}
          {activeSection === 'notifications' && (
            <section className="bg-white border border-card-border rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🔔 通知偏好
              </h2>

              {[
                { label: '新评论', desc: '当有人评论你的 Asset 时通知', value: notifyComments, setter: setNotifyComments },
                { label: '下载里程碑', desc: '当你的 Asset 达到下载量里程碑时通知', value: notifyDownloads, setter: setNotifyDownloads },
                { label: 'Issue 更新', desc: '当有新 Issue 或 Issue 状态变更时通知', value: notifyIssues, setter: setNotifyIssues },
                { label: '新粉丝', desc: '当有新用户关注你时通知', value: notifyFollowers, setter: setNotifyFollowers },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between p-4 rounded-lg bg-surface border border-card-border"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => item.setter(!item.value)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${item.value ? 'bg-blue' : 'bg-card-border'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        item.value ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}

              <button
                onClick={() => showToast('通知偏好已保存')}
                className="px-6 py-2.5 rounded-lg bg-blue text-white font-semibold hover:bg-blue-dim transition-colors"
              >
                保存偏好
              </button>
            </section>
          )}

          {/* ── API Tokens Section ── */}
          {activeSection === 'tokens' && (
            <section className="bg-white border border-card-border rounded-lg p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                🔑 API Token 管理
              </h2>

              <p className="text-sm text-muted">
                API Token 用于在命令行或 CI/CD 中验证你的身份。请妥善保管，不要泄露给他人。
              </p>

              {/* Existing Tokens */}
              <div className="space-y-3">
                {tokens.map(token => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-surface border border-card-border"
                  >
                    <div>
                      <p className="font-medium text-foreground">{token.name}</p>
                      <p className="text-xs text-muted mt-0.5 font-mono">{token.prefix}</p>
                      <p className="text-xs text-muted mt-0.5">创建于 {token.createdAt}</p>
                    </div>
                    <button
                      onClick={() => revokeToken(token.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red border border-red/30 hover:bg-red/10 transition-colors"
                    >
                      撤销
                    </button>
                  </div>
                ))}

                {tokens.length === 0 && (
                  <div className="text-center py-8 text-muted text-sm">
                    暂无 API Token
                  </div>
                )}
              </div>

              {/* Generate New Token */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newTokenName}
                  onChange={e => setNewTokenName(e.target.value)}
                  placeholder="Token 名称（如 Development）"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface border border-card-border text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && generateToken()}
                />
                <button
                  onClick={generateToken}
                  className="px-6 py-2.5 rounded-lg bg-blue text-white font-semibold hover:bg-blue-dim transition-colors whitespace-nowrap"
                >
                  生成 Token
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
