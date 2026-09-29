'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CoinSlotOverlay, { type MachinePhase } from './CoinSlotOverlay';
import { previewTimeline } from '@/lib/login-sequence';

/**
 * Plays the coin reader on demand so it can be reviewed without signing out.
 *
 * The durations come from login-sequence.ts, the same constants the real
 * sign-in uses, so what you watch here is what an operator actually sees.
 * It only ever animates: there is no code path here that authenticates
 * anyone or grants a session, which is what makes it safe to ship.
 */
export default function CoinSlotPreview({ onDismiss }: { onDismiss: () => void }) {
  // The first step is the initial state rather than something set inside an
  // effect, so mounting shows the coin immediately with no extra render pass.
  const [phase, setPhase] = useState<MachinePhase | null>(() => previewTimeline()[0].phase);
  // Bumped on restart so the overlay remounts and its CSS animations replay.
  const [run, setRun] = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    setPhase(null);
    onDismiss();
  }, [clearTimers, onDismiss]);

  const replay = useCallback(() => {
    setRun((n) => n + 1);
    setPhase(previewTimeline()[0].phase);
  }, []);

  // Schedule only the transitions after the first step; the first is already
  // rendered. Every setState here happens inside a timer callback, not in the
  // effect body, so nothing cascades on mount.
  useEffect(() => {
    const steps = previewTimeline();

    let elapsed = 0;
    steps.forEach((step, index) => {
      elapsed += step.afterMs;
      timers.current.push(setTimeout(() => {
        if (index === steps.length - 1) {
          clearTimers();
          setPhase(null);
          // Dismiss as well as hide. Without this the component stays mounted
          // rendering nothing, and the parent's "show" state is already true,
          // so a second click would be a no-op and the preview would never
          // replay.
          onDismiss();
          return;
        }
        setPhase(steps[index + 1].phase);
      }, elapsed));
    });

    return clearTimers;
  }, [run, clearTimers, onDismiss]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [stop]);

  if (phase === null) return null;

  return (
    <>
      <CoinSlotOverlay key={run} phase={phase} />
      <button
        type="button"
        onClick={() => {
          replay();
        }}
        className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-bold text-[var(--text-muted)] shadow-lg transition-colors hover:text-[var(--text-primary)]"
      >
        Replay
      </button>
      <button
        type="button"
        onClick={stop}
        className="fixed bottom-5 right-5 z-[70] rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-bold text-[var(--text-muted)] shadow-lg transition-colors hover:text-[var(--text-primary)]"
      >
        Close
      </button>
    </>
  );
}

/** The button that starts the preview. */
export function ReplayCoinReader({ onPlay }: { onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
      Replay coin reader
    </button>
  );
}
