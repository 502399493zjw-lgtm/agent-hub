'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Registration is now handled through OAuth. Redirect to login.
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="text-muted">跳转到登录页...</div>
    </div>
  );
}
