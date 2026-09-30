'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ACTIVITY_EVENTS,
  ACTIVITY_THROTTLE_MS,
  defaultIdleConfig,
  formatCountdown,
  secondsRemaining,
} from '@/lib/idle';

/**
 * Closes a session that nobody is using.
 *
 * A terminal left signed in is an open door, so a few minutes of no input
 * raises a warning with a countdown, and ignoring it signs out. The warning
 * is deliberately modal: it has to be answered, not clicked past, and the
 * only ways out are "stay signed in" or "sign out".
 *
 * Keyboard activity counts, so a code-running terminal is not signed out
 * mid-task.
 */
export default function IdleLogout() {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Zero means "not started yet", so the clock is not read during render.
  const lastActivity = useRef(0);
  const lastRecorded = useRef(0);
  const signingOutRef = useRef(false);
  // Mirrors the visible warning so the timer callback, which is created once,
  // reads the current value rather than a stale one captured at first render.
  const warned = useRef(false);

  useEffect(() => {
    lastActivity.current = Date.now();
  }, []);

  const dismissWarning = useCallback(() => {
    warned.current = false;
    setRemaining(null);
  }, []);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    try {
      await api.logout();
    } catch {
      // A failed sign-out must still clear the browser session, or the token
      // would survive the next person to use the machine.
      api.setToken(null);
    }
    if (typeof window !== 'undefined') {
      document.cookie = 'qhs_session=; Max-Age=0; path=/';
    }
    router.push('/login');
  }, [router]);

  const stay = useCallback(() => {
    lastActivity.current = Date.now();
    dismissWarning();
  }, [dismissWarning]);

  // Track input. Throttled, because pointermove fires continuously and the
  // timers we care about are measured in minutes.
  useEffect(() => {
    const onActivity = () => {
      const now = Date.now();
      if (now - lastRecorded.current < ACTIVITY_THROTTLE_MS) return;
      lastRecorded.current = now;
      lastActivity.current = now;
      // Any sign of life closes the warning. Without this the modal would sit
      // there over an operator who is still working, counting down to a
      // sign-out they never asked for.
      if (warned.current) dismissWarning();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [dismissWarning]);


  // The clock itself. Cheap enough at 1s, and it only re-renders while the
  // warning is actually on screen.
  useEffect(() => {
    const tick = () => {
      if (lastActivity.current === 0) return;
      const idleMs = Date.now() - lastActivity.current;

      if (idleMs >= defaultIdleConfig.signOutAfterMs) {
        void signOut();
        return;
      }

      if (idleMs >= defaultIdleConfig.warnAfterMs) {
        warned.current = true;
        setRemaining(secondsRemaining(idleMs));
      } else if (warned.current) {
        dismissWarning();
      }
    };

    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [signOut, dismissWarning]);

  if (remaining === null && !signingOut) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-detail"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center shadow-2xl">
        <h2 id="idle-title" className="font-display text-lg font-bold">
          {signingOut ? 'Signing you out' : 'Still there?'}
        </h2>

        <p id="idle-detail" className="mt-2 text-sm text-[var(--text-muted)]" aria-live="polite">
          {signingOut
            ? 'Ending this session…'
            : 'You have been idle. For security, this terminal signs you out shortly.'}
        </p>

        {!signingOut && (
          <>
            <p className="mt-4 font-mono text-2xl font-bold" aria-hidden="true">
              {formatCountdown(remaining ?? 0)}
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={stay}
                className="btn btn-primary flex-1 py-3 text-xs font-black uppercase tracking-widest"
              >
                Stay signed in
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="btn btn-outline flex-1 py-3 text-xs font-black uppercase tracking-widest"
              >
                Sign out now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
