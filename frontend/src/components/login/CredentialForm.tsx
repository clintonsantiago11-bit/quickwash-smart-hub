'use client';

import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isBlockingPhase, type FieldError, type LoginCredentials, type LoginPhase } from '@/lib/auth';

interface CredentialFormProps {
  onSubmit: (data: LoginCredentials) => FieldError | null;
  fieldError: FieldError | null;
  /** Reason the last attempt failed, or '' when there is nothing to report. */
  message: string;
  phase: LoginPhase;
  onClearError: () => void;
}

export default function CredentialForm({
  onSubmit,
  fieldError,
  message,
  phase,
  onClearError,
}: CredentialFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Off by default. On a shared terminal, staying signed in across a browser
  // restart is a risk rather than a convenience, so it is the opt-in.
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const isSubmitting = isBlockingPhase(phase);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const remembered = localStorage.getItem('remembered_email');
    if (remembered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(remembered);
    }
  }, []);

// A rejected credential is the operator's mistake, not a fault on the
  // machine, so the email is kept and the password is cleared ready to be
  // retyped. A network or server failure leaves both fields alone, because
  // nothing was wrong with what they typed.
  useEffect(() => {
    if (phase !== 'failed') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPassword('');
    passwordRef.current?.focus();
  }, [phase]);

  const errFor = (field: 'email' | 'password') =>
    touched[field] && fieldError?.field === field ? fieldError.message : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setTouched({ email: true, password: true });
    const problem = onSubmit({ email, password, keepSignedIn });
    if (problem) {
      requestAnimationFrame(() => {
        (problem.field === 'email' ? emailRef : passwordRef).current?.focus();
      });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="login-form">
      {message && (
        <div className="login-alert" role="alert">
          <ShieldAlert size={16} aria-hidden="true" />
          <p>{message}</p>
        </div>
      )}

      <div className="login-field-group">
        <label htmlFor="login-email" className="login-label">Email</label>
        <div className={`login-field ${errFor('email') ? 'login-field-invalid' : ''}`}>
          <Mail size={18} className="login-field-icon" aria-hidden="true" />
          <input
            ref={emailRef}
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            disabled={isSubmitting}
            onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            onChange={(event) => {
              setEmail(event.target.value);
              onClearError();
            }}
            placeholder="name@quickwash.com…"
            className="login-input"
            aria-invalid={Boolean(errFor('email'))}
            aria-describedby={errFor('email') ? 'email-error' : undefined}
          />
        </div>
        {errFor('email') && (
          <p id="email-error" className="login-field-message" role="alert">{errFor('email')}</p>
        )}
      </div>

      <div className="login-field-group">
        <label htmlFor="login-password" className="login-label">Password</label>
        <div className={`login-field ${errFor('password') ? 'login-field-invalid' : ''}`}>
          <LockKeyhole size={18} className="login-field-icon" aria-hidden="true" />
          <input
            ref={passwordRef}
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            spellCheck={false}
            required
            value={password}
            disabled={isSubmitting}
            onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            onChange={(event) => {
              setPassword(event.target.value);
              onClearError();
            }}
            placeholder="Enter your password…"
            className="login-input login-input-password"
            aria-invalid={Boolean(errFor('password'))}
            aria-describedby={errFor('password') ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="login-eye"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={isSubmitting}
          >
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>
        {errFor('password') && (
          <p id="password-error" className="login-field-message" role="alert">{errFor('password')}</p>
        )}
      </div>

      <label className="login-remember">
        <input
          type="checkbox"
          name="remember"
          checked={keepSignedIn}
          disabled={isSubmitting}
          onChange={(event) => setKeepSignedIn(event.target.checked)}
          className="login-checkbox"
        />
        <span>Keep me signed in</span>
      </label>

      {/* Nothing moves here. The progress bar that used to sit under the
          button is gone: it could only ever sweep, because there is no way
          to know how far through the server's password hashing the request
          is, and an unfillable bar reads as stalled rather than working.
          The label change and the disabled button are the whole signal. */}
      <button type="submit" className="login-btn" disabled={isSubmitting}>
        {phase === 'verifying' ? (
          <>
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            Verifying…
          </>
        ) : phase === 'success' ? (
          'Signed in'
        ) : phase === 'failed' ? (
          'Try again'
        ) : (
          <span>Sign in</span>
        )}
      </button>

      {/* Password hashing on a small instance takes seconds, and nothing on
          the wire says how far through it the server is. The bar therefore
          runs rather than inventing a percentage, and it stops the button
          looking frozen for the whole wait. */}
      {phase === 'verifying' && (
        <div className="login-progress" role="status" aria-live="polite">
          <span className="login-progress-bar" aria-hidden="true" />
          <span className="sr-only">Verifying your credentials…</span>
        </div>
      )}
    </form>
  );
}
