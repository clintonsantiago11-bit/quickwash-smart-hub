'use client';

import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { FieldError } from '@/lib/auth';

interface CredentialFormProps {
  onSubmit: (data: { email: string; password: string; rememberMe: boolean }) => FieldError | null;
  fieldError: FieldError | null;
  serverMessage: string;
  isSubmitting: boolean;
  onRetry: () => void;
  onClearError: () => void;
}

export default function CredentialForm({
  onSubmit,
  fieldError,
  serverMessage,
  isSubmitting,
  onRetry,
  onClearError,
}: CredentialFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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

  const errFor = (field: 'email' | 'password') =>
    touched[field] && fieldError?.field === field ? fieldError.message : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setTouched({ email: true, password: true });
    const problem = onSubmit({ email, password, rememberMe });
    if (problem) {
      requestAnimationFrame(() => {
        (problem.field === 'email' ? emailRef : passwordRef).current?.focus();
      });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="login-form">
      {serverMessage && (
        <div className="login-alert login-alert-error" role="alert">
          <div>
            <p className="login-alert-title">Sign in unsuccessful</p>
            <p className="login-alert-message">{serverMessage}</p>
          </div>
          <button type="button" className="login-retry" onClick={onRetry} disabled={isSubmitting}>
            <RotateCcw size={15} aria-hidden="true" />
            Try again
          </button>
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
          checked={rememberMe}
          disabled={isSubmitting}
          onChange={(event) => setRememberMe(event.target.checked)}
          className="login-checkbox"
        />
        <span>Remember email</span>
      </label>

      <button type="submit" className="login-btn" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderCircle className="login-spinner" size={18} aria-hidden="true" />
            <span>Signing in…</span>
          </>
        ) : (
          <span>Sign in</span>
        )}
      </button>
    </form>
  );
}
