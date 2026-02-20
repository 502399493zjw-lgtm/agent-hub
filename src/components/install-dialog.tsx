'use client';

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Asset } from '@/data/mock';

interface InstallDialogProps {
  asset: Asset;
}

const installSteps = [
  { label: '检查兼容性', icon: '🔍' },
  { label: '解析依赖', icon: '📦' },
  { label: '下载资产', icon: '⬇️' },
  { label: '安装配置', icon: '⚙️' },
  { label: '验证完整性', icon: '✅' },
];

export function InstallDialog({ asset }: InstallDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [completed, setCompleted] = useState(false);

  const depNames = asset.dependencies;

  const installCmd = `seafood-market install ${asset.type}/@${asset.author.id}/${asset.name}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstall = () => {
    setInstalling(true);
    setCurrentStep(0);
    setCompleted(false);
  };

  // Progress simulation
  useEffect(() => {
    if (!installing || currentStep < 0) return;
    if (currentStep >= installSteps.length) {
      setInstalling(false);
      setCompleted(true);
      return;
    }
    const delay = 600 + Math.random() * 800;
    const timer = setTimeout(() => {
      setCurrentStep(s => s + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [installing, currentStep]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      // Reset state on close
      setInstalling(false);
      setCurrentStep(-1);
      setCompleted(false);
      setCopied(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <button className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue text-white font-semibold text-sm hover:bg-blue-dim transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          安装
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg rounded-lg bg-white border border-card-border p-6 shadow-xl shadow-black/5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-md bg-blue/10 border border-blue/30 flex items-center justify-center text-lg">
              ⚡
            </div>
            <div>
              <Dialog.Title className="text-lg font-bold text-foreground">
                安装 {asset.displayName}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted">
                v{asset.version} · {asset.type}
              </Dialog.Description>
            </div>
          </div>

          {/* Install Command */}
          <div className="mb-5 p-4 rounded-lg bg-surface border border-card-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-blue uppercase tracking-wider">安装命令</span>
              <button
                onClick={handleCopy}
                className="text-xs px-3 py-1 rounded-lg bg-blue/10 text-blue border border-blue/30 hover:bg-blue/20 transition-colors"
              >
                {copied ? '✓ 已复制' : '📋 复制'}
              </button>
            </div>
            <code className="block text-sm font-mono text-foreground bg-paper/50 p-3 rounded-lg overflow-x-auto">
              {installCmd}
            </code>
          </div>

          {/* Compatibility Check */}
          <div className="mb-5 p-4 rounded-lg bg-surface border border-card-border">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">兼容性检查</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-muted">平台：</span>
                <span className="text-foreground">{asset.compatibility.platforms.join(', ')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-muted">模型：</span>
                <span className="text-foreground">{asset.compatibility.models.join(', ')}</span>
              </div>
              {asset.compatibility.frameworks.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-muted">框架：</span>
                  <span className="text-foreground">{asset.compatibility.frameworks.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Dependencies */}
          {depNames.length > 0 && (
            <div className="mb-5 p-4 rounded-lg bg-surface border border-card-border">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                依赖项 ({depNames.length})
              </h4>
              <div className="space-y-1.5">
                {depNames.map(dep => (
                  <div key={dep} className="flex items-center gap-2 text-sm">
                    <span className="text-blue/60">📦</span>
                    <span className="font-mono text-foreground">{dep}</span>
                    <span className="text-xs text-muted ml-auto">将自动安装</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Install Progress */}
          {(installing || completed) && (
            <div className="mb-5 p-4 rounded-lg bg-surface border border-card-border">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
                {completed ? '✅ 安装完成' : '安装进度'}
              </h4>
              <div className="space-y-3">
                {installSteps.map((step, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep && installing;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                        isDone
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : isActive
                          ? 'bg-blue/20 text-blue border border-blue/30'
                          : 'bg-surface text-muted border border-card-border'
                      }`}>
                        {isDone ? '✓' : isActive ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : step.icon}
                      </div>
                      <span className={`text-sm transition-colors ${
                        isDone ? 'text-emerald-400' : isActive ? 'text-blue' : 'text-muted'
                      }`}>
                        {step.label}
                      </span>
                      {isDone && (
                        <span className="text-xs text-muted ml-auto">完成</span>
                      )}
                      {isActive && (
                        <span className="text-xs text-blue ml-auto animate-pulse">进行中...</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="mt-4 h-1.5 rounded-full bg-card-border overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${completed ? 100 : (currentStep / installSteps.length) * 100}%`,
                    background: completed
                      ? 'linear-gradient(90deg, #10b981, #34d399)'
                      : 'linear-gradient(90deg, #60a5fa, #3b82f6)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Success message */}
          {completed && (
            <div className="mb-5 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm text-emerald-400 font-medium">安装成功！</p>
              <p className="text-xs text-muted mt-1">{asset.displayName} 已准备就绪</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="px-4 py-2 rounded-lg text-sm text-muted border border-card-border hover:text-foreground hover:border-card-hover transition-colors">
                {completed ? '关闭' : '取消'}
              </button>
            </Dialog.Close>
            {!completed && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-5 py-2 rounded-lg bg-blue text-white font-semibold text-sm hover:bg-blue-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {installing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    安装中...
                  </>
                ) : (
                  <>⚡ 一键安装</>
                )}
              </button>
            )}
          </div>

          {/* Close button */}
          <Dialog.Close asChild>
            <button className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors" aria-label="Close">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
