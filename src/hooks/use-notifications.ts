'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'agent-hub-notifications-read';

function getReadIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

const listeners = new Set<() => void>();
function notify() { listeners.forEach(fn => fn()); }

export function useNotifications() {
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(getReadIds());
    const handler = () => setReadIds(getReadIds());
    listeners.add(handler);
    window.addEventListener('storage', handler);
    return () => {
      listeners.delete(handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    const current = getReadIds();
    if (!current.includes(id)) {
      const next = [...current, id];
      saveReadIds(next);
      setReadIds(next);
      notify();
    }
  }, []);

  const markAllAsRead = useCallback((ids: string[]) => {
    const current = getReadIds();
    const next = Array.from(new Set([...current, ...ids]));
    saveReadIds(next);
    setReadIds(next);
    notify();
  }, []);

  const isRead = useCallback((id: string) => readIds.includes(id), [readIds]);

  return { readIds, markAsRead, markAllAsRead, isRead };
}
