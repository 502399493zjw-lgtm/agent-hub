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
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const links = [
    { href: '/', label: '首页' },
    { href: '/explore', label: '探索' },
  ];

  // Track scroll for border effect
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    <nav
      className={`sticky top-0 z-50 border-b bg-[#faf8f4]/80 backdrop-blur-md transition-[border-color,background-color] duration-200 ${
        scrolled ? 'border-card-border bg-[#faf8f4]/95' : 'border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className="text-2xl">🐟</span>
            <span className="text-xl font-bold tracking-tight font-serif text-foreground">
              水产市场
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-[color] duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 focus-visible:ring-offset-2 rounded-sm ${
                  pathname === link.href ? 'text-foreground' : 'text-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Search input - hidden on mobile */}
          <form onSubmit={handleNavSearch} className="hidden lg:flex items-center flex-1 max-w-xs">
            <label htmlFor="nav-search" className="sr-only">全局搜索</label>
            <div className="relative w-full">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="nav-search"
                type="text"
                value={navSearch}
                onChange={e => setNavSearch(e.target.value)}
                placeholder="全局搜索…"
                className="w-full pl-8 pr-3 py-1.5 rounded-full bg-surface border border-card-border text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 transition-[border-color] duration-150"
              />
            </div>
          </form>

          {/* Desktop right area */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted mr-2">
                <span title="声望">★ {user.reputation}</span>
                <span className="text-muted/30">|</span>
                <span title="养虾币">🦐 {user.shrimpCoins}</span>
              </div>
            )}
            <NotificationBell />

            {isLoading ? (
              <div className="w-20 h-8 rounded-full bg-white animate-pulse" />
            ) : user ? (
              /* Logged in: Avatar + Dropdown */
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="用户菜单"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-card-border hover:border-foreground/15 transition-[border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50"
                >
                  <UserAvatar size="sm" />
                  <span className="text-sm text-muted max-w-[100px] truncate">{user.name}</span>
                  <svg
                    className={`w-3 h-3 text-muted transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-card-border rounded-lg shadow-lg shadow-black/5 overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-card-border flex items-center gap-3">
                      <UserAvatar size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted truncate">{user.email}</p>
                      </div>
                    </div>
                    <div className="py-1">
                      <Link
                        href={`/user/${user.id}`}
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-surface transition-[color,background-color] duration-150"
                      >
                        我的主页
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-surface transition-[color,background-color] duration-150"
                      >
                        设置
                      </Link>
                    </div>
                    <div className="border-t border-card-border py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red hover:bg-surface transition-[background-color] duration-150"
                      >
                        退出登录
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Not logged in: Register + Login buttons */
              <>
                <Link
                  href="/register"
                  className="px-5 py-1.5 rounded-full text-sm font-medium border border-blue text-blue hover:bg-blue/5 transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50"
                >
                  注册
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-1.5 rounded-full text-sm font-medium bg-blue text-white hover:bg-blue-dim transition-[background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50"
                >
                  登录
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden p-2 text-muted hover:text-foreground transition-[color] duration-150"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
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
              <label htmlFor="nav-search-mobile" className="sr-only">全局搜索</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  id="nav-search-mobile"
                  type="text"
                  value={navSearch}
                  onChange={e => setNavSearch(e.target.value)}
                  placeholder="全局搜索…"
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-surface border border-card-border text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue/50 transition-[border-color] duration-150"
                />
              </div>
            </form>
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-[color,background-color] duration-150 hover:bg-white ${
                  pathname === link.href ? 'text-foreground bg-white' : 'text-muted'
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
                    href={`/user/${user.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-muted hover:bg-white"
                  >
                    我的主页
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm text-muted hover:bg-white"
                  >
                    设置
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false); }}
                    className="block w-full text-left px-3 py-2 rounded-lg text-sm text-red hover:bg-white"
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <div className="px-3 flex gap-2">
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 block text-center px-4 py-2 rounded-full text-sm font-medium border border-blue text-blue hover:bg-blue/5 transition-[background-color] duration-150"
                  >
                    注册
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 block text-center px-4 py-2 rounded-full text-sm font-medium bg-blue text-white hover:bg-blue-dim transition-[background-color] duration-150"
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
