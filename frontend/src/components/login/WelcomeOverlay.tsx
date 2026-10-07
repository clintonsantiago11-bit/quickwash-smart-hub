'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface WelcomeOverlayProps {
  text: string;
  detail: string;
  /** Skip the wait and go straight through. */
  onSkip: () => void;
}

/**
 * Shown after a successful sign-in.
 *
 * On a terminal shared by several operators this is the moment that matters:
 * it is how the next person knows who is currently signed in, so the name,
 * role and facility are all on screen rather than buried in a dropdown.
 *
 * Clicking anywhere skips the wait. It never traps focus — the redirect is
 * already automatic, and a dialog here would be one more thing to dismiss.
 */
export default function WelcomeOverlay({ text, detail, onSkip }: WelcomeOverlayProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      className="login-welcome"
      role="status"
      aria-live="polite"
      onClick={onSkip}
    >
      <div className="login-welcome-card">
        <span className="login-welcome-mark" aria-hidden="true">
          <CheckCircle2 size={30} />
        </span>

        <h2 className="login-welcome-title">{text}</h2>
        <p className="login-welcome-detail">{detail}</p>

        <button
          ref={ref}
          type="button"
          onClick={onSkip}
          className="login-welcome-go"
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}