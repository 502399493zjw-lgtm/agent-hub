'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { NotificationBell } from '@/components/notification-bell';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: '/', label: '首页' },
    { href: '/explore', label: '探索' },
    { href: '/guide', label: '安装' },
    { href: '/publish', label: '发布' },
  ];

  const handleNavSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      router.push(`/explore?q=${encodeURIComponent(navSearch.trim())}`);
      setNavSearch('');
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
  };

  // Render user avatar (img or emoji fallback)
  const UserAvatar = ({ size = 'sm' }: { size?: 'sm' | 'md' }) => {
    const sizeClass = size === 'md' ? 'w-8 h-8' : 'w-6 h-6';
    if (user?.avatar && user.avatar.startsWith('http')) {
      return (
        <img
          src={user.avatar}
          alt={user.name}
          className={`${sizeClass} rounded-full object-cover`}
          referrerPolicy="no-referrer"
        />
      );
    }
    return <span className={size === 'md' ? 'text-lg' : 'text-sm'}>{user?.avatar || '👤'}</span>;
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-card-border bg-[#faf8f4]/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="text-2xl">🐟</span>
            <span className="text-xl font-bold tracking-tight font-serif">
              <span className="text-blue">水产</span>
              <span className="text-foreground">市场</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-blue ${
                  pathname === link.href ? 'text-blue' : 'text-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search input - hidden on mobile */}
          <form onSubmit={handleNavSearch} className="hidden lg:flex items-center flex-1 max-w-xs">
            <div className="relative w-full">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={navSearch}
                onChange={e => setNavSearch(e.target.value)}
                placeholder="全局搜索..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface border border-card-border text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
              />
            </div>
          </form>

          {/* Desktop right area */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <NotificationBell />

            {isLoading ? (
              <div className="w-20 h-8 rounded-lg bg-white animate-pulse" />
            ) : user ? (
              /* Logged in: Avatar + Dropdown */
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-card-border hover:border-blue/30 transition-colors"
                >
                  <UserAvatar size="sm" />
                  <span className="text-sm text-muted max-w-[100px] truncate">{user.name}</span>
                  <svg
                    className={`w-3 h-3 text-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-card-border rounded-xl shadow-lg shadow-black/5 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-card-border flex items-center gap-3">
                      <UserAvatar size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-surface transition-colors"
                      >
                        ⚙️ 设置
                      </Link>
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-surface transition-colors"
                      >
                        📊 Dashboard
                      </Link>
                    </div>
                    <div className="border-t border-card-border py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red hover:bg-surface transition-colors"
                      >
                        🚪 退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not logged in: Login button */
              <Link
                href="/login"
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue text-white hover:bg-blue-dim transition-colors"
              >
                登录
              </Link>
            )}
          </div>

          <button
            className="md:hidden p-2 text-muted hover:text-blue transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {/* Mobile search */}
            <form onSubmit={(e) => { handleNavSearch(e); setMobileOpen(false); }} className="px-3 pb-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={navSearch}
                  onChange={e => setNavSearch(e.target.value)}
                  placeholder="全局搜索..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface border border-card-border text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-blue/50 transition-colors"
                />
              </div>
            </form>
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white ${
                  pathname === link.href ? 'text-blue bg-white' : 'text-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Mobile auth area */}
            <div className="border-t border-card-border mt-2 pt-2">
              {user ? (
                <>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <UserAvatar size="sm" />
                    <span className="text-sm text-foreground">{user.name}</span>
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-muted hover:bg-white"
                  >
                    ⚙️ 设置
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-red hover:bg-white"
                  >
                    🚪 退出登录
                  </button>
                </>
              ) : (
                <div className="px-3">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block text-center px-4 py-2 rounded-lg text-sm font-medium bg-blue text-white hover:bg-blue-dim transition-colors"
                  >
                    登录
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
