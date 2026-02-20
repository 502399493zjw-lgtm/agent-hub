'use client';

import { useState } from 'react';

interface StarButtonProps {
  initialCount: number;
  initialStarred?: boolean;
  size?: 'sm' | 'md';
}

export function StarButton({ initialCount, initialStarred = false, size = 'md' }: StarButtonProps) {
  const [starred, setStarred] = useState(initialStarred);
  const [count, setCount] = useState(initialCount);
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    setAnimating(true);
    if (starred) {
      setCount(c => c - 1);
    } else {
      setCount(c => c + 1);
    }
    setStarred(s => !s);
    setTimeout(() => setAnimating(false), 600);
  };

  const sizeClasses = size === 'sm'
    ? 'px-2.5 py-1 text-xs gap-1.5'
    : 'px-3.5 py-1.5 text-sm gap-2';

  return (
    <button
      onClick={handleClick}
      className={`group relative inline-flex items-center rounded-lg border font-medium transition-all duration-300 ${sizeClasses} ${
        starred
          ? 'bg-blue/15 text-blue border-blue/40 shadow-sm shadow-black/5'
          : 'bg-white text-muted border-card-border hover:border-blue/30 hover:text-blue'
      }`}
    >
      {/* Star icon */}
      <svg
        className={`transition-all duration-300 ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
          animating ? 'scale-125' : 'scale-100'
        } ${starred ? 'text-blue' : 'text-muted group-hover:text-blue'}`}
        fill={starred ? 'currentColor' : 'none'}
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>

      {/* Sparkle animation on star */}
      {animating && starred && (
        <>
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue animate-ping opacity-75" />
          <span className="absolute top-0 left-1 w-1.5 h-1.5 rounded-full bg-blue/60 animate-ping opacity-50" style={{ animationDelay: '150ms' }} />
          <span className="absolute -bottom-0.5 right-2 w-1 h-1 rounded-full bg-blue/40 animate-ping opacity-50" style={{ animationDelay: '300ms' }} />
        </>
      )}

      <span className="font-medium">Star</span>

      {/* Count badge */}
      <span className={`px-1.5 py-0.5 rounded text-xs font-mono transition-colors ${
        starred
          ? 'bg-blue/20 text-blue'
          : 'bg-surface text-muted'
      }`}>
        {count}
      </span>
    </button>
  );
}
