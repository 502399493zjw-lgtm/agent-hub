'use client';

import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { type ReactNode } from 'react';

// Re-export SessionProvider as AuthProvider to minimize changes to layout.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// Compatibility hook that mirrors the old useAuth interface
export function useAuth() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const user = session?.user
    ? {
        id: session.user.id ?? '',
        name: session.user.name ?? '',
        avatar: session.user.image ?? '',
        email: session.user.email ?? '',
        provider: (session.user as Record<string, unknown>).provider as string ?? '',
        inviteCode: (session.user as Record<string, unknown>).inviteCode as string | null ?? null,
        onboardingCompleted: (session.user as Record<string, unknown>).onboardingCompleted as boolean ?? false,
        bio: '',
      }
    : null;

  const logout = () => {
    signOut({ callbackUrl: '/' });
  };

  return { user, isLoading, logout };
}
