'use client';

import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { type ReactNode } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Re-export SessionProvider as AuthProvider to minimize changes to layout.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

// Compatibility hook that mirrors the old useAuth interface
export function useAuth() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const userId = session?.user?.id;

  // Fetch extended user data (reputation, coins) — only when logged in
  const { data: meData } = useSWR(
    userId ? '/api/auth/me' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const user = session?.user
    ? {
        id: session.user.id ?? '',
        name: session.user.name ?? '',
        avatar: session.user.image ?? '',
        email: session.user.email ?? '',
        provider: (session.user as Record<string, unknown>).provider as string ?? '',
        inviteCode: (session.user as Record<string, unknown>).inviteCode as string | null ?? null,
        bio: '',
        reputation: meData?.data?.reputation ?? 0,
        shrimpCoins: meData?.data?.shrimpCoins ?? 0,
      }
    : null;

  const logout = () => {
    signOut({ callbackUrl: '/' });
  };

  return { user, isLoading, logout };
}
