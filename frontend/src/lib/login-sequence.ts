/* ==================================================================
 * Login sequence timing — how the coin behaves while the credential
 * is checked. Kept pure and separate from the page so the waits can be
 * reasoned about (and tested) without a browser or a network.
 * ================================================================== */

/** How long the coin takes to fall into the slot. */
export const COIN_INSERT_MS = 520;

/**
 * A result arriving sooner than this is shown straight away. Without it a
 * fast API would flash a coin that never visibly dropped.
 */
export const COIN_MIN_VISIBLE_MS = 300;

/** The coin stopping dead in the reader and rattling. */
export const COIN_REJECT_MS = 280;

/** The coin being thrown back out of the reader. */
export const COIN_EJECT_MS = 420;

/** How long the card stays on the success panel before redirecting. */
export const REDIRECT_MS = 900;

export type PendingPhase = 'inserting' | 'authenticating';

/** What the request produced: accepted, a rejected credential, or a failure. */
export type OutcomeKind = 'ok' | 'credentials' | 'network' | 'timeout' | 'server' | 'unknown';

/** The phase the coin is showing while the request is still in flight. */
export function phaseWhilePending(elapsedMs: number): PendingPhase {
  return elapsedMs < COIN_INSERT_MS ? 'inserting' : 'authenticating';
}

/**
 * Whether a settled result has to wait for the coin to finish dropping.
 * Below the minimum we skip the rest of the animation; otherwise the
 * sequence is never cut off half way through.
 */
export function shouldHoldResult(elapsedMs: number): boolean {
  return elapsedMs >= COIN_MIN_VISIBLE_MS && elapsedMs < COIN_INSERT_MS;
}

/**
 * Where a settled result lands. Only a credential the reader rejected
 * jams the coin; a network or server problem leaves it as a plain fault.
 */
export function terminalPhase(kind: OutcomeKind): 'success' | 'rejecting' | 'error' {
  if (kind === 'ok') return 'success';
  if (kind === 'credentials') return 'rejecting';
  return 'error';
}

/** Total time the jam animation needs before the resting state is safe. */
export function totalRejectMs(): number {
  return COIN_REJECT_MS + COIN_EJECT_MS;
}
