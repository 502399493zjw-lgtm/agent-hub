'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const SKIP_PATHS = ['/login', '/register', '/onboarding', '/api/'];

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;

    // Don't redirect on excluded paths
    if (SKIP_PATHS.some(p => pathname.startsWith(p))) return;

    // If logged in but onboarding not completed, redirect to onboarding
    if (!user.onboardingCompleted) {
      router.replace('/onboarding');
    }
  }, [user, isLoading, pathname, router]);

  return <>{children}</>;
}
