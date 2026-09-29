'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/ui/ErrorState';

/**
 * Catches a render crash so one broken page cannot blank the whole hub.
 * `reset` re-renders the segment, which is cheaper than a full reload.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the detail in the console for the operator; the UI stays plain.
    console.error('Route error:', error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-6">
      <ErrorState
        title="This page ran into a problem"
        message={
          error.message
            ? `The page could not be displayed: ${error.message}`
            : 'The page could not be displayed.'
        }
        onRetry={reset}
      />
    </div>
  );
}
