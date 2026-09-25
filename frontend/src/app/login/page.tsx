'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, LoginError } from '@/lib/api';
import {
  validateCredentials,
  type AuthResponse,
  type FieldError,
  type LoginCredentials,
  type LoginPhase,
} from '@/lib/auth';
import CredentialForm from '@/components/login/CredentialForm';
import QuickWashMark from '@/components/QuickWashMark';

const REDIRECT_MS = 700;

export default function LoginPage() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<LoginPhase>('idle');
  const [serverMessage, setServerMessage] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [signedInName, setSignedInName] = useState('Operator');
  const lastAttempt = useRef<LoginCredentials | null>(null);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  const authenticate = useCallback(async (credentials: LoginCredentials) => {
    setFieldError(null);
    setServerMessage('');
    setPhase('loading');

    try {
      const auth = (await api.login(credentials.email, credentials.password)) as AuthResponse;
      if (credentials.rememberMe) localStorage.setItem('remembered_email', credentials.email.trim());
      else localStorage.removeItem('remembered_email');

      setSignedInName(auth?.user?.full_name || auth?.user?.username || 'Operator');
      setPhase('success');
      redirectTimer.current = setTimeout(() => router.push('/'), REDIRECT_MS);
    } catch (error) {
      const kind = error instanceof LoginError ? error.kind : 'server';
      const messages = {
        network: 'QuickWash could not be reached. Check your connection, then try again.',
        timeout: 'The server took too long to respond. Wait a moment, then try again.',
        credentials: 'The email or password is incorrect. Check your details and try again.',
        server: 'Sign in is temporarily unavailable. Try again in a moment.',
      } as const;
      setServerMessage(messages[kind]);
      setPhase('error');
    }
  }, [router]);

  const handleSubmit = useCallback((credentials: LoginCredentials): FieldError | null => {
    if (phase === 'loading') return null;

    const problem = validateCredentials(credentials);
    if (problem) {
      setFieldError(problem);
      return problem;
    }

    lastAttempt.current = credentials;
    void authenticate(credentials);
    return null;
  }, [authenticate, phase]);

  const handleRetry = useCallback(() => {
    if (phase === 'loading' || !lastAttempt.current) return;
    void authenticate(lastAttempt.current);
  }, [authenticate, phase]);

  const clearError = useCallback(() => {
    setFieldError(null);
    if (phase === 'error') setPhase('idle');
    setServerMessage('');
  }, [phase]);

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
            {phase === 'success' ? (
              <>
                <div className="login-success-mark" aria-hidden="true">
                  <CheckCircle2 size={26} />
                </div>
                <h2 id="login-heading">Welcome back</h2>
                <p>Signed in as {signedInName}. Opening your dashboard…</p>
              </>
            ) : (
              <>
                <h2 id="login-heading">Sign in</h2>
                <p>Enter your details to access the operations hub.</p>
              </>
            )}
          </div>

          {phase === 'success' ? (
            <div className="login-status login-status-success" role="status" aria-live="polite">
              <span className="login-status-dot" aria-hidden="true" />
              Authentication complete
            </div>
          ) : (
            <CredentialForm
              onSubmit={handleSubmit}
              fieldError={fieldError}
              serverMessage={serverMessage}
              isSubmitting={phase === 'loading'}
              onRetry={handleRetry}
              onClearError={clearError}
            />
          )}

          <p className="login-card-foot">Authorized QuickWash operators only.</p>
        </section>
      </main>
    </div>
  );
}
