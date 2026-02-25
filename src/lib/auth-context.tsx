'use client';

import { SessionProvider, useSession, signOut } from 'next-auth/react';
import { type ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// Re-export SessionProvider as AuthProvider to minimize changes to layout.tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <NewUserRedirect />
      {children}
    </SessionProvider>
  );
}

/**
 * Detect new users (no devices bound) and redirect to onboarding.
 * Works for both OAuth and email login flows.
 */
function NewUserRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'authenticated') return;
    const isNew = (session?.user as Record<string, unknown>)?.isNewUser;
    // Only redirect if not already on settings/login/register pages
    if (isNew && pathname && !pathname.startsWith('/settings') && !pathname.startsWith('/login') && !pathname.startsWith('/register')) {
      router.replace('/settings?section=devices&welcome=1');
    }
  }, [status, session, pathname, router]);

  return null;
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
