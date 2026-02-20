'use client';

import { useState } from 'react';

interface FollowButtonProps {
  initialFollowing?: boolean;
  onToggle?: (following: boolean) => void;
  size?: 'sm' | 'md';
}

export function FollowButton({ initialFollowing = false, onToggle, size = 'md' }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    const newState = !following;
    setFollowing(newState);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);
    onToggle?.(newState);
  };

  const sizeClasses = size === 'sm'
    ? 'px-3 py-1 text-xs'
    : 'px-4 py-1.5 text-sm';

  return (
    <button
      onClick={handleClick}
      className={`relative inline-flex items-center gap-1.5 rounded-lg font-medium transition-all duration-300 ${sizeClasses} ${
        following
          ? 'bg-blue/10 text-blue border border-blue/30 hover:bg-red/10 hover:text-red hover:border-red/30'
          : 'bg-blue text-white hover:bg-blue-dim'
      } ${animating ? 'scale-95' : 'scale-100'}`}
    >
      {following ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="group-hover:hidden">已关注</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>关注</span>
        </>
      )}
    </button>
  );
}
