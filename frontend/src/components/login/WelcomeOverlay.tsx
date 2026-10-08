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
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div
      className="login-welcome"
      role="status"
      aria-live="polite"
    >
      {/* The card itself is not clickable: only the button is, so keyboard
          and pointer users get the same target. The overlay is dismissed by
          the automatic redirect, or by pressing this. */}
      <div className="login-welcome-card">
        <span className="login-welcome-mark" aria-hidden="true">
          <CheckCircle2 size={30} />
        </span>

        <h2 className="login-welcome-title">{text}</h2>
        <p className="login-welcome-detail">{detail}</p>

        <button
          ref={buttonRef}
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