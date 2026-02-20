'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'agent-hub-favorites';

function getFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFavorites(ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

// Simple global event system so all components stay in sync
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach(fn => fn());
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load on mount + subscribe to cross-component changes
  useEffect(() => {
    setFavorites(getFavorites());
    const handler = () => setFavorites(getFavorites());
    listeners.add(handler);
    // Also listen for storage events from other tabs
    window.addEventListener('storage', handler);
    return () => {
      listeners.delete(handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const current = getFavorites();
    const next = current.includes(id)
      ? current.filter(fid => fid !== id)
      : [...current, id];
    saveFavorites(next);
    setFavorites(next);
    notify();
    return !current.includes(id); // returns new state: true=added, false=removed
  }, []);

  const isFavorite = useCallback((id: string) => {
    return favorites.includes(id);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
