import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { LoginPhase } from '@/lib/auth';

type MachinePhase = Extract<LoginPhase, 'inserting' | 'authenticating' | 'rejecting' | 'success'>;

interface CoinSlotOverlayProps {
  phase: MachinePhase;
  signedInName?: string;
}

/** What the coin reader is doing while the card is dimmed. */
const machineCopy = {
  inserting: {
    title: 'Inserting credential',
    message: 'Feeding the operator coin into the secure reader.',
  },
  authenticating: {
    title: 'Authenticating',
    message: 'The slot is checking your operator access.',
  },
  rejecting: {
    title: 'Coin jammed',
    message: 'The reader rejected it. Pulling the coin back out…',
  },
  success: {
    title: 'Coin accepted',
    message: 'Access granted. Opening your dashboard…',
  },
} as const;

/**
 * The coin mechanism, floated over the whole login card while the credential
 * is being checked. It is deliberately position-absolute so the card never
 * changes height and the fields never shift under the pointer.
 */
export default function CoinSlotOverlay({ phase, signedInName = 'Operator' }: CoinSlotOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const copy = machineCopy[phase];

  // A modal dialog has to take focus when it opens, otherwise the keyboard
  // user is left tabbing around behind the scrim.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Nothing inside the dialog is actionable — the machine is mid-cycle and
  // the form behind the scrim is disabled — so there is nowhere for Tab to
  // go. Swallow it rather than let focus walk out behind the scrim.
  const holdFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    panelRef.current?.focus();
  };

  return (
    <div className="login-coin-overlay" data-phase={phase}>
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={holdFocus}
        className="login-coin-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-coin-overlay-title"
        aria-describedby="login-coin-overlay-message"
      >
        <div className="login-coin-machine" aria-hidden="true">
          <span className="login-coin-guide" />
          <span className="login-coin-drop" />
          <span className="login-coin-slot-track">
            <span className="login-coin-scan" />
            <span className="login-coin-jam" />
          </span>
          <span className="login-coin-return" />
        </div>
        <div className="login-coin-copy">
          <p className="login-verify-title" id="login-coin-overlay-title">{copy.title}</p>
          <p className="login-verify-message" id="login-coin-overlay-message">
            {phase === 'success' ? `${signedInName}, ${copy.message}` : copy.message}
          </p>
        </div>
      </div>
    </div>
  );
}

interface CoinSlotNoticeProps {
  phase: Extract<LoginPhase, 'jam' | 'error'>;
  message: string;
}

const noticeCopy = {
  jam: 'Coin jammed',
  error: 'Sign-in unavailable',
} as const;

/**
 * The resting state after a jam. The coin has already been shown being
 * rejected, so this is a plain message above the fields — the form is live
 * again and the sign-in button below it now reads "Retry coin".
 */
export function CoinSlotNotice({ phase, message }: CoinSlotNoticeProps) {
  return (
    <div
      className={`login-coin-notice login-coin-notice--${phase}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="login-alert-title">{noticeCopy[phase]}</p>
      <p className="login-alert-message">{message}</p>
    </div>
  );
}
