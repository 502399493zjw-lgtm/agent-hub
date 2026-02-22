'use client';

// OnboardingGuard is no longer needed — invite code is handled at login time.
// Kept as a passthrough component to avoid breaking layout.tsx imports.
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
