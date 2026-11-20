'use client';

import { CheckCircle2 } from 'lucide-react';

interface WelcomeOverlayProps {
  text: string;
  detail: string;
}

/**
 * Shown after a successful sign-in.
 *
 * A pure display: no button, no click required. It shows who is signed in
 * for a few seconds, then the parent page auto-redirects to the dashboard.
 */
export default function WelcomeOverlay({ text, detail }: WelcomeOverlayProps) {
  return (
    <div
      className="login-welcome"
      role="status"
      aria-live="polite"
    >
      <div className="login-welcome-card">
        <span className="login-welcome-mark" aria-hidden="true">
          <CheckCircle2 size={30} />
        </span>

        <h2 className="login-welcome-title">{text}</h2>
        <p className="login-welcome-detail">{detail}</p>
      </div>
    </div>
  );
}
