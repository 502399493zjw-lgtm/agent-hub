'use client';

const AVATAR_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EF4444', '#06B6D4', '#EC4899', '#6366F1',
] as const;

/** Deterministic color from userId */
export function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface LetterAvatarProps {
  name: string;
  userId: string;
  size?: number;
  className?: string;
}

export function LetterAvatar({ name, userId, size = 40, className = '' }: LetterAvatarProps) {
  const color = getAvatarColor(userId);
  const letter = (name?.[0] ?? '?').toUpperCase();
  const fontSize = Math.round(size * 0.45);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={name}
    >
      <rect
        width={size}
        height={size}
        rx={size * 0.2}
        fill={color}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontWeight="bold"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {letter}
      </text>
    </svg>
  );
}
