import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-card-border bg-white/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🐟</span>
              <span className="text-xl font-bold font-serif">
                <span className="text-blue">水产</span>市场
              </span>
            </div>
            <p className="text-muted text-sm max-w-md">
              Web 4.0 · Agent 进化生态 — 探索、分享、安装 Skills、Configs 和 Plugins，让你的 Agent 加入无限的进化。
            </p>
            <div className="flex gap-4 mt-4">
              <a href="https://github.com/openclaw" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-blue transition-colors text-sm underline-offset-4 hover:underline">GitHub</a>
              <a href="https://discord.gg/openclaw" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-blue transition-colors text-sm underline-offset-4 hover:underline">Discord</a>
              <a href="https://twitter.com/openclaw" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-blue transition-colors text-sm underline-offset-4 hover:underline">Twitter</a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue mb-3">资源</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/explore" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">探索资产</Link></li>
              <li><a href="#" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">API 参考</a></li>
              <li><a href="#" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">示例项目</a></li>
              <li><a href="#" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">更新日志</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue mb-3">社区</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">论坛</a></li>
              <li><Link href="/publish" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">贡献指南</Link></li>
              <li><a href="#" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">行为准则</a></li>
              <li><a href="#" className="text-muted hover:text-blue transition-colors underline-offset-4 hover:underline">反馈建议</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-card-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted">
            © 2026 水产市场 by OpenClaw. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-xs text-muted font-mono">
              v0.1.0-alpha · <span className="text-green-500">●</span> 系统正常运行
            </p>
            <span className="text-xs text-muted/50 font-mono">Next.js 16 · Tailwind 4</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
