import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { LoginPhase } from '@/lib/auth';

type MachinePhase = Extract<LoginPhase, 'inserting' | 'authenticating' | 'rejecting' | 'success'>;

interface CoinSlotOverlayProps {
  phase: MachinePhase;
  signedInName?: string;
}

/** What the reader is doing while the card is behind the scrim. */
const machineCopy = {
  inserting: {
    title: 'Inserting credential',
    detail: 'Feeding the coin into the reader.',
  },
  authenticating: {
    title: 'Authenticating',
    detail: 'Reading the credential.',
  },
  rejecting: {
    title: 'Coin rejected',
    detail: 'The reader is returning the coin.',
  },
  success: {
    title: 'Access granted',
    detail: 'Opening your dashboard…',
  },
} as const;

/**
 * A full-screen scrim with the coin mechanism on a card-sized stage in the
 * middle of it. While a credential is being checked the login card behind is
 * completely obscured, so the only thing to look at is the machine.
 */
export default function CoinSlotOverlay({ phase, signedInName = 'Operator' }: CoinSlotOverlayProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const copy = machineCopy[phase];

  // A modal dialog has to take focus when it opens, otherwise the keyboard
  // user is left tabbing around behind the scrim.
  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  // Nothing on this stage is actionable — the machine is mid-cycle and the
  // form behind is disabled — so there is nowhere for Tab to go. Hold it.
  const holdFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    stageRef.current?.focus();
  };

  return (
    <div className="slot-scrim" data-phase={phase}>
      <div
        ref={stageRef}
        tabIndex={-1}
        onKeyDown={holdFocus}
        className="slot-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-stage-title"
        aria-describedby="slot-stage-detail"
      >
        <div className="slot-mech" aria-hidden="true">
          <div className="slot-acceptor">
            <span className="slot-screw slot-screw--tl" />
            <span className="slot-screw slot-screw--tr" />
            <span className="slot-screw slot-screw--bl" />
            <span className="slot-screw slot-screw--br" />

            <div className="slot-bezel">
              <div className="slot-face">
                <span className="slot-mouth" />
                <span className="slot-slit">
                  <span className="slot-beam" />
                  <span className="slot-blocker" />
                </span>
              </div>
            </div>

            <span className="slot-led" />
            <span className="slot-plunger" />
            <span className="slot-engraving">Insert coin</span>
          </div>

          <div className="slot-slotway">
            <span className="slot-coin">
              <span className="slot-coin-face" />
              <span className="slot-coin-back" />
            </span>
          </div>
        </div>

        <div className="slot-readout">
          <p className="slot-readout-title" id="slot-stage-title">{copy.title}</p>
          <p className="slot-readout-detail" id="slot-stage-detail">
            {phase === 'success' ? `${signedInName}. ${copy.detail}` : copy.detail}
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
  jam: 'Coin rejected',
  error: 'Sign-in unavailable',
} as const;

/**
 * The resting state after a jam. The coin has already been shown being
 * returned, so this is a plain message above the fields — the form is live
 * again and the sign-in button below it now reads "Retry coin".
 */
export function CoinSlotNotice({ phase, message }: CoinSlotNoticeProps) {
  return (
    <div
      className={`slot-notice slot-notice--${phase}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="slot-notice-title">{noticeCopy[phase]}</p>
      <p className="slot-notice-detail">{message}</p>
    </div>
  );
}
