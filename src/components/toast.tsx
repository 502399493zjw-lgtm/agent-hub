'use client';

import { useState, useCallback, useEffect } from 'react';

let globalShowToast: (msg: string) => void = () => {};

export function showToast(msg: string) {
  globalShowToast(msg);
}

export function ToastProvider() {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  useEffect(() => {
    globalShowToast = show;
    return () => { globalShowToast = () => {}; };
  }, [show]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="px-5 py-3 rounded-lg bg-white border border-blue/30 shadow-lg shadow-black/5 flex items-center gap-3">
        <span className="text-blue">✓</span>
        <span className="text-sm text-foreground">{message}</span>
        <button onClick={() => setMessage(null)} className="text-muted hover:text-foreground ml-2 text-xs">✕</button>
      </div>
    </div>
  );
}
