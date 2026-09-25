import type { LoginPhase } from '@/lib/auth';

type FeedbackPhase = Exclude<LoginPhase, 'idle'>;

interface CoinSlotFeedbackProps {
  phase: FeedbackPhase;
  signedInName?: string;
}

const feedbackCopy = {
  inserting: {
    title: 'Inserting credential',
    message: 'Feeding the operator coin into the secure reader.',
  },
  authenticating: {
    title: 'Authenticating',
    message: 'The slot is checking your operator access.',
  },
  jam: {
    title: 'Coin jammed',
    message: 'The credential was rejected. Remove it and retry.',
  },
  success: {
    title: 'Coin accepted',
    message: 'Access granted. Opening your dashboard…',
  },
  error: {
    title: 'Sign-in unavailable',
    message: 'The reader could not verify this attempt. Try again.',
  },
} as const;

export default function CoinSlotFeedback({ phase, signedInName = 'Operator' }: CoinSlotFeedbackProps) {
  const copy = feedbackCopy[phase];

  return (
    <div
      className={`login-coin-feedback login-coin-feedback--${phase}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
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
        <p className="login-verify-title">{copy.title}</p>
        <p className="login-verify-message">
          {phase === 'success' ? `${signedInName}, ${copy.message}` : copy.message}
        </p>
      </div>
    </div>
  );
}
