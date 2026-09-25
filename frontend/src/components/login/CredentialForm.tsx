'use client';

import { Eye, EyeOff, Lock, Mail, Coins, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FieldError } from '@/lib/auth';

interface CredentialFormProps {
  onSubmit: (data: { email: string; password: string; rememberMe: boolean }) => void;
  fieldError: FieldError | null;
  onClearError: () => void;
}

/**
 * High-Precision Tactile Operator Auth Form.
 * Includes interactive coin-trigger hints, password strength calculation,
 * smooth focus animations, and error handling.
 */
export default function CredentialForm({ onSubmit, fieldError, onClearError }: CredentialFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });

  // Restore the remembered operator email (client-only, post-hydration).
  useEffect(() => {
    const remembered = localStorage.getItem('remembered_email');
    if (remembered) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(remembered);
    }
  }, []);

  const errFor = (field: 'email' | 'password') =>
    touched[field] && fieldError?.field === field ? fieldError.message : null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    onSubmit({ email, password, rememberMe });
  };

  return (
    <form onSubmit={submit} noValidate className="mt-5 space-y-5">
      {/* Email Field */}
      <div className="space-y-1.5">
        <label htmlFor="login-email" className="login-label flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
          <span>Operator Email</span>
          {touched.email && !errFor('email') && email.length > 3 && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-sans lowercase">
              <CheckCircle2 size={12} /> valid
            </span>
          )}
        </label>
        <div className={`login-field ${errFor('email') ? 'login-field-invalid' : ''}`}>
          <Mail size={18} className="login-field-icon" aria-hidden />
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            onChange={(e) => { setEmail(e.target.value); onClearError(); }}
            placeholder="operator@quickwash.hub"
            className="login-input"
            aria-invalid={Boolean(errFor('email'))}
            aria-describedby={errFor('email') ? 'email-error' : undefined}
          />
        </div>
        {errFor('email') && (
          <p id="email-error" className="login-field-message" role="alert">{errFor('email')}</p>
        )}
      </div>

      {/* Password Field */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" className="login-label text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
            Password Access
          </label>
          <button
            type="button"
            className="login-forgot text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            title="Contact your administrator to reset your password"
          >
            Forgot Key?
          </button>
        </div>
        <div className={`login-field ${errFor('password') ? 'login-field-invalid' : ''}`}>
          <Lock size={18} className="login-field-icon" aria-hidden />
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            onChange={(e) => { setPassword(e.target.value); onClearError(); }}
            placeholder="Enter security password"
            className="login-input login-input-password"
            aria-invalid={Boolean(errFor('password'))}
            aria-describedby={errFor('password') ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="login-eye"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {errFor('password') && (
          <p id="password-error" className="login-field-message" role="alert">{errFor('password')}</p>
        )}
      </div>

      {/* Remember me */}
      <div className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer select-none items-center gap-2.5">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="login-checkbox"
          />
          <span className="text-xs text-slate-300 font-medium">Remember operator session</span>
        </label>
      </div>

      {/* Submit Button - Coin Mechanism Trigger */}
      <button
        type="submit"
        className="login-btn group w-full relative overflow-hidden flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-bold text-sm tracking-wide text-white transition-all duration-200"
      >
        <div className="relative z-10 flex items-center justify-center gap-2">
          <Coins size={18} className="text-amber-300 animate-bounce-subtle" />
          <span>INSERT COIN TO AUTHENTICATE</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </button>
    </form>
  );
}

