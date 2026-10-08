'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ACTIVITY_EVENTS,
  ACTIVITY_THROTTLE_MS,
  defaultIdleConfig,
  formatCountdown,
  idleSignInHref,
  secondsRemaining,
} from '@/lib/idle';

/**
 * Closes a session that nobody is using.
 *
 * A terminal left signed in is an open door, so a few minutes of no input
 * raises a warning with a countdown, and ignoring it signs you out.
 *
 * Once the warning is up it has to be answered with a button. It used to be
 * dismissed by any input at all, which broke it completely: pointerdown is an
 * activity event, so reaching for a button tore the dialog down on mouse-down
 * and the click never landed on anything. Both buttons were dead and the only
 * way out was to wait it out.
 *
 * So while the warning is showing, activity does nothing. It cannot dismiss
 * the dialog and it cannot reset the clock. The sign-out deadline keeps
 * running, so ignoring it still signs you out.
 *
 * This component lives in the root layout and so survives navigation. The
 * remount below is what keeps a completed sign-out from leaving the overlay
 * stranded on top of the next page.
 */
export default function IdleLogout() {
  const pathname = usePathname();

  // Nothing to guard while signed out. Rendering on the sign-in page is what
  // left a full-screen overlay stuck there swallowing every click, so the
  // operator had to refresh the browser to get their page back.
  if (pathname === '/login') return null;

  // Keyed on the route so a fresh page starts with a clean clock and a clean
  // set of latches. Moving between pages is itself activity, so re-arming here
  // is also the right behaviour: someone working across the dashboard should
  // not be signed out for it.
  return <IdleWatcher key={pathname} />;
}

function IdleWatcher() {
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const stayRef = useRef<HTMLButtonElement>(null);

  // True only while the dialog is on screen. Named so the focus effect has a
  // plain boolean to depend on rather than an inline expression.
  const warningVisible = remaining !== null;

  useEffect(() => {
    lastActivity.current = Date.now();
  }, []);

  /**
   * Keeps focus inside the dialog. aria-modal alone does not do this, so
   * without it Tab walks straight out of the warning and into the page behind
   * it, which an operator cannot see is still there.
   */
  useEffect(() => {
    if (!warningVisible) return;

    stayRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [warningVisible]);

  const signOut = useCallback(async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);

    // Clear the browser session first, before any network call.
    //
    // This used to await the server logout before clearing anything, and the
    // dashboard answers that request in several seconds. The operator watched a
    // dead "Signing you out" overlay for the whole time with no way out, and a
    // slow response left them stuck. Nothing about leaving needs the server to
    // agree first: the local token and cookie are what make the session.
    api.setToken(null);
    if (typeof document !== 'undefined') {
      document.cookie = 'qhs_session=; Max-Age=0; path=/';
    }

    // Tell the server afterwards, without waiting on it. A failure only leaves
    // the token row behind, which expires on its own.
    void api.logout().catch(() => undefined);

    // reason=idle lets the sign-in page explain what happened and offer a way
    // back in, rather than the operator arriving at a bare form wondering why
    // they were thrown out.
    router.push(idleSignInHref());
  }, [router]);

  const dismissWarning = useCallback(() => {
    warned.current = false;
    setRemaining(null);
  }, []);

  const stay = useCallback(() => {
    lastActivity.current = Date.now();
    dismissWarning();
  }, [dismissWarning]);

  // Track input. Throttled, because pointermove fires continuously and the
  // timers we care about are measured in minutes.
  useEffect(() => {
    const onActivity = () => {
      // Once the warning is up, input is ignored entirely. Not dismissing here
      // is only half the fix: resetting the clock would trip the tick's own
      // clear branch a moment later and tear the dialog down anyway, which is
      // the same bug by another route.
      if (warned.current) return;

      const now = Date.now();
      if (now - lastRecorded.current < ACTIVITY_THROTTLE_MS) return;
      lastRecorded.current = now;
      lastActivity.current = now;
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, []);

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

      // Only ever raise the warning here. Clearing it on a quiet period would
      // undo a decision the operator has not made yet.
      if (!warned.current && idleMs >= defaultIdleConfig.warnAfterMs) {
        warned.current = true;
        setRemaining(secondsRemaining(idleMs));
      } else if (warned.current) {
        setRemaining(secondsRemaining(idleMs));
      }
    };

    const timer = setInterval(tick, 1000);

    // Browsers throttle timers in a background tab, so the clock stops while
    // it is hidden and the first tick on return can land past the sign-out
    // deadline at once. Coming back to the tab would then sign the operator
    // out with no warning at all, which reads as the site throwing them out
    // rather than the site protecting them.
    //
    // A tab that was hidden is given the warning instead, on the reasoning that
    // returning to the machine is itself the activity it should count as, and
    // the sign-out still happens if they walk away again.
    const onVisibility = () => {
      if (document.hidden || warned.current) return;

      const idleMs = Date.now() - lastActivity.current;
      if (idleMs >= defaultIdleConfig.warnAfterMs) {
        warned.current = true;
        lastActivity.current = Date.now();
        setRemaining(secondsRemaining(0));
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [signOut]);

  if (remaining === null && !signingOut) return null;

  return (
    <div
      ref={dialogRef}
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
                ref={stayRef}
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