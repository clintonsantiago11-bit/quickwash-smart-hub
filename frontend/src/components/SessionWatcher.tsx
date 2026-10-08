'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UNAUTHORIZED_EVENT } from '@/lib/api';

/**
 * Routes to /login when the API rejects the stored token.
 *
 * The API client cannot use the Next.js router itself, so it dispatches an
 * event instead. Handling it here keeps the transition client-side: a hard
 * navigation would reload the whole app and throw away whatever the operator
 * had on screen at the moment their token expired.
 */
export default function SessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const onUnauthorized = () => router.replace('/login');

    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [router]);

  return null;
}
