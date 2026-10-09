'use client';

import { useEffect, useRef } from 'react';

export interface PollingOptions {
  /** Base interval. */
  everyMs: number;
  /** Random extra delay, so several terminals do not poll in lockstep. */
  jitterMs?: number;
  /** Skip the interval while the tab is hidden. Default true. */
  pauseWhenHidden?: boolean;
}

/**
 * Runs a callback on an interval, pausing while the tab is hidden.
 *
 * A carwash terminal usually sits on one screen and gets alt-tabbed to.
 * Polling behind a hidden tab costs the API work nobody is looking at, and
 * the API is the smallest thing in the stack: at roughly two seconds a
 * request, a dozen idle tabs is a meaningful part of its capacity.
 *
 * Coming back to the tab refreshes immediately, so the operator never looks
 * at stale data after switching back.
 */
export function usePolling(
  callback: () => void,
  { everyMs, jitterMs = 0, pauseWhenHidden = true }: PollingOptions,
) {
  // Keep the latest callback without re-arming the timer on every render.
  // The assignment happens in an effect, not during render: writing a ref while
  // rendering is not allowed in React 19.
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const isHidden = () =>
      pauseWhenHidden && typeof document !== 'undefined' && document.hidden;

    const schedule = () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);

      timer = setTimeout(() => {
        // Read document.hidden HERE, when the timer actually fires, not when
        // it was scheduled. Sampling it at schedule time meant a tab hidden
        // afterwards still fired one poll, and the timer re-armed forever in a
        // background tab - the exact cost this hook exists to avoid.
        if (!isHidden()) latest.current();
        schedule();
      }, everyMs + (jitterMs ? Math.random() * jitterMs : 0));
    };

    const onVisibility = () => {
      if (!pauseWhenHidden) return;
      if (!document.hidden) latest.current();
      schedule();
    };

    schedule();
    if (pauseWhenHidden && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [everyMs, jitterMs, pauseWhenHidden]);
}
