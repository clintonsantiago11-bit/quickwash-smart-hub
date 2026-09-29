'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Shown when a page's data cannot be loaded. Replaces the old pattern of
 * logging a console warning and leaving an empty shell on screen, which
 * looked identical to a slow load.
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this page. The hub may be unreachable.',
  onRetry,
  compact = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={`card flex flex-col items-center text-center ${compact ? 'p-6' : 'p-10'}`}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-hover)]">
        <AlertTriangle size={26} className="text-[var(--danger)]" aria-hidden="true" />
      </div>
      <h2 className="font-display text-base font-bold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">{message}</p>

      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-primary mt-6 flex items-center gap-2">
          <RotateCcw size={15} aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}
