/* ==================================================================
 * Idle session handling. A shared terminal left signed in is an open
 * door, so an unattended session is warned and then closed. The
 * timing lives here, pure, so it can be tested without a clock.
 * ================================================================== */

/** Idle for this long and the operator is warned. */
export const IDLE_WARN_AFTER_MS = 5 * 60 * 1000;

/**
 * How long the warning stays up before signing out anyway. Long enough to
 * read it and click, short enough that walking away does not leave a live
 * session indefinitely.
 */
export const IDLE_SIGNOUT_AFTER_MS = IDLE_WARN_AFTER_MS + 60 * 1000;

/**
 * Query flag carried to the sign-in page after an idle sign-out, so the
 * operator is told what happened and handed a way back in instead of landing
 * on a bare login form and wondering why they were thrown out.
 */
export const IDLE_REASON_PARAM = 'reason';
export const IDLE_REASON_VALUE = 'idle';

export function idleSignInHref(): string {
  return `/login?${IDLE_REASON_PARAM}=${IDLE_REASON_VALUE}`;
}

/** True when this visit to /login follows an idle sign-out. */
export function isIdleSignIn(search: string): boolean {
  return new URLSearchParams(search).get(IDLE_REASON_PARAM) === IDLE_REASON_VALUE;
}

/** The sign-in URL with the idle notice stripped, used by its close button. */
export function clearIdleSignInHref(): string {
  return '/login';
}

export type IdlePhase = 'active' | 'warning';
export interface IdleConfig {
  warnAfterMs: number;
  signOutAfterMs: number;
}

export const defaultIdleConfig: IdleConfig = {
  warnAfterMs: IDLE_WARN_AFTER_MS,
  signOutAfterMs: IDLE_SIGNOUT_AFTER_MS,
};

/** Events that count as the operator still being present. */
export const ACTIVITY_EVENTS = [
  'pointerdown',
  'pointermove',
  'keydown',
  'wheel',
  'touchstart',
  'focus',
] as const;

/**
 * The phase for a session idle for `idleMs`, measured from the last activity.
 * A negative idle time means activity happened just now.
 */
export function idlePhase(idleMs: number, config: IdleConfig = defaultIdleConfig): IdlePhase {
  return idleMs >= config.warnAfterMs ? 'warning' : 'active';
}

/** Whole seconds left on the warning, never negative. */
export function secondsRemaining(
  idleMs: number,
  config: IdleConfig = defaultIdleConfig
): number {
  return Math.max(0, Math.ceil((config.signOutAfterMs - idleMs) / 1000));
}

/** "4:59" style countdown for the warning. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** True once the grace period is over and the session should be closed. */
export function shouldSignOut(idleMs: number, config: IdleConfig = defaultIdleConfig): boolean {
  return idleMs >= config.signOutAfterMs;
}

/**
 * Throttling the activity listener. A busy mouse fires pointermove dozens of
 * times a second; re-arming a timer on each one is wasted work on a shared
 * terminal, and the timers we care about are measured in minutes.
 */
export const ACTIVITY_THROTTLE_MS = 1000;

export function shouldRearm(lastRecordedAt: number, now: number, throttleMs = ACTIVITY_THROTTLE_MS): boolean {
  return now - lastRecordedAt >= throttleMs;
}
