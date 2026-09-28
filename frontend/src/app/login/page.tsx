'use client';

import { ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, LoginError } from '@/lib/api';
import CoinSlotOverlay from '@/components/login/CoinSlotOverlay';
import {
  validateCredentials,
  type AuthResponse,
  type FieldError,
  type LoginCredentials,
  type LoginPhase,
} from '@/lib/auth';
import {
  COIN_INSERT_MS,
  phaseWhilePending,
  REDIRECT_MS,
  shouldHoldResult,
  terminalPhase,
  totalRejectMs,
  type OutcomeKind,
} from '@/lib/login-sequence';
import CredentialForm from '@/components/login/CredentialForm';
import QuickWashMark from '@/components/QuickWashMark';

const failureMessages = {
  network: 'QuickWash could not be reached. Check your connection, then try again.',
  timeout: 'The server took too long to respond. Wait a moment, then try again.',
  credentials: 'The email or password is incorrect. Check your details and try again.',
  server: 'Sign in is temporarily unavailable. Try again in a moment.',
} as const;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Anything that is not one of the three real failure kinds reads as a server fault. */
const messageFor = (kind: OutcomeKind): string =>
  failureMessages[kind === 'network' || kind === 'timeout' || kind === 'credentials' ? kind : 'server'];

export default function LoginPage() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptId = useRef(0);
  const [phase, setPhase] = useState<LoginPhase>('idle');
  const [serverMessage, setServerMessage] = useState('');
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [signedInName, setSignedInName] = useState('Operator');
  const [attempt, setAttempt] = useState(0);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      attemptId.current += 1;
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
      if (progressTimer.current) clearInterval(progressTimer.current);
    },
    []
  );

  /**
   * The request goes out the moment the operator signs in and the coin plays
   * out beside it, rather than the card stalling on an invented delay. A
   * result that lands mid-drop is held until the coin has finished falling,
   * so the sequence is never cut in half.
   */
  const authenticate = useCallback(
    async (credentials: LoginCredentials) => {
      const id = ++attemptId.current;
      const startedAt = performance.now();

      setFieldError(null);
      setServerMessage('');
      setPhase('inserting');
      setAttempt((n) => n + 1);

      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = setInterval(() => {
        if (id !== attemptId.current) return;
        setPhase(phaseWhilePending(performance.now() - startedAt));
      }, 80);

      let kind: OutcomeKind = 'unknown';
      let auth: AuthResponse | null = null;
      try {
        auth = (await api.login(credentials.email, credentials.password)) as AuthResponse;
        kind = 'ok';
      } catch (error) {
        kind = error instanceof LoginError ? error.kind : 'server';
      }

      if (id !== attemptId.current) return;
      stopProgress();

      const elapsed = performance.now() - startedAt;
      if (shouldHoldResult(elapsed)) {
        setPhase(phaseWhilePending(elapsed));
        await wait(COIN_INSERT_MS - elapsed);
        if (id !== attemptId.current) return;
      }

      const next = terminalPhase(kind);

      if (next === 'success' && auth) {
        if (credentials.rememberMe) localStorage.setItem('remembered_email', credentials.email.trim());
        else localStorage.removeItem('remembered_email');

        setSignedInName(auth?.user?.full_name || auth?.user?.username || 'Operator');
        setPhase('success');
        redirectTimer.current = setTimeout(() => router.push('/'), REDIRECT_MS);
        return;
      }

      if (next === 'rejecting') {
        setPhase('rejecting');
        // The coin has to finish rattling and being thrown back out before the
        // card settles and the form becomes editable again.
        await wait(totalRejectMs());
        if (id !== attemptId.current) return;
        setServerMessage(messageFor('credentials'));
        setPhase('jam');
        return;
      }

      setServerMessage(messageFor(kind));
      setPhase('error');
    },
    [router, stopProgress]
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

  // Escape backs out of a settled failure so the operator is never trapped.
  useEffect(() => {
    if (phase !== 'jam' && phase !== 'error') return;
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
            notice={phase === 'jam' || phase === 'error' ? { phase, message: serverMessage } : null}
            phase={phase}
            onClearError={clearError}
          />

          {phase !== 'idle' && phase !== 'jam' && phase !== 'error' && (
            <CoinSlotOverlay
              key={attempt}
              phase={phase}
              signedInName={signedInName}
            />
          )}

          <p className="login-card-foot">Authorized QuickWash operators only.</p>
        </section>
      </main>
    </div>
  );
}
