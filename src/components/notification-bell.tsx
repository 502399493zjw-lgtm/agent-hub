'use client';

import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, useEffect, useCallback } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  icon: string;
  linkTo?: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) setNotifications(json.data);
      })
      .catch(() => {});
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markRead', id }),
    }).catch(() => {});
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markAllRead' }),
    }).catch(() => {});
  }, []);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="relative p-2 rounded-lg border border-card-border hover:border-foreground/15 transition-colors text-muted hover:text-foreground">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red text-background text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 max-h-96 overflow-y-auto rounded-lg border border-card-border bg-white shadow-xl shadow-black/40"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
            <span className="text-sm font-semibold text-foreground">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue hover:text-blue-dim transition-colors"
              >
                全部已读
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">暂无通知</div>
          ) : (
            notifications.map(notification => {
              const timeAgo = getTimeAgo(notification.createdAt);

              const content = (
                <div
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface cursor-pointer ${!notification.read ? 'bg-surface' : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <span className="text-lg shrink-0 mt-0.5">{notification.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${!notification.read ? 'text-foreground' : 'text-muted'}`}>{notification.title}</span>
                      {!notification.read && <span className="w-1.5 h-1.5 rounded-full bg-blue" />}
                    </div>
                    <p className="text-sm text-muted mt-0.5 line-clamp-1">{notification.message}</p>
                    <span className="text-[10px] text-muted/60 mt-1 block">{timeAgo}</span>
                  </div>
                </div>
              );

              return (
                <DropdownMenu.Item key={notification.id} asChild className="outline-none">
                  {notification.linkTo ? (
                    <Link href={notification.linkTo}>{content}</Link>
                  ) : (
                    <div>{content}</div>
                  )}
                </DropdownMenu.Item>
              );
            })
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date('2026-02-18T21:00:00');
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHr < 24) return `${diffHr}小时前`;
  return `${diffDay}天前`;
}
