'use client';

import { ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, LoginError, type LoginErrorKind } from '@/lib/api';
import WelcomeOverlay from '@/components/login/WelcomeOverlay';
import {
  validateCredentials,
  type AuthResponse,
  type FieldError,
  type LoginCredentials,
  type LoginPhase,
} from '@/lib/auth';
import {
  LAST_SIGN_IN_KEY,
  WELCOME_MS,
  greeting,
  greetingName,
  isReturningVisitor,
  welcomeDetail,
} from '@/lib/welcome';
import CredentialForm from '@/components/login/CredentialForm';
import QuickWashMark from '@/components/QuickWashMark';

const failureMessages: Record<LoginErrorKind, string> = {
  network: 'QuickWash could not be reached. Check your connection, then try again.',
  timeout: 'The server took too long to respond. Wait a moment, then try again.',
  credentials: 'That email and password do not match. Check them and try again.',
  server: 'Sign in is temporarily unavailable. Try again in a moment.',
};

export default function LoginPage() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptId = useRef(0);
  const [phase, setPhase] = useState<LoginPhase>('idle');
  const [serverMessage, setServerMessage] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [welcome, setWelcome] = useState<{ text: string; detail: string } | null>(null);

  useEffect(
    () => () => {
      // Invalidate any in-flight attempt so a late response cannot write into
      // an unmounted page and restart the redirect.
      attemptId.current += 1;
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    []
  );

  /**
   * One request, one of two outcomes.
   *
   * There is no invented delay and nothing is held back: whatever the server
   * answers, that is what shows. A wrong password used to wait 700ms for a coin
   * to be thrown out of a slot before the reason appeared.
   */
  const authenticate = useCallback(
    async (credentials: LoginCredentials) => {
      const id = ++attemptId.current;

      setFieldError(null);
      setServerMessage('');
      setPhase('verifying');

      let auth: AuthResponse | null = null;
      let failure: LoginErrorKind = 'server';

      try {
        auth = (await api.login(credentials.email, credentials.password)) as AuthResponse;
      } catch (error) {
        failure = error instanceof LoginError ? error.kind : 'server';
      }

      // A newer attempt superseded this one while the request was in flight.
      if (id !== attemptId.current) return;

      if (auth) {
        if (credentials.rememberMe) localStorage.setItem('remembered_email', credentials.email.trim());
        else localStorage.removeItem('remembered_email');

        // Read before writing, so the first sign-in from this browser is
        // greeted as a first visit rather than a return.
        const returning = isReturningVisitor(localStorage.getItem(LAST_SIGN_IN_KEY));
        localStorage.setItem(LAST_SIGN_IN_KEY, new Date().toISOString());

        setWelcome({
          text: greeting(greetingName(auth.user), returning),
          detail: welcomeDetail(auth.user),
        });
        setPhase('success');
        redirectTimer.current = setTimeout(() => router.push('/'), WELCOME_MS);
        return;
      }

      setServerMessage(failureMessages[failure]);
      setPhase('failed');
    },
    [router]
  );

  const handleSubmit = useCallback(
    (credentials: LoginCredentials): FieldError | null => {
      const problem = validateCredentials(credentials);
      if (problem) {
        setFieldError(problem);
        return problem;
      }

      void authenticate(credentials);
      return null;
    },
    [authenticate]
  );

  const clearError = useCallback(() => {
    setFieldError(null);
    setServerMessage('');
    setPhase('idle');
  }, []);

  // Escape dismisses a failure, so an operator is never left staring at a
// message they have already read.
  useEffect(() => {
    if (phase !== 'failed') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearError();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, clearError]);

  return (
    <div className="login-scene">
      <div className="login-grid" aria-hidden="true" />
      <div className="login-glow" aria-hidden="true" />

      <a href="#login-panel" className="login-skip-link">Skip to sign in</a>

      <main className="login-shell">
        <section className="login-context" aria-labelledby="login-page-title">
          <div className="login-brand" translate="no">
            <QuickWashMark className="login-brand-mark" />
            <div>
              <p className="login-brand-name">QuickWash <span>Smart Hub</span></p>
              <p className="login-brand-caption">Facility operations platform</p>
            </div>
          </div>

          <div className="login-context-copy">
            <p className="login-kicker">One connected workspace</p>
            <h1 id="login-page-title">Keep every wash bay moving.</h1>
            <p className="login-context-description">
              Monitor equipment, cameras, vending, and alerts from one secure operations hub.
            </p>
          </div>

          <div className="login-secure-note">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Secure access for authorized operators</span>
          </div>
        </section>

        <section id="login-panel" className="login-card" aria-labelledby="login-heading">
          <div className="login-card-header">
            <p className="login-kicker">Operator portal</p>
            <h2 id="login-heading">Sign in</h2>
            <p>Enter your details to access the operations hub.</p>
          </div>

          <CredentialForm
            onSubmit={handleSubmit}
            fieldError={fieldError}
            message={phase === 'failed' ? serverMessage : ''}
            phase={phase}
            onClearError={clearError}
          />

          <p className="login-card-foot">Authorized QuickWash operators only.</p>
        </section>
      </main>

      {phase === 'success' && welcome && (
        <WelcomeOverlay
          text={welcome.text}
          detail={welcome.detail}
          onSkip={() => router.push('/')}
        />
      )}
    </div>
  );
}
