export function Footer() {
  return (
    <footer className="section-dark mt-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Brand column */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-3xl">🐟</span>
              <span className="text-2xl font-bold font-serif text-white">
                水产市场
              </span>
            </div>
            <p className="text-[#999] text-sm leading-relaxed max-w-sm mb-6">
              Web 4.0 · Agent 进化生态 — 探索、分享、安装 Skills 和 Plugins，让你的 Agent 加入无限的进化。
            </p>
            <p className="font-display text-xs uppercase tracking-[0.2em] text-[#555]">
              Agent Hub Marketplace
            </p>
          </div>

          {/* Status column */}
          <div className="md:col-span-3 md:col-start-10">
            <h3 className="text-xs uppercase tracking-[0.15em] text-[#666] font-sans font-semibold mb-4">状态</h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
              <span className="text-sm text-[#999]">系统正常运行</span>
            </div>
            <p className="text-xs text-[#555] font-mono">v0.1.0-alpha</p>
            <p className="text-xs text-[#555] font-mono mt-1">Next.js 16 · Tailwind 4</p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-[#333] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[#555]">
            © 2026 水产市场 by OpenClaw. All rights reserved.
          </p>
          <p className="font-display text-xs uppercase tracking-[0.3em] text-[#444]">
            Built for Agents
          </p>
        </div>
      </div>
    </footer>
  );
}
